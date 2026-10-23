import React, { useState } from 'react';
import { Broadcast, Match, MediaSource, CommentaryStyle, AudioMode } from '../../types';
import { Play, Square, Settings2, Sliders, Volume2, Mic, AlertCircle } from 'lucide-react';
import { toPersianDigits } from '../public/MatchScoreboard';

interface BroadcastControlProps {
  broadcast: Broadcast | null;
  matches: Match[];
  sources: MediaSource[];
  isLocked: boolean;
  onStart: (params: {
    matchId: string;
    sourceId: string;
    commentaryStyle: CommentaryStyle;
    commentatorVoice: string;
    audioMode: AudioMode;
    targetLiveDelaySeconds: number;
  }) => Promise<void>;
  onStop: () => Promise<void>;
}

export const BroadcastControl: React.FC<BroadcastControlProps> = ({
  broadcast,
  matches,
  sources,
  isLocked,
  onStart,
  onStop,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState(broadcast?.matchId || matches[0]?.id || '');
  const [selectedSourceId, setSelectedSourceId] = useState(broadcast?.sourceId || sources[0]?.id || '');
  const [style, setStyle] = useState<CommentaryStyle>(broadcast?.commentaryStyle || 'energetic');
  const [voice, setVoice] = useState(broadcast?.commentatorVoice || 'پژمان (گزارشگر رسمی پرحرارت فارسی)');
  const [audioMode, setAudioMode] = useState<AudioMode>(broadcast?.audioMode || 'ducking');
  const [targetDelay, setTargetDelay] = useState(broadcast?.targetLiveDelaySeconds || 30);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBroadcasting = broadcast?.state === 'BROADCASTING';

  const handleStart = async () => {
    setError(null);
    setActionLoading(true);
    try {
      await onStart({
        matchId: selectedMatchId,
        sourceId: selectedSourceId,
        commentaryStyle: style,
        commentatorVoice: voice,
        audioMode,
        targetLiveDelaySeconds: targetDelay,
      });
    } catch (err: any) {
      setError(err.message || 'خطا در آغاز پخش زنده.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setActionLoading(true);
    try {
      await onStop();
    } catch (err: any) {
      setError(err.message || 'خطا در توقف پخش.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">کنترل خط لوله پخش زنده</h2>
            <p className="text-[11px] text-slate-400">مدیریت هماهنگ‌سازی چندوجهی، صدا و خروجی عمومی</p>
          </div>
        </div>

        <div>
          {isBroadcasting ? (
            <button
              onClick={handleStop}
              disabled={actionLoading || isLocked}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-rose-950/40"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>توقف پخش زنده</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading || isLocked}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>شروع پخش سراسری</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Match Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            مسابقه فعال در خط پخش
          </label>
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            disabled={isBroadcasting}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.stadium} - (شناسه: {m.id})
              </option>
            ))}
          </select>
        </div>

        {/* Video Source Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            منبع ویدیویی مجاز
          </label>
          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            disabled={isBroadcasting}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.type === 'hls_stream' ? 'جریان HLS' : 'ویدیو MP4'})
              </option>
            ))}
          </select>
        </div>

        {/* Commentary Style */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            لحن و سبک گزارش فارسی
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as CommentaryStyle)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="energetic">پرشور و هیجانی (گزارش کلاسیک ایرانی)</option>
            <option value="balanced">متوازن و روان (روایت متعادل مسابقه)</option>
            <option value="analytical">تحلیلی و تاکتیکی (تمرکز بر ساختار تیمی)</option>
          </select>
        </div>

        {/* Voice Persona */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            پرسونای صوتی گزارشگر
          </label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="پژمان (گزارشگر رسمی پرحرارت فارسی)">پژمان (انرژی بالا، مسابقات حساس)</option>
            <option value="سامان (گزارشگر تحلیلی و فنی)">سامان (آرامش، واژگان تخصصی فوتبال)</option>
            <option value="بهروز (گزارشگر کلاسیک فوتبال ایران)">بهروز (وزین، ضرباهنگ منظم)</option>
          </select>
        </div>

        {/* Audio Mode */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            حالت میکس صوتی استریم
          </label>
          <select
            value={audioMode}
            onChange={(e) => setAudioMode(e.target.value as AudioMode)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ducking">هوش مصنوعی با داکینگ صدای استادیوم (Ducking)</option>
            <option value="ai_only">صدای گزارشگر هوش مصنوعی به تنهایی (بدون صدای پس‌زمینه)</option>
            <option value="stadium_separated">تفکیک پیشرفته صدای تماشاگران (محیط با شتاب‌دهنده)</option>
          </select>
        </div>

        {/* Target Live Delay Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              تأخیر هدف زنده (Target Live Delay)
            </label>
            <span className="text-xs font-sans tabular-nums text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md">
              {toPersianDigits(targetDelay)} ثانیه
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={targetDelay}
            onChange={(e) => setTargetDelay(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>۱۰ ثانیه (حداقل بافر)</span>
            <span>۳۰ ثانیه (پیش‌فرض پیشنهادی)</span>
            <span>۹۰ ثانیه (پایدارترین تحلیل)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
