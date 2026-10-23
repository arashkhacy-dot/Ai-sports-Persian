import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceValidator } from '../server/services/sourceValidator.ts';
import { HybridFootballAnalysisEngine } from '../server/services/hybridAnalysisEngine.ts';
import { AudioMixerService } from '../server/services/audioMixer.ts';
import { CommentarySegment } from '../server/types.ts';

test('SourceValidator: blocks SSRF targets and dangerous hostnames', () => {
  const localRes = SourceValidator.validateSourceUrl('http://127.0.0.1/stream.m3u8');
  assert.equal(localRes.isValid, false);
  assert.match(localRes.error || '', /SSRF|محدوده/);

  const privateRes = SourceValidator.validateSourceUrl('http://192.168.1.50/live.mp4');
  assert.equal(privateRes.isValid, false);

  const awsMetadataRes = SourceValidator.validateSourceUrl('http://169.254.169.254/latest/meta-data/');
  assert.equal(awsMetadataRes.isValid, false);

  const gopherRes = SourceValidator.validateSourceUrl('gopher://127.0.0.1:70/');
  assert.equal(gopherRes.isValid, false);
});

test('SourceValidator: allows valid public streams', () => {
  const validRes = SourceValidator.validateSourceUrl('https://example.com/football/live.m3u8');
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.isStream, true);

  const mp4Res = SourceValidator.validateSourceUrl('https://storage.googleapis.com/test-bucket/clip.mp4');
  assert.equal(mp4Res.isValid, true);
  assert.equal(mp4Res.isStream, false);
});

test('HybridFootballAnalysisEngine: fuses evidence and deduplicates repeated events', () => {
  const mockMeta = {
    match: {
      id: 'm1',
      competitionId: 'c1',
      homeTeamId: 't1',
      awayTeamId: 't2',
      homeScore: 0,
      awayScore: 0,
      matchClock: 1200,
      period: 'first_half' as const,
      stadium: 'Azadi',
      referee: 'Referee',
      scheduledAt: new Date().toISOString(),
      isLive: true,
    },
    homeTeam: {
      id: 't1',
      nameFa: 'پرسپولیس',
      nameEn: 'Persepolis',
      shortCode: 'PRS',
      primaryColor: '#e11d48',
      secondaryColor: '#fff',
      roster: [{ number: 10, nameFa: 'عیسی آل‌کثیر', position: 'مهاجم' }],
    },
    awayTeam: {
      id: 't2',
      nameFa: 'استقلال',
      nameEn: 'Esteghlal',
      shortCode: 'EST',
      primaryColor: '#2563eb',
      secondaryColor: '#fff',
      roster: [{ number: 19, nameFa: 'بلانکو', position: 'مهاجم' }],
    },
    recentConfirmedEvents: [],
  };

  const event1 = HybridFootballAnalysisEngine.fuseEvidence({
    matchId: 'm1',
    sourceTimestampPts: 50.0,
    videoClues: { visibleAction: 'shot', motionIntensity: 0.8 },
    audioClues: { crowdVolumeSpike: true, extractedKeywords: ['بلانکو'] },
    verifiedMetadata: mockMeta,
  });

  assert.ok(event1);
  assert.equal(event1.type, 'shot');
  assert.equal(event1.playerName, 'بلانکو');
  assert.ok(event1.confidence >= 0.7);

  // Duplicate within deduplication window (e.g. 52.0s vs 50.0s)
  mockMeta.recentConfirmedEvents = [event1];
  const eventDuplicate = HybridFootballAnalysisEngine.fuseEvidence({
    matchId: 'm1',
    sourceTimestampPts: 53.0,
    videoClues: { visibleAction: 'shot' },
    verifiedMetadata: mockMeta,
  });

  assert.equal(eventDuplicate, null, 'Duplicate event within 8s window must be filtered');
});

test('AudioMixerService: schedules timeline and prevents audio collision', () => {
  const seg1: CommentarySegment = {
    id: 's1',
    persianText: 'شوت سرکش به سمت دروازه!',
    sourceMediaTargetPts: 10.0,
    priority: 'medium',
    intensity: 'high',
    emotion: 'excited',
    estimatedDurationSeconds: 4.0,
    confidence: 0.9,
    evidenceReferences: ['shot'],
    delivered: false,
  };

  // seg2 overlaps at 12.0s (seg1 runs until 14.0s)
  const seg2: CommentarySegment = {
    id: 's2',
    persianText: 'مهار استثنایی دروازه‌بان!',
    sourceMediaTargetPts: 12.0,
    priority: 'high',
    intensity: 'high',
    emotion: 'excited',
    estimatedDurationSeconds: 3.0,
    confidence: 0.95,
    evidenceReferences: ['save'],
    delivered: false,
  };

  const scheduled = AudioMixerService.scheduleTimeline([seg1, seg2]);
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].startPts, 10.0);
  // Second segment must be shifted forward past seg1's end
  assert.ok(scheduled[1].startPts >= scheduled[0].endPts);

  // Ducking check
  const duckingActive = AudioMixerService.getDuckingAtPts(11.0, scheduled);
  assert.ok(duckingActive < 1.0, 'Background audio must be ducked during speech');

  const duckingIdle = AudioMixerService.getDuckingAtPts(50.0, scheduled);
  assert.equal(duckingIdle, 1.0, 'Background audio should be at 100% when no speech is scheduled');
});

test('Security: scrypt salted password hashing and timing-safe verification', async () => {
  const { hashPassword, verifyPassword } = await import('../server/db/database.ts');
  const plain = 'SuperSecret123!';
  const hashed = hashPassword(plain);

  assert.ok(hashed.includes(':'), 'Hash must contain salt prefix');
  assert.equal(verifyPassword(plain, hashed), true);
  assert.equal(verifyPassword('WrongPass', hashed), false);
  assert.equal(verifyPassword('', hashed), false);
});

test('FFmpegWorkerService & MediaExtractor: probe media and extract real frame', async () => {
  const { FFmpegWorkerService } = await import('../server/services/ffmpegWorker.ts');
  const { MediaExtractorService } = await import('../server/services/mediaExtractor.ts');
  const worker = FFmpegWorkerService.getInstance();
  const extractor = new MediaExtractorService();

  // /tmp/test_clip.mp4 was generated previously
  const probe = await worker.probeMedia('/tmp/test_clip.mp4');
  if (probe) {
    assert.ok(probe.durationSeconds > 0, 'Duration must be positive');
    assert.equal(probe.resolution, '640x360');
    assert.equal(probe.videoCodec, 'h264');
    assert.equal(probe.hasAudio, true);

    const frame = await extractor.extractFrameAtPts('/tmp/test_clip.mp4', 1.5);
    assert.ok(frame && frame.length > 0, 'Extracted frame buffer must be non-empty');
  }
});
