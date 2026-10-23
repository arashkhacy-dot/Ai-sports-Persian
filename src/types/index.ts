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

export interface Competition {
  id: string;
  nameFa: string;
  nameEn: string;
  country: string;
  season: string;
}

export interface Player {
  number: number;
  nameFa: string;
  position: string;
}

export interface Team {
  id: string;
  nameFa: string;
  nameEn: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  roster: Player[];
}

export interface Match {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  matchClock: number;
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
  sourceTimestampPts: number;
  type: EventType;
  teamId?: string;
  playerName?: string;
  confidence: number;
  evidenceSources: ('video_frames' | 'audio_clues' | 'verified_metadata')[];
  verificationStatus: 'verified' | 'suspected' | 'rejected';
  factualDescriptionFa: string;
  tacticalNotesFa?: string;
  createdAt: string;
}

export interface CommentarySegment {
  id: string;
  linkedEventId?: string;
  persianText: string;
  sourceMediaTargetPts: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  intensity: 'calm' | 'moderate' | 'high' | 'explosive';
  emotion: 'analytical' | 'excited' | 'dramatic' | 'tense' | 'cheering';
  estimatedDurationSeconds: number;
  confidence: number;
  evidenceReferences: string[];
  audioUrl?: string;
  delivered: boolean;
}

export interface ChannelInfo {
  channelName: string;
  isActive: boolean;
  state: BroadcastState;
  currentPts: number;
  hlsUrl: string;
  targetLiveDelaySeconds: number;
  commentaryStyle: CommentaryStyle;
  commentatorVoice: string;
  match: {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    competition: Competition;
    homeScore: number;
    awayScore: number;
    matchClock: number;
    period: string;
    stadium: string;
    referee: string;
    isLive: boolean;
  } | null;
  source: {
    id: string;
    title: string;
    type: string;
    url: string;
    isVerifiedRights: boolean;
  } | null;
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
