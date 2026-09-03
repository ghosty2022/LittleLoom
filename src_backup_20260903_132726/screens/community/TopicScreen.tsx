// src/screens/community/TopicScreen.tsx
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
  Keyboard,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';

import Animated, { 
  FadeInUp, 
  Layout, 
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

import { Post, Topic, useCommunity, INITIAL_TOPICS, TOPIC_CATEGORIES, refreshTopics } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useSafeCustomization } from '../../hooks/useSafeContexts';
import { useUser } from '../../context/UserContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { supabase } from '../../services/supabaseClient';

type TopicScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Topic'>;

const { width } = Dimensions.get('window');

const PILL_HEIGHT = 68;
const PILL_MARGIN = 14;
const SAFE_AREA_BOTTOM = 20;
const NAV_PILL_TOTAL_HEIGHT = PILL_HEIGHT + PILL_MARGIN + SAFE_AREA_BOTTOM;

// ─── Glass Card Component ───
const GlassCard = React.memo(({ 
  children, 
  style, 
  isDark, 
  colors = {},
  onPress,
  delay = 0,
}: any) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={[styles.glassCard, { 
        backgroundColor: isDark ? 'rgba(41,41,41,0.85)' : 'rgba(255,255,255,0.85)',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.3)',
      }, style]}
    >
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? 
            ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : 
            ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.glassBorder, { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' 
        }]} />
        {children}
      </Wrapper>
    </Animated.View>
  );
});

// ─── Sensitive Image with Blur ───
const SensitiveImage = React.memo(({ 
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
            <View style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 24, 
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <Ionicons name="shield-checkmark" size={24} color={isDark ? '#fff' : '#666'} />
            </View>
            <Text style={{ color: isDark ? '#fff' : '#333', fontWeight: '700', fontSize: 13 }}>
              Sensitive Content
            </Text>
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', fontSize: 11, marginTop: 4 }}>
              Tap to view
            </Text>
          </View>
        </BlurView>
      )}
    </TouchableOpacity>
  );
});

// ─── Sentiment Indicator ───
const SentimentIndicator = React.memo(({ text, isDark }: { text: string; isDark: boolean }) => {
  const analyzeSentiment = (content: string) => {
    const positiveWords = ['happy', 'joy', 'love', 'great', 'wonderful', 'amazing', 'excellent', 'good', 'beautiful', 'fantastic', 'awesome', 'incredible', 'perfect', 'glad', 'thankful', 'grateful', 'blessed', 'proud', 'exciting', 'milestone', 'achievement', 'success', 'celebrate', 'celebrating'];
    const negativeWords = ['sad', 'upset', 'angry', 'frustrated', 'worried', 'scared', 'tired', 'exhausted', 'overwhelmed', 'stressed', 'anxious', 'depressed', 'struggle', 'difficult', 'hard', 'tough', 'challenging', 'pain', 'cry', 'crying', 'hurt'];
    
    const words = content.toLowerCase().split(/\s+/);
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
  };

  const getEmoji = (sentiment: string) => {
    const map: Record<string, string> = { positive: '😊', negative: '😢', neutral: '😐' };
    return map[sentiment] || '😐';
  };

  const getColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#a8a29e';
    }
  };

  const getLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'Positive';
      case 'negative': return 'Needs support';
      default: return 'Neutral';
    }
  };

  const analysis = analyzeSentiment(text);
  if (analysis.confidence < 0.3) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Text style={{ fontSize: 14 }}>{getEmoji(analysis.sentiment)}</Text>
      <View style={{ flex: 1, height: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0', borderRadius: 1.5, overflow: 'hidden' }}>
        <View style={{ 
          width: `${(analysis.score + 1) / 2 * 100}%`, 
          height: '100%', 
          backgroundColor: getColor(analysis.sentiment),
          borderRadius: 1.5,
        }} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '600', color: getColor(analysis.sentiment) }}>
        {getLabel(analysis.sentiment)}
      </Text>
    </View>
  );
});

// ─── Thread Summary ───
const ThreadSummary = React.memo(({ content, isDark }: { content: string; isDark: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (content.length <= 120) return null;
  
  const summary = content.slice(0, 100) + '...';
  
  return (
    <TouchableOpacity 
      onPress={() => setExpanded(!expanded)}
      style={{ 
        backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="sparkles" size={14} color="#6366f1" />
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#6366f1' }}>
          {expanded ? 'Hide summary' : 'AI Summary'}
        </Text>
      </View>
      <Text style={{ 
        fontSize: 13, 
        color: isDark ? '#d6d3d1' : '#57534e',
        lineHeight: 18,
        marginTop: 4,
      }}>
        {expanded ? content : summary}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Category Badge ───
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
    blockUser,
    isUserBlocked,
    topics,
    getSelectedTopics,
    updateSelectedTopics,
    refreshTopics: refreshTopicsFn,
  } = useCommunity();
  const { communityProfile } = useUser();

  const {
    themeColors = { spinnerColor: '#667eea' },
    shouldReduceMotion = false,
    triggerHaptic = () => {},
  } = useSafeCustomization();
  
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
  const listRef = useRef<FlatList>(null);

  // Get user's theme preference
  const { settings } = useSafeCustomization?.() || { settings: { darkMode: false } };
  const isDark = settings?.darkMode ?? false;

  // Check if user has this topic selected
  const userTopics = useMemo(() => getSelectedTopics(), [getSelectedTopics]);
  const isTopicSelected = useMemo(() => userTopics.includes(topicId), [userTopics, topicId]);

  // Scroll animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  // Fetch real topic data on mount
  useEffect(() => {
    const fetchTopicData = async () => {
      try {
        // Try to get real data from Supabase
        const { data: topicData, error: topicError } = await supabase
          .from('community_topics')
          .select('*')
          .eq('id', topicId)
          .single();

        if (!topicError && topicData) {
          // Get real post count
          const { count: postCount, error: postError } = await supabase
            .from('community_posts')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId);

          // Get real member count
          const { count: memberCount, error: memberError } = await supabase
            .from('user_topics')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId);

          setRealTopicData({
            ...topicData,
            posts: postError ? 0 : (postCount || 0),
            members: memberError ? 0 : (memberCount || 0),
            isJoined: false,
            joinedBy: [],
            engagementScore: 0,
            weeklyGrowth: 0,
            trending: topicData.trending || false,
            category: topicData.category || undefined,
            subcategory: topicData.subcategory || undefined,
          });
        }
      } catch (error) {
        console.warn('Failed to fetch real topic data:', error);
      }
    };

    fetchTopicData();
  }, [topicId]);

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
    communityProfile?.displayName,
    communityProfile?.handle,
    communityProfile?.avatar,
    (communityProfile as any)?.bio,
    currentUser?.id,
    communityProfile,
    syncUserProfileAcrossPosts,
    currentUser?.displayName,
    currentUser?.handle,
    currentUser?.avatar,
    currentUser?.bio,
  ]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const currentTopic = getTopicById(topicId);
      const topicPosts = getPostsByTopic(topicId);
      
      // Merge real data with context data
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
      
      // Auto-expand first post if any
      if (topicPosts.length > 0 && !expandedPostId) {
        setExpandedPostId(topicPosts[0].id);
      }
      
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    };

    loadData();
  }, [topicId, getTopicById, getPostsByTopic, realTopicData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    // Refresh topics too
    await refreshTopicsFn();
    const topicPosts = getPostsByTopic(topicId);
    setPosts(topicPosts);
    setRefreshing(false);
  }, [topicId, refreshFeed, getPostsByTopic, refreshTopicsFn]);

  const handleJoinToggle = useCallback(async () => {
    if (!topic) return;

    if (topic.isJoined) {
      await leaveTopic(topic.id);
      setTopic((prev) =>
        prev ? { ...prev, isJoined: false, members: Math.max(0, prev.members - 1) } : undefined
      );
      triggerHaptic('light');
      sweetAlert.toast('Left Topic', `You left ${topic.name}`);
    } else {
      await joinTopic(topic.id);
      setTopic((prev) =>
        prev ? { ...prev, isJoined: true, members: prev.members + 1 } : undefined
      );
      triggerHaptic('success');
      sweetAlert.toast('Joined Topic', `You joined ${topic.name}!`);
    }
  }, [topic, joinTopic, leaveTopic, triggerHaptic, sweetAlert]);

  const handleAddToFeed = useCallback(async () => {
    if (!topic) return;
    
    const currentTopics = getSelectedTopics();
    if (currentTopics.includes(topic.id)) {
      sweetAlert.toast('Already in Feed', `${topic.name} is already in your feed`);
      return;
    }

    const newTopics = [...currentTopics, topic.id];
    await updateSelectedTopics(newTopics);
    triggerHaptic('success');
    sweetAlert.toast('Added to Feed', `${topic.name} added to your feed!`);
  }, [topic, getSelectedTopics, updateSelectedTopics, triggerHaptic, sweetAlert]);

  const handleRemoveFromFeed = useCallback(async () => {
    if (!topic) return;
    
    const currentTopics = getSelectedTopics();
    if (!currentTopics.includes(topic.id)) return;

    const newTopics = currentTopics.filter(id => id !== topic.id);
    await updateSelectedTopics(newTopics);
    triggerHaptic('light');
    sweetAlert.toast('Removed from Feed', `${topic.name} removed from your feed`);
  }, [topic, getSelectedTopics, updateSelectedTopics, triggerHaptic, sweetAlert]);

  const handlePostLike = useCallback(
    async (post: Post) => {
      triggerHaptic('light');
      if (post.isLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, likePost, unlikePost, getPostsByTopic, triggerHaptic]
  );

  const handlePostRepost = useCallback(
    async (post: Post) => {
      triggerHaptic('medium');
      if (post.isReposted) {
        await unrepostPost(post.id);
      } else {
        await repostPost(post.id);
      }
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, repostPost, unrepostPost, getPostsByTopic, triggerHaptic]
  );

  const handlePostBookmark = useCallback(
    async (post: Post) => {
      triggerHaptic('light');
      await bookmarkPost(post.id);
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, bookmarkPost, getPostsByTopic, triggerHaptic]
  );

  const handlePostShare = useCallback(
    async (post: Post) => {
      try {
        await Share.share({
          message: `${post.author.displayName} on The Loom: "${post.content.substring(0, 100)}..."`,
        });
        await sharePost(post.id);
      } catch (error) {
        console.error('Share error:', error);
      }
    },
    [sharePost]
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
        'Cancel'
      );
    },
    [topicId, deletePost, getPostsByTopic, sweetAlert]
  );

  const navigateToPostDetail = useCallback(
    (postId: string) => navigation.navigate('PostDetail', { postId }),
    [navigation]
  );

  const navigateToUserProfile = useCallback(
    (userId: string) => {
      triggerHaptic('light');
      navigation.navigate('CommunityMemberProfile', { userId });
    },
    [navigation, triggerHaptic]
  );

  const navigateToCreatePost = useCallback(
    () => navigation.navigate('CreatePost', { topicId }),
    [navigation, topicId]
  );

  const navigateToEditTopics = useCallback(() => {
    navigation.navigate('CommunityOnboarding' as never, { editing: true } as never);
  }, [navigation]);

  const sortedPosts = [...posts].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'popular':
        return b.likes - a.likes;
      default: // trending
        return b.popularityScore - a.popularityScore || (b.likes - a.likes);
    }
  });

  const getTopicColor = (topicId: string) => {
    const t = topics.find(t => t.id === topicId) || INITIAL_TOPICS.find(t => t.id === topicId);
    return t?.color || '#667eea';
  };

  const renderCommentInput = (postId: string) => {
    if (showCommentInput !== postId) return null;

    const handleSubmit = async () => {
      if (!commentText.trim()) return;
      if (!currentUser) {
        sweetAlert.alert('Sign In Required', 'Please sign in to comment', 'warning');
        return;
      }
      
      // Find the post and add comment using context
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      // Use addComment from context
      const { addComment } = useCommunity();
      await addComment(postId, commentText);
      setCommentText('');
      setShowCommentInput(null);
      // Refresh posts
      setPosts(getPostsByTopic(topicId));
      triggerHaptic('light');
    };

    return (
      <Animated.View entering={FadeInDown.duration(250)} style={[styles.commentInputContainer, {
        backgroundColor: isDark ? 'rgba(41,41,41,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }]}>
        <SafeAvatar
          avatar={currentUser?.avatar}
          size={32}
          fallbackIcon="person"
          fallbackColor="#6366f1"
          fallbackBgColor="rgba(99,102,241,0.15)"
        />
        <View style={[styles.commentInputWrap, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }]}>
          <TextInput
            style={[styles.commentInput, { color: isDark ? '#fff' : '#1a1a2e' }]}
            placeholder="Write a comment..."
            placeholderTextColor="#94a3b8"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            autoFocus
            maxLength={500}
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
            onPress={handleSubmit}
            disabled={!commentText.trim()}
          >
            <LinearGradient
              colors={commentText.trim() ? ['#6366f1', '#4f46e5'] : ['#94a3b8', '#94a3b8']}
              style={styles.commentSendGrad}
            >
              <Ionicons name="arrow-up" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // ─── Render Post ───
  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const topicColor = getTopicColor(item.topicId);
      const hasImages = item.images && item.images.length > 0;
      const isOwnPost = item.authorId === currentUser?.id;
      const isExpanded = expandedPostId === item.id;
      const showComments = isExpanded;

      return (
        <Animated.View 
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30).duration(400).springify()}
          layout={Layout.springify()}
        >
          <GlassCard isDark={isDark} delay={0} style={{ marginBottom: 16 }}>
            <View style={styles.postCardInner}>
              {/* Author Row */}
              <TouchableOpacity
                style={styles.postHeader}
                onPress={() => navigateToUserProfile(item.author.id)}
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
                <View style={styles.postHeaderText}>
                  <View style={styles.postNameRow}>
                    <Text style={[styles.postAuthor, { color: isDark ? '#fff' : '#1c1917' }]}>
                      {item.author.displayName}
                    </Text>
                    {item.author.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color={topicColor} />
                    )}
                    {item.isTrending && (
                      <View style={styles.trendingBadge}>
                        <Ionicons name="flame" size={10} color="#f59e0b" />
                        <Text style={styles.trendingBadgeText}>Trending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.postTime, { color: isDark ? '#78716c' : '#a8a29e' }]}>
                    {item.time} • {item.topic}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Sentiment Indicator */}
              <SentimentIndicator text={item.content} isDark={isDark} />

              {/* Content */}
              <TouchableOpacity
                onPress={() => {
                  if (isExpanded) {
                    setExpandedPostId(null);
                  } else {
                    setExpandedPostId(item.id);
                  }
                }}
                activeOpacity={0.9}
              >
                <Text 
                  style={[styles.postContent, { color: isDark ? '#d6d3d1' : '#44403c' }]} 
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  {item.content}
                </Text>
              </TouchableOpacity>

              {/* Read More Toggle */}
              {item.content.length > 150 && (
                <TouchableOpacity onPress={() => setExpandedPostId(isExpanded ? null : item.id)}>
                  <Text style={styles.readMoreText}>
                    {isExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Thread Summary */}
              <ThreadSummary content={item.content} isDark={isDark} />

              {/* Images with blur */}
              {hasImages && (
                <View style={styles.postImagesContainer}>
                  {item.images!.slice(0, 2).map((img, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.postImageWrap, { 
                        flex: 1, 
                        minWidth: (width - 80) / 2, 
                        height: 150,
                        borderRadius: 12,
                      }]}
                      onPress={() => navigateToPostDetail(item.id)}
                    >
                      <SensitiveImage
                        uri={img}
                        style={styles.postImage}
                        resizeMode="cover"
                        isDark={isDark}
                      />
                    </TouchableOpacity>
                  ))}
                  {item.images!.length > 2 && (
                    <TouchableOpacity
                      style={[styles.postImageWrap, styles.postImageMore]}
                      onPress={() => navigateToPostDetail(item.id)}
                    >
                      <BlurView intensity={80} style={styles.postImageMoreOverlay} tint="dark">
                        <Text style={styles.postImageMoreText}>+{item.images!.length - 2}</Text>
                      </BlurView>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={[styles.postActions, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                <TouchableOpacity style={styles.action} onPress={() => handlePostLike(item)}>
                  <Ionicons
                    name={item.isLiked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={item.isLiked ? '#ec4899' : (isDark ? '#78716c' : '#94a3b8')}
                  />
                  <Text style={[styles.actionText, item.isLiked && { color: '#ec4899' }]}>
                    {item.likes > 0 ? item.likes : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => {
                  setShowCommentInput(showCommentInput === item.id ? null : item.id);
                  if (!isExpanded) setExpandedPostId(item.id);
                }}>
                  <Ionicons name="chatbubble-outline" size={20} color={isDark ? '#78716c' : '#94a3b8'} />
                  <Text style={[styles.actionText, { color: isDark ? '#78716c' : '#94a3b8' }]}>
                    {item.commentsCount > 0 ? item.commentsCount : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostRepost(item)}>
                  <Ionicons
                    name={item.isReposted ? 'repeat' : 'repeat-outline'}
                    size={20}
                    color={item.isReposted ? '#10b981' : (isDark ? '#78716c' : '#94a3b8')}
                  />
                  <Text style={[styles.actionText, item.isReposted && { color: '#10b981' }]}>
                    {item.reposts > 0 ? item.reposts : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostBookmark(item)}>
                  <Ionicons
                    name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={item.isBookmarked ? '#6366f1' : (isDark ? '#78716c' : '#94a3b8')}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostShare(item)}>
                  <Ionicons name="share-outline" size={20} color={isDark ? '#78716c' : '#94a3b8'} />
                </TouchableOpacity>

                {isOwnPost && (
                  <TouchableOpacity style={styles.action} onPress={() => handlePostDelete(item)}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Comments section - expanded */}
              {showComments && item.comments.length > 0 && (
                <View style={[styles.commentsSection, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  {item.comments.slice(0, 3).map((comment) => (
                    <View key={comment.id} style={styles.commentRow}>
                      <SafeAvatar
                        avatar={comment.author.avatar}
                        size={28}
                        fallbackIcon="person"
                        fallbackColor="#6366f1"
                        fallbackBgColor="rgba(99,102,241,0.15)"
                      />
                      <View style={styles.commentContent}>
                        <View style={[styles.commentBubble, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                        }]}>
                          <Text style={[styles.commentAuthor, { color: isDark ? '#fff' : '#1c1917' }]}>
                            {comment.author.displayName}
                          </Text>
                          <Text style={[styles.commentText, { color: isDark ? '#d6d3d1' : '#44403c' }]}>
                            {comment.content}
                          </Text>
                        </View>
                        <View style={styles.commentActions}>
                          <Text style={[styles.commentActionText, { color: isDark ? '#78716c' : '#94a3b8' }]}>
                            {comment.time}
                          </Text>
                          <TouchableOpacity>
                            <Text style={[styles.commentActionText, { color: isDark ? '#78716c' : '#94a3b8' }]}>
                              Like
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                  {item.commentsCount > 3 && (
                    <TouchableOpacity 
                      onPress={() => navigateToPostDetail(item.id)}
                      style={styles.viewAllComments}
                    >
                      <Text style={[styles.viewAllCommentsText, { color: '#6366f1' }]}>
                        View all {item.commentsCount} comments
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#6366f1" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </GlassCard>

          {/* Comment Input - rendered outside the card for better UX */}
          {showCommentInput === item.id && renderCommentInput(item.id)}
        </Animated.View>
      );
    },
    [
      shouldReduceMotion,
      navigateToPostDetail,
      navigateToUserProfile,
      handlePostLike,
      handlePostRepost,
      handlePostBookmark,
      handlePostShare,
      handlePostDelete,
      currentUser,
      navigation,
      isDark,
      topics,
      topic,
      showCommentInput,
      expandedPostId,
    ]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}>
        <ActivityIndicator size="large" color={themeColors.spinnerColor} />
        <Text style={[styles.loadingText, { color: isDark ? '#78716c' : '#94a3b8' }]}>
          Loading topic...
        </Text>
      </View>
    );
  }

  if (!topic) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <Ionicons name="alert-circle-outline" size={48} color={isDark ? '#78716c' : '#94a3b8'} />
          </View>
          <Text style={[styles.errorText, { color: isDark ? '#d6d3d1' : '#44403c' }]}>
            Topic not found
          </Text>
          <Text style={[styles.errorSubtext, { color: isDark ? '#78716c' : '#94a3b8' }]}>
            The topic you're looking for doesn't exist.
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.goBackButton, { backgroundColor: '#6366f1' }]}
          >
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayTopic = realTopicData || topic;
  const topicColor = displayTopic.color || '#667eea';
  const category = TOPIC_CATEGORIES.find(c => c.id === displayTopic.category);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { 
        backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }, headerOpacity]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1c1917'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1c1917' }]}>
            {displayTopic.name}
          </Text>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? '#fff' : '#1c1917'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Hero Section with Glassmorphism */}
      <Animated.View 
        entering={FadeInUp.delay(100).duration(500).springify()}
        style={[styles.heroSection, { 
          marginTop: Platform.OS === 'ios' ? 50 : 40,
        }]}
      >
        <GlassCard isDark={isDark} style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroEmojiContainer}>
                <Text style={styles.heroEmoji}>{displayTopic.emoji}</Text>
              </View>
              <View style={styles.heroTitleContainer}>
                <Text style={[styles.heroName, { color: isDark ? '#fff' : '#1c1917' }]}>
                  {displayTopic.name}
                </Text>
                {category && (
                  <View style={[styles.heroCategoryBadge, { backgroundColor: `${topicColor}15` }]}>
                    <Text style={[styles.heroCategoryText, { color: topicColor }]}>
                      {category.emoji} {category.name}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={[styles.heroDescription, { color: isDark ? '#a8a29e' : '#57534e' }]}>
              {displayTopic.description}
            </Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Ionicons name="people" size={14} color={isDark ? '#a8a29e' : '#57534e'} />
                </View>
                <Text style={[styles.heroStatValue, { color: isDark ? '#fff' : '#1c1917' }]}>
                  {displayTopic.members.toLocaleString()}
                </Text>
                <Text style={[styles.heroStatLabel, { color: isDark ? '#78716c' : '#94a3b8' }]}>Members</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Ionicons name="document-text" size={14} color={isDark ? '#a8a29e' : '#57534e'} />
                </View>
                <Text style={[styles.heroStatValue, { color: isDark ? '#fff' : '#1c1917' }]}>
                  {displayTopic.posts.toLocaleString()}
                </Text>
                <Text style={[styles.heroStatLabel, { color: isDark ? '#78716c' : '#94a3b8' }]}>Posts</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Ionicons name="trending-up" size={14} color={isDark ? '#a8a29e' : '#57534e'} />
                </View>
                <Text style={[styles.heroStatValue, { color: isDark ? '#fff' : '#1c1917' }]}>
                  {displayTopic.engagementScore || 0}
                </Text>
                <Text style={[styles.heroStatLabel, { color: isDark ? '#78716c' : '#94a3b8' }]}>Engagement</Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.heroJoinBtn, { 
                  backgroundColor: topic.isJoined ? 'rgba(255,255,255,0.08)' : topicColor,
                  borderColor: topic.isJoined ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' : 'transparent',
                }]}
                onPress={handleJoinToggle}
              >
                <Text style={[styles.heroJoinText, { 
                  color: topic.isJoined ? (isDark ? '#fff' : '#1c1917') : '#fff',
                }]}>
                  {topic.isJoined ? '✓ Joined' : 'Join'}
                </Text>
              </TouchableOpacity>

              {isTopicSelected ? (
                <TouchableOpacity
                  style={[styles.heroFeedBtn, { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }]}
                  onPress={handleRemoveFromFeed}
                >
                  <Ionicons name="checkmark-circle" size={16} color={isDark ? '#a8a29e' : '#57534e'} />
                  <Text style={[styles.heroFeedText, { color: isDark ? '#a8a29e' : '#57534e' }]}>
                    In Feed
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.heroFeedBtn, { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }]}
                  onPress={handleAddToFeed}
                >
                  <Ionicons name="add-circle-outline" size={16} color={isDark ? '#a8a29e' : '#57534e'} />
                  <Text style={[styles.heroFeedText, { color: isDark ? '#a8a29e' : '#57534e' }]}>
                    Add to Feed
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Sort & Create Bar */}
      <Animated.View 
        entering={FadeInDown.delay(200).duration(400)}
        style={[styles.sortBar, { 
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 12,
        }]}
      >
        <View style={styles.sortBarLeft}>
          <TouchableOpacity
            style={[styles.sortButton, { 
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }]}
            onPress={() => {
              const cycle = { trending: 'newest', newest: 'popular', popular: 'trending' };
              setSortBy(prev => cycle[prev as keyof typeof cycle] as typeof sortBy);
              triggerHaptic('light');
            }}
          >
            <Ionicons name="swap-vertical" size={14} color={isDark ? '#a8a29e' : '#57534e'} />
            <Text style={[styles.sortText, { color: isDark ? '#a8a29e' : '#57534e' }]}>
              {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.postCountText, { color: isDark ? '#78716c' : '#94a3b8' }]}>
            {posts.length} posts
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: topicColor }]}
          onPress={navigateToCreatePost}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.createBtnText}>New Post</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Posts List */}
      <Animated.FlatList
        ref={listRef}
        data={sortedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.postsList,
          { paddingBottom: NAV_PILL_TOTAL_HEIGHT + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RNRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.spinnerColor}
            progressBackgroundColor={isDark ? '#292524' : '#fff'}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { 
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            }]}>
              <Ionicons name="document-text-outline" size={48} color={isDark ? '#78716c' : '#94a3b8'} />
            </View>
            <Text style={[styles.emptyText, { color: isDark ? '#d6d3d1' : '#44403c' }]}>
              No posts yet
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? '#78716c' : '#94a3b8' }]}>
              Be the first to post in {displayTopic.name}!
            </Text>
            <TouchableOpacity 
              style={[styles.emptyPostBtn, { backgroundColor: topicColor }]} 
              onPress={navigateToCreatePost}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.emptyPostText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },

  // Glass Card
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  // Animated Header
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: 0,
  },
  heroContent: {
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  heroEmojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  heroEmoji: {
    fontSize: 32,
  },
  heroTitleContainer: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  heroCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.04)',
  },
  heroStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  heroStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroJoinBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  heroJoinText: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroFeedBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  heroFeedText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Sort Bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },
  postCountText: {
    fontSize: 13,
    fontWeight: '500',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Posts List
  postsList: {
    paddingHorizontal: 16,
  },

  // Post Card
  postCardInner: {
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
  },
  postTime: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f59e0b15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f59e0b',
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 10,
  },

  // Post Images
  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  postImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postImageMore: {
    position: 'relative',
    flex: 1,
    minWidth: (width - 88) / 2,
    height: 150,
  },
  postImageMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  postImageMoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  // Post Actions
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    minWidth: 16,
  },

  // Comments Section
  commentsSection: {
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  commentActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  viewAllCommentsText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Comment Input
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginHorizontal: 16,
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
  commentInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginLeft: 4,
  },
  commentSendBtnDisabled: {
    opacity: 0.5,
  },
  commentSendGrad: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category Badge
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyPostText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    marginBottom: 20,
  },
  goBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});