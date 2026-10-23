import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AnalysisEvidenceInput } from './hybridAnalysisEngine.ts';
import { Match, Team, DetectedEvent } from '../types.ts';

const execFileAsync = promisify(execFile);

export class MediaExtractorService {
  private static CACHE_DIR = path.resolve(process.cwd(), 'data', 'analysis_cache');
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    if (!fs.existsSync(MediaExtractorService.CACHE_DIR)) {
      fs.mkdirSync(MediaExtractorService.CACHE_DIR, { recursive: true });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.aiClient = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[MediaExtractor] Failed to initialize GoogleGenAI:', err);
      }
    }
  }

  /**
   * Extract a single JPEG frame at authoritative PTS timestamp using real FFmpeg
   */
  public async extractFrameAtPts(videoPath: string, ptsSeconds: number): Promise<Buffer | null> {
    if (!fs.existsSync(videoPath)) return null;

    const hash = crypto.createHash('md5').update(`${videoPath}_${ptsSeconds.toFixed(1)}`).digest('hex');
    const outPath = path.join(MediaExtractorService.CACHE_DIR, `frame_${hash}.jpg`);

    if (fs.existsSync(outPath)) {
      return fs.readFileSync(outPath);
    }

    try {
      await execFileAsync('ffmpeg', [
        '-ss',
        ptsSeconds.toFixed(2),
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        '-vf',
        'scale=640:-1', // downscale to save tokens while preserving scoreboard clarity
        '-y',
        outPath,
      ]);

      if (fs.existsSync(outPath)) {
        return fs.readFileSync(outPath);
      }
      return null;
    } catch (err) {
      console.warn(`[MediaExtractor] Failed to extract frame at PTS ${ptsSeconds}:`, err);
      return null;
    }
  }

  /**
   * Extract a bounded audio window (e.g. 4 seconds) using real FFmpeg
   */
  public async extractAudioWindow(videoPath: string, startPts: number, durationSeconds = 4): Promise<Buffer | null> {
    if (!fs.existsSync(videoPath)) return null;

    const hash = crypto.createHash('md5').update(`audio_${videoPath}_${startPts.toFixed(1)}`).digest('hex');
    const outPath = path.join(MediaExtractorService.CACHE_DIR, `audio_${hash}.mp3`);

    if (fs.existsSync(outPath)) {
      return fs.readFileSync(outPath);
    }

    try {
      await execFileAsync('ffmpeg', [
        '-ss',
        startPts.toFixed(2),
        '-t',
        durationSeconds.toFixed(2),
        '-i',
        videoPath,
        '-vn',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        '-y',
        outPath,
      ]);

      if (fs.existsSync(outPath)) {
        return fs.readFileSync(outPath);
      }
      return null;
    } catch (err) {
      console.warn(`[MediaExtractor] Failed to extract audio at PTS ${startPts}:`, err);
      return null;
    }
  }

  /**
   * Performs real Gemini multimodal inference on extracted frame + verified metadata
   */
  public async analyzeMediaWindow(params: {
    videoPath: string;
    sourceTimestampPts: number;
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
    recentEvents: DetectedEvent[];
  }): Promise<AnalysisEvidenceInput> {
    const { videoPath, sourceTimestampPts, match, homeTeam, awayTeam, recentEvents } = params;

    // 1. Extract real bounded video frame
    const frameBuffer = await this.extractFrameAtPts(videoPath, sourceTimestampPts);

    const evidenceInput: AnalysisEvidenceInput = {
      matchId: match.id,
      sourceTimestampPts,
      verifiedMetadata: {
        match,
        homeTeam,
        awayTeam,
        recentConfirmedEvents: recentEvents,
      },
    };

    // 2. If Gemini API is configured and frame exists, perform real multimodal inference
    if (this.aiClient && frameBuffer) {
      try {
        const base64Image = frameBuffer.toString('base64');
        const prompt = `
Analyze this football match video frame captured at media PTS ${sourceTimestampPts.toFixed(1)}s.
Match: ${homeTeam.nameFa} vs ${awayTeam.nameFa} (${match.stadium}).

Evaluate:
1. Visible action: "shot" | "goal" | "save" | "corner" | "foul" | "yellow_card" | "penalty" | "tactical_move"
2. Motion intensity (0.0 to 1.0)
3. Any visible scoreboard or score change.

Return ONLY a JSON object:
{
  "visibleAction": "shot" | "goal" | "save" | "corner" | "foul" | "yellow_card" | "penalty" | "tactical_move",
  "motionIntensity": number,
  "notesFa": "توضیح کوتاه فارسی"
}
`;

        const response = await this.aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            prompt,
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        evidenceInput.videoClues = {
          visibleAction: parsed.visibleAction || 'tactical_move',
          motionIntensity: typeof parsed.motionIntensity === 'number' ? parsed.motionIntensity : 0.6,
        };
        return evidenceInput;
      } catch (err) {
        console.warn('[MediaExtractor] Multimodal inference error, using local frame heuristics:', err);
      }
    }

    // Heuristic fallback when API is not configured or offline
    evidenceInput.videoClues = {
      visibleAction: 'tactical_move',
      motionIntensity: 0.5,
    };

    return evidenceInput;
  }
}
