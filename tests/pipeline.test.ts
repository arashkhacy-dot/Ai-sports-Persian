import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MediaExtractorService } from '../server/services/mediaExtractor.ts';
import { PersianTTSProvider } from '../server/services/ttsProvider.ts';
import { OfflineRenderService } from '../server/services/offlineRenderService.ts';
import { FFmpegWorkerService } from '../server/services/ffmpegWorker.ts';
import { CommentarySegment } from '../server/types.ts';

const execFileAsync = promisify(execFile);

// Helper to generate a 5-second synthetic test clip with video + audio
async function ensureTestClip(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=5:size=320x240:rate=25',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=5',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    filePath,
  ]);
}

test('Pipeline: MediaExtractorService detects triggers and extracts temporal frames', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClip(testClip);

  const extractor = MediaExtractorService.getInstance();
  const triggers = await extractor.detectCandidateMoments(testClip, 0, 5);
  assert.ok(Array.isArray(triggers));
  assert.ok(triggers.length > 0, 'Should detect at least 1 candidate trigger (periodic or acoustic)');

  const primaryPts = triggers[0].pts;
  const frames = await extractor.extractTemporalFrames(testClip, primaryPts, [-1.0, 0, 1.0]);
  assert.ok(Array.isArray(frames));
  assert.equal(frames.length, 3, 'Should extract exactly 3 ordered temporal frames');

  for (const frame of frames) {
    assert.ok(Buffer.isBuffer(frame.buffer), 'Frame must have a valid Buffer');
    assert.ok(frame.buffer.length > 500, 'Frame buffer must contain JPEG data');
    assert.equal(frame.buffer.toString('hex', 0, 2), 'ffd8', 'Buffer must start with JPEG magic bytes (ffd8)');
    assert.ok(typeof frame.pts === 'number');
  }
});

test('Pipeline: PersianTTSProvider RIFF header synthesis and ffprobe duration', async () => {
  const ttsProvider = new PersianTTSProvider();

  // Create a 1-second 24000Hz 16-bit mono silence/sine buffer (24000 samples * 2 bytes = 48000 bytes)
  const sampleRate = 24000;
  const pcmBytes = Buffer.alloc(sampleRate * 2);
  for (let i = 0; i < sampleRate; i++) {
    const val = Math.floor(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000);
    pcmBytes.writeInt16LE(val, i * 2);
  }

  const wavBuffer = ttsProvider.addWavHeader(pcmBytes, sampleRate, 1, 16);
  assert.equal(wavBuffer.length, 44 + pcmBytes.length);
  assert.equal(wavBuffer.toString('utf8', 0, 4), 'RIFF');
  assert.equal(wavBuffer.toString('utf8', 8, 12), 'WAVE');

  const testWavPath = path.resolve(process.cwd(), 'data', 'tts_cache', 'test_probe.wav');
  fs.writeFileSync(testWavPath, wavBuffer);

  const probe = await FFmpegWorkerService.probeMedia(testWavPath);
  assert.ok(probe);
  assert.equal(probe.hasAudio, true);
  assert.ok(probe.durationSeconds >= 0.9 && probe.durationSeconds <= 1.2, `Duration should be ~1.0s, got ${probe.durationSeconds}`);
});

test('Pipeline: OfflineRenderService performs synchronized audio mixing with PTS delay and ducking', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClip(testClip);

  // Synthesize a test commentary WAV audio at 1.5s
  const ttsProvider = new PersianTTSProvider();
  const sampleRate = 24000;
  const pcmBytes = Buffer.alloc(sampleRate * 2 * 2); // 2 seconds audio
  const wavBuffer = ttsProvider.addWavHeader(pcmBytes, sampleRate, 1, 16);
  const commAudioPath = path.resolve(process.cwd(), 'data', 'tts_cache', 'test_comm_1.wav');
  fs.writeFileSync(commAudioPath, wavBuffer);

  const testSegments: CommentarySegment[] = [
    {
      id: 'comm_test_1',
      persianText: 'حرکت عالی و ضربه محکم به سمت دروازه!',
      sourceMediaTargetPts: 1.5,
      priority: 'high',
      intensity: 'high',
      emotion: 'excited',
      estimatedDurationSeconds: 2.0,
      confidence: 0.95,
      evidenceReferences: ['video_frames'],
      audioUrl: commAudioPath,
      delivered: false,
    },
  ];

  const renderService = OfflineRenderService.getInstance();
  const result = await renderService.renderSynchronizedOutput({
    sourcePath: testClip,
    commentarySegments: testSegments,
    outputFormat: 'mp4',
    duckingLevel: 0.35,
  });

  assert.equal(result.success, true, 'Render job should succeed');
  assert.ok(fs.existsSync(result.outputPath), 'Output file must exist on disk');
  assert.equal(result.mixedCommentaryCount, 1);
  assert.ok(result.probeResult);
  assert.equal(result.probeResult.hasVideo, true, 'Output must have video');
  assert.equal(result.probeResult.hasAudio, true, 'Output must have audio');
  assert.ok(result.probeResult.durationSeconds >= 4.5, `Output duration should match source (~5s), got ${result.probeResult.durationSeconds}`);
});
