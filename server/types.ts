import { z } from 'zod';

export type BroadcastState =
  | 'IDLE'
  | 'PREPARING'
  | 'ANALYZING'
  | 'BROADCASTING'
  | 'DEGRADED'
  | 'STOPPING'
  | 'ERROR';

export type CommentaryStyle = 'balanced' | 'energetic' | 'analytical';
export type AudioMode = 'ai_only' | 'ducking' | 'stadium_separated';

export interface Administrator {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Competition {
  id: string;
  nameFa: string;
  nameEn: string;
  country: string;
  season: string;
}

export interface Team {
  id: string;
  nameFa: string;
  nameEn: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  roster: { number: number; nameFa: string; position: string }[];
}

export interface Match {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  matchClock: number; // in seconds
  period: 'first_half' | 'halftime' | 'second_half' | 'extra_time' | 'finished';
  stadium: string;
  referee: string;
  scheduledAt: string;
  isLive: boolean;
}

export interface MediaSource {
  id: string;
  matchId: string;
  title: string;
  type: 'mp4_upload' | 'hls_stream' | 'local_demo' | 'rtmp_stream';
  url: string;
  durationSeconds?: number;
  resolution?: string;
  codec?: string;
  isVerifiedRights: boolean;
  notes?: string;
  createdAt: string;
}

export interface Broadcast {
  id: string;
  matchId: string;
  sourceId: string;
  state: BroadcastState;
  commentaryStyle: CommentaryStyle;
  commentatorVoice: string;
  audioMode: AudioMode;
  targetLiveDelaySeconds: number;
  currentPts: number;
  hlsUrl: string;
  activeViewerCount: number;
  startedAt?: string;
  stoppedAt?: string;
  errorMessage?: string;
}

export type EventType =
  | 'goal'
  | 'shot'
  | 'save'
  | 'corner'
  | 'foul'
  | 'yellow_card'
  | 'red_card'
  | 'penalty'
  | 'substitution'
  | 'offside'
  | 'tactical_move'
  | 'crowd_reaction'
  | 'kickoff';

export interface DetectedEvent {
  id: string;
  matchId: string;
  sourceTimestampPts: number; // seconds
  type: EventType;
  teamId?: string;
  playerName?: string;
  confidence: number; // 0.0 to 1.0
  evidenceSources: ('video_frames' | 'audio_clues' | 'verified_metadata')[];
  verificationStatus: 'verified' | 'suspected' | 'rejected';
  factualDescriptionFa: string;
  tacticalNotesFa?: string;
  createdAt: string;
}

export const CommentarySegmentSchema = z.object({
  id: z.string(),
  linkedEventId: z.string().optional(),
  persianText: z.string().min(3),
  sourceMediaTargetPts: z.number().nonnegative(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  intensity: z.enum(['calm', 'moderate', 'high', 'explosive']),
  emotion: z.enum(['analytical', 'excited', 'dramatic', 'tense', 'cheering']),
  estimatedDurationSeconds: z.number().positive(),
  confidence: z.number().min(0).max(1),
  evidenceReferences: z.array(z.string()),
  audioUrl: z.string().optional(),
  delivered: z.boolean().default(false),
});

export type CommentarySegment = z.infer<typeof CommentarySegmentSchema>;

export interface AudioAsset {
  id: string;
  commentaryId: string;
  sourceTargetPts: number;
  durationSeconds: number;
  audioUrl: string;
  status: 'pending' | 'generated' | 'failed';
  provider: 'gemini_tts' | 'mock_synth';
  fileSizeBytes?: number;
  createdAt: string;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsageMb: number;
  totalMemoryMb: number;
  streamBitrateKbps: number;
  targetDelaySeconds: number;
  currentBufferSeconds: number;
  aiQueueLatencyMs: number;
  tokensConsumedTotal: number;
  geminiApiLatencyMs: number;
  ffmpegWorkerStatus: 'running' | 'idle' | 'stopped' | 'error';
  isRealMetric: {
    cpu: boolean;
    memory: boolean;
    tokens: boolean;
    ffmpeg: boolean;
  };
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}
