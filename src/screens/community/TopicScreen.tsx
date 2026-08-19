// src/screens/community/TopicScreen.tsx
import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl as RNRefreshControl,  // Rename imported RefreshControl
  StatusBar,
  FlatList,
  Image,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';

import Animated, { FadeInUp } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { Post, Topic, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useSafeCustomization } from '../../hooks/useSafeContexts';
import { useUser } from '../../context/UserContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { Share } from 'react-native';

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

// ─── Sensitive Image ───
const SensitiveImage = ({ uri, style, resizeMode = 'cover' }: { uri: string; style?: any; resizeMode?: any }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => setRevealed(true)} disabled={revealed} style={style}>
      <Image source={{ uri }} style={[style, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} resizeMode={resizeMode} />
      {!revealed && (
        <BlurView intensity={75} style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]} tint="dark">
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8, fontSize: 13 }}>Sensitive Content</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>Tap to view</Text>
          </View>
        </BlurView>
      )}
    </TouchableOpacity>
  );
};

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
    setTopic(currentTopic);
    setPosts(topicPosts);
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, [topicId, getTopicById, getPostsByTopic]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    setPosts(getPostsByTopic(topicId));
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
          message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
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
    const t = INITIAL_TOPICS.find(t => t.id === topicId);
    return t?.color || '#667eea';
  };

  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const topicColor = getTopicColor(item.topicId);
      const hasImages = item.images && item.images.length > 0;
      const isOwnPost = item.authorId === currentUser?.id;

      return (
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50)}>
          <View style={styles.postCard}>
            <BlurView intensity={80} style={styles.postCardInner} tint="light">
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
                    <Text style={styles.postAuthor}>{item.author.displayName}</Text>
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
                  <Text style={styles.postTime}>{item.time}</Text>
                </View>
              </TouchableOpacity>

              {/* Content */}
              <TouchableOpacity
                onPress={() => navigateToPostDetail(item.id)}
                activeOpacity={0.9}
              >
                <Text style={styles.postContent} numberOfLines={3}>
                  {item.content}
                </Text>
              </TouchableOpacity>

              {/* Images */}
              {hasImages && (
                <View style={styles.postImagesContainer}>
                  {item.images!.slice(0, 2).map((img, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.postImageWrap}
                      onPress={() => navigateToPostDetail(item.id)}
                    >
                      <SensitiveImage
                        uri={img}
                        style={styles.postImage}
                        resizeMode="cover"
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

              {/* Topic Tag */}
              <TouchableOpacity
                style={[styles.topicTag, { backgroundColor: `${topicColor}15` }]}
                onPress={() => navigation.navigate('Topic', { topicId: item.topicId })}
              >
                <Text style={[styles.topicTagText, { color: topicColor }]}>
                  {item.topic}
                </Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.action} onPress={() => handlePostLike(item)}>
                  <Ionicons
                    name={item.isLiked ? 'heart' : 'heart-outline'}
                    size={20}
                    color={item.isLiked ? CommunityColors.error : CommunityColors.text.secondary}
                  />
                  <Text style={[styles.actionText, item.isLiked && styles.actionTextActive]}>
                    {item.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => navigateToPostDetail(item.id)}>
                  <Ionicons name="chatbubble-outline" size={20} color={CommunityColors.text.secondary} />
                  <Text style={styles.actionText}>{item.commentsCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostRepost(item)}>
                  <Ionicons
                    name={item.isReposted ? 'repeat' : 'repeat-outline'}
                    size={20}
                    color={item.isReposted ? CommunityColors.secondary : CommunityColors.text.secondary}
                  />
                  <Text style={[styles.actionText, item.isReposted && styles.actionTextActive]}>
                    {item.reposts}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostShare(item)}>
                  <Ionicons name="share-outline" size={20} color={CommunityColors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.action} onPress={() => handlePostBookmark(item)}>
                  <Ionicons
                    name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={item.isBookmarked ? CommunityColors.primary : CommunityColors.text.secondary}
                  />
                </TouchableOpacity>

                {isOwnPost && (
                  <TouchableOpacity style={styles.action} onPress={() => handlePostDelete(item)}>
                    <Ionicons name="trash-outline" size={20} color={CommunityColors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
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
    ]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={themeColors.spinnerColor} />
        <Text style={styles.loadingText}>Loading topic...</Text>
      </View>
    );
  }

  if (!topic) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color={CommunityColors.text.tertiary} />
        <Text style={styles.errorText}>Topic not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[topic.color + '20', ...CommunityColors.background.gradient]}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={[topic.color + '60', topic.color + '20', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={CommunityColors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{topic.name}</Text>
          <TouchableOpacity
            onPress={() =>
              sweetAlert.confirm(
                'Topic Options',
                'What would you like to do?',
                () => navigation.navigate('Report', {
                  type: 'topic',
                  targetId: topic.id,
                  targetUserId: 'system',
                }),
                undefined,
                'Report',
                'Cancel'
              )
            }
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={CommunityColors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.topicInfo}>
          <Text style={styles.topicEmoji}>{topic.emoji}</Text>
          <Text style={[styles.topicName, { color: topic.color }]}>{topic.name}</Text>
          <Text style={styles.topicDescription}>{topic.description}</Text>
          <View style={styles.topicStats}>
            <TouchableOpacity style={styles.statPill} onPress={() => navigation.navigate('TopicMembers', { topicId })}>
              <Ionicons name="people" size={14} color={CommunityColors.text.secondary} />
              <Text style={styles.stat}>{topic.members.toLocaleString()} members</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPill}>
              <Ionicons name="document-text" size={14} color={CommunityColors.text.secondary} />
              <Text style={styles.stat}>{topic.posts.toLocaleString()} posts</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.joinButton, topic.isJoined && styles.joinedButton]}
            onPress={handleJoinToggle}
          >
            <LinearGradient
              colors={topic.isJoined ? [`${topic.color}20`, `${topic.color}10`] : [topic.color, topic.color + 'dd']}
              style={styles.joinButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.joinText, topic.isJoined && styles.joinedText]}>
                {topic.isJoined ? '✓ Joined' : 'Join Topic'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const cycle = { trending: 'newest', newest: 'popular', popular: 'trending' };
              setSortBy(prev => cycle[prev] as typeof sortBy);
              triggerHaptic('light');
            }}
          >
            <Text style={styles.sortText}>
              {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={CommunityColors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="funnel-outline" size={20} color={CommunityColors.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
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
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={48} color={CommunityColors.text.tertiary} />
              </View>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to post in {topic.name}!</Text>
              <TouchableOpacity style={styles.emptyPostBtn} onPress={navigateToCreatePost}>
                <LinearGradient colors={[topic.color, topic.color + 'dd']} style={styles.emptyPostGradient}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.emptyPostText}>Create Post</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      <TouchableOpacity style={styles.fab} onPress={navigateToCreatePost}>
        <LinearGradient colors={[topic.color, topic.color + 'aa']} style={styles.fabGradient}>
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
    color: CommunityColors.text.secondary,
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
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
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
    color: CommunityColors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 40,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stat: { fontSize: 13, color: CommunityColors.text.secondary, fontWeight: '600' },
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
  content: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    backgroundColor: CommunityColors.background.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortText: { fontSize: 14, fontWeight: '600', color: CommunityColors.text.secondary },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.background.card,
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
    padding: 20,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: { marginLeft: 12, flex: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postAuthor: { fontSize: 15, fontWeight: '700', color: CommunityColors.text.primary },
  postTime: { fontSize: 13, color: CommunityColors.text.tertiary, marginTop: 2 },
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
    color: CommunityColors.text.primary,
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
    flex: 1,
    minWidth: (width - 88) / 2,
    height: 120,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postImageMore: {
    position: 'relative',
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
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  topicTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postActions: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: CommunityColors.text.secondary, fontWeight: '600' },
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 16, color: CommunityColors.text.secondary, marginTop: 12, fontWeight: '700' },
  emptySubtext: { fontSize: 14, color: CommunityColors.text.tertiary, marginTop: 4 },
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
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16, marginTop: 12 },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
});