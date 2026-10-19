import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl as RNRefreshControl,
  StatusBar,
  FlatList,
  Image,
  Share,
  TextInput,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Animated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import {
  Post,
  Topic,
  useCommunity,
  INITIAL_TOPICS,
  TOPIC_CATEGORIES,
} from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useSafeCustomization } from '../../hooks/useSafeContexts';
import { useUser } from '../../context/UserContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { supabase } from '../../services/supabaseClient';

type TopicScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Topic'>;

const { width: SCREEN_W } = Dimensions.get('window');

const PILL_HEIGHT = 68;
const PILL_MARGIN = 14;
const SAFE_AREA_BOTTOM = 20;
const NAV_PILL_TOTAL_HEIGHT = PILL_HEIGHT + PILL_MARGIN + SAFE_AREA_BOTTOM;

/* ── The Loom palette ──────────────────────────────────────── */
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
  heart: '#fc5c7d',

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
  darkCard: '#292524',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',

  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

/* ── GlassCard ─────────────────────────────────────────────── */
const GlassCard = React.memo(
  ({ children, style, isDark, onPress }: any) => {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
      <View
        style={[
          s.glassCard,
          {
            backgroundColor: isDark ? 'rgba(41,37,36,0.9)' : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
          style,
        ]}
      >
        <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
                : ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)']
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View
            style={[
              s.glassBorder,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' },
            ]}
          />
          {children}
        </Wrapper>
      </View>
    );
  },
);

/* ── Sensitive image ──────────────────────────────────────── */
const SensitiveImage = React.memo(
  ({
    uri,
    style,
    resizeMode = 'cover',
    isDark = false,
  }: {
    uri: string;
    style?: any;
    resizeMode?: any;
    isDark?: boolean;
  }) => {
    const [revealed, setRevealed] = useState(false);
    if (!uri) return null;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setRevealed(true)}
        disabled={revealed}
        style={style}
      >
        <Image
          source={{ uri }}
          style={[style, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
          resizeMode={resizeMode}
          blurRadius={!revealed ? 15 : 0}
        />
        {!revealed && (
          <BlurView
            intensity={80}
            style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={{ alignItems: 'center', padding: 20 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Ionicons name="shield-checkmark" size={24} color={isDark ? '#fff' : '#666'} />
              </View>
              <Text style={{ color: isDark ? '#fff' : '#333', fontWeight: '700', fontSize: 13 }}>
                Sensitive Content
              </Text>
              <Text
                style={{
                  color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                Tap to view
              </Text>
            </View>
          </BlurView>
        )}
      </TouchableOpacity>
    );
  },
);

/* ── Sentiment ─────────────────────────────────────────────── */
const SentimentIndicator = React.memo(({ text, isDark }: { text: string; isDark: boolean }) => {
  const analyzeSentiment = (content: string) => {
    const positiveWords = ['happy','joy','love','great','wonderful','amazing','excellent','good','beautiful','fantastic','awesome','incredible','perfect','glad','thankful','grateful','blessed','proud','exciting','milestone','achievement','success','celebrate','celebrating'];
    const negativeWords = ['sad','upset','angry','frustrated','worried','scared','tired','exhausted','overwhelmed','stressed','anxious','depressed','struggle','difficult','hard','tough','challenging','pain','cry','crying','hurt'];
    const words = content.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    words.forEach((w) => {
      if (positiveWords.includes(w)) positiveCount++;
      if (negativeWords.includes(w)) negativeCount++;
    });
    const score = (positiveCount - negativeCount) / (words.length || 1);
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (score > 0.1) sentiment = 'positive';
    else if (score < -0.1) sentiment = 'negative';
    return { sentiment, score, confidence: Math.min(Math.abs(score) * 2 + 0.3, 1) };
  };

  const getEmoji = (sentiment: string) =>
    ({ positive: '😊', negative: '😢', neutral: '😐' }[sentiment] || '😐');
  const getColor = (sentiment: string) =>
    sentiment === 'positive' ? DS.success : sentiment === 'negative' ? DS.danger : DS.gray400;
  const getLabel = (sentiment: string) =>
    sentiment === 'positive' ? 'Positive' : sentiment === 'negative' ? 'Needs support' : 'Neutral';

  const analysis = analyzeSentiment(text);
  if (analysis.confidence < 0.3) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Text style={{ fontSize: 14 }}>{getEmoji(analysis.sentiment)}</Text>
      <View
        style={{
          flex: 1,
          height: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${((analysis.score + 1) / 2) * 100}%`,
            height: '100%',
            backgroundColor: getColor(analysis.sentiment),
            borderRadius: 1.5,
          }}
        />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '600', color: getColor(analysis.sentiment) }}>
        {getLabel(analysis.sentiment)}
      </Text>
    </View>
  );
});

/* ── Thread summary ──────────────────────────────────────── */
const ThreadSummary = React.memo(({ content, isDark }: { content: string; isDark: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  if (content.length <= 120) return null;
  const summary = content.slice(0, 100) + '...';

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : DS.primaryGhost,
        padding: 10,
        borderRadius: 10,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="sparkles" size={14} color={DS.primary} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: DS.primary }}>
          {expanded ? 'Hide summary' : 'AI Summary'}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          color: isDark ? DS.gray300 : DS.gray600,
          lineHeight: 18,
          marginTop: 4,
        }}
      >
        {expanded ? content : summary}
      </Text>
    </TouchableOpacity>
  );
});

/* ── Category badge ──────────────────────────────────────── */
const CategoryBadge = React.memo(
  ({ categoryId, isDark }: { categoryId?: string; isDark: boolean }) => {
    if (!categoryId) return null;
    const category = TOPIC_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return null;
    return (
      <View
        style={[
          s.categoryBadge,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ]}
      >
        <Text style={s.categoryBadgeEmoji}>{category.emoji}</Text>
        <Text style={[s.categoryBadgeText, { color: isDark ? DS.gray400 : DS.gray600 }]}>
          {category.name}
        </Text>
      </View>
    );
  },
);

/* ════════════════════════════════════════════════════════════
   Main
   ════════════════════════════════════════════════════════════ */
export default function TopicScreen({ navigation, route }: TopicScreenProps) {
  useRouteBasedNavVisibility();
  useReportRoute();

  const { topicId } = route.params;
  const {
    getTopicById,
    getPostsByTopic,
    joinTopic,
    leaveTopic,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    refreshFeed,
    currentUser,
    syncUserProfileAcrossPosts,
    bookmarkPost,
    sharePost,
    deletePost,
    addComment,
    topics,
    getSelectedTopics,
    updateSelectedTopics,
    refreshTopics: refreshTopicsFn,
  } = useCommunity();
  const { communityProfile } = useUser();

  const { themeColors, darkMode, triggerHaptic } = useSafeCustomization() as any;
  const isDark = darkMode ?? false;
  const sweetAlert = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'popular'>('trending');
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realTopicData, setRealTopicData] = useState<Topic | null>(null);
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Post>>(null);

  const userTopics = useMemo(() => getSelectedTopics(), [getSelectedTopics]);
  const isTopicSelected = useMemo(() => userTopics.includes(topicId), [userTopics, topicId]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  /* ── Supabase live stats ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const fetchTopicData = async () => {
      try {
        const { data: topicData, error: topicError } = await supabase
          .from('community_topics')
          .select('*')
          .eq('id', topicId)
          .single();

        if (cancelled || topicError || !topicData) return;

        const [{ count: postCount }, { count: memberCount }] = await Promise.all([
          supabase
            .from('community_posts')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId),
          supabase
            .from('user_topics')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId),
        ]);

        if (cancelled) return;
        setRealTopicData({
          ...topicData,
          posts: postCount || 0,
          members: memberCount || 0,
          isJoined: false,
          joinedBy: [],
          engagementScore: 0,
          weeklyGrowth: 0,
          trending: topicData.trending || false,
          category: topicData.category || undefined,
          subcategory: topicData.subcategory || undefined,
        } as Topic);
      } catch (err) {
        if (__DEV__) console.warn('[TopicScreen] live stats failed:', err);
      }
    };
    fetchTopicData();
    return () => { cancelled = true; };
  }, [topicId]);

  /* ── Sync profile across posts ───────────────────────────── */
  useEffect(() => {
    if (!currentUser?.id || !communityProfile) return;
    const hasChanges =
      communityProfile.displayName !== currentUser.displayName ||
      communityProfile.handle !== currentUser.handle ||
      communityProfile.avatar !== currentUser.avatar ||
      (communityProfile as any).bio !== currentUser.bio;
    if (hasChanges) {
      syncUserProfileAcrossPosts(currentUser.id, {
        displayName: communityProfile.displayName,
        handle: communityProfile.handle,
        avatar: communityProfile.avatar,
        ...((communityProfile as any).bio && { bio: (communityProfile as any).bio }),
      });
    }
  }, [
    communityProfile,
    currentUser?.id,
    currentUser?.displayName,
    currentUser?.handle,
    currentUser?.avatar,
    currentUser?.bio,
    syncUserProfileAcrossPosts,
  ]);

  /* ── Load data ───────────────────────────────────────────── */
  useEffect(() => {
    setIsLoading(true);
    const currentTopic = getTopicById(topicId);
    const topicPosts = getPostsByTopic(topicId);

    if (realTopicData && currentTopic) {
      setTopic({
        ...currentTopic,
        posts: Math.max(currentTopic.posts, realTopicData.posts),
        members: Math.max(currentTopic.members, realTopicData.members),
        category: realTopicData.category || currentTopic.category,
        subcategory: realTopicData.subcategory || currentTopic.subcategory,
      });
    } else if (realTopicData) {
      setTopic(realTopicData);
    } else {
      setTopic(currentTopic);
    }

    setPosts(topicPosts);
    if (topicPosts.length > 0 && !expandedPostId) setExpandedPostId(topicPosts[0].id);

    const t = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, realTopicData, getTopicById, getPostsByTopic]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    try { await refreshTopicsFn?.(); } catch {}
    setPosts(getPostsByTopic(topicId));
    setRefreshing(false);
  }, [topicId, refreshFeed, getPostsByTopic, refreshTopicsFn]);

  const handleJoinToggle = useCallback(async () => {
    if (!topic) return;
    if (topic.isJoined) {
      await leaveTopic(topic.id);
      setTopic((p) => (p ? { ...p, isJoined: false, members: Math.max(0, p.members - 1) } : p));
      triggerHaptic?.('light');
      sweetAlert.toast('Left Topic', `You left ${topic.name}`);
    } else {
      await joinTopic(topic.id);
      setTopic((p) => (p ? { ...p, isJoined: true, members: p.members + 1 } : p));
      triggerHaptic?.('success');
      sweetAlert.toast('Joined Topic', `You joined ${topic.name}!`);
    }
  }, [topic, joinTopic, leaveTopic, triggerHaptic, sweetAlert]);

  const handleAddToFeed = useCallback(async () => {
    if (!topic) return;
    const current = getSelectedTopics();
    if (current.includes(topic.id)) {
      sweetAlert.toast('Already in Feed', `${topic.name} is already in your feed`);
      return;
    }
    await updateSelectedTopics([...current, topic.id]);
    triggerHaptic?.('success');
    sweetAlert.toast('Added to Feed', `${topic.name} added to your feed!`);
  }, [topic, getSelectedTopics, updateSelectedTopics, triggerHaptic, sweetAlert]);

  const handleRemoveFromFeed = useCallback(async () => {
    if (!topic) return;
    const current = getSelectedTopics();
    if (!current.includes(topic.id)) return;
    await updateSelectedTopics(current.filter((id) => id !== topic.id));
    triggerHaptic?.('light');
    sweetAlert.toast('Removed from Feed', `${topic.name} removed from your feed`);
  }, [topic, getSelectedTopics, updateSelectedTopics, triggerHaptic, sweetAlert]);

  const handlePostLike = useCallback(
    async (post: Post) => {
      triggerHaptic?.('light');
      post.isLiked ? await unlikePost(post.id) : await likePost(post.id);
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, likePost, unlikePost, getPostsByTopic, triggerHaptic],
  );

  const handlePostRepost = useCallback(
    async (post: Post) => {
      triggerHaptic?.('medium');
      post.isReposted ? await unrepostPost(post.id) : await repostPost(post.id);
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, repostPost, unrepostPost, getPostsByTopic, triggerHaptic],
  );

  const handlePostBookmark = useCallback(
    async (post: Post) => {
      triggerHaptic?.('light');
      await bookmarkPost(post.id);
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, bookmarkPost, getPostsByTopic, triggerHaptic],
  );

  const handlePostShare = useCallback(
    async (post: Post) => {
      try {
        await Share.share({
          message: `${post.author.displayName} on The Loom: "${post.content.substring(0, 100)}..."`,
        });
        await sharePost(post.id);
      } catch (err) {
        console.error(err);
      }
    },
    [sharePost],
  );

  const handlePostDelete = useCallback(
    (post: Post) => {
      sweetAlert.confirm(
        'Delete Post',
        'Are you sure you want to delete this post? This action cannot be undone.',
        () => {
          deletePost(post.id);
          setPosts(getPostsByTopic(topicId));
        },
        undefined,
        'Delete',
        'Cancel',
      );
    },
    [topicId, deletePost, getPostsByTopic, sweetAlert],
  );

  const handleSubmitComment = useCallback(
    async (postId: string) => {
      if (!commentText.trim()) return;
      if (!currentUser) {
        sweetAlert.alert('Sign In Required', 'Please sign in to comment', 'warning');
        return;
      }
      await addComment(postId, commentText.trim());
      setCommentText('');
      setShowCommentInput(null);
      setPosts(getPostsByTopic(topicId));
      triggerHaptic?.('light');
    },
    [commentText, currentUser, addComment, getPostsByTopic, topicId, triggerHaptic, sweetAlert],
  );

  const navigateToPostDetail = useCallback(
    (postId: string) => navigation.navigate('PostDetail', { postId }),
    [navigation],
  );

  const navigateToUserProfile = useCallback(
    (userId: string) => {
      triggerHaptic?.('light');
      if (userId === currentUser?.id) navigation.navigate('CommunityProfile');
      else navigation.navigate('CommunityMemberProfile', { userId });
    },
    [navigation, currentUser?.id, triggerHaptic],
  );

  const navigateToCreatePost = useCallback(
    () => navigation.navigate('CreatePost', { topicId }),
    [navigation, topicId],
  );

  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortBy === 'popular') return b.likes - a.likes;
      return (b.popularityScore || 0) - (a.popularityScore || 0) || b.likes - a.likes;
    });
    return arr;
  }, [posts, sortBy]);

  const getTopicColor = (id: string) => {
    const t = topics.find((x) => x.id === id) || INITIAL_TOPICS.find((x) => x.id === id);
    return t?.color || DS.primary;
  };

  /* ── Comment input render ────────────────────────────────── */
  const renderCommentInput = (postId: string) => {
    if (showCommentInput !== postId) return null;
    return (
      <Animated.View
        entering={FadeInDown.duration(250)}
        style={[
          s.commentInputContainer,
          {
            backgroundColor: isDark ? 'rgba(41,37,36,0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
        ]}
      >
        <SafeAvatar
          avatar={currentUser?.avatar}
          size={32}
          fallbackIcon="person"
          fallbackColor={DS.primary}
          fallbackBgColor={`${DS.primary}20`}
        />
        <View
          style={[
            s.commentInputWrap,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
              borderColor: isDark ? DS.darkBorder : DS.lightBorder,
            },
          ]}
        >
          <TextInput
            style={[s.commentInput, { color: isDark ? DS.white : DS.gray900 }]}
            placeholder="Write a comment..."
            placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            autoFocus
            maxLength={500}
            onSubmitEditing={() => handleSubmitComment(postId)}
          />
          <TouchableOpacity
            style={[s.commentSendBtn, !commentText.trim() && { opacity: 0.5 }]}
            onPress={() => handleSubmitComment(postId)}
            disabled={!commentText.trim()}
          >
            <LinearGradient
              colors={commentText.trim() ? [DS.primary, DS.accent] : [DS.gray300, DS.gray300]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.commentSendGrad}
            >
              <Ionicons name="arrow-up" size={16} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  /* ── Render post ─────────────────────────────────────────── */
  const renderPost = useCallback(
    ({ item }: { item: Post }) => {
      const topicColor = getTopicColor(item.topicId);
      const hasImages = item.images && item.images.length > 0;
      const isOwnPost = item.authorId === currentUser?.id;
      const isExpanded = expandedPostId === item.id;

      return (
        <View style={{ marginBottom: 16 }}>
          <GlassCard isDark={isDark}>
            <View style={s.postCardInner}>
              {/* Author row */}
              <TouchableOpacity
                style={s.postHeader}
                onPress={() => navigateToUserProfile(item.author.id)}
                activeOpacity={0.8}
              >
                <SafeAvatar
                  avatar={item.author.avatar}
                  size={44}
                  fallbackIcon="person"
                  fallbackColor={topicColor}
                  fallbackBgColor={`${topicColor}20`}
                  borderWidth={2}
                  borderColor={item.author.isVerified ? topicColor : 'transparent'}
                />
                <View style={s.postHeaderText}>
                  <View style={s.postNameRow}>
                    <Text style={[s.postAuthor, { color: isDark ? DS.white : DS.gray900 }]}>
                      {item.author.displayName}
                    </Text>
                    {item.author.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color={topicColor} />
                    )}
                    {item.isTrending && (
                      <View style={s.trendingBadge}>
                        <Ionicons name="flame" size={10} color={DS.warning} />
                        <Text style={s.trendingBadgeText}>Trending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.postTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                    {item.time} · {item.topic}
                  </Text>
                </View>
              </TouchableOpacity>

              <SentimentIndicator text={item.content} isDark={isDark} />

              <TouchableOpacity
                onPress={() => setExpandedPostId(isExpanded ? null : item.id)}
                activeOpacity={0.9}
              >
                <Text
                  style={[s.postContent, { color: isDark ? DS.gray300 : DS.gray700 }]}
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  {item.content}
                </Text>
              </TouchableOpacity>

              {item.content.length > 150 && (
                <TouchableOpacity onPress={() => setExpandedPostId(isExpanded ? null : item.id)}>
                  <Text style={s.readMoreText}>{isExpanded ? 'Show less' : 'Read more'}</Text>
                </TouchableOpacity>
              )}

              <ThreadSummary content={item.content} isDark={isDark} />

              {hasImages && (
                <View style={s.postImagesContainer}>
                  {item.images!.slice(0, 2).map((img, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        s.postImageWrap,
                        { flex: 1, minWidth: (SCREEN_W - 80) / 2, height: 150 },
                      ]}
                      onPress={() => navigateToPostDetail(item.id)}
                    >
                      <SensitiveImage uri={img} style={s.postImage} isDark={isDark} />
                    </TouchableOpacity>
                  ))}
                  {item.images!.length > 2 && (
                    <TouchableOpacity
                      style={[s.postImageWrap, s.postImageMore]}
                      onPress={() => navigateToPostDetail(item.id)}
                    >
                      <BlurView intensity={80} style={s.postImageMoreOverlay} tint="dark">
                        <Text style={s.postImageMoreText}>+{item.images!.length - 2}</Text>
                      </BlurView>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Actions */}
              <View
                style={[
                  s.postActions,
                  { borderTopColor: isDark ? DS.darkBorder : DS.lightBorder },
                ]}
              >
                <TouchableOpacity style={s.action} onPress={() => handlePostLike(item)}>
                  <Ionicons
                    name={item.isLiked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={item.isLiked ? DS.heart : isDark ? DS.gray500 : DS.gray400}
                  />
                  <Text
                    style={[s.actionText, item.isLiked && { color: DS.heart, fontWeight: '700' }]}
                  >
                    {item.likes > 0 ? item.likes : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.action}
                  onPress={() => {
                    setShowCommentInput(showCommentInput === item.id ? null : item.id);
                    if (!isExpanded) setExpandedPostId(item.id);
                  }}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={20}
                    color={isDark ? DS.gray500 : DS.gray400}
                  />
                  <Text style={[s.actionText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                    {item.commentsCount > 0 ? item.commentsCount : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.action} onPress={() => handlePostRepost(item)}>
                  <Ionicons
                    name={item.isReposted ? 'repeat' : 'repeat-outline'}
                    size={20}
                    color={item.isReposted ? DS.success : isDark ? DS.gray500 : DS.gray400}
                  />
                  <Text
                    style={[s.actionText, item.isReposted && { color: DS.success, fontWeight: '700' }]}
                  >
                    {item.reposts > 0 ? item.reposts : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.action} onPress={() => handlePostBookmark(item)}>
                  <Ionicons
                    name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={item.isBookmarked ? DS.primary : isDark ? DS.gray500 : DS.gray400}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={s.action} onPress={() => handlePostShare(item)}>
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={isDark ? DS.gray500 : DS.gray400}
                  />
                </TouchableOpacity>

                {isOwnPost && (
                  <TouchableOpacity style={s.action} onPress={() => handlePostDelete(item)}>
                    <Ionicons name="trash-outline" size={20} color={DS.danger} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Comments preview */}
              {isExpanded && item.comments.length > 0 && (
                <View
                  style={[
                    s.commentsSection,
                    { borderTopColor: isDark ? DS.darkBorder : DS.lightBorder },
                  ]}
                >
                  {item.comments.slice(0, 3).map((c) => (
                    <View key={c.id} style={s.commentRow}>
                      <SafeAvatar
                        avatar={c.author.avatar}
                        size={28}
                        fallbackIcon="person"
                        fallbackColor={DS.primary}
                        fallbackBgColor={`${DS.primary}20`}
                      />
                      <View style={s.commentContent}>
                        <View
                          style={[
                            s.commentBubble,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
                          ]}
                        >
                          <Text
                            style={[s.commentAuthor, { color: isDark ? DS.white : DS.gray900 }]}
                          >
                            {c.author.displayName}
                          </Text>
                          <Text
                            style={[s.commentText, { color: isDark ? DS.gray300 : DS.gray700 }]}
                          >
                            {c.content}
                          </Text>
                        </View>
                        <View style={s.commentActions}>
                          <Text
                            style={[s.commentActionText, { color: isDark ? DS.gray500 : DS.gray400 }]}
                          >
                            {c.time}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {item.commentsCount > 3 && (
                    <TouchableOpacity
                      onPress={() => navigateToPostDetail(item.id)}
                      style={s.viewAllComments}
                    >
                      <Text style={[s.viewAllCommentsText, { color: DS.primary }]}>
                        View all {item.commentsCount} comments
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={DS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </GlassCard>

          {showCommentInput === item.id && renderCommentInput(item.id)}
        </View>
      );
    },
    [
      isDark,
      currentUser?.id,
      topics,
      showCommentInput,
      expandedPostId,
      handlePostLike,
      handlePostRepost,
      handlePostBookmark,
      handlePostShare,
      handlePostDelete,
      handleSubmitComment,
      navigateToPostDetail,
      navigateToUserProfile,
      commentText,
    ],
  );

  /* ── Loading ─────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <View style={[s.container, s.centered, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={themeColors?.spinnerColor || DS.primary} />
        <Text style={[s.loadingText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Loading topic...
        </Text>
      </View>
    );
  }

  /* ── Not found ───────────────────────────────────────────── */
  if (!topic) {
    return (
      <View style={[s.container, s.centered, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)'] : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']}
          style={s.errorIconWrap}
        >
          <Ionicons name="alert-circle-outline" size={44} color={DS.primary} />
        </LinearGradient>
        <Text style={[s.errorText, { color: isDark ? DS.white : DS.gray900 }]}>
          Topic not found
        </Text>
        <Text style={[s.errorSubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          The topic you're looking for doesn't exist.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.goBackButton}>
          <LinearGradient
            colors={[DS.primary, DS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.goBackGradient}
          >
            <Text style={s.goBackText}>Go Back</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const displayTopic = realTopicData || topic;
  const topicColor = displayTopic.color || DS.primary;
  const category = TOPIC_CATEGORIES.find((c) => c.id === displayTopic.category);

  return (
    <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient aura */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.05)', 'transparent']
            : ['rgba(99,102,241,0.05)', 'rgba(236,72,153,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Sticky header */}
      <Animated.View
        style={[
          s.animatedHeader,
          {
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
          headerOpacity,
        ]}
      >
        <View style={s.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBackBtn}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray900} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>
            {displayTopic.name}
          </Text>
          <View style={s.headerBackBtn} />
        </View>
      </Animated.View>

      {/* Hero card */}
      <View style={{ marginTop: Platform.OS === 'ios' ? 100 : 88 }}>
        <Animated.View entering={FadeInUp.delay(80).duration(400)} style={{ marginHorizontal: 16 }}>
          <GlassCard isDark={isDark}>
            {/* Aura glows on card */}
            <LinearGradient
              colors={[`${topicColor}${isDark ? '20' : '12'}`, 'transparent']}
              style={s.heroAuraTopLeft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[`${DS.accent}${isDark ? '12' : '08'}`, 'transparent']}
              style={s.heroAuraBottomRight}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
              pointerEvents="none"
            />

            <View style={s.heroContent}>
              <View style={s.heroTop}>
                <LinearGradient
                  colors={[`${topicColor}30`, `${topicColor}10`]}
                  style={s.heroEmojiContainer}
                >
                  <Text style={s.heroEmoji}>{displayTopic.emoji}</Text>
                </LinearGradient>
                <View style={s.heroTitleContainer}>
                  <Text style={[s.heroName, { color: isDark ? DS.white : DS.gray900 }]}>
                    {displayTopic.name}
                  </Text>
                  {category && (
                    <View style={[s.heroCategoryBadge, { backgroundColor: `${topicColor}18` }]}>
                      <Text style={[s.heroCategoryText, { color: topicColor }]}>
                        {category.emoji} {category.name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={[s.heroDescription, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                {displayTopic.description}
              </Text>

              <View
                style={[
                  s.heroStats,
                  { backgroundColor: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)' },
                ]}
              >
                <View style={s.heroStatItem}>
                  <View
                    style={[
                      s.heroStatIconWrap,
                      { backgroundColor: `${topicColor}18` },
                    ]}
                  >
                    <Ionicons name="people" size={14} color={topicColor} />
                  </View>
                  <Text style={[s.heroStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
                    {displayTopic.members.toLocaleString()}
                  </Text>
                  <Text style={[s.heroStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                    Members
                  </Text>
                </View>
                <View style={[s.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.lightBorder }]} />
                <View style={s.heroStatItem}>
                  <View
                    style={[s.heroStatIconWrap, { backgroundColor: `${DS.accent}18` }]}
                  >
                    <Ionicons name="document-text" size={14} color={DS.accent} />
                  </View>
                  <Text style={[s.heroStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
                    {displayTopic.posts.toLocaleString()}
                  </Text>
                  <Text style={[s.heroStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                    Posts
                  </Text>
                </View>
                <View style={[s.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.lightBorder }]} />
                <View style={s.heroStatItem}>
                  <View
                    style={[s.heroStatIconWrap, { backgroundColor: `${DS.warning}18` }]}
                  >
                    <Ionicons name="trending-up" size={14} color={DS.warning} />
                  </View>
                  <Text style={[s.heroStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
                    {displayTopic.engagementScore || 0}
                  </Text>
                  <Text style={[s.heroStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                    Engagement
                  </Text>
                </View>
              </View>

              <View style={s.heroActions}>
                <TouchableOpacity
                  style={[
                    s.heroJoinBtn,
                    {
                      backgroundColor: topic.isJoined ? (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100) : topicColor,
                      borderColor: topic.isJoined ? (isDark ? DS.darkBorder : DS.lightBorder) : 'transparent',
                    },
                  ]}
                  onPress={handleJoinToggle}
                  activeOpacity={0.85}
                >
                  {topic.isJoined && <Ionicons name="checkmark" size={16} color={isDark ? DS.gray300 : DS.gray700} />}
                  <Text
                    style={[
                      s.heroJoinText,
                      { color: topic.isJoined ? (isDark ? DS.gray300 : DS.gray700) : DS.white },
                    ]}
                  >
                    {topic.isJoined ? 'Joined' : 'Join Topic'}
                  </Text>
                </TouchableOpacity>

                {isTopicSelected ? (
                  <TouchableOpacity
                    style={[
                      s.heroFeedBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100,
                        borderColor: isDark ? DS.darkBorder : DS.lightBorder,
                      },
                    ]}
                    onPress={handleRemoveFromFeed}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={DS.success} />
                    <Text style={[s.heroFeedText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                      In Feed
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      s.heroFeedBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100,
                        borderColor: isDark ? DS.darkBorder : DS.lightBorder,
                      },
                    ]}
                    onPress={handleAddToFeed}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={DS.primary} />
                    <Text style={[s.heroFeedText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                      Add to Feed
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </View>

      {/* Sort & create bar */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={[s.sortBar, { marginHorizontal: 16, marginTop: 12, marginBottom: 12 }]}
      >
        <View style={s.sortBarLeft}>
          <TouchableOpacity
            style={[
              s.sortButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
            ]}
            onPress={() => {
              const cycle = { trending: 'newest', newest: 'popular', popular: 'trending' };
              setSortBy((prev) => cycle[prev] as typeof sortBy);
              triggerHaptic?.('light');
            }}
          >
            <Ionicons name="swap-vertical" size={14} color={isDark ? DS.gray400 : DS.gray500} />
            <Text style={[s.sortText, { color: isDark ? DS.gray400 : DS.gray600 }]}>
              {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
          </TouchableOpacity>
          <Text style={[s.postCountText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.createBtn}
          onPress={navigateToCreatePost}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[topicColor, DS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="create-outline" size={16} color={DS.white} />
          <Text style={s.createBtnText}>New Post</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Posts list */}
      <Animated.FlatList
        ref={listRef}
        data={sortedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.postsList, { paddingBottom: NAV_PILL_TOTAL_HEIGHT + 20 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RNRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors?.spinnerColor || DS.primary}
            colors={[DS.primary]}
            progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
          />
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)']
                  : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
              }
              style={s.emptyIconWrap}
            >
              <Ionicons name="document-text-outline" size={40} color={DS.primary} />
            </LinearGradient>
            <Text style={[s.emptyText, { color: isDark ? DS.white : DS.gray900 }]}>
              No posts yet
            </Text>
            <Text style={[s.emptySubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Be the first to post in {displayTopic.name}!
            </Text>
            <TouchableOpacity onPress={navigateToCreatePost} style={s.emptyPostBtn} activeOpacity={0.85}>
              <LinearGradient
                colors={[topicColor, DS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.emptyPostGradient}
              >
                <Ionicons name="create-outline" size={18} color={DS.white} />
                <Text style={s.emptyPostText}>Create Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   Styles
   ════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '600' },

  glassCard: {
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  /* Header */
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  /* Hero */
  heroAuraTopLeft: {
    position: 'absolute',
    top: -60,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.9,
  },
  heroAuraBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.8,
  },
  heroContent: { padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  heroEmojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 30 },
  heroTitleContainer: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  heroCategoryText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  heroDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 14,
  },
  heroStatItem: { alignItems: 'center', gap: 2, flex: 1 },
  heroStatIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroStatValue: { fontSize: 17, fontWeight: '800' },
  heroStatLabel: { fontSize: 11, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 36 },

  heroActions: { flexDirection: 'row', gap: 10 },
  heroJoinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroJoinText: { fontSize: 14, fontWeight: '800' },
  heroFeedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroFeedText: { fontSize: 13, fontWeight: '700' },

  /* Sort bar */
  sortBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sortText: { fontSize: 13, fontWeight: '700' },
  postCountText: { fontSize: 12, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  createBtnText: { fontSize: 13, fontWeight: '800', color: DS.white },

  postsList: { paddingHorizontal: 16 },

  /* Post card */
  postCardInner: { padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postHeaderText: { marginLeft: 12, flex: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postAuthor: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  postTime: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${DS.warning}18`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendingBadgeText: { fontSize: 9, fontWeight: '800', color: DS.warning },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  readMoreText: { fontSize: 13, fontWeight: '700', color: DS.primary, marginBottom: 10 },

  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  postImageWrap: { borderRadius: 12, overflow: 'hidden' },
  postImage: { width: '100%', height: '100%' },
  postImageMore: {
    position: 'relative',
    flex: 1,
    minWidth: (SCREEN_W - 88) / 2,
    height: 150,
  },
  postImageMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  postImageMoreText: { color: DS.white, fontSize: 18, fontWeight: '800' },

  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: DS.gray400, minWidth: 16 },

  commentsSection: { paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  commentContent: { flex: 1 },
  commentBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  commentAuthor: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  commentText: { fontSize: 13, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 12, marginTop: 4, paddingHorizontal: 4 },
  commentActionText: { fontSize: 11, fontWeight: '600' },
  viewAllComments: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  viewAllCommentsText: { fontSize: 13, fontWeight: '700' },

  /* Comment input */
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  commentInput: { flex: 1, fontSize: 14, paddingVertical: 8, maxHeight: 80 },
  commentSendBtn: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', marginLeft: 4 },
  commentSendGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  /* Category */
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeEmoji: { fontSize: 10 },
  categoryBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },

  /* Empty / Error */
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 16, marginTop: 4, fontWeight: '800' },
  emptySubtext: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  emptyPostBtn: { marginTop: 16, borderRadius: 14, overflow: 'hidden', ...DS.shadow.sm },
  emptyPostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyPostText: { color: DS.white, fontSize: 14, fontWeight: '800' },

  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorText: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  errorSubtext: { fontSize: 14, marginBottom: 20 },
  goBackButton: { borderRadius: 14, overflow: 'hidden', ...DS.shadow.sm },
  goBackGradient: { paddingHorizontal: 24, paddingVertical: 12 },
  goBackText: { color: DS.white, fontSize: 15, fontWeight: '800' },
});