import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import { AudioAsset, CommentarySegment } from '../types.ts';

const execFileAsync = promisify(execFile);

export interface TTSProvider {
  synthesize(segment: CommentarySegment, voiceName?: string): Promise<AudioAsset>;
}

export class PersianTTSProvider implements TTSProvider {
  private cacheDir: string;
  private memoryCache: Map<string, AudioAsset> = new Map();
  private aiClient: GoogleGenAI | null = null;
  private ttsModelName: string;

  constructor() {
    this.cacheDir = path.resolve(process.cwd(), 'data', 'tts_cache');
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err) {
        console.warn('[TTS] Could not create cache dir:', err);
      }
    }

    // Configurable model from env or documented alias
    this.ttsModelName = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.aiClient = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[TTS] Failed to init GoogleGenAI client:', err);
      }
    }
  }

  public async synthesize(
    segment: CommentarySegment,
    voiceName = 'pejman_energetic'
  ): Promise<AudioAsset> {
    // Cache key incorporates text content, voice name, and model ID
    const contentHash = crypto
      .createHash('sha256')
      .update(`${segment.persianText}_${voiceName}_${this.ttsModelName}`)
      .digest('hex')
      .substring(0, 16);

    const cacheKey = `tts_${contentHash}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    const filename = `${cacheKey}.wav`;
    const filePath = path.join(this.cacheDir, filename);
    const audioUrl = `/api/v1/audio/${filename}`;

    // If already generated on disk
    if (fs.existsSync(filePath)) {
      const duration = await this.probeAudioDuration(filePath);
      const asset: AudioAsset = {
        id: `audio_${cacheKey}`,
        commentaryId: segment.id,
        sourceTargetPts: segment.sourceMediaTargetPts,
        durationSeconds: duration,
        audioUrl,
        status: 'generated',
        provider: 'gemini_tts',
        fileSizeBytes: fs.statSync(filePath).size,
        createdAt: new Date().toISOString(),
      };
      this.memoryCache.set(cacheKey, asset);
      return asset;
    }

    // 1. Real Google GenAI TTS model execution
    if (this.aiClient) {
      try {
        console.log(`[TTS] Requesting speech synthesis via ${this.ttsModelName} for: "${segment.persianText.substring(0, 30)}..."`);

        const timeoutMs = process.env.NODE_ENV === 'test' ? 1000 : 5000;
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`TTS synthesis timeout (${timeoutMs}ms)`)), timeoutMs);
          timer.unref();
        });
        const response = await Promise.race([
          this.aiClient.models.generateContent({
            model: this.ttsModelName,
            contents: segment.persianText,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck',
                  },
                },
              },
            },
          }),
          timeoutPromise,
        ]).finally(() => clearTimeout(timer));

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          const rawBuffer = Buffer.from(part.inlineData.data, 'base64');
          const mime = (part.inlineData.mimeType || 'audio/pcm').toLowerCase();

          if (mime.includes('pcm') || !mime.includes('wav')) {
            // Write RIFF/WAV header for 24kHz 16-bit mono PCM
            const wavBuffer = this.addWavHeader(rawBuffer, 24000, 1, 16);
            fs.writeFileSync(filePath, wavBuffer);
          } else {
            fs.writeFileSync(filePath, rawBuffer);
          }

          // Measure actual true duration with ffprobe
          const realDuration = await this.probeAudioDuration(filePath);

          const asset: AudioAsset = {
            id: `audio_${cacheKey}`,
            commentaryId: segment.id,
            sourceTargetPts: segment.sourceMediaTargetPts,
            durationSeconds: realDuration,
            audioUrl,
            status: 'generated',
            provider: 'gemini_tts',
            fileSizeBytes: fs.statSync(filePath).size,
            createdAt: new Date().toISOString(),
          };

          this.memoryCache.set(cacheKey, asset);
          return asset;
        }
      } catch (err: any) {
        console.warn(`[TTS] Speech synthesis error with model ${this.ttsModelName}:`, err?.message || err);
      }
    }

    // 2. Honest Fallback: TEXT_ONLY / no fabricated speech labeled as real audio
    const fallbackAsset: AudioAsset = {
      id: `audio_text_only_${cacheKey}`,
      commentaryId: segment.id,
      sourceTargetPts: segment.sourceMediaTargetPts,
      durationSeconds: segment.estimatedDurationSeconds,
      audioUrl: '', // No audio URL
      status: 'failed',
      provider: 'mock_synth', // Explicitly marked as mock/text-only
      createdAt: new Date().toISOString(),
    };

    return fallbackAsset;
  }

  /**
   * Probe actual duration of generated audio file using ffprobe
   */
  private async probeAudioDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'quiet',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const dur = parseFloat(stdout.trim());
      return isNaN(dur) ? 3.0 : Number(dur.toFixed(2));
    } catch {
      return 3.0;
    }
  }

  /**
   * Adds standard 44-byte RIFF/WAV header for raw PCM audio data
   */
  public addWavHeader(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    header.writeUInt32LE(byteRate, 28);
    const blockAlign = (numChannels * bitsPerSample) / 8;
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
