// utils/streak.ts -- Shared streak computation
import { differenceInHours } from 'date-fns';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string | null;
  streakAtRisk: boolean;
  hoursUntilBreak: number;
  streakTrackerId: string | null;
}

export function computeStreak(
  entries: Array<{ timestamp: number; trackerId?: string; isDeleted?: boolean }>,
  trackerId?: string
): StreakData {
  const now = new Date();
  const filtered = trackerId
    ? entries.filter((e) => e.trackerId === trackerId && !e.isDeleted)
    : entries.filter((e) => !e.isDeleted);

  const days = new Set(
    filtered.map((e) => new Date(e.timestamp).toISOString().split('T')[0])
  );

  let current = 0;
  let longest = 0;
  let temp = 0;

  for (let i = 0; i < 365; i++) {
    const check = new Date(now);
    check.setDate(check.getDate() - i);
    const key = check.toISOString().split('T')[0];
    if (days.has(key)) {
      temp++;
      longest = Math.max(longest, temp);
      if (i === 0) current = temp;
    } else {
      if (i === 0) current = 0;
      temp = 0;
    }
  }

  const lastEntry = filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
  const lastActivity = lastEntry ? new Date(lastEntry.timestamp).toISOString() : null;

  let streakAtRisk = false;
  let hoursUntilBreak = 0;
  if (lastActivity) {
    const hoursSince = differenceInHours(now, new Date(lastActivity));
    if (hoursSince > 20 && current > 0) {
      streakAtRisk = true;
      hoursUntilBreak = Math.max(0, 24 - hoursSince);
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    lastActivity,
    streakAtRisk,
    hoursUntilBreak,
    streakTrackerId: trackerId || null,
  };
}