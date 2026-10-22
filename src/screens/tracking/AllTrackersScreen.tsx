import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StatusBar,
  RefreshControl,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, differenceInMonths } from 'date-fns';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTracker } from '../../hooks';
import { useCustomization } from '../../hooks/useCustomization';
import { useBaby } from '../../context/BabyContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { DEFAULT_TRACKERS } from '../../config/defaultTrackers';
import { useSweetAlert } from '../../components/SweetAlert';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER CONFIG (preserved exactly)
   ═══════════════════════════════════════════════════════════════════════════ */

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
  feed: {
    emoji: '🍼', color: '#fa709a', gradient: ['#fa709a', '#f5576c'],
    description: 'Feeding sessions', category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left Breast', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right Breast', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'breast_both', label: 'Both Sides', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { feedType: 'breast', side: 'both' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solid Food', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ],
  },
  sleep: {
    emoji: '🌙', color: '#11998e', gradient: ['#11998e', '#38ef7d'],
    description: 'Sleep tracking', category: 'essential',
    subActions: [
      { id: 'nap', label: 'Start Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'End Sleep', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ],
  },
  diaper: {
    emoji: '👶', color: '#8B5CF6', gradient: ['#8B5CF6', '#A78BFA'],
    description: 'Diaper changes', category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
      { id: 'dry', label: 'Dry', icon: 'checkmark-circle-outline', color: '#10b981', presetData: { type: 'dry' } },
    ],
  },
  potty: {
    emoji: '💧', color: '#667eea', gradient: ['#667eea', '#764ba2'],
    description: 'Potty training', category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'both', label: 'Both', icon: 'water', color: '#667eea', presetData: { type: 'both', successful: true } },
      { id: 'dry', label: 'Dry Attempt', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ],
  },
  growth: {
    emoji: '📏', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'],
    description: 'Growth measurements', category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ],
  },
  milestone: {
    emoji: '🏆', color: '#ffd700', gradient: ['#ffd700', '#ffaa00'],
    description: 'Development milestones', category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
      { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#3b82f6', presetData: { category: 'language' } },
    ],
  },
  medication: {
    emoji: '💊', color: '#ff6b6b', gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Health & medication', category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temperature', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
      { id: 'vaccine', label: 'Vaccination', icon: 'shield-checkmark-outline', color: '#10b981', presetData: { type: 'vaccine' } },
    ],
  },
  pumping: {
    emoji: '🤱', color: '#ec4899', gradient: ['#ec4899', '#f472b6'],
    description: 'Pumping sessions', category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ],
  },
  bath: {
    emoji: '🛁', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'],
    description: 'Bath time', category: 'care',
    subActions: [
      { id: 'bath', label: 'Log Bath', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'bath' } },
      { id: 'sponge', label: 'Sponge Bath', icon: 'cloud-outline', color: '#93c5fd', presetData: { type: 'sponge' } },
    ],
  },
  tummy_time: {
    emoji: '🤸', color: '#10b981', gradient: ['#10b981', '#34d399'],
    description: 'Tummy time', category: 'development',
    subActions: [
      { id: 'tummy_time', label: 'Log Tummy Time', icon: 'fitness-outline', color: '#10b981', presetData: { type: 'tummy_time' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: DS.success,
  health: DS.danger,
  development: DS.warning,
  care: '#8b5cf6',
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeStr = (val: unknown, fallback = ''): string => (val == null ? fallback : String(val));
const safeNum = (val: unknown, fallback = 0): number => {
  if (val == null) return fallback;
  const n = Number(val);
  return Number.isNaN(n) || !Number.isFinite(n) ? fallback : n;
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?', months: 0 };
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?', months: 0 };
  const months = differenceInMonths(now, birth);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let display: string;
  if (years > 0) display = `${years}y ${remainingMonths}m`;
  else if (months > 0) display = `${months}m`;
  else display = 'Newborn';
  return { display, shortDisplay: months > 0 ? `${months}m` : 'Newborn', months };
};

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
  children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; delayLongPress?: number;
  disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, onLongPress, delayLongPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel, isDark }: {
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
        <Text style={[styles.sectionActionText, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Trackers Pulse — compact animated header
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackersPulse = React.memo<{
  isDark: boolean;
  currentBaby: any;
  stats: { total: number; visible: number; pinned: number; logs: number; hidden: number };
  onBabyPress: () => void;
  onAddPress: () => void;
  onSearchPress: () => void;
  searchActive: boolean;
}>(({ isDark, currentBaby, stats, onBabyPress, onAddPress, onSearchPress, searchActive }) => {
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

  const age = getBabyAge(currentBaby?.birthDate);
  const statusColor = !currentBaby ? DS.warning : stats.visible > 0 ? DS.success : DS.primary;
  const statusLabel = !currentBaby
    ? 'Add baby profile to start'
    : stats.hidden > 0
    ? `${stats.visible} visible · ${stats.hidden} hidden`
    : `${stats.visible} tracker${stats.visible === 1 ? '' : 's'} · ${stats.logs} total logs`;

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
                {currentBaby?.avatar ? (
                  <SafeAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={44} showBadge={false} />
                ) : (
                  <Ionicons name="add-circle" size={26} color={DS.primary} />
                )}
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {currentBaby?.name || 'All Trackers'}
              </Text>
              {currentBaby && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{age.shortDisplay}</Text>
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
            <PressableScale onPress={onSearchPress} activeScale={0.9}>
              <View style={[
                styles.pulseIconBtn,
                {
                  backgroundColor: searchActive
                    ? `${DS.primary}20`
                    : isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                },
              ]}>
                <Ionicons name={searchActive ? 'close' : 'search-outline'} size={18} color={searchActive ? DS.primary : isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAddPress} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.total}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>total</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{stats.visible}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>visible</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.pinned}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>pinned</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.accent }]}>{stats.logs}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>logs</Text>
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
   Category Pills
   ═══════════════════════════════════════════════════════════════════════════ */

const CategoryPills = React.memo(({
  categories, activeCategory, onChange, isDark, counts,
}: {
  categories: string[]; activeCategory: string | null;
  onChange: (c: string | null) => void; isDark: boolean;
  counts: Record<string, number>;
}) => {
  if (categories.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
      <TouchableOpacity
        onPress={() => onChange(null)}
        style={[
          styles.catPill,
          {
            backgroundColor: activeCategory === null ? DS.primary : isDark ? DS.darkCard : DS.white,
            borderColor: activeCategory === null ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
          },
        ]}
        activeOpacity={0.85}
      >
        <Ionicons name="grid-outline" size={13} color={activeCategory === null ? DS.white : DS.primary} />
        <Text style={[styles.catPillText, { color: activeCategory === null ? DS.white : isDark ? DS.gray300 : DS.gray700 }, activeCategory === null && { fontWeight: '700' }]}>
          All
        </Text>
      </TouchableOpacity>
      {categories.map(cat => {
        const active = activeCategory === cat;
        const catColor = CATEGORY_COLORS[cat] || DS.primary;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onChange(active ? null : cat)}
            style={[
              styles.catPill,
              {
                backgroundColor: active ? catColor : isDark ? DS.darkCard : DS.white,
                borderColor: active ? catColor : isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.catPillText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
            {counts[cat] > 0 && (
              <View style={[styles.catPillBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${catColor}15` }]}>
                <Text style={[styles.catPillBadgeText, { color: active ? DS.white : catColor }]}>{counts[cat]}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Tracker Card
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackerCard = React.memo(({
  tracker, isPinned, isDark, onPress, onLongPress, onPinToggle, onHideToggle, index,
}: {
  tracker: any; isPinned: boolean; isDark: boolean;
  onPress: () => void; onLongPress: () => void;
  onPinToggle: () => void; onHideToggle: () => void;
  index: number;
}) => (
  <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
    <PressableScale onPress={onPress} onLongPress={onLongPress} delayLongPress={500} activeScale={0.97}>
      <View style={[
        styles.trackerCard,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: isPinned ? `${tracker.color}60` : isDark ? DS.darkBorder : DS.gray200,
          borderWidth: isPinned ? 2 : 1,
        },
      ]}>
        <LinearGradient
          colors={[`${tracker.color}10`, `${tracker.color}02`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={[styles.trackerIcon, { backgroundColor: `${tracker.color}15` }]}>
            <Text style={{ fontSize: 22 }}>{tracker.emoji}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity
              onPress={onPinToggle}
              style={[styles.trackerActionBtn, { backgroundColor: isPinned ? `${DS.primary}18` : 'transparent' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={14} color={isPinned ? DS.primary : isDark ? DS.gray500 : DS.gray400} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onHideToggle}
              style={styles.trackerActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="eye-off-outline" size={14} color={isDark ? DS.gray500 : DS.gray400} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.trackerTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
          {tracker.title}
        </Text>
        <Text style={[styles.trackerDesc, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
          {TRACKER_CONFIGS[tracker.id]?.description || tracker.category}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <Text style={[styles.trackerCount, { color: tracker.color }]}>{tracker.count} logs</Text>
          {tracker.lastEntry && (
            <Text style={[styles.trackerLast, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
              {tracker.lastEntry}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Sub Action Sheet
   ═══════════════════════════════════════════════════════════════════════════ */

const SubActionSheet = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean; trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, action: TrackerSubAction) => void;
}) => {
  const { isDark } = useCustomization();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.95, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋', color: DS.primary, gradient: [DS.primary, '#764ba2'] as [string, string],
    description: 'Track activity', category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: DS.primary }],
  };

  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 12, zIndex: 200, elevation: 200 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
      <Animated.View style={[
        styles.sheetContent,
        animStyle,
        { backgroundColor: isDark ? DS.darkCard : DS.white },
      ]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.sheetHandlePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
        </View>

        <LinearGradient colors={config.gradient} style={styles.sheetHeader}>
          <Text style={styles.sheetEmoji}>{config.emoji}</Text>
          <Text style={styles.sheetTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
          <Text style={styles.sheetDesc}>{config.description}</Text>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={DS.white} />
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ padding: 14 }}>
          <Text style={[styles.sheetSectionTitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>CHOOSE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
            {config.subActions.map((action, i) => (
              <Animated.View key={action.id} entering={FadeInUp.delay(i * 40).springify()} style={{ width: '50%', padding: 6 }}>
                <PressableScale onPress={() => onSelect(trackerId, action)} activeScale={0.94}>
                  <View style={[
                    styles.subActionCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50,
                      borderColor: `${action.color}40`,
                    },
                  ]}>
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}15` }]}>
                      <Ionicons name={action.icon} size={24} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>
                      {action.label}
                    </Text>
                  </View>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Hidden Trackers Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const HiddenTrackersModal = React.memo(({
  visible, hiddenTrackers, onClose, onUnhide, onPinToggle, pinnedIds,
}: {
  visible: boolean; hiddenTrackers: any[];
  onClose: () => void; onUnhide: (id: string) => void;
  onPinToggle: (id: string) => void; pinnedIds: string[];
}) => {
  const { isDark } = useCustomization();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.95, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.hiddenModal, animStyle, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.hiddenModalHeader}>
            <Text style={[styles.hiddenModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Hidden Trackers</Text>
            <Text style={[styles.hiddenModalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {hiddenTrackers.length} tracker{hiddenTrackers.length > 1 ? 's' : ''} hidden
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.hiddenModalClose}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400, paddingHorizontal: DS.space.md }} showsVerticalScrollIndicator={false}>
            {hiddenTrackers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: DS.space['3xl'], gap: DS.space.md }}>
                <Ionicons name="eye-off-outline" size={44} color={isDark ? DS.gray600 : DS.gray400} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? DS.white : DS.gray900 }}>No hidden trackers</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: isDark ? DS.gray500 : DS.gray400 }}>
                  Trackers you hide will appear here
                </Text>
              </View>
            ) : hiddenTrackers.map(tracker => {
              const isPinned = pinnedIds.includes(tracker.id);
              return (
                <View key={tracker.id} style={[styles.hiddenRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={[styles.hiddenIcon, { backgroundColor: `${tracker.color}15` }]}>
                      <Text style={{ fontSize: 20 }}>{tracker.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.hiddenName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                        {tracker.title}
                      </Text>
                      <Text style={[styles.hiddenDesc, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                        {tracker.category} · {tracker.count} logs
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => onPinToggle(tracker.id)}
                      style={[styles.hiddenPinBtn, { backgroundColor: isPinned ? `${DS.primary}18` : 'transparent' }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={16} color={isPinned ? DS.primary : isDark ? DS.gray500 : DS.gray400} />
                    </TouchableOpacity>
                    <PressableScale onPress={() => onUnhide(tracker.id)} activeScale={0.94}>
                      <View style={[styles.hiddenUnhideBtn, { backgroundColor: `${DS.primary}15` }]}>
                        <Ionicons name="eye-outline" size={14} color={DS.primary} />
                        <Text style={[styles.hiddenUnhideText, { color: DS.primary }]}>Show</Text>
                      </View>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <PressableScale onPress={onClose} activeScale={0.97} style={{ margin: DS.space.md }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.hiddenDoneBtn}>
              <Text style={styles.hiddenDoneText}>Done</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

type AllTrackersNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function AllTrackersScreen() {
  const navigation = useNavigation<AllTrackersNavProp>();
  const insets = useSafeAreaInsets();
  const { isDark, triggerHaptic, shouldReduceMotion } = useCustomization();

  const { entries, getEntries, trackers, refreshEntries } = useTracker();
  const babyHook = useBaby();
  const { currentBaby = null, refreshCurrentBaby = () => {}, loadBabies = () => {} } = babyHook || {};
  const { success: showSuccess } = useSweetAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@littleloom_pinned_trackers'),
      AsyncStorage.getItem('@littleloom_hidden_trackers'),
    ]).then(([pinned, hidden]) => {
      if (pinned) setPinnedIds(JSON.parse(pinned));
      if (hidden) setHiddenIds(JSON.parse(hidden));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedIds)).catch(() => {});
  }, [pinnedIds]);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenIds)).catch(() => {});
  }, [hiddenIds]);

  useFocusEffect(
    useCallback(() => {
      if (typeof refreshEntries === 'function') refreshEntries();
      if (typeof refreshCurrentBaby === 'function') refreshCurrentBaby();
      if (typeof loadBabies === 'function') loadBabies();
    }, [refreshEntries, refreshCurrentBaby, loadBabies])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refreshEntries === 'function') await refreshEntries();
      if (typeof refreshCurrentBaby === 'function') await refreshCurrentBaby();
      if (typeof loadBabies === 'function') await loadBabies();
    } catch {}
    setRefreshing(false);
  }, [refreshEntries, refreshCurrentBaby, loadBabies]);

  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    const sourceTrackers = trackers?.length > 0 ? trackers : DEFAULT_TRACKERS;
    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const entriesForTracker = typeof getEntries === 'function' ? getEntries(id) : [];
      const lastEntry = entriesForTracker && entriesForTracker.length > 0 ? entriesForTracker[0] : null;
      const config = TRACKER_CONFIGS[id];
      return {
        id,
        title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || DS.primary,
        gradient: tracker.gradient || config?.gradient || [DS.primary, '#764ba2'],
        category: tracker.category || config?.category || 'essential',
        count: entriesForTracker ? entriesForTracker.length : 0,
        lastEntry: lastEntry && lastEntry.timestamp
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!(tracker.subActions && tracker.subActions.length > 0) || !!(config?.subActions && config.subActions.length > 0),
      };
    });
  }, [trackers, getEntries, currentBaby]);

  const categories = useMemo(() => [...new Set(trackerCards.map(t => t.category))].sort(), [trackerCards]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    trackerCards.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [trackerCards]);

  const filtered = useMemo(() => {
    let res = trackerCards;
    if (activeCategory) res = res.filter((t: any) => t.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter((t: any) =>
        t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      );
    }
    return res;
  }, [trackerCards, activeCategory, searchQuery]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.count - a.count;
    });
  }, [filtered, pinnedIds]);

  const visibleTrackers = useMemo(() => sortedFiltered.filter(t => !hiddenIds.includes(t.id)), [sortedFiltered, hiddenIds]);
  const hiddenTrackers = useMemo(() => trackerCards.filter(t => hiddenIds.includes(t.id)), [trackerCards, hiddenIds]);
  const hasHidden = hiddenIds.length > 0;

  const pulseStats = {
    total: trackerCards.length,
    visible: visibleTrackers.length,
    pinned: pinnedIds.length,
    logs: entries ? entries.length : 0,
    hidden: hiddenIds.length,
  };

  const topRibbon = useMemo(() => {
    if (!currentBaby) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'Setup needed',
        text: 'Add a baby profile to start tracking',
        onPress: () => navigation.navigate('CreateBabyProfile'),
      };
    }
    if (trackerCards.length === 0) {
      return {
        icon: 'add-circle-outline' as const,
        color: DS.primary,
        label: 'Get started',
        text: 'Create your first custom tracker',
        onPress: () => navigation.navigate('CreateCustomTracker'),
      };
    }
    if (hasHidden) {
      return {
        icon: 'eye-off-outline' as const,
        color: DS.warning,
        label: `${hiddenIds.length} hidden`,
        text: 'Tap to manage hidden trackers',
        onPress: () => setShowHiddenModal(true),
      };
    }
    if (pinnedIds.length > 0) {
      return {
        icon: 'pin-outline' as const,
        color: DS.success,
        label: `${pinnedIds.length} pinned`,
        text: 'Pinned trackers appear first for quick access',
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.accent,
      label: 'Tips',
      text: 'Long-press a tracker to pin it, tap icons to hide',
    };
  }, [currentBaby, trackerCards.length, hasHidden, hiddenIds.length, pinnedIds.length, navigation]);

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowSubSheet(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowSubSheet(false);
    const cleanPreset = action.presetData ? JSON.parse(JSON.stringify(action.presetData)) : undefined;
    setTimeout(() => {
      navigation.navigate('AddEntry', { trackerId, presetData: cleanPreset });
    }, 200);
  }, [navigation]);

  const handlePinToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (pinnedIds.includes(id)) showSuccess('Unpinned', 'Tracker removed from pinned');
    else showSuccess('Pinned', 'Tracker pinned for quick access');
  }, [pinnedIds, showSuccess]);

  const handleHideToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (!hiddenIds.includes(id)) showSuccess('Hidden', 'Tracker hidden from view');
    else showSuccess('Unhidden', 'Tracker restored to view');
  }, [hiddenIds, showSuccess]);

  const handleUnhideTracker = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.filter(x => x !== id));
    showSuccess('Restored', 'Tracker has been restored to your list.');
  }, [showSuccess]);

  const handleCustomPress = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  const handleSwitchBaby = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('SwitchBaby', { returnTo: 'AllTrackers', returnLabel: 'All Trackers' });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    HAPTIC_LIGHT();
    setSearchActive(prev => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

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
              TRACKERS
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby?.name || 'All trackers'} · {visibleTrackers.length} active
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCustomPress}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="add" size={20} color={isDark ? DS.white : DS.gray800} />
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
            tintColor={DS.primary}
            colors={[DS.primary, DS.accent]}
            progressViewOffset={HEADER_TOTAL_HEIGHT}
          />
        }
      >
        {/* Pulse */}
        <TrackersPulse
          isDark={isDark}
          currentBaby={currentBaby}
          stats={pulseStats}
          onBabyPress={currentBaby ? handleSwitchBaby : () => navigation.navigate('CreateBabyProfile')}
          onAddPress={handleCustomPress}
          onSearchPress={handleSearchPress}
          searchActive={searchActive}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} onPress={topRibbon.onPress} />
        </View>

        {/* Search */}
        {searchActive && (
          <Animated.View entering={FadeInUp.delay(40).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <View style={[styles.searchBar, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="search" size={18} color={isDark ? DS.gray500 : DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
                placeholder="Search trackers..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <CategoryPills
              categories={categories}
              activeCategory={activeCategory}
              onChange={setActiveCategory}
              isDark={isDark}
              counts={categoryCounts}
            />
          </View>
        )}

        {/* Hidden banner */}
        {hasHidden && (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <PressableScale onPress={() => setShowHiddenModal(true)} activeScale={0.98}>
              <View style={[styles.hiddenBanner, { backgroundColor: `${DS.warning}10`, borderColor: `${DS.warning}30` }]}>
                <Ionicons name="eye-off-outline" size={16} color={DS.warning} />
                <Text style={[styles.hiddenBannerText, { color: DS.warning }]}>
                  {hiddenIds.length} tracker{hiddenIds.length > 1 ? 's' : ''} hidden
                </Text>
                <Ionicons name="chevron-forward" size={16} color={DS.warning} />
              </View>
            </PressableScale>
          </Animated.View>
        )}

        {/* Grid */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader
            title="Your Trackers"
            subtitle={`${visibleTrackers.length} ${activeCategory ? `in ${activeCategory}` : 'total'}`}
            icon="grid-outline"
            color={DS.primary}
            isDark={isDark}
          />

          {visibleTrackers.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DS.space.lg, gap: 10 }}>
              {visibleTrackers.map((tracker: any, index: number) => {
                const isPinned = pinnedIds.includes(tracker.id);
                return (
                  <View key={tracker.id} style={{ width: (SCREEN_WIDTH - 40 - 10) / 2 }}>
                    <TrackerCard
                      tracker={tracker}
                      isPinned={isPinned}
                      isDark={isDark}
                      onPress={() => handleTrackerPress(tracker.id, tracker.hasSubActions)}
                      onLongPress={() => handlePinToggle(tracker.id)}
                      onPinToggle={() => handlePinToggle(tracker.id)}
                      onHideToggle={() => handleHideToggle(tracker.id)}
                      index={index}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                <Ionicons name="search-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                {searchQuery ? 'No matches found' : 'No trackers available'}
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {searchQuery ? 'Try a different search term' : 'Create your first custom tracker'}
              </Text>
              <PressableScale onPress={handleCustomPress} activeScale={0.97}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn}>
                  <Ionicons name="add" size={16} color={DS.white} />
                  <Text style={styles.emptyBtnText}>Create Tracker</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          )}
        </View>

        {/* Create custom */}
        {visibleTrackers.length > 0 && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <PressableScale onPress={handleCustomPress} activeScale={0.97}>
              <View style={[styles.customBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <LinearGradient
                  colors={[`${DS.primary}10`, `${DS.primary}02`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={[styles.customIcon, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="add" size={20} color={DS.primary} />
                </View>
                <Text style={[styles.customText, { color: DS.primary }]}>Create Custom Tracker</Text>
              </View>
            </PressableScale>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Sub Action Sheet */}
      {showSubSheet && (
        <SubActionSheet
          visible={showSubSheet}
          trackerId={selectedTrackerId}
          onClose={() => setShowSubSheet(false)}
          onSelect={handleSubActionSelect}
        />
      )}

      {/* Hidden Trackers Modal */}
      <HiddenTrackersModal
        visible={showHiddenModal}
        hiddenTrackers={hiddenTrackers}
        onClose={() => setShowHiddenModal(false)}
        onUnhide={handleUnhideTracker}
        onPinToggle={handlePinToggle}
        pinnedIds={pinnedIds}
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
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
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
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
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

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  /* Category pills */
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1,
  },
  catPillText: { fontSize: 12, fontWeight: '600' },
  catPillBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  catPillBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Hidden banner */
  hiddenBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.md, borderWidth: 1,
  },
  hiddenBannerText: { flex: 1, fontSize: 12, fontWeight: '700' },

  /* Tracker card */
  trackerCard: {
    padding: DS.space.md, minHeight: 130, borderRadius: DS.radius.lg,
    overflow: 'hidden', ...DS.shadow.sm,
  },
  trackerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  trackerActionBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  trackerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  trackerDesc: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  trackerCount: { fontSize: 12, fontWeight: '700' },
  trackerLast: { fontSize: 10, fontWeight: '500' },

  /* Custom */
  customBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: DS.space.md, borderRadius: DS.radius.lg,
    borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden',
  },
  customIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  customText: { fontSize: 12, fontWeight: '700' },

  /* Empty */
  emptyState: {
    marginHorizontal: DS.space.lg, paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center',
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', marginBottom: DS.space.md },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: DS.radius.md },
  emptyBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Sub Action Sheet */
  sheetContent: {
    width: '100%', maxHeight: SCREEN_HEIGHT * 0.65, borderRadius: 28, overflow: 'hidden',
    ...DS.shadow.lg,
  },
  sheetHandle: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  sheetHandlePill: { width: 40, height: 5, borderRadius: 3 },
  sheetHeader: { padding: 20, paddingTop: 28, alignItems: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetEmoji: { fontSize: 40, marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: DS.white, letterSpacing: -0.3 },
  sheetDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  sheetCloseBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  sheetSectionTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 10, marginTop: 2,
  },
  subActionCard: {
    alignItems: 'center', padding: 12, gap: 8, borderWidth: 1.5, borderRadius: DS.radius.md,
  },
  subActionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subActionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  /* Hidden modal */
  hiddenModal: {
    width: SCREEN_WIDTH - 40, maxHeight: SCREEN_HEIGHT * 0.75,
    borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg,
  },
  hiddenModalHeader: { padding: DS.space.lg, alignItems: 'center', position: 'relative' },
  hiddenModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  hiddenModalSub: { fontSize: 12, fontWeight: '500' },
  hiddenModalClose: { position: 'absolute', top: DS.space.md, right: DS.space.md, padding: 6 },
  hiddenRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
    paddingVertical: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hiddenIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hiddenName: { fontSize: 13, fontWeight: '700' },
  hiddenDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  hiddenPinBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hiddenUnhideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  hiddenUnhideText: { fontSize: 11, fontWeight: '700' },
  hiddenDoneBtn: { paddingVertical: 12, borderRadius: DS.radius.md, alignItems: 'center' },
  hiddenDoneText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});