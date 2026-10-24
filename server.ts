import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import apiRouter from './server/apiRouter.ts';
import { FFmpegWorkerService } from './server/services/ffmpegWorker.ts';
import { BroadcastManager } from './server/services/broadcastManager.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve audio tts cache
const ttsCacheDir = path.resolve(process.cwd(), 'data', 'tts_cache');
if (!fs.existsSync(ttsCacheDir)) fs.mkdirSync(ttsCacheDir, { recursive: true });
app.use('/api/v1/audio', express.static(ttsCacheDir, {
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

// Serve uploads
const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Securely serve finished rendered MP4 outputs with HTTP Range support (P1.F)
const renderedDir = path.resolve(process.cwd(), 'data', 'rendered');
if (!fs.existsSync(renderedDir)) fs.mkdirSync(renderedDir, { recursive: true });

app.get('/rendered/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const targetPath = path.join(renderedDir, safeFilename);

  if (!fs.existsSync(targetPath)) {
    res.status(404).json({ error: 'فایل ویدیویی یافت نشد.' });
    return;
  }

  let canonicalPath: string;
  let canonicalRenderedDir: string;
  try {
    canonicalPath = fs.realpathSync(targetPath);
    canonicalRenderedDir = fs.realpathSync(renderedDir);
  } catch {
    res.status(404).json({ error: 'خطا در ارزیابی مسیر فایل.' });
    return;
  }

  if (!canonicalPath.startsWith(canonicalRenderedDir)) {
    res.status(403).json({ error: 'دسترسی غیرمجاز به فایل.' });
    return;
  }

  const stat = fs.statSync(canonicalPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(canonicalPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(canonicalPath).pipe(res);
  }
});

// Real HLS endpoint: strictly serve files from disk only when FFmpeg outputs them
const hlsLiveDir = path.resolve(process.cwd(), 'public', 'live');
if (!fs.existsSync(hlsLiveDir)) fs.mkdirSync(hlsLiveDir, { recursive: true });

app.use('/live', express.static(hlsLiveDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'max-age=10');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  },
}));

// API routes
app.use('/api/v1', apiRouter);

function checkSystemPrerequisites(): { ffmpegReady: boolean; geminiReady: boolean } {
  let ffmpegReady = false;
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpegReady = true;
  } catch {
    ffmpegReady = false;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const geminiReady = !!(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  console.log('[STARTUP CHECK] Environment verification:');
  console.log(`  - FFmpeg binary: ${ffmpegReady ? 'INSTALLED (/usr/bin/ffmpeg)' : 'MISSING (VPS required)'}`);
  console.log(`  - Gemini API key: ${geminiReady ? 'CONFIGURED' : 'NOT CONFIGURED (Fallback mode)'}`);
  console.log(`  - Uploads dir: ${uploadsDir}`);
  console.log(`  - HLS Live dir: ${hlsLiveDir}`);

  return { ffmpegReady, geminiReady };
}

async function startServer() {
  checkSystemPrerequisites();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI SportsCaster] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[AI SportsCaster] Public TV: http://localhost:${PORT}/`);
    console.log(`[AI SportsCaster] Admin Dashboard: http://localhost:${PORT}/admin`);
  });
}

export { app, startServer };

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[AI SportsCaster] Fatal startup error:', err);
    process.exit(1);
  });
}
