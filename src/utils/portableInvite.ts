import AsyncStorage from '@react-native-async-storage/async-storage';

const INVITE_STORE_KEY = '@littleloom_invites_v1';
const USED_INVITES_KEY = '@littleloom_used_invites_v1';

export interface PortableInvitePayload {
  familyId: string;      // babyId
  babyName: string;
  babyDob?: string;
  babyGender?: string;
  creatorId: string;
  creatorName: string;
  role: 'parent2' | 'guardian' | 'viewer';
  relationship?: string;
  createdAt: number;
  expiresInDays: number;
}

function encodeBase64(str: string): string {
  if (typeof btoa !== 'undefined') return btoa(str);
  return Buffer.from(str).toString('base64');
}

function decodeBase64(str: string): string {
  const pad = str.length % 4;
  const padded = pad ? str + '='.repeat(4 - pad) : str;
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob !== 'undefined') return atob(normalized);
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function generateInviteCode(payload: PortableInvitePayload): string {
  const json = JSON.stringify(payload);
  return encodeBase64(json).replace(/=+$/, '');
}

export function parseInviteCode(code: string): PortableInvitePayload | null {
  try {
    return JSON.parse(decodeBase64(code));
  } catch {
    return null;
  }
}

export async function storeInviteCode(code: string, payload: PortableInvitePayload): Promise<void> {
  const stored = await AsyncStorage.getItem(INVITE_STORE_KEY);
  const invites = stored ? JSON.parse(stored) : {};
  invites[code] = { ...payload, used: false, revoked: false };
  await AsyncStorage.setItem(INVITE_STORE_KEY, JSON.stringify(invites));
}

export async function validateInviteCode(code: string): Promise<
  { valid: true; invite: PortableInvitePayload } | { valid: false; message: string }
> {
  const payload = parseInviteCode(code);
  if (!payload) return { valid: false, message: 'Invalid invite code format' };

  const now = Date.now();
  const expiresAt = payload.createdAt + payload.expiresInDays * 86400000;
  if (now > expiresAt) return { valid: false, message: 'Invite code has expired' };

  const stored = await AsyncStorage.getItem(INVITE_STORE_KEY);
  const invites = stored ? JSON.parse(stored) : {};
  if (invites[code]?.revoked) return { valid: false, message: 'Invite code has been revoked' };

  const usedStored = await AsyncStorage.getItem(USED_INVITES_KEY);
  const used = usedStored ? JSON.parse(usedStored) : {};
  if (used[code]) return { valid: false, message: 'Invite code has already been used' };

  return { valid: true, invite: payload };
}

export async function markInviteCodeUsed(code: string): Promise<void> {
  const usedStored = await AsyncStorage.getItem(USED_INVITES_KEY);
  const used = usedStored ? JSON.parse(usedStored) : {};
  used[code] = true;
  await AsyncStorage.setItem(USED_INVITES_KEY, JSON.stringify(used));
}

export async function getActiveInvites(): Promise<Array<{ code: string } & PortableInvitePayload & { used: boolean; revoked: boolean; expiresAt: number }>> {
  const stored = await AsyncStorage.getItem(INVITE_STORE_KEY);
  const invites: Record<string, any> = stored ? JSON.parse(stored) : {};
  const now = Date.now();
  return Object.entries(invites)
    .filter(([, v]) => {
      const expiresAt = v.createdAt + v.expiresInDays * 86400000;
      return now <= expiresAt && !v.revoked;
    })
    .map(([code, v]) => ({ code, ...v, expiresAt: v.createdAt + v.expiresInDays * 86400000 }));
}

export async function revokeInviteCode(code: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(INVITE_STORE_KEY);
  if (!stored) return false;
  const invites = JSON.parse(stored);
  if (invites[code]) {
    invites[code].revoked = true;
    await AsyncStorage.setItem(INVITE_STORE_KEY, JSON.stringify(invites));
    return true;
  }
  return false;
}