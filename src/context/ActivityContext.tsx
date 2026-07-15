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
} from '../database/dbHelpers';

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

  pottyType?: 'pee' | 'poop' | 'both' | 'accident' | 'attempt';
  location?: 'potty' | 'toilet' | 'floor' | 'diaper';
  successful?: boolean;

  feedType?: 'breast' | 'bottle' | 'solid' | 'snack';
  amount?: string;
  duration?: string;
  side?: 'left' | 'right' | 'both';
  food?: string;

  sleepType?: 'nap' | 'night' | 'wake';
  quality?: number;

  measurementType?: 'weight' | 'height' | 'head';
  value?: string;
  unit?: 'kg' | 'lb' | 'oz' | 'cm' | 'in';
  percentile?: number;

  medName?: string;
  dosage?: string;
  reason?: string;
  givenBy?: 'parent1' | 'parent2' | 'doctor' | 'other';

  milestoneType?: 'motor' | 'cognitive' | 'social' | 'language' | 'other';
  description?: string;
  firstTime?: boolean;

  diaperType?: 'wet' | 'dirty' | 'both' | 'dry';
  rash?: boolean;
  cream?: 'none' | 'zinc' | 'petroleum' | 'other';

  content?: string;
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired';

  notes?: string;
  photo?: string;

  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;

  [key: string]: unknown;
}

interface ActivityContextType {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;

  addEntry: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<ActivityEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

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

  scheduleActivityReminder: (entry: ActivityEntry, minutes: number) => Promise<string | null>;
  cancelActivityReminder: (notificationId: string) => Promise<void>;

  syncWithBabyContext: (babyId: string) => Promise<void>;
  getEntriesForNotification: () => ActivityEntry[];
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const STORAGE_KEY = '@littleloom_activities_v3';
const NOTIFICATION_PREFIX = '@littleloom_activity_notif_';
const BABY_ACTIVITIES_KEY = (babyId: string) => `@littleloom_activities_${babyId}`;

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
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadEntries();
  }, [loadEntries]);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load from Drizzle DB instead of AsyncStorage
      const currentBabyId = await getAppSetting('current_baby_id');
      if (currentBabyId) {
        const rows = await getEntriesByBabyFromDb(currentBabyId);
        const parsed: ActivityEntry[] = rows.map(row => {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return {
            id: row.id,
            type: row.trackerId as ActivityType,
            babyId: row.babyId,
            timestamp: row.timestamp,
            title: row.title,
            details: row.notes,
            icon: undefined,
            loggedBy: row.loggedBy || '',
            loggedByName: row.loggedByName || '',
            ...data,
            notes: row.notes,
            photo: data.photo || (row.photoUris ? JSON.parse(row.photoUris as any)[0] : undefined),
            tags: row.tags ? JSON.parse(row.tags as any) : undefined,
            notificationId: row.notificationId,
            reminderScheduled: row.reminderScheduled,
            syncedAt: row.syncedAt,
          } as ActivityEntry;
        });
        setEntries(parsed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activities';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveEntries = useCallback(async (_newEntries: ActivityEntry[]) => {
    // DEPRECATED: Activities now persist via Drizzle DB directly
    // Kept for backward compat during migration
  }, []);

  const addEntry = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    try {
      const newId = `activity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newEntry: ActivityEntry = { ...entry, id: newId };

      // Extract data fields for DB storage
      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
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

      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, [entries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<ActivityEntry>) => {
    try {
      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
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

      const updatedEntries = entries.map(entry => 
        entry.id === id ? { ...entry, ...updates } : entry
      );

      setEntries(updatedEntries);

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

      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw err;
    }
  }, [entries]);

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
      // Note: DB entries are NOT cleared here — this is a UI cache clear
      // Use resetDatabase() from db.ts for full DB wipe
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
    }
  }, [entries, updateEntry]);

  const syncWithBabyContext = useCallback(async (babyId: string) => {
    try {
      // Now syncs FROM Drizzle DB instead of AsyncStorage
      const rows = await getEntriesByBabyFromDb(babyId);
      const existingIds = new Set(entries.map(e => e.id));
      const newActivities: ActivityEntry[] = [];

      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          newActivities.push({
            id: row.id,
            type: row.trackerId as ActivityType,
            babyId: row.babyId,
            timestamp: row.timestamp,
            title: row.title,
            details: row.notes,
            loggedBy: row.loggedBy || '',
            loggedByName: row.loggedByName || '',
            ...data,
            notes: row.notes,
            photo: data.photo || (row.photoUris ? JSON.parse(row.photoUris as any)[0] : undefined),
            tags: row.tags ? JSON.parse(row.tags as any) : undefined,
            notificationId: row.notificationId,
            reminderScheduled: row.reminderScheduled,
            syncedAt: row.syncedAt,
          } as ActivityEntry);
        }
      }

      if (newActivities.length > 0) {
        const merged = [...newActivities, ...entries];
        setEntries(merged);
      }
    } catch {
    }
  }, [entries]);

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
  scheduleActivityReminder,
  cancelActivityReminder,
  syncWithBabyContext,
  getEntriesForNotification,
}), [
  entries,
  isLoading,
  error,
  addEntry,
  updateEntry,
  deleteEntry,
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
  scheduleActivityReminder,
  cancelActivityReminder,
  syncWithBabyContext,
  getEntriesForNotification,
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
