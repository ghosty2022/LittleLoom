// src/screens/community/PostDetailScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, Comment } from '../../context/CommunityContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type PostDetailScreenProps = NativeStackScreenProps<CommunityStackParamList, 'PostDetail'>;

const { width } = Dimensions.get('window');

export default function PostDetailScreen({ navigation, route }: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();

  // CRITICAL FIX: Safe route params extraction with multiple fallbacks
  const routeParams = route?.params ?? {};
  const postId = routeParams?.postId;

  const {
    getPostById,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    addComment,
    likeComment,
    voteHelpful,
    currentUser,
    followUser,
    unfollowUser,
    isFollowing,
    getUserById,
  } = useCommunity();

  const [post, setPost] = useState<Post | undefined>(undefined);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // FIX: Handle missing postId gracefully
  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    const foundPost = getPostById(postId);
    setPost(foundPost);
    setIsLoading(false);
  }, [postId, getPostById]);

  // Refresh post data when focused
  useEffect(() => {
    if (postId) {
      const foundPost = getPostById(postId);
      if (foundPost) {
        setPost(foundPost);
      }
    }
  }, [postId, getPostById]);

  const handleLike = useCallback(async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
    // Refresh post data
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, likePost, unlikePost, getPostById]);

  const handleRepost = useCallback(async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, repostPost, unrepostPost, getPostById]);

  const handleBookmark = useCallback(async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await bookmarkPost(post.id);
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, bookmarkPost, getPostById]);

  const handleVoteHelpful = useCallback(async () => {
    if (!post) return;
    await voteHelpful(post.id);
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, voteHelpful, getPostById]);

  const handleSubmitComment = useCallback(async () => {
    if (!post || !commentText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addComment(post.id, commentText.trim());
    setCommentText('');
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, commentText, addComment, getPostById]);

  const handleFollow = useCallback(async () => {
    if (!post) return;
    if (isFollowing(post.authorId)) {
      await unfollowUser(post.authorId);
    } else {
      await followUser(post.authorId);
    }
    const updatedPost = getPostById(post.id);
    setPost(updatedPost);
  }, [post, followUser, unfollowUser, isFollowing, getPostById]);

  const navigateToUserProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  // FIX: Handle missing postId or post not found
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={CommunityColors.primary} />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!postId) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={64} color={CommunityColors.text.tertiary} />
        <Text style={styles.errorTitle}>Post Not Found</Text>
        <Text style={styles.errorText}>No post ID was provided.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <LinearGradient colors={CommunityGradients.primary} style={styles.backButtonGradient}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />
        <Ionicons name="document-text-outline" size={64} color={CommunityColors.text.tertiary} />
        <Text style={styles.errorTitle}>Post Not Found</Text>
        <Text style={styles.errorText}>This post may have been deleted or is no longer available.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <LinearGradient colors={CommunityGradients.primary} style={styles.backButtonGradient}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const renderComment = (comment: Comment, index: number) => (
    <Animated.View 
      key={comment.id} 
      entering={FadeInUp.delay(index * 50)}
      style={styles.commentItem}
    >
      <TouchableOpacity 
        style={styles.commentHeader}
        onPress={() => navigateToUserProfile(comment.authorId)}
      >
        <Text style={styles.commentAvatar}>{comment.author.avatar}</Text>
        <View style={styles.commentMeta}>
          <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
          <Text style={styles.commentTime}>{comment.time}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.commentContent}>{comment.content}</Text>
      <View style={styles.commentActions}>
        <TouchableOpacity 
          style={styles.commentAction}
          onPress={() => likeComment(post.id, comment.id)}
        >
          <Ionicons 
            name={comment.isLiked ? "heart" : "heart-outline"} 
            size={16} 
            color={comment.isLiked ? CommunityColors.primary : CommunityColors.text.tertiary} 
          />
          <Text style={[styles.commentActionText, comment.isLiked && styles.commentActionActive]}>
            {comment.likes > 0 ? comment.likes : 'Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.commentAction}>
          <Ionicons name="chatbubble-outline" size={16} color={CommunityColors.text.tertiary} />
          <Text style={styles.commentActionText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity 
              style={styles.backIconButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={CommunityColors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post</Text>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color={CommunityColors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Post Content */}
          <Animated.View entering={FadeInUp} style={styles.postCard}>
            {/* Author Info */}
            <View style={styles.postHeader}>
              <TouchableOpacity 
                style={styles.authorInfo}
                onPress={() => navigateToUserProfile(post.authorId)}
              >
                <View style={styles.avatarContainer}>
                  <Text style={styles.authorAvatar}>{post.author.avatar}</Text>
                  {post.author.onlineStatus === 'online' && (
                    <View style={styles.onlineIndicator} />
                  )}
                </View>
                <View style={styles.authorMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.authorName}>{post.author.displayName}</Text>
                    {post.author.isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.postMeta}>
                    <Text style={styles.topicText}>{post.topic}</Text>
                    <Text style={styles.timeText}> • {post.time}</Text>
                  </Text>
                </View>
              </TouchableOpacity>

              {post.authorId !== currentUser?.id && (
                <TouchableOpacity 
                  style={[styles.followButton, isFollowing(post.authorId) && styles.followingButton]}
                  onPress={handleFollow}
                >
                  <Text style={[styles.followButtonText, isFollowing(post.authorId) && styles.followingButtonText]}>
                    {isFollowing(post.authorId) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {post.images && post.images.length > 0 && (
              <View style={styles.imagesContainer}>
                {post.images.map((img, idx) => (
                  <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                ))}
              </View>
            )}

            {/* Helpful Votes */}
            {post.helpfulVotes > 0 && (
              <View style={styles.helpfulContainer}>
                <LinearGradient 
                  colors={[CommunityColors.success + '20', CommunityColors.success + '10']}
                  style={styles.helpfulGradient}
                >
                  <Ionicons name="thumbs-up" size={14} color={CommunityColors.success} />
                  <Text style={styles.helpfulText}>{post.helpfulVotes} found this helpful</Text>
                </LinearGradient>
              </View>
            )}

            {/* Post Stats */}
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {post.likes} likes • {post.commentsCount} comments • {post.reposts} reposts
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={[styles.actionButton, post.isLiked && styles.actionActive]}
                onPress={handleLike}
              >
                <Ionicons 
                  name={post.isLiked ? "heart" : "heart-outline"} 
                  size={22} 
                  color={post.isLiked ? CommunityColors.primary : CommunityColors.text.tertiary} 
                />
                <Text style={[styles.actionText, post.isLiked && { color: CommunityColors.primary }]}>
                  {post.isLiked ? 'Liked' : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={20} color={CommunityColors.text.tertiary} />
                <Text style={styles.actionText}>Comment</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, post.isReposted && styles.actionActive]}
                onPress={handleRepost}
              >
                <Ionicons 
                  name={post.isReposted ? "repeat" : "repeat-outline"} 
                  size={20} 
                  color={post.isReposted ? CommunityColors.secondary : CommunityColors.text.tertiary} 
                />
                <Text style={[styles.actionText, post.isReposted && { color: CommunityColors.secondary }]}>
                  {post.isReposted ? 'Reposted' : 'Repost'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, post.isBookmarked && styles.actionActive]}
                onPress={handleBookmark}
              >
                <Ionicons 
                  name={post.isBookmarked ? "bookmark" : "bookmark-outline"} 
                  size={20} 
                  color={post.isBookmarked ? CommunityColors.accent : CommunityColors.text.tertiary} 
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-outline" size={20} color={CommunityColors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>
              Comments ({post.commentsCount})
            </Text>

            {post.comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={48} color={CommunityColors.text.tertiary} />
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
                <Text style={styles.emptyCommentsSubtext}>Be the first to share your thoughts!</Text>
              </View>
            ) : (
              post.comments.map((comment, index) => renderComment(comment, index))
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputContainer, { paddingBottom: insets.bottom + 16 }]}>
          <BlurView intensity={90} style={styles.commentInputBlur} tint="light">
            <View style={styles.commentInputRow}>
              <Text style={styles.commentInputAvatar}>{currentUser?.avatar || '👤'}</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={CommunityColors.text.tertiary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim()}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={commentText.trim() ? CommunityColors.primary : CommunityColors.text.tertiary} 
                />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CommunityColors.background.main,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
  },
  keyboardView: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    color: CommunityColors.text.secondary,
    fontWeight: '600',
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginTop: CommunitySpacing.md,
  },
  errorText: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
    marginTop: CommunitySpacing.sm,
    marginBottom: CommunitySpacing.lg,
  },
  backButton: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    ...CommunityShadows.md,
  },
  backButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CommunitySpacing.lg,
    paddingBottom: CommunitySpacing.md,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...CommunityShadows.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...CommunityShadows.sm,
  },
  postCard: {
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.xl,
    padding: CommunitySpacing.lg,
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: CommunitySpacing.md,
    ...CommunityShadows.sm,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CommunitySpacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: CommunitySpacing.sm,
  },
  authorAvatar: {
    fontSize: 42,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  authorMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: CommunityColors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  topicText: {
    color: CommunityColors.primary,
    fontWeight: '700',
  },
  timeText: {
    color: CommunityColors.text.tertiary,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: CommunityColors.primary + '15',
    borderWidth: 1,
    borderColor: CommunityColors.primary,
  },
  followingButton: {
    backgroundColor: CommunityColors.background.elevated,
    borderColor: CommunityColors.border,
  },
  followButtonText: {
    color: CommunityColors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  followingButtonText: {
    color: CommunityColors.text.secondary,
  },
  postContent: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    lineHeight: 24,
    marginBottom: CommunitySpacing.md,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: CommunitySpacing.md,
  },
  postImage: {
    width: (width - 88) / 2,
    height: 150,
    borderRadius: CommunityBorderRadius.lg,
  },
  helpfulContainer: {
    marginBottom: CommunitySpacing.sm,
  },
  helpfulGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  helpfulText: {
    fontSize: 13,
    color: CommunityColors.success,
    fontWeight: '700',
  },
  statsRow: {
    paddingVertical: CommunitySpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
    marginBottom: CommunitySpacing.sm,
  },
  statsText: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
    fontWeight: '600',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: CommunitySpacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 10,
  },
  actionActive: {
    backgroundColor: CommunityColors.primary + '08',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: CommunityColors.text.tertiary,
  },
  commentsSection: {
    marginTop: CommunitySpacing.md,
    paddingHorizontal: CommunitySpacing.lg,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: CommunitySpacing.md,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: CommunitySpacing.xl,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.xs,
  },
  commentItem: {
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.lg,
    padding: CommunitySpacing.md,
    marginBottom: CommunitySpacing.sm,
    ...CommunityShadows.sm,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: CommunitySpacing.sm,
  },
  commentAvatar: {
    fontSize: 32,
    marginRight: CommunitySpacing.sm,
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  commentTime: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  commentContent: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    lineHeight: 20,
    marginBottom: CommunitySpacing.sm,
  },
  commentActions: {
    flexDirection: 'row',
    gap: CommunitySpacing.md,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },
  commentActionActive: {
    color: CommunityColors.primary,
  },
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.border,
  },
  commentInputBlur: {
    paddingHorizontal: CommunitySpacing.lg,
    paddingTop: CommunitySpacing.md,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  commentInputAvatar: {
    fontSize: 32,
  },
  commentInput: {
    flex: 1,
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.xl,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    fontSize: 14,
    color: CommunityColors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: CommunityColors.background.elevated,
  },
});