// src/database/dbHelpers.ts
// Database CRUD operations with Supabase sync

import { db } from './db';
import { babies, trackerEntries, appSettings, familyMembers } from './schema';
import { eq, and, desc, count, isNull, like, or } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

const MIGRATION_KEY = '@littleloom_db_migration_v1';
const BACKUP_KEY = '@littleloom_last_backup_time';

/* ═══════════════════════════════════════════════════════════════════════════
   USER REGISTRY TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UserRegistryEntry {
  userId: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: 'parent1' | 'parent2' | 'guardian' | string;
  createdAt: string;
  communityUsername?: string;
  communityHandle?: string;
  communityBio?: string;
  communityAvatar?: string;
  communityDisplayName?: string;
  communityStats?: {
    posts: number;
    followers: number;
    following: number;
    helpful: number;
  };
  communitySelectedTopics?: string[];
  socialProvider?: 'google' | 'apple' | 'facebook' | null;
  hasPassword?: boolean;
  phoneNumber?: string;
}

const USER_REGISTRY_KEY = 'littleloom_user_registry';

/* ─── USER REGISTRY ───────────────────────────────────────────────────── */

export async function getUserRegistry(): Promise<Record<string, UserRegistryEntry>> {
  try {
    const data = await AsyncStorage.getItem(USER_REGISTRY_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error loading user registry:', error);
    return {};
  }
}

export async function saveUserRegistry(registry: Record<string, UserRegistryEntry>): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(registry));
  } catch (error) {
    console.error('Error saving user registry:', error);
    throw error;
  }
}

export async function registerUser(entry: UserRegistryEntry): Promise<boolean> {
  try {
    const registry = await getUserRegistry();
    registry[entry.userId] = entry;
    await saveUserRegistry(registry);
    return true;
  } catch (error) {
    console.error('Error registering user:', error);
    return false;
  }
}

export async function updateUserInRegistry(
  userId: string,
  updates: Partial<UserRegistryEntry>
): Promise<boolean> {
  try {
    const registry = await getUserRegistry();
    if (registry[userId]) {
      registry[userId] = { ...registry[userId], ...updates };
      await saveUserRegistry(registry);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating user in registry:', error);
    return false;
  }
}

export async function findUserByEmail(
  email: string
): Promise<UserRegistryEntry | null> {
  try {
    const registry = await getUserRegistry();
    const searchEmail = email.trim().toLowerCase();
    
    for (const entry of Object.values(registry)) {
      if (entry.email.toLowerCase() === searchEmail) {
        return entry;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function findUserByUsername(
  username: string
): Promise<UserRegistryEntry | null> {
  try {
    const registry = await getUserRegistry();
    const searchUsername = username.trim().toLowerCase().replace(/^@/, '');
    
    for (const entry of Object.values(registry)) {
      const entryHandle = (entry.communityHandle || '').toLowerCase().replace(/^@/, '');
      const entryUsername = (entry.communityUsername || '').toLowerCase();
      
      if (entryHandle === searchUsername || entryUsername === searchUsername) {
        return entry;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
}

export async function findUserByPhone(
  phone: string
): Promise<UserRegistryEntry | null> {
  try {
    const registry = await getUserRegistry();
    const searchPhone = phone.trim().replace(/[^0-9+]/g, '');
    
    const formats = [
      searchPhone,
      searchPhone.replace(/^\+254/, '0'),
      searchPhone.replace(/^0/, '+254'),
      searchPhone.replace(/^254/, '0'),
      '+' + searchPhone.replace(/^0/, ''),
    ];
    
    for (const entry of Object.values(registry)) {
      if (!entry.phoneNumber) continue;
      const entryPhone = entry.phoneNumber.trim().replace(/[^0-9+]/g, '');
      if (formats.some(f => f === entryPhone)) {
        return entry;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
  }
}

export async function findUserByEmailOrUsername(
  identifier: string
): Promise<UserRegistryEntry | null> {
  try {
    const byEmail = await findUserByEmail(identifier);
    if (byEmail) return byEmail;
    const byUsername = await findUserByUsername(identifier);
    if (byUsername) return byUsername;
    return null;
  } catch (error) {
    console.error('Error finding user by email or username:', error);
    return null;
  }
}

export async function findUserByEmailOrUsernameOrPhone(
  identifier: string
): Promise<UserRegistryEntry | null> {
  try {
    const byEmail = await findUserByEmail(identifier);
    if (byEmail) return byEmail;
    const byUsername = await findUserByUsername(identifier);
    if (byUsername) return byUsername;
    const byPhone = await findUserByPhone(identifier);
    if (byPhone) return byPhone;
    return null;
  } catch (error) {
    console.error('Error finding user by email, username, or phone:', error);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BACKUP HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getLastBackupTime(): Promise<number | null> {
  try {
    const last = await AsyncStorage.getItem(BACKUP_KEY);
    return last ? parseInt(last, 10) : null;
  } catch {
    return null;
  }
}

export async function setLastBackupTime(time: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKUP_KEY, String(time));
  } catch {
    // Ignore
  }
}

export async function getAllUserDataForBackup(userId: string): Promise<{
  babies: any[];
  entries: Record<string, any[]>;
  familyMembers: Record<string, any[]>;
  appSettings: Record<string, string>;
}> {
  try {
    const allBabies = await getAllBabiesFromDb();
    
    const entries: Record<string, any[]> = {};
    const familyMembers: Record<string, any[]> = {};
    const appSettings: Record<string, string> = {};
    
    for (const baby of allBabies) {
      const babyEntries = await getEntriesByBabyFromDb(baby.id);
      entries[baby.id] = babyEntries;
      
      const babyFamily = await getFamilyMembersByBabyFromDb(baby.id);
      familyMembers[baby.id] = babyFamily;
    }
    
    const settingsKeys = [
      'current_baby_id',
      'has_skipped_baby',
      'community_username',
      'community_handle',
      'community_bio',
      'community_avatar',
      'community_display_name',
      'community_stats',
      'community_selected_topics',
    ];
    
    for (const key of settingsKeys) {
      const val = await getAppSetting(key);
      if (val) appSettings[key] = val;
    }
    
    return { babies: allBabies, entries, familyMembers, appSettings };
  } catch (error) {
    console.error('Error getting user data for backup:', error);
    throw error;
  }
}

export async function restoreFromBackupData(
  backupData: any,
  userId: string
): Promise<{ restoredBabies: number; restoredEntries: number; restoredFamily: number }> {
  let restoredBabies = 0;
  let restoredEntries = 0;
  let restoredFamily = 0;
  
  try {
    for (const baby of backupData.babies || []) {
      const exists = await getBabyByIdFromDb(baby.id);
      if (!exists) {
        await createBabyInDb({
          id: baby.id,
          name: baby.name,
          avatar: baby.avatar || baby.avatar,
          dateOfBirth: baby.dateOfBirth || baby.date_of_birth,
          gender: baby.gender || baby.gender,
          bloodType: baby.bloodType || baby.blood_type,
          medicalNotes: baby.medicalNotes || baby.medical_notes,
          parent1Id: baby.parent1Id || baby.parent1_id || userId,
          parent2Id: baby.parent2Id || baby.parent2_id,
        });
        restoredBabies++;
      } else {
        await updateBabyInDb(baby.id, {
          name: baby.name,
          avatar: baby.avatar || baby.avatar,
          dateOfBirth: baby.dateOfBirth || baby.date_of_birth,
          gender: baby.gender || baby.gender,
          bloodType: baby.bloodType || baby.blood_type,
          medicalNotes: baby.medicalNotes || baby.medical_notes,
          parent2Id: baby.parent2Id || baby.parent2_id,
        });
        restoredBabies++;
      }
    }
    
    for (const [babyId, entries] of Object.entries(backupData.entries || {})) {
      for (const entry of entries as any[]) {
        const exists = await getEntryByIdFromDb(entry.id);
        if (!exists) {
          await createEntryInDb({
            id: entry.id,
            trackerId: entry.trackerId || entry.type || 'unknown',
            babyId: entry.babyId || babyId,
            timestamp: entry.timestamp || Date.now(),
            title: entry.title || 'Untitled',
            data: entry.data || {},
            notes: entry.notes || entry.details,
            photoUris: entry.photoUris || entry.photo_uris || (entry.photo ? [entry.photo] : undefined),
            tags: entry.tags,
            loggedBy: entry.loggedBy || userId,
            loggedByName: entry.loggedByName || 'Restored User',
            loggedByRole: entry.loggedByRole || 'parent1',
          });
          restoredEntries++;
        }
      }
    }
    
    for (const [babyId, members] of Object.entries(backupData.familyMembers || {})) {
      for (const member of members as any[]) {
        const exists = await getFamilyMemberByIdFromDb(member.id);
        if (!exists) {
          await createFamilyMemberInDb({
            id: member.id,
            babyId: member.babyId || babyId,
            email: member.email,
            fullName: member.fullName,
            role: member.role,
            relationship: member.relationship || 'Family',
            permissions: member.permissions || {},
            addedBy: member.addedBy || userId,
            userId: member.userId || null,
            avatar: member.avatar,
            phoneNumber: member.phoneNumber,
            canBeRemoved: member.canBeRemoved ?? true,
            notificationsEnabled: member.notificationsEnabled ?? true,
            status: member.status || 'active',
          });
          restoredFamily++;
        }
      }
    }
    
    for (const [key, value] of Object.entries(backupData.appSettings || {})) {
      await setAppSetting(key, String(value));
    }
    
    return { restoredBabies, restoredEntries, restoredFamily };
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function isMigrationComplete(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MIGRATION_KEY);
  return flag === 'complete';
}

export async function markMigrationComplete(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_KEY, 'complete');
}

/* ─── APP SETTINGS ───────────────────────────────────────────────────── */

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const result = db.select().from(appSettings).where(eq(appSettings.key, key)).all();
    return result[0]?.value ?? null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
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
      return;
    }
    throw error;
  }
}

/* ─── BABIES ────────────────────────────────────────────────────────── */

// ─── BACKGROUND SYNC HELPER ────────────────────────────────────────────
async function syncBabiesFromSupabaseBackground() {
  try {
    console.log('[DB] Background sync: Fetching babies from Supabase...');
    
    const { data: remoteBabies, error } = await supabase
      .from('babies')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.warn('[DB] Background sync error:', error.message);
      return;
    }

    if (!remoteBabies || remoteBabies.length === 0) {
      console.log('[DB] Background sync: No babies found in Supabase');
      return;
    }

    console.log(`[DB] Background sync: Found ${remoteBabies.length} babies in Supabase`);

    const now = new Date().toISOString();
    let syncedCount = 0;

    for (const baby of remoteBabies) {
      try {
        // Check if baby exists locally
        const exists = db.select().from(babies).where(eq(babies.id, baby.id)).all();
        
        if (exists.length === 0) {
          console.log(`[DB] Background sync: Creating baby "${baby.name}" (${baby.id})`);
          db.insert(babies).values({
            id: baby.id,
            name: baby.name,
            avatar: baby.avatar ?? undefined,
            dateOfBirth: baby.date_of_birth,
            gender: baby.gender ?? undefined,
            bloodType: baby.blood_type ?? undefined,
            medicalNotes: baby.medical_notes ?? undefined,
            parent1Id: baby.parent1_id ?? undefined,
            parent2Id: baby.parent2_id ?? undefined,
            createdAt: baby.created_at ?? now,
            updatedAt: now,
            isActive: baby.is_active ?? true,
            syncStatus: 'synced',
          }).run();
          syncedCount++;
        } else {
          // Update existing baby
          db.update(babies)
            .set({
              name: baby.name,
              avatar: baby.avatar ?? undefined,
              dateOfBirth: baby.date_of_birth,
              gender: baby.gender ?? undefined,
              bloodType: baby.blood_type ?? undefined,
              medicalNotes: baby.medical_notes ?? undefined,
              parent1Id: baby.parent1_id ?? undefined,
              parent2Id: baby.parent2_id ?? undefined,
              updatedAt: now,
              isActive: baby.is_active ?? true,
              syncStatus: 'synced',
            })
            .where(eq(babies.id, baby.id))
            .run();
        }
      } catch (babyError) {
        console.error(`[DB] Background sync: Error syncing baby "${baby.name}":`, babyError);
      }
    }

    console.log(`[DB] Background sync: Completed - ${syncedCount} new babies, ${remoteBabies.length - syncedCount} existing`);

    // Also update current_baby_id if not set
    const currentId = await getAppSetting('current_baby_id');
    if (!currentId && remoteBabies[0]) {
      await setAppSetting('current_baby_id', remoteBabies[0].id);
      console.log(`[DB] Background sync: Set current baby to "${remoteBabies[0].name}"`);
    }

  } catch (error) {
    console.error('[DB] Background sync error:', error);
  }
}

export async function getAllBabiesFromDb(forceSync: boolean = false) {
  try {
    // First, get local data immediately
    let localBabies = db.select().from(babies).where(eq(babies.isActive, true)).all();
    
    // If we have local data, return it immediately
    if (localBabies.length > 0) {
      // Trigger background sync if requested
      if (forceSync) {
        console.log('[DB] getAllBabiesFromDb: Triggering background sync (already have local data)');
        syncBabiesFromSupabaseBackground().catch(e => 
          console.warn('[DB] Background sync failed:', e)
        );
      }
      return localBabies;
    }
    
    // No local data, try to sync from Supabase
    console.log('[DB] getAllBabiesFromDb: No local babies, trying to sync...');
    
    try {
      const { data: remoteBabies, error } = await supabase
        .from('babies')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.warn('[DB] getAllBabiesFromDb: Supabase error:', error.message);
        return [];
      }

      if (!remoteBabies || remoteBabies.length === 0) {
        console.log('[DB] getAllBabiesFromDb: No babies found in Supabase');
        return [];
      }

      console.log(`[DB] getAllBabiesFromDb: Found ${remoteBabies.length} babies in Supabase, syncing...`);

      const now = new Date().toISOString();
      for (const baby of remoteBabies) {
        try {
          const exists = db.select().from(babies).where(eq(babies.id, baby.id)).all();
          if (exists.length === 0) {
            db.insert(babies).values({
              id: baby.id,
              name: baby.name,
              avatar: baby.avatar ?? undefined,
              dateOfBirth: baby.date_of_birth,
              gender: baby.gender ?? undefined,
              bloodType: baby.blood_type ?? undefined,
              medicalNotes: baby.medical_notes ?? undefined,
              parent1Id: baby.parent1_id ?? undefined,
              parent2Id: baby.parent2_id ?? undefined,
              createdAt: baby.created_at ?? now,
              updatedAt: now,
              isActive: baby.is_active ?? true,
              syncStatus: 'synced',
            }).run();
          } else {
            db.update(babies)
              .set({
                name: baby.name,
                avatar: baby.avatar ?? undefined,
                dateOfBirth: baby.date_of_birth,
                gender: baby.gender ?? undefined,
                bloodType: baby.blood_type ?? undefined,
                medicalNotes: baby.medical_notes ?? undefined,
                parent1Id: baby.parent1_id ?? undefined,
                parent2Id: baby.parent2_id ?? undefined,
                updatedAt: now,
                isActive: baby.is_active ?? true,
                syncStatus: 'synced',
              })
              .where(eq(babies.id, baby.id))
              .run();
          }
        } catch (babyError) {
          console.error(`[DB] getAllBabiesFromDb: Error syncing baby "${baby.name}":`, babyError);
        }
      }

      // Set current baby if not set
      const currentId = await getAppSetting('current_baby_id');
      if (!currentId && remoteBabies[0]) {
        await setAppSetting('current_baby_id', remoteBabies[0].id);
        console.log(`[DB] getAllBabiesFromDb: Set current baby to "${remoteBabies[0].name}"`);
      }

      // Return the newly synced data
      return db.select().from(babies).where(eq(babies.isActive, true)).all();
      
    } catch (syncError) {
      console.error('[DB] getAllBabiesFromDb: Sync error:', syncError);
      return [];
    }
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return [];
    }
    console.error('[DB] getAllBabiesFromDb error:', error);
    return [];
  }
}

export async function getBabyByIdFromDb(id: string, forceSync: boolean = false) {
  try {
    // First check local DB
    const result = db.select().from(babies).where(eq(babies.id, id)).all();
    if (result[0]) return result[0];

    // Only try Supabase if forceSync is true and local not found
    if (forceSync) {
      try {
        const { data, error } = await supabase
          .from('babies')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const now = new Date().toISOString();
          db.insert(babies).values({
            id: data.id,
            name: data.name,
            avatar: data.avatar ?? undefined,
            dateOfBirth: data.date_of_birth,
            gender: data.gender ?? undefined,
            bloodType: data.blood_type ?? undefined,
            medicalNotes: data.medical_notes ?? undefined,
            parent1Id: data.parent1_id ?? undefined,
            parent2Id: data.parent2_id ?? undefined,
            createdAt: data.created_at ?? now,
            updatedAt: now,
            isActive: data.is_active ?? true,
            syncStatus: 'synced',
          }).run();

          const pulled = db.select().from(babies).where(eq(babies.id, id)).all();
          if (pulled[0]) {
            console.log(`[DB] Synced baby '${data.name}' from Supabase`);
            return pulled[0];
          }
        }
      } catch (pullError) {
        console.warn(`[DB] Supabase pull error for baby('${id}'):`, pullError);
      }
    }

    return null;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return null;
    }
    console.error(`[DB] getBabyByIdFromDb error for ${id}:`, error);
    return null;
  }
}

export async function getBabyCountFromDb(): Promise<number> {
  try {
    const result = db.select({ count: count() }).from(babies).where(eq(babies.isActive, true)).all();
    return result[0]?.count ?? 0;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
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
    const inserted = db.insert(babies).values({
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();

    // Best-effort push to Supabase
    supabase.from('babies').upsert({
      id: data.id,
      name: data.name,
      avatar: data.avatar ?? null,
      date_of_birth: data.dateOfBirth,
      gender: data.gender ?? null,
      blood_type: data.bloodType ?? null,
      medical_notes: data.medicalNotes ?? null,
      parent1_id: data.parent1Id ?? null,
      parent2_id: data.parent2Id ?? null,
      created_at: now,
      updated_at: now,
      is_active: true,
    }).then(({ error }) => {
      if (error) console.warn('[DB] Supabase push failed:', error.message);
      else db.update(babies).set({ syncStatus: 'synced' }).where(eq(babies.id, data.id)).run();
    });

    return inserted;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return [];
    }
    throw error;
  }
}

export async function updateBabyInDb(id: string, updates: Partial<typeof babies.$inferInsert>) {
  try {
    const now = new Date().toISOString();
    const result = db.update(babies)
      .set({ ...updates, updatedAt: now, syncStatus: 'pending' })
      .where(eq(babies.id, id))
      .returning()
      .all();

    const remoteUpdates: Record<string, unknown> = { updated_at: now };
    if (updates.name !== undefined) remoteUpdates.name = updates.name;
    if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
    if (updates.dateOfBirth !== undefined) remoteUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.gender !== undefined) remoteUpdates.gender = updates.gender;
    if (updates.bloodType !== undefined) remoteUpdates.blood_type = updates.bloodType;
    if (updates.medicalNotes !== undefined) remoteUpdates.medical_notes = updates.medicalNotes;
    if (updates.parent1Id !== undefined) remoteUpdates.parent1_id = updates.parent1Id;
    if (updates.parent2Id !== undefined) remoteUpdates.parent2_id = updates.parent2Id;
    if (updates.isActive !== undefined) remoteUpdates.is_active = updates.isActive;

    supabase.from('babies').update(remoteUpdates).eq('id', id).then(({ error }) => {
      if (error) console.warn(`[DB] Supabase push failed for updateBabyInDb('${id}'):`, error.message);
      else db.update(babies).set({ syncStatus: 'synced' }).where(eq(babies.id, id)).run();
    });

    return result;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
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
      return [];
    }
    throw error;
  }
}

export async function setCurrentBabyInDb(babyId: string | null): Promise<void> {
  if (babyId) {
    await setAppSetting('current_baby_id', babyId);
  } else {
    await deleteAppSetting('current_baby_id');
  }
}

export async function getCurrentBabyFromDb() {
  const babyId = await getAppSetting('current_baby_id');
  if (!babyId) return null;
  return getBabyByIdFromDb(babyId);
}

export async function getCurrentBabyData(babyId: string) {
  try {
    const localBaby = await getBabyByIdFromDb(babyId);
    if (localBaby) return localBaby;

    const { data, error } = await supabase
      .from('babies')
      .select('*')
      .eq('id', babyId)
      .maybeSingle();

    if (error || !data) {
      console.warn(`[DB] getCurrentBabyData: Baby ${babyId} not found in Supabase`);
      return null;
    }

    const now = new Date().toISOString();
    await createBabyInDb({
      id: data.id,
      name: data.name,
      avatar: data.avatar ?? undefined,
      dateOfBirth: data.date_of_birth,
      gender: data.gender ?? undefined,
      bloodType: data.blood_type ?? undefined,
      medicalNotes: data.medical_notes ?? undefined,
      parent1Id: data.parent1_id ?? undefined,
      parent2Id: data.parent2_id ?? undefined,
    });

    return await getBabyByIdFromDb(babyId);
  } catch (error) {
    console.error('[DB] getCurrentBabyData error:', error);
    return null;
  }
}

/* ─── TRACKER ENTRIES ──────────────────────────────────────────────── */

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
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  editedBy?: string;
  editedAt?: number;
}) {
  try {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { ...data.data };
    if (data.loggedBy !== undefined) payload.loggedBy = data.loggedBy;
    if (data.loggedByName !== undefined) payload.loggedByName = data.loggedByName;
    if (data.loggedByRole !== undefined) payload.loggedByRole = data.loggedByRole;

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
      loggedBy: data.loggedBy,
      loggedByName: data.loggedByName,
      loggedByRole: data.loggedByRole,
      notificationId: data.notificationId,
      reminderScheduled: data.reminderScheduled,
      syncedAt: data.syncedAt,
      editedBy: data.editedBy,
      editedAt: data.editedAt,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return [];
    }
    throw error;
  }
}

export async function updateEntryInDb(id: string, updates: Partial<typeof trackerEntries.$inferInsert>) {
  try {
    const now = new Date().toISOString();
    const processed = { ...updates };
    if (updates.data && typeof updates.data !== 'string') {
      const existing = await getEntryByIdFromDb(id);
      const existingData = existing?.data ? (typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data) : {};
      processed.data = JSON.stringify({ ...existingData, ...updates.data });
    }
    if (updates.photoUris && typeof updates.photoUris !== 'string') {
      processed.photoUris = JSON.stringify(updates.photoUris);
    }
    if (updates.tags && typeof updates.tags !== 'string') {
      processed.tags = JSON.stringify(updates.tags);
    }

    return db.update(trackerEntries)
      .set({ ...processed, updatedAt: now, syncStatus: 'pending' })
      .where(eq(trackerEntries.id, id))
      .returning()
      .all();
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
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
      return [];
    }
    throw error;
  }
}

/* ─── FAMILY MEMBERS ───────────────────────────────────────────────── */

export async function getFamilyMembersByBabyFromDb(babyId: string, includeDeleted = false) {
  try {
    try {
      const { data: remoteRows, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('baby_id', babyId);

      if (!error && remoteRows) {
        for (const row of remoteRows) {
          const existsLocally = db.select({ id: familyMembers.id })
            .from(familyMembers)
            .where(eq(familyMembers.id, row.id))
            .all();
          if (existsLocally.length === 0) {
            db.insert(familyMembers).values({
              id: row.id,
              babyId: row.baby_id,
              userId: row.user_id ?? null,
              email: row.email,
              fullName: row.full_name,
              avatar: row.avatar ?? undefined,
              role: row.role,
              relationship: row.relationship ?? 'Family',
              permissions: row.permissions ?? {},
              addedAt: row.added_at,
              addedBy: row.added_by,
              canBeRemoved: row.can_be_removed ?? true,
              lastActive: row.last_active ?? undefined,
              phoneNumber: row.phone_number ?? undefined,
              notificationsEnabled: row.notifications_enabled ?? true,
              status: row.status ?? 'pending',
              updatedAt: row.updated_at ?? new Date().toISOString(),
              syncStatus: 'synced',
              isDeleted: false,
            }).onConflictDoNothing().run();
          }
        }
      }
    } catch (pullError) {
      console.warn('[DB] Supabase pull failed for family members:', pullError);
    }

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
    const inserted = db.insert(familyMembers).values({
      ...data,
      addedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }).returning().all();

    supabase.from('family_members').upsert({
      id: data.id,
      baby_id: data.babyId,
      user_id: data.userId ?? null,
      email: data.email,
      full_name: data.fullName,
      avatar: data.avatar ?? null,
      role: data.role,
      relationship: data.relationship,
      permissions: data.permissions ?? {},
      added_at: now,
      added_by: data.addedBy,
      can_be_removed: data.canBeRemoved ?? true,
      phone_number: data.phoneNumber ?? null,
      notifications_enabled: data.notificationsEnabled ?? true,
      status: data.status ?? 'pending',
      updated_at: now,
    }).then(({ error }) => {
      if (error) console.warn('[DB] Supabase push failed for family member:', error.message);
      else db.update(familyMembers).set({ syncStatus: 'synced' }).where(eq(familyMembers.id, data.id)).run();
    });

    return inserted;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
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

    const result = db.update(familyMembers)
      .set({ ...processed, updatedAt: now, syncStatus: 'pending' })
      .where(eq(familyMembers.id, id))
      .returning()
      .all();

    const remoteUpdates: Record<string, unknown> = { updated_at: now };
    if (updates.fullName !== undefined) remoteUpdates.full_name = updates.fullName;
    if (updates.email !== undefined) remoteUpdates.email = updates.email;
    if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
    if (updates.phoneNumber !== undefined) remoteUpdates.phone_number = updates.phoneNumber;
    if (updates.relationship !== undefined) remoteUpdates.relationship = updates.relationship;
    if (updates.role !== undefined) remoteUpdates.role = updates.role;
    if (updates.permissions !== undefined) remoteUpdates.permissions = updates.permissions;
    if (updates.notificationsEnabled !== undefined) remoteUpdates.notifications_enabled = updates.notificationsEnabled;
    if (updates.status !== undefined) remoteUpdates.status = updates.status;
    if (updates.lastActive !== undefined) remoteUpdates.last_active = updates.lastActive;

    supabase.from('family_members').update(remoteUpdates).eq('id', id).then(({ error }) => {
      if (error) console.warn(`[DB] Supabase push failed for updateFamilyMemberInDb('${id}'):`, error.message);
      else db.update(familyMembers).set({ syncStatus: 'synced' }).where(eq(familyMembers.id, id)).run();
    });

    return result;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return [];
    }
    throw error;
  }
}

export async function softDeleteFamilyMemberInDb(id: string) {
  try {
    const now = new Date().toISOString();
    const result = db.update(familyMembers)
      .set({ isDeleted: true, syncStatus: 'deleted', updatedAt: now })
      .where(eq(familyMembers.id, id))
      .returning()
      .all();

    supabase.from('family_members').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn(`[DB] Supabase delete failed for softDeleteFamilyMemberInDb('${id}'):`, error.message);
    });

    return result;
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return [];
    }
    throw error;
  }
}

export async function deleteFamilyMembersByBabyFromDb(babyId: string) {
  try {
    return db.delete(familyMembers).where(eq(familyMembers.babyId, babyId));
  } catch (error) {
    const msg = String(error);
    if (msg.includes('no such table') || msg.includes('prepareSync')) {
      return;
    }
    throw error;
  }
}

/* ─── ONE-TIME MIGRATION ───────────────────────────────────────────── */

export async function runOneTimeMigration(): Promise<void> {
  if (await isMigrationComplete()) return;

  console.log('[Migration] Starting AsyncStorage → Drizzle migration...');

  // Migrate babies
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

  // Migrate current baby
  const currentBabyId = await AsyncStorage.getItem('@littleloom_current_baby');
  if (currentBabyId) await setAppSetting('current_baby_id', currentBabyId);

  // Migrate skipped flag
  const hasSkipped = await AsyncStorage.getItem('@littleloom_has_skipped_baby');
  if (hasSkipped) await setAppSetting('has_skipped_baby', hasSkipped);

  // Migrate tracker entries
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

  // Migrate app settings
  const themeMode = await AsyncStorage.getItem('@littleloom_theme_v2');
  if (themeMode) await setAppSetting('theme_mode', themeMode);

  const appearance = await AsyncStorage.getItem('@littleloom_appearance_v1');
  if (appearance) await setAppSetting('appearance', appearance);

  // Migrate user registry
  try {
    const oldRegistry = await AsyncStorage.getItem('littleloom_username_registry');
    if (oldRegistry) {
      const parsed = JSON.parse(oldRegistry);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const newRegistry: Record<string, UserRegistryEntry> = {};
        const profileStr = await AsyncStorage.getItem('littleloom_user_profile_secure');
        if (profileStr) {
          try {
            const profile = JSON.parse(profileStr);
            if (profile && profile.id) {
              for (const [username, userId] of Object.entries(parsed)) {
                if (userId === profile.id) {
                  newRegistry[profile.id] = {
                    userId: profile.id,
                    email: profile.email || '',
                    fullName: profile.fullName || 'User',
                    avatar: profile.avatar || '👤',
                    role: profile.role || 'parent1',
                    createdAt: profile.createdAt || new Date().toISOString(),
                    communityUsername: username,
                    communityHandle: `@${username}`,
                    communityDisplayName: profile.fullName || username,
                  };
                  break;
                }
              }
            }
          } catch (e) {
            console.warn('[Migration] Failed to parse user profile:', e);
          }
        }
        if (Object.keys(newRegistry).length > 0) {
          await saveUserRegistry(newRegistry);
          console.log('[Migration] Migrated user registry');
        }
      }
    }
  } catch (e) {
    console.warn('[Migration] User registry migration failed:', e);
  }

  await markMigrationComplete();
  console.log('[Migration] Complete!');
}