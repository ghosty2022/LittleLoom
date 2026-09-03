import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  appVersion: string;
  platform: string;
  totalKeys: number;
  totalSize: number;
  deviceId?: string;
  encrypted: boolean;
  compressionRatio?: number;
}

export interface BackupPreview {
  valid: boolean;
  metadata?: BackupMetadata;
  babyCount: number;
  entryCount: number;
  size: string;
  version: string;
  warnings: string[];
  error?: string;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  metadata?: BackupMetadata;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredKeys: string[];
  failedKeys: string[];
  error?: string;
}

export interface LocalBackupInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  date: Date;
  dateFormatted: string;
  metadata?: BackupMetadata;
  isEncrypted: boolean;
}

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string; // HH:mm format
  keepCount: number; // how many backups to keep
  lastBackupDate?: string;
  includeMedia: boolean;
  encryptBackups: boolean;
  encryptionPassword?: string;
}

const BACKUP_VERSION = '2.0.0';
const BACKUP_FILE_PREFIX = 'littleloom_backup_';
const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';
const AUTO_BACKUP_SETTINGS_KEY = '@littleloom_auto_backup_settings';
const AUTO_BACKUP_LAST_RUN_KEY = '@littleloom_auto_backup_last_run';

const ENCRYPTION_SALT = 'littleloom_backup_v2_salt_2024';
const ENCRYPTION_ITERATIONS = 100000;

const BACKUP_KEYS = [
  'littleloom_auth_token',
  'littleloom_user_profile_secure',
  'littleloom_user_profile',
  'littleloom_community_profile_secure',
  'littleloom_community_profile',
  'littleloom_username_registry_secure',
  'littleloom_username_registry',
  'littleloom_profile_sync_queue',
  
  'littleloom_onboarding_complete',
  '@littleloom_has_seen_onboarding',
  'littleloom_setup_complete',
  'littleloom_has_parent2',
  'littleloom_has_baby',
  'littleloom_parent2_completed',
  'littleloom_baby_completed',
  'littleloom_last_auth_state',
  'littleloom_navigation_lock',
  
  'littleloom_biometric_enabled',
  'littleloom_biometric_available',
  'littleloom_biometric_login_enabled',
  'littleloom_pin_hash',
  'littleloom_biometric_email',
  'littleloom_biometric_password',
  'littleloom_app_lock_enabled',
  'littleloom_auto_lock_timeout',
  'littleloom_security_lock',
  'littleloom_last_active',
  'littleloom_manual_lock_time',
  'littleloom_setup_in_progress',
  
  '@littleloom_theme_preference_v1',
  
  '@littleloom_babies',
  '@littleloom_current_baby',
  '@littleloom_has_skipped_baby',
  
  '@littleloom_activities',
  
  '@littleloom_favorites_',
  '@littleloom_imported_tracks',
  '@littleloom_sleep_timer',
  
  '@community_posts_v2',
  '@community_topics_v2',
  '@community_likes_v2',
  '@community_bookmarks_v2',
  '@community_reposts_v2',
  '@community_follows_v2',
  '@community_comments_v2',
  '@community_messages_v2',
  '@community_notifications_v2',
  '@community_user_stats_v2',
  '@community_last_sync_v2',
  '@community_blocked_users_v2',
  '@littleloom_community_onboarding_v3',
  '@community_selected_topics_v2',
  '@community_user_followers_v2',
  '@community_user_following_v2',
  '@community_user_profiles_v2',
  '@community_interactions_version',
  '@community_posts',
  '@community_selected_topics',
  
  'littleloom_safety_data',
  'littleloom_emergency_logs',
  'littleloom_safety_streak',
  
  '@littleloom_current_family_code',
  '@littleloom_device_id',
  '@littleloom_family_sync',
  '@littleloom_typing_status',
  
  AUTO_BACKUP_SETTINGS_KEY,
  AUTO_BACKUP_LAST_RUN_KEY,
];

const DYNAMIC_KEY_PATTERNS = [
  /^@littleloom_growth_/,      // Growth data per baby
  /^@littleloom_milestones_/,  // Milestones per baby
  /^@littleloom_sleep_/,       // Sleep logs per baby
  /^@littleloom_feeding_/,     // Feeding logs per baby
  /^@littleloom_potty_/,       // Potty logs per baby
  /^@littleloom_medication_/,  // Medication logs per baby
  /^@littleloom_activities_/,  // Activities per baby
  /^littleloom_guardians_/,    // Guardians per baby
  /^@littleloom_family_chats_/,     // Family chats per family code
  /^@littleloom_family_msgs_/,      // Family messages per chat
  /^@community_user_stats_/,        // User stats per user
  /^@community_selected_topics_/,   // Selected topics per user
  /^@community_user_followers_/,    // Followers per user
  /^@community_user_following_/,    // Following per user
  /^@littleloom_favorites_/,        // Favorites per baby
];

/**
 * Derive a key from password using PBKDF2-like approach with expo-crypto
 */
async function deriveKey(password: string, salt: string): Promise<string> {
  let key = password + salt;
  for (let i = 0; i < ENCRYPTION_ITERATIONS; i++) {
    key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key + i.toString()
    );
  }
  return key;
}

/**
 * Simple XOR encryption with derived key
 * NOTE: This is basic obfuscation. For production, use a proper crypto library
 */
async function encryptData(data: string, password: string): Promise<string> {
  const key = await deriveKey(password, ENCRYPTION_SALT);
  const keyBytes = key.split('').map(c => c.charCodeAt(0));
  
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const keyByte = keyBytes[i % keyBytes.length];
    encrypted += String.fromCharCode(charCode ^ keyByte);
  }
  
  return btoa(encrypted);
}

async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    const key = await deriveKey(password, ENCRYPTION_SALT);
    const keyBytes = key.split('').map(c => c.charCodeAt(0));
    
    const data = atob(encryptedData);
    
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyByte = keyBytes[i % keyBytes.length];
      decrypted += String.fromCharCode(charCode ^ keyByte);
    }
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed. Invalid password or corrupted data.');
  }
}

const ensureBackupDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const generateBackupFileName = (encrypted: boolean = false): string => {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  const suffix = encrypted ? '_encrypted' : '';
  return `${BACKUP_FILE_PREFIX}${date}_${time}${suffix}.json`;
};

class BackupService {
  /**
   * Scan AsyncStorage for all keys matching known patterns
   */
  async getAllStorageKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const matchedKeys = new Set<string>();
      
      for (const key of BACKUP_KEYS) {
        if (allKeys.includes(key)) {
          matchedKeys.add(key);
        }
      }
      
      for (const key of allKeys) {
        for (const pattern of DYNAMIC_KEY_PATTERNS) {
          if (pattern.test(key)) {
            matchedKeys.add(key);
            break;
          }
        }
      }
      
      return Array.from(matchedKeys).sort();
    } catch (error) {
      console.error('Error scanning storage keys:', error);
      return [];
    }
  }

  /**
   * Get current stats for the backup screen
   */
  async getCurrentStats(): Promise<{ keys: number; size: string; babies: number }> {
    try {
      const keys = await this.getAllStorageKeys();
      const allData = await AsyncStorage.multiGet(keys);
      
      let totalSize = 0;
      let babyCount = 0;
      
      for (const [key, value] of allData) {
        if (value) {
          totalSize += value.length * 2;
        }
        
        if (key === '@littleloom_babies' && value) {
          try {
            const babies = JSON.parse(value);
            babyCount = Array.isArray(babies) ? babies.length : 0;
          } catch {
            babyCount = 0;
          }
        }
      }
      
      return {
        keys: keys.length,
        size: formatBytes(totalSize),
        babies: babyCount,
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { keys: 0, size: '0 B', babies: 0 };
    }
  }

  /**
   * Create a full backup of all app data
   */
  async createBackup(options?: { encrypted?: boolean; password?: string }): Promise<BackupResult> {
    try {
      await ensureBackupDir();
      
      const keys = await this.getAllStorageKeys();
      const allData = await AsyncStorage.multiGet(keys);
      
      const backupData: Record<string, any> = {};
      let totalSize = 0;
      
      for (const [key, value] of allData) {
        if (value !== null) {
          backupData[key] = value;
          totalSize += value.length * 2;
        }
      }
      
      const mediaBackup = await this.backupMediaFiles();
      if (mediaBackup.length > 0) {
        backupData['__media_files__'] = JSON.stringify(mediaBackup);
      }
      
      const metadata: BackupMetadata = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        platform: Platform.OS,
        totalKeys: keys.length,
        totalSize,
        encrypted: options?.encrypted || false,
      };
      
      const backup = {
        _metadata: metadata,
        _exportedAt: new Date().toISOString(),
        data: backupData,
      };
      
      let content = JSON.stringify(backup, null, 2);
      
      if (options?.encrypted && options?.password) {
        content = JSON.stringify({
          _encrypted: true,
          _metadata: metadata,
          payload: await encryptData(content, options.password),
        });
      }
      
      const fileName = generateBackupFileName(options?.encrypted);
      const filePath = BACKUP_DIR + fileName;
      
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      return {
        success: true,
        filePath,
        metadata,
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during backup',
      };
    }
  }

  /**
   * Backup media file references
   */
  private async backupMediaFiles(): Promise<Array<{ type: string; uri: string; key: string }>> {
    const mediaFiles: Array<{ type: string; uri: string; key: string }> = [];
    
    try {
      const chatMediaDir = FileSystem.documentDirectory + 'chat_media/';
      const chatFilesDir = FileSystem.documentDirectory + 'chat_files/';
      
      const [chatMediaInfo, chatFilesInfo] = await Promise.all([
        FileSystem.getInfoAsync(chatMediaDir),
        FileSystem.getInfoAsync(chatFilesDir),
      ]);
      
      if (chatMediaInfo.exists && chatMediaInfo.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(chatMediaDir);
        for (const file of files) {
          mediaFiles.push({ type: 'chat_media', uri: chatMediaDir + file, key: file });
        }
      }
      
      if (chatFilesInfo.exists && chatFilesInfo.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(chatFilesDir);
        for (const file of files) {
          mediaFiles.push({ type: 'chat_file', uri: chatFilesDir + file, key: file });
        }
      }
    } catch (error) {
      console.log('Media backup scan error:', error);
    }
    
    return mediaFiles;
  }

  /**
   * Share backup file via native share sheet
   */
  async shareBackup(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return false;
      }
      
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Save LittleLoom Backup',
        UTI: 'public.json',
      });
      
      return true;
    } catch (error) {
      console.error('Share failed:', error);
      return false;
    }
  }

  /**
   * Pick a backup file from device
   */
  async pickBackupFile(): Promise<{ content: string; name: string } | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }
      
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      return { content, name: file.name };
    } catch (error) {
      console.error('Pick backup failed:', error);
      return null;
    }
  }

  /**
   * Preview backup without restoring
   */
  async previewBackup(content: string, password?: string): Promise<BackupPreview> {
    try {
      let backup: any;
      
      const parsed = JSON.parse(content);
      if (parsed._encrypted) {
        if (!password) {
          return { 
            valid: false, 
            babyCount: 0, 
            entryCount: 0, 
            size: '0 B', 
            version: 'unknown', 
            warnings: [], 
            error: 'This backup is encrypted. Please enter the password to preview.' 
          };
        }
        try {
          const decrypted = await decryptData(parsed.payload, password);
          backup = JSON.parse(decrypted);
        } catch {
          return { 
            valid: false, 
            babyCount: 0, 
            entryCount: 0, 
            size: '0 B', 
            version: 'unknown', 
            warnings: [], 
            error: 'Invalid password or corrupted backup file.' 
          };
        }
      } else {
        backup = parsed;
      }
      
      if (!backup._metadata || !backup.data) {
        return { valid: false, babyCount: 0, entryCount: 0, size: '0 B', version: 'unknown', warnings: ['Invalid backup format'], error: 'Missing metadata or data' };
      }
      
      const metadata: BackupMetadata = backup._metadata;
      const data = backup.data;
      const warnings: string[] = [];
      
      if (metadata.version !== BACKUP_VERSION) {
        warnings.push(`Backup version (${metadata.version}) differs from app version (${BACKUP_VERSION}).`);
      }
      
      if (metadata.platform && metadata.platform !== Platform.OS) {
        warnings.push(`Backup from ${metadata.platform} may have compatibility issues on ${Platform.OS}.`);
      }
      
      let babyCount = 0;
      if (data['@littleloom_babies']) {
        try {
          const babies = JSON.parse(data['@littleloom_babies']);
          babyCount = Array.isArray(babies) ? babies.length : 0;
        } catch {
          babyCount = 0;
        }
      }
      
      let entryCount = 0;
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              entryCount += parsed.length;
            }
          } catch {
            entryCount += 1;
          }
        }
      }
      
      return {
        valid: true,
        metadata,
        babyCount,
        entryCount,
        size: formatBytes(metadata.totalSize || 0),
        version: metadata.version,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        babyCount: 0,
        entryCount: 0,
        size: '0 B',
        version: 'unknown',
        warnings: [],
        error: error instanceof Error ? error.message : 'Invalid backup file',
      };
    }
  }

  /**
   * Restore data from backup
   */
  async restoreBackup(content: string, password?: string): Promise<RestoreResult> {
    try {
      let backup: any;
      
      const parsed = JSON.parse(content);
      if (parsed._encrypted) {
        if (!password) {
          return { success: false, restoredKeys: [], failedKeys: [], error: 'Password required for encrypted backup' };
        }
        try {
          const decrypted = await decryptData(parsed.payload, password);
          backup = JSON.parse(decrypted);
        } catch {
          return { success: false, restoredKeys: [], failedKeys: [], error: 'Invalid password' };
        }
      } else {
        backup = parsed;
      }
      
      if (!backup.data || typeof backup.data !== 'object') {
        return { success: false, restoredKeys: [], failedKeys: [], error: 'Invalid backup data' };
      }
      
      const data: Record<string, string> = backup.data;
      const restoredKeys: string[] = [];
      const failedKeys: string[] = [];
      
      const entries = Object.entries(data);
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const asyncStorageBatch: [string, string][] = [];
        
        for (const [key, value] of batch) {
          if (key.startsWith('__') && key.endsWith('__')) continue;
          if (typeof value === 'string') {
            asyncStorageBatch.push([key, value]);
          }
        }
        
        try {
          await AsyncStorage.multiSet(asyncStorageBatch);
          restoredKeys.push(...asyncStorageBatch.map(([k]) => k));
        } catch (error) {
          console.error('Batch restore failed:', error);
          failedKeys.push(...asyncStorageBatch.map(([k]) => k));
        }
      }
      
      if (data['__media_files__']) {
        try {
          const mediaFiles = JSON.parse(data['__media_files__']);
          console.log(`Backup contains ${mediaFiles.length} media file references.`);
        } catch {
        }
      }
      
      return {
        success: failedKeys.length === 0,
        restoredKeys,
        failedKeys,
        error: failedKeys.length > 0 ? `Failed to restore ${failedKeys.length} keys` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        restoredKeys: [],
        failedKeys: [],
        error: error instanceof Error ? error.message : 'Restore failed',
      };
    }
  }

  /**
   * Cleanup backup file after sharing
   */
  async cleanupBackupFile(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Get list of local backup files
   */
  async listLocalBackups(): Promise<LocalBackupInfo[]> {
    try {
      await ensureBackupDir();
      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const backups: LocalBackupInfo[] = [];
      
      for (const file of files) {
        if (file.startsWith(BACKUP_FILE_PREFIX) && file.endsWith('.json')) {
          const filePath = BACKUP_DIR + file;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists && 'size' in fileInfo) {
            const dateMatch = file.match(/(\\d{4})-(\\d{2})-(\\d{2})_(\\d{2})-(\\d{2})-(\\d{2})/);
            let date = new Date();
            
            if (dateMatch) {
              date = new Date(
                parseInt(dateMatch[1]),
                parseInt(dateMatch[2]) - 1,
                parseInt(dateMatch[3]),
                parseInt(dateMatch[4]),
                parseInt(dateMatch[5]),
                parseInt(dateMatch[6])
              );
            }
            
            let metadata: BackupMetadata | undefined;
            let isEncrypted = file.includes('_encrypted');
            
            try {
              const content = await FileSystem.readAsStringAsync(filePath, {
                encoding: FileSystem.EncodingType.UTF8,
              });
              const parsed = JSON.parse(content);
              if (parsed._metadata) {
                metadata = parsed._metadata;
                isEncrypted = parsed._encrypted || parsed._metadata?.encrypted || false;
              }
            } catch {
            }
            
            backups.push({
              id: file,
              name: file,
              path: filePath,
              size: fileInfo.size,
              sizeFormatted: formatBytes(fileInfo.size),
              date,
              dateFormatted: date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              metadata,
              isEncrypted,
            });
          }
        }
      }
      
      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete a local backup file
   */
  async deleteLocalBackup(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read a local backup file content
   */
  async readLocalBackup(filePath: string): Promise<string | null> {
    try {
      return await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get auto backup settings
   */
  async getAutoBackupSettings(): Promise<AutoBackupSettings> {
    try {
      const stored = await AsyncStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading auto backup settings:', error);
    }
    
    return {
      enabled: false,
      frequency: 'weekly',
      timeOfDay: '02:00',
      keepCount: 5,
      includeMedia: false,
      encryptBackups: false,
    };
  }

  /**
   * Save auto backup settings
   */
  async saveAutoBackupSettings(settings: AutoBackupSettings): Promise<void> {
    await AsyncStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(settings));
    
    if (settings.enabled) {
      await this.scheduleAutoBackup(settings);
    } else {
      await this.cancelAutoBackupNotifications();
    }
  }

  /**
   * Schedule auto backup notification
   */
  private async scheduleAutoBackup(settings: AutoBackupSettings): Promise<void> {
    await this.cancelAutoBackupNotifications();
    
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    
    const [hours, minutes] = settings.timeOfDay.split(':').map(Number);
    
    const now = new Date();
    let triggerDate = new Date();
    triggerDate.setHours(hours, minutes, 0, 0);
    
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }
    
    if (settings.frequency === 'weekly') {
      const dayDiff = 7;
      triggerDate.setDate(triggerDate.getDate() + dayDiff);
    } else if (settings.frequency === 'monthly') {
      triggerDate.setMonth(triggerDate.getMonth() + 1);
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📦 LittleLoom Auto Backup',
        body: 'Your scheduled backup is ready to run. Tap to create a backup.',
        data: { type: 'auto_backup' },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      } as any,
    });
  }

  /**
   * Cancel auto backup notifications
   */
  private async cancelAutoBackupNotifications(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === 'auto_backup') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }

  /**
   * Run auto backup if due
   */
  async runAutoBackupIfDue(): Promise<BackupResult | null> {
    const settings = await this.getAutoBackupSettings();
    
    if (!settings.enabled) return null;
    
    const lastRunStr = await AsyncStorage.getItem(AUTO_BACKUP_LAST_RUN_KEY);
    const lastRun = lastRunStr ? new Date(lastRunStr) : null;
    const now = new Date();
    
    let shouldRun = false;
    
    if (!lastRun) {
      shouldRun = true;
    } else {
      const diffMs = now.getTime() - lastRun.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      switch (settings.frequency) {
        case 'daily':
          shouldRun = diffDays >= 1;
          break;
        case 'weekly':
          shouldRun = diffDays >= 7;
          break;
        case 'monthly':
          shouldRun = diffDays >= 30;
          break;
      }
    }
    
    if (!shouldRun) return null;
    
    const result = await this.createBackup({
      encrypted: settings.encryptBackups,
      password: settings.encryptionPassword,
    });
    
    if (result.success && result.filePath) {
      await AsyncStorage.setItem(AUTO_BACKUP_LAST_RUN_KEY, now.toISOString());
      
      await this.cleanupOldBackups(settings.keepCount);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Auto Backup Complete',
          body: `Your LittleLoom data has been backed up successfully.`,
        },
        trigger: null,
      });
    }
    
    return result;
  }

  /**
   * Cleanup old backups, keeping only the most recent N
   */
  async cleanupOldBackups(keepCount: number): Promise<void> {
    const backups = await this.listLocalBackups();
    
    if (backups.length <= keepCount) return;
    
    const toDelete = backups.slice(keepCount);
    
    for (const backup of toDelete) {
      await this.deleteLocalBackup(backup.path);
    }
  }
}

export const backupService = new BackupService();
export default backupService;
