// src/utils/supabaseStorage.ts
// ─────────────────────────────────────────────────────────────────────
// Hybrid storage adapter for Supabase auth tokens.
//
// CRITICAL FIX: 
//   • Auth tokens can exceed 2KB (especially with JWT claims)
//   • SecureStore has a 2KB limit on Android — larger values fail silently
//   • We now ALWAYS write to AsyncStorage first (reliable), then try SecureStore
//   • We NEVER rely on SecureStore as the sole source of truth
//   • Cache is invalidated properly to prevent stale reads
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

// SecureStore has a 2KB limit on Android — anything larger fails
const SECURESTORE_SAFE_LIMIT = 1800; // Conservative limit

// Cache to avoid repeated storage checks
const storageCache = new Map<string, string>();

/**
 * Check if data is safe for SecureStore
 */
const isSafeForSecureStore = (value: string): boolean => {
  try {
    return value.length <= SECURESTORE_SAFE_LIMIT;
  } catch {
    return false;
  }
};

/**
 * Unified storage adapter for Supabase
 * 
 * CRITICAL: Always writes to AsyncStorage (reliable), and ALSO writes
 * to SecureStore when the value is small enough. On read, we check
 * memory cache first, then SecureStore, then AsyncStorage.
 * 
 * This guarantees that even if SecureStore fails (size limits, keychain
 * errors, etc.), the value is still recoverable from AsyncStorage.
 */
export const supabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // ─── 1. Memory cache (fastest) ────────────────────────────────
    if (storageCache.has(key)) {
      const cached = storageCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    // ─── 2. Web: AsyncStorage only ────────────────────────────────
    if (!isNative) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          storageCache.set(key, value);
        }
        return value;
      } catch {
        return null;
      }
    }

    // ─── 3. Native: Try AsyncStorage FIRST (most reliable) ────────
    // We read AsyncStorage first because:
    //   • It has no size limits
    //   • It works reliably on all devices
    //   • SecureStore can fail silently on some Android devices
    try {
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        storageCache.set(key, asyncValue);
        return asyncValue;
      }
    } catch (error) {
      console.warn(`[Storage] AsyncStorage read failed for ${key}:`, error);
    }

    // ─── 4. Fallback: SecureStore ─────────────────────────────────
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) {
        storageCache.set(key, secureValue);
        // Sync back to AsyncStorage so future reads are reliable
        AsyncStorage.setItem(key, secureValue).catch(() => {});
        return secureValue;
      }
    } catch (error) {
      // SecureStore errors are common — don't spam logs
    }

    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // ─── 1. Update memory cache ───────────────────────────────────
    storageCache.set(key, value);

    // ─── 2. ALWAYS write to AsyncStorage (reliable, no size limit) ─
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[Storage] AsyncStorage write failed for ${key}:`, error);
      // Re-throw so Supabase knows the write failed
      throw error;
    }

    // ─── 3. ALSO try SecureStore for small values (extra security) ─
    if (isNative && isSafeForSecureStore(value)) {
      try {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } catch {
        // SecureStore failure is OK — AsyncStorage already has the value
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    // ─── 1. Clear from memory cache ───────────────────────────────
    storageCache.delete(key);

    // ─── 2. Remove from AsyncStorage ──────────────────────────────
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }

    // ─── 3. Remove from SecureStore ──────────────────────────────
    if (isNative) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore — may not exist
      }
    }
  },

  /**
   * Clear the memory cache. Call this when signing out to prevent
   * stale token reads.
   */
  clearCache: (): void => {
    storageCache.clear();
  },

  /**
   * Invalidate a specific key from cache.
   */
  invalidate: (key: string): void => {
    storageCache.delete(key);
  },
};

export default supabaseStorage;