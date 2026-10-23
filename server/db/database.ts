import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Administrator,
  Competition,
  Team,
  Match,
  MediaSource,
  Broadcast,
  DetectedEvent,
  CommentarySegment,
  AudioAsset,
  AuditLog,
} from '../types.ts';

interface DatabaseSchema {
  administrators: Administrator[];
  competitions: Competition[];
  teams: Team[];
  matches: Match[];
  mediaSources: MediaSource[];
  broadcasts: Broadcast[];
  detectedEvents: DetectedEvent[];
  commentarySegments: CommentarySegment[];
  audioAssets: AudioAsset[];
  auditLogs: AuditLog[];
  systemSettings: Record<string, string>;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'app_db.json');

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) {
    // Legacy sha256 compatibility fallback
    const legacy = crypto.createHash('sha256').update(password).digest('hex');
    return legacy === storedHash;
  }
  const [salt, hash] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export class AppDatabase {
  private static instance: AppDatabase;
  private data: DatabaseSchema;

  private constructor() {
    this.data = this.loadDatabase();
  }

  public static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase();
    }
    return AppDatabase.instance;
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[DB] Failed to read db file, initializing with seeds:', err);
    }
    return this.createSeedData();
  }

  public save(): void {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to save database:', err);
    }
  }

  private createSeedData(): DatabaseSchema {
    const admin: Administrator = {
      id: 'admin_master_1',
      username: 'admin',
      passwordHash: hashPassword('admin123!'), // Default initial admin, changeable in dashboard
      createdAt: new Date().toISOString(),
    };

    const competition1: Competition = {
      id: 'comp_pgpl_2025',
      nameFa: 'لیگ برتر خلیج فارس',
      nameEn: 'Persian Gulf Pro League',
      country: 'ایران',
      season: '1403-1404',
    };

    const competition2: Competition = {
      id: 'comp_ucl_2025',
      nameFa: 'لیگ قهرمانان اروپا',
      nameEn: 'UEFA Champions League',
      country: 'اروپا',
      season: '2024-2025',
    };

    const teamPersepolis: Team = {
      id: 'team_pers',
      nameFa: 'پرسپولیس تهران',
      nameEn: 'Persepolis FC',
      shortCode: 'PRS',
      primaryColor: '#e11d48',
      secondaryColor: '#ffffff',
      roster: [
        { number: 1, nameFa: 'الکسیس گندوز', position: 'دروازه‌بان' },
        { number: 6, nameFa: 'محمدحسین کنعانی‌زادگان', position: 'مدافع میانی' },
        { number: 8, nameFa: 'مرتضی پورعلی‌گنجی', position: 'مدافع' },
        { number: 7, nameFa: 'سروش رفیعی', position: 'هافبک بازیساز' },
        { number: 10, nameFa: 'عیسی آل‌کثیر', position: 'مهاجم نوک' },
        { number: 21, nameFa: 'سعید صادقی', position: 'وینگر راست' },
        { number: 9, nameFa: 'مهدی ترابی', position: 'وینگر چپ' },
        { number: 88, nameFa: 'سینا اسدبیگی', position: 'هافبک دفاعی' },
      ],
    };

    const teamEsteghlal: Team = {
      id: 'team_est',
      nameFa: 'استقلال تهران',
      nameEn: 'Esteghlal FC',
      shortCode: 'EST',
      primaryColor: '#2563eb',
      secondaryColor: '#ffffff',
      roster: [
        { number: 1, nameFa: 'سید حسین حسینی', position: 'دروازه‌بان' },
        { number: 3, nameFa: 'رافائل سیلوا', position: 'مدافع' },
        { number: 55, nameFa: 'سامان فلاح', position: 'مدافع' },
        { number: 14, nameFa: 'زبیر نیک‌نفس', position: 'هافبک دفاعی' },
        { number: 22, nameFa: 'دیدیه اندونگ', position: 'هافبک' },
        { number: 7, nameFa: 'مهرداد محمدی', position: 'وینگر' },
        { number: 19, nameFa: 'گوستاوو بلانکو', position: 'مهاجم نوک' },
        { number: 77, nameFa: 'جلال‌الدین ماشاریپوف', position: 'پلی‌میکر' },
      ],
    };

    const derbyMatch: Match = {
      id: 'match_tehran_derby_104',
      competitionId: 'comp_pgpl_2025',
      homeTeamId: 'team_pers',
      awayTeamId: 'team_est',
      homeScore: 1,
      awayScore: 0,
      matchClock: 4420, // 73:40
      period: 'second_half',
      stadium: 'ورزشگاه آزادی تهران',
      referee: 'بیژن حیدری',
      scheduledAt: new Date().toISOString(),
      isLive: true,
    };

    const demoSource: MediaSource = {
      id: 'source_demo_derby_clip',
      matchId: 'match_tehran_derby_104',
      title: 'خلاصه صحنه‌های دربی پایتخت (۱۰۴) - کیفیت HD مجاز',
      type: 'local_demo',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      durationSeconds: 596,
      resolution: '1280x720',
      codec: 'h264/aac',
      isVerifiedRights: true,
      notes: 'منبع ویدیویی مجاز با حق پخش تایید شده برای استریم آزمایشی و تست هماهنگ‌سازی PTS',
      createdAt: new Date().toISOString(),
    };

    const initialBroadcast: Broadcast = {
      id: 'bcast_live_channel_1',
      matchId: 'match_tehran_derby_104',
      sourceId: 'source_demo_derby_clip',
      state: 'BROADCASTING',
      commentaryStyle: 'energetic',
      commentatorVoice: 'پژمان (گزارشگر رسمی پرحرارت فارسی)',
      audioMode: 'ducking',
      targetLiveDelaySeconds: 30,
      currentPts: 142.5,
      hlsUrl: '/live/index.m3u8',
      activeViewerCount: 14,
      startedAt: new Date().toISOString(),
    };

    const initialEvents: DetectedEvent[] = [
      {
        id: 'evt_1',
        matchId: 'match_tehran_derby_104',
        sourceTimestampPts: 24.0,
        type: 'kickoff',
        confidence: 0.98,
        evidenceSources: ['video_frames', 'audio_clues', 'verified_metadata'],
        verificationStatus: 'verified',
        factualDescriptionFa: 'سوت آغاز مسابقه دربی ۱۰۴ توسط داور مسابقه به صدا درآمد.',
        tacticalNotesFa: 'پرسپولیس بازی را با آرایش ۴-۲-۳-۱ آغاز کرده و استقلال ۳-۵-۲ بازی می‌کند.',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'evt_2',
        matchId: 'match_tehran_derby_104',
        sourceTimestampPts: 58.5,
        type: 'shot',
        teamId: 'team_est',
        playerName: 'گوستاوو بلانکو',
        confidence: 0.92,
        evidenceSources: ['video_frames', 'audio_clues'],
        verificationStatus: 'verified',
        factualDescriptionFa: 'شوت سرکش بلانکو از پشت محوطه جریمه که با اختلاف اندک از بالای تیرک افقی به بیرون رفت.',
        tacticalNotesFa: 'توپ دوم ناشی از دفع ناقص خط دفاعی پرسپولیس.',
        createdAt: new Date(Date.now() - 2500000).toISOString(),
      },
      {
        id: 'evt_3',
        matchId: 'match_tehran_derby_104',
        sourceTimestampPts: 112.0,
        type: 'goal',
        teamId: 'team_pers',
        playerName: 'عیسی آل‌کثیر',
        confidence: 0.99,
        evidenceSources: ['video_frames', 'audio_clues', 'verified_metadata'],
        verificationStatus: 'verified',
        factualDescriptionFa: 'گل اول برای پرسپولیس! روی ارسال دقیق از جناح راست و ضربه سر دیدنی آل‌کثیر دروازه استقلال باز شد.',
        tacticalNotesFa: 'انتقال سریع از دفاع به حمله و ارسال در فضای بین مدافعان میانی.',
        createdAt: new Date(Date.now() - 1200000).toISOString(),
      },
    ];

    const initialCommentaries: CommentarySegment[] = [
      {
        id: 'comm_1',
        linkedEventId: 'evt_1',
        persianText: 'به نام خدا و سلام به همه فوتبال‌دوستان و هواداران پرشور ایرانی. دربی پایتخت، هیجان‌انگیزترین نبرد فوتبال آسیا آغاز شد!',
        sourceMediaTargetPts: 24.5,
        priority: 'high',
        intensity: 'moderate',
        emotion: 'excited',
        estimatedDurationSeconds: 6.5,
        confidence: 0.98,
        evidenceReferences: ['kickoff_whistle', 'crowd_roar'],
        delivered: true,
      },
      {
        id: 'comm_2',
        linkedEventId: 'evt_2',
        persianText: 'چه شوتی زد بلانکو! زنگ خطر جدی برای دروازه گندوز به صدا درمی‌آد؛ توپ دوم رو عالی جمع کرد و شوت سرضربش نفس‌ها رو حبس کرد.',
        sourceMediaTargetPts: 59.0,
        priority: 'high',
        intensity: 'high',
        emotion: 'dramatic',
        estimatedDurationSeconds: 7.2,
        confidence: 0.94,
        evidenceReferences: ['shot_box_edge', 'crowd_gasp'],
        delivered: true,
      },
      {
        id: 'comm_3',
        linkedEventId: 'evt_3',
        persianText: 'توی دروازه! گللللل برای سرخ‌پوشان! عیسی آل‌کثیر کار رو تموم می‌کنه! یک ارسال مواج و دیدنی و ضربه سری که مهارش برای حسینی غیرممکن بود!',
        sourceMediaTargetPts: 113.0,
        priority: 'critical',
        intensity: 'explosive',
        emotion: 'cheering',
        estimatedDurationSeconds: 8.5,
        confidence: 0.99,
        evidenceReferences: ['goal_confirmed', 'spectator_celebration'],
        delivered: true,
      },
    ];

    const initialAudit: AuditLog = {
      id: 'audit_init',
      adminId: 'admin_master_1',
      action: 'BOOTSTRAP',
      details: 'سیستم گزارشگر هوشمند فارسی با تنظیمات اولیه راه‌اندازی شد.',
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString(),
    };

    const seed: DatabaseSchema = {
      administrators: [admin],
      competitions: [competition1, competition2],
      teams: [teamPersepolis, teamEsteghlal],
      matches: [derbyMatch],
      mediaSources: [demoSource],
      broadcasts: [initialBroadcast],
      detectedEvents: initialEvents,
      commentarySegments: initialCommentaries,
      audioAssets: [],
      auditLogs: [initialAudit],
      systemSettings: {
        channelName: 'شبکه اختصاصی فوتبال AI',
        defaultDelay: '30',
        maxLiveWaitSeconds: '90',
        autoTranscribe: 'true',
      },
    };

    return seed;
  }

  // Administrators
  public getAdministratorByUsername(username: string): Administrator | undefined {
    return this.data.administrators.find((a) => a.username.toLowerCase() === username.toLowerCase());
  }

  public hasAdministrator(): boolean {
    return this.data.administrators.length > 0;
  }

  public verifyAdminPassword(username: string, passwordPlain: string): Administrator | null {
    const admin = this.getAdministratorByUsername(username);
    if (!admin) return null;
    if (verifyPassword(passwordPlain, admin.passwordHash)) {
      return admin;
    }
    return null;
  }

  public updateAdminPassword(username: string, newPasswordPlain: string): boolean {
    const admin = this.getAdministratorByUsername(username);
    if (!admin) return false;
    admin.passwordHash = hashPassword(newPasswordPlain);
    this.save();
    return true;
  }

  public createAdministrator(username: string, passwordPlain: string): Administrator {
    const newAdmin: Administrator = {
      id: `admin_${Date.now()}`,
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(passwordPlain),
      createdAt: new Date().toISOString(),
    };
    this.data.administrators.push(newAdmin);
    this.save();
    return newAdmin;
  }

  // Matches & Teams
  public getMatches(): Match[] {
    return this.data.matches;
  }

  public getMatchById(id: string): Match | undefined {
    return this.data.matches.find((m) => m.id === id);
  }

  public getTeams(): Team[] {
    return this.data.teams;
  }

  public getTeamById(id: string): Team | undefined {
    return this.data.teams.find((t) => t.id === id);
  }

  public getCompetitions(): Competition[] {
    return this.data.competitions;
  }

  public addMatch(match: Match): void {
    this.data.matches.push(match);
    this.save();
  }

  public updateMatch(matchId: string, patch: Partial<Match>): Match | undefined {
    const match = this.getMatchById(matchId);
    if (match) {
      Object.assign(match, patch);
      this.save();
    }
    return match;
  }

  // Sources
  public getMediaSources(matchId?: string): MediaSource[] {
    if (matchId) {
      return this.data.mediaSources.filter((s) => s.matchId === matchId);
    }
    return this.data.mediaSources;
  }

  public getMediaSourceById(id: string): MediaSource | undefined {
    return this.data.mediaSources.find((s) => s.id === id);
  }

  public addMediaSource(source: MediaSource): void {
    this.data.mediaSources.push(source);
    this.save();
  }

  // Broadcasts (Single Active Channel Enforcement)
  public getActiveBroadcast(): Broadcast | undefined {
    return this.data.broadcasts.find((b) => b.state !== 'IDLE' && b.state !== 'STOPPING') || this.data.broadcasts[0];
  }

  public getBroadcastById(id: string): Broadcast | undefined {
    return this.data.broadcasts.find((b) => b.id === id);
  }

  public updateBroadcast(id: string, patch: Partial<Broadcast>): Broadcast | undefined {
    const b = this.getBroadcastById(id);
    if (b) {
      Object.assign(b, patch);
      this.save();
    }
    return b;
  }

  // Events & Commentary
  public getEvents(matchId?: string): DetectedEvent[] {
    if (matchId) {
      return this.data.detectedEvents.filter((e) => e.matchId === matchId);
    }
    return this.data.detectedEvents;
  }

  public addEvent(event: DetectedEvent): void {
    this.data.detectedEvents.push(event);
    this.save();
  }

  public updateEvent(id: string, patch: Partial<DetectedEvent>): DetectedEvent | undefined {
    const ev = this.data.detectedEvents.find((e) => e.id === id);
    if (ev) {
      Object.assign(ev, patch);
      this.save();
    }
    return ev;
  }

  public getCommentarySegments(matchId?: string): CommentarySegment[] {
    return this.data.commentarySegments;
  }

  public addCommentarySegment(segment: CommentarySegment): void {
    this.data.commentarySegments.push(segment);
    this.save();
  }

  // Audit Logs
  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newLog: AuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(newLog);
    // keep last 200 logs
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 200);
    }
    this.save();
  }

  public getAuditLogs(limit: number = 50): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }
}
