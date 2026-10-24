import React from 'react';
import { Tv2, Clock, Calendar, Shield } from 'lucide-react';
import { Match, Team, Competition } from '../../types';

interface OfflineNoticeProps {
  nextMatch?: {
    match: { stadium: string; [key: string]: any };
    homeTeam?: Team;
    awayTeam?: Team;
    competition?: Competition;
  } | null;
}

export const OfflineNotice: React.FC<OfflineNoticeProps> = ({ nextMatch }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12">
      <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-6 shadow-2xl">
        <Tv2 className="w-10 h-10 text-slate-600" />
      </div>

      <h1 className="text-xl md:text-2xl font-black text-white mb-2 tracking-wide">
        در حال حاضر مسابقه‌ای در حال پخش نیست.
      </h1>

      <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
        پخش تک‌کاناله گزارشگر هوشمند فارسی به صورت اختصاصی توسط مدیر شبکه کنترل و همگام‌سازی می‌شود. به محض آغاز مسابقه، تصویر و گزارش زنده در این صفحه به نمایش درخواهد آمد.
      </p>

      {nextMatch && (
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-xl text-right">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Clock className="w-3.5 h-3.5" />
              مسابقه برنامه‌ریزی‌شده بعدی
            </span>
            <span>{nextMatch.competition?.nameFa || 'لیگ برتر خلیج فارس'}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: nextMatch.homeTeam?.primaryColor || '#e11d48' }}
              >
                {nextMatch.homeTeam?.shortCode || 'HOM'}
              </div>
              <span className="text-sm font-bold text-white">{nextMatch.homeTeam?.nameFa || 'میزبان'}</span>
            </div>

            <span className="text-slate-600 font-mono text-sm">VS</span>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{nextMatch.awayTeam?.nameFa || 'میهمان'}</span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: nextMatch.awayTeam?.primaryColor || '#2563eb' }}
              >
                {nextMatch.awayTeam?.shortCode || 'AWY'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>ورزشگاه: {nextMatch.match.stadium}</span>
            <span>کیفیت پخش: HD 720p HLS + گزارش هوشمند فارسی</span>
          </div>
        </div>
      )}
    </div>
  );
};
