import { DetectedEvent, EventType, Match, Team } from '../types.ts';

export interface AnalysisEvidenceInput {
  matchId: string;
  sourceTimestampPts: number;
  videoClues?: {
    detectedScoreboard?: { home: number; away: number; clockSeconds?: number };
    visibleAction?: EventType;
    teamColorInvolved?: string;
    motionIntensity?: number; // 0.0 - 1.0
  };
  audioClues?: {
    crowdVolumeSpike?: boolean;
    whistleDetected?: boolean;
    extractedKeywords?: string[]; // e.g. ["Goal", "Corner", "Al Kasir", "Foul"]
  };
  verifiedMetadata: {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
    recentConfirmedEvents: DetectedEvent[];
  };
}

export class HybridFootballAnalysisEngine {
  // Event deduplication window: if the same event type occurs within 8 seconds, deduplicate or merge
  private static DEDUPLICATION_WINDOW_SECONDS = 8.0;

  /**
   * Fuses Video, Audio, and Verified Metadata evidence channels
   */
  public static fuseEvidence(input: AnalysisEvidenceInput): DetectedEvent | null {
    const { sourceTimestampPts, matchId, videoClues, audioClues, verifiedMetadata } = input;
    const evidenceSources: ('video_frames' | 'audio_clues' | 'verified_metadata')[] = [];

    let candidateType: EventType | null = null;
    let confidence = 0.5;
    let playerName: string | undefined;
    let teamId: string | undefined;
    let factualDescriptionFa = '';
    let tacticalNotesFa = '';

    // 1. Video Channel evaluation
    if (videoClues && videoClues.visibleAction) {
      evidenceSources.push('video_frames');
      candidateType = videoClues.visibleAction;
      confidence += 0.2;

      if (videoClues.motionIntensity && videoClues.motionIntensity > 0.75) {
        confidence += 0.1;
      }
    }

    // 2. Audio Channel evaluation
    if (audioClues) {
      if (audioClues.crowdVolumeSpike || audioClues.whistleDetected || (audioClues.extractedKeywords && audioClues.extractedKeywords.length > 0)) {
        evidenceSources.push('audio_clues');
        confidence += 0.15;
      }

      if (audioClues.whistleDetected && candidateType === 'foul') {
        confidence += 0.1;
      }
    }

    // 3. Verified Metadata Cross-check
    if (candidateType) {
      evidenceSources.push('verified_metadata');
      const allRoster = [
        ...verifiedMetadata.homeTeam.roster.map((p) => ({ ...p, teamId: verifiedMetadata.homeTeam.id })),
        ...verifiedMetadata.awayTeam.roster.map((p) => ({ ...p, teamId: verifiedMetadata.awayTeam.id })),
      ];

      // Match player from audio keywords if present
      if (audioClues?.extractedKeywords) {
        for (const kw of audioClues.extractedKeywords) {
          const matchPlayer = allRoster.find(
            (p) => p.nameFa.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(p.nameFa.toLowerCase())
          );
          if (matchPlayer) {
            playerName = matchPlayer.nameFa;
            teamId = matchPlayer.teamId;
            confidence += 0.1;
            break;
          }
        }
      }
    }

    if (!candidateType) {
      // Background play / tactical progression
      candidateType = 'tactical_move';
      confidence = 0.7;
      evidenceSources.push('video_frames', 'verified_metadata');
      factualDescriptionFa = `گردش توپ در میانه میدان توسط بازیکنان ${verifiedMetadata.homeTeam.nameFa}`;
      tacticalNotesFa = 'حفظ مالکیت و محک زدن ساختار دفاعی حریف';
    } else {
      factualDescriptionFa = this.buildDescription(candidateType, playerName, teamId, verifiedMetadata);
    }

    confidence = Math.min(1.0, Math.max(0.1, confidence));

    // High consequence events require high confidence
    const requiresHighConfidence = ['goal', 'penalty', 'red_card'].includes(candidateType);
    let verificationStatus: 'verified' | 'suspected' | 'rejected' = 'verified';

    if (requiresHighConfidence && confidence < 0.85) {
      verificationStatus = 'suspected';
    }

    const event: DetectedEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      matchId,
      sourceTimestampPts,
      type: candidateType,
      teamId,
      playerName,
      confidence: Number(confidence.toFixed(2)),
      evidenceSources,
      verificationStatus,
      factualDescriptionFa,
      tacticalNotesFa,
      createdAt: new Date().toISOString(),
    };

    // Deduplication check
    const isDuplicate = this.checkDeduplication(event, verifiedMetadata.recentConfirmedEvents);
    if (isDuplicate) {
      return null;
    }

    return event;
  }

  private static checkDeduplication(event: DetectedEvent, recentEvents: DetectedEvent[]): boolean {
    return recentEvents.some((existing) => {
      const timeDiff = Math.abs(existing.sourceTimestampPts - event.sourceTimestampPts);
      return existing.type === event.type && timeDiff < this.DEDUPLICATION_WINDOW_SECONDS;
    });
  }

  private static buildDescription(
    type: EventType,
    playerName: string | undefined,
    teamId: string | undefined,
    meta: AnalysisEvidenceInput['verifiedMetadata']
  ): string {
    const teamName = teamId === meta.homeTeam.id ? meta.homeTeam.nameFa : teamId === meta.awayTeam.id ? meta.awayTeam.nameFa : '';
    const playerPrefix = playerName ? `توسط ${playerName}` : '';
    const teamPrefix = teamName ? `تیم ${teamName}` : '';

    switch (type) {
      case 'goal':
        return `گل تایید شده برای ${teamPrefix} ${playerPrefix}`;
      case 'shot':
        return `شوت به سمت دروازه ${playerPrefix} ${teamPrefix}`;
      case 'save':
        return `مهار دیدنی دروازه‌بان در برابر ضربه حریف`;
      case 'corner':
        return `کرنر اعلام شده به سود ${teamPrefix}`;
      case 'yellow_card':
        return `کارت زرد داور به بازیکن ${teamPrefix}`;
      case 'red_card':
        return `کارت قرمز مستقیم داور به بازیکن ${teamPrefix}`;
      case 'penalty':
        return `خطای پنالتی اعلام شده به نفع ${teamPrefix}`;
      case 'foul':
        return `خطا در میانه میدان به نفع ${teamPrefix}`;
      default:
        return `رویداد فنی در بازی بین ${meta.homeTeam.nameFa} و ${meta.awayTeam.nameFa}`;
    }
  }
}
