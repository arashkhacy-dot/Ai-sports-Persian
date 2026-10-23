import React, { useState } from 'react';
import { MediaSource } from '../../types';
import { Film, Upload, Globe, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface SourceManagerProps {
  sources: MediaSource[];
  onAddUrl: (params: { matchId: string; title: string; url: string; isVerifiedRights: boolean }) => Promise<void>;
  onUploadFile: (formData: FormData) => Promise<void>;
}

export const SourceManager: React.FC<SourceManagerProps> = ({
  sources,
  onAddUrl,
  onUploadFile,
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isVerifiedRights, setIsVerifiedRights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isVerifiedRights) {
      setError('علامت زدن تاییدیه حق پخش قانونی و مجاز برای این منبع الزامی است.');
      return;
    }

    setLoading(true);
    try {
      await onAddUrl({
        matchId: 'match_tehran_derby_104',
        title: title || 'استریم اینترنتی مجاز',
        url,
        isVerifiedRights: true,
      });
      setUrl('');
      setTitle('');
      setIsVerifiedRights(false);
      setSuccess('منبع ویدیویی پس از اعتبارسنجی SSRF با موفقیت ثبت گردید.');
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت منبع.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', file.name);
      formData.append('matchId', 'match_tehran_derby_104');

      await onUploadFile(formData);
      setSuccess(`فایل ویدیویی ${file.name} با موفقیت در مخزن ذخیره شد.`);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری فایل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">مدیریت منابع ویدیویی مجاز (Stream Sources)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2.5 py-0.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>پایش حقوق پخش و فیلتر SSRF</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Register Authorized HLS/MP4 URL */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850">
          <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>ثبت آدرس استریم آنلاین یا HLS مجاز</span>
          </h4>

          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان منبع (مثال: فید رسمی با وضوح ۷۲۰p)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://example.com/live/feed.m3u8"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 text-left font-mono"
              />
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isVerifiedRights}
                onChange={(e) => setIsVerifiedRights(e.target.checked)}
                className="mt-0.5 accent-emerald-500"
              />
              <span>تایید می‌کنم این منبع دارای حق پخش قانونی و تایید شده بوده و حاوی دور زدن DRM نیست.</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-2 rounded-xl transition"
            >
              {loading ? 'در حال اعتبارسنجی SSRF...' : 'اعتبارسنجی و افزودن به منابع'}
            </button>
          </form>
        </div>

        {/* Upload Authorized MP4 File */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>بارگذاری فایل ویدیویی مسابقه (MP4)</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              مناسب برای آزمایش همگام‌سازی PTS روی قطعات ۱۰ الی ۱۵ دقیقه‌ای ضبط شده با کیفیت بالا بدون نوسان اینترنت.
            </p>
          </div>

          <label className="border-2 border-dashed border-slate-800 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2">
            <Upload className="w-6 h-6 text-slate-500" />
            <span className="text-xs text-slate-300 font-medium">انتخاب و بارگذاری ویدیو MP4</span>
            <span className="text-[10px] text-slate-500">حداکثر حجم: ۵۰۰ مگابایت</span>
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Sources List */}
      <div>
        <h4 className="text-xs font-bold text-slate-200 mb-3">منابع موجود در سامانه</h4>
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{s.title}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    {s.type}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 text-left truncate max-w-md">
                  {s.url}
                </div>
              </div>

              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-md">
                حقوق تایید شده
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
