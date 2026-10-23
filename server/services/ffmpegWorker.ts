import fs from 'fs';
import path from 'path';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface MediaProbeResult {
  durationSeconds: number;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  bitrate?: number;
}

export interface FFmpegWorkerConfig {
  sourcePath: string;
  outputDir?: string;
  targetLiveDelaySeconds?: number;
}

export class FFmpegWorkerService {
  private static instance: FFmpegWorkerService;
  private currentProcess: ChildProcess | null = null;
  private hlsDir: string;
  private isRunning = false;
  private lastExitCode: number | null = null;
  private lastErrorLog = '';

  private constructor() {
    this.hlsDir = path.resolve(process.cwd(), 'public', 'live');
    this.ensureHlsDirectory();
  }

  public static getInstance(): FFmpegWorkerService {
    if (!FFmpegWorkerService.instance) {
      FFmpegWorkerService.instance = new FFmpegWorkerService();
    }
    return FFmpegWorkerService.instance;
  }

  public static async probeMedia(filePath: string): Promise<MediaProbeResult | null> {
    return FFmpegWorkerService.getInstance().probeMedia(filePath);
  }

  public ensureHlsDirectory(): void {
    if (!fs.existsSync(this.hlsDir)) {
      try {
        fs.mkdirSync(this.hlsDir, { recursive: true });
      } catch (err) {
        console.warn('[FFmpeg] Could not create HLS directory:', err);
      }
    }
  }

  public getStatus(): { isRunning: boolean; pid?: number; lastExitCode: number | null; outputReady: boolean } {
    return {
      isRunning: this.isRunning && !!this.currentProcess,
      pid: this.currentProcess?.pid,
      lastExitCode: this.lastExitCode,
      outputReady: this.isHlsOutputReady(),
    };
  }

  /**
   * Probe media file using real ffprobe
   */
  public async probeMedia(filePath: string): Promise<MediaProbeResult | null> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      const data = JSON.parse(stdout);
      const vStream = data.streams?.find((s: any) => s.codec_type === 'video');
      const aStream = data.streams?.find((s: any) => s.codec_type === 'audio');
      const duration = parseFloat(data.format?.duration || vStream?.duration || '0');

      return {
        durationSeconds: duration,
        resolution: vStream ? `${vStream.width}x${vStream.height}` : undefined,
        videoCodec: vStream?.codec_name,
        audioCodec: aStream?.codec_name,
        hasVideo: !!vStream,
        hasAudio: !!aStream,
        bitrate: parseInt(data.format?.bit_rate || '0', 10),
      };
    } catch (err) {
      console.warn('[FFprobe] Failed to probe media:', err);
      return null;
    }
  }

  /**
   * Start supervising real FFmpeg HLS transcode/package process
   */
  public async startHlsWorker(config: FFmpegWorkerConfig): Promise<boolean> {
    // 1. Enforce strict single worker instance
    await this.stopHlsWorker();

    this.ensureHlsDirectory();
    this.cleanHlsDirectory();

    const outputPlaylist = path.join(this.hlsDir, 'index.m3u8');
    const segmentPattern = path.join(this.hlsDir, 'segment_%03d.ts');

    // Safe argument array - no interpolated shell strings!
    const args = [
      '-re',
      '-i',
      config.sourcePath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-f',
      'hls',
      '-hls_time',
      '4',
      '-hls_list_size',
      '5',
      '-hls_flags',
      'delete_segments+append_list+omit_endlist',
      '-hls_segment_filename',
      segmentPattern,
      outputPlaylist,
    ];

    try {
      console.log(`[FFmpeg Worker] Spawning worker with source: ${config.sourcePath}`);
      const proc = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      this.currentProcess = proc;
      this.isRunning = true;
      this.lastExitCode = null;
      this.lastErrorLog = '';

      proc.stderr?.on('data', (data) => {
        const line = data.toString();
        this.lastErrorLog = line;
        // Keep logs clean and avoid flooding
        if (line.includes('Error') || line.includes('fatal')) {
          console.warn('[FFmpeg Stderr]', line.trim());
        }
      });

      proc.on('close', (code) => {
        console.log(`[FFmpeg Worker] Process exited with code ${code}`);
        this.isRunning = false;
        this.lastExitCode = code;
        this.currentProcess = null;
      });

      proc.on('error', (err) => {
        console.error('[FFmpeg Worker] Process error:', err);
        this.isRunning = false;
        this.currentProcess = null;
      });

      // Wait up to 5 seconds to verify initial segment creation
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (this.isHlsOutputReady()) {
          console.log('[FFmpeg Worker] HLS output verified on disk.');
          return true;
        }
      }

      return this.isHlsOutputReady();
    } catch (err) {
      console.error('[FFmpeg Worker] Failed to spawn FFmpeg:', err);
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Graceful stop and resource cleanup
   */
  public async stopHlsWorker(): Promise<void> {
    if (!this.currentProcess) return;

    const proc = this.currentProcess;
    this.isRunning = false;

    try {
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {}
          resolve();
        }, 2000);

        proc.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch {}

    this.currentProcess = null;
    this.cleanHlsDirectory();
  }

  public cleanHlsDirectory(): void {
    try {
      if (fs.existsSync(this.hlsDir)) {
        const files = fs.readdirSync(this.hlsDir);
        for (const file of files) {
          if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
            fs.unlinkSync(path.join(this.hlsDir, file));
          }
        }
      }
    } catch (err) {
      console.warn('[FFmpeg] Error cleaning HLS dir:', err);
    }
  }

  public isHlsOutputReady(): boolean {
    const playlist = path.join(this.hlsDir, 'index.m3u8');
    if (!fs.existsSync(playlist)) return false;
    try {
      const content = fs.readFileSync(playlist, 'utf-8');
      const files = fs.readdirSync(this.hlsDir);
      const hasSegments = files.some((f) => f.endsWith('.ts') && fs.statSync(path.join(this.hlsDir, f)).size > 0);
      return content.includes('#EXTINF') && hasSegments;
    } catch {
      return false;
    }
  }

  /**
   * Command generator for VPS documentation
   */
  public static generateVpsFFmpegCommand(config: {
    sourceUrl: string;
    outputDir: string;
    targetLiveDelaySeconds: number;
    audioMode: string;
  }): string {
    const { sourceUrl, outputDir } = config;
    return `ffmpeg -re -i "${sourceUrl}" \\
  -c:v copy -c:a aac -b:a 128k \\
  -f hls -hls_time 4 -hls_list_size 5 -hls_flags delete_segments \\
  -hls_segment_filename "${outputDir}/seg_%04d.ts" \\
  "${outputDir}/index.m3u8"`;
  }
}
