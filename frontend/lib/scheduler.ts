import type { Episode } from "@/lib/media";

export type ScheduleEntry = {
  episode: Episode;
  start: number;
  end: number;
};

export function buildSchedule(
  episodes: Episode[],
  nowMs: number,
  horizonMs: number,
  anchorMs?: number,
): ScheduleEntry[] {
  if (episodes.length === 0) return [];

  const totalDurationMs = episodes.reduce(
    (sum, ep) => sum + (ep.durationSeconds || 0) * 1000,
    0,
  );
  if (totalDurationMs <= 0) return [];

  const anchor = anchorMs ?? nowMs;
  const positionInLoop =
    (((nowMs - anchor) % totalDurationMs) + totalDurationMs) %
    totalDurationMs;

  let idx = 0;
  let accumulated = 0;
  while (true) {
    const dur = (episodes[idx]?.durationSeconds || 0) * 1000;
    if (positionInLoop < accumulated + dur) break;
    accumulated += dur;
    idx = (idx + 1) % episodes.length;
  }

  const schedule: ScheduleEntry[] = [];
  let start = nowMs - (positionInLoop - accumulated);
  let cursor = idx;

  while (start < nowMs + horizonMs) {
    const episode = episodes[cursor];
    const end = start + (episode.durationSeconds || 0) * 1000;
    schedule.push({ episode, start, end });
    start = end;
    cursor = (cursor + 1) % episodes.length;
  }

  return schedule;
}

export function getLivePointer(
  episodes: Episode[],
  nowMs: number,
  anchorMs?: number,
) {
  if (episodes.length === 0) return null;
  const totalDurationMs = episodes.reduce(
    (sum, ep) => sum + (ep.durationSeconds || 0) * 1000,
    0,
  );
  if (totalDurationMs <= 0) return null;

  const anchor = anchorMs ?? nowMs;
  const positionInLoop =
    (((nowMs - anchor) % totalDurationMs) + totalDurationMs) %
    totalDurationMs;

  let idx = 0;
  let accumulated = 0;
  while (true) {
    const dur = (episodes[idx]?.durationSeconds || 0) * 1000;
    if (positionInLoop < accumulated + dur) {
      return {
        index: idx,
        offsetSeconds: (positionInLoop - accumulated) / 1000,
      };
    }
    accumulated += dur;
    idx = (idx + 1) % episodes.length;
  }
}

export function readableDuration(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
}

export function getMostRecentThreePm(referenceMs: number) {
  const d = new Date(referenceMs);
  d.setHours(15, 0, 0, 0);
  if (d.getTime() > referenceMs) {
    d.setDate(d.getDate() - 1);
  }
  return d.getTime();
}
