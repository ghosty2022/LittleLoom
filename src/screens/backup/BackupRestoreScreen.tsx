// src/screens/backup/BackupRestoreScreen.tsx
// FIXED: hoisted components, legacy filesystem, no frozen-value writes

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// ─── FIX #1: legacy filesystem ────────────────────────────────────────
import * as FileSystem from 'expo-file-system/legacy';
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

const COLORS = {
  success: '#43e97b',
  warning: '#fee140',
  danger: '#ff4757',
  info: '#4facfe',
  purple: '#9b59b6',
  orange: '#e67e22',
};

// ─── Types ────────────────────────────────────────────────────────────
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
  id: string; name: string; path: string; dateFormatted: string;
  sizeFormatted: string; isEncrypted: boolean; timestamp: number;
}
interface BackupPreview {
  valid: boolean; babies?: number; logs?: number; milestones?: number;
  familyMembers?: number; date?: string; version?: string; isEncrypted?: boolean;
}
interface BackupResult { success: boolean; filePath?: string; error?: string; }
interface PickedBackup { content: string; fileName: string; }
interface BackupData {
  _version: string; _timestamp: string; _encrypted: boolean; _userId?: string;
  babies: any[]; entries: Record<string, any[]>;
  familyMembers: Record<string, any[]>; appSettings: Record<string, string>;
}

// ─── Encryption ───────────────────────────────────────────────────────
const ENC_PREFIX = 'LL_ENC_V1:';
const SALT = 'littleloom_backup_salt_v1';

const encryptBackupData = async (data: string, password: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password + SALT);
  const key = hash.repeat(Math.ceil(data.length / hash.length)).slice(0, data.length);
  let out = '';
  for (let i = 0; i < data.length; i++) {
    out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i));
  }
  return ENC_PREFIX + btoa(unescape(encodeURIComponent(out)));
};

const decryptBackupData = async (data: string, password: string): Promise<string> => {
  if (!data.startsWith(ENC_PREFIX)) throw new Error('Not encrypted');
  const b64 = data.slice(ENC_PREFIX.length);
  const enc = decodeURIComponent(escape(atob(b64)));
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password + SALT);
  const key = hash.repeat(Math.ceil(enc.length / hash.length)).slice(0, enc.length);
  let out = '';
  for (let i = 0; i < enc.length; i++) {
    out += String.fromCharCode(enc.charCodeAt(i) ^ key.charCodeAt(i));
  }
  return out;
};

// ─── Service ──────────────────────────────────────────────────────────
const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';
const AUTO_SETTINGS_KEY = '@littleloom_auto_backup_settings';

class BackupService {
  private userId: string | null = null;
  setUserId(id: string) { this.userId = id; }

  private async ensureDir(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
      }
    } catch { /* noop */ }
  }

  async getCurrentStats(userId: string) {
    try {
      const { data: babies } = await supabase
        .from('babies').select('id')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
        .eq('is_active', true);
      const babyIds = (babies ?? []).map(b => b.id);
      let entries = 0;
      if (babyIds.length > 0) {
        const { count } = await supabase
          .from('tracker_entries')
          .select('*', { count: 'exact', head: true })
          .in('baby_id', babyIds)
          .eq('is_deleted', false);
        entries = count ?? 0;
      }
      const sizeKB = (babyIds.length * 2 + entries * 0.5) / 1024;
      const size = sizeKB < 1024 ? `${sizeKB.toFixed(1)} KB` : `${(sizeKB / 1024).toFixed(1)} MB`;
      return { keys: babyIds.length + entries, size, babies: babyIds.length, entries };
    } catch {
      return { keys: 0, size: '0 B', babies: 0, entries: 0 };
    }
  }

  async listLocalBackups(): Promise<LocalBackupInfo[]> {
    try {
      await this.ensureDir();
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
          const sizeKB = Math.round((info.size ?? 0) / 1024);
          out.push({
            id: file,
            name: file.replace('.json', '').replace('_encrypted', ''),
            path,
            dateFormatted: dateMatch ? dateMatch[1] : 'Unknown',
            sizeFormatted: sizeKB < 1024 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(1)} MB`,
            isEncrypted: enc,
            timestamp: tsMatch ? parseInt(tsMatch[1]) : 0,
          });
        } catch { /* skip bad file */ }
      }
      return out.sort((a, b) => b.timestamp - a.timestamp);
    } catch { return []; }
  }

  async getAutoBackupSettings(): Promise<AutoBackupSettings> {
    const defaults: AutoBackupSettings = {
      enabled: false, frequency: 'weekly', timeOfDay: '02:00',
      keepCount: 5, includeMedia: false, encryptBackups: false,
    };
    try {
      if (this.userId) {
        const { data } = await supabase
          .from('app_settings').select('value')
          .eq('key', 'auto_backup_settings')
          .eq('user_id', this.userId).maybeSingle();
        if (data?.value) return { ...defaults, ...JSON.parse(data.value) };
      }
      const stored = await AsyncStorage.getItem(AUTO_SETTINGS_KEY);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch { /* noop */ }
    return defaults;
  }

  async saveAutoBackupSettings(s: AutoBackupSettings, userId: string): Promise<void> {
    await AsyncStorage.setItem(AUTO_SETTINGS_KEY, JSON.stringify(s));
    await supabase.from('app_settings').upsert(
      { key: 'auto_backup_settings', value: JSON.stringify(s), user_id: userId,
        updated_at: new Date().toISOString() },
      { onConflict: 'key,user_id' },
    );
  }

  async createBackup(userId: string, opts: { encrypted: boolean; password?: string }): Promise<BackupResult> {
    try {
      const { data: owned } = await supabase.from('babies').select('*')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`).eq('is_active', true);
      const { data: memberships } = await supabase.from('family_members')
        .select('baby_id').eq('user_id', userId).eq('status', 'active').is('deleted_at', null);

      const babyIds = new Set<string>((owned ?? []).map(b => b.id));
      const shared = (memberships ?? []).map(m => m.baby_id).filter(Boolean);
      if (shared.length > 0) {
        const { data: sharedBabies } = await supabase.from('babies').select('*')
          .in('id', shared).eq('is_active', true);
        (sharedBabies ?? []).forEach(b => babyIds.add(b.id));
      }
      const ids = Array.from(babyIds);

      let babies: any[] = [];
      const entriesMap: Record<string, any[]> = {};
      const familyMembersMap: Record<string, any[]> = {};
      const appSettings: Record<string, string> = {};

      if (ids.length > 0) {
        const [b, e, fm] = await Promise.all([
          supabase.from('babies').select('*').in('id', ids),
          supabase.from('tracker_entries').select('*').in('baby_id', ids).eq('is_deleted', false),
          supabase.from('family_members').select('*').in('baby_id', ids).is('deleted_at', null),
        ]);
        babies = b.data ?? [];
        (e.data ?? []).forEach(row => {
          (entriesMap[row.baby_id] ||= []).push(row);
        });
        (fm.data ?? []).forEach(row => {
          (familyMembersMap[row.baby_id] ||= []).push(row);
        });
      }

      const { data: settings } = await supabase.from('app_settings')
        .select('key,value').eq('user_id', userId);
      (settings ?? []).forEach(s => { appSettings[s.key] = s.value; });

      const data: BackupData = {
        _version: '2.0', _timestamp: new Date().toISOString(),
        _encrypted: opts.encrypted, _userId: userId,
        babies, entries: entriesMap, familyMembers: familyMembersMap, appSettings,
      };
      let json = JSON.stringify(data, null, 2);
      if (opts.encrypted && opts.password) json = await encryptBackupData(json, opts.password);

      await this.ensureDir();
      const date = new Date().toISOString().split('T')[0];
      const ts = Date.now();
      const name = `backup_${date}_${ts}${opts.encrypted ? '_encrypted' : ''}.json`;
      const path = BACKUP_DIR + name;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      return { success: true, filePath: path };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async shareBackup(path: string): Promise<boolean> {
    try {
      if (!(await Sharing.isAvailableAsync())) return false;
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Share Backup', UTI: 'public.json' });
      return true;
    } catch { return false; }
  }

  async deleteBackupFile(path: string): Promise<boolean> {
    try { await FileSystem.deleteAsync(path, { idempotent: true }); return true; }
    catch { return false; }
  }

  async readLocalBackup(path: string): Promise<string | null> {
    try { return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 }); }
    catch { return null; }
  }

  async pickBackupFile(): Promise<PickedBackup | null> {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true, multiple: false,
      });
      if (r.canceled || !r.assets?.[0]) return null;
      const a = r.assets[0];
      const content = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.UTF8 });
      return { content, fileName: a.name || 'backup.json' };
    } catch { return null; }
  }

  isEncrypted(content: string) { return content.startsWith(ENC_PREFIX); }

  async previewBackup(content: string, password?: string): Promise<BackupPreview> {
    try {
      let data = content;
      if (this.isEncrypted(content)) {
        if (!password) return { valid: false, isEncrypted: true };
        data = await decryptBackupData(content, password);
      }
      const parsed: BackupData = JSON.parse(data);
      if (!parsed._version || !Array.isArray(parsed.babies)) return { valid: false };
      let logs = 0, fmCount = 0, milestones = 0;
      Object.values(parsed.entries ?? {}).forEach(arr => {
        if (!Array.isArray(arr)) return;
        logs += arr.length;
        milestones += arr.filter(x => x.tracker_type === 'milestone').length;
      });
      Object.values(parsed.familyMembers ?? {}).forEach(arr => {
        if (Array.isArray(arr)) fmCount += arr.length;
      });
      return {
        valid: true, babies: parsed.babies.length, logs, milestones,
        familyMembers: fmCount, date: parsed._timestamp,
        version: parsed._version, isEncrypted: parsed._encrypted,
      };
    } catch { return { valid: false }; }
  }

  async restoreBackup(
    content: string, userId: string, password?: string,
    onProgress?: (m: string, p: number) => void,
  ): Promise<{ success: boolean; message: string; stats?: { babies: number; entries: number; familyMembers: number } }> {
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
      const stats = { babies: 0, entries: 0, familyMembers: 0 };

      onProgress?.('Restoring babies...', 20);
      for (const baby of parsed.babies) {
        try {
          const { data: existing } = await supabase.from('babies').select('id').eq('id', baby.id).maybeSingle();
          if (existing) {
            await supabase.from('babies').update({
              name: baby.name, avatar: baby.avatar, date_of_birth: baby.date_of_birth,
              gender: baby.gender, blood_type: baby.blood_type, medical_notes: baby.medical_notes,
              allergies: baby.allergies, current_weight_kg: baby.current_weight_kg,
              current_height_cm: baby.current_height_cm, skin_tone: baby.skin_tone,
              updated_at: new Date().toISOString(),
            }).eq('id', baby.id);
          } else {
            const p1 = baby.parent1_id === parsed._userId ? userId : baby.parent1_id;
            const p2 = baby.parent2_id === parsed._userId ? userId : baby.parent2_id;
            await supabase.from('babies').insert({
              ...baby, parent1_id: p1, parent2_id: p2,
              created_at: baby.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          stats.babies++;
        } catch { /* skip */ }
      }

      onProgress?.('Restoring entries...', 40);
      const allEntries: any[] = [];
      Object.values(parsed.entries ?? {}).forEach(arr => {
        if (Array.isArray(arr)) allEntries.push(...arr);
      });
      const CHUNK = 50;
      for (let i = 0; i < allEntries.length; i += CHUNK) {
        const chunk = allEntries.slice(i, i + CHUNK);
        onProgress?.(`Entries ${i + 1}/${allEntries.length}`, 40 + Math.round((i / allEntries.length) * 40));
        for (const e of chunk) {
          try {
            const { data: existing } = await supabase.from('tracker_entries').select('id').eq('id', e.id).maybeSingle();
            const lb = e.logged_by === parsed._userId ? userId : e.logged_by;
            const cb = e.created_by === parsed._userId ? userId : e.created_by;
            if (existing) {
              await supabase.from('tracker_entries').update({
                timestamp: e.timestamp, title: e.title, data: e.data,
                notes: e.notes, photo_uris: e.photo_uris, tags: e.tags,
                logged_by: lb, logged_by_name: e.logged_by_name,
                logged_by_role: e.logged_by_role, updated_at: new Date().toISOString(),
              }).eq('id', e.id);
            } else {
              await supabase.from('tracker_entries').insert({
                ...e, logged_by: lb, created_by: cb,
                created_at: e.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            stats.entries++;
          } catch { /* skip */ }
        }
      }

      onProgress?.('Restoring family members...', 85);
      const allFm: any[] = [];
      Object.values(parsed.familyMembers ?? {}).forEach(arr => {
        if (Array.isArray(arr)) allFm.push(...arr);
      });
      for (const m of allFm) {
        try {
          const { data: existing } = await supabase.from('family_members').select('id').eq('id', m.id).maybeSingle();
          if (!existing) {
            await supabase.from('family_members').insert({
              ...m, added_at: m.added_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            stats.familyMembers++;
          }
        } catch { /* skip */ }
      }

      onProgress?.('Settings...', 95);
      for (const [k, v] of Object.entries(parsed.appSettings ?? {})) {
        if (k === 'auto_backup_settings') continue;
        try {
          await supabase.from('app_settings').upsert({
            key: k, value: v, user_id: userId, updated_at: new Date().toISOString(),
          }, { onConflict: 'key,user_id' });
        } catch { /* skip */ }
      }

      onProgress?.('Done!', 100);
      return {
        success: true,
        message: `Restored ${stats.babies} babies, ${stats.entries} entries, ${stats.familyMembers} family members.`,
        stats,
      };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Restore failed' };
    }
  }

  async cleanupOldBackups(keep: number): Promise<void> {
    try {
      const backups = await this.listLocalBackups();
      if (backups.length <= keep) return;
      for (const b of backups.slice(keep)) await this.deleteBackupFile(b.path);
    } catch { /* noop */ }
  }
}

const backupService = new BackupService();

// ═══════════════════════════════════════════════════════════════════════
// FIX #2: Hoisted components (no longer defined inside render)
// ═══════════════════════════════════════════════════════════════════════

interface StatPillProps {
  icon: string; label: string; value: string | number; color: string; isDark: boolean;
}

const StatPill: React.FC<StatPillProps> = React.memo(({ icon, label, value, color, isDark }) => (
  <View style={[styles.statPill, isDark && styles.statPillDark]}>
    <View style={[styles.statPillIcon, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={[styles.statPillValue, isDark && styles.statPillValueDark]}>{value}</Text>
    <Text style={[styles.statPillLabel, isDark && styles.statPillLabelDark]}>{label}</Text>
  </View>
));

interface ActionCardProps {
  icon: string; title: string; subtitle: string; color: string;
  onPress: () => void; isLoading?: boolean; disabled?: boolean;
  badge?: string; isDark: boolean;
}

const ActionCard: React.FC<ActionCardProps> = React.memo(({
  icon, title, subtitle, color, onPress, isLoading, disabled, badge, isDark,
}) => (
  <TouchableOpacity
    style={[styles.actionCard, isDark && styles.actionCardDark]}
    onPress={onPress}
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
        {isLoading
          ? <ActivityIndicator color={color} />
          : <Ionicons name={icon as any} size={28} color={color} />}
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
));

interface LocalBackupItemProps {
  backup: LocalBackupInfo; onPress: () => void; onShare: () => void;
  onDelete: () => void; isDark: boolean;
}

const LocalBackupItem: React.FC<LocalBackupItemProps> = React.memo(({
  backup, onPress, onShare, onDelete, isDark,
}) => (
  <TouchableOpacity
    style={[styles.localBackupItem, isDark && styles.localBackupItemDark]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.localBackupIcon, {
      backgroundColor: backup.isEncrypted ? `${COLORS.purple}20` : `${COLORS.success}20`,
    }]}>
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
      <TouchableOpacity style={styles.localBackupAction} onPress={onShare}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="share-outline" size={20} color={isDark ? '#888' : '#666'} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.localBackupAction} onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
));

// ─── Modals (also hoisted) ────────────────────────────────────────────

const EncryptModal: React.FC<{
  visible: boolean; onClose: () => void; onConfirm: (pw: string) => void;
  isDark: boolean; primaryColor: string; secondaryColor: string;
}> = ({ visible, onClose, onConfirm, isDark, primaryColor, secondaryColor }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const sweet = useSweetAlert();

  const handle = () => {
    if (pw.length < 6) { sweet.alert('Too Short', 'Password must be 6+ characters', 'warning'); return; }
    if (pw !== confirm) { sweet.alert('Mismatch', 'Passwords do not match', 'warning'); return; }
    onConfirm(pw);
    setPw(''); setConfirm(''); onClose();
  };
  const close = () => { setPw(''); setConfirm(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
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
                value={pw} onChangeText={setPw} secureTextEntry={!show}
                autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShow(!show)}>
                <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textLight]}
                placeholder="Confirm Password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                value={confirm} onChangeText={setConfirm} secureTextEntry={!show}
                autoCapitalize="none" autoCorrect={false}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={close}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handle}>
                <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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

const PasswordModal: React.FC<{
  visible: boolean; onClose: () => void; onConfirm: (pw: string) => void;
  isDark: boolean; primaryColor: string; secondaryColor: string;
  title?: string; subtitle?: string; isLoading?: boolean;
}> = ({ visible, onClose, onConfirm, isDark, primaryColor, secondaryColor, title, subtitle, isLoading }) => {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const sweet = useSweetAlert();

  const handle = () => {
    if (!pw) { sweet.alert('Required', 'Enter the backup password', 'warning'); return; }
    onConfirm(pw);
  };
  const close = () => { setPw(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 60 : 90} style={styles.modalBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={32} color={primaryColor} />
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>{title || 'Enter Password'}</Text>
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
                value={pw} onChangeText={setPw} secureTextEntry={!show}
                autoCapitalize="none" autoCorrect={false}
                onSubmitEditing={handle} editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShow(!show)}>
                <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={close} disabled={isLoading}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handle} disabled={isLoading}>
                <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {isLoading ? <ActivityIndicator color="#fff" size="small" /> : (
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

const AutoBackupModal: React.FC<{
  visible: boolean; onClose: () => void; onSave: (s: AutoBackupSettings) => void;
  settings: AutoBackupSettings; isDark: boolean;
  primaryColor: string; secondaryColor: string;
}> = ({ visible, onClose, onSave, settings, isDark, primaryColor, secondaryColor }) => {
  const [local, setLocal] = useState(settings);
  const [show, setShow] = useState(false);
  const sweet = useSweetAlert();

  useEffect(() => { if (visible) setLocal(settings); }, [visible, settings]);

  const handle = () => {
    if (local.enabled && local.encryptBackups) {
      if (!local.encryptionPassword || local.encryptionPassword.length < 6) {
        sweet.alert('Password Required', 'Set a 6+ char password', 'warning');
        return;
      }
    }
    onSave(local);
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

              <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, isDark && styles.textLight]}>Enable Auto Backup</Text>
                  <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                    Automatically backup your data
                  </Text>
                </View>
                <Switch value={local.enabled} onValueChange={v => setLocal({ ...local, enabled: v })}
                  trackColor={{ false: '#767577', true: primaryColor }}
                  thumbColor={local.enabled ? '#fff' : '#f4f3f4'} />
              </View>

              {local.enabled && (
                <>
                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Frequency</Text>
                    <View style={styles.frequencyButtons}>
                      {(['daily', 'weekly', 'monthly'] as const).map(f => (
                        <TouchableOpacity key={f}
                          style={[styles.freqButton, local.frequency === f && { backgroundColor: primaryColor }]}
                          onPress={() => setLocal({ ...local, frequency: f })}>
                          <Text style={[styles.freqButtonText, local.frequency === f && styles.freqButtonTextActive]}>
                            {f[0].toUpperCase() + f.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <Text style={[styles.settingLabel, isDark && styles.textLight]}>Keep Backups</Text>
                    <View style={styles.keepCountButtons}>
                      {[3, 5, 10, 20].map(c => (
                        <TouchableOpacity key={c}
                          style={[styles.keepButton, local.keepCount === c && { backgroundColor: primaryColor }]}
                          onPress={() => setLocal({ ...local, keepCount: c })}>
                          <Text style={[styles.keepButtonText, local.keepCount === c && styles.keepButtonTextActive]}>
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, isDark && styles.textLight]}>Encrypt Backups</Text>
                      <Text style={[styles.settingDesc, isDark && styles.textSecondaryLight]}>
                        Password-protect your backups
                      </Text>
                    </View>
                    <Switch value={local.encryptBackups}
                      onValueChange={v => setLocal({ ...local, encryptBackups: v })}
                      trackColor={{ false: '#767577', true: primaryColor }}
                      thumbColor={local.encryptBackups ? '#fff' : '#f4f3f4'} />
                  </View>

                  {local.encryptBackups && (
                    <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                      <Ionicons name="key-outline" size={20} color={primaryColor} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, isDark && styles.textLight]}
                        placeholder="Backup Password"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                        value={local.encryptionPassword ?? ''}
                        onChangeText={v => setLocal({ ...local, encryptionPassword: v })}
                        secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setShow(!show)}>
                        <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={primaryColor} />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmButton} onPress={handle}>
                  <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.modalConfirmGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════

export default function BackupRestoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();
  const { userProfile } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  // ─── Stable userId ref (avoids stale closure on the service) ─────
  const userIdRef = useRef<string>('');
  useEffect(() => {
    if (userProfile?.id && userProfile.id !== userIdRef.current) {
      userIdRef.current = userProfile.id;
      backupService.setUserId(userProfile.id);
    }
  }, [userProfile?.id]);

  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [stats, setStats] = useState({ keys: 0, size: '0 B', babies: 0, entries: 0 });
  const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);
  const [showLocalBackups, setShowLocalBackups] = useState(true);
  const [restoreProgress, setRestoreProgress] = useState<{ message: string; progress: number } | null>(null);
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAutoBackupModal, setShowAutoBackupModal] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>({
    enabled: false, frequency: 'weekly', timeOfDay: '02:00',
    keepCount: 5, includeMedia: false, encryptBackups: false,
  });

  // ─── Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = userIdRef.current;
      if (!uid) { setIsLoading(false); return; }
      try {
        const [s, b, a] = await Promise.all([
          backupService.getCurrentStats(uid),
          backupService.listLocalBackups(),
          backupService.getAutoBackupSettings(),
        ]);
        if (cancelled) return;
        setStats(s);
        setLocalBackups(b);
        setAutoBackupSettings(a);
        setLastBackup(b.length > 0 ? b[0].dateFormatted : null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userProfile?.id]);

  const refreshBackups = useCallback(async () => {
    const backups = await backupService.listLocalBackups();
    setLocalBackups(backups);
    setLastBackup(backups.length > 0 ? backups[0].dateFormatted : null);
  }, []);

  // ─── Create ───────────────────────────────────────────────────────
  const handleCreateBackup = useCallback(async (encrypted = false, password?: string) => {
    const uid = userIdRef.current;
    if (!uid) { sweetAlert.alert('Error', 'You must be signed in', 'error'); return; }
    triggerHaptic('medium');
    setIsCreating(true);
    try {
      const result = await backupService.createBackup(uid, { encrypted, password });
      if (!result.success || !result.filePath) throw new Error(result.error || 'Failed');
      await refreshBackups();
      sweetAlert.confirm(
        '✅ Backup Created!',
        `Your ${encrypted ? 'encrypted ' : ''}backup has been saved. Share it?`,
        async () => { await backupService.shareBackup(result.filePath!); },
        () => { sweetAlert.alert('Saved', 'Backup saved locally.', 'success'); },
        'Share', 'Keep Local', false,
      );
      await backupService.cleanupOldBackups(autoBackupSettings.keepCount);
    } catch (e) {
      triggerHaptic('error');
      sweetAlert.alert('Backup Failed', 'Something went wrong.', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [autoBackupSettings.keepCount, refreshBackups, sweetAlert, triggerHaptic]);

  // ─── Restore ──────────────────────────────────────────────────────
  const performRestore = useCallback(async (content: string, password?: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    setIsRestoring(true);
    setRestoreProgress({ message: 'Starting...', progress: 0 });
    try {
      const result = await backupService.restoreBackup(content, uid, password,
        (m, p) => setRestoreProgress({ message: m, progress: p }));
      if (!result.success) throw new Error(result.message);
      triggerHaptic('success');
      sweetAlert.alert('✅ Restore Complete!', result.message, 'success');
      const [s] = await Promise.all([backupService.getCurrentStats(uid), refreshBackups()]);
      setStats(s);
      setTimeout(() => navigation.replace('Main' as any), 1500);
    } catch (e) {
      triggerHaptic('error');
      sweetAlert.alert('Restore Failed', e instanceof Error ? e.message : 'Unknown error', 'error');
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
      setPendingContent(null);
    }
  }, [navigation, refreshBackups, sweetAlert, triggerHaptic]);

  const handlePickBackupFile = useCallback(async () => {
    if (!userIdRef.current) { sweetAlert.alert('Error', 'Sign in required', 'error'); return; }
    triggerHaptic('medium');
    try {
      const picked = await backupService.pickBackupFile();
      if (!picked) return;
      if (backupService.isEncrypted(picked.content)) {
        setPendingContent(picked.content);
        setShowPasswordModal(true);
        return;
      }
      const preview = await backupService.previewBackup(picked.content);
      if (!preview.valid) {
        sweetAlert.alert('Invalid Backup', 'Not a valid LittleLoom backup.', 'error');
        return;
      }
      sweetAlert.confirm(
        'Restore Backup?',
        `• ${preview.babies ?? 0} babies\n• ${preview.logs ?? 0} entries\n• ${preview.familyMembers ?? 0} family members`,
        async () => performRestore(picked.content),
        () => {}, 'Restore', 'Cancel', false,
      );
    } catch (e) {
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Could not read file.', 'error');
    }
  }, [sweetAlert, triggerHaptic, performRestore]);

  const handlePasswordConfirm = useCallback(async (password: string) => {
    if (!pendingContent) return;
    setIsPasswordLoading(true);
    try {
      const preview = await backupService.previewBackup(pendingContent, password);
      if (!preview.valid) {
        setIsPasswordLoading(false);
        sweetAlert.alert('Invalid Password', 'The password is incorrect.', 'error');
        return;
      }
      setShowPasswordModal(false);
      setIsPasswordLoading(false);
      sweetAlert.confirm(
        'Restore Backup?',
        `• ${preview.babies ?? 0} babies\n• ${preview.logs ?? 0} entries`,
        async () => performRestore(pendingContent, password),
        () => { setPendingContent(null); },
        'Restore', 'Cancel', false,
      );
    } catch {
      setIsPasswordLoading(false);
      sweetAlert.alert('Invalid Password', 'Try again.', 'error');
    }
  }, [pendingContent, performRestore, sweetAlert]);

  // ─── Local backup actions ─────────────────────────────────────────
  const handleLocalBackupPress = useCallback(async (backup: LocalBackupInfo) => {
    triggerHaptic('light');
    try {
      const content = await backupService.readLocalBackup(backup.path);
      if (!content) { sweetAlert.alert('Error', 'Could not read backup.', 'warning'); return; }
      if (backup.isEncrypted) {
        setPendingContent(content);
        setShowPasswordModal(true);
        return;
      }
      const preview = await backupService.previewBackup(content);
      if (!preview.valid) { sweetAlert.alert('Invalid', 'Corrupted backup.', 'error'); return; }
      sweetAlert.confirm(
        'Restore This Backup?',
        `Created: ${preview.date ?? 'Unknown'}\n• ${preview.babies ?? 0} babies\n• ${preview.logs ?? 0} entries`,
        async () => performRestore(content),
        () => {}, 'Restore', 'Cancel', false,
      );
    } catch {
      sweetAlert.alert('Error', 'Could not process backup.', 'error');
    }
  }, [sweetAlert, triggerHaptic, performRestore]);

  const handleShareLocalBackup = useCallback(async (backup: LocalBackupInfo) => {
    triggerHaptic('light');
    await backupService.shareBackup(backup.path);
  }, [triggerHaptic]);

  const handleDeleteLocalBackup = useCallback((backup: LocalBackupInfo) => {
    triggerHaptic('light');
    sweetAlert.confirm(
      'Delete Backup?',
      `Delete "${backup.name}"? Cannot be undone.`,
      async () => {
        await backupService.deleteBackupFile(backup.path);
        await refreshBackups();
      },
      () => {}, 'Delete', 'Cancel', true,
    );
  }, [sweetAlert, triggerHaptic, refreshBackups]);

  const handleSaveAutoBackupSettings = useCallback(async (settings: AutoBackupSettings) => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      await backupService.saveAutoBackupSettings(settings, uid);
      setAutoBackupSettings(settings);
      setShowAutoBackupModal(false);
      triggerHaptic('success');
      sweetAlert.alert('Saved', 'Auto backup settings saved.', 'success');
    } catch {
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Failed to save.', 'error');
    }
  }, [sweetAlert, triggerHaptic]);

  const handleRunBackupNow = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    triggerHaptic('medium');
    setIsCreating(true);
    try {
      const result = await backupService.createBackup(uid, {
        encrypted: autoBackupSettings.encryptBackups,
        password: autoBackupSettings.encryptionPassword,
      });
      if (!result.success) throw new Error(result.error);
      await refreshBackups();
      await backupService.cleanupOldBackups(autoBackupSettings.keepCount);
      triggerHaptic('success');
      sweetAlert.alert('✅ Backup Complete', 'Data backed up successfully.', 'success');
    } catch {
      triggerHaptic('error');
      sweetAlert.alert('Backup Failed', 'Something went wrong.', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [autoBackupSettings, refreshBackups, sweetAlert, triggerHaptic]);

  const handleClearAllBackups = useCallback(() => {
    sweetAlert.confirm(
      'Clear All Backups?',
      `Delete all ${localBackups.length} backups? Cannot be undone.`,
      async () => {
        for (const b of localBackups) await backupService.deleteBackupFile(b.path);
        await refreshBackups();
      },
      () => {}, 'Delete All', 'Cancel', true,
    );
  }, [localBackups, sweetAlert, refreshBackups, triggerHaptic]);

  // ─── Render ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <LinearGradient colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#f8faff', '#f0f4ff']}
        style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading backup data...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#f8faff', '#f0f4ff']} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Backup & Restore</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Protect your memories, move between devices
          </Text>
        </Animated.View>

        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}
          style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <BlurView intensity={isDark ? 40 : 90} style={styles.infoBlur} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="shield-checkmark" size={32} color={themeColors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>Your Data, Always Yours</Text>
            <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
              Create encrypted JSON backups of all your baby tracking data.
            </Text>
          </BlurView>
        </Animated.View>

        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.statsRow}>
          <StatPill icon="heart-outline" label="Babies" value={stats.babies} color={themeColors.primary} isDark={isDark} />
          <StatPill icon="list-outline" label="Entries" value={stats.entries} color={COLORS.info} isDark={isDark} />
          <StatPill icon="save-outline" label="Est. Size" value={stats.size} color={COLORS.success} isDark={isDark} />
        </Animated.View>

        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.actionsSection}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Quick Actions</Text>
          <ActionCard icon="cloud-upload-outline" title="Create Backup"
            subtitle="Export all data to a shareable file" color={COLORS.success}
            onPress={() => handleCreateBackup(false)} isLoading={isCreating} isDark={isDark} />
          <View style={{ height: 12 }} />
          <ActionCard icon="lock-closed-outline" title="Encrypted Backup"
            subtitle="Password-protect your backup" color={COLORS.purple}
            onPress={() => setShowEncryptModal(true)} isLoading={isCreating} isDark={isDark} />
          <View style={{ height: 12 }} />
          <ActionCard icon="cloud-download-outline" title="Restore from File"
            subtitle="Import data from a backup file" color={themeColors.primary}
            onPress={handlePickBackupFile} isLoading={isRestoring} isDark={isDark} />
        </Animated.View>

        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(500)} style={styles.localBackupsSection}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowLocalBackups(!showLocalBackups)}>
            <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
              Local Backups ({localBackups.length})
            </Text>
            <Ionicons name={showLocalBackups ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
          </TouchableOpacity>
          {showLocalBackups && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn}>
              {localBackups.length === 0 ? (
                <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
                  <Ionicons name="folder-open-outline" size={40} color={isDark ? '#444' : '#ccc'} />
                  <Text style={[styles.emptyStateText, isDark && styles.textSecondaryLight]}>
                    No local backups yet
                  </Text>
                </View>
              ) : (
                <>
                  {localBackups.slice(0, 10).map(b => (
                    <LocalBackupItem key={b.id} backup={b}
                      onPress={() => handleLocalBackupPress(b)}
                      onShare={() => handleShareLocalBackup(b)}
                      onDelete={() => handleDeleteLocalBackup(b)}
                      isDark={isDark} />
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

        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(600)} style={styles.autoBackupSection}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Auto Backup</Text>
          <ActionCard icon="time-outline" title="Auto Backup Settings"
            subtitle={autoBackupSettings.enabled
              ? `${autoBackupSettings.frequency} • Keep ${autoBackupSettings.keepCount}`
              : 'Schedule automatic backups'}
            color={COLORS.warning} onPress={() => setShowAutoBackupModal(true)}
            badge={autoBackupSettings.enabled ? 'ON' : 'OFF'} isDark={isDark} />
          <View style={{ height: 12 }} />
          <ActionCard icon="play-circle-outline" title="Backup Now"
            subtitle="Manually trigger a backup" color={COLORS.orange}
            onPress={handleRunBackupNow} isLoading={isCreating} isDark={isDark} />
        </Animated.View>

        {lastBackup && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(800)} style={styles.lastBackup}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={[styles.lastBackupText, isDark && styles.lastBackupTextDark]}>
              Last backup: {lastBackup}
            </Text>
          </Animated.View>
        )}

        <Text style={[styles.note, isDark && styles.noteDark]}>
          💡 Tip: Back up regularly and store files in cloud storage for safety.
        </Text>
      </Animated.ScrollView>

      {restoreProgress && (
        <View style={styles.progressOverlay}>
          <BlurView intensity={80} style={styles.progressBlur} tint="dark">
            <View style={styles.progressContent}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.progressMessage}>{restoreProgress.message}</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${restoreProgress.progress}%` }]} />
              </View>
              <Text style={styles.progressPercent}>{restoreProgress.progress}%</Text>
            </View>
          </BlurView>
        </View>
      )}

      <EncryptModal visible={showEncryptModal} onClose={() => setShowEncryptModal(false)}
        onConfirm={pw => handleCreateBackup(true, pw)}
        isDark={isDark} primaryColor={themeColors.primary} secondaryColor={themeColors.secondary} />

      <PasswordModal visible={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setPendingContent(null); setIsPasswordLoading(false); }}
        onConfirm={handlePasswordConfirm} isDark={isDark}
        primaryColor={themeColors.primary} secondaryColor={themeColors.secondary}
        title="Enter Backup Password" subtitle="This backup is password protected"
        isLoading={isPasswordLoading} />

      <AutoBackupModal visible={showAutoBackupModal} onClose={() => setShowAutoBackupModal(false)}
        onSave={handleSaveAutoBackupSettings} settings={autoBackupSettings}
        isDark={isDark} primaryColor={themeColors.primary} secondaryColor={themeColors.secondary} />
    </LinearGradient>
  );
}

// ─── Styles (unchanged from your file — kept verbatim) ────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  content: { paddingHorizontal: 20 },
  textLight: { color: '#fff' },
  textSecondaryLight: { color: '#a0a0a0' },
  header: { marginBottom: 24 },
  backButton: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5, marginBottom: 6 },
  headerTitleDark: { color: '#fff' },
  headerSubtitle: { fontSize: 15, color: '#666', fontWeight: '500' },
  headerSubtitleDark: { color: '#a0a0a0' },
  infoCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(102,126,234,0.15)' },
  infoCardDark: { borderColor: 'rgba(102,126,234,0.2)' },
  infoBlur: { padding: 24, alignItems: 'center' },
  infoIcon: { marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  infoTitleDark: { color: '#fff' },
  infoText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  infoTextDark: { color: '#a0a0a0' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  statPillDark: { backgroundColor: 'rgba(30,30,40,0.5)', borderColor: 'rgba(255,255,255,0.05)' },
  statPillIcon: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', marginBottom: 8,
  },
  statPillValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  statPillValueDark: { color: '#fff' },
  statPillLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 2 },
  statPillLabelDark: { color: '#888' },
  actionsSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionLabelDark: { color: '#888' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  actionCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  actionCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  actionCardGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  actionIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  actionTitleDark: { color: '#fff' },
  actionSubtitle: { fontSize: 13, color: '#888', fontWeight: '500' },
  actionSubtitleDark: { color: '#888' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  localBackupsSection: { marginBottom: 24 },
  localBackupItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  localBackupItemDark: { backgroundColor: 'rgba(30,30,40,0.4)', borderColor: 'rgba(255,255,255,0.05)' },
  localBackupIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  localBackupInfo: { flex: 1 },
  localBackupName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  localBackupMeta: { fontSize: 12, color: '#888', fontWeight: '500' },
  localBackupActions: { flexDirection: 'row', gap: 8 },
  localBackupAction: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)' },
  emptyState: {
    alignItems: 'center', padding: 30,
    backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 16,
  },
  emptyStateDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  emptyStateText: { marginTop: 12, fontSize: 14, color: '#888', fontWeight: '600' },
  moreBackupsText: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 8, fontWeight: '500' },
  clearAllButton: { alignItems: 'center', padding: 14, marginTop: 8 },
  clearAllText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
  autoBackupSection: { marginBottom: 24 },
  lastBackup: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 16, padding: 12, backgroundColor: 'rgba(67,233,123,0.1)', borderRadius: 14,
  },
  lastBackupText: { fontSize: 14, color: '#43e97b', fontWeight: '600' },
  lastBackupTextDark: { color: '#51cf66' },
  note: { fontSize: 13, color: '#888', textAlign: 'center', fontWeight: '500', lineHeight: 18 },
  noteDark: { color: '#666' },
  progressOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  progressBlur: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressContent: { width: '80%', alignItems: 'center', padding: 32 },
  progressMessage: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  progressBarContainer: {
    width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, marginTop: 20, overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: '#43e97b', borderRadius: 3 },
  progressPercent: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 12 },
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 20,
  },
  modalBlur: { borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 400 },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  modalContentDark: { backgroundColor: 'rgba(30,30,40,0.95)', borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginTop: 12, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, height: 56,
    borderWidth: 1, borderColor: 'rgba(102,126,234,0.15)',
  },
  inputContainerDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#888' },
  modalConfirmButton: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  modalConfirmGradient: {
    paddingVertical: 14, alignItems: 'center',
    justifyContent: 'center', minHeight: 50,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16, marginBottom: 12,
  },
  settingRowDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  settingDesc: { fontSize: 12, color: '#888', fontWeight: '500' },
  frequencyButtons: { flexDirection: 'row', gap: 8 },
  freqButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  freqButtonText: { fontSize: 13, fontWeight: '600', color: '#888' },
  freqButtonTextActive: { color: '#fff' },
  keepCountButtons: { flexDirection: 'row', gap: 8 },
  keepButton: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  keepButtonText: { fontSize: 14, fontWeight: '700', color: '#888' },
  keepButtonTextActive: { color: '#fff' },
});