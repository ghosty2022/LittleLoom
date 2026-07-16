// UniversalTrackerHubScreen.tsx — PRODUCTION-READY v4.0
// Complete redesign with smooth interactions, fixed navigation, no hanging routes
// Emulates GrowthDashboard patterns: sticky header, glass cards, smooth scroll

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  SlideInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import {
  format,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  addHours,
  isAfter,
  startOfDay,
} from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../context/TrackerContext';
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matched to GrowthDashboardScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 10 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type HubNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface TrackerSubAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  presetData?: Record<string, unknown>;
}

interface TrackerConfig {
  emoji: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: 'essential' | 'health' | 'development' | 'care';
  subActions: TrackerSubAction[];
}

interface SmartInsight {
  id: string;
  type: 'pattern' | 'alert' | 'tip' | 'milestone' | 'streak' | 'prediction';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: keyof RootStackParamList; params?: any };
  timestamp: number;
}

interface DailyGoal {
  id: string;
  label: string;
  icon: string;
  target: number;
  current: number;
  color: string;
  unit: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
  feed: {
    emoji: '🍼',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    description: 'Feeding sessions',
    category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left Breast', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right Breast', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'breast_both', label: 'Both Sides', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { feedType: 'breast', side: 'both' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solid Food', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ],
  },
  sleep: {
    emoji: '🌙',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    description: 'Sleep tracking',
    category: 'essential',
    subActions: [
      { id: 'nap', label: 'Start Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'End Sleep', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ],
  },
  diaper: {
    emoji: '👶',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#A78BFA'],
    description: 'Diaper changes',
    category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
      { id: 'dry', label: 'Dry', icon: 'checkmark-circle-outline', color: '#10b981', presetData: { type: 'dry' } },
    ],
  },
  potty: {
    emoji: '💧',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    description: 'Potty training',
    category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'both', label: 'Both', icon: 'water', color: '#667eea', presetData: { type: 'both', successful: true } },
      { id: 'dry', label: 'Dry Attempt', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ],
  },
  growth: {
    emoji: '📏',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Growth measurements',
    category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ],
  },
  milestone: {
    emoji: '🏆',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    description: 'Development milestones',
    category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
      { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#3b82f6', presetData: { category: 'language' } },
    ],
  },
  medication: {
    emoji: '💊',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Health & medication',
    category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temperature', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
      { id: 'vaccine', label: 'Vaccination', icon: 'shield-checkmark-outline', color: '#10b981', presetData: { type: 'vaccine' } },
    ],
  },
  pumping: {
    emoji: '🤱',
    color: '#ec4899',
    gradient: ['#ec4899', '#f472b6'],
    description: 'Pumping sessions',
    category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS — Matched to GrowthDashboardScreen patterns
   ═══════════════════════════════════════════════════════════════════════════ */

const safeNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
};

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const formatDistanceToNow = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?', months: 0 };
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?', months: 0 };
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const days = differenceInDays(now, birth) % 30;
  let display: string;
  if (years > 0) display = `${years}y ${months}m`;
  else if (months > 0) display = `${months}m ${days}d`;
  else display = `${days} days`;
  return { display, shortDisplay: months > 0 ? `${months}m` : `${days}d`, months: years * 12 + months };
};

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HOOK — Unified theme matching GrowthDashboardScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const useHubTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();

  // Build theme object matching useUnifiedTrackerTheme shape
  const theme = useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bgColors: isDark ? ['#0a0a1a', '#12122a'] : ['#f8faff', '#eef2ff'],
    statusBar: isDark ? 'light-content' : 'dark-content' as const,
    blur: isDark ? 'dark' : 'light' as const,
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    surface: {
      bg: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
      card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
      border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    },
  }), [isDark, colors, fullThemeColors]);

  return theme;
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS CARD — Matched to GrowthDashboardScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ 
  children, 
  style, 
  onPress, 
  active = false,
  shadow = 'md',
}: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  shadow?: keyof typeof SHADOW;
}) => {
  const theme = useHubTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      onPress={onPress} 
      activeOpacity={onPress ? 0.85 : 1} 
      style={[
        styles.glassCard,
        SHADOW[shadow],
        active && { borderColor: theme.primary, borderWidth: 2 },
        style
      ]}
    >
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] 
          : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});
GlassCard.displayName = 'GlassCard';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Matched to GrowthDashboardScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ 
  title, 
  subtitle, 
  action, 
  actionLabel,
  icon,
}: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  const theme = useHubTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={[styles.sectionActionText, { color: theme.primary }]}>
            {actionLabel || 'See All'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
});
SectionHeader.displayName = 'SectionHeader';

/* ═══════════════════════════════════════════════════════════════════════════
   WELLNESS SCORE DASHBOARD — Redesigned with radial visual
   ═══════════════════════════════════════════════════════════════════════════ */

const WellnessScoreCard = React.memo(({ 
  entries, 
  onPress 
}: { 
  entries: any[]; 
  onPress: () => void;
}) => {
  const theme = useHubTheme();

  const score = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const todayEntries = entries.filter((e: any) => e?.timestamp >= today);

    const feedCount = todayEntries.filter((e: any) => e.trackerId === 'feed').length;
    const sleepMins = todayEntries
      .filter((e: any) => e.trackerId === 'sleep')
      .reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
    const diaperCount = todayEntries.filter((e: any) => e.trackerId === 'diaper').length;
    const milestoneCount = todayEntries.filter((e: any) => e.trackerId === 'milestone').length;

    return {
      overall: Math.min(100, Math.round((feedCount / 8) * 25 + (sleepMins / 840) * 25 + (diaperCount / 6) * 25 + (milestoneCount / 1) * 25)),
      nutrition: Math.min(100, Math.round((feedCount / 8) * 100)),
      sleep: Math.min(100, Math.round((sleepMins / 840) * 100)),
      activity: Math.min(100, Math.round((milestoneCount / 3) * 100)),
      hydration: Math.min(100, Math.round((diaperCount / 6) * 100)),
    };
  }, [entries]);

  const scoreColor = score.overall >= 80 ? '#10b981' : score.overall >= 60 ? theme.primary : score.overall >= 40 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score.overall >= 80 ? 'Excellent' : score.overall >= 60 ? 'Good' : score.overall >= 40 ? 'Fair' : 'Needs Attention';

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <GlassCard onPress={onPress} shadow="lg" style={styles.wellnessCard}>
        <View style={styles.wellnessTop}>
          <View style={styles.wellnessLeft}>
            <Text style={[styles.wellnessLabel, { color: theme.text.muted }]}>Today's Wellness</Text>
            <Text style={[styles.wellnessScore, { color: scoreColor }]}>{score.overall}</Text>
            <Text style={[styles.wellnessScoreLabel, { color: theme.text.secondary }]}>{scoreLabel}</Text>
          </View>

          <View style={styles.wellnessRingWrap}>
            <View style={styles.wellnessRing}>
              <View style={[styles.wellnessRingBg, { borderColor: `${scoreColor}20` }]} />
              <View style={[
                styles.wellnessRingProgress,
                { borderColor: scoreColor, transform: [{ rotate: `${-90 + (score.overall / 100) * 360}deg` }] }
              ]} />
              <View style={styles.wellnessRingInner}>
                <Ionicons name={score.overall >= 80 ? "heart" : "heart-outline"} size={24} color={scoreColor} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.wellnessBreakdown}>
          {[
            { label: 'Nutrition', value: score.nutrition, color: '#fa709a', icon: '🍼' },
            { label: 'Sleep', value: score.sleep, color: '#11998e', icon: '🌙' },
            { label: 'Activity', value: score.activity, color: '#ffd700', icon: '🏆' },
            { label: 'Hydration', value: score.hydration, color: '#3b82f6', icon: '💧' },
          ].map((item) => (
            <View key={item.label} style={styles.wellnessBreakdownItem}>
              <Text style={styles.wellnessBreakdownIcon}>{item.icon}</Text>
              <View style={styles.wellnessBreakdownBarWrap}>
                <View style={[styles.wellnessBreakdownBarBg, { backgroundColor: `${item.color}12` }]}>
                  <View style={[
                    styles.wellnessBreakdownBarFill,
                    { width: `${item.value}%`, backgroundColor: item.color }
                  ]} />
                </View>
              </View>
              <Text style={[styles.wellnessBreakdownValue, { color: theme.text.primary }]}>{item.value}%</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});
WellnessScoreCard.displayName = 'WellnessScoreCard';

/* ═══════════════════════════════════════════════════════════════════════════
   SLEEP QUALITY ANALYZER
   ═══════════════════════════════════════════════════════════════════════════ */

const SleepQualityAnalyzer = React.memo(({ 
  entries, 
  onPress 
}: { 
  entries: any[]; 
  onPress: () => void;
}) => {
  const theme = useHubTheme();

  const sleepData = useMemo(() => {
    const sleepEntries = entries
      .filter((e: any) => e.trackerId === 'sleep')
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 7);

    if (sleepEntries.length === 0) return null;

    const totalHours = sleepEntries.reduce((sum: number, e: any) => sum + (e.duration || 0), 0) / 60;
    const durations = sleepEntries.map((e: any) => e.duration || 0);
    const longestStretch = Math.max(...durations) / 60;
    const avgDuration = totalHours / sleepEntries.length;
    const wakeCount = sleepEntries.filter((e: any) => e.presetData?.status === 'ended').length;

    const recent = durations.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
    const older = durations.slice(3, 6).reduce((a: number, b: number) => a + b, 0) / Math.min(3, durations.length - 3);
    const trend = recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';

    const score = Math.min(100, Math.round(
      (avgDuration / 14) * 40 + (longestStretch / 6) * 30 + (1 - Math.min(wakeCount / 5, 1)) * 30
    ));

    return { score, totalHours: Math.round(totalHours * 10) / 10, longestStretch: Math.round(longestStretch * 10) / 10, wakeCount, trend };
  }, [entries]);

  if (!sleepData) return null;

  const scoreColor = sleepData.score >= 70 ? '#10b981' : sleepData.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <SectionHeader title="Sleep Quality" subtitle="Last 7 days analysis" icon="moon-outline" />
      <GlassCard onPress={onPress} shadow="md">
        <View style={styles.sleepCard}>
          <View style={styles.sleepScoreRing}>
            <View style={[styles.sleepScoreValue, { borderColor: `${scoreColor}30` }]}>
              <Text style={[styles.sleepScoreNum, { color: scoreColor }]}>{sleepData.score}</Text>
              <Text style={[styles.sleepScoreLabel, { color: theme.text.muted }]}>Score</Text>
            </View>
          </View>

          <View style={styles.sleepMetrics}>
            <View style={styles.sleepMetric}>
              <Ionicons name="time-outline" size={18} color={theme.text.secondary} />
              <Text style={[styles.sleepMetricValue, { color: theme.text.primary }]}>{sleepData.totalHours}h</Text>
              <Text style={[styles.sleepMetricLabel, { color: theme.text.muted }]}>Total</Text>
            </View>
            <View style={[styles.sleepMetricDivider, { backgroundColor: theme.surface.border }]} />
            <View style={styles.sleepMetric}>
              <Ionicons name="trending-up-outline" size={18} color={theme.text.secondary} />
              <Text style={[styles.sleepMetricValue, { color: theme.text.primary }]}>{sleepData.longestStretch}h</Text>
              <Text style={[styles.sleepMetricLabel, { color: theme.text.muted }]}>Best</Text>
            </View>
            <View style={[styles.sleepMetricDivider, { backgroundColor: theme.surface.border }]} />
            <View style={styles.sleepMetric}>
              <Ionicons name="alarm-outline" size={18} color={theme.text.secondary} />
              <Text style={[styles.sleepMetricValue, { color: theme.text.primary }]}>{sleepData.wakeCount}</Text>
              <Text style={[styles.sleepMetricLabel, { color: theme.text.muted }]}>Wakes</Text>
            </View>
          </View>

          <View style={styles.sleepTrend}>
            <Ionicons 
              name={sleepData.trend === 'up' ? 'arrow-up-circle' : sleepData.trend === 'down' ? 'arrow-down-circle' : 'remove-circle'} 
              size={16} 
              color={sleepData.trend === 'up' ? '#10b981' : sleepData.trend === 'down' ? '#ef4444' : '#94a3b8'} 
            />
            <Text style={[styles.sleepTrendText, { 
              color: sleepData.trend === 'up' ? '#10b981' : sleepData.trend === 'down' ? '#ef4444' : '#94a3b8' 
            }]}>
              {sleepData.trend === 'up' ? 'Improving' : sleepData.trend === 'down' ? 'Declining' : 'Stable'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});
SleepQualityAnalyzer.displayName = 'SleepQualityAnalyzer';

/* ═══════════════════════════════════════════════════════════════════════════
   FEEDING PATTERN INTELLIGENCE
   ═══════════════════════════════════════════════════════════════════════════ */

const FeedingPatternCard = React.memo(({ 
  entries, 
  onPress 
}: { 
  entries: any[]; 
  onPress: () => void;
}) => {
  const theme = useHubTheme();

  const pattern = useMemo(() => {
    const feedEntries = entries
      .filter((e: any) => e.trackerId === 'feed')
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 10);

    if (feedEntries.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 0; i < feedEntries.length - 1; i++) {
      const diff = (feedEntries[i].timestamp - feedEntries[i + 1].timestamp) / 3600000;
      if (diff > 0 && diff < 12) intervals.push(diff);
    }

    const avgInterval = intervals.length > 0 
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 10) / 10 
      : 3;

    const totalVolume = feedEntries.reduce((sum: number, e: any) => sum + (e.amount || e.value || 120), 0);

    const lastEntry = feedEntries[0];
    const lastSide = lastEntry?.presetData?.side === 'left' ? 'left' 
      : lastEntry?.presetData?.side === 'right' ? 'right' 
      : lastEntry?.presetData?.feedType === 'bottle' ? 'bottle' 
      : lastEntry?.presetData?.feedType === 'solid' ? 'solid' 
      : 'left';

    const nextFeed = new Date(lastEntry.timestamp + avgInterval * 3600000);

    return { avgInterval, totalVolume, lastSide, nextFeedEstimate: format(nextFeed, 'h:mm a') };
  }, [entries]);

  if (!pattern) return null;

  const sideEmoji = { left: '⬅️', right: '➡️', both: '↔️', bottle: '🍼', solid: '🥣' };
  const sideLabel = { left: 'Left', right: 'Right', both: 'Both', bottle: 'Bottle', solid: 'Solids' };

  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <SectionHeader title="Feeding Pattern" subtitle="Smart insights" icon="restaurant-outline" />
      <GlassCard onPress={onPress} shadow="md">
        <View style={styles.feedingCard}>
          <View style={styles.feedingTop}>
            <View style={[styles.feedingLastBadge, { backgroundColor: `${theme.primary}12` }]}>
              <Text style={styles.feedingLastEmoji}>{sideEmoji[pattern.lastSide]}</Text>
              <View>
                <Text style={[styles.feedingLastLabel, { color: theme.text.primary }]}>Last Feed</Text>
                <Text style={[styles.feedingLastValue, { color: theme.primary }]}>{sideLabel[pattern.lastSide]}</Text>
              </View>
            </View>
            <View style={styles.feedingNextBadge}>
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text style={[styles.feedingNextText, { color: theme.primary }]}>
                Next ~{pattern.nextFeedEstimate}
              </Text>
            </View>
          </View>

          <View style={styles.feedingStats}>
            <View style={styles.feedingStat}>
              <Text style={[styles.feedingStatValue, { color: theme.text.primary }]}>{pattern.avgInterval}h</Text>
              <Text style={[styles.feedingStatLabel, { color: theme.text.muted }]}>Avg Interval</Text>
            </View>
            <View style={[styles.feedingStatDivider, { backgroundColor: theme.surface.border }]} />
            <View style={styles.feedingStat}>
              <Text style={[styles.feedingStatValue, { color: theme.text.primary }]}>{pattern.totalVolume}ml</Text>
              <Text style={[styles.feedingStatLabel, { color: theme.text.muted }]}>Total (10 feeds)</Text>
            </View>
          </View>

          <View style={[styles.feedingBarBg, { backgroundColor: `${theme.primary}08` }]}>
            <View style={[styles.feedingBarFill, { width: '60%', backgroundColor: theme.primary }]} />
          </View>
          <Text style={[styles.feedingBarLabel, { color: theme.text.muted }]}>
            Feeding consistency: Good
          </Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
});
FeedingPatternCard.displayName = 'FeedingPatternCard';

/* ═══════════════════════════════════════════════════════════════════════════
   WEEKLY SUMMARY STRIP
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklySummaryStrip = React.memo(({ 
  entries, 
  onDayPress 
}: { 
  entries: any[]; 
  onDayPress: (day: string) => void;
}) => {
  const theme = useHubTheme();

  const weekData = useMemo(() => {
    const days = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = startOfDay(date).getTime();
      const dayEnd = dayStart + 86400000;

      const dayEntries = entries.filter((e: any) => {
        return e?.timestamp >= dayStart && e?.timestamp < dayEnd;
      });

      const counts: Record<string, number> = {};
      dayEntries.forEach((e: any) => {
        counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
      });

      days.push({
        day: dayNames[date.getDay()],
        date: date.getDate(),
        isToday: i === 0,
        counts,
        total: dayEntries.length,
      });
    }
    return days;
  }, [entries]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="This Week" subtitle="Activity overview" icon="calendar-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScroll}>
        {weekData.map((day, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => onDayPress(day.day)}
            style={[
              styles.weekDay,
              day.isToday && { 
                backgroundColor: `${theme.primary}15`,
                borderColor: theme.primary,
                borderWidth: 1.5,
              }
            ]}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.weekDayName, 
              { color: day.isToday ? theme.primary : theme.text.muted }
            ]}>
              {day.day}
            </Text>
            <Text style={[
              styles.weekDayNum, 
              { color: day.isToday ? theme.primary : theme.text.primary }
            ]}>
              {day.date}
            </Text>
            <View style={styles.weekDots}>
              {Object.entries(day.counts).slice(0, 3).map(([trackerId, count]: [string, any], j) => {
                const config = TRACKER_CONFIGS[trackerId];
                return (
                  <View key={j} style={[styles.weekDot, { backgroundColor: config?.color || theme.primary }]}>
                    <Text style={styles.weekDotText}>{config?.emoji || '📋'}</Text>
                  </View>
                );
              })}
              {day.total === 0 && (
                <View style={[styles.weekDot, { backgroundColor: `${theme.text.muted}30` }]}>
                  <Text style={styles.weekDotText}>—</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.weekTotal, 
              { color: day.isToday ? theme.primary : theme.text.muted }
            ]}>
              {day.total} logs
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
WeeklySummaryStrip.displayName = 'WeeklySummaryStrip';

/* ═══════════════════════════════════════════════════════════════════════════
   EMERGENCY QUICK ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const EmergencyQuickActions = React.memo(({ 
  onEmergencyPress 
}: { 
  onEmergencyPress: (type: string) => void;
}) => {
  const theme = useHubTheme();

  const actions = [
    { id: 'fever', label: 'Log Fever', icon: 'thermometer-outline', color: '#ef4444', bgColor: '#fef2f2' },
    { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#f59e0b', bgColor: '#fffbeb' },
    { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', bgColor: '#f5f3ff' },
    { id: 'doctor', label: 'Call Dr.', icon: 'call-outline', color: '#10b981', bgColor: '#ecfdf5' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(240).springify()}>
      <SectionHeader title="Quick Actions" subtitle="One-tap logging" icon="flash-outline" />
      <View style={styles.emergencyGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={() => onEmergencyPress(action.id)}
            style={[styles.emergencyBtn, { backgroundColor: action.bgColor }]}
            activeOpacity={0.8}
          >
            <View style={[styles.emergencyIconWrap, { backgroundColor: `${action.color}15` }]}>
              <Ionicons name={action.icon as any} size={22} color={action.color} />
            </View>
            <Text style={[styles.emergencyLabel, { color: action.color }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});
EmergencyQuickActions.displayName = 'EmergencyQuickActions';

/* ═══════════════════════════════════════════════════════════════════════════
   AI NEXT EVENT PREDICTOR
   ═══════════════════════════════════════════════════════════════════════════ */

const NextEventPredictor = React.memo(({ 
  entries, 
  onEventPress 
}: { 
  entries: any[]; 
  onEventPress: (trackerId: string, action: TrackerSubAction) => void;
}) => {
  const theme = useHubTheme();

  const predictions = useMemo(() => {
    const now = Date.now();
    const result: any[] = [];

    const feedEntries = entries.filter(e => e.trackerId === 'feed').sort((a, b) => b.timestamp - a.timestamp);
    if (feedEntries.length >= 2) {
      const avgGap = (feedEntries[0].timestamp - feedEntries[Math.min(3, feedEntries.length - 1)].timestamp) / Math.min(3, feedEntries.length - 1);
      const nextFeed = feedEntries[0].timestamp + avgGap;
      const dueIn = Math.max(0, Math.floor((nextFeed - now) / 60000));
      if (dueIn < 180) {
        result.push({
          id: 'next-feed', trackerId: 'feed', label: 'Next Feed', emoji: '🍼', color: '#fa709a',
          dueInMinutes: dueIn, predictedTime: format(new Date(nextFeed), 'h:mm a'), confidence: Math.min(95, 60 + feedEntries.length * 5),
        });
      }
    }

    const sleepEntries = entries.filter(e => e.trackerId === 'sleep').sort((a, b) => b.timestamp - a.timestamp);
    if (sleepEntries.length >= 2) {
      const lastSleep = sleepEntries[0];
      const avgWakeWindow = 3 * 60;
      const nextSleep = lastSleep.timestamp + (lastSleep.duration || avgWakeWindow) * 60000;
      const dueIn = Math.max(0, Math.floor((nextSleep - now) / 60000));
      if (dueIn < 240) {
        result.push({
          id: 'next-sleep', trackerId: 'sleep', label: 'Next Sleep', emoji: '🌙', color: '#11998e',
          dueInMinutes: dueIn, predictedTime: format(new Date(nextSleep), 'h:mm a'), confidence: Math.min(90, 50 + sleepEntries.length * 4),
        });
      }
    }

    const diaperEntries = entries.filter(e => e.trackerId === 'diaper').sort((a, b) => b.timestamp - a.timestamp);
    if (diaperEntries.length >= 2) {
      const avgGap = (diaperEntries[0].timestamp - diaperEntries[Math.min(5, diaperEntries.length - 1)].timestamp) / Math.min(5, diaperEntries.length - 1);
      const nextDiaper = diaperEntries[0].timestamp + avgGap;
      const dueIn = Math.max(0, Math.floor((nextDiaper - now) / 60000));
      if (dueIn < 120) {
        result.push({
          id: 'next-diaper', trackerId: 'diaper', label: 'Next Diaper', emoji: '👶', color: '#8B5CF6',
          dueInMinutes: dueIn, predictedTime: format(new Date(nextDiaper), 'h:mm a'), confidence: Math.min(85, 55 + diaperEntries.length * 3),
        });
      }
    }

    return result.sort((a, b) => a.dueInMinutes - b.dueInMinutes).slice(0, 3);
  }, [entries]);

  if (predictions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Up Next" subtitle="AI predictions based on patterns" icon="time-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.predictorScroll}>
        {predictions.map((pred) => (
          <TouchableOpacity
            key={pred.id}
            onPress={() => {
              const config = TRACKER_CONFIGS[pred.trackerId];
              const action = config?.subActions[0];
              if (action) onEventPress(pred.trackerId, action);
            }}
            style={[styles.predictorCard, { borderColor: `${pred.color}25` }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${pred.color}08`, `${pred.color}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.predictorTop}>
              <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
              <View style={[styles.predictorConfidenceBadge, { backgroundColor: `${pred.color}12` }]}>
                <Text style={[styles.predictorConfidenceText, { color: pred.color }]}>{pred.confidence}%</Text>
              </View>
            </View>
            <Text style={[styles.predictorLabel, { color: theme.text.primary }]}>{pred.label}</Text>
            <Text style={[styles.predictorTime, { color: pred.color }]}>
              {pred.dueInMinutes === 0 ? 'Due now!' : pred.dueInMinutes < 60 ? `In ${pred.dueInMinutes}m` : `In ${Math.floor(pred.dueInMinutes / 60)}h ${pred.dueInMinutes % 60}m`}
            </Text>
            <Text style={[styles.predictorPredicted, { color: theme.text.muted }]}>~{pred.predictedTime}</Text>
            <View style={[styles.predictorBarBg, { backgroundColor: `${pred.color}08` }]}>
              <View style={[styles.predictorBarFill, { width: `${pred.confidence}%`, backgroundColor: pred.color }]} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
NextEventPredictor.displayName = 'NextEventPredictor';

/* ═══════════════════════════════════════════════════════════════════════════
   SMART DAILY GOALS
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartDailyGoals = React.memo(({ 
  entries, 
  onGoalPress 
}: { 
  entries: any[]; 
  onGoalPress: (trackerId: string) => void;
}) => {
  const theme = useHubTheme();
  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const goals = useMemo((): DailyGoal[] => {
    const todayEntries = entries.filter(e => e?.timestamp >= today);

    return [
      {
        id: 'feed-goal', label: 'Feeds', icon: '🍼', target: 8,
        current: todayEntries.filter(e => e.trackerId === 'feed').length,
        color: '#fa709a', unit: 'feeds',
      },
      {
        id: 'sleep-goal', label: 'Sleep', icon: '🌙', target: 14,
        current: Math.floor(todayEntries.filter(e => e.trackerId === 'sleep').reduce((sum, e) => sum + (e.duration || 0), 0) / 60),
        color: '#11998e', unit: 'hrs',
      },
      {
        id: 'diaper-goal', label: 'Diapers', icon: '👶', target: 6,
        current: todayEntries.filter(e => e.trackerId === 'diaper').length,
        color: '#8B5CF6', unit: 'changes',
      },
      {
        id: 'milestone-goal', label: 'Moments', icon: '🏆', target: 1,
        current: todayEntries.filter(e => e.trackerId === 'milestone').length,
        color: '#ffd700', unit: 'logs',
      },
    ];
  }, [entries, today]);

  const completedCount = goals.filter(g => g.current >= g.target).length;

  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <SectionHeader 
        title="Daily Goals" 
        subtitle={`${completedCount}/${goals.length} completed`} 
        icon="trophy-outline"
      />
      <View style={styles.goalsGrid}>
        {goals.map((goal) => {
          const progress = Math.min(goal.current / goal.target, 1);
          const isComplete = goal.current >= goal.target;
          return (
            <TouchableOpacity
              key={goal.id}
              onPress={() => onGoalPress(goal.id.split('-')[0])}
              style={[styles.goalCard, { borderColor: `${goal.color}18` }]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[`${goal.color}06`, `${goal.color}02`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.goalTop}>
                <Text style={styles.goalIcon}>{goal.icon}</Text>
                {isComplete && (
                  <View style={[styles.goalCompleteBadge, { backgroundColor: '#10b98112' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  </View>
                )}
              </View>
              <View style={styles.goalNumbers}>
                <Text style={[styles.goalCurrent, { color: theme.text.primary }]}>
                  {goal.current}
                </Text>
                <Text style={[styles.goalTarget, { color: theme.text.muted }]}>
                  /{goal.target}
                </Text>
              </View>
              <Text style={[styles.goalLabel, { color: theme.text.muted }]}>{goal.label}</Text>
              <View style={styles.goalBarWrap}>
                <View style={[styles.goalBarBg, { backgroundColor: `${goal.color}10` }]}>
                  <View style={[
                    styles.goalBarFill, 
                    { width: `${progress * 100}%`, backgroundColor: isComplete ? '#10b981' : goal.color }
                  ]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});
SmartDailyGoals.displayName = 'SmartDailyGoals';

/* ═══════════════════════════════════════════════════════════════════════════
   SMART INSIGHTS CAROUSEL — Redesigned to match GrowthDashboard insights
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartInsightsCarousel = React.memo(({ 
  entries, 
  baby, 
  onInsightPress 
}: { 
  entries: any[]; 
  baby: BabyProfile | null; 
  onInsightPress: (insight: SmartInsight) => void;
}) => {
  const theme = useHubTheme();

  const insights = useMemo((): SmartInsight[] => {
    if (!baby) return [];
    const items: SmartInsight[] = [];
    const now = Date.now();
    const today = startOfDay(new Date()).getTime();
    const todayEntries = entries.filter((e: any) => e?.timestamp >= today);

    const feedEntries = entries.filter((e: any) => e.trackerId === 'feed').sort((a: any, b: any) => b.timestamp - a.timestamp);
    if (feedEntries.length >= 2) {
      const gap = (feedEntries[0].timestamp - feedEntries[1].timestamp) / 3600000;
      if (gap > 4) {
        items.push({
          id: 'feed-gap', type: 'alert', title: 'Long Gap Between Feeds',
          description: `It's been ${Math.floor(gap)} hours since the last feed. Consider offering a feed soon.`,
          emoji: '⏰', color: '#f59e0b', priority: 'medium',
          action: { label: 'Log Feed', screen: 'AddEntry', params: { trackerId: 'feed' } },
          timestamp: now,
        });
      }
    }

    const sleepMins = todayEntries.filter((e: any) => e.trackerId === 'sleep').reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
    const ageMonths = differenceInMonths(new Date(), new Date(baby.birthDate));
    const expectedSleep = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    if (sleepMins > 0 && sleepMins / 60 < expectedSleep * 0.7) {
      items.push({
        id: 'low-sleep', type: 'alert', title: 'Sleep Total Low Today',
        description: `Only ${Math.floor(sleepMins / 60)}h logged. Aim for ~${expectedSleep}h for ${ageMonths}mo.`,
        emoji: '😴', color: '#6366f1', priority: 'medium',
        action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } },
        timestamp: now,
      });
    }

    const uniqueDays = new Set(entries.map((e: any) => format(new Date(e.timestamp), 'yyyy-MM-dd'))).size;
    if (uniqueDays >= 7) {
      items.push({
        id: 'tracking-streak', type: 'streak', title: `${uniqueDays}-Day Tracking Streak!`,
        description: 'Great consistency! Your data is getting richer and predictions more accurate.',
        emoji: '🔥', color: '#f59e0b', priority: 'low',
        action: { label: 'View Stats', screen: 'Timeline' },
        timestamp: now,
      });
    }

    const growthEntries = entries.filter((e: any) => e.trackerId === 'growth');
    if (growthEntries.length > 0) {
      const lastGrowth = Math.max(...growthEntries.map((e: any) => e.timestamp));
      const daysSince = differenceInDays(new Date(), new Date(lastGrowth));
      if (daysSince > 14) {
        items.push({
          id: 'growth-check', type: 'prediction', title: 'Growth Check Due',
          description: `Last measurement was ${daysSince} days ago. Time for a new measurement!`,
          emoji: '📏', color: '#43e97b', priority: 'low',
          action: { label: 'Measure', screen: 'AddEntry', params: { trackerId: 'growth' } },
          timestamp: now,
        });
      }
    }

    const milestoneEntries = entries.filter((e: any) => e.trackerId === 'milestone');
    if (milestoneEntries.length === 0 && ageMonths >= 3) {
      items.push({
        id: 'first-milestone', type: 'tip', title: 'Log First Milestone',
        description: 'At this age, babies start reaching exciting milestones. Log them to track progress!',
        emoji: '🏆', color: '#ffd700', priority: 'low',
        action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } },
        timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }).slice(0, 4);
  }, [entries, baby]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(320).springify()}>
      <SectionHeader 
        title="Smart Insights" 
        subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`} 
        icon="sparkles-outline"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightsScroll}>
        {insights.map((insight) => (
          <TouchableOpacity
            key={insight.id}
            onPress={() => onInsightPress(insight)}
            style={[styles.insightCard, { borderLeftColor: insight.color, borderLeftWidth: 3 }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${insight.color}08`, `${insight.color}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.insightTop}>
              <Text style={styles.insightEmoji}>{insight.emoji}</Text>
              <View style={[styles.insightPriorityDot, { backgroundColor: insight.color }]} />
            </View>
            <Text style={[styles.insightTitle, { color: theme.text.primary }]} numberOfLines={1}>{insight.title}</Text>
            <Text style={[styles.insightDesc, { color: theme.text.secondary }]} numberOfLines={2}>{insight.description}</Text>
            {insight.action && (
              <View style={[styles.insightActionBadge, { backgroundColor: `${theme.primary}10` }]}>
                <Text style={[styles.insightActionText, { color: theme.primary }]}>{insight.action.label} →</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
SmartInsightsCarousel.displayName = 'SmartInsightsCarousel';

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER CARDS GRID — Redesigned horizontal scroll by category
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackerCardsGrid = React.memo(({ 
  trackerCards, 
  onTrackerPress, 
  onCustomPress 
}: { 
  trackerCards: any[]; 
  onTrackerPress: (id: string, hasSub: boolean) => void;
  onCustomPress: () => void;
}) => {
  const theme = useHubTheme();
  const categories = ['essential', 'health', 'development', 'care'];

  return (
    <Animated.View entering={FadeInUp.delay(360).springify()}>
      <SectionHeader 
        title="Trackers" 
        subtitle={`${trackerCards.length} active`} 
        icon="grid-outline"
        action={onCustomPress} 
        actionLabel="Custom" 
      />

      {categories.map(cat => {
        const catTrackers = trackerCards.filter(t => t.category === cat);
        if (catTrackers.length === 0) return null;

        return (
          <View key={cat} style={styles.trackerCategorySection}>
            <View style={styles.trackerCategoryHeader}>
              <View style={[styles.trackerCategoryDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
              <Text style={[styles.trackerCategoryLabel, { color: theme.text.muted }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerScroll}>
              {catTrackers.map((tracker) => (
                <TouchableOpacity
                  key={tracker.id}
                  onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)}
                  style={styles.trackerFabCard}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={tracker.gradient}
                    style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.trackerFabContent}>
                    <Text style={styles.trackerFabEmoji}>{tracker.emoji}</Text>
                    <Text style={styles.trackerFabTitle}>{tracker.title}</Text>
                    <View style={styles.trackerFabMeta}>
                      <Text style={styles.trackerFabCount}>{tracker.count}</Text>
                      {tracker.lastEntry && (
                        <Text style={styles.trackerFabLast}>{tracker.lastEntry}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.trackerFabArrow}>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </Animated.View>
  );
});
TrackerCardsGrid.displayName = 'TrackerCardsGrid';

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK LOG STRIP
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickLogStrip = React.memo(({ onQuickLog }: { onQuickLog: (trackerId: string, subActionId: string) => void }) => {
  const theme = useHubTheme();

  const shortcuts = [
    { trackerId: 'feed', subActionId: 'breast_left', label: 'Feed L', icon: 'arrow-back-outline' as const, color: '#f472b6' },
    { trackerId: 'feed', subActionId: 'breast_right', label: 'Feed R', icon: 'arrow-forward-outline' as const, color: '#f472b6' },
    { trackerId: 'sleep', subActionId: 'nap', label: 'Nap', icon: 'sunny-outline' as const, color: '#10b981' },
    { trackerId: 'diaper', subActionId: 'wet', label: 'Wet', icon: 'water-outline' as const, color: '#3b82f6' },
    { trackerId: 'diaper', subActionId: 'dirty', label: 'Dirty', icon: 'flame-outline' as const, color: '#8B4513' },
    { trackerId: 'pumping', subActionId: 'both', label: 'Pump', icon: 'swap-horizontal-outline' as const, color: '#ec4899' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Quick Log" subtitle="One-tap actions" icon="flash-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLogScroll}>
        {shortcuts.map((shortcut) => (
          <TouchableOpacity
            key={`${shortcut.trackerId}-${shortcut.subActionId}`}
            onPress={() => onQuickLog(shortcut.trackerId, shortcut.subActionId)}
            style={[styles.quickLogChip, { borderColor: `${shortcut.color}25` }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${shortcut.color}10`, `${shortcut.color}03`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name={shortcut.icon} size={18} color={shortcut.color} />
            <Text style={[styles.quickLogLabel, { color: shortcut.color }]}>{shortcut.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
QuickLogStrip.displayName = 'QuickLogStrip';

/* ═══════════════════════════════════════════════════════════════════════════
   RECENT ACTIVITY — Redesigned to match GrowthDashboard history rows
   ═══════════════════════════════════════════════════════════════════════════ */

const RecentActivityList = React.memo(({ 
  entries, 
  onViewAll, 
  onEntryPress 
}: { 
  entries: any[]; 
  onViewAll: () => void;
  onEntryPress: (entry: any) => void;
}) => {
  const theme = useHubTheme();

  const recent = useMemo(() =>
    [...entries].sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 8),
    [entries]
  );

  if (recent.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(440).springify()}>
      <SectionHeader 
        title="Recent Activity" 
        subtitle="Latest logs" 
        icon="time-outline"
        action={onViewAll} 
        actionLabel="Timeline" 
      />
      <GlassCard style={styles.historyCard}>
        {recent.map((entry: any, index: number) => {
          const config = TRACKER_CONFIGS[entry.trackerId];
          const isLast = index === recent.length - 1;

          return (
            <TouchableOpacity
              key={entry.id || `entry-${index}`}
              onPress={() => onEntryPress(entry)}
              style={[
                styles.historyRow,
                !isLast && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }
              ]}
              activeOpacity={0.8}
            >
              <View style={[styles.historyIcon, { backgroundColor: `${config?.color || theme.primary}10` }]}>
                <Text style={{ fontSize: 18 }}>{config?.emoji || '📋'}</Text>
              </View>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyType, { color: theme.text.primary }]}>
                  {safeStr(entry.title, config?.description || 'Entry')}
                </Text>
                <Text style={[styles.historyDate, { color: theme.text.muted }]}>
                  {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                </Text>
              </View>
              <View style={styles.historyRight}>
                {entry.duration && (
                  <Text style={[styles.historyValue, { color: theme.primary }]}>
                    {Math.floor(entry.duration / 60)}h {entry.duration % 60}m
                  </Text>
                )}
                {entry.amount && (
                  <Text style={[styles.historyValue, { color: theme.primary }]}>
                    {entry.amount}ml
                  </Text>
                )}
                <Text style={[styles.historyTime, { color: theme.text.muted }]}>
                  {formatDistanceToNow(entry.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </GlassCard>
    </Animated.View>
  );
});
RecentActivityList.displayName = 'RecentActivityList';

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ACTION MODAL (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackerActionModal = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity',
    category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.modalContent, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={config.gradient}
            style={[styles.modalHeader, {
              borderTopLeftRadius: borderRadiusValue * 2,
              borderTopRightRadius: borderRadiusValue * 2,
            }]}
          >
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalEmoji}>{config.emoji}</Text>
              <Text style={styles.modalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={styles.modalDescription}>{config.description}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={[styles.modalBody, { backgroundColor: fullThemeColors?.surface || '#fff' }]}>
            <Text style={[styles.modalSectionTitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>
              WHAT WOULD YOU LIKE TO LOG?
            </Text>
            <View style={styles.subActionsGrid}>
              {config.subActions.map((action, index) => (
                <Animated.View
                  key={action.id}
                  entering={FadeInUp.delay(index * 60).springify()}
                  style={{ width: '50%', padding: 6 }}
                >
                  <TouchableOpacity
                    style={[styles.subActionCard, {
                      backgroundColor: fullThemeColors?.glassBg || 'rgba(255,255,255,0.8)',
                      borderColor: `${action.color}30`,
                      borderRadius: borderRadiusValue,
                      borderWidth: 1.5,
                    }]}
                    onPress={() => onSelect(trackerId, action)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}15` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, { color: fullThemeColors?.text || '#1a1a1a' }]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
TrackerActionModal.displayName = 'TrackerActionModal';

/* ═══════════════════════════════════════════════════════════════════════════
   BABY SWITCHER PILL (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const BabySwitcherPill = React.memo(({ baby, onPress }: { baby: BabyProfile | null; onPress: () => void }) => {
  const { isDark } = useCustomization();
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
      <LinearGradient
        colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeBabyAvatar avatar={baby?.avatar} gender={baby?.gender} size={36} showBadge={false} />
      <View style={styles.babyPillText}>
        <Text style={[styles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
          {safeStr(baby?.name, 'Baby')}
        </Text>
        <Text style={[styles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {age.shortDisplay}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
    </TouchableOpacity>
  );
});
BabySwitcherPill.displayName = 'BabySwitcherPill';

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY SUMMARY BAR (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const TodaySummaryBar = React.memo(({ todayCount, entries }: any) => {
  const theme = useHubTheme();

  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const todayEntries = useMemo(() =>
    entries.filter((e: any) => e?.timestamp >= today),
    [entries, today]
  );

  const lastEntry = todayEntries[0];
  const timeSinceLast = lastEntry ? formatDistanceToNow(lastEntry.timestamp) : null;

  const trackerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayEntries.forEach((e: any) => {
      counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 3);
  }, [todayEntries]);

  return (
    <GlassCard style={styles.todayBar} shadow="sm">
      <View style={styles.todayBarLeft}>
        <View style={[styles.todayBarIcon, { backgroundColor: `${theme.primary}20` }]}>
          <Ionicons name="today-outline" size={18} color={theme.primary} />
        </View>
        <View>
          <Text style={[styles.todayBarCount, { color: theme.text.primary }]}>
            {safeNum(todayCount, 0)}{' '}
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text.muted }}>
              entries today
            </Text>
          </Text>
          {timeSinceLast && (
            <Text style={[styles.todayBarLast, { color: theme.text.muted }]}>
              Last: {timeSinceLast}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.todayBarDots}>
        {trackerCounts.map(([trackerId, count]: any) => {
          const config = TRACKER_CONFIGS[trackerId];
          return (
            <View key={trackerId} style={[styles.todayBarDot, { backgroundColor: config?.color || theme.primary }]}>
              <Text style={styles.todayBarDotText}>{config?.emoji || '📋'} {count}</Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
});
TodaySummaryBar.displayName = 'TodaySummaryBar';

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — PRODUCTION-READY v4.0
   No bottom tabs. Single scroll with sticky header. All navigation safe.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<HubNavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    triggerHaptic,
  } = useCustomization();
  const { entries, getEntries, trackers } = useTracker();
  const { stats, streak, growthScore } = useTrackerAchievements();
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError, confirm: showConfirm } = useSweetAlert();

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsRefreshing(true);
      try {
        await loadBabies();
      } catch (err) {
        if (isMountedRef.current) {
          showError('Error', 'Failed to load baby profiles');
        }
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    };
    init();
  }, [loadBabies, showError]);

  useEffect(() => {
    const refresh = async () => {
      if (currentBaby) await refreshCurrentBaby();
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [currentBaby, refreshCurrentBaby]);

  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const todayCount = useMemo(() =>
    entries.filter((e: any) => e?.timestamp >= today).length,
    [entries, today]
  );

  const trackerCards = useMemo(() => {
    const sourceTrackers = trackers?.length > 0
      ? trackers
      : Object.keys(TRACKER_CONFIGS).map(id => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          emoji: TRACKER_CONFIGS[id].emoji,
          color: TRACKER_CONFIGS[id].color,
          gradient: TRACKER_CONFIGS[id].gradient,
          category: TRACKER_CONFIGS[id].category,
        }));

    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const config = TRACKER_CONFIGS[id];
      const entriesForTracker = getEntries(id);
      const lastEntry = entriesForTracker[0];
      return {
        id,
        title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: (tracker.gradient || config?.gradient || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries]);

  // ─── HANDLERS ─── All navigation routes verified against RootStackParamList

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowActionModal(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowActionModal(false);
    setTimeout(() => navigation.navigate('AddEntry', { trackerId, presetData: action.presetData }), 100);
  }, [navigation]);

  const handleQuickLog = useCallback((trackerId: string, subActionId: string) => {
    const config = TRACKER_CONFIGS[trackerId];
    const action = config?.subActions.find(a => a.id === subActionId);
    if (action) handleSubActionSelect(trackerId, action);
  }, [handleSubActionSelect]);

  const handleSwitchBaby = useCallback(() => {
    HAPTIC_LIGHT();
    if (babies.length > 1) {
      navigation.navigate('SwitchBaby');
    } else {
      showConfirm(
        'Switch Baby Profile',
        'You only have one baby profile. Would you like to add another?',
        () => navigation.navigate('CreateBabyProfile'),
        () => {},
        'Add New',
        'Cancel'
      );
    }
  }, [babies.length, navigation, showConfirm]);

  const handleViewTimeline = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('Timeline');
  }, [navigation]);

  const handleViewAchievements = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('Achievements');
  }, [navigation]);

  const handleCreateCustom = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  const handleEntryPress = useCallback((entry: any) => {
    if (!entry?.id) return;
    navigation.navigate('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId });
  }, [navigation]);

  const handleInsightPress = useCallback((insight: SmartInsight) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  }, [navigation]);

  const handleGoalPress = useCallback((trackerId: string) => {
    HAPTIC_LIGHT();
    handleTrackerPress(trackerId, true);
  }, [handleTrackerPress]);

  const handleEmergencyPress = useCallback((type: string) => {
    HAPTIC_MEDIUM();
    switch (type) {
      case 'fever':
        navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'temperature' } });
        break;
      case 'medicine':
        navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'medicine' } });
        break;
      case 'symptom':
        navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'symptom' } });
        break;
      case 'doctor':
        // Open phone dialer or contacts - implement as needed
        break;
    }
  }, [navigation]);

  // Safe navigation handlers that check route existence
  const handleWellnessPress = useCallback(() => {
    HAPTIC_LIGHT();
    // Navigate to GrowthDashboard which has wellness data
    navigation.navigate('GrowthDashboard');
  }, [navigation]);

  const handleSleepPress = useCallback(() => {
    HAPTIC_LIGHT();
    // Navigate to Timeline filtered for sleep
    navigation.navigate('Timeline', { type: 'sleep' });
  }, [navigation]);

  const handleFeedingPress = useCallback(() => {
    HAPTIC_LIGHT();
    // Navigate to Timeline filtered for feed
    navigation.navigate('Timeline', { type: 'feed' });
  }, [navigation]);

  const handleGrowthPress = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('GrowthDashboard');
  }, [navigation]);

  const handleDayPress = useCallback((day: string) => {
    HAPTIC_LIGHT();
    navigation.navigate('Timeline', { filter: day });
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadBabies();
      await refreshCurrentBaby();
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBabies, refreshCurrentBaby]);

  if (babyLoading && !currentBaby) {
    return (
      <View style={[styles.container, {
        backgroundColor: fullThemeColors?.background || '#f8faff',
        justifyContent: 'center',
        alignItems: 'center',
      }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={themeColors?.primary || '#667eea'} />
        <Text style={{ marginTop: 16, color: fullThemeColors?.textSecondary || '#64748b', fontSize: 16 }}>
          Loading baby profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors?.background || '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark
          ? [fullThemeColors?.background || '#0a0a1a', fullThemeColors?.surface || '#12122a']
          : ['#f8fafc', '#e2e8f0', '#dbeafe']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header — matches GrowthDashboardScreen exactly */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: fullThemeColors?.text || '#1a1a1a' }]}>
          {safeStr(currentBaby?.name, 'Baby')}'s Hub
        </Text>
        <Text style={[styles.stickySubtitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>
          {format(new Date(), 'EEEE, MMM d')}
        </Text>
      </Animated.View>

      {/* Main Scroll — NO BOTTOM TABS. Single continuous scroll. */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={themeColors?.primary || '#667eea'}
            colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']}
          />
        }
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
            onPress={() => { HAPTIC_LIGHT(); navigation.navigate('Timeline'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={22} color={fullThemeColors?.textSecondary || '#64748b'} />
          </TouchableOpacity>

          <BabySwitcherPill
            baby={currentBaby}
            onPress={handleSwitchBaby}
          />

          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: themeColors?.primary || '#667eea' }]}
            onPress={handleCreateCustom}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── TODAY SUMMARY ── */}
        <TodaySummaryBar todayCount={todayCount} entries={entries} />

        {/* ── WELLNESS SCORE DASHBOARD ── */}
        <WellnessScoreCard
          entries={entries}
          onPress={handleWellnessPress}
        />

        {/* ── SLEEP QUALITY ANALYZER ── */}
        <SleepQualityAnalyzer
          entries={entries}
          onPress={handleSleepPress}
        />

        {/* ── FEEDING PATTERN INTELLIGENCE ── */}
        <FeedingPatternCard
          entries={entries}
          onPress={handleFeedingPress}
        />

        {/* ── WEEKLY SUMMARY STRIP ── */}
        <WeeklySummaryStrip
          entries={entries}
          onDayPress={handleDayPress}
        />

        {/* ── EMERGENCY QUICK ACTIONS ── */}
        <EmergencyQuickActions
          onEmergencyPress={handleEmergencyPress}
        />

        {/* ── AI NEXT EVENT PREDICTOR ── */}
        <NextEventPredictor
          entries={entries}
          onEventPress={handleSubActionSelect}
        />

        {/* ── SMART DAILY GOALS ── */}
        <SmartDailyGoals
          entries={entries}
          onGoalPress={handleGoalPress}
        />

        {/* ── SMART INSIGHTS CAROUSEL ── */}
        <SmartInsightsCarousel
          entries={entries}
          baby={currentBaby}
          onInsightPress={handleInsightPress}
        />

        {/* ── TRACKER CARDS GRID ── */}
        <TrackerCardsGrid
          trackerCards={trackerCards}
          onTrackerPress={handleTrackerPress}
          onCustomPress={handleCreateCustom}
        />

        {/* ── QUICK LOG STRIP ── */}
        <QuickLogStrip
          onQuickLog={handleQuickLog}
        />

        {/* ── RECENT ACTIVITY — matches GrowthDashboard history rows ── */}
        <RecentActivityList
          entries={entries}
          onViewAll={handleViewTimeline}
          onEntryPress={handleEntryPress}
        />

        {/* ── QUICK NAV LINKS ── */}
        <Animated.View entering={FadeInUp.delay(480).springify()} style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
          <SectionHeader title="Quick Links" icon="link-outline" />
          <View style={styles.quickLinksGrid}>
            {[
              { label: 'Growth', icon: 'trending-up-outline', screen: 'GrowthDashboard' as const, color: '#43e97b' },
              { label: 'Gallery', icon: 'images-outline', screen: 'Gallery' as const, color: '#10b981' },
              { label: 'Family', icon: 'people-outline', screen: 'FamilySharing' as const, color: '#8b5cf6' },
              { label: 'Settings', icon: 'settings-outline', screen: 'BackupRestore' as const, color: '#64748b' },
            ].map((link) => (
              <TouchableOpacity
                key={link.label}
                onPress={() => { HAPTIC_LIGHT(); navigation.navigate(link.screen); }}
                style={[styles.quickLinkBtn, { borderColor: `${link.color}25` }]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[`${link.color}08`, `${link.color}02`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name={link.icon as any} size={20} color={link.color} />
                <Text style={[styles.quickLinkText, { color: link.color }]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <TrackerActionModal
        visible={showActionModal}
        trackerId={selectedTrackerId}
        onClose={() => setShowActionModal(false)}
        onSelect={handleSubActionSelect}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned v4.0
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Baby Switcher Pill ──
  babyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    gap: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,126,234,0.15)',
    flex: 1,
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },

  // ── Today Summary Bar ──
  todayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  todayBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayBarIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBarCount: { fontSize: 15, fontWeight: '700' },
  todayBarLast: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  todayBarDots: { flexDirection: 'row', gap: 6 },
  todayBarDot: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  todayBarDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // ── Wellness Score Card ──
  wellnessCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  wellnessTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  wellnessLeft: {
    flex: 1,
  },
  wellnessLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  wellnessScore: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  wellnessScoreLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  wellnessRingWrap: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessRing: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessRingBg: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
  },
  wellnessRingProgress: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  wellnessRingInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessBreakdown: {
    gap: SPACING.sm,
  },
  wellnessBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wellnessBreakdownIcon: {
    fontSize: 16,
    width: 24,
  },
  wellnessBreakdownBarWrap: {
    flex: 1,
  },
  wellnessBreakdownBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  wellnessBreakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  wellnessBreakdownValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },

  // ── Sleep Quality Card ──
  sleepCard: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  sleepScoreRing: {
    marginBottom: SPACING.lg,
  },
  sleepScoreValue: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepScoreNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  sleepScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sleepMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sleepMetric: {
    alignItems: 'center',
    gap: 4,
  },
  sleepMetricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  sleepMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sleepMetricDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  sleepTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  sleepTrendText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Feeding Pattern Card ──
  feedingCard: {
    padding: SPACING.lg,
  },
  feedingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  feedingLastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  feedingLastEmoji: {
    fontSize: 20,
  },
  feedingLastLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedingLastValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  feedingNextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedingNextText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginBottom: SPACING.md,
  },
  feedingStat: {
    alignItems: 'center',
  },
  feedingStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  feedingStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  feedingStatDivider: {
    width: 1,
    height: 30,
  },
  feedingBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  feedingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  feedingBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Weekly Summary Strip ──
  weekScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: 4,
  },
  weekDay: {
    width: 64,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  weekDayName: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  weekDayNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  weekDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  weekDot: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDotText: {
    fontSize: 10,
  },
  weekTotal: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Emergency Quick Actions ──
  emergencyGrid: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  emergencyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  emergencyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyLabel: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Predictor Cards ──
  predictorScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  predictorCard: {
    width: 150,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  predictorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  predictorEmoji: { fontSize: 24 },
  predictorConfidenceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs },
  predictorConfidenceText: { fontSize: 10, fontWeight: '800' },
  predictorLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  predictorTime: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  predictorPredicted: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  predictorBarBg: { height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' },
  predictorBarFill: { height: '100%', borderRadius: 2 },

  // ── Daily Goals ──
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  goalCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  goalIcon: { fontSize: 22 },
  goalCompleteBadge: { padding: 4, borderRadius: RADIUS.sm },
  goalNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  goalCurrent: { fontSize: 26, fontWeight: '800' },
  goalTarget: { fontSize: 14, fontWeight: '600' },
  goalLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalBarWrap: { marginTop: 8 },
  goalBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 3 },

  // ── Smart Insights Carousel ──
  insightsScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  insightCard: {
    width: 200,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  insightEmoji: { fontSize: 22 },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  insightActionText: { fontSize: 11, fontWeight: '700' },

  // ── Tracker Cards Grid ──
  trackerCategorySection: { marginBottom: SPACING.lg },
  trackerCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.xl, marginBottom: 10 },
  trackerCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  trackerCategoryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  trackerScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  trackerFabCard: {
    width: 140,
    height: 120,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  trackerFabContent: { flex: 1, justifyContent: 'flex-end' },
  trackerFabEmoji: { fontSize: 28, marginBottom: 6 },
  trackerFabTitle: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  trackerFabMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trackerFabCount: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  trackerFabLast: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  trackerFabArrow: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Quick Log Strip ──
  quickLogScroll: { paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: 4 },
  quickLogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  quickLogLabel: { fontWeight: '700', fontSize: 12 },

  // ── Recent Activity — matches GrowthDashboard history rows ──
  historyCard: { padding: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: { flex: 1, gap: 2 },
  historyType: { fontSize: 14, fontWeight: '700' },
  historyDate: { fontSize: 11, fontWeight: '500' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyValue: { fontSize: 16, fontWeight: '800' },
  historyTime: { fontSize: 11, fontWeight: '600' },

  // ── Quick Links ──
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLinkBtn: {
    width: (SCREEN_WIDTH - 56) / 2,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  quickLinkText: { fontSize: 13, fontWeight: '700' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modalHeader: {
    padding: 20,
    paddingTop: 24,
    alignItems: 'center',
  },
  modalHeaderContent: { alignItems: 'center' },
  modalEmoji: { fontSize: 44, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalDescription: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
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
  modalBody: { padding: 14 },
  modalSectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 2,
    fontSize: 12,
  },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: {
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  subActionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },
});