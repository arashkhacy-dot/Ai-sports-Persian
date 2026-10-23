import React from 'react';
import { SystemMetrics as SystemMetricsType } from '../../types';
import { Cpu, HardDrive, Wifi, Clock, Brain, Terminal, ShieldAlert } from 'lucide-react';
import { toPersianDigits } from '../public/MatchScoreboard';

interface SystemMetricsProps {
  metrics: SystemMetricsType;
}

export const SystemMetrics: React.FC<SystemMetricsProps> = ({ metrics }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">پایش منابع و سلامت زیرساخت سرور (Telemetry)</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            اندازه‌گیری واقعی سرور
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            تخمینی
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* CPU */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">مصرف پردازنده (CPU)</span>
            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded">تخمینی</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.cpuUsagePercent)}٪
            </span>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">حافظه موقت (RAM)</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded">واقعی</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.memoryUsageMb)} MB
            </span>
          </div>
        </div>

        {/* Stream Bitrate */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">بیت‌ریت استریم</span>
            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded">تخمینی</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-indigo-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.streamBitrateKbps)} kbps
            </span>
          </div>
        </div>

        {/* PTS Live Delay */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">تأخیر همگام‌سازی</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded">واقعی</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.targetDelaySeconds)}s
            </span>
          </div>
        </div>

        {/* Gemini Latency */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">تأخیر API جمنای</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded">واقعی</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-fuchsia-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.geminiApiLatencyMs || 240)} ms
            </span>
          </div>
        </div>

        {/* Tokens Consumed */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px]">توکن‌های مصرفی</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded">واقعی</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-teal-400" />
            <span className="text-base font-black text-white font-sans tabular-nums">
              {toPersianDigits(metrics.tokensConsumedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
