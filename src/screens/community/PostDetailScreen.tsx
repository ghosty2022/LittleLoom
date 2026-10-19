import {
  StyleSheet,
  ActivityIndicator,
  Linking,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  StatusBar,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';

import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { Comment, Post, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';

type PostDetailScreenProps = NativeStackScreenProps<CommunityStackParamList, 'PostDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',

  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },

  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

/* ── Linkify ──────────────────────────────────────────────── */
const LinkifyText = ({
  text,
  style,
  numberOfLines,
}: {
  text: string;
  style?: any;
  numberOfLines?: number;
}) => {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.match(/^(https?:\/\/|www\.)/)) {
          const url = part.startsWith('http') ? part : `https://${part}`;
          return (
            <Text
              key={i}
              style={{ color: DS.primary, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(url).catch(() => {})}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
};

/* ── Sensitive image (tap-to-reveal) ──────────────────────── */
const SensitiveImage = ({
  uri,
  style,
  resizeMode = 'cover',
}: {
  uri: string;
  style?: any;
  resizeMode?: any;
}) => {
  const [revealed, setRevealed] = useState(false);
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
      />
      {!revealed && (
        <BlurView
          intensity={75}
          style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}
          tint="dark"
        >
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Ionicons name="shield-checkmark" size={36} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', marginTop: 10, fontSize: 15 }}>
              Sensitive Content Hidden
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              Tap to reveal image
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 11,
                marginTop: 12,
                textAlign: 'center',
                maxWidth: 220,
              }}
            >
              LittleLoom blurs photos by default to keep our community safe.
            </Text>
          </View>
        </BlurView>
      )}
    </TouchableOpacity>
  );
};

/* ── Image grid ───────────────────────────────────────────── */
const ImageGrid = ({ images }: { images: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <View style={s.imageGridWrapper}>
      {images.length === 1 ? (
        <View style={s.singleImageContainer}>
          <SensitiveImage uri={images[0]} style={s.singleImage} resizeMode="cover" />
        </View>
      ) : (
        <View style={s.multiImageGrid}>
          {images.slice(0, 4).map((img, idx) => (
            <View key={idx} style={s.gridImageItem}>
              <SensitiveImage uri={img} style={s.gridImage} resizeMode="cover" />
              {idx === 3 && images.length > 4 && (
                <View style={s.gridMoreOverlay}>
                  <Text style={s.gridMoreText}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/* ── Poll widget (theme-aware) ────────────────────────────── */
const PollWidgetDetail = ({
  poll,
  postId,
  onVote,
  isDark,
}: {
  poll: any;
  postId: string;
  onVote: (postId: string, optionId: string) => void;
  isDark: boolean;
}) => {
  const [localPoll, setLocalPoll] = useState(poll);

  const handleVote = async (optionId: string) => {
    if (localPoll.hasVoted) return;
    await onVote(postId, optionId);
    setLocalPoll((prev: any) => ({
      ...prev,
      hasVoted: true,
      votedOptionId: optionId,
      totalVotes: prev.totalVotes + 1,
      options: prev.options.map((o: any) =>
        o.id === optionId ? { ...o, votes: o.votes + 1 } : o,
      ),
    }));
  };

  return (
    <View
      style={[
        s.pollWrap,
        {
          backgroundColor: isDark ? 'rgba(99,102,241,0.06)' : DS.primaryGhost,
          borderColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.15)',
        },
      ]}
    >
      <View style={s.pollHeader}>
        <Ionicons name="stats-chart" size={14} color={DS.primary} />
        <Text style={[s.pollQuestion, { color: isDark ? DS.white : DS.gray900 }]}>
          {localPoll.question}
        </Text>
      </View>

      {localPoll.options.map((option: any) => {
        const pct = localPoll.totalVotes > 0 ? Math.round((option.votes / localPoll.totalVotes) * 100) : 0;
        const isSelected = localPoll.votedOptionId === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleVote(option.id)}
            disabled={localPoll.hasVoted}
            style={s.pollOption}
            activeOpacity={0.85}
          >
            <View
              style={[
                s.pollTrack,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.10)' },
              ]}
            >
              {localPoll.hasVoted && (
                <LinearGradient
                  colors={
                    isSelected
                      ? [DS.primary, DS.primaryDark]
                      : isDark
                      ? ['rgba(99,102,241,0.45)', 'rgba(99,102,241,0.30)']
                      : ['rgba(99,102,241,0.35)', 'rgba(99,102,241,0.20)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.pollFill, { width: `${pct}%` }]}
                />
              )}
              <View style={s.pollOptionRow}>
                <View style={s.pollOptionLeft}>
                  {localPoll.hasVoted && (
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={14}
                      color={isSelected ? (isDark ? DS.white : DS.primaryDark) : isDark ? DS.gray400 : DS.gray500}
                    />
                  )}
                  <Text
                    style={[
                      s.pollOptionText,
                      {
                        color: localPoll.hasVoted
                          ? isSelected
                            ? DS.white
                            : isDark
                            ? DS.gray300
                            : DS.gray700
                          : isDark
                          ? DS.gray200
                          : DS.gray800,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {option.text}
                  </Text>
                </View>
                {localPoll.hasVoted && (
                  <Text
                    style={[
                      s.pollPct,
                      {
                        color: isSelected
                          ? DS.white
                          : isDark
                          ? DS.primaryLight
                          : DS.primaryDark,
                      },
                    ]}
                  >
                    {pct}%
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={s.pollMetaRow}>
        <Ionicons name="people-outline" size={11} color={isDark ? DS.gray500 : DS.gray500} />
        <Text style={[s.pollMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {localPoll.totalVotes} vote{localPoll.totalVotes !== 1 ? 's' : ''}
          {!localPoll.hasVoted ? ' · Tap to vote' : ''}
        </Text>
      </View>
    </View>
  );
};

/* ── Action button (icon + label/count) ──────────────────── */
const ActionButton = ({
  icon,
  label,
  count,
  active,
  activeColor,
  onPress,
  isDark,
}: {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
  isDark: boolean;
}) => {
  const tint = active ? activeColor || DS.primary : isDark ? DS.gray400 : DS.gray500;
  const display = count !== undefined && count > 0 ? String(count) : label;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.actionBtn}>
      <View
        style={[
          s.actionIconWrap,
          {
            backgroundColor: active
              ? `${activeColor || DS.primary}18`
              : isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.03)',
          },
        ]}
      >
        <Ionicons
          name={(active ? icon.replace('-outline', '') : icon) as any}
          size={18}
          color={tint}
        />
      </View>
      <Text
        style={[
          s.actionBtnText,
          { color: tint },
          active && { fontWeight: '800' },
        ]}
        numberOfLines={1}
      >
        {display}
      </Text>
    </TouchableOpacity>
  );
};

/* ════════════════════════════════════════════════════════════
   Main screen
   ════════════════════════════════════════════════════════════ */
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
    votePoll,
    currentUser,
    followUser,
    unfollowUser,
    isFollowing,
    deletePost,
    blockUser,
    isUserBlocked,
    sharePost,
    replyToComment,
    refreshFeed,
  } = useCommunity();

  const { darkMode, fullThemeColors, triggerHaptic, spinnerColor } = useCustomization();
  const isDark = darkMode ?? false;
  const sweetAlert = useSweetAlert();

  const [post, setPost] = useState<Post | undefined>(undefined);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }
    loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const loadPost = useCallback(() => {
    const foundPost = getPostById(postId);
    setPost(foundPost);
    setIsLoading(false);
  }, [postId, getPostById]);

  const refreshPost = useCallback(() => {
    if (!postId) return;
    const updated = getPostById(postId);
    if (updated) setPost(updated);
  }, [postId, getPostById]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    refreshPost();
    setRefreshing(false);
  }, [refreshFeed, refreshPost]);

  const handleLike = useCallback(async () => {
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(post.id) : await likePost(post.id);
    refreshPost();
  }, [post, likePost, unlikePost, refreshPost, triggerHaptic]);

  const handleRepost = useCallback(async () => {
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(post.id) : await repostPost(post.id);
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

  const handleVotePoll = useCallback(
    async (id: string, optionId: string) => {
      await votePoll(id, optionId);
      refreshPost();
    },
    [votePoll, refreshPost],
  );

  const handleSubmitComment = useCallback(async () => {
    if (!post || !commentText.trim()) return;
    triggerHaptic('success');

    if (replyingTo) {
      await replyToComment(post.id, replyingTo.commentId, commentText.trim());
      setReplyingTo(null);
    } else {
      await addComment(post.id, commentText.trim());
    }

    setCommentText('');
    refreshPost();
  }, [post, commentText, addComment, replyToComment, replyingTo, refreshPost, triggerHaptic]);

  const handleFollow = useCallback(async () => {
    if (!post) return;
    triggerHaptic('light');
    isFollowing(post.authorId)
      ? await unfollowUser(post.authorId)
      : await followUser(post.authorId);
    refreshPost();
  }, [post, followUser, unfollowUser, isFollowing, refreshPost, triggerHaptic]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
      await sharePost(post.id);
      refreshPost();
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [post, sharePost, refreshPost]);

  const navigateToUserProfile = useCallback(
    (userId: string) => {
      triggerHaptic('light');
      if (userId === currentUser?.id) {
        navigation.navigate('CommunityProfile');
      } else {
        navigation.navigate('CommunityMemberProfile', { userId });
      }
    },
    [navigation, currentUser, triggerHaptic],
  );

  const handleDelete = useCallback(() => {
    if (!post) return;
    sweetAlert.confirm(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      () => {
        deletePost(post.id);
        setShowMoreMenu(false);
        navigation.goBack();
      },
      () => setShowMoreMenu(false),
      'Delete',
      'Cancel',
    );
  }, [post, deletePost, navigation, sweetAlert]);

  const handleBlock = useCallback(() => {
    if (!post) return;
    const isBlocked = isUserBlocked(post.authorId);
    blockUser(post.authorId);
    setShowMoreMenu(false);
    sweetAlert.alert(
      isBlocked ? 'User Unblocked' : 'User Blocked',
      isBlocked ? 'You have unblocked this user.' : 'You have blocked this user.',
      'success',
    );
  }, [post, blockUser, isUserBlocked, sweetAlert]);

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

  /* ── Comment card ────────────────────────────────────────── */
  const CommentCard = ({ comment }: { comment: Comment }) => (
    <View
      style={[
        s.commentCard,
        {
          backgroundColor: isDark ? 'rgba(41,37,36,0.9)' : DS.white,
          borderColor: isDark ? DS.darkBorder : DS.lightBorder,
        },
      ]}
    >
      <TouchableOpacity
        style={s.commentAuthorRow}
        onPress={() => navigateToUserProfile(comment.authorId)}
        activeOpacity={0.75}
      >
        <SafeAvatar
          avatar={comment.author.avatar}
          size={36}
          fallbackIcon="person"
          fallbackColor={DS.primary}
          fallbackBgColor={`${DS.primary}20`}
        />
        <View style={s.commentAuthorInfo}>
          <View style={s.commentNameRow}>
            <Text style={[s.commentAuthorName, { color: isDark ? DS.white : DS.gray900 }]}>
              {comment.author.displayName}
            </Text>
            {comment.author.isVerified && (
              <Ionicons name="checkmark-circle" size={12} color={DS.primary} />
            )}
          </View>
          <Text style={[s.commentTime, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {comment.time}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={[s.commentBody, { color: isDark ? DS.gray300 : DS.gray700 }]}>
        {comment.content}
      </Text>

      <View style={s.commentFooter}>
        <TouchableOpacity
          style={[s.commentActionBtn, comment.isLiked && s.commentActionBtnActive]}
          onPress={() => {
            likeComment(post!.id, comment.id);
            refreshPost();
          }}
        >
          <Ionicons
            name={comment.isLiked ? 'heart' : 'heart-outline'}
            size={15}
            color={comment.isLiked ? DS.heart : isDark ? DS.gray400 : DS.gray500}
          />
          <Text
            style={[
              s.commentActionText,
              { color: isDark ? DS.gray400 : DS.gray500 },
              comment.isLiked && { color: DS.heart, fontWeight: '700' },
            ]}
          >
            {comment.likes > 0 ? comment.likes : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.commentActionBtn}
          onPress={() => {
            setReplyingTo({ commentId: comment.id, authorName: comment.author.displayName });
            triggerHaptic('light');
          }}
        >
          <Ionicons name="chatbubble-outline" size={15} color={isDark ? DS.gray400 : DS.gray500} />
          <Text style={[s.commentActionText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Reply
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.commentActionBtn} onPress={handleVoteHelpful}>
          <Ionicons name="thumbs-up-outline" size={15} color={isDark ? DS.gray400 : DS.gray500} />
          <Text style={[s.commentActionText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {comment.helpfulVotes > 0 ? `${comment.helpfulVotes} Helpful` : 'Helpful'}
          </Text>
        </TouchableOpacity>
      </View>

      {comment.replies && comment.replies.length > 0 && (
        <View style={s.repliesContainer}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={s.replyCard}>
              <SafeAvatar
                avatar={reply.author.avatar}
                size={28}
                fallbackIcon="person"
                fallbackColor={DS.primary}
                fallbackBgColor={`${DS.primary}20`}
              />
              <View style={s.replyContent}>
                <View
                  style={[
                    s.replyBubble,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50,
                      borderColor: isDark ? DS.darkBorder : DS.lightBorder,
                    },
                  ]}
                >
                  <Text style={[s.replyAuthorName, { color: isDark ? DS.white : DS.gray800 }]}>
                    {reply.author.displayName}
                  </Text>
                  <Text style={[s.replyBody, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                    {reply.content}
                  </Text>
                </View>
                <View style={s.replyFooter}>
                  <TouchableOpacity
                    style={[s.replyActionBtn, reply.isLiked && s.replyActionBtnActive]}
                    onPress={() => {
                      likeComment(post!.id, reply.id);
                      refreshPost();
                    }}
                  >
                    <Ionicons
                      name={reply.isLiked ? 'heart' : 'heart-outline'}
                      size={13}
                      color={reply.isLiked ? DS.heart : isDark ? DS.gray400 : DS.gray500}
                    />
                    <Text
                      style={[
                        s.replyActionText,
                        { color: isDark ? DS.gray400 : DS.gray500 },
                        reply.isLiked && { color: DS.heart },
                      ]}
                    >
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

  /* ── Loading state ──────────────────────────────────────── */
  if (isLoading) {
    return (
      <View
        style={[
          s.container,
          s.centerContent,
          { backgroundColor: isDark ? DS.darkBg : DS.lightBg },
        ]}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={spinnerColor || DS.primary} />
        <Text style={[s.loadingText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Loading post...
        </Text>
      </View>
    );
  }

  /* ── Not found ──────────────────────────────────────────── */
  if (!postId || !post) {
    return (
      <View
        style={[
          s.container,
          s.centerContent,
          { backgroundColor: isDark ? DS.darkBg : DS.lightBg },
        ]}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.25)', 'rgba(236,72,153,0.15)'] : ['rgba(99,102,241,0.12)', 'rgba(236,72,153,0.06)']}
          style={s.notFoundIconBg}
        >
          <Ionicons name="document-text-outline" size={40} color={DS.primary} />
        </LinearGradient>
        <Text style={[s.errorTitle, { color: isDark ? DS.white : DS.gray900 }]}>
          Post Not Found
        </Text>
        <Text style={[s.errorText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          This post may have been deleted or is no longer available.
        </Text>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={[DS.primary, DS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.backButtonGradient}
          >
            <Text style={s.backButtonText}>Go Back</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnPost = post.authorId === currentUser?.id;
  const topicColor = INITIAL_TOPICS.find((t) => t.id === post.topicId)?.color || DS.primary;
  const totalEngagement =
    post.likes + post.commentsCount + post.reposts + post.shares + (post.bookmarks || 0);

  return (
    <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* ── Aura background ── */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'transparent']
            : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* ── More menu ── */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={[s.moreMenu, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            {!isOwnPost && (
              <>
                <TouchableOpacity style={s.moreMenuItem} onPress={handleReport}>
                  <View style={[s.moreMenuIconWrap, { backgroundColor: `${DS.danger}15` }]}>
                    <Ionicons name="flag-outline" size={20} color={DS.danger} />
                  </View>
                  <Text style={[s.moreMenuText, { color: DS.danger }]}>Report Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.moreMenuItem} onPress={handleBlock}>
                  <View style={[s.moreMenuIconWrap, { backgroundColor: `${DS.danger}15` }]}>
                    <Ionicons name="ban" size={20} color={DS.danger} />
                  </View>
                  <Text style={[s.moreMenuText, { color: DS.danger }]}>
                    {isUserBlocked(post.authorId) ? 'Unblock User' : 'Block User'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {isOwnPost && (
              <TouchableOpacity style={s.moreMenuItem} onPress={handleDelete}>
                <View style={[s.moreMenuIconWrap, { backgroundColor: `${DS.danger}15` }]}>
                  <Ionicons name="trash-outline" size={20} color={DS.danger} />
                </View>
                <Text style={[s.moreMenuText, { color: DS.danger }]}>Delete Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.moreMenuItem, s.moreMenuItemLast]}
              onPress={() => setShowMoreMenu(false)}
            >
              <View style={[s.moreMenuIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.gray400 : DS.gray600} />
              </View>
              <Text style={[s.moreMenuText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={spinnerColor || DS.primary}
              colors={[DS.primary]}
              progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
            />
          }
        >
          {/* Header */}
          <View style={[s.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[s.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white }]}>
              <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray900} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>Thread</Text>
            <TouchableOpacity
              style={[s.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white }]}
              onPress={() => {
                triggerHaptic('light');
                setShowMoreMenu(true);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? DS.white : DS.gray900} />
            </TouchableOpacity>
          </View>

          {/* Post card */}
          <Animated.View
            entering={FadeInUp.duration(340).springify()}
            style={[
              s.postCard,
              {
                backgroundColor: isDark ? 'rgba(41,37,36,0.9)' : DS.white,
                borderColor: isDark ? DS.darkBorder : `${topicColor}25`,
              },
            ]}
          >
            {/* Aura glow on card */}
            <LinearGradient
              colors={[`${topicColor}${isDark ? '18' : '10'}`, 'transparent']}
              style={s.cardAuraTop}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[`${DS.accent}${isDark ? '10' : '06'}`, 'transparent']}
              style={s.cardAuraBottomRight}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
              pointerEvents="none"
            />

            {/* Topic badge */}
            <View style={s.topicBadgeRow}>
              <View style={[s.topicBadge, { backgroundColor: `${topicColor}18` }]}>
                <View style={[s.topicBadgeDot, { backgroundColor: topicColor }]} />
                <Text style={[s.topicBadgeText, { color: topicColor }]}>{post.topic}</Text>
                {post.isTrending && (
                  <View style={s.trendingBadge}>
                    <Ionicons name="flame" size={10} color={DS.warning} />
                    <Text style={s.trendingBadgeText}>Trending</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Author row */}
            <View style={s.postAuthorRow}>
              <TouchableOpacity
                style={s.postAuthorLeft}
                onPress={() => navigateToUserProfile(post.authorId)}
                activeOpacity={0.8}
              >
                {/* Aura avatar */}
                <View style={s.avatarAuraWrap}>
                  <LinearGradient
                    colors={
                      post.author.onlineStatus === 'online'
                        ? [DS.success, '#34d399', '#6ee7b7']
                        : [`${DS.primary}55`, `${DS.accent}35`, `${DS.primary}10`]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.avatarAuraRing}
                  />
                  <View
                    style={[
                      s.avatarAuraInner,
                      { backgroundColor: isDark ? DS.darkCard : DS.white },
                    ]}
                  >
                    <SafeAvatar
                      avatar={post.author.avatar}
                      size={46}
                      fallbackIcon="person"
                      fallbackColor={DS.primary}
                      fallbackBgColor={`${DS.primary}20`}
                    />
                  </View>
                  {post.author.isVerified && (
                    <View style={s.verifiedBadgeSmall}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                  {post.author.onlineStatus === 'online' && (
                    <View style={s.onlineIndicator} />
                  )}
                </View>

                <View style={s.postAuthorMeta}>
                  <View style={s.postNameRow}>
                    <Text
                      style={[s.postAuthorName, { color: isDark ? DS.white : DS.gray900 }]}
                      numberOfLines={1}
                    >
                      {post.author.displayName}
                    </Text>
                    {post.author.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color={DS.primary} />
                    )}
                  </View>
                  <View style={s.postMetaRow}>
                    <Text style={[s.postTimeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {post.time}
                    </Text>
                    <Text style={[s.postMetaDot, { color: isDark ? DS.gray500 : DS.gray400 }]}>•</Text>
                    <View style={s.postMetaStat}>
                      <Ionicons name="eye-outline" size={11} color={isDark ? DS.gray400 : DS.gray500} />
                      <Text style={[s.postMetaStatText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {post.viewCount || 0}
                      </Text>
                    </View>
                    <Text style={[s.postMetaDot, { color: isDark ? DS.gray500 : DS.gray400 }]}>•</Text>
                    <View style={s.postMetaStat}>
                      <Ionicons name="stats-chart" size={11} color={isDark ? DS.gray400 : DS.gray500} />
                      <Text style={[s.postMetaStatText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {totalEngagement}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              {post.authorId !== currentUser?.id && (
                <TouchableOpacity
                  style={[
                    s.followBtn,
                    isFollowing(post.authorId)
                      ? {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : DS.lightBorder,
                        }
                      : { backgroundColor: DS.primary, borderColor: DS.primary },
                  ]}
                  onPress={handleFollow}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isFollowing(post.authorId) ? 'checkmark' : 'add'}
                    size={12}
                    color={isFollowing(post.authorId) ? (isDark ? DS.gray300 : DS.gray700) : DS.white}
                  />
                  <Text
                    style={[
                      s.followBtnText,
                      isFollowing(post.authorId) && { color: isDark ? DS.gray300 : DS.gray700 },
                    ]}
                  >
                    {isFollowing(post.authorId) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mood */}
            {post.mood && (
              <View style={s.moodBadgeContainer}>
                <View
                  style={[
                    s.moodBadge,
                    {
                      backgroundColor: `${topicColor}${isDark ? '25' : '15'}`,
                      borderColor: `${topicColor}30`,
                    },
                  ]}
                >
                  <Text style={s.moodBadgeEmoji}>
                    {post.mood === 'celebrating'
                      ? '🎉'
                      : post.mood === 'support'
                      ? '💙'
                      : post.mood === 'advice'
                      ? '💡'
                      : post.mood === 'milestone'
                      ? '🏆'
                      : '💨'}
                  </Text>
                  <Text style={[s.moodBadgeText, { color: topicColor }]}>
                    {post.mood.charAt(0).toUpperCase() + post.mood.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Content */}
            <LinkifyText
              text={post.content}
              style={[s.postContent, { color: isDark ? DS.gray200 : DS.gray800 }]}
            />

            {/* Poll */}
            {post.poll && (
              <PollWidgetDetail
                poll={post.poll}
                postId={post.id}
                onVote={handleVotePoll}
                isDark={isDark}
              />
            )}

            {/* Images */}
            {post.images && post.images.length > 0 && <ImageGrid images={post.images} />}

            {/* Helpful votes */}
            {post.helpfulVotes > 0 && (
              <View style={s.helpfulWrap}>
                <TouchableOpacity
                  style={[
                    s.helpfulBadgeInner,
                    { backgroundColor: `${DS.primary}15` },
                  ]}
                  onPress={handleVoteHelpful}
                  activeOpacity={0.8}
                >
                  <Ionicons name="thumbs-up" size={13} color={DS.primary} />
                  <Text style={[s.helpfulBadgeText, { color: DS.primary }]}>
                    {post.helpfulVotes} found this helpful
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Stats bar */}
            <View style={[s.statsBar, { borderTopColor: isDark ? DS.darkBorder : DS.lightBorder, borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
              <View style={s.statItem}>
                <Ionicons name="heart" size={13} color={DS.heart} />
                <Text style={[s.statText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{post.likes}</Text>
              </View>
              <View style={[s.statDot, { backgroundColor: isDark ? DS.darkBorder : DS.gray300 }]} />
              <View style={s.statItem}>
                <Ionicons name="chatbubble" size={13} color={DS.primary} />
                <Text style={[s.statText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{post.commentsCount}</Text>
              </View>
              <View style={[s.statDot, { backgroundColor: isDark ? DS.darkBorder : DS.gray300 }]} />
              <View style={s.statItem}>
                <Ionicons name="repeat" size={13} color={DS.success} />
                <Text style={[s.statText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{post.reposts}</Text>
              </View>
              <View style={[s.statDot, { backgroundColor: isDark ? DS.darkBorder : DS.gray300 }]} />
              <View style={s.statItem}>
                <Ionicons name="bookmark" size={13} color={DS.accent} />
                <Text style={[s.statText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{post.bookmarks || 0}</Text>
              </View>
              <View style={[s.statDot, { backgroundColor: isDark ? DS.darkBorder : DS.gray300 }]} />
              <View style={s.statItem}>
                <Ionicons name="share" size={13} color={DS.info} />
                <Text style={[s.statText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{post.shares || 0}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={s.actionBar}>
              <ActionButton
                icon="heart-outline"
                label="Like"
                count={post.likes}
                active={post.isLiked}
                activeColor={DS.heart}
                onPress={handleLike}
                isDark={isDark}
              />
              <ActionButton
                icon="chatbubble-outline"
                label="Comment"
                count={post.commentsCount}
                onPress={() => {}}
                isDark={isDark}
              />
              <ActionButton
                icon="repeat-outline"
                label="Repost"
                count={post.reposts}
                active={post.isReposted}
                activeColor={DS.success}
                onPress={handleRepost}
                isDark={isDark}
              />
              <ActionButton
                icon="bookmark-outline"
                label="Save"
                count={post.bookmarks || 0}
                active={post.isBookmarked}
                activeColor={DS.accent}
                onPress={handleBookmark}
                isDark={isDark}
              />
              <ActionButton
                icon="share-outline"
                label="Share"
                count={post.shares || 0}
                onPress={handleShare}
                isDark={isDark}
              />
            </View>
          </Animated.View>

          {/* Comments */}
          <View style={s.commentsSection}>
            <View style={s.commentsHeader}>
              <Text style={[s.commentsTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                Comments
              </Text>
              <View style={[s.commentsCountBadge, { backgroundColor: `${DS.primary}18` }]}>
                <Text style={[s.commentsCountText, { color: DS.primary }]}>
                  {post.commentsCount}
                </Text>
              </View>
            </View>

            {post.comments.length === 0 ? (
              <View style={s.emptyComments}>
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)']
                      : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
                  }
                  style={s.emptyIconWrap}
                >
                  <Ionicons name="chatbubbles-outline" size={32} color={DS.primary} />
                </LinearGradient>
                <Text style={[s.emptyCommentsTitle, { color: isDark ? DS.white : DS.gray800 }]}>
                  No comments yet
                </Text>
                <Text style={[s.emptyCommentsSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Be the first to share your thoughts!
                </Text>
              </View>
            ) : (
              post.comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)
            )}
          </View>
        </ScrollView>

        {/* Comment input bar */}
        <View
          style={[
            s.commentInputWrap,
            {
              paddingBottom: insets.bottom + 12,
              borderTopColor: isDark ? DS.darkBorder : DS.lightBorder,
            },
          ]}
        >
          <BlurView
            intensity={85}
            style={[
              s.commentInputBlur,
              {
                backgroundColor: isDark ? 'rgba(12,10,9,0.85)' : 'rgba(255,255,255,0.92)',
              },
            ]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={s.commentInputRow}>
              <SafeAvatar
                avatar={currentUser?.avatar}
                size={34}
                fallbackIcon="person"
                fallbackColor={DS.primary}
                fallbackBgColor={`${DS.primary}20`}
              />
              <View
                style={[
                  s.commentInputBox,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50,
                    borderColor: isDark ? DS.darkBorder : DS.lightBorder,
                  },
                ]}
              >
                {replyingTo && (
                  <View
                    style={[
                      s.replyingToBar,
                      { borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder },
                    ]}
                  >
                    <Ionicons name="return-down-forward" size={11} color={DS.primary} />
                    <Text style={[s.replyingToText, { color: DS.primary }]}>
                      Replying to {replyingTo.authorName}
                    </Text>
                    <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                      <Ionicons name="close" size={13} color={isDark ? DS.gray400 : DS.gray500} />
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={[s.commentInputField, { color: isDark ? DS.white : DS.gray900 }]}
                  placeholder={
                    replyingTo ? `Reply to ${replyingTo.authorName}...` : 'Write a comment...'
                  }
                  placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                style={[s.sendBtn, !commentText.trim() && s.sendBtnDisabled]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={commentText.trim() ? [DS.primary, DS.accent] : [DS.gray300, DS.gray300]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.sendBtnGradient}
                >
                  <Ionicons name="arrow-up" size={18} color={DS.white} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   Styles
   ════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.lightBg },
  centerContent: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: DS.space.lg },
  keyboardView: { flex: 1 },
  loadingText: { marginTop: 16, fontWeight: '600', fontSize: 15 },

  notFoundIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: { fontSize: 20, fontWeight: '800', marginTop: DS.space.md },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: DS.space.sm,
    marginBottom: DS.space.lg,
    lineHeight: 20,
  },
  backButton: { borderRadius: DS.radius.full, overflow: 'hidden', ...DS.shadow.md },
  backButtonGradient: { paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...DS.shadow.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  /* Post card */
  postCard: {
    borderRadius: DS.radius['2xl'],
    padding: DS.space.lg,
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  cardAuraTop: {
    position: 'absolute',
    top: -60,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.9,
  },
  cardAuraBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.8,
  },

  topicBadgeRow: { flexDirection: 'row', marginBottom: DS.space.md },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  topicBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  topicBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${DS.warning}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  trendingBadgeText: { fontSize: 9, fontWeight: '800', color: DS.warning },

  postAuthorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DS.space.md,
  },
  postAuthorLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  avatarAuraWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarAuraRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarAuraInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: DS.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DS.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: DS.success,
    borderWidth: 2,
    borderColor: DS.white,
  },

  postAuthorMeta: { marginLeft: 12, flex: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAuthorName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  postTimeText: { fontSize: 12, fontWeight: '500' },
  postMetaDot: { fontSize: 12 },
  postMetaStat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  postMetaStatText: { fontSize: 11, fontWeight: '500' },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  followBtnText: { fontSize: 12, fontWeight: '800', color: DS.white },

  moodBadgeContainer: { marginBottom: DS.space.md },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  moodBadgeEmoji: { fontSize: 13 },
  moodBadgeText: { fontSize: 11, fontWeight: '800' },

  postContent: { fontSize: 15.5, lineHeight: 25, marginBottom: DS.space.md },

  /* Images */
  imageGridWrapper: {
    marginBottom: DS.space.md,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  singleImageContainer: {
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  singleImage: { width: '100%', height: 280, borderRadius: DS.radius.lg },
  multiImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridImageItem: {
    width: (SCREEN_WIDTH - DS.space.lg * 2 - 40 - 4) / 2,
    height: (SCREEN_WIDTH - DS.space.lg * 2 - 40 - 4) / 2,
    borderRadius: DS.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  gridMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: DS.radius.md,
  },
  gridMoreText: { color: '#fff', fontSize: 22, fontWeight: '800' },

  /* Helpful */
  helpfulWrap: { marginBottom: DS.space.sm },
  helpfulBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  helpfulBadgeText: { fontSize: 12, fontWeight: '800' },

  /* Poll */
  pollWrap: {
    marginBottom: DS.space.md,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    borderWidth: 1,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: DS.space.md,
  },
  pollQuestion: { fontSize: 14, fontWeight: '800', flex: 1 },
  pollOption: { marginBottom: 8 },
  pollTrack: {
    height: 42,
    borderRadius: DS.radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollFill: { ...StyleSheet.absoluteFillObject, borderRadius: DS.radius.md },
  pollOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  pollOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pollOptionText: { fontSize: 13.5, flexShrink: 1 },
  pollPct: { fontSize: 13, fontWeight: '800' },
  pollMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pollMeta: { fontSize: 11, fontWeight: '500' },

  /* Stats bar */
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '700' },
  statDot: { width: 3, height: 3, borderRadius: 1.5 },

  /* Action bar */
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: 11.5, fontWeight: '600' },

  /* Comments */
  commentsSection: { marginTop: DS.space.sm, paddingHorizontal: DS.space.lg },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: DS.space.md,
  },
  commentsTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  commentsCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  commentsCountText: { fontSize: 12, fontWeight: '800' },

  emptyComments: { alignItems: 'center', paddingVertical: DS.space['2xl'] },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyCommentsTitle: { fontSize: 15, fontWeight: '800' },
  emptyCommentsSub: { fontSize: 13, marginTop: 4, fontWeight: '500' },

  commentCard: {
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    marginBottom: DS.space.sm,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  commentAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  commentAuthorInfo: { flex: 1, marginLeft: 10 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentAuthorName: { fontSize: 14, fontWeight: '800' },
  commentTime: { fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  commentBody: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  commentFooter: { flexDirection: 'row', gap: 8 },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  commentActionBtnActive: { backgroundColor: `${DS.heart}10` },
  commentActionText: { fontSize: 12, fontWeight: '600' },

  repliesContainer: { marginTop: 10, marginLeft: 46, gap: 8 },
  replyCard: { flexDirection: 'row', gap: 8 },
  replyContent: { flex: 1 },
  replyBubble: { borderRadius: DS.radius.lg, padding: 10, borderWidth: 1 },
  replyAuthorName: { fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  replyBody: { fontSize: 12.5, lineHeight: 18 },
  replyFooter: { flexDirection: 'row', marginTop: 4, marginLeft: 4 },
  replyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  replyActionBtnActive: { backgroundColor: `${DS.heart}10` },
  replyActionText: { fontSize: 11, fontWeight: '600' },

  /* Comment input */
  commentInputWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  commentInputBlur: {
    paddingHorizontal: DS.space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentInputBox: {
    flex: 1,
    borderRadius: DS.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  replyingToText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  commentInputField: { fontSize: 13.5, maxHeight: 100, padding: 0 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* More menu */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  moreMenu: { borderRadius: 20, overflow: 'hidden', ...DS.shadow.md },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,120,0.15)',
  },
  moreMenuItemLast: { borderBottomWidth: 0 },
  moreMenuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreMenuText: { fontSize: 15, fontWeight: '700', flex: 1 },
});