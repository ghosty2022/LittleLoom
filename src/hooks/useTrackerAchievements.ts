/**
 * useTrackerAchievements — The bridge hook that aggregates ALL growth intelligence
 * sources into the achievement format the UI expects.
 *
 * Sources consumed:
 *   - useTracker (entries, stats, streaks)
 *   - useGrowthIntelligence (growth scores, milestones, readiness)
 *   - usePredictiveReminders (smart reminders → achievement triggers)
 *   - useTimelineCorrelations (cross-tracker patterns)
 *   - BabyContext (baby profile, age, growth data)
 *
 * Target: AchievementsScreen (replaces useActivity + BabyContext direct calls)
 */

import {
  differenceInHours,
  differenceInDays,
  isSameDay,
  subDays,
  format,
  addHours,
  addDays,
} from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIX: Import directly from context sources to avoid circular deps
import { useTracker } from './useTrackerContext';
import { useBaby } from '@/context/BabyContext';
import { useGrowthIntelligence } from './useGrowthIntelligence';
import { usePredictiveReminders, PredictiveReminder } from './usePredictiveReminders';

/* ───────────────────────────────────────────────────────────────
   TYPES — Aligned with AchievementsScreen expectations
   ─────────────────────────────────────────────────────────────── */

export type AchievementCategory =
  | 'milestone'
  | 'streak'
  | 'tracking'
  | 'social'
  | 'special'
  | 'care'
  | 'health'
  | 'growth'
  | 'predictive';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  /** When this achievement was first unlocked (for "NEW" badges) */
  unlockedAt?: number;
  /** Correlated tracker IDs that feed into this achievement */
  sourceTrackers?: string[];
  /** Human-readable summary of how this was earned */
  earnedSummary?: string;
  /** Predictive reminder that triggered this (if applicable) */
  triggeredByReminder?: PredictiveReminder;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string | null;
  streakAtRisk: boolean;
  hoursUntilBreak: number;
  /** Which tracker is driving the current streak */
  streakTrackerId: string | null;
}

export interface AchievementStats {
  total: number;
  unlocked: number;
  progress: number; // 0-100
  totalPoints: number;
  legendary: number;
  epic: number;
  rare: number;
  common: number;
  byCategory: {
    category: AchievementCategory;
    label: string;
    icon: string;
    color: string;
    unlocked: number;
    total: number;
  }[];
}

export interface TrackerAchievementSummary {
  achievements: Achievement[];
  stats: AchievementStats;
  streak: StreakData;
  newlyUnlocked: string[];
  /** Growth score from useGrowthIntelligence */
  growthScore: ReturnType<typeof useGrowthIntelligence>['growthIndex'] | null;
  /** Predictive reminders that could become achievements */
  pendingReminders: PredictiveReminder[];
  /** Whether data is still loading */
  isLoading: boolean;
  /** Refresh all achievement data */
  refresh: () => void;
  /** Mark predictive achievement as unlocked */
  unlockPredictive: (reminderId: string) => Promise<void>;
}

/* ───────────────────────────────────────────────────────────────
   CONSTANTS
   ─────────────────────────────────────────────────────────────── */

const ACHIEVEMENTS_UNLOCKED_KEY = '@littleloom_achievements_unlocked_v2';
const ACHIEVEMENTS_UNLOCKED_AT_KEY = '@littleloom_achievements_unlocked_at';

const RARITY_POINTS: Record<AchievementRarity, number> = {
  common: 50,
  rare: 200,
  epic: 500,
  legendary: 1000,
};

const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string; color: string }> = {
  milestone: { label: 'Milestones', icon: 'trophy', color: '#f59e0b' },
  streak: { label: 'Streaks', icon: 'flame', color: '#ef4444' },
  tracking: { label: 'Tracking', icon: 'analytics', color: '#3b82f6' },
  social: { label: 'Social', icon: 'people', color: '#10b981' },
  special: { label: 'Special', icon: 'star', color: '#8b5cf6' },
  care: { label: 'Care', icon: 'heart', color: '#ec4899' },
  health: { label: 'Health', icon: 'medical', color: '#06b6d4' },
  growth: { label: 'Growth', icon: 'trending-up', color: '#43e97b' },
  predictive: { label: 'Smart Insights', icon: 'bulb', color: '#f472b6' },
};

/* ───────────────────────────────────────────────────────────────
   STREAK ENGINE
   ─────────────────────────────────────────────────────────────── */

const computeStreak = (entries: any[], trackerId?: string): StreakData => {
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
};

/* ───────────────────────────────────────────────────────────────
   MAIN HOOK
   ─────────────────────────────────────────────────────────────── */

export const useTrackerAchievements = (): TrackerAchievementSummary => {
  // FIX: Use safe wrappers to prevent crashes during context initialization
  const tracker = useTracker();
  const baby = useBaby();
  const { growthIndex } = useGrowthIntelligence();
  const { reminders: predictiveReminders } = usePredictiveReminders();

  const [unlockedHistory, setUnlockedHistory] = useState<Set<string>>(new Set());
  const [unlockedAtMap, setUnlockedAtMap] = useState<Record<string, number>>({});
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  /* ── Load persisted unlocked history ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [savedIds, savedAt] = await Promise.all([
          AsyncStorage.getItem(ACHIEVEMENTS_UNLOCKED_KEY),
          AsyncStorage.getItem(ACHIEVEMENTS_UNLOCKED_AT_KEY),
        ]);
        if (savedIds) setUnlockedHistory(new Set(JSON.parse(savedIds)));
        if (savedAt) setUnlockedAtMap(JSON.parse(savedAt));
      } catch (e) {
        console.warn('Failed to load achievement history:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  /* ── Persist when newly unlocked detected ── */
  useEffect(() => {
    if (newlyUnlocked.length === 0) return;
    const persist = async () => {
      const updated = new Set([...unlockedHistory, ...newlyUnlocked]);
      const now = Date.now();
      const updatedAt = { ...unlockedAtMap };
      newlyUnlocked.forEach((id) => {
        if (!updatedAt[id]) updatedAt[id] = now;
      });
      await AsyncStorage.setItem(ACHIEVEMENTS_UNLOCKED_KEY, JSON.stringify([...updated]));
      await AsyncStorage.setItem(ACHIEVEMENTS_UNLOCKED_AT_KEY, JSON.stringify(updatedAt));
      setUnlockedHistory(updated);
      setUnlockedAtMap(updatedAt);
    };
    persist();
  }, [newlyUnlocked]);

  /* ── Core achievement builder ── */
  const achievements: Achievement[] = useMemo(() => {
    // FIX: Guard against missing contexts
    if (!baby?.currentBaby?.id) return [];

    const babyId = baby.currentBaby.id;
    const now = new Date();
    const birthDate = baby.currentBaby.birthDate ? new Date(baby.currentBaby.birthDate) : null;
    const daysOld = birthDate
      ? Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const ageMonths = birthDate
      ? (now.getFullYear() - birthDate.getFullYear()) * 12 +
        (now.getMonth() - birthDate.getMonth())
      : 0;

    const allEntries = (tracker?.entries || []).filter((e: any) => e.babyId === babyId && !e.isDeleted);
    const totalActivities = allEntries.length;

    const feedEntries = tracker?.getEntries ? tracker.getEntries('feed') : [];
    const sleepEntries = tracker?.getEntries ? tracker.getEntries('sleep') : [];
    const pottyEntries = tracker?.getEntries ? tracker.getEntries('potty') : [];
    const diaperEntries = tracker?.getEntries ? tracker.getEntries('diaper') : [];
    const growthEntries = tracker?.getEntries ? tracker.getEntries('growth') : [];
    const milestoneEntries = tracker?.getEntries ? tracker.getEntries('milestone') : [];
    const medicationEntries = tracker?.getEntries ? tracker.getEntries('medication') : [];
    const temperatureEntries = tracker?.getEntries ? tracker.getEntries('temperature') : [];
    const symptomEntries = tracker?.getEntries ? tracker.getEntries('symptom') : [];
    const noteEntries = tracker?.getEntries ? tracker.getEntries('note') : [];
    const pumpingEntries = tracker?.getEntries ? tracker.getEntries('pumping') : [];

    const totalFeed = feedEntries.length;
    const totalSleep = sleepEntries.length;
    const totalPotty = pottyEntries.length;
    const totalDiaper = diaperEntries.length;
    const totalMilestone = milestoneEntries.length;
    const totalMedication = medicationEntries.length;
    const totalNote = noteEntries.length;
    const totalPumping = pumpingEntries.length;

    const globalStreak = computeStreak(allEntries);
    const pottyStreak = computeStreak(allEntries, 'potty');
    const feedStreak = computeStreak(allEntries, 'feed');
    const sleepStreak = computeStreak(allEntries, 'sleep');

    const pottySuccessful = pottyEntries.filter((e: any) => e.data?.successful === true).length;
    const pottySuccessRate = totalPotty > 0 ? (pottySuccessful / totalPotty) * 100 : 0;

    const goodSleep = sleepEntries.filter(
      (e: any) => e.data?.quality === 'good' || e.data?.quality === 'excellent'
    ).length;

    const feedTypes = new Set(feedEntries.map((e: any) => e.data?.feedType).filter(Boolean));
    const feedTypeCount = feedTypes.size;

    const growthData = baby?.growthData || [];
    const growthCount = growthData.length || 0;
    const hasWeight = growthData.some((g: any) => g.type === 'weight') || false;
    const hasHeight = growthData.some((g: any) => g.type === 'height') || false;
    const hasHead = growthData.some((g: any) => g.type === 'head') || false;
    const lastGrowth = growthData.length > 0
      ? [...growthData].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;
    const daysSinceGrowth = lastGrowth ? differenceInDays(now, new Date(lastGrowth.date)) : 999;

    const earlyBird = allEntries.some((e: any) => new Date(e.timestamp).getHours() < 7);
    const nightOwl = allEntries.some((e: any) => new Date(e.timestamp).getHours() >= 22);

    const photoCount = allEntries.filter((e: any) => e.photoUris && e.photoUris.length > 0).length;

    const sharedCount = allEntries.filter((e: any) => e.data?.shared === true).length;

    const usedTypes = new Set(allEntries.map((e: any) => e.trackerId)).size;

    const gi = growthIndex;
    const restScore = gi?.restScore?.value || 50;
    const healthStability = gi?.healthStability?.value || 50;
    const milestoneReadiness = gi?.milestoneReadiness || [];
    const readinessOver60 = milestoneReadiness.filter((r: any) => r.readinessPercent > 60).length;
    const readinessOver80 = milestoneReadiness.filter((r: any) => r.readinessPercent > 80).length;

    const predictiveAchievementIds = new Set<string>();
    const predictiveAchievements: Achievement[] = (predictiveReminders || []).map((reminder) => {
      const isHighConfidence = reminder.confidence > 85;
      const isUnlocked = isHighConfidence && unlockedHistory.has(`predictive_${reminder.id}`);
      if (isUnlocked) predictiveAchievementIds.add(`predictive_${reminder.id}`);
      return {
        id: `predictive_${reminder.id}`,
        title: `${reminder.emoji} ${reminder.title}`,
        description: reminder.description,
        emoji: reminder.emoji,
        unlocked: isUnlocked,
        progress: Math.round(reminder.confidence),
        maxProgress: 100,
        category: 'predictive',
        rarity: reminder.priority === 'high' ? 'epic' : reminder.priority === 'medium' ? 'rare' : 'common',
        points: reminder.priority === 'high' ? 300 : reminder.priority === 'medium' ? 150 : 75,
        sourceTrackers: [reminder.basedOn?.[0]?.trackerId].filter(Boolean) as string[],
        triggeredByReminder: reminder,
      };
    });

    const built: Achievement[] = [
      /* ═══ MILESTONE ═══ */
      {
        id: 'first_milestone',
        title: 'First Steps',
        description: 'Record your first milestone',
        emoji: '🏆',
        unlocked: totalMilestone >= 1,
        progress: Math.min(totalMilestone, 1),
        maxProgress: 1,
        category: 'milestone',
        rarity: 'common',
        points: RARITY_POINTS.common,
        sourceTrackers: ['milestone'],
      },
      {
        id: 'milestone_collector_5',
        title: 'Milestone Hunter',
        description: 'Record 5 milestones',
        emoji: '🌟',
        unlocked: totalMilestone >= 5,
        progress: totalMilestone,
        maxProgress: 5,
        category: 'milestone',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['milestone'],
      },
      {
        id: 'milestone_collector',
        title: 'Milestone Collector',
        description: 'Record 10 milestones',
        emoji: '💫',
        unlocked: totalMilestone >= 10,
        progress: totalMilestone,
        maxProgress: 10,
        category: 'milestone',
        rarity: totalMilestone >= 10 ? 'epic' : 'rare',
        points: totalMilestone >= 10 ? RARITY_POINTS.epic : RARITY_POINTS.rare,
        sourceTrackers: ['milestone'],
      },
      {
        id: 'milestone_master',
        title: 'Milestone Master',
        description: 'Record 25 milestones',
        emoji: '👑',
        unlocked: totalMilestone >= 25,
        progress: totalMilestone,
        maxProgress: 25,
        category: 'milestone',
        rarity: 'legendary',
        points: RARITY_POINTS.legendary,
        sourceTrackers: ['milestone'],
      },

      /* ═══ STREAK ═══ */
      {
        id: 'week_warrior',
        title: 'Week Warrior',
        description: '7 day activity streak',
        emoji: '🔥',
        unlocked: globalStreak.currentStreak >= 7,
        progress: globalStreak.currentStreak,
        maxProgress: 7,
        category: 'streak',
        rarity: globalStreak.currentStreak >= 7 ? 'rare' : 'common',
        points: globalStreak.currentStreak >= 7 ? RARITY_POINTS.rare : RARITY_POINTS.common,
        sourceTrackers: ['*'],
      },
      {
        id: 'fortnight_hero',
        title: 'Fortnight Hero',
        description: '14 day activity streak',
        emoji: '🔥',
        unlocked: globalStreak.currentStreak >= 14,
        progress: globalStreak.currentStreak,
        maxProgress: 14,
        category: 'streak',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'month_master',
        title: 'Month Master',
        description: '30 day activity streak',
        emoji: '🔥',
        unlocked: globalStreak.currentStreak >= 30,
        progress: globalStreak.currentStreak,
        maxProgress: 30,
        category: 'streak',
        rarity: 'legendary',
        points: RARITY_POINTS.legendary,
        sourceTrackers: ['*'],
      },
      {
        id: 'potty_streak_7',
        title: 'Potty Perfect Week',
        description: '7 day potty tracking streak',
        emoji: '🚽',
        unlocked: pottyStreak.currentStreak >= 7,
        progress: pottyStreak.currentStreak,
        maxProgress: 7,
        category: 'streak',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['potty'],
      },
      {
        id: 'feed_streak_7',
        title: 'Feeding Faithful',
        description: '7 day feeding streak',
        emoji: '🍼',
        unlocked: feedStreak.currentStreak >= 7,
        progress: feedStreak.currentStreak,
        maxProgress: 7,
        category: 'streak',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['feed'],
      },
      {
        id: 'sleep_streak_7',
        title: 'Sleep Scheduler',
        description: '7 day sleep tracking streak',
        emoji: '😴',
        unlocked: sleepStreak.currentStreak >= 7,
        progress: sleepStreak.currentStreak,
        maxProgress: 7,
        category: 'streak',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['sleep'],
      },
      {
        id: 'tracking_streak_30',
        title: 'Daily Devotee',
        description: '30 days of consecutive tracking',
        emoji: '📆',
        unlocked: globalStreak.currentStreak >= 30,
        progress: globalStreak.currentStreak,
        maxProgress: 30,
        category: 'streak',
        rarity: 'legendary',
        points: RARITY_POINTS.legendary,
        sourceTrackers: ['*'],
      },
      {
        id: 'hundred_days',
        title: 'Century Club',
        description: '100 days of tracking any activity',
        emoji: '💯',
        unlocked: globalStreak.currentStreak >= 100,
        progress: globalStreak.currentStreak,
        maxProgress: 100,
        category: 'streak',
        rarity: 'legendary',
        points: 2500,
        sourceTrackers: ['*'],
      },

      /* ═══ TRACKING ═══ */
      {
        id: 'first_log',
        title: 'First Log',
        description: 'Create your first activity log',
        emoji: '📝',
        unlocked: totalActivities >= 1,
        progress: Math.min(totalActivities, 1),
        maxProgress: 1,
        category: 'tracking',
        rarity: 'common',
        points: RARITY_POINTS.common,
        sourceTrackers: ['*'],
      },
      {
        id: 'tracking_pro',
        title: 'Tracking Pro',
        description: 'Log 50 activities',
        emoji: '📊',
        unlocked: totalActivities >= 50,
        progress: totalActivities,
        maxProgress: 50,
        category: 'tracking',
        rarity: totalActivities >= 50 ? 'epic' : 'rare',
        points: totalActivities >= 50 ? RARITY_POINTS.epic : RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'tracking_legend',
        title: 'Tracking Legend',
        description: 'Log 200 activities',
        emoji: '📈',
        unlocked: totalActivities >= 200,
        progress: totalActivities,
        maxProgress: 200,
        category: 'tracking',
        rarity: 'legendary',
        points: 2000,
        sourceTrackers: ['*'],
      },
      {
        id: 'sleep_tracker',
        title: 'Sleep Tracker',
        description: 'Log 20 sleep sessions',
        emoji: '😴',
        unlocked: totalSleep >= 20,
        progress: totalSleep,
        maxProgress: 20,
        category: 'tracking',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['sleep'],
      },
      {
        id: 'feed_tracker',
        title: 'Feed Tracker',
        description: 'Log 30 feeding sessions',
        emoji: '🍼',
        unlocked: totalFeed >= 30,
        progress: totalFeed,
        maxProgress: 30,
        category: 'tracking',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['feed'],
      },
      {
        id: 'diaper_tracker',
        title: 'Diaper Duty',
        description: 'Log 50 diaper changes',
        emoji: '🧷',
        unlocked: totalDiaper >= 50,
        progress: totalDiaper,
        maxProgress: 50,
        category: 'tracking',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['diaper'],
      },
      {
        id: 'pumping_tracker',
        title: 'Pumping Pro',
        description: 'Log 20 pumping sessions',
        emoji: '🤱',
        unlocked: totalPumping >= 20,
        progress: totalPumping,
        maxProgress: 20,
        category: 'tracking',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['pumping'],
      },
      {
        id: 'diary_keeper',
        title: 'Diary Keeper',
        description: 'Write 10 notes',
        emoji: '📔',
        unlocked: totalNote >= 10,
        progress: totalNote,
        maxProgress: 10,
        category: 'tracking',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['note'],
      },

      /* ═══ CARE ═══ */
      {
        id: 'feeding_diversity',
        title: 'Food Explorer',
        description: 'Try all feeding types (breast, bottle, solid, both)',
        emoji: '🍎',
        unlocked: feedTypeCount >= 4,
        progress: feedTypeCount,
        maxProgress: 4,
        category: 'care',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['feed'],
      },
      {
        id: 'good_sleep_10',
        title: 'Sweet Dreams',
        description: '10 good or excellent sleep sessions',
        emoji: '🌙',
        unlocked: goodSleep >= 10,
        progress: goodSleep,
        maxProgress: 10,
        category: 'care',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['sleep'],
      },
      {
        id: 'perfect_nap',
        title: 'Nap Ninja',
        description: '5 perfect nap sessions',
        emoji: '💤',
        unlocked: sleepEntries.filter((e: any) => e.data?.sleepType === 'nap' && (e.data?.quality === 'good' || e.data?.quality === 'excellent')).length >= 5,
        progress: sleepEntries.filter((e: any) => e.data?.sleepType === 'nap' && (e.data?.quality === 'good' || e.data?.quality === 'excellent')).length,
        maxProgress: 5,
        category: 'care',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['sleep'],
      },

      /* ═══ HEALTH ═══ */
      {
        id: 'growth_tracker',
        title: 'Growth Tracker',
        description: 'Record weight and height measurements',
        emoji: '📏',
        unlocked: hasWeight && hasHeight,
        progress: (hasWeight ? 1 : 0) + (hasHeight ? 1 : 0),
        maxProgress: 2,
        category: 'health',
        rarity: 'common',
        points: RARITY_POINTS.common,
        sourceTrackers: ['growth'],
      },
      {
        id: 'growth_complete',
        title: 'Growth Complete',
        description: 'Record weight, height, and head measurements',
        emoji: '📐',
        unlocked: hasWeight && hasHeight && hasHead,
        progress: (hasWeight ? 1 : 0) + (hasHeight ? 1 : 0) + (hasHead ? 1 : 0),
        maxProgress: 3,
        category: 'health',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['growth'],
      },
      {
        id: 'growth_pro',
        title: 'Growth Pro',
        description: 'Record 10 growth measurements',
        emoji: '📊',
        unlocked: growthCount >= 10,
        progress: growthCount,
        maxProgress: 10,
        category: 'health',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['growth'],
      },
      {
        id: 'growth_consistent',
        title: 'Consistent Growth',
        description: 'Track growth every 2 weeks for 2 months',
        emoji: '📈',
        unlocked: daysSinceGrowth <= 14 && growthCount >= 4,
        progress: growthCount >= 4 ? 4 : growthCount,
        maxProgress: 4,
        category: 'health',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['growth'],
      },
      {
        id: 'medication_master',
        title: 'Health Guardian',
        description: 'Log 20 medication records',
        emoji: '💊',
        unlocked: totalMedication >= 20,
        progress: totalMedication,
        maxProgress: 20,
        category: 'health',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['medication'],
      },
      {
        id: 'medication_adherent',
        title: 'Perfect Patient',
        description: '7 days of medication tracking',
        emoji: '🩺',
        unlocked: totalMedication >= 7,
        progress: totalMedication,
        maxProgress: 7,
        category: 'health',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['medication'],
      },
      {
        id: 'temperature_tracker',
        title: 'Temperature Watch',
        description: 'Log 10 temperature readings',
        emoji: '🌡️',
        unlocked: temperatureEntries.length >= 10,
        progress: temperatureEntries.length,
        maxProgress: 10,
        category: 'health',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['temperature'],
      },
      {
        id: 'symptom_tracker',
        title: 'Symptom Spotter',
        description: 'Log 5 symptom records',
        emoji: '🤒',
        unlocked: symptomEntries.length >= 5,
        progress: symptomEntries.length,
        maxProgress: 5,
        category: 'health',
        rarity: 'common',
        points: RARITY_POINTS.common,
        sourceTrackers: ['symptom'],
      },
      {
        id: 'health_stable',
        title: 'Health Stable',
        description: 'Maintain health stability above 70% for a week',
        emoji: '❤️',
        unlocked: healthStability >= 70,
        progress: Math.round(healthStability),
        maxProgress: 100,
        category: 'health',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['temperature', 'symptom', 'medication'],
      },

      /* ═══ GROWTH INTELLIGENCE ═══ */
      {
        id: 'gi_sleep_optimizer',
        title: 'Sleep Optimizer',
        description: 'Improve sleep score above 70',
        emoji: '🌙',
        unlocked: restScore >= 70,
        progress: Math.round(restScore),
        maxProgress: 100,
        category: 'growth',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['sleep'],
      },
      {
        id: 'gi_milestone_ready',
        title: 'Milestone Ready',
        description: 'Reach 60% readiness on any milestone category',
        emoji: '🎯',
        unlocked: readinessOver60 > 0,
        progress: readinessOver60,
        maxProgress: 1,
        category: 'growth',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['milestone', 'growth'],
      },
      {
        id: 'gi_milestone_eager',
        title: 'Milestone Eager',
        description: 'Reach 80% readiness on any milestone category',
        emoji: '🚀',
        unlocked: readinessOver80 > 0,
        progress: readinessOver80,
        maxProgress: 1,
        category: 'growth',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['milestone', 'growth'],
      },
      {
        id: 'gi_growth_score_80',
        title: 'Growth Star',
        description: 'Achieve overall growth score above 80',
        emoji: '⭐',
        unlocked: (gi?.overall?.value || 0) >= 80,
        progress: Math.round(gi?.overall?.value || 0),
        maxProgress: 100,
        category: 'growth',
        rarity: 'legendary',
        points: RARITY_POINTS.legendary,
        sourceTrackers: ['*'],
      },

      /* ═══ SPECIAL ═══ */
      {
        id: 'potty_pro',
        title: 'Potty Pro',
        description: '80% potty success rate',
        emoji: '🚽',
        unlocked: pottySuccessRate >= 80,
        progress: Math.round(pottySuccessRate),
        maxProgress: 80,
        category: 'special',
        rarity: pottySuccessRate >= 80 ? 'epic' : 'rare',
        points: pottySuccessRate >= 80 ? RARITY_POINTS.epic : RARITY_POINTS.rare,
        sourceTrackers: ['potty'],
      },
      {
        id: 'potty_perfect',
        title: 'Potty Perfect',
        description: '95% potty success rate',
        emoji: '✨',
        unlocked: pottySuccessRate >= 95,
        progress: Math.round(pottySuccessRate),
        maxProgress: 95,
        category: 'special',
        rarity: 'legendary',
        points: 1200,
        sourceTrackers: ['potty'],
      },
      {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Track an activity before 7 AM',
        emoji: '🌅',
        unlocked: earlyBird,
        progress: earlyBird ? 1 : 0,
        maxProgress: 1,
        category: 'special',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Track an activity after 10 PM',
        emoji: '🦉',
        unlocked: nightOwl,
        progress: nightOwl ? 1 : 0,
        maxProgress: 1,
        category: 'special',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'jack_of_all',
        title: 'Jack of All Trades',
        description: 'Use all 8 core activity types',
        emoji: '🎯',
        unlocked: usedTypes >= 8,
        progress: usedTypes,
        maxProgress: 8,
        category: 'special',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['*'],
      },
      {
        id: 'photo_journal',
        title: 'Photo Journalist',
        description: 'Add 5 photos to activities',
        emoji: '📸',
        unlocked: photoCount >= 5,
        progress: photoCount,
        maxProgress: 5,
        category: 'special',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'veteran_parent',
        title: 'Veteran Parent',
        description: 'Track for 365 days',
        emoji: '🏅',
        unlocked: daysOld >= 365,
        progress: Math.min(daysOld, 365),
        maxProgress: 365,
        category: 'special',
        rarity: 'legendary',
        points: 3000,
        sourceTrackers: ['*'],
      },
      {
        id: 'social_sharer',
        title: 'Social Sharer',
        description: 'Share 5 activities',
        emoji: '🔗',
        unlocked: sharedCount >= 5,
        progress: sharedCount,
        maxProgress: 5,
        category: 'social',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'all_tracker_types',
        title: 'Tracker Explorer',
        description: 'Use 5 different tracker types',
        emoji: '🧭',
        unlocked: usedTypes >= 5,
        progress: usedTypes,
        maxProgress: 5,
        category: 'special',
        rarity: 'rare',
        points: RARITY_POINTS.rare,
        sourceTrackers: ['*'],
      },
      {
        id: 'growth_data_complete',
        title: 'Data Complete',
        description: 'Have growth data, milestones, and health tracking active',
        emoji: '🔬',
        unlocked: growthCount > 0 && totalMilestone > 0 && totalMedication > 0,
        progress: (growthCount > 0 ? 1 : 0) + (totalMilestone > 0 ? 1 : 0) + (totalMedication > 0 ? 1 : 0),
        maxProgress: 3,
        category: 'special',
        rarity: 'epic',
        points: RARITY_POINTS.epic,
        sourceTrackers: ['growth', 'milestone', 'medication'],
      },

      /* ═══ PREDICTIVE (from usePredictiveReminders) ═══ */
      ...predictiveAchievements,
    ];

    return built;
  }, [tracker, baby, growthIndex, predictiveReminders, unlockedHistory, refreshToken]);

  /* ── Detect newly unlocked ── */
  useEffect(() => {
    const newIds: string[] = [];
    achievements.forEach((a) => {
      if (a.unlocked && !unlockedHistory.has(a.id)) {
        newIds.push(a.id);
      }
    });
    if (newIds.length > 0) {
      setNewlyUnlocked(newIds);
      const timer = setTimeout(() => setNewlyUnlocked([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [achievements, unlockedHistory]);

  /* ── Stats aggregation ── */
  const stats: AchievementStats = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked);
    const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);

    const byCategory = (Object.keys(CATEGORY_META) as AchievementCategory[]).map((cat) => ({
      category: cat,
      ...CATEGORY_META[cat],
      unlocked: achievements.filter((a) => a.category === cat && a.unlocked).length,
      total: achievements.filter((a) => a.category === cat).length,
    }));

    return {
      total: achievements.length,
      unlocked: unlocked.length,
      progress: achievements.length > 0 ? Math.round((unlocked.length / achievements.length) * 100) : 0,
      totalPoints,
      legendary: unlocked.filter((a) => a.rarity === 'legendary').length,
      epic: unlocked.filter((a) => a.rarity === 'epic').length,
      rare: unlocked.filter((a) => a.rarity === 'rare').length,
      common: unlocked.filter((a) => a.rarity === 'common').length,
      byCategory,
    };
  }, [achievements]);

  /* ── Streak (global) ── */
  const streak = useMemo(() => computeStreak(tracker?.entries || []), [tracker?.entries, refreshToken]);

  /* ── Refresh handler ── */
  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  /* ── Mark predictive achievement as unlocked ── */
  const unlockPredictive = useCallback(async (reminderId: string) => {
    const id = `predictive_${reminderId}`;
    const updated = new Set([...unlockedHistory, id]);
    await AsyncStorage.setItem(ACHIEVEMENTS_UNLOCKED_KEY, JSON.stringify([...updated]));
    setUnlockedHistory(updated);
  }, [unlockedHistory]);

  return {
    achievements,
    stats,
    streak,
    newlyUnlocked,
    growthScore: growthIndex,
    pendingReminders: predictiveReminders,
    isLoading,
    refresh,
    unlockPredictive,
  };
};

export default useTrackerAchievements;
