import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  UIManager,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string], icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string], icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string], icon: 'heart' },
  member: { label: 'Member', color: '#94a3b8', gradient: ['#64748b', '#94a3b8'] as [string, string], icon: 'person' },
};

const EMOJI_OPTIONS = ['👤','👩','👨','👵','👴','👶','👧','👦','🧑','👮','👩‍⚕️','👨‍⚕️','👩‍🏫','👨‍🏫','👩‍🍳','👨‍🍳','👩‍⚖️','👨‍⚖️','👩‍🌾','👨‍🌾'];

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared your first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#f43f5e', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fbbf24', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#6366f1', 'topic_2': '#10b981', 'topic_3': '#ec4899',
  'topic_4': '#fbbf24', 'topic_5': '#f43f5e', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#ec4899',
  'topic_10': '#43e97b', 'topic_11': '#ec4899', 'topic_12': '#6366f1',
};

type ProfileTab = 'overview' | 'posts' | 'achievements' | 'settings';

const COMMUNITY_AVATARS_BUCKET = 'community_avatars';
const COMMUNITY_COVERS_BUCKET = 'community_covers';

const isEmojiAvatar = (avatar: string | undefined): boolean => {
  if (!avatar) return false;
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

const generateUniqueFileName = (userId: string, ext: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}.${ext}`;
};

interface ActivityScore { overall: number; engagement: number; consistency: number; helpfulness: number; creativity: number; }
interface WeeklyImpact { postsThisWeek: number; helpfulVotes: number; newConnections: number; rankChange: number; trend: 'up' | 'down' | 'stable'; }
interface CommunityStanding { percentile: number; rank: string; nextMilestone: string; progressToNext: number; }
interface ContentBreakdown { posts: number; comments: number; reactions: number; shares: number; }
interface InfluenceMetric { label: string; value: number; color: string; icon: string; }
interface TopicAffinity { topicId: string; topicName: string; emoji: string; color: string; affinity: number; posts: number; }

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#667eea', '#764ba2', '#f093fb'],
}: {
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

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PressableScale = React.memo<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning';
}>(({ children, onPress, disabled = false, style, activeScale = 0.96, hapticType = 'light' }) => {
  const scale = useSharedValue(1);
  const { triggerHaptic, hapticFeedback } = useCustomization();
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => { scale.value = withTiming(activeScale, { duration: 80 }); }, [activeScale, scale]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }, [scale]);
  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticFeedback) triggerHaptic(hapticType).catch(() => {});
    onPress?.();
  }, [disabled, hapticFeedback, triggerHaptic, hapticType, onPress]);
  return (
    <AnimatedTouchable
      style={[style, animStyle]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE RING - Animated avatar ring
   ═══════════════════════════════════════════════════════════════════════════ */

const PulseRing = React.memo(({
  children, size, isOnline, isVerified, roleColor, onPress, isEditing,
}: {
  children: React.ReactNode;
  size: number;
  isOnline?: boolean;
  isVerified?: boolean;
  roleColor: string;
  onPress?: () => void;
  isEditing?: boolean;
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.05, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 8000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.7, { duration: 1800 }), withTiming(0.3, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const ringSize = size + 12;

  return (
    <PressableScale onPress={onPress} activeScale={0.95} disabled={!onPress}>
      <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{
          position: 'absolute',
          width: ringSize + 8,
          height: ringSize + 8,
          borderRadius: (ringSize + 8) / 2,
          backgroundColor: `${roleColor}25`,
        }, glowStyle]} />
        <Animated.View style={[{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          overflow: 'hidden',
        }, ringStyle]}>
          <LinearGradient
            colors={[roleColor, '#ec4899', '#f59e0b', roleColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: '#fff',
          backgroundColor: '#fff',
        }}>
          {children}
        </View>
        {isOnline && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#10b981',
            borderWidth: 2,
            borderColor: '#fff',
          }} />
        )}
        {isEditing && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: roleColor,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#fff',
          }}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        )}
      </View>
    </PressableScale>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({
  title, subtitle, icon, color = DS.primary, action, actionLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  action?: () => void;
  actionLabel?: string;
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
   TAB BAR
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = React.memo(({
  tabs, activeTab, onChange, isDark,
}: {
  tabs: { key: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: ProfileTab;
  onChange: (t: ProfileTab) => void;
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name={tab.icon} size={15} color={isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[
            styles.tabLabel,
            { color: isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500 },
            isActive && { fontWeight: '700' },
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   STAT PILL
   ═══════════════════════════════════════════════════════════════════════════ */

const StatPill = React.memo(({
  icon, value, label, color, onPress,
}: {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  onPress?: () => void;
}) => (
  <PressableScale onPress={onPress} activeScale={0.95} disabled={!onPress}>
    <View style={[styles.statPill, { backgroundColor: `${color}10` }]}>
      <Text style={styles.statPillIcon}>{icon}</Text>
      <View>
        <Text style={[styles.statPillValue, { color }]}>{value}</Text>
        <Text style={styles.statPillLabel}>{label}</Text>
      </View>
    </View>
  </PressableScale>
));

/* ═══════════════════════════════════════════════════════════════════════════
   INFLUENCE METER
   ═══════════════════════════════════════════════════════════════════════════ */

const InfluenceMeter = React.memo(({
  metrics, isDark,
}: {
  metrics: InfluenceMetric[];
  isDark: boolean;
}) => {
  const avg = Math.round(metrics.reduce((a, b) => a + b.value, 0) / metrics.length);
  const scoreColor = avg >= 80 ? DS.success : avg >= 60 ? DS.primary : avg >= 40 ? DS.warning : DS.danger;

  return (
    <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <LinearGradient
        colors={[`${scoreColor}08`, `${scoreColor}02`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.influenceHeader}>
        <View>
          <Text style={[styles.influenceTitle, { color: isDark ? DS.white : DS.gray900 }]}>Influence Score</Text>
          <Text style={[styles.influenceSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Community impact</Text>
        </View>
        <View style={[styles.influenceScore, { backgroundColor: `${scoreColor}15` }]}>
          <Text style={[styles.influenceScoreText, { color: scoreColor }]}>{avg}</Text>
        </View>
      </View>
      <View style={styles.influenceGrid}>
        {metrics.map((metric, i) => (
          <View key={metric.label} style={styles.influenceItem}>
            <View style={styles.influenceItemTop}>
              <Ionicons name={metric.icon as any} size={13} color={metric.color} />
              <Text style={[styles.influenceItemLabel, { color: isDark ? DS.gray300 : DS.gray600 }]}>{metric.label}</Text>
              <Text style={[styles.influenceItemValue, { color: metric.color }]}>{metric.value}%</Text>
            </View>
            <View style={[styles.influenceBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Animated.View
                entering={FadeInRight.delay(200 + i * 60).springify()}
                style={[styles.influenceBarFill, { width: `${metric.value}%`, backgroundColor: metric.color }]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TOPIC CHIP
   ═══════════════════════════════════════════════════════════════════════════ */

const TopicChip = React.memo(({ topic }: { topic: TopicAffinity }) => (
  <View style={[styles.topicChip, { backgroundColor: `${topic.color}12`, borderColor: `${topic.color}30` }]}>
    <Text style={styles.topicChipEmoji}>{topic.emoji}</Text>
    <View style={{ flex: 1 }}>
      <Text style={[styles.topicChipName, { color: topic.color }]} numberOfLines={1}>{topic.topicName}</Text>
      <Text style={styles.topicChipPosts}>{topic.posts} posts</Text>
    </View>
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   ACHIEVEMENT BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

const AchievementBadge = React.memo(({ id, compact = false }: { id: string; compact?: boolean }) => {
  const badge = ACHIEVEMENTS[id] || { emoji: '🏅', name: id, color: DS.primary, desc: '' };
  if (compact) {
    return (
      <View style={[styles.achievementBadgeCompact, { backgroundColor: `${badge.color}12`, borderColor: `${badge.color}30` }]}>
        <Text style={styles.achievementBadgeEmoji}>{badge.emoji}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}08`, borderColor: `${badge.color}25` }]}>
      <Text style={styles.achievementBadgeEmoji}>{badge.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.achievementBadgeName, { color: badge.color }]}>{badge.name}</Text>
        <Text style={styles.achievementBadgeDesc} numberOfLines={1}>{badge.desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={16} color={badge.color} style={{ opacity: 0.6 }} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════════════════ */

const ProfileSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  const barBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  return (
    <View style={{ paddingHorizontal: DS.space.lg, paddingTop: DS.space.lg }}>
      <View style={{ alignItems: 'center', marginBottom: DS.space.xl }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: barBg, marginBottom: 16 }} />
        <View style={{ width: 160, height: 22, borderRadius: 8, backgroundColor: barBg, marginBottom: 8 }} />
        <View style={{ width: 100, height: 14, borderRadius: 6, backgroundColor: barBg }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: DS.space.lg }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ flex: 1, height: 60, borderRadius: 16, backgroundColor: barBg }} />
        ))}
      </View>
      <View style={{ height: 180, borderRadius: 18, backgroundColor: barBg, marginBottom: DS.space.lg }} />
      <View style={{ height: 120, borderRadius: 18, backgroundColor: barBg }} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CommunityProfileScreen({ navigation }: Props) {
  const {
    currentUser,
    updateCommunityProfile,
    syncUserProfileAcrossPosts,
    getUserPosts,
    getSelectedTopics,
    getFollowers,
    getFollowing,
    checkAndAwardAchievements,
    getAllUsers,
    refreshFeed,
    refreshTopics: refreshTopicsData,
    getUserProfile,
  } = useCommunity();
  const {
    profile,
    updateCommunityProfile: updateUserContextProfile,
    checkUsernameAvailable,
    updateUsername,
  } = useUser();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const { compressImage } = useMedia();
  const sweetAlert = useSweetAlert();
  const { deleteAccountWithConfirmation, userProfile } = useAuth();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const scrollY = useSharedValue(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isProfileDeactivated, setIsProfileDeactivated] = useState(false);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [locationDetected, setLocationDetected] = useState<{ city: string; region: string; country: string; full: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    handle: '',
    bio: '',
    avatar: '',
    coverPhoto: '',
    location: '',
    isPublic: true,
    notificationsEnabled: true,
    showActivityStatus: true,
    allowMessages: true,
  });
  const [originalData, setOriginalData] = useState({ ...formData });
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const userPostList = useMemo(() => getUserPosts(currentUser?.id || ''), [currentUser, getUserPosts]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  /* ═══════════════════════════════════════════════════════════════════════
     DERIVED METRICS
     ═══════════════════════════════════════════════════════════════════════ */

  const influenceMetrics: InfluenceMetric[] = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);

    const avgEngagement = totalPosts > 0 ? Math.min(100, Math.round((totalLikes + totalComments * 2) / totalPosts * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round(totalHelpful / Math.max(1, totalPosts) * 15));
    const reach = Math.min(100, Math.round(totalViews / Math.max(1, totalPosts * 10) * 100));

    return [
      { label: 'Engagement', value: avgEngagement, color: DS.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: DS.accent, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: DS.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: DS.warning, icon: 'eye' },
    ];
  }, [userPostList]);

  const communityStanding: CommunityStanding = useMemo(() => {
    const userPostCount = userPostList.length;
    const allPostCounts = allUsers.map(u => getUserPosts(u.id).length);
    const sortedCounts = [...allPostCounts].sort((a, b) => b - a);
    const rank = sortedCounts.findIndex(c => c <= userPostCount) + 1;
    const percentile = Math.min(100, Math.round((1 - (rank / Math.max(1, allUsers.length))) * 100));

    let rankLabel = 'New Parent';
    let nextMilestone = '50 posts';
    let progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100));

    if (userPostCount > 100) {
      rankLabel = 'Legendary';
      nextMilestone = '200 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 200) * 100));
    } else if (userPostCount > 50) {
      rankLabel = 'Gold Parent';
      nextMilestone = '100 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 100) * 100));
    } else if (userPostCount > 20) {
      rankLabel = 'Silver Parent';
      nextMilestone = '50 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100));
    } else if (userPostCount > 5) {
      rankLabel = 'Bronze Parent';
      nextMilestone = '20 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 20) * 100));
    }

    return { percentile, rank: rankLabel, nextMilestone, progressToNext };
  }, [userPostList, allUsers, getUserPosts]);

  const contentBreakdown: ContentBreakdown = useMemo(() => ({
    posts: userPostList.length,
    comments: userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
    reactions: userPostList.reduce((sum, p) => sum + (p.likes || 0), 0),
    shares: userPostList.reduce((sum, p) => sum + (p.reposts || 0), 0),
  }), [userPostList]);

  const topicAffinities: TopicAffinity[] = useMemo(() => {
    const affinities: TopicAffinity[] = [];
    const topicCounts: Record<string, number> = {};
    userPostList.forEach(p => {
      topicCounts[p.topicId] = (topicCounts[p.topicId] || 0) + 1;
    });
    Object.entries(topicCounts).forEach(([topicId, count]) => {
      const topic = INITIAL_TOPICS.find(t => t.id === topicId);
      if (topic) {
        affinities.push({
          topicId,
          topicName: topic.name,
          emoji: topic.emoji || '🏷️',
          color: topic.color || TOPIC_COLORS[topicId] || DS.primary,
          affinity: Math.min(100, count * 15),
          posts: count,
        });
      }
    });
    return affinities.sort((a, b) => b.affinity - a.affinity).slice(0, 4);
  }, [userPostList]);

  const roleConfig = currentUser?.isVerified ? ROLE_CONFIG.verified : ROLE_CONFIG.member;

  /* ═══════════════════════════════════════════════════════════════════════
     ANIMATIONS
     ═══════════════════════════════════════════════════════════════════════ */

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  /* ═══════════════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {});
    const hide = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (currentUser && !initialLoadDone.current && !isLoadingRef.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser && !isLoadingRef.current) {
        refreshUserData();
      }
      return () => {};
    }, [currentUser])
  );

  const refreshUserData = useCallback(async () => {
    if (isLoadingRef.current || !currentUser) return;
    isLoadingRef.current = true;

    try {
      const topics = getSelectedTopics();
      const followers = await getFollowers(currentUser.id);
      const following = await getFollowing(currentUser.id);

      if (isMountedRef.current) {
        setSelectedTopics(topics);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentUser, getSelectedTopics, getFollowers, getFollowing]);

  const generateIntelligentUsername = useCallback((displayName: string, userId: string): string => {
    let base = displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    if (!base) base = 'parent';
    const suffix = userId.slice(0, 6);
    return `${base}_${suffix}`;
  }, []);

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameCheckStatus(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameAvailable(username, currentUser?.id);
      setUsernameCheckStatus(result);
    } catch (error) {
      console.error('Username check error:', error);
    } finally {
      setIsCheckingUsername(false);
    }
  }, [checkUsernameAvailable, currentUser?.id]);

  useEffect(() => {
    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
    }

    const handle = formData.handle.replace('@', '').trim();
    if (handle && handle.length >= 3) {
      usernameDebounceRef.current = setTimeout(() => {
        checkUsername(handle);
      }, 500);
    } else {
      setUsernameCheckStatus(null);
    }

    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
      }
    };
  }, [formData.handle, checkUsername]);

  // Location detection
  useEffect(() => {
    let isMounted = true;
    const detectLocation = async () => {
      try {
        const cachedLocation = await AsyncStorage.getItem('@user_location_cache');
        if (cachedLocation) {
          try {
            const parsed = JSON.parse(cachedLocation);
            if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000 && parsed.data?.full) {
              if (isMounted) {
                setLocationDetected(parsed.data);
                setFormData(prev => ({
                  ...prev,
                  location: (!prev.location || /^unknown/i.test(prev.location)) ? parsed.data.full : prev.location,
                }));
              }
              return;
            }
          } catch {}
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !isMounted) return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (reverseGeocode.length > 0 && isMounted) {
          const place = reverseGeocode[0];
          const city = place.city || place.district || place.subregion || '';
          const region = place.region || place.state || '';
          const country = place.country || '';

          const locationParts: string[] = [];
          if (city) locationParts.push(city);
          if (region && region !== city) locationParts.push(region);
          if (country && !locationParts.includes(country)) locationParts.push(country);

          const fullLocation = locationParts.join(', ') || 'Unknown Location';
          const locationData = { city, region, country, full: fullLocation };

          await AsyncStorage.setItem('@user_location_cache', JSON.stringify({
            data: locationData,
            timestamp: Date.now(),
          }));

          if (isMounted) {
            setLocationDetected(locationData);
            setFormData(prev => ({
              ...prev,
              location: (!prev.location || /^unknown/i.test(prev.location)) ? fullLocation : prev.location,
            }));
          }
        }
      } catch (error) {
        console.log('Location detection error:', error);
      }
    };
    detectLocation();
    return () => { isMounted = false; };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     DATA LOADING
     ═══════════════════════════════════════════════════════════════════════ */

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setIsHydrating(true);
    try {
      if (currentUser) {
        let canonicalHandle = '';
        let canonicalAvatar = '';
        let canonicalCover = '';
        let canonicalFullName = '';

        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('community_handle, community_username, community_avatar, avatar_url, community_cover, community_bio, full_name, is_verified')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (profileRow) {
            canonicalHandle =
              ((profileRow.community_handle || '').toString().replace(/^@+/, '')) ||
              ((profileRow.community_username || '').toString());
            canonicalAvatar = profileRow.community_avatar || profileRow.avatar_url || '';
            canonicalCover = profileRow.community_cover || '';
            canonicalFullName = profileRow.full_name || '';

            if (canonicalHandle && canonicalHandle !== currentUser.handle.replace(/^@+/, '')) {
              await updateCommunityProfile({ handle: `@${canonicalHandle}` });
            }

            if (
              typeof profileRow.is_verified === 'boolean' &&
              profileRow.is_verified !== currentUser.isVerified
            ) {
              await updateCommunityProfile({ isVerified: profileRow.is_verified });
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[CommunityProfile] profile sync failed:', e);
        }

        const topics = getSelectedTopics();
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);

        if (isMountedRef.current) {
          setSelectedTopics(topics);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }

        let currentHandle = currentUser.handle || '';
        if (!currentHandle) {
          currentHandle = generateIntelligentUsername(
            currentUser.displayName || 'parent',
            currentUser.id
          );
        }
        currentHandle = currentHandle.replace(/^@+/, '');

        const resolvedLocation =
          (currentUser.country && !/^unknown/i.test(currentUser.country) && currentUser.country) ||
          (currentUser.location && !/^unknown/i.test(currentUser.location) && currentUser.location) ||
          (locationDetected?.full && locationDetected.full) ||
          '';

        const userCtxFullName = (profile as any)?.fullName || '';
        const authFullName =
          (userProfile as any)?.fullName ||
          (userProfile as any)?.full_name ||
          '';
        const emailLocalPart = (currentUser.email || '').split('@')[0] || '';
        const derivedFallbackName =
          (currentHandle && currentHandle.replace(/[_.]/g, ' ').trim()) ||
          emailLocalPart ||
          'Parent';

        const resolvedDisplayName =
          (currentUser.displayName && currentUser.displayName.trim()) ||
          (userCtxFullName && String(userCtxFullName).trim()) ||
          (canonicalFullName && canonicalFullName.trim()) ||
          (authFullName && String(authFullName).trim()) ||
          derivedFallbackName;

        const resolvedHandle =
          currentHandle ||
          generateIntelligentUsername(resolvedDisplayName, currentUser.id);

        const initialData = {
          displayName: resolvedDisplayName,
          handle: resolvedHandle,
          bio: currentUser.bio || '',
          avatar: canonicalAvatar || currentUser.avatar || '',
          coverPhoto: canonicalCover || currentUser.coverPhoto || '',
          location: resolvedLocation,
          isPublic: true,
          notificationsEnabled: true,
          showActivityStatus: true,
          allowMessages: true,
        };

        if (isMountedRef.current) {
          setFormData(initialData);
          setOriginalData(initialData);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
    setIsHydrating(false);
    isLoadingRef.current = false;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFeed();
      await refreshTopicsData();
      await loadUserData();
      await refreshUserData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeed, refreshTopicsData]);

  /* ═══════════════════════════════════════════════════════════════════════
     IMAGE UPLOAD
     ═══════════════════════════════════════════════════════════════════════ */

  const ensureBucket = useCallback(async (bucket: string) => {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (error && /not found/i.test(error.message)) {
        await supabase.storage.createBucket(bucket, { public: true });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const uploadImageToStorage = useCallback(async (
    localUri: string,
    userId: string,
    type: 'avatar' | 'cover'
  ): Promise<string | null> => {
    try {
      if (type === 'avatar') setAvatarUploading(true);
      else setCoverUploading(true);

      const fileData = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const fileName = generateUniqueFileName(userId, safeExt);

      const bucket = type === 'avatar' ? COMMUNITY_AVATARS_BUCKET : COMMUNITY_COVERS_BUCKET;
      const filePath = type === 'avatar' ? `avatars/${fileName}` : `covers/${fileName}`;

      await ensureBucket(bucket);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, decode(fileData), {
          contentType: `image/${safeExt}`,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[uploadImageToStorage] Upload error for ${type}:`, uploadError);
        if (type === 'avatar') setAvatarUploading(false);
        else setCoverUploading(false);
        return localUri;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const updateData =
        type === 'avatar'
          ? { community_avatar: publicUrl, avatar_url: publicUrl }
          : { community_cover: publicUrl };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.warn(`[uploadImageToStorage] Profile update error for ${type}:`, updateError.message);
      }

      if (type === 'avatar') setAvatarUploading(false);
      else setCoverUploading(false);
      return publicUrl;
    } catch (error) {
      console.error(`[uploadImageToStorage] Error uploading ${type}:`, error);
      if (type === 'avatar') setAvatarUploading(false);
      else setCoverUploading(false);
      return null;
    }
  }, [ensureBucket]);

  const COMMUNITY_IMAGES_DIR = FileSystem.documentDirectory + 'community_images/';

  const persistCommunityImage = async (sourceUri: string): Promise<string | null> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(COMMUNITY_IMAGES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(COMMUNITY_IMAGES_DIR, { intermediates: true });
      }
      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const processedUri = `${COMMUNITY_IMAGES_DIR}${Date.now()}.${safeExt}`;

      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(processedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(processedUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          throw new Error('Invalid data URI');
        }
      } else {
        await FileSystem.copyAsync({ from: sourceUri, to: processedUri });
      }

      const fileInfo = await FileSystem.getInfoAsync(processedUri);
      if (!fileInfo.exists) {
        console.error('[persistCommunityImage] File not found:', processedUri);
        return null;
      }
      return processedUri;
    } catch (error) {
      console.error('[persistCommunityImage] Failed:', error);
      return null;
    }
  };

  const handleImagePick = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);

    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Please allow access to your photo library', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      let processedUri = rawUri;
      try { processedUri = await compressImage(rawUri, 0.8); } catch (e) {}
      const permanentUri = await persistCommunityImage(processedUri);
      if (!permanentUri) {
        sweetAlert.error('Error', 'Failed to save image permanently');
        setIsSaving(false);
        return;
      }

      const userId = currentUser?.id;
      if (!userId) {
        sweetAlert.error('Error', 'User not authenticated');
        setIsSaving(false);
        return;
      }

      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);

      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else {
        sweetAlert.error('Upload Failed', 'Could not upload image');
      }

      triggerHaptic('success');
      await refreshUserData();
    } catch (error) {
      console.error(`[handleImagePick] Error:`, error);
      sweetAlert.error('Error', 'Failed to process image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);

    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
        cameraType: type === 'avatar' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      const permanentUri = await persistCommunityImage(rawUri);
      if (!permanentUri) {
        sweetAlert.error('Error', 'Failed to save photo');
        setIsSaving(false);
        return;
      }

      const userId = currentUser?.id;
      if (!userId) {
        sweetAlert.error('Error', 'User not authenticated');
        setIsSaving(false);
        return;
      }

      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);

      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else {
        sweetAlert.error('Upload Failed', 'Could not upload image');
      }

      triggerHaptic('success');
      await refreshUserData();
    } catch (error) {
      console.error(`[handleTakePhoto] Error:`, error);
      sweetAlert.error('Error', 'Failed to take photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);

    sweetAlert.confirm(
      `Remove ${type === 'avatar' ? 'Photo' : 'Cover Photo'}`,
      `Remove your ${type === 'avatar' ? 'profile picture' : 'cover photo'}?`,
      async () => {
        const userId = currentUser?.id;
        if (!userId) return;

        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: '' }));
          setOriginalData(prev => ({ ...prev, avatar: '' }));
          await updateCommunityProfile({ avatar: '' });
          await updateUserContextProfile({ avatar: '' });
          try {
            await supabase.from('profiles').update({ community_avatar: '', avatar_url: '' }).eq('id', userId);
          } catch {}
          sweetAlert.success('Photo Removed', 'Profile picture removed');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: '' }));
          setOriginalData(prev => ({ ...prev, coverPhoto: '' }));
          await updateCommunityProfile({ coverPhoto: '' });
          try {
            await supabase.from('profiles').update({ community_cover: '' }).eq('id', userId);
          } catch {}
          sweetAlert.success('Cover Photo Removed', 'Cover photo removed');
        }
        await refreshUserData();
      },
      () => {},
      'Remove',
      'Cancel'
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setOriginalData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════════════ */

  const handleShareProfile = async () => {
    if (!currentUser) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${currentUser.displayName} on LittleLoom! ${currentUser.handle}`,
        title: `${currentUser.displayName}'s Profile`
      });
    } catch (error) { console.error('Error sharing profile:', error); }
  };

  const handleDeactivateProfile = async () => {
    sweetAlert.confirm(
      'Deactivate Profile',
      'Your profile will be hidden from others. You can reactivate anytime by signing in again.',
      async () => {
        try {
          setIsProfileDeactivated(true);
          await updateCommunityProfile({ isPublic: false, onlineStatus: 'offline' });
          sweetAlert.success('Deactivated', 'Your profile is now hidden');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          sweetAlert.error('Error', 'Failed to deactivate profile');
        }
      },
      () => {},
      'Deactivate',
      'Cancel'
    );
  };

  const handleReactivateProfile = async () => {
    try {
      setIsProfileDeactivated(false);
      await updateCommunityProfile({ isPublic: true, onlineStatus: 'online' });
      sweetAlert.success('Reactivated', 'Your profile is now visible');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      sweetAlert.error('Error', 'Failed to reactivate profile');
    }
  };

  const handleDeleteCommunityAccount = useCallback(() => {
    sweetAlert.confirm(
      'Delete Community Profile',
      '⚠️ This will permanently delete your community profile, all posts, comments, and activity. This cannot be undone.',
      async () => {
        const result = await deleteAccountWithConfirmation();
        if (result.success) {
          sweetAlert.success('Account Deleted', result.message);
          navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        } else {
          sweetAlert.error('Error', result.message);
        }
      },
      () => {},
      'Delete',
      'Cancel'
    );
  }, [deleteAccountWithConfirmation, navigation, sweetAlert]);

  const handleSave = async () => {
    if (!currentUser) return;

    let effectiveDisplayName = (formData.displayName || '').trim();
    if (!effectiveDisplayName) {
      const fallback =
        (currentUser.displayName || '').trim() ||
        ((profile as any)?.fullName || '').toString().trim() ||
        ((userProfile as any)?.fullName || '').toString().trim() ||
        (currentUser.handle || '').replace(/^@+/, '').replace(/[_.]/g, ' ').trim() ||
        (currentUser.email || '').split('@')[0] ||
        'Parent';
      effectiveDisplayName = fallback;
      setFormData(prev => ({ ...prev, displayName: effectiveDisplayName }));
    }

    if (!effectiveDisplayName) {
      sweetAlert.error('Validation Error', 'Display name is required');
      triggerHaptic('error');
      return;
    }

    const cleanHandle = formData.handle
      .replace(/^@+/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.]/g, '');

    if (!cleanHandle || cleanHandle.length < 3) {
      sweetAlert.error('Validation Error', 'Username must be at least 3 characters');
      triggerHaptic('error');
      return;
    }

    setIsSaving(true);
    triggerHaptic('medium');
    try {
      const handle = formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`;
      const updates: any = {
        displayName: effectiveDisplayName,
        handle: handle.toLowerCase(),
        bio: formData.bio.trim(),
        avatar: formData.avatar,
        coverPhoto: formData.coverPhoto,
        country: formData.location,
        isPublic: formData.isPublic,
        notificationsEnabled: formData.notificationsEnabled,
        showActivityStatus: formData.showActivityStatus,
        allowMessages: formData.allowMessages,
      };

      const originalClean = originalData.handle.replace(/^@+/, '').toLowerCase();
      if (cleanHandle !== originalClean) {
        const result = await updateUsername(originalClean, cleanHandle, currentUser.id);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);

      await syncUserProfileAcrossPosts(currentUser.id, {
        displayName: updates.displayName,
        handle: updates.handle,
        avatar: updates.avatar,
      });

      await checkAndAwardAchievements();

      triggerHaptic('success');
      setIsEditing(false);
      setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
    } catch (error: any) {
      triggerHaptic('error');
      sweetAlert.error('Save Failed', error.message || 'Please try again');
    }
    setIsSaving(false);
  };

  const hasChanges = useMemo(() =>
    Object.keys(formData).some(key =>
      formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]
    ), [formData, originalData]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: PROFILE HEADER (no hero card - clean modern profile)
     ═══════════════════════════════════════════════════════════════════════ */

  const renderProfileHeader = () => {
    if (!currentUser) return null;

    const avatarSource = formData.avatar || currentUser.avatar;
    const isEmoji = isEmojiAvatar(avatarSource);
    const isUrl = avatarSource && (avatarSource.startsWith('http') || avatarSource.startsWith('file://'));

    return (
      <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.profileHeader}>
        {/* Avatar with pulse ring */}
        <PulseRing
          size={100}
          isOnline={!isProfileDeactivated}
          isVerified={currentUser.isVerified}
          roleColor={roleConfig.color}
          onPress={isEditing ? () => setShowImagePicker(true) : undefined}
          isEditing={isEditing}
        >
          {avatarSource ? (
            isEmoji ? (
              <View style={[styles.avatarContent, { backgroundColor: `${roleConfig.color}15` }]}>
                <Text style={styles.avatarEmoji}>{avatarSource}</Text>
              </View>
            ) : isUrl ? (
              <Image source={{ uri: avatarSource }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={[styles.avatarContent, { backgroundColor: roleConfig.color }]}>
                <Text style={styles.avatarInitial}>{currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )
          ) : (
            <View style={[styles.avatarContent, { backgroundColor: roleConfig.color }]}>
              <Text style={styles.avatarInitial}>{currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </PulseRing>

        {/* Name & Handle */}
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{currentUser.displayName}</Text>
            {currentUser.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: roleConfig.color }]}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.handle}>@{currentUser.handle?.replace(/^@/, '')}</Text>
        </View>

        {/* Role pill + Location */}
        <View style={styles.metaRow}>
          <View style={[styles.rolePill, { backgroundColor: `${roleConfig.color}12` }]}>
            <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
            <Text style={[styles.rolePillText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
          </View>
          {formData.location && (
            <View style={styles.locationPill}>
              <Ionicons name="location-outline" size={12} color={DS.gray500} />
              <Text style={styles.locationPillText} numberOfLines={1}>{formData.location}</Text>
            </View>
          )}
          {isEditing && (
            <View style={styles.editingPill}>
              <View style={styles.editingDot} />
              <Text style={styles.editingPillText}>Editing</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {(formData.bio || currentUser.bio) && !isEditing && (
          <Text style={styles.bio} numberOfLines={3}>{formData.bio || currentUser.bio}</Text>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatPill icon="📝" value={userPostList.length} label="Posts" color={DS.primary} />
          <StatPill icon="👥" value={followerCount} label="Followers" color={DS.accent} onPress={() => navigation.navigate('Followers', { userId: currentUser.id })} />
          <StatPill icon="➕" value={followingCount} label="Following" color={DS.success} onPress={() => navigation.navigate('Following', { userId: currentUser.id })} />
          <StatPill icon="🔥" value={currentUser.stats?.streakDays || 0} label="Streak" color={DS.warning} />
        </View>

        {/* Edit Form (when editing) */}
        {isEditing && (
          <Animated.View entering={FadeInUp.springify()} style={[styles.editCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Display Name</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={formData.displayName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, displayName: text }))}
                placeholder="Your name"
                placeholderTextColor={DS.gray400}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Username</Text>
              <View style={[styles.editInputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                <Text style={styles.editAt}>@</Text>
                <TextInput
                  style={[styles.editInput, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}
                  value={formData.handle.replace(/^@/, '')}
                  onChangeText={(text) => {
                    const cleaned = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '');
                    setFormData(prev => ({ ...prev, handle: cleaned }));
                  }}
                  placeholder="username"
                  placeholderTextColor={DS.gray400}
                  autoCapitalize="none"
                />
                {isCheckingUsername && <ActivityIndicator size="small" color={DS.primary} />}
                {!isCheckingUsername && usernameCheckStatus && (
                  <Ionicons name={usernameCheckStatus.available ? 'checkmark-circle' : 'alert-circle'} size={18} color={usernameCheckStatus.available ? DS.success : DS.danger} />
                )}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Bio</Text>
              <TextInput
                style={[styles.editInput, styles.editInputMulti, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={formData.bio}
                onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
                placeholder="Tell us about yourself..."
                placeholderTextColor={DS.gray400}
                multiline
                maxLength={160}
              />
              <Text style={styles.editCharCount}>{formData.bio.length}/160</Text>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Location</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={formData.location}
                onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                placeholder={locationDetected?.full || "City, Country"}
                placeholderTextColor={DS.gray400}
              />
            </View>
          </Animated.View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {!isEditing ? (
            <>
              <PressableScale onPress={() => setIsEditing(true)} activeScale={0.95} hapticType="light">
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.actionBtnPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>Edit Profile</Text>
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={handleShareProfile} activeScale={0.95} hapticType="light">
                <View style={[styles.actionBtnSecondary, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="share-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
                </View>
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale onPress={handleSave} activeScale={0.95} hapticType="success" disabled={isSaving}>
                <LinearGradient colors={[DS.success, '#34d399']} style={styles.actionBtnPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.actionBtnPrimaryText}>Save</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={() => { setIsEditing(false); setFormData({ ...originalData }); }} activeScale={0.95}>
                <View style={[styles.actionBtnSecondary, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="close" size={18} color={isDark ? DS.gray300 : DS.gray600} />
                </View>
              </PressableScale>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: OVERVIEW TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderOverviewTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabContent}>
      {/* Influence Score */}
      <InfluenceMeter metrics={influenceMetrics} isDark={isDark} />

      {/* Community Standing */}
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={styles.standingHeader}>
          <View style={[styles.standingIcon, { backgroundColor: `${DS.warning}15` }]}>
            <Ionicons name="trophy" size={18} color={DS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.standingTitle, { color: isDark ? DS.white : DS.gray900 }]}>Community Standing</Text>
            <Text style={[styles.standingSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Top {communityStanding.percentile}% of {allUsers.length} members</Text>
          </View>
          <View style={[styles.standingBadge, { backgroundColor: `${DS.warning}12` }]}>
            <Text style={[styles.standingBadgeText, { color: DS.warning }]}>{communityStanding.rank}</Text>
          </View>
        </View>
        <View style={styles.standingProgress}>
          <View style={styles.standingProgressHeader}>
            <Text style={[styles.standingProgressLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Next: {communityStanding.nextMilestone}</Text>
            <Text style={[styles.standingProgressValue, { color: DS.warning }]}>{communityStanding.progressToNext}%</Text>
          </View>
          <View style={[styles.standingProgressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Animated.View entering={FadeInRight.delay(200).springify()} style={[styles.standingProgressFill, { width: `${communityStanding.progressToNext}%`, backgroundColor: DS.warning }]} />
          </View>
        </View>
      </View>

      {/* Topic Affinities */}
      {topicAffinities.length > 0 && (
        <View>
          <SectionHeader title="Your Topics" subtitle="Where you contribute most" icon="pricetags-outline" color={DS.info} />
          <View style={styles.topicsGrid}>
            {topicAffinities.map(topic => <TopicChip key={topic.topicId} topic={topic} />)}
          </View>
        </View>
      )}

      {/* Recent Badges */}
      {(currentUser?.achievements?.length ?? 0) > 0 && (
        <View>
          <SectionHeader title="Recent Badges" icon="ribbon-outline" color={DS.accent} action={() => handleTabChange('achievements')} actionLabel="See All" />
          <View style={styles.badgesRow}>
            {(currentUser?.achievements || []).slice(0, 5).map(id => <AchievementBadge key={id} id={id} compact />)}
          </View>
        </View>
      )}

      {/* Content Breakdown */}
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Content Breakdown</Text>
        <View style={styles.breakdownGrid}>
          {[
            { label: 'Posts', value: contentBreakdown.posts, color: DS.primary, icon: 'document-text' },
            { label: 'Comments', value: contentBreakdown.comments, color: DS.info, icon: 'chatbubble' },
            { label: 'Reactions', value: contentBreakdown.reactions, color: DS.accent, icon: 'heart' },
            { label: 'Shares', value: contentBreakdown.shares, color: DS.success, icon: 'share' },
          ].map(item => (
            <View key={item.label} style={styles.breakdownItem}>
              <View style={[styles.breakdownIcon, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
              <Text style={[styles.breakdownLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Manage Topics Button */}
      <PressableScale onPress={() => navigation.navigate('CommunityOnboarding', { editing: true })} activeScale={0.98}>
        <View style={[styles.manageBtn, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.manageIcon, { backgroundColor: `${DS.primary}12` }]}>
            <Ionicons name="pricetags-outline" size={18} color={DS.primary} />
          </View>
          <Text style={[styles.manageText, { color: isDark ? DS.white : DS.gray900 }]}>
            Manage Topics {selectedTopics.length > 0 ? `(${selectedTopics.length})` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
        </View>
      </PressableScale>
    </Animated.View>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: POSTS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderPostsTab = () => {
    const posts = userPostList.slice(0, 20);

    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabContent}>
        {posts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${DS.primary}10` }]}>
              <Ionicons name="document-text-outline" size={36} color={DS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No posts yet</Text>
            <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Share your first story with the community!</Text>
            <PressableScale onPress={() => navigation.navigate('CreatePost', {})} activeScale={0.97} hapticType="medium">
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Create Post</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {posts.map((post, index) => {
              const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
              const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || DS.primary;
              return (
                <Animated.View key={post.id} entering={FadeInUp.delay(index * 40).springify()}>
                  <PressableScale onPress={() => navigation.navigate('PostDetail', { postId: post.id })} activeScale={0.98}>
                    <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <View style={styles.postHeader}>
                        <View style={[styles.postTopic, { backgroundColor: `${topicColor}12` }]}>
                          <View style={[styles.postTopicDot, { backgroundColor: topicColor }]} />
                          <Text style={[styles.postTopicText, { color: topicColor }]} numberOfLines={1}>{topic?.name || 'General'}</Text>
                        </View>
                        <Text style={styles.postTime}>{post.time}</Text>
                      </View>
                      <Text style={[styles.postContent, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={3}>{post.content}</Text>
                      {post.images && post.images.length > 0 && (
                        <Image source={{ uri: post.images[0] }} style={styles.postImage} resizeMode="cover" />
                      )}
                      <View style={styles.postStats}>
                        <View style={styles.postStat}>
                          <Ionicons name="heart" size={14} color={post.isLiked ? DS.danger : DS.gray400} />
                          <Text style={styles.postStatText}>{post.likes}</Text>
                        </View>
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble" size={14} color={DS.gray400} />
                          <Text style={styles.postStatText}>{post.commentsCount}</Text>
                        </View>
                        <View style={styles.postStat}>
                          <Ionicons name="eye" size={14} color={DS.gray400} />
                          <Text style={styles.postStatText}>{post.viewCount || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        )}
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: ACHIEVEMENTS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderAchievementsTab = () => {
    const achievements = currentUser?.achievements || [];

    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabContent}>
        {achievements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${DS.warning}10` }]}>
              <Ionicons name="trophy-outline" size={36} color={DS.warning} />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No achievements yet</Text>
            <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Start posting and engaging to earn badges!</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {achievements.map((id, index) => (
              <Animated.View key={id} entering={FadeInUp.delay(index * 50).springify()}>
                <AchievementBadge id={id} />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: SETTINGS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderSettingsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabContent}>
      {/* Privacy Settings */}
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Privacy & Preferences</Text>
        {[
          { key: 'isPublic', icon: 'globe-outline', label: 'Public Profile', desc: 'Allow others to find you' },
          { key: 'showActivityStatus', icon: 'eye-outline', label: 'Activity Status', desc: 'Show when you are online' },
          { key: 'allowMessages', icon: 'chatbubbles-outline', label: 'Direct Messages', desc: 'Allow others to message you' },
          { key: 'notificationsEnabled', icon: 'notifications-outline', label: 'Notifications', desc: 'Receive alerts' },
        ].map((pref, i, arr) => (
          <View key={pref.key}>
            <View style={styles.settingsRow}>
              <View style={[styles.settingsIcon, { backgroundColor: formData[pref.key as keyof typeof formData] ? `${DS.primary}12` : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name={pref.icon as any} size={18} color={formData[pref.key as keyof typeof formData] ? DS.primary : DS.gray400} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsLabel, { color: isDark ? DS.white : DS.gray900 }]}>{pref.label}</Text>
                <Text style={[styles.settingsDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>{pref.desc}</Text>
              </View>
              <Switch
                value={formData[pref.key as keyof typeof formData] as boolean}
                onValueChange={(val) => setFormData(prev => ({ ...prev, [pref.key]: val }))}
                trackColor={{ false: '#334155', true: DS.primary }}
                thumbColor="#fff"
              />
            </View>
            {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: isDark ? DS.darkBorder : DS.gray100 }]} />}
          </View>
        ))}
      </View>

      {/* Danger Zone */}
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: `${DS.danger}20` }]}>
        <LinearGradient colors={[`${DS.danger}06`, 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={styles.dangerHeader}>
          <View style={[styles.dangerIcon, { backgroundColor: `${DS.danger}12` }]}>
            <Ionicons name="warning" size={18} color={DS.danger} />
          </View>
          <Text style={[styles.dangerTitle, { color: DS.danger }]}>Danger Zone</Text>
        </View>

        <PressableScale onPress={isProfileDeactivated ? handleReactivateProfile : handleDeactivateProfile} activeScale={0.97}>
          <View style={[styles.dangerAction, { backgroundColor: `${isProfileDeactivated ? DS.success : DS.warning}08` }]}>
            <Ionicons name={isProfileDeactivated ? 'refresh' : 'pause-circle'} size={18} color={isProfileDeactivated ? DS.success : DS.warning} />
            <Text style={[styles.dangerActionText, { color: isProfileDeactivated ? DS.success : DS.warning }]}>
              {isProfileDeactivated ? 'Reactivate Profile' : 'Deactivate Profile'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
          </View>
        </PressableScale>

        <PressableScale onPress={handleDeleteCommunityAccount} activeScale={0.97}>
          <View style={[styles.dangerAction, { backgroundColor: `${DS.danger}08`, marginTop: 8 }]}>
            <Ionicons name="person-remove" size={18} color={DS.danger} />
            <Text style={[styles.dangerActionText, { color: DS.danger }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="person-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: DS.gray500 }}>Not signed in</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.97} style={{ marginTop: 20 }}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  const tabs: { key: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'posts', label: 'Posts', icon: 'document-text-outline' },
    { key: 'achievements', label: 'Badges', icon: 'trophy-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>{currentUser.displayName}</Text>
        <Text style={styles.stickySub}>@{currentUser.handle?.replace(/^@/, '')}</Text>
      </Animated.View>

      {/* Top Nav */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topNav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.navBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
          <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
        </TouchableOpacity>
        <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.navTitle}>PROFILE</GradientText>
        <TouchableOpacity onPress={handleShareProfile} style={[styles.navBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
          <Ionicons name="share-outline" size={20} color={isDark ? DS.white : DS.gray800} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />
        }
      >
        {isHydrating && !formData.displayName ? (
          <ProfileSkeleton isDark={isDark} />
        ) : (
          <>
            {renderProfileHeader()}

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
            </View>

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'posts' && renderPostsTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
              {activeTab === 'settings' && renderSettingsTab()}
            </View>
          </>
        )}
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving || avatarUploading || coverUploading} text={avatarUploading ? "Uploading..." : coverUploading ? "Uploading..." : "Saving..."} size="medium" overlay blur section="main" />

      {/* Image Picker Modal */}
      <Modal visible={showImagePicker} transparent animationType="fade" onRequestClose={() => setShowImagePicker(false)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowImagePicker(false)} />
          <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Change Profile Photo</Text>
            <View style={{ gap: 8, marginTop: 16 }}>
              <PressableScale onPress={() => handleImagePick('avatar')} activeScale={0.97}>
                <View style={[styles.modalOption, { backgroundColor: `${DS.primary}10` }]}>
                  <Ionicons name="images-outline" size={24} color={DS.primary} />
                  <Text style={[styles.modalOptionText, { color: isDark ? DS.white : DS.gray900 }]}>Choose from Library</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={() => handleTakePhoto('avatar')} activeScale={0.97}>
                <View style={[styles.modalOption, { backgroundColor: `${DS.warning}10` }]}>
                  <Ionicons name="camera-outline" size={24} color={DS.warning} />
                  <Text style={[styles.modalOptionText, { color: isDark ? DS.white : DS.gray900 }]}>Take Photo</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }} activeScale={0.97}>
                <View style={[styles.modalOption, { backgroundColor: `${DS.success}10` }]}>
                  <Ionicons name="happy-outline" size={24} color={DS.success} />
                  <Text style={[styles.modalOptionText, { color: isDark ? DS.white : DS.gray900 }]}>Pick Emoji</Text>
                </View>
              </PressableScale>
              {(formData.avatar || currentUser.avatar) && (
                <PressableScale onPress={() => handleRemoveImage('avatar')} activeScale={0.97}>
                  <View style={[styles.modalOption, { backgroundColor: `${DS.danger}10` }]}>
                    <Ionicons name="trash-outline" size={24} color={DS.danger} />
                    <Text style={[styles.modalOptionText, { color: DS.danger }]}>Remove Photo</Text>
                  </View>
                </PressableScale>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
          <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Pick an Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleEmojiSelect(emoji)} style={[styles.emojiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky Header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    alignItems: 'center', paddingHorizontal: DS.space.xl, paddingBottom: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  stickyTitle: { fontSize: 16, fontWeight: '800' },
  stickySub: { fontSize: 11, fontWeight: '500', color: DS.gray400, marginTop: 2 },

  /* Top Nav */
  topNav: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, paddingBottom: DS.space.md,
  },
  navBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* Profile Header */
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.md,
  },
  avatarContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 48 },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: '#fff' },

  nameSection: { alignItems: 'center', marginTop: DS.space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { fontSize: 24, fontWeight: '800', color: DS.gray900, letterSpacing: -0.5 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  handle: { fontSize: 14, fontWeight: '500', color: DS.gray500, marginTop: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: DS.space.md, flexWrap: 'wrap', justifyContent: 'center' },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.04)' },
  locationPillText: { fontSize: 12, fontWeight: '500', color: DS.gray500, maxWidth: 150 },
  editingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: `${DS.warning}15` },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.warning },
  editingPillText: { fontSize: 12, fontWeight: '700', color: DS.warning },

  bio: { fontSize: 14, fontWeight: '500', color: DS.gray600, textAlign: 'center', marginTop: DS.space.md, lineHeight: 20, paddingHorizontal: DS.space.lg },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: DS.space.lg, width: '100%' },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  statPillIcon: { fontSize: 18, marginBottom: 4 },
  statPillValue: { fontSize: 18, fontWeight: '800' },
  statPillLabel: { fontSize: 10, fontWeight: '600', color: DS.gray500, textTransform: 'uppercase' },

  /* Edit Form */
  editCard: { width: '100%', marginTop: DS.space.lg, padding: DS.space.lg, borderRadius: DS.radius.xl, borderWidth: 1 },
  editField: { marginBottom: DS.space.md },
  editLabel: { fontSize: 11, fontWeight: '700', color: DS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  editInput: { height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '500' },
  editInputRow: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 12, paddingHorizontal: 14, gap: 4 },
  editAt: { fontSize: 16, fontWeight: '700', color: DS.primary },
  editInputMulti: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  editCharCount: { fontSize: 11, color: DS.gray400, textAlign: 'right', marginTop: 4 },

  /* Action Row */
  actionRow: { flexDirection: 'row', gap: 10, marginTop: DS.space.lg, width: '100%' },
  actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionBtnSecondary: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Tab Bar */
  tabBar: { flexDirection: 'row', padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Tab Content */
  tabContent: { gap: DS.space.lg, paddingBottom: DS.space['3xl'] },

  /* Card */
  card: { borderRadius: DS.radius.lg, padding: DS.space.lg, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: DS.space.md },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: DS.gray900, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', color: DS.gray500, marginTop: 1 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Influence */
  influenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: DS.space.md },
  influenceTitle: { fontSize: 15, fontWeight: '800' },
  influenceSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  influenceScore: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  influenceScoreText: { fontSize: 20, fontWeight: '800' },
  influenceGrid: { gap: DS.space.sm },
  influenceItem: { gap: 4 },
  influenceItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  influenceItemLabel: { fontSize: 11, fontWeight: '600', flex: 1 },
  influenceItemValue: { fontSize: 11, fontWeight: '700' },
  influenceBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  influenceBarFill: { height: '100%', borderRadius: 3 },

  /* Standing */
  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md },
  standingIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  standingTitle: { fontSize: 14, fontWeight: '700' },
  standingSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  standingBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  standingBadgeText: { fontSize: 11, fontWeight: '700' },
  standingProgress: { gap: 6 },
  standingProgressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  standingProgressLabel: { fontSize: 11, fontWeight: '500' },
  standingProgressValue: { fontSize: 11, fontWeight: '700' },
  standingProgressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  standingProgressFill: { height: '100%', borderRadius: 3 },

  /* Topics */
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, minWidth: '47%' },
  topicChipEmoji: { fontSize: 18 },
  topicChipName: { fontSize: 12, fontWeight: '700' },
  topicChipPosts: { fontSize: 10, fontWeight: '500', color: DS.gray500, marginTop: 1 },

  /* Badges */
  badgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  achievementBadgeCompact: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  achievementBadgeEmoji: { fontSize: 22 },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  achievementBadgeName: { fontSize: 13, fontWeight: '700' },
  achievementBadgeDesc: { fontSize: 11, fontWeight: '500', color: DS.gray500, marginTop: 1 },

  /* Breakdown */
  breakdownGrid: { flexDirection: 'row', gap: 8 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
  breakdownIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 10, fontWeight: '600' },

  /* Manage Button */
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: DS.space.md, borderRadius: 14, borderWidth: 1 },
  manageIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  manageText: { flex: 1, fontSize: 14, fontWeight: '600' },

  /* Post Card */
  postCard: { padding: DS.space.md, borderRadius: 16, borderWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  postTopic: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: '70%' },
  postTopicDot: { width: 5, height: 5, borderRadius: 3 },
  postTopicText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  postTime: { fontSize: 10, fontWeight: '500', color: DS.gray400 },
  postContent: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 10 },
  postImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  postStats: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, fontWeight: '600', color: DS.gray500 },

  /* Empty */
  emptyCard: { alignItems: 'center', padding: DS.space['3xl'], borderRadius: 18, borderWidth: 1 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: DS.space.lg },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Settings */
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { fontSize: 14, fontWeight: '600' },
  settingsDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  divider: { height: 1, marginLeft: 48 },

  /* Danger */
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: DS.space.md },
  dangerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 15, fontWeight: '800' },
  dangerAction: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  dangerActionText: { flex: 1, fontSize: 13, fontWeight: '600' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14 },
  modalOptionText: { fontSize: 15, fontWeight: '600' },

  /* Emoji Grid */
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 },
  emojiBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
});