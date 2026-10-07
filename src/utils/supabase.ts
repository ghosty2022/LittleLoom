








































import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  SupabaseClient,
  Session,
  User,
} from '@supabase/supabase-js';

import { supabaseStorage } from './supabaseStorage';



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



/**
 * Hard fallback: read the raw Supabase session JSON directly from
 * AsyncStorage and force-feed it back into the SDK via `setSession()`.
 *
 * This is required because Supabase JS 2.45+ on React Native can
 * return `{ session: null }` from `getSession()` on cold start even
 * though a valid session exists in our storage adapter. Without this
 * fallback, AuthContext wipes state and every downstream context
 * (Baby, Family, Tracker) sees "no authenticated user".
 *
 * Returns the recovered session or null.
 */
export async function recoverSession(): Promise<Session | null> {
  try {
    
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session) {
      return data.session;
    }

    
    
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(
      (k) =>
        typeof k === 'string' &&
        (k.includes('auth-token') || k.startsWith('sb-'))
    );

    for (const key of authKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);

        
        
        
        
        const access_token =
          parsed?.access_token ||
          parsed?.session?.access_token ||
          parsed?.currentSession?.access_token;

        const refresh_token =
          parsed?.refresh_token ||
          parsed?.session?.refresh_token ||
          parsed?.currentSession?.refresh_token;

        if (!access_token || !refresh_token) continue;

        
        const { data: setData, error: setError } =
          await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

        if (!setError && setData?.session) {
          if (__DEV__) {
            console.log('[Supabase] ✅ recoverSession succeeded via key:', key);
          }
          return setData.session;
        }
      } catch (parseErr) {
        
        if (__DEV__) {
          console.warn('[Supabase] Skipped malformed key:', key, parseErr);
        }
      }
    }

    if (__DEV__) {
      console.warn('[Supabase] recoverSession: no recoverable session found');
    }
    return null;
  } catch (err) {
    if (__DEV__) {
      console.warn('[Supabase] recoverSession error:', err);
    }
    return null;
  }
}



/**
 * Safe session getter — never throws, returns null on failure.
 * Automatically attempts recovery when the SDK returns null.
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (__DEV__) {
        console.warn('[Supabase] Failed to get session:', error.message);
      }
      return await recoverSession();
    }
    if (!data.session) {
      
      return await recoverSession();
    }
    return data.session;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] Session error:', error);
    }
    return await recoverSession();
  }
}

/**
 * Safe user getter — never throws.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getCurrentSession();
    if (session?.user) return session.user;

    
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
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * (attempt + 1))
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[Supabase] Refresh attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * (attempt + 1))
        );
      }
    }
  }
  return { session: null, success: false };
}



export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}



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

    
    try {
      const { supabaseStorage: storageAdapter } = await import('./supabaseStorage');
      if (typeof (storageAdapter as any)?.clearCache === 'function') {
        (storageAdapter as any).clearCache();
      }
    } catch {
      
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[Supabase] clearLocalState failed:', error);
    }
  }
}



export type { SupabaseClient, Session, User } from '@supabase/supabase-js';



export default supabase;