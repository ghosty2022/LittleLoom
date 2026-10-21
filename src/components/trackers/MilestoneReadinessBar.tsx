import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { MilestoneReadiness } from '../../hooks/useGrowthIntelligence';
import { useCustomization } from '../../hooks/useCustomization';

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
};

const CATEGORY_META: Record<string, { grad: [string, string]; emoji: string }> = {
  physical: { grad: ['#FF9F43', '#FFD700'], emoji: '🏃' },
  cognitive: { grad: ['#5F27CD', '#8B5CF6'], emoji: '🧠' },
  social: { grad: ['#10AC84', '#1DD1A1'], emoji: '👥' },
  language: { grad: ['#54A0FF', '#00D2D3'], emoji: '💬' },
  emotional: { grad: ['#FF6B6B', '#FF9FF3'], emoji: '❤️' },
};

const getMeta = (cat: string) => CATEGORY_META[cat] || { grad: [DS.primary, DS.accent] as [string, string], emoji: '🎯' };

interface MilestoneReadinessBarProps {
  readiness: MilestoneReadiness;
  index: number;
}

export const MilestoneReadinessBar: React.FC<MilestoneReadinessBarProps> = ({ readiness, index }) => {
  const navigation = useNavigation<any>();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const pct = Math.max(0, Math.min(100, Number(readiness.readinessPercent) || 0));
  const meta = getMeta(readiness.category);
  const accent = meta.grad[0];
  const activities = Array.isArray(readiness.suggestedActivities)
    ? readiness.suggestedActivities.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : [];
  const trackers = Array.isArray(readiness.relatedTrackerIds)
    ? readiness.relatedTrackerIds.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];

  return (
    <Animated.View entering={FadeInUp.delay(index * 80)} style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Insights', { focusCategory: readiness.category })}
        style={[
          styles.card,
          { backgroundColor: fullThemeColors.surface, borderColor: `${accent}35`, borderRadius: borderRadiusValue },
        ]}
      >
        <LinearGradient
          colors={[`${meta.grad[0]}10`, `${meta.grad[1]}03`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Left rail */}
        <LinearGradient
          colors={meta.grad}
          style={[styles.rail, { borderRadius: borderRadiusValue }]}
        />

        <View style={styles.body}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={meta.grad} style={styles.iconTile}>
              <Text style={styles.iconEmoji}>{meta.emoji}</Text>
            </LinearGradient>
            <View style={styles.headerInfo}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    { color: fullThemeColors.text, fontSize: 14.5 * fontSizeMultiplier },
                  ]}
                  numberOfLines={1}
                >
                  {readiness.category.charAt(0).toUpperCase() + readiness.category.slice(1)}
                </Text>
                <View style={[styles.pctPill, { backgroundColor: `${accent}18` }]}>
                  <Text style={[styles.pctText, { color: accent }]}>{pct}%</Text>
                </View>
              </View>
              <Text style={[styles.window, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
                Window {readiness.expectedWindow?.start ?? 0}–{readiness.expectedWindow?.end ?? 0}mo · Now {readiness.currentAge ?? 0}mo
              </Text>
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('AddEntry', {
                  trackerId: 'milestone',
                  presetData: { category: readiness.category },
                });
              }}
              style={[styles.logBtn, { backgroundColor: accent }]}
              hitSlop={8}
            >
              <Ionicons name="add" size={12} color="#fff" />
              <Text style={styles.logBtnText}>Log</Text>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: fullThemeColors.border }]}>
            <LinearGradient
              colors={pct > 80 ? meta.grad : pct > 50 ? ['#f59e0b', '#fbbf24'] : ['#94a3b8', '#cbd5e1']}
              style={[styles.progressFill, { width: `${pct}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>

          {/* Activities strip */}
          {activities.length > 0 && (
            <View style={styles.activitiesWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {activities.slice(0, 5).map((a, idx) => (
                  <View
                    key={`${a}-${idx}`}
                    style={[styles.activityChip, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}
                  >
                    <Ionicons name="sparkles" size={10} color={accent} />
                    <Text style={[styles.activityText, { color: accent }]} numberOfLines={1}>
                      {a}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trackers strip */}
          {trackers.length > 0 && (
            <View style={styles.trackersRow}>
              {trackers.slice(0, 4).map((tid) => (
                <TouchableOpacity
                  key={tid}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('AddEntry', { trackerId: tid });
                  }}
                  style={[styles.trackerChip, { backgroundColor: `${accent}14` }]}
                >
                  <Ionicons name="add-circle-outline" size={12} color={accent} />
                  <Text style={[styles.trackerText, { color: accent }]} numberOfLines={1}>
                    {tid.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: fullThemeColors.border }]}>
            <Text style={[styles.footerText, { color: fullThemeColors.textSecondary, fontSize: 11.5 * fontSizeMultiplier }]} numberOfLines={1}>
              {pct > 80
                ? '🌟 Ready to achieve'
                : pct > 50
                ? '👀 Keep practicing'
                : '⏰ Building foundation'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12 },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  rail: {
    width: 4,
    marginVertical: 12,
    marginLeft: 4,
  },
  body: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    gap: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 20 },
  headerInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', flexShrink: 1, letterSpacing: -0.2 },
  pctPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pctText: { fontSize: 11, fontWeight: '800' },
  window: { fontWeight: '500', marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  logBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  activitiesWrap: { marginTop: 2 },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 160,
  },
  activityText: { fontSize: 10.5, fontWeight: '600' },

  trackersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trackerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 140,
  },
  trackerText: { fontSize: 10.5, fontWeight: '600' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerText: { fontWeight: '500', flex: 1 },
});

export default MilestoneReadinessBar;