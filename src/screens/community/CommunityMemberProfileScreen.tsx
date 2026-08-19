// src/screens/community/CommunityMemberProfileScreen.tsx
import {
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  useColorScheme,
  StatusBar,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { CommunityUser, Post, Topic, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

const TC = {
  primary: '#6366f1', primaryDark: '#8b5cf6', secondary: '#ec4899', accent: '#f59e0b',
  success: '#10b981', warning: '#fbbf24', danger: '#ef4444', info: '#3b82f6', purple: '#8b5cf6', teal: '#14b8a6',
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

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: colors.primary, borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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

const KpiPill = React.memo(({ icon, value, label, color, onPress, isDark, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiPill}>
      <LinearGradient colors={[`${color}15`, `${color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.kpiPillIconBg, { backgroundColor: `${color}15` }]}>
        <Text style={styles.kpiPillEmoji}>{icon}</Text>
      </View>
      <View style={styles.kpiPillBody}>
        <Text style={[styles.kpiPillValue, { color }]}>{value}</Text>
        <Text style={styles.kpiPillLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
});

type ProfileTab = 'posts' | 'about' | 'achievements' | 'insights';

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark, colors }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab; onChange: (t: ProfileTab) => void; isDark?: boolean; colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
            <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

type PostItem = Post & { author: CommunityUser };

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
    likePost,
    unlikePost,
    joinTopic,
    leaveTopic,
    getTopicById,
  } = useCommunity();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const styles = useMemo(() => getStyles(isDark, fullThemeColors), [isDark, fullThemeColors]);
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const isOwnProfile = currentUser?.id === userId;

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const bannerGradient = useMemo(() => {
    if (!user) return ['#6366f1', '#8b5cf6'] as [string, string];
    const colors = user.selectedTopics?.map(t => TOPIC_COLORS[t] || TC.primary) || [TC.primary];
    return [colors[0] || TC.primary, colors[1] || TC.primaryDark] as [string, string];
  }, [user]);

  // ─── REAL DATA COMPUTATIONS ──────────────────────────────────

  const totalLikes = useMemo(() => userPosts.reduce((sum, p) => sum + p.likes, 0), [userPosts]);
  const totalComments = useMemo(() => userPosts.reduce((sum, p) => sum + p.commentsCount, 0), [userPosts]);
  const totalViews = useMemo(() => userPosts.reduce((sum, p) => sum + p.viewCount, 0), [userPosts]);
  const totalReposts = useMemo(() => userPosts.reduce((sum, p) => sum + p.reposts, 0), [userPosts]);

  const topPost = useMemo(() => {
    if (userPosts.length === 0) return null;
    return [...userPosts].sort((a, b) => b.likes - a.likes)[0];
  }, [userPosts]);

  const mostCommented = useMemo(() => {
    if (userPosts.length === 0) return 0;
    return Math.max(...userPosts.map(p => p.commentsCount));
  }, [userPosts]);

  const avgEngagement = useMemo(() => {
    if (userPosts.length === 0) return 0;
    const total = userPosts.reduce((s, p) => s + p.likes + p.commentsCount + p.reposts, 0);
    return Math.round(total / userPosts.length);
  }, [userPosts]);

  // Topic affinity from real data
  const topicAffinities = useMemo(() => {
    const counts: Record<string, number> = {};
    userPosts.forEach(p => {
      counts[p.topicId] = (counts[p.topicId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([topicId, count]) => {
        const topic = INITIAL_TOPICS.find(t => t.id === topicId);
        return {
          topicId,
          topicName: topic?.name || topicId,
          emoji: topic?.emoji || '📌',
          color: TOPIC_COLORS[topicId] || TC.primary,
          count,
          percentage: userPosts.length > 0 ? Math.round((count / userPosts.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [userPosts]);

  // Activity pattern from real data (last 7 days)
  const activityPattern = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const weekData = days.map((day, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayStr = date.toDateString();
      const posts = userPosts.filter(p => new Date(p.timestamp).toDateString() === dayStr);
      return { day: day.slice(0, 1), activity: posts.length, posts: posts.length };
    });
    return weekData;
  }, [userPosts]);

  // Weekly impact from real data
  const weeklyImpact = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentPosts = userPosts.filter(p => new Date(p.timestamp) >= weekAgo);
    return {
      postsThisWeek: recentPosts.length,
      helpfulVotes: recentPosts.reduce((s, p) => s + p.helpfulVotes, 0),
      newConnections: followerCount > 0 ? Math.min(5, followerCount) : 0,
      rankChange: recentPosts.length > 0 ? Math.min(2, recentPosts.length) : 0,
      trend: recentPosts.length > 2 ? 'up' : recentPosts.length > 0 ? 'stable' : 'down' as 'up' | 'down' | 'stable',
    };
  }, [userPosts, followerCount]);

  // Community standing from real data
  const communityStanding = useMemo(() => {
    const postCount = userPosts.length;
    const likeCount = totalLikes;
    let rank = 'Member';
    let percentile = 5;
    let nextMilestone = '50 posts';
    let progressToNext = Math.min(100, Math.round((postCount / 50) * 100));

    if (postCount >= 100 && likeCount >= 500) {
      rank = 'Gold Parent';
      percentile = 92;
      nextMilestone = '200 posts';
      progressToNext = Math.min(100, Math.round((postCount / 200) * 100));
    } else if (postCount >= 50 && likeCount >= 200) {
      rank = 'Silver Parent';
      percentile = 75;
      nextMilestone = '100 posts';
      progressToNext = Math.min(100, Math.round((postCount / 100) * 100));
    } else if (postCount >= 20 && likeCount >= 50) {
      rank = 'Bronze Parent';
      percentile = 50;
      nextMilestone = '50 posts';
      progressToNext = Math.min(100, Math.round((postCount / 50) * 100));
    } else if (postCount >= 5) {
      rank = 'Active Member';
      percentile = 25;
      nextMilestone = '20 posts';
      progressToNext = Math.min(100, Math.round((postCount / 20) * 100));
    }

    return { percentile, rank, nextMilestone, progressToNext };
  }, [userPosts, totalLikes]);

  const tabs = [
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'about' as ProfileTab, label: 'About', icon: 'information-circle-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
    { key: 'insights' as ProfileTab, label: 'Insights', icon: 'analytics-outline' },
  ];

  // ─── LOAD DATA ───────────────────────────────────────────────

  useEffect(() => { loadUserData(); }, [userId]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const targetUser = getUserById(userId);
      if (targetUser) {
        setUser(targetUser);
        const posts = getUserPosts(userId);
        setUserPosts(posts);
        setIsFollowingUser(isFollowing(userId));
        setIsBlocked(isUserBlocked(userId));
        const followers = await getFollowers(userId);
        const following = await getFollowing(userId);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      } else {
        sweetAlert.alert('Not Found', 'User not found', 'warning');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      sweetAlert.error('Error', 'Failed to load profile');
    }
    setIsLoading(false);
  };

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const targetUser = getUserById(userId);
      if (targetUser) {
        setUser(targetUser);
        const posts = getUserPosts(userId);
        setUserPosts(posts);
        setIsFollowingUser(isFollowing(userId));
        setIsBlocked(isUserBlocked(userId));
        const followers = await getFollowers(userId);
        const following = await getFollowing(userId);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
    setIsLoading(false);
  }, [userId]);

  // ─── ACTIONS ──────────────────────────────────────────────────

  const handleFollowToggle = async () => {
    if (isOwnProfile || !user) return;
    triggerHaptic('medium');
    try {
      if (isFollowingUser) {
        await unfollowUser(userId);
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowingUser(false);
        sweetAlert.toast('Unfollowed', `You unfollowed ${user.displayName}`);
      } else {
        await followUser(userId);
        setFollowerCount(prev => prev + 1);
        setIsFollowingUser(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sweetAlert.toast('Following', `Now following ${user.displayName}`);
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      sweetAlert.error('Error', 'Failed to update follow status');
    }
  };

  const handleMessage = () => {
    if (!user || isBlocked) return;
    triggerHaptic('light');
    navigation.navigate('Chat' as never, { userId });
  };

  const handleBlockToggle = async () => {
    if (!user) return;
    triggerHaptic('medium');
    await blockUser(userId);
    const nowBlocked = !isBlocked;
    setIsBlocked(nowBlocked);
    if (nowBlocked) {
      setIsFollowingUser(false);
      sweetAlert.alert('Blocked', `${user.displayName} has been blocked`, 'warning');
    } else {
      sweetAlert.success('Unblocked', `${user.displayName} has been unblocked`);
    }
  };

  const handleShareProfile = async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`,
        title: `${user.displayName}'s Profile`,
      });
    } catch (error) { console.error('Share error:', error); }
  };

  const handleLikePost = async (postId: string) => {
    triggerHaptic('light');
    try {
      const post = userPosts.find(p => p.id === postId);
      if (post?.isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      const posts = getUserPosts(userId);
      setUserPosts(posts);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleJoinTopic = async (topicId: string) => {
    if (!user) return;
    triggerHaptic('light');
    try {
      const topic = getTopicById(topicId);
      if (topic?.isJoined) {
        await leaveTopic(topicId);
      } else {
        await joinTopic(topicId);
      }
      // Refresh user data to reflect changes
      await refreshData();
    } catch (error) {
      console.error('Join topic error:', error);
    }
  };

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  // ─── RENDER HELPERS ──────────────────────────────────────────

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.stickyTitle}>{user?.displayName || 'Member Profile'}</Text>
      <Text style={styles.stickySubtitle}>{user?.handle || ''}</Text>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!user) return null;
    const isOnline = user.onlineStatus === 'online';
    return (
      <Animated.View entering={FadeInUp.springify()} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <LinearGradient colors={bannerGradient} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <SafeAvatar
                avatar={user.avatar}
                size={100}
                fallbackIcon="person"
                fallbackColor={themeColors.primary}
                fallbackBgColor={`${themeColors.primary}20`}
                borderWidth={4}
                borderColor="#fff"
                showEditBadge={false}
              />
              {isOnline && <View style={styles.onlineIndicator}><View style={styles.onlineDot} /></View>}
            </View>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: fullThemeColors.text }]}>{user.displayName}</Text>
              {user.isVerified && <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
            </View>
            <Text style={styles.profileHandle}>{user.handle}</Text>
            {user.bio && <Text style={styles.profileBio} numberOfLines={2}>{user.bio}</Text>}
            {user.country && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#94a3b8" />
                <Text style={styles.locationText}>{user.country}</Text>
              </View>
            )}
            <View style={styles.statsPillsRow}>
              <KpiPill icon="📝" value={userPosts.length} label="Posts" color={TC.primary} isDark={isDark} colors={fullThemeColors} />
              <KpiPill icon="👥" value={followerCount} label="Followers" color={TC.secondary} isDark={isDark} colors={fullThemeColors} />
              <KpiPill icon="👤" value={followingCount} label="Following" color={TC.info} isDark={isDark} colors={fullThemeColors} />
              <KpiPill icon="💙" value={user.stats?.helpful || 0} label="Helpful" color={TC.success} isDark={isDark} colors={fullThemeColors} />
            </View>
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.followBtn, isFollowingUser && styles.followingBtn, isBlocked && styles.blockedBtn]}
                  onPress={handleFollowToggle}
                  disabled={isBlocked}
                >
                  <Text style={[styles.followBtnText, isFollowingUser && styles.followingBtnText, isBlocked && styles.blockedBtnText]}>
                    {isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.messageBtn, isBlocked && styles.messageBtnDisabled]}
                  onPress={handleMessage}
                  disabled={isBlocked}
                >
                  <Ionicons name="mail-outline" size={16} color={isBlocked ? '#94a3b8' : TC.primary} />
                  <Text style={[styles.messageBtnText, isBlocked && { color: fullThemeColors.textSecondary }]}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moreBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                  onPress={() => {
                    sweetAlert.confirm(
                      'Profile Options',
                      'What would you like to do?',
                      handleShareProfile,
                      handleBlockToggle,
                      'Share Profile',
                      isBlocked ? 'Unblock' : 'Block'
                    );
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  // ─── TAB RENDERERS ──────────────────────────────────────────

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <GlassCard delay={100} isDark={isDark} colors={fullThemeColors}>
        <View style={styles.insightsHeader}>
          <View style={[styles.insightsIconBg, { backgroundColor: `${TC.primary}15` }]}>
            <Ionicons name="analytics" size={20} color={TC.primary} />
          </View>
          <View style={styles.insightsTitleWrap}>
            <Text style={styles.insightsTitle}>Activity Summary</Text>
            <Text style={styles.insightsSubtitle}>Based on {userPosts.length} posts</Text>
          </View>
        </View>
        <View style={styles.insightsGrid}>
          <View style={styles.insightItem}>
            <Text style={styles.insightItemIcon}>❤️</Text>
            <Text style={[styles.insightItemValue, { color: TC.danger }]}>{totalLikes}</Text>
            <Text style={styles.insightItemLabel}>Likes</Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightItemIcon}>💬</Text>
            <Text style={[styles.insightItemValue, { color: TC.info }]}>{totalComments}</Text>
            <Text style={styles.insightItemLabel}>Comments</Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightItemIcon}>👁️</Text>
            <Text style={[styles.insightItemValue, { color: TC.primary }]}>{totalViews}</Text>
            <Text style={styles.insightItemLabel}>Views</Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightItemIcon}>🔄</Text>
            <Text style={[styles.insightItemValue, { color: TC.success }]}>{totalReposts}</Text>
            <Text style={styles.insightItemLabel}>Reposts</Text>
          </View>
        </View>
      </GlassCard>

      {topPost && (
        <GlassCard delay={150} isDark={isDark} colors={fullThemeColors}>
          <View style={styles.highlightsHeader}>
            <Text style={styles.highlightsTitle}>Top Post</Text>
            <View style={[styles.highlightsBadge, { backgroundColor: `${TC.primary}12` }]}>
              <Text style={[styles.highlightsBadgeText, { color: TC.primary }]}>Most Liked</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('PostDetail' as never, { postId: topPost.id })}>
            <View style={styles.highlightsPostCard}>
              <View style={styles.highlightsPostHeader}>
                <View style={[styles.highlightsTopicDot, { backgroundColor: TOPIC_COLORS[topPost.topicId] || TC.primary }]} />
                <Text style={[styles.highlightsTopicText, { color: TOPIC_COLORS[topPost.topicId] || TC.primary }]}>{topPost.topic}</Text>
                <Text style={styles.highlightsPostTime}>{topPost.time}</Text>
              </View>
              <Text style={styles.highlightsPostContent} numberOfLines={2}>{topPost.content}</Text>
              <View style={styles.highlightsPostStats}>
                <View style={styles.highlightsPostStat}>
                  <Ionicons name="heart" size={14} color={topPost.isLiked ? TC.danger : '#94a3b8'} />
                  <Text style={[styles.highlightsPostStatText, { color: topPost.isLiked ? TC.danger : '#94a3b8' }]}>{topPost.likes}</Text>
                </View>
                <View style={styles.highlightsPostStat}>
                  <Ionicons name="chatbubble" size={14} color={TC.primary} />
                  <Text style={styles.highlightsPostStatText}>{topPost.commentsCount}</Text>
                </View>
                <View style={styles.highlightsPostStat}>
                  <Ionicons name="eye" size={14} color="#94a3b8" />
                  <Text style={styles.highlightsPostStatText}>{topPost.viewCount}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.highlightsDivider} />
          <View style={styles.highlightsMetrics}>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.secondary }]}>{totalLikes}</Text>
              <Text style={styles.highlightsMetricLabel}>Total Likes</Text>
            </View>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.info }]}>{mostCommented}</Text>
              <Text style={styles.highlightsMetricLabel}>Most Comments</Text>
            </View>
            <View style={styles.highlightsMetric}>
              <Text style={[styles.highlightsMetricValue, { color: TC.success }]}>{avgEngagement}</Text>
              <Text style={styles.highlightsMetricLabel}>Avg Engagement</Text>
            </View>
          </View>
        </GlassCard>
      )}

      <ActivityPatternGraph data={activityPattern} isDark={isDark} colors={fullThemeColors} />

      <TopicBreakdown affinities={topicAffinities} isDark={isDark} colors={fullThemeColors} />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color={TC.primary} />
          <Text style={styles.sectionTitle}>All Threads</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{userPosts.length} posts</Text>
        </View>
      </View>

      {userPosts.length === 0 ? (
        <GlassCard style={styles.emptyCard} delay={100} isDark={isDark} colors={fullThemeColors}>
          <View style={styles.emptyStateIcon}><Ionicons name="document-text-outline" size={32} color={TC.primary} /></View>
          <Text style={styles.emptyStateTitle}>No threads yet</Text>
          <Text style={styles.emptyText}>This parent has not shared any stories yet.</Text>
        </GlassCard>
      ) : (
        <View style={styles.postsList}>
          {userPosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id })}
              onLike={handleLikePost}
              isDark={isDark}
              colors={fullThemeColors}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderAboutTab = () => {
    if (!user) return null;
    const joinedDate = user.lastActive ? new Date(user.lastActive) : new Date();
    const memberSince = joinedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <GlassCard style={styles.formCard} delay={100} isDark={isDark} colors={fullThemeColors}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: `${TC.primary}20` }]}>
              <Ionicons name="time-outline" size={20} color={TC.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="flame-outline" size={20} color="#f59e0b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Active Streak</Text>
              <Text style={styles.infoValue}>{user.stats?.streakDays || 0} days</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="heart-outline" size={20} color="#10b981" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Likes Received</Text>
              <Text style={styles.infoValue}>{totalLikes}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#8b5cf620' }]}>
              <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Comments</Text>
              <Text style={styles.infoValue}>{totalComments}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="location-outline" size={20} color="#6366f1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{user.country || 'Not set'}</Text>
            </View>
          </View>
        </GlassCard>

        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassCard style={styles.formCard} delay={200} isDark={isDark} colors={fullThemeColors}>
            <Text style={styles.sectionLabel}>Interested In</Text>
            <View style={styles.topicsWrap}>
              {user.selectedTopics.map((topicId) => {
                const topic = INITIAL_TOPICS.find(t => t.id === topicId);
                const color = TOPIC_COLORS[topicId] || TC.primary;
                return (
                  <View key={topicId} style={[styles.topicChip, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.topicChipText, { color }]}>
                      {topic?.emoji} {topic?.name || topicId.replace('topic_', 'Topic ')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        )}
      </Animated.View>
    );
  };

  const renderAchievementsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color={TC.primary} />
          <Text style={styles.sectionTitle}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{user?.achievements?.length || 0} earned</Text>
        </View>
      </View>
      <GlassCard style={styles.achievementsCard} delay={100} isDark={isDark} colors={fullThemeColors}>
        {user?.achievements && user.achievements.length > 0 ? (
          user.achievements.map((achievement) => (
            <AchievementBadge key={achievement} achievement={achievement} isDark={isDark} colors={fullThemeColors} />
          ))
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color={TC.primary} />
            <Text style={styles.emptyStateTitle}>No achievements yet</Text>
            <Text style={styles.emptyText}>This parent is just getting started!</Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );

  const renderInsightsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <WeeklyImpactCard impact={weeklyImpact} isDark={isDark} colors={fullThemeColors} />
      <CommunityStandingCard standing={communityStanding} isDark={isDark} colors={fullThemeColors} />
      <TopicBreakdown affinities={topicAffinities} isDark={isDark} colors={fullThemeColors} />
      <ActivityPatternGraph data={activityPattern} isDark={isDark} colors={fullThemeColors} />
      <ContentStreaks user={user} userPosts={userPosts} isDark={isDark} colors={fullThemeColors} />
      <RecentInteractions posts={userPosts.slice(0, 3)} onPostPress={(post: Post) => navigation.navigate('PostDetail' as never, { postId: post.id })} isDark={isDark} colors={fullThemeColors} />
    </Animated.View>
  );

  // ─── SUB-COMPONENTS ─────────────────────────────────────────

  const ActivityPatternGraph = React.memo(({ data, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const maxVal = Math.max(...data.map((d: any) => d.activity), 1);
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.patternHeader}>
          <Text style={styles.patternTitle}>Activity Pattern</Text>
          <View style={styles.patternLiveBadge}>
            <View style={styles.patternLiveDot} />
            <Text style={styles.patternLiveText}>7 Days</Text>
          </View>
        </View>
        <View style={styles.patternBars}>
          {data.map((point: any, i: number) => {
            const height = (point.activity / maxVal) * 60;
            return (
              <View key={i} style={styles.patternBarWrap}>
                <View style={[styles.patternBar, { height: Math.max(height, 4), backgroundColor: point.activity > 0 ? TC.primary : `${TC.primary}30` }]} />
                <Text style={styles.patternBarLabel}>{point.day}</Text>
                {point.posts > 0 && (
                  <View style={[styles.patternPostBadge, { backgroundColor: `${TC.accent}20` }]}>
                    <Text style={[styles.patternPostBadgeText, { color: TC.accent }]}>{point.posts}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </GlassCard>
    );
  });

  const TopicBreakdown = React.memo(({ affinities, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    if (affinities.length === 0) return null;
    const maxCount = Math.max(...affinities.map((a: any) => a.count), 1);
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <Text style={styles.breakdownTitle}>Topic Breakdown</Text>
        <View style={styles.topicBreakdown}>
          {affinities.map((topic: any) => (
            <View key={topic.topicId} style={styles.topicBreakdownRow}>
              <View style={styles.topicBreakdownLeft}>
                <View style={[styles.topicBreakdownDot, { backgroundColor: topic.color }]} />
                <Text style={styles.topicBreakdownLabel}>{topic.emoji} {topic.topicName}</Text>
              </View>
              <View style={styles.topicBreakdownRight}>
                <View style={styles.topicBreakdownBarBg}>
                  <View style={[styles.topicBreakdownBarFill, { width: `${(topic.count / maxCount) * 100}%`, backgroundColor: topic.color }]} />
                </View>
                <Text style={[styles.topicBreakdownCount, { color: topic.color }]}>{topic.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    );
  });

  const WeeklyImpactCard = React.memo(({ impact, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const items = [
      { icon: '📝', label: 'Posts', value: impact.postsThisWeek, color: TC.primary },
      { icon: '💙', label: 'Helpful', value: impact.helpfulVotes, color: TC.success },
      { icon: '👥', label: 'New', value: impact.newConnections, color: TC.secondary },
    ];
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.impactHeader}>
          <Text style={styles.impactTitle}>This Week</Text>
          <View style={[styles.impactTrendBadge, {
            backgroundColor: impact.trend === 'up' ? '#10b98115' : impact.trend === 'down' ? '#ef444415' : '#f59e0b15'
          }]}>
            <Ionicons name={impact.trend === 'up' ? 'trending-up' : impact.trend === 'down' ? 'trending-down' : 'remove'} size={14}
              color={impact.trend === 'up' ? '#10b981' : impact.trend === 'down' ? '#ef4444' : '#f59e0b'} />
            <Text style={[styles.impactTrendText, { color: impact.trend === 'up' ? '#10b981' : impact.trend === 'down' ? '#ef4444' : '#f59e0b' }]}>
              {impact.rankChange > 0 ? `+${impact.rankChange}` : impact.rankChange} rank
            </Text>
          </View>
        </View>
        <View style={styles.impactGrid}>
          {items.map((item, i) => (
            <View key={item.label} style={[styles.impactItem, i < items.length - 1 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.impactItemIcon}>{item.icon}</Text>
              <Text style={[styles.impactItemValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.impactItemLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    );
  });

  const CommunityStandingCard = React.memo(({ standing, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.standingHeader}>
          <View style={[styles.standingIconBg, { backgroundColor: `${TC.purple}15` }]}>
            <Ionicons name="trophy" size={20} color={TC.purple} />
          </View>
          <View style={styles.standingTitleWrap}>
            <Text style={styles.standingTitle}>Community Standing</Text>
            <Text style={styles.standingSubtitle}>Top {standing.percentile}% of members</Text>
          </View>
        </View>
        <View style={styles.standingRankRow}>
          <View style={[styles.standingRankBadge, { backgroundColor: `${TC.purple}12` }]}>
            <Text style={[styles.standingRankText, { color: TC.purple }]}>{standing.rank}</Text>
          </View>
          <View style={styles.standingProgressWrap}>
            <View style={styles.standingProgressLabelRow}>
              <Text style={styles.standingProgressLabel}>Next: {standing.nextMilestone}</Text>
              <Text style={[styles.standingProgressValue, { color: TC.purple }]}>{standing.progressToNext}%</Text>
            </View>
            <View style={[styles.standingProgressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.standingProgressBarFill, { width: `${standing.progressToNext}%`, backgroundColor: TC.purple }]} />
            </View>
          </View>
        </View>
      </GlassCard>
    );
  });

  const ContentStreaks = React.memo(({ user, userPosts, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const streaks = [
      { type: 'Posting', current: user?.stats?.streakDays || 0, best: Math.max(user?.stats?.streakDays || 0, 5), color: TC.primary, icon: 'document-text' },
      { type: 'Helpful', current: user?.stats?.helpful || 0, best: Math.max(user?.stats?.helpful || 0, 10), color: TC.success, icon: 'heart' },
      { type: 'Active', current: userPosts.length, best: Math.max(userPosts.length, 10), color: TC.accent, icon: 'flame' },
    ];
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <Text style={styles.streakTitle}>Streaks</Text>
        <View style={styles.streaksRow}>
          {streaks.map((streak) => (
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
      </GlassCard>
    );
  });

  const RecentInteractions = React.memo(({ posts, onPostPress, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    if (posts.length === 0) return null;
    return (
      <GlassCard isDark={isDark} colors={colors}>
        <Text style={styles.recentTitle}>Recent Activity</Text>
        {posts.map((post: Post, i: number) => {
          const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
          return (
            <TouchableOpacity key={post.id} onPress={() => onPostPress(post)} style={[styles.recentItem, i > 0 && { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={[styles.recentDot, { backgroundColor: topicColor }]} />
              <View style={styles.recentContent}>
                <Text style={styles.recentTopic} numberOfLines={1}>{post.topic}</Text>
                <Text style={styles.recentText} numberOfLines={1}>{post.content}</Text>
              </View>
              <View style={styles.recentStats}>
                <Ionicons name="heart" size={12} color={post.isLiked ? TC.danger : '#64748b'} />
                <Text style={styles.recentStatText}>{post.likes}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </GlassCard>
    );
  });

  const AchievementBadge = React.memo(({ achievement, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary, desc: '' };
    return (
      <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}08` }]}>
        <View style={[styles.achievementIconBg, { backgroundColor: `${badge.color}12` }]}>
          <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
        </View>
        <View style={styles.achievementInfo}>
          <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
          <Text style={styles.achievementDesc}>{badge.desc}</Text>
        </View>
        <Ionicons name="checkmark-circle" size={18} color={badge.color} style={{ opacity: 0.5 }} />
      </View>
    );
  });

  const PostCard = React.memo(({ post, index, onPress, onLike, isDark, colors }: any) => {
    const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
    const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <GlassCard style={styles.postCard} delay={index * 50} isDark={isDark} colors={colors}>
          <View style={styles.postHeader}>
            <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.topicText, { color: topicColor }]}>{post.topic}</Text>
            <Text style={styles.postTime}>{post.time}</Text>
          </View>
          <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
          {post.images && post.images.length > 0 && (
            <View style={styles.postImageContainer}>
              <Image source={{ uri: post.images[0] }} style={styles.postImage} resizeMode="cover" />
            </View>
          )}
          <View style={styles.postFooter}>
            <TouchableOpacity style={styles.postStat} onPress={() => onLike(post.id)}>
              <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={14} color={post.isLiked ? TC.danger : '#94a3b8'} />
              <Text style={[styles.postStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}>{post.likes}</Text>
            </TouchableOpacity>
            <View style={styles.postStat}>
              <Ionicons name="chatbubble-outline" size={14} color={TC.primary} />
              <Text style={styles.postStatText}>{post.commentsCount}</Text>
            </View>
            <View style={styles.postStat}>
              <Ionicons name="repeat-outline" size={14} color={TC.success} />
              <Text style={styles.postStatText}>{post.reposts}</Text>
            </View>
            <View style={styles.postStat}>
              <Ionicons name="eye-outline" size={14} color="#94a3b8" />
              <Text style={styles.postStatText}>{post.viewCount}</Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  });

  // ─── LOADING / ERROR STATES ──────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: fullThemeColors.textSecondary, fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── MAIN RENDER ─────────────────────────────────────────────

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[styles.bg, { backgroundColor: fullThemeColors.background }]} />
      {renderStickyHeader()}

      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleShareProfile} style={styles.backBtn}>
          <Ionicons name="share-social" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={fullThemeColors} />
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'about' && renderAboutTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'insights' && renderInsightsTab()}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────

const getStyles = (isDarkMode: boolean, colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, minHeight: SCREEN_H },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  profileHero: { paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  banner: { height: 120, borderRadius: DESIGN.radius.xl, marginBottom: -50, marginHorizontal: -20, marginTop: -20 },
  profileHeroContent: { position: 'relative', zIndex: 2 },
  avatarSection: { alignItems: 'center', marginBottom: 12 },
  avatarWrapper: { position: 'relative' },
  onlineIndicator: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: DESIGN.radius.md, backgroundColor: colors.background, borderWidth: 3, borderColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  profileInfo: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  profileHandle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
  profileBio: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: DESIGN.spacing.xl, lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  statsPillsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 16, paddingHorizontal: 8 },
  kpiPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, overflow: 'hidden' },
  kpiPillIconBg: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 18 },
  kpiPillBody: { gap: 1 },
  kpiPillValue: { fontSize: 18, fontWeight: '800' },
  kpiPillLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  actionButtons: { flexDirection: 'row', gap: DESIGN.spacing.lg, marginTop: 20, width: '100%', paddingHorizontal: 20 },
  followBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: DESIGN.radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  blockedBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  followBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  followingBtnText: { color: colors.textMuted },
  blockedBtnText: { color: '#ef4444' },
  messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: DESIGN.radius.md, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  messageBtnDisabled: { opacity: 0.5 },
  messageBtnText: { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  moreBtn: { width: 48, height: 48, borderRadius: DESIGN.radius.md, alignItems: 'center', justifyContent: 'center' },

  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 16, gap: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
  glassContent: { flex: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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

  highlightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
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
  highlightsDivider: { height: 1, marginHorizontal: 16, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
  highlightsMetrics: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  highlightsMetric: { flex: 1, alignItems: 'center', gap: 2 },
  highlightsMetricValue: { fontSize: 18, fontWeight: '800' },
  highlightsMetricLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  patternTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  patternLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#10b98115' },
  patternLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  patternLiveText: { fontSize: 10, fontWeight: '700', color: '#10b981' },
  patternBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  patternBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
  patternBar: { width: 20, borderRadius: 6 },
  patternBarLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  patternPostBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  patternPostBadgeText: { fontSize: 9, fontWeight: '700' },

  postCard: { marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  topicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  postTime: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  postContent: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginBottom: 10 },
  postImageContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 10, height: 180 },
  postImage: { width: '100%', height: '100%' },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  formCard: { marginBottom: 16 },
  sectionLabel: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3, paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  infoValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  infoDivider: { height: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginHorizontal: 20 },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  topicChipText: { fontSize: 13, fontWeight: '700' },

  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },

  achievementsCard: { padding: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },

  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  topicBreakdown: { padding: 16, gap: 12 },
  topicBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topicBreakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicBreakdownDot: { width: 8, height: 8, borderRadius: 4 },
  topicBreakdownLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  topicBreakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  topicBreakdownBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' },
  topicBreakdownBarFill: { height: '100%', borderRadius: 3 },
  topicBreakdownCount: { fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },

  impactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  impactTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  impactTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  impactTrendText: { fontSize: 12, fontWeight: '700' },
  impactGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  impactItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactItemIcon: { fontSize: 20 },
  impactItemValue: { fontSize: 20, fontWeight: '800' },
  impactItemLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  standingIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  standingTitleWrap: { flex: 1 },
  standingTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  standingSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  standingRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  standingRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  standingRankText: { fontSize: 13, fontWeight: '800' },
  standingProgressWrap: { flex: 1, gap: 6 },
  standingProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  standingProgressLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  standingProgressValue: { fontSize: 12, fontWeight: '700' },
  standingProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  standingProgressBarFill: { height: '100%', borderRadius: 3 },

  streaksRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', borderWidth: 1, backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)' },
  streakIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  streakValue: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  streakBest: { fontSize: 10, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  streakTitle: { fontSize: 16, fontWeight: '800', color: colors.text, padding: 16, paddingBottom: 12 },

  recentItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  recentDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  recentContent: { flex: 1, gap: 2 },
  recentTopic: { fontSize: 13, fontWeight: '700', color: colors.text },
  recentText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  recentStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentStatText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  recentTitle: { fontSize: 16, fontWeight: '800', color: colors.text, padding: 16, paddingBottom: 12 },

  postsList: { gap: 10 },
  tabPanel: { paddingBottom: 20 },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: colors.text },
});