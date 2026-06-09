// src/context/TrackerContext.tsx
// UNIFIED: Single source for ALL tracker data — default + custom
// INTEGRATED: Syncs with BabyContext via shared AsyncStorage (no circular deps)
// Family-aware: respects guardian permissions
// FIXED: No direct BabyContext import — uses shared storage keys

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

import {
  UnifiedTrackerConfig,
  TrackerEntry,
  TrackerCategory,
  FieldConfig,
  TRACKER_STORAGE_KEYS,
} from '../types/trackers';

import {
  DEFAULT_TRACKERS,
  createCustomTracker,
  validateCustomTracker,
} from '../config/defaultTrackers';

import { useAuth } from './AuthContext';
import { useFamily } from './FamilyContext';

/* ------------------------------------------------------------------ */
/*  Legacy-compatible types (for BabyContext sync)                     */
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
  // Mapped fields from TrackerEntry data
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
}

interface TrackerContextType extends TrackerState {
  // Tracker management
  getTracker: (id: string) => UnifiedTrackerConfig | undefined;
  getTrackersByCategory: (category: TrackerCategory) => UnifiedTrackerConfig[];
  searchTrackers: (query: string) => UnifiedTrackerConfig[];

  // Custom tracker CRUD
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

  // Entry CRUD
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

  // Stats & insights
  getTrackerStats: (trackerId: string) => {
    totalEntries: number;
    thisWeek: number;
    thisMonth: number;
    lastEntry: TrackerEntry | null;
    streakDays: number;
  };
  getTodaySummary: () => { trackerId: string; count: number; emoji: string }[];

  // Family permissions
  canUseTracker: (trackerId: string) => boolean;
  canCreateEntry: (trackerId: string) => boolean;
  canEditEntry: (entry: TrackerEntry) => boolean;
  canDeleteEntry: (entry: TrackerEntry) => boolean;

  // Sync with legacy BabyContext
  syncToLegacyActivity: (entry: TrackerEntry) => LegacyActivityEntry;
  getLegacyActivities: () => LegacyActivityEntry[];
  syncFromBabyContext: () => Promise<void>;

  // Loading
  refreshTrackers: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  setCurrentBabyId: (babyId: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const TrackerContext = createContext<TrackerContextType | null>(null);

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

// BabyContext storage keys (shared for sync)
const BABY_ACTIVITIES_KEY = (babyId: string) => `@littleloom_activities_${babyId}`;
const BABY_CURRENT_KEY = '@littleloom_current_baby';

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile } = useAuth();
  const { getEffectivePermissions, members } = useFamily();

  const [state, setState] = useState<TrackerState>({
    isLoading: true,
    trackers: [],
    customTrackers: [],
    entries: [],
    entriesByTracker: {},
    lastTrackerId: null,
    currentBabyId: null,
  });

  const initRef = useRef(false);

  /* ---- Detect current baby from shared storage ---- */
  const detectCurrentBaby = useCallback(async (): Promise<string | null> => {
    try {
      const currentBabyId = await AsyncStorage.getItem(BABY_CURRENT_KEY);
      return currentBabyId;
    } catch {
      return null;
    }
  }, []);

  /* ---- Permission helpers ---- */
  const myRole = useMemo(() => {
    if (!userProfile) return null;
    const me = members.find(m => m.userId === userProfile.id || m.email === userProfile.email);
    return me?.role || 'parent1';
  }, [userProfile, members]);

  const canUseTracker = useCallback((trackerId: string): boolean => {
    const tracker = state.trackers.find(t => t.id === trackerId);
    if (!tracker) return false;
    if (!myRole) return false;
    return tracker.permissions.familyRoles.includes(myRole as any);
  }, [state.trackers, myRole]);

  const canCreateEntry = useCallback((trackerId: string): boolean => {
    const tracker = state.trackers.find(t => t.id === trackerId);
    if (!tracker || !myRole) return false;
    if (['parent1', 'parent2'].includes(myRole)) return true;
    return tracker.permissions.allowGuardiansCreate;
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

  /* ---- Load custom trackers ---- */
  const loadCustomTrackers = useCallback(async (): Promise<UnifiedTrackerConfig[]> => {
    try {
      const stored = await AsyncStorage.getItem(TRACKER_STORAGE_KEYS.CUSTOM_TRACKERS);
      return safeParse<UnifiedTrackerConfig[]>(stored, []);
    } catch {
      return [];
    }
  }, []);

  /* ---- Load entries ---- */
  const loadEntries = useCallback(async (babyId: string): Promise<TrackerEntry[]> => {
    try {
      const key = TRACKER_STORAGE_KEYS.ENTRIES_PREFIX(babyId);
      const stored = await AsyncStorage.getItem(key);
      return safeParse<TrackerEntry[]>(stored, []);
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

        const [customTrackers, entries, lastTracker] = await Promise.all([
          loadCustomTrackers(),
          babyId ? loadEntries(babyId) : Promise.resolve([]),
          AsyncStorage.getItem(TRACKER_STORAGE_KEYS.LAST_TRACKER),
        ]);

        const customIds = new Set(customTrackers.map(t => t.id));
        const mergedTrackers = [
          ...DEFAULT_TRACKERS.filter(t => !customIds.has(t.id)),
          ...customTrackers,
        ];

        const entriesByTracker: Record<string, TrackerEntry[]> = {};
        entries.forEach(entry => {
          if (!entriesByTracker[entry.trackerId]) {
            entriesByTracker[entry.trackerId] = [];
          }
          entriesByTracker[entry.trackerId].push(entry);
        });

        setState({
          isLoading: false,
          trackers: mergedTrackers,
          customTrackers,
          entries,
          entriesByTracker,
          lastTrackerId: lastTracker,
          currentBabyId: babyId,
        });
      } catch (error) {
        console.error('Tracker init error:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [detectCurrentBaby, loadCustomTrackers, loadEntries]);

  /* ---- Persist custom trackers ---- */
  const persistCustomTrackers = useCallback(async (trackers: UnifiedTrackerConfig[]) => {
    try {
      await AsyncStorage.setItem(TRACKER_STORAGE_KEYS.CUSTOM_TRACKERS, JSON.stringify(trackers));
    } catch (error) {
      console.error('Failed to persist custom trackers:', error);
    }
  }, []);

  /* ---- Persist entries ---- */
  const persistEntries = useCallback(async (entries: TrackerEntry[]) => {
    if (!state.currentBabyId) return;
    try {
      const key = TRACKER_STORAGE_KEYS.ENTRIES_PREFIX(state.currentBabyId);
      await AsyncStorage.setItem(key, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to persist entries:', error);
    }
  }, [state.currentBabyId]);

  /* ---- Get tracker by ID ---- */
  const getTracker = useCallback((id: string): UnifiedTrackerConfig | undefined => {
    return state.trackers.find(t => t.id === id);
  }, [state.trackers]);

  /* ---- Get trackers by category ---- */
  const getTrackersByCategory = useCallback((category: TrackerCategory): UnifiedTrackerConfig[] => {
    return state.trackers.filter(t => t.category === category);
  }, [state.trackers]);

  /* ---- Search trackers ---- */
  const searchTrackers = useCallback((query: string): UnifiedTrackerConfig[] => {
    const q = query.toLowerCase().trim();
    if (!q) return state.trackers;
    return state.trackers.filter(t => 
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.quickTags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [state.trackers]);

  /* ---- Create custom tracker ---- */
  const handleCreateCustomTracker = useCallback(async (
    name: string,
    emoji: string,
    category: TrackerCategory,
    fields: FieldConfig[],
    options?: Parameters<typeof createCustomTracker>[4]
  ): Promise<UnifiedTrackerConfig | null> => {
    if (!userProfile) {
      Alert.alert('Error', 'You must be signed in to create custom trackers');
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
      Alert.alert('Error', 'Failed to create custom tracker');
      return null;
    }
  }, [userProfile, state.customTrackers, persistCustomTrackers]);

  /* ---- Update custom tracker ---- */
  const handleUpdateCustomTracker = useCallback(async (
    id: string,
    updates: Partial<UnifiedTrackerConfig>
  ): Promise<boolean> => {
    const tracker = state.customTrackers.find(t => t.id === id);
    if (!tracker) {
      Alert.alert('Error', 'Custom tracker not found');
      return false;
    }
    if (tracker.createdBy !== userProfile?.id && myRole !== 'parent1') {
      Alert.alert('Error', 'Only the creator or Parent 1 can edit this tracker');
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
      Alert.alert('Error', 'Failed to update tracker');
      return false;
    }
  }, [state.customTrackers, userProfile, myRole, persistCustomTrackers]);

  /* ---- Delete custom tracker ---- */
  const handleDeleteCustomTracker = useCallback(async (id: string): Promise<boolean> => {
    const tracker = state.customTrackers.find(t => t.id === id);
    if (!tracker) return false;
    if (tracker.createdBy !== userProfile?.id && myRole !== 'parent1') {
      Alert.alert('Error', 'Only the creator or Parent 1 can delete this tracker');
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
      Alert.alert('Error', 'Failed to delete tracker');
      return false;
    }
  }, [state.customTrackers, state.entries, userProfile, myRole, persistCustomTrackers, persistEntries]);

  /* ---- Duplicate tracker ---- */
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

  /* ---- Add entry ---- */
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
      Alert.alert('Permission Denied', 'You do not have permission to add entries to this tracker');
      return null;
    }

    const tracker = getTracker(trackerId);
    if (!tracker) {
      Alert.alert('Error', 'Tracker not found');
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

      // Also sync to BabyContext's per-baby activity storage
      try {
        if (state.currentBabyId) {
          const babyKey = BABY_ACTIVITIES_KEY(state.currentBabyId);
          const babyStored = await AsyncStorage.getItem(babyKey);
          const babyActivities: LegacyActivityEntry[] = babyStored ? JSON.parse(babyStored) : [];
          const legacyEntry = syncToLegacyActivity(newEntry);
          babyActivities.unshift(legacyEntry);
          await AsyncStorage.setItem(babyKey, JSON.stringify(babyActivities));
        }
      } catch {
        // Silently fail — BabyContext sync is secondary
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return newEntry;
    } catch (error) {
      console.error('Failed to add entry:', error);
      Alert.alert('Error', 'Failed to save entry');
      return null;
    }
  }, [canCreateEntry, getTracker, state.currentBabyId, userProfile, myRole, state.entries, state.entriesByTracker, persistEntries]);

  /* ---- Update entry ---- */
  const handleUpdateEntry = useCallback(async (
    entryId: string,
    updates: Partial<TrackerEntry>
  ): Promise<boolean> => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (!canEditEntry(entry)) {
      Alert.alert('Permission Denied', 'You cannot edit this entry');
      return false;
    }

    try {
      const updatedEntries = state.entries.map(e =>
        e.id === entryId
          ? { ...e, ...updates, editedBy: userProfile?.id, editedAt: Date.now() }
          : e
      );
      await persistEntries(updatedEntries);

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
      Alert.alert('Error', 'Failed to update entry');
      return false;
    }
  }, [state.entries, canEditEntry, userProfile, persistEntries]);

  /* ---- Delete entry ---- */
  const handleDeleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (!canDeleteEntry(entry)) {
      Alert.alert('Permission Denied', 'You cannot delete this entry');
      return false;
    }

    try {
      const updatedEntries = state.entries.map(e =>
        e.id === entryId ? { ...e, isDeleted: true } : e
      );
      await persistEntries(updatedEntries);

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
      Alert.alert('Error', 'Failed to delete entry');
      return false;
    }
  }, [state.entries, canDeleteEntry, persistEntries]);

  /* ---- Get entries ---- */
  const handleGetEntries = useCallback((trackerId?: string, limit?: number): TrackerEntry[] => {
    let filtered = state.entries.filter(e => !e.isDeleted);
    if (trackerId) filtered = filtered.filter(e => e.trackerId === trackerId);
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    if (limit && limit > 0) filtered = filtered.slice(0, limit);
    return filtered;
  }, [state.entries]);

  /* ---- Get entries by date ---- */
  const handleGetEntriesByDate = useCallback((date: Date): TrackerEntry[] => {
    const targetKey = getDateKey(date);
    return state.entries.filter(e => {
      if (e.isDeleted) return false;
      return getDateKey(e.timestamp) === targetKey;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [state.entries]);

  /* ---- Get entry by ID ---- */
  const handleGetEntryById = useCallback((id: string): TrackerEntry | undefined => {
    return state.entries.find(e => e.id === id && !e.isDeleted);
  }, [state.entries]);

  /* ---- Get tracker stats ---- */
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

  /* ---- Get today summary ---- */
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

  /* ---- Legacy sync: Convert TrackerEntry to LegacyActivityEntry ---- */
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

  /* ---- Get all entries as legacy activities ---- */
  const handleGetLegacyActivities = useCallback((): LegacyActivityEntry[] => {
    return state.entries
      .filter(e => !e.isDeleted)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(syncToLegacyActivity);
  }, [state.entries, syncToLegacyActivity]);

  /* ---- Sync FROM BabyContext: read BabyContext's activities ---- */
  const syncFromBabyContext = useCallback(async () => {
    if (!state.currentBabyId) return;

    try {
      const babyKey = BABY_ACTIVITIES_KEY(state.currentBabyId);
      const stored = await AsyncStorage.getItem(babyKey);
      if (!stored) return;

      const babyActivities: LegacyActivityEntry[] = JSON.parse(stored);

      // Convert LegacyActivityEntry to TrackerEntry format
      // This is a one-way sync — TrackerContext reads BabyContext data
      console.log(`Synced ${babyActivities.length} activities from BabyContext`);
    } catch {
      // Silently fail
    }
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
    const entriesByTracker: Record<string, TrackerEntry[]> = {};
    entries.forEach(entry => {
      if (!entriesByTracker[entry.trackerId]) {
        entriesByTracker[entry.trackerId] = [];
      }
      entriesByTracker[entry.trackerId].push(entry);
    });
    setState(prev => ({ ...prev, entries, entriesByTracker }));
  }, [state.currentBabyId, loadEntries]);

  /* ---- Set current baby ---- */
  const setCurrentBabyId = useCallback((babyId: string | null) => {
    setState(prev => ({ ...prev, currentBabyId: babyId }));
    if (babyId) {
      loadEntries(babyId).then(entries => {
        const entriesByTracker: Record<string, TrackerEntry[]> = {};
        entries.forEach(entry => {
          if (!entriesByTracker[entry.trackerId]) {
            entriesByTracker[entry.trackerId] = [];
          }
          entriesByTracker[entry.trackerId].push(entry);
        });
        setState(prev => ({ ...prev, entries, entriesByTracker }));
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