// src/database/dbHelpers.ts
// Full Supabase implementation - No local DB, No Drizzle

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

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

// ─── USER ID CACHE ────────────────────────────────────────────────────────
let cachedUserId: string | null = null;
let cachedUserIdTimestamp: number = 0;
const USER_ID_CACHE_TTL = 30000; // 30 seconds
let isRefreshingSession = false;

// ─── Clear user ID cache (call on logout) ─────────────────────────────
export function clearUserIdCache(): void {
  cachedUserId = null;
  cachedUserIdTimestamp = 0;
  console.log('[DB] User ID cache cleared');
}

/* ─── UTILITY ───────────────────────────────────────────────────────────── */

// Safely check if a table exists in Supabase
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (error && (
      error.message?.includes('relation') || 
      error.message?.includes('does not exist') ||
      error.message?.includes('not found')
    )) {
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}

// ─── FIXED: Get current user ID with session refresh ──────────────────
export async function getCurrentUserId(): Promise<string | null> {
  // Return cached value if fresh
  const now = Date.now();
  if (cachedUserId !== null && (now - cachedUserIdTimestamp) < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }

  // If we're already refreshing, wait a bit
  if (isRefreshingSession) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (cachedUserId !== null) return cachedUserId;
  }

  try {
    // First try to get the user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      // If error is session missing, try to refresh
      if (error?.message?.includes('session') || error?.message?.includes('JWT')) {
        console.log('[DB] Session expired, attempting refresh...');
        isRefreshingSession = true;
        
        const { data: { session }, error: refreshError } = await supabase.auth.getSession();
        
        if (refreshError || !session?.user) {
          console.log('[DB] Session refresh failed');
          cachedUserId = null;
          cachedUserIdTimestamp = now;
          isRefreshingSession = false;
          return null;
        }
        
        cachedUserId = session.user.id;
        cachedUserIdTimestamp = now;
        isRefreshingSession = false;
        return cachedUserId;
      }
      
      cachedUserId = null;
      cachedUserIdTimestamp = now;
      return null;
    }
    
    if (cachedUserId !== user.id) {
      console.log('[DB] User authenticated:', user.id);
    }
    cachedUserId = user.id;
    cachedUserIdTimestamp = now;
    return user.id;
  } catch (error) {
    console.error('[DB] getCurrentUserId error:', error);
    cachedUserId = null;
    cachedUserIdTimestamp = now;
    isRefreshingSession = false;
    return null;
  }
}

// Get current session with refresh attempt
export async function getCurrentSession() {
  try {
    // Try to get fresh session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[DB] Session error:', error.message);
      
      // If error is about missing session, try to get user directly
      if (error.message?.includes('session') || error.message?.includes('JWT')) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          console.log('[DB] Got user directly, session may be stale but user exists');
          // Return a minimal session-like object
          return { user, access_token: 'refreshed' };
        }
      }
      return null;
    }
    return session;
  } catch (error) {
    console.error('[DB] getCurrentSession error:', error);
    return null;
  }
}

// ─── FORCE REFRESH SESSION ──────────────────────────────────────────────
export async function forceRefreshSession(): Promise<boolean> {
  try {
    isRefreshingSession = true;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      console.warn('[DB] Force refresh failed:', error?.message);
      cachedUserId = null;
      cachedUserIdTimestamp = 0;
      isRefreshingSession = false;
      return false;
    }
    cachedUserId = session.user.id;
    cachedUserIdTimestamp = Date.now();
    isRefreshingSession = false;
    return true;
  } catch (error) {
    console.error('[DB] Force refresh error:', error);
    isRefreshingSession = false;
    return false;
  }
}

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

export async function getUserFromRegistry(userId: string): Promise<UserRegistryEntry | null> {
  try {
    const registry = await getUserRegistry();
    return registry[userId] || null;
  } catch (error) {
    console.error('Error getting user from registry:', error);
    return null;
  }
}

/* ─── FIND USERS ───────────────────────────────────────────────────── */

export async function findUserByEmail(email: string): Promise<UserRegistryEntry | null> {
  try {
    const searchEmail = email.trim().toLowerCase();
    
    const registry = await getUserRegistry();
    for (const entry of Object.values(registry)) {
      if (entry.email.toLowerCase() === searchEmail) {
        return entry;
      }
    }
    
    // Try to find from Supabase profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', searchEmail)
      .maybeSingle();

    if (error) {
      console.warn('[DB] Profile query error:', error.message);
      return null;
    }

    if (profile) {
      const newEntry: UserRegistryEntry = {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name || email.split('@')[0],
        avatar: profile.avatar || '👤',
        role: profile.role || 'parent1',
        createdAt: profile.created_at || new Date().toISOString(),
        communityUsername: profile.community_username || undefined,
        communityHandle: profile.community_handle || undefined,
        communityBio: profile.community_bio || undefined,
        communityAvatar: profile.community_avatar || undefined,
        communityDisplayName: profile.community_display_name || undefined,
        communityStats: profile.community_stats || undefined,
        communitySelectedTopics: profile.community_selected_topics || undefined,
        hasPassword: true,
      };
      await registerUser(newEntry);
      return newEntry;
    }

    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<UserRegistryEntry | null> {
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
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('community_username', searchUsername)
      .maybeSingle();

    if (error) {
      console.warn('[DB] Profile query error:', error.message);
      return null;
    }

    if (profile) {
      const newEntry: UserRegistryEntry = {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name || '',
        avatar: profile.avatar || '👤',
        role: profile.role || 'parent1',
        createdAt: profile.created_at || new Date().toISOString(),
        communityUsername: profile.community_username || undefined,
        communityHandle: profile.community_handle || undefined,
        communityBio: profile.community_bio || undefined,
        communityAvatar: profile.community_avatar || undefined,
        communityDisplayName: profile.community_display_name || undefined,
        communityStats: profile.community_stats || undefined,
        communitySelectedTopics: profile.community_selected_topics || undefined,
        hasPassword: true,
      };
      await registerUser(newEntry);
      return newEntry;
    }

    return null;
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
}

export async function findUserByPhone(phone: string): Promise<UserRegistryEntry | null> {
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
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', searchPhone)
      .maybeSingle();

    if (error) {
      console.warn('[DB] Profile query error:', error.message);
      return null;
    }

    if (profile) {
      const newEntry: UserRegistryEntry = {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name || '',
        avatar: profile.avatar || '👤',
        role: profile.role || 'parent1',
        createdAt: profile.created_at || new Date().toISOString(),
        communityUsername: profile.community_username || undefined,
        communityHandle: profile.community_handle || undefined,
        communityBio: profile.community_bio || undefined,
        communityAvatar: profile.community_avatar || undefined,
        communityDisplayName: profile.community_display_name || undefined,
        communityStats: profile.community_stats || undefined,
        communitySelectedTopics: profile.community_selected_topics || undefined,
        phoneNumber: profile.phone_number || undefined,
        hasPassword: true,
      };
      await registerUser(newEntry);
      return newEntry;
    }

    return null;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
  }
}

export async function findUserByEmailOrUsername(identifier: string): Promise<UserRegistryEntry | null> {
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

export async function findUserByEmailOrUsernameOrPhone(identifier: string): Promise<UserRegistryEntry | null> {
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
   APP SETTINGS - With table existence check
   ═══════════════════════════════════════════════════════════════════════════ */

let appSettingsTableExists: boolean | null = null;

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    
    if (appSettingsTableExists === null) {
      appSettingsTableExists = await tableExists('app_settings');
    }
    
    if (!appSettingsTableExists) {
      try {
        const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
        return await AsyncStorage.getItem(storageKey);
      } catch {
        return null;
      }
    }

    let query = supabase
      .from('app_settings')
      .select('value')
      .eq('key', key);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn(`[DB] getAppSetting error for ${key}:`, error.message);
      try {
        const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
        return await AsyncStorage.getItem(storageKey);
      } catch {
        return null;
      }
    }

    return data?.value || null;
  } catch (error) {
    console.error(`[DB] getAppSetting error for ${key}:`, error);
    try {
      const userId = await getCurrentUserId();
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      return await AsyncStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    if (appSettingsTableExists === null) {
      appSettingsTableExists = await tableExists('app_settings');
    }
    
    if (!appSettingsTableExists) {
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      await AsyncStorage.setItem(storageKey, value);
      return;
    }

    const now = new Date().toISOString();
    
    // Try update first
    let query = supabase
      .from('app_settings')
      .update({ value, updated_at: now })
      .eq('key', key);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { error: updateError, count } = await query;

    if (updateError || count === 0) {
      const insertData: any = { key, value, updated_at: now };
      
      if (userId) {
        insertData.user_id = userId;
      } else {
        insertData.user_id = null;
      }

      const { error: insertError } = await supabase
        .from('app_settings')
        .insert(insertData);

      if (insertError) {
        console.warn(`[DB] setAppSetting insert error for ${key}:`, insertError.message);
        const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
        await AsyncStorage.setItem(storageKey, value);
      }
    }
  } catch (error) {
    console.error(`[DB] setAppSetting error for ${key}:`, error);
    try {
      const userId = await getCurrentUserId();
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      await AsyncStorage.setItem(storageKey, value);
    } catch (e) {
      console.error(`[DB] setAppSetting AsyncStorage fallback error for ${key}:`, e);
    }
  }
}

export async function deleteAppSetting(key: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    if (appSettingsTableExists === null) {
      appSettingsTableExists = await tableExists('app_settings');
    }
    
    if (!appSettingsTableExists) {
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      await AsyncStorage.removeItem(storageKey);
      return;
    }

    let query = supabase
      .from('app_settings')
      .delete()
      .eq('key', key);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;

    if (error) {
      console.warn(`[DB] deleteAppSetting error for ${key}:`, error.message);
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      await AsyncStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error(`[DB] deleteAppSetting error for ${key}:`, error);
    try {
      const userId = await getCurrentUserId();
      const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
      await AsyncStorage.removeItem(storageKey);
    } catch (e) {
      console.error(`[DB] deleteAppSetting AsyncStorage fallback error for ${key}:`, e);
    }
  }
}

export async function getMultipleAppSettings(keys: string[]): Promise<Record<string, string | null>> {
  try {
    const userId = await getCurrentUserId();
    
    if (appSettingsTableExists === null) {
      appSettingsTableExists = await tableExists('app_settings');
    }
    
    if (!appSettingsTableExists) {
      const result: Record<string, string | null> = {};
      for (const key of keys) {
        try {
          const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
          result[key] = await AsyncStorage.getItem(storageKey);
        } catch {
          result[key] = null;
        }
      }
      return result;
    }

    let query = supabase
      .from('app_settings')
      .select('key, value')
      .in('key', keys);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[DB] getMultipleAppSettings error:', error.message);
      const result: Record<string, string | null> = {};
      for (const key of keys) {
        try {
          const storageKey = userId ? `app_setting_${userId}_${key}` : `app_setting_${key}`;
          result[key] = await AsyncStorage.getItem(storageKey);
        } catch {
          result[key] = null;
        }
      }
      return result;
    }

    const result: Record<string, string | null> = {};
    keys.forEach(key => { result[key] = null; });
    data?.forEach(item => { result[item.key] = item.value; });
    return result;
  } catch (error) {
    console.error('[DB] getMultipleAppSettings error:', error);
    return {};
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BABIES - WITH IMPROVED ERROR HANDLING
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getAllBabiesFromDb(forceSync: boolean = false) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    // Fetch from Supabase
    const { data: parent1Babies, error: error1 } = await supabase
      .from('babies')
      .select('*')
      .eq('parent1_id', userId)
      .eq('is_active', true);

    if (error1) {
      // If it's an RLS error, try to handle it gracefully
      if (error1.message?.includes('infinite recursion') || error1.message?.includes('policy')) {
        console.error('[DB] RLS policy error - please check your RLS policies:', error1.message);
        return [];
      }
      console.error('[DB] parent1 query error:', error1.message);
    }

    const { data: parent2Babies, error: error2 } = await supabase
      .from('babies')
      .select('*')
      .eq('parent2_id', userId)
      .eq('is_active', true);

    if (error2) {
      if (error2.message?.includes('infinite recursion') || error2.message?.includes('policy')) {
        console.error('[DB] RLS policy error - please check your RLS policies:', error2.message);
        return [];
      }
      console.error('[DB] parent2 query error:', error2.message);
    }

    // Combine and deduplicate
    const allBabies: any[] = [];
    const seenIds = new Set<string>();

    const addBaby = (baby: any) => {
      if (baby && !seenIds.has(baby.id)) {
        seenIds.add(baby.id);
        allBabies.push(baby);
      }
    };

    if (parent1Babies) parent1Babies.forEach(addBaby);
    if (parent2Babies) parent2Babies.forEach(addBaby);

    // Cache babies in AsyncStorage for offline access
    if (allBabies.length > 0) {
      try {
        await AsyncStorage.setItem(`@littleloom_babies_${userId}`, JSON.stringify(allBabies));
      } catch (cacheError) {
        console.warn('[DB] Failed to cache babies:', cacheError);
      }
    }

    return allBabies;
  } catch (error) {
    console.error('[DB] getAllBabiesFromDb error:', error);
    
    // Try to return cached babies
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const cached = await AsyncStorage.getItem(`@littleloom_babies_${userId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (cacheError) {
      console.warn('[DB] Failed to load cached babies:', cacheError);
    }
    
    return [];
  }
}

export async function getBabyByIdFromDb(id: string, forceSync: boolean = false) {
  try {
    const { data, error } = await supabase
      .from('babies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(`[DB] getBabyByIdFromDb error for ${id}:`, error.message);
      
      // Try cached
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          const cached = await AsyncStorage.getItem(`@littleloom_babies_${userId}`);
          if (cached) {
            const babies = JSON.parse(cached);
            const found = babies.find((b: any) => b.id === id);
            if (found) return found;
          }
        }
      } catch (cacheError) {
        console.warn('[DB] Failed to load cached baby:', cacheError);
      }
      
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(`[DB] getBabyByIdFromDb error for ${id}:`, error);
    return null;
  }
}

export async function getBabyCountFromDb(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return 0;

    const { count, error } = await supabase
      .from('babies')
      .select('*', { count: 'exact', head: true })
      .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
      .eq('is_active', true);

    if (error) {
      console.warn('[DB] getBabyCountFromDb error:', error.message);
      
      // Try cached
      try {
        const cached = await AsyncStorage.getItem(`@littleloom_babies_${userId}`);
        if (cached) {
          const babies = JSON.parse(cached);
          return babies.filter((b: any) => b.is_active !== false).length;
        }
      } catch (cacheError) {
        console.warn('[DB] Failed to load cached baby count:', cacheError);
      }
      
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[DB] getBabyCountFromDb error:', error);
    return 0;
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
    const userId = await getCurrentUserId();
    
    if (!userId && !data.parent1Id) {
      throw new Error('No authenticated user and no parent1Id provided');
    }
    
    const { data: result, error } = await supabase
      .from('babies')
      .insert({
        id: data.id,
        name: data.name,
        avatar: data.avatar || null,
        date_of_birth: data.dateOfBirth,
        gender: data.gender || null,
        blood_type: data.bloodType || null,
        medical_notes: data.medicalNotes || null,
        parent1_id: data.parent1Id || userId,
        parent2_id: data.parent2Id || null,
        created_at: now,
        updated_at: now,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] createBabyInDb error:', error.message);
      throw error;
    }

    // Invalidate cache
    if (userId) {
      await AsyncStorage.removeItem(`@littleloom_babies_${userId}`);
    }

    return result;
  } catch (error) {
    console.error('[DB] createBabyInDb error:', error);
    throw error;
  }
}

export async function updateBabyInDb(id: string, updates: Partial<{
  name: string;
  avatar: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  medicalNotes: string;
  parent1Id: string;
  parent2Id: string;
  isActive: boolean;
}>) {
  try {
    const now = new Date().toISOString();
    const userId = await getCurrentUserId();
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

    const { data: result, error } = await supabase
      .from('babies')
      .update(remoteUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] updateBabyInDb error for ${id}:`, error.message);
      throw error;
    }

    // Invalidate cache
    if (userId) {
      await AsyncStorage.removeItem(`@littleloom_babies_${userId}`);
    }

    return result;
  } catch (error) {
    console.error(`[DB] updateBabyInDb error for ${id}:`, error);
    throw error;
  }
}

export async function deleteBabyFromDb(id: string) {
  try {
    const userId = await getCurrentUserId();
    
    const { data: result, error } = await supabase
      .from('babies')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] deleteBabyFromDb error for ${id}:`, error.message);
      throw error;
    }

    if (userId) {
      await AsyncStorage.removeItem(`@littleloom_babies_${userId}`);
    }

    return result;
  } catch (error) {
    console.error(`[DB] deleteBabyFromDb error for ${id}:`, error);
    throw error;
  }
}

export async function hardDeleteBaby(babyId: string): Promise<boolean> {
  try {
    await supabase.from('tracker_entries').delete().eq('baby_id', babyId);
    await supabase.from('family_members').delete().eq('baby_id', babyId);
    
    const { error } = await supabase.from('babies').delete().eq('id', babyId);
    
    if (error) {
      console.error('[DB] hardDeleteBaby error:', error.message);
      return false;
    }
    
    const userId = await getCurrentUserId();
    if (userId) {
      await AsyncStorage.removeItem(`@littleloom_babies_${userId}`);
    }
    
    console.log(`[DB] Hard deleted baby: ${babyId}`);
    return true;
  } catch (error) {
    console.error('[DB] hardDeleteBaby error:', error);
    return false;
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
    const baby = await getBabyByIdFromDb(babyId);
    if (baby) return baby;

    const { data, error } = await supabase
      .from('babies')
      .select('*')
      .eq('id', babyId)
      .maybeSingle();

    if (error || !data) {
      console.warn(`[DB] getCurrentBabyData: Baby ${babyId} not found`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[DB] getCurrentBabyData error:', error);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ENTRIES
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getEntriesByBabyFromDb(babyId: string, trackerId?: string) {
  try {
    let query = supabase
      .from('tracker_entries')
      .select('*')
      .eq('baby_id', babyId)
      .eq('is_deleted', false)
      .order('timestamp', { ascending: false });

    if (trackerId) {
      query = query.eq('tracker_id', trackerId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[DB] getEntriesByBabyFromDb error:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      try {
        const cacheKey = `@littleloom_entries_${babyId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (cacheError) {
        console.warn('[DB] Failed to cache entries:', cacheError);
      }
    }

    return data || [];
  } catch (error) {
    console.error('[DB] getEntriesByBabyFromDb error:', error);
    
    try {
      const cacheKey = `@littleloom_entries_${babyId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const entries = JSON.parse(cached);
        if (trackerId) {
          return entries.filter((e: any) => e.tracker_id === trackerId);
        }
        return entries;
      }
    } catch (cacheError) {
      console.warn('[DB] Failed to load cached entries:', cacheError);
    }
    
    return [];
  }
}

export async function getEntryByIdFromDb(id: string) {
  try {
    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(`[DB] getEntryByIdFromDb error for ${id}:`, error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(`[DB] getEntryByIdFromDb error for ${id}:`, error);
    return null;
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

    const { data: result, error } = await supabase
      .from('tracker_entries')
      .insert({
        id: data.id,
        tracker_id: data.trackerId,
        baby_id: data.babyId,
        timestamp: data.timestamp,
        title: data.title,
        data: payload,
        notes: data.notes,
        photo_uris: data.photoUris || null,
        tags: data.tags || null,
        location: data.location || null,
        mood: data.mood || null,
        logged_by: data.loggedBy || null,
        logged_by_name: data.loggedByName || null,
        logged_by_role: data.loggedByRole || null,
        notification_id: data.notificationId || null,
        reminder_scheduled: data.reminderScheduled || false,
        synced_at: data.syncedAt || null,
        edited_by: data.editedBy || null,
        edited_at: data.editedAt || null,
        created_at: now,
        updated_at: now,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] createEntryInDb error:', error.message);
      throw error;
    }

    await AsyncStorage.removeItem(`@littleloom_entries_${data.babyId}`);

    return result;
  } catch (error) {
    console.error('[DB] createEntryInDb error:', error);
    throw error;
  }
}

export async function updateEntryInDb(id: string, updates: Partial<{
  trackerId: string;
  babyId: string;
  timestamp: number;
  title: string;
  data: Record<string, unknown>;
  notes: string;
  photoUris: string[];
  tags: string[];
  location: string;
  mood: string;
  loggedBy: string;
  loggedByName: string;
  loggedByRole: string;
  notificationId: string;
  reminderScheduled: boolean;
  syncedAt: string;
  editedBy: string;
  editedAt: number;
}>) {
  try {
    const now = new Date().toISOString();
    const remoteUpdates: Record<string, unknown> = { updated_at: now };
    
    let babyId: string | undefined;

    if (updates.trackerId !== undefined) remoteUpdates.tracker_id = updates.trackerId;
    if (updates.babyId !== undefined) {
      remoteUpdates.baby_id = updates.babyId;
      babyId = updates.babyId;
    }
    if (updates.timestamp !== undefined) remoteUpdates.timestamp = updates.timestamp;
    if (updates.title !== undefined) remoteUpdates.title = updates.title;
    if (updates.data !== undefined) remoteUpdates.data = updates.data;
    if (updates.notes !== undefined) remoteUpdates.notes = updates.notes;
    if (updates.photoUris !== undefined) remoteUpdates.photo_uris = updates.photoUris;
    if (updates.tags !== undefined) remoteUpdates.tags = updates.tags;
    if (updates.location !== undefined) remoteUpdates.location = updates.location;
    if (updates.mood !== undefined) remoteUpdates.mood = updates.mood;
    if (updates.loggedBy !== undefined) remoteUpdates.logged_by = updates.loggedBy;
    if (updates.loggedByName !== undefined) remoteUpdates.logged_by_name = updates.loggedByName;
    if (updates.loggedByRole !== undefined) remoteUpdates.logged_by_role = updates.loggedByRole;
    if (updates.notificationId !== undefined) remoteUpdates.notification_id = updates.notificationId;
    if (updates.reminderScheduled !== undefined) remoteUpdates.reminder_scheduled = updates.reminderScheduled;
    if (updates.syncedAt !== undefined) remoteUpdates.synced_at = updates.syncedAt;
    if (updates.editedBy !== undefined) remoteUpdates.edited_by = updates.editedBy;
    if (updates.editedAt !== undefined) remoteUpdates.edited_at = updates.editedAt;

    const { data: result, error } = await supabase
      .from('tracker_entries')
      .update(remoteUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] updateEntryInDb error for ${id}:`, error.message);
      throw error;
    }

    if (babyId) {
      await AsyncStorage.removeItem(`@littleloom_entries_${babyId}`);
    }

    return result;
  } catch (error) {
    console.error(`[DB] updateEntryInDb error for ${id}:`, error);
    throw error;
  }
}

export async function softDeleteEntryInDb(id: string) {
  try {
    const { data: result, error } = await supabase
      .from('tracker_entries')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] softDeleteEntryInDb error for ${id}:`, error.message);
      throw error;
    }

    if (result?.baby_id) {
      await AsyncStorage.removeItem(`@littleloom_entries_${result.baby_id}`);
    }

    return result;
  } catch (error) {
    console.error(`[DB] softDeleteEntryInDb error for ${id}:`, error);
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY MEMBERS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getFamilyMembersByBabyFromDb(babyId: string, includeDeleted = false) {
  try {
    let query = supabase
      .from('family_members')
      .select('*')
      .eq('baby_id', babyId)
      .order('added_at', { ascending: false });

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[DB] getFamilyMembersByBabyFromDb error:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[DB] getFamilyMembersByBabyFromDb error:', error);
    return [];
  }
}

export async function getFamilyMemberByIdFromDb(id: string) {
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(`[DB] getFamilyMemberByIdFromDb error for ${id}:`, error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(`[DB] getFamilyMemberByIdFromDb error for ${id}:`, error);
    return null;
  }
}

export async function getFamilyMemberByEmailAndBabyFromDb(email: string, babyId: string) {
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('email', email)
      .eq('baby_id', babyId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      console.warn('[DB] getFamilyMemberByEmailAndBabyFromDb error:', error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('[DB] getFamilyMemberByEmailAndBabyFromDb error:', error);
    return null;
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
    
    const { data: result, error } = await supabase
      .from('family_members')
      .insert({
        id: data.id,
        baby_id: data.babyId,
        user_id: data.userId || null,
        email: data.email,
        full_name: data.fullName,
        avatar: data.avatar || null,
        role: data.role,
        relationship: data.relationship,
        permissions: data.permissions || {},
        added_at: now,
        added_by: data.addedBy,
        can_be_removed: data.canBeRemoved ?? true,
        phone_number: data.phoneNumber || null,
        notifications_enabled: data.notificationsEnabled ?? true,
        status: data.status || 'pending',
        updated_at: now,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] createFamilyMemberInDb error:', error.message);
      throw error;
    }

    return result;
  } catch (error) {
    console.error('[DB] createFamilyMemberInDb error:', error);
    throw error;
  }
}

export async function updateFamilyMemberInDb(id: string, updates: Partial<{
  userId: string | null;
  email: string;
  fullName: string;
  avatar: string;
  role: string;
  relationship: string;
  permissions: Record<string, boolean>;
  phoneNumber: string;
  notificationsEnabled: boolean;
  status: string;
  lastActive: string;
}>) {
  try {
    const now = new Date().toISOString();
    const remoteUpdates: Record<string, unknown> = { updated_at: now };

    if (updates.userId !== undefined) remoteUpdates.user_id = updates.userId;
    if (updates.email !== undefined) remoteUpdates.email = updates.email;
    if (updates.fullName !== undefined) remoteUpdates.full_name = updates.fullName;
    if (updates.avatar !== undefined) remoteUpdates.avatar = updates.avatar;
    if (updates.role !== undefined) remoteUpdates.role = updates.role;
    if (updates.relationship !== undefined) remoteUpdates.relationship = updates.relationship;
    if (updates.permissions !== undefined) remoteUpdates.permissions = updates.permissions;
    if (updates.phoneNumber !== undefined) remoteUpdates.phone_number = updates.phoneNumber;
    if (updates.notificationsEnabled !== undefined) remoteUpdates.notifications_enabled = updates.notificationsEnabled;
    if (updates.status !== undefined) remoteUpdates.status = updates.status;
    if (updates.lastActive !== undefined) remoteUpdates.last_active = updates.lastActive;

    const { data: result, error } = await supabase
      .from('family_members')
      .update(remoteUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] updateFamilyMemberInDb error for ${id}:`, error.message);
      throw error;
    }

    return result;
  } catch (error) {
    console.error(`[DB] updateFamilyMemberInDb error for ${id}:`, error);
    throw error;
  }
}

export async function softDeleteFamilyMemberInDb(id: string) {
  try {
    const { data: result, error } = await supabase
      .from('family_members')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[DB] softDeleteFamilyMemberInDb error for ${id}:`, error.message);
      throw error;
    }

    return result;
  } catch (error) {
    console.error(`[DB] softDeleteFamilyMemberInDb error for ${id}:`, error);
    throw error;
  }
}

export async function hardDeleteFamilyMember(memberId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('[DB] hardDeleteFamilyMember error:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[DB] hardDeleteFamilyMember error:', error);
    return false;
  }
}

export async function deleteFamilyMembersByBabyFromDb(babyId: string) {
  try {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('baby_id', babyId);

    if (error) {
      console.error('[DB] deleteFamilyMembersByBabyFromDb error:', error.message);
      throw error;
    }
  } catch (error) {
    console.error('[DB] deleteFamilyMembersByBabyFromDb error:', error);
    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HARD DELETE ALL USER DATA
   ═══════════════════════════════════════════════════════════════════════════ */

export async function hardDeleteAllUserData(userId: string): Promise<boolean> {
  try {
    const { data: userBabies, error: babiesError } = await supabase
      .from('babies')
      .select('id')
      .eq('parent1_id', userId);

    if (babiesError) {
      console.error('[DB] hardDeleteAllUserData babies error:', babiesError.message);
    }

    if (userBabies) {
      for (const baby of userBabies) {
        await supabase.from('tracker_entries').delete().eq('baby_id', baby.id);
        await supabase.from('family_members').delete().eq('baby_id', baby.id);
        await supabase.from('babies').delete().eq('id', baby.id);
        
        await AsyncStorage.removeItem(`@littleloom_entries_${baby.id}`);
      }
    }

    await supabase.from('family_members').delete().eq('user_id', userId);
    await supabase.from('app_settings').delete().eq('user_id', userId);
    await AsyncStorage.removeItem(`@littleloom_babies_${userId}`);

    console.log(`[DB] Hard deleted all data for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('[DB] hardDeleteAllUserData error:', error);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type Baby = {
  id: string;
  name: string;
  avatar: string | null;
  date_of_birth: string;
  gender: string | null;
  blood_type: string | null;
  medical_notes: string | null;
  parent1_id: string | null;
  parent2_id: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type TrackerEntry = {
  id: string;
  tracker_id: string;
  baby_id: string;
  timestamp: number;
  title: string;
  data: Record<string, unknown>;
  notes: string | null;
  photo_uris: string[] | null;
  tags: string[] | null;
  location: string | null;
  mood: string | null;
  logged_by: string | null;
  logged_by_name: string | null;
  logged_by_role: string | null;
  notification_id: string | null;
  reminder_scheduled: boolean;
  synced_at: string | null;
  edited_by: string | null;
  edited_at: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

export type FamilyMember = {
  id: string;
  baby_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  avatar: string | null;
  role: string;
  relationship: string;
  permissions: Record<string, boolean>;
  added_at: string;
  added_by: string;
  can_be_removed: boolean;
  last_active: string | null;
  phone_number: string | null;
  notifications_enabled: boolean;
  status: string;
  updated_at: string;
  is_deleted: boolean;
};

export type AppSetting = {
  key: string;
  value: string;
  user_id: string | null;
  updated_at: string;
};

// ─── BACKUP HELPERS ──────────────────────────────────────────────────────

export async function getLastBackupTime(): Promise<number | null> {
  try {
    const last = await AsyncStorage.getItem('@littleloom_last_backup_time');
    return last ? parseInt(last, 10) : null;
  } catch {
    return null;
  }
}

export async function setLastBackupTime(time: number): Promise<void> {
  try {
    await AsyncStorage.setItem('@littleloom_last_backup_time', String(time));
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