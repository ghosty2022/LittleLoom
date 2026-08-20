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
} from 'react-native';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';

import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { Post, Topic, useCommunity, INITIAL_TOPICS, refreshTopics, TOPIC_CATEGORIES } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useSafeCustomization } from '../../hooks/useSafeContexts';
import { useUser } from '../../context/UserContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { supabase } from '../../services/supabaseClient';

import {
  CommunityColors,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

type TopicScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Topic'>;

const { width } = Dimensions.get('window');

const PILL_HEIGHT = 68;
const PILL_MARGIN = 14;
const SAFE_AREA_BOTTOM = 20;
const NAV_PILL_TOTAL_HEIGHT = PILL_HEIGHT + PILL_MARGIN + SAFE_AREA_BOTTOM;

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
  const listRef = useRef<FlatList>(null);

  // Get user's theme preference
  const { settings } = useSafeCustomization?.() || { settings: { darkMode: false } };
  const isDark = settings?.darkMode ?? false;

  // Check if user has this topic selected
  const userTopics = useMemo(() => getSelectedTopics(), [getSelectedTopics]);
  const isTopicSelected = useMemo(() => userTopics.includes(topicId), [userTopics, topicId]);

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
            isJoined: false, // Will be updated from context
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
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [topicId, getTopicById, getPostsByTopic, realTopicData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    const topicPosts = getPostsByTopic(topicId);
    setPosts(topicPosts);
    setRefreshing(false);
  }, [topicId, refreshFeed, getPostsByTopic]);

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
      default:
        return b.commentsCount - a.commentsCount;
    }
  });

  const getTopicColor = (topicId: string) => {
    const t = topics.find(t => t.id === topicId) || INITIAL_TOPICS.find(t => t.id === topicId);
    return t?.color || '#667eea';
  };

  // ─── Render Post ───
  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const topicColor = getTopicColor(item.topicId);
      const hasImages = item.images && item.images.length > 0;
      const isOwnPost = item.authorId === currentUser?.id;

      return (
        <Animated.View 
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30).duration(400).springify()}
          layout={Layout.springify()}
        >
          <View style={[styles.postCard, { backgroundColor: isDark ? '#292524' : '#fff' }]}>
            <View style={[styles.postCardInner, { padding: 16 }]}>
              {/* Author Row */}
              <TouchableOpacity
                style={styles.postHeader}
                onPress={() => navigateToUserProfile(item.author.id)}
              >
                <SafeAvatar
                  avatar={item.author.avatar}
                  size={40}
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
                    {item.time}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Sentiment Indicator */}
              <SentimentIndicator text={item.content} isDark={isDark} />

              {/* Content */}
              <TouchableOpacity
                onPress={() => navigateToPostDetail(item.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.postContent, { color: isDark ? '#d6d3d1' : '#44403c' }]} numberOfLines={3}>
                  {item.content}
                </Text>
              </TouchableOpacity>

              {/* Thread Summary */}
              <ThreadSummary content={item.content} isDark={isDark} />

              {/* Images with blur */}
              {hasImages && (
                <View style={styles.postImagesContainer}>
                  {item.images!.slice(0, 2).map((img, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.postImageWrap, { flex: 1, minWidth: (width - 80) / 2, height: 120 }]}
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

              {/* Topic Tag with Category */}
              <TouchableOpacity
                style={[styles.topicTag, { backgroundColor: `${topicColor}15` }]}
                onPress={() => navigation.navigate('Topic', { topicId: item.topicId })}
              >
                <Text style={[styles.topicTagText, { color: topicColor }]}>
                  {item.topic}
                </Text>
                {item.topicId && (
                  <CategoryBadge 
                    categoryId={(topic as any)?.category} 
                    isDark={isDark} 
                  />
                )}
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.action} onPress={() => handlePostLike(item)}>
                  <Ionicons
                    name={item.isLiked ? 'heart' : 'heart-outline'}
                    size={20}
                    color={item.isLiked ? CommunityColors.error : (isDark ? '#78716c' : CommunityColors.text.secondary)}
                  />
                  <Text style={[styles.actionText, item.isLiked && styles.actionTextActive, { color: isDark ? '#78716c' : CommunityColors.text.secondary }]}>
                    {item.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => navigateToPostDetail(item.id)}>
                  <Ionicons name="chatbubble-outline" size={20} color={isDark ? '#78716c' : CommunityColors.text.secondary} />
                  <Text style={[styles.actionText, { color: isDark ? '#78716c' : CommunityColors.text.secondary }]}>
                    {item.commentsCount}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostRepost(item)}>
                  <Ionicons
                    name={item.isReposted ? 'repeat' : 'repeat-outline'}
                    size={20}
                    color={item.isReposted ? CommunityColors.secondary : (isDark ? '#78716c' : CommunityColors.text.secondary)}
                  />
                  <Text style={[styles.actionText, item.isReposted && styles.actionTextActive, { color: isDark ? '#78716c' : CommunityColors.text.secondary }]}>
                    {item.reposts}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostShare(item)}>
                  <Ionicons name="share-outline" size={20} color={isDark ? '#78716c' : CommunityColors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostBookmark(item)}>
                  <Ionicons
                    name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={item.isBookmarked ? CommunityColors.primary : (isDark ? '#78716c' : CommunityColors.text.secondary)}
                  />
                </TouchableOpacity>

                {isOwnPost && (
                  <TouchableOpacity style={styles.action} onPress={() => handlePostDelete(item)}>
                    <Ionicons name="trash-outline" size={20} color={CommunityColors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
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
    ]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}>
        <ActivityIndicator size="large" color={themeColors.spinnerColor} />
        <Text style={[styles.loadingText, { color: isDark ? '#78716c' : CommunityColors.text.secondary }]}>
          Loading topic...
        </Text>
      </View>
    );
  }

  if (!topic) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={isDark ? '#78716c' : CommunityColors.text.tertiary} />
        <Text style={[styles.errorText, { color: isDark ? '#d6d3d1' : CommunityColors.text.secondary }]}>
          Topic not found
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayTopic = realTopicData || topic;
  const topicColor = displayTopic.color || '#667eea';

  return (
    <LinearGradient
      colors={isDark ? 
        [`${topicColor}15`, '#0c0a09'] : 
        [topicColor + '20', ...CommunityColors.background.gradient]
      }
      style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#f8f9ff' }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <LinearGradient
        colors={isDark ? 
          [`${topicColor}30`, `${topicColor}10`, 'transparent'] :
          [topicColor + '60', topicColor + '20', 'transparent']
        }
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' }]}>
            <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : CommunityColors.text.primary }]}>
            {displayTopic.name}
          </Text>
          <TouchableOpacity
            onPress={() =>
              sweetAlert.confirm(
                'Topic Options',
                'What would you like to do?',
                () => navigation.navigate('Report', {
                  type: 'topic',
                  targetId: displayTopic.id,
                  targetUserId: 'system',
                }),
                undefined,
                'Report',
                'Cancel'
              )
            }
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.topicInfo}>
          <Text style={styles.topicEmoji}>{displayTopic.emoji}</Text>
          <Text style={[styles.topicName, { color: topicColor }]}>{displayTopic.name}</Text>
          
          {/* Category Badge */}
          {displayTopic.category && (
            <View style={[styles.categoryBadgeLarge, { backgroundColor: `${topicColor}15` }]}>
              <Text style={styles.categoryBadgeLargeEmoji}>
                {TOPIC_CATEGORIES.find(c => c.id === displayTopic.category)?.emoji || '📌'}
              </Text>
              <Text style={[styles.categoryBadgeLargeText, { color: topicColor }]}>
                {TOPIC_CATEGORIES.find(c => c.id === displayTopic.category)?.name || displayTopic.category}
                {displayTopic.subcategory && ` · ${displayTopic.subcategory}`}
              </Text>
            </View>
          )}
          
          <Text style={[styles.topicDescription, { color: isDark ? '#a8a29e' : CommunityColors.text.secondary }]}>
            {displayTopic.description}
          </Text>
          
          <View style={styles.topicStats}>
            <TouchableOpacity style={[styles.statPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }]} onPress={() => navigation.navigate('TopicMembers', { topicId })}>
              <Ionicons name="people" size={14} color={isDark ? '#a8a29e' : CommunityColors.text.secondary} />
              <Text style={[styles.stat, { color: isDark ? '#a8a29e' : CommunityColors.text.secondary }]}>
                {displayTopic.members.toLocaleString()} members
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }]}>
              <Ionicons name="document-text" size={14} color={isDark ? '#a8a29e' : CommunityColors.text.secondary} />
              <Text style={[styles.stat, { color: isDark ? '#a8a29e' : CommunityColors.text.secondary }]}>
                {displayTopic.posts.toLocaleString()} posts
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.topicActions}>
            <TouchableOpacity
              style={[styles.joinButton, topic.isJoined && styles.joinedButton]}
              onPress={handleJoinToggle}
            >
              <LinearGradient
                colors={topic.isJoined ? 
                  isDark ? [`${topicColor}20`, `${topicColor}10`] : [`${topicColor}20`, `${topicColor}10`] :
                  [topicColor, topicColor + 'dd']
                }
                style={styles.joinButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.joinText, topic.isJoined && styles.joinedText]}>
                  {topic.isJoined ? '✓ Joined' : 'Join Topic'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {!isTopicSelected && currentUser && (
              <TouchableOpacity
                style={[styles.addToFeedBtn, { backgroundColor: `${topicColor}15` }]}
                onPress={navigateToEditTopics}
              >
                <Text style={[styles.addToFeedText, { color: topicColor }]}>
                  Add to Feed
                </Text>
                <Ionicons name="add-circle-outline" size={16} color={topicColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.content, { backgroundColor: isDark ? 'rgba(12,10,9,0.6)' : 'rgba(255,255,255,0.3)' }]}>
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: isDark ? '#292524' : CommunityColors.background.card }]}
            onPress={() => {
              const cycle = { trending: 'newest', newest: 'popular', popular: 'trending' };
              setSortBy(prev => cycle[prev] as typeof sortBy);
              triggerHaptic('light');
            }}
          >
            <Text style={[styles.sortText, { color: isDark ? '#a8a29e' : CommunityColors.text.secondary }]}>
              {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={isDark ? '#78716c' : CommunityColors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, { backgroundColor: isDark ? '#292524' : CommunityColors.background.card }]}>
            <Ionicons name="funnel-outline" size={20} color={CommunityColors.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={sortedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.postsList,
            { paddingBottom: NAV_PILL_TOTAL_HEIGHT + 20 },
          ]}
          showsVerticalScrollIndicator={false}
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
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <Ionicons name="document-text-outline" size={48} color={isDark ? '#78716c' : CommunityColors.text.tertiary} />
              </View>
              <Text style={[styles.emptyText, { color: isDark ? '#d6d3d1' : CommunityColors.text.secondary }]}>
                No posts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: isDark ? '#78716c' : CommunityColors.text.tertiary }]}>
                Be the first to post in {displayTopic.name}!
              </Text>
              <TouchableOpacity style={styles.emptyPostBtn} onPress={navigateToCreatePost}>
                <LinearGradient colors={[topicColor, topicColor + 'dd']} style={styles.emptyPostGradient}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.emptyPostText}>Create Post</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      <TouchableOpacity style={[styles.fab, { backgroundColor: topicColor }]} onPress={navigateToCreatePost}>
        <LinearGradient colors={[topicColor, topicColor + 'aa']} style={styles.fabGradient}>
          <Ionicons name="create-outline" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
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
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  topicInfo: { alignItems: 'center' },
  topicEmoji: { fontSize: 80, marginBottom: 12 },
  topicName: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  topicDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 40,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stat: { fontSize: 13, fontWeight: '600' },
  topicActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  joinButton: {
    borderRadius: 24,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  joinButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  joinedButton: { opacity: 0.8 },
  joinText: { color: 'white', fontSize: 16, fontWeight: '700' },
  joinedText: { color: CommunityColors.primary },
  addToFeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addToFeedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryBadgeLargeEmoji: { fontSize: 14 },
  categoryBadgeLargeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortText: { fontSize: 14, fontWeight: '600' },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsList: {
    paddingHorizontal: CommunitySpacing.lg,
  },
  postCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  postCardInner: {
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: { marginLeft: 12, flex: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postAuthor: { fontSize: 15, fontWeight: '700' },
  postTime: { fontSize: 13, marginTop: 2 },
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
    marginBottom: 12,
  },
  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  postImageWrap: {
    borderRadius: CommunityBorderRadius.lg,
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
    height: 120,
  },
  postImageMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImageMoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  topicTagText: {
    fontSize: 11,
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
  postActions: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '600' },
  actionTextActive: { color: CommunityColors.primary },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...CommunityShadows.lg,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  },
  emptyText: { fontSize: 16, marginTop: 12, fontWeight: '700' },
  emptySubtext: { fontSize: 14, marginTop: 4 },
  emptyPostBtn: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyPostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyPostText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: { fontSize: 18, marginBottom: 16, marginTop: 12 },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
});