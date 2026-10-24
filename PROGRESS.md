# وضعیت پیشرفت پروژه گزارشگر هوشمند فوتبال فارسی (PROGRESS.md)

تاریخ آخرین بازبینی: ۲۴ اکتبر ۲۰۲۶  
وضعیت نسخه: **Release Candidate (v4) - Hardened & Ready for VPS Smoke Test**

---

## ۱. موارد تکمیل و سخت‌سازی شده در نسخه کاندید انتشار (Release Candidate Hardening)

- **حذف قطعی داده‌های جعلی و پایبندی به صداقت داده‌ها (P0.A Honesty Gate)**:
  - حذف کامل بلوک فال‌بک شوت ساختگی (`shot` با اطمینان 0.9 و توضیحات تخیلی) در `PipelineCoordinatorService`.
  - در صورت نبود رویداد در بازه زمانی، وضعیت شفاف `NO_EVENT` بدون درج هرگونه رویداد در پایگاه داده بازگردانده می‌شود.
- **اعتبارسنجی استریم صدا و شفافیت وضعیت گزارش (P0.B Audio Verification)**:
  - لزوم تایید فایل صوتی و استریم با `ffprobe` قبل از گزارش `SUCCESS_WITH_AUDIO`.
  - در صورت عدم سنتز یا نبود کلید، وضعیت به عنوان `TTS_UNAVAILABLE` یا `PARTIAL` گزارش شده و هرگز موفقیت صوتی کاذب اعلام نمی‌شود.
- **قفل همزمانی ادمین و یکتایی رکوردها (P0.C Concurrency & Idempotency)**:
  - پیاده‌سازی Mutex Lock در `PipelineCoordinatorService` جهت جلوگیری از تداخل جاب‌های سنگین ادمین با آزادسازی تضمین‌شده در `finally`.
  - برطرف‌سازی باگ درج تکراری قطعات گزارش در دیتابیس (`addCommentarySegment`).
- **مدیریت خطای تیم‌ها و مسابقه فعال (P0.D Active Match Safety)**:
  - عدم کرش سامانه در صورت خالی بودن جدول مسابقات یا تیم‌ها با مقداردهی ایمن و مقادیر پشتیبان.
- **همگام‌سازی زمانی گزارش نسبت به ابتدای کلیپ (P0.E Offset Clamping)**:
  - محاسبه افست زمانی PTS نسبت به مبدأ کلیپ (`Math.max(0, eventPts - startPts)`) و محدودسازی به سقف مدت زمان ویدیو.
- **تحویل امن فایل‌های رندر شده با پشتیبانی از HTTP Range (P1.F Media Delivery)**:
  - اندپوینت اختصاصی و امن `/rendered/:filename` با اعتبارسنجی Canonical Realpath جهت مسدودسازی کامل Path Traversal.
  - پشتیبانی کامل از هدر Range (کد وضعیت ۲۰۶ Partial Content) برای قابلیت Seek و پخش روان در تمام مرورگرها.
- **مدیریت ویدیوهای فاقد صدا و داکینگ هوشمند استادیوم (P1.G Offline Render Hardening)**:
  - بررسی هوشمند حضور استریم صدا با FFprobe.
  - در صورت نبود استریم صدا در منبع، تزریق خودکار منبع سکوت (`anullsrc`) برای تولید MP4 معتبر و استاندارد.
  - اعمال داکینگ فقط در بازه‌های زمانی ادای جملات گزارشگر (`between(t,start,end)` volume filter)، حفظ کامل صدای استادیوم در مابقی ثانیه‌ها و افزودن فلگ `+faststart` برای استریم سریع.
- **اندپوینت سلامت تفکیک‌شده (P2.M Health Subsystem)**:
  - اندپوینت `/api/v1/health` با گزارش تفکیکی وضعیت FFmpeg، FFprobe، و تفکیک حالت `configured` از `unconfigured` برای Gemini API بدون ساخت معیارهای ساختگی.
- **اسناد استقرار و بنچمارک اوبونتو (P4 Documentation)**:
  - نگارش راهنمای عملیاتی و گام‌به‌گام استقرار در `docs/VPS_INSTALL_UBUNTU.md`.
  - نگارش تحلیل تخصصی مقایسه سرور انگلیس و ایران و بررسی شتاب‌دهنده گرافیکی در `docs/VPS_SIZING_BENCHMARK.md`.
  - ایجاد ماتریس جامع دروازه‌های انتشار در `RELEASE_GATE.md`.

---

## ۲. نتایج آزمون‌های واقعی اجرا شده (Verified Tests)

1. **تست‌های منطق و امنیت (`NODE_ENV=test node --import tsx --test tests/logic.test.ts`)**:
   - **۷ آزمون از ۷ آزمون موفق (100% PASS)**: مسدودسازی SSRF، استریم مجاز، جلوگیری از Traversal، فیوژن شواهد، زمان‌بندی بدون تداخل، امنیت Scrypt و استخراج فریم FFmpeg.
2. **تست‌های یکپارچگی خط لوله رسانه (`NODE_ENV=test node --import tsx --test tests/pipeline.test.ts`)**:
   - **۸ آزمون از ۸ آزمون موفق (100% PASS)**:
     - `MediaExtractorService detects triggers and extracts temporal frames`
     - `PersianTTSProvider RIFF header synthesis and ffprobe duration`
     - `OfflineRenderService mixes audio with timed ducking and PTS delay`
     - `OfflineRenderService handles source video with NO audio stream (P1.G)`
     - `P0.A Honesty Gate: Quiet clip does NOT fabricate a fake shot or goal event`
     - `P0.C Concurrency Gate: Simultaneous job requests are cleanly rejected by mutex`
     - `P1.F & HTTP Range Gate: /rendered/:filename serves MP4 with Range 206 and blocks traversal`
     - `P2.M Health Gate: /api/v1/health returns verified subsystem metrics`
3. **اعتبارسنجی نوع‌ها و کامپایل (`npm run lint`)**:
   - **۰ خطا**: `tsc --noEmit` بدون هیچ‌گونه خطای تایپ اسکریپت با موفقیت خاتمه یافت.
4. **بیلد پروداکشن کلاینت و باندل سرور (`npm run build`)**:
   - موفق در کمتر از ۱ ثانیه (`dist/server.js` با حجم ۱۳۳ کیلوبایت).
5. **اجرای سرور در محیط پروداکشن (`dist/server.js`)**:
   - تایید سلامت استارت، بررسی پیش‌نیازها و پاسخگویی به `/api/v1/health`.

---

## ۳. موارد ارزیابی‌نشده / موکول‌شده به فاز آینده (Deferred & Unverified)

- **پخش زنده پیوسته ۹۰ دقیقه‌ای مسابقه**: طبق محدوده پرامپت فاز ۳ و کاندید انتشار، تمرکز بر پایداری پردازش جاب‌های نمونه ۲۰ تا ۶۰ ثانیه‌ای است و پخش پیوسته ۹۰ دقیقه‌ای در فازهای آتی ارزیابی خواهد شد.
- **تفکیک وکال استادیوم با شتاب‌دهنده محلی (GPU Demucs)**: موکول به سرورهای مجهز به کارت گرافیک.
