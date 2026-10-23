# وضعیت پیشرفت پروژه گزارشگر هوشمند فوتبال فارسی (PROGRESS.md)

تاریخ آخرین بازبینی: ۲۳ اکتبر ۲۰۲۶

---

## ۱. موارد تکمیل شده (Completed)

- **امنیت احراز هویت ادمین (Checkpoint A)**:
  - جایگزینی الگوریتم ضعیف با **Salted Scrypt** و مقایسه امن در برابر حملات زمانی (`crypto.timingSafeEqual`).
  - جایگزینی توکن‌های مبتنی بر `Math.random` با **توکن‌های ۲۵۶ بیتی امن کریپتوگرافی** (`crypto.randomBytes(32)`).
  - پیاده‌سازی مکانیزم محدودسازی نرخ ورود (Rate Limiting/Throttling) با قفل ۱۵ دقیقه‌ای پس از ۵ تلاش ناموفق.
  - پشتیبانی از راه‌اندازی امن یک‌باره مدیر (`/api/v1/admin/setup`) و تغییر رمز عبور.
- **شفافیت خروجی و حذف داده‌های ساختگی (Honest Output & Telemetry)**:
  - حذف کامل پلی‌لیست‌های متنی فیک (`segment_*.ts`)؛ اکنون استریم HLS تنها در صورت تولید واقعی سگمنت‌ها توسط FFmpeg روی دیسک سرو می‌شود.
  - جایگزینی متریک‌های تصادفی با مصرف واقعی CPU مبتنی بر دلتای `process.cpuUsage()` و حافظه واقعی `process.memoryUsage()`.
- **موتور استخراج و سوپروایزر رسانه (FFmpeg & FFprobe Supervisor - Checkpoint B)**:
  - پیاده‌سازی سوپروایزر کامل `FFmpegWorkerService` با متد `spawn` (بدون اجرای رشته‌ای ناامن).
  - اعتبارسنجی مشخصات رسانه با `ffprobe` (وضوح، کدک تصویر و صدا، بیت‌ریت، مدت زمان).
  - متد پاکسازی دایرکتوری HLS جهت جلوگیری از تداخل سگمنت‌ها.
- **استخراج فریم‌ها و تحلیل چندوجهی (Checkpoint C)**:
  - سرویس `MediaExtractorService` جهت استخراج فریم‌های ویدیویی واقعی در زمان PTS با مقیاس ۶۴۰ پیکسل و ذخیره در کش محتوایی جهت صرفه‌جویی شدید در مصرف توکن.
  - اتصال فریم‌ها به مدل رسمی `gemini-3.8-flash` برای ارزیابی شواهد چندوجهی.
- **تولید صدای فارسی (TTS Integration)**:
  - پیاده‌سازی ادپتر رسمی `gemini-3.8-flash-lite-tts` با برچسب‌گذاری صریح وضعیت `gemini_tts` در برابر `mock_synth`.
- **استقرار Docker و تولید باندل مستقل**:
  - تصحیح `Dockerfile` و افزودن بیلد سرور با esbuild به `dist/server.js` جهت اجرای بی‌نقص با `node` بدون وابستگی به tsx در محیط پروداکشن.

---

## ۲. آزمون‌های اجرا شده در عمل (Tests Actually Run)

1. **مجموعه تست‌های واحد (`npx tsx --test tests/logic.test.ts`)**:
   - `SourceValidator: blocks SSRF targets and dangerous hostnames` (پاس شد)
   - `SourceValidator: allows valid public streams` (پاس شد)
   - `HybridFootballAnalysisEngine: fuses evidence and deduplicates repeated events` (پاس شد)
   - `AudioMixerService: schedules timeline and prevents audio collision` (پاس شد)
   - `Security: scrypt salted password hashing and timing-safe verification` (پاس شد)
   - `FFmpegWorkerService & MediaExtractor: probe media and extract real frame` (پاس شد - اعتبارسنجی با FFmpeg و FFprobe واقعی روی فایل آزمایشی ۵ ثانیه‌ای)
2. **کامپایل و بیلد پروداکشن (`npm run build`)**:
   - بیلد کلاینت Vite و باندل سرور با esbuild با موفقیت در ۶۵۹ میلی‌ثانیه بدون خطا انجام شد.
3. **تست و ارزیابی استارتاپ سرور**:
   - بررسی حضور باینری `/usr/bin/ffmpeg` و `/usr/bin/ffprobe` و ایجاد دایرکتوری‌های پایدار داده.

---

## ۳. وضعیت بخش‌های مختلف

| بخش | وضعیت واقعی | توضیحات |
|---|---|---|
| پایگاه داده و امنیت | عملیاتی | Scrypt + سشن کریپتوگرافی + جلوگیری از حمله Brute Force |
| سوپروایزر FFmpeg | عملیاتی | تست شده با فایل محلی؛ استخراج فریم و مشخصات ویدیو فعال |
| توزیع HLS | کنترل شده | عدم انتشار مانیفست تا زمان ایجاد سگمنت واقعی |
| مدل Gemini (متن/تحلیل) | آماده / اتصال برقرار | مدل `gemini-3.8-flash` با پرامپت ساختاریافته فارسی |
| مدل Gemini TTS | پیاده‌سازی شده | تلاش برای مدل رسمی TTS همراه با فال‌بک شفاف در صورت عدم پشتیبانی زبانی |
| استقرار داکر / سرور لینوکس | آماده | `Dockerfile` و `nginx.conf` بازبینی شده با Node 22 |

---

## ۴. گام بعدی برای فردا (Exact Next Action)

- بارگذاری یک فایل ویدیویی واقعی ۱۰ دقیقه‌ای فوتبال توسط ادمین در محیط سرور VPS.
- اجرای پایپلاین کامل استریم زنده همراه با تست همگام‌سازی صدای استادیوم و گزارش روی دو کلاینت همزمان جهت تضمین قطعی عدم تکرار پردازش هوش مصنوعی.
