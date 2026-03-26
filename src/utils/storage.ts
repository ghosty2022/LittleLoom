import AsyncStorage from '@react-native-async-storage/async-storage';

// Universal storage using only AsyncStorage
// This works in Expo Go, development builds, and production without native modules
export const storage = {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
      throw error;
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error deleting item ${key}:`, error);
    }
  },
};

// Always returns false since we're using AsyncStorage only
export const isSecureStorageAvailable = () => false;