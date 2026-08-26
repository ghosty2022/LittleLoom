// src/context/TrackerContext.tsx
// Full Supabase implementation - Reads baby data from BabyContext

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';

import {
  UnifiedTrackerConfig,
  TrackerEntry,
  TrackerCategory,
  FieldConfig,
  TRACKER_STORAGE_KEYS,
  TrackerStreak,
  TrackerInsight,
  ReminderRule,
  ProgressiveTrackerState,
} from '@/types/trackers';

import { useAuth } from '@/context/AuthContext';
import { useFamily } from '@/context/FamilyContext';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/components/SweetAlert';
import { createCustomTracker, validateCustomTracker, DEFAULT_TRACKERS } from '@/config/defaultTrackers';
import { useBaby } from './BabyContext';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type LegacyActivityType = string;

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
  notes?: string;
  photo?: string;
  photos?: string[];
  tags?: string[];
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  [key: string]: unknown;
}

interface TrackerState {
  isLoading: boolean;
  trackers: UnifiedTrackerConfig[];
  customTrackers: UnifiedTrackerConfig[];
  entries: TrackerEntry[];
  entriesByTracker: Record<string, TrackerEntry[]>;
  lastTrackerId: string | null;
  // REMOVED: currentBabyId - now read from BabyContext
  progressive: ProgressiveTrackerState;
}

interface TrackerContextType extends Omit<TrackerState, 'currentBabyId'> {
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

  addEntry: (
    trackerId: string,
    data: Record<string, unknown>,
    options?: {
      title?: string;
      notes?: string;
      photoUris?: string[];
      tags?: string[];
    }
  ) => Promise<TrackerEntry | null>;

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

  linkEntries: (
    entryId1: string,
    entryId2: string,
    relation: TrackerEntry['linkedEntries'][0]['relation'],
    description?: string
  ) => Promise<void>;

  getLinkedEntries: (entryId: string) => TrackerEntry[];

  syncToLegacyActivity: (entry: TrackerEntry) => LegacyActivityEntry;
  getLegacyActivities: () => LegacyActivityEntry[];
  syncFromBabyContext: () => Promise<void>;

  refreshTrackers: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  
  // NEW: Get the current baby ID from BabyContext
  getCurrentBabyId: () => string | null;
}

const TrackerContext = createContext<TrackerContextType | null>(null);

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

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

const DISMISSED_INSIGHTS_KEY = '@littleloom_dismissed_tracker_insights';
const EDIT_HISTORY_KEY = '@littleloom_edit_history_v1';

/* ─── STREAK CALCULATION ───────────────────────────────────────────── */

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

/* ─── INSIGHT GENERATION ───────────────────────────────────────────── */

const generateInsights = (
  entries: TrackerEntry[],
  currentBabyId: string
): TrackerInsight[] => {
  const insights: TrackerInsight[] = [];
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const dayKey = getDateKey(new Date(now));

  const recentEntries = entries.filter(e =>
    e.babyId === currentBabyId && !e.isDeleted && e.timestamp >= weekAgo
  );

  // Medication streak insight
  const medEntries = recentEntries.filter(e => e.trackerId === 'medication');
  if (medEntries.length >= 3) {
    const streak = calculateStreak('medication', entries, currentBabyId);
    if (streak.currentStreak >= 3) {
      insights.push({
        id: `med_streak_${dayKey}`,
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

  // Temperature insight
  const tempEntries = recentEntries.filter(e => e.trackerId === 'temperature');
  if (tempEntries.length >= 2) {
    const temps = tempEntries.map(e => {
      const val = Number(e.data['value']);
      const unit = e.data['unit'] as string;
      return unit === 'fahrenheit' ? (val - 32) * 5 / 9 : val;
    }).filter(t => !isNaN(t));

    if (temps.length >= 2) {
      const lastTemp = temps[temps.length - 1];
      if (lastTemp > 38) {
        insights.push({
          id: `temp_high_${dayKey}`,
          trackerId: 'temperature',
          type: 'anomaly',
          title: 'Elevated Temperature Detected',
          description: `Latest reading: ${lastTemp.toFixed(1)}°C. Consider monitoring closely.`,
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

  // Sleep quality insight
  const sleepEntries = recentEntries.filter(e => e.trackerId === 'sleep');
  if (sleepEntries.length >= 5) {
    const qualities = sleepEntries.map(e => Number(e.data['quality']) || 0).filter(q => q > 0);
    if (qualities.length >= 3) {
      const avg = qualities.reduce((a, b) => a + b, 0) / qualities.length;
      if (avg < 3) {
        insights.push({
          id: `sleep_low_${dayKey}`,
          trackerId: 'sleep',
          type: 'pattern',
          title: 'Sleep Quality Trending Low',
          description: `Average sleep quality: ${avg.toFixed(1)}/5. Consider reviewing bedtime routine.`,
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

  return insights;
};

/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const { members } = useFamily();
  const { triggerHaptic } = useCustomization();
  const { success, toast, alert: sweetAlert } = useSweetAlert();
  
  // ─── READ BABY FROM BABYCONTEXT ──────────────────────────────────────
  const { getCurrentBabyId: getBabyIdFromContext, subscribeToBabyChanges } = useBaby();

  const [state, setState] = useState<TrackerState>({
    isLoading: true,
    trackers: [],
    customTrackers: [],
    entries: [],
    entriesByTracker: {},
    lastTrackerId: null,
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
  const dismissedInsightIdsRef = useRef<Set<string>>(new Set());
  const currentBabyIdRef = useRef<string | null>(null);

  // ─── Subscribe to baby changes from BabyContext ─────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToBabyChanges((babyId) => {
      console.log('[TrackerContext] Baby changed to:', babyId);
      currentBabyIdRef.current = babyId;
      // Auto-refresh entries when baby changes
      if (babyId) {
        refreshEntries();
      } else {
        setState(prev => ({
          ...prev,
          entries: [],
          entriesByTracker: {},
        }));
      }
    });

    // Initial sync
    const initialBabyId = getBabyIdFromContext();
    if (initialBabyId) {
      currentBabyIdRef.current = initialBabyId;
    }

    return unsubscribe;
  }, [subscribeToBabyChanges, getBabyIdFromContext]);

  // ─── Detect initial baby ────────────────────────────────────────────
  const getCurrentBabyId = useCallback((): string | null => {
    return currentBabyIdRef.current;
  }, []);

  /* ─── Permission helpers ──────────────────────────────────────────── */

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

  /* ─── Load helpers ───────────────────────────────────────────────── */

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
      const { data, error } = await supabase
        .from('tracker_entries')
        .select('*')
        .eq('baby_id', babyId)
        .eq('is_deleted', false)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[Tracker] loadEntries error:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        babyId: row.baby_id,
        trackerId: row.tracker_id,
        timestamp: row.timestamp,
        title: row.title || '',
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        loggedBy: row.logged_by || '',
        loggedByName: row.logged_by_name || '',
        loggedByRole: (row.logged_by_role as any) || 'parent1',
        notes: row.notes || undefined,
        photoUris: row.photo_uris || undefined,
        tags: row.tags || undefined,
        location: row.location ? { name: row.location } : undefined,
        mood: row.mood || undefined,
        notificationId: row.notification_id || undefined,
        reminderScheduled: row.reminder_scheduled || false,
        syncedAt: row.synced_at || undefined,
        editedBy: row.edited_by || undefined,
        editedAt: row.edited_at || undefined,
        isDeleted: row.is_deleted || false,
        linkedEntries: [],
      }));
    } catch (error) {
      console.error('[Tracker] loadEntries error:', error);
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

  /* ─── Initialize ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      setState(prev => ({ ...prev, isLoading: true }));

      try {
        const babyId = getCurrentBabyId();

        const [customTrackers, entries, lastTracker, reminders, dismissedRaw] = await Promise.all([
          loadCustomTrackers(),
          babyId ? loadEntries(babyId) : Promise.resolve([]),
          AsyncStorage.getItem(TRACKER_STORAGE_KEYS.LAST_TRACKER),
          loadReminders(),
          AsyncStorage.getItem(DISMISSED_INSIGHTS_KEY),
        ]);

        dismissedInsightIdsRef.current = new Set(safeParse<string[]>(dismissedRaw, []));

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
        const streaks = babyId
          ? allTrackerIds.map(id => calculateStreak(id, safeEntries, babyId))
          : [];
        const insights = babyId
          ? generateInsights(safeEntries, babyId).filter(i => !dismissedInsightIdsRef.current.has(i.id))
          : [];

        setState({
          isLoading: false,
          trackers: mergedTrackers,
          customTrackers,
          entries: safeEntries,
          entriesByTracker,
          lastTrackerId: lastTracker || null,
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
  }, [loadCustomTrackers, loadEntries, loadReminders, getCurrentBabyId]);

  /* ─── Update progressive state ───────────────────────────────────── */

  useEffect(() => {
    const babyId = getCurrentBabyId();
    if (!babyId) return;

    const today = getStartOfDay();
    const todayStart = today.getTime();
    const todayEnd = todayStart + 86400000;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = yesterday.getTime();
    const yesterdayEnd = yesterdayStart + 86400000;

    const todayEntries = state.entries.filter(e =>
      e.babyId === babyId && !e.isDeleted && e.timestamp >= todayStart && e.timestamp < todayEnd
    );
    const yesterdayEntries = state.entries.filter(e =>
      e.babyId === babyId && !e.isDeleted && e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd
    );

    const allTrackerIds = [...new Set(state.entries.filter(e => e.babyId === babyId).map(e => e.trackerId))];
    const streaks = allTrackerIds.map(id => calculateStreak(id, state.entries, babyId));
    const insights = generateInsights(state.entries, babyId)
      .filter(i => !dismissedInsightIdsRef.current.has(i.id));

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
  }, [state.entries, getCurrentBabyId]);

  /* ─── Persist helpers ────────────────────────────────────────────── */

  const persistCustomTrackers = useCallback(async (trackers: UnifiedTrackerConfig[]) => {
    try {
      await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.CUSTOM_TRACKERS, JSON.stringify(trackers));
    } catch (error) {
      console.error('Failed to persist custom trackers:', error);
    }
  }, []);

  /* ─── Tracker operations ─────────────────────────────────────────── */

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

  /* ─── Custom tracker CRUD ────────────────────────────────────────── */

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
  }, [userProfile, state.customTrackers, persistCustomTrackers, sweetAlert]);

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
  }, [state.customTrackers, userProfile, myRole, persistCustomTrackers, sweetAlert]);

  const handleDeleteCustomTracker = useCallback(async (id: string): Promise<boolean> => {
    const tracker = state.customTrackers.find(t => t.id === id);
    if (!tracker) return false;
    if (tracker.createdBy !== userProfile?.id && myRole !== 'parent1') {
      sweetAlert('Error', 'Only the creator or Parent 1 can delete this tracker', 'warning');
      return false;
    }

    try {
      const updatedCustom = state.customTrackers.filter(t => t.id !== id);
      await persistCustomTrackers(updatedCustom);

      setState(prev => ({
        ...prev,
        customTrackers: updatedCustom,
        trackers: prev.trackers.filter(t => t.id !== id),
      }));
      return true;
    } catch (error) {
      sweetAlert('Error', 'Failed to delete tracker', 'warning');
      return false;
    }
  }, [state.customTrackers, userProfile, myRole, persistCustomTrackers, sweetAlert]);

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
        description: `Copy of ${original.name}`,
        quickTags: original.quickTags,
        permissions: original.permissions,
      }
    );
  }, [getTracker, handleCreateCustomTracker]);

  /* ─── Entry CRUD ──────────────────────────────────────────────────── */

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
    const babyId = getCurrentBabyId();
    if (!babyId) {
      sweetAlert('Error', 'No baby profile selected. Please select a baby first.', 'warning');
      return null;
    }

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
      const newId = generateId();
      const now = new Date().toISOString();
      const newEntry: TrackerEntry = {
        id: newId,
        babyId: babyId,
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
        linkedEntries: [],
        isDeleted: false,
      };

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_id: trackerId,
          baby_id: babyId,
          timestamp: Date.now(),
          title: options?.title || `${tracker.emoji} ${tracker.name}`,
          data: data,
          notes: options?.notes || null,
          photo_uris: options?.photoUris || null,
          tags: options?.tags || null,
          logged_by: userProfile?.id || 'unknown',
          logged_by_name: userProfile?.fullName || 'Unknown',
          logged_by_role: (myRole as any) || 'parent1',
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Failed to add entry:', error);
        sweetAlert('Error', 'Failed to save entry', 'warning');
        return null;
      }

      const updatedEntries = [newEntry, ...state.entries];

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

      if (babyId) {
        const streak = calculateStreak(trackerId, updatedEntries, babyId);
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
  }, [canCreateEntry, getTracker, getCurrentBabyId, userProfile, myRole, state.entries, state.entriesByTracker, triggerHaptic, success, sweetAlert]);

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
      // Save edit history to AsyncStorage
      try {
        const rawHistory = await AsyncStorage.getItem(EDIT_HISTORY_KEY);
        const historyStore: Record<string, unknown[]> = rawHistory ? JSON.parse(rawHistory) : {};
        const versionList = Array.isArray(historyStore[entryId]) ? historyStore[entryId] : [];
        versionList.push({
          editedAt: Date.now(),
          editedBy: userProfile?.id,
          editedByName: userProfile?.fullName || 'Unknown',
          prevTitle: entry.title,
          prevNotes: entry.notes,
          prevTimestamp: entry.timestamp,
          prevData: entry.data as Record<string, unknown>,
          prevPhotoUris: entry.photoUris,
          prevTags: entry.tags,
        });
        historyStore[entryId] = versionList.slice(-20);
        await AsyncStorage.setItem(EDIT_HISTORY_KEY, JSON.stringify(historyStore));
      } catch {}

      const remoteUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        edited_by: userProfile?.id,
        edited_at: Date.now(),
      };

      if (updates.title !== undefined) remoteUpdates.title = updates.title;
      if (updates.data !== undefined) remoteUpdates.data = updates.data;
      if (updates.notes !== undefined) remoteUpdates.notes = updates.notes;
      if (updates.photoUris !== undefined) remoteUpdates.photo_uris = updates.photoUris;
      if (updates.tags !== undefined) remoteUpdates.tags = updates.tags;
      if (updates.timestamp !== undefined) remoteUpdates.timestamp = updates.timestamp;

      const { error } = await supabase
        .from('tracker_entries')
        .update(remoteUpdates)
        .eq('id', entryId);

      if (error) {
        console.error('Failed to update entry:', error);
        sweetAlert('Error', 'Failed to update entry', 'warning');
        return false;
      }

      const updatedEntries = state.entries.map(e =>
        e.id === entryId ? { ...e, ...updates, editedBy: userProfile?.id, editedAt: Date.now() } : e
      );

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

      return true;
    } catch (error) {
      console.error('Failed to update entry:', error);
      sweetAlert('Error', 'Failed to update entry', 'warning');
      return false;
    }
  }, [state.entries, canEditEntry, userProfile, sweetAlert]);

  const handleDeleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (!canDeleteEntry(entry)) {
      sweetAlert('Permission Denied', 'You cannot delete this entry', 'warning');
      return false;
    }

    try {
      const { error } = await supabase
        .from('tracker_entries')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) {
        console.error('Failed to delete entry:', error);
        sweetAlert('Error', 'Failed to delete entry', 'warning');
        return false;
      }

      const updatedEntries = state.entries.map(e =>
        e.id === entryId ? { ...e, isDeleted: true } : e
      );

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

      return true;
    } catch (error) {
      console.error('Failed to delete entry:', error);
      sweetAlert('Error', 'Failed to delete entry', 'warning');
      return false;
    }
  }, [state.entries, canDeleteEntry, sweetAlert]);

  /* ─── Entry queries ──────────────────────────────────────────────── */

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

  /* ─── Stats ──────────────────────────────────────────────────────── */

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
    const babyId = getCurrentBabyId();
    if (!babyId) return [];

    const today = getStartOfDay();
    const todayEntries = state.entries.filter(e =>
      !e.isDeleted && e.babyId === babyId && new Date(e.timestamp) >= today
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
  }, [state.entries, getTracker, getCurrentBabyId]);

  /* ─── Progressive actions ────────────────────────────────────────── */

  const getSmartSuggestions = useCallback((trackerId: string) => {
    return {};
  }, []);

  const getYesterdayData = useCallback((trackerId: string) => {
    const babyId = getCurrentBabyId();
    if (!babyId) return null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
    const end = start + 86400000;

    const yesterdayEntry = state.entries
      .filter(e => e.trackerId === trackerId && e.babyId === babyId && !e.isDeleted)
      .find(e => e.timestamp >= start && e.timestamp < end);

    return yesterdayEntry?.data || null;
  }, [state.entries, getCurrentBabyId]);

  const getStreak = useCallback((trackerId: string) => {
    const babyId = getCurrentBabyId();
    if (!babyId) return undefined;
    return calculateStreak(trackerId, state.entries, babyId);
  }, [state.entries, getCurrentBabyId]);

  const getInsights = useCallback(() => {
    const babyId = getCurrentBabyId();
    if (!babyId) return [];
    return generateInsights(state.entries, babyId)
      .filter(i => !dismissedInsightIdsRef.current.has(i.id));
  }, [state.entries, getCurrentBabyId]);

  const dismissInsight = useCallback((id: string) => {
    dismissedInsightIdsRef.current.add(id);
    AsyncStorage
      .setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify([...dismissedInsightIdsRef.current]))
      .catch(() => {});
    setState(prev => ({
      ...prev,
      progressive: {
        ...prev.progressive,
        insights: prev.progressive.insights.filter(i => i.id !== id),
      },
    }));
  }, []);

  /* ─── Reminders ──────────────────────────────────────────────────── */

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

  /* ─── Templates ──────────────────────────────────────────────────── */

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

  /* ─── Entry linking ─────────────────────────────────────────────── */

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
  }, [state.entries]);

  const getLinkedEntries = useCallback((entryId: string) => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry?.linkedEntries) return [];

    return entry.linkedEntries
      .map(link => state.entries.find(e => e.id === link.entryId))
      .filter(Boolean) as TrackerEntry[];
  }, [state.entries]);

  /* ─── Legacy sync ────────────────────────────────────────────────── */

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
      photo: entry.photoUris?.[0],
      photos: entry.photoUris,
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

  const syncFromBabyContext = useCallback(async () => {}, []);

  /* ─── Refresh ────────────────────────────────────────────────────── */

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
    const babyId = getCurrentBabyId();
    if (!babyId) {
      setState(prev => ({
        ...prev,
        entries: [],
        entriesByTracker: {},
      }));
      return;
    }
    try {
      const entries = await loadEntries(babyId);
      const safeEntries = Array.isArray(entries) ? entries : [];
      const entriesByTracker: Record<string, TrackerEntry[]> = {};
      safeEntries.forEach(entry => {
        if (!entriesByTracker[entry.trackerId]) {
          entriesByTracker[entry.trackerId] = [];
        }
        entriesByTracker[entry.trackerId].push(entry);
      });
      setState(prev => ({ ...prev, entries: safeEntries, entriesByTracker }));
    } catch (err) {
      console.error('[TrackerContext] refreshEntries failed:', err);
    }
  }, [getCurrentBabyId, loadEntries]);

  /* ─── Memoized value ────────────────────────────────────────────── */

  const value = useMemo<TrackerContextType>(() => ({
    isLoading: state.isLoading,
    trackers: state.trackers,
    customTrackers: state.customTrackers,
    entries: state.entries,
    entriesByTracker: state.entriesByTracker,
    lastTrackerId: state.lastTrackerId,
    progressive: state.progressive,
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
    // NEW: Pass through the baby ID getter
    getCurrentBabyId,
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
    getCurrentBabyId,
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

export { TrackerContext };
export default TrackerProvider;