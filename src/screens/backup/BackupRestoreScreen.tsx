// src/screens/backup/BackupRestoreScreen.tsx
// Complete, production-ready Backup & Restore with full Supabase integration

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dimensions,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupRestore'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  success: '#43e97b',
  warning: '#fee140',
  danger: '#ff4757',
  info: '#4facfe',
  purple: '#9b59b6',
  orange: '#e67e22',
};

// ─── Type Definitions ──────────────────────────────────────────────

interface AutoBackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string;
  keepCount: number;
  includeMedia: boolean;
  encryptBackups: boolean;
  encryptionPassword?: string;
}

interface LocalBackupInfo {
  id: string;
  name: string;
  path: string;
  dateFormatted: string;
  sizeFormatted: string;
  isEncrypted: boolean;
  timestamp: number;
}

interface BackupPreview {
  valid: boolean;
  babies?: number;
  logs?: number;
  milestones?: number;
  familyMembers?: number;
  date?: string;
  version?: string;
  isEncrypted?: boolean;
}

interface BackupResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface PickedBackup {
  content: string;
  fileName: string;
}

interface BackupData {
  _version: string;
  _timestamp: string;
  _encrypted: boolean;
  _userId?: string;
  babies: any[];
  entries: Record<string, any[]>;
  familyMembers: Record<string, any[]>;
  appSettings: Record<string, string>;
}

// ─── Encryption Helpers ────────────────────────────────────────────

const ENCRYPTION_PREFIX = 'LL_ENC_V1:';
const SALT = 'littleloom_backup_salt_v1';

/**
 * Simple XOR-based encryption with base64 encoding.
 * For production, consider using react-native-quick-crypto with AES-256-GCM.
 * This provides basic obfuscation - NOT military-grade encryption.
 */
const encryptBackupData = async (data: string, password: string): Promise<string> => {
  try {
    const passwordHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + SALT
    );

    // Create a repeating key from the hash
    const key = passwordHash.repeat(Math.ceil(data.length / passwordHash.length)).slice(0, data.length);

    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i);
      encrypted += String.fromCharCode(charCode);
    }

    // Base64 encode
    const base64 = btoa(unescape(encodeURIComponent(encrypted)));
    return ENCRYPTION_PREFIX + base64;
  } catch (error) {
    console.error('[Backup] Encryption failed:', error);
    throw new Error('Failed to encrypt backup');
  }
};

const decryptBackupData = async (encryptedData: string, password: string): Promise<string> => {
  try {
    if (!encryptedData.startsWith(ENCRYPTION_PREFIX)) {
      throw new Error('Invalid encrypted data format');
    }

    const base64 = encryptedData.slice(ENCRYPTION_PREFIX.length);
    const encrypted = decodeURIComponent(escape(atob(base64)));

    const passwordHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + SALT
    );

    const key = passwordHash.repeat(Math.ceil(encrypted.length / passwordHash.length)).slice(0, encrypted.length);

    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i);
      decrypted += String.fromCharCode(charCode);
    }

    return decrypted;
  } catch (error) {
    console.error('[Backup] Decryption failed:', error);
    throw new Error('Invalid password or corrupted backup');
  }
};

// ─── Backup Service ────────────────────────────────────────────────

const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';
const AUTO_BACKUP_SETTINGS_KEY = '@littleloom_auto_backup_settings';

class BackupService {
  private getUserId(): string | null {
    // This will be set by the screen before calling service methods
    return BackupService.currentUserId;
  }

  static currentUserId: string | null = null;

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }
  }

  /**
   * Get current data statistics
   */
  async getCurrentStats(userId: string): Promise<{ keys: number; size: string; babies: number; entries: number }> {
    try {
      const { data: babies, error: babyError } = await supabase
        .from('babies')
        .select('id')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
        .eq('is_active', true);

      if (babyError) throw babyError;

      const babyIds = (babies || []).map(b => b.id);
      let entryCount = 0;

      if (babyIds.length > 0) {
        const { count, error: entryError } = await supabase
          .from('tracker_entries')
          .select('*', { count: 'exact', head: true })
          .in('baby_id', babyIds)
          .eq('is_deleted', false);

        if (!entryError) {
          entryCount = count || 0;
        }
      }

      // Estimate size (rough)
      const estimatedSize = (babyIds.length * 2 + entryCount * 0.5) / 1024;
      const sizeFormatted = estimatedSize < 1024
        ? `${estimatedSize.toFixed(1)} KB`
        : `${(estimatedSize / 1024).toFixed(1)} MB`;

      return {
        keys: babyIds.length + entryCount,
        size: sizeFormatted,
        babies: babyIds.length,
        entries: entryCount,
      };
    } catch (error) {
      console.error('[BackupService] getCurrentStats error:', error);
      return { keys: 0, size: '0 B', babies: 0, entries: 0 };
    }
  }

  /**
   * List all local backups
   */
  async listLocalBackups(): Promise<LocalBackupInfo[]> {
    try {
      await this.ensureBackupDir();
      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const backups: LocalBackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = BACKUP_DIR + file;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists && 'size' in fileInfo) {
              const isEncrypted = file.includes('_encrypted');
              const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
              const timestampMatch = file.match(/_(\d+)\.json/);

              const sizeKB = Math.round(fileInfo.size / 1024);
              const sizeFormatted = sizeKB < 1024
                ? `${sizeKB} KB`
                : `${(sizeKB / 1024).toFixed(1)} MB`;

              backups.push({
                id: file,
                name: file.replace('.json', '').replace('_encrypted', ''),
                path: filePath,
                dateFormatted: dateMatch ? dateMatch[1] : 'Unknown',
                sizeFormatted,
                isEncrypted,
                timestamp: timestampMatch ? parseInt(timestampMatch[1]) : 0,
              });
            }
          } catch (fileError) {
            console.warn(`[BackupService] Error reading file ${file}:`, fileError);
          }
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);
      return backups;
    } catch (error) {
      console.error('[BackupService] listLocalBackups error:', error);
      return [];
    }
  }

  /**
   * Get auto backup settings
   */
  async getAutoBackupSettings(): Promise<AutoBackupSettings> {
    const defaults: AutoBackupSettings = {
      enabled: false,
      frequency: 'weekly',
      timeOfDay: '02:00',
      keepCount: 5,
      includeMedia: false,
      encryptBackups: false,
    };

    try {
      // Try Supabase first
      const userId = this.getUserId();
      if (userId) {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'auto_backup_settings')
          .eq('user_id', userId)
          .maybeSingle();

        if (data?.value) {
          return { ...defaults, ...JSON.parse(data.value) };
        }
      }

      // Fallback to AsyncStorage
      const stored = await AsyncStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }

      return defaults;
    } catch (error) {
      console.warn('[BackupService] getAutoBackupSettings error:', error);
      return defaults;
    }
  }

  /**
   * Save auto backup settings
   */
  async saveAutoBackupSettings(settings: AutoBackupSettings, userId: string): Promise<void> {
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(settings));

      // Save to Supabase
      await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'auto_backup_settings',
            value: JSON.stringify(settings),
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        );
    } catch (error) {
      console.error('[BackupService] saveAutoBackupSettings error:', error);
      throw error;
    }
  }

  /**
   * Create a full backup
   */
  async createBackup(
    userId: string,
    options: { encrypted: boolean; password?: string }
  ): Promise<BackupResult> {
    try {
      console.log('[BackupService] Creating backup for user:', userId);

      // 1. Fetch all babies the user has access to
      const { data: ownedBabies, error: ownedError } = await supabase
        .from('babies')
        .select('*')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
        .eq('is_active', true);

      if (ownedError) throw ownedError;

      // 2. Fetch family memberships to find babies shared with user
      const { data: memberships, error: memberError } = await supabase
        .from('family_members')
        .select('baby_id, role, permissions')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (memberError) console.warn('[BackupService] Membership fetch error:', memberError);

      // 3. Combine and deduplicate baby IDs
      const babyIds = new Set<string>();
      (ownedBabies || []).forEach(b => babyIds.add(b.id));

      if (memberships && memberships.length > 0) {
        const sharedBabyIds = memberships
          .map(m => m.baby_id)
          .filter(id => id && !babyIds.has(id));

        if (sharedBabyIds.length > 0) {
          const { data: sharedBabies } = await supabase
            .from('babies')
            .select('*')
            .in('id', sharedBabyIds)
            .eq('is_active', true);

          (sharedBabies || []).forEach(b => babyIds.add(b.id));
        }
      }

      const allBabyIds = Array.from(babyIds);
      console.log(`[BackupService] Found ${allBabyIds.length} babies to backup`);

      // 4. Fetch all babies
      let allBabies: any[] = [];
      if (allBabyIds.length > 0) {
        const { data: babies, error: babyError } = await supabase
          .from('babies')
          .select('*')
          .in('id', allBabyIds);

        if (babyError) throw babyError;
        allBabies = babies || [];
      }

      // 5. Fetch all tracker entries
      const entriesMap: Record<string, any[]> = {};
      if (allBabyIds.length > 0) {
        const { data: entries, error: entriesError } = await supabase
          .from('tracker_entries')
          .select('*')
          .in('baby_id', allBabyIds)
          .eq('is_deleted', false);

        if (entriesError) throw entriesError;

        (entries || []).forEach(entry => {
          if (!entriesMap[entry.baby_id]) {
            entriesMap[entry.baby_id] = [];
          }
          entriesMap[entry.baby_id].push(entry);
        });
      }

      // 6. Fetch family members
      const familyMembersMap: Record<string, any[]> = {};
      if (allBabyIds.length > 0) {
        const { data: familyMembers, error: fmError } = await supabase
          .from('family_members')
          .select('*')
          .in('baby_id', allBabyIds)
          .is('deleted_at', null);

        if (fmError) console.warn('[BackupService] Family members fetch error:', fmError);

        (familyMembers || []).forEach(member => {
          if (!familyMembersMap[member.baby_id]) {
            familyMembersMap[member.baby_id] = [];
          }
          familyMembersMap[member.baby_id].push(member);
        });
      }

      // 7. Fetch app settings for this user
      const appSettings: Record<string, string> = {};
      try {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('key, value')
          .eq('user_id', userId);

        (settings || []).forEach(s => {
          appSettings[s.key] = s.value;
        });
      } catch (settingsError) {
        console.warn('[BackupService] Settings fetch error:', settingsError);
      }

      // 8. Build backup data
      const backupData: BackupData = {
        _version: '2.0',
        _timestamp: new Date().toISOString(),
        _encrypted: options.encrypted,
        _userId: userId,
        babies: allBabies,
        entries: entriesMap,
        familyMembers: familyMembersMap,
        appSettings,
      };

      // 9. Serialize
      let jsonContent = JSON.stringify(backupData, null, 2);

      // 10. Encrypt if requested
      if (options.encrypted && options.password) {
        jsonContent = await encryptBackupData(jsonContent, options.password);
      }

      // 11. Write to file
      await this.ensureBackupDir();

      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
      const fileName = `backup_${dateStr}_${timestamp}${options.encrypted ? '_encrypted' : ''}.json`;
      const filePath = BACKUP_DIR + fileName;

      await FileSystem.writeAsStringAsync(filePath, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('[BackupService] Backup created:', filePath);
      return { success: true, filePath };
    } catch (error) {
      console.error('[BackupService] createBackup error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Share a backup file
   */
  async shareBackup(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.warn('[BackupService] Sharing not available');
        return false;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Share LittleLoom Backup',
        UTI: 'public.json',
      });

      return true;
    } catch (error) {
      console.error('[BackupService] shareBackup error:', error);
      return false;
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackupFile(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return true;
    } catch (error) {
      console.warn('[BackupService] deleteBackupFile error:', error);
      return false;
    }
  }

  /**
   * Read a local backup file
   */
  async readLocalBackup(filePath: string): Promise<string | null> {
    try {
      return await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      console.error('[BackupService] readLocalBackup error:', error);
      return null;
    }
  }

  /**
   * Pick a backup file from device
   */
  async pickBackupFile(): Promise<PickedBackup | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return {
        content,
        fileName: asset.name || 'backup.json',
      };
    } catch (error) {
      console.error('[BackupService] pickBackupFile error:', error);
      return null;
    }
  }

  /**
   * Check if content is encrypted
   */
  isEncrypted(content: string): boolean {
    return content.startsWith(ENCRYPTION_PREFIX);
  }

  /**
   * Preview a backup without restoring
   */
  async previewBackup(content: string, password?: string): Promise<BackupPreview> {
    try {
      let data = content;

      // Check if encrypted
      if (this.isEncrypted(content)) {
        if (!password) {
          return { valid: false, isEncrypted: true };
        }
        data = await decryptBackupData(content, password);
      }

      const parsed: BackupData = JSON.parse(data);

      // Validate structure
      if (!parsed._version || !Array.isArray(parsed.babies)) {
        return { valid: false };
      }

      // Count entries
      let totalLogs = 0;
      Object.values(parsed.entries || {}).forEach(entries => {
        if (Array.isArray(entries)) {
          totalLogs += entries.length;
        }
      });

      // Count family members
      let totalFamilyMembers = 0;
      Object.values(parsed.familyMembers || {}).forEach(members => {
        if (Array.isArray(members)) {
          totalFamilyMembers += members.length;
        }
      });

      // Count milestones from entries
      let milestones = 0;
      Object.values(parsed.entries || {}).forEach(entries => {
        if (Array.isArray(entries)) {
          milestones += entries.filter(e => e.tracker_type === 'milestone').length;
        }
      });

      return {
        valid: true,
        babies: parsed.babies.length,
        logs: totalLogs,
        milestones,
        familyMembers: totalFamilyMembers,
        date: parsed._timestamp,
        version: parsed._version,
        isEncrypted: parsed._encrypted,
      };
    } catch (error) {
      console.error('[BackupService] previewBackup error:', error);
      return { valid: false };
    }
  }

  /**
   * Restore backup data
   */
  async restoreBackup(
    content: string,
    userId: string,
    password?: string,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{ success: boolean; message: string; stats?: { babies: number; entries: number; familyMembers: number } }> {
    try {
      let data = content;

      // Decrypt if needed
      if (this.isEncrypted(content)) {
        if (!password) {
          return { success: false, message: 'Password required for encrypted backup' };
        }
        onProgress?.('Decrypting backup...', 5);
        data = await decryptBackupData(content, password);
      }

      onProgress?.('Parsing backup data...', 10);
      const parsed: BackupData = JSON.parse(data);

      // Validate
      if (!parsed._version || !Array.isArray(parsed.babies)) {
        return { success: false, message: 'Invalid backup file format' };
      }

      const stats = {
        babies: 0,
        entries: 0,
        familyMembers: 0,
      };

      // ─── Step 1: Restore babies ────────────────────────────────────
      onProgress?.('Restoring baby profiles...', 20);

      for (const baby of parsed.babies) {
        try {
          // Check if baby already exists
          const { data: existing } = await supabase
            .from('babies')
            .select('id')
            .eq('id', baby.id)
            .maybeSingle();

          if (existing) {
            // Update existing baby (but don't change parent1_id)
            const { error: updateError } = await supabase
              .from('babies')
              .update({
                name: baby.name,
                avatar: baby.avatar,
                date_of_birth: baby.date_of_birth,
                gender: baby.gender,
                blood_type: baby.blood_type,
                medical_notes: baby.medical_notes,
                allergies: baby.allergies,
                current_weight_kg: baby.current_weight_kg,
                current_height_cm: baby.current_height_cm,
                skin_tone: baby.skin_tone,
                updated_at: new Date().toISOString(),
              })
              .eq('id', baby.id);

            if (updateError) {
              console.warn(`[Restore] Failed to update baby ${baby.id}:`, updateError);
            } else {
              stats.babies++;
            }
          } else {
            // Insert new baby
            // Remap parent IDs if they don't match current user
            const parent1Id = baby.parent1_id === parsed._userId ? userId : baby.parent1_id;
            const parent2Id = baby.parent2_id === parsed._userId ? userId : baby.parent2_id;

            const { error: insertError } = await supabase
              .from('babies')
              .insert({
                ...baby,
                parent1_id: parent1Id,
                parent2_id: parent2Id,
                created_at: baby.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (insertError) {
              console.warn(`[Restore] Failed to insert baby ${baby.id}:`, insertError);
            } else {
              stats.babies++;
            }
          }
        } catch (babyError) {
          console.warn(`[Restore] Error processing baby ${baby.id}:`, babyError);
        }
      }

      // ─── Step 2: Restore tracker entries ────────────────────────────
      onProgress?.('Restoring tracker entries...', 40);

      const allEntries: any[] = [];
      Object.values(parsed.entries || {}).forEach(entries => {
        if (Array.isArray(entries)) {
          allEntries.push(...entries);
        }
      });

      // Batch insert entries (Supabase has limits, so chunk them)
      const CHUNK_SIZE = 50;
      for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
        const chunk = allEntries.slice(i, i + CHUNK_SIZE);
        const progress = 40 + Math.round((i / allEntries.length) * 40);
        onProgress?.(`Restoring entries (${i + 1}/${allEntries.length})...`, progress);

        for (const entry of chunk) {
          try {
            // Check if entry exists
            const { data: existing } = await supabase
              .from('tracker_entries')
              .select('id')
              .eq('id', entry.id)
              .maybeSingle();

            // Remap user IDs
            const loggedBy = entry.logged_by === parsed._userId ? userId : entry.logged_by;
            const createdBy = entry.created_by === parsed._userId ? userId : entry.created_by;

            if (existing) {
              const { error: updateError } = await supabase
                .from('tracker_entries')
                .update({
                  timestamp: entry.timestamp,
                  title: entry.title,
                  data: entry.data,
                  notes: entry.notes,
                  photo_uris: entry.photo_uris,
                  tags: entry.tags,
                  logged_by: loggedBy,
                  logged_by_name: entry.logged_by_name,
                  logged_by_role: entry.logged_by_role,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', entry.id);

              if (!updateError) {
                stats.entries++;
              }
            } else {
              const { error: insertError } = await supabase
                .from('tracker_entries')
                .insert({
                  ...entry,
                  logged_by: loggedBy,
                  created_by: createdBy,
                  created_at: entry.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });

              if (!insertError) {
                stats.entries++;
              }
            }
          } catch (entryError) {
            console.warn(`[Restore] Error processing entry ${entry.id}:`, entryError);
          }
        }
      }

      // ─── Step 3: Restore family members ─────────────────────────────
      onProgress?.('Restoring family members...', 85);

      const allFamilyMembers: any[] = [];
      Object.values(parsed.familyMembers || {}).forEach(members => {
        if (Array.isArray(members)) {
          allFamilyMembers.push(...members);
        }
      });

      for (const member of allFamilyMembers) {
        try {
          const { data: existing } = await supabase
            .from('family_members')
            .select('id')
            .eq('id', member.id)
            .maybeSingle();

          if (!existing) {
            const { error: insertError } = await supabase
              .from('family_members')
              .insert({
                ...member,
                added_at: member.added_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (!insertError) {
              stats.familyMembers++;
            }
          }
        } catch (memberError) {
          console.warn(`[Restore] Error processing family member ${member.id}:`, memberError);
        }
      }

      // ─── Step 4: Restore app settings ──────────────────────────────
      onProgress?.('Restoring settings...', 95);

      for (const [key, value] of Object.entries(parsed.appSettings || {})) {
        // Skip auto_backup_settings - we don't want to overwrite current settings
        if (key === 'auto_backup_settings') continue;

        try {
          await supabase
            .from('app_settings')
            .upsert(
              {
                key,
                value,
                user_id: userId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'key,user_id' }
            );
        } catch (settingError) {
          console.warn(`[Restore] Error restoring setting ${key}:`, settingError);
        }
      }

      onProgress?.('Restore complete!', 100);

      return {
        success: true,
        message: `Successfully restored ${stats.babies} babies, ${stats.entries} entries, and ${stats.familyMembers} family members.`,
        stats,
      };
    } catch (error) {
      console.error('[BackupService] restoreBackup error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  }

  /**
   * Clean up old backups based on keep count
   */
  async cleanupOldBackups(keepCount: number): Promise<void> {
    try {
      const backups = await this.listLocalBackups();
      if (backups.length <= keepCount) return;

      const toDelete = backups.slice(keepCount);
      for (const backup of toDelete) {
        await this.deleteBackupFile(backup.path);
      }
    } catch (error) {
      console.warn('[BackupService] cleanupOldBackups error:', error);
    }
  }
}

const backupService = new BackupService();

// ─── Encryption Modal ──────────────────────────────────────────────

interface EncryptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
}

const EncryptModal: React.FC<EncryptModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isDark,
  primaryColor,
  secondaryColor,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const sweetAlert = useSweetAlert();

  const handleConfirm = () => {
    if (password.length < 6) {
      sweetAlert.alert('Password Too Short', 'Password must be at least 6 characters', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      sweetAlert.alert('Passwords Do Not Match', 'Please make sure both passwords match', 'warning');
      return;
    }
    onConfirm(password);
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={32} color={primaryColor} />
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>Encrypt Backup</Text>
              <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                Set a password to protect your backup file
              </Text>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={primaryColor}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Confirm Password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm}>
                <LinearGradient
                  colors={[primaryColor, secondaryColor]}
                  style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalConfirmText}>Encrypt & Backup</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

// ─── Password Modal ────────────────────────────────────────────────

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isDark,
  primaryColor,
  secondaryColor,
  title,
  subtitle,
  isLoading,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const sweetAlert = useSweetAlert();

  const handleConfirm = () => {
    if (!password) {
      sweetAlert.alert('Password Required', 'Please enter the backup password', 'warning');
      return;
    }
    onConfirm(password);
  };

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={32} color={primaryColor} />
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>
                {title || 'Enter Password'}
              </Text>
              <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                {subtitle || 'This backup is encrypted'}
              </Text>
            </View>

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Backup Password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleConfirm}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={primaryColor}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleClose}
                disabled={isLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirm}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={[primaryColor, secondaryColor]}
                  style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

// ─── Auto Backup Modal ─────────────────────────────────────────────

interface AutoBackupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: AutoBackupSettings) => void;
  settings: AutoBackupSettings;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
}

const AutoBackupModal: React.FC<AutoBackupModalProps> = ({
  visible,
  onClose,
  onSave,
  settings,
  isDark,
  primaryColor,
  secondaryColor,
}) => {
  const [localSettings, setLocalSettings] = useState<AutoBackupSettings>(settings);
  const [showPassword, setShowPassword] = useState(false);
  const sweetAlert = useSweetAlert();

  // Sync with prop changes
  useEffect(() => {
    if (visible) {
      setLocalSettings(settings);
    }
  }, [visible, settings]);

  const frequencies = [
    { label: 'Daily', value: 'daily' as const },
    { label: 'Weekly', value: 'weekly' as const },
    { label: 'Monthly', value: 'monthly' as const },
  ];

  const keepCounts = [3, 5, 10, 20];

  const handleSave = () => {
    if (localSettings.enabled && localSettings.encryptBackups) {
      if (!localSettings.encryptionPassword || localSettings.encryptionPassword.length < 6) {
        sweetAlert.alert('Password Required', 'Please set a password (min 6 characters) for encrypted backups', 'warning');
        return;
      }
    }
    onSave(localSettings);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark, { maxHeight: '80%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Ionicons name="time-outline" size={32} color={primaryColor} />
                <Text style={[styles.modalTitle, isDark && styles.textLight]}>Auto Backup</Text>
                <Text style={[styles.modalSubtitle, isDark && styles.textSecondaryLight]}>
                  Schedule automatic backups of your data
                </Text>
              </View>

              {/* Enable Toggle */}
              <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, isDark && styles.textLight]}>Enable Auto Backup</Text>
                  <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                    Automatically backup your data
                  </Text>
                </View>
                <Switch
                  value={localSettings.enabled}
                  onValueChange={(v) => setLocalSettings({ ...localSettings, enabled: v })}
                  trackColor={{ false: '#767577', true: primaryColor }}
                  thumbColor={localSettings.enabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              {localSettings.enabled && (
                <>
                  {/* Frequency */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Frequency</Text>
                    <View style={styles.frequencyButtons}>
                      {frequencies.map((f) => (
                        <TouchableOpacity
                          key={f.value}
                          style={[
                            styles.freqButton,
                            localSettings.frequency === f.value && { backgroundColor: primaryColor },
                          ]}
                          onPress={() => setLocalSettings({ ...localSettings, frequency: f.value })}
                        >
                          <Text
                            style={[
                              styles.freqButtonText,
                              localSettings.frequency === f.value && styles.freqButtonTextActive,
                            ]}
                          >
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Keep Count */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Keep Backups</Text>
                    <View style={styles.keepCountButtons}>
                      {keepCounts.map((count) => (
                        <TouchableOpacity
                          key={count}
                          style={[
                            styles.keepButton,
                            localSettings.keepCount === count && { backgroundColor: primaryColor },
                          ]}
                          onPress={() => setLocalSettings({ ...localSettings, keepCount: count })}
                        >
                          <Text
                            style={[
                              styles.keepButtonText,
                              localSettings.keepCount === count && styles.keepButtonTextActive,
                            ]}
                          >
                            {count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Encryption Toggle */}
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, isDark && styles.textLight]}>Encrypt Backups</Text>
                      <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                        Password-protect your backups
                      </Text>
                    </View>
                    <Switch
                      value={localSettings.encryptBackups}
                      onValueChange={(v) => setLocalSettings({ ...localSettings, encryptBackups: v })}
                      trackColor={{ false: '#767577', true: primaryColor }}
                      thumbColor={localSettings.encryptBackups ? '#fff' : '#f4f3f4'}
                    />
                  </View>

                  {localSettings.encryptBackups && (
                    <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                      <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, isDark && styles.textLight]}
                        placeholder="Backup Password"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                        value={localSettings.encryptionPassword || ''}
                        onChangeText={(v) => setLocalSettings({ ...localSettings, encryptionPassword: v })}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={primaryColor}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmButton} onPress={handleSave}>
                  <LinearGradient
                    colors={[primaryColor, secondaryColor]}
                    style={styles.modalConfirmGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.modalConfirmText}>Save Settings</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

// ─── Stat Pill Component ───────────────────────────────────────────

interface StatPillProps {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  isDark: boolean;
}

const StatPill: React.FC<StatPillProps> = ({ icon, label, value, color, isDark }) => (
  <View style={[styles.statPill, isDark && styles.statPillDark]}>
    <View style={[styles.statPillIcon, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={[styles.statPillValue, isDark && styles.statPillValueDark]}>{value}</Text>
    <Text style={[styles.statPillLabel, isDark && styles.statPillLabelDark]}>{label}</Text>
  </View>
);

// ─── Action Card Component ─────────────────────────────────────────

interface ActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  badge?: string;
  isDark: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  title,
  subtitle,
  color,
  onPress,
  isLoading,
  disabled,
  badge,
  isDark,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled || isLoading) return;
    scale.value = withSequence(
      withTiming(0.96, { duration: 50 }),
      withTiming(1, { duration: 100 })
    );
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.actionCard, animatedStyle, isDark && styles.actionCardDark]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled || isLoading}
    >
      <LinearGradient
        colors={[`${color}15`, `${color}05`]}
        style={styles.actionCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.actionIcon, { backgroundColor: `${color}20` }]}>
          {isLoading ? (
            <ActivityIndicator color={color} />
          ) : (
            <Ionicons name={icon as any} size={28} color={color} />
          )}
        </View>
        <View style={styles.actionText}>
          <Text style={[styles.actionTitle, isDark && styles.actionTitleDark]}>{title}</Text>
          <Text style={[styles.actionSubtitle, isDark && styles.actionSubtitleDark]}>{subtitle}</Text>
        </View>
        {badge && (
          <View style={[styles.badge, { backgroundColor: `${color}30` }]}>
            <Text style={[styles.badgeText, { color }]}>{badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ─── Local Backup Item Component ───────────────────────────────────

interface LocalBackupItemProps {
  backup: LocalBackupInfo;
  onPress: () => void;
  onShare: () => void;
  onDelete: () => void;
  isDark: boolean;
}

const LocalBackupItem: React.FC<LocalBackupItemProps> = ({
  backup,
  onPress,
  onShare,
  onDelete,
  isDark,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.97, { duration: 50 }),
      withTiming(1, { duration: 100 })
    );
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.localBackupItem, isDark && styles.localBackupItemDark, animatedStyle]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.localBackupIcon,
          {
            backgroundColor: backup.isEncrypted
              ? `${COLORS.purple}20`
              : `${COLORS.success}20`,
          },
        ]}
      >
        <Ionicons
          name={backup.isEncrypted ? 'lock-closed' : 'document-text'}
          size={22}
          color={backup.isEncrypted ? COLORS.purple : COLORS.success}
        />
      </View>

      <View style={styles.localBackupInfo}>
        <Text style={[styles.localBackupName, isDark && styles.textLight]} numberOfLines={1}>
          {backup.name}
        </Text>
        <Text style={styles.localBackupMeta}>
          {backup.dateFormatted} • {backup.sizeFormatted}
          {backup.isEncrypted && ' • 🔒'}
        </Text>
      </View>

      <View style={styles.localBackupActions}>
        <TouchableOpacity
          style={styles.localBackupAction}
          onPress={onShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color={isDark ? '#888' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.localBackupAction}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────

export default function BackupRestoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();
  const { userProfile } = useAuth();
  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  // ─── State ────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [stats, setStats] = useState({ keys: 0, size: '0 B', babies: 0, entries: 0 });
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);
  const [showLocalBackups, setShowLocalBackups] = useState(true);
  const [restoreProgress, setRestoreProgress] = useState<{ message: string; progress: number } | null>(null);

  // Modals
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAutoBackupModal, setShowAutoBackupModal] = useState(false);

  // Pending actions
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'preview' | 'restore' | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Auto backup settings
  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>({
    enabled: false,
    frequency: 'weekly',
    timeOfDay: '02:00',
    keepCount: 5,
    includeMedia: false,
    encryptBackups: false,
  });

  const userId = userProfile?.id || '';

  // ─── Load Data ────────────────────────────────────────────────────

  useEffect(() => {
    // Set user ID for the service
    BackupService.currentUserId = userId;
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [statsData, backups, settings] = await Promise.all([
          backupService.getCurrentStats(userId),
          backupService.listLocalBackups(),
          backupService.getAutoBackupSettings(),
        ]);

        setStats(statsData);
        setLocalBackups(backups);
        setAutoBackupSettings(settings);

        if (backups.length > 0) {
          setLastBackup(backups[0].dateFormatted);
        }
      } catch (error) {
        console.error('[BackupRestore] Load error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // ─── Refresh Functions ────────────────────────────────────────────

  const refreshStats = useCallback(async () => {
    if (!userId) return;
    const newStats = await backupService.getCurrentStats(userId);
    setStats(newStats);
  }, [userId]);

  const refreshBackups = useCallback(async () => {
    const backups = await backupService.listLocalBackups();
    setLocalBackups(backups);
    if (backups.length > 0) {
      setLastBackup(backups[0].dateFormatted);
    } else {
      setLastBackup(null);
    }
  }, []);

  // ─── Create Backup ────────────────────────────────────────────────

  const handleCreateBackup = useCallback(
    async (encrypted: boolean = false, password?: string) => {
      if (!userId) {
        sweetAlert.alert('Error', 'You must be signed in to create backups', 'error');
        return;
      }

      triggerHaptic('medium');
      setIsCreating(true);

      try {
        const result = await backupService.createBackup(userId, { encrypted, password });

        if (result.success && result.filePath) {
          // Refresh backups list
          await refreshBackups();

          // Ask user if they want to share
          sweetAlert.confirm(
            '✅ Backup Created!',
            `Your ${encrypted ? 'encrypted ' : ''}backup has been saved locally. Would you like to share it?`,
            async () => {
              const shared = await backupService.shareBackup(result.filePath!);
              if (shared) {
                triggerHaptic('success');
              }
            },
            () => {
              // User chose not to share - backup is saved locally
              triggerHaptic('success');
              sweetAlert.alert(
                'Backup Saved',
                'Your backup is saved locally. You can share it later from the backups list.',
                'success'
              );
            },
            'Share',
            'Keep Local',
            false
          );

          // Cleanup old backups
          await backupService.cleanupOldBackups(autoBackupSettings.keepCount);
        } else {
          throw new Error(result.error || 'Failed to create backup');
        }
      } catch (error) {
        console.error('[BackupRestore] Create backup error:', error);
        triggerHaptic('error');
        sweetAlert.alert(
          'Backup Failed',
          'Something went wrong while creating your backup. Please try again.',
          'error'
        );
      } finally {
        setIsCreating(false);
      }
    },
    [userId, autoBackupSettings.keepCount, refreshBackups, sweetAlert, triggerHaptic]
  );

  const promptEncryptedBackup = useCallback(() => {
    triggerHaptic('light');
    setShowEncryptModal(true);
  }, [triggerHaptic]);

  // ─── Restore Backup ───────────────────────────────────────────────

  const handlePickBackupFile = useCallback(async () => {
    if (!userId) {
      sweetAlert.alert('Error', 'You must be signed in to restore backups', 'error');
      return;
    }

    triggerHaptic('medium');

    try {
      const picked = await backupService.pickBackupFile();

      if (!picked) {
        return; // User cancelled
      }

      // Check if encrypted
      if (backupService.isEncrypted(picked.content)) {
        setPendingContent(picked.content);
        setPendingAction('restore');
        setShowPasswordModal(true);
        return;
      }

      // Preview the backup
      const previewData = await backupService.previewBackup(picked.content);
      setPreview(previewData);

      if (!previewData.valid) {
        sweetAlert.alert('Invalid Backup', 'The selected file is not a valid LittleLoom backup.', 'error');
        return;
      }

      // Confirm restore
      sweetAlert.confirm(
        'Restore Backup?',
        `This will restore:\n\n` +
          `• ${previewData.babies || 0} baby profile${previewData.babies !== 1 ? 's' : ''}\n` +
          `• ${previewData.logs || 0} tracker entr${previewData.logs !== 1 ? 'ies' : 'y'}\n` +
          `• ${previewData.familyMembers || 0} family member${previewData.familyMembers !== 1 ? 's' : ''}\n\n` +
          `Existing data with the same IDs will be updated.`,
        async () => {
          await performRestore(picked.content);
        },
        () => {},
        'Restore',
        'Cancel',
        false
      );
    } catch (error) {
      console.error('[BackupRestore] Pick backup error:', error);
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Could not read the selected file.', 'error');
    }
  }, [userId, sweetAlert, triggerHaptic]);

  const performRestore = useCallback(
    async (content: string, password?: string) => {
      if (!userId) return;

      setIsRestoring(true);
      setRestoreProgress({ message: 'Starting restore...', progress: 0 });

      try {
        const result = await backupService.restoreBackup(
          content,
          userId,
          password,
          (message, progress) => {
            setRestoreProgress({ message, progress });
          }
        );

        if (result.success) {
          triggerHaptic('success');
          sweetAlert.alert(
            '✅ Restore Complete!',
            result.message,
            'success'
          );

          // Refresh stats and backups
          await Promise.all([refreshStats(), refreshBackups()]);

          // Navigate to main to refresh all data
          setTimeout(() => {
            navigation.replace('Main' as any);
          }, 1500);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('[BackupRestore] Restore error:', error);
        triggerHaptic('error');
        sweetAlert.alert(
          'Restore Failed',
          error instanceof Error ? error.message : 'Could not restore data from backup.',
          'error'
        );
      } finally {
        setIsRestoring(false);
        setRestoreProgress(null);
        setPendingContent(null);
        setPendingPassword(null);
        setPendingAction(null);
      }
    },
    [userId, navigation, refreshStats, refreshBackups, sweetAlert, triggerHaptic]
  );

  // ─── Handle Password Confirmation ─────────────────────────────────

  const handlePasswordConfirm = useCallback(
    async (password: string) => {
      if (!pendingContent) return;

      setIsPasswordLoading(true);

      try {
        // Verify password by attempting to preview
        const previewData = await backupService.previewBackup(pendingContent, password);

        if (!previewData.valid) {
          setIsPasswordLoading(false);
          sweetAlert.alert(
            'Invalid Password',
            'The password you entered is incorrect. Please try again.',
            'error'
          );
          return;
        }

        setShowPasswordModal(false);
        setIsPasswordLoading(false);
        setPendingPassword(password);

        // Show preview and confirm
        setPreview(previewData);

        sweetAlert.confirm(
          'Restore Backup?',
          `This will restore:\n\n` +
            `• ${previewData.babies || 0} baby profile${previewData.babies !== 1 ? 's' : ''}\n` +
            `• ${previewData.logs || 0} tracker entr${previewData.logs !== 1 ? 'ies' : 'y'}\n` +
            `• ${previewData.familyMembers || 0} family member${previewData.familyMembers !== 1 ? 's' : ''}`,
          async () => {
            await performRestore(pendingContent, password);
          },
          () => {
            setPendingContent(null);
            setPendingPassword(null);
            setPendingAction(null);
          },
          'Restore',
          'Cancel',
          false
        );
      } catch (error) {
        setIsPasswordLoading(false);
        sweetAlert.alert(
          'Invalid Password',
          'The password you entered is incorrect. Please try again.',
          'error'
        );
      }
    },
    [pendingContent, performRestore, sweetAlert]
  );

  // ─── Local Backup Actions ─────────────────────────────────────────

  const handleLocalBackupPress = useCallback(
    async (backup: LocalBackupInfo) => {
      triggerHaptic('light');

      try {
        const content = await backupService.readLocalBackup(backup.path);

        if (!content) {
          sweetAlert.alert('Error', 'Could not read backup file.', 'warning');
          return;
        }

        if (backup.isEncrypted) {
          setPendingContent(content);
          setPendingAction('restore');
          setShowPasswordModal(true);
          return;
        }

        const previewData = await backupService.previewBackup(content);
        setPreview(previewData);

        if (!previewData.valid) {
          sweetAlert.alert('Invalid Backup', 'This backup file is corrupted or invalid.', 'error');
          return;
        }

        sweetAlert.confirm(
          'Restore This Backup?',
          `Created: ${previewData.date ? new Date(previewData.date).toLocaleString() : 'Unknown'}\n\n` +
            `• ${previewData.babies || 0} babies\n` +
            `• ${previewData.logs || 0} entries\n` +
            `• ${previewData.familyMembers || 0} family members`,
          async () => {
            await performRestore(content);
          },
          () => {},
          'Restore',
          'Cancel',
          false
        );
      } catch (error) {
        console.error('[BackupRestore] Local backup error:', error);
        sweetAlert.alert('Error', 'Could not process the backup file.', 'error');
      }
    },
    [sweetAlert, triggerHaptic, performRestore]
  );

  const handleShareLocalBackup = useCallback(
    async (backup: LocalBackupInfo) => {
      triggerHaptic('light');
      const shared = await backupService.shareBackup(backup.path);
      if (shared) {
        triggerHaptic('success');
      }
    },
    [triggerHaptic]
  );

  const handleDeleteLocalBackup = useCallback(
    (backup: LocalBackupInfo) => {
      triggerHaptic('light');
      sweetAlert.confirm(
        'Delete Backup?',
        `Are you sure you want to delete "${backup.name}"? This cannot be undone.`,
        async () => {
          const deleted = await backupService.deleteBackupFile(backup.path);
          if (deleted) {
            await refreshBackups();
            triggerHaptic('success');
          } else {
            sweetAlert.alert('Error', 'Failed to delete backup.', 'error');
          }
        },
        () => {},
        'Delete',
        'Cancel',
        true
      );
    },
    [sweetAlert, triggerHaptic, refreshBackups]
  );

  // ─── Auto Backup Settings ─────────────────────────────────────────

  const handleSaveAutoBackupSettings = useCallback(
    async (settings: AutoBackupSettings) => {
      if (!userId) return;

      try {
        await backupService.saveAutoBackupSettings(settings, userId);
        setAutoBackupSettings(settings);
        setShowAutoBackupModal(false);
        triggerHaptic('success');
        sweetAlert.alert('Settings Saved', 'Your auto backup settings have been saved.', 'success');
      } catch (error) {
        triggerHaptic('error');
        sweetAlert.alert('Error', 'Failed to save settings. Please try again.', 'error');
      }
    },
    [userId, sweetAlert, triggerHaptic]
  );

  const handleRunBackupNow = useCallback(async () => {
    if (!userId) return;

    triggerHaptic('medium');
    setIsCreating(true);

    try {
      const result = await backupService.createBackup(userId, {
        encrypted: autoBackupSettings.encryptBackups,
        password: autoBackupSettings.encryptionPassword,
      });

      if (result.success) {
        await refreshBackups();
        await backupService.cleanupOldBackups(autoBackupSettings.keepCount);
        triggerHaptic('success');
        sweetAlert.alert('✅ Backup Complete', 'Your data has been backed up successfully.', 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      triggerHaptic('error');
      sweetAlert.alert('Backup Failed', 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [userId, autoBackupSettings, refreshBackups, sweetAlert, triggerHaptic]);

  // ─── Clear All Backups ────────────────────────────────────────────

  const handleClearAllBackups = useCallback(() => {
    sweetAlert.confirm(
      'Clear All Backups?',
      `This will delete all ${localBackups.length} local backups. This cannot be undone.`,
      async () => {
        for (const backup of localBackups) {
          await backupService.deleteBackupFile(backup.path);
        }
        await refreshBackups();
        triggerHaptic('success');
      },
      () => {},
      'Delete All',
      'Cancel',
      true
    );
  }, [localBackups, sweetAlert, refreshBackups, triggerHaptic]);

  // ─── Render ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <LinearGradient
        colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#f8faff', '#f0f4ff']}
        style={[styles.container, styles.loadingContainer]}
      >
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, isDark && styles.textLight]}>
          Loading backup data...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#f8faff', '#f0f4ff']}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            Backup & Restore
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Protect your memories, move between devices
          </Text>
        </Animated.View>

        {/* Info Card */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}
          style={[styles.infoCard, isDark && styles.infoCardDark]}
        >
          <BlurView intensity={isDark ? 40 : 90} style={styles.infoBlur} tint={isDark ? 'dark' : 'light'}>
            <Ionicons
              name="shield-checkmark"
              size={32}
              color={themeColors.primary}
              style={styles.infoIcon}
            />
            <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>
              Your Data, Always Yours
            </Text>
            <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
              Create encrypted JSON backups of all your baby tracking data. Share via cloud storage,
              email, or save to Files for safekeeping. Restore anytime on any device.
            </Text>
          </BlurView>
        </Animated.View>

        {/* Current Stats */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.statsRow}
        >
          <StatPill
            icon="heart-outline"
            label="Babies"
            value={stats.babies}
            color={themeColors.primary}
            isDark={isDark}
          />
          <StatPill
            icon="list-outline"
            label="Entries"
            value={stats.entries}
            color={COLORS.info}
            isDark={isDark}
          />
          <StatPill
            icon="save-outline"
            label="Est. Size"
            value={stats.size}
            color={COLORS.success}
            isDark={isDark}
          />
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)}
          style={styles.actionsSection}
        >
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
            Quick Actions
          </Text>

          <ActionCard
            icon="cloud-upload-outline"
            title="Create Backup"
            subtitle="Export all data to a shareable file"
            color={COLORS.success}
            onPress={() => handleCreateBackup(false)}
            isLoading={isCreating}
            isDark={isDark}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="lock-closed-outline"
            title="Encrypted Backup"
            subtitle="Password-protect your backup"
            color={COLORS.purple}
            onPress={promptEncryptedBackup}
            isLoading={isCreating}
            isDark={isDark}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="cloud-download-outline"
            title="Restore from File"
            subtitle="Import data from a backup file"
            color={themeColors.primary}
            onPress={handlePickBackupFile}
            isLoading={isRestoring}
            isDark={isDark}
          />
        </Animated.View>

        {/* Local Backups Section */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(500)}
          style={styles.localBackupsSection}
        >
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowLocalBackups(!showLocalBackups)}
          >
            <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
              Local Backups ({localBackups.length})
            </Text>
            <Ionicons
              name={showLocalBackups ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#888' : '#888'}
            />
          </TouchableOpacity>

          {showLocalBackups && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn}>
              {localBackups.length === 0 ? (
                <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
                  <Ionicons
                    name="folder-open-outline"
                    size={40}
                    color={isDark ? '#444' : '#ccc'}
                  />
                  <Text style={[styles.emptyStateText, isDark && styles.textSecondaryLight]}>
                    No local backups yet
                  </Text>
                  <Text style={[styles.emptyStateSubtext, isDark && styles.textSecondaryLight]}>
                    Create your first backup above
                  </Text>
                </View>
              ) : (
                <>
                  {localBackups.slice(0, 10).map((backup) => (
                    <LocalBackupItem
                      key={backup.id}
                      backup={backup}
                      onPress={() => handleLocalBackupPress(backup)}
                      onShare={() => handleShareLocalBackup(backup)}
                      onDelete={() => handleDeleteLocalBackup(backup)}
                      isDark={isDark}
                    />
                  ))}

                  {localBackups.length > 10 && (
                    <Text style={[styles.moreBackupsText, isDark && styles.textSecondaryLight]}>
                      +{localBackups.length - 10} more backups
                    </Text>
                  )}

                  <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAllBackups}>
                    <Text style={styles.clearAllText}>Clear All Local Backups</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Auto Backup Section */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(600)}
          style={styles.autoBackupSection}
        >
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
            Auto Backup
          </Text>

          <ActionCard
            icon="time-outline"
            title="Auto Backup Settings"
            subtitle={
              autoBackupSettings.enabled
                ? `${autoBackupSettings.frequency.charAt(0).toUpperCase() + autoBackupSettings.frequency.slice(1)} • Keep ${autoBackupSettings.keepCount}`
                : 'Schedule automatic backups'
            }
            color={COLORS.warning}
            onPress={() => setShowAutoBackupModal(true)}
            badge={autoBackupSettings.enabled ? 'ON' : 'OFF'}
            isDark={isDark}
          />

          <View style={{ height: 12 }} />

          <ActionCard
            icon="play-circle-outline"
            title="Backup Now"
            subtitle="Manually trigger a backup"
            color={COLORS.orange}
            onPress={handleRunBackupNow}
            isLoading={isCreating}
            isDark={isDark}
          />
        </Animated.View>

        {/* How It Works */}
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(700)}
          style={styles.howItWorks}
        >
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
            How It Works
          </Text>

          {[
            {
              icon: 'document-text',
              title: 'JSON Format',
              desc: 'Open, portable format readable by any device',
            },
            {
              icon: 'phone-portrait',
              title: 'Cross-Platform',
              desc: 'Move seamlessly between iOS and Android',
            },
            {
              icon: 'lock-closed',
              title: 'Privacy First',
              desc: 'Your data never touches our servers',
            },
            {
              icon: 'refresh-circle',
              title: 'Full Restore',
              desc: 'Everything comes back: babies, logs, milestones',
            },
          ].map((item, i) => (
            <View key={i} style={[styles.howItem, isDark && styles.howItemDark]}>
              <View
                style={[styles.howIcon, { backgroundColor: `${themeColors.primary}15` }]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={themeColors.primary}
                />
              </View>
              <View style={styles.howText}>
                <Text style={[styles.howTitle, isDark && styles.howTitleDark]}>
                  {item.title}
                </Text>
                <Text style={[styles.howDesc, isDark && styles.howDescDark]}>
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Last Backup */}
        {lastBackup && (
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(800)}
            style={styles.lastBackup}
          >
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={[styles.lastBackupText, isDark && styles.lastBackupTextDark]}>
              Last backup: {lastBackup}
            </Text>
          </Animated.View>
        )}

        {/* Note */}
        <Text style={[styles.note, isDark && styles.noteDark]}>
          💡 Tip: Back up regularly and store files in cloud storage for maximum safety.
          Encrypted backups require your password to restore — keep it safe!
        </Text>
      </Animated.ScrollView>

      {/* Restore Progress Overlay */}
      {restoreProgress && (
        <View style={styles.progressOverlay}>
          <BlurView intensity={80} style={styles.progressBlur} tint="dark">
            <View style={styles.progressContent}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.progressMessage}>{restoreProgress.message}</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${restoreProgress.progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{restoreProgress.progress}%</Text>
            </View>
          </BlurView>
        </View>
      )}

      {/* Modals */}
      <EncryptModal
        visible={showEncryptModal}
        onClose={() => setShowEncryptModal(false)}
        onConfirm={(password) => handleCreateBackup(true, password)}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
      />

      <PasswordModal
        visible={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingContent(null);
          setPendingAction(null);
          setIsPasswordLoading(false);
        }}
        onConfirm={handlePasswordConfirm}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
        title="Enter Backup Password"
        subtitle="This backup is password protected"
        isLoading={isPasswordLoading}
      />

      <AutoBackupModal
        visible={showAutoBackupModal}
        onClose={() => setShowAutoBackupModal(false)}
        onSave={handleSaveAutoBackupSettings}
        settings={autoBackupSettings}
        isDark={isDark}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
      />
    </LinearGradient>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  content: { paddingHorizontal: 20 },

  textLight: { color: '#fff' },
  textSecondaryLight: { color: '#a0a0a0' },

  header: { marginBottom: 24 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerTitleDark: { color: '#fff' },
  headerSubtitle: { fontSize: 15, color: '#666', fontWeight: '500' },
  headerSubtitleDark: { color: '#a0a0a0' },

  infoCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  infoCardDark: { borderColor: 'rgba(102,126,234,0.2)' },
  infoBlur: { padding: 24, alignItems: 'center' },
  infoIcon: { marginBottom: 12 },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoTitleDark: { color: '#fff' },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  infoTextDark: { color: '#a0a0a0' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  statPillDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  statPillValueDark: { color: '#fff' },
  statPillLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginTop: 2,
  },
  statPillLabelDark: { color: '#888' },

  actionsSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelDark: { color: '#888' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  actionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  actionTitleDark: { color: '#fff' },
  actionSubtitle: { fontSize: 13, color: '#888', fontWeight: '500' },
  actionSubtitleDark: { color: '#888' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  localBackupsSection: { marginBottom: 24 },
  localBackupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localBackupItemDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  localBackupIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  localBackupInfo: { flex: 1 },
  localBackupName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  localBackupMeta: { fontSize: 12, color: '#888', fontWeight: '500' },
  localBackupActions: { flexDirection: 'row', gap: 8 },
  localBackupAction: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },

  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  emptyStateDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  emptyStateSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#aaa',
    fontWeight: '500',
  },
  moreBackupsText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    fontWeight: '500',
  },
  clearAllButton: { alignItems: 'center', padding: 14, marginTop: 8 },
  clearAllText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },

  autoBackupSection: { marginBottom: 24 },

  howItWorks: { marginBottom: 24 },
  howItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  howItemDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  howText: { flex: 1 },
  howTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  howTitleDark: { color: '#fff' },
  howDesc: { fontSize: 13, color: '#888', fontWeight: '500' },
  howDescDark: { color: '#888' },

  lastBackup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(67,233,123,0.1)',
    borderRadius: 14,
  },
  lastBackupText: { fontSize: 14, color: '#43e97b', fontWeight: '600' },
  lastBackupTextDark: { color: '#51cf66' },

  note: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  noteDark: { color: '#666' },

  // Progress overlay
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  progressBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContent: {
    width: '80%',
    alignItems: 'center',
    padding: 32,
  },
  progressMessage: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#43e97b',
    borderRadius: 3,
  },
  progressPercent: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  modalContentDark: {
    backgroundColor: 'rgba(30,30,40,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#888' },
  modalConfirmButton: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  modalConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Settings row styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    marginBottom: 12,
  },
  settingRowDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingDesc: { fontSize: 12, color: '#888', fontWeight: '500' },
  frequencyButtons: { flexDirection: 'row', gap: 8 },
  freqButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  freqButtonText: { fontSize: 13, fontWeight: '600', color: '#888' },
  freqButtonTextActive: { color: '#fff' },
  keepCountButtons: { flexDirection: 'row', gap: 8 },
  keepButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: { fontSize: 14, fontWeight: '700', color: '#888' },
  keepButtonTextActive: { color: '#fff' },
});