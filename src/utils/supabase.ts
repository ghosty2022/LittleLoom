// src/utils/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  SupabaseClient,
  Session,
  User,
} from '@supabase/supabase-js';

import { supabaseStorage } from './supabaseStorage';

// ─── Environment Validation ─────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials are missing!');
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    throw new Error('Supabase credentials are required in production');
  }
}

// ─── The Singleton Client ───────────────────────────────────────────

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'littleloom-mobile',
      },
    },
  }
);

// ─── FIX: Session Recovery Helper ────────────────────────────────────

/**
 * Recover a session from our own storage if Supabase's internal
 * getSession() fails. This is a workaround for the SDK bug where
 * getSession() returns null on cold start even though a valid
 * session exists in storage.
 */
export async function recoverSession(): Promise<Session | null> {
  try {
    // Try Supabase's getSession first
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session) {
      return data.session;
    }

    // If that failed, try to manually recover from storage
    const storageKey = `sb-${new URL(supabaseUrl || 'https://x.supabase.co').hostname.split('.')[0]}-auth-token`;
    
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) {
      // Try alternate key format
      const keys = await AsyncStorage.getAllKeys();
      const authKey = keys.find(k => k.includes('auth-token') || k.includes('supabase.auth'));
      if (authKey) {
        const altStored = await AsyncStorage.getItem(authKey);
        if (altStored) {
          try {
            const parsed = JSON.parse(altStored);
            if (parsed?.access_token && parsed?.refresh_token) {
              // Force Supabase to use this session
              const { data: setData, error: setError } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              });
              if (!setError && setData.session) {
                console.log('[Supabase] ✅ Recovered session from storage');
                return setData.session;
              }
            }
          } catch (e) {
            console.warn('[Supabase] Failed to parse stored session:', e);
          }
        }
      }
      return null;
    }

    try {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token && parsed?.refresh_token) {
        const { data: setData, error: setError } = await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        if (!setError && setData.session) {
          console.log('[Supabase] ✅ Recovered session from storage');
          return setData.session;
        }
      }
    } catch (e) {
      console.warn('[Supabase] Failed to parse stored session:', e);
    }

    return null;
  } catch (error) {
    console.warn('[Supabase] Session recovery error:', error);
    return null;
  }
}

// ─── Connection Helpers ─────────────────────────────────────────────

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('babies').select('id').limit(1);
    if (error) {
      return { connected: false, message: 'Connection failed', error: error.message };
    }
    return { connected: true, message: 'Connected to Supabase' };
  } catch (error) {
    return {
      connected: false,
      message: 'Connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── Session Helpers ────────────────────────────────────────────────

export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (__DEV__) console.warn('[Supabase] Failed to get session:', error.message);
      // Try recovery
      return await recoverSession();
    }
    if (!data.session) {
      // Try recovery
      return await recoverSession();
    }
    return data.session;
  } catch (error) {
    if (__DEV__) console.warn('[Supabase] Session error:', error);
    return await recoverSession();
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getCurrentSession();
    if (session?.user) return session.user;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch (error) {
    if (__DEV__) console.warn('[Supabase] Failed to get user:', error);
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// ─── Refresh with Retry ─────────────────────────────────────────────

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

      if (error?.status === 400 || error?.status === 401) {
        return { session: null, success: false };
      }

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[Supabase] Refresh attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  return { session: null, success: false };
}

// ─── Auth State Listener ────────────────────────────────────────────

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

// ─── Sign Out ───────────────────────────────────────────────────────

export async function signOutWithCleanup(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
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

// ─── Storage Utilities ──────────────────────────────────────────────

export { supabaseStorage } from './supabaseStorage';

export async function clearSupabaseLocalState(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(
      k =>
        k.startsWith('sb-') ||
        k.startsWith('supabase.') ||
        k.includes('auth-token')
    );
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] clearLocalState failed:', error);
    }
  }
}

export type { SupabaseClient, Session, User } from '@supabase/supabase-js';

export default supabase;