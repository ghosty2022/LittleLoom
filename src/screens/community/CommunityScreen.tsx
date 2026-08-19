// src/screens/community/CommunityScreen.tsx
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOut,
  interpolate,
  interpolateColor,
  Layout,
  runOnJS,
  SlideInDown,
  SlideOutUp,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CommunityColors,
} from '../../theme/CommunityTheme';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, PostMood, Poll, CommunityUser } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { VideoView, useVideoPlayer } from 'expo-video';

const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

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
  
  mood: {
    celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline', glow: '#fbbf24' },
    support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline', glow: '#f472b6' },
    advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline', glow: '#818cf8' },
    milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline', glow: '#34d399' },
    venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline', glow: '#f87171' },
  },
  
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
  darkElevated: '#44403c',
  darkBorder: 'rgba(255,255,255,0.06)',
  
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '500' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 17, line: 24, weight: '600' as const },
    xl: { size: 20, line: 28, weight: '700' as const },
    '2xl': { size: 26, line: 34, weight: '800' as const },
  },
  
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
    glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
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
  REPORT: 'Report',
  FOLLOWERS: 'Followers',
  FOLLOWING: 'Following',
  SEARCH_USERS: 'SearchUsers',
} as const;

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

// ─── Interactive Hero Banner ───
const InteractiveHeroBanner = React.memo(({ 
  isDark, 
  onExploreTopics, 
  onStartPost,
  postsCount,
  membersCount,
}: {
  isDark: boolean;
  onExploreTopics: () => void;
  onStartPost: () => void;
  postsCount: number;
  membersCount: number;
}) => {
  const pulseAnim = useSharedValue(1);
  
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(100).duration(600).springify()}
      style={[styles.heroBanner, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
    >
      <LinearGradient
        colors={isDark ? 
          ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)'] : 
          ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.heroContent}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={[styles.heroTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              The Loom
            </Text>
            <Text style={[styles.heroSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Weave stories, share wisdom, grow together.
            </Text>
          </View>
          <Animated.View style={[styles.heroStats, pulseStyle]}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: DS.primary }]}>{postsCount}</Text>
              <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Posts</Text>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: DS.accent }]}>{membersCount}</Text>
              <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Members</Text>
            </View>
          </Animated.View>
        </View>
        
        <View style={styles.heroActions}>
          <TouchableOpacity 
            style={[styles.heroActionBtn, { backgroundColor: DS.primary }]}
            onPress={onStartPost}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={DS.white} />
            <Text style={styles.heroActionText}>Start Thread</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.heroActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
            onPress={onExploreTopics}
            activeOpacity={0.8}
          >
            <Ionicons name="compass-outline" size={16} color={isDark ? DS.gray300 : DS.gray600} />
            <Text style={[styles.heroActionText, { color: isDark ? DS.gray300 : DS.gray600 }]}>Explore</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Smart Compose Bar ───
const SmartComposeBar = React.memo(({
  onCompose,
  suggestions,
  isDark,
  currentUser,
  topics,
}: {
  onCompose: (prompt?: string) => void;
  suggestions: string[];
  isDark: boolean;
  currentUser: any;
  topics: any[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Generate smart suggestions based on user's topics and recent activity
  const smartSuggestions = useMemo(() => {
    const userTopics = currentUser?.selectedTopics || [];
    const userTopicNames = userTopics.map(id => {
      const topic = topics.find(t => t.id === id);
      return topic?.name || '';
    }).filter(Boolean);
    
    const baseSuggestions = [
      "Share a milestone your little one reached 🎉",
      "Ask for sleep training advice 😴",
      "What's your favorite parenting hack? 💡",
      "Celebrate a small win today 🌟",
      "Need support? We're here 💙",
    ];
    
    // Add topic-specific suggestions
    const topicSuggestions: string[] = [];
    if (userTopicNames.some(t => t.includes('Potty'))) {
      topicSuggestions.push("Potty training tip that worked for us 🚽");
    }
    if (userTopicNames.some(t => t.includes('Sleep'))) {
      topicSuggestions.push("Sleep regression survival guide 😴");
    }
    if (userTopicNames.some(t => t.includes('Feeding'))) {
      topicSuggestions.push("Baby-led weaning experience 🍼");
    }
    if (userTopicNames.some(t => t.includes('Education'))) {
      topicSuggestions.push("Early learning activity we love 📚");
    }
    if (userTopicNames.some(t => t.includes('Health'))) {
      topicSuggestions.push("Natural remedies that actually work 💊");
    }
    if (userTopicNames.some(t => t.includes('Toddler'))) {
      topicSuggestions.push("Toddler tantrum survival tips 😤");
    }
    
    const allSuggestions = [...topicSuggestions, ...baseSuggestions];
    return allSuggestions.slice(0, 6);
  }, [topics, currentUser]);
  
  // AI-powered prompt completion
  const getAISuggestion = (input: string) => {
    const lower = input.toLowerCase();
    if (lower.includes('sleep')) return "I'm struggling with sleep, here's what's happening...";
    if (lower.includes('feed') || lower.includes('eat')) return "I'm starting solids and need advice on...";
    if (lower.includes('milestone')) return "My baby just reached this milestone and I'm so proud!";
    if (lower.includes('tantrum')) return "Tantrums are getting intense, here's what works for us...";
    if (lower.includes('hack') || lower.includes('tip')) return "Here's a parenting hack that changed everything for me...";
    return null;
  };
  
  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      const aiSuggestion = getAISuggestion(customPrompt);
      onCompose(aiSuggestion || customPrompt);
      setCustomPrompt('');
      setExpanded(false);
    }
  };
  
  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(500).springify()}
      style={[
        styles.composeBar,
        { backgroundColor: isDark ? DS.darkCard : DS.white },
      ]}
    >
      <View style={styles.composeHeader}>
        <View style={styles.composeIconWrap}>
          <LinearGradient
            colors={[DS.primary, DS.accent]}
            style={styles.composeIconGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles" size={18} color={DS.white} />
          </LinearGradient>
        </View>
        <View style={styles.composeTextWrap}>
          <Text style={[styles.composeTitle, { color: isDark ? DS.white : DS.gray900 }]}>
            Smart Compose
          </Text>
          <Text style={[styles.composeSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {smartSuggestions.length > 0 ? `${smartSuggestions.length} suggestions ready` : 'AI-powered writing assistance'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.composeToggle}
          onPress={() => setExpanded(!expanded)}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={isDark ? DS.gray400 : DS.gray500}
          />
        </TouchableOpacity>
      </View>
      
      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.suggestionsWrap}>
          <View style={styles.suggestionInputRow}>
            <View style={[styles.suggestionInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
              <Ionicons name="chatbubble-outline" size={16} color={DS.gray400} />
              <TextInput
                style={[styles.suggestionInput, { color: isDark ? DS.white : DS.gray800 }]}
                placeholder="Describe what you want to post about..."
                placeholderTextColor={DS.gray400}
                value={customPrompt}
                onChangeText={setCustomPrompt}
                returnKeyType="send"
                onSubmitEditing={handleCustomSubmit}
              />
              {customPrompt.length > 0 && (
                <TouchableOpacity onPress={handleCustomSubmit}>
                  <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.suggestionSendBtn}>
                    <Ionicons name="arrow-forward" size={14} color={DS.white} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <View style={styles.suggestionChips}>
            {smartSuggestions.map((suggestion, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.suggestionChip,
                  { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : DS.primaryGhost },
                ]}
                onPress={() => {
                  onCompose(suggestion);
                  setExpanded(false);
                }}
              >
                <Ionicons name="flash" size={12} color={DS.primary} />
                <Text style={[styles.suggestionText, { color: DS.primary }]} numberOfLines={1}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}
      
      <TouchableOpacity
        style={styles.composeInput}
        onPress={() => {
          if (!expanded) {
            setExpanded(true);
          } else {
            onCompose();
          }
        }}
        activeOpacity={0.9}
      >
        <View style={[
          styles.composeInputInner,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 },
        ]}>
          <Ionicons name="create-outline" size={18} color={DS.gray400} />
          <Text style={[styles.composePlaceholder, { color: DS.gray400 }]}>
            What's on your mind, parent?
          </Text>
          <View style={styles.composeAiBadge}>
            <Text style={styles.composeAiText}>AI</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Post Card with Reactions ───
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
  onVoteHelpful,
  onExpand,
  isExpanded,
  commentInput,
  onCommentChange,
  onCommentSubmit,
  replyingTo,
  onReply,
  onLikeComment,
  onVotePoll,
  getUserById,
  topics,
  currentUser,
  canInteract,
  isDark,
}: any) => {
  const sweetAlert = useSweetAlert();
  const topicColor = topics.find((t: any) => t.id === post.topicId)?.color || DS.primary;
  const hasMedia = post.images && post.images.length > 0;
  const isAuthor = post.authorId === currentUser?.id;
  
  const cardScale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const [showMenu, setShowMenu] = useState(false);

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMenu(true);
  };

  // Calculate post score from real data
  const postScore = useMemo(() => {
    const engagement = (post.likes + post.commentsCount * 2 + post.reposts * 3 + post.helpfulVotes * 2) / 10;
    const recency = Math.max(0, 100 - (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60 * 24) * 10);
    return Math.min(Math.round(engagement + recency), 100);
  }, [post]);

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
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}>
          {/* Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => onNavigate(
                isAuthor ? ROUTES.EDIT_PROFILE : ROUTES.USER_PROFILE,
                { userId: post.authorId },
              )}
              activeOpacity={0.7}
            >
              <SafeAvatar
                avatar={post.author.avatar}
                size={44}
                fallbackIcon="person"
                fallbackColor={topicColor}
                fallbackBgColor={`${topicColor}15`}
                borderWidth={2}
                borderColor={postScore > 70 ? DS.primary : 'transparent'}
              />
              
              <View style={styles.authorInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.authorName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                    {post.isAnonymous ? 'Anonymous Parent' : post.author.displayName}
                  </Text>
                  {post.author.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: topicColor }]}>
                      <Ionicons name="checkmark" size={9} color={DS.white} />
                    </View>
                  )}
                  {postScore > 70 && (
                    <View style={styles.scoreBadge}>
                      <Ionicons name="flame" size={10} color={DS.warning} />
                      <Text style={styles.scoreBadgeText}>{postScore}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.handleText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {post.isAnonymous ? '@anonymous' : (post.author?.handle || '')}
                  </Text>
                  <Text style={[styles.dot, { color: isDark ? DS.gray400 : DS.gray500 }]}>·</Text>
                  <Text style={[styles.timeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{post.time || ''}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreBtn} onPress={handleLongPress}>
              <View style={[styles.moreBtnInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                <Ionicons name="ellipsis-horizontal" size={17} color={DS.gray400} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Mood Badge */}
          {post.mood && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm }}>
              <View style={[styles.moodBadge, { backgroundColor: isDark ? `${DS.mood[post.mood]?.glow}20` : DS.mood[post.mood]?.bg }]}>
                <Ionicons name={DS.mood[post.mood]?.icon as any} size={11} color={DS.mood[post.mood]?.text} />
                <Text style={[styles.moodText, { color: DS.mood[post.mood]?.text }]}>{post.mood}</Text>
              </View>
            </View>
          )}

          {/* Content */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
          >
            <Text 
              style={[styles.postText, { color: isDark ? DS.gray300 : DS.gray700 }]} 
              numberOfLines={isExpanded ? undefined : 5}
            >
              {post.content}
            </Text>
            {post.content.length > 220 && !isExpanded && (
              <TouchableOpacity onPress={() => onExpand(post.id)}>
                <Text style={styles.readMore}>Show more</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Poll */}
          {post.poll && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
              <PollWidget poll={post.poll} postId={post.id} onVote={onVotePoll} isDark={isDark} />
            </View>
          )}

          {/* Topic Tag */}
          <TouchableOpacity
            onPress={() => onNavigate(ROUTES.TOPICS, { topicId: post.topicId })}
            activeOpacity={0.8}
            style={[styles.topicTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}
          >
            <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.topicTagText, { color: topicColor }]}>{post.topic}</Text>
            {post.isTrending && (
              <View style={styles.trendingPill}>
                <Ionicons name="flame" size={10} color={DS.warning} />
                <Text style={styles.trendingText}>Trending</Text>
              </View>
            )}
            <View style={styles.engagementMini}>
              <Ionicons name="eye-outline" size={12} color={DS.gray400} />
              <Text style={[styles.engagementMiniText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{post.viewCount || 0}</Text>
            </View>
          </TouchableOpacity>

          {/* Media */}
          {hasMedia && (
            <View style={styles.mediaBox}>
              {post.images!.length === 1 ? (
                <TouchableOpacity
                  onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                  activeOpacity={0.95}
                >
                  <Image source={{ uri: post.images![0] }} style={styles.singleImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <View style={styles.imageGrid}>
                  {post.images!.slice(0, 4).map((img: string, i: number) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
                      activeOpacity={0.95}
                      style={[styles.gridItem, post.images!.length === 3 && i === 0 && styles.gridItemLarge]}
                    >
                      <Image source={{ uri: img }} style={styles.gridImage} resizeMode="cover" />
                      {i === 3 && post.images!.length > 4 && (
                        <View style={styles.gridOverlay}>
                          <Text style={styles.gridOverlayText}>+{post.images!.length - 4}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Engagement Bar */}
          <View style={styles.engagementBar}>
            <Text style={[styles.engagementText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {(post.likes || 0) > 0 ? `${post.likes} like${post.likes !== 1 ? 's' : ''}` : ''}
              {(post.likes || 0) > 0 && (post.commentsCount || 0) > 0 ? ' · ' : ''}
              {(post.commentsCount || 0) > 0 ? `${post.commentsCount} comment${post.commentsCount !== 1 ? 's' : ''}` : ''}
              {(((post.likes || 0) > 0 || (post.commentsCount || 0) > 0) && (post.reposts || 0) > 0) ? ' · ' : ''}
              {(post.reposts || 0) > 0 ? `${post.reposts} repost${post.reposts !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>

          {/* Reaction Bar */}
          <View style={[styles.reactionBar, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Pressable onPress={() => onLike(post.id)} style={styles.reactionBtn}>
              <Animated.View>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={post.isLiked ? DS.accent : DS.gray400}
                />
              </Animated.View>
              <Text style={[styles.reactionCount, post.isLiked && { color: DS.accent, fontWeight: '700' }]}>
                {post.likes > 0 ? post.likes : 'Like'}
              </Text>
            </Pressable>

            <Pressable onPress={() => onExpand(isExpanded ? null : post.id)} style={styles.reactionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={DS.gray400} />
              <Text style={styles.reactionCount}>
                {post.commentsCount > 0 ? post.commentsCount : 'Comment'}
              </Text>
            </Pressable>

            <Pressable onPress={() => onRepost(post.id)} style={styles.reactionBtn}>
              <Animated.View>
                <Ionicons
                  name={post.isReposted ? 'repeat' : 'repeat-outline'}
                  size={20}
                  color={post.isReposted ? DS.success : DS.gray400}
                />
              </Animated.View>
              <Text style={[styles.reactionCount, post.isReposted && { color: DS.success, fontWeight: '700' }]}>
                {post.reposts > 0 ? post.reposts : 'Repost'}
              </Text>
            </Pressable>

            <Pressable onPress={() => onBookmark(post.id)} style={styles.reactionBtn}>
              <Animated.View>
                <Ionicons
                  name={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={post.isBookmarked ? DS.primary : DS.gray400}
                />
              </Animated.View>
            </Pressable>

            <Pressable onPress={() => onShare(post)} style={styles.reactionBtn}>
              <Ionicons name="share-outline" size={20} color={DS.gray400} />
            </Pressable>
          </View>

          {/* Comments Section */}
          {isExpanded && (
            <View style={[styles.commentsBox, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {post.comments.slice(0, 3).map((c: any) => (
                <View key={c.id} style={styles.inlineComment}>
                  <SafeAvatar
                    avatar={c.author.avatar}
                    size={28}
                    fallbackIcon="person"
                    fallbackColor={DS.primary}
                    fallbackBgColor={`${DS.primary}15`}
                  />
                  <View style={styles.inlineCommentContent}>
                    <View style={[styles.inlineCommentBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                      <Text style={[styles.inlineCommentAuthor, { color: isDark ? DS.white : DS.gray800 }]}>{c.author.displayName}</Text>
                      <Text style={[styles.inlineCommentText, { color: isDark ? DS.gray400 : DS.gray600 }]}>{c.content}</Text>
                    </View>
                    <View style={styles.inlineCommentActions}>
                      <TouchableOpacity onPress={() => onLikeComment(post.id, c.id)}>
                        <Text style={[styles.inlineCommentAction, c.isLiked && { color: DS.accent }]}>{c.isLiked ? 'Liked' : 'Like'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onReply(post.id, c.id)}>
                        <Text style={styles.inlineCommentAction}>Reply</Text>
                      </TouchableOpacity>
                      <Text style={[styles.commentTime, { color: isDark ? DS.gray400 : DS.gray500 }]}>{c.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
              
              {post.commentsCount > 3 && (
                <TouchableOpacity onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })} style={styles.viewAllComments}>
                  <Text style={styles.viewAllCommentsText}>View all {post.commentsCount} comments</Text>
                  <Ionicons name="chevron-forward" size={12} color={DS.primary} />
                </TouchableOpacity>
              )}

              <View style={styles.commentInputBox}>
                <SafeAvatar avatar={currentUser?.avatar} size={32} fallbackIcon="person" fallbackColor={DS.primary} fallbackBgColor={`${DS.primary}15`} />
                <View style={[styles.commentInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <TextInput
                    style={[styles.commentInput, { color: isDark ? DS.white : DS.gray800 }]}
                    placeholder={replyingTo?.postId === post.id ? 'Write a reply...' : 'Add a comment...'}
                    placeholderTextColor={DS.gray400}
                    value={commentInput}
                    onChangeText={t => onCommentChange(post.id, t)}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !commentInput.trim() && styles.sendBtnDisabled]}
                    onPress={() => onCommentSubmit(post.id)}
                    disabled={!commentInput.trim()}
                  >
                    <LinearGradient
                      colors={commentInput.trim() ? [DS.primary, DS.primaryDark] : [DS.gray200, DS.gray200]}
                      style={styles.sendBtnGrad}
                    >
                      <Ionicons name="arrow-up" size={14} color={DS.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            {isAuthor && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setShowMenu(false); onDelete(post.id); }}
              >
                <Ionicons name="trash-outline" size={18} color={DS.danger} />
                <Text style={[styles.menuItemText, { color: DS.danger }]}>Delete thread</Text>
              </TouchableOpacity>
            )}
            {!isAuthor && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowMenu(false); onNavigate(ROUTES.USER_PROFILE, { userId: post.authorId }); }}
                >
                  <Ionicons name="person-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
                  <Text style={[styles.menuItemText, { color: isDark ? DS.gray300 : DS.gray700 }]}>View profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowMenu(false); onNavigate(ROUTES.REPORT, { type: 'post', targetId: post.id, targetUserId: post.authorId }); }}
                >
                  <Ionicons name="flag-outline" size={18} color={DS.warning} />
                  <Text style={[styles.menuItemText, { color: isDark ? DS.gray300 : DS.gray700 }]}>Report thread</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); onShare(post); }}
            >
              <Ionicons name="share-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.menuItemText, { color: isDark ? DS.gray300 : DS.gray700 }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
});

// ─── Poll Widget ───
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
  return (
    <View style={[styles.pollWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
      <Text style={[styles.pollQuestion, { color: isDark ? DS.white : DS.gray800 }]}>
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
                      backgroundColor: isSelected ? DS.primary : `${DS.primary}25`,
                    },
                  ]}
                />
              )}
              <View style={styles.pollOptionContent}>
                <Text style={[styles.pollOptionText, { color: isDark ? DS.gray200 : DS.gray700 }]}>
                  {option.text}
                </Text>
                {showResults && (
                  <Text style={[styles.pollPercent, { color: isSelected ? DS.primary : DS.gray400 }]}>
                    {percentage}%
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.pollMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {!poll.hasVoted && ' · Tap to vote'}
      </Text>
    </View>
  );
});

// ─── Glass Header ───
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
  isSearchActive,
}: any) => {
  const headerSolid = useSharedValue(0);

  useAnimatedReaction(
    () => scrollY.value,
    (currentY) => {
      const isPastThreshold = currentY > 60;
      headerSolid.value = withTiming(isPastThreshold ? 1 : 0, { duration: 200 });
    },
    []
  );

  const headerBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      headerSolid.value,
      [0, 1],
      [
        isDark ? 'rgba(12,10,9,0.0)' : 'rgba(255,255,255,0.0)',
        isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)'
      ]
    ),
    borderBottomColor: interpolateColor(
      headerSolid.value,
      [0, 1],
      ['transparent', isDark ? 'rgba(255,255,255,0.06)' : DS.gray200]
    ),
    borderBottomWidth: interpolate(headerSolid.value, [0, 1], [0, 1]),
  }));

  const logoFloat = useSharedValue(0);
  useEffect(() => {
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const logoFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
  }));

  return (
    <Animated.View style={[styles.header, headerBgStyle]} pointerEvents="box-none">
      <View style={styles.headerInner} pointerEvents="auto">
        <TouchableOpacity onPress={onAvatarPress} style={styles.headerAvatarBtn} activeOpacity={0.7}>
          <View style={styles.avatarRing}>
            <SafeAvatar
              avatar={currentUser?.avatar}
              size={38}
              fallbackIcon="person"
              fallbackColor={DS.primary}
              fallbackBgColor={`${DS.primary}18`}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Animated.View style={[styles.logoFloatContainer, logoFloatStyle]}>
              <Image source={littleLoomLogo} style={[styles.headerLogo]} resizeMode="contain" />
            </Animated.View>
            <View style={{ justifyContent: 'center' }}>
              <Text style={[styles.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                LittleLoom
              </Text>
              <LinearGradient
                colors={['#6366f1', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerSubtitleGradient}
              >
                <Text style={styles.headerSubtitleText}>THE LOOM</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        <View style={styles.headerActions} pointerEvents="auto">
          <TouchableOpacity onPress={onSearchPress} style={styles.headerIconBtn} activeOpacity={0.7}>
            <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
              <Ionicons name={isSearchActive ? 'close' : 'search'} size={20} color={isDark ? DS.primaryLight : DS.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNotifPress} style={styles.headerIconBtn} activeOpacity={0.7}>
            <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
              <Ionicons name="notifications-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <LinearGradient colors={[DS.accent, DS.accentLight]} style={styles.headerBadgeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onMessagePress} style={styles.headerIconBtn} activeOpacity={0.7}>
            <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
              <Ionicons name="mail-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── New Posts Banner ───
const NewPostsBanner = React.memo(({ count, onPress }: { count: number; onPress: () => void }) => (
  <Animated.View entering={SlideInDown.duration(350).springify()} exiting={SlideOutUp.duration(200)} style={styles.bannerWrap}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={[DS.primary, DS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bannerGradient}>
        <Ionicons name="sparkles" size={16} color={DS.white} />
        <Text style={styles.bannerText}>{count} new thread{count > 1 ? 's' : ''} woven</Text>
        <Ionicons name="arrow-up" size={14} color={DS.white} />
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
));

// ─── Skeleton Loader ───
const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  return (
    <View style={[
      styles.postCard,
      {
        backgroundColor: isDark ? DS.darkCard : DS.white,
        borderColor: isDark ? DS.darkBorder : DS.gray200,
        marginBottom: DS.space.lg,
        padding: DS.space.lg,
      },
    ]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
        <View style={styles.skeletonTextBlock}>
          <View style={[styles.skeletonLine, { width: '45%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
          <View style={[styles.skeletonLine, { width: '28%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0' }]} />
        </View>
      </View>
      <View style={{ paddingVertical: DS.space.md, gap: DS.space.sm }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
    </View>
  );
});

// ─── MAIN SCREEN ───
export default function CommunityScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  useRouteBasedNavVisibility();

  const community = useCommunity();
  const {
    posts,
    topics,
    currentUser,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    deletePost,
    addComment,
    likeComment,
    replyToComment,
    voteHelpful,
    followUser,
    unfollowUser,
    isFollowing,
    refreshFeed,
    loadMorePosts,
    getFeedPosts,
    getUnreadCount,
    incrementViewCount,
    isAuthenticated: checkIsAuth,
    getAllUsers,
    votePoll,
    markAllNotificationsRead,
    getUserById: contextGetUserById,
    sharePost,
  } = community;

  const { isAuthenticated: authIsAuth } = useAuth();
  const { triggerHaptic } = useCustomization();
  const { settings } = useCustomization();
  const isDark = settings?.darkMode ?? false;

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
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);

  // Get real stats
  const postsCount = posts.length;
  const membersCount = allUsers.length;

  // Smart compose suggestions based on user's topics
  const composeSuggestions = useMemo(() => {
    const userTopics = currentUser?.selectedTopics || [];
    const userTopicNames = userTopics.map(id => {
      const topic = topics.find(t => t.id === id);
      return topic?.name || '';
    }).filter(Boolean);
    
    const suggestions: string[] = [];
    if (userTopicNames.some(t => t.includes('Potty'))) {
      suggestions.push("Potty training tip that worked for us 🚽");
    }
    if (userTopicNames.some(t => t.includes('Sleep'))) {
      suggestions.push("Sleep regression survival guide 😴");
    }
    if (userTopicNames.some(t => t.includes('Feeding'))) {
      suggestions.push("Baby-led weaning experience 🍼");
    }
    if (userTopicNames.some(t => t.includes('Education'))) {
      suggestions.push("Early learning activity we love 📚");
    }
    if (userTopicNames.some(t => t.includes('Health'))) {
      suggestions.push("Natural remedies that actually work 💊");
    }
    suggestions.push("Share a milestone your little one reached 🎉");
    suggestions.push("What's your favorite parenting hack? 💡");
    suggestions.push("Need support? We're here 💙");
    
    return suggestions.slice(0, 6);
  }, [topics, currentUser]);

  const getUserById = useCallback((userId: string) => {
    if (contextGetUserById) return contextGetUserById(userId);
    if (userId === currentUser?.id) return currentUser;
    return allUsers.find(u => u.id === userId);
  }, [contextGetUserById, currentUser, allUsers]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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

  useEffect(() => {
    if (showBanner && newPostsCount > 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setShowBanner(false);
        setNewPostsCount(0);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [showBanner, newPostsCount]);

  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Pin welcome post if exists
    const welcomePost = filtered.find(p => p.authorId === 'littleloom_team');
    if (welcomePost) {
      filtered = filtered.filter(p => p.id !== welcomePost.id);
      filtered.unshift(welcomePost);
    }
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
  }, [activeTopic, searchQuery, getFeedPosts, posts]);

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
      if (sharePost) await sharePost(post.id);
    } catch (e) { console.error(e); }
  }, [sharePost]);

  const handleDelete = useCallback((postId: string) => {
    sweetAlert.confirm(
      'Unravel this thread?',
      'This cannot be undone.',
      () => deletePost(postId),
      undefined,
      'Delete',
      'Cancel',
      true
    );
  }, [deletePost, sweetAlert]);

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

  const handleVotePoll = useCallback(async (postId: string, optionId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to vote', 'warning');
      return;
    }
    await votePoll(postId, optionId);
  }, [canInteract, votePoll, sweetAlert]);

  const handleScrollToNew = useCallback(() => {
    setShowBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(v => (v.item as Post).id));
    setVisiblePostIds(visibleIds);
    viewableItems.forEach(v => incrementViewCount((v.item as Post).id));
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45 }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

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
      onVoteHelpful={voteHelpful}
      onExpand={setExpandedPostId}
      isExpanded={expandedPostId === item.id}
      commentInput={commentInputs[item.id] || ''}
      onCommentChange={(pid, text) => setCommentInputs(prev => ({ ...prev, [pid]: text }))}
      onCommentSubmit={handleCommentSubmit}
      replyingTo={replyingTo}
      onReply={(pid, cid) => setReplyingTo({ postId: pid, commentId: cid })}
      onLikeComment={likeComment}
      onVotePoll={handleVotePoll}
      getUserById={getUserById}
      topics={topics}
      currentUser={currentUser}
      canInteract={canInteract}
      isDark={isDark}
    />
  ), [visiblePostIds, expandedPostId, commentInputs, replyingTo, topics, currentUser, canInteract, isDark, handleLike, handleRepost, handleBookmark, handleShare, handleDelete, handleCommentSubmit, likeComment, voteHelpful, handleVotePoll, getUserById, navigation]);

  const renderHeader = useCallback(() => (
    <View>
      <InteractiveHeroBanner
        isDark={isDark}
        onExploreTopics={() => navigation.navigate(ROUTES.TOPICS, { topicId: topics[0]?.id })}
        onStartPost={() => {
          if (!canInteract) {
            sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST);
        }}
        postsCount={postsCount}
        membersCount={membersCount}
      />

      <SmartComposeBar
        onCompose={(prompt) => {
          if (!canInteract) {
            sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST, { 
            initialContent: prompt 
          });
        }}
        suggestions={composeSuggestions}
        isDark={isDark}
        currentUser={currentUser}
        topics={topics}
      />

      {canInteract && currentUser && (
        <View style={styles.followRow}>
          <TouchableOpacity
            style={[styles.followPill, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
            onPress={() => navigation.navigate(ROUTES.FOLLOWERS, { userId: currentUser.id })}
            activeOpacity={0.8}
          >
            <Text style={[styles.followPillValue, { color: isDark ? DS.white : DS.gray900 }]}>
              {(currentUser.stats?.followers ?? 0).toString()}
            </Text>
            <Text style={[styles.followPillLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Followers</Text>
            <Ionicons name="chevron-forward" size={14} color={DS.gray400} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.followPill, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
            onPress={() => navigation.navigate(ROUTES.FOLLOWING, { userId: currentUser.id })}
            activeOpacity={0.8}
          >
            <Text style={[styles.followPillValue, { color: isDark ? DS.white : DS.gray900 }]}>
              {(currentUser.stats?.following ?? 0).toString()}
            </Text>
            <Text style={[styles.followPillLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Following</Text>
            <Ionicons name="chevron-forward" size={14} color={DS.gray400} />
          </TouchableOpacity>
        </View>
      )}

      {/* Topic Filter */}
      <View style={styles.topicFilterRow}>
        <TouchableOpacity
          style={[styles.topicFilterPill, activeTopic === 'all' && { backgroundColor: DS.primary }]}
          onPress={() => setActiveTopic('all')}
        >
          <Text style={[styles.topicFilterText, activeTopic === 'all' && { color: DS.white }]}>
            All
          </Text>
        </TouchableOpacity>
        {topics.slice(0, 6).map((topic) => (
          <TouchableOpacity
            key={topic.id}
            style={[styles.topicFilterPill, activeTopic === topic.id && { backgroundColor: topic.color }]}
            onPress={() => setActiveTopic(activeTopic === topic.id ? 'all' : topic.id)}
          >
            <Text style={styles.topicFilterEmoji}>{topic.emoji}</Text>
            <Text style={[styles.topicFilterText, activeTopic === topic.id && { color: DS.white }]}>
              {topic.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [isDark, topics, postsCount, membersCount, composeSuggestions, currentUser, canInteract, activeTopic, navigation, sweetAlert]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 120 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={DS.primary} />
        <Text style={[styles.footerLoaderText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Weaving more threads...
        </Text>
      </View>
    );
  }, [loadingMore, isDark]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={isDark ? [`${DS.primary}20`, `${DS.primaryDark}20`] : [`${DS.primary}12`, `${DS.primaryDark}12`]}
        style={styles.emptyIconBg}
      >
        <Ionicons name="chatbubbles-outline" size={40} color={DS.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray600 }]}>
        {searchQuery ? 'No threads found' : 'The Loom is quiet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray400 }]}>
        {searchQuery
          ? 'Try different words or browse by topic'
          : 'Be the first to weave a story into the community!'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => canInteract
            ? navigation.navigate(ROUTES.CREATE_POST)
            : sweetAlert.alert('Sign In Required', 'Please sign in to start a thread', 'warning')}
        >
          <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.emptyBtnGrad}>
            <Text style={styles.emptyBtnText}>Start a Thread</Text>
            <Ionicons name="arrow-forward" size={14} color={DS.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, searchQuery, canInteract, navigation, sweetAlert]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        <GlassHeader
          scrollY={scrollY}
          currentUser={currentUser}
          unreadCount={unreadCount}
          isSearchActive={showSearch}
          onAvatarPress={() => canInteract
            ? navigation.navigate(ROUTES.EDIT_PROFILE)
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
            ? navigation.navigate(ROUTES.MESSAGES)
            : sweetAlert.alert('Sign In Required', 'Please sign in to access messages', 'warning')}
          canInteract={canInteract}
          isDark={isDark}
        />

        {showBanner && (
          <NewPostsBanner count={newPostsCount} onPress={handleScrollToNew} />
        )}

        {showSearch && (
          <Animated.View
            entering={FadeInDown.duration(250)}
            exiting={FadeOut.duration(200)}
            style={[
              styles.searchBarContainer,
              { backgroundColor: isDark ? DS.darkCard : DS.white, marginTop: HEADER_TOTAL_HEIGHT + 8 }
            ]}
          >
            <View style={[styles.searchBarInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
              <Ionicons name="search" size={18} color={DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray800 }]}
                placeholder="Search threads, topics, parents..."
                placeholderTextColor={DS.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity
                style={styles.searchPeopleBtn}
                onPress={() => navigation.navigate(ROUTES.SEARCH_USERS, { initialQuery: searchQuery.trim() })}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={16} color={DS.primary} />
                <Text style={[styles.searchPeopleText, { color: DS.primary }]}>
                  Find parents matching "{searchQuery.trim()}"
                </Text>
                <Ionicons name="chevron-forward" size={14} color={DS.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>
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
                tintColor={DS.primary}
                colors={[DS.primary]}
                progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
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

        {/* Notification Chooser Modal */}
        <Modal
          visible={showNotificationChooser}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNotificationChooser(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowNotificationChooser(false)}>
            <View style={[styles.notificationModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <View style={styles.notificationModalHeader}>
                <Text style={[styles.notificationModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  Notifications
                </Text>
                <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                  <Ionicons name="close" size={24} color={isDark ? DS.gray400 : DS.gray500} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.notificationOption}
                onPress={() => {
                  setShowNotificationChooser(false);
                  navigation.navigate(ROUTES.NOTIFICATIONS);
                }}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="notifications" size={20} color={DS.primary} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                    All Notifications
                  </Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notificationOption}
                onPress={() => {
                  setShowNotificationChooser(false);
                  navigation.navigate(ROUTES.MESSAGES);
                }}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.accent}15` }]}>
                  <Ionicons name="mail" size={20} color={DS.accent} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                    Messages
                  </Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    View your conversations
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notificationOption}
                onPress={() => {
                  setShowNotificationChooser(false);
                  markAllNotificationsRead();
                  sweetAlert.alert('Success', 'All notifications marked as read', 'success');
                }}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.success}15` }]}>
                  <Ionicons name="checkmark-done" size={20} color={DS.success} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                    Mark All as Read
                  </Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    Clear all notification badges
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* FAB */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (!canInteract) {
                sweetAlert.alert('Sign In Required', 'Please sign in to weave a thread', 'warning');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={[styles.fabGlow, { shadowColor: DS.primary }]} />
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: DS.space.md,
    minHeight: HEADER_TOTAL_HEIGHT,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerAvatarBtn: {
    width: 44,
    height: 44,
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: `${DS.primary}25`,
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
    backgroundColor: DS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DS.white,
  },
  headerOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.success,
  },
  headerTitleWrap: { alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: {
    fontSize: DS.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoFloatContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 44,
    height: 44,
    zIndex: 2,
  },
  headerSubtitleGradient: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: DS.radius.sm,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  headerSubtitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: DS.white,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: DS.radius.full,
  },
  headerIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: DS.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DS.white,
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
    color: DS.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Hero Banner
  heroBanner: {
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.md,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  heroContent: { zIndex: 1 },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: DS.text.sm.size,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: DS.radius.lg,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
  },
  heroActions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.full,
  },
  heroActionText: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    color: DS.white,
  },

  // Smart Compose
  composeBar: {
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    ...DS.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.1)',
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  composeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  composeIconGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeTextWrap: { flex: 1 },
  composeTitle: {
    fontSize: DS.text.lg.size,
    fontWeight: '700',
  },
  composeSubtitle: {
    fontSize: DS.text.xs.size,
    marginTop: 2,
  },
  composeToggle: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsWrap: {
    marginBottom: DS.space.md,
  },
  suggestionInputRow: {
    marginBottom: DS.space.sm,
  },
  suggestionInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    gap: DS.space.sm,
  },
  suggestionInput: {
    flex: 1,
    fontSize: DS.text.sm.size,
    paddingVertical: DS.space.sm,
  },
  suggestionSendBtn: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.full,
    maxWidth: '100%',
  },
  suggestionText: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
  },
  composeInput: {
    marginTop: DS.space.sm,
  },
  composeInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
  },
  composePlaceholder: {
    flex: 1,
    fontSize: DS.text.base.size,
  },
  composeAiBadge: {
    backgroundColor: DS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DS.radius.sm,
  },
  composeAiText: {
    color: DS.white,
    fontSize: 9,
    fontWeight: '800',
  },

  // Follow Row
  followRow: {
    flexDirection: 'row',
    gap: DS.space.md,
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  followPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    ...DS.shadow.sm,
  },
  followPillValue: {
    fontSize: DS.text.lg.size,
    fontWeight: '800',
  },
  followPillLabel: {
    flex: 1,
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },

  // Topic Filter
  topicFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  topicFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: DS.gray200,
  },
  topicFilterEmoji: {
    fontSize: 12,
  },
  topicFilterText: {
    fontSize: DS.text.xs.size,
    fontWeight: '600',
    color: DS.gray600,
  },

  // Post Card
  postCardWrap: {
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  postCard: {
    borderRadius: DS.radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DS.space.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorInfo: {
    marginLeft: DS.space.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
  },
  authorName: {
    fontSize: DS.text.base.size,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${DS.warning}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
  },
  scoreBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: DS.warning,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    marginTop: 2,
  },
  handleText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  dot: {
    fontSize: DS.text.xs.size,
    marginHorizontal: 2,
  },
  timeText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  moreBtn: {
    padding: DS.space.sm,
    marginLeft: DS.space.sm,
  },
  moreBtnInner: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  postText: {
    fontSize: DS.text.base.size,
    lineHeight: 24,
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
  },
  readMore: {
    fontSize: DS.text.sm.size,
    color: DS.primary,
    fontWeight: '700',
    paddingHorizontal: DS.space.lg,
    marginTop: -DS.space.sm,
    marginBottom: DS.space.md,
  },

  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.full,
    gap: DS.space.sm,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topicTagText: {
    fontSize: DS.text.xs.size,
    fontWeight: '700',
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${DS.warning}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DS.radius.full,
  },
  trendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: DS.warning,
  },
  engagementMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  engagementMiniText: {
    fontSize: 10,
    fontWeight: '500',
  },

  mediaBox: {
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: 280,
    borderRadius: DS.radius.lg,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  gridItem: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: DS.radius.md,
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
    color: DS.white,
    fontSize: 24,
    fontWeight: '800',
  },

  engagementBar: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.sm,
  },
  engagementText: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },

  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderTopWidth: 1,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.sm,
  },
  reactionCount: {
    fontSize: DS.text.sm.size,
    color: DS.gray400,
    fontWeight: '600',
  },

  commentsBox: {
    borderTopWidth: 1,
    padding: DS.space.lg,
  },
  inlineComment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
    marginBottom: DS.space.md,
  },
  inlineCommentContent: { flex: 1 },
  inlineCommentBubble: {
    borderRadius: DS.radius.lg,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  inlineCommentAuthor: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    marginBottom: 2,
  },
  inlineCommentText: {
    fontSize: DS.text.sm.size,
    lineHeight: 20,
  },
  inlineCommentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginTop: DS.space.xs,
    paddingLeft: DS.space.sm,
  },
  inlineCommentAction: {
    fontSize: DS.text.xs.size,
    color: DS.gray400,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: DS.text.xs.size,
    fontWeight: '500',
  },
  viewAllComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    marginBottom: DS.space.md,
  },
  viewAllCommentsText: {
    fontSize: DS.text.sm.size,
    color: DS.primary,
    fontWeight: '700',
  },
  commentInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.radius.full,
    borderWidth: 1,
    paddingHorizontal: DS.space.md,
    paddingVertical: 2,
  },
  commentInput: {
    flex: 1,
    fontSize: DS.text.sm.size,
    paddingVertical: DS.space.md,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: 4,
    borderRadius: DS.radius.full,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: DS.text.xs.size,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  pollWrap: {
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
  },
  pollQuestion: {
    fontSize: DS.text.sm.size,
    fontWeight: '700',
    marginBottom: DS.space.md,
  },
  pollOption: { marginBottom: DS.space.sm },
  pollTrack: {
    height: 40,
    borderRadius: DS.radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DS.radius.md,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.md,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },
  pollPercent: {
    fontSize: DS.text.sm.size,
    fontWeight: '800',
  },
  pollMeta: {
    fontSize: DS.text.xs.size,
    marginTop: DS.space.sm,
  },

  // Skeleton
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonTextBlock: {
    marginLeft: DS.space.md,
    gap: DS.space.sm,
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: DS.radius.sm,
  },

  // Banner
  bannerWrap: {
    position: 'absolute',
    top: HEADER_TOTAL_HEIGHT + 8,
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.full,
    ...DS.shadow.md,
  },
  bannerText: {
    color: DS.white,
    fontSize: DS.text.sm.size,
    fontWeight: '700',
  },

  // Search
  searchBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 95,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    marginHorizontal: DS.space.lg,
    ...DS.shadow.md,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    borderRadius: DS.radius.full,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: DS.text.base.size,
    paddingVertical: 4,
  },
  searchPeopleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm,
    paddingVertical: DS.space.md,
    marginTop: DS.space.xs,
  },
  searchPeopleText: {
    flex: 1,
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: DS.space['2xl'],
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: DS.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: DS.space.lg,
  },
  emptyTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '800',
    marginBottom: DS.space.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: DS.text.base.size,
    textAlign: 'center',
    marginBottom: DS.space.xl,
    lineHeight: 22,
  },
  emptyBtn: {
    borderRadius: DS.radius.full,
    overflow: 'hidden',
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.md,
  },
  emptyBtnText: {
    color: DS.white,
    fontSize: DS.text.sm.size,
    fontWeight: '700',
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 30,
    right: DS.space.lg,
    zIndex: 100,
    alignItems: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...DS.shadow.lg,
  },
  fabGrad: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    ...DS.shadow.glow,
    zIndex: -1,
  },

  // Notification Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  notificationModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    ...DS.shadow.lg,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.lg,
  },
  notificationModalTitle: {
    fontSize: DS.text.xl.size,
    fontWeight: '700',
  },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationOptionTextWrap: {
    flex: 1,
  },
  notificationOptionTitle: {
    fontSize: DS.text.base.size,
    fontWeight: '600',
  },
  notificationOptionDesc: {
    fontSize: DS.text.xs.size,
    marginTop: 2,
  },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    marginHorizontal: DS.space.lg,
    marginBottom: 40,
    borderRadius: DS.radius.xl,
    paddingVertical: DS.space.sm,
    ...DS.shadow.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.lg,
  },
  menuItemText: {
    fontSize: DS.text.base.size,
    fontWeight: '600',
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.xl,
  },
  footerLoaderText: {
    fontSize: DS.text.sm.size,
    fontWeight: '600',
  },
});