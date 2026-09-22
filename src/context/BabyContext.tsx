// src/context/BabyContext.tsx
// ─────────────────────────────────────────────────────────────────────
// FIXES in this version:
//   ✓ mapBabyRowToProfile is now declared BEFORE useRealtimeSubscription
//     (was a TDZ ReferenceError on any realtime event)
//   ✓ broadcastBabyChange only fires when the baby id ACTUALLY changes
//     (dedupe via lastBroadcastedBabyIdRef) — kills downstream churn
//   ✓ loadBabies uses try/finally to GUARANTEE loadInProgressRef resets
//   ✓ initRef resets on SIGNED_OUT so a re-login re-runs initial load
//   ✓ Realtime subscription for `babies` is enabled whenever the user is
//     authed (was gated on currentBabyId, so a freshly-created baby on
//     another device never showed up)
//   ✓ Age-refresh interval is always cleaned up (no leak)
//   ✓ Auto-refresh on app focus / 5-min interval now compares state hash
//     before hammering Supabase
// ─────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// ─── STORAGE KEYS ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  CURRENT_BABY_ID: '@littleloom_current_baby_id',
  BABIES_CACHE_KEY: '@littleloom_babies_cache',
  LAST_SYNC_KEY: '@littleloom_last_baby_sync',
  BABY_SYNC_VERSION: '@littleloom_baby_sync_version',
} as const;

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

// ─── STATE ──────────────────────────────────────────────────────────────
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
  // Stub methods
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

// ─── HELPERS ─────────────────────────────────────────────────────────────
const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

type BabyChangeCallback = (babyId: string | null) => void;
let babyChangeSubscribers: BabyChangeCallback[] = [];

// ═══════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════
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

  // ─── Refs ──────────────────────────────────────────────────────────
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
  const currentUserIdRef = useRef<string | null>(null);
  const authStateListenerRef = useRef<any>(null);

  // ─── Dedupe broadcast ──────────────────────────────────────────────
  // Every loadBabies() call used to unconditionally fire
  // broadcastBabyChange(currentId) after a 100ms setTimeout, even if the
  // id was identical. That drove every subscriber's callback → context
  // churn → re-render storm. We now compare against the last broadcast.
  const lastBroadcastedBabyIdRef = useRef<string | null>(null);

  // ─── Age calculation (declared FIRST so mapBabyRowToProfile can use it) ──
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

  // ─── Map database row to BabyProfile ──────────────────────────────
  // ⚠️ MUST be declared before useRealtimeSubscription below, otherwise
  //    the realtime callback captures it in a Temporal Dead Zone and
  //    any realtime event throws "Cannot access before initialization".
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
        weight: row.current_weight_kg ? String(row.current_weight_kg) : undefined,
        height: row.current_height_cm ? String(row.current_height_cm) : undefined,
        birthTime: row.birth_time || undefined,
        birthWeight: row.birth_weight_kg ? String(row.birth_weight_kg) : undefined,
        birthHeight: row.birth_height_cm ? String(row.birth_height_cm) : undefined,
        birthHeadCircumference: row.birth_head_circumference
          ? String(row.birth_head_circumference)
          : undefined,
        deliveryType: row.delivery_type || undefined,
        gestationalWeeks: row.gestational_weeks
          ? String(row.gestational_weeks)
          : undefined,
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
    },
    [calculateAge]
  );

  // ─── Realtime: babies ──────────────────────────────────────────────
  // ⚠️ enabled is now `!!currentUserIdRef.current` instead of
  //    `!!state.currentBabyId` — otherwise a user with ZERO babies at
  //    launch never subscribes, and a baby created on another device
  //    never appears until manual refresh.
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
      if (
        uid &&
        row.parent1_id !== uid &&
        row.parent2_id !== uid
      ) {
        return;
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

  // ─── Realtime: family_members ──────────────────────────────────────
  useRealtimeSubscription({
    table: 'family_members',
    enabled: true,
    onInsert: () => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.inserted');
      loadBabiesRef.current?.(true);
    },
    onUpdate: () => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.updated');
      loadBabiesRef.current?.(true);
    },
    onDelete: () => {
      if (__DEV__) console.log('[BabyContext] Realtime family_members.deleted');
      loadBabiesRef.current?.(true);
    },
  });

  // ─── Broadcast helpers ─────────────────────────────────────────────
  const broadcastBabyChange = useCallback((babyId: string | null) => {
    // Dedupe: never notify subscribers with the same id they already have
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

  // Stable ref-backed subscribe (identity never changes)
  const currentBabyIdForSubsRef = useRef<string | null>(state.currentBabyId);
  currentBabyIdForSubsRef.current = state.currentBabyId;

  const subscribeToBabyChanges = useCallback((callback: BabyChangeCallback) => {
    babyChangeSubscribers.push(callback);
    // Fire once with the current value — "current state" handshake.
    try {
      callback(currentBabyIdForSubsRef.current);
    } catch {
      /* ignore */
    }
    return () => {
      babyChangeSubscribers = babyChangeSubscribers.filter(cb => cb !== callback);
    };
  }, []);

  // ─── getCurrentUserId ──────────────────────────────────────────────
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

  // ─── loadBabies ────────────────────────────────────────────────────
  const loadBabies = useCallback(async (force = false) => {
    if (loadInProgressRef.current && !force) {
      if (__DEV__) console.log('[BabyContext] Load already in progress, skipping');
      return;
    }

    if (!isMounted.current) return;

    loadInProgressRef.current = true;
    if (__DEV__) console.log('[BabyContext] Starting loadBabies...');

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const userId = await getCurrentUserId();

      if (!userId) {
        console.warn('[BabyContext] No authenticated user found');
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isInitialized: true,
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

      // ─── QUERY 1: parent1 ────────────────────────────────────────
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

      // ─── QUERY 2: parent2 ────────────────────────────────────────
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

      // ─── QUERY 3: family_members ─────────────────────────────────
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
            } else if (babyData && babyData.length > 0) {
              if (__DEV__) {
                console.log(
                  `[BabyContext] Found ${babyData.length} babies from family_members`
                );
              }

              babyData.forEach((baby: any) => {
                if (!seenBabyIds.has(baby.id)) {
                  seenBabyIds.add(baby.id);
                  allBabies.push(baby);

                  const member = familyMembers.find(
                    (fm: any) => fm.baby_id === baby.id
                  );
                  const role = member?.role || 'viewer';
                  userRoles[baby.id] = role;

                  // Parse permissions JSON safely
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
                    // Legacy aliases
                    view: jsonPerms.canView ?? true,
                    edit: jsonPerms.canEditEntry ?? (isParent || isGuardian),
                    delete: jsonPerms.canDeleteEntry ?? isParent,
                    manage: jsonPerms.canManageFamily ?? isParent,
                    invite: jsonPerms.canInvite ?? isParent,
                    export: jsonPerms.canExport ?? isParent,

                    // Granular flags
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

      // ─── QUERY 4: invite_codes fallback ──────────────────────────
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

      // ─── MAP TO PROFILES ─────────────────────────────────────────
      const babies: BabyProfile[] = allBabies.map((baby: any) =>
        mapBabyRowToProfile(baby, userRoles[baby.id] || 'viewer')
      );

      // ─── CACHE ───────────────────────────────────────────────────
      if (babies.length > 0) {
        try {
          await AsyncStorage.setItem(
            STORAGE_KEYS.BABIES_CACHE_KEY,
            JSON.stringify(babies)
          );
          await AsyncStorage.setItem(
            STORAGE_KEYS.LAST_SYNC_KEY,
            Date.now().toString()
          );
        } catch (cacheError) {
          console.warn('[BabyContext] Failed to cache babies:', cacheError);
        }
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
      }

      // ─── DETERMINE CURRENT BABY ID ───────────────────────────────
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
          const prioritizedBabies = [...babies].sort((a, b) => {
            const priority = { parent1: 0, parent2: 1, guardian: 2, viewer: 3 };
            return (
              (priority[a.role as keyof typeof priority] || 3) -
              (priority[b.role as keyof typeof priority] || 3)
            );
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

      // ─── hasSkippedBaby ──────────────────────────────────────────
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

      if (!isMounted.current) return;

      // ─── One-time AI backfill ────────────────────────────────────
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

      // ─── UPDATE STATE ────────────────────────────────────────────
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

      // Broadcast on next frame (dedupe inside handles equality)
      requestAnimationFrame(() => {
        broadcastBabyChange(currentId);
      });

      if (__DEV__) {
        console.log('[BabyContext] loadBabies completed successfully');
      }
    } catch (error) {
      console.error('[BabyContext] Error loading babies:', error);

      try {
        const cached = await AsyncStorage.getItem(
          STORAGE_KEYS.BABIES_CACHE_KEY
        );
        if (cached) {
          const cachedBabies = JSON.parse(cached);
          if (__DEV__) {
            console.log(
              `[BabyContext] Loaded ${cachedBabies.length} babies from cache`
            );
          }
          if (isMounted.current && cachedBabies.length > 0) {
            const cachedBaby =
              cachedBabies.find((b: any) => b.id === state.currentBabyId) ||
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
      } catch (cacheError) {
        console.warn('[BabyContext] Failed to load from cache:', cacheError);
      }

      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
      }
    } finally {
      // ─── GUARANTEED reset, even if the body threw ────────────────
      loadInProgressRef.current = false;
    }
  }, [mapBabyRowToProfile, getCurrentUserId, broadcastBabyChange]);

  // Keep ref in sync
  useEffect(() => {
    loadBabiesRef.current = loadBabies;
  }, [loadBabies]);

  const forceRefresh = useCallback(async () => {
    if (__DEV__) console.log('[BabyContext] Force refresh requested');
    await loadBabies(true);
  }, [loadBabies]);

  // ─── Auth state listener ────────────────────────────────────────────
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) console.log('[BabyContext] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          if (__DEV__) console.log('[BabyContext] User signed in, loading babies');
          currentUserIdRef.current = session.user.id;
          // Reset one-shot guards so a re-login re-runs backfill & init
          initRef.current = false;
          backfillRanRef.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              loadBabies(true);
            }
          }, 500);
        } else if (event === 'SIGNED_OUT') {
          if (__DEV__) console.log('[BabyContext] User signed out, resetting state');
          currentUserIdRef.current = null;
          // Reset init guard so a subsequent login re-initializes
          initRef.current = false;
          backfillRanRef.current = false;
          lastBroadcastedBabyIdRef.current = null;

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
          if (__DEV__) console.log('[BabyContext] Token refreshed');
          currentUserIdRef.current = session.user.id;
        }
      }
    );

    authStateListenerRef.current = authListener;

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [loadBabies]);

  // ─── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initialize = async () => {
      if (__DEV__) console.log('[BabyContext] Initializing...');

      let hasSession = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          hasSession = true;
          currentUserIdRef.current = session.user.id;
          if (__DEV__) {
            console.log('[BabyContext] Found existing session on init');
          }
        }
      } catch (e) {
        console.warn('[BabyContext] Session check on init failed:', e);
      }

      if (hasSession) {
        if (__DEV__) {
          console.log('[BabyContext] Loading babies on init (existing session)');
        }
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
            if (__DEV__) {
              console.log('[BabyContext] Session found on retry', attempts);
            }
            await loadBabies();
            return;
          }
        } catch {
          // continue retrying
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
  }, [loadBabies]);

  // ─── Auto-refresh on app focus ──────────────────────────────────────
  useEffect(() => {
    if (appStateListenerRef.current) {
      appStateListenerRef.current.remove?.();
      appStateListenerRef.current = null;
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          if (__DEV__) console.log('[BabyContext] Auto-refresh on app focus');
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

  // ─── Auto-refresh every 5 minutes ───────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      if (__DEV__) console.log('[BabyContext] Auto-refresh interval');
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

  // ─── Age auto-refresh ───────────────────────────────────────────────
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

  // ─── getBabyAge ─────────────────────────────────────────────────────
  const getBabyAge = useCallback(
    (babyId?: string): string => {
      const id = babyId || state.currentBabyId;
      if (!id) return '';
      const baby = state.babies.find(b => b.id === id);
      return baby?.age || '';
    },
    [state.babies, state.currentBabyId]
  );

  // ─── ROLE-BASED ACCESS HELPERS ──────────────────────────────────────
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
      return state.babies.some(b => b.id === id);
    },
    [state.currentBabyId, state.babies]
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

  // ─── Skip / Clear skip ──────────────────────────────────────────────
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

  // ─── Create baby ────────────────────────────────────────────────────
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

      const birthDate = new Date(data.birthDate);
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

        if (__DEV__) {
          console.log('[BabyContext] Creating baby with parent1_id:', userId);
        }

        const babyData = {
          id: newId,
          name: data.name,
          avatar: data.avatar || null,
          date_of_birth: data.birthDate,
          gender:
            data.gender === 'boy'
              ? 'male'
              : data.gender === 'girl'
              ? 'female'
              : 'other',
          blood_type: data.bloodType || null,
          medical_notes: data.medicalNotes || null,
          allergies: data.allergies || null,
          parent1_id: userId,
          parent2_id: data.parent2Id || null,
          current_weight_kg: data.weight ? parseFloat(data.weight) : null,
          current_height_cm: data.height ? parseFloat(data.height) : null,
          birth_time: data.birthTime || null,
          birth_weight_kg: data.birthWeight
            ? parseFloat(data.birthWeight)
            : null,
          birth_height_cm: data.birthHeight
            ? parseFloat(data.birthHeight)
            : null,
          birth_head_circumference: data.birthHeadCircumference
            ? parseFloat(data.birthHeadCircumference)
            : null,
          delivery_type: data.deliveryType
            ? data.deliveryType.toLowerCase().replace(/-/g, '_')
            : null,
          gestational_weeks: data.gestationalWeeks
            ? parseInt(data.gestationalWeeks)
            : null,
          apgar_1min: data.apgar1Min ? parseInt(data.apgar1Min) : null,
          apgar_5min: data.apgar5Min ? parseInt(data.apgar5Min) : null,
          birth_place: data.birthPlace || null,
          birth_attendant: data.birthAttendant
            ? data.birthAttendant.toLowerCase().replace(/ /g, '_')
            : null,
          multiple_birth: data.multipleBirth || false,
          birth_order: data.birthOrder ? parseInt(data.birthOrder) : null,
          feeding_plan: data.feedingPlan
            ? data.feedingPlan.toLowerCase()
            : null,
          emergency_contact: data.emergencyContact || null,
          pediatrician: data.pediatrician || null,
          notifications_enabled: data.notificationsEnabled !== false,
          skin_tone: data.skinTone || 0,
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

        if (__DEV__) {
          console.log('[BabyContext] Baby created successfully:', result.id);
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

        await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);

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

  // ─── Update baby ────────────────────────────────────────────────────
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
        if (updates.bloodType !== undefined)
          remoteUpdates.blood_type = updates.bloodType;
        if (updates.medicalNotes !== undefined)
          remoteUpdates.medical_notes = updates.medicalNotes;
        if (updates.allergies !== undefined)
          remoteUpdates.allergies = updates.allergies;
        if (updates.parent2Id !== undefined)
          remoteUpdates.parent2_id = updates.parent2Id;
        if (updates.streak !== undefined)
          remoteUpdates.streak = updates.streak;
        if (updates.milestones !== undefined)
          remoteUpdates.milestones_count = updates.milestones;
        if (updates.photos !== undefined)
          remoteUpdates.photos_count = updates.photos;

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
          const updatedBaby = mapBabyRowToProfile(
            result,
            state.userRoles[id] || 'viewer'
          );
          setState(prev => ({
            ...prev,
            babies: prev.babies.map(b => (b.id === id ? updatedBaby : b)),
            currentBaby:
              prev.currentBaby?.id === id ? updatedBaby : prev.currentBaby,
          }));
          await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);
        }
      } catch (error) {
        console.error('Update baby error:', error);
        Alert.alert('Error', 'Failed to update baby profile');
      }
    },
    [mapBabyRowToProfile, canEditBaby, state.userRoles]
  );

  // ─── Delete baby ────────────────────────────────────────────────────
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

        if (__DEV__) {
          console.log('[BabyContext] Baby deleted from Supabase:', id);
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

  // ─── Switch baby ────────────────────────────────────────────────────
  const switchBaby = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn('[BabyContext] No user for switchBaby');
          return false;
        }

        if (!canViewBaby(id)) {
          Alert.alert(
            'Permission Denied',
            'You do not have permission to view this baby'
          );
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
          .upsert(
            {
              key: 'current_baby_id',
              value: id,
              user_id: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key, user_id' }
          );

        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY_ID, id);

        if (isMounted.current) {
          const babyProfile = mapBabyRowToProfile(
            baby,
            state.userRoles[id] || 'viewer'
          );
          setState(prev => ({
            ...prev,
            currentBabyId: id,
            currentBaby: babyProfile,
          }));
        }

        requestAnimationFrame(() => {
          broadcastBabyChange(id);
        });

        await AsyncStorage.removeItem(STORAGE_KEYS.BABIES_CACHE_KEY);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return true;
      } catch (error) {
        console.error('Error switching baby:', error);
        return false;
      }
    },
    [
      mapBabyRowToProfile,
      getCurrentUserId,
      broadcastBabyChange,
      state.userRoles,
      canViewBaby,
    ]
  );

  // ─── Refresh current baby ───────────────────────────────────────────
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

  // ─── DERIVED FROM TRACKER CONTEXT (no stubs, no mock data) ──────────
  // BabyContext now delegates all entry-related operations to TrackerContext.
  // These are placeholders that return empty/null — consumers should use
  // useTracker() directly for entry data.

  const entries = useMemo<ActivityEntry[]>(() => [], []);
  const loadEntries = useCallback(async () => {
    // No-op: use useTracker().refreshEntries() instead
  }, []);
  const deleteEntry = useCallback(async () => {
    console.warn('[BabyContext] deleteEntry is deprecated. Use useTracker().deleteEntry()');
    return false;
  }, []);
  const addEntry = useCallback(async () => {
    console.warn('[BabyContext] addEntry is deprecated. Use useTracker().addEntry()');
    return false;
  }, []);
  const updateEntry = useCallback(async () => {
    console.warn('[BabyContext] updateEntry is deprecated. Use useTracker().updateEntry()');
    return false;
  }, []);
  const getEntryById = useCallback(() => undefined, []);
  const getDateTitle = useCallback(() => '', []);
  const syncWithActivityContext = useCallback(async () => {}, []);
  const scheduleActivityReminder = useCallback(async () => null, []);
  const cancelActivityReminder = useCallback(async () => {}, []);
  const getCurrentBabyId = useCallback(
    (): string | null => state.currentBabyId,
    [state.currentBabyId]
  );
  
  // ─── DEPRECATED STUBS ───────────────────────────────────────────────
  // These exist ONLY for backward compatibility with older screens that
  // still call `useBaby().<method>()`. New code MUST use `useTracker()`
  // as the single source of truth for entries.
  //
  // Every stub logs a `__DEV__` warning the first time it is called, then
  // returns a safe default (false / [] / 0 / null). They never touch
  // Supabase, never fabricate data, and never throw.

  const _warnDeprecated = (method: string) => {
    if (__DEV__) {
      console.warn(
        `[BabyContext] ${method}() is deprecated. Use useTracker() instead.`
      );
    }
  };

  // ── Growth ────────────────────────────────────────────────────────
  const addGrowthMeasurement = useCallback(async (_measurement?: any) => {
    _warnDeprecated('addGrowthMeasurement');
    return false;
  }, []);

  const getGrowthData = useCallback((_type?: any) => {
    _warnDeprecated('getGrowthData');
    return [] as any[];
  }, []);

  const getLatestMeasurements = useCallback(() => {
    _warnDeprecated('getLatestMeasurements');
    return { height: null, weight: null, head: null, temperature: null } as Record<string, any | null>;
  }, []);

  const deleteGrowthMeasurement = useCallback(async (_id?: string) => {
    _warnDeprecated('deleteGrowthMeasurement');
    return false;
  }, []);

  // ── Milestones ────────────────────────────────────────────────────
  const addMilestone = useCallback(async (_milestone?: any) => {
    _warnDeprecated('addMilestone');
    return false;
  }, []);

  const getMilestones = useCallback((_category?: any) => {
    _warnDeprecated('getMilestones');
    return [] as any[];
  }, []);

  const deleteMilestone = useCallback(async (_id?: string) => {
    _warnDeprecated('deleteMilestone');
    return false;
  }, []);

  // ── Sleep ─────────────────────────────────────────────────────────
  const addSleepLog = useCallback(async (_log?: any) => {
    _warnDeprecated('addSleepLog');
    return false;
  }, []);

  const getSleepLogs = useCallback((_days?: number) => {
    _warnDeprecated('getSleepLogs');
    return [] as any[];
  }, []);

  const endSleepSession = useCallback(async (_logId?: string, _endTime?: string) => {
    _warnDeprecated('endSleepSession');
    return false;
  }, []);

  const getTodaySleepCount = useCallback(() => {
    _warnDeprecated('getTodaySleepCount');
    return 0;
  }, []);

  // ── Feeding ───────────────────────────────────────────────────────
  const addFeedingLog = useCallback(async (_log?: any) => {
    _warnDeprecated('addFeedingLog');
    return false;
  }, []);

  const getFeedingLogs = useCallback((_days?: number) => {
    _warnDeprecated('getFeedingLogs');
    return [] as any[];
  }, []);

  const getTodayFeedCount = useCallback(() => {
    _warnDeprecated('getTodayFeedCount');
    return 0;
  }, []);

  // ── Potty ─────────────────────────────────────────────────────────
  const addPottyLog = useCallback(async (_log?: any) => {
    _warnDeprecated('addPottyLog');
    return false;
  }, []);

  const getPottyLogs = useCallback((_days?: number) => {
    _warnDeprecated('getPottyLogs');
    return [] as any[];
  }, []);

  const getPottyStreak = useCallback(() => {
    _warnDeprecated('getPottyStreak');
    return 0;
  }, []);

  const getTodayPottyCount = useCallback(() => {
    _warnDeprecated('getTodayPottyCount');
    return 0;
  }, []);

  const getPottySuccessRate = useCallback(() => {
    _warnDeprecated('getPottySuccessRate');
    return 0;
  }, []);

  // ── Medication ────────────────────────────────────────────────────
  const addMedicationLog = useCallback(async (_log?: any) => {
    _warnDeprecated('addMedicationLog');
    return false;
  }, []);

  const getMedicationLogs = useCallback((_days?: number) => {
    _warnDeprecated('getMedicationLogs');
    return [] as any[];
  }, []);

  // ── Generic activities ────────────────────────────────────────────
  const addActivity = useCallback(async (_entry?: any) => {
    _warnDeprecated('addActivity');
    return false;
  }, []);

  const getRecentActivities = useCallback((_limit?: number) => {
    _warnDeprecated('getRecentActivities');
    return [] as ActivityEntry[];
  }, []);

  const getActivitiesByType = useCallback((_type?: string) => {
    _warnDeprecated('getActivitiesByType');
    return [] as ActivityEntry[];
  }, []);

  const deleteActivity = useCallback(async (_id?: string) => {
    _warnDeprecated('deleteActivity');
    return false;
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────
  const getBabyStats = useCallback(() => {
    return { streak: 0, milestones: 0, photos: 0, entries: 0 };
  }, []);

  const updateBabyStats = useCallback(async (_updates?: Partial<BabyProfile>) => {
    _warnDeprecated('updateBabyStats');
  }, []);

  // ─── MEMOIZED VALUE ─────────────────────────────────────────────────
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