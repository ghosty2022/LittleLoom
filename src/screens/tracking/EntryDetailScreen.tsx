// src/screens/tracking/EntryDetailScreen.tsx
// Complete, traceable view of a single logged entry:
// photos, particulars, audit trail, same-day context, prev/next, actions.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions, Image, Modal, ScrollView, Share, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { format, isToday, isYesterday, isSameDay, formatDistanceToNow } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { useTracker } from '../../context/TrackerContext';
import { useBaby } from '../../context/BabyContext';
import { TrackerEntry } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

const { width: SCREEN_W } = Dimensions.get('window');

type EntryDetailRouteProp = RouteProp<RootStackParamList, 'EntryDetail'>;
type EntryDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  },
};

const SKIP_KEYS = new Set([
  'id', 'timestamp', 'babyId', 'type', 'title', 'icon',
  'photoUris', 'photos', 'photo', 'notes', 'tags',
]);

const ROLE_META: Record<string, { label: string; color: string }> = {
  parent1: { label: 'Primary Parent', color: '#667eea' },
  parent2: { label: 'Co-Parent', color: '#fa709a' },
  guardian: { label: 'Guardian', color: '#11998e' },
  viewer: { label: 'Viewer', color: '#64748b' },
};

/* ── Edit history (previous versions snapshotted by TrackerContext on each edit) ── */

const EDIT_HISTORY_KEY = '@littleloom_edit_history_v1';

interface EntryEditVersion {
  editedAt: number;
  editedBy?: string;
  editedByName: string;
  prevTitle?: string;
  prevNotes?: string;
  prevTimestamp: number;
  prevData?: Record<string, unknown>;
  prevPhotoUris?: string[];
  prevTags?: string[];
}

const versionValueText = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '—';
  if (typeof v === 'object') {
    const o = v as any;
    if (o?.name) return String(o.name);
    if (o?.label) return String(o.label);
    return JSON.stringify(v);
  }
  return String(v);
};

/* ── Value intelligence ─────────────────────────────────────── */

type FieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'bool'; bool: boolean }
  | { kind: 'rating'; rating: number }
  | { kind: 'chips'; chips: string[] };

const humanizeKey = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const formatDurationMin = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatValue = (
  key: string,
  value: unknown,
  data: Record<string, unknown>
): FieldValue | null => {
  if (value === undefined || value === null || value === '') return null;

  // Fold unit fields into the value field
  if ((key === 'unit' || key === 'value_unit') && data.value !== undefined) return null;

  if (typeof value === 'boolean') return { kind: 'bool', bool: value };

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return { kind: 'chips', chips: value.map((v) => String(v)) };
  }

  if (typeof value === 'object') {
    const anyVal = value as any;
    if (anyVal?.name) return { kind: 'text', text: String(anyVal.name) };
    if (anyVal?.label) return { kind: 'text', text: String(anyVal.label) };
    return { kind: 'text', text: JSON.stringify(value) };
  }

  if (typeof value === 'number') {
    const lk = key.toLowerCase();
    if (
      (lk.includes('quality') || lk.includes('rating') || lk.includes('mood') || lk.includes('severity')) &&
      value >= 1 && value <= 5
    ) {
      return { kind: 'rating', rating: value };
    }
    if (lk.includes('duration') || lk.endsWith('minutes') || lk === 'mins') {
      return { kind: 'text', text: value >= 30 ? formatDurationMin(value) : `${value} min` };
    }
    if (key === 'value') {
      const unit = (data.unit ?? data.value_unit) as string | undefined;
      if (unit) return { kind: 'text', text: `${value} ${unit}` };
    }
    return { kind: 'text', text: String(value) };
  }

  const str = String(value).replace(/_/g, ' ');
  const pretty = str.length > 1 ? str[0].toUpperCase() + str.slice(1) : str;
  return { kind: 'text', text: pretty };
};

/* ── Value cell renderer ────────────────────────────────────── */

const ValueCell = ({ value, theme, accent }: { value: FieldValue; theme: any; accent: string }) => {
  if (value.kind === 'bool') {
    const on = value.bool;
    return (
      <View style={[styles.boolPill, { backgroundColor: on ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)' }]}>
        <Text style={[styles.boolPillText, { color: on ? '#10b981' : '#ef4444' }]}>{on ? 'Yes' : 'No'}</Text>
      </View>
    );
  }
  if (value.kind === 'rating') {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={i}
            name={i <= value.rating ? 'star' : 'star-outline'}
            size={14}
            color={i <= value.rating ? '#f59e0b' : theme.text.muted}
          />
        ))}
      </View>
    );
  }
  if (value.kind === 'chips') {
    return (
      <View style={styles.chipsWrap}>
        {value.chips.map((c, i) => (
          <View key={`${c}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.valueChipText, { color: accent }]}>{c}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <Text style={[styles.rowValue, { color: theme.text.primary }]}>{value.text}</Text>;
};

/* ── Main screen ────────────────────────────────────────────── */

export default function EntryDetailScreen() {
  const navigation = useNavigation<EntryDetailNavigationProp>();
  const route = useRoute<EntryDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();
  const { triggerHaptic, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion } = useCustomization();
  const {
    getEntryById, getTracker, getEntries, getEntriesByDate,
    addEntry, deleteEntry, canEditEntry, canDeleteEntry, canCreateEntry,
  } = useTracker();
  const { babies, currentBaby } = useBaby();
  const { success, confirm } = useSweetAlert();

  const entryId = route.params?.entryId;
  const entry = entryId ? getEntryById(entryId) : undefined;
  const tracker = entry ? getTracker(entry.trackerId) : undefined;

  const accent = tracker?.gradient?.[0] || tracker?.color || theme.primary;
  const heroColors: [string, string] = [accent, (tracker?.gradient?.[1] as string) || theme.secondary || accent];
  const radius = borderRadiusValue || DESIGN.radius.lg;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editHistory, setEditHistory] = useState<EntryEditVersion[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  /* Load previous versions of this entry (re-runs when editedAt changes) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!entryId) return;
      try {
        const raw = await AsyncStorage.getItem(EDIT_HISTORY_KEY);
        const store = raw ? JSON.parse(raw) : {};
        const list = Array.isArray(store[entryId]) ? store[entryId] : [];
        if (mounted) setEditHistory(list);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [entryId, entry?.editedAt]);

  const baby = useMemo(() => {
    if (!entry) return currentBaby;
    return babies?.find((b) => b.id === entry.babyId) || currentBaby;
  }, [entry, babies, currentBaby]);

  const entryDate = entry ? new Date(entry.timestamp) : null;
  const photos = useMemo(() => entry?.photoUris ?? [], [entry]);
  const tags = useMemo(() => entry?.tags ?? [], [entry]);
  const locationName = typeof entry?.location?.name === 'string' ? entry.location.name : '';

  const canEdit = entry ? canEditEntry(entry) : false;
  const canDelete = entry ? canDeleteEntry(entry) : false;
  const canDuplicate = entry ? canCreateEntry(entry.trackerId) : false;

  const dayLabel = useMemo(() => {
    if (!entryDate) return '';
    if (isToday(entryDate)) return 'Today';
    if (isYesterday(entryDate)) return 'Yesterday';
    return format(entryDate, 'EEEE');
  }, [entryDate]);

  const relativeLabel = useMemo(() => {
    if (!entryDate) return '';
    try {
      return formatDistanceToNow(entryDate, { addSuffix: true });
    } catch {
      return '';
    }
  }, [entryDate]);

  /* ── Particulars: ordered by tracker field config, extras appended ── */
  const detailRows = useMemo(() => {
    if (!entry?.data) return [] as { key: string; label: string; value: FieldValue }[];
    const data = entry.data as Record<string, unknown>;
    const orderedKeys: string[] = [];
    (tracker?.fields || []).forEach((f: any) => {
      if (f?.id && data[f.id] !== undefined) orderedKeys.push(f.id);
    });
    Object.keys(data).forEach((k) => {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    return orderedKeys
      .filter((k) => !SKIP_KEYS.has(k))
      .map((k) => {
        const field = tracker?.fields?.find((fl: any) => fl.id === k);
        return {
          key: k,
          label: field?.label || humanizeKey(k),
          value: formatValue(k, data[k], data),
        };
      })
      .filter((r): r is { key: string; label: string; value: FieldValue } => r.value !== null);
  }, [entry, tracker]);

  /* ── Same-day trace ── */
  const sameDayEntries = useMemo(() => {
    if (!entry) return [] as TrackerEntry[];
    return getEntriesByDate(new Date(entry.timestamp))
      .filter((e) => e.id !== entry.id)
      .slice(0, 8);
  }, [entry, getEntriesByDate]);

  /* ── Prev / next inside this tracker ── */
  const trackerHistory = useMemo(() => {
    if (!entry) {
      return { prev: null as TrackerEntry | null, next: null as TrackerEntry | null, index: -1, total: 0 };
    }
    const list = getEntries(entry.trackerId).slice().sort((a, b) => a.timestamp - b.timestamp);
    const index = list.findIndex((e) => e.id === entry.id);
    return {
      prev: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
      index,
      total: list.length,
    };
  }, [entry, getEntries]);

  const syncedLabel = useMemo(() => {
    if (!entry?.syncedAt) return null;
    const d = new Date(entry.syncedAt as any);
    return isNaN(d.getTime()) ? null : format(d, 'MMM d, h:mm a');
  }, [entry]);

  /* ── Edited history rows with field-level diffs (newest first) ── */
  const historyRows = useMemo(() => {
    if (!entry || editHistory.length === 0) return [] as {
      key: string;
      version: number;
      editedAt: number;
      editedByName: string;
      changes: { label: string; before: string; after: string }[];
    }[];

    return editHistory.map((v, idx) => {
      const isLast = idx === editHistory.length - 1;
      const afterData = (isLast ? entry.data : editHistory[idx + 1]?.prevData) as Record<string, unknown> | undefined;
      const afterTitle = isLast ? entry.title : editHistory[idx + 1]?.prevTitle;
      const afterNotes = isLast ? entry.notes : editHistory[idx + 1]?.prevNotes;
      const afterTimestamp = isLast ? entry.timestamp : editHistory[idx + 1]?.prevTimestamp;

      const changes: { label: string; before: string; after: string }[] = [];

      if ((v.prevTitle || '') !== (afterTitle || '')) {
        changes.push({ label: 'Title', before: versionValueText(v.prevTitle), after: versionValueText(afterTitle) });
      }
      if ((v.prevNotes || '') !== (afterNotes || '')) {
        changes.push({ label: 'Notes', before: versionValueText(v.prevNotes), after: versionValueText(afterNotes) });
      }
      if (afterTimestamp && v.prevTimestamp !== afterTimestamp) {
        changes.push({
          label: 'Time',
          before: format(new Date(v.prevTimestamp), 'MMM d, h:mm a'),
          after: format(new Date(afterTimestamp), 'MMM d, h:mm a'),
        });
      }

      const prevData = (v.prevData || {}) as Record<string, unknown>;
      const nextData = (afterData || {}) as Record<string, unknown>;
      const allKeys = [...new Set([...Object.keys(prevData), ...Object.keys(nextData)])].filter(k => !SKIP_KEYS.has(k));
      allKeys.forEach(k => {
        const before = versionValueText(prevData[k]);
        const after = versionValueText(nextData[k]);
        if (before !== after) {
          const field = tracker?.fields?.find((fl: any) => fl.id === k);
          changes.push({ label: field?.label || humanizeKey(k), before, after });
        }
      });

      return {
        key: `${v.editedAt}-${idx}`,
        version: idx + 1,
        editedAt: v.editedAt,
        editedByName: v.editedByName || 'Unknown',
        changes,
      };
    }).reverse(); // newest edit first
  }, [entry, editHistory, tracker]);

  /* ── In-context stats: this entry's rhythm inside its tracker ── */
  const contextStats = useMemo(() => {
    if (!entry) return null;
    const list = getEntries(entry.trackerId)
      .filter(e => e.id !== entry.id)
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);

    // Position within its day (e.g. "3rd of 5 that day")
    const sameDay = list.filter(e => isSameDay(new Date(e.timestamp), new Date(entry.timestamp)));
    const dayTotal = sameDay.length + 1;
    const dayIndex = sameDay.filter(e => e.timestamp < entry.timestamp).length + 1;

    // Gap from the previous entry of this tracker
    const prev = list.filter(e => e.timestamp < entry.timestamp).pop() || null;
    const gapMs = prev ? entry.timestamp - prev.timestamp : null;

    // Typical gap across the 10 entries before this one
    const before = list.filter(e => e.timestamp <= entry.timestamp).slice(-10);
    let avgGapMs: number | null = null;
    if (before.length >= 2) {
      let sum = 0;
      for (let i = 1; i < before.length; i++) sum += before[i].timestamp - before[i - 1].timestamp;
      avgGapMs = sum / (before.length - 1);
    }

    const fmtGap = (ms: number): string => {
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return rh ? `${d}d ${rh}h` : `${d}d`;
    };

    const ordinal = (n: number): string => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return {
      dayPosition: `${ordinal(dayIndex)} of ${dayTotal} that day`,
      sincePrev: gapMs !== null ? fmtGap(gapMs) : null,
      avgGap: avgGapMs !== null ? fmtGap(avgGapMs) : null,
    };
  }, [entry, getEntries]);

  /* ── Precise age of the baby at the moment this entry was logged ── */
  const ageAtLogging = useMemo(() => {
    const dobStr = (baby as any)?.birthDate;
    if (!dobStr || !entryDate) return baby?.age ? `${baby.age} old at logging` : '';
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return baby?.age ? `${baby.age} old at logging` : '';
    const totalDays = Math.floor((entryDate.getTime() - dob.getTime()) / 86400000);
    if (totalDays < 0) return '';
    if (totalDays < 1) return 'Newborn at logging';
    if (totalDays < 14) return `${totalDays} day${totalDays === 1 ? '' : 's'} old at logging`;
    if (totalDays < 60) {
      const weeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;
      return remDays > 0 ? `${weeks}w ${remDays}d old at logging` : `${weeks} week${weeks === 1 ? '' : 's'} old at logging`;
    }
    let months = (entryDate.getFullYear() - dob.getFullYear()) * 12;
    months += entryDate.getMonth() - dob.getMonth();
    if (entryDate.getDate() < dob.getDate()) months--;
    if (months < 0) months = 0;
    if (months < 24) {
      const anchor = new Date(dob);
      anchor.setMonth(anchor.getMonth() + months);
      const remDays = Math.max(0, Math.floor((entryDate.getTime() - anchor.getTime()) / 86400000));
      return remDays > 0 ? `${months}m ${remDays}d old at logging` : `${months} month${months === 1 ? '' : 's'} old at logging`;
    }
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}m old at logging` : `${years} year${years === 1 ? '' : 's'} old at logging`;
  }, [baby, entryDate]);

  /* ── Share summary ── */
  const shareText = useMemo(() => {
    if (!entry || !entryDate) return '';
    const lines = [
      `${tracker?.emoji || '📝'} ${entry.title || 'Entry'}`,
      `${tracker?.name || entry.trackerId} — ${format(entryDate, 'EEEE, MMM d, yyyy')} at ${format(entryDate, 'h:mm a')}`,
      '',
      ...detailRows.map((r) => {
        const v = r.value;
        const txt =
          v.kind === 'bool' ? (v.bool ? 'Yes' : 'No')
          : v.kind === 'rating' ? `${v.rating}/5`
          : v.kind === 'chips' ? v.chips.join(', ')
          : v.text;
        return `• ${r.label}: ${txt}`;
      }),
    ];
    if (entry.notes) lines.push('', `Notes: ${entry.notes}`);
    if (tags.length > 0) lines.push(`Tags: ${tags.map((t) => `#${t}`).join(' ')}`);
    if (photos.length > 0) lines.push(`📷 ${photos.length} photo${photos.length > 1 ? 's' : ''} attached`);
    lines.push('', `Logged by ${entry.loggedByName || 'Unknown'} • LittleLoom`);
    return lines.join('\n');
  }, [entry, entryDate, detailRows, tracker, tags, photos]);

  /* ── Handlers ── */
  const handleShare = useCallback(async () => {
    if (!shareText) return;
    triggerHaptic('light');
    try {
      await Share.share({ message: shareText });
    } catch {}
  }, [shareText, triggerHaptic]);

  const handleEdit = useCallback(() => {
    if (!entry) return;
    triggerHaptic('light');
    navigation.navigate('AddEntry', { editMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [entry, navigation, triggerHaptic]);

  const handleDuplicate = useCallback(async () => {
    if (!entry) return;
    triggerHaptic('medium');
    const copy = await addEntry(entry.trackerId, { ...(entry.data as Record<string, unknown>) }, {
      title: entry.title,
      notes: entry.notes,
      photoUris: entry.photoUris,
      tags: entry.tags,
    });
    if (copy) {
      triggerHaptic('success');
      success('Duplicated', 'A copy was logged with the current time.');
    }
  }, [entry, addEntry, success, triggerHaptic]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete "${entry.title || 'this entry'}"? This cannot be undone.`,
      async () => {
        const ok = await deleteEntry(entry.id);
        if (ok) {
          triggerHaptic('success');
          success('Deleted', 'Entry removed');
          navigation.goBack();
        }
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [entry, confirm, deleteEntry, navigation, success, triggerHaptic]);

  const openEntry = useCallback((e: TrackerEntry) => {
    triggerHaptic('light');
    navigation.push('EntryDetail', { entryId: e.id, trackerId: e.trackerId });
  }, [navigation, triggerHaptic]);

  const roleMeta = ROLE_META[entry?.loggedByRole || ''] || { label: entry?.loggedByRole || 'Member', color: theme.primary };

  /* ── Missing entry fallback ── */
  if (!entry || !entryDate) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0']}
          style={styles.backgroundGradient}
        />
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Entry Details</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </View>
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.surface.card }]}>
            <Ionicons name="search-outline" size={40} color={theme.text.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>Entry not found</Text>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            This entry may have been deleted, or it belongs to a different baby profile.
          </Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Main render ── */
  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0', '#dbeafe']}
        style={styles.backgroundGradient}
      />

      {/* Header */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
            <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Entry Details</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>
              {tracker?.name || entry.trackerId}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name="share-social-outline" size={20} color={theme.text.primary} />
            </TouchableOpacity>
            {canDelete && (
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(60)}>
          <View style={[styles.heroCard, { borderRadius: radius }]}>
            <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroEmojiBubble}>
                  <Text style={styles.heroEmoji}>{tracker?.emoji || '📝'}</Text>
                </View>
                <View style={styles.heroTitleWrap}>
                  <View style={styles.heroTrackerChip}>
                    <Text style={styles.heroTrackerChipText}>{tracker?.name || entry.trackerId}</Text>
                  </View>
                  <Text style={[styles.heroTitle, { fontSize: 22 * fontSizeMultiplier }]} numberOfLines={2}>
                    {entry.title || 'Entry'}
                  </Text>
                </View>
              </View>

              <View style={styles.heroDateRow}>
                <View style={styles.heroDateBadge}>
                  <Text style={styles.heroDateBadgeText}>{dayLabel}</Text>
                </View>
                <View style={styles.heroDateBadge}>
                  <Text style={styles.heroDateBadgeText}>{format(entryDate, 'h:mm a')}</Text>
                </View>
                <Text style={styles.heroDateText}>{format(entryDate, 'EEEE, MMMM d, yyyy')}</Text>
              </View>
              {!!relativeLabel && <Text style={styles.heroRelative}>{relativeLabel}</Text>}

              {baby && (
                <View style={styles.heroBabyRow}>
                  <SafeAvatar avatar={baby.avatar} size={36} fallbackIcon="person" borderColor="rgba(255,255,255,0.6)" borderWidth={2} animated={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroBabyName}>{baby.name}</Text>
                    {!!ageAtLogging && <Text style={styles.heroBabyMeta}>{ageAtLogging}</Text>}
                  </View>
                  {photos.length > 0 && (
                    <View style={styles.heroDateBadge}>
                      <Text style={styles.heroDateBadgeText}>📷 {photos.length}</Text>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── IN CONTEXT: rhythm of this tracker around the entry ── */}
        {contextStats && (contextStats.sincePrev || contextStats.avgGap || dayLabel) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="pulse-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>In Context</Text>
                </View>
                <View style={styles.contextRow}>
                  <View style={[styles.contextTile, { backgroundColor: `${accent}0D` }]}>
                    <Ionicons name="calendar-number-outline" size={16} color={accent} />
                    <Text style={[styles.contextValue, { color: theme.text.primary }]}>{contextStats.dayPosition}</Text>
                    <Text style={[styles.contextLabel, { color: theme.text.muted }]}>Daily order</Text>
                  </View>
                  {!!contextStats.sincePrev && (
                    <View style={[styles.contextTile, { backgroundColor: `${accent}0D` }]}>
                      <Ionicons name="timer-outline" size={16} color={accent} />
                      <Text style={[styles.contextValue, { color: theme.text.primary }]}>{contextStats.sincePrev}</Text>
                      <Text style={[styles.contextLabel, { color: theme.text.muted }]}>After previous</Text>
                    </View>
                  )}
                  {!!contextStats.avgGap && (
                    <View style={[styles.contextTile, { backgroundColor: `${accent}0D` }]}>
                      <Ionicons name="stats-chart-outline" size={16} color={accent} />
                      <Text style={[styles.contextValue, { color: theme.text.primary }]}>{contextStats.avgGap}</Text>
                      <Text style={[styles.contextLabel, { color: theme.text.muted }]}>Typical gap</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── PHOTOS ── */}
        {photos.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(120)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="images-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Photos</Text>
                  <View style={[styles.countPill, { backgroundColor: `${accent}15` }]}>
                    <Text style={[styles.countPillText, { color: accent }]}>{photos.length}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {photos.map((uri, idx) => (
                    <TouchableOpacity
                      key={`${uri}-${idx}`}
                      style={styles.photoThumb}
                      activeOpacity={0.9}
                      onPress={() => { triggerHaptic('light'); setViewerIndex(idx); }}
                    >
                      <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                      {idx === 0 && photos.length > 1 && (
                        <View style={styles.photoBadge}>
                          <Text style={styles.photoBadgeText}>+{photos.length - 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── PARTICULARS ── */}
        {detailRows.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(160)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="list-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Details</Text>
                </View>
                {detailRows.map((r, i) => (
                  <View key={r.key} style={[styles.row, i > 0 && styles.rowBorder, i > 0 && { borderTopColor: theme.surface.border }]}>
                    <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>{r.label}</Text>
                    <View style={styles.rowValueWrap}>
                      <ValueCell value={r.value} theme={theme} accent={accent} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── NOTES ── */}
        {!!entry.notes && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="document-text-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Notes</Text>
                </View>
                <Text style={[styles.notesText, { color: theme.text.primary }]}>{entry.notes}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── TAGS & LOCATION ── */}
        {(tags.length > 0 || !!locationName) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(240)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="pricetags-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Tags & Location</Text>
                </View>
                {!!locationName && (
                  <View style={styles.auditSubRow}>
                    <Ionicons name="navigate-outline" size={14} color={accent} />
                    <Text style={[styles.auditSubText, { color: theme.text.primary }]}>{locationName}</Text>
                  </View>
                )}
                {tags.length > 0 && (
                  <View style={[styles.chipsWrap, { justifyContent: 'flex-start', marginTop: locationName ? 10 : 0 }]}>
                    {tags.map((t, i) => (
                      <View key={`${t}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
                        <Text style={[styles.valueChipText, { color: accent }]}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── AUDIT: logged by / edited / synced ── */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(280)}>
          <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={accent} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Record Info</Text>
              </View>
              <View style={styles.auditRow}>
                <View style={[styles.auditAvatar, { backgroundColor: roleMeta.color }]}>
                  <Text style={styles.auditAvatarText}>
                    {(entry.loggedByName || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.auditName, { color: theme.text.primary }]}>
                    {entry.loggedByName || 'Unknown'}
                  </Text>
                  <Text style={[styles.auditMeta, { color: theme.text.muted }]}>
                    Logged {format(entryDate, 'MMM d, yyyy • h:mm a')}
                  </Text>
                  <View style={[styles.rolePill, { backgroundColor: `${roleMeta.color}18` }]}>
                    <Text style={[styles.rolePillText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                  </View>
                </View>
              </View>
              {!!entry.editedAt && (
                <View style={styles.auditSubRow}>
                  <Ionicons name="create-outline" size={13} color={theme.text.muted} />
                  <Text style={[styles.auditSubText, { color: theme.text.muted }]}>
                    Edited {format(new Date(entry.editedAt), 'MMM d, yyyy • h:mm a')}
                  </Text>
                </View>
              )}
              {historyRows.length > 0 && (
                <View style={[styles.historyWrap, { borderColor: theme.surface.border }]}>
                  <TouchableOpacity
                    style={styles.historyHeader}
                    activeOpacity={0.75}
                    onPress={() => { triggerHaptic('light'); setHistoryExpanded(prev => !prev); }}
                  >
                    <Ionicons name="time-outline" size={14} color={accent} />
                    <Text style={[styles.historyHeaderText, { color: theme.text.primary }]}>
                      Edited history · {historyRows.length} previous version{historyRows.length > 1 ? 's' : ''}
                    </Text>
                    <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.text.muted} />
                  </TouchableOpacity>
                  {historyExpanded && historyRows.map((row) => (
                    <View key={row.key} style={[styles.historyVersion, { borderColor: theme.surface.border }]}>
                      <View style={styles.historyVersionHeader}>
                        <View style={[styles.historyVersionBadge, { backgroundColor: `${accent}15` }]}>
                          <Text style={[styles.historyVersionBadgeText, { color: accent }]}>v{row.version}</Text>
                        </View>
                        <Text style={[styles.historyVersionMeta, { color: theme.text.secondary }]} numberOfLines={1}>
                          {row.editedByName} • {format(new Date(row.editedAt), 'MMM d, yyyy • h:mm a')}
                        </Text>
                      </View>
                      {row.changes.length === 0 ? (
                        <Text style={[styles.historyChangeText, { color: theme.text.muted }]}>No field changes recorded</Text>
                      ) : (
                        row.changes.map((c, i) => (
                          <View key={`${row.key}-${i}`} style={styles.historyChangeRow}>
                            <Text style={[styles.historyChangeLabel, { color: theme.text.muted }]}>{c.label}</Text>
                            <Text style={[styles.historyChangeText, { color: theme.text.secondary }]} numberOfLines={2}>
                              <Text style={{ textDecorationLine: 'line-through', color: theme.text.muted }}>{c.before}</Text>
                              {'  →  '}
                              <Text style={{ color: theme.text.primary, fontWeight: '600' }}>{c.after}</Text>
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  ))}
                </View>
              )}
              {!!syncedLabel && (
                <View style={styles.auditSubRow}>
                  <Ionicons name="cloud-done-outline" size={13} color={theme.text.muted} />
                  <Text style={[styles.auditSubText, { color: theme.text.muted }]}>Synced {syncedLabel}</Text>
                </View>
              )}
              <View style={styles.auditSubRow}>
                <Ionicons name="finger-print-outline" size={13} color={theme.text.muted} />
                <Text style={[styles.auditSubText, { color: theme.text.muted }]}>ID …{entry.id.slice(-6)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── MORE FROM THIS DAY ── */}
        {sameDayEntries.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(320)}>
            <View style={[styles.card, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: radius }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="calendar-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>More from {dayLabel}</Text>
                  <View style={[styles.countPill, { backgroundColor: `${accent}15` }]}>
                    <Text style={[styles.countPillText, { color: accent }]}>{sameDayEntries.length}</Text>
                  </View>
                </View>
                {sameDayEntries.map((e, i) => {
                  const t = getTracker(e.trackerId);
                  const c = t?.gradient?.[0] || t?.color || theme.primary;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      onPress={() => openEntry(e)}
                      style={[styles.dayRow, i > 0 && styles.rowBorder, i > 0 && { borderTopColor: theme.surface.border }]}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.dayEmojiWrap, { backgroundColor: `${c}15` }]}>
                        <Text style={styles.dayEmoji}>{t?.emoji || '📋'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dayTitle, { color: theme.text.primary }]} numberOfLines={1}>
                          {e.title || t?.name || 'Entry'}
                        </Text>
                        <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                          {format(new Date(e.timestamp), 'h:mm a')}
                          {e.loggedByName ? ` • ${e.loggedByName}` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.dayFooter, { borderTopColor: theme.surface.border }]}
                  onPress={() => { triggerHaptic('light'); navigation.navigate('Timeline'); }}
                >
                  <Text style={[styles.dayFooterText, { color: accent }]}>Open full day in Timeline</Text>
                  <Ionicons name="arrow-forward" size={14} color={accent} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── PREV / NEXT in this tracker ── */}
        {(trackerHistory.prev || trackerHistory.next) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(360)}>
            <View style={styles.prevNextBar}>
              {trackerHistory.prev ? (
                <TouchableOpacity
                  style={[styles.prevNextBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border }]}
                  onPress={() => openEntry(trackerHistory.prev!)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="chevron-back" size={12} color={theme.text.muted} />
                    <Text style={[styles.prevNextLabel, { color: theme.text.muted }]}>Older</Text>
                  </View>
                  <Text style={[styles.prevNextTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {trackerHistory.prev.title || 'Entry'}
                  </Text>
                  <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                    {format(new Date(trackerHistory.prev.timestamp), 'MMM d, h:mm a')}
                  </Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}
              {trackerHistory.next ? (
                <TouchableOpacity
                  style={[styles.prevNextBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, alignItems: 'flex-end' }]}
                  onPress={() => openEntry(trackerHistory.next!)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.prevNextLabel, { color: theme.text.muted }]}>Newer</Text>
                    <Ionicons name="chevron-forward" size={12} color={theme.text.muted} />
                  </View>
                  <Text style={[styles.prevNextTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {trackerHistory.next.title || 'Entry'}
                  </Text>
                  <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                    {format(new Date(trackerHistory.next.timestamp), 'MMM d, h:mm a')}
                  </Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}
            </View>
            {trackerHistory.total > 0 && (
              <Text style={[styles.positionText, { color: theme.text.muted }]}>
                Entry {trackerHistory.index + 1} of {trackerHistory.total} in {tracker?.name || entry.trackerId}
              </Text>
            )}
          </Animated.View>
        )}

        {/* ── ACTION BAR ── */}
        {(canEdit || canDuplicate || canDelete) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.actionBar}>
            {canEdit && (
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleEdit} activeOpacity={0.85}>
                <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnPrimaryInner}>
                  <Ionicons name="create-outline" size={17} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>Edit</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {canDuplicate && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border }]}
                onPress={handleDuplicate}
                activeOpacity={0.85}
              >
                <Ionicons name="copy-outline" size={16} color={accent} />
                <Text style={[styles.actionBtnText, { color: accent }]}>Duplicate</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}
                onPress={handleDelete}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* ── FULLSCREEN PHOTO VIEWER ── */}
      <Modal visible={viewerIndex !== null} animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewerContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * SCREEN_W, y: 0 }}
            onMomentumScrollEnd={(e) => setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          >
            {photos.map((uri, idx) => (
              <View key={`viewer-${uri}-${idx}`} style={{ width: SCREEN_W, flex: 1, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width: SCREEN_W, height: '80%' }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerIndex(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={[styles.viewerCounter, { top: insets.top + 20 }]}>
              <Text style={styles.viewerCounterText}>{(viewerIndex ?? 0) + 1} / {photos.length}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: { width: 42, height: 42, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...DESIGN.shadow.sm },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  scrollContent: { paddingHorizontal: 16 },

  heroCard: { overflow: 'hidden', marginBottom: 16, ...DESIGN.shadow.md },
  heroGradient: { padding: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEmojiBubble: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  heroEmoji: { fontSize: 30 },
  heroTitleWrap: { flex: 1 },
  heroTrackerChip: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 6 },
  heroTrackerChipText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontWeight: '800', letterSpacing: -0.4 },
  heroDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  heroDateBadge: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroDateBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroDateText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  heroRelative: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 6 },
  heroBabyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 10 },
  heroBabyName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  heroBabyMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 1 },

  card: { overflow: 'hidden', marginBottom: 16, borderWidth: 1, ...DESIGN.shadow.sm },
  cardInner: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardHeaderIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flex: 1 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 11, fontWeight: '800' },

  photoStrip: { gap: 10 },
  photoThumb: { width: 110, height: 110, borderRadius: 14, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoBadge: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 13, fontWeight: '600', width: 118 },
  rowValueWrap: { flex: 1, alignItems: 'flex-end' },
  rowValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  boolPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  boolPillText: { fontSize: 12, fontWeight: '800' },
  starsRow: { flexDirection: 'row', gap: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  valueChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  valueChipText: { fontSize: 12, fontWeight: '700' },

  notesText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  auditAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  auditAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  auditName: { fontSize: 14, fontWeight: '800' },
  auditMeta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start', marginTop: 4 },
  rolePillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  auditSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  auditSubText: { fontSize: 12, fontWeight: '600' },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dayEmojiWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayEmoji: { fontSize: 18 },
  dayTitle: { fontSize: 14, fontWeight: '700' },
  dayMeta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  dayFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  dayFooterText: { fontSize: 13, fontWeight: '800' },

  prevNextBar: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  prevNextBtn: { flex: 1, borderWidth: 1, padding: 12, borderRadius: DESIGN.radius.md },
  prevNextLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  prevNextTitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  positionText: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: -8, marginBottom: 16 },

  actionBar: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtnPrimary: { flex: 1.4, borderRadius: DESIGN.radius.md, overflow: 'hidden' },
  actionBtnPrimaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionBtn: { flex: 1, borderRadius: DESIGN.radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '800' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },

  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  viewerCounter: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  viewerCounterText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ── In Context tiles ──
  contextRow: { flexDirection: 'row', gap: 8 },
  contextTile: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: DESIGN.radius.sm, gap: 4 },
  contextValue: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  contextLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  // ── Edited history ──
  historyWrap: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyHeaderText: { flex: 1, fontSize: 13, fontWeight: '800' },
  historyVersion: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: DESIGN.radius.sm, padding: 10 },
  historyVersionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyVersionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  historyVersionBadgeText: { fontSize: 10, fontWeight: '800' },
  historyVersionMeta: { flex: 1, fontSize: 11, fontWeight: '600' },
  historyChangeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  historyChangeLabel: { width: 72, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  historyChangeText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },
});