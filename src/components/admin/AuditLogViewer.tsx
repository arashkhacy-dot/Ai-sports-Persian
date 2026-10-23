import React from 'react';
import { AuditLog } from '../../types';
import { ShieldCheck, History } from 'lucide-react';
import { toPersianDigits } from '../public/MatchScoreboard';

interface AuditLogViewerProps {
  logs: AuditLog[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">لاگ‌های امنیتی و ممیزی سامانه (Audit Trail)</h3>
        </div>
        <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {toPersianDigits(logs.length)} رخداد ثبت‌شده
        </span>
      </div>

      <div className="overflow-x-auto max-h-60 overflow-y-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
              <th className="pb-2 font-medium">زمان</th>
              <th className="pb-2 font-medium">عملیات</th>
              <th className="pb-2 font-medium">مدیر</th>
              <th className="pb-2 font-medium">آدرس IP</th>
              <th className="pb-2 font-medium">شرح رویداد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-850/30">
                <td className="py-2 font-mono text-[11px] text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                </td>
                <td className="py-2">
                  <span className="font-mono text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-md">
                    {log.action}
                  </span>
                </td>
                <td className="py-2 text-slate-300">{log.adminId}</td>
                <td className="py-2 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>
                <td className="py-2 text-slate-200">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
