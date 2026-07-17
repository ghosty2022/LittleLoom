// src/database/dbHelpers.ts
// Migration helpers: AsyncStorage → Drizzle SQLite

import { db } from './db';
import { babies, trackerEntries, appSettings, familyMembers } from './schema';
import { eq, and, desc, count } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const MIGRATION_KEY = '@littleloom_db_migration_v1';
/* v2: explicit per-type migration of the legacy per-baby log keys
   (growth / milestones / sleep / feeding / potty / medication).
   Tracked separately so it also runs on installs where v1 already
   completed — v1 either skipped these or filed them under the wrong
   trackerId (see note at LEGACY_LOG_SPECS). */
const LOG_MIGRATION_KEY = '@littleloom_db_migration_v2_logs';

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY INVITATION CODE SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InviteCode {
  code: string;
  familyId: string;        // babyId this code is for
  role: 'parent2' | 'guardian' | 'viewer';
  createdBy: string;       // userId of parent1
  createdAt: string;
  expiresAt: string;       // ISO date
  maxUses: number;
  usedBy: string[];        // array of userIds who used it
  usedCount: number;
  isActive: boolean;
  relationship?: string;   // e.g., "Mother", "Father", "Grandparent"
}

const INVITE_CODE_PREFIX = '@littleloom_invite_';
const INVITE_CODE_INDEX_KEY = '@littleloom_invite_codes_index';

export async function isMigrationComplete(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MIGRATION_KEY);
  return flag === 'complete';
}

export async function markMigrationComplete(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_KEY, 'complete');
}

// ─── BABY HELPERS ───

export async function getAllBabiesFromDb() {
  try {
    return db.select().from(babies).where(eq(babies.isActive, true)).all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for getAllBabiesFromDb, returning []');
      return [];
    }
    throw error;
  }
}

export async function getBabyByIdFromDb(id: string) {
  try {
    const result = db.select().from(babies).where(eq(babies.id, id)).all();
    return result[0] || null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getBabyByIdFromDb('${id}'), returning null`);
      return null;
    }
    throw error;
  }
}

export async function getBabyCountFromDb(): Promise<number> {
  try {
    const result = db.select({ count: count() }).from(babies).where(eq(babies.isActive, true)).all();
    return result[0]?.count ?? 0;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for getBabyCountFromDb, returning 0');
      return 0;
    }
    throw error;
  }
}

export async function createBabyInDb(data: {
  id: string;
  name: string;
  avatar?: string;
  dateOfBirth: string;
  gender?: string;
  bloodType?: string;
  medicalNotes?: string;
  parent1Id?: string;
  parent2Id?: string;
}) {
  try {
    const now = new Date().toISOString();
    return db.insert(babies).values({
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for createBabyInDb, skipping');
      return [];
    }
    throw error;
  }
}

export async function updateBabyInDb(id: string, updates: Partial<typeof babies.$inferInsert>) {
  try {
    const now = new Date().toISOString();
    return db.update(babies)
      .set({ ...updates, updatedAt: now, syncStatus: 'pending' })
      .where(eq(babies.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for updateBabyInDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

export async function deleteBabyFromDb(id: string) {
  try {
    return db.update(babies)
      .set({ isActive: false, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(babies.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for deleteBabyFromDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

// ─── CURRENT BABY HELPERS (NEW - fixes your error) ───

export async function getCurrentBabyIdFromDb(): Promise<string | null> {
  return getAppSetting('current_baby_id');
}

export async function setCurrentBabyInDb(babyId: string | null): Promise<void> {
  if (babyId) {
    await setAppSetting('current_baby_id', babyId);
  } else {
    await deleteAppSetting('current_baby_id');
  }
}

export async function getCurrentBabyFromDb() {
  const babyId = await getCurrentBabyIdFromDb();
  if (!babyId) return null;
  return getBabyByIdFromDb(babyId);
}

// ─── TRACKER ENTRY HELPERS ───

export async function getEntriesByBabyFromDb(babyId: string, trackerId?: string) {
  try {
    if (trackerId) {
      return db.select().from(trackerEntries).where(
        and(eq(trackerEntries.babyId, babyId), eq(trackerEntries.trackerId, trackerId))
      ).orderBy(desc(trackerEntries.timestamp)).all();
    }
    return db.select().from(trackerEntries).where(eq(trackerEntries.babyId, babyId))
      .orderBy(desc(trackerEntries.timestamp)).all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getEntriesByBabyFromDb, returning []`);
      return [];
    }
    throw error;
  }
}

export async function getEntryByIdFromDb(id: string) {
  try {
    const result = db.select().from(trackerEntries).where(eq(trackerEntries.id, id)).all();
    return result[0] || null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getEntryByIdFromDb('${id}'), returning null`);
      return null;
    }
    throw error;
  }
}

export async function createEntryInDb(data: {
  id: string;
  trackerId: string;
  babyId: string;
  timestamp: number;
  title: string;
  data: Record<string, unknown>;
  notes?: string;
  photoUris?: string[];
  tags?: string[];
  location?: string;
  mood?: string;
  loggedBy?: string;
  loggedByName?: string;
  loggedByRole?: string;
}) {
  try {
    const now = new Date().toISOString();

    /* tracker_entries has no loggedBy* columns. Fold them into the JSON
       payload so the info is not silently dropped, and pass ONLY real
       columns to the insert — extra keys can raise unknown-column errors
       depending on the Drizzle/SQLite version. */
    const payload: Record<string, unknown> = { ...data.data };
    if (data.loggedBy !== undefined && payload.loggedBy === undefined) payload.loggedBy = data.loggedBy;
    if (data.loggedByName !== undefined && payload.loggedByName === undefined) payload.loggedByName = data.loggedByName;
    if (data.loggedByRole !== undefined && payload.loggedByRole === undefined) payload.loggedByRole = data.loggedByRole;

    return db.insert(trackerEntries).values({
      id: data.id,
      trackerId: data.trackerId,
      babyId: data.babyId,
      timestamp: data.timestamp,
      title: data.title,
      data: JSON.stringify(payload),
      notes: data.notes,
      photoUris: data.photoUris ? JSON.stringify(data.photoUris) : undefined,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      location: data.location,
      mood: data.mood,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for createEntryInDb, skipping');
      return [];
    }
    throw error;
  }
}

export async function updateEntryInDb(id: string, updates: Partial<typeof trackerEntries.$inferInsert>) {
  try {
    const now = new Date().toISOString();
    const processed = { ...updates };
    if (updates.data && typeof updates.data !== 'string') processed.data = JSON.stringify(updates.data);
    if (updates.photoUris && typeof updates.photoUris !== 'string') processed.photoUris = JSON.stringify(updates.photoUris);
    if (updates.tags && typeof updates.tags !== 'string') processed.tags = JSON.stringify(updates.tags);

    return db.update(trackerEntries)
      .set({ ...processed, updatedAt: now, syncStatus: 'pending' })
      .where(eq(trackerEntries.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for updateEntryInDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

export async function softDeleteEntryInDb(id: string) {
  try {
    return db.update(trackerEntries)
      .set({ isDeleted: true, syncStatus: 'deleted', updatedAt: new Date().toISOString() })
      .where(eq(trackerEntries.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for softDeleteEntryInDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

// ─── APP SETTINGS HELPERS (SAFE - with try/catch) ───

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const result = db.select().from(appSettings).where(eq(appSettings.key, key)).all();
    return result[0]?.value ?? null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getAppSetting('${key}'), returning null`);
      return null;
    }
    throw error;
  }
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await db.insert(appSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: now },
      });
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for setAppSetting('${key}'), skipping`);
      return;
    }
    throw error;
  }
}

export async function deleteAppSetting(key: string): Promise<void> {
  try {
    await db.delete(appSettings).where(eq(appSettings.key, key));
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for deleteAppSetting('${key}'), skipping`);
      return;
    }
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP SETTINGS BULK OPERATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getAllAppSettingKeys(): Promise<string[]> {
  try {
    const results = db.select({ key: appSettings.key }).from(appSettings).all();
    return results.map(r => r.key);
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for getAllAppSettingKeys, returning []');
      return [];
    }
    console.error('[DB] Failed to get all app setting keys:', error);
    return [];
  }
}

export async function multiRemoveAppSettings(keys: string[]): Promise<void> {
  try {
    for (const key of keys) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
    }
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for multiRemoveAppSettings, skipping');
      return;
    }
    console.error('[DB] Failed to multi-remove app settings:', error);
  }
}

// ─── FAMILY MEMBER HELPERS ───

export async function getFamilyMembersByBabyFromDb(babyId: string, includeDeleted = false) {
  try {
    const conditions = [eq(familyMembers.babyId, babyId)];
    if (!includeDeleted) {
      conditions.push(eq(familyMembers.isDeleted, false));
    }
    return db.select().from(familyMembers)
      .where(and(...conditions))
      .orderBy(desc(familyMembers.addedAt))
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getFamilyMembersByBabyFromDb, returning []`);
      return [];
    }
    throw error;
  }
}

export async function getFamilyMemberByIdFromDb(id: string) {
  try {
    const result = db.select().from(familyMembers)
      .where(eq(familyMembers.id, id))
      .all();
    return result[0] || null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getFamilyMemberByIdFromDb('${id}'), returning null`);
      return null;
    }
    throw error;
  }
}

export async function getFamilyMemberByEmailAndBabyFromDb(email: string, babyId: string) {
  try {
    const result = db.select().from(familyMembers)
      .where(
        and(
          eq(familyMembers.email, email),
          eq(familyMembers.babyId, babyId),
          eq(familyMembers.isDeleted, false)
        )
      )
      .all();
    return result[0] || null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for getFamilyMemberByEmailAndBabyFromDb, returning null`);
      return null;
    }
    throw error;
  }
}

export async function createFamilyMemberInDb(data: {
  id: string;
  babyId: string;
  email: string;
  fullName: string;
  role: string;
  relationship: string;
  permissions: Record<string, boolean>;
  addedBy: string;
  userId?: string | null;
  avatar?: string;
  phoneNumber?: string;
  canBeRemoved?: boolean;
  notificationsEnabled?: boolean;
  status?: string;
}) {
  try {
    const now = new Date().toISOString();
    return db.insert(familyMembers).values({
      ...data,
      addedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn('[DB] Table not ready for createFamilyMemberInDb, skipping');
      return [];
    }
    throw error;
  }
}

export async function updateFamilyMemberInDb(id: string, updates: Partial<typeof familyMembers.$inferInsert>) {
  try {
    const now = new Date().toISOString();
    const processed = { ...updates };
    if (updates.permissions && typeof updates.permissions !== 'string') {
      processed.permissions = JSON.stringify(updates.permissions) as any;
    }
    return db.update(familyMembers)
      .set({ ...processed, updatedAt: now, syncStatus: 'pending' })
      .where(eq(familyMembers.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for updateFamilyMemberInDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

export async function softDeleteFamilyMemberInDb(id: string) {
  try {
    return db.update(familyMembers)
      .set({ isDeleted: true, syncStatus: 'deleted', updatedAt: new Date().toISOString() })
      .where(eq(familyMembers.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for softDeleteFamilyMemberInDb('${id}'), skipping`);
      return [];
    }
    throw error;
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, I, 1 (confusing)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createInviteCode(data: {
  familyId: string;
  role: 'parent2' | 'guardian' | 'viewer';
  createdBy: string;
  relationship?: string;
  maxUses?: number;
  expiresInDays?: number;
}): Promise<{ code: string; success: boolean; message: string }> {
  try {
    // Check if user already has an active code for this family+role
    const existingCodes = await getActiveInviteCodesForFamily(data.familyId);
    const existingForRole = existingCodes.find(c => c.role === data.role && c.createdBy === data.createdBy && c.isActive);

    if (existingForRole) {
      // Return existing code if still valid
      const now = new Date();
      const expires = new Date(existingForRole.expiresAt);
      if (expires > now) {
        return { 
          code: existingForRole.code, 
          success: true, 
          message: 'Existing code still valid' 
        };
      }
    }

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    let existing = await getInviteCodeFromDb(code);

    while (existing && attempts < 10) {
      code = generateInviteCode();
      existing = await getInviteCodeFromDb(code);
      attempts++;
    }

    if (existing) {
      return { code: '', success: false, message: 'Could not generate unique code. Please try again.' };
    }

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

    const inviteData: InviteCode = {
      code,
      familyId: data.familyId,
      role: data.role,
      createdBy: data.createdBy,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      maxUses: data.maxUses || 1,
      usedBy: [],
      usedCount: 0,
      isActive: true,
      relationship: data.relationship,
    };

    await setAppSetting(`${INVITE_CODE_PREFIX}${code}`, JSON.stringify(inviteData));

    // Update index
    const indexStr = await getAppSetting(INVITE_CODE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];
    if (!index.includes(code)) {
      index.push(code);
      await setAppSetting(INVITE_CODE_INDEX_KEY, JSON.stringify(index));
    }

    return { code, success: true, message: 'Invite code created successfully' };
  } catch (error) {
    console.error('Error creating invite code:', error);
    return { code: '', success: false, message: 'Failed to create invite code' };
  }
}

export async function getInviteCodeFromDb(code: string): Promise<InviteCode | null> {
  try {
    const data = await getAppSetting(`${INVITE_CODE_PREFIX}${code}`);
    if (!data) return null;
    return JSON.parse(data) as InviteCode;
  } catch (error) {
    console.error('Error getting invite code:', error);
    return null;
  }
}

export async function validateInviteCode(code: string): Promise<{ 
  valid: boolean; 
  invite?: InviteCode; 
  message: string;
}> {
  try {
    const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (trimmed.length !== 6) {
      return { valid: false, message: 'Code must be 6 characters' };
    }

    const invite = await getInviteCodeFromDb(trimmed);

    if (!invite) {
      return { valid: false, message: 'Invalid invite code' };
    }

    if (!invite.isActive) {
      return { valid: false, message: 'This invite code has been deactivated' };
    }

    const now = new Date();
    const expiresAt = new Date(invite.expiresAt);

    if (now > expiresAt) {
      return { valid: false, message: 'This invite code has expired' };
    }

    if (invite.usedCount >= invite.maxUses) {
      return { valid: false, message: 'This invite code has reached its maximum uses' };
    }

    return { valid: true, invite, message: 'Code is valid!' };
  } catch (error) {
    console.error('Error validating invite code:', error);
    return { valid: false, message: 'Error validating code' };
  }
}

export async function markInviteCodeUsed(code: string, userId: string): Promise<boolean> {
  try {
    const invite = await getInviteCodeFromDb(code);
    if (!invite) return false;

    invite.usedBy.push(userId);
    invite.usedCount = invite.usedBy.length;

    if (invite.usedCount >= invite.maxUses) {
      invite.isActive = false;
    }

    await setAppSetting(`${INVITE_CODE_PREFIX}${code}`, JSON.stringify(invite));
    return true;
  } catch (error) {
    console.error('Error marking invite code used:', error);
    return false;
  }
}

export async function deactivateInviteCode(code: string): Promise<boolean> {
  try {
    const invite = await getInviteCodeFromDb(code);
    if (!invite) return false;

    invite.isActive = false;
    await setAppSetting(`${INVITE_CODE_PREFIX}${code}`, JSON.stringify(invite));
    return true;
  } catch (error) {
    console.error('Error deactivating invite code:', error);
    return false;
  }
}

export async function getActiveInviteCodesForFamily(familyId: string): Promise<InviteCode[]> {
  try {
    const indexStr = await getAppSetting(INVITE_CODE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];

    const codes: InviteCode[] = [];
    for (const code of index) {
      const invite = await getInviteCodeFromDb(code);
      if (invite && invite.familyId === familyId) {
        codes.push(invite);
      }
    }
    return codes;
  } catch (error) {
    console.error('Error getting active invite codes:', error);
    return [];
  }
}

export async function cleanupExpiredInviteCodes(): Promise<number> {
  try {
    const indexStr = await getAppSetting(INVITE_CODE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];

    const now = new Date();
    let cleaned = 0;
    const remaining: string[] = [];

    for (const code of index) {
      const invite = await getInviteCodeFromDb(code);
      if (!invite) {
        cleaned++;
        continue;
      }

      const expiresAt = new Date(invite.expiresAt);
      if (now > expiresAt || !invite.isActive) {
        await deleteAppSetting(`${INVITE_CODE_PREFIX}${code}`);
        cleaned++;
      } else {
        remaining.push(code);
      }
    }

    await setAppSetting(INVITE_CODE_INDEX_KEY, JSON.stringify(remaining));
    return cleaned;
  } catch (error) {
    console.error('Error cleaning up invite codes:', error);
    return 0;
  }
}

export async function deleteFamilyMembersByBabyFromDb(babyId: string) {
  try {
    return db.delete(familyMembers).where(eq(familyMembers.babyId, babyId));
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      console.warn(`[DB] Table not ready for deleteFamilyMembersByBabyFromDb, skipping`);
      return;
    }
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   V2 TRACKER LOG MIGRATION
   ═══════════════════════════════════════════════════════════════════════════
   The legacy per-baby log keys store shapes whose `type` field is NOT a
   tracker id (FeedingLog.type = 'breast' | 'bottle' | …, PottyLog.type =
   'pee' | 'poop' | …, SleepLog/MedicationLog have no `type` at all). The
   generic v1 migration mapped entry.type → trackerId, which would have
   filed those rows under 'breast', 'pee', 'unknown', etc. — unreadable by
   the app, which queries 'feeding' / 'potty' / 'sleep' / 'medication' /
   'growth' / 'milestone'.

   This migration therefore maps each key prefix to its trackerId and field
   layout EXPLICITLY. It is idempotent, and it also repairs rows that v1
   already imported under a wrong trackerId. */

interface LegacyLogSpec {
  prefix: string;
  trackerId: 'growth' | 'milestone' | 'sleep' | 'feeding' | 'potty' | 'medication';
  build: (raw: any) => {
    timestamp: number;
    title: string;
    data: Record<string, unknown>;
    notes?: string;
    photoUris?: string[];
  } | null;
}

const LEGACY_LOG_SPECS: LegacyLogSpec[] = [
  {
    prefix: '@littleloom_growth_',
    trackerId: 'growth',
    build: (raw) => {
      const ts = new Date(raw.date).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: `📏 ${raw.type}: ${raw.value} ${raw.unit}`,
        data: {
          measurementType: raw.type,
          value: raw.value,
          unit: raw.unit,
          date: raw.date,
          recordedBy: raw.recordedBy,
        },
        notes: raw.notes,
      };
    },
  },
  {
    prefix: '@littleloom_milestones_',
    trackerId: 'milestone',
    build: (raw) => {
      const ts = new Date(raw.achievedAt).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: raw.title || 'Milestone',
        data: {
          description: raw.description,
          category: raw.category,
          achievedAt: raw.achievedAt,
          firstTime: raw.isFirstTime,
          recordedBy: raw.recordedBy,
          recordedByName: raw.recordedByName,
        },
        notes: raw.notes,
        photoUris: raw.imageUrl ? [raw.imageUrl] : undefined,
      };
    },
  },
  {
    prefix: '@littleloom_sleep_',
    trackerId: 'sleep',
    build: (raw) => {
      const ts = new Date(raw.startTime).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: '😴 Sleep',
        data: {
          startTime: raw.startTime,
          endTime: raw.endTime,
          duration: raw.duration,
          quality: raw.quality,
          location: raw.location,
        },
        notes: raw.notes,
      };
    },
  },
  {
    prefix: '@littleloom_feeding_',
    trackerId: 'feeding',
    build: (raw) => {
      const ts = new Date(raw.startTime).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: '🍼 Feeding',
        data: {
          feedType: raw.type,
          startTime: raw.startTime,
          duration: raw.duration,
          amount: raw.amount,
          unit: raw.unit,
          food: raw.food,
        },
        notes: raw.notes,
      };
    },
  },
  {
    prefix: '@littleloom_potty_',
    trackerId: 'potty',
    build: (raw) => {
      const ts = new Date(raw.timestamp).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: '🚽 Potty',
        data: {
          pottyType: raw.type,
          location: raw.location,
          successful: raw.successful,
          timestamp: raw.timestamp,
        },
        notes: raw.notes,
      };
    },
  },
  {
    prefix: '@littleloom_medication_',
    trackerId: 'medication',
    build: (raw) => {
      const ts = new Date(raw.timestamp).getTime();
      return {
        timestamp: isNaN(ts) ? Date.now() : ts,
        title: `💊 ${raw.medicationName || 'Medication'}`,
        data: {
          medicationName: raw.medicationName,
          dosage: raw.dosage,
          reason: raw.reason,
          givenBy: raw.givenBy,
          timestamp: raw.timestamp,
        },
        notes: raw.notes,
      };
    },
  },
];

export async function runTrackerLogMigration(): Promise<void> {
  const flag = await AsyncStorage.getItem(LOG_MIGRATION_KEY);
  if (flag === 'complete') return;

  console.log('[Migration v2] Migrating per-baby logs → tracker_entries...');

  const allKeys = await AsyncStorage.getAllKeys();
  let migrated = 0;
  let healed = 0;

  for (const spec of LEGACY_LOG_SPECS) {
    const keys = allKeys.filter(k => k.startsWith(spec.prefix));

    for (const key of keys) {
      const babyId = key.slice(spec.prefix.length);
      if (!babyId) continue;

      const json = await AsyncStorage.getItem(key);
      if (!json) continue;

      let rawList: any[];
      try {
        rawList = JSON.parse(json);
      } catch (e) {
        console.error(`[Migration v2] Failed to parse ${key}:`, e);
        continue;
      }
      if (!Array.isArray(rawList)) continue;

      for (const raw of rawList) {
        if (!raw?.id) continue;
        try {
          const built = spec.build(raw);
          if (!built) continue;

          const existing = await getEntryByIdFromDb(raw.id);
          if (!existing) {
            await createEntryInDb({
              id: raw.id,
              trackerId: spec.trackerId,
              babyId: raw.babyId || babyId,
              timestamp: built.timestamp,
              title: built.title,
              data: built.data,
              notes: built.notes,
              photoUris: built.photoUris,
            });
            migrated++;
          } else if (existing.trackerId !== spec.trackerId) {
            /* Row exists but was filed under a wrong trackerId by the v1
               generic mapping (e.g. 'breast', 'pee', 'unknown') — repair it
               in place so the app can actually find it. */
            await updateEntryInDb(raw.id, {
              trackerId: spec.trackerId,
              timestamp: built.timestamp,
              title: built.title,
              data: built.data as any,
              notes: built.notes,
            });
            healed++;
          }
        } catch (e) {
          console.error(`[Migration v2] Failed to migrate entry ${raw.id} from ${key}:`, e);
        }
      }
    }
  }

  await AsyncStorage.setItem(LOG_MIGRATION_KEY, 'complete');
  console.log(`[Migration v2] Complete! Migrated ${migrated} logs, repaired ${healed} mis-filed rows.`);
}

// ─── ONE-TIME MIGRATION RUNNER ───

export async function runOneTimeMigration(): Promise<void> {
  if (!(await isMigrationComplete())) {

    console.log('[Migration] Starting AsyncStorage → Drizzle migration...');

    // 1. Migrate babies
    const babiesJson = await AsyncStorage.getItem('@littleloom_babies');
    if (babiesJson) {
      try {
        const babyList = JSON.parse(babiesJson);
        for (const baby of babyList) {
          const existing = await getBabyByIdFromDb(baby.id);
          if (!existing) {
            await createBabyInDb({
              id: baby.id,
              name: baby.name,
              avatar: baby.avatar,
              dateOfBirth: baby.birthDate || baby.dateOfBirth,
              gender: baby.gender === 'boy' ? 'male' : baby.gender === 'girl' ? 'female' : 'other',
              bloodType: baby.bloodType,
              medicalNotes: baby.medicalNotes,
              parent1Id: baby.parent1Id,
              parent2Id: baby.parent2Id,
            });
          }
        }
        console.log(`[Migration] Migrated ${babyList.length} babies`);
      } catch (e) {
        console.error('[Migration] Babies migration failed:', e);
      }
    }

    // 2. Migrate current baby
    const currentBabyId = await AsyncStorage.getItem('@littleloom_current_baby');
    if (currentBabyId) await setAppSetting('current_baby_id', currentBabyId);

    // 3. Migrate skipped flag
    const hasSkipped = await AsyncStorage.getItem('@littleloom_has_skipped_baby');
    if (hasSkipped) await setAppSetting('has_skipped_baby', hasSkipped);

    // 4. Migrate tracker entries from generic activity buckets only.
    //    growth/milestones/sleep/feeding/potty/medication keys are handled by
    //    runTrackerLogMigration() with explicit per-type field mapping — their
    //    raw `type` fields are NOT tracker ids, so the generic mapping below
    //    would file them under the wrong trackerId.
    const allKeys = await AsyncStorage.getAllKeys();
    const activityKeys = allKeys.filter(k =>
      k.startsWith('@littleloom_activities_') ||
      k.startsWith('@littleloom_entries_')
    );

    let entryCount = 0;
    for (const key of activityKeys) {
      const json = await AsyncStorage.getItem(key);
      if (!json) continue;
      try {
        const entries = JSON.parse(json);
        const babyId = key.split('_').pop() || '';
        for (const entry of entries) {
          if (!entry.id) continue;
          const existing = await getEntryByIdFromDb(entry.id);
          if (!existing) {
            const trackerId = entry.trackerId || entry.type || 'unknown';
            await createEntryInDb({
              id: entry.id,
              trackerId,
              babyId: entry.babyId || babyId,
              timestamp: entry.timestamp || Date.now(),
              title: entry.title || 'Untitled',
              data: entry.data || {},
              notes: entry.notes || entry.details,
              photoUris: entry.photoUris || (entry.photo ? [entry.photo] : undefined),
              tags: entry.tags,
              loggedBy: entry.loggedBy,
              loggedByName: entry.loggedByName,
              loggedByRole: entry.loggedByRole,
            });
            entryCount++;
          }
        }
      } catch (e) {
        console.error(`[Migration] Failed to migrate ${key}:`, e);
      }
    }
    console.log(`[Migration] Migrated ${entryCount} tracker entries`);

    // 5. Migrate app settings
    const themeMode = await AsyncStorage.getItem('@littleloom_theme_v2');
    if (themeMode) await setAppSetting('theme_mode', themeMode);

    const appearance = await AsyncStorage.getItem('@littleloom_appearance_v1');
    if (appearance) await setAppSetting('appearance', appearance);

    const notifSettings = await AsyncStorage.getItem('@littleloom_notification_settings');
    if (notifSettings) await setAppSetting('notification_settings', notifSettings);

    // 6. Migrate family members (guardians + parent2)
    const guardiansKeys = allKeys.filter(k => k.startsWith('littleloom_guardians_'));
    let familyCount = 0;
    for (const key of guardiansKeys) {
      const json = await AsyncStorage.getItem(key);
      if (!json) continue;
      try {
        const members = JSON.parse(json);
        const babyId = key.replace('littleloom_guardians_', '');
        for (const member of members) {
          if (!member.id) continue;
          const existing = await getFamilyMemberByIdFromDb(member.id);
          if (!existing) {
            await createFamilyMemberInDb({
              id: member.id,
              babyId: member.babyId || babyId,
              userId: member.userId || null,
              email: member.email || '',
              fullName: member.fullName || 'Unknown',
              role: member.role === 'PARENT_1' ? 'parent1'
                : member.role === 'PARENT_2' ? 'parent2'
                : member.role === 'GUARDIAN' ? 'guardian'
                : 'viewer',
              relationship: member.relationship || 'Guardian',
              permissions: member.permissions || {},
              addedBy: member.addedBy || '',
              avatar: member.avatar,
              phoneNumber: member.phoneNumber,
              canBeRemoved: member.canBeRemoved ?? true,
              notificationsEnabled: member.notificationsEnabled ?? true,
              status: member.userId ? 'active' : 'pending',
            });
            familyCount++;
          }
        }
      } catch (e) {
        console.error(`[Migration] Failed to migrate family members from ${key}:`, e);
      }
    }

    // 7. Migrate parent2 profile from SecureStore (best effort - may not exist)
    try {
      const parent2Str = await SecureStore.getItemAsync('littleloom_parent2_profile_secure');
      if (parent2Str) {
        const parent2Data = JSON.parse(parent2Str);
        console.log('[Migration] Parent2 profile found in SecureStore (baby record already migrated)');
      }
    } catch {
      // SecureStore may not be available in this context, that's OK
    }
    console.log(`[Migration] Migrated ${familyCount} family members`);

    // 8. Migrate community profile data from AsyncStorage to app_settings
    const communityKeys = [
      'littleloom_community_profile',
      'littleloom_username_registry',
      'littleloom_community_username',
      'littleloom_community_handle',
      'littleloom_community_bio',
      'littleloom_community_avatar',
      'littleloom_community_display_name',
      'littleloom_community_stats',
      '@community_selected_topics',
    ];

    let communityMigrated = 0;
    for (const key of communityKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          await setAppSetting(key, value);
          communityMigrated++;
        }
      } catch (e) {
        console.error(`[Migration] Failed to migrate community key ${key}:`, e);
      }
    }

    const userTopicKeys = allKeys.filter(k => k.startsWith('@community_selected_topics_'));
    for (const key of userTopicKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          await setAppSetting(key, value);
          communityMigrated++;
        }
      } catch (e) {
        console.error(`[Migration] Failed to migrate community key ${key}:`, e);
      }
    }

    console.log(`[Migration] Migrated ${communityMigrated} community settings`);

    await markMigrationComplete();
    console.log('[Migration] Complete!');
  }

  /* Always attempt the v2 log migration — it has its own completion flag,
     so it runs even on installs where v1 was already marked complete
     (i.e. devices whose sleep/feeding/potty/medication logs were written
     to AsyncStorage AFTER v1 ran, or were mis-filed by v1). */
  await runTrackerLogMigration();
}