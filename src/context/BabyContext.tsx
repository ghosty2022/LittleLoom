import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  getAllBabiesFromDb,
  getBabyByIdFromDb,
  createBabyInDb,
  updateBabyInDb,
  deleteBabyFromDb,
  setCurrentBabyInDb,
  getAppSetting,
  setAppSetting,
  deleteAppSetting,
  runOneTimeMigration,
  getEntriesByBabyFromDb,
  createEntryInDb,
  updateEntryInDb,
  softDeleteEntryInDb,
} from '../database/dbHelpers';

/* ------------------------------------------------------------------ */
/*  Storage Keys                                                      */
/* ------------------------------------------------------------------ */
export const STORAGE_KEYS = {
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
  try {
    const { notificationService } = await import('@/services/NotificationService');
    return notificationService;
  } catch {
    return null;
  }
};

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

const safeParse = <T,>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
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
  
  /* FIX #5: isMounted ref for all async operations */
  const isMounted = useRef(true);

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
    /* FIX #5: Guard against unmounted component */
    if (!isMounted.current) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
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

      /* FIX #5: Check isMounted before setting state */
      if (!isMounted.current) return;

      setState(prev => ({
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
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      if (isMounted.current) {
        setIsLoadingEntries(false);
      }
    }
  }, []);

  const loadBabies = useCallback(async () => {
    if (!isMounted.current) return;
    
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Run migration first, then load from Drizzle
      await runOneTimeMigration();
      
      const dbBabies = await getAllBabiesFromDb();
      const currentId = await getAppSetting('current_baby_id');
      const hasSkipped = await getAppSetting('has_skipped_baby');

      let babies: BabyProfile[] = dbBabies.map(b => ({
        id: b.id,
        name: b.name,
        birthDate: b.dateOfBirth,
        age: calculateAge(b.dateOfBirth),
        gender: b.gender === 'male' ? 'boy' : b.gender === 'female' ? 'girl' : 'other',
        skinTone: 0,
        avatar: b.avatar || '',
        parent1Id: b.parent1Id || 'default',
        parent2Id: b.parent2Id,
        weight: undefined,
        height: undefined,
        bloodType: b.bloodType,
        allergies: undefined,
        medicalNotes: b.medicalNotes,
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: b.createdAt,
        lastUpdated: b.updatedAt,
      }));

      let effectiveCurrentId = currentId;
      if (!effectiveCurrentId && babies.length > 0) {
        effectiveCurrentId = babies[0].id;
        await setCurrentBabyInDb(effectiveCurrentId);
      }

      const currentBaby = babies.find(b => b.id === effectiveCurrentId) || babies[0] || null;

      if (!isMounted.current) return;

      setState(prev => ({
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
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [calculateAge, loadAllBabyData]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    /* FIX #5: Track mount status */
    isMounted.current = true;
    loadBabies();
    
    return () => {
      isMounted.current = false;
    };
  }, [loadBabies]);

  /* ---- Age auto-refresh ---- */
  useEffect(() => {
    if (state.babies.length === 0) return;

    const updateAges = () => {
      /* FIX #5: Guard state updates */
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
      await setAppSetting('has_skipped_baby', 'true');
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
      await deleteAppSetting('has_skipped_baby');
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSkippedBaby: false }));
      }
    } catch (error) {
      console.error('Error clearing skip baby:', error);
    }
  }, []);

  /* ---- Create baby ---- */
  const createBaby = useCallback(async (
    data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated' | 'parent1Id'>
  ): Promise<string | null> => {
    const birthDate = new Date(data.birthDate);
    const now = new Date();
    if (birthDate > now) {
      Alert.alert('Invalid Date', 'Birth date cannot be in the future');
      return null;
    }
    if (isNaN(birthDate.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid birth date');
      return null;
    }

    try {
      const existingBabies = await getAllBabiesFromDb();
      const newId = generateId();

      await createBabyInDb({
        id: newId,
        name: data.name,
        avatar: data.avatar,
        dateOfBirth: data.birthDate,
        gender: data.gender === 'boy' ? 'male' : data.gender === 'girl' ? 'female' : 'other',
        bloodType: data.bloodType,
        medicalNotes: data.medicalNotes,
        parent1Id: 'default',
      });

      const newBaby: BabyProfile = {
        ...data,
        id: newId,
        parent1Id: 'default',
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: now.toISOString(),
        lastUpdated: now.toISOString(),
        age: calculateAge(data.birthDate),
      };

      const isFirstBaby = existingBabies.length === 0;
      const newCurrentId = isFirstBaby ? newBaby.id : (state.currentBabyId || newBaby.id);

      if (isFirstBaby || !state.currentBabyId) {
        await setCurrentBabyInDb(newCurrentId);
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

      await loadAllBabyData(newBaby.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return newBaby.id;
    } catch (error) {
      console.error('Create baby error:', error);
      Alert.alert('Error', 'Failed to create baby profile');
      return null;
    }
  }, [calculateAge, clearSkipBaby, loadAllBabyData, state.currentBabyId, state.babies]);

  /* ---- Update baby ---- */
  const updateBaby = useCallback(async (id: string, updates: Partial<BabyProfile>) => {
    try {
      await updateBabyInDb(id, {
        name: updates.name,
        avatar: updates.avatar,
        dateOfBirth: updates.birthDate,
        gender: updates.gender === 'boy' ? 'male' : updates.gender === 'girl' ? 'female' : updates.gender === 'other' ? 'other' : undefined,
        bloodType: updates.bloodType,
        medicalNotes: updates.medicalNotes,
        parent2Id: updates.parent2Id,
      });

      const fresh = await getBabyByIdFromDb(id);
      if (fresh && isMounted.current) {
        const updatedBaby: BabyProfile = {
          id: fresh.id,
          name: fresh.name,
          birthDate: fresh.dateOfBirth,
          age: calculateAge(fresh.dateOfBirth),
          gender: fresh.gender === 'male' ? 'boy' : fresh.gender === 'female' ? 'girl' : 'other',
          skinTone: 0,
          avatar: fresh.avatar || '',
          parent1Id: fresh.parent1Id || 'default',
          parent2Id: fresh.parent2Id,
          bloodType: fresh.bloodType,
          medicalNotes: fresh.medicalNotes,
          streak: 0,
          milestones: 0,
          photos: 0,
          createdAt: fresh.createdAt,
          lastUpdated: fresh.updatedAt,
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
      await deleteBabyFromDb(id);
      // Entries cascade delete via ON DELETE CASCADE in schema

      let newCurrentId = state.currentBabyId;
      if (state.currentBabyId === id) {
        const remaining = await getAllBabiesFromDb();
        newCurrentId = remaining[0]?.id || null;
        if (newCurrentId) {
          await setCurrentBabyInDb(newCurrentId);
        } else {
          await setCurrentBabyInDb(null);
          await deleteAppSetting('has_skipped_baby');
        }
      }

      const remaining = await getAllBabiesFromDb();
      const newCurrentBaby = remaining.find(b => b.id === newCurrentId) || null;

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: remaining.map(b => ({
            id: b.id,
            name: b.name,
            birthDate: b.dateOfBirth,
            age: calculateAge(b.dateOfBirth),
            gender: b.gender === 'male' ? 'boy' : b.gender === 'female' ? 'girl' : 'other',
            skinTone: 0,
            avatar: b.avatar || '',
            parent1Id: b.parent1Id || 'default',
            parent2Id: b.parent2Id,
            bloodType: b.bloodType,
            medicalNotes: b.medicalNotes,
            streak: 0,
            milestones: 0,
            photos: 0,
            createdAt: b.createdAt,
            lastUpdated: b.updatedAt,
          })),
          currentBabyId: newCurrentId,
          currentBaby: newCurrentBaby ? {
            id: newCurrentBaby.id,
            name: newCurrentBaby.name,
            birthDate: newCurrentBaby.dateOfBirth,
            age: calculateAge(newCurrentBaby.dateOfBirth),
            gender: newCurrentBaby.gender === 'male' ? 'boy' : newCurrentBaby.gender === 'female' ? 'girl' : 'other',
            skinTone: 0,
            avatar: newCurrentBaby.avatar || '',
            parent1Id: newCurrentBaby.parent1Id || 'default',
            parent2Id: newCurrentBaby.parent2Id,
            bloodType: newCurrentBaby.bloodType,
            medicalNotes: newCurrentBaby.medicalNotes,
            streak: 0,
            milestones: 0,
            photos: 0,
            createdAt: newCurrentBaby.createdAt,
            lastUpdated: newCurrentBaby.updatedAt,
          } : null,
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
  }, [state.currentBabyId, loadAllBabyData, calculateAge]);

  /* ---- Switch baby ---- */
  const switchBaby = useCallback(async (id: string): Promise<boolean> => {
    const baby = await getBabyByIdFromDb(id);
    
    if (!baby) {
      console.warn(`Baby with id ${id} not found`);
      return false;
    }

    try {
      await setCurrentBabyInDb(id);
      await loadAllBabyData(id);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          currentBabyId: id,
          currentBaby: {
            id: baby.id,
            name: baby.name,
            birthDate: baby.dateOfBirth,
            age: calculateAge(baby.dateOfBirth),
            gender: baby.gender === 'male' ? 'boy' : baby.gender === 'female' ? 'girl' : 'other',
            skinTone: 0,
            avatar: baby.avatar || '',
            parent1Id: baby.parent1Id || 'default',
            parent2Id: baby.parent2Id,
            bloodType: baby.bloodType,
            medicalNotes: baby.medicalNotes,
            streak: 0,
            milestones: 0,
            photos: 0,
            createdAt: baby.createdAt,
            lastUpdated: baby.updatedAt,
          },
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
      const babiesStr = await AsyncStorage.getItem(STORAGE_KEYS.BABIES);
      const babies = safeParse<BabyProfile[]>(babiesStr, []);
      const currentBaby = babies.find(b => b.id === state.currentBabyId);

      if (currentBaby && isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: babies.map(b => ({ ...b, age: calculateAge(b.birthDate) })),
          currentBaby: { ...currentBaby, age: calculateAge(currentBaby.birthDate) },
        }));

        await loadAllBabyData(state.currentBabyId);
      }
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [state.currentBabyId, calculateAge, loadAllBabyData]);

  /* ---- Growth ---- */
  const addGrowthMeasurement = useCallback(async (
    measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>
  ): Promise<boolean> => {
    try {
      const newId = generateId();

      await createEntryInDb({
        id: newId,
        trackerId: 'growth',
        babyId: measurement.babyId,
        timestamp: new Date(measurement.date).getTime() || Date.now(),
        title: `📏 ${measurement.type}: ${measurement.value} ${measurement.unit}`,
        data: {
          measurementType: measurement.type,
          value: measurement.value,
          unit: measurement.unit,
        },
        notes: measurement.notes,
        loggedBy: measurement.recordedBy,
      });

      const newMeasurement: GrowthMeasurement = { ...measurement, id: newId, createdAt: new Date().toISOString() };

      if (measurement.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, growthData: [...prev.growthData, newMeasurement] }));
      }

      const baby = await getBabyByIdFromDb(measurement.babyId);
      if (baby) {
        const updates: Partial<BabyProfile> = {};
        if (measurement.type === 'height') updates.height = `${measurement.value} ${measurement.unit}`;
        if (measurement.type === 'weight') updates.weight = `${measurement.value} ${measurement.unit}`;
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
  }, [state.currentBabyId, updateBaby]);

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
      if (!state.currentBabyId) return false;
      await softDeleteEntryInDb(id);
      const filtered = state.growthData.filter(m => m.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, growthData: filtered }));
      }
      return true;
    } catch (error) {
      console.error('Delete growth measurement error:', error);
      return false;
    }
  }, [state.currentBabyId, state.growthData]);

  /* ---- Milestones ---- */
  const addMilestone = useCallback(async (milestone: Omit<Milestone, 'id'>): Promise<boolean> => {
    try {
      const newId = generateId();

      await createEntryInDb({
        id: newId,
        trackerId: 'milestone',
        babyId: milestone.babyId,
        timestamp: new Date(milestone.achievedAt).getTime() || Date.now(),
        title: milestone.title,
        data: {
          description: milestone.description,
          category: milestone.category,
          firstTime: milestone.isFirstTime,
        },
        notes: milestone.notes,
        loggedBy: milestone.recordedBy,
        loggedByName: milestone.recordedByName,
      });

      const newMilestone: Milestone = { ...milestone, id: newId };

      if (milestone.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, milestones: [...prev.milestones, newMilestone] }));
      }

      const currentCount = state.milestones.filter(m => m.babyId === milestone.babyId).length + 1;
      await updateBaby(milestone.babyId, { milestones: currentCount });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Add milestone error:', error);
      Alert.alert('Error', 'Failed to save milestone');
      return false;
    }
  }, [state.currentBabyId, updateBaby, state.milestones]);

  const getMilestones = useCallback((category?: Milestone['category']) => {
    let data = [...state.milestones];
    if (category) data = data.filter(m => m.category === category);
    return data.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [state.milestones]);

  const deleteMilestone = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (!state.currentBabyId) return false;
      await softDeleteEntryInDb(id);
      const filtered = state.milestones.filter(m => m.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, milestones: filtered }));
      }
      return true;
    } catch (error) {
      console.error('Delete milestone error:', error);
      return false;
    }
  }, [state.currentBabyId, state.milestones]);

  /* ---- Sleep ---- */
  const addSleepLog = useCallback(async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newLog: SleepLog = { ...log, id: generateId(), createdAt: new Date().toISOString() };

      const key = STORAGE_KEYS.SLEEP_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: SleepLog[] = safeParse(existing, []);
      logs.push(newLog);

      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, sleepLogs: logs }));
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
      if (!state.currentBabyId) return false;
      const key = STORAGE_KEYS.SLEEP_LOGS(state.currentBabyId);
      const updated = state.sleepLogs.map(log => {
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
      if (isMounted.current) {
        setState(prev => ({ ...prev, sleepLogs: updated }));
      }
      return true;
    } catch (error) {
      console.error('End sleep session error:', error);
      return false;
    }
  }, [state.currentBabyId, state.sleepLogs]);

  const getTodaySleepCount = useCallback(() => {
    const today = getStartOfDay();
    return state.sleepLogs.filter(log => new Date(log.startTime) >= today).length;
  }, [state.sleepLogs]);

  /* ---- Feeding ---- */
  const addFeedingLog = useCallback(async (log: Omit<FeedingLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (log.amount !== undefined && (isNaN(log.amount) || log.amount < 0)) {
             Alert.alert('Invalid Amount', 'Please enter a valid positive amount');
        return false;
      }

      const newLog: FeedingLog = { ...log, id: generateId(), createdAt: new Date().toISOString() };

      const key = STORAGE_KEYS.FEEDING_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: FeedingLog[] = safeParse(existing, []);
      logs.push(newLog);

      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, feedingLogs: logs }));
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
      const newLog: PottyLog = { ...log, id: generateId(), createdAt: new Date().toISOString() };

      const key = STORAGE_KEYS.POTTY_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: PottyLog[] = safeParse(existing, []);
      logs.push(newLog);

      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, pottyLogs: logs }));
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
  }, [state.currentBabyId, updateBaby, calculatePottyStreak]);

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

      if (log.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, medicationLogs: logs }));
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

      // Extract data fields
      const entryData: Record<string, unknown> = {};
      const skipFields = ['babyId', 'type', 'timestamp', 'title', 'details', 'icon', 'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'notificationId', 'reminderScheduled', 'syncedAt'];
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

      const newEntry: ActivityEntry = { ...entry, id: newId };

      if (entry.babyId === state.currentBabyId && isMounted.current) {
        setState(prev => ({ ...prev, activities: [newEntry, ...prev.activities] }));
      }

      await syncToActivityContext(newEntry);

      if (['feed', 'sleep', 'potty', 'milestone', 'growth'].includes(entry.type)) {
        const service = await getNotificationService();
        if (service) {
          await service.sendActivityCompleteNotification(entry.type, state.currentBaby?.name || 'baby');
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to add activity:', error);
      return false;
    }
  }, [state.currentBabyId, state.currentBaby]);

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
      if (!state.currentBabyId) return false;

      const entry = state.activities.find(a => a.id === id);
      if (entry?.notificationId) {
        const service = await getNotificationService();
        if (service) {
          await service.cancelNotification(entry.notificationId);
        }
        await AsyncStorage.removeItem(`${NOTIFICATION_PREFIX}${entry.id}`);
      }

      await softDeleteEntryInDb(id);

      const filtered = state.activities.filter(a => a.id !== id);
      if (isMounted.current) {
        setState(prev => ({ ...prev, activities: filtered }));
      }

      await removeFromActivityContext(id);

      return true;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      return false;
    }
  }, [state.currentBabyId, state.activities]);

  /* ---- Cross-context sync: ActivityContext ---- */
  const syncToActivityContext = useCallback(async (entry: ActivityEntry) => {
    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      const existingEntries: ActivityEntry[] = existing ? JSON.parse(existing) : [];
      const exists = existingEntries.some(e => e.id === entry.id);
      if (exists) return;
      const merged = [entry, ...existingEntries];
      await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(merged));
    } catch {
    }
  }, []);

  const removeFromActivityContext = useCallback(async (entryId: string) => {
    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      if (!existing) return;
      const entries: ActivityEntry[] = JSON.parse(existing);
      const filtered = entries.filter(e => e.id !== entryId);
      await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(filtered));
    } catch {
    }
  }, []);

  const syncWithActivityContext = useCallback(async () => {
    if (!state.currentBabyId || state.activities.length === 0) return;

    try {
      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      const existingEntries: ActivityEntry[] = existing ? JSON.parse(existing) : [];
      const existingIds = new Set(existingEntries.map(e => e.id));
      const newActivities = state.activities.filter(a => !existingIds.has(a.id));
      if (newActivities.length > 0) {
        const merged = [...newActivities, ...existingEntries];
        await AsyncStorage.setItem(ACTIVITY_CONTEXT_KEY, JSON.stringify(merged));
      }
    } catch {
    }
  }, [state.currentBabyId, state.activities]);

  /* ---- Notification integration ---- */
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
  }, [state.currentBaby]);

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
    } catch {
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

  const updateEntry = useCallback(async (id: string, entry: Partial<ActivityEntry>): Promise<boolean> => {
    try {
      if (!state.currentBabyId) return false;

      const key = STORAGE_KEYS.ACTIVITIES(state.currentBabyId);
      const updated = state.activities.map(a => a.id === id ? { ...a, ...entry } : a);

      await AsyncStorage.setItem(key, JSON.stringify(updated));
      if (isMounted.current) {
        setState(prev => ({ ...prev, activities: updated }));
      }

      const existing = await AsyncStorage.getItem(ACTIVITY_CONTEXT_KEY);
      if (existing) {
        const entries: ActivityEntry[] = JSON.parse(existing);
        const activityIndex = entries.findIndex(e => e.id === id);
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
  }, [state.currentBabyId, state.activities]);

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

  const updateBabyStats = useCallback(async (updates: Partial<BabyProfile>) => {
    if (!state.currentBaby) return;
    await updateBaby(state.currentBaby.id, updates);
  }, [state.currentBaby, updateBaby]);

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