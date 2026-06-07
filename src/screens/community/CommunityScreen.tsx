// src/screens/community/CommunityScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Image,
  StatusBar,
  Share,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withTiming,
  withSpring,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, Comment } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import {
  CommunityColors,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CommunityScreenProps = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const TOPIC_FILTERS = [
  { id: 'all', label: 'All', icon: 'apps', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { id: 'topic_1', label: 'Potty', icon: 'water', color: '#4facfe', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'topic_2', label: 'Sleep', icon: 'moon', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'topic_3', label: 'Feeding', icon: 'nutrition', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { id: 'topic_5', label: 'Health', icon: 'medical', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'] },
  { id: 'topic_6', label: 'Hacks', icon: 'bulb', color: '#f093fb', gradient: ['#f093fb', '#f5576c'] },
  { id: 'topic_9', label: 'Tantrums', icon: 'flash', color: '#ff9a56', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'topic_10', label: 'Education', icon: 'school', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
  { id: 'topic_4', label: 'Milestones', icon: 'trophy', color: '#feca57', gradient: ['#feca57', '#ff9ff3'] },
  { id: 'topic_8', label: 'Balance', icon: 'briefcase', color: '#54a0ff', gradient: ['#54a0ff', '#5f27cd'] },
];

const QUICK_ACTIONS = [
  { id: 'messages', label: 'Messages', icon: 'chatbubble-ellipses', color: '#667eea', screen: 'ChatList' as const },
  { id: 'notifications', label: 'Alerts', icon: 'notifications', color: '#fc5c7d', screen: 'Notifications' as const },
  { id: 'profile', label: 'Profile', icon: 'person', color: '#43e97b', screen: 'EditCommunityProfile' as const },
  { id: 'topics', label: 'Topics', icon: 'grid', color: '#fa709a', screen: 'Topic' as const },
];

// ─── TrendingPill Component ───────────────────────────────────────

const TrendingPill = ({ topic, onPress, index, isActive }: { 
  topic: typeof TOPIC_FILTERS[0]; 
  onPress: () => void; 
  index: number; 
  isActive?: boolean 
}) => (
  <Animated.View entering={FadeInRight.delay(index * 40).duration(300)}>
    <TouchableOpacity
      style={[
        styles.trendingPill, 
        { backgroundColor: isActive ? topic.color + '25' : topic.color + '10' },
        isActive && { borderColor: topic.color + '50', borderWidth: 1.5 }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={topic.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.trendingIconContainer}
      >
        <Ionicons name={topic.icon as any} size={14} color="#fff" />
      </LinearGradient>
      <Text style={[styles.trendingPillText, { color: isActive ? topic.color : CommunityColors.text.secondary }]}>
        {topic.label}
      </Text>
      {isActive && (
        <View style={[styles.activeDot, { backgroundColor: topic.color }]} />
      )}
    </TouchableOpacity>
  </Animated.View>
);

// ─── QuickActionButton Component ──────────────────────────────────

const QuickActionButton = ({ 
  action, 
  onPress, 
  index, 
  unreadCount = 0 
}: { 
  action: typeof QUICK_ACTIONS[0]; 
  onPress: () => void; 
  index: number;
  unreadCount?: number;
}) => (
  <Animated.View entering={FadeInUp.delay(index * 60).duration(400)} style={styles.quickActionWrapper}>
    <TouchableOpacity style={styles.quickActionBtn} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[action.color, action.color + 'cc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionGradient}
      >
        <Ionicons name={action.icon as any} size={22} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
    <Text style={styles.quickActionLabel}>{action.label}</Text>
  </Animated.View>
);

// ─── CommentItem Component ────────────────────────────────────────

const CommentItem = ({
  comment,
  postId,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  onLike: (postId: string, commentId: string) => void;
  onReply: (postId: string, commentId: string) => void;
  depth?: number;
}) => {
  const [showReplies, setShowReplies] = useState(false);

  return (
    <View style={[styles.commentItem, depth > 0 && styles.commentReply]}>
      <SafeAvatar
        avatar={comment.author.avatar}
        size={30}
        fallbackIcon="person"
        fallbackColor={CommunityColors.primary}
        fallbackBgColor={CommunityColors.background.elevated}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
            <Text style={styles.commentTime}>{comment.time}</Text>
          </View>
          <Text style={styles.commentText}>{comment.content}</Text>
        </View>
        <View style={styles.commentActions}>
          <TouchableOpacity 
            onPress={() => onLike(postId, comment.id)}
            style={styles.commentActionBtn}
          >
            <Ionicons 
              name={comment.isLiked ? 'heart' : 'heart-outline'} 
              size={13} 
              color={comment.isLiked ? CommunityColors.error : CommunityColors.text.tertiary} 
            />
            <Text style={[styles.commentAction, comment.isLiked && styles.commentActionActive]}>
              {comment.likes > 0 ? comment.likes : 'Like'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => onReply(postId, comment.id)}
            style={styles.commentActionBtn}
          >
            <Ionicons name="chatbubble-outline" size={13} color={CommunityColors.text.tertiary} />
            <Text style={styles.commentAction}>Reply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentActionBtn}>
            <Ionicons name="thumbs-up-outline" size={13} color={CommunityColors.text.tertiary} />
            <Text style={styles.commentAction}>{comment.helpfulVotes > 0 ? `${comment.helpfulVotes} Helpful` : 'Helpful'}</Text>
          </TouchableOpacity>
        </View>

        {comment.replies && comment.replies.length > 0 && (
          <View>
            <TouchableOpacity 
              onPress={() => setShowReplies(!showReplies)}
              style={styles.viewRepliesBtn}
            >
              <View style={styles.viewRepliesInner}>
                <Text style={[styles.viewReplies, { color: showReplies ? CommunityColors.text.secondary : '#667eea' }]}>
                  {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                </Text>
                <Ionicons 
                  name={showReplies ? 'chevron-up' : 'chevron-down'} 
                  size={12} 
                  color={showReplies ? CommunityColors.text.secondary : '#667eea'} 
                />
              </View>
            </TouchableOpacity>
            {showReplies &&
              comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  onLike={onLike}
                  onReply={onReply}
                  depth={depth + 1}
                />
              ))}
          </View>
        )}
      </View>
    </View>
  );
};

// ─── FloatingActionButton Component ───────────────────────────────

const FloatingActionButton = ({ onPress, scrollY }: { onPress: () => void; scrollY: Animated.SharedValue<number> }) => {
  const fabStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 100, 500],
      [0, 10, 80],
      Extrapolate.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [0, 50, 100],
      [1, 0.95, 0.9],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 300, 400],
      [1, 1, 0],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.fabContainer, fabStyle]}>
      <TouchableOpacity 
        style={styles.fabButton} 
        onPress={onPress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── PopularPostCard Component ───────────────────────────────────

const PopularPostCard = ({ post, index, onPress }: { post: Post; index: number; onPress: () => void }) => (
  <Animated.View entering={FadeInRight.delay(index * 100).duration(400)}>
    <TouchableOpacity style={styles.popularCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[post.topicId === 'topic_6' ? '#667eea15' : '#fc5c7d15', '#fff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.popularGradient}
      >
        <View style={styles.popularHeader}>
          <SafeAvatar
            avatar={post.author.avatar}
            size={28}
            fallbackIcon="person"
            fallbackColor="#667eea"
            fallbackBgColor="#667eea15"
          />
          <View style={styles.popularMeta}>
            <Text style={styles.popularAuthor} numberOfLines={1}>{post.author.displayName}</Text>
            <Text style={styles.popularTopic}>{post.topic}</Text>
          </View>
        </View>
        <Text style={styles.popularContent} numberOfLines={2}>{post.content}</Text>
        <View style={styles.popularStats}>
          <View style={styles.popularStat}>
            <Ionicons name="heart" size={12} color="#fc5c7d" />
            <Text style={styles.popularStatText}>{post.likes}</Text>
          </View>
          <View style={styles.popularStat}>
            <Ionicons name="repeat" size={12} color="#43e97b" />
            <Text style={styles.popularStatText}>{post.reposts}</Text>
          </View>
          <View style={styles.popularStat}>
            <Ionicons name="eye" size={12} color="#667eea" />
            <Text style={styles.popularStatText}>{post.viewCount}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
);

// ─── Main CommunityScreen Component ───────────────────────────────

export default function CommunityScreen({ navigation }: CommunityScreenProps) {
  const {
    posts,
    topics,
    currentUser,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    deletePost,
    addComment,
    likeComment,
    replyToComment,
    voteHelpful,
    followUser,
    unfollowUser,
    isFollowing,
    refreshFeed,
    loadMorePosts,
    getFeedPosts,
    getUnreadCount,
    checkOnboardingStatus,
    getPopularPosts,
    incrementViewCount,
    isAuthenticated,
  } = useCommunity();

  const { profile } = useUser();
  const { isAuthenticated: authIsAuthenticated } = useAuth();
  const { triggerHaptic } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showPopularSection, setShowPopularSection] = useState(true);

  const scrollY = useSharedValue(0);
  const listRef = useRef<any>(null);
  const searchAnim = useSharedValue(0);

  const unreadCount = getUnreadCount();
  const popularPosts = useMemo(() => getPopularPosts(5), [posts]);

  // Check if user is properly authenticated for community actions
  const canInteract = useMemo(() => {
    return isAuthenticated() || authIsAuthenticated;
  }, [isAuthenticated, authIsAuthenticated]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await checkOnboardingStatus();
      setNeedsOnboarding(!completed && !currentUser);
    };
    checkOnboarding();
  }, [checkOnboardingStatus, currentUser]);

  // ─── DEFINITIVE SCROLL GLITCH FIX ─────────────────────────────
  // UI-thread scroll handler — eliminates JS/UI thread sync issues
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  }, []);

  // Sync React state from shared value via rAF loop — decoupled from scroll events
  useEffect(() => {
    let animationFrame: number;
    let lastCollapsed: boolean | null = null;

    const checkCollapse = () => {
      const isCollapsed = scrollY.value > 80;
      if (isCollapsed !== lastCollapsed) {
        lastCollapsed = isCollapsed;
        setHeaderCollapsed(isCollapsed);
      }
      animationFrame = requestAnimationFrame(checkCollapse);
    };

    animationFrame = requestAnimationFrame(checkCollapse);
    return () => cancelAnimationFrame(animationFrame);
  }, []);
  // ───────────────────────────────────────────────────────────────

  const feedPosts = useMemo(() => {
    let filtered = getFeedPosts();

    if (activeTopic !== 'all') {
      filtered = filtered.filter((p) => p.topicId === activeTopic);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.author.displayName.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [posts, activeTopic, searchQuery, getFeedPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await refreshFeed();
    setRefreshing(false);
  }, [refreshFeed, triggerHaptic]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await loadMorePosts();
    setLoadingMore(false);
  }, [loadMorePosts, loadingMore]);

  const handleLike = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to like posts', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
      ]);
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    if (post.isLiked) {
      await unlikePost(postId);
    } else {
      await likePost(postId);
    }
  };

  const handleRepost = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to repost', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
      ]);
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    if (post.isReposted) {
      await unrepostPost(postId);
    } else {
      await repostPost(postId);
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to bookmark', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
      ]);
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
      ]
    );
  };

  const handleCommentSubmit = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to comment', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
      ]);
      return;
    }
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    triggerHaptic('light');
    if (replyingTo && replyingTo.postId === postId) {
      await replyToComment(postId, replyingTo.commentId, content);
      setReplyingTo(null);
    } else {
      await addComment(postId, content);
    }
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleFollowToggle = async (userId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to follow users', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
      ]);
      return;
    }
    if (isFollowing(userId)) {
      await unfollowUser(userId);
    } else {
      await followUser(userId);
    }
  };

  const toggleSearch = () => {
    const newShow = !showSearch;
    setShowSearch(newShow);
    searchAnim.value = withTiming(newShow ? 1 : 0, { duration: 250 });
    if (!newShow) setSearchQuery('');
  };

  // ─── FIXED: Collapsed header animation with pointerEvents control
  const collapsedHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [60, 140],
      [0, 1],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [60, 140],
      [-20, 0],
      Extrapolate.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const searchBarStyle = useAnimatedStyle(() => {
    const height = interpolate(
      searchAnim.value,
      [0, 1],
      [0, 52],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(
      searchAnim.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolate.CLAMP
    );
    return { height, opacity, overflow: 'hidden' };
  });

  // ─── Render Methods ─────────────────────────────────────────────

  const renderOnboardingBanner = () => {
    if (!needsOnboarding) return null;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.onboardingBanner}>
        <LinearGradient
          colors={['#667eea15', '#764ba215']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.onboardingGradient}
        >
          <View style={styles.onboardingContent}>
            <View style={styles.onboardingIcon}>
              <Ionicons name="people-circle" size={40} color="#667eea" />
            </View>
            <View style={styles.onboardingTextContainer}>
              <Text style={styles.onboardingTitle}>Welcome to LittleLoom Community!</Text>
              <Text style={styles.onboardingSubtext}>
                Join topics, connect with parents, and share your journey.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingActions}>
            <TouchableOpacity 
              style={styles.onboardingPrimaryBtn}
              onPress={() => navigation.navigate('Topic', { topicId: 'topic_6' })}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.onboardingPrimaryGradient}
              >
                <Text style={styles.onboardingPrimaryText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.onboardingSecondaryBtn}
              onPress={() => setNeedsOnboarding(false)}
            >
              <Text style={styles.onboardingSecondaryText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderPopularSection = () => {
    if (!showPopularSection || popularPosts.length === 0) return null;

    return (
      <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.popularSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-up" size={18} color="#fc5c7d" />
            <Text style={styles.sectionTitle}>Popular Now</Text>
          </View>
          <TouchableOpacity onPress={() => setShowPopularSection(false)}>
            <Ionicons name="close" size={18} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularScroll}
        >
          {popularPosts.map((post, index) => (
            <PopularPostCard
              key={post.id}
              post={post}
              index={index}
              onPress={() => {
                incrementViewCount(post.id);
                navigation.navigate('PostDetail', { postId: post.id });
              }}
            />
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  const renderPost = ({ item, index }: { item: Post; index: number }) => {
    const isExpanded = expandedPostId === item.id;
    const commentInput = commentInputs[item.id] || '';

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(350)}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() =>
                item.authorId === currentUser?.id
                  ? navigation.navigate('EditCommunityProfile')
                  : navigation.navigate('UserProfile', { userId: item.authorId })
              }
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrapper}>
                <SafeAvatar
                  avatar={item.author.avatar}
                  size={42}
                  fallbackIcon="person"
                  fallbackColor={CommunityColors.primary}
                  fallbackBgColor={CommunityColors.background.elevated}
                  borderWidth={2}
                  borderColor={item.author.isVerified ? '#667eea' : CommunityColors.border}
                />
                {item.author.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={9} color="#fff" />
                  </View>
                )}
                {item.author.onlineStatus === 'online' && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              <View style={styles.authorInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {item.isAnonymous ? 'Anonymous Parent' : item.author.displayName}
                  </Text>
                  {item.author.isVerified && (
                    <Ionicons name="checkmark-circle" size={13} color="#667eea" />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <View style={[styles.topicTag, { backgroundColor: (topics.find(t => t.id === item.topicId)?.color || '#667eea') + '12' }]}>
                    <Text style={[styles.topicTagText, { color: topics.find(t => t.id === item.topicId)?.color || '#667eea' }]}>
                      {item.topic}
                    </Text>
                  </View>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.postMeta}>{item.time}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => {
                const isAuthor = item.authorId === currentUser?.id;
                Alert.alert('Post Options', '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Share', onPress: () => handleShare(item) },
                  { text: item.isBookmarked ? 'Remove Bookmark' : 'Bookmark', onPress: () => handleBookmark(item.id) },
                  ...(isAuthor
                    ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => handleDelete(item.id) }]
                    : [
                        { text: isFollowing(item.authorId) ? 'Unfollow' : 'Follow', onPress: () => handleFollowToggle(item.authorId) },
                        { text: 'Report', style: 'destructive' as const, onPress: () => navigation.navigate('Report', { type: 'post', targetId: item.id, targetUserId: item.authorId }) },
                      ]),
                ]);
              }}
            >
              <View style={styles.moreButtonInner}>
                <Ionicons name="ellipsis-horizontal" size={18} color={CommunityColors.text.tertiary} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              incrementViewCount(item.id);
              navigation.navigate('PostDetail', { postId: item.id });
            }}
          >
            <Text style={styles.postContent} numberOfLines={isExpanded ? undefined : 4}>
              {item.content}
            </Text>
            {item.content.length > 160 && !isExpanded && (
              <TouchableOpacity onPress={() => setExpandedPostId(item.id)}>
                <Text style={styles.readMore}>Read more</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {item.images && item.images.length > 0 && (
            <View style={styles.imageContainer}>
              {item.images.length === 1 ? (
                <Image
                  source={{ uri: item.images[0] }}
                  style={styles.postImageSingle}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imageGrid}>
                  {item.images.slice(0, 4).map((img, i) => (
                    <View key={i} style={styles.imageGridItem}>
                      <Image
                        source={{ uri: img }}
                        style={styles.imageGridImage}
                        resizeMode="cover"
                      />
                      {i === 3 && item.images.length > 4 && (
                        <View style={styles.moreImagesOverlay}>
                          <Text style={styles.moreImagesText}>+{item.images.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Popularity Badge */}
          {item.popularityScore > 100 && (
            <View style={styles.popularityBadge}>
              <Ionicons name="flame" size={12} color="#ff6b6b" />
              <Text style={styles.popularityText}>Trending</Text>
            </View>
          )}

          {item.helpfulVotes > 0 && (
            <View style={styles.helpfulBadge}>
              <View style={styles.helpfulBadgeInner}>
                <Ionicons name="thumbs-up" size={13} color="#667eea" />
                <Text style={styles.helpfulText}>{item.helpfulVotes} found this helpful</Text>
              </View>
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, item.isLiked && styles.actionBtnActive]} 
              onPress={() => handleLike(item.id)}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={item.isLiked ? '#fc5c7d' : CommunityColors.text.tertiary}
              />
              <Text style={[styles.actionText, item.isLiked && { color: '#fc5c7d', fontWeight: '700' }]}>
                {item.likes > 0 ? item.likes : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, isExpanded && styles.actionBtnActive]}
              onPress={() => {
                setExpandedPostId(isExpanded ? null : item.id);
                if (!isExpanded) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Ionicons name="chatbubble-outline" size={18} color={isExpanded ? '#667eea' : CommunityColors.text.tertiary} />
              <Text style={[styles.actionText, isExpanded && { color: '#667eea', fontWeight: '700' }]}>
                {item.commentsCount > 0 ? item.commentsCount : 'Comment'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, item.isReposted && styles.actionBtnActive]} 
              onPress={() => handleRepost(item.id)}
            >
              <Ionicons
                name={item.isReposted ? 'repeat' : 'repeat-outline'}
                size={18}
                color={item.isReposted ? '#43e97b' : CommunityColors.text.tertiary}
              />
              <Text style={[styles.actionText, item.isReposted && { color: '#43e97b', fontWeight: '700' }]}>
                {item.reposts > 0 ? item.reposts : 'Repost'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => voteHelpful(item.id)}>
              <Ionicons name="thumbs-up-outline" size={18} color={CommunityColors.text.tertiary} />
              <Text style={styles.actionText}>Helpful</Text>
            </TouchableOpacity>
          </View>

          {isExpanded && (
            <View style={styles.commentsSection}>
              {item.comments.slice(0, 3).map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postId={item.id}
                  onLike={likeComment}
                  onReply={(postId, commentId) => {
                    if (!canInteract) {
                      Alert.alert('Sign In Required', 'Please sign in to reply');
                      return;
                    }
                    setReplyingTo({ postId, commentId });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                />
              ))}
              {item.commentsCount > 3 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                  style={styles.viewAllCommentsBtn}
                >
                  <View style={styles.viewAllCommentsInner}>
                    <Text style={styles.viewAllComments}>
                      View all {item.commentsCount} comments
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color="#667eea" />
                  </View>
                </TouchableOpacity>
              )}

              <View style={styles.commentInputContainer}>
                <SafeAvatar
                  avatar={currentUser?.avatar || profile?.avatar}
                  size={32}
                  fallbackIcon="person"
                  fallbackColor={CommunityColors.primary}
                  fallbackBgColor={CommunityColors.background.elevated}
                />
                <View style={styles.commentInputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder={replyingTo?.postId === item.id ? 'Write a reply...' : 'Add a comment...'}
                    placeholderTextColor={CommunityColors.text.tertiary}
                    value={commentInput}
                    onChangeText={(text) =>
                      setCommentInputs((prev) => ({ ...prev, [item.id]: text }))
                    }
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !commentInput.trim() && styles.sendBtnDisabled]}
                    onPress={() => handleCommentSubmit(item.id)}
                    disabled={!commentInput.trim()}
                  >
                    <LinearGradient
                      colors={commentInput.trim() ? ['#667eea', '#764ba2'] : ['#e0e0e0', '#e0e0e0']}
                      style={styles.sendBtnGradient}
                    >
                      <Ionicons name="arrow-up" size={14} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              {replyingTo?.postId === item.id && (
                <TouchableOpacity 
                  onPress={() => setReplyingTo(null)}
                  style={styles.cancelReplyBtn}
                >
                  <Text style={styles.cancelReplyText}>Cancel reply</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View>
      {renderOnboardingBanner()}

      {/* Welcome Banner */}
      <Animated.View entering={FadeInUp.duration(500)} style={styles.welcomeBanner}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeGradient}
        >
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeGreeting}>
                {currentUser ? `Welcome back, ${currentUser.displayName.split(' ')[0]}!` : 'Welcome to LittleLoom'}
              </Text>
              <Text style={styles.welcomeSubtext}>
                Connect with parents, share experiences, and grow together.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.welcomeAvatar}
              onPress={() => canInteract ? navigation.navigate('EditCommunityProfile') : navigation.navigate('Auth', { screen: 'SignIn' })}
            >
              <SafeAvatar
                avatar={currentUser?.avatar || profile?.avatar}
                size={46}
                fallbackIcon="person"
                fallbackColor="#fff"
                fallbackBgColor="rgba(255,255,255,0.25)"
                borderWidth={2.5}
                borderColor="rgba(255,255,255,0.6)"
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentUser?.stats?.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentUser?.stats?.followers || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentUser?.stats?.following || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        {QUICK_ACTIONS.map((action, index) => (
          <QuickActionButton
            key={action.id}
            action={action}
            index={index}
            unreadCount={action.id === 'notifications' ? unreadCount : 0}
            onPress={() => {
              triggerHaptic('light');
              if (!canInteract && action.id !== 'topics') {
                Alert.alert('Sign In Required', 'Please sign in to access this feature', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
                ]);
                return;
              }
              if (action.id === 'profile') {
                navigation.navigate('EditCommunityProfile');
              } else if (action.id === 'topics') {
                navigation.navigate('Topic', { topicId: 'topic_6' });
              } else {
                navigation.navigate(action.screen as any);
              }
            }}
          />
        ))}
      </View>

      {/* Popular Posts Section */}
      {renderPopularSection()}

      {/* Trending Topics */}
      <View style={styles.trendingSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Topics</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Topic', { topicId: 'topic_6' })}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingScroll}>
          {TOPIC_FILTERS.slice(1).map((topic, index) => (
            <TrendingPill
              key={topic.id}
              topic={topic}
              index={index}
              isActive={activeTopic === topic.id}
              onPress={() => setActiveTopic(activeTopic === topic.id ? 'all' : topic.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Active Filter Bar */}
      {activeTopic !== 'all' && (
        <Animated.View entering={FadeIn} style={styles.activeFilterBar}>
          <View style={styles.activeFilterContent}>
            <Ionicons name="filter" size={14} color="#667eea" />
            <Text style={styles.activeFilterText}>
              Filtering by {TOPIC_FILTERS.find(t => t.id === activeTopic)?.label}
            </Text>
            <TouchableOpacity 
              onPress={() => setActiveTopic('all')}
              style={styles.clearFilterBtn}
            >
              <Ionicons name="close-circle" size={16} color="#667eea" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient 
        colors={['#f8f9ff', '#fff5f8', '#f0fff4']} 
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Collapsed Header */}
      <Animated.View 
        style={[styles.collapsedHeader, collapsedHeaderStyle]} 
        pointerEvents={headerCollapsed ? 'auto' : 'none'}
      >
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="light" />
        <View style={styles.collapsedHeaderContent}>
          <View style={styles.collapsedHeaderLeft}>
            <Text style={styles.collapsedTitle}>Community</Text>
            {unreadCount > 0 && (
              <View style={styles.collapsedBadge}>
                <Text style={styles.collapsedBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.collapsedHeaderActions}>
            <TouchableOpacity
              style={styles.collapsedBtn}
              onPress={toggleSearch}
            >
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={CommunityColors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.collapsedBtn}
              onPress={() => {
                if (!canInteract) {
                  Alert.alert('Sign In Required', 'Please sign in to view notifications');
                  return;
                }
                navigation.navigate('Notifications');
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={CommunityColors.text.primary} />
              {unreadCount > 0 && <View style={styles.collapsedDotBadge} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.collapsedCreateBtn}
              onPress={() => {
                if (!canInteract) {
                  Alert.alert('Sign In Required', 'Please sign in to create posts');
                  return;
                }
                navigation.navigate('CreatePost');
              }}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.collapsedCreateGradient}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={searchBarStyle}>
          <View style={styles.collapsedSearchContainer}>
            <View style={styles.collapsedSearchWrapper}>
              <Ionicons name="search" size={15} color={CommunityColors.text.tertiary} />
              <TextInput
                style={styles.collapsedSearchInput}
                placeholder="Search posts, topics, parents..."
                placeholderTextColor={CommunityColors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={showSearch}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color={CommunityColors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Main Feed */}
      <Animated.FlatList
        ref={listRef}
        data={feedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={1}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={['#667eea15', '#764ba215']}
                style={styles.emptyIconGradient}
              >
                <Ionicons name="chatbubbles-outline" size={44} color="#667eea" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>
              Be the first to share your parenting journey with the community!
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                if (!canInteract) {
                  Alert.alert('Sign In Required', 'Please sign in to create posts');
                  return;
                }
                navigation.navigate('CreatePost');
              }}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.emptyBtnGradient}
              >
                <Text style={styles.emptyBtnText}>Create Your First Post</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMore}>
              <Text style={styles.loadMoreText}>Loading more...</Text>
            </View>
          ) : null
        }
      />

      <FloatingActionButton 
        scrollY={scrollY} 
        onPress={() => {
          if (!canInteract) {
            Alert.alert('Sign In Required', 'Please sign in to create posts', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'SignIn' }) },
            ]);
            return;
          }
          navigation.navigate('CreatePost');
        }} 
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    zIndex: 999,
    elevation: 8,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    ...CommunityShadows.large,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  collapsedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 5,
    paddingTop: Platform.OS === 'ios' ? 50 : 44,
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  collapsedHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    letterSpacing: -0.5,
  },
  collapsedBadge: {
    backgroundColor: '#fc5c7d',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  collapsedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  collapsedHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  collapsedBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CommunityColors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedCreateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  collapsedCreateGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedDotBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fc5c7d',
    borderWidth: 2,
    borderColor: '#fff',
  },
  collapsedSearchContainer: {
    marginTop: CommunitySpacing.sm,
  },
  collapsedSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    gap: CommunitySpacing.sm,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  collapsedSearchInput: {
    flex: 1,
    fontSize: 14,
    color: CommunityColors.text.primary,
    paddingVertical: 2,
  },
  
  listContainer: {
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.xxl,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
  },
  
  onboardingBanner: {
    marginTop: Platform.OS === 'ios' ? 52 : 46,
    marginBottom: CommunitySpacing.md,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.small,
  },
  onboardingGradient: {
    padding: CommunitySpacing.lg,
    borderWidth: 1,
    borderColor: '#667eea20',
  },
  onboardingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.md,
    marginBottom: CommunitySpacing.md,
  },
  onboardingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingTextContainer: {
    flex: 1,
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 4,
  },
  onboardingSubtext: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
    lineHeight: 18,
  },
  onboardingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.md,
  },
  onboardingPrimaryBtn: {
    borderRadius: CommunityBorderRadius.full,
    overflow: 'hidden',
    flex: 1,
  },
  onboardingPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    paddingVertical: CommunitySpacing.sm,
    gap: 6,
  },
  onboardingPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  onboardingSecondaryBtn: {
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
  },
  onboardingSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },

  welcomeBanner: {
    marginTop: Platform.OS === 'ios' ? 52 : 46,
    marginBottom: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  welcomeGradient: {
    padding: CommunitySpacing.lg,
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: CommunitySpacing.md,
  },
  welcomeTextContainer: {
    flex: 1,
    marginRight: CommunitySpacing.md,
  },
  welcomeGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  welcomeAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: CommunityBorderRadius.lg,
    paddingVertical: CommunitySpacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CommunitySpacing.lg,
    paddingHorizontal: CommunitySpacing.xs,
  },
  quickActionWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    overflow: 'hidden',
    ...CommunityShadows.small,
  },
   quickActionGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },
  unreadBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#fc5c7d',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 3,
  },
  
  // ─── Popular Section Styles ─────────────────────────────────────
  popularSection: {
    marginBottom: CommunitySpacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  popularScroll: {
    paddingLeft: CommunitySpacing.xs,
    paddingRight: CommunitySpacing.md,
    gap: 12,
  },
  popularCard: {
    width: 280,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.medium,
    marginRight: 12,
  },
  popularGradient: {
    padding: CommunitySpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  popularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: CommunitySpacing.sm,
  },
  popularMeta: {
    flex: 1,
  },
  popularAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  popularTopic: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    marginTop: 2,
  },
  popularContent: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    lineHeight: 20,
    marginBottom: CommunitySpacing.sm,
  },
  popularStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  popularStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },
  
  // ─── Trending Section Styles ────────────────────────────────────
  trendingSection: {
    marginBottom: CommunitySpacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.xs,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  trendingScroll: {
    marginLeft: -CommunitySpacing.xs,
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    marginRight: CommunitySpacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trendingIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  activeFilterBar: {
    marginBottom: CommunitySpacing.md,
  },
  activeFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#667eea10',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    alignSelf: 'flex-start',
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  clearFilterBtn: {
    marginLeft: 4,
  },
  
  // ─── Post Card Styles ───────────────────────────────────────────
  postCard: {
    backgroundColor: '#fff',
    borderRadius: CommunityBorderRadius.xl,
    padding: CommunitySpacing.md,
    marginBottom: CommunitySpacing.md,
    ...CommunityShadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: CommunitySpacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#667eea',
    borderRadius: 7,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#43e97b',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  authorInfo: {
    marginLeft: CommunitySpacing.sm,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    maxWidth: 200,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  topicTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topicTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dotSeparator: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  postMeta: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  moreButton: {
    padding: CommunitySpacing.xs,
  },
  moreButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CommunityColors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postContent: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    lineHeight: 22,
    marginBottom: CommunitySpacing.sm,
    letterSpacing: 0.1,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: CommunitySpacing.sm,
  },
  
  // ─── Image Styles ───────────────────────────────────────────────
  imageContainer: {
    marginBottom: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  postImageSingle: {
    width: '100%',
    height: 220,
    borderRadius: CommunityBorderRadius.lg,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  imageGridItem: {
    width: (SCREEN_WIDTH - CommunitySpacing.md * 2 - 40 - 4) / 2,
    height: (SCREEN_WIDTH - CommunitySpacing.md * 2 - 40 - 4) / 2,
    borderRadius: CommunityBorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  imageGridImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  
  // ─── Popularity Badge ───────────────────────────────────────────
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ff6b6b15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: CommunityBorderRadius.full,
    marginBottom: CommunitySpacing.sm,
  },
  popularityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b6b',
  },
  
  // ─── Helpful Badge ──────────────────────────────────────────────
  helpfulBadge: {
    marginBottom: CommunitySpacing.sm,
    alignSelf: 'flex-start',
  },
  helpfulBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: '#667eea12',
  },
  helpfulText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '700',
  },
  
  // ─── Post Actions ───────────────────────────────────────────────
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: CommunitySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },
  
  // ─── Comments Section ───────────────────────────────────────────
  commentsSection: {
    marginTop: CommunitySpacing.sm,
    paddingTop: CommunitySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: CommunitySpacing.sm,
  },
  commentReply: {
    marginLeft: CommunitySpacing.xl,
  },
  commentContent: {
    flex: 1,
    marginLeft: CommunitySpacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentBubble: {
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.lg,
    padding: CommunitySpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  commentTime: {
    fontSize: 11,
    color: CommunityColors.text.tertiary,
  },
  commentText: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.md,
    marginTop: 6,
    marginLeft: CommunitySpacing.sm,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentAction: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },
  commentActionActive: {
    color: CommunityColors.error,
    fontWeight: '700',
  },
  viewRepliesBtn: {
    marginLeft: CommunitySpacing.sm,
    marginBottom: CommunitySpacing.sm,
    alignSelf: 'flex-start',
  },
  viewRepliesInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: '#667eea10',
  },
  viewReplies: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllCommentsBtn: {
    marginVertical: CommunitySpacing.sm,
  },
  viewAllCommentsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.lg,
    backgroundColor: '#667eea08',
  },
  viewAllComments: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
  },
  
  // ─── Comment Input ──────────────────────────────────────────────
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
    marginTop: CommunitySpacing.sm,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.xs,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: CommunityColors.text.primary,
    maxHeight: 80,
    paddingVertical: 4,
  },
  sendBtn: {
    marginLeft: CommunitySpacing.xs,
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelReplyBtn: {
    marginLeft: 40,
    marginTop: 4,
  },
  cancelReplyText: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    fontWeight: '600',
  },
  
  // ─── Empty State ────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CommunitySpacing.xxl,
    marginTop: CommunitySpacing.xl,
  },
  emptyIconContainer: {
    marginBottom: CommunitySpacing.md,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.sm,
    textAlign: 'center',
    paddingHorizontal: CommunitySpacing.xl,
    lineHeight: 20,
  },
  emptyBtn: {
     marginTop: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.full,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.xl,
    paddingVertical: CommunitySpacing.md,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  
  // ─── Load More ──────────────────────────────────────────────────
  loadMore: {
    paddingVertical: CommunitySpacing.lg,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
  },
});