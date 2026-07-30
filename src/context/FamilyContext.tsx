import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  getFamilyMembersByBabyFromDb,
  getFamilyMemberByIdFromDb,
  getFamilyMemberByEmailAndBabyFromDb,
  createFamilyMemberInDb,
  updateFamilyMemberInDb,
  softDeleteFamilyMemberInDb,
  getAppSetting,
} from '../database/dbHelpers';
import { familyMembers } from '../database/schema';

import { useBaby } from './BabyContext';
import { UserRole, Permission, ROLE_PERMISSIONS, FamilyMember } from '../types/roles';
import { useUser } from './UserContext';
import { useAuth } from './AuthContext';

export type { FamilyMember } from '../types/roles';

// Parent2 is now stored in family_members table with role='parent2'
// No more SecureStore key needed

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
  getActiveInviteCodes: () => Promise<import('@/database/dbHelpers').InviteCode[]>;
  revokeInviteCode: (code: string) => Promise<boolean>;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

// Safe alert that doesn't depend on external hooks
const showAlert = (title: string, message: string) => {
  if (typeof Alert !== 'undefined' && Alert.alert) {
    Alert.alert(title, message);
  } else {
    console.warn(`[FamilyContext] ${title}: ${message}`);
  }
};

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, permissions: myPermissions, isLoading: userLoading } = useUser();
  const { currentBaby, updateBaby, babies, switchBaby } = useBaby();

  const [state, setState] = useState<FamilyState>({
    isLoading: false,
    members: [],
    parent1: null,
    parent2: null,
    guardians: [],
    pendingInvites: [],
  });

  const initRef = useRef(false);

  // FIX: Account creator always has invite rights regardless of permission state
  const { userProfile: authProfile } = useAuth();
  const isOwner = useMemo(() => {
    if (!currentBaby) return false;
    const effectiveProfile = profile || authProfile;
    if (!effectiveProfile) return false;
    return effectiveProfile.role === 'parent1' || effectiveProfile.role === UserRole.PARENT_1 || currentBaby.parent1Id === effectiveProfile.id || currentBaby.parent1Id === authProfile?.id;
  }, [profile, authProfile, currentBaby]);

  useEffect(() => {
    if (userLoading) return;
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
  }, [currentBaby?.id, userLoading, profile, authProfile]);

  const loadFamily = useCallback(async () => {
    if (!currentBaby) return;
    if (userLoading) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const members: FamilyMember[] = [];

      const effectiveProfile = profile || authProfile;

      // Load the relationship the creator chose in BabyProfileCreateScreen
      let parent1Relationship = 'Parent';
      try {
        const savedRel = await getAppSetting(`parent1_relationship_${currentBaby.id}`);
        if (savedRel) parent1Relationship = savedRel;
      } catch (e) { /* ignore, fallback to 'Parent' */ }

      if (currentBaby.parent1Id && effectiveProfile) {
        members.push({
          id: currentBaby.parent1Id,
          userId: currentBaby.parent1Id,
          fullName: currentBaby.parent1Id === effectiveProfile.id ? effectiveProfile.fullName || parent1Relationship : parent1Relationship,
          email: effectiveProfile.email || '',
          avatar: effectiveProfile.avatar,
          role: UserRole.PARENT_1,
          relationship: parent1Relationship,
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          addedAt: currentBaby.createdAt,
          addedBy: currentBaby.parent1Id,
          canBeRemoved: false,
          phoneNumber: effectiveProfile.phoneNumber,
          notificationsEnabled: true,
          lastActive: new Date().toISOString(),
        });
      } else if (currentBaby.parent1Id && !effectiveProfile) {
        members.push({
          id: currentBaby.parent1Id,
          userId: currentBaby.parent1Id,
          fullName: 'Loading...',
          email: '',
          role: UserRole.PARENT_1,
          relationship: parent1Relationship,
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          addedAt: currentBaby.createdAt,
          addedBy: currentBaby.parent1Id,
          canBeRemoved: false,
          notificationsEnabled: true,
          lastActive: new Date().toISOString(),
        });
      }

      // Load all family members from Drizzle DB
      try {
        const dbMembers = await getFamilyMembersByBabyFromDb(currentBaby.id);
        
        for (const dbMember of dbMembers) {
          // Skip if this is parent1 (we already added from profile)
          if (dbMember.role === 'parent1') continue;
          
          const member: FamilyMember = {
            id: dbMember.id,
            userId: dbMember.userId || dbMember.id,
            fullName: dbMember.fullName,
            email: dbMember.email,
            avatar: dbMember.avatar || undefined,
            role: dbMember.role === 'parent2' ? UserRole.PARENT_2 
              : dbMember.role === 'guardian' ? UserRole.GUARDIAN 
              : UserRole.VIEWER,
            relationship: dbMember.relationship,
            permissions: dbMember.permissions as Permission || ROLE_PERMISSIONS[UserRole.VIEWER],
            addedAt: dbMember.addedAt,
            addedBy: dbMember.addedBy,
            canBeRemoved: dbMember.canBeRemoved,
            lastActive: dbMember.lastActive || undefined,
            phoneNumber: dbMember.phoneNumber || undefined,
            notificationsEnabled: dbMember.notificationsEnabled,
          };
          members.push(member);
        }
      } catch (error) {
        console.error('Error loading family members from DB:', error);
      }

      setState(prev => {
        const nextParent1 = members.find(m => m.role === UserRole.PARENT_1) || null;
        const nextParent2 = members.find(m => m.role === UserRole.PARENT_2) || null;
        const nextGuardians = members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER);
        const nextPending = members.filter(m => !m.lastActive && m.role !== UserRole.PARENT_1);

        /* Guard against reference churn: only swap if meaningful fields changed. */
        const membersChanged =
          members.length !== prev.members.length ||
          members.some((m, i) => {
            const p = prev.members[i];
            return (
              !p ||
              m.id !== p.id ||
              m.userId !== p.userId ||
              m.fullName !== p.fullName ||
              m.email !== p.email ||
              m.avatar !== p.avatar ||
              m.role !== p.role ||
              m.relationship !== p.relationship ||
              m.lastActive !== p.lastActive ||
              m.notificationsEnabled !== p.notificationsEnabled
            );
          });

        if (!membersChanged && !prev.isLoading) {
          return prev; // exact same state object → no re-renders
        }

        return {
          isLoading: false,
          members,
          parent1: nextParent1,
          parent2: nextParent2,
          guardians: nextGuardians,
          pendingInvites: nextPending,
        };
      });
    } catch (error) {
      console.error('Error loading family:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentBaby, profile, userLoading, authProfile]);

  const updateParent2Profile = useCallback(async (
    updates: Partial<Omit<FamilyMember, 'id' | 'userId' | 'role' | 'permissions' | 'addedAt' | 'addedBy' | 'canBeRemoved'>>
  ): Promise<boolean> => {
    if (!currentBaby?.parent2Id) {
      showAlert('Error', 'No Parent 2 found');
      return false;
    }

    const canManage = myPermissions?.manageFamily ?? false;

    if (!canManage) {
       showAlert('Error', 'You do not have permission to update family members');
      return false;
    }

    try {
      const parent2Member = await getFamilyMemberByIdFromDb(currentBaby.parent2Id);
      if (!parent2Member) {
        showAlert('Error', 'Parent 2 not found in database');
        return false;
      }

      const dbUpdates: Partial<typeof familyMembers.$inferInsert> = {};
      if (updates.fullName !== undefined) dbUpdates.fullName = updates.fullName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.phoneNumber !== undefined) dbUpdates.phoneNumber = updates.phoneNumber;
      dbUpdates.lastActive = new Date().toISOString();

      await updateFamilyMemberInDb(currentBaby.parent2Id, dbUpdates);

      if (updates.fullName || updates.email) {
        await updateBaby(currentBaby.id, {
          parent2Id: currentBaby.parent2Id,
        });
      }

      setState(prev => ({
        ...prev,
        parent2: prev.parent2 ? {
          ...prev.parent2,
          fullName: updates.fullName || prev.parent2.fullName,
          email: updates.email || prev.parent2.email,
          avatar: updates.avatar || prev.parent2.avatar,
          phoneNumber: updates.phoneNumber || prev.parent2.phoneNumber,
          lastActive: new Date().toISOString(),
        } : null,
        members: prev.members.map(m => 
          m.role === UserRole.PARENT_2 
            ? { 
                ...m, 
                fullName: updates.fullName || m.fullName,
                email: updates.email || m.email,
                avatar: updates.avatar || m.avatar,
                phoneNumber: updates.phoneNumber || m.phoneNumber,
                lastActive: new Date().toISOString(),
              }
            : m
        ),
      }));

      return true;
    } catch (error) {
      console.error('Error updating parent2 profile:', error);
      showAlert('Error', 'Failed to update Parent 2 profile');
      return false;
    }
  }, [currentBaby, myPermissions, updateBaby]);

  const updateGuardianProfile = useCallback(async (memberId: string, updates: Partial<FamilyMember>): Promise<boolean> => {
    const canManage = myPermissions?.manageFamily ?? false;

    if (!canManage) {
      showAlert('Error', 'Permission denied');
      return false;
    }

    try {
      const dbUpdates: Partial<typeof familyMembers.$inferInsert> = {};
      if (updates.fullName !== undefined) dbUpdates.fullName = updates.fullName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.phoneNumber !== undefined) dbUpdates.phoneNumber = updates.phoneNumber;
      if (updates.relationship !== undefined) dbUpdates.relationship = updates.relationship;
      if (updates.role !== undefined) {
        dbUpdates.role = updates.role === UserRole.PARENT_2 ? 'parent2'
          : updates.role === UserRole.GUARDIAN ? 'guardian'
          : 'viewer';
      }
      if (updates.notificationsEnabled !== undefined) dbUpdates.notificationsEnabled = updates.notificationsEnabled;

      await updateFamilyMemberInDb(memberId, dbUpdates);
      await loadFamily();

      return true;
    } catch (error) {
      showAlert('Error', 'Failed to update guardian');
      return false;
    }
  }, [currentBaby, myPermissions, loadFamily]);

  const inviteMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    if (!isOwner || !profile || !currentBaby) {
      showAlert('Permission Denied', 'Only the account creator can invite family members');
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    try {
      // Check for duplicate email
      const existingInvite = await getFamilyMemberByEmailAndBabyFromDb(email.toLowerCase(), currentBaby.id);
      if (existingInvite) {
        showAlert('Duplicate Invite', 'An invitation has already been sent to this email');
        return false;
      }

      const newId = generateId();
      const dbRole = role === UserRole.PARENT_2 ? 'parent2'
        : role === UserRole.GUARDIAN ? 'guardian'
        : 'viewer';

      await createFamilyMemberInDb({
        id: newId,
        babyId: currentBaby.id,
        userId: null, // pending invite has no userId yet
        email: email.toLowerCase(),
        fullName: 'Pending Invitation',
        role: dbRole,
        relationship,
        permissions: ROLE_PERMISSIONS[role] as Record<string, boolean>,
        addedBy: profile.id,
        canBeRemoved: true,
        notificationsEnabled: true,
        status: 'pending',
      });

      const updatedGuardianIds = [...(currentBaby.guardianIds || []), newId];
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      await loadFamily();

      showAlert('Invitation Sent', 'Family member has been invited');

      return true;
    } catch (error) {
      console.error('Error sending invitation:', error);
      showAlert('Error', 'Failed to send invitation');
      return false;
    }
  }, [myPermissions, profile, currentBaby, updateBaby, loadFamily]);

  const removeMember = useCallback(async (memberId: string) => {
    const canManage = myPermissions?.manageFamily ?? false;

    if (!canManage || !currentBaby) return false;

    if (profile?.id === memberId) {
      showAlert('Error', 'You cannot remove yourself from the family');
      return false;
    }

    try {
      await softDeleteFamilyMemberInDb(memberId);

      const updatedGuardianIds = (currentBaby.guardianIds || []).filter(id => id !== memberId);
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      if (state.parent2?.id === memberId) {
        await updateBaby(currentBaby.id, { parent2Id: undefined });
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
  }, [myPermissions, currentBaby, updateBaby, state.parent2, profile]);

  const resendInvite = useCallback(async (memberId: string): Promise<boolean> => {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return false;

    showAlert('Invitation Resent', `New invitation sent to ${member.email || 'member'}`);
    return true;
  }, [state.members]);

  const cancelInvite = useCallback(async (memberId: string): Promise<boolean> => {
    return removeMember(memberId);
  }, [removeMember]);

  const refreshMemberStatus = useCallback(async (memberId: string) => {
    await loadFamily();
  }, [loadFamily]);

  // ─── INVITE CODE GENERATION ──────────────────────────────────────────
  const generateInviteCode = useCallback(async (
    role: 'parent2' | 'guardian' | 'viewer',
    relationship?: string,
    inviteeName?: string,
    inviteeEmail?: string,
    inviteePhone?: string
  ): Promise<{ code: string; success: boolean; message: string }> => {
    if (!isOwner || !profile || !currentBaby) {
      return { code: '', success: false, message: 'Only the account creator can invite family members' };
    }

    try {
      const { createInviteCode } = await import('@/database/dbHelpers');
      const result = await createInviteCode({
        familyId: currentBaby.id,
        role,
        createdBy: profile.id,
        relationship,
        inviteeName,
        inviteeEmail,
        inviteePhone,
        maxUses: 1,
        expiresInDays: 7,
      });

      return result;
    } catch (error) {
      console.error('Error generating invite code:', error);
      return { code: '', success: false, message: 'Failed to generate invite code' };
    }
  }, [myPermissions, profile, currentBaby]);

  const getActiveInviteCodes = useCallback(async (): Promise<import('@/database/dbHelpers').InviteCode[]> => {
    if (!currentBaby) return [];
    try {
      const { getActiveInviteCodesForFamily } = await import('@/database/dbHelpers');
      return await getActiveInviteCodesForFamily(currentBaby.id);
    } catch (error) {
      console.error('Error getting active invite codes:', error);
      return [];
    }
  }, [currentBaby]);

  const revokeInviteCode = useCallback(async (code: string): Promise<boolean> => {
    if (!isOwner) return false;

    try {
      const { deactivateInviteCode } = await import('@/database/dbHelpers');
      return await deactivateInviteCode(code);
    } catch (error) {
      console.error('Error revoking invite code:', error);
      return false;
    }
  }, [myPermissions]);

  const getEffectivePermissions = useCallback((userId?: string): Permission => {
    const targetId = userId || profile?.id;
    const member = state.members.find(m => m.userId === targetId || m.id === targetId);
    return member?.permissions || ROLE_PERMISSIONS[UserRole.VIEWER];
  }, [state.members, profile]);

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
  }), [state, loadFamily, inviteMember, removeMember, getEffectivePermissions, updateParent2Profile, updateGuardianProfile, resendInvite, cancelInvite, refreshMemberStatus, generateInviteCode, getActiveInviteCodes, revokeInviteCode]);

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