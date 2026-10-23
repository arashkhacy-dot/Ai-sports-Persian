import React from 'react';
import { BroadcastState } from '../../types';
import { Radio, Lock, Unlock, LogOut, Tv2, ShieldCheck } from 'lucide-react';

interface AdminHeaderProps {
  state: BroadcastState;
  isLocked: boolean;
  onLogout: () => void;
  onViewPublic: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  state,
  isLocked,
  onLogout,
  onViewPublic,
}) => {
  const getStateBadge = () => {
    switch (state) {
      case 'BROADCASTING':
        return (
          <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-3 py-1 rounded-full font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            در حال پخش زنده (BROADCASTING)
          </span>
        );
      case 'ANALYZING':
        return (
          <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-3 py-1 rounded-full font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            تحلیل چندوجهی (ANALYZING)
          </span>
        );
      case 'PREPARING':
        return (
          <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-3 py-1 rounded-full font-bold">
            آماده‌سازی (PREPARING)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-full">
            کانال آماده‌باش (IDLE)
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shadow-inner">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm md:text-base font-black text-white flex items-center gap-2">
            داشبورد مدیریت انحصاری پخش زنده
            <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2.5 py-0.5 rounded-full font-bold">
              تک‌کاناله
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            کنترل پردازش هوش مصنوعی، هماهنگ‌سازی PTS و انتشار استریم HLS
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {getStateBadge()}

        <span
          title={isLocked ? 'قفل انحصاری پخش فعال است' : 'قفل آزاد است'}
          className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${
            isLocked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          <span className="hidden md:inline">{isLocked ? 'قفل استریم فعال' : 'قفل آزاد'}</span>
        </span>

        <button
          onClick={onViewPublic}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-xl transition"
        >
          <Tv2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>مشاهده تلویزیون عمومی</span>
        </button>

        <button
          onClick={onLogout}
          aria-label="خروج از حساب مدیر"
          className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
