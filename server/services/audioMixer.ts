import { CommentarySegment } from '../types.ts';

export interface ScheduledSpeech {
  segment: CommentarySegment;
  startPts: number;
  endPts: number;
  duckLevel: number; // 0.0 to 1.0 (e.g. 0.25 = duck background by 75%)
}

export class AudioMixerService {
  /**
   * Schedules commentary segments along the authoritative PTS timeline.
   * Resolves overlaps by giving precedence to higher priority events or shifting start time.
   */
  public static scheduleTimeline(
    segments: CommentarySegment[],
    minSpacingSeconds = 1.0
  ): ScheduledSpeech[] {
    const sorted = [...segments].sort((a, b) => a.sourceMediaTargetPts - b.sourceMediaTargetPts);
    const scheduled: ScheduledSpeech[] = [];

    for (const segment of sorted) {
      let proposedStart = segment.sourceMediaTargetPts;
      const duration = segment.estimatedDurationSeconds;

      if (scheduled.length > 0) {
        const last = scheduled[scheduled.length - 1];
        if (proposedStart < last.endPts + minSpacingSeconds) {
          // Overlap detected
          if (segment.priority === 'critical' && last.segment.priority !== 'critical') {
            // Preempt previous non-critical speech
            last.endPts = Math.max(last.startPts + 1.0, proposedStart - 0.5);
          } else {
            // Shift current speech forward
            proposedStart = last.endPts + minSpacingSeconds;
          }
        }
      }

      const duckLevel = segment.intensity === 'explosive' ? 0.15 : segment.intensity === 'high' ? 0.25 : 0.4;

      scheduled.push({
        segment,
        startPts: Number(proposedStart.toFixed(2)),
        endPts: Number((proposedStart + duration).toFixed(2)),
        duckLevel,
      });
    }

    return scheduled;
  }

  /**
   * Returns current ducking multiplier at given PTS time
   */
  public static getDuckingAtPts(pts: number, scheduled: ScheduledSpeech[]): number {
    const active = scheduled.find((s) => pts >= s.startPts && pts <= s.endPts);
    if (!active) return 1.0; // Normal background volume
    return active.duckLevel;
  }
}
