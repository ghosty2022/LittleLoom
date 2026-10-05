// src/utils/supabase.ts
// ─────────────────────────────────────────────────────────────────────
// THE canonical Supabase client for the entire app.
//
// Every other file that used to create its own client now imports from
// here. Duplicate files (src/lib/supabase.ts, src/services/supabaseClient.ts)
// have been deleted.
//
// Uses a hybrid storage adapter (SecureStore for small values,
// AsyncStorage for large) with in-memory caching to reduce I/O.
//
// ─── CRITICAL FIX ────────────────────────────────────────────────────
// flowType is 'implicit' NOT 'pkce'.
//
// PKCE is an OAuth authorization-code flow for WEB apps that receive
// a `?code=xyz` redirect from the provider. It requires the SDK to
// persist a `code_verifier` alongside the session.
//
// On React Native we sign in directly (email/password or OAuth token
// exchange), and our custom storage adapter only persists a plain
// { access_token, refresh_token, user } session. Under 'pkce' the SDK
// reads back the stored value, expects a `code_verifier`, fails to
// find it, and silently discards the session.
//
// Symptoms of the PKCE bug:
//   • getSession() returns null on next launch
//   • AuthContext wipes token + profile
//   • "Invalid login credentials" on second attempt because the
//     previous refresh_token was revoked server-side
//   • BabyContext can't find userId → loadBabies() short-circuits
//
// 'implicit' is correct for all React Native apps that don't do
// browser-based OAuth redirects.
// ─────────────────────────────────────────────────────────────────────

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
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.error('   → Create a .env file at the project root with these values.');

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
      // ─── CRITICAL: 'implicit' for React Native ────────────────────
      // Do NOT change this to 'pkce' unless you switch to a
      // browser-based OAuth redirect flow that receives ?code=xyz
      // and can persist the code_verifier. See file header for the
      // full explanation of what breaks.
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

// ─── Connection Helpers ─────────────────────────────────────────────

/**
 * Lightweight connectivity probe. Does not throw.
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('babies').select('id').limit(1);
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

// ─── Session Helpers ────────────────────────────────────────────────

/**
 * Safe session getter — never throws, returns null on failure.
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (__DEV__) {
        console.warn('[Supabase] Failed to get session:', error.message);
      }
      return null;
    }
    return data.session;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] Session error:', error);
    }
    return null;
  }
}

/**
 * Safe user getter — never throws.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getCurrentSession();
    if (session?.user) return session.user;

    // Fallback: try directly
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] Failed to get user:', error);
    }
    return null;
  }
}

/**
 * Get the current user's ID (string or null).
 */
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

      // Don't retry auth-rejected refreshes
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

/**
 * Sign out from Supabase — LOCAL scope only.
 *
 * `scope: 'local'` clears the session from this device's storage
 * WITHOUT revoking the refresh_token server-side.
 *
 * Default behavior (`scope: 'global'`) revokes the refresh_token on
 * every call. Our internal safety checks (`validateCurrentSession`,
 * periodic 5-min check, security auto-lock) can legitimately fail to
 * reach Supabase due to network hiccups — each of those failures
 * would trigger a global signOut, revoking the token, and making the
 * user's NEXT login attempt fail with "Invalid login credentials".
 *
 * Local-only cleanup preserves the ability to sign back in
 * immediately and matches how Supabase recommends handling signOut
 * in mobile apps.
 */
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

// ─── Profile Helpers ────────────────────────────────────────────────

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('community_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn('[Supabase] Failed to get user profile:', error.message);
      }
      return null;
    }
    return data;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] User profile error:', error);
    }
    return null;
  }
}

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
      if (__DEV__) {
        console.warn('[Supabase] Failed to upsert user profile:', error.message);
      }
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

// ─── Storage Utilities (Advanced) ───────────────────────────────────

/**
 * Direct access to the underlying storage adapter. Rarely needed.
 */
export { supabaseStorage } from './supabaseStorage';

/**
 * Wipe all Supabase-related keys from local storage.
 * Useful on sign-out or account deletion.
 */
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

// ─── Type Re-exports ────────────────────────────────────────────────

export type { SupabaseClient, Session, User } from '@supabase/supabase-js';

// ─── Default Export ─────────────────────────────────────────────────

export default supabase;