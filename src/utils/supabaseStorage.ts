import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Use AsyncStorage for large data
export const supabaseStorage = {
  getItem: async (key: string) => {
    try {
      // Try SecureStore first (for tokens)
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
      
      // Fallback to AsyncStorage (for large data)
      return await AsyncStorage.getItem(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // If data is small, use SecureStore
      if (value.length < 2000) {
        await SecureStore.setItemAsync(key, value);
      } else {
        // Store large data in AsyncStorage
        console.log(`📦 Storing large ${key} in AsyncStorage (${value.length} bytes)`);
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Storage fallback:', error);
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};