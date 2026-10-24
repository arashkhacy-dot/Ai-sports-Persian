import { GoogleGenAI } from '@google/genai';
import { CommentarySegment, CommentarySegmentSchema, CommentaryStyle, DetectedEvent, Match, Team } from '../types.ts';

export class PersianCommentaryEngine {
  private aiClient: GoogleGenAI | null = null;
  public totalTokensConsumed = 0;
  public lastLatencyMs = 0;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.aiClient = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[Gemini] Failed to init client, falling back to local engine:', err);
      }
    }
  }

  public async generateCommentary(params: {
    event: DetectedEvent;
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
    style: CommentaryStyle;
    voicePersona: string;
    currentPts: number;
  }): Promise<CommentarySegment> {
    const startTime = Date.now();
    const { event, match, homeTeam, awayTeam, style, currentPts } = params;

    // Target PTS timestamp synchronizes with the event timestamp
    const targetPts = Math.max(currentPts, event.sourceTimestampPts + 0.5);

    if (this.aiClient) {
      try {
        const prompt = `
نقش شما: گزارشگر ارشد و حرفه‌ای فوتبال ایران.
وظیفه: تولید تک‌جمله یا دو جمله گزارش زنده فارسی فوتبال برای صحنه زیر، با رعایت دقیق لحن، اصطلاحات فنی فوتبال ایران و زمان‌بندی PTS.

مشخصات مسابقه:
- تیم میزبان: ${homeTeam.nameFa} (${match.homeScore})
- تیم میهمان: ${awayTeam.nameFa} (${match.awayScore})
- زمان مسابقه: دقیقه ${Math.floor(match.matchClock / 60)}
- رویداد رخ داده: ${event.type}
- شرح صحنه: ${event.factualDescriptionFa}
- یادداشت تاکتیکی: ${event.tacticalNotesFa || 'ندارد'}
- سبک گزارش انتخابی ادمین: ${style === 'energetic' ? 'پرانرژی و پرهیجان' : style === 'analytical' ? 'تحلیلی و تاکتیکی دقیق' : 'متوازن و روان'}

اصطلاحات مجاز و توصیه شده:
پرس از جلو، ضدحمله سریع، پاس عمقی، فضای پشت دفاع، توپ دوم، انتقال سریع، ارسال خطرناک، شوت سرضرب، مهار استثنایی، ساختار دفاعی.

قوانین الزامی:
1. زبان کاملاً فارسی روان و اصیل گزارشگری ایران (بدون ترجمه تحت‌اللفظی یا لغات ساختگی).
2. هرگز نتیجه یا گل ساختگی اعلام نکنید؛ واقعیت مسابقه بر هیجان مقدم است.
3. خروجی فقط یک شیء JSON با ساختار معتبر زیر باشد:
{
  "persianText": "متن گزارش به زبان فارسی",
  "priority": "low" | "medium" | "high" | "critical",
  "intensity": "calm" | "moderate" | "high" | "explosive",
  "emotion": "analytical" | "excited" | "dramatic" | "tense" | "cheering",
  "estimatedDurationSeconds": عدد اعشاری تخمینی زمان خواندن متن بین 3 تا 10 ثانیه
}
`;

        const timeoutMs = process.env.NODE_ENV === 'test' ? 1000 : 5000;
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`AI commentary timeout (${timeoutMs}ms)`)), timeoutMs);
          timer.unref();
        });
        const response = await Promise.race([
          this.aiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          }),
          timeoutPromise,
        ]).finally(() => clearTimeout(timer));

        this.lastLatencyMs = Date.now() - startTime;
        if (response.usageMetadata?.totalTokenCount) {
          this.totalTokensConsumed += response.usageMetadata.totalTokenCount;
        }

        const parsed = JSON.parse(response.text || '{}');
        const candidate = {
          id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          linkedEventId: event.id,
          persianText: parsed.persianText || this.buildFallbackText(event, homeTeam, awayTeam, style),
          sourceMediaTargetPts: targetPts,
          priority: parsed.priority || 'high',
          intensity: parsed.intensity || 'moderate',
          emotion: parsed.emotion || 'excited',
          estimatedDurationSeconds: parsed.estimatedDurationSeconds || 5.0,
          confidence: event.confidence,
          evidenceReferences: event.evidenceSources,
          delivered: false,
        };

        const validated = CommentarySegmentSchema.parse(candidate);
        return validated;
      } catch (err) {
        console.warn('[Gemini API] Call failed or timed out, using Iranian football fallback engine:', err);
      }
    }

    // Built-in intelligent Persian football commentary fallback generator
    this.lastLatencyMs = Date.now() - startTime;
    return this.generateIranianFallbackCommentary(event, homeTeam, awayTeam, style, targetPts);
  }

  private generateIranianFallbackCommentary(
    event: DetectedEvent,
    homeTeam: Team,
    awayTeam: Team,
    style: CommentaryStyle,
    targetPts: number
  ): CommentarySegment {
    const text = this.buildFallbackText(event, homeTeam, awayTeam, style);
    let intensity: 'calm' | 'moderate' | 'high' | 'explosive' = 'moderate';
    let emotion: 'analytical' | 'excited' | 'dramatic' | 'tense' | 'cheering' = 'excited';
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (event.type === 'goal') {
      intensity = 'explosive';
      emotion = 'cheering';
      priority = 'critical';
    } else if (event.type === 'shot' || event.type === 'penalty') {
      intensity = 'high';
      emotion = 'dramatic';
      priority = 'high';
    } else if (style === 'analytical') {
      intensity = 'calm';
      emotion = 'analytical';
      priority = 'medium';
    }

    // Approx 2.5 Persian words per second
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = Math.max(3.5, Math.min(10.0, wordCount / 2.5));

    return {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      linkedEventId: event.id,
      persianText: text,
      sourceMediaTargetPts: targetPts,
      priority,
      intensity,
      emotion,
      estimatedDurationSeconds: Number(estimatedDuration.toFixed(1)),
      confidence: event.confidence,
      evidenceReferences: event.evidenceSources,
      delivered: false,
    };
  }

  private buildFallbackText(event: DetectedEvent, homeTeam: Team, awayTeam: Team, style: CommentaryStyle): string {
    const playerPart = event.playerName ? `توسط ${event.playerName}` : '';
    const teamPart = event.teamId === homeTeam.id ? homeTeam.nameFa : event.teamId === awayTeam.id ? awayTeam.nameFa : '';

    switch (event.type) {
      case 'goal':
        return style === 'energetic'
          ? `گلللللل! توی دروازه! یک گل فوق‌العاده دیدنی ${playerPart} برای ${teamPart}! استادیوم منفجر می‌شه!`
          : style === 'analytical'
          ? `گل برای ${teamPart}. استفاده عالی از فضای پشت دفاع حریف و ضربه دقیق ${playerPart} که ساختار دفاعی رو به هم ریخت.`
          : `توی دروازه! گل دیدنی برای ${teamPart} با ضربه تماشایی ${playerPart}.`;

      case 'shot':
        return style === 'energetic'
          ? `فرصت برای شوت‌زنی... ضربه سرضرب و خطرناک ${playerPart} که با بدشانسی مهار شد!`
          : style === 'analytical'
          ? `شوت هدفمند ${playerPart}. توپ دوم رو به خوبی در اختیار گرفتن و اقدام به شوت‌زنی ناگهانی کردند.`
          : `شوت مستقیم به سمت چارچوب که نفس‌ها رو در سینه حبس کرد.`;

      case 'save':
        return `واکنش استثنایی و تماشایی سنگربان! یک مهار نجات‌بخش با جاگیری فوق‌العاده.`;

      case 'corner':
        return `کرنر برای ${teamPart}. ارسال خطرناک روی تیر اول می‌تونه موقعیت‌ساز باشه.`;

      case 'yellow_card':
        return `داور مسابقه دست به جیب شد؛ کارت زرد برای توقف ضدحمله سریع حریف.`;

      case 'kickoff':
        return `بازی با سوت داور در ورزشگاه آغاز می‌شه. تقابل دو تیمی که برای سه امتیاز تمام توانشون رو به کار می‌گیرند.`;

      case 'tactical_move':
      default:
        return style === 'analytical'
          ? `پرس از جلو و بستن کانال‌های نفوذ؛ ${homeTeam.nameFa} در تلاش برای انتقال سریع توپ به فاز هجومی هست.`
          : `گردش مداوم توپ در میانه زمین و نبردهای تن‌به‌تن برای تصاحب توپ دوم.`;
    }
  }
}
