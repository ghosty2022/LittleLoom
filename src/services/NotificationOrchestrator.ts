// src/services/NotificationOrchestrator.ts
//
// Central scheduler for every NON-chat notification in the app.
//
// Chat notifications are handled directly by `FamilyChatContext` via
// `notificationService.sendChatNotification` — they fire the moment a
// message arrives on the realtime channel, so they don't need this
// orchestrator.
//
// Everything else needs a periodic tick because the trigger condition
// lives in a piece of app state that only becomes true at some point
// in the future:
//
//   • Achievement unlock   → triggered when `IntegratedTracker.pendingAchievements` grows
//   • Streak at risk       → triggered at 20:00 local time if no entry logged today
//   • Daily summary        → triggered at 20:30 local time if the baby has entries today
//   • Vaccine due          → triggered 7 days before the due date, and on the due date
//   • Safety alert         → triggered when a safety checklist item is missed for 7 days
//
// The orchestrator runs on:
//   • App mount (first 30s after sign-in, once)
//   • Every 15 minutes while the app is in the foreground
//   • On foreground resume from background
//
// It uses `expo-notifications`'s local scheduling. Each category has a
// stable `identifier` so we never double-schedule.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

const FIRED_KEY = '@littleloom_notification_fired_v1';

type Category =
  | 'achievement'
  | 'streak'
  | 'daily_summary'
  | 'vaccine'
  | 'safety_alert';

const CATEGORY_IDS: Record<Category, string> = {
  achievement: 'achievement',
  streak: 'streak',
  daily_summary: 'daily_summary',
  vaccine: 'vaccine',
  safety_alert: 'safety_alert',
};

// ── Dedup ledger ───────────────────────────────────────────────
// We persist `{ [fingerprint: string]: epochMs }` so a notification
// for the same underlying event never fires twice — even across
// app restarts.
type FiredMap = Record<string, number>;

const loadFired = async (): Promise<FiredMap> => {
  try {
    const raw = await AsyncStorage.getItem(FIRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveFired = async (map: FiredMap) => {
  try {
    await AsyncStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {}
};

const hasFired = (map: FiredMap, key: string, maxAgeMs = 24 * 60 * 60 * 1000): boolean => {
  const at = map[key];
  if (!at) return false;
  return Date.now() - at < maxAgeMs;
};

const markFired = async (key: string) => {
  const map = await loadFired();
  map[key] = Date.now();
  // Prune entries older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(map)) {
    if (map[k] < cutoff) delete map[k];
  }
  await saveFired(map);
};

const schedule = async (
  title: string,
  body: string,
  data: Record<string, unknown>,
  category: Category,
): Promise<boolean> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { ...data, category, type: data.type ?? category },
        sound: true,
        priority: Notifications.AndroidPriority.HIGH,
      },
      trigger: null, // deliver immediately
    });
    return !!id;
  } catch (e) {
    if (__DEV__) console.warn('[NotifOrchestrator] schedule failed:', category, e);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
//  Achievement unlock
// ═══════════════════════════════════════════════════════════════
export const checkAchievementNotification = async (
  pendingAchievements: Array<{ id: string; title: string; description?: string }>,
) => {
  if (!Array.isArray(pendingAchievements) || pendingAchievements.length === 0) return;
  const fired = await loadFired();

  for (const a of pendingAchievements) {
    const key = `${CATEGORY_IDS.achievement}:${a.id}`;
    if (hasFired(fired, key, 7 * 24 * 60 * 60 * 1000)) continue;

    await schedule(
      `🏆 ${a.title}`,
      a.description || 'You unlocked a new achievement!',
      {
        type: 'achievement_unlocked',
        achievementId: a.id,
        screen: 'Achievements',
        params: { highlightId: a.id },
      },
      'achievement',
    );
    await markFired(key);
  }
};

// ═══════════════════════════════════════════════════════════════
//  Streak at risk (local 20:00 tick)
// ═══════════════════════════════════════════════════════════════
export const checkStreakNotification = async (args: {
  babyId: string | null;
  currentStreak: number;
  hasEntryToday: boolean;
}) => {
  if (!args.babyId || args.currentStreak < 1 || args.hasEntryToday) return;
  const hour = new Date().getHours();
  if (hour < 20) return;

  const today = new Date().toISOString().split('T')[0];
  const key = `${CATEGORY_IDS.streak}:${args.babyId}:${today}`;
  const fired = await loadFired();
  if (hasFired(fired, key, 24 * 60 * 60 * 1000)) return;

  await schedule(
    `🔥 ${args.currentStreak}-day streak at risk`,
    "You haven't logged anything today. Log one activity to keep your streak alive.",
    {
      type: 'streak_reminder',
      screen: 'Timeline',
      params: { type: 'potty' },
    },
    'streak',
  );
  await markFired(key);
};

// ═══════════════════════════════════════════════════════════════
//  Daily summary (local 20:30 tick)
// ═══════════════════════════════════════════════════════════════
export const checkDailySummaryNotification = async (args: {
  babyId: string | null;
  babyName: string;
  feedCount: number;
  sleepHours: number;
  diaperCount: number;
}) => {
  if (!args.babyId) return;
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  // Only fire between 20:30 and 21:30 — one window per day.
  if (hour < 20 || (hour === 20 && minute < 30) || hour > 21) return;

  const total = args.feedCount + args.diaperCount + (args.sleepHours > 0 ? 1 : 0);
  if (total === 0) return;

  const today = new Date().toISOString().split('T')[0];
  const key = `${CATEGORY_IDS.daily_summary}:${args.babyId}:${today}`;
  const fired = await loadFired();
  if (hasFired(fired, key, 24 * 60 * 60 * 1000)) return;

  await schedule(
    `📋 ${args.babyName}'s day in review`,
    `${args.feedCount} feeds · ${args.sleepHours.toFixed(1)}h sleep · ${args.diaperCount} diapers`,
    {
      type: 'daily_summary',
      screen: 'Timeline',
      params: {},
    },
    'daily_summary',
  );
  await markFired(key);
};

// ═══════════════════════════════════════════════════════════════
//  Vaccine due (checks daily)
// ═══════════════════════════════════════════════════════════════
const VACCINE_SCHEDULE: Array<{ name: string; ageDays: number }> = [
  { name: 'HepB (1st dose)', ageDays: 0 },
  { name: 'HepB (2nd dose)', ageDays: 30 },
  { name: 'DTaP (1st dose)', ageDays: 60 },
  { name: 'IPV (1st dose)', ageDays: 60 },
  { name: 'Hib (1st dose)', ageDays: 60 },
  { name: 'PCV (1st dose)', ageDays: 60 },
  { name: 'RV (1st dose)', ageDays: 60 },
  { name: 'DTaP (2nd dose)', ageDays: 120 },
  { name: 'IPV (2nd dose)', ageDays: 120 },
  { name: 'PCV (2nd dose)', ageDays: 120 },
  { name: 'HepB (3rd dose)', ageDays: 180 },
  { name: 'DTaP (3rd dose)', ageDays: 180 },
  { name: 'IPV (3rd dose)', ageDays: 180 },
  { name: 'MMR (1st dose)', ageDays: 365 },
  { name: 'Varicella (1st dose)', ageDays: 365 },
];

export const checkVaccineNotification = async (args: {
  babyId: string | null;
  babyName: string;
  birthDate: string | null;
}) => {
  if (!args.babyId || !args.birthDate) return;
  const birth = new Date(args.birthDate);
  if (isNaN(birth.getTime())) return;
  const ageDays = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24));

  for (const v of VACCINE_SCHEDULE) {
    const daysUntil = v.ageDays - ageDays;
    // Fire at T-7 days and again on T-0
    if (daysUntil !== 7 && daysUntil !== 0) continue;

    const key = `${CATEGORY_IDS.vaccine}:${args.babyId}:${v.name}:${daysUntil}`;
    const fired = await loadFired();
    if (hasFired(fired, key, 14 * 24 * 60 * 60 * 1000)) continue;

    const when = daysUntil === 0 ? 'is due today' : 'is due in 7 days';
    await schedule(
      `💉 ${v.name} ${when}`,
      `${args.babyName}'s ${v.name} vaccination ${when}. Tap to view the schedule.`,
      {
        type: 'vaccine_reminder',
        screen: 'VaccinationSchedule',
        params: { highlightVaccine: v.name },
      },
      'vaccine',
    );
    await markFired(key);
  }
};

// ═══════════════════════════════════════════════════════════════
//  Safety alert (missed checklist items)
// ═══════════════════════════════════════════════════════════════
export const checkSafetyAlertNotification = async (args: {
  babyId: string | null;
  checklistId: string;
  checklistTitle: string;
  criticalItemsRemaining: number;
  lastProgressAt: number | null;
}) => {
  if (!args.babyId || args.criticalItemsRemaining <= 0) return;
  if (!args.lastProgressAt) return;
  const daysSinceProgress = Math.floor(
    (Date.now() - args.lastProgressAt) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceProgress < 7) return;

  const weekKey = new Date().toISOString().split('T')[0].slice(0, 7);
  const key = `${CATEGORY_IDS.safety_alert}:${args.checklistId}:${weekKey}`;
  const fired = await loadFired();
  if (hasFired(fired, key, 7 * 24 * 60 * 60 * 1000)) return;

  await schedule(
    `🛡️ ${args.checklistTitle} needs attention`,
    `${args.criticalItemsRemaining} critical item${args.criticalItemsRemaining === 1 ? '' : 's'} still incomplete. Review your safety checklist.`,
    {
      type: 'safety_alert',
      screen: 'SafetyCorner',
      params: { checklistId: args.checklistId },
    },
    'safety_alert',
  );
  await markFired(key);
};

// ═══════════════════════════════════════════════════════════════
//  Public entry point — called from useFocusEffect in HomeScreen
// ═══════════════════════════════════════════════════════════════
export const runNotificationOrchestrator = async (context: {
  pendingAchievements: Array<{ id: string; title: string; description?: string }>;
  babyId: string | null;
  babyName: string;
  babyBirthDate: string | null;
  currentStreak: number;
  hasEntryToday: boolean;
  feedCount: number;
  sleepHours: number;
  diaperCount: number;
}) => {
  // Fire-and-forget each category; one failing must not block the rest.
  await Promise.allSettled([
    checkAchievementNotification(context.pendingAchievements),
    checkStreakNotification({
      babyId: context.babyId,
      currentStreak: context.currentStreak,
      hasEntryToday: context.hasEntryToday,
    }),
    checkDailySummaryNotification({
      babyId: context.babyId,
      babyName: context.babyName,
      feedCount: context.feedCount,
      sleepHours: context.sleepHours,
      diaperCount: context.diaperCount,
    }),
    checkVaccineNotification({
      babyId: context.babyId,
      babyName: context.babyName,
      birthDate: context.babyBirthDate,
    }),
  ]);
};