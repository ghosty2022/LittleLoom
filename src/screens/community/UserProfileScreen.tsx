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

type UserProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;

const { width } = Dimensions.get('window');

const BADGES = [
  { emoji: '🏆', name: 'Top Contributor', color: '#fee140', description: '100+ helpful posts' },
  { emoji: '💙', name: 'Helpful Parent', color: '#667eea', description: '50+ likes received' },
  { emoji: '🔥', name: '30 Day Streak', color: '#fc5c7d', description: 'Active for 30 days' },
  { emoji: '⭐', name: 'Rising Star', color: '#f093fb', description: 'Gained 1000 followers' },
  { emoji: '📝', name: 'Storyteller', color: '#4facfe', description: '50+ posts shared' },
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
        <ActivityIndicator size="large" color="#667eea" />
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
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <TouchableOpacity onPress={isOwnProfile ? handleEditProfile : handleReport} style={styles.headerButton}>
            <Ionicons 
              name={isOwnProfile ? "create-outline" : "ellipsis-horizontal"} 
              size={24} 
              color={isDark ? '#fff' : '#1a1a1a'} 
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            {!isOwnProfile && (
              <TouchableOpacity onPress={handleReport} style={styles.headerBtn}>
                <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
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
              
              <View style={[styles.userTypeBadge, { backgroundColor: '#667eea20' }]}>
                <Ionicons name="people" size={12} color="#667eea" />
                <Text style={[styles.userTypeText, { color: '#667eea' }]}>Parent</Text>
              </View>
            </View>
            
            <View style={styles.nameRow}>
              <Text style={[styles.name, isDark && styles.textLight]}>{profile.displayName}</Text>
              {isOwnProfile && (
                <View style={[styles.relationshipBadge, { backgroundColor: '#667eea20' }]}>
                  <Text style={[styles.relationshipText, { color: '#667eea' }]}>You</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.handle}>{profile.handle}</Text>
            <Text style={[styles.bio, isDark && styles.textMuted]}>{profile.bio || 'No bio yet'}</Text>
            
            {profile.country && profile.country !== 'Unknown' && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={isDark ? '#666' : '#666'} />
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
                  <Ionicons name="mail-outline" size={20} color="#667eea" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="chevron-down" size={20} color="#667eea" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile}>
                <Ionicons name="create-outline" size={18} color="#667eea" />
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
                <Ionicons name="document-text-outline" size={48} color={isDark ? '#444' : '#ccc'} />
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
                            color={post.isLiked ? "#fc5c7d" : (isDark ? '#666' : '#666')} 
                          />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.likes}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble-outline" size={18} color={isDark ? '#666' : '#666'} />
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
                            color={post.isReposted ? "#11998e" : (isDark ? '#666' : '#666')} 
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
                    <Ionicons name="location-outline" size={18} color={isDark ? '#666' : '#666'} />
                    <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                      {profile.country}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Joined</Text>
                <View style={styles.aboutValueRow}>
                  <Ionicons name="calendar-outline" size={18} color={isDark ? '#666' : '#666'} />
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
                  <Ionicons name="settings-outline" size={18} color="#667eea" />
                  <Text style={styles.manageAccountText}>Manage Account Settings</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {activeTab === 'media' && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color={isDark ? '#444' : '#ccc'} />
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>No media yet</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e0e7ff' },
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1, textAlign: 'center', marginHorizontal: 16 },
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
    backgroundColor: '#667eea',
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
  name: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  relationshipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  relationshipText: { fontSize: 11, fontWeight: '600' },
  handle: { fontSize: 15, color: '#667eea', marginBottom: 12 },
  bio: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  location: { fontSize: 13, color: '#666' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  followButton: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#667eea' },
  followText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingText: { color: '#667eea' },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
  },
  editProfileText: { color: '#667eea', fontSize: 15, fontWeight: '600' },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  statDivider: { width: 1, height: '60%', backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center' },
  dividerDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  badgesContainer: { paddingHorizontal: 20, gap: 12 },
  badgeCard: { alignItems: 'center', marginRight: 16, width: 80 },
  badgeIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: 12, fontWeight: '500', color: '#1a1a1a', textAlign: 'center' },
  badgeDescription: { fontSize: 10, color: '#888', textAlign: 'center', marginTop: 2 },
  noAchievements: { fontSize: 14, color: '#888', fontStyle: 'italic', marginLeft: 20 },
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
  tabText: { fontSize: 14, fontWeight: '500', color: '#666' },
  tabTextActive: { color: '#1a1a1a', fontWeight: '600' },
  postsContainer: { marginTop: 16, paddingHorizontal: 20 },
  postCard: { borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  postTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  postTime: { fontSize: 12, color: '#999' },
  postContent: { fontSize: 14, color: '#1a1a1a', lineHeight: 20, marginBottom: 12 },
  postStats: { flexDirection: 'row', gap: 20 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postStatText: { fontSize: 13, color: '#666' },
  aboutContainer: { marginTop: 16, paddingHorizontal: 20 },
  aboutCard: { borderRadius: 16, padding: 20, overflow: 'hidden' },
  aboutTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  aboutSection: { marginBottom: 16 },
  aboutLabel: { fontSize: 12, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  aboutValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '500', lineHeight: 20 },
  aboutValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manageAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  manageAccountText: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  errorText: { fontSize: 18, color: '#666', marginBottom: 16 },
  goBackButton: { backgroundColor: '#667eea', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
  textLight: { color: '#fff' },
  textMuted: { color: '#888' },
});