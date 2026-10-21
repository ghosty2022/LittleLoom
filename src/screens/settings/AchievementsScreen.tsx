import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useTrackerProgressive } from '../../hooks';
import { useCustomization } from '../../hooks/useCustomization';
import { useTrackerAchievements, Achievement } from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');
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

const ACHIEVEMENT_CATEGORIES = {
  milestone: { label: 'Milestones', icon: 'trophy' as const, color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] as [string, string] },
  streak: { label: 'Streaks', icon: 'flame' as const, color: '#ef4444', gradient: ['#ef4444', '#f87171'] as [string, string] },
  tracking: { label: 'Tracking', icon: 'analytics' as const, color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'] as [string, string] },
  social: { label: 'Social', icon: 'people' as const, color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string] },
  special: { label: 'Special', icon: 'star' as const, color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'] as [string, string] },
  care: { label: 'Care', icon: 'heart' as const, color: '#ec4899', gradient: ['#ec4899', '#f472b6'] as [string, string] },
  health: { label: 'Health', icon: 'medical' as const, color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'] as [string, string] },
  growth: { label: 'Growth', icon: 'trending-up' as const, color: '#43e97b', gradient: ['#43e97b', '#38f9d7'] as [string, string] },
  predictive: { label: 'Smart Insights', icon: 'bulb' as const, color: '#f472b6', gradient: ['#f472b6', '#f9a8d4'] as [string, string] },
};

const RARITY_COLORS = {
  common: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8', glow: 'rgba(148,163,184,0.15)' },
  rare: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', text: '#3b82f6', glow: 'rgba(59,130,246,0.2)' },
  epic: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.45)', text: '#8b5cf6', glow: 'rgba(139,92,246,0.25)' },
  legendary: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.55)', text: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
};

const ACHIEVEMENT_REMINDERS_KEY = '@littleloom_achievement_reminders';
const SCHEDULED_NOTIFICATIONS_KEY = '@littleloom_achievement_notifications';
const FAVORITES_KEY = '@littleloom_achievement_favorites';
const PAGE_SIZE = 8;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type AlertState = { visible: boolean; type: 'success' | 'error' | 'info' | 'warning' | 'achievement'; title: string; message: string; emoji?: string };
type ScheduledReminder = { notificationId: string; achievementId: string };
type AchievementTab = 'all' | 'unlocked' | 'locked' | 'favorites';

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText + PressableScale + SectionHeader + Pulse + Ribbon
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
      onPress={() => { if (!disabled) onPress?.(); }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >{children}</AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, isDark }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; isDark: boolean;
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
  </View>
));

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
   Achievements Pulse Header
   ═══════════════════════════════════════════════════════════════════════════ */
const AchievementsPulse = React.memo(({
  isDark, baby, unlocked, total, totalPoints, streak, atRisk, onBabyPress, onShare,
}: {
  isDark: boolean; baby: any; unlocked: number; total: number; totalPoints: number;
  streak: number; atRisk: boolean; onBabyPress: () => void; onShare: () => void;
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
  const level = Math.floor(totalPoints / 500) + 1;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(245,158,11,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(245,158,11,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.warning}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, { backgroundColor: `${DS.warning}35` }, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.warning, DS.accent, DS.primary, DS.warning]}
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
                {baby?.name || 'Achievements'}
              </Text>
              <View style={[styles.pulseAgePill, { backgroundColor: `${DS.warning}18` }]}>
                <Ionicons name="star" size={10} color={DS.warning} />
                <Text style={[styles.pulseAgeText, { color: DS.warning }]}>Lv.{level}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: atRisk ? DS.danger : DS.success }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {unlocked}/{total} unlocked · {totalPoints} pts
              </Text>
            </View>
          </View>
          <PressableScale onPress={onShare} activeScale={0.9}>
            <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="share-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
            </View>
          </PressableScale>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{unlocked}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>unlocked</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{totalPoints}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>points</Text>
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
   Streak Flame Ring
   ═══════════════════════════════════════════════════════════════════════════ */
const StreakFlameRing = React.memo(({ streak, isDark }: { streak: number; isDark: boolean }) => {
  const segments = 7;
  const filled = Math.min(streak, segments);
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segLength = circumference / segments;
  const gap = 6;
  return (
    <Animated.View entering={FadeInUp.delay(80).springify()} style={{ alignItems: 'center', marginVertical: DS.space.sm }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {Array.from({ length: segments }).map((_, i) => {
            const isFilled = i < filled;
            const rotation = (i * 360) / segments - 90;
            return (
              <Circle key={i} cx={size / 2} cy={size / 2} r={radius}
                stroke={isFilled ? DS.danger : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                strokeWidth={strokeWidth} fill="none"
                strokeDasharray={`${segLength - gap} ${circumference}`}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`} />
            );
          })}
        </Svg>
        <View style={styles.ringInner}>
          <Text style={{ fontSize: 22 }}>🔥</Text>
          <Text style={[styles.ringVal, { color: isDark ? DS.white : DS.gray900 }]}>{streak}</Text>
          <Text style={[styles.ringLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>day streak</Text>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Level Badge
   ═══════════════════════════════════════════════════════════════════════════ */
const LevelBadge = React.memo(({ totalPoints, isDark }: { totalPoints: number; isDark: boolean }) => {
  const level = Math.floor(totalPoints / 500) + 1;
  const xpInLevel = totalPoints % 500;
  const progress = (xpInLevel / 500) * 100;
  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <View style={[styles.auraCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.levelIcon, { backgroundColor: `${DS.primary}18` }]}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.levelTitle, { color: isDark ? DS.white : DS.gray900 }]}>Level {level}</Text>
            <Text style={[styles.levelSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{xpInLevel} / 500 XP</Text>
          </View>
          <View style={{ alignItems: 'flex-end', width: 100, gap: 4 }}>
            <View style={[styles.levelBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <View style={[styles.levelBarFill, { width: `${progress}%`, backgroundColor: DS.primary }]} />
            </View>
            <Text style={[styles.levelPercent, { color: DS.primary }]}>{Math.round(progress)}%</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Weekly Challenge
   ═══════════════════════════════════════════════════════════════════════════ */
const WeeklyChallenge = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: () => void }) => {
  const daysLeft = 7 - (new Date().getDay() || 7);
  const progress = 65;
  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.auraCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={[styles.sectionIcon, { backgroundColor: `${DS.warning}18` }]}>
              <Ionicons name="trophy" size={16} color={DS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.levelTitle, { color: isDark ? DS.white : DS.gray900 }]}>Weekly Challenge</Text>
              <Text style={[styles.levelSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{daysLeft} days remaining</Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: `${DS.warning}18` }]}>
              <Text style={[styles.xpText, { color: DS.warning }]}>+200 XP</Text>
            </View>
          </View>
          <Text style={[styles.challengeDesc, { color: isDark ? DS.gray300 : DS.gray700 }]}>
            Log 5 growth measurements this week to earn bonus points and unlock the "Growth Guardian" badge.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 10 }}>
            <View style={[styles.levelBarBg, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <View style={[styles.levelBarFill, { width: `${progress}%`, backgroundColor: DS.warning }]} />
            </View>
            <Text style={[styles.levelPercent, { color: DS.warning }]}>{progress}%</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < 3 ? DS.warning : i === 3 ? `${DS.warning}80` : isDark ? 'rgba(255,255,255,0.1)' : DS.gray200 }} />
                <Text style={{ fontSize: 9, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Rarity Showcase
   ═══════════════════════════════════════════════════════════════════════════ */
const RarityShowcase = React.memo(({ stats, isDark }: { stats: any; isDark: boolean }) => {
  const rarities = [
    { key: 'legendary', label: 'Legendary', color: '#f59e0b', icon: 'diamond' as const },
    { key: 'epic', label: 'Epic', color: '#8b5cf6', icon: 'sparkles' as const },
    { key: 'rare', label: 'Rare', color: '#3b82f6', icon: 'star' as const },
    { key: 'common', label: 'Common', color: '#94a3b8', icon: 'ellipse' as const },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Collection" subtitle="Rarity breakdown" icon="diamond-outline" color={DS.warning} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {rarities.map((r) => {
          const count = stats[r.key] || 0;
          const total = stats.total || 1;
          const percent = Math.round((count / total) * 100);
          return (
            <View key={r.key} style={[styles.rarityCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${r.color}15`, `${r.color}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.rarityIcon, { backgroundColor: `${r.color}18` }]}>
                <Ionicons name={r.icon} size={20} color={r.color} />
              </View>
              <Text style={[styles.rarityCount, { color: isDark ? DS.white : DS.gray900 }]}>{count}</Text>
              <Text style={[styles.rarityLabel, { color: r.color }]}>{r.label}</Text>
              <View style={[styles.rarityBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <View style={[styles.rarityBarFill, { width: `${percent}%`, backgroundColor: r.color }]} />
              </View>
              <Text style={[styles.rarityPercent, { color: isDark ? DS.gray500 : DS.gray400 }]}>{percent}%</Text>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Next Unlock Predictor
   ═══════════════════════════════════════════════════════════════════════════ */
const NextUnlockPredictor = React.memo(({ achievements, isDark, onPress }: { achievements: Achievement[]; isDark: boolean; onPress: (a: Achievement) => void }) => {
  const nextUnlocks = useMemo(() =>
    achievements.filter(a => !a.unlocked).sort((a, b) => (b.progress / b.maxProgress) - (a.progress / a.maxProgress)).slice(0, 3),
    [achievements]);
  if (!nextUnlocks.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(240).springify()}>
      <SectionHeader title="Almost There" subtitle="Your next unlocks" icon="trophy-outline" color={DS.success} isDark={isDark} />
      <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
        {nextUnlocks.map((a) => {
          const percent = Math.round((a.progress / a.maxProgress) * 100);
          const rarity = RARITY_COLORS[a.rarity];
          return (
            <PressableScale key={a.id} onPress={() => onPress(a)} activeScale={0.97}>
              <View style={[styles.nextCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <LinearGradient colors={[`${rarity.text}08`, `${rarity.text}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={[styles.nextIcon, { backgroundColor: rarity.glow }]}>
                  <Text style={{ fontSize: 20, opacity: 0.8 }}>{a.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nextTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{a.title}</Text>
                  <Text style={[styles.nextDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{a.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', width: 56, gap: 4 }}>
                  <View style={[styles.nextPercent, { backgroundColor: `${rarity.text}18` }]}>
                    <Text style={[styles.nextPercentText, { color: rarity.text }]}>{percent}%</Text>
                  </View>
                  <View style={[styles.nextBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                    <View style={[styles.nextBarFill, { width: `${percent}%`, backgroundColor: rarity.text }]} />
                  </View>
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
   Achievement Timeline
   ═══════════════════════════════════════════════════════════════════════════ */
const AchievementTimeline = React.memo(({ achievements, isDark }: { achievements: Achievement[]; isDark: boolean }) => {
  const recent = useMemo(() =>
    achievements.filter(a => a.unlocked && a.earnedAt).sort((a, b) => new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime()).slice(0, 5),
    [achievements]);
  if (!recent.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <SectionHeader title="Recent Unlocks" subtitle="Your achievement history" icon="time-outline" color={DS.primary} isDark={isDark} />
      <View style={{ paddingHorizontal: DS.space.lg }}>
        {recent.map((a, i) => {
          const rarity = RARITY_COLORS[a.rarity];
          const isLast = i === recent.length - 1;
          return (
            <View key={a.id} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 24, alignItems: 'center', paddingTop: 14 }}>
                {!isLast && <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: 11, backgroundColor: isDark ? DS.darkBorder : DS.gray200 }} />}
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: rarity.text, borderWidth: 2, borderColor: isDark ? DS.darkCard : DS.white, zIndex: 1 }} />
              </View>
              <View style={[styles.timelineCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nextTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{a.title}</Text>
                    <Text style={[styles.nextDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {a.earnedAt ? format(new Date(a.earnedAt), 'MMM d, h:mm a') : 'Recently'}
                    </Text>
                  </View>
                  <View style={[styles.ptsBadge, { backgroundColor: `${rarity.text}18` }]}>
                    <Text style={[styles.ptsText, { color: rarity.text }]}>+{a.points}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Achievement Card
   ═══════════════════════════════════════════════════════════════════════════ */
const AchievementCard = React.memo(({ achievement, index, isDark, isNew, hasReminder, rarity, onPress, onToggleReminder }: {
  achievement: Achievement; index: number; isDark: boolean; isNew: boolean;
  hasReminder: boolean; rarity: typeof RARITY_COLORS[keyof typeof RARITY_COLORS];
  onPress: (a: Achievement) => void; onToggleReminder: (a: Achievement) => void;
}) => {
  const progress = (achievement.progress / achievement.maxProgress) * 100;
  return (
    <Animated.View entering={FadeInUp.delay(index * 30).springify()}>
      <PressableScale onPress={() => onPress(achievement)} activeScale={0.98}>
        <View style={[styles.achCard, {
          backgroundColor: achievement.unlocked ? (isDark ? DS.darkCard : DS.white) : (isDark ? 'rgba(30,30,45,0.5)' : DS.gray50),
          borderColor: achievement.unlocked ? rarity.border : isDark ? DS.darkBorder : DS.gray200,
        }]}>
          {isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
            <View style={[styles.achEmoji, { backgroundColor: achievement.unlocked ? rarity.glow : isDark ? 'rgba(255,255,255,0.04)' : DS.gray100 }]}>
              <Text style={{ fontSize: 24, opacity: achievement.unlocked ? 1 : 0.4 }}>{achievement.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.achTitle, { color: achievement.unlocked ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray500 : DS.gray400) }]} numberOfLines={1}>
                  {achievement.title}
                </Text>
                {achievement.unlocked && (
                  <View style={[styles.unlockBadge, { backgroundColor: DS.success }]}>
                    <Ionicons name="checkmark" size={9} color={DS.white} />
                  </View>
                )}
              </View>
              <Text style={[styles.achDesc, { color: isDark ? DS.gray400 : DS.gray500 }, !achievement.unlocked && { opacity: 0.6 }]} numberOfLines={1}>
                {achievement.description}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.achBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <View style={[styles.achBarFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: achievement.unlocked ? DS.success : rarity.text }]} />
                </View>
                <Text style={[styles.achProgress, { color: achievement.unlocked ? DS.success : rarity.text }]}>
                  {achievement.progress}/{achievement.maxProgress}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[styles.rarityPill, { backgroundColor: rarity.bg, borderColor: rarity.border }]}>
                <Text style={[styles.rarityPillText, { color: rarity.text }]}>{achievement.rarity[0].toUpperCase()}</Text>
              </View>
              <Text style={[styles.achPts, { color: DS.warning }]}>+{achievement.points}</Text>
            </View>
          </View>
          {!achievement.unlocked && (
            <View style={[styles.achFooter, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <TouchableOpacity onPress={() => onToggleReminder(achievement)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={hasReminder ? 'notifications' : 'notifications-off-outline'} size={14} color={hasReminder ? rarity.text : isDark ? DS.gray500 : DS.gray400} />
                <Text style={[styles.achReminderText, { color: hasReminder ? rarity.text : isDark ? DS.gray500 : DS.gray400 }]}>
                  {hasReminder ? 'Reminder on' : 'Remind me'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.achCategory, { color: isDark ? DS.gray500 : DS.gray400 }]}>{achievement.category}</Text>
            </View>
          )}
          {achievement.unlocked && achievement.earnedSummary && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="time-outline" size={11} color={DS.success} />
              <Text style={[styles.earnedSummary, { color: DS.success }]}>{achievement.earnedSummary}</Text>
            </View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TabBar + CategoryFilter
   ═══════════════════════════════════════════════════════════════════════════ */
const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: AchievementTab; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number }[];
  activeTab: AchievementTab; onChange: (t: AchievementTab) => void; isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map(t => {
      const active = activeTab === t.key;
      return (
        <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}>
          <Ionicons name={t.icon} size={15} color={active ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, active && { fontWeight: '700' }]}>{t.label}</Text>
          {t.count !== undefined && t.count > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: active ? DS.primary : isDark ? 'rgba(255,255,255,0.1)' : DS.gray100 }]}>
              <Text style={[styles.tabBadgeText, { color: active ? DS.white : isDark ? DS.gray400 : DS.gray500 }]}>{t.count}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
));

const CategoryFilter = React.memo(({ selected, onChange, achievements, isDark }: {
  selected: string; onChange: (c: string) => void; achievements: Achievement[]; isDark: boolean;
}) => {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: achievements.length };
    Object.keys(ACHIEVEMENT_CATEGORIES).forEach(k => { c[k] = achievements.filter(a => a.category === k).length; });
    return c;
  }, [achievements]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
      <TouchableOpacity onPress={() => onChange('all')}
        style={[styles.filterChip, { backgroundColor: selected === 'all' ? DS.primary : isDark ? DS.darkCard : DS.white, borderColor: selected === 'all' ? DS.primary : isDark ? DS.darkBorder : DS.gray200 }]}>
        <Text style={[styles.filterText, { color: selected === 'all' ? DS.white : isDark ? DS.gray300 : DS.gray600 }, selected === 'all' && { fontWeight: '700' }]}>All</Text>
        <View style={[styles.filterBadge, { backgroundColor: selected === 'all' ? 'rgba(255,255,255,0.25)' : isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
          <Text style={[styles.filterBadgeText, { color: selected === 'all' ? DS.white : isDark ? DS.gray400 : DS.gray500 }]}>{counts.all}</Text>
        </View>
      </TouchableOpacity>
      {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => {
        const active = selected === key;
        const count = counts[key] || 0;
        if (count === 0) return null;
        return (
          <TouchableOpacity key={key} onPress={() => onChange(key)}
            style={[styles.filterChip, { backgroundColor: active ? cat.color : isDark ? DS.darkCard : DS.white, borderColor: active ? cat.color : isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name={cat.icon} size={13} color={active ? DS.white : cat.color} />
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
   Streak Protector Modal (aura-styled)
   ═══════════════════════════════════════════════════════════════════════════ */
const StreakProtectorModal = React.memo(({ visible, onClose, streak, isDark, onSetReminder, onLogNow }: any) => {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <LinearGradient colors={[DS.danger, DS.danger + 'CC']} style={styles.modalIcon}>
            <Ionicons name="flame" size={32} color={DS.white} />
          </LinearGradient>
          <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Streak at Risk! 🔥</Text>
          <Text style={[styles.modalDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Your <Text style={{ color: DS.danger, fontWeight: '800' }}>{streak.currentStreak}-day</Text> streak ends in <Text style={{ color: DS.danger, fontWeight: '800' }}>{streak.hoursUntilBreak} hours</Text>!
          </Text>
          <PressableScale onPress={() => { onClose(); onSetReminder(); }} activeScale={0.97} style={{ width: '100%' }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Set Reminder</Text>
            </LinearGradient>
          </PressableScale>
          <PressableScale onPress={() => { onClose(); onLogNow(); }} activeScale={0.97} style={{ width: '100%', marginTop: 8 }}>
            <LinearGradient colors={[DS.success, DS.success + 'CC']} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Log Now</Text>
            </LinearGradient>
          </PressableScale>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, marginTop: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const { currentBaby, babies, refreshCurrentBaby } = useBaby();
  const { entries } = useTrackerProgressive();
  const {
    achievements, stats, streak, newlyUnlocked, growthScore,
    pendingReminders, isLoading: achievementsLoading, refresh: refreshAchievements,
  } = useTrackerAchievements();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<AchievementTab>('all');
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [showStreakProtector, setShowStreakProtector] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set());
  const [scheduledNotifications, setScheduledNotifications] = useState<Map<string, string>>(new Map());
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const baby = useMemo(() => {
    if (route.params?.babyId) return babies.find(b => b.id === route.params?.babyId) || currentBaby;
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  useFocusEffect(useCallback(() => {
    refreshCurrentBaby(); refreshAchievements(); loadReminders(); loadFavorites();
  }, [baby?.id]));

  useEffect(() => {
    loadReminders(); loadScheduledNotifications(); loadFavorites();
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => refreshAchievements(), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadReminders = async () => {
    try { const s = await AsyncStorage.getItem(ACHIEVEMENT_REMINDERS_KEY); if (s) setReminderEnabled(new Set(JSON.parse(s))); } catch {}
  };
  const loadScheduledNotifications = async () => {
    try {
      const s = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
      if (s) {
        const parsed: ScheduledReminder[] = JSON.parse(s);
        const map = new Map<string, string>();
        parsed.forEach(r => map.set(r.achievementId, r.notificationId));
        setScheduledNotifications(map);
      }
    } catch {}
  };
  const loadFavorites = async () => {
    try { const s = await AsyncStorage.getItem(FAVORITES_KEY); if (s) setFavorites(new Set(JSON.parse(s))); } catch {}
  };
  const saveReminders = async (enabled: Set<string>) => {
    try { await AsyncStorage.setItem(ACHIEVEMENT_REMINDERS_KEY, JSON.stringify([...enabled])); } catch {}
  };
  const saveScheduledNotifications = async (map: Map<string, string>) => {
    try {
      const arr: ScheduledReminder[] = [];
      map.forEach((nid, aid) => arr.push({ notificationId: nid, achievementId: aid }));
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(arr));
    } catch {}
  };
  const saveFavorites = async (favs: Set<string>) => {
    try { await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs])); } catch {}
  };

  const sweetAlert = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
    triggerHaptic(type === 'success' || type === 'achievement' ? 'success' : type === 'error' ? 'error' : 'light');
  };

  const toggleReminder = async (achievement: Achievement) => {
    const newEnabled = new Set(reminderEnabled);
    const newScheduled = new Map(scheduledNotifications);
    if (newEnabled.has(achievement.id)) {
      newEnabled.delete(achievement.id);
      const nid = newScheduled.get(achievement.id);
      if (nid) { await Notifications.cancelScheduledNotificationAsync(nid); newScheduled.delete(achievement.id); }
      sweetAlert('info', 'Reminder Disabled', `No more reminders for "${achievement.title}"`, '🔕');
    } else {
      newEnabled.add(achievement.id);
      try {
        const nid = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${achievement.emoji} Achievement Goal: ${achievement.title}`,
            body: `Keep working on: ${achievement.description}. You're at ${achievement.progress}/${achievement.maxProgress}!`,
            data: { type: 'achievement_reminder', screen: 'Achievements', achievementId: achievement.id },
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
        });
        newScheduled.set(achievement.id, nid);
        sweetAlert('success', 'Reminder Set!', `Daily 9 AM reminder for "${achievement.title}"`, achievement.emoji);
      } catch {
        sweetAlert('error', 'Reminder Failed', 'Could not schedule notification.');
      }
    }
    setReminderEnabled(newEnabled);
    setScheduledNotifications(newScheduled);
    await saveReminders(newEnabled);
    await saveScheduledNotifications(newScheduled);
  };

  const toggleFavorite = async (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
    await saveFavorites(next);
    triggerHaptic('light');
  };

  const filtered = useMemo(() => {
    let list = selectedCategory === 'all' ? [...achievements] : achievements.filter(a => a.category === selectedCategory);
    if (activeTab === 'unlocked') list = list.filter(a => a.unlocked);
    else if (activeTab === 'locked') list = list.filter(a => !a.unlocked);
    else if (activeTab === 'favorites') list = list.filter(a => favorites.has(a.id));
    return list;
  }, [selectedCategory, achievements, activeTab, favorites]);

  const paginated = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

  const handleLoadMore = useCallback(() => {
    if (displayCount >= filtered.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + PAGE_SIZE, filtered.length));
      setIsLoadingMore(false);
    }, 300);
  }, [displayCount, filtered.length]);

  const handleCategoryChange = (cat: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(cat);
    setDisplayCount(PAGE_SIZE);
  };

  const handleTabChange = (tab: AchievementTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    setDisplayCount(PAGE_SIZE);
    triggerHaptic('light');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentBaby();
    refreshAchievements();
    setRefreshing(false);
    sweetAlert('success', 'Refreshed!', 'Achievements updated');
  };

  const handleShare = async () => {
    try {
      const message = baby
        ? `🏆 ${baby.name} has unlocked ${stats.unlocked} achievements on LittleLoom! ${stats.totalPoints} points${streak.currentStreak > 0 ? ` · ${streak.currentStreak}-day streak 🔥` : ''}`
        : `I've unlocked ${stats.unlocked} achievements on LittleLoom! ${stats.totalPoints} points.`;
      await Share.share({ message, title: 'LittleLoom Achievements' });
      sweetAlert('success', 'Shared!', 'Achievements shared');
    } catch { sweetAlert('error', 'Share Failed', 'Try again'); }
  };

  const handlePress = (a: Achievement) => {
    triggerHaptic('light');
    if (a.unlocked) sweetAlert('achievement', a.title, `Unlocked! +${a.points} points`, a.emoji);
    else {
      const remaining = a.maxProgress - a.progress;
      sweetAlert('info', a.title, `${remaining} more to unlock!`, a.emoji);
    }
  };

  const handleNavigateToMilestones = useCallback(() => {
    navigation.navigate('AddEntry', { type: 'milestone', babyId: baby?.id });
  }, [navigation, baby?.id]);
  const handleNavigateToTracker = useCallback((type: string) => {
    navigation.navigate('Timeline', { type, babyId: baby?.id });
  }, [navigation, baby?.id]);
  const handleNavigateToReminders = useCallback(() => {
    navigation.navigate('TrackerReminders', { babyId: baby?.id });
  }, [navigation, baby?.id]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP) }));

  const renderAchievement = useCallback(({ item, index }: { item: Achievement; index: number }) => (
    <AchievementCard
      achievement={item} index={index} isDark={isDark}
      isNew={newlyUnlocked.includes(item.id)}
      hasReminder={reminderEnabled.has(item.id)}
      rarity={RARITY_COLORS[item.rarity]}
      onPress={handlePress}
      onToggleReminder={toggleReminder}
    />
  ), [isDark, newlyUnlocked, reminderEnabled, favorites]);

  const tabs = useMemo(() => [
    { key: 'all' as AchievementTab, label: 'All', icon: 'grid-outline' as const, count: achievements.length },
    { key: 'unlocked' as AchievementTab, label: 'Unlocked', icon: 'checkmark-circle-outline' as const, count: stats.unlocked },
    { key: 'locked' as AchievementTab, label: 'Locked', icon: 'lock-closed-outline' as const, count: stats.total - stats.unlocked },
    { key: 'favorites' as AchievementTab, label: 'Saved', icon: 'heart-outline' as const, count: favorites.size },
  ], [achievements.length, stats.unlocked, stats.total, favorites.size]);

  /* No baby */
  if (!baby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <LinearGradient colors={[DS.warning, DS.accent]} style={styles.noBabyGradient}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={styles.noBabyTitle}>No Baby Profile</Text>
            <Text style={styles.noBabySub}>Create a profile to start earning achievements</Text>
            <TouchableOpacity style={styles.noBabyBtn} onPress={() => navigation.navigate('CreateBabyProfile')}>
              <Text style={[styles.noBabyBtnText, { color: DS.primary }]}>Get Started</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#f59e0b', '#ec4899', '#6366f1']} style={styles.headerTitle}>ACHIEVEMENTS</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{baby.name}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="share-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.FlatList
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 100 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        data={paginated}
        renderItem={renderAchievement}
        keyExtractor={item => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Pulse */}
            <AchievementsPulse
              isDark={isDark} baby={baby}
              unlocked={stats.unlocked} total={stats.total}
              totalPoints={stats.totalPoints}
              streak={streak.currentStreak} atRisk={streak.streakAtRisk}
              onBabyPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}
              onShare={handleShare}
            />

            {/* Streak at risk ribbon */}
            {streak.streakAtRisk && (
              <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
                <AuraRibbon isDark={isDark} icon="flame-outline" color={DS.danger} label="Streak at Risk"
                  text={`${streak.hoursUntilBreak}h left — log activity to keep ${streak.currentStreak}-day streak`}
                  onPress={() => handleNavigateToTracker('potty')} />
              </View>
            )}

            {/* Streak flame ring */}
            {streak.currentStreak > 0 && <StreakFlameRing streak={streak.currentStreak} isDark={isDark} />}

            {/* Level Badge */}
            <View style={{ marginTop: DS.space.md }}><LevelBadge totalPoints={stats.totalPoints} isDark={isDark} /></View>

            {/* Weekly Challenge */}
            <View style={{ marginTop: DS.space.md }}>
              <WeeklyChallenge isDark={isDark} onPress={() => navigation.navigate('AddEntry', { type: 'growth', babyId: baby?.id })} />
            </View>

            {/* Rarity Showcase */}
            <View style={{ marginTop: DS.space.md }}><RarityShowcase stats={stats} isDark={isDark} /></View>

            {/* Next Unlock */}
            <View style={{ marginTop: DS.space.md }}>
              <NextUnlockPredictor achievements={achievements} isDark={isDark} onPress={handlePress} />
            </View>

            {/* Timeline */}
            <View style={{ marginTop: DS.space.md }}>
              <AchievementTimeline achievements={achievements} isDark={isDark} />
            </View>

            {/* Tabs */}
            <View style={{ marginTop: DS.space.md }}>
              <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
            </View>

            {/* Category filter */}
            <View style={{ marginTop: DS.space.md }}>
              <CategoryFilter selected={selectedCategory} onChange={handleCategoryChange} achievements={achievements} isDark={isDark} />
            </View>

            {/* Section header */}
            <View style={{ marginTop: DS.space.md }}>
              <SectionHeader
                title={activeTab === 'all' ? 'All Achievements' : activeTab === 'unlocked' ? 'Unlocked' : activeTab === 'locked' ? 'Locked' : 'Saved'}
                subtitle={`${filtered.length} items`}
                icon="trophy-outline" color={DS.warning} isDark={isDark}
              />
            </View>
          </>
        }
        ListFooterComponent={
          <>
            {isLoadingMore && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={22} color={DS.primary} />
                <Text style={{ color: isDark ? DS.gray500 : DS.gray400, fontSize: 12, marginTop: 4 }}>Loading more...</Text>
              </View>
            )}
            {displayCount >= filtered.length && filtered.length > PAGE_SIZE && (
              <Text style={{ textAlign: 'center', color: isDark ? DS.gray500 : DS.gray400, fontSize: 12, paddingVertical: 16 }}>
                — All achievements loaded —
              </Text>
            )}
            <View style={{ height: 40 }} />
          </>
        }
      />

      <StreakProtectorModal
        visible={showStreakProtector} onClose={() => setShowStreakProtector(false)}
        streak={streak} isDark={isDark}
        onSetReminder={handleNavigateToReminders}
        onLogNow={() => handleNavigateToTracker('potty')}
      />

      {alert.visible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', paddingTop: 100 }]} pointerEvents="none">
          <Animated.View entering={FadeInUp.springify()} style={[styles.toast, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient
              colors={alert.type === 'success' || alert.type === 'achievement' ? [DS.success, DS.success] : alert.type === 'error' ? [DS.danger, DS.danger] : [DS.primary, DS.accent]}
              style={styles.toastIcon}
            >
              {alert.emoji ? <Text style={{ fontSize: 22 }}>{alert.emoji}</Text> : <Ionicons name={alert.type === 'success' ? 'checkmark-circle' : alert.type === 'error' ? 'alert-circle' : 'trophy'} size={22} color={DS.white} />}
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
  headerTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: { marginHorizontal: DS.space.lg, marginTop: DS.space.md, borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33 },
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.xs },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  /* Aura card */
  auraCard: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },

  /* Ring */
  ringInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  ringLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },

  /* Level */
  levelIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  levelTitle: { fontSize: 15, fontWeight: '800' },
  levelSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  levelBarBg: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  levelBarFill: { height: '100%', borderRadius: 3 },
  levelPercent: { fontSize: 11, fontWeight: '700' },

  /* Challenge */
  challengeDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  xpBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  xpText: { fontSize: 11, fontWeight: '800' },

  /* Rarity */
  rarityCard: { width: 108, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', overflow: 'hidden' },
  rarityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  rarityCount: { fontSize: 20, fontWeight: '800' },
  rarityLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  rarityBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  rarityBarFill: { height: '100%', borderRadius: 2 },
  rarityPercent: { fontSize: 9, fontWeight: '600', marginTop: 3 },

  /* Next */
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  nextIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontSize: 13, fontWeight: '700' },
  nextDesc: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  nextPercent: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  nextPercentText: { fontSize: 10, fontWeight: '800' },
  nextBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  nextBarFill: { height: '100%', borderRadius: 2 },

  /* Timeline */
  timelineCard: { flex: 1, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1, marginBottom: 8 },
  ptsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ptsText: { fontSize: 11, fontWeight: '800' },

  /* Tab */
  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, minWidth: 16, alignItems: 'center' },
  tabBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Filter */
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  filterBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Achievement card */
  achCard: { borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, overflow: 'hidden', position: 'relative', marginBottom: 10, marginHorizontal: DS.space.lg },
  newBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: DS.danger, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, zIndex: 10 },
  newBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800' },
  achEmoji: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  achTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  unlockBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  achDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  achBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  achBarFill: { height: '100%', borderRadius: 3 },
  achProgress: { fontSize: 10, fontWeight: '700', width: 44, textAlign: 'right' },
  rarityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  rarityPillText: { fontSize: 10, fontWeight: '800' },
  achPts: { fontSize: 13, fontWeight: '800' },
  achFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  achReminderText: { fontSize: 11, fontWeight: '600' },
  achCategory: { fontSize: 10, fontWeight: '500', textTransform: 'capitalize' },
  earnedSummary: { fontSize: 10, fontWeight: '600' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'], padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg },
  modalIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 20 },
  modalBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%' },
  modalBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  /* Toast */
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginHorizontal: 20, ...DS.shadow.lg, minWidth: 280 },
  toastIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontSize: 14, fontWeight: '700' },
  toastMsg: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  /* No Baby */
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyTitle: { fontSize: 22, fontWeight: '800', color: DS.white, marginTop: 12 },
  noBabySub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' },
  noBabyBtn: { backgroundColor: DS.white, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 16 },
  noBabyBtnText: { fontSize: 14, fontWeight: '700' },
});