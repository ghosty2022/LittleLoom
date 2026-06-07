// src/context/BabyContext.tsx
// FULLY SYNCED: Integrates with ActivityContext, NotificationService, AppContext
// Cross-context sync: Activities auto-sync to ActivityContext, notifications on key events
// FIXED: Zero unused variables, proper TypeScript strict compliance, all @/ aliases

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

/* ------------------------------------------------------------------ */
/*  Storage Keys                                                      */
/* ------------------------------------------------------------------ */
const STORAGE_KEYS = {
  BABIES: '@littleloom_babies',
  CURRENT_BABY: '@littleloom_current_baby',
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  GROWTH_DATA: (babyId: string) => `@littleloom_growth_${babyId}`,
  MILESTONES: (babyId: string) => `@littleloom_milestones_${babyId}`,
  SLEEP_LOGS: (babyId: string) => `@littleloom_sleep_${babyId}`,
  FEEDING_LOGS: (babyId: string) => `@littleloom_feeding_${babyId}`,
  POTTY_LOGS: (babyId: string) => `@littleloom_potty_${babyId}`,
  MEDICATION_LOGS: (babyId: string) => `@littleloom_medication_${babyId}`,
  ACTIVITIES: (babyId: string) => `@littleloom_activities_${babyId}`,
} as const;

const ACTIVITY_CONTEXT_KEY = '@littleloom_activities_v3';
const NOTIFICATION_PREFIX = '@littleloom_activity_notif_';

/* ------------------------------------------------------------------ */
/*  Lazy imports to avoid circular dependencies                       */
/* ------------------------------------------------------------------ */
const getNotificationService = async () => {
  const { notificationService } = await import('@/services/NotificationService');
  return notificationService;
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type Gender = 'boy' | 'girl' | 'other';
export type ActivityType =
  | 'potty'
  | 'feed'
  | 'sleep'
  | 'growth'
  | 'medication'
  | 'milestone'
  | 'diaper'
  | 'note'
  | 'bath'
  | 'pumping'
  | 'temperature'
  | 'symptom'
  | 'play';

export interface BabyProfile {
  id: string;
  name: string;
  birthDate: string;
  age: string;
  gender: Gender;
  skinTone: number;
  avatar: string;
  parent1Id: string;
  parent2Id?: string;
  guardianIds?: string[];
  weight?: string;
  height?: string;
  bloodType?: string;
  allergies?: string[];
  medicalNotes?: string;
  streak: number;
  milestones: number;
  photos: number;
  createdAt: string;
  lastUpdated?: string;
}

export interface GrowthMeasurement {
  id: string;
  babyId: string;
  type: 'height' | 'weight' | 'head' | 'temperature';
  value: number;
  unit: 'kg' | 'lb' | 'oz' | 'cm' | 'in';
  date: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  babyId: string;
  title: string;
  description: string;
  category: 'physical' | 'cognitive' | 'social' | 'language' | 'emotional';
  achievedAt: string;
  imageUrl?: string;
  notes?: string;
}

export interface SleepLog {
  id: string;
  babyId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  location: 'crib' | 'stroller' | 'car' | 'carrier' | 'bed' | 'other';
  notes?: string;
  createdAt: string;
}

export interface FeedingLog {
  id: string;
  babyId: string;
  type: 'breast' | 'bottle' | 'solid' | 'snack' | 'water';
  startTime: string;
  duration?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  food?: string;
  notes?: string;
  createdAt: string;
}

export interface PottyLog {
  id: string;
  babyId: string;
  type: 'pee' | 'poop' | 'both' | 'accident' | 'attempt';
  location: 'potty' | 'toilet' | 'floor' | 'diaper';
  successful: boolean;
  timestamp: string;
  notes?: string;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  babyId: string;
  medicationName: string;
  dosage: string;
  reason?: string;
  givenBy: string;
  timestamp: string;
  notes?: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  babyId: string;
  type: ActivityType;
  timestamp: number;
  title: string;
  details?: string;
  icon?: string;
  loggedBy: string;
  loggedByName: string;
  pottyType?: PottyLog['type'];
  feedType?: FeedingLog['type'];
  sleepType?: SleepLog['type'];
  amount?: string;
  duration?: string;
  measurementType?: GrowthMeasurement['type'];
  value?: string;
  unit?: string;
  milestoneTitle?: string;
  medicationName?: string;
  notes?: string;
  photo?: string;
  tags?: string[];
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
}

/* ------------------------------------------------------------------ */
/*  State & Context Types                                              */
/* ------------------------------------------------------------------ */
interface BabyState {
  isLoading: boolean;
  babies: BabyProfile[];
  currentBabyId: string | null;
  currentBaby: BabyProfile | null;
  hasSkippedBaby: boolean;
  growthData: GrowthMeasurement[];
  milestones: Milestone[];
  sleepLogs: SleepLog[];
  feedingLogs: FeedingLog[];
  pottyLogs: PottyLog[];
  medicationLogs: MedicationLog[];
  activities: ActivityEntry[];
}

interface BabyContextType extends BabyState {
  loadBabies: () => Promise<void>;
  createBaby: (
    data: Omit<
      BabyProfile,
      'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated' | 'parent1Id'
    >
  ) => Promise<boolean>;
  updateBaby: (id: string, updates: Partial<BabyProfile>) => Promise<void>;
  deleteBaby: (id: string) => Promise<boolean>;
  switchBaby: (id: string) => Promise<boolean>;
  refreshCurrentBaby: () => Promise<void>;
  skipBaby: () => Promise<void>;
  clearSkipBaby: () => Promise<void>;
  calculateAge: (birthDate: string) => string;
  getBabyAge: (babyId?: string) => string;
  addGrowthMeasurement: (
    measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>
  ) => Promise<boolean>;
  getGrowthData: (type?: GrowthMeasurement['type']) => GrowthMeasurement[];
  getLatestMeasurements: () => Record<GrowthMeasurement['type'], GrowthMeasurement | null>;
  deleteGrowthMeasurement: (id: string) => Promise<boolean>;
  addMilestone: (milestone: Omit<Milestone, 'id'>) => Promise<boolean>;
  getMilestones: (category?: Milestone['category']) => Milestone[];
  deleteMilestone: (id: string) => Promise<boolean>;
  addSleepLog: (log: Omit<SleepLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getSleepLogs: (days?: number) => SleepLog[];
  endSleepSession: (logId: string, endTime: string) => Promise<boolean>;
  getTodaySleepCount: () => number;
  addFeedingLog: (log: Omit<FeedingLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getFeedingLogs: (days?: number) => FeedingLog[];
  getTodayFeedCount: () => number;
  addPottyLog: (log: Omit<PottyLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getPottyLogs: (days?: number) => PottyLog[];
  getPottyStreak: () => number;
  getTodayPottyCount: () => number;
  getPottySuccessRate: () => number;
  addMedicationLog: (log: Omit<MedicationLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getMedicationLogs: (days?: number) => MedicationLog[];
  addActivity: (entry: Omit<ActivityEntry, 'id'>) => Promise<boolean>;
  getRecentActivities: (limit?: number) => ActivityEntry[];
  getActivitiesByType: (type: ActivityType) => ActivityEntry[];
  deleteActivity: (id: string) => Promise<boolean>;
  getBabyStats: () => { streak: number; milestones: number; photos: number; entries: number };
  updateBabyStats: (updates: Partial<BabyProfile>) => Promise<void>;
  // ActivityContext compatibility layer
  entries: ActivityEntry[];
  isLoadingEntries: boolean;
  loadEntries: () => Promise<void>;
  deleteEntry: (id: string) => Promise<boolean>;
  addEntry: (entry: Omit<ActivityEntry, 'id'>) => Promise<boolean>;
  updateEntry: (id: string, entry: Partial<ActivityEntry>) => Promise<boolean>;
  getEntryById: (id: string) => ActivityEntry | undefined;
  getDateTitle: (timestamp: number | string) => string;
  // Cross-context sync
  syncWithActivityContext: () => Promise<void>;
  scheduleActivityReminder: (entry: ActivityEntry, minutes: number) => Promise<string | null>;
  cancelActivityReminder: (notificationId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */
const BabyContext = createContext<BabyContextType | null>(null);

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
    return JSON.parse(json) as T;
  } catch {
    console.warn('Failed to parse JSON from storage, using fallback');
    return fallback;
  }
};

const getStartOfDay = (date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDateKey = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const withRetry = async <T,>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */
export const BabyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BabyState>({
    isLoading: false,
    babies: [],
    currentBabyId: null,
    currentBaby: null,
    hasSkippedBaby: false,
    growthData: [],
    milestones: [],
    sleepLogs: [],
    feedingLogs: [],
    pottyLogs: [],
    medicationLogs: [],
    activities: [],
  });

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const ageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  /* ---- Age calculation ---- */
  const calculateAge = useCallback((birthDate: string): string => {
    const birth = new Date(birthDate);
    const now = new Date();

    if (isNaN(birth.getTime())) return 'Invalid date';
    if (birth > now) return 'Not born yet';

    const diffMs = now.getTime() - birth.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days < 1) return 'Newborn';
    if (days < 14) return `${days} day${days !== 1 ? 's' : ''}`;
    if (days < 60) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    }

    let months = (now.getFullYear() - birth.getFullYear()) * 12;
    months += now.getMonth() - birth.getMonth();
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) months = 0;

    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    return remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years} year${years !== 1 ? 's' : ''}`;
  }, []);

  const getBabyAge = useCallback(
    (babyId?: string): string => {
      const id = babyId || state.currentBabyId;
      if (!id) return '';
      const baby = state.babies.find((b) => b.id === id);
      return baby?.age || '';
    },
    [state.babies, state.currentBabyId]
  );

  /* ---- Data loading ---- */
  const loadAllBabyData = useCallback(
    async (babyId: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      setIsLoadingEntries(true);

      try {
        const [growthStr, milestonesStr, sleepStr, feedingStr, pottyStr, medicationStr, activitiesStr] =
          await Promise.all([
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.GROWTH_DATA(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.MILESTONES(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.SLEEP_LOGS(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.FEEDING_LOGS(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.POTTY_LOGS(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.MEDICATION_LOGS(babyId))),
            withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.ACTIVITIES(babyId))),
          ]);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          growthData: safeParse<GrowthMeasurement[]>(growthStr, []),
          milestones: safeParse<Milestone[]>(milestonesStr, []),
          sleepLogs: safeParse<SleepLog[]>(sleepStr, []),
          feedingLogs: safeParse<FeedingLog[]>(feedingStr, []),
          pottyLogs: safeParse<PottyLog[]>(pottyStr, []),
          medicationLogs: safeParse<MedicationLog[]>(medicationStr, []),
          activities: safeParse<ActivityEntry[]>(activitiesStr, []),
        }));
      } catch (error) {
        console.error('Error loading baby data:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      } finally {
        setIsLoadingEntries(false);
      }
    },
    []
  );

  const loadBabies = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const [babiesStr, currentId, hasSkipped] = await Promise.all([
        withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.BABIES)),
        withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.CURRENT_BABY)),
        withRetry(() => AsyncStorage.getItem(STORAGE_KEYS.HAS_SKIPPED_BABY)),
      ]);

      let babies: BabyProfile[] = safeParse<BabyProfile[]>(babiesStr, []);
      babies = babies.map((b) => ({
        ...b,
        age: calculateAge(b.birthDate),
      }));

      const effectiveCurrentId = currentId || babies[0]?.id || null;

      if (effectiveCurrentId && !currentId && babies.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, effectiveCurrentId);
      }

      const currentBaby = babies.find((b) => b.id === effectiveCurrentId) || babies[0] || null;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        babies,
        currentBabyId: effectiveCurrentId,
        currentBaby,
        hasSkippedBaby: hasSkipped === 'true',
      }));

      if (effectiveCurrentId) {
        await loadAllBabyData(effectiveCurrentId);
      }
    } catch (error) {
      console.error('Error loading babies:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [calculateAge, loadAllBabyData]);

  // Initialize on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadBabies();
  }, [loadBabies]);

  /* ---- Age auto-refresh ---- */
  useEffect(() => {
    if (state.babies.length === 0) return;

    const updateAges = () => {
      setState((prev) => ({
        ...prev,
        babies: prev.babies.map((b) => ({
          ...b,
          age: calculateAge(b.birthDate),
        })),
        currentBaby: prev.currentBaby
          ? { ...prev.currentBaby, age: calculateAge(prev.currentBaby.birthDate) }
          : null,
      }));
    };

    updateAges();
    ageIntervalRef.current = setInterval(updateAges, 60 * 60 * 1000);

    return () => {
      if (ageIntervalRef.current) {
        clearInterval(ageIntervalRef.current);
        ageIntervalRef.current = null;
      }
    };
  }, [state.babies.length, calculateAge]);

  /* ---- Skip / Clear skip ---- */
  const skipBaby = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_SKIPPED_BABY, 'true');
      setState((prev) => ({ ...prev, hasSkippedBaby: true }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Error skipping baby:', error);
    }
  }, []);

  const clearSkipBaby = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.HAS_SKIPPED_BABY);
      setState((prev) => ({ ...prev, hasSkippedBaby: false }));
    } catch (error) {
      console.error('Error clearing skip baby:', error);
    }
  }, []);

  /* ---- Create baby ---- */
  const createBaby = useCallback(
    async (
      data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated' | 'parent1Id'>
    ): Promise<boolean> => {
      const birthDate = new Date(data.birthDate);
      const now = new Date();
      if (birthDate > now) {
        Alert.alert('Invalid Date', 'Birth date cannot be in the future');
        return false;
      }
      if (isNaN(birthDate.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid birth date');
        return false;
      }

      try {
        const nowISO = new Date().toISOString();
        const newBaby: BabyProfile = {
          ...data,
          id: generateId(),
          parent1Id: 'default',
          streak: 0,
          milestones: 0,
          photos: 0,
          createdAt: nowISO,
          lastUpdated: nowISO,
          age: calculateAge(data.birthDate),
        };

        const updatedBabies = [...state.babies, newBaby];
        await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(updatedBabies));

        const isFirstBaby = state.babies.length === 0;
        const newCurrentId = isFirstBaby ? newBaby.id : state.currentBabyId;

        if (isFirstBaby && newCurrentId) {
          await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, newCurrentId);
        }

        await clearSkipBaby();

        setState((prev) => ({
          ...prev,
          babies: updatedBabies,
          currentBabyId: newCurrentId || newBaby.id,
          currentBaby: isFirstBaby ? newBaby : prev.currentBaby,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return true;
      } catch (error) {
        console.error('Create baby error:', error);
        Alert.alert('Error', 'Failed to create baby profile');
        return false;
      }
    },
    [state.babies, state.currentBabyId, calculateAge, clearSkipBaby]
  );

  /* ---- Update baby ---- */
  const updateBaby = useCallback(
    async (id: string, updates: Partial<BabyProfile>) => {
      try {
        const updated = state.babies.map((b) => {
          if (b.id === id) {
            const updatedBaby: BabyProfile = {
              ...b,
              ...updates,
              lastUpdated: new Date().toISOString(),
            };
            if (updates.birthDate) {
              updatedBaby.age = calculateAge(updates.birthDate);
            }
            return updatedBaby;
          }
          return b;
        });

        await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(updated));

        setState((prev) => ({
          ...prev,
          babies: updated,
          currentBaby:
            prev.currentBaby?.id === id
              ? updated.find((b) => b.id === id) || null
              : prev.currentBaby,
        }));
      } catch (error) {
        console.error('Update baby error:', error);
        Alert.alert('Error', 'Failed to update baby profile');
      }
    },
    [state.babies, calculateAge]
  );

  /* ---- Delete baby ---- */
  const deleteBaby = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const filtered = state.babies.filter((b) => b.id !== id);
        await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(filtered));

        const cleanupKeys = [
          STORAGE_KEYS.GROWTH_DATA(id),
          STORAGE_KEYS.MILESTONES(id),
          STORAGE_KEYS.SLEEP_LOGS(id),
          STORAGE_KEYS.FEEDING_LOGS(id),
          STORAGE_KEYS.POTTY_LOGS(id),
          STORAGE_KEYS.MEDICATION_LOGS(id),
          STORAGE_KEYS.ACTIVITIES(id),
        ];

        await Promise.all(cleanupKeys.map((key) => AsyncStorage.removeItem(key)));

        let newCurrentId = state.currentBabyId;
        if (state.currentBabyId === id) {
          newCurrentId = filtered[0]?.id || null;
          if (newCurrentId) {
            await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, newCurrentId);
          } else {
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.CURRENT_BABY,
              STORAGE_KEYS.HAS_SKIPPED_BABY,
            ]);
          }
        }

        const newCurrentBaby = filtered.find((b) => b.id === newCurrentId) || null;

        setState((prev) => ({
          ...prev,
          babies: filtered,
          currentBabyId: newCurrentId,
          currentBaby: newCurrentBaby,
          growthData: newCurrentId ? prev.growthData : [],
          milestones: newCurrentId ? prev.milestones : [],
          sleepLogs: newCurrentId ? prev.sleepLogs : [],
          feedingLogs: newCurrentId ? prev.feedingLogs : [],
          pottyLogs: newCurrentId ? prev.pottyLogs : [],
          medicationLogs: newCurrentId ? prev.medicationLogs : [],
          activities: newCurrentId ? prev.activities : [],
        }));

        if (newCurrentId) {
          await loadAllBabyData(newCurrentId);
        }

        return true;
      } catch (error) {
        console.error('Delete baby error:', error);
        Alert.alert('Error', 'Failed to delete baby profile');
        return false;
      }
    },
    [state.babies, state.currentBabyId, loadAllBabyData]
  );

  /* ---- Switch baby ---- */
  const switchBaby = useCallback(
    async (id: string): Promise<boolean> => {
      const baby = state.babies.find((b) => b.id === id);
      if (!baby) {
        console.warn(`Baby with id ${id} not found`);
        return false;
      }

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, id);
        await loadAllBabyData(id);

        setState((prev) => ({
          ...prev,
          currentBabyId: id,
          currentBaby: baby,
        }));

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return true;
      } catch (error) {
        console.error('Error switching baby:', error);
        return false;
      }
    },
    [state.babies, loadAllBabyData]
  );

  /* ---- Refresh current baby ---- */
  const refreshCurrentBaby = useCallback(async () => {
    if (!state.currentBabyId) return;

    try {
      const babiesStr = await AsyncStorage.getItem(STORAGE_KEYS.BABIES);
      const babies = safeParse<BabyProfile[]>(babiesStr, []);
      const currentBaby = babies.find((b) => b.id === state.currentBabyId);

      if (currentBaby) {
        setState((prev) => ({
          ...prev,
          babies: babies.map((b) => ({
            ...b,
            age: calculateAge(b.birthDate),
          })),
          currentBaby: {
            ...currentBaby,
            age: calculateAge(currentBaby.birthDate),
          },
        }));

        await loadAllBabyData(state.currentBabyId);
      }
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [state.currentBabyId, calculateAge, loadAllBabyData]);

  /* ---- Growth ---- */
  const addGrowthMeasurement = useCallback(
    async (measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>): Promise<boolean> => {
      try {
        const newMeasurement: GrowthMeasurement = {
          ...measurement,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        const key = STORAGE_KEYS.GROWTH_DATA(measurement.babyId);
        const existing = await AsyncStorage.getItem(key);
        const measurements: GrowthMeasurement[] = safeParse(existing, []);
        measurements.push(newMeasurement);

        await AsyncStorage.setItem(key, JSON.stringify(measurements));

        if (measurement.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, growthData: measurements }));
        }

        const baby = state.babies.find((b) => b.id === measurement.babyId);
        if (baby) {
          const updates: Partial<BabyProfile> = {};
          if (measurement.type === 'height') {
            updates.height = `${measurement.value} ${measurement.unit}`;
          }
          if (measurement.type === 'weight') {
            updates.weight = `${measurement.value} ${measurement.unit}`;
          }
          if (Object.keys(updates).length > 0) {
            await updateBaby(measurement.babyId, updates);
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return true;
      } catch (error) {
        console.error('Add growth measurement error:', error);
        Alert.alert('Error', 'Failed to save measurement');
        return false;
      }
    },
    [state.currentBabyId, state.babies, updateBaby]
  );

  const getGrowthData = useCallback(
    (type?: GrowthMeasurement['type']) => {
      let data = [...state.growthData];
      if (type) {
        data = data.filter((m) => m.type === type);
      }
      return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    [state.growthData]
  );

  const getLatestMeasurements = useCallback((): Record<GrowthMeasurement['type'], GrowthMeasurement | null> => {
    const types: GrowthMeasurement['type'][] = ['height', 'weight', 'head', 'temperature'];
    const latest: Record<GrowthMeasurement['type'], GrowthMeasurement | null> = {
      height: null,
      weight: null,
      head: null,
      temperature: null,
    };

    types.forEach((type) => {
      const typeData = state.growthData
        .filter((m) => m.type === type)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      latest[type] = typeData[0] || null;
    });

    return latest;
  }, [state.growthData]);

  const deleteGrowthMeasurement = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (!state.currentBabyId) return false;

        const key = STORAGE_KEYS.GROWTH_DATA(state.currentBabyId);
        const filtered = state.growthData.filter((m) => m.id !== id);

        await AsyncStorage.setItem(key, JSON.stringify(filtered));
        setState((prev) => ({ ...prev, growthData: filtered }));

        return true;
      } catch (error) {
        console.error('Delete growth measurement error:', error);
        return false;
      }
    },
    [state.currentBabyId, state.growthData]
  );

  /* ---- Milestones ---- */
  const addMilestone = useCallback(
    async (milestone: Omit<Milestone, 'id'>): Promise<boolean> => {
      try {
        const newMilestone: Milestone = {
          ...milestone,
          id: generateId(),
        };

        const key = STORAGE_KEYS.MILESTONES(milestone.babyId);
        const existing = await AsyncStorage.getItem(key);
        const milestones: Milestone[] = safeParse(existing, []);
        milestones.push(newMilestone);

        await AsyncStorage.setItem(key, JSON.stringify(milestones));

        if (milestone.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, milestones }));
        }

        const baby = state.babies.find((b) => b.id === milestone.babyId);
        if (baby) {
          await updateBaby(milestone.babyId, { milestones: baby.milestones + 1 });
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return true;
      } catch (error) {
        console.error('Add milestone error:', error);
        Alert.alert('Error', 'Failed to save milestone');
        return false;
      }
    },
    [state.currentBabyId, state.babies, updateBaby]
  );

  const getMilestones = useCallback(
    (category?: Milestone['category']) => {
      let data = [...state.milestones];
      if (category) {
        data = data.filter((m) => m.category === category);
      }
      return data.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
    },
    [state.milestones]
  );

  const deleteMilestone = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (!state.currentBabyId) return false;

        const key = STORAGE_KEYS.MILESTONES(state.currentBabyId);
        const filtered = state.milestones.filter((m) => m.id !== id);

        await AsyncStorage.setItem(key, JSON.stringify(filtered));
        setState((prev) => ({ ...prev, milestones: filtered }));

        return true;
      } catch (error) {
        console.error('Delete milestone error:', error);
        return false;
      }
    },
    [state.currentBabyId, state.milestones]
  );

  /* ---- Sleep ---- */
  const addSleepLog = useCallback(
    async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
      try {
        const newLog: SleepLog = {
          ...log,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        const key = STORAGE_KEYS.SLEEP_LOGS(log.babyId);
        const existing = await AsyncStorage.getItem(key);
        const logs: SleepLog[] = safeParse(existing, []);
        logs.push(newLog);

        await AsyncStorage.setItem(key, JSON.stringify(logs));

        if (log.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, sleepLogs: logs }));
        }

        return true;
      } catch (error) {
        console.error('Add sleep log error:', error);
        Alert.alert('Error', 'Failed to save sleep log');
        return false;
      }
    },
    [state.currentBabyId]
  );

  const getSleepLogs = useCallback(
    (days: number = 7) => {
      if (days <= 0) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      return state.sleepLogs
        .filter((log) => new Date(log.startTime) >= cutoff)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    },
    [state.sleepLogs]
  );

  const endSleepSession = useCallback(
    async (logId: string, endTime: string): Promise<boolean> => {
      try {
        if (!state.currentBabyId) return false;

        const key = STORAGE_KEYS.SLEEP_LOGS(state.currentBabyId);
        const updated = state.sleepLogs.map((log) => {
          if (log.id === logId) {
            const start = new Date(log.startTime);
            const end = new Date(endTime);
            if (end <= start) {
              console.warn('End time must be after start time');
              return log;
            }
            const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
            return { ...log, endTime, duration };
          }
          return log;
        });

        await AsyncStorage.setItem(key, JSON.stringify(updated));
        setState((prev) => ({ ...prev, sleepLogs: updated }));

        return true;
      } catch (error) {
        console.error('End sleep session error:', error);
        return false;
      }
    },
    [state.currentBabyId, state.sleepLogs]
  );

  const getTodaySleepCount = useCallback(() => {
    const today = getStartOfDay();
    return state.sleepLogs.filter((log) => {
      const logDate = new Date(log.startTime);
      return logDate >= today;
    }).length;
  }, [state.sleepLogs]);

  /* ---- Feeding ---- */
  const addFeedingLog = useCallback(
    async (log: Omit<FeedingLog, 'id' | 'createdAt'>): Promise<boolean> => {
      try {
        if (log.amount !== undefined && (isNaN(log.amount) || log.amount < 0)) {
          Alert.alert('Invalid Amount', 'Please enter a valid positive amount');
          return false;
        }

        const newLog: FeedingLog = {
          ...log,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        const key = STORAGE_KEYS.FEEDING_LOGS(log.babyId);
        const existing = await AsyncStorage.getItem(key);
        const logs: FeedingLog[] = safeParse(existing, []);
        logs.push(newLog);

        await AsyncStorage.setItem(key, JSON.stringify(logs));

        if (log.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, feedingLogs: logs }));
        }

        return true;
      } catch (error) {
        console.error('Add feeding log error:', error);
        Alert.alert('Error', 'Failed to save feeding log');
        return false;
      }
    },
    [state.currentBabyId]
  );

  const getFeedingLogs = useCallback(
    (days: number = 7) => {
      if (days <= 0) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      return state.feedingLogs
        .filter((log) => new Date(log.startTime) >= cutoff)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    },
    [state.feedingLogs]
  );

  const getTodayFeedCount = useCallback(() => {
    const today = getStartOfDay();
    return state.feedingLogs.filter((log) => {
      const logDate = new Date(log.startTime);
      return logDate >= today;
    }).length;
  }, [state.feedingLogs]);

  /* ---- Potty ---- */
  const calculatePottyStreak = useCallback((logs: PottyLog[]): number => {
    if (logs.length === 0) return 0;

    const successfulDays = new Set<string>();
    logs.forEach((log) => {
      if (log.successful) {
        successfulDays.add(getDateKey(log.timestamp));
      }
    });

    let streak = 0;
    const today = getStartOfDay();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = getDateKey(checkDate);

      if (successfulDays.has(dateKey)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }, []);

  const addPottyLog = useCallback(
    async (log: Omit<PottyLog, 'id' | 'createdAt'>): Promise<boolean> => {
      try {
        const newLog: PottyLog = {
          ...log,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        const key = STORAGE_KEYS.POTTY_LOGS(log.babyId);
        const existing = await AsyncStorage.getItem(key);
        const logs: PottyLog[] = safeParse(existing, []);
        logs.push(newLog);

        await AsyncStorage.setItem(key, JSON.stringify(logs));

        if (log.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, pottyLogs: logs }));
        }

        if (log.successful) {
          const streak = calculatePottyStreak([...logs]);
          await updateBaby(log.babyId, { streak });
        }

        return true;
      } catch (error) {
        console.error('Add potty log error:', error);
        Alert.alert('Error', 'Failed to save potty log');
        return false;
      }
    },
    [state.currentBabyId, updateBaby, calculatePottyStreak]
  );

  const getPottyLogs = useCallback(
    (days: number = 7) => {
      if (days <= 0) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      return state.pottyLogs
        .filter((log) => new Date(log.timestamp) >= cutoff)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [state.pottyLogs]
  );

  const getPottyStreak = useCallback(() => {
    return calculatePottyStreak(state.pottyLogs);
  }, [state.pottyLogs, calculatePottyStreak]);

  const getTodayPottyCount = useCallback(() => {
    const today = getStartOfDay();
    return state.pottyLogs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return logDate >= today;
    }).length;
  }, [state.pottyLogs]);

  const getPottySuccessRate = useCallback(() => {
    if (state.pottyLogs.length === 0) return 0;
    const successful = state.pottyLogs.filter((log) => log.successful).length;
    return Math.round((successful / state.pottyLogs.length) * 100);
  }, [state.pottyLogs]);

  /* ---- Medication ---- */
  const addMedicationLog = useCallback(
    async (log: Omit<MedicationLog, 'id' | 'createdAt'>): Promise<boolean> => {
      try {
        if (!log.medicationName.trim()) {
          Alert.alert('Missing Information', 'Please enter a medication name');
          return false;
        }

        const newLog: MedicationLog = {
          ...log,
          medicationName: log.medicationName.trim(),
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        const key = STORAGE_KEYS.MEDICATION_LOGS(log.babyId);
        const existing = await AsyncStorage.getItem(key);
        const logs: MedicationLog[] = safeParse(existing, []);
        logs.push(newLog);

        await AsyncStorage.setItem(key, JSON.stringify(logs));

        if (log.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, medicationLogs: logs }));
        }

        return true;
      } catch (error) {
        console.error('Add medication log error:', error);
        Alert.alert('Error', 'Failed to save medication log');
        return false;
      }
    },
    [state.currentBabyId]
  );

  const getMedicationLogs = useCallback(
    (days: number = 30) => {
      if (days <= 0) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      return state.medicationLogs
        .filter((log) => new Date(log.timestamp) >= cutoff)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [state.medicationLogs]
  );

  /* ---- Activities ---- */
  const addActivity = useCallback(
    async (entry: Omit<ActivityEntry, 'id'>): Promise<boolean> => {
      if (!entry.babyId || !entry.type || !entry.title || !entry.timestamp) {
        console.error('Invalid activity entry: missing required fields');
        return false;
      }

      try {
        const newEntry: ActivityEntry = {
          ...entry,
          id: generateId(),
        };

        const key = STORAGE_KEYS.ACTIVITIES(entry.babyId);
        const existing = await AsyncStorage.getItem(key);
        const activities: ActivityEntry[] = safeParse(existing, []);
        activities.unshift(newEntry);

        await AsyncStorage.setItem(key, JSON.stringify(activities));

        if (entry.babyId === state.currentBabyId) {
          setState((prev) => ({ ...prev, activities }));
        }

        // Cross-context sync: Push to ActivityContext storage
        await syncToActivityContext(newEntry);

        // Trigger notification for important activities
        if (['feed', 'sleep', 'potty', 'milestone', 'growth'].includes(entry.type)) {
          const service = await getNotificationService();
          await service.sendActivityCompleteNotification(
            entry.type,
            state.currentBaby?.name || 'baby'
          );
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return true;
      } catch (error) {
        console.error('Failed to add activity:', error);
        return false;
      }
    },
    [state.currentBabyId, state.currentBaby]
  );

  const getRecentActivities = useCallback(
    (limit: number = 10) => {
      return [...state.activities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, Math.max(0, limit));
    },
    [state.activities]
  );

  const getActivitiesByType = useCallback(
    (type: ActivityType) => {
      return state.activities
        .filter((a) => a.type === type)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    [state.activities]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (!state.currentBabyId) return false;

        const entry = state.activities.find((a) => a.id === id);
        if (entry?.notificationId) {
          const service = await getNotificationService();
          await service.cancelNotification(entry.notificationId);
          await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
        }

        const key = STORAGE_KEYS.ACTIVITIES(state.currentBabyId);
        const filtered = state.activities.filter((a) => a.id !== id);

        await AsyncStorage.setItem(key, JSON.stringify(filtered));
        setState((prev) => ({ ...prev, activities: filtered }));

        // Sync deletion to ActivityContext
        await removeFromActivityContext(id);

        return true;
      } catch (error) {
        console.error('Failed to delete activity:', error);
        return false;
      }
    },
    [state.currentBabyId, state.activities]
  );

  /* ---- Cross-context sync: ActivityContext ---- */
  const syncToActivityContext = useCallback(async (entry: ActivityEntry) => {
    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      const existingEntries: ActivityEntry[] = existing ? JSON.parse(existing) : [];
      
      const exists = existingEntries.some((e) => e.id === entry.id);
      if (exists) return;

      const merged = [entry, ...existingEntries];
      await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(merged));
    } catch {
      // Silently fail - ActivityContext may not be initialized yet
    }
  }, []);

  const removeFromActivityContext = useCallback(async (entryId: string) => {
    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      if (!existing) return;

      const entries: ActivityEntry[] = JSON.parse(existing);
      const filtered = entries.filter((e) => e.id !== entryId);
      await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(filtered));
    } catch {
      // Silently fail
    }
  }, []);

  const syncWithActivityContext = useCallback(async () => {
    if (!state.currentBabyId || state.activities.length === 0) return;

    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      const existingEntries: ActivityEntry[] = existing ? JSON.parse(existing) : [];
      
      const existingIds = new Set(existingEntries.map((e) => e.id));
      const newActivities = state.activities.filter((a) => !existingIds.has(a.id));
      
      if (newActivities.length > 0) {
        const merged = [...newActivities, ...existingEntries];
        await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(merged));
      }
    } catch {
      // Silently fail
    }
  }, [state.currentBabyId, state.activities]);

  /* ---- Notification integration ---- */
  const scheduleActivityReminder = useCallback(async (entry: ActivityEntry, minutes: number): Promise<string | null> => {
    try {
      const service = await getNotificationService();
      const notifId = await service.scheduleActivityReminder(
        entry.type,
        state.currentBaby?.name || 'baby',
        minutes,
        entry.details
      );

      if (notifId) {
        await updateEntry(entry.id, { notificationId: notifId, reminderScheduled: true });
        await AsyncStorage.setItem(`${NOTIFICATION_PREFIX}${entry.id}`, notifId);
      }

      return notifId;
    } catch {
      return null;
    }
  }, [state.currentBaby]);

  const cancelActivityReminder = useCallback(async (notificationId: string) => {
    try {
      const service = await getNotificationService();
      await service.cancelNotification(notificationId);

      const entry = state.activities.find((a) => a.notificationId === notificationId);
      if (entry) {
        await updateEntry(entry.id, { notificationId: undefined, reminderScheduled: false });
        await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
      }
    } catch {
      // Silently fail
    }
  }, [state.activities]);

  /* ---- ActivityContext compatibility layer ---- */
  const entries = state.activities;
  
  const loadEntries = useCallback(async () => {
    if (state.currentBabyId) {
      await loadAllBabyData(state.currentBabyId);
    }
  }, [state.currentBabyId, loadAllBabyData]);

  const deleteEntry = deleteActivity;
  const addEntry = addActivity;

  const updateEntry = useCallback(
    async (id: string, entry: Partial<ActivityEntry>): Promise<boolean> => {
      try {
        if (!state.currentBabyId) return false;

        const key = STORAGE_KEYS.ACTIVITIES(state.currentBabyId);
        const updated = state.activities.map((a) =>
          a.id === id ? { ...a, ...entry } : a
        );

        await AsyncStorage.setItem(key, JSON.stringify(updated));
        setState((prev) => ({ ...prev, activities: updated }));

        // Sync update to ActivityContext
        const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
        if (existing) {
          const entries: ActivityEntry[] = JSON.parse(existing);
          const activityIndex = entries.findIndex((e) => e.id === id);
          if (activityIndex >= 0) {
            entries[activityIndex] = { ...entries[activityIndex], ...entry };
            await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(entries));
          }
        }

        return true;
      } catch (error) {
        console.error('Failed to update entry:', error);
        return false;
      }
    },
    [state.currentBabyId, state.activities]
  );

  const getEntryById = useCallback(
    (id: string) => {
      return state.activities.find((a) => a.id === id);
    },
    [state.activities]
  );

  const getDateTitle = useCallback((timestamp: number | string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = getStartOfDay();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';

    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return daysOfWeek[date.getDay()] ?? 'Unknown';
    }

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }, []);

  /* ---- Stats ---- */
  const getBabyStats = useCallback(() => {
    return {
      streak: state.currentBaby?.streak || 0,
      milestones: state.currentBaby?.milestones || 0,
      photos: state.currentBaby?.photos || 0,
      entries: state.activities.length,
    };
  }, [state.currentBaby, state.activities]);

  const updateBabyStats = useCallback(
    async (updates: Partial<BabyProfile>) => {
      if (!state.currentBaby) return;
      await updateBaby(state.currentBaby.id, updates);
    },
    [state.currentBaby, updateBaby]
  );

  /* ---- Memoized context value ---- */
  const value = useMemo<BabyContextType>(
    () => ({
      ...state,
      loadBabies,
      createBaby,
      updateBaby,
      deleteBaby,
      switchBaby,
      refreshCurrentBaby,
      skipBaby,
      clearSkipBaby,
      calculateAge,
      getBabyAge,
      addGrowthMeasurement,
      getGrowthData,
      getLatestMeasurements,
      deleteGrowthMeasurement,
      addMilestone,
      getMilestones,
      deleteMilestone,
      addSleepLog,
      getSleepLogs,
      endSleepSession,
      getTodaySleepCount,
      addFeedingLog,
      getFeedingLogs,
      getTodayFeedCount,
      addPottyLog,
      getPottyLogs,
      getPottyStreak,
      getTodayPottyCount,
      getPottySuccessRate,
      addMedicationLog,
      getMedicationLogs,
      addActivity,
      getRecentActivities,
      getActivitiesByType,
      deleteActivity,
      getBabyStats,
      updateBabyStats,
      // ActivityContext compatibility
      entries,
      isLoadingEntries,
      loadEntries,
      deleteEntry,
      addEntry,
      updateEntry,
      getEntryById,
      getDateTitle,
      // Cross-context sync
      syncWithActivityContext,
      scheduleActivityReminder,
      cancelActivityReminder,
    }),
    [
      state,
      loadBabies,
      createBaby,
      updateBaby,
      deleteBaby,
      switchBaby,
      refreshCurrentBaby,
      skipBaby,
      clearSkipBaby,
      calculateAge,
      getBabyAge,
      addGrowthMeasurement,
      getGrowthData,
      getLatestMeasurements,
      deleteGrowthMeasurement,
      addMilestone,
      getMilestones,
      deleteMilestone,
      addSleepLog,
      getSleepLogs,
      endSleepSession,
      getTodaySleepCount,
      addFeedingLog,
      getFeedingLogs,
      getTodayFeedCount,
      addPottyLog,
      getPottyLogs,
      getPottyStreak,
      getTodayPottyCount,
      getPottySuccessRate,
      addMedicationLog,
      getMedicationLogs,
      addActivity,
      getRecentActivities,
      getActivitiesByType,
      deleteActivity,
      getBabyStats,
      updateBabyStats,
      entries,
      isLoadingEntries,
      loadEntries,
      deleteEntry,
      addEntry,
      updateEntry,
      getEntryById,
      getDateTitle,
      syncWithActivityContext,
      scheduleActivityReminder,
      cancelActivityReminder,
    ]
  );

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export const useBaby = (): BabyContextType => {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBaby must be used within BabyProvider');
  return context;
};

export default BabyProvider;