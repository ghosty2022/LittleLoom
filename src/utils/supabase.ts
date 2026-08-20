// src/utils/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ─── Environment Variables ──────────────────────────────────────────
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ─── Validation ─────────────────────────────────────────────────────
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials are missing!');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  
  if (!__DEV__) {
    throw new Error('Supabase credentials are required in production');
  }
}

// ─── Secure Storage for Auth ──────────────────────────────────────
// Use SecureStore for sensitive auth data on native platforms
// Fallback to AsyncStorage for web
const isNative = Platform.OS !== 'web';

// Helper to check if data is too large for SecureStore
const isDataTooLarge = (value: string): boolean => {
  // SecureStore has a 2048 byte limit on Android
  // Use Blob to accurately measure size
  if (typeof value === 'string') {
    return new Blob([value]).size > 2000;
  }
  return false;
};

// Helper to compress large data
const compressData = (value: string): string => {
  try {
    // Simple compression using encodeURIComponent
    // This reduces size by encoding special characters
    const compressed = encodeURIComponent(value);
    console.log(`📦 Compressed data from ${new Blob([value]).size} to ${new Blob([compressed]).size} bytes`);
    return compressed;
  } catch (error) {
    console.warn('[SecureStorage] Compression failed, using original:', error);
    return value;
  }
};

// Helper to decompress data if needed
const decompressData = (value: string): string => {
  try {
    // Try to decode - if it fails, it wasn't compressed
    const decoded = decodeURIComponent(value);
    // Check if decoded looks like JSON (meaning it was compressed JSON)
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      return decoded;
    }
    // If it doesn't look like JSON, return the original
    return value;
  } catch {
    // If decodeURIComponent fails, it wasn't compressed
    return value;
  }
};

const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isNative) {
        const value = await SecureStore.getItemAsync(key);
        if (value) {
          // Try to decompress if it was compressed
          return decompressData(value);
        }
        return null;
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn(`[SecureStorage] Failed to get ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isNative) {
        // Check if data is too large for SecureStore
        if (isDataTooLarge(value)) {
          console.warn(`[SecureStorage] ⚠️ ${key} is ${new Blob([value]).size} bytes, exceeding 2048 byte limit`);
          console.log(`[SecureStorage] 💡 Storing ${key} in AsyncStorage instead`);
          await AsyncStorage.setItem(key, value);
        } else {
          await SecureStore.setItemAsync(key, value);
        }
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn(`[SecureStorage] Failed to set ${key}:`, error);
      // Fallback to AsyncStorage if SecureStore fails
      try {
        await AsyncStorage.setItem(key, value);
      } catch (fallbackError) {
        console.error(`[SecureStorage] Fallback also failed for ${key}:`, fallbackError);
      }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isNative) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      // Also remove from AsyncStorage in case it was stored there as fallback
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`[SecureStorage] Failed to remove ${key}:`, error);
    }
  },
};

// ─── Supabase Client ──────────────────────────────────────────────
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ─── Custom Hooks & Helpers ──────────────────────────────────────

/**
 * Check if Supabase connection is healthy
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('babies')
      .select('id')
      .limit(1);
    
    if (error) {
      return {
        connected: false,
        message: 'Connection failed',
        error: error.message,
      };
    }
    
    return {
      connected: true,
      message: 'Connected to Supabase',
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the current session with error handling
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[Supabase] Failed to get session:', error.message);
      return null;
    }
    return data.session;
  } catch (error) {
    console.warn('[Supabase] Session error:', error);
    return null;
  }
}

/**
 * Get the current user with error handling
 */
export async function getCurrentUser() {
  try {
    const session = await getCurrentSession();
    return session?.user || null;
  } catch (error) {
    console.warn('[Supabase] Failed to get user:', error);
    return null;
  }
}

/**
 * Refresh session with retry logic
 */
export async function refreshSessionWithRetry(
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<{ session: Session | null; success: boolean }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        return { session: data.session, success: true };
      }
      if (error?.status !== 400) {
        // Only retry on certain errors
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    } catch (error) {
      console.warn(`[Supabase] Refresh attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  return { session: null, success: false };
}

/**
 * Listen for auth state changes with automatic cleanup
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  
  return data.subscription;
}

/**
 * Sign out with error handling
 */
export async function signOutWithCleanup(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user profile with error handling
 */
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('community_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.warn('[Supabase] Failed to get user profile:', error.message);
      return null;
    }
    return data;
  } catch (error) {
    console.warn('[Supabase] User profile error:', error);
    return null;
  }
}

/**
 * Upsert user profile
 */
export async function upsertUserProfile(profile: {
  user_id: string;
  display_name: string;
  username?: string;
  handle?: string;
  bio?: string;
  avatar?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('community_profiles')
      .upsert(profile, { onConflict: 'user_id' })
      .select()
      .single();
    
    if (error) {
      console.warn('[Supabase] Failed to upsert user profile:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── Type Exports ──────────────────────────────────────────────────
export type { SupabaseClient } from '@supabase/supabase-js';

// ─── Default Export ──────────────────────────────────────────────
export default supabase;