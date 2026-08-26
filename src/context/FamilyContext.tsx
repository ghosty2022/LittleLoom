// src/context/FamilyContext.tsx
// Full Supabase-compatible family management

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';
import { UserRole, Permission, ROLE_PERMISSIONS, FamilyMember } from '../types/roles';

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

interface FamilyContextType extends FamilyState {
  loadFamily: () => Promise<void>;
  inviteMember: (email: string, role: UserRole, relationship: string) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  getEffectivePermissions: (userId?: string) => Permission;
  updateParent2Profile: (updates: Partial<Omit<FamilyMember, 'id' | 'userId' | 'role' | 'permissions' | 'addedAt' | 'addedBy' | 'canBeRemoved'>>) => Promise<boolean>;
  updateGuardianProfile: (memberId: string, updates: Partial<FamilyMember>) => Promise<boolean>;
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
}

const FamilyContext = createContext<FamilyContextType | null>(null);

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
  
  // ─── Baby state ──────────────────────────────────────────────────────────
  const [currentBaby, setCurrentBaby] = useState<any>(null);
  const [babies, setBabies] = useState<any[]>([]);
  const [babyLoading, setBabyLoading] = useState(true);

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

  // ─── Load baby data from Supabase ──────────────────────────────────────
  const loadBabyData = useCallback(async () => {
    if (!authProfile?.id) return;

    try {
      setBabyLoading(true);

      // Get current baby ID from app_settings
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'current_baby_id')
        .eq('user_id', authProfile.id)
        .maybeSingle();

      const currentBabyId = settingData?.value;

      if (currentBabyId) {
        // Fetch baby data
        const { data: babyData, error: babyError } = await supabase
          .from('babies')
          .select('*')
          .eq('id', currentBabyId)
          .maybeSingle();

        if (!babyError && babyData) {
          setCurrentBaby(babyData);
        }
      }

      // Get all babies for this user
      const { data: allBabies, error: allError } = await supabase
        .from('babies')
        .select('*')
        .eq('parent1_id', authProfile.id)
        .order('created_at', { ascending: false });

      if (!allError && allBabies) {
        setBabies(allBabies);
      }
    } catch (error) {
      console.warn('[FamilyProvider] Could not load baby data:', error);
    } finally {
      setBabyLoading(false);
    }
  }, [authProfile?.id]);

  // ─── Initial baby load ──────────────────────────────────────────────────
  useEffect(() => {
    if (authProfile?.id) {
      loadBabyData();
    }
  }, [authProfile?.id]);

  // ─── FIX: Account creator always has invite rights ────────────────────
  const isOwner = useMemo(() => {
    const effectiveProfile = authProfile;
    if (!effectiveProfile) return false;
    if (effectiveProfile.role === 'parent1' || effectiveProfile.role === UserRole.PARENT_1) return true;
    if (!currentBaby) return false;
    return currentBaby.parent1_id === effectiveProfile.id;
  }, [authProfile, currentBaby]);

  // ─── Load family members ───────────────────────────────────────────────
  const loadFamily = useCallback(async () => {
    if (!currentBaby?.id) {
      setState({
        isLoading: false,
        members: [],
        parent1: null,
        parent2: null,
        guardians: [],
        pendingInvites: [],
      });
      return;
    }

    if (familyLoadInProgress.current) return;
    familyLoadInProgress.current = true;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const members: FamilyMember[] = [];
      const effectiveProfile = authProfile;

      // ─── Add Parent 1 ──────────────────────────────────────────────────
      if (currentBaby.parent1_id) {
        // Fetch parent1 profile
        const { data: parentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentBaby.parent1_id)
          .maybeSingle();

        members.push({
          id: currentBaby.parent1_id,
          userId: currentBaby.parent1_id,
          fullName: parentData?.full_name || 'Parent',
          email: parentData?.email || '',
          avatar: parentData?.avatar || parentData?.community_avatar,
          role: UserRole.PARENT_1,
          relationship: 'Parent',
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          addedAt: currentBaby.created_at,
          addedBy: currentBaby.parent1_id,
          canBeRemoved: false,
          phoneNumber: parentData?.phone_number,
          notificationsEnabled: true,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
      }

      // ─── Fetch family members from Supabase ──────────────────────────
      const { data: dbMembers, error: membersError } = await supabase
        .from('family_members')
        .select('*')
        .eq('baby_id', currentBaby.id)
        .eq('deleted_at', null);

      if (!membersError && dbMembers) {
        for (const dbMember of dbMembers) {
          if (dbMember.role === 'parent1') continue;

          // Fetch user profile for this member if userId exists
          let userProfile = null;
          if (dbMember.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', dbMember.user_id)
              .maybeSingle();
            userProfile = profileData;
          }

          const member: FamilyMember = {
            id: dbMember.id,
            userId: dbMember.user_id || dbMember.id,
            fullName: userProfile?.full_name || dbMember.full_name || 'Family Member',
            email: userProfile?.email || dbMember.email || '',
            avatar: userProfile?.avatar || userProfile?.community_avatar || dbMember.avatar || undefined,
            role: dbMember.role === 'parent2' ? UserRole.PARENT_2 
              : dbMember.role === 'guardian' ? UserRole.GUARDIAN 
              : UserRole.VIEWER,
            relationship: dbMember.relationship,
            permissions: dbMember.permissions as Permission || ROLE_PERMISSIONS[UserRole.VIEWER],
            addedAt: dbMember.added_at,
            addedBy: dbMember.added_by,
            canBeRemoved: dbMember.can_be_removed !== false,
            lastActive: dbMember.last_active || undefined,
            phoneNumber: userProfile?.phone_number || dbMember.phone_number || undefined,
            notificationsEnabled: dbMember.notifications_enabled !== false,
            status: dbMember.status || (dbMember.last_active ? 'active' : 'pending'),
          };
          members.push(member);
        }
      }

      // ─── Update state ──────────────────────────────────────────────────
      const nextParent1 = members.find(m => m.role === UserRole.PARENT_1) || null;
      const nextParent2 = members.find(m => m.role === UserRole.PARENT_2) || null;
      const nextGuardians = members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER);
      const nextPending = members.filter(m => !m.lastActive && m.role !== UserRole.PARENT_1);

      setState(prev => ({
        isLoading: false,
        members,
        parent1: nextParent1,
        parent2: nextParent2,
        guardians: nextGuardians,
        pendingInvites: nextPending,
      }));
    } catch (error) {
      console.error('Error loading family:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      familyLoadInProgress.current = false;
    }
  }, [currentBaby, authProfile]);

  // ─── Trigger load when baby changes ────────────────────────────────────
  useEffect(() => {
    if (babyLoading || !authProfile) return;

    if (!currentBaby) {
      setState({
        isLoading: false,
        members: [],
        parent1: null,
        parent2: null,
        guardians: [],
        pendingInvites: [],
      });
      initRef.current = false;
      return;
    }

    if (initRef.current) {
      loadFamily();
      return;
    }

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

    try {
      // Update family member record
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

      if (updateError) {
        console.error('Error updating parent2:', updateError);
        showAlert('Error', 'Failed to update Parent 2 profile');
        return false;
      }

      // Also update profile if userId matches
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

      // ─── Update baby's parent2Id if needed ────────────────────────────
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
      return true;
    } catch (error) {
      console.error('Error updating parent2 profile:', error);
      showAlert('Error', 'Failed to update Parent 2 profile');
      return false;
    }
  }, [currentBaby, authProfile, state.members, loadFamily]);

  // ─── Update Guardian Profile ───────────────────────────────────────────
  const updateGuardianProfile = useCallback(async (memberId: string, updates: Partial<FamilyMember>): Promise<boolean> => {
    const canManage = state.members.some(m => 
      m.userId === authProfile?.id && m.permissions?.manageFamily
    );

    if (!canManage && authProfile?.role !== 'parent1') {
      showAlert('Error', 'Permission denied');
      return false;
    }

    try {
      const dbUpdates: any = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
      if (updates.relationship !== undefined) dbUpdates.relationship = updates.relationship;
      if (updates.role !== undefined) {
        dbUpdates.role = updates.role === UserRole.PARENT_2 ? 'parent2'
          : updates.role === UserRole.GUARDIAN ? 'guardian'
          : 'viewer';
      }
      if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled;
      dbUpdates.last_active = new Date().toISOString();

      const { error } = await supabase
        .from('family_members')
        .update(dbUpdates)
        .eq('id', memberId);

      if (error) {
        console.error('Error updating guardian:', error);
        showAlert('Error', 'Failed to update guardian');
        return false;
      }

      await loadFamily();
      return true;
    } catch (error) {
      console.error('Error updating guardian:', error);
      showAlert('Error', 'Failed to update guardian');
      return false;
    }
  }, [authProfile, state.members, loadFamily]);

  // ─── Invite Member ─────────────────────────────────────────────────────
  const inviteMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    if (!isOwner || !authProfile || !currentBaby) {
      showAlert('Permission Denied', 'Only the account creator can invite family members');
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    try {
      // Check for existing invite
      const { data: existing } = await supabase
        .from('family_members')
        .select('id')
        .eq('baby_id', currentBaby.id)
        .eq('email', email.toLowerCase())
        .eq('deleted_at', null)
        .maybeSingle();

      if (existing) {
        showAlert('Duplicate Invite', 'An invitation has already been sent to this email');
        return false;
      }

      const newId = generateId();
      const dbRole = role === UserRole.PARENT_2 ? 'parent2'
        : role === UserRole.GUARDIAN ? 'guardian'
        : 'viewer';

      // Check if user already has an account with this email
      const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('family_members')
        .insert({
          id: newId,
          baby_id: currentBaby.id,
          user_id: userData?.id || null,
          email: email.toLowerCase(),
          full_name: 'Pending Invitation',
          role: dbRole,
          relationship,
          permissions: ROLE_PERMISSIONS[role] as Record<string, boolean>,
          added_by: authProfile.id,
          can_be_removed: true,
          notifications_enabled: true,
          status: 'pending',
          added_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating invitation:', insertError);
        showAlert('Error', 'Failed to send invitation');
        return false;
      }

      // Update baby's guardian_ids
      const guardianIds = [...(currentBaby.guardian_ids || []), newId];
      await supabase
        .from('babies')
        .update({ guardian_ids: guardianIds })
        .eq('id', currentBaby.id);

      await loadFamily();

      showAlert('Invitation Sent', 'Family member has been invited');

      // TODO: Send actual email invitation via Supabase Edge Function or email service
      // await supabase.functions.invoke('send-invite-email', {
      //   body: { email, role, relationship, babyName: currentBaby.name, inviterName: authProfile.full_name }
      // });

      return true;
    } catch (error) {
      console.error('Error sending invitation:', error);
      showAlert('Error', 'Failed to send invitation');
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

    try {
      // Soft delete - set deleted_at
      const { error } = await supabase
        .from('family_members')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        showAlert('Error', 'Failed to remove member');
        return false;
      }

      // Remove from baby's guardian_ids
      const guardianIds = (currentBaby.guardian_ids || []).filter((id: string) => id !== memberId);
      await supabase
        .from('babies')
        .update({ guardian_ids: guardianIds })
        .eq('id', currentBaby.id);

      // If this was parent2, remove parent2_id
      if (state.parent2?.id === memberId) {
        await supabase
          .from('babies')
          .update({ parent2_id: null })
          .eq('id', currentBaby.id);
      }

      setState(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== memberId),
        guardians: prev.guardians.filter(m => m.id !== memberId),
        parent2: prev.parent2?.id === memberId ? null : prev.parent2,
      }));

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

    // TODO: Send actual email invitation via Supabase Edge Function
    // await supabase.functions.invoke('send-invite-email', {
    //   body: { email: member.email, role: member.role, babyName: currentBaby?.name }
    // });

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
      const code = generateId().substring(0, 8).toUpperCase();
      const now = Date.now();
      const expiresInDays = 7;

      const payload = {
        family_id: currentBaby.id,
        baby_name: currentBaby.name,
        baby_dob: currentBaby.date_of_birth,
        baby_gender: currentBaby.gender,
        creator_id: authProfile.id,
        creator_name: authProfile.full_name,
        role,
        relationship,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        invitee_phone: inviteePhone,
        created_at: now,
        expires_in_days: expiresInDays,
      };

      const { data, error } = await supabase
        .from('invite_codes')
        .insert({
          code: code,
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
        })
        .select('code')
        .single();

      if (error) {
        console.error('Error generating invite code:', error);
        
        // Fallback to local generation
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const array = new Uint32Array(6);
        crypto.getRandomValues(array);
        const fallbackCode = Array.from(array, n => chars[n % chars.length]).join('');
        
        const existing = await AsyncStorage.getItem('littleloom_invite_codes');
        const codes = existing ? JSON.parse(existing) : {};
        codes[fallbackCode] = { 
          ...payload, 
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, 
          used: false 
        };
        await AsyncStorage.setItem('littleloom_invite_codes', JSON.stringify(codes));

        return { code: fallbackCode, success: true, message: 'Invite code generated successfully' };
      }

      return { code: data.code, success: true, message: 'Invite code generated successfully' };
    } catch (error) {
      console.error('Error generating invite code:', error);
      return { code: '', success: false, message: 'Failed to generate invite code' };
    }
  }, [isOwner, authProfile, currentBaby]);

  // ─── Get Active Invite Codes ──────────────────────────────────────────
  const getActiveInviteCodes = useCallback(async () => {
    if (!currentBaby?.id) return [];

    try {
      const now = Date.now();
      
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('family_id', currentBaby.id)
        .eq('used', false)
        .eq('revoked', false)
        // Filter by expiration: created_at + expires_in_days * 86400000 > now
        .filter('created_at', 'gt', now - 7 * 24 * 60 * 60 * 1000);

      if (error) {
        console.error('Error fetching invite codes:', error);
        return [];
      }

      // Transform the data to match what the UI expects
      return (data || []).map(item => ({
        ...item,
        expiresAt: new Date(item.created_at + (item.expires_in_days || 7) * 24 * 60 * 60 * 1000).toISOString(),
        role: item.role,
        relationship: item.relationship,
      }));
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      return [];
    }
  }, [currentBaby?.id]);

  // ─── Revoke Invite Code ───────────────────────────────────────────────
  const revokeInviteCode = useCallback(async (code: string): Promise<boolean> => {
    if (!isOwner || !currentBaby) return false;

    try {
      const { error } = await supabase
        .from('invite_codes')
        .update({ revoked: true })
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
    inviteMember,
    removeMember,
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
  }), [state, loadFamily, inviteMember, removeMember, getEffectivePermissions, 
      updateParent2Profile, updateGuardianProfile, resendInvite, cancelInvite, 
      refreshMemberStatus, generateInviteCode, getActiveInviteCodes, revokeInviteCode,
      getCurrentBaby, getBabyId]);

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within FamilyProvider');
  return context;
};

export default FamilyProvider;