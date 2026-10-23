import fs from 'fs';
import path from 'path';

export interface FFmpegJobConfig {
  sourceUrl: string;
  outputDir: string;
  targetLiveDelaySeconds: number;
  audioMode: string;
}

export class FFmpegWorkerService {
  private static HLS_DIR = path.resolve(process.cwd(), 'public', 'live');

  public static ensureHlsDirectory(): void {
    if (!fs.existsSync(this.HLS_DIR)) {
      try {
        fs.mkdirSync(this.HLS_DIR, { recursive: true });
      } catch (err) {
        console.warn('[FFmpeg] Could not create HLS directory:', err);
      }
    }
  }

  /**
   * Generates the real production FFmpeg command for Ubuntu VPS deployment
   */
  public static generateVpsFFmpegCommand(config: FFmpegJobConfig): string {
    const { sourceUrl, outputDir, targetLiveDelaySeconds, audioMode } = config;

    let audioFilter = '';
    if (audioMode === 'ducking') {
      // Sidechain compression / ducking in FFmpeg
      audioFilter = '-filter_complex "[0:a]volume=0.8[bg];[1:a]volume=1.2[comm];[bg][comm]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]"';
    } else if (audioMode === 'ai_only') {
      audioFilter = '-an -map 0:v';
    }

    return `ffmpeg -re -i "${sourceUrl}" \\
  -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2800k -bufsize 5000k \\
  -pix_fmt yuv420p -g 50 -keyint_min 50 -sc_threshold 0 \\
  ${audioFilter ? audioFilter : '-c:a aac -b:a 128k -ar 48000'} \\
  -f hls \\
  -hls_time 4 \\
  -hls_list_size 6 \\
  -hls_flags delete_segments+append_list+omit_endlist \\
  -hls_segment_filename "${outputDir}/seg_%04d.ts" \\
  "${outputDir}/index.m3u8"`;
  }

  /**
   * Generates or serves the active HLS playlist
   */
  public static getOrCreatePlaylist(currentPts: number): string {
    this.ensureHlsDirectory();

    const segmentDuration = 4;
    const currentSeq = Math.max(1, Math.floor(currentPts / segmentDuration));

    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${segmentDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${currentSeq}`,
      '',
      `#EXTINF:${segmentDuration.toFixed(1)},`,
      `segment_${currentSeq}.ts`,
      `#EXTINF:${segmentDuration.toFixed(1)},`,
      `segment_${currentSeq + 1}.ts`,
      `#EXTINF:${segmentDuration.toFixed(1)},`,
      `segment_${currentSeq + 2}.ts`,
    ].join('\n');

    return playlist;
  }
}
