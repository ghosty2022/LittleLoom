import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { getTrackerVisual } from '../constants/trackerVisuals';
import { resolveLogger } from '../utils/entrySelectors';
import { SafeAvatar } from './SafeAvatar';

export const EntryRow = React.memo(function EntryRow({
  entry, isDark, onPress, onAvatarPress, members = [], showTime = true,
}: {
  entry: any; isDark: boolean; onPress?: () => void;
  onAvatarPress?: (member: any) => void;
  members?: any[]; showTime?: boolean;
}) {
  const cfg = getTrackerVisual(entry?.trackerId || entry?.type);
  const logger = resolveLogger(entry, members);
  const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <TouchableOpacity
        onPress={() => onAvatarPress?.(logger.member)}
        disabled={!logger.member || !onAvatarPress}
        activeOpacity={0.7}
      >
        {logger.avatar ? (
          <SafeAvatar avatar={logger.avatar} size={36} />
        ) : (
          <View style={[styles.iconBg, { backgroundColor: `${cfg.color}15` }]}>
            <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#1c1917' }]} numberOfLines={1}>
          {entry?.title || cfg.label}
        </Text>
        <Text style={[styles.meta, { color: isDark ? '#78716c' : '#a8a29e' }]} numberOfLines={1}>
          {showTime && ts ? `${format(ts, 'h:mm a')} • ` : ''}
          {logger.name}
          {logger.label ? ` (${logger.label})` : ''}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: `${cfg.color}12` }]}>
        <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  iconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '700' },
});