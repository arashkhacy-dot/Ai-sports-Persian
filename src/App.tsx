import React, { useState, useEffect } from 'react';
import { ChannelInfo, CommentarySegment, DetectedEvent, SystemMetrics as SystemMetricsType, Match, Team, Competition, MediaSource, AuditLog, Broadcast } from './types';
import { api, getAdminToken, setAdminToken } from './services/api';
import { MatchScoreboard } from './components/public/MatchScoreboard';
import { PublicPlayer } from './components/public/PublicPlayer';
import { CommentaryFeed } from './components/public/CommentaryFeed';
import { OfflineNotice } from './components/public/OfflineNotice';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminHeader } from './components/admin/AdminHeader';
import { BroadcastControl } from './components/admin/BroadcastControl';
import { AnalysisMonitor } from './components/admin/AnalysisMonitor';
import { MatchManager } from './components/admin/MatchManager';
import { SourceManager } from './components/admin/SourceManager';
import { SystemMetrics } from './components/admin/SystemMetrics';
import { AuditLogViewer } from './components/admin/AuditLogViewer';
import { Radio, Shield, Tv2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<'public' | 'admin'>(() => {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'public';
  });

  // Public State
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [commentaries, setCommentaries] = useState<CommentarySegment[]>([]);
  const [events, setEvents] = useState<DetectedEvent[]>([]);
  const [activeCommentary, setActiveCommentary] = useState<CommentarySegment | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => !!getAdminToken());
  const [adminStatus, setAdminStatus] = useState<{
    broadcast: Broadcast | null;
    isLocked: boolean;
    scheduledCount: number;
    tokensConsumed: number;
    apiLatencyMs: number;
    metrics: SystemMetricsType;
  } | null>(null);
  const [adminMatches, setAdminMatches] = useState<Match[]>([]);
  const [adminTeams, setAdminTeams] = useState<Team[]>([]);
  const [adminCompetitions, setAdminCompetitions] = useState<Competition[]>([]);
  const [adminSources, setAdminSources] = useState<MediaSource[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Navigation listener
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'public');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route: 'public' | 'admin') => {
    setCurrentRoute(route);
    const path = route === 'admin' ? '/admin' : '/';
    window.history.pushState({}, '', path);
  };

  // Fetch Public Channel Data
  const loadPublicData = async () => {
    try {
      const ch = await api.getPublicChannel();
      setChannel(ch);

      const comms = await api.getPublicCommentary(ch.match?.id);
      setCommentaries(comms);

      const evts = await api.getPublicEvents(ch.match?.id);
      setEvents(evts);
    } catch (err) {
      console.warn('Failed to fetch public channel data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Admin Data
  const loadAdminData = async () => {
    if (!isAdminAuthenticated) return;
    try {
      const [status, matchData, sourcesData, logs] = await Promise.all([
        api.getAdminStatus(),
        api.getAdminMatches(),
        api.getAdminSources(),
        api.getAuditLogs(),
      ]);
      setAdminStatus(status);
      setAdminMatches(matchData.matches);
      setAdminTeams(matchData.teams);
      setAdminCompetitions(matchData.competitions);
      setAdminSources(sourcesData);
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Failed to load admin dashboard data:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadPublicData();
  }, []);

  // Admin polling when in admin route
  useEffect(() => {
    if (currentRoute === 'admin' && isAdminAuthenticated) {
      loadAdminData();
      const interval = setInterval(loadAdminData, 3000);
      return () => clearInterval(interval);
    }
  }, [currentRoute, isAdminAuthenticated]);

  // Server-Sent Events (SSE) for live synchronization
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/public/stream-events');

    eventSource.addEventListener('pts', (e) => {
      const data = JSON.parse(e.data);
      setChannel((prev) => (prev ? { ...prev, currentPts: data.pts } : prev));
    });

    eventSource.addEventListener('commentary', (e) => {
      const data = JSON.parse(e.data);
      const seg: CommentarySegment = data.segment;
      setActiveCommentary(seg);
      setCommentaries((prev) => {
        if (prev.some((c) => c.id === seg.id)) return prev;
        return [...prev, seg];
      });
    });

    eventSource.addEventListener('state', (e) => {
      const data = JSON.parse(e.data);
      setChannel((prev) => (prev ? { ...prev, state: data.state } : prev));
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Vazirmatn',sans-serif]">
      {/* Route Switch Bar */}
      <nav aria-label="ناوبری اصلی سامانه" className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-bold text-white tracking-wide">Persian AI SportsCaster</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full hidden sm:inline-block">
            پخش تک‌کاناله اختصاصی
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateTo('public')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl transition ${
              currentRoute === 'public'
                ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Tv2 className="w-3.5 h-3.5" />
            <span>تلویزیون عمومی (/)</span>
          </button>

          <button
            onClick={() => navigateTo('admin')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl transition ${
              currentRoute === 'admin'
                ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>پنل مدیر (/admin)</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1">
        {currentRoute === 'public' ? (
          /* ==============================================================
           * PUBLIC TV VIEW (/) - Viewer cannot trigger AI or change sources
           * ============================================================== */
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            {loading ? (
              <div className="min-h-[50vh] flex items-center justify-center text-slate-400 text-xs">
                در حال دریافت اطلاعات کانال زنده...
              </div>
            ) : !channel || channel.state === 'IDLE' ? (
              <OfflineNotice
                nextMatch={
                  channel?.match
                    ? {
                        match: channel.match,
                        homeTeam: channel.match.homeTeam,
                        awayTeam: channel.match.awayTeam,
                        competition: channel.match.competition,
                      }
                    : null
                }
              />
            ) : (
              <div className="space-y-6">
                {/* Scoreboard HUD */}
                <MatchScoreboard channel={channel} />

                {/* Player & Commentary Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8">
                    <PublicPlayer channel={channel} activeCommentary={activeCommentary} />
                  </div>

                  <div className="lg:col-span-4">
                    <CommentaryFeed commentaries={commentaries} currentPts={channel.currentPts} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==============================================================
           * SECURE ADMIN DASHBOARD (/admin)
           * ============================================================== */
          <div>
            {!isAdminAuthenticated ? (
              <AdminLogin
                onLoginSuccess={() => {
                  setIsAdminAuthenticated(true);
                  loadAdminData();
                }}
              />
            ) : (
              <div>
                <AdminHeader
                  state={adminStatus?.broadcast?.state || channel?.state || 'IDLE'}
                  isLocked={adminStatus?.isLocked || false}
                  onLogout={async () => {
                    await api.adminLogout();
                    setIsAdminAuthenticated(false);
                  }}
                  onViewPublic={() => navigateTo('public')}
                />

                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                  {/* Broadcast Pipeline Controller */}
                  <BroadcastControl
                    broadcast={adminStatus?.broadcast || null}
                    matches={adminMatches}
                    sources={adminSources}
                    isLocked={adminStatus?.isLocked || false}
                    onStart={async (params) => {
                      await api.startBroadcast(params);
                      await loadAdminData();
                      await loadPublicData();
                    }}
                    onStop={async () => {
                      await api.stopBroadcast();
                      await loadAdminData();
                      await loadPublicData();
                    }}
                  />

                  {/* Multimodal Analysis & Live Event Trigger */}
                  <AnalysisMonitor
                    events={events}
                    onTriggerEvent={async (params) => {
                      const res = await api.triggerEvent(params);
                      setEvents((prev) => [res.event, ...prev]);
                      setCommentaries((prev) => [...prev, res.commentary]);
                      setActiveCommentary(res.commentary);
                      await loadAdminData();
                    }}
                    onVerifyEvent={async (id, status) => {
                      await api.verifyEvent(id, status);
                      setEvents((prev) =>
                        prev.map((e) => (e.id === id ? { ...e, verificationStatus: status } : e))
                      );
                    }}
                  />

                  {/* System Telemetry & Resource Limits */}
                  {adminStatus?.metrics && <SystemMetrics metrics={adminStatus.metrics} />}

                  {/* Media Sources & Rights Validation */}
                  <SourceManager
                    sources={adminSources}
                    onAddUrl={async (params) => {
                      await api.addSourceUrl(params);
                      await loadAdminData();
                    }}
                    onUploadFile={async (formData) => {
                      await api.uploadSourceFile(formData);
                      await loadAdminData();
                    }}
                  />

                  {/* Match & Team Management */}
                  <MatchManager
                    matches={adminMatches}
                    teams={adminTeams}
                    competitions={adminCompetitions}
                    onCreateMatch={async (params) => {
                      await api.createMatch(params);
                      await loadAdminData();
                    }}
                  />

                  {/* Security Audit Trail */}
                  <AuditLogViewer logs={auditLogs} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persian Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500">
        <p>
          سامانه اختصاصی پخش زنده و تک‌کاناله فوتبال با هوش مصنوعی و گزارش فارسی | هماهنگ‌سازی PTS | خودمیزبان روی سرور اوبونتو (Docker + Nginx + FFmpeg)
        </p>
      </footer>
    </div>
  );
}
