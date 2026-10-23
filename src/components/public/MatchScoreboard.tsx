import React from 'react';
import { ChannelInfo } from '../../types';
import { Shield, Clock, MapPin, Radio } from 'lucide-react';

interface MatchScoreboardProps {
  channel: ChannelInfo;
}

export const toPersianDigits = (n: number | string): string => {
  return String(n);
};

export const formatClock = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${toPersianDigits(mins.toString().padStart(2, '0'))}:${toPersianDigits(secs.toString().padStart(2, '0'))}`;
};

export const MatchScoreboard: React.FC<MatchScoreboardProps> = ({ channel }) => {
  const match = channel.match;
  if (!match) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
      {/* Top Bar: Live indicator + Competition */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          {channel.isActive ? (
            <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              پخش زنده رسمی
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-medium">
              آفلاین
            </span>
          )}
          <span className="text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full">
            {match.competition?.nameFa || 'مسابقه رسمی فوتبال'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {match.stadium}
          </span>
        </div>
      </div>

      {/* Main Scoreboard HUD */}
      <div className="grid grid-cols-7 items-center gap-2 md:gap-4 my-2">
        {/* Home Team */}
        <div className="col-span-3 flex flex-col md:flex-row items-center justify-end gap-3 text-right">
          <div className="order-2 md:order-1 text-center md:text-right">
            <h2 className="text-base md:text-xl font-bold text-white tracking-wide">
              {match.homeTeam?.nameFa || 'میزبان'}
            </h2>
            <span className="text-xs text-slate-400 hidden md:inline-block">
              {match.homeTeam?.nameEn}
            </span>
          </div>
          <div
            className="order-1 md:order-2 w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-lg border-2 border-white/10"
            style={{ backgroundColor: match.homeTeam?.primaryColor || '#e11d48' }}
          >
            {match.homeTeam?.shortCode || 'HOM'}
          </div>
        </div>

        {/* Score & Match Clock Center */}
        <div className="col-span-1 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-800 text-xl md:text-3xl font-black text-amber-400 font-sans tabular-nums tracking-widest shadow-inner">
            <span>{toPersianDigits(match.homeScore)}</span>
            <span className="text-slate-600 text-sm">:</span>
            <span>{toPersianDigits(match.awayScore)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] md:text-xs text-emerald-400 font-sans tabular-nums mt-1.5 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-0.5 rounded-full font-bold">
            <Clock className="w-3 h-3" />
            <span>{formatClock(match.matchClock)}</span>
          </div>
        </div>

        {/* Away Team */}
        <div className="col-span-3 flex flex-col md:flex-row items-center justify-start gap-3 text-left">
          <div
            className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-lg border-2 border-white/10"
            style={{ backgroundColor: match.awayTeam?.primaryColor || '#2563eb' }}
          >
            {match.awayTeam?.shortCode || 'AWY'}
          </div>
          <div className="text-center md:text-right">
            <h2 className="text-base md:text-xl font-bold text-white tracking-wide">
              {match.awayTeam?.nameFa || 'میهمان'}
            </h2>
            <span className="text-xs text-slate-400 hidden md:inline-block">
              {match.awayTeam?.nameEn}
            </span>
          </div>
        </div>
      </div>

      {/* Broadcaster Voice Badge */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>گزارشگر هوشمند زنده: <strong className="text-slate-200">{channel.commentatorVoice}</strong></span>
        </div>
        <div className="text-[11px] text-slate-500">
          تأخیر همگام‌سازی PTS: {toPersianDigits(channel.targetLiveDelaySeconds)} ثانیه
        </div>
      </div>
    </div>
  );
};
