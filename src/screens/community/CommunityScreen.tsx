// src/screens/community/CommunityScreen.tsx
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
  FadeInRight,        // ✅ FIXED: Added missing import
  FadeOut,
  interpolate,
  interpolateColor,
  Layout,
  runOnJS,
  SlideInDown,
  SlideOutUp,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  withDelay,          // ✅ FIXED: Added missing import
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity } from '../../context/CommunityContext';
import { EmptyState } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommunityColors } from '../../theme/CommunityTheme';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, PostMood, Poll, CommunityUser } from '../../context/CommunityContext';
import SafeAvatar from '../../components/SafeAvatar';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useUser } from '../../context/UserContext';
import { VideoView, useVideoPlayer } from 'expo-video';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

// ✅ FIXED: Removed useApp import - using useCustomization for theme instead
// ✅ FIXED: Removed useSweetAlert import - using Alert.alert instead

// ═══════════════════════════════════════════════════════════════
// PREMIUM DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════
const DS = { /* ... same design system ... */ };

// ═══════════════════════════════════════════════════════════════
// ROUTE NAMES — FIXED to match CommunityStackParamList exactly
// ═══════════════════════════════════════════════════════════════
const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'CommunityMemberProfile',  // ✅ FIXED: was 'UserProfile'
  EDIT_PROFILE: 'CommunityProfile',        // ✅ FIXED: was 'EditProfile'
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',                    // ✅ FIXED: was 'Messages'
  TOPICS: 'Topic',
} as const;

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ═══════════════════════════════════════════════════════════════
// POST SKELETON — ✅ FIXED: Moved BEFORE main component
// ═══════════════════════════════════════════════════════════════
const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  const shimmerOffset = useSharedValue(-SCREEN_W);
  useEffect(() => {
    shimmerOffset.value = withRepeat(
      withTiming(SCREEN_W, { duration: 1800, easing: Easing.ease }),
      -1, false
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerOffset.value }],
  }));
  // ... skeleton JSX ...
  return (
    <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, marginBottom: DS.space.lg, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { zIndex: 10 }]}>
        <LinearGradient colors={isDark ? ['transparent','rgba(255,255,255,0.04)','transparent'] : ['transparent','rgba(99,102,241,0.04)','transparent']} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* skeleton content */}
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
        <View style={styles.skeletonTextBlock}>
          <View style={[styles.skeletonLine, { width: '45%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
          <View style={[styles.skeletonLine, { width: '28%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0' }]} />
        </View>
      </View>
      <View style={{ paddingHorizontal: DS.space.lg, gap: DS.space.sm, marginBottom: DS.space.lg }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
      <View style={[styles.skeletonMedia, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f0f2ff', marginHorizontal: DS.space.lg, marginBottom: DS.space.lg }]} />
      <View style={[styles.skeletonActions, { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.md }]}>
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════
// ALL SUB-COMPONENTS (WeaveScoreRing, ParentMatchCard, TrendingPulseWave, 
// SmartComposeBar, WeeklyDigestCard, TopicHeatmap, MoodBadge, PollWidget,
// SmartVideoPlayer, ReactionBar, PostCard, GlassHeader, NewPostsBanner)
// — Keep all existing component definitions here
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ✅ FIXED: Search Overlay Component (was missing)
// ═══════════════════════════════════════════════════════════════
const SearchOverlay = React.memo(({
  visible,
  query,
  onChangeQuery,
  onClose,
  isDark,
}: {
  visible: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  onClose: () => void;
  isDark: boolean;
}) => {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.searchOverlay, { backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)' }]}>
      <BlurView intensity={isDark ? 60 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrap, { backgroundColor: isDark ? DS.darkCard : DS.gray100, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <Ionicons name="search" size={20} color={DS.gray400} />
          <TextInput style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]} placeholder="Search threads, topics, parents..." placeholderTextColor={DS.gray400} value={query} onChangeText={onChangeQuery} autoFocus returnKeyType="search" />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => onChangeQuery('')}>
              <Ionicons name="close-circle" size={20} color={DS.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.searchCloseBtn}>
          <Text style={[styles.searchCloseText, { color: DS.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════
// ✅ FIXED: Notification Chooser Modal (was missing implementation)
// ═══════════════════════════════════════════════════════════════
const NotificationChooserModal = React.memo(({
  visible,
  onClose,
  onViewNotifications,
  onViewMessages,
  isDark,
  unreadCount,
}: {
  visible: boolean;
  onClose: () => void;
  onViewNotifications: () => void;
  onViewMessages: () => void;
  isDark: boolean;
  unreadCount: number;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.notificationChooser, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.chooserHeader}>
            <Text style={[styles.chooserTitle, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.chooserOption} onPress={onViewNotifications}>
            <View style={[styles.chooserIconWrap, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="notifications" size={20} color={DS.primary} />
            </View>
            <View style={styles.chooserOptionText}>
              <Text style={[styles.chooserOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Activity Feed</Text>
              <Text style={[styles.chooserOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Likes, comments, mentions</Text>
            </View>
            {unreadCount > 0 && (
              <View style={[styles.chooserBadge, { backgroundColor: DS.accent }]}>
                <Text style={styles.chooserBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chooserOption} onPress={onViewMessages}>
            <View style={[styles.chooserIconWrap, { backgroundColor: `${DS.success}15` }]}>
              <Ionicons name="mail" size={20} color={DS.success} />
            </View>
            <View style={styles.chooserOptionText}>
              <Text style={[styles.chooserOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Messages</Text>
              <Text style={[styles.chooserOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Direct messages</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

// ═══════════════════════════════════════════════════════════════
// ✅ FIXED: MAIN SCREEN — Properly structured with all fixes
// ═══════════════════════════════════════════════════════════════
export default function CommunityScreen({ navigation }: Props) {
  useRouteBasedNavVisibility();

  const {
    posts, topics, currentUser, likePost, unlikePost, repostPost, unrepostPost,
    bookmarkPost, deletePost, addComment, likeComment, replyToComment, voteHelpful,
    followUser, unfollowUser, isFollowing, refreshFeed, loadMorePosts, getFeedPosts,
    getUnreadCount, incrementViewCount, checkIsAuth,
    getAllUsers, votePoll, getUserStats,
  } = useCommunity();

  const { profile, communityProfile } = useUser();
  const { isAuthenticated: authIsAuth } = useAuth();
  const { triggerHaptic, settings } = useCustomization(); // ✅ FIXED: use settings instead of isDark from useApp

  // ✅ FIXED: Derive isDark from useCustomization settings instead of non-existent useApp
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
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set());

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);

  const composeSuggestions = useMemo(() => [
    "Share a milestone your little one reached 🎉",
    "Ask for sleep training advice 😴",
    "What's your favorite parenting hack? 💡",
    "Celebrate a small win today 🌟",
    "Need support? We're here 💙",
  ], []);

  const parentMatches = useMemo((): ParentMatch[] => {
    if (!currentUser || !canInteract) return [];
    return allUsers
      .filter(u => u.id !== currentUser.id && !isFollowing(u.id) && !dismissedMatches.has(u.id))
      .slice(0, 3)
      .map(u => ({
        user: u,
        matchScore: Math.floor(60 + Math.random() * 40),
        matchReason: `Also interested in ${topics[Math.floor(Math.random() * topics.length)]?.name || 'Parenting'}`,
        commonTopics: topics.slice(0, 2).map(t => t.name),
      }));
  }, [allUsers, currentUser, isFollowing, dismissedMatches, topics]);

  const weeklyStats = useMemo(() => {
    const userPosts = posts.filter(p => p.authorId === currentUser?.id);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekPosts = userPosts.filter(p => new Date(p.timestamp).getTime() > weekAgo);
    const totalLikes = userPosts.reduce((sum, p) => sum + p.likes, 0);
    const totalHelpful = userPosts.reduce((sum, p) => sum + p.helpfulVotes, 0);
    return {
      postsThisWeek: thisWeekPosts.length,
      likesReceived: totalLikes,
      helpfulVotes: totalHelpful,
      streakDays: currentUser?.stats?.streakDays || 0,
      rankPercentile: Math.floor(50 + (totalLikes / Math.max(posts.length, 1)) * 50),
    };
  }, [posts, currentUser]);

  // ✅ FIXED: Single initialization useEffect with cleanup
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // ✅ FIXED: Proper dependency array for getFilteredPosts
  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
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
  }, [getFeedPosts, activeTopic, searchQuery]); // ✅ FIXED: proper dependencies

  // ✅ FIXED: posts dependency included
  useEffect(() => {
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
    setPage(1);
  }, [posts, activeTopic, searchQuery, getFilteredPosts]); // ✅ FIXED: posts in deps

  useEffect(() => {
    if (prevPostsRef.current.length > 0 && posts.length > prevPostsRef.current.length) {
      const count = posts.length - prevPostsRef.current.length;
      setNewPostsCount(count);
      setShowBanner(true);
    }
    prevPostsRef.current = posts;
  }, [posts]);

  const handleScrollToNew = useCallback(() => {
    setShowBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

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

  // ✅ FIXED: Using Alert.alert instead of broken sweetAlert
  const handleLike = useCallback(async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to like threads');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(postId) : await likePost(postId);
  }, [canInteract, posts, triggerHaptic, unlikePost, likePost]);

  const handleRepost = useCallback(async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to reweave');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(postId) : await repostPost(postId);
  }, [canInteract, posts, triggerHaptic, unrepostPost, repostPost]);

  const handleBookmark = useCallback(async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to bookmark');
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  }, [canInteract, triggerHaptic, bookmarkPost]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
    } catch (e) { console.error(e); }
  }, []);

  // ✅ FIXED: Proper deletePost with actual deletion
  const handleDelete = useCallback((postId: string) => {
    Alert.alert(
      'Unravel this thread?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
      ]
    );
  }, [deletePost]);

  const handleCommentSubmit = useCallback(async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to reply');
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
  }, [canInteract, commentInputs, replyingTo, triggerHaptic, replyToComment, addComment]);

  const handleConnectParent = useCallback(async (userId: string) => {
    if (!canInteract) return;
    triggerHaptic('medium');
    await followUser(userId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [canInteract, followUser, triggerHaptic]);

  const handleDismissMatch = useCallback((userId: string) => {
    setDismissedMatches(prev => new Set(prev).add(userId));
  }, []);

  const handleVotePoll = useCallback(async (postId: string, optionId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to vote');
      return;
    }
    await votePoll(postId, optionId);
  }, [canInteract, votePoll]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(v => (v.item as Post).id));
    setVisiblePostIds(visibleIds);
    viewableItems.forEach(v => incrementViewCount((v.item as Post).id));
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45 }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  }, []);

  const renderPost = useCallback(({ item, index }: { item: Post; index: number }) => (
    <PostCard
      post={item}
      index={index}
      isVisible={visiblePostIds.has(item.id)}
      onNavigate={(screen, params) => navigation.navigate(screen as any, params)}
      onLike={handleLike}
      onRepost={handleRepost}
      onBookmark={handleBookmark}
      onShare={handleShare}
      onDelete={handleDelete}
      onVoteHelpful={voteHelpful}
      onExpand={setExpandedPostId}
      isExpanded={expandedPostId === item.id}
      commentInput={commentInputs[item.id] || ''}
      onCommentChange={(pid, text) => setCommentInputs(prev => ({ ...prev, [pid]: text }))}
      onCommentSubmit={handleCommentSubmit}
      replyingTo={replyingTo}
      onReply={(pid, cid) => setReplyingTo({ postId: pid, commentId: cid })}
      onLikeComment={likeComment}
      onVotePoll={handleVotePoll}
      topics={topics}
      currentUser={currentUser}
      canInteract={canInteract}
      isDark={isDark}
    />
  ), [visiblePostIds, expandedPostId, commentInputs, replyingTo, topics, currentUser, canInteract, isDark, handleLike, handleRepost, handleBookmark, handleShare, handleDelete, handleCommentSubmit, likeComment, voteHelpful, handleVotePoll, navigation]);

  const renderHeader = useCallback(() => (
    <View>
      <SmartComposeBar
        onCompose={(prompt) => {
          if (!canInteract) {
            Alert.alert('Sign In Required', 'Please sign in to post');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST as any, { prompt });
        }}
        suggestions={composeSuggestions}
        isDark={isDark}
      />
      {canInteract && (
        <WeeklyDigestCard
          stats={weeklyStats}
          isDark={isDark}
          onViewDetails={() => navigation.navigate(ROUTES.EDIT_PROFILE as any)}
        />
      )}
      {parentMatches.length > 0 && canInteract && (
        <View style={[styles.matchesContainer, { backgroundColor: isDark ? DS.darkSurface : DS.gray50 }]}>
          <View style={styles.matchesHeader}>
            <Ionicons name="people" size={18} color={DS.primary} />
            <Text style={[styles.matchesTitle, { color: isDark ? DS.white : DS.gray900 }]}>Parents You May Know</Text>
            <Text style={[styles.matchesCount, { color: DS.gray400 }]}>{parentMatches.length} matches</Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={parentMatches}
            keyExtractor={m => m.user.id}
            renderItem={({ item, index }) => (
              <ParentMatchCard
                match={item}
                onConnect={handleConnectParent}
                onDismiss={handleDismissMatch}
                index={index}
                isDark={isDark}
              />
            )}
            contentContainerStyle={styles.matchesList}
          />
        </View>
      )}
      <TopicHeatmap
        topics={topics}
        activeTopic={activeTopic}
        onSelect={setActiveTopic}
        isDark={isDark}
      />
      {activeTopic !== 'all' && (
        <Animated.View entering={FadeIn} style={[styles.filterBar, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
          <View style={[styles.filterInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
            <Ionicons name="filter" size={12} color={DS.primary} />
            <Text style={styles.filterText}>{topics.find(t => t.id === activeTopic)?.name}</Text>
            <TouchableOpacity onPress={() => setActiveTopic('all')}>
              <Ionicons name="close-circle" size={16} color={DS.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  ), [isDark, activeTopic, topics, composeSuggestions, weeklyStats, parentMatches, canInteract, handleConnectParent, handleDismissMatch, navigation]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 120 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={DS.primary} />
        <Text style={[styles.footerLoaderText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Weaving more threads...</Text>
      </View>
    );
  }, [loadingMore, isDark]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <LinearGradient colors={isDark ? [`${DS.primary}20`, `${DS.primaryDark}20`] : [`${DS.primary}12`, `${DS.primaryDark}12`]} style={styles.emptyIconBg}>
        <Ionicons name="chatbubbles-outline" size={40} color={DS.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray600 }]}>{searchQuery ? 'No threads found' : 'The Loom is quiet'}</Text>
      <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray400 }]}>{searchQuery ? 'Try different words or browse by topic' : 'Be the first to weave a story into the community!'}</Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyBtn} onPress={() => canInteract ? navigation.navigate(ROUTES.CREATE_POST as any) : Alert.alert('Sign In Required', 'Please sign in to start a thread')}>
          <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.emptyBtnGrad}>
            <Text style={styles.emptyBtnText}>Start a Thread</Text>
            <Ionicons name="arrow-forward" size={14} color={DS.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, searchQuery, canInteract, navigation]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        
        <GlassHeader
          scrollY={scrollY}
          currentUser={currentUser}
          unreadCount={unreadCount}
          onAvatarPress={() => canInteract ? navigation.navigate(ROUTES.EDIT_PROFILE as any) : Alert.alert('Sign In Required', 'Please sign in to access your profile')}
          onSearchPress={() => setShowSearch(s => !s)}
          onNotifPress={() => {
            if (!canInteract) {
              Alert.alert('Sign In Required', 'Please sign in to view notifications');
              return;
            }
            setShowNotificationChooser(true);
          }}
          onMessagePress={() => canInteract ? navigation.navigate(ROUTES.MESSAGES as any) : Alert.alert('Sign In Required', 'Please sign in to access messages')}
          canInteract={canInteract}
          isDark={isDark}
        />

        {/* ✅ FIXED: Search Overlay now rendered */}
        <SearchOverlay
          visible={showSearch}
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
          isDark={isDark}
        />

        {/* ✅ FIXED: Notification Chooser Modal now rendered */}
        <NotificationChooserModal
          visible={showNotificationChooser}
          onClose={() => setShowNotificationChooser(false)}
          onViewNotifications={() => { setShowNotificationChooser(false); navigation.navigate(ROUTES.NOTIFICATIONS as any); }}
          onViewMessages={() => { setShowNotificationChooser(false); navigation.navigate(ROUTES.MESSAGES as any); }}
          isDark={isDark}
          unreadCount={unreadCount}
        />

        {showBanner && (
          <NewPostsBanner count={newPostsCount} onPress={handleScrollToNew} />
        )}

        {isLoading ? (
          <View style={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}>
            {[1, 2, 3].map(i => (
              <PostSkeleton key={i} isDark={isDark} />
            ))}
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

        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (!canInteract) {
                Alert.alert('Sign In Required', 'Please sign in to weave a thread');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST as any);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={[styles.fabGlow, { shadowColor: DS.primary }]} />
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES — Complete with added search and modal styles
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },
  
  // Header styles (keep existing)
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: HEADER_TOP_PADDING, paddingBottom: DS.space.md, minHeight: HEADER_TOTAL_HEIGHT },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerAvatarBtn: { width: 44, height: 44, borderRadius: DS.radius.full, overflow: 'hidden' },
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: `${DS.primary}25`, justifyContent: 'center', alignItems: 'center' },
  headerOnlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: DS.white, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: DS.white },
  headerOnlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.success },
  headerTitleWrap: { alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: DS.text['2xl'].size, fontWeight: '800', letterSpacing: -0.5 },
  headerLogo: { width: 32, height: 32, borderRadius: 8 },
  headerSubtitleGradient: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: DS.radius.sm, marginTop: 2, alignSelf: 'flex-start' },
  headerSubtitleText: { fontSize: 9, fontWeight: '800', color: DS.white, letterSpacing: 2, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  headerIconBtn: { width: 42, height: 42, borderRadius: DS.radius.full, overflow: 'hidden' },
  headerIconInner: { width: '100%', height: '100%', borderRadius: DS.radius.full, justifyContent: 'center', alignItems: 'center' },
  headerBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: DS.white, zIndex: 10 },
  headerBadgeGrad: { minWidth: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  headerBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800', lineHeight: 14, textAlign: 'center', includeFontPadding: false },

  // ✅ FIXED: Search Overlay styles (NEW)
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'flex-start', paddingTop: HEADER_TOTAL_HEIGHT + 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.lg, gap: DS.space.md, paddingTop: DS.space.lg },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, borderRadius: DS.radius.full, borderWidth: 1, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md },
  searchInput: { flex: 1, fontSize: DS.text.base.size, paddingVertical: 4 },
  searchCloseBtn: { paddingHorizontal: DS.space.sm },
  searchCloseText: { fontSize: DS.text.base.size, fontWeight: '600' },

  // ✅ FIXED: Notification Chooser Modal styles (NEW)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: DS.space.lg },
  notificationChooser: { width: '100%', maxWidth: 360, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.lg },
  chooserHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.lg },
  chooserTitle: { fontSize: DS.text.lg.size, fontWeight: '700' },
  chooserOption: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.sm },
  chooserIconWrap: { width: 44, height: 44, borderRadius: DS.radius.lg, justifyContent: 'center', alignItems: 'center' },
  chooserOptionText: { flex: 1 },
  chooserOptionTitle: { fontSize: DS.text.base.size, fontWeight: '700' },
  chooserOptionDesc: { fontSize: DS.text.xs.size, marginTop: 2 },
  chooserBadge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: DS.space.sm },
  chooserBadgeText: { color: DS.white, fontSize: 11, fontWeight: '800' },

  // Keep all existing styles below...
  // (composeBar, digestCard, matchesContainer, heatmapContainer, etc.)
  
  // Post Card
  postCardWrap: { paddingHorizontal: DS.space.lg, marginBottom: DS.space.lg },
  postCard: { borderRadius: DS.radius['2xl'], borderWidth: 1, overflow: 'hidden', ...DS.shadow.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: DS.space.lg },
  authorRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  authorInfo: { marginLeft: DS.space.md, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs },
  authorName: { fontSize: DS.text.base.size, fontWeight: '700' },
  verifiedBadge: { width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  weaveScoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: `${DS.warning}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.radius.full },
  weaveScoreText: { fontSize: 9, fontWeight: '800', color: DS.warning },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, marginTop: 2 },
  handleText: { fontSize: DS.text.xs.size, color: DS.gray400, fontWeight: '500' },
  dot: { fontSize: DS.text.xs.size, color: DS.gray400, marginHorizontal: 2 },
  timeText: { fontSize: DS.text.xs.size, color: DS.gray400, fontWeight: '500' },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.success },
  onlineText: { fontSize: 10, color: DS.success, fontWeight: '600' },
  moreBtn: { padding: DS.space.sm, marginLeft: DS.space.sm },
  moreBtnInner: { width: 32, height: 32, borderRadius: DS.radius.full, justifyContent: 'center', alignItems: 'center' },
  postText: { fontSize: DS.text.base.size, lineHeight: 24, paddingHorizontal: DS.space.lg, marginBottom: DS.space.md },
  readMore: { fontSize: DS.text.sm.size, color: DS.primary, fontWeight: '700', paddingHorizontal: DS.space.lg, marginTop: -DS.space.sm, marginBottom: DS.space.md },
  topicTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginHorizontal: DS.space.lg, marginBottom: DS.space.md, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.full, gap: DS.space.sm },
  topicDot: { width: 6, height: 6, borderRadius: 3 },
  topicTagText: { fontSize: DS.text.xs.size, fontWeight: '700' },
  trendingPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: `${DS.warning}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.radius.full },
  trendingText: { fontSize: 9, fontWeight: '800', color: DS.warning },
  engagementMini: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  engagementMiniText: { fontSize: 10, color: DS.gray400, fontWeight: '500' },
  mediaBox: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, borderRadius: DS.radius.lg, overflow: 'hidden' },
  singleImage: { width: '100%', height: 280, borderRadius: DS.radius.lg },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: DS.radius.lg, overflow: 'hidden' },
  gridTwo: { flexDirection: 'row' },
  gridThree: { flexDirection: 'row', flexWrap: 'wrap' },
  gridFour: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '48.5%', aspectRatio: 1, borderRadius: DS.radius.md, overflow: 'hidden' },
  gridItemLarge: { width: '100%', aspectRatio: 16 / 9 },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  gridOverlayText: { color: DS.white, fontSize: 24, fontWeight: '800' },
  videoBox: { width: '100%', height: 280, borderRadius: DS.radius.lg, overflow: 'hidden', backgroundColor: DS.gray900 },
  videoView: { width: '100%', height: '100%' },
  videoPausedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  engagementBar: { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.sm },
  engagementText: { fontSize: DS.text.xs.size, color: DS.gray400, fontWeight: '500' },
  reactionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md, borderTopWidth: 1, borderTopColor: DS.gray200 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingVertical: DS.space.sm },
  reactionCount: { fontSize: DS.text.sm.size, color: DS.gray400, fontWeight: '600' },
  commentsBox: { borderTopWidth: 1, padding: DS.space.lg },
  inlineComment: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.sm, marginBottom: DS.space.md },
  inlineCommentContent: { flex: 1 },
  inlineCommentBubble: { borderRadius: DS.radius.lg, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm },
  inlineCommentAuthor: { fontSize: DS.text.sm.size, fontWeight: '700', marginBottom: 2 },
  inlineCommentText: { fontSize: DS.text.sm.size, lineHeight: 20 },
  inlineCommentActions: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginTop: DS.space.xs, paddingLeft: DS.space.sm },
  inlineCommentAction: { fontSize: DS.text.xs.size, color: DS.gray400, fontWeight: '600' },
  commentTime: { fontSize: DS.text.xs.size, color: DS.gray400 },
  viewAllComments: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, marginBottom: DS.space.md },
  viewAllCommentsText: { fontSize: DS.text.sm.size, color: DS.primary, fontWeight: '700' },
  commentInputBox: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  commentInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: DS.radius.full, borderWidth: 1, paddingHorizontal: DS.space.md, paddingVertical: 2 },
  commentInput: { flex: 1, fontSize: DS.text.sm.size, paddingVertical: DS.space.md, maxHeight: 80 },
  sendBtn: { width: 32, height: 32, borderRadius: DS.radius.full, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  moodBadge: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, paddingHorizontal: DS.space.md, paddingVertical: 4, borderRadius: DS.radius.full, alignSelf: 'flex-start' },
  moodText: { fontSize: DS.text.xs.size, fontWeight: '700', textTransform: 'capitalize' },
  pollWrap: { borderRadius: DS.radius.lg, padding: DS.space.md },
  pollQuestion: { fontSize: DS.text.sm.size, fontWeight: '700', marginBottom: DS.space.md },
  pollOption: { marginBottom: DS.space.sm },
  pollTrack: { height: 40, borderRadius: DS.radius.md, overflow: 'hidden', justifyContent: 'center' },
  pollFill: { ...StyleSheet.absoluteFillObject, borderRadius: DS.radius.md },
  pollOptionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.md, zIndex: 1 },
  pollOptionText: { fontSize: DS.text.sm.size, fontWeight: '600' },
  pollPercent: { fontSize: DS.text.sm.size, fontWeight: '800' },
  pollMeta: { fontSize: DS.text.xs.size, marginTop: DS.space.sm },

  // Skeleton
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', padding: DS.space.lg },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
  skeletonTextBlock: { marginLeft: DS.space.md, gap: DS.space.sm, flex: 1 },
  skeletonLine: { height: 12, borderRadius: DS.radius.sm },
  skeletonMedia: { height: 200, borderRadius: DS.radius.lg },
  skeletonActions: { flexDirection: 'row', gap: DS.space.lg },
  skeletonActionDot: { width: 22, height: 22, borderRadius: 11 },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: DS.space['2xl'] },
  emptyIconBg: { width: 80, height: 80, borderRadius: DS.radius['2xl'], justifyContent: 'center', alignItems: 'center', marginBottom: DS.space.lg },
  emptyTitle: { fontSize: DS.text.xl.size, fontWeight: '800', marginBottom: DS.space.sm, textAlign: 'center' },
  emptyText: { fontSize: DS.text.base.size, textAlign: 'center', marginBottom: DS.space.xl, lineHeight: 22 },
  emptyBtn: { borderRadius: DS.radius.full, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.xl, paddingVertical: DS.space.md },
  emptyBtnText: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '700' },

  // FAB
  fabWrap: { position: 'absolute', bottom: 30, right: DS.space.lg, zIndex: 100, alignItems: 'center' },
  fab: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', ...DS.shadow.lg },
  fabGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  fabGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 29, ...DS.shadow.glow, zIndex: -1 },

  // Footer
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DS.space.sm, paddingVertical: DS.space.xl },
  footerLoaderText: { fontSize: DS.text.sm.size, fontWeight: '600' },

  // Banner
  bannerWrap: { position: 'absolute', top: HEADER_TOTAL_HEIGHT + 8, left: 0, right: 0, zIndex: 90, alignItems: 'center', paddingHorizontal: DS.space.lg },
  bannerGradient: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.xl, paddingVertical: DS.space.md, borderRadius: DS.radius.full, ...DS.shadow.md },
  bannerText: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '700' },

  // Compose Bar
  composeBar: { marginHorizontal: DS.space.lg, marginTop: HEADER_TOTAL_HEIGHT + DS.space.md, marginBottom: DS.space.md, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.md, borderWidth: 1, borderColor: 'rgba(99,102,241,0.1)' },
  composeHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md },
  composeIconWrap: { width: 40, height: 40, borderRadius: DS.radius.lg, overflow: 'hidden' },
  composeIconGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  composeTextWrap: { flex: 1 },
  composeTitle: { fontSize: DS.text.lg.size, fontWeight: '700' },
  composeSubtitle: { fontSize: DS.text.xs.size, marginTop: 2 },
  composeToggle: { width: 32, height: 32, borderRadius: DS.radius.full, justifyContent: 'center', alignItems: 'center' },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm, marginBottom: DS.space.md },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.full },
  suggestionText: { fontSize: DS.text.xs.size, fontWeight: '600' },
  composeInput: { marginTop: DS.space.sm },
  composeInputInner: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, borderRadius: DS.radius.full, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md },
  composePlaceholder: { flex: 1, fontSize: DS.text.base.size },
  composeAiBadge: { backgroundColor: DS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.radius.sm },
  composeAiText: { color: DS.white, fontSize: 9, fontWeight: '800' },

  // Digest
  digestCard: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.md, overflow: 'hidden' },
  digestHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.lg },
  digestIconWrap: { width: 36, height: 36, borderRadius: DS.radius.md, backgroundColor: `${DS.primary}15`, justifyContent: 'center', alignItems: 'center' },
  digestTitle: { flex: 1, fontSize: DS.text.lg.size, fontWeight: '700' },
  digestMore: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  digestMoreText: { fontSize: DS.text.sm.size, fontWeight: '600' },
  digestStats: { flexDirection: 'row', alignItems: 'center', marginBottom: DS.space.lg },
  digestStat: { flex: 1, alignItems: 'center' },
  digestDivider: { width: 1, height: 32 },
  digestStatValue: { fontSize: DS.text.xl.size, fontWeight: '800' },
  digestStatLabel: { fontSize: DS.text.xs.size, marginTop: 2 },
  digestRank: {},
  digestRankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm },
  digestRankLabel: { fontSize: DS.text.sm.size, fontWeight: '600' },
  digestRankValue: { fontSize: DS.text.sm.size, fontWeight: '700' },
  digestProgressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  digestProgressFill: { height: '100%', borderRadius: 3 },

  // Matches
  matchesContainer: { paddingVertical: DS.space.lg, marginBottom: DS.space.md },
  matchesHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.lg, marginBottom: DS.space.md },
  matchesTitle: { flex: 1, fontSize: DS.text.lg.size, fontWeight: '700' },
  matchesCount: { fontSize: DS.text.sm.size },
  matchesList: { paddingHorizontal: DS.space.lg, gap: DS.space.md },
  matchCard: { width: 280, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.md, overflow: 'hidden' },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md },
  matchInfo: { flex: 1 },
  matchName: { fontSize: DS.text.base.size, fontWeight: '700', marginBottom: 2 },
  matchReason: { fontSize: DS.text.xs.size, color: DS.gray400, marginBottom: DS.space.sm },
  matchTopics: { flexDirection: 'row', gap: DS.space.xs },
  matchTopicPill: { backgroundColor: `${DS.primary}12`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radius.full },
  matchTopicText: { fontSize: 10, color: DS.primary, fontWeight: '600' },
  matchActions: { flexDirection: 'row', gap: DS.space.sm },
  matchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DS.space.xs, paddingVertical: DS.space.md, borderRadius: DS.radius.lg, overflow: 'hidden' },
  matchBtnPrimary: { position: 'relative' },
  matchBtnText: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '700' },
  matchBtnTextSecondary: { fontSize: DS.text.sm.size, fontWeight: '600' },

  // Heatmap
  heatmapContainer: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.sm },
  heatmapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  heatmapTitle: { fontSize: DS.text.lg.size, fontWeight: '700' },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs },
  heatmapDot: { width: 6, height: 6, borderRadius: 3, marginLeft: DS.space.sm },
  heatmapLegendText: { fontSize: 10, fontWeight: '500' },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  heatmapCell: { width: (SCREEN_W - DS.space.lg * 4 - DS.space.sm * 3) / 4, aspectRatio: 1, borderRadius: DS.radius.md, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', padding: DS.space.xs },
  heatmapCellActive: { borderWidth: 2, borderColor: DS.primary, ...DS.shadow.glow },
  heatmapEmoji: { fontSize: 20, marginBottom: 2 },
  heatmapName: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  heatmapBar: { width: '80%', height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.06)', marginTop: 4, overflow: 'hidden' },
  heatmapBarFill: { height: '100%', borderRadius: 2 },
  heatmapTrending: { position: 'absolute', top: 4, right: 4 },

  // Pulse Wave
  pulseWaveContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', marginRight: DS.space.sm },
  pulseWave: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  pulseWaveCenter: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Filter Bar
  filterBar: { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.sm },
  filterInner: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.md, alignSelf: 'flex-start' },
  filterText: { fontSize: DS.text.sm.size, fontWeight: '600', color: DS.primary },
});