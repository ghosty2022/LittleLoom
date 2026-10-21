import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Achievement } from '../../hooks/useTrackerAchievements';
import { useCustomization } from '../../hooks/useCustomization';

/* ─── Aura DS ────────────────────────────────────────────────────── */
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
  gray600: '#57534e',
  radius: { sm: 10, md: 14, lg: 18, xl: 24, full: 999 },
};

const TIER_COLORS: Record<string, { grad: [string, string]; ring: string; label: string }> = {
  bronze: { grad: ['#CD7F32', '#8B5A2B'], ring: '#CD7F32', label: 'BRONZE' },
  silver: { grad: ['#C0C0C0', '#909090'], ring: '#C0C0C0', label: 'SILVER' },
  gold: { grad: ['#FFD700', '#DAA520'], ring: '#FFD700', label: 'GOLD' },
  platinum: { grad: ['#E5E4E2', '#A0A0A0'], ring: '#E5E4E2', label: 'PLATINUM' },
};

const RARITY_TO_TIER: Record<string, string> = {
  common: 'bronze',
  rare: 'silver',
  epic: 'gold',
  legendary: 'platinum',
};

interface AchievementBadgeProps {
  achievement: Achievement;
  index: number;
  compact?: boolean;
}

/* ─── Compact medallion ──────────────────────────────────────────── */
const CompactBadge: React.FC<{ achievement: Achievement; index: number; isDark: boolean }> = ({
  achievement,
  index,
  isDark,
}) => {
  const { fullThemeColors, fontSizeMultiplier } = useCustomization();
  const tier = RARITY_TO_TIER[achievement.rarity] || 'bronze';
  const colors = TIER_COLORS[tier];
  const unlocked = !!achievement.unlockedAt;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (unlocked) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })),
        -1,
        true
      );
    }
    return () => cancelAnimation(pulse);
  }, [unlocked, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: unlocked ? pulse.value : 1 }] }));

  return (
    <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.compactWrap}>
      <Animated.View style={pulseStyle}>
        <LinearGradient
          colors={unlocked ? colors.grad : ['rgba(160,160,160,0.2)', 'rgba(120,120,120,0.1)']}
          style={[styles.compactMedallion, !unlocked && { opacity: 0.55 }]}
        >
          <View style={styles.compactInner}>
            <Text style={styles.compactEmoji}>{achievement.emoji}</Text>
          </View>
          {unlocked && <View style={[styles.tierDot, { backgroundColor: colors.ring }]} />}
        </LinearGradient>
      </Animated.View>
      <Text
        style={[
          styles.compactTitle,
          { color: unlocked ? fullThemeColors.text : fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier },
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
    </Animated.View>
  );
};

/* ─── Full card ──────────────────────────────────────────────────── */
export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement, index, compact = false }) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier, isDark } = useCustomization();
  const tier = RARITY_TO_TIER[achievement.rarity] || 'bronze';
  const colors = TIER_COLORS[tier];
  const unlocked = !!achievement.unlockedAt;

  if (compact) return <CompactBadge achievement={achievement} index={index} isDark={isDark} />;

  const pct = achievement.maxProgress > 0 ? (achievement.progress / achievement.maxProgress) * 100 : 0;
  const clampedPct = Math.max(0, Math.min(100, pct));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80)}
      style={[
        styles.card,
        {
          borderRadius: borderRadiusValue,
          backgroundColor: fullThemeColors.surface,
          borderColor: unlocked ? `${colors.ring}45` : fullThemeColors.border,
          opacity: unlocked ? 1 : 0.88,
        },
      ]}
    >
      <LinearGradient
        colors={unlocked ? [`${colors.ring}14`, `${colors.ring}03`] : ['rgba(255,255,255,0.02)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Left tier rail */}
      <View
        style={[
          styles.tierRail,
          { backgroundColor: unlocked ? colors.ring : fullThemeColors.border, borderRadius: borderRadiusValue },
        ]}
      />

      <View style={styles.cardBody}>
        <View style={styles.header}>
          <LinearGradient
            colors={unlocked ? colors.grad : ['rgba(140,140,140,0.15)', 'rgba(100,100,100,0.08)']}
            style={styles.iconTile}
          >
            <Text style={[styles.emoji, !unlocked && { opacity: 0.5 }]}>{achievement.emoji}</Text>
          </LinearGradient>

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
                numberOfLines={1}
              >
                {achievement.title}
              </Text>
              {unlocked && (
                <LinearGradient colors={colors.grad} style={styles.tierPill}>
                  <Text style={styles.tierPillText}>{colors.label}</Text>
                </LinearGradient>
              )}
            </View>
            <Text
              style={[
                styles.description,
                { color: fullThemeColors.textSecondary, fontSize: 12.5 * fontSizeMultiplier },
              ]}
              numberOfLines={2}
            >
              {achievement.description}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: fullThemeColors.border }]}>
            <LinearGradient
              colors={unlocked ? colors.grad : [fullThemeColors.textSecondary, fullThemeColors.textSecondary]}
              style={[styles.progressFill, { width: `${clampedPct}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressNumbers, { color: fullThemeColors.textSecondary }]}>
              {achievement.progress} / {achievement.maxProgress}
            </Text>
            <Text
              style={[
                styles.progressPercent,
                { color: unlocked ? colors.ring : fullThemeColors.textSecondary },
              ]}
            >
              {Math.round(clampedPct)}%
            </Text>
          </View>
        </View>

        {unlocked && (achievement.points ?? 0) > 0 && (
          <View style={[styles.rewardBadge, { backgroundColor: `${colors.ring}18` }]}>
            <Ionicons name="star" size={13} color={colors.ring} />
            <Text style={[styles.rewardText, { color: colors.ring }]}>
              +{achievement.points} points
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  /* Full card */
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  tierRail: {
    width: 4,
    marginVertical: 10,
    marginLeft: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  info: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  title: { fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  description: { lineHeight: 17, fontWeight: '500' },

  progressSection: { marginTop: 12 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressNumbers: { fontSize: 11.5, fontWeight: '600' },
  progressPercent: { fontSize: 11.5, fontWeight: '800' },

  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  rewardText: { fontSize: 11.5, fontWeight: '700' },

  /* Compact */
  compactWrap: {
    alignItems: 'center',
    width: 84,
    marginRight: 12,
  },
  compactMedallion: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    padding: 3,
  },
  compactInner: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEmoji: { fontSize: 30 },
  tierDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  compactTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AchievementBadge;