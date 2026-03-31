// src/screens/community/PostDetailScreen.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue,
  useAnimatedStyle, 
  useAnimatedScrollHandler,
  interpolate,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, Comment } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
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
  const { postId } = route.params;
  const { 
    getPostById, 
    likePost, 
    unlikePost, 
    repostPost, 
    unrepostPost,
    bookmarkPost,
    addComment,
    likeComment,
    replyToComment,
    deletePost,
    followUser,
    unfollowUser,
    isFollowing,
  } = useCommunity();
  const { currentUser } = useUser();
  
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToName, setReplyToName] = useState('');
  const inputRef = useRef<TextInput>(null);
  
  const scrollY = useSharedValue(0);

  const post = getPostById(postId);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, 100], [0, 1]),
    };
  });

  const handleLike = async () => {
    if (!post) return;
    if (post.isLiked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleRepost = async () => {
    if (!post) return;
    if (post.isReposted) {
      await unrepostPost(post.id);
    } else {
      await repostPost(post.id);
    }
  };

  const handleBookmark = async () => {
    if (!post) return;
    await bookmarkPost(post.id);
  };

  const handleFollow = async () => {
    if (!post) return;
    if (isFollowing(post.author.id)) {
      await unfollowUser(post.author.id);
    } else {
      await followUser(post.author.id);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            await deletePost(postId);
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleSendComment = async () => {
    if (!comment.trim() || !post) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (replyTo) {
      await replyToComment(post.id, replyTo, comment.trim());
    } else {
      await addComment(post.id, comment.trim());
    }
    
    setComment('');
    setReplyTo(null);
    setReplyToName('');
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo(commentId);
    setReplyToName(authorName);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancelReply = () => {
    setReplyTo(null);
    setReplyToName('');
  };

  const navigateToUserProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const renderComment = ({ item, isReply = false }: { item: Comment; isReply?: boolean }) => (
    <Animated.View 
      entering={FadeInUp} 
      layout={Layout.springify()}
      style={[styles.commentContainer, isReply && styles.replyContainer]}
    >
      {!isReply && <View style={styles.commentLine} />}
      <BlurView intensity={60} style={styles.commentCard} tint="light">
        <TouchableOpacity 
          style={styles.commentHeader}
          onPress={() => navigateToUserProfile(item.author.id)}
        >
          <Text style={[styles.commentAvatar, isReply && styles.replyAvatar]}>
            {item.author.avatar}
          </Text>
          <View style={styles.commentAuthorInfo}>
            <View style={styles.commentNameRow}>
              <Text style={styles.commentName}>{item.author.displayName}</Text>
              {item.author.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={CommunityColors.primary} />
              )}
            </View>
            <Text style={styles.commentTime}>{item.time}</Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.commentContent}>{item.content}</Text>
        
        <View style={styles.commentActions}>
          <TouchableOpacity 
            style={styles.commentAction}
            onPress={() => likeComment(postId, item.id)}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={18} 
              color={item.isLiked ? CommunityColors.error : CommunityColors.text.secondary} 
            />
            <Text style={[styles.commentActionText, item.isLiked && styles.commentActionActive]}>
              {item.likes}
            </Text>
          </TouchableOpacity>
          
          {!isReply && (
            <TouchableOpacity 
              style={styles.commentAction}
              onPress={() => handleReply(item.id, item.author.displayName)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={CommunityColors.text.secondary} />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nested Replies */}
        {!isReply && item.replies && item.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => (
              <View key={reply.id} style={styles.nestedReplyWrapper}>
                <View style={styles.nestedLine} />
                {renderComment({ item: reply, isReply: true })}
              </View>
            ))}
          </View>
        )}
      </BlurView>
    </Animated.View>
  );

  if (!post) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnPost = post.author.id === currentUser?.id;
  const following = isFollowing(post.author.id);

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, headerStyle]}>
        <BlurView intensity={90} style={styles.headerBlur} tint="light">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={CommunityColors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Thread</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleBookmark} style={styles.headerAction}>
              <Ionicons 
                name={post.isBookmarked ? "bookmark" : "bookmark-outline"} 
                size={24} 
                color={post.isBookmarked ? CommunityColors.primary : CommunityColors.text.primary} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Alert.alert('Share', 'Share this post', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Copy Link', onPress: () => console.log('Copy') },
                  { text: 'Share', onPress: () => console.log('Share') },
                ]);
              }}
            >
              <Ionicons name="share-outline" size={24} color={CommunityColors.primary} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Original Post */}
          <BlurView intensity={90} style={styles.originalPost} tint="light">
            <View style={styles.postHeader}>
              <TouchableOpacity 
                style={styles.authorInfo}
                onPress={() => navigateToUserProfile(post.author.id)}
              >
                <Text style={styles.authorAvatar}>{post.author.avatar}</Text>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.authorName}>{post.author.displayName}</Text>
                    {post.author.isVerified && (
                      <Ionicons name="checkmark-circle" size={16} color={CommunityColors.primary} />
                    )}
                  </View>
                  <Text style={styles.postMeta}>in {post.topic} • {post.time}</Text>
                </View>
              </TouchableOpacity>
              
              <View style={styles.postHeaderActions}>
                {!isOwnPost && (
                  <TouchableOpacity 
                    style={[styles.followBtn, following && styles.followingBtn]}
                    onPress={handleFollow}
                  >
                    <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    Alert.alert('Options', '', [
                      { text: 'Cancel', style: 'cancel' },
                      isOwnPost && { text: 'Delete', style: 'destructive', onPress: handleDeletePost },
                      { text: 'Report', style: 'destructive' },
                      { text: 'Copy Text', onPress: () => console.log('Copy') },
                    ].filter(Boolean) as any);
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={CommunityColors.text.tertiary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.postContent}>{post.content}</Text>
            
            {post.images && post.images.length > 0 && (
              <View style={styles.imagesContainer}>
                {post.images.map((img, idx) => (
                  <TouchableOpacity key={idx} activeOpacity={0.9}>
                    <Image source={{ uri: img }} style={styles.postImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.postStats}>
              <Text style={styles.statText}>
                {post.likes} likes • {post.reposts} reposts • {post.commentsCount} replies
              </Text>
            </View>

            <View style={styles.postActions}>
              <TouchableOpacity 
                style={[styles.actionButton, post.isLiked && styles.actionActive]}
                onPress={handleLike}
              >
                <Ionicons 
                  name={post.isLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={post.isLiked ? CommunityColors.error : CommunityColors.text.secondary} 
                />
                <Text style={[styles.actionText, post.isLiked && styles.actionTextActive]}>
                  {post.isLiked ? 'Liked' : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={22} color={CommunityColors.text.secondary} />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, post.isReposted && styles.actionActive]}
                onPress={handleRepost}
              >
                <Ionicons 
                  name={post.isReposted ? "repeat" : "repeat-outline"} 
                  size={22} 
                  color={post.isReposted ? CommunityColors.secondary : CommunityColors.text.secondary} 
                />
                <Text style={[styles.actionText, post.isReposted && styles.actionTextActive]}>
                  {post.isReposted ? 'Reposted' : 'Repost'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('Share', 'Share this post');
                }}
              >
                <Ionicons name="share-outline" size={22} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Replies Section */}
          <Text style={styles.repliesTitle}>Replies ({post.commentsCount})</Text>
          
          {post.comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={48} color={CommunityColors.text.tertiary} />
              <Text style={styles.emptyText}>No replies yet</Text>
              <Text style={styles.emptySubtext}>Be the first to reply!</Text>
            </View>
          ) : (
            post.comments.map((comment) => (
              <View key={comment.id}>
                {renderComment({ item: comment })}
              </View>
            ))
          )}
        </Animated.ScrollView>

        {/* Comment Input */}
        <BlurView intensity={100} style={styles.inputContainer} tint="light">
          {replyTo && (
            <View style={styles.replyingToContainer}>
              <Text style={styles.replyingToText}>Replying to {replyToName}</Text>
              <TouchableOpacity onPress={cancelReply}>
                <Ionicons name="close" size={18} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputAvatar}>{currentUser?.avatar || '👤'}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={replyTo ? `Reply to ${replyToName}...` : "Write a reply..."}
              placeholderTextColor={CommunityColors.text.tertiary}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, comment.length > 0 && styles.sendButtonActive]}
              disabled={comment.length === 0}
              onPress={handleSendComment}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={comment.length > 0 ? "white" : CommunityColors.text.tertiary} 
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerAction: {
    padding: 4,
  },
  keyboardView: {
    flex: 1,
  },
  originalPost: {
    margin: 20,
    marginTop: 100,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    fontSize: 48,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  postMeta: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    marginTop: 2,
  },
  postHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  followBtn: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CommunityColors.primary,
  },
  followBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  followingBtnText: {
    color: CommunityColors.primary,
  },
  postContent: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    lineHeight: 24,
    marginBottom: 16,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  postImage: {
    width: (width - 80) / 2,
    height: 150,
    borderRadius: 12,
  },
  postStats: {
    marginBottom: 16,
  },
  statText: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  actionActive: {},
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },
  actionTextActive: {
    color: CommunityColors.primary,
  },
  repliesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    marginLeft: 24,
    marginBottom: 16,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: CommunityColors.text.secondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: 4,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  replyContainer: {
    marginBottom: 8,
  },
  commentLine: {
    width: 2,
    backgroundColor: CommunityColors.primary + '20',
    marginRight: 16,
    marginLeft: 24,
    borderRadius: 1,
  },
  commentCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    fontSize: 32,
    marginRight: 10,
  },
  replyAvatar: {
    fontSize: 24,
  },
  commentAuthorInfo: {
    flex: 1,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentName: {
    fontSize: 15,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  commentTime: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  commentContent: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    lineHeight: 20,
    marginBottom: 12,
    marginLeft: 42,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 42,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
  },
  commentActionActive: {
    color: CommunityColors.error,
  },
  repliesContainer: {
    marginTop: 12,
  },
  nestedReplyWrapper: {
    flexDirection: 'row',
    marginTop: 8,
  },
  nestedLine: {
    width: 2,
    backgroundColor: CommunityColors.primary + '10',
    marginRight: 12,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 30,
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CommunityColors.background.overlay,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 13,
    color: CommunityColors.primary,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  inputAvatar: {
    fontSize: 32,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: CommunityColors.text.primary,
    maxHeight: 100,
    paddingTop: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: CommunityColors.primary,
  },
  errorText: {
    fontSize: 18,
    color: CommunityColors.text.secondary,
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
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