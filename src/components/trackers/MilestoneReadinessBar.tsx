import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useCustomization } from '@/hooks/useCustomization';
import { MilestoneReadiness } from '@/hooks/useGrowthIntelligence';

interface MilestoneReadinessBarProps {
  readiness: MilestoneReadiness;
  index: number;
}

export const MilestoneReadinessBar: React.FC<MilestoneReadinessBarProps> = ({ readiness, index }) => {
  const navigation = useNavigation();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const categoryColors: Record<string, [string, string]> = {
    physical: ['#FF9F43', '#FFD700'],
    cognitive: ['#5F27CD', '#8B5CF6'],
    social: ['#10AC84', '#1DD1A1'],
    language: ['#54A0FF', '#00D2D3'],
    emotional: ['#FF6B6B', '#FF9FF3'],
  };

  const colors = categoryColors[readiness.category] || ['#667eea', '#764ba2'];

  return (
    <Animated.View entering={FadeInUp.delay(index * 100)} style={styles.container}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: fullThemeColors.glassBg,
            borderColor: `${colors[0]}30`,
            borderRadius: borderRadiusValue,
            borderWidth: 1.5,
          },
        ]}
        onPress={() => navigation.navigate('AddEntry', {
          trackerId: 'milestone',
          presetData: { category: readiness.category },
        })}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[`${colors[0]}08`, `${colors[1]}04`]}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue }]}
        />

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors[0]}20` }]}>
            <Text style={styles.categoryEmoji}>
              {readiness.category === 'physical' ? '🏃' :
               readiness.category === 'cognitive' ? '🧠' :
               readiness.category === 'social' ? '👥' :
               readiness.category === 'language' ? '💬' : '❤️'}
            </Text>
          </View>
          <View style={styles.info}>
            <Text style={[styles.categoryLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
              {readiness.category.charAt(0).toUpperCase() + readiness.category.slice(1)} Milestone
            </Text>
            <Text style={[styles.windowText, { color: fullThemeColors.textSecondary }]}>
              Window: {readiness.expectedWindow.start}-{readiness.expectedWindow.end} mo • Now: {readiness.currentAge}mo
            </Text>
          </View>
          <View style={[styles.percentBadge, { backgroundColor: `${colors[0]}20` }]}>
            <Text style={[styles.percentText, { color: colors[0] }]}>
              {readiness.readinessPercent}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: fullThemeColors.border }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${readiness.readinessPercent}%`,
                backgroundColor: readiness.readinessPercent > 80 ? colors[0] :
                  readiness.readinessPercent > 50 ? colors[1] : '#94A3B8',
              },
            ]}
          />
        </View>

        {/* Suggested Activities */}
        <View style={styles.activitiesSection}>
          <Text style={[styles.activitiesTitle, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
            💡 Suggested Activities:
          </Text>
          <View style={styles.activitiesList}>
            {readiness.suggestedActivities.map((activity, idx) => (
              <View key={idx} style={[styles.activityChip, { backgroundColor: `${colors[0]}12` }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors[0]} />
                <Text style={[styles.activityText, { color: colors[0], fontSize: 12 * fontSizeMultiplier }]}>
                  {activity}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Related Trackers */}
        <View style={styles.trackersRow}>
          {readiness.relatedTrackerIds.map((trackerId) => (
            <TouchableOpacity
              key={trackerId}
              style={[styles.trackerChip, { backgroundColor: `${colors[0]}15` }]}
              onPress={() => navigation.navigate('AddEntry', { trackerId })}
            >
              <Ionicons name="add-circle" size={14} color={colors[0]} />
              <Text style={[styles.trackerText, { color: colors[0] }]}>
                Log {trackerId.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: fullThemeColors.textSecondary }]}>
            {readiness.readinessPercent > 80 ? '🌟 Ready to achieve! Tap to log milestone' :
             readiness.readinessPercent > 50 ? '👀 Keep practicing — milestone approaching' :
             '⏰ Early — build foundation skills'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors[0]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  categoryLabel: {
    fontWeight: '700',
  },
  windowText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  percentText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  activitiesSection: {
    marginBottom: 10,
  },
  activitiesTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  activityText: {
    fontWeight: '600',
  },
  trackersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  trackerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  trackerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});

export default MilestoneReadinessBar;
