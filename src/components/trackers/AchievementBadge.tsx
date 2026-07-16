import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Achievement } from '../../hooks/';
import { useCustomization } from '../../hooks/useCustomization';

interface AchievementBadgeProps {
  achievement: Achievement;
  index: number;
  compact?: boolean;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement, index, compact = false }) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const rarityToTier: Record<string, string> = {
    common: 'bronze', rare: 'silver', epic: 'gold', legendary: 'platinum',
  };
  const tierColors: Record<string, [string, string]> = {
    bronze: ['#CD7F32', '#B87333'],
    silver: ['#C0C0C0', '#A8A8A8'],
    gold: ['#FFD700', '#DAA520'],
    platinum: ['#E5E4E2', '#B0B0B0'],
  };

  const tier = rarityToTier[achievement.rarity] || 'bronze';
  const colors = tierColors[tier];
  const isUnlocked = achievement.unlocked || !!achievement.unlockedAt;

  if (compact) {
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.compactContainer}>
        <View style={[styles.compactIcon, { backgroundColor: achievement.unlockedAt ? `${colors[0]}30` : fullThemeColors.glassBg }]}>
          <Text style={styles.compactEmoji}>{achievement.emoji}</Text>
          {achievement.unlockedAt && (
            <View style={[styles.tierDot, { backgroundColor: colors[0] }]} />
          )}
        </View>
        <Text style={[styles.compactTitle, { color: fullThemeColors.text, fontSize: 11 * fontSizeMultiplier }]} numberOfLines={1}>
          {achievement.title}
        </Text>
      </Animated.View>
    );
  }

  const progressPercent = (achievement.progress / achievement.maxProgress) * 100;

  return (
    <Animated.View entering={FadeInUp.delay(index * 100)} style={[
      styles.container,
      { 
        borderRadius: borderRadiusValue,
        opacity: achievement.unlockedAt ? 1 : 0.7,
        backgroundColor: achievement.unlockedAt ? `${colors[0]}08` : fullThemeColors.glassBg,
        borderColor: achievement.unlockedAt ? `${colors[0]}30` : fullThemeColors.border,
      }
    ]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: achievement.unlockedAt ? `${colors[0]}20` : fullThemeColors.surface }]}>
          <Text style={styles.emoji}>{achievement.emoji}</Text>
        </View>
        
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
              {achievement.title}
            </Text>
            {achievement.unlockedAt && (
              <View style={[styles.tierBadge, { backgroundColor: colors[0] }]}>
                <Text style={styles.tierText}>{tier.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.description, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
            {achievement.description}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBar, { backgroundColor: fullThemeColors.border }]}>
          <View style={[
            styles.progressFill,
            {
              width: `${progressPercent}%`,
              backgroundColor: achievement.unlockedAt ? colors[0] : fullThemeColors.textSecondary,
            }
          ]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: fullThemeColors.textSecondary }]}>
            {achievement.progress} / {achievement.maxProgress}
          </Text>
          <Text style={[styles.progressPercent, { color: achievement.unlockedAt ? colors[0] : fullThemeColors.textSecondary }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>
      </View>

      {/* Reward */}
      {isUnlocked && (
        <View style={[styles.rewardBadge, { backgroundColor: `${colors[0]}15` }]}>
          <Ionicons name="star" size={14} color={colors[0]} />
          <Text style={[styles.rewardText, { color: colors[0] }]}>
            +{achievement.points} points
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontWeight: '700',
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  description: {
    lineHeight: 18,
  },
  progressSection: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactContainer: {
    alignItems: 'center',
    width: 80,
    marginRight: 12,
  },
  compactIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  compactEmoji: {
    fontSize: 28,
  },
  tierDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  compactTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AchievementBadge;
