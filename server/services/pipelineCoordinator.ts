import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../db/database.ts';
import { MediaExtractorService } from './mediaExtractor.ts';
import { PersianCommentaryEngine } from './persianCommentaryEngine.ts';
import { PersianTTSProvider } from './ttsProvider.ts';
import { OfflineRenderService, OfflineRenderJobResult } from './offlineRenderService.ts';
import { FFmpegWorkerService } from './ffmpegWorker.ts';
import { SourceValidator } from './sourceValidator.ts';
import { DetectedEvent, CommentarySegment, CommentaryStyle } from '../types.ts';

export interface BoundedPipelineJobParams {
  videoPath?: string;
  startPts?: number;
  durationSeconds?: number;
  commentaryStyle?: CommentaryStyle;
  voicePersona?: string;
  duckingLevel?: number;
  outputFormat?: 'hls' | 'mp4';
}

export type PipelineJobStage =
  | 'SUCCESS_WITH_AUDIO'
  | 'PARTIAL'
  | 'TTS_UNAVAILABLE'
  | 'NO_EVENT'
  | 'FAILED'
  | 'COMPLETED'; // backwards-compatible alias

export interface BoundedPipelineJobResult {
  success: boolean;
  jobId: string;
  stage: PipelineJobStage;
  sourceVideo: {
    path: string;
    exists: boolean;
    durationSeconds?: number;
  };
  analysis: {
    modelUsed?: string;
    status: 'COMPLETED' | 'PENDING_EXTERNAL_TEST' | 'FAILED' | 'NO_EVENT';
    triggersDetectedCount: number;
    extractedFramesCount: number;
    latencyMs: number;
    tokensConsumed?: number;
  };
  event?: DetectedEvent;
  commentary?: CommentarySegment;
  tts: {
    audioUrl?: string;
    durationSeconds?: number;
    status: string;
    provider: string;
  };
  render: OfflineRenderJobResult;
  totalLatencyMs: number;
  errorMessage?: string;
}

export class PipelineCoordinatorService {
  private static instance: PipelineCoordinatorService;
  private static isJobRunning = false;

  private db: AppDatabase;
  private mediaExtractor: MediaExtractorService;
  private commentaryEngine: PersianCommentaryEngine;
  private ttsProvider: PersianTTSProvider;
  private renderService: OfflineRenderService;

  private constructor() {
    this.db = AppDatabase.getInstance();
    this.mediaExtractor = MediaExtractorService.getInstance();
    this.commentaryEngine = new PersianCommentaryEngine();
    this.ttsProvider = new PersianTTSProvider();
    this.renderService = OfflineRenderService.getInstance();
  }

  public static getInstance(): PipelineCoordinatorService {
    if (!PipelineCoordinatorService.instance) {
      PipelineCoordinatorService.instance = new PipelineCoordinatorService();
    }
    return PipelineCoordinatorService.instance;
  }

  /**
   * Checks whether a pipeline job is currently executing
   */
  public static isRunning(): boolean {
    return PipelineCoordinatorService.isJobRunning;
  }

  /**
   * Executes a bounded end-to-end processing pipeline on a sample video clip:
   * 1. Path validation & safety check (canonical realpath & duration check)
   * 2. Concurrency protection (mutex lock released in finally)
   * 3. Multimodal candidate moments and temporal frame analysis (NO fake shot fallback)
   * 4. Persian commentary generation (relative clip timeline alignment)
   * 5. Genuine Persian TTS synthesis (WAV with RIFF header & ffprobe verification)
   * 6. Synchronized timeline audio mix render (with silent audio fallback & ducking)
   */
  public async runBoundedPipelineJob(params: BoundedPipelineJobParams = {}): Promise<BoundedPipelineJobResult> {
    const startTime = Date.now();
    const jobId = `job_${Date.now()}`;

    // Concurrency protection: reject simultaneous jobs (P0.C)
    if (PipelineCoordinatorService.isJobRunning) {
      return {
        success: false,
        jobId,
        stage: 'FAILED',
        sourceVideo: { path: params.videoPath || '', exists: false },
        analysis: { status: 'FAILED', triggersDetectedCount: 0, extractedFramesCount: 0, latencyMs: 0 },
        tts: { status: 'failed', provider: 'none' },
        render: {
          success: false,
          outputPath: '',
          outputUrl: '',
          isHls: params.outputFormat === 'hls',
          mixedCommentaryCount: 0,
          latencyMs: 0,
          errorMessage: 'یک عملیات پردازش هم‌اکنون در حال اجرا است. لطفاً تا اتمام پردازش منتظر بمانید.',
        },
        totalLatencyMs: Date.now() - startTime,
        errorMessage: 'یک عملیات پردازش دیگر در حال اجرا است (قفل همزمانی فعال است).',
      };
    }

    PipelineCoordinatorService.isJobRunning = true;

    try {
      const {
        startPts = 0,
        durationSeconds = 10,
        commentaryStyle = 'energetic',
        voicePersona = 'پژمان (گزارشگر رسمی)',
        duckingLevel = 0.35,
        outputFormat = 'mp4',
      } = params;

      // 1. Resolve and validate input video file path (P1.I)
      let candidatePath = params.videoPath;
      if (!candidatePath) {
        const sources = this.db.getMediaSources();
        const firstMp4 = sources.find((s) => s.type === 'mp4_upload' || s.url.endsWith('.mp4'));
        if (firstMp4) {
          if (firstMp4.url.startsWith('/uploads/')) {
            candidatePath = path.resolve(process.cwd(), 'data', 'uploads', path.basename(firstMp4.url));
          } else {
            candidatePath = firstMp4.url;
          }
        } else {
          candidatePath = path.resolve(process.cwd(), 'data', 'test_clip.mp4');
        }
      } else if (candidatePath.startsWith('/uploads/')) {
        candidatePath = path.resolve(process.cwd(), 'data', 'uploads', path.basename(candidatePath));
      }

      const pathValidation = SourceValidator.validateLocalMediaPath(candidatePath);
      if (!pathValidation.isValid || !pathValidation.sanitizedPath) {
        return {
          success: false,
          jobId,
          stage: 'FAILED',
          sourceVideo: { path: candidatePath, exists: false },
          analysis: { status: 'FAILED', triggersDetectedCount: 0, extractedFramesCount: 0, latencyMs: 0 },
          tts: { status: 'failed', provider: 'none' },
          render: {
            success: false,
            outputPath: '',
            outputUrl: '',
            isHls: outputFormat === 'hls',
            mixedCommentaryCount: 0,
            latencyMs: 0,
            errorMessage: pathValidation.error || 'مسیر فایل نامعتبر است.',
          },
          totalLatencyMs: Date.now() - startTime,
          errorMessage: pathValidation.error || 'مسیر فایل نامعتبر است.',
        };
      }

      const videoPath = pathValidation.sanitizedPath;
      if (!fs.existsSync(videoPath)) {
        return {
          success: false,
          jobId,
          stage: 'FAILED',
          sourceVideo: { path: videoPath, exists: false },
          analysis: { status: 'FAILED', triggersDetectedCount: 0, extractedFramesCount: 0, latencyMs: 0 },
          tts: { status: 'failed', provider: 'none' },
          render: {
            success: false,
            outputPath: '',
            outputUrl: '',
            isHls: outputFormat === 'hls',
            mixedCommentaryCount: 0,
            latencyMs: 0,
            errorMessage: `فایل ویدیویی در مسیر ${videoPath} یافت نشد.`,
          },
          totalLatencyMs: Date.now() - startTime,
          errorMessage: `فایل ویدیویی در مسیر ${videoPath} یافت نشد.`,
        };
      }

      // Validate requested start/duration against media ffprobe duration (P0.E)
      const sourceProbe = await FFmpegWorkerService.probeMedia(videoPath);
      const videoDuration = sourceProbe?.durationSeconds || 0;
      if (videoDuration > 0 && startPts >= videoDuration) {
        return {
          success: false,
          jobId,
          stage: 'FAILED',
          sourceVideo: { path: videoPath, exists: true, durationSeconds: videoDuration },
          analysis: { status: 'FAILED', triggersDetectedCount: 0, extractedFramesCount: 0, latencyMs: 0 },
          tts: { status: 'failed', provider: 'none' },
          render: {
            success: false,
            outputPath: '',
            outputUrl: '',
            isHls: outputFormat === 'hls',
            mixedCommentaryCount: 0,
            latencyMs: 0,
            errorMessage: `زمان شروع (${startPts} ثانیه) از کل مدت زمان ویدیو (${videoDuration} ثانیه) فراتر است.`,
          },
          totalLatencyMs: Date.now() - startTime,
          errorMessage: `زمان شروع (${startPts} ثانیه) از کل مدت زمان ویدیو (${videoDuration} ثانیه) فراتر است.`,
        };
      }

      // Safe match & teams retrieval (P0.D)
      const matches = this.db.getMatches();
      const activeMatch = matches.length > 0 ? matches[0] : null;
      const homeTeam = activeMatch ? this.db.getTeamById(activeMatch.homeTeamId) : null;
      const awayTeam = activeMatch ? this.db.getTeamById(activeMatch.awayTeamId) : null;

      // 2. Multimodal candidate moments & temporal frame analysis
      const analysisResult = await this.mediaExtractor.analyzeSampleJob({
        videoPath,
        startPts,
        durationSeconds,
        matchId: activeMatch?.id,
      });

      const event = analysisResult.event;
      let commentary = analysisResult.commentary;

      // P0.A: REMOVE FAKE FALLBACK SHOT!
      // If no event was detected, report honest NO_EVENT status with zero fabricated events.
      if (!event) {
        return {
          success: true,
          jobId,
          stage: 'NO_EVENT',
          sourceVideo: { path: videoPath, exists: true, durationSeconds: videoDuration },
          analysis: {
            modelUsed: analysisResult.modelUsed,
            status: 'NO_EVENT',
            triggersDetectedCount: analysisResult.detectedTriggers?.length || 0,
            extractedFramesCount: analysisResult.extractedFramesCount || 0,
            latencyMs: analysisResult.latencyMs,
            tokensConsumed: analysisResult.tokensConsumed,
          },
          event: undefined,
          commentary: undefined,
          tts: {
            status: 'not_requested',
            provider: 'none',
          },
          render: {
            success: false,
            outputPath: '',
            outputUrl: '',
            isHls: outputFormat === 'hls',
            mixedCommentaryCount: 0,
            latencyMs: 0,
            errorMessage: 'هیچ رویداد حساس یا مهم فوتبالی در این بخش از ویدیو شناسایی نشد.',
          },
          totalLatencyMs: Date.now() - startTime,
          errorMessage: 'هیچ رویداد فوتبالی در این بازه شناسایی نشد (رویداد ساختگی اضافه نشد).',
        };
      }

      // Align commentary delay relative to clip start timeline (P0.E)
      // Clamped to >= 0 and within clip duration
      const rawRelativeOffset = event.sourceTimestampPts - startPts;
      const relativeOffsetPts = Math.min(
        Math.max(0, rawRelativeOffset),
        Math.max(0, durationSeconds - 2.0)
      );

      // 3. Persian Commentary generation (if not already generated by analysis)
      if (!commentary && activeMatch && homeTeam && awayTeam) {
        commentary = await this.commentaryEngine.generateCommentary({
          event,
          match: activeMatch,
          homeTeam,
          awayTeam,
          style: commentaryStyle,
          voicePersona,
          currentPts: relativeOffsetPts,
        });
      }

      if (commentary) {
        commentary.sourceMediaTargetPts = relativeOffsetPts;
      }

      // 4. Real TTS Synthesis (creates genuine WAV with 44-byte RIFF header or honest TEXT_ONLY)
      let audioAsset: { audioUrl?: string; durationSeconds?: number; status: string; provider: string } = {
        status: 'not_requested',
        provider: 'none',
      };

      if (commentary) {
        const synthesized = await this.ttsProvider.synthesize(commentary, voicePersona);
        audioAsset = synthesized;
        commentary.audioUrl = synthesized.audioUrl;
        // P0.C: Add commentary segment to DB ONCE (fixed duplicate insertion bug)
        this.db.addCommentarySegment(commentary);
      }

      // 5. Synchronized Audio Timeline Mixing & Rendering (adelay + amix + ducking)
      const renderSegments = commentary ? [commentary] : [];
      const renderResult = await this.renderService.renderSynchronizedOutput({
        sourcePath: videoPath,
        commentarySegments: renderSegments,
        outputFormat,
        duckingLevel,
      });

      // P0.B: Determine honest stage status based on verified TTS and audio mixing
      let finalStage: PipelineJobStage;
      if (!renderResult.success) {
        finalStage = 'FAILED';
      } else if (
        audioAsset.status === 'generated' &&
        audioAsset.audioUrl &&
        renderResult.mixedCommentaryCount > 0 &&
        renderResult.probeResult?.hasAudio
      ) {
        finalStage = 'SUCCESS_WITH_AUDIO';
      } else if (audioAsset.status === 'failed' || !audioAsset.audioUrl || audioAsset.provider === 'mock_synth') {
        finalStage = 'TTS_UNAVAILABLE';
      } else {
        finalStage = 'PARTIAL';
      }

      this.db.addAuditLog({
        adminId: 'admin_master_1',
        action: 'PIPELINE_SAMPLE_JOB',
        details: `پردازش خط لوله نمونه: وضعیت ${finalStage} در ${Date.now() - startTime} میلی‌ثانیه برای فایل ${path.basename(videoPath)}`,
        ipAddress: '127.0.0.1',
      });

      return {
        success: renderResult.success,
        jobId,
        stage: finalStage,
        sourceVideo: { path: videoPath, exists: true, durationSeconds: videoDuration },
        analysis: {
          modelUsed: analysisResult.modelUsed,
          status: analysisResult.status,
          triggersDetectedCount: analysisResult.detectedTriggers?.length || 0,
          extractedFramesCount: analysisResult.extractedFramesCount || 0,
          latencyMs: analysisResult.latencyMs,
          tokensConsumed: analysisResult.tokensConsumed,
        },
        event,
        commentary,
        tts: {
          audioUrl: audioAsset.audioUrl,
          durationSeconds: audioAsset.durationSeconds,
          status: audioAsset.status,
          provider: audioAsset.provider,
        },
        render: renderResult,
        totalLatencyMs: Date.now() - startTime,
      };
    } finally {
      // Guaranteed release of concurrency lock (P0.C)
      PipelineCoordinatorService.isJobRunning = false;
    }
  }
}
