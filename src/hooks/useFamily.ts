// src/hooks/useFamily.ts
// Safe wrapper — FamilyContext is not yet exposed via useSafeContexts,
// so we inline a minimal fallback here.

import { useContext } from 'react';
import { FamilyContext } from '../context/FamilyContext';

function getFallbackFamily() {
  return {
    isLoading: false,
    members: [] as any[],
    parent1: null,
    parent2: null,
    guardians: [] as any[],
    pendingInvites: [] as any[],
    loadFamily: async () => {},
    inviteMember: async () => false,
    removeMember: async () => false,
    getEffectivePermissions: () => ({} as any),
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
  };
}

export function useFamily() {
  try {
    const context = useContext(FamilyContext);
    if (!context) return getFallbackFamily() as any;
    return context;
  } catch {
    return getFallbackFamily() as any;
  }
}

export default useFamily;