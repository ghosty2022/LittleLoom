import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format,
  addDays,
  isSameDay,
  startOfDay,
  differenceInDays,
  differenceInHours,
  addMinutes,
  set,
} from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useDateTimePicker } from '../../hooks/useDateTimePicker';
import type { RootStackParamList } from '../../types/navigation';

let Svg: any = null, Circle: any = null, Defs: any = null, SvgLinearGradient: any = null, Stop: any = null;
try {
  const SvgModule = require('react-native-svg');
  Svg = SvgModule.default ?? SvgModule;
  Circle = SvgModule.Circle;
  Defs = SvgModule.Defs;
  SvgLinearGradient = SvgModule.LinearGradient;
  Stop = SvgModule.Stop;
} catch { /* fallback */ }

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = 52;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
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
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
type RepeatType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'once' | 'custom';
type CategoryType = 'potty' | 'feed' | 'sleep' | 'milestone' | 'medication' | 'play' | 'custom' | 'growth' | 'diaper' | 'symptom';
type ViewMode = 'today' | 'upcoming' | 'all' | 'smart' | 'analytics';

interface Reminder {
  id: string; title: string; time: string; emoji: string; enabled: boolean;
  repeat: RepeatType; category: CategoryType; babyId?: string; babyName?: string;
  notes?: string; lastTriggered?: string; streakDay?: number;
  isAchievementRelated?: boolean; achievementId?: string; smartSuggestion?: boolean;
  notificationId?: string; createdAt: string; color?: string;
  daysOfWeek?: number[]; endDate?: string; completedDates?: string[];
}

interface SmartSuggestion {
  id: string; type: CategoryType; title: string; description: string; emoji: string;
  reason: string; optimalTime: string; confidence: number; basedOn: string;
  action?: string; priority: 'high' | 'medium' | 'low';
}

interface DailyInsight {
  id: string; type: 'pattern' | 'streak' | 'health' | 'milestone' | 'urgent';
  title: string; message: string; emoji: string; color: string;
  actionLabel?: string; actionScreen?: string;
}

interface AlertState {
  visible: boolean; type: 'success' | 'error' | 'info' | 'warning' | 'achievement';
  title: string; message: string; emoji?: string;
}

const STORAGE_KEYS = {
  REMINDERS: '@littleloom_reminders_v4',
  COMPLETED: '@littleloom_completed_reminders_v3',
  SNOOZED: '@littleloom_snoozed_reminders_v2',
  SMART_DISMISSED: '@littleloom_smart_dismissed_v2',
  ANALYTICS: '@littleloom_reminder_analytics',
};

const CATEGORY_CONFIG: Record<CategoryType, { emoji: string; color: string; label: string; gradient: [string, string]; icon: any }> = {
  potty: { emoji: '🚽', color: '#667eea', label: 'Potty', gradient: ['#667eea', '#764ba2'], icon: 'water-outline' },
  feed: { emoji: '🍼', color: '#fa709a', label: 'Feed', gradient: ['#fa709a', '#f5576c'], icon: 'nutrition-outline' },
  sleep: { emoji: '😴', color: '#11998e', label: 'Sleep', gradient: ['#11998e', '#38ef7d'], icon: 'moon-outline' },
  milestone: { emoji: '🌟', color: '#f59e0b', label: 'Milestone', gradient: ['#f59e0b', '#fbbf24'], icon: 'trophy-outline' },
  medication: { emoji: '💊', color: '#ef4444', label: 'Medication', gradient: ['#ef4444', '#f87171'], icon: 'medical-outline' },
  play: { emoji: '🎮', color: '#ec4899', label: 'Play', gradient: ['#ec4899', '#f472b6'], icon: 'game-controller-outline' },
  growth: { emoji: '📏', color: '#43e97b', label: 'Growth', gradient: ['#43e97b', '#38f9d7'], icon: 'trending-up-outline' },
  diaper: { emoji: '🧷', color: '#fc5c7d', label: 'Diaper', gradient: ['#fc5c7d', '#ff6b6b'], icon: 'shirt-outline' },
  symptom: { emoji: '🤒', color: '#f97316', label: 'Symptom', gradient: ['#f97316', '#fb923c'], icon: 'pulse-outline' },
  custom: { emoji: '⏰', color: '#64748b', label: 'Custom', gradient: ['#94a3b8', '#cbd5e1'], icon: 'timer-outline' },
};

const REPEAT_LABELS: Record<RepeatType, string> = {
  daily: 'Every day', weekdays: 'Mon-Fri', weekends: 'Sat-Sun',
  weekly: 'Weekly', once: 'One time', custom: 'Custom',
};

const WEEKDAYS = [
  { id: 1, label: 'M' }, { id: 2, label: 'T' }, { id: 3, label: 'W' },
  { id: 4, label: 'T' }, { id: 5, label: 'F' }, { id: 6, label: 'S' }, { id: 0, label: 'S' },
];

const HAPTIC_LIGHT = () => Vibration.vibrate(20);

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText + PressableScale
   ═══════════════════════════════════════════════════════════════════════════ */
const GradientText = memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
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
const PressableScale = memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >{children}</AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SectionHeader
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel, isDark }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string; isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
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

/* ═══════════════════════════════════════════════════════════════════════════
   Reminders Pulse Header
   ═══════════════════════════════════════════════════════════════════════════ */
const RemindersPulse = memo(({
  isDark, baby, activeCount, totalCount, streak, atRisk, nextReminder, onBabyPress, onShare,
}: {
  isDark: boolean; baby: any; activeCount: number; totalCount: number;
  streak: number; atRisk: boolean; nextReminder: Reminder | null;
  onBabyPress: () => void; onShare: () => void;
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const nextText = nextReminder
    ? `${nextReminder.time} · ${nextReminder.title}`
    : 'All caught up';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <SafeBabyAvatar avatar={baby?.avatar} gender={baby?.gender} size={44} showBadge={false} />
              </View>
            </View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby?.name || 'Reminders'}
              </Text>
              <View style={[styles.pulseAgePill, { backgroundColor: atRisk ? `${DS.danger}18` : `${DS.success}18` }]}>
                <Ionicons name={atRisk ? 'flame-outline' : 'flame'} size={10} color={atRisk ? DS.danger : DS.success} />
                <Text style={[styles.pulseAgeText, { color: atRisk ? DS.danger : DS.success }]}>{streak}d</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: atRisk ? DS.danger : DS.success }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {activeCount}/{totalCount} active · {nextText}
              </Text>
            </View>
          </View>
          <PressableScale onPress={onShare} activeScale={0.9}>
            <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="share-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
            </View>
          </PressableScale>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{activeCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>active</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.gray500 }]}>{totalCount - activeCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>paused</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: atRisk ? DS.danger : DS.success }]}>{streak}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>streak</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */
const AuraRibbon = memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(120).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   View Tabs
   ═══════════════════════════════════════════════════════════════════════════ */
const ViewTabs = memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: ViewMode; label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number }[];
  activeTab: ViewMode; onChange: (t: ViewMode) => void; isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map(t => {
      const active = activeTab === t.key;
      return (
        <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}>
          <Ionicons name={t.icon} size={15} color={active ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, active && { fontWeight: '700' }]}>{t.label}</Text>
          {!!t.badge && t.badge > 0 && !active && (
            <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{t.badge}</Text></View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Category Filter (horizontal pills)
   ═══════════════════════════════════════════════════════════════════════════ */
const CategoryFilter = memo(({ selected, onChange, reminders, isDark }: {
  selected: string; onChange: (c: string) => void; reminders: Reminder[]; isDark: boolean;
}) => {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reminders.length };
    Object.keys(CATEGORY_CONFIG).forEach(k => { c[k] = reminders.filter(r => r.category === k).length; });
    return c;
  }, [reminders]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
      <TouchableOpacity
        onPress={() => onChange('all')}
        style={[styles.filterChip, { backgroundColor: selected === 'all' ? DS.primary : isDark ? DS.darkCard : DS.white, borderColor: selected === 'all' ? DS.primary : isDark ? DS.darkBorder : DS.gray200 }]}
      >
        <Text style={[styles.filterText, { color: selected === 'all' ? DS.white : isDark ? DS.gray300 : DS.gray600 }, selected === 'all' && { fontWeight: '700' }]}>All</Text>
        <View style={[styles.filterBadge, { backgroundColor: selected === 'all' ? 'rgba(255,255,255,0.25)' : isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
          <Text style={[styles.filterBadgeText, { color: selected === 'all' ? DS.white : isDark ? DS.gray400 : DS.gray500 }]}>{counts.all}</Text>
        </View>
      </TouchableOpacity>
      {Object.entries(CATEGORY_CONFIG).map(([key, cat]) => {
        const active = selected === key;
        const count = counts[key] || 0;
        if (count === 0) return null;
        return (
          <TouchableOpacity
            key={key} onPress={() => onChange(key)}
            style={[styles.filterChip, { backgroundColor: active ? cat.color : isDark ? DS.darkCard : DS.white, borderColor: active ? cat.color : isDark ? DS.darkBorder : DS.gray200 }]}
          >
            <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
            <Text style={[styles.filterText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray600 }, active && { fontWeight: '700' }]}>{cat.label}</Text>
            {!active && (
              <View style={[styles.filterBadge, { backgroundColor: `${cat.color}18` }]}>
                <Text style={[styles.filterBadgeText, { color: cat.color }]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Stats Ring
   ═══════════════════════════════════════════════════════════════════════════ */
const StatsRing = memo(({ total, active, isDark }: { total: number; active: number; isDark: boolean }) => {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (active / total) * 100 : 0;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <View style={[styles.auraCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, alignItems: 'center' }]}>
        <View style={{ width: size, height: size }}>
          {Svg ? (
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <Defs>
                <SvgLinearGradient id="statsRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={DS.primary} />
                  <Stop offset="100%" stopColor={DS.accent} />
                </SvgLinearGradient>
              </Defs>
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth={strokeWidth} fill="none" />
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke="url(#statsRingGrad)" strokeWidth={strokeWidth} fill="none"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </Svg>
          ) : (
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: DS.primary }} />
          )}
          <View style={styles.ringInner}>
            <Text style={[styles.ringVal, { color: isDark ? DS.white : DS.gray900 }]}>{active}</Text>
            <Text style={[styles.ringLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>active</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.ringDot, { backgroundColor: DS.primary }]} />
            <Text style={[styles.ringMetaText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{active} active</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.ringDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : DS.gray300 }]} />
            <Text style={[styles.ringMetaText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{total - active} paused</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Category Breakdown
   ═══════════════════════════════════════════════════════════════════════════ */
const CategoryBreakdown = memo(({ reminders, isDark }: { reminders: Reminder[]; isDark: boolean }) => {
  const cats = useMemo(() => {
    const c: Record<string, { label: string; color: string; count: number }> = {};
    Object.entries(CATEGORY_CONFIG).forEach(([k, v]) => { c[k] = { label: v.label, color: v.color, count: 0 }; });
    reminders.forEach(r => { if (c[r.category]) c[r.category].count++; });
    return Object.entries(c).filter(([_, d]) => d.count > 0).sort((a, b) => b[1].count - a[1].count);
  }, [reminders]);

  if (!cats.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(140).springify()}>
      <SectionHeader title="Categories" subtitle="Your reminder breakdown" icon="grid-outline" color={DS.info} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {cats.map(([key, d]) => (
          <View key={key} style={[styles.catCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <LinearGradient colors={[`${d.color}15`, `${d.color}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={[styles.catIcon, { backgroundColor: `${d.color}18` }]}>
              <Text style={{ fontSize: 20 }}>{CATEGORY_CONFIG[key as CategoryType].emoji}</Text>
            </View>
            <Text style={[styles.catCount, { color: isDark ? DS.white : DS.gray900 }]}>{d.count}</Text>
            <Text style={[styles.catLabel, { color: d.color }]}>{d.label}</Text>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Timeline
   ═══════════════════════════════════════════════════════════════════════════ */
const Timeline = memo(({ reminders, onPress, isDark }: { reminders: Reminder[]; onPress: (r: Reminder) => void; isDark: boolean }) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = useMemo(() => {
    return reminders.filter(r => r.enabled).sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    }).map(r => {
      const [h, m] = r.time.split(':').map(Number);
      const minutes = h * 60 + m;
      return { ...r, isPast: minutes < currentMinutes, isNext: minutes >= currentMinutes && minutes <= currentMinutes + 60, minutes };
    });
  }, [reminders, currentMinutes]);

  if (!upcoming.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(180).springify()}>
      <SectionHeader title="Today's Timeline" subtitle={`${upcoming.filter(r => !r.isPast).length} remaining`} icon="time-outline" color={DS.accent} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 12, paddingVertical: 4 }}>
        {upcoming.map((r, i) => {
          const cfg = CATEGORY_CONFIG[r.category];
          return (
            <PressableScale key={r.id} onPress={() => onPress(r)} activeScale={0.94}>
              <View style={[styles.tlNode, {
                backgroundColor: isDark ? DS.darkCard : DS.white,
                borderColor: r.isNext ? cfg.color : isDark ? DS.darkBorder : DS.gray200,
                borderWidth: r.isNext ? 2 : 1,
              }]}>
                <View style={[styles.tlDot, { backgroundColor: r.isPast ? `${cfg.color}30` : `${cfg.color}18` }]}>
                  <Text style={{ fontSize: 16 }}>{r.emoji || cfg.emoji}</Text>
                </View>
                <Text style={[styles.tlTime, { color: r.isPast ? isDark ? DS.gray500 : DS.gray400 : cfg.color }]}>{r.time}</Text>
                <Text style={[styles.tlLabel, { color: isDark ? DS.gray300 : DS.gray600 }]} numberOfLines={1}>{r.title}</Text>
                {r.isNext && (
                  <View style={[styles.tlNextBadge, { backgroundColor: cfg.color }]}>
                    <Text style={styles.tlNextText}>NEXT</Text>
                  </View>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Daily Insights
   ═══════════════════════════════════════════════════════════════════════════ */
const Insights = memo(({ insights, isDark, onAction }: { insights: DailyInsight[]; isDark: boolean; onAction: (i: DailyInsight) => void }) => {
  if (!insights.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <SectionHeader title="Daily Insights" subtitle={`${insights.length} smart tips`} icon="sparkles-outline" color={DS.warning} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {insights.map(i => (
          <PressableScale key={i.id} onPress={() => onAction(i)} activeScale={0.97}>
            <View style={[styles.insightCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, borderLeftColor: i.color }]}>
              <LinearGradient colors={[`${i.color}10`, `${i.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Text style={{ fontSize: 20 }}>{i.emoji}</Text>
              <Text style={[styles.insightTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{i.title}</Text>
              <Text style={[styles.insightDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{i.message}</Text>
              {i.actionLabel && (
                <View style={[styles.insightAction, { backgroundColor: `${i.color}18` }]}>
                  <Text style={[styles.insightActionText, { color: i.color }]}>{i.actionLabel} →</Text>
                </View>
              )}
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Reminder Item
   ═══════════════════════════════════════════════════════════════════════════ */
const ReminderItem = memo(({ item, index, isNext, onToggle, onPress, onLongPress, isDark }: {
  item: Reminder; index: number; isNext: boolean;
  onToggle: (id: string) => void; onPress: (r: Reminder) => void;
  onLongPress: (id: string) => void; isDark: boolean;
}) => {
  const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.custom;
  return (
    <Animated.View entering={FadeInUp.delay(index * 30).springify()} layout={Layout.springify()}>
      <PressableScale onPress={() => onPress(item)} activeScale={0.98}>
        <TouchableOpacity
          onLongPress={() => { Vibration.vibrate(50); onLongPress(item.id); }}
          activeOpacity={0.95}
          style={[styles.reminderCard, {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isNext ? `${cfg.color}50` : isDark ? DS.darkBorder : DS.gray200,
            borderWidth: isNext ? 2 : 1,
            opacity: item.enabled ? 1 : 0.6,
          }]}
        >
          <LinearGradient colors={[`${cfg.color}08`, `${cfg.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={[styles.remIcon, { backgroundColor: `${cfg.color}15` }]}>
            <Text style={{ fontSize: 22 }}>{item.emoji || cfg.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.remTitle, { color: isDark ? DS.white : DS.gray900 }, !item.enabled && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.remTime, { color: cfg.color }]}>{item.time}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <View style={[styles.catBadge, { backgroundColor: `${cfg.color}15` }]}>
                <Text style={[styles.catBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              <Text style={[styles.metaText, { color: isDark ? DS.gray500 : DS.gray400 }]}>• {REPEAT_LABELS[item.repeat]}</Text>
              {item.smartSuggestion && (
                <View style={[styles.aiBadge, { backgroundColor: `${DS.warning}15` }]}>
                  <Ionicons name="sparkles" size={9} color={DS.warning} />
                  <Text style={[styles.aiBadgeText, { color: DS.warning }]}>AI</Text>
                </View>
              )}
              {isNext && item.enabled && (
                <View style={[styles.nextBadge, { backgroundColor: cfg.color }]}>
                  <Text style={styles.nextBadgeText}>NEXT</Text>
                </View>
              )}
            </View>
            {item.notes && <Text style={[styles.remNotes, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>{item.notes}</Text>}
          </View>
          <Switch
            value={item.enabled}
            onValueChange={() => onToggle(item.id)}
            trackColor={{ false: isDark ? DS.gray700 : DS.gray200, true: `${cfg.color}50` }}
            thumbColor={item.enabled ? cfg.color : isDark ? DS.gray500 : DS.white}
            ios_backgroundColor={isDark ? DS.gray700 : DS.gray200}
          />
        </TouchableOpacity>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Suggestion Card
   ═══════════════════════════════════════════════════════════════════════════ */
const SmartCard = memo(({ suggestion, onApply, onDismiss, isDark, index }: {
  suggestion: SmartSuggestion; onApply: (s: SmartSuggestion) => void;
  onDismiss: (id: string) => void; isDark: boolean; index: number;
}) => {
  const cfg = CATEGORY_CONFIG[suggestion.type];
  const confColor = suggestion.confidence > 85 ? DS.success : suggestion.confidence > 70 ? DS.warning : DS.info;
  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <View style={[styles.smartCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={[`${cfg.color}10`, `${cfg.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md }}>
          <View style={[styles.smartIcon, { backgroundColor: `${cfg.color}18` }]}>
            <Text style={{ fontSize: 22 }}>{suggestion.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.smartTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{suggestion.title}</Text>
              <View style={[styles.confBadge, { backgroundColor: `${confColor}18` }]}>
                <Text style={[styles.confText, { color: confColor }]}>{suggestion.confidence}%</Text>
              </View>
            </View>
            <Text style={[styles.smartDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{suggestion.description}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Ionicons name="time-outline" size={11} color={isDark ? DS.gray500 : DS.gray400} />
              <Text style={[styles.smartTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>Best at {suggestion.optimalTime}</Text>
              {suggestion.priority === 'high' && (
                <View style={[styles.priBadge, { backgroundColor: `${DS.danger}18` }]}>
                  <Text style={[styles.priText, { color: DS.danger }]}>URGENT</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => onDismiss(suggestion.id)} style={{ padding: 4 }}>
            <Ionicons name="close" size={16} color={isDark ? DS.gray500 : DS.gray400} />
          </TouchableOpacity>
        </View>
        <PressableScale onPress={() => onApply(suggestion)} activeScale={0.97} style={{ marginTop: 12 }}>
          <LinearGradient colors={cfg.gradient} style={styles.smartApply} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="add-circle" size={16} color={DS.white} />
            <Text style={styles.smartApplyText}>Add Reminder</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Intelligent Engine (unchanged logic)
   ═══════════════════════════════════════════════════════════════════════════ */
class IntelligentReminderEngine {
  constructor(private activities: any[], private baby: any, private milestones: any[], private existingReminders: Reminder[]) {}
  analyzePatterns(): SmartSuggestion[] {
    const s: SmartSuggestion[] = [];
    if (!this.baby) return s;
    const babyActs = this.activities.filter(a => a.babyId === this.baby.id);
    const now = new Date(), currentHour = now.getHours();

    const potty = babyActs.filter(a => a.type === 'potty' || a.trackerId === 'potty');
    if (potty.length >= 3) {
      const avg = this.calcInterval(potty, 2);
      const last = potty[potty.length - 1];
      const hSince = last ? differenceInHours(now, new Date(last.timestamp)) : 999;
      const next = last ? addMinutes(new Date(last.timestamp), avg * 60) : null;
      if (hSince > avg * 0.8) {
        s.push({ id: 'potty_urgent', type: 'potty', title: 'Potty Break Soon', description: `Last potty was ${hSince}h ago. Usual: ${Math.round(avg)}h.`, emoji: '🚽', reason: 'Pattern detected', optimalTime: next ? format(next, 'HH:mm') : format(addMinutes(now, 30), 'HH:mm'), confidence: Math.min(95, 60 + hSince * 5), basedOn: `${potty.length} potty logs`, action: 'Log now', priority: hSince > avg ? 'high' : 'medium' });
      }
    }
    const sleep = babyActs.filter(a => a.type === 'sleep' || a.trackerId === 'sleep');
    if (sleep.length >= 2) {
      const bedtimes = sleep.map((a: any) => new Date(a.timestamp).getHours());
      if (bedtimes.length) {
        const avg = Math.round(bedtimes.reduce((a: number, b: number) => a + b, 0) / bedtimes.length);
        const str = `${String(avg).padStart(2, '0')}:00`;
        if (!this.hasReminderFor('sleep', str)) {
          s.push({ id: 'sleep_routine', type: 'sleep', title: 'Bedtime Routine', description: `Start winding down around ${str}.`, emoji: '😴', reason: 'Consistent bedtime', optimalTime: `${String(Math.max(0, avg - 1)).padStart(2, '0')}:30`, confidence: 90, basedOn: `${sleep.length} sleep sessions`, action: 'Start routine', priority: currentHour >= avg - 1 && currentHour < avg + 1 ? 'high' : 'medium' });
        }
      }
    }
    const feed = babyActs.filter(a => a.type === 'feed' || a.trackerId === 'feed');
    if (feed.length >= 3) {
      const avg = this.calcInterval(feed);
      const last = feed[feed.length - 1];
      const hSince = last ? differenceInHours(now, new Date(last.timestamp)) : 999;
      if (hSince > avg * 0.7) {
        s.push({ id: 'feed_soon', type: 'feed', title: 'Feeding Time', description: `Average gap: ${Math.round(avg)}h. Last: ${hSince}h ago.`, emoji: '🍼', reason: 'Regular feeding', optimalTime: format(addMinutes(now, 15), 'HH:mm'), confidence: Math.min(90, 50 + hSince * 8), basedOn: `${feed.length} feeds`, action: 'Prepare', priority: hSince > avg ? 'high' : 'medium' });
      }
    }
    const streak = this.calcStreak();
    if (streak >= 3) {
      const hasToday = babyActs.some(a => isSameDay(new Date(a.timestamp), now));
      if (!hasToday && currentHour >= 18) {
        s.push({ id: 'streak_protect', type: 'custom', title: `🔥 Protect ${streak}-Day Streak!`, description: `${24 - currentHour}h left to log.`, emoji: '🔥', reason: "Don't break it", optimalTime: `${String(currentHour + 1).padStart(2, '0')}:00`, confidence: 95, basedOn: `${streak}-day streak`, action: 'Quick log', priority: 'high' });
      }
    }
    return s.sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.priority]) - ({ high: 3, medium: 2, low: 1 }[a.priority]));
  }
  private calcInterval(acts: any[], fallback = 3) {
    if (acts.length < 2) return fallback;
    let t = 0, c = 0;
    for (let i = 1; i < acts.length; i++) { const d = differenceInHours(new Date(acts[i].timestamp), new Date(acts[i - 1].timestamp)); if (d > 0 && d < 24) { t += d; c++; } }
    return c > 0 ? t / c : fallback;
  }
  private calcStreak() {
    const acts = this.activities.filter(a => a.babyId === this.baby?.id);
    let s = 0, d = new Date();
    while (true) {
      if (acts.some(a => isSameDay(new Date(a.timestamp), d))) { s++; d = addDays(d, -1); } else break;
    }
    return s;
  }
  private hasReminderFor(cat: CategoryType, time: string) {
    return this.existingReminders.some(r => r.category === cat && r.time === time && r.enabled);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
type Props = NativeStackScreenProps<RootStackParamList, 'TrackerReminders'>;

export default function RemindersScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();
  const { currentBaby, babies, loadBabies } = useBaby();
  const { entries: activities } = useActivity();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [streakData, setStreakData] = useState({ current: 0, atRisk: false, hoursLeft: 0 });
  const [analytics, setAnalytics] = useState<any>({});
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('custom');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('daily');
  const [formTime, setFormTime] = useState(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formColor, setFormColor] = useState(CATEGORY_CONFIG.custom.color);
  const datePicker = useDateTimePicker();

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP) }));

  const baby = useMemo(() => {
    if (route.params?.babyId) return babies.find(b => b.id === route.params?.babyId) || currentBaby;
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  useFocusEffect(useCallback(() => {
    loadBabies();
    loadData();
    checkStreakStatus();
    generateSmartSuggestions();
    generateDailyInsights();
  }, [baby?.id, loadBabies]));

  useEffect(() => {
    loadData();
    loadAnalytics();
    requestNotificationPermissions();
    loadDismissedSuggestions();
    if (route.params?.suggestedType || route.params?.fromAchievement) handleAchievementSuggestion();
  }, [baby?.id]);

  useEffect(() => {
    if (!baby && !isInitialLoad) setShowBabyRequiredModal(true);
    else setShowBabyRequiredModal(false);
  }, [baby]);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      if (saved) {
        const parsed: Reminder[] = JSON.parse(saved);
        setReminders(baby ? parsed.filter(r => !r.babyId || r.babyId === baby.id) : parsed);
      } else setReminders(getDefaultReminders());
    } catch { setReminders(getDefaultReminders()); }
    finally { setIsInitialLoad(false); }
  };

  const loadAnalytics = async () => {
    try { const s = await AsyncStorage.getItem(STORAGE_KEYS.ANALYTICS); if (s) setAnalytics(JSON.parse(s)); } catch {}
  };
  const loadDismissedSuggestions = async () => {
    try { const s = await AsyncStorage.getItem(STORAGE_KEYS.SMART_DISMISSED); if (s) setDismissedSuggestions(new Set(JSON.parse(s))); } catch {}
  };
  const saveDismissedSuggestions = async (set: Set<string>) => {
    try { await AsyncStorage.setItem(STORAGE_KEYS.SMART_DISMISSED, JSON.stringify([...set])); } catch {}
  };
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') sweetAlert.error('Notifications Required', 'Please enable notifications in Settings.');
  };

  const getDefaultReminders = (): Reminder[] => {
    if (!baby) return [];
    const babyId = baby.id, babyName = baby.name;
    const now = new Date().toISOString();
    return [
      { id: 'default_1', title: 'Morning Potty', time: '08:00', emoji: '🚽', enabled: true, repeat: 'daily', category: 'potty', babyId, babyName, createdAt: now, color: CATEGORY_CONFIG.potty.color },
      { id: 'default_2', title: 'First Feed', time: '07:00', emoji: '🍼', enabled: true, repeat: 'daily', category: 'feed', babyId, babyName, createdAt: now, color: CATEGORY_CONFIG.feed.color },
      { id: 'default_3', title: 'Bedtime Routine', time: '19:30', emoji: '🌙', enabled: true, repeat: 'daily', category: 'sleep', babyId, babyName, createdAt: now, color: CATEGORY_CONFIG.sleep.color },
      { id: 'default_4', title: 'Vitamin D', time: '08:30', emoji: '💊', enabled: true, repeat: 'daily', category: 'medication', babyId, babyName, createdAt: now, color: CATEGORY_CONFIG.medication.color },
    ];
  };

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      const all: Reminder[] = saved ? JSON.parse(saved) : [];
      const other = baby?.id ? all.filter(r => r.babyId && r.babyId !== baby.id) : all;
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify([...other, ...newReminders]));
    } catch { showToast('error', 'Save Failed', 'Could not save'); }
  };

  const generateSmartSuggestions = useCallback(() => {
    if (!baby) { setSmartSuggestions([]); return; }
    const engine = new IntelligentReminderEngine(activities, baby, [], reminders);
    setSmartSuggestions(engine.analyzePatterns().filter(s => !dismissedSuggestions.has(s.id)));
  }, [activities, baby, reminders, dismissedSuggestions]);

  const generateDailyInsights = useCallback(() => {
    if (!baby) { setDailyInsights([]); return; }
    const list: DailyInsight[] = [];
    const now = new Date();
    const babyActs = activities.filter(a => a.babyId === baby.id);
    let streak = 0, d = new Date();
    while (true) {
      if (babyActs.some(a => isSameDay(new Date(a.timestamp), d))) { streak++; d = addDays(d, -1); } else break;
    }
    if (streak >= 3) list.push({ id: 'streak-insight', type: 'streak', title: `${streak}-Day Streak!`, message: "You're on fire!", emoji: '🔥', color: DS.warning, actionLabel: 'Quick Log', actionScreen: 'Timeline' });
    const overdue = reminders.filter(r => {
      const [h, m] = r.time.split(':').map(Number);
      return r.enabled && (h * 60 + m) < (now.getHours() * 60 + now.getMinutes()) && !r.lastTriggered;
    }).length;
    if (overdue > 0) list.push({ id: 'overdue', type: 'urgent', title: `${overdue} Overdue`, message: 'Some passed their time', emoji: '⚠️', color: DS.danger, actionLabel: 'View All', actionScreen: 'Reminders' });
    const upcoming = reminders.filter(r => {
      const [h, m] = r.time.split(':').map(Number);
      const t = h * 60 + m, c = now.getHours() * 60 + now.getMinutes();
      return r.enabled && t > c && t <= c + 120;
    }).length;
    if (upcoming > 0) list.push({ id: 'upcoming', type: 'pattern', title: `${upcoming} Coming Up`, message: 'In next 2 hours', emoji: '⏰', color: DS.info, actionLabel: 'Prepare', actionScreen: 'Reminders' });
    setDailyInsights(list);
  }, [activities, baby, reminders]);

  const checkStreakStatus = useCallback(() => {
    if (!baby) return;
    const babyActs = activities.filter(a => a.babyId === baby.id);
    let streak = 0, d = new Date();
    while (true) { if (babyActs.some(a => isSameDay(new Date(a.timestamp), d))) { streak++; d = addDays(d, -1); } else break; }
    const today = babyActs.some(a => isSameDay(new Date(a.timestamp), new Date()));
    const hour = new Date().getHours();
    const atRisk = !today && hour >= 18 && streak > 0;
    setStreakData({ current: streak, atRisk, hoursLeft: atRisk ? 24 - hour : 0 });
  }, [baby, activities]);

  const handleAchievementSuggestion = () => {
    const { suggestedType, fromAchievement } = route.params || {};
    let title = 'Achievement Reminder', emoji = '🎯', category: CategoryType = 'custom';
    switch (suggestedType) {
      case 'potty': title = 'Potty Goal'; emoji = '🚽'; category = 'potty'; break;
      case 'feed': title = 'Feeding Goal'; emoji = '🍼'; category = 'feed'; break;
      case 'sleep': title = 'Sleep Routine'; emoji = '😴'; category = 'sleep'; break;
      case 'milestone': title = 'Record Milestone'; emoji = '🌟'; category = 'milestone'; break;
      case 'streak': title = 'Protect Streak'; emoji = '🔥'; category = 'custom'; break;
    }
    openAddModal({ title, category, emoji, isAchievementRelated: true, achievementId: fromAchievement });
  };

  const scheduleNotification = async (reminder: Reminder): Promise<string | undefined> => {
    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const now = new Date();
      let trigger: Notifications.NotificationTriggerInput;
      switch (reminder.repeat) {
        case 'daily': trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours, minute: minutes }; break;
        case 'weekdays': trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: hours, minute: minutes }; break;
        case 'weekends': trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 7, hour: hours, minute: minutes }; break;
        case 'weekly': trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (now.getDay() + 1) || 7, hour: hours, minute: minutes }; break;
        case 'custom':
          if (reminder.daysOfWeek?.length) {
            const today = now.getDay();
            const nd = reminder.daysOfWeek.find(d => d > today) || reminder.daysOfWeek[0];
            const days = nd > today ? nd - today : 7 - today + nd;
            const target = addDays(now, days); target.setHours(hours, minutes, 0, 0);
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target };
          } else trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours, minute: minutes };
          break;
        default:
          const d = new Date(); d.setHours(hours, minutes, 0, 0);
          if (d < now) d.setDate(d.getDate() + 1);
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d };
      }
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: `${reminder.emoji} ${reminder.title}`,
          body: reminder.notes || `Time for ${reminder.title.toLowerCase()}!`,
          sound: true, badge: 1,
          data: { screen: 'TrackerReminders', type: 'reminder', reminderId: reminder.id, category: reminder.category, babyId: reminder.babyId },
        },
        trigger,
      });
    } catch { return undefined; }
  };

  const cancelNotification = async (id?: string) => { if (id) await Notifications.cancelScheduledNotificationAsync(id); };

  const toggleReminder = async (id: string) => {
    const r = reminders.find(x => x.id === id);
    if (!r) return;
    const newEnabled = !r.enabled;
    let nid = r.notificationId;
    triggerHaptic(newEnabled ? 'success' : 'light');
    if (newEnabled) {
      nid = await scheduleNotification(r);
      if (nid) showToast('success', 'Reminder On', `Notified at ${r.time}`, r.emoji);
    } else {
      await cancelNotification(r.notificationId);
      showToast('info', 'Reminder Off', `${r.title} paused`);
    }
    const updated = reminders.map(x => x.id === id ? { ...x, enabled: newEnabled, notificationId: nid } : x);
    setReminders(updated);
    await saveReminders(updated);
  };

  const openAddModal = (preset?: Partial<Reminder>) => {
    setFormTitle(preset?.title || '');
    setFormCategory(preset?.category || 'custom');
    setFormRepeat('daily');
    setFormTime(set(new Date(), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }));
    setFormNotes(preset?.notes || '');
    setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormColor(preset?.color || CATEGORY_CONFIG[preset?.category || 'custom'].color);
    setEditingReminder(null);
    setShowAddModal(true);
  };

  const openEditModal = (r: Reminder) => {
    const [h, m] = r.time.split(':').map(Number);
    setFormTitle(r.title);
    setFormCategory(r.category);
    setFormRepeat(r.repeat);
    setFormTime(set(new Date(), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }));
    setFormNotes(r.notes || '');
    setFormDaysOfWeek(r.daysOfWeek || [1, 2, 3, 4, 5]);
    setFormColor(r.color || CATEGORY_CONFIG[r.category].color);
    setEditingReminder(r);
    setShowEditModal(true);
  };

  const validateForm = (): boolean => {
    if (!formTitle.trim()) { showToast('error', 'Title Required', 'Please enter a title'); return false; }
    return true;
  };

  const buildReminder = (id?: string): Reminder => ({
    id: id || `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: formTitle.trim(),
    time: format(formTime, 'HH:mm'),
    emoji: CATEGORY_CONFIG[formCategory].emoji,
    enabled: true,
    repeat: formRepeat,
    category: formCategory,
    babyId: baby?.id,
    babyName: baby?.name,
    notes: formNotes.trim() || undefined,
    createdAt: new Date().toISOString(),
    color: formColor,
    daysOfWeek: formRepeat === 'custom' ? formDaysOfWeek : undefined,
    isAchievementRelated: editingReminder?.isAchievementRelated,
    achievementId: editingReminder?.achievementId,
  });

  const addReminder = async () => {
    if (!validateForm()) return;
    const n = buildReminder();
    n.notificationId = await scheduleNotification(n);
    const updated = [...reminders, n];
    setReminders(updated);
    await saveReminders(updated);
    setShowAddModal(false);
    resetForm();
    showToast('success', 'Reminder Added', `${n.title} at ${n.time}`, n.emoji);
    triggerHaptic('medium');
  };

  const updateReminder = async () => {
    if (!editingReminder || !validateForm()) return;
    await cancelNotification(editingReminder.notificationId);
    const u = buildReminder(editingReminder.id);
    u.notificationId = await scheduleNotification(u);
    const updated = reminders.map(r => r.id === editingReminder.id ? u : r);
    setReminders(updated);
    await saveReminders(updated);
    setShowEditModal(false);
    setEditingReminder(null);
    resetForm();
    showToast('success', 'Updated', u.title, u.emoji);
  };

  const deleteReminder = async (id: string) => {
    const r = reminders.find(x => x.id === id);
    if (!r) return;
    sweetAlert.confirm('Delete Reminder', 'Are you sure?', async () => {
      await cancelNotification(r.notificationId);
      const updated = reminders.filter(x => x.id !== id);
      setReminders(updated);
      await saveReminders(updated);
      showToast('success', 'Deleted', r.title);
    }, () => {}, 'Delete', 'Cancel', true);
  };

  const resetForm = () => {
    setFormTitle(''); setFormCategory('custom'); setFormRepeat('daily');
    setFormTime(new Date()); setFormNotes(''); setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormColor(CATEGORY_CONFIG.custom.color);
  };

  const dismissSuggestion = async (id: string) => {
    const ns = new Set(dismissedSuggestions); ns.add(id);
    setDismissedSuggestions(ns);
    await saveDismissedSuggestions(ns);
    setSmartSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const applySmartSuggestion = async (s: SmartSuggestion) => {
    const n: Reminder = {
      id: `smart_${Date.now()}`, title: s.title, time: s.optimalTime, emoji: s.emoji,
      enabled: true, repeat: 'daily', category: s.type, babyId: baby?.id, babyName: baby?.name,
      smartSuggestion: true, notes: s.reason, createdAt: new Date().toISOString(),
      color: CATEGORY_CONFIG[s.type].color,
    };
    n.notificationId = await scheduleNotification(n);
    const updated = [...reminders, n];
    setReminders(updated);
    await saveReminders(updated);
    dismissSuggestion(s.id);
    showToast('success', 'Added', `AI: ${s.title}`, s.emoji);
    triggerHaptic('success');
  };

  const quickLog = (type: CategoryType) => navigation.navigate('Timeline', { type, babyId: baby?.id });

  const filteredReminders = useMemo(() => {
    let list = [...reminders];
    if (activeCategory !== 'all') list = list.filter(r => r.category === activeCategory);
    if (viewMode === 'today') {
      list = list.filter(r => r.enabled).sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
    } else if (viewMode === 'upcoming') {
      const now = new Date(); const c = now.getHours() * 60 + now.getMinutes();
      list = list.filter(r => r.enabled).sort((a, b) => {
        const aMin = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
        const bMin = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]);
        return ((aMin >= c ? aMin - c : aMin + 1440 - c) - (bMin >= c ? bMin - c : bMin + 1440 - c));
      });
    }
    return list;
  }, [reminders, activeCategory, viewMode]);

  const getNext = (): Reminder | null => {
    const e = reminders.filter(r => r.enabled);
    if (!e.length) return null;
    const c = new Date().getHours() * 60 + new Date().getMinutes();
    return e.find(r => { const [h, m] = r.time.split(':').map(Number); return h * 60 + m > c; }) || e[0];
  };
  const nextReminder = getNext();

  const showToast = (type: AlertState['type'], title: string, message: string, emoji?: string) =>
    setAlert({ visible: true, type, title, message, emoji });

  const openTimePicker = useCallback(() => {
    datePicker.open({ value: formTime instanceof Date ? formTime : new Date(), mode: 'time' }, (p) => { if (p) setFormTime(p); });
  }, [datePicker, formTime]);

  const handleShare = async () => {
    try {
      const c = reminders.filter(r => r.enabled).length;
      await Share.share({ message: `⏰ ${baby?.name || 'Baby'} has ${c} active reminders on LittleLoom!`, title: 'LittleLoom Reminders' });
      showToast('success', 'Shared!', 'Reminders shared');
    } catch { showToast('error', 'Share Failed', 'Try again'); }
  };

  const viewTabs = [
    { key: 'today' as ViewMode, label: 'Today', icon: 'sunny-outline' as const },
    { key: 'upcoming' as ViewMode, label: 'Upcoming', icon: 'time-outline' as const },
    { key: 'all' as ViewMode, label: 'All', icon: 'list-outline' as const },
    { key: 'smart' as ViewMode, label: 'Smart', icon: 'sparkles-outline' as const, badge: smartSuggestions.length },
    { key: 'analytics' as ViewMode, label: 'Stats', icon: 'bar-chart-outline' as const },
  ];

  const activeCount = reminders.filter(r => r.enabled).length;

  /* Baby Required only */
  if (!baby && !isInitialLoad) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={styles.noBabyGradient}>
            <Ionicons name="add-circle" size={56} color={DS.white} />
            <Text style={styles.noBabyTitle}>Baby Profile Needed</Text>
            <Text style={styles.noBabySub}>Create a profile to manage reminders</Text>
            <TouchableOpacity style={styles.noBabyBtn} onPress={() => navigation.navigate('CreateBabyProfile')}>
              <Text style={[styles.noBabyBtnText, { color: DS.primary }]}>Create Baby Profile</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowBabyRequiredModal(false)}>
            <View style={[styles.babyReqCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqIcon}>
                <Ionicons name="people-outline" size={28} color={DS.white} />
              </LinearGradient>
              <Text style={[styles.babyReqTitle, { color: isDark ? DS.white : DS.gray900 }]}>Baby Profile Needed</Text>
              <Text style={[styles.babyReqDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Create a profile to start tracking.</Text>
              <PressableScale onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }} activeScale={0.97} style={{ width: '100%' }}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqBtn}>
                  <Text style={styles.babyReqBtnText}>Create Baby Profile</Text>
                  <Ionicons name="arrow-forward" size={16} color={DS.white} />
                </LinearGradient>
              </PressableScale>
              <TouchableOpacity onPress={() => setShowBabyRequiredModal(false)} style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  /* Main */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>REMINDERS</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{baby?.name || 'Baby'}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="share-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulse Header */}
        <RemindersPulse
          isDark={isDark} baby={baby} activeCount={activeCount} totalCount={reminders.length}
          streak={streakData.current} atRisk={streakData.atRisk} nextReminder={nextReminder}
          onBabyPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}
          onShare={handleShare}
        />

        {/* Streak at risk ribbon */}
        {streakData.atRisk && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <AuraRibbon isDark={isDark} icon="flame-outline" color={DS.danger} label="Streak at Risk" text="Log activity today to keep your streak alive" onPress={() => quickLog('potty')} />
          </View>
        )}

        {/* Stats Ring */}
        {reminders.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <StatsRing total={reminders.length} active={activeCount} isDark={isDark} />
          </View>
        )}

        {/* Category Breakdown */}
        {reminders.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <CategoryBreakdown reminders={reminders} isDark={isDark} />
          </View>
        )}

        {/* Insights */}
        {dailyInsights.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <Insights insights={dailyInsights} isDark={isDark} onAction={(i) => { if (i.actionScreen) navigation.navigate(i.actionScreen as any); }} />
          </View>
        )}

        {/* Timeline */}
        {reminders.filter(r => r.enabled).length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <Timeline reminders={reminders} onPress={openEditModal} isDark={isDark} />
          </View>
        )}

        {/* View Tabs */}
        <View style={{ marginTop: DS.space.md }}>
          <ViewTabs
            tabs={viewTabs} activeTab={viewMode}
            onChange={(t) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setViewMode(t); triggerHaptic('light'); }}
            isDark={isDark}
          />
        </View>

        {/* Category filter */}
        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && reminders.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <CategoryFilter reminders={reminders} selected={activeCategory} onChange={(c) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveCategory(c); triggerHaptic('light'); }} isDark={isDark} />
          </View>
        )}

        {/* Smart View */}
        {viewMode === 'smart' && (
          <View style={{ marginTop: DS.space.md, paddingHorizontal: DS.space.lg, gap: 10 }}>
            <SectionHeader title="Smart Suggestions" subtitle={`${smartSuggestions.length} AI recommendations`} icon="sparkles-outline" color={DS.warning} isDark={isDark} />
            {smartSuggestions.length > 0 ? smartSuggestions.map((s, i) => (
              <SmartCard key={s.id} suggestion={s} onApply={applySmartSuggestion} onDismiss={dismissSuggestion} isDark={isDark} index={i} />
            )) : (
              <View style={styles.emptyCard}>
                <Ionicons name="sparkles-outline" size={44} color={isDark ? DS.gray500 : DS.gray400} />
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No smart suggestions</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Keep tracking — AI will suggest optimal reminders</Text>
              </View>
            )}
          </View>
        )}

        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <View style={{ marginTop: DS.space.md, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="Analytics" subtitle="Reminder performance" icon="bar-chart-outline" color={DS.info} isDark={isDark} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: DS.space.sm }}>
              {[
                { label: 'Active', value: activeCount, icon: 'checkmark-done', color: DS.success },
                { label: 'Paused', value: reminders.length - activeCount, icon: 'pause', color: DS.gray400 },
                { label: 'Categories', value: Object.keys(CATEGORY_CONFIG).filter(c => reminders.some(r => r.category === c)).length, icon: 'grid', color: DS.primary },
                { label: 'AI Added', value: reminders.filter(r => r.smartSuggestion).length, icon: 'sparkles', color: DS.warning },
              ].map(s => (
                <View key={s.label} style={[styles.analyticsCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <View style={[styles.analyticsIcon, { backgroundColor: `${s.color}18` }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.analyticsVal, { color: isDark ? DS.white : DS.gray900 }]}>{s.value}</Text>
                  <Text style={[styles.analyticsLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.chartCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, marginTop: DS.space.md }]}>
              <Text style={[styles.chartTitle, { color: isDark ? DS.white : DS.gray900 }]}>Weekly Activity</Text>
              <Text style={[styles.chartSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Completed per day</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 100, marginTop: 12 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
                  const count = analytics?.weekly?.[d] || 0;
                  const max = Math.max(...Object.values(analytics?.weekly || { M: 1 }), 1);
                  const h = Math.max((count as number / max as number) * 80, 4);
                  return (
                    <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 20, height: h, borderRadius: 4, backgroundColor: DS.primary }} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>{d}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Reminder List */}
        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && (
          <View style={{ marginTop: DS.space.md, paddingHorizontal: DS.space.lg }}>
            <SectionHeader
              title={viewMode === 'today' ? "Today's Schedule" : viewMode === 'upcoming' ? 'Upcoming' : 'All Reminders'}
              subtitle={`${filteredReminders.length} reminder${filteredReminders.length !== 1 ? 's' : ''}`}
              icon="list-outline" color={DS.primary} isDark={isDark}
            />
            <View style={{ gap: 8 }}>
              {filteredReminders.map((item, i) => (
                <ReminderItem
                  key={item.id} item={item} index={i}
                  isNext={nextReminder?.id === item.id}
                  onToggle={toggleReminder} onPress={openEditModal} onLongPress={deleteReminder}
                  isDark={isDark}
                />
              ))}
            </View>
            {filteredReminders.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="notifications-off-outline" size={44} color={isDark ? DS.gray500 : DS.gray400} />
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No reminders yet</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Tap + to add your first reminder</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* FAB */}
      <Animated.View entering={FadeIn.delay(400)} style={[styles.fabWrap, { bottom: insets.bottom + 20 }]}>
        <PressableScale onPress={() => openAddModal()} activeScale={0.92}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={styles.fabGrad}>
            <Ionicons name="add" size={28} color={DS.white} />
          </LinearGradient>
        </PressableScale>
      </Animated.View>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }} activeOpacity={1}>
            <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{showEditModal ? 'Edit Reminder' : 'New Reminder'}</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>What to remind?</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={formTitle} onChangeText={setFormTitle}
                placeholder="e.g., Give Vitamin D"
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                maxLength={50}
              />
              <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map(cat => (
                  <TouchableOpacity key={cat} onPress={() => { setFormCategory(cat); setFormColor(CATEGORY_CONFIG[cat].color); triggerHaptic('light'); }}
                    style={[styles.catChip, { backgroundColor: formCategory === cat ? `${CATEGORY_CONFIG[cat].color}20` : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, borderColor: formCategory === cat ? CATEGORY_CONFIG[cat].color : 'transparent', borderWidth: 2 }]}>
                    <Text style={{ fontSize: 16 }}>{CATEGORY_CONFIG[cat].emoji}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: formCategory === cat ? CATEGORY_CONFIG[cat].color : isDark ? DS.gray300 : DS.gray700 }}>{CATEGORY_CONFIG[cat].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Time</Text>
              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={openTimePicker} style={[styles.timeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Ionicons name="time-outline" size={20} color={DS.primary} />
                  <Text style={[styles.timeBtnText, { color: isDark ? DS.white : DS.gray900 }]}>{format(formTime, 'h:mm a')}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[{ l: 'AM', t: '08:00' }, { l: 'Noon', t: '12:00' }, { l: 'PM', t: '18:00' }, { l: 'Night', t: '21:00' }].map(q => (
                    <TouchableOpacity key={q.l} onPress={() => { const [h, m] = q.t.split(':').map(Number); setFormTime(set(new Date(), { hours: h, minutes: m })); triggerHaptic('light'); }}
                      style={[styles.quickTime, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? DS.gray400 : DS.gray500 }}>{q.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {Platform.OS === 'ios' && datePicker.iosPicker.visible && (
                <Modal transparent animationType="slide" visible={datePicker.iosPicker.visible} statusBarTranslucent onRequestClose={datePicker.dismissIos}>
                  <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={datePicker.dismissIos}>
                    <View style={{ backgroundColor: isDark ? DS.darkCard : DS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 }}>
                      <View style={{ alignItems: 'flex-end', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }}>
                        <TouchableOpacity onPress={datePicker.dismissIos}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: DS.primary }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      {(() => {
                        try {
                          const Picker = require('@react-native-community/datetimepicker').default;
                          return <Picker value={datePicker.iosPicker.value} mode="time" display="spinner" onValueChange={datePicker.handleIosChange} textColor={isDark ? DS.white : DS.gray900} />;
                        } catch { return null; }
                      })()}
                    </View>
                  </Pressable>
                </Modal>
              )}

              <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 16 }]}>Repeat</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map(o => (
                  <TouchableOpacity key={o} onPress={() => { setFormRepeat(o); triggerHaptic('light'); }}
                    style={[styles.repeatChip, { backgroundColor: formRepeat === o ? DS.primary : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                    <Text style={{ fontSize: 12, fontWeight: formRepeat === o ? '700' : '600', color: formRepeat === o ? DS.white : isDark ? DS.gray300 : DS.gray700 }}>{REPEAT_LABELS[o]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formRepeat === 'custom' && (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 16 }]}>Days</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {WEEKDAYS.map(d => (
                      <TouchableOpacity key={d.id}
                        onPress={() => { setFormDaysOfWeek(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id].sort()); triggerHaptic('light'); }}
                        style={[styles.dayChip, { backgroundColor: formDaysOfWeek.includes(d.id) ? DS.primary : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: formDaysOfWeek.includes(d.id) ? DS.white : isDark ? DS.gray300 : DS.gray700 }}>{d.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 16 }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={formNotes} onChangeText={setFormNotes}
                placeholder="Add details..." placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                multiline numberOfLines={3} textAlignVertical="top"
              />

              <PressableScale onPress={showEditModal ? updateReminder : addReminder} activeScale={0.97} style={{ marginTop: 20 }}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.saveBtn}>
                  <Ionicons name={showEditModal ? 'checkmark' : 'add'} size={20} color={DS.white} />
                  <Text style={styles.saveBtnText}>{showEditModal ? 'Update' : 'Create Reminder'}</Text>
                </LinearGradient>
              </PressableScale>

              {showEditModal && editingReminder && (
                <TouchableOpacity onPress={() => { setShowEditModal(false); deleteReminder(editingReminder.id); }}
                  style={[styles.deleteBtn, { backgroundColor: `${DS.danger}10` }]}>
                  <Ionicons name="trash-outline" size={16} color={DS.danger} />
                  <Text style={[styles.deleteBtnText, { color: DS.danger }]}>Delete Reminder</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Toast */}
      {alert.visible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', paddingTop: 100 }]} pointerEvents="none">
          <Animated.View entering={FadeInUp.springify()} style={[styles.toast, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient colors={alert.type === 'success' ? [DS.success, DS.success] : alert.type === 'error' ? [DS.danger, DS.danger] : [DS.primary, DS.accent]} style={styles.toastIcon}>
              {alert.emoji ? <Text style={{ fontSize: 22 }}>{alert.emoji}</Text> : <Ionicons name={alert.type === 'success' ? 'checkmark-circle' : alert.type === 'error' ? 'alert-circle' : 'information-circle'} size={22} color={DS.white} />}
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: isDark ? DS.white : DS.gray900 }]}>{alert.title}</Text>
              <Text style={[styles.toastMsg, { color: isDark ? DS.gray400 : DS.gray500 }]}>{alert.message}</Text>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: { marginHorizontal: DS.space.lg, marginTop: DS.space.md, borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseAgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500' },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.lg, marginTop: DS.space.md },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.md, marginTop: DS.space.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  /* Aura card */
  auraCard: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },

  /* Ring */
  ringInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 28, fontWeight: '800' },
  ringLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  ringDot: { width: 8, height: 8, borderRadius: 4 },
  ringMetaText: { fontSize: 11, fontWeight: '500' },

  /* Cat card */
  catCard: { width: 92, padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', overflow: 'hidden' },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catCount: { fontSize: 20, fontWeight: '800' },
  catLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },

  /* Timeline */
  tlNode: { width: 88, padding: 10, borderRadius: DS.radius.md, alignItems: 'center', gap: 4 },
  tlDot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tlTime: { fontSize: 12, fontWeight: '800' },
  tlLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', width: '100%' },
  tlNextBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  tlNextText: { color: DS.white, fontSize: 8, fontWeight: '800' },

  /* Insights */
  insightCard: { width: 220, padding: DS.space.md, borderRadius: DS.radius.lg, borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden', gap: 4 },
  insightTitle: { fontSize: 12, fontWeight: '700' },
  insightDesc: { fontSize: 10, fontWeight: '500', lineHeight: 14 },
  insightAction: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  insightActionText: { fontSize: 10, fontWeight: '700' },

  /* Tabs */
  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: DS.radius.full, position: 'relative' },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  tabBadge: { position: 'absolute', top: 2, right: 2, minWidth: 12, height: 12, borderRadius: 6, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },

  /* Filter */
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  filterBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Reminder card */
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, overflow: 'hidden' },
  remIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  remTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  remTime: { fontSize: 12, fontWeight: '800' },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  catBadgeText: { fontSize: 9, fontWeight: '700' },
  metaText: { fontSize: 10, fontWeight: '500' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  aiBadgeText: { fontSize: 9, fontWeight: '800' },
  nextBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  nextBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },
  remNotes: { fontSize: 10, fontStyle: 'italic', marginTop: 3 },

  /* Smart */
  smartCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  smartIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smartTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  smartDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 4 },
  smartTime: { fontSize: 10, fontWeight: '600' },
  confBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  confText: { fontSize: 9, fontWeight: '800' },
  priBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  priText: { fontSize: 8, fontWeight: '800' },
  smartApply: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  smartApplyText: { color: DS.white, fontSize: 12, fontWeight: '700' },

  /* Analytics */
  analyticsCard: { width: (width - 40 - 10) / 2, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center' },
  analyticsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  analyticsVal: { fontSize: 20, fontWeight: '800' },
  analyticsLbl: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  chartCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1 },
  chartTitle: { fontSize: 14, fontWeight: '800' },
  chartSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Empty */
  emptyCard: { alignItems: 'center', paddingVertical: DS.space['3xl'], marginTop: DS.space.md, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },

  /* FAB */
  fabWrap: { position: 'absolute', right: 20, zIndex: 100 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...DS.shadow.lg },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: DS.space.lg, ...DS.shadow.lg },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  inputLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  notesInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontWeight: '500', minHeight: 80 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  timeBtnText: { fontSize: 16, fontWeight: '800' },
  quickTime: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  repeatChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  dayChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  deleteBtnText: { fontSize: 13, fontWeight: '700' },

  /* Toast */
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginHorizontal: 20, ...DS.shadow.lg, minWidth: 280 },
  toastIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontSize: 14, fontWeight: '700' },
  toastMsg: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  /* Baby required */
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyTitle: { fontSize: 22, fontWeight: '800', color: DS.white, marginTop: 12 },
  noBabySub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' },
  noBabyBtn: { backgroundColor: DS.white, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 16 },
  noBabyBtnText: { fontSize: 14, fontWeight: '700' },
  babyReqCard: { width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'], padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg },
  babyReqIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  babyReqTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  babyReqDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: DS.space.lg, paddingHorizontal: 6 },
  babyReqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, width: '100%' },
  babyReqBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});