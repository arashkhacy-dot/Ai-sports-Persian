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
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  public static getInstance(): OfflineRenderService {
    if (!OfflineRenderService.instance) {
      OfflineRenderService.instance = new OfflineRenderService();
    }
    return OfflineRenderService.instance;
  }

  /**
   * Renders a synchronized output mixing verified commentary speech assets at media PTS.
   * Handles:
   * - Source with NO audio stream: generates silent background track before mixing commentary.
   * - Source WITH audio stream: ducks original audio ONLY during commentary windows, preserving stadium ambience.
   * - Output with faststart MP4 seeking and verified audio/video streams via ffprobe.
   */
  public async renderSynchronizedOutput(params: {
    sourcePath: string;
    commentarySegments: CommentarySegment[];
    outputFormat?: 'hls' | 'mp4';
    duckingLevel?: number; // default 0.35 (lower stadium background only during speech)
  }): Promise<OfflineRenderJobResult> {
    const startTime = Date.now();
    const { sourcePath, commentarySegments, outputFormat = 'mp4', duckingLevel = 0.35 } = params;

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

    // Inspect source media streams via ffprobe (P1.G)
    const sourceProbe = await FFmpegWorkerService.probeMedia(sourcePath);
    const hasSourceAudio = !!sourceProbe?.hasAudio;

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

      if (validAudioInputs.length === 0) {
        // Case A: No commentary speech available
        console.log('[OfflineRender] No commentary audio files found; outputting clean copy.');
        if (hasSourceAudio) {
          if (isHls) {
            args.push(
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-f', 'hls',
              '-hls_time', '4',
              '-hls_list_size', '5',
              '-hls_flags', 'delete_segments+append_list+omit_endlist',
              '-hls_segment_filename', path.join(this.hlsDir, 'segment_%03d.ts'),
              outputPath
            );
          } else {
            args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath);
          }
        } else {
          // No source audio either: add silent audio so MP4 has a valid audio track
          args.push(
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
            '-shortest'
          );
          if (isHls) {
            args.push(
              '-f', 'hls',
              '-hls_time', '4',
              '-hls_list_size', '5',
              '-hls_flags', 'delete_segments+append_list+omit_endlist',
              '-hls_segment_filename', path.join(this.hlsDir, 'segment_%03d.ts'),
              outputPath
            );
          } else {
            args.push('-movflags', '+faststart', outputPath);
          }
        }
      } else {
        // Case B: We have commentary audio files to mix
        if (hasSourceAudio) {
          // Source has audio: add commentary files as inputs
          for (const input of validAudioInputs) {
            args.push('-i', input.filePath);
          }

          const filterParts: string[] = [];

          // Precisely timed ducking during commentary intervals (preserves stadium ambience outside speech)
          const duckingConditions = validAudioInputs
            .map((input) => {
              const startSec = (input.targetPtsMs / 1000).toFixed(2);
              const durSec = input.segment.estimatedDurationSeconds || 3.0;
              const endSec = (input.targetPtsMs / 1000 + durSec).toFixed(2);
              return `between(t,${startSec},${endSec})`;
            })
            .join('+');

          filterParts.push(`[0:a]volume=eval=frame:volume='if(${duckingConditions},${duckingLevel.toFixed(2)},1.0)'[bg]`);

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
              '-f', 'hls',
              '-hls_time', '4',
              '-hls_list_size', '5',
              '-hls_flags', 'delete_segments+append_list+omit_endlist',
              '-hls_segment_filename', path.join(this.hlsDir, 'segment_%03d.ts'),
              outputPath
            );
          } else {
            args.push('-movflags', '+faststart', outputPath);
          }
        } else {
          // Source has NO audio: insert silent background audio stream at input 1, commentary files as input 2, 3...
          args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
          for (const input of validAudioInputs) {
            args.push('-i', input.filePath);
          }

          const filterParts: string[] = [];
          const mixInputs: string[] = ['[1:a]'];
          validAudioInputs.forEach((input, index) => {
            const inputIdx = index + 2; // offset by 2 (0: source video, 1: anullsrc)
            const label = `c${inputIdx}`;
            filterParts.push(`[${inputIdx}:a]adelay=${input.targetPtsMs}|${input.targetPtsMs}[${label}]`);
            mixInputs.push(`[${label}]`);
          });

          filterParts.push(
            `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[aout]`
          );

          args.push('-filter_complex', filterParts.join(';'));
          args.push('-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest');

          if (isHls) {
            args.push(
              '-f', 'hls',
              '-hls_time', '4',
              '-hls_list_size', '5',
              '-hls_flags', 'delete_segments+append_list+omit_endlist',
              '-hls_segment_filename', path.join(this.hlsDir, 'segment_%03d.ts'),
              outputPath
            );
          } else {
            args.push('-movflags', '+faststart', outputPath);
          }
        }
      }

      console.log(`[OfflineRender] Executing FFmpeg render job to ${outputPath}`);
      await execFileAsync('ffmpeg', args);

      // Verify rendered output with FFprobe (P1.G)
      const probeTarget = isHls ? path.join(this.hlsDir, 'segment_000.ts') : outputPath;
      const probeTargetFile = fs.existsSync(probeTarget) ? probeTarget : outputPath;
      const probeResult = await FFmpegWorkerService.probeMedia(probeTargetFile);

      const hasAudio = !!probeResult?.hasAudio;
      const hasVideo = !!probeResult?.hasVideo;

      return {
        success: hasVideo && (hasAudio || !hasSourceAudio),
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
