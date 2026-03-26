// src/screens/community/CommunityScreen.tsx
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
import { useCommunity, Post, Topic, CommunityUser } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import type { CommunityStackParamList } from '../../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CommunityNavigationProp = NativeStackNavigationProp<CommunityStackParamList>;

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 320;
const PROFILE_SECTION_HEIGHT = 180;

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
  } = useCommunity();
  const { getDisplayName } = useUser();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'following' | 'nearby'>('trending');
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  // Animated header styles
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - 100],
      [0, -HEADER_HEIGHT + 100],
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - 150],
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
      [HEADER_HEIGHT - 150, HEADER_HEIGHT - 100],
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
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleRepost = async (post: Post) => {
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
  };

  const handleBookmark = async (post: Post) => {
    await bookmarkPost(post.id);
  };

  const navigateToUserProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId === currentUser?.id) {
      navigation.navigate('UserProfile', { userId });
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };

  const navigateToPostDetail = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const navigateToTopic = (topic: Topic) => {
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

  const renderTopicCard = ({ item }: { item: Topic }) => (
    <TouchableOpacity 
      style={styles.topicCard}
      onPress={() => navigateToTopic(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[item.color + '40', item.color + '20']}
        style={styles.topicGradient}
      >
        <View style={styles.topicHeader}>
          <Text style={styles.topicEmoji}>{item.emoji}</Text>
          {item.trending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingText}>🔥</Text>
            </View>
          )}
        </View>
        <Text style={styles.topicName}>{item.name}</Text>
        <View style={styles.topicStats}>
          <Text style={styles.topicStat}>{item.members.toLocaleString()} members</Text>
          <Text style={styles.topicDot}>•</Text>
          <Text style={styles.topicStat}>{item.posts.toLocaleString()} posts</Text>
        </View>
        {item.isJoined && (
          <View style={styles.joinedIndicator}>
            <Ionicons name="checkmark-circle" size={16} color={item.color} />
            <Text style={[styles.joinedText, { color: item.color }]}>Joined</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <Animated.View entering={FadeInUp}>
      <BlurView intensity={80} style={styles.postCard} tint="light">
        {/* Post Header */}
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => navigateToUserProfile(item.authorId)}
          activeOpacity={0.8}
        >
          <View style={styles.authorInfo}>
            <Text style={styles.authorAvatar}>{item.author.avatar}</Text>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.authorName}>{item.author.displayName}</Text>
                {item.author.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#667eea" />
                )}
                {item.author.onlineStatus === 'online' && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              <Text style={styles.postMeta}>
                in {item.topic} • {item.time}
                {item.author.country && ` • ${item.author.country}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => {
              // Show post options
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Post Content */}
        <TouchableOpacity 
          onPress={() => navigateToPostDetail(item.id)}
          activeOpacity={0.9}
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
            <Ionicons name="thumbs-up" size={14} color="#11998e" />
            <Text style={styles.helpfulText}>{item.helpfulVotes} found this helpful</Text>
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={[styles.actionButton, item.isLiked && styles.actionActive]}
            onPress={() => handleLike(item)}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={22} 
              color={item.isLiked ? "#fc5c7d" : "#666"} 
            />
            <Text style={[styles.actionText, item.isLiked && styles.actionTextActive]}>
              {item.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToPostDetail(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.actionText}>{item.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, item.isReposted && styles.actionActive]}
            onPress={() => handleRepost(item)}
          >
            <Ionicons 
              name={item.isReposted ? "repeat" : "repeat-outline"} 
              size={20} 
              color={item.isReposted ? "#11998e" : "#666"} 
            />
            <Text style={[styles.actionText, item.isReposted && styles.actionTextActive]}>
              {item.reposts}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleBookmark(item)}
          >
            <Ionicons 
              name={item.isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={item.isBookmarked ? "#667eea" : "#666"} 
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );

  const renderProfileSection = () => {
    if (!currentUser) return null;

    return (
      <Animated.View style={[styles.profileSection, profileCardStyle]}>
        <BlurView intensity={90} style={styles.profileCard} tint="light">
          <View style={styles.profileHeader}>
            <View style={styles.profileLeft}>
              <TouchableOpacity onPress={navigateToEditProfile}>
                <Text style={styles.profileAvatar}>{currentUser.avatar}</Text>
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={12} color="white" />
                </View>
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{currentUser.displayName}</Text>
                <Text style={styles.profileHandle}>{currentUser.handle}</Text>
                <View style={styles.onlineStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#11998e' }]} />
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
              <Ionicons name="create-outline" size={20} color="#667eea" />
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
        </BlurView>
      </Animated.View>
    );
  };

  const renderStickyHeader = () => {
    const unreadCount = getUnreadCount();
    
    return (
      <Animated.View style={[styles.stickyHeader, stickyHeaderStyle, { paddingTop: insets.top }]}>
        <BlurView intensity={95} style={styles.stickyHeaderBlur} tint="light">
          <View style={styles.stickyHeaderContent}>
            <TouchableOpacity onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}>
              <Text style={styles.stickyTitle}>Community</Text>
            </TouchableOpacity>
            <View style={styles.stickyActions}>
              <TouchableOpacity 
                style={styles.stickyIconButton}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color="#667eea" />
                {unreadCount > 0 && (
                  <View style={styles.stickyBadge}>
                    <Text style={styles.stickyBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.stickyIconButton}
                onPress={() => navigateToChat()}
              >
                <Ionicons name="chatbubbles-outline" size={24} color="#667eea" />
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Animated.View>
    );
  };

  const unreadCount = getUnreadCount();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header Background */}
      <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
        <LinearGradient 
          colors={['#667eea', '#764ba2', '#f093fb']} 
          style={[styles.headerGradient, { height: HEADER_HEIGHT }]}
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
                  <BlurView intensity={80} style={styles.iconBlur} tint="light">
                    <Ionicons name="notifications-outline" size={24} color="#667eea" />
                    {unreadCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </BlurView>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => navigateToChat()}
                >
                  <BlurView intensity={80} style={styles.iconBlur} tint="light">
                    <Ionicons name="chatbubbles-outline" size={24} color="#667eea" />
                  </BlurView>
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
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.createRoomGradient}>
                  <Ionicons name="add" size={24} color="white" />
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
                      <View style={[styles.statusDot, { backgroundColor: '#11998e' }]} />
                    </View>
                    <Text style={styles.onlineName}>{user.displayName}</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
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
            <Text style={styles.sectionTitle}>Popular Topics</Text>
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
                        colors={['#667eea', '#764ba2']}
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
            <Ionicons name="chevron-down" size={20} color="#667eea" />
          </TouchableOpacity>
        }
      />

      {/* Floating Create Post Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost', {})}
      >
        <LinearGradient colors={['#fa709a', '#fee140']} style={styles.fabGradient}>
          <Ionicons name="create-outline" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0e7ff',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerGradient: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Profile Section Styles
  profileSection: {
    marginBottom: 20,
  },
  profileCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    fontSize: 56,
    marginRight: 16,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 12,
    backgroundColor: '#667eea',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  profileHandle: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 6,
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
    color: '#11998e',
    fontWeight: '500',
  },
  countryText: {
    fontSize: 13,
    color: '#666',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  bioPreview: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  addBioText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },

  // Online Users Styles
  onlineContainer: {
    paddingVertical: 16,
    gap: 16,
  },
  createRoomButton: {
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 8,
  },
  createRoomGradient: {
    width: 56,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  onlineUser: {
    alignItems: 'center',
    marginRight: 16,
  },
  onlineAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  onlineAvatar: {
    fontSize: 48,
  },
  onlineName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stickyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  stickyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  stickyIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickyBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  stickyBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Content Styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  topicsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  topicCard: {
    width: 160,
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  topicGradient: {
    flex: 1,
    padding: 20,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 6,
  },
  trendingText: {
    fontSize: 12,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicStat: {
    fontSize: 12,
    color: '#666',
  },
  topicDot: {
    marginHorizontal: 6,
    color: '#999',
  },
  joinedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  joinedText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 8,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
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
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    fontSize: 40,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#11998e',
    marginLeft: 4,
  },
  postMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  postImage: {
    width: (width - 88) / 2,
    height: 150,
    borderRadius: 12,
  },
  helpfulContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,153,142,0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  helpfulText: {
    fontSize: 13,
    color: '#11998e',
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  actionActive: {},
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  actionTextActive: {
    color: '#667eea',
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 120,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});