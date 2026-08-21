// src/context/BabyContext.tsx
// Full Supabase implementation - No local DB

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { showAlert } from '@/utils/alert';
import { useAuth } from './AuthContext';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabase';

/* ------------------------------------------------------------------ */
/*  Storage Keys                                                      */
/* ------------------------------------------------------------------ */
export const STORAGE_KEYS = {
  BABIES: '@littleloom_babies',
  CURRENT_BABY: '@littleloom_current_baby',
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export type Gender = 'boy' | 'girl' | 'other';

export type ActivityType =
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
}

const BabyContext = createContext<BabyContextType | null>(null);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */
export const BabyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile: authProfile } = useAuth();

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
  const isMounted = useRef(true);
  const isCreatingRef = useRef(false);
  const loadInProgressRef = useRef(false);

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

  const getBabyAge = useCallback((babyId?: string): string => {
    const id = babyId || state.currentBabyId;
    if (!id) return '';
    const baby = state.babies.find(b => b.id === id);
    return baby?.age || '';
  }, [state.babies, state.currentBabyId]);

  /* ---- Data loading ---- */
  const loadAllBabyData = useCallback(async (babyId: string) => {
    if (!isMounted.current) return;

    setState(prev => ({ ...prev, isLoading: true }));
    setIsLoadingEntries(true);

    try {
      // Fetch from Supabase
      const { data: entries, error } = await supabase
        .from('tracker_entries')
        .select('*')
        .eq('baby_id', babyId)
        .eq('is_deleted', false)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading baby data:', error);
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

      for (const row of entries || []) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
        
        switch (row.tracker_id) {
          case 'growth':
            growthData.push({
              id: row.id,
              babyId: row.baby_id,
              type: data.measurementType || 'weight',
              value: Number(data.value || 0),
              unit: data.unit || 'kg',
              date: data.date || new Date(row.timestamp).toISOString(),
              notes: row.notes || undefined,
              recordedBy: data.recordedBy || data.logged_by || '',
              createdAt: row.created_at || new Date(row.timestamp).toISOString(),
            });
            break;
          case 'milestone':
            milestones.push({
              id: row.id,
              babyId: row.baby_id,
              title: row.title || '',
              description: data.description || '',
              category: data.category || 'physical',
              achievedAt: data.achievedAt || new Date(row.timestamp).toISOString(),
              imageUrl: row.photo_uris?.[0] || undefined,
              notes: row.notes || undefined,
              isFirstTime: data.firstTime || undefined,
              recordedBy: data.recordedBy || data.logged_by || undefined,
              recordedByName: data.recordedByName || data.logged_by_name || undefined,
            });
            break;
          case 'sleep':
            sleepLogs.push({
              id: row.id,
              babyId: row.baby_id,
              startTime: data.startTime || new Date(row.timestamp).toISOString(),
              endTime: data.endTime || undefined,
              duration: data.duration || undefined,
              quality: data.quality || 'good',
              location: data.location || 'other',
              notes: row.notes || undefined,
              createdAt: row.created_at || new Date(row.timestamp).toISOString(),
            });
            break;
          case 'feeding':
            feedingLogs.push({
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
            });
            break;
          case 'potty':
            pottyLogs.push({
              id: row.id,
              babyId: row.baby_id,
              type: data.pottyType || data.type || 'pee',
              location: data.location || 'diaper',
              successful: Boolean(data.successful),
              timestamp: data.timestamp || new Date(row.timestamp).toISOString(),
              notes: row.notes || undefined,
              createdAt: row.created_at || new Date(row.timestamp).toISOString(),
            });
            break;
          case 'medication':
            medicationLogs.push({
              id: row.id,
              babyId: row.baby_id,
              medicationName: data.medicationName || '',
              dosage: data.dosage || '',
              reason: data.reason || undefined,
              givenBy: data.givenBy || data.logged_by || '',
              timestamp: data.timestamp || new Date(row.timestamp).toISOString(),
              notes: row.notes || undefined,
              createdAt: row.created_at || new Date(row.timestamp).toISOString(),
            });
            break;
          default:
            activities.push({
              id: row.id,
              babyId: row.baby_id,
              type: row.tracker_id,
              timestamp: row.timestamp,
              title: row.title || '',
              details: data.details || row.notes || undefined,
              notes: row.notes || undefined,
              photo: row.photo_uris?.[0] || undefined,
              tags: row.tags || [],
              loggedBy: data.loggedBy || row.logged_by || '',
              loggedByName: data.loggedByName || row.logged_by_name || '',
              ...data,
            });
            break;
        }
      }

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
      console.error('Error loading baby data:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      if (isMounted.current) {
        setIsLoadingEntries(false);
      }
    }
  }, []);

  /* ---- loadBabies ---- */
  const loadBabies = useCallback(async () => {
    if (loadInProgressRef.current) {
      console.log('[BabyContext] Load already in progress, skipping');
      return;
    }

    if (!isMounted.current) return;

    loadInProgressRef.current = true;
    console.log('[BabyContext] Starting loadBabies...');

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.warn('[BabyContext] No authenticated user');
        setState(prev => ({ ...prev, isLoading: false }));
        loadInProgressRef.current = false;
        return;
      }

      const userId = user.id;

      // Fetch babies from Supabase
      const { data: parent1Babies, error: error1 } = await supabase
        .from('babies')
        .select('*')
        .eq('parent1_id', userId)
        .eq('is_active', true);

      if (error1) {
        console.error('[BabyContext] parent1 query error:', error1.message);
      }

      const { data: parent2Babies, error: error2 } = await supabase
        .from('babies')
        .select('*')
        .eq('parent2_id', userId)
        .eq('is_active', true);

      if (error2) {
        console.error('[BabyContext] parent2 query error:', error2.message);
      }

      // Combine and deduplicate
      const allBabies: any[] = [];
      const seenIds = new Set<string>();

      const addBaby = (baby: any) => {
        if (baby && !seenIds.has(baby.id)) {
          seenIds.add(baby.id);
          allBabies.push(baby);
        }
      };

      if (parent1Babies) parent1Babies.forEach(addBaby);
      if (parent2Babies) parent2Babies.forEach(addBaby);

      console.log(`[BabyContext] Found ${allBabies.length} babies in Supabase`);

      const babies: BabyProfile[] = allBabies.map(b => ({
        id: b.id,
        name: b.name,
        birthDate: b.date_of_birth,
        age: calculateAge(b.date_of_birth),
        gender: b.gender === 'male' ? 'boy' : b.gender === 'female' ? 'girl' : 'other',
        skinTone: 0,
        avatar: b.avatar || '',
        parent1Id: b.parent1_id || '',
        parent2Id: b.parent2_id || undefined,
        bloodType: b.blood_type || undefined,
        medicalNotes: b.medical_notes || undefined,
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: b.created_at,
        lastUpdated: b.updated_at,
      }));

      // Get current baby ID from app settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'current_baby_id')
        .maybeSingle();

      let currentId = settingsData?.value || null;
      
      // If no current baby but we have babies, set first as current
      if (!currentId && babies.length > 0) {
        currentId = babies[0].id;
        await supabase
          .from('app_settings')
          .upsert({
            key: 'current_baby_id',
            value: currentId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });
      }

      const currentBaby = babies.find(b => b.id === currentId) || babies[0] || null;

      if (!isMounted.current) {
        loadInProgressRef.current = false;
        return;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        babies,
        currentBabyId: currentId,
        currentBaby,
        hasSkippedBaby: false,
      }));

      // Load tracker data for current baby
      if (currentId) {
        console.log('[BabyContext] Loading tracker data for current baby...');
        await loadAllBabyData(currentId);
        console.log('[BabyContext] Tracker data loaded');
      }

    } catch (error) {
      console.error('[BabyContext] Error loading babies:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      loadInProgressRef.current = false;
    }
  }, [calculateAge, loadAllBabyData]);

  /* ---- Initial load ---- */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    isMounted.current = true;
    
    const timer = setTimeout(() => {
      loadBabies();
    }, 100);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, [loadBabies]);

  /* ---- Age auto-refresh ---- */
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

  /* ---- Skip / Clear skip ---- */
  const skipBaby = useCallback(async () => {
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'has_skipped_baby',
          value: 'true',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSkippedBaby: true }));
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Error skipping baby:', error);
    }
  }, []);

  const clearSkipBaby = useCallback(async () => {
    try {
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'has_skipped_baby');
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSkippedBaby: false }));
      }
    } catch (error) {
      console.error('Error clearing skip baby:', error);
    }
  }, []);

  /* ---- Create baby ---- */
  const createBaby = useCallback(async (
    data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated'> & { parent1Id?: string }
  ): Promise<string | null> => {
    if (isCreatingRef.current) {
      Alert.alert('Please wait', 'A baby profile is already being created.');
      return null;
    }
    isCreatingRef.current = true;

    const birthDate = new Date(data.birthDate);
    const now = new Date();
    if (birthDate > now) {
      Alert.alert('Invalid Date', 'Birth date cannot be in the future');
      isCreatingRef.current = false;
      return null;
    }
    if (isNaN(birthDate.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid birth date');
      isCreatingRef.current = false;
      return null;
    }

    try {
      const newId = generateId();
      const effectiveParent1Id = data.parent1Id || authProfile?.id || 'default';

      const { data: result, error } = await supabase
        .from('babies')
        .insert({
          id: newId,
          name: data.name,
          avatar: data.avatar || null,
          date_of_birth: data.birthDate,
          gender: data.gender === 'boy' ? 'male' : data.gender === 'girl' ? 'female' : 'other',
          blood_type: data.bloodType || null,
          medical_notes: data.medicalNotes || null,
          parent1_id: effectiveParent1Id,
          parent2_id: null,
          is_active: true,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Create baby error:', error);
        Alert.alert('Error', 'Failed to create baby profile');
        isCreatingRef.current = false;
        return null;
      }

      const newBaby: BabyProfile = {
        ...data,
        id: newId,
        parent1Id: data.parent1Id || authProfile?.id || 'default',
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: now.toISOString(),
        lastUpdated: now.toISOString(),
        age: calculateAge(data.birthDate),
      };

      // Get existing babies count
      const { count } = await supabase
        .from('babies')
        .select('*', { count: 'exact', head: true })
        .eq('parent1_id', effectiveParent1Id)
        .eq('is_active', true);

      const isFirstBaby = (count || 0) === 0;
      const newCurrentId = isFirstBaby ? newBaby.id : (state.currentBabyId || newBaby.id);

      if (isFirstBaby || !state.currentBabyId) {
        await supabase
          .from('app_settings')
          .upsert({
            key: 'current_baby_id',
            value: newCurrentId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });
      }

      await clearSkipBaby();

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: [...prev.babies, newBaby],
          currentBabyId: newCurrentId,
          currentBaby: isFirstBaby ? newBaby : prev.currentBaby,
        }));
      }

      await loadAllBabyData(newCurrentId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadBabies();

      isCreatingRef.current = false;
      return newBaby.id;
    } catch (error) {
      isCreatingRef.current = false;
      console.error('Create baby error:', error);
      Alert.alert('Error', 'Failed to create baby profile');
      return null;
    }
  }, [calculateAge, clearSkipBaby, loadAllBabyData, state.currentBabyId, state.babies, authProfile, loadBabies]);

  /* ---- Update baby ---- */
  const updateBaby = useCallback(async (id: string, updates: Partial<BabyProfile>) => {
    try {
      const remoteUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.name !== undefined) remoteUpdates.name = updates.name;
      if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
      if (updates.birthDate !== undefined) remoteUpdates.date_of_birth = updates.birthDate;
      if (updates.gender !== undefined) {
        remoteUpdates.gender = updates.gender === 'boy' ? 'male' : updates.gender === 'girl' ? 'female' : 'other';
      }
      if (updates.bloodType !== undefined) remoteUpdates.blood_type = updates.bloodType;
      if (updates.medicalNotes !== undefined) remoteUpdates.medical_notes = updates.medicalNotes;
      if (updates.parent2Id !== undefined) remoteUpdates.parent2_id = updates.parent2Id;

      const { data: result, error } = await supabase
        .from('babies')
        .update(remoteUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update baby error:', error);
        Alert.alert('Error', 'Failed to update baby profile');
        return;
      }

      if (result && isMounted.current) {
        const updatedBaby: BabyProfile = {
          id: result.id,
          name: result.name,
          birthDate: result.date_of_birth,
          age: calculateAge(result.date_of_birth),
          gender: result.gender === 'male' ? 'boy' : result.gender === 'female' ? 'girl' : 'other',
          skinTone: 0,
          avatar: result.avatar || '',
          parent1Id: result.parent1_id || '',
          parent2Id: result.parent2_id || undefined,
          bloodType: result.blood_type || undefined,
          medicalNotes: result.medical_notes || undefined,
          streak: 0,
          milestones: 0,
          photos: 0,
          createdAt: result.created_at,
          lastUpdated: result.updated_at,
        };

        setState(prev => ({
          ...prev,
          babies: prev.babies.map(b => b.id === id ? updatedBaby : b),
          currentBaby: prev.currentBaby?.id === id ? updatedBaby : prev.currentBaby,
        }));
      }
    } catch (error) {
      console.error('Update baby error:', error);
      Alert.alert('Error', 'Failed to update baby profile');
    }
  }, [calculateAge]);

  /* ---- Delete baby ---- */
  const deleteBaby = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Soft delete - set inactive
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

      let newCurrentId = state.currentBabyId;
      if (state.currentBabyId === id) {
        const remainingBabies = state.babies.filter(b => b.id !== id);
        newCurrentId = remainingBabies[0]?.id || null;
        
        if (newCurrentId) {
          await supabase
            .from('app_settings')
            .upsert({
              key: 'current_baby_id',
              value: newCurrentId,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
        } else {
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', 'current_baby_id');
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', 'has_skipped_baby');
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
      }

      if (newCurrentId) {
        await loadAllBabyData(newCurrentId);
      }

      return true;
    } catch (error) {
      console.error('Delete baby error:', error);
      Alert.alert('Error', 'Failed to delete baby profile');
      return false;
    }
  }, [state.currentBabyId, state.babies, loadAllBabyData]);

  /* ---- Switch baby ---- */
  const switchBaby = useCallback(async (id: string): Promise<boolean> => {
    // Check if baby exists
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

    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'current_baby_id',
          value: id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      await loadAllBabyData(id);

      if (isMounted.current) {
        const babyProfile: BabyProfile = {
          id: baby.id,
          name: baby.name,
          birthDate: baby.date_of_birth,
          age: calculateAge(baby.date_of_birth),
          gender: baby.gender === 'male' ? 'boy' : baby.gender === 'female' ? 'girl' : 'other',
          skinTone: 0,
          avatar: baby.avatar || '',
          parent1Id: baby.parent1_id || '',
          parent2Id: baby.parent2_id || undefined,
          bloodType: baby.blood_type || undefined,
          medicalNotes: baby.medical_notes || undefined,
          streak: 0,
          milestones: 0,
          photos: 0,
          createdAt: baby.created_at,
          lastUpdated: baby.updated_at,
        };

        setState(prev => ({
          ...prev,
          currentBabyId: id,
          currentBaby: babyProfile,
        }));
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return true;
    } catch (error) {
      console.error('Error switching baby:', error);
      return false;
    }
  }, [loadAllBabyData, calculateAge]);

  /* ---- Refresh current baby ---- */
  const refreshCurrentBaby = useCallback(async () => {
    if (!state.currentBabyId) return;

    try {
      const { data: baby, error } = await supabase
        .from('babies')
        .select('*')
        .eq('id', state.currentBabyId)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !baby) {
        console.warn('Baby not found, reloading...');
        await loadBabies();
        return;
      }

      if (!isMounted.current) return;

      const updatedBaby: BabyProfile = {
        id: baby.id,
        name: baby.name,
        birthDate: baby.date_of_birth,
        age: calculateAge(baby.date_of_birth),
        gender: baby.gender === 'male' ? 'boy' : baby.gender === 'female' ? 'girl' : 'other',
        skinTone: 0,
        avatar: baby.avatar || '',
        parent1Id: baby.parent1_id || '',
        parent2Id: baby.parent2_id || undefined,
        bloodType: baby.blood_type || undefined,
        medicalNotes: baby.medical_notes || undefined,
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: baby.created_at,
        lastUpdated: baby.updated_at,
      };

      setState(prev => ({
        ...prev,
        currentBaby: updatedBaby,
        babies: prev.babies.map(b => b.id === state.currentBabyId ? updatedBaby : b),
      }));

      await loadAllBabyData(state.currentBabyId);
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [state.currentBabyId, calculateAge, loadAllBabyData, loadBabies]);

  /* ---- Growth ---- */
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
          tracker_id: 'growth',
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
          notes: measurement.notes,
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

      const newMeasurement: GrowthMeasurement = { ...measurement, id: newId, createdAt: now };

      if (measurement.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, growthData: [...prev.growthData, newMeasurement] }));
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
    const latest: Record<GrowthMeasurement['type'], GrowthMeasurement | null> = { height: null, weight: null, head: null, temperature: null };
    types.forEach(type => {
      const typeData = state.growthData.filter(m => m.type === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  /* ---- Milestone ---- */
  const addMilestone = useCallback(async (milestone: Omit<Milestone, 'id'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_id: 'milestone',
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
          notes: milestone.notes,
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
        setState(prev => ({ ...prev, milestones: [...prev.milestones, newMilestone] }));
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

  /* ---- Sleep ---- */
  const addSleepLog = useCallback(async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_id: 'sleep',
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
          notes: log.notes,
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
        setState(prev => ({ ...prev, sleepLogs: [...prev.sleepLogs, newLog] }));
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

  /* ---- Feeding ---- */
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
          tracker_id: 'feeding',
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
          notes: log.notes,
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
        setState(prev => ({ ...prev, feedingLogs: [...prev.feedingLogs, newLog] }));
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

  /* ---- Potty ---- */
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
          tracker_id: 'potty',
          baby_id: log.babyId,
          timestamp: new Date(log.timestamp).getTime() || Date.now(),
          title: '🚽 Potty',
          data: {
            pottyType: log.type,
            location: log.location,
            successful: log.successful,
            timestamp: log.timestamp,
          },
          notes: log.notes,
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
        setState(prev => ({ ...prev, pottyLogs: [...prev.pottyLogs, newLog] }));
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

  /* ---- Medication ---- */
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
          tracker_id: 'medication',
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
          notes: log.notes,
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
        setState(prev => ({ ...prev, medicationLogs: [...prev.medicationLogs, newLog] }));
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

  /* ---- Activities ---- */
  const addActivity = useCallback(async (entry: Omit<ActivityEntry, 'id'>): Promise<boolean> => {
    if (!entry.babyId || !entry.type || !entry.title || !entry.timestamp) {
      console.error('Invalid activity entry: missing required fields');
      return false;
    }

    try {
      const newId = generateId();
      const now = new Date().toISOString();

      // Extract data fields
      const entryData: Record<string, unknown> = {};
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
      for (const [key, value] of Object.entries(entry)) {
        if (!skipFields.includes(key) && value !== undefined) {
          entryData[key] = value;
        }
      }

      const { error } = await supabase
        .from('tracker_entries')
        .insert({
          id: newId,
          tracker_id: entry.type,
          baby_id: entry.babyId,
          timestamp: entry.timestamp,
          title: entry.title,
          data: entryData,
          notes: entry.notes || entry.details,
          photo_uris: entry.photo ? [entry.photo] : null,
          tags: entry.tags || null,
          logged_by: entry.loggedBy,
          logged_by_name: entry.loggedByName,
          created_at: now,
          updated_at: now,
          is_deleted: false,
        });

      if (error) {
        console.error('Failed to add activity:', error);
        return false;
      }

      const newEntry: ActivityEntry = { ...entry, id: newId };

      if (entry.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, activities: [newEntry, ...prev.activities] }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to add activity:', error);
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

      return true;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      return false;
    }
  }, [state.activities]);

  /* ---- Stats ---- */
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

  /* ---- Entry methods (ActivityContext compatibility) ---- */
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
      const skipFields = ['id', 'type', 'babyId', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
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
          notes: merged.notes || merged.details,
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

  /* ---- Stub methods (for compatibility) ---- */
  const syncWithActivityContext = useCallback(async () => {}, []);
  const scheduleActivityReminder = useCallback(async (entry: ActivityEntry, minutes: number): Promise<string | null> => {
    return null;
  }, []);
  const cancelActivityReminder = useCallback(async (notificationId: string): Promise<void> => {}, []);

  /* ---- Memoized context value ---- */
  const value = useMemo<BabyContextType>(() => ({
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
  }), [
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