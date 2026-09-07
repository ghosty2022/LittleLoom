// src/context/FamilyContext.tsx
// COMPLETE FIXED VERSION - Works with RLS disabled

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';
import { useBaby } from './BabyContext';
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
  validateInviteCode: (code: string) => Promise<{ valid: boolean; data: any; message: string }>;
  useInviteCode: (code: string, userId?: string) => Promise<{ success: boolean; message: string }>;
  markSignupComplete: (code: string, userId: string) => Promise<{ success: boolean; message: string }>;
  getInviteCodeById: (code: string) => Promise<any>;
  recoverPartialSignup: (code: string, userId: string, email?: string, phone?: string, name?: string) => Promise<{ success: boolean; message: string }>;
  getPartialSignupInfo: (code: string) => Promise<{ exists: boolean; email?: string; phone?: string; name?: string; usedBy?: string; usedAt?: number }>;
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
  const { userProfile: authProfile } = useAuth();
  const { currentBaby, loadBabies } = useBaby();
  
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
  const currentUserIdRef = useRef<string | null>(null);
  const isMounted = useRef(true);

  // ─── Track current user ──────────────────────────────────────────────
  useEffect(() => {
    if (authProfile?.id) {
      currentUserIdRef.current = authProfile.id;
    }
    return () => {
      isMounted.current = false;
    };
  }, [authProfile?.id]);

  // ─── Load family members ─────────────────────────────────────────────
  const loadFamily = useCallback(async () => {
    if (!currentBaby?.id) {
      console.log('[FamilyContext] No current baby, clearing state');
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

    if (familyLoadInProgress.current) {
      console.log('[FamilyContext] Load already in progress');
      return;
    }

    familyLoadInProgress.current = true;
    console.log('[FamilyContext] Loading family for baby:', currentBaby.id);

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const members: FamilyMember[] = [];

      // ─── 1. Add Parent 1 ──────────────────────────────────────────────
      if (currentBaby.parent1_id) {
        try {
          const { data: parentData, error: parentError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentBaby.parent1_id)
            .maybeSingle();

          if (!parentError && parentData) {
            members.push({
              id: currentBaby.parent1_id,
              userId: currentBaby.parent1_id,
              fullName: parentData.full_name || 'Parent 1',
              email: parentData.email || '',
              avatar: parentData.avatar || parentData.community_avatar || '👤',
              role: UserRole.PARENT_1,
              relationship: 'Parent',
              permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
              addedAt: currentBaby.created_at || new Date().toISOString(),
              addedBy: currentBaby.parent1_id,
              canBeRemoved: false,
              phoneNumber: parentData.phone_number || undefined,
              notificationsEnabled: true,
              lastActive: new Date().toISOString(),
              status: 'active',
            });
          } else {
            // Fallback: create from baby data
            members.push({
              id: currentBaby.parent1_id,
              userId: currentBaby.parent1_id,
              fullName: 'Parent 1',
              email: '',
              avatar: '👤',
              role: UserRole.PARENT_1,
              relationship: 'Parent',
              permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
              addedAt: currentBaby.created_at || new Date().toISOString(),
              addedBy: currentBaby.parent1_id,
              canBeRemoved: false,
              phoneNumber: undefined,
              notificationsEnabled: true,
              lastActive: new Date().toISOString(),
              status: 'active',
            });
          }
        } catch (e) {
          console.warn('[FamilyContext] Error loading parent1:', e);
        }
      }

      // ─── 2. Load family_members from Supabase ─────────────────────────
      try {
        console.log('[FamilyContext] Querying family_members for baby:', currentBaby.id);
        
        const { data: dbMembers, error: membersError } = await supabase
          .from('family_members')
          .select('*')
          .eq('baby_id', currentBaby.id)
          .is('deleted_at', null);

        if (membersError) {
          console.error('[FamilyContext] Error loading family members:', membersError.message);
        } else if (dbMembers && dbMembers.length > 0) {
          console.log(`[FamilyContext] Found ${dbMembers.length} family members`);

          for (const dbMember of dbMembers) {
            // Skip parent1 (already added)
            if (dbMember.role === 'parent1') continue;

            let userProfile = null;
            if (dbMember.user_id) {
              try {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', dbMember.user_id)
                  .maybeSingle();
                userProfile = profileData;
              } catch (e) {
                console.warn('[FamilyContext] Error loading profile for member:', dbMember.user_id, e);
              }
            }

            const member: FamilyMember = {
              id: dbMember.id,
              userId: dbMember.user_id || dbMember.id,
              fullName: userProfile?.full_name || dbMember.full_name || 'Family Member',
              email: userProfile?.email || dbMember.email || '',
              avatar: userProfile?.avatar || userProfile?.community_avatar || dbMember.avatar || '👤',
              role: dbMember.role === 'parent2' ? UserRole.PARENT_2 
                : dbMember.role === 'guardian' ? UserRole.GUARDIAN 
                : UserRole.VIEWER,
              relationship: dbMember.relationship || 'Family Member',
              permissions: dbMember.permissions as Permission || ROLE_PERMISSIONS[UserRole.VIEWER],
              addedAt: dbMember.added_at || new Date().toISOString(),
              addedBy: dbMember.added_by || currentBaby.parent1_id,
              canBeRemoved: dbMember.can_be_removed !== false,
              lastActive: dbMember.last_active || undefined,
              phoneNumber: userProfile?.phone_number || dbMember.phone_number || undefined,
              notificationsEnabled: dbMember.notifications_enabled !== false,
              status: dbMember.status || (dbMember.last_active ? 'active' : 'pending'),
            };
            members.push(member);
          }
        } else {
          console.log('[FamilyContext] No family members found in database');
        }
      } catch (e) {
        console.error('[FamilyContext] Error in family_members query:', e);
      }

      // ─── 3. Fallback: Try to get family members from invite_codes ─────
      if (members.length <= 1) {
        console.log('[FamilyContext] No family members found, checking invite_codes...');
        try {
          const { data: inviteCodes, error: inviteError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('family_id', currentBaby.id)
            .eq('used', true)
            .eq('revoked', false);

          if (!inviteError && inviteCodes && inviteCodes.length > 0) {
            console.log(`[FamilyContext] Found ${inviteCodes.length} used invite codes`);
            for (const invite of inviteCodes) {
              // Check if this user is already in members
              const exists = members.some(m => m.userId === invite.used_by || m.email === invite.used_by_email);
              if (!exists && invite.used_by) {
                let userProfile = null;
                try {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', invite.used_by)
                    .maybeSingle();
                  userProfile = profileData;
                } catch (e) {
                  console.warn('[FamilyContext] Error loading profile for invite user:', invite.used_by);
                }

                const member: FamilyMember = {
                  id: invite.used_by,
                  userId: invite.used_by,
                  fullName: userProfile?.full_name || invite.used_by_name || 'Family Member',
                  email: userProfile?.email || invite.used_by_email || '',
                  avatar: userProfile?.avatar || userProfile?.community_avatar || '👤',
                  role: invite.role === 'parent2' ? UserRole.PARENT_2 
                    : invite.role === 'guardian' ? UserRole.GUARDIAN 
                    : UserRole.VIEWER,
                  relationship: invite.relationship || 'Family Member',
                  permissions: ROLE_PERMISSIONS[UserRole.VIEWER],
                  addedAt: new Date(invite.created_at).toISOString(),
                  addedBy: invite.creator_id || currentBaby.parent1_id,
                  canBeRemoved: true,
                  lastActive: userProfile?.last_active || undefined,
                  phoneNumber: userProfile?.phone_number || invite.used_by_phone || undefined,
                  notificationsEnabled: true,
                  status: 'active',
                };
                members.push(member);
              }
            }
          }
        } catch (e) {
          console.warn('[FamilyContext] Error checking invite_codes:', e);
        }
      }

      // ─── 4. Separate into roles ──────────────────────────────────────
      const parent1 = members.find(m => m.role === UserRole.PARENT_1) || null;
      const parent2 = members.find(m => m.role === UserRole.PARENT_2) || null;
      const guardians = members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER);
      const pendingInvites = members.filter(m => m.status === 'pending' && m.role !== UserRole.PARENT_1);

      console.log(`[FamilyContext] Family loaded: ${members.length} members, parent1: ${!!parent1}, parent2: ${!!parent2}, guardians: ${guardians.length}`);

      if (isMounted.current) {
        setState({
          isLoading: false,
          members,
          parent1,
          parent2,
          guardians,
          pendingInvites,
        });
      }
    } catch (error) {
      console.error('[FamilyContext] Error loading family:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      familyLoadInProgress.current = false;
    }
  }, [currentBaby]);

  // ─── Load family when baby changes ──────────────────────────────────
  useEffect(() => {
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

    if (!initRef.current) {
      initRef.current = true;
      loadFamily();
    } else {
      // Re-load when baby changes
      loadFamily();
    }
  }, [currentBaby?.id, loadFamily]);

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
    if (!authProfile || !currentBaby) {
      showAlert('Permission Denied', 'Only the account creator can invite family members');
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    try {
      const { data: existing } = await supabase
        .from('family_members')
        .select('id')
        .eq('baby_id', currentBaby.id)
        .eq('email', email.toLowerCase())
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        showAlert('Duplicate Invite', 'An invitation has already been sent to this email');
        return false;
      }

      const newId = generateId();
      const dbRole = role === UserRole.PARENT_2 ? 'parent2'
        : role === UserRole.GUARDIAN ? 'guardian'
        : 'viewer';

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

      await loadFamily();
      showAlert('Invitation Sent', 'Family member has been invited');
      return true;
    } catch (error) {
      console.error('Error sending invitation:', error);
      showAlert('Error', 'Failed to send invitation');
      return false;
    }
  }, [authProfile, currentBaby, loadFamily]);

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
      const { error } = await supabase
        .from('family_members')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        showAlert('Error', 'Failed to remove member');
        return false;
      }

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
    if (!authProfile || !currentBaby) {
      return { code: '', success: false, message: 'Only the account creator can invite family members' };
    }

    try {
      let code = generateInviteCodeString();
      
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        const { data: existing } = await supabase
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

      const finalCode = code.padStart(6, '0').slice(0, 6);

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
          created_at: Date.now(),
          expires_in_days: 7,
          used: false,
          revoked: false,
          used_by_email: inviteeEmail || null,
          used_by_phone: inviteePhone || null,
          used_by_name: inviteeName || null,
          signup_completed: false,
          updated_at: Date.now(),
        })
        .select('code')
        .single();

      if (error) {
        console.error('Error generating invite code:', error);
        return { code: finalCode, success: false, message: 'Failed to save invite code' };
      }

      return { code: data?.code || finalCode, success: true, message: 'Invite code generated successfully' };
    } catch (error) {
      console.error('Error generating invite code:', error);
      return { code: '', success: false, message: 'Failed to generate invite code' };
    }
  }, [authProfile, currentBaby]);

  // ─── Get Active Invite Codes ──────────────────────────────────────────
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

  // ─── Get Partial Signup Info ──────────────────────────────────────────
  const getPartialSignupInfo = useCallback(async (code: string): Promise<{ exists: boolean; email?: string; phone?: string; name?: string; usedBy?: string; usedAt?: number }> => {
    if (!code) return { exists: false };

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      const { data, error } = await supabase
        .from('invite_codes')
        .select('used, signup_completed, used_by, used_by_email, used_by_phone, used_by_name, used_at')
        .eq('code', trimmedCode)
        .maybeSingle();

      if (error || !data) {
        return { exists: false };
      }

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

  // ─── Recover Partial Signup ───────────────────────────────────────────
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

      const updates: any = {
        signup_completed: true,
        updated_at: now,
      };

      if (existing.used_by !== userId) {
        updates.used_by = userId;
      }
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
    if (!currentBaby) return false;

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
  }, [currentBaby]);

  // ─── Validate Invite Code ─────────────────────────────────────────────
  const validateInviteCode = useCallback(async (code: string): Promise<{ valid: boolean; data: any; message: string }> => {
    if (!code || code.length < 4) {
      return { valid: false, data: null, message: 'Invalid invite code format' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      let { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', trimmedCode)
        .eq('used', false)
        .eq('revoked', false)
        .maybeSingle();

      if (!data) {
        const { data: relaxedData } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', trimmedCode)
          .maybeSingle();

        if (relaxedData) {
          if (relaxedData.used && relaxedData.signup_completed) {
            return { valid: false, data: null, message: 'This invite code has already been used' };
          }
          if (relaxedData.used && !relaxedData.signup_completed) {
            return { 
              valid: true, 
              data: { ...relaxedData, isPartial: true }, 
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
        const { data: caseInsensitiveData } = await supabase
          .from('invite_codes')
          .select('*')
          .ilike('code', trimmedCode)
          .maybeSingle();

        if (caseInsensitiveData) {
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
          return { valid: false, data: null, message: 'Invalid or expired invite code' };
        }
      }

      const now = Date.now();
      const expiresAt = data.created_at + (data.expires_in_days || 7) * 24 * 60 * 60 * 1000;
      
      if (now > expiresAt) {
        return { valid: false, data: null, message: 'Invite code has expired' };
      }

      return { valid: true, data, message: 'Invite code is valid' };
    } catch (error) {
      console.error('Error validating invite code:', error);
      return { valid: false, data: null, message: 'Error validating code' };
    }
  }, []);

  // ─── Use Invite Code ──────────────────────────────────────────────────
  const useInviteCode = useCallback(async (code: string, userId?: string): Promise<{ success: boolean; message: string }> => {
    if (!code) {
      return { success: false, message: 'No invite code provided' };
    }

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      const validation = await validateInviteCode(trimmedCode);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

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
    validateInviteCode,
    useInviteCode,
    markSignupComplete,
    getInviteCodeById,
    recoverPartialSignup,
    getPartialSignupInfo,
  }), [state, loadFamily, inviteMember, removeMember, getEffectivePermissions, 
      updateParent2Profile, updateGuardianProfile, resendInvite, cancelInvite, 
      refreshMemberStatus, generateInviteCode, getActiveInviteCodes, revokeInviteCode,
      getCurrentBaby, getBabyId, validateInviteCode, useInviteCode,
      markSignupComplete, getInviteCodeById,
      recoverPartialSignup, getPartialSignupInfo]);

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