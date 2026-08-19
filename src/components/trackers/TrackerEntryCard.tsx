// src/components/trackers/TrackerEntryCard.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks';
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

  const renderDataPreview = () => {
    if (!tracker || !entry.data || typeof entry.data !== 'object') return null;

    const previewFields = tracker.fields?.slice(0, 2) || [];
    return (
      <View style={styles.dataPreview}>
        {previewFields.map(field => {
          const value = entry.data[field.id];
          if (value === undefined || value === null || value === '') return null;

          let displayValue: string;
          if (field.type === 'toggle') {
            displayValue = value ? 'Yes' : 'No';
          } else if (field.type === 'select' && field.options) {
            const option = field.options.find(o => o.id === value);
            displayValue = option ? option.label : String(value);
          } else if (field.type === 'duration') {
            const mins = Math.floor(Number(value) / 60);
            displayValue = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
          } else if (field.type === 'rating') {
            displayValue = '⭐'.repeat(Number(value));
          } else if (field.type === 'mood_emoji') {
            const moods = ['😭', '😟', '😐', '🙂', '😄'];
            displayValue = moods[Number(value) - 1] || '😐';
          } else {
            displayValue = String(value);
            if (field.unit) displayValue += ` ${field.unit}`;
          }

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
              <Text style={[styles.dataChipValue, { color: fullThemeColors.text }]} numberOfLines={1}>
                {displayValue}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

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
          <Text style={[styles.compactTitle, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]} numberOfLines={1}>
            {entry.title || tracker?.name || 'Entry'}
          </Text>
          <Text style={[styles.compactTime, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
            {timeString}
          </Text>
        </View>
        {entry.photoUris && entry.photoUris.length > 0 && (
          <View style={styles.photoIndicator}>
            <Ionicons name="image" size={12} color={fullThemeColors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: fullThemeColors.glassBg,
          borderRadius: borderRadiusValue,
          borderColor: fullThemeColors.border,
          borderLeftColor: tracker?.color || themeColors.primary,
        },
      ]}
      onPress={() => onPress?.(entry)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${tracker?.color || themeColors.primary}15` }]}>
            <Text style={styles.emoji}>{tracker?.emoji || '📝'}</Text>
          </View>
          <View style={styles.titleContent}>
            <Text style={[styles.title, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]} numberOfLines={1}>
              {entry.title || tracker?.name || 'Entry'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
                {dateString} • {timeString}
              </Text>
              {entry.loggedByName && (
                <Text style={[styles.metaText, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
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
                onPress={() => { triggerHaptic('light'); onEdit(entry); }}
                style={[styles.actionBtn, { backgroundColor: fullThemeColors.surface }]}
              >
                <Ionicons name="create-outline" size={18} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => { triggerHaptic('warning'); onDelete(entry); }}
                style={[styles.actionBtn, { backgroundColor: `${fullThemeColors.error || '#ef4444'}15` }]}
              >
                <Ionicons name="trash-outline" size={18} color={fullThemeColors.error || '#ef4444'} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {renderDataPreview()}

      {entry.notes && (
        <Text style={[styles.notes, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]} numberOfLines={2}>
          {entry.notes}
        </Text>
      )}

      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {entry.tags.slice(0, 3).map(tag => (
            <View
              key={tag}
              style={[
                styles.tagChip,
                { backgroundColor: `${themeColors.primary}15`, borderRadius: borderRadiusValue / 2 },
              ]}
            >
              <Text style={[styles.tagText, { color: themeColors.primary, fontSize: 11 * fontSizeMultiplier }]}>
                #{tag}
              </Text>
            </View>
          ))}
          {entry.tags.length > 3 && (
            <Text style={[styles.moreTags, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
              +{entry.tags.length - 3} more
            </Text>
          )}
        </View>
      )}

      {entry.photoUris && entry.photoUris.length > 0 && (
        <View style={styles.photoStrip}>
          {entry.photoUris.slice(0, 3).map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
          ))}
          {entry.photoUris.length > 3 && (
            <View style={[styles.photoCount, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Text style={styles.photoCountText}>+{entry.photoUris.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {entry.editedAt && (
        <Text style={[styles.editedText, { color: fullThemeColors.textSecondary, fontSize: 10 * fontSizeMultiplier }]}>
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
    borderLeftWidth: 4,
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
  dataChipValue: { fontSize: 12, fontWeight: '600', maxWidth: 120, marginLeft: 4 },
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
});