// src/context/ActivityContext.tsx
// Full Supabase-compatible activity tracking - Reads from BabyContext

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  createEntryInDb,
  updateEntryInDb,
  softDeleteEntryInDb,
  getEntriesByBabyFromDb,
  getAppSetting,
  setAppSetting,
} from '@/database/dbHelpers';
import { supabase } from '@/lib/supabase';
import { useBaby } from './BabyContext';

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
  | 'play'
  | string;

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  babyId: string;
  timestamp: number;
  title: string;
  details?: string;
  icon?: string;
  loggedBy: string;
  loggedByName: string;

  // Potty specific
  pottyType?: 'pee' | 'poop' | 'both' | 'accident' | 'attempt';
  location?: 'potty' | 'toilet' | 'floor' | 'diaper';
  successful?: boolean;

  // Feed specific
  feedType?: 'breast' | 'bottle' | 'solid' | 'snack';
  amount?: string;
  duration?: string;
  side?: 'left' | 'right' | 'both';
  food?: string;

  // Sleep specific
  sleepType?: 'nap' | 'night' | 'wake';
  quality?: number;

  // Growth specific
  measurementType?: 'weight' | 'height' | 'head';
  value?: string;
  unit?: 'kg' | 'lb' | 'oz' | 'cm' | 'in';
  percentile?: number;

  // Medication specific
  medName?: string;
  dosage?: string;
  reason?: string;
  givenBy?: 'parent1' | 'parent2' | 'doctor' | 'other';

  // Milestone specific
  milestoneType?: 'motor' | 'cognitive' | 'social' | 'language' | 'other';
  description?: string;
  firstTime?: boolean;

  // Diaper specific
  diaperType?: 'wet' | 'dirty' | 'both' | 'dry';
  rash?: boolean;
  cream?: 'none' | 'zinc' | 'petroleum' | 'other';

  // General
  content?: string;
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired';

  notes?: string;
  photo?: string;
  tags?: string[];

  // System fields
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  deletedAt?: string | null;

  [key: string]: unknown;
}

interface ActivityContextType {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;

  addEntry: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<ActivityEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  restoreEntry: (id: string) => Promise<void>;

  getEntriesByType: (type: ActivityType, babyId?: string) => ActivityEntry[];
  getEntriesByBaby: (babyId: string) => ActivityEntry[];
  getEntriesByDateRange: (startDate: number, endDate: number, babyId?: string) => ActivityEntry[];
  getEntryById: (id: string) => ActivityEntry | undefined;

  getRecentTimelineEvents: (limit?: number, babyId?: string) => ActivityEntry[];
  addTimelineEvent: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;

  getTodayCount: (type: ActivityType, babyId?: string) => number;
  getSuccessRate: (type: ActivityType, babyId?: string) => number;
  getStreak: (type: ActivityType, babyId?: string) => number;

  getDateTitle: (timestamp: number) => string;
  getRelativeTime: (timestamp: number) => string;
  formatDuration: (minutes: number) => string;

  loadEntries: () => Promise<void>;
  syncEntries: () => Promise<void>;
  clearEntries: () => Promise<void>;
  refreshEntries: () => Promise<void>;

  scheduleActivityReminder: (entry: ActivityEntry, minutes: number) => Promise<string | null>;
  cancelActivityReminder: (notificationId: string) => Promise<void>;

  syncWithBabyContext: (babyId: string) => Promise<void>;
  getEntriesForNotification: () => ActivityEntry[];
  
  // Supabase-specific methods
  syncWithSupabase: () => Promise<void>;
  pushToSupabase: (entry: ActivityEntry) => Promise<void>;
  pullFromSupabase: (babyId: string) => Promise<void>;
  
  // NEW: Get current baby ID
  getCurrentBabyId: () => string | null;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const STORAGE_KEY = '@littleloom_activities_v3';
const NOTIFICATION_PREFIX = '@littleloom_activity_notif_';

const getNotificationService = async () => {
  try {
    const { notificationService } = await import('@/services/NotificationService');
    return notificationService;
  } catch {
    return null;
  }
};

export function getDateTitle(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const dateCopy = new Date(date);
  const nowCopy = new Date(now);
  dateCopy.setHours(0, 0, 0, 0);
  nowCopy.setHours(0, 0, 0, 0);

  const diffTime = nowCopy.getTime() - dateCopy.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()] ?? 'Unknown';
  }
  if (diffDays < 14) return 'Last week';

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export const ACTIVITY_ICONS: Record<string, string> = {
  potty: 'body-outline',
  pee: 'water-outline',
  poop: 'ellipse-outline',
  feed: 'restaurant-outline',
  breast: 'heart-outline',
  bottle: 'flask-outline',
  solid: 'pizza-outline',
  sleep: 'moon-outline',
  nap: 'sunny-outline',
  night: 'moon-outline',
  growth: 'trending-up-outline',
  weight: 'scale-outline',
  height: 'resize-vertical-outline',
  medication: 'medical-outline',
  medicine: 'bandage-outline',
  milestone: 'trophy-outline',
  achievement: 'star-outline',
  diaper: 'layers-outline',
  note: 'document-text-outline',
  bath: 'water-outline',
  pumping: 'flask-outline',
  temperature: 'thermometer-outline',
  symptom: 'pulse-outline',
  play: 'happy-outline',
  default: 'ellipse-outline'
};

export function ActivityProvider({ children }: { children: React.ReactNode }): JSX.Element {
  // ─── READ BABY FROM BABYCONTEXT ──────────────────────────────────────
  const { getCurrentBabyId: getBabyIdFromContext, subscribeToBabyChanges } = useBaby();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const initRef = useRef(false);
  const currentBabyIdRef = useRef<string | null>(null);

  // ─── Subscribe to baby changes from BabyContext ─────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToBabyChanges((babyId) => {
      console.log('[ActivityContext] Baby changed to:', babyId);
      currentBabyIdRef.current = babyId;
      if (babyId) {
        loadEntries();
      } else {
        setEntries([]);
      }
    });

    // Initial sync
    const initialBabyId = getBabyIdFromContext();
    if (initialBabyId) {
      currentBabyIdRef.current = initialBabyId;
    }

    return unsubscribe;
  }, [subscribeToBabyChanges, getBabyIdFromContext]);

  // ─── Get current baby ID ─────────────────────────────────────────────
  const getCurrentBabyId = useCallback((): string | null => {
    return currentBabyIdRef.current;
  }, []);

  const loadEntries = useCallback(async () => {
    const babyId = getCurrentBabyId();
    if (!babyId) {
      setEntries([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rows = await getEntriesByBabyFromDb(babyId);
      const parsed: ActivityEntry[] = rows.map(row => {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
        return {
          id: row.id,
          type: row.tracker_id as ActivityType,
          babyId: row.baby_id,
          timestamp: row.timestamp,
          title: row.title,
          details: row.notes || undefined,
          icon: undefined,
          loggedBy: row.logged_by || '',
          loggedByName: row.logged_by_name || '',
          ...data,
          notes: row.notes || undefined,
          photo: data.photo || (row.photo_uris ? (Array.isArray(row.photo_uris) ? row.photo_uris[0] : JSON.parse(row.photo_uris as any)[0]) : undefined),
          tags: row.tags || undefined,
          notificationId: row.notification_id || undefined,
          reminderScheduled: row.reminder_scheduled || false,
          syncedAt: row.synced_at || undefined,
          deletedAt: row.deleted_at || undefined,
        } as ActivityEntry;
      });
      setEntries(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activities';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentBabyId]);

  // ─── Initial load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadEntries();
  }, [loadEntries]);

  const refreshEntries = useCallback(async () => {
    await loadEntries();
  }, [loadEntries]);

  const addEntry = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    try {
      const newId = `activity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newEntry: ActivityEntry = { ...entry, id: newId };

      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt', 'deletedAt'];
      for (const [key, value] of Object.entries(entry)) {
        if (!skipFields.includes(key) && value !== undefined) {
          entryData[key] = value;
        }
      }

      await createEntryInDb({
        id: newId,
        trackerId: entry.type,
        babyId: entry.babyId,
        timestamp: entry.timestamp,
        title: entry.title,
        data: entryData,
        notes: entry.notes || entry.details,
        photoUris: entry.photo ? [entry.photo] : undefined,
        tags: entry.tags,
        loggedBy: entry.loggedBy,
        loggedByName: entry.loggedByName,
      });

      // Try to sync with Supabase if online
      try {
        await pushToSupabase(newEntry);
      } catch (syncError) {
        console.log('Failed to sync entry with Supabase, will retry later:', syncError);
      }

      setEntries(prev => [newEntry, ...prev]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, []);

  const updateEntry = useCallback(async (id: string, updates: Partial<ActivityEntry>) => {
    try {
      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt', 'deletedAt'];
      for (const [key, value] of Object.entries(updates)) {
        if (!skipFields.includes(key) && value !== undefined) {
          entryData[key] = value;
        }
      }

      await updateEntryInDb(id, {
        title: updates.title,
        data: entryData,
        notes: updates.notes || updates.details,
        photoUris: updates.photo ? [updates.photo] : undefined,
        tags: updates.tags,
      });

      // Try to sync with Supabase if online
      const updatedEntry = entries.find(e => e.id === id);
      if (updatedEntry) {
        const updated = { ...updatedEntry, ...updates };
        try {
          await pushToSupabase(updated);
        } catch (syncError) {
          console.log('Failed to sync update with Supabase, will retry later:', syncError);
        }
      }

      setEntries(prev => 
        prev.map(entry => 
          entry.id === id ? { ...entry, ...updates } : entry
        )
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, [entries]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      const entry = entries.find(e => e.id === id);
      if (entry?.notificationId) {
        const service = await getNotificationService();
        if (service) await service.cancelNotification(entry.notificationId);
      }

      await softDeleteEntryInDb(id);

      // Try to sync deletion with Supabase if online
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('activity_entries')
            .update({ 
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id);
        }
      } catch (syncError) {
        console.log('Failed to sync deletion with Supabase:', syncError);
      }

      setEntries(prev => prev.filter(entry => entry.id !== id));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, [entries]);

  const restoreEntry = useCallback(async (id: string) => {
    try {
      await updateEntryInDb(id, { deleted_at: null });
      
      // Re-fetch entries to get restored entry back
      await loadEntries();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, [loadEntries]);

  const pushToSupabase = useCallback(async (entry: ActivityEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('activity_entries')
        .upsert({
          id: entry.id,
          user_id: user.id,
          baby_id: entry.babyId,
          tracker_id: entry.type,
          timestamp: entry.timestamp,
          title: entry.title,
          data: entry,
          notes: entry.notes || entry.details,
          photo_uris: entry.photo ? [entry.photo] : [],
          tags: entry.tags || [],
          logged_by: entry.loggedBy,
          logged_by_name: entry.loggedByName,
          notification_id: entry.notificationId,
          reminder_scheduled: entry.reminderScheduled || false,
          synced_at: new Date().toISOString(),
          deleted_at: entry.deletedAt || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error pushing to Supabase:', error);
      throw error;
    }
  }, []);

  const pullFromSupabase = useCallback(async (babyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('activity_entries')
        .select('*')
        .eq('baby_id', babyId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (data) {
        const parsedEntries: ActivityEntry[] = data.map(row => {
          const entryData = row.data || {};
          return {
            id: row.id,
            type: row.tracker_id as ActivityType,
            babyId: row.baby_id,
            timestamp: row.timestamp,
            title: row.title,
            details: row.notes || undefined,
            icon: undefined,
            loggedBy: row.logged_by || '',
            loggedByName: row.logged_by_name || '',
            ...entryData,
            notes: row.notes || undefined,
            photo: entryData.photo || (row.photo_uris ? row.photo_uris[0] : undefined),
            tags: row.tags || undefined,
            notificationId: row.notification_id || undefined,
            reminderScheduled: row.reminder_scheduled || false,
            syncedAt: row.synced_at || undefined,
          } as ActivityEntry;
        });

        // Merge with local entries, preferring Supabase data
        const existingIds = new Set(entries.map(e => e.id));
        const newEntries = parsedEntries.filter(e => !existingIds.has(e.id));
        const updatedEntries = parsedEntries.filter(e => existingIds.has(e.id));
        
        setEntries(prev => {
          // Update existing entries with Supabase data
          const updated = prev.map(entry => {
            const supabaseEntry = updatedEntries.find(e => e.id === entry.id);
            return supabaseEntry || entry;
          });
          // Add new entries
          return [...newEntries, ...updated];
        });
      }
    } catch (error) {
      console.error('Error pulling from Supabase:', error);
      throw error;
    }
  }, [entries]);

  const syncWithSupabase = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const babyId = getCurrentBabyId();
      if (!babyId) return;

      // Pull latest from Supabase
      await pullFromSupabase(babyId);

      // Push local entries that haven't been synced
      const unsyncedEntries = entries.filter(e => !e.syncedAt);
      for (const entry of unsyncedEntries) {
        try {
          await pushToSupabase(entry);
        } catch (err) {
          console.log(`Failed to sync entry ${entry.id}:`, err);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync with Supabase');
    } finally {
      setIsSyncing(false);
    }
  }, [entries, isSyncing, pullFromSupabase, pushToSupabase, getCurrentBabyId]);

  const getEntriesByType = useCallback((type: ActivityType, babyId?: string) => {
    return entries.filter(entry => {
      const typeMatch = entry.type === type;
      const babyMatch = babyId ? entry.babyId === babyId : true;
      return typeMatch && babyMatch;
    });
  }, [entries]);

  const getEntriesByBaby = useCallback((babyId: string) => {
    return entries.filter(entry => entry.babyId === babyId);
  }, [entries]);

  const getEntriesByDateRange = useCallback((startDate: number, endDate: number, babyId?: string) => {
    return entries.filter(entry => {
      const dateMatch = entry.timestamp >= startDate && entry.timestamp <= endDate;
      const babyMatch = babyId ? entry.babyId === babyId : true;
      return dateMatch && babyMatch;
    });
  }, [entries]);

  const getEntryById = useCallback((id: string) => {
    return entries.find(entry => entry.id === id);
  }, [entries]);

  const getRecentTimelineEvents = useCallback((limit = 10, babyId?: string) => {
    let filtered = entries;
    if (babyId) filtered = entries.filter(entry => entry.babyId === babyId);
    return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }, [entries]);

  const addTimelineEvent = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    return addEntry(entry);
  }, [addEntry]);

  const getTodayCount = useCallback((type: ActivityType, babyId?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return entries.filter(entry => {
      const typeMatch = entry.type === type;
      const babyMatch = babyId ? entry.babyId === babyId : true;
      const dateMatch = entry.timestamp >= todayTimestamp;
      return typeMatch && babyMatch && dateMatch;
    }).length;
  }, [entries]);

  const getSuccessRate = useCallback((type: ActivityType, babyId?: string) => {
    const typeEntries = entries.filter(entry => {
      const typeMatch = entry.type === type;
      const babyMatch = babyId ? entry.babyId === babyId : true;
      return typeMatch && babyMatch;
    });

    if (typeEntries.length === 0) return 0;
    const successfulEntries = typeEntries.filter(entry => entry.successful === true);
    return Math.round((successfulEntries.length / typeEntries.length) * 100);
  }, [entries]);

  const getStreak = useCallback((type: ActivityType, babyId?: string) => {
    const typeEntries = entries.filter(entry => {
      const typeMatch = entry.type === type;
      const babyMatch = babyId ? entry.babyId === babyId : true;
      return typeMatch && babyMatch;
    });

    if (typeEntries.length === 0) return 0;

    const successfulDays = new Set<string>();
    typeEntries.forEach(entry => {
      if (entry.successful) {
        const date = new Date(entry.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        if (dateKey) successfulDays.add(dateKey);
      }
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];
      if (!dateKey) break;

      if (successfulDays.has(dateKey)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }, [entries]);

  const syncEntries = useCallback(async () => {
    await loadEntries();
  }, [loadEntries]);

  const clearEntries = useCallback(async () => {
    try {
      const notifKeys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(NOTIFICATION_PREFIX));
      await AsyncStorage.multiRemove(notifKeys);
      setEntries([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear entries';
      throw new Error(message);
    }
  }, []);

  const scheduleActivityReminder = useCallback(async (entry: ActivityEntry, minutes: number): Promise<string | null> => {
    try {
      const service = await getNotificationService();
      if (!service) return null;

      const notifId = await service.scheduleLocalNotification({
        title: `⏰ Reminder: ${entry.title}`,
        body: entry.details || `Time for ${entry.type} activity`,
        data: { 
          screen: 'ActivityDetail', 
          activityId: entry.id,
          babyId: entry.babyId,
          type: entry.type,
        },
        trigger: { seconds: minutes * 60 },
      });

      if (notifId) {
        await updateEntry(entry.id, { notificationId: notifId, reminderScheduled: true });
        await AsyncStorage.setItem(`${NOTIFICATION_PREFIX}${entry.id}`, notifId);
      }

      return notifId;
    } catch {
      return null;
    }
  }, [updateEntry]);

  const cancelActivityReminder = useCallback(async (notificationId: string) => {
    try {
      const service = await getNotificationService();
      if (service) await service.cancelNotification(notificationId);

      const entry = entries.find(e => e.notificationId === notificationId);
      if (entry) {
        await updateEntry(entry.id, { notificationId: undefined, reminderScheduled: false });
        await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
      }
    } catch {
      // Ignore errors
    }
  }, [entries, updateEntry]);

  const syncWithBabyContext = useCallback(async (babyId: string) => {
    try {
      // First try to pull from Supabase
      try {
        await pullFromSupabase(babyId);
      } catch (supabaseError) {
        console.log('Supabase pull failed, falling back to local DB:', supabaseError);
      }

      // Then load from local DB
      const rows = await getEntriesByBabyFromDb(babyId);
      const existingIds = new Set(entries.map(e => e.id));
      const newActivities: ActivityEntry[] = [];

      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
          newActivities.push({
            id: row.id,
            type: row.tracker_id as ActivityType,
            babyId: row.baby_id,
            timestamp: row.timestamp,
            title: row.title,
            details: row.notes || undefined,
            loggedBy: row.logged_by || '',
            loggedByName: row.logged_by_name || '',
            ...data,
            notes: row.notes || undefined,
            photo: data.photo || (row.photo_uris ? (Array.isArray(row.photo_uris) ? row.photo_uris[0] : JSON.parse(row.photo_uris as any)[0]) : undefined),
            tags: row.tags || undefined,
            notificationId: row.notification_id || undefined,
            reminderScheduled: row.reminder_scheduled || false,
            syncedAt: row.synced_at || undefined,
          } as ActivityEntry);
        }
      }

      if (newActivities.length > 0) {
        setEntries(prev => [...newActivities, ...prev]);
      }
    } catch {
      // Ignore sync errors
    }
  }, [entries, pullFromSupabase]);

  const getEntriesForNotification = useCallback(() => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    return entries
      .filter(e => e.timestamp >= oneHourAgo)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [entries]);

  const value = useMemo<ActivityContextType>(() => ({
    entries,
    isLoading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    getEntriesByType,
    getEntriesByBaby,
    getEntriesByDateRange,
    getEntryById,
    getRecentTimelineEvents,
    addTimelineEvent,
    getTodayCount,
    getSuccessRate,
    getStreak,
    getDateTitle,
    getRelativeTime,
    formatDuration,
    loadEntries,
    syncEntries,
    clearEntries,
    refreshEntries,
    scheduleActivityReminder,
    cancelActivityReminder,
    syncWithBabyContext,
    getEntriesForNotification,
    syncWithSupabase,
    pushToSupabase,
    pullFromSupabase,
    getCurrentBabyId,
  }), [
    entries,
    isLoading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    getEntriesByType,
    getEntriesByBaby,
    getEntriesByDateRange,
    getEntryById,
    getRecentTimelineEvents,
    addTimelineEvent,
    getTodayCount,
    getSuccessRate,
    getStreak,
    loadEntries,
    syncEntries,
    clearEntries,
    refreshEntries,
    scheduleActivityReminder,
    cancelActivityReminder,
    syncWithBabyContext,
    getEntriesForNotification,
    syncWithSupabase,
    pushToSupabase,
    pullFromSupabase,
    getCurrentBabyId,
  ]);

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): ActivityContextType {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export default ActivityContext;