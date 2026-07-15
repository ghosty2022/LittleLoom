// src/database/dbHelpers.ts
// Migration helpers: AsyncStorage → Drizzle SQLite

import { db } from './db';
import { babies, trackerEntries, appSettings, familyMembers } from './schema';
import { eq, and, desc } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const MIGRATION_KEY = '@littleloom_db_migration_v1';

export async function isMigrationComplete(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MIGRATION_KEY);
  return flag === 'complete';
}

export async function markMigrationComplete(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_KEY, 'complete');
}

// ─── BABY HELPERS ───

export async function getAllBabiesFromDb() {
  return db.select().from(babies).where(eq(babies.isActive, true)).all();
}

export async function getBabyByIdFromDb(id: string) {
  const result = db.select().from(babies).where(eq(babies.id, id)).all();
  return result[0] || null;
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
  const now = new Date().toISOString();
  return db.insert(babies).values({
    ...data,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }).returning().all();
}

export async function updateBabyInDb(id: string, updates: Partial<typeof babies.$inferInsert>) {
  const now = new Date().toISOString();
  return db.update(babies)
    .set({ ...updates, updatedAt: now, syncStatus: 'pending' })
    .where(eq(babies.id, id))
    .returning()
    .all();
}

export async function deleteBabyFromDb(id: string) {
  return db.update(babies)
    .set({ isActive: false, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
    .where(eq(babies.id, id))
    .returning()
    .all();
}

// ─── TRACKER ENTRY HELPERS ───

export async function getEntriesByBabyFromDb(babyId: string, trackerId?: string) {
  if (trackerId) {
    return db.select().from(trackerEntries).where(
      and(eq(trackerEntries.babyId, babyId), eq(trackerEntries.trackerId, trackerId))
    ).orderBy(desc(trackerEntries.timestamp)).all();
  }
  return db.select().from(trackerEntries).where(eq(trackerEntries.babyId, babyId))
    .orderBy(desc(trackerEntries.timestamp)).all();
}

export async function getEntryByIdFromDb(id: string) {
  const result = db.select().from(trackerEntries).where(eq(trackerEntries.id, id)).all();
  return result[0] || null;
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
  const now = new Date().toISOString();
  return db.insert(trackerEntries).values({
    ...data,
    data: JSON.stringify(data.data),
    photoUris: data.photoUris ? JSON.stringify(data.photoUris) : undefined,
    tags: data.tags ? JSON.stringify(data.tags) : undefined,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }).returning().all();
}

export async function updateEntryInDb(id: string, updates: Partial<typeof trackerEntries.$inferInsert>) {
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
}

// REPLACE softDeleteEntryInDb with:
export async function softDeleteEntryInDb(id: string) {
  return db.update(trackerEntries)
    .set({ isDeleted: true, syncStatus: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(trackerEntries.id, id))
    .returning()
    .all();
}

// ─── APP SETTINGS HELPERS ───

export async function getAppSetting(key: string): Promise<string | null> {
  const result = db.select().from(appSettings).where(eq(appSettings.key, key)).all();
  return result[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
    });
}

export async function deleteAppSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP SETTINGS BULK OPERATIONS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getAllAppSettingKeys(): Promise<string[]> {
  try {
    const results = db.select({ key: appSettings.key }).from(appSettings).all();
    return results.map(r => r.key);
  } catch (error) {
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
    console.error('[DB] Failed to multi-remove app settings:', error);
  }
}

// ─── FAMILY MEMBER HELPERS ───

export async function getFamilyMembersByBabyFromDb(babyId: string, includeDeleted = false) {
  const conditions = [eq(familyMembers.babyId, babyId)];
  if (!includeDeleted) {
    conditions.push(eq(familyMembers.isDeleted, false));
  }
  return db.select().from(familyMembers)
    .where(and(...conditions))
    .orderBy(desc(familyMembers.addedAt))
    .all();
}

export async function getFamilyMemberByIdFromDb(id: string) {
  const result = db.select().from(familyMembers)
    .where(eq(familyMembers.id, id))
    .all();
  return result[0] || null;
}

export async function getFamilyMemberByEmailAndBabyFromDb(email: string, babyId: string) {
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
  userId?: string;
  avatar?: string;
  phoneNumber?: string;
  canBeRemoved?: boolean;
  notificationsEnabled?: boolean;
  status?: string;
}) {
  const now = new Date().toISOString();
  return db.insert(familyMembers).values({
    ...data,
    addedAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }).returning().all();
}

export async function updateFamilyMemberInDb(id: string, updates: Partial<typeof familyMembers.$inferInsert>) {
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
}

export async function softDeleteFamilyMemberInDb(id: string) {
  return db.update(familyMembers)
    .set({ isDeleted: true, syncStatus: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(familyMembers.id, id))
    .returning()
    .all();
}

export async function deleteFamilyMembersByBabyFromDb(babyId: string) {
  return db.delete(familyMembers).where(eq(familyMembers.babyId, babyId));
}

// ─── ONE-TIME MIGRATION RUNNER ───

export async function runOneTimeMigration(): Promise<void> {
  if (await isMigrationComplete()) return;

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

  // 4. Migrate tracker entries from all activity keys
  const allKeys = await AsyncStorage.getAllKeys();
  const activityKeys = allKeys.filter(k => 
    k.startsWith('@littleloom_activities_') || 
    k.startsWith('@littleloom_entries_') ||
    k.startsWith('@littleloom_growth_') ||
    k.startsWith('@littleloom_milestones_') ||
    k.startsWith('@littleloom_sleep_') ||
    k.startsWith('@littleloom_feeding_') ||
    k.startsWith('@littleloom_potty_') ||
    k.startsWith('@littleloom_medication_')
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
      // Parent2 data is stored per-baby in the baby record, so we note it here
      // The actual parent2Id is already in the babies table from step 1
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
  
  // Also migrate user-specific community selected topics
  const allKeys = await AsyncStorage.getAllKeys();
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