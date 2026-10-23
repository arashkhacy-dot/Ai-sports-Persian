import React, { useState } from 'react';
import { api } from '../../services/api';
import { ShieldCheck, Lock, User, AlertCircle, KeyRound } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (user: { id: string; username: string }) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.adminLogin(username, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'ورود ناموفق بود. نام کاربری و رمز عبور را بررسی نمایید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">ورود به پنل مدیریت پخش</h1>
          <p className="text-xs text-slate-400 mt-1">
            کنترل انحصاری کانال، خط لوله هوش مصنوعی، منابع ویدیویی و خروجی HLS
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              نام کاربری مدیر
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 pr-10"
                placeholder="admin"
              />
              <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              رمز عبور
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 pr-10"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>مشخصات مدیر پیش‌فرض جهت تست سیستم:</span>
            </div>
            <p>نام کاربری: <code className="text-slate-200">admin</code> | رمز عبور: <code className="text-slate-200">admin123!</code></p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition shadow-lg shadow-emerald-950/40"
          >
            {loading ? 'در حال ورود امن...' : 'ورود به پنل مدیریت'}
          </button>
        </form>
      </div>
    </div>
  );
};
