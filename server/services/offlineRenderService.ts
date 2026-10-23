import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CommentarySegment } from '../types.ts';
import { FFmpegWorkerService, MediaProbeResult } from './ffmpegWorker.ts';

const execFileAsync = promisify(execFile);

export interface OfflineRenderJobResult {
  success: boolean;
  outputPath: string;
  outputUrl: string;
  isHls: boolean;
  mixedCommentaryCount: number;
  probeResult?: MediaProbeResult;
  latencyMs: number;
  errorMessage?: string;
}

export class OfflineRenderService {
  private static instance: OfflineRenderService;
  private ttsCacheDir: string;
  private renderedDir: string;
  private hlsDir: string;

  private constructor() {
    this.ttsCacheDir = path.resolve(process.cwd(), 'data', 'tts_cache');
    this.renderedDir = path.resolve(process.cwd(), 'data', 'rendered');
    this.hlsDir = path.resolve(process.cwd(), 'public', 'live');

    if (!fs.existsSync(this.renderedDir)) {
      fs.mkdirSync(this.renderedDir, { recursive: true });
    }
  }

  public static getInstance(): OfflineRenderService {
    if (!OfflineRenderService.instance) {
      OfflineRenderService.instance = new OfflineRenderService();
    }
    return OfflineRenderService.instance;
  }

  /**
   * Renders a synchronized output mixing verified commentary speech assets at media PTS
   */
  public async renderSynchronizedOutput(params: {
    sourcePath: string;
    commentarySegments: CommentarySegment[];
    outputFormat?: 'hls' | 'mp4';
    duckingLevel?: number; // default 0.35 (lower stadium background during commentary)
  }): Promise<OfflineRenderJobResult> {
    const startTime = Date.now();
    const { sourcePath, commentarySegments, outputFormat = 'hls', duckingLevel = 0.35 } = params;

    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        outputPath: '',
        outputUrl: '',
        isHls: outputFormat === 'hls',
        mixedCommentaryCount: 0,
        latencyMs: Date.now() - startTime,
        errorMessage: `منبع ویدیویی در مسیر ${sourcePath} یافت نشد.`,
      };
    }

    // 1. Collect valid audio files on disk that match commentary segments
    const validAudioInputs: { filePath: string; targetPtsMs: number; segment: CommentarySegment }[] = [];
    for (const seg of commentarySegments) {
      const audioCand = seg.audioUrl || (seg as any).audioAssetUrl;
      if (audioCand) {
        let localWav = audioCand;
        if (!fs.existsSync(localWav)) {
          const filename = path.basename(audioCand);
          localWav = path.join(this.ttsCacheDir, filename);
        }
        if (fs.existsSync(localWav) && fs.statSync(localWav).size > 44) {
          const pts = seg.sourceMediaTargetPts ?? (seg as any).sourceTimestampPts ?? 0;
          validAudioInputs.push({
            filePath: localWav,
            targetPtsMs: Math.max(0, Math.round(pts * 1000)),
            segment: seg,
          });
        }
      }
    }

    // Sort by PTS to ensure sequential delay
    validAudioInputs.sort((a, b) => a.targetPtsMs - b.targetPtsMs);

    const isHls = outputFormat === 'hls';
    const outputPath = isHls
      ? path.join(this.hlsDir, 'index.m3u8')
      : path.join(this.renderedDir, `mix_${Date.now()}.mp4`);
    const outputUrl = isHls ? '/live/index.m3u8' : `/rendered/${path.basename(outputPath)}`;

    try {
      const args: string[] = ['-y', '-i', sourcePath];

      // Add each commentary audio file as an input
      for (const input of validAudioInputs) {
        args.push('-i', input.filePath);
      }

      if (validAudioInputs.length === 0) {
        // No commentary audio files available; render clean source copy
        console.log('[OfflineRender] No commentary audio files found; outputting source audio without AI mix.');
        if (isHls) {
          args.push(
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-f',
            'hls',
            '-hls_time',
            '4',
            '-hls_list_size',
            '5',
            '-hls_flags',
            'delete_segments+append_list+omit_endlist',
            '-hls_segment_filename',
            path.join(this.hlsDir, 'segment_%03d.ts'),
            outputPath
          );
        } else {
          args.push('-c:v', 'copy', '-c:a', 'aac', outputPath);
        }
      } else {
        // Construct filter_complex using adelay and amix
        const filterParts: string[] = [];
        // Duck source audio
        filterParts.push(`[0:a]volume=${duckingLevel.toFixed(2)}[bg]`);

        const mixInputs: string[] = ['[bg]'];
        validAudioInputs.forEach((input, index) => {
          const inputIdx = index + 1;
          const label = `c${inputIdx}`;
          filterParts.push(`[${inputIdx}:a]adelay=${input.targetPtsMs}|${input.targetPtsMs}[${label}]`);
          mixInputs.push(`[${label}]`);
        });

        filterParts.push(
          `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[aout]`
        );

        args.push('-filter_complex', filterParts.join(';'));
        args.push('-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k');

        if (isHls) {
          args.push(
            '-f',
            'hls',
            '-hls_time',
            '4',
            '-hls_list_size',
            '5',
            '-hls_flags',
            'delete_segments+append_list+omit_endlist',
            '-hls_segment_filename',
            path.join(this.hlsDir, 'segment_%03d.ts'),
            outputPath
          );
        } else {
          args.push(outputPath);
        }
      }

      console.log(`[OfflineRender] Executing FFmpeg render job to ${outputPath}`);
      await execFileAsync('ffmpeg', args);

      // Verify rendered output with FFprobe
      const probeTarget = isHls ? path.join(this.hlsDir, 'segment_000.ts') : outputPath;
      const probeTargetFile = fs.existsSync(probeTarget) ? probeTarget : sourcePath;
      const probeResult = await FFmpegWorkerService.getInstance().probeMedia(probeTargetFile);

      return {
        success: true,
        outputPath,
        outputUrl,
        isHls,
        mixedCommentaryCount: validAudioInputs.length,
        probeResult: probeResult || undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      console.error('[OfflineRender] FFmpeg render failed:', err);
      return {
        success: false,
        outputPath: '',
        outputUrl: '',
        isHls,
        mixedCommentaryCount: 0,
        latencyMs: Date.now() - startTime,
        errorMessage: err?.message || 'خطا در رندر صوتی و میکس FFmpeg',
      };
    }
  }
}
