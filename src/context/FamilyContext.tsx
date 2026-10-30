


import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useAuth, subscribeToProfileChanges } from './AuthContext';
import { useBaby } from './BabyContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { UserRole, Permission, ROLE_PERMISSIONS, FamilyMember, resolveProfileByIdentifier, ResolvedProfile } from '../types/roles';

export type { FamilyMember } from '../types/roles';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

interface FamilyState {
  isLoading: boolean;
  members: FamilyMember[];
  parent1: FamilyMember | null;
  parent2: FamilyMember | null;
  guardians: FamilyMember[];
  pendingInvites: FamilyMember[];
}

/**
 * Structured result from `addMemberDirectly`.
 *
 * `ok: true`  → `member` is the freshly-inserted / restored row.
 * `ok: false` → `code` is a stable discriminator the caller can branch
 *               on to pick the right icon + title in its Aura modal:
 *
 *   • 'not_signed_in'      — no baby or no auth session
 *   • 'invalid_input'      — empty identifier
 *   • 'not_found'          — identifier doesn't match any profile
 *   • 'already_you'        — identifier resolves to the caller
 *   • 'already_member'     — target is already a member (active row)
 *   • 'restore_failed'     — soft-deleted row existed but couldn't revive
 *   • 'insert_failed'      — fresh insert was rejected (RLS / constraint)
 *   • 'unexpected'         — something else threw
 */
export type AddMemberResult =
  | {
      ok: true;
      member: FamilyMember;
      /** Convenience label for the modal title ("Member Added"). */
      title: string;
      /** One-line success message (already includes the member name). */
      message: string;
    }
  | {
      ok: false;
      code:
        | 'not_signed_in'
        | 'invalid_input'
        | 'not_found'
        | 'already_you'
        | 'already_member'
        | 'restore_failed'
        | 'insert_failed'
        | 'unexpected';
      title: string;
      message: string;
      /** True if the caller should show a `warning` modal instead of `error`. */
      isWarning?: boolean;
    };

interface FamilyContextType extends FamilyState {
  loadFamily: () => Promise<void>;
  refreshFamily: () => Promise<void>;
  /**
   * Invite a member.
   *
   * `email` may be an email address, a @username, a bare username, or a
   * phone number. We resolve it against `profiles` before inserting, so
   * an existing account is linked IMMEDIATELY (`user_id` + `status:
   * 'active'`) instead of sitting in the pending list until they happen
   * to re-open the app.
   */
  inviteMember: (email: string, role: UserRole, relationship: string) => Promise<boolean>;
  /**
   * Directly add an EXISTING LittleLoom user to this family.
   *
   * This is the "fourth path" alongside:
   *   • inviteMember        (email/username/phone → pending or active row)
   *   • generateInviteCode  (code → shared → signed up → family_members row)
   *   • promoteMember       (change role of an existing member)
   *
   * Resolves the identifier against `profiles`, refuses if the user
   * is already a member, and inserts an ACTIVE `family_members` row
   * with the correct permissions / user_id / status. Syncs
   * `babies.parent2_id` when the role is parent2, then fires realtime
   * so every device re-renders.
   *
   * Returns a *structured result* rather than just `FamilyMember | null`
   * so the caller can render its own modal (`useSweetAlert`, etc.) with
   * a tailored message per failure mode. `FamilyContext` does NOT
   * render user-facing UI itself — that's the caller's job.
   */
  addMemberDirectly: (
    identifier: string,
    role: UserRole,
    relationship: string,
  ) => Promise<AddMemberResult>;
  removeMember: (memberId: string) => Promise<boolean>;
  
  getEffectivePermissions: (userId?: string) => Permission;
  updateParent2Profile: (updates: Partial<Omit<FamilyMember, 'id' | 'userId' | 'role' | 'permissions' | 'addedAt' | 'addedBy' | 'canBeRemoved'>>) => Promise<boolean>;
  updateGuardianProfile: (memberId: string, updates: Partial<FamilyMember>) => Promise<boolean>;
  promoteMember: (memberId: string, newRole: UserRole) => Promise<FamilyMember | null>;
  resendInvite: (memberId: string) => Promise<boolean>;
  cancelInvite: (memberId: string) => Promise<boolean>;
  refreshMemberStatus: (memberId: string) => Promise<void>;
  generateInviteCode: (
    role: 'parent2' | 'guardian' | 'viewer',
    relationship?: string,
    inviteeName?: string,
    inviteeEmail?: string,
    inviteePhone?: string
  ) => Promise<{ code: string; success: boolean; message: string }>;
  getActiveInviteCodes: () => Promise<any[]>;
  revokeInviteCode: (code: string) => Promise<boolean>;
  getCurrentBaby: () => any;
  getBabyId: () => string | null;
  validateInviteCode: (code: string) => Promise<{ valid: boolean; data: any; message: string }>;
  useInviteCode: (code: string, userId?: string) => Promise<{ success: boolean; message: string }>;
  markSignupComplete: (code: string, userId: string) => Promise<{ success: boolean; message: string }>;
  getInviteCodeById: (code: string) => Promise<any>;
  // ─── NEW: Recover partial sign-up ──────────────────────────────────
  recoverPartialSignup: (code: string, userId: string, email?: string, phone?: string, name?: string) => Promise<{ success: boolean; message: string }>;
  // ─── NEW: Get partial signup info ──────────────────────────────────
  getPartialSignupInfo: (code: string) => Promise<{ exists: boolean; email?: string; phone?: string; name?: string; usedBy?: string; usedAt?: number }>;

  // ─── OWNERSHIP TRANSFER ─────────────────────────────────────────────
  // Used when the current Parent1 wants to hand the crown to someone else
  // (e.g. before deleting their own account, or to switch roles with a
  // partner). Both rows must already exist in family_members for this baby.
  // Caller must currently be Parent1 OR have manageFamily.
  transferOwnership: (newParent1MemberId: string) => Promise<{ success: boolean; message: string }>;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

// ─── Generate a proper 6-character invite code ──────────────────────
const generateInviteCodeString = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

const showAlert = (title: string, message: string) => {
  if (typeof Alert !== 'undefined' && Alert.alert) {
    Alert.alert(title, message);
  } else {
    console.warn(`[FamilyContext] ${title}: ${message}`);
  }
};

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile: authProfile, session } = useAuth();

  // ─── BabyContext is the authoritative source for "which baby is active".
  // FamilyContext must MIRROR BabyContext (not re-query from scratch),
  // otherwise Parent 2 / Guardian sessions show an empty family because
  // the old `parent1_id` query returned nothing.
  const {
    currentBaby: babyFromContext,
    currentBabyId: babyIdFromContext,
    babies: babiesFromContext,
  } = useBaby();
  
  const [currentBaby, setCurrentBaby] = useState<any>(babyFromContext ?? null);
  const [babies, setBabies] = useState<any[]>(babiesFromContext ?? []);
  const [babyLoading, setBabyLoading] = useState(!babyFromContext);

  const [state, setState] = useState<FamilyState>({
    isLoading: false,
    members: [],
    parent1: null,
    parent2: null,
    guardians: [],
    pendingInvites: [],
  });

  const initRef = useRef(false);
  const familyLoadInProgress = useRef(false);
  const loadingRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const loadFamilyRef = useRef<(() => Promise<void>) | null>(null);
  // Prevents the "no baby yet" retry loop from running forever.
  const loadFamilyRetryCount = useRef(0);

  // ─── Realtime: reload family when members change on any device ──
  useRealtimeSubscription({
    table: 'family_members',
    filter: currentBaby?.id ? `baby_id=eq.${currentBaby.id}` : undefined,
    enabled: !!currentBaby?.id,
    onInsert: () => {
      if (__DEV__) console.log('[FamilyContext] Realtime family_members.inserted');
      loadFamilyRef.current?.();
    },
    onUpdate: () => {
      if (__DEV__) console.log('[FamilyContext] Realtime family_members.updated');
      loadFamilyRef.current?.();
    },
    onDelete: () => {
      if (__DEV__) console.log('[FamilyContext] Realtime family_members.deleted');
      loadFamilyRef.current?.();
    },
  });

  // ─── Track current user to prevent cross-device conflicts ────
  useEffect(() => {
    if (authProfile?.id) {
      currentUserIdRef.current = authProfile.id;
    }
  }, [authProfile?.id]);

  // ─── Sync from BabyContext FIRST (Parent 2 / Guardian support) ────
  // BabyContext already knows how to find babies via parent1_id,
  // parent2_id, family_members, AND invite_codes. It's the single
  // source of truth. We mirror its state instead of re-querying.
  useEffect(() => {
    if (babyFromContext) {
      setCurrentBaby(babyFromContext);
      setBabyLoading(false);
    }
    if (Array.isArray(babiesFromContext) && babiesFromContext.length > 0) {
      setBabies(babiesFromContext);
    }
  }, [babyFromContext, babiesFromContext]);

  // ─── React to baby switches ───────────────────────────────────────
  // If BabyContext switches baby (via switchBaby), reload family for
  // the new baby. Without this, `currentBaby` went stale.
  //
  // We debounce by a tick because React state updates from
  // BabyContext (`setState` inside switchBaby) and this effect can
  // race — `babyFromContext` may still be the OLD baby on the first
  // render after the switch. Reading `babyIdFromContext` first
  // guarantees we use the NEW baby id.
  useEffect(() => {
    const newId = babyIdFromContext ?? babyFromContext?.id ?? null;
    if (!newId) return;
    if (currentBaby?.id === newId) return;

    // Commit the new baby reference immediately so callers see it.
    if (babyFromContext && babyFromContext.id === newId) {
      setCurrentBaby(babyFromContext);
    }

    // Defer the family reload until after React has flushed the
    // baby switch — otherwise loadFamily may read the OLD
    // `currentBaby.id` and hydrate the wrong family.
    const timer = setTimeout(() => {
      familyLoadInProgress.current = false;
      loadFamilyRef.current?.().catch(() => {});
    }, 50);

    return () => clearTimeout(timer);
  }, [babyIdFromContext, babyFromContext?.id, currentBaby?.id]);

  // ─── Fallback: query Supabase only if BabyContext is empty ────────
  // This preserves backward compatibility while giving BabyContext
  // precedence. It also covers the very first render before
  // BabyContext has hydrated.
  const loadBabyData = useCallback(async () => {
    if (!authProfile?.id) return;
    if (babyFromContext) {
      // BabyContext has data → we're done, just mirror.
      setCurrentBaby(babyFromContext);
      setBabyLoading(false);
      return;
    }

    try {
      setBabyLoading(true);

      // Query ALL paths — parent1, parent2, and family_members.
      // The old code only checked parent1, which hid the baby from
      // Parent 2 and Guardian sessions.
      const babyIds = new Set<string>();

      // path 1: app_settings current_baby_id
      try {
        const { data: settingData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'current_baby_id')
          .eq('user_id', authProfile.id)
          .maybeSingle();
        if (settingData?.value) babyIds.add(settingData.value);
      } catch {}

      // path 2: parent1_id
      try {
        const { data } = await supabase
          .from('babies')
          .select('id')
          .eq('parent1_id', authProfile.id)
          .eq('is_active', true);
        (data ?? []).forEach((b: any) => b?.id && babyIds.add(b.id));
      } catch {}

      // path 3: parent2_id
      try {
        const { data } = await supabase
          .from('babies')
          .select('id')
          .eq('parent2_id', authProfile.id)
          .eq('is_active', true);
        (data ?? []).forEach((b: any) => b?.id && babyIds.add(b.id));
      } catch {}

      // path 4: family_members
      try {
        const { data: fmRows } = await supabase
          .from('family_members')
          .select('baby_id')
          .eq('user_id', authProfile.id)
          .eq('status', 'active')
          .is('deleted_at', null);
        (fmRows ?? []).forEach((fm: any) => fm?.baby_id && babyIds.add(fm.baby_id));
      } catch {}

      const idList = [...babyIds].filter(Boolean);

      if (idList.length === 0) {
        setBabies([]);
        setCurrentBaby(null);
        setBabyLoading(false);
        return;
      }

      const { data: allBabies, error: allError } = await supabase
        .from('babies')
        .select('*')
        .in('id', idList)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!allError && allBabies) {
        setBabies(allBabies);
        // Pick current from app_settings if valid, otherwise first
        const wantedId = babyIdFromContext;
        const chosen = wantedId
          ? allBabies.find((b: any) => b.id === wantedId) ?? allBabies[0]
          : allBabies[0];
        setCurrentBaby(chosen ?? null);

        // ── GUARDIAN / CO-PARENT FIX ─────────────────────────────
        // A member added directly (or via an accepted invite) has
        // no `parent1_id` / `parent2_id` match on `babies` and no
        // `app_settings.current_baby_id` row, so BabyContext's own
        // resolver returns `null` and this effect leaves
        // `currentBaby = null`. FamilyContext's `loadFamily` then
        // early-returns on `!currentBaby?.id` and the invitee sees
        // an empty family — or, worse, a synthetic Parent-1 card
        // that is actually themselves.
        //
        // Persist the resolved baby to `app_settings` so the next
        // cold boot hydrates instantly without a network round-trip.
        if (chosen?.id && authProfile?.id) {
          try {
            await supabase
              .from('app_settings')
              .upsert(
                {
                  key: 'current_baby_id',
                  value: chosen.id,
                  user_id: authProfile.id,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'key,user_id' },
              );
          } catch {}
        }
      }
    } catch (error) {
      console.warn('[FamilyProvider] Could not load baby data:', error);
    } finally {
      setBabyLoading(false);
    }
  }, [authProfile?.id, babyFromContext, babyIdFromContext]);

  useEffect(() => {
    if (authProfile?.id) {
      loadBabyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfile?.id, babyFromContext?.id, babyIdFromContext]);

  const isOwner = useMemo(() => {
    const effectiveProfile = authProfile;
    if (!effectiveProfile) return false;
    // `authProfile.role` is a GLOBAL hint and is wrong for anyone who
    // is Parent1 on one baby and Guardian on another. The authoritative
    // owner is `babies.parent1_id`. Fall back to the role hint only
    // when we have no baby yet (very first render).
    if (currentBaby) {
      return currentBaby.parent1_id === effectiveProfile.id;
    }
    return (
      effectiveProfile.role === 'parent1' ||
      effectiveProfile.role === (UserRole.PARENT_1 as any)
    );
  }, [authProfile, currentBaby]);

  // ─── Load family with user isolation ──────────────────────────
  const loadFamily = useCallback(async () => {
    if (!currentBaby?.id) {
      // ── FIX: Guardian cold-start path ─────────────────────────
      // BabyContext resolves babies for guardians via family_members.
      // But there's a window where FamilyContext mounts before
      // BabyContext finishes its first fetch, and currentBaby is
      // null.
      //
      // Strategy:
      //   1. Try app_settings.current_baby_id (fast — the guardian
      //      usually has it after first successful load).
      //   2. Try family_members (authoritative — works on very first
      //      cold start).
      //   3. Persist the resolved baby to app_settings so subsequent
      //      launches hit path 1 instantly.
      //   4. Retry up to 4 times with backoff to survive the race
      //      with BabyContext's own hydration.
      //
      // On EVERY retry we bump a retry counter so we never loop
      // forever if the user genuinely has no baby.
      const uid =
        authProfile?.id ||
        (await (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            return session?.user?.id ?? null;
          } catch {
            return null;
          }
        })());
      if (!uid) {
        setState(prev => ({ ...prev, isLoading: true }));
        return;
      }

      // ── Path 1: app_settings.current_baby_id (fastest) ────────
      let resolvedBabyId: string | null = null;
      try {
        const { data: settingsRow } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'current_baby_id')
          .eq('user_id', uid)
          .maybeSingle();
        if (settingsRow?.value) resolvedBabyId = settingsRow.value;
      } catch {}

      // ── Path 2: family_members (authoritative) ────────────────
      if (!resolvedBabyId) {
        try {
          const { data: fm } = await supabase
            .from('family_members')
            .select('baby_id')
            .eq('user_id', uid)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (fm?.baby_id) resolvedBabyId = fm.baby_id;
        } catch {}
      }

      if (!resolvedBabyId) {
        // Retry with backoff — BabyContext may not have hydrated yet.
        // We track attempts via a ref so this doesn't loop forever.
        const attempt = (loadFamilyRetryCount.current ?? 0) + 1;
        loadFamilyRetryCount.current = attempt;
        if (attempt <= 4) {
          const delay = Math.min(150 * attempt, 800);
          if (__DEV__) {
            console.log(
              `[FamilyContext] loadFamily: no baby yet (attempt ${attempt}), retrying in ${delay}ms`,
            );
          }
          setTimeout(() => {
            loadFamilyRef.current?.().catch(() => {});
          }, delay);
          setState(prev => ({ ...prev, isLoading: true }));
        } else {
          // Genuinely no baby — stop retrying.
          loadFamilyRetryCount.current = 0;
          setState(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      // Reset retry counter — we found a baby.
      loadFamilyRetryCount.current = 0;

      // Adopt the resolved baby so the rest of loadFamily can run.
      setCurrentBaby({ id: resolvedBabyId } as any);

      // Persist to app_settings so path 1 hits on the next launch.
      try {
        await supabase
          .from('app_settings')
          .upsert(
            {
              key: 'current_baby_id',
              value: resolvedBabyId,
              user_id: uid,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key,user_id' },
          );
      } catch {}

      // Loop once more; by then `currentBaby?.id` is set and the
      // normal path runs.
      setTimeout(() => loadFamilyRef.current?.().catch(() => {}), 0);
      return;
    }

    // Always emit a brand-new state object (even if the same length)
    // so downstream useMemo([]) consumers re-render when role or
    // permission fields change.

    // ─── FIX: Recover user ID if authProfile is stale ────────────
    let effectiveUserId = authProfile?.id;
    if (!effectiveUserId) {
      // Try Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        effectiveUserId = session?.user?.id;
      } catch {}
    }
    if (!effectiveUserId) {
      // Try AsyncStorage recovery
      try {
        const keys = await AsyncStorage.getAllKeys();
        const authKey = keys.find(k => k.includes('auth-token') || k.includes('supabase.auth'));
        if (authKey) {
          const stored = await AsyncStorage.getItem(authKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            effectiveUserId = parsed?.user?.id || parsed?.session?.user?.id;
          }
        }
      } catch {}
    }

    // ─── Guard: only skip if we're sure the user has NO relationship.
    //
    // The old check relied on `currentBaby.guardian_ids`, which is a
    // local-only field that BabyContext always maps to `[]`. That made
    // guardians hit "User not associated…" and skip the load entirely,
    // which is why the family list went empty.
    //
    // The authoritative relationship source is `family_members` in
    // Supabase — which `loadFamily` already queries below. So we only
    // short-circuit here if:
    //   • the user is NOT parent1,
    //   • the user is NOT parent2,
    //   • AND `family_members` returns zero rows for this user+baby.
    //
    // Doing it in one round-trip here means we don't waste a second
    // query below when the user really isn't associated.
    if (familyLoadInProgress.current) return;
    familyLoadInProgress.current = true;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // ── 1. Query all family_members rows for this baby ──────────
      const { data: dbMembers, error: membersError } = await supabase
        .from('family_members')
        .select('*')
        .eq('baby_id', currentBaby.id)
        .is('deleted_at', null);

      if (membersError && __DEV__) {
        console.warn('[FamilyContext] family_members query error:', membersError.message);
      }

      const rawRows: any[] = Array.isArray(dbMembers) ? dbMembers : [];

      // ── 2. Ensure the parent1 row is present even if the seed
      //    failed above (defensive: some legacy babies never got one).
      //
      //    CRITICAL: we only synthesise this row for the ACTUAL
      //    parent1 (`babies.parent1_id === authProfile.id`). The
      //    previous version also used `currentBaby.parent1_id` as a
      //    fallback for the *name* fields even when the viewer was a
      //    guardian/viewer being added directly — which made a
      //    guardian appear to themselves as "Primary Parent".
      if (
        currentBaby.parent1_id &&
        authProfile?.id === currentBaby.parent1_id &&
        !rawRows.some(r => r.user_id === currentBaby.parent1_id && r.role === 'parent1')
      ) {
        rawRows.push({
          id: `${currentBaby.id}-p1`,
          baby_id: currentBaby.id,
          user_id: currentBaby.parent1_id,
          email: authProfile?.email || '',
          full_name: authProfile?.fullName || 'Primary Parent',
          role: 'parent1',
          relationship: 'Parent',
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          added_at: currentBaby.created_at,
          added_by: currentBaby.parent1_id,
          can_be_removed: false,
          last_active: new Date().toISOString(),
          phone_number: authProfile?.phoneNumber || null,
          notifications_enabled: true,
          status: 'active',
          updated_at: new Date().toISOString(),
        });
      }

      // ── 3. Hydrate all profiles in ONE batch ────────────────────
      const userIds = Array.from(
        new Set(
          rawRows
            .map(r => (r.user_id || r.id) as string)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
          (profilesData || []).forEach((p: any) => {
            profileMap[p.id] = p;
          });
        } catch (e) {
          if (__DEV__) console.warn('[FamilyContext] profile batch failed:', e);
        }
      }

      // ── 4. Normalize each row into the FamilyMember shape ──────
      const buildMember = (row: any): FamilyMember => {
        // ── AUTHORITATIVE ROLE SOURCE ────────────────────────────────
        // `family_members.role` is the SINGLE source of truth. The old
        // code upgraded a `parent2` row to PARENT_1 whenever
        // `babies.parent1_id === row.user_id` — that meant a demoted
        // parent (still listed as babies.parent1_id until the DB is
        // updated) always appeared as PARENT_1, and a freshly-
        // promoted parent (family_members.role='parent1' but
        // babies.parent1_id still on the old parent) never showed up
        // as PARENT_1.
        //
        // We trust the row. If `babies.parent1_id` disagrees with the
        // row, we fix the baby row *lazily* below (in loadFamily) so
        // the two systems converge. That guarantees:
        //   • Role upgrade  (family_members.role → parent1) is visible
        //     immediately in the tree.
        //   • Role demotion (parent1 → parent2/guardian) is visible
        //     immediately too (they no longer appear in Primary Parent
        //     group).
        const rawRole = (row.role || 'viewer').toString().toLowerCase();
        const enumRole: UserRole =
          rawRole === 'parent1' ? UserRole.PARENT_1
          : rawRole === 'parent2' ? UserRole.PARENT_2
          : rawRole === 'guardian' ? UserRole.GUARDIAN
          : UserRole.VIEWER;

        const profile = row.user_id ? profileMap[row.user_id] : null;
        const liveName =
          profile?.community_display_name ||
          profile?.full_name ||
          row.full_name ||
          'Family Member';
        const liveEmail = profile?.email || row.email || '';
        const liveAvatar =
          profile?.community_avatar ||
          profile?.avatar_url ||
          profile?.avatar ||
          undefined;
        const livePhone = profile?.phone_number || row.phone_number || undefined;

        // Merge permissions: use stored JSONB but backfill missing
        // keys from the canonical role template so a legacy `{}` row
        // still behaves like a real guardian/viewer.
        const stored = (row.permissions as Record<string, boolean>) || {};
        const template = ROLE_PERMISSIONS[enumRole] as unknown as Record<string, boolean>;
        const permissions: Permission = {
          ...template,
          ...stored,
        } as Permission;

        // ── NORMALIZE `last_active` ────────────────────────────────
        // `family_members.last_active` is TEXT and has been written
        // as ISO strings, Unix millis, or SQL timestamps over time.
        // Every consumer downstream does `new Date(member.lastActive)`,
        // which returns Invalid Date for numeric strings and silently
        // falls through to "Never". Normalize here so
        // `FamilyMember.lastActive` is ALWAYS an ISO string (or
        // undefined when the raw value was empty/invalid).
        const normalizedLastActive = ((): string | undefined => {
          const raw = row.last_active;
          if (raw == null || raw === '') return undefined;
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            const ms = raw <= 1e12 ? raw * 1000 : raw;
            return new Date(ms).toISOString();
          }
          const s = String(raw).trim();
          if (!s) return undefined;
          if (/^\d+$/.test(s)) {
            const n = parseInt(s, 10);
            if (!Number.isFinite(n) || n <= 0) return undefined;
            const ms = s.length <= 10 ? n * 1000 : n;
            return new Date(ms).toISOString();
          }
          const t = new Date(s).getTime();
          return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
        })();

        const built: any = {
          id: row.id,
          userId: row.user_id || row.id,
          fullName: liveName,
          email: liveEmail,
          avatar: liveAvatar,
          role: enumRole,
          relationship: row.relationship,
          permissions,
          addedAt: row.added_at,
          addedBy: row.added_by,
          canBeRemoved: row.can_be_removed !== false,
          lastActive: normalizedLastActive,
          phoneNumber: livePhone,
          notificationsEnabled: row.notifications_enabled !== false,
          status: row.status || (normalizedLastActive ? 'active' : 'pending'),
        };
        // Internal hint used only by the dedupe pass above. Never
        // surfaced to consumers — stripped from the final state via
        // the `FamilyMember` type's structural typing.
        built.__updatedAt = row.updated_at || row.added_at || '';
        return built as FamilyMember;
      };

      const built: FamilyMember[] = rawRows.map(buildMember);

      // ── 5. De-dupe by user_id (fallback: id). When TWO rows exist
      //       for the same user (legacy data, or an interrupted
      //       promote/demote), we ALWAYS keep the row with the most
      //       recent `updated_at`. Role priority is intentionally NOT
      //       used — that was the bug that made a stale parent1 row
      //       shadow a freshly-demoted guardian row (or vice-versa),
      //       and made a role change "revert" after the realtime
      //       reload. The DB's `updated_at` is the single source of
      //       truth for which row is current.
      const priority: Record<UserRole, number> = {
        [UserRole.PARENT_1]: 0,
        [UserRole.PARENT_2]: 1,
        [UserRole.GUARDIAN]: 2,
        [UserRole.VIEWER]: 3,
      };
      const rowUpdatedAt = (m: FamilyMember): number => {
        const raw = (m as any).__updatedAt as string | undefined;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
      };
      const byKey = new Map<string, FamilyMember>();
      for (const m of built) {
        const key = m.userId || m.id;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, m);
          continue;
        }
        if (rowUpdatedAt(m) > rowUpdatedAt(existing)) {
          byKey.set(key, m);
        }
      }

      // ── ROLE UNIQUENESS PASS ─────────────────────────────────────
      // parent1 is a singleton per baby. If two rows claim parent1
      // (legacy data, or an interrupted promote), the DB authoritatively
      // says only ONE can be parent1: whichever matches
      // `babies.parent1_id`. Any other parent1 row is demoted to parent2.
      // This keeps the tree honest without crashing.
      let dedupedMembers = Array.from(byKey.values());
      const parent1Candidates = dedupedMembers.filter(
        m => m.role === UserRole.PARENT_1,
      );
      if (parent1Candidates.length > 1) {
        const trueParent1UserId = currentBaby?.parent1_id;
        const keeper =
          parent1Candidates.find(
            m => (m.userId || m.id) === trueParent1UserId,
          ) || parent1Candidates[0];
        dedupedMembers = dedupedMembers.map(m => {
          if (
            m.role === UserRole.PARENT_1 &&
            (m.userId || m.id) !== (keeper.userId || keeper.id)
          ) {
            // Demote in memory — the DB will be reconciled on the next
            // promote/demote call. This prevents the tree from showing
            // two "Primary Parent" cards while the write is in flight.
            return { ...m, role: UserRole.PARENT_2 };
          }
          return m;
        });
      }

      // Sort for display only: parent1 → parent2 → guardian → viewer.
      const stripInternal = (m: FamilyMember): FamilyMember => {
        const { __updatedAt, ...clean } = m as any;
        return clean as FamilyMember;
      };
      const uniqueMembers = dedupedMembers
        .sort((a, b) => (priority[a.role] ?? 4) - (priority[b.role] ?? 4))
        .map(stripInternal);

      const nextParent1 = uniqueMembers.find(m => m.role === UserRole.PARENT_1) || null;
      const nextParent2 = uniqueMembers.find(m => m.role === UserRole.PARENT_2) || null;
      const nextGuardians = uniqueMembers.filter(
        m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER,
      );
      const nextPending = uniqueMembers.filter(
        m => !m.lastActive && m.role !== UserRole.PARENT_1,
      );

      // Always emit a fresh state object so `useMemo([members])`
      // consumers re-render even when length is unchanged.
      setState({
        isLoading: false,
        members: uniqueMembers,
        parent1: nextParent1,
        parent2: nextParent2,
        guardians: nextGuardians,
        pendingInvites: nextPending,
      });
    } catch (error) {
      console.error('[FamilyContext] Error loading family:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      familyLoadInProgress.current = false;
    }
  }, [currentBaby, authProfile]);

  // Keep the ref in sync with the latest loadFamily callback
  useEffect(() => {
    loadFamilyRef.current = loadFamily;
  }, [loadFamily]);

  // ── Realtime profile-change subscription ──────────────────────
  // Any member editing their name / avatar / bio re-loads the family
  // so the member card, EditGuardian, and chat headers stay fresh.
  //
  // Role changes need a slightly longer debounce because the DB
  // write that synchronises `babies.parent1_id` (in
  // updateGuardianProfile) races with the `family_members.role`
  // write. We give it 250 ms so the reconcile step has landed.
    // ── ONE-TIME BACKFILL: fix `relationship IS NULL` on parent1 rows ──
  // Older babies were created before this fix existed, so their
  // parent1 `family_members` row has `relationship = NULL` (or the
  // literal string 'Parent'). We backfill it from `user_metadata`
  // once per session so the chat header shows "Mother"/"Father" etc.
  useEffect(() => {
    if (!currentBaby?.id || !authProfile?.id) return;
    if (currentBaby.parent1_id !== authProfile.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        const metaRel = (user?.user_metadata as any)?.relationship;
        if (!metaRel || !String(metaRel).trim()) return;
        const cleanRel = String(metaRel).trim();
        const { data: row } = await supabase
          .from('family_members')
          .select('id, relationship')
          .eq('baby_id', currentBaby.id)
          .eq('user_id', authProfile.id)
          .eq('role', 'parent1')
          .maybeSingle();
        if (cancelled || !row) return;
        const currentRel = (row.relationship || '').trim();
        if (currentRel && currentRel.toLowerCase() !== 'parent') return;
        await supabase
          .from('family_members')
          .update({
            relationship: cleanRel,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (__DEV__) console.log('[FamilyContext] Backfilled relationship:', cleanRel);
        // Re-load so the family tree / chat header reflect it immediately.
        loadFamilyRef.current?.().catch(() => {});
      } catch (e) {
        if (__DEV__) console.warn('[FamilyContext] relationship backfill failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentBaby?.id, authProfile?.id]);

  useEffect(() => {
    if (!currentBaby?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeToProfileChanges((payload) => {
      const isRoleChange = Array.isArray(payload?.fields) && payload.fields.includes('role');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        loadFamilyRef.current?.().catch(() => {});
      }, isRoleChange ? 250 : 0);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [currentBaby?.id]);

  useEffect(() => {
    if (babyLoading || !authProfile) return;

    if (!currentBaby) {
      // Don't wipe the members list if BabyContext is still
      // hydrating — that's what makes the co-parent / guardian row
      // flash into the list and vanish again. Instead, leave the
      // last-known members visible and let `loadFamily` retry with
      // backoff (see the retry loop in loadFamily).
      if (!babyLoading) {
        setState(prev =>
          prev.members.length === 0
            ? prev
            : {
                isLoading: false,
                members: [],
                parent1: null,
                parent2: null,
                guardians: [],
                pendingInvites: [],
              },
        );
      }
      initRef.current = false;
      return;
    }

    // Always call loadFamily when the active baby changes. The old
    // code short-circuited on `initRef.current && state.members.length > 0`,
    // which meant a baby SWITCH never reloaded the family — so a
    // co-parent who switched to their own baby saw the previous
    // baby's members until they navigated away and back.
    initRef.current = true;
    loadFamily();
  }, [currentBaby?.id, babyLoading, authProfile, loadFamily]);

  // ─── Update Parent 2 Profile ───────────────────────────────────────────
  const updateParent2Profile = useCallback(async (
    updates: Partial<Omit<FamilyMember, 'id' | 'userId' | 'role' | 'permissions' | 'addedAt' | 'addedBy' | 'canBeRemoved'>>
  ): Promise<boolean> => {
    if (!currentBaby?.parent2_id) {
      showAlert('Error', 'No Parent 2 found');
      return false;
    }

    const canManage = state.members.some(m => 
      m.userId === authProfile?.id && m.permissions?.manageFamily
    );

    if (!canManage && authProfile?.role !== 'parent1') {
      showAlert('Error', 'You do not have permission to update family members');
      return false;
    }

    // Capture before any `await` — `state.members` becomes stale.
    const parent2RowBefore = state.members.find(m => m.id === currentBaby.parent2_id);
    const linkedUserIdBefore = (parent2RowBefore as any)?.userId || currentBaby.parent2_id;

    // Touch the ACTOR's last_active too. The row we're editing might
    // not be the caller, and editing a family member is a strong
    // "I'm here" signal for every other device.
    try { await supabase.rpc('touch_family_member_last_active'); } catch {}

    try {
      const dbUpdates: any = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
      dbUpdates.last_active = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('family_members')
        .update(dbUpdates)
        .eq('id', currentBaby.parent2_id);

      // ─── MIRROR role/name/avatar/relationship to profiles ──────
      // `profiles` is what UserContext / CommunityContext / AuthContext
      // read. Without this, the UI hydrates the old role from
      // `profiles.role` on the next broadcast cycle and "reverts".
      try {
        const { data: memberRow } = await supabase
          .from('family_members')
          .select('user_id, role, relationship')
          .eq('id', currentBaby.parent2_id)
          .maybeSingle();
        if (memberRow?.user_id) {
          const profileMirror: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          // Do NOT mirror `role` into the global `profiles.role`
          // unless this user has no other family memberships.
          // `profiles.role` can hold only ONE value and would corrupt
          // a Parent1-on-another-baby user if overwritten here.
          if (memberRow.role) {
            try {
              const { data: otherMemberships } = await supabase
                .from('family_members')
                .select('role')
                .eq('user_id', memberRow.user_id)
                .is('deleted_at', null)
                .neq('baby_id', currentBaby.id);
              const hasOtherRoles =
                Array.isArray(otherMemberships) &&
                otherMemberships.some(
                  (r: any) =>
                    (r.role || '').toLowerCase() !==
                    (memberRow.role || '').toLowerCase(),
                );
              if (!hasOtherRoles) profileMirror.role = memberRow.role;
            } catch {
              profileMirror.role = memberRow.role;
            }
          }
          if (updates.fullName !== undefined) profileMirror.full_name = updates.fullName;
          if (updates.avatar !== undefined) {
            profileMirror.avatar = updates.avatar;
            profileMirror.community_avatar = updates.avatar;
            profileMirror.avatar_url = updates.avatar;
          }
          if (updates.phoneNumber !== undefined) profileMirror.phone_number = updates.phoneNumber;
          if (updates.email !== undefined) profileMirror.email = updates.email;
          if (Object.keys(profileMirror).length > 1) {
            await supabase
              .from('profiles')
              .update(profileMirror)
              .eq('id', memberRow.user_id);
          }
        }
      } catch (mirrorErr) {
        if (__DEV__) console.warn('[FamilyContext] parent2 profiles mirror failed:', mirrorErr);
      }

      if (updateError) {
        console.error('Error updating parent2:', updateError);
        showAlert('Error', 'Failed to update Parent 2 profile');
        return false;
      }

      if (currentBaby.parent2_id) {
        const { data: memberData } = await supabase
          .from('family_members')
          .select('user_id')
          .eq('id', currentBaby.parent2_id)
          .maybeSingle();

        if (memberData?.user_id) {
          const profileUpdates: any = {};
          if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName;
          if (updates.avatar !== undefined) profileUpdates.avatar = updates.avatar;
          if (updates.phoneNumber !== undefined) profileUpdates.phone_number = updates.phoneNumber;

          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', memberData.user_id);
        }
      }

      if (updates.fullName) {
        await supabase
          .from('babies')
          .update({
            parent2_name: updates.fullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentBaby.id);
      }

      await loadFamily();

      // ── ROLE CHANGE FAN-OUT ───────────────────────────────────────
      try {
        // Use the userId resolved BEFORE the `loadFamily()` await above.
        // `state.members` is a stale closure here.
        const linkedUserId = linkedUserIdBefore;
        if (linkedUserId) {
          const fields: Array<'fullName' | 'avatar' | 'phone' | 'email' | 'role'> = [];
          if (updates.fullName !== undefined) fields.push('fullName');
          if (updates.avatar !== undefined) fields.push('avatar');
          if (updates.phoneNumber !== undefined) fields.push('phone');
          if (updates.email !== undefined) fields.push('email');
          fields.push('role');
          const { broadcastProfileChange } = require('./AuthContext');
          await broadcastProfileChange({ userId: linkedUserId, fields });
        }
      } catch {}
      return true;
    } catch (error) {
      console.error('Error updating parent2 profile:', error);
      showAlert('Error', 'Failed to update Parent 2 profile');
      return false;
    }
  }, [currentBaby, authProfile, state.members, loadFamily]);
  // ─── Promote / Demote Member ───────────────────────────────────────────
  // THE ONLY entry point for role changes. Guarantees:
  //   • family_members.role is written
  //   • profiles.role is mirrored
  //   • babies.parent1_id / parent2_id stay consistent
  //   • the PREVIOUS parent1 is demoted to parent2 when promoting a new one
  //   • stale sibling rows are soft-deleted
  //   • returns the DB-verified fresh FamilyMember
  const promoteMember = useCallback(async (
    memberId: string,
    newRole: UserRole,
  ): Promise<FamilyMember | null> => {
    if (!currentBaby?.id) return null;

    // ── Resolve target by BOTH family_members.id and profiles.id ──
    // Kept only so we can return a fully-populated FamilyMember
    // even if the RPC's RETURNING row is partial. `state.members` is
    // still useful for the fallback merge.
    const targetRow =
      state.members.find(m => m.id === memberId) ||
      state.members.find(m => (m as any).userId === memberId) ||
      null;

    let dbTarget: any = null;
    try {
      const { data } = await supabase
        .from('family_members')
        .select('*')
        .eq('baby_id', currentBaby.id)
        .or(`id.eq.${memberId},user_id.eq.${memberId}`)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      dbTarget = data;
    } catch (e) {
      if (__DEV__) console.warn('[promoteMember] target lookup failed:', e);
    }

    if (!dbTarget && !targetRow) {
      if (__DEV__) console.warn('[promoteMember] target not found:', memberId);
      return null;
    }

    const targetRowId: string = dbTarget?.id || (targetRow as any)?.id;
    const targetUserId: string =
      dbTarget?.user_id || (targetRow as any)?.userId || targetRow?.id;

    if (!targetRowId || !targetUserId) return null;

    const dbRole =
      newRole === UserRole.PARENT_1 ? 'parent1'
      : newRole === UserRole.PARENT_2 ? 'parent2'
      : newRole === UserRole.GUARDIAN ? 'guardian'
      : 'viewer';

    const nowIso = new Date().toISOString();

    try {

      // ── SINGLE ATOMIC RPC — the DB does the cascade for us. ──
      // One transaction; the intermediate "two parent1" or "two
      // parent2" states can never exist, so we can never violate
      // `family_members_one_parent1` OR `family_members_one_parent2`.
      const { data: rpcRow, error: rpcErr } = await supabase.rpc(
        'set_family_member_role',
        {
          p_baby_id: currentBaby.id,
          p_target_id: targetRowId,
          p_new_role: dbRole,
          p_actor_id: authProfile?.id ?? null,
        },
      );

      if (rpcErr || !rpcRow) {
        if (__DEV__) {
          console.error('[promoteMember] set_family_member_role failed:', {
            code: (rpcErr as any)?.code,
            message: rpcErr?.message,
            details: (rpcErr as any)?.details,
            hint: (rpcErr as any)?.hint,
          });
        }
        // If the RPC itself is failing because the DB function has a
        // bug (e.g. 23505 from the unique indexes), fall back to
        // `transfer_ownership` when the target is being promoted to
        // parent1. That RPC is already fixed to handle the swap
        // atomically.
        const rpcCode = (rpcErr as any)?.code;
        if (rpcCode === '23505' && newRole === UserRole.PARENT_1) {
          try {
            const { data: transferRow, error: transferErr } = await supabase.rpc(
              'transfer_ownership',
              {
                p_baby_id: currentBaby.id,
                p_target_row_id: targetRowId,
                p_actor_id: authProfile?.id ?? null,
              },
            );
            if (!transferErr && transferRow) {
              const row = Array.isArray(transferRow) ? transferRow[0] : transferRow;
              if (row?.id) {
                familyLoadInProgress.current = false;
                await loadFamily();
                try {
                  const { broadcastProfileChange } = require('./AuthContext');
                  await broadcastProfileChange({ userId: targetUserId, fields: ['role'] });
                } catch {}
                const fresh: FamilyMember = {
                  id: row.id,
                  userId: row.user_id || targetUserId,
                  fullName: row.full_name || (targetRow as any)?.fullName || 'Family Member',
                  email: row.email || (targetRow as any)?.email || '',
                  avatar: row.avatar || (targetRow as any)?.avatar,
                  role: UserRole.PARENT_1,
                  relationship: row.relationship ?? (targetRow as any)?.relationship ?? '',
                  permissions: row.permissions || ROLE_PERMISSIONS[UserRole.PARENT_1],
                  addedAt: row.added_at || (targetRow as any)?.addedAt || nowIso,
                  addedBy: row.added_by || (targetRow as any)?.addedBy || '',
                  canBeRemoved: false,
                  lastActive: row.last_active || nowIso,
                  phoneNumber: row.phone_number || undefined,
                  notificationsEnabled: row.notifications_enabled !== false,
                  status: 'active',
                };
                return fresh;
              }
            }
          } catch (fallbackErr) {
            if (__DEV__) console.warn('[promoteMember] transfer_ownership fallback failed:', fallbackErr);
          }
        }
        return null;
      }

      const fmData = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;

      // ── 4. Mirror role to profiles ONLY if single-family ───────
      // `profiles.role` is a SINGLE global column. A user can be
      // Parent1 on Baby A and Guardian on Baby B. Writing the
      // Baby-B role here corrupts their Baby-A permission checks
      // on any screen that reads `profiles.role` directly. So we
      // only mirror when this is their ONLY membership role.
      try {
        const { data: otherMemberships } = await supabase
          .from('family_members')
          .select('role')
          .eq('user_id', targetUserId)
          .is('deleted_at', null)
          .neq('baby_id', currentBaby.id);

        const hasOtherRoles =
          Array.isArray(otherMemberships) &&
          otherMemberships.some(
            (r: any) => (r.role || '').toLowerCase() !== dbRole,
          );

        if (!hasOtherRoles) {
          const mirror: Record<string, unknown> = {
            role: dbRole,
            updated_at: nowIso,
          };
          if (dbTarget?.role === 'parent1' && dbRole !== 'parent1') {
            mirror.community_bio =
              dbRole === 'parent2' ? 'Co-Parent'
              : dbRole === 'guardian' ? 'Guardian'
              : 'Viewer';
          }
          await supabase.from('profiles').update(mirror).eq('id', targetUserId);
        } else if (__DEV__) {
          console.log(
            '[FamilyContext] Skipped profiles.role mirror — user has other family roles:',
            otherMemberships?.map((r: any) => r.role),
          );
        }
      } catch {}

      // ── 5. Sync babies.parent1_id / parent2_id ───────────────────
      const babyUpdates: Record<string, unknown> = { updated_at: nowIso };
      if (newRole === UserRole.PARENT_1) {
        babyUpdates.parent1_id = targetUserId;
        // If the target was previously parent2, clear it so we don't
        // end up with the same user in both slots (unique constraint).
        if (currentBaby.parent2_id === targetUserId) babyUpdates.parent2_id = null;
      } else if (newRole === UserRole.PARENT_2) {
        babyUpdates.parent2_id = targetUserId;
        if (currentBaby.parent1_id === targetUserId) babyUpdates.parent1_id = null;
      } else {
        if (currentBaby.parent2_id === targetUserId) babyUpdates.parent2_id = null;
      }
      try {
        await supabase.from('babies').update(babyUpdates).eq('id', currentBaby.id);
      } catch (e) {
        if (__DEV__) console.warn('[promoteMember] babies sync failed:', e);
      }

      // ── 6. Fresh load — bypass the in-progress guard ────────────
      familyLoadInProgress.current = false;
      await loadFamily();

      // ── 7. Broadcast + build the return object from the DB row we
      //       just wrote (NOT from the stale `state.members` closure).
      try {
        const { broadcastProfileChange } = require('./AuthContext');
        await broadcastProfileChange({ userId: targetUserId, fields: ['role'] });
      } catch {}

      // Use the row we wrote (fmData) as the source of truth.
      // Merge it with the live profile so the caller gets a complete
      // object with fullName / email / avatar populated.
      let liveProfile: any = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, email, phone_number, community_avatar, avatar_url, avatar')
          .eq('id', targetUserId)
          .maybeSingle();
        liveProfile = data;
      } catch {}

      const written = fmData || {
        id: targetRowId,
        user_id: targetUserId,
        role: dbRole,
        updated_at: nowIso,
      };

      const fresh: FamilyMember = {
        id: written.id,
        userId: written.user_id || targetUserId,
        fullName:
          liveProfile?.full_name ||
          written.full_name ||
          (targetRow as any)?.fullName ||
          'Family Member',
        email:
          liveProfile?.email || written.email || (targetRow as any)?.email || '',
        avatar:
          liveProfile?.community_avatar ||
          liveProfile?.avatar_url ||
          liveProfile?.avatar ||
          written.avatar ||
          (targetRow as any)?.avatar,
        role: newRole,
        relationship: written.relationship ?? (targetRow as any)?.relationship ?? '',
        permissions:
          (written.permissions as Permission) ||
          ROLE_PERMISSIONS[newRole],
        addedAt: written.added_at || (targetRow as any)?.addedAt || nowIso,
        addedBy: written.added_by || (targetRow as any)?.addedBy || '',
        canBeRemoved: written.can_be_removed !== false,
        lastActive: written.last_active || nowIso,
        phoneNumber: liveProfile?.phone_number || written.phone_number || undefined,
        notificationsEnabled: written.notifications_enabled !== false,
        status: written.status || 'active',
      };

      return fresh;
    } catch (e) {
      if (__DEV__) console.error('[promoteMember] threw:', e);
      return null;
    }
  }, [currentBaby, state.members, loadFamily]);
  // ─── Update Guardian Profile ───────────────────────────────────────────
  // Returns the FRESH FamilyMember on success (or null on failure).
  // The caller (EditGuardianScreen) MUST use the return value — it is
  // the DB-verified state and the only source of truth that can't be
  // clobbered by a stale `members` closure.
  const updateGuardianProfile = useCallback(async (
    memberId: string,
    updates: Partial<FamilyMember>,
  ): Promise<FamilyMember | null> => {
    if (!currentBaby?.id) return null;

    // ── Resolve target row (accepts both family_members.id and userId) ──
    const targetRow =
      state.members.find(m => m.id === memberId) ||
      state.members.find(m => (m as any).userId === memberId) ||
      null;
    if (!targetRow) {
      if (__DEV__) console.warn('[updateGuardianProfile] target not found:', memberId);
      return null;
    }
    const targetRowId = (targetRow as any).id as string;
    const targetUserId: string =
      (targetRow as any).userId || (targetRow as any).id;

    // Touch the ACTOR's last_active. Same reason as parent2.
    try { await supabase.rpc('touch_family_member_last_active'); } catch {}

    // ── Permission check ───────────────────────────────────────────
    const me = state.members.find(
      m => m.userId === authProfile?.id || m.id === authProfile?.id,
    );
    const editingSelf = targetUserId === authProfile?.id;
    const iAmParent1 = me?.role === UserRole.PARENT_1;
    const iCanManage = Boolean(me?.permissions?.manageFamily);
    const isRoleChange = updates.role !== undefined;
    const isOnlySelfEditableFields =
      updates.relationship !== undefined ||
      updates.avatar !== undefined ||
      updates.phoneNumber !== undefined ||
      updates.notificationsEnabled !== undefined;

    if (!iAmParent1 && !iCanManage) {
      if (!(editingSelf && isOnlySelfEditableFields && !isRoleChange)) {
        showAlert('Permission Denied', 'You cannot edit this member.');
        return null;
      }
    }

    // ── Demotion guards (inviter protection + parent1 immutability) ──
    if (me && targetRow && isRoleChange) {
      const meAddedBy = (me as any).addedBy || null;
      const targetWasParent =
        targetRow.role === UserRole.PARENT_1 || targetRow.role === UserRole.PARENT_2;
      const targetWillBeParent =
        updates.role === UserRole.PARENT_1 || updates.role === UserRole.PARENT_2;

      if (meAddedBy && meAddedBy === targetUserId && targetWasParent && !targetWillBeParent) {
        showAlert('Cannot Demote', 'This person invited you. Only another Primary Parent can change their role.');
        return null;
      }
      if (
        targetRow.role === UserRole.PARENT_1 &&
        currentBaby.parent1_id === targetUserId &&
        authProfile?.id !== targetUserId &&
        !targetWillBeParent
      ) {
        showAlert('Cannot Demote', 'The original Primary Parent cannot be demoted. Transfer ownership first.');
        return null;
      }
    }

    // ── ROLE CHANGE goes through promoteMember ONLY ────────────────
    if (isRoleChange && updates.role) {
      return promoteMember(targetRowId, updates.role);
    }

    // ── Non-role updates (profile fields) ──────────────────────────
    const nowIso = new Date().toISOString();
    const dbUpdates: Record<string, unknown> = { last_active: nowIso, updated_at: nowIso };
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
    if (updates.relationship !== undefined) dbUpdates.relationship = updates.relationship;
    if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled;

    try {
      const { error } = await supabase
        .from('family_members')
        .update(dbUpdates)
        .eq('id', targetRowId);
      if (error) {
        if (__DEV__) console.warn('[updateGuardianProfile] update failed:', error.message);
        return null;
      }

      // Mirror to profiles so every consumer (chat header, tree, community)
      // re-hydrates the new name/avatar/phone.
      try {
        const profileMirror: Record<string, unknown> = { updated_at: nowIso };
        if (updates.fullName !== undefined) profileMirror.full_name = updates.fullName;
        if (updates.avatar !== undefined) {
          profileMirror.avatar = updates.avatar;
          profileMirror.community_avatar = updates.avatar;
          profileMirror.avatar_url = updates.avatar;
        }
        if (updates.phoneNumber !== undefined) profileMirror.phone_number = updates.phoneNumber;
        if (updates.email !== undefined) profileMirror.email = updates.email;
        if (updates.relationship !== undefined) {
          const rel = String(updates.relationship).trim();
          if (rel) profileMirror.community_bio = rel.slice(0, 160);
        }
        if (Object.keys(profileMirror).length > 1) {
          await supabase.from('profiles').update(profileMirror).eq('id', targetUserId);
        }
      } catch (e) {
        if (__DEV__) console.warn('[updateGuardianProfile] profiles mirror failed:', e);
      }

      // Fresh reload + build the return object from live state.
      familyLoadInProgress.current = false;
      await loadFamily();
      const fresh =
        state.members.find(
          m => m.id === targetRowId || (m as any).userId === targetUserId,
        ) || null;

      // Fan-out: notify all subscribers to re-hydrate this member.
      try {
        const { broadcastProfileChange } = require('./AuthContext');
        const fields: Array<'fullName' | 'avatar' | 'phone' | 'email' | 'role'> = [];
        if (updates.fullName !== undefined) fields.push('fullName');
        if (updates.avatar !== undefined) fields.push('avatar');
        if (updates.phoneNumber !== undefined) fields.push('phone');
        if (updates.email !== undefined) fields.push('email');
        if (updates.relationship !== undefined && fields.length === 0) fields.push('role');
        if (fields.length > 0) {
          await broadcastProfileChange({ userId: targetUserId, fields });
        }
      } catch {}

      return fresh;
    } catch (error) {
      if (__DEV__) console.error('[updateGuardianProfile] threw:', error);
      return null;
    }
  }, [authProfile, currentBaby, state.members, loadFamily, promoteMember]);
  // ─── Transfer Ownership ────────────────────────────────────────────────
  // Delegates to the atomic `transfer_ownership` RPC. The old client
  // sequence (demote me → promote target) always failed when the target
  // was already `parent2`, because demoting the current parent1 to
  // `parent2` collided with the existing parent2 row on the
  // `family_members_one_parent2` unique index — surfacing as
  // `23505 duplicate key value violates unique constraint`.
  //
  // The RPC swaps roles inside a single transaction so the unique
  // constraints are re-checked between statements and can never both
  // be "violated" at once.
  const transferOwnership = useCallback(async (
    newParent1MemberId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentBaby?.id || !authProfile?.id) {
      return { success: false, message: 'Not signed in or no baby selected' };
    }

    const target = state.members.find(m => m.id === newParent1MemberId);
    if (!target) {
      return { success: false, message: 'Target member not found' };
    }

    const me = state.members.find(
      m => m.userId === authProfile.id || m.id === authProfile.id,
    );
    if (!me) {
      return { success: false, message: 'You are not a member of this family' };
    }

    // Authorisation: I must currently be PARENT_1 OR have manageFamily.
    const iAmParent1 = me.role === UserRole.PARENT_1;
    const iCanManage = Boolean(me.permissions?.manageFamily);
    if (!iAmParent1 && !iCanManage) {
      return { success: false, message: 'You do not have permission to transfer ownership' };
    }

    if (target.role === UserRole.PARENT_1) {
      return { success: false, message: 'That member is already Primary Parent' };
    }

    const targetUserId = (target as any).userId || target.id;

    try {
      // Touch the actor first so every device sees them as active
      // during the ownership swap.
      try { await supabase.rpc('touch_family_member_last_active'); } catch {}

      // ── SINGLE ATOMIC RPC — the DB does the swap in one transaction ──
      const { data: rpcRow, error: rpcErr } = await supabase.rpc(
        'transfer_ownership',
        {
          p_baby_id: currentBaby.id,
          p_target_row_id: target.id,
          p_actor_id: authProfile.id,
        },
      );

      if (rpcErr) {
        if (__DEV__) {
          console.error('[transferOwnership] RPC failed:', {
            code: (rpcErr as any)?.code,
            message: rpcErr.message,
            details: (rpcErr as any)?.details,
            hint: (rpcErr as any)?.hint,
          });
        }

        // Friendlier messages for the common failure modes.
        const code = (rpcErr as any)?.code;
        if (code === '23505') {
          return {
            success: false,
            message:
              'Another member already holds that role. Refresh the family and try again.',
          };
        }
        if (code === '42501' || code === '28000') {
          return {
            success: false,
            message: 'You do not have permission to transfer ownership.',
          };
        }
        if (code === 'P0002') {
          return {
            success: false,
            message: 'That member is no longer in this family.',
          };
        }
        return { success: false, message: rpcErr.message || 'Ownership transfer failed' };
      }

      if (!rpcRow) {
        return { success: false, message: 'Ownership transfer failed — no row returned' };
      }

      // ── Fresh reload + fan-out ───────────────────────────────
      familyLoadInProgress.current = false;
      await loadFamily();
      try {
        const { broadcastProfileChange } = require('./AuthContext');
        await broadcastProfileChange({ userId: targetUserId, fields: ['role'] });
        await broadcastProfileChange({ userId: authProfile.id, fields: ['role'] });
      } catch {}

      return {
        success: true,
        message: `${target.fullName} is now Primary Parent. You are now Co-Parent.`,
      };
    } catch (e: any) {
      if (__DEV__) console.error('[transferOwnership] threw:', e);
      return { success: false, message: e?.message || 'Ownership transfer failed' };
    }
  }, [currentBaby, authProfile, state.members, loadFamily]);


  // ─── Add Existing Account Directly ────────────────────────────────────
  // THE FOURTH PATH. Adds an existing LittleLoom user to this family with
  // zero invite/QR/code overhead. EditGuardian "Add Member", FamilySharing
  // "Invite by username", and any admin panel all funnel through here.
  const addMemberDirectly = useCallback(async (
    identifier: string,
    role: UserRole,
    relationship: string,
  ): Promise<AddMemberResult> => {
    if (!currentBaby?.id || !authProfile?.id) {
      return {
        ok: false,
        code: 'not_signed_in',
        title: 'Not Signed In',
        message: 'Please sign in and select a baby first.',
      };
    }

    const raw = (identifier || '').trim();
    if (!raw) {
      return {
        ok: false,
        code: 'invalid_input',
        title: 'Missing Info',
        message: 'Enter an email, @username, or phone number.',
      };
    }

    // Resolve to a real profile (email / @username / phone)
    let profile: ResolvedProfile | null = null;
    try {
      profile = await resolveProfileByIdentifier(raw, supabase);
    } catch (e) {
      if (__DEV__) console.warn('[addMemberDirectly] resolve failed:', e);
    }

    if (!profile) {
      return {
        ok: false,
        code: 'not_found',
        title: 'Not on LittleLoom',
        message: `${raw} isn't on LittleLoom yet. Use "Invite via Code" to send them a code instead.`,
        isWarning: true,
      };
    }

    if (profile.id === authProfile.id) {
      return {
        ok: false,
        code: 'already_you',
        title: "That's You",
        message: "That's your own account — you're already in this family.",
        isWarning: true,
      };
    }

    // Duplicate check: same user_id anywhere in this family?
    try {
      const { data: existing } = await supabase
        .from('family_members')
        .select('id, role, status, deleted_at')
        .eq('baby_id', currentBaby.id)
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        return {
          ok: false,
          code: 'already_member',
          title: 'Already a Member',
          message: `${profile.fullName} is already part of this family as ${existing.role}.`,
          isWarning: true,
        };
      }

      // Also check for a soft-deleted row — restore instead of insert
      const { data: softDeleted } = await supabase
        .from('family_members')
        .select('id, role, deleted_at')
        .eq('baby_id', currentBaby.id)
        .eq('user_id', profile.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (softDeleted?.id) {
        const nowIso = new Date().toISOString();
        const dbRole =
          role === UserRole.PARENT_2 ? 'parent2'
          : role === UserRole.GUARDIAN ? 'guardian'
          : 'viewer';
        const { error: restoreErr } = await supabase
          .from('family_members')
          .update({
            role: dbRole,
            deleted_at: null,
            is_deleted: false,
            status: 'active',
            relationship: relationship || 'Family Member',
            permissions: ROLE_PERMISSIONS[role] as unknown as Record<string, boolean>,
            last_active: nowIso,
            updated_at: nowIso,
          })
          .eq('id', softDeleted.id);

        if (restoreErr) {
          if (__DEV__) console.warn('[addMemberDirectly] restore failed:', restoreErr.message);
          return {
            ok: false,
            code: 'restore_failed',
            title: 'Restore Failed',
            message: 'This person was previously removed. We could not restore their membership — please try again.',
          };
        }

        familyLoadInProgress.current = false;
        await loadFamily();

        try {
          const { broadcastProfileChange } = require('./AuthContext');
          await broadcastProfileChange({ userId: profile.id, fields: ['role'] });
        } catch {}

        const restored =
          state.members.find((m) => (m.userId || m.id) === profile.id) || null;

        const roleLabel =
          role === UserRole.GUARDIAN ? 'Guardian'
          : role === UserRole.PARENT_2 ? 'Co-Parent'
          : 'Viewer';

        return {
          ok: true,
          member: (restored ?? {
            id: softDeleted.id,
            userId: profile.id,
            fullName: profile.fullName,
            email: profile.email,
            avatar: profile.avatar || undefined,
            role,
            relationship: relationship || 'Family Member',
            permissions: ROLE_PERMISSIONS[role],
            addedAt: nowIso,
            addedBy: authProfile.id,
            canBeRemoved: true,
            lastActive: nowIso,
            phoneNumber: profile.phoneNumber || undefined,
            notificationsEnabled: true,
            status: 'active',
          }) as FamilyMember,
          title: 'Member Re-added',
          message: `${profile.fullName} is back in the family as ${roleLabel}.`,
        };
      }
    } catch (e) {
      if (__DEV__) console.warn('[addMemberDirectly] duplicate check failed:', e);
    }

    // Fresh insert as an ACTIVE member
    const newId = generateId();
    const dbRole =
      role === UserRole.PARENT_1 ? 'parent1'
      : role === UserRole.PARENT_2 ? 'parent2'
      : role === UserRole.GUARDIAN ? 'guardian'
      : 'viewer';

    if (dbRole === 'parent1') {
      return {
        ok: false,
        code: 'invalid_input',
        title: 'Use Transfer Ownership',
        message: 'Primary Parent can only be assigned via "Transfer Ownership".',
        isWarning: true,
      };
    }

    const nowIso = new Date().toISOString();
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('family_members')
        .insert({
          id: newId,
          baby_id: currentBaby.id,
          user_id: profile.id,
          email: profile.email || '',
          full_name: profile.fullName,
          avatar: profile.avatar,
          role: dbRole,
          relationship: relationship || 'Family Member',
          permissions: ROLE_PERMISSIONS[role] as unknown as Record<string, boolean>,
          added_at: nowIso,
          added_by: authProfile.id,
          can_be_removed: true,
          last_active: nowIso,
          phone_number: profile.phoneNumber,
          notifications_enabled: true,
          status: 'active',
          updated_at: nowIso,
          is_deleted: false,
        })
        .select('*')
        .maybeSingle();

      if (insertErr || !inserted) {
        if (__DEV__) {
          console.error('[addMemberDirectly] insert failed:', {
            code: (insertErr as any)?.code,
            message: insertErr?.message,
            details: (insertErr as any)?.details,
            hint: (insertErr as any)?.hint,
          });
        }
        return {
          ok: false,
          code: 'insert_failed',
          title: 'Could Not Add Member',
          message: 'The database rejected the new membership. Please try again or check your permissions.',
        };
      }

      if (dbRole === 'parent2') {
        try {
          await supabase
            .from('babies')
            .update({ parent2_id: profile.id, updated_at: nowIso })
            .eq('id', currentBaby.id);
        } catch {}
      }

      // `profiles.role` is a single global column — only write it
      // when this is the user's ONLY family membership. Otherwise
      // leave it untouched so we don't corrupt their Parent1 role
      // on another baby.
      try {
        const { data: otherMemberships } = await supabase
          .from('family_members')
          .select('role')
          .eq('user_id', profile.id)
          .is('deleted_at', null)
          .neq('baby_id', currentBaby.id);
        const hasOtherRoles =
          Array.isArray(otherMemberships) &&
          otherMemberships.some(
            (r: any) => (r.role || '').toLowerCase() !== dbRole,
          );
        if (!hasOtherRoles) {
          await supabase
            .from('profiles')
            .update({ role: dbRole, updated_at: nowIso })
            .eq('id', profile.id);
        }
      } catch {}

      try {
        const { broadcastProfileChange } = require('./AuthContext');
        await broadcastProfileChange({ userId: profile.id, fields: ['role'] });
      } catch {}

      familyLoadInProgress.current = false;
      await loadFamily();

      const fresh: FamilyMember = {
        id: inserted.id,
        userId: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        avatar: profile.avatar || undefined,
        role,
        relationship: relationship || 'Family Member',
        permissions: ROLE_PERMISSIONS[role],
        addedAt: nowIso,
        addedBy: authProfile.id,
        canBeRemoved: true,
        lastActive: nowIso,
        phoneNumber: profile.phoneNumber || undefined,
        notificationsEnabled: true,
        status: 'active',
      };

      const roleLabel =
        role === UserRole.GUARDIAN ? 'Guardian'
        : role === UserRole.PARENT_2 ? 'Co-Parent'
        : 'Viewer';

      return {
        ok: true,
        member: fresh,
        title: 'Member Added',
        message: `${profile.fullName} joined the family as ${roleLabel}.`,
      };
    } catch (e) {
      if (__DEV__) console.error('[addMemberDirectly] threw:', e);
      return {
        ok: false,
        code: 'unexpected',
        title: 'Something Went Wrong',
        message: 'Failed to add member. Please try again.',
      };
    }
  }, [currentBaby, authProfile, loadFamily, state.members]);

  // ─── Invite Member ─────────────────────────────────────────────────────
  const inviteMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    if (!isOwner || !authProfile || !currentBaby) {
      showAlert('Permission Denied', 'Only the account creator can invite family members');
      return false;
    }

    const raw = (email || '').trim();
    if (!raw) {
      showAlert('Invalid Invite', 'Enter an email, username, or phone number');
      return false;
    }

    // ── Accept email, @username, bare username, or phone ────────
    const looksLikeEmail = EMAIL_REGEX.test(raw);
    const looksLikePhone = /^\+?[\d\s\-()]{7,}$/.test(raw);
    const handleBare = raw.replace(/^@+/, '').toLowerCase();

    let resolvedUserId: string | null = null;
    let resolvedEmail: string | null = looksLikeEmail ? raw.toLowerCase() : null;
    let resolvedPhone: string | null = looksLikePhone ? raw : null;
    let resolvedName: string | null = null;

    try {
      if (looksLikeEmail) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number')
          .eq('email', raw.toLowerCase())
          .maybeSingle();
        if (data) {
          resolvedUserId = data.id;
          resolvedEmail = data.email || resolvedEmail;
          resolvedPhone = data.phone_number || resolvedPhone;
          resolvedName = data.full_name || null;
        }
      } else if (looksLikePhone) {
        const digits = raw.replace(/[^\d]/g, '');
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number')
          .not('phone_number', 'is', null)
          .ilike('phone_number', `%${digits.slice(-7)}%`)
          .limit(1)
          .maybeSingle();
        if (data) {
          resolvedUserId = data.id;
          resolvedEmail = data.email || resolvedEmail;
          resolvedPhone = data.phone_number || resolvedPhone;
          resolvedName = data.full_name || null;
        }
      } else {
        // username / @handle
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number, community_handle, community_username')
          .or(`community_handle.eq.@${handleBare},community_username.eq.${handleBare}`)
          .maybeSingle();
        if (data) {
          resolvedUserId = data.id;
          resolvedEmail = data.email || resolvedEmail;
          resolvedPhone = data.phone_number || resolvedPhone;
                    resolvedName = data.full_name || null;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[inviteMember] resolve failed:', e);
    }

    // ── Duplicate check: match by any of email / phone / user_id ──
    try {
      const orParts: string[] = [];
      if (resolvedEmail) orParts.push(`email.eq.${resolvedEmail}`);
      if (resolvedPhone) orParts.push(`phone_number.eq.${resolvedPhone}`);
      if (resolvedUserId) orParts.push(`user_id.eq.${resolvedUserId}`);
      // Always also check the literal raw input for a username-style
      // family_members row that was seeded earlier without a user_id.
      if (!looksLikeEmail && !looksLikePhone) {
        orParts.push(`email.eq.${raw.toLowerCase()}`);
      }

      if (orParts.length > 0) {
        // Look for an ACTIVE row first
        const { data: activeRow } = await supabase
          .from('family_members')
          .select('id, status, user_id, role')
          .eq('baby_id', currentBaby.id)
          .is('deleted_at', null)
          .or(orParts.join(','))
          .maybeSingle();

        if (activeRow) {
          // If the invite is pending but the user now has an account,
          // LINK it instead of refusing. This is the key upgrade: a
          // pending invite becomes an active membership the moment
          // the invitee signs up, with no re-invite needed.
          if (
            activeRow.status === 'pending' &&
            !activeRow.user_id &&
            resolvedUserId
          ) {
            const { error: linkErr } = await supabase
              .from('family_members')
              .update({
                user_id: resolvedUserId,
                status: 'active',
                full_name: resolvedName || undefined,
                email: resolvedEmail || undefined,
                phone_number: resolvedPhone || undefined,
                last_active: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeRow.id);

            if (linkErr) {
              if (__DEV__) console.warn('[inviteMember] link failed:', linkErr.message);
              showAlert('Error', 'Failed to link existing invite');
              return false;
            }

            if (role === UserRole.PARENT_2) {
              try {
                await supabase
                  .from('babies')
                  .update({ parent2_id: resolvedUserId, updated_at: new Date().toISOString() })
                  .eq('id', currentBaby.id);
              } catch {}
            }

            familyLoadInProgress.current = false;
            await loadFamily();
            showAlert('Member Added', `${resolvedName || 'Member'} joined the family`);
            return true;
          }

          showAlert(
            'Already a Member',
            `This person is already in the family as ${activeRow.role}.`,
          );
          return false;
        }

        // No active row — check for a SOFT-DELETED row we should revive
        try {
          const { data: softRow } = await supabase
            .from('family_members')
            .select('id, role, user_id')
            .eq('baby_id', currentBaby.id)
            .not('deleted_at', 'is', null)
            .or(orParts.join(','))
            .order('deleted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (softRow?.id) {
            const nowIso = new Date().toISOString();
            const dbRole =
              role === UserRole.PARENT_2 ? 'parent2'
              : role === UserRole.GUARDIAN ? 'guardian'
              : 'viewer';
            const { error: restoreErr } = await supabase
              .from('family_members')
              .update({
                role: dbRole,
                deleted_at: null,
                is_deleted: false,
                status: 'active',
                user_id: resolvedUserId || softRow.user_id,
                full_name: resolvedName || undefined,
                relationship: relationship || 'Family Member',
                permissions: ROLE_PERMISSIONS[role] as unknown as Record<string, boolean>,
                last_active: nowIso,
                updated_at: nowIso,
              })
              .eq('id', softRow.id);

            if (!restoreErr) {
              familyLoadInProgress.current = false;
              await loadFamily();
              showAlert('Member Re-added', `${resolvedName || 'They'} was restored to the family.`);
              return true;
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[inviteMember] soft-deleted revive failed:', e);
        }
      }

    } catch (e) {
      if (__DEV__) console.warn('[inviteMember] dup check failed:', e);
    }

    // ── Insert: existing account → active; unknown → pending ─────
    const newId = generateId();
    const dbRole =
      role === UserRole.PARENT_2 ? 'parent2'
      : role === UserRole.GUARDIAN ? 'guardian'
      : 'viewer';
    const isExistingAccount = !!resolvedUserId;
    const nowIso = new Date().toISOString();

    try {
      const { error: insertError } = await supabase
        .from('family_members')
        .insert({
          id: newId,
          baby_id: currentBaby.id,
          user_id: resolvedUserId,
          email: resolvedEmail || (!looksLikeEmail && !looksLikePhone ? raw.toLowerCase() : null),
          phone_number: resolvedPhone,
          full_name: resolvedName || (isExistingAccount ? 'Family Member' : 'Pending Invitation'),
          role: dbRole,
          relationship,
          permissions: ROLE_PERMISSIONS[role] as Record<string, boolean>,
          added_by: authProfile.id,
          can_be_removed: true,
          notifications_enabled: true,
          status: isExistingAccount ? 'active' : 'pending',
          last_active: isExistingAccount ? nowIso : null,
          added_at: nowIso,
          updated_at: nowIso,
        });

      if (insertError) {
        console.error('[inviteMember] insert failed:', insertError);
        showAlert('Error', 'Failed to add family member');
        return false;
      }

      // ── If this is parent2 and the account exists, sync the baby ─
      if (role === UserRole.PARENT_2 && resolvedUserId) {
        try {
          await supabase
            .from('babies')
            .update({ parent2_id: resolvedUserId, updated_at: nowIso })
            .eq('id', currentBaby.id);
        } catch {}
      }

      // Mirror to profiles.role ONLY when this is the invitee's
      // ONLY family. See the note in `addMemberDirectly`.
      if (resolvedUserId) {
        try {
          const { data: otherMemberships } = await supabase
            .from('family_members')
            .select('role')
            .eq('user_id', resolvedUserId)
            .is('deleted_at', null)
            .neq('baby_id', currentBaby.id);
          const hasOtherRoles =
            Array.isArray(otherMemberships) &&
            otherMemberships.some(
              (r: any) => (r.role || '').toLowerCase() !== dbRole,
            );
          if (!hasOtherRoles) {
            await supabase
              .from('profiles')
              .update({ role: dbRole, updated_at: nowIso })
              .eq('id', resolvedUserId);
          }
        } catch {}
        try {
          const { broadcastProfileChange } = require('./AuthContext');
          await broadcastProfileChange({ userId: resolvedUserId, fields: ['role'] });
        } catch {}
      }

      // Keep the legacy guardian_ids mirror intact for callers that
      // still read it, but never let a failed write block the invite.
      try {
        const guardianIds = [...(currentBaby.guardian_ids || []), newId];
        await supabase
          .from('babies')
          .update({ guardian_ids: guardianIds })
          .eq('id', currentBaby.id);
      } catch {}

      familyLoadInProgress.current = false;
      await loadFamily();

      showAlert(
        isExistingAccount ? 'Member Added' : 'Invitation Sent',
        isExistingAccount
          ? `${resolvedName || 'They'} joined the family immediately`
          : 'A pending invite was created — it will auto-link when they sign up',
      );
      return true;
    } catch (error) {
      console.error('[inviteMember] threw:', error);
      showAlert('Error', 'Failed to add family member');
      return false;
    }
  }, [isOwner, authProfile, currentBaby, loadFamily]);

  // ─── Remove Member ─────────────────────────────────────────────────────
  const removeMember = useCallback(async (memberId: string) => {
    const canManage = state.members.some(m => 
      m.userId === authProfile?.id && m.permissions?.manageFamily
    );

    if (!canManage && authProfile?.role !== 'parent1') {
      showAlert('Error', 'Permission denied');
      return false;
    }

    if (!currentBaby) return false;

    if (authProfile?.id === memberId) {
      showAlert('Error', 'You cannot remove yourself from the family');
      return false;
    }

    // ── UPGRADE PROTECTION ────────────────────────────────────────
    // If I am a promoted parent (my `addedBy` is the person I'm
    // trying to remove), I cannot remove them. This prevents an
    // upgraded parent from demoting/removing their inviter — which
    // used to be possible because role upgrades only changed
    // `family_members.role`, not the actual ownership graph.
    const me = state.members.find(
      (m) => m.userId === authProfile?.id || m.id === authProfile?.id,
    );
    const target = state.members.find((m) => m.id === memberId);
    if (me && target) {
      const meAddedBy = (me as any).addedBy || null;
      const targetUserId = (target as any).userId || target.id;
      if (meAddedBy && meAddedBy === targetUserId) {
        showAlert(
          'Cannot Remove',
          'You were invited to this family by this person, so you cannot remove them. Ask another Primary Parent to do it.',
        );
        return false;
      }
      // ── PARENT1 REMOVAL RULES ─────────────────────────────────────
      //
      // Default: only Parent1 can remove themselves.
      //
      // EXCEPTION: if Parent1 has been completely inactive for ≥ 90 days
      // (no `last_active` in that window), a Co-Parent (Parent2) or any
      // member with `manageFamily` may remove them. This prevents a
      // departed/abandoned Parent1 account from stranding the family.
      //
      // "Absent" requires ALL of:
      //   • target is PARENT_1
      //   • I am NOT the target
      //   • target has `last_active` older than 90 days OR NULL
      //   • I am PARENT_2 OR have manageFamily permission
      if (
        target.role === UserRole.PARENT_1 &&
        currentBaby.parent1_id !== authProfile?.id
      ) {
        const ABANDONED_DAYS = 90;
        const lastActiveMs = target.lastActive
          ? new Date(target.lastActive).getTime()
          : 0;
        const daysSinceActive =
          lastActiveMs > 0
            ? Math.floor((Date.now() - lastActiveMs) / (1000 * 60 * 60 * 24))
            : Number.POSITIVE_INFINITY;

        const iAmParent2 = me?.role === UserRole.PARENT_2;
        const iCanManage = Boolean(me?.permissions?.manageFamily);

        const isAbandoned =
          !lastActiveMs || daysSinceActive >= ABANDONED_DAYS;

        const canRemoveAbsentParent1 =
          isAbandoned && (iAmParent2 || iCanManage);

        if (!canRemoveAbsentParent1) {
          showAlert(
            'Cannot Remove',
            daysSinceActive < ABANDONED_DAYS
              ? `Primary Parent was active ${daysSinceActive} day${daysSinceActive === 1 ? '' : 's'} ago. Only they can remove themselves, or you can wait until ${ABANDONED_DAYS} days of inactivity.`
              : 'Only the Primary Parent can remove themselves. Promote someone else first.',
          );
          return false;
        }

        if (__DEV__) {
          console.log(
            '[FamilyContext] Removing absent Parent1 (inactive ' +
            (lastActiveMs ? `${daysSinceActive}d` : 'never') + ')',
          );
        }
      }
    }

    try {
      const removedMember = state.members.find(m => m.id === memberId);
      const removedUserId = (removedMember as any)?.userId || memberId;
      const nowIso = new Date().toISOString();

      // ── 1. Soft-delete EVERY row for this user on this baby ─────
      // If they were promoted then demoted, there could be multiple
      // rows. Kill them all so no stale row survives and reappears.
      const { error } = await supabase
        .from('family_members')
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .eq('baby_id', currentBaby.id)
        .eq('user_id', removedUserId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error removing member:', error);
        showAlert('Error', 'Failed to remove member');
        return false;
      }

      // ── 2. Clear parent slots if this was a parent ─────────────
      const babyUpdates: Record<string, unknown> = { updated_at: nowIso };
      if (currentBaby.parent2_id === removedUserId) {
        babyUpdates.parent2_id = null;
      }
      // Clear parent1_id ONLY if:
      //   • the removed user is currently parent1, AND
      //   • I am removing myself (i.e. I am the owner leaving), OR
      //   • the "abandoned parent1" rule fired above (90+ days inactive)
      //
      // Otherwise, ownership must be transferred first — which is
      // guarded earlier in this function.
      const removedWasParent1 = currentBaby.parent1_id === removedUserId;
      const removingSelf = authProfile?.id === removedUserId;
      if (removedWasParent1 && (removingSelf || currentBaby.parent1_id !== authProfile?.id)) {
        // Only allow when I'm not an upgraded parent trying to strip
        // the owner; the earlier abandoned-parent check already
        // enforced the 90-day rule.
        const me = state.members.find(
          (m) => m.userId === authProfile?.id || m.id === authProfile?.id,
        );
        const iAmTrueParent1 = currentBaby.parent1_id === authProfile?.id;
        if (removingSelf || !iAmTrueParent1) {
          babyUpdates.parent1_id = null;
        }
      }
      if (Object.keys(babyUpdates).length > 1) {
        try {
          await supabase
            .from('babies')
            .update(babyUpdates)
            .eq('id', currentBaby.id);
        } catch {}
      }

      // ── 3. Clear guardian_ids mirror ───────────────────────────
      const guardianIds = (currentBaby.guardian_ids || []).filter(
        (id: string) => id !== memberId && id !== removedUserId,
      );
      try {
        await supabase
          .from('babies')
          .update({ guardian_ids: guardianIds })
          .eq('id', currentBaby.id);
      } catch {}

      // ── 4. Fan out so chats / EditGuardian / tree drop them ────
      try {
        const { broadcastProfileChange } = require('./AuthContext');
        await broadcastProfileChange({
          userId: removedUserId,
          fields: ['fullName', 'avatar', 'role'],
        });
      } catch {}

      // ── 5. Fresh load ──────────────────────────────────────────
      familyLoadInProgress.current = false;
      await loadFamily();
      return true;
    } catch (error) {
      console.error('Error removing member:', error);
      showAlert('Error', 'Failed to remove member');
      return false;
    }
  }, [authProfile, currentBaby, state.parent2, state.members]);

  // ─── Resend Invite ─────────────────────────────────────────────────────
  const resendInvite = useCallback(async (memberId: string): Promise<boolean> => {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return false;
    showAlert('Invitation Resent', `New invitation sent to ${member.email || 'member'}`);
    return true;
  }, [state.members]);

  // ─── Cancel Invite ─────────────────────────────────────────────────────
  const cancelInvite = useCallback(async (memberId: string): Promise<boolean> => {
    return removeMember(memberId);
  }, [removeMember]);

  // ─── Refresh Member Status ────────────────────────────────────────────
  const refreshMemberStatus = useCallback(async (memberId: string) => {
    await loadFamily();
  }, [loadFamily]);

  // ─── Generate Invite Code ─────────────────────────────────────────────
  const generateInviteCode = useCallback(async (
    role: 'parent2' | 'guardian' | 'viewer',
    relationship?: string,
    inviteeName?: string,
    inviteeEmail?: string,
    inviteePhone?: string
  ): Promise<{ code: string; success: boolean; message: string }> => {
    if (!isOwner || !authProfile || !currentBaby) {
      return { code: '', success: false, message: 'Only the account creator can invite family members' };
    }

    try {
      let code = generateInviteCodeString();
      
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        const { data: existing, error } = await supabase
          .from('invite_codes')
          .select('code')
          .eq('code', code)
          .maybeSingle();
        
        if (!existing) {
          isUnique = true;
        } else {
          code = generateInviteCodeString();
          attempts++;
        }
      }

      if (!isUnique) {
        const timestamp = Date.now().toString(36).toUpperCase();
        code = timestamp.slice(-6);
        if (code.length < 6) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          while (code.length < 6) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
        }
      }

      const now = Date.now();
      const expiresInDays = 7;

      // ─── Ensure code is exactly 6 characters ──────────────────
      const finalCode = code.padStart(6, '0').slice(0, 6);

      console.log('[FamilyContext] Inserting invite code:', {
        code: finalCode,
        family_id: currentBaby.id,
        role: role,
        relationship: relationship,
        creator_id: authProfile.id
      });

      const { data, error } = await supabase
        .from('invite_codes')
        .insert({
          code: finalCode,
          family_id: currentBaby.id,
          baby_name: currentBaby.name,
          baby_dob: currentBaby.date_of_birth,
          baby_gender: currentBaby.gender,
          creator_id: authProfile.id,
          creator_name: authProfile.full_name,
          role: role,
          relationship: relationship || null,
          created_at: now,
          expires_in_days: expiresInDays,
          used: false,
          revoked: false,
          used_by_email: inviteeEmail || null,
          used_by_phone: inviteePhone || null,
          used_by_name: inviteeName || null,
          signup_completed: false,
          updated_at: now,
        })
        .select('code')
        .single();

      if (error) {
        console.error('Error generating invite code:', error);
        
        // ─── Try without select if single fails ──────────────────
        const { error: insertError } = await supabase
          .from('invite_codes')
          .insert({
            code: finalCode,
            family_id: currentBaby.id,
            baby_name: currentBaby.name,
            baby_dob: currentBaby.date_of_birth,
            baby_gender: currentBaby.gender,
            creator_id: authProfile.id,
            creator_name: authProfile.full_name,
            role: role,
            relationship: relationship || null,
            created_at: now,
            expires_in_days: expiresInDays,
            used: false,
            revoked: false,
            used_by_email: inviteeEmail || null,
            used_by_phone: inviteePhone || null,
            used_by_name: inviteeName || null,
            signup_completed: false,
            updated_at: now,
          });

        if (insertError) {
          console.error('Error inserting invite code (fallback):', insertError);
          return { code: finalCode, success: false, message: 'Failed to save invite code to database: ' + insertError.message };
        }

        return { code: finalCode, success: true, message: 'Invite code generated successfully (fallback)' };
      }

      console.log('[FamilyContext] Invite code inserted successfully:', data?.code);
      return { code: data?.code || finalCode, success: true, message: 'Invite code generated successfully' };
    } catch (error) {
      console.error('Error generating invite code:', error);
      return { code: '', success: false, message: 'Failed to generate invite code: ' + String(error) };
    }
  }, [isOwner, authProfile, currentBaby]);

  // ─── Get Active Invite Codes - Returns ALL codes with status ──────────
  const getActiveInviteCodes = useCallback(async () => {
    if (!currentBaby?.id) return [];

    try {
      const now = Date.now();
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('family_id', currentBaby.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invite codes:', error);
        return [];
      }

      return (data || []).map(item => {
        const expiresAt = item.created_at + (item.expires_in_days || 7) * 24 * 60 * 60 * 1000;
        const isExpired = now > expiresAt;
        
        let status = 'active';
        if (item.used) {
          status = item.signup_completed ? 'used' : 'partial';
        } else if (item.revoked) {
          status = 'revoked';
        } else if (isExpired) {
          status = 'expired';
        }
        
        return {
          ...item,
          expiresAt: new Date(expiresAt).toISOString(),
          isExpired,
          status,
          role: item.role,
          relationship: item.relationship,
          usedBy: item.used_by,
          usedByEmail: item.used_by_email || null,
          usedByPhone: item.used_by_phone || null,
          usedByName: item.used_by_name || null,
          usedAt: item.used_at,
          createdAt: item.created_at,
          signupCompleted: item.signup_completed || false,
          updatedAt: item.updated_at,
        };
      });
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      return [];
    }
  }, [currentBaby?.id]);

  // ─── Get Invite Code by ID ────────────────────────────────────────────
  const getInviteCodeById = useCallback(async (code: string): Promise<any> => {
    if (!code) return null;

    try {
      const trimmedCode = code.trim().toUpperCase();
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', trimmedCode)
        .maybeSingle();

      if (error) {
        console.error('Error fetching invite code:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching invite code:', error);
      return null;
    }
  }, []);

  // ─── NEW: Get Partial Signup Info ─────────────────────────────────────
  const getPartialSignupInfo = useCallback(async (code: string): Promise<{ exists: boolean; email?: string; phone?: string; name?: string; usedBy?: string; usedAt?: number }> => {
    if (!code) return { exists: false };

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      // First check if the code exists and is in partial state
      const { data, error } = await supabase
        .from('invite_codes')
        .select('used, signup_completed, used_by, used_by_email, used_by_phone, used_by_name, used_at')
        .eq('code', trimmedCode)
        .maybeSingle();

      if (error || !data) {
        return { exists: false };
      }

      // Check if it's a partial signup
      if (data.used && !data.signup_completed) {
        return {
          exists: true,
          email: data.used_by_email || undefined,
          phone: data.used_by_phone || undefined,
          name: data.used_by_name || undefined,
          usedBy: data.used_by || undefined,
          usedAt: data.used_at || undefined,
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Error getting partial signup info:', error);
      return { exists: false };
    }
  }, []);

  // ─── NEW: Recover Partial Signup ──────────────────────────────────────
  const recoverPartialSignup = useCallback(async (
    code: string,
    userId: string,
    email?: string,
    phone?: string,
    name?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!code || !userId) {
      return { success: false, message: 'Missing code or user ID' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      const now = Date.now();

      // First verify this is a partial signup
      const { data: existing, error: fetchError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', trimmedCode)
        .maybeSingle();

      if (fetchError || !existing) {
        return { success: false, message: 'Invite code not found' };
      }

      if (!existing.used) {
        return { success: false, message: 'This code has not been used yet. Please use it first.' };
      }

      if (existing.signup_completed) {
        return { success: false, message: 'This signup is already completed.' };
      }

      // Check if the user ID matches or if we should update it
      const updates: any = {
        signup_completed: true,
        updated_at: now,
      };

      // If userId doesn't match but we have a new user, update it
      if (existing.used_by !== userId) {
        updates.used_by = userId;
      }

      // Update with provided email/phone/name if they weren't stored before
      if (email && !existing.used_by_email) {
        updates.used_by_email = email;
      }
      if (phone && !existing.used_by_phone) {
        updates.used_by_phone = phone;
      }
      if (name && !existing.used_by_name) {
        updates.used_by_name = name;
      }

      const { error: updateError } = await supabase
        .from('invite_codes')
        .update(updates)
        .eq('code', trimmedCode);

      if (updateError) {
        console.error('Error recovering partial signup:', updateError);
        return { success: false, message: 'Failed to complete signup: ' + updateError.message };
      }

      // ─── Also update the family_members table if needed ──────────────
      if (existing.family_id) {
        const { data: familyMember } = await supabase
          .from('family_members')
          .select('id, user_id, email, full_name, phone_number')
          .eq('baby_id', existing.family_id)
          .eq('email', existing.used_by_email || email || '')
          .maybeSingle();

        if (familyMember) {
          const memberUpdates: any = {
            user_id: userId,
            status: 'active',
            updated_at: new Date().toISOString(),
          };
          if (name) memberUpdates.full_name = name;
          if (email) memberUpdates.email = email;
          if (phone) memberUpdates.phone_number = phone;

          await supabase
            .from('family_members')
            .update(memberUpdates)
            .eq('id', familyMember.id);
        }
      }

      return { success: true, message: 'Signup completed successfully!' };
    } catch (error) {
      console.error('Error recovering partial signup:', error);
      return { success: false, message: 'Failed to complete signup' };
    }
  }, []);

  // ─── Mark Signup as Complete ──────────────────────────────────────────
  const markSignupComplete = useCallback(async (code: string, userId: string): Promise<{ success: boolean; message: string }> => {
    if (!code || !userId) {
      return { success: false, message: 'Missing code or user ID' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      const now = Date.now();

      const { error } = await supabase
        .from('invite_codes')
        .update({
          signup_completed: true,
          updated_at: now,
        })
        .eq('code', trimmedCode);

      if (error) {
        console.error('Error marking signup complete:', error);
        return { success: false, message: 'Failed to update signup status' };
      }

      return { success: true, message: 'Signup marked as complete' };
    } catch (error) {
      console.error('Error marking signup complete:', error);
      return { success: false, message: 'Failed to update signup status' };
    }
  }, []);

  // ─── Revoke Invite Code ───────────────────────────────────────────────
  const revokeInviteCode = useCallback(async (code: string): Promise<boolean> => {
    if (!isOwner || !currentBaby) return false;

    try {
      const { error } = await supabase
        .from('invite_codes')
        .update({ 
          revoked: true,
          updated_at: Date.now(),
        })
        .eq('code', code)
        .eq('family_id', currentBaby.id);

      if (error) {
        console.error('Error revoking invite code:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error revoking invite code:', error);
      return false;
    }
  }, [isOwner, currentBaby]);

  // ─── Validate Invite Code with robust query ──────────────────────────
  const validateInviteCode = useCallback(async (code: string): Promise<{ valid: boolean; data: any; message: string }> => {
    if (!code || code.length < 4) {
      return { valid: false, data: null, message: 'Invalid invite code format' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      console.log('[FamilyContext] 🔍 Validating invite code:', trimmedCode);
      
      // ─── First try exact match with all filters ─────────────────
      let { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', trimmedCode)
        .eq('used', false)
        .eq('revoked', false)
        .maybeSingle();

      console.log('[FamilyContext] 📊 Query result (strict):', { 
        found: !!data, 
        error: error?.message,
        data: data ? { id: data.id, role: data.role, family_id: data.family_id, code: data.code } : null
      });

      // ─── If no result, try without the used/revoked filters ────
      if (!data) {
        console.log('[FamilyContext] No result with strict filters, trying relaxed...');
        
        const { data: relaxedData, error: relaxedError } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', trimmedCode)
          .maybeSingle();

        console.log('[FamilyContext] 📊 Relaxed query result:', { 
          found: !!relaxedData, 
          error: relaxedError?.message,
          data: relaxedData ? { 
            id: relaxedData.id, 
            role: relaxedData.role, 
            family_id: relaxedData.family_id, 
            code: relaxedData.code,
            used: relaxedData.used,
            revoked: relaxedData.revoked,
            signup_completed: relaxedData.signup_completed,
            used_by_email: relaxedData.used_by_email,
            used_by_phone: relaxedData.used_by_phone,
            used_by_name: relaxedData.used_by_name,
            created_at: relaxedData.created_at
          } : null
        });

        if (relaxedData) {
          // Check if already used and completed
          if (relaxedData.used && relaxedData.signup_completed) {
            return { valid: false, data: null, message: 'This invite code has already been used' };
          }
          // ─── NEW: Check if it's a partial signup ────────────────────
          if (relaxedData.used && !relaxedData.signup_completed) {
            // This is a partial signup - allow continuing
            return { 
              valid: true, 
              data: { 
                ...relaxedData, 
                isPartial: true,
                message: 'This code was used for a partial signup. Please complete your registration.' 
              }, 
              message: 'Partial signup detected - continue registration' 
            };
          }
          if (relaxedData.revoked) {
            return { valid: false, data: null, message: 'This invite code has been revoked' };
          }
          data = relaxedData;
        }
      }

      if (error) {
        console.error('Error validating invite code:', error);
        return { valid: false, data: null, message: 'Error validating code' };
      }

      if (!data) {
        // ─── Check if code exists with different case ─────────────
        console.log('[FamilyContext] No invite code found with exact case, trying case-insensitive...');
        
        const { data: caseInsensitiveData, error: caseError } = await supabase
          .from('invite_codes')
          .select('*')
          .ilike('code', trimmedCode)
          .maybeSingle();

        if (caseInsensitiveData) {
          console.log('[FamilyContext] Found code with case-insensitive match:', caseInsensitiveData.code);
          
          if (caseInsensitiveData.used && caseInsensitiveData.signup_completed) {
            return { valid: false, data: null, message: 'This invite code has already been used' };
          }
          if (caseInsensitiveData.used && !caseInsensitiveData.signup_completed) {
            return { 
              valid: true, 
              data: { ...caseInsensitiveData, isPartial: true }, 
              message: 'Partial signup detected - continue registration' 
            };
          }
          if (caseInsensitiveData.revoked) {
            return { valid: false, data: null, message: 'This invite code has been revoked' };
          }
          data = caseInsensitiveData;
        }

        if (!data) {
          console.log('[FamilyContext] ❌ No invite code found for:', trimmedCode);
          return { valid: false, data: null, message: 'Invalid or expired invite code' };
        }
      }

      // ─── Check expiration properly ─────────────────────────────
      const now = Date.now();
      const expiresAt = data.created_at + (data.expires_in_days || 7) * 24 * 60 * 60 * 1000;
      console.log('[FamilyContext] ⏰ Expires at:', new Date(expiresAt).toISOString(), 'Now:', new Date(now).toISOString());
      
      if (now > expiresAt) {
        console.log('[FamilyContext] ⏰ Code expired');
        return { valid: false, data: null, message: 'Invite code has expired' };
      }

      console.log('[FamilyContext] ✅ Code is valid!');
      return { valid: true, data, message: 'Invite code is valid' };
    } catch (error) {
      console.error('Error validating invite code:', error);
      return { valid: false, data: null, message: 'Error validating code' };
    }
  }, []);

  // ─── Mark Invite Code as Used ─────────────────────────────────────────
  const useInviteCode = useCallback(async (code: string, userId?: string): Promise<{ success: boolean; message: string }> => {
    if (!code) {
      return { success: false, message: 'No invite code provided' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      // First validate the code
      const validation = await validateInviteCode(trimmedCode);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Mark it as used (but not completed yet - partial signup)
      const now = Date.now();
      const { error } = await supabase
        .from('invite_codes')
        .update({
          used: true,
          used_by: userId || null,
          used_at: now,
          signup_completed: false,
          updated_at: now,
        })
        .eq('code', trimmedCode)
        .eq('used', false)
        .eq('revoked', false);

      if (error) {
        console.error('Error using invite code:', error);
        return { success: false, message: 'Failed to use invite code' };
      }

      return { success: true, message: 'Invite code used successfully' };
    } catch (error) {
      console.error('Error using invite code:', error);
      return { success: false, message: 'Failed to use invite code' };
    }
  }, [validateInviteCode]);

  // ─── Refresh (alias for loadFamily; used by tree screens) ─────────
  const refreshFamily = useCallback(async () => {
    await loadFamily();
  }, [loadFamily]);

  // ─── Get Effective Permissions ────────────────────────────────────────
  const getEffectivePermissions = useCallback((userId?: string): Permission => {
    const targetId = userId || authProfile?.id;
    const member = state.members.find(m => m.userId === targetId || m.id === targetId);
    return member?.permissions || ROLE_PERMISSIONS[UserRole.VIEWER];
  }, [state.members, authProfile]);

  // ─── Getters ───────────────────────────────────────────────────────────
  const getCurrentBaby = useCallback(() => currentBaby, [currentBaby]);
  const getBabyId = useCallback(() => currentBaby?.id || null, [currentBaby]);

  // ─── Memoized Value ────────────────────────────────────────────────────
  const value = React.useMemo(() => ({
    ...state,
    loadFamily,
    refreshFamily,
    inviteMember,
    addMemberDirectly,
    removeMember,
    promoteMember,
    getEffectivePermissions,
    updateParent2Profile,
    updateGuardianProfile,
    resendInvite,
    cancelInvite,
    refreshMemberStatus,
    generateInviteCode,
    getActiveInviteCodes,
    revokeInviteCode,
    getCurrentBaby,
    getBabyId,
    validateInviteCode,
    useInviteCode,
    markSignupComplete,
    getInviteCodeById,
    // ─── NEW ──────────────────────────────────────────────────────────
    recoverPartialSignup,
    getPartialSignupInfo,
    transferOwnership,
  }), [state, loadFamily, refreshFamily, inviteMember, addMemberDirectly, removeMember, getEffectivePermissions, 
      updateParent2Profile, updateGuardianProfile, resendInvite, cancelInvite, 
      refreshMemberStatus, generateInviteCode, getActiveInviteCodes, revokeInviteCode,
      getCurrentBaby, getBabyId, validateInviteCode, useInviteCode,
      markSignupComplete, getInviteCodeById,
      recoverPartialSignup, getPartialSignupInfo, transferOwnership]);

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
};

/**
 * Safe hook — never throws. Returns safe defaults if the provider
 * isn't mounted (early bootstrap, unit tests, or onboarding before
 * FamilyProvider hydrates). This mirrors the pattern used by
 * `useActivity` and prevents `useFamily must be used within
 * FamilyProvider` crashes during hot-reload or route transitions.
 */
export const useFamily = (): FamilyContextType => {
  const context = useContext(FamilyContext);
  if (context) return context;

  // Fallback — inert, but stable-shape so destructuring never crashes.
  return {
    isLoading: false,
    members: [],
    parent1: null,
    parent2: null,
    guardians: [],
    pendingInvites: [],
    loadFamily: async () => {},
    refreshFamily: async () => {},
    inviteMember: async () => false,
    addMemberDirectly: async () => ({
      ok: false,
      code: 'not_signed_in',
      title: 'Not Ready',
      message: 'Family context has not mounted yet.',
    }),
    removeMember: async () => false,
    getEffectivePermissions: () => ROLE_PERMISSIONS[UserRole.VIEWER],
    updateParent2Profile: async () => false,
    updateGuardianProfile: async () => false,
    resendInvite: async () => false,
    cancelInvite: async () => false,
    refreshMemberStatus: async () => {},
    generateInviteCode: async () => ({ code: '', success: false, message: 'Not ready' }),
    getActiveInviteCodes: async () => [],
    revokeInviteCode: async () => false,
    getCurrentBaby: () => null,
    getBabyId: () => null,
    validateInviteCode: async () => ({ valid: false, data: null, message: 'Not ready' }),
    useInviteCode: async () => ({ success: false, message: 'Not ready' }),
    markSignupComplete: async () => ({ success: false, message: 'Not ready' }),
    getInviteCodeById: async () => null,
    recoverPartialSignup: async () => ({ success: false, message: 'Not ready' }),
    getPartialSignupInfo: async () => ({ exists: false }),
    transferOwnership: async () => ({ success: false, message: 'Not ready' }),
  };
};

export default FamilyProvider;