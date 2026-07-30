import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTracker } from '../../context/TrackerContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { formatTimeShort, formatDateShort } from '@/utils/time';
import type { TrackerEntry } from '../../types/trackers';

interface TrackerEntryCardProps {
  entry: TrackerEntry;
  onPress?: (entry: TrackerEntry) => void;
  onEdit?: (entry: TrackerEntry) => void;
  onDelete?: (entry: TrackerEntry) => void;
  compact?: boolean;
}

export const TrackerEntryCard: React.FC<TrackerEntryCardProps> = ({
  entry,
  onPress,
  onEdit,
  onDelete,
  compact = false,
}) => {
  const { getTracker, canEditEntry, canDeleteEntry } = useTracker();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    fontSizeMultiplier,
    triggerHaptic,
  } = useCustomization();
  const { confirm, success } = useSweetAlert();
  const tracker = getTracker(entry.trackerId);

  const timeString = useMemo(() => formatTimeShort(entry.timestamp), [entry.timestamp]);
  const dateString = useMemo(() => formatDateShort(entry.timestamp), [entry.timestamp]);

  const handleDelete = () => {
    if (!onDelete) return;
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete "${entry.title}"? This cannot be undone.`,
      () => {
        onDelete(entry);
        success('Deleted', 'Entry removed successfully');
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  };

  const renderDataPreview = () => {
    if (!tracker || !entry.data || typeof entry.data !== 'object' || Array.isArray(entry.data)) return null;

    const previewFields = tracker.fields.slice(0, 3);
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
            displayValue = option ? `${option.emoji || ''} ${option.label}` : String(value);
          } else if (field.type === 'multiselect' && Array.isArray(value)) {
            displayValue = value.length > 0 ? `${value.length} selected` : '';
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
              <Text style={[styles.dataChipLabel, { color: fullThemeColors.textSecondary }]}>{field.label}:</Text>
              <Text style={[styles.dataChipValue, { color: fullThemeColors.text }]} numberOfLines={1}>{displayValue}</Text>
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
      >
        <Text style={styles.compactEmoji}>{tracker?.emoji || '📝'}</Text>
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]} numberOfLines={1}>
            {entry.title}
          </Text>
          <Text style={[styles.compactTime, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
            {timeString}
          </Text>
        </View>
        {entry.tags && entry.tags.length > 0 && (
          <View style={[styles.tagDot, { backgroundColor: themeColors.primary }]} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderLeftColor: tracker?.color || themeColors.primary,
          backgroundColor: fullThemeColors.glassBg,
          borderRadius: borderRadiusValue,
          borderColor: fullThemeColors.border,
        },
      ]}
      onPress={() => onPress?.(entry)}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={[styles.emoji, { fontSize: 28 * fontSizeMultiplier }]}>{tracker?.emoji || '📝'}</Text>
          <View style={styles.titleContent}>
            <Text style={[styles.title, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={[styles.subtitle, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
              {entry.loggedByName} • {dateString} at {timeString}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {canEditEntry(entry) && onEdit && (
            <TouchableOpacity
              onPress={() => { triggerHaptic('light'); onEdit(entry); }}
              style={[styles.actionBtn, { backgroundColor: fullThemeColors.surface }]}
            >
              <Ionicons name="create-outline" size={18} color={fullThemeColors.textSecondary} />
            </TouchableOpacity>
          )}
          {canDeleteEntry(entry) && onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              style={[styles.actionBtn, { backgroundColor: fullThemeColors.error + '15' }]}
            >
              <Ionicons name="trash-outline" size={18} color={fullThemeColors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Data Preview */}
      {renderDataPreview()}

      {/* Notes */}
      {entry.notes && (
        <Text style={[styles.notes, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]} numberOfLines={2}>
          {entry.notes}
        </Text>
      )}

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {entry.tags.map(tag => (
            <View
              key={tag}
              style={[
                styles.tagChip,
                { backgroundColor: `${themeColors.primary}15`, borderRadius: borderRadiusValue / 2 },
              ]}
            >
              <Text style={[styles.tagText, { color: themeColors.primary, fontSize: 11 * fontSizeMultiplier }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Edited indicator */}
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
    borderLeftWidth: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
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
  emoji: { marginRight: 12 },
  titleContent: { flex: 1 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
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
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
  },
  dataChipLabel: { fontSize: 11 },
  dataChipValue: { fontSize: 12, fontWeight: '600', maxWidth: 120 },
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
  },
  tagText: { fontWeight: '500' },
  editedText: {
    fontStyle: 'italic',
    marginTop: 8,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  compactEmoji: { fontSize: 24, marginRight: 10 },
  compactContent: { flex: 1 },
  compactTitle: { fontWeight: '600' },
  compactTime: { marginTop: 2 },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});

export default TrackerEntryCard;
