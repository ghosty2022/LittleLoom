import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
import { useNavigation } from '@react-navigation/native';

import { useGrowthIntelligence, SubScore } from '../../hooks/useGrowthIntelligence';
import { useCustomization } from '../../hooks/useCustomization';

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
  radius: { sm: 10, md: 14, lg: 18, xl: 24, full: 999 },
};

const getEmojiForLabel = (label: string): string => {
  const map: Record<string, string> = {
    Nutrition: '🍎',
    Rest: '😴',
    Physical: '💪',
    Cognitive: '🧠',
    Health: '❤️',
  };
  return map[label] || '📊';
};

const getScoreColor = (v: number): string => {
  if (v >= 85) return DS.success;
  if (v >= 70) return DS.warning;
  if (v >= 50) return '#fb923c'; 
  return DS.danger;
};

/* ─── Sub score bar ──────────────────────────────────────────────── */
const SubScoreBar: React.FC<{ score: SubScore; index: number; isDark: boolean }> = ({
  score,
  index,
  isDark,
}) => {
  const { fullThemeColors, fontSizeMultiplier } = useCustomization();
  const color = score.color || getScoreColor(score.value);

  return (
    <Animated.View entering={FadeInUp.delay(index * 60)} style={styles.subScoreRow}>
      <View style={[styles.subScoreIcon, { backgroundColor: `${color}18` }]}>
        <Text style={styles.subScoreEmoji}>{getEmojiForLabel(score.label)}</Text>
      </View>
      <View style={styles.subScoreInfo}>
        <View style={styles.subScoreTopLine}>
          <Text
            style={[
              styles.subScoreLabel,
              { color: fullThemeColors.text, fontSize: 13 * fontSizeMultiplier },
            ]}
          >
            {score.label}
          </Text>
          <Text style={[styles.subScoreValue, { color }]}>
            {score.value}
          </Text>
        </View>
        <View style={[styles.subScoreBarBg, { backgroundColor: fullThemeColors.border }]}>
          <View
            style={[
              styles.subScoreBarFill,
              {
                width: `${Math.min(100, score.value)}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
        <View style={styles.subScoreBottomLine}>
          <Text style={[styles.subScoreTrend, { color: fullThemeColors.textSecondary }]}>
            {score.trend === 'up' ? '↑' : score.trend === 'down' ? '↓' : '→'}{' '}
            {score.delta > 0 ? '+' : ''}{score.delta}
          </Text>
          <Text style={[styles.subScoreWeight, { color: fullThemeColors.textSecondary }]}>
            {Math.round(score.weight * 100)}% weight
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

/* ─── Velocity chip ──────────────────────────────────────────────── */
const VelocityChip: React.FC<{
  label: string;
  value: number;
  unit: string;
  percentile: number;
  color: string;
  isDark: boolean;
}> = ({ label, value, unit, percentile, color, isDark }) => {
  const { fullThemeColors } = useCustomization();
  return (
    <View style={[styles.velocityChip, { backgroundColor: `${color}12`, borderColor: `${color}30` }]}>
      <Text style={[styles.velocityLabel, { color }]}>{label}</Text>
      <Text style={[styles.velocityValue, { color: isDark ? DS.white : '#292524' }]}>
        {value > 0 ? value.toFixed(1) : '—'}
        <Text style={[styles.velocityUnit, { color: fullThemeColors.textSecondary }]}> {unit}</Text>
      </Text>
      <Text style={[styles.velocityPercentile, { color: fullThemeColors.textSecondary }]}>
        {percentile}th %ile
      </Text>
    </View>
  );
};

/* ─── Main ───────────────────────────────────────────────────────── */
export const GrowthIndexCard: React.FC = () => {
  const navigation = useNavigation<any>();
  const { fullThemeColors, themeColors, borderRadiusValue, fontSizeMultiplier, isDark } = useCustomization();
  const { growthIndex } = useGrowthIntelligence();

  if (!growthIndex) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: fullThemeColors.surface,
            borderColor: fullThemeColors.border,
            borderRadius: borderRadiusValue,
            minHeight: 140,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }}>
          Loading growth data…
        </Text>
      </View>
    );
  }

  const composite = growthIndex.compositeIndex ?? 0;
  const compositeColor = getScoreColor(composite);

  const subScores = [
    growthIndex.nutritionScore,
    growthIndex.restScore,
    growthIndex.physicalScore,
    growthIndex.cognitiveScore,
    growthIndex.healthStability,
  ].filter(Boolean) as SubScore[];

  const subscoreCount = subScores.length;

  return (
    <Animated.View
      entering={FadeInUp}
      style={[
        styles.card,
        {
          backgroundColor: fullThemeColors.surface,
          borderColor: fullThemeColors.border,
          borderRadius: borderRadiusValue,
        },
      ]}
    >
      <LinearGradient
        colors={[`${compositeColor}12`, `${compositeColor}02`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ─── Compact pulse header (no hero) ────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: `${compositeColor}20` }]}>
            <Text style={{ fontSize: 22 }}>🧬</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
              Growth Index
            </Text>
            <Text style={[styles.headerSub, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
              {growthIndex.lastUpdated
                ? `Updated ${new Date(growthIndex.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Insights')}
            style={[styles.headerBtn, { backgroundColor: `${compositeColor}15` }]}
            hitSlop={8}
          >
            <Text style={[styles.headerBtnText, { color: compositeColor }]}>Insights</Text>
            <Ionicons name="chevron-forward" size={12} color={compositeColor} />
          </TouchableOpacity>
          <View style={[styles.scoreRing, { borderColor: compositeColor }]}>
            <Text style={[styles.scoreValue, { color: compositeColor, fontSize: 20 * fontSizeMultiplier }]}>
              {composite}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── Sub score carousel (horizontal to save space) ────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subScoreScroll}
      >
        {subScores.map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.subScoreCard,
              { backgroundColor: fullThemeColors.background, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue },
            ]}
          >
            <SubScoreBar score={s} index={i} isDark={isDark} />
          </View>
        ))}
      </ScrollView>

      {/* ─── Velocity row ───────────────────────────────────────── */}
      {growthIndex.velocityTrends && (
        <View style={styles.velocityRow}>
          <VelocityChip
            label="Height"
            value={growthIndex.velocityTrends.height?.perMonth || 0}
            unit="cm/mo"
            percentile={growthIndex.velocityTrends.height?.percentile || 0}
            color={themeColors?.primary || DS.primary}
            isDark={isDark}
          />
          <VelocityChip
            label="Weight"
            value={growthIndex.velocityTrends.weight?.perMonth || 0}
            unit="kg/mo"
            percentile={growthIndex.velocityTrends.weight?.percentile || 0}
            color={DS.accent}
            isDark={isDark}
          />
          <VelocityChip
            label="Head"
            value={growthIndex.velocityTrends.head?.perMonth || 0}
            unit="cm/mo"
            percentile={growthIndex.velocityTrends.head?.percentile || 0}
            color={DS.info}
            isDark={isDark}
          />
        </View>
      )}

      {/* ─── Milestone readiness strip ──────────────────────────── */}
      {growthIndex.milestoneReadiness && growthIndex.milestoneReadiness.length > 0 && (
        <View style={styles.readinessStrip}>
          <Text style={[styles.readinessTitle, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
            🎯 READINESS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {growthIndex.milestoneReadiness.map((r, idx) => {
              const pct = Math.max(0, Math.min(100, r.readinessPercent || 0));
              const color = pct > 80 ? DS.success : pct > 50 ? DS.warning : '#fb923c';
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() =>
                    navigation.navigate('AddEntry', {
                      trackerId: 'milestone',
                      presetData: { category: r.category },
                    })
                  }
                  style={[
                    styles.readinessChip,
                    { backgroundColor: `${color}10`, borderColor: `${color}35` },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.readinessCategory, { color }]}>
                    {r.category.charAt(0).toUpperCase() + r.category.slice(1)}
                  </Text>
                  <View style={[styles.readinessBarBg, { backgroundColor: `${color}20` }]}>
                    <View style={[styles.readinessBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.readinessPct, { color: fullThemeColors.textSecondary }]}>{pct}%</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Next checkup ───────────────────────────────────────── */}
      {growthIndex.predictedNextCheckup && (
        <View style={[styles.checkupRow, { backgroundColor: `${themeColors?.primary || DS.primary}10` }]}>
          <Ionicons name="calendar-outline" size={14} color={themeColors?.primary || DS.primary} />
          <Text style={[styles.checkupText, { color: fullThemeColors.text, fontSize: 12 * fontSizeMultiplier }]}>
            Next checkup: {growthIndex.predictedNextCheckup.toLocaleDateString()}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontWeight: '800', letterSpacing: -0.2 },
  headerSub: { fontWeight: '500', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerBtnText: { fontSize: 11, fontWeight: '700' },
  scoreRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { fontWeight: '800', letterSpacing: -0.5 },

  /* Sub scores */
  subScoreScroll: { gap: 8, paddingBottom: 4, paddingRight: 4 },
  subScoreCard: {
    width: 168,
    padding: 10,
    borderWidth: 1,
  },
  subScoreRow: { gap: 6 },
  subScoreIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subScoreEmoji: { fontSize: 15 },
  subScoreInfo: { gap: 4 },
  subScoreTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subScoreLabel: { fontWeight: '700', flex: 1 },
  subScoreValue: { fontSize: 14, fontWeight: '800' },
  subScoreBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  subScoreBarFill: { height: '100%', borderRadius: 2 },
  subScoreBottomLine: { flexDirection: 'row', justifyContent: 'space-between' },
  subScoreTrend: { fontSize: 10, fontWeight: '600' },
  subScoreWeight: { fontSize: 10, fontWeight: '500' },

  /* Velocity */
  velocityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  velocityChip: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  velocityLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  velocityValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  velocityUnit: { fontSize: 10, fontWeight: '600' },
  velocityPercentile: { fontSize: 9.5, fontWeight: '500', marginTop: 1 },

  /* Readiness */
  readinessStrip: { marginTop: 14, gap: 6 },
  readinessTitle: { fontWeight: '800', letterSpacing: 0.6 },
  readinessChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    minWidth: 110,
  },
  readinessCategory: { fontSize: 11.5, fontWeight: '700' },
  readinessBarBg: { height: 3, borderRadius: 2, overflow: 'hidden' },
  readinessBarFill: { height: '100%', borderRadius: 2 },
  readinessPct: { fontSize: 10, fontWeight: '600' },

  /* Checkup */
  checkupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  checkupText: { fontWeight: '600', flex: 1 },
});

export default GrowthIndexCard;