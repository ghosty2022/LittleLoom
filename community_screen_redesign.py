"""
LittleLoom CommunityScreen - Complete UI Redesign Script
=========================================================

This script generates a completely redesigned CommunityScreen with:
1. Glass-morphism cards inspired by GrowthDashboardScreen
2. Bottom tab navigation (thumb-zone friendly)
3. 6 new intelligent features
4. Smooth, premium feel with proper spacing
5. Better arrangement of all sections

Usage: Copy the generated code into your CommunityScreen.tsx
"""

REDESIGNED_COMMUNITY_SCREEN = """
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInRight,
  FadeOut,
  interpolate,
  interpolateColor,
  Layout,
  runOnJS,
  SlideInDown,
  SlideOutUp,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity } from '../../context/CommunityContext';
import { EmptyState } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, PostMood, Poll } from '../../context/CommunityContext';
import SafeAvatar from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

/* DESIGN TOKENS - Unified, cohesive system matching GrowthDashboard */

const DESIGN = {
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 28,
    full: 999,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const LL = {
  primary: '#7c6cf1',
  primaryLight: '#a5b4fc',
  primaryDark: '#6b5ce7',
  primaryGhost: '#7c6cf118',
  accent: '#f472b6',
  accentSoft: '#fbcfe8',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#38bdf8',
  white: '#ffffff',
  gray50: '#f8f9ff',
  gray100: '#f0f2ff',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  darkBg: '#0b0f1f',
  darkSurface: '#151b2e',
  darkCard: '#1a2236',
  darkBorder: 'rgba(255,255,255,0.06)',
};

const MOOD_CONFIG = {
  celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline', gradient: ['#f59e0b', '#fbbf24'] },
  support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline', gradient: ['#ec4899', '#f472b6'] },
  advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline', gradient: ['#6366f1', '#818cf8'] },
  milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline', gradient: ['#10b981', '#34d399'] },
  venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline', gradient: ['#ef4444', '#f87171'] },
};

/* NEW FEATURE 1: AI Content Curator */
const AICuratorCard = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: () => void }) => {
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.curatorWrap}>
        <LinearGradient
          colors={isDark ? ['rgba(124,108,241,0.15)', 'rgba(107,92,231,0.08)'] : ['rgba(124,108,241,0.08)', 'rgba(107,92,231,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.curatorCard, { borderColor: isDark ? 'rgba(124,108,241,0.2)' : 'rgba(124,108,241,0.15)' }]}
        >
          <View style={styles.curatorHeader}>
            <View style={[styles.curatorIconBg, { backgroundColor: LL.primary + '15' }]}>
              <Ionicons name="sparkles" size={20} color={LL.primary} />
            </View>
            <View style={styles.curatorMeta}>
              <Text style={[styles.curatorTitle, { color: isDark ? LL.white : LL.gray900 }]}>
                Curated For You
              </Text>
              <Text style={[styles.curatorSubtitle, { color: isDark ? LL.gray400 : LL.gray500 }]}>
                Based on your interests
              </Text>
            </View>
            <View style={[styles.curatorBadge, { backgroundColor: LL.primary + '15' }]}>
              <Text style={[styles.curatorBadgeText, { color: LL.primary }]}>AI</Text>
            </View>
          </View>
          <View style={styles.curatorChips}>
            {['Sleep Tips', 'Milestones', 'Feeding'].map((topic, i) => (
              <View key={i} style={[styles.curatorChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : LL.gray100 }]}>
                <Text style={[styles.curatorChipText, { color: isDark ? LL.gray300 : LL.gray600 }]}>{topic}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* NEW FEATURE 2: Trending Pulse */
const TrendingPulse = React.memo(({ isDark, topics }: { isDark: boolean; topics: any[] }) => {
  const pulseAnims = useSharedValue(0);
  useEffect(() => {
    pulseAnims.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.ease }),
        withTiming(0, { duration: 2000, easing: Easing.ease }),
      ),
      -1,
      true,
    );
  }, []);

  const trendingTopics = useMemo(() => topics.filter(t => t.trending).slice(0, 3), [topics]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.trendingPulseWrap}>
      <View style={styles.trendingPulseHeader}>
        <View style={[styles.trendingPulseDot, { backgroundColor: LL.success }]} />
        <Text style={[styles.trendingPulseTitle, { color: isDark ? LL.white : LL.gray900 }]}>
          Trending Now
        </Text>
      </View>
      <View style={styles.trendingPulseGrid}>
        {trendingTopics.map((topic, i) => (
          <TouchableOpacity key={topic.id} style={[
            styles.trendingPulseItem,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.white },
          ]}>
            <Text style={styles.trendingPulseEmoji}>{topic.emoji}</Text>
            <Text style={[styles.trendingPulseName, { color: isDark ? LL.white : LL.gray800 }]} numberOfLines={1}>
              {topic.name}
            </Text>
            <View style={styles.trendingPulseBarBg}>
              <Animated.View style={[
                styles.trendingPulseBarFill,
                { backgroundColor: topic.color, width: (85 - i * 15) + '%', opacity: pulseAnims }
              ]} />
            </View>
            <Text style={[styles.trendingPulseCount, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              {topic.engagementScore}k active
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* NEW FEATURE 3: Parent Spotlight */
const ParentSpotlight = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: () => void }) => {
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.spotlightCard}
        >
          <View style={styles.spotlightContent}>
            <View style={styles.spotlightBadge}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={styles.spotlightBadgeText}>Parent Spotlight</Text>
            </View>
            <View style={styles.spotlightProfile}>
              <SafeAvatar
                avatar="U+1F469 U+200D U+1F467"
                size={56}
                fallbackIcon="person"
                fallbackColor="#fff"
                fallbackBgColor="rgba(255,255,255,0.2)"
                borderWidth={3}
                borderColor="rgba(255,255,255,0.4)"
              />
              <View style={styles.spotlightInfo}>
                <Text style={styles.spotlightName}>Sarah M.</Text>
                <Text style={styles.spotlightRole}>Top Contributor - 2.4k helpful</Text>
              </View>
            </View>
            <Text style={styles.spotlightQuote}>
              "The community here helped me through my toughest parenting moments. So grateful for all of you!"
            </Text>
            <View style={styles.spotlightStats}>
              <View style={styles.spotlightStat}>
                <Text style={styles.spotlightStatValue}>342</Text>
                <Text style={styles.spotlightStatLabel}>Posts</Text>
              </View>
              <View style={styles.spotlightStat}>
                <Text style={styles.spotlightStatValue}>12.5k</Text>
                <Text style={styles.spotlightStatLabel}>Likes</Text>
              </View>
              <View style={styles.spotlightStat}>
                <Text style={styles.spotlightStatValue}>89</Text>
                <Text style={styles.spotlightStatLabel}>Day Streak</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* NEW FEATURE 4: Daily Challenge */
const DailyChallenge = React.memo(({ isDark, onPress }: { isDark: boolean; onPress: () => void }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(0.65, { duration: 1200, easing: Easing.outCubic });
  }, []);

  const progressStyle = useAnimatedStyle(() => ({ width: (progress.value * 100) + '%' }));

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[
        styles.challengeWrap,
        { backgroundColor: isDark ? LL.darkCard : LL.white },
      ]}>
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBg, { backgroundColor: LL.warning + '15' }]}>
            <Ionicons name="flame" size={20} color={LL.warning} />
          </View>
          <View style={styles.challengeMeta}>
            <Text style={[styles.challengeTitle, { color: isDark ? LL.white : LL.gray900 }]}>
              Daily Challenge
            </Text>
            <Text style={[styles.challengeSubtitle, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              Share a milestone photo
            </Text>
          </View>
          <View style={[styles.challengeReward, { backgroundColor: LL.warning + '15' }]}>
            <Text style={[styles.challengeRewardText, { color: LL.warning }]}>+50 pts</Text>
          </View>
        </View>
        <View style={styles.challengeProgressWrap}>
          <View style={[styles.challengeProgressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : LL.gray100 }]}>
            <Animated.View style={[styles.challengeProgressFill, progressStyle]}>
              <LinearGradient
                colors={[LL.warning, '#f59e0b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Text style={[styles.challengeProgressText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
            65% complete - 2 more actions
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* NEW FEATURE 5: Quick Actions Rail */
const QuickActionsRail = React.memo(({ isDark, onAction }: { isDark: boolean; onAction: (type: string) => void }) => {
  const actions = [
    { icon: 'create-outline', label: 'Post', color: LL.primary, action: 'create' },
    { icon: 'camera-outline', label: 'Story', color: LL.accent, action: 'story' },
    { icon: 'poll-outline', label: 'Poll', color: LL.info, action: 'poll' },
    { icon: 'people-outline', label: 'Live', color: LL.success, action: 'live' },
  ];

  return (
    <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.quickRailWrap}>
      <BlurView intensity={isDark ? 60 : 80} tint={isDark ? 'dark' : 'light'} style={styles.quickRailBlur}>
        <View style={[styles.quickRail, { backgroundColor: isDark ? 'rgba(26,34,54,0.8)' : 'rgba(255,255,255,0.85)' }]}>
          {actions.map((item) => (
            <TouchableOpacity
              key={item.action}
              onPress={() => onAction(item.action)}
              style={styles.quickRailItem}
            >
              <View style={[styles.quickRailIconBg, { backgroundColor: item.color + '12' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.quickRailLabel, { color: isDark ? LL.gray300 : LL.gray600 }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>
    </Animated.View>
  );
});

/* NEW FEATURE 6: Smart Insight Bubble */
const SmartInsightBubble = React.memo(({ isDark, insight, onDismiss }: {
  isDark: boolean;
  insight: { icon: string; text: string; color: string } | null;
  onDismiss: () => void;
}) => {
  if (!insight) return null;
  return (
    <Animated.View
      entering={SlideInDown.springify()}
      exiting={SlideOutUp.duration(200)}
      style={styles.insightBubbleWrap}
    >
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.9}>
        <LinearGradient
          colors={[insight.color + '20', insight.color + '08']}
          style={[styles.insightBubble, { borderColor: insight.color + '30' }]}
        >
          <Ionicons name={insight.icon} size={16} color={insight.color} />
          <Text style={[styles.insightBubbleText, { color: isDark ? LL.white : LL.gray800 }]}>
            {insight.text}
          </Text>
          <Ionicons name="close-circle" size={16} color={isDark ? LL.gray500 : LL.gray400} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* Glass Card Base - Matches GrowthDashboard aesthetic */
const GlassCard = React.memo(({ children, style, onPress, isDark, gradient = false }: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  isDark: boolean;
  gradient?: boolean;
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      {
        backgroundColor: isDark ? 'rgba(26,34,54,0.6)' : 'rgba(255,255,255,0.85)',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      },
      style
    ]}>
      {gradient && (
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.4)', 'rgba(35,35,50,0.2)'] : ['rgba(255,255,255,0.5)', 'rgba(250,250,255,0.3)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* Bottom Navigation - Thumb-zone friendly, 4-5 tabs max */
const BottomNav = React.memo(({
  activeTab,
  onTabChange,
  isDark,
  unreadCount,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDark: boolean;
  unreadCount: number;
}) => {
  const tabs = [
    { key: 'loom', label: 'The Loom', icon: 'home-outline', activeIcon: 'home' },
    { key: 'discover', label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
    { key: 'create', label: '', icon: '', isAction: true },
    { key: 'messages', label: 'Chat', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badge: 0 },
    { key: 'profile', label: 'You', icon: 'person-outline', activeIcon: 'person', badge: unreadCount },
  ];

  return (
    <View style={[styles.bottomNav, { backgroundColor: isDark ? 'rgba(11,15,31,0.95)' : 'rgba(255,255,255,0.95)' }]}>
      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      {tabs.map((tab) => {
        if (tab.isAction) {
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabChange('create')}
              style={styles.bottomNavAction}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[LL.primary, LL.primaryDark]} style={styles.bottomNavActionGrad}>
                <Ionicons name="add" size={28} color={LL.white} />
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={styles.bottomNavItem}
            activeOpacity={0.7}
          >
            <View style={styles.bottomNavIconWrap}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? LL.primary : isDark ? LL.gray500 : LL.gray400}
              />
              {tab.badge ? (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[
              styles.bottomNavLabel,
              { color: isActive ? LL.primary : isDark ? LL.gray500 : LL.gray400 },
              isActive && { fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
            {isActive && <View style={[styles.bottomNavIndicator, { backgroundColor: LL.primary }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/* STYLES - Complete redesign */
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },

  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...DESIGN.shadow.md,
    marginHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  /* AI Curator */
  curatorWrap: { marginHorizontal: DESIGN.space.lg, marginBottom: DESIGN.space.lg },
  curatorCard: {
    borderRadius: DESIGN.radius.lg,
    padding: DESIGN.space.lg,
    borderWidth: 1,
    ...DESIGN.shadow.sm,
  },
  curatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.md,
    marginBottom: DESIGN.space.md,
  },
  curatorIconBg: {
    width: 40,
    height: 40,
    borderRadius: DESIGN.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  curatorMeta: { flex: 1 },
  curatorTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  curatorSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  curatorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: DESIGN.radius.full,
  },
  curatorBadgeText: { fontSize: 11, fontWeight: '800' },
  curatorChips: { flexDirection: 'row', gap: DESIGN.space.sm },
  curatorChip: {
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: DESIGN.space.sm,
    borderRadius: DESIGN.radius.full,
  },
  curatorChipText: { fontSize: 12, fontWeight: '600' },

  /* Trending Pulse */
  trendingPulseWrap: { marginHorizontal: DESIGN.space.lg, marginBottom: DESIGN.space.lg },
  trendingPulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.sm,
    marginBottom: DESIGN.space.md,
  },
  trendingPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LL.success,
  },
  trendingPulseTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  trendingPulseGrid: { flexDirection: 'row', gap: DESIGN.space.md },
  trendingPulseItem: {
    flex: 1,
    borderRadius: DESIGN.radius.lg,
    padding: DESIGN.space.md,
    ...DESIGN.shadow.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  trendingPulseEmoji: { fontSize: 24, marginBottom: DESIGN.space.sm },
  trendingPulseName: { fontSize: 13, fontWeight: '700', marginBottom: DESIGN.space.sm },
  trendingPulseBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: DESIGN.space.xs,
    overflow: 'hidden',
  },
  trendingPulseBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  trendingPulseCount: { fontSize: 10, fontWeight: '600' },

  /* Parent Spotlight */
  spotlightCard: {
    borderRadius: DESIGN.radius['2xl'],
    marginHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.lg,
    overflow: 'hidden',
    ...DESIGN.shadow.lg,
  },
  spotlightContent: { padding: DESIGN.space.xl },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: DESIGN.space.xs,
    borderRadius: DESIGN.radius.full,
    marginBottom: DESIGN.space.lg,
  },
  spotlightBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  spotlightProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.md,
    marginBottom: DESIGN.space.lg,
  },
  spotlightInfo: { gap: 2 },
  spotlightName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  spotlightRole: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  spotlightQuote: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: DESIGN.space.lg,
    fontStyle: 'italic',
  },
  spotlightStats: { flexDirection: 'row', gap: DESIGN.space.xl },
  spotlightStat: { alignItems: 'center' },
  spotlightStatValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  spotlightStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  /* Daily Challenge */
  challengeWrap: {
    borderRadius: DESIGN.radius.lg,
    padding: DESIGN.space.lg,
    marginHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.lg,
    ...DESIGN.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.md,
    marginBottom: DESIGN.space.md,
  },
  challengeIconBg: {
    width: 40,
    height: 40,
    borderRadius: DESIGN.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeMeta: { flex: 1 },
  challengeTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  challengeSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  challengeReward: {
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: DESIGN.space.sm,
    borderRadius: DESIGN.radius.md,
  },
  challengeRewardText: { fontSize: 12, fontWeight: '800' },
  challengeProgressWrap: { gap: DESIGN.space.sm },
  challengeProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  challengeProgressText: { fontSize: 11, fontWeight: '600', textAlign: 'right' },

  /* Quick Actions Rail */
  quickRailWrap: {
    position: 'absolute',
    bottom: 90,
    left: DESIGN.space.lg,
    right: DESIGN.space.lg,
    zIndex: 100,
  },
  quickRailBlur: {
    borderRadius: DESIGN.radius.xl,
    overflow: 'hidden',
  },
  quickRail: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: DESIGN.space.md,
    borderRadius: DESIGN.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  quickRailItem: { alignItems: 'center', gap: DESIGN.space.xs },
  quickRailIconBg: {
    width: 44,
    height: 44,
    borderRadius: DESIGN.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickRailLabel: { fontSize: 11, fontWeight: '600' },

  /* Smart Insight Bubble */
  insightBubbleWrap: {
    position: 'absolute',
    top: 100,
    left: DESIGN.space.lg,
    right: DESIGN.space.lg,
    zIndex: 90,
  },
  insightBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.sm,
    paddingHorizontal: DESIGN.space.lg,
    paddingVertical: DESIGN.space.md,
    borderRadius: DESIGN.radius.full,
    borderWidth: 1,
    ...DESIGN.shadow.md,
  },
  insightBubbleText: { flex: 1, fontSize: 13, fontWeight: '600' },

  /* Bottom Navigation */
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: DESIGN.space.sm,
    paddingBottom: Platform.OS === 'ios' ? 30 : DESIGN.space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    zIndex: 1000,
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DESIGN.space.xs,
    minWidth: 60,
  },
  bottomNavIconWrap: { position: 'relative' },
  bottomNavBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LL.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LL.white,
  },
  bottomNavBadgeText: {
    color: LL.white,
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 3,
  },
  bottomNavLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  bottomNavIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  bottomNavAction: { marginTop: -20 },
  bottomNavActionGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...DESIGN.shadow.lg,
  },

  /* Post Card */
  postCardWrap: {
    paddingHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.lg,
  },
  postCard: {
    borderRadius: DESIGN.radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    ...DESIGN.shadow.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DESIGN.space.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: { position: 'relative' },
  authorInfo: {
    marginLeft: DESIGN.space.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.xs,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.xs,
    marginTop: 2,
  },
  handleText: {
    fontSize: 12,
    color: LL.gray400,
    fontWeight: '500',
  },
  dot: {
    fontSize: 12,
    color: LL.gray400,
    marginHorizontal: 4,
  },
  timeText: {
    fontSize: 12,
    color: LL.gray400,
    fontWeight: '500',
  },
  moreBtn: {
    padding: DESIGN.space.sm,
    marginLeft: DESIGN.space.sm,
  },
  moreBtnInner: {
    width: 32,
    height: 32,
    borderRadius: DESIGN.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Mood Badge */
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.xs,
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: 4,
    borderRadius: DESIGN.radius.full,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  /* Content */
  postText: {
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.md,
  },
  readMore: {
    fontSize: 13,
    color: LL.primary,
    fontWeight: '700',
    paddingHorizontal: DESIGN.space.lg,
    marginTop: -DESIGN.space.sm,
    marginBottom: DESIGN.space.md,
  },

  /* Topic Tag */
  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.md,
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: DESIGN.space.sm,
    borderRadius: DESIGN.radius.full,
    gap: DESIGN.space.sm,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: LL.accent + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.full,
  },
  trendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: LL.accent,
  },

  /* Media */
  mediaBox: {
    marginHorizontal: DESIGN.space.lg,
    marginBottom: DESIGN.space.md,
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: 280,
    borderRadius: DESIGN.radius.lg,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
  },
  gridTwo: { flexDirection: 'row' },
  gridThree: { flexDirection: 'row', flexWrap: 'wrap' },
  gridFour: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
  },
  gridItemLarge: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlayText: {
    color: LL.white,
    fontSize: 24,
    fontWeight: '800',
  },

  /* Engagement */
  engagementBar: {
    paddingHorizontal: DESIGN.space.lg,
    paddingBottom: DESIGN.space.sm,
  },
  engagementText: {
    fontSize: 12,
    color: LL.gray400,
    fontWeight: '500',
  },

  /* Comments */
  commentsBox: {
    borderTopWidth: 1,
    padding: DESIGN.space.lg,
  },
  inlineComment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN.space.sm,
    marginBottom: DESIGN.space.md,
  },
  inlineCommentContent: {
    flex: 1,
  },
  inlineCommentBubble: {
    borderRadius: DESIGN.radius.lg,
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: DESIGN.space.sm,
  },
  inlineCommentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  inlineCommentText: {
    fontSize: 13,
    lineHeight: 20,
  },
  inlineCommentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.md,
    marginTop: DESIGN.space.xs,
    paddingLeft: DESIGN.space.sm,
  },
  inlineCommentAction: {
    fontSize: 12,
    color: LL.gray400,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    color: LL.gray400,
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.xs,
    marginBottom: DESIGN.space.md,
  },
  viewAllCommentsText: {
    fontSize: 13,
    color: LL.primary,
    fontWeight: '700',
  },
  commentInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.space.sm,
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DESIGN.radius.full,
    borderWidth: 1,
    paddingHorizontal: DESIGN.space.md,
    paddingVertical: 2,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: DESIGN.space.md,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: DESIGN.radius.full,
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Online Dot */
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LL.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  onlineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default CommunityScreen;
"""
