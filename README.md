# Persian AI SportsCaster (گزارشگر هوشمند فوتبال فارسی)
### Single-Channel, Administrator-Controlled AI Football TV

یک سیستم جامع، تک‌کاناله و اختصاصی پخش زنده فوتبال با هوش مصنوعی چندوجهی، تولید خودکار و هماهنگ گزارش صوتی به زبان فارسی، هماهنگ‌سازی زمانی PTS و توزیع متمرکز استریم HLS برای تمام بینندگان.

---

## ۱. ویژگی‌های کلیدی سامانه

1. **معماری تک‌کاناله متمرکز (Single Shared Output)**:
   - یک خروجی استریم HLS مشترک برای تمامی بینندگان.
   - تعداد بینندگان بر مصرف پهنای‌باند اثرگذار است و هرگز بار پردازشی جدیدی بر هوش مصنوعی، TTS یا FFmpeg تحمیل نمی‌کند.
2. **تلویزیون عمومی تماشاگران (`/`)**:
   - پلیر اختصاصی واکنش‌گرا و سازگار با HLS.js.
   - اسکوربورد زنده با اعداد فارسی، زمان واقعی مسابقه و نشانگر رسمی وضعیت زنده.
   - زیرنویس برخط فارسی گزارش هماهنگ‌شده با ویدیوی مسابقه.
   - وضعیت شفاف آفلاین با پیام رسمی: «در حال حاضر مسابقه‌ای در حال پخش نیست.»
3. **داشبورد اختصاصی و امن مدیر (`/admin`)**:
   - احراز هویت امن با نشست معتبر و ثبت تمام رخدادها در لاگ ممیزی (Audit Log).
   - قفل انحصاری پخش (Exclusive Concurrency Lock) برای جلوگیری از هم‌پوشانی یا شروع خطوط لوله موازی.
   - تنظیم سبک گزارش (پرشور و هیجانی، متوازن و روان، تحلیلی و تاکتیکی).
   - انتخاب پرسونای صوتی گزارشگر و حالت‌های صوتی (AI تنها، AI با داکینگ استادیوم، تفکیک تماشاگران).
   - تنظیم اسلایدر تأخیر هدف زنده (Target Delay: ۱۰ تا ۹۰ ثانیه، پیش‌فرض ۳۰ ثانیه).
4. **موتور تحلیل چندوجهی فوتبال (Hybrid Football Analysis Engine)**:
   - کانال ۱: تحلیل فریم‌های ویدیویی، ساعت بازی و تشخیص صحنه‌های حساس بر اساس زمان‌بندی دقیق PTS.
   - کانال ۲: تحلیل سرنخ‌های صوتی استادیوم، سوت داور و هیاهوی تماشاگران.
   - کانال ۳: تطبیق با متادیتای تایید شده تیم‌ها، ترکیب بازیکنان و جلوگیری قاطع از توهم اطلاعاتی.
   - فیلتر و Deduplication صحنه‌های تکراری در پنجره‌های زمانی.
5. **موتور تولید گزارش فارسی اصیل**:
   - اصطلاحات تخصصی فوتبال ایران (پرس از جلو، ضدحمله، پاس عمقی، فضای پشت دفاع، توپ دوم، انتقال سریع، ارسال خطرناک، شوت سرضرب).
   - اعتبارسنجی ساختار خروجی با کتابخانه Zod.
6. **امنیت و محافظت از منابع**:
   - محافظت پیشرفته در برابر حملات SSRF و فیلتر آدرس‌های شبکه خصوصی.
   - اعتبارسنجی الزامی حقوق پخش قانونی پیش از آغاز استریم.

---

## ۲. راهنمای استقرار مستقل روی سرور مجازی (Ubuntu 24.04+ VPS)

### روش اول: استقرار با Docker Compose (پیشنهادی)

```bash
# ۱. کلون پروژه و ورود به دایرکتوری
cd /opt/persian-ai-sportscaster

# ۲. ایجاد فایل متغیرهای محیطی
cat << 'EOF' > .env
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=your_actual_gemini_api_key_here
EOF

# ۳. اجرای کانتینرها در پس‌زمینه
docker compose up -d --build

# ۴. بررسی لاگ‌ها و سلامت کانتینر
docker compose logs -f
```

### روش دوم: استقرار مستقیم روی هاست لینوکس (Native Systemd)

```bash
# ۱. نصب پکیج‌های پایه و FFmpeg
sudo apt update && sudo apt install -y nodejs npm ffmpeg nginx

# ۲. نصب وابستگی‌ها و بیلد فرانت‌اند
npm install
npm run build

# ۳. تنظیم Nginx به عنوان Reverse Proxy (کپی محتوای nginx.conf به /etc/nginx/sites-available/sportscaster)
sudo ln -s /etc/nginx/sites-available/sportscaster /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# ۴. ایجاد سرویس Systemd برای اجرای مداوم
sudo tee /etc/systemd/system/sportscaster.service > /dev/null << 'EOF'
[Unit]
Description=Persian AI SportsCaster Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/persian-ai-sportscaster
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=GEMINI_API_KEY=your_actual_gemini_api_key_here

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sportscaster
```

---

## ۳. متغیرهای محیطی (`.env`)

| نام متغیر | کاربرد | مقدار پیش‌فرض |
|---|---|---|
| `PORT` | پورت اجرای سرور اکسپرس | `3000` (در پیش‌نمایش) یا `8080` (در داکر) |
| `NODE_ENV` | محیط اجرا (`development` یا `production`) | `development` |
| `GEMINI_API_KEY` | کلید دسترسی به API جمنای برای تحلیل و گزارش | تزریق خودکار توسط استودیو |

---

## ۴. اطلاعات حساب کاربری مدیر پیش‌فرض

- نام کاربری: `admin`
- رمز عبور: `admin123!` (امکان تغییر پس از ورود در پنل مدیریت)
