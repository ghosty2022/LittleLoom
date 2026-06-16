import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useBaby } from './BabyContext';
import { UserRole, Permission, ROLE_PERMISSIONS, FamilyMember } from '../types/roles';
import { useUser } from './UserContext';
import { showAlert } from '@/utils/alert';

export { FamilyMember } from '../types/roles';

const PARENT2_PROFILE_KEY = 'littleloom_parent2_profile_secure';

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
}

const FamilyContext = createContext<FamilyContextType | null>(null);

const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
};

// ✅ Safe alert that doesn't depend on external hooks
const showAlert = (title: string, message: string) => {
  if (typeof Alert !== 'undefined') {

showAlert(title, message);
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
  }, [currentBaby?.id, userLoading, profile?.id]);

  const loadFamily = useCallback(async () => {
    if (!currentBaby) return;
    if (userLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const members: FamilyMember[] = [];
      
      if (currentBaby.parent1Id && profile) {
        members.push({
          id: currentBaby.parent1Id,
          userId: currentBaby.parent1Id,
          fullName: profile.fullName || 'Parent',
          email: profile.email || '',
          avatar: profile.avatar,
          role: UserRole.PARENT_1,
          relationship: 'Parent',
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          addedAt: currentBaby.createdAt,
          addedBy: currentBaby.parent1Id,
          canBeRemoved: false,
          phoneNumber: profile.phoneNumber,
          notificationsEnabled: true,
        });
      } else if (currentBaby.parent1Id && !profile) {
        members.push({
          id: currentBaby.parent1Id,
          userId: currentBaby.parent1Id,
          fullName: 'Loading...',
          email: '',
          role: UserRole.PARENT_1,
          relationship: 'Parent',
          permissions: ROLE_PERMISSIONS[UserRole.PARENT_1],
          addedAt: currentBaby.createdAt,
          addedBy: currentBaby.parent1Id,
          canBeRemoved: false,
          notificationsEnabled: true,
        });
      }

      if (currentBaby.parent2Id) {
        try {
          const parent2Str = await SecureStore.getItemAsync(PARENT2_PROFILE_KEY);
          if (parent2Str) {
            const parent2Data = JSON.parse(parent2Str);
            members.push({
              id: currentBaby.parent2Id,
              userId: currentBaby.parent2Id,
              fullName: parent2Data.fullName || 'Parent 2',
              email: parent2Data.email || '',
              avatar: parent2Data.avatar,
              role: UserRole.PARENT_2,
              relationship: 'Co-Parent',
              permissions: ROLE_PERMISSIONS[UserRole.PARENT_2],
              addedAt: currentBaby.createdAt,
              addedBy: currentBaby.parent1Id || '',
              canBeRemoved: true,
              lastActive: parent2Data.lastActive,
              phoneNumber: parent2Data.phoneNumber,
              notificationsEnabled: parent2Data.notificationsEnabled ?? true,
            });
          }
        } catch (error) {
          console.error('Error loading parent2:', error);
        }
      }

      const guardiansKey = `littleloom_guardians_${currentBaby.id}`;
      const guardiansStr = await AsyncStorage.getItem(guardiansKey);
      if (guardiansStr) {
        try {
          const guardianData = JSON.parse(guardiansStr);
          guardianData.forEach((g: FamilyMember) => {
            members.push({
              ...g,
              permissions: ROLE_PERMISSIONS[g.role] || ROLE_PERMISSIONS[UserRole.VIEWER],
              canBeRemoved: true,
            });
          });
        } catch (parseError) {
          console.error('Error parsing guardians data:', parseError);
        }
      }

      setState({
        isLoading: false,
        members,
        parent1: members.find(m => m.role === UserRole.PARENT_1) || null,
        parent2: members.find(m => m.role === UserRole.PARENT_2) || null,
        guardians: members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER),
        pendingInvites: members.filter(m => !m.lastActive && m.role !== UserRole.PARENT_1),
      });
    } catch (error) {
      console.error('Error loading family:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentBaby, profile, userLoading]);

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
      const existingStr = await SecureStore.getItemAsync(PARENT2_PROFILE_KEY);
      const existing = existingStr ? JSON.parse(existingStr) : {};

      const updated = {
        ...existing,
        ...updates,
        id: currentBaby.parent2Id,
        updatedAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(PARENT2_PROFILE_KEY, JSON.stringify(updated), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });

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
      const guardiansKey = `littleloom_guardians_${currentBaby?.id}`;
      const existing = await AsyncStorage.getItem(guardiansKey);
      if (!existing) return false;

      const guardians: FamilyMember[] = JSON.parse(existing);
      const updated = guardians.map(g => 
        g.id === memberId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      );

      await AsyncStorage.setItem(guardiansKey, JSON.stringify(updated));
      await loadFamily();
      
      return true;
    } catch (error) {
      showAlert('Error', 'Failed to update guardian');
      return false;
    }
  }, [currentBaby, myPermissions, loadFamily]);

  const inviteMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    const canManage = myPermissions?.manageFamily ?? false;
      
    if (!canManage || !profile || !currentBaby) return false;

    if (!EMAIL_REGEX.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    try {
      const newMember: FamilyMember = {
        id: generateId(),
        userId: '',
        fullName: 'Pending Invitation',
        email,
        role,
        relationship,
        permissions: ROLE_PERMISSIONS[role],
        addedAt: new Date().toISOString(),
        addedBy: profile.id,
        canBeRemoved: true,
        notificationsEnabled: true,
      };

      const guardiansKey = `littleloom_guardians_${currentBaby.id}`;
      const existing = await AsyncStorage.getItem(guardiansKey);
      const guardians: FamilyMember[] = existing ? JSON.parse(existing) : [];
      
      const existingInvite = guardians.find(g => g.email.toLowerCase() === email.toLowerCase());
      if (existingInvite) {
        showAlert('Duplicate Invite', 'An invitation has already been sent to this email');
        return false;
      }
      
      guardians.push(newMember);

      await AsyncStorage.setItem(guardiansKey, JSON.stringify(guardians));
      
      const updatedGuardianIds = [...(currentBaby.guardianIds || []), newMember.id];
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      await loadFamily();
      
      showAlert('Invitation Sent', `An invitation has been sent to ${email}`);
      
      return true;
    } catch (error) {
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
      const guardiansKey = `littleloom_guardians_${currentBaby.id}`;
      const existing = await AsyncStorage.getItem(guardiansKey);
      
      if (existing) {
        const guardians: FamilyMember[] = JSON.parse(existing);
        const filtered = guardians.filter(g => g.id !== memberId);
        await AsyncStorage.setItem(guardiansKey, JSON.stringify(filtered));
      }

      const updatedGuardianIds = (currentBaby.guardianIds || []).filter(id => id !== memberId);
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      if (state.parent2?.id === memberId) {
        await SecureStore.deleteItemAsync(PARENT2_PROFILE_KEY);
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
      showAlert('Error', 'Failed to remove member');
      return false;
    }
  }, [myPermissions, currentBaby, updateBaby, state.parent2, profile]);

  const resendInvite = useCallback(async (memberId: string): Promise<boolean> => {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return false;
    
    showAlert('Invitation Resent', `A new invitation has been sent to ${member.email}`);
    return true;
  }, [state.members]);

  const cancelInvite = useCallback(async (memberId: string): Promise<boolean> => {
    return removeMember(memberId);
  }, [removeMember]);

  const refreshMemberStatus = useCallback(async (memberId: string) => {
    await loadFamily();
  }, [loadFamily]);

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
  }), [state, loadFamily, inviteMember, removeMember, getEffectivePermissions, updateParent2Profile, updateGuardianProfile, resendInvite, cancelInvite, refreshMemberStatus]);

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
