











import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';


const SECURESTORE_SAFE_LIMIT = 1800; 


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
    
    if (storageCache.has(key)) {
      const cached = storageCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    
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

    
    
    
    
    
    try {
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        storageCache.set(key, asyncValue);
        return asyncValue;
      }
    } catch (error) {
      console.warn(`[Storage] AsyncStorage read failed for ${key}:`, error);
    }

    
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) {
        storageCache.set(key, secureValue);
        
        AsyncStorage.setItem(key, secureValue).catch(() => {});
        return secureValue;
      }
    } catch (error) {
      
    }

    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    
    storageCache.set(key, value);

    
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[Storage] AsyncStorage write failed for ${key}:`, error);
      
      throw error;
    }

    
    if (isNative && isSafeForSecureStore(value)) {
      try {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } catch {
        
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    
    storageCache.delete(key);

    
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      
    }

    
    if (isNative) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        
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