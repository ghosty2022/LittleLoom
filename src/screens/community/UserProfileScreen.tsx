import { useSweetAlert } from '../../components/SweetAlert';
import React, { useCallback, useEffect, useState } from 'react';
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
  Share,
  ActivityIndicator,
  Platform, // ← Add this
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, CommunityUser, Post } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;


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
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '600' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 16, line: 24, weight: '600' as const },
    xl: { size: 18, line: 26, weight: '700' as const },
    '2xl': { size: 22, line: 30, weight: '800' as const },
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#667eea', desc: 'Shared your first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#11998e', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#fa709a', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fee140', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#fa709a', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: LL.primary, desc: 'Identity verified' },
};


const AchievementBadge = React.memo(({ achievement }: { achievement: string }) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: LL.primary, desc: '' };
  return (
    <View style={[styles.achievementBadge, { backgroundColor: badge.color + '15' }]}>
      <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
    </View>
  );
});


const StatItem = React.memo(({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
  <View style={styles.statItem}>
    <View style={[styles.statIconWrap, { backgroundColor: `${LL.primary}15` }]}>
      <Ionicons name={icon as any} size={16} color={LL.primary} />
    </View>
    <Text style={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));


const PostMiniCard = React.memo(({ post, index, onPress }: { post: Post; index: number; onPress: () => void }) => (
  <Animated.View entering={FadeInUp.delay(index * 60).duration(400)}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.postMiniCard, { backgroundColor: LL.white, borderColor: LL.gray200 }]}>
      <View style={styles.postMiniHeader}>
        <View style={[styles.postMiniTopicDot, { backgroundColor: LL.primary }]} />
        <Text style={[styles.postMiniTopic, { color: LL.primary }]}>{post.topic}</Text>
        <Text style={[styles.postMiniTime, { color: LL.gray400 }]}>{post.time}</Text>
      </View>
      <Text style={[styles.postMiniContent, { color: LL.gray700 }]} numberOfLines={2}>
        {post.content}
      </Text>
      {post.images && post.images.length > 0 && (
        <Image source={{ uri: post.images[0] }} style={styles.postMiniThumb} resizeMode="cover" />
      )}
      <View style={styles.postMiniStats}>
        <View style={styles.postMiniStat}>
          <Ionicons name="heart" size={13} color={LL.accent} />
          <Text style={[styles.postMiniStatText, { color: LL.gray500 }]}>{post.likes}</Text>
        </View>
        <View style={styles.postMiniStat}>
          <Ionicons name="chatbubble" size={13} color={LL.primary} />
          <Text style={[styles.postMiniStatText, { color: LL.gray500 }]}>{post.commentsCount}</Text>
        </View>
        <View style={styles.postMiniStat}>
          <Ionicons name="repeat" size={13} color={LL.success} />
          <Text style={[styles.postMiniStatText, { color: LL.gray500 }]}>{post.reposts}</Text>
        </View>
      </View>
    </TouchableOpacity>
  </Animated.View>
));


export default function UserFamilyCenterScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const sweetAlert = useSweetAlert();
  const {
    currentUser, getUserById, getUserPosts, followUser, unfollowUser, isFollowing,
    blockUser, isUserBlocked, getFollowers, getFollowing,
  } = useCommunity();
  const { profile } = useUser();
  const { triggerHaptic } = useCustomization();

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'achievements'>('posts');
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const isOwnProfile = userId === currentUser?.id;

  const loadUserData = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const targetUser = getUserById(userId);
      if (targetUser) {
        setUser(targetUser);
        const posts = getUserPosts(userId);
        setUserPosts(posts);
        setFollowing(isFollowing(userId));
        setBlocked(isUserBlocked(userId));

        try {
          const followers = await getFollowers(userId);
          const followingList = await getFollowing(userId);
          setFollowerCount(followers.length);
          setFollowingCount(followingList.length);
        } catch (e) {
          console.log('Could not load follower counts:', e);
          setFollowerCount(targetUser.stats?.followers || 0);
          setFollowingCount(targetUser.stats?.following || 0);
        }
      } else {
        sweetAlert.alert('Not Found', 'User not found', 'warning');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      sweetAlert.alert('Error', 'Failed to load profile', 'warning');
    } finally {
      setLoading(false);
    }
  }, [userId, getUserById, getUserPosts, getFollowers, getFollowing, isFollowing, isUserBlocked, navigation]);

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
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowerCount((prev) => prev + 1);
        setFollowing(true);
      }
    } catch (error) {
      sweetAlert.alert('Error', 'Failed to update follow status', 'warning');
    }
  };

  const handleBlock = async () => {
    await blockUser(userId);
    setBlocked(!blocked);
    if (!blocked) navigation.goBack();
  };

  const handleMoreOptions = () => {
    if (!user) return;
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (!isOwnProfile) {
      options.push({ text: 'Message', onPress: () => navigation.navigate('Chat', { userId }) });
      options.push({ text: 'Share Profile', onPress: () => Share.share({ message: `Check out ${user.displayName} on LittleLoom!` }) });
    }
    options.push({ text: blocked ? 'Unblock' : 'Block', style: 'destructive', onPress: handleBlock });
    options.push({ text: 'Report', style: 'destructive', onPress: () => navigation.navigate('Report', { type: 'user', targetId: userId, targetUserId: userId }) });
    Alert.alert(user.displayName || 'User', '', options);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: LL.gray50 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LL.primary} />
          <Text style={[styles.loadingText, { color: LL.gray500 }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: LL.gray50 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <Ionicons name="person-outline" size={48} color={LL.gray300} />
          <Text style={[styles.loadingText, { color: LL.gray500 }]}>User not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
            <Text style={[styles.goBackText, { color: LL.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: LL.gray50 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: LL.white, borderBottomColor: LL.gray200 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={LL.gray800} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: LL.gray900 }]} numberOfLines={1}>
          {user.displayName}
        </Text>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={LL.gray800} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LL.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <View style={[styles.profileCard, { backgroundColor: LL.white, borderColor: LL.gray200 }]}>
            {/* Banner */}
            <LinearGradient
              colors={['#667eea', '#764ba2', '#f093fb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileBanner}
            />

            <View style={styles.profileInfo}>
              {/* Avatar */}
              <View style={styles.avatarRow}>
                <SafeAvatar
                  avatar={user.avatar}
                  size={90}
                  fallbackIcon="person"
                  fallbackColor={LL.primary}
                  fallbackBgColor={`${LL.primary}15`}
                  borderWidth={4}
                  borderColor={LL.white}
                />
                {user.onlineStatus === 'online' && (
                  <View style={[styles.onlineIndicator, { borderColor: LL.white }]}>
                    <View style={[styles.onlineDot, { backgroundColor: LL.success }]} />
                  </View>
                )}
              </View>

              {/* Name */}
              <View style={styles.nameSection}>
                <View style={styles.nameRow}>
                  <Text style={[styles.displayName, { color: LL.gray800 }]}>{user.displayName}</Text>
                  {user.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: LL.primary }]}>
                      <Ionicons name="checkmark" size={12} color={LL.white} />
                    </View>
                  )}
                </View>
                <Text style={[styles.handle, { color: LL.gray500 }]}>{user.handle}</Text>
              </View>

              {/* Bio */}
              {user.bio && (
                <Text style={[styles.bio, { color: LL.gray600 }]}>{user.bio}</Text>
              )}

              {/* Location */}
              {user.country && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={LL.gray400} />
                  <Text style={[styles.locationText, { color: LL.gray500 }]}>{user.country}</Text>
                </View>
              )}

              {/* Stats */}
              <View style={styles.statsRow}>
                <StatItem label="Posts" value={userPosts.length} icon="document-text-outline" />
                <View style={[styles.statDivider, { backgroundColor: LL.gray200 }]} />
                <StatItem label="Followers" value={followerCount} icon="people-outline" />
                <View style={[styles.statDivider, { backgroundColor: LL.gray200 }]} />
                <StatItem label="Following" value={followingCount} icon="person-add-outline" />
                <View style={[styles.statDivider, { backgroundColor: LL.gray200 }]} />
                <StatItem label="Helpful" value={user.stats?.helpful || 0} icon="thumbs-up-outline" />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {!isOwnProfile ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, following && styles.followingBtn, blocked && styles.blockedBtn]}
                      onPress={handleFollowToggle}
                      disabled={blocked}
                    >
                      <Text style={[styles.actionBtnText, following && styles.followingBtnText, blocked && styles.blockedBtnText]}>
                        {blocked ? 'Blocked' : following ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.messageBtn]}
                      onPress={() => navigation.navigate('Chat', { userId })}
                    >
                      <Ionicons name="mail-outline" size={16} color={LL.primary} />
                      <Text style={[styles.actionBtnText, { color: LL.primary }]}>Message</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editProfileBtn]}
                    onPress={() => navigation.navigate('EditCommunityProfile')}
                  >
                    <Ionicons name="create-outline" size={16} color={LL.white} />
                    <Text style={[styles.actionBtnText, { color: LL.white }]}>Edit Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { borderBottomColor: LL.gray200 }]}>
          {(['posts', 'about', 'achievements'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.tabText, { color: LL.gray500 }, activeTab === tab && { color: LL.primary, fontWeight: '800' }]}>
                {tab === 'posts' ? `Posts (${userPosts.length})` : tab === 'about' ? 'About' : 'Achievements'}
              </Text>
              {activeTab === tab && <View style={[styles.tabIndicator, { backgroundColor: LL.primary }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'posts' && (
            userPosts.length > 0 ? (
              userPosts.map((post, index) => (
                <PostMiniCard
                  key={post.id}
                  post={post}
                  index={index}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient colors={[`${LL.primary}15`, `${LL.primaryDark}15`]} style={styles.emptyIconBg}>
                  <Ionicons name="document-text-outline" size={40} color={LL.primary} />
                </LinearGradient>
                <Text style={[styles.emptyTitle, { color: LL.gray600 }]}>
                  {isOwnProfile ? 'No threads yet' : 'No threads yet'}
                </Text>
                <Text style={[styles.emptyText, { color: LL.gray400 }]}>
                  {isOwnProfile ? 'Weave your first story into the community!' : 'This parent has not shared any threads yet.'}
                </Text>
                {isOwnProfile && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreatePost')}>
                    <LinearGradient colors={[LL.primary, LL.primaryDark]} style={styles.emptyBtnGrad}>
                      <Text style={styles.emptyBtnText}>Start a Thread</Text>
                      <Ionicons name="arrow-forward" size={14} color={LL.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )
          )}

          {activeTab === 'about' && (
            <Animated.View entering={FadeInUp.duration(300)} style={[styles.aboutCard, { backgroundColor: LL.white, borderColor: LL.gray200 }]}>
              <AboutItem icon="time-outline" label="Joined" value="Member since 2024" />
              <AboutItem icon="flame-outline" label="Streak" value={`${user.stats?.streakDays || 0} days active`} />
              <AboutItem icon="heart-outline" label="Total Likes Received" value={`${user.stats?.totalLikes || 0}`} />
              <AboutItem icon="chatbubble-outline" label="Total Comments" value={`${user.stats?.totalComments || 0}`} />
              {user.selectedTopics && user.selectedTopics.length > 0 && (
                <View style={styles.aboutTopicsRow}>
                  <Ionicons name="pricetags-outline" size={18} color={LL.primary} style={{ marginRight: LL.space.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.aboutLabel, { color: LL.gray500 }]}>Interested in</Text>
                    <View style={styles.topicsWrap}>
                      {user.selectedTopics.map((topic) => (
                        <View key={topic} style={[styles.topicChip, { backgroundColor: `${LL.primary}10` }]}>
                          <Text style={[styles.topicChipText, { color: LL.primary }]}>{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {activeTab === 'achievements' && (
            <View style={styles.achievementsGrid}>
              {user.achievements && user.achievements.length > 0 ? (
                user.achievements.map((achievement) => (
                  <AchievementBadge key={achievement} achievement={achievement} />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <LinearGradient colors={[`${LL.warning}15`, `${LL.warning}10`]} style={styles.emptyIconBg}>
                    <Ionicons name="trophy-outline" size={40} color={LL.warning} />
                  </LinearGradient>
                  <Text style={[styles.emptyTitle, { color: LL.gray600 }]}>No achievements yet</Text>
                  <Text style={[styles.emptyText, { color: LL.gray400 }]}>
                    Keep weaving threads and connecting with parents to earn badges!
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}


const AboutItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.aboutItem}>
    <View style={[styles.aboutIconWrap, { backgroundColor: `${LL.primary}10` }]}>
      <Ionicons name={icon as any} size={18} color={LL.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.aboutLabel, { color: LL.gray500 }]}>{label}</Text>
      <Text style={[styles.aboutValue, { color: LL.gray800 }]}>{value}</Text>
    </View>
  </View>
);


const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: LL.space.lg,
  },
  loadingText: {
    fontSize: LL.text.base.size,
    fontWeight: '600',
  },
  goBackBtn: {
    marginTop: LL.space.md,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.full,
    backgroundColor: `${LL.primary}15`,
  },
  goBackText: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LL.space.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 12,
    paddingBottom: LL.space.md,
    borderBottomWidth: 1,
    zIndex: 100,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LL.radius.full,
  },
  headerTitle: {
    fontSize: LL.text.lg.size,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: LL.space.sm,
  },

  scrollContent: {
    paddingBottom: LL.space['4xl'],
  },

  profileCard: {
    margin: LL.space.lg,
    borderRadius: LL.radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    ...LL.shadow.md,
  },
  profileBanner: {
    height: 100,
    width: '100%',
  },
  profileInfo: {
    padding: LL.space.lg,
    paddingTop: 0,
    alignItems: 'center',
  },
  avatarRow: {
    marginTop: -45,
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LL.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  nameSection: {
    alignItems: 'center',
    marginTop: LL.space.md,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
  },
  displayName: {
    fontSize: LL.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
    marginTop: 2,
  },
  bio: {
    fontSize: LL.text.base.size,
    textAlign: 'center',
    marginTop: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
    marginTop: LL.space.xs,
  },
  locationText: {
    fontSize: LL.text.sm.size,
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: LL.space.xl,
    paddingHorizontal: LL.space.md,
  },
  statItem: {
    alignItems: 'center',
    gap: LL.space.xs,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: LL.text.xl.size,
    fontWeight: '800',
    color: LL.gray800,
  },
  statLabel: {
    fontSize: LL.text.xs.size,
    fontWeight: '600',
    color: LL.gray500,
  },
  statDivider: {
    width: 1,
    height: 40,
    alignSelf: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    gap: LL.space.md,
    marginTop: LL.space.xl,
    width: '100%',
    paddingHorizontal: LL.space.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LL.space.sm,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.full,
    backgroundColor: LL.primary,
    ...LL.shadow.sm,
  },
  followingBtn: {
    backgroundColor: LL.gray100,
    borderWidth: 1,
    borderColor: LL.gray200,
  },
  blockedBtn: {
    backgroundColor: `${LL.accent}15`,
    borderColor: LL.accent,
  },
  messageBtn: {
    backgroundColor: `${LL.primary}10`,
    borderWidth: 1,
    borderColor: `${LL.primary}30`,
  },
  editProfileBtn: {
    backgroundColor: LL.primary,
  },
  actionBtnText: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
    color: LL.white,
  },
  followingBtnText: {
    color: LL.gray700,
  },
  blockedBtnText: {
    color: LL.accent,
  },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: LL.space.lg,
    marginTop: LL.space.md,
    marginBottom: LL.space.sm,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: LL.space.md,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 3,
    borderRadius: 2,
  },
  tabContent: {
    paddingHorizontal: LL.space.lg,
    paddingTop: LL.space.md,
  },

  postMiniCard: {
    borderRadius: LL.radius['2xl'],
    borderWidth: 1,
    padding: LL.space.lg,
    marginBottom: LL.space.lg,
    ...LL.shadow.sm,
  },
  postMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    marginBottom: LL.space.sm,
  },
  postMiniTopicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  postMiniTopic: {
    fontSize: LL.text.xs.size,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  postMiniTime: {
    fontSize: LL.text.xs.size,
    fontWeight: '500',
  },
  postMiniContent: {
    fontSize: LL.text.base.size,
    lineHeight: 22,
    marginBottom: LL.space.sm,
  },
  postMiniThumb: {
    width: '100%',
    height: 160,
    borderRadius: LL.radius.lg,
    marginBottom: LL.space.md,
  },
  postMiniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.lg,
  },
  postMiniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
  },
  postMiniStatText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },

  aboutCard: {
    borderRadius: LL.radius['2xl'],
    borderWidth: 1,
    padding: LL.space.lg,
    gap: LL.space.md,
    ...LL.shadow.sm,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
    borderBottomColor: LL.gray200,
  },
  aboutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: LL.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: LL.text.xs.size,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  aboutValue: {
    fontSize: LL.text.base.size,
    fontWeight: '600',
  },
  aboutTopicsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: LL.space.md,
  },
  topicsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LL.space.xs,
    marginTop: LL.space.xs,
  },
  topicChip: {
    paddingHorizontal: LL.space.md,
    paddingVertical: 4,
    borderRadius: LL.radius.full,
  },
  topicChipText: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },

  achievementsGrid: {
    gap: LL.space.md,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.lg,
  },
  achievementEmoji: {
    fontSize: 24,
  },
  achievementName: {
    fontSize: LL.text.base.size,
    fontWeight: '700',
    flex: 1,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: LL.space['2xl'],
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: LL.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LL.space.lg,
  },
  emptyTitle: {
    fontSize: LL.text.xl.size,
    fontWeight: '800',
    marginBottom: LL.space.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: LL.text.base.size,
    textAlign: 'center',
    marginBottom: LL.space.xl,
    lineHeight: 22,
  },
  emptyBtn: {
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
  },
  emptyBtnText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },
});
