import EventEmitter from 'events';
import { AppDatabase } from '../db/database.ts';
import { Broadcast, BroadcastState, CommentaryStyle, AudioMode, Match, MediaSource } from '../types.ts';
import { PersianCommentaryEngine } from './persianCommentaryEngine.ts';
import { HybridFootballAnalysisEngine } from './hybridAnalysisEngine.ts';
import { PersianTTSProvider } from './ttsProvider.ts';
import { AudioMixerService, ScheduledSpeech } from './audioMixer.ts';

export class BroadcastManager extends EventEmitter {
  private static instance: BroadcastManager;
  private db: AppDatabase;
  private isLocked = false;
  private currentBroadcast: Broadcast | null = null;
  private commentaryEngine: PersianCommentaryEngine;
  private ttsProvider: PersianTTSProvider;
  private scheduledTimeline: ScheduledSpeech[] = [];
  private tickerInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.db = AppDatabase.getInstance();
    this.commentaryEngine = new PersianCommentaryEngine();
    this.ttsProvider = new PersianTTSProvider();
    this.initializeFromDb();
  }

  public static getInstance(): BroadcastManager {
    if (!BroadcastManager.instance) {
      BroadcastManager.instance = new BroadcastManager();
    }
    return BroadcastManager.instance;
  }

  private initializeFromDb(): void {
    const active = this.db.getActiveBroadcast();
    if (active) {
      this.currentBroadcast = active;
      if (active.state === 'BROADCASTING') {
        this.startTimelineTicker();
      }
    }
  }

  public getStatus(): {
    broadcast: Broadcast | null;
    isLocked: boolean;
    scheduledCount: number;
    tokensConsumed: number;
    apiLatencyMs: number;
  } {
    return {
      broadcast: this.currentBroadcast,
      isLocked: this.isLocked,
      scheduledCount: this.scheduledTimeline.length,
      tokensConsumed: this.commentaryEngine.totalTokensConsumed,
      apiLatencyMs: this.commentaryEngine.lastLatencyMs,
    };
  }

  /**
   * Exclusive lock enforcement: starts a broadcast pipeline
   */
  public async startBroadcast(params: {
    matchId: string;
    sourceId: string;
    commentaryStyle: CommentaryStyle;
    commentatorVoice: string;
    audioMode: AudioMode;
    targetLiveDelaySeconds: number;
  }): Promise<Broadcast> {
    if (this.isLocked) {
      throw new Error('قفل پخش اختصاصی فعال است؛ یک فرایند استریم دیگر در حال اجراست.');
    }

    this.isLocked = true;

    try {
      // 1. Stop any prior pipeline gracefully
      if (this.currentBroadcast && this.currentBroadcast.state === 'BROADCASTING') {
        await this.stopBroadcast();
      }

      const match = this.db.getMatchById(params.matchId);
      if (!match) throw new Error('مسابقه انتخابی یافت نشد.');

      const source = this.db.getMediaSourceById(params.sourceId);
      if (!source) throw new Error('منبع ویدیویی انتخابی یافت نشد.');

      const broadcastId = `bcast_${Date.now()}`;
      const newBroadcast: Broadcast = {
        id: broadcastId,
        matchId: params.matchId,
        sourceId: params.sourceId,
        state: 'PREPARING',
        commentaryStyle: params.commentaryStyle,
        commentatorVoice: params.commentatorVoice,
        audioMode: params.audioMode,
        targetLiveDelaySeconds: params.targetLiveDelaySeconds,
        currentPts: 0.0,
        hlsUrl: '/live/index.m3u8',
        activeViewerCount: 1,
        startedAt: new Date().toISOString(),
      };

      this.currentBroadcast = newBroadcast;
      this.db.updateBroadcast(newBroadcast.id, newBroadcast);
      this.emitStateChange('PREPARING');

      // 2. ANALYZING stage
      await this.transitionState('ANALYZING');

      // Schedule initial commentary from DB
      const existingCommentary = this.db.getCommentarySegments(params.matchId);
      this.scheduledTimeline = AudioMixerService.scheduleTimeline(existingCommentary);

      // Pre-synthesize initial TTS assets
      for (const seg of existingCommentary) {
        await this.ttsProvider.synthesize(seg, params.commentatorVoice);
      }

      // 3. BROADCASTING stage
      await this.transitionState('BROADCASTING');
      this.startTimelineTicker();

      this.db.addAuditLog({
        adminId: 'admin_master_1',
        action: 'START_BROADCAST',
        details: `پخش تک‌کاناله برای مسابقه ${match.id} با موفقیت کلید خورد.`,
        ipAddress: '127.0.0.1',
      });

      return this.currentBroadcast;
    } finally {
      this.isLocked = false;
    }
  }

  public async stopBroadcast(): Promise<void> {
    if (!this.currentBroadcast) return;

    await this.transitionState('STOPPING');
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }

    this.currentBroadcast.stoppedAt = new Date().toISOString();
    await this.transitionState('IDLE');

    this.db.addAuditLog({
      adminId: 'admin_master_1',
      action: 'STOP_BROADCAST',
      details: 'پخش مسابقه توسط مدیر متوقف و منابع آزاد گردید.',
      ipAddress: '127.0.0.1',
    });
  }

  private async transitionState(newState: BroadcastState): Promise<void> {
    if (!this.currentBroadcast) return;
    this.currentBroadcast.state = newState;
    this.db.updateBroadcast(this.currentBroadcast.id, { state: newState });
    this.emitStateChange(newState);
  }

  private emitStateChange(state: BroadcastState): void {
    this.emit('stateChanged', {
      state,
      broadcast: this.currentBroadcast,
    });
  }

  private startTimelineTicker(): void {
    if (this.tickerInterval) clearInterval(this.tickerInterval);

    this.tickerInterval = setInterval(async () => {
      if (!this.currentBroadcast || this.currentBroadcast.state !== 'BROADCASTING') {
        return;
      }

      // Increment PTS by 1 second
      this.currentBroadcast.currentPts = Number((this.currentBroadcast.currentPts + 1.0).toFixed(1));

      // Trigger automatic event check or periodic live commentary
      const match = this.db.getMatchById(this.currentBroadcast.matchId);
      if (match) {
        match.matchClock += 1;
      }

      // Check for deliverable commentary
      const pts = this.currentBroadcast.currentPts;
      const readyItem = this.scheduledTimeline.find(
        (item) => !item.segment.delivered && Math.abs(item.startPts - pts) < 1.5
      );

      if (readyItem) {
        readyItem.segment.delivered = true;
        this.emit('commentaryDelivered', {
          segment: readyItem.segment,
          pts,
        });
      }

      this.emit('ptsTick', { pts });
    }, 1000);
  }

  /**
   * Administrator or Simulation triggers a new live football event to be analyzed & commented
   */
  public async triggerManualEvent(params: {
    type: any;
    playerName?: string;
    description: string;
  }): Promise<{ event: any; commentary: any }> {
    if (!this.currentBroadcast || this.currentBroadcast.state !== 'BROADCASTING') {
      throw new Error('پخش فعال نیست.');
    }

    const match = this.db.getMatchById(this.currentBroadcast.matchId);
    if (!match) throw new Error('مسابقه یافت نشد.');

    const homeTeam = this.db.getTeamById(match.homeTeamId)!;
    const awayTeam = this.db.getTeamById(match.awayTeamId)!;

    // 1. Multimodal fusion
    const event = HybridFootballAnalysisEngine.fuseEvidence({
      matchId: match.id,
      sourceTimestampPts: this.currentBroadcast.currentPts,
      videoClues: {
        visibleAction: params.type,
        motionIntensity: 0.85,
      },
      audioClues: {
        crowdVolumeSpike: true,
        extractedKeywords: params.playerName ? [params.playerName] : [],
      },
      verifiedMetadata: {
        match,
        homeTeam,
        awayTeam,
        recentConfirmedEvents: this.db.getEvents(match.id),
      },
    });

    if (!event) {
      throw new Error('رویداد به دلیل تکراری بودن در پنجره زمانی حذف گردید (Deduplication).');
    }

    if (params.type === 'goal') {
      match.homeScore += 1;
      this.db.updateMatch(match.id, { homeScore: match.homeScore });
    }

    this.db.addEvent(event);

    // 2. Generate original Persian commentary
    const commentary = await this.commentaryEngine.generateCommentary({
      event,
      match,
      homeTeam,
      awayTeam,
      style: this.currentBroadcast.commentaryStyle,
      voicePersona: this.currentBroadcast.commentatorVoice,
      currentPts: this.currentBroadcast.currentPts,
    });

    this.db.addCommentarySegment(commentary);

    // 3. Synthesize TTS
    const asset = await this.ttsProvider.synthesize(commentary, this.currentBroadcast.commentatorVoice);
    commentary.audioUrl = asset.audioUrl;

    // 4. Schedule timeline
    const allSegs = this.db.getCommentarySegments(match.id);
    this.scheduledTimeline = AudioMixerService.scheduleTimeline(allSegs);

    this.emit('eventCreated', { event, commentary });
    return { event, commentary };
  }
}
