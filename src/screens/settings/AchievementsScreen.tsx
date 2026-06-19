import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { differenceInDays, format, isSameDay, subDays, addDays } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../context/TrackerContext';
import { useCustomization } from '../../hooks/useCustomization';
import {
  useTrackerAchievements,
  Achievement,
  AchievementCategory,
} from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching GrowthDashboard style
   ═══════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: {
    xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999,
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const ACHIEVEMENT_CATEGORIES = {
  milestone: { label: 'Milestones', icon: 'trophy', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
  streak: { label: 'Streaks', icon: 'flame', color: '#ef4444', gradient: ['#ef4444', '#f87171'] },
  tracking: { label: 'Tracking', icon: 'analytics', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'] },
  social: { label: 'Social', icon: 'people', color: '#10b981', gradient: ['#10b981', '#34d399'] },
  special: { label: 'Special', icon: 'star', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'] },
  care: { label: 'Care', icon: 'heart', color: '#ec4899', gradient: ['#ec4899', '#f472b6'] },
  health: { label: 'Health', icon: 'medical', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'] },
  growth: { label: 'Growth', icon: 'trending-up', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'] },
  predictive: { label: 'Smart Insights', icon: 'bulb', color: '#f472b6', gradient: ['#f472b6', '#f9a8d4'] },
} as const;

const RARITY_COLORS = {
  common: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8', glow: 'rgba(148,163,184,0.15)' },
  rare: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', text: '#3b82f6', glow: 'rgba(59,130,246,0.2)' },
  epic: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.45)', text: '#8b5cf6', glow: 'rgba(139,92,246,0.25)' },
  legendary: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.55)', text: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
};

const ACHIEVEMENT_REMINDERS_KEY = '@littleloom_achievement_reminders';
const SCHEDULED_NOTIFICATIONS_KEY = '@littleloom_achievement_notifications';
const ACHIEVEMENTS_PAGE_SIZE = 8;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type AlertState = {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning' | 'achievement';
  title: string;
  message: string;
  emoji?: string;
};

type ScheduledReminder = {
  notificationId: string;
  achievementId: string;
};

type AchievementTab = 'all' | 'unlocked' | 'locked' | 'favorites';


/* ═══════════════════════════════════════════════════════════════
   GLASS CARD — Refined, matching GrowthDashboard
   ═══════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false }: any) => {
  const { darkMode: isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: '#6366f1', borderWidth: 2 },
      style,
    ]}>
      <LinearGradient
        colors={isDark
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: any) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: '#6366f1' }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════
   CIRCULAR PROGRESS — Refined
   ═══════════════════════════════════════════════════════════════ */

const CircularProgress = React.memo(({ progress, value, label, color, size = 70, strokeWidth = 6 }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;
  return (
    <View style={[styles.progressItem, { width: size + 16 }]}>
      <View style={[styles.progressSvgContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={color + '80'} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#grad-${label})`} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <Text style={[styles.progressValue, { color, fontSize: size * 0.28 }]}>{value}</Text>
      </View>
      <Text style={[styles.progressLabel, { fontSize: size * 0.2 }]}>{label}</Text>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SWEET ALERT — Refined
   ═══════════════════════════════════════════════════════════════ */

const SweetAlert = React.memo(({ visible, type, title, message, emoji, onClose, isDark }: any) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const config: any = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
    achievement: { colors: ['#f59e0b', '#fbbf24'], icon: 'trophy' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 }]} pointerEvents="none">
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          {emoji ? <Text style={{ fontSize: 28 }}>{emoji}</Text> : <Ionicons name={config.icon} size={28} color="#fff" />}
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
});


/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 1: Achievement Streak Flame Ring
   Animated ring showing consecutive days of achievements
   ═══════════════════════════════════════════════════════════════ */

const StreakFlameRing = React.memo(({ streak, isDark }: { streak: number; isDark: boolean }) => {
  const segments = 7;
  const filled = Math.min(streak, segments);
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / segments;
  const gap = 6;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.streakRingContainer}>
      <View style={[styles.streakRingWrap, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {Array.from({ length: segments }).map((_, i) => {
            const isFilled = i < filled;
            const rotation = (i * 360) / segments - 90;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={isFilled ? '#ef4444' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${segmentLength - gap} ${circumference}`}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              />
            );
          })}
        </Svg>
        <View style={styles.streakRingInner}>
          <Text style={styles.streakRingEmoji}>🔥</Text>
          <Text style={[styles.streakRingValue, { color: isDark ? '#fff' : '#1e293b' }]}>{streak}</Text>
          <Text style={[styles.streakRingLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>day streak</Text>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 2: Achievement Level Badge
   Shows current level with XP progress
   ═══════════════════════════════════════════════════════════════ */

const LevelBadge = React.memo(({ totalPoints, isDark }: { totalPoints: number; isDark: boolean }) => {
  const level = Math.floor(totalPoints / 500) + 1;
  const xpInLevel = totalPoints % 500;
  const xpNeeded = 500;
  const progress = (xpInLevel / xpNeeded) * 100;

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.levelBadgeRow}>
          <View style={styles.levelBadgeLeft}>
            <View style={[styles.levelBadgeCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' }]}>
              <Text style={styles.levelBadgeEmoji}>⭐</Text>
            </View>
            <View>
              <Text style={[styles.levelBadgeTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Level {level}</Text>
              <Text style={[styles.levelBadgeSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>{xpInLevel} / {xpNeeded} XP</Text>
            </View>
          </View>
          <View style={styles.levelBadgeRight}>
            <View style={[styles.levelBadgeBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={[styles.levelBadgeBarFill, { width: `${progress}%`, backgroundColor: '#6366f1' }]} />
            </View>
            <Text style={[styles.levelBadgePercent, { color: '#6366f1' }]}>{Math.round(progress)}%</Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 3: Weekly Challenge Card
   Shows current weekly challenge with countdown
   ═══════════════════════════════════════════════════════════════ */

const WeeklyChallenge = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: () => void }) => {
  const daysLeft = 7 - (new Date().getDay() || 7);
  const progress = 65;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard onPress={onPress}>
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBg, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Ionicons name="trophy" size={20} color="#f59e0b" />
          </View>
          <View style={styles.challengeMeta}>
            <Text style={[styles.challengeTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Weekly Challenge</Text>
            <Text style={[styles.challengeSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>{daysLeft} days remaining</Text>
          </View>
          <View style={[styles.challengeBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Text style={[styles.challengeBadgeText, { color: '#f59e0b' }]}>+200 XP</Text>
          </View>
        </View>
        <View style={styles.challengeBody}>
          <Text style={[styles.challengeDesc, { color: isDark ? '#cbd5e1' : '#475569' }]}>
            Log 5 growth measurements this week to earn bonus points and unlock the "Growth Guardian" badge.
          </Text>
          <View style={styles.challengeProgressRow}>
            <View style={[styles.challengeBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={[styles.challengeBarFill, { width: `${progress}%`, backgroundColor: '#f59e0b' }]} />
            </View>
            <Text style={[styles.challengePercent, { color: '#f59e0b' }]}>{progress}%</Text>
          </View>
          <View style={styles.challengeSteps}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <View key={day} style={styles.challengeStep}>
                <View style={[
                  styles.challengeStepDot,
                  i < 3 && { backgroundColor: '#f59e0b' },
                  i === 3 && { backgroundColor: '#f59e0b', opacity: 0.5 },
                  i > 3 && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
                ]} />
                <Text style={[styles.challengeStepLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>{day}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 4: Rarity Collection Showcase
   Horizontal scroll showing rarity breakdown with visual flair
   ═══════════════════════════════════════════════════════════════ */

const RarityShowcase = React.memo(({ stats, isDark }: { stats: any; isDark: boolean }) => {
  const rarities = [
    { key: 'legendary', label: 'Legendary', color: '#f59e0b', icon: 'diamond' },
    { key: 'epic', label: 'Epic', color: '#8b5cf6', icon: 'sparkles' },
    { key: 'rare', label: 'Rare', color: '#3b82f6', icon: 'star' },
    { key: 'common', label: 'Common', color: '#94a3b8', icon: 'ellipse' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Collection" subtitle="Your rarity breakdown" isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rarityScroll}>
        {rarities.map((r, i) => {
          const count = stats[r.key] || 0;
          const total = stats.total || 1;
          const percent = Math.round((count / total) * 100);
          return (
            <View key={r.key} style={[
              styles.rarityShowcaseCard,
              { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' },
            ]}>
              <LinearGradient
                colors={[`${r.color}15`, `${r.color}05`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[styles.rarityShowcaseIcon, { backgroundColor: `${r.color}15` }]}>
                <Ionicons name={r.icon as any} size={22} color={r.color} />
              </View>
              <Text style={[styles.rarityShowcaseCount, { color: isDark ? '#fff' : '#1e293b' }]}>{count}</Text>
              <Text style={[styles.rarityShowcaseLabel, { color: r.color }]}>{r.label}</Text>
              <View style={[styles.rarityShowcaseBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                <View style={[styles.rarityShowcaseBarFill, { width: `${percent}%`, backgroundColor: r.color }]} />
              </View>
              <Text style={[styles.rarityShowcasePercent, { color: isDark ? '#94a3b8' : '#64748b' }]}>{percent}%</Text>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});


/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 5: Next Unlock Predictor
   AI-powered prediction of next likely achievement
   ═══════════════════════════════════════════════════════════════ */

const NextUnlockPredictor = React.memo(({ achievements, isDark, onPress }: { achievements: Achievement[]; isDark: boolean; onPress: (a: Achievement) => void }) => {
  const nextUnlocks = useMemo(() => {
    return achievements
      .filter(a => !a.unlocked)
      .sort((a, b) => (b.progress / b.maxProgress) - (a.progress / a.maxProgress))
      .slice(0, 3);
  }, [achievements]);

  if (nextUnlocks.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Almost There" subtitle="Your next unlocks" isDark={isDark} />
      <View style={styles.predictorList}>
        {nextUnlocks.map((a, i) => {
          const percent = Math.round((a.progress / a.maxProgress) * 100);
          const rarity = RARITY_COLORS[a.rarity];
          return (
            <TouchableOpacity key={a.id} onPress={() => onPress(a)} activeOpacity={0.85}>
              <View style={[
                styles.predictorCard,
                { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' },
              ]}>
                <LinearGradient
                  colors={[`${rarity.text}08`, `${rarity.text}02`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.predictorLeft}>
                  <View style={[styles.predictorEmojiBox, { backgroundColor: rarity.glow }]}>
                    <Text style={[styles.predictorEmoji, { opacity: 0.7 }]}>{a.emoji}</Text>
                  </View>
                  <View style={styles.predictorInfo}>
                    <Text style={[styles.predictorName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{a.title}</Text>
                    <Text style={[styles.predictorDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{a.description}</Text>
                  </View>
                </View>
                <View style={styles.predictorRight}>
                  <View style={[styles.predictorPercentBadge, { backgroundColor: `${rarity.text}15` }]}>
                    <Text style={[styles.predictorPercentText, { color: rarity.text }]}>{percent}%</Text>
                  </View>
                  <View style={[styles.predictorMiniBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                    <View style={[styles.predictorMiniBarFill, { width: `${percent}%`, backgroundColor: rarity.text }]} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 6: Achievement Timeline
   Visual timeline of recent unlocks
   ═══════════════════════════════════════════════════════════════ */

const AchievementTimeline = React.memo(({ achievements, isDark }: { achievements: Achievement[]; isDark: boolean }) => {
  const recentUnlocks = useMemo(() => {
    return achievements
      .filter(a => a.unlocked && a.earnedAt)
      .sort((a, b) => new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime())
      .slice(0, 5);
  }, [achievements]);

  if (recentUnlocks.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Recent Unlocks" subtitle="Your achievement history" isDark={isDark} />
      <View style={styles.timelineContainer}>
        {recentUnlocks.map((a, i) => {
          const rarity = RARITY_COLORS[a.rarity];
          const isLast = i === recentUnlocks.length - 1;
          return (
            <View key={a.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                <View style={[styles.timelineDot, { backgroundColor: rarity.text, borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]} />
                {isLast && <View style={styles.timelineLineEnd} />}
              </View>
              <View style={[
                styles.timelineCard,
                { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' },
              ]}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineEmoji}>{a.emoji}</Text>
                  <View style={styles.timelineMeta}>
                    <Text style={[styles.timelineTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{a.title}</Text>
                    <Text style={[styles.timelineDate, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {a.earnedAt ? format(new Date(a.earnedAt), 'MMM d, h:mm a') : 'Recently'}
                    </Text>
                  </View>
                  <View style={[styles.timelinePoints, { backgroundColor: `${rarity.text}15` }]}>
                    <Text style={[styles.timelinePointsText, { color: rarity.text }]}>+{a.points}</Text>
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

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT CARD — Redesigned, smooth, space-efficient
   ═══════════════════════════════════════════════════════════════ */

interface AchievementCardProps {
  achievement: Achievement;
  index: number;
  isDark: boolean;
  isNew: boolean;
  hasReminder: boolean;
  rarity: typeof RARITY_COLORS[keyof typeof RARITY_COLORS];
  onPress: (a: Achievement) => void;
  onToggleReminder: (a: Achievement) => void;
  shouldReduceMotion: boolean;
}

const AchievementCard = React.memo(({
  achievement, index, isDark, isNew, hasReminder, rarity, onPress, onToggleReminder, shouldReduceMotion
}: AchievementCardProps) => {
  const progress = (achievement.progress / achievement.maxProgress) * 100;

  return (
    <Animated.View
  entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 40).springify()}
>
      <TouchableOpacity onPress={() => onPress(achievement)} activeOpacity={0.9}>
        <View style={[
          styles.achievementCard,
          {
            backgroundColor: achievement.unlocked
              ? (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)')
              : (isDark ? 'rgba(30,30,45,0.4)' : 'rgba(248,250,252,0.6)'),
            borderColor: achievement.unlocked ? rarity.border : 'rgba(255,255,255,0.05)',
          },
        ]}>
          {isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}

          <View style={styles.achievementMainRow}>
            {/* Left: Emoji with glow */}
            <View style={[
              styles.achievementEmojiWrap,
              { backgroundColor: achievement.unlocked ? rarity.glow : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
            ]}>
              <Text style={[styles.achievementEmoji, !achievement.unlocked && { opacity: 0.35 }]}>
                {achievement.emoji}
              </Text>
            </View>

            {/* Center: Info */}
            <View style={styles.achievementInfo}>
              <View style={styles.achievementTitleRow}>
                <Text style={[
                  styles.achievementTitle,
                  !achievement.unlocked && { color: isDark ? '#64748b' : '#94a3b8' },
                  isDark && achievement.unlocked && { color: '#fff' },
                ]} numberOfLines={1}>
                  {achievement.title}
                </Text>
                {achievement.unlocked && (
                  <View style={[styles.unlockedBadge, { backgroundColor: '#10b981' }]}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>

              <Text style={[
                styles.achievementDesc,
                { color: isDark ? '#94a3b8' : '#64748b' },
                !achievement.unlocked && { opacity: 0.6 },
              ]} numberOfLines={1}>
                {achievement.description}
              </Text>

              {/* Progress bar inline */}
              <View style={styles.achievementProgressRow}>
                <View style={[
                  styles.achievementBarBg,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                ]}>
                  <View style={[
                    styles.achievementBarFill,
                    {
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: achievement.unlocked ? '#10b981' : rarity.text,
                    },
                  ]} />
                </View>
                <Text style={[
                  styles.achievementProgressText,
                  { color: achievement.unlocked ? '#10b981' : rarity.text },
                ]}>
                  {achievement.progress}/{achievement.maxProgress}
                </Text>
              </View>
            </View>

            {/* Right: Points & Rarity */}
            <View style={styles.achievementRight}>
              <View style={[styles.rarityPill, { backgroundColor: rarity.bg, borderColor: rarity.border }]}>
                <Text style={[styles.rarityPillText, { color: rarity.text }]}>
                  {achievement.rarity[0].toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.achievementPoints, { color: isDark ? '#fbbf24' : '#f59e0b' }]}>
                +{achievement.points}
              </Text>
            </View>
          </View>

          {/* Bottom row: Reminder toggle for locked */}
          {!achievement.unlocked && (
            <View style={styles.achievementFooter}>
              <TouchableOpacity
                onPress={() => onToggleReminder(achievement)}
                style={styles.reminderToggle}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={hasReminder ? 'notifications' : 'notifications-off-outline'}
                  size={14}
                  color={hasReminder ? rarity.text : isDark ? '#64748b' : '#94a3b8'}
                />
                <Text style={[
                  styles.reminderToggleText,
                  { color: hasReminder ? rarity.text : isDark ? '#64748b' : '#94a3b8' },
                ]}>
                  {hasReminder ? 'Reminder on' : 'Remind me'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.achievementCategory, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                {achievement.category}
              </Text>
            </View>
          )}

          {achievement.unlocked && achievement.earnedSummary && (
            <View style={styles.earnedSummaryRow}>
              <Ionicons name="time-outline" size={12} color="#10b981" />
              <Text style={styles.earnedSummaryText}>{achievement.earnedSummary}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});


/* ═══════════════════════════════════════════════════════════════
   TAB BAR — Refined, matching GrowthDashboard
   ═══════════════════════════════════════════════════════════════ */

const TabBar = React.memo(({
  tabs,
  activeTab,
  onChange,
  isDark,
}: {
  tabs: { key: AchievementTab; label: string; icon: string; count?: number }[];
  activeTab: AchievementTab;
  onChange: (t: AchievementTab) => void;
  isDark: boolean;
}) => (
  <View style={[
    styles.tabBar,
    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
  ]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
              ...DESIGN.shadow.sm,
            },
          ]}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={isActive ? '#6366f1' : isDark ? '#94a3b8' : '#64748b'}
          />
          <Text style={[
            styles.tabLabel,
            { color: isActive ? '#6366f1' : isDark ? '#94a3b8' : '#64748b' },
            isActive && { fontWeight: '700' },
          ]}>
            {tab.label}
          </Text>
          {tab.count !== undefined && tab.count > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: isActive ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.tabBadgeText, { color: isActive ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>
                {tab.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════
   CATEGORY FILTER — Horizontal scroll with counts
   ═══════════════════════════════════════════════════════════════ */

const CategoryFilter = React.memo(({
  selectedCategory,
  onChange,
  achievements,
  isDark,
}: {
  selectedCategory: string;
  onChange: (c: string) => void;
  achievements: Achievement[];
  isDark: boolean;
}) => {
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: achievements.length };
    Object.keys(ACHIEVEMENT_CATEGORIES).forEach((key) => {
      counts[key] = achievements.filter((a) => a.category === key).length;
    });
    return counts;
  }, [achievements]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <TouchableOpacity
        style={[
          styles.filterChip,
          selectedCategory === 'all' && { backgroundColor: '#6366f1', borderColor: 'transparent' },
        ]}
        onPress={() => onChange('all')}
      >
        <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>
          All
        </Text>
        <View style={[styles.filterBadge, { backgroundColor: selectedCategory === 'all' ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.filterBadgeText, { color: selectedCategory === 'all' ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>
            {categoryCounts.all}
          </Text>
        </View>
      </TouchableOpacity>
      {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => {
        const isActive = selectedCategory === key;
        const count = categoryCounts[key] || 0;
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              isActive && { backgroundColor: cat.color, borderColor: 'transparent' },
            ]}
            onPress={() => onChange(key)}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={isActive ? '#fff' : cat.color}
            />
            <Text style={[
              styles.filterText,
              { color: isActive ? '#fff' : isDark ? '#cbd5e1' : '#475569' },
            ]}>
              {cat.label}
            </Text>
            {!isActive && count > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: `${cat.color}20` }]}>
                <Text style={[styles.filterBadgeText, { color: cat.color }]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════
   STREAK PROTECTOR MODAL
   ═══════════════════════════════════════════════════════════════ */

const StreakProtectorModal = React.memo(({
  visible,
  onClose,
  streak,
  isDark,
  themeColors,
  onSetReminder,
  onLogNow,
}: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
          <LinearGradient colors={['#ef4444', '#f87171']} style={styles.modalHeaderGradient}>
            <Ionicons name="flame" size={40} color="#fff" />
            <Text style={styles.modalHeaderTitle}>Streak at Risk! 🔥</Text>
          </LinearGradient>
          <View style={styles.modalBody}>
            <Text style={[styles.modalText, { color: isDark ? '#fff' : '#1e293b' }]}>
              Your {streak.currentStreak}-day streak ends in{' '}
              <Text style={{ color: '#ef4444', fontWeight: '800' }}>{streak.hoursUntilBreak} hours</Text>!
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { onClose(); onSetReminder(); }}>
                <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.modalBtnGradient}>
                  <Text style={styles.modalBtnText}>Set Reminder</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { onClose(); onLogNow(); }}>
                <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.modalBtnGradient}>
                  <Text style={styles.modalBtnText}>Log Now</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
                <View style={[styles.modalBtnGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.modalBtnText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Dismiss</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});


/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN — REDESIGNED
   ═══════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation, route }: Props) {
  const scrollY = useSharedValue(0);
  const { currentBaby, babies, refreshCurrentBaby } = useBaby();
  const { entries } = useTracker();
  const {
    achievements,
    stats,
    streak,
    newlyUnlocked,
    growthScore,
    pendingReminders,
    isLoading: achievementsLoading,
    refresh: refreshAchievements,
  } = useTrackerAchievements();

  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<AchievementTab>('all');
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [showStreakProtector, setShowStreakProtector] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set());
  const [scheduledNotifications, setScheduledNotifications] = useState<Map<string, string>>(new Map());
  const [displayCount, setDisplayCount] = useState(ACHIEVEMENTS_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find((b) => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  /* ---- Auto-refresh ---- */
  useFocusEffect(
    useCallback(() => {
      refreshCurrentBaby();
      refreshAchievements();
      loadReminders();
      loadFavorites();
    }, [baby?.id])
  );

  useEffect(() => {
    loadReminders();
    loadScheduledNotifications();
    loadFavorites();
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAchievements();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Storage helpers ---- */
  const loadReminders = async () => {
    try {
      const saved = await AsyncStorage.getItem(ACHIEVEMENT_REMINDERS_KEY);
      if (saved) setReminderEnabled(new Set(JSON.parse(saved)));
    } catch (e) { console.warn('Failed to load reminders:', e); }
  };

  const loadScheduledNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
      if (saved) {
        const parsed: ScheduledReminder[] = JSON.parse(saved);
        const map = new Map<string, string>();
        parsed.forEach((r) => map.set(r.achievementId, r.notificationId));
        setScheduledNotifications(map);
      }
    } catch (e) { console.warn('Failed to load scheduled notifications:', e); }
  };

  const loadFavorites = async () => {
    try {
      const saved = await AsyncStorage.getItem('@littleloom_achievement_favorites');
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch (e) { console.warn('Failed to load favorites:', e); }
  };

  const saveReminders = async (enabled: Set<string>) => {
    try {
      await AsyncStorage.setItem(ACHIEVEMENT_REMINDERS_KEY, JSON.stringify([...enabled]));
    } catch (e) {
      console.warn('Failed to save reminders:', e);
      sweetAlert('error', 'Save Failed', 'Could not save reminder settings');
    }
  };

  const saveScheduledNotifications = async (map: Map<string, string>) => {
    try {
      const arr: ScheduledReminder[] = [];
      map.forEach((notificationId, achievementId) => {
        arr.push({ notificationId, achievementId });
      });
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(arr));
    } catch (e) { console.warn('Failed to save scheduled notifications:', e); }
  };

  const saveFavorites = async (favs: Set<string>) => {
    try {
      await AsyncStorage.setItem('@littleloom_achievement_favorites', JSON.stringify([...favs]));
    } catch (e) { console.warn('Failed to save favorites:', e); }
  };

  /* ---- Alert helper ---- */
  const sweetAlert = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
    triggerHaptic(type === 'success' || type === 'achievement' ? 'success' : type === 'error' ? 'error' : 'light');
  };

  /* ---- Toggle reminder ---- */
  const toggleReminder = async (achievement: Achievement) => {
    const newEnabled = new Set(reminderEnabled);
    const newScheduled = new Map(scheduledNotifications);

    if (newEnabled.has(achievement.id)) {
      newEnabled.delete(achievement.id);
      const notificationId = newScheduled.get(achievement.id);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        newScheduled.delete(achievement.id);
      }
      sweetAlert('info', 'Reminder Disabled', `No more reminders for "${achievement.title}"`, '🔕');
    } else {
      newEnabled.add(achievement.id);
      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${achievement.emoji} Achievement Goal: ${achievement.title}`,
            body: `Keep working on: ${achievement.description}. You're at ${achievement.progress}/${achievement.maxProgress}!`,
            data: { type: 'achievement_reminder', screen: 'Achievements', achievementId: achievement.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
          },
        });
        newScheduled.set(achievement.id, notificationId);
        sweetAlert('success', 'Reminder Set!', `We'll remind you daily at 9 AM about "${achievement.title}"`, achievement.emoji);
      } catch (e) {
        console.warn('Failed to schedule notification:', e);
        sweetAlert('error', 'Reminder Failed', 'Could not schedule notification. Check permissions.');
      }
    }

    setReminderEnabled(newEnabled);
    setScheduledNotifications(newScheduled);
    await saveReminders(newEnabled);
    await saveScheduledNotifications(newScheduled);
    triggerHaptic('light');
  };

  /* ---- Toggle favorite ---- */
  const toggleFavorite = async (achievementId: string) => {
    const newFavs = new Set(favorites);
    if (newFavs.has(achievementId)) {
      newFavs.delete(achievementId);
    } else {
      newFavs.add(achievementId);
    }
    setFavorites(newFavs);
    await saveFavorites(newFavs);
    triggerHaptic('light');
  };

  /* ---- Filter logic ---- */
  const filtered = useMemo(() => {
    let list = selectedCategory === 'all'
      ? [...achievements]
      : achievements.filter((a) => a.category === selectedCategory);

    if (activeTab === 'unlocked') {
      list = list.filter((a) => a.unlocked);
    } else if (activeTab === 'locked') {
      list = list.filter((a) => !a.unlocked);
    } else if (activeTab === 'favorites') {
      list = list.filter((a) => favorites.has(a.id));
    }

    return list;
  }, [selectedCategory, achievements, activeTab, favorites]);

  const paginatedAchievements = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  /* ---- Pagination ---- */
  const handleLoadMore = useCallback(() => {
    if (displayCount >= filtered.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + ACHIEVEMENTS_PAGE_SIZE, filtered.length));
      setIsLoadingMore(false);
    }, 300);
  }, [displayCount, filtered.length]);

  /* ---- Category change ---- */
  const handleCategoryChange = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(category);
    setDisplayCount(ACHIEVEMENTS_PAGE_SIZE);
    const label = category === 'all' ? 'all achievements' : `${ACHIEVEMENT_CATEGORIES[category as keyof typeof ACHIEVEMENT_CATEGORIES]?.label || category} achievements`;
    sweetAlert('info', 'Filter', `Showing ${label}`);
  };

  /* ---- Tab change ---- */
  const handleTabChange = (tab: AchievementTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    setDisplayCount(ACHIEVEMENTS_PAGE_SIZE);
    triggerHaptic('light');
  };

  /* ---- Refresh ---- */
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentBaby();
    refreshAchievements();
    setRefreshing(false);
    sweetAlert('success', 'Refreshed!', 'Achievement data updated');
  };

  /* ---- Share ---- */
  const handleShare = async () => {
    triggerHaptic('medium');
    try {
      const message = baby
        ? `🏆 ${baby.name} has unlocked ${stats.unlocked} achievements on LittleLoom! Total: ${stats.totalPoints} points. ${streak.currentStreak > 0 ? `${streak.currentStreak}-day streak! 🔥` : ''}`
        : `I've unlocked ${stats.unlocked} achievements on LittleLoom! 🏆 Total: ${stats.totalPoints} points.`;
      await Share.share({ message, title: 'LittleLoom Achievements' });
      sweetAlert('success', 'Shared!', 'Your achievements have been shared');
    } catch {
      sweetAlert('error', 'Share Failed', 'Could not share achievements');
    }
  };

  /* ---- Achievement press ---- */
  const handlePress = (achievement: Achievement) => {
    triggerHaptic('light');
    if (achievement.unlocked) {
      sweetAlert('achievement', achievement.title, `Unlocked! ${achievement.points} points earned`, achievement.emoji);
    } else {
      const remaining = achievement.maxProgress - achievement.progress;
      sweetAlert('info', achievement.title, `${remaining} more to unlock! Keep tracking!`, achievement.emoji);
    }
  };

  /* ---- Navigation helpers ---- */
  const handleNavigateToMilestones = useCallback(() => {
    navigation.navigate('AddEntry', { type: 'milestone', babyId: baby?.id });
  }, [navigation, baby?.id]);

  const handleNavigateToTracker = useCallback((type: string) => {
    navigation.navigate('Timeline', { type, babyId: baby?.id });
  }, [navigation, baby?.id]);

  const handleNavigateToReminders = useCallback(() => {
    navigation.navigate('TrackerReminders', { babyId: baby?.id });
  }, [navigation, baby?.id]);

  /* ---- Scroll handler ---- */
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

  /* ---- Render item ---- */
  const renderAchievementItem = useCallback(
    ({ item, index }: { item: Achievement; index: number }) => {
      const rarity = RARITY_COLORS[item.rarity];
      const isNew = newlyUnlocked.includes(item.id);
      const hasReminder = reminderEnabled.has(item.id);

      return (
        <AchievementCard
          achievement={item}
          index={index}
          isDark={isDark}
          isNew={isNew}
          hasReminder={hasReminder}
          rarity={rarity}
          onPress={handlePress}
          onToggleReminder={toggleReminder}
          shouldReduceMotion={shouldReduceMotion}
        />
      );
    },
    [isDark, newlyUnlocked, reminderEnabled, handlePress, toggleReminder, shouldReduceMotion]
  );

  const keyExtractor = useCallback((item: Achievement) => item.id, []);

  /* ---- Tabs config ---- */
  const tabs = useMemo(() => [
    { key: 'all' as AchievementTab, label: 'All', icon: 'grid-outline', count: achievements.length },
    { key: 'unlocked' as AchievementTab, label: 'Unlocked', icon: 'checkmark-circle-outline', count: stats.unlocked },
    { key: 'locked' as AchievementTab, label: 'Locked', icon: 'lock-closed-outline', count: stats.total - stats.unlocked },
    { key: 'favorites' as AchievementTab, label: 'Favorites', icon: 'heart-outline', count: favorites.size },
  ], [achievements.length, stats.unlocked, stats.total, favorites.size]);

  /* ---- No baby ---- */
  if (!baby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <GlassCard>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.noBabyGradient}>
              <Text style={styles.noBabyEmoji}>🏆</Text>
              <Text style={styles.noBabyTitle}>No Baby Profile</Text>
              <Text style={styles.noBabySubtitle}>Create a profile to start earning achievements</Text>
              <TouchableOpacity style={styles.noBabyButton} onPress={() => navigation.navigate('CreateBabyProfile')}>
                <Text style={[styles.noBabyButtonText, { color: themeColors.primary }]}>Get Started</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassCard>
        </View>
        <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, headerOpacity]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{baby.name}'s Achievements</Text>
        <Text style={[styles.stickySubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{stats.totalPoints} points</Text>
      </Animated.View>

      <Animated.FlatList
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        data={paginatedAchievements}
        renderItem={renderAchievementItem}
        keyExtractor={keyExtractor}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {/* ── TOP HEADER ROW ── */}
            <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1e293b'} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{baby.name}'s Achievements</Text>
                <View style={styles.pointsBadge}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.pointsText}>{stats.totalPoints}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={handleShare} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                <Ionicons name="share-outline" size={22} color={isDark ? '#fff' : '#1e293b'} />
              </TouchableOpacity>
            </Animated.View>

            {/* ── BABY INFO CARD ── */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <GlassCard onPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}>
                <View style={styles.babyRow}>
                  <SafeBabyAvatar
                    avatar={baby.avatar}
                    gender={baby.gender}
                    size={60}
                    showBadge={streak.currentStreak > 0}
                    animated={!shouldReduceMotion}
                  />
                  <View style={styles.babyInfo}>
                    <Text style={[styles.babyName, { color: isDark ? '#fff' : '#1e293b' }]}>{baby.name}</Text>
                    <Text style={[styles.babyAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>{baby.age}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: streak.streakAtRisk ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                      <Ionicons name={streak.streakAtRisk ? 'flame-outline' : 'checkmark-circle'} size={14} color={streak.streakAtRisk ? '#ef4444' : '#10b981'} />
                      <Text style={[styles.statusText, { color: streak.streakAtRisk ? '#ef4444' : '#10b981' }]}>
                        {streak.streakAtRisk ? 'Streak at risk!' : 'On track'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statsCol}>
                    <Text style={[styles.statValue, { color: isDark ? '#fff' : '#1e293b' }]}>{streak.longestStreak}</Text>
                    <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Best</Text>
                  </View>
                </View>
                {streak.streakAtRisk && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={16} color="#ef4444" />
                    <Text style={styles.warningText}>Log an activity today to keep your streak!</Text>
                    <TouchableOpacity style={styles.warningAction} onPress={() => handleNavigateToTracker('potty')}>
                      <Text style={styles.warningActionText}>Log Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            </Animated.View>

            {/* ── NEW FEATURE 1: Streak Flame Ring ── */}
            <View style={styles.streakRingSection}>
              <StreakFlameRing streak={streak.currentStreak} isDark={isDark} />
            </View>

            {/* ── NEW FEATURE 2: Level Badge ── */}
            <LevelBadge totalPoints={stats.totalPoints} isDark={isDark} />

            {/* ── NEW FEATURE 3: Weekly Challenge ── */}
            <WeeklyChallenge
              isDark={isDark}
              onPress={() => navigation.navigate('AddEntry', { type: 'growth', babyId: baby?.id })}
            />

            {/* ── OVERVIEW CARD ── */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <GlassCard style={styles.overviewCard}>
                <View style={styles.overviewRow}>
                  <CircularProgress progress={stats.progress} value={`${stats.progress}%`} label="Complete" color={themeColors.primary} size={90} />
                  <View style={styles.overviewInfo}>
                    <Text style={[styles.overviewTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Progress</Text>
                    <Text style={[styles.overviewSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{stats.unlocked} of {stats.total} unlocked</Text>
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.pointsPill}>
                      <Ionicons name="star" size={14} color="#fff" />
                      <Text style={styles.pointsPillText}>{stats.totalPoints} pts</Text>
                    </LinearGradient>
                  </View>
                </View>
                <View style={styles.rarityRow}>
                  {[
                    { label: 'Legendary', count: stats.legendary, color: '#f59e0b' },
                    { label: 'Epic', count: stats.epic, color: '#8b5cf6' },
                    { label: 'Rare', count: stats.rare, color: '#3b82f6' },
                    { label: 'Common', count: stats.common, color: '#94a3b8' },
                  ].map((r) => (
                    <View key={r.label} style={styles.rarityItem}>
                      <View style={[styles.rarityDot, { backgroundColor: r.color }]} />
                      <Text style={[styles.rarityCount, { color: isDark ? '#fff' : '#1e293b' }]}>{r.count}</Text>
                      <Text style={styles.rarityLabel}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </Animated.View>

            {/* ── NEW FEATURE 4: Rarity Collection Showcase ── */}
            <RarityShowcase stats={stats} isDark={isDark} />

            {/* ── NEW FEATURE 5: Next Unlock Predictor ── */}
            <NextUnlockPredictor
              achievements={achievements}
              isDark={isDark}
              onPress={(a) => handlePress(a)}
            />

            {/* ── NEW FEATURE 6: Achievement Timeline ── */}
            <AchievementTimeline achievements={achievements} isDark={isDark} />

            {/* ── TAB BAR ── */}
            <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />

            {/* ── CATEGORY FILTER ── */}
            <CategoryFilter
              selectedCategory={selectedCategory}
              onChange={handleCategoryChange}
              achievements={achievements}
              isDark={isDark}
            />

            {/* ── SECTION HEADER FOR LIST ── */}
            <SectionHeader
              title={activeTab === 'all' ? 'All Achievements' : activeTab === 'unlocked' ? 'Unlocked' : activeTab === 'locked' ? 'Locked' : 'Favorites'}
              subtitle={`${filtered.length} items`}
              isDark={isDark}
            />
          </>
        }
        ListFooterComponent={
          <>
            {isLoadingMore && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={24} color={themeColors.primary} />
                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Loading more...</Text>
              </View>
            )}
            {displayCount >= filtered.length && filtered.length > ACHIEVEMENTS_PAGE_SIZE && (
              <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, paddingVertical: 16 }}>
                — All achievements loaded —
              </Text>
            )}
            <View style={{ height: 100 }} />
          </>
        }
      />

      {/* Streak Protector Modal */}
      <StreakProtectorModal
        visible={showStreakProtector}
        onClose={() => setShowStreakProtector(false)}
        streak={streak}
        isDark={isDark}
        themeColors={themeColors}
        onSetReminder={handleNavigateToReminders}
        onLogNow={() => handleNavigateToTracker('potty')}
      />

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned, matching GrowthDashboard
   ═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DESIGN.shadow.md,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Scroll Content ──
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 16 : 8,
    paddingBottom: 30,
  },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  pointsText: { fontSize: 13, fontWeight: '700', color: '#f59e0b' },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Baby Card ──
  babyRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  babyInfo: { flex: 1, marginLeft: 14 },
  babyName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  babyAge: { fontSize: 12, fontWeight: '500', marginBottom: 6, opacity: 0.7 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsCol: { alignItems: 'center', marginLeft: 'auto', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(100,116,139,0.15)' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.6 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },
  warningText: { fontSize: 13, color: '#ef4444', marginLeft: 8, fontWeight: '600', flex: 1 },
  warningAction: { marginLeft: 'auto', backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  warningActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Streak Flame Ring ──
  streakRingSection: { alignItems: 'center', marginVertical: 8 },
  streakRingContainer: { alignItems: 'center' },
  streakRingWrap: { justifyContent: 'center', alignItems: 'center' },
  streakRingInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakRingEmoji: { fontSize: 24, marginBottom: 2 },
  streakRingValue: { fontSize: 28, fontWeight: '800' },
  streakRingLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // ── Level Badge ──
  levelBadgeRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  levelBadgeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  levelBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadgeEmoji: { fontSize: 22 },
  levelBadgeTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  levelBadgeSub: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  levelBadgeRight: { alignItems: 'flex-end', gap: 6, width: 100 },
  levelBadgeBarBg: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  levelBadgeBarFill: { height: '100%', borderRadius: 3 },
  levelBadgePercent: { fontSize: 12, fontWeight: '700' },

  // ── Weekly Challenge ──
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 10 },
  challengeIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  challengeMeta: { flex: 1 },
  challengeTitle: { fontSize: 16, fontWeight: '800', marginBottom: 1 },
  challengeSub: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  challengeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  challengeBadgeText: { fontSize: 12, fontWeight: '700' },
  challengeBody: { paddingHorizontal: 16, paddingBottom: 16 },
  challengeDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginBottom: 12 },
  challengeProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  challengeBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  challengeBarFill: { height: '100%', borderRadius: 3 },
  challengePercent: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  challengeSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  challengeStep: { alignItems: 'center', gap: 4 },
  challengeStepDot: { width: 8, height: 8, borderRadius: 4 },
  challengeStepLabel: { fontSize: 10, fontWeight: '600' },

  // ── Overview Card ──
  overviewCard: { borderRadius: 28, padding: 20 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  overviewInfo: { flex: 1, marginLeft: 16 },
  overviewTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  overviewSubtitle: { fontSize: 14, fontWeight: '500', marginBottom: 12, opacity: 0.7 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, alignSelf: 'flex-start' },
  pointsPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rarityRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  rarityItem: { alignItems: 'center' },
  rarityDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  rarityCount: { fontSize: 16, fontWeight: '800' },
  rarityLabel: { fontSize: 10, fontWeight: '500', marginTop: 2, opacity: 0.6 },

  // ── Rarity Showcase ──
  rarityScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  rarityShowcaseCard: {
    width: 110,
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    ...DESIGN.shadow.sm,
  },
  rarityShowcaseIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  rarityShowcaseCount: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  rarityShowcaseLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  rarityShowcaseBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  rarityShowcaseBarFill: { height: '100%', borderRadius: 2 },
  rarityShowcasePercent: { fontSize: 10, fontWeight: '600' },

  // ── Next Unlock Predictor ──
  predictorList: { marginHorizontal: 16, gap: 8 },
  predictorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    overflow: 'hidden',
    ...DESIGN.shadow.sm,
  },
  predictorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  predictorEmojiBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  predictorEmoji: { fontSize: 20 },
  predictorInfo: { flex: 1, gap: 2 },
  predictorName: { fontSize: 14, fontWeight: '700' },
  predictorDesc: { fontSize: 11, fontWeight: '500', opacity: 0.7 },
  predictorRight: { alignItems: 'flex-end', gap: 4, width: 60 },
  predictorPercentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  predictorPercentText: { fontSize: 11, fontWeight: '800' },
  predictorMiniBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  predictorMiniBarFill: { height: '100%', borderRadius: 2 },

  // ── Achievement Timeline ──
  timelineContainer: { marginHorizontal: 16 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 11 },
  timelineLineEnd: { position: 'absolute', top: 0, bottom: '50%', width: 2, left: 11, backgroundColor: 'transparent' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', zIndex: 1 },
  timelineCard: { flex: 1, padding: 14, borderRadius: 16, marginBottom: 12, ...DESIGN.shadow.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineEmoji: { fontSize: 20 },
  timelineMeta: { flex: 1, gap: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700' },
  timelineDate: { fontSize: 11, fontWeight: '500', opacity: 0.7 },
  timelinePoints: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timelinePointsText: { fontSize: 11, fontWeight: '800' },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center', marginLeft: 2 },
  tabBadgeText: { fontSize: 10, fontWeight: '800' },

  // ── Category Filter ──
  filterScroll: { marginBottom: 16, marginTop: 4 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.15)',
    marginRight: 8,
    gap: 6,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '800' },

  // ── Achievement Card ──
  achievementCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
    marginHorizontal: 16,
    ...DESIGN.shadow.sm,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  achievementMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  achievementEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementEmoji: { fontSize: 24 },
  achievementInfo: { flex: 1, gap: 4 },
  achievementTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  achievementTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  unlockedBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  achievementDesc: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  achievementProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achievementBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  achievementBarFill: { height: '100%', borderRadius: 3 },
  achievementProgressText: { fontSize: 11, fontWeight: '700', width: 50, textAlign: 'right' },
  achievementRight: { alignItems: 'flex-end', gap: 6, paddingLeft: 8 },
  rarityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  rarityPillText: { fontSize: 10, fontWeight: '800' },
  achievementPoints: { fontSize: 14, fontWeight: '800' },
  achievementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.08)',
  },
  reminderToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reminderToggleText: { fontSize: 12, fontWeight: '600' },
  achievementCategory: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  earnedSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  earnedSummaryText: { fontSize: 11, color: '#10b981', fontWeight: '600' },

  // ── Progress ──
  progressItem: { alignItems: 'center' },
  progressSvgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  progressValue: { position: 'absolute', fontWeight: '800' },
  progressLabel: { color: '#64748b', marginTop: 6, fontWeight: '600' },

  // ── Alert ──
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 300,
    maxWidth: SCREEN_W - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // ── No Baby ──
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyEmoji: { fontSize: 56, marginBottom: 16 },
  noBabyTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, textAlign: 'center' },
  noBabyButton: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, marginTop: 8 },
  noBabyButtonText: { fontSize: 15, fontWeight: '700' },

  // ── Modal ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { width: SCREEN_W - 60, borderRadius: 28, overflow: 'hidden', ...DESIGN.shadow.lg },
  modalHeaderGradient: { padding: 24, alignItems: 'center' },
  modalHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  modalBody: { padding: 24, alignItems: 'center' },
  modalText: { fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  modalActions: { flexDirection: 'column', gap: 10, width: '100%' },
  modalBtn: { borderRadius: 16, overflow: 'hidden' },
  modalBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});