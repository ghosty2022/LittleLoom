import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { TrackerEntry } from '../../types/trackers';

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  gray500: '#78716c',
  radius: { sm: 10, md: 14, lg: 18, full: 999 },
};

interface TrackerEntryCardProps {
  entry: TrackerEntry;
  onPress?: (entry: TrackerEntry) => void;
  onEdit?: (entry: TrackerEntry) => void;
  onDelete?: (entry: TrackerEntry) => void;
  showActions?: boolean;
  compact?: boolean;
  index?: number;
}

const formatDuration = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^\d+[hm](\s*\d+[m])?$/i.test(t) || /^\d+h\s*\d+m$/i.test(t)) return t;
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) return formatDuration(n);
    return null;
  }
  const s = Number(value);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s > 86400) return null;
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

const getFieldDisplayValue = (field: any, entryData: Record<string, unknown>): string | null => {
  const value = entryData[field.id];
  if (value === undefined || value === null || value === '') return null;

  if (field.type === 'toggle') return value ? 'Yes' : 'No';

  if (field.type === 'select' && field.options) {
    const opt = field.options.find((o: any) => o.id === value);
    return opt ? opt.label : String(value);
  }

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

  if (field.type === 'duration') return formatDuration(value);

  if (field.type === 'rating') {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return '⭐'.repeat(Math.min(5, Math.max(1, Math.round(n))));
  }

  if (field.type === 'mood_emoji') {
    const moods = ['😭', '😟', '😐', '🙂', '😄'];
    return moods[Number(value) - 1] || '😐';
  }

  if (field.type === 'photo') {
    if (Array.isArray(value)) {
      const count = (value as unknown[]).flat(Infinity).filter(
        (v) => typeof v === 'string' || (v && typeof v === 'object' && typeof (v as any).uri === 'string')
      ).length;
      if (count === 0) return null;
      return `📷 ${count} photo${count !== 1 ? 's' : ''}`;
    }
    if (typeof value === 'string' && value.length > 0) return '📷 1 photo';
    return null;
  }

  if (field.type === 'quantity' || field.type === 'measurement' || field.type === 'number') {
    const unitKey = `${field.id}_unit`;
    const unit = (entryData[unitKey] as string) || field.unit || '';
    const n = Number(value);
    if (Number.isFinite(n)) {
      const disp = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
      return unit ? `${disp} ${unit}` : String(disp);
    }
    if (typeof value === 'string' && value.trim().length > 0) return unit ? `${value} ${unit}` : value;
    return null;
  }

  if (field.type === 'temperature') {
    const unitKey = `${field.id}_unit`;
    const unit = (entryData[unitKey] as string) || 'celsius';
    const lbl = unit === 'fahrenheit' ? '°F' : '°C';
    const n = Number(value);
    return Number.isFinite(n) ? `${n}${lbl}` : `${value}${lbl}`;
  }

  if (field.type === 'datetime' || field.type === 'date') {
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      return format(d, field.type === 'date' ? 'MMM d' : 'MMM d, h:mm a');
    } catch {
      return String(value);
    }
  }

  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return null;
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
  const { fullThemeColors, themeColors, isDark, borderRadiusValue, fontSizeMultiplier, triggerHaptic } = useCustomization();

  const tracker = getTracker(entry.trackerId);
  const entryDate = new Date(entry.timestamp);
  const isToday = new Date().toDateString() === entryDate.toDateString();
  const accent = tracker?.color || themeColors?.primary || DS.primary;

  const timeString = useMemo(() => {
    try { return format(entryDate, 'h:mm a'); } catch { return ''; }
  }, [entryDate]);

  const dateString = useMemo(() => {
    try {
      if (isToday) return 'Today';
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      if (entryDate.toDateString() === yest.toDateString()) return 'Yesterday';
      return format(entryDate, 'MMM d');
    } catch {
      return '';
    }
  }, [entryDate, isToday]);

  const [nowTick, setNowTick] = useState(() => Date.now());

  const isOngoing = useMemo(() => {
    const ongoing = ['sleep', 'feed', 'dream_feed', 'nap'];
    if (!ongoing.includes(entry.trackerId)) return false;
    const d = entry.data || {};
    if (d.status === 'ongoing' || d.status === 'started') return true;
    if (d.status === 'completed' || d.status === 'ended') return false;
    const hasStart = d.startTime && String(d.startTime).length > 0;
    const hasEnd = d.endTime && String(d.endTime).length > 0;
    return !!(hasStart && !hasEnd);
  }, [entry.trackerId, entry.data]);

  useEffect(() => {
    if (!isOngoing) return;
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isOngoing]);

  /* ─── Compact variant ────────────────────────────────────────── */
  if (compact) {
    const durationFormatted = formatDuration(entry.data?.duration);
    const subtitle = isOngoing ? 'Ongoing' : durationFormatted || timeString;

    const photoCount = (() => {
      const raw = entry.photoUris;
      if (!Array.isArray(raw)) return 0;
      return (raw as unknown[]).flat(Infinity).filter((u) => {
        if (typeof u === 'string') return u.length > 0;
        if (u && typeof u === 'object' && typeof (u as any).uri === 'string') return (u as any).uri.length > 0;
        return false;
      }).length;
    })();

    return (
      <TouchableOpacity
        style={[
          styles.compactCard,
          {
            backgroundColor: fullThemeColors.surface,
            borderColor: isOngoing ? accent : fullThemeColors.border,
            borderRadius: borderRadiusValue,
            borderWidth: isOngoing ? 2 : 1,
          },
        ]}
        onPress={() => onPress?.(entry)}
        activeOpacity={0.75}
      >
        <View style={[styles.compactIconWrap, { backgroundColor: `${accent}15` }]}>
          <Text style={{ fontSize: 18 }}>{tracker?.emoji || '📝'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.compactTitle, { color: fullThemeColors.text, fontSize: 13 * fontSizeMultiplier }]}
            numberOfLines={1}
          >
            {entry.title || tracker?.name || 'Entry'}
          </Text>
          <Text
            style={[
              styles.compactSub,
              {
                color: isOngoing ? accent : fullThemeColors.textSecondary,
                fontSize: 10.5 * fontSizeMultiplier,
                fontWeight: isOngoing ? '700' : '500',
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        {isOngoing && <View style={[styles.ongoingDot, { backgroundColor: accent }]} />}
        {photoCount > 0 && (
          <View style={styles.photoIndicator}>
            <Ionicons name="image-outline" size={11} color={fullThemeColors.textSecondary} />
            {photoCount > 1 && (
              <Text style={{ color: fullThemeColors.textSecondary, fontSize: 9.5, marginLeft: 1, fontWeight: '700' }}>
                {photoCount}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  /* ─── Data preview ───────────────────────────────────────────── */
  const renderDataPreview = () => {
    if (!tracker || !entry.data || typeof entry.data !== 'object') return null;
    const SKIP = new Set(['status', 'startTime', 'endTime', 'duration', 'sleepType', 'feedType', 'title', 'side', 'measurementType', 'unit', 'value_unit', 'bottleAmount_unit', 'solidAmount_unit']);
    const PRIORITY = ['bottleAmount', 'solidAmount', 'amount', 'value', 'quality', 'mood', 'severity', 'temperature', 'food', 'name', 'dosage', 'symptoms', 'color', 'consistency', 'location', 'method'];

    const fields = (tracker.fields || [])
      .filter((f: any) => !SKIP.has(f.id))
      .filter((f: any) => {
        const v = entry.data[f.id];
        return v !== undefined && v !== null && v !== '';
      })
      .sort((a: any, b: any) => {
        const ai = PRIORITY.indexOf(a.id);
        const bi = PRIORITY.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .slice(0, 3);

    if (fields.length === 0) return null;

    return (
      <View style={styles.dataPreview}>
        {fields.map((field) => {
          const val = getFieldDisplayValue(field, entry.data);
          if (!val) return null;
          return (
            <View
              key={field.id}
              style={[styles.dataChip, { backgroundColor: fullThemeColors.background, borderColor: fullThemeColors.border }]}
            >
              <Text style={[styles.dataChipLabel, { color: fullThemeColors.textSecondary }]}>
                {field.label}
              </Text>
              <Text style={[styles.dataChipValue, { color: fullThemeColors.text }]} numberOfLines={1}>
                {val}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  /* ─── Photo strip ──────────────────────────────────────────────── */
  const photoUris = useMemo(() => {
    const raw = entry.photoUris;
    if (!Array.isArray(raw)) return [];
    const flat = (raw as unknown[]).flat(Infinity).map((u) => {
      if (typeof u === 'string') return u;
      if (u && typeof u === 'object') {
        const o = u as any;
        return typeof o.publicUrl === 'string' ? o.publicUrl : typeof o.uri === 'string' ? o.uri : '';
      }
      return '';
    }).filter((u): u is string => typeof u === 'string' && u.length > 0);
    return [...new Set(flat)];
  }, [entry.photoUris]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: fullThemeColors.surface,
          borderColor: fullThemeColors.border,
          borderRadius: borderRadiusValue,
        },
      ]}
      onPress={() => onPress?.(entry)}
      activeOpacity={0.85}
    >
      {/* Left accent rail */}
      <View style={[styles.rail, { backgroundColor: accent, borderRadius: borderRadiusValue }]} />

      <View style={styles.cardBody}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}15` }]}>
            <Text style={{ fontSize: 20 }}>{tracker?.emoji || '📝'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.title, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}
              numberOfLines={1}
            >
              {entry.title || tracker?.name || 'Entry'}
            </Text>
            <Text
              style={[styles.meta, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}
              numberOfLines={1}
            >
              {dateString} · {timeString}
              {entry.loggedByName ? ` · ${entry.loggedByName}` : ''}
            </Text>
          </View>

          {showActions && (onEdit || onDelete) && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity
                  onPress={() => { triggerHaptic('light'); onEdit(entry); }}
                  style={[styles.actionBtn, { backgroundColor: fullThemeColors.background }]}
                >
                  <Ionicons name="create-outline" size={16} color={fullThemeColors.textSecondary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={() => { triggerHaptic('warning'); onDelete(entry); }}
                  style={[styles.actionBtn, { backgroundColor: `${DS.danger}12` }]}
                >
                  <Ionicons name="trash-outline" size={16} color={DS.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Ongoing pulse */}
        {isOngoing && (
          <View style={[styles.ongoingBadge, { backgroundColor: `${accent}12` }]}>
            <View style={[styles.ongoingPulseDot, { backgroundColor: accent }]} />
            <Text style={[styles.ongoingLabel, { color: accent, fontSize: 11 * fontSizeMultiplier }]}>
              Ongoing
            </Text>
            {entry.data?.startTime && (
              <Text style={[styles.ongoingSince, { color: fullThemeColors.textSecondary, fontSize: 10.5 * fontSizeMultiplier }]}>
                {(() => {
                  try {
                    const start = new Date(String(entry.data.startTime));
                    if (isNaN(start.getTime())) return '';
                    const lbl = format(start, 'h:mm a');
                    const mins = Math.max(0, Math.floor((nowTick - start.getTime()) / 60000));
                    if (mins < 1) return `since ${lbl}`;
                    const txt = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    return `since ${lbl} · ${txt}`;
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
            style={[styles.notes, { color: fullThemeColors.textSecondary, fontSize: 12.5 * fontSizeMultiplier }]}
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
                style={[styles.tagChip, { backgroundColor: `${accent}10` }]}
              >
                <Text style={[styles.tagText, { color: accent, fontSize: 10.5 * fontSizeMultiplier }]}>
                  #{tag}
                </Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <Text style={[styles.moreTags, { color: fullThemeColors.textSecondary, fontSize: 10.5 }]}>
                +{entry.tags.length - 3}
              </Text>
            )}
          </View>
        )}

        {photoUris.length > 0 && (
          <View style={styles.photoStrip}>
            {photoUris.slice(0, 3).map((uri, idx) => (
              <Image
                key={`${uri}-${idx}`}
                source={{ uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ))}
            {photoUris.length > 3 && (
              <View style={styles.photoCountOverlay}>
                <Text style={styles.photoCountText}>+{photoUris.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {entry.aiTags && entry.aiTags.length > 0 && (
          <View style={styles.aiTagRow}>
            <View style={[styles.aiTagChip, { backgroundColor: `${accent}10` }]}>
              <Ionicons name="sparkles" size={9} color={accent} />
              <Text style={[styles.aiTagText, { color: accent }]} numberOfLines={1}>
                {entry.aiTags[0]}
              </Text>
            </View>
            {entry.aiTags.length > 1 && (
              <Text style={[styles.aiTagMore, { color: fullThemeColors.textSecondary }]}>
                +{entry.aiTags.length - 1}
              </Text>
            )}
          </View>
        )}

        {entry.editedAt && (
          <Text style={[styles.editedText, { color: fullThemeColors.textSecondary, fontSize: 10 }]}>
            Edited
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rail: {
    width: 4,
    marginVertical: 10,
    marginLeft: 4,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    paddingLeft: 10,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', letterSpacing: -0.2 },
  meta: { fontWeight: '500', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 6, borderRadius: 8 },

  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  ongoingPulseDot: { width: 7, height: 7, borderRadius: 4 },
  ongoingLabel: { fontWeight: '800' },
  ongoingSince: { fontWeight: '500', marginLeft: 2 },

  dataPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  dataChipLabel: { fontSize: 10, fontWeight: '500' },
  dataChipValue: { fontSize: 11, fontWeight: '700', maxWidth: 130 },

  notes: { lineHeight: 18 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontWeight: '700' },
  moreTags: { fontWeight: '600', alignSelf: 'center' },

  photoStrip: { flexDirection: 'row', gap: 6, position: 'relative' },
  thumbnail: { width: 52, height: 52, borderRadius: 8 },
  photoCountOverlay: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  aiTagRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTagText: { fontSize: 9.5, fontWeight: '700', maxWidth: 110 },
  aiTagMore: { fontSize: 9.5, fontWeight: '600' },

  editedText: { fontStyle: 'italic', marginTop: 2 },

  /* Compact */
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
    minWidth: 140,
    borderWidth: 1,
    gap: 8,
  },
  compactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: { fontWeight: '700' },
  compactSub: { marginTop: 1 },
  ongoingDot: { width: 7, height: 7, borderRadius: 4 },
  photoIndicator: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
});

export default TrackerEntryCard;