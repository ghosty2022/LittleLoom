import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
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
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = 52;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura (matches Home / Community / More / Timeline)
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

const TRACKER_CONFIGS: Record<string, {
  emoji: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: 'essential' | 'health' | 'development' | 'care';
  subActions: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; presetData?: Record<string, unknown> }[];
}> = {
  default: { emoji: '•', color: '#94a3b8', gradient: ['#94a3b8', '#cbd5e1'], description: 'Activity', category: 'care',
    subActions: [{ id: 'default', label: 'View', icon: 'ellipse-outline', color: '#94a3b8' }] },
  feed: { emoji: '🍼', color: '#fa709a', gradient: ['#fa709a', '#f5576c'], description: 'Feeding sessions', category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solids', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ] },
  sleep: { emoji: '🌙', color: '#11998e', gradient: ['#11998e', '#38ef7d'], description: 'Sleep tracking', category: 'essential',
    subActions: [
      { id: 'nap', label: 'Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'Wake Up', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ] },
  diaper: { emoji: '👶', color: '#8B5CF6', gradient: ['#8B5CF6', '#A78BFA'], description: 'Diaper changes', category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
    ] },
  potty: { emoji: '💧', color: '#667eea', gradient: ['#667eea', '#764ba2'], description: 'Potty training', category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'dry', label: 'Dry', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ] },
  growth: { emoji: '📏', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], description: 'Growth measurements', category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ] },
  milestone: { emoji: '🏆', color: '#ffd700', gradient: ['#ffd700', '#ffaa00'], description: 'Development milestones', category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
    ] },
  medication: { emoji: '💊', color: '#ff6b6b', gradient: ['#ff6b6b', '#ee5a5a'], description: 'Health & medication', category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temp', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
    ] },
  pumping: { emoji: '🤱', color: '#ec4899', gradient: ['#ec4899', '#f472b6'], description: 'Pumping sessions', category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ] },
  bath: { emoji: '🛁', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'], description: 'Bath time', category: 'care',
    subActions: [{ id: 'bath', label: 'Log Bath', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'bath' } }] },
  tummy_time: { emoji: '🤸', color: '#10b981', gradient: ['#10b981', '#34d399'], description: 'Tummy time', category: 'development',
    subActions: [{ id: 'tummy_time', label: 'Log Tummy', icon: 'fitness-outline', color: '#10b981', presetData: { type: 'tummy_time' } }] },
  reading: { emoji: '📚', color: '#6366f1', gradient: ['#6366f1', '#818cf8'], description: 'Reading sessions', category: 'development',
    subActions: [{ id: 'reading', label: 'Log Reading', icon: 'book-outline', color: '#6366f1', presetData: { type: 'reading' } }] },
  walk: { emoji: '🚶', color: '#0ea5e9', gradient: ['#0ea5e9', '#38bdf8'], description: 'Outdoor walks', category: 'care',
    subActions: [{ id: 'walk', label: 'Log Walk', icon: 'walk-outline', color: '#0ea5e9', presetData: { type: 'walk' } }] },
  note: { emoji: '📝', color: '#64748b', gradient: ['#64748b', '#94a3b8'], description: 'Quick notes', category: 'care',
    subActions: [{ id: 'note', label: 'Add Note', icon: 'document-text-outline', color: '#64748b', presetData: { type: 'note' } }] },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981', health: '#ef4444', development: '#f59e0b', care: '#8b5cf6', custom: '#667eea',
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

const safeStr = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v));
const safeNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatTimeAgo = (ts: number): string => {
  if (!ts || typeof ts !== 'number' || isNaN(ts)) return 'just now';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(diff / 86400000);
  if (d < 7) return `${d}d ago`;
  return format(new Date(ts), 'MMM d');
};

const getDateTitle = (ts: number): string => {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (days < 7) return format(date, 'EEEE');
  return format(date, 'MMM d, yyyy');
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?' };
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?' };
  const y = differenceInYears(new Date(), birth);
  const m = differenceInMonths(new Date(), birth) % 12;
  const d = differenceInDays(new Date(), birth) % 30;
  return {
    display: y > 0 ? `${y}y ${m}m` : m > 0 ? `${m}m ${d}d` : `${d}d`,
    shortDisplay: y > 0 ? `${y}y` : m > 0 ? `${m}m` : `${d}d`,
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   useHubTheme
   ═══════════════════════════════════════════════════════════════════════════ */
const useHubTheme = () => {
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
   GradientText
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
        const color = interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo);
        return <Text key={i} style={[style, { color }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PressableScale
   ═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   SectionHeader
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, icon, color = DS.primary }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap; color?: string;
}) => {
  const theme = useHubTheme();
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
   HUB PULSE HEADER — replaces the top bar + today summary
   ═══════════════════════════════════════════════════════════════════════════ */
const HubPulseHeader = React.memo<{
  isDark: boolean;
  baby: BabyProfile | null;
  todayCount: number;
  weekCount: number;
  streak: number;
  onBabyPress: () => void;
  onAchievements: () => void;
  onTimeline: () => void;
  onAdd: () => void;
}>(({ isDark, baby, todayCount, weekCount, streak, onBabyPress, onAchievements, onTimeline, onAdd }) => {
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
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
                {baby ? (
                  <SafeBabyAvatar avatar={baby.avatar} gender={baby.gender} size={44} showBadge={false} />
                ) : (
                  <Ionicons name="add-circle" size={26} color={DS.primary} />
                )}
              </View>
            </View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby?.name || 'Add Baby'}
              </Text>
              {baby && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{age.shortDisplay}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: DS.success }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {todayCount} logged today · {weekCount} this week
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onTimeline} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="time-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAchievements} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="trophy-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
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
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{streak}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>streak</Text>
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
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Status Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */
const AuraStatusRibbon = React.memo<{
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
   Wellness — compact circular score + breakdown
   ═══════════════════════════════════════════════════════════════════════════ */
const WellnessCard = React.memo(({ entries, isDark, onPress }: { entries: any[]; isDark: boolean; onPress: () => void }) => {
  const score = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const t = entries.filter((e: any) => e?.timestamp >= today);
    const feeds = t.filter((e: any) => e.trackerId === 'feed').length;
    const sleepMins = t.filter((e: any) => e.trackerId === 'sleep').reduce((s: number, e: any) => s + (e.duration || 0), 0);
    const diapers = t.filter((e: any) => e.trackerId === 'diaper').length;
    const miles = t.filter((e: any) => e.trackerId === 'milestone').length;
    return {
      overall: Math.min(100, Math.round((feeds / 8) * 25 + (sleepMins / 840) * 25 + (diapers / 6) * 25 + (miles / 1) * 25)),
      nutrition: Math.min(100, Math.round((feeds / 8) * 100)),
      sleep: Math.min(100, Math.round((sleepMins / 840) * 100)),
      activity: Math.min(100, Math.round((miles / 3) * 100)),
      hydration: Math.min(100, Math.round((diapers / 6) * 100)),
    };
  }, [entries]);
  const color = score.overall >= 80 ? DS.success : score.overall >= 60 ? DS.primary : score.overall >= 40 ? DS.warning : DS.danger;
  const label = score.overall >= 80 ? 'Excellent' : score.overall >= 60 ? 'Good' : score.overall >= 40 ? 'Fair' : 'Needs care';

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient
            colors={[`${color}10`, `${color}02`]}
            style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.wellnessTop}>
            <View>
              <Text style={[styles.wellnessLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Today's Wellness</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <Text style={[styles.wellnessScore, { color }]}>{score.overall}</Text>
                <Text style={[styles.wellnessScoreLabel, { color }]}>{label}</Text>
              </View>
            </View>
            <View style={[styles.wellnessRing, { borderColor: `${color}30` }]}>
              <View style={[styles.wellnessRingProgress, { borderColor: color, transform: [{ rotate: `${-90 + (score.overall / 100) * 360}deg` }] }]} />
              <View style={styles.wellnessRingInner}>
                <Ionicons name={score.overall >= 80 ? 'heart' : 'heart-outline'} size={22} color={color} />
              </View>
            </View>
          </View>
          <View style={styles.wellnessBreakdown}>
            {[
              { label: 'Nutrition', value: score.nutrition, color: '#fa709a' },
              { label: 'Sleep', value: score.sleep, color: '#11998e' },
              { label: 'Activity', value: score.activity, color: '#ffd700' },
              { label: 'Hydration', value: score.hydration, color: '#3b82f6' },
            ].map((it) => (
              <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.wellnessBreakdownLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{it.label}</Text>
                <View style={[styles.wellnessBarBg, { backgroundColor: `${it.color}12` }]}>
                  <View style={[styles.wellnessBarFill, { width: `${it.value}%`, backgroundColor: it.color }]} />
                </View>
                <Text style={[styles.wellnessValue, { color: isDark ? DS.white : DS.gray900 }]}>{it.value}%</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Logs
   ═══════════════════════════════════════════════════════════════════════════ */
const QuickLogs = ({ onLog }: { onLog: (t: string, s: string) => void }) => {
  const items = [
    { t: 'feed', s: 'breast_left', label: 'Feed L', emoji: '🍼', grad: ['#fa709a', '#fee140'] as [string, string] },
    { t: 'feed', s: 'breast_right', label: 'Feed R', emoji: '🍼', grad: ['#fa709a', '#fee140'] as [string, string] },
    { t: 'sleep', s: 'nap', label: 'Nap', emoji: '😴', grad: ['#11998e', '#38ef7d'] as [string, string] },
    { t: 'diaper', s: 'wet', label: 'Wet', emoji: '👶', grad: ['#fc5c7d', '#6a82fb'] as [string, string] },
    { t: 'diaper', s: 'dirty', label: 'Dirty', emoji: '👶', grad: ['#fc5c7d', '#6a82fb'] as [string, string] },
    { t: 'pumping', s: 'both', label: 'Pump', emoji: '🤱', grad: ['#ec4899', '#f472b6'] as [string, string] },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: DS.space.sm, paddingVertical: 4 }}>
        {items.map((it, i) => (
          <PressableScale key={`${it.t}-${it.s}-${i}`} onPress={() => onLog(it.t, it.s)} activeScale={0.92}>
            <LinearGradient colors={it.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickChip}>
              <Text style={styles.quickEmoji}>{it.emoji}</Text>
              <Text style={styles.quickLabel}>{it.label}</Text>
            </LinearGradient>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Weekly Velocity
   ═══════════════════════════════════════════════════════════════════════════ */
const WeeklyVelocity = ({ entries, isDark }: { entries: any[]; isDark: boolean }) => {
  const days = useMemo(() => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = new Date();
    return labels.map((label, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      const s = startOfDay(d).getTime(); const e = s + 86400000;
      const count = entries.filter((x: any) => x?.timestamp >= s && x?.timestamp < e).length;
      return { label, count, isToday: i === 6 };
    });
  }, [entries]);
  const max = Math.max(...days.map(d => d.count), 1);
  return (
    <Animated.View entering={FadeInUp.delay(140).springify()}>
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.md }}>
          <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="pulse" size={14} color={DS.primary} />
          </View>
          <Text style={[styles.velocityTitle, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}>Weekly Velocity</Text>
          <Text style={[styles.velocitySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{entries.length} total</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
          {days.map((d, i) => {
            const h = Math.max(6, Math.round((d.count / max) * 34));
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: d.isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400 }}>{d.count || ''}</Text>
                <View style={[styles.velocityBarTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <View style={[styles.velocityBar, { height: h, backgroundColor: d.isToday ? DS.primary : `${DS.primary}50` }]} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: d.isToday ? '800' : '600', color: d.isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400 }}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Sleep Analyzer
   ═══════════════════════════════════════════════════════════════════════════ */
const SleepCard = React.memo(({ entries, isDark, onPress }: { entries: any[]; isDark: boolean; onPress: () => void }) => {
  const data = useMemo(() => {
    const list = entries.filter((e: any) => e.trackerId === 'sleep').sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 7);
    if (!list.length) return null;
    const totalHours = list.reduce((s: number, e: any) => s + (e.duration || 0), 0) / 60;
    const durations = list.map((e: any) => e.duration || 0);
    const longest = Math.max(...durations) / 60;
    const avg = totalHours / list.length;
    const wakes = list.filter((e: any) => e?.presetData?.status === 'ended').length;
    const recent = durations.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
    const older = durations.slice(3, 6).reduce((a: number, b: number) => a + b, 0) / Math.max(1, Math.min(3, durations.length - 3));
    const trend = recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';
    const score = Math.min(100, Math.round((avg / 14) * 40 + (longest / 6) * 30 + (1 - Math.min(wakes / 5, 1)) * 30));
    return { score, totalHours: Math.round(totalHours * 10) / 10, longest: Math.round(longest * 10) / 10, wakes, trend };
  }, [entries]);
  if (!data) return null;
  const color = data.score >= 70 ? DS.success : data.score >= 50 ? DS.warning : DS.danger;
  const trendColor = data.trend === 'up' ? DS.success : data.trend === 'down' ? DS.danger : DS.gray400;
  return (
    <Animated.View entering={FadeInUp.delay(180).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="moon" size={14} color={DS.primary} />
              </View>
              <Text style={[styles.sleepTitle, { color: isDark ? DS.white : DS.gray900 }]}>Sleep Quality</Text>
            </View>
            <View style={[styles.sleepScorePill, { backgroundColor: `${color}15` }]}>
              <Text style={[styles.sleepScorePillText, { color }]}>{data.score}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{data.totalHours}h</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Total</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{data.longest}h</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Best</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{data.wakes}</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Wakes</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={data.trend === 'up' ? 'arrow-up' : data.trend === 'down' ? 'arrow-down' : 'remove'} size={16} color={trendColor} />
              <Text style={[styles.sleepMetricLbl, { color: trendColor }]}>
                {data.trend === 'up' ? 'Improving' : data.trend === 'down' ? 'Declining' : 'Stable'}
              </Text>
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Feeding Pattern
   ═══════════════════════════════════════════════════════════════════════════ */
const FeedingCard = React.memo(({ entries, isDark, onPress }: { entries: any[]; isDark: boolean; onPress: () => void }) => {
  const pattern = useMemo(() => {
    const list = entries.filter((e: any) => e.trackerId === 'feed' && e?.timestamp).sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 10);
    if (list.length < 2) return null;
    const intervals: number[] = [];
    for (let i = 0; i < list.length - 1; i++) {
      const diff = (list[i].timestamp - list[i + 1].timestamp) / 3600000;
      if (diff > 0 && diff < 12) intervals.push(diff);
    }
    const avg = intervals.length ? Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10 : 3;
    const last = list[0];
    const side = last?.presetData?.side === 'right' ? 'Right' : last?.presetData?.feedType === 'bottle' ? 'Bottle' : last?.presetData?.feedType === 'solid' ? 'Solids' : 'Left';
    let next = '--:--';
    try { next = format(new Date(last.timestamp + avg * 3600000), 'h:mm a'); } catch {}
    return { avg, side, next, count: list.length };
  }, [entries]);
  if (!pattern) return null;
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
              <View style={[styles.sectionIcon, { backgroundColor: '#fa709a18' }]}>
                <Ionicons name="restaurant" size={14} color="#fa709a" />
              </View>
              <Text style={[styles.sleepTitle, { color: isDark ? DS.white : DS.gray900 }]}>Feeding Pattern</Text>
            </View>
            <View style={[styles.sleepScorePill, { backgroundColor: '#fa709a18' }]}>
              <Text style={[styles.sleepScorePillText, { color: '#fa709a' }]}>~{pattern.next}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{pattern.side}</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Last</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{pattern.avg}h</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Avg gap</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.sleepMetricVal, { color: isDark ? DS.white : DS.gray900 }]}>{pattern.count}</Text>
              <Text style={[styles.sleepMetricLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Recent</Text>
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Weekly Strip
   ═══════════════════════════════════════════════════════════════════════════ */
const WeeklyStrip = React.memo(({ entries, isDark, onDayPress }: { entries: any[]; isDark: boolean; onDayPress: () => void }) => {
  const days = useMemo(() => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = new Date();
    return labels.map((label, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      const s = startOfDay(d).getTime(); const e = s + 86400000;
      const dayE = entries.filter((x: any) => x?.timestamp >= s && x?.timestamp < e);
      const top = Object.entries(dayE.reduce((acc: any, x: any) => {
        acc[x.trackerId] = (acc[x.trackerId] || 0) + 1; return acc;
      }, {})).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3);
      return { label, date: d.getDate(), total: dayE.length, top, isToday: i === 6 };
    });
  }, [entries]);
  return (
    <Animated.View entering={FadeInUp.delay(220).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
        {days.map((d, i) => (
          <PressableScale key={i} onPress={onDayPress} activeScale={0.94}>
            <View style={[styles.weekDay, { backgroundColor: d.isToday ? `${DS.primary}15` : isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: d.isToday ? DS.primary : isDark ? DS.darkBorder : DS.gray200, borderWidth: d.isToday ? 1.5 : 1 }]}>
              <Text style={[styles.weekDayName, { color: d.isToday ? DS.primary : isDark ? DS.gray400 : DS.gray500 }]}>{d.label}</Text>
              <Text style={[styles.weekDayNum, { color: d.isToday ? DS.primary : isDark ? DS.white : DS.gray900 }]}>{d.date}</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {d.top.map(([tid], j) => (
                  <View key={j} style={[styles.weekDot, { backgroundColor: TRACKER_CONFIGS[tid]?.color || DS.primary }]} />
                ))}
                {d.total === 0 && <View style={[styles.weekDot, { backgroundColor: isDark ? DS.gray700 : DS.gray200 }]} />}
              </View>
              <Text style={[styles.weekTotal, { color: d.isToday ? DS.primary : isDark ? DS.gray500 : DS.gray400 }]}>{d.total}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Emergency Quick Actions
   ═══════════════════════════════════════════════════════════════════════════ */
const EmergencyRow = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: (t: string) => void }) => {
  const actions = [
    { id: 'fever', label: 'Fever', icon: 'thermometer-outline' as const, color: DS.danger, grad: ['#ef4444', '#dc2626'] as [string, string] },
    { id: 'medicine', label: 'Medicine', icon: 'medical-outline' as const, color: DS.warning, grad: ['#f59e0b', '#d97706'] as [string, string] },
    { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline' as const, color: '#8b5cf6', grad: ['#8b5cf6', '#7c3aed'] as [string, string] },
    { id: 'doctor', label: 'Call Dr.', icon: 'call-outline' as const, color: DS.success, grad: ['#10b981', '#059669'] as [string, string] },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(240).springify()}>
      <View style={{ flexDirection: 'row', paddingHorizontal: DS.space.lg, gap: 8 }}>
        {actions.map((a) => (
          <PressableScale key={a.id} onPress={() => onPress(a.id)} activeScale={0.94} style={{ flex: 1 }}>
            <View style={[styles.emergencyBtn, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${a.color}15`, `${a.color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.emergencyIcon, { backgroundColor: `${a.color}18` }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.emergencyLabel, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>{a.label}</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Predictions
   ═══════════════════════════════════════════════════════════════════════════ */
const PredictionsRow = React.memo(({ entries, isDark, onPress }: { entries: any[]; isDark: boolean; onPress: (t: string, s: string) => void }) => {
  const preds = useMemo(() => {
    const now = Date.now();
    const out: any[] = [];
    const feeds = entries.filter(e => e.trackerId === 'feed').sort((a, b) => b.timestamp - a.timestamp);
    if (feeds.length >= 2) {
      const gap = (feeds[0].timestamp - feeds[Math.min(3, feeds.length - 1)].timestamp) / Math.min(3, feeds.length - 1);
      const next = feeds[0].timestamp + gap;
      const dueIn = Math.max(0, Math.floor((next - now) / 60000));
      if (dueIn < 180) out.push({ id: 'feed', t: 'feed', s: 'breast_left', label: 'Next Feed', emoji: '🍼', color: '#fa709a', dueIn, time: format(new Date(next), 'h:mm a'), confidence: Math.min(95, 60 + feeds.length * 5) });
    }
    const sleeps = entries.filter(e => e.trackerId === 'sleep').sort((a, b) => b.timestamp - a.timestamp);
    if (sleeps.length >= 2) {
      const next = sleeps[0].timestamp + (sleeps[0].duration || 180) * 60000;
      const dueIn = Math.max(0, Math.floor((next - now) / 60000));
      if (dueIn < 240) out.push({ id: 'sleep', t: 'sleep', s: 'nap', label: 'Next Sleep', emoji: '😴', color: '#11998e', dueIn, time: format(new Date(next), 'h:mm a'), confidence: Math.min(90, 50 + sleeps.length * 4) });
    }
    const diapers = entries.filter(e => e.trackerId === 'diaper').sort((a, b) => b.timestamp - a.timestamp);
    if (diapers.length >= 2) {
      const gap = (diapers[0].timestamp - diapers[Math.min(5, diapers.length - 1)].timestamp) / Math.min(5, diapers.length - 1);
      const next = diapers[0].timestamp + gap;
      const dueIn = Math.max(0, Math.floor((next - now) / 60000));
      if (dueIn < 120) out.push({ id: 'diaper', t: 'diaper', s: 'wet', label: 'Next Diaper', emoji: '👶', color: '#8B5CF6', dueIn, time: format(new Date(next), 'h:mm a'), confidence: Math.min(85, 55 + diapers.length * 3) });
    }
    return out.sort((a, b) => a.dueIn - b.dueIn).slice(0, 3);
  }, [entries]);
  if (!preds.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(260).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {preds.map((p) => (
          <PressableScale key={p.id} onPress={() => onPress(p.t, p.s)} activeScale={0.94}>
            <View style={[styles.predCard, { borderColor: `${p.color}40`, backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <LinearGradient colors={[`${p.color}10`, `${p.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                <View style={[styles.predConf, { backgroundColor: `${p.color}18` }]}>
                  <Text style={[styles.predConfText, { color: p.color }]}>{p.confidence}%</Text>
                </View>
              </View>
              <Text style={[styles.predLabel, { color: isDark ? DS.white : DS.gray900 }]}>{p.label}</Text>
              <Text style={[styles.predTime, { color: p.color }]}>
                {p.dueIn === 0 ? 'Due now!' : p.dueIn < 60 ? `In ${p.dueIn}m` : `In ${Math.floor(p.dueIn / 60)}h`}
              </Text>
              <Text style={[styles.predSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>~{p.time}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Daily Goals
   ═══════════════════════════════════════════════════════════════════════════ */
const DailyGoals = React.memo(({ entries, baby, isDark, onPress }: { entries: any[]; baby: BabyProfile | null; isDark: boolean; onPress: (t: string) => void }) => {
  const goals = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const t = entries.filter((e: any) => e?.timestamp >= today);
    const ageMonths = (() => {
      const dob = baby?.birthDate ? new Date(baby.birthDate) : null;
      if (!dob || isNaN(dob.getTime())) return 0;
      const now = new Date();
      return Math.max(0, (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth()));
    })();
    const feedTarget = ageMonths < 3 ? 8 : ageMonths < 6 ? 6 : ageMonths < 12 ? 5 : 4;
    const sleepTarget = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    const diaperTarget = ageMonths < 3 ? 8 : ageMonths < 6 ? 7 : ageMonths < 12 ? 6 : 5;
    return [
      { id: 'feed-goal', label: 'Feeds', emoji: '🍼', target: feedTarget, current: t.filter(e => e.trackerId === 'feed').length, color: '#fa709a' },
      { id: 'sleep-goal', label: 'Sleep', emoji: '🌙', target: sleepTarget, current: Math.floor(t.filter(e => e.trackerId === 'sleep').reduce((s: number, e: any) => s + (e.duration || 0), 0) / 3600), color: '#11998e' },
      { id: 'diaper-goal', label: 'Diapers', emoji: '👶', target: diaperTarget, current: t.filter(e => e.trackerId === 'diaper').length, color: '#8B5CF6' },
      { id: 'milestone-goal', label: 'Moments', emoji: '🏆', target: 1, current: t.filter(e => e.trackerId === 'milestone').length, color: '#ffd700' },
    ];
  }, [entries, baby?.birthDate]);
  const complete = goals.filter(g => g.current >= g.target).length;
  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DS.space.lg }}>
        {goals.map(g => {
          const pct = Math.min(g.current / g.target, 1);
          const done = g.current >= g.target;
          return (
            <PressableScale key={g.id} onPress={() => onPress(g.id.split('-')[0])} activeScale={0.94} style={{ flex: 1 }}>
              <View style={[styles.goalCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <LinearGradient colors={[`${g.color}10`, `${g.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                  {done && <Ionicons name="checkmark-circle" size={14} color={DS.success} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                  <Text style={[styles.goalVal, { color: isDark ? DS.white : DS.gray900 }]}>{g.current}</Text>
                  <Text style={[styles.goalTotal, { color: isDark ? DS.gray500 : DS.gray400 }]}>/{g.target}</Text>
                </View>
                <Text style={[styles.goalLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>{g.label}</Text>
                <View style={[styles.goalBarBg, { backgroundColor: `${g.color}12` }]}>
                  <View style={[styles.goalBarFill, { width: `${pct * 100}%`, backgroundColor: done ? DS.success : g.color }]} />
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Insights
   ═══════════════════════════════════════════════════════════════════════════ */
const InsightsCarousel = React.memo(({ entries, baby, isDark, onPress }: { entries: any[]; baby: BabyProfile | null; isDark: boolean; onPress: (s: any) => void }) => {
  const items = useMemo(() => {
    if (!baby) return [];
    const out: any[] = [];
    const now = Date.now();
    const today = startOfDay(new Date()).getTime();
    const t = entries.filter((e: any) => e?.timestamp >= today);
    const feeds = entries.filter((e: any) => e.trackerId === 'feed').sort((a: any, b: any) => b.timestamp - a.timestamp);
    if (feeds.length >= 2) {
      const gap = (feeds[0].timestamp - feeds[1].timestamp) / 3600000;
      if (gap > 4) out.push({ id: 'feed-gap', title: 'Long gap between feeds', desc: `${Math.floor(gap)}h since last feed`, emoji: '⏰', color: DS.warning, action: { screen: 'AddEntry', params: { trackerId: 'feed' } }, timestamp: now });
    }
    const sleepMins = t.filter((e: any) => e.trackerId === 'sleep').reduce((s: number, e: any) => s + (e.duration || 0), 0);
    const ageMonths = differenceInMonths(new Date(), new Date(baby.birthDate));
    const expected = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    if (sleepMins > 0 && sleepMins / 60 < expected * 0.7) out.push({ id: 'low-sleep', title: 'Sleep looks low', desc: `${Math.floor(sleepMins / 60)}h vs ~${expected}h target`, emoji: '😴', color: DS.primary, action: { screen: 'AddEntry', params: { trackerId: 'sleep' } }, timestamp: now });
    const days = new Set(entries.map((e: any) => format(new Date(e.timestamp), 'yyyy-MM-dd'))).size;
    if (days >= 7) out.push({ id: 'streak', title: `${days}-day streak!`, desc: 'Consistency builds better predictions', emoji: '🔥', color: DS.warning, action: { screen: 'Timeline' }, timestamp: now });
    return out.slice(0, 3);
  }, [entries, baby]);
  if (!items.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {items.map((i) => (
          <PressableScale key={i.id} onPress={() => onPress(i)} activeScale={0.94}>
            <View style={[styles.insightCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderLeftColor: i.color, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${i.color}10`, `${i.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Text style={{ fontSize: 20, marginBottom: 6 }}>{i.emoji}</Text>
              <Text style={[styles.insightTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{i.title}</Text>
              <Text style={[styles.insightDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{i.desc}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Tracker Cards — horizontal grouped by category
   ═══════════════════════════════════════════════════════════════════════════ */
const TrackerGrid = React.memo(({ cards, pinnedIds, hiddenIds, isDark, onPress, onPin, onCustom, onBrowse, onShowHidden }: {
  cards: any[]; pinnedIds: string[]; hiddenIds: string[]; isDark: boolean;
  onPress: (id: string, hasSub: boolean) => void;
  onPin: (id: string) => void;
  onCustom: () => void;
  onBrowse: () => void;
  onShowHidden: () => void;
}) => {
  const visible = useMemo(() => cards.filter(c => !hiddenIds.includes(c.id)), [cards, hiddenIds]);
  const pinned = useMemo(() => visible.filter(c => pinnedIds.includes(c.id)), [visible, pinnedIds]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    visible.forEach(c => { if (!pinnedIds.includes(c.id) && c.category) set.add(c.category); });
    return [...set];
  }, [visible, pinnedIds]);

  const renderCard = (c: any, isPinned: boolean) => (
    <PressableScale key={c.id} onPress={() => onPress(c.id, c.hasSubActions)} activeScale={0.94}>
      <TouchableOpacity
        onLongPress={() => onPin(c.id)}
        activeOpacity={0.9}
        style={styles.trackerCard}
      >
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: DS.radius.lg }]} />
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 26 }}>{c.emoji}</Text>
            {isPinned && <Ionicons name="pin" size={14} color="#fff" />}
          </View>
          <View>
            <Text style={styles.trackerTitle} numberOfLines={1}>{c.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.trackerCount}>{c.count} logs</Text>
              {c.lastEntry && <Text style={styles.trackerLast}>· {c.lastEntry}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </PressableScale>
  );

  return (
    <Animated.View entering={FadeInUp.delay(340).springify()}>
      <SectionHeader title="Trackers" subtitle={`${visible.length} active${hiddenIds.length ? ` · ${hiddenIds.length} hidden` : ''}`} icon="grid-outline" action={onBrowse} actionLabel="Browse" />

      {hiddenIds.length > 0 && (
        <TouchableOpacity onPress={onShowHidden} style={[styles.hiddenBanner, { backgroundColor: `${DS.primary}10` }]} activeOpacity={0.8}>
          <Ionicons name="eye-off-outline" size={16} color={DS.primary} />
          <Text style={[styles.hiddenBannerText, { color: DS.primary }]}>{hiddenIds.length} hidden — tap to manage</Text>
          <Ionicons name="chevron-forward" size={16} color={DS.primary} />
        </TouchableOpacity>
      )}

      {pinned.length > 0 && (
        <View style={{ marginBottom: DS.space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: DS.space.lg, marginBottom: 8 }}>
            <Ionicons name="pin" size={12} color={DS.primary} />
            <Text style={[styles.catLabel, { color: DS.primary }]}>Pinned</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10 }}>
            {pinned.map(c => renderCard(c, true))}
          </ScrollView>
        </View>
      )}

      {categories.map(cat => {
        const items = visible.filter(c => c.category === cat && !pinnedIds.includes(c.id));
        if (!items.length) return null;
        return (
          <View key={cat} style={{ marginBottom: DS.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: DS.space.lg, marginBottom: 8 }}>
              <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] || DS.primary }]} />
              <Text style={[styles.catLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10 }}>
              {items.map(c => renderCard(c, false))}
            </ScrollView>
          </View>
        );
      })}

      <PressableScale onPress={onCustom} activeScale={0.98} style={{ marginHorizontal: DS.space.lg, marginTop: DS.space.md }}>
        <View style={[styles.customBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient colors={[`${DS.primary}10`, `${DS.primary}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={[styles.customIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="add" size={20} color={DS.primary} />
          </View>
          <Text style={[styles.customText, { color: DS.primary }]}>Create Custom Tracker</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Recent Activity
   ═══════════════════════════════════════════════════════════════════════════ */
const RecentActivity = React.memo(({ entries, isDark, onViewAll, onEntryPress }: {
  entries: any[]; isDark: boolean; onViewAll: () => void; onEntryPress: (e: any) => void;
}) => {
  const groups = useMemo(() => {
    const sorted = [...entries].filter(e => e?.timestamp).sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
    const out: { title: string; date: Date; events: any[] }[] = [];
    let cur: any = null;
    sorted.forEach(e => {
      const ed = new Date(e.timestamp);
      if (!cur || !isSameDay(cur.date, ed)) { cur = { title: getDateTitle(e.timestamp), date: ed, events: [] }; out.push(cur); }
      cur.events.push(e);
    });
    return out;
  }, [entries]);

  if (!groups.length) {
    return (
      <Animated.View entering={FadeInUp.delay(360).springify()}>
        <SectionHeader title="Recent Activity" icon="time-outline" />
        <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
            <Ionicons name="time-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No activity yet</Text>
          <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Log your first entry to start tracking</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(360).springify()}>
      <SectionHeader title="Recent Activity" subtitle={`${entries.length} total`} icon="time-outline" action={onViewAll} actionLabel="Timeline" />
      <View style={{ paddingHorizontal: DS.space.lg }}>
        {groups.map((g, gi) => (
          <View key={gi} style={{ marginBottom: DS.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: DS.space.sm }}>
              <Text style={[styles.groupTitle, { color: isDark ? DS.white : DS.gray900 }]}>{g.title}</Text>
              <View style={[styles.groupBadge, { backgroundColor: `${DS.primary}18` }]}>
                <Text style={[styles.groupBadgeText, { color: DS.primary }]}>{g.events.length}</Text>
              </View>
            </View>
            {g.events.map((e, ei) => {
              const cfg = TRACKER_CONFIGS[e?.trackerId] || TRACKER_CONFIGS.default;
              const color = cfg.color;
              return (
                <PressableScale key={e?.id || ei} onPress={() => onEntryPress(e)} activeScale={0.98}>
                  <View style={[styles.eventCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, borderLeftColor: color }]}>
                    <View style={[styles.eventIcon, { backgroundColor: `${color}15` }]}>
                      <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                        {e?.title || cfg.description}
                      </Text>
                      <Text style={[styles.eventMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {e?.timestamp ? format(e.timestamp, 'h:mm a') : ''}{e?.loggedByName ? ` · ${e.loggedByName}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Links
   ═══════════════════════════════════════════════════════════════════════════ */
const QuickLinks = ({ isDark, onNavigate }: { isDark: boolean; onNavigate: (screen: string) => void }) => {
  const links = [
    { label: 'Growth', icon: 'trending-up-outline' as const, screen: 'GrowthDashboard', color: '#43e97b' },
    { label: 'Gallery', icon: 'images-outline' as const, screen: 'Gallery', color: '#10b981' },
    { label: 'Family', icon: 'people-outline' as const, screen: 'FamilySharing', color: '#8b5cf6' },
    { label: 'Report', icon: 'document-text-outline' as const, screen: 'PediatricianPDFExport', color: '#ef4444' },
    { label: 'Settings', icon: 'settings-outline' as const, screen: 'BackupRestore', color: '#64748b' },
    { label: 'Achieve', icon: 'trophy-outline' as const, screen: 'Achievements', color: DS.warning },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Quick Links" icon="link-outline" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: DS.space.lg }}>
        {links.map(l => (
          <PressableScale key={l.label} onPress={() => onNavigate(l.screen)} activeScale={0.94} style={{ width: (SCREEN_WIDTH - 40 - 20) / 3 }}>
            <View style={[styles.quickLink, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${l.color}12`, `${l.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.quickLinkIcon, { backgroundColor: `${l.color}18` }]}>
                <Ionicons name={l.icon} size={20} color={l.color} />
              </View>
              <Text style={[styles.quickLinkLabel, { color: isDark ? DS.gray300 : DS.gray700 }]}>{l.label}</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Modals
   ═══════════════════════════════════════════════════════════════════════════ */
const TrackerActionModal = React.memo(({ visible, trackerId, onClose, onSelect }: {
  visible: boolean; trackerId: string | null; onClose: () => void;
  onSelect: (t: string, s: any) => void;
}) => {
  const { isDark } = useCustomization();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); opacity.value = withTiming(1, { duration: 280 }); }
    else { scale.value = withTiming(0.95, { duration: 200 }); opacity.value = withTiming(0, { duration: 200 }); }
  }, [visible, scale, opacity]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible || !trackerId) return null;
  const cfg = TRACKER_CONFIGS[trackerId] || TRACKER_CONFIGS.default;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.actionModal, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <LinearGradient colors={cfg.gradient} style={styles.actionModalHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 4 }}>{cfg.emoji}</Text>
              <Text style={styles.actionModalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={styles.actionModalDesc}>{cfg.description}</Text>
            </View>
            <TouchableOpacity style={styles.actionModalClose} onPress={onClose}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
          <View style={{ padding: 14 }}>
            <Text style={[styles.actionModalSection, { color: isDark ? DS.gray400 : DS.gray500 }]}>CHOOSE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
              {cfg.subActions.map((a, i) => (
                <Animated.View key={a.id} entering={FadeInUp.delay(i * 60).springify()} style={{ width: '50%', padding: 6 }}>
                  <PressableScale onPress={() => onSelect(trackerId, a)} activeScale={0.94}>
                    <View style={[styles.actionTile, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: `${a.color}40` }]}>
                      <View style={[styles.actionTileIcon, { backgroundColor: `${a.color}18` }]}>
                        <Ionicons name={a.icon} size={24} color={a.color} />
                      </View>
                      <Text style={[styles.actionTileLabel, { color: isDark ? DS.white : DS.gray900 }]}>{a.label}</Text>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const HiddenTrackersModal = React.memo(({ visible, hidden, onClose, onUnhide, isDark }: {
  visible: boolean; hidden: any[]; onClose: () => void; onUnhide: (id: string) => void; isDark: boolean;
}) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); opacity.value = withTiming(1, { duration: 280 }); }
    else { scale.value = withTiming(0.95); opacity.value = withTiming(0); }
  }, [visible]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.hiddenModal, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={{ padding: 20, alignItems: 'center', position: 'relative' }}>
            <Text style={[styles.hiddenModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Hidden Trackers</Text>
            <Text style={[styles.hiddenModalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{hidden.length} hidden</Text>
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 16, right: 16, padding: 4 }}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400, paddingHorizontal: 16 }}>
            {hidden.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Ionicons name="eye-off-outline" size={40} color={isDark ? DS.gray500 : DS.gray400} />
                <Text style={{ marginTop: 8, color: isDark ? DS.gray400 : DS.gray500 }}>No hidden trackers</Text>
              </View>
            ) : hidden.map(t => (
              <View key={t.id} style={[styles.hiddenRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                  <View>
                    <Text style={[styles.hiddenName, { color: isDark ? DS.white : DS.gray900 }]}>{t.title}</Text>
                    <Text style={[styles.hiddenCat, { color: isDark ? DS.gray400 : DS.gray500 }]}>{t.category}</Text>
                  </View>
                </View>
                <PressableScale onPress={() => onUnhide(t.id)} activeScale={0.94}>
                  <View style={[styles.hiddenUnhide, { backgroundColor: `${DS.primary}15` }]}>
                    <Ionicons name="eye-outline" size={14} color={DS.primary} />
                    <Text style={[styles.hiddenUnhideText, { color: DS.primary }]}>Show</Text>
                  </View>
                </PressableScale>
              </View>
            ))}
          </ScrollView>
          <PressableScale onPress={onClose} activeScale={0.97} style={{ margin: 16 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.hiddenDone}>
              <Text style={styles.hiddenDoneText}>Done</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

const BabyRequiredModal = React.memo(({ visible, onClose, onCreate, isDark }: {
  visible: boolean; onClose: () => void; onCreate: () => void; isDark: boolean;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <View style={[styles.babyReq, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
        <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqIcon}>
          <Ionicons name="people-outline" size={28} color={DS.white} />
        </LinearGradient>
        <Text style={[styles.babyReqTitle, { color: isDark ? DS.white : DS.gray900 }]}>Baby Profile Needed</Text>
        <Text style={[styles.babyReqDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Create a baby profile to start tracking activities and unlock all features.
        </Text>
        <PressableScale onPress={onCreate} activeScale={0.97} style={{ width: '100%' }}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqBtn}>
            <Text style={styles.babyReqBtnText}>Create Baby Profile</Text>
            <Ionicons name="arrow-forward" size={16} color={DS.white} />
          </LinearGradient>
        </PressableScale>
        <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  </Modal>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark, triggerHaptic, borderRadiusValue } = useCustomization();
  const tracker = useTracker();
  const { entries, getEntries, trackers } = tracker;
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError } = useSweetAlert();
  const achievements = useTrackerAchievements();

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showBabyRequired, setShowBabyRequired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const initRef = useRef(false);
  const babyRef = useRef(currentBaby);
  babyRef.current = currentBaby;

  useEffect(() => {
    if (!babyLoading && !currentBaby) {
      const t = setTimeout(() => setShowBabyRequired(true), 500);
      return () => clearTimeout(t);
    }
  }, [babyLoading, currentBaby]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      setIsRefreshing(true);
      try {
        await loadBabies();
        const [p, h] = await Promise.all([
          AsyncStorage.getItem('@littleloom_pinned_trackers'),
          AsyncStorage.getItem('@littleloom_hidden_trackers'),
        ]);
        if (p) setPinnedIds(JSON.parse(p));
        if (h) setHiddenIds(JSON.parse(h));
      } catch { showError('Error', 'Failed to load data'); }
      finally { setIsRefreshing(false); }
    })();
  }, [loadBabies, showError]);

  useEffect(() => { AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedIds)).catch(() => {}); }, [pinnedIds]);
  useEffect(() => { AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenIds)).catch(() => {}); }, [hiddenIds]);

  useEffect(() => {
    const tick = async () => { if (babyRef.current) await refreshCurrentBaby(); };
    tick();
    const int = setInterval(tick, 60000);
    return () => clearInterval(int);
  }, [refreshCurrentBaby]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const todayE = entries.filter((e: any) => e?.timestamp >= today);
    const weekAgo = today - 6 * 86400000;
    const weekE = entries.filter((e: any) => e?.timestamp >= weekAgo);
    const days = new Set(entries.filter((e: any) => e?.timestamp).map((e: any) => {
      const d = new Date(e.timestamp); d.setHours(0, 0, 0, 0); return String(d.getTime());
    }));
    let streak = 0;
    let cur = today;
    while (days.has(String(cur))) { streak++; cur -= 86400000; }
    return { todayCount: todayE.length, weekCount: weekE.length, streak };
  }, [entries]);

  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    const src = trackers?.length > 0 ? trackers : Object.keys(TRACKER_CONFIGS).map(id => ({
      id, name: id.charAt(0).toUpperCase() + id.slice(1),
      emoji: TRACKER_CONFIGS[id].emoji, color: TRACKER_CONFIGS[id].color,
      gradient: TRACKER_CONFIGS[id].gradient, category: TRACKER_CONFIGS[id].category,
    }));
    return src.map((t: any) => {
      const cfg = TRACKER_CONFIGS[t.id];
      const list = getEntries(t.id);
      const last = list[0];
      return {
        id: t.id,
        title: t.name || cfg?.description || t.id,
        emoji: t.emoji || cfg?.emoji || '📋',
        color: t.color || cfg?.color || DS.primary,
        gradient: (t.gradient || cfg?.gradient || [DS.primary, DS.accent]) as [string, string],
        category: cfg?.category || 'essential',
        count: list.length,
        lastEntry: last ? format(last.timestamp, 'h:mm a') : undefined,
        hasSubActions: !!cfg?.subActions?.length,
      };
    });
  }, [trackers, getEntries, currentBaby]);

  const topRibbon = useMemo(() => {
    if (stats.todayCount === 0) return { icon: 'sunny-outline' as const, color: DS.primary, label: 'Start', text: 'Log your first entry of the day', onPress: () => setShowActionModal(true) };
    if (stats.streak >= 7) return { icon: 'flame' as const, color: DS.warning, label: 'Streak', text: `${stats.streak}-day streak going strong`, onPress: () => navigation.navigate('Achievements') };
    return { icon: 'sparkles' as const, color: DS.success, label: 'Tracking', text: `${stats.todayCount} entries logged today — great rhythm`, onPress: () => navigation.navigate('Timeline') };
  }, [stats, navigation]);

  const handleTrackerPress = useCallback((id: string, hasSub: boolean) => {
    if (hasSub) { setSelectedTrackerId(id); setShowActionModal(true); }
    else navigation.navigate('AddEntry', { trackerId: id });
  }, [navigation]);

  const handleSelect = useCallback((tid: string, a: any) => {
    setShowActionModal(false);
    setTimeout(() => navigation.navigate('AddEntry', { trackerId: tid, presetData: a.presetData }), 100);
  }, [navigation]);

  const handleQuickLog = useCallback((tid: string, sid: string) => {
    const cfg = TRACKER_CONFIGS[tid];
    const a = cfg?.subActions.find(x => x.id === sid);
    if (a) handleSelect(tid, a);
  }, [handleSelect]);

  const handlePin = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleUnhide = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.filter(x => x !== id));
    showSuccess('Restored', 'Tracker is back on your list');
  }, [showSuccess]);

  const handleEmergency = useCallback((type: string) => {
    HAPTIC_MEDIUM();
    switch (type) {
      case 'fever': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'temperature' } }); break;
      case 'medicine': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'medicine' } }); break;
      case 'symptom': navigation.navigate('AddEntry', { trackerId: 'medication', presetData: { type: 'symptom' } }); break;
      case 'doctor': navigation.navigate('SafetyCorner'); break;
    }
  }, [navigation]);

  const handleEntryPress = useCallback((e: any) => {
    if (!e?.id) return;
    navigation.navigate('EntryDetail', { entryId: e.id, trackerId: e.trackerId });
  }, [navigation]);

  const handleInsightPress = useCallback((i: any) => {
    if (i?.action?.screen) navigation.navigate(i.action.screen, i.action.params);
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await loadBabies(); await refreshCurrentBaby(); } catch {}
    finally { setIsRefreshing(false); }
  }, [loadBabies, refreshCurrentBaby]);

  const hiddenCards = useMemo(() => trackerCards.filter(t => hiddenIds.includes(t.id)), [trackerCards, hiddenIds]);

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.navigate('Timeline')} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="time-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              HUB
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {safeStr(currentBaby?.name, 'Your baby')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Achievements')} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="trophy-outline" size={20} color={isDark ? DS.white : DS.gray800} />
            {achievements?.stats?.unlocked > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{achievements.stats.unlocked}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
      >
        {/* Pulse Header */}
        <HubPulseHeader
          isDark={isDark}
          baby={currentBaby}
          todayCount={stats.todayCount}
          weekCount={stats.weekCount}
          streak={stats.streak}
          onBabyPress={() => babies.length > 1 ? navigation.navigate('SwitchBaby', { returnTo: 'UniversalTrackerHub', returnLabel: 'Hub' }) : navigation.navigate('CreateBabyProfile')}
          onAchievements={() => navigation.navigate('Achievements')}
          onTimeline={() => navigation.navigate('Timeline')}
          onAdd={() => navigation.navigate('AddEntry' as never)}
        />

        {/* Insight ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraStatusRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Quick Logs */}
        <View style={{ marginTop: DS.space.md }}>
          <QuickLogs onLog={handleQuickLog} />
        </View>

        {/* Wellness */}
        <View style={{ marginTop: DS.space.md }}>
          <WellnessCard entries={entries} isDark={isDark} onPress={() => navigation.navigate('GrowthDashboard')} />
        </View>

        {/* Weekly Velocity */}
        <View style={{ marginTop: DS.space.md }}>
          <WeeklyVelocity entries={entries} isDark={isDark} />
        </View>

        {/* Sleep & Feeding split */}
        <View style={{ marginTop: DS.space.md }}>
          <SleepCard entries={entries} isDark={isDark} onPress={() => navigation.navigate('Timeline', { type: 'sleep' })} />
        </View>
        <View style={{ marginTop: DS.space.md }}>
          <FeedingCard entries={entries} isDark={isDark} onPress={() => navigation.navigate('Timeline', { type: 'feed' })} />
        </View>

        {/* Weekly strip */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader title="This Week" subtitle="Tap a day to explore" icon="calendar-outline" />
          <WeeklyStrip entries={entries} isDark={isDark} onDayPress={() => navigation.navigate('Timeline')} />
        </View>

        {/* Emergency */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader title="Emergency" subtitle="One-tap logging" icon="flash-outline" color={DS.danger} />
          <EmergencyRow isDark={isDark} onPress={handleEmergency} />
        </View>

        {/* Predictions */}
        {entries.length >= 2 && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Up Next" subtitle="Predicted from patterns" icon="time-outline" color={DS.warning} />
            <PredictionsRow entries={entries} isDark={isDark} onPress={handleQuickLog} />
          </View>
        )}

        {/* Goals */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader title="Daily Goals" subtitle={currentBaby ? 'Age-adjusted targets' : 'Set up a profile'} icon="trophy-outline" color={DS.success} />
          <DailyGoals entries={entries} baby={currentBaby} isDark={isDark} onPress={(t) => handleTrackerPress(t, true)} />
        </View>

        {/* Insights */}
        {currentBaby && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Smart Insights" subtitle="Personalized for you" icon="sparkles-outline" color={DS.accent} />
            <InsightsCarousel entries={entries} baby={currentBaby} isDark={isDark} onPress={handleInsightPress} />
          </View>
        )}

        {/* Trackers */}
        <View style={{ marginTop: DS.space.lg }}>
          <TrackerGrid
            cards={trackerCards}
            pinnedIds={pinnedIds}
            hiddenIds={hiddenIds}
            isDark={isDark}
            onPress={handleTrackerPress}
            onPin={handlePin}
            onCustom={() => navigation.navigate('CreateCustomTracker')}
            onBrowse={() => navigation.navigate('AllTrackers')}
            onShowHidden={() => setShowHidden(true)}
          />
        </View>

        {/* Recent */}
        <View style={{ marginTop: DS.space.lg }}>
          <RecentActivity
            entries={entries}
            isDark={isDark}
            onViewAll={() => navigation.navigate('Timeline')}
            onEntryPress={handleEntryPress}
          />
        </View>

        {/* Quick Links */}
        <View style={{ marginTop: DS.space.lg }}>
          <QuickLinks isDark={isDark} onNavigate={(s) => navigation.navigate(s as any)} />
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Modals */}
      <TrackerActionModal
        visible={showActionModal}
        trackerId={selectedTrackerId}
        onClose={() => setShowActionModal(false)}
        onSelect={handleSelect}
      />

      <HiddenTrackersModal
        visible={showHidden}
        hidden={hiddenCards}
        onClose={() => setShowHidden(false)}
        onUnhide={handleUnhide}
        isDark={isDark}
      />

      <BabyRequiredModal
        visible={showBabyRequired}
        onClose={() => setShowBabyRequired(false)}
        onCreate={() => { setShowBabyRequired(false); navigation.navigate('CreateBabyProfile'); }}
        isDark={isDark}
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
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },
  headerBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: DS.warning, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: DS.white, paddingHorizontal: 3,
  },
  headerBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800' },

  /* Pulse Header */
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
  pulseName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500' },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
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
  ribbonText: { fontSize: 13, fontWeight: '600', marginTop: 1 },

  /* Card */
  card: {
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.xl,
    padding: DS.space.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm,
  },

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  /* Quick Logs */
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: DS.radius.full,
    ...DS.shadow.sm,
  },
  quickEmoji: { fontSize: 15 },
  quickLabel: { color: DS.white, fontSize: 12, fontWeight: '700' },

  /* Velocity */
  velocityTitle: { fontSize: 13, fontWeight: '800' },
  velocitySub: { fontSize: 11, fontWeight: '600' },
  velocityBarTrack: { width: '100%', height: 40, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  velocityBar: { width: '100%', borderRadius: 6 },

  /* Wellness */
  wellnessTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  wellnessLabel: { fontSize: 12, fontWeight: '600' },
  wellnessScore: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  wellnessScoreLabel: { fontSize: 13, fontWeight: '700' },
  wellnessRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessRingProgress: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5,
    borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent',
  },
  wellnessRingInner: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  wellnessBreakdown: { gap: 8 },
  wellnessBreakdownLabel: { fontSize: 11, fontWeight: '600', width: 68 },
  wellnessBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  wellnessBarFill: { height: '100%', borderRadius: 3 },
  wellnessValue: { fontSize: 11, fontWeight: '800', width: 32, textAlign: 'right' },

  /* Sleep / Feed */
  sleepTitle: { fontSize: 14, fontWeight: '800' },
  sleepScorePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sleepScorePillText: { fontSize: 13, fontWeight: '800' },
  sleepMetricVal: { fontSize: 18, fontWeight: '800' },
  sleepMetricLbl: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  /* Week strip */
  weekDay: {
    width: 56, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: DS.radius.md, alignItems: 'center', gap: 3,
  },
  weekDayName: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  weekDayNum: { fontSize: 17, fontWeight: '800' },
  weekDot: { width: 5, height: 5, borderRadius: 3 },
  weekTotal: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  /* Emergency */
  emergencyBtn: {
    alignItems: 'center', paddingVertical: DS.space.md, paddingHorizontal: 6,
    borderRadius: DS.radius.lg, borderWidth: 1, gap: 6, overflow: 'hidden',
  },
  emergencyIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  emergencyLabel: { fontSize: 11, fontWeight: '700' },

  /* Predictions */
  predCard: { width: 148, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  predConf: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  predConfText: { fontSize: 9, fontWeight: '800' },
  predLabel: { fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  predTime: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  predSub: { fontSize: 10, fontWeight: '500' },

  /* Goals */
  goalCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  goalVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  goalTotal: { fontSize: 11, fontWeight: '600' },
  goalLbl: { fontSize: 10, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  goalBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 2 },

  /* Insights */
  insightCard: {
    width: 190, padding: DS.space.md, borderRadius: DS.radius.lg,
    borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden',
  },
  insightTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  insightDesc: { fontSize: 10, fontWeight: '500', lineHeight: 14 },

  /* Trackers */
  catLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  trackerCard: {
    width: 138, height: 116, borderRadius: DS.radius.lg, padding: DS.space.md,
    overflow: 'hidden',
  },
  trackerTitle: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  trackerCount: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  trackerLast: { fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  customBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: DS.space.md, borderRadius: DS.radius.lg,
    borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden',
  },
  customIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  customText: { fontSize: 12, fontWeight: '700' },
  hiddenBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md,
    borderRadius: DS.radius.md,
  },
  hiddenBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  /* Recent */
  groupTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  groupBadgeText: { fontSize: 10, fontWeight: '700' },
  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg,
    borderWidth: 1, borderLeftWidth: 3, marginBottom: 8,
  },
  eventIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 13, fontWeight: '700' },
  eventMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  emptyCard: {
    alignItems: 'center', paddingVertical: DS.space['3xl'],
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  /* Quick Links */
  quickLink: {
    paddingVertical: DS.space.md, borderRadius: DS.radius.lg,
    alignItems: 'center', gap: 6, borderWidth: 1, overflow: 'hidden',
  },
  quickLinkIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLinkLabel: { fontSize: 11, fontWeight: '700' },

  /* Modals */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  actionModal: {
    width: SCREEN_WIDTH - 48, maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg,
  },
  actionModalHeader: { padding: 20, paddingTop: 24, alignItems: 'center', position: 'relative' },
  actionModalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  actionModalDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 2 },
  actionModalClose: {
    position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  actionModalSection: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, marginTop: 2 },
  actionTile: {
    padding: DS.space.md, borderRadius: DS.radius.md,
    alignItems: 'center', gap: 8, borderWidth: 1.5,
  },
  actionTileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTileLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  hiddenModal: {
    width: SCREEN_WIDTH - 48, maxHeight: SCREEN_HEIGHT * 0.75,
    borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg,
  },
  hiddenModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  hiddenModalSub: { fontSize: 12, fontWeight: '500' },
  hiddenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hiddenName: { fontSize: 14, fontWeight: '700' },
  hiddenCat: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  hiddenUnhide: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: DS.space.md, paddingVertical: 6, borderRadius: 8,
  },
  hiddenUnhideText: { fontSize: 12, fontWeight: '700' },
  hiddenDone: {
    paddingVertical: DS.space.md, borderRadius: DS.radius.md, alignItems: 'center',
  },
  hiddenDoneText: { color: DS.white, fontSize: 15, fontWeight: '700' },

  /* Baby required */
  babyReq: {
    width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'],
    padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg,
  },
  babyReqIcon: {
    width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.space.md,
  },
  babyReqTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  babyReqDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: DS.space.lg, paddingHorizontal: 6 },
  babyReqBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, width: '100%',
  },
  babyReqBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});