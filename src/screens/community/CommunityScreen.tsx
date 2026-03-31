import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  FadeInUp,
  FadeIn,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// NEW: Import Community Theme
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

import { useCommunity, Post, Topic, CommunityUser } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import type { CommunityStackParamList } from '../../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CommunityNavigationProp = NativeStackNavigationProp<CommunityStackParamList>;

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 340; // Slightly taller for new theme
const PROFILE_SECTION_HEIGHT = 200;

export default function CommunityScreen() {
  const navigation = useNavigation<CommunityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { 
    posts, 
    topics, 
    notifications, 
    currentUser,
    likePost, 
    unlikePost, 
    repostPost, 
    unrepostPost,
    bookmarkPost,
    refreshFeed,
    isLoading,
    getUnreadCount,
    getUserStats,
    onlineUsers,
    getUserById,
  } = useCommunity();
  const { getDisplayName } = useUser();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'following' | 'nearby'>('trending');
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  // Animated header styles - using new theme colors
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - 120],
      [0, -HEADER_HEIGHT + 120],
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - 170],
      [1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HEADER_HEIGHT - 170, HEADER_HEIGHT - 120],
      [0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });

  const profileCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0.95],
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, 150],
      [1, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  useFocusEffect(
    useCallback(() => {
      // Refresh data when focused
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  };

  const handleLike = async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleRepost = async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
  };

  const handleBookmark = async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await bookmarkPost(post.id);
  };

  const navigateToUserProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('UserProfile', { userId });
  };

  const navigateToPostDetail = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const navigateToTopic = (topic: Topic) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Topic', { topicId: topic.id });
  };

  const navigateToChat = (userId?: string) => {
    if (userId) {
      navigation.navigate('Chat', { userId });
    } else {
      navigation.navigate('Notifications');
    }
  };

  const navigateToEditProfile = () => {
    navigation.navigate('UserProfile', { userId: currentUser?.id || '' });
  };

  // Render Topic Card with new theme
  const renderTopicCard = ({ item }: { item: Topic }) => (
    <TouchableOpacity 
      style={styles.topicCard}
      onPress={() => navigateToTopic(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[item.color + '30', item.color + '10']}
        style={styles.topicGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.topicHeader}>
          <Text style={styles.topicEmoji}>{item.emoji}</Text>
          {item.trending && (
            <View style={styles.trendingBadge}>
              <LinearGradient 
                colors={CommunityGradients.trending}
                style={styles.trendingGradient}
              >
                <Ionicons name="flame" size={12} color="#fff" />
                <Text style={styles.trendingText}>HOT</Text>
              </LinearGradient>
            </View>
          )}
        </View>
        <Text style={styles.topicName}>{item.name}</Text>
        <View style={styles.topicStats}>
          <Ionicons name="people" size={12} color={CommunityColors.text.tertiary} />
          <Text style={styles.topicStat}>{(item.members / 1000).toFixed(1)}k</Text>
          <Text style={styles.topicDot}>•</Text>
          <Ionicons name="document-text" size={12} color={CommunityColors.text.tertiary} />
          <Text style={styles.topicStat}>{item.posts}</Text>
        </View>
        {item.isJoined && (
          <View style={styles.joinedIndicator}>
            <Ionicons name="checkmark-circle" size={16} color={CommunityColors.success} />
            <Text style={[styles.joinedText, { color: CommunityColors.success }]}>Joined</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  // Render Post with new theme styling
  const renderPost = ({ item, index }: { item: Post; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 100)}>
      <View style={styles.postCard}>
        {/* Post Header */}
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => navigateToUserProfile(item.authorId)}
          activeOpacity={0.8}
        >
          <View style={styles.authorInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.authorAvatar}>{item.author.avatar}</Text>
              {item.author.onlineStatus === 'online' && (
                <View style={styles.onlineIndicator} />
              )}
            </View>
            <View style={styles.authorMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName}>{item.author.displayName}</Text>
                {item.author.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.postMeta}>
                <Text style={styles.topicText}>{item.topic}</Text>
                <Text style={styles.timeText}> • {item.time}</Text>
                {item.author.country && (
                  <Text style={styles.countryText}> • {item.author.country}</Text>
                )}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Post Content */}
        <TouchableOpacity 
          onPress={() => navigateToPostDetail(item.id)}
          activeOpacity={0.9}
          style={styles.contentContainer}
        >
          <Text style={styles.postContent}>{item.content}</Text>
          {item.images && item.images.length > 0 && (
            <View style={styles.imagesContainer}>
              {item.images.map((img, idx) => (
                <Image key={idx} source={{ uri: img }} style={styles.postImage} />
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Helpful Votes */}
        {item.helpfulVotes > 0 && (
          <View style={styles.helpfulContainer}>
            <LinearGradient 
              colors={[CommunityColors.success + '20', CommunityColors.success + '10']}
              style={styles.helpfulGradient}
            >
              <Ionicons name="thumbs-up" size={14} color={CommunityColors.success} />
              <Text style={styles.helpfulText}>{item.helpfulVotes} found this helpful</Text>
            </LinearGradient>
          </View>
        )}

        {/* Post Actions - New Theme Style */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={[styles.actionButton, item.isLiked && styles.actionActive]}
            onPress={() => handleLike(item)}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={item.isLiked ? CommunityColors.primary : CommunityColors.text.tertiary} 
            />
            <Text style={[
              styles.actionText, 
              item.isLiked && { color: CommunityColors.primary, fontWeight: '700' }
            ]}>
              {item.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToPostDetail(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={22} color={CommunityColors.text.tertiary} />
            <Text style={styles.actionText}>{item.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, item.isReposted && styles.actionActive]}
            onPress={() => handleRepost(item)}
          >
            <Ionicons 
              name={item.isReposted ? "repeat" : "repeat-outline"} 
              size={22} 
              color={item.isReposted ? CommunityColors.secondary : CommunityColors.text.tertiary} 
            />
            <Text style={[
              styles.actionText, 
              item.isReposted && { color: CommunityColors.secondary, fontWeight: '700' }
            ]}>
              {item.reposts}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleBookmark(item)}
          >
            <Ionicons 
              name={item.isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={22} 
              color={item.isBookmarked ? CommunityColors.accent : CommunityColors.text.tertiary} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={22} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  // Render Profile Section with new theme
  const renderProfileSection = () => {
    if (!currentUser) return null;

    return (
      <Animated.View style={[styles.profileSection, profileCardStyle]}>
        <LinearGradient 
          colors={CommunityGradients.card}
          style={styles.profileCard}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileLeft}>
              <TouchableOpacity onPress={navigateToEditProfile} style={styles.avatarWrapper}>
                <Text style={styles.profileAvatar}>{currentUser.avatar}</Text>
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
                <View style={styles.onlineStatusDot} />
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{currentUser.displayName}</Text>
                <Text style={styles.profileHandle}>{currentUser.handle}</Text>
                <View style={styles.onlineStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: CommunityColors.success }]} />
                  <Text style={styles.statusText}>Online</Text>
                  {currentUser.country && (
                    <Text style={styles.countryText}>• {currentUser.country}</Text>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={navigateToEditProfile}
            >
              <LinearGradient 
                colors={[CommunityColors.primary + '20', CommunityColors.primary + '10']}
                style={styles.editButtonGradient}
              >
                <Ionicons name="create-outline" size={20} color={CommunityColors.primary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('UserProfile', { userId: currentUser.id })}
            >
              <Text style={styles.statValue}>{currentUser.stats.posts}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statValue}>{currentUser.stats.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statValue}>{currentUser.stats.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentUser.stats.streakDays}</Text>
              <Text style={styles.statLabel}>🔥 Streak</Text>
            </View>
          </View>

          {/* Bio Preview */}
          {currentUser.bio ? (
            <Text style={styles.bioPreview} numberOfLines={2}>
              {currentUser.bio}
            </Text>
          ) : (
            <TouchableOpacity onPress={navigateToEditProfile}>
              <Text style={styles.addBioText}>+ Add a bio to your profile</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  // Render Sticky Header with new theme
  const renderStickyHeader = () => {
    const unreadCount = getUnreadCount();
    
    return (
      <Animated.View style={[styles.stickyHeader, stickyHeaderStyle, { paddingTop: insets.top }]}>
        <BlurView intensity={95} style={styles.stickyHeaderBlur} tint="light">
          <LinearGradient 
            colors={['rgba(255,255,255,0.95)', 'rgba(255,250,250,0.98)']}
            style={styles.stickyHeaderGradient}
          >
            <View style={styles.stickyHeaderContent}>
              <TouchableOpacity onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}>
                <View style={styles.stickyTitleContainer}>
                  <Text style={styles.stickyTitle}>Community</Text>
                  <View style={styles.stickyUnderline} />
                </View>
              </TouchableOpacity>
              <View style={styles.stickyActions}>
                <TouchableOpacity 
                  style={styles.stickyIconButton}
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <View style={styles.iconButtonGradient}>
                    <Ionicons name="notifications-outline" size={24} color={CommunityColors.primary} />
                    {unreadCount > 0 && (
                      <View style={styles.stickyBadge}>
                        <Text style={styles.stickyBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.stickyIconButton}
                  onPress={() => navigateToChat()}
                >
                  <View style={styles.iconButtonGradient}>
                    <Ionicons name="chatbubbles-outline" size={24} color={CommunityColors.secondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    );
  };

  const unreadCount = getUnreadCount();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header Background - New Theme Colors */}
      <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
        <LinearGradient 
          colors={CommunityGradients.header}
          style={[styles.headerGradient, { height: HEADER_HEIGHT }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header Content */}
          <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.title}>Community 👥</Text>
                <Text style={styles.subtitle}>Connect with parents worldwide</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <View style={styles.headerIconGradient}>
                    <Ionicons name="notifications-outline" size={24} color={CommunityColors.primary} />
                    {unreadCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => navigateToChat()}
                >
                  <View style={styles.headerIconGradient}>
                    <Ionicons name="chatbubbles-outline" size={24} color={CommunityColors.secondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Profile Section */}
            {renderProfileSection()}

            {/* Online Users Strip */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.onlineContainer}
            >
              <TouchableOpacity style={styles.createRoomButton}>
                <LinearGradient 
                  colors={CommunityGradients.primary} 
                  style={styles.createRoomGradient}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                  <Text style={styles.createRoomText}>Room</Text>
                </LinearGradient>
              </TouchableOpacity>
              {onlineUsers.map((userId) => {
                const user = getUserById(userId);
                if (!user) return null;
                return (
                  <TouchableOpacity 
                    key={userId} 
                    style={styles.onlineUser}
                    onPress={() => navigateToUserProfile(userId)}
                  >
                    <View style={styles.onlineAvatarContainer}>
                      <Text style={styles.onlineAvatar}>{user.avatar}</Text>
                      <View style={[styles.statusDotSmall, { backgroundColor: CommunityColors.success }]} />
                    </View>
                    <Text style={styles.onlineName}>{user.displayName.split(' ')[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Sticky Header */}
      {renderStickyHeader()}

      {/* Main Content */}
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={CommunityColors.primary}
            colors={[CommunityColors.primary, CommunityColors.secondary]}
          />
        }
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ 
          paddingTop: HEADER_HEIGHT + 20, 
          paddingBottom: 120 
        }}
        ListHeaderComponent={
          <>
            {/* Topics Grid */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Topics</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={topics}
              renderItem={renderTopicCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsContainer}
            />

            {/* Feed Tabs */}
            <View style={styles.tabContainer}>
              {(['trending', 'following', 'nearby'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive
                  ]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  {activeTab === tab && (
                    <View style={styles.tabIndicator}>
                      <LinearGradient
                        colors={CommunityGradients.primary}
                        style={styles.tabGradient}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.loadMore} onPress={() => {}}>
            <Text style={styles.loadMoreText}>Load more posts</Text>
            <Ionicons name="chevron-down" size={20} color={CommunityColors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Floating Create Post Button - New Theme */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost', {})}
      >
        <LinearGradient 
          colors={CommunityGradients.accent} 
          style={styles.fabGradient}
        >
          <Ionicons name="create-outline" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CommunityColors.background.main,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerGradient: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...CommunityShadows.lg,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: CommunitySpacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: CommunitySpacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: CommunitySpacing.sm,
  },
  iconButton: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  headerIconGradient: {
    width: 48,
    height: 48,
    borderRadius: CommunityBorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...CommunityShadows.md,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: CommunityColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Profile Section Styles - New Theme
  profileSection: {
    marginBottom: CommunitySpacing.md,
  },
  profileCard: {
    borderRadius: CommunityBorderRadius.xl,
    padding: CommunitySpacing.lg,
    overflow: 'hidden',
    backgroundColor: CommunityColors.background.card,
    ...CommunityShadows.md,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: CommunitySpacing.md,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: CommunitySpacing.md,
  },
  profileAvatar: {
    fontSize: 56,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: CommunityColors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineStatusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 2,
  },
  profileHandle: {
    fontSize: 14,
    color: CommunityColors.primary,
    fontWeight: '600',
    marginBottom: CommunitySpacing.xs,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: CommunityColors.success,
    fontWeight: '600',
  },
  countryText: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  editButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: CommunitySpacing.md,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
    marginBottom: CommunitySpacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    fontWeight: '600',
  },
  bioPreview: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  addBioText: {
    fontSize: 14,
    color: CommunityColors.primary,
    fontWeight: '600',
  },

  // Online Users Styles - New Theme
  onlineContainer: {
    paddingVertical: CommunitySpacing.md,
    gap: CommunitySpacing.md,
  },
  createRoomButton: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    marginRight: CommunitySpacing.sm,
  },
  createRoomGradient: {
    width: 56,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoomText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  onlineUser: {
    alignItems: 'center',
    marginRight: CommunitySpacing.md,
  },
  onlineAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  onlineAvatar: {
    fontSize: 44,
  },
  statusDotSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineName: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },

  // Sticky Header Styles - New Theme
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderBlur: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  stickyHeaderGradient: {
    paddingHorizontal: CommunitySpacing.lg,
    paddingBottom: CommunitySpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.border,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
  },
  stickyTitleContainer: {
    alignItems: 'flex-start',
  },
  stickyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: CommunityColors.text.primary,
    letterSpacing: -0.5,
  },
  stickyUnderline: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: CommunityColors.primary,
    marginTop: 4,
  },
  stickyActions: {
    flexDirection: 'row',
    gap: CommunitySpacing.sm,
  },
  stickyIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: CommunityColors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  stickyBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: CommunityColors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stickyBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Content Styles - New Theme
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    marginBottom: CommunitySpacing.md,
    marginTop: CommunitySpacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.primary,
  },
  topicsContainer: {
    paddingHorizontal: CommunitySpacing.md,
    gap: CommunitySpacing.sm,
    paddingBottom: CommunitySpacing.xs,
  },
  topicCard: {
    width: 170,
    height: 170,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    marginRight: CommunitySpacing.sm,
    ...CommunityShadows.sm,
  },
  topicGradient: {
    flex: 1,
    padding: CommunitySpacing.lg,
    justifyContent: 'space-between',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topicEmoji: {
    fontSize: 40,
  },
  trendingBadge: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  trendingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  trendingText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '800',
  },
  topicName: {
    fontSize: 17,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: CommunitySpacing.xs,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topicStat: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    fontWeight: '600',
  },
  topicDot: {
    marginHorizontal: 4,
    color: CommunityColors.text.tertiary,
  },
  joinedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: CommunitySpacing.xs,
  },
  joinedText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Tab Styles - New Theme
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: CommunitySpacing.lg,
    marginTop: CommunitySpacing.lg,
    marginBottom: CommunitySpacing.md,
    gap: CommunitySpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
    paddingBottom: CommunitySpacing.sm,
  },
  tab: {
    paddingVertical: CommunitySpacing.sm,
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: CommunityColors.text.tertiary,
  },
  tabTextActive: {
    color: CommunityColors.text.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -9,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tabGradient: {
    flex: 1,
  },

  // Post Styles - New Theme
  postCard: {
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.xl,
    padding: CommunitySpacing.lg,
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: CommunitySpacing.md,
    ...CommunityShadows.sm,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CommunitySpacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: CommunitySpacing.sm,
  },
  authorAvatar: {
    fontSize: 44,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  authorMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: CommunityColors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMeta: {
    fontSize: 13,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicText: {
    color: CommunityColors.primary,
    fontWeight: '700',
  },
  timeText: {
    color: CommunityColors.text.tertiary,
  },
  countryText: {
    color: CommunityColors.text.secondary,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    marginBottom: CommunitySpacing.sm,
  },
  postContent: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    lineHeight: 22,
    marginBottom: CommunitySpacing.sm,
    fontWeight: '400',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  postImage: {
    width: (width - 88) / 2,
    height: 150,
    borderRadius: CommunityBorderRadius.lg,
  },
  helpfulContainer: {
    marginBottom: CommunitySpacing.sm,
  },
  helpfulGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  helpfulText: {
    fontSize: 13,
    color: CommunityColors.success,
    fontWeight: '700',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: CommunitySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 12,
  },
  actionActive: {
    backgroundColor: CommunityColors.primary + '10',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.tertiary,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: CommunitySpacing.xl,
  },
  loadMoreText: {
    fontSize: 14,
    color: CommunityColors.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  
  // FAB - New Theme
  fab: {
    position: 'absolute',
    right: CommunitySpacing.lg,
    bottom: 120,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...CommunityShadows.glow,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
