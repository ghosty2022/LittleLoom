// src/screens/community/CommunityScreen.tsx
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  Layout,
  SlideInDown,
  SlideOutUp,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity, INITIAL_TOPICS, TOPIC_CATEGORIES } from '../../context/CommunityContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, Poll, CommunityUser } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';

const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

// ============================================================
// CONSTANTS
// ============================================================
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  
  mood: {
    celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline', glow: '#fbbf24' },
    support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline', glow: '#f472b6' },
    advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline', glow: '#818cf8' },
    milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline', glow: '#34d399' },
    venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline', glow: '#f87171' },
  },
  
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '500' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 17, line: 24, weight: '600' as const },
    xl: { size: 20, line: 28, weight: '700' as const },
    '2xl': { size: 26, line: 34, weight: '800' as const },
  },
  
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'CommunityMemberProfile',
  EDIT_PROFILE: 'CommunityProfile',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',
  TOPICS: 'Topic',
  REPORT: 'Report',
  FOLLOWERS: 'Followers',
  FOLLOWING: 'Following',
  SEARCH_USERS: 'SearchUsers',
  ONBOARDING: 'CommunityOnboarding',
};

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

// ============================================================
// BLURRED IMAGE COMPONENT
// ============================================================
const BlurredImage = React.memo(({ 
  imageUri, 
  isSensitive = false, 
  isDark = false,
}: { 
  imageUri: string; 
  isSensitive?: boolean; 
  isDark?: boolean;
}) => {
  const [revealed, setRevealed] = useState(false);

  if (!imageUri) return null;

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => isSensitive && setRevealed(true)} 
      disabled={!isSensitive || revealed}
      style={styles.blurredImageContainer}
    >
      <Image 
        source={{ uri: imageUri }} 
        style={styles.blurredImage} 
        resizeMode="cover"
        blurRadius={isSensitive && !revealed ? 20 : 0}
      />
      {isSensitive && !revealed && (
        <BlurView 
          intensity={80} 
          tint={isDark ? 'dark' : 'light'} 
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.blurOverlay}>
            <View style={[styles.blurIconWrap, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}>
              <Ionicons name="eye-off" size={24} color={isDark ? DS.white : DS.gray700} />
            </View>
            <Text style={[styles.blurText, { color: isDark ? DS.white : DS.gray700 }]}>
              🔞 Sensitive content
            </Text>
            <Text style={[styles.blurSubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Tap to view
            </Text>
          </View>
        </BlurView>
      )}
    </TouchableOpacity>
  );
});

// ============================================================
// SENTIMENT INDICATOR
// ============================================================
const SentimentAnalyzer = {
  analyze: (text: string) => {
    const positiveWords = ['happy', 'joy', 'love', 'great', 'wonderful', 'amazing', 'excellent', 'good', 'beautiful', 'fantastic', 'awesome', 'incredible', 'perfect', 'glad', 'thankful', 'grateful', 'blessed', 'proud', 'exciting', 'milestone', 'achievement', 'success', 'celebrate', 'celebrating'];
    const negativeWords = ['sad', 'upset', 'angry', 'frustrated', 'worried', 'scared', 'tired', 'exhausted', 'overwhelmed', 'stressed', 'anxious', 'depressed', 'struggle', 'difficult', 'hard', 'tough', 'challenging', 'pain', 'cry', 'crying', 'hurt', 'tired', 'sleep deprived'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const score = (positiveCount - negativeCount) / (words.length || 1);
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (score > 0.1) sentiment = 'positive';
    else if (score < -0.1) sentiment = 'negative';
    
    return { sentiment, score, confidence: Math.min(Math.abs(score) * 2 + 0.3, 1) };
  },
  getEmoji: (sentiment: string) => {
    const map: Record<string, string> = { positive: '😊', negative: '😢', neutral: '😐' };
    return map[sentiment] || '😐';
  }
};

// ============================================================
// THREAD SUMMARIZER
// ============================================================
const ThreadSummarizer = {
  summarize: (content: string, maxLength: number = 80) => {
    if (!content || content.length <= maxLength) return content;
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    let summary = sentences.slice(0, 2).join(' ');
    if (summary.length > maxLength) {
      summary = summary.slice(0, maxLength) + '...';
    }
    return summary;
  }
};

// ============================================================
// CATEGORY BADGE COMPONENT
// ============================================================
const CategoryBadge = React.memo(({ categoryId, isDark }: { categoryId?: string; isDark: boolean }) => {
  if (!categoryId) return null;
  
  const category = TOPIC_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return null;
  
  return (
    <View style={[styles.categoryBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      <Text style={styles.categoryBadgeEmoji}>{category.emoji}</Text>
      <Text style={[styles.categoryBadgeText, { color: isDark ? '#a8a29e' : '#57534e' }]}>
        {category.name}
      </Text>
    </View>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CommunityScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  useRouteBasedNavVisibility();

  const community = useCommunity();
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
    incrementViewCount,
    isAuthenticated: checkIsAuth,
    getAllUsers,
    votePoll,
    markAllNotificationsRead,
    getUserById: contextGetUserById,
    sharePost,
    getSelectedTopics,
  } = community;

  const { isAuthenticated: authIsAuth } = useAuth();
  const { triggerHaptic } = useCustomization();
  const { settings } = useCustomization();
  const isDark = settings?.darkMode ?? false;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);
  const userTopics = useMemo(() => getSelectedTopics(), [getSelectedTopics]);
  const hasTopics = useMemo(() => userTopics.length > 0, [userTopics]);

  const postsCount = posts.length;
  const membersCount = allUsers.length;

  const getUserById = useCallback((userId: string) => {
    if (contextGetUserById) return contextGetUserById(userId);
    if (userId === currentUser?.id) return currentUser;
    return allUsers.find(u => u.id === userId);
  }, [contextGetUserById, currentUser, allUsers]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
    setPage(1);
  }, [posts, activeTopic, searchQuery]);

  useEffect(() => {
    if (prevPostsRef.current.length > 0 && posts.length > prevPostsRef.current.length) {
      const count = posts.length - prevPostsRef.current.length;
      setNewPostsCount(count);
      setShowBanner(true);
    }
    prevPostsRef.current = posts;
  }, [posts]);

  // Show topic selector if user has no topics
  useEffect(() => {
    if (!isLoading && !hasTopics && canInteract) {
      const timer = setTimeout(() => {
        sweetAlert.confirm(
          'Personalize Your Feed',
          'Select topics you\'re interested in to see relevant content in your feed.',
          () => navigation.navigate(ROUTES.ONBOARDING as never, { editing: true } as never),
          () => {},
          'Choose Topics',
          'Later'
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasTopics, canInteract, navigation, sweetAlert]);

  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const welcomePost = filtered.find(p => p.authorId === 'littleloom_team');
    if (welcomePost) {
      filtered = filtered.filter(p => p.id !== welcomePost.id);
      filtered.unshift(welcomePost);
    }
    if (activeTopic !== 'all') filtered = filtered.filter(p => p.topicId === activeTopic);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeTopic, searchQuery, getFeedPosts, posts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await refreshFeed();
    setRefreshing(false);
    setPage(1);
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
  }, [refreshFeed, triggerHaptic, getFilteredPosts]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadMorePosts();
    const nextPage = page + 1;
    const filtered = getFilteredPosts();
    const start = page * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const newPosts = filtered.slice(start, end);
    if (newPosts.length > 0) {
      setDisplayedPosts(prev => [...prev, ...newPosts]);
      setPage(nextPage);
      setHasMore(filtered.length > end);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadMorePosts, loadingMore, hasMore, page, getFilteredPosts]);

  const handleLike = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to like threads', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(postId) : await likePost(postId);
  }, [canInteract, posts, triggerHaptic, unlikePost, likePost, sweetAlert]);

  const handleRepost = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reweave', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(postId) : await repostPost(postId);
  }, [canInteract, posts, triggerHaptic, unrepostPost, repostPost, sweetAlert]);

  const handleBookmark = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to bookmark', 'warning');
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  }, [canInteract, triggerHaptic, bookmarkPost, sweetAlert]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on The Loom: "${post.content.substring(0, 100)}..."`,
      });
      if (sharePost) await sharePost(post.id);
    } catch (e) { console.error(e); }
  }, [sharePost]);

  const handleDelete = useCallback((postId: string) => {
    sweetAlert.confirm(
      'Unravel this thread?',
      'This cannot be undone.',
      () => deletePost(postId),
      undefined,
      'Delete',
      'Cancel',
      true
    );
  }, [deletePost, sweetAlert]);

  const handleCommentSubmit = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reply', 'warning');
      return;
    }
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    triggerHaptic('light');
    if (replyingTo?.postId === postId) {
      await replyToComment(postId, replyingTo.commentId, content);
      setReplyingTo(null);
    } else {
      await addComment(postId, content);
    }
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  }, [canInteract, commentInputs, replyingTo, triggerHaptic, replyToComment, addComment, sweetAlert]);

  const handleVotePoll = useCallback(async (postId: string, optionId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to vote', 'warning');
      return;
    }
    await votePoll(postId, optionId);
  }, [canInteract, votePoll, sweetAlert]);

  const handleScrollToNew = useCallback(() => {
    setShowBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(v => (v.item as Post).id));
    setVisiblePostIds(visibleIds);
    viewableItems.forEach(v => incrementViewCount((v.item as Post).id));
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45 }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ============================================================
  // RENDER POST
  // ============================================================
  const renderPost = useCallback(({ item, index }: { item: Post; index: number }) => {
    const topicColor = topics.find(t => t.id === item.topicId)?.color || DS.primary;
    const topicCategory = topics.find(t => t.id === item.topicId)?.category;
    const isOwnPost = item.authorId === currentUser?.id;
    const sentiment = SentimentAnalyzer.analyze(item.content);
    const summary = item.content.length > 100 ? ThreadSummarizer.summarize(item.content) : null;

    return (
      <Animated.View
        entering={FadeInUp.delay(index < 6 ? index * 60 : 0).duration(400).springify()}
        layout={Layout.springify()}
      >
        <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          
          {/* Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => navigation.navigate(
                isOwnPost ? ROUTES.EDIT_PROFILE : ROUTES.USER_PROFILE,
                { userId: item.authorId }
              )}
            >
              <SafeAvatar
                avatar={item.author.avatar}
                size={44}
                fallbackIcon="person"
                fallbackColor={topicColor}
                fallbackBgColor={`${topicColor}15`}
              />
              <View style={styles.authorInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.authorName, { color: isDark ? DS.white : DS.gray900 }]}>
                    {item.isAnonymous ? 'Anonymous Parent' : item.author.displayName}
                  </Text>
                  {item.author.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: topicColor }]}>
                      <Ionicons name="checkmark" size={9} color={DS.white} />
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.handleText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {item.isAnonymous ? '@anonymous' : (item.author?.handle || '')}
                  </Text>
                  <Text style={[styles.dot, { color: isDark ? DS.gray400 : DS.gray500 }]}>·</Text>
                  <Text style={[styles.timeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{item.time || ''}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.moreBtn}
              onPress={() => {
                if (isOwnPost) {
                  sweetAlert.confirm('Delete Post', 'Are you sure?', () => deletePost(item.id));
                } else {
                  sweetAlert.confirm('Report Post', 'Report this content?', () => 
                    navigation.navigate(ROUTES.REPORT, { type: 'post', targetId: item.id, targetUserId: item.authorId })
                  );
                }
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          {/* Sentiment Badge */}
          {sentiment.confidence > 0.3 && (
            <View style={[styles.sentimentWrap, { paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm }]}>
              <Text style={styles.sentimentEmoji}>{SentimentAnalyzer.getEmoji(sentiment.sentiment)}</Text>
              <View style={styles.sentimentBar}>
                <View 
                  style={[
                    styles.sentimentFill, 
                    { 
                      width: `${(sentiment.score + 1) / 2 * 100}%`,
                      backgroundColor: sentiment.sentiment === 'positive' ? DS.success : 
                                     sentiment.sentiment === 'negative' ? DS.danger : DS.gray400,
                    }
                  ]} 
                />
              </View>
              <Text style={[
                styles.sentimentLabel, 
                { 
                  color: sentiment.sentiment === 'positive' ? DS.success : 
                         sentiment.sentiment === 'negative' ? DS.danger : DS.gray400 
                }
              ]}>
                {sentiment.sentiment === 'positive' ? 'Positive' : 
                 sentiment.sentiment === 'negative' ? 'Needs support' : 'Neutral'}
              </Text>
            </View>
          )}

          {/* Mood Badge */}
          {item.mood && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm }}>
              <View style={[styles.moodBadge, { backgroundColor: isDark ? `${DS.mood[item.mood]?.glow}20` : DS.mood[item.mood]?.bg }]}>
                <Ionicons name={DS.mood[item.mood]?.icon as any} size={11} color={DS.mood[item.mood]?.text} />
                <Text style={[styles.moodText, { color: DS.mood[item.mood]?.text }]}>
                  {item.mood.charAt(0).toUpperCase() + item.mood.slice(1)}
                </Text>
              </View>
            </View>
          )}

          {/* Content */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => navigation.navigate(ROUTES.POST_DETAIL, { postId: item.id })}
          >
            <Text 
              style={[styles.postText, { color: isDark ? DS.gray300 : DS.gray700 }]} 
              numberOfLines={expandedPostId === item.id ? undefined : 4}
            >
              {item.content}
            </Text>
            {item.content.length > 220 && expandedPostId !== item.id && (
              <TouchableOpacity onPress={() => setExpandedPostId(item.id)} style={{ paddingHorizontal: DS.space.lg }}>
                <Text style={styles.readMore}>Show more</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* AI Summary */}
          {summary && expandedPostId !== item.id && (
            <View style={[styles.summaryWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : DS.primaryGhost, marginHorizontal: DS.space.lg, marginBottom: DS.space.md }]}>
              <View style={styles.summaryToggle}>
                <Ionicons name="sparkles" size={14} color={DS.primary} />
                <Text style={[styles.summaryToggleText, { color: DS.primary }]}>AI Summary</Text>
              </View>
              <Text style={[styles.summaryText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                {summary}
              </Text>
            </View>
          )}

          {/* Images with blur */}
          {item.images && item.images.length > 0 && (
            <View style={[styles.mediaBox, { marginHorizontal: DS.space.lg, marginBottom: DS.space.md }]}>
              {item.images.length === 1 ? (
                <BlurredImage imageUri={item.images[0]} isSensitive={false} isDark={isDark} />
              ) : (
                <View style={styles.imageGrid}>
                  {item.images.slice(0, 4).map((img, idx) => (
                    <View key={idx} style={[styles.gridItem, item.images!.length === 3 && idx === 0 && styles.gridItemLarge]}>
                      <BlurredImage imageUri={img} isSensitive={false} isDark={isDark} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Poll */}
          {item.poll && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
              <PollWidget poll={item.poll} postId={item.id} onVote={handleVotePoll} isDark={isDark} />
            </View>
          )}

          {/* Topic Tag with Category */}
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.TOPICS, { topicId: item.topicId })}
            activeOpacity={0.8}
            style={[styles.topicTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50, marginHorizontal: DS.space.lg, marginBottom: DS.space.md }]}
          >
            <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.topicTagText, { color: topicColor }]}>{item.topic}</Text>
            {topicCategory && (
              <CategoryBadge categoryId={topicCategory} isDark={isDark} />
            )}
            {item.isTrending && (
              <View style={styles.trendingPill}>
                <Ionicons name="flame" size={10} color={DS.warning} />
                <Text style={styles.trendingText}>Trending</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Engagement Bar */}
          <View style={[styles.engagementBar, { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.sm }]}>
            <Text style={[styles.engagementText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {item.likes > 0 ? `${item.likes} like${item.likes !== 1 ? 's' : ''}` : ''}
              {item.likes > 0 && item.commentsCount > 0 ? ' · ' : ''}
              {item.commentsCount > 0 ? `${item.commentsCount} comment${item.commentsCount !== 1 ? 's' : ''}` : ''}
              {((item.likes > 0 || item.commentsCount > 0) && item.reposts > 0) ? ' · ' : ''}
              {item.reposts > 0 ? `${item.reposts} repost${item.reposts !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>

          {/* Reaction Bar */}
          <View style={[styles.reactionBar, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Pressable onPress={() => handleLike(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={22} color={item.isLiked ? DS.accent : DS.gray400} />
              <Text style={[styles.reactionCount, item.isLiked && { color: DS.accent, fontWeight: '700' }]}>
                {item.likes > 0 ? item.likes : 'Like'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setExpandedPostId(expandedPostId === item.id ? null : item.id)} style={styles.reactionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={DS.gray400} />
              <Text style={styles.reactionCount}>
                {item.commentsCount > 0 ? item.commentsCount : 'Comment'}
              </Text>
            </Pressable>

            <Pressable onPress={() => handleRepost(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isReposted ? 'repeat' : 'repeat-outline'} size={20} color={item.isReposted ? DS.success : DS.gray400} />
              <Text style={[styles.reactionCount, item.isReposted && { color: DS.success, fontWeight: '700' }]}>
                {item.reposts > 0 ? item.reposts : 'Repost'}
              </Text>
            </Pressable>

            <Pressable onPress={() => handleBookmark(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isBookmarked ? DS.primary : DS.gray400} />
            </Pressable>

            <Pressable onPress={() => handleShare(item)} style={styles.reactionBtn}>
              <Ionicons name="share-outline" size={20} color={DS.gray400} />
            </Pressable>
          </View>

          {/* Comments Section */}
          {expandedPostId === item.id && (
            <View style={[styles.commentsBox, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {item.comments.slice(0, 3).map((c) => (
                <View key={c.id} style={styles.inlineComment}>
                  <SafeAvatar avatar={c.author.avatar} size={28} fallbackIcon="person" fallbackColor={DS.primary} fallbackBgColor={`${DS.primary}15`} />
                  <View style={styles.inlineCommentContent}>
                    <View style={[styles.inlineCommentBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                      <Text style={[styles.inlineCommentAuthor, { color: isDark ? DS.white : DS.gray800 }]}>{c.author.displayName}</Text>
                      <Text style={[styles.inlineCommentText, { color: isDark ? DS.gray400 : DS.gray600 }]}>{c.content}</Text>
                    </View>
                    <View style={styles.inlineCommentActions}>
                      <TouchableOpacity onPress={() => likeComment(item.id, c.id)}>
                        <Text style={[styles.inlineCommentAction, c.isLiked && { color: DS.accent }]}>{c.isLiked ? 'Liked' : 'Like'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyingTo({ postId: item.id, commentId: c.id })}>
                        <Text style={styles.inlineCommentAction}>Reply</Text>
                      </TouchableOpacity>
                      <Text style={[styles.commentTime, { color: isDark ? DS.gray400 : DS.gray500 }]}>{c.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
              
              {item.commentsCount > 3 && (
                <TouchableOpacity onPress={() => navigation.navigate(ROUTES.POST_DETAIL, { postId: item.id })} style={styles.viewAllComments}>
                  <Text style={styles.viewAllCommentsText}>View all {item.commentsCount} comments</Text>
                  <Ionicons name="chevron-forward" size={12} color={DS.primary} />
                </TouchableOpacity>
              )}

              <View style={styles.commentInputBox}>
                <SafeAvatar avatar={currentUser?.avatar} size={32} fallbackIcon="person" fallbackColor={DS.primary} fallbackBgColor={`${DS.primary}15`} />
                <View style={[styles.commentInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <TextInput
                    style={[styles.commentInput, { color: isDark ? DS.white : DS.gray800 }]}
                    placeholder={replyingTo?.postId === item.id ? 'Write a reply...' : 'Add a comment...'}
                    placeholderTextColor={DS.gray400}
                    value={commentInputs[item.id] || ''}
                    onChangeText={t => setCommentInputs(prev => ({ ...prev, [item.id]: t }))}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !commentInputs[item.id]?.trim() && styles.sendBtnDisabled]}
                    onPress={() => handleCommentSubmit(item.id)}
                    disabled={!commentInputs[item.id]?.trim()}
                  >
                    <LinearGradient
                      colors={commentInputs[item.id]?.trim() ? [DS.primary, DS.primaryDark] : [DS.gray200, DS.gray200]}
                      style={styles.sendBtnGrad}
                    >
                      <Ionicons name="arrow-up" size={14} color={DS.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [isDark, currentUser, topics, expandedPostId, commentInputs, replyingTo, handleLike, handleRepost, handleBookmark, handleShare, handleCommentSubmit, handleVotePoll, navigation, sweetAlert]);

  // ============================================================
  // RENDER HEADER
  // ============================================================
  const renderHeader = useCallback(() => (
    <View>
      {/* Hero Banner - THE LOOM */}
      <Animated.View 
        entering={FadeInUp.delay(100).duration(500).springify()}
        style={[styles.heroBanner, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
      >
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)'] : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                THE LOOM
              </Text>
              <Text style={[styles.heroSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Weave stories, share wisdom, grow together.
              </Text>
            </View>
           <View style={styles.heroStats}>
  <View style={styles.heroStat}>
    <Text style={[styles.heroStatValue, { color: DS.primary }]}>{postsCount}</Text>
    <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Posts</Text>
  </View>
  <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
  <View style={styles.heroStat}>
    <Text style={[styles.heroStatValue, { color: DS.accent }]}>{membersCount}</Text>
    <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Members</Text>
  </View>
  <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
  <View style={styles.heroStat}>
    <Text style={[styles.heroStatValue, { color: DS.warning }]}>{userTopics.length}</Text>
    <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Topics</Text>
  </View>
</View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity 
              style={[styles.heroActionBtn, { backgroundColor: DS.primary }]}
              onPress={() => {
                if (!canInteract) {
                  sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
                  return;
                }
                navigation.navigate(ROUTES.CREATE_POST);
              }}
            >
              <Ionicons name="create-outline" size={16} color={DS.white} />
              <Text style={styles.heroActionText}>Start Thread</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.heroActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
              onPress={() => {
                if (!hasTopics) {
                  navigation.navigate(ROUTES.ONBOARDING as never, { editing: true } as never);
                } else {
                  navigation.navigate(ROUTES.TOPICS, { topicId: topics[0]?.id });
                }
              }}
            >
              <Ionicons name={hasTopics ? "compass-outline" : "add-circle-outline"} size={16} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.heroActionText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                {hasTopics ? 'Explore' : 'Add Topics'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Topic Selection Status */}
          {hasTopics ? (
  <View style={[styles.topicStatus, { marginTop: DS.space.sm }]}>
    <Ionicons name="checkmark-circle" size={14} color={DS.success} />
    <Text style={[styles.topicStatusText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
      {userTopics.length} topic{userTopics.length !== 1 ? 's' : ''} selected
    </Text>
    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.ONBOARDING as never, { editing: true } as never)}>
      <Text style={[styles.topicStatusEdit, { color: DS.primary }]}>Edit</Text>
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity 
    style={[styles.topicStatus, styles.topicStatusEmpty, { marginTop: DS.space.sm }]}
    onPress={() => navigation.navigate(ROUTES.ONBOARDING as never, { editing: true } as never)}
  >
    <Ionicons name="alert-circle" size={14} color={DS.warning} />
    <Text style={[styles.topicStatusText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
      Select {Math.max(0, 5 - userTopics.length)} more topics to personalize your feed
    </Text>
    <Ionicons name="chevron-forward" size={14} color={DS.primary} />
  </TouchableOpacity>
)}
        </View>
      </Animated.View>

      {/* Smart Compose Bar */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(500).springify()}
        style={[styles.composeBar, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
      >
        <TouchableOpacity
          style={styles.composeInput}
          onPress={() => {
            if (!canInteract) {
              sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
              return;
            }
            navigation.navigate(ROUTES.CREATE_POST);
          }}
        >
          <View style={[styles.composeInputInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
            <Ionicons name="create-outline" size={18} color={DS.gray400} />
            <Text style={[styles.composePlaceholder, { color: DS.gray400 }]}>What's on your mind, parent?</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Topic Filter */}
      <View style={styles.topicFilterRow}>
        <TouchableOpacity
          style={[styles.topicFilterPill, activeTopic === 'all' && { backgroundColor: DS.primary }]}
          onPress={() => setActiveTopic('all')}
        >
          <Text style={[styles.topicFilterText, activeTopic === 'all' && { color: DS.white }]}>All</Text>
        </TouchableOpacity>
        {topics.slice(0, 8).map((topic) => (
          <TouchableOpacity
            key={topic.id}
            style={[styles.topicFilterPill, activeTopic === topic.id && { backgroundColor: topic.color }]}
            onPress={() => setActiveTopic(activeTopic === topic.id ? 'all' : topic.id)}
          >
            <Text style={styles.topicFilterEmoji}>{topic.emoji}</Text>
            <Text style={[styles.topicFilterText, activeTopic === topic.id && { color: DS.white }]}>
              {topic.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [isDark, topics, postsCount, membersCount, canInteract, activeTopic, hasTopics, userTopics, navigation, sweetAlert]);

  // ============================================================
  // RENDER FOOTER
  // ============================================================
  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={DS.primary} />
        <Text style={[styles.footerLoaderText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Weaving more threads...
        </Text>
      </View>
    );
  }, [loadingMore, isDark]);

  // ============================================================
  // RENDER EMPTY
  // ============================================================
  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <LinearGradient colors={isDark ? [`${DS.primary}20`, `${DS.primaryDark}20`] : [`${DS.primary}12`, `${DS.primaryDark}12`]} style={styles.emptyIconBg}>
        <Ionicons name="chatbubbles-outline" size={40} color={DS.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray600 }]}>
        {searchQuery ? 'No threads found' : 'The Loom is quiet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray400 }]}>
        {searchQuery ? 'Try different words or browse by topic' : 'Be the first to weave a story!'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyBtn} onPress={() => {
          if (!canInteract) {
            sweetAlert.alert('Sign In Required', 'Please sign in to start a thread', 'warning');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST);
        }}>
          <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.emptyBtnGrad}>
            <Text style={styles.emptyBtnText}>Start a Thread</Text>
            <Ionicons name="arrow-forward" size={14} color={DS.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, searchQuery, canInteract, navigation, sweetAlert]);

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        {/* Glass Header */}
        <Animated.View style={[styles.header, { 
          backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray200,
          borderBottomWidth: 1,
        }]}>
          <View style={styles.headerInner}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                if (canInteract) {
                  navigation.navigate(ROUTES.EDIT_PROFILE);
                } else {
                  sweetAlert.alert('Sign In Required', 'Please sign in to access your profile', 'warning');
                }
              }}
            >
              <SafeAvatar
                avatar={currentUser?.avatar}
                size={38}
                fallbackIcon="person"
                fallbackColor={DS.primary}
                fallbackBgColor={`${DS.primary}18`}
              />
              {currentUser?.onlineStatus === 'online' && (
                <View style={styles.headerOnlineIndicator}>
                  <View style={styles.headerOnlineDot} />
                </View>
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>THE LOOM</Text>
                <Text style={[styles.headerSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {currentUser?.displayName || 'Welcome'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={isDark ? DS.primaryLight : DS.primary} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (!canInteract) {
                  sweetAlert.alert('Sign In Required', 'Please sign in to view notifications', 'warning');
                  return;
                }
                setShowNotificationChooser(true);
              }} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name="notifications-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
                  {unreadCount > 0 && (
                    <View style={styles.headerBadge}>
                      <LinearGradient colors={[DS.accent, DS.accentLight]} style={styles.headerBadgeGrad}>
                        <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </LinearGradient>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (!canInteract) {
                  sweetAlert.alert('Sign In Required', 'Please sign in to access messages', 'warning');
                  return;
                }
                navigation.navigate(ROUTES.MESSAGES);
              }} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name="mail-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => navigation.navigate(ROUTES.ONBOARDING as never, { editing: true } as never)} 
                style={styles.headerIconBtn}
              >
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name="pricetags-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {showBanner && (
          <Animated.View entering={SlideInDown.duration(350).springify()} exiting={SlideOutUp.duration(200)} style={styles.bannerWrap}>
            <TouchableOpacity onPress={handleScrollToNew}>
              <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.bannerGradient}>
                <Ionicons name="sparkles" size={16} color={DS.white} />
                <Text style={styles.bannerText}>{newPostsCount} new thread{newPostsCount > 1 ? 's' : ''} woven</Text>
                <Ionicons name="arrow-up" size={14} color={DS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {showSearch && (
          <Animated.View 
            entering={FadeInDown.duration(250)} 
            exiting={FadeOut.duration(200)} 
            style={[styles.searchBarContainer, { backgroundColor: isDark ? DS.darkCard : DS.white, marginTop: HEADER_TOTAL_HEIGHT + 8 }]}
          >
            <View style={[styles.searchBarInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
              <Ionicons name="search" size={18} color={DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray800 }]}
                placeholder="Search threads, topics, parents..."
                placeholderTextColor={DS.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity style={styles.searchPeopleBtn} onPress={() => navigation.navigate(ROUTES.SEARCH_USERS, { initialQuery: searchQuery.trim() })}>
                <Ionicons name="people-outline" size={16} color={DS.primary} />
                <Text style={[styles.searchPeopleText, { color: DS.primary }]}>Find parents matching "{searchQuery.trim()}"</Text>
                <Ionicons name="chevron-forward" size={14} color={DS.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {isLoading ? (
          <View style={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}>
            {[1, 2, 3].map(i => <PostSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef as any}
            data={displayedPosts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={DS.primary}
                colors={[DS.primary]}
                progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
                progressViewOffset={Platform.OS === 'ios' ? HEADER_TOTAL_HEIGHT : HEADER_TOTAL_HEIGHT - 20}
              />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={renderEmpty}
          />
        )}

        {/* Notification Modal */}
        <Modal visible={showNotificationChooser} transparent animationType="fade" onRequestClose={() => setShowNotificationChooser(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNotificationChooser(false)}>
            <View style={[styles.notificationModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <View style={styles.notificationModalHeader}>
                <Text style={[styles.notificationModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
                <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                  <Ionicons name="close" size={24} color={isDark ? DS.gray400 : DS.gray500} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.notificationOption} onPress={() => {
                setShowNotificationChooser(false);
                navigation.navigate(ROUTES.NOTIFICATIONS);
              }}>
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="notifications" size={20} color={DS.primary} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>All Notifications</Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.notificationOption} onPress={() => {
                setShowNotificationChooser(false);
                markAllNotificationsRead();
                sweetAlert.alert('Success', 'All notifications marked as read', 'success');
              }}>
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.success}15` }]}>
                  <Ionicons name="checkmark-done" size={20} color={DS.success} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Mark All as Read</Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Clear all notification badges</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* FAB */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (!canInteract) {
                sweetAlert.alert('Sign In Required', 'Please sign in to weave a thread', 'warning');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ============================================================
// POLL WIDGET
// ============================================================
const PollWidget = React.memo(({
  poll,
  postId,
  onVote,
  isDark,
}: {
  poll: Poll;
  postId: string;
  onVote: (postId: string, optionId: string) => void;
  isDark: boolean;
}) => {
  return (
    <View style={[styles.pollWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
      <Text style={[styles.pollQuestion, { color: isDark ? DS.white : DS.gray800 }]}>
        {poll.question}
      </Text>
      {poll.options.map((option) => {
        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
        const isSelected = poll.votedOptionId === option.id;

        return (
          <Pressable
            key={option.id}
            onPress={() => !poll.hasVoted && onVote(postId, option.id)}
            style={styles.pollOption}
          >
            <View style={styles.pollTrack}>
              {poll.hasVoted && (
                <Animated.View
                  entering={FadeIn.duration(600)}
                  style={[
                    styles.pollFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? DS.primary : `${DS.primary}25`,
                    },
                  ]}
                />
              )}
              <View style={styles.pollOptionContent}>
                <Text style={[styles.pollOptionText, { color: isDark ? DS.gray200 : DS.gray700 }]}>
                  {option.text}
                </Text>
                {poll.hasVoted && (
                  <Text style={[styles.pollPercent, { color: isSelected ? DS.primary : DS.gray400 }]}>
                    {percentage}%
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.pollMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {!poll.hasVoted && ' · Tap to vote'}
      </Text>
    </View>
  );
});

// ============================================================
// POST SKELETON
// ============================================================
const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  return (
    <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, marginBottom: DS.space.lg, padding: DS.space.lg }]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
        <View style={styles.skeletonTextBlock}>
          <View style={[styles.skeletonLine, { width: '45%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
          <View style={[styles.skeletonLine, { width: '28%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0' }]} />
        </View>
      </View>
      <View style={{ paddingVertical: DS.space.md, gap: DS.space.sm }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
    </View>
  );
});

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: DS.space.md,
    minHeight: HEADER_TOTAL_HEIGHT,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
    marginTop: -2,
  },
  headerOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: DS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DS.white,
  },
  headerOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.success,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: DS.radius.full,
  },
  headerIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: DS.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DS.white,
    zIndex: 10,
  },
  headerBadgeGrad: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: DS.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Hero Banner
  heroBanner: {
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.md,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  heroContent: { zIndex: 1 },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: DS.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: DS.text.sm.size,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: DS.radius.lg,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
  },
  heroActions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.full,
  },
  heroActionText: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    color: DS.white,
  },
  topicStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm,
    paddingVertical: DS.space.xs,
  },
  topicStatusEmpty: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  topicStatusText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  topicStatusEdit: {
    fontSize: DS.text.xs.size,
    fontWeight: '700',
    marginLeft: DS.space.xs,
  },

  // Compose
  composeBar: {
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    ...DS.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.1)',
  },
  composeInput: {
    marginTop: DS.space.sm,
  },
  composeInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
  },
  composePlaceholder: {
    flex: 1,
    fontSize: DS.text.base.size,
  },

  // Topic Filter
  topicFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  topicFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: DS.gray200,
  },
  topicFilterEmoji: {
    fontSize: 12,
  },
  topicFilterText: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
    color: DS.gray600,
  },

  // Post Card
  postCard: {
    borderRadius: DS.radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.lg,
    ...DS.shadow.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DS.space.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorInfo: {
    marginLeft: DS.space.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
  },
  authorName: {
    fontSize: DS.text.base.size,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    marginTop: 2,
  },
  handleText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  dot: {
    fontSize: DS.text.xs.size,
    marginHorizontal: 2,
  },
  timeText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  moreBtn: {
    padding: DS.space.sm,
    marginLeft: DS.space.sm,
  },

  // Mood
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: DS.text.xs.size,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Sentiment
  sentimentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.sm,
  },
  sentimentEmoji: { fontSize: 14 },
  sentimentBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.gray200,
    overflow: 'hidden',
  },
  sentimentFill: {
    height: '100%',
    borderRadius: 2,
  },
  sentimentLabel: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
  },

  // Summary
  summaryWrap: {
    padding: DS.space.md,
    borderRadius: DS.radius.md,
  },
  summaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.xs,
  },
  summaryToggleText: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: DS.text.sm.size,
    lineHeight: 20,
  },

  postText: {
    fontSize: DS.text.base.size,
    lineHeight: 24,
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
  },
  readMore: {
    fontSize: DS.text.sm.size,
    color: DS.primary,
    fontWeight: '700',
    paddingHorizontal: DS.space.lg,
    marginTop: -DS.space.sm,
    marginBottom: DS.space.md,
  },

  // Topic Tag
  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.full,
    gap: DS.space.sm,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicTagText: {
    fontSize: DS.text.xs.size,
    fontWeight: '700',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeEmoji: { fontSize: 10 },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${DS.warning}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
  },
  trendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: DS.warning,
  },

  // Media
  mediaBox: {
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  blurredImageContainer: {
    width: '100%',
    height: 280,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  blurredImage: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: DS.space.md,
  },
  blurText: {
    fontSize: DS.text.base.size,
    fontWeight: '700',
    marginBottom: DS.space.xs,
  },
  blurSubtext: {
    fontSize: DS.text.sm.size,
    fontWeight: '500',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridItem: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: DS.radius.md,
    overflow: 'hidden',
  },
  gridItemLarge: {
    width: '100%',
    aspectRatio: 16 / 9,
  },

  // Engagement
  engagementBar: {
    paddingBottom: DS.space.sm,
  },
  engagementText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },

  // Reaction Bar
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderTopWidth: 1,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.sm,
  },
  reactionCount: {
    fontSize: DS.text.sm.size,
    color: DS.gray400,
    fontWeight: '600',
  },

  // Comments
  commentsBox: {
    borderTopWidth: 1,
    padding: DS.space.lg,
  },
  inlineComment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
    marginBottom: DS.space.md,
  },
  inlineCommentContent: { flex: 1 },
  inlineCommentBubble: {
    borderRadius: DS.radius.lg,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  inlineCommentAuthor: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    marginBottom: 2,
  },
  inlineCommentText: {
    fontSize: DS.text.sm.size,
    lineHeight: 20,
  },
  inlineCommentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginTop: DS.space.xs,
    paddingLeft: DS.space.sm,
  },
  inlineCommentAction: {
    fontSize: DS.text.xs.size,
    color: DS.gray400,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    marginBottom: DS.space.md,
  },
  viewAllCommentsText: {
    fontSize: DS.text.sm.size,
    color: DS.primary,
    fontWeight: '700',
  },
  commentInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.radius.full,
    borderWidth: 1,
    paddingHorizontal: DS.space.md,
    paddingVertical: 2,
  },
  commentInput: {
    flex: 1,
    fontSize: DS.text.sm.size,
    paddingVertical: DS.space.md,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Poll
  pollWrap: {
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
  },
  pollQuestion: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    marginBottom: DS.space.md,
  },
  pollOption: { marginBottom: DS.space.sm },
  pollTrack: {
    height: 40,
    borderRadius: DS.radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DS.radius.md,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.md,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },
  pollPercent: {
    fontSize: DS.text.sm.size,
    fontWeight: '800',
  },
  pollMeta: {
    fontSize: DS.text.xs.size,
    marginTop: DS.space.sm,
  },

  // Skeleton
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonTextBlock: {
    marginLeft: DS.space.md,
    gap: DS.space.sm,
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: DS.radius.sm,
  },

  // Banner
  bannerWrap: {
    position: 'absolute',
    top: HEADER_TOTAL_HEIGHT + 8,
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.full,
    ...DS.shadow.md,
  },
  bannerText: {
    color: DS.white,
    fontSize: DS.text.sm.size,
    fontWeight: '700',
  },

  // Search
  searchBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 95,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    marginHorizontal: DS.space.lg,
    ...DS.shadow.md,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: DS.text.base.size,
    paddingVertical: 4,
  },
  searchPeopleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm,
    paddingVertical: DS.space.md,
    marginTop: DS.space.xs,
  },
  searchPeopleText: {
    flex: 1,
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: DS.space['2xl'],
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: DS.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: DS.space.lg,
  },
  emptyTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
    marginBottom: DS.space.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: DS.text.base.size,
    textAlign: 'center',
    marginBottom: DS.space.xl,
    lineHeight: 22,
  },
  emptyBtn: {
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.md,
  },
  emptyBtnText: {
    color: DS.white,
    fontSize: DS.text.sm.size,
    fontWeight: '700',
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 30,
    right: DS.space.lg,
    zIndex: 100,
    alignItems: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...DS.shadow.lg,
  },
  fabGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  notificationModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    ...DS.shadow.lg,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.lg,
  },
  notificationModalTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '700',
  },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationOptionTextWrap: {
    flex: 1,
  },
  notificationOptionTitle: {
    fontSize: DS.text.base.size,
    fontWeight: '600',
  },
  notificationOptionDesc: {
    fontSize: DS.text.xs.size,
    marginTop: 2,
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.xl,
  },
  footerLoaderText: {
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },
});