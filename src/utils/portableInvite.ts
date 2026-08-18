import { supabase } from '@/utils/supabase';

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

/* ─── Local-only helpers, unchanged — safe to keep, no network involved ─── */
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
  return encodeBase64(JSON.stringify(payload)).replace(/=+$/, '');
}
export function parseInviteCode(code: string): PortableInvitePayload | null {
  try { return JSON.parse(decodeBase64(code)); } catch { return null; }
}

/* ─── Row <-> payload mapping (snake_case DB columns <-> camelCase app shape) ─── */
type InviteRow = {
  code: string;
  family_id: string;
  baby_name: string | null;
  baby_dob: string | null;
  baby_gender: string | null;
  creator_id: string;
  creator_name: string | null;
  role: 'parent2' | 'guardian' | 'viewer';
  relationship: string | null;
  created_at: number;
  expires_in_days: number;
  used: boolean;
  used_by: string | null;
  used_at: number | null;
  revoked: boolean;
};

function rowToPayload(row: InviteRow): PortableInvitePayload {
  return {
    familyId: row.family_id,
    babyName: row.baby_name || '',
    babyDob: row.baby_dob || undefined,
    babyGender: row.baby_gender || undefined,
    creatorId: row.creator_id,
    creatorName: row.creator_name || '',
    role: row.role,
    relationship: row.relationship || undefined,
    createdAt: row.created_at,
    expiresInDays: row.expires_in_days,
  };
}

/* ─── Supabase-backed invite operations — this is the cross-device fix ─── */

export async function storeInviteCode(code: string, payload: PortableInvitePayload): Promise<void> {
  const { error } = await supabase.from('invite_codes').insert({
    code,
    family_id: payload.familyId,
    baby_name: payload.babyName,
    baby_dob: payload.babyDob,
    baby_gender: payload.babyGender,
    creator_id: payload.creatorId,
    creator_name: payload.creatorName,
    role: payload.role,
    relationship: payload.relationship,
    created_at: payload.createdAt,
    expires_in_days: payload.expiresInDays,
    used: false,
    revoked: false,
  });
  if (error) throw error;
}

export async function validateInviteCode(code: string): Promise
  { valid: true; invite: PortableInvitePayload } | { valid: false; message: string }
> {
  const trimmed = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', trimmed)
    .maybeSingle();

  if (error) return { valid: false, message: 'Could not reach the server — check your connection' };
  if (!data) return { valid: false, message: 'Invalid invite code' };
  if (data.revoked) return { valid: false, message: 'Invite code has been revoked' };
  if (data.used) return { valid: false, message: 'Invite code has already been used' };

  const expiresAt = data.created_at + data.expires_in_days * 86400000;
  if (Date.now() > expiresAt) return { valid: false, message: 'Invite code has expired' };

  return { valid: true, invite: rowToPayload(data as InviteRow) };
}

export async function markInviteCodeUsed(code: string, usedBy?: string): Promise<void> {
  const { error } = await supabase
    .from('invite_codes')
    .update({ used: true, used_by: usedBy ?? null, used_at: Date.now() })
    .eq('code', code.trim().toUpperCase());
  if (error) throw error;
}

export async function getActiveInvites(): Promise
  Array<{ code: string } & PortableInvitePayload & { used: boolean; revoked: boolean; expiresAt: number }>
> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('revoked', false)
    .eq('used', false);

  if (error || !data) return [];

  const now = Date.now();
  return (data as InviteRow[])
    .map(row => ({
      code: row.code,
      ...rowToPayload(row),
      used: row.used,
      revoked: row.revoked,
      expiresAt: row.created_at + row.expires_in_days * 86400000,
    }))
    .filter(inv => now <= inv.expiresAt);
}

export async function revokeInviteCode(code: string): Promise<boolean> {
  const { error } = await supabase
    .from('invite_codes')
    .update({ revoked: true })
    .eq('code', code.trim().toUpperCase());
  return !error;
}