// src/utils/backupService.ts
// ═══════════════════════════════════════════════════════════════════
// CANONICAL BACKUP SERVICE — Supabase-first, uniform across app
// ═══════════════════════════════════════════════════════════════════
// • Uses expo-file-system/legacy (works on SDK 54)
// • Backs up Supabase: babies, tracker_entries, family_members, app_settings
// • XOR+base64 encryption with UTF-8 safe encoding
// • Works from anywhere in the app (MoreScreen, BackupRestoreScreen, etc.)
// ═══════════════════════════════════════════════════════════════════

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';

// ─── TYPES ───────────────────────────────────────────────────────────

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  appVersion: string;
  platform: string;
  userId: string;
  babyCount: number;
  entryCount: number;
  familyMemberCount: number;
  appSettingsCount: number;
  totalSize: number;
  encrypted: boolean;
}

export interface BackupPreview {
  valid: boolean;
  metadata?: BackupMetadata;
  babies: number;
  entries: number;
  familyMembers: number;
  size: string;
  version: string;
  isEncrypted: boolean;
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
  message: string;
  stats?: {
    babies: number;
    entries: number;
    familyMembers: number;
    appSettings: number;
  };
  error?: string;
}

export interface LocalBackupInfo {
  id: string;
  name: string;
  path: string;
  sizeFormatted: string;
  dateFormatted: string;
  timestamp: number;
  isEncrypted: boolean;
}

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string;
  keepCount: number;
  includeMedia: boolean;
  encryptBackups: boolean;
  encryptionPassword?: string;
}

interface BackupData {
  _version: string;
  _timestamp: string;
  _encrypted: boolean;
  _userId: string;
  babies: any[];
  entries: Record<string, any[]>;
  familyMembers: Record<string, any[]>;
  appSettings: Record<string, string>;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────

const BACKUP_VERSION = '2.0';
const APP_VERSION = '1.0.0';
const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';
const AUTO_SETTINGS_KEY = '@littleloom_auto_backup_settings_v2';
const ENC_PREFIX = 'LL_ENC_V1:';
const SALT = 'littleloom_backup_salt_v1';

// ─── ENCRYPTION (UTF-8 SAFE) ─────────────────────────────────────────

const encryptBackupData = async (data: string, password: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + SALT
  );
  const key = hash.repeat(Math.ceil(data.length / hash.length)).slice(0, data.length);
  let out = '';
  for (let i = 0; i < data.length; i++) {
    out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i));
  }
  // UTF-8 safe base64
  return ENC_PREFIX + btoa(unescape(encodeURIComponent(out)));
};

const decryptBackupData = async (data: string, password: string): Promise<string> => {
  if (!data.startsWith(ENC_PREFIX)) throw new Error('Not encrypted');
  const b64 = data.slice(ENC_PREFIX.length);
  const enc = decodeURIComponent(escape(atob(b64)));
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + SALT
  );
  const key = hash.repeat(Math.ceil(enc.length / hash.length)).slice(0, enc.length);
  let out = '';
  for (let i = 0; i < enc.length; i++) {
    out += String.fromCharCode(enc.charCodeAt(i) ^ key.charCodeAt(i));
  }
  return out;
};

// ─── HELPERS ─────────────────────────────────────────────────────────

const ensureDir = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// ─── SERVICE ─────────────────────────────────────────────────────────

class BackupService {
  private userId: string | null = null;

  setUserId(id: string | null): void {
    this.userId = id;
  }

  getUserId(): string | null {
    return this.userId;
  }

  // ─── STATS ─────────────────────────────────────────────────────────

  async getCurrentStats(userId?: string) {
    const uid = userId || this.userId;
    if (!uid) return { keys: 0, size: '0 B', babies: 0, entries: 0 };

    try {
      // Babies the user owns or co-parents
      const { data: owned } = await supabase
        .from('babies')
        .select('id')
        .or(`parent1_id.eq.${uid},parent2_id.eq.${uid}`)
        .eq('is_active', true);

      // Babies via family_members
      const { data: memberships } = await supabase
        .from('family_members')
        .select('baby_id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .is('deleted_at', null);

      const babyIds = new Set<string>();
      (owned ?? []).forEach(b => babyIds.add(b.id));
      (memberships ?? []).forEach(m => m.baby_id && babyIds.add(m.baby_id));

      const ids = Array.from(babyIds);

      let entries = 0;
      let familyMembers = 0;

      if (ids.length > 0) {
        const [entriesCount, fmCount] = await Promise.all([
          supabase
            .from('tracker_entries')
            .select('*', { count: 'exact', head: true })
            .in('baby_id', ids)
            .eq('is_deleted', false),
          supabase
            .from('family_members')
            .select('*', { count: 'exact', head: true })
            .in('baby_id', ids)
            .is('deleted_at', null),
        ]);
        entries = entriesCount.count ?? 0;
        familyMembers = fmCount.count ?? 0;
      }

      const sizeKB = ids.length * 2 + entries * 0.5 + familyMembers * 0.3;
      const size = sizeKB < 1024
        ? `${sizeKB.toFixed(1)} KB`
        : `${(sizeKB / 1024).toFixed(2)} MB`;

      return {
        keys: ids.length + entries + familyMembers,
        size,
        babies: ids.length,
        entries,
      };
    } catch (err) {
      console.warn('[BackupService] getCurrentStats failed:', err);
      return { keys: 0, size: '0 B', babies: 0, entries: 0 };
    }
  }

  // ─── CREATE ────────────────────────────────────────────────────────

  async createBackup(
    userId?: string,
    opts: { encrypted?: boolean; password?: string } = {}
  ): Promise<BackupResult> {
    const uid = userId || this.userId;
    if (!uid) return { success: false, error: 'No user ID — sign in first' };

    try {
      await ensureDir();

      // ── 1. Fetch babies (owned + shared) ────────────────────────
      const { data: owned } = await supabase
        .from('babies')
        .select('*')
        .or(`parent1_id.eq.${uid},parent2_id.eq.${uid}`)
        .eq('is_active', true);

      const { data: memberships } = await supabase
        .from('family_members')
        .select('baby_id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .is('deleted_at', null);

      const babyIds = new Set<string>();
      (owned ?? []).forEach(b => babyIds.add(b.id));
      (memberships ?? []).forEach(m => m.baby_id && babyIds.add(m.baby_id));
      const ids = Array.from(babyIds);

      let babies: any[] = owned ?? [];
      const entriesMap: Record<string, any[]> = {};
      const familyMembersMap: Record<string, any[]> = {};
      const appSettings: Record<string, string> = {};

      if (ids.length > 0) {
        // Shared babies not already in `owned`
        const ownedIds = new Set(babies.map(b => b.id));
        const missingIds = ids.filter(id => !ownedIds.has(id));
        if (missingIds.length > 0) {
          const { data: sharedBabies } = await supabase
            .from('babies')
            .select('*')
            .in('id', missingIds)
            .eq('is_active', true);
          babies = [...babies, ...(sharedBabies ?? [])];
        }

        const [entries, familyMembers] = await Promise.all([
          supabase
            .from('tracker_entries')
            .select('*')
            .in('baby_id', ids)
            .eq('is_deleted', false),
          supabase
            .from('family_members')
            .select('*')
            .in('baby_id', ids)
            .is('deleted_at', null),
        ]);

        (entries.data ?? []).forEach(row => {
          (entriesMap[row.baby_id] ||= []).push(row);
        });
        (familyMembers.data ?? []).forEach(row => {
          (familyMembersMap[row.baby_id] ||= []).push(row);
        });
      }

      // ── 2. App settings ─────────────────────────────────────────
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key,value')
        .eq('user_id', uid);
      (settings ?? []).forEach(s => { appSettings[s.key] = s.value; });

      // ── 3. Build payload ────────────────────────────────────────
      const data: BackupData = {
        _version: BACKUP_VERSION,
        _timestamp: new Date().toISOString(),
        _encrypted: opts.encrypted === true,
        _userId: uid,
        babies,
        entries: entriesMap,
        familyMembers: familyMembersMap,
        appSettings,
      };

      let json = JSON.stringify(data, null, 2);

      if (opts.encrypted && opts.password) {
        json = await encryptBackupData(json, opts.password);
      }

      // ── 4. Write file ───────────────────────────────────────────
      const date = new Date().toISOString().split('T')[0];
      const ts = Date.now();
      const name = `backup_${date}_${ts}${opts.encrypted ? '_encrypted' : ''}.json`;
      const path = BACKUP_DIR + name;

      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const totalEntries = Object.values(entriesMap).reduce((s, a) => s + a.length, 0);
      const totalFamily = Object.values(familyMembersMap).reduce((s, a) => s + a.length, 0);

      const metadata: BackupMetadata = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        platform: Platform.OS,
        userId: uid,
        babyCount: babies.length,
        entryCount: totalEntries,
        familyMemberCount: totalFamily,
        appSettingsCount: Object.keys(appSettings).length,
        totalSize: json.length,
        encrypted: opts.encrypted === true,
      };

      return { success: true, filePath: path, metadata };
    } catch (err) {
      console.error('[BackupService] createBackup error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Backup failed',
      };
    }
  }

  // ─── PREVIEW ───────────────────────────────────────────────────────

  isEncrypted(content: string): boolean {
    return content.startsWith(ENC_PREFIX);
  }

  async previewBackup(content: string, password?: string): Promise<BackupPreview> {
    const empty: BackupPreview = {
      valid: false,
      babies: 0,
      entries: 0,
      familyMembers: 0,
      size: '0 B',
      version: 'unknown',
      isEncrypted: false,
      warnings: [],
    };

    try {
      let data = content;
      const encrypted = this.isEncrypted(content);

      if (encrypted) {
        if (!password) return { ...empty, isEncrypted: true, error: 'Password required' };
        data = await decryptBackupData(content, password);
      }

      const parsed: BackupData = JSON.parse(data);
      if (!parsed._version || !Array.isArray(parsed.babies)) {
        return { ...empty, isEncrypted: encrypted, error: 'Invalid backup format' };
      }

      let entries = 0;
      let familyMembers = 0;
      Object.values(parsed.entries ?? {}).forEach(arr => {
        if (Array.isArray(arr)) entries += arr.length;
      });
      Object.values(parsed.familyMembers ?? {}).forEach(arr => {
        if (Array.isArray(arr)) familyMembers += arr.length;
      });

      return {
        valid: true,
        metadata: {
          version: parsed._version,
          exportedAt: parsed._timestamp,
          appVersion: APP_VERSION,
          platform: Platform.OS,
          userId: parsed._userId,
          babyCount: parsed.babies.length,
          entryCount: entries,
          familyMemberCount: familyMembers,
          appSettingsCount: Object.keys(parsed.appSettings ?? {}).length,
          totalSize: content.length,
          encrypted,
        },
        babies: parsed.babies.length,
        entries,
        familyMembers,
        size: formatBytes(content.length),
        version: parsed._version,
        isEncrypted: encrypted,
        warnings: [],
      };
    } catch (err) {
      return {
        ...empty,
        error: err instanceof Error ? err.message : 'Preview failed',
      };
    }
  }

  // ─── RESTORE ───────────────────────────────────────────────────────

  async restoreBackup(
    content: string,
    userId?: string,
    password?: string,
    onProgress?: (message: string, progress: number) => void
  ): Promise<RestoreResult> {
    const uid = userId || this.userId;
    if (!uid) return { success: false, message: 'No user ID — sign in first' };

    try {
      let data = content;
      if (this.isEncrypted(content)) {
        if (!password) return { success: false, message: 'Password required' };
        onProgress?.('Decrypting...', 5);
        data = await decryptBackupData(content, password);
      }

      onProgress?.('Parsing...', 10);
      const parsed: BackupData = JSON.parse(data);
      if (!parsed._version || !Array.isArray(parsed.babies)) {
        return { success: false, message: 'Invalid backup format' };
      }

      const stats = { babies: 0, entries: 0, familyMembers: 0, appSettings: 0 };

      // ── 1. Babies ────────────────────────────────────────────────
      onProgress?.('Restoring babies...', 20);
      for (const baby of parsed.babies) {
        try {
          const { data: existing } = await supabase
            .from('babies')
            .select('id')
            .eq('id', baby.id)
            .maybeSingle();

          if (existing) {
            await supabase
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
          } else {
            const p1 = baby.parent1_id === parsed._userId ? uid : baby.parent1_id;
            const p2 = baby.parent2_id === parsed._userId ? uid : baby.parent2_id;
            await supabase.from('babies').insert({
              ...baby,
              parent1_id: p1,
              parent2_id: p2,
              created_at: baby.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          stats.babies++;
        } catch (err) {
          console.warn('[BackupService] Baby restore skipped:', err);
        }
      }

      // ── 2. Entries ───────────────────────────────────────────────
      onProgress?.('Restoring entries...', 40);
      const allEntries: any[] = [];
      Object.values(parsed.entries ?? {}).forEach(arr => {
        if (Array.isArray(arr)) allEntries.push(...arr);
      });

      const CHUNK = 50;
      for (let i = 0; i < allEntries.length; i += CHUNK) {
        const chunk = allEntries.slice(i, i + CHUNK);
        const pct = 40 + Math.round((i / Math.max(allEntries.length, 1)) * 40);
        onProgress?.(`Entries ${Math.min(i + CHUNK, allEntries.length)}/${allEntries.length}`, pct);

        for (const e of chunk) {
          try {
            const { data: existing } = await supabase
              .from('tracker_entries')
              .select('id')
              .eq('id', e.id)
              .maybeSingle();

            const lb = e.logged_by === parsed._userId ? uid : e.logged_by;
            const cb = e.created_by === parsed._userId ? uid : e.created_by;

            if (existing) {
              await supabase
                .from('tracker_entries')
                .update({
                  timestamp: e.timestamp,
                  title: e.title,
                  data: e.data,
                  notes: e.notes,
                  photo_uris: e.photo_uris,
                  tags: e.tags,
                  logged_by: lb,
                  logged_by_name: e.logged_by_name,
                  logged_by_role: e.logged_by_role,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', e.id);
            } else {
              await supabase.from('tracker_entries').insert({
                ...e,
                logged_by: lb,
                created_by: cb,
                created_at: e.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            stats.entries++;
          } catch (err) {
            console.warn('[BackupService] Entry restore skipped:', err);
          }
        }
      }

      // ── 3. Family members ────────────────────────────────────────
      onProgress?.('Restoring family members...', 85);
      const allFm: any[] = [];
      Object.values(parsed.familyMembers ?? {}).forEach(arr => {
        if (Array.isArray(arr)) allFm.push(...arr);
      });

      for (const m of allFm) {
        try {
          const { data: existing } = await supabase
            .from('family_members')
            .select('id')
            .eq('id', m.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from('family_members').insert({
              ...m,
              added_at: m.added_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            stats.familyMembers++;
          }
        } catch (err) {
          console.warn('[BackupService] Family member restore skipped:', err);
        }
      }

      // ── 4. App settings ──────────────────────────────────────────
      onProgress?.('Restoring settings...', 95);
      for (const [key, value] of Object.entries(parsed.appSettings ?? {})) {
        if (key === 'auto_backup_settings' || key === 'auto_backup_settings_v2') continue;
        try {
          await supabase.from('app_settings').upsert(
            {
              key,
              value,
              user_id: uid,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key,user_id' }
          );
          stats.appSettings++;
        } catch (err) {
          console.warn('[BackupService] Setting restore skipped:', key);
        }
      }

      onProgress?.('Done!', 100);

      return {
        success: true,
        message: `Restored ${stats.babies} babies, ${stats.entries} entries, ${stats.familyMembers} family members, ${stats.appSettings} settings.`,
        stats,
      };
    } catch (err) {
      console.error('[BackupService] restoreBackup error:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Restore failed',
      };
    }
  }

  // ─── FILE OPS ──────────────────────────────────────────────────────

  async listLocalBackups(): Promise<LocalBackupInfo[]> {
    try {
      await ensureDir();
      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const out: LocalBackupInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const path = BACKUP_DIR + file;
          const info = await FileSystem.getInfoAsync(path);
          if (!info.exists || !('size' in info)) continue;

          const enc = file.includes('_encrypted');
          const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
          const tsMatch = file.match(/_(\d+)\.json/);
          const size = info.size ?? 0;

          out.push({
            id: file,
            name: file.replace('.json', '').replace('_encrypted', ''),
            path,
            sizeFormatted: formatBytes(size),
            dateFormatted: dateMatch ? dateMatch[1] : 'Unknown',
            timestamp: tsMatch ? parseInt(tsMatch[1], 10) : 0,
            isEncrypted: enc,
          });
        } catch {
          // skip bad file
        }
      }

      return out.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  async readLocalBackup(path: string): Promise<string | null> {
    try {
      return await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      return null;
    }
  }

  async deleteBackupFile(path: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
      return true;
    } catch {
      return false;
    }
  }

  async shareBackup(path: string): Promise<boolean> {
    try {
      if (!(await Sharing.isAvailableAsync())) return false;
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Share LittleLoom Backup',
        UTI: 'public.json',
      });
      return true;
    } catch {
      return false;
    }
  }

  async pickBackupFile(): Promise<{ content: string; fileName: string } | null> {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (r.canceled || !r.assets?.[0]) return null;
      const a = r.assets[0];
      const content = await FileSystem.readAsStringAsync(a.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { content, fileName: a.name || 'backup.json' };
    } catch {
      return null;
    }
  }

  // ─── AUTO BACKUP SETTINGS ──────────────────────────────────────────

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
      if (this.userId) {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'auto_backup_settings_v2')
          .eq('user_id', this.userId)
          .maybeSingle();
        if (data?.value) return { ...defaults, ...JSON.parse(data.value) };
      }
      const stored = await AsyncStorage.getItem(AUTO_SETTINGS_KEY);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch {
      // fall through
    }
    return defaults;
  }

  async saveAutoBackupSettings(settings: AutoBackupSettings, userId?: string): Promise<void> {
    const uid = userId || this.userId;
    await AsyncStorage.setItem(AUTO_SETTINGS_KEY, JSON.stringify(settings));
    if (uid) {
      try {
        await supabase.from('app_settings').upsert(
          {
            key: 'auto_backup_settings_v2',
            value: JSON.stringify(settings),
            user_id: uid,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        );
      } catch (err) {
        console.warn('[BackupService] saveAutoBackupSettings supabase failed:', err);
      }
    }
  }

  async cleanupOldBackups(keep: number): Promise<void> {
    try {
      const backups = await this.listLocalBackups();
      if (backups.length <= keep) return;
      for (const b of backups.slice(keep)) {
        await this.deleteBackupFile(b.path);
      }
    } catch {
      // noop
    }
  }
}

// ─── SINGLETON EXPORT ────────────────────────────────────────────────

export const backupService = new BackupService();

// ─── BACKWARDS-COMPAT WRAPPER (used by MoreScreen) ───────────────────

/**
 * Convenience function so `MoreScreen.tsx` can call:
 *   import { createBackup } from '../../utils/backupService';
 *   await createBackup({ encrypted: false, includePhotos: true });
 */
export async function createBackup(opts: {
  encrypted?: boolean;
  includePhotos?: boolean;
} = {}): Promise<BackupResult> {
  // Resolve user from Supabase directly (avoids circular AuthContext import)
  let uid: string | null = backupService.getUserId();
  if (!uid) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id ?? null;
      if (uid) backupService.setUserId(uid);
    } catch {
      // ignore
    }
  }

  if (!uid) {
    return { success: false, error: 'Not authenticated' };
  }

  // `includePhotos` is currently a no-op (we don't back up binary media yet)
  return backupService.createBackup(uid, {
    encrypted: opts.encrypted === true,
  });
}

export default backupService;