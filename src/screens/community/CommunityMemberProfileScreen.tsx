import {
  StyleSheet,
  Image,
  Share,
  Text,
  TouchableOpacity,
  useColorScheme,
  StatusBar,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { CommunityStackParamList } from '../../types/navigation';
import { CommunityUser, Post, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { supabase } from '@/utils/supabase';

// Fabric detection — LayoutAnimation is a no-op there.
const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (
  Platform.OS === 'android' &&
  !IS_FABRIC &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

const TC = {
  primary: '#6366f1',
  primaryDark: '#8b5cf6',
  secondary: '#ec4899',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#fbbf24',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

const TOPIC_COLORS: Record<string, string> = {
  topic_1: '#6366f1',
  topic_2: '#10b981',
  topic_3: '#ec4899',
  topic_4: '#f59e0b',
  topic_5: '#fc5c7d',
  topic_6: '#8b5cf6',
  topic_7: '#f093fb',
  topic_8: '#4facfe',
  topic_9: '#ec4899',
  topic_10: '#43e97b',
  topic_11: '#ec4899',
  topic_12: '#6366f1',
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
  const emojiRegex =
    /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

/* ═══════════════════════════════════════════════════════════════════════════
   SUBCOMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={[styles.glassCard, active && { borderColor: colors?.primary, borderWidth: 2 }, style]}
    >
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
              : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#6366f1" />
        </TouchableOpacity>
      )}
    </View>
  );
});

const TabBar = React.memo(
  ({
    tabs,
    activeTab,
    onChange,
    isDark,
    colors,
  }: {
    tabs: { key: ProfileTab; label: string; icon: string }[];
    activeTab: ProfileTab;
    onChange: (t: ProfileTab) => void;
    isDark?: boolean;
    colors?: any;
  }) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    return (
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)' }]}
            >
              <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? '#6366f1' : '#94a3b8' },
                  isActive && { fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  },
);

/* Post card — memoised on primitive props so it doesn't re-render on scroll/state changes */
const PostCard = React.memo(
  ({
    post,
    index,
    onPressPost,
    isDark,
    colors,
  }: {
    post: Post;
    index: number;
    onPressPost: (postId: string) => void;
    isDark: boolean;
    colors: any;
  }) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
    const handlePress = useCallback(() => onPressPost(post.id), [onPressPost, post.id]);
    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 40).springify()}>
        <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.postItem}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
                : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.postItemContent}>
            <View style={styles.postItemHeader}>
              <View style={[styles.postItemTopic, { backgroundColor: `${topicColor}15` }]}>
                <View style={[styles.postItemTopicDot, { backgroundColor: topicColor }]} />
                <Text style={[styles.postItemTopicText, { color: topicColor }]} numberOfLines={1}>
                  {post.topic || 'General'}
                </Text>
              </View>
              <Text style={styles.postItemTime}>{post.time}</Text>
            </View>
            <Text style={styles.postItemContentText} numberOfLines={3}>
              {post.content}
            </Text>
            {post.images && post.images.length > 0 && (
              <View style={styles.postItemImageWrap}>
                <Image source={{ uri: post.images[0] }} style={styles.postItemImage} resizeMode="cover" />
              </View>
            )}
            <View style={styles.postItemStats}>
              <View style={styles.postItemStat}>
                <Ionicons name="heart" size={14} color={post.isLiked ? TC.danger : '#94a3b8'} />
                <Text style={[styles.postItemStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}>
                  {post.likes}
                </Text>
              </View>
              <View style={styles.postItemStat}>
                <Ionicons name="chatbubble" size={14} color="#94a3b8" />
                <Text style={styles.postItemStatText}>{post.commentsCount}</Text>
              </View>
              <View style={styles.postItemStat}>
                <Ionicons name="repeat" size={14} color="#94a3b8" />
                <Text style={styles.postItemStatText}>{post.reposts || 0}</Text>
              </View>
              <View style={styles.postItemStat}>
                <Ionicons name="eye" size={14} color="#94a3b8" />
                <Text style={styles.postItemStatText}>{post.viewCount || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

/* ── Skeleton placeholder for the hero (no blocking spinner) ───────────── */
const HeroSkeleton = React.memo(
  ({
    isDark,
    colors,
    coverHeight,
    avatarSize,
    overlap,
  }: {
    isDark: boolean;
    colors: any;
    coverHeight: number;
    avatarSize: number;
    overlap: number;
  }) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const barSoft = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

    return (
      <View style={styles.profileHero}>
        <View style={[styles.coverPhotoContainer, { height: coverHeight, opacity: 0.6 }]}>
          <LinearGradient
            colors={isDark ? ['#2d2d3c', '#232332'] : ['#e2e8f0', '#f1f5f9']}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={[styles.profileHeroContent, { marginTop: -overlap }]}>
          <View style={styles.avatarSection}>
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: barBg,
                borderWidth: 4,
                borderColor: '#fff',
              }}
            />
          </View>
          <View style={styles.profileInfo}>
            <View
              style={{
                height: 24,
                width: 160,
                borderRadius: 8,
                backgroundColor: barBg,
                marginBottom: 8,
              }}
            />
            <View
              style={{
                height: 14,
                width: 100,
                borderRadius: 6,
                backgroundColor: barSoft,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 20 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      height: 18,
                      width: 28,
                      borderRadius: 6,
                      backgroundColor: barBg,
                      marginBottom: 4,
                    }}
                  />
                  <View
                    style={{
                      height: 10,
                      width: 44,
                      borderRadius: 4,
                      backgroundColor: barSoft,
                    }}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  },
);

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
  const styles = useMemo(() => getStyles(isDark, fullThemeColors), [isDark, fullThemeColors]);
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const isCompact = SCREEN_W < 360;
  const isTablet = SCREEN_W >= 768;

  const heroCoverHeight = isTablet ? 220 : Math.max(150, Math.min(180, SCREEN_W * 0.45));
  const avatarSize = isTablet ? 128 : Math.max(84, Math.min(108, SCREEN_W * 0.26));
  const avatarOverlap = Math.round(avatarSize * 0.5);
  const actionIconSize = isCompact ? 40 : 44;
  const actionIconRadius = Math.round(actionIconSize * 0.32);
  const mutualCardWidth = isTablet ? 140 : Math.max(84, (SCREEN_W - 32 - 24) / 3.2);
  const streakCellSize = Math.max(18, Math.min(26, (SCREEN_W - 32 - 20 - 5 * 6) / 12));

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  // NEW: never gate the whole screen on this. Paints immediately with skeleton.
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

  // Sync canonical UserContext community profile into CommunityContext so
  // avatars edited on CommunityProfileScreen propagate here.
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

  const bannerGradient = useMemo(() => {
    if (!user) return ['#6366f1', '#8b5cf6'] as [string, string];
    const colors = user.selectedTopics?.map((t) => TOPIC_COLORS[t] || TC.primary) || [TC.primary];
    return [colors[0] || TC.primary, colors[1] || TC.primaryDark] as [string, string];
  }, [user]);

  const userPostList = useMemo(() => getUserPosts(userId), [userId, getUserPosts]);

  /* ── Derived data ─────────────────────────────────────────────────── */

  const engagementInsights = useMemo(() => {
    const totalLikes = userPostList.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = userPostList.reduce((sum, p) => sum + p.commentsCount, 0);
    const totalViews = userPostList.reduce((sum, p) => sum + p.viewCount, 0);

    return [
      { icon: '❤️', label: 'Likes', value: totalLikes, color: TC.danger },
      { icon: '💬', label: 'Comments', value: totalComments, color: TC.info },
      { icon: '👁️', label: 'Views', value: totalViews, color: TC.primary },
    ];
  }, [userPostList]);

  const influenceMetrics = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);

    const avgEngagement =
      totalPosts > 0 ? Math.min(100, Math.round(((totalLikes + totalComments * 2) / totalPosts) * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round((totalHelpful / Math.max(1, totalPosts)) * 15));
    const reach = Math.min(100, Math.round((totalViews / Math.max(1, totalPosts * 10)) * 100));

    return [
      { label: 'Engagement', value: avgEngagement, color: TC.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: TC.secondary, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: TC.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: TC.accent, icon: 'eye' },
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
    if (userPostCount > 100 && totalEngagement > 500) rankLabel = 'Legendary Parent';
    else if (userPostCount > 50 && totalEngagement > 200) rankLabel = 'Gold Parent';
    else if (userPostCount > 20 && totalEngagement > 50) rankLabel = 'Silver Parent';
    else if (userPostCount > 5) rankLabel = 'Bronze Parent';

    const topContributors = allUsers
      .filter((u) => u.id !== userId && getUserPosts(u.id).length > 0)
      .sort((a, b) => getUserPosts(b.id).length - getUserPosts(a.id).length)
      .slice(0, 3)
      .map((u) => ({ id: u.id, name: u.displayName, avatar: u.avatar }));

    return { score: Math.min(100, Math.round(percentile + 20)), rank: rankLabel, percentile, topContributors };
  }, [userPostList, allUsers, getUserPosts, userId]);

  const contentHighlights = useMemo(() => {
    const sorted = [...userPostList].sort((a, b) => b.likes - a.likes);
    const mostLiked = sorted[0]?.likes || 0;
    const mostCommented = Math.max(...userPostList.map((p) => p.commentsCount), 0);
    // Real engagement rate: (likes + comments) / total views.
    const totalViews = userPostList.reduce((s, p) => s + (p.viewCount || 0), 0);
    const totalInteractions = userPostList.reduce((s, p) => s + p.likes + p.commentsCount, 0);
    const avgEngagement =
      totalViews > 0 ? Math.min(100, Math.round((totalInteractions / totalViews) * 100)) : 0;
    return { topPost: sorted[0] || null, mostLiked, mostCommented, avgEngagement };
  }, [userPostList]);

  const activityPattern = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    return days.map((day, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayPosts = userPostList.filter((p) => {
        const postDate = new Date(p.timestamp);
        return postDate.toDateString() === date.toDateString();
      });
      const activity = dayPosts.length + dayPosts.reduce((sum, p) => sum + p.likes * 0.3, 0);
      return { day: day.slice(0, 1), activity: Math.round(activity), posts: dayPosts.length };
    });
  }, [userPostList]);

  const contentBreakdown = useMemo(
    () => ({
      posts: userPostList.length,
      comments: userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
      reactions: userPostList.reduce((sum, p) => sum + (p.likes || 0), 0),
      shares: userPostList.reduce((sum, p) => sum + (p.reposts || 0), 0),
    }),
    [userPostList],
  );

  const mutualConnections = useMemo(() => {
    if (!currentUser) return [];
    const currentUserFollowing = currentUser.following || [];
    const targetUserFollowing = user?.following || [];
    const mutuals = currentUserFollowing.filter(
      (id) => targetUserFollowing.includes(id) && id !== currentUser.id,
    );
    return mutuals.slice(0, 4).map((id) => {
      const u = allUsers.find((a) => a.id === id);
      return {
        id,
        name: u?.displayName || 'Unknown',
        avatar: u?.avatar || '',
      };
    });
  }, [currentUser, user, allUsers]);

  const parentingTips = useMemo(() => {
    const tips: any[] = [];
    const topicCounts: Record<string, number> = {};
    userPostList.forEach((p) => {
      topicCounts[p.topicId] = (topicCounts[p.topicId] || 0) + 1;
    });
    const topTopic = Object.entries(topicCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    if (topTopic === 'topic_1')
      tips.push({
        id: '1',
        emoji: '📚',
        title: 'Learning Focus',
        tip: 'They share lots of educational content. Great resource for learning tips!',
        color: '#6366f1',
      });
    if (topTopic === 'topic_3')
      tips.push({
        id: '2',
        emoji: '💤',
        title: 'Sleep Expert',
        tip: 'Their sleep tips are popular! Check out their bedtime routine posts.',
        color: '#8b5cf6',
      });
    if (topTopic === 'topic_5')
      tips.push({
        id: '3',
        emoji: '🍼',
        title: 'Nutrition Guide',
        tip: 'Their feeding posts get great engagement. Valuable nutrition advice!',
        color: '#ec4899',
      });
    if (userPostList.length > 20)
      tips.push({
        id: '4',
        emoji: '🌟',
        title: 'Top Contributor',
        tip: "They're a pillar of the community! Follow for quality content.",
        color: '#f59e0b',
      });
    if (userPostList.length < 3)
      tips.push({
        id: '5',
        emoji: '💡',
        title: 'New Parent',
        tip: 'Welcome them to the community! Show some love on their posts.',
        color: '#10b981',
      });
    if (tips.length === 0)
      tips.push({
        id: '6',
        emoji: '💬',
        title: 'Engaged Parent',
        tip: 'They actively participate in discussions. Great person to connect with!',
        color: '#3b82f6',
      });
    return tips.slice(0, 2);
  }, [userPostList]);

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
        color: TOPIC_COLORS[topicId] || TC.primary,
        label: INITIAL_TOPICS.find((t) => t.id === topicId)?.name || topicId.replace('topic_', 'Topic '),
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [userPostList]);

  const contributionStreak = useMemo(() => {
    const now = new Date();
    const weeks: boolean[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const hasActivity = userPostList.some((p) => {
        const d = new Date(p.timestamp);
        return d >= weekStart && d < weekEnd;
      });
      weeks.push(hasActivity);
    }
    let current = 0;
    for (let i = weeks.length - 1; i >= 0 && weeks[i]; i--) current++;
    let longest = 0;
    let temp = 0;
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i]) temp++;
      else {
        longest = Math.max(longest, temp);
        temp = 0;
      }
    }
    longest = Math.max(longest, temp);
    return { current, longest, weeks };
  }, [userPostList]);

  const socialGraph = useMemo(() => {
    const likes = userPostList.reduce((s, p) => s + p.likes, 0);
    const comments = userPostList.reduce((s, p) => s + p.commentsCount, 0);
    const views = userPostList.reduce((s, p) => s + p.viewCount, 0);
    const posts = userPostList.length;
    const maxVal = Math.max(likes, comments, views, posts, 1);
    return [
      { name: 'Posts', value: Math.round((posts / maxVal) * 100), color: TC.primary },
      { name: 'Likes', value: Math.round((likes / maxVal) * 100), color: TC.secondary },
      { name: 'Comments', value: Math.round((comments / maxVal) * 100), color: TC.info },
      { name: 'Views', value: Math.round((views / maxVal) * 100), color: TC.success },
    ];
  }, [userPostList]);

  const interactionHeatMap = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    userPostList.forEach((p) => {
      const hour = new Date(p.timestamp).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    const maxVal = Math.max(...Object.values(hours), 1);
    return Object.entries(hours)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        activity: count,
        intensity: count / maxVal,
      }))
      .slice(6, 22);
  }, [userPostList]);

  const contentStreaks = useMemo(() => {
    const postDates = userPostList.map((p) => new Date(p.timestamp).toDateString());
    const uniquePostDays = [...new Set(postDates)];

    let currentStreakCount = 0;
    for (let i = uniquePostDays.length - 1; i >= 0; i--) {
      const day = new Date(uniquePostDays[i]);
      const expectedDay = new Date();
      expectedDay.setDate(expectedDay.getDate() - currentStreakCount);
      if (day.toDateString() === expectedDay.toDateString()) {
        currentStreakCount++;
      } else {
        break;
      }
    }

    return [
      {
        type: 'Posting',
        current: currentStreakCount,
        best: Math.min(userPostList.length, 30),
        color: TC.primary,
        icon: 'document-text',
      },
      {
        type: 'Helpful',
        current: Math.min(
          5,
          Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0) / 2),
        ),
        best: Math.min(10, Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0))),
        color: TC.success,
        icon: 'heart',
      },
      {
        type: 'Active',
        current: userPostList.length > 0 ? Math.min(30, userPostList.length) : 0,
        best: Math.min(30, userPostList.length * 2),
        color: TC.accent,
        icon: 'flame',
      },
    ];
  }, [userPostList]);

  const tabs = useMemo(
    () => [
      { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
      { key: 'about' as ProfileTab, label: 'About', icon: 'information-circle-outline' },
      { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
      { key: 'insights' as ProfileTab, label: 'Insights', icon: 'analytics-outline' },
    ],
    [],
  );

  /* ── Lifecycle ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (userId && !initialLoadDone.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId && !isLoadingRef.current) {
        loadUserData();
      }
      return () => {};
    }, [userId]),
  );

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);

    try {
      // 1) Try the in-memory community context first (fast path).
      let targetUser = getUserById(userId);

      // 2) Fall back to Supabase `profiles` — this makes the eye button work
      //    for the *current* user before CommunityContext has re-synced after
      //    a profile edit, AND (critically) picks up `is_verified`.
      if (userId) {
        try {
          const { data: profileRow, error: profileErr } = await supabase
            .from('profiles')
            .select(
              'id, full_name, community_display_name, community_handle, community_username, ' +
                'community_bio, community_avatar, avatar_url, community_cover, is_verified, ' +
                'community_selected_topics, created_at',
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
              stats: targetUser?.stats || {
                posts: 0,
                followers: 0,
                following: 0,
                helpful: 0,
                streakDays: 0,
                lastStreakDate: new Date().toISOString(),
              },
              achievements: targetUser?.achievements || [],
              selectedTopics: Array.isArray(profileRow.community_selected_topics)
                ? profileRow.community_selected_topics
                : targetUser?.selectedTopics || [],
              isFollowing: targetUser?.isFollowing,
              following: targetUser?.following,
              followers: targetUser?.followers,
            };

            if (!targetUser) {
              targetUser = fromDb;
            } else {
              // Merge: keep context stats/follows, but ALWAYS take DB's
              // authoritative is_verified / avatar / bio / coverPhoto.
              targetUser = {
                ...targetUser,
                displayName: fromDb.displayName || targetUser.displayName,
                handle: fromDb.handle || targetUser.handle,
                avatar: fromDb.avatar || targetUser.avatar,
                coverPhoto: fromDb.coverPhoto || targetUser.coverPhoto,
                bio: fromDb.bio || targetUser.bio,
                isVerified: fromDb.isVerified,
                selectedTopics:
                  fromDb.selectedTopics && fromDb.selectedTopics.length > 0
                    ? fromDb.selectedTopics
                    : targetUser.selectedTopics,
              };
            }
          }
        } catch (fallbackErr) {
          if (__DEV__) {
            console.warn('[CommunityMemberProfile] Supabase fallback failed:', fallbackErr);
          }
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

  const handleMoreOptions = useCallback(() => {
    if (!user) return;
    sweetAlert.confirm(
      user.displayName || 'User',
      'What would you like to do?',
      () => {
        blockUser(userId);
        if (isBlocked) {
          setIsBlocked(false);
          sweetAlert.success('Unblocked', `${user.displayName} has been unblocked`);
        } else {
          setIsBlocked(true);
          setIsFollowingUser(false);
          sweetAlert.alert('Blocked', `${user.displayName} has been blocked`, 'warning');
        }
      },
      () => handleShareProfile(),
      isBlocked ? 'Unblock' : 'Block',
      'Share Profile',
    );
  }, [user, isBlocked, blockUser, userId, sweetAlert]);

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
    if (!IS_FABRIC) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  /* ── RENDER: Sticky header ─────────────────────────────────────────── */

  const renderStickyHeader = () => (
    <Animated.View
      style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}
      pointerEvents="none"
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.stickyTitle}>{user?.displayName || 'Member Profile'}</Text>
      <Text style={styles.stickySubtitle}>{user?.handle || ''}</Text>
    </Animated.View>
  );

  /* ── RENDER: Profile hero ─────────────────────────────────────────── */

  const renderProfileHero = () => {
    if (!user) return null;
    const isOnline = user.onlineStatus === 'online';
    const coverPhoto = user.coverPhoto;
    const avatarSource = user.avatar;
    const isAvatarEmoji = isEmojiAvatar(avatarSource);

    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.profileHero}>
        <View style={[styles.coverPhotoContainer, { height: heroCoverHeight }]}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={bannerGradient}
              style={styles.coverPhoto}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.65)']}
            style={styles.coverPhotoOverlay}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />
        </View>

        <View style={[styles.profileHeroContent, { marginTop: -avatarOverlap }]}>
          {/* Avatar — tappable to preview */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                triggerHaptic('light');
                setShowAvatarPreview(true);
              }}
              style={[
                styles.avatarWrapper,
                { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              ]}
            >
              {avatarSource && !isAvatarEmoji ? (
                <Image
                  source={{ uri: avatarSource }}
                  style={[
                    styles.avatarImage,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarImage,
                    styles.avatarPlaceholder,
                    {
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                      backgroundColor: `${TC.primary}25`,
                    },
                  ]}
                >
                  <Text style={[styles.avatarPlaceholderText, { fontSize: avatarSize * 0.36 }]}>
                    {isAvatarEmoji ? avatarSource : user.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              {isOnline && (
                <View style={styles.onlineIndicator} pointerEvents="none">
                  <View style={styles.onlineDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user.displayName}
              </Text>
              {user.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.profileHandle}>{user.handle}</Text>
            {user.bio && (
              <Text style={styles.profileBio} numberOfLines={3}>
                {user.bio}
              </Text>
            )}
            {user.country && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#94a3b8" />
                <Text style={styles.locationText}>{user.country}</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Text style={styles.statsValue}>{userPostList.length}</Text>
                <Text style={styles.statsLabel}>Posts</Text>
              </View>
              <View style={styles.statsDivider} />
              <TouchableOpacity
                style={styles.statsItem}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('light');
                  navigation.navigate('Followers', { userId });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${followerCount} followers, tap to view list`}
              >
                <Text style={styles.statsValue}>{followerCount}</Text>
                <Text style={styles.statsLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.statsDivider} />
              <TouchableOpacity
                style={styles.statsItem}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('light');
                  navigation.navigate('Following', { userId });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${followingCount} following, tap to view list`}
              >
                <Text style={styles.statsValue}>{followingCount}</Text>
                <Text style={styles.statsLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionBar}>
              {!isOwnProfile ? (
                <>
                  <TouchableOpacity
                    style={styles.actionBarItem}
                    onPress={handleFollowToggle}
                    disabled={isBlocked}
                    activeOpacity={0.75}
                  >
                    <LinearGradient
                      colors={isFollowingUser ? ['#f1f5f9', '#e2e8f0'] : ['#6366f1', '#8b5cf6']}
                      style={[
                        styles.actionBarIcon,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons
                        name={isFollowingUser ? 'checkmark' : 'person-add'}
                        size={18}
                        color={isFollowingUser ? '#64748b' : '#fff'}
                      />
                    </LinearGradient>
                    <Text
                      style={[styles.actionBarLabel, isFollowingUser && styles.actionBarLabelActive]}
                      numberOfLines={1}
                    >
                      {isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBarItem}
                    onPress={handleMessage}
                    disabled={isBlocked}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.actionBarIcon,
                        styles.actionBarIconSecondary,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                    >
                      <Ionicons name="chatbubbles" size={18} color={isBlocked ? '#94a3b8' : '#6366f1'} />
                    </View>
                    <Text style={[styles.actionBarLabel, isBlocked && { color: '#94a3b8' }]} numberOfLines={1}>
                      Message
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBarItem} onPress={handleShareProfile} activeOpacity={0.75}>
                    <View
                      style={[
                        styles.actionBarIcon,
                        styles.actionBarIconSecondary,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                    >
                      <Ionicons name="share-outline" size={18} color="#6366f1" />
                    </View>
                    <Text style={styles.actionBarLabel} numberOfLines={1}>
                      Share
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBarItem} onPress={handleMoreOptions} activeOpacity={0.75}>
                    <View
                      style={[
                        styles.actionBarIcon,
                        styles.actionBarIconSecondary,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color="#6366f1" />
                    </View>
                    <Text style={styles.actionBarLabel} numberOfLines={1}>
                      More
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionBarItem}
                    onPress={() => navigation.navigate('ChatList' as never)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.actionBarIcon,
                        styles.actionBarIconSecondary,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                    >
                      <Ionicons name="chatbubbles" size={18} color="#6366f1" />
                    </View>
                    <Text style={styles.actionBarLabel} numberOfLines={1}>
                      Messages
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBarItem} onPress={handleShareProfile} activeOpacity={0.75}>
                    <View
                      style={[
                        styles.actionBarIcon,
                        styles.actionBarIconSecondary,
                        { width: actionIconSize, height: actionIconSize, borderRadius: actionIconRadius },
                      ]}
                    >
                      <Ionicons name="share-outline" size={18} color="#6366f1" />
                    </View>
                    <Text style={styles.actionBarLabel} numberOfLines={1}>
                      Share
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBarItem}
                    onPress={() => navigation.navigate('CommunityProfile' as never)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.actionBarIcon,
                        {
                          width: actionIconSize,
                          height: actionIconSize,
                          borderRadius: actionIconRadius,
                          backgroundColor: 'rgba(245,158,11,0.12)',
                        },
                      ]}
                    >
                      <Ionicons name="settings-outline" size={18} color="#f59e0b" />
                    </View>
                    <Text style={styles.actionBarLabel} numberOfLines={1}>
                      Settings
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  /* ── RENDER: Memoized cards ───────────────────────────────────────── */

  const renderEngagementInsights = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(80).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.insightsHeader}>
            <View style={[styles.insightsIconBg, { backgroundColor: `${TC.primary}15` }]}>
              <Ionicons name="analytics" size={20} color={TC.primary} />
            </View>
            <View style={styles.insightsTitleWrap}>
              <Text style={styles.insightsTitle}>Engagement</Text>
              <Text style={styles.insightsSubtitle}>Based on {userPostList.length} posts</Text>
            </View>
          </View>
          <View style={styles.insightsGrid}>
            {engagementInsights.map((insight, i) => (
              <View
                key={insight.label}
                style={[
                  styles.insightItem,
                  i < engagementInsights.length - 1 && {
                    borderRightWidth: 1,
                    borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Text style={styles.insightItemIcon}>{insight.icon}</Text>
                <Text style={[styles.insightItemValue, { color: insight.color }]}>{insight.value}</Text>
                <Text style={styles.insightItemLabel}>{insight.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, engagementInsights, userPostList.length],
  );

  const renderInfluenceMetrics = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(120).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.influenceHeader}>
            <View style={[styles.influenceIconBg, { backgroundColor: `${TC.primary}15` }]}>
              <Ionicons name="analytics" size={20} color={TC.primary} />
            </View>
            <View style={styles.influenceTitleWrap}>
              <Text style={styles.influenceTitle}>Influence Score</Text>
              <Text style={styles.influenceSubtitle}>Community impact metrics</Text>
            </View>
            <View style={[styles.influenceOverallBadge, { backgroundColor: `${TC.primary}12` }]}>
              <Text style={[styles.influenceOverallText, { color: TC.primary }]}>
                {Math.round(influenceMetrics.reduce((a, b) => a + b.value, 0) / influenceMetrics.length)}
              </Text>
            </View>
          </View>
          <View style={styles.influenceGrid}>
            {influenceMetrics.map((metric, i) => (
              <View key={metric.label} style={styles.influenceItem}>
                <View style={styles.influenceItemTop}>
                  <View style={[styles.influenceItemIconBg, { backgroundColor: `${metric.color}12` }]}>
                    <Ionicons name={metric.icon as any} size={14} color={metric.color} />
                  </View>
                  <Text style={[styles.influenceItemLabel, { color: metric.color }]}>{metric.label}</Text>
                  <Text style={[styles.influenceItemValue, { color: metric.color }]}>{metric.value}%</Text>
                </View>
                <View
                  style={[
                    styles.influenceBarBg,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                  ]}
                >
                  <Animated.View
                    entering={FadeInRight.delay(200 + i * 80).springify()}
                    style={[
                      styles.influenceBarFill,
                      { width: `${metric.value}%`, backgroundColor: metric.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, influenceMetrics],
  );

  const renderCommunityInfluence = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(160).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.communityInfluenceHeader}>
            <View style={[styles.communityInfluenceIconBg, { backgroundColor: `${TC.purple}15` }]}>
              <Ionicons name="trophy" size={20} color={TC.purple} />
            </View>
            <View style={styles.communityInfluenceTitleWrap}>
              <Text style={styles.communityInfluenceTitle}>Community Standing</Text>
              <Text style={styles.communityInfluenceSubtitle}>
                Top {communityInfluence.percentile}% of {allUsers.length} members
              </Text>
            </View>
            <View style={[styles.communityInfluenceScoreBadge, { backgroundColor: `${TC.purple}12` }]}>
              <Text style={[styles.communityInfluenceScoreText, { color: TC.purple }]}>
                {communityInfluence.score}
              </Text>
            </View>
          </View>
          <View style={styles.communityInfluenceRankRow}>
            <View style={[styles.communityInfluenceRankBadge, { backgroundColor: `${TC.purple}12` }]}>
              <Text style={[styles.communityInfluenceRankText, { color: TC.purple }]}>
                {communityInfluence.rank}
              </Text>
            </View>
            <View style={styles.communityInfluenceProgressWrap}>
              <View style={styles.communityInfluenceProgressLabelRow}>
                <Text style={styles.communityInfluenceProgressLabel}>Next rank</Text>
                <Text style={[styles.communityInfluenceProgressValue, { color: TC.purple }]}>
                  {communityInfluence.percentile}%
                </Text>
              </View>
              <View style={styles.communityInfluenceProgressBarBg}>
                <Animated.View
                  entering={FadeInRight.delay(300).springify()}
                  style={[
                    styles.communityInfluenceProgressBarFill,
                    { width: `${communityInfluence.percentile}%`, backgroundColor: TC.purple },
                  ]}
                />
              </View>
            </View>
          </View>
          {communityInfluence.topContributors.length > 0 && (
            <View style={styles.communityInfluenceContributors}>
              <Text style={styles.communityInfluenceContributorsLabel}>Top contributors</Text>
              <View style={styles.communityInfluenceAvatarStack}>
                {communityInfluence.topContributors.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => navigation.push('CommunityMemberProfile', { userId: c.id })}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.communityInfluenceAvatar,
                        { marginLeft: i > 0 ? -10 : 0, zIndex: communityInfluence.topContributors.length - i },
                      ]}
                    >
                      {c.avatar && !isEmojiAvatar(c.avatar) ? (
                        <Image source={{ uri: c.avatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                      ) : (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: `${TC.purple}20`,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>
                            {isEmojiAvatar(c.avatar) ? c.avatar : c.name?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, communityInfluence, allUsers.length, navigation],
  );

  const renderContentHighlights = useCallback(() => {
    if (!contentHighlights.topPost) return null;
    const post = contentHighlights.topPost;
    const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
    return (
      <Animated.View entering={FadeInUp.delay(200).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.highlightsHeader}>
            <Text style={styles.highlightsTitle}>Content Highlights</Text>
            <View style={[styles.highlightsBadge, { backgroundColor: `${topicColor}12` }]}>
              <Text style={[styles.highlightsBadgeText, { color: topicColor }]}>Top Post</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id } as never)}
            style={styles.highlightsPostCard}
            activeOpacity={0.75}
          >
            <View style={styles.highlightsPostHeader}>
              <View style={[styles.highlightsTopicDot, { backgroundColor: topicColor }]} />
              <Text style={[styles.highlightsTopicText, { color: topicColor }]} numberOfLines={1}>
                {post.topic}
              </Text>
              <Text style={styles.highlightsPostTime}>{post.time}</Text>
            </View>
            <Text style={styles.highlightsPostContent} numberOfLines={2}>
              {post.content}
            </Text>
            <View style={styles.highlightsPostStats}>
              <View style={styles.highlightsPostStat}>
                <Ionicons name="heart" size={14} color={post.isLiked ? TC.danger : '#94a3b8'} />
                <Text
                  style={[styles.highlightsPostStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}
                >
                  {post.likes}
                </Text>
              </View>
              <View style={styles.highlightsPostStat}>
                <Ionicons name="chatbubble" size={14} color="#94a3b8" />
                <Text style={styles.highlightsPostStatText}>{post.commentsCount}</Text>
              </View>
              <View style={styles.highlightsPostStat}>
                <Ionicons name="eye" size={14} color="#94a3b8" />
                <Text style={styles.highlightsPostStatText}>{post.viewCount}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.highlightsDivider} />
          <View style={styles.highlightsMetrics}>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.secondary }]}>
                {contentHighlights.mostLiked}
              </Text>
              <Text style={styles.highlightsMetricLabel}>Most Liked</Text>
            </View>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.primary }]}>
                {contentHighlights.mostCommented}
              </Text>
              <Text style={styles.highlightsMetricLabel}>Most Comments</Text>
            </View>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.success }]}>
                {contentHighlights.avgEngagement}%
              </Text>
              <Text style={styles.highlightsMetricLabel}>Engagement Rate</Text>
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    );
  }, [isDark, fullThemeColors, styles, contentHighlights, navigation]);

  const renderContentBreakdown = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(220).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownTitle}>Content Breakdown</Text>
            <Text style={styles.breakdownTotal}>
              {contentBreakdown.posts +
                contentBreakdown.comments +
                contentBreakdown.reactions +
                contentBreakdown.shares}{' '}
              total
            </Text>
          </View>
          <View style={styles.breakdownGrid}>
            {[
              { label: 'Posts', value: contentBreakdown.posts, color: TC.primary, icon: 'document-text' },
              { label: 'Comments', value: contentBreakdown.comments, color: TC.info, icon: 'chatbubble' },
              { label: 'Reactions', value: contentBreakdown.reactions, color: TC.secondary, icon: 'heart' },
              { label: 'Shares', value: contentBreakdown.shares, color: TC.success, icon: 'share' },
            ].map((item) => (
              <View key={item.label} style={styles.breakdownItem}>
                <View style={[styles.breakdownIconBg, { backgroundColor: `${item.color}12` }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, contentBreakdown],
  );

  const renderActivityPattern = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(250).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.patternHeader}>
            <Text style={styles.patternTitle}>Activity Pattern</Text>
            <View style={styles.patternLiveBadge}>
              <View style={styles.patternLiveDot} />
              <Text style={styles.patternLiveText}>Weekly</Text>
            </View>
          </View>
          <View style={styles.patternBars}>
            {activityPattern.map((point, i) => {
              const maxVal = Math.max(...activityPattern.map((d) => d.activity), 1);
              const height = Math.max(4, (point.activity / maxVal) * 60);
              return (
                <View key={i} style={styles.patternBarWrap}>
                  <View
                    style={[
                      styles.patternBar,
                      {
                        height,
                        backgroundColor:
                          point.activity > maxVal * 0.7
                            ? TC.primary
                            : point.activity > maxVal * 0.3
                            ? `${TC.primary}80`
                            : `${TC.primary}40`,
                      },
                    ]}
                  />
                  <Text style={styles.patternBarLabel}>{point.day}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, activityPattern],
  );

  const renderMutualConnections = useCallback(() => {
    if (mutualConnections.length === 0) return null;
    return (
      <Animated.View entering={FadeInUp.delay(300).springify()}>
        <SectionHeader
          title="Mutual Connections"
          subtitle="Parents you both know"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <View style={styles.mutualScroll}>
          {mutualConnections.map((conn) => (
            <TouchableOpacity
              key={conn.id}
              onPress={() => navigation.push('CommunityMemberProfile', { userId: conn.id })}
              style={[styles.mutualCard, { width: mutualCardWidth }]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[TC.primary + '08', TC.primary + '02']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              {conn.avatar && !isEmojiAvatar(conn.avatar) ? (
                <Image source={{ uri: conn.avatar }} style={styles.mutualAvatar} />
              ) : (
                <View
                  style={[
                    styles.mutualAvatar,
                    { backgroundColor: `${TC.primary}20`, justifyContent: 'center', alignItems: 'center' },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>
                    {isEmojiAvatar(conn.avatar) ? conn.avatar : conn.name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.mutualName} numberOfLines={1}>
                {conn.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  }, [isDark, fullThemeColors, styles, mutualConnections, mutualCardWidth, navigation]);

  const renderParentingTips = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(400).springify()}>
        <SectionHeader
          title="Parenting Insights"
          subtitle="Personalized for this parent"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <View style={styles.tipsList}>
          {parentingTips.map((tip) => (
            <View key={tip.id} style={[styles.tipCard, { borderLeftColor: tip.color }]}>
              <View style={[styles.tipIconBg, { backgroundColor: `${tip.color}12` }]}>
                <Text style={styles.tipEmoji}>{tip.emoji}</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, parentingTips],
  );

  const renderTopicBreakdown = useCallback(() => {
    if (topicBreakdown.length === 0) return null;
    return (
      <Animated.View entering={FadeInUp.delay(450).springify()}>
        <SectionHeader
          title="Topic Breakdown"
          subtitle="What they talk about most"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.topicBreakdown}>
            {topicBreakdown.map((topic) => (
              <View key={topic.topicId} style={styles.topicBreakdownRow}>
                <View style={styles.topicBreakdownLeft}>
                  <View style={[styles.topicBreakdownDot, { backgroundColor: topic.color }]} />
                  <Text style={styles.topicBreakdownLabel} numberOfLines={1}>
                    {topic.label}
                  </Text>
                </View>
                <View style={styles.topicBreakdownRight}>
                  <View style={styles.topicBreakdownBarBg}>
                    <View
                      style={[
                        styles.topicBreakdownBarFill,
                        { width: `${topic.percentage}%`, backgroundColor: topic.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.topicBreakdownCount, { color: topic.color }]}>{topic.count}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    );
  }, [isDark, fullThemeColors, styles, topicBreakdown]);

  const renderInteractionHeatMap = useCallback(() => {
    if (interactionHeatMap.length === 0 || userPostList.length === 0) return null;
    return (
      <Animated.View entering={FadeInUp.delay(500).springify()}>
        <SectionHeader
          title="Active Hours"
          subtitle="When they engage most"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.heatMapContainer}>
            <View style={styles.heatMapRow}>
              {interactionHeatMap.map((item) => (
                <View key={item.hour} style={styles.heatMapCell}>
                  <View
                    style={[
                      styles.heatMapBar,
                      {
                        height: Math.max(4, item.intensity * 50),
                        backgroundColor:
                          item.intensity > 0.7
                            ? TC.primary
                            : item.intensity > 0.3
                            ? `${TC.primary}80`
                            : `${TC.primary}30`,
                      },
                    ]}
                  />
                  <Text style={styles.heatMapLabel}>
                    {item.hour % 12 || 12}
                    {item.hour >= 12 ? 'p' : 'a'}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.heatMapLegend}>
              <Text style={styles.heatMapLegendText}>Low</Text>
              <View style={[styles.heatMapLegendDot, { backgroundColor: `${TC.primary}30` }]} />
              <View style={[styles.heatMapLegendDot, { backgroundColor: `${TC.primary}80` }]} />
              <View style={[styles.heatMapLegendDot, { backgroundColor: TC.primary }]} />
              <Text style={styles.heatMapLegendText}>High</Text>
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    );
  }, [isDark, fullThemeColors, styles, interactionHeatMap, userPostList.length]);

  const renderContributionStreak = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(550).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.streakHeader}>
            <View>
              <Text style={styles.streakTitle}>Contribution Streak</Text>
              <Text style={styles.streakSubtitle}>Last 12 weeks</Text>
            </View>
            <View style={styles.streakNumbers}>
              <View style={styles.streakNumberItem}>
                <Text style={styles.streakNumberValue}>{contributionStreak.current}</Text>
                <Text style={styles.streakNumberLabel}>Current</Text>
              </View>
              <View style={styles.streakNumberItem}>
                <Text style={styles.streakNumberValue}>{contributionStreak.longest}</Text>
                <Text style={styles.streakNumberLabel}>Best</Text>
              </View>
            </View>
          </View>
          <View style={styles.streakGrid}>
            {contributionStreak.weeks.map((active, i) => (
              <View
                key={i}
                style={[
                  styles.streakCell,
                  { width: streakCellSize, height: streakCellSize },
                  active && { backgroundColor: TC.primary },
                ]}
              />
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, contributionStreak, streakCellSize],
  );

  const renderContentStreaks = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(580).springify()}>
        <SectionHeader title="Streaks" subtitle="Consistency tracking" isDark={isDark} colors={fullThemeColors} />
        <View style={styles.streaksRow}>
          {contentStreaks.map((streak) => (
            <View key={streak.type} style={[styles.streakCard, { borderColor: `${streak.color}30` }]}>
              <View style={[styles.streakIconBg, { backgroundColor: `${streak.color}12` }]}>
                <Ionicons name={streak.icon as any} size={18} color={streak.color} />
              </View>
              <Text style={[styles.streakValue, { color: streak.color }]}>{streak.current}</Text>
              <Text style={styles.streakLabel}>{streak.type}</Text>
              <Text style={styles.streakBest}>Best: {streak.best}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, contentStreaks],
  );

  const renderSocialGraph = useCallback(
    () => (
      <Animated.View entering={FadeInUp.delay(600).springify()}>
        <SectionHeader
          title="Social Graph"
          subtitle="Engagement distribution"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.socialGraph}>
            {socialGraph.map((item) => (
              <View key={item.name} style={styles.socialGraphItem}>
                <View style={styles.socialGraphBarWrap}>
                  <View style={styles.socialGraphBarBg}>
                    <View
                      style={[
                        styles.socialGraphBarFill,
                        { height: `${item.value}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.socialGraphLabel}>{item.name}</Text>
                <Text style={[styles.socialGraphValue, { color: item.color }]}>{item.value}%</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    ),
    [isDark, fullThemeColors, styles, socialGraph],
  );

  const renderRecentInteractions = useCallback(() => {
    const recent = userPostList.slice(0, 3);
    if (recent.length === 0) return null;
    return (
      <Animated.View entering={FadeInUp.delay(650).springify()}>
        <SectionHeader
          title="Recent Interactions"
          subtitle="Latest activity"
          isDark={isDark}
          colors={fullThemeColors}
        />
        <View style={styles.recentList}>
          {recent.map((post) => {
            const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
            return (
              <TouchableOpacity
                key={post.id}
                onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id } as never)}
                style={styles.recentItem}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[`${topicColor}08`, `${topicColor}02`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.recentDot, { backgroundColor: topicColor }]} />
                <View style={styles.recentContent}>
                  <Text style={styles.recentTopic} numberOfLines={1}>
                    {post.topic}
                  </Text>
                  <Text style={styles.recentText} numberOfLines={1}>
                    {post.content}
                  </Text>
                </View>
                <View style={styles.recentStats}>
                  <Ionicons name="heart" size={12} color={post.isLiked ? TC.danger : '#64748b'} />
                  <Text style={styles.recentStatText}>{post.likes}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    );
  }, [isDark, fullThemeColors, styles, userPostList, navigation]);

  const handlePressPost = useCallback(
    (postId: string) => {
      navigation.navigate('PostDetail' as never, { postId } as never);
    },
    [navigation],
  );

  /* ── TABS ──────────────────────────────────────────────────────────── */

  const renderPostsTab = useCallback(
    () => (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        {renderEngagementInsights()}
        {renderInfluenceMetrics()}
        {renderCommunityInfluence()}
        {renderContentHighlights()}
        {renderContentBreakdown()}
        {renderActivityPattern()}

        <View style={styles.allThreadsHeader}>
          <View style={styles.allThreadsHeaderLeft}>
            <Ionicons name="document-text" size={20} color={TC.primary} />
            <Text style={styles.allThreadsTitle}>All Threads</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
            <Text style={[styles.badgeText, { color: themeColors.primary }]}>
              {userPostList.length} posts
            </Text>
          </View>
        </View>

        {userPostList.length === 0 ? (
          <GlassCard style={styles.emptyCard} delay={100} isDark={isDark} colors={fullThemeColors}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="document-text-outline" size={32} color={TC.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>No threads yet</Text>
            <Text style={styles.emptyText}>This parent has not shared any stories yet.</Text>
          </GlassCard>
        ) : (
          <FlatList
            data={userPostList}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <PostCard
                post={item}
                index={index}
                onPressPost={handlePressPost}
                isDark={isDark}
                colors={fullThemeColors}
              />
            )}
            scrollEnabled={false}
            contentContainerStyle={styles.postsList}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}
      </Animated.View>
    ),
    [
      styles,
      renderEngagementInsights,
      renderInfluenceMetrics,
      renderCommunityInfluence,
      renderContentHighlights,
      renderContentBreakdown,
      renderActivityPattern,
      userPostList,
      themeColors.primary,
      isDark,
      fullThemeColors,
      handlePressPost,
    ],
  );

  const renderAboutTab = useCallback(() => {
    if (!user) return null;
    const totalComments = userPostList.reduce((s, p) => s + p.commentsCount, 0);
    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <GlassCard style={styles.formCard} delay={80} isDark={isDark} colors={fullThemeColors}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: `${TC.primary}20` }]}>
              <Ionicons name="time-outline" size={20} color={TC.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {(user as any).addedAt
                  ? new Date((user as any).addedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '2024'}
              </Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="flame-outline" size={20} color="#f59e0b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Active Streak</Text>
              <Text style={styles.infoValue}>{user.stats?.streakDays || 0} days</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Ionicons name="heart-outline" size={20} color="#10b981" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Likes Received</Text>
              <Text style={styles.infoValue}>{userPostList.reduce((s, p) => s + p.likes, 0)}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Comments</Text>
              <Text style={styles.infoValue}>{totalComments}</Text>
            </View>
          </View>
        </GlassCard>

        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassCard style={styles.formCard} delay={160} isDark={isDark} colors={fullThemeColors}>
            <Text style={styles.sectionLabel}>Interested In</Text>
            <View style={styles.topicsWrap}>
              {user.selectedTopics.map((topicId) => {
                const topic = INITIAL_TOPICS.find((t) => t.id === topicId);
                const color = topic?.color || TOPIC_COLORS[topicId] || TC.primary;
                const name = topic?.name || topicId.replace('topic_', 'Topic ');
                return (
                  <View key={topicId} style={[styles.topicChip, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.topicChipText, { color }]} numberOfLines={1}>
                      {topic?.emoji ? `${topic.emoji} ${name}` : name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        )}
      </Animated.View>
    );
  }, [styles, isDark, fullThemeColors, user, userPostList]);

  const renderAchievementsTab = useCallback(() => {
    const achievements = user?.achievements || [];
    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <View style={styles.achievementsHeader}>
          <View style={styles.achievementsHeaderLeft}>
            <Ionicons name="trophy" size={20} color={TC.primary} />
            <Text style={styles.achievementsTitle}>Achievements</Text>
          </View>
          <View style={[styles.achievementsBadge, { backgroundColor: `${themeColors.primary}20` }]}>
            <Text style={[styles.achievementsBadgeText, { color: themeColors.primary }]}>
              {achievements.length} earned
            </Text>
          </View>
        </View>

        <GlassCard style={styles.achievementsCard} delay={100} isDark={isDark} colors={fullThemeColors}>
          {achievements.length > 0 ? (
            achievements.map((achievement) => {
              const badge = ACHIEVEMENTS[achievement] || {
                emoji: '🏅',
                name: achievement,
                color: TC.primary,
                desc: '',
              };
              return (
                <View
                  key={achievement}
                  style={[styles.achievementBadge, { backgroundColor: `${badge.color}08` }]}
                >
                  <View style={[styles.achievementIconBg, { backgroundColor: `${badge.color}12` }]}>
                    <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
                  </View>
                  <View style={styles.achievementInfo}>
                    <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
                    <Text style={styles.achievementDesc} numberOfLines={1}>
                      {badge.desc}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={badge.color} style={{ opacity: 0.5 }} />
                </View>
              );
            })
          ) : (
            <View style={styles.emptyAchievements}>
              <Ionicons name="trophy-outline" size={40} color={TC.primary} />
              <Text style={styles.emptyAchievementsTitle}>No achievements yet</Text>
              <Text style={styles.emptyAchievementsText}>This parent is just getting started!</Text>
            </View>
          )}
        </GlassCard>

        {achievements.length > 0 && (
          <GlassCard delay={160} isDark={isDark} colors={fullThemeColors}>
            <Text style={styles.progressTitle}>Progress</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <View style={styles.progressItemHeader}>
                  <Text style={styles.progressItemValue}>{userPostList.length}</Text>
                  <Text style={styles.progressItemLabel}>of 50 posts</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((userPostList.length / 50) * 100, 100)}%`,
                        backgroundColor: TC.primary,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.progressItem}>
                <View style={styles.progressItemHeader}>
                  <Text style={styles.progressItemValue}>{user?.stats?.helpful || 0}</Text>
                  <Text style={styles.progressItemLabel}>of 50 helpful</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(((user?.stats?.helpful || 0) / 50) * 100, 100)}%`,
                        backgroundColor: TC.success,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </GlassCard>
        )}
      </Animated.View>
    );
  }, [styles, isDark, fullThemeColors, user, userPostList, themeColors.primary]);

  const renderInsightsTab = useCallback(
    () => (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        {renderParentingTips()}
        {renderTopicBreakdown()}
        {renderInteractionHeatMap()}
        {renderContributionStreak()}
        {renderContentStreaks()}
        {renderSocialGraph()}
        {renderRecentInteractions()}
      </Animated.View>
    ),
    [
      styles,
      renderParentingTips,
      renderTopicBreakdown,
      renderInteractionHeatMap,
      renderContributionStreak,
      renderContentStreaks,
      renderSocialGraph,
      renderRecentInteractions,
    ],
  );

  /* ── Guards ────────────────────────────────────────────────────────── */

  // Only show "not found" AFTER hydration completes. No flash of "User
  // not found" while the Supabase fallback is still resolving.
  if (!user && !isHydrating) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text
          style={{ marginTop: 16, color: fullThemeColors.textSecondary, fontSize: 16, fontWeight: '600' }}
        >
          User not found
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: '#6366f1' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ── Main render — paints immediately, skeleton only for the hero ─── */

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fullThemeColors.background }]} />
      {renderStickyHeader()}

      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.topHeader, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.spinnerColor}
          />
        }
      >
        {/* Hero — skeleton on first frame, real content once hydrated */}
        {isHydrating && !user ? (
          <HeroSkeleton
            isDark={isDark}
            colors={fullThemeColors}
            coverHeight={heroCoverHeight}
            avatarSize={avatarSize}
            overlap={avatarOverlap}
          />
        ) : (
          renderProfileHero()
        )}

        {/* Tabs paint as soon as we have tabs (not gated on user) */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={fullThemeColors} />

        <View style={styles.tabPanelsWrap}>
          {user ? (
            <>
              {activeTab === 'posts' && renderPostsTab()}
              {activeTab === 'about' && renderAboutTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
              {activeTab === 'insights' && renderInsightsTab()}
            </>
          ) : (
            // Inline secondary skeleton for the tab body while user loads.
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 92,
                    borderRadius: DESIGN.radius.lg,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    marginBottom: 12,
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Avatar preview modal — tap on avatar opens this */}
      <Modal
        visible={showAvatarPreview && !!user}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPreview(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.avatarPreviewOverlay} onPress={() => setShowAvatarPreview(false)}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.avatarPreviewCard}>
            {user?.avatar && !isEmojiAvatar(user.avatar) ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarPreviewImage} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.avatarPreviewImage}>
                <Text style={{ fontSize: 96, textAlign: 'center', lineHeight: 280 }}>
                  {isEmojiAvatar(user?.avatar)
                    ? user?.avatar
                    : user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.avatarPreviewName}>{user?.displayName}</Text>
            <Text style={styles.avatarPreviewHandle}>{user?.handle}</Text>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const getStyles = (isDarkMode: boolean, colors: any = {}) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { flexGrow: 1 },

    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    stickySubtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

    topHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(15, 15, 30, 0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 6,
    },

    profileHero: { paddingBottom: 12 },
    coverPhotoContainer: { width: '100%', overflow: 'hidden', position: 'relative' },
    coverPhoto: { width: '100%', height: '100%' },
    coverPhotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
    profileHeroContent: { position: 'relative', zIndex: 2, paddingHorizontal: 16 },
    avatarSection: { alignItems: 'center', zIndex: 20 },
    avatarWrapper: {
      position: 'relative',
      zIndex: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 10,
    },
    avatarImage: { borderWidth: 4, borderColor: '#fff' },
    avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    avatarPlaceholderText: { fontWeight: '800', color: '#fff' },
    onlineIndicator: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    onlineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981' },

    profileInfo: { alignItems: 'center', marginTop: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
    profileName: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    verifiedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#6366f1',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileHandle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
    profileBio: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      lineHeight: 20,
      fontWeight: '500',
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    locationText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

    statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, gap: 20 },
  statsItem: {
  alignItems: 'center',
  paddingVertical: 4,
  paddingHorizontal: 6,
  borderRadius: 8,
},
    statsValue: { fontSize: 18, fontWeight: '800', color: colors.text },
    statsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    statsDivider: {
      width: 1,
      height: 24,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },

    // Action bar spans full padded width — negative margin cancels parent padding
    actionBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 12,
      marginTop: 16,
      marginHorizontal: -16,
      width: 'auto',
      alignSelf: 'stretch',
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    actionBarItem: { alignItems: 'center', gap: 4, flex: 1 },
    actionBarIcon: { justifyContent: 'center', alignItems: 'center' },
    actionBarIconSecondary: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.08)',
    },
    actionBarLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
    actionBarLabelActive: { color: '#64748b' },

    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 16,
      marginTop: 8,
      padding: 4,
      borderRadius: 16,
      gap: 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
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

    glassCard: {
      borderRadius: DESIGN.radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border || (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
      marginHorizontal: 16,
      marginBottom: DESIGN.spacing.lg,
    },
    glassBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    glassContent: { flex: 1 },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginHorizontal: 16,
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

    allThreadsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
      marginTop: 8,
    },
    allThreadsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    allThreadsTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    badgeText: { fontSize: 12, fontWeight: '700' },

    insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
    insightsIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    insightsTitleWrap: { flex: 1 },
    insightsTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    insightsSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    insightsGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
    insightItem: { flex: 1, alignItems: 'center', gap: 4 },
    insightItemIcon: { fontSize: 20 },
    insightItemValue: { fontSize: 20, fontWeight: '800' },
    insightItemLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

    influenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
    influenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    influenceTitleWrap: { flex: 1 },
    influenceTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    influenceSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    influenceOverallBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    influenceOverallText: { fontSize: 20, fontWeight: '800' },
    influenceGrid: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
    influenceItem: { gap: 6 },
    influenceItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    influenceItemIconBg: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    influenceItemLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
    influenceItemValue: { fontSize: 12, fontWeight: '700' },
    influenceBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    influenceBarFill: { height: '100%', borderRadius: 3 },

    communityInfluenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
    communityInfluenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    communityInfluenceTitleWrap: { flex: 1 },
    communityInfluenceTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    communityInfluenceSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    communityInfluenceScoreBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    communityInfluenceScoreText: { fontSize: 20, fontWeight: '800' },
    communityInfluenceRankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    communityInfluenceRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    communityInfluenceRankText: { fontSize: 13, fontWeight: '800' },
    communityInfluenceProgressWrap: { flex: 1, gap: 6 },
    communityInfluenceProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    communityInfluenceProgressLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    communityInfluenceProgressValue: { fontSize: 12, fontWeight: '700' },
    communityInfluenceProgressBarBg: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    communityInfluenceProgressBarFill: { height: '100%', borderRadius: 3 },
    communityInfluenceContributors: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    communityInfluenceContributorsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    communityInfluenceAvatarStack: { flexDirection: 'row', alignItems: 'center' },
    communityInfluenceAvatar: { borderRadius: 14, borderWidth: 2, borderColor: colors.background || '#0f0f1a' },

    highlightsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingBottom: 12,
    },
    highlightsTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    highlightsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    highlightsBadgeText: { fontSize: 12, fontWeight: '700' },
    highlightsPostCard: { paddingHorizontal: 16, paddingBottom: 16 },
    highlightsPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    highlightsTopicDot: { width: 8, height: 8, borderRadius: 4 },
    highlightsTopicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    highlightsPostTime: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
    highlightsPostContent: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginBottom: 10 },
    highlightsPostStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    highlightsPostStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    highlightsPostStatText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    highlightsDivider: {
      height: 1,
      marginHorizontal: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    highlightsMetrics: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16 },
    highlightsMetric: { flex: 1, alignItems: 'center', gap: 2 },
    highlightsMetricValue: { fontSize: 18, fontWeight: '800' },
    highlightsMetricLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

    breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
    breakdownTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    breakdownTotal: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    breakdownGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
    breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
    breakdownIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    breakdownValue: { fontSize: 18, fontWeight: '800' },
    breakdownLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

    patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
    patternTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    patternLiveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(16,185,129,0.12)',
    },
    patternLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    patternLiveText: { fontSize: 10, fontWeight: '700', color: '#10b981' },
    patternBars: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 16,
      height: 100,
    },
    patternBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
    patternBar: { width: 20, borderRadius: 6 },
    patternBarLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },

    mutualScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
    mutualCard: { padding: 12, borderRadius: 16, overflow: 'hidden', alignItems: 'center', gap: 6 },
    mutualAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: TC.primary },
    mutualName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },

    tipsList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
      borderLeftWidth: 3,
    },
    tipIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tipEmoji: { fontSize: 20 },
    tipContent: { flex: 1, marginLeft: 12, gap: 3 },
    tipTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    tipText: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: colors.textSecondary },

    topicBreakdown: { padding: 16, gap: 12 },
    topicBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topicBreakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, maxWidth: '40%' },
    topicBreakdownDot: { width: 8, height: 8, borderRadius: 4 },
    topicBreakdownLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    topicBreakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    topicBreakdownBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    topicBreakdownBarFill: { height: '100%', borderRadius: 3 },
    topicBreakdownCount: { fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },

    heatMapContainer: { padding: 16, paddingBottom: 12 },
    heatMapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 70 },
    heatMapCell: { alignItems: 'center', gap: 4, flex: 1 },
    heatMapBar: { width: 12, borderRadius: 6 },
    heatMapLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted || '#94a3b8' },
    heatMapLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
    heatMapLegendText: { fontSize: 10, fontWeight: '600', color: colors.textMuted || '#94a3b8' },
    heatMapLegendDot: { width: 8, height: 8, borderRadius: 4 },

    streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
    streakTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    streakSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
    streakNumbers: { flexDirection: 'row', gap: 16 },
    streakNumberItem: { alignItems: 'center' },
    streakNumberValue: { fontSize: 20, fontWeight: '800', color: colors.text },
    streakNumberLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 16 },
    streakCell: {
      borderRadius: 6,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },

    streaksRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
    streakCard: {
      flex: 1,
      borderRadius: 20,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
    },
    streakIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    streakValue: { fontSize: 22, fontWeight: '800' },
    streakLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    streakBest: { fontSize: 10, fontWeight: '500', color: colors.textMuted || '#94a3b8', marginTop: 2 },

    socialGraph: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 16,
      height: 120,
    },
    socialGraphItem: { alignItems: 'center', gap: 6, flex: 1 },
    socialGraphBarWrap: { height: 80, justifyContent: 'flex-end' },
    socialGraphBarBg: {
      width: 24,
      height: 80,
      borderRadius: 12,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    socialGraphBarFill: { width: '100%', borderRadius: 12 },
    socialGraphLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    socialGraphValue: { fontSize: 13, fontWeight: '800' },

    recentList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
    },
    recentDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    recentContent: { flex: 1, gap: 2 },
    recentTopic: { fontSize: 13, fontWeight: '700', color: colors.text },
    recentText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
    recentStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    recentStatText: { fontSize: 12, fontWeight: '600', color: colors.textMuted || '#94a3b8' },

    postItem: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    postItemContent: { padding: 16 },
    postItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    postItemTopic: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      maxWidth: '70%',
    },
    postItemTopicDot: { width: 6, height: 6, borderRadius: 3 },
    postItemTopicText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    postItemTime: { fontSize: 11, fontWeight: '500', color: colors.textMuted || '#94a3b8' },
    postItemContentText: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 22 },
    postItemImageWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', height: 160 },
    postItemImage: { width: '100%', height: '100%' },
    postItemStats: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    postItemStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    postItemStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

    postsList: { paddingHorizontal: 16 },

    formCard: { marginHorizontal: 16, marginBottom: 16 },
    sectionLabel: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 16,
    },
    infoItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    infoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    infoContent: { flex: 1, gap: 2 },
    infoLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    infoValue: { fontSize: 15, fontWeight: '700', color: colors.text },
    infoDivider: {
      height: 1,
      marginHorizontal: 20,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
    topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, maxWidth: '100%' },
    topicChipText: { fontSize: 13, fontWeight: '700' },

    tabPanel: { paddingBottom: 20 },
    tabPanelsWrap: { flex: 1 },

    achievementsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    achievementsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    achievementsTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    achievementsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    achievementsBadgeText: { fontSize: 12, fontWeight: '700' },

    achievementsCard: { padding: 16 },
    achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
    achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    achievementEmoji: { fontSize: 22 },
    achievementInfo: { flex: 1, gap: 2 },
    achievementName: { fontSize: 14, fontWeight: '700' },
    achievementDesc: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

    emptyAchievements: { padding: 32, alignItems: 'center' },
    emptyAchievementsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 4 },
    emptyAchievementsText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },

    progressTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 16,
    },
    progressRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingBottom: 20 },
    progressItem: { flex: 1 },
    progressItemHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
    progressItemValue: { fontSize: 20, fontWeight: '800', color: colors.text },
    progressItemLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
    progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.15)', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyStateIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: 'rgba(99,102,241,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyStateTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textMuted || '#94a3b8', fontWeight: '500', textAlign: 'center' },

    retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
    retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    avatarPreviewOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    avatarPreviewCard: {
      alignItems: 'center',
      padding: 24,
      borderRadius: 28,
      backgroundColor: 'rgba(15,15,30,0.75)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      maxWidth: 400,
    },
    avatarPreviewImage: {
      width: 240,
      height: 240,
      borderRadius: 120,
      borderWidth: 4,
      borderColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginBottom: 16,
    },
    avatarPreviewName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    avatarPreviewHandle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  });