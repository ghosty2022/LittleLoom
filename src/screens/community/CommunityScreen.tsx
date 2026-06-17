import {  ActivityIndicator, AlertAnimated, Button, Dimensions, FlatList, GestureHandlerRootView, Image, Modal, Platform, Pressable, RefreshControl, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useSafeAreaInsets, View } from 'react-native';;
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing, FadeIn, FadeInUp, FadeOut, interpolate, interpolateColor, Layout, runOnJS, SlideInDown, SlideOutUp, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useCommunity } from '../../context/CommunityContext';
import { EmptyState } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CommunityColors,
  CommunityGradients,
  CommunityShadows,
  CommunityBorderRadius,
} from '../../theme/CommunityTheme';
import type { CommunityStackParamList } from '../../types/navigation';

import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAutoHideNav } from '../../hooks/useAutoHideNav';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { showAlert } from '@/utils/alert';


// Import the LittleLoom logo
const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

const LL = {
  primary: '#7c6cf1',
  primaryLight: '#a5b4fc',
  primaryDark: '#6b5ce7',
  primaryGhost: '#7c6cf118',
  accent: '#f472b6',
  accentSoft: '#fbcfe8',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#38bdf8',
  mood: {
    celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline' },
    support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline' },
    advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline' },
    milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline' },
    venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline' },
  },
  white: '#ffffff',
  gray50: '#f8f9ff',
  gray100: '#f0f2ff',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  darkBg: '#0b0f1f',
  darkSurface: '#151b2e',
  darkCard: '#1a2236',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '600' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 16, line: 24, weight: '600' as const },
    xl: { size: 18, line: 26, weight: '700' as const },
    '2xl': { size: 22, line: 30, weight: '800' as const },
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'CommunityMemberProfile',
  EDIT_PROFILE: 'CommunityProfile',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',
  TOPICS: 'Topic',
  AUTH: 'Auth',
  TRACKER_REMINDERS: 'TrackerReminders',
} as const;

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 50 : STATUS_BAR_HEIGHT + 12;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 56;

interface StoryItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isUser: boolean;
  hasStory: boolean;
  isViewed: boolean;
  content: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
  replies?: StoryReply[];
}

interface StoryReply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
}

const MOCK_LITTLELOOM_STORY: StoryItem = {
  id: 'story_littleloom_official',
  userId: 'littleloom_team',
  userName: 'LittleLoom',
  userAvatar: '🧸',
  isUser: false,
  hasStory: true,
  isViewed: false,
  content: '🌟 Welcome to LittleLoom! Tap to see what our community is weaving today. Share your own story and connect with parents worldwide! 💙',
  mediaUri: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&q=80',
  mediaType: 'image',
  timestamp: new Date().toISOString(),
  replies: [
    {
      id: 'reply_1',
      userId: 'user_demo',
      userName: 'Sarah M.',
      userAvatar: '👩',
      content: 'Love this community! 💕',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'reply_2',
      userId: 'user_demo2',
      userName: 'James K.',
      userAvatar: '👨',
      content: 'So glad I found this app!',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
};

const MomentsBar = React.memo(({
  moments,
  onAddMoment,
  onViewMoment,
  isDark,
}: {
  moments: StoryItem[];
  onAddMoment: () => void;
  onViewMoment: (story: StoryItem) => void;
  isDark: boolean;
}) => {
  return (
    <View style={[
      styles.momentsContainer,
      { backgroundColor: isDark ? LL.darkSurface : LL.white, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }
    ]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={moments}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.momentsList}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 40).duration(300).springify()}>
            <Pressable
              onPress={() => item.isUser ? onAddMoment() : onViewMoment(item)}
              style={styles.momentPressable}
            >
              <View style={[
                styles.momentRing,
                item.hasStory && !item.isViewed && { 
                  borderColor: item.isUser ? LL.primary : LL.accent,
                  borderWidth: 3,
                },
                item.hasStory && item.isViewed && { 
                  borderColor: isDark ? LL.gray600 : LL.gray300,
                  borderWidth: 2,
                },
                !item.hasStory && { 
                  borderColor: isDark ? LL.darkBorder : LL.gray200,
                  borderWidth: 2,
                },
              ]}>
                <SafeAvatar
                  avatar={item.userAvatar}
                  size={52}
                  fallbackIcon={item.isUser ? 'add' : 'person'}
                  fallbackColor={item.isUser ? LL.primary : LL.gray400}
                  fallbackBgColor={item.isUser ? LL.primaryGhost : isDark ? LL.darkCard : LL.gray100}
                  borderWidth={0}
                />
                {item.isUser && (
                  <View style={styles.momentAddBadge}>
                    <LinearGradient colors={[LL.primary, LL.primaryDark]} style={styles.momentAddGrad}>
                      <Ionicons name="add" size={12} color={LL.white} />
                    </LinearGradient>
                  </View>
                )}
                {item.hasStory && !item.isViewed && !item.isUser && (
                  <View style={styles.storyUnreadDot} />
                )}
              </View>
              <Text
                style={[
                  styles.momentName,
                  { color: isDark ? LL.gray300 : LL.gray600 },
                  item.isUser && { color: LL.primary, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {item.userName}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
});

const StoryViewer = React.memo(({
  visible,
  story,
  onClose,
  onReply,
  onShare,
  onReact,
  currentUser,
  isDark,
}: {
  visible: boolean;
  story: StoryItem | null;
  onClose: () => void;
  onReply: (storyId: string, content: string) => void;
  onShare: (story: StoryItem) => void;
  onReact: (storyId: string, reaction: string) => void;
  currentUser: any;
  isDark: boolean;
}) => {
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const progressAnim = useSharedValue(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (visible && story) {
      progressAnim.value = 0;
      progressAnim.value = withTiming(1, { duration: 15000, easing: Easing.linear }, (finished) => {
        if (finished) {
          runOnJS(onClose)();
        }
      });
    }
  }, [visible, story]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  if (!story) return null;

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(story.id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.storyModalContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        <View style={styles.storyBackground}>
          {story.mediaUri ? (
            <Image
              source={{ uri: story.mediaUri }}
              style={styles.storyMedia}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2', '#f093fb']}
              style={styles.storyMedia}
            />
          )}
          <View style={styles.storyOverlay} />
        </View>

        <View style={styles.storyProgressContainer}>
          <View style={styles.storyProgressTrack}>
            <Animated.View style={[styles.storyProgressFill, progressStyle]} />
          </View>
        </View>

        <View style={styles.storyHeader}>
          <View style={styles.storyHeaderLeft}>
            <SafeAvatar
              avatar={story.userAvatar}
              size={40}
              fallbackIcon="person"
              fallbackColor={LL.white}
              fallbackBgColor="rgba(255,255,255,0.2)"
              borderWidth={2}
              borderColor="rgba(255,255,255,0.5)"
            />
            <View style={styles.storyHeaderInfo}>
              <Text style={styles.storyHeaderName}>{story.userName}</Text>
              <Text style={styles.storyHeaderTime}>
                {new Date(story.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.storyCloseBtn}>
            <Ionicons name="close" size={28} color={LL.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.storyContent}>
          <Text style={styles.storyText}>{story.content}</Text>
        </View>

        <View style={styles.storyReactions}>
          {['❤️', '😂', '👏', '🔥', '😮'].map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.storyReactionBtn}
              onPress={() => onReact(story.id, emoji)}
            >
              <Text style={styles.storyReactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {story.replies && story.replies.length > 0 && (
          <Animated.ScrollView style={styles.storyReplies} showsVerticalScrollIndicator={false}>
            {story.replies.map((reply) => (
              <View key={reply.id} style={styles.storyReplyItem}>
                <SafeAvatar
                  avatar={reply.userAvatar}
                  size={28}
                  fallbackIcon="person"
                  fallbackColor={LL.white}
                  fallbackBgColor="rgba(255,255,255,0.2)"
                  borderWidth={0}
                />
                <View style={styles.storyReplyBubble}>
                  <Text style={styles.storyReplyName}>{reply.userName}</Text>
                  <Text style={styles.storyReplyText}>{reply.content}</Text>
                </View>
              </View>
            ))}
          </Animated.ScrollView>
        )}

        <View style={styles.storyBottom}>
          {showReplyInput ? (
            <View style={styles.storyReplyInputContainer}>
              <TextInput
                style={styles.storyReplyInput}
                placeholder="Reply to story..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={replyText}
                onChangeText={setReplyText}
                autoFocus
                maxLength={200}
              />
              <TouchableOpacity onPress={handleReply} style={styles.storyReplySend}>
                <Ionicons name="send" size={20} color={LL.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.storyBottomActions}>
              <TouchableOpacity
                style={styles.storyReplyBtn}
                onPress={() => setShowReplyInput(true)}
              >
                <Ionicons name="chatbubble" size={20} color={LL.white} />
                <Text style={styles.storyReplyBtnText}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.storyShareBtn}
                onPress={() => onShare(story)}
              >
                <Ionicons name="arrow-redo" size={20} color={LL.white} />
                <Text style={styles.storyShareBtnText}>Reshare</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Pressable
          style={styles.storyTouchLeft}
          onPressIn={() => {
            setIsPaused(true);
            progressAnim.value = withTiming(progressAnim.value, { duration: 0 });
          }}
          onPressOut={() => {
            setIsPaused(false);
            progressAnim.value = withTiming(1, { 
              duration: 15000 * (1 - progressAnim.value),
              easing: Easing.linear 
            }, (finished) => {
              if (finished) runOnJS(onClose)();
            });
          }}
        />
      </View>
    </Modal>
  );
});

const DailyWeavePrompt = React.memo(({
  prompt,
  onRespond,
  isDark,
}: {
  prompt: { question: string; emoji: string; color: string };
  onRespond: () => void;
  isDark: boolean;
}) => {
  return (
    <Animated.View entering={FadeInUp.delay(100).duration(500).springify()} style={styles.promptWrap}>
      <LinearGradient
        colors={isDark ? [LL.darkCard, LL.darkSurface] : [LL.white, LL.gray50]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.promptCard,
          { borderColor: isDark ? LL.darkBorder : LL.gray200 },
        ]}
      >
        <View style={styles.promptHeader}>
          <View style={[styles.promptIconBg, { backgroundColor: `${prompt.color}15` }]}>
            <Text style={styles.promptEmoji}>{prompt.emoji}</Text>
          </View>
          <View style={styles.promptMeta}>
            <Text style={[styles.promptLabel, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              Daily Weave
            </Text>
            <Text style={[styles.promptQuestion, { color: isDark ? LL.white : LL.gray800 }]}>
              {prompt.question}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onRespond}
          activeOpacity={0.8}
          style={styles.promptBtn}
        >
          <LinearGradient
            colors={[prompt.color, `${prompt.color}dd`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.promptBtnGrad}
          >
            <Ionicons name="pencil" size={14} color={LL.white} />
            <Text style={styles.promptBtnText}>Weave your answer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
});

const CommunityPulse = React.memo(({ count, isDark }: { count: number; isDark: boolean }) => {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1200, easing: Easing.ease }),
        withTiming(1, { duration: 1200, easing: Easing.ease }),
      ),
      -1,
      true,
    );
  }, [pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: interpolate(pulseAnim.value, [1, 1.4], [0.6, 0]),
  }));

  return (
    <View style={[
      styles.pulseWrap,
      { backgroundColor: isDark ? LL.darkSurface : LL.white, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }
    ]}>
      <View style={styles.pulseInner}>
        <View style={styles.pulseDotWrap}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.pulseDot} />
        </View>
        <Text style={[styles.pulseText, { color: isDark ? LL.gray300 : LL.gray600 }]}>
          <Text style={{ color: LL.success, fontWeight: '800' }}>{count}</Text> parent
          {count !== 1 ? 's' : ''} weaving now
        </Text>
      </View>
    </View>
  );
});

const MoodBadge = React.memo(({ mood, isDark }: { mood: PostMood; isDark: boolean }) => {
  const config = LL.mood[mood] || LL.mood.advice;
  return (
    <View style={[
      styles.moodBadge,
      { backgroundColor: isDark ? `${config.text}20` : config.bg }
    ]}>
      <Ionicons name={config.icon as any} size={11} color={config.text} />
      <Text style={[styles.moodText, { color: config.text }]}>{mood}</Text>
    </View>
  );
});

const PollWidget = React.memo(({
  poll,
  postId,
  onVote,
  isDark,
}: {
  poll: Poll;
  postId: string;
  onVote: (postId: string, optionId: string) => void;
  isDark: boolean;
}) => {
  const maxVotes = Math.max(...poll.options.map(o => o.votes), 1);

  return (
    <View style={[
      styles.pollWrap,
      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : LL.gray50 }
    ]}>
      <Text style={[styles.pollQuestion, { color: isDark ? LL.white : LL.gray800 }]}>
        {poll.question}
      </Text>
      {poll.options.map((option) => {
        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
        const isSelected = poll.votedOptionId === option.id;
        const showResults = poll.hasVoted;

        return (
          <Pressable
            key={option.id}
            onPress={() => !poll.hasVoted && onVote(postId, option.id)}
            style={styles.pollOption}
          >
            <View style={styles.pollTrack}>
              {showResults && (
                <Animated.View
                  entering={FadeIn.duration(600)}
                  style={[
                    styles.pollFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? LL.primary : `${LL.primary}30`,
                    },
                  ]}
                />
              )}
              {!showResults && isSelected && (
                <View style={[styles.pollFill, { width: '100%', backgroundColor: `${LL.primary}15` }]} />
              )}
              <View style={styles.pollOptionContent}>
                <Text style={[styles.pollOptionText, { color: isDark ? LL.gray200 : LL.gray700 }]}>
                  {option.text}
                </Text>
                {showResults && (
                  <Text style={[styles.pollPercent, { color: isSelected ? LL.primary : LL.gray400 }]}>
                    {percentage}%
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.pollMeta, { color: isDark ? LL.gray500 : LL.gray400 }]}>
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {!poll.hasVoted && ' · Tap to vote'}
      </Text>
    </View>
  );
});

const SmartVideoPlayer = React.memo(({ uri, isVisible }: { uri: string; isVisible: boolean }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = false;
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
    <View style={styles.videoBox}>
      <VideoView
        player={player}
        style={styles.videoView}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen
      />
      {!isVisible && (
        <View style={styles.videoPausedOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={20} color={LL.white} />
          </View>
        </View>
      )}
    </View>
  );
});

const ReactionBar = React.memo(({
  postId,
  isLiked,
  likes,
  commentsCount,
  reposts,
  isReposted,
  onLike,
  onRepost,
  onComment,
  onShare,
}: {
  postId: string;
  isLiked: boolean;
  likes: number;
  commentsCount: number;
  reposts: number;
  isReposted: boolean;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onShare: () => void;
}) => {
  const likeScale = useSharedValue(1);
  const repostScale = useSharedValue(1);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const repostAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: repostScale.value }],
  }));

  const handleLike = () => {
    likeScale.value = withSequence(
      withSpring(1.4, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onLike();
  };

  const handleRepost = () => {
    repostScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onRepost();
  };

  return (
    <View style={styles.reactionBar}>
      <Pressable onPress={handleLike} style={styles.reactionBtn}>
        <Animated.View style={likeAnimatedStyle}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? LL.accent : LL.gray400}
          />
        </Animated.View>
        <Text style={[
          styles.reactionCount,
          isLiked && { color: LL.accent, fontWeight: '800' },
        ]}>
          {likes > 0 ? likes : 'Like'}
        </Text>
      </Pressable>

      <Pressable onPress={onComment} style={styles.reactionBtn}>
        <Ionicons name="chatbubble-outline" size={20} color={LL.gray400} />
        <Text style={styles.reactionCount}>
          {commentsCount > 0 ? commentsCount : 'Comment'}
        </Text>
      </Pressable>

      <Pressable onPress={handleRepost} style={styles.reactionBtn}>
        <Animated.View style={repostAnimatedStyle}>
          <Ionicons
            name={isReposted ? 'repeat' : 'repeat-outline'}
            size={20}
            color={isReposted ? LL.success : LL.gray400}
          />
        </Animated.View>
        <Text style={[
          styles.reactionCount,
          isReposted && { color: LL.success, fontWeight: '800' },
        ]}>
          {reposts > 0 ? reposts : 'Repost'}
        </Text>
      </Pressable>

      <Pressable onPress={onShare} style={styles.reactionBtn}>
        <Ionicons name="share-outline" size={20} color={LL.gray400} />
      </Pressable>
    </View>
  );
});

const PostCard = React.memo(({
  post,
  index,
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
  onVotePoll,
  topics,
  currentUser,
  canInteract,
  isDark,
}: {
  post: Post;
  index: number;
  isVisible: boolean;
  onNavigate: (screen: string, params?: any) => void;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onBookmark: (id: string) => void;
  onShare: (p: Post) => void;
  onDelete: (id: string) => void;
  onFollowToggle: (id: string) => void;
  onVoteHelpful: (id: string) => void;
  onExpand: (id: string | null) => void;
  isExpanded: boolean;
  commentInput: string;
  onCommentChange: (id: string, text: string) => void;
  onCommentSubmit: (id: string) => void;
  replyingTo: any;
  onCancelReply: () => void;
  onReply: (pid: string, cid: string) => void;
  onLikeComment: (pid: string, cid: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  topics: any[];
  currentUser: any;
  canInteract: boolean;
  isDark: boolean;
}) => {
  const topicColor = topics.find(t => t.id === post.topicId)?.color || LL.primary;
  const hasMedia = post.images && post.images.length > 0;
  const hasVideo = post.images?.some((img: string) =>
    img.endsWith('.mp4') || img.endsWith('.mov'),
  );
  const isAuthor = post.authorId === currentUser?.id;

  const cardScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

showAlert('Thread Options', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Share', onPress: () => onShare(post) },
      {
        text: post.isBookmarked ? 'Remove Bookmark' : 'Bookmark',
        onPress: () => onBookmark(post.id),
      },
      ...(isAuthor
        ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => onDelete(post.id) }]
        : [
          {
            text: post.author.isFollowing ? 'Unfollow' : 'Follow',
            onPress: () => onFollowToggle(post.authorId),
          },
          {
            text: 'Report',
            style: 'destructive' as const,
            onPress: () => onNavigate('Report', { type: 'post', targetId: post.id }),
          },
        ]),
    ]);
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index < 6 ? index * 80 : 0).duration(500).springify()}
      layout={Layout.springify()}
    >
      <Pressable
        onPressIn={() => { cardScale.value = withTiming(0.98, { duration: 100 }); }}
        onPressOut={() => { cardScale.value = withTiming(1, { duration: 200 }); }}
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={styles.postCardWrap}
      >
        <Animated.View style={[
          styles.postCard,
          cardAnimatedStyle,
          {
            backgroundColor: isDark ? LL.darkCard : LL.white,
            borderColor: isDark ? LL.darkBorder : LL.gray200,
          },
        ]}>
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => onNavigate(
                isAuthor ? ROUTES.EDIT_PROFILE : ROUTES.USER_PROFILE,
                { userId: post.authorId },
              )}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                <SafeAvatar
                  avatar={post.author.avatar}
                  size={44}
                  fallbackIcon="person"
                  fallbackColor={topicColor}
                  fallbackBgColor={`${topicColor}15`}
                  borderWidth={2}
                  borderColor={post.author.isVerified ? topicColor : 'transparent'}
                />
                {post.author.onlineStatus === 'online' && (
                  <View style={[styles.onlineDot, { borderColor: isDark ? LL.darkCard : LL.white }]}>
                    <View style={[styles.onlineDotInner, { backgroundColor: LL.success }]} />
                  </View>
                )}
              </View>

              <View style={styles.authorInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.authorName, { color: isDark ? LL.white : LL.gray800 }]} numberOfLines={1}>
                    {post.isAnonymous ? 'Anonymous Parent' : post.author.displayName}
                  </Text>
                  {post.author.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: topicColor }]}>
                      <Ionicons name="checkmark" size={9} color={LL.white} />
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.handleText}>
                    {post.isAnonymous ? '@anonymous' : post.author.handle}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.timeText}>{post.time}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreBtn} onPress={handleLongPress}>
              <View style={[styles.moreBtnInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray50 }]}>
                <Ionicons name="ellipsis-horizontal" size={17} color={LL.gray400} />
              </View>
            </TouchableOpacity>
          </View>

          {post.mood && (
            <View style={{ paddingHorizontal: LL.space.lg, marginBottom: LL.space.sm }}>
              <MoodBadge mood={post.mood} isDark={isDark} />
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
          >
            <Text style={[styles.postText, { color: isDark ? LL.gray300 : LL.gray700 }]} numberOfLines={isExpanded ? undefined : 5}>
              {post.content}
            </Text>
            {post.content.length > 220 && !isExpanded && (
              <TouchableOpacity onPress={() => onExpand(post.id)}>
                <Text style={styles.readMore}>Show more</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {post.poll && (
            <View style={{ paddingHorizontal: LL.space.lg, marginBottom: LL.space.md }}>
              <PollWidget
                poll={post.poll}
                postId={post.id}
                onVote={onVotePoll}
                isDark={isDark}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={() => onNavigate(ROUTES.TOPICS, { topicId: post.topicId })}
            style={[styles.topicTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray50 }]}
          >
            <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.topicTagText, { color: topicColor }]}>
              {post.topic}
            </Text>
            {post.isTrending && (
              <View style={styles.trendingPill}>
                <Ionicons name="trending-up" size={10} color={LL.accent} />
                <Text style={styles.trendingText}>Trending</Text>
              </View>
            )}
          </TouchableOpacity>

          {hasMedia && (
            <View style={styles.mediaBox}>
              {post.images!.length === 1 ? (
                hasVideo ? (
                  <SmartVideoPlayer uri={post.images![0]} isVisible={isVisible} />
                ) : (
                  <TouchableOpacity
                    onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                    activeOpacity={0.95}
                  >
                    <Image
                      source={{ uri: post.images![0] }}
                      style={styles.singleImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )
              ) : (
                <View style={[
                  styles.imageGrid,
                  post.images!.length === 2 && styles.gridTwo,
                  post.images!.length === 3 && styles.gridThree,
                  post.images!.length >= 4 && styles.gridFour,
                ]}>
                  {post.images!.slice(0, 4).map((img, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                      activeOpacity={0.95}
                      style={[
                        styles.gridItem,
                        post.images!.length === 3 && i === 0 && styles.gridItemLarge,
                      ]}
                    >
                      <Image
                        source={{ uri: img }}
                        style={styles.gridImage}
                        resizeMode="cover"
                      />
                      {i === 3 && post.images!.length > 4 && (
                        <View style={styles.gridOverlay}>
                          <Text style={styles.gridOverlayText}>
                            +{post.images!.length - 4}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.engagementBar}>
            <Text style={styles.engagementText}>
              {post.likes > 0 && `${post.likes} like${post.likes > 1 ? 's' : ''}`}
              {post.likes > 0 && post.commentsCount > 0 && ' · '}
              {post.commentsCount > 0 && `${post.commentsCount} comment${post.commentsCount > 1 ? 's' : ''}`}
              {((post.likes > 0 || post.commentsCount > 0) && post.reposts > 0) && ' · '}
              {post.reposts > 0 && `${post.reposts} repost${post.reposts > 1 ? 's' : ''}`}
              {post.viewCount > 0 && ` · ${post.viewCount} views`}
            </Text>
          </View>

          <ReactionBar
            postId={post.id}
            isLiked={post.isLiked}
            likes={post.likes}
            commentsCount={post.commentsCount}
            reposts={post.reposts}
            isReposted={post.isReposted}
            onLike={() => onLike(post.id)}
            onRepost={() => onRepost(post.id)}
            onComment={() => onExpand(isExpanded ? null : post.id)}
            onShare={() => onShare(post)}
          />

          {isExpanded && (
            <View style={[
              styles.commentsBox,
              { borderTopColor: isDark ? LL.darkBorder : LL.gray200 },
            ]}>
              {post.comments.slice(0, 3).map(c => (
                <View key={c.id} style={styles.inlineComment}>
                  <SafeAvatar
                    avatar={c.author.avatar}
                    size={28}
                    fallbackIcon="person"
                    fallbackColor={LL.primary}
                    fallbackBgColor={`${LL.primary}15`}
                  />
                  <View style={styles.inlineCommentContent}>
                    <View style={[
                      styles.inlineCommentBubble,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray50 },
                    ]}>
                      <Text style={[styles.inlineCommentAuthor, { color: isDark ? LL.white : LL.gray800 }]}>
                        {c.author.displayName}
                      </Text>
                      <Text style={[styles.inlineCommentText, { color: isDark ? LL.gray400 : LL.gray600 }]}>
                        {c.content}
                      </Text>
                    </View>
                    <View style={styles.inlineCommentActions}>
                      <TouchableOpacity onPress={() => onLikeComment(post.id, c.id)}>
                        <Text style={[
                          styles.inlineCommentAction,
                          c.isLiked && { color: LL.accent },
                        ]}>
                          {c.isLiked ? 'Liked' : 'Like'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onReply(post.id, c.id)}>
                        <Text style={styles.inlineCommentAction}>Reply</Text>
                      </TouchableOpacity>
                      <Text style={styles.commentTime}>{c.time}</Text>
                    </View>
                  </View>
                </View>
              ))}

              {post.commentsCount > 3 && (
                <TouchableOpacity
                  onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                  style={styles.viewAllComments}
                >
                  <Text style={styles.viewAllCommentsText}>
                    View all {post.commentsCount} comments
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={LL.primary} />
                </TouchableOpacity>
              )}

              <View style={styles.commentInputBox}>
                <SafeAvatar
                  avatar={currentUser?.avatar}
                  size={32}
                  fallbackIcon="person"
                  fallbackColor={LL.primary}
                  fallbackBgColor={`${LL.primary}15`}
                />
                <View style={[
                  styles.commentInputWrap,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray50,
                    borderColor: isDark ? LL.darkBorder : LL.gray200,
                  },
                ]}>
                  <TextInput
                    style={[styles.commentInput, { color: isDark ? LL.white : LL.gray800 }]}
                    placeholder={replyingTo?.postId === post.id ? 'Write a reply...' : 'Add a comment...'}
                    placeholderTextColor={LL.gray400}
                    value={commentInput}
                    onChangeText={t => onCommentChange(post.id, t)}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      !commentInput.trim() && styles.sendBtnDisabled,
                    ]}
                    onPress={() => onCommentSubmit(post.id)}
                    disabled={!commentInput.trim()}
                  >
                    <LinearGradient
                      colors={commentInput.trim() ? [LL.primary, LL.primaryDark] : [LL.gray200, LL.gray200]}
                      style={styles.sendBtnGrad}
                    >
                      <Ionicons name="arrow-up" size={14} color={LL.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  const shimmerOffset = useSharedValue(-SCREEN_W);

  useEffect(() => {
    shimmerOffset.value = withRepeat(
      withTiming(SCREEN_W, { duration: 1800, easing: Easing.ease }),
      -1,
      false
    );
    return () => {
      shimmerOffset.value = shimmerOffset.value;
    };
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerOffset.value }],
  }));

  const shimmerColors = isDark 
    ? ['transparent', 'rgba(255,255,255,0.04)', 'transparent']
    : ['transparent', 'rgba(124,108,241,0.04)', 'transparent'];

  return (
    <View style={[
      styles.postCard,
      {
        backgroundColor: isDark ? LL.darkCard : LL.white,
        borderColor: isDark ? LL.darkBorder : LL.gray200,
        marginBottom: LL.space.lg,
        overflow: 'hidden',
      },
    ]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { zIndex: 10 }]}>
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
        <View style={styles.skeletonTextBlock}>
          <View style={[styles.skeletonLine, { width: '45%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
          <View style={[styles.skeletonLine, { width: '28%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0' }]} />
        </View>
      </View>

      <View style={{ paddingHorizontal: LL.space.lg, gap: LL.space.sm, marginBottom: LL.space.lg }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>

      <View style={[
        styles.skeletonMedia,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f0f2ff', marginHorizontal: LL.space.lg, marginBottom: LL.space.lg }
      ]} />

      <View style={[styles.skeletonActions, { paddingHorizontal: LL.space.lg, paddingBottom: LL.space.md }]}>
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
    </View>
  );
});

// FIXED GlassHeader - uses pointerEvents="box-none" on container so touches pass through to list below
const GlassHeader = React.memo(({
  scrollY,
  currentUser,
  unreadCount,
  onAvatarPress,
  onSearchPress,
  onNotifPress,
  onMessagePress,
  canInteract,
  isDark,
}: {
  scrollY: Animated.SharedValue<number>;
  currentUser: any;
  unreadCount: number;
  onAvatarPress: () => void;
  onSearchPress: () => void;
  onNotifPress: () => void;
  onMessagePress: () => void;
  canInteract: boolean;
  isDark: boolean;
}) => {
  const headerSolid = useSharedValue(0);

  useAnimatedReaction(
    () => scrollY.value,
    (currentY) => {
      const isPastThreshold = currentY > 80;
      headerSolid.value = withTiming(isPastThreshold ? 1 : 0, { duration: 150 });
    },
    []
  );

  const headerBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      headerSolid.value,
      [0, 1],
      [
        isDark ? 'rgba(11,15,31,0.0)' : 'rgba(255,255,255,0.0)',
        isDark ? 'rgba(11,15,31,0.95)' : 'rgba(255,255,255,0.95)'
      ]
    ),
    borderBottomColor: interpolateColor(
      headerSolid.value,
      [0, 1],
      ['transparent', isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0']
    ),
    borderBottomWidth: interpolate(headerSolid.value, [0, 1], [0, 1]),
  }));

  const blurOpacity = useAnimatedStyle(() => ({
    opacity: headerSolid.value,
  }));

  return (
    <Animated.View 
      style={[
        styles.header,
        headerBgStyle,
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, blurOpacity]} pointerEvents="none">
        <BlurView
          intensity={isDark ? 40 : 60}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
      </Animated.View>

      <View style={styles.headerInner} pointerEvents="auto">
        <TouchableOpacity
          onPress={onAvatarPress}
          style={styles.headerAvatarBtn}
          activeOpacity={0.7}
        >
          <View style={styles.avatarRing}>
            <SafeAvatar
              avatar={currentUser?.avatar}
              size={38}
              fallbackIcon="person"
              fallbackColor={LL.primary}
              fallbackBgColor={`${LL.primary}18`}
              borderWidth={0}
            />
            {currentUser?.onlineStatus === 'online' && (
              <View style={styles.headerOnlineIndicator}>
                <View style={styles.headerOnlineDot} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image 
              source={littleLoomLogo} 
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.headerTitle, { color: isDark ? LL.white : LL.gray900 }]}>
              LittleLoom
            </Text>
          </View>
          <LinearGradient
            colors={['#667eea', '#764ba2', '#f093fb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerSubtitleGradient}
          >
            <Text style={styles.headerSubtitleText}>The Loom</Text>
          </LinearGradient>
        </View>

        <View style={styles.headerActions} pointerEvents="auto">
          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isDark ? ['rgba(124,108,241,0.2)', 'rgba(107,92,231,0.15)'] : ['rgba(124,108,241,0.1)', 'rgba(107,92,231,0.05)']}
              style={styles.headerIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="search" size={20} color={isDark ? LL.primaryLight : LL.primaryDark} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNotifPress}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isDark ? ['rgba(124,108,241,0.2)', 'rgba(107,92,231,0.15)'] : ['rgba(124,108,241,0.1)', 'rgba(107,92,231,0.05)']}
              style={styles.headerIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="notifications-outline" size={20} color={isDark ? LL.primaryLight : LL.primaryDark} />
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <LinearGradient
                    colors={[LL.accent, LL.accentSoft]}
                    style={styles.headerBadgeGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.headerBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onMessagePress}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isDark ? ['rgba(124,108,241,0.2)', 'rgba(107,92,231,0.15)'] : ['rgba(124,108,241,0.1)', 'rgba(107,92,231,0.05)']}
              style={styles.headerIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="mail-outline" size={20} color={isDark ? LL.primaryLight : LL.primaryDark} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

const NewPostsBanner = React.memo(({ count, onPress }: { count: number; onPress: () => void }) => (
  <Animated.View
    entering={SlideInDown.duration(350).springify()}
    exiting={SlideOutUp.duration(200)}
    style={styles.bannerWrap}
  >
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={[LL.primary, LL.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bannerGradient}
      >
        <View style={styles.bannerIconWrap}>
          <Ionicons name="arrow-up" size={13} color={LL.white} />
        </View>
        <Text style={styles.bannerText}>
          {count} new thread{count > 1 ? 's' : ''} woven
        </Text>
        <View style={styles.bannerPulse} />
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
));

const TopicChip = React.memo(({
  topic,
  isActive,
  onPress,
  index,
}: {
  topic: any;
  isActive: boolean;
  onPress: () => void;
  index: number;
}) => {
  const scale = useSharedValue(1);

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.92, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 400 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300)}
      layout={Layout.springify()}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.chipWrap}
      >
        <Animated.View style={[
          styles.chip,
          isActive && {
            backgroundColor: `${topic.color}15`,
            borderColor: `${topic.color}50`,
            shadowColor: topic.color,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 3,
          },
          chipStyle,
        ]}>
          <Text style={styles.chipEmoji}>{topic.emoji}</Text>
          <Text style={[
            styles.chipLabel,
            isActive && { color: topic.color, fontWeight: '800' },
          ]}>
            {topic.name}
          </Text>
          {isActive && (
            <View style={[styles.chipDot, { backgroundColor: topic.color }]} />
          )}
          {topic.trending && !isActive && (
            <View style={[styles.trendingDot, { backgroundColor: LL.accent }]} />
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

const NotificationChooserModal = ({ visible, onClose, onSelect, isDark, unreadCount }: { visible: boolean; onClose: () => void; onSelect: (type: 'app' | 'community') => void; isDark: boolean; unreadCount: number }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 20 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10001 }]} pointerEvents="auto">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }, backdropStyle]}>
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.centeredModal, modalStyle, { backgroundColor: isDark ? '#1a1a2e' : '#fff', top: SCREEN_H * 0.2 }]}>
        <View style={styles.centeredModalHeader}>
          <View>
            <Text style={[styles.centeredModalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Notifications</Text>
            <Text style={styles.centeredModalSubtitle}>Choose notification type</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.centeredModalClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={[styles.notificationOption, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,116,139,0.05)' }]}
            onPress={() => { onSelect('app'); onClose(); }}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.notificationIcon}>
              <Ionicons name="notifications" size={18} color="#fff" />
            </LinearGradient>
            <View style={styles.notificationTextContainer}>
              <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>App Notifications</Text>
              <Text style={styles.notificationOptionSubtitle}>Reminders & alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.notificationOption, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,116,139,0.05)' }]}
            onPress={() => { onSelect('community'); onClose(); }}
          >
            <LinearGradient colors={['#ec4899', '#f472b6']} style={styles.notificationIcon}>
              <Ionicons name="people" size={18} color="#fff" />
            </LinearGradient>
            <View style={styles.notificationTextContainer}>
              <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Community</Text>
              <Text style={styles.notificationOptionSubtitle}>Likes, mentions & threads</Text>
            </View>
            <View style={styles.badgeContainer}>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="#64748b" />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const SearchResults = React.memo(({
  query,
  posts,
  topics,
  users,
  onSelectPost,
  onSelectTopic,
  onSelectUser,
  isDark,
}: {
  query: string;
  posts: Post[];
  topics: any[];
  users: any[];
  onSelectPost: (post: Post) => void;
  onSelectTopic: (topic: any) => void;
  onSelectUser: (user: any) => void;
  isDark: boolean;
}) => {
  const lowerQuery = query.toLowerCase().trim();

  const filteredPosts = useMemo(() => 
    lowerQuery ? posts.filter(p => 
      p.content.toLowerCase().includes(lowerQuery) ||
      p.topic.toLowerCase().includes(lowerQuery) ||
      p.author.displayName.toLowerCase().includes(lowerQuery)
    ).slice(0, 5) : [],
    [posts, lowerQuery]
  );

  const filteredTopics = useMemo(() => 
    lowerQuery ? topics.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery)
    ).slice(0, 5) : [],
    [topics, lowerQuery]
  );

  const filteredUsers = useMemo(() => 
    lowerQuery ? users.filter(u => 
      u.displayName?.toLowerCase().includes(lowerQuery) ||
      u.handle?.toLowerCase().includes(lowerQuery)
    ).slice(0, 5) : [],
    [users, lowerQuery]
  );

  if (!lowerQuery) return null;
  if (filteredPosts.length === 0 && filteredTopics.length === 0 && filteredUsers.length === 0) {
    return (
      <View style={[styles.searchResultsContainer, { backgroundColor: isDark ? LL.darkSurface : LL.white }]}>
        <Text style={[styles.searchNoResults, { color: isDark ? LL.gray400 : LL.gray500 }]}>
          No results for "{query}"
        </Text>
        <Text style={[styles.searchHint, { color: isDark ? LL.gray500 : LL.gray400 }]}>
          Try searching for posts, topics, or usernames
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.searchResultsContainer, { backgroundColor: isDark ? LL.darkSurface : LL.white }]}>
      {filteredPosts.length > 0 && (
        <View style={styles.searchSection}>
          <Text style={[styles.searchSectionTitle, { color: isDark ? LL.gray400 : LL.gray500 }]}>Posts</Text>
          {filteredPosts.map(post => (
            <TouchableOpacity
              key={post.id}
              style={styles.searchResultItem}
              onPress={() => onSelectPost(post)}
            >
              <Ionicons name="document-text-outline" size={18} color={LL.primary} />
              <View style={styles.searchResultContent}>
                <Text style={[styles.searchResultText, { color: isDark ? LL.white : LL.gray800 }]} numberOfLines={1}>
                  {post.content}
                </Text>
                <Text style={[styles.searchResultMeta, { color: isDark ? LL.gray500 : LL.gray400 }]}>
                  by {post.author.displayName} · {post.topic}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filteredTopics.length > 0 && (
        <View style={styles.searchSection}>
          <Text style={[styles.searchSectionTitle, { color: isDark ? LL.gray400 : LL.gray500 }]}>Topics</Text>
          {filteredTopics.map(topic => (
            <TouchableOpacity
              key={topic.id}
              style={styles.searchResultItem}
              onPress={() => onSelectTopic(topic)}
            >
              <Text style={styles.searchResultEmoji}>{topic.emoji}</Text>
              <View style={styles.searchResultContent}>
                <Text style={[styles.searchResultText, { color: isDark ? LL.white : LL.gray800 }]}>{topic.name}</Text>
                <Text style={[styles.searchResultMeta, { color: isDark ? LL.gray500 : LL.gray400 }]}>
                  {topic.members?.toLocaleString()} members
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filteredUsers.length > 0 && (
        <View style={styles.searchSection}>
          <Text style={[styles.searchSectionTitle, { color: isDark ? LL.gray400 : LL.gray500 }]}>Parents</Text>
          {filteredUsers.map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.searchResultItem}
              onPress={() => onSelectUser(user)}
            >
              <SafeAvatar
                avatar={user.avatar}
                size={32}
                fallbackIcon="person"
                fallbackColor={LL.primary}
                fallbackBgColor={`${LL.primary}15`}
              />
              <View style={styles.searchResultContent}>
                <Text style={[styles.searchResultText, { color: isDark ? LL.white : LL.gray800 }]}>{user.displayName}</Text>
                <Text style={[styles.searchResultMeta, { color: isDark ? LL.gray500 : LL.gray400 }]}>{user.handle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

export default function CommunityScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  useAutoHideNav({ isCommunityScreen: true });

  const {
    posts, topics, currentUser, likePost, unlikePost, repostPost, unrepostPost,
    bookmarkPost, deletePost, addComment, likeComment, replyToComment, voteHelpful,
    followUser, unfollowUser, isFollowing, refreshFeed, loadMorePosts, getFeedPosts,
    getUnreadCount, checkOnboardingStatus, incrementViewCount, isAuthenticated: checkIsAuth,
    syncUserProfileAcrossPosts, getAllUsers, votePoll,
  } = useCommunity();

  const { profile, communityProfile } = useUser();
  const { isAuthenticated: authIsAuth } = useAuth();
  const { triggerHaptic } = useCustomization();
  const { isDark } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [moments, setMoments] = useState<StoryItem[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryItem | null>(null);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [userStories, setUserStories] = useState<StoryItem[]>([]);
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);

  const [activeWeavers, setActiveWeavers] = useState(24);

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);

  const dailyPrompt = useMemo(() => ({
    question: "What's a small win you had with your little one this week?",
    emoji: '🌟',
    color: LL.warning,
  }), []);

  const momentsData = useMemo(() => {
    const generated: StoryItem[] = [
      {
        id: 'self',
        userId: currentUser?.id || 'self',
        userName: 'Your Story',
        userAvatar: currentUser?.avatar,
        isUser: true,
        hasStory: userStories.length > 0,
        isViewed: false,
        content: '',
        timestamp: new Date().toISOString(),
      },
      MOCK_LITTLELOOM_STORY,
      ...posts.slice(0, 10).map((p) => ({
        id: `story-${p.id}`,
        userId: p.authorId,
        userName: p.isAnonymous ? 'Anonymous' : p.author.displayName,
        userAvatar: p.isAnonymous ? undefined : p.author.avatar,
        isUser: false,
        hasStory: true,
        isViewed: false,
        content: p.content.substring(0, 100),
        mediaUri: p.images?.[0],
        mediaType: 'image' as const,
        timestamp: p.timestamp,
      })),
    ];
    return generated;
  }, [posts.length, currentUser?.id, currentUser?.avatar, userStories.length]);

  useEffect(() => {
    setMoments(momentsData);
  }, [momentsData]);

  const topicChipsData = useMemo(() => 
    [{ id: 'all', name: 'All', emoji: '🔥', color: LL.primary, trending: false }, ...topics.slice(0, 12)],
    [topics]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWeavers(prev => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(8, prev + change);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

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
        });
      }
    }
  }, [communityProfile, currentUser?.id]);

  useEffect(() => {
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
    setPage(1);
  }, [posts, activeTopic, searchQuery]);

  useEffect(() => {
    if (prevPostsRef.current.length > 0 && posts.length > prevPostsRef.current.length) {
      const count = posts.length - prevPostsRef.current.length;
      setNewPostsCount(count);
      setShowBanner(true);
    }
    prevPostsRef.current = posts;
  }, [posts]);

  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
    if (activeTopic !== 'all') filtered = filtered.filter(p => p.topicId === activeTopic);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [posts, activeTopic, searchQuery, getFeedPosts]);

  const handleScrollToNew = useCallback(() => {
    setShowBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

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

  const handleViewStory = useCallback((story: StoryItem) => {
    setSelectedStory(story);
    setShowStoryViewer(true);
    setMoments(prev => prev.map(m => 
      m.id === story.id ? { ...m, isViewed: true } : m
    ));
  }, []);

  const handleAddStory = useCallback(() => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to share a story', 'warning');
      return;
    }

showAlert(
      'Add to Your Story',
      'How would you like to share?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Text Story', 
          onPress: () => {
            const newStory: StoryItem = {
              id: `story_${Date.now()}`,
              userId: currentUser?.id || 'self',
              userName: 'You',
              userAvatar: currentUser?.avatar,
              isUser: true,
              hasStory: true,
              isViewed: false,
              content: 'Just shared a new moment! 🌟',
              timestamp: new Date().toISOString(),
            };
            setUserStories(prev => [newStory, ...prev]);
            setMoments(prev => prev.map(m => 
              m.isUser ? { ...m, hasStory: true } : m
            ));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
        { 
          text: 'Take Photo', 
          onPress: () => {
            const newStory: StoryItem = {
              id: `story_${Date.now()}`,
              userId: currentUser?.id || 'self',
              userName: 'You',
              userAvatar: currentUser?.avatar,
              isUser: true,
              hasStory: true,
              isViewed: false,
              content: 'New photo story! 📸',
              mediaUri: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&q=80',
              mediaType: 'image',
              timestamp: new Date().toISOString(),
            };
            setUserStories(prev => [newStory, ...prev]);
            setMoments(prev => prev.map(m => 
              m.isUser ? { ...m, hasStory: true } : m
            ));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      ]
    );
  }, [canInteract, currentUser?.id, currentUser?.avatar, sweetAlert]);

  const handleStoryReply = useCallback((storyId: string, content: string) => {
    console.log('Story reply:', storyId, content);
  }, []);

  const handleStoryShare = useCallback((story: StoryItem) => {
    Share.share({
      message: `${story.userName}'s story on LittleLoom: ${story.content}`,
    });
  }, []);

  const handleStoryReact = useCallback((storyId: string, reaction: string) => {
    console.log('Story reaction:', storyId, reaction);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSearchSelectPost = useCallback((post: Post) => {
    setShowSearch(false);
    setSearchQuery('');
    navigation.navigate(ROUTES.POST_DETAIL, { postId: post.id });
  }, [navigation]);

  const handleSearchSelectTopic = useCallback((topic: any) => {
    setShowSearch(false);
    setSearchQuery('');
    setActiveTopic(topic.id);
  }, []);

  const handleSearchSelectUser = useCallback((user: any) => {
    setShowSearch(false);
    setSearchQuery('');
    if (user.id === currentUser?.id) {
      navigation.navigate(ROUTES.EDIT_PROFILE);
    } else {
      navigation.navigate(ROUTES.USER_PROFILE, { userId: user.id });
    }
  }, [currentUser?.id, navigation]);

  const handleLike = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to like threads', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(postId) : await likePost(postId);
  }, [canInteract, posts, triggerHaptic, unlikePost, likePost, sweetAlert]);

  const handleRepost = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reweave', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(postId) : await repostPost(postId);
  }, [canInteract, posts, triggerHaptic, unrepostPost, repostPost, sweetAlert]);

  const handleBookmark = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to bookmark', 'warning');
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  }, [canInteract, triggerHaptic, bookmarkPost, sweetAlert]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
    } catch (e) { console.error(e); }
  }, []);

  const handleDelete = useCallback((postId: string) => {

showAlert('Unravel this thread?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  }, [deletePost]);

  const handleCommentSubmit = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reply', 'warning');
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
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  }, [canInteract, commentInputs, replyingTo, triggerHaptic, replyToComment, addComment, sweetAlert]);

  const handleFollowToggle = useCallback(async (userId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to follow', 'warning');
      return;
    }
    isFollowing(userId) ? await unfollowUser(userId) : await followUser(userId);
  }, [canInteract, isFollowing, unfollowUser, followUser, sweetAlert]);

  const handleVotePoll = useCallback(async (postId: string, optionId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to vote', 'warning');
      return;
    }
    await votePoll(postId, optionId);
  }, [canInteract, votePoll, sweetAlert]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(v => (v.item as Post).id));
    setVisiblePostIds(visibleIds);
    viewableItems.forEach(v => incrementViewCount((v.item as Post).id));
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45 }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {'worklet';
      
'worklet';
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  }, []);

  const renderTopicChip = useCallback(({ item, index }: { item: any; index: number }) => (
    <TopicChip
      topic={item}
      isActive={activeTopic === item.id}
      onPress={() => setActiveTopic(activeTopic === item.id ? 'all' : item.id)}
      index={index}
    />
  ), [activeTopic]);

  const renderPost = useCallback(({ item, index }: { item: Post; index: number }) => (
    <PostCard
      post={item}
      index={index}
      isVisible={visiblePostIds.has(item.id)}
      onNavigate={(screen, params) => navigation.navigate(screen as any, params)}
      onLike={handleLike}
      onRepost={handleRepost}
      onBookmark={handleBookmark}
      onShare={handleShare}
      onDelete={handleDelete}
      onFollowToggle={handleFollowToggle}
      onVoteHelpful={voteHelpful}
      onExpand={setExpandedPostId}
      isExpanded={expandedPostId === item.id}
      commentInput={commentInputs[item.id] || ''}
      onCommentChange={(pid, text) => setCommentInputs(prev => ({ ...prev, [pid]: text }))}
      onCommentSubmit={handleCommentSubmit}
      replyingTo={replyingTo}
      onCancelReply={() => setReplyingTo(null)}
      onReply={(pid, cid) => setReplyingTo({ postId: pid, commentId: cid })}
      onLikeComment={likeComment}
      onVotePoll={handleVotePoll}
      topics={topics}
      currentUser={currentUser}
      canInteract={canInteract}
      isDark={isDark}
    />
  ), [visiblePostIds, expandedPostId, commentInputs, replyingTo, topics, currentUser, canInteract, isDark, handleLike, handleRepost, handleBookmark, handleShare, handleDelete, handleFollowToggle, handleCommentSubmit, likeComment, voteHelpful, handleVotePoll, navigation]);

  const handlePromptRespond = useCallback(() => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to respond', 'warning');
      return;
    }
    navigation.navigate(ROUTES.CREATE_POST as any, { prompt: dailyPrompt.question });
  }, [canInteract, dailyPrompt.question, navigation, sweetAlert]);

  const renderHeader = useCallback(() => (
    <View>
      {showSearch && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.searchBox,
            { backgroundColor: isDark ? LL.darkSurface : LL.white },
          ]}
        >
          <View style={[
            styles.searchInner,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 },
          ]}>
            <Ionicons name="search" size={18} color={LL.gray400} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? LL.white : LL.gray900 }]}
              placeholder="Search threads, topics, parents..."
              placeholderTextColor={LL.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={LL.gray400} />
              </TouchableOpacity>
            )}
          </View>

          <SearchResults
            query={searchQuery}
            posts={posts}
            topics={topics}
            users={allUsers}
            onSelectPost={handleSearchSelectPost}
            onSelectTopic={handleSearchSelectTopic}
            onSelectUser={handleSearchSelectUser}
            isDark={isDark}
          />
        </Animated.View>
      )}

      <MomentsBar
        moments={moments}
        onAddMoment={handleAddStory}
        onViewMoment={handleViewStory}
        isDark={isDark}
      />

      <CommunityPulse count={activeWeavers} isDark={isDark} />

      <DailyWeavePrompt
        prompt={dailyPrompt}
        onRespond={handlePromptRespond}
        isDark={isDark}
      />

      <View style={[
        styles.chipsContainer,
        { backgroundColor: isDark ? LL.darkSurface : LL.white },
      ]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={topicChipsData}
          keyExtractor={t => t.id}
          renderItem={renderTopicChip}
          contentContainerStyle={styles.chipsList}
        />
      </View>

      {activeTopic !== 'all' && (
        <Animated.View entering={FadeIn} style={[
          styles.filterBar,
          { backgroundColor: isDark ? LL.darkSurface : LL.white },
        ]}>
          <View style={[
            styles.filterInner,
            { backgroundColor: isDark ? 'rgba(124,108,241,0.15)' : `${LL.primary}10` },
          ]}>
            <Ionicons name="filter" size={12} color={LL.primary} />
            <Text style={styles.filterText}>
              {topics.find(t => t.id === activeTopic)?.name}
            </Text>
            <TouchableOpacity onPress={() => setActiveTopic('all')}>
              <Ionicons name="close-circle" size={16} color={LL.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  ), [
    showSearch, isDark, searchQuery, posts, topics, allUsers,
    moments, activeWeavers, dailyPrompt, activeTopic,
    handleSearchSelectPost, handleSearchSelectTopic, handleSearchSelectUser,
    handleAddStory, handleViewStory, handlePromptRespond, renderTopicChip, topicChipsData
  ]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 120 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={LL.primary} />
        <Text style={[styles.footerLoaderText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
          Weaving more threads...
        </Text>
      </View>
    );
  }, [loadingMore, isDark]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={isDark ? [`${LL.primary}20`, `${LL.primaryDark}20`] : [`${LL.primary}15`, `${LL.primaryDark}15`]}
        style={styles.emptyIconBg}
      >
        <Ionicons name="chatbubbles-outline" size={40} color={LL.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray600 }]}>
        {searchQuery ? 'No threads found' : 'The Loom is quiet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? LL.gray400 : LL.gray400 }]}>
        {searchQuery
          ? 'Try different words or browse by topic'
          : 'Be the first to weave a story into the community!'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => canInteract
            ? navigation.navigate(ROUTES.CREATE_POST as any)
            : sweetAlert.alert('Sign In Required', 'Please sign in to start a thread', 'warning')}
        >
          <LinearGradient
            colors={[LL.primary, LL.primaryDark]}
            style={styles.emptyBtnGrad}
          >
            <Text style={styles.emptyBtnText}>Start a Thread</Text>
            <Ionicons name="arrow-forward" size={14} color={LL.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, searchQuery, canInteract, navigation, sweetAlert]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[
        styles.container,
        { backgroundColor: isDark ? LL.darkBg : LL.gray50 },
      ]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />

        <StoryViewer
          visible={showStoryViewer}
          story={selectedStory}
          onClose={() => {
            setShowStoryViewer(false);
            setSelectedStory(null);
          }}
          onReply={handleStoryReply}
          onShare={handleStoryShare}
          onReact={handleStoryReact}
          currentUser={currentUser}
          isDark={isDark}
        />

        <GlassHeader
          scrollY={scrollY}
          currentUser={currentUser}
          unreadCount={unreadCount}
          onAvatarPress={() => canInteract
            ? navigation.navigate(ROUTES.EDIT_PROFILE as any)
            : sweetAlert.alert('Sign In Required', 'Please sign in to access your profile', 'warning')}
          onSearchPress={() => setShowSearch(s => !s)}
          onNotifPress={() => {
            if (!canInteract) {
              sweetAlert.alert('Sign In Required', 'Please sign in to view notifications', 'warning');
              return;
            }
            setShowNotificationChooser(true);
          }}
          onMessagePress={() => canInteract
            ? navigation.navigate(ROUTES.MESSAGES as any)
            : sweetAlert.alert('Sign In Required', 'Please sign in to access messages', 'warning')}
          canInteract={canInteract}
          isDark={isDark}
        />

        <NotificationChooserModal
          visible={showNotificationChooser}
          onClose={() => setShowNotificationChooser(false)}
          onSelect={(type) => {
            if (type === 'app') {
              // Navigate to TrackerReminders for app notifications
              navigation.navigate(ROUTES.TRACKER_REMINDERS as any);
            } else {
              navigation.navigate(ROUTES.NOTIFICATIONS as any, { filter: 'community' });
            }
          }}
          isDark={isDark}
          unreadCount={unreadCount}
        />

        {showBanner && (
          <NewPostsBanner count={newPostsCount} onPress={handleScrollToNew} />
        )}

        {isLoading ? (
          <View style={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}>
            {[1, 2, 3].map(i => (
              <PostSkeleton key={i} isDark={isDark} />
            ))}
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef as any}
            data={displayedPosts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: HEADER_TOTAL_HEIGHT + 10 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={LL.primary}
                colors={[LL.primary]}
                progressBackgroundColor={isDark ? LL.darkSurface : LL.white}
                progressViewOffset={Platform.OS === 'ios' ? HEADER_TOTAL_HEIGHT : HEADER_TOTAL_HEIGHT - 20}
              />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={renderEmpty}
          />
        )}

        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.fabWrap}
        >
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (!canInteract) {
                sweetAlert.alert('Sign In Required', 'Please sign in to weave a thread', 'warning');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST as any);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[LL.primary, LL.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGrad}
            >
              <Ionicons name="add" size={28} color={LL.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 100 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: LL.space.md,
    minHeight: HEADER_TOTAL_HEIGHT,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LL.space.lg,
    height: 44,
  },
  headerAvatarBtn: {
    width: 42,
    height: 42,
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: `${LL.primary}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LL.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LL.white,
  },
  headerOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LL.success,
  },
  headerTitleWrap: { alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: LL.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  headerSubtitleGradient: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: LL.radius.full,
    marginTop: 2,
  },
  headerSubtitleText: {
    fontSize: 10,
    fontWeight: '700',
    color: LL.white,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  headerIconGrad: {
    width: '100%',
    height: '100%',
    borderRadius: LL.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${LL.primary}20`,
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LL.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LL.white,
    zIndex: 10,
  },
  headerBadgeGrad: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: LL.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },

  momentsContainer: {
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
  },
  momentsList: {
    paddingHorizontal: LL.space.lg,
    gap: LL.space.lg,
  },
  momentPressable: { alignItems: 'center', gap: LL.space.xs },
  momentRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  momentAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: LL.radius.full,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: LL.white,
  },
  momentAddGrad: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyUnreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LL.accent,
    borderWidth: 2,
    borderColor: LL.white,
  },
  momentName: {
    fontSize: LL.text.xs.size,
    fontWeight: '500',
    maxWidth: 68,
    textAlign: 'center',
  },

  storyModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  storyMedia: {
    width: '100%',
    height: '100%',
  },
  storyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  storyProgressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: LL.space.lg,
    zIndex: 10,
  },
  storyProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  storyProgressFill: {
    height: '100%',
    backgroundColor: LL.white,
    borderRadius: 2,
  },
  storyHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LL.space.lg,
    zIndex: 10,
  },
  storyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
  },
  storyHeaderInfo: {},
  storyHeaderName: {
    color: LL.white,
    fontSize: LL.text.base.size,
    fontWeight: '700',
  },
  storyHeaderTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: LL.text.xs.size,
  },
  storyCloseBtn: {
    padding: LL.space.sm,
  },
  storyContent: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    paddingHorizontal: LL.space.lg,
    zIndex: 10,
  },
  storyText: {
    color: LL.white,
    fontSize: LL.text.lg.size,
    fontWeight: '600',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  storyReactions: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: LL.space.lg,
    zIndex: 10,
  },
  storyReactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyReactionEmoji: {
    fontSize: 22,
  },
  storyReplies: {
    position: 'absolute',
    bottom: 130,
    left: LL.space.lg,
    right: LL.space.lg,
    maxHeight: 120,
    zIndex: 10,
  },
  storyReplyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LL.space.sm,
    marginBottom: LL.space.sm,
  },
  storyReplyBubble: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: LL.radius.lg,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
  },
  storyReplyName: {
    color: LL.white,
    fontSize: LL.text.xs.size,
    fontWeight: '700',
    marginBottom: 2,
  },
  storyReplyText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: LL.text.sm.size,
  },
  storyBottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: LL.space.lg,
    zIndex: 10,
  },
  storyBottomActions: {
    flexDirection: 'row',
    gap: LL.space.md,
  },
  storyReplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LL.space.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: LL.radius.full,
    paddingVertical: LL.space.md,
  },
  storyReplyBtnText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  storyShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LL.space.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: LL.radius.full,
    paddingVertical: LL.space.md,
  },
  storyShareBtnText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  storyReplyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  storyReplyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    color: LL.white,
    fontSize: LL.text.base.size,
  },
  storyReplySend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LL.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 5,
  },

  pulseWrap: {
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    borderBottomWidth: 1,
  },
  pulseInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  pulseDotWrap: {
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LL.success,
  },
  pulseRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LL.success,
  },
  pulseText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },

  promptWrap: {
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
    borderBottomColor: LL.gray200,
  },
  promptCard: {
    borderRadius: LL.radius['2xl'],
    padding: LL.space.lg,
    borderWidth: 1,
    ...LL.shadow.sm,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
    marginBottom: LL.space.md,
  },
  promptIconBg: {
    width: 44,
    height: 44,
    borderRadius: LL.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptEmoji: { fontSize: 20 },
  promptMeta: { flex: 1 },
  promptLabel: {
    fontSize: LL.text.xs.size,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  promptQuestion: {
    fontSize: LL.text.base.size,
    fontWeight: '700',
    lineHeight: 22,
  },
  promptBtn: {
    borderRadius: LL.radius.full,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  promptBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
  },
  promptBtnText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },

  searchBox: {
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
    borderBottomColor: LL.gray200,
    zIndex: 50,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    gap: LL.space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: LL.text.base.size,
    paddingVertical: 2,
  },

  searchResultsContainer: {
    marginTop: LL.space.md,
    borderRadius: LL.radius.lg,
    borderWidth: 1,
    borderColor: LL.gray200,
    overflow: 'hidden',
    maxHeight: 400,
  },
  searchSection: {
    borderBottomWidth: 1,
    borderBottomColor: LL.gray200,
    paddingVertical: LL.space.sm,
  },
  searchSectionTitle: {
    fontSize: LL.text.xs.size,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  searchResultMeta: {
    fontSize: LL.text.xs.size,
    marginTop: 2,
  },
  searchResultEmoji: {
    fontSize: 20,
  },
  searchNoResults: {
    fontSize: LL.text.base.size,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: LL.space.xl,
  },
  searchHint: {
    fontSize: LL.text.sm.size,
    textAlign: 'center',
    paddingBottom: LL.space.xl,
  },

  chipsContainer: {
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
    borderBottomColor: LL.gray200,
  },
  chipsList: {
    paddingHorizontal: LL.space.lg,
    gap: LL.space.md,
  },
  chipWrap: { marginRight: LL.space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.full,
    borderWidth: 1,
    borderColor: LL.gray200,
    backgroundColor: LL.gray50,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
    color: LL.gray600,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },

  filterBar: {
    paddingHorizontal: LL.space.lg,
    paddingBottom: LL.space.sm,
  },
  filterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
    borderRadius: LL.radius.md,
    alignSelf: 'flex-start',
  },
  filterText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
    color: LL.primary,
  },

  bannerWrap: {
    position: 'absolute',
    top: HEADER_TOTAL_HEIGHT + 8,
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.full,
    ...LL.shadow.md,
  },
  bannerIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },
  bannerPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LL.white,
    opacity: 0.5,
  },

  postCardWrap: {
    paddingHorizontal: LL.space.lg,
    marginBottom: LL.space.lg,
  },
  postCard: {
    borderRadius: LL.radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    ...LL.shadow.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: LL.space.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: { position: 'relative' },
  authorInfo: {
    marginLeft: LL.space.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
  },
  authorName: {
    fontSize: LL.text.base.size,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
    marginTop: 2,
  },
  handleText: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
    fontWeight: '500',
  },
  dot: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
    marginHorizontal: 4,
  },
  timeText: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
    fontWeight: '500',
  },
  moreBtn: {
    padding: LL.space.sm,
    marginLeft: LL.space.sm,
  },
  moreBtnInner: {
    width: 32,
    height: 32,
    borderRadius: LL.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  postText: {
    fontSize: LL.text.base.size,
    lineHeight: 24,
    paddingHorizontal: LL.space.lg,
    marginBottom: LL.space.md,
  },
  readMore: {
    fontSize: LL.text.sm.size,
    color: LL.primary,
    fontWeight: '700',
    paddingHorizontal: LL.space.lg,
    marginTop: -LL.space.sm,
    marginBottom: LL.space.md,
  },

  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: LL.space.lg,
    marginBottom: LL.space.md,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
    borderRadius: LL.radius.full,
    gap: LL.space.sm,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicTagText: {
    fontSize: LL.text.xs.size,
    fontWeight: '700',
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${LL.accent}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: LL.radius.full,
  },
  trendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: LL.accent,
  },

  mediaBox: {
    marginHorizontal: LL.space.lg,
    marginBottom: LL.space.md,
    borderRadius: LL.radius.lg,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: 280,
    borderRadius: LL.radius.lg,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: LL.radius.lg,
    overflow: 'hidden',
  },
  gridTwo: {
    flexDirection: 'row',
  },
  gridThree: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridFour: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: LL.radius.md,
    overflow: 'hidden',
  },
  gridItemLarge: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlayText: {
    color: LL.white,
    fontSize: 24,
    fontWeight: '800',
  },

  videoBox: {
    width: '100%',
    height: 280,
    borderRadius: LL.radius.lg,
    overflow: 'hidden',
    backgroundColor: LL.gray900,
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoPausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  engagementBar: {
    paddingHorizontal: LL.space.lg,
    paddingBottom: LL.space.sm,
  },
  engagementText: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
    fontWeight: '500',
  },

  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderTopWidth: 1,
    borderTopColor: LL.gray200,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingVertical: LL.space.sm,
  },
  reactionCount: {
    fontSize: LL.text.sm.size,
    color: LL.gray400,
    fontWeight: '600',
  },

  commentsBox: {
    borderTopWidth: 1,
    padding: LL.space.lg,
  },
  inlineComment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LL.space.sm,
    marginBottom: LL.space.md,
  },
  inlineCommentContent: {
    flex: 1,
  },
  inlineCommentBubble: {
    borderRadius: LL.radius.lg,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
  },
  inlineCommentAuthor: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
    marginBottom: 2,
  },
  inlineCommentText: {
    fontSize: LL.text.sm.size,
    lineHeight: 20,
  },
  inlineCommentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.md,
    marginTop: LL.space.xs,
    paddingLeft: LL.space.sm,
  },
  inlineCommentAction: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: LL.text.xs.size,
    color: LL.gray400,
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
    marginBottom: LL.space.md,
  },
  viewAllCommentsText: {
    fontSize: LL.text.sm.size,
    color: LL.primary,
    fontWeight: '700',
  },
  commentInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    borderWidth: 1,
    paddingHorizontal: LL.space.md,
    paddingVertical: 2,
  },
  commentInput: {
    flex: 1,
    fontSize: LL.text.sm.size,
    paddingVertical: LL.space.md,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.xs,
    paddingHorizontal: LL.space.md,
    paddingVertical: 4,
    borderRadius: LL.radius.full,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: LL.text.xs.size,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  pollWrap: {
    borderRadius: LL.radius.lg,
    padding: LL.space.md,
  },
  pollQuestion: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
    marginBottom: LL.space.md,
  },
  pollOption: {
    marginBottom: LL.space.sm,
  },
  pollTrack: {
    height: 40,
    borderRadius: LL.radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: LL.radius.md,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LL.space.md,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  pollPercent: {
    fontSize: LL.text.sm.size,
    fontWeight: '800',
  },
  pollMeta: {
    fontSize: LL.text.xs.size,
    marginTop: LL.space.sm,
  },

  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: LL.space.lg,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonTextBlock: {
    marginLeft: LL.space.md,
    gap: LL.space.sm,
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: LL.radius.sm,
  },
  skeletonMedia: {
    height: 200,
    borderRadius: LL.radius.lg,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: LL.space.lg,
  },
  skeletonActionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: LL.space['2xl'],
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: LL.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LL.space.lg,
  },
  emptyTitle: {
    fontSize: LL.text.xl.size,
    fontWeight: '800',
    marginBottom: LL.space.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: LL.text.base.size,
    textAlign: 'center',
    marginBottom: LL.space.xl,
    lineHeight: 22,
  },
  emptyBtn: {
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
  },
  emptyBtnText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },

  fabWrap: {
    position: 'absolute',
    bottom: 30,
    right: LL.space.lg,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...LL.shadow.lg,
  },
  fabGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LL.space.sm,
    paddingVertical: LL.space.xl,
  },
  footerLoaderText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },

  centeredModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxHeight: SCREEN_H * 0.7,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  centeredModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  centeredModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  centeredModalClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  notificationOptionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LL.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  onlineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});