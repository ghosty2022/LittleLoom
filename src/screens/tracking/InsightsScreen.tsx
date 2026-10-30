import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { useCustomization } from '../../hooks/useCustomization';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';

import { useTracker } from '../../hooks/useTrackerContext';
import { useGrowthIntelligence } from '../../hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '../../hooks/useTimelineCorrelations';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { useWHOGrowthCalculator } from '../../hooks/useWHOGrowthCalculator';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  format,
  formatDistanceToNow,
  isSameDay,
  subDays,
  differenceInDays,
  differenceInMonths,
  parseISO,
  isValid,
} from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useSweetAlert } from '../../components/SweetAlert';
import type { DiscoveredCorrelation } from '../../services/ai/CorrelationEngine';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
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

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type InsightsScreenProps = NativeStackScreenProps<RootStackParamList, 'Insights'>;

interface InsightItem {
  id: string;
  type: 'milestone' | 'growth' | 'health' | 'sleep' | 'nutrition' | 'correlation' | 'achievement' | 'vaccination' | 'prediction' | 'pattern' | 'tip';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: keyof RootStackParamList; params?: any };
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PatternData {
  day: string;
  feeds: number;
  sleep: number;
  diapers: number;
  total: number;
}

interface WeeklyStats {
  totalActivities: number;
  avgDaily: number;
  mostActiveDay: string;
  streakDays: number;
  topCategory: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
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
const PressableScale = React.memo<{
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
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionActionText, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Insights Pulse — compact animated header (no top bar)
   ═══════════════════════════════════════════════════════════════════════════ */

const InsightsPulse = React.memo<{
  isDark: boolean;
  baby: any;
  ageMonths: number;
  stats: {
    total: number;
    urgent: number;
    streak: number;
    topCategory: string;
  };
  onBabyPress: () => void;
  onGrowthPress: () => void;
  onRefresh: () => void;
}>(({ isDark, baby, ageMonths, stats, onBabyPress, onGrowthPress, onRefresh }) => {
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

  const hasAttention = stats.urgent > 0;
  const statusColor = hasAttention ? DS.danger : stats.total > 0 ? DS.success : DS.primary;
  const statusLabel = !baby
    ? 'Add baby profile to start'
    : hasAttention
    ? `${stats.urgent} urgent item${stats.urgent === 1 ? '' : 's'} need attention`
    : stats.total > 0
    ? `${stats.total} insight${stats.total === 1 ? '' : 's'} · all caught up`
    : 'No insights yet — start tracking';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
                <Ionicons name="sparkles" size={22} color={DS.primary} />
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby?.name ? `${baby.name}'s Insights` : 'Insights'}
              </Text>
              {baby && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{ageMonths}mo</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onGrowthPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="trending-up-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onRefresh} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="refresh-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.total}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>insights</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: stats.urgent > 0 ? DS.danger : DS.gray400 }]}>{stats.urgent}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>urgent</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.streak}d</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>streak</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success, fontSize: 14 }]} numberOfLines={1}>{stats.topCategory}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>top</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

const AuraRibbon = React.memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
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
   Weekly Pattern Chart
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyPatternChart = React.memo(({ patterns, isDark }: { patterns: PatternData[]; isDark: boolean }) => {
  const maxTotal = Math.max(...patterns.map(d => d.total), 1);

  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.md }}>
          <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="pulse" size={14} color={DS.primary} />
          </View>
          <Text style={[styles.chartTitle, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}>Weekly Pattern</Text>
          <Text style={[styles.chartSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {patterns.reduce((s, d) => s + d.total, 0)} total
          </Text>
        </View>
        <View style={styles.patternBars}>
          {patterns.map((day, i) => {
            const barHeight = (day.total / maxTotal) * 100;
            const isToday = i === 6;
            return (
              <View key={day.day} style={styles.patternDay}>
                <Text style={[styles.patternCount, {
                  color: isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400,
                }]}>
                  {day.total || ''}
                </Text>
                <View style={[styles.patternBarContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100 }]}>
                  <View style={[styles.patternBar, {
                    height: `${Math.max(barHeight, 8)}%`,
                    backgroundColor: isToday ? DS.primary : `${DS.primary}50`,
                  }]} />
                </View>
                <Text style={[styles.patternDayLabel, {
                  color: isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400,
                  fontWeight: isToday ? '800' : '600',
                }]}>
                  {day.day}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Category Pills
   ═══════════════════════════════════════════════════════════════════════════ */

const CategoryPills = React.memo(({
  categories, activeCategory, onChange, isDark, counts,
}: {
  categories: { key: string; label: string; icon: string; color: string }[];
  activeCategory: string;
  onChange: (cat: string) => void;
  isDark: boolean;
  counts: Record<string, number>;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}
  >
    {categories.map((cat) => {
      const isActive = activeCategory === cat.key;
      const count = counts[cat.key] || 0;
      return (
        <TouchableOpacity
          key={cat.key}
          onPress={() => onChange(cat.key)}
          activeOpacity={0.85}
          style={[
            styles.catPill,
            {
              backgroundColor: isActive ? cat.color : isDark ? DS.darkCard : DS.white,
              borderColor: isActive ? cat.color : isDark ? DS.darkBorder : DS.gray200,
            },
          ]}
        >
          <Ionicons name={cat.icon as any} size={13} color={isActive ? DS.white : cat.color} />
          <Text style={[
            styles.catPillText,
            { color: isActive ? DS.white : isDark ? DS.gray300 : DS.gray700 },
            isActive && { fontWeight: '700' },
          ]}>
            {cat.label}
          </Text>
          {count > 0 && (
            <View style={[
              styles.catPillBadge,
              { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${cat.color}15` },
            ]}>
              <Text style={[
                styles.catPillBadgeText,
                { color: isActive ? DS.white : cat.color },
              ]}>
                {count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Insight Card — ribbon-style row
   ═══════════════════════════════════════════════════════════════════════════ */

const InsightCard = React.memo(({
  insight, onPress, onDismiss, index, isDark,
}: {
  insight: InsightItem;
  onPress: () => void;
  onDismiss: () => void;
  index: number;
  isDark: boolean;
}) => (
  <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[
        styles.insightCard,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: insight.priority === 'high' ? `${insight.color}40` : isDark ? DS.darkBorder : DS.gray200,
          borderLeftColor: insight.color,
          borderLeftWidth: 3,
        },
      ]}>
        <LinearGradient
          colors={[`${insight.color}08`, `${insight.color}02`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md }}>
          <View style={[styles.insightIcon, { backgroundColor: `${insight.color}15` }]}>
            <Text style={{ fontSize: 20 }}>{insight.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[styles.insightTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {insight.title}
              </Text>
              {insight.priority === 'high' && (
                <View style={[styles.priorityBadge, { backgroundColor: `${DS.danger}15` }]}>
                  <Text style={[styles.priorityBadgeText, { color: DS.danger }]}>URGENT</Text>
                </View>
              )}
            </View>
            <Text style={[styles.insightDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
              {insight.description}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={[styles.insightTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                {formatDistanceToNow(insight.timestamp, { addSuffix: true })}
              </Text>
              {insight.action && (
                <View style={[styles.insightActionBadge, { backgroundColor: `${insight.color}12` }]}>
                  <Text style={[styles.insightActionText, { color: insight.color }]}>
                    {insight.action.label} →
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ padding: 2 }}
          >
            <Ionicons name="close-outline" size={16} color={isDark ? DS.gray500 : DS.gray400} />
          </TouchableOpacity>
        </View>
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Growth Intelligence Summary
   ═══════════════════════════════════════════════════════════════════════════ */

const GrowthIntelligenceCard = React.memo(({
  growthIndex, isDark, onPress,
}: {
  growthIndex: any;
  isDark: boolean;
  onPress: () => void;
}) => {
  if (!growthIndex) return null;

  const scores = [
    { label: 'Nutrition', value: growthIndex.nutritionScore?.value, color: '#FF9F43', emoji: '🍎' },
    { label: 'Rest', value: growthIndex.restScore?.value, color: '#5F27CD', emoji: '😴' },
    { label: 'Physical', value: growthIndex.physicalScore?.value, color: '#10AC84', emoji: '💪' },
    { label: 'Cognitive', value: growthIndex.cognitiveScore?.value, color: '#FFD700', emoji: '🧠' },
  ];
  const composite = growthIndex.compositeIndex || 0;
  const compositeColor = composite >= 80 ? DS.success : composite >= 60 ? DS.primary : composite >= 40 ? DS.warning : DS.danger;

  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="sparkles" size={14} color={DS.primary} />
              </View>
              <View>
                <Text style={[styles.giTitle, { color: isDark ? DS.white : DS.gray900 }]}>Growth Intelligence</Text>
                <Text style={[styles.giSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Composite score</Text>
              </View>
            </View>
            <View style={[styles.giComposite, { backgroundColor: `${compositeColor}18` }]}>
              <Text style={[styles.giCompositeValue, { color: compositeColor }]}>{composite}</Text>
              <Text style={[styles.giCompositeMax, { color: compositeColor }]}>/100</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {scores.map(s => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 14, width: 22 }}>{s.emoji}</Text>
                <Text style={[styles.giScoreLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{s.label}</Text>
                <View style={[styles.giScoreBarBg, { backgroundColor: `${s.color}12` }]}>
                  <View style={[styles.giScoreBarFill, { width: `${Math.min(s.value || 0, 100)}%`, backgroundColor: s.color }]} />
                </View>
                <Text style={[styles.giScoreValue, { color: s.color }]}>{s.value ?? '—'}</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN INSIGHTS SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function InsightsScreen({ navigation, route }: InsightsScreenProps) {
  const insets = useSafeAreaInsets();
  const focusCategory: string | undefined = (route.params as any)?.focusCategory;
  const { triggerHaptic, themeColors, darkMode } = useCustomization();

  const { userProfile } = useAuth();
  const { currentBaby, growthData, milestones, babies, getGrowthData, loadBabies } = useBaby();

  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();

  const [aiCorrelations, setAiCorrelations] = useState<DiscoveredCorrelation[]>([]);
  useEffect(() => {
    if (!currentBaby?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { discoverCorrelations, getCachedCorrelations } = require('../services/ai/CorrelationEngine');
        const cached = await getCachedCorrelations(currentBaby.id);
        if (!cancelled && Array.isArray(cached) && cached.length > 0) {
          setAiCorrelations(cached);
        }
        const fresh = await discoverCorrelations(currentBaby.id, 45);
        if (!cancelled && Array.isArray(fresh)) setAiCorrelations(fresh);
      } catch (e) {
        if (__DEV__) console.warn('[Insights] correlation discovery failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentBaby?.id]);

  const { achievements, newlyUnlocked, streak: globalStreak } = useTrackerAchievements();
  const { getInsights: getEngineInsights, getEntries: getTrackerEntries, refreshEntries, entries: trackerEntries } = useTracker();
  const { getPercentile, getStatus } = useWHOGrowthCalculator();
  const sweetAlert = useSweetAlert();

  const isDark = darkMode ?? false;
  const primary = themeColors?.primary || DS.primary;

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  /* ── Load dismissed insights ── */
  useEffect(() => {
    AsyncStorage.getItem('@littleloom_dismissed_insights').then(saved => {
      if (saved) {
        try { setDismissedIds(new Set(JSON.parse(saved))); } catch { /* ignore */ }
      }
    });
  }, []);

  /* ── Baby required modal ── */
  useEffect(() => {
    if (!currentBaby) {
      const timer = setTimeout(() => setShowBabyRequiredModal(true), 400);
      return () => clearTimeout(timer);
    } else {
      setShowBabyRequiredModal(false);
    }
  }, [currentBaby]);

  /* ── Focus category from route ── */
  useEffect(() => {
    if (focusCategory) setActiveCategory(focusCategory);
  }, [focusCategory]);

  const saveDismissed = useCallback((ids: Set<string>) => {
    AsyncStorage.setItem('@littleloom_dismissed_insights', JSON.stringify([...ids])).catch(() => {});
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
    triggerHaptic('light');
  }, [saveDismissed, triggerHaptic]);

  /* ── Generate all insights ── */
  const allInsights = useMemo((): InsightItem[] => {
    if (!currentBaby) return [];
    const items: InsightItem[] = [];
    const now = Date.now();
    const ageMonths = currentBaby.birthDate ? safeDiffMonths(new Date(), currentBaby.birthDate) : 0;

    /* Growth Intelligence */
    if (growthIndex) {
      if (growthIndex.nutritionScore?.value < 50) {
        items.push({
          id: 'gi-nutrition',
          type: 'nutrition',
          title: 'Nutrition Needs Attention',
          description: `Nutrition score is ${growthIndex.nutritionScore.value}/100. Consider reviewing feeding patterns and ensuring consistent meal times.`,
          emoji: '🍎',
          color: '#FF9F43',
          priority: 'high',
          action: { label: 'Track Feed', screen: 'UniversalTrackerHub', params: { type: 'feed' } },
          timestamp: now,
        });
      }
      if (growthIndex.restScore?.value < 50) {
        items.push({
          id: 'gi-sleep',
          type: 'sleep',
          title: 'Sleep Quality Low',
          description: `Rest score is ${growthIndex.restScore.value}/100. Check sleep schedule consistency and bedtime routine.`,
          emoji: '😴',
          color: '#5F27CD',
          priority: 'medium',
          action: { label: 'Track Sleep', screen: 'UniversalTrackerHub', params: { type: 'sleep' } },
          timestamp: now,
        });
      }
      if (growthIndex.milestoneReadiness?.length > 0) {
        const top = growthIndex.milestoneReadiness[0];
        items.push({
          id: 'gi-milestone',
          type: 'milestone',
          title: `${top.category} Milestone Ready!`,
          description: `${top.readinessPercent}% readiness for ${top.category} milestones. Watch for signs and encourage practice.`,
          emoji: '🎯',
          color: '#10AC84',
          priority: 'medium',
          action: { label: 'Log Milestone', screen: 'Achievements', params: {} },
          timestamp: now,
        });
      }
      if (growthIndex.physicalScore?.value > 80) {
        items.push({
          id: 'gi-physical-great',
          type: 'health',
          title: 'Physical Development Excelling',
          description: `Physical score is ${growthIndex.physicalScore.value}/100. ${currentBaby.name} is showing great motor skills!`,
          emoji: '💪',
          color: '#10b981',
          priority: 'low',
          timestamp: now,
        });
      }
    }

    /* Timeline correlations */
    timelineCorrelations.slice(0, 3).forEach((c, i) => {
      items.push({
        id: `corr-${c.id || `idx-${i}`}`,
        type: 'correlation',
        title: 'Pattern Discovered',
        description: c.insight || 'New pattern found in your tracking data.',
        emoji: '🔗',
        color: '#54A0FF',
        priority: 'low',
        timestamp: now - i * 3600000,
      });
    });

    /* AI correlations */
    aiCorrelations.slice(0, 5).forEach((c, i) => {
      items.push({
        id: `ai-corr-${c.id}`,
        type: 'correlation',
        title: c.headline,
        description: c.description,
        emoji: c.emoji || '🔍',
        color: c.direction === 'positive' ? '#10b981' : '#f59e0b',
        priority: c.effectSize > 0.6 ? 'medium' : 'low',
        action: c.suggestion
          ? { label: c.suggestion.substring(0, 30) + '…', screen: 'Timeline' }
          : undefined,
        timestamp: now - (i + 10) * 3600000,
      });
    });

    /* Recent milestone */
    const recentMilestone = [...milestones].sort((a, b) => {
      const da = safeParseDate(a.achievedAt);
      const db = safeParseDate(b.achievedAt);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })[0];
    if (recentMilestone && safeParseDate(recentMilestone.achievedAt) && safeDiffDays(new Date(), recentMilestone.achievedAt) < 7) {
      items.push({
        id: 'recent-milestone',
        type: 'milestone',
        title: 'New Milestone Achieved! 🌟',
        description: `${currentBaby.name} achieved "${recentMilestone.title}". Celebrate this win!`,
        emoji: '🏆',
        color: '#f59e0b',
        priority: 'high',
        action: { label: 'View Milestones', screen: 'Achievements', params: {} },
        timestamp: safeParseDate(recentMilestone.achievedAt)?.getTime() || now,
      });
    }

    /* Growth drops */
    const growthTypes = ['height', 'weight', 'head'] as const;
    growthTypes.forEach(type => {
      const typeData = getGrowthData(type);
      if (typeData.length >= 2) {
        const sorted = [...typeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        if (latest.value < prev.value) {
          const drop = ((prev.value - latest.value) / prev.value) * 100;
          if (drop > 5) {
            items.push({
              id: `growth-drop-${type}`,
              type: 'growth',
              title: `${type.charAt(0).toUpperCase() + type.slice(1)} Decrease Detected`,
              description: `Latest ${type} dropped ${drop.toFixed(1)}% from previous measurement. Please verify accuracy.`,
              emoji: '⚠️',
              color: '#ef4444',
              priority: 'high',
              action: { label: 'Re-measure', screen: 'GrowthDashboard', params: {} },
              timestamp: now,
            });
          }
        }
      }
    });

    /* WHO percentiles */
    growthTypes.forEach(type => {
      const data = getGrowthData(type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0];
      if (latest) {
        const ageAt = Math.max(0, safeDiffMonths(latest.date, currentBaby.birthDate));
        const gender = currentBaby.gender === 'girl' ? 'girl' : 'boy';
        const percentile = getPercentile(latest.value, ageAt, type, gender);

        if (percentile < 5) {
          items.push({
            id: `who-low-${type}`,
            type: 'health',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Below 5th Percentile`,
            description: `${currentBaby.name}'s ${type} is at P${percentile}. Consider discussing with your pediatrician.`,
            emoji: '📉',
            color: '#ef4444',
            priority: 'high',
            action: { label: 'View Growth', screen: 'GrowthDashboard', params: {} },
            timestamp: now,
            metadata: { percentile, type },
          });
        } else if (percentile > 95) {
          items.push({
            id: `who-high-${type}`,
            type: 'health',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Above 95th Percentile`,
            description: `${currentBaby.name}'s ${type} is at P${percentile}. This is perfectly healthy but worth monitoring.`,
            emoji: '📈',
            color: '#3b82f6',
            priority: 'medium',
            action: { label: 'View Growth', screen: 'GrowthDashboard', params: {} },
            timestamp: now,
            metadata: { percentile, type },
          });
        }
      }
    });

    /* Streak risk */
    if (globalStreak?.streakAtRisk && globalStreak.currentStreak > 0) {
      items.push({
        id: 'streak-risk',
        type: 'achievement',
        title: '🔥 Streak at Risk!',
        description: `Log an entry in ${globalStreak.hoursUntilBreak}h to keep your ${globalStreak.currentStreak}-day streak alive.`,
        emoji: '⏰',
        color: '#ef4444',
        priority: 'high',
        action: { label: 'Log Now', screen: 'UniversalTrackerHub', params: {} },
        timestamp: now,
      });
    }

    /* New achievements */
    if (Array.isArray(newlyUnlocked) && newlyUnlocked.length > 0) {
      items.push({
        id: 'new-achievement',
        type: 'achievement',
        title: `Achievement Unlocked! 🎉`,
        description: `${newlyUnlocked.length} new achievement${newlyUnlocked.length > 1 ? 's' : ''} earned! Keep up the great tracking.`,
        emoji: '🏆',
        color: '#8b5cf6',
        priority: 'medium',
        action: { label: 'View All', screen: 'Achievements', params: {} },
        timestamp: now,
      });
    }

    /* Age-based tips */
    if (ageMonths < 3) {
      items.push({
        id: 'tip-newborn',
        type: 'tip',
        title: 'Newborn Feeding Tip',
        description: 'Feed every 2-3 hours. Look for hunger cues like rooting, sucking motions, and hand-to-mouth movements.',
        emoji: '🍼',
        color: '#fa709a',
        priority: 'low',
        timestamp: now,
      });
    } else if (ageMonths >= 6 && ageMonths < 9) {
      items.push({
        id: 'tip-solids',
        type: 'tip',
        title: 'Starting Solid Foods',
        description: 'Introduce single-ingredient purees. Wait 3-5 days between new foods to watch for allergies.',
        emoji: '🥄',
        color: '#10b981',
        priority: 'low',
        timestamp: now,
      });
    }

    /* Nap reminder */
    const todaySleep = getTrackerEntries('sleep').filter((e: any) => isSameDay(new Date(e.timestamp), new Date()));
    if (todaySleep.length === 0 && new Date().getHours() > 14) {
      items.push({
        id: 'nap-reminder',
        type: 'sleep',
        title: 'Nap Check',
        description: `No naps logged for ${currentBaby.name} today. Most ${ageMonths}-month-olds need 2-3 naps.`,
        emoji: '😴',
        color: '#6366f1',
        priority: 'medium',
        action: { label: 'Track Sleep', screen: 'UniversalTrackerHub', params: { type: 'sleep' } },
        timestamp: now,
      });
    }

    /* Engine insights */
    getEngineInsights().forEach((i) => {
      items.push({
        id: `engine-${i.id}`,
        type: i.trackerId === 'sleep' ? 'sleep' : i.trackerId === 'feed' ? 'nutrition' : i.trackerId === 'growth' ? 'growth' : 'health',
        title: i.title,
        description: i.description,
        emoji: i.emoji || '💡',
        color: i.priority === 'warning' ? '#ef4444' : i.priority === 'good' ? '#10b981' : '#6366f1',
        priority: i.priority === 'warning' ? 'high' : i.priority === 'good' ? 'low' : 'medium',
        action: i.action?.trackerId
          ? { label: i.action.message || 'Log Now', screen: 'UniversalTrackerHub', params: { type: i.action.trackerId } }
          : undefined,
        timestamp: i.generatedAt || now,
      });
    });

    return items.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      if (prioOrder[a.priority] !== prioOrder[b.priority]) {
        return prioOrder[a.priority] - prioOrder[b.priority];
      }
      return b.timestamp - a.timestamp;
    });
  }, [growthIndex, timelineCorrelations, aiCorrelations, milestones, currentBaby, getGrowthData, globalStreak, newlyUnlocked, trackerEntries, getPercentile, getEngineInsights, getTrackerEntries]);

  /* ── Filtered insights ── */
  const filteredInsights = useMemo(() => {
    let filtered = allInsights.filter(i => !dismissedIds.has(i.id));
    if (activeCategory === 'high') {
      filtered = filtered.filter(i => i.priority === 'high');
    } else if (activeCategory !== 'all') {
      filtered = filtered.filter(i => i.type === activeCategory);
    }
    return filtered;
  }, [allInsights, dismissedIds, activeCategory]);

  /* ── Category counts ── */
  const categoryCounts = useMemo(() => {
    const active = allInsights.filter(i => !dismissedIds.has(i.id));
    const counts: Record<string, number> = { all: active.length, high: 0 };
    active.forEach(i => {
      if (i.priority === 'high') counts.high = (counts.high || 0) + 1;
      counts[i.type] = (counts[i.type] || 0) + 1;
    });
    return counts;
  }, [allInsights, dismissedIds]);

  /* ── Weekly pattern ── */
  const weeklyPattern = useMemo((): PatternData[] => {
    if (!trackerEntries.length) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));

    return last7Days.map(day => {
      const dayActivities = trackerEntries.filter((a: any) => {
        const aDate = new Date(a.timestamp || a.date);
        return isSameDay(aDate, day);
      });
      return {
        day: format(day, 'EEE'),
        feeds: dayActivities.filter((a: any) => a.trackerId === 'feed').length,
        sleep: dayActivities.filter((a: any) => a.trackerId === 'sleep').length,
        diapers: dayActivities.filter((a: any) => a.trackerId === 'diaper' || a.trackerId === 'potty').length,
        total: dayActivities.length,
      };
    });
  }, [trackerEntries]);

  /* ── Weekly stats ── */
  const weeklyStats = useMemo((): WeeklyStats => {
    if (!weeklyPattern.length) {
      return { totalActivities: 0, avgDaily: 0, mostActiveDay: '—', streakDays: 0, topCategory: '—' };
    }
    const total = weeklyPattern.reduce((sum, d) => sum + d.total, 0);
    const avg = Math.round(total / 7);
    const maxDay = weeklyPattern.reduce((max, d) => d.total > max.total ? d : max, weeklyPattern[0]);

    let streak = 0;
    for (let i = weeklyPattern.length - 1; i >= 0; i--) {
      if (weeklyPattern[i].total > 0) streak++;
      else break;
    }

    const catCounts: Record<string, number> = {};
    weeklyPattern.forEach(d => {
      catCounts['feed'] = (catCounts['feed'] || 0) + d.feeds;
      catCounts['sleep'] = (catCounts['sleep'] || 0) + d.sleep;
      catCounts['diaper'] = (catCounts['diaper'] || 0) + d.diapers;
    });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalActivities: total,
      avgDaily: avg,
      mostActiveDay: maxDay?.day || '—',
      streakDays: streak,
      topCategory: topCat ? topCat[0].charAt(0).toUpperCase() + topCat[0].slice(1) : '—',
    };
  }, [weeklyPattern]);

  /* ── Categories ── */
  const categories = useMemo(() => [
    { key: 'all', label: 'All', icon: 'grid-outline', color: primary },
    { key: 'high', label: 'Urgent', icon: 'alert-circle-outline', color: DS.danger },
    { key: 'health', label: 'Health', icon: 'medical-outline', color: DS.success },
    { key: 'growth', label: 'Growth', icon: 'trending-up-outline', color: '#3b82f6' },
    { key: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#6366f1' },
    { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: '#fa709a' },
    { key: 'milestone', label: 'Milestones', icon: 'trophy-outline', color: '#f59e0b' },
    { key: 'achievement', label: 'Wins', icon: 'ribbon-outline', color: '#8b5cf6' },
    { key: 'correlation', label: 'Patterns', icon: 'link-outline', color: '#54A0FF' },
    { key: 'tip', label: 'Tips', icon: 'bulb-outline', color: DS.warning },
  ], [primary]);

  /* ── Handlers ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBabies();
      await refreshEntries();
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [refreshEntries, loadBabies]);

  const handleInsightPress = useCallback((insight: InsightItem) => {
    triggerHaptic('light');
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen as any, insight.action.params);
    }
  }, [navigation, triggerHaptic]);

  const handleCategoryChange = useCallback((cat: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(cat);
    triggerHaptic('light');
  }, [triggerHaptic]);

  /* ── Derived ── */
  const urgentCount = filteredInsights.filter(i => i.priority === 'high').length;
  const ageMonths = currentBaby?.birthDate ? safeDiffMonths(new Date(), currentBaby.birthDate) : 0;

  const pulseStats = {
    total: filteredInsights.length,
    urgent: urgentCount,
    streak: weeklyStats.streakDays,
    topCategory: weeklyStats.topCategory,
  };

  /* ── Ribbon ── */
  const topRibbon = useMemo(() => {
    const urgent = filteredInsights.find(i => i.priority === 'high');
    if (urgent) {
      return {
        icon: 'alert-circle-outline' as const,
        color: urgent.color,
        label: 'Needs attention',
        text: urgent.title,
        onPress: () => handleInsightPress(urgent),
      };
    }
    if (dismissedIds.size > 0 && filteredInsights.length === 0) {
      return {
        icon: 'checkmark-done-outline' as const,
        color: DS.success,
        label: 'All caught up',
        text: `${dismissedIds.size} dismissed · tap to restore`,
        onPress: () => {
          setDismissedIds(new Set());
          saveDismissed(new Set());
          HAPTIC_LIGHT();
        },
      };
    }
    if (filteredInsights.length > 0) {
      return {
        icon: 'sparkles-outline' as const,
        color: DS.primary,
        label: 'Insights ready',
        text: `${filteredInsights.length} personalized recommendation${filteredInsights.length === 1 ? '' : 's'}`,
      };
    }
    return {
      icon: 'bulb-outline' as const,
      color: DS.info,
      label: 'Getting started',
      text: 'Keep tracking to unlock personalized insights',
    };
  }, [filteredInsights, dismissedIds, handleInsightPress, saveDismissed]);

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.stickyHeader,
          {
            paddingTop: HEADER_TOP_PADDING,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
          headerAnim,
        ]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              INSIGHTS
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby ? currentBaby.name : 'Personalized'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('GrowthDashboard' as any)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="trending-up-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
            colors={[primary, DS.accent]}
            progressViewOffset={HEADER_TOTAL_HEIGHT}
          />
        }
      >
        {/* Pulse */}
        <InsightsPulse
          isDark={isDark}
          baby={currentBaby}
          ageMonths={ageMonths}
          stats={pulseStats}
          onBabyPress={() => {
            if (!currentBaby) navigation.navigate('CreateBabyProfile');
            else navigation.navigate('SwitchBaby' as any, { returnTo: 'Insights' });
          }}
          onGrowthPress={() => navigation.navigate('GrowthDashboard' as any)}
          onRefresh={onRefresh}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Weekly pattern */}
        {currentBaby && weeklyPattern.length > 0 && (
          <View style={{ marginTop: DS.space.md, paddingHorizontal: DS.space.lg }}>
            <WeeklyPatternChart patterns={weeklyPattern} isDark={isDark} />
          </View>
        )}

        {/* Categories */}
        {currentBaby && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader
              title="Filter"
              subtitle={`${filteredInsights.length} of ${allInsights.filter(i => !dismissedIds.has(i.id)).length}`}
              icon="funnel-outline"
              color={DS.primary}
            />
            <CategoryPills
              categories={categories}
              activeCategory={activeCategory}
              onChange={handleCategoryChange}
              isDark={isDark}
              counts={categoryCounts}
            />
          </View>
        )}

        {/* Insights list */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader
            title={activeCategory === 'all' ? 'All Insights' : categories.find(c => c.key === activeCategory)?.label || 'Insights'}
            subtitle={`${filteredInsights.length} item${filteredInsights.length === 1 ? '' : 's'}`}
            icon="bulb-outline"
            color={DS.accent}
          />
          <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
            {filteredInsights.length > 0 ? (
              filteredInsights.map((insight, i) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onPress={() => handleInsightPress(insight)}
                  onDismiss={() => handleDismiss(insight.id)}
                  index={i}
                  isDark={isDark}
                />
              ))
            ) : (
              <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: `${primary}12` }]}>
                  <Ionicons name="checkmark-done-outline" size={36} color={primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  {activeCategory === 'all' ? 'All caught up!' : 'No insights in this category'}
                </Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {activeCategory === 'all'
                    ? 'You have no pending insights. Keep tracking for more personalized recommendations.'
                    : 'Try switching to another category.'}
                </Text>
                {dismissedIds.size > 0 && (
                  <PressableScale
                    onPress={() => {
                      setDismissedIds(new Set());
                      saveDismissed(new Set());
                      HAPTIC_LIGHT();
                    }}
                    activeScale={0.96}
                  >
                    <View style={[styles.restoreBtn, { backgroundColor: `${primary}15` }]}>
                      <Ionicons name="refresh-outline" size={14} color={primary} />
                      <Text style={[styles.restoreBtnText, { color: primary }]}>
                        Restore {dismissedIds.size} dismissed
                      </Text>
                    </View>
                  </PressableScale>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Growth Intelligence */}
        {growthIndex && (
          <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
            <GrowthIntelligenceCard
              growthIndex={growthIndex}
              isDark={isDark}
              onPress={() => navigation.navigate('GrowthDashboard' as any)}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Baby Required Modal */}
      <Modal
        visible={showBabyRequiredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBabyRequiredModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowBabyRequiredModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalIcon}>
              <Ionicons name="people-outline" size={28} color={DS.white} />
            </LinearGradient>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              Baby Profile Needed
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Create a baby profile to unlock personalized insights and recommendations.
            </Text>
            <PressableScale
              onPress={() => {
                setShowBabyRequiredModal(false);
                navigation.navigate('CreateBabyProfile');
              }}
              activeScale={0.97}
              style={{ width: '100%' }}
            >
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryText}>Create Baby Profile</Text>
                <Ionicons name="arrow-forward" size={16} color={DS.white} />
              </LinearGradient>
            </PressableScale>
            <TouchableOpacity
              onPress={() => setShowBabyRequiredModal(false)}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>
                Maybe later
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '75%' },
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg, marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Card */
  card: {
    borderRadius: DS.radius.xl, padding: DS.space.lg, borderWidth: 1, overflow: 'hidden',
    ...DS.shadow.sm,
  },

  /* Chart */
  chartTitle: { fontSize: 13, fontWeight: '800' },
  chartSub: { fontSize: 11, fontWeight: '600' },
  patternBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
  patternDay: { flex: 1, alignItems: 'center', gap: 3 },
  patternCount: { fontSize: 9, fontWeight: '700' },
  patternBarContainer: { width: '100%', height: 52, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  patternBar: { width: '100%', borderRadius: 6, minHeight: 3 },
  patternDayLabel: { fontSize: 10, fontWeight: '600' },

  /* Category pills */
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1,
  },
  catPillText: { fontSize: 12, fontWeight: '600' },
  catPillBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  catPillBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Insight */
  insightCard: {
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  insightIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 3 },
  insightTime: { fontSize: 10, fontWeight: '500' },
  insightActionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  insightActionText: { fontSize: 10, fontWeight: '700' },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  priorityBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },

  /* Growth Intelligence */
  giTitle: { fontSize: 13, fontWeight: '800' },
  giSub: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  giComposite: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignItems: 'center' },
  giCompositeValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  giCompositeMax: { fontSize: 9, fontWeight: '700', marginTop: -2 },
  giScoreLabel: { fontSize: 11, fontWeight: '600', width: 60 },
  giScoreBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  giScoreBarFill: { height: '100%', borderRadius: 3 },
  giScoreValue: { fontSize: 11, fontWeight: '800', width: 28, textAlign: 'right' },

  /* Empty */
  emptyState: {
    paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center',
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: DS.radius.md, marginTop: DS.space.md,
  },
  restoreBtnText: { fontSize: 12, fontWeight: '700' },

  /* Modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalContent: {
    width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'],
    padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg,
  },
  modalIcon: {
    width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.space.md,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  modalDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: DS.space.lg, paddingHorizontal: 6 },
  modalPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, width: '100%',
  },
  modalPrimaryText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});