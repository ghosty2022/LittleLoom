import { StyleSheet, Animated ,Button, Dimensions ,Image, ScrollView, Share ,Text ,TouchableOpacity ,useColorScheme ,View } from 'react-native';;
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import { FadeIn, FadeInUp, interpolate, Layout, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { CommunityUser, Post, useCommunity } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { showAlert } from '@/utils/alert';
// src/screens/community/CommunityMemberProfileScreen.tsx


type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

const AnimatedScrollView = Animated.ScrollView;
const { width } = Dimensions.get('window');

// ─── DESIGN TOKENS ───────────────────────────────────────────────────
const THEME = {
  primary: '#667eea',
  primaryDark: '#764ba2',
  secondary: '#fa709a',
  accent: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#667eea', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#11998e', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#fa709a', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fee140', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#fa709a', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#667eea', desc: 'Identity verified' },
};

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#667eea', 'topic_2': '#11998e', 'topic_3': '#fa709a',
  'topic_4': '#fee140', 'topic_5': '#fc5c7d', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#fa709a',
  'topic_10': '#43e97b', 'topic_11': '#fa709a', 'topic_12': '#667eea',
};

// ─── GLASSMORPHISM CARD ──────────────────────────────────────────────
const GlassmorphismCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  delay?: number;
}> = ({ children, style, onPress, intensity = 80, delay = 0 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View entering={FadeInUp.delay(delay)} layout={Layout.springify()} style={[styles.glassCard, style]}>
      <Wrapper onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
};

const StatBadge: React.FC<{ icon: string; value: number | string; label: string; color: string }> = ({
  icon, value, label, color
}) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const AchievementBadge: React.FC<{ achievement: string; isDark: boolean }> = ({ achievement, isDark }) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: '#667eea', desc: '' };
  return (
    <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}15` }]}>
      <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
        <Text style={[styles.achievementDesc, isDark && styles.textMuted]}>{badge.desc}</Text>
      </View>
    </View>
  );
};

const PostCard: React.FC<{ post: Post; index: number; isDark: boolean; onPress: () => void }> = ({ post, index, isDark, onPress }) => {
  const topicColor = TOPIC_COLORS[post.topicId] || '#667eea';
  return (
    <GlassmorphismCard style={styles.postCard} intensity={85} delay={index * 50} onPress={onPress}>
      <View style={styles.postHeader}>
        <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
        <Text style={[styles.topicText, { color: topicColor }]}>{post.topic}</Text>
        <Text style={styles.postTime}>{post.time}</Text>
      </View>
      <Text style={[styles.postContent, isDark && styles.textDark]} numberOfLines={3}>{post.content}</Text>
      {post.images && post.images.length > 0 && (
        <View style={styles.postImageContainer}>
          <Animated.Image
            source={{ uri: post.images[0] }}
            style={styles.postImage}
            resizeMode="cover"
            entering={FadeIn.delay(100)}
          />
        </View>
      )}
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={14} color={post.isLiked ? '#ef4444' : '#94a3b8'} />
          <Text style={[styles.postStatText, { color: post.isLiked ? '#ef4444' : '#94a3b8' }]}>{post.likes}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="chatbubble" size={14} color="#667eea" />
          <Text style={styles.postStatText}>{post.commentsCount}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="repeat" size={14} color="#10b981" />
          <Text style={styles.postStatText}>{post.reposts}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="eye" size={14} color="#94a3b8" />
          <Text style={styles.postStatText}>{post.viewCount}</Text>
        </View>
      </View>
    </GlassmorphismCard>
  );
};

// ─── MAIN SCREEN ─────────────────────────────────────────────────────
export default function CommunityMemberProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const {
    currentUser, getUserById, getUserPosts, followUser, unfollowUser,
    isFollowing, blockUser, isUserBlocked, getFollowers, getFollowing,
    likePost, getPostById,
  } = useCommunity();
  const { profile } = useUser();
  const { themeColors, shouldReduceMotion, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  // ─── State ──────────────────────────────────────────────────────────
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'achievements'>('posts');
  const [refreshing, setRefreshing] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  // Animated header
  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP) }],
  }));

  const bannerGradient = useMemo(() => {
    if (!user) return ['#667eea', '#764ba2'] as [string, string];
    const colors = user.selectedTopics?.map(t => TOPIC_COLORS[t] || '#667eea') || ['#667eea'];
    return [colors[0] || '#667eea', colors[1] || '#764ba2'] as [string, string];
  }, [user]);

  // ─── Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    loadUserData();
  }, [userId]);

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
      console.error('Error loading user:', error);
      sweetAlert.error('Error', 'Failed to load profile');
    }
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  // ─── Handlers ───────────────────────────────────────────────────────
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
      sweetAlert.error('Error', 'Failed to update follow status');
    }
  };

  const handleMessage = () => {
    if (!user || isBlocked) return;
    triggerHaptic('light');
    navigation.navigate('Chat', { userId });
  };

  const handleMoreOptions = () => {
    if (!user) return;
    const options = [
      { text: 'Cancel', style: 'cancel' as const },
      { text: 'Share Profile', onPress: handleShareProfile },
      { text: 'Report User', onPress: () => navigation.navigate('Report', { type: 'user', targetId: userId, targetUserId: userId }), style: 'destructive' as const },
      { text: isBlocked ? 'Unblock' : 'Block', onPress: handleBlockToggle, style: 'destructive' as const },
    ];

showAlert(user.displayName || 'User', '', options);
  };

  const handleShareProfile = async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`,
        title: `${user.displayName}'s Profile`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleBlockToggle = async () => {
    if (!user) return;
    await blockUser(userId);
    setIsBlocked(!isBlocked);
    if (!isBlocked) {
      sweetAlert.alert('Blocked', `${user.displayName} has been blocked`, 'warning');
      setIsFollowingUser(false);
    } else {
      sweetAlert.success('Unblocked', `${user.displayName} has been unblocked`);
    }
  };

  const handleLikePost = async (postId: string) => {
    triggerHaptic('light');
    await likePost(postId);
    // Refresh posts to show updated like state
    const posts = getUserPosts(userId);
    setUserPosts(posts);
  };

  // ─── Scroll Handler ─────────────────────────────────────────────────
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  // ─── RENDER SECTIONS ────────────────────────────────────────────────

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeAvatar avatar={user?.avatar} size={32} fallbackIcon="person" fallbackColor={themeColors.primary} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>
            {user?.displayName || 'Member Profile'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!user) return null;
    const isOnline = user.onlineStatus === 'online';

    return (
      <Animated.View entering={FadeInUp} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        {/* Banner */}
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
              {isOnline && (
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, isDark && styles.textDark]}>{user.displayName}</Text>
              {user.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.profileHandle}>{user.handle}</Text>
            {user.bio && <Text style={[styles.profileBio, isDark && styles.textMuted]} numberOfLines={2}>{user.bio}</Text>}
            {user.country && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#94a3b8" />
                <Text style={styles.locationText}>{user.country}</Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBadge icon="📝" value={userPosts.length} label="Posts" color="#667eea" />
              <StatBadge icon="👥" value={followerCount} label="Followers" color="#fa709a" />
              <StatBadge icon="👤" value={followingCount} label="Following" color="#3b82f6" />
              <StatBadge icon="💙" value={user.stats?.helpful || 0} label="Helpful" color="#10b981" />
            </View>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    isFollowingUser && styles.followingBtn,
                    isBlocked && styles.blockedBtn,
                  ]}
                  onPress={handleFollowToggle}
                  disabled={isBlocked}
                >
                  <Text style={[
                    styles.followBtnText,
                    isFollowingUser && styles.followingBtnText,
                    isBlocked && styles.blockedBtnText,
                  ]}>
                    {isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.messageBtn, isBlocked && styles.messageBtnDisabled]}
                  onPress={handleMessage}
                  disabled={isBlocked}
                >
                  <Ionicons name="mail-outline" size={16} color={isBlocked ? '#94a3b8' : '#667eea'} />
                  <Text style={[styles.messageBtnText, isBlocked && { color: '#94a3b8' }]}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'posts', icon: 'document-text-outline', label: 'Posts' },
          { id: 'about', icon: 'information-circle-outline', label: 'About' },
          { id: 'achievements', icon: 'trophy-outline', label: 'Badges' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.id as typeof activeTab); }}
            >
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons name={tab.icon as any} size={18} color={isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b')} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, isDark && !isActive && styles.textMuted]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Threads</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{userPosts.length} posts</Text>
        </View>
      </View>

      {userPosts.length === 0 ? (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color="#667eea" />
          </View>
          <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No threads yet</Text>
          <Text style={styles.emptyText}>This parent hasn't shared any stories yet.</Text>
        </GlassmorphismCard>
      ) : (
        <View style={styles.postsList}>
          {userPosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              isDark={isDark}
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderAboutTab = () => {
    if (!user) return null;
    return (
      <Animated.View entering={FadeInUp} style={styles.tabPanel}>
        <GlassmorphismCard style={styles.formCard} intensity={90} delay={100}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>About</Text>

          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: `${themeColors.primary}20` }]}>
              <Ionicons name="time-outline" size={20} color={themeColors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Member Since</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>2024</Text>
            </View>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="flame-outline" size={20} color="#f59e0b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Active Streak</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.streakDays || 0} days</Text>
            </View>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="heart-outline" size={20} color="#10b981" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Total Likes Received</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.totalLikes || 0}</Text>
            </View>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#8b5cf620' }]}>
              <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Total Comments</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.totalComments || 0}</Text>
            </View>
          </View>
        </GlassmorphismCard>

        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassmorphismCard style={styles.formCard} intensity={85} delay={200}>
            <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Interested In</Text>
            <View style={styles.topicsWrap}>
              {user.selectedTopics.map((topicId) => (
                <View key={topicId} style={[styles.topicChip, { backgroundColor: `${TOPIC_COLORS[topicId] || '#667eea'}20` }]}>
                  <Text style={[styles.topicChipText, { color: TOPIC_COLORS[topicId] || '#667eea' }]}>
                    {topicId.replace('topic_', 'Topic ')}
                  </Text>
                </View>
              ))}
            </View>
          </GlassmorphismCard>
        )}
      </Animated.View>
    );
  };

  const renderAchievementsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{user?.achievements?.length || 0} earned</Text>
        </View>
      </View>

      <GlassmorphismCard style={styles.achievementsCard} intensity={90} delay={100}>
        {user?.achievements && user.achievements.length > 0 ? (
          user.achievements.map((achievement) => (
            <AchievementBadge key={achievement} achievement={achievement} isDark={isDark} />
          ))
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color="#667eea" />
            <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No achievements yet</Text>
            <Text style={styles.emptyText}>This parent is just getting started!</Text>
          </View>
        )}
      </GlassmorphismCard>
    </Animated.View>
  );

  // ─── Main Render ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <Ionicons name="person-outline" size={64} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />
      {renderStickyHeader()}
      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        {renderTabs()}
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'about' && renderAboutTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
        </View>
      </AnimatedScrollView>
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // Sticky Header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, maxWidth: 180 },

  // Profile Hero with Banner
  profileHero: { paddingHorizontal: 20, paddingBottom: 20 },
  banner: { height: 120, borderRadius: 20, marginBottom: -50, marginHorizontal: -20, marginTop: -20 },
  profileHeroContent: { position: 'relative', zIndex: 2 },
  avatarSection: { alignItems: 'center', marginBottom: 12 },
  avatarWrapper: { position: 'relative' },
  onlineIndicator: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  profileInfo: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  profileHandle: { fontSize: 14, color: '#64748b', marginTop: 4, fontWeight: '600' },
  profileBio: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 16, paddingHorizontal: 8 },
  statBadge: { alignItems: 'center', gap: 6 },
  statIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Action Buttons
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%', paddingHorizontal: 20 },
  followBtn: { flex: 1, backgroundColor: '#667eea', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  blockedBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  followBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: '#64748b' },
  blockedBtnText: { color: '#ef4444' },
  messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(102,126,234,0.1)', borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(102,126,234,0.2)' },
  messageBtnDisabled: { opacity: 0.5 },
  messageBtnText: { fontSize: 15, fontWeight: '700', color: '#667eea' },

  // Tab Bar
  tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)' },
  tab: { flex: 1 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },

  // GlassCard
  glassCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
  glassContent: { flex: 1 },

  // Posts
  tabPanel: { paddingBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  postsList: { gap: 10 },
  postCard: { padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  topicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  postTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  postContent: { fontSize: 15, fontWeight: '600', color: '#1e293b', lineHeight: 22, marginBottom: 12 },
  postImageContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  postImage: { width: '100%', height: 180, borderRadius: 16 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

  // Empty State
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  // About Tab
  formCard: { padding: 0, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2, color: '#64748b' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  infoDivider: { height: 1, marginHorizontal: 20 },

  // Topics
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },

  // Achievements
  achievementsCard: { padding: 20, gap: 12 },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16 },
  achievementEmoji: { fontSize: 28 },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 16, fontWeight: '700' },
  achievementDesc: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },

  // Retry
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
