// src/screens/community/CommunityScreen.tsx — COMPLETE REDESIGN
// Standard social media news feed with continuous scroll, soft refresh, and new post notifications
// Inspired by X/Twitter, Instagram, but personalized for LittleLoom

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Image,
  StatusBar,
  Share,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, Comment } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import {
  CommunityColors,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 60;
const POSTS_PER_PAGE = 10;

// ─── Navigation Routes Map ──────────────────────────────────────
const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'UserProfile',
  EDIT_PROFILE: 'EditCommunityProfile',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',
  TOPICS: 'Topic',
  AUTH: 'Auth',
  SEARCH: 'Search',
  BOOKMARKS: 'Bookmarks',
} as const;

type CommunityScreenProps = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

// ─── Video Player Component ───────────────────────────────────
const VideoPlayer = ({ uri, isVisible }: { uri: string; isVisible: boolean }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isVisible, player]);

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.videoPlayer}
        contentFit="cover"
        nativeControls={false}
      />
      {!isVisible && (
        <View style={styles.videoOverlay}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
        </View>
      )}
    </View>
  );
};

// ─── New Posts Banner ───────────────────────────────────────────
const NewPostsBanner = ({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) => (
  <Animated.View entering={SlideInDown.duration(300)} exiting={SlideOutUp.duration(200)} style={styles.newPostsBanner}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.newPostsGradient}
      >
        <Ionicons name="arrow-up" size={14} color="#fff" />
        <Text style={styles.newPostsText}>
          {count} new post{count > 1 ? 's' : ''}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
);

// ─── Story Ring Component ─────────────────────────────────────
const StoryRing = ({ color, isActive }: { color: string; isActive?: boolean }) => (
  <LinearGradient
    colors={isActive ? [color, '#764ba2'] : ['#e0e0e0', '#e0e0e0']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.storyRingGradient}
  />
);

// ─── Comment Item ───────────────────────────────────────────────
const CommentItem = ({
  comment,
  postId,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  onLike: (postId: string, commentId: string) => void;
  onReply: (postId: string, commentId: string) => void;
  depth?: number;
}) => {
  const [showReplies, setShowReplies] = useState(false);

  return (
    <View style={[styles.commentItem, depth > 0 && styles.commentReply]}>
      <SafeAvatar
        avatar={comment.author.avatar}
        size={28}
        fallbackIcon="person"
        fallbackColor={CommunityColors.primary}
        fallbackBgColor={CommunityColors.background.elevated}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
            <Text style={styles.commentTime}>{comment.time}</Text>
          </View>
          <Text style={styles.commentText}>{comment.content}</Text>
        </View>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={() => onLike(postId, comment.id)} style={styles.commentActionBtn}>
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={12}
              color={comment.isLiked ? CommunityColors.error : CommunityColors.text.tertiary}
            />
            <Text style={[styles.commentAction, comment.isLiked && styles.commentActionActive]}>
              {comment.likes > 0 ? comment.likes : 'Like'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(postId, comment.id)} style={styles.commentActionBtn}>
            <Ionicons name="chatbubble-outline" size={12} color={CommunityColors.text.tertiary} />
            <Text style={styles.commentAction}>Reply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentActionBtn}>
            <Ionicons name="thumbs-up-outline" size={12} color={CommunityColors.text.tertiary} />
            <Text style={styles.commentAction}>{comment.helpfulVotes > 0 ? `${comment.helpfulVotes} Helpful` : 'Helpful'}</Text>
          </TouchableOpacity>
        </View>

        {comment.replies && comment.replies.length > 0 && (
          <View>
            <TouchableOpacity onPress={() => setShowReplies(!showReplies)} style={styles.viewRepliesBtn}>
              <View style={styles.viewRepliesInner}>
                <Text style={[styles.viewReplies, { color: showReplies ? CommunityColors.text.secondary : '#667eea' }]}>
                  {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                </Text>
                <Ionicons name={showReplies ? 'chevron-up' : 'chevron-down'} size={12} color={showReplies ? CommunityColors.text.secondary : '#667eea'} />
              </View>
            </TouchableOpacity>
            {showReplies &&
              comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} postId={postId} onLike={onLike} onReply={onReply} depth={depth + 1} />
              ))}
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Post Card ──────────────────────────────────────────────────
const PostCard = ({
  post,
  index,
  currentUser,
  canInteract,
  isVisible,
  onNavigate,
  onLike,
  onRepost,
  onBookmark,
  onShare,
  onDelete,
  onFollowToggle,
  onVoteHelpful,
  onExpand,
  isExpanded,
  commentInput,
  onCommentChange,
  onCommentSubmit,
  replyingTo,
  onCancelReply,
  onReply,
  onLikeComment,
  topics,
}: {
  post: Post;
  index: number;
  currentUser: any;
  canInteract: boolean;
  isVisible: boolean;
  onNavigate: (screen: string, params?: any) => void;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onBookmark: (postId: string) => void;
  onShare: (post: Post) => void;
  onDelete: (postId: string) => void;
  onFollowToggle: (userId: string) => void;
  onVoteHelpful: (postId: string) => void;
  onExpand: (postId: string | null) => void;
  isExpanded: boolean;
  commentInput: string;
  onCommentChange: (postId: string, text: string) => void;
  onCommentSubmit: (postId: string) => void;
  replyingTo: { postId: string; commentId: string } | null;
  onCancelReply: () => void;
  onReply: (postId: string, commentId: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  topics: any[];
}) => {
  const topicColor = topics.find(t => t.id === post.topicId)?.color || '#667eea';
  const hasMedia = post.images && post.images.length > 0;
  const hasVideo = post.images?.some((img: string) => img.endsWith('.mp4') || img.endsWith('.mov'));

  return (
    <Animated.View entering={FadeInUp.delay(index < 5 ? index * 60 : 0).duration(350)}>
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => {
              if (post.authorId === currentUser?.id) {
                onNavigate(ROUTES.EDIT_PROFILE);
              } else {
                onNavigate(ROUTES.USER_PROFILE, { userId: post.authorId });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrapper}>
              <SafeAvatar
                avatar={post.author.avatar}
                size={44}
                fallbackIcon="person"
                fallbackColor={CommunityColors.primary}
                fallbackBgColor={CommunityColors.background.elevated}
                borderWidth={2}
                borderColor={post.author.isVerified ? topicColor : CommunityColors.border}
              />
              {post.author.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: topicColor }]}>
                  <Ionicons name="checkmark" size={8} color="#fff" />
                </View>
              )}
              {post.author.onlineStatus === 'online' && <View style={styles.onlineIndicator} />}
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {post.isAnonymous ? 'Anonymous Parent' : post.author.displayName}
                </Text>
                {post.author.isVerified && <Ionicons name="checkmark-circle" size={14} color={topicColor} />}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.authorHandle}>{post.isAnonymous ? '@anonymous' : post.author.handle}</Text>
                <Text style={styles.dotSeparator}>·</Text>
                <Text style={styles.postMeta}>{post.time}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => {
              const isAuthor = post.authorId === currentUser?.id;
              Alert.alert('Post Options', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share', onPress: () => onShare(post) },
                { text: post.isBookmarked ? 'Remove Bookmark' : 'Bookmark', onPress: () => onBookmark(post.id) },
                ...(isAuthor
                  ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => onDelete(post.id) }]
                  : [
                      { text: 'Follow', onPress: () => onFollowToggle(post.authorId) },
                      { text: 'Report', style: 'destructive' as const, onPress: () => onNavigate('Report', { type: 'post', targetId: post.id, targetUserId: post.authorId }) },
                    ]),
              ]);
            }}
          >
            <View style={styles.moreButtonInner}>
              <Ionicons name="ellipsis-horizontal" size={18} color={CommunityColors.text.tertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
        >
          <Text style={styles.postContent} numberOfLines={isExpanded ? undefined : 5}>
            {post.content}
          </Text>
          {post.content.length > 240 && !isExpanded && (
            <TouchableOpacity onPress={() => onExpand(post.id)}>
              <Text style={styles.readMore}>Show more</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Topic Tag */}
        <View style={styles.topicTagContainer}>
          <TouchableOpacity
            onPress={() => onNavigate(ROUTES.TOPICS, { topicId: post.topicId })}
            style={[styles.topicTag, { backgroundColor: topicColor + '12' }]}
          >
            <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.topicTagText, { color: topicColor }]}>{post.topic}</Text>
          </TouchableOpacity>
        </View>

        {/* Media */}
        {hasMedia && (
          <View style={styles.mediaContainer}>
            {post.images!.length === 1 ? (
              hasVideo ? (
                <VideoPlayer uri={post.images![0]} isVisible={isVisible} />
              ) : (
                <TouchableOpacity
                  onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                  activeOpacity={0.95}
                >
                  <Image source={{ uri: post.images![0] }} style={styles.postImageSingle} resizeMode="cover" />
                </TouchableOpacity>
              )
            ) : (
              <View style={styles.imageGrid}>
                {post.images!.slice(0, 4).map((img, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                    activeOpacity={0.95}
                  >
                    <View style={styles.imageGridItem}>
                      <Image source={{ uri: img }} style={styles.imageGridImage} resizeMode="cover" />
                      {i === 3 && post.images!.length > 4 && (
                        <View style={styles.moreImagesOverlay}>
                          <Text style={styles.moreImagesText}>+{post.images!.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Engagement Stats */}
        <View style={styles.engagementStats}>
          <Text style={styles.engagementText}>
            {post.likes > 0 && `${post.likes} like${post.likes > 1 ? 's' : ''}`}
            {post.likes > 0 && post.commentsCount > 0 && ' · '}
            {post.commentsCount > 0 && `${post.commentsCount} comment${post.commentsCount > 1 ? 's' : ''}`}
            {((post.likes > 0 || post.commentsCount > 0) && post.reposts > 0) && ' · '}
            {post.reposts > 0 && `${post.reposts} repost${post.reposts > 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[styles.actionBtn, post.isLiked && styles.actionBtnActive]}
            onPress={() => onLike(post.id)}
          >
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={post.isLiked ? '#fc5c7d' : CommunityColors.text.tertiary}
            />
            <Text style={[styles.actionText, post.isLiked && { color: '#fc5c7d', fontWeight: '700' }]}>
              {post.likes > 0 ? post.likes : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isExpanded && styles.actionBtnActive]}
            onPress={() => onExpand(isExpanded ? null : post.id)}
          >
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={isExpanded ? '#667eea' : CommunityColors.text.tertiary}
            />
            <Text style={[styles.actionText, isExpanded && { color: '#667eea', fontWeight: '700' }]}>
              {post.commentsCount > 0 ? post.commentsCount : 'Comment'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, post.isReposted && styles.actionBtnActive]}
            onPress={() => onRepost(post.id)}
          >
            <Ionicons
              name={post.isReposted ? 'repeat' : 'repeat-outline'}
              size={18}
              color={post.isReposted ? '#43e97b' : CommunityColors.text.tertiary}
            />
            <Text style={[styles.actionText, post.isReposted && { color: '#43e97b', fontWeight: '700' }]}>
              {post.reposts > 0 ? post.reposts : 'Repost'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post)}>
            <Ionicons name="share-outline" size={18} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Expanded Comments */}
        {isExpanded && (
          <View style={styles.commentsSection}>
            {post.comments.slice(0, 3).map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                onLike={onLikeComment}
                onReply={(postId, commentId) => {
                  if (!canInteract) {
                    Alert.alert('Sign In Required', 'Please sign in to reply');
                    return;
                  }
                  onReply(postId, commentId);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
            ))}
            {post.commentsCount > 3 && (
              <TouchableOpacity
                onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                style={styles.viewAllCommentsBtn}
              >
                <View style={styles.viewAllCommentsInner}>
                  <Text style={styles.viewAllComments}>View all {post.commentsCount} comments</Text>
                  <Ionicons name="arrow-forward" size={12} color="#667eea" />
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.commentInputContainer}>
              <SafeAvatar
                avatar={currentUser?.avatar}
                size={30}
                fallbackIcon="person"
                fallbackColor={CommunityColors.primary}
                fallbackBgColor={CommunityColors.background.elevated}
              />
              <View style={styles.commentInputWrapper}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={replyingTo?.postId === post.id ? 'Write a reply...' : 'Add a comment...'}
                  placeholderTextColor={CommunityColors.text.tertiary}
                  value={commentInput}
                  onChangeText={(text) => onCommentChange(post.id, text)}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !commentInput.trim() && styles.sendBtnDisabled]}
                  onPress={() => onCommentSubmit(post.id)}
                  disabled={!commentInput.trim()}
                >
                  <LinearGradient
                    colors={commentInput.trim() ? ['#667eea', '#764ba2'] : ['#e0e0e0', '#e0e0e0']}
                    style={styles.sendBtnGradient}
                  >
                    <Ionicons name="arrow-up" size={13} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            {replyingTo?.postId === post.id && (
              <TouchableOpacity onPress={onCancelReply} style={styles.cancelReplyBtn}>
                <Text style={styles.cancelReplyText}>Cancel reply</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Main CommunityScreen ───────────────────────────────────────
export default function CommunityScreen({ navigation }: CommunityScreenProps) {
  const {
    posts, topics, currentUser, likePost, unlikePost, repostPost, unrepostPost,
    bookmarkPost, deletePost, addComment, likeComment, replyToComment, voteHelpful,
    followUser, unfollowUser, isFollowing, refreshFeed, loadMorePosts, getFeedPosts,
    getUnreadCount, checkOnboardingStatus, getPopularPosts, incrementViewCount,
    isAuthenticated, syncUserProfileAcrossPosts,
  } = useCommunity();

  const { profile, communityProfile } = useUser();
  const { isAuthenticated: authIsAuthenticated } = useAuth();
  const { triggerHaptic } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => isAuthenticated() || authIsAuthenticated, [isAuthenticated, authIsAuthenticated]);

  // Profile sync
  useEffect(() => {
    if (currentUser?.id && communityProfile) {
      const hasChanges =
        communityProfile.displayName !== currentUser.displayName ||
        communityProfile.handle !== currentUser.handle ||
        communityProfile.avatar !== currentUser.avatar ||
        communityProfile.bio !== currentUser.bio;

      if (hasChanges) {
        syncUserProfileAcrossPosts(currentUser.id, {
          displayName: communityProfile.displayName,
          handle: communityProfile.handle,
          avatar: communityProfile.avatar,
          bio: communityProfile.bio,
        });
      }
    }
  }, [communityProfile?.displayName, communityProfile?.handle, communityProfile?.avatar, communityProfile?.bio, currentUser?.id]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await checkOnboardingStatus();
      setNeedsOnboarding(!completed && !currentUser);
    };
    checkOnboarding();
  }, [checkOnboardingStatus, currentUser]);

  // Initialize displayed posts
  useEffect(() => {
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
    setPage(1);
  }, [posts, activeTopic, searchQuery]);

  // Check for new posts
  useEffect(() => {
    if (prevPostsRef.current.length > 0 && posts.length > prevPostsRef.current.length) {
      const newCount = posts.length - prevPostsRef.current.length;
      setNewPostsCount(newCount);
      setShowNewPostsBanner(true);
    }
    prevPostsRef.current = posts;
  }, [posts]);

  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
    if (activeTopic !== 'all') filtered = filtered.filter((p) => p.topicId === activeTopic);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        p.content.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [posts, activeTopic, searchQuery, getFeedPosts]);

  const handleScrollToNewPosts = () => {
    setShowNewPostsBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  };

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

  const handleLike = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to like posts', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
      ]);
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(postId) : await likePost(postId);
  };

  const handleRepost = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to repost', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
      ]);
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(postId) : await repostPost(postId);
  };

  const handleBookmark = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to bookmark', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
      ]);
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  };

  const handleCommentSubmit = async (postId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to comment', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
      ]);
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
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleFollowToggle = async (userId: string) => {
    if (!canInteract) {
      Alert.alert('Sign In Required', 'Please sign in to follow users', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
      ]);
      return;
    }
    isFollowing(userId) ? await unfollowUser(userId) : await followUser(userId);
  };

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      const newShow = !prev;
      if (!newShow) setSearchQuery('');
      return newShow;
    });
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map((v) => (v.item as Post).id));
    setVisiblePostIds(visibleIds);

    // Increment view count for visible posts
    viewableItems.forEach((v) => {
      incrementViewCount((v.item as Post).id);
    });
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const renderPost = ({ item, index }: { item: Post; index: number }) => {
    const isExpanded = expandedPostId === item.id;
    const commentInput = commentInputs[item.id] || '';
    const isVisible = visiblePostIds.has(item.id);

    return (
      <PostCard
        post={item}
        index={index}
        currentUser={currentUser}
        canInteract={canInteract}
        isVisible={isVisible}
        onNavigate={(screen, params) => navigation.navigate(screen as any, params)}
        onLike={handleLike}
        onRepost={handleRepost}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onDelete={handleDelete}
        onFollowToggle={handleFollowToggle}
        onVoteHelpful={voteHelpful}
        onExpand={setExpandedPostId}
        isExpanded={isExpanded}
        commentInput={commentInput}
        onCommentChange={(postId, text) => setCommentInputs((prev) => ({ ...prev, [postId]: text }))}
        onCommentSubmit={handleCommentSubmit}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onReply={(postId, commentId) => setReplyingTo({ postId, commentId })}
        onLikeComment={likeComment}
        topics={topics}
      />
    );
  };

  const renderHeader = () => (
    <View>
      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <View style={styles.topNavLeft}>
          <TouchableOpacity
            style={styles.topNavAvatar}
            onPress={() => {
              if (canInteract) {
                navigation.navigate(ROUTES.EDIT_PROFILE as any);
              } else {
                navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' });
              }
            }}
          >
            <SafeAvatar
              avatar={currentUser?.avatar || profile?.avatar}
              size={36}
              fallbackIcon="person"
              fallbackColor="#667eea"
              fallbackBgColor="#667eea15"
            />
          </TouchableOpacity>
          <Text style={styles.topNavTitle}>LittleLoom</Text>
        </View>
        <View style={styles.topNavRight}>
          <TouchableOpacity style={styles.topNavIcon} onPress={toggleSearch}>
            <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={CommunityColors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topNavIcon}
            onPress={() => {
              if (canInteract) {
                navigation.navigate(ROUTES.NOTIFICATIONS as any);
              } else {
                Alert.alert('Sign In Required', 'Please sign in');
              }
            }}
          >
            <Ionicons name="notifications-outline" size={22} color={CommunityColors.text.primary} />
            {unreadCount > 0 && (
              <View style={styles.topNavBadge}>
                <Text style={styles.topNavBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topNavIcon}
            onPress={() => {
              if (canInteract) {
                navigation.navigate(ROUTES.MESSAGES as any);
              } else {
                Alert.alert('Sign In Required', 'Please sign in');
              }
            }}
          >
            <Ionicons name="mail-outline" size={22} color={CommunityColors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.searchBarContainer}>
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color={CommunityColors.text.tertiary} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search posts, topics, parents..."
              placeholderTextColor={CommunityColors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={CommunityColors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Stories / Quick Actions Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContainer}
      >
        {/* Create Post Story */}
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => {
            if (canInteract) {
              navigation.navigate(ROUTES.CREATE_POST as any);
            } else {
              Alert.alert('Sign In Required', 'Please sign in to create posts', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
              ]);
            }
          }}
        >
          <View style={styles.createStoryRing}>
            <View style={styles.createStoryInner}>
              <Ionicons name="add" size={24} color="#667eea" />
            </View>
          </View>
          <Text style={styles.storyLabel}>New Post</Text>
        </TouchableOpacity>

        {/* Topic Stories */}
        {topics.slice(0, 8).map((topic) => (
          <TouchableOpacity
            key={topic.id}
            style={styles.storyItem}
            onPress={() => {
              setActiveTopic(activeTopic === topic.id ? 'all' : topic.id);
            }}
          >
            <StoryRing color={topic.color} isActive={activeTopic === topic.id} />
            <View style={[styles.storyAvatar, { backgroundColor: topic.color + '15' }]}>
              <Text style={styles.storyEmoji}>{topic.emoji}</Text>
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>{topic.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active Filter Indicator */}
      {activeTopic !== 'all' && (
        <Animated.View entering={FadeIn} style={styles.activeFilterBar}>
          <View style={styles.activeFilterContent}>
            <Ionicons name="filter" size={13} color="#667eea" />
            <Text style={styles.activeFilterText}>
              Filtering by {topics.find((t) => t.id === activeTopic)?.name}
            </Text>
            <TouchableOpacity onPress={() => setActiveTopic('all')} style={styles.clearFilterBtn}>
              <Ionicons name="close-circle" size={15} color="#667eea" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#667eea" />
        <Text style={styles.footerLoaderText}>Loading more posts...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* New Posts Banner */}
      {showNewPostsBanner && (
        <NewPostsBanner count={newPostsCount} onPress={handleScrollToNewPosts} />
      )}

      {/* Main Feed */}
      <Animated.FlatList
        ref={listRef}
        data={displayedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={['#667eea']}
            progressBackgroundColor="#fff"
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={['#667eea15', '#764ba215']} style={styles.emptyIconGradient}>
                <Ionicons name="chatbubbles-outline" size={40} color="#667eea" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Be the first to share your parenting journey!</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() =>
                canInteract
                  ? navigation.navigate(ROUTES.CREATE_POST as any)
                  : Alert.alert('Sign In Required', 'Please sign in')
              }
            >
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.emptyBtnGradient}>
                <Text style={styles.emptyBtnText}>Create Your First Post</Text>
                <Ionicons name="arrow-forward" size={13} color="#fff" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (!canInteract) {
            Alert.alert('Sign In Required', 'Please sign in to create posts', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => navigation.navigate(ROUTES.AUTH as any, { screen: 'SignIn' }) },
            ]);
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST as any);
        }}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },

  // ─── Top Navigation Bar ─────────────────────────────────────────
  topNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: CommunitySpacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  topNavAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  topNavTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    letterSpacing: -0.5,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  topNavIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CommunityColors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topNavBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fc5c7d',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  topNavBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 3,
  },

  // ─── Search Bar ─────────────────────────────────────────────────
  searchBarContainer: {
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    gap: CommunitySpacing.sm,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: CommunityColors.text.primary,
    paddingVertical: 4,
  },

  // ─── Stories / Topics Bar ─────────────────────────────────────
  storiesContainer: {
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.md,
    gap: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  storyRingGradient: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
  },
  createStoryRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createStoryInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  storyEmoji: {
    fontSize: 24,
  },
  storyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
    textAlign: 'center',
  },

  // ─── New Posts Banner ─────────────────────────────────────────
  newPostsBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 70,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
  },
  newPostsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: CommunitySpacing.lg,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    ...CommunityShadows.medium,
  },
  newPostsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── Active Filter ────────────────────────────────────────────
  activeFilterBar: {
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.sm,
    backgroundColor: '#fff',
  },
  activeFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#667eea10',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    alignSelf: 'flex-start',
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  clearFilterBtn: {
    marginLeft: 3,
  },

  // ─── List Container ───────────────────────────────────────────
  listContainer: {
    paddingBottom: TAB_BAR_HEIGHT + CommunitySpacing.xl,
  },

  // ─── Post Card ────────────────────────────────────────────────
  postCard: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: CommunitySpacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 7,
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
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  authorInfo: {
    marginLeft: CommunitySpacing.sm,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    maxWidth: 180,
  },
  authorHandle: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  dotSeparator: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  postMeta: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },
  moreButton: {
    padding: CommunitySpacing.xs,
  },
  moreButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CommunityColors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postContent: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginTop: 4,
  },

  // ─── Topic Tag ──────────────────────────────────────────────────
  topicTagContainer: {
    marginTop: CommunitySpacing.sm,
    marginBottom: CommunitySpacing.xs,
  },
  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: CommunityBorderRadius.full,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ─── Media ────────────────────────────────────────────────────
  mediaContainer: {
    marginTop: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
  },
  postImageSingle: {
    width: '100%',
    height: 220,
    borderRadius: CommunityBorderRadius.lg,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  imageGridItem: {
    width: (SCREEN_WIDTH - CommunitySpacing.md * 2 - 3) / 2,
    height: (SCREEN_WIDTH - CommunitySpacing.md * 2 - 3) / 2,
    borderRadius: CommunityBorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  imageGridImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },

  // ─── Video Player ─────────────────────────────────────────────
  videoContainer: {
    width: '100%',
    height: 220,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // ─── Engagement Stats ─────────────────────────────────────────
  engagementStats: {
    marginTop: CommunitySpacing.sm,
    paddingBottom: CommunitySpacing.xs,
  },
  engagementText: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
  },

  // ─── Post Actions ─────────────────────────────────────────────
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: CommunitySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    marginTop: CommunitySpacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },

  // ─── Comments ───────────────────────────────────────────────────
  commentsSection: {
    marginTop: CommunitySpacing.sm,
    paddingTop: CommunitySpacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: CommunitySpacing.sm,
  },
  commentReply: {
    marginLeft: CommunitySpacing.xl,
  },
  commentContent: {
    flex: 1,
    marginLeft: CommunitySpacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentBubble: {
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.lg,
    padding: CommunitySpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  commentTime: {
    fontSize: 10,
    color: CommunityColors.text.tertiary,
  },
  commentText: {
    fontSize: 13,
    color: CommunityColors.text.primary,
    lineHeight: 19,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.md,
    marginTop: 5,
    marginLeft: CommunitySpacing.sm,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  commentAction: {
    fontSize: 11,
    fontWeight: '600',
    color: CommunityColors.text.tertiary,
  },
  commentActionActive: {
    color: CommunityColors.error,
    fontWeight: '700',
  },
  viewRepliesBtn: {
    marginLeft: CommunitySpacing.sm,
    marginBottom: CommunitySpacing.sm,
    alignSelf: 'flex-start',
  },
  viewRepliesInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: '#667eea10',
  },
  viewReplies: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllCommentsBtn: {
    marginVertical: CommunitySpacing.sm,
  },
  viewAllCommentsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
    marginTop: CommunitySpacing.sm,
  },
  viewAllComments: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
    marginTop: CommunitySpacing.sm,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.xs,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    color: CommunityColors.text.primary,
    maxHeight: 70,
    paddingVertical: 3,
  },
  sendBtn: {
    marginLeft: CommunitySpacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelReplyBtn: {
    marginLeft: 38,
    marginTop: 3,
  },
  cancelReplyText: {
    fontSize: 11,
    color: CommunityColors.text.tertiary,
    fontWeight: '600',
  },

  // ─── FAB ────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    bottom: TAB_BAR_HEIGHT + 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...CommunityShadows.large,
    zIndex: 50,
    elevation: 6,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Footer Loader ────────────────────────────────────────────
  footerLoader: {
    paddingVertical: CommunitySpacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
  },

  // ─── Empty State ──────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CommunitySpacing.xxl,
    marginTop: CommunitySpacing.xl,
  },
  emptyIconContainer: {
    marginBottom: CommunitySpacing.md,
  },
  emptyIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptyText: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.sm,
    textAlign: 'center',
    paddingHorizontal: CommunitySpacing.xl,
    lineHeight: 19,
  },
  emptyBtn: {
    marginTop: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.full,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.xl,
    paddingVertical: CommunitySpacing.md,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});