// utils/backupService.ts - COMPLETE BACKUP SERVICE
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppSetting, getAllBabiesFromDb, getEntriesByBabyFromDb } from '@/database/dbHelpers';
import { supabase } from './supabase';

export interface BackupData {
  _version: string;
  _timestamp: string;
  _encrypted: boolean;
  babies: any[];
  entries: Record<string, any[]>;
  appSettings: Record<string, string>;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface BackupPreview {
  valid: boolean;
  babies?: number;
  logs?: number;
  date?: string;
}

const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';

export const ensureBackupDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

export const createBackup = async (options: { 
  encrypted?: boolean; 
  password?: string;
  includePhotos?: boolean;
}): Promise<BackupResult> => {
  try {
    await ensureBackupDir();
    
    // Get all data
    const babies = await getAllBabiesFromDb();
    const entries: Record<string, any[]> = {};
    
    for (const baby of babies) {
      const babyEntries = await getEntriesByBabyFromDb(baby.id);
      entries[baby.id] = babyEntries;
    }
    
    // Get app settings
    const settingsKeys = [
      'current_baby_id', 'has_skipped_baby', 'community_username', 
      'community_handle', 'community_bio', 'community_display_name'
    ];
    const appSettings: Record<string, string> = {};
    for (const key of settingsKeys) {
      const val = await getAppSetting(key);
      if (val) appSettings[key] = val;
    }
    
    const backupData: BackupData = {
      _version: '2.0',
      _timestamp: new Date().toISOString(),
      _encrypted: options.encrypted || false,
      babies,
      entries,
      appSettings,
    };
    
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `backup_${dateStr}${options.encrypted ? '_encrypted' : ''}.json`;
    const filePath = BACKUP_DIR + fileName;
    
    let jsonContent = JSON.stringify(backupData, null, 2);
    
    // Encrypt if needed
    if (options.encrypted && options.password) {
      const { encryptData } = await import('@/context/FamilyChatContext');
      jsonContent = await encryptData(jsonContent, options.password);
    }
    
    await FileSystem.writeAsStringAsync(filePath, jsonContent);
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Backup error:', error);
    return { success: false, error: String(error) };
  }
};

export const shareBackup = async (filePath: string): Promise<boolean> => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      console.warn('Sharing not available');
      return false;
    }
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Share LittleLoom Backup',
    });
    return true;
  } catch (error) {
    console.error('Share error:', error);
    return false;
  }
};

export const listLocalBackups = async (): Promise<Array<{
  id: string;
  name: string;
  path: string;
  dateFormatted: string;
  sizeFormatted: string;
  isEncrypted: boolean;
}>> => {
  try {
    await ensureBackupDir();
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fileInfo = await FileSystem.getInfoAsync(BACKUP_DIR + file);
        const isEncrypted = file.includes('_encrypted');
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        backups.push({
          id: file,
          name: file.replace('.json', '').replace('_encrypted', ''),
          path: BACKUP_DIR + file,
          dateFormatted: dateMatch ? dateMatch[1] : 'Unknown',
          sizeFormatted: fileInfo.exists ? `${Math.round(fileInfo.size / 1024)} KB` : '0 KB',
          isEncrypted,
        });
      }
    }
    
    backups.sort((a, b) => b.dateFormatted.localeCompare(a.dateFormatted));
    return backups;
  } catch (error) {
    console.error('List backups error:', error);
    return [];
  }
};

export const previewBackup = async (content: string, password?: string): Promise<BackupPreview> => {
  try {
    let data = content;
    // Check if encrypted
    if (data.includes('_encrypted') || data.startsWith('encrypted_')) {
      if (!password) return { valid: false };
      const { decryptData } = await import('@/context/FamilyChatContext');
      data = await decryptData(data, password);
    }
    
    const parsed = JSON.parse(data);
    const valid = parsed._version && parsed.babies && Array.isArray(parsed.babies);
    
    return {
      valid,
      babies: parsed.babies?.length || 0,
      logs: Object.values(parsed.entries || {}).reduce((sum: number, arr: any[]) => sum + (arr?.length || 0), 0),
      date: parsed._timestamp,
    };
  } catch (error) {
    console.error('Preview error:', error);
    return { valid: false };
  }
};

export const pickBackupFile = async (): Promise<{ content: string; uri: string } | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    
    if (result.canceled || !result.assets?.[0]) return null;
    
    const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
    return { content, uri: result.assets[0].uri };
  } catch (error) {
    console.error('Pick backup error:', error);
    return null;
  }
};

export const restoreFromBackup = async (content: string, password?: string): Promise<{ success: boolean; message: string }> => {
  try {
    let data = content;
    if (data.includes('_encrypted') || data.startsWith('encrypted_')) {
      if (!password) return { success: false, message: 'Password required for encrypted backup' };
      const { decryptData } = await import('@/context/FamilyChatContext');
      data = await decryptData(data, password);
    }
    
    const parsed = JSON.parse(data);
    if (!parsed._version || !parsed.babies) {
      return { success: false, message: 'Invalid backup file' };
    }
    
    // Restore babies
    const { createBabyInDb, updateBabyInDb, getBabyByIdFromDb } = await import('@/database/dbHelpers');
    const { useAuth } = await import('@/context/AuthContext');
    const { userProfile } = useAuth();
    
    for (const baby of parsed.babies) {
      const exists = await getBabyByIdFromDb(baby.id);
      if (!exists) {
        await createBabyInDb({
          id: baby.id,
          name: baby.name,
          avatar: baby.avatar,
          dateOfBirth: baby.date_of_birth,
          gender: baby.gender,
          bloodType: baby.blood_type,
          medicalNotes: baby.medical_notes,
          parent1Id: baby.parent1_id || userProfile?.id,
          parent2Id: baby.parent2_id,
        });
      } else {
        await updateBabyInDb(baby.id, {
          name: baby.name,
          avatar: baby.avatar,
          dateOfBirth: baby.date_of_birth,
          gender: baby.gender,
          bloodType: baby.blood_type,
          medicalNotes: baby.medical_notes,
          parent2Id: baby.parent2_id,
        });
      }
    }
    
    // Restore entries
    const { createEntryInDb } = await import('@/database/dbHelpers');
    for (const [babyId, entries] of Object.entries(parsed.entries || {})) {
      for (const entry of entries as any[]) {
        await createEntryInDb({
          id: entry.id,
          babyId: entry.babyId,
          trackerId: entry.trackerId,
          timestamp: entry.timestamp,
          title: entry.title,
          data: entry.data,
          notes: entry.notes,
          photoUris: entry.photo_uris || entry.photoUris,
          tags: entry.tags,
        });
      }
    }
    
    // Restore settings
    const { setAppSetting } = await import('@/database/dbHelpers');
    for (const [key, value] of Object.entries(parsed.appSettings || {})) {
      await setAppSetting(key, String(value));
    }
    
    if (parsed.appSettings?.current_baby_id) {
      await AsyncStorage.setItem('@littleloom_current_baby', parsed.appSettings.current_baby_id);
    }
    
    return { success: true, message: `Restored ${parsed.babies.length} babies and their data` };
  } catch (error) {
    console.error('Restore error:', error);
    return { success: false, message: 'Failed to restore backup: ' + String(error) };
  }
};