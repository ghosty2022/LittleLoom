import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';

import Animated, { FadeInUp } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { Post, Topic, useCommunity } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useSafeCustomization } from '../../hooks/useSafeContexts';
import { useUser } from '../../context/UserContext';

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

const AvatarImage = ({ uri, size = 40 }: { uri: string; size?: number }) => (
  <SafeAvatar
    avatar={uri}
    size={size}
    fallbackIcon="person"
    fallbackColor={CommunityColors.primary}
    fallbackBgColor={CommunityColors.primary + '20'}
    borderWidth={0}
  />
);

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
  } = useCommunity();
  const { communityProfile } = useUser();

  const {
    themeColors = { spinnerColor: '#667eea' },
    shouldReduceMotion = false,
    triggerHaptic = () => {},
  } = useSafeCustomization();

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
    } else {
      await joinTopic(topic.id);
      setTopic((prev) =>
        prev ? { ...prev, isJoined: true, members: prev.members + 1 } : undefined
      );
      triggerHaptic('success');
    }
  }, [topic, joinTopic, leaveTopic, triggerHaptic]);

  const handlePostLike = useCallback(
    async (post: Post) => {
      if (post.isLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, likePost, unlikePost, getPostsByTopic]
  );

  const handlePostRepost = useCallback(
    async (post: Post) => {
      if (post.isReposted) {
        await unrepostPost(post.id);
      } else {
        await repostPost(post.id);
      }
      setPosts(getPostsByTopic(topicId));
    },
    [topicId, repostPost, unrepostPost, getPostsByTopic]
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

  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50)}>
        <TouchableOpacity onPress={() => navigateToPostDetail(item.id)} activeOpacity={0.9}>
          <BlurView intensity={80} style={styles.postCard} tint="light">
            <TouchableOpacity
              style={styles.postHeader}
              onPress={() => navigateToUserProfile(item.author.id)}
            >
              <AvatarImage uri={item.author.avatar} size={40} />
              <View style={styles.postHeaderText}>
                <View style={styles.postNameRow}>
                  <Text style={styles.postAuthor}>{item.author.displayName}</Text>
                  {item.author.isVerified && (
                    <Ionicons name="checkmark-circle" size={14} color={CommunityColors.primary} />
                  )}
                </View>
                <Text style={styles.postTime}>{item.time}</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.postContent} numberOfLines={3}>
              {item.content}
            </Text>

            {item.images && item.images.length > 0 && (
              <View style={styles.postImagesContainer}>
                {item.images.map((img, idx) => (
                  <SafeAvatar
                    key={idx}
                    avatar={img}
                    size={(width - 88) / 2}
                    fallbackIcon="image"
                    fallbackColor={CommunityColors.primary}
                    fallbackBgColor={CommunityColors.primary + '15'}
                    borderWidth={1}
                    borderColor={CommunityColors.border}
                    style={styles.postImageAvatar}
                  />
                ))}
              </View>
            )}

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

              <View style={styles.action}>
                <Ionicons name="chatbubble-outline" size={20} color={CommunityColors.text.secondary} />
                <Text style={styles.actionText}>{item.commentsCount}</Text>
              </View>

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

              <TouchableOpacity style={styles.action}>
                <Ionicons name="share-outline" size={20} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    ),
    [shouldReduceMotion, navigateToPostDetail, navigateToUserProfile, handlePostLike, handlePostRepost]
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
                'Cancel',
                true
              )
            }
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={CommunityColors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.topicInfo}>
          <Text style={styles.topicEmoji}>{topic.emoji}</Text>
          <Text style={styles.topicName}>{topic.name}</Text>
          <Text style={styles.topicDescription}>{topic.description}</Text>
          <View style={styles.topicStats}>
            <Text style={styles.stat} onPress={() => navigation.navigate('TopicMembers', { topicId })}>{topic.members.toLocaleString()} members</Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.stat}>{topic.posts.toLocaleString()} posts</Text>
          </View>
          <TouchableOpacity
            style={[styles.joinButton, topic.isJoined && styles.joinedButton]}
            onPress={handleJoinToggle}
          >
            <Text style={[styles.joinText, topic.isJoined && styles.joinedText]}>
              {topic.isJoined ? 'Joined ✓' : 'Join Topic'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() =>
              sweetAlert.confirm(
                'Sort by',
                'Choose sorting option',
                () => setSortBy('trending'),
                undefined,
                'Trending',
                'Cancel'
              )
            }
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.spinnerColor}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={CommunityColors.text.tertiary} />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to post!</Text>
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
  topicInfo: { alignItems: 'center' },
  topicEmoji: { fontSize: 80, marginBottom: 12 },
  topicName: { fontSize: 28, fontWeight: '800', color: CommunityColors.text.primary, marginBottom: 8 },
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
    marginBottom: 20,
  },
  stat: { fontSize: 14, color: CommunityColors.text.secondary },
  statDot: { marginHorizontal: 8, color: CommunityColors.text.tertiary },
  joinButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  joinedButton: { backgroundColor: CommunityColors.primary + '20' },
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
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: { marginLeft: 12, flex: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAuthor: { fontSize: 15, fontWeight: '700', color: CommunityColors.text.primary },
  postTime: { fontSize: 13, color: CommunityColors.text.tertiary, marginTop: 2 },
  postContent: { fontSize: 15, color: CommunityColors.text.primary, lineHeight: 22, marginBottom: 16 },
  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  postImageAvatar: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  postActions: { flexDirection: 'row', gap: 24 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: CommunityColors.text.secondary, fontWeight: '600' },
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
  emptyText: { fontSize: 16, color: CommunityColors.text.secondary, marginTop: 12 },
  emptySubtext: { fontSize: 14, color: CommunityColors.text.tertiary, marginTop: 4 },
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16 },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
});