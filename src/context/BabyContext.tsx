// src/context/BabyContext.tsx - COMPLETE FIXED VERSION

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
import { useAuth } from './AuthContext';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

// ─── STORAGE KEYS ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  CURRENT_BABY_ID: '@littleloom_current_baby_id',
  BABIES_CACHE_KEY: '@littleloom_babies_cache',
  LAST_SYNC_KEY: '@littleloom_last_baby_sync',
} as const;

const ACTIVITY_CONTEXT_KEY = '@littleloom_activities_v3';
const NOTIFICATION_PREFIX = '@littleloom_activity_notif_';

// ─── TYPES ──────────────────────────────────────────────────────────────
export type Gender = 'boy' | 'girl' | 'other';

export interface BabyProfile {
  id: string;
  name: string;
  birthDate: string;
  age: string;
  gender: Gender;
  skinTone: number;
  avatar: string;
  avatar_url?: string;
  parent1Id: string;
  parent2Id?: string;
  guardianIds?: string[];
  weight?: string;
  height?: string;
  bloodType?: string;
  allergies?: string[];
  medicalNotes?: string;
  birthTime?: string;
  birthWeight?: string;
  birthHeight?: string;
  birthHeadCircumference?: string;
  deliveryType?: string;
  gestationalWeeks?: string;
  apgar1Min?: string;
  apgar5Min?: string;
  birthPlace?: string;
  birthAttendant?: string;
  multipleBirth?: boolean;
  birthOrder?: string;
  feedingPlan?: string;
  emergencyContact?: string;
  pediatrician?: string;
  notificationsEnabled?: boolean;
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
  isFirstTime?: boolean;
  recordedBy?: string;
  recordedByName?: string;
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
  loggedByRole?: string;
  pottyType?: PottyLog['type'];
  successful?: boolean;
  feedType?: FeedingLog['type'];
  amount?: string;
  duration?: string;
  side?: string;
  food?: string;
  sleepType?: 'nap' | 'night' | 'wake';
  quality?: number;
  location?: string;
  measurementType?: GrowthMeasurement['type'];
  value?: string;
  unit?: string;
  percentile?: number;
  medName?: string;
  dosage?: string;
  medType?: string;
  reason?: string;
  givenBy?: string;
  milestoneType?: string;
  firstTime?: boolean;
  description?: string;
  symptomType?: string;
  severity?: number;
  tempValue?: number;
  tempUnit?: 'celsius' | 'fahrenheit';
  method?: string;
  symptoms?: string[];
  playType?: string;
  engagement?: number;
  tummyTime?: string;
  readingDuration?: string;
  musicType?: string;
  outdoorActivity?: string;
  sensoryType?: string;
  speechWord?: string;
  moodType?: string;
  attachmentType?: string;
  socialType?: string;
  cryingDuration?: string;
  soothingMethod?: string;
  nailCareType?: string;
  hairCareType?: string;
  skinCareType?: string;
  sunscreenSpf?: string;
  repellentType?: string;
  oralCareType?: string;
  earCareType?: string;
  noseCareType?: string;
  solidFoodType?: string;
  waterAmount?: string;
  vitaminName?: string;
  allergenType?: string;
  reactionType?: string;
  breastfeedingDuration?: string;
  accidentType?: string;
  injuryType?: string;
  chokingResponse?: string;
  carSeatType?: string;
  babyproofingArea?: string;
  wakeTime?: string;
  bedtimeRoutine?: string;
  napDuration?: string;
  screenTimeDuration?: string;
  outdoorTimeDuration?: string;
  content?: string;
  photoUri?: string;
  videoUri?: string;
  voiceMemoUri?: string;
  journalEntry?: string;
  tripDestination?: string;
  travelMode?: string;
  daycareNotes?: string;
  babysitterName?: string;
  refluxSeverity?: string;
  colicDuration?: string;
  gasRelief?: string;
  constipationRelief?: string;
  diarrheaFrequency?: string;
  eczemaSeverity?: string;
  cradleCapTreatment?: string;
  notes?: string;
  photo?: string;
  tags?: string[];
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
}

export type ActivityType = string;

// ─── STATE ──────────────────────────────────────────────────────────────
interface BabyState {
  isLoading: boolean;
  isSyncing: boolean;
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
  lastSyncTime: number | null;
  isInitialized: boolean;
}

interface BabyContextType extends BabyState {
  loadBabies: (force?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  createBaby: (data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated' | 'parent1Id'>) => Promise<string | null>;
  updateBaby: (id: string, updates: Partial<BabyProfile>) => Promise<void>;
  deleteBaby: (id: string) => Promise<boolean>;
  switchBaby: (id: string) => Promise<boolean>;
  refreshCurrentBaby: () => Promise<void>;
  skipBaby: () => Promise<void>;
  clearSkipBaby: () => Promise<void>;
  calculateAge: (birthDate: string) => string;
  getBabyAge: (babyId?: string) => string;
  addGrowthMeasurement: (measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>) => Promise<boolean>;
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
  entries: ActivityEntry[];
  isLoadingEntries: boolean;
  loadEntries: () => Promise<void>;
  deleteEntry: (id: string) => Promise<boolean>;
  addEntry: (entry: Omit<ActivityEntry, 'id'>) => Promise<boolean>;
  updateEntry: (id: string, entry: Partial<ActivityEntry>) => Promise<boolean>;
  getEntryById: (id: string) => ActivityEntry | undefined;
  getDateTitle: (timestamp: number | string) => string;
  syncWithActivityContext: () => Promise<void>;
  scheduleActivityReminder: (entry: ActivityEntry, minutes: number) => Promise<string | null>;
  cancelActivityReminder: (notificationId: string) => Promise<void>;
  getCurrentBabyId: () => string | null;
  subscribeToBabyChanges: (callback: (babyId: string | null) => void) => () => void;
}

const BabyContext = createContext<BabyContextType | null>(null);

// ─── HELPERS ─────────────────────────────────────────────────────────────
const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
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

type BabyChangeCallback = (babyId: string | null) => void;
let babyChangeSubscribers: BabyChangeCallback[] = [];

const getNotificationService = async () => {
  try {
    const { notificationService } = await import('@/services/NotificationService');
    return notificationService;
  } catch {
    return null;
  }
};

// ─── PROVIDER ────────────────────────────────────────────────────────────
export const BabyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile: authProfile } = useAuth();

  const [state, setState] = useState<BabyState>({
    isLoading: false,
    isSyncing: false,
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
    lastSyncTime: null,
    isInitialized: false,
  });

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const ageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);
  const isMounted = useRef(true);
  const isCreatingRef = useRef(false);
  const loadInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const broadcastBabyChange = useCallback((babyId: string | null) => {
    babyChangeSubscribers.forEach(callback => {
      try { callback(babyId); } catch (e) { /* ignore */ }
    });
  }, []);

  const subscribeToBabyChanges = useCallback((callback: BabyChangeCallback) => {
    babyChangeSubscribers.push(callback);
    callback(state.currentBabyId);
    return () => {
      babyChangeSubscribers = babyChangeSubscribers.filter(cb => cb !== callback);
    };
  }, [state.currentBabyId]);

  // ─── Age calculation ──────────────────────────────────────────────────
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

  const getBabyAge = useCallback((babyId?: string): string => {
    const id = babyId || state.currentBabyId;
    if (!id) return '';
    const baby = state.babies.find(b => b.id === id);
    return baby?.age || '';
  }, [state.babies, state.currentBabyId]);

  // ─── Helper: get current user ID ──────────────────────────────────────
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    const methods = [
      async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user?.id) return session.user.id;
        return null;
      },
      async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user?.id) return user.id;
        return null;
      },
      async () => {
        if (authProfile?.id) return authProfile.id;
        return null;
      },
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result) return result;
      } catch (e) {
        // Continue to next method
      }
    }

    return null;
  }, [authProfile]);

  const mapBabyRowToProfile = useCallback((row: any): BabyProfile => {
    return {
      id: row.id,
      name: row.name,
      birthDate: row.date_of_birth,
      age: calculateAge(row.date_of_birth),
      gender: row.gender === 'male' ? 'boy' : row.gender === 'female' ? 'girl' : 'other',
      skinTone: row.skin_tone ?? 0,
      avatar: row.avatar || row.avatar_url || '👶',
      avatar_url: row.avatar_url || row.avatar || '',
      parent1Id: row.parent1_id || '',
      parent2Id: row.parent2_id || undefined,
      bloodType: row.blood_type || undefined,
      medicalNotes: row.medical_notes || undefined,
      allergies: row.allergies || undefined,
      weight: row.current_weight_kg ? String(row.current_weight_kg) : undefined,
      height: row.current_height_cm ? String(row.current_height_cm) : undefined,
      birthTime: row.birth_time || undefined,
      birthWeight: row.birth_weight_kg ? String(row.birth_weight_kg) : undefined,
      birthHeight: row.birth_height_cm ? String(row.birth_height_cm) : undefined,
      birthHeadCircumference: row.birth_head_circumference ? String(row.birth_head_circumference) : undefined,
      deliveryType: row.delivery_type || undefined,
      gestationalWeeks: row.gestational_weeks ? String(row.gestational_weeks) : undefined,
      apgar1Min: row.apgar_1min ? String(row.apgar_1min) : undefined,
      apgar5Min: row.apgar_5min ? String(row.apgar_5min) : undefined,
      birthPlace: row.birth_place || undefined,
      birthAttendant: row.birth_attendant || undefined,
      multipleBirth: row.multiple_birth || false,
      birthOrder: row.birth_order ? String(row.birth_order) : undefined,
      feedingPlan: row.feeding_plan || undefined,
      emergencyContact: row.emergency_contact || undefined,
      pediatrician: row.pediatrician || undefined,
      notificationsEnabled: row.notifications_enabled !== false,
      streak: row.streak || 0,
      milestones: row.milestones_count || 0,
      photos: row.photos_count || 0,
      createdAt: row.created_at,
      lastUpdated: row.updated_at,
    };
  }, [calculateAge]);

  // ─── Helper: parse tracker entry data ────────────────────────────────
  const parseEntryData = (raw: unknown): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw as Record<string, any>;
  };

  // ─── Helper: map tracker entry to domain types ──────────────────────
  const mapTrackerEntryToDomain = useCallback((row: any) => {
    const data = parseEntryData(row.data);
    const photoUris = row.photo_uris || [];
    const tags = row.tags || [];
    const trackerType = row.tracker_type || row.tracker_id;

    switch (trackerType) {
      case 'growth':
        return {
          type: 'growth' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            type: data.measurementType || 'weight',
            value: Number(data.value || 0),
            unit: data.unit || 'kg',
            date: data.date || new Date(row.timestamp).toISOString(),
            notes: row.notes || undefined,
            recordedBy: data.recordedBy || data.logged_by || '',
            createdAt: row.created_at || new Date(row.timestamp).toISOString(),
          }
        };
      case 'milestone':
        return {
          type: 'milestone' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            title: row.title || '',
            description: data.description || '',
            category: data.category || 'physical',
            achievedAt: data.achievedAt || new Date(row.timestamp).toISOString(),
            imageUrl: photoUris[0] || undefined,
            notes: row.notes || undefined,
            isFirstTime: data.firstTime || undefined,
            recordedBy: data.recordedBy || data.logged_by || undefined,
            recordedByName: data.recordedByName || data.logged_by_name || undefined,
          }
        };
      case 'sleep':
        return {
          type: 'sleep' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            startTime: data.startTime || new Date(row.timestamp).toISOString(),
            endTime: data.endTime || undefined,
            duration: data.duration || undefined,
            quality: data.quality || 'good',
            location: data.location || 'other',
            notes: row.notes || undefined,
            createdAt: row.created_at || new Date(row.timestamp).toISOString(),
          }
        };
      case 'feed':
      case 'feeding':
        return {
          type: 'feeding' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            type: data.feedType || data.type || 'bottle',
            startTime: data.startTime || new Date(row.timestamp).toISOString(),
            duration: data.duration || undefined,
            amount: data.amount || undefined,
            unit: data.unit || undefined,
            food: data.food || undefined,
            notes: row.notes || undefined,
            createdAt: row.created_at || new Date(row.timestamp).toISOString(),
          }
        };
      case 'potty':
        return {
          type: 'potty' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            type: data.pottyType || data.type || 'pee',
            location: data.location || 'diaper',
            successful: Boolean(data.successful),
            timestamp: data.timestamp || new Date(row.timestamp).toISOString(),
            notes: row.notes || undefined,
            createdAt: row.created_at || new Date(row.timestamp).toISOString(),
          }
        };
      case 'medication':
        return {
          type: 'medication' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            medicationName: data.medicationName || '',
            dosage: data.dosage || '',
            reason: data.reason || undefined,
            givenBy: data.givenBy || data.logged_by || '',
            timestamp: data.timestamp || new Date(row.timestamp).toISOString(),
            notes: row.notes || undefined,
            createdAt: row.created_at || new Date(row.timestamp).toISOString(),
          }
        };
      default:
        return {
          type: 'activity' as const,
          data: {
            id: row.id,
            babyId: row.baby_id,
            type: trackerType || 'custom',
            timestamp: row.timestamp,
            title: row.title || '',
            details: data.details || row.notes || undefined,
            notes: row.notes || undefined,
            photo: photoUris[0] || undefined,
            tags: tags,
            loggedBy: data.loggedBy || row.logged_by || '',
            loggedByName: data.loggedByName || row.logged_by_name || '',
            ...data,
          }
        };
    }
  }, []);

  // ─── Load all baby data from Supabase ─────────────────────────────────
  const loadAllBabyData = useCallback(async (babyId: string) => {
    if (!isMounted.current) return;

    setState(prev => ({ ...prev, isLoading: true }));
    setIsLoadingEntries(true);

    try {
      const { data: entries, error } = await supabase
        .from('tracker_entries')
        .select('*')
        .eq('baby_id', babyId)
        .eq('is_deleted', false)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[BabyContext] loadAllBabyData error:', error);
        return;
      }

      if (!isMounted.current) return;

      const growthData: GrowthMeasurement[] = [];
      const milestones: Milestone[] = [];
      const sleepLogs: SleepLog[] = [];
      const feedingLogs: FeedingLog[] = [];
      const pottyLogs: PottyLog[] = [];
      const medicationLogs: MedicationLog[] = [];
      const activities: ActivityEntry[] = [];

      for (const row of (entries || [])) {
        const mapped = mapTrackerEntryToDomain(row);
        if (!mapped) continue;

        switch (mapped.type) {
          case 'growth':
            growthData.push(mapped.data as GrowthMeasurement);
            break;
          case 'milestone':
            milestones.push(mapped.data as Milestone);
            break;
          case 'sleep':
            sleepLogs.push(mapped.data as SleepLog);
            break;
          case 'feeding':
            feedingLogs.push(mapped.data as FeedingLog);
            break;
          case 'potty':
            pottyLogs.push(mapped.data as PottyLog);
            break;
          case 'medication':
            medicationLogs.push(mapped.data as MedicationLog);
            break;
          case 'activity':
            activities.push(mapped.data as ActivityEntry);
            break;
        }
      }

      try {
        await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(activities));
      } catch {}

      setState(prev => ({
        ...prev,
        isLoading: false,
        growthData,
        milestones,
        sleepLogs,
        feedingLogs,
        pottyLogs,
        medicationLogs,
        activities,
      }));

    } catch (error) {
      console.error('[BabyContext] loadAllBabyData error:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      if (isMounted.current) {
        setIsLoadingEntries(false);
      }
    }
  }, [mapTrackerEntryToDomain]);

  // ─── Load babies from Supabase ────────────────────────────────────────
  const loadBabies = useCallback(async (force = false) => {
    // Prevent concurrent loads
    if (loadInProgressRef.current && !force) {
      console.log('[BabyContext] Load already in progress, skipping');
      return;
    }

    if (!isMounted.current) return;

    loadInProgressRef.current = true;
    console.log('[BabyContext] Starting loadBabies...');

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const userId = await getCurrentUserId();

      if (!userId) {
        console.warn('[BabyContext] No authenticated user');
        setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
        loadInProgressRef.current = false;
        return;
      }

      console.log('[BabyContext] Loading babies for user:', userId);

      let allBabies: any[] = [];

      // ─── TRY PARENT1 QUERY ──────────────────────────────────────────
      try {
        const { data: parent1Babies, error: error1 } = await supabase
          .from('babies')
          .select('*')
          .eq('parent1_id', userId)
          .eq('is_active', true);

        if (error1) {
          console.error('[BabyContext] parent1 query error:', error1.message);
          
          if (error1.message?.includes('infinite recursion') || error1.message?.includes('policy')) {
            console.log('[BabyContext] Trying without is_active filter due to RLS');
            const { data: fallbackBabies, error: fallbackError } = await supabase
              .from('babies')
              .select('*')
              .eq('parent1_id', userId);
            
            if (!fallbackError && fallbackBabies) {
              allBabies = fallbackBabies.filter((b: any) => b.is_active !== false);
            }
          }
        } else if (parent1Babies) {
          allBabies = parent1Babies;
        }
      } catch (e) {
        console.warn('[BabyContext] parent1 query failed:', e);
      }

      // ─── IF NO BABIES, TRY PARENT2 ──────────────────────────────────
      if (allBabies.length === 0) {
        try {
          const { data: parent2Babies, error: error2 } = await supabase
            .from('babies')
            .select('*')
            .eq('parent2_id', userId)
            .eq('is_active', true);

          if (error2) {
            console.error('[BabyContext] parent2 query error:', error2.message);
            
            if (error2.message?.includes('infinite recursion') || error2.message?.includes('policy')) {
              const { data: fallbackBabies, error: fallbackError } = await supabase
                .from('babies')
                .select('*')
                .eq('parent2_id', userId);
              
              if (!fallbackError && fallbackBabies) {
                allBabies = fallbackBabies.filter((b: any) => b.is_active !== false);
              }
            }
          } else if (parent2Babies) {
            allBabies = parent2Babies;
          }
        } catch (e) {
          console.warn('[BabyContext] parent2 query failed:', e);
        }
      }

      console.log(`[BabyContext] Found ${allBabies.length} babies in Supabase`);

      // ─── MAP TO PROFILES ─────────────────────────────────────────────
      const babies: BabyProfile[] = allBabies.map(mapBabyRowToProfile);

      // ─── CACHE BABIES ─────────────────────────────────────────────────
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.BABIES_CACHE_KEY, JSON.stringify(babies));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_KEY, Date.now().toString());
      } catch (cacheError) {
        console.warn('[BabyContext] Failed to cache babies:', cacheError);
      }

      // ─── DETERMINE CURRENT BABY ID ───────────────────────────────────
      let currentId: string | null = null;
      
      try {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'current_baby_id')
          .eq('user_id', userId)
          .maybeSingle();
        currentId = settingsData?.value || null;
      } catch (e) {
        console.warn('[BabyContext] Failed to get current_baby_id:', e);
      }
      
      if (!currentId && babies.length > 0) {
        currentId = babies[0].id;
        try {
          await supabase
            .from('app_settings')
            .upsert({
              key: 'current_baby_id',
              value: currentId,
              user_id: userId,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key, user_id' });
        } catch (e) {
          console.warn('[BabyContext] Failed to set current_baby_id:', e);
        }
      }

      if (currentId) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, currentId);
      }

      const babyToSet = babies.find(b => b.id === currentId) || babies[0] || null;

      let hasSkippedBaby = false;
      try {
        const { data: skipData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'has_skipped_baby')
          .eq('user_id', userId)
          .maybeSingle();
        hasSkippedBaby = skipData?.value === 'true';
      } catch (e) {
        console.warn('[BabyContext] Failed to get has_skipped_baby:', e);
      }

      if (!isMounted.current) {
        loadInProgressRef.current = false;
        return;
      }

      // ─── UPDATE STATE ─────────────────────────────────────────────────
      setState(prev => ({
        ...prev,
        isLoading: false,
        babies,
        currentBabyId: currentId,
        currentBaby: babyToSet,
        hasSkippedBaby,
        lastSyncTime: Date.now(),
        isInitialized: true,
      }));

      // ─── BROADCAST CHANGE ────────────────────────────────────────────
      setTimeout(() => {
        broadcastBabyChange(currentId);
      }, 50);

      // ─── LOAD TRACKER DATA ───────────────────────────────────────────
      if (currentId) {
        console.log('[BabyContext] Loading tracker data for current baby...');
        await loadAllBabyData(currentId);
        console.log('[BabyContext] Tracker data loaded');
      }

      console.log('[BabyContext] loadBabies completed successfully');

    } catch (error) {
      console.error('[BabyContext] Error loading babies:', error);
      
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.BABIES_CACHE_KEY);
        if (cached) {
          const cachedBabies = JSON.parse(cached);
          console.log(`[BabyContext] Loaded ${cachedBabies.length} babies from cache`);
          if (isMounted.current) {
            const cachedBaby = cachedBabies.find((b: any) => b.id === state.currentBabyId) || cachedBabies[0] || null;
            setState(prev => ({
              ...prev,
              isLoading: false,
              babies: cachedBabies,
              currentBaby: cachedBaby,
              isInitialized: true,
            }));
          }
        }
      } catch (cacheError) {
        console.warn('[BabyContext] Failed to load from cache:', cacheError);
      }
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
      }
    } finally {
      loadInProgressRef.current = false;
    }
  }, [mapBabyRowToProfile, loadAllBabyData, getCurrentUserId, broadcastBabyChange, state.currentBabyId]);

  const forceRefresh = useCallback(async () => {
    console.log('[BabyContext] Force refresh requested');
    await loadBabies(true);
  }, [loadBabies]);

  // ─── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    isMounted.current = true;
    loadBabies();

    return () => {
      isMounted.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (authLoadTimerRef.current) {
        clearTimeout(authLoadTimerRef.current);
      }
    };
  }, [loadBabies]);

  // ─── Watch for auth changes ──────────────────────────────────────────
  useEffect(() => {
    if (authProfile?.id) {
      console.log('[BabyContext] Auth user detected, loading babies...');
      if (authLoadTimerRef.current) {
        clearTimeout(authLoadTimerRef.current);
      }
      authLoadTimerRef.current = setTimeout(() => {
        loadBabies(true);
        authLoadTimerRef.current = null;
      }, 500);
      return () => {
        if (authLoadTimerRef.current) {
          clearTimeout(authLoadTimerRef.current);
          authLoadTimerRef.current = null;
        }
      };
    }
  }, [authProfile?.id, loadBabies]);

  // ─── Auto-refresh on app focus ──────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          console.log('[BabyContext] Auto-refresh on app focus');
          loadBabies(true);
        }, 500);
      }
    });

    return () => {
      subscription.remove();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [loadBabies]);

  // ─── Auto-refresh every 5 minutes ────────────────────────────────────
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    if (authProfile?.id) {
      intervalId = setInterval(() => {
        console.log('[BabyContext] Auto-refresh interval');
        loadBabies(true);
      }, 300000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [authProfile?.id, loadBabies]);

  // ─── Age auto-refresh ─────────────────────────────────────────────────
  useEffect(() => {
    if (state.babies.length === 0) return;

    const updateAges = () => {
      if (!isMounted.current) return;

      setState(prev => ({
        ...prev,
        babies: prev.babies.map(b => ({ ...b, age: calculateAge(b.birthDate) })),
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

  // ─── Skip / Clear skip ────────────────────────────────────────────────
  const skipBaby = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'has_skipped_baby',
          value: 'true',
          user_id: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key, user_id' });
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSkippedBaby: true }));
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Error skipping baby:', error);
    }
  }, [getCurrentUserId]);

  const clearSkipBaby = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'has_skipped_baby')
        .eq('user_id', userId);
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSkippedBaby: false }));
      }
    } catch (error) {
      console.error('Error clearing skip baby:', error);
    }
  }, [getCurrentUserId]);

  // ─── Create baby ──────────────────────────────────────────────────────
  const createBaby = useCallback(async (
    data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated' | 'parent1Id'>
  ): Promise<string | null> => {
    if (isCreatingRef.current) {
      console.log('[BabyContext] Creation already in progress');
      return null;
    }
    isCreatingRef.current = true;

    const birthDate = new Date(data.birthDate);
    const now = new Date();
    if (birthDate > now) {
      isCreatingRef.current = false;
      return null;
    }
    if (isNaN(birthDate.getTime())) {
      isCreatingRef.current = false;
      return null;
    }

    try {
      const newId = generateId();
      
      let userId: string | null = null;
      
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user?.id) {
          userId = user.id;
        }
      } catch (e) {
        console.warn('[BabyContext] getUser failed:', e);
      }
      
      if (!userId) {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (!sessionError && session?.user?.id) {
            userId = session.user.id;
          }
        } catch (e) {
          console.warn('[BabyContext] getSession failed:', e);
        }
      }
      
      if (!userId && authProfile?.id) {
        userId = authProfile.id;
      }
      
      if (!userId) {
        console.error('[BabyContext] No authenticated user for createBaby');
        isCreatingRef.current = false;
        return null;
      }

      // ─── CHECK FOR DUPLICATE ──────────────────────────────────────────
      const { data: existingBabies, error: duplicateError } = await supabase
        .from('babies')
        .select('id')
        .eq('name', data.name)
        .eq('date_of_birth', data.birthDate)
        .eq('parent1_id', userId)
        .eq('is_active', true);

      if (duplicateError) {
        console.warn('[BabyContext] Duplicate check error:', duplicateError);
      }

      if (existingBabies && existingBabies.length > 0) {
        console.log('[BabyContext] Duplicate baby found, returning existing ID:', existingBabies[0].id);
        isCreatingRef.current = false;
        return existingBabies[0].id;
      }

      // ─── BUILD BABY DATA ──────────────────────────────────────────────
      const babyData = {
        id: newId,
        name: data.name,
        avatar: data.avatar || null,
        date_of_birth: data.birthDate,
        gender: data.gender === 'boy' ? 'male' : data.gender === 'girl' ? 'female' : 'other',
        blood_type: data.bloodType || null,
        medical_notes: data.medicalNotes || null,
        allergies: data.allergies || null,
        parent1_id: userId,
        parent2_id: data.parent2Id || null,
        current_weight_kg: data.weight ? parseFloat(data.weight) : null,
        current_height_cm: data.height ? parseFloat(data.height) : null,
        birth_time: data.birthTime || null,
        birth_weight_kg: data.birthWeight ? parseFloat(data.birthWeight) : null,
        birth_height_cm: data.birthHeight ? parseFloat(data.birthHeight) : null,
        birth_head_circumference: data.birthHeadCircumference ? parseFloat(data.birthHeadCircumference) : null,
        delivery_type: data.deliveryType ? data.deliveryType.toLowerCase().replace(/-/g, '_') : null,
        gestational_weeks: data.gestationalWeeks ? parseInt(data.gestationalWeeks) : null,
        apgar_1min: data.apgar1Min ? parseInt(data.apgar1Min) : null,
        apgar_5min: data.apgar5Min ? parseInt(data.apgar5Min) : null,
        birth_place: data.birthPlace || null,
        birth_attendant: data.birthAttendant ? data.birthAttendant.toLowerCase().replace(/ /g, '_') : null,
        multiple_birth: data.multipleBirth || false,
        birth_order: data.birthOrder ? parseInt(data.birthOrder) : null,
        feeding_plan: data.feedingPlan ? data.feedingPlan.toLowerCase() : null,
        emergency_contact: data.emergencyContact || null,
        pediatrician: data.pediatrician || null,
        notifications_enabled: data.notificationsEnabled !== false,
        skin_tone: data.skinTone || 0,
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      console.log('[BabyContext] Inserting baby with data:', JSON.stringify(babyData, null, 2));

      const { data: result, error } = await supabase
        .from('babies')
        .insert(babyData)
        .select()
        .single();

      if (error) {
        console.error('[BabyContext] Create baby error:', error);
        isCreatingRef.current = false;
        return null;
      }

      if (!result) {
        console.error('[BabyContext] No result from insert');
        isCreatingRef.current = false;
        return null;
      }

      console.log('[BabyContext] Baby created successfully:', result.id);

      // ─── CREATE BABY PROFILE ──────────────────────────────────────────
      const newBaby: BabyProfile = {
        ...data,
        id: result.id,
        parent1Id: userId,
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: now.toISOString(),
        lastUpdated: now.toISOString(),
        age: calculateAge(data.birthDate),
      };

      // ─── GET BABY COUNT ───────────────────────────────────────────────
      const { count } = await supabase
        .from('babies')
        .select('*', { count: 'exact', head: true })
        .eq('parent1_id', userId)
        .eq('is_active', true);

      const isFirstBaby = (count || 0) <= 1;
      const newCurrentId = isFirstBaby ? result.id : (state.currentBabyId || result.id);

      // ─── SET CURRENT BABY ─────────────────────────────────────────────
      try {
        await supabase
          .from('app_settings')
          .upsert({
            key: 'current_baby_id',
            value: newCurrentId,
            user_id: userId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key, user_id' });
      } catch (e) {
        console.warn('[BabyContext] Failed to set current_baby_id:', e);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, newCurrentId);
      broadcastBabyChange(newCurrentId);

      try {
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'has_skipped_baby')
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[BabyContext] Failed to clear skip baby:', e);
      }

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: [...prev.babies, newBaby],
          currentBabyId: newCurrentId,
          currentBaby: isFirstBaby ? newBaby : prev.currentBaby,
          hasSkippedBaby: false,
        }));
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      await loadAllBabyData(newCurrentId);

      setTimeout(() => {
        broadcastBabyChange(newCurrentId);
      }, 50);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      isCreatingRef.current = false;
      return result.id;
      
    } catch (error) {
      isCreatingRef.current = false;
      console.error('[BabyContext] Create baby error:', error);
      return null;
    }
  }, [calculateAge, loadAllBabyData, state.currentBabyId, authProfile, broadcastBabyChange]);

  // ─── Update baby ──────────────────────────────────────────────────────
  const updateBaby = useCallback(async (id: string, updates: Partial<BabyProfile>) => {
    try {
      const remoteUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.name !== undefined) remoteUpdates.name = updates.name;
      if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
      if (updates.avatar_url !== undefined) remoteUpdates.avatar_url = updates.avatar_url;
      if (updates.birthDate !== undefined) remoteUpdates.date_of_birth = updates.birthDate;
      if (updates.gender !== undefined) {
        remoteUpdates.gender = updates.gender === 'boy' ? 'male' : updates.gender === 'girl' ? 'female' : 'other';
      }
      if (updates.bloodType !== undefined) remoteUpdates.blood_type = updates.bloodType;
      if (updates.medicalNotes !== undefined) remoteUpdates.medical_notes = updates.medicalNotes;
      if (updates.allergies !== undefined) remoteUpdates.allergies = updates.allergies;
      if (updates.parent2Id !== undefined) remoteUpdates.parent2_id = updates.parent2Id;
      
      if (updates.weight !== undefined) {
        remoteUpdates.current_weight_kg = updates.weight ? parseFloat(updates.weight) : null;
      }
      if (updates.height !== undefined) {
        remoteUpdates.current_height_cm = updates.height ? parseFloat(updates.height) : null;
      }
      
      if (updates.birthTime !== undefined) remoteUpdates.birth_time = updates.birthTime;
      if (updates.birthWeight !== undefined) {
        remoteUpdates.birth_weight_kg = updates.birthWeight ? parseFloat(updates.birthWeight) : null;
      }
      if (updates.birthHeight !== undefined) {
        remoteUpdates.birth_height_cm = updates.birthHeight ? parseFloat(updates.birthHeight) : null;
      }
      if (updates.birthHeadCircumference !== undefined) {
        remoteUpdates.birth_head_circumference = updates.birthHeadCircumference ? parseFloat(updates.birthHeadCircumference) : null;
      }
      if (updates.deliveryType !== undefined) {
        remoteUpdates.delivery_type = updates.deliveryType ? updates.deliveryType.toLowerCase().replace(/ /g, '_') : null;
      }
      if (updates.gestationalWeeks !== undefined) {
        remoteUpdates.gestational_weeks = updates.gestationalWeeks ? parseInt(updates.gestationalWeeks) : null;
      }
      if (updates.apgar1Min !== undefined) {
        remoteUpdates.apgar_1min = updates.apgar1Min ? parseInt(updates.apgar1Min) : null;
      }
      if (updates.apgar5Min !== undefined) {
        remoteUpdates.apgar_5min = updates.apgar5Min ? parseInt(updates.apgar5Min) : null;
      }
      if (updates.birthPlace !== undefined) remoteUpdates.birth_place = updates.birthPlace;
      if (updates.birthAttendant !== undefined) {
        remoteUpdates.birth_attendant = updates.birthAttendant ? updates.birthAttendant.toLowerCase().replace(/ /g, '_') : null;
      }
      if (updates.multipleBirth !== undefined) remoteUpdates.multiple_birth = updates.multipleBirth;
      if (updates.birthOrder !== undefined) {
        remoteUpdates.birth_order = updates.birthOrder ? parseInt(updates.birthOrder) : null;
      }
      if (updates.feedingPlan !== undefined) {
        remoteUpdates.feeding_plan = updates.feedingPlan ? updates.feedingPlan.toLowerCase() : null;
      }
      
      if (updates.emergencyContact !== undefined) remoteUpdates.emergency_contact = updates.emergencyContact;
      if (updates.pediatrician !== undefined) remoteUpdates.pediatrician = updates.pediatrician;
      if (updates.notificationsEnabled !== undefined) remoteUpdates.notifications_enabled = updates.notificationsEnabled;
      if (updates.skinTone !== undefined) remoteUpdates.skin_tone = updates.skinTone;
      if (updates.streak !== undefined) remoteUpdates.streak = updates.streak;
      if (updates.milestones !== undefined) remoteUpdates.milestones_count = updates.milestones;
      if (updates.photos !== undefined) remoteUpdates.photos_count = updates.photos;
      
      if (updates.avatar !== undefined || updates.avatar_url !== undefined) {
        remoteUpdates.avatar_updated_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from('babies')
        .update(remoteUpdates)
        .eq('id', id)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        console.error('Update baby error:', error);
        Alert.alert('Error', 'Failed to update baby profile');
        return;
      }

      if (result && isMounted.current) {
        const updatedBaby = mapBabyRowToProfile(result);
        setState(prev => ({
          ...prev,
          babies: prev.babies.map(b => b.id === id ? updatedBaby : b),
          currentBaby: prev.currentBaby?.id === id ? updatedBaby : prev.currentBaby,
        }));
        await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      }
    } catch (error) {
      console.error('Update baby error:', error);
      Alert.alert('Error', 'Failed to update baby profile');
    }
  }, [mapBabyRowToProfile]);

  // ─── Delete baby ──────────────────────────────────────────────────────
  const deleteBaby = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('babies')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Delete baby error:', error);
        Alert.alert('Error', 'Failed to delete baby profile');
        return false;
      }

      const userId = await getCurrentUserId();
      let newCurrentId = state.currentBabyId;
      
      if (state.currentBabyId === id) {
        const remainingBabies = state.babies.filter(b => b.id !== id);
        newCurrentId = remainingBabies[0]?.id || null;
        
        if (newCurrentId && userId) {
          await supabase
            .from('app_settings')
            .upsert({
              key: 'current_baby_id',
              value: newCurrentId,
              user_id: userId,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key, user_id' });
          await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, newCurrentId);
          broadcastBabyChange(newCurrentId);
        } else if (userId) {
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', 'current_baby_id')
            .eq('user_id', userId);
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', 'has_skipped_baby')
            .eq('user_id', userId);
          await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BABY_ID);
          broadcastBabyChange(null);
        }
      }

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: prev.babies.filter(b => b.id !== id),
          currentBabyId: newCurrentId,
          currentBaby: newCurrentId ? prev.babies.find(b => b.id === newCurrentId) || null : null,
          growthData: newCurrentId ? prev.growthData : [],
          milestones: newCurrentId ? prev.milestones : [],
          sleepLogs: newCurrentId ? prev.sleepLogs : [],
          feedingLogs: newCurrentId ? prev.feedingLogs : [],
          pottyLogs: newCurrentId ? prev.pottyLogs : [],
          medicationLogs: newCurrentId ? prev.medicationLogs : [],
          activities: newCurrentId ? prev.activities : [],
        }));
        await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      }

      if (newCurrentId) {
        await loadAllBabyData(newCurrentId);
      }

      setTimeout(() => {
        broadcastBabyChange(newCurrentId);
      }, 50);

      return true;
    } catch (error) {
      console.error('Delete baby error:', error);
      Alert.alert('Error', 'Failed to delete baby profile');
      return false;
    }
  }, [state.currentBabyId, state.babies, loadAllBabyData, getCurrentUserId, broadcastBabyChange]);

  // ─── Switch baby ──────────────────────────────────────────────────────
  const switchBaby = useCallback(async (id: string): Promise<boolean> => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn('[BabyContext] No user for switchBaby');
        return false;
      }

      const { data: baby, error } = await supabase
        .from('babies')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !baby) {
        console.warn(`Baby with id ${id} not found`);
        return false;
      }

      await supabase
        .from('app_settings')
        .upsert({
          key: 'current_baby_id',
          value: id,
          user_id: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key, user_id' });

      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, id);
      await loadAllBabyData(id);

      if (isMounted.current) {
        const babyProfile = mapBabyRowToProfile(baby);
        setState(prev => ({
          ...prev,
          currentBabyId: id,
          currentBaby: babyProfile,
        }));
      }

      setTimeout(() => {
        broadcastBabyChange(id);
      }, 50);

      await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return true;
    } catch (error) {
      console.error('Error switching baby:', error);
      return false;
    }
  }, [loadAllBabyData, mapBabyRowToProfile, getCurrentUserId, broadcastBabyChange]);

  // ─── Refresh current baby ─────────────────────────────────────────────
  const refreshCurrentBaby = useCallback(async () => {
    if (!state.currentBabyId) return;

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn('[BabyContext] No user for refreshCurrentBaby');
        return;
      }

      const { data: baby, error } = await supabase
        .from('babies')
        .select('*')
        .eq('id', state.currentBabyId)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !baby) {
        console.warn('Baby not found, reloading...');
        await loadBabies(true);
        return;
      }

      if (!isMounted.current) return;

      const updatedBaby = mapBabyRowToProfile(baby);

      setState(prev => ({
        ...prev,
        currentBaby: updatedBaby,
        babies: prev.babies.map(b => b.id === state.currentBabyId ? updatedBaby : b),
      }));

      await loadAllBabyData(state.currentBabyId);
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [state.currentBabyId, mapBabyRowToProfile, loadAllBabyData, loadBabies, getCurrentUserId]);

  // ─── GROWTH FUNCTIONS ──────────────────────────────────────────────────
  const addGrowthMeasurement = useCallback(async (
    measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>
  ): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'growth',
          baby_id: measurement.babyId,
          timestamp: new Date(measurement.date).getTime() || Date.now(),
          title: `📏 ${measurement.type}: ${measurement.value} ${measurement.unit}`,
          data: {
            measurementType: measurement.type,
            value: measurement.value,
            unit: measurement.unit,
            date: measurement.date,
            recordedBy: measurement.recordedBy,
          },
          notes: measurement.notes || null,
          logged_by: measurement.recordedBy,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add growth measurement error:', error);
        Alert.alert('Error', 'Failed to save measurement');
        return false;
      }

      const newMeasurement: GrowthMeasurement = { 
        ...measurement, 
        id: newId, 
        createdAt: now 
      };

      if (measurement.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          growthData: [...prev.growthData, newMeasurement] 
        }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Add growth measurement error:', error);
      Alert.alert('Error', 'Failed to save measurement');
      return false;
    }
  }, [state.currentBabyId]);

  const getGrowthData = useCallback((type?: GrowthMeasurement['type']) => {
    let data = [...state.growthData];
    if (type) data = data.filter(m => m.type === type);
    return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.growthData]);

  const getLatestMeasurements = useCallback((): Record<GrowthMeasurement['type'], GrowthMeasurement | null> => {
    const types: GrowthMeasurement['type'][] = ['height', 'weight', 'head', 'temperature'];
    const latest: Record<GrowthMeasurement['type'], GrowthMeasurement | null> = { 
      height: null, 
      weight: null, 
      head: null, 
      temperature: null 
    };
    types.forEach(type => {
      const typeData = state.growthData
        .filter(m => m.type === type)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      latest[type] = typeData[0] || null;
    });
    return latest;
  }, [state.growthData]);

  const deleteGrowthMeasurement = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tracker_entries')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Delete growth measurement error:', error);
        return false;
      }

      const filtered = state.growthData.filter(m => m.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, growthData: filtered }));
      }
      return true;
    } catch (error) {
      console.error('Delete growth measurement error:', error);
      return false;
    }
  }, [state.growthData]);

  // ─── MILESTONE FUNCTIONS ──────────────────────────────────────────────
  const addMilestone = useCallback(async (milestone: Omit<Milestone, 'id'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'milestone',
          baby_id: milestone.babyId,
          timestamp: new Date(milestone.achievedAt).getTime() || Date.now(),
          title: milestone.title,
          data: {
            description: milestone.description,
            category: milestone.category,
            achievedAt: milestone.achievedAt,
            firstTime: milestone.isFirstTime,
            recordedBy: milestone.recordedBy,
            recordedByName: milestone.recordedByName,
          },
          notes: milestone.notes || null,
          photo_uris: milestone.imageUrl ? [milestone.imageUrl] : null,
          logged_by: milestone.recordedBy,
          logged_by_name: milestone.recordedByName,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add milestone error:', error);
        Alert.alert('Error', 'Failed to save milestone');
        return false;
      }

      const newMilestone: Milestone = { ...milestone, id: newId };

      if (milestone.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          milestones: [...prev.milestones, newMilestone] 
        }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Add milestone error:', error);
      Alert.alert('Error', 'Failed to save milestone');
      return false;
    }
  }, [state.currentBabyId]);

  const getMilestones = useCallback((category?: Milestone['category']) => {
    let data = [...state.milestones];
    if (category) data = data.filter(m => m.category === category);
    return data.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [state.milestones]);

  const deleteMilestone = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tracker_entries')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Delete milestone error:', error);
        return false;
      }

      const filtered = state.milestones.filter(m => m.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, milestones: filtered }));
      }
      return true;
    } catch (error) {
      console.error('Delete milestone error:', error);
      return false;
    }
  }, [state.milestones]);

  // ─── SLEEP FUNCTIONS ──────────────────────────────────────────────────
  const addSleepLog = useCallback(async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'sleep',
          baby_id: log.babyId,
          timestamp: new Date(log.startTime).getTime() || Date.now(),
          title: '😴 Sleep',
          data: {
            startTime: log.startTime,
            endTime: log.endTime,
            duration: log.duration,
            quality: log.quality,
            location: log.location,
          },
          notes: log.notes || null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add sleep log error:', error);
        Alert.alert('Error', 'Failed to save sleep log');
        return false;
      }

      const newLog: SleepLog = { ...log, id: newId, createdAt: now };

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          sleepLogs: [...prev.sleepLogs, newLog] 
        }));
      }

      return true;
    } catch (error) {
      console.error('Add sleep log error:', error);
      Alert.alert('Error', 'Failed to save sleep log');
      return false;
    }
  }, [state.currentBabyId]);

  const getSleepLogs = useCallback((days: number = 7) => {
    if (days <= 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return state.sleepLogs
      .filter(log => new Date(log.startTime) >= cutoff)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [state.sleepLogs]);

  const endSleepSession = useCallback(async (logId: string, endTime: string): Promise<boolean> => {
    try {
      const target = state.sleepLogs.find(log => log.id === logId);
      if (!target) return false;

      const start = new Date(target.startTime);
      const end = new Date(endTime);
      if (end <= start) {
        console.warn('End time must be after start time');
        return false;
      }
      const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

      const { error } = await supabase
        .from('tracker_entries')
        .update({
          data: {
            startTime: target.startTime,
            endTime,
            duration,
            quality: target.quality,
            location: target.location,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (error) {
        console.error('End sleep session error:', error);
        return false;
      }

      const updated = state.sleepLogs.map(log =>
        log.id === logId ? { ...log, endTime, duration } : log
      );
      if (isMounted.current) {
        setState(prev => ({ ...prev, sleepLogs: updated }));
      }
      return true;
    } catch (error) {
      console.error('End sleep session error:', error);
      return false;
    }
  }, [state.sleepLogs]);

  const getTodaySleepCount = useCallback(() => {
    const today = getStartOfDay();
    return state.sleepLogs.filter(log => new Date(log.startTime) >= today).length;
  }, [state.sleepLogs]);

  // ─── FEEDING FUNCTIONS ─────────────────────────────────────────────────
  const addFeedingLog = useCallback(async (log: Omit<FeedingLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (log.amount !== undefined && (typeof log.amount !== 'number' || isNaN(log.amount) || log.amount < 0)) {
        Alert.alert('Invalid Amount', 'Please enter a valid positive amount');
        return false;
      }

      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'feed',
          baby_id: log.babyId,
          timestamp: new Date(log.startTime).getTime() || Date.now(),
          title: '🍼 Feeding',
          data: {
            feedType: log.type,
            startTime: log.startTime,
            duration: log.duration,
            amount: log.amount,
            unit: log.unit,
            food: log.food,
          },
          notes: log.notes || null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add feeding log error:', error);
        Alert.alert('Error', 'Failed to save feeding log');
        return false;
      }

      const newLog: FeedingLog = { ...log, id: newId, createdAt: now };

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          feedingLogs: [...prev.feedingLogs, newLog] 
        }));
      }

      return true;
    } catch (error) {
      console.error('Add feeding log error:', error);
      Alert.alert('Error', 'Failed to save feeding log');
      return false;
    }
  }, [state.currentBabyId]);

  const getFeedingLogs = useCallback((days: number = 7) => {
    if (days <= 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return state.feedingLogs
      .filter(log => new Date(log.startTime) >= cutoff)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [state.feedingLogs]);

  const getTodayFeedCount = useCallback(() => {
    const today = getStartOfDay();
    return state.feedingLogs.filter(log => new Date(log.startTime) >= today).length;
  }, [state.feedingLogs]);

  // ─── POTTY FUNCTIONS ──────────────────────────────────────────────────
  const calculatePottyStreak = useCallback((logs: PottyLog[]): number => {
    if (logs.length === 0) return 0;

    const successfulDays = new Set<string>();
    logs.forEach(log => { if (log.successful) successfulDays.add(getDateKey(log.timestamp)); });

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

  const addPottyLog = useCallback(async (log: Omit<PottyLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'potty',
          baby_id: log.babyId,
          timestamp: new Date(log.timestamp).getTime() || Date.now(),
          title: '🚽 Potty',
          data: {
            pottyType: log.type,
            location: log.location,
            successful: log.successful,
            timestamp: log.timestamp,
          },
          notes: log.notes || null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add potty log error:', error);
        Alert.alert('Error', 'Failed to save potty log');
        return false;
      }

      const newLog: PottyLog = { ...log, id: newId, createdAt: now };

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          pottyLogs: [...prev.pottyLogs, newLog] 
        }));
      }

      if (log.successful) {
        const streak = calculatePottyStreak([...state.pottyLogs, newLog]);
        await updateBaby(log.babyId, { streak });
      }

      return true;
    } catch (error) {
      console.error('Add potty log error:', error);
      Alert.alert('Error', 'Failed to save potty log');
      return false;
    }
  }, [state.currentBabyId, state.pottyLogs, updateBaby, calculatePottyStreak]);

  const getPottyLogs = useCallback((days: number = 7) => {
    if (days <= 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return state.pottyLogs
      .filter(log => new Date(log.timestamp) >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.pottyLogs]);

  const getPottyStreak = useCallback(() => calculatePottyStreak(state.pottyLogs), [state.pottyLogs, calculatePottyStreak]);
  const getTodayPottyCount = useCallback(() => {
    const today = getStartOfDay();
    return state.pottyLogs.filter(log => new Date(log.timestamp) >= today).length;
  }, [state.pottyLogs]);
  const getPottySuccessRate = useCallback(() => {
    if (state.pottyLogs.length === 0) return 0;
    const successful = state.pottyLogs.filter(log => log.successful).length;
    return Math.round((successful / state.pottyLogs.length) * 100);
  }, [state.pottyLogs]);

  // ─── MEDICATION FUNCTIONS ─────────────────────────────────────────────
  const addMedicationLog = useCallback(async (log: Omit<MedicationLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (!log.medicationName.trim()) {
        Alert.alert('Missing Information', 'Please enter a medication name');
        return false;
      }

      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: 'medication',
          baby_id: log.babyId,
          timestamp: new Date(log.timestamp).getTime() || Date.now(),
          title: `💊 ${log.medicationName.trim()}`,
          data: {
            medicationName: log.medicationName.trim(),
            dosage: log.dosage,
            reason: log.reason,
            givenBy: log.givenBy,
            timestamp: log.timestamp,
          },
          notes: log.notes || null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Add medication log error:', error);
        Alert.alert('Error', 'Failed to save medication log');
        return false;
      }

      const newLog: MedicationLog = {
        ...log,
        medicationName: log.medicationName.trim(),
        id: newId,
        createdAt: now,
      };

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          medicationLogs: [...prev.medicationLogs, newLog] 
        }));
      }

      return true;
    } catch (error) {
      console.error('Add medication log error:', error);
      Alert.alert('Error', 'Failed to save medication log');
      return false;
    }
  }, [state.currentBabyId]);

  const getMedicationLogs = useCallback((days: number = 30) => {
    if (days <= 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return state.medicationLogs
      .filter(log => new Date(log.timestamp) >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.medicationLogs]);

  // ─── ACTIVITY FUNCTIONS ──────────────────────────────────────────────
  const addActivity = useCallback(async (entry: Omit<ActivityEntry, 'id'>): Promise<boolean> => {
    if (!entry.babyId || !entry.type || !entry.title || !entry.timestamp) {
      console.error('Invalid activity entry: missing required fields');
      return false;
    }

    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'loggedByRole', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
      for (const [key, value] of Object.entries(entry)) {
        if (!skipFields.includes(key) && value !== undefined) {
          entryData[key] = value;
        }
      }

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_type: entry.type,
          baby_id: entry.babyId,
          timestamp: entry.timestamp,
          title: entry.title,
          data: entryData,
          notes: entry.notes || entry.details || null,
          photo_uris: entry.photo ? [entry.photo] : null,
          tags: entry.tags || null,
          logged_by: entry.loggedBy,
          logged_by_name: entry.loggedByName,
          logged_by_role: entry.loggedByRole || null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Failed to add activity:', error);
        Alert.alert('Error', 'Failed to save activity');
        return false;
      }

      const newEntry: ActivityEntry = { ...entry, id: newId };

      if (entry.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          activities: [newEntry, ...prev.activities] 
        }));
      }

      try {
        const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
        const existingEntries: ActivityEntry[] = existing ? JSON.parse(existing) : [];
        const merged = [newEntry, ...existingEntries];
        await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(merged));
      } catch {}

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to add activity:', error);
      Alert.alert('Error', 'Failed to save activity');
      return false;
    }
  }, [state.currentBabyId]);

  const getRecentActivities = useCallback((limit: number = 10) => {
    return [...state.activities]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.max(0, limit));
  }, [state.activities]);

  const getActivitiesByType = useCallback((type: ActivityType) => {
    return state.activities
      .filter(a => a.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [state.activities]);

  const deleteActivity = useCallback(async (id: string): Promise<boolean> => {
    try {
      const entry = state.activities.find(a => a.id === id);
      if (entry?.notificationId) {
        const service = await getNotificationService();
        if (service) {
          await service.cancelNotification(entry.notificationId);
        }
        await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
      }

      const { error } = await supabase
        .from('tracker_entries')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Failed to delete activity:', error);
        return false;
      }

      const filtered = state.activities.filter(a => a.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, activities: filtered }));
      }

      try {
        const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
        if (existing) {
          const entries: ActivityEntry[] = JSON.parse(existing);
          const filteredStorage = entries.filter(e => e.id !== id);
          await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(filteredStorage));
        }
      } catch {}

      return true;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      return false;
    }
  }, [state.activities]);

  // ─── ACTIVITY CONTEXT COMPATIBILITY ──────────────────────────────────
  const entries = state.activities;

  const loadEntries = useCallback(async () => {
    if (state.currentBabyId) {
      await loadAllBabyData(state.currentBabyId);
    }
  }, [state.currentBabyId, loadAllBabyData]);

  const deleteEntry = deleteActivity;
  const addEntry = addActivity;

  const updateEntry = useCallback(async (id: string, updates: Partial<ActivityEntry>): Promise<boolean> => {
    try {
      const existingEntry = state.activities.find(a => a.id === id);
      if (!existingEntry) return false;

      const merged: ActivityEntry = { ...existingEntry, ...updates };

      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'loggedByRole', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
      for (const [key, value] of Object.entries(merged)) {
        if (!skipFields.includes(key) && value !== undefined) {
          entryData[key] = value;
        }
      }

      const { error } = await supabase
        .from('tracker_entries')
        .update({
          timestamp: merged.timestamp,
          title: merged.title,
          data: entryData,
          notes: merged.notes || merged.details || null,
          tags: merged.tags || null,
          photo_uris: merged.photo ? [merged.photo] : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Failed to update entry:', error);
        return false;
      }

      const updated = state.activities.map(a => a.id === id ? merged : a);
      if (isMounted.current) {
        setState(prev => ({ ...prev, activities: updated }));
      }

      try {
        const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
        if (existing) {
          const entries: ActivityEntry[] = JSON.parse(existing);
          const idx = entries.findIndex(e => e.id === id);
          if (idx >= 0) {
            entries[idx] = { ...entries[idx], ...updates };
            await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(entries));
          }
        }
      } catch {}

      return true;
    } catch (error) {
      console.error('Failed to update entry:', error);
      return false;
    }
  }, [state.activities]);

  const getEntryById = useCallback((id: string) => {
    return state.activities.find(a => a.id === id);
  }, [state.activities]);

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
      return daysOfWeek[date.getDay()] || 'Unknown';
    }

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }, []);

  // ─── STATS FUNCTIONS ──────────────────────────────────────────────────
  const getBabyStats = useCallback(() => {
    return {
      streak: state.currentBaby?.streak || 0,
      milestones: state.currentBaby?.milestones || 0,
      photos: state.currentBaby?.photos || 0,
      entries: state.activities.length,
    };
  }, [state.currentBaby, state.activities]);

  const updateBabyStats = useCallback(async (updates: Partial<BabyProfile>) => {
    if (!state.currentBaby) return;
    await updateBaby(state.currentBaby.id, updates);
  }, [state.currentBaby, updateBaby]);

  // ─── Get current baby ID ─────────────────────────────────────────────
  const getCurrentBabyId = useCallback((): string | null => {
    return state.currentBabyId;
  }, [state.currentBabyId]);

  // ─── STUB METHODS ─────────────────────────────────────────────────────
  const syncWithActivityContext = useCallback(async () => {}, []);
  
  const scheduleActivityReminder = useCallback(async (entry: ActivityEntry, minutes: number): Promise<string | null> => {
    try {
      const service = await getNotificationService();
      if (!service) return null;

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
  }, [state.currentBaby, updateEntry]);

  const cancelActivityReminder = useCallback(async (notificationId: string) => {
    try {
      const service = await getNotificationService();
      if (service) {
        await service.cancelNotification(notificationId);
      }

      const entry = state.activities.find(a => a.notificationId === notificationId);
      if (entry) {
        await updateEntry(entry.id, { notificationId: undefined, reminderScheduled: false });
        await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
      }
    } catch {}
  }, [state.activities, updateEntry]);

  // ─── MEMOIZED VALUE ────────────────────────────────────────────────────
  const value = useMemo<BabyContextType>(() => ({
    ...state,
    loadBabies,
    forceRefresh,
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
    getCurrentBabyId,
    subscribeToBabyChanges,
  }), [
    state,
    loadBabies,
    forceRefresh,
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
    getCurrentBabyId,
    subscribeToBabyChanges,
  ]);

  return (
    <BabyContext.Provider value={value}>
      {children}
    </BabyContext.Provider>
  );
};

export const useBaby = (): BabyContextType => {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBaby must be used within BabyProvider');
  return context;
};

export { BabyContext };
export default BabyProvider;