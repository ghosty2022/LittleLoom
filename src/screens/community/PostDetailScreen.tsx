import { StyleSheet,ActivityIndicator, Alert ,Button, Dimensions, Image, KeyboardAvoidingView, Modal , StatusBar,Platform, ScrollView ,Share, Text, TextInput, TouchableOpacity, View } from 'react-native';;
import React, { useCallback, useEffect, useState } from 'react';

import { BlurView } from 'expo-blur';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { Comment, Post, useCommunity } from '../../context/CommunityContext';
import { CommunityBorderRadius, CommunityColors, CommunityShadows, CommunitySpacing } from '../../theme/CommunityTheme';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useCustomization } from '../../hooks/useCustomization';
import { showAlert } from '@/utils/alert';

type PostDetailScreenProps = NativeStackScreenProps<CommunityStackParamList, 'PostDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostDetailScreen({ navigation, route }: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();

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
    deletePost,
    blockUser,
    isUserBlocked,
  } = useCommunity();

  const { shouldReduceMotion, triggerHaptic, spinnerColor } = useCustomization();

  const [post, setPost] = useState<Post | undefined>(undefined);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }
    const foundPost = getPostById(postId);
    setPost(foundPost);
    setIsLoading(false);
  }, [postId, getPostById]);

  const refreshPost = useCallback(() => {
    if (!postId) return;
    const updated = getPostById(postId);
    setPost(updated);
  }, [postId, getPostById]);

  const handleLike = useCallback(async () => {
    if (!post) return;
    triggerHaptic('light');
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
    refreshPost();
  }, [post, likePost, unlikePost, refreshPost, triggerHaptic]);

  const handleRepost = useCallback(async () => {
    if (!post) return;
    triggerHaptic('medium');
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
    refreshPost();
  }, [post, repostPost, unrepostPost, refreshPost, triggerHaptic]);

  const handleBookmark = useCallback(async () => {
    if (!post) return;
    triggerHaptic('light');
    await bookmarkPost(post.id);
    refreshPost();
  }, [post, bookmarkPost, refreshPost, triggerHaptic]);

  const handleVoteHelpful = useCallback(async () => {
    if (!post) return;
    await voteHelpful(post.id);
    refreshPost();
  }, [post, voteHelpful, refreshPost]);

  const handleSubmitComment = useCallback(async () => {
    if (!post || !commentText.trim()) return;
    triggerHaptic('success');
    await addComment(post.id, commentText.trim());
    setCommentText('');
    setReplyingTo(null);
    refreshPost();
  }, [post, commentText, addComment, refreshPost, triggerHaptic]);

  const handleFollow = useCallback(async () => {
    if (!post) return;
    if (isFollowing(post.authorId)) {
      await unfollowUser(post.authorId);
    } else {
      await followUser(post.authorId);
    }
    refreshPost();
  }, [post, followUser, unfollowUser, isFollowing, refreshPost]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [post]);

  const navigateToUserProfile = useCallback((userId: string) => {
    triggerHaptic('light');
    if (userId === currentUser?.id) {
      navigation.navigate('CommunityProfile');
    } else {
      navigation.navigate('CommunityMemberProfile', { userId });
    }
  }, [navigation, currentUser, triggerHaptic]);

  const handleDelete = useCallback(() => {
    if (!post) return;

showAlert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePost(post.id);
            navigation.goBack();
          },
        },
      ]
    );
    setShowMoreMenu(false);
  }, [post, deletePost, navigation]);

  const handleBlock = useCallback(() => {
    if (!post) return;
    blockUser(post.authorId);
    setShowMoreMenu(false);
  }, [post, blockUser]);

  const handleReport = useCallback(() => {
    if (!post) return;
    setShowMoreMenu(false);
    setTimeout(() => {
      navigation.navigate('Report', {
        type: 'post',
        targetId: post.id,
        targetUserId: post.authorId,
        postId: post.id,
      });
    }, 300);
  }, [post, navigation]);

  const ImageGrid = ({ images }: { images: string[] }) => {
    if (!images || images.length === 0) return null;

    return (
      <View style={styles.imageGridWrapper}>
        {images.length === 1 ? (
          <View style={styles.singleImageContainer}>
            <Image source={{ uri: images[0] }} style={styles.singleImage} resizeMode="cover" />
          </View>
        ) : (
          <View style={styles.multiImageGrid}>
            {images.slice(0, 4).map((img, idx) => (
              <View key={idx} style={styles.gridImageItem}>
                <Image source={{ uri: img }} style={styles.gridImage} resizeMode="cover" />
                {idx === 3 && images.length > 4 && (
                  <View style={styles.gridMoreOverlay}>
                    <Text style={styles.gridMoreText}>+{images.length - 4}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const ActionButton = ({
    icon,
    label,
    active,
    activeColor,
    onPress,
  }: {
    icon: string;
    label: string;
    active?: boolean;
    activeColor?: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.actionBtn, active && styles.actionBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={(active ? icon.replace('-outline', '') : icon) as any}
        size={20}
        color={active ? (activeColor || '#667eea') : CommunityColors.text.tertiary}
      />
      <Text style={[styles.actionBtnText, active && { color: activeColor || '#667eea', fontWeight: '700' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CommentCard = ({ comment, index }: { comment: Comment; index: number }) => (
    <View style={styles.commentCard}>
      <View style={styles.commentTop}>
        <TouchableOpacity
          style={styles.commentAuthorRow}
          onPress={() => navigateToUserProfile(comment.authorId)}
        >
          <SafeAvatar
            avatar={comment.author.avatar}
            size={36}
            fallbackIcon="person"
            fallbackColor="#667eea"
            fallbackBgColor="#f0f0f5"
          />
          <View style={styles.commentAuthorInfo}>
            <Text style={styles.commentAuthorName}>{comment.author.displayName}</Text>
            <Text style={styles.commentTime}>{comment.time}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.commentBody}>{comment.content}</Text>

      <View style={styles.commentFooter}>
        <TouchableOpacity
          style={[styles.commentActionBtn, comment.isLiked && styles.commentActionBtnActive]}
          onPress={() => {
            likeComment(post!.id, comment.id);
            refreshPost();
          }}
        >
          <Ionicons
            name={comment.isLiked ? "heart" : "heart-outline"}
            size={15}
            color={comment.isLiked ? '#fc5c7d' : CommunityColors.text.tertiary}
          />
          <Text style={[styles.commentActionText, comment.isLiked && { color: '#fc5c7d', fontWeight: '700' }]}>
            {comment.likes > 0 ? comment.likes : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.commentActionBtn}
          onPress={() => {
            setReplyingTo({ commentId: comment.id, authorName: comment.author.displayName });
            triggerHaptic('light');
          }}
        >
          <Ionicons name="chatbubble-outline" size={15} color={CommunityColors.text.tertiary} />
          <Text style={styles.commentActionText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.commentActionBtn}>
          <Ionicons name="thumbs-up-outline" size={15} color={CommunityColors.text.tertiary} />
          <Text style={styles.commentActionText}>
            {comment.helpfulVotes > 0 ? `${comment.helpfulVotes} Helpful` : 'Helpful'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={styles.replyCard}>
              <SafeAvatar
                avatar={reply.author.avatar}
                size={28}
                fallbackIcon="person"
                fallbackColor="#667eea"
                fallbackBgColor="#f0f0f5"
              />
              <View style={styles.replyContent}>
                <View style={styles.replyBubble}>
                  <Text style={styles.replyAuthorName}>{reply.author.displayName}</Text>
                  <Text style={styles.replyBody}>{reply.content}</Text>
                </View>
                <View style={styles.replyFooter}>
                  <TouchableOpacity
                    style={[styles.replyActionBtn, reply.isLiked && styles.replyActionBtnActive]}
                    onPress={() => {
                      likeComment(post!.id, reply.id);
                      refreshPost();
                    }}
                  >
                    <Ionicons
                      name={reply.isLiked ? "heart" : "heart-outline"}
                      size={13}
                      color={reply.isLiked ? '#fc5c7d' : CommunityColors.text.tertiary}
                    />
                    <Text style={[styles.replyActionText, reply.isLiked && { color: '#fc5c7d' }]}>
                      {reply.likes > 0 ? reply.likes : 'Like'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#f8f9ff', '#fff5f8']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={spinnerColor} />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!postId || !post) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#f8f9ff', '#fff5f8']} style={StyleSheet.absoluteFill} />
        <Ionicons name="document-text-outline" size={64} color={CommunityColors.text.tertiary} />
        <Text style={styles.errorTitle}>Post Not Found</Text>
        <Text style={styles.errorText}>This post may have been deleted or is no longer available.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.backButtonGradient}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnPost = post.authorId === currentUser?.id;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f8f9ff', '#fff5f8']} style={StyleSheet.absoluteFill} />

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenu}>
            {!isOwnPost && (
              <>
                <TouchableOpacity style={styles.moreMenuItem} onPress={handleReport}>
                  <Ionicons name="flag-outline" size={22} color="#fc5c7d" />
                  <Text style={[styles.moreMenuText, { color: '#fc5c7d' }]}>Report Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreMenuItem} onPress={handleBlock}>
                  <Ionicons name="ban" size={22} color="#fc5c7d" />
                  <Text style={[styles.moreMenuText, { color: '#fc5c7d' }]}>
                    {isUserBlocked(post.authorId) ? 'Unblock User' : 'Block User'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {isOwnPost && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#fc5c7d" />
                <Text style={[styles.moreMenuText, { color: '#fc5c7d' }]}>Delete Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.moreMenuItem, styles.moreMenuItemLast]} onPress={() => setShowMoreMenu(false)}>
              <Ionicons name="close" size={22} color={CommunityColors.text.secondary} />
              <Text style={styles.moreMenuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <AutoHideScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={22} color={CommunityColors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post</Text>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                triggerHaptic('light');
                setShowMoreMenu(true);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={CommunityColors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Post Card */}
          <View style={styles.postCard}>
            {/* Author Row */}
            <View style={styles.postAuthorRow}>
              <TouchableOpacity
                style={styles.postAuthorLeft}
                onPress={() => navigateToUserProfile(post.authorId)}
              >
                <View style={styles.avatarWrapper}>
                  <SafeAvatar
                    avatar={post.author.avatar}
                    size={44}
                    fallbackIcon="person"
                    fallbackColor="#667eea"
                    fallbackBgColor="#f0f0f5"
                    borderWidth={2}
                    borderColor={post.author.isVerified ? '#667eea' : '#fff'}
                  />
                  {post.author.isVerified && (
                    <View style={styles.verifiedBadgeSmall}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                  {post.author.onlineStatus === 'online' && (
                    <View style={styles.onlineIndicator} />
                  )}
                </View>
                <View style={styles.postAuthorMeta}>
                  <View style={styles.postNameRow}>
                    <Text style={styles.postAuthorName}>{post.author.displayName}</Text>
                    {post.author.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color="#667eea" />
                    )}
                  </View>
                  <View style={styles.postMetaRow}>
                    <View style={[styles.topicTag, { backgroundColor: '#667eea15' }]}>
                      <Text style={[styles.topicTagText, { color: '#667eea' }]}>
                        {post.topic}
                      </Text>
                    </View>
                    <Text style={styles.postTimeText}>• {post.time}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {post.authorId !== currentUser?.id && (
                <TouchableOpacity
                  style={[styles.followBtn, isFollowing(post.authorId) && styles.followingBtn]}
                  onPress={handleFollow}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.followBtnText, isFollowing(post.authorId) && styles.followingBtnText]}>
                    {isFollowing(post.authorId) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Images - MODERN GRID */}
            {post.images && post.images.length > 0 && (
              <ImageGrid images={post.images} />
            )}

            {/* Helpful Votes */}
            {post.helpfulVotes > 0 && (
              <View style={styles.helpfulWrap}>
                <View style={styles.helpfulBadgeInner}>
                  <Ionicons name="thumbs-up" size={14} color="#667eea" />
                  <Text style={styles.helpfulBadgeText}>{post.helpfulVotes} found this helpful</Text>
                </View>
              </View>
            )}

            {/* Stats Bar */}
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={14} color="#fc5c7d" />
                <Text style={styles.statText}>{post.likes}</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <Ionicons name="chatbubble" size={14} color="#667eea" />
                <Text style={styles.statText}>{post.commentsCount}</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <Ionicons name="repeat" size={14} color="#43e97b" />
                <Text style={styles.statText}>{post.reposts}</Text>
              </View>
            </View>

            {/* Action Bar */}
            <View style={styles.actionBar}>
              <ActionButton
                icon="heart-outline"
                label={post.isLiked ? 'Liked' : 'Like'}
                active={post.isLiked}
                activeColor="#fc5c7d"
                onPress={handleLike}
              />
              <ActionButton
                icon="chatbubble-outline"
                label="Comment"
                onPress={() => {}}
              />
              <ActionButton
                icon="repeat-outline"
                label={post.isReposted ? 'Reposted' : 'Repost'}
                active={post.isReposted}
                activeColor="#43e97b"
                onPress={handleRepost}
              />
              <ActionButton
                icon="bookmark-outline"
                label={post.isBookmarked ? 'Saved' : 'Save'}
                active={post.isBookmarked}
                activeColor="#fa709a"
                onPress={handleBookmark}
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={CommunityColors.text.tertiary} />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments</Text>
              <View style={styles.commentsCountBadge}>
                <Text style={styles.commentsCountText}>{post.commentsCount}</Text>
              </View>
            </View>

            {post.comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubbles-outline" size={40} color="#667eea" />
                </View>
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSub}>Be the first to share your thoughts!</Text>
              </View>
            ) : (
              post.comments.map((comment, index) => (
                <CommentCard key={comment.id} comment={comment} index={index} />
              ))
            )}
          </View>
        </AutoHideScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputWrap, { paddingBottom: insets.bottom + 12 }]}>
          <BlurView intensity={95} style={styles.commentInputBlur} tint="light">
            <View style={styles.commentInputRow}>
              <SafeAvatar
                avatar={currentUser?.avatar}
                size={36}
                fallbackIcon="person"
                fallbackColor="#667eea"
                fallbackBgColor="#f0f0f5"
              />
              <View style={styles.commentInputBox}>
                {replyingTo && (
                  <View style={styles.replyingToBar}>
                    <Text style={styles.replyingToText}>Replying to {replyingTo.authorName}</Text>
                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                      <Ionicons name="close" size={14} color={CommunityColors.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={styles.commentInputField}
                  placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : "Write a comment..."}
                  placeholderTextColor={CommunityColors.text.tertiary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim()}
              >
                <LinearGradient
                  colors={commentText.trim() ? ['#667eea', '#764ba2'] : ['#e0e0e0', '#e0e0e0']}
                  style={styles.sendBtnGradient}
                >
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={commentText.trim() ? '#fff' : CommunityColors.text.tertiary}
                  />
                </LinearGradient>
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
    backgroundColor: '#f8f9ff',
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
    ...CommunityShadows.medium,
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
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...CommunityShadows.small,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },

  postCard: {
    backgroundColor: '#fff',
    borderRadius: CommunityBorderRadius.xl,
    padding: CommunitySpacing.lg,
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: CommunitySpacing.md,
    ...CommunityShadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  postAuthorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CommunitySpacing.md,
  },
  postAuthorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  verifiedBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#667eea',
    borderRadius: 8,
    width: 16,
    height: 16,
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
    borderWidth: 2,
    borderColor: '#fff',
  },
  postAuthorMeta: {
    marginLeft: 12,
    flex: 1,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postAuthorName: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
  postTimeText: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    fontWeight: '500',
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#667eea12',
    borderWidth: 1.5,
    borderColor: '#667eea30',
  },
  followingBtn: {
    backgroundColor: '#f0f0f5',
    borderColor: '#e0e0e5',
  },
  followBtnText: {
    color: '#667eea',
    fontWeight: '800',
    fontSize: 12,
  },
  followingBtnText: {
    color: CommunityColors.text.secondary,
  },
  postContent: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    lineHeight: 25,
    marginBottom: CommunitySpacing.md,
  },

  imageGridWrapper: {
    marginBottom: CommunitySpacing.md,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  singleImageContainer: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    ...CommunityShadows.small,
  },
  singleImage: {
    width: '100%',
    height: 240,
    borderRadius: CommunityBorderRadius.lg,
  },
  multiImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImageItem: {
    width: (SCREEN_WIDTH - CommunitySpacing.lg * 2 - 40 - 4) / 2,
    height: (SCREEN_WIDTH - CommunitySpacing.lg * 2 - 40 - 4) / 2,
    borderRadius: CommunityBorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    ...CommunityShadows.small,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CommunityBorderRadius.md,
  },
  gridMoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },

  helpfulWrap: {
    marginBottom: CommunitySpacing.sm,
  },
  helpfulBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: '#667eea15',
    alignSelf: 'flex-start',
  },
  helpfulBadgeText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '700',
  },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e5',
  },

  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },

  commentsSection: {
    marginTop: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.lg,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: CommunitySpacing.md,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  commentsCountBadge: {
    backgroundColor: '#667eea12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  commentsCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#667eea',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: CommunitySpacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#667eea10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCommentsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  emptyCommentsSub: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: 4,
    fontWeight: '500',
  },

  commentCard: {
    backgroundColor: '#fff',
    borderRadius: CommunityBorderRadius.lg,
    padding: CommunitySpacing.md,
    marginBottom: CommunitySpacing.sm,
    ...CommunityShadows.small,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  commentTop: {
    marginBottom: 10,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  commentTime: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    fontWeight: '500',
    marginTop: 1,
  },
  commentBody: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    lineHeight: 21,
    marginBottom: 12,
  },
  commentFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  commentActionBtnActive: {
    backgroundColor: '#fc5c7d08',
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },

  repliesContainer: {
    marginTop: 10,
    marginLeft: 46,
    gap: 8,
  },
  replyCard: {
    flexDirection: 'row',
    gap: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyBubble: {
    backgroundColor: '#f8f9ff',
    borderRadius: CommunityBorderRadius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    marginBottom: 2,
  },
  replyBody: {
    fontSize: 13,
    color: CommunityColors.text.primary,
    lineHeight: 19,
  },
  replyFooter: {
    flexDirection: 'row',
    marginTop: 4,
    marginLeft: 4,
  },
  replyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  replyActionBtnActive: {
    backgroundColor: '#fc5c7d08',
  },
  replyActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },

  commentInputWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  commentInputBlur: {
    paddingHorizontal: CommunitySpacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInputBox: {
    flex: 1,
    backgroundColor: '#f8f9ff',
    borderRadius: CommunityBorderRadius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e5',
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e5',
  },
  replyingToText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  commentInputField: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    maxHeight: 100,
    padding: 0,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    ...CommunityShadows.small,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  moreMenu: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f5',
  },
  moreMenuItemLast: {
    borderBottomWidth: 0,
  },
  moreMenuText: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    fontWeight: '600',
  },
});
