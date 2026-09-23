// src/components/trackers/TrackerEntryCard.tsx
// FIXED: 
//   - "Ongoing" badge for sleep/feed with status='ongoing'
//   - Duration displays as "1h 30m" instead of raw seconds
//   - Quantity fields show their actual unit (g/oz/ml/tbsp/servings/pieces)
//   - Solid food amount uses solidAmount field
//   - Defensive photo URI handling

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { TrackerEntry } from '../../types/trackers';

interface TrackerEntryCardProps {
  entry: TrackerEntry;
  onPress?: (entry: TrackerEntry) => void;
  onEdit?: (entry: TrackerEntry) => void;
  onDelete?: (entry: TrackerEntry) => void;
  showActions?: boolean;
  compact?: boolean;
  index?: number;
}

// ─── Duration formatter ─────────────────────────────────────────────────
// Handles: raw seconds (3600), ISO strings, "1h 30m" strings, and minutes
const formatDuration = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;

  // String that's already formatted (e.g., "1h 30m")
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // If it looks like a formatted duration, return as-is
    if (/^\d+[hm](\s*\d+[m])?$/i.test(trimmed) || /^\d+h\s*\d+m$/i.test(trimmed)) {
      return trimmed;
    }
    // Try parsing as number
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return formatDuration(parsed);
    }
    return null;
  }

  const s = Number(value);
  if (!Number.isFinite(s) || s <= 0) return null;

  // Guard against absurd values (> 24 hours) — likely a bug
  if (s > 86400) {
    if (__DEV__) console.warn('[TrackerEntryCard] Absurd duration:', s);
    return null;
  }

  const mins = Math.floor(s / 60);
  if (mins === 0) {
    const secs = Math.floor(s);
    return secs > 0 ? `${secs}s` : null;
  }
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Extract a display value for a field ────────────────────────────────
const getFieldDisplayValue = (
  field: any,
  entryData: Record<string, unknown>
): string | null => {
  const value = entryData[field.id];
  if (value === undefined || value === null || value === '') return null;

  // ── Toggle ────────────────────────────────────────────────────
  if (field.type === 'toggle') {
    return value ? 'Yes' : 'No';
  }

  // ── Select ────────────────────────────────────────────────────
  if (field.type === 'select' && field.options) {
    const option = field.options.find((o: any) => o.id === value);
    return option ? option.label : String(value);
  }

  // ── Multi-select ──────────────────────────────────────────────
  if (field.type === 'multiselect') {
    if (!Array.isArray(value) || value.length === 0) return null;
    if (field.options) {
      const labels = value
        .map((v: any) => field.options.find((o: any) => o.id === v)?.label || String(v))
        .filter(Boolean);
      return labels.length > 0 ? labels.join(', ') : null;
    }
    return value.map(String).join(', ');
  }

  // ── Duration ──────────────────────────────────────────────────
  if (field.type === 'duration') {
    const formatted = formatDuration(value);
    // formatDuration handles seconds → "1h 30m" conversion
    // Return null if it couldn't be parsed, so it doesn't show "3600"
    return formatted;
  }

  // ── Rating ────────────────────────────────────────────────────
  if (field.type === 'rating') {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return '⭐'.repeat(Math.min(5, Math.max(1, Math.round(n))));
  }

  // ── Mood ──────────────────────────────────────────────────────
  if (field.type === 'mood_emoji') {
    const moods = ['😭', '😟', '😐', '🙂', '😄'];
    const n = Number(value);
    return moods[n - 1] || '😐';
  }

  // ── Photo ─────────────────────────────────────────────────────
  if (field.type === 'photo') {
    if (Array.isArray(value)) {
      const count = (value as unknown[])
        .flat(Infinity)
        .filter(
          (v) =>
            typeof v === 'string' ||
            (v && typeof v === 'object' && typeof (v as any).uri === 'string')
        ).length;
      if (count === 0) return null;
      return `📷 ${count} photo${count !== 1 ? 's' : ''}`;
    }
    if (typeof value === 'string' && value.length > 0) {
      return '📷 1 photo';
    }
    return null;
  }

  // ── Quantity / measurement with unit ──────────────────────────
  if (field.type === 'quantity' || field.type === 'measurement' || field.type === 'number') {
    // Check for a unit stored alongside the field
    const unitKey = `${field.id}_unit`;
    const unit = (entryData[unitKey] as string) || field.unit || '';
    const num = Number(value);
    
    // Guard: don't display NaN or Infinity
    if (Number.isFinite(num)) {
      // Round to reasonable precision (max 2 decimals)
      const displayNum = Number.isInteger(num) ? num : Math.round(num * 100) / 100;
      return unit ? `${displayNum} ${unit}` : String(displayNum);
    }
    return unit ? `${value} ${unit}` : String(value);
  }

  // ── Temperature ───────────────────────────────────────────────
  if (field.type === 'temperature') {
    const unitKey = `${field.id}_unit`;
    const unit = (entryData[unitKey] as string) || 'celsius';
    const unitLabel = unit === 'fahrenheit' ? '°F' : '°C';
    const num = Number(value);
    if (Number.isFinite(num)) return `${num}${unitLabel}`;
    return `${value}${unitLabel}`;
  }

  // ── Datetime / time ──────────────────────────────────────────
  if (field.type === 'datetime' || field.type === 'date') {
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      return format(d, field.type === 'date' ? 'MMM d' : 'MMM d, h:mm a');
    } catch {
      return String(value);
    }
  }

  // ── Text / default ────────────────────────────────────────────
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return null;
  }
  return String(value);
};

export const TrackerEntryCard: React.FC<TrackerEntryCardProps> = ({
  entry,
  onPress,
  onEdit,
  onDelete,
  showActions = false,
  compact = false,
  index = 0,
}) => {
  const { getTracker } = useTracker();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    fontSizeMultiplier,
    triggerHaptic,
  } = useCustomization();

  const tracker = getTracker(entry.trackerId);
  const entryDate = new Date(entry.timestamp);
  const isToday = new Date().toDateString() === entryDate.toDateString();

  const timeString = useMemo(() => {
    try {
      return format(entryDate, 'h:mm a');
    } catch {
      return '';
    }
  }, [entryDate]);

  const dateString = useMemo(() => {
    try {
      if (isToday) return 'Today';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (entryDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return format(entryDate, 'MMM d');
    } catch {
      return '';
    }
  }, [entryDate, isToday]);

  // ── Ongoing status detection ──────────────────────────────────────
  const isOngoing = useMemo(() => {
    // Only sleep and feed (and dream_feed) support ongoing status
    const ongoingTrackers = ['sleep', 'feed', 'dream_feed', 'nap'];
    if (!ongoingTrackers.includes(entry.trackerId)) return false;

    // Explicit status field wins
    const status = entry.data?.status;
    if (status === 'ongoing') return true;
    if (status === 'completed') return false;

    // If startTime exists but endTime is missing → ongoing
    const hasStart = entry.data?.startTime && String(entry.data.startTime).length > 0;
    const hasEnd = entry.data?.endTime && String(entry.data.endTime).length > 0;
    if (hasStart && !hasEnd) return true;

    return false;
  }, [entry.trackerId, entry.data]);

  // ── Compact card ──────────────────────────────────────────────────
  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactCard,
          {
            backgroundColor: fullThemeColors.glassBg,
            borderColor: fullThemeColors.border,
            borderRadius: borderRadiusValue,
          },
        ]}
        onPress={() => onPress?.(entry)}
        activeOpacity={0.7}
      >
        <Text style={styles.compactEmoji}>{tracker?.emoji || '📝'}</Text>
        <View style={styles.compactContent}>
          <Text
            style={[
              styles.compactTitle,
              { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier },
            ]}
            numberOfLines={1}
          >
            {entry.title || tracker?.name || 'Entry'}
          </Text>
          <Text
            style={[
              styles.compactTime,
              { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier },
            ]}
          >
            {isOngoing ? 'Ongoing' : timeString}
          </Text>
        </View>
        {isOngoing && (
          <View style={[styles.ongoingDot, { backgroundColor: tracker?.color || themeColors.primary }]} />
        )}
        {Array.isArray(entry.photoUris) && entry.photoUris.length > 0 && (
          <View style={styles.photoIndicator}>
            <Ionicons name="image" size={12} color={fullThemeColors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────
  const renderDataPreview = () => {
    if (!tracker || !entry.data || typeof entry.data !== 'object') return null;

    // Skip fields that are already in the title or are internal
    const INTERNAL_FIELDS = new Set([
      'status', 'startTime', 'endTime', 'duration',
      'sleepType', 'feedType', 'title',
    ]);

    const previewFields = (tracker.fields || [])
      .filter((f: any) => !INTERNAL_FIELDS.has(f.id))
      .slice(0, 3);

    return (
      <View style={styles.dataPreview}>
        {previewFields.map((field) => {
          const displayValue = getFieldDisplayValue(field, entry.data);
          if (!displayValue) return null;

          return (
            <View
              key={field.id}
              style={[
                styles.dataChip,
                {
                  backgroundColor: fullThemeColors.glassBg,
                  borderColor: fullThemeColors.border,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
            >
              <Text style={[styles.dataChipLabel, { color: fullThemeColors.textSecondary }]}>
                {field.label}:
              </Text>
              <Text
                style={[styles.dataChipValue, { color: fullThemeColors.text }]}
                numberOfLines={1}
              >
                {displayValue}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: fullThemeColors.glassBg,
          borderRadius: borderRadiusValue,
          borderColor: isOngoing
            ? tracker?.color || themeColors.primary
            : fullThemeColors.border,
          borderLeftColor: tracker?.color || themeColors.primary,
          borderLeftWidth: isOngoing ? 6 : 4,
        },
      ]}
      onPress={() => onPress?.(entry)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${tracker?.color || themeColors.primary}15` },
            ]}
          >
            <Text style={styles.emoji}>{tracker?.emoji || '📝'}</Text>
          </View>
          <View style={styles.titleContent}>
            <Text
              style={[
                styles.title,
                { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
              ]}
              numberOfLines={1}
            >
              {entry.title || tracker?.name || 'Entry'}
            </Text>
            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.metaText,
                  { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier },
                ]}
              >
                {dateString} • {timeString}
              </Text>
              {entry.loggedByName && (
                <Text
                  style={[
                    styles.metaText,
                    { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier },
                  ]}
                >
                  • {entry.loggedByName}
                </Text>
              )}
            </View>
          </View>
        </View>

        {showActions && (onEdit || onDelete) && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  onEdit(entry);
                }}
                style={[styles.actionBtn, { backgroundColor: fullThemeColors.surface }]}
              >
                <Ionicons name="create-outline" size={18} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('warning');
                  onDelete(entry);
                }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: `${fullThemeColors.error || '#ef4444'}15` },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={fullThemeColors.error || '#ef4444'}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Ongoing badge for sleep/feed */}
      {isOngoing && (
        <View
          style={[
            styles.ongoingBadge,
            { backgroundColor: `${tracker?.color || themeColors.primary}15` },
          ]}
        >
          <View
            style={[
              styles.ongoingPulse,
              { backgroundColor: tracker?.color || themeColors.primary },
            ]}
          />
          <Text
            style={[
              styles.ongoingText,
              {
                color: tracker?.color || themeColors.primary,
                fontSize: 12 * fontSizeMultiplier,
              },
            ]}
          >
            Ongoing
          </Text>
          {entry.data?.startTime && (
            <Text
              style={[
                styles.ongoingSince,
                {
                  color: fullThemeColors.textSecondary,
                  fontSize: 11 * fontSizeMultiplier,
                },
              ]}
            >
              since{' '}
              {(() => {
                try {
                  return format(new Date(String(entry.data.startTime)), 'h:mm a');
                } catch {
                  return '';
                }
              })()}
            </Text>
          )}
        </View>
      )}

      {renderDataPreview()}

      {entry.notes && (
        <Text
          style={[
            styles.notes,
            { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier },
          ]}
          numberOfLines={2}
        >
          {entry.notes}
        </Text>
      )}

      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {entry.tags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={[
                styles.tagChip,
                { backgroundColor: `${themeColors.primary}15`, borderRadius: borderRadiusValue / 2 },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: themeColors.primary, fontSize: 11 * fontSizeMultiplier },
                ]}
              >
                #{tag}
              </Text>
            </View>
          ))}
          {entry.tags.length > 3 && (
            <Text
              style={[
                styles.moreTags,
                { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier },
              ]}
            >
              +{entry.tags.length - 3} more
            </Text>
          )}
        </View>
      )}

      {(() => {
        // Defensive: photoUris might be string[] OR PhotoMeta[] OR contain nested junk
        const raw = entry.photoUris;
        const flatUris: string[] = Array.isArray(raw)
          ? (raw as unknown[])
              .flat(Infinity)
              .map((u) =>
                typeof u === 'string'
                  ? u
                  : u && typeof u === 'object' && typeof (u as any).uri === 'string'
                  ? (u as any).uri
                  : ''
              )
              .filter((u): u is string => typeof u === 'string' && u.length > 0)
          : [];

        if (flatUris.length === 0) return null;

        return (
          <View style={styles.photoStrip}>
            {flatUris.slice(0, 3).map((uri, idx) => (
              <Image
                key={`${uri}-${idx}`}
                source={{ uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ))}
            {flatUris.length > 3 && (
              <View style={[styles.photoCount, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Text style={styles.photoCountText}>+{flatUris.length - 3}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {entry.editedAt && (
        <Text
          style={[
            styles.editedText,
            { color: fullThemeColors.textSecondary, fontSize: 10 * fontSizeMultiplier },
          ]}
        >
          Edited
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: { fontSize: 20 },
  titleContent: { flex: 1 },
  title: { fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 8 },

  // ── Ongoing badge ─────────────────────────────────────────────
  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  ongoingPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ongoingText: {
    fontWeight: '700',
  },
  ongoingSince: {
    fontWeight: '500',
    marginLeft: 2,
  },

  // ── Compact ───────────────────────────────────────────────────
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
  },
  compactEmoji: { fontSize: 24, marginRight: 10 },
  compactContent: { flex: 1 },
  compactTitle: { fontWeight: '600' },
  compactTime: { marginTop: 2, fontWeight: '500' },
  photoIndicator: { marginLeft: 8 },
  ongoingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },

  // ── Data preview ──────────────────────────────────────────────
  dataPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  dataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  dataChipLabel: { fontSize: 11, fontWeight: '500' },
  dataChipValue: { fontSize: 12, fontWeight: '600', maxWidth: 140, marginLeft: 4 },

  // ── Notes / tags ──────────────────────────────────────────────
  notes: {
    marginTop: 10,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { fontWeight: '600' },
  moreTags: { fontWeight: '500', alignSelf: 'center' },

  // ── Photos ────────────────────────────────────────────────────
  photoStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoCount: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  editedText: { fontStyle: 'italic', marginTop: 8 },
});

export default TrackerEntryCard;