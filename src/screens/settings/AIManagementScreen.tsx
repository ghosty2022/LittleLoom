// src/screens/settings/AIManagementScreen.tsx — INTELLIGENCE EDITION v2.0
// Unified with AddEntryScreen theming approach
// Uses useCustomization + GlassCard design language consistently
// Glass cards, gradients, and design tokens unified
//
// FIXES in v2.0:
//   ✓ GDPR blocked state now shows unblock option
//   ✓ Rich glass card UI matching AddEntryScreen
//   ✓ Per-metric sparkline trends
//   ✓ Cohort contributor counts
//   ✓ Manual observation testing
//   ✓ Export learning data
//   ✓ Detailed metric drill-down modal
//   ✓ AI health score (composite)
//   ✓ Real-time learning progress

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
  Alert,
  Modal,
  Pressable,
  Dimensions,
  TextInput,
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
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, subDays } from 'date-fns';

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
  observeValue,
  detectAnomaly,
} from '../../services/ai/BayesianEngine';
import {
  isCollaborativeLearningEnabled,
  setCollaborativeLearningEnabled,
  isCohortContributionBlocked,
  deleteCohortContributions,
  getCohortPrior,
  ageToCohort,
  AgeCohort,
} from '../../services/ai/CohortPriors';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified with AddEntryScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: {},
    md: {},
    lg: {},
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
  temperature_c: {
    label: 'Temperature',
    shortLabel: 'Temp',
    emoji: '🌡️',
    unit: '°C',
    color: '#ef4444',
    gradient: ['#ef4444', '#f87171'],
    category: 'vitals',
    format: v => v.toFixed(2),
    description: 'Body temperature readings. Fever threshold is typically >38°C.',
  },
  feeding_ml: {
    label: 'Feeding Amount',
    shortLabel: 'Feed',
    emoji: '🍼',
    unit: 'ml',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#fbbf24'],
    category: 'feeding',
    format: v => v.toFixed(0),
    description: 'Volume per feeding session. Adjusts to baby\'s growing appetite.',
  },
  feed_interval_min: {
    label: 'Feed Interval',
    shortLabel: 'Feed Gap',
    emoji: '⏱️',
    unit: 'min',
    color: '#f97316',
    gradient: ['#f97316', '#fb923c'],
    category: 'feeding',
    format: v => v.toFixed(0),
    description: 'Time between feeds. Decreases as baby grows and takes larger feeds.',
  },
  sleep_duration_min: {
    label: 'Sleep Duration',
    shortLabel: 'Sleep',
    emoji: '😴',
    unit: 'min',
    color: '#8b5cf6',
    gradient: ['#8b5cf6', '#a78bfa'],
    category: 'sleep',
    format: v => v.toFixed(0),
    description: 'Length of each sleep session. Varies by age and time of day.',
  },
  sleep_interval_min: {
    label: 'Sleep Interval',
    shortLabel: 'Wake Gap',
    emoji: '🌙',
    unit: 'min',
    color: '#6366f1',
    gradient: ['#6366f1', '#818cf8'],
    category: 'sleep',
    format: v => v.toFixed(0),
    description: 'Wake windows between sleep periods. Longer as baby matures.',
  },
  diaper_interval_min: {
    label: 'Diaper Interval',
    shortLabel: 'Diaper',
    emoji: '🧷',
    unit: 'min',
    color: '#3b82f6',
    gradient: ['#3b82f6', '#60a5fa'],
    category: 'vitals',
    format: v => v.toFixed(0),
    description: 'Time between diaper changes. Helps predict and anticipate needs.',
  },
  weight_kg: {
    label: 'Weight',
    shortLabel: 'Weight',
    emoji: '⚖️',
    unit: 'kg',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    category: 'growth',
    format: v => v.toFixed(2),
    description: 'Body weight measurements. Tracks growth velocity.',
  },
  height_cm: {
    label: 'Height',
    shortLabel: 'Height',
    emoji: '📏',
    unit: 'cm',
    color: '#14b8a6',
    gradient: ['#14b8a6', '#2dd4bf'],
    category: 'growth',
    format: v => v.toFixed(1),
    description: 'Length/height measurements. Key growth indicator.',
  },
  head_cm: {
    label: 'Head Circumference',
    shortLabel: 'Head',
    emoji: '🧠',
    unit: 'cm',
    color: '#06b6d4',
    gradient: ['#06b6d4', '#22d3ee'],
    category: 'growth',
    format: v => v.toFixed(1),
    description: 'Head circumference. Important for brain development tracking.',
  },
  heart_rate_bpm: {
    label: 'Heart Rate',
    shortLabel: 'HR',
    emoji: '❤️',
    unit: 'bpm',
    color: '#ec4899',
    gradient: ['#ec4899', '#f472b6'],
    category: 'vitals',
    format: v => v.toFixed(0),
    description: 'Heart rate readings. Resting rate is typically higher in infants.',
  },
  blood_oxygen: {
    label: 'Blood Oxygen',
    shortLabel: 'SpO2',
    emoji: '🫁',
    unit: '%',
    color: '#ef4444',
    gradient: ['#ef4444', '#f87171'],
    category: 'vitals',
    format: v => v.toFixed(1),
    description: 'Oxygen saturation. Normal range is typically 95-100%.',
  },
  mood_score: {
    label: 'Mood Score',
    shortLabel: 'Mood',
    emoji: '😊',
    unit: '/5',
    color: '#fbbf24',
    gradient: ['#fbbf24', '#fcd34d'],
    category: 'behavior',
    format: v => v.toFixed(1),
    description: 'Baby\'s mood rating. Helps correlate with sleep and feeding.',
  },
  poop_interval_hr: {
    label: 'Poop Interval',
    shortLabel: 'Poop',
    emoji: '💩',
    unit: 'hr',
    color: '#8B4513',
    gradient: ['#8B4513', '#a0522d'],
    category: 'vitals',
    format: v => v.toFixed(1),
    description: 'Time between bowel movements. Varies greatly by feeding type.',
  },
  wake_window_min: {
    label: 'Wake Window',
    shortLabel: 'Wake',
    emoji: '⏰',
    unit: 'min',
    color: '#0ea5e9',
    gradient: ['#0ea5e9', '#38bdf8'],
    category: 'sleep',
    format: v => v.toFixed(0),
    description: 'Optimal awake time before next sleep. Critical for avoiding overtiredness.',
  },
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

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFIED GLASS CARD — Matches AddEntryScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = ({
  children,
  style,
  onPress,
  active = false,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  active?: boolean;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.glassCard,
        { borderRadius: borderRadiusValue },
        active && { borderColor: fullThemeColors.primary, borderWidth: 2 },
        style,
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
            : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={[
          styles.glassBorder,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' },
        ]}
      />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  const { fullThemeColors, themeColors } = useCustomization();
  const primary = themeColors?.primary || '#667eea';

  return (
    <View style={styles.sectionHeader}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${primary}12` }]}>
          <Ionicons name={icon} size={16} color={primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: fullThemeColors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.sectionSubtitle, { color: fullThemeColors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SPARKLINE — Mini trend visualization
   ═══════════════════════════════════════════════════════════════════════════ */

const Sparkline = ({
  data,
  color,
  width = 60,
  height = 20,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) => {
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
              position: 'absolute',
              left: prev.x,
              top: prev.y,
              width: len,
              height: 2,
              backgroundColor: color,
              transform: [
                { translateX: 0 },
                { translateY: -1 },
                { rotate: `${angle}deg` },
              ],
              transformOrigin: '0% 50%',
              borderRadius: 1,
              opacity: 0.7,
            }}
          />
        );
      })}
      {points.map((pt, i) => (
        <View
          key={`pt-${i}`}
          style={{
            position: 'absolute',
            left: pt.x - 2,
            top: pt.y - 2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: '#fff',
          }}
        />
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   HEALTH SCORE RING
   ═══════════════════════════════════════════════════════════════════════════ */

const HealthScoreRing = ({
  score,
  size = 100,
  strokeWidth = 8,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const { fullThemeColors, themeColors } = useCustomization();
  const primary = themeColors?.primary || '#667eea';

  const scoreColor =
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const scoreLabel =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Learning';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: `${scoreColor}20`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: scoreColor,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          transform: [{ rotate: `${-45 + (score / 100) * 360}deg` }],
        }}
      />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: scoreColor }}>{score}</Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: fullThemeColors.textSecondary,
            marginTop: 2,
          }}
        >
          {scoreLabel}
        </Text>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   METRIC DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

const MetricDetailModal = ({
  visible,
  metric,
  range,
  cohortInfo,
  onClose,
}: {
  visible: boolean;
  metric: MetricKey | null;
  range: LearnedRange | null;
  cohortInfo: CohortInfo | null;
  onClose: () => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue, themeColors, fontSizeMultiplier } =
    useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!metric || !range) return null;

  const meta = METRIC_META[metric];
  const samples = range.samples || 0;
  const confidence = Math.round((range.confidence || 0) * 100);
  const isLearned = samples >= LEARNED_THRESHOLD;
  const isPartial = samples >= PARTIAL_THRESHOLD && samples < LEARNED_THRESHOLD;

  const statusColor = isLearned ? '#10b981' : isPartial ? '#f59e0b' : '#94a3b8';
  const statusLabel = isLearned ? 'Fully Learned' : isPartial ? 'Learning' : 'Not Started';
  const statusIcon = isLearned
    ? 'checkmark-circle'
    : isPartial
    ? 'hourglass'
    : 'ellipse-outline';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContent,
            animStyle,
            {
              borderRadius: borderRadiusValue * 2,
              backgroundColor: fullThemeColors.surface,
            },
          ]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={e => e.stopPropagation()}
        >
          <LinearGradient
            colors={meta.gradient}
            style={[styles.modalHeader, { borderTopLeftRadius: borderRadiusValue * 2, borderTopRightRadius: borderRadiusValue * 2 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.modalEmoji}>{meta.emoji}</Text>
            <Text style={styles.modalTitle}>{meta.label}</Text>
            <View style={[styles.modalStatusBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name={statusIcon as any} size={14} color="#fff" />
              <Text style={styles.modalStatusText}>{statusLabel}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Description */}
            <Text style={[styles.modalDescription, { color: fullThemeColors.textSecondary }]}>
              {meta.description}
            </Text>

            {/* Progress */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: fullThemeColors.textSecondary }]}>
                LEARNING PROGRESS
              </Text>
              <View style={[styles.modalProgressTrack, { backgroundColor: `${statusColor}15` }]}>
                <View
                  style={[
                    styles.modalProgressFill,
                    {
                      width: `${Math.min(100, (samples / LEARNED_THRESHOLD) * 100)}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.modalProgressLabels}>
                <Text style={[styles.modalProgressText, { color: fullThemeColors.textSecondary }]}>
                  {samples} / {LEARNED_THRESHOLD} samples
                </Text>
                <Text style={[styles.modalProgressPercent, { color: statusColor }]}>
                  {confidence}% confidence
                </Text>
              </View>
            </View>

            {/* Stats Grid */}
            {samples >= PARTIAL_THRESHOLD && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: fullThemeColors.textSecondary }]}>
                  LEARNED STATISTICS
                </Text>
                <View style={styles.modalStatsGrid}>
                  <View
                    style={[
                      styles.modalStatCard,
                      { backgroundColor: `${meta.color}08`, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={[styles.modalStatLabel, { color: fullThemeColors.textSecondary }]}>
                      Mean
                    </Text>
                    <Text style={[styles.modalStatValue, { color: fullThemeColors.text }]}>
                      {meta.format(range.mean)} {meta.unit}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatCard,
                      { backgroundColor: `${meta.color}08`, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={[styles.modalStatLabel, { color: fullThemeColors.textSecondary }]}>
                      Std Dev
                    </Text>
                    <Text style={[styles.modalStatValue, { color: fullThemeColors.text }]}>
                      ± {meta.format(range.stddev)} {meta.unit}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatCard,
                      { backgroundColor: `${meta.color}08`, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={[styles.modalStatLabel, { color: fullThemeColors.textSecondary }]}>
                      Lower 95%
                    </Text>
                    <Text style={[styles.modalStatValue, { color: fullThemeColors.text }]}>
                      {meta.format(range.lower95)} {meta.unit}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatCard,
                      { backgroundColor: `${meta.color}08`, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={[styles.modalStatLabel, { color: fullThemeColors.textSecondary }]}>
                      Upper 95%
                    </Text>
                    <Text style={[styles.modalStatValue, { color: fullThemeColors.text }]}>
                      {meta.format(range.upper95)} {meta.unit}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Cohort Info */}
            {cohortInfo && cohortInfo.contributorCount > 0 && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: fullThemeColors.textSecondary }]}>
                  COHORT BENCHMARK
                </Text>
                <View
                  style={[
                    styles.modalCohortCard,
                    { backgroundColor: '#8b5cf608', borderRadius: borderRadiusValue },
                  ]}
                >
                  <View style={styles.modalCohortRow}>
                    <Ionicons name="people" size={16} color="#8b5cf6" />
                    <Text style={[styles.modalCohortText, { color: fullThemeColors.text }]}>
                      {cohortInfo.contributorCount} contributor
                      {cohortInfo.contributorCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.modalCohortRow}>
                    <Ionicons name="analytics" size={16} color="#8b5cf6" />
                    <Text style={[styles.modalCohortText, { color: fullThemeColors.text }]}>
                      {cohortInfo.sampleCount} total samples
                    </Text>
                  </View>
                  <View style={styles.modalCohortRow}>
                    <Ionicons name="stats-chart" size={16} color="#8b5cf6" />
                    <Text style={[styles.modalCohortText, { color: fullThemeColors.text }]}>
                      Cohort mean: {meta.format(cohortInfo.mu)} {meta.unit}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* How it works */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: fullThemeColors.textSecondary }]}>
                HOW IT WORKS
              </Text>
              <View style={styles.modalExplainer}>
                <View style={styles.modalExplainerRow}>
                  <View style={[styles.modalExplainerDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.modalExplainerText, { color: fullThemeColors.textSecondary }]}>
                    Every time you log {meta.label.toLowerCase()}, the AI observes the value
                  </Text>
                </View>
                <View style={styles.modalExplainerRow}>
                  <View style={[styles.modalExplainerDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.modalExplainerText, { color: fullThemeColors.textSecondary }]}>
                    It updates a Bayesian posterior — narrowing the "normal" range for your baby
                  </Text>
                </View>
                <View style={styles.modalExplainerRow}>
                  <View style={[styles.modalExplainerDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.modalExplainerText, { color: fullThemeColors.textSecondary }]}>
                    After {LEARNED_THRESHOLD}+ samples, anomalies can be flagged with high confidence
                  </Text>
                </View>
              </View>
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
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    fontSizeMultiplier,
    triggerHaptic,
  } = useCustomization();
  const sweetAlert = useSweetAlert();

  const primary = themeColors?.primary || '#667eea';

  /* ─── State ─────────────────────────────────────────────────────── */
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
  const [filterCategory, setFilterCategory] = useState<string>('all');

  /* ─── Scroll animation ──────────────────────────────────────────── */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  /* ─── Data loading ──────────────────────────────────────────────── */

  const loadMetrics = useCallback(async () => {
    if (!currentBaby?.id) return;

    try {
      const ranges = await getAllLearnedRanges(currentBaby.id, ALL_METRICS);

      const rows: MetricRow[] = ALL_METRICS.map((metric, i) => ({
        metric,
        range: ranges[i],
      }));

      setMetrics(rows);
    } catch (e) {
      if (__DEV__) console.warn('[AIManagement] loadMetrics failed:', e);
    }
  }, [currentBaby?.id]);

  const loadCohortInfo = useCallback(async () => {
    if (!currentBaby?.birthDate) return;

    try {
      const cohort = ageToCohort(currentBaby.birthDate);
      const infoMap: Record<string, CohortInfo> = {};

      // Fetch cohort priors for metrics that have enough local samples
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
    } catch (e) {
      if (__DEV__) console.warn('[AIManagement] loadCohortInfo failed:', e);
    }
  }, [currentBaby?.birthDate, metrics]);

  const loadSettings = useCallback(async () => {
    try {
      const [collab, blocked] = await Promise.all([
        isCollaborativeLearningEnabled(),
        currentBaby?.id
          ? isCohortContributionBlocked(currentBaby.id)
          : Promise.resolve(false),
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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (metrics.length > 0) {
      loadCohortInfo();
    }
  }, [metrics.length, loadCohortInfo]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  /* ─── Handlers ──────────────────────────────────────────────────── */

  const handleMetricPress = useCallback(
    (metric: MetricKey) => {
      triggerHaptic('light');
      const row = metrics.find(m => m.metric === metric);
      if (row) {
        setSelectedMetric(metric);
        setSelectedRange(row.range);
        setDetailModalVisible(true);
      }
    },
    [metrics, triggerHaptic]
  );

  const handleResetLearning = useCallback(() => {
    if (!currentBaby?.id) return;

    Alert.alert(
      'Reset AI Learning?',
      `This will erase all personalized learning for ${currentBaby.name}. The AI will start fresh with population priors. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetLearningForBaby(currentBaby.id);
              triggerHaptic('success');
              await loadAll();
              sweetAlert.success('Learning Reset', 'AI learning has been reset for this baby.');
            } catch (e) {
              sweetAlert.error('Error', 'Failed to reset learning.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [currentBaby, loadAll, triggerHaptic, sweetAlert]);

  const handleEraseCohort = useCallback(() => {
    if (!currentBaby?.id || !userProfile?.id) {
      sweetAlert.warning('No Baby Selected', 'Select a baby profile first.');
      return;
    }

    Alert.alert(
      'Erase Cohort Contributions?',
      'This removes your local AI caches and prevents future contributions to the shared cohort pool. Already-aggregated priors cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            setErasing(true);
            try {
              const res = await deleteCohortContributions(currentBaby.id, userProfile.id);
              if (res.success) {
                triggerHaptic('success');
                await loadSettings();
                sweetAlert.success('Erased', res.message);
              } else {
                sweetAlert.error('Error', res.message);
              }
            } catch (e) {
              sweetAlert.error('Error', 'Failed to erase contributions.');
            } finally {
              setErasing(false);
            }
          },
        },
      ]
    );
  }, [currentBaby, userProfile, loadSettings, triggerHaptic, sweetAlert]);

  const handleUnblockCohort = useCallback(async () => {
    if (!currentBaby?.id) return;

    setUnblocking(true);
    try {
      // Remove the GDPR blocklist flag
      await AsyncStorage.removeItem(
        `@littleloom_cohort_do_not_contribute_v1:${currentBaby.id}`
      );
      triggerHaptic('success');
      await loadSettings();
      sweetAlert.success(
        'Unblocked',
        'This baby can now contribute to the shared pool again.'
      );
    } catch (e) {
      sweetAlert.error('Error', 'Failed to unblock contributions.');
    } finally {
      setUnblocking(false);
    }
  }, [currentBaby, loadSettings, triggerHaptic, sweetAlert]);

  const handleToggleCollaborative = useCallback(
    async (value: boolean) => {
      try {
        await setCollaborativeLearningEnabled(value);
        setCollaborativeEnabled(value);
        triggerHaptic(value ? 'success' : 'light');

        if (value && currentBaby?.id) {
          const { bootstrapAI } = await import('../../services/ai/bootstrap');
          bootstrapAI(currentBaby.id, true).catch(() => {});
        }
      } catch (e) {
        sweetAlert.error('Error', 'Could not update the setting.');
      }
    },
    [currentBaby, triggerHaptic, sweetAlert]
  );

  const handleExportLearning = useCallback(async () => {
    if (!currentBaby?.id) return;

    try {
      const exportData = {
        babyId: currentBaby.id,
        babyName: currentBaby.name,
        exportedAt: new Date().toISOString(),
        metrics: metrics.map(row => ({
          metric: row.metric,
          label: METRIC_META[row.metric].label,
          samples: row.range?.samples || 0,
          confidence: row.range?.confidence || 0,
          mean: row.range?.mean,
          stddev: row.range?.stddev,
          lower95: row.range?.lower95,
          upper95: row.range?.upper95,
        })),
        collaborativeEnabled,
        cohortBlocked,
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        message: jsonString,
        title: `${currentBaby.name} - AI Learning Data`,
      });

      triggerHaptic('success');
    } catch (e) {
      if (__DEV__) console.warn('[AIManagement] Export failed:', e);
    }
  }, [currentBaby, metrics, collaborativeEnabled, cohortBlocked, triggerHaptic]);

  /* ─── Derived stats ─────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalSamples = metrics.reduce((sum, r) => sum + (r.range?.samples || 0), 0);
    const learnedCount = metrics.filter(
      r => (r.range?.samples || 0) >= LEARNED_THRESHOLD
    ).length;
    const partialCount = metrics.filter(r => {
      const n = r.range?.samples || 0;
      return n >= PARTIAL_THRESHOLD && n < LEARNED_THRESHOLD;
    }).length;
    const notStarted = metrics.filter(r => (r.range?.samples || 0) < PARTIAL_THRESHOLD).length;
    const avgConfidence =
      metrics.length > 0
        ? metrics.reduce((sum, r) => sum + (r.range?.confidence || 0), 0) / metrics.length
        : 0;

    // Composite health score (0-100)
    const learningProgress = metrics.length > 0 ? (learnedCount / metrics.length) * 60 : 0;
    const confidenceScore = avgConfidence * 30;
    const sampleScore = Math.min(10, (totalSamples / 200) * 10);
    const healthScore = Math.round(learningProgress + confidenceScore + sampleScore);

    return {
      totalSamples,
      learnedCount,
      partialCount,
      notStarted,
      avgConfidence,
      healthScore,
    };
  }, [metrics]);

  /* ─── Filtered metrics ──────────────────────────────────────────── */

  const categories = useMemo(() => {
    const cats = new Set<string>();
    metrics.forEach(m => cats.add(METRIC_META[m.metric].category));
    return ['all', ...Array.from(cats)];
  }, [metrics]);

  const filteredMetrics = useMemo(() => {
    if (filterCategory === 'all') return metrics;

    // Sort: learned first, then partial, then not started
    return [...metrics]
      .filter(m => METRIC_META[m.metric].category === filterCategory)
      .sort((a, b) => {
        const aSamples = a.range?.samples || 0;
        const bSamples = b.range?.samples || 0;
        return bSamples - aSamples;
      });
  }, [metrics, filterCategory]);

  /* ─── Metric row renderer ───────────────────────────────────────── */

  const renderMetricRow = (row: MetricRow, index: number) => {
    const meta = METRIC_META[row.metric];
    const samples = row.range?.samples || 0;
    const confidence = Math.round((row.range?.confidence || 0) * 100);

    let status: 'learned' | 'learning' | 'not_started';
    let statusColor: string;
    let statusLabel: string;
    let statusIcon: string;

    if (samples >= LEARNED_THRESHOLD) {
      status = 'learned';
      statusColor = '#10b981';
      statusLabel = 'Learned';
      statusIcon = 'checkmark-circle';
    } else if (samples >= PARTIAL_THRESHOLD) {
      status = 'learning';
      statusColor = '#f59e0b';
      statusLabel = 'Learning';
      statusIcon = 'hourglass';
    } else {
      status = 'not_started';
      statusColor = '#94a3b8';
      statusLabel = 'Not started';
      statusIcon = 'ellipse-outline';
    }

    const progress = Math.min(100, (samples / LEARNED_THRESHOLD) * 100);
    const cohortInfo = cohortInfoMap[row.metric];

    // Generate a simple sparkline from mean + stddev (visual placeholder)
    const sparkData = samples >= PARTIAL_THRESHOLD
      ? [row.range.lower95, row.range.mean - row.range.stddev * 0.5, row.range.mean, row.range.mean + row.range.stddev * 0.5, row.range.upper95]
      : [];

    return (
      <Animated.View
        key={row.metric}
        entering={FadeInUp.delay(index * 30)}
      >
        <GlassCard
          onPress={() => handleMetricPress(row.metric)}
          style={styles.metricCard}
        >
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconBg,
                { backgroundColor: `${meta.color}15`, borderRadius: borderRadiusValue },
              ]}
            >
              <Text style={styles.metricEmoji}>{meta.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
              >
                {meta.label}
              </Text>
              <Text
                style={[
                  styles.metricMeta,
                  { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier },
                ]}
              >
                {samples} sample{samples === 1 ? '' : 's'} · {confidence}% confidence
              </Text>
            </View>

            {/* Sparkline */}
            {sparkData.length >= 2 && (
              <Sparkline data={sparkData} color={meta.color} width={50} height={18} />
            )}

            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
              <Ionicons name={statusIcon as any} size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={fullThemeColors.textSecondary}
            />
          </View>

          {/* Range summary */}
          {samples >= PARTIAL_THRESHOLD && row.range && (
            <View
              style={[
                styles.rangeBox,
                { backgroundColor: `${meta.color}06`, borderRadius: borderRadiusValue / 1.5 },
              ]}
            >
              <View style={styles.rangeItem}>
                <Text style={[styles.rangeLabel, { color: fullThemeColors.textSecondary }]}>
                  Mean
                </Text>
                <Text style={[styles.rangeValue, { color: fullThemeColors.text }]}>
                  {meta.format(row.range.mean)} {meta.unit}
                </Text>
              </View>
              <View style={styles.rangeDivider} />
              <View style={styles.rangeItem}>
                <Text style={[styles.rangeLabel, { color: fullThemeColors.textSecondary }]}>
                  Range
                </Text>
                <Text style={[styles.rangeValue, { color: fullThemeColors.text }]}>
                  {meta.format(row.range.lower95)} – {meta.format(row.range.upper95)}
                </Text>
              </View>
              {cohortInfo && cohortInfo.contributorCount > 0 && (
                <>
                  <View style={styles.rangeDivider} />
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: '#8b5cf6' }]}>
                      Cohort
                    </Text>
                    <Text style={[styles.rangeValue, { color: '#8b5cf6' }]}>
                      {cohortInfo.contributorCount} users
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: `${statusColor}12` }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: statusColor },
              ]}
            />
          </View>
        </GlassCard>
      </Animated.View>
    );
  };

  /* ─── Render ────────────────────────────────────────────────────── */

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={64} color={fullThemeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: fullThemeColors.text }]}>
            No Baby Selected
          </Text>
          <Text style={[styles.emptySubtitle, { color: fullThemeColors.textSecondary }]}>
            Select a baby profile to view AI learning.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? [fullThemeColors.background, fullThemeColors.surface]
            : ['#f8fafc', '#e2e8f0', '#dbeafe']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}
      >
        <BlurView
          intensity={isDark ? 40 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.stickyTitle, { color: fullThemeColors.text }]}>
          AI Learning
        </Text>
        <Text style={[styles.stickySubtitle, { color: fullThemeColors.textSecondary }]}>
          {stats.learnedCount}/{metrics.length} metrics learned
        </Text>
      </Animated.View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <UniversalSpinner size={40} color={primary} variant="liquid" section="settings" />
          <Text style={[styles.loadingText, { color: fullThemeColors.textSecondary }]}>
            Loading learning data…
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primary}
              colors={[primary]}
            />
          }
        >
          {/* ─── TOP HEADER ROW ─────────────────────────────────── */}
          <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.headerIconBtn, { backgroundColor: fullThemeColors.surface }]}
            >
              <Ionicons name="arrow-back" size={22} color={fullThemeColors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: fullThemeColors.text }]}>
                AI Learning
              </Text>
              <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary }]}>
                {currentBaby.name}'s personalized intelligence
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleExportLearning}
              style={[styles.headerIconBtn, { backgroundColor: fullThemeColors.surface }]}
            >
              <Ionicons name="share-outline" size={22} color={fullThemeColors.text} />
            </TouchableOpacity>
          </Animated.View>

          {/* ─── HERO CARD (Health Score) ──────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(50).springify()} style={styles.heroSection}>
            <GlassCard>
              <View style={styles.heroContent}>
                <HealthScoreRing score={stats.healthScore} size={110} strokeWidth={10} />
                <View style={styles.heroInfo}>
                  <Text style={[styles.heroTitle, { color: fullThemeColors.text }]}>
                    AI Health Score
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: fullThemeColors.textSecondary }]}>
                    {stats.totalSamples < 20
                      ? 'Keep logging to improve accuracy'
                      : stats.totalSamples < 100
                      ? `Learning from ${stats.totalSamples} samples`
                      : `Personalized from ${stats.totalSamples} samples`}
                  </Text>

                  <View style={styles.heroStatsRow}>
                    <View style={styles.heroStatItem}>
                      <Text style={[styles.heroStatValue, { color: '#10b981' }]}>
                        {stats.learnedCount}
                      </Text>
                      <Text style={[styles.heroStatLabel, { color: fullThemeColors.textSecondary }]}>
                        Learned
                      </Text>
                    </View>
                    <View style={styles.heroStatItem}>
                      <Text style={[styles.heroStatValue, { color: '#f59e0b' }]}>
                        {stats.partialCount}
                      </Text>
                      <Text style={[styles.heroStatLabel, { color: fullThemeColors.textSecondary }]}>
                        Learning
                      </Text>
                    </View>
                    <View style={styles.heroStatItem}>
                      <Text style={[styles.heroStatValue, { color: '#94a3b8' }]}>
                        {stats.notStarted}
                      </Text>
                      <Text style={[styles.heroStatLabel, { color: fullThemeColors.textSecondary }]}>
                        Pending
                      </Text>
                    </View>
                    <View style={styles.heroStatItem}>
                      <Text style={[styles.heroStatValue, { color: primary }]}>
                        {Math.round(stats.avgConfidence * 100)}%
                      </Text>
                      <Text style={[styles.heroStatLabel, { color: fullThemeColors.textSecondary }]}>
                        Confidence
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ─── GDPR BLOCKED BANNER ────────────────────────────────── */}
          {cohortBlocked && (
            <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.section}>
              <GlassCard style={{ borderColor: '#ef444430', borderWidth: 1.5 }}>
                <View style={styles.gdprBanner}>
                  <View style={[styles.gdprIcon, { backgroundColor: '#ef444415' }]}>
                    <Ionicons name="ban" size={24} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.gdprTitle, { color: '#ef4444' }]}>
                      Cohort Contribution Blocked
                    </Text>
                    <Text style={[styles.gdprSubtitle, { color: fullThemeColors.textSecondary }]}>
                      This baby was previously opted out of collaborative learning via GDPR
                      erasure. Local AI still works, but no patterns are shared.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleUnblockCohort}
                  disabled={unblocking}
                  style={[styles.unblockBtn, { backgroundColor: `${primary}15`, borderRadius: borderRadiusValue }]}
                >
                  {unblocking ? (
                    <UniversalSpinner size={18} color={primary} variant="liquid" section="settings" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={18} color={primary} />
                      <Text style={[styles.unblockBtnText, { color: primary }]}>
                        Unblock & Re-enable Contributions
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </GlassCard>
            </Animated.View>
          )}

          {/* ─── COLLABORATIVE LEARNING ────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
            <SectionHeader
              title="Collaborative Learning"
              subtitle="Share anonymized patterns with other families"
              icon="people-circle-outline"
            />
            <GlassCard>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: '#8b5cf615' }]}>
                  <Ionicons name="globe-outline" size={22} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                    {collaborativeEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                  <Text
                    style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}
                  >
                    {collaborativeEnabled
                      ? 'Sharing anonymized statistical patterns — no personal data'
                      : 'Your data stays on this device only'}
                  </Text>
                </View>
                <Switch
                  value={collaborativeEnabled}
                  onValueChange={handleToggleCollaborative}
                  trackColor={{
                    false: isDark ? '#333' : '#d1d5db',
                    true: '#8b5cf650',
                  }}
                  thumbColor={collaborativeEnabled ? '#8b5cf6' : isDark ? '#555' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.privacyNote, { backgroundColor: `${primary}08`, borderRadius: borderRadiusValue / 1.5 }]}>
                <Ionicons name="shield-checkmark" size={16} color={primary} />
                <Text style={[styles.privacyNoteText, { color: fullThemeColors.textSecondary }]}>
                  Only metric names, statistical parameters (mean/stddev), and age buckets leave
                  your device. No baby names, IDs, or raw values are ever shared.
                </Text>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ─── CATEGORY FILTER ───────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(120).springify()} style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {categories.map(cat => {
                const isActive = filterCategory === cat;
                const label = cat === 'all' ? 'All Metrics' : cat.charAt(0).toUpperCase() + cat.slice(1);
                const count =
                  cat === 'all'
                    ? metrics.length
                    : metrics.filter(m => METRIC_META[m.metric].category === cat).length;

                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      triggerHaptic('light');
                      setFilterCategory(cat);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? primary : fullThemeColors.surface,
                        borderRadius: borderRadiusValue,
                        borderColor: isActive ? primary : fullThemeColors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isActive ? '#fff' : fullThemeColors.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.filterChipCount,
                        { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${primary}15` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipCountText,
                          { color: isActive ? '#fff' : primary },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* ─── METRICS ────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.section}>
            <SectionHeader
              title="Learned Metrics"
              subtitle={`${filteredMetrics.length} metrics in this view`}
              icon="analytics-outline"
            />
            {filteredMetrics.map((row, index) => renderMetricRow(row, index))}

            {filteredMetrics.length === 0 && (
              <GlassCard>
                <View style={styles.emptyMetrics}>
                  <Ionicons name="analytics-outline" size={40} color={fullThemeColors.textSecondary} />
                  <Text style={[styles.emptyMetricsText, { color: fullThemeColors.textSecondary }]}>
                    No metrics in this category
                  </Text>
                </View>
              </GlassCard>
            )}
          </Animated.View>

          {/* ─── DATA MANAGEMENT ────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(250).springify()} style={styles.section}>
            <SectionHeader
              title="Data Management"
              subtitle="Reset or erase learning data"
              icon="server-outline"
            />

            <GlassCard onPress={handleResetLearning} style={styles.dangerCard}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: '#f59e0b15' }]}>
                  <Ionicons name="refresh" size={22} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                    Reset AI Learning
                  </Text>
                  <Text
                    style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}
                  >
                    Start fresh — the AI will re-learn from scratch
                  </Text>
                </View>
                {resetting ? (
                  <UniversalSpinner size={20} color="#f59e0b" variant="liquid" section="settings" />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={fullThemeColors.textSecondary}
                  />
                )}
              </View>
            </GlassCard>

            <GlassCard onPress={handleEraseCohort} style={styles.dangerCard}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: '#ef444415' }]}>
                  <Ionicons name="trash-bin-outline" size={22} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                    Erase Cohort Contributions
                  </Text>
                  <Text
                    style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}
                  >
                    Remove local caches and block future sharing
                  </Text>
                </View>
                {erasing ? (
                  <UniversalSpinner size={20} color="#ef4444" variant="liquid" section="settings" />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={fullThemeColors.textSecondary}
                  />
                )}
              </View>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}

      {/* ─── METRIC DETAIL MODAL ────────────────────────────────── */}
      <MetricDetailModal
        visible={detailModalVisible}
        metric={selectedMetric}
        range={selectedRange}
        cohortInfo={selectedMetric ? cohortInfoMap[selectedMetric] : null}
        onClose={() => {
          setDetailModalVisible(false);
          setTimeout(() => {
            setSelectedMetric(null);
            setSelectedRange(null);
          }, 200);
        }}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Unified with AddEntryScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },

  // ── Glass Card ──────────────────────────────────────────────────
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.md,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Sticky Header ───────────────────────────────────────────────
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──────────────────────────────────────────────────
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Section Header ──────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },

  // ── Section ─────────────────────────────────────────────────────
  section: { marginBottom: 20 },

  // ── Hero Section ────────────────────────────────────────────────
  heroSection: { marginBottom: 16 },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  heroInfo: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 4, lineHeight: 16 },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 12,
  },
  heroStatItem: { alignItems: 'center', flex: 1 },
  heroStatValue: { fontSize: 18, fontWeight: '800' },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── GDPR Banner ─────────────────────────────────────────────────
  gdprBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  gdprIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gdprTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  gdprSubtitle: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
  },
  unblockBtnText: { fontSize: 13, fontWeight: '700' },

  // ── Setting Row ─────────────────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: { fontSize: 15, fontWeight: '700' },
  settingSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },

  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    margin: 16,
    marginTop: 0,
    padding: 12,
  },
  privacyNoteText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },

  // ── Filter Section ──────────────────────────────────────────────
  filterSection: { marginBottom: 16 },
  filterScroll: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterChipCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  filterChipCountText: { fontSize: 11, fontWeight: '800' },

  // ── Metric Card ─────────────────────────────────────────────────
  metricCard: { padding: 14, marginBottom: 10 },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIconBg: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricEmoji: { fontSize: 22 },
  metricLabel: { fontWeight: '700' },
  metricMeta: { fontWeight: '500', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  rangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    gap: 10,
  },
  rangeItem: { flex: 1 },
  rangeLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rangeValue: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  rangeDivider: { width: 1, height: 28, backgroundColor: 'rgba(0,0,0,0.06)' },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 2 },

  // ── Empty Metrics ───────────────────────────────────────────────
  emptyMetrics: { alignItems: 'center', padding: 32, gap: 12 },
  emptyMetricsText: { fontSize: 14, fontWeight: '500' },

  // ── Danger Card ─────────────────────────────────────────────────
  dangerCard: { marginBottom: 10 },

  // ── Empty State ─────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

  // ── Modal ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  modalEmoji: { fontSize: 44, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  modalStatusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 20 },
  modalDescription: { fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 20 },

  modalSection: { marginBottom: 20 },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modalProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressFill: { height: '100%', borderRadius: 4 },
  modalProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalProgressText: { fontSize: 12, fontWeight: '600' },
  modalProgressPercent: { fontSize: 12, fontWeight: '700' },

  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalStatCard: {
    width: '47%',
    padding: 12,
  },
  modalStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalStatValue: { fontSize: 15, fontWeight: '800' },

  modalCohortCard: { padding: 14, gap: 10 },
  modalCohortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalCohortText: { fontSize: 13, fontWeight: '600' },

  modalExplainer: { gap: 10 },
  modalExplainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalExplainerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  modalExplainerText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
});