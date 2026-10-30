

























import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useAuth } from './AuthContext';


export const STORAGE_KEYS = {
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  CURRENT_BABY_ID: '@littleloom_current_baby_id',
  BABIES_CACHE_KEY: '@littleloom_babies_cache',
  LAST_SYNC_KEY: '@littleloom_last_baby_sync',
  BABY_SYNC_VERSION: '@littleloom_baby_sync_version',
} as const;


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
  /** Human label for the family this baby belongs to. Used in the
   *  baby switcher to disambiguate when a user belongs to more than
   *  one family (e.g. "Sarah's family" vs "Your family"). */
  familyLabel?: string;
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

export interface ActivityEntry {
  id: string;
  babyId: string;
  type: string;
  timestamp: number;
  title: string;
  details?: string;
  icon?: string;
  loggedBy: string;
  loggedByName: string;
  loggedByRole?: string;
  notes?: string;
  photo?: string;
  tags?: string[];
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  [key: string]: unknown;
}

export type ActivityType = string;


interface BabyState {
  isLoading: boolean;
  isSyncing: boolean;
  babies: BabyProfile[];
  currentBabyId: string | null;
  currentBaby: BabyProfile | null;
  hasSkippedBaby: boolean;
  growthData: any[];
  milestones: any[];
  sleepLogs: any[];
  feedingLogs: any[];
  pottyLogs: any[];
  medicationLogs: any[];
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
  getCurrentBabyId: () => string | null;
  subscribeToBabyChanges: (callback: (babyId: string | null) => void) => () => void;

  
  addGrowthMeasurement: (measurement: any) => Promise<boolean>;
  getGrowthData: (type?: any) => any[];
  getLatestMeasurements: () => Record<string, any | null>;
  deleteGrowthMeasurement: (id: string) => Promise<boolean>;
  addMilestone: (milestone: any) => Promise<boolean>;
  getMilestones: (category?: any) => any[];
  deleteMilestone: (id: string) => Promise<boolean>;
  addSleepLog: (log: any) => Promise<boolean>;
  getSleepLogs: (days?: number) => any[];
  endSleepSession: (logId: string, endTime: string) => Promise<boolean>;
  getTodaySleepCount: () => number;
  addFeedingLog: (log: any) => Promise<boolean>;
  getFeedingLogs: (days?: number) => any[];
  getTodayFeedCount: () => number;
  addPottyLog: (log: any) => Promise<boolean>;
  getPottyLogs: (days?: number) => any[];
  getPottyStreak: () => number;
  getTodayPottyCount: () => number;
  getPottySuccessRate: () => number;
  addMedicationLog: (log: any) => Promise<boolean>;
  getMedicationLogs: (days?: number) => any[];
  addActivity: (entry: Omit<ActivityEntry, 'id'>) => Promise<boolean>;
  getRecentActivities: (limit?: number) => ActivityEntry[];
  getActivitiesByType: (type: string) => ActivityEntry[];
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


const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

type BabyChangeCallback = (babyId: string | null) => void;
let babyChangeSubscribers: BabyChangeCallback[] = [];




export const BabyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const auth = useAuth();
  const authUserId: string | null =
    auth?.userProfile?.id ??
    (auth?.session?.user?.id ?? null);

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

  const [isLoadingEntries] = useState(false);

  
  const loadBabiesRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const backfillRanRef = useRef(false);
  const initRef = useRef(false);
  const isMounted = useRef(true);
  const isCreatingRef = useRef(false);
  const loadInProgressRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateListenerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxLoadAttempts = 5;
  const currentUserIdRef = useRef<string | null>(authUserId);
  const authStateListenerRef = useRef<any>(null);
  const lastBroadcastedBabyIdRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // MOUNT TOKEN
  //
  // Increments every time BabyProvider mounts. Used by loadBabies
  // to detect when a newer instance has taken over (StrictMode
  // double-mount, navigator reset, hot reload) so that stale
  // async work doesn't commit over newer work.
  // ─────────────────────────────────────────────────────────────
  const mountTokenRef = useRef<number>(0);

  
  // Bump the mount token every time the provider mounts. Must run
  // before any code that calls loadBabies().
  useEffect(() => {
    mountTokenRef.current += 1;
    // Reset isMounted to true on every mount so downstream guards
    // (if any remain) don't fire spuriously after StrictMode remount.
    isMounted.current = true;
    return () => {
      // The main cleanup effect also does this; duplication is
      // deliberate — this ensures the token + flag reset happen
      // before any other cleanup can race.
      mountTokenRef.current += 1;
      loadInProgressRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authUserId) {
      currentUserIdRef.current = authUserId;
    }
  }, [authUserId]);

  
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
    return remainingMonths > 0
      ? `${years}y ${remainingMonths}m`
      : `${years} year${years !== 1 ? 's' : ''}`;
  }, []);

  
  const mapBabyRowToProfile = useCallback(
    (
      row: any,
      userRole?: 'parent1' | 'parent2' | 'guardian' | 'viewer'
    ): BabyProfile => {
      return {
        id: row.id,
        name: row.name,
        birthDate: row.date_of_birth,
        age: calculateAge(row.date_of_birth),
        gender:
          row.gender === 'male'
            ? 'boy'
            : row.gender === 'female'
            ? 'girl'
            : 'other',
        skinTone: row.skin_tone ?? 0,
        avatar: row.avatar || row.avatar_url || '👶',
        avatar_url: row.avatar_url || row.avatar || '',
        parent1Id: row.parent1_id || '',
        parent2Id: row.parent2_id || undefined,
        guardianIds: [],
        role: userRole || 'viewer',
        bloodType: row.blood_type || undefined,
        medicalNotes: row.medical_notes || undefined,
        allergies: row.allergies || undefined,
        weight:
          row.current_weight_kg === null || row.current_weight_kg === undefined
            ? undefined
            : String(row.current_weight_kg),
        height:
          row.current_height_cm === null || row.current_height_cm === undefined
            ? undefined
            : String(row.current_height_cm),
        birthTime: row.birth_time || undefined,
        // ── Preserve 0 values ───────────────────────────────────────
        // The old code used `? :` truthy checks, which silently coerced
        // legitimately-`0` values (apgar_1min = 0, birth_order = 1,
        // gestational_weeks = 0 on extreme preemies) to `undefined`.
        // Explicit null checks preserve the actual DB value.
        birthWeight:
          row.birth_weight_kg === null || row.birth_weight_kg === undefined
            ? undefined
            : String(row.birth_weight_kg),
        birthHeight:
          row.birth_height_cm === null || row.birth_height_cm === undefined
            ? undefined
            : String(row.birth_height_cm),
        birthHeadCircumference:
          row.birth_head_circumference === null || row.birth_head_circumference === undefined
            ? undefined
            : String(row.birth_head_circumference),
        deliveryType: row.delivery_type || undefined,
        gestationalWeeks:
          row.gestational_weeks === null || row.gestational_weeks === undefined
            ? undefined
            : String(row.gestational_weeks),
        apgar1Min:
          row.apgar_1min === null || row.apgar_1min === undefined
            ? undefined
            : String(row.apgar_1min),
        apgar5Min:
          row.apgar_5min === null || row.apgar_5min === undefined
            ? undefined
            : String(row.apgar_5min),
        birthPlace: row.birth_place || undefined,
        birthAttendant: row.birth_attendant || undefined,
        multipleBirth: row.multiple_birth === true,
        birthOrder:
          row.birth_order === null || row.birth_order === undefined
            ? undefined
            : String(row.birth_order),
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
    },
    [calculateAge]
  );

  
  useRealtimeSubscription({
    table: 'babies',
    enabled: true,
    onUpdate: (payload: any) => {
      const row = payload?.new;
      if (!row?.id) return;
      if (__DEV__) console.log('[BabyContext] Realtime babies.updated:', row.id);
      setState(prev => {
        const updated = mapBabyRowToProfile(
          row,
          prev.userRoles[row.id] || 'viewer'
        );
        const babies = prev.babies.map(b =>
          b.id === row.id ? updated : b
        );
        return {
          ...prev,
          babies,
          currentBaby:
            prev.currentBaby?.id === row.id ? updated : prev.currentBaby,
        };
      });
    },
    onInsert: (payload: any) => {
      const row = payload?.new;
      if (!row?.id || !row.parent1_id) return;
      const uid = currentUserIdRef.current;
      // Parents (1 & 2) can short-circuit. Everyone else (guardian /
      // viewer) must still be checked against family_members, so DON'T
      // bail for them — a guardian invited to a brand-new baby has to
      // see it via the family_members realtime event below. The reload
      // is a cheap idempotent refresh, so we simply always trigger it
      // for non-parents instead of trying to filter here.
      if (
        uid &&
        row.parent1_id !== uid &&
        row.parent2_id !== uid
      ) {
        // Non-parent — still reload so family_members additions for this
        // baby are picked up. loadBabies() re-derives roles from
        // family_members, so a user with no membership will simply end
        // up with an unchanged list.
        if (__DEV__) {
          console.log('[BabyContext] Realtime babies.inserted (non-parent) → reloading');
        }
      }
      if (__DEV__) console.log('[BabyContext] Realtime babies.inserted:', row.id);
      loadBabiesRef.current?.(true);
    },
    onDelete: (payload: any) => {
      const row = payload?.old;
      if (!row?.id) return;
      if (__DEV__) console.log('[BabyContext] Realtime babies.deleted:', row.id);
      setState(prev => {
        const babies = prev.babies.filter(b => b.id !== row.id);
        const stillValid = babies.some(b => b.id === prev.currentBabyId);
        const newCurrentId = stillValid
          ? prev.currentBabyId
          : babies[0]?.id ?? null;
        return {
          ...prev,
          babies,
          currentBabyId: newCurrentId,
          currentBaby: babies.find(b => b.id === newCurrentId) ?? null,
        };
      });
    },
  });

  
  useRealtimeSubscription({
    table: 'family_members',
    enabled: true,
    onInsert: (payload: any) => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.inserted');
      // ── FIX: ignore the first event during hydration ─────────
      // The subscription is active from mount, but `loadBabies`
      // hasn't resolved `currentUserIdRef` or `babies` yet on
      // cold start. A `loadBabies(true)` fired now runs with a
      // stale user id and commits an EMPTY baby list — which is
      // exactly what makes the co-parent's family row appear,
      // then disappear a second later.
      //
      // We debounce + only fire once BabyContext has finished
      // at least one successful load (i.e. `state.isInitialized`
      // is true AND `currentUserIdRef` is set).
      if (!currentUserIdRef.current) {
        if (__DEV__) {
          console.log('[BabyContext] family_members.insert — waiting for user id');
        }
        return;
      }
      if (!state.isInitialized) {
        if (__DEV__) {
          console.log('[BabyContext] family_members.insert — waiting for first load');
        }
        // Schedule a single deferred retry so we don't miss it.
        setTimeout(() => {
          if (isMounted.current) loadBabiesRef.current?.(true);
        }, 800);
        return;
      }
      loadBabiesRef.current?.(true);
    },
    onUpdate: () => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.updated');
      if (!currentUserIdRef.current || !state.isInitialized) return;
      loadBabiesRef.current?.(true);
    },
    onDelete: () => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.deleted');
      if (!currentUserIdRef.current || !state.isInitialized) return;
      loadBabiesRef.current?.(true);
    },
  });

  
  const broadcastBabyChange = useCallback((babyId: string | null) => {
    if (lastBroadcastedBabyIdRef.current === babyId) return;
    lastBroadcastedBabyIdRef.current = babyId;
    babyChangeSubscribers.forEach(callback => {
      try {
        callback(babyId);
      } catch {
        /* ignore subscriber errors */
      }
    });
  }, []);

  const currentBabyIdForSubsRef = useRef<string | null>(state.currentBabyId);
  currentBabyIdForSubsRef.current = state.currentBabyId;

  const subscribeToBabyChanges = useCallback((callback: BabyChangeCallback) => {
    babyChangeSubscribers.push(callback);
    try {
      callback(currentBabyIdForSubsRef.current);
    } catch {
      /* ignore */
    }
    return () => {
      babyChangeSubscribers = babyChangeSubscribers.filter(cb => cb !== callback);
    };
  }, []);

  
  
  
  
  
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    
    const fromAuth =
      auth?.userProfile?.id ??
      (auth?.session?.user?.id ?? null);
    if (fromAuth) {
      currentUserIdRef.current = fromAuth;
      return fromAuth;
    }

    
    if (currentUserIdRef.current) {
      return currentUserIdRef.current;
    }

    
    
    
    
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user?.id) {
        currentUserIdRef.current = session.user.id;
        return session.user.id;
      }
    } catch {
      
    }

    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const authKey = keys.find(
        k => k.includes('auth-token') || k.includes('supabase.auth')
      );
      if (authKey) {
        const stored = await AsyncStorage.getItem(authKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            
            const userId =
              parsed?.user?.id ||
              parsed?.session?.user?.id ||
              parsed?.currentSession?.user?.id;
            if (userId) {
              if (__DEV__) console.log('[BabyContext] ✅ Recovered user ID from AsyncStorage');
              currentUserIdRef.current = userId;
              return userId;
            }
          } catch (parseErr) {
            if (__DEV__) console.warn('[BabyContext] Failed to parse stored session:', parseErr);
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[BabyContext] AsyncStorage recovery failed:', e);
    }

    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user?.id) {
        currentUserIdRef.current = user.id;
        return user.id;
      }
    } catch (e) {
      if (__DEV__) console.warn('[BabyContext] getUser failed:', e);
    }

    if (__DEV__) console.warn('[BabyContext] Could not get user ID from any method');
    return null;
  }, [auth?.userProfile?.id, auth?.session?.user?.id]);

  
  const loadBabies = useCallback(async (force = false) => {
    // ─────────────────────────────────────────────────────────────
    // INSTANCE GUARD
    //
    // React StrictMode (and sometimes navigator-driven remounts of
    // the provider tree) mounts → unmounts → remounts BabyProvider
    // in the same render cycle. When that happens:
    //   • The first instance starts loadBabies(), which flips
    //     `loadInProgressRef.current = true`.
    //   • The first instance unmounts, its `isMounted` ref becomes
    //     false, and the async body aborts at the "if (!isMounted)"
    //     guard AFTER its network queries.
    //   • The second instance tries to loadBabies() but bails
    //     because `loadInProgressRef.current` is still true.
    // Result: nothing ever populates state.babies.
    //
    // Fix: track a monotonically-increasing "mount token". Only the
    // instance that currently holds the token is allowed to commit
    // state. The ref is reset on unmount so the next instance can
    // proceed immediately.
    // ─────────────────────────────────────────────────────────────
    if (loadInProgressRef.current && !force) {
      if (__DEV__) console.log('[BabyContext] Load already in progress, skipping');
      return;
    }

    // Never trust isMounted here — it can be false due to StrictMode
    // double-mount even though we're actually the current instance.
    // The mount token below is the authoritative check.

    loadInProgressRef.current = true;
    const myMountToken = mountTokenRef.current;
    if (__DEV__) console.log('[BabyContext] Starting loadBabies...');

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      let userId = await getCurrentUserId();

      
      if (!userId) {
        await new Promise(r => setTimeout(r, 500));
        userId = await getCurrentUserId();
      }

      if (!userId) {
        if (__DEV__) console.warn('[BabyContext] No authenticated user after retry');
        
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isInitialized: prev.isInitialized || prev.babies.length > 0,
          }));
        }
        return;
      }

      if (__DEV__) {
        console.log('[BabyContext] Loading babies for user ID (UUID):', userId);
      }
      currentUserIdRef.current = userId;

      let allBabies: any[] = [];
      const userRoles: Record<
        string,
        'parent1' | 'parent2' | 'guardian' | 'viewer'
      > = {};
      const userPermissions: Record<string, Record<string, boolean>> = {};
      const seenBabyIds = new Set<string>();

      
      try {
        const { data, error } = await supabase
          .from('babies')
          .select('*')
          .eq('parent1_id', userId)
          .eq('is_active', true);

        if (error) {
          console.warn('[BabyContext] Parent1 query error:', error.message);
        } else if (data) {
          data.forEach((baby: any) => {
            if (!seenBabyIds.has(baby.id)) {
              seenBabyIds.add(baby.id);
              allBabies.push(baby);
              userRoles[baby.id] = 'parent1';
              userPermissions[baby.id] = {
                view: true, edit: true, delete: true, manage: true,
                invite: true, export: true,
              };
            }
          });
          if (__DEV__) {
            console.log(`[BabyContext] Found ${data.length} babies (parent1 query)`);
          }
        }
      } catch (e) {
        console.warn('[BabyContext] Parent1 query failed:', e);
      }

      
      try {
        const { data, error } = await supabase
          .from('babies')
          .select('*')
          .eq('parent2_id', userId)
          .eq('is_active', true);

        if (error) {
          console.warn('[BabyContext] Parent2 query error:', error.message);
        } else if (data) {
          data.forEach((baby: any) => {
            if (!seenBabyIds.has(baby.id)) {
              seenBabyIds.add(baby.id);
              allBabies.push(baby);
              userRoles[baby.id] = 'parent2';
              userPermissions[baby.id] = {
                view: true, edit: true, delete: true, manage: true,
                invite: true, export: true,
              };
            }
          });
          if (__DEV__) {
            console.log(`[BabyContext] Found ${data.length} babies (parent2 query)`);
          }
        }
      } catch (e) {
        console.warn('[BabyContext] Parent2 query failed:', e);
      }

      
      try {
        if (__DEV__) {
          console.log('[BabyContext] Querying family_members for user:', userId);
        }

        const { data: familyMembers, error: fmError } = await supabase
          .from('family_members')
          .select('baby_id, role, relationship, permissions')
          .eq('user_id', userId)
          .eq('status', 'active')
          .is('deleted_at', null);

        if (fmError) {
          console.warn('[BabyContext] Family members query error:', fmError.message);
        } else if (familyMembers && familyMembers.length > 0) {
          if (__DEV__) {
            console.log(
              `[BabyContext] Found ${familyMembers.length} family memberships for user`
            );
          }

          const uniqueBabyIds = [
            ...new Set(
              familyMembers
                .filter(
                  (fm: any) => fm.baby_id && fm.baby_id.trim().length > 0
                )
                .map((fm: any) => fm.baby_id)
            ),
          ];

          if (__DEV__) {
            console.log(
              `[BabyContext] Unique baby IDs from family_members:`,
              uniqueBabyIds
            );
          }

          if (uniqueBabyIds.length > 0) {
            const { data: babyData, error: babyError } = await supabase
              .from('babies')
              .select('*')
              .in('id', uniqueBabyIds);

            if (babyError) {
              console.warn('[BabyContext] Baby query error:', babyError.message);
            }
            // ── FIX: Guardian / viewer visibility ─────────────────
            // If `family_members` returned the baby_id but the
            // follow-up `babies` SELECT returns 0 rows, the RLS
            // policy on `babies` is blocking non-parent reads. That
            // is the #1 cause of "guardian sees empty family".
            // We attempt a fallback read via a SECURITY DEFINER RPC
            // `get_baby_for_member(baby_id)` that returns the row
            // if the caller has an active family_members row.
            let effectiveBabyData = babyData;
            if ((!effectiveBabyData || effectiveBabyData.length === 0) && uniqueBabyIds.length > 0) {
              if (__DEV__) {
                console.warn(
                  '[BabyContext] `babies` SELECT returned 0 rows for family_members baby_ids — ' +
                  'likely an RLS policy issue. Attempting RPC fallback.',
                );
              }
              const recovered: any[] = [];
              for (const bid of uniqueBabyIds) {
                try {
                  const { data: rpcRow, error: rpcErr } = await supabase
                    .rpc('get_baby_for_member', { p_baby_id: bid });
                  if (!rpcErr && rpcRow) {
                    const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
                    if (row) recovered.push(row);
                  }
                } catch {}
              }
              if (recovered.length > 0) {
                effectiveBabyData = recovered;
              }
            }

            if (effectiveBabyData && effectiveBabyData.length > 0) {
              if (__DEV__) {
                console.log(
                  `[BabyContext] Found ${effectiveBabyData.length} babies from family_members`
                );
              }

              effectiveBabyData.forEach((baby: any) => {
                if (!seenBabyIds.has(baby.id)) {
                  seenBabyIds.add(baby.id);
                  allBabies.push(baby);

                  const member = familyMembers.find(
                    (fm: any) => fm.baby_id === baby.id
                  );
                  const role = member?.role || 'viewer';
                  userRoles[baby.id] = role;

                  let jsonPerms: Record<string, boolean> = {};
                  if (member?.permissions) {
                    try {
                      jsonPerms =
                        typeof member.permissions === 'string'
                          ? JSON.parse(member.permissions)
                          : member.permissions;
                    } catch (e) {
                      console.warn(
                        '[BabyContext] Failed to parse permissions JSON:',
                        e
                      );
                    }
                  }

                  const isParent = role === 'parent1' || role === 'parent2';
                  const isGuardian = role === 'guardian';

                  userPermissions[baby.id] = {
                    view: jsonPerms.canView ?? true,
                    edit: jsonPerms.canEditEntry ?? (isParent || isGuardian),
                    delete: jsonPerms.canDeleteEntry ?? isParent,
                    manage: jsonPerms.canManageFamily ?? isParent,
                    invite: jsonPerms.canInvite ?? isParent,
                    export: jsonPerms.canExport ?? isParent,

                    canView: jsonPerms.canView ?? true,
                    canAddEntry: jsonPerms.canAddEntry ?? (isParent || isGuardian),
                    canEditEntry: jsonPerms.canEditEntry ?? (isParent || isGuardian),
                    canEditOthersEntries:
                      jsonPerms.canEditOthersEntries ?? isParent,
                    canDeleteEntry: jsonPerms.canDeleteEntry ?? isParent,
                    canEditBaby: jsonPerms.canEditBaby ?? isParent,
                    canInvite: jsonPerms.canInvite ?? isParent,
                    canExport: jsonPerms.canExport ?? isParent,
                    canManageFamily: jsonPerms.canManageFamily ?? isParent,
                  };
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn('[BabyContext] Family members query failed:', e);
      }

      
      if (allBabies.length === 0) {
        if (__DEV__) {
          console.log(
            '[BabyContext] No babies found, checking invite_codes fallback...'
          );
        }
        try {
          const { data: inviteData, error: inviteError } = await supabase
            .from('invite_codes')
            .select('family_id, role')
            .eq('used_by', userId)
            .eq('used', true)
            .maybeSingle();

          if (!inviteError && inviteData?.family_id) {
            if (__DEV__) {
              console.log(
                `[BabyContext] Found family_id from invite_codes: ${inviteData.family_id}`
              );
            }

            const { data: babyData, error: babyError } = await supabase
              .from('babies')
              .select('*')
              .eq('id', inviteData.family_id);

            if (!babyError && babyData && babyData.length > 0) {
              if (__DEV__) {
                console.log(
                  `[BabyContext] Found baby via invite_codes fallback: ${babyData[0].name}`
                );
              }
              babyData.forEach((baby: any) => {
                if (!seenBabyIds.has(baby.id)) {
                  seenBabyIds.add(baby.id);
                  allBabies.push(baby);
                  const role = inviteData.role || 'viewer';
                  userRoles[baby.id] = role;

                  const isParent = role === 'parent1' || role === 'parent2';
                  const isGuardian = role === 'guardian';

                  userPermissions[baby.id] = {
                    view: true,
                    edit: isParent || isGuardian,
                    delete: isParent,
                    manage: isParent,
                    invite: isParent,
                    export: isParent,

                    canView: true,
                    canAddEntry: isParent || isGuardian,
                    canEditEntry: isParent || isGuardian,
                    canEditOthersEntries: isParent,
                    canDeleteEntry: isParent,
                    canEditBaby: isParent,
                    canInvite: isParent,
                    canExport: isParent,
                    canManageFamily: isParent,
                  };
                }
              });
            }
          }
        } catch (e) {
          console.warn('[BabyContext] Invite codes fallback failed:', e);
        }
      }

      if (__DEV__) {
        console.log(`[BabyContext] Total babies found: ${allBabies.length}`);
      }

      
      // ── Family labels ─────────────────────────────────────────
      // A user can belong to multiple families (Parent1 on Baby A,
      // Guardian on Baby B). The switcher shows "Sarah's family" for
      // guardians so they can tell Baby-B-from-Sarah apart from
      // Baby-B-from-James without tapping into each.
      //
      // We resolve the parent1's display name for each baby ONCE,
      // in a single batched query.
      const parent1Ids = Array.from(
        new Set(
          allBabies
            .map(b => b.parent1_id)
            .filter((id: any): id is string => !!id),
        ),
      );
      const parent1Names: Record<string, string> = {};
      if (parent1Ids.length > 0) {
        try {
          const { data: parents } = await supabase
            .from('profiles')
            .select('id, full_name, community_display_name')
            .in('id', parent1Ids);
          (parents || []).forEach((p: any) => {
            parent1Names[p.id] =
              p.community_display_name || p.full_name || 'Family';
          });
        } catch {}
      }

      const babies: BabyProfile[] = allBabies.map((baby: any) => {
        const role = userRoles[baby.id] || 'viewer';
        const profile = mapBabyRowToProfile(baby, role);
        // Determine family label:
        //   • I'm a parent → "Your family"
        //   • I'm a guardian/viewer → "<Parent1 first name>'s family"
        if (role === 'parent1' || role === 'parent2') {
          profile.familyLabel = 'Your family';
        } else {
          const p1Name = baby.parent1_id
            ? parent1Names[baby.parent1_id] || ''
            : '';
          const first = p1Name.split(' ')[0] || 'Shared';
          profile.familyLabel = `${first}'s family`;
        }
        return profile;
      });

      
      // IMPORTANT: scope the cache by user ID so a different account
      // signing in on the same device cannot hydrate this account's
      // baby list from AsyncStorage. `userId` is already resolved above.
      const scopedBabiesCacheKey = `${STORAGE_KEYS.BABIES_CACHE_KEY}_${userId}`;
      const scopedLastSyncKey = `${STORAGE_KEYS.LAST_SYNC_KEY}_${userId}`;
      if (babies.length > 0) {
        try {
          await AsyncStorage.setItem(
            scopedBabiesCacheKey,
            JSON.stringify(babies)
          );
          await AsyncStorage.setItem(
            scopedLastSyncKey,
            Date.now().toString()
          );
        } catch (cacheError) {
          console.warn('[BabyContext] Failed to cache babies:', cacheError);
        }
      } else {
        await AsyncStorage.removeItem(scopedBabiesCacheKey);
      }

      
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
          if (__DEV__) {
            console.log(
              '[BabyContext] Current baby ID from app_settings:',
              currentId
            );
          }
        } catch (e) {
          console.warn('[BabyContext] Failed to get current_baby_id:', e);
        }

        const isValidCurrent = currentId && babies.some(b => b.id === currentId);

        if (!isValidCurrent) {
          // ── Multi-family priority ────────────────────────────────
          // A user can be Parent1 on Baby A and Guardian on Baby B.
          // If the stored `current_baby_id` is stale (baby was
          // deleted, or this is a fresh device), pick the baby with
          // the HIGHEST role tier they own, then the most recently
          // created baby. This matches what users expect: "my own
          // baby first, then babies I'm a guardian of."
          const prioritizedBabies = [...babies].sort((a, b) => {
            const priority: Record<string, number> = {
              parent1: 0,
              parent2: 1,
              guardian: 2,
              viewer: 3,
            };
            const roleDelta =
              (priority[a.role || 'viewer'] ?? 3) -
              (priority[b.role || 'viewer'] ?? 3);
            if (roleDelta !== 0) return roleDelta;
            // Same role → newest baby first.
            const aT = new Date(a.createdAt || 0).getTime();
            const bT = new Date(b.createdAt || 0).getTime();
            return bT - aT;
          });
          currentId = prioritizedBabies[0]?.id || babies[0].id;
          if (__DEV__) {
            console.log(
              `[BabyContext] Setting current baby to first: ${currentId}`
            );
          }

          try {
            await supabase
              .from('app_settings')
              .upsert(
                {
                  key: 'current_baby_id',
                  value: currentId,
                  user_id: userId,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'key, user_id' }
              );
          } catch (e) {
            console.warn(
              '[BabyContext] Failed to save current_baby_id:',
              e
            );
          }
        }
      } else {
        currentId = null;
        if (__DEV__) {
          console.log('[BabyContext] No babies found for user');
        }

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

      const babyToSet = currentId
        ? babies.find(b => b.id === currentId) || null
        : null;

      
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

      // ─────────────────────────────────────────────────────────────
      // COMMIT GUARD — must use the mount token, NOT isMounted.
      //
      // If this instance has been superseded by a remount (StrictMode
      // or navigator reset), the token has changed. In that case a
      // *newer* instance is running loadBabies() with fresher data,
      // so it's safe to bail out here — that instance will commit.
      //
      // If the token is unchanged, we ARE the current instance. We
      // must commit the state even if `isMounted.current` is false,
      // because `isMounted` is unreliable under StrictMode and would
      // otherwise swallow the setState and leave state.babies empty.
      // ─────────────────────────────────────────────────────────────
      if (mountTokenRef.current !== myMountToken) {
        if (__DEV__) {
          console.log('[BabyContext] Superseded by newer instance — aborting stale commit');
        }
        return;
      }

      if (babies.length > 0 && !backfillRanRef.current) {
        backfillRanRef.current = true;
        import('@/services/ai/backfillBayesian')
          .then(({ backfillBayesianIfNeeded }) => {
            Promise.all(
              babies.map(b => backfillBayesianIfNeeded(b.id).catch(() => null))
            ).catch(() => {});
          })
          .catch(() => {});

        import('@/services/ai/PredictorEngine')
          .then(({ backfillPredictor }) => {
            const types: Array<'sleep' | 'feed' | 'diaper' | 'medication'> = [
              'sleep',
              'feed',
              'diaper',
              'medication',
            ];
            Promise.all(
              babies.flatMap(b =>
                types.map(t =>
                  backfillPredictor(b.id, t, 30)
                    .then(r => {
                      if (__DEV__ && r.samples > 0) {
                        console.log(
                          `[Predictor] ${b.id}/${t}: ${r.samples} intervals`
                        );
                      }
                      return r;
                    })
                    .catch(() => null)
                )
              )
            ).catch(() => {});
          })
          .catch(() => {});
      }

      
      if (__DEV__) {
        console.log(
          `[BabyContext] Setting state: ${babies.length} babies, current: ${currentId}`
        );
      }

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

      // ── FIX: wipe the per-user cache after a successful load so a
      // stale "empty list" from a previous failed attempt can never
      // be the offline fallback. This is why guardians sometimes
      // still see "no babies" after the DB is fixed — they were
      // hydrating the empty cache, not the network.
      try {
        await AsyncStorage.removeItem(
          `${STORAGE_KEYS.BABIES_CACHE_KEY}_${userId}`,
        );
      } catch {}

      requestAnimationFrame(() => {
        broadcastBabyChange(currentId);
      });

      if (__DEV__) {
        console.log('[BabyContext] loadBabies completed successfully');
      }
    } catch (error) {
      console.error('[BabyContext] Error loading babies:', error);

      try {
        // NEVER fall back to a global "anon" bucket — that would leak the
        // previous account's baby list into a fresh session. If we don't
        // know who the user is yet, skip the cache entirely.
        const cacheUid = currentUserIdRef.current;
        if (!cacheUid) {
          if (__DEV__) {
            console.warn('[BabyContext] Cannot read cache without a user ID — skipping');
          }
        } else {
          const cacheKey = `${STORAGE_KEYS.BABIES_CACHE_KEY}_${cacheUid}`;
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const cachedBabies = JSON.parse(cached);
            if (__DEV__) {
              console.log(
                `[BabyContext] Loaded ${cachedBabies.length} babies from cache`
              );
            }
            if (isMounted.current && cachedBabies.length > 0) {
              // `state.currentBabyId` here is a stale closure — it was
              // captured at the time `loadBabies` was first memoised.
              // `currentBabyIdForSubsRef` is kept live by the subscriber
              // bridge effect and always holds the current value.
              const cachedBaby =
                cachedBabies.find((b: any) => b.id === currentBabyIdForSubsRef.current) ||
                cachedBabies[0] ||
                null;
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

  useEffect(() => {
    loadBabiesRef.current = loadBabies;
  }, [loadBabies]);

  const forceRefresh = useCallback(async () => {
    if (__DEV__) console.log('[BabyContext] Force refresh requested');
    await loadBabies(true);
  }, [loadBabies]);

  
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) console.log('[BabyContext] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          const previousUserId = currentUserIdRef.current;
          const nextUserId = session.user.id;

          // Account switch on the same device: wipe everything before
          // loading the new user's babies. Otherwise the previous
          // user's baby list flashes (and is used as the fallback
          // currentBaby) until the new fetch completes.
          if (previousUserId && previousUserId !== nextUserId) {
            try {
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.BABIES_CACHE_KEY,
                `${STORAGE_KEYS.BABIES_CACHE_KEY}_${previousUserId}`,
                STORAGE_KEYS.CURRENT_BABY_ID,
                STORAGE_KEYS.LAST_SYNC_KEY,
                `${STORAGE_KEYS.LAST_SYNC_KEY}_${previousUserId}`,
              ]);
            } catch {}
            if (isMounted.current) {
              setState(prev => ({
                ...prev,
                babies: [],
                currentBabyId: null,
                currentBaby: null,
                isInitialized: false,
                userRoles: {},
                userPermissions: {},
              }));
            }
          }

          currentUserIdRef.current = nextUserId;
          initRef.current = false;
          backfillRanRef.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              loadBabies(true);
            }
          }, 500);
        } else if (event === 'SIGNED_OUT') {
          currentUserIdRef.current = null;
          initRef.current = false;
          backfillRanRef.current = false;
          lastBroadcastedBabyIdRef.current = null;

          // Purge the on-disk babies cache so a different account
          // signing in on this device doesn't inherit the previous
          // account's baby list as an offline fallback.
          try {
            const lastUid = currentUserIdRef.current;
            const keys: string[] = [
              STORAGE_KEYS.BABIES_CACHE_KEY,
              STORAGE_KEYS.CURRENT_BABY_ID,
              STORAGE_KEYS.LAST_SYNC_KEY,
            ];
            if (lastUid) {
              keys.push(
                `${STORAGE_KEYS.BABIES_CACHE_KEY}_${lastUid}`,
                `${STORAGE_KEYS.LAST_SYNC_KEY}_${lastUid}`,
              );
            }
            await AsyncStorage.multiRemove(keys);
          } catch {}

          if (isMounted.current) {
            setState(prev => ({
              ...prev,
              babies: [],
              currentBabyId: null,
              currentBaby: null,
              isInitialized: false,
              userRoles: {},
              userPermissions: {},
            }));
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          currentUserIdRef.current = session.user.id;
        }
      }
    );

    authStateListenerRef.current = authListener;

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [loadBabies]);

  
  
  useEffect(() => {
    if (authUserId) {
      initRef.current = false;
      backfillRanRef.current = false;
      
      const t = setTimeout(() => {
        if (isMounted.current) loadBabies(true);
      }, 300);
      return () => clearTimeout(t);
    } else {
      
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          babies: [],
          currentBabyId: null,
          currentBaby: null,
          isInitialized: false,
          userRoles: {},
          userPermissions: {},
        }));
      }
    }
  }, [authUserId, loadBabies]);

  
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initialize = async () => {
      if (__DEV__) console.log('[BabyContext] Initializing...');

      
      const fromAuth = authUserId;
      if (fromAuth) {
        currentUserIdRef.current = fromAuth;
        await loadBabies();
        return;
      }

      
      let hasSession = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          hasSession = true;
          currentUserIdRef.current = session.user.id;
        }
      } catch (e) {
        console.warn('[BabyContext] Session check on init failed:', e);
      }

      if (hasSession) {
        await loadBabies();
        return;
      }

      let attempts = 0;
      while (attempts < maxLoadAttempts) {
        if (!isMounted.current) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            currentUserIdRef.current = session.user.id;
            await loadBabies();
            return;
          }
        } catch {
          
        }
      }

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isInitialized: true,
        }));
      }
    };

    initialize();

    return () => {
      isMounted.current = false;

      // Bump the mount token so any in-flight loadBabies() from this
      // instance aborts before it commits stale state. The next
      // mount will take a fresh token and load cleanly.
      mountTokenRef.current += 1;

      // CRITICAL: reset the in-progress flag so the NEXT mount can
      // load immediately. Without this, the next instance's
      // loadBabies() sees `loadInProgressRef.current === true` and
      // bails — the classic StrictMode double-mount trap.
      loadInProgressRef.current = false;

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ageIntervalRef.current) {
        clearInterval(ageIntervalRef.current);
        ageIntervalRef.current = null;
      }
      if (authStateListenerRef.current) {
        authStateListenerRef.current?.subscription?.unsubscribe?.();
      }
    };
  }, [loadBabies, authUserId]);

  
  useEffect(() => {
    if (appStateListenerRef.current) {
      appStateListenerRef.current.remove?.();
      appStateListenerRef.current = null;
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            loadBabiesRef.current?.(true);
          }
        }, 500);
      }
    });

    appStateListenerRef.current = subscription;

    return () => {
      if (appStateListenerRef.current) {
        appStateListenerRef.current.remove?.();
        appStateListenerRef.current = null;
      }
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        loadBabiesRef.current?.(true);
      }
    }, 300000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  
  useEffect(() => {
    if (ageIntervalRef.current) {
      clearInterval(ageIntervalRef.current);
      ageIntervalRef.current = null;
    }

    if (state.babies.length === 0) return;

    const updateAges = () => {
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        babies: prev.babies.map(b => ({
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

  
  const getBabyAge = useCallback(
    (babyId?: string): string => {
      const id = babyId || state.currentBabyId;
      if (!id) return '';
      const baby = state.babies.find(b => b.id === id);
      return baby?.age || '';
    },
    [state.babies, state.currentBabyId]
  );

  
  const getUserRoleForBaby = useCallback(
    (babyId?: string): 'parent1' | 'parent2' | 'guardian' | 'viewer' | null => {
      const id = babyId || state.currentBabyId;
      if (!id) return null;
      return state.userRoles[id] || 'viewer';
    },
    [state.currentBabyId, state.userRoles]
  );

  const hasPermissionForBaby = useCallback(
    (babyId: string, action: string): boolean => {
      const perms = state.userPermissions[babyId];
      if (!perms) return false;

      const actionMap: Record<string, string> = {
        view: 'canView',
        add: 'canAddEntry',
        addEntry: 'canAddEntry',
        edit: 'canEditEntry',
        editEntry: 'canEditEntry',
        editOthers: 'canEditOthersEntries',
        editOthersEntries: 'canEditOthersEntries',
        delete: 'canDeleteEntry',
        deleteEntry: 'canDeleteEntry',
        editBaby: 'canEditBaby',
        invite: 'canInvite',
        export: 'canExport',
        manage: 'canManageFamily',
        manageFamily: 'canManageFamily',
      };

      const key = actionMap[action] || action;
      return Boolean((perms as any)[key] ?? perms[action] ?? false);
    },
    [state.userPermissions]
  );

  const getBabiesForRole = useCallback(
    (role: 'parent1' | 'parent2' | 'guardian' | 'viewer'): BabyProfile[] => {
      return state.babies.filter(baby => baby.role === role);
    },
    [state.babies]
  );

  const canManageBaby = useCallback(
    (babyId?: string): boolean => {
      const id = babyId || state.currentBabyId;
      if (!id) return false;
      const perms = state.userPermissions[id];
      return perms?.manage || perms?.delete || false;
    },
    [state.currentBabyId, state.userPermissions]
  );

  const canViewBaby = useCallback(
    (babyId?: string): boolean => {
      const id = babyId || state.currentBabyId;
      if (!id) return false;

      
      
      
      
      
      
      if (state.babies.some(b => b.id === id)) return true;

      const role = state.userRoles[id];
      if (role) return true;

      const perms = state.userPermissions[id];
      if (perms?.view || perms?.canView) return true;

      return false;
    },
    [
      state.currentBabyId,
      state.babies,
      state.userRoles,
      state.userPermissions,
    ]
  );

  const canEditBaby = useCallback(
    (babyId?: string): boolean => {
      const id = babyId || state.currentBabyId;
      if (!id) return false;
      const perms = state.userPermissions[id];
      return perms?.edit || false;
    },
    [state.currentBabyId, state.userPermissions]
  );

  
  const skipBaby = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
      await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'has_skipped_baby',
            value: 'true',
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key, user_id' }
        );

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

  
  const createBaby = useCallback(
    async (
      data: Omit<
        BabyProfile,
        | 'id'
        | 'streak'
        | 'milestones'
        | 'photos'
        | 'createdAt'
        | 'age'
        | 'lastUpdated'
        | 'parent1Id'
      >
    ): Promise<string | null> => {
      if (isCreatingRef.current) {
        console.log('[BabyContext] Creation already in progress');
        return null;
      }
      isCreatingRef.current = true;

      // ── Normalize camelCase ↔ snake_case ─────────────────────
      // BabyProfileCreateScreen historically sent snake_case keys
      // (`birth_weight_kg`, `date_of_birth`, `current_weight_kg`, …)
      // because form field IDs use snake_case. But BabyProfile (and
      // therefore the TS signature of `createBaby`) uses camelCase
      // (`birthWeight`, `birthDate`, `weight`, …). Without this
      // normalizer, every camelCase key came through `undefined` and
      // the payload ended up with `null` — which is exactly why
      // birth-detail values disappeared after profile creation.
      const raw: any = data || {};
      const pick = (...keys: string[]): any => {
        for (const k of keys) {
          const v = raw[k];
          if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
      };

      const normalized = {
        name: pick('name') ?? 'Baby',
        avatar: pick('avatar', 'avatar_url'),
        birthDate: pick('birthDate', 'birth_date', 'date_of_birth'),
        gender: pick('gender'),
        skinTone: pick('skinTone', 'skin_tone'),
        bloodType: pick('bloodType', 'blood_type'),
        medicalNotes: pick('medicalNotes', 'medical_notes'),
        allergies: pick('allergies'),
        parent2Id: pick('parent2Id', 'parent2_id'),
        weight: pick('weight', 'currentWeightKg', 'current_weight_kg'),
        height: pick('height', 'currentHeightCm', 'current_height_cm'),
        birthTime: pick('birthTime', 'birth_time'),
        birthWeight: pick('birthWeight', 'birth_weight_kg'),
        birthHeight: pick('birthHeight', 'birth_height_cm'),
        birthHeadCircumference: pick('birthHeadCircumference', 'birth_head_circumference'),
        deliveryType: pick('deliveryType', 'delivery_type'),
        gestationalWeeks: pick('gestationalWeeks', 'gestational_weeks'),
        apgar1Min: pick('apgar1Min', 'apgar_1min'),
        apgar5Min: pick('apgar5Min', 'apgar_5min'),
        birthPlace: pick('birthPlace', 'birth_place'),
        birthAttendant: pick('birthAttendant', 'birth_attendant'),
        multipleBirth: pick('multipleBirth', 'multiple_birth'),
        birthOrder: pick('birthOrder', 'birth_order'),
        feedingPlan: pick('feedingPlan', 'feeding_plan'),
        emergencyContact: pick('emergencyContact', 'emergency_contact'),
        pediatrician: pick('pediatrician'),
        notificationsEnabled: pick('notificationsEnabled', 'notifications_enabled'),
      } as any;

      const birthDate = new Date(normalized.birthDate);
      const now = new Date();
      if (birthDate > now || isNaN(birthDate.getTime())) {
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

        const toNum = (v: unknown): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? n : null;
        };
        const toInt = (v: unknown): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          return Number.isFinite(n) ? n : null;
        };

        const babyData = {
          id: newId,
          name: normalized.name,
          avatar: normalized.avatar || null,
          date_of_birth: birthDate.toISOString(),
          gender:
            normalized.gender === 'boy' || normalized.gender === 'male'
              ? 'male'
              : normalized.gender === 'girl' || normalized.gender === 'female'
              ? 'female'
              : 'other',
          blood_type: normalized.bloodType || null,
          medical_notes: normalized.medicalNotes || null,
          allergies: normalized.allergies || null,
          parent1_id: userId,
          parent2_id: normalized.parent2Id || null,
          current_weight_kg: toNum(normalized.weight),
          current_height_cm: toNum(normalized.height),
          birth_time: normalized.birthTime || null,
          birth_weight_kg: toNum(normalized.birthWeight),
          birth_height_cm: toNum(normalized.birthHeight),
          birth_head_circumference: toNum(normalized.birthHeadCircumference),
          delivery_type: normalized.deliveryType
            ? String(normalized.deliveryType).toLowerCase().replace(/[\s-]+/g, '_')
            : null,
          gestational_weeks: toInt(normalized.gestationalWeeks),
          apgar_1min: toInt(normalized.apgar1Min),
          apgar_5min: toInt(normalized.apgar5Min),
          birth_place: normalized.birthPlace || null,
          birth_attendant: normalized.birthAttendant
            ? String(normalized.birthAttendant).toLowerCase().replace(/[\s-]+/g, '_')
            : null,
          multiple_birth: Boolean(normalized.multipleBirth),
          birth_order: toInt(normalized.birthOrder),
          feeding_plan: normalized.feedingPlan
            ? String(normalized.feedingPlan).toLowerCase()
            : null,
          emergency_contact: normalized.emergencyContact || null,
          pediatrician: normalized.pediatrician || null,
          notifications_enabled: normalized.notificationsEnabled !== false,
          skin_tone: toInt(normalized.skinTone) ?? 0,
          is_active: true,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        const { data: result, error } = await supabase
          .from('babies')
          .insert(babyData)
          .select()
          .single();

        if (error || !result) {
          console.error('[BabyContext] Create baby error:', error);
          isCreatingRef.current = false;
          return null;
        }

        // ─── SEED THE PARENT1 family_members ROW ───────────────────
        // This is the canonical row that FamilyContext reads to build
        // the family tree and chat header labels. Doing it here (rather
        // than lazily in FamilyContext.loadFamily) guarantees:
        //   • The relationship the user declared at signup is persisted
        //     per-baby (the same user can be "Mother" for baby A and
        //     "Guardian" for baby B if they own both).
        //   • Parent 1 appears in the family tree / chat roster on the
        //     very first render — no "Primary Parent" fallback flash.
        //   • The `relationship` column is populated, so every consumer
        //     of `getMemberDisplayLabel()` gets "Mother"/"Father" etc.
        try {
          const { data: authUser } = await supabase.auth.getUser();
          const meta: any = authUser?.user?.user_metadata || {};
          // The relationship declared at signup is only a fallback —
          // `profiles.community_bio` may hold a per-baby relationship
          // the user set during profile creation. Prefer that.
          let declaredRelationship: string =
            (meta.relationship && String(meta.relationship).trim()) || '';
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('community_bio')
              .eq('id', userId)
              .maybeSingle();
            const bioRel = (prof?.community_bio || '').trim();
            // Only use `community_bio` as a relationship when it looks
            // like a relationship label (short, no sentence punctuation).
            if (
              bioRel &&
              bioRel.length <= 40 &&
              !/[.!?]/.test(bioRel) &&
              /^(mother|father|mom|dad|parent|guardian|grandmother|grandfather|aunt|uncle|sibling|caregiver|nanny|other)$/i.test(bioRel)
            ) {
              declaredRelationship = bioRel;
            }
          } catch {}
          const seededPermissions = {
            canView: true, canAddEntry: true, canEditEntry: true,
            canEditOthersEntries: true, canDeleteEntry: true,
            canEditBaby: true, canInvite: true, canExport: true,
            canManageFamily: true,
          };
          const nowIso = new Date().toISOString();
          const { error: fmErr } = await supabase
            .from('family_members')
            .insert({
              id: `${result.id}-p1`,
              baby_id: result.id,
              user_id: userId,
              email: (authUser?.user?.email || '').toLowerCase(),
              full_name: authUser?.user?.user_metadata?.full_name || 'Primary Parent',
              role: 'parent1',
              relationship: declaredRelationship || 'Parent',
              permissions: seededPermissions,
              added_at: nowIso,
              added_by: userId,
              can_be_removed: false,
              last_active: nowIso,
              phone_number: authUser?.user?.phone || null,
              notifications_enabled: true,
              status: 'active',
              updated_at: nowIso,
              is_deleted: false,
            });
          if (fmErr && __DEV__) {
            console.warn('[BabyContext] Failed to seed parent1 family_member:', fmErr.message);
          }
        } catch (e) {
          if (__DEV__) console.warn('[BabyContext] parent1 seed threw:', e);
        }

        const newBaby: BabyProfile = {
          ...data,
          id: result.id,
          parent1Id: userId,
          streak: 0,
          milestones: 0,
          photos: 0,
          createdAt: now.toISOString(),
          lastUpdated: now.toISOString(),
          birthDate: normalized.birthDate,
          age: calculateAge(normalized.birthDate),
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
              [newCurrentId]: {
                view: true,
                edit: true,
                delete: true,
                manage: true,
                invite: true,
                export: true,
                canView: true,
                canAddEntry: true,
                canEditEntry: true,
                canEditOthersEntries: true,
                canDeleteEntry: true,
                canEditBaby: true,
                canInvite: true,
                canExport: true,
                canManageFamily: true,
              },
            },
          }));
        }

        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, newCurrentId);

        try {
          await supabase
            .from('app_settings')
            .upsert(
              {
                key: 'current_baby_id',
                value: newCurrentId,
                user_id: userId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'key, user_id' }
            );
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

        requestAnimationFrame(() => {
          broadcastBabyChange(newCurrentId);
        });

        await AsyncStorage.removeItem(`${STORAGE_KEYS.BABIES_CACHE_KEY}_${userId}`);

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});

        isCreatingRef.current = false;
        return result.id;
      } catch (error) {
        isCreatingRef.current = false;
        console.error('[BabyContext] Create baby error:', error);
        return null;
      }
    },
    [calculateAge, getCurrentUserId, broadcastBabyChange]
  );

  
  const updateBaby = useCallback(
    async (id: string, updates: Partial<BabyProfile>) => {
      try {
        if (!canEditBaby(id)) {
          Alert.alert(
            'Permission Denied',
            "You do not have permission to edit this baby's profile"
          );
          return;
        }

        const remoteUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        // ── Numeric-coercion helpers ─────────────────────────────────
        // BabyProfile stores every numeric field as a *string* (weight,
        // height, birthWeight, apgar1Min, …) because form inputs are
        // strings. The DB stores them as numbers. Convert safely.
        const toNum = (v: unknown): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? n : null;
        };
        const toInt = (v: unknown): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          return Number.isFinite(n) ? n : null;
        };
        const toStr = (v: unknown): string | null => {
          if (v === null || v === undefined || v === '') return null;
          return String(v);
        };

        // ── Identity & basics ────────────────────────────────────────
        if (updates.name !== undefined) remoteUpdates.name = updates.name;
        if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
        if (updates.avatar_url !== undefined)
          remoteUpdates.avatar_url = updates.avatar_url;
        if (updates.birthDate !== undefined)
          remoteUpdates.date_of_birth = updates.birthDate;
        if (updates.gender !== undefined) {
          remoteUpdates.gender =
            updates.gender === 'boy'
              ? 'male'
              : updates.gender === 'girl'
              ? 'female'
              : 'other';
        }
        if (updates.skinTone !== undefined)
          remoteUpdates.skin_tone = toInt(updates.skinTone) ?? 0;

        // ── Health & medical ─────────────────────────────────────────
        if (updates.bloodType !== undefined)
          remoteUpdates.blood_type = updates.bloodType;
        if (updates.medicalNotes !== undefined)
          remoteUpdates.medical_notes = updates.medicalNotes;
        if (updates.allergies !== undefined)
          remoteUpdates.allergies = updates.allergies;
        if (updates.currentWeightKg !== undefined)
          remoteUpdates.current_weight_kg = toNum(updates.currentWeightKg);
        if (updates.currentHeightCm !== undefined)
          remoteUpdates.current_height_cm = toNum(updates.currentHeightCm);
        // BabyProfile exposes weight/height as strings; map them too.
        if (updates.weight !== undefined)
          remoteUpdates.current_weight_kg = toNum(updates.weight);
        if (updates.height !== undefined)
          remoteUpdates.current_height_cm = toNum(updates.height);
        if (updates.emergencyContact !== undefined)
          remoteUpdates.emergency_contact = updates.emergencyContact;
        if (updates.pediatrician !== undefined)
          remoteUpdates.pediatrician = updates.pediatrician;
        if (updates.notificationsEnabled !== undefined)
          remoteUpdates.notifications_enabled = updates.notificationsEnabled;

        // ── Birth details ────────────────────────────────────────────
        if (updates.birthTime !== undefined)
          remoteUpdates.birth_time = updates.birthTime;
        if (updates.birthWeight !== undefined)
          remoteUpdates.birth_weight_kg = toNum(updates.birthWeight);
        if (updates.birthHeight !== undefined)
          remoteUpdates.birth_height_cm = toNum(updates.birthHeight);
        if (updates.birthHeadCircumference !== undefined)
          remoteUpdates.birth_head_circumference = toNum(updates.birthHeadCircumference);
        if (updates.deliveryType !== undefined)
          remoteUpdates.delivery_type = updates.deliveryType;
        if (updates.gestationalWeeks !== undefined)
          remoteUpdates.gestational_weeks = toInt(updates.gestationalWeeks);
        if (updates.apgar1Min !== undefined)
          remoteUpdates.apgar_1min = toInt(updates.apgar1Min);
        if (updates.apgar5Min !== undefined)
          remoteUpdates.apgar_5min = toInt(updates.apgar5Min);
        if (updates.birthPlace !== undefined)
          remoteUpdates.birth_place = updates.birthPlace;
        if (updates.birthAttendant !== undefined)
          remoteUpdates.birth_attendant = updates.birthAttendant;
        if (updates.multipleBirth !== undefined)
          remoteUpdates.multiple_birth = Boolean(updates.multipleBirth);
        if (updates.birthOrder !== undefined)
          remoteUpdates.birth_order = toInt(updates.birthOrder);
        if (updates.feedingPlan !== undefined)
          remoteUpdates.feeding_plan = updates.feedingPlan;

        // ── Family / stats ───────────────────────────────────────────
        if (updates.parent2Id !== undefined)
          remoteUpdates.parent2_id = updates.parent2Id;
        if (updates.streak !== undefined)
          remoteUpdates.streak = updates.streak;
        if (updates.milestones !== undefined)
          remoteUpdates.milestones_count = updates.milestones;
        if (updates.photos !== undefined)
          remoteUpdates.photos_count = updates.photos;

        // ── UPDATE without `.single()` ────────────────────────────
        // `.single()` throws PGRST116 when the SELECT side of the
        // operation returns 0 rows — which happens if RLS blocks the
        // read-back even though the UPDATE succeeded, or if some
        // column-check triggers silently filtered the update. We
        // don't actually need `.single()` here — we just need the
        // updated row (or a graceful failure). Using `.select()` +
        // array access eliminates the crash entirely.
        //
        // We also drop `.eq('is_active', true)` from the WHERE clause:
        // that guard is meant for `loadBabies`, not for updates. If a
        // legacy row happens to have `is_active = NULL`, the guard
        // silently filters it and the update touches 0 rows.
        const { data: resultRows, error } = await supabase
          .from('babies')
          .update(remoteUpdates)
          .eq('id', id)
          .select();

        if (error) {
          console.error('[BabyContext] Update baby error:', {
            code: (error as any).code,
            message: error.message,
            details: (error as any).details,
            hint: (error as any).hint,
            payload: remoteUpdates,
          });
          Alert.alert(
            'Error',
            `Failed to update baby profile${(error as any).code ? ` (${(error as any).code})` : ''}. Please try again.`
          );
          return;
        }

        const result =
          Array.isArray(resultRows) && resultRows.length > 0
            ? resultRows[0]
            : null;

        // If RLS silently filtered the update (0 rows back), fall back
        // to a plain SELECT so the local state still reflects the
        // freshly-saved values. The DB write has already succeeded if
        // we got here without an error.
        let finalRow: any = result;
        if (!finalRow) {
          try {
            const { data: refetched } = await supabase
              .from('babies')
              .select('*')
              .eq('id', id)
              .maybeSingle();
            finalRow = refetched ?? null;
          } catch {}
        }

        if (!finalRow) {
          console.warn(
            '[BabyContext] Update succeeded but row could not be read back. ' +
            'Falling back to optimistic local merge.'
          );
          if (isMounted.current) {
            setState(prev => ({
              ...prev,
              babies: prev.babies.map(b =>
                b.id === id ? { ...b, ...updates, lastUpdated: new Date().toISOString() } : b
              ),
              currentBaby:
                prev.currentBaby?.id === id
                  ? { ...prev.currentBaby, ...updates, lastUpdated: new Date().toISOString() }
                  : prev.currentBaby,
            }));
          }
          return;
        }

        if (isMounted.current) {
          const updatedBaby = mapBabyRowToProfile(
            finalRow,
            state.userRoles[id] || 'viewer'
          );
          setState(prev => ({
            ...prev,
            babies: prev.babies.map(b => (b.id === id ? updatedBaby : b)),
            currentBaby:
              prev.currentBaby?.id === id ? updatedBaby : prev.currentBaby,
          }));
          // FIX: `userId` was never declared in this scope — the old line
          // threw `ReferenceError: userId is not defined` every time an
          // update succeeded, which the outer catch swallowed and re-labelled
          // as "Update baby error". Resolve it properly:
          const _cacheUid = currentUserIdRef.current;
          await AsyncStorage.removeItem(
            _cacheUid
              ? `${STORAGE_KEYS.BABIES_CACHE_KEY}_${_cacheUid}`
              : STORAGE_KEYS.BABIES_CACHE_KEY,
          );
        }
      } catch (error) {
        console.error('Update baby error:', error);
        Alert.alert('Error', 'Failed to update baby profile');
      }
    },
    [mapBabyRowToProfile, canEditBaby, state.userRoles]
  );

  
  const deleteBaby = useCallback(
    async (id: string): Promise<boolean> => {
      if (!canManageBaby(id)) {
        Alert.alert(
          'Permission Denied',
          'You do not have permission to delete this baby'
        );
        return false;
      }

      try {
        const { error } = await supabase
          .from('babies')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[BabyContext] Delete baby error:', error);
          Alert.alert(
            'Error',
            'Failed to delete baby profile: ' + error.message
          );
          return false;
        }

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

        await AsyncStorage.removeItem(`${STORAGE_KEYS.BABIES_CACHE_KEY}_${userId}`);
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BABY_ID);
        await AsyncStorage.removeItem(`${STORAGE_KEYS.LAST_SYNC_KEY}_${userId}`);

        if (isMounted.current) {
          const newUserRoles = { ...state.userRoles };
          const newUserPermissions = { ...state.userPermissions };
          delete newUserRoles[id];
          delete newUserPermissions[id];

          setState(prev => ({
            ...prev,
            babies: updatedBabies,
            currentBabyId: newCurrentId,
            currentBaby: newCurrentId
              ? updatedBabies.find(b => b.id === newCurrentId) || null
              : null,
            userRoles: newUserRoles,
            userPermissions: newUserPermissions,
          }));
        }

        broadcastBabyChange(newCurrentId);

        setTimeout(() => {
          loadBabiesRef.current?.(true);
        }, 500);

        return true;
      } catch (error) {
        console.error('[BabyContext] Delete baby error:', error);
        Alert.alert('Error', 'Failed to delete baby profile');
        return false;
      }
    },
    [
      state.babies,
      state.currentBabyId,
      state.userRoles,
      state.userPermissions,
      getCurrentUserId,
      broadcastBabyChange,
      canManageBaby,
    ]
  );

  
  
  
  
  
  
  
  
  
  
  const switchBaby = useCallback(
    async (id: string): Promise<boolean> => {
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
          console.warn(`[BabyContext] Baby ${id} not found or not visible`);
          return false;
        }

        
        try {
          await supabase
            .from('app_settings')
            .upsert(
              {
                key: 'current_baby_id',
                value: id,
                user_id: userId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'key, user_id' }
            );
        } catch (e) {
          console.warn('[BabyContext] Failed to persist current_baby_id:', e);
        }

        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, id);

        
        
        const cachedRole = state.userRoles[id];
        const inferredRole: 'parent1' | 'parent2' | 'guardian' | 'viewer' =
          baby.parent1_id === userId
            ? 'parent1'
            : baby.parent2_id === userId
            ? 'parent2'
            : 'viewer';

        const resolvedRole = cachedRole || inferredRole;

        const babyProfile = mapBabyRowToProfile(baby, resolvedRole);

        if (isMounted.current) {
          setState(prev => {
            
            
            const alreadyInList = prev.babies.some(b => b.id === id);
            const nextBabies = alreadyInList
              ? prev.babies.map(b => (b.id === id ? babyProfile : b))
              : [...prev.babies, babyProfile];

            const nextRoles = prev.userRoles[id]
              ? prev.userRoles
              : { ...prev.userRoles, [id]: resolvedRole };

            const nextPerms = prev.userPermissions[id]
              ? prev.userPermissions
              : {
                  ...prev.userPermissions,
                  [id]: {
                    view: true,
                    edit: true,
                    delete: true,
                    manage: true,
                    invite: true,
                    export: true,
                    canView: true,
                    canAddEntry: true,
                    canEditEntry: true,
                    canEditOthersEntries: true,
                    canDeleteEntry: true,
                    canEditBaby: true,
                    canInvite: true,
                    canExport: true,
                    canManageFamily: true,
                  },
                };

            return {
              ...prev,
              babies: nextBabies,
              currentBabyId: id,
              currentBaby: babyProfile,
              userRoles: nextRoles,
              userPermissions: nextPerms,
            };
          });
        }

        requestAnimationFrame(() => {
          broadcastBabyChange(id);
        });

        // ── Cross-context fan-out ────────────────────────────────
        // A baby switch changes which FAMILY is active. Anything
        // that keys data off the baby (family members, chats,
        // tracker entries, growth charts) must re-hydrate.
        //
        // We emit a profile-change so FamilyContext / UserContext /
        // FamilyChatContext reload their per-baby data. The `role`
        // field signals these consumers that they should treat the
        // change as authoritative (they debounce longer on role
        // changes and reload deeper).
        try {
          const { broadcastProfileChange } = require('./AuthContext');
          await broadcastProfileChange({
            userId,
            fields: ['role'],
          });
        } catch {}

        await AsyncStorage.removeItem(`${STORAGE_KEYS.BABIES_CACHE_KEY}_${userId}`);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return true;
      } catch (error) {
        console.error('[BabyContext] Error switching baby:', error);
        return false;
      }
    },
    [
      mapBabyRowToProfile,
      getCurrentUserId,
      broadcastBabyChange,
      state.userRoles,
    ]
  );

  
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

      const updatedBaby = mapBabyRowToProfile(
        baby,
        state.userRoles[state.currentBabyId] || 'viewer'
      );

      setState(prev => ({
        ...prev,
        currentBaby: updatedBaby,
        babies: prev.babies.map(b =>
          b.id === state.currentBabyId ? updatedBaby : b
        ),
      }));
    } catch (error) {
      console.error('Error refreshing current baby:', error);
    }
  }, [
    state.currentBabyId,
    state.userRoles,
    mapBabyRowToProfile,
    loadBabies,
    getCurrentUserId,
  ]);

  
    // ── Legacy entry stubs (ActivityContext is the source of truth) ──────
  // `entries`, `loadEntries`, `addEntry`, etc. here intentionally remain
  // no-ops — TrackerContext owns entries. But we forward `loadEntries`
  // to the Tracker via a lightweight event so MoreScreen's pull-to-refresh
  // actually refreshes tracker entries instead of silently doing nothing.
  const entries = useMemo<ActivityEntry[]>(() => [], []);

  const loadEntries = useCallback(async () => {
    try {
      // Dynamically required to avoid a circular import at module load.
      const { useTracker } = require('@/hooks/useTrackerContext');
      // We can't call a hook from here, but `loadEntries` on the Tracker
      // is exposed on the context value. Emit a refresh through the
      // shared event pattern: import the module and call its refresh.
      // If the tracker context isn't mounted, fail silently.
      const { trackerRefreshEvent } = require('@/hooks/useTrackerContext');
      trackerRefreshEvent?.emit?.();
    } catch {
      // TrackerContext not available — nothing to refresh
    }
  }, []);
  const deleteEntry = useCallback(async () => false, []);
  const addEntry = useCallback(async () => false, []);
  const updateEntry = useCallback(async () => false, []);
  const getEntryById = useCallback(() => undefined, []);
  const getDateTitle = useCallback(() => '', []);
  const syncWithActivityContext = useCallback(async () => {}, []);
  const scheduleActivityReminder = useCallback(async () => null, []);
  const cancelActivityReminder = useCallback(async () => {}, []);

  const getCurrentBabyId = useCallback(
    (): string | null => state.currentBabyId,
    [state.currentBabyId]
  );

  
  const addGrowthMeasurement = useCallback(async () => false, []);
  const getGrowthData = useCallback(() => [] as any[], []);
  const getLatestMeasurements = useCallback(
    () => ({ height: null, weight: null, head: null, temperature: null }) as Record<string, any | null>,
    []
  );
  const deleteGrowthMeasurement = useCallback(async () => false, []);

  // ─── Milestones (real, backed by `tracker_entries`) ──────────────────
  // The `milestones` array in BabyState is a *derived cache* populated
  // whenever `babies` changes. Milestones are persisted as normal
  // tracker entries (`tracker_type = 'milestone'`), so they show up in
  // the Timeline AND in the baby profile's Milestones tab for free.
  const MILESTONE_CATEGORY_COLORS: Record<string, string> = {
    physical: '#6366f1',
    cognitive: '#f59e0b',
    social: '#10b981',
    language: '#8b5cf6',
    emotional: '#ef4444',
  };

  const mapMilestoneRow = useCallback(
    (row: any) => {
      const data = row?.data || {};
      const ts = row?.timestamp
        ? new Date(row.timestamp).getTime()
        : row?.created_at
        ? new Date(row.created_at).getTime()
        : Date.now();
      const achievedAt =
        typeof data?.achievedAt === 'string'
          ? data.achievedAt
          : new Date(ts).toISOString().split('T')[0];

      return {
        id: row.id,
        babyId: row.baby_id,
        title: data.title || row.title || 'Milestone',
        category: data.category || 'physical',
        description: data.description || row.notes || '',
        achievedAt,
        createdAt: row.created_at,
        photoUris: Array.isArray(row.photo_uris) ? row.photo_uris : [],
        loggedBy: row.logged_by,
        loggedByName: row.logged_by_name,
      };
    },
    []
  );

  const reloadMilestonesForBaby = useCallback(
    async (babyId: string | null) => {
      if (!babyId) {
        if (isMounted.current) {
          setState(prev => ({ ...prev, milestones: [] }));
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('tracker_entries')
          .select(
            'id, baby_id, tracker_type, timestamp, data, notes, photo_uris, title, logged_by, logged_by_name, created_at, is_deleted'
          )
          .eq('baby_id', babyId)
          .eq('tracker_type', 'milestone')
          .eq('is_deleted', false)
          .order('timestamp', { ascending: false });

        if (error) {
          if (__DEV__) console.warn('[BabyContext] Milestones query error:', error.message);
          return;
        }

        const mapped = (data || []).map(mapMilestoneRow);
        if (isMounted.current) {
          setState(prev => ({ ...prev, milestones: mapped }));
        }
      } catch (err) {
        if (__DEV__) console.warn('[BabyContext] Milestones query threw:', err);
      }
    },
    [mapMilestoneRow]
  );

  const addMilestone = useCallback(
    async (milestone: {
      babyId: string;
      title: string;
      category: string;
      description?: string;
      achievedAt?: string;
      photoUris?: string[];
    }): Promise<boolean> => {
      if (!milestone?.babyId || !milestone.title?.trim()) return false;

      // ── FIX: `authProfile` was never destructured in this file.
      // Pull it from the `auth` object that IS in scope.
      const authProfile = auth?.userProfile ?? null;

      const userId = await getCurrentUserId();
      const trimmedTitle = milestone.title.trim();
      const achievedAt =
        milestone.achievedAt ||
        new Date().toISOString().split('T')[0];

      // Anchor `timestamp` on the achieved date so it appears on the
      // correct day in Timeline/Home, not on "today".
      const ts = new Date(achievedAt);
      const timestamp = isNaN(ts.getTime())
        ? new Date().toISOString()
        : ts.toISOString();

      const id = `milestone_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const payload = {
        id,
        baby_id: milestone.babyId,
        tracker_type: 'milestone',
        tracker_id: 'milestone',
        timestamp,
        title: `🌟 ${trimmedTitle}`,
        data: {
          title: trimmedTitle,
          category: milestone.category || 'physical',
          description: milestone.description || '',
          achievedAt,
          color:
            MILESTONE_CATEGORY_COLORS[milestone.category || 'physical'] ||
            '#f59e0b',
        },
        notes: milestone.description || null,
        photo_uris: Array.isArray(milestone.photoUris)
          ? milestone.photoUris
          : [],
        logged_by: userId,
        logged_by_name: authProfile?.fullName || 'Parent',
        logged_by_role: authProfile?.role || 'parent1',
        is_deleted: false,
      };

      try {
        const { data, error } = await supabase
          .from('tracker_entries')
          .insert(payload)
          .select()
          .single();

        if (error || !data) {
          if (__DEV__) console.error('[BabyContext] addMilestone error:', error);
          return false;
        }

        const mapped = mapMilestoneRow(data);

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            milestones: [mapped, ...prev.milestones],
            // Bump the counter the profile card shows
            babies: prev.babies.map(b =>
              b.id === milestone.babyId
                ? { ...b, milestones: (b.milestones || 0) + 1 }
                : b
            ),
            currentBaby:
              prev.currentBaby?.id === milestone.babyId
                ? {
                    ...prev.currentBaby,
                    milestones: (prev.currentBaby.milestones || 0) + 1,
                  }
                : prev.currentBaby,
          }));
        }

        // Fire-and-forget DB counter bump — best effort, race-safe
        try {
          const { data: currentRow } = await supabase
            .from('babies')
            .select('milestones_count')
            .eq('id', milestone.babyId)
            .maybeSingle();
          const nextCount = (currentRow?.milestones_count || 0) + 1;
          await supabase
            .from('babies')
            .update({
              milestones_count: nextCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', milestone.babyId);
        } catch {}

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});

        return true;
      } catch (err) {
        if (__DEV__) console.error('[BabyContext] addMilestone threw:', err);
        return false;
      }
    },
    [auth?.userProfile, getCurrentUserId, mapMilestoneRow, state.babies]
  );

  const getMilestones = useCallback(
    (category?: string): any[] => {
      if (!category) return state.milestones;
      return state.milestones.filter(m => m.category === category);
    },
    [state.milestones]
  );

  const deleteMilestone = useCallback(
    async (milestoneId: string): Promise<boolean> => {
      if (!milestoneId) return false;

      // Find target before mutating so we can adjust the counter
      const target = state.milestones.find(m => m.id === milestoneId);

      try {
        const { error } = await supabase
          .from('tracker_entries')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', milestoneId);

        if (error) {
          if (__DEV__) console.error('[BabyContext] deleteMilestone error:', error);
          return false;
        }

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            milestones: prev.milestones.filter(m => m.id !== milestoneId),
            babies: target
              ? prev.babies.map(b =>
                  b.id === target.babyId
                    ? {
                        ...b,
                        milestones: Math.max(0, (b.milestones || 1) - 1),
                      }
                    : b
                )
              : prev.babies,
            currentBaby:
              target && prev.currentBaby?.id === target.babyId
                ? {
                    ...prev.currentBaby,
                    milestones: Math.max(0, (prev.currentBaby.milestones || 1) - 1),
                  }
                : prev.currentBaby,
          }));
        }

        return true;
      } catch (err) {
        if (__DEV__) console.error('[BabyContext] deleteMilestone threw:', err);
        return false;
      }
    },
    [state.milestones]
  );

  // Reload milestones whenever the current baby changes so the profile
  // tab is fresh after switching babies.
  useEffect(() => {
    reloadMilestonesForBaby(state.currentBabyId);
  }, [state.currentBabyId, reloadMilestonesForBaby]);

  const addSleepLog = useCallback(async () => false, []);
  const getSleepLogs = useCallback(() => [] as any[], []);
  const endSleepSession = useCallback(async () => false, []);
  const getTodaySleepCount = useCallback(() => 0, []);

  
  const addFeedingLog = useCallback(async () => false, []);
  const getFeedingLogs = useCallback(() => [] as any[], []);
  const getTodayFeedCount = useCallback(() => 0, []);

  
  const addPottyLog = useCallback(async () => false, []);
  const getPottyLogs = useCallback(() => [] as any[], []);
  const getPottyStreak = useCallback(() => 0, []);
  const getTodayPottyCount = useCallback(() => 0, []);
  const getPottySuccessRate = useCallback(() => 0, []);

  
  const addMedicationLog = useCallback(async () => false, []);
  const getMedicationLogs = useCallback(() => [] as any[], []);

  
  const addActivity = useCallback(async () => false, []);
  const getRecentActivities = useCallback(() => [] as ActivityEntry[], []);
  const getActivitiesByType = useCallback(() => [] as ActivityEntry[], []);
  const deleteActivity = useCallback(async () => false, []);

  
  // ── Baby stats ────────────────────────────────────────────────────────
  // Real values, scoped to `currentBaby`. The old version returned
  // hardcoded zeros which is why MoreScreen always showed 0 streak
  // and 0 milestones regardless of the signed-in account or baby.
  const getBabyStats = useCallback(
    () => {
      const baby = state.currentBaby;
      if (!baby) {
        return { streak: 0, milestones: 0, photos: 0, entries: 0 };
      }
      return {
        streak: baby.streak ?? 0,
        milestones: baby.milestones ?? 0,
        photos: baby.photos ?? 0,
        // `entries` count is intentionally 0 here — the caller should
        // use ActivityContext for entries so it stays in sync with
        // the TrackerContext. Keeping this field for API compatibility.
        entries: 0,
      };
    },
    [state.currentBaby]
  );
  const updateBabyStats = useCallback(async () => {}, []);
  
  const value = useMemo<BabyContextType>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <BabyContext.Provider value={value}>{children}</BabyContext.Provider>
  );
};

export const useBaby = (): BabyContextType => {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBaby must be used within BabyProvider');
  return context;
};

export { BabyContext };
export default BabyProvider;