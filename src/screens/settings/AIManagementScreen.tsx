import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Modal,
  Pressable,
  Dimensions,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';

import {
  getAllLearnedRanges,
  MetricKey,
  LearnedRange,
  resetLearningForBaby,
} from '../../services/ai/BayesianEngine';
import {
  isCollaborativeLearningEnabled,
  setCollaborativeLearningEnabled,
  isCohortContributionBlocked,
  deleteCohortContributions,
  unblockCohortContributions,
  getCohortPrior,
  ageToCohort,
} from '../../services/ai/CohortPriors';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

/* ═══════════════════════════════════════════════════════════════════════════
   METRIC METADATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface MetricMeta {
  label: string;
  shortLabel: string;
  emoji: string;
  unit: string;
  color: string;
  gradient: [string, string];
  category: 'vitals' | 'growth' | 'behavior' | 'feeding' | 'sleep';
  format: (v: number) => string;
  description: string;
}

const METRIC_META: Record<MetricKey, MetricMeta> = {
  temperature_c: { label: 'Temperature', shortLabel: 'Temp', emoji: '🌡️', unit: '°C', color: DS.danger, gradient: [DS.danger, '#f87171'], category: 'vitals', format: v => v.toFixed(2), description: 'Body temperature readings. Fever threshold is typically >38°C.' },
  feeding_ml: { label: 'Feeding Amount', shortLabel: 'Feed', emoji: '🍼', unit: 'ml', color: DS.warning, gradient: [DS.warning, '#fbbf24'], category: 'feeding', format: v => v.toFixed(0), description: 'Volume per feeding session. Adjusts to baby\'s growing appetite.' },
  feed_interval_min: { label: 'Feed Interval', shortLabel: 'Feed Gap', emoji: '⏱️', unit: 'min', color: '#fb923c', gradient: ['#fb923c', '#fdba74'], category: 'feeding', format: v => v.toFixed(0), description: 'Time between feeds. Decreases as baby grows.' },
  sleep_duration_min: { label: 'Sleep Duration', shortLabel: 'Sleep', emoji: '😴', unit: 'min', color: DS.secondary, gradient: [DS.secondary, '#a78bfa'], category: 'sleep', format: v => v.toFixed(0), description: 'Length of each sleep session. Varies by age and time of day.' },
  sleep_interval_min: { label: 'Sleep Interval', shortLabel: 'Wake Gap', emoji: '🌙', unit: 'min', color: DS.primary, gradient: [DS.primary, DS.primaryLight], category: 'sleep', format: v => v.toFixed(0), description: 'Wake windows between sleep periods. Longer as baby matures.' },
  diaper_interval_min: { label: 'Diaper Interval', shortLabel: 'Diaper', emoji: '🧷', unit: 'min', color: DS.info, gradient: [DS.info, '#38bdf8'], category: 'vitals', format: v => v.toFixed(0), description: 'Time between diaper changes. Helps predict needs.' },
  weight_kg: { label: 'Weight', shortLabel: 'Weight', emoji: '⚖️', unit: 'kg', color: DS.success, gradient: [DS.success, '#34d399'], category: 'growth', format: v => v.toFixed(2), description: 'Body weight measurements. Tracks growth velocity.' },
  height_cm: { label: 'Height', shortLabel: 'Height', emoji: '📏', unit: 'cm', color: '#14b8a6', gradient: ['#14b8a6', '#2dd4bf'], category: 'growth', format: v => v.toFixed(1), description: 'Length/height measurements. Key growth indicator.' },
  head_cm: { label: 'Head Circumference', shortLabel: 'Head', emoji: '🧠', unit: 'cm', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], category: 'growth', format: v => v.toFixed(1), description: 'Head circumference. Important for brain development.' },
  heart_rate_bpm: { label: 'Heart Rate', shortLabel: 'HR', emoji: '❤️', unit: 'bpm', color: DS.accent, gradient: [DS.accent, '#f472b6'], category: 'vitals', format: v => v.toFixed(0), description: 'Heart rate readings. Resting rate is higher in infants.' },
  blood_oxygen: { label: 'Blood Oxygen', shortLabel: 'SpO2', emoji: '🫁', unit: '%', color: DS.danger, gradient: [DS.danger, '#f87171'], category: 'vitals', format: v => v.toFixed(1), description: 'Oxygen saturation. Normal range is 95-100%.' },
  mood_score: { label: 'Mood Score', shortLabel: 'Mood', emoji: '😊', unit: '/5', color: '#fbbf24', gradient: ['#fbbf24', '#fcd34d'], category: 'behavior', format: v => v.toFixed(1), description: 'Baby\'s mood rating. Correlates with sleep and feeding.' },
  poop_interval_hr: { label: 'Poop Interval', shortLabel: 'Poop', emoji: '💩', unit: 'hr', color: '#8B4513', gradient: ['#8B4513', '#a0522d'], category: 'vitals', format: v => v.toFixed(1), description: 'Time between bowel movements. Varies by feeding type.' },
  wake_window_min: { label: 'Wake Window', shortLabel: 'Wake', emoji: '⏰', unit: 'min', color: DS.info, gradient: [DS.info, '#38bdf8'], category: 'sleep', format: v => v.toFixed(0), description: 'Optimal awake time before next sleep. Critical for overtiredness.' },
};

const ALL_METRICS: MetricKey[] = [
  'temperature_c', 'feeding_ml', 'feed_interval_min',
  'sleep_duration_min', 'sleep_interval_min', 'diaper_interval_min',
  'weight_kg', 'height_cm', 'head_cm', 'mood_score',
  'heart_rate_bpm', 'blood_oxygen', 'poop_interval_hr', 'wake_window_min',
];

const LEARNED_THRESHOLD = 15;
const PARTIAL_THRESHOLD = 5;

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface MetricRow {
  metric: MetricKey;
  range: LearnedRange;
}

interface CohortInfo {
  contributorCount: number;
  sampleCount: number;
  mu: number;
  sigma: number;
}

type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AIManagement'>;
type FilterCategory = 'all' | 'vitals' | 'growth' | 'behavior' | 'feeding' | 'sleep';

/* ═══════════════════════════════════════════════════════════════════════════
   AURA SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const GlassCard = React.memo(({ children, style, isDark, delay = 0, onPress }: any) => {
  const Wrapper = onPress ? PressableScale : View;
  const wrapperProps = onPress ? { onPress } : {};
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
      <Wrapper {...wrapperProps}>
        <LinearGradient
          colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {children}
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ─── AI Pulse Capsule ─── */
const AIPulse = React.memo<any>(({
  isDark, baby, stats, onExport, onRefresh,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const scoreColor = stats.healthScore >= 80 ? DS.success : stats.healthScore >= 60 ? DS.warning : stats.healthScore >= 40 ? '#fb923c' : DS.danger;
  const scoreLabel = stats.healthScore >= 80 ? 'Excellent' : stats.healthScore >= 60 ? 'Good' : stats.healthScore >= 40 ? 'Fair' : 'Learning';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.avatarGlow, { backgroundColor: `${DS.primary}35` }, glowStyle]} />
            <Animated.View style={[styles.avatarRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Text style={{ fontSize: 32 }}>🧠</Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                AI Learning
              </Text>
              <View style={[styles.livePill, { backgroundColor: `${scoreColor}18` }]}>
                <View style={[styles.liveDot, { backgroundColor: scoreColor }]} />
                <Text style={[styles.liveText, { color: scoreColor }]}>{scoreLabel}</Text>
              </View>
            </View>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {baby?.name || 'Baby'} · {stats.totalSamples} samples observed
            </Text>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.success }]}>{stats.learnedCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>learned</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.warning }]}>{stats.partialCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>learning</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.gray400 }]}>{stats.notStarted}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>pending</Text>
              </View>
            </View>
          </View>

          <PressableScale onPress={onExport} activeScale={0.9}>
            <View style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="share-outline" size={18} color={DS.primary} />
            </View>
          </PressableScale>
        </View>

        {/* Score strip */}
        <View style={[styles.scoreStrip, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.scoreRingWrap}>
            <View style={[styles.scoreRingBg, { borderColor: `${scoreColor}20` }]} />
            <View style={[styles.scoreRingFill, { borderColor: scoreColor, transform: [{ rotate: `${-45 + (stats.healthScore / 100) * 360}deg` }] }]} />
            <Text style={[styles.scoreRingValue, { color: scoreColor }]}>{stats.healthScore}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scoreLabel, { color: isDark ? DS.white : DS.gray900 }]}>AI Health Score</Text>
            <Text style={[styles.scoreSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {stats.totalSamples < 20 ? 'Keep logging to improve accuracy'
                : stats.totalSamples < 100 ? `${stats.totalSamples} samples learned`
                : `Personalized from ${stats.totalSamples} samples`}
            </Text>
          </View>
          <View style={[styles.confidenceBadge, { backgroundColor: `${scoreColor}15` }]}>
            <Text style={[styles.confidenceText, { color: scoreColor }]}>{Math.round(stats.avgConfidence * 100)}%</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Contextual Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98} disabled={!onPress}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── Sparkline ─── */
const Sparkline = ({ data, color, width = 50, height = 18 }: any) => {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data, 0.1);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * chartW,
    y: padding + chartH - ((v - minVal) / range) * chartH,
  }));
  return (
    <View style={{ width, height }}>
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const len = Math.sqrt(Math.pow(pt.x - prev.x, 2) + Math.pow(pt.y - prev.y, 2));
        const angle = (Math.atan2(pt.y - prev.y, pt.x - prev.x) * 180) / Math.PI;
        return (
          <View
            key={i}
            style={{
              position: 'absolute', left: prev.x, top: prev.y,
              width: len, height: 2, backgroundColor: color,
              transform: [{ translateY: -1 }, { rotate: `${angle}deg` }],
              transformOrigin: '0% 50%', borderRadius: 1, opacity: 0.7,
            }}
          />
        );
      })}
      {points.map((pt, i) => (
        <View key={`pt-${i}`} style={{
          position: 'absolute', left: pt.x - 2, top: pt.y - 2,
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: color, borderWidth: 1, borderColor: DS.white,
        }} />
      ))}
    </View>
  );
};

/* ─── Filter Chip ─── */
const FilterChip = React.memo(({ label, count, active, isDark, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[styles.filterChip, {
      backgroundColor: active ? DS.primary : (isDark ? DS.darkCard : DS.white),
      borderColor: active ? DS.primary : (isDark ? DS.darkBorder : DS.gray200),
    }]}
  >
    <Text style={[styles.filterChipText, { color: active ? DS.white : (isDark ? DS.gray300 : DS.gray700) }, active && { fontWeight: '700' }]}>
      {label}
    </Text>
    <View style={[styles.filterChipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${DS.primary}15` }]}>
      <Text style={[styles.filterChipCountText, { color: active ? DS.white : DS.primary }]}>{count}</Text>
    </View>
  </TouchableOpacity>
));

/* ─── Metric Row ─── */
const MetricRow = React.memo<any>(({ row, index, isDark, cohortInfo, onPress }) => {
  const meta = METRIC_META[row.metric];
  const samples = row.range?.samples || 0;
  const confidence = Math.round((row.range?.confidence || 0) * 100);

  let statusColor = DS.gray400;
  let statusLabel = 'Not started';
  let statusIcon = 'ellipse-outline';
  if (samples >= LEARNED_THRESHOLD) { statusColor = DS.success; statusLabel = 'Learned'; statusIcon = 'checkmark-circle'; }
  else if (samples >= PARTIAL_THRESHOLD) { statusColor = DS.warning; statusLabel = 'Learning'; statusIcon = 'hourglass'; }

  const progress = Math.min(100, (samples / LEARNED_THRESHOLD) * 100);
  const sparkData = samples >= PARTIAL_THRESHOLD
    ? [row.range.lower95, row.range.mean - row.range.stddev * 0.5, row.range.mean, row.range.mean + row.range.stddev * 0.5, row.range.upper95]
    : [];

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 40).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.metricCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
            <View style={[styles.metricIcon, { backgroundColor: `${meta.color}15` }]}>
              <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.metricLabel, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{meta.label}</Text>
              <Text style={[styles.metricMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {samples} sample{samples === 1 ? '' : 's'} · {confidence}% confidence
              </Text>
            </View>

            {sparkData.length >= 2 && (
              <Sparkline data={sparkData} color={meta.color} width={46} height={18} />
            )}

            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
              <Ionicons name={statusIcon as any} size={10} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={isDark ? DS.gray500 : DS.gray400} />
          </View>

          {samples >= PARTIAL_THRESHOLD && row.range && (
            <View style={[styles.rangeBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : `${meta.color}06` }]}>
              <View style={styles.rangeItem}>
                <Text style={[styles.rangeLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Mean</Text>
                <Text style={[styles.rangeValue, { color: isDark ? DS.gray200 : DS.gray800 }]}>
                  {meta.format(row.range.mean)} {meta.unit}
                </Text>
              </View>
              <View style={[styles.rangeDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.rangeItem}>
                <Text style={[styles.rangeLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>95% Range</Text>
                <Text style={[styles.rangeValue, { color: isDark ? DS.gray200 : DS.gray800 }]}>
                  {meta.format(row.range.lower95)} – {meta.format(row.range.upper95)}
                </Text>
              </View>
              {cohortInfo && cohortInfo.contributorCount > 0 && (
                <>
                  <View style={[styles.rangeDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: DS.secondary }]}>Cohort</Text>
                    <Text style={[styles.rangeValue, { color: DS.secondary }]}>
                      {cohortInfo.contributorCount} users
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `${statusColor}12` }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: statusColor }]} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ─── Metric Detail Modal ─── */
const MetricDetailModal = ({ visible, metric, range, cohortInfo, onClose, isDark }: any) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, SPRING_CONFIG); opacity.value = withTiming(1, { duration: 250 }); }
    else { scale.value = withTiming(0.9, { duration: 200 }); opacity.value = withTiming(0, { duration: 200 }); }
  }, [visible]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  if (!metric || !range) return null;
  const meta = METRIC_META[metric];
  const samples = range.samples || 0;
  const confidence = Math.round((range.confidence || 0) * 100);
  const isLearned = samples >= LEARNED_THRESHOLD;
  const isPartial = samples >= PARTIAL_THRESHOLD && samples < LEARNED_THRESHOLD;
  const statusColor = isLearned ? DS.success : isPartial ? DS.warning : DS.gray400;
  const statusLabel = isLearned ? 'Fully Learned' : isPartial ? 'Learning' : 'Not Started';
  const statusIcon = isLearned ? 'checkmark-circle' : isPartial ? 'hourglass' : 'ellipse-outline';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.modalCard, animStyle, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient colors={meta.gradient} style={styles.modalHeader}>
            <Text style={styles.modalEmoji}>{meta.emoji}</Text>
            <Text style={styles.modalTitle}>{meta.label}</Text>
            <View style={[styles.modalStatusBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name={statusIcon as any} size={12} color={DS.white} />
              <Text style={styles.modalStatusText}>{statusLabel}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={DS.white} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.modalDescription, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {meta.description}
            </Text>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: isDark ? DS.gray500 : DS.gray400 }]}>LEARNING PROGRESS</Text>
              <View style={[styles.modalProgressTrack, { backgroundColor: `${statusColor}15` }]}>
                <View style={[styles.modalProgressFill, { width: `${Math.min(100, (samples / LEARNED_THRESHOLD) * 100)}%`, backgroundColor: statusColor }]} />
              </View>
              <View style={styles.modalProgressLabels}>
                <Text style={[styles.modalProgressText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{samples} / {LEARNED_THRESHOLD} samples</Text>
                <Text style={[styles.modalProgressPercent, { color: statusColor }]}>{confidence}% confidence</Text>
              </View>
            </View>

            {samples >= PARTIAL_THRESHOLD && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: isDark ? DS.gray500 : DS.gray400 }]}>LEARNED STATISTICS</Text>
                <View style={styles.modalStatsGrid}>
                  {[
                    { label: 'Mean', value: `${meta.format(range.mean)} ${meta.unit}` },
                    { label: 'Std Dev', value: `± ${meta.format(range.stddev)} ${meta.unit}` },
                    { label: 'Lower 95%', value: `${meta.format(range.lower95)} ${meta.unit}` },
                    { label: 'Upper 95%', value: `${meta.format(range.upper95)} ${meta.unit}` },
                  ].map((stat, i) => (
                    <View key={i} style={[styles.modalStatCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : `${meta.color}08` }]}>
                      <Text style={[styles.modalStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{stat.label}</Text>
                      <Text style={[styles.modalStatValue, { color: isDark ? DS.gray200 : DS.gray900 }]}>{stat.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {cohortInfo && cohortInfo.contributorCount > 0 && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: isDark ? DS.gray500 : DS.gray400 }]}>COHORT BENCHMARK</Text>
                <View style={[styles.modalCohortCard, { backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : `${DS.secondary}08` }]}>
                  {[
                    { icon: 'people' as const, text: `${cohortInfo.contributorCount} contributor${cohortInfo.contributorCount !== 1 ? 's' : ''}` },
                    { icon: 'analytics' as const, text: `${cohortInfo.sampleCount} total samples` },
                    { icon: 'stats-chart' as const, text: `Cohort mean: ${meta.format(cohortInfo.mu)} ${meta.unit}` },
                  ].map((row, i) => (
                    <View key={i} style={styles.modalCohortRow}>
                      <Ionicons name={row.icon} size={14} color={DS.secondary} />
                      <Text style={[styles.modalCohortText, { color: isDark ? DS.gray300 : DS.gray700 }]}>{row.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: isDark ? DS.gray500 : DS.gray400 }]}>HOW IT WORKS</Text>
              {[
                `Every time you log ${meta.label.toLowerCase()}, the AI observes the value`,
                `It updates a Bayesian posterior — narrowing the "normal" range for your baby`,
                `After ${LEARNED_THRESHOLD}+ samples, anomalies can be flagged with high confidence`,
              ].map((text, i) => (
                <View key={i} style={styles.modalExplainerRow}>
                  <View style={[styles.modalExplainerDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.modalExplainerText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AIManagementScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ScreenNavigationProp>();
  const { currentBaby } = useBaby();
  const { userProfile } = useAuth();
  const { fullThemeColors, themeColors, isDark, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [collaborativeEnabled, setCollaborativeEnabled] = useState(false);
  const [cohortBlocked, setCohortBlocked] = useState(false);
  const [cohortInfoMap, setCohortInfoMap] = useState<Record<string, CohortInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [selectedRange, setSelectedRange] = useState<LearnedRange | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const loadMetrics = useCallback(async () => {
    if (!currentBaby?.id) return;
    try {
      const ranges = await getAllLearnedRanges(currentBaby.id, ALL_METRICS);
      setMetrics(ALL_METRICS.map((metric, i) => ({ metric, range: ranges[i] })));
    } catch (e) { if (__DEV__) console.warn('[AIManagement] loadMetrics failed:', e); }
  }, [currentBaby?.id]);

  const loadCohortInfo = useCallback(async () => {
    if (!currentBaby?.birthDate) return;
    try {
      const cohort = ageToCohort(currentBaby.birthDate);
      const infoMap: Record<string, CohortInfo> = {};
      for (const row of metrics) {
        if ((row.range?.samples || 0) >= PARTIAL_THRESHOLD) {
          try {
            const prior = await getCohortPrior(row.metric, cohort);
            if (prior) {
              infoMap[row.metric] = {
                contributorCount: prior.contributorCount,
                sampleCount: prior.sampleCount,
                mu: prior.mu,
                sigma: prior.sigma,
              };
            }
          } catch {}
        }
      }
      setCohortInfoMap(infoMap);
    } catch (e) { if (__DEV__) console.warn('[AIManagement] loadCohortInfo failed:', e); }
  }, [currentBaby?.birthDate, metrics]);

  const loadSettings = useCallback(async () => {
    try {
      const [collab, blocked] = await Promise.all([
        isCollaborativeLearningEnabled(),
        currentBaby?.id ? isCohortContributionBlocked(currentBaby.id) : Promise.resolve(false),
      ]);
      setCollaborativeEnabled(collab);
      setCohortBlocked(blocked);
    } catch {}
  }, [currentBaby?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadMetrics(), loadSettings()]);
    setLoading(false);
  }, [loadMetrics, loadSettings]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (metrics.length > 0) loadCohortInfo(); }, [metrics.length, loadCohortInfo]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleMetricPress = useCallback((metric: MetricKey) => {
    triggerHaptic('light');
    const row = metrics.find(m => m.metric === metric);
    if (row) {
      setSelectedMetric(metric);
      setSelectedRange(row.range);
      setDetailModalVisible(true);
    }
  }, [metrics, triggerHaptic]);

  const handleResetLearning = useCallback(() => {
    if (!currentBaby?.id) return;
    sweetAlert.confirm(
      'Reset AI Learning?',
      `This will erase all personalized learning for ${currentBaby.name}. The AI will start fresh with population priors.`,
      async () => {
        setResetting(true);
        try {
          await resetLearningForBaby(currentBaby.id);
          triggerHaptic('success');
          await loadAll();
          sweetAlert.success('Learning Reset', 'AI learning has been reset.');
        } catch { sweetAlert.error('Error', 'Failed to reset learning.'); }
        finally { setResetting(false); }
      },
      () => {},
      'Reset',
      'Cancel'
    );
  }, [currentBaby, loadAll, triggerHaptic, sweetAlert]);

  const handleEraseCohort = useCallback(() => {
    if (!currentBaby?.id || !userProfile?.id) { sweetAlert.warning('No Baby Selected', 'Select a baby first.'); return; }
    sweetAlert.confirm(
      'Erase Cohort Contributions?',
      'This removes your local AI caches and prevents future contributions to the shared cohort pool.',
      async () => {
        setErasing(true);
        try {
          const res = await deleteCohortContributions(currentBaby.id, userProfile.id);
          if (res.success) { triggerHaptic('success'); await loadSettings(); sweetAlert.success('Erased', res.message); }
          else sweetAlert.error('Error', res.message);
        } catch { sweetAlert.error('Error', 'Failed to erase contributions.'); }
        finally { setErasing(false); }
      },
      () => {},
      'Erase',
      'Cancel'
    );
  }, [currentBaby, userProfile, loadSettings, triggerHaptic, sweetAlert]);

  const handleUnblockCohort = useCallback(async () => {
    if (!currentBaby?.id || !userProfile?.id) { sweetAlert.warning('No Baby Selected', 'Select a baby first.'); return; }
    sweetAlert.confirm(
      'Unblock Cohort Contributions?',
      'This will re-enable sharing of anonymized statistical patterns for this baby.',
      async () => {
        setUnblocking(true);
        try {
          const res = await unblockCohortContributions(currentBaby.id, userProfile.id);
          if (res.success) {
            triggerHaptic('success');
            await loadSettings();
            try { const { bootstrapAI } = await import('../../services/ai/bootstrap'); bootstrapAI(currentBaby.id, true).catch(() => {}); } catch {}
            sweetAlert.success('Unblocked', res.message);
          } else sweetAlert.error('Error', res.message);
        } catch { sweetAlert.error('Error', 'Failed to unblock.'); }
        finally { setUnblocking(false); }
      },
      () => {},
      'Unblock',
      'Cancel'
    );
  }, [currentBaby, userProfile, loadSettings, triggerHaptic, sweetAlert]);

  const handleToggleCollaborative = useCallback(async (value: boolean) => {
    try {
      await setCollaborativeLearningEnabled(value);
      setCollaborativeEnabled(value);
      triggerHaptic(value ? 'success' : 'light');
      if (value && currentBaby?.id) {
        const { bootstrapAI } = await import('../../services/ai/bootstrap');
        bootstrapAI(currentBaby.id, true).catch(() => {});
      }
    } catch { sweetAlert.error('Error', 'Could not update the setting.'); }
  }, [currentBaby, triggerHaptic, sweetAlert]);

  const handleExportLearning = useCallback(async () => {
    if (!currentBaby?.id) return;
    try {
      const exportData = {
        babyId: currentBaby.id, babyName: currentBaby.name,
        exportedAt: new Date().toISOString(),
        metrics: metrics.map(row => ({
          metric: row.metric, label: METRIC_META[row.metric].label,
          samples: row.range?.samples || 0, confidence: row.range?.confidence || 0,
          mean: row.range?.mean, stddev: row.range?.stddev,
          lower95: row.range?.lower95, upper95: row.range?.upper95,
        })),
        collaborativeEnabled, cohortBlocked,
      };
      await Share.share({ message: JSON.stringify(exportData, null, 2), title: `${currentBaby.name} - AI Learning Data` });
      triggerHaptic('success');
    } catch (e) { if (__DEV__) console.warn('[AIManagement] Export failed:', e); }
  }, [currentBaby, metrics, collaborativeEnabled, cohortBlocked, triggerHaptic]);

  const stats = useMemo(() => {
    const totalSamples = metrics.reduce((sum, r) => sum + (r.range?.samples || 0), 0);
    const learnedCount = metrics.filter(r => (r.range?.samples || 0) >= LEARNED_THRESHOLD).length;
    const partialCount = metrics.filter(r => { const n = r.range?.samples || 0; return n >= PARTIAL_THRESHOLD && n < LEARNED_THRESHOLD; }).length;
    const notStarted = metrics.filter(r => (r.range?.samples || 0) < PARTIAL_THRESHOLD).length;
    const avgConfidence = metrics.length > 0 ? metrics.reduce((sum, r) => sum + (r.range?.confidence || 0), 0) / metrics.length : 0;
    const learningProgress = metrics.length > 0 ? (learnedCount / metrics.length) * 60 : 0;
    const confidenceScore = avgConfidence * 30;
    const sampleScore = Math.min(10, (totalSamples / 200) * 10);
    const healthScore = Math.round(learningProgress + confidenceScore + sampleScore);
    return { totalSamples, learnedCount, partialCount, notStarted, avgConfidence, healthScore };
  }, [metrics]);

  const categories: FilterCategory[] = useMemo(() => {
    const cats = new Set<FilterCategory>();
    metrics.forEach(m => cats.add(METRIC_META[m.metric].category as FilterCategory));
    return ['all', ...Array.from(cats)];
  }, [metrics]);

  const filteredMetrics = useMemo(() => {
    if (filterCategory === 'all') return metrics;
    return [...metrics].filter(m => METRIC_META[m.metric].category === filterCategory).sort((a, b) => (b.range?.samples || 0) - (a.range?.samples || 0));
  }, [metrics, filterCategory]);

  /* ─── Ribbon ─── */
  const topRibbon = useMemo(() => {
    if (cohortBlocked) return {
      icon: 'ban-outline' as const, color: DS.danger, label: 'Contribution blocked',
      text: 'GDPR erasure in effect — no cohort sharing. Tap to unblock',
      onPress: handleUnblockCohort,
    };
    if (stats.healthScore >= 80) return {
      icon: 'sparkles' as const, color: DS.success, label: 'Excellent',
      text: `${stats.learnedCount}/${metrics.length} metrics learned — AI is sharp`,
      onPress: undefined,
    };
    if (stats.learnedCount === 0) return {
      icon: 'bulb-outline' as const, color: DS.primary, label: 'Getting started',
      text: 'Log more entries to unlock personalized predictions',
      onPress: undefined,
    };
    return {
      icon: 'analytics-outline' as const, color: DS.warning, label: 'Learning',
      text: `${stats.learnedCount} learned · ${stats.partialCount} in progress`,
      onPress: undefined,
    };
  }, [cohortBlocked, stats, metrics.length, handleUnblockCohort]);

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="sparkles-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, color: isDark ? DS.gray400 : DS.gray500, fontSize: 16, fontWeight: '700' }}>No Baby Selected</Text>
        <Text style={{ marginTop: 6, color: isDark ? DS.gray500 : DS.gray400, fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 }}>
          Select a baby profile to view AI learning
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <LinearGradient colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>AI Learning</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {stats.learnedCount}/{metrics.length} metrics · {Math.round(stats.avgConfidence * 100)}% confidence
        </Text>
      </Animated.View>

      {/* Back */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <UniversalSpinner size={40} color={DS.primary} variant="liquid" section="settings" />
          <Text style={{ color: isDark ? DS.gray400 : DS.gray500, fontSize: 13, fontWeight: '600' }}>Loading learning data…</Text>
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
        >
          {/* AI Pulse Capsule */}
          <View style={{ paddingHorizontal: DS.space.lg }}>
            <AIPulse isDark={isDark} baby={currentBaby} stats={stats} onExport={handleExportLearning} onRefresh={onRefresh} />
          </View>

          {/* Ribbon */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <InsightRibbon isDark={isDark} {...topRibbon} />
          </View>

          {/* GDPR blocked banner (if applicable) */}
          {cohortBlocked && (
            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md }}>
                    <View style={[styles.gdprIcon, { backgroundColor: `${DS.danger}15` }]}>
                      <Ionicons name="ban" size={20} color={DS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gdprTitle, { color: DS.danger }]}>Cohort Contribution Blocked</Text>
                      <Text style={[styles.gdprSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={3}>
                        Previous GDPR erasure in effect. Local AI works, but no patterns are shared.
                      </Text>
                    </View>
                  </View>
                  <PressableScale onPress={handleUnblockCohort} disabled={unblocking} activeScale={0.97}>
                    <View style={[styles.unblockBtn, { backgroundColor: `${DS.primary}12` }]}>
                      {unblocking ? (
                        <UniversalSpinner size={16} color={DS.primary} variant="liquid" section="settings" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={15} color={DS.primary} />
                          <Text style={[styles.unblockText, { color: DS.primary }]}>Unblock & Re-enable</Text>
                        </>
                      )}
                    </View>
                  </PressableScale>
                </View>
              </GlassCard>
            </View>
          )}

          {/* Collaborative Learning */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <SectionHeader title="Collaborative Learning" subtitle="Share anonymized patterns" icon="people-circle-outline" color={DS.secondary} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                  <View style={[styles.settingIcon, { backgroundColor: `${DS.secondary}15` }]}>
                    <Ionicons name="globe-outline" size={20} color={DS.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                      {collaborativeEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Text style={[styles.settingSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
                      {collaborativeEnabled ? 'Anonymized stats shared — no personal data' : 'Data stays on this device only'}
                    </Text>
                  </View>
                  <Switch
                    value={collaborativeEnabled}
                    onValueChange={handleToggleCollaborative}
                    trackColor={{ false: isDark ? DS.gray700 : DS.gray300, true: `${DS.secondary}60` }}
                    thumbColor={collaborativeEnabled ? DS.secondary : (isDark ? DS.gray500 : DS.gray100)}
                  />
                </View>
                <View style={[styles.privacyNote, { backgroundColor: `${DS.primary}08` }]}>
                  <Ionicons name="shield-checkmark" size={14} color={DS.primary} />
                  <Text style={[styles.privacyNoteText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    Only metric names, statistical params, and age buckets leave your device. No names, IDs, or raw values.
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Category Filter */}
          <View style={{ marginTop: DS.space.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
              {categories.map(cat => {
                const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
                const count = cat === 'all' ? metrics.length : metrics.filter(m => METRIC_META[m.metric].category === cat).length;
                return (
                  <FilterChip key={cat} label={label} count={count} active={filterCategory === cat} isDark={isDark}
                    onPress={() => { triggerHaptic('light'); setFilterCategory(cat); }} />
                );
              })}
            </ScrollView>
          </View>

          {/* Metrics */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md, gap: 8 }}>
            <SectionHeader title="Learned Metrics" subtitle={`${filteredMetrics.length} in view`} icon="analytics-outline" color={DS.primary} />
            {filteredMetrics.map((row, index) => (
              <MetricRow key={row.metric} row={row} index={index} isDark={isDark}
                cohortInfo={cohortInfoMap[row.metric]} onPress={() => handleMetricPress(row.metric)} />
            ))}
            {filteredMetrics.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="analytics-outline" size={36} color={DS.gray400} />
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No metrics here</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Try a different category</Text>
              </View>
            )}
          </View>

          {/* Data Management */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg, gap: 10 }}>
            <SectionHeader title="Data Management" subtitle="Reset or erase learning" icon="server-outline" color={DS.warning} />

            <GlassCard isDark={isDark} onPress={handleResetLearning}>
              <View style={{ padding: DS.space.md, flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                <View style={[styles.settingIcon, { backgroundColor: `${DS.warning}15` }]}>
                  <Ionicons name="refresh" size={20} color={DS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: isDark ? DS.white : DS.gray900 }]}>Reset AI Learning</Text>
                  <Text style={[styles.settingSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                    Start fresh — AI will re-learn from scratch
                  </Text>
                </View>
                {resetting ? (
                  <UniversalSpinner size={18} color={DS.warning} variant="liquid" section="settings" />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                )}
              </View>
            </GlassCard>

            <GlassCard isDark={isDark} onPress={handleEraseCohort}>
              <View style={{ padding: DS.space.md, flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                <View style={[styles.settingIcon, { backgroundColor: `${DS.danger}15` }]}>
                  <Ionicons name="trash-bin-outline" size={20} color={DS.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: isDark ? DS.white : DS.gray900 }]}>Erase Cohort Contributions</Text>
                  <Text style={[styles.settingSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                    Remove local caches & block future sharing
                  </Text>
                </View>
                {erasing ? (
                  <UniversalSpinner size={18} color={DS.danger} variant="liquid" section="settings" />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                )}
              </View>
            </GlassCard>
          </View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}

      <MetricDetailModal
        visible={detailModalVisible}
        metric={selectedMetric}
        range={selectedRange}
        cohortInfo={selectedMetric ? cohortInfoMap[selectedMetric] : null}
        isDark={isDark}
        onClose={() => {
          setDetailModalVisible(false);
          setTimeout(() => { setSelectedMetric(null); setSelectedRange(null); }, 200);
        }}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Top header */
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  /* Capsule */
  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
  avatarRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  avatarInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  capsuleName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '60%' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  capsuleSub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { alignItems: 'center' },
  capsuleStatValue: { fontSize: 14, fontWeight: '800' },
  capsuleStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  capsuleStatDiv: { width: 1, height: 18 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Score strip */
  scoreStrip: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, marginTop: DS.space.md },
  scoreRingWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  scoreRingBg: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 4 },
  scoreRingFill: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  scoreRingValue: { fontSize: 16, fontWeight: '800' },
  scoreLabel: { fontSize: 13, fontWeight: '800' },
  scoreSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  confidenceText: { fontSize: 13, fontWeight: '800' },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 11, fontWeight: '700' },

  /* Glass card */
  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },

  /* GDPR */
  gdprIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  gdprTitle: { fontSize: 14, fontWeight: '800' },
  gdprSub: { fontSize: 11, fontWeight: '500', marginTop: 3, lineHeight: 15 },
  unblockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: DS.space.md },
  unblockText: { fontSize: 12, fontWeight: '700' },

  /* Setting rows */
  settingIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: 13, fontWeight: '700' },
  settingSub: { fontSize: 11, fontWeight: '500', marginTop: 2, lineHeight: 15 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: DS.space.sm + 2, borderRadius: 10, marginTop: DS.space.sm },
  privacyNoteText: { flex: 1, fontSize: 10, fontWeight: '500', lineHeight: 14 },

  /* Filter */
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterChipCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  filterChipCountText: { fontSize: 10, fontWeight: '800' },

  /* Metric row */
  metricCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  metricIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 13, fontWeight: '700' },
  metricMeta: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  rangeBox: { flexDirection: 'row', alignItems: 'center', marginTop: DS.space.sm, padding: DS.space.sm, borderRadius: 10, gap: DS.space.sm },
  rangeItem: { flex: 1 },
  rangeLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  rangeValue: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  rangeDivider: { width: 1, height: 22 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: DS.space.sm },
  progressFill: { height: '100%', borderRadius: 2 },

  /* Empty */
  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], paddingHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8, ...DS.shadow.sm },
  emptyTitle: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '85%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  modalHeader: { padding: DS.space.lg, alignItems: 'center', position: 'relative' },
  modalEmoji: { fontSize: 40, marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: DS.white, letterSpacing: -0.3 },
  modalStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  modalStatusText: { color: DS.white, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  modalCloseBtn: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: DS.space.md },
  modalDescription: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: DS.space.md },
  modalSection: { marginBottom: DS.space.md },
  modalSectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  modalProgressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  modalProgressFill: { height: '100%', borderRadius: 3 },
  modalProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  modalProgressText: { fontSize: 11, fontWeight: '600' },
  modalProgressPercent: { fontSize: 11, fontWeight: '700' },
  modalStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalStatCard: { width: '48%', padding: DS.space.sm + 2, borderRadius: 10 },
  modalStatLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  modalStatValue: { fontSize: 13, fontWeight: '800' },
  modalCohortCard: { padding: DS.space.sm + 2, borderRadius: 10, gap: 8 },
  modalCohortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalCohortText: { fontSize: 12, fontWeight: '600' },
  modalExplainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  modalExplainerDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  modalExplainerText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },
});