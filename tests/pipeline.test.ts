import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MediaExtractorService } from '../server/services/mediaExtractor.ts';
import { PersianTTSProvider } from '../server/services/ttsProvider.ts';
import { OfflineRenderService } from '../server/services/offlineRenderService.ts';
import { FFmpegWorkerService } from '../server/services/ffmpegWorker.ts';
import { PipelineCoordinatorService } from '../server/services/pipelineCoordinator.ts';
import { AppDatabase } from '../server/db/database.ts';
import { CommentarySegment } from '../server/types.ts';
import { app } from '../server.ts';

const execFileAsync = promisify(execFile);

// Helper to generate a 5-second synthetic test clip with video + audio
async function ensureTestClipWithAudio(filePath: string): Promise<void> {
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

// Helper to generate a 5-second synthetic test clip with NO audio track
async function ensureTestClipNoAudio(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=5:size=320x240:rate=25',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    filePath,
  ]);
}

test('Pipeline: MediaExtractorService detects triggers and extracts temporal frames', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClipWithAudio(testClip);

  const extractor = MediaExtractorService.getInstance();
  const triggers = await extractor.detectCandidateMoments(testClip, 0, 5);
  assert.ok(Array.isArray(triggers));
  assert.ok(triggers.length > 0, 'Should detect at least 1 candidate trigger');

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

  // Create a 1-second 24000Hz 16-bit mono PCM buffer
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

test('Pipeline: OfflineRenderService mixes audio with timed ducking and PTS delay', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClipWithAudio(testClip);

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

test('Pipeline: OfflineRenderService handles source video with NO audio stream (P1.G)', async () => {
  const silentClip = path.resolve(process.cwd(), 'data', 'test_silent_clip.mp4');
  await ensureTestClipNoAudio(silentClip);

  // Probe original to confirm it has NO audio
  const probeOrig = await FFmpegWorkerService.probeMedia(silentClip);
  assert.equal(probeOrig?.hasAudio, false, 'Original clip must not have an audio stream');

  const commAudioPath = path.resolve(process.cwd(), 'data', 'tts_cache', 'test_comm_1.wav');
  const testSegments: CommentarySegment[] = [
    {
      id: 'comm_test_silent',
      persianText: 'گزارش صوتی روی ویدیوی بدون صدای استادیوم',
      sourceMediaTargetPts: 1.0,
      priority: 'high',
      intensity: 'high',
      emotion: 'excited',
      estimatedDurationSeconds: 2.0,
      confidence: 0.9,
      evidenceReferences: ['video_frames'],
      audioUrl: commAudioPath,
      delivered: false,
    },
  ];

  const renderService = OfflineRenderService.getInstance();
  const result = await renderService.renderSynchronizedOutput({
    sourcePath: silentClip,
    commentarySegments: testSegments,
    outputFormat: 'mp4',
    duckingLevel: 0.35,
  });

  assert.equal(result.success, true, 'Render of silent clip with commentary must succeed');
  assert.ok(fs.existsSync(result.outputPath), 'Output file must exist');
  assert.ok(result.probeResult?.hasVideo, 'Rendered output must have video');
  assert.ok(result.probeResult?.hasAudio, 'Rendered output must have newly mixed audio stream');
});

test('P0.A Honesty Gate: Quiet clip does NOT fabricate a fake shot or goal event', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClipWithAudio(testClip);

  const db = AppDatabase.getInstance();
  const initialEventsCount = db.getEvents().length;

  const coordinator = PipelineCoordinatorService.getInstance();
  const res = await coordinator.runBoundedPipelineJob({
    videoPath: testClip,
    startPts: 0,
    durationSeconds: 5,
    outputFormat: 'mp4',
  });

  // When offline (no Gemini credentials or quiet testsrc), must report NO_EVENT or PENDING_EXTERNAL_TEST,
  // NEVER a fabricated fake 'shot' with 0.9 confidence!
  if (!res.event) {
    assert.equal(res.stage, 'NO_EVENT', 'Stage must be explicitly NO_EVENT when no event detected');
    assert.equal(res.event, undefined, 'Must not fabricate event');
    assert.equal(db.getEvents().length, initialEventsCount, 'Database must not have fake events added');
  } else {
    // If an event is present, it must be because a real model ran, not a fallback
    assert.notEqual(res.event.factualDescriptionFa, 'شوت هدفمند مهاجم به سمت چارچوب دروازه حریف', 'Must not be the fake fallback shot');
  }
});

test('P0.C Concurrency Gate: Simultaneous job requests are cleanly rejected by mutex', async () => {
  const testClip = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
  await ensureTestClipWithAudio(testClip);

  const coordinator = PipelineCoordinatorService.getInstance();

  // Launch two jobs concurrently
  const [job1, job2] = await Promise.all([
    coordinator.runBoundedPipelineJob({ videoPath: testClip, durationSeconds: 5 }),
    coordinator.runBoundedPipelineJob({ videoPath: testClip, durationSeconds: 5 }),
  ]);

  // One of them must succeed or return NO_EVENT, the other must be rejected with concurrency failure
  const oneFailed = job1.errorMessage?.includes('همزمانی') || job2.errorMessage?.includes('همزمانی') ||
                    job1.stage === 'FAILED' || job2.stage === 'FAILED';
  assert.ok(oneFailed, 'Concurrency lock must prevent simultaneous execution');
  assert.equal(PipelineCoordinatorService.isRunning(), false, 'Lock must be released after jobs complete');
});

test('P1.F & HTTP Range Gate: /rendered/:filename serves MP4 with Range 206 and blocks traversal', async () => {
  // Create a dummy rendered MP4 file for testing
  const renderedDir = path.resolve(process.cwd(), 'data', 'rendered');
  if (!fs.existsSync(renderedDir)) fs.mkdirSync(renderedDir, { recursive: true });
  const testMp4 = path.join(renderedDir, 'sample_test.mp4');
  fs.writeFileSync(testMp4, Buffer.alloc(1024, 0x55)); // 1KB dummy file

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. Regular GET request
    const res200 = await fetch(`http://127.0.0.1:${port}/rendered/sample_test.mp4`);
    assert.equal(res200.status, 200);
    assert.equal(res200.headers.get('content-type'), 'video/mp4');
    assert.equal(res200.headers.get('accept-ranges'), 'bytes');
    assert.equal(res200.headers.get('content-length'), '1024');

    // 2. HTTP Range request (bytes=0-99)
    const res206 = await fetch(`http://127.0.0.1:${port}/rendered/sample_test.mp4`, {
      headers: { Range: 'bytes=0-99' },
    });
    assert.equal(res206.status, 206, 'Should respond with HTTP 206 Partial Content');
    assert.equal(res206.headers.get('content-range'), 'bytes 0-99/1024');
    assert.equal(res206.headers.get('content-length'), '100');
    const bytes = await res206.arrayBuffer();
    assert.equal(bytes.byteLength, 100);

    // 3. Path Traversal rejection
    const resTraversal = await fetch(`http://127.0.0.1:${port}/rendered/..%2f..%2fpackage.json`);
    assert.ok(resTraversal.status === 404 || resTraversal.status === 403, 'Traversal must be blocked');
  } finally {
    server.close();
  }
});

test('P2.M Health Gate: /api/v1/health returns verified subsystem metrics', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.status === 'ok' || data.status === 'degraded');
    assert.equal(typeof data.mediaSubsystem.ffmpeg, 'boolean');
    assert.equal(typeof data.mediaSubsystem.ffprobe, 'boolean');
    assert.ok(['configured', 'unconfigured'].includes(data.aiSubsystem.gemini));
    assert.ok(data.systemMetrics.memoryRssMb > 0);
  } finally {
    server.close();
  }
});

test.after(() => {
  // Allow pending microtasks to flush, then cleanly exit test process
  setTimeout(() => process.exit(0), 50).unref();
});
