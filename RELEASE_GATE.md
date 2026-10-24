# ماتریس ارزیابی دروازه‌های انتشار (RELEASE_GATE.md)

تاریخ ارزیابی: ۲۴ اکتبر ۲۰۲۶  
وضعیت نهایی انتشار: **READY FOR UBUNTU VPS SMOKE TEST** (آماده برای تست آزمایشی روی سرور اوبونتو)

---

## ۱. جدول وضعیت دروازه‌های انتشار (Release Gates Matrix)

| کد دروازه | موضوع و آزمون | وضعیت | دستور اجرایی جهت راستی‌آزمایی | خروجی واقعی / خلاصه لاگ |
|---|---|:---:|---|---|
| **GATE-01 (P0.A)** | **عدم جعل رویداد یا شوت فیک در کلیپ‌های آرام** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 5 - P0.A Honesty Gate: Quiet clip does NOT fabricate a fake shot or goal event` (بازگشت وضعیت `NO_EVENT`، بدون ثبت رویداد جعلی شوت در دیتابیس) |
| **GATE-02 (P0.B)** | **شفافیت وضعیت و اعتبارسنجی استریم صدا با FFprobe** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | تایید وضعیت صوتی با FFprobe؛ در صورت نبود صدا، وضعیت شفاف `TTS_UNAVAILABLE` یا `NO_EVENT` اعلام می‌شود. |
| **GATE-03 (P0.C)** | **قفل همزمانی ادمین و جلوگیری از درج تکراری در دیتابیس** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 6 - P0.C Concurrency Gate: Simultaneous job requests are cleanly rejected by mutex` (رد درخواست همزمان دوم با خطای ۴۰۹ و آزادسازی قفل در `finally`) |
| **GATE-04 (P0.D)** | **مدیریت امن مسابقه فعال و تیم‌ها بدون کرش دیتابیس** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | در صورت خالی بودن دیتابیس یا نبود تیم‌ها، سیستم کرش نکرده و با متادیتای پیش‌فرض ایمن پاسخ می‌دهد. |
| **GATE-05 (P0.E)** | **همگام‌سازی زمانی گزارش نسبت به ابتدای کلیپ (Offset Clamping)** | **PASS** | `NODE_ENV=test node --import tsx --test tests/logic.test.ts` | برچسب زمانی PTS گزارشگر نسبت به تایم‌لاین کلیپ تراز شده و از سقف مدت زمان کلیپ فراتر نمی‌رود. |
| **GATE-06 (P1.F)** | **تحویل امن ویدیو با پشتیبانی از HTTP Range (Seek در پلیر)** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 7 - P1.F & HTTP Range Gate: /rendered/:filename serves MP4 with Range 206 and blocks traversal` (درخواست بایت ۰-۹۹ با کد ۲۰۶ و Content-Range معتبر پاسخ داده شد) |
| **GATE-07 (P1.G)** | **پشتیبانی از ویدیوی فاقد صدا و داکینگ هوشمند استادیوم** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 4 - Pipeline: OfflineRenderService handles source video with NO audio stream (P1.G)` (تزریق `anullsrc` و میکس موفق قطعات صوتی) |
| **GATE-08 (P1.H)** | **هدر استاندارد RIFF/WAV برای خروجی صوتی Gemini TTS** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 2 - Pipeline: PersianTTSProvider RIFF header synthesis and ffprobe duration` (هدر ۴۴ بایتی، ۲۴ کیلوهرتز ۱۶ بیت و تأیید طول صوت با FFprobe) |
| **GATE-09 (P2.K)** | **کامپایل و بیلد بدون خطای تایپ و اجرای موفق سرور پروداکشن** | **PASS** | `npm run lint && npm run build` | بیلد موفق کلاینت در ۶۳۲ میلی‌ثانیه و باندل سرور در ۱۵ میلی‌ثانیه با خروجی `dist/server.js`. اجرای آزمایشی روی پورت موقت با کد ۲۰۰ پاسخ داد. |
| **GATE-10 (P2.L)** | **تنظیمات ایزولاسیون Dockerfile و .dockerignore** | **PASS** | بازبینی کدهای `Dockerfile` و `docker-compose.yml` | ساخت دایرکتوری‌های پایدار `uploads`، `rendered`، `tts_cache`؛ اتصال امن `127.0.0.1:8080:8080`؛ پاک‌سازی فایل‌های حساس با `.dockerignore`. |
| **GATE-11 (P2.M)** | **اندپوینت سلامت تفکیک‌شده (`/api/v1/health`)** | **PASS** | `NODE_ENV=test node --import tsx --test tests/pipeline.test.ts` | `ok 8 - P2.M Health Gate: /api/v1/health returns verified subsystem metrics` (گزارش شفاف حضور FFmpeg/ffprobe و وضعیت کانفیگ Gemini بدون جعل متریک). |
| **GATE-12 (P1.J)** | **پخش زنده پیوسته ۹۰ دقیقه‌ای (Continuous Live 90-min Streaming)** | **UNVERIFIED** | به فاز بعدی موکول شده است (طبق دستور صریح پرامپت) | جریان زنده پیوسته ۹۰ دقیقه‌ای تست نشده و دامنه این فاز محدود به یک جاب نمونه پایانه‌به‌پایانه ۲۰-۶۰ ثانیه‌ای است. |
| **GATE-13** | **تفکیک صدای محلی استادیوم با شتاب‌دهنده گرافیکی (GPU Demucs)** | **UNVERIFIED** | به فاز بعدی موکول شده است | تفکیک وکال استادیوم روی CPU انجام نشده و نیاز به سرور اختصاصی مجهز به GPU در فازهای آتی دارد. |

---

## ۲. خلاصه نتایج آزمون‌های واقعی اجرا شده

- **تست‌های واحد و منطق (`tests/logic.test.ts`)**: ۷ آزمون از ۷ آزمون پاس شد (**7/7 PASS**).
- **تست‌های یکپارچگی خط لوله رسانه (`tests/pipeline.test.ts`)**: ۸ آزمون از ۸ آزمون پاس شد (**8/8 PASS**).
- **بررسی صحت تایپ‌ها و عدم وجود خطای کامپایل (`npm run lint`)**: **۰ خطا** (`tsc --noEmit` با موفقیت خاتمه یافت).
- **بیلد تولیدی (`npm run build`)**: بدون خطا (**Done**).
- **تست راه‌اندازی سرور پروداکشن (`dist/server.js`)**: تایید استارت بدون tsx و پاسخگویی به `/api/v1/health`.
