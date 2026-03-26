import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// ==================== TYPES ====================

// Extended ActivityType to support custom trackers (string for custom ones)
export type ActivityType = 
  | 'potty' 
  | 'feed' 
  | 'sleep' 
  | 'growth' 
  | 'medication' 
  | 'milestone' 
  | 'diaper' 
  | 'note'
  | string; // Allow any string for custom trackers

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

  // Note specific
  content?: string;
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired';

  // Common
  notes?: string;
  photo?: string;
  
  // Custom tracker fields (dynamic)
  [key: string]: any;
}

interface ActivityContextType {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;

  // CRUD Operations
  addEntry: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<ActivityEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Queries
  getEntriesByType: (type: ActivityType, babyId?: string) => ActivityEntry[];
  getEntriesByBaby: (babyId: string) => ActivityEntry[];
  getEntriesByDateRange: (startDate: number, endDate: number, babyId?: string) => ActivityEntry[];
  getEntryById: (id: string) => ActivityEntry | undefined;
  
  // Timeline Operations
  getRecentTimelineEvents: (limit?: number, babyId?: string) => ActivityEntry[];
  addTimelineEvent: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;

  // Stats
  getTodayCount: (type: ActivityType, babyId?: string) => number;
  getSuccessRate: (type: ActivityType, babyId?: string) => number;
  getStreak: (type: ActivityType, babyId?: string) => number;

  // Utility Functions (FIXED: Added missing getDateTitle)
  getDateTitle: (timestamp: number) => string;
  getRelativeTime: (timestamp: number) => string;
  formatDuration: (minutes: number) => string;

  // Sync
  loadEntries: () => Promise<void>;
  syncEntries: () => Promise<void>;
  clearEntries: () => Promise<void>;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * FIXED: Added missing getDateTitle function that was causing the error
 * Formats a timestamp into a readable date title like "Today", "Yesterday", or "Monday"
 */
export function getDateTitle(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Reset hours to compare dates only
  const dateCopy = new Date(date);
  const nowCopy = new Date(now);
  dateCopy.setHours(0, 0, 0, 0);
  nowCopy.setHours(0, 0, 0, 0);
  
  const diffTime = nowCopy.getTime() - dateCopy.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    // Return day name for last week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  } else if (diffDays < 14) {
    return 'Last week';
  } else {
    // Return formatted date for older entries
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Format duration in minutes to readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ==================== ICON MAPPING ====================

/**
 * FIXED: Icon mapping to replace invalid "chair-outline" with valid Ionicons names
 * Use this mapping in your components to ensure valid icon names
 */
export const ACTIVITY_ICONS: Record<string, string> = {
  // Potty - FIXED: replaced invalid "chair-outline" with valid "body-outline"
  potty: 'body-outline',
  pee: 'water-outline',
  poop: 'ellipse-outline',
  
  // Feed
  feed: 'restaurant-outline',
  breast: 'heart-outline',
  bottle: 'flask-outline',
  solid: 'pizza-outline',
  
  // Sleep
  sleep: 'moon-outline',
  nap: 'sunny-outline',
  night: 'moon-outline',
  
  // Growth
  growth: 'trending-up-outline',
  weight: 'scale-outline',
  height: 'resize-vertical-outline',
  
  // Medication
  medication: 'medical-outline',
  medicine: 'bandage-outline',
  
  // Milestone
  milestone: 'trophy-outline',
  achievement: 'star-outline',
  
  // Diaper
  diaper: 'layers-outline',
  
  // Note
  note: 'document-text-outline',
  
  // Default
  default: 'ellipse-outline'
};

// ==================== CONTEXT ====================

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const STORAGE_KEY = '@littleloom_activities';

// ==================== PROVIDER ====================

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load entries from storage on mount
  useEffect(() => {
    loadEntries();
  }, []);

  // ==================== STORAGE OPERATIONS ====================

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setEntries(parsed);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
      setError('Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveEntries = useCallback(async (newEntries: ActivityEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    } catch (err) {
      console.error('Failed to save activities:', err);
      throw err;
    }
  }, []);

  // ==================== CRUD OPERATIONS ====================

  const addEntry = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    try {
      const newEntry: ActivityEntry = {
        ...entry,
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const updatedEntries = [newEntry, ...entries];
      await saveEntries(updatedEntries);
      setEntries(updatedEntries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to add entry:', err);
      setError('Failed to save entry');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  }, [entries, saveEntries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<ActivityEntry>) => {
    try {
      const updatedEntries = entries.map(entry => 
        entry.id === id ? { ...entry, ...updates } : entry
      );

      await saveEntries(updatedEntries);
      setEntries(updatedEntries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to update entry:', err);
      setError('Failed to update entry');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  }, [entries, saveEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      const updatedEntries = entries.filter(entry => entry.id !== id);
      await saveEntries(updatedEntries);
      setEntries(updatedEntries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      setError('Failed to delete entry');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  }, [entries, saveEntries]);

  // ==================== QUERY OPERATIONS ====================

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

  // ==================== TIMELINE OPERATIONS ====================

  const getRecentTimelineEvents = useCallback((limit = 10, babyId?: string) => {
    let filtered = entries;
    
    if (babyId) {
      filtered = entries.filter(entry => entry.babyId === babyId);
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [entries]);

  const addTimelineEvent = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    return addEntry(entry);
  }, [addEntry]);

  // ==================== STATISTICS ====================

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
        successfulDays.add(dateKey);
      }
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];

      if (successfulDays.has(dateKey)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }, [entries]);

  // ==================== SYNC OPERATIONS ====================

  const syncEntries = useCallback(async () => {
    await loadEntries();
  }, [loadEntries]);

  const clearEntries = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setEntries([]);
    } catch (err) {
      console.error('Failed to clear entries:', err);
      throw err;
    }
  }, []);

  // ==================== CONTEXT VALUE ====================

  const value: ActivityContextType = {
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
    // FIXED: Added the missing utility functions to context
    getDateTitle,
    getRelativeTime,
    formatDuration,
    loadEntries,
    syncEntries,
    clearEntries,
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

// ==================== HOOK ====================

export function useActivity(): ActivityContextType {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export default ActivityContext;