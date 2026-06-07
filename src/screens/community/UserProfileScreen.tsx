import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, CommunityUser, Post } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { showSuccessModal, showErrorModal, showConfirmModal } from '../../utils/modal';
import { SafeAvatar } from '../../components/SafeAvatar';
import { AutoHideFlatList, AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import {
  CommunityColors,
  CommunityGradients,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type UserProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;

const isImageAvatar = (avatar: string): boolean => {
  if (!avatar) return false;
  return avatar.startsWith('file://') || avatar.startsWith('http') || avatar.startsWith('data:image');
};

const ProfileAvatar = ({ avatar, size = 80, style }: { avatar: string; size?: number; style?: any }) => {
  if (isImageAvatar(avatar)) {
    return (
      <Image
        source={{ uri: avatar }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: CommunityColors.primary + '15', justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.5 }}>{avatar || '👤'}</Text>
    </View>
  );
};

const StatItem = ({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
  <View style={styles.statItem}>
    <Ionicons name={icon as any} size={18} color={CommunityColors.primary} />
    <Text style={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const AchievementBadge = ({ achievement }: { achievement: string }) => {
  const achievements: Record<string, { emoji: string; name: string; color: string }> = {
    first_post: { emoji: '📝', name: 'First Steps', color: '#667eea' },
    helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#11998e' },
    top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#fa709a' },
    streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d' },
    streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb' },
    rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fee140' },
    storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb' },
    social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b' },
  };

  const badge = achievements[achievement] || { emoji: '🏅', name: achievement, color: CommunityColors.primary };

  return (
    <View style={[styles.achievementBadge, { backgroundColor: badge.color + '15' }]}>
      <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
    </View>
  );
};

export default function UserProfileScreen({ navigation, route }: UserProfileScreenProps) {
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
    likePost,
    unlikePost,
    bookmarkPost,
    deletePost,
    getFollowers,
    getFollowing,
  } = useCommunity();
  const { profile } = useUser();
  const { triggerHaptic } = useCustomization();

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');

  const isOwnProfile = userId === currentUser?.id;
  const following = isFollowing(userId);
  const blocked = isUserBlocked(userId);

  const loadUserData = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const targetUser = getUserById(userId);
      if (targetUser) {
        setUser(targetUser);
        const posts = getUserPosts(userId);
        setUserPosts(posts);

        try {
          const followers = await getFollowers(userId);
          const following = await getFollowing(userId);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        } catch (e) {
          console.log('Could not load follower counts:', e);
          setFollowerCount(targetUser.stats?.followers || 0);
          setFollowingCount(targetUser.stats?.following || 0);
        }
      } else {
        showErrorModal({ message: 'User not found' });
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      showErrorModal({ message: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  }, [userId, getUserById, getUserPosts, getFollowers, getFollowing, navigation]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile) return;

    triggerHaptic('medium');
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      } else {
        await followUser(userId);
        setFollowerCount((prev) => prev + 1);
      }
    } catch (error) {
      showErrorModal({ message: 'Failed to update follow status' });
    }
  };

  const handleBlock = async () => {
    await blockUser(userId);
    if (!blocked) {
      navigation.goBack();
    }
  };

  const handleMoreOptions = () => {
    Alert.alert(user?.displayName || 'User', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: blocked ? 'Unblock' : 'Block',
        style: 'destructive',
        onPress: handleBlock,
      },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          navigation.navigate('Report', {
            type: 'user',
            targetId: userId,
            targetUserId: userId,
          }),
      },
      {
        text: 'Message',
        onPress: () => navigation.navigate('Chat', { userId }),
      },
    ]);
  };

  const renderPost = ({ item, index }: { item: Post; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.postCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        activeOpacity={0.9}
      >
        <Text style={styles.postTopic}>{item.topic}</Text>
        <Text style={styles.postContent} numberOfLines={3}>
          {item.content}
        </Text>
        {item.images && item.images.length > 0 && (
          <Image source={{ uri: item.images[0] }} style={styles.postThumbnail} resizeMode="cover" />
        )}
        <View style={styles.postStats}>
          <View style={styles.postStat}>
            <Ionicons name="heart" size={14} color={CommunityColors.error} />
            <Text style={styles.postStatText}>{item.likes}</Text>
          </View>
          <View style={styles.postStat}>
            <Ionicons name="chatbubble" size={14} color={CommunityColors.primary} />
            <Text style={styles.postStatText}>{item.commentsCount}</Text>
          </View>
          <View style={styles.postStat}>
            <Ionicons name="repeat" size={14} color={CommunityColors.secondary} />
            <Text style={styles.postStatText}>{item.reposts}</Text>
          </View>
          <Text style={styles.postTime}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>User not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <BlurView intensity={95} style={styles.header} tint="light">
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(255,250,250,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {user.displayName}
        </Text>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>
      </BlurView>

      <AutoHideScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={CommunityGradients.primary}
            style={styles.profileBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View style={styles.profileInfo}>
            <View style={styles.avatarRow}>
              <ProfileAvatar avatar={user.avatar} size={90} style={styles.profileAvatar} />
              {user.onlineStatus === 'online' && (
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              )}
            </View>

            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{user.displayName}</Text>
                {user.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={CommunityColors.primary} />
                )}
              </View>
              <Text style={styles.handle}>{user.handle}</Text>
            </View>

            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

            {user.country && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={CommunityColors.text.tertiary} />
                <Text style={styles.locationText}>{user.country}</Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatItem label="Posts" value={user.stats?.posts || 0} icon="document-text" />
              <View style={styles.statDivider} />
              <StatItem label="Followers" value={followerCount} icon="people" />
              <View style={styles.statDivider} />
              <StatItem label="Following" value={followingCount} icon="person-add" />
              <View style={styles.statDivider} />
              <StatItem label="Helpful" value={user.stats?.helpful || 0} icon="thumbs-up" />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {!isOwnProfile && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      following && styles.followingBtn,
                      blocked && styles.blockedBtn,
                    ]}
                    onPress={handleFollowToggle}
                    disabled={blocked}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        following && styles.followingBtnText,
                        blocked && styles.blockedBtnText,
                      ]}
                    >
                      {blocked ? 'Blocked' : following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.messageBtn]}
                    onPress={() => navigation.navigate('Chat', { userId })}
                  >
                    <Ionicons name="mail" size={16} color={CommunityColors.primary} />
                    <Text style={[styles.actionBtnText, { color: CommunityColors.primary }]}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
              {isOwnProfile && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => navigation.navigate('EditProfile')}
                >
                  <Ionicons name="create-outline" size={16} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Edit Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Achievements */}
        {user.achievements && user.achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {user.achievements.map((achievement) => (
                <AchievementBadge key={achievement} achievement={achievement} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Posts ({userPosts.length})
            </Text>
            {activeTab === 'posts' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
              About
            </Text>
            {activeTab === 'about' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'posts' ? (
          userPosts.length > 0 ? (
            userPosts.map((post, index) => renderPost({ item: post, index }))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={CommunityColors.text.tertiary} />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>
                {isOwnProfile
                  ? 'Share your first post with the community!'
                  : 'This user has not posted anything yet.'}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.aboutSection}>
            <View style={styles.aboutItem}>
              <Ionicons name="time-outline" size={20} color={CommunityColors.primary} />
              <View>
                <Text style={styles.aboutLabel}>Joined</Text>
                <Text style={styles.aboutValue}>Member since 2024</Text>
              </View>
            </View>
            <View style={styles.aboutItem}>
              <Ionicons name="flame-outline" size={20} color={CommunityColors.primary} />
              <View>
                <Text style={styles.aboutLabel}>Streak</Text>
                <Text style={styles.aboutValue}>{user.stats?.streakDays || 0} days</Text>
              </View>
            </View>
            {user.selectedTopics && user.selectedTopics.length > 0 && (
              <View style={styles.aboutItem}>
                <Ionicons name="pricetags-outline" size={20} color={CommunityColors.primary} />
                <View>
                  <Text style={styles.aboutLabel}>Interested in</Text>
                  <View style={styles.topicsRow}>
                    {user.selectedTopics.map((topic) => (
                      <View key={topic} style={styles.topicChip}>
                        <Text style={styles.topicChipText}>{topic}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </AutoHideScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: CommunityColors.text.tertiary,
  },
  goBackText: {
    fontSize: 14,
    color: CommunityColors.primary,
    marginTop: CommunitySpacing.md,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CommunitySpacing.md,
    paddingTop: 50,
    paddingBottom: CommunitySpacing.sm,
    overflow: 'hidden',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: CommunitySpacing.sm,
  },
  profileCard: {
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.xl,
    margin: CommunitySpacing.md,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  profileBanner: {
    height: 100,
    width: '100%',
  },
  profileInfo: {
    padding: CommunitySpacing.md,
    paddingTop: 0,
    alignItems: 'center',
  },
  avatarRow: {
    marginTop: -45,
    position: 'relative',
  },
  profileAvatar: {
    borderWidth: 4,
    borderColor: CommunityColors.background.card,
    ...CommunityShadows.medium,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: CommunityColors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CommunityColors.success,
  },
  nameSection: {
    alignItems: 'center',
    marginTop: CommunitySpacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  handle: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
    marginTop: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.lg,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: CommunitySpacing.xs,
  },
  locationText: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: CommunitySpacing.lg,
    paddingHorizontal: CommunitySpacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: CommunityColors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: CommunitySpacing.sm,
    marginTop: CommunitySpacing.lg,
    width: '100%',
    paddingHorizontal: CommunitySpacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: CommunityColors.primary,
  },
  followingBtn: {
    backgroundColor: CommunityColors.background.elevated,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  blockedBtn: {
    backgroundColor: CommunityColors.error + '15',
    borderColor: CommunityColors.error,
  },
  messageBtn: {
    backgroundColor: CommunityColors.primary + '10',
    borderWidth: 1,
    borderColor: CommunityColors.primary + '30',
  },
  editBtn: {
    backgroundColor: CommunityColors.primary,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  followingBtnText: {
    color: CommunityColors.text.primary,
  },
  blockedBtnText: {
    color: CommunityColors.error,
  },
  section: {
    paddingHorizontal: CommunitySpacing.md,
    marginBottom: CommunitySpacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    marginBottom: CommunitySpacing.sm,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    marginRight: CommunitySpacing.sm,
  },
  achievementEmoji: {
    fontSize: 16,
  },
  achievementName: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: CommunitySpacing.md,
    marginBottom: CommunitySpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: CommunitySpacing.md,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },
  tabTextActive: {
    color: CommunityColors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '30%',
    right: '30%',
    height: 3,
    borderRadius: 2,
    backgroundColor: CommunityColors.primary,
  },
  postCard: {
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.lg,
    padding: CommunitySpacing.md,
    marginHorizontal: CommunitySpacing.md,
    marginBottom: CommunitySpacing.md,
    ...CommunityShadows.small,
  },
  postTopic: {
    fontSize: 12,
    fontWeight: '700',
    color: CommunityColors.primary,
    textTransform: 'uppercase',
    marginBottom: CommunitySpacing.xs,
  },
  postContent: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    lineHeight: 22,
    marginBottom: CommunitySpacing.sm,
  },
  postThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: CommunityBorderRadius.lg,
    marginBottom: CommunitySpacing.sm,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.md,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    fontWeight: '500',
  },
  postTime: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    marginLeft: 'auto',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CommunitySpacing.xxl,
    paddingHorizontal: CommunitySpacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.sm,
    textAlign: 'center',
  },
  aboutSection: {
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.xxl,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.border,
  },
  aboutLabel: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    marginBottom: 2,
  },
  aboutValue: {
    fontSize: 15,
    fontWeight: '600',
    color: CommunityColors.text.primary,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CommunitySpacing.xs,
    marginTop: 4,
  },
  topicChip: {
    backgroundColor: CommunityColors.primary + '10',
    paddingHorizontal: CommunitySpacing.sm,
    paddingVertical: 4,
    borderRadius: CommunityBorderRadius.sm,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.primary,
  },
});