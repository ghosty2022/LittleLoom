import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

import { BlurView } from 'expo-blur';
import {
  differenceInDays,
  differenceInMonths,
  format,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeAvatar } from '@/components/SafeAvatar';
import { useAuth } from '@/context/AuthContext';
import { useCustomization } from '@/hooks/useCustomization';
import { useBaby } from '@/context/BabyContext';
import { useTracker } from '../../hooks';
import { useSweetAlert } from '@/components/SweetAlert';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';
import { useTrackerAchievements } from '@/hooks/useTrackerAchievements';
import { useTrackerProgressive } from '@/hooks/useTrackerProgressive';
import { useWHOGrowthCalculator, predictGrowth } from '@/hooks/useWHOGrowthCalculator';
import type { GrowthMeasurement, BabyProfile } from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = 52;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
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
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  text: {
    xs: { size: 11, weight: '500' as const },
    sm: { size: 13, weight: '500' as const },
    base: { size: 15, weight: '400' as const },
    lg: { size: 17, weight: '600' as const },
    xl: { size: 20, weight: '700' as const },
    '2xl': { size: 26, weight: '800' as const },
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const safeGender = (g?: string): 'boy' | 'girl' => (g === 'girl' ? 'girl' : 'boy');
const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};
const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};
const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};
const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
type MetricType = 'height' | 'weight' | 'head' | 'bmi';
type TimeRange = '1m' | '3m' | '6m' | '1y' | 'all';
type ChartMode = 'trend' | 'velocity' | 'percentile';
type DashboardTab = 'overview' | 'growth' | 'milestones' | 'insights' | 'photos';

interface InsightItem {
  id: string;
  type: 'milestone' | 'growth' | 'health' | 'sleep' | 'nutrition' | 'correlation' | 'achievement' | 'vaccination' | 'prediction';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
  timestamp: number;
}
interface PredictedMilestone { id: string; title: string; category: string; predictedAge: number; confidence: number; description: string; emoji: string; }
interface ActivitySuggestion { id: string; title: string; category: string; duration: string; frequency: string; benefit: string; emoji: string; color: string; }

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HOOK
   ═══════════════════════════════════════════════════════════════════════════ */
const useDashboardTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();
  return useMemo(() => ({
    primary: colors?.primary || DS.primary,
    secondary: colors?.secondary || DS.accent,
    isDark: !!isDark,
    text: {
      primary: fullThemeColors?.text || (isDark ? DS.white : DS.gray900),
      secondary: fullThemeColors?.textSecondary || (isDark ? DS.gray400 : DS.gray500),
      muted: fullThemeColors?.textMuted || (isDark ? DS.gray500 : DS.gray400),
    },
    border: fullThemeColors?.border || (isDark ? DS.darkBorder : DS.gray200),
  }), [isDark, colors, fullThemeColors]);
};

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
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SectionHeader
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = memo(({ title, subtitle, action, actionLabel, icon, color = DS.primary }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap; color?: string;
}) => {
  const theme = useDashboardTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
        {icon && (
          <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && <Text style={[styles.sectionSub, { color: theme.text.muted }]}>{subtitle}</Text>}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={13} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   GROWTH PULSE HEADER — replaces heavy hero
   ═══════════════════════════════════════════════════════════════════════════ */
const GrowthPulse = memo(({
  isDark, baby, ageMonths, composite, topMetrics, todayLogs, onBabyPress, onPDF, onAdd,
}: {
  isDark: boolean; baby: BabyProfile; ageMonths: number; composite: number;
  topMetrics: { height?: string; weight?: string; head?: string };
  todayLogs: number;
  onBabyPress: () => void;
  onPDF: () => void;
  onAdd: () => void;
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const scoreColor = composite >= 80 ? DS.success : composite >= 60 ? DS.primary : composite >= 40 ? DS.warning : DS.danger;

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
                <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="person" borderColor={DS.primary} borderWidth={1} />
              </View>
            </View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby.name}
              </Text>
              <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{ageMonths}mo</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: scoreColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Growth index {composite} · {todayLogs} logs today
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onPDF} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="document-text-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAdd} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: '#6366f1' }]}>{topMetrics.height || '—'}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>height</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: '#ec4899' }]}>{topMetrics.weight || '—'}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>weight</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: '#06b6d4' }]}>{topMetrics.head || '—'}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>head</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: scoreColor }]}>{composite}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>index</Text>
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
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>{text}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TabBar
   ═══════════════════════════════════════════════════════════════════════════ */
const TabBar = memo(({ tabs, activeTab, onChange }: {
  tabs: { key: DashboardTab; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: DashboardTab;
  onChange: (t: DashboardTab) => void;
}) => {
  const theme = useDashboardTheme();
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tabItem, isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
          >
            <Ionicons name={tab.icon} size={15} color={isActive ? theme.primary : theme.text.muted} />
            <Text style={[styles.tabLabel, { color: isActive ? theme.primary : theme.text.muted }, isActive && { fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD — Aura styled
   ═══════════════════════════════════════════════════════════════════════════ */
const KpiCard = memo(({ title, value, unit, change, icon, color, percentile, status, onPress }: any) => {
  const theme = useDashboardTheme();
  return (
    <PressableScale onPress={onPress} activeScale={0.97} style={{ flex: 1 }}>
      <View style={[styles.kpiCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={[`${color}10`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={[styles.kpiIcon, { backgroundColor: `${color}18` }]}>
            <Text style={{ fontSize: 18 }}>{icon}</Text>
          </View>
          {percentile !== undefined && (
            <View style={[styles.kpiP, { backgroundColor: `${color}18` }]}>
              <Text style={[styles.kpiPText, { color }]}>P{percentile}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 10 }}>
          <Text style={[styles.kpiVal, { color: theme.text.primary }]}>{value}</Text>
          <Text style={[styles.kpiUnit, { color }]}>{unit}</Text>
        </View>
        <Text style={[styles.kpiTitle, { color: theme.text.muted }]}>{title}</Text>
        {change !== undefined && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 }}>
            <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={10} color={change >= 0 ? DS.success : DS.danger} />
            <Text style={[styles.kpiChange, { color: change >= 0 ? DS.success : DS.danger }]}>
              {change > 0 ? '+' : ''}{change}{unit}
            </Text>
          </View>
        )}
        {status && (
          <View style={[styles.kpiStatus, { backgroundColor: `${status.color}15` }]}>
            <View style={[styles.kpiStatusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.kpiStatusText, { color: status.color }]}>{status.label}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
});

const isDarkBg = (theme: any) => theme.isDark;

/* ═══════════════════════════════════════════════════════════════════════════
   Insight Card
   ═══════════════════════════════════════════════════════════════════════════ */
const InsightCard = memo(({ insight, onPress, index }: { insight: InsightItem; onPress: () => void; index: number }) => {
  const theme = useDashboardTheme();
  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.97}>
        <View style={[styles.insightCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200, borderLeftColor: insight.color }]}>
          <LinearGradient colors={[`${insight.color}10`, `${insight.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md }}>
            <Text style={{ fontSize: 22 }}>{insight.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightTitle, { color: theme.text.primary }]} numberOfLines={1}>{insight.title}</Text>
              <Text style={[styles.insightDesc, { color: theme.text.secondary }]} numberOfLines={2}>{insight.description}</Text>
              {insight.action && (
                <View style={[styles.insightAction, { backgroundColor: `${theme.primary}12` }]}>
                  <Text style={[styles.insightActionText, { color: theme.primary }]}>{insight.action.label} →</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Growth-specific cards
   ═══════════════════════════════════════════════════════════════════════════ */
const AIGrowthPredictor = memo(({ baby, growthIndex, onPress }: { baby: BabyProfile; growthIndex: any; onPress: () => void }) => {
  const theme = useDashboardTheme();
  const predictions = useMemo(() => {
    if (!baby?.birthDate || !growthIndex) return [];
    const ageNow = safeDiffMonths(new Date(), baby.birthDate);
    const gender: 'boy' | 'girl' = baby.gender === 'girl' ? 'girl' : 'boy';
    const nGrowth = (growthIndex as any)?.sampleCounts?.growth ?? 0;
    const baseConf = Math.max(30, Math.min(95, 30 + nGrowth * 5));
    const make = (metric: 'height' | 'weight' | 'head', label: string, emoji: string, months: number, current: number | null) => {
      if (current == null) return null;
      const pred = predictGrowth(current, ageNow, metric, gender, months);
      return { milestone: label, predictedAge: Math.round(ageNow + months), confidence: Math.round((baseConf + pred.confidence) / 2), category: 'Physical', emoji };
    };
    return [
      make('height', 'Height in 3mo', '📏', 3, (growthIndex as any)?.latestValues?.height_cm ?? null),
      make('weight', 'Weight in 3mo', '⚖️', 3, (growthIndex as any)?.latestValues?.weight_kg ?? null),
      make('head', 'Head in 3mo', '🧠', 3, (growthIndex as any)?.latestValues?.head_cm ?? null),
    ].filter(Boolean) as any[];
  }, [growthIndex, baby?.birthDate, baby?.gender]);
  if (!predictions.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.auraCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md }}>
            <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name="sparkles" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.auraTitle, { color: theme.text.primary }]}>AI Growth Predictor</Text>
              <Text style={[styles.auraSub, { color: theme.text.muted }]}>Based on current patterns</Text>
            </View>
          </View>
          {predictions.map((p, i) => (
            <View key={i} style={[styles.predictorRow, i < predictions.length - 1 && { borderBottomColor: theme.isDark ? DS.darkBorder : DS.gray200, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.predLabel, { color: theme.text.primary }]}>{p.milestone}</Text>
                <Text style={[styles.predSub, { color: theme.text.muted }]}>~{p.predictedAge}mo · {p.category}</Text>
              </View>
              <View style={[styles.predConf, { backgroundColor: p.confidence > 70 ? `${DS.success}15` : p.confidence > 50 ? `${DS.warning}15` : `${DS.danger}15` }]}>
                <Text style={[styles.predConfText, { color: p.confidence > 70 ? DS.success : p.confidence > 50 ? DS.warning : DS.danger }]}>{p.confidence}%</Text>
              </View>
            </View>
          ))}
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const PercentileRadar = memo(({ stats }: { stats: any }) => {
  const theme = useDashboardTheme();
  if (!stats) return null;
  const dimensions = [
    { key: 'height', label: 'Height', color: '#6366f1' },
    { key: 'weight', label: 'Weight', color: '#ec4899' },
    { key: 'head', label: 'Head', color: '#06b6d4' },
    { key: 'bmi', label: 'BMI', color: '#f59e0b' },
  ];
  const values = dimensions.map(d => stats[d.key]?.percentile ? Math.min(stats[d.key].percentile, 100) : 0);
  const size = 140, center = size / 2, radius = size * 0.38;
  const angleStep = (Math.PI * 2) / dimensions.length;
  return (
    <Animated.View entering={FadeInUp.delay(180).springify()}>
      <View style={[styles.auraCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md }}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}18` }]}>
            <Ionicons name="analytics" size={16} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.auraTitle, { color: theme.text.primary }]}>Growth Dimensions</Text>
            <Text style={[styles.auraSub, { color: theme.text.muted }]}>WHO percentiles</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.lg }}>
          <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            {[0.25, 0.5, 0.75, 1].map((r, i) => (
              <View key={i} style={[styles.radarRing, {
                width: radius * 2 * r, height: radius * 2 * r, borderRadius: radius * r,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                left: center - radius * r, top: center - radius * r,
              }]} />
            ))}
            {values.map((v, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = (v / 100) * radius;
              return <View key={i} style={[styles.radarPoint, { left: center + Math.cos(angle) * r - 4, top: center + Math.sin(angle) * r - 4, backgroundColor: dimensions[i].color }]} />;
            })}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {dimensions.map((d, i) => (
              <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.radarDot, { backgroundColor: d.color }]} />
                <Text style={[styles.radarLabel, { color: theme.text.secondary }]}>{d.label}</Text>
                <Text style={[styles.radarVal, { color: theme.text.primary }]}>P{values[i] || '—'}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

const VelocityHeatmap = memo(({ measurements }: { measurements: GrowthMeasurement[]; activeMetric: MetricType }) => {
  const theme = useDashboardTheme();
  const data = useMemo(() => {
    const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const weeks: Record<string, { values: number[] }> = {};
    sorted.forEach(m => {
      const d = safeParseDate(m.date);
      if (!d) return;
      const key = format(d, 'yyyy-w');
      if (!weeks[key]) weeks[key] = { values: [] };
      weeks[key].values.push(m.value);
    });
    return Object.entries(weeks).slice(-8).map(([week, data]) => {
      const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length;
      const prev = Object.entries(weeks).find(([w]) => w === String(parseInt(week) - 1));
      const prevAvg = prev ? prev[1].values.reduce((a, b) => a + b, 0) / prev[1].values.length : avg;
      const change = prevAvg ? ((avg - prevAvg) / prevAvg) * 100 : 0;
      let status: 'high' | 'low' | 'normal' = 'normal';
      if (Math.abs(change) > 15) status = change > 0 ? 'high' : 'low';
      return { week: `W${week.split('-')[1]}`, value: avg, status };
    });
  }, [measurements]);
  const getColor = (s: string) => s === 'high' ? DS.success : s === 'low' ? DS.danger : theme.primary;
  return (
    <Animated.View entering={FadeInUp.delay(220).springify()}>
      <View style={[styles.auraCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md }}>
          <Text style={[styles.auraTitle, { color: theme.text.primary }]}>Weekly Velocity</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[{ l: 'High', c: DS.success }, { l: 'Normal', c: theme.primary }, { l: 'Low', c: DS.danger }].map(x => (
              <View key={x.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={[styles.radarDot, { backgroundColor: x.c }]} />
                <Text style={{ fontSize: 9, fontWeight: '600', color: theme.text.muted }}>{x.l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {data.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={[styles.heatCell, { borderColor: getColor(w.status), backgroundColor: `${getColor(w.status)}18` }]}>
                <Text style={[styles.heatVal, { color: getColor(w.status) }]}>{w.value ? w.value.toFixed(1) : '—'}</Text>
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: theme.text.muted }}>{w.week}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
});

const HealthCorrelation = memo(({ trackerEntries, baby }: { trackerEntries: any[]; baby: BabyProfile }) => {
  const theme = useDashboardTheme();
  const correlations = useMemo(() => {
    const sleep = trackerEntries.filter((e: any) => e.trackerId === 'sleep' && e.babyId === baby?.id).slice(-7);
    const feed = trackerEntries.filter((e: any) => e.trackerId === 'feed' && e.babyId === baby?.id).slice(-7);
    const all = trackerEntries.filter((e: any) => e.babyId === baby?.id);
    const avgSleep = sleep.length ? sleep.reduce((s, e) => s + (e.duration || 0), 0) / sleep.length / 60 : 0;
    const avgFeed = feed.length ? feed.reduce((s, e) => s + (e.amount || 0), 0) / feed.length : 0;
    const avgAct = all.length ? all.length / 7 : 0;
    const sleepScore = avgSleep > 12 ? 92 : avgSleep > 8 ? 78 : avgSleep > 4 ? 55 : avgSleep > 0 ? 30 : 0;
    const feedScore = avgFeed > 150 ? 88 : avgFeed > 100 ? 72 : avgFeed > 50 ? 50 : avgFeed > 0 ? 25 : 0;
    const actScore = Math.min(100, Math.round(avgAct * 20));
    return [
      { label: 'Sleep → Growth', value: sleepScore, icon: '😴', color: '#8b5cf6', detail: avgSleep > 0 ? `${avgSleep.toFixed(1)}h avg` : 'No data' },
      { label: 'Feed → Growth', value: feedScore, icon: '🍼', color: '#f59e0b', detail: avgFeed > 0 ? `${avgFeed.toFixed(0)}ml avg` : 'No data' },
      { label: 'Activity → Growth', value: actScore, icon: '🎾', color: '#10b981', detail: avgAct > 0 ? `${avgAct.toFixed(1)}/day` : 'No data' },
    ];
  }, [trackerEntries, baby]);
  return (
    <Animated.View entering={FadeInUp.delay(260).springify()}>
      <View style={[styles.auraCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ marginBottom: DS.space.md }}>
          <Text style={[styles.auraTitle, { color: theme.text.primary }]}>Health Correlations</Text>
          <Text style={[styles.auraSub, { color: theme.text.muted }]}>How habits affect growth</Text>
        </View>
        {correlations.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: 8 }}>
            <Text style={{ fontSize: 20 }}>{c.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.corrLabel, { color: theme.text.primary }]}>{c.label}</Text>
              <Text style={[styles.corrDetail, { color: theme.text.muted }]}>{c.detail}</Text>
            </View>
            <View style={[styles.corrBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <View style={[styles.corrFill, { width: `${c.value}%`, backgroundColor: c.color }]} />
            </View>
            <Text style={[styles.corrVal, { color: c.color }]}>{c.value}%</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const ActivitySuggestions = memo(({ baby, onPress }: { baby: BabyProfile; onPress: (a: ActivitySuggestion) => void }) => {
  const theme = useDashboardTheme();
  const ageMonths = safeDiffMonths(new Date(), baby.birthDate);
  const suggestions = useMemo((): ActivitySuggestion[] => {
    const base: ActivitySuggestion[] = [];
    if (ageMonths < 3) base.push({ id: 'tummy', title: 'Tummy Time', category: 'Physical', duration: '5-10 min', frequency: '3x daily', benefit: 'Strengthens neck', emoji: '👶', color: '#10b981' });
    if (ageMonths >= 3 && ageMonths < 6) base.push({ id: 'reach', title: 'Reach & Grasp', category: 'Motor', duration: '10 min', frequency: '2x daily', benefit: 'Hand-eye coordination', emoji: '👋', color: '#6366f1' });
    if (ageMonths >= 6) base.push({ id: 'crawl', title: 'Crawl Exploration', category: 'Physical', duration: '15 min', frequency: 'Daily', benefit: 'Builds core strength', emoji: '🐛', color: '#ec4899' });
    if (ageMonths >= 9) base.push({ id: 'peek', title: 'Peek-a-Boo', category: 'Cognitive', duration: '10 min', frequency: 'Daily', benefit: 'Object permanence', emoji: '🙈', color: '#f59e0b' });
    return base.slice(0, 3);
  }, [ageMonths]);
  if (!suggestions.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Recommended Activities" subtitle={`For ${ageMonths} months old`} icon="fitness-outline" color={DS.success} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {suggestions.map(s => (
          <PressableScale key={s.id} onPress={() => onPress(s)} activeScale={0.94}>
            <View style={[styles.suggestionCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${s.color}12`, `${s.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.suggestionIcon, { backgroundColor: `${s.color}18` }]}>
                <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              </View>
              <Text style={[styles.suggestionTitle, { color: theme.text.primary }]}>{s.title}</Text>
              <Text style={[styles.suggestionCat, { color: s.color }]}>{s.category}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={11} color={theme.text.muted} />
                <Text style={[styles.suggestionMeta, { color: theme.text.muted }]}>{s.duration} · {s.frequency}</Text>
              </View>
              <Text style={[styles.suggestionBenefit, { color: theme.text.secondary }]} numberOfLines={2}>{s.benefit}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const PredictiveMilestoneCalendar = memo(({ baby, milestones, onPress }: { baby: BabyProfile; milestones: any[]; onPress: (m: PredictedMilestone) => void }) => {
  const theme = useDashboardTheme();
  const ageMonths = safeDiffMonths(new Date(), baby.birthDate);
  const preds = useMemo((): PredictedMilestone[] => {
    const achieved = new Set(milestones.map(m => m.title?.toLowerCase()));
    const db = [
      { title: 'Rolling Over', category: 'Physical', typicalAge: 4, emoji: '🔄' },
      { title: 'Sitting Up', category: 'Physical', typicalAge: 6, emoji: '🪑' },
      { title: 'Crawling', category: 'Physical', typicalAge: 9, emoji: '🐛' },
      { title: 'First Steps', category: 'Physical', typicalAge: 12, emoji: '👣' },
      { title: 'First Words', category: 'Cognitive', typicalAge: 12, emoji: '🗣️' },
      { title: 'Waving Bye', category: 'Social', typicalAge: 9, emoji: '👋' },
      { title: 'Clapping', category: 'Social', typicalAge: 9, emoji: '👏' },
    ];
    const out: PredictedMilestone[] = [];
    db.forEach(m => {
      if (!achieved.has(m.title.toLowerCase()) && m.typicalAge >= ageMonths) {
        out.push({ id: `pred-${m.title}`, title: m.title, category: m.category, predictedAge: m.typicalAge, confidence: Math.max(30, 100 - (m.typicalAge - ageMonths) * 10), description: `Typically achieved around ${m.typicalAge} months`, emoji: m.emoji });
      }
    });
    return out.slice(0, 4);
  }, [milestones, ageMonths]);
  if (!preds.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(340).springify()}>
      <SectionHeader title="Upcoming Milestones" subtitle="WHO-based predictions" icon="trophy-outline" color={DS.warning} />
      <View style={{ paddingHorizontal: DS.space.lg }}>
        {preds.map((m, i) => (
          <PressableScale key={m.id} onPress={() => onPress(m)} activeScale={0.97}>
            <View style={[styles.mileCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white, borderColor: theme.isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={[styles.mileIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mileTitle, { color: theme.text.primary }]}>{m.title}</Text>
                <Text style={[styles.mileMeta, { color: theme.text.muted }]}>{m.category} · ~{m.predictedAge}mo</Text>
              </View>
              <View style={[styles.mileConf, { backgroundColor: m.confidence > 70 ? `${DS.success}15` : m.confidence > 50 ? `${DS.warning}15` : `${DS.danger}15` }]}>
                <Text style={[styles.mileConfText, { color: m.confidence > 70 ? DS.success : m.confidence > 50 ? DS.warning : DS.danger }]}>{m.confidence}%</Text>
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PureChart
   ═══════════════════════════════════════════════════════════════════════════ */
const PureChart = memo(({ data, mode, width, height }: any) => {
  const theme = useDashboardTheme();
  if (!data || data.length === 0) return null;
  const values = data.map((d: any) => d.value);
  const maxVal = Math.max(...values, 0.1), minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const padding = { top: 20, right: 10, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const getX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartW;
  const getY = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;
  if (mode === 'velocity') {
    const barW = Math.max(4, (chartW / data.length) * 0.6);
    return (
      <View style={{ width, height }}>
        {data.map((d: any, i: number) => (
          <View key={i} style={{
            position: 'absolute', left: getX(i) - barW / 2, top: getY(d.value),
            width: barW, height: padding.top + chartH - getY(d.value),
            backgroundColor: theme.primary, borderRadius: 4, opacity: 0.85,
          }} />
        ))}
        {data.filter((_: any, i: number) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d: any, i: number) => (
          <Text key={`x-${i}`} style={{ position: 'absolute', left: getX(data.indexOf(d)) - 20, top: padding.top + chartH + 4, width: 40, fontSize: 8, color: theme.text.muted, textAlign: 'center' }} numberOfLines={1}>{d.label}</Text>
        ))}
      </View>
    );
  }
  return (
    <View style={{ width, height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <View key={`g-${i}`} style={{ position: 'absolute', left: padding.left, right: padding.right, top: padding.top + chartH - r * chartH, height: 1, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <Text key={`y-${i}`} style={{ position: 'absolute', left: 0, top: padding.top + chartH - r * chartH - 6, width: padding.left - 4, fontSize: 9, color: theme.text.muted, textAlign: 'right' }}>
          {(minVal + r * range).toFixed(1)}
        </Text>
      ))}
      {data.map((d: any, i: number) => {
        if (i === 0) return null;
        const prev = data[i - 1];
        const x1 = getX(i - 1), y1 = getY(prev.value);
        const x2 = getX(i), y2 = getY(d.value);
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View
            key={`l-${i}`}
            style={{
              position: 'absolute',
              left: (x1 + x2) / 2 - len / 2,
              top: (y1 + y2) / 2 - 1.25,
              width: len,
              height: 2.5,
              backgroundColor: theme.primary,
              transform: [{ rotate: `${angle}deg` }],
              borderRadius: 1.5,
            }}
          />
        );
      })}
      {data.map((d: any, i: number) => (
        <View key={`p-${i}`} style={{ position: 'absolute', left: getX(i) - 4, top: getY(d.value) - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 2, borderColor: theme.isDark ? DS.darkCard : DS.white }} />
      ))}
      {data.filter((_: any, i: number) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d: any, i: number) => (
        <Text key={`x-${i}`} style={{ position: 'absolute', left: getX(data.indexOf(d)) - 20, top: padding.top + chartH + 4, width: 40, fontSize: 8, color: theme.text.muted, textAlign: 'center' }} numberOfLines={1}>{d.label}</Text>
      ))}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Add Measurement Modal
   ═══════════════════════════════════════════════════════════════════════════ */
const AddMeasurementModal = memo(({ visible, onClose, onSave, type, previousValue }: any) => {
  const theme = useDashboardTheme();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const unit = type === 'weight' ? 'kg' : 'cm';

  useEffect(() => {
    if (visible) { setValue(''); setNotes(''); setDate(format(new Date(), 'yyyy-MM-dd')); }
  }, [visible]);

  const handleSave = useCallback(() => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    onSave({ type, value: num, unit, date: new Date(date).toISOString(), notes: notes || undefined });
    onClose();
  }, [value, notes, date, type, unit, onSave, onClose]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: theme.isDark ? DS.darkCard : DS.white }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Add {type}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
          {previousValue !== undefined && (
            <View style={[styles.prevBox, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="information-circle" size={16} color={theme.primary} />
              <Text style={[styles.prevText, { color: theme.primary }]}>Previous: {previousValue} {unit}</Text>
            </View>
          )}
          <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Value ({unit})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: theme.text.primary }]}
            keyboardType="decimal-pad" value={value} onChangeText={setValue}
            placeholder={`Enter ${type}`} placeholderTextColor={theme.text.muted}
          />
          <Text style={[styles.inputLabel, { color: theme.text.secondary, marginTop: 12 }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: theme.text.primary }]}
            value={date} onChangeText={setDate}
          />
          <Text style={[styles.inputLabel, { color: theme.text.secondary, marginTop: 12 }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: theme.text.primary }]}
            multiline value={notes} onChangeText={setNotes}
            placeholder="Optional..." placeholderTextColor={theme.text.muted}
          />
          <PressableScale onPress={handleSave} activeScale={0.97} style={{ marginTop: 20 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Measurement</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function GrowthDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useDashboardTheme();
  const { currentBaby, growthData, milestones, addGrowthMeasurement, getGrowthData } = useBaby();
  const { userProfile } = useAuth();
  const { entries: trackerEntries } = useTracker();
  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { achievements, newlyUnlocked, streak: globalStreak } = useTrackerAchievements();
  const { getPercentile, getStatus } = useWHOGrowthCalculator();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [activeMetric, setActiveMetric] = useState<MetricType>('height');
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [chartMode, setChartMode] = useState<ChartMode>('trend');
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP) }));

  const ageMonths = useMemo(() => currentBaby ? safeDiffMonths(new Date(), currentBaby.birthDate) : 0, [currentBaby]);

  const stats = useMemo(() => {
    if (!currentBaby) return null;
    const gender = safeGender(currentBaby.gender);
    const result: Record<string, any> = {};
    (['height', 'weight', 'head'] as MetricType[]).forEach(type => {
      const data = getGrowthData(type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0], prev = data[1];
      if (latest) {
        const ageAt = Math.max(0, safeDiffMonths(latest.date, currentBaby.birthDate));
        const p = getPercentile(latest.value, ageAt, type, gender);
        result[type] = { value: latest.value.toFixed(1), unit: latest.unit, change: prev ? (latest.value - prev.value).toFixed(1) : undefined, percentile: p, status: getStatus(p) };
      }
    });
    if (result.height && result.weight) {
      const h = parseFloat(result.height.value) / 100;
      const w = parseFloat(result.weight.value);
      const bmi = w / (h * h);
      const ageAt = Math.max(0, safeDiffMonths(new Date(), currentBaby.birthDate));
      const p = getPercentile(bmi, ageAt, 'bmi', gender);
      result.bmi = { value: bmi.toFixed(1), unit: '', percentile: p, status: getStatus(p) };
    }
    return result;
  }, [growthData, currentBaby, getGrowthData, getPercentile, getStatus]);

  const chartData = useMemo(() => {
    if (!currentBaby) return [];
    const ranges: Record<TimeRange, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 3650 };
    const cutoff = new Date(Date.now() - ranges[timeRange] * 86400000);
    let data = getGrowthData(activeMetric).filter(g => { const d = safeParseDate(g.date); return d && d >= cutoff; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (activeMetric === 'bmi') {
      const hs = getGrowthData('height').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      data = getGrowthData('weight').map(w => {
        const wd = safeParseDate(w.date); if (!wd) return null;
        const h = hs.reduce((b, c) => {
          const bd = safeParseDate(b?.date), cd = safeParseDate(c?.date);
          if (!bd || !cd) return c;
          return Math.abs(safeDiffDays(cd, wd)) < Math.abs(safeDiffDays(bd, wd)) ? c : b;
        }, hs[0]);
        if (!h) return null;
        return { ...w, value: parseFloat((w.value / Math.pow(h.value / 100, 2)).toFixed(2)), type: 'bmi' as const };
      }).filter(Boolean) as GrowthMeasurement[];
    }
    return data.map((g, i) => ({ value: Number(g.value) || 0, label: safeFmt(g.date, 'MMM d'), index: i }));
  }, [growthData, activeMetric, timeRange, currentBaby, getGrowthData]);

  const velocityData = useMemo(() => {
    if (chartData.length < 2) return [];
    const v: { value: number; label: string }[] = [];
    for (let i = 1; i < chartData.length; i++) {
      const d = safeDiffDays(
        safeParseDate(growthData.find(g => g.date.includes(chartData[i].label))?.date) || new Date(),
        safeParseDate(growthData.find(g => g.date.includes(chartData[i - 1].label))?.date) || new Date(),
      );
      if (d <= 0) continue;
      v.push({ value: parseFloat(((chartData[i].value - chartData[i - 1].value) / d * 30).toFixed(2)), label: chartData[i].label });
    }
    return v;
  }, [chartData, growthData]);

  const smartInsights = useMemo((): InsightItem[] => {
    if (!currentBaby) return [];
    const items: InsightItem[] = [];
    const now = Date.now();
    if (growthIndex) {
      if (growthIndex.nutritionScore?.value < 50) items.push({ id: 'n', type: 'nutrition', title: 'Nutrition low', description: `${growthIndex.nutritionScore.value}/100 — review feeds`, emoji: '🍎', color: DS.warning, priority: 'high', action: { label: 'Track Feed', screen: 'AddEntry', params: { trackerId: 'feed' } }, timestamp: now });
      if (growthIndex.restScore?.value < 50) items.push({ id: 's', type: 'sleep', title: 'Rest low', description: `${growthIndex.restScore.value}/100 — check sleep`, emoji: '😴', color: '#8b5cf6', priority: 'medium', action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } }, timestamp: now });
    }
    if (globalStreak?.streakAtRisk && globalStreak.currentStreak > 0) items.push({ id: 'str', type: 'achievement', title: 'Streak at risk', description: `Log in ${globalStreak.hoursUntilBreak}h`, emoji: '⏰', color: DS.danger, priority: 'high', action: { label: 'Log Now', screen: 'AddEntry' }, timestamp: now });
    const typeData = getGrowthData(activeMetric);
    if (typeData.length >= 2) {
      const sorted = [...typeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
      if (last.value < prev.value) {
        const drop = ((prev.value - last.value) / prev.value) * 100;
        if (drop > 5) items.push({ id: 'drop', type: 'growth', title: 'Decrease detected', description: `${activeMetric} dropped ${drop.toFixed(1)}%`, emoji: '⚠️', color: DS.danger, priority: 'high', action: { label: 'Re-measure', screen: 'AddEntry', params: { trackerId: 'growth' } }, timestamp: now });
      }
    }
    return items.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]).slice(0, 6);
  }, [growthIndex, currentBaby, globalStreak, getGrowthData, activeMetric]);

  const topRibbon = useMemo(() => {
    const high = smartInsights.filter(i => i.priority === 'high');
    if (high.length) return { icon: 'alert-circle-outline' as const, color: DS.danger, label: 'Attention', text: high[0].title, onPress: () => handleInsightPress(high[0]) };
    if (growthIndex?.compositeIndex) return { icon: 'sparkles' as const, color: DS.success, label: 'Growth Index', text: `${growthIndex.compositeIndex}/100 — ${growthIndex.compositeIndex >= 80 ? 'Excellent' : growthIndex.compositeIndex >= 60 ? 'Good' : 'Needs care'}`, onPress: () => navigation.navigate('GrowthIntelligence') };
    return { icon: 'bulb-outline' as const, color: DS.primary, label: 'Tip', text: 'Log measurements consistently to unlock better predictions', onPress: () => setShowAddModal(true) };
  }, [smartInsights, growthIndex, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof loadBabies === 'function') await loadBabies();
    } catch (e) {
      if (__DEV__) console.warn('[GrowthDashboard] refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies]);

  const handleAddMeasurement = useCallback(async (data: Partial<GrowthMeasurement>) => {
    if (!currentBaby) return;
    const ok = await addGrowthMeasurement({
      babyId: currentBaby.id, type: data.type as MetricType,
      value: data.value ?? 0, unit: data.unit || 'cm',
      date: data.date || new Date().toISOString(),
      notes: data.notes, recordedBy: userProfile?.fullName?.split(' ')[0] || 'Parent',
    });
    if (ok) { HAPTIC_SUCCESS(); setShowAddModal(false); }
  }, [currentBaby, addGrowthMeasurement, userProfile]);

  const handleInsightPress = useCallback((insight: InsightItem) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) navigation.navigate(insight.action.screen, insight.action.params);
  }, [navigation]);

  const getPreviousValue = useCallback(() => {
    const data = getGrowthData(activeMetric).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return data[0]?.value;
  }, [activeMetric, getGrowthData]);

  const handleTabChange = useCallback((tab: DashboardTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    HAPTIC_LIGHT();
  }, []);

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkBg(theme) ? DS.darkBg : DS.gray50 }, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDarkBg(theme) ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDarkBg(theme) ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-add" size={64} color={theme.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.noDataTitle, { color: theme.text.primary }]}>No Baby Profile</Text>
        <Text style={[styles.noDataText, { color: theme.text.secondary }]}>Create a profile to start tracking growth</Text>
        <PressableScale onPress={() => navigation.navigate('CreateBabyProfile')} activeScale={0.97}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={styles.createBtn}>
            <Text style={styles.createBtnText}>Create Profile</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  const tabs = [
    { key: 'overview' as DashboardTab, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'growth' as DashboardTab, label: 'Growth', icon: 'trending-up-outline' as const },
    { key: 'milestones' as DashboardTab, label: 'Awards', icon: 'trophy-outline' as const },
    { key: 'insights' as DashboardTab, label: 'Insights', icon: 'bulb-outline' as const },
    { key: 'photos' as DashboardTab, label: 'Photos', icon: 'images-outline' as const },
  ];

  const todayLogs = trackerEntries.filter((e: any) => e?.timestamp >= startOfDay(new Date()).getTime()).length;

  return (
    <View style={[styles.container, { backgroundColor: isDarkBg(theme) ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDarkBg(theme) ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDarkBg(theme) ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDarkBg(theme) ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }, headerAnim]}>
        <BlurView intensity={isDarkBg(theme) ? 90 : 95} tint={isDarkBg(theme) ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDarkBg(theme) ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>GROWTH</GradientText>
            <Text style={[styles.headerSub, { color: isDarkBg(theme) ? DS.gray400 : DS.gray500 }]}>{currentBaby.name}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Achievements')} style={[styles.headerIconBtn, { backgroundColor: isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="trophy-outline" size={20} color={isDarkBg(theme) ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
      >
        {/* Pulse Header */}
        <GrowthPulse
          isDark={isDarkBg(theme)}
          baby={currentBaby}
          ageMonths={ageMonths}
          composite={growthIndex?.compositeIndex || 0}
          topMetrics={{ height: stats?.height?.value, weight: stats?.weight?.value, head: stats?.head?.value }}
          todayLogs={todayLogs}
          onBabyPress={() => navigation.navigate('SwitchBaby', { returnTo: 'GrowthDashboard', returnLabel: 'Growth' })}
          onPDF={() => navigation.navigate('PediatricianPDFExport')}
          onAdd={() => setShowAddModal(true)}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDarkBg(theme)} {...topRibbon} />
        </View>

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </View>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              {[
                { key: 'height', title: 'Height', icon: '📏', color: '#6366f1' },
                { key: 'weight', title: 'Weight', icon: '⚖️', color: '#ec4899' },
                { key: 'head', title: 'Head', icon: '🧠', color: '#06b6d4' },
                { key: 'bmi', title: 'BMI', icon: '📊', color: '#f59e0b' },
              ].map((m, i) => {
                const s = stats?.[m.key];
                return (
                  <Animated.View key={m.key} entering={FadeInUp.delay(80 + i * 60).springify()} style={{ width: (SCREEN_W - 40 - 10) / 2 }}>
                    <KpiCard
                      title={m.title} value={s?.value || '—'}
                      unit={s?.unit || (m.key === 'weight' ? 'kg' : m.key === 'bmi' ? '' : 'cm')}
                      change={s?.change ? parseFloat(s.change) : undefined}
                      icon={m.icon} color={m.color}
                      percentile={s?.percentile} status={s?.status}
                      onPress={() => { setActiveMetric(m.key as MetricType); setActiveTab('growth'); HAPTIC_LIGHT(); }}
                    />
                  </Animated.View>
                );
              })}
            </View>

            <View style={{ marginTop: DS.space.md }}>
              <AIGrowthPredictor baby={currentBaby} growthIndex={growthIndex} onPress={() => navigation.navigate('GrowthIntelligence')} />
            </View>

            <View style={{ marginTop: DS.space.md }}>
              <HealthCorrelation trackerEntries={trackerEntries} baby={currentBaby} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <ActivitySuggestions baby={currentBaby} onPress={(a) => navigation.navigate('ActivityDetail', { activity: a })} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <PredictiveMilestoneCalendar baby={currentBaby} milestones={milestones} onPress={(m) => navigation.navigate('MilestoneDetail', { milestone: m })} />
            </View>

            {smartInsights.length > 0 && (
              <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg, gap: 8 }}>
                <SectionHeader title="Smart Insights" subtitle={`${smartInsights.filter(i => i.priority === 'high').length} need attention`} icon="sparkles-outline" action={() => navigation.navigate('Insights')} actionLabel="View All" color={DS.accent} />
                {smartInsights.slice(0, 3).map((insight, i) => <InsightCard key={insight.id} insight={insight} onPress={() => handleInsightPress(insight)} index={i} />)}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DS.space.lg, marginTop: DS.space.lg, marginBottom: DS.space.lg }}>
              {[
                { icon: '🌟', label: 'Timeline', screen: 'Timeline', grad: ['#f59e0b', '#fbbf24'] as [string, string] },
                { icon: '💉', label: 'Vaccines', screen: 'VaccinationSchedule', grad: ['#6366f1', '#ec4899'] as [string, string] },
                { icon: '📸', label: 'Photos', screen: 'Gallery', grad: ['#10b981', '#34d399'] as [string, string] },
                { icon: '🏆', label: 'Awards', screen: 'Achievements', grad: ['#8b5cf6', '#a78bfa'] as [string, string] },
              ].map((a, i) => (
                <PressableScale key={i} onPress={() => navigation.navigate(a.screen)} activeScale={0.94} style={{ flex: 1 }}>
                  <LinearGradient colors={a.grad} style={styles.quickAct} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={{ fontSize: 20 }}>{a.icon}</Text>
                    <Text style={styles.quickActText}>{a.label}</Text>
                  </LinearGradient>
                </PressableScale>
              ))}
            </View>
          </>
        )}

        {/* ═══ GROWTH ═══ */}
        {activeTab === 'growth' && (
          <View style={{ marginTop: DS.space.md, gap: 12 }}>
            <PercentileRadar stats={stats} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
              {(['height', 'weight', 'head', 'bmi'] as MetricType[]).map(m => {
                const active = activeMetric === m;
                return (
                  <TouchableOpacity key={m} onPress={() => setActiveMetric(m)} style={[styles.pill, { backgroundColor: active ? theme.primary : isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.white, borderColor: active ? theme.primary : isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]} activeOpacity={0.8}>
                    <Text style={[styles.pillText, { color: active ? DS.white : theme.text.secondary }, active && { fontWeight: '700' }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
              {(['1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map(r => {
                const active = timeRange === r;
                return (
                  <TouchableOpacity key={r} onPress={() => setTimeRange(r)} style={[styles.pill, { backgroundColor: active ? theme.secondary : isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.white, borderColor: active ? theme.secondary : isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]} activeOpacity={0.8}>
                    <Text style={[styles.pillText, { color: active ? DS.white : theme.text.secondary }, active && { fontWeight: '700' }]}>{r === 'all' ? 'All' : r}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', paddingHorizontal: DS.space.lg, gap: 8 }}>
              {[
                { k: 'trend' as ChartMode, l: 'Trend', i: 'trending-up' },
                { k: 'velocity' as ChartMode, l: 'Velocity', i: 'speedometer' },
                { k: 'percentile' as ChartMode, l: 'Percentile', i: 'analytics' },
              ].map(x => {
                const active = chartMode === x.k;
                return (
                  <TouchableOpacity key={x.k} onPress={() => setChartMode(x.k)} style={[styles.modeChip, { flex: 1, backgroundColor: active ? theme.secondary : isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.white, borderColor: active ? theme.secondary : isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]} activeOpacity={0.8}>
                    <Ionicons name={x.i as any} size={13} color={active ? DS.white : theme.text.secondary} />
                    <Text style={[styles.pillText, { color: active ? DS.white : theme.text.secondary, marginLeft: 4 }, active && { fontWeight: '700' }]}>{x.l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Animated.View entering={FadeInUp.delay(120).springify()}>
              <View style={[styles.auraCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View>
                    <Text style={[styles.auraTitle, { color: theme.text.primary }]}>
                      {chartMode === 'trend' ? `${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Trend` : chartMode === 'velocity' ? 'Growth Velocity' : 'Percentile Tracking'}
                    </Text>
                    <Text style={[styles.auraSub, { color: theme.text.muted }]}>{chartData.length} measurements • WHO</Text>
                  </View>
                  {stats?.[activeMetric]?.percentile !== undefined && (
                    <View style={[styles.kpiP, { backgroundColor: `${theme.primary}18` }]}>
                      <Text style={[styles.kpiPText, { color: theme.primary }]}>P{stats[activeMetric].percentile}</Text>
                    </View>
                  )}
                </View>
                {chartData.length > 0 ? (
                  <PureChart data={chartMode === 'velocity' ? velocityData : chartData} mode={chartMode} width={SCREEN_W - 72} height={220} />
                ) : (
                  <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <MaterialCommunityIcons name="chart-line" size={48} color={theme.text.muted} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: theme.text.muted }}>No data yet</Text>
                    <PressableScale onPress={() => setShowAddModal(true)} activeScale={0.96}>
                      <LinearGradient colors={[DS.primary, DS.accent]} style={styles.addDataBtn}>
                        <Text style={styles.addDataBtnText}>Add First Measurement</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                )}
              </View>
            </Animated.View>

            <VelocityHeatmap measurements={getGrowthData(activeMetric)} activeMetric={activeMetric} />

            <View style={{ marginTop: DS.space.sm }}>
              <SectionHeader title="Recent Measurements" icon="time-outline" action={() => navigation.navigate('Timeline', { filter: 'growth' })} actionLabel="History" />
              <View style={[styles.auraCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200, padding: 0 }]}>
                {getGrowthData(activeMetric).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((m, i, arr) => {
                  const ageAt = Math.max(0, safeDiffMonths(m.date, currentBaby.birthDate));
                  const gender = safeGender(currentBaby.gender);
                  const p = getPercentile(m.value, ageAt, m.type as MetricType, gender);
                  return (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }}>
                      <View style={[styles.histIcon, { backgroundColor: `${theme.primary}15` }]}>
                        <Text style={{ fontSize: 16 }}>{m.type === 'height' ? '📏' : m.type === 'weight' ? '⚖️' : m.type === 'head' ? '🧠' : '📊'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.histType, { color: theme.text.primary }]}>{m.type.charAt(0).toUpperCase() + m.type.slice(1)}</Text>
                        <Text style={[styles.histDate, { color: theme.text.muted }]}>{safeFmt(m.date, 'MMM d, yyyy')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        <Text style={[styles.histVal, { color: theme.primary }]}>{m.value} {m.unit}</Text>
                        <View style={[styles.kpiP, { backgroundColor: `${getStatus(p).color}15` }]}>
                          <Text style={[styles.kpiPText, { color: getStatus(p).color }]}>P{p}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {getGrowthData(activeMetric).length === 0 && (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: theme.text.muted, fontSize: 13 }}>No measurements yet</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ═══ MILESTONES ═══ */}
        {activeTab === 'milestones' && (
          <View style={{ marginTop: DS.space.md, gap: 12 }}>
            {growthIndex?.milestoneReadiness && growthIndex.milestoneReadiness.length > 0 && (
              <View>
                <SectionHeader title="Milestone Readiness" icon="trophy-outline" />
                <View style={[styles.auraCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200, padding: 0 }]}>
                  {growthIndex.milestoneReadiness.map((m: any, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < growthIndex.milestoneReadiness.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text.primary, marginBottom: 4 }}>{m.category}</Text>
                        <View style={{ height: 6, backgroundColor: isDarkBg(theme) ? 'rgba(255,255,255,0.06)' : DS.gray100, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${Math.min(m.readinessPercent, 100)}%`, backgroundColor: m.readinessPercent > 80 ? DS.success : m.readinessPercent > 50 ? DS.warning : DS.danger }} />
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text.primary, width: 40, textAlign: 'right' }}>{m.readinessPercent}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <PredictiveMilestoneCalendar baby={currentBaby} milestones={milestones} onPress={(m) => navigation.navigate('MilestoneDetail', { milestone: m })} />

            <View>
              <SectionHeader title="Achieved Milestones" subtitle={`${milestones.length} total`} icon="checkmark-circle-outline" color={DS.success} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {milestones.sort((a, b) => {
                  const da = safeParseDate(a.achievedAt), db = safeParseDate(b.achievedAt);
                  return (db?.getTime() || 0) - (da?.getTime() || 0);
                }).slice(0, 6).map((m, i) => (
                  <Animated.View key={m.id} entering={FadeInUp.delay(i * 50).springify()}>
                    <View style={[styles.auraCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }]}>
                      <View style={[styles.histIcon, { backgroundColor: `${DS.success}15` }]}>
                        <Text style={{ fontSize: 18 }}>🌟</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text.primary }}>{m.title}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.text.muted, marginTop: 2 }}>
                          {safeFmt(m.achievedAt, 'MMM d, yyyy')} • {safeDiffMonths(m.achievedAt, currentBaby.birthDate)}mo
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color={DS.success} />
                    </View>
                  </Animated.View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ═══ INSIGHTS ═══ */}
        {activeTab === 'insights' && (
          <View style={{ marginTop: DS.space.md, gap: 12, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="Quick Insights" subtitle={`${smartInsights.length} items`} icon="bulb-outline" color={DS.accent} action={() => navigation.navigate('Insights')} actionLabel="View All" />
            {smartInsights.length > 0 ? smartInsights.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} onPress={() => handleInsightPress(insight)} index={i} />
            )) : (
              <View style={[styles.auraCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200, alignItems: 'center', padding: 32, gap: 8 }]}>
                <Ionicons name="bulb-outline" size={44} color={theme.text.muted} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text.primary }}>No insights yet</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: theme.text.secondary, textAlign: 'center' }}>Keep tracking to unlock personalized insights</Text>
              </View>
            )}

            {growthIndex?.velocityTrends && (
              <View style={{ marginTop: DS.space.lg }}>
                <SectionHeader title="Velocity Trends" icon="trending-up-outline" color={DS.info} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { key: 'height', label: 'Height', unit: 'cm/mo', color: '#6366f1' },
                    { key: 'weight', label: 'Weight', unit: 'kg/mo', color: '#ec4899' },
                    { key: 'head', label: 'Head', unit: 'cm/mo', color: '#06b6d4' },
                  ].map(v => {
                    const data = (growthIndex.velocityTrends as any)?.[v.key];
                    return (
                      <View key={v.key} style={[styles.velCard, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text.muted, textTransform: 'uppercase' }}>{v.label}</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: v.color }}>{data?.perMonth?.toFixed(2) || '—'}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text.muted }}>{v.unit}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══ PHOTOS ═══ */}
        {activeTab === 'photos' && (
          <View style={{ marginTop: DS.space.md }}>
            <SectionHeader title="Growth Memories" subtitle="Photos tied to measurements" icon="images-outline" color={DS.success} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DS.space.lg, gap: 10 }}>
              <PressableScale onPress={() => {}} activeScale={0.94} style={{ width: (SCREEN_W - 40 - 20) / 3 }}>
                <View style={styles.photoAdd}>
                  <LinearGradient colors={[DS.primary, DS.accent]} style={styles.photoAddGrad}>
                    <Ionicons name="camera" size={26} color={DS.white} />
                    <Text style={styles.photoAddText}>Add</Text>
                  </LinearGradient>
                </View>
              </PressableScale>
              {[1, 2, 3, 4, 5].map((_, i) => (
                <View key={i} style={[styles.photoItem, { backgroundColor: isDarkBg(theme) ? DS.darkCard : DS.white, borderColor: isDarkBg(theme) ? DS.darkBorder : DS.gray200 }]}>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image" size={32} color={theme.text.muted} />
                  </View>
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoAge}>{ageMonths - i}mo</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddMeasurement}
        type={activeMetric}
        previousValue={getPreviousValue()}
      />
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
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
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
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500' },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.lg, marginTop: DS.space.md },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 9, fontWeight: '700', marginTop: 1, textTransform: 'uppercase' },
  pulseStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 13, fontWeight: '600', marginTop: 1 },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  /* Tabs */
  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* KPI */
  kpiCard: { borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, overflow: 'hidden', minHeight: 130, ...DS.shadow.sm },
  kpiIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kpiP: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  kpiPText: { fontSize: 9, fontWeight: '800' },
  kpiVal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiUnit: { fontSize: 11, fontWeight: '700' },
  kpiTitle: { fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiChange: { fontSize: 10, fontWeight: '700' },
  kpiStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
  kpiStatusDot: { width: 5, height: 5, borderRadius: 3 },
  kpiStatusText: { fontSize: 9, fontWeight: '700' },

  /* Aura card */
  auraCard: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  auraTitle: { fontSize: 14, fontWeight: '800' },
  auraSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Insight */
  insightCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden' },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  insightAction: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  insightActionText: { fontSize: 10, fontWeight: '700' },

  /* Predictor */
  predictorRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: 10 },
  predLabel: { fontSize: 12, fontWeight: '700' },
  predSub: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  predConf: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  predConfText: { fontSize: 10, fontWeight: '800' },

  /* Radar */
  radarRing: { position: 'absolute', borderWidth: 1 },
  radarPoint: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  radarDot: { width: 6, height: 6, borderRadius: 3 },
  radarLabel: { flex: 1, fontSize: 11, fontWeight: '600' },
  radarVal: { fontSize: 11, fontWeight: '800' },

  /* Heatmap */
  heatCell: { width: '100%', aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  heatVal: { fontSize: 11, fontWeight: '800' },

  /* Correlation */
  corrLabel: { fontSize: 12, fontWeight: '700' },
  corrDetail: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  corrBar: { width: 50, height: 5, borderRadius: 3, overflow: 'hidden' },
  corrFill: { height: '100%', borderRadius: 3 },
  corrVal: { fontSize: 11, fontWeight: '800', width: 32, textAlign: 'right' },

  /* Suggestions */
  suggestionCard: { width: 155, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  suggestionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  suggestionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  suggestionCat: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  suggestionMeta: { fontSize: 10, fontWeight: '500' },
  suggestionBenefit: { fontSize: 10, fontWeight: '500', lineHeight: 14, marginTop: 4 },

  /* Milestone */
  mileCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, marginBottom: 8, ...DS.shadow.sm },
  mileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mileTitle: { fontSize: 13, fontWeight: '700' },
  mileMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  mileConf: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  mileConfText: { fontSize: 10, fontWeight: '800' },

  /* Pills */
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },
  modeChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: DS.radius.full, borderWidth: 1 },

  /* Hist */
  histIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  histType: { fontSize: 13, fontWeight: '700' },
  histDate: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  histVal: { fontSize: 14, fontWeight: '800' },

  /* Velocity cards */
  velCard: { flex: 1, padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 3 },

  /* Quick actions */
  quickAct: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: DS.radius.md },
  quickActText: { color: DS.white, fontSize: 10, fontWeight: '700' },

  /* Photo */
  photoAdd: { width: '100%', aspectRatio: 1, borderRadius: DS.radius.lg, overflow: 'hidden' },
  photoAddGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddText: { color: DS.white, fontSize: 11, fontWeight: '700' },
  photoItem: { width: (SCREEN_W - 40 - 20) / 3, aspectRatio: 1, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, backgroundColor: 'rgba(0,0,0,0.4)' },
  photoAge: { color: DS.white, fontSize: 10, fontWeight: '700' },

  /* Chart */
  addDataBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: DS.radius.full },
  addDataBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.lg },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  prevBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  prevText: { fontSize: 12, fontWeight: '600' },
  inputLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '600' },
  inputMulti: { height: 76, paddingTop: 12, textAlignVertical: 'top' },
  saveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { color: DS.white, fontSize: 15, fontWeight: '700' },

  /* Empty */
  noDataTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  noDataText: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginHorizontal: 40, marginBottom: 20 },
  createBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: DS.radius.md },
  createBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});