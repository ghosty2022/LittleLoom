/**
 * Drop-in replacement for getActiveInviteCodes inside FamilyContext.tsx
 *
 * Prevents leaking invite codes that belong to other babies/families.
 * Prefer the server-side filter (familyId) when available.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Inside your FamilyContext component / provider:

const getActiveInviteCodes = useCallback(async () => {
  try {
    const { getActiveInvites } = await import('@/utils/portableInvite');
    // Pass currentBaby.id so the server only returns relevant invites
    const invites = await getActiveInvites(currentBaby?.id);
    return invites;
  } catch {
    // Offline / fallback path – still filter by familyId
    const raw = await AsyncStorage.getItem('littleloom_invite_codes');
    const codes = raw ? JSON.parse(raw) : {};

    return Object.entries(codes)
      .filter(([_, v]: [string, any]) => {
        const notUsed = !v.used;
        const notRevoked = !v.revoked;
        const notExpired = (v.expiresAt ?? 0) > Date.now();
        const belongsToCurrent =
          !currentBaby || v.familyId === currentBaby.id;
        return notUsed && notRevoked && notExpired && belongsToCurrent;
      })
      .map(([code, data]: [string, any]) => ({ code, ...data }));
  }
}, [currentBaby]);

export { getActiveInviteCodes };
