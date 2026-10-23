import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ChannelInfo, CommentarySegment } from '../../types';
import { Volume2, VolumeX, Maximize2, Minimize2, Radio, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { toPersianDigits } from './MatchScoreboard';

interface PublicPlayerProps {
  channel: ChannelInfo;
  activeCommentary?: CommentarySegment | null;
}

export const PublicPlayer: React.FC<PublicPlayerProps> = ({ channel, activeCommentary }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Animated tactical field simulation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.03;
      const w = canvas.width;
      const h = canvas.height;

      // Dark lush grass gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(0.5, '#047857');
      grad.addColorStop(1, '#064e3b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Pitch lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 4;

      // Outer boundary
      ctx.strokeRect(40, 40, w - 80, h - 80);

      // Halfway line & center circle
      ctx.beginPath();
      ctx.moveTo(w / 2, 40);
      ctx.lineTo(w / 2, h - 40);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
      ctx.stroke();

      // Penalty boxes
      ctx.strokeRect(40, h / 2 - 120, 140, 240);
      ctx.strokeRect(w - 180, h / 2 - 120, 140, 240);

      // Moving Players: Home (Red)
      for (let i = 0; i < 5; i++) {
        const px = w * 0.35 + Math.sin(t + i) * 60;
        const py = 120 + i * 90 + Math.cos(t * 0.8 + i) * 30;
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Moving Players: Away (Blue)
      for (let i = 0; i < 5; i++) {
        const px = w * 0.65 + Math.cos(t + i) * 60;
        const py = 120 + i * 90 + Math.sin(t * 0.8 + i) * 30;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Ball (White & Gold)
      const bx = w / 2 + Math.sin(t * 1.5) * 180;
      const by = h / 2 + Math.cos(t * 1.2) * 120;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Initialize HLS or direct video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    const mediaUrl = channel.source?.url || channel.hlsUrl;

    if (Hls.isSupported() && mediaUrl.endsWith('.m3u8')) {
      hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        enableWorker: true,
      });

      hls.loadSource(mediaUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay policy might require muted initially
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              setHasError(true);
              break;
          }
        }
      });
    } else {
      // Native MP4 / Direct stream playback
      video.src = mediaUrl;
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [channel.source?.url, channel.hlsUrl]);

  // Handle Persian AI Commentary audio playback & ducking
  useEffect(() => {
    if (activeCommentary?.audioUrl && audioRef.current) {
      audioRef.current.src = activeCommentary.audioUrl;
      audioRef.current.volume = isMuted ? 0 : volume;

      // Duck video audio if ducking mode is active
      if (videoRef.current) {
        videoRef.current.volume = isMuted ? 0 : volume * 0.3; // duck background to 30%
      }

      audioRef.current
        .play()
        .then(() => {
          // When commentary audio finishes, restore background volume
          if (audioRef.current) {
            audioRef.current.onended = () => {
              if (videoRef.current) {
                videoRef.current.volume = isMuted ? 0 : volume;
              }
            };
          }
        })
        .catch(() => {});
    }
  }, [activeCommentary, isMuted, volume]);

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (audioRef.current) audioRef.current.muted = nextMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (audioRef.current) audioRef.current.volume = val;
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group select-none"
    >
      {/* Base Canvas Tactical Pitch Simulation */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-cover absolute inset-0 z-0"
      />

      <video
        ref={videoRef}
        playsInline
        className={`w-full h-full object-cover relative z-10 transition-opacity duration-500 ${
          isPlaying && !hasError ? 'opacity-100' : 'opacity-0'
        }`}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onError={() => setHasError(true)}
      />

      {/* Hidden audio element for synchronous Persian TTS commentary */}
      <audio ref={audioRef} playsInline />

      {/* Live Badge Overlay (Top Right in RTL) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="flex items-center gap-1.5 bg-rose-600/90 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          زنده
        </span>
        <span className="bg-slate-900/80 text-emerald-400 border border-emerald-500/30 text-[11px] px-2.5 py-1 rounded-full backdrop-blur-md font-sans tabular-nums font-bold flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse" />
          HLS ۷۲۰p
        </span>
      </div>

      {/* Synchronized Persian Commentary Subtitle Overlay */}
      {activeCommentary && (
        <div className="absolute bottom-16 inset-x-4 md:inset-x-12 z-20 pointer-events-none transition-all">
          <div className="bg-slate-950/85 border border-emerald-500/40 text-white p-3 md:p-4 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-emerald-400">
                  {channel.commentatorVoice}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  PTS: {toPersianDigits(activeCommentary.sourceMediaTargetPts.toFixed(1))}s
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold text-slate-100 leading-relaxed">
                {activeCommentary.persianText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Player Controls Bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'فعال کردن صدا' : 'قطع صدا'}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="تنظیم بلندی صدا"
            className="w-16 md:w-24 accent-emerald-500 cursor-pointer"
          />

          <span className="text-[11px] text-slate-300 font-sans tabular-nums hidden sm:inline-block">
            PTS: {toPersianDigits(channel.currentPts.toFixed(0))} ثانیه
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-900/90 border border-slate-700/60 px-2.5 py-1 rounded-xl text-slate-300 font-medium">
            تأخیر زنده: {toPersianDigits(channel.targetLiveDelaySeconds)} ثانیه
          </span>

          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'خروج از تمام‌صفحه' : 'حالت تمام‌صفحه'}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
