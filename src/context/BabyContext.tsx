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
import type { Baby as DbBaby, TrackerEntry as DbTrackerEntry } from '../database/schema';

/* ------------------------------------------------------------------ */
/*  Storage Keys                                                      */
/* ------------------------------------------------------------------ */
/* DEPRECATED — legacy per-baby AsyncStorage keys.
   Nothing in this context reads or writes them anymore: babies live in the
   `babies` table and ALL tracker data (growth, milestones, sleep, feeding,
   potty, medication, activities) lives in `tracker_entries`.
   They remain exported only because the one-time migration in dbHelpers
   (runTrackerLogMigration) still reads them to import pre-DB data. */
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
/*  DB row → domain model mappers                                      */
/*  Single source of truth for translating tracker_entries rows back   */
/*  into the typed shapes the UI consumes.                             */
/* ------------------------------------------------------------------ */

/* Row JSON columns may arrive already parsed (mode: 'json') or as a raw
   string depending on how the row was written — tolerate both. */
const parseRowData = (raw: unknown): Record<string, any> =>
  typeof raw === 'string' ? safeParse(raw, {}) : ((raw as Record<string, any>) ?? {});

const parseRowArray = (raw: unknown): string[] =>
  typeof raw === 'string' ? safeParse(raw, []) : Array.isArray(raw) ? (raw as string[]) : [];

const mapDbBabyToProfile = (b: DbBaby, calculateAge: (birthDate: string) => string): BabyProfile => ({
  id: b.id,
  name: b.name,
  birthDate: b.dateOfBirth,
  age: calculateAge(b.dateOfBirth),
  gender: b.gender === 'male' ? 'boy' : b.gender === 'female' ? 'girl' : 'other',
  skinTone: 0,
  avatar: b.avatar || '',
  parent1Id: b.parent1Id || 'default',
  parent2Id: b.parent2Id ?? undefined,
  bloodType: b.bloodType ?? undefined,
  medicalNotes: b.medicalNotes ?? undefined,
  streak: 0,
  milestones: 0,
  photos: 0,
  createdAt: b.createdAt,
  lastUpdated: b.updatedAt,
});

const mapRowToGrowth = (row: DbTrackerEntry): GrowthMeasurement => {
  const data = parseRowData(row.data);
  return {
    id: row.id,
    babyId: row.babyId,
    type: (data.measurementType as GrowthMeasurement['type']) ?? 'weight',
    value: Number(data.value ?? 0),
    unit: (data.unit as GrowthMeasurement['unit']) ?? 'kg',
    date: typeof data.date === 'string' ? data.date : new Date(row.timestamp).toISOString(),
    notes: row.notes ?? undefined,
    recordedBy: (data.recordedBy as string) ?? (data.loggedBy as string) ?? '',
    createdAt: row.createdAt ?? new Date(row.timestamp).toISOString(),
  };
};

const mapRowToMilestone = (row: DbTrackerEntry): Milestone => {
  const data = parseRowData(row.data);
  const photoUris = parseRowArray(row.photoUris);
  return {
    id: row.id,
    babyId: row.babyId,
    title: row.title ?? (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    category: (data.category as Milestone['category']) ?? 'physical',
    achievedAt: typeof data.achievedAt === 'string' ? data.achievedAt : new Date(row.timestamp).toISOString(),
    imageUrl: photoUris[0] ?? (data.imageUrl as string) ?? undefined,
    notes: row.notes ?? undefined,
    isFirstTime: (data.firstTime as boolean) ?? undefined,
    recordedBy: (data.recordedBy as string) ?? (data.loggedBy as string) ?? undefined,
    recordedByName: (data.recordedByName as string) ?? (data.loggedByName as string) ?? undefined,
  };
};

const mapRowToSleep = (row: DbTrackerEntry): SleepLog => {
  const data = parseRowData(row.data);
  return {
    id: row.id,
    babyId: row.babyId,
    startTime: typeof data.startTime === 'string' ? data.startTime : new Date(row.timestamp).toISOString(),
    endTime: (data.endTime as string) ?? undefined,
    duration: (data.duration as number) ?? undefined,
    quality: (data.quality as SleepLog['quality']) ?? 'good',
    location: (data.location as SleepLog['location']) ?? 'other',
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? new Date(row.timestamp).toISOString(),
  };
};

const mapRowToFeeding = (row: DbTrackerEntry): FeedingLog => {
  const data = parseRowData(row.data);
  return {
    id: row.id,
    babyId: row.babyId,
    type: (data.feedType as FeedingLog['type']) ?? (data.type as FeedingLog['type']) ?? 'bottle',
    startTime: typeof data.startTime === 'string' ? data.startTime : new Date(row.timestamp).toISOString(),
    duration: (data.duration as number) ?? undefined,
    amount: (data.amount as number) ?? undefined,
    unit: (data.unit as FeedingLog['unit']) ?? undefined,
    food: (data.food as string) ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? new Date(row.timestamp).toISOString(),
  };
};

const mapRowToPotty = (row: DbTrackerEntry): PottyLog => {
  const data = parseRowData(row.data);
  return {
    id: row.id,
    babyId: row.babyId,
    type: (data.pottyType as PottyLog['type']) ?? (data.type as PottyLog['type']) ?? 'pee',
    location: (data.location as PottyLog['location']) ?? 'diaper',
    successful: Boolean(data.successful),
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date(row.timestamp).toISOString(),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? new Date(row.timestamp).toISOString(),
  };
};

const mapRowToMedication = (row: DbTrackerEntry): MedicationLog => {
  const data = parseRowData(row.data);
  return {
    id: row.id,
    babyId: row.babyId,
    medicationName: (data.medicationName as string) ?? '',
    dosage: (data.dosage as string) ?? '',
    reason: (data.reason as string) ?? undefined,
    givenBy: (data.givenBy as string) ?? (data.loggedBy as string) ?? '',
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date(row.timestamp).toISOString(),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? new Date(row.timestamp).toISOString(),
  };
};

const mapRowToActivity = (row: DbTrackerEntry): ActivityEntry => {
  const data = parseRowData(row.data);
  const photoUris = parseRowArray(row.photoUris);
  const tags = parseRowArray(row.tags);
  return {
    ...data,
    id: row.id,
    babyId: row.babyId,
    type: row.trackerId,
    timestamp: row.timestamp,
    title: row.title ?? '',
    details: (data.details as string) ?? row.notes ?? undefined,
    notes: row.notes ?? undefined,
    photo: photoUris[0] ?? (data.photo as string) ?? undefined,
    tags,
    loggedBy: (data.loggedBy as string) ?? '',
    loggedByName: (data.loggedByName as string) ?? '',
  };
};

/* Fields that live in dedicated tracker_entries columns (or are derived)
   rather than in the JSON `data` payload. Everything else on an
   ActivityEntry is preserved inside `data` so it survives a DB round-trip —
   including icon, notificationId and reminderScheduled. */
const ENTRY_COLUMN_FIELDS = new Set([
  'id', 'babyId', 'type', 'timestamp', 'title', 'details',
  'loggedBy', 'loggedByName', 'notes', 'photo', 'tags', 'syncedAt',
]);

const extractEntryData = (entry: Partial<ActivityEntry>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!ENTRY_COLUMN_FIELDS.has(key) && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
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
  /* All tracker data (growth, milestones, sleep, feeding, potty, medication,
     activities) is loaded from the Drizzle DB. The legacy per-baby
     AsyncStorage keys are migrated once by runOneTimeMigration() /
     runTrackerLogMigration() and are never read here — reading them was the
     source of "data disappears after restart" bugs, because writes had
     already moved to the DB while reads still pointed at dead keys. */
  const loadAllBabyData = useCallback(async (babyId: string) => {
    /* FIX #5: Guard against unmounted component */
    if (!isMounted.current) return;

    setState(prev => ({ ...prev, isLoading: true }));
    setIsLoadingEntries(true);

    try {
      const rows = await withRetry(() => getEntriesByBabyFromDb(babyId));

      /* FIX #5: Check isMounted before setting state */
      if (!isMounted.current) return;

      const growthData: GrowthMeasurement[] = [];
      const milestones: Milestone[] = [];
      const sleepLogs: SleepLog[] = [];
      const feedingLogs: FeedingLog[] = [];
      const pottyLogs: PottyLog[] = [];
      const medicationLogs: MedicationLog[] = [];
      const activities: ActivityEntry[] = [];

      for (const row of rows) {
        if (row.isDeleted) continue;
        switch (row.trackerId) {
          case 'growth':
            growthData.push(mapRowToGrowth(row));
            break;
          case 'milestone':
            milestones.push(mapRowToMilestone(row));
            break;
          case 'sleep':
            sleepLogs.push(mapRowToSleep(row));
            break;
          case 'feeding':
            feedingLogs.push(mapRowToFeeding(row));
            break;
          case 'potty':
            pottyLogs.push(mapRowToPotty(row));
            break;
          case 'medication':
            medicationLogs.push(mapRowToMedication(row));
            break;
          default:
            activities.push(mapRowToActivity(row));
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

      // Also sync activities to the entries-compatible format for TrackerContext
      try {
        const { setCurrentBabyId } = await import('./TrackerContext');
        // TrackerContext will pick up via its own refresh
      } catch {
        // TrackerContext may not be available, that's OK
      }
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

      const babies: BabyProfile[] = dbBabies.map(b => mapDbBabyToProfile(b, calculateAge));

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

      /* Read-back verification: createBabyInDb swallows "table not ready"
         failures (returns [] instead of throwing), so confirm the row really
         exists before reporting success. Failing here — with a null return
         the caller already handles — prevents the downstream
         "CRITICAL: Baby profile was not persisted" class of error. */
      const persisted = await getBabyByIdFromDb(newId);
      if (!persisted) {
        console.error('[BabyContext] createBaby: insert did not persist, aborting');
        return null;
      }

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

      /* Load the EFFECTIVE current baby's data — previously this always
         loaded the NEW baby's (empty) data, which wiped the current baby's
         logs from state whenever a second baby was added. */
      await loadAllBabyData(newCurrentId);

      // Sync to TrackerContext via AsyncStorage so it picks up on next refresh
      await AsyncStorage.setItem('@littleloom_current_baby', newCurrentId);

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
        const updatedBaby = mapDbBabyToProfile(fresh, calculateAge);

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
      const newCurrentRow = remaining.find(b => b.id === newCurrentId) || null;

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: remaining.map(b => mapDbBabyToProfile(b, calculateAge)),
          currentBabyId: newCurrentId,
          currentBaby: newCurrentRow ? mapDbBabyToProfile(newCurrentRow, calculateAge) : null,
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
          currentBaby: mapDbBabyToProfile(baby, calculateAge),
        }));
      }

      // Sync baby ID to AsyncStorage for TrackerContext to pick up
      await AsyncStorage.setItem('@littleloom_current_baby', id);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return true;
    } catch (error) {
      console.error('Error switching baby:', error);
      return false;
    }
  }, [loadAllBabyData, calculateAge]);

  /* ---- Refresh current baby ---- */
  /* Reads from the Drizzle DB. Previously this read the legacy
     @littleloom_babies AsyncStorage key, which nothing writes anymore —
     so it silently no-oped every time. */
  const refreshCurrentBaby = useCallback(async () => {
    if (!state.currentBabyId) return;

    try {
      const [dbBabies, currentRow] = await Promise.all([
        getAllBabiesFromDb(),
        getBabyByIdFromDb(state.currentBabyId),
      ]);

      if (!isMounted.current) return;

      const babies = dbBabies.map(b => mapDbBabyToProfile(b, calculateAge));

      setState(prev => ({
        ...prev,
        babies,
        /* Keep the previous currentBaby if the row is momentarily
           unavailable rather than blanking the UI. */
        currentBaby: currentRow ? mapDbBabyToProfile(currentRow, calculateAge) : prev.currentBaby,
      }));

      await loadAllBabyData(state.currentBabyId);
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
          date: measurement.date,
          recordedBy: measurement.recordedBy,
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
          achievedAt: milestone.achievedAt,
          firstTime: milestone.isFirstTime,
          recordedBy: milestone.recordedBy,
          recordedByName: milestone.recordedByName,
        },
        notes: milestone.notes,
        photoUris: milestone.imageUrl ? [milestone.imageUrl] : undefined,
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

  /* ---- Sleep (Drizzle DB — trackerId 'sleep') ---- */
  const addSleepLog = useCallback(async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newId = generateId();
      const newLog: SleepLog = { ...log, id: newId, createdAt: new Date().toISOString() };

      await createEntryInDb({
        id: newId,
        trackerId: 'sleep',
        babyId: log.babyId,
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
      });

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
      if (!state.currentBabyId) return false;

      const target = state.sleepLogs.find(log => log.id === logId);
      if (!target) return false;

      const start = new Date(target.startTime);
      const end = new Date(endTime);
      if (end <= start) {
        console.warn('End time must be after start time');
        return false;
      }
      const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

      await updateEntryInDb(logId, {
        data: {
          startTime: target.startTime,
          endTime,
          duration,
          quality: target.quality,
          location: target.location,
        },
      });

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
  }, [state.currentBabyId, state.sleepLogs]);

  const getTodaySleepCount = useCallback(() => {
    const today = getStartOfDay();
    return state.sleepLogs.filter(log => new Date(log.startTime) >= today).length;
  }, [state.sleepLogs]);

  /* ---- Feeding (Drizzle DB — trackerId 'feeding') ---- */
  const addFeedingLog = useCallback(async (log: Omit<FeedingLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (log.amount !== undefined && (typeof log.amount !== 'number' || isNaN(log.amount) || log.amount < 0)) {
        Alert.alert('Invalid Amount', 'Please enter a valid positive amount');
        return false;
      }

      const newId = generateId();
      const newLog: FeedingLog = { ...log, id: newId, createdAt: new Date().toISOString() };

      await createEntryInDb({
        id: newId,
        trackerId: 'feeding',
        babyId: log.babyId,
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
      });

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

  /* ---- Potty (Drizzle DB — trackerId 'potty') ---- */
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
      const newLog: PottyLog = { ...log, id: newId, createdAt: new Date().toISOString() };

      await createEntryInDb({
        id: newId,
        trackerId: 'potty',
        babyId: log.babyId,
        timestamp: new Date(log.timestamp).getTime() || Date.now(),
        title: '🚽 Potty',
        data: {
          pottyType: log.type,
          location: log.location,
          successful: log.successful,
          timestamp: log.timestamp,
        },
        notes: log.notes,
      });

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

  /* ---- Medication (Drizzle DB — trackerId 'medication') ---- */
  const addMedicationLog = useCallback(async (log: Omit<MedicationLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (!log.medicationName.trim()) {
        Alert.alert('Missing Information', 'Please enter a medication name');
        return false;
      }

      const newId = generateId();
      const newLog: MedicationLog = {
        ...log,
        medicationName: log.medicationName.trim(),
        id: newId,
        createdAt: new Date().toISOString(),
      };

      await createEntryInDb({
        id: newId,
        trackerId: 'medication',
        babyId: log.babyId,
        timestamp: new Date(log.timestamp).getTime() || Date.now(),
        title: `💊 ${newLog.medicationName}`,
        data: {
          medicationName: newLog.medicationName,
          dosage: log.dosage,
          reason: log.reason,
          givenBy: log.givenBy,
          timestamp: log.timestamp,
        },
        notes: log.notes,
      });

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

      /* Everything that isn't a dedicated column is preserved in the JSON
         payload — including icon, notificationId and reminderScheduled,
         which previously were dropped on write and lost after reload. */
      const entryData = extractEntryData(entry);

      // Ensure trackerId is valid and normalized
      const trackerId = entry.type;

      await createEntryInDb({
        id: newId,
        trackerId,
        babyId: entry.babyId,
        timestamp: entry.timestamp,
        title: entry.title,
        data: entryData,
        notes: entry.notes || entry.details,
        photoUris: entry.photo ? [entry.photo] : undefined,
        tags: entry.tags,
        loggedBy: entry.loggedBy,
        loggedByName: entry.loggedByName,
        loggedByRole: entry.loggedByRole,
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

  /* Persists edits to the Drizzle DB. Previously this wrote to the legacy
     per-baby ACTIVITIES AsyncStorage key — which nothing reads anymore —
     so every edit was silently lost on the next load. */
  const updateEntry = useCallback(async (id: string, entry: Partial<ActivityEntry>): Promise<boolean> => {
    try {
      if (!state.currentBabyId) return false;

      const existingEntry = state.activities.find(a => a.id === id);
      if (!existingEntry) return false;

      const merged: ActivityEntry = { ...existingEntry, ...entry };

      await updateEntryInDb(id, {
        timestamp: merged.timestamp,
        title: merged.title,
        notes: merged.notes || merged.details,
        data: extractEntryData(merged),
        tags: merged.tags,
        photoUris: merged.photo ? [merged.photo] : undefined,
      });

      const updated = state.activities.map(a => a.id === id ? merged : a);
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