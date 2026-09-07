// src/context/BabyContext.tsx - COMPLETE FIXED VERSION
// FIX: Loads babies for ALL users including guardians and viewers
// FIX: Properly handles role-based access and permissions
// FIX: User isolation to prevent cross-device conflicts
// FIX: Proper auth session handling
// FIX: Multiple fallback queries for baby loading

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

// ─── STORAGE KEYS ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  CURRENT_BABY_ID: '@littleloom_current_baby_id',
  BABIES_CACHE_KEY: '@littleloom_babies_cache',
  LAST_SYNC_KEY: '@littleloom_last_baby_sync',
  BABY_SYNC_VERSION: '@littleloom_baby_sync_version',
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
  role?: 'parent1' | 'parent2' | 'guardian' | 'viewer';
  
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
  userRoles: Record<string, 'parent1' | 'parent2' | 'guardian' | 'viewer'>;
  userPermissions: Record<string, Record<string, boolean>>;
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

  getUserRoleForBaby: (babyId?: string) => 'parent1' | 'parent2' | 'guardian' | 'viewer' | null;
  hasPermissionForBaby: (babyId: string, action: string) => boolean;
  getBabiesForRole: (role: 'parent1' | 'parent2' | 'guardian' | 'viewer') => BabyProfile[];
  canManageBaby: (babyId?: string) => boolean;
  canViewBaby: (babyId?: string) => boolean;
  canEditBaby: (babyId?: string) => boolean;

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
    userRoles: {},
    userPermissions: {},
  });

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const ageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);
  const isMounted = useRef(true);
  const isCreatingRef = useRef(false);
  const loadInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateListenerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadAttemptsRef = useRef(0);
  const maxLoadAttempts = 5;
  const currentUserIdRef = useRef<string | null>(null);
  const authStateListenerRef = useRef<any>(null);

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

  // ─── Helper: get current user ID as UUID ─────────────────────────────
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user?.id) {
        currentUserIdRef.current = session.user.id;
        return session.user.id;
      }
    } catch (e) {
      console.warn('[BabyContext] Session check failed:', e);
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user?.id) {
        currentUserIdRef.current = user.id;
        return user.id;
      }
    } catch (e) {
      console.warn('[BabyContext] getUser failed:', e);
    }

    console.warn('[BabyContext] Could not get user ID from any method');
    return null;
  }, []);

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

  // ─── Map database row to BabyProfile ─────────────────────────────────
  const mapBabyRowToProfile = useCallback((row: any, userRole?: 'parent1' | 'parent2' | 'guardian' | 'viewer'): BabyProfile => {
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
      guardianIds: row.guardian_ids || [],
      role: userRole || 'viewer',
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

// REPLACE the entire loadBabies function in BabyContext.tsx with this:

const loadBabies = useCallback(async (force = false) => {
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
      console.warn('[BabyContext] No authenticated user found');
      setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
      loadInProgressRef.current = false;
      return;
    }

    console.log('[BabyContext] Loading babies for user ID (UUID):', userId);
    currentUserIdRef.current = userId;

    let allBabies: any[] = [];
    const userRoles: Record<string, 'parent1' | 'parent2' | 'guardian' | 'viewer'> = {};
    const userPermissions: Record<string, Record<string, boolean>> = {};
    const seenBabyIds = new Set<string>();

    // ─── QUERY 1: Babies where user is parent1 ──────────────────────
    try {
      const { data, error } = await supabase
        .from('babies')
        .select('*')
        .eq('parent1_id', userId)
        .eq('is_active', true);

      if (error) {
        console.warn('[BabyContext] Parent1 query warning:', error.message);
      } else if (data) {
        data.forEach((baby: any) => {
          if (!seenBabyIds.has(baby.id)) {
            seenBabyIds.add(baby.id);
            allBabies.push(baby);
            userRoles[baby.id] = 'parent1';
            userPermissions[baby.id] = {
              view: true, edit: true, delete: true, manage: true, invite: true, export: true,
            };
          }
        });
        console.log(`[BabyContext] Found ${data.length} babies (parent1 query)`);
      }
    } catch (e) {
      console.warn('[BabyContext] Parent1 query failed:', e);
    }

    // ─── QUERY 2: Babies where user is parent2 ──────────────────────
    try {
      const { data, error } = await supabase
        .from('babies')
        .select('*')
        .eq('parent2_id', userId)
        .eq('is_active', true);

      if (error) {
        console.warn('[BabyContext] Parent2 query warning:', error.message);
      } else if (data) {
        data.forEach((baby: any) => {
          if (!seenBabyIds.has(baby.id)) {
            seenBabyIds.add(baby.id);
            allBabies.push(baby);
            userRoles[baby.id] = 'parent2';
            userPermissions[baby.id] = {
              view: true, edit: true, delete: true, manage: true, invite: true, export: true,
            };
          }
        });
        console.log(`[BabyContext] Found ${data.length} babies (parent2 query)`);
      }
    } catch (e) {
      console.warn('[BabyContext] Parent2 query failed:', e);
    }

    // ─── QUERY 3: Get baby IDs from family_members ──────────────────
    // This is the CRITICAL fix - we get the baby IDs from family_members
    // and then query babies by those IDs
    try {
      console.log('[BabyContext] Querying family_members for user:', userId);
      
      const { data: familyMembers, error: fmError } = await supabase
        .from('family_members')
        .select('baby_id, role, relationship')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (fmError) {
        console.warn('[BabyContext] Family members query warning:', fmError.message);
      } else if (familyMembers && familyMembers.length > 0) {
        console.log(`[BabyContext] Found ${familyMembers.length} family memberships for user`);

        // Get unique baby IDs
        const uniqueBabyIds = [...new Set(
          familyMembers
            .filter((fm: any) => fm.baby_id && fm.baby_id.trim().length > 0)
            .map((fm: any) => fm.baby_id)
        )];
        
        console.log(`[BabyContext] Unique baby IDs from family_members:`, uniqueBabyIds);
        
        if (uniqueBabyIds.length > 0) {
          // ─── Query babies by ID directly ──────────────────────────
          // This works because the babies SELECT policy only checks parent1_id/parent2_id
          // So we need to query by ID to get the baby data
          const { data: babyData, error: babyError } = await supabase
            .from('babies')
            .select('*')
            .in('id', uniqueBabyIds);
          
          if (babyError) {
            console.warn('[BabyContext] Baby query warning:', babyError.message);
          } else if (babyData && babyData.length > 0) {
            console.log(`[BabyContext] Found ${babyData.length} babies from family_members`);
            
            babyData.forEach((baby: any) => {
              if (!seenBabyIds.has(baby.id)) {
                seenBabyIds.add(baby.id);
                allBabies.push(baby);
                
                const member = familyMembers.find((fm: any) => fm.baby_id === baby.id);
                const role = member?.role || 'viewer';
                userRoles[baby.id] = role;
                
                userPermissions[baby.id] = {
                  view: true,
                  edit: role === 'parent1' || role === 'parent2' || role === 'guardian',
                  delete: role === 'parent1' || role === 'parent2',
                  manage: role === 'parent1' || role === 'parent2',
                  invite: role === 'parent1' || role === 'parent2',
                  export: role === 'parent1' || role === 'parent2',
                };
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('[BabyContext] Family members query failed:', e);
    }

    // ─── QUERY 4: Fallback via invite_codes ──────────────────────────
    if (allBabies.length === 0) {
      console.log('[BabyContext] No babies found, checking invite_codes fallback...');
      try {
        const { data: inviteData, error: inviteError } = await supabase
          .from('invite_codes')
          .select('family_id, role')
          .eq('used_by', userId)
          .eq('used', true)
          .maybeSingle();
        
        if (!inviteError && inviteData?.family_id) {
          console.log(`[BabyContext] Found family_id from invite_codes: ${inviteData.family_id}`);
          
          const { data: babyData, error: babyError } = await supabase
            .from('babies')
            .select('*')
            .eq('id', inviteData.family_id);
          
          if (!babyError && babyData && babyData.length > 0) {
            console.log(`[BabyContext] Found baby via invite_codes fallback: ${babyData[0].name}`);
            babyData.forEach((baby: any) => {
              if (!seenBabyIds.has(baby.id)) {
                seenBabyIds.add(baby.id);
                allBabies.push(baby);
                const role = inviteData.role || 'viewer';
                userRoles[baby.id] = role;
                userPermissions[baby.id] = {
                  view: true,
                  edit: role === 'parent1' || role === 'parent2' || role === 'guardian',
                  delete: role === 'parent1' || role === 'parent2',
                  manage: role === 'parent1' || role === 'parent2',
                  invite: role === 'parent1' || role === 'parent2',
                  export: role === 'parent1' || role === 'parent2',
                };
              }
            });
          }
        }
      } catch (e) {
        console.warn('[BabyContext] Invite codes fallback failed:', e);
      }
    }

    console.log(`[BabyContext] Total babies found: ${allBabies.length}`);

    // ─── MAP TO PROFILES ─────────────────────────────────────────────
    const babies: BabyProfile[] = allBabies.map((baby: any) => 
      mapBabyRowToProfile(baby, userRoles[baby.id] || 'viewer')
    );

    // ─── CACHE BABIES ─────────────────────────────────────────────────
    if (babies.length > 0) {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.BABIES_CACHE_KEY, JSON.stringify(babies));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_KEY, Date.now().toString());
      } catch (cacheError) {
        console.warn('[BabyContext] Failed to cache babies:', cacheError);
      }
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
    }

    // ─── DETERMINE CURRENT BABY ID ───────────────────────────────────
    let currentId: string | null = null;
    
    if (babies.length > 0) {
      try {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'current_baby_id')
          .eq('user_id', userId)
          .maybeSingle();
        currentId = settingsData?.value || null;
        console.log('[BabyContext] Current baby ID from app_settings:', currentId);
      } catch (e) {
        console.warn('[BabyContext] Failed to get current_baby_id:', e);
      }
      
      const isValidCurrent = currentId && babies.some(b => b.id === currentId);
      
      if (!isValidCurrent) {
        const prioritizedBabies = [...babies].sort((a, b) => {
          const priority = { parent1: 0, parent2: 1, guardian: 2, viewer: 3 };
          return (priority[a.role as keyof typeof priority] || 3) - (priority[b.role as keyof typeof priority] || 3);
        });
        currentId = prioritizedBabies[0]?.id || babies[0].id;
        console.log(`[BabyContext] Setting current baby to first: ${currentId}`);
        
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
          console.warn('[BabyContext] Failed to save current_baby_id:', e);
        }
      }
    } else {
      currentId = null;
      console.log('[BabyContext] No babies found for user');
      
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'current_baby_id')
        .eq('user_id', userId);
      
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BABY_ID);
    }

    if (currentId) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, currentId);
    }

    const babyToSet = currentId ? babies.find(b => b.id === currentId) || null : null;

    // ─── CHECK IF BABY WAS SKIPPED ──────────────────────────────────
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
    console.log(`[BabyContext] Setting state: ${babies.length} babies, current: ${currentId}`);
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      babies,
      currentBabyId: currentId,
      currentBaby: babyToSet,
      hasSkippedBaby,
      lastSyncTime: Date.now(),
      isInitialized: true,
      userRoles,
      userPermissions,
    }));

    setTimeout(() => {
      broadcastBabyChange(currentId);
    }, 100);

    console.log('[BabyContext] loadBabies completed successfully');

  } catch (error) {
    console.error('[BabyContext] Error loading babies:', error);
    
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      if (cached) {
        const cachedBabies = JSON.parse(cached);
        console.log(`[BabyContext] Loaded ${cachedBabies.length} babies from cache`);
        if (isMounted.current && cachedBabies.length > 0) {
          const cachedBaby = cachedBabies.find((b: any) => b.id === state.currentBabyId) || cachedBabies[0] || null;
          setState(prev => ({
            ...prev,
            isLoading: false,
            babies: cachedBabies,
            currentBaby: cachedBaby,
            currentBabyId: cachedBaby?.id || null,
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
}, [mapBabyRowToProfile, getCurrentUserId, broadcastBabyChange]);

  const forceRefresh = useCallback(async () => {
    console.log('[BabyContext] Force refresh requested');
    await loadBabies(true);
  }, [loadBabies]);

  // ─── Auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[BabyContext] Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[BabyContext] User signed in, loading babies');
        currentUserIdRef.current = session.user.id;
        setTimeout(() => {
          if (isMounted.current) {
            loadBabies(true);
          }
        }, 500);
      } else if (event === 'SIGNED_OUT') {
        console.log('[BabyContext] User signed out, resetting state');
        currentUserIdRef.current = null;
        setState(prev => ({ 
          ...prev, 
          babies: [],
          currentBabyId: null,
          currentBaby: null,
          isInitialized: false,
          userRoles: {},
          userPermissions: {},
        }));
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[BabyContext] Token refreshed');
        currentUserIdRef.current = session.user.id;
      }
    });

    authStateListenerRef.current = authListener;

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [loadBabies]);

  // ─── Initial load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    
    const initialize = async () => {
      console.log('[BabyContext] Initializing...');
      
      let hasSession = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          hasSession = true;
          currentUserIdRef.current = session.user.id;
          console.log('[BabyContext] Found existing session on init');
        }
      } catch (e) {
        console.warn('[BabyContext] Session check on init failed:', e);
      }
      
      if (hasSession) {
        console.log('[BabyContext] Loading babies on init (existing session)');
        initRef.current = true;
        await loadBabies();
        return;
      }
      
      let attempts = 0;
      while (attempts < maxLoadAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            currentUserIdRef.current = session.user.id;
            console.log('[BabyContext] Session found on retry', attempts);
            initRef.current = true;
            await loadBabies();
            return;
          }
        } catch (e) {
          // Continue retrying
        }
      }
      
      if (isMounted.current) {
        initRef.current = true;
        setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
      }
    };
    
    initialize();

    return () => {
      isMounted.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (authLoadTimerRef.current) {
        clearTimeout(authLoadTimerRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (authStateListenerRef.current) {
        authStateListenerRef.current?.subscription.unsubscribe();
      }
    };
  }, [loadBabies]);

  // ─── Auto-refresh on app focus ────────────────────────────────────────
  useEffect(() => {
    if (appStateListenerRef.current) {
      appStateListenerRef.current.remove();
      appStateListenerRef.current = null;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          console.log('[BabyContext] Auto-refresh on app focus');
          if (isMounted.current) {
            loadBabies(true);
          }
        }, 500);
      }
    });

    appStateListenerRef.current = subscription;

    return () => {
      if (appStateListenerRef.current) {
        appStateListenerRef.current.remove();
        appStateListenerRef.current = null;
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [loadBabies]);

  // ─── Auto-refresh every 5 minutes ─────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    intervalRef.current = setInterval(() => {
      console.log('[BabyContext] Auto-refresh interval');
      if (isMounted.current) {
        loadBabies(true);
      }
    }, 300000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadBabies]);

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
    if (ageIntervalRef.current) {
      clearInterval(ageIntervalRef.current);
    }
    ageIntervalRef.current = setInterval(updateAges, 60 * 60 * 1000);

    return () => {
      if (ageIntervalRef.current) {
        clearInterval(ageIntervalRef.current);
        ageIntervalRef.current = null;
      }
    };
  }, [state.babies.length, calculateAge]);

  // ─── ROLE-BASED ACCESS HELPERS ───────────────────────────────────────

  const getUserRoleForBaby = useCallback((babyId?: string): 'parent1' | 'parent2' | 'guardian' | 'viewer' | null => {
    const id = babyId || state.currentBabyId;
    if (!id) return null;
    return state.userRoles[id] || 'viewer';
  }, [state.currentBabyId, state.userRoles]);

  const hasPermissionForBaby = useCallback((babyId: string, action: string): boolean => {
    const perms = state.userPermissions[babyId];
    if (!perms) return false;
    
    const actionMap: Record<string, string> = {
      'view': 'view',
      'edit': 'edit',
      'delete': 'delete',
      'manage': 'manage',
      'invite': 'invite',
      'export': 'export',
      'add_entry': 'edit',
      'edit_entry': 'edit',
      'delete_entry': 'delete',
    };
    
    const key = actionMap[action] || action;
    return perms[key] || false;
  }, [state.userPermissions]);

  const getBabiesForRole = useCallback((role: 'parent1' | 'parent2' | 'guardian' | 'viewer'): BabyProfile[] => {
    return state.babies.filter(baby => baby.role === role);
  }, [state.babies]);

  const canManageBaby = useCallback((babyId?: string): boolean => {
    const id = babyId || state.currentBabyId;
    if (!id) return false;
    const perms = state.userPermissions[id];
    return perms?.manage || perms?.delete || false;
  }, [state.currentBabyId, state.userPermissions]);

  const canViewBaby = useCallback((babyId?: string): boolean => {
    const id = babyId || state.currentBabyId;
    if (!id) return false;
    const perms = state.userPermissions[id];
    return perms?.view || false;
  }, [state.currentBabyId, state.userPermissions]);

  const canEditBaby = useCallback((babyId?: string): boolean => {
    const id = babyId || state.currentBabyId;
    if (!id) return false;
    const perms = state.userPermissions[id];
    return perms?.edit || false;
  }, [state.currentBabyId, state.userPermissions]);

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
      
      const userId = await getCurrentUserId();
      
      if (!userId) {
        console.error('[BabyContext] No authenticated user for createBaby');
        isCreatingRef.current = false;
        return null;
      }

      console.log('[BabyContext] Creating baby with parent1_id:', userId);

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
        role: 'parent1',
      };

      const newCurrentId = result.id;

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: [...prev.babies, newBaby],
          currentBabyId: newCurrentId,
          currentBaby: newBaby,
          hasSkippedBaby: false,
          userRoles: { ...prev.userRoles, [newCurrentId]: 'parent1' },
          userPermissions: { 
            ...prev.userPermissions, 
            [newCurrentId]: { view: true, edit: true, delete: true, manage: true, invite: true, export: true }
          },
        }));
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, newCurrentId);
      
      try {
        await supabase
          .from('app_settings')
          .upsert({
            key: 'current_baby_id',
            value: newCurrentId,
            user_id: userId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key, user_id' });
        console.log('[BabyContext] Set current baby to newly created:', newCurrentId);
      } catch (e) {
        console.warn('[BabyContext] Failed to set current_baby_id:', e);
      }

      try {
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'has_skipped_baby')
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[BabyContext] Failed to clear skip baby:', e);
      }

      setTimeout(() => {
        broadcastBabyChange(newCurrentId);
      }, 50);

      await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      isCreatingRef.current = false;
      return result.id;
      
    } catch (error) {
      isCreatingRef.current = false;
      console.error('[BabyContext] Create baby error:', error);
      return null;
    }
  }, [calculateAge, getCurrentUserId, broadcastBabyChange]);

  // ─── Update baby ──────────────────────────────────────────────────────
  const updateBaby = useCallback(async (id: string, updates: Partial<BabyProfile>) => {
    try {
      if (!canEditBaby(id)) {
        Alert.alert('Permission Denied', 'You do not have permission to edit this baby\'s profile');
        return;
      }

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
        const updatedBaby = mapBabyRowToProfile(result, state.userRoles[id] || 'viewer');
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
  }, [mapBabyRowToProfile, canEditBaby, state.userRoles]);

  // ─── Delete baby ──────────────────────────────────────────────────────
  const deleteBaby = useCallback(async (id: string): Promise<boolean> => {
    if (!canManageBaby(id)) {
      Alert.alert('Permission Denied', 'You do not have permission to delete this baby');
      return false;
    }

    try {
      const { error } = await supabase
        .from('babies')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[BabyContext] Delete baby error:', error);
        Alert.alert('Error', 'Failed to delete baby profile: ' + error.message);
        return false;
      }

      console.log('[BabyContext] Baby deleted from Supabase:', id);

      const userId = await getCurrentUserId();
      
      const updatedBabies = state.babies.filter(b => b.id !== id);
      const newCurrentId = updatedBabies.length > 0 ? updatedBabies[0].id : null;

      if (userId) {
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
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BABY_ID);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC_KEY);

      if (isMounted.current) {
        const newUserRoles = { ...state.userRoles };
        const newUserPermissions = { ...state.userPermissions };
        delete newUserRoles[id];
        delete newUserPermissions[id];

        setState(prev => ({
          ...prev,
          babies: updatedBabies,
          currentBabyId: newCurrentId,
          currentBaby: newCurrentId ? updatedBabies.find(b => b.id === newCurrentId) || null : null,
          userRoles: newUserRoles,
          userPermissions: newUserPermissions,
        }));
      }

      broadcastBabyChange(newCurrentId);

      setTimeout(() => {
        loadBabies(true);
      }, 500);

      return true;
    } catch (error) {
      console.error('[BabyContext] Delete baby error:', error);
      Alert.alert('Error', 'Failed to delete baby profile');
      return false;
    }
  }, [state.babies, state.currentBabyId, state.userRoles, state.userPermissions, getCurrentUserId, broadcastBabyChange, loadBabies, canManageBaby]);

  // ─── Switch baby ──────────────────────────────────────────────────────
  const switchBaby = useCallback(async (id: string): Promise<boolean> => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn('[BabyContext] No user for switchBaby');
        return false;
      }

      if (!canViewBaby(id)) {
        Alert.alert('Permission Denied', 'You do not have permission to view this baby');
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

      if (isMounted.current) {
        const babyProfile = mapBabyRowToProfile(baby, state.userRoles[id] || 'viewer');
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
  }, [mapBabyRowToProfile, getCurrentUserId, broadcastBabyChange, state.userRoles, canViewBaby]);

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

      const updatedBaby = mapBabyRowToProfile(baby, state.userRoles[state.currentBabyId] || 'viewer');

      setState(prev => ({
        ...prev,
        currentBaby: updatedBaby,
        babies: prev.babies.map(b => b.id === state.currentBabyId ? updatedBaby : b),
      }));
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [state.currentBabyId, state.userRoles, mapBabyRowToProfile, loadBabies, getCurrentUserId]);

  // ─── STUB METHODS ─────────────────────────────────────────────────────
  const addGrowthMeasurement = useCallback(async () => false, []);
  const getGrowthData = useCallback(() => [], []);
  const getLatestMeasurements = useCallback(() => ({ height: null, weight: null, head: null, temperature: null }), []);
  const deleteGrowthMeasurement = useCallback(async () => false, []);
  const addMilestone = useCallback(async () => false, []);
  const getMilestones = useCallback(() => [], []);
  const deleteMilestone = useCallback(async () => false, []);
  const addSleepLog = useCallback(async () => false, []);
  const getSleepLogs = useCallback(() => [], []);
  const endSleepSession = useCallback(async () => false, []);
  const getTodaySleepCount = useCallback(() => 0, []);
  const addFeedingLog = useCallback(async () => false, []);
  const getFeedingLogs = useCallback(() => [], []);
  const getTodayFeedCount = useCallback(() => 0, []);
  const addPottyLog = useCallback(async () => false, []);
  const getPottyLogs = useCallback(() => [], []);
  const getPottyStreak = useCallback(() => 0, []);
  const getTodayPottyCount = useCallback(() => 0, []);
  const getPottySuccessRate = useCallback(() => 0, []);
  const addMedicationLog = useCallback(async () => false, []);
  const getMedicationLogs = useCallback(() => [], []);
  const addActivity = useCallback(async () => false, []);
  const getRecentActivities = useCallback(() => [], []);
  const getActivitiesByType = useCallback(() => [], []);
  const deleteActivity = useCallback(async () => false, []);
  const getBabyStats = useCallback(() => ({ streak: 0, milestones: 0, photos: 0, entries: 0 }), []);
  const updateBabyStats = useCallback(async () => {}, []);
  const entries: ActivityEntry[] = [];
  const loadEntries = useCallback(async () => {}, []);
  const deleteEntry = useCallback(async () => false, []);
  const addEntry = useCallback(async () => false, []);
  const updateEntry = useCallback(async () => false, []);
  const getEntryById = useCallback(() => undefined, []);
  const getDateTitle = useCallback(() => '', []);
  const syncWithActivityContext = useCallback(async () => {}, []);
  const scheduleActivityReminder = useCallback(async () => null, []);
  const cancelActivityReminder = useCallback(async () => {}, []);
  const getCurrentBabyId = useCallback((): string | null => state.currentBabyId, [state.currentBabyId]);

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
    getUserRoleForBaby,
    hasPermissionForBaby,
    getBabiesForRole,
    canManageBaby,
    canViewBaby,
    canEditBaby,
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
    getUserRoleForBaby,
    hasPermissionForBaby,
    getBabiesForRole,
    canManageBaby,
    canViewBaby,
    canEditBaby,
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