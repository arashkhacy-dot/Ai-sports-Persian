import React from 'react';
import { CommentarySegment } from '../../types';
import { Volume2, Sparkles, Flame, Activity } from 'lucide-react';
import { toPersianDigits } from './MatchScoreboard';

interface CommentaryFeedProps {
  commentaries: CommentarySegment[];
  currentPts: number;
}

export const CommentaryFeed: React.FC<CommentaryFeedProps> = ({ commentaries, currentPts }) => {
  const playAudio = (url?: string) => {
    if (!url) return;
    const a = new Audio(url);
    a.play().catch(() => {});
  };

  const getIntensityBadge = (intensity: string) => {
    switch (intensity) {
      case 'explosive':
        return (
          <span className="flex items-center gap-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
            <Flame className="w-3 h-3 text-rose-500" />
            انفجاری
          </span>
        );
      case 'high':
        return (
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
            <Flame className="w-3 h-3 text-amber-500" />
            پرشور
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full">
            <Activity className="w-3 h-3 text-slate-400" />
            متوازن
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md flex flex-col h-full max-h-[520px]">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <h3 className="text-sm font-bold text-white">تایم‌لاین گزارش صوتی فارسی (PTS)</h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full">
          {toPersianDigits(commentaries.length)} فراز گزارش
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {commentaries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            در انتظار رویدادهای زنده مسابقه جهت تولید گزارش...
          </div>
        ) : (
          [...commentaries].reverse().map((c) => {
            const isCurrentlyActive = Math.abs(c.sourceMediaTargetPts - currentPts) < 4;

            return (
              <div
                key={c.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCurrentlyActive
                    ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-sans tabular-nums font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded-md">
                      {toPersianDigits(c.sourceMediaTargetPts.toFixed(1))} ثانیه
                    </span>
                    {getIntensityBadge(c.intensity)}
                  </div>

                  {c.audioUrl && (
                    <button
                      onClick={() => playAudio(c.audioUrl)}
                      aria-label="پخش مجدد صدای گزارش"
                      className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-600 text-slate-300 hover:text-white transition"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-medium">
                  {c.persianText}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>اطمینان هوش مصنوعی: {toPersianDigits((c.confidence * 100).toFixed(0))}٪</span>
                  </div>
                  <span>مدت تخمینی: {toPersianDigits(c.estimatedDurationSeconds.toFixed(1))} ثانیه</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
