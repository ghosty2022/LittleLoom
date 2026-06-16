// UniversalTrackerHubScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import {  ActivityIndicator, AlertAnimated, Button, Dimensions, Modal, Pressable, ScrollView, Settings, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, type ViewStyle, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '../../components/EmptyState';
import { showError } from '@/utils/alert';
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
} from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../context/TrackerContext';
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatar } from '../../components/SafeAvatar';;
import { useSweetAlert } from '../../components/SweetAlert';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type HubNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'track' | 'stats' | 'quick';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface BabyAge {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  display: string;
  shortDisplay: string;
  stage: 'newborn' | 'infant' | 'baby' | 'toddler';
}

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

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

const DEFAULT_GRADIENTS: Record<string, [string, string]> = {
  feed: ['#fa709a', '#f5576c'],
  sleep: ['#11998e', '#38ef7d'],
  growth: ['#43e97b', '#38f9d7'],
  milestone: ['#ffd700', '#ffaa00'],
  medication: ['#ff6b6b', '#ee5a5a'],
  diaper: ['#8B5CF6', '#A78BFA'],
  pumping: ['#ec4899', '#f472b6'],
  potty: ['#667eea', '#764ba2'],
  temperature: ['#f97316', '#fb923c'],
  note: ['#64748b', '#94a3b8'],
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

const TABS: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'track', label: 'Track', icon: 'grid-outline' },
  { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { id: 'quick', label: 'Quick', icon: 'flash-outline' },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid-outline' as const },
  { id: 'essential', label: 'Essential', icon: 'star-outline' as const },
  { id: 'health', label: 'Health', icon: 'medical-outline' as const },
  { id: 'development', label: 'Growth', icon: 'trending-up-outline' as const },
  { id: 'care', label: 'Care', icon: 'heart-outline' as const },
];

const QUICK_LOG_SHORTCUTS = [
  { trackerId: 'feed', subActionId: 'breast_left', label: 'Feed L', icon: 'arrow-back-outline' as const, color: '#f472b6' },
  { trackerId: 'feed', subActionId: 'breast_right', label: 'Feed R', icon: 'arrow-forward-outline' as const, color: '#f472b6' },
  { trackerId: 'sleep', subActionId: 'nap', label: 'Nap', icon: 'sunny-outline' as const, color: '#10b981' },
  { trackerId: 'diaper', subActionId: 'wet', label: 'Wet', icon: 'water-outline' as const, color: '#3b82f6' },
  { trackerId: 'diaper', subActionId: 'dirty', label: 'Dirty', icon: 'flame-outline' as const, color: '#8B4513' },
  { trackerId: 'pumping', subActionId: 'both', label: 'Pump', icon: 'swap-horizontal-outline' as const, color: '#ec4899' },
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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

const getBabyAge = (birthDate?: string | Date): BabyAge => {
  if (!birthDate) {
    return { years: 0, months: 0, days: 0, totalDays: 0, display: 'Unknown', shortDisplay: '?', stage: 'newborn' };
  }
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) {
    return { years: 0, months: 0, days: 0, totalDays: 0, display: 'Invalid Date', shortDisplay: '?', stage: 'newborn' };
  }
  const totalDays = differenceInDays(now, birth);
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const days = totalDays % 30;
  let display: string, shortDisplay: string, stage: BabyAge['stage'];
  if (years > 0) {
    display = `${years}y ${months}m`;
    shortDisplay = `${years}y`;
    stage = 'toddler';
  } else if (months > 0) {
    display = `${months}m ${days}d`;
    shortDisplay = `${months}m`;
    stage = months < 6 ? 'infant' : 'baby';
  } else {
    display = `${days} days`;
    shortDisplay = `${days}d`;
    stage = 'newborn';
  }
  return { years, months, days, totalDays, display, shortDisplay, stage };
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

// ═══════════════════════════════════════════════════════════════
// MEMOIZED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Baby Switcher Pill ──────────────────────────────────────────

interface BabySwitcherPillProps {
  baby: BabyProfile | null;
  onPress: () => void;
  isDark: boolean;
}

const BabySwitcherPill = memo<BabySwitcherPillProps>(({ baby, onPress, isDark }) => {
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill} accessibilityRole="button">
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

// ─── Today Summary Bar ───────────────────────────────────────────

interface TodaySummaryBarProps {
  todayCount: number;
  entries: any[];
  themeColors: Record<string, string>;
  fullThemeColors: Record<string, string>;
  isDark: boolean;
}

const TodaySummaryBar = memo<TodaySummaryBarProps>(({
  todayCount, entries, themeColors, fullThemeColors, isDark,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayEntries = useMemo(() =>
    entries.filter(e => e?.timestamp >= today),
    [entries, today]
  );

  const lastEntry = todayEntries[0];
  const timeSinceLast = lastEntry ? formatDistanceToNow(lastEntry.timestamp) : null;

  const trackerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayEntries.forEach(e => {
      counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [todayEntries]);

  return (
    <View style={[styles.todayBar, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102,126,234,0.08)',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102,126,234,0.15)',
    }]}>
      <View style={styles.todayBarLeft}>
        <View style={[styles.todayBarIcon, { backgroundColor: `${themeColors.primary}20` }]}>
          <Ionicons name="today-outline" size={18} color={themeColors.primary} />
        </View>
        <View>
          <Text style={[styles.todayBarCount, { color: fullThemeColors.text }]}>
            {safeNum(todayCount, 0)}{' '}
            <Text style={{ fontSize: 13, fontWeight: '600', color: fullThemeColors.textSecondary }}>
              entries today
            </Text>
          </Text>
          {timeSinceLast && (
            <Text style={[styles.todayBarLast, { color: fullThemeColors.textSecondary }]}>
              Last: {timeSinceLast}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.todayBarDots}>
        {trackerCounts.map(([trackerId, count]) => {
          const config = TRACKER_CONFIGS[trackerId];
          return (
            <View key={trackerId} style={[styles.todayBarDot, { backgroundColor: config?.color || themeColors.primary }]}>
              <Text style={styles.todayBarDotText}>{config?.emoji || '📋'} {count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});
TodaySummaryBar.displayName = 'TodaySummaryBar';

// ─── Category Filter ───────────────────────────────────────────────

interface CategoryFilterProps {
  activeCategory: string;
  onSelect: (cat: string) => void;
  themeColors: Record<string, string>;
  fullThemeColors: Record<string, string>;
  isDark: boolean;
}

const CategoryFilter = memo<CategoryFilterProps>(({
  activeCategory, onSelect, themeColors, fullThemeColors, isDark,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.categoryContainer}
  >
    {CATEGORIES.map((cat) => (
      <TouchableOpacity
        key={cat.id}
        onPress={() => { HAPTIC_LIGHT(); onSelect(cat.id); }}
        style={[
          styles.categoryChip,
          activeCategory === cat.id && {
            backgroundColor: themeColors.primary,
            borderColor: themeColors.primary,
          },
          activeCategory !== cat.id && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          },
        ]}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: activeCategory === cat.id }}
      >
        <Ionicons
          name={cat.icon}
          size={13}
          color={activeCategory === cat.id ? '#fff' : fullThemeColors.textSecondary}
        />
        <Text style={[
          styles.categoryChipText,
          { color: activeCategory === cat.id ? '#fff' : fullThemeColors.textSecondary },
        ]}>
          {cat.label}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
));
CategoryFilter.displayName = 'CategoryFilter';

// ─── Tracker Card ──────────────────────────────────────────────────

interface TrackerCardProps {
  title: string;
  emoji: string;
  color: string;
  gradient: [string, string];
  count: number;
  lastEntry?: string;
  category: string;
  onPress: () => void;
  delay: number;
}

const TrackerCard = memo<TrackerCardProps>(({
  title, emoji, color, gradient, count, lastEntry, category, onPress, delay,
}) => {
  const { borderRadiusValue, fullThemeColors } = useCustomization();
  const categoryColor = CATEGORY_COLORS[category] || color;

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={styles.trackerCardWrapper}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.trackerCard, { borderRadius: borderRadiusValue }]}
        accessibilityRole="button"
        accessibilityLabel={`${title} tracker, ${count} entries`}
      >
        <LinearGradient
          colors={gradient}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.categoryBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          <Text style={styles.categoryText}>{category}</Text>
        </View>
        <View style={styles.trackerCardContent}>
          <Text style={styles.trackerEmoji}>{emoji}</Text>
          <Text style={styles.trackerTitle}>{title}</Text>
          <Text style={styles.trackerCount}>{safeNum(count, 0)} entries</Text>
          {lastEntry && (
            <Text style={styles.trackerLastEntry} numberOfLines={1}>
              {lastEntry}
            </Text>
          )}
        </View>
        <View style={[styles.trackerArrow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
TrackerCard.displayName = 'TrackerCard';

// ─── Quick Log Button ────────────────────────────────────────────

interface QuickLogButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  delay: number;
}

const QuickLogButton = memo<QuickLogButtonProps>(({
  label, icon, color, onPress, delay,
}) => {
  const { borderRadiusValue, fontSizeMultiplier } = useCustomization();
  return (
    <Animated.View entering={FadeIn.delay(delay)} style={styles.quickLogWrapper}>
      <TouchableOpacity
        style={[styles.quickLogBtn, {
          backgroundColor: `${color}10`,
          borderColor: `${color}20`,
          borderRadius: borderRadiusValue,
        }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Quick log ${label}`}
      >
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.quickLogLabel, { color, fontSize: 12 * fontSizeMultiplier }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});
QuickLogButton.displayName = 'QuickLogButton';

// ─── Growth Index Compact ────────────────────────────────────────

interface GrowthIndexCompactProps {
  growthScore: any;
  stats: any;
  streak: any;
  isDark: boolean;
  onPress: () => void;
}

const GrowthIndexCompact = memo<GrowthIndexCompactProps>(({
  growthScore, stats, streak, isDark, onPress,
}) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const overall = safeNum(growthScore?.overall?.value, 0);
  if (!growthScore || overall === 0) return null;

  const scoreColor = overall >= 80 ? '#11998e' : overall >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : 'Needs Attention';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={[styles.growthCompact, {
        borderRadius: borderRadiusValue,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f9ff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e0f2fe',
      }]}>
        <View style={styles.growthCompactLeft}>
          <Ionicons name="analytics" size={20} color={scoreColor} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.growthCompactTitle, { color: fullThemeColors.text }]}>Growth Index</Text>
            <Text style={[styles.growthCompactSub, { color: fullThemeColors.textSecondary }]}>
              {safeNum(streak?.currentStreak, 0)}d streak · {safeNum(stats?.unlocked, 0)} achievements
            </Text>
          </View>
        </View>
        <View style={[styles.growthCompactScore, { backgroundColor: `${scoreColor}15` }]}>
          <Text style={[styles.growthCompactScoreNum, { color: scoreColor }]}>{Math.round(overall)}</Text>
          <Text style={[styles.growthCompactScoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
GrowthIndexCompact.displayName = 'GrowthIndexCompact';

// ─── Recent Activity Strip ───────────────────────────────────────

interface RecentActivityStripProps {
  entries: any[];
  onViewAll: () => void;
  onEntryPress: (entry: any) => void;
}

const RecentActivityStrip = memo<RecentActivityStripProps>(({
  entries, onViewAll, onEntryPress,
}) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier, themeColors } = useCustomization();
  const recent = useMemo(() =>
    [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8),
    [entries]
  );

  if (recent.length === 0) return null;

  return (
    <View style={styles.recentStrip}>
      <View style={styles.recentStripHeader}>
        <Text style={[styles.recentStripTitle, { color: fullThemeColors.textSecondary }]}>
          RECENT ACTIVITY
        </Text>
        <TouchableOpacity onPress={onViewAll} accessibilityRole="button">
          <Text style={[styles.recentStripSeeAll, { color: themeColors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentStripScroll}>
        {recent.map((entry, index) => {
          const config = TRACKER_CONFIGS[entry.trackerId];
          const gradient = config?.gradient || DEFAULT_GRADIENTS[entry.trackerId] || ['#667eea', '#764ba2'];
          return (
            <Animated.View key={entry.id} entering={FadeInUp.delay(index * 50)} style={{ marginRight: 10 }}>
              <TouchableOpacity
                onPress={() => onEntryPress(entry)}
                style={[styles.recentCard, {
                  borderRadius: borderRadiusValue,
                  borderColor: `${gradient[0]}25`,
                  backgroundColor: fullThemeColors.glassBg,
                }]}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[`${gradient[0]}12`, `${gradient[1]}06`]}
                  style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue }]}
                />
                <Text style={styles.recentCardEmoji}>{config?.emoji || '📋'}</Text>
                <Text style={[styles.recentCardTitle, {
                  color: fullThemeColors.text,
                  fontSize: 13 * fontSizeMultiplier,
                }]} numberOfLines={1}>
                  {safeStr(entry.title, 'Entry')}
                </Text>
                <Text style={[styles.recentCardTime, {
                  color: fullThemeColors.textSecondary,
                  fontSize: 11 * fontSizeMultiplier,
                }]}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
});
RecentActivityStrip.displayName = 'RecentActivityStrip';

// ─── Tracker Action Modal ────────────────────────────────────────

interface TrackerActionModalProps {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}

const TrackerActionModal = memo<TrackerActionModalProps>(({
  visible, trackerId, onClose, onSelect,
}) => {
  const { fullThemeColors, isDark, borderRadiusValue, fontSizeMultiplier } = useCustomization();
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
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: `rgba(0,0,0,0.5)` }]}
        onPress={onClose}
      >
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
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={[styles.modalBody, { backgroundColor: fullThemeColors.surface }]}>
            <Text style={[styles.modalSectionTitle, {
              color: fullThemeColors.textSecondary,
              fontSize: 13 * fontSizeMultiplier,
            }]}>
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
                      backgroundColor: fullThemeColors.glassBg,
                      borderColor: `${action.color}30`,
                      borderRadius: borderRadiusValue,
                      borderWidth: 1.5,
                    }]}
                    onPress={() => onSelect(trackerId, action)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}15` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, {
                      color: fullThemeColors.text,
                      fontSize: 14 * fontSizeMultiplier,
                    }]}>
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

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<HubNavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    triggerHaptic,
    fontSizeMultiplier,
  } = useCustomization();
  const { entries, getEntries, trackers } = useTracker();
  const { stats, streak, growthScore } = useTrackerAchievements();
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError, confirm: showConfirm } = useSweetAlert();

  const [activeTab, setActiveTab] = useState<TabType>('track');

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for stable callbacks
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Load babies on mount
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

  // Auto-refresh current baby
  useEffect(() => {
    const refresh = async () => {
      if (currentBaby) await refreshCurrentBaby();
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [currentBaby, refreshCurrentBaby]);

  // Memoized values
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayCount = useMemo(() =>
    entries.filter(e => e?.timestamp >= today).length,
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
        gradient: (tracker.gradient || config?.gradient || DEFAULT_GRADIENTS[id] || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries]);

  const filteredTrackerCards = useMemo(() => {
    if (activeCategory === 'all') return trackerCards;
    return trackerCards.filter(t => t.category === activeCategory);
  }, [trackerCards, activeCategory]);

  // Handlers
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
    navigation.navigate('AddEntry', { viewMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [navigation]);

  // Loading state
  if (babyLoading && !currentBaby) {
    return (
      <View style={[styles.container, {
        backgroundColor: fullThemeColors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 16, color: fullThemeColors.textSecondary, fontSize: 16 }}>
          Loading baby profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark
          ? [fullThemeColors.background, fullThemeColors.surface]
          : ['#f8fafc', '#e2e8f0', '#dbeafe']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerGreeting, { color: fullThemeColors.textSecondary }]}>
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            }]}
            onPress={() => { HAPTIC_LIGHT(); navigation.navigate('Settings'); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={fullThemeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Baby Switcher Pill */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <BabySwitcherPill
            baby={currentBaby}
            onPress={handleSwitchBaby}
            isDark={isDark}
          />
        </Animated.View>

        {/* Tab Bar */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => { HAPTIC_LIGHT(); setActiveTab(tab.id); }}
              style={[
                styles.tabButton,
                activeTab === tab.id && { backgroundColor: themeColors.primary },
                activeTab !== tab.id && {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                },
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === tab.id }}
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.id ? '#fff' : fullThemeColors.textSecondary}
              />
              <Text style={[
                styles.tabLabel,
                { color: activeTab === tab.id ? '#fff' : fullThemeColors.textSecondary },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* TAB 1: TRACK */}
        {activeTab === 'track' && (
          <Animated.View entering={SlideInRight.duration(300)}>
            <TodaySummaryBar
              todayCount={todayCount}
              entries={entries}
              themeColors={themeColors}
              fullThemeColors={fullThemeColors}
              isDark={isDark}
            />

            <CategoryFilter
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
              themeColors={themeColors}
              fullThemeColors={fullThemeColors}
              isDark={isDark}
            />

            <View style={styles.gridSection}>
              <View style={styles.gridHeader}>
                <Text style={[styles.sectionTitle, { color: fullThemeColors.text }]}>Your Trackers</Text>
                <TouchableOpacity onPress={handleCreateCustom} style={styles.gridHeaderAction} accessibilityRole="button">
                  <Ionicons name="add-circle-outline" size={18} color={themeColors.primary} />
                  <Text style={[styles.gridHeaderActionText, { color: themeColors.primary }]}>Custom</Text>
                </TouchableOpacity>
              </View>

              {filteredTrackerCards.length === 0 ? (
                <View style={[styles.emptyState, {
                  borderRadius: borderRadiusValue,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                }]}>
                  <Ionicons name="cube-outline" size={40} color={fullThemeColors.textSecondary} />
                  <Text style={[styles.emptyStateTitle, { color: fullThemeColors.text }]}>No trackers found</Text>
                  <Text style={[styles.emptyStateSubtitle, { color: fullThemeColors.textSecondary }]}>
                    Try a different category or add your first entry
                  </Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {filteredTrackerCards.map((tracker, index) => (
                    <TrackerCard
                      key={tracker.id}
                      title={tracker.title}
                      emoji={tracker.emoji}
                      color={tracker.color}
                      gradient={tracker.gradient}
                      count={tracker.count}
                      lastEntry={tracker.lastEntry}
                      category={tracker.category}
                      onPress={() => handleTrackerPress(tracker.id, tracker.hasSubActions)}
                      delay={index * 60}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.quickLogSection}>
              <Text style={[styles.sectionTitle, { color: fullThemeColors.text, marginBottom: 12 }]}>
                Quick Log
              </Text>
              <View style={styles.quickLogGrid}>
                {QUICK_LOG_SHORTCUTS.map((shortcut, index) => (
                  <QuickLogButton
                    key={`${shortcut.trackerId}-${shortcut.subActionId}`}
                    {...shortcut}
                    onPress={() => handleQuickLog(shortcut.trackerId, shortcut.subActionId)}
                    delay={index * 40}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* TAB 2: STATS */}
        {activeTab === 'stats' && (
          <Animated.View entering={SlideInRight.duration(300)}>
            <GrowthIndexCompact
              growthScore={growthScore}
              stats={stats}
              streak={streak}
              isDark={isDark}
              onPress={handleViewAchievements}
            />

            <View style={[styles.statsCard, {
              borderRadius: borderRadiusValue,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            }]}>
              <Text style={[styles.sectionTitle, { color: fullThemeColors.text, marginBottom: 16 }]}>
                Activity Overview
              </Text>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Today', value: safeNum(todayCount, 0), color: themeColors.primary, icon: 'today-outline' },
                  { label: 'Total', value: safeNum(entries.length, 0), color: themeColors.secondary, icon: 'layers-outline' },
                  { label: 'Milestones', value: safeNum(getEntries('milestone').length, 0), color: themeColors.accent, icon: 'trophy-outline' },
                  { label: 'Points', value: safeNum(stats?.totalPoints, 0), color: '#f59e0b', icon: 'star-outline' },
                ].map((stat) => (
                  <View key={stat.label} style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: `${stat.color}12` }]}>
                      <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                    </View>
                    <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={[styles.statLabel, { color: fullThemeColors.textSecondary }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <RecentActivityStrip
              entries={entries}
              onViewAll={handleViewTimeline}
              onEntryPress={handleEntryPress}
            />
          </Animated.View>
        )}

        {/* TAB 3: QUICK */}
        {activeTab === 'quick' && (
          <Animated.View entering={SlideInRight.duration(300)}>
            <View style={styles.quickActionsFull}>
              <Text style={[styles.sectionTitle, { color: fullThemeColors.text, marginBottom: 16 }]}>
                All Quick Actions
              </Text>

              {Object.entries(TRACKER_CONFIGS).map(([trackerId, config]) => (
                <View key={trackerId} style={[styles.quickActionGroup, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderRadius: borderRadiusValue,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                }]}>
                  <View style={styles.quickActionGroupHeader}>
                    <Text style={styles.quickActionGroupEmoji}>{config.emoji}</Text>
                    <Text style={[styles.quickActionGroupTitle, { color: fullThemeColors.text }]}>
                      {trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}
                    </Text>
                    <View style={[styles.quickActionGroupBadge, { backgroundColor: `${config.color}15` }]}>
                      <Text style={[styles.quickActionGroupBadgeText, { color: config.color }]}>
                        {getEntries(trackerId).length}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.quickActionGroupButtons}>
                    {config.subActions.map((action) => (
                      <TouchableOpacity
                        key={action.id}
                        style={[styles.quickActionFullBtn, {
                          backgroundColor: `${action.color}10`,
                          borderColor: `${action.color}20`,
                          borderRadius: borderRadiusValue,
                        }]}
                        onPress={() => handleSubActionSelect(trackerId, action)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                      >
                        <Ionicons name={action.icon} size={20} color={action.color} />
                        <Text style={[styles.quickActionFullLabel, { color: action.color }]}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Modals */}

      <TrackerActionModal
        visible={showActionModal}
        trackerId={selectedTrackerId}
        onClose={() => setShowActionModal(false)}
        onSelect={handleSubActionSelect}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  headerLeft: { flex: 1 },
  headerGreeting: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Baby Switcher Pill
  babyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },

  // Tab Bar
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 13, fontWeight: '700' },

  // Today Summary Bar
  todayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  todayBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBarCount: { fontSize: 15, fontWeight: '700' },
  todayBarLast: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  todayBarDots: { flexDirection: 'row', gap: 6 },
  todayBarDot: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBarDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Category Filter
  categoryContainer: { paddingBottom: 4, marginBottom: 16, gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 6,
  },
  categoryChipText: { fontSize: 12, fontWeight: '600' },

  // Tracker Grid
  gridSection: { marginBottom: 20 },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  gridHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridHeaderActionText: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  trackerCardWrapper: { width: (SCREEN_WIDTH - 52) / 2 },
  trackerCard: {
    height: 150,
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  trackerCardContent: { flex: 1, justifyContent: 'flex-end' },
  trackerEmoji: { fontSize: 28, marginBottom: 6 },
  trackerTitle: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  trackerCount: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  trackerLastEntry: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 1,
  },
  trackerArrow: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  categoryDot: { width: 5, height: 5, borderRadius: 3 },
  categoryText: { fontSize: 8, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyStateTitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  emptyStateSubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Quick Log
  quickLogSection: { marginBottom: 20 },
  quickLogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickLogWrapper: { width: (SCREEN_WIDTH - 56) / 3 },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickLogLabel: { fontWeight: '700', fontSize: 12 },

  // Stats Tab
  statsCard: {
    padding: 18,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    width: (SCREEN_WIDTH - 72) / 2,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },

  // Growth Index Compact
  growthCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  growthCompactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  growthCompactTitle: { fontSize: 15, fontWeight: '700' },
  growthCompactSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  growthCompactScore: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  growthCompactScoreNum: { fontSize: 20, fontWeight: '800' },
  growthCompactScoreLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Recent Activity Strip
  recentStrip: { marginBottom: 20 },
  recentStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentStripTitle: { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 12 },
  recentStripSeeAll: { fontWeight: '600', fontSize: 13 },
  recentStripScroll: { paddingRight: 20 },
  recentCard: {
    width: 110,
    height: 90,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  recentCardEmoji: { fontSize: 22, marginBottom: 4 },
  recentCardTitle: { fontWeight: '700', letterSpacing: -0.2 },
  recentCardTime: { fontWeight: '500', marginTop: 2 },

  // Quick Tab - Full Actions
  quickActionsFull: { marginBottom: 20 },
  quickActionGroup: {
    marginBottom: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickActionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  quickActionGroupEmoji: { fontSize: 20 },
  quickActionGroupTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  quickActionGroupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickActionGroupBadgeText: { fontSize: 12, fontWeight: '700' },
  quickActionGroupButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: '45%',
    justifyContent: 'center',
  },
  quickActionFullLabel: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },
});