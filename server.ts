import express from 'express';
import path from 'path';
import fs from 'fs';
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

// Dynamic HLS endpoint (/live/index.m3u8)
app.get('/live/index.m3u8', (_req, res) => {
  const broadcastManager = BroadcastManager.getInstance();
  const status = broadcastManager.getStatus();
  const pts = status.broadcast?.currentPts || 0;
  const playlist = FFmpegWorkerService.getOrCreatePlaylist(pts);

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(playlist);
});

// API routes
app.use('/api/v1', apiRouter);

async function startServer() {
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

startServer().catch((err) => {
  console.error('[AI SportsCaster] Fatal startup error:', err);
  process.exit(1);
});
