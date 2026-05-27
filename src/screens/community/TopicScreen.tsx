// src/screens/community/TopicScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type TopicScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Topic'>;

const { width } = Dimensions.get('window');

// ─── Avatar Component (Same as CommunityScreen) ───────────────
const AvatarImage = ({ uri, size = 40 }: { uri: string; size?: number }) => {
  const isEmoji = !uri || (!uri.includes('://') && !uri.startsWith('/') && uri.length <= 4);
  
  if (isEmoji) {
    return <Text style={{ fontSize: size }}>{uri || '👤'}</Text>;
  }

  const normalizedUri = uri.startsWith('file://') ? uri : uri.startsWith('/') ? `file://${uri}` : uri;

  return (
    <Image
      source={{ uri: normalizedUri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"

    />
  );
};

export default function TopicScreen({ navigation, route }: TopicScreenProps) {
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

  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'popular'>('trending');
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);

  // Sync profile changes when communityProfile updates
  useEffect(() => {
    if (currentUser?.id && communityProfile) {
      const hasChanges = 
        communityProfile.displayName !== currentUser.displayName ||
        communityProfile.handle !== currentUser.handle ||
        communityProfile.avatar !== currentUser.avatar;

      if (hasChanges) {
        syncUserProfileAcrossPosts(currentUser.id, {
          displayName: communityProfile.displayName,
          handle: communityProfile.handle,
          avatar: communityProfile.avatar,
          bio: communityProfile.bio,
        });
      }
    }
  }, [communityProfile?.displayName, communityProfile?.handle, communityProfile?.avatar]);

  useEffect(() => {
    const loadTopicData = () => {
      const currentTopic = getTopicById(topicId);
      const topicPosts = getPostsByTopic(topicId);
      setTopic(currentTopic);
      setPosts(topicPosts);
    };

    loadTopicData();
  }, [topicId, getTopicById, getPostsByTopic]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    const topicPosts = getPostsByTopic(topicId);
    setPosts(topicPosts);
    setRefreshing(false);
  }, [topicId, refreshFeed, getPostsByTopic]);

  const handleJoinToggle = async () => {
    if (!topic) return;

    if (topic.isJoined) {
      Alert.alert(
        'Leave Topic',
        `Are you sure you want to leave ${topic.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive', 
            onPress: async () => {
              await leaveTopic(topic.id);
              setTopic(prev => prev ? { ...prev, isJoined: false, members: Math.max(0, prev.members - 1) } : undefined);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        ]
      );
    } else {
      await joinTopic(topic.id);
      setTopic(prev => prev ? { ...prev, isJoined: true, members: prev.members + 1 } : undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handlePostLike = async (post: Post) => {
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
    const updatedPosts = getPostsByTopic(topicId);
    setPosts(updatedPosts);
  };

  const handlePostRepost = async (post: Post) => {
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
    const updatedPosts = getPostsByTopic(topicId);
    setPosts(updatedPosts);
  };

  const navigateToPostDetail = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const navigateToUserProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const navigateToCreatePost = () => {
    navigation.navigate('CreatePost', { topicId });
  };

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

  const renderPost = ({ item, index }: { item: Post; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <TouchableOpacity 
        onPress={() => navigateToPostDetail(item.id)}
        activeOpacity={0.9}
      >
        <BlurView intensity={80} style={styles.postCard} tint="light">
          <TouchableOpacity 
            style={styles.postHeader}
            onPress={() => navigateToUserProfile(item.author.id)}
          >
            <AvatarImage uri={item.author.avatar} size={40} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={styles.postNameRow}>
                <Text style={styles.postAuthor}>{item.author.displayName}</Text>
                {item.author.isVerified && (
                  <Ionicons name="checkmark-circle" size={14} color={CommunityColors.primary} />
                )}
              </View>
              <Text style={styles.postTime}>{item.time}</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
          
          {/* Post Images */}
          {item.images && item.images.length > 0 && (
            <View style={styles.postImagesContainer}>
              {item.images.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ 
                    uri: img.startsWith('file://') ? img : img.startsWith('/') ? `file://${img}` : img 
                  }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity 
              style={styles.action}
              onPress={() => handlePostLike(item)}
            >
              <Ionicons 
                name={item.isLiked ? "heart" : "heart-outline"} 
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

            <TouchableOpacity 
              style={styles.action}
              onPress={() => handlePostRepost(item)}
            >
              <Ionicons 
                name={item.isReposted ? "repeat" : "repeat-outline"} 
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
  );

  return (
    <LinearGradient 
      colors={[topic.color + '20', ...CommunityColors.background.gradient]} 
      style={styles.container}
    >
      <StatusBar style="dark" />

      {/* Header Background */}
      <LinearGradient 
        colors={[topic.color + '60', topic.color + '20', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={CommunityColors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              Alert.alert('Topic Options', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share Topic', onPress: () => console.log('Share') },
                { text: 'Report', style: 'destructive', onPress: () => {
                  Alert.alert('Reported', 'Thank you. We will review this topic.');
                }},
              ]);
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={CommunityColors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Topic Info */}
        <View style={styles.topicInfo}>
          <Text style={styles.topicEmoji}>{topic.emoji}</Text>
          <Text style={styles.topicName}>{topic.name}</Text>
          <Text style={styles.topicDescription}>{topic.description}</Text>
          <View style={styles.topicStats}>
            <Text style={styles.stat}>{topic.members.toLocaleString()} members</Text>
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

      {/* Content */}
      <View style={styles.content}>
        {/* Sort Options */}
        <View style={styles.sortContainer}>
          <TouchableOpacity style={styles.sortButton} onPress={() => {
            Alert.alert('Sort by', '', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Trending', onPress: () => setSortBy('trending') },
              { text: 'Newest', onPress: () => setSortBy('newest') },
              { text: 'Most Popular', onPress: () => setSortBy('popular') },
            ]);
          }}>
            <Text style={styles.sortText}>
              {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={CommunityColors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="funnel-outline" size={20} color={CommunityColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Posts */}
        <FlatList
          data={sortedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />
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

      {/* Floating Post Button */}
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
  postsList: { paddingHorizontal: CommunitySpacing.lg, paddingBottom: 100 },
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
  postImage: {
    width: (width - 88) / 2,
    height: 150,
    borderRadius: CommunityBorderRadius.lg,
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