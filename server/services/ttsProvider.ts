import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AudioAsset, CommentarySegment } from '../types.ts';

export interface TTSProvider {
  synthesize(segment: CommentarySegment, voiceName?: string, allowFallbackMock?: boolean): Promise<AudioAsset>;
}

export class PersianTTSProvider implements TTSProvider {
  private cacheDir: string;
  private memoryCache: Map<string, AudioAsset> = new Map();
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    this.cacheDir = path.resolve(process.cwd(), 'data', 'tts_cache');
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err) {
        console.warn('[TTS] Could not create cache dir:', err);
      }
    }

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
    voiceName = 'pejman_energetic',
    allowFallbackMock = true
  ): Promise<AudioAsset> {
    const cacheKey = `${segment.id}_${voiceName}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    const filename = `${segment.id}.wav`;
    const filePath = path.join(this.cacheDir, filename);
    const audioUrl = `/api/v1/audio/${filename}`;

    // 1. Try real Google GenAI TTS model if configured
    if (this.aiClient) {
      try {
        console.log(`[TTS] Attempting real Gemini speech synthesis for: "${segment.persianText.substring(0, 30)}..."`);
        const response = await this.aiClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: segment.persianText,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Puck', // Supported standard voice
                },
              },
            },
          },
        });

        // Check if inlineData audio was returned
        const candidatePart = response.candidates?.[0]?.content?.parts?.[0];
        if (candidatePart?.inlineData?.data) {
          const audioBuffer = Buffer.from(candidatePart.inlineData.data, 'base64');
          fs.writeFileSync(filePath, audioBuffer);

          const asset: AudioAsset = {
            id: `audio_${segment.id}`,
            commentaryId: segment.id,
            sourceTargetPts: segment.sourceMediaTargetPts,
            durationSeconds: segment.estimatedDurationSeconds,
            audioUrl,
            status: 'generated',
            provider: 'gemini_tts', // Real speech provider
            fileSizeBytes: audioBuffer.length,
            createdAt: new Date().toISOString(),
          };

          this.memoryCache.set(cacheKey, asset);
          return asset;
        }
      } catch (err: any) {
        console.warn('[TTS] Real Gemini TTS call failed or Persian not supported:', err?.message || err);
      }
    }

    // 2. Explicit Mock Mode (labeled mock_synth)
    if (allowFallbackMock) {
      const duration = segment.estimatedDurationSeconds;
      this.createSynthesizedWav(filePath, duration, segment.intensity);

      const asset: AudioAsset = {
        id: `audio_${segment.id}`,
        commentaryId: segment.id,
        sourceTargetPts: segment.sourceMediaTargetPts,
        durationSeconds: duration,
        audioUrl,
        status: 'generated',
        provider: 'mock_synth', // Explicitly labeled as mock_synth
        createdAt: new Date().toISOString(),
      };

      this.memoryCache.set(cacheKey, asset);
      return asset;
    }

    // 3. Graceful failure when TTS is strictly required
    const failedAsset: AudioAsset = {
      id: `audio_${segment.id}`,
      commentaryId: segment.id,
      sourceTargetPts: segment.sourceMediaTargetPts,
      durationSeconds: 0,
      audioUrl: '',
      status: 'failed',
      provider: 'gemini_tts',
      createdAt: new Date().toISOString(),
    };
    return failedAsset;
  }

  /**
   * Generates a basic test WAV tone for offline testing
   */
  private createSynthesizedWav(filePath: string, durationSeconds: number, intensity: string): void {
    try {
      const sampleRate = 24000;
      const totalSamples = Math.floor(sampleRate * durationSeconds);
      const dataSize = totalSamples * 2;
      const buffer = Buffer.alloc(44 + dataSize);

      // WAV Header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + dataSize, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20); // PCM
      buffer.writeUInt16LE(1, 22); // Mono
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);

      const baseFreq = intensity === 'explosive' ? 240 : intensity === 'high' ? 200 : 160;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        const mod = 0.5 * (1 + Math.sin(2 * Math.PI * 3.5 * t));
        const sampleVal = Math.sin(2 * Math.PI * baseFreq * t) * 0.4 * mod;
        const int16 = Math.floor(Math.max(-1, Math.min(1, sampleVal)) * 32767);
        buffer.writeInt16LE(int16, 44 + i * 2);
      }

      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      console.warn('[TTS] Failed to write mock wav file:', err);
    }
  }
}
