import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { CommunityStackParamList } from '../../types/navigation';
import { CommunityUser, Post, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { supabase } from '@/utils/supabase';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
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

const TOPIC_COLORS: Record<string, string> = {
  topic_1: '#6366f1', topic_2: '#10b981', topic_3: '#ec4899',
  topic_4: '#f59e0b', topic_5: '#fc5c7d', topic_6: '#8b5cf6',
  topic_7: '#f093fb', topic_8: '#4facfe', topic_9: '#ec4899',
  topic_10: '#43e97b', topic_11: '#ec4899', topic_12: '#6366f1',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#f59e0b', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#8b5cf6', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

type ProfileTab = 'posts' | 'about' | 'achievements' | 'insights';

const isEmojiAvatar = (avatar: string | undefined): boolean => {
  if (!avatar) return false;
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

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
   PULSE RING
   ═══════════════════════════════════════════════════════════════════════════ */

const PulseRing = React.memo(({
  children, size, isOnline, roleColor, onPress,
}: {
  children: React.ReactNode;
  size: number;
  isOnline?: boolean;
  roleColor: string;
  onPress?: () => void;
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
   PROFILE SKELETON
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
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CommunityMemberProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const {
    currentUser,
    getUserById,
    getUserPosts,
    followUser,
    unfollowUser,
    isFollowing,
    blockUser,
    isUserBlocked,
    getFollowers,
    getFollowing,
    getAllUsers,
    refreshFeed,
    syncUserProfileAcrossPosts,
  } = useCommunity();
  const { communityProfile } = useUser();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const isOwnProfile = currentUser?.id === userId;
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!currentUser?.id || !communityProfile) return;
    const hasChanges =
      communityProfile.displayName !== currentUser.displayName ||
      communityProfile.handle !== currentUser.handle ||
      communityProfile.avatar !== currentUser.avatar;

    if (hasChanges) {
      syncUserProfileAcrossPosts(currentUser.id, {
        displayName: communityProfile.displayName,
        handle: communityProfile.handle,
        avatar: communityProfile.avatar,
      });
    }
  }, [communityProfile, currentUser, syncUserProfileAcrossPosts]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const userPostList = useMemo(() => getUserPosts(userId), [userId, getUserPosts]);

  /* Derived data */
  const engagementInsights = useMemo(() => {
    const totalLikes = userPostList.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = userPostList.reduce((sum, p) => sum + p.commentsCount, 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);

    return [
      { icon: '❤️', label: 'Likes', value: totalLikes, color: DS.danger },
      { icon: '💬', label: 'Comments', value: totalComments, color: DS.info },
      { icon: '👁️', label: 'Views', value: totalViews, color: DS.primary },
    ];
  }, [userPostList]);

  const influenceMetrics = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);

    const avgEngagement = totalPosts > 0 ? Math.min(100, Math.round(((totalLikes + totalComments * 2) / totalPosts) * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round((totalHelpful / Math.max(1, totalPosts)) * 15));
    const reach = Math.min(100, Math.round((totalViews / Math.max(1, totalPosts * 10)) * 100));

    return [
      { label: 'Engagement', value: avgEngagement, color: DS.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: DS.accent, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: DS.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: DS.warning, icon: 'eye' },
    ];
  }, [userPostList]);

  const communityInfluence = useMemo(() => {
    const userPostCount = userPostList.length;
    const allPostCounts = allUsers.map((u) => getUserPosts(u.id).length);
    const sortedCounts = [...allPostCounts].sort((a, b) => b - a);
    const rank = sortedCounts.findIndex((c) => c <= userPostCount) + 1;
    const percentile = Math.min(100, Math.round((1 - rank / Math.max(1, allUsers.length)) * 100));

    const totalEngagement = userPostList.reduce((sum, p) => sum + p.likes + p.commentsCount * 2, 0);
    let rankLabel = 'New Parent';
    if (userPostCount > 100 && totalEngagement > 500) rankLabel = 'Legendary';
    else if (userPostCount > 50 && totalEngagement > 200) rankLabel = 'Gold Parent';
    else if (userPostCount > 20 && totalEngagement > 50) rankLabel = 'Silver Parent';
    else if (userPostCount > 5) rankLabel = 'Bronze Parent';

    return { score: Math.min(100, Math.round(percentile + 20)), rank: rankLabel, percentile };
  }, [userPostList, allUsers, getUserPosts]);

  const topicBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    userPostList.forEach((p) => {
      counts[p.topicId] = (counts[p.topicId] || 0) + 1;
    });
    const total = userPostList.length || 1;
    return Object.entries(counts)
      .map(([topicId, count]) => ({
        topicId,
        count,
        color: TOPIC_COLORS[topicId] || DS.primary,
        label: INITIAL_TOPICS.find((t) => t.id === topicId)?.name || topicId,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [userPostList]);

  /* Lifecycle */
  useEffect(() => {
    if (userId && !initialLoadDone.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId && !isLoadingRef.current) {
        loadUserData();
      }
      return () => {};
    }, [userId])
  );

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);

    try {
      let targetUser = getUserById(userId);

      if (userId) {
        try {
          const { data: profileRow, error: profileErr } = await supabase
            .from('profiles')
            .select(
              'id, full_name, community_display_name, community_handle, community_username, ' +
                'community_bio, community_avatar, avatar_url, community_cover, is_verified, ' +
                'community_selected_topics, created_at'
            )
            .eq('id', userId)
            .maybeSingle();

          if (!profileErr && profileRow) {
            const fallbackHandle =
              (profileRow.community_handle || '').toString().replace(/^@+/, '') ||
              (profileRow.community_username || '').toString() ||
              (profileRow.full_name || 'parent').toLowerCase().replace(/\s+/g, '_');

            const fromDb: CommunityUser = {
              id: profileRow.id,
              displayName: profileRow.community_display_name || profileRow.full_name || 'Parent',
              handle: `@${fallbackHandle}`,
              avatar: profileRow.community_avatar || profileRow.avatar_url || '👤',
              coverPhoto: profileRow.community_cover || undefined,
              isVerified: !!profileRow.is_verified,
              bio: profileRow.community_bio || '',
              location: '',
              country: 'Unknown',
              onlineStatus: 'offline',
              lastActive: new Date().toISOString(),
              stats: targetUser?.stats || { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
              achievements: targetUser?.achievements || [],
              selectedTopics: Array.isArray(profileRow.community_selected_topics) ? profileRow.community_selected_topics : targetUser?.selectedTopics || [],
              isFollowing: targetUser?.isFollowing,
              following: targetUser?.following,
              followers: targetUser?.followers,
            };

            if (!targetUser) {
              targetUser = fromDb;
            } else {
              targetUser = {
                ...targetUser,
                displayName: fromDb.displayName || targetUser.displayName,
                handle: fromDb.handle || targetUser.handle,
                avatar: fromDb.avatar || targetUser.avatar,
                coverPhoto: fromDb.coverPhoto || targetUser.coverPhoto,
                bio: fromDb.bio || targetUser.bio,
                isVerified: fromDb.isVerified,
                selectedTopics: fromDb.selectedTopics && fromDb.selectedTopics.length > 0 ? fromDb.selectedTopics : targetUser.selectedTopics,
              };
            }
          }
        } catch (fallbackErr) {
          if (__DEV__) console.warn('[CommunityMemberProfile] Supabase fallback failed:', fallbackErr);
        }
      }

      if (targetUser) {
        setUser(targetUser);
        setUserPosts(getUserPosts(userId));
        setIsFollowingUser(isFollowing(userId));
        setIsBlocked(isUserBlocked(userId));
        const followers = await getFollowers(userId);
        const following = await getFollowing(userId);
        if (isMountedRef.current) {
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }
      } else {
        sweetAlert.alert('Not Found', 'User not found', 'warning');
        navigation.goBack();
      }
    } catch (error) {
      if (__DEV__) console.warn('[CommunityMemberProfile] loadUserData error:', error);
      sweetAlert.error('Error', 'Failed to load profile');
    } finally {
      setIsHydrating(false);
      isLoadingRef.current = false;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFeed();
      await loadUserData();
    } catch (e) {
      if (__DEV__) console.warn('[CommunityMemberProfile] refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeed]);

  const handleFollowToggle = useCallback(async () => {
    if (isOwnProfile || !user) return;
    triggerHaptic('medium');
    try {
      if (isFollowingUser) {
        await unfollowUser(userId);
        setFollowerCount((prev) => Math.max(0, prev - 1));
        setIsFollowingUser(false);
        sweetAlert.toast('Unfollowed', `You unfollowed ${user.displayName}`);
      } else {
        await followUser(userId);
        setFollowerCount((prev) => prev + 1);
        setIsFollowingUser(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sweetAlert.toast('Following', `Now following ${user.displayName}`);
      }
    } catch (error) {
      sweetAlert.error('Error', 'Failed to update follow status');
    }
  }, [isOwnProfile, user, isFollowingUser, unfollowUser, followUser, userId, sweetAlert, triggerHaptic]);

  const handleMessage = useCallback(() => {
    if (!user || isBlocked) return;
    triggerHaptic('light');
    navigation.navigate('Chat' as never, { userId } as never);
  }, [user, isBlocked, navigation, triggerHaptic, userId]);

  const handleShareProfile = useCallback(async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`,
        title: `${user.displayName}'s Profile`,
      });
    } catch (error) {
      if (__DEV__) console.warn('Share error:', error);
    }
  }, [user, triggerHaptic]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const roleColor = user?.isVerified ? DS.success : DS.primary;

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: PROFILE HEADER
     ═══════════════════════════════════════════════════════════════════════ */

  const renderProfileHeader = () => {
    if (!user) return null;

    const isOnline = user.onlineStatus === 'online';
    const avatarSource = user.avatar;
    const isAvatarEmoji = isEmojiAvatar(avatarSource);

    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.profileHeader}>
        {/* Avatar with pulse ring */}
        <PulseRing
          size={100}
          isOnline={isOnline}
          roleColor={roleColor}
          onPress={() => setShowAvatarPreview(true)}
        >
          {avatarSource && !isAvatarEmoji ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={[styles.avatarContent, { backgroundColor: `${roleColor}15` }]}>
              <Text style={styles.avatarEmoji}>
                {isAvatarEmoji ? avatarSource : user.displayName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </PulseRing>

        {/* Name & Handle */}
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{user.displayName}</Text>
            {user.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: roleColor }]}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.handle}>{user.handle}</Text>
        </View>

        {/* Bio */}
        {user.bio && (
          <Text style={styles.bio} numberOfLines={3}>{user.bio}</Text>
        )}

        {/* Location */}
        {user.country && user.country !== 'Unknown' && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={DS.gray500} />
            <Text style={styles.locationText}>{user.country}</Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatPill icon="📝" value={userPostList.length} label="Posts" color={DS.primary} />
          <StatPill icon="👥" value={followerCount} label="Followers" color={DS.accent} onPress={() => navigation.navigate('Followers', { userId })} />
          <StatPill icon="➕" value={followingCount} label="Following" color={DS.success} onPress={() => navigation.navigate('Following', { userId })} />
          <StatPill icon="🔥" value={user.stats?.streakDays || 0} label="Streak" color={DS.warning} />
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
            <PressableScale onPress={handleFollowToggle} activeScale={0.95} disabled={isBlocked} hapticType="medium">
              <LinearGradient
                colors={isFollowingUser ? [DS.gray200, DS.gray300] : [DS.primary, DS.accent]}
                style={styles.followBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={isFollowingUser ? 'checkmark' : 'person-add'} size={18} color={isFollowingUser ? DS.gray600 : '#fff'} />
                <Text style={[styles.followBtnText, { color: isFollowingUser ? DS.gray600 : '#fff' }]}>
                  {isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}
                </Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale onPress={handleMessage} activeScale={0.95} disabled={isBlocked}>
              <View style={[styles.actionBtnSecondary, { backgroundColor: `${DS.primary}12` }]}>
                <Ionicons name="chatbubbles" size={18} color={DS.primary} />
              </View>
            </PressableScale>
            <PressableScale onPress={handleShareProfile} activeScale={0.95}>
              <View style={[styles.actionBtnSecondary, { backgroundColor: `${DS.info}12` }]}>
                <Ionicons name="share-outline" size={18} color={DS.info} />
              </View>
            </PressableScale>
          </View>
        )}
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: POSTS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderPostsTab = () => {
    if (userPostList.length === 0) {
      return (
        <Animated.View entering={FadeInUp.springify()} style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={36} color={DS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>This parent hasn't shared any stories yet.</Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInUp.springify()} style={{ gap: 10 }}>
        {userPostList.slice(0, 20).map((post, index) => {
          const topicColor = TOPIC_COLORS[post.topicId] || DS.primary;
          return (
            <Animated.View key={post.id} entering={FadeInUp.delay(index * 40).springify()}>
              <PressableScale onPress={() => navigation.navigate('PostDetail', { postId: post.id })} activeScale={0.98}>
                <View style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={[styles.postTopic, { backgroundColor: `${topicColor}12` }]}>
                      <View style={[styles.postTopicDot, { backgroundColor: topicColor }]} />
                      <Text style={[styles.postTopicText, { color: topicColor }]} numberOfLines={1}>{post.topic}</Text>
                    </View>
                    <Text style={styles.postTime}>{post.time}</Text>
                  </View>
                  <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
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
                      <Ionicons name="repeat" size={14} color={DS.gray400} />
                      <Text style={styles.postStatText}>{post.reposts || 0}</Text>
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
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: ABOUT TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderAboutTab = () => {
    if (!user) return null;
    const totalComments = userPostList.reduce((s, p) => s + p.commentsCount, 0);
    const totalLikes = userPostList.reduce((s, p) => s + p.likes, 0);

    return (
      <Animated.View entering={FadeInUp.springify()} style={{ gap: DS.space.lg }}>
        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          {[
            { icon: 'calendar-outline', label: 'Member Since', value: (user as any).addedAt ? new Date((user as any).addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2024', color: DS.primary },
            { icon: 'flame-outline', label: 'Active Streak', value: `${user.stats?.streakDays || 0} days`, color: DS.warning },
            { icon: 'heart-outline', label: 'Total Likes', value: totalLikes.toString(), color: DS.danger },
            { icon: 'chatbubble-outline', label: 'Total Comments', value: totalComments.toString(), color: DS.info },
          ].map((item, i, arr) => (
            <View key={item.label}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: `${item.color}12` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Topics */}
        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Interested In</Text>
            <View style={styles.topicsWrap}>
              {user.selectedTopics.map((topicId) => {
                const topic = INITIAL_TOPICS.find((t) => t.id === topicId);
                const color = topic?.color || TOPIC_COLORS[topicId] || DS.primary;
                const name = topic?.name || topicId;
                return (
                  <View key={topicId} style={[styles.topicChip, { backgroundColor: `${color}12` }]}>
                    <Text style={[styles.topicChipText, { color }]}>{topic?.emoji ? `${topic.emoji} ${name}` : name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: ACHIEVEMENTS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderAchievementsTab = () => {
    const achievements = user?.achievements || [];

    if (achievements.length === 0) {
      return (
        <Animated.View entering={FadeInUp.springify()} style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: `${DS.warning}10` }]}>
            <Ionicons name="trophy-outline" size={36} color={DS.warning} />
          </View>
          <Text style={styles.emptyTitle}>No achievements yet</Text>
          <Text style={styles.emptyText}>This parent is just getting started!</Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInUp.springify()} style={{ gap: 8 }}>
        {achievements.map((id, index) => {
          const badge = ACHIEVEMENTS[id] || { emoji: '🏅', name: id, color: DS.primary, desc: '' };
          return (
            <Animated.View key={id} entering={FadeInUp.delay(index * 50).springify()}>
              <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}08`, borderColor: `${badge.color}25` }]}>
                <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
                  <Text style={styles.achievementDesc} numberOfLines={1}>{badge.desc}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={badge.color} style={{ opacity: 0.6 }} />
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: INSIGHTS TAB
     ═══════════════════════════════════════════════════════════════════════ */

  const renderInsightsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={{ gap: DS.space.lg }}>
      {/* Engagement Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Engagement</Text>
        <View style={styles.engagementGrid}>
          {engagementInsights.map((insight, i) => (
            <View key={insight.label} style={styles.engagementItem}>
              <Text style={styles.engagementEmoji}>{insight.icon}</Text>
              <Text style={[styles.engagementValue, { color: insight.color }]}>{insight.value}</Text>
              <Text style={styles.engagementLabel}>{insight.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Influence Score */}
      <View style={styles.card}>
        <View style={styles.influenceHeader}>
          <View>
            <Text style={styles.cardTitle}>Influence Score</Text>
            <Text style={styles.influenceSub}>Community impact metrics</Text>
          </View>
          <View style={[styles.influenceScore, { backgroundColor: `${DS.primary}12` }]}>
            <Text style={[styles.influenceScoreText, { color: DS.primary }]}>
              {Math.round(influenceMetrics.reduce((a, b) => a + b.value, 0) / influenceMetrics.length)}
            </Text>
          </View>
        </View>
        <View style={{ gap: DS.space.sm, marginTop: DS.space.md }}>
          {influenceMetrics.map((metric, i) => (
            <View key={metric.label} style={styles.influenceItem}>
              <View style={styles.influenceItemTop}>
                <Ionicons name={metric.icon as any} size={13} color={metric.color} />
                <Text style={styles.influenceItemLabel}>{metric.label}</Text>
                <Text style={[styles.influenceItemValue, { color: metric.color }]}>{metric.value}%</Text>
              </View>
              <View style={styles.influenceBar}>
                <Animated.View
                  entering={FadeInRight.delay(200 + i * 60).springify()}
                  style={[styles.influenceBarFill, { width: `${metric.value}%`, backgroundColor: metric.color }]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Community Standing */}
      <View style={styles.card}>
        <View style={styles.standingHeader}>
          <View style={[styles.standingIcon, { backgroundColor: `${DS.warning}12` }]}>
            <Ionicons name="trophy" size={18} color={DS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Community Standing</Text>
            <Text style={styles.influenceSub}>Top {communityInfluence.percentile}% of {allUsers.length} members</Text>
          </View>
          <View style={[styles.standingBadge, { backgroundColor: `${DS.warning}12` }]}>
            <Text style={[styles.standingBadgeText, { color: DS.warning }]}>{communityInfluence.rank}</Text>
          </View>
        </View>
      </View>

      {/* Topic Breakdown */}
      {topicBreakdown.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Topic Breakdown</Text>
          <View style={{ gap: DS.space.sm, marginTop: DS.space.sm }}>
            {topicBreakdown.map((topic) => (
              <View key={topic.topicId} style={styles.topicBreakdownRow}>
                <View style={styles.topicBreakdownLeft}>
                  <View style={[styles.topicBreakdownDot, { backgroundColor: topic.color }]} />
                  <Text style={styles.topicBreakdownLabel} numberOfLines={1}>{topic.label}</Text>
                </View>
                <View style={styles.topicBreakdownBar}>
                  <View style={[styles.topicBreakdownFill, { width: `${topic.percentage}%`, backgroundColor: topic.color }]} />
                </View>
                <Text style={[styles.topicBreakdownCount, { color: topic.color }]}>{topic.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     GUARDS
     ═══════════════════════════════════════════════════════════════════════ */

  if (!user && !isHydrating) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="person-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: DS.gray500 }}>User not found</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.97} style={{ marginTop: 20 }}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  const tabs: { key: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'posts', label: 'Posts', icon: 'document-text-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'achievements', label: 'Badges', icon: 'trophy-outline' },
    { key: 'insights', label: 'Insights', icon: 'analytics-outline' },
  ];

  /* ═══════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════════════ */

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
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>{user?.displayName || 'Profile'}</Text>
        <Text style={styles.stickySub}>{user?.handle || ''}</Text>
      </Animated.View>

      {/* Top Nav */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topNav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.navBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
          <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
        </TouchableOpacity>
        <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.navTitle}>MEMBER</GradientText>
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
        {isHydrating && !user ? (
          <ProfileSkeleton isDark={isDark} />
        ) : (
          <>
            {renderProfileHeader()}

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
            </View>

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              {activeTab === 'posts' && renderPostsTab()}
              {activeTab === 'about' && renderAboutTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
              {activeTab === 'insights' && renderInsightsTab()}
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Avatar Preview Modal */}
      <Modal
        visible={showAvatarPreview && !!user}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPreview(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.avatarModalOverlay} onPress={() => setShowAvatarPreview(false)}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.avatarModalCard}>
            {user?.avatar && !isEmojiAvatar(user.avatar) ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarModalImage} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.avatarModalImage}>
                <Text style={{ fontSize: 96, textAlign: 'center', lineHeight: 240 }}>
                  {isEmojiAvatar(user?.avatar) ? user?.avatar : user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.avatarModalName}>{user?.displayName}</Text>
            <Text style={styles.avatarModalHandle}>{user?.handle}</Text>
          </Animated.View>
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
  profileHeader: { alignItems: 'center', paddingHorizontal: DS.space.lg, paddingTop: DS.space.md },
  avatarContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 48 },

  nameSection: { alignItems: 'center', marginTop: DS.space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { fontSize: 24, fontWeight: '800', color: DS.gray900, letterSpacing: -0.5 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  handle: { fontSize: 14, fontWeight: '500', color: DS.gray500, marginTop: 4 },

  bio: { fontSize: 14, fontWeight: '500', color: DS.gray600, textAlign: 'center', marginTop: DS.space.md, lineHeight: 20, paddingHorizontal: DS.space.lg },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: DS.space.sm },
  locationText: { fontSize: 12, fontWeight: '500', color: DS.gray500 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: DS.space.lg, width: '100%' },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  statPillIcon: { fontSize: 18, marginBottom: 4 },
  statPillValue: { fontSize: 18, fontWeight: '800' },
  statPillLabel: { fontSize: 10, fontWeight: '600', color: DS.gray500, textTransform: 'uppercase' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: DS.space.lg, width: '100%' },
  followBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  followBtnText: { fontSize: 14, fontWeight: '700' },
  actionBtnSecondary: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Tab Bar */
  tabBar: { flexDirection: 'row', padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: DS.gray900, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', color: DS.gray500, marginTop: 1 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Card */
  card: { borderRadius: DS.radius.lg, padding: DS.space.lg, borderWidth: 1, borderColor: DS.gray200, backgroundColor: DS.white },
  cardTitle: { fontSize: 15, fontWeight: '800', color: DS.gray900, marginBottom: DS.space.md },

  /* Info Row */
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '600', color: DS.gray500 },
  infoValue: { fontSize: 15, fontWeight: '700', color: DS.gray900, marginTop: 1 },
  divider: { height: 1, backgroundColor: DS.gray100, marginLeft: 48 },

  /* Topics */
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  topicChipText: { fontSize: 12, fontWeight: '700' },

  /* Post Card */
  postCard: { padding: DS.space.md, borderRadius: 16, borderWidth: 1, borderColor: DS.gray200, backgroundColor: DS.white },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  postTopic: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: '70%' },
  postTopicDot: { width: 5, height: 5, borderRadius: 3 },
  postTopicText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  postTime: { fontSize: 10, fontWeight: '500', color: DS.gray400 },
  postContent: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 10, color: DS.gray900 },
  postImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  postStats: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, fontWeight: '600', color: DS.gray500 },

  /* Empty */
  emptyCard: { alignItems: 'center', padding: DS.space['3xl'], borderRadius: 18, borderWidth: 1, borderColor: DS.gray200, backgroundColor: DS.white },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${DS.primary}10`, marginBottom: DS.space.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: DS.gray900, marginBottom: 6 },
  emptyText: { fontSize: 13, fontWeight: '500', color: DS.gray500, textAlign: 'center' },

  /* Achievement */
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  achievementEmoji: { fontSize: 22 },
  achievementName: { fontSize: 13, fontWeight: '700' },
  achievementDesc: { fontSize: 11, fontWeight: '500', color: DS.gray500, marginTop: 1 },

  /* Engagement */
  engagementGrid: { flexDirection: 'row', gap: 8 },
  engagementItem: { flex: 1, alignItems: 'center', gap: 4 },
  engagementEmoji: { fontSize: 20 },
  engagementValue: { fontSize: 20, fontWeight: '800' },
  engagementLabel: { fontSize: 10, fontWeight: '600', color: DS.gray500 },

  /* Influence */
  influenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  influenceSub: { fontSize: 11, fontWeight: '500', color: DS.gray500, marginTop: 1 },
  influenceScore: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  influenceScoreText: { fontSize: 20, fontWeight: '800' },
  influenceItem: { gap: 4 },
  influenceItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  influenceItemLabel: { fontSize: 11, fontWeight: '600', color: DS.gray600, flex: 1 },
  influenceItemValue: { fontSize: 11, fontWeight: '700' },
  influenceBar: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: DS.gray100 },
  influenceBarFill: { height: '100%', borderRadius: 3 },

  /* Standing */
  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  standingIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  standingBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  standingBadgeText: { fontSize: 11, fontWeight: '700' },

  /* Topic Breakdown */
  topicBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicBreakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '40%' },
  topicBreakdownDot: { width: 7, height: 7, borderRadius: 4 },
  topicBreakdownLabel: { fontSize: 12, fontWeight: '600', color: DS.gray600 },
  topicBreakdownBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: DS.gray100, overflow: 'hidden' },
  topicBreakdownFill: { height: '100%', borderRadius: 3 },
  topicBreakdownCount: { fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' },

  /* Avatar Modal */
  avatarModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatarModalCard: { alignItems: 'center', padding: 24, borderRadius: 28, backgroundColor: 'rgba(15,15,30,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', maxWidth: 400 },
  avatarModalImage: { width: 200, height: 200, borderRadius: 100, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 16 },
  avatarModalName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  avatarModalHandle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});