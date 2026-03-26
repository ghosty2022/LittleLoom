import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Import roles, permissions, and types from central location
import { UserRole, Permission, ROLE_PERMISSIONS, FamilyMember } from '../types/roles';

// Import from actual contexts - no more placeholders
import { useUser } from './UserContext';
import { useBaby } from './BabyContext';

const PARENT2_PROFILE_KEY = 'littleloom_parent2_profile_secure';

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

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, permissions: myPermissions } = useUser();
  const { currentBaby, updateBaby, babies, switchBaby } = useBaby();
  
  const [state, setState] = useState<FamilyState>({
    isLoading: false,
    members: [],
    parent1: null,
    parent2: null,
    guardians: [],
    pendingInvites: [],
  });

  // Load family when baby changes
  useEffect(() => {
    if (currentBaby) {
      loadFamily();
    }
  }, [currentBaby?.id]); // Only reload when baby ID changes, not entire object

  const loadFamily = useCallback(async () => {
    if (!currentBaby) return;
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const members: FamilyMember[] = [];
      
      // Load Parent 1 (current user)
      if (currentBaby.parent1Id && profile) {
        members.push({
          id: currentBaby.parent1Id,
          userId: currentBaby.parent1Id,
          fullName: profile.fullName,
          email: profile.email,
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
      }

      // Load Parent 2 from secure storage if exists
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

      // Load guardians from AsyncStorage
      const guardiansKey = `littleloom_guardians_${currentBaby.id}`;
      const guardiansStr = await AsyncStorage.getItem(guardiansKey);
      if (guardiansStr) {
        const guardianData = JSON.parse(guardiansStr);
        guardianData.forEach((g: FamilyMember) => {
          members.push({
            ...g,
            permissions: ROLE_PERMISSIONS[g.role] || ROLE_PERMISSIONS[UserRole.VIEWER],
            canBeRemoved: true,
          });
        });
      }

      setState({
        isLoading: false,
        members,
        parent1: members.find(m => m.role === UserRole.PARENT_1) || null,
        parent2: members.find(m => m.role === UserRole.PARENT_2) || null,
        guardians: members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER),
        pendingInvites: members.filter(m => !m.lastActive), // Members who haven't accepted yet
      });
    } catch (error) {
      console.error('Error loading family:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentBaby, profile]);

  const updateParent2Profile = useCallback(async (updates: Partial<Omit<FamilyMember, 'id' | 'userId' | 'role' | 'permissions' | 'addedAt' | 'addedBy' | 'canBeRemoved'>>): Promise<boolean> => {
    if (!currentBaby?.parent2Id) {
      Alert.alert('Error', 'No Parent 2 found');
      return false;
    }

    if (!myPermissions?.manageFamily) {
      Alert.alert('Error', 'You do not have permission to update family members');
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

      // Update current baby if parent2Id exists
      if (updates.fullName || updates.email) {
        await updateBaby(currentBaby.id, {
          parent2Id: currentBaby.parent2Id, // Ensure it stays linked
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
      Alert.alert('Error', 'Failed to update Parent 2 profile');
      return false;
    }
  }, [currentBaby, myPermissions, updateBaby]);

  const updateGuardianProfile = useCallback(async (memberId: string, updates: Partial<FamilyMember>): Promise<boolean> => {
    if (!myPermissions?.manageFamily) {
      Alert.alert('Error', 'Permission denied');
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
      await loadFamily(); // Refresh state
      
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to update guardian');
      return false;
    }
  }, [currentBaby, myPermissions, loadFamily]);

  const inviteMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    if (!myPermissions?.manageFamily || !profile || !currentBaby) return false;

    try {
      const newMember: FamilyMember = {
        id: Math.random().toString(36).substr(2, 9),
        userId: '', // Will be set when they accept
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
      guardians.push(newMember);

      await AsyncStorage.setItem(guardiansKey, JSON.stringify(guardians));
      
      // Update baby's guardianIds
      const updatedGuardianIds = [...(currentBaby.guardianIds || []), newMember.id];
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      await loadFamily();
      
      // Simulate sending invite
      Alert.alert('Invitation Sent', `An invitation has been sent to ${email}`);
      
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
      return false;
    }
  }, [myPermissions, profile, currentBaby, updateBaby, loadFamily]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!myPermissions?.manageFamily || !currentBaby) return false;

    try {
      // Remove from guardians storage
      const guardiansKey = `littleloom_guardians_${currentBaby.id}`;
      const existing = await AsyncStorage.getItem(guardiansKey);
      
      if (existing) {
        const guardians: FamilyMember[] = JSON.parse(existing);
        const filtered = guardians.filter(g => g.id !== memberId);
        await AsyncStorage.setItem(guardiansKey, JSON.stringify(filtered));
      }

      // Update baby's guardianIds
      const updatedGuardianIds = (currentBaby.guardianIds || []).filter(id => id !== memberId);
      await updateBaby(currentBaby.id, { guardianIds: updatedGuardianIds });

      // Handle Parent 2 removal
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
      Alert.alert('Error', 'Failed to remove member');
      return false;
    }
  }, [myPermissions, currentBaby, updateBaby, state.parent2]);

  const resendInvite = useCallback(async (memberId: string): Promise<boolean> => {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return false;
    
    Alert.alert('Invitation Resent', `A new invitation has been sent to ${member.email}`);
    return true;
  }, [state.members]);

  const cancelInvite = useCallback(async (memberId: string): Promise<boolean> => {
    return removeMember(memberId);
  }, [removeMember]);

  const refreshMemberStatus = useCallback(async (memberId: string) => {
    // Check if member has accepted invite
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