import {
  ChannelInfo,
  CommentarySegment,
  DetectedEvent,
  SystemMetrics,
  Broadcast,
  Match,
  Team,
  Competition,
  MediaSource,
  AuditLog,
} from '../types';

let adminToken: string | null = localStorage.getItem('ai_sportscaster_admin_token');

export const setAdminToken = (token: string | null) => {
  adminToken = token;
  if (token) {
    localStorage.setItem('ai_sportscaster_admin_token', token);
  } else {
    localStorage.removeItem('ai_sportscaster_admin_token');
  }
};

export const getAdminToken = () => adminToken;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
});

export const api = {
  // Public
  async getPublicChannel(): Promise<ChannelInfo> {
    const res = await fetch('/api/v1/public/channel');
    if (!res.ok) throw new Error('خطا در دریافت اطلاعات کانال پخش');
    return res.json();
  },

  async getPublicCommentary(matchId?: string): Promise<CommentarySegment[]> {
    const url = matchId ? `/api/v1/public/commentary?matchId=${matchId}` : '/api/v1/public/commentary';
    const res = await fetch(url);
    if (!res.ok) throw new Error('خطا در دریافت گزارش فارسی');
    return res.json();
  },

  async getPublicEvents(matchId?: string): Promise<DetectedEvent[]> {
    const url = matchId ? `/api/v1/public/events?matchId=${matchId}` : '/api/v1/public/events';
    const res = await fetch(url);
    if (!res.ok) throw new Error('خطا در دریافت رویدادها');
    return res.json();
  },

  // Admin
  async adminLogin(username: string, password: string): Promise<{ token: string; user: { id: string; username: string } }> {
    const res = await fetch('/api/v1/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'ورود ناموفق بود.');
    }
    const data = await res.json();
    setAdminToken(data.token);
    return data;
  },

  async adminLogout(): Promise<void> {
    try {
      await fetch('/api/v1/admin/logout', {
        method: 'POST',
        headers: authHeaders(),
      });
    } finally {
      setAdminToken(null);
    }
  },

  async getAdminStatus(): Promise<{
    broadcast: Broadcast | null;
    isLocked: boolean;
    scheduledCount: number;
    tokensConsumed: number;
    apiLatencyMs: number;
    metrics: SystemMetrics;
  }> {
    const res = await fetch('/api/v1/admin/status', { headers: authHeaders() });
    if (!res.ok) throw new Error('خطا در دریافت وضعیت مدیر');
    return res.json();
  },

  async startBroadcast(params: {
    matchId: string;
    sourceId: string;
    commentaryStyle: string;
    commentatorVoice: string;
    audioMode: string;
    targetLiveDelaySeconds: number;
  }): Promise<{ success: boolean; broadcast: Broadcast }> {
    const res = await fetch('/api/v1/admin/broadcast/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در آغاز پخش');
    }
    return res.json();
  },

  async stopBroadcast(): Promise<{ success: boolean }> {
    const res = await fetch('/api/v1/admin/broadcast/stop', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('خطا در توقف پخش');
    return res.json();
  },

  async getAdminMatches(): Promise<{ matches: Match[]; teams: Team[]; competitions: Competition[] }> {
    const res = await fetch('/api/v1/admin/matches', { headers: authHeaders() });
    if (!res.ok) throw new Error('خطا در دریافت لیست مسابقات');
    return res.json();
  },

  async createMatch(params: {
    homeTeamId: string;
    awayTeamId: string;
    competitionId: string;
    stadium: string;
    referee: string;
  }): Promise<Match> {
    const res = await fetch('/api/v1/admin/matches', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('خطا در ایجاد مسابقه جدید');
    return res.json();
  },

  async getAdminSources(matchId?: string): Promise<MediaSource[]> {
    const url = matchId ? `/api/v1/admin/sources?matchId=${matchId}` : '/api/v1/admin/sources';
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('خطا در دریافت لیست منابع');
    return res.json();
  },

  async addSourceUrl(params: {
    matchId: string;
    title: string;
    url: string;
    isVerifiedRights: boolean;
  }): Promise<MediaSource> {
    const res = await fetch('/api/v1/admin/sources/url', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در ثبت منبع اینترنتی');
    }
    return res.json();
  },

  async uploadSourceFile(formData: FormData): Promise<MediaSource> {
    const res = await fetch('/api/v1/admin/sources/upload', {
      method: 'POST',
      headers: {
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در بارگذاری فایل ویدیویی');
    }
    return res.json();
  },

  async triggerEvent(params: {
    type: string;
    playerName?: string;
    description: string;
  }): Promise<{ event: DetectedEvent; commentary: CommentarySegment }> {
    const res = await fetch('/api/v1/admin/events/trigger', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در ثبت رویداد بازی');
    }
    return res.json();
  },

  async verifyEvent(eventId: string, status: 'verified' | 'suspected' | 'rejected'): Promise<DetectedEvent> {
    const res = await fetch('/api/v1/admin/events/verify', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ eventId, status }),
    });
    if (!res.ok) throw new Error('خطا در تغییر وضعیت تایید رویداد');
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/v1/admin/audit-logs', { headers: authHeaders() });
    if (!res.ok) throw new Error('خطا در دریافت لاگ‌های امنیتی');
    return res.json();
  },

  async getFFmpegCommand(sourceUrl?: string): Promise<{ command: string }> {
    const url = sourceUrl ? `/api/v1/admin/ffmpeg/command?sourceUrl=${encodeURIComponent(sourceUrl)}` : '/api/v1/admin/ffmpeg/command';
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('خطا در دریافت دستور FFmpeg');
    return res.json();
  },

  async analyzeSample(params?: { videoPath?: string; startPts?: number; durationSeconds?: number }): Promise<any> {
    const res = await fetch('/api/v1/admin/analyze-sample', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در تحلیل نمونه ویدیویی');
    }
    return res.json();
  },

  async renderMix(params?: { sourcePath?: string; outputFormat?: 'hls' | 'mp4'; duckingLevel?: number }): Promise<any> {
    const res = await fetch('/api/v1/admin/render-mix', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در رندر همگام');
    }
    return res.json();
  },
};
