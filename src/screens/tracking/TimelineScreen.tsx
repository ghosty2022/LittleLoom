import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOut,
  Layout,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  format,
  isSameDay,
  differenceInHours,
  differenceInMonths,
  parseISO,
  isValid,
  addMonths,
  startOfDay,
} from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { useBaby } from '../../context/BabyContext';
import { TrackerEntry, UnifiedTrackerConfig } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';
import { usePredictiveReminders, PredictiveReminder } from '../../hooks/usePredictiveReminders';
import { useGrowthIntelligence } from '../../hooks/useGrowthIntelligence';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { useTrackerProgressive } from '../../hooks/useTrackerProgressive';
import { useTimelineCorrelations } from '../../hooks/useTimelineCorrelations';
import { TimelineCorrelation } from '../../components/trackers/TrackerCorrelationBadge';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
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
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '500' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 17, line: 24, weight: '600' as const },
    xl: { size: 20, line: 28, weight: '700' as const },
    '2xl': { size: 26, line: 34, weight: '800' as const },
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const TRACKER_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '💧' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🏆' },
  diaper: { icon: 'shirt-outline', color: '#3b82f6', label: 'Diaper', emoji: '👶' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
  pump: { icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pump', emoji: '🔄' },
  pumping: { icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pumping', emoji: '🔄' },
  bath: { icon: 'water-outline', color: '#3b82f6', label: 'Bath', emoji: '🛁' },
  play: { icon: 'game-controller-outline', color: '#ec4899', label: 'Play', emoji: '🎮' },
  walk: { icon: 'walk-outline', color: '#10b981', label: 'Walk', emoji: '🚶' },
  temperature: { icon: 'thermometer-outline', color: '#f97316', label: 'Temp', emoji: '🌡️' },
  symptom: { icon: 'pulse-outline', color: '#ef4444', label: 'Symptom', emoji: '🤒' },
  tummy_time: { icon: 'fitness-outline', color: '#10b981', label: 'Tummy Time', emoji: '🤸' },
  reading: { icon: 'book-outline', color: '#6366f1', label: 'Reading', emoji: '📚' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '•' },
};

const getTrackerCfg = (type?: string) => TRACKER_CONFIG[type || ''] || TRACKER_CONFIG.default;

type TimelineScreenRouteProp = RouteProp<RootStackParamList, 'Timeline'>;
type TimelineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TimelineTab = 'timeline' | 'insights' | 'growth' | 'achievements' | 'analytics';

interface SmartSection {
  id: string;
  type: 'insight' | 'correlation' | 'reminder' | 'achievement' | 'streak' | 'growth';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  component: React.ReactNode;
}

const safeArray = <T,>(arr: T[] | undefined | null): T[] => arr || [];
const safeString = (s: string | undefined | null): string => s || '';
const safeNumber = (n: number | undefined | null, fallback = 0): number => {
  if (n === undefined || n === null || Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return n;
};
const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch {
    return null;
  }
};
const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};
const getDateTitle = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return format(date, 'EEEE');
  return format(date, 'MMM d, yyyy');
};

const getRarityGradient = (rarity: string): [string, string] => {
  switch (rarity) {
    case 'legendary': return ['#f59e0b', '#ef4444'];
    case 'epic': return ['#8b5cf6', '#6366f1'];
    case 'rare': return ['#06b6d4', '#3b82f6'];
    default: return ['#10b981', '#22c55e'];
  }
};

/* ════════════════════════════════════════════════════════════
   GradientText (same aura as Home/Community)
   ════════════════════════════════════════════════════════════ */
const GradientText = React.memo(
  ({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'], ...props }: {
    children: React.ReactNode;
    style?: any;
    colors?: string[];
    [k: string]: any;
  }) => {
    const raw = typeof children === 'string' ? children : String(children ?? '');
    const letters = raw.split('');
    const interpolateColor = (c1: string, c2: string, t: number) => {
      const r1 = parseInt(c1.slice(1, 3), 16);
      const g1 = parseInt(c1.slice(3, 5), 16);
      const b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16);
      const g2 = parseInt(c2.slice(3, 5), 16);
      const b2 = parseInt(c2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {letters.map((letter, index) => {
          const position = index / Math.max(letters.length - 1, 1);
          const colorIndex = position * (colors.length - 1);
          const lowerIndex = Math.floor(colorIndex);
          const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
          const fraction = colorIndex - lowerIndex;
          const startColor = colors[lowerIndex] || colors[0];
          const endColor = colors[upperIndex] || colors[colors.length - 1];
          const color = interpolateColor(startColor, endColor, fraction);
          return (
            <Text key={index} style={[style, { color }]} {...props}>
              {letter}
            </Text>
          );
        })}
      </View>
    );
  },
);

/* ════════════════════════════════════════════════════════════
   PressableScale — springy haptic touch (matches Home/More)
   ════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PressableScale = React.memo<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'warning';
}>(({ children, onPress, disabled = false, style, activeScale = 0.96, haptic = 'light' }) => {
  const scale = useSharedValue(1);
  const { triggerHaptic, hapticFeedback } = useCustomization();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => { scale.value = withTiming(activeScale, { duration: 80 }); }, [activeScale, scale]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }, [scale]);
  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticFeedback) triggerHaptic(haptic).catch(() => {});
    onPress?.();
  }, [disabled, hapticFeedback, triggerHaptic, haptic, onPress]);
  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ════════════════════════════════════════════════════════════
   PULSE HEADER — replaces the old hero card
   Floating glass capsule w/ animated gradient ring, live counts,
   mini sparkline + insight ribbon
   ════════════════════════════════════════════════════════════ */
const PulseHeader = React.memo<{
  isDark: boolean;
  currentBaby: any;
  todayCount: number;
  weekCount: number;
  streak: number;
  weekSpark: number[];
  onBabyPress: () => void;
  onAchievementsPress: () => void;
  onCalendarPress: () => void;
  onAddPress: () => void;
}>(({ isDark, currentBaby, todayCount, weekCount, streak, weekSpark, onBabyPress, onAchievementsPress, onCalendarPress, onAddPress }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const auraGlow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    auraGlow.value = withRepeat(withSequence(withTiming(0.85, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, auraGlow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: auraGlow.value, transform: [{ scale: pulse.value }] }));

  const maxSpark = Math.max(...weekSpark, 1);
  const sparkWidth = 78;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View
        style={[
          styles.pulseWrap,
          {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
              : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        {/* Row 1: avatar + name + buttons */}
        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94} haptic="light">
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient
                  colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <SafeAvatar avatar={currentBaby?.avatar} gender={currentBaby?.gender} size={46} showBadge={false} />
              </View>
            </View>
          </PressableScale>

          <View style={styles.pulseInfo}>
            <View style={styles.pulseNameRow}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {currentBaby?.name || 'Little One'}
              </Text>
              {currentBaby?.birthDate && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>
                    {safeDiffMonths(new Date(), currentBaby.birthDate)}mo
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.pulseSubRow}>
              <View style={[styles.pulseLiveDot, { backgroundColor: DS.success }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {todayCount} logged today · {weekCount} this week
              </Text>
            </View>
          </View>

          <View style={styles.pulseActions}>
            <PressableScale onPress={onCalendarPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="calendar-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAchievementsPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="trophy-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAddPress} activeScale={0.9} haptic="medium">
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        {/* Row 2: KPI chips + sparkline */}
        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{streak}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>day streak</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.accent }]}>{todayCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>today</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{weekCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>7 days</Text>
          </View>

          {/* Sparkline */}
          <View style={styles.sparkWrap}>
            {weekSpark.map((v, i) => {
              const h = Math.max(4, Math.round((v / maxSpark) * 26));
              const isToday = i === weekSpark.length - 1;
              return (
                <View key={i} style={styles.sparkCol}>
                  <View
                    style={[
                      styles.sparkBar,
                      {
                        height: h,
                        backgroundColor: isToday ? DS.primary : `${DS.primary}45`,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ════════════════════════════════════════════════════════════
   Insight Ribbon — one-line contextual insight strip
   ════════════════════════════════════════════════════════════ */
const InsightRibbon = React.memo<{
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  text: string;
  onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(120).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View
        style={[
          styles.ribbon,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}
      >
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>
            {text}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
      </View>
    </PressableScale>
  </Animated.View>
));

/* ════════════════════════════════════════════════════════════
   Tab Bar
   ════════════════════════════════════════════════════════════ */
const TabBar = ({ tabs, activeTab, onChange }: {
  tabs: { key: TimelineTab; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: TimelineTab;
  onChange: (t: TimelineTab) => void;
}) => (
  <View style={styles.tabBar}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, isActive && styles.tabItemActive]}
          activeOpacity={0.8}
        >
          <Ionicons name={tab.icon} size={15} color={isActive ? DS.primary : DS.gray400} />
          <Text style={[styles.tabLabel, { color: isActive ? DS.primary : DS.gray400 }, isActive && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ════════════════════════════════════════════════════════════
   Quick Logs (row of colored chips)
   ════════════════════════════════════════════════════════════ */
const QuickLogs = ({ onLog }: { onLog: (id: string) => void }) => {
  const items = [
    { id: 'feed', label: 'Feed', emoji: '🍼', color: '#f59e0b', grad: ['#fa709a', '#fee140'] as [string, string] },
    { id: 'sleep', label: 'Sleep', emoji: '😴', color: '#8b5cf6', grad: ['#11998e', '#38ef7d'] as [string, string] },
    { id: 'diaper', label: 'Diaper', emoji: '👶', color: '#3b82f6', grad: ['#fc5c7d', '#6a82fb'] as [string, string] },
    { id: 'milestone', label: 'Win', emoji: '🏆', color: '#ec4899', grad: ['#f59e0b', '#fbbf24'] as [string, string] },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: DS.space.sm, paddingVertical: 4 }}
      >
        {items.map((it) => (
          <PressableScale key={it.id} onPress={() => onLog(it.id)} activeScale={0.92}>
            <LinearGradient
              colors={it.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickChip}
            >
              <Text style={styles.quickEmoji}>{it.emoji}</Text>
              <Text style={styles.quickLabel}>{it.label}</Text>
            </LinearGradient>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════
   Weekly Velocity — compact progress bars
   ════════════════════════════════════════════════════════════ */
const WeeklyVelocity = ({ entries, isDark }: { entries: TrackerEntry[]; isDark: boolean }) => {
  const days = useMemo(() => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = new Date();
    return labels.map((label, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const e = s + 86400000;
      const count = entries.filter(x => x.timestamp >= s && x.timestamp < e).length;
      return { label, count, isToday: i === 6 };
    });
  }, [entries]);

  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <View style={[styles.velocityCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={styles.velocityHeader}>
          <View style={[styles.velocityIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="pulse" size={14} color={DS.primary} />
          </View>
          <Text style={[styles.velocityTitle, { color: isDark ? DS.gray300 : DS.gray700 }]}>Weekly Velocity</Text>
          <Text style={[styles.velocitySub, { color: isDark ? DS.gray500 : DS.gray400 }]}>{entries.length} total</Text>
        </View>
        <View style={styles.velocityBars}>
          {days.map((d, i) => {
            const h = Math.max(6, Math.round((d.count / max) * 34));
            return (
              <View key={i} style={styles.velocityCol}>
                <Text style={[styles.velocityCount, { color: d.isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400 }]}>{d.count || ''}</Text>
                <View style={[styles.velocityBarTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <View style={[styles.velocityBar, { height: h, backgroundColor: d.isToday ? DS.primary : `${DS.primary}50` }]} />
                </View>
                <Text style={[styles.velocityDay, { color: d.isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400, fontWeight: d.isToday ? '800' : '600' }]}>
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════
   Smart cards (retained + restyled with aura)
   ════════════════════════════════════════════════════════════ */
const SmartInsightCard: React.FC<{ insight: any; isDark: boolean; onAction: (trackerId: string) => void; onDismiss: () => void; index: number }> = ({ insight, isDark, onAction, onDismiss, index }) => {
  const getIcon = (t: string) => {
    switch (t) {
      case 'anomaly': return 'warning-outline';
      case 'pattern': return 'git-branch-outline';
      case 'milestone': return 'trophy-outline';
      case 'correlation': return 'link-outline';
      case 'suggestion': return 'bulb-outline';
      default: return 'information-circle-outline';
    }
  };
  const warning = insight?.priority === 'warning';
  const color = warning ? DS.danger : DS.primary;
  return (
    <Animated.View entering={FadeInRight.delay(index * 80).springify()} layout={Layout.springify()}>
      <View style={[styles.smartCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={styles.smartCardHead}>
          <View style={[styles.smartIcon, { backgroundColor: `${color}15` }]}>
            <Ionicons name={getIcon(insight?.type) as any} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smartTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              {insight?.emoji} {insight?.title}
            </Text>
            <Text style={[styles.smartDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
              {insight?.description}
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={DS.gray400} />
          </TouchableOpacity>
        </View>
        {insight?.action && (
          <TouchableOpacity
            style={[styles.smartAction, { backgroundColor: `${color}12` }]}
            onPress={() => onAction(insight.action.trackerId)}
          >
            <Ionicons name="add-circle-outline" size={14} color={color} />
            <Text style={[styles.smartActionText, { color }]}>{insight.action.message}</Text>
            <Ionicons name="arrow-forward" size={12} color={color} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const SmartCorrelationCard: React.FC<{ correlation: TimelineCorrelation; isDark: boolean; onNavigate: (id: string) => void; index: number }> = ({ correlation, isDark, onNavigate, index }) => {
  const color = correlation?.color || DS.primary;
  const conf = safeNumber(correlation?.confidence, 0);
  const ts = correlation?.primaryEntry?.timestamp || 0;
  return (
    <Animated.View entering={FadeInUp.delay(index * 100).springify()}>
      <View style={[styles.corrCard, { borderColor: `${color}40`, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : `${color}06` }]}>
        <View style={styles.corrHead}>
          <View style={[styles.corrBadge, { backgroundColor: `${color}18` }]}>
            <Ionicons name="link" size={12} color={color} />
            <Text style={[styles.corrBadgeText, { color }]}>{conf}% match</Text>
          </View>
          <Text style={[styles.corrTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            {ts ? format(ts, 'MMM d, h:mm a') : '—'}
          </Text>
        </View>
        <Text style={[styles.corrInsight, { color: isDark ? DS.gray200 : DS.gray700 }]}>
          {correlation?.insight || 'Pattern detected'}
        </Text>
        <TouchableOpacity
          style={[styles.corrAction, { backgroundColor: `${color}12` }]}
          onPress={() => onNavigate(correlation?.relatedEntry?.trackerId || '')}
        >
          <Text style={[styles.corrActionText, { color }]}>View related</Text>
          <Ionicons name="chevron-forward" size={12} color={color} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const SmartReminderCard: React.FC<{ reminder: PredictiveReminder; isDark: boolean; onApply: (r: PredictiveReminder) => void; onDismiss: (id: string) => void; index: number }> = ({ reminder, isDark, onApply, onDismiss, index }) => {
  const time = reminder?.suggestedTime;
  const overdue = time && new Date(time) < new Date();
  const hours = time ? Math.max(0, differenceInHours(new Date(time), new Date())) : null;
  const priority = reminder?.priority || 'normal';
  const priorityColor = priority === 'urgent' ? DS.danger : priority === 'high' ? DS.warning : DS.primary;
  return (
    <Animated.View entering={FadeInUp.delay(index * 120).springify()}>
      <View style={[styles.reminderCard, { borderLeftColor: priorityColor, backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={styles.reminderHead}>
          <Text style={styles.reminderEmoji}>{reminder?.emoji || '⏰'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reminderTitle, { color: isDark ? DS.white : DS.gray900 }]}>{reminder?.title}</Text>
            <Text style={[styles.reminderDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
              {reminder?.description}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDismiss(reminder?.id || '')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={DS.gray400} />
          </TouchableOpacity>
        </View>
        <View style={styles.reminderMeta}>
          {time && (
            <View style={[styles.reminderTimeBadge, { backgroundColor: overdue ? `${DS.danger}12` : `${DS.primary}12` }]}>
              <Ionicons name="time-outline" size={11} color={overdue ? DS.danger : DS.primary} />
              <Text style={[styles.reminderTimeText, { color: overdue ? DS.danger : DS.primary }]}>
                {overdue ? 'Overdue' : hours === 0 ? 'Due now' : `In ${hours}h`}
              </Text>
            </View>
          )}
          <View style={[styles.reminderTimeBadge, { backgroundColor: `${DS.success}12` }]}>
            <Ionicons name="analytics-outline" size={11} color={DS.success} />
            <Text style={[styles.reminderTimeText, { color: DS.success }]}>{safeNumber(reminder?.confidence, 0)}% confidence</Text>
          </View>
        </View>
        <View style={styles.reminderActions}>
          <PressableScale onPress={() => onApply(reminder)} activeScale={0.96} style={{ flex: 1 }}>
            <LinearGradient
              colors={[priorityColor, priorityColor + 'CC']}
              style={styles.reminderPrimaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={14} color={DS.white} />
              <Text style={styles.reminderPrimaryText}>{reminder?.action?.label || 'Apply'}</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
};

const GrowthScoreCard: React.FC<{ growthIndex: any; isDark: boolean; onPress: () => void }> = ({ growthIndex, isDark, onPress }) => {
  if (!growthIndex) return null;
  const scores = [
    { label: 'Nutrition', value: growthIndex?.nutritionScore?.value, color: '#FF9F43', icon: '🍎' },
    { label: 'Rest', value: growthIndex?.restScore?.value, color: '#5F27CD', icon: '😴' },
    { label: 'Physical', value: growthIndex?.physicalScore?.value, color: '#10AC84', icon: '💪' },
    { label: 'Cognitive', value: growthIndex?.cognitiveScore?.value, color: '#FFD700', icon: '🧠' },
    { label: 'Health', value: growthIndex?.healthStability?.value, color: '#EE5A24', icon: '❤️' },
  ];
  const composite = safeNumber(growthIndex?.compositeIndex, 0);
  const compositeColor = composite >= 80 ? DS.success : composite >= 60 ? DS.warning : DS.danger;
  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.14)', 'rgba(236,72,153,0.06)'] : [`${DS.primary}10`, `${DS.accent}06`]}
          style={[styles.growthCard, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.growthHead}>
            <Text style={[styles.growthTitle, { color: isDark ? DS.white : DS.gray900 }]}>📊 Growth Intelligence</Text>
            <View style={[styles.growthComposite, { backgroundColor: `${compositeColor}18` }]}>
              <Text style={[styles.growthCompositeText, { color: compositeColor }]}>{composite}</Text>
            </View>
          </View>
          <View style={styles.growthGrid}>
            {scores.map((s) => {
              const v = safeNumber(s.value, 0);
              return (
                <View key={s.label} style={styles.growthItem}>
                  <Text style={styles.growthItemEmoji}>{s.icon}</Text>
                  <View style={styles.growthBar}>
                    <View style={[styles.growthFill, { width: `${v}%`, backgroundColor: s.color }]} />
                  </View>
                  <Text style={[styles.growthItemLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
};

const StreakBanner: React.FC<{ streak: any; isDark: boolean; onAction: () => void }> = ({ streak, isDark, onAction }) => {
  if (!streak || streak.currentStreak === 0) return null;
  const atRisk = streak?.streakAtRisk;
  const progress = Math.min(safeNumber(streak?.currentStreak, 0) / 30, 1);
  return (
    <Animated.View entering={FadeInUp.springify()}>
      <PressableScale onPress={onAction} activeScale={0.98}>
        <View
          style={[
            styles.streakCard,
            {
              backgroundColor: atRisk ? `${DS.danger}08` : `${DS.warning}08`,
              borderColor: atRisk ? `${DS.danger}30` : `${DS.warning}30`,
            },
          ]}
        >
          <Text style={styles.streakEmoji}>{atRisk ? '⏰' : '🔥'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.streakTitle, { color: atRisk ? DS.danger : isDark ? DS.white : DS.gray900 }]}>
              {atRisk ? 'Streak at risk!' : `${safeNumber(streak.currentStreak, 0)}-day streak`}
            </Text>
            <Text style={[styles.streakSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {atRisk ? `Log an entry in ${safeNumber(streak?.hoursUntilBreak, 0)}h to keep it alive` : `Best: ${safeNumber(streak.longestStreak, 0)} days · Keep going!`}
            </Text>
            <View style={[styles.streakProgress, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <View style={[styles.streakProgressFill, { width: `${progress * 100}%`, backgroundColor: atRisk ? DS.danger : DS.warning }]} />
            </View>
          </View>
          <Ionicons name={atRisk ? 'alert-circle' : 'chevron-forward'} size={18} color={atRisk ? DS.danger : DS.gray400} />
        </View>
      </PressableScale>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN SCREEN
   ════════════════════════════════════════════════════════════ */
export default function TimelineScreen() {
  const navigation = useNavigation<TimelineScreenNavigationProp>();
  const route = useRoute<TimelineScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { triggerHaptic, darkMode } = useCustomization();
  const isDark = darkMode ?? false;

  const { currentBaby, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { entries: trackerEntries, refreshEntries, deleteEntry, getTracker, getEntries } = useTracker();
  const { success, confirm, error } = useSweetAlert();

  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { reminders: predictiveReminders } = usePredictiveReminders();
  const { growthIndex } = useGrowthIntelligence();
  const { achievements, stats: achievementStats, streak: globalStreak, newlyUnlocked } = useTrackerAchievements();

  useEffect(() => { loadBabies(); }, [loadBabies]);

  useFocusEffect(
    useCallback(() => {
      refreshEntries();
      refreshCurrentBaby();
    }, [refreshEntries, refreshCurrentBaby]),
  );

  const [activeTab, setActiveTab] = useState<TimelineTab>('timeline');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTimelinePicker, setShowTimelinePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);

  useEffect(() => {
    if (route.params?.filter) setSelectedFilter(route.params.filter);
  }, [route.params?.filter]);

  useEffect(() => {
    if (!babyLoading && !currentBaby) {
      const t = setTimeout(() => setShowBabyRequiredModal(true), 500);
      return () => clearTimeout(t);
    }
  }, [babyLoading, currentBaby]);

  const allEntries = useMemo(() => {
    if (!currentBaby || !Array.isArray(trackerEntries)) return [];
    return [...trackerEntries].sort((a, b) => b.timestamp - a.timestamp);
  }, [trackerEntries, currentBaby]);

  const { insights: allInsights, dismissInsight } = useTrackerProgressive(selectedFilter === 'all' ? 'feed' : selectedFilter);
  const activeInsights = useMemo(() => safeArray(allInsights).filter(i => !dismissedInsights.has(i?.id)), [allInsights, dismissedInsights]);
  const activeReminders = useMemo(() => safeArray(predictiveReminders).filter(r => !dismissedReminders.has(r?.id)), [predictiveReminders, dismissedReminders]);

  /* Stats for pulse header */
  const { todayCount, weekCount, streak, weekSpark } = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const today = allEntries.filter(e => e?.timestamp >= todayStart).length;
    const weekAgo = todayStart - 6 * 86400000;
    const week = allEntries.filter(e => e?.timestamp >= weekAgo).length;
    const spark: number[] = [];
    for (let i = 0; i < 7; i++) {
      const s = todayStart - (6 - i) * 86400000;
      const e = s + 86400000;
      spark.push(allEntries.filter(x => x.timestamp >= s && x.timestamp < e).length);
    }
    const dayKeys = new Set<string>();
    allEntries.forEach(a => {
      if (!a?.timestamp) return;
      const d = new Date(a.timestamp);
      d.setHours(0, 0, 0, 0);
      dayKeys.add(String(d.getTime()));
    });
    let streakCount = 0;
    let cursor = todayStart;
    while (dayKeys.has(String(cursor))) {
      streakCount++;
      cursor -= 86400000;
    }
    return { todayCount: today, weekCount: week, streak: streakCount, weekSpark: spark };
  }, [allEntries]);

  /* Smart sections */
  const smartSections = useMemo((): SmartSection[] => {
    const s: SmartSection[] = [];
    if (globalStreak?.streakAtRisk) {
      s.push({ id: 'streak-urgent', type: 'streak', priority: 'urgent', component: <StreakBanner streak={globalStreak} isDark={isDark} onAction={() => setShowTimelinePicker(true)} /> });
    }
    activeInsights.filter(i => i?.priority === 'warning' || i?.type === 'anomaly').forEach((i, idx) => {
      s.push({ id: `insight-${i?.id || idx}`, type: 'insight', priority: 'high', component: <SmartInsightCard insight={i} isDark={isDark} onAction={(t) => navigation.navigate('AddEntry', { trackerId: t })} onDismiss={() => { if (i?.id) { setDismissedInsights(p => new Set([...p, i.id])); dismissInsight(i.id); } }} index={idx} /> });
    });
    activeReminders.filter(r => r?.suggestedTime && new Date(r.suggestedTime) < new Date()).forEach((r, idx) => {
      s.push({ id: `rem-${r?.id || idx}`, type: 'reminder', priority: 'high', component: <SmartReminderCard reminder={r} isDark={isDark} onApply={(rem) => navigation.navigate('AddEntry', { trackerId: rem?.action?.params?.trackerId as string })} onDismiss={(id) => setDismissedReminders(p => new Set([...p, id]))} index={idx} /> });
    });
    if (growthIndex) {
      s.push({ id: 'growth', type: 'growth', priority: 'normal', component: <GrowthScoreCard growthIndex={growthIndex} isDark={isDark} onPress={() => navigation.navigate('GrowthDashboard')} /> });
    }
    activeReminders.filter(r => !r?.suggestedTime || new Date(r.suggestedTime) >= new Date()).slice(0, 2).forEach((r, idx) => {
      s.push({ id: `rem-${r?.id || idx}`, type: 'reminder', priority: 'normal', component: <SmartReminderCard reminder={r} isDark={isDark} onApply={(rem) => navigation.navigate('AddEntry', { trackerId: rem?.action?.params?.trackerId as string })} onDismiss={(id) => setDismissedReminders(p => new Set([...p, id]))} index={idx} /> });
    });
    activeInsights.filter(i => i?.priority !== 'warning' && i?.type !== 'anomaly').forEach((i, idx) => {
      s.push({ id: `insight-${i?.id || idx}`, type: 'insight', priority: 'normal', component: <SmartInsightCard insight={i} isDark={isDark} onAction={(t) => navigation.navigate('AddEntry', { trackerId: t })} onDismiss={() => { if (i?.id) { setDismissedInsights(p => new Set([...p, i.id])); dismissInsight(i.id); } }} index={idx} /> });
    });
    safeArray(timelineCorrelations).slice(0, 3).forEach((c, idx) => {
      s.push({ id: `corr-${c?.id || idx}`, type: 'correlation', priority: 'low', component: <SmartCorrelationCard correlation={c} isDark={isDark} onNavigate={(id) => navigation.navigate('AddEntry', { trackerId: id })} index={idx} /> });
    });
    if (globalStreak?.currentStreak > 0 && !globalStreak?.streakAtRisk) {
      s.push({ id: 'streak-normal', type: 'streak', priority: 'low', component: <StreakBanner streak={globalStreak} isDark={isDark} onAction={() => setShowTimelinePicker(true)} /> });
    }
    const order = { urgent: 0, high: 1, normal: 2, low: 3 };
    return s.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [globalStreak, activeInsights, activeReminders, growthIndex, timelineCorrelations, isDark, navigation, dismissInsight]);

  const groupedEvents = useMemo(() => {
    let filtered = allEntries;
    if (selectedFilter !== 'all') filtered = filtered.filter(e => e?.trackerId === selectedFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => safeString(e?.title).toLowerCase().includes(q) || safeString(e?.notes).toLowerCase().includes(q));
    }
    if (selectedDate) filtered = filtered.filter(e => e?.timestamp && isSameDay(new Date(e.timestamp), selectedDate));
    const groups: { title: string; date: Date; events: TrackerEntry[] }[] = [];
    let cur: typeof groups[0] | null = null;
    filtered.forEach(event => {
      if (!event?.timestamp) return;
      const ed = new Date(event.timestamp);
      if (!cur || !isSameDay(cur.date, ed)) {
        cur = { title: getDateTitle(event.timestamp), date: ed, events: [] };
        groups.push(cur);
      }
      cur.events.push(event);
    });
    return groups;
  }, [allEntries, selectedFilter, searchQuery, selectedDate]);

  const entryCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach(e => { if (!e?.timestamp) return; const k = format(new Date(e.timestamp), 'yyyy-MM-dd'); map.set(k, (map.get(k) || 0) + 1); });
    return map;
  }, [allEntries]);

  const calendarCells = useMemo((): (Date | null)[] => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) for (let i = 0; i < remaining; i++) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const selectedDayEntries = useMemo(() => {
    if (!selectedDate) return [];
    return allEntries.filter(e => e?.timestamp && isSameDay(new Date(e.timestamp), selectedDate));
  }, [allEntries, selectedDate]);

  const filterChips = useMemo(() => {
    const base = [{ id: 'all', label: 'All', icon: 'grid-outline', color: DS.primary }];
    const ids = [...new Set(safeArray(allEntries).map(e => e?.trackerId).filter(Boolean))];
    return [
      ...base,
      ...ids.map(id => {
        const t = getTracker(id);
        const cfg = getTrackerCfg(id);
        return { id, label: t?.name || cfg.label, icon: cfg.icon, color: t?.gradient?.[0] || t?.color || cfg.color };
      }),
    ];
  }, [allEntries, getTracker]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshEntries(), refreshCurrentBaby(), loadBabies()]);
    setRefreshing(false);
  }, [refreshEntries, refreshCurrentBaby, loadBabies]);

  const handleDelete = useCallback((entry: TrackerEntry) => {
    triggerHaptic('warning');
    confirm('Delete Entry', `Delete "${entry?.title || 'entry'}"?`, async () => {
      if (entry?.id) {
        try {
          await deleteEntry(entry.id);
          await refreshEntries();
          triggerHaptic('success');
          success('Deleted', 'Entry removed');
        } catch {
          error('Delete Failed', 'Could not remove entry.');
        }
      }
    }, () => triggerHaptic('light'), 'Delete', 'Cancel');
  }, [deleteEntry, refreshEntries, triggerHaptic, confirm, success, error]);

  const handleEventPress = useCallback((entry: TrackerEntry) => {
    if (!entry?.id) return;
    triggerHaptic('light');
    navigation.navigate('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId });
  }, [navigation, triggerHaptic]);

  const handleQuickLog = useCallback((trackerId: string) => {
    triggerHaptic('light');
    navigation.navigate('AddEntry', { trackerId });
  }, [navigation, triggerHaptic]);

  const handleTabChange = useCallback((tab: TimelineTab) => {
    triggerHaptic('light');
    setActiveTab(tab);
  }, [triggerHaptic]);

  const tabs = [
    { key: 'timeline' as TimelineTab, label: 'Timeline', icon: 'time-outline' as const },
    { key: 'insights' as TimelineTab, label: 'Insights', icon: 'bulb-outline' as const },
    { key: 'growth' as TimelineTab, label: 'Growth', icon: 'trending-up-outline' as const },
    { key: 'achievements' as TimelineTab, label: 'Awards', icon: 'trophy-outline' as const },
    { key: 'analytics' as TimelineTab, label: 'Stats', icon: 'bar-chart-outline' as const },
  ];

  const topRibbon = useMemo(() => {
    if (activeReminders.length > 0) {
      const r = activeReminders[0];
      return { icon: 'alarm-outline' as const, color: DS.warning, label: 'Reminder', text: r?.title || 'Upcoming', onPress: () => setActiveTab('insights') };
    }
    if (growthIndex) {
      const score = safeNumber(growthIndex.compositeIndex, 0);
      return { icon: 'sparkles' as const, color: DS.success, label: 'Growth', text: `Composite index at ${score} — ${score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Learning'}`, onPress: () => navigation.navigate('GrowthDashboard') };
    }
    return { icon: 'sunny-outline' as const, color: DS.primary, label: 'Tip', text: 'Consistency builds the best patterns for your baby', onPress: () => setActiveTab('insights') };
  }, [activeReminders, growthIndex, navigation]);

  /* ---------------- RENDER ---------------- */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── Sticky Header ─── */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => { triggerHaptic('light'); navigation.goBack(); }}
            style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              TIMELINE
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby?.name || 'Your little one'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { triggerHaptic('light'); setShowSearch(v => !v); }}
              style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
            >
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { triggerHaptic('light'); navigation.navigate('Achievements'); }}
              style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
            >
              <Ionicons name="trophy-outline" size={20} color={isDark ? DS.white : DS.gray800} />
              {achievementStats?.unlocked > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{achievementStats.unlocked}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />
        }
      >
        {/* Search bar */}
        {showSearch && (
          <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={styles.searchWrap}>
            <View style={[styles.searchInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="search" size={18} color={DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray800 }]}
                placeholder="Search entries..."
                placeholderTextColor={DS.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        {/* ═════ PULSE HEADER (replaces hero card) ═════ */}
        <PulseHeader
          isDark={isDark}
          currentBaby={currentBaby}
          todayCount={todayCount}
          weekCount={weekCount}
          streak={streak}
          weekSpark={weekSpark}
          onBabyPress={() => navigation.navigate('SwitchBaby', { returnTo: 'Timeline', returnLabel: 'Timeline' })}
          onAchievementsPress={() => navigation.navigate('Achievements')}
          onCalendarPress={() => setShowCalendar(true)}
          onAddPress={() => setShowTimelinePicker(true)}
        />

        {/* Insight ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Quick logs */}
        <View style={{ marginTop: DS.space.md }}>
          <QuickLogs onLog={handleQuickLog} />
        </View>

        {/* Weekly velocity */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <WeeklyVelocity entries={allEntries} isDark={isDark} />
        </View>

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </View>

        {/* ─── TIMELINE TAB ─── */}
        {activeTab === 'timeline' && (
          <>
            {/* Date filter banner */}
            {selectedDate && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.dateBanner}>
                <Ionicons name="calendar" size={14} color={DS.primary} />
                <Text style={styles.dateBannerText}>{format(selectedDate, 'EEEE, MMM d')}</Text>
                <TouchableOpacity onPress={() => setSelectedDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={DS.primary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 8 }}
            >
              {filterChips.map((f) => {
                const active = selectedFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => { triggerHaptic('light'); setSelectedFilter(f.id); }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? f.color : isDark ? 'rgba(255,255,255,0.04)' : DS.white,
                        borderColor: active ? f.color : isDark ? DS.darkBorder : DS.gray200,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={f.icon as any} size={14} color={active ? DS.white : f.color} />
                    <Text style={[styles.filterChipText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray600 }, active && { fontWeight: '700' }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Timeline list */}
            {groupedEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient colors={[`${DS.primary}12`, `${DS.accent}12`]} style={styles.emptyIconBg}>
                  <Ionicons name="time-outline" size={40} color={DS.primary} />
                </LinearGradient>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray700 }]}>
                  {searchQuery ? 'No matches found' : selectedDate ? 'Nothing on this day' : 'Your timeline awaits'}
                </Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {searchQuery ? 'Try different keywords' : selectedDate ? 'Clear the date filter to see more' : 'Log your first entry to begin'}
                </Text>
                {!searchQuery && !selectedDate && (
                  <PressableScale onPress={() => setShowTimelinePicker(true)} activeScale={0.96}>
                    <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyCta}>
                      <Ionicons name="add" size={16} color={DS.white} />
                      <Text style={styles.emptyCtaText}>Log First Entry</Text>
                    </LinearGradient>
                  </PressableScale>
                )}
              </View>
            ) : (
              groupedEvents.map((group, gi) => (
                <Animated.View key={group.title} entering={FadeInUp.delay(gi * 80).springify()} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={[styles.groupTitle, { color: isDark ? DS.white : DS.gray900 }]}>{group.title}</Text>
                    <View style={[styles.groupBadge, { backgroundColor: `${DS.primary}18` }]}>
                      <Text style={[styles.groupBadgeText, { color: DS.primary }]}>{group.events.length}</Text>
                    </View>
                  </View>
                  {group.events.map((ev, ei) => {
                    const cfg = getTrackerCfg(ev?.trackerId);
                    const t = getTracker(ev?.trackerId);
                    const color = t?.gradient?.[0] || t?.color || cfg.color;
                    const isLast = ei === group.events.length - 1;
                    return (
                      <Animated.View key={ev?.id || `${gi}-${ei}`} entering={FadeInUp.delay(gi * 80 + ei * 40).springify()}>
                        <View style={styles.eventRow}>
                          <View style={styles.eventTimeCol}>
                            <Text style={[styles.eventTime, { color }]}>
                              {ev?.timestamp ? format(ev.timestamp, 'h:mm') : ''}
                            </Text>
                            <Text style={[styles.eventTimeAmPm, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                              {ev?.timestamp ? format(ev.timestamp, 'a') : ''}
                            </Text>
                            {!isLast && <View style={[styles.eventLine, { backgroundColor: `${color}35` }]} />}
                          </View>
                          <PressableScale onPress={() => handleEventPress(ev)} activeScale={0.98} style={{ flex: 1, paddingBottom: 12 }}>
                            <View style={[styles.eventCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                              <View style={[styles.eventIcon, { backgroundColor: `${color}15` }]}>
                                <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.eventTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                                  {ev?.title || cfg.label}
                                </Text>
                                <Text style={[styles.eventMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                                  {ev?.loggedByName ? `by ${ev.loggedByName}` : t?.name || cfg.label}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => handleDelete(ev)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.eventDeleteBtn}
                              >
                                <Ionicons name="trash-outline" size={14} color={DS.gray400} />
                              </TouchableOpacity>
                            </View>
                          </PressableScale>
                        </View>
                      </Animated.View>
                    );
                  })}
                </Animated.View>
              ))
            )}
          </>
        )}

        {/* ─── INSIGHTS TAB ─── */}
        {activeTab === 'insights' && (
          <View style={{ paddingHorizontal: DS.space.lg }}>
            {smartSections.length > 0 ? (
              smartSections.map(s => <View key={s.id} style={{ marginBottom: 10 }}>{s.component}</View>)
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient colors={[`${DS.primary}12`, `${DS.accent}12`]} style={styles.emptyIconBg}>
                  <Ionicons name="bulb-outline" size={40} color={DS.primary} />
                </LinearGradient>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray700 }]}>No insights yet</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Keep logging — we'll surface patterns and correlations as they emerge.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── GROWTH TAB ─── */}
        {activeTab === 'growth' && (
          <View style={{ paddingHorizontal: DS.space.lg, gap: 12 }}>
            {growthIndex && <GrowthScoreCard growthIndex={growthIndex} isDark={isDark} onPress={() => navigation.navigate('GrowthDashboard')} />}
            <WeeklyVelocity entries={allEntries} isDark={isDark} />
          </View>
        )}

        {/* ─── ACHIEVEMENTS TAB ─── */}
        {activeTab === 'achievements' && (
          <View style={{ paddingHorizontal: DS.space.lg, gap: 12 }}>
            <View style={[styles.awardsCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={styles.awardsStats}>
                <View style={styles.awardsStat}>
                  <Text style={[styles.awardsVal, { color: DS.warning }]}>{safeNumber(achievementStats?.unlocked, 0)}</Text>
                  <Text style={[styles.awardsLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Unlocked</Text>
                </View>
                <View style={[styles.awardsDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
                <View style={styles.awardsStat}>
                  <Text style={[styles.awardsVal, { color: DS.primary }]}>{safeNumber(globalStreak?.currentStreak, 0)}</Text>
                  <Text style={[styles.awardsLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Streak</Text>
                </View>
                <View style={[styles.awardsDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
                <View style={styles.awardsStat}>
                  <Text style={[styles.awardsVal, { color: DS.success }]}>{allEntries.length}</Text>
                  <Text style={[styles.awardsLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Entries</Text>
                </View>
              </View>
            </View>
            {globalStreak?.currentStreak > 0 && <StreakBanner streak={globalStreak} isDark={isDark} onAction={() => setShowTimelinePicker(true)} />}
            {safeArray(achievements).slice(0, 8).map((a, i) => {
              const [c1, c2] = getRarityGradient(a?.rarity || 'common');
              return (
                <Animated.View key={a?.id || i} entering={FadeInUp.delay(i * 60).springify()}>
                  <View style={[styles.achievementRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <LinearGradient colors={[`${c1}15`, `${c2}15`]} style={styles.achievementIconWrap}>
                      <Text style={{ fontSize: 22 }}>{a?.emoji || '🏆'}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.achievementTitle, { color: isDark ? DS.white : DS.gray900 }]}>{a?.title || 'Achievement'}</Text>
                      <Text style={[styles.achievementDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                        {a?.description || ''}
                      </Text>
                    </View>
                    <LinearGradient colors={[c1, c2]} style={styles.rarityPill}>
                      <Text style={styles.rarityPillText}>{a?.rarity || 'common'}</Text>
                    </LinearGradient>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* ─── ANALYTICS TAB ─── */}
        {activeTab === 'analytics' && (
          <View style={{ paddingHorizontal: DS.space.lg, gap: 12 }}>
            <WeeklyVelocity entries={allEntries} isDark={isDark} />
            <View style={[styles.awardsCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Text style={[styles.awardsTitle, { color: isDark ? DS.white : DS.gray900 }]}>Entry Breakdown</Text>
              <View style={styles.breakdownGrid}>
                {[
                  { label: 'Feed', key: 'feed', color: '#f59e0b', emoji: '🍼' },
                  { label: 'Sleep', key: 'sleep', color: '#8b5cf6', emoji: '😴' },
                  { label: 'Diaper', key: 'diaper', color: '#3b82f6', emoji: '👶' },
                  { label: 'Milestone', key: 'milestone', color: '#ec4899', emoji: '🏆' },
                  { label: 'Growth', key: 'growth', color: '#10b981', emoji: '📏' },
                  { label: 'Meds', key: 'medication', color: '#ef4444', emoji: '💊' },
                ].map(s => {
                  const count = allEntries.filter(e => e.trackerId === s.key).length;
                  return (
                    <View key={s.key} style={styles.breakdownItem}>
                      <View style={[styles.breakdownIcon, { backgroundColor: `${s.color}15` }]}>
                        <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                      </View>
                      <Text style={[styles.breakdownCount, { color: isDark ? DS.white : DS.gray900 }]}>{count}</Text>
                      <Text style={[styles.breakdownLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{s.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* ═══ Calendar Modal ═══ */}
      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCalendar(false)}>
          <View style={[styles.calendarCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={styles.calendarHead}>
              <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, -1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={22} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
              <Text style={[styles.calendarTitle, { color: isDark ? DS.white : DS.gray900 }]}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-forward" size={22} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={[styles.weekLabel, { color: DS.gray400 }]}>{d}</Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {calendarCells.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.calCell} />;
                const key = format(day, 'yyyy-MM-dd');
                const count = entryCountByDay.get(key) || 0;
                const isSel = !!selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const isFuture = day > new Date();
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.calCell}
                    onPress={() => {
                      if (isFuture) return;
                      triggerHaptic('light');
                      setSelectedDate(day);
                    }}
                    disabled={isFuture}
                  >
                    <View
                      style={[
                        styles.calDay,
                        isSel && { backgroundColor: DS.primary },
                        !isSel && isToday && { borderWidth: 1.5, borderColor: DS.primary, backgroundColor: `${DS.primary}10` },
                        isFuture && { opacity: 0.3 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          { color: isSel ? DS.white : isToday ? DS.primary : isDark ? DS.gray300 : DS.gray700 },
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {!isFuture && count > 0 && (
                        <View style={[styles.calDot, { backgroundColor: isSel ? DS.white : DS.primary }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.calFooter, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <TouchableOpacity onPress={() => { setSelectedDate(null); setShowCalendar(false); }} style={styles.calBtn}>
                <Text style={[styles.calBtnText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSelectedDate(new Date()); setShowCalendar(false); }} style={styles.calBtn}>
                <Text style={[styles.calBtnText, { color: DS.primary }]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCalendar(false)} style={[styles.calBtn, { backgroundColor: DS.primary, borderRadius: 12 }]}>
                <Text style={[styles.calBtnText, { color: DS.white }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ═══ Timeline Picker ═══ */}
      <TimelinePicker
        visible={showTimelinePicker}
        onClose={() => setShowTimelinePicker(false)}
        onSelect={(trackerId: string) => {
          setShowTimelinePicker(false);
          setTimeout(() => navigation.navigate('AddEntry', { trackerId }), 50);
        }}
        currentBabyName={currentBaby?.name}
        currentBabyAvatar={currentBaby?.avatar}
      />

      {/* ═══ Baby Required Modal ═══ */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.babyReqCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqIcon}>
              <Ionicons name="people-outline" size={28} color={DS.white} />
            </LinearGradient>
            <Text style={[styles.babyReqTitle, { color: isDark ? DS.white : DS.gray900 }]}>Baby Profile Needed</Text>
            <Text style={[styles.babyReqDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Create a baby profile to start tracking activities and unlock all features.
            </Text>
            <PressableScale
              onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }}
              activeScale={0.97}
              style={{ width: '100%' }}
            >
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqBtn}>
                <Text style={styles.babyReqBtnText}>Create Baby Profile</Text>
                <Ionicons name="arrow-forward" size={16} color={DS.white} />
              </LinearGradient>
            </PressableScale>
            <TouchableOpacity onPress={() => setShowBabyRequiredModal(false)} style={styles.babyReqSecondary}>
              <Text style={[styles.babyReqSecondaryText, { color: isDark ? DS.gray500 : DS.gray400 }]}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DS.white,
    paddingHorizontal: 3,
  },
  headerBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800' },

  /* Search */
  searchWrap: { paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  /* Pulse Header */
  pulseWrap: {
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'],
    padding: DS.space.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInfo: { flex: 1 },
  pulseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500' },
  pulseActions: { flexDirection: 'row', gap: 6 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.md,
    gap: DS.space.md,
  },
  pulseStat: { alignItems: 'center' },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },
  sparkWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginLeft: 'auto', height: 34 },
  sparkCol: { justifyContent: 'flex-end' },
  sparkBar: { width: 5, borderRadius: 2 },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 13, fontWeight: '600', marginTop: 1 },

  /* Quick Logs */
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    ...DS.shadow.sm,
  },
  quickEmoji: { fontSize: 16 },
  quickLabel: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Velocity */
  velocityCard: {
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  velocityHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.md },
  velocityIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  velocityTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  velocitySub: { fontSize: 11, fontWeight: '600' },
  velocityBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
  velocityCol: { flex: 1, alignItems: 'center', gap: 3 },
  velocityCount: { fontSize: 9, fontWeight: '700' },
  velocityBarTrack: {
    width: '100%',
    height: 40,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  velocityBar: { width: '100%', borderRadius: 6 },
  velocityDay: { fontSize: 10, fontWeight: '600' },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: DS.space.lg,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: DS.radius.full,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: DS.radius.full,
  },
  tabItemActive: {
    backgroundColor: DS.white,
    ...DS.shadow.sm,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Date banner */
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${DS.primary}12`,
    borderRadius: DS.radius.full,
  },
  dateBannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: DS.primary },

  /* Filter chips */
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },

  /* Timeline groups */
  group: { marginTop: DS.space.lg, paddingHorizontal: DS.space.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: DS.space.md },
  groupTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  groupBadgeText: { fontSize: 11, fontWeight: '700' },
  eventRow: { flexDirection: 'row', gap: DS.space.sm },
  eventTimeCol: { width: 48, alignItems: 'flex-end', paddingTop: 12 },
  eventTime: { fontSize: 12, fontWeight: '800' },
  eventTimeAmPm: { fontSize: 9, fontWeight: '600', marginTop: -2, textTransform: 'uppercase' },
  eventLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  eventIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 14, fontWeight: '700' },
  eventMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  eventDeleteBtn: { padding: 4 },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: DS.space.lg },
  emptyIconBg: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, marginBottom: DS.space.lg },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  emptyCtaText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Smart cards */
  smartCard: {
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  smartCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md },
  smartIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  smartTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  smartDesc: { fontSize: 12, lineHeight: 17 },
  smartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: DS.space.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  smartActionText: { fontSize: 12, fontWeight: '700' },

  /* Correlation */
  corrCard: { borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1 },
  corrHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  corrBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  corrBadgeText: { fontSize: 10, fontWeight: '700' },
  corrTime: { fontSize: 10, fontWeight: '600' },
  corrInsight: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 8 },
  corrAction: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  corrActionText: { fontSize: 11, fontWeight: '700' },

  /* Reminder */
  reminderCard: {
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  reminderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md },
  reminderEmoji: { fontSize: 24 },
  reminderTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  reminderDesc: { fontSize: 12, lineHeight: 17 },
  reminderMeta: { flexDirection: 'row', gap: 6, marginTop: DS.space.sm, flexWrap: 'wrap' },
  reminderTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reminderTimeText: { fontSize: 10, fontWeight: '700' },
  reminderActions: { flexDirection: 'row', marginTop: DS.space.md },
  reminderPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  reminderPrimaryText: { color: DS.white, fontSize: 12, fontWeight: '700' },

  /* Growth */
  growthCard: {
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  growthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  growthTitle: { fontSize: 15, fontWeight: '800' },
  growthComposite: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  growthCompositeText: { fontSize: 16, fontWeight: '800' },
  growthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  growthItem: { width: '30%', gap: 4 },
  growthItemEmoji: { fontSize: 18 },
  growthBar: { height: 5, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  growthFill: { height: '100%', borderRadius: 3 },
  growthItemLabel: { fontSize: 10, fontWeight: '600' },

  /* Streak */
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  streakEmoji: { fontSize: 28 },
  streakTitle: { fontSize: 14, fontWeight: '800' },
  streakSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  streakProgress: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  streakProgressFill: { height: '100%', borderRadius: 2 },

  /* Awards */
  awardsCard: { borderRadius: DS.radius.xl, padding: DS.space.lg, borderWidth: 1, ...DS.shadow.sm },
  awardsTitle: { fontSize: 15, fontWeight: '800', marginBottom: DS.space.md },
  awardsStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  awardsStat: { alignItems: 'center', gap: 2 },
  awardsVal: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  awardsLbl: { fontSize: 11, fontWeight: '600' },
  awardsDiv: { width: 1, height: 30 },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  achievementIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  achievementTitle: { fontSize: 13, fontWeight: '700' },
  achievementDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  rarityPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  rarityPillText: { fontSize: 10, fontWeight: '800', color: DS.white, textTransform: 'uppercase' },

  /* Breakdown */
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownItem: { width: '30%', alignItems: 'center', gap: 4 },
  breakdownIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  breakdownCount: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 10, fontWeight: '600' },

  /* Modal backdrop */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  /* Calendar */
  calendarCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: DS.radius['2xl'],
    padding: DS.space.lg,
    borderWidth: 1,
    ...DS.shadow.lg,
  },
  calendarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  calendarTitle: { fontSize: 16, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDay: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  calDayText: { fontSize: 13, fontWeight: '600' },
  calDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  calFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: DS.space.md, paddingTop: DS.space.md, borderTopWidth: 1 },
  calBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  calBtnText: { fontSize: 13, fontWeight: '700' },

  /* Baby required */
  babyReqCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: DS.radius['2xl'],
    padding: DS.space['2xl'],
    alignItems: 'center',
    ...DS.shadow.lg,
  },
  babyReqIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  babyReqTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  babyReqDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: DS.space.lg, paddingHorizontal: 6 },
  babyReqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, width: '100%' },
  babyReqBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  babyReqSecondary: { marginTop: DS.space.sm, paddingVertical: 10 },
  babyReqSecondaryText: { fontSize: 13, fontWeight: '600' },
});