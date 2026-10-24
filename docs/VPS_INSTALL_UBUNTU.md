# راهنمای جامع راه‌اندازی و استقرار Persian AI SportsCaster بر روی اوبونتو (VPS Ubuntu 24.04 / 26.04)

این مستند شامل دستورات گام‌به‌گام و امن جهت راه‌اندازی نسخه ریلیز (Release Candidate) سامانه گزارشگر هوشمند فارسی بر روی یک سرور مجازی لینوکس خام (Ubuntu 24.04 LTS / 26.04) با استفاده از Docker Compose و Nginx به عنوان Reverse Proxy مجهز به SSL/TLS می‌باشد.

---

## ۱. الزامات حداقلی سرور (Preflight & Hardware Requirements)

| مؤلفه | حداقل سخت‌افزار (تست نمونه و ۲ بیننده) | سخت‌افزار پیشنهادی (۱۰ تا ۵۰ بیننده) |
|---|---|---|
| **سیستم‌عامل** | Ubuntu 24.04 LTS (x86_64) | Ubuntu 24.04 / 26.04 LTS (x86_64) |
| **پردازنده (CPU)** | ۲ هسته اختصاصی (2 vCPU) | ۴ هسته اختصاصی (4 vCPU) |
| **رم (RAM)** | ۲ گیگابایت + ۲ گیگابایت Swap | ۴ تا ۸ گیگابایت |
| **دیسک (Storage)** | ۲۰ گیگابایت NVMe SSD | ۵۰ گیگابایت NVMe SSD |
| **پورت‌های شبکه** | پورت‌های 80 (HTTP) و 443 (HTTPS) | پورت‌های 80 و 443 |

### بررسی اولیه مشخصات سرور:
```bash
# بررسی منابع CPU، RAM و فضای دیسک
nproc
free -h
df -h /

# بررسی وضعیت پورت‌های آزاد
sudo ss -tulpn | grep -E ':(80|443|8080)'
```

---

## ۲. نصب رسمی Docker Engine و Docker Compose Plugin

جهت اطمینان از عملکرد صحیح کانتینر Node 22 و ماژول‌های FFmpeg، از مخزن رسمی داکر استفاده نمایید:

```bash
# ۱. به‌روزرسانی بسته‌ها و نصب پیش‌نیازها
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# ۲. افزودن کلید رسمی GPG داکر
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# ۳. تنظیم مخزن پایدار داکر
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# ۴. نصب Docker Engine و افزونه docker-compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ۵. فعال‌سازی سرویس داکر
sudo systemctl enable --now docker
docker --version
docker compose version
```

---

## ۳. کلون مخزن و پیکربندی متغیرهای محیطی (.env)

```bash
# دریافت کد پروژه در دایرکتوری اختصاصی
cd /opt
sudo git clone https://github.com/your-username/persian-ai-sportscaster.git
cd persian-ai-sportscaster
sudo chown -R $USER:$USER /opt/persian-ai-sportscaster

# ایجاد فایل متغیرهای محیطی از نمونه
cp .env.example .env
chmod 600 .env
```

فایل `.env` را با ویرایشگر باز کرده و مقادیر واقعی را قرار دهید:
```bash
nano .env
```

محتوای نمونه در `.env`:
```env
NODE_ENV=production
PORT=8080
BIND_IP=127.0.0.1

# کلید اختصاصی Google Gemini API (مدل gemini-3.8-flash و TTS)
GEMINI_API_KEY="AIzaSyYourActualSecretKeyHere"
GEMINI_TTS_MODEL="gemini-2.5-flash-preview-tts"

# آدرس پایه برنامه برای استریم و کلاینت
APP_URL="https://YOUR_DOMAIN_OR_SERVER_IP"
```

> **هشدار امنیتی:** مقدار `BIND_IP=127.0.0.1` در `docker-compose.yml` تضمین می‌کند پورت داخلی ۸۰۸۰ و پنل ادمین مستقیماً روی اینترنت باز نبوده و تنها از پشت Reverse Proxy امن Nginx در دسترس قرار می‌گیرد.

---

## ۴. ساخت و اجرای کانتینرها (Build & Up)

```bash
# ساخت ایمیج چندمرحله‌ای (شامل FFmpeg و باندل بهینه‌شده Node 22)
docker compose build --no-cache

# اجرای سرویس در پس‌زمینه
docker compose up -d

# مشاهده وضعیت سلامت کانتینر
docker compose ps
```

بررسی لاگ‌های سیستمی و سلامت اولیه:
```bash
docker compose logs -f --tail=50
```

تست پاسخگویی سلامت از طریق خط فرمان سرور:
```bash
curl -s http://127.0.0.1:8080/api/v1/health | jq .
```
خروجی باید وضعیت `status: "ok"`، شناسایی `ffmpeg: true` و `gemini: "configured"` را نمایش دهد.

---

## ۵. انتقال کلیپ آزمایشی مجاز (Test Clip Placement)

یک کلیپ فوتبال مجاز بین ۲۰ تا ۶۰ ثانیه‌ای با فرمت MP4 را در پوشه `data/uploads` قرار دهید:

```bash
# ایجاد دایرکتوری داده‌های آپلود شده در صورت نیاز
mkdir -p data/uploads data/rendered data/tts_cache

# کپی کلیپ نمونه (مثال: sample_derby.mp4)
cp /path/to/authorized_clip.mp4 data/uploads/sample_derby.mp4
chmod 644 data/uploads/sample_derby.mp4

# اعتبارسنجی مشخصات کلیپ با ffprobe روی سرور
docker compose exec sportscaster ffprobe -v quiet -print_format json -show_format -show_streams /app/data/uploads/sample_derby.mp4 | jq .format.duration
```

---

## ۶. اجرای فرآیند یکپارچه نمونه توسط ادمین (Admin Sample Job)

کلیه پردازش‌های هوش مصنوعی و میکس FFmpeg تحت کنترل و احراز هویت ادمین انجام می‌شوند:

### گام اول: ثبت مدیر اصلی (تنها یک‌بار در راه‌اندازی نخست)
```bash
curl -X POST http://127.0.0.1:8080/api/v1/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourSuperSecurePassword123!"}'
```

### گام دوم: ورود و دریافت توکن نشست ۲۵۶ بیتی امن
```bash
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourSuperSecurePassword123!"}' | jq -r .token)

echo "توکن احراز هویت ادمین: $ADMIN_TOKEN"
```

### گام سوم: فراخوانی جاب یکپارچه (Pipeline Sample Job)
```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/pipeline/run-sample-job \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "/app/data/uploads/sample_derby.mp4",
    "startPts": 0,
    "durationSeconds": 30,
    "commentaryStyle": "energetic",
    "voicePersona": "پژمان (گزارشگر رسمی)",
    "duckingLevel": 0.35,
    "outputFormat": "mp4"
  }' | jq .
```

### گام چهارم: اعتبارسنجی خروجی رندر شده و تست Range Request
```bash
# دریافت آدرس فایل رندر شده از فیلد outputUrl خروجی فوق (مثلاً /rendered/mix_1792834631609.mp4)
RENDERED_URL="http://127.0.0.1:8080/rendered/mix_SAMPLE.mp4"

# تست درخواست تکه‌ای (Range 206) برای قابلیت Seek و پخش روان در پلیر ویدیو:
curl -I -H "Range: bytes=0-1024" "$RENDERED_URL"
```
پاسخ سرور باید شامل هدرهای زیر باشد:
- `HTTP/1.1 206 Partial Content`
- `Accept-Ranges: bytes`
- `Content-Type: video/mp4`
- `Content-Range: bytes 0-1024/...`

---

## ۷. راه‌اندازی Nginx به عنوان Reverse Proxy مجهز به SSL/TLS (HTTPS)

هیچ‌گاه پنل مدیریت را بر روی پروتکل ناامن HTTP در بستر اینترنت منتشر نکنید.

```bash
# نصب Nginx و Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

ایجاد فایل پیکربندی `/etc/nginx/sites-available/sportscaster`:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.COM;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }
}
```

فعال‌سازی و دریافت گواهی رایگان Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/sportscaster /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# دریافت گواهینامه SSL
sudo certbot --nginx -d YOUR_DOMAIN.COM
```

---

## ۸. دستورات مانیتورینگ، توقف و پشتیبان‌گیری (Operations Runbook)

### مشاهده میزان مصرف منابع زنده سرور:
```bash
# مانیتورینگ منابع پردازنده و رم کانتینر
docker stats --no-stream

# مشاهده مصرف پهنای باند شبکه
sudo iftop -i eth0
```

### بازنشانی و راه‌اندازی مجدد سرویس (Restart / Update):
```bash
# توقف ایمن
docker compose down

# به‌روزرسانی کد و راه‌اندازی مجدد
git pull origin main
docker compose build
docker compose up -d
```

### پشتیبان‌گیری از دیتابیس و داده‌ها:
```bash
# تهیه فایل فشرده از کلیپ‌ها و لاگ‌ها
tar -czvf backup_sportscaster_$(date +%F).tar.gz data/
```

---

## ۹. عیب‌یابی مشکلات رایج (Troubleshooting)

1. **خطای پورت ۸۰۸۰ در حال استفاده است (`port already allocated`)**:
   - با دستور `sudo ss -tulpn | grep 8080` پروسس اشغال‌کننده را بیابید و متوقف کنید، یا در `.env` متغیر `PORT=8081` را تنظیم نمایید.
2. **خطای عدم دسترسی به دایرکتوری داده (`Permission Denied`)**:
   - دسترسی پوشه‌ها را اصلاح کنید: `sudo chmod -R 775 data/ public/live`.
3. **خطای سهمیه یا مدل Gemini (`API quota exhausted / model unavailable`)**:
   - سامانه به صورت خودکار به وضعیت شفاف `PENDING_EXTERNAL_TEST` یا `TTS_UNAVAILABLE` وارد می‌شود. در این حالت هیچ رویداد جعلی تولید نشده و گزارش صوتی فیک ثبت نمی‌شود. کلید جدید را در `.env` درج کرده و کانتینر را مجدداً با `docker compose restart` راه‌اندازی کنید.
4. **خطای همزمانی پردازش ادمین (`Concurrency Lock Active`)**:
   - سامانه به گونه‌ای ایمن طراحی شده که از پردازش همزمان دو جاب سنگین FFmpeg جلوگیری کند. پس از پایان کار فعلی، قفل در بلوک `finally` به صورت خودکار آزاد می‌شود.
