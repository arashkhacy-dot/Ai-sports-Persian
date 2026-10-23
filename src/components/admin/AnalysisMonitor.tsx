import React, { useState } from 'react';
import { DetectedEvent, EventType } from '../../types';
import { Sparkles, Video, Volume2, Database, CheckCircle2, AlertTriangle, XCircle, Send, Film, Cpu, Layers, Play, Check } from 'lucide-react';
import { toPersianDigits } from '../public/MatchScoreboard';
import { api } from '../../services/api';

interface AnalysisMonitorProps {
  events: DetectedEvent[];
  onTriggerEvent: (params: { type: string; playerName?: string; description: string }) => Promise<void>;
  onVerifyEvent: (eventId: string, status: 'verified' | 'suspected' | 'rejected') => Promise<void>;
}

export const AnalysisMonitor: React.FC<AnalysisMonitorProps> = ({
  events,
  onTriggerEvent,
  onVerifyEvent,
}) => {
  const [selectedType, setSelectedType] = useState<EventType>('shot');
  const [playerName, setPlayerName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Checkpoint C1 & D1 Test States
  const [samplePts, setSamplePts] = useState('0');
  const [sampleDuration, setSampleDuration] = useState('10');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleResult, setSampleResult] = useState<any>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const [mixLoading, setMixLoading] = useState(false);
  const [mixResult, setMixResult] = useState<any>(null);
  const [mixError, setMixError] = useState<string | null>(null);

  const handleRunSampleAnalysis = async () => {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const res = await api.analyzeSample({
        startPts: parseFloat(samplePts) || 0,
        durationSeconds: parseFloat(sampleDuration) || 10,
      });
      setSampleResult(res);
    } catch (err: any) {
      setSampleError(err.message || 'خطا در اجرای تحلیل نمونه');
    } finally {
      setSampleLoading(false);
    }
  };

  const handleRunMixRender = async () => {
    setMixLoading(true);
    setMixError(null);
    try {
      const res = await api.renderMix({
        outputFormat: 'hls',
        duckingLevel: 0.35,
      });
      setMixResult(res);
    } catch (err: any) {
      setMixError(err.message || 'خطا در رندر میکس صوتی');
    } finally {
      setMixLoading(false);
    }
  };

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onTriggerEvent({
        type: selectedType,
        playerName: playerName.trim() || undefined,
        description: description.trim() || `صحنه فنی مسابقه نوع ${selectedType}`,
      });
      setDescription('');
      setPlayerName('');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded-full font-bold">
            <CheckCircle2 className="w-3 h-3" />
            تایید شده
          </span>
        );
      case 'suspected':
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/60 border border-amber-900/60 px-2 py-0.5 rounded-full font-bold">
            <AlertTriangle className="w-3 h-3" />
            مشکوک به بازبینی
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/60 border border-rose-900/60 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" />
            رد شده
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-6">
      {/* 3 Evidence Channels HUD */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">کانال‌های سه‌گانه شواهد موتور تحلیل (Hybrid Analysis Engine)</h3>
          </div>
          <span className="text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/40">
            فیوژن برخط فعال
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">۱. شواهد تصویری ویدیویی</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                استخراج فریم‌های اسکوربورد، ساعت بازی، شوت‌ها، مهارها و ساختار با برچسب زمانی PTS
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">۲. شواهد صوتی محیطی</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                تشخیص هیاهوی تماشاگران، صدای سوت داور و استخراج سرنخ‌های صوتی بدون ترجمه کورکورانه
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">۳. متادیتای تایید شده</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                لیست رسمی بازیکنان دو تیم، ترکیب اصلی، کارت‌های ثبتی و نتیجه قطعی بدون توهم اطلاعاتی
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Live Event Trigger for Real-Time Testing */}
      <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl">
        <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
          <span>شبیه‌سازی یا ثبت رویداد حساس مسابقه (تست زنده خط پردازش هوش مصنوعی)</span>
          <span className="text-[10px] text-slate-400 font-normal">تولید خودکار گزارش و سنتز صدا در خط لوله</span>
        </h4>

        <form onSubmit={handleTrigger} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">نوع رویداد</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as EventType)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="goal">⚽ گل (Goal)</option>
              <option value="shot">🎯 شوت در چارچوب (Shot)</option>
              <option value="save">🧤 مهار دیدنی دروازه‌بان (Save)</option>
              <option value="corner">🚩 ضربه کرنر (Corner)</option>
              <option value="yellow_card">🟨 کارت زرد داور (Yellow Card)</option>
              <option value="penalty">🚨 خطای پنالتی (Penalty)</option>
              <option value="foul">⚠️ خطای میانه میدان (Foul)</option>
              <option value="tactical_move">🧠 حرکت تاکتیکی و پرس (Tactical Move)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">نام بازیکن مرتبط (اختیاری)</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="مثال: عیسی آل‌کثیر یا بلانکو"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">شرح صحنه (اختیاری)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ارسال از جناح راست و ضربه سر..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'در حال تحلیل...' : 'ثبت در خط پردازش'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Phase 3 Diagnostics & Verification HUD (Checkpoints C1 & D1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Checkpoint C1: Multimodal Temporal Frame Analysis */}
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">تحلیل چندفریمی ویدیو (Checkpoint C1)</h4>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/40">
                Gemini 3.8 / Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              استخراج ۳ فریم متوالی [-۱.۵s, ۰s, +۱.۵s] با FFmpeg در برچسب زمانی PTS و اعتبارسنجی Zod با مدل چندوجهی
            </p>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 mb-1">شروع PTS (ثانیه)</label>
                <input
                  type="number"
                  value={samplePts}
                  onChange={(e) => setSamplePts(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 mb-1">طول پنجره (ثانیه)</label>
                <input
                  type="number"
                  value={sampleDuration}
                  onChange={(e) => setSampleDuration(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {sampleError && (
              <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/40 p-2.5 rounded-xl mb-3">
                {sampleError}
              </div>
            )}

            {sampleResult && (
              <div className="text-[11px] bg-slate-900 border border-slate-800 p-3 rounded-xl mb-3 space-y-1.5 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">وضعیت پردازش:</span>
                  <span className={`font-bold ${sampleResult.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {sampleResult.status === 'COMPLETED' ? 'تکمیل موفق تحلیل چندوجهی' : 'اعتبارسنجی فریم‌ها انجام شد (PENDING_EXTERNAL_TEST)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">فریم‌های استخراج شده:</span>
                  <span className="font-mono text-white">{toPersianDigits(sampleResult.extractedFramesCount || 0)} فریم متوالی</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">زمان تأخیر استخراج و پردازش:</span>
                  <span className="font-mono text-white">{toPersianDigits(sampleResult.latencyMs || 0)} میلی‌ثانیه</span>
                </div>
                {sampleResult.rawJson && (
                  <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-300">
                    <span className="text-emerald-400 font-bold block mb-1">رویداد شناسایی شده:</span>
                    <div>نوع: {sampleResult.rawJson.visibleAction} (اطمینان: {sampleResult.rawJson.confidence})</div>
                    <div className="text-slate-400 mt-1">{sampleResult.rawJson.factualDescriptionFa}</div>
                  </div>
                )}
                {sampleResult.errorMessage && (
                  <div className="text-[10px] text-amber-300/80 mt-1">
                    {sampleResult.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleRunSampleAnalysis}
            disabled={sampleLoading}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>{sampleLoading ? 'در حال استخراج فریم‌ها و تحلیل...' : 'اجرای تحلیل چندفریمی Gemini'}</span>
          </button>
        </div>

        {/* Checkpoint D1: Synchronized Timeline Audio Mix Render */}
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">رندر میکس همگام‌ساز صوتی (Checkpoint D1)</h4>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/40">
                FFmpeg amix + adelay
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              ترکیب استریم ویدیویی با قطعات صوتی گزارشگر فارسی در زمان دقیق PTS مدیا همراه با داکینگ (کاهش صدای استادیوم)
            </p>

            {mixError && (
              <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/40 p-2.5 rounded-xl mb-3">
                {mixError}
              </div>
            )}

            {mixResult && (
              <div className="text-[11px] bg-slate-900 border border-slate-800 p-3 rounded-xl mb-3 space-y-1.5 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">وضعیت رندر:</span>
                  <span className={`font-bold ${mixResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {mixResult.success ? 'رندر موفق خروجی همگام HLS' : 'خطا در رندر'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">قطعات صوتی ترکیب شده:</span>
                  <span className="font-mono text-white">{toPersianDigits(mixResult.mixedCommentaryCount || 0)} قطعه صوتی</span>
                </div>
                {mixResult.probeResult && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">طول استریم (ffprobe):</span>
                      <span className="font-mono text-white">{toPersianDigits(mixResult.probeResult.duration.toFixed(1))} ثانیه</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">استریم‌های شناسایی شده:</span>
                      <span className="font-mono text-white">
                        {mixResult.probeResult.hasVideo ? 'ویدیو ✓' : 'بدون ویدیو'} | {mixResult.probeResult.hasAudio ? 'صوت ✓' : 'بدون صوت'}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">زمان پردازش رندر:</span>
                  <span className="font-mono text-white">{toPersianDigits(mixResult.latencyMs || 0)} میلی‌ثانیه</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRunMixRender}
            disabled={mixLoading}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{mixLoading ? 'در حال اجرای میکس صوتی و رندر...' : 'اجرای تست میکس صوتی و تولید HLS'}</span>
          </button>
        </div>
      </div>

      {/* Verified Events List */}
      <div>
        <h4 className="text-xs font-bold text-slate-200 mb-3">
          رویدادهای شناسایی شده و وضعیت اعتبارسنجی مدیر
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2 font-medium">زمان PTS</th>
                <th className="pb-2 font-medium">نوع رویداد</th>
                <th className="pb-2 font-medium">شرح فنی فارسی</th>
                <th className="pb-2 font-medium">اطمینان</th>
                <th className="pb-2 font-medium">وضعیت</th>
                <th className="pb-2 font-medium text-left">عملیات بازبینی مدیر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-850/40">
                  <td className="py-2.5 font-mono text-emerald-400">
                    {toPersianDigits(evt.sourceTimestampPts.toFixed(1))}s
                  </td>
                  <td className="py-2.5 font-bold text-white">{evt.type}</td>
                  <td className="py-2.5 text-slate-300 max-w-xs truncate">
                    {evt.factualDescriptionFa}
                  </td>
                  <td className="py-2.5 font-mono text-slate-400">
                    {toPersianDigits((evt.confidence * 100).toFixed(0))}٪
                  </td>
                  <td className="py-2.5">{getStatusBadge(evt.verificationStatus)}</td>
                  <td className="py-2.5 text-left">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onVerifyEvent(evt.id, 'verified')}
                        aria-label="تایید رویداد"
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px]"
                      >
                        تایید
                      </button>
                      <button
                        onClick={() => onVerifyEvent(evt.id, 'rejected')}
                        aria-label="رد رویداد"
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px]"
                      >
                        رد
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
