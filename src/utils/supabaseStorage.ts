// src/utils/supabaseStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';
const SECURESTORE_LIMIT = 2000; // 2KB limit for SecureStore

// Cache to avoid repeated storage checks
const storageCache = new Map<string, { value: string; source: 'secure' | 'async' | null }>();
let cacheEnabled = true;

/**
 * Check if data is too large for SecureStore
 */
const isDataTooLarge = (value: string): boolean => {
  return new Blob([value]).size > SECURESTORE_LIMIT;
};

/**
 * Unified storage with caching to reduce logs
 */
export const supabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // Check cache first
    if (cacheEnabled && storageCache.has(key)) {
      const cached = storageCache.get(key);
      if (cached && cached.value) {
        return cached.value;
      }
    }

    if (!isNative) {
      const value = await AsyncStorage.getItem(key);
      if (value && cacheEnabled) {
        storageCache.set(key, { value, source: 'async' });
      }
      return value;
    }

    try {
      // Try SecureStore first (for smaller tokens)
      let value = await SecureStore.getItemAsync(key);
      if (value) {
        if (cacheEnabled) {
          storageCache.set(key, { value, source: 'secure' });
        }
        return value;
      }
    } catch {
      // SecureStore error, try AsyncStorage
    }

    // Try AsyncStorage (for large tokens)
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        // Only log once per key per session
        if (!storageCache.has(key)) {
          // console.log(`[Storage] Found ${key} in AsyncStorage`);
        }
        if (cacheEnabled) {
          storageCache.set(key, { value, source: 'async' });
        }
        return value;
      }
    } catch {
      // Ignore
    }

    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // Update cache
    if (cacheEnabled) {
      storageCache.set(key, { value, source: null });
    }

    // Always store in AsyncStorage as backup
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[Storage] AsyncStorage backup failed:`, error);
    }

    if (!isNative) {
      return;
    }

    // Store in SecureStore only if small enough
    if (!isDataTooLarge(value)) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (error) {
        console.warn(`[Storage] SecureStore failed for ${key}:`, error);
      }
    } else {
      // Large data - log once per key per session
      if (!storageCache.has(key)) {
        // console.log(`[Storage] Storing large ${key} in AsyncStorage only`);
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    // Remove from cache
    storageCache.delete(key);

    try {
      if (isNative) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // Ignore
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },

  /**
   * Clear the storage cache
   */
  clearCache: (): void => {
    storageCache.clear();
  },

  /**
   * Enable/disable caching
   */
  setCacheEnabled: (enabled: boolean): void => {
    cacheEnabled = enabled;
    if (!enabled) {
      storageCache.clear();
    }
  },
};

export default supabaseStorage;