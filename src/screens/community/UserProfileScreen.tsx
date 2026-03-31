// src/screens/community/UserProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, CommunityUser } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showSuccessModal, showErrorModal } from '../../utils/modal';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type UserProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;

const { width } = Dimensions.get('window');

const BADGES = [
  { emoji: '🏆', name: 'Top Contributor', color: CommunityColors.accent, description: '100+ helpful posts' },
  { emoji: '💙', name: 'Helpful Parent', color: CommunityColors.primary, description: '50+ likes received' },
  { emoji: '🔥', name: '30 Day Streak', color: CommunityColors.error, description: 'Active for 30 days' },
  { emoji: '⭐', name: 'Rising Star', color: CommunityColors.info, description: 'Gained 1000 followers' },
  { emoji: '📝', name: 'Storyteller', color: CommunityColors.secondary, description: '50+ posts shared' },
];

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export default function UserProfileScreen({ navigation, route }: UserProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'media'>('posts');

  const { userId } = route.params;
  const { 
    currentUser, 
    getUserById, 
    getUserPosts, 
    followUser, 
    unfollowUser, 
    isFollowing,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
  } = useCommunity();
  const { profile: currentUserProfile } = useUser();

  const isOwnProfile = userId === currentUser?.id;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = getUserById(userId);
    const posts = getUserPosts(userId);
    
    if (user) {
      setProfile(user);
      setUserPosts(posts);
    }
    
    setLoading(false);
  }, [userId, getUserById, getUserPosts]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!profile) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isFollowing(profile.id)) {
      await unfollowUser(profile.id);
    } else {
      await followUser(profile.id);
    }
    
    loadProfile();
  };

  const handleMessage = () => {
    if (!profile) return;
    navigation.navigate('Chat', { userId: profile.id });
  };

  const handleReport = () => {
    navigation.navigate('Report', { 
      type: 'user', 
      targetId: userId, 
      targetUserId: userId 
    });
  };

  const handleEditProfile = () => {
    navigation.navigate('EditCommunityProfile', { userId });
  };

  const handlePostLike = async (post: Post) => {
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
    loadProfile();
  };

  const handlePostRepost = async (post: Post) => {
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
    loadProfile();
  };

  const navigateToPostDetail = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const navigateToFollowers = () => {
    navigation.navigate('Followers', { userId });
  };

  const navigateToFollowing = () => {
    navigation.navigate('Following', { userId });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.darkBg]}>
        <ActivityIndicator size="large" color={CommunityColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.darkBg]}>
        <Text style={[styles.errorText, isDark && styles.textLight]}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const followingStatus = isFollowing(profile.id);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Animated Header */}
      <Animated.View style={[styles.floatingHeader, headerAnimatedStyle]}>
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.headerBlur}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <TouchableOpacity onPress={isOwnProfile ? handleEditProfile : handleReport} style={styles.headerButton}>
            <Ionicons 
              name={isOwnProfile ? "create-outline" : "ellipsis-horizontal"} 
              size={24} 
              color={isDark ? '#fff' : CommunityColors.text.primary} 
            />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            {!isOwnProfile && (
              <TouchableOpacity onPress={handleReport} style={styles.headerBtn}>
                <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : CommunityColors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.delay(100)}>
          <BlurView 
            intensity={isDark ? 40 : 90} 
            style={styles.profileCard} 
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatar}>{profile.avatar}</Text>
                {profile.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                )}
              </View>
              
              <View style={[styles.userTypeBadge, { backgroundColor: CommunityColors.primary + '20' }]}>
                <Ionicons name="people" size={12} color={CommunityColors.primary} />
                <Text style={[styles.userTypeText, { color: CommunityColors.primary }]}>Parent</Text>
              </View>
            </View>
            
            <View style={styles.nameRow}>
              <Text style={[styles.name, isDark && styles.textLight]}>{profile.displayName}</Text>
              {isOwnProfile && (
                <View style={[styles.relationshipBadge, { backgroundColor: CommunityColors.primary + '20' }]}>
                  <Text style={[styles.relationshipText, { color: CommunityColors.primary }]}>You</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.handle}>{profile.handle}</Text>
            <Text style={[styles.bio, isDark && styles.textMuted]}>{profile.bio || 'No bio yet'}</Text>
            
            {profile.country && profile.country !== 'Unknown' && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                <Text style={[styles.location, isDark && styles.textMuted]}>{profile.country}</Text>
              </View>
            )}

            {/* Action Buttons */}
            {!isOwnProfile ? (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.followButton, followingStatus && styles.followingButton]}
                  onPress={handleFollow}
                >
                  <Text style={[styles.followText, followingStatus && styles.followingText]}>
                    {followingStatus ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                  <Ionicons name="mail-outline" size={20} color={CommunityColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="chevron-down" size={20} color={CommunityColors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile}>
                <Ionicons name="create-outline" size={18} color={CommunityColors.primary} />
                <Text style={styles.editProfileText}>Edit Community Profile</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.posts)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Posts</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.followers)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Followers</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowing}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.following)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Following</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.helpful)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Helpful</Text>
          </View>
        </Animated.View>

        {/* Badges */}
        <Animated.View entering={FadeInUp.delay(300)}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Achievements</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {profile.achievements?.map((achievementId, index) => {
              const badge = BADGES.find(b => b.name.toLowerCase().replace(/\s+/g, '_') === achievementId) || BADGES[index % BADGES.length];
              return (
                <TouchableOpacity key={achievementId} style={styles.badgeCard}>
                  <View style={[styles.badgeIcon, { backgroundColor: badge.color + '30' }]}>
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  </View>
                  <Text style={[styles.badgeName, isDark && styles.textLight]} numberOfLines={1}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeDescription} numberOfLines={1}>
                    {badge.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(!profile.achievements || profile.achievements.length === 0) && (
              <Text style={[styles.noAchievements, isDark && styles.textMuted]}>
                No achievements yet. Start engaging to earn badges!
              </Text>
            )}
          </ScrollView>
        </Animated.View>

        {/* Content Tabs */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.tabContainer}>
          {(['posts', 'about', 'media'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText, 
                activeTab === tab && styles.tabTextActive, 
                isDark && styles.textLight
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          <View style={styles.postsContainer}>
            {userPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.tertiary} />
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>No posts yet</Text>
              </View>
            ) : (
              userPosts.map((post, index) => (
                <Animated.View key={post.id} entering={FadeInUp.delay(500 + index * 100)}>
                  <TouchableOpacity 
                    onPress={() => navigateToPostDetail(post.id)}
                    activeOpacity={0.9}
                  >
                    <BlurView 
                      intensity={isDark ? 40 : 80} 
                      style={styles.postCard} 
                      tint={isDark ? 'dark' : 'light'}
                    >
                      <View style={styles.postHeader}>
                        <Text style={styles.postTopic}>{post.topic}</Text>
                        <Text style={[styles.postTime, isDark && styles.textMuted]}>{post.time}</Text>
                      </View>
                      <Text style={[styles.postContent, isDark && styles.textLight]} numberOfLines={3}>
                        {post.content}
                      </Text>
                      <View style={styles.postStats}>
                        <TouchableOpacity 
                          style={styles.postStat}
                          onPress={() => handlePostLike(post)}
                        >
                          <Ionicons 
                            name={post.isLiked ? "heart" : "heart-outline"} 
                            size={18} 
                            color={post.isLiked ? CommunityColors.error : (isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary)} 
                          />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.likes}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.commentsCount}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.postStat}
                          onPress={() => handlePostRepost(post)}
                        >
                          <Ionicons 
                            name={post.isReposted ? "repeat" : "repeat-outline"} 
                            size={18} 
                            color={post.isReposted ? CommunityColors.secondary : (isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary)} 
                          />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.reposts}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {activeTab === 'about' && (
          <Animated.View entering={FadeInUp.delay(500)} style={styles.aboutContainer}>
            <BlurView 
              intensity={isDark ? 40 : 80} 
              style={styles.aboutCard} 
              tint={isDark ? 'dark' : 'light'}
            >
              <Text style={[styles.aboutTitle, isDark && styles.textLight]}>About</Text>
              
              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Bio</Text>
                <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                  {profile.bio || 'No bio yet'}
                </Text>
              </View>

              {profile.country && profile.country !== 'Unknown' && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Location</Text>
                  <View style={styles.aboutValueRow}>
                    <Ionicons name="location-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                    <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                      {profile.country}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Joined</Text>
                <View style={styles.aboutValueRow}>
                  <Ionicons name="calendar-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                  <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                    {new Date(profile.lastActive).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              </View>

              {isOwnProfile && (
                <TouchableOpacity 
                  style={styles.manageAccountBtn}
                  onPress={() => {
                    const parentNav = navigation.getParent();
                    if (parentNav) {
                      parentNav.navigate('Main', { screen: 'Settings' });
                    }
                  }}
                >
                  <Ionicons name="settings-outline" size={18} color={CommunityColors.primary} />
                  <Text style={styles.manageAccountText}>Manage Account Settings</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {activeTab === 'media' && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.tertiary} />
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>No media yet</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CommunityColors.background.main },
  darkBg: { backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButton: { padding: 8, borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, flex: 1, textAlign: 'center', marginHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: { position: 'relative' },
  avatar: { fontSize: 80 },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: CommunityColors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  userTypeText: { fontSize: 12, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '700', color: CommunityColors.text.primary },
  relationshipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  relationshipText: { fontSize: 11, fontWeight: '600' },
  handle: { fontSize: 15, color: CommunityColors.primary, marginBottom: 12 },
  bio: { fontSize: 14, color: CommunityColors.text.secondary, lineHeight: 20, marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  location: { fontSize: 13, color: CommunityColors.text.secondary },
  actionButtons: { flexDirection: 'row', gap: 12 },
  followButton: {
    flex: 1,
    backgroundColor: CommunityColors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: CommunityColors.primary },
  followText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingText: { color: CommunityColors.primary },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CommunityColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CommunityColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CommunityColors.primary + '10',
    paddingVertical: 12,
    borderRadius: 12,
  },
  editProfileText: { color: CommunityColors.primary, fontSize: 15, fontWeight: '600' },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: CommunityColors.text.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: CommunityColors.text.secondary },
  statDivider: { width: 1, height: '60%', backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center' },
  dividerDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  badgesContainer: { paddingHorizontal: 20, gap: 12 },
  badgeCard: { alignItems: 'center', marginRight: 16, width: 80 },
  badgeIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: 12, fontWeight: '500', color: CommunityColors.text.primary, textAlign: 'center' },
  badgeDescription: { fontSize: 10, color: CommunityColors.text.secondary, textAlign: 'center', marginTop: 2 },
  noAchievements: { fontSize: 14, color: CommunityColors.text.secondary, fontStyle: 'italic', marginLeft: 20 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  tabText: { fontSize: 14, fontWeight: '500', color: CommunityColors.text.secondary },
  tabTextActive: { color: CommunityColors.text.primary, fontWeight: '600' },
  postsContainer: { marginTop: 16, paddingHorizontal: 20 },
  postCard: { borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  postTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.primary,
    backgroundColor: CommunityColors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  postTime: { fontSize: 12, color: CommunityColors.text.tertiary },
  postContent: { fontSize: 14, color: CommunityColors.text.primary, lineHeight: 20, marginBottom: 12 },
  postStats: { flexDirection: 'row', gap: 20 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postStatText: { fontSize: 13, color: CommunityColors.text.secondary },
  aboutContainer: { marginTop: 16, paddingHorizontal: 20 },
  aboutCard: { borderRadius: 16, padding: 20, overflow: 'hidden' },
  aboutTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, marginBottom: 16 },
  aboutSection: { marginBottom: 16 },
  aboutLabel: { fontSize: 12, color: CommunityColors.text.tertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  aboutValue: { fontSize: 15, color: CommunityColors.text.primary, fontWeight: '500', lineHeight: 20 },
  aboutValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manageAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
  },
  manageAccountText: { fontSize: 14, color: CommunityColors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: CommunityColors.text.secondary, marginTop: 12 },
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16 },
  goBackButton: { backgroundColor: CommunityColors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
  textLight: { color: '#fff' },
  textMuted: { color: CommunityColors.text.secondary },
});