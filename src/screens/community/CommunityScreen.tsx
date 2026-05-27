import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
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
  TextInput,
  Platform,
  ListRenderItem,
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
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const HEADER_HEIGHT = 360;
const PROFILE_SECTION_HEIGHT = 200;

// ─── Avatar Image Component (FIXES file:// URI ISSUE) ─────────
interface AvatarImageProps {
  uri: string;
  size?: number;
  style?: any;
}
const AvatarImage = memo(({ uri, size = 40, style }: AvatarImageProps) => {
  const [hasError, setHasError] = useState(false);

  // Check if it's an emoji (no URI scheme, typically 1-2 chars)
  const isEmoji = !uri || (!uri.includes('://') && !uri.startsWith('/') && uri.length <= 4);
  
  if (isEmoji || hasError) {
    return (
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E8EAF6', alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ fontSize: size * 0.6 }}>
          {isEmoji ? (uri || '👤') : '👤'}
        </Text>
      </View>
    );
  }

  // Normalize file:// URIs
  const normalizedUri = uri.startsWith('file://') ? uri : uri.startsWith('/') ? `file://${uri}` : uri;

  return (
    <Image
      source={{ uri: normalizedUri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
  );
});

// ─── Memoized Post Item ─────────────────────────────────────────
interface PostItemProps {
  item: Post;
  index: number;
  onLike: (post: Post) => void;
  onRepost: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onNavigateToUser: (userId: string) => void;
  onNavigateToPost: (postId: string) => void;
}

const PostItem = memo(({ item, index, onLike, onRepost, onBookmark, onNavigateToUser, onNavigateToPost }: PostItemProps) => {
  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 80, 400))}>
      <View style={styles.postCard}>
        {/* Post Header */}
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => onNavigateToUser(item.authorId)}
          activeOpacity={0.8}
          accessibilityLabel={`View ${item.author.displayName}'s profile`}
          accessibilityRole="button"
        >
          <View style={styles.authorInfo}>
            <View style={styles.avatarContainer}>
              <AvatarImage uri={item.author.avatar} size={42} />
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
          <TouchableOpacity 
            style={styles.moreButton}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Post Content */}
        <TouchableOpacity 
          onPress={() => onNavigateToPost(item.id)}
          activeOpacity={0.9}
          style={styles.contentContainer}
          accessibilityLabel="View post details"
          accessibilityRole="button"
        >
          <Text style={styles.postContent}>{item.content}</Text>
          {item.images && item.images.length > 0 && (
            <View style={styles.imagesContainer}>
              {item.images.map((img, idx) => (
                <Image 
                  key={idx} 
                  source={{ uri: img.startsWith('file://') ? img : img.startsWith('/') ? `file://${img}` : img }} 
                  style={styles.postImage}
                  resizeMode="cover"
                  onError={(e) => console.warn('Post image error:', e.nativeEvent.error)}
                />
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

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={[styles.actionButton, item.isLiked && styles.actionActive]}
            onPress={() => onLike(item)}
            accessibilityLabel={item.isLiked ? "Unlike post" : "Like post"}
            accessibilityRole="button"
            accessibilityState={{ selected: item.isLiked }}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={22} 
              color={item.isLiked ? CommunityColors.primary : CommunityColors.text.tertiary} 
            />
            <Text style={[
              styles.actionText, 
              item.isLiked && { color: CommunityColors.primary, fontWeight: '700' }
            ]}>
              {item.likes > 0 ? item.likes : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onNavigateToPost(item.id)}
            accessibilityLabel={`${item.commentsCount} comments`}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={20} color={CommunityColors.text.tertiary} />
            <Text style={styles.actionText}>{item.commentsCount > 0 ? item.commentsCount : 'Comment'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, item.isReposted && styles.actionActive]}
            onPress={() => onRepost(item)}
            accessibilityLabel={item.isReposted ? "Undo repost" : "Repost"}
            accessibilityRole="button"
            accessibilityState={{ selected: item.isReposted }}
          >
            <Ionicons 
              name={item.isReposted ? "repeat" : "repeat-outline"} 
              size={20} 
              color={item.isReposted ? CommunityColors.secondary : CommunityColors.text.tertiary} 
            />
            <Text style={[
              styles.actionText, 
              item.isReposted && { color: CommunityColors.secondary, fontWeight: '700' }
            ]}>
              {item.reposts > 0 ? item.reposts : 'Repost'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, item.isBookmarked && styles.actionActive]}
            onPress={() => onBookmark(item)}
            accessibilityLabel={item.isBookmarked ? "Remove bookmark" : "Bookmark"}
            accessibilityRole="button"
            accessibilityState={{ selected: item.isBookmarked }}
          >
            <Ionicons 
              name={item.isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={item.isBookmarked ? CommunityColors.accent : CommunityColors.text.tertiary} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            accessibilityLabel="Share post"
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={20} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

PostItem.displayName = 'PostItem';

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
    getFeedPosts,  // NEW: Use personalized feed
    getFollowers,
    getFollowing,
  } = useCommunity();
  const { getDisplayName } = useUser();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'following' | 'nearby'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList<Post>>(null);
  const unreadBadgeScale = useSharedValue(1);

  // Load follower/following counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      if (currentUser?.id) {
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      }
    };
    loadCounts();
  }, [currentUser?.id, currentUser?.stats.followers, currentUser?.stats.following]);

  // Animate badge when unread count changes
  const unreadCount = getUnreadCount();
  useAnimatedReaction(
    () => unreadCount,
    (current, previous) => {
      if (current !== previous && current > 0) {
        unreadBadgeScale.value = withSpring(1.4, { damping: 8, stiffness: 200 }, () => {
          unreadBadgeScale.value = withSpring(1);
        });
      }
    },
    [unreadCount]
  );

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unreadBadgeScale.value }],
  }));

  // Animated header styles
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
    return { transform: [{ translateY }], opacity };
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HEADER_HEIGHT - 170, HEADER_HEIGHT - 120],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity, pointerEvents: opacity > 0.5 ? 'auto' : 'none' };
  });

  const profileCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, 100], [1, 0.95], Extrapolate.CLAMP);
    const opacity = interpolate(scrollY.value, [0, 150], [1, 0.8], Extrapolate.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  const searchBarAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 80],
      [0, -10],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(scrollY.value, [0, 120], [1, 0], Extrapolate.CLAMP);
    return { transform: [{ translateY }], opacity };
  });

  useFocusEffect(
    useCallback(() => {
      // Refresh data when focused - counts will update
      const refreshCounts = async () => {
        if (currentUser?.id) {
          const followers = await getFollowers(currentUser.id);
          const following = await getFollowing(currentUser.id);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }
      };
      refreshCounts();
    }, [currentUser?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  };

  const handleLike = useCallback(async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  }, [likePost, unlikePost]);

  const handleRepost = useCallback(async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
  }, [repostPost, unrepostPost]);

  const handleBookmark = useCallback(async (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await bookmarkPost(post.id);
  }, [bookmarkPost]);

  const navigateToUserProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  const navigateToPostDetail = useCallback((postId: string) => {
    navigation.navigate('PostDetail', { postId });
  }, [navigation]);

  const navigateToTopic = useCallback((topic: Topic) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Topic', { topicId: topic.id });
  }, [navigation]);

  const navigateToChatList = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ChatList');
  }, [navigation]);

  const navigateToNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Notifications');
  }, [navigation]);

  const navigateToEditProfile = useCallback(() => {
    if (currentUser?.id) {
      navigation.navigate('EditCommunityProfile');
    }
  }, [navigation, currentUser]);

  const navigateToBookmarks = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // navigation.navigate('Bookmarks'); // Add when screen exists
  }, []);

  const navigateToMyTopics = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Filter to show only joined topics
  }, []);

  // ─── FILTERED POSTS: Use getFeedPosts for topic-based filtering ──
  const getFilteredPosts = useCallback(() => {
    let basePosts: Post[];

    switch (activeTab) {
      case 'trending':
        // Use personalized feed from selected topics
        basePosts = getFeedPosts();
        break;
      case 'following':
        // Show posts from users the current user follows
        basePosts = posts.filter(post => 
          currentUser?.following?.includes(post.authorId) || post.authorId === currentUser?.id
        );
        break;
      case 'nearby':
        // Show posts from same country
        basePosts = posts.filter(post => 
          post.author.country === currentUser?.country || post.authorId === currentUser?.id
        );
        break;
      default:
        basePosts = getFeedPosts();
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return basePosts.filter(p => 
        p.content.toLowerCase().includes(query) ||
        p.author.displayName.toLowerCase().includes(query) ||
        p.topic.toLowerCase().includes(query)
      );
    }

    return basePosts;
  }, [activeTab, posts, getFeedPosts, currentUser, searchQuery]);

  const filteredPosts = getFilteredPosts();

  // Render Topic Card
  const renderTopicCard = useCallback(({ item }: { item: Topic }) => (
    <TouchableOpacity 
      style={styles.topicCard}
      onPress={() => navigateToTopic(item)}
      activeOpacity={0.8}
      accessibilityLabel={`Topic ${item.name}`}
      accessibilityRole="button"
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
  ), [navigateToTopic]);

  // Render Post (memoized)
  const renderPost: ListRenderItem<Post> = useCallback(({ item, index }) => (
    <PostItem
      item={item}
      index={index}
      onLike={handleLike}
      onRepost={handleRepost}
      onBookmark={handleBookmark}
      onNavigateToUser={navigateToUserProfile}
      onNavigateToPost={navigateToPostDetail}
    />
  ), [handleLike, handleRepost, handleBookmark, navigateToUserProfile, navigateToPostDetail]);

  // Profile Section - Uses real follower/following counts
  const renderProfileSection = useCallback(() => {
    if (!currentUser) return null;

    // Use the dynamically loaded counts instead of stale stats
    const displayFollowers = followerCount || currentUser.stats.followers || 1;
    const displayFollowing = followingCount || currentUser.stats.following || 0;
    const displayStreak = currentUser.stats.streakDays || 0;

    return (
      <Animated.View style={[styles.profileSection, profileCardStyle]}>
        <LinearGradient 
          colors={CommunityGradients.card}
          style={styles.profileCard}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileLeft}>
              <TouchableOpacity 
                onPress={navigateToEditProfile} 
                style={styles.avatarWrapper}
                accessibilityLabel="Edit profile picture"
                accessibilityRole="button"
              >
                <AvatarImage uri={currentUser.avatar} size={52} />
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
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <LinearGradient 
                colors={[CommunityColors.primary + '20', CommunityColors.primary + '10']}
                style={styles.editButtonGradient}
              >
                <Ionicons name="create-outline" size={20} color={CommunityColors.primary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick Stats - Now with real counts */}
          <View style={styles.quickStats}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('UserProfile', { userId: currentUser.id })}
              accessibilityLabel={`${currentUser.stats.posts} posts`}
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{currentUser.stats.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={() => navigation.navigate('Followers', { userId: currentUser.id })}
              accessibilityLabel={`${displayFollowers} followers`} 
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{displayFollowers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={() => navigation.navigate('Following', { userId: currentUser.id })}
              accessibilityLabel={`${displayFollowing} following`} 
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{displayFollowing}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{displayStreak}</Text>
              <Text style={styles.statLabel}>🔥 Streak</Text>
            </View>
          </View>

          {/* Bio Preview */}
          {currentUser.bio ? (
            <Text style={styles.bioPreview} numberOfLines={2}>
              {currentUser.bio}
            </Text>
          ) : (
            <TouchableOpacity onPress={navigateToEditProfile} accessibilityLabel="Add bio" accessibilityRole="button">
              <Text style={styles.addBioText}>+ Add a bio to your profile</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    );
  }, [currentUser, navigateToEditProfile, navigation, profileCardStyle, followerCount, followingCount]);

  // Search Bar Component
  const renderSearchBar = () => (
    <Animated.View style={[styles.searchContainer, searchBarAnimatedStyle]}>
      <BlurView intensity={80} style={styles.searchBlur} tint="light">
        <View style={styles.searchInner}>
          <Ionicons name="search" size={18} color={CommunityColors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts, topics, parents..."
            placeholderTextColor={CommunityColors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={CommunityColors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );

  // Quick Action Pills
  const renderQuickActions = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickActionsContainer}
    >
      <TouchableOpacity 
        style={styles.quickActionPill}
        onPress={() => navigation.navigate('CreatePost', {})}
        accessibilityLabel="Create new post"
        accessibilityRole="button"
      >
        <LinearGradient colors={CommunityGradients.primary} style={styles.quickActionGradient}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.quickActionText}>New Post</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.quickActionPill, styles.quickActionPillSecondary]}
        onPress={navigateToMyTopics}
        accessibilityLabel="My topics"
        accessibilityRole="button"
      >
        <Ionicons name="folder-open" size={16} color={CommunityColors.primary} />
        <Text style={styles.quickActionTextSecondary}>My Topics</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.quickActionPill, styles.quickActionPillSecondary]}
        onPress={navigateToBookmarks}
        accessibilityLabel="Saved bookmarks"
        accessibilityRole="button"
      >
        <Ionicons name="bookmark" size={16} color={CommunityColors.accent} />
        <Text style={styles.quickActionTextSecondary}>Saved</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.quickActionPill, styles.quickActionPillSecondary]}
        onPress={navigateToChatList}
        accessibilityLabel="Messages"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubbles" size={16} color={CommunityColors.secondary} />
        <Text style={styles.quickActionTextSecondary}>Messages</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Sticky Header with Search
  const renderStickyHeader = () => {
    return (
      <Animated.View style={[styles.stickyHeader, stickyHeaderStyle, { paddingTop: insets.top }]}>
        <BlurView intensity={95} style={styles.stickyHeaderBlur} tint="light">
          <LinearGradient 
            colors={['rgba(255,255,255,0.95)', 'rgba(255,250,250,0.98)']}
            style={styles.stickyHeaderGradient}
          >
            <View style={styles.stickyHeaderContent}>
              <TouchableOpacity 
                onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                accessibilityLabel="Scroll to top"
                accessibilityRole="button"
              >
                <View style={styles.stickyTitleContainer}>
                  <Text style={styles.stickyTitle}>Community</Text>
                  <View style={styles.stickyUnderline} />
                </View>
              </TouchableOpacity>
              
              <View style={styles.stickyActions}>
                {/* Search Icon in Sticky Header */}
                <TouchableOpacity 
                  style={styles.stickyIconButton}
                  onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                  accessibilityLabel="Search"
                  accessibilityRole="button"
                >
                  <View style={styles.iconButtonGradient}>
                    <Ionicons name="search" size={22} color={CommunityColors.text.secondary} />
                  </View>
                </TouchableOpacity>

                {/* Notifications */}
                <TouchableOpacity 
                  style={styles.stickyIconButton}
                  onPress={navigateToNotifications}
                  accessibilityLabel={`${unreadCount} unread notifications`}
                  accessibilityRole="button"
                >
                  <View style={styles.iconButtonGradient}>
                    <Ionicons name="notifications-outline" size={22} color={CommunityColors.primary} />
                    {unreadCount > 0 && (
                      <Animated.View style={[styles.stickyBadge, badgeAnimatedStyle]}>
                        <Text style={styles.stickyBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </Animated.View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Chat/Messages */}
                <TouchableOpacity 
                  style={styles.stickyIconButton}
                  onPress={navigateToChatList}
                  accessibilityLabel="Messages"
                  accessibilityRole="button"
                >
                  <View style={styles.iconButtonGradient}>
                    <Ionicons name="chatbubbles-outline" size={22} color={CommunityColors.secondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header Background */}
      <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
        <LinearGradient 
          colors={CommunityGradients.header}
          style={[styles.headerGradient, { height: HEADER_HEIGHT }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.headerContent, { paddingTop: insets.top + 16 }]}>
            {/* Header Top */}
            <View style={styles.headerTop}>
              <View style={styles.headerTitleSection}>
                <Text style={styles.title}>Community 👥</Text>
                <Text style={styles.subtitle}>Connect with parents worldwide</Text>
              </View>
              <View style={styles.headerActions}>
                {/* Notifications */}
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={navigateToNotifications}
                  accessibilityLabel={`${unreadCount} unread notifications`}
                  accessibilityRole="button"
                >
                  <View style={styles.headerIconGradient}>
                    <Ionicons name="notifications-outline" size={24} color={CommunityColors.primary} />
                    {unreadCount > 0 && (
                      <Animated.View style={[styles.notificationBadge, badgeAnimatedStyle]}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </Animated.View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Chat List */}
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={navigateToChatList}
                  accessibilityLabel="Messages"
                  accessibilityRole="button"
                >
                  <View style={styles.headerIconGradient}>
                    <Ionicons name="chatbubbles-outline" size={24} color={CommunityColors.secondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            {renderSearchBar()}

            {/* Quick Actions */}
            {renderQuickActions()}

            {/* Profile Section */}
            {renderProfileSection()}

            {/* Online Users Strip */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.onlineContainer}
            >
              <TouchableOpacity 
                style={styles.createRoomButton}
                accessibilityLabel="Create chat room"
                accessibilityRole="button"
              >
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
                    accessibilityLabel={`${user.displayName} is online`}
                    accessibilityRole="button"
                  >
                    <View style={styles.onlineAvatarContainer}>
                      <AvatarImage uri={user.avatar} size={40} />
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
        data={filteredPosts}
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
              <TouchableOpacity accessibilityLabel="See all topics" accessibilityRole="button">
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
                  accessibilityLabel={`${tab} feed`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab }}
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
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={CommunityColors.text.tertiary} />
              <Text style={styles.emptyStateText}>No posts found for "{searchQuery}"</Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.emptyStateAction}>Clear search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={CommunityColors.text.tertiary} />
              <Text style={styles.emptyStateText}>
                {activeTab === 'trending' 
                  ? "No posts in your selected topics yet. Join more topics or create a post!"
                  : activeTab === 'following'
                  ? "No posts from people you follow. Start following users!"
                  : "No posts from your area yet."
                }
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('trending')}>
                <Text style={styles.emptyStateAction}>Explore Trending</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          filteredPosts.length > 0 ? (
            <TouchableOpacity style={styles.loadMore} onPress={() => {}} accessibilityLabel="Load more posts" accessibilityRole="button">
              <Text style={styles.loadMoreText}>Load more posts</Text>
              <Ionicons name="chevron-down" size={20} color={CommunityColors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Floating Create Post Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost', {})}
        accessibilityLabel="Create new post"
        accessibilityRole="button"
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
    marginBottom: CommunitySpacing.sm,
  },
  headerTitleSection: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
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
    top: 6,
    right: 6,
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
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Search Bar Styles
  searchContainer: {
    marginBottom: CommunitySpacing.md,
  },
  searchBlur: {
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    gap: CommunitySpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: CommunityColors.text.primary,
    fontWeight: '500',
    paddingVertical: 4,
  },

  // Quick Actions
  quickActionsContainer: {
    paddingBottom: CommunitySpacing.md,
    gap: CommunitySpacing.sm,
  },
  quickActionPill: {
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    marginRight: CommunitySpacing.sm,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionPillSecondary: {
    backgroundColor: CommunityColors.background.elevated,
    borderWidth: 1,
    borderColor: CommunityColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  quickActionTextSecondary: {
    color: CommunityColors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Profile Section Styles
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
    fontSize: 52,
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
    fontSize: 19,
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

  // Online Users Styles
  onlineContainer: {
    paddingVertical: CommunitySpacing.sm,
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
    fontSize: 40,
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

  // Sticky Header Styles
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
    fontSize: 22,
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

  // Content Styles
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
    fontSize: 38,
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

  // Tab Styles
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

  // Post Styles
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
    fontSize: 42,
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
    padding: 6,
    borderRadius: 10,
  },
  actionActive: {
    backgroundColor: CommunityColors.primary + '08',
  },
  actionText: {
    fontSize: 13,
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: CommunitySpacing.xl * 2,
    paddingHorizontal: CommunitySpacing.lg,
  },
  emptyStateText: {
    fontSize: 16,
    color: CommunityColors.text.secondary,
    fontWeight: '600',
    marginTop: CommunitySpacing.md,
    textAlign: 'center',
  },
  emptyStateAction: {
    fontSize: 15,
    color: CommunityColors.primary,
    fontWeight: '700',
    marginTop: CommunitySpacing.sm,
  },
  
  // FAB
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