// UniversalTrackerHubScreen.tsx — COMPLETE REDESIGN with ALL Functionality

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
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
  startOfDay,
  isSameDay,
} from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks';
import { useActivity } from '../../context/ActivityContext';
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
};

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

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
    default: {
    emoji: '•',
    color: '#94a3b8',
    gradient: ['#94a3b8', '#cbd5e1'],
    description: 'Activity',
    category: 'care',
    subActions: [{ id: 'default', label: 'View', icon: 'ellipse-outline' as const, color: '#94a3b8' }],
  },
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
  bath: {
    emoji: '🛁',
    color: '#3b82f6',
    gradient: ['#3b82f6', '#60a5fa'],
    description: 'Bath time',
    category: 'care',
    subActions: [
      { id: 'bath', label: 'Log Bath', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'bath' } },
      { id: 'sponge', label: 'Sponge Bath', icon: 'cloud-outline', color: '#93c5fd', presetData: { type: 'sponge' } },
    ],
  },
  tummy_time: {
    emoji: '🤸',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    description: 'Tummy time',
    category: 'development',
    subActions: [
      { id: 'tummy_time', label: 'Log Tummy Time', icon: 'fitness-outline', color: '#10b981', presetData: { type: 'tummy_time' } },
    ],
  },
  reading: {
    emoji: '📚',
    color: '#6366f1',
    gradient: ['#6366f1', '#818cf8'],
    description: 'Reading sessions',
    category: 'development',
    subActions: [
      { id: 'reading', label: 'Log Reading', icon: 'book-outline', color: '#6366f1', presetData: { type: 'reading' } },
    ],
  },
  walk: {
    emoji: '🚶',
    color: '#0ea5e9',
    gradient: ['#0ea5e9', '#38bdf8'],
    description: 'Outdoor walks',
    category: 'care',
    subActions: [
      { id: 'walk', label: 'Log Walk', icon: 'walk-outline', color: '#0ea5e9', presetData: { type: 'walk' } },
    ],
  },
  note: {
    emoji: '📝',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    description: 'Quick notes',
    category: 'care',
    subActions: [
      { id: 'note', label: 'Add Note', icon: 'document-text-outline', color: '#64748b', presetData: { type: 'note' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
  emotional: '#ec4899',
  physical: '#06b6d4',
  nutrition: '#f97316',
  safety: '#dc2626',
  schedule: '#3b82f6',
  parental: '#84cc16',
  travel: '#0ea5e9',
  special_needs: '#a855f7',
  household: '#64748b',
  custom: '#667eea',
};

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
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return 'just now';
  const now = Date.now();
  const diff = now - timestamp;
  // If timestamp is in the future, return 'just now'
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return format(new Date(timestamp), 'MMM d');
};

const getDateTitle = (timestamp: number): string => {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return 'Recent';
  
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  // Check if date is today
  if (date >= today) return 'Today';
  
  // Check if date is yesterday
  if (date >= yesterday) return 'Yesterday';
  
  // Check if date is within last 7 days
  const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek[date.getDay()] || 'Unknown';
  }
  
  return format(date, 'MMM d, yyyy');
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

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// ─── THEME ──────────────────────────────────────────────────────────────

const useHubTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();
  return useMemo(() => ({
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
};

// ─── GLASS CARD ──────────────────────────────────────────────────────────

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

// ─── SECTION HEADER ──────────────────────────────────────────────────────

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

// ─── WELLNESS SCORE CARD ──────────────────────────────────────────────────

const WellnessScoreCard = React.memo(({ entries, onPress }: { entries: any[]; onPress: () => void }) => {
  const theme = useHubTheme();

  const score = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const todayEntries = entries.filter((e: any) => e?.timestamp >= today);

    const feedCount = todayEntries.filter((e: any) => e.trackerId === 'feed').length;
    const sleepMins = todayEntries.filter((e: any) => e.trackerId === 'sleep').reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
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
              <View style={[styles.wellnessRingProgress, { borderColor: scoreColor, transform: [{ rotate: `${-90 + (score.overall / 100) * 360}deg` }] }]} />
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
                  <View style={[styles.wellnessBreakdownBarFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
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

// ─── SLEEP QUALITY ANALYZER ──────────────────────────────────────────────

const SleepQualityAnalyzer = React.memo(({ entries, onPress }: { entries: any[]; onPress: () => void }) => {
  const theme = useHubTheme();

  const sleepData = useMemo(() => {
    const sleepEntries = entries.filter((e: any) => e.trackerId === 'sleep').sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 7);
    if (sleepEntries.length === 0) return null;

    const totalHours = sleepEntries.reduce((sum: number, e: any) => sum + (e.duration || 0), 0) / 60;
    const durations = sleepEntries.map((e: any) => e.duration || 0);
    const longestStretch = Math.max(...durations) / 60;
    const avgDuration = totalHours / sleepEntries.length;
    const wakeCount = sleepEntries.filter((e: any) => e.presetData?.status === 'ended').length;

    const recent = durations.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
    const older = durations.slice(3, 6).reduce((a: number, b: number) => a + b, 0) / Math.min(3, durations.length - 3);
    const trend = recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';

    const score = Math.min(100, Math.round((avgDuration / 14) * 40 + (longestStretch / 6) * 30 + (1 - Math.min(wakeCount / 5, 1)) * 30));

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
            <Ionicons name={sleepData.trend === 'up' ? 'arrow-up-circle' : sleepData.trend === 'down' ? 'arrow-down-circle' : 'remove-circle'} size={16} color={sleepData.trend === 'up' ? '#10b981' : sleepData.trend === 'down' ? '#ef4444' : '#94a3b8'} />
            <Text style={[styles.sleepTrendText, { color: sleepData.trend === 'up' ? '#10b981' : sleepData.trend === 'down' ? '#ef4444' : '#94a3b8' }]}>
              {sleepData.trend === 'up' ? 'Improving' : sleepData.trend === 'down' ? 'Declining' : 'Stable'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});
SleepQualityAnalyzer.displayName = 'SleepQualityAnalyzer';

// ─── FEEDING PATTERN CARD ─────────────────────────────────────────────────

const FeedingPatternCard = React.memo(({ entries, onPress }: { entries: any[]; onPress: () => void }) => {
  const theme = useHubTheme();

  const pattern = useMemo(() => {
    const feedEntries = entries
      .filter((e: any) => e.trackerId === 'feed' && e.timestamp && typeof e.timestamp === 'number' && !isNaN(e.timestamp))
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
    if (!lastEntry) return null;

    const lastSide = lastEntry?.presetData?.side === 'left' ? 'left' 
      : lastEntry?.presetData?.side === 'right' ? 'right' 
      : lastEntry?.presetData?.feedType === 'bottle' ? 'bottle' 
      : lastEntry?.presetData?.feedType === 'solid' ? 'solid' 
      : 'left';

    const nextFeedTime = lastEntry.timestamp + avgInterval * 3600000;
    const nextFeed = new Date(nextFeedTime);
    
    let nextFeedEstimate = '--:--';
    try {
      if (!isNaN(nextFeed.getTime())) {
        nextFeedEstimate = format(nextFeed, 'h:mm a');
      }
    } catch (e) {
      nextFeedEstimate = '--:--';
    }

    return { avgInterval, totalVolume, lastSide, nextFeedEstimate };
  }, [entries]);

  if (!pattern) return null;

  const sideEmoji: Record<string, string> = { left: '⬅️', right: '➡️', both: '↔️', bottle: '🍼', solid: '🥣' };
  const sideLabel: Record<string, string> = { left: 'Left', right: 'Right', both: 'Both', bottle: 'Bottle', solid: 'Solids' };

  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <SectionHeader title="Feeding Pattern" subtitle="Smart insights" icon="restaurant-outline" />
      <GlassCard onPress={onPress} shadow="md">
        <View style={styles.feedingCard}>
          <View style={styles.feedingTop}>
            <View style={[styles.feedingLastBadge, { backgroundColor: `${theme.primary}12` }]}>
              <Text style={styles.feedingLastEmoji}>{sideEmoji[pattern.lastSide] || '🍼'}</Text>
              <View>
                <Text style={[styles.feedingLastLabel, { color: theme.text.primary }]}>Last Feed</Text>
                <Text style={[styles.feedingLastValue, { color: theme.primary }]}>{sideLabel[pattern.lastSide] || 'Unknown'}</Text>
              </View>
            </View>
            <View style={styles.feedingNextBadge}>
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text style={[styles.feedingNextText, { color: theme.primary }]}>Next ~{pattern.nextFeedEstimate}</Text>
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
          <Text style={[styles.feedingBarLabel, { color: theme.text.muted }]}>Feeding consistency: Good</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
});
FeedingPatternCard.displayName = 'FeedingPatternCard';

// ─── WEEKLY SUMMARY STRIP ─────────────────────────────────────────────────

const WeeklySummaryStrip = React.memo(({ entries, onDayPress }: { entries: any[]; onDayPress: (day: string) => void }) => {
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

      const dayEntries = entries.filter((e: any) => e?.timestamp >= dayStart && e?.timestamp < dayEnd);
      const counts: Record<string, number> = {};
      dayEntries.forEach((e: any) => { counts[e.trackerId] = (counts[e.trackerId] || 0) + 1; });

      days.push({ day: dayNames[date.getDay()], date: date.getDate(), isToday: i === 0, counts, total: dayEntries.length });
    }
    return days;
  }, [entries]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="This Week" subtitle="Activity overview" icon="calendar-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScroll}>
        {weekData.map((day, i) => (
          <TouchableOpacity key={i} onPress={() => onDayPress(day.day)} style={[styles.weekDay, day.isToday && { backgroundColor: `${theme.primary}15`, borderColor: theme.primary, borderWidth: 1.5 }]} activeOpacity={0.8}>
            <Text style={[styles.weekDayName, { color: day.isToday ? theme.primary : theme.text.muted }]}>{day.day}</Text>
            <Text style={[styles.weekDayNum, { color: day.isToday ? theme.primary : theme.text.primary }]}>{day.date}</Text>
            <View style={styles.weekDots}>
              {Object.entries(day.counts).slice(0, 3).map(([trackerId, count]: [string, any], j) => {
                const config = TRACKER_CONFIGS[trackerId];
                return <View key={j} style={[styles.weekDot, { backgroundColor: config?.color || theme.primary }]}><Text style={styles.weekDotText}>{config?.emoji || '📋'}</Text></View>;
              })}
              {day.total === 0 && <View style={[styles.weekDot, { backgroundColor: `${theme.text.muted}30` }]}><Text style={styles.weekDotText}>—</Text></View>}
            </View>
            <Text style={[styles.weekTotal, { color: day.isToday ? theme.primary : theme.text.muted }]}>{day.total} logs</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
WeeklySummaryStrip.displayName = 'WeeklySummaryStrip';

// ─── EMERGENCY QUICK ACTIONS ─────────────────────────────────────────────

const EmergencyQuickActions = React.memo(({ onEmergencyPress }: { onEmergencyPress: (type: string) => void }) => {
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
          <TouchableOpacity key={action.id} onPress={() => onEmergencyPress(action.id)} style={[styles.emergencyBtn, { backgroundColor: action.bgColor }]} activeOpacity={0.8}>
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

// ─── AI NEXT EVENT PREDICTOR ────────────────────────────────────────────

const NextEventPredictor = React.memo(({ entries, onEventPress }: { entries: any[]; onEventPress: (trackerId: string, action: TrackerSubAction) => void }) => {
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
        result.push({ id: 'next-feed', trackerId: 'feed', label: 'Next Feed', emoji: '🍼', color: '#fa709a', dueInMinutes: dueIn, predictedTime: format(new Date(nextFeed), 'h:mm a'), confidence: Math.min(95, 60 + feedEntries.length * 5) });
      }
    }

    const sleepEntries = entries.filter(e => e.trackerId === 'sleep').sort((a, b) => b.timestamp - a.timestamp);
    if (sleepEntries.length >= 2) {
      const lastSleep = sleepEntries[0];
      const avgWakeWindow = 3 * 60;
      const nextSleep = lastSleep.timestamp + (lastSleep.duration || avgWakeWindow) * 60000;
      const dueIn = Math.max(0, Math.floor((nextSleep - now) / 60000));
      if (dueIn < 240) {
        result.push({ id: 'next-sleep', trackerId: 'sleep', label: 'Next Sleep', emoji: '🌙', color: '#11998e', dueInMinutes: dueIn, predictedTime: format(new Date(nextSleep), 'h:mm a'), confidence: Math.min(90, 50 + sleepEntries.length * 4) });
      }
    }

    const diaperEntries = entries.filter(e => e.trackerId === 'diaper').sort((a, b) => b.timestamp - a.timestamp);
    if (diaperEntries.length >= 2) {
      const avgGap = (diaperEntries[0].timestamp - diaperEntries[Math.min(5, diaperEntries.length - 1)].timestamp) / Math.min(5, diaperEntries.length - 1);
      const nextDiaper = diaperEntries[0].timestamp + avgGap;
      const dueIn = Math.max(0, Math.floor((nextDiaper - now) / 60000));
      if (dueIn < 120) {
        result.push({ id: 'next-diaper', trackerId: 'diaper', label: 'Next Diaper', emoji: '👶', color: '#8B5CF6', dueInMinutes: dueIn, predictedTime: format(new Date(nextDiaper), 'h:mm a'), confidence: Math.min(85, 55 + diaperEntries.length * 3) });
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
          <TouchableOpacity key={pred.id} onPress={() => { const config = TRACKER_CONFIGS[pred.trackerId]; const action = config?.subActions[0]; if (action) onEventPress(pred.trackerId, action); }} style={[styles.predictorCard, { borderColor: `${pred.color}25` }]} activeOpacity={0.85}>
            <LinearGradient colors={[`${pred.color}08`, `${pred.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={styles.predictorTop}>
              <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
              <View style={[styles.predictorConfidenceBadge, { backgroundColor: `${pred.color}12` }]}>
                <Text style={[styles.predictorConfidenceText, { color: pred.color }]}>{pred.confidence}%</Text>
              </View>
            </View>
            <Text style={[styles.predictorLabel, { color: theme.text.primary }]}>{pred.label}</Text>
            <Text style={[styles.predictorTime, { color: pred.color }]}>{pred.dueInMinutes === 0 ? 'Due now!' : pred.dueInMinutes < 60 ? `In ${pred.dueInMinutes}m` : `In ${Math.floor(pred.dueInMinutes / 60)}h ${pred.dueInMinutes % 60}m`}</Text>
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

// ─── SMART DAILY GOALS ───────────────────────────────────────────────────

const SmartDailyGoals = React.memo(({ entries, onGoalPress }: { entries: any[]; onGoalPress: (trackerId: string) => void }) => {
  const theme = useHubTheme();
  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const goals = useMemo((): DailyGoal[] => {
    const todayEntries = entries.filter(e => e?.timestamp >= today);

    return [
      { id: 'feed-goal', label: 'Feeds', icon: '🍼', target: 8, current: todayEntries.filter(e => e.trackerId === 'feed').length, color: '#fa709a', unit: 'feeds' },
      { id: 'sleep-goal', label: 'Sleep', icon: '🌙', target: 14, current: Math.floor(todayEntries.filter(e => e.trackerId === 'sleep').reduce((sum, e) => sum + (e.duration || 0), 0) / 60), color: '#11998e', unit: 'hrs' },
      { id: 'diaper-goal', label: 'Diapers', icon: '👶', target: 6, current: todayEntries.filter(e => e.trackerId === 'diaper').length, color: '#8B5CF6', unit: 'changes' },
      { id: 'milestone-goal', label: 'Moments', icon: '🏆', target: 1, current: todayEntries.filter(e => e.trackerId === 'milestone').length, color: '#ffd700', unit: 'logs' },
    ];
  }, [entries, today]);

  const completedCount = goals.filter(g => g.current >= g.target).length;

  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <SectionHeader title="Daily Goals" subtitle={`${completedCount}/${goals.length} completed`} icon="trophy-outline" />
      <View style={styles.goalsGrid}>
        {goals.map((goal) => {
          const progress = Math.min(goal.current / goal.target, 1);
          const isComplete = goal.current >= goal.target;
          return (
            <TouchableOpacity key={goal.id} onPress={() => onGoalPress(goal.id.split('-')[0])} style={[styles.goalCard, { borderColor: `${goal.color}18` }]} activeOpacity={0.85}>
              <LinearGradient colors={[`${goal.color}06`, `${goal.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={styles.goalTop}>
                <Text style={styles.goalIcon}>{goal.icon}</Text>
                {isComplete && <View style={[styles.goalCompleteBadge, { backgroundColor: '#10b98112' }]}><Ionicons name="checkmark-circle" size={14} color="#10b981" /></View>}
              </View>
              <View style={styles.goalNumbers}>
                <Text style={[styles.goalCurrent, { color: theme.text.primary }]}>{goal.current}</Text>
                <Text style={[styles.goalTarget, { color: theme.text.muted }]}>/{goal.target}</Text>
              </View>
              <Text style={[styles.goalLabel, { color: theme.text.muted }]}>{goal.label}</Text>
              <View style={styles.goalBarWrap}>
                <View style={[styles.goalBarBg, { backgroundColor: `${goal.color}10` }]}>
                  <View style={[styles.goalBarFill, { width: `${progress * 100}%`, backgroundColor: isComplete ? '#10b981' : goal.color }]} />
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

// ─── SMART INSIGHTS CAROUSEL ─────────────────────────────────────────────

const SmartInsightsCarousel = React.memo(({ entries, baby, onInsightPress }: { entries: any[]; baby: BabyProfile | null; onInsightPress: (insight: SmartInsight) => void }) => {
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
        items.push({ id: 'feed-gap', type: 'alert', title: 'Long Gap Between Feeds', description: `It's been ${Math.floor(gap)} hours since the last feed. Consider offering a feed soon.`, emoji: '⏰', color: '#f59e0b', priority: 'medium', action: { label: 'Log Feed', screen: 'AddEntry', params: { trackerId: 'feed' } }, timestamp: now });
      }
    }

    const sleepMins = todayEntries.filter((e: any) => e.trackerId === 'sleep').reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
    const ageMonths = differenceInMonths(new Date(), new Date(baby.birthDate));
    const expectedSleep = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    if (sleepMins > 0 && sleepMins / 60 < expectedSleep * 0.7) {
      items.push({ id: 'low-sleep', type: 'alert', title: 'Sleep Total Low Today', description: `Only ${Math.floor(sleepMins / 60)}h logged. Aim for ~${expectedSleep}h for ${ageMonths}mo.`, emoji: '😴', color: '#6366f1', priority: 'medium', action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } }, timestamp: now });
    }

    const uniqueDays = new Set(entries.map((e: any) => format(new Date(e.timestamp), 'yyyy-MM-dd'))).size;
    if (uniqueDays >= 7) {
      items.push({ id: 'tracking-streak', type: 'streak', title: `${uniqueDays}-Day Tracking Streak!`, description: 'Great consistency! Your data is getting richer and predictions more accurate.', emoji: '🔥', color: '#f59e0b', priority: 'low', action: { label: 'View Stats', screen: 'Timeline' }, timestamp: now });
    }

    const growthEntries = entries.filter((e: any) => e.trackerId === 'growth');
    if (growthEntries.length > 0) {
      const lastGrowth = Math.max(...growthEntries.map((e: any) => e.timestamp));
      const daysSince = differenceInDays(new Date(), new Date(lastGrowth));
      if (daysSince > 14) {
        items.push({ id: 'growth-check', type: 'prediction', title: 'Growth Check Due', description: `Last measurement was ${daysSince} days ago. Time for a new measurement!`, emoji: '📏', color: '#43e97b', priority: 'low', action: { label: 'Measure', screen: 'AddEntry', params: { trackerId: 'growth' } }, timestamp: now });
      }
    }

    const milestoneEntries = entries.filter((e: any) => e.trackerId === 'milestone');
    if (milestoneEntries.length === 0 && ageMonths >= 3) {
      items.push({ id: 'first-milestone', type: 'tip', title: 'Log First Milestone', description: 'At this age, babies start reaching exciting milestones. Log them to track progress!', emoji: '🏆', color: '#ffd700', priority: 'low', action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } }, timestamp: now });
    }

    return items.sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return order[a.priority] - order[b.priority]; }).slice(0, 4);
  }, [entries, baby]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(320).springify()}>
      <SectionHeader title="Smart Insights" subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`} icon="sparkles-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightsScroll}>
        {insights.map((insight) => (
          <TouchableOpacity key={insight.id} onPress={() => onInsightPress(insight)} style={[styles.insightCard, { borderLeftColor: insight.color, borderLeftWidth: 3 }]} activeOpacity={0.85}>
            <LinearGradient colors={[`${insight.color}08`, `${insight.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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

// ─── TRACKER CARDS GRID ──────────────────────────────────────────────────

const TrackerCardsGrid = React.memo(({ 
  trackerCards, pinnedIds, hiddenIds, onTrackerPress, onCustomPress, onPinToggle, onBrowseAll, onShowHidden,
}: { 
  trackerCards: any[]; pinnedIds: string[]; hiddenIds: string[];
  onTrackerPress: (id: string, hasSub: boolean) => void; onCustomPress: () => void;
  onPinToggle: (id: string) => void; onBrowseAll: () => void; onShowHidden: () => void;
}) => {
  const theme = useHubTheme();

  const visibleTrackers = useMemo(() => trackerCards.filter(t => !hiddenIds.includes(t.id)), [trackerCards, hiddenIds]);
  const pinned = useMemo(() => visibleTrackers.filter(t => pinnedIds.includes(t.id)), [visibleTrackers, pinnedIds]);
  const hasHidden = hiddenIds.length > 0;
  
  // Only show categories that have trackers
  const categories = useMemo(() => {
    const cats = new Set<string>();
    visibleTrackers.forEach(t => {
      if (!pinnedIds.includes(t.id) && t.category) {
        cats.add(t.category);
      }
    });
    return [...cats];
  }, [visibleTrackers, pinnedIds]);

  return (
    <Animated.View entering={FadeInUp.delay(360).springify()}>
      <SectionHeader 
        title="Trackers" 
        subtitle={`${visibleTrackers.length} active${hasHidden ? `, ${hiddenIds.length} hidden` : ''}`} 
        icon="grid-outline" 
        action={onBrowseAll} 
        actionLabel="Browse All" 
      />

      {hasHidden && (
        <TouchableOpacity 
          onPress={onShowHidden} 
          style={[styles.hiddenBanner, { backgroundColor: `${theme.primary}10`, borderRadius: RADIUS.md }]}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-off-outline" size={16} color={theme.primary} />
          <Text style={[styles.hiddenBannerText, { color: theme.primary }]}>
            {hiddenIds.length} tracker{hiddenIds.length > 1 ? 's' : ''} hidden — tap to manage
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </TouchableOpacity>
      )}

      {pinned.length > 0 && (
        <View style={{ marginBottom: SPACING.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: SPACING.lg, marginBottom: 10 }}>
            <Ionicons name="pin" size={14} color={theme.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pinned</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerScroll}>
            {pinned.map((tracker) => (
              <TouchableOpacity 
                key={tracker.id} 
                onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)} 
                onLongPress={() => onPinToggle(tracker.id)} 
                style={styles.trackerFabCard} 
                activeOpacity={0.85}
              >
                <LinearGradient colors={tracker.gradient} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={styles.trackerFabContent}>
                  <Text style={styles.trackerFabEmoji}>{tracker.emoji}</Text>
                  <Text style={styles.trackerFabTitle}>{tracker.title}</Text>
                  <View style={styles.trackerFabMeta}>
                    <Text style={styles.trackerFabCount}>{tracker.count} logs</Text>
                    {tracker.lastEntry && <Text style={styles.trackerFabLast}>{tracker.lastEntry}</Text>}
                  </View>
                </View>
                <View style={[styles.trackerFabArrow, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Ionicons name="pin" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {categories.map(cat => {
        const catTrackers = visibleTrackers.filter(t => t.category === cat && !pinnedIds.includes(t.id));
        if (catTrackers.length === 0) return null;
        return (
          <View key={cat} style={styles.trackerCategorySection}>
            <View style={styles.trackerCategoryHeader}>
              <View style={[styles.trackerCategoryDot, { backgroundColor: CATEGORY_COLORS[cat] || theme.primary }]} />
              <Text style={[styles.trackerCategoryLabel, { color: theme.text.muted }]}>{cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerScroll}>
              {catTrackers.map((tracker) => (
                <TouchableOpacity 
                  key={tracker.id} 
                  onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)} 
                  onLongPress={() => onPinToggle(tracker.id)} 
                  style={styles.trackerFabCard} 
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={tracker.gradient} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <View style={styles.trackerFabContent}>
                    <Text style={styles.trackerFabEmoji}>{tracker.emoji}</Text>
                    <Text style={styles.trackerFabTitle}>{tracker.title}</Text>
                    <View style={styles.trackerFabMeta}>
                      <Text style={styles.trackerFabCount}>{tracker.count} logs</Text>
                      {tracker.lastEntry && <Text style={styles.trackerFabLast}>{tracker.lastEntry}</Text>}
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

      <TouchableOpacity onPress={onCustomPress} style={[styles.customTrackerBtn, { borderColor: theme.surface.border }]} activeOpacity={0.8}>
        <LinearGradient colors={[`${theme.primary}10`, `${theme.primary}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={[styles.customTrackerIcon, { backgroundColor: `${theme.primary}15` }]}>
          <Ionicons name="add" size={22} color={theme.primary} />
        </View>
        <Text style={[styles.customTrackerText, { color: theme.primary }]}>Create Custom Tracker</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});
TrackerCardsGrid.displayName = 'TrackerCardsGrid';

// ─── QUICK LOG STRIP ─────────────────────────────────────────────────────

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
            <LinearGradient colors={[`${shortcut.color}10`, `${shortcut.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Ionicons name={shortcut.icon} size={18} color={shortcut.color} />
            <Text style={[styles.quickLogLabel, { color: shortcut.color }]}>{shortcut.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
QuickLogStrip.displayName = 'QuickLogStrip';

// ─── RECENT ACTIVITY LIST ───────────────────────────────────────────────

interface DayGroup {
  title: string;
  date: Date;
  events: any[];
}

const RecentActivityList = React.memo(({ entries, onViewAll, onEntryPress }: { entries: any[]; onViewAll: () => void; onEntryPress: (entry: any) => void }) => {
  const theme = useHubTheme();
  const { borderRadiusValue = 14 } = useCustomization();

  // Group entries by day - matching HomeScreen/Timeline style
  const groups = useMemo((): DayGroup[] => {
    const sorted = [...(entries || [])]
      .filter((e: any) => e?.timestamp && typeof e.timestamp === 'number' && !isNaN(e.timestamp))
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 12);

    const result: DayGroup[] = [];
    let current: DayGroup | null = null;
    sorted.forEach((event: any) => {
      const eventDate = new Date(event.timestamp);
      if (!current || !isSameDay(current.date, eventDate)) {
        current = { title: getDateTitle(event.timestamp), date: eventDate, events: [] };
        result.push(current);
      }
      (current as DayGroup).events.push(event);
    });
    return result;
  }, [entries]);

  if (groups.length === 0) {
    return (
      <Animated.View entering={FadeInUp.delay(440).springify()}>
        <SectionHeader title="Recent Activity" subtitle="Latest logs" icon="time-outline" action={onViewAll} actionLabel="Timeline" />
        <View style={[styles.emptyState, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: borderRadiusValue, padding: 32 }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="time-outline" size={40} color={theme.text.muted} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: theme.text.primary }]}>No activity yet</Text>
          <Text style={[styles.emptyStateSubtitle, { color: theme.text.secondary }]}>
            Your logged entries will appear here, just like on the Timeline.
          </Text>
          <TouchableOpacity
            style={[styles.logFirstBtn, { backgroundColor: theme.primary, borderRadius: borderRadiusValue }]}
            onPress={onViewAll}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.logFirstBtnText}>Log First Activity</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(440).springify()}>
      <SectionHeader title="Recent Activity" subtitle="Latest logs" icon="time-outline" action={onViewAll} actionLabel="Timeline" />
      <View>
        {groups.map((group, groupIndex) => (
          <View key={`${group.title}-${groupIndex}`} style={styles.daySection}>
            <Animated.View entering={FadeInUp.delay(groupIndex * 80).springify()}>
              <View style={styles.dateHeaderContainer}>
                <Text style={[styles.dateHeader, { color: theme.text.primary }]}>{group.title}</Text>
                <View style={[styles.dateBadge, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.dateBadgeText, { color: theme.primary }]}>{group.events.length}</Text>
                </View>
              </View>

              <View>
                {group.events.map((event: any, eventIndex: number) => {
                  const cfg = TRACKER_CONFIGS[event?.trackerId || event?.type] || TRACKER_CONFIGS.default;
                  const isLast = eventIndex === group.events.length - 1;
                  const time = event?.timestamp ? format(event.timestamp, 'h:mm a') : '';
                  const fullDate = event?.timestamp ? format(event.timestamp, 'MMM d, h:mm a') : '';
                  const title = event?.title || event?.name || cfg?.label || 'Activity';

                  return (
                    <Animated.View
                      key={event?.id || `evt-${groupIndex}-${eventIndex}`}
                      entering={FadeInUp.delay(groupIndex * 80 + eventIndex * 50).springify()}
                    >
                      <View style={styles.eventRow}>
                        {/* Time column with tracker-colored line */}
                        <View style={styles.timeColumn}>
                          <Text style={[styles.timeText, { color: cfg?.color || theme.primary }]}>{time}</Text>
                          {!isLast && <View style={[styles.timelineLine, { backgroundColor: `${cfg?.color || theme.primary}30` }]} />}
                        </View>

                        {/* Entry card — Timeline look, theme-aware text */}
                        <TouchableOpacity
                          style={styles.eventCardContainer}
                          onPress={() => onEntryPress(event)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.entryCard, { borderRadius: borderRadiusValue || 14, borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                            <LinearGradient
                              colors={theme.isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                              style={StyleSheet.absoluteFill}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            />
                            <View style={styles.entryCardContent}>
                              <View style={styles.entryCardHeader}>
                                <View style={[styles.entryIconBg, { backgroundColor: `${cfg?.color || theme.primary}14` }]}>
                                  <Text style={styles.entryEmoji}>{cfg?.emoji || '•'}</Text>
                                </View>
                                <View style={styles.entryInfo}>
                                  <Text style={[styles.entryTitle, { color: theme.text.primary }]} numberOfLines={1}>
                                    {title}
                                  </Text>
                                  <Text style={[styles.entryMeta, { color: theme.text.secondary }]} numberOfLines={1}>
                                    {fullDate}
                                    {event?.loggedByName ? ` • by ${event.loggedByName}` : ''}
                                  </Text>
                                </View>
                                <View style={[styles.entryTypeBadge, { backgroundColor: `${cfg?.color || theme.primary}12` }]}>
                                  <Text style={[styles.entryTypeText, { color: cfg?.color || theme.primary }]}>{cfg?.label || 'Activity'}</Text>
                                </View>
                              </View>
                              {(event?.details || event?.notes) ? (
                                <Text style={[styles.entryNotes, { color: theme.text.secondary }]} numberOfLines={2}>
                                  {event?.details || event?.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        ))}

        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: theme.primary }]}>View Full Timeline</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
RecentActivityList.displayName = 'RecentActivityList';

// ─── TRACKER ACTION MODAL ───────────────────────────────────────────────

const TrackerActionModal = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean; trackerId: string | null; onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const theme = useHubTheme();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 }); opacity.value = withTiming(1, { duration: 280 }); } 
    else { scale.value = withTiming(0.95, { duration: 200 }); opacity.value = withTiming(0, { duration: 200 }); }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋', color: '#667eea', gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity', category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalContent, animStyle, { borderRadius: Math.max(28, borderRadiusValue * 2.5), backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff'), shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 20 }]} onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
          <View style={styles.modalDragHandle}>
            <View style={[styles.modalDragPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }]} />
          </View>
          <LinearGradient colors={config.gradient} style={[styles.modalHeader, { borderTopLeftRadius: Math.max(28, borderRadiusValue * 2.5), borderTopRightRadius: Math.max(28, borderRadiusValue * 2.5) }]}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalEmoji}>{config.emoji}</Text>
              <Text style={styles.modalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={styles.modalDescription}>{config.description}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
          <View style={[styles.modalBody, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff') }]}>
            <Text style={[styles.modalSectionTitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>WHAT WOULD YOU LIKE TO LOG?</Text>
            <View style={styles.subActionsGrid}>
              {config.subActions.map((action, index) => (
                <Animated.View key={action.id} entering={FadeInUp.delay(index * 60).springify()} style={{ width: '50%', padding: 6 }}>
                  <TouchableOpacity style={[styles.subActionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)', borderColor: `${action.color}40`, borderRadius: Math.max(16, borderRadiusValue), borderWidth: 1.5 }]} onPress={() => onSelect(trackerId, action)} activeOpacity={0.8}>
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}12` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, { color: fullThemeColors?.text || (isDark ? '#fff' : '#1a1a1a') }]}>{action.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});
TrackerActionModal.displayName = 'TrackerActionModal';

// ─── BABY SWITCHER PILL ──────────────────────────────────────────────────

const BabySwitcherPill = React.memo(({ baby, onPress }: { baby: BabyProfile | null; onPress: () => void }) => {
  const { isDark } = useCustomization();
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  if (!baby) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
        <LinearGradient colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={[styles.babyPillNoBabyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102,126,234,0.1)' }]}>
          <Ionicons name="add-circle" size={28} color={isDark ? '#a3bffa' : '#667eea'} />
        </View>
        <View style={styles.babyPillText}>
          <Text style={[styles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>Add Baby</Text>
          <Text style={[styles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>Tap to create profile</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
      <LinearGradient colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SafeBabyAvatar avatar={baby?.avatar} gender={baby?.gender} size={36} showBadge={false} />
      <View style={styles.babyPillText}>
        <Text style={[styles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{safeStr(baby?.name, 'Baby')}</Text>
        <Text style={[styles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>{age.shortDisplay}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
    </TouchableOpacity>
  );
});
BabySwitcherPill.displayName = 'BabySwitcherPill';

// ─── TODAY SUMMARY BAR ──────────────────────────────────────────────────

const TodaySummaryBar = React.memo(({ todayCount, entries }: any) => {
  const theme = useHubTheme();

  const today = useMemo(() => startOfDay(new Date()).getTime(), []);
  const todayEntries = useMemo(() => entries.filter((e: any) => e?.timestamp >= today), [entries, today]);
  const lastEntry = todayEntries[0];
  const timeSinceLast = lastEntry ? formatDistanceToNow(lastEntry.timestamp) : null;

  const trackerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayEntries.forEach((e: any) => { counts[e.trackerId] = (counts[e.trackerId] || 0) + 1; });
    return Object.entries(counts).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3);
  }, [todayEntries]);

  return (
    <GlassCard style={styles.todayBar} shadow="sm">
      <View style={styles.todayBarLeft}>
        <View style={[styles.todayBarIcon, { backgroundColor: `${theme.primary}20` }]}>
          <Ionicons name="today-outline" size={18} color={theme.primary} />
        </View>
        <View>
          <Text style={[styles.todayBarCount, { color: theme.text.primary }]}>
            {safeNum(todayCount, 0)} <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text.muted }}>entries today</Text>
          </Text>
          {timeSinceLast && <Text style={[styles.todayBarLast, { color: theme.text.muted }]}>Last: {timeSinceLast}</Text>}
        </View>
      </View>
      <View style={styles.todayBarDots}>
        {trackerCounts.map(([trackerId, count]: any) => {
          const config = TRACKER_CONFIGS[trackerId];
          return <View key={trackerId} style={[styles.todayBarDot, { backgroundColor: config?.color || theme.primary }]}><Text style={styles.todayBarDotText}>{config?.emoji || '📋'} {count}</Text></View>;
        })}
      </View>
    </GlassCard>
  );
});
TodaySummaryBar.displayName = 'TodaySummaryBar';

// ─── HIDDEN TRACKERS MODAL ──────────────────────────────────────────────

const HiddenTrackersModal = React.memo(({
  visible,
  hiddenTrackers,
  onClose,
  onUnhide,
  theme,
}: {
  visible: boolean;
  hiddenTrackers: any[];
  onClose: () => void;
  onUnhide: (id: string) => void;
  theme: any;
}) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { 
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 }); 
      opacity.value = withTiming(1, { duration: 280 }); 
    } else { 
      scale.value = withTiming(0.95, { duration: 200 }); 
      opacity.value = withTiming(0, { duration: 200 }); 
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }], 
    opacity: opacity.value 
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.hiddenModalContent, animStyle, { backgroundColor: theme.isDark ? '#1a1a2e' : '#ffffff' }]}>
          <View style={styles.hiddenModalHeader}>
            <Text style={[styles.hiddenModalTitle, { color: theme.text.primary }]}>Hidden Trackers</Text>
            <Text style={[styles.hiddenModalSubtitle, { color: theme.text.secondary }]}>
              {hiddenTrackers.length} tracker{hiddenTrackers.length > 1 ? 's' : ''} hidden
            </Text>
            <TouchableOpacity style={styles.hiddenModalClose} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.hiddenModalList} showsVerticalScrollIndicator={false}>
            {hiddenTrackers.length === 0 ? (
              <View style={styles.hiddenEmptyState}>
                <Ionicons name="eye-off-outline" size={48} color={theme.text.muted} />
                <Text style={[styles.hiddenEmptyText, { color: theme.text.secondary }]}>No hidden trackers</Text>
              </View>
            ) : (
              hiddenTrackers.map((tracker) => (
                <View key={tracker.id} style={[styles.hiddenTrackerItem, { borderBottomColor: theme.surface.border }]}>
                  <View style={styles.hiddenTrackerLeft}>
                    <Text style={styles.hiddenTrackerEmoji}>{tracker.emoji}</Text>
                    <View>
                      <Text style={[styles.hiddenTrackerName, { color: theme.text.primary }]}>{tracker.title}</Text>
                      <Text style={[styles.hiddenTrackerDesc, { color: theme.text.muted }]}>{tracker.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => onUnhide(tracker.id)} 
                    style={[styles.hiddenUnhideBtn, { backgroundColor: `${theme.primary}15` }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye-outline" size={16} color={theme.primary} />
                    <Text style={[styles.hiddenUnhideText, { color: theme.primary }]}>Unhide</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity 
            onPress={onClose} 
            style={[styles.hiddenModalDone, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.hiddenModalDoneText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});
HiddenTrackersModal.displayName = 'HiddenTrackersModal';

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<HubNavigationProp>();
  const insets = useSafeAreaInsets();
  const { fullThemeColors, themeColors, isDark, borderRadiusValue, triggerHaptic } = useCustomization();
  const tracker = useTracker();
const { entries, getEntries, trackers } = tracker;
const { getRecentTimelineEvents } = useActivity();
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError, confirm: showConfirm } = useSweetAlert();
  const achievements = useTrackerAchievements();

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [pinnedTrackerIds, setPinnedTrackerIds] = useState<string[]>([]);
  const [hiddenTrackerIds, setHiddenTrackerIds] = useState<string[]>([]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const currentBabyRef = useRef(currentBaby);
  currentBabyRef.current = currentBaby;

  const theme = useHubTheme();

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!babyLoading && !currentBaby && isMountedRef.current) {
      const timer = setTimeout(() => setShowBabyRequiredModal(true), 400);
      return () => clearTimeout(timer);
    }
  }, [babyLoading, currentBaby]);

  // ─── Load pinned/hidden from storage ─────────────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const init = async () => {
      setIsRefreshing(true);
      try {
        await loadBabies();
        const [pinned, hidden] = await Promise.all([
          AsyncStorage.getItem('@littleloom_pinned_trackers'),
          AsyncStorage.getItem('@littleloom_hidden_trackers'),
        ]);
        if (pinned) setPinnedTrackerIds(JSON.parse(pinned));
        if (hidden) setHiddenTrackerIds(JSON.parse(hidden));
      } catch (err) {
        if (isMountedRef.current) showError('Error', 'Failed to load baby profiles');
      } finally {
        if (isMountedRef.current) setIsRefreshing(false);
      }
    };
    init();
  }, []);

  // ─── Persist pinned/hidden ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedTrackerIds)).catch(() => {});
  }, [pinnedTrackerIds]);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenTrackerIds)).catch(() => {});
  }, [hiddenTrackerIds]);

  useEffect(() => {
    const tick = async () => {
      if (currentBabyRef.current && isMountedRef.current) await refreshCurrentBaby();
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [refreshCurrentBaby]);

  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const todayCount = useMemo(() => {
    if (!currentBaby) return 0;
    return entries.filter((e: any) => e?.timestamp >= today).length;
  }, [entries, today, currentBaby]);

    // ─── Combined timeline events (same as HomeScreen) ──────────────────────
  const allTimelineEvents = useMemo(() => {
    if (!currentBaby) return [];
    
    // Get entries from tracker context
    const trackerList = (entries || []).filter((e: any) => e?.timestamp && e?.timestamp > 0);
    
    // Get activity events
    let activityEvents: any[] = [];
    try {
      if (getRecentTimelineEvents) {
        const events = getRecentTimelineEvents(50, currentBaby?.id);
        activityEvents = Array.isArray(events) ? events : [];
      }
    } catch (e) {
      console.warn('Failed to get recent timeline events:', e);
    }
    
    // Merge and deduplicate by id
    const merged = [...trackerList];
    (activityEvents || []).forEach((ae: any) => {
      if (ae && ae.id && !merged.find((me: any) => me?.id === ae.id)) {
        merged.push(ae);
      }
    });
    
    // Sort by timestamp descending (newest first)
    const sorted = merged
      .filter((e: any) => e?.timestamp && typeof e.timestamp === 'number' && e.timestamp > 0)
      .sort((a: any, b: any) => (b?.timestamp || 0) - (a?.timestamp || 0));
    
    // Log for debugging
    console.log(`[UniversalTrackerHub] allTimelineEvents count: ${sorted.length}`);
    if (sorted.length > 0) {
      console.log(`[UniversalTrackerHub] Latest entry: ${new Date(sorted[0].timestamp).toISOString()}`);
    }
    
    return sorted.slice(0, 50);
  }, [entries, currentBaby?.id, getRecentTimelineEvents]);
  
  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    
    const sourceTrackers = trackers?.length > 0
      ? trackers
      : Object.keys(TRACKER_CONFIGS).map(id => ({
          id, name: id.charAt(0).toUpperCase() + id.slice(1),
          emoji: TRACKER_CONFIGS[id].emoji, color: TRACKER_CONFIGS[id].color,
          gradient: TRACKER_CONFIGS[id].gradient, category: TRACKER_CONFIGS[id].category,
        }));

    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const config = TRACKER_CONFIGS[id];
      const entriesForTracker = getEntries(id);
      const lastEntry = entriesForTracker[0];
      return {
        id, title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: (tracker.gradient || config?.gradient || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) { setSelectedTrackerId(trackerId); setShowActionModal(true); } 
    else { navigation.navigate('AddEntry', { trackerId }); }
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
      navigation.navigate('SwitchBaby', { returnTo: 'UniversalTrackerHub', returnLabel: 'Tracker Hub' });
    } else {
      showConfirm('Switch Baby Profile', 'You only have one baby profile. Would you like to add another?',
        () => navigation.navigate('CreateBabyProfile'), () => {}, 'Add New', 'Cancel');
    }
  }, [babies.length, navigation, showConfirm]);

  const handleViewTimeline = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('Timeline'); }, [navigation]);
  const handleViewAchievements = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('Achievements'); }, [navigation]);
  const handleCreateCustom = useCallback(() => { HAPTIC_MEDIUM(); navigation.navigate('CreateCustomTracker'); }, [navigation]);
  const handleBrowseAll = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('AllTrackers'); }, [navigation]);

  const handlePinToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedTrackerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleUnhideTracker = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenTrackerIds(prev => prev.filter(x => x !== id));
    showSuccess('Tracker Unhidden', 'The tracker has been restored to your list.');
  }, [showSuccess]);

  const handleShowHidden = useCallback(() => {
    HAPTIC_LIGHT();
    setShowHiddenModal(true);
  }, []);

  const handleWellnessPress = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('GrowthDashboard'); }, [navigation]);
  const handleSleepPress = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('Timeline', { type: 'sleep' }); }, [navigation]);
  const handleFeedingPress = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('Timeline', { type: 'feed' }); }, [navigation]);
  const handleDayPress = useCallback((day: string) => { HAPTIC_LIGHT(); navigation.navigate('Timeline'); }, [navigation]);
  const handleEmergencyPress = useCallback((type: string) => {
    HAPTIC_MEDIUM();
    switch (type) {
      case 'fever': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'temperature' } }); break;
      case 'medicine': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'medicine' } }); break;
      case 'symptom': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'symptom' } }); break;
      case 'doctor': break;
    }
  }, [navigation]);

  const handleEntryPress = useCallback((entry: any) => {
    if (!entry?.id) return;
    navigation.navigate('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId });
  }, [navigation]);

  const handleInsightPress = useCallback((insight: SmartInsight) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) navigation.navigate(insight.action.screen, insight.action.params);
  }, [navigation]);

  const handleGoalPress = useCallback((trackerId: string) => {
    HAPTIC_LIGHT();
    handleTrackerPress(trackerId, true);
  }, [handleTrackerPress]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await loadBabies(); await refreshCurrentBaby(); } catch (e) { console.warn('Refresh failed', e); } finally { setIsRefreshing(false); }
  }, [loadBabies, refreshCurrentBaby]);

  const hiddenTrackers = useMemo(() => {
    return trackerCards.filter(t => hiddenTrackerIds.includes(t.id));
  }, [trackerCards, hiddenTrackerIds]);

  // ─── RENDER ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors?.background || '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient colors={isDark ? [fullThemeColors?.background || '#0a0a1a', fullThemeColors?.surface || '#12122a'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: fullThemeColors?.text || '#1a1a1a' }]}>{safeStr(currentBaby?.name, 'Baby')}'s Hub</Text>
        <Text style={[styles.stickySubtitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>{format(new Date(), 'EEEE, MMM d')}</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColors?.primary || '#667eea'} colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']} />}
      >
        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity 
            style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]} 
            onPress={handleViewTimeline} 
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={22} color={fullThemeColors?.textSecondary || '#64748b'} />
          </TouchableOpacity>
          <BabySwitcherPill baby={currentBaby} onPress={handleSwitchBaby} />
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]} 
              onPress={handleViewAchievements} 
              activeOpacity={0.8}
            >
              <Ionicons name="trophy-outline" size={22} color={fullThemeColors?.textSecondary || '#64748b'} />
              {achievements?.stats?.unlocked > 0 && (
                <View style={styles.achievementBadge}>
                  <Text style={styles.achievementBadgeText}>{achievements.stats.unlocked}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.addBtn, { backgroundColor: themeColors?.primary || '#667eea' }]} 
              onPress={() => {
                HAPTIC_MEDIUM();
                navigation.navigate('TimelinePicker');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── TODAY SUMMARY ────────────────────────────────────────────── */}
        <TodaySummaryBar todayCount={todayCount} entries={entries} />

        {/* ─── WELLNESS SCORE ────────────────────────────────────────────── */}
        <WellnessScoreCard entries={entries} onPress={handleWellnessPress} />

        {/* ─── QUICK LOG ─────────────────────────────────────────────────── */}
        <QuickLogStrip onQuickLog={handleQuickLog} />

        {/* ─── SLEEP & FEEDING INSIGHTS ────────────────────────────────── */}
        <SleepQualityAnalyzer entries={entries} onPress={handleSleepPress} />
        <FeedingPatternCard entries={entries} onPress={handleFeedingPress} />

        {/* ─── WEEKLY SUMMARY ──────────────────────────────────────────── */}
        <WeeklySummaryStrip entries={entries} onDayPress={handleDayPress} />

        {/* ─── EMERGENCY ACTIONS ───────────────────────────────────────── */}
        <EmergencyQuickActions onEmergencyPress={handleEmergencyPress} />

        {/* ─── NEXT EVENT PREDICTOR ────────────────────────────────────── */}
        <NextEventPredictor entries={entries} onEventPress={handleSubActionSelect} />

        {/* ─── DAILY GOALS ───────────────────────────────────────────────── */}
        <SmartDailyGoals entries={entries} onGoalPress={handleGoalPress} />

        {/* ─── SMART INSIGHTS ───────────────────────────────────────────── */}
        <SmartInsightsCarousel entries={entries} baby={currentBaby} onInsightPress={handleInsightPress} />

        {/* ─── TRACKERS ──────────────────────────────────────────────────── */}
        <TrackerCardsGrid 
          trackerCards={trackerCards} 
          pinnedIds={pinnedTrackerIds} 
          hiddenIds={hiddenTrackerIds} 
          onTrackerPress={handleTrackerPress} 
          onCustomPress={handleCreateCustom} 
          onPinToggle={handlePinToggle} 
          onBrowseAll={handleBrowseAll}
          onShowHidden={handleShowHidden}
        />

        {/* ─── RECENT ACTIVITY ──────────────────────────────────────────── */}
        <RecentActivityList entries={allTimelineEvents.length > 0 ? allTimelineEvents : entries} onViewAll={handleViewTimeline} onEntryPress={handleEntryPress} />

        {/* ─── QUICK LINKS ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(480).springify()} style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
          <SectionHeader title="Quick Links" icon="link-outline" />
          <View style={styles.quickLinksGrid}>
            {[
              { label: 'Growth', icon: 'trending-up-outline', screen: 'GrowthDashboard' as const, color: '#43e97b' },
              { label: 'Gallery', icon: 'images-outline', screen: 'Gallery' as const, color: '#10b981' },
              { label: 'Family', icon: 'people-outline', screen: 'FamilySharing' as const, color: '#8b5cf6' },
              { label: 'Report', icon: 'document-text-outline', screen: 'PediatricianPDFExport' as const, color: '#ef4444' },
              { label: 'Settings', icon: 'settings-outline', screen: 'BackupRestore' as const, color: '#64748b' },
            ].map((link) => (
              <TouchableOpacity 
                key={link.label} 
                onPress={() => { HAPTIC_LIGHT(); navigation.navigate(link.screen); }} 
                style={[styles.quickLinkBtn, { borderColor: `${link.color}25` }]} 
                activeOpacity={0.8}
              >
                <LinearGradient colors={[`${link.color}08`, `${link.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Ionicons name={link.icon as any} size={20} color={link.color} />
                <Text style={[styles.quickLinkText, { color: link.color }]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}
      <TrackerActionModal visible={showActionModal} trackerId={selectedTrackerId} onClose={() => setShowActionModal(false)} onSelect={handleSubActionSelect} />

      <HiddenTrackersModal 
        visible={showHiddenModal} 
        hiddenTrackers={hiddenTrackers} 
        onClose={() => setShowHiddenModal(false)} 
        onUnhide={handleUnhideTracker}
        theme={theme}
      />

      {/* ─── BABY REQUIRED MODAL ───────────────────────────────────────── */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.modalIconWrap}>
              <LinearGradient colors={[(themeColors?.secondary || '#fa709a'), (themeColors?.primary || '#667eea')]} style={styles.modalIconGradient}>
                <Ionicons name="people-outline" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.modalTitle, { color: fullThemeColors?.text || '#1a1a1a' }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalDesc, { color: fullThemeColors?.textSecondary || '#64748b' }]}>Create a baby profile to start tracking activities and unlock all features.</Text>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: themeColors?.primary || '#667eea' }]} onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }}>
              <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setShowBabyRequiredModal(false)}>
              <Text style={[styles.modalSecondaryBtnText, { color: fullThemeColors?.textMuted || '#94a3b8' }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Glass Card ──────────────────────────────────────────────────────
  glassCard: { 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg 
  },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  // ── Section Header ──────────────────────────────────────────────────
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.md, 
    marginTop: SPACING.md 
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionHeaderIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Sticky Header ──────────────────────────────────────────────────
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: SPACING.xl, 
    paddingBottom: SPACING.sm 
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ─────────────────────────────────────────────────────
  topHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg 
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  addBtn: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },

  // ── Achievement Badge ──────────────────────────────────────────────
  achievementBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  achievementBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Baby Pill ──────────────────────────────────────────────────────
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
    flex: 1 
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },
  babyPillNoBabyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // ── Today Bar ──────────────────────────────────────────────────────
  todayBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: SPACING.md, 
    borderRadius: RADIUS.md, 
    marginBottom: SPACING.lg 
  },
  todayBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayBarIcon: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  todayBarCount: { fontSize: 15, fontWeight: '700' },
  todayBarLast: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  todayBarDots: { flexDirection: 'row', gap: 6 },
  todayBarDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.xs },
  todayBarDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // ── Wellness Card ──────────────────────────────────────────────────
  wellnessCard: { padding: SPACING.lg, marginBottom: SPACING.lg },
  wellnessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  wellnessLeft: { flex: 1 },
  wellnessLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  wellnessScore: { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  wellnessScoreLabel: { fontSize: 13, fontWeight: '600' },
  wellnessRingWrap: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  wellnessRing: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  wellnessRingBg: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 6 },
  wellnessRingProgress: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent' },
  wellnessRingInner: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  wellnessBreakdown: { gap: SPACING.sm },
  wellnessBreakdownItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  wellnessBreakdownIcon: { fontSize: 16, width: 24 },
  wellnessBreakdownBarWrap: { flex: 1 },
  wellnessBreakdownBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  wellnessBreakdownBarFill: { height: '100%', borderRadius: 3 },
  wellnessBreakdownValue: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  // ── Sleep Card ─────────────────────────────────────────────────────
  sleepCard: { padding: SPACING.lg, alignItems: 'center' },
  sleepScoreRing: { marginBottom: SPACING.lg },
  sleepScoreValue: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  sleepScoreNum: { fontSize: 28, fontWeight: '800' },
  sleepScoreLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sleepMetrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.lg, marginBottom: SPACING.md },
  sleepMetric: { alignItems: 'center', gap: 4 },
  sleepMetricValue: { fontSize: 18, fontWeight: '800' },
  sleepMetricLabel: { fontSize: 11, fontWeight: '600' },
  sleepMetricDivider: { width: 1, height: 40, backgroundColor: 'rgba(0,0,0,0.06)' },
  sleepTrend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
  sleepTrendText: { fontSize: 13, fontWeight: '700' },

  // ── Feeding Card ───────────────────────────────────────────────────
  feedingCard: { padding: SPACING.lg },
  feedingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  feedingLastBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  feedingLastEmoji: { fontSize: 20 },
  feedingLastLabel: { fontSize: 11, fontWeight: '600' },
  feedingLastValue: { fontSize: 14, fontWeight: '800' },
  feedingNextBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedingNextText: { fontSize: 12, fontWeight: '700' },
  feedingStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl, marginBottom: SPACING.md },
  feedingStat: { alignItems: 'center' },
  feedingStatValue: { fontSize: 20, fontWeight: '800' },
  feedingStatLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  feedingStatDivider: { width: 1, height: 30 },
  feedingBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.xs },
  feedingBarFill: { height: '100%', borderRadius: 3 },
  feedingBarLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // ── Week Scroll ────────────────────────────────────────────────────
  weekScroll: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, paddingBottom: 4 },
  weekDay: { width: 64, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  weekDayName: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  weekDayNum: { fontSize: 18, fontWeight: '800' },
  weekDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  weekDot: { width: 20, height: 20, borderRadius: RADIUS.xs, justifyContent: 'center', alignItems: 'center' },
  weekDotText: { fontSize: 10 },
  weekTotal: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // ── Emergency Grid ─────────────────────────────────────────────────
  emergencyGrid: { flexDirection: 'row', marginHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.lg },
  emergencyBtn: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.sm },
  emergencyIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  emergencyLabel: { fontSize: 12, fontWeight: '700' },

  // ── Predictor Scroll ──────────────────────────────────────────────
  predictorScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  predictorCard: { width: 150, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1.5, overflow: 'hidden' },
  predictorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  predictorEmoji: { fontSize: 24 },
  predictorConfidenceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs },
  predictorConfidenceText: { fontSize: 10, fontWeight: '800' },
  predictorLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  predictorTime: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  predictorPredicted: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  predictorBarBg: { height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' },
  predictorBarFill: { height: '100%', borderRadius: 2 },

  // ── Goals Grid ─────────────────────────────────────────────────────
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  goalCard: { width: (SCREEN_WIDTH - 56) / 2, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1.5, overflow: 'hidden' },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  goalIcon: { fontSize: 22 },
  goalCompleteBadge: { padding: 4, borderRadius: RADIUS.sm },
  goalNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 4 },
  goalCurrent: { fontSize: 26, fontWeight: '800' },
  goalTarget: { fontSize: 14, fontWeight: '600' },
  goalLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalBarWrap: { marginTop: 8 },
  goalBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 3 },

  // ── Insights Scroll ───────────────────────────────────────────────
  insightsScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  insightCard: { width: 200, padding: SPACING.md, borderRadius: RADIUS.lg, overflow: 'hidden' },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  insightEmoji: { fontSize: 22 },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  insightActionText: { fontSize: 11, fontWeight: '700' },

  // ── Tracker Cards ──────────────────────────────────────────────────
  trackerCategorySection: { marginBottom: SPACING.lg },
  trackerCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.xl, marginBottom: 10 },
  trackerCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  trackerCategoryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  trackerScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  trackerFabCard: { width: 140, height: 120, padding: SPACING.md, borderRadius: RADIUS.lg, overflow: 'hidden' },
  trackerFabContent: { flex: 1, justifyContent: 'flex-end' },
  trackerFabEmoji: { fontSize: 28, marginBottom: 6 },
  trackerFabTitle: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  trackerFabMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trackerFabCount: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  trackerFabLast: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  trackerFabArrow: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // ── Custom Tracker ──────────────────────────────────────────────────
  customTrackerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderRadius: RADIUS.lg, 
    gap: 8, 
    borderWidth: 1.5, 
    borderStyle: 'dashed', 
    overflow: 'hidden' 
  },
  customTrackerIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  customTrackerText: { fontSize: 13, fontWeight: '700' },

  // ── Hidden Banner ──────────────────────────────────────────────────
  hiddenBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.md, 
    paddingVertical: SPACING.sm, 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.md,
    gap: 8 
  },
  hiddenBannerText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Quick Log ──────────────────────────────────────────────────────
  quickLogScroll: { paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: 4 },
  quickLogChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: SPACING.md, 
    paddingVertical: 10, 
    borderRadius: RADIUS.md, 
    borderWidth: 1.5, 
    overflow: 'hidden' 
  },
  quickLogLabel: { fontWeight: '700', fontSize: 12 },

  // ── History Card (Timeline Style) ──────────────────────────────────────
  daySection: { marginBottom: 20 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  dateBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  dateBadgeText: { fontSize: 12, fontWeight: '700' },
  eventRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { width: 58, alignItems: 'flex-end', paddingTop: 16 },
  timeText: { fontSize: 12, fontWeight: '700' },
  timelineLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  eventCardContainer: { flex: 1, paddingBottom: 14 },
  entryCard: { flex: 1, overflow: 'hidden', borderWidth: 1 },
  entryCardContent: { padding: 14, gap: 8 },
  entryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryIconBg: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  entryEmoji: { fontSize: 19 },
  entryInfo: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  entryMeta: { fontSize: 11, fontWeight: '500' },
  entryTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  entryTypeText: { fontSize: 10, fontWeight: '700' },
  entryNotes: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginLeft: 48 },
  viewAllButton: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  viewAllText: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  emptyStateSubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24, marginBottom: 18 },
  logFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  logFirstBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Quick Links ────────────────────────────────────────────────────
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickLinkBtn: { width: (SCREEN_WIDTH - 56) / 2, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', gap: 6, borderWidth: 1.5, overflow: 'hidden' },
  quickLinkText: { fontSize: 13, fontWeight: '700' },

  // ── Hidden Trackers Modal ──────────────────────────────────────────
  hiddenModalContent: { 
    width: SCREEN_WIDTH - 40, 
    maxHeight: SCREEN_HEIGHT * 0.75, 
    borderRadius: 28, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 20 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 40, 
    elevation: 20 
  },
  hiddenModalHeader: { padding: SPACING.lg, alignItems: 'center', position: 'relative' },
  hiddenModalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  hiddenModalSubtitle: { fontSize: 14, fontWeight: '500' },
  hiddenModalClose: { position: 'absolute', top: SPACING.md, right: SPACING.md, padding: 4 },
  hiddenModalList: { paddingHorizontal: SPACING.lg, maxHeight: 400 },
  hiddenTrackerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: SPACING.md, 
    borderBottomWidth: 1 
  },
  hiddenTrackerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  hiddenTrackerEmoji: { fontSize: 24 },
  hiddenTrackerName: { fontSize: 14, fontWeight: '700' },
  hiddenTrackerDesc: { fontSize: 12, fontWeight: '500' },
  hiddenUnhideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  hiddenUnhideText: { fontSize: 13, fontWeight: '600' },
  hiddenModalDone: { margin: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  hiddenModalDoneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hiddenEmptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  hiddenEmptyText: { fontSize: 16, fontWeight: '500' },

  // ── Action Modal ──────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: SCREEN_WIDTH - 40, maxHeight: SCREEN_HEIGHT * 0.7, overflow: 'hidden' },
  modalDragHandle: { paddingVertical: 12, alignItems: 'center' },
  modalDragPill: { width: 40, height: 5, borderRadius: 3 },
  modalHeader: { padding: 20, paddingTop: 24, alignItems: 'center' },
  modalHeaderContent: { alignItems: 'center' },
  modalEmoji: { fontSize: 44, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalDescription: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  modalCloseBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 14 },
  modalSectionTitle: { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 2, fontSize: 12 },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: { alignItems: 'center', padding: 12, gap: 8, borderWidth: 1.5 },
  subActionIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },

  // ── Baby Required Modal ────────────────────────────────────────────
  modalIconWrap: { marginBottom: SPACING.lg },
  modalIconGradient: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: 18, gap: 8, marginBottom: 12 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600' },
});