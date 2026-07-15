import { UnifiedTrackerConfig,
  TrackerEntry,
  TrackerCategory,
  FieldConfig,
  TRACKER_STORAGE_KEYS,
  TrackerStreak,
  TrackerInsight,
  ReminderRule,
  ProgressiveTrackerState, } from '@/types/trackers';
import { useAuth } from '@/context/AuthContext';
import { useCustomization } from '@/hooks/useCustomization';
import { useFamily } from '@/context/FamilyContext';
import { useSweetAlert } from '@/components/SweetAlert';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { createCustomTracker, validateCustomTracker, DEFAULT_TRACKERS } from '@/config/defaultTrackers';

/* ------------------------------------------------------------------ */
/*  Legacy-compatible types                                            */
/* ------------------------------------------------------------------ */

export type LegacyActivityType =
  | 'potty' | 'diaper' | 'feed' | 'pumping' | 'sleep' | 'bath'
  | 'growth' | 'temperature' | 'medication' | 'symptom'
  | 'vaccine' | 'doctor_visit' | 'teething' | 'allergy'
  | 'skin_condition' | 'immunization'
  | 'milestone' | 'play' | 'tummy_time' | 'reading'
  | 'music' | 'outdoor' | 'sensory' | 'speech'
  | 'mood' | 'attachment' | 'social' | 'crying' | 'soothing'
  | 'nail_care' | 'hair_care' | 'skin_care' | 'sunscreen'
  | 'insect_repellent' | 'oral_hygiene' | 'ear_care' | 'nose_care'
  | 'solid_food' | 'water' | 'vitamin' | 'allergen_intro'
  | 'feeding_reaction' | 'breastfeeding'
  | 'accident' | 'injury' | 'choking' | 'car_seat' | 'babyproofing'
  | 'wake_time' | 'bedtime' | 'nap' | 'screen_time' | 'outdoor_time'
  | 'note' | 'photo' | 'video' | 'voice_memo' | 'journal'
  | 'trip' | 'travel' | 'daycare' | 'babysitter'
  | 'reflux' | 'colic' | 'gas' | 'constipation'
  | 'diarrhea' | 'eczema' | 'cradle_cap'
  | string;

export interface LegacyActivityEntry {
  id: string;
  babyId: string;
  type: LegacyActivityType;
  timestamp: number;
  title: string;
  details?: string;
  icon?: string;
  loggedBy: string;
  loggedByName: string;
  pottyType?: string;
  successful?: boolean;
  feedType?: string;
  amount?: string;
  duration?: string;
  side?: string;
  food?: string;
  sleepType?: string;
  quality?: number;
  location?: string;
  measurementType?: string;
  value?: string;
  unit?: string;
  percentile?: number;
  medName?: string;
  dosage?: string;
  reason?: string;
  givenBy?: string;
  milestoneType?: string;
  firstTime?: boolean;
  description?: string;
  symptomType?: string;
  severity?: number;
  tempValue?: number;
  tempUnit?: string;
  method?: string;
  symptoms?: string[];
  notes?: string;
   photo?: string;
  photos?: string[];  // ADD THIS
  tags?: string[];
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TrackerState {
  isLoading: boolean;
  trackers: UnifiedTrackerConfig[];
  customTrackers: UnifiedTrackerConfig[];
  entries: TrackerEntry[];
  entriesByTracker: Record<string, TrackerEntry[]>;
  lastTrackerId: string | null;
  currentBabyId: string | null;
  progressive: ProgressiveTrackerState;
}

interface TrackerContextType extends TrackerState {
  getTracker: (id: string) => UnifiedTrackerConfig | undefined;
  getTrackersByCategory: (category: TrackerCategory) => UnifiedTrackerConfig[];
  searchTrackers: (query: string) => UnifiedTrackerConfig[];

  createCustomTracker: (
    name: string,
    emoji: string,
    category: TrackerCategory,
    fields: FieldConfig[],
    options?: Parameters<typeof createCustomTracker>[4]
  ) => Promise<UnifiedTrackerConfig | null>;
  updateCustomTracker: (id: string, updates: Partial<UnifiedTrackerConfig>) => Promise<boolean>;
  deleteCustomTracker: (id: string) => Promise<boolean>;
  duplicateTracker: (id: string, newName: string) => Promise<UnifiedTrackerConfig | null>;

  addEntry: (trackerId: string, data: Record<string, unknown>, options?: {
    title?: string;
    notes?: string;
    photoUris?: string[];
    tags?: string[];
  }) => Promise<TrackerEntry | null>;
  updateEntry: (entryId: string, updates: Partial<TrackerEntry>) => Promise<boolean>;
  deleteEntry: (entryId: string) => Promise<boolean>;
  getEntries: (trackerId?: string, limit?: number) => TrackerEntry[];
  getEntriesByDate: (date: Date) => TrackerEntry[];
  getEntryById: (id: string) => TrackerEntry | undefined;

  getTrackerStats: (trackerId: string) => {
    totalEntries: number;
    thisWeek: number;
    thisMonth: number;
    lastEntry: TrackerEntry | null;
    streakDays: number;
  };
  getTodaySummary: () => { trackerId: string; count: number; emoji: string }[];

  canUseTracker: (trackerId: string) => boolean;
  canCreateEntry: (trackerId: string) => boolean;
  canEditEntry: (entry: TrackerEntry) => boolean;
  canDeleteEntry: (entry: TrackerEntry) => boolean;

  getSmartSuggestions: (trackerId: string) => Record<string, unknown>;
  getYesterdayData: (trackerId: string) => Record<string, unknown> | null;
  getStreak: (trackerId: string) => TrackerStreak | undefined;
  getInsights: () => TrackerInsight[];
  dismissInsight: (id: string) => void;
  scheduleReminder: (rule: Omit<ReminderRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  cancelReminder: (ruleId: string) => Promise<void>;
  getPendingReminders: () => ReminderRule[];
  snoozeReminder: (ruleId: string, minutes: number) => Promise<void>;
  saveTemplate: (trackerId: string, name: string, data: Record<string, unknown>) => Promise<void>;
  getTemplates: (trackerId: string) => Promise<{ id: string; name: string; emoji: string; data: Record<string, unknown> }[]>;
  linkEntries: (entryId1: string, entryId2: string, relation: TrackerEntry['linkedEntries'][0]['relation'], description?: string) => Promise<void>;
  getLinkedEntries: (entryId: string) => TrackerEntry[];

  syncToLegacyActivity: (entry: TrackerEntry) => LegacyActivityEntry;
  getLegacyActivities: () => LegacyActivityEntry[];
  syncFromBabyContext: () => Promise<void>;

  refreshTrackers: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  setCurrentBabyId: (babyId: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export const TrackerContext = createContext<TrackerContextType | null>(null);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

const safeParse = <T,>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json) as T;
    if (parsed === null) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
};

const getStartOfDay = (date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDateKey = (date: Date | string | number): string => {
  const d = typeof date === 'number' ? new Date(date) : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const BABY_ACTIVITIES_KEY = (babyId: string) => `@littleloom_activities_${babyId}`;
const BABY_CURRENT_KEY = '@littleloom_current_baby';
const TRACKER_ENTRIES_GALLERY_KEY = '@littleloom_tracker_entries'; // For gallery photo sync

/* ------------------------------------------------------------------ */
/*  NEW: Smart Suggestion Engine                                       */
/* ------------------------------------------------------------------ */

const generateSmartSuggestions = (
  trackerId: string,
  entries: TrackerEntry[],
  currentBabyId: string
): Record<string, unknown> => {
  const trackerEntries = entries
    .filter(e => e.trackerId === trackerId && e.babyId === currentBabyId && !e.isDeleted)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (trackerEntries.length === 0) return {};

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
  const yesterdayEnd = yesterdayStart + 86400000;

  const yesterdayEntry = trackerEntries.find(e =>
    e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd
  );

  const suggestions: Record<string, unknown> = {};

  if (yesterdayEntry) {
    Object.entries(yesterdayEntry.data).forEach(([key, value]) => {
      if (!key.includes('time') && !key.includes('note') && typeof value !== 'object') {
        suggestions[key] = value;
      }
    });
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  const sameTimeEntries = trackerEntries.filter(e => {
    const entryHour = new Date(e.timestamp).getHours();
    const entryTOD = entryHour < 12 ? 'morning' : entryHour < 17 ? 'afternoon' : entryHour < 21 ? 'evening' : 'night';
    return entryTOD === timeOfDay;
  });

  if (sameTimeEntries.length >= 3) {
    const fieldValues: Record<string, Record<string, number>> = {};
    sameTimeEntries.forEach(e => {
      Object.entries(e.data).forEach(([key, value]) => {
        if (!fieldValues[key]) fieldValues[key] = {};
        const strVal = String(value);
        fieldValues[key][strVal] = (fieldValues[key][strVal] || 0) + 1;
      });
    });

    Object.entries(fieldValues).forEach(([key, values]) => {
      const mostCommon = Object.entries(values).sort((a, b) => b[1] - a[1])[0];
      if (mostCommon && mostCommon[1] >= 2) {
        suggestions[`${key}_pattern`] = mostCommon[0];
      }
    });
  }

  return suggestions;
};

/* ------------------------------------------------------------------ */
/*  NEW: Streak Calculation Engine                                     */
/* ------------------------------------------------------------------ */

const calculateStreak = (
  trackerId: string,
  entries: TrackerEntry[],
  currentBabyId: string
): TrackerStreak => {
  const trackerEntries = entries
    .filter(e => e.trackerId === trackerId && e.babyId === currentBabyId && !e.isDeleted)
    .sort((a, b) => b.timestamp - a.timestamp);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  let currentStreak = 0;
  let longestStreak = 0;
  let lastLoggedAt = trackerEntries[0]?.timestamp || 0;

  const loggedToday = trackerEntries.some(e => e.timestamp >= todayTime);

  if (loggedToday) {
    currentStreak = 1;
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
      const dayStart = checkDate.getTime();
      const dayEnd = dayStart + 86400000;
      const hasEntry = trackerEntries.some(e => e.timestamp >= dayStart && e.timestamp < dayEnd);
      if (hasEntry) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = yesterday.getTime();
    const yesterdayEnd = yesterdayStart + 86400000;
    const loggedYesterday = trackerEntries.some(e => e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd);

    if (loggedYesterday) {
      currentStreak = 1;
      let checkDate = new Date(yesterday);
      checkDate.setDate(checkDate.getDate() - 1);

      while (true) {
        const dayStart = checkDate.getTime();
        const dayEnd = dayStart + 86400000;
        const hasEntry = trackerEntries.some(e => e.timestamp >= dayStart && e.timestamp < dayEnd);
        if (hasEntry) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  let tempStreak = 0;
  let maxStreak = 0;
  const allDates = [...new Set(trackerEntries.map(e => {
    const d = new Date(e.timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }))].sort((a, b) => a - b);

  for (let i = 0; i < allDates.length; i++) {
    if (i === 0 || allDates[i] - allDates[i - 1] === 86400000) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(maxStreak, currentStreak);
  const hour = new Date().getHours();
  const isAtRisk = !loggedToday && hour >= 20;

  return {
    trackerId,
    currentStreak,
    longestStreak,
    lastLoggedAt,
    isAtRisk,
  };
};

/* ------------------------------------------------------------------ */
/*  NEW: Insight Generation Engine                                     */
/* ------------------------------------------------------------------ */

const generateInsights = (
  entries: TrackerEntry[],
  currentBabyId: string
): TrackerInsight[] => {
  const insights: TrackerInsight[] = [];
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  const recentEntries = entries.filter(e =>
    e.babyId === currentBabyId && !e.isDeleted && e.timestamp >= weekAgo
  );

  const medEntries = recentEntries.filter(e => e.trackerId === 'medication');
  if (medEntries.length >= 3) {
    const streak = calculateStreak('medication', entries, currentBabyId);
    if (streak.currentStreak >= 3) {
      insights.push({
        id: `med_streak_${now}`,
        trackerId: 'medication',
        type: 'milestone',
        title: `${streak.currentStreak} Day Medication Streak!`,
        description: `You've consistently logged medication for ${streak.currentStreak} days. Great job keeping track!`,
        emoji: '💊',
        priority: 'good',
        confidence: 0.9,
        generatedAt: now,
      });
    }
  }

  const tempEntries = recentEntries.filter(e => e.trackerId === 'temperature');
  if (tempEntries.length >= 2) {
    const temps = tempEntries.map(e => {
      const val = Number(e.data['value']);
      const unit = e.data['value_unit'] as string;
      return unit === 'fahrenheit' ? (val - 32) * 5 / 9 : val;
    }).filter(t => !isNaN(t));

    if (temps.length >= 2) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const lastTemp = temps[temps.length - 1];

      if (lastTemp > 38) {
        insights.push({
          id: `temp_high_${now}`,
          trackerId: 'temperature',
          type: 'anomaly',
          title: 'Elevated Temperature Detected',
          description: `Latest reading: ${lastTemp.toFixed(1)}°C. Consider monitoring closely and logging symptoms.`,
          emoji: '🌡️',
          priority: 'warning',
          confidence: 0.95,
          generatedAt: now,
          action: {
            type: 'log_now',
            trackerId: 'symptom',
            message: 'Log accompanying symptoms',
          },
        });
      }
    }
  }

  const sleepEntries = recentEntries.filter(e => e.trackerId === 'sleep');
  if (sleepEntries.length >= 5) {
    const qualities = sleepEntries.map(e => Number(e.data['quality']) || 0).filter(q => q > 0);
    if (qualities.length >= 3) {
      const avg = qualities.reduce((a, b) => a + b, 0) / qualities.length;
      if (avg < 3) {
        insights.push({
          id: `sleep_low_${now}`,
          trackerId: 'sleep',
          type: 'pattern',
          title: 'Sleep Quality Trending Low',
          description: `Average sleep quality: ${avg.toFixed(1)}/5 over the last ${qualities.length} sleeps. Consider reviewing bedtime routine.`,
          emoji: '😴',
          priority: 'warning',
          confidence: 0.7,
          generatedAt: now,
          action: {
            type: 'log_now',
            trackerId: 'bedtime',
            message: 'Review bedtime routine',
          },
        });
      }
    }
  }

  const feedEntries = recentEntries.filter(e => e.trackerId === 'feed');
  const moodEntries = recentEntries.filter(e => e.trackerId === 'mood');
  if (feedEntries.length >= 5 && moodEntries.length >= 3) {
    const badMoods = moodEntries.filter(m => (m.data['mood'] as number) <= 2);
    if (badMoods.length >= 2) {
      insights.push({
        id: `feed_mood_${now}`,
        trackerId: 'feed',
        type: 'correlation',
        title: 'Feeding & Mood Pattern Detected',
        description: 'We noticed some fussy moods after feeds. Consider tracking specific foods more carefully.',
        emoji: '🔗',
        priority: 'info',
        confidence: 0.5,
        generatedAt: now,
        action: {
          type: 'log_now',
          trackerId: 'feeding_reaction',
          message: 'Log any feeding reactions',
        },
      });
    }
  }

  const growthEntries = recentEntries.filter(e => e.trackerId === 'growth');
  if (growthEntries.length >= 2) {
    const lastGrowth = growthEntries[growthEntries.length - 1];
    const daysSince = Math.floor((now - lastGrowth.timestamp) / 86400000);
    if (daysSince >= 14) {
      insights.push({
        id: `growth_reminder_${now}`,
        trackerId: 'growth',
        type: 'suggestion',
        title: 'Time for a Growth Check?',
        description: `It's been ${daysSince} days since the last growth measurement.`,
        emoji: '📏',
        priority: 'info',
        confidence: 0.6,
        generatedAt: now,
        action: {
          type: 'log_now',
          trackerId: 'growth',
          message: 'Log new measurements',
        },
      });
    }
  }

  return insights;
};

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile } = useAuth();
  const { getEffectivePermissions, members } = useFamily();
  const { triggerHaptic } = useCustomization();
  const { success, toast, alert: sweetAlert } = useSweetAlert();

  const [state, setState] = useState<TrackerState>({
    isLoading: true,
    trackers: [],
    customTrackers: [],
    entries: [],
    entriesByTracker: {},
    lastTrackerId: null,
    currentBabyId: null,
    progressive: {
      todayEntries: [],
      yesterdayEntries: [],
      streaks: [],
      insights: [],
      pendingReminders: [],
      recentTemplates: [],
      detectedPatterns: [],
    },
  });

  const initRef = useRef(false);

  /* ---- Detect current baby ---- */
  const detectCurrentBaby = useCallback(async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(BABY_CURRENT_KEY);
    } catch {
      return null;
    }
  }, []);

  /* ---- Permission helpers ---- */
  const myRole = useMemo(() => {
    if (!userProfile) return null;
    const me = members?.find(m => m.userId === userProfile.id || m.email === userProfile.email);
    return me?.role || 'parent1';
  }, [userProfile, members]);

  const canUseTracker = useCallback((trackerId: string): boolean => {
    const tracker = state.trackers.find(t => t.id === trackerId);
    if (!tracker || !myRole) return false;
    return tracker.permissions?.familyRoles?.includes(myRole as any) ?? false;
  }, [state.trackers, myRole]);

  const canCreateEntry = useCallback((trackerId: string): boolean => {
    const tracker = state.trackers.find(t => t.id === trackerId);
    if (!tracker || !myRole) return false;
    if (['parent1', 'parent2'].includes(myRole)) return true;
    return tracker.permissions?.allowGuardiansCreate ?? false;
  }, [state.trackers, myRole]);

  const canEditEntry = useCallback((entry: TrackerEntry): boolean => {
    if (!userProfile || !myRole) return false;
    if (['parent1', 'parent2'].includes(myRole)) return true;
    if (myRole === 'guardian') {
      return entry.loggedBy === userProfile.id &&
        state.trackers.find(t => t.id === entry.trackerId)?.permissions.allowGuardiansEditOwn === true;
    }
    return false;
  }, [userProfile, myRole, state.trackers]);

  const canDeleteEntry = useCallback((entry: TrackerEntry): boolean => {
    if (!userProfile || !myRole) return false;
    if (['parent1', 'parent2'].includes(myRole)) return true;
    if (myRole === 'guardian') {
      return entry.loggedBy === userProfile.id &&
        state.trackers.find(t => t.id === entry.trackerId)?.permissions.allowGuardiansDeleteOwn === true;
    }
    return false;
  }, [userProfile, myRole, state.trackers]);

  /* ---- Load helpers ---- */
  const loadCustomTrackers = useCallback(async (): Promise<UnifiedTrackerConfig[]> => {
    try {
      const stored = await AsyncStorage.getItem(TRACKER_STORAGE_KEYS.CUSTOM_TRACKERS);
      return safeParse<UnifiedTrackerConfig[]>(stored, []);
    } catch {
      return [];
    }
  }, []);

  const loadEntries = useCallback(async (babyId: string): Promise<TrackerEntry[]> => {
    try {
      const key = TRACKER_STORAGE_KEYS.ENTRIES_PREFIX(babyId);
      const stored = await AsyncStorage.getItem(key);
      return safeParse<TrackerEntry[]>(stored, []);
    } catch {
      return [];
    }
  }, []);

  const loadReminders = useCallback(async (): Promise<ReminderRule[]> => {
    try {
      const stored = await AsyncStorage.getItem(TRACKER_STORAGE_KEYS.REMINDERS);
      return safeParse<ReminderRule[]>(stored, []);
    } catch {
      return [];
    }
  }, []);

  /* ---- Initialize ---- */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      setState(prev => ({ ...prev, isLoading: true }));

      try {
        const babyId = await detectCurrentBaby();

        const [customTrackers, entries, lastTracker, reminders] = await Promise.all([
          loadCustomTrackers(),
          babyId ? loadEntries(babyId) : Promise.resolve([]),
          AsyncStorage.getItem(TRACKER_STORAGE_KEYS.LAST_TRACKER),
          loadReminders(),
        ]);

        const safeEntries = Array.isArray(entries) ? entries : [];

        const customIds = new Set(customTrackers.map(t => t.id));
        const mergedTrackers = [
          ...DEFAULT_TRACKERS.filter(t => !customIds.has(t.id)),
          ...customTrackers,
        ];

        const entriesByTracker: Record<string, TrackerEntry[]> = {};
        safeEntries.forEach(entry => {
          if (!entriesByTracker[entry.trackerId]) {
            entriesByTracker[entry.trackerId] = [];
          }
          entriesByTracker[entry.trackerId].push(entry);
        });

        const today = getStartOfDay();
        const todayStart = today.getTime();
        const todayEnd = todayStart + 86400000;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = yesterday.getTime();
        const yesterdayEnd = yesterdayStart + 86400000;

        const todayEntries = safeEntries.filter(e =>
          e.babyId === babyId && !e.isDeleted && e.timestamp >= todayStart && e.timestamp < todayEnd
        );
        const yesterdayEntries = safeEntries.filter(e =>
          e.babyId === babyId && !e.isDeleted && e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd
        );

        const allTrackerIds = [...new Set(safeEntries.filter(e => e.babyId === babyId).map(e => e.trackerId))];
        const streaks = allTrackerIds.map(id => calculateStreak(id, safeEntries, babyId || ''));
        const insights = babyId ? generateInsights(safeEntries, babyId) : [];

        setState({
          isLoading: false,
          trackers: mergedTrackers,
          customTrackers,
          entries: safeEntries,
          entriesByTracker,
          lastTrackerId: lastTracker,
          currentBabyId: babyId,
          progressive: {
            todayEntries,
            yesterdayEntries,
            streaks,
            insights,
            pendingReminders: reminders,
            recentTemplates: [],
            detectedPatterns: [],
          },
        });
      } catch (error) {
        console.error('Tracker init error:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [detectCurrentBaby, loadCustomTrackers, loadEntries, loadReminders]);

  /* ---- Update progressive state when entries change ---- */
  useEffect(() => {
    if (!state.currentBabyId) return;

    const today = getStartOfDay();
    const todayStart = today.getTime();
    const todayEnd = todayStart + 86400000;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = yesterday.getTime();
    const yesterdayEnd = yesterdayStart + 86400000;

    const todayEntries = state.entries.filter(e =>
      e.babyId === state.currentBabyId && !e.isDeleted && e.timestamp >= todayStart && e.timestamp < todayEnd
    );
    const yesterdayEntries = state.entries.filter(e =>
      e.babyId === state.currentBabyId && !e.isDeleted && e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd
    );

    const allTrackerIds = [...new Set(state.entries.filter(e => e.babyId === state.currentBabyId).map(e => e.trackerId))];
    const streaks = allTrackerIds.map(id => calculateStreak(id, state.entries, state.currentBabyId));
    const insights = generateInsights(state.entries, state.currentBabyId);

    setState(prev => ({
      ...prev,
      progressive: {
        ...prev.progressive,
        todayEntries,
        yesterdayEntries,
        streaks,
        insights,
      },
    }));
  }, [state.entries, state.currentBabyId]);

  /* ---- Persist helpers ---- */
  const persistCustomTrackers = useCallback(async (trackers: UnifiedTrackerConfig[]) => {
    try {
      await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.CUSTOM_TRACKERS, JSON.stringify(trackers));
    } catch (error) {
      console.error('Failed to persist custom trackers:', error);
    }
  }, []);

  const persistEntries = useCallback(async (entries: TrackerEntry[]) => {
    if (!state.currentBabyId) return;
    try {
      const key = TRACKER_STORAGE_KEYS.ENTRIES_PREFIX(state.currentBabyId);
      await AsyncStorage.setItem(key, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to persist entries:', error);
    }
  }, [state.currentBabyId]);

  /* ---- Get tracker ---- */
  const getTracker = useCallback((id: string): UnifiedTrackerConfig | undefined => {
    return state.trackers.find(t => t.id === id);
  }, [state.trackers]);

  const getTrackersByCategory = useCallback((category: TrackerCategory): UnifiedTrackerConfig[] => {
    return state.trackers.filter(t => t.category === category);
  }, [state.trackers]);

  const searchTrackers = useCallback((query: string): UnifiedTrackerConfig[] => {
    const q = query.toLowerCase().trim();
    if (!q) return state.trackers;
    return state.trackers.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.quickTags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }, [state.trackers]);

  /* ---- Custom tracker CRUD ---- */
  const handleCreateCustomTracker = useCallback(async (
    name: string,
    emoji: string,
    category: TrackerCategory,
    fields: FieldConfig[],
    options?: Parameters<typeof createCustomTracker>[4]
  ): Promise<UnifiedTrackerConfig | null> => {
    if (!userProfile) {
      sweetAlert('Error', 'You must be signed in to create custom trackers', 'warning');
      return null;
    }

    const newTracker = createCustomTracker(name, emoji, category, fields, userProfile.id, options);
    const validation = validateCustomTracker(newTracker);

    if (!validation.valid) {

Alert.alert('Invalid Tracker', validation.errors.join('\n'));
      return null;
    }

    try {
      const updatedCustom = [...state.customTrackers, newTracker];
      await persistCustomTrackers(updatedCustom);

      setState(prev => ({
        ...prev,
        customTrackers: updatedCustom,
        trackers: [...prev.trackers, newTracker],
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return newTracker;
    } catch (error) {
      sweetAlert('Error', 'Failed to create custom tracker', 'warning');
      return null;
    }
  }, [userProfile, state.customTrackers, persistCustomTrackers]);

  const handleUpdateCustomTracker = useCallback(async (
    id: string,
    updates: Partial<UnifiedTrackerConfig>
  ): Promise<boolean> => {
    const tracker = state.customTrackers.find(t => t.id === id);
    if (!tracker) {
      sweetAlert('Error', 'Custom tracker not found', 'warning');
      return false;
    }
    if (tracker.createdBy !== userProfile?.id && myRole !== 'parent1') {
      sweetAlert('Error', 'Only the creator or Parent 1 can edit this tracker', 'warning');
      return false;
    }

    try {
      const updated = state.customTrackers.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      );
      await persistCustomTrackers(updated);

      setState(prev => ({
        ...prev,
        customTrackers: updated,
        trackers: prev.trackers.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t),
      }));
      return true;
    } catch (error) {
      sweetAlert('Error', 'Failed to update tracker', 'warning');
      return false;
    }
  }, [state.customTrackers, userProfile, myRole, persistCustomTrackers]);

  const handleDeleteCustomTracker = useCallback(async (id: string): Promise<boolean> => {
    const tracker = state.customTrackers.find(t => t.id === id);
    if (!tracker) return false;
    if (tracker.createdBy !== userProfile?.id && myRole !== 'parent1') {
      sweetAlert('Error', 'Only the creator or Parent 1 can delete this tracker', 'warning');
      return false;
    }

    try {
      const updatedEntries = state.entries.map(e =>
        e.trackerId === id ? { ...e, isDeleted: true } : e
      );

      const updatedCustom = state.customTrackers.filter(t => t.id !== id);
      await persistCustomTrackers(updatedCustom);
      await persistEntries(updatedEntries);

      setState(prev => ({
        ...prev,
        customTrackers: updatedCustom,
        trackers: prev.trackers.filter(t => t.id !== id),
        entries: updatedEntries,
      }));
      return true;
    } catch (error) {
      sweetAlert('Error', 'Failed to delete tracker', 'warning');
      return false;
    }
  }, [state.customTrackers, state.entries, userProfile, myRole, persistCustomTrackers, persistEntries]);

  const handleDuplicateTracker = useCallback(async (
    id: string,
    newName: string
  ): Promise<UnifiedTrackerConfig | null> => {
    const original = getTracker(id);
    if (!original) return null;

    return handleCreateCustomTracker(
      newName,
      original.emoji,
      original.category,
      original.fields,
      {
        icon: original.icon,
        color: original.color,
        gradient: original.gradient,
        description: `Copy of ${original.name}: ${original.description}`,
        quickTags: original.quickTags,
        permissions: original.permissions,
      }
    );
  }, [getTracker, handleCreateCustomTracker]);

  /* ---- Entry CRUD ---- */
  const handleAddEntry = useCallback(async (
    trackerId: string,
    data: Record<string, unknown>,
    options?: {
      title?: string;
      notes?: string;
      photoUris?: string[];
      tags?: string[];
    }
  ): Promise<TrackerEntry | null> => {
    if (!canCreateEntry(trackerId)) {
      sweetAlert('Permission Denied', 'You do not have permission to add entries to this tracker', 'warning');
      return null;
    }

    const tracker = getTracker(trackerId);
    if (!tracker) {
      sweetAlert('Error', 'Tracker not found', 'warning');
      return null;
    }

    const missingFields = tracker.fields
      .filter(f => f.required && (data[f.id] === undefined || data[f.id] === '' || data[f.id] === null))
      .map(f => f.label);

    if (missingFields.length > 0) {

Alert.alert('Missing Information', `Please fill in: ${missingFields.join(', ')}`);
      return null;
    }

    try {
      const newEntry: TrackerEntry = {
        id: generateId(),
        babyId: state.currentBabyId || '',
        trackerId,
        timestamp: Date.now(),
        title: options?.title || `${tracker.emoji} ${tracker.name}`,
        data,
        loggedBy: userProfile?.id || 'unknown',
        loggedByName: userProfile?.fullName || 'Unknown',
        loggedByRole: (myRole as any) || 'parent1',
        notes: options?.notes,
        photoUris: options?.photoUris,
        tags: options?.tags,
      };

      const updatedEntries = [newEntry, ...state.entries];
      await persistEntries(updatedEntries);

      // ── Sync to gallery storage ──
      try {
        const allGalleryEntries = await AsyncStorage.getItem(TRACKER_ENTRIES_GALLERY_KEY);
        const galleryParsed: any[] = allGalleryEntries ? JSON.parse(allGalleryEntries) : [];
        galleryParsed.unshift({
          ...newEntry,
          trackerName: tracker.name,
          trackerEmoji: tracker.emoji,
          trackerColor: tracker.color,
        });
        await AsyncStorage.setItem(TRACKER_ENTRIES_GALLERY_KEY, JSON.stringify(galleryParsed));
      } catch (galleryErr) {
        console.error('Failed to sync entry to gallery:', galleryErr);
      }

      const updatedEntriesByTracker = { ...state.entriesByTracker };
      if (!updatedEntriesByTracker[trackerId]) {
        updatedEntriesByTracker[trackerId] = [];
      }
      updatedEntriesByTracker[trackerId] = [newEntry, ...updatedEntriesByTracker[trackerId]];

      await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.LAST_TRACKER, trackerId);

      setState(prev => ({
        ...prev,
        entries: updatedEntries,
        entriesByTracker: updatedEntriesByTracker,
        lastTrackerId: trackerId,
      }));

      try {
        if (state.currentBabyId) {
          const babyKey = BABY_ACTIVITIES_KEY(state.currentBabyId);
          const babyStored = await AsyncStorage.getItem(babyKey);
          const babyActivities: LegacyActivityEntry[] = babyStored ? JSON.parse(babyStored) : [];
          const legacyEntry = syncToLegacyActivity(newEntry);
          babyActivities.unshift(legacyEntry);
          await AsyncStorage.setItem(babyKey, JSON.stringify(babyActivities));
        }
      } catch {}

      if (state.currentBabyId) {
        const streak = calculateStreak(trackerId, updatedEntries, state.currentBabyId);
        if (streak.currentStreak > 0 && streak.currentStreak % 7 === 0) {
          triggerHaptic('success');
          success(
            `${streak.currentStreak} Day Streak!`,
            `You've been consistently tracking ${tracker.name} for ${streak.currentStreak} days! 🎉`
          );
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return newEntry;
    } catch (error) {
      console.error('Failed to add entry:', error);
      sweetAlert('Error', 'Failed to save entry', 'warning');
      return null;
    }
  }, [canCreateEntry, getTracker, state.currentBabyId, userProfile, myRole, state.entries, state.entriesByTracker, persistEntries, triggerHaptic, success]);

  const handleUpdateEntry = useCallback(async (
    entryId: string,
    updates: Partial<TrackerEntry>
  ): Promise<boolean> => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (!canEditEntry(entry)) {
      sweetAlert('Permission Denied', 'You cannot edit this entry', 'warning');
      return false;
    }

    try {
      const updatedEntries = state.entries.map(e =>
        e.id === entryId
          ? { ...e, ...updates, editedBy: userProfile?.id, editedAt: Date.now() }
          : e
      );
      await persistEntries(updatedEntries);

      // ── Update gallery storage if photos changed ──
      if (updates.photoUris !== undefined) {
        try {
          const allGalleryEntries = await AsyncStorage.getItem(TRACKER_ENTRIES_GALLERY_KEY);
          const galleryParsed: any[] = allGalleryEntries ? JSON.parse(allGalleryEntries) : [];
          const updatedGallery = galleryParsed.map(e => 
            e.id === entryId ? { ...e, ...updates } : e
          );
          await AsyncStorage.setItem(TRACKER_ENTRIES_GALLERY_KEY, JSON.stringify(updatedGallery));
        } catch (galleryErr) {
          console.error('Failed to update gallery entry:', galleryErr);
        }
      }

      const updatedEntriesByTracker: Record<string, TrackerEntry[]> = {};
      updatedEntries.forEach(e => {
        if (!updatedEntriesByTracker[e.trackerId]) {
          updatedEntriesByTracker[e.trackerId] = [];
        }
        updatedEntriesByTracker[e.trackerId].push(e);
      });

      setState(prev => ({
        ...prev,
        entries: updatedEntries,
        entriesByTracker: updatedEntriesByTracker,
      }));

      // ── Mark as deleted in gallery storage ──
      try {
        const allGalleryEntries = await AsyncStorage.getItem(TRACKER_ENTRIES_GALLERY_KEY);
        const galleryParsed: any[] = allGalleryEntries ? JSON.parse(allGalleryEntries) : [];
        const updatedGallery = galleryParsed.map(e => 
          e.id === entryId ? { ...e, isDeleted: true } : e
        );
        await AsyncStorage.setItem(TRACKER_ENTRIES_GALLERY_KEY, JSON.stringify(updatedGallery));
      } catch (galleryErr) {
        console.error('Failed to mark gallery entry deleted:', galleryErr);
      }

      return true;
    } catch (error) {
      sweetAlert('Error', 'Failed to update entry', 'warning');
      return false;
    }
  }, [state.entries, canEditEntry, userProfile, persistEntries]);

  const handleDeleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (!canDeleteEntry(entry)) {
      sweetAlert('Permission Denied', 'You cannot delete this entry', 'warning');
      return false;
    }

    try {
      const updatedEntries = state.entries.map(e =>
        e.id === entryId ? { ...e, isDeleted: true } : e
      );
      await persistEntries(updatedEntries);

      // ── Update gallery storage if photos changed ──
      if (updates.photoUris !== undefined) {
        try {
          const allGalleryEntries = await AsyncStorage.getItem(TRACKER_ENTRIES_GALLERY_KEY);
          const galleryParsed: any[] = allGalleryEntries ? JSON.parse(allGalleryEntries) : [];
          const updatedGallery = galleryParsed.map(e => 
            e.id === entryId ? { ...e, ...updates } : e
          );
          await AsyncStorage.setItem(TRACKER_ENTRIES_GALLERY_KEY, JSON.stringify(updatedGallery));
        } catch (galleryErr) {
          console.error('Failed to update gallery entry:', galleryErr);
        }
      }

      const updatedEntriesByTracker: Record<string, TrackerEntry[]> = {};
      updatedEntries.filter(e => !e.isDeleted).forEach(e => {
        if (!updatedEntriesByTracker[e.trackerId]) {
          updatedEntriesByTracker[e.trackerId] = [];
        }
        updatedEntriesByTracker[e.trackerId].push(e);
      });

      setState(prev => ({
        ...prev,
        entries: updatedEntries,
        entriesByTracker: updatedEntriesByTracker,
      }));

      // ── Mark as deleted in gallery storage ──
      try {
        const allGalleryEntries = await AsyncStorage.getItem(TRACKER_ENTRIES_GALLERY_KEY);
        const galleryParsed: any[] = allGalleryEntries ? JSON.parse(allGalleryEntries) : [];
        const updatedGallery = galleryParsed.map(e => 
          e.id === entryId ? { ...e, isDeleted: true } : e
        );
        await AsyncStorage.setItem(TRACKER_ENTRIES_GALLERY_KEY, JSON.stringify(updatedGallery));
      } catch (galleryErr) {
        console.error('Failed to mark gallery entry deleted:', galleryErr);
      }

      return true;
    } catch (error) {
      sweetAlert('Error', 'Failed to delete entry', 'warning');
      return false;
    }
  }, [state.entries, canDeleteEntry, persistEntries]);

  /* ---- Entry queries ---- */
  const handleGetEntries = useCallback((trackerId?: string, limit?: number): TrackerEntry[] => {
    let filtered = state.entries.filter(e => !e.isDeleted);
    if (trackerId) filtered = filtered.filter(e => e.trackerId === trackerId);
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    if (limit && limit > 0) filtered = filtered.slice(0, limit);
    return filtered;
  }, [state.entries]);

  const handleGetEntriesByDate = useCallback((date: Date): TrackerEntry[] => {
    const targetKey = getDateKey(date);
    return state.entries.filter(e => {
      if (e.isDeleted) return false;
      return getDateKey(e.timestamp) === targetKey;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [state.entries]);

  const handleGetEntryById = useCallback((id: string): TrackerEntry | undefined => {
    return state.entries.find(e => e.id === id && !e.isDeleted);
  }, [state.entries]);

  /* ---- Stats ---- */
  const handleGetTrackerStats = useCallback((trackerId: string) => {
    const trackerEntries = state.entries.filter(
      e => e.trackerId === trackerId && !e.isDeleted
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const thisWeek = trackerEntries.filter(e => e.timestamp >= weekAgo.getTime()).length;
    const thisMonth = trackerEntries.filter(e => e.timestamp >= monthAgo.getTime()).length;

    const entryDays = new Set(trackerEntries.map(e => getDateKey(e.timestamp)));
    let streakDays = 0;
    const today = getStartOfDay();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (entryDays.has(getDateKey(checkDate))) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      totalEntries: trackerEntries.length,
      thisWeek,
      thisMonth,
      lastEntry: trackerEntries.sort((a, b) => b.timestamp - a.timestamp)[0] || null,
      streakDays,
    };
  }, [state.entries]);

  const handleGetTodaySummary = useCallback(() => {
    const today = getStartOfDay();
    const todayEntries = state.entries.filter(e =>
      !e.isDeleted && new Date(e.timestamp) >= today
    );

    const counts: Record<string, number> = {};
    todayEntries.forEach(e => {
      counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
    });

    return Object.entries(counts).map(([trackerId, count]) => {
      const tracker = getTracker(trackerId);
      return {
        trackerId,
        count,
        emoji: tracker?.emoji || '📝',
      };
    }).sort((a, b) => b.count - a.count);
  }, [state.entries, getTracker]);

  /* ------------------------------------------------------------------ */
  /*  NEW: Progressive Actions                                          */
  /* ------------------------------------------------------------------ */

  const getSmartSuggestions = useCallback((trackerId: string) => {
    if (!state.currentBabyId) return {};
    return generateSmartSuggestions(trackerId, state.entries, state.currentBabyId);
  }, [state.entries, state.currentBabyId]);

  const getYesterdayData = useCallback((trackerId: string) => {
    if (!state.currentBabyId) return null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
    const end = start + 86400000;

    const yesterdayEntry = state.entries
      .filter(e => e.trackerId === trackerId && e.babyId === state.currentBabyId && !e.isDeleted)
      .find(e => e.timestamp >= start && e.timestamp < end);

    return yesterdayEntry?.data || null;
  }, [state.entries, state.currentBabyId]);

  const getStreak = useCallback((trackerId: string) => {
    if (!state.currentBabyId) return undefined;
    return calculateStreak(trackerId, state.entries, state.currentBabyId);
  }, [state.entries, state.currentBabyId]);

  const getInsights = useCallback(() => {
    if (!state.currentBabyId) return [];
    return generateInsights(state.entries, state.currentBabyId);
  }, [state.entries, state.currentBabyId]);

  const dismissInsight = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      progressive: {
        ...prev.progressive,
        insights: prev.progressive.insights.filter(i => i.id !== id),
      },
    }));
  }, []);

  /* ------------------------------------------------------------------ */
  /*  NEW: Reminder System                                                */
  /* ------------------------------------------------------------------ */

  const scheduleReminder = useCallback(async (
    rule: Omit<ReminderRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const newRule: ReminderRule = {
      ...rule,
      id: `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const stored = await AsyncStorage.getItem(TRACKER_STORAGE_KEYS.REMINDERS);
    const reminders: ReminderRule[] = stored ? JSON.parse(stored) : [];
    reminders.push(newRule);
    await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));

    setState(prev => ({
      ...prev,
      progressive: {
        ...prev.progressive,
        pendingReminders: [...prev.progressive.pendingReminders, newRule],
      },
    }));

    return newRule.id;
  }, []);

  const cancelReminder = useCallback(async (ruleId: string) => {
    const stored = await AsyncStorage.getItem(TRACKER_STORAGE_KEYS.REMINDERS);
    if (stored) {
      const reminders: ReminderRule[] = JSON.parse(stored);
      const updated = reminders.filter(r => r.id !== ruleId);
      await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.REMINDERS, JSON.stringify(updated));
    }

    setState(prev => ({
      ...prev,
      progressive: {
        ...prev.progressive,
        pendingReminders: prev.progressive.pendingReminders.filter(r => r.id !== ruleId),
      },
    }));
  }, []);

  const getPendingReminders = useCallback(() => {
    return state.progressive.pendingReminders;
  }, [state.progressive.pendingReminders]);

  const snoozeReminder = useCallback(async (ruleId: string, minutes: number) => {
    toast('Reminder Snoozed', `We'll remind you again in ${minutes} minutes.`, 'info');
  }, [toast]);

  /* ------------------------------------------------------------------ */
  /*  NEW: Template System                                                */
  /* ------------------------------------------------------------------ */

  const saveTemplate = useCallback(async (
    trackerId: string,
    name: string,
    data: Record<string, unknown>
  ) => {
    const key = TRACKER_STORAGE_KEYS.TEMPLATES(trackerId);
    const stored = await AsyncStorage.getItem(key);
    const templates = stored ? JSON.parse(stored) : [];

    templates.push({
      id: `template_${Date.now()}`,
      name,
      emoji: '⭐',
      data,
    });

    await AsyncStorage.setItem(key, JSON.stringify(templates));
  }, []);

  const getTemplates = useCallback(async (trackerId: string) => {
    const key = TRACKER_STORAGE_KEYS.TEMPLATES(trackerId);
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }, []);

  /* ------------------------------------------------------------------ */
  /*  NEW: Entry Linking                                                  */
  /* ------------------------------------------------------------------ */

  const linkEntries = useCallback(async (
    entryId1: string,
    entryId2: string,
    relation: TrackerEntry['linkedEntries'][0]['relation'],
    description?: string
  ) => {
    const updated = state.entries.map(e => {
      if (e.id === entryId1) {
        const linked = e.linkedEntries || [];
        return {
          ...e,
          linkedEntries: [...linked, {
            entryId: entryId2,
            trackerId: state.entries.find(en => en.id === entryId2)?.trackerId || '',
            relation,
            description,
          }],
        };
      }
      if (e.id === entryId2) {
        const linked = e.linkedEntries || [];
        return {
          ...e,
          linkedEntries: [...linked, {
            entryId: entryId1,
            trackerId: state.entries.find(en => en.id === entryId1)?.trackerId || '',
            relation: 'related',
            description,
          }],
        };
      }
      return e;
    });

    setState(prev => ({ ...prev, entries: updated }));
    await persistEntries(updated);
  }, [state.entries, persistEntries]);

  const getLinkedEntries = useCallback((entryId: string) => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry?.linkedEntries) return [];

    return entry.linkedEntries
      .map(link => state.entries.find(e => e.id === link.entryId))
      .filter(Boolean) as TrackerEntry[];
  }, [state.entries]);

  /* ------------------------------------------------------------------ */
  /*  Legacy sync                                                        */
  /* ------------------------------------------------------------------ */

  const syncToLegacyActivity = useCallback((entry: TrackerEntry): LegacyActivityEntry => {
    const tracker = getTracker(entry.trackerId);
    const data = entry.data;

    const legacyEntry: LegacyActivityEntry = {
      id: entry.id,
      babyId: entry.babyId,
      type: entry.trackerId as LegacyActivityType,
      timestamp: entry.timestamp,
      title: entry.title,
      details: entry.notes,
      icon: tracker?.icon,
      loggedBy: entry.loggedBy,
      loggedByName: entry.loggedByName,
      notes: entry.notes,
      photo: entry.photoUris?.[0],        // Keep for backward compat
      photos: entry.photoUris,            // Add full array for new code
      tags: entry.tags,
      notificationId: entry.notificationId,
      reminderScheduled: entry.reminderScheduled,
      syncedAt: entry.syncedAt,
    };

    if (data) {
      if (data.feedType) legacyEntry.feedType = String(data.feedType);
      if (data.amount) legacyEntry.amount = String(data.amount);
      if (data.duration) legacyEntry.duration = String(data.duration);
      if (data.side) legacyEntry.side = String(data.side);
      if (data.food) legacyEntry.food = String(data.food);
      if (data.sleepType) legacyEntry.sleepType = String(data.sleepType);
      if (data.quality) legacyEntry.quality = Number(data.quality);
      if (data.location) legacyEntry.location = String(data.location);
      if (data.measurementType) legacyEntry.measurementType = String(data.measurementType);
      if (data.value) legacyEntry.value = String(data.value);
      if (data.unit) legacyEntry.unit = String(data.unit);
      if (data.percentile) legacyEntry.percentile = Number(data.percentile);
      if (data.name) legacyEntry.medName = String(data.name);
      if (data.dosage) legacyEntry.dosage = String(data.dosage);
      if (data.reason) legacyEntry.reason = String(data.reason);
      if (data.title) legacyEntry.milestoneType = String(data.title);
      if (data.firstTime !== undefined) legacyEntry.firstTime = Boolean(data.firstTime);
      if (data.description) legacyEntry.description = String(data.description);
      if (data.symptoms) legacyEntry.symptoms = Array.isArray(data.symptoms) ? data.symptoms.map(String) : [];
      if (data.severity) legacyEntry.severity = Number(data.severity);
      if (data.value && entry.trackerId === 'temperature') legacyEntry.tempValue = Number(data.value);
      if (data.unit && entry.trackerId === 'temperature') legacyEntry.tempUnit = String(data.unit);
      if (data.method) legacyEntry.method = String(data.method);
      if (data.type && entry.trackerId === 'potty') legacyEntry.pottyType = String(data.type);
      if (data.successful !== undefined) legacyEntry.successful = Boolean(data.successful);
    }

    return legacyEntry;
  }, [getTracker]);

  const handleGetLegacyActivities = useCallback((): LegacyActivityEntry[] => {
    return state.entries
      .filter(e => !e.isDeleted)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(syncToLegacyActivity);
  }, [state.entries, syncToLegacyActivity]);

  const syncFromBabyContext = useCallback(async () => {
    if (!state.currentBabyId) return;
    try {
      const babyKey = BABY_ACTIVITIES_KEY(state.currentBabyId);
      const stored = await AsyncStorage.getItem(babyKey);
      if (!stored) return;
      const babyActivities: LegacyActivityEntry[] = JSON.parse(stored);
      console.log(`Synced ${babyActivities.length} activities from BabyContext`);
    } catch {}
  }, [state.currentBabyId]);

  /* ---- Refresh ---- */
  const refreshTrackers = useCallback(async () => {
    const custom = await loadCustomTrackers();
    const customIds = new Set(custom.map(t => t.id));
    setState(prev => ({
      ...prev,
      customTrackers: custom,
      trackers: [
        ...DEFAULT_TRACKERS.filter(t => !customIds.has(t.id)),
        ...custom,
      ],
    }));
  }, [loadCustomTrackers]);

  const refreshEntries = useCallback(async () => {
    if (!state.currentBabyId) return;
    const entries = await loadEntries(state.currentBabyId);
    const safeEntries = Array.isArray(entries) ? entries : [];
    const entriesByTracker: Record<string, TrackerEntry[]> = {};
    safeEntries.forEach(entry => {
      if (!entriesByTracker[entry.trackerId]) {
        entriesByTracker[entry.trackerId] = [];
      }
      entriesByTracker[entry.trackerId].push(entry);
    });
    setState(prev => ({ ...prev, entries: safeEntries, entriesByTracker }));
  }, [state.currentBabyId, loadEntries]);

  /* ---- Set current baby ---- */
  const setCurrentBabyId = useCallback((babyId: string | null) => {
    setState(prev => ({ ...prev, currentBabyId: babyId }));
    if (babyId) {
      loadEntries(babyId).then(entries => {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const entriesByTracker: Record<string, TrackerEntry[]> = {};
        safeEntries.forEach(entry => {
          if (!entriesByTracker[entry.trackerId]) {
            entriesByTracker[entry.trackerId] = [];
          }
          entriesByTracker[entry.trackerId].push(entry);
        });
        setState(prev => ({ ...prev, entries: safeEntries, entriesByTracker }));
      });
    }
  }, [loadEntries]);

  /* ---- Memoized value ---- */
  const value = useMemo<TrackerContextType>(() => ({
    ...state,
    getTracker,
    getTrackersByCategory,
    searchTrackers,
    createCustomTracker: handleCreateCustomTracker,
    updateCustomTracker: handleUpdateCustomTracker,
    deleteCustomTracker: handleDeleteCustomTracker,
    duplicateTracker: handleDuplicateTracker,
    addEntry: handleAddEntry,
    updateEntry: handleUpdateEntry,
    deleteEntry: handleDeleteEntry,
    getEntries: handleGetEntries,
    getEntriesByDate: handleGetEntriesByDate,
    getEntryById: handleGetEntryById,
    getTrackerStats: handleGetTrackerStats,
    getTodaySummary: handleGetTodaySummary,
    canUseTracker,
    canCreateEntry,
    canEditEntry,
    canDeleteEntry,
    getSmartSuggestions,
    getYesterdayData,
    getStreak,
    getInsights,
    dismissInsight,
    scheduleReminder,
    cancelReminder,
    getPendingReminders,
    snoozeReminder,
    saveTemplate,
    getTemplates,
    linkEntries,
    getLinkedEntries,
    syncToLegacyActivity,
    getLegacyActivities: handleGetLegacyActivities,
    syncFromBabyContext,
    refreshTrackers,
    refreshEntries,
    setCurrentBabyId,
  }), [
    state,
    getTracker,
    getTrackersByCategory,
    searchTrackers,
    handleCreateCustomTracker,
    handleUpdateCustomTracker,
    handleDeleteCustomTracker,
    handleDuplicateTracker,
    handleAddEntry,
    handleUpdateEntry,
    handleDeleteEntry,
    handleGetEntries,
    handleGetEntriesByDate,
    handleGetEntryById,
    handleGetTrackerStats,
    handleGetTodaySummary,
    canUseTracker,
    canCreateEntry,
    canEditEntry,
    canDeleteEntry,
    getSmartSuggestions,
    getYesterdayData,
    getStreak,
    getInsights,
    dismissInsight,
    scheduleReminder,
    cancelReminder,
    getPendingReminders,
    snoozeReminder,
    saveTemplate,
    getTemplates,
    linkEntries,
    getLinkedEntries,
    syncToLegacyActivity,
    handleGetLegacyActivities,
    syncFromBabyContext,
    refreshTrackers,
    refreshEntries,
    setCurrentBabyId,
  ]);

  return (
    <TrackerContext.Provider value={value}>
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = (): TrackerContextType => {
  const context = useContext(TrackerContext);
  if (!context) throw new Error('useTracker must be used within TrackerProvider');
  return context;
};

export default TrackerProvider;