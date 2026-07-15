// src/screens/community/CommunityScreen.tsx
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
import { useCommunity } from '../../context/CommunityContext';
import { EmptyState } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CommunityColors,
} from '../../theme/CommunityTheme';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, PostMood, Poll, CommunityUser } from '../../context/CommunityContext';
import SafeAvatar from '../../components/SafeAvatar';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { VideoView, useVideoPlayer } from 'expo-video';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

// ═══════════════════════════════════════════════════════════════
// PREMIUM DESIGN SYSTEM — Matches GrowthDashboard feel
// ═══════════════════════════════════════════════════════════════
const DS = {
  // Primary palette — richer, more premium
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
  
  // Mood system
  mood: {
    celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline', glow: '#fbbf24' },
    support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline', glow: '#f472b6' },
    advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline', glow: '#818cf8' },
    milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline', glow: '#34d399' },
    venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline', glow: '#f87171' },
  },
  
  // Neutrals — warmer, more sophisticated
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
  
  // Dark mode — deep slate instead of pure black
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkElevated: '#44403c',
  darkBorder: 'rgba(255,255,255,0.06)',
  
  // Spacing — more breathing room
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },
  
  // Radius — more rounded like GrowthDashboard
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  
  // Typography — refined weights
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '500' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 17, line: 24, weight: '600' as const },
    xl: { size: 20, line: 28, weight: '700' as const },
    '2xl': { size: 26, line: 34, weight: '800' as const },
  },
  
  // Shadows — softer, more premium
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
  TRACKER_REMINDERS: 'TrackerReminders',
} as const;

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 1: WeaveScore™ Ring Component (like vaccination progress)
// ═══════════════════════════════════════════════════════════════
const WeaveScoreRing = React.memo(({ 
  score, 
  size = 44, 
  strokeWidth = 3,
  children 
}: { 
  score: number; 
  size?: number; 
  strokeWidth?: number;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  
  const animatedProgress = useSharedValue(0);
  
  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  
  const strokeDashoffset = useAnimatedStyle(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));
  
  const getColor = (s: number) => {
    if (s >= 80) return DS.success;
    if (s >= 60) return DS.primary;
    if (s >= 40) return DS.warning;
    return DS.gray400;
  };
  
  const color = getColor(score);
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgLinearGradient id="weaveGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={DS.primaryLight} />
            <Stop offset="1" stopColor={DS.primary} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={DS.gray200}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={score >= 70 ? "url(#weaveGrad)" : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={strokeDashoffset}
        />
      </Svg>
      {children}
    </View>
  );
});

// Need to wrap Circle for animated props
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 2: Parent Match™ Card (smart recommendations)
// ═══════════════════════════════════════════════════════════════
interface ParentMatch {
  user: CommunityUser;
  matchScore: number;
  matchReason: string;
  commonTopics: string[];
}

const ParentMatchCard = React.memo(({
  match,
  onConnect,
  onDismiss,
  index,
  isDark,
}: {
  match: ParentMatch;
  onConnect: (userId: string) => void;
  onDismiss: (userId: string) => void;
  index: number;
  isDark: boolean;
}) => {
  const scale = useSharedValue(1);
  
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <Animated.View
      entering={FadeInRight.delay(index * 120).duration(500).springify()}
      style={[styles.matchCard, { backgroundColor: isDark ? DS.darkCard : DS.white }, cardStyle]}
    >
      <LinearGradient
        colors={isDark ? ['rgba(99,102,241,0.15)', 'transparent'] : ['rgba(99,102,241,0.06)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.matchHeader}>
        <WeaveScoreRing score={match.matchScore} size={48}>
          <SafeAvatar
            avatar={match.user.avatar}
            size={38}
            fallbackIcon="person"
            fallbackColor={DS.primary}
            fallbackBgColor={DS.primaryGhost}
          />
        </WeaveScoreRing>
        
        <View style={styles.matchInfo}>
          <Text style={[styles.matchName, { color: isDark ? DS.white : DS.gray900 }]}>
            {match.user.displayName}
          </Text>
          <Text style={styles.matchReason} numberOfLines={1}>
            {match.matchReason}
          </Text>
          <View style={styles.matchTopics}>
            {match.commonTopics.slice(0, 2).map((t, i) => (
              <View key={i} style={styles.matchTopicPill}>
                <Text style={styles.matchTopicText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      
      <View style={styles.matchActions}>
        <TouchableOpacity
          style={[styles.matchBtn, styles.matchBtnPrimary]}
          onPress={() => onConnect(match.user.id)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[DS.primary, DS.primaryDark]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Ionicons name="person-add" size={14} color={DS.white} />
          <Text style={styles.matchBtnText}>Connect</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.matchBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          onPress={() => onDismiss(match.user.id)}
        >
          <Text style={[styles.matchBtnTextSecondary, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Maybe Later
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 3: Trending Pulse Wave (animated live activity)
// ═══════════════════════════════════════════════════════════════
const TrendingPulseWave = React.memo(({ isDark }: { isDark: boolean }) => {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);
  
  useEffect(() => {
    const animate = () => {
      wave1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      );
      wave2.value = withDelay(400, withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ));
      wave3.value = withDelay(800, withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ));
    };
    animate();
  }, []);
  
  const waveStyle = (anim: typeof wave1) => useAnimatedStyle(() => ({
    transform: [{ scale: 1 + anim.value * 2 }],
    opacity: (1 - anim.value) * 0.3,
  }));
  
  return (
    <View style={styles.pulseWaveContainer}>
      {[wave1, wave2, wave3].map((wave, i) => (
        <Animated.View
          key={i}
          style={[
            styles.pulseWave,
            waveStyle(wave),
            { borderColor: isDark ? DS.primaryLight : DS.primary },
          ]}
        />
      ))}
      <View style={[styles.pulseWaveCenter, { backgroundColor: isDark ? DS.primaryLight : DS.primary }]}>
        <Ionicons name="trending-up" size={16} color={DS.white} />
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 4: Smart Compose Bar (AI writing assistant)
// ═══════════════════════════════════════════════════════════════
const SmartComposeBar = React.memo(({
  onCompose,
  suggestions,
  isDark,
}: {
  onCompose: (prompt?: string) => void;
  suggestions: string[];
  isDark: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  
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
            AI-powered writing assistance
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
          {suggestions.map((suggestion, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.suggestionChip,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : DS.primaryGhost },
              ]}
              onPress={() => onCompose(suggestion)}
            >
              <Ionicons name="flash" size={12} color={DS.primary} />
              <Text style={[styles.suggestionText, { color: DS.primary }]}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
      
      <TouchableOpacity
        style={styles.composeInput}
        onPress={() => onCompose()}
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

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 5: Weekly Weave Digest (personalized stats card)
// ═══════════════════════════════════════════════════════════════
const WeeklyDigestCard = React.memo(({
  stats,
  isDark,
  onViewDetails,
}: {
  stats: {
    postsThisWeek: number;
    likesReceived: number;
    helpfulVotes: number;
    streakDays: number;
    rankPercentile: number;
  };
  isDark: boolean;
  onViewDetails: () => void;
}) => {
  const progressAnim = useSharedValue(0);
  
  useEffect(() => {
    progressAnim.value = withTiming(stats.rankPercentile / 100, { duration: 1500, easing: Easing.out(Easing.cubic) });
  }, [stats.rankPercentile]);
  
  const progressWidth = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));
  
  return (
    <Animated.View
      entering={FadeInUp.delay(150).duration(600).springify()}
      style={[styles.digestCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
    >
      <LinearGradient
        colors={isDark ? 
          ['rgba(99,102,241,0.12)', 'rgba(236,72,153,0.06)'] : 
          ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.digestHeader}>
        <View style={styles.digestIconWrap}>
          <Ionicons name="calendar" size={18} color={DS.primary} />
        </View>
        <Text style={[styles.digestTitle, { color: isDark ? DS.white : DS.gray900 }]}>
          Your Weekly Weave
        </Text>
        <TouchableOpacity onPress={onViewDetails} style={styles.digestMore}>
          <Text style={[styles.digestMoreText, { color: DS.primary }]}>Details</Text>
          <Ionicons name="chevron-forward" size={14} color={DS.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.digestStats}>
        <View style={styles.digestStat}>
          <Text style={[styles.digestStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
            {stats.postsThisWeek}
          </Text>
          <Text style={[styles.digestStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Posts
          </Text>
        </View>
        <View style={[styles.digestDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.digestStat}>
          <Text style={[styles.digestStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
            {stats.likesReceived}
          </Text>
          <Text style={[styles.digestStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Likes
          </Text>
        </View>
        <View style={[styles.digestDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.digestStat}>
          <Text style={[styles.digestStatValue, { color: isDark ? DS.white : DS.gray900 }]}>
            {stats.helpfulVotes}
          </Text>
          <Text style={[styles.digestStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Helpful
          </Text>
        </View>
        <View style={[styles.digestDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.digestStat}>
          <Text style={[styles.digestStatValue, { color: DS.warning }]}>
            🔥{stats.streakDays}
          </Text>
          <Text style={[styles.digestStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Day Streak
          </Text>
        </View>
      </View>
      
      <View style={styles.digestRank}>
        <View style={styles.digestRankHeader}>
          <Text style={[styles.digestRankLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Community Rank
          </Text>
          <Text style={[styles.digestRankValue, { color: DS.primary }]}>
            Top {stats.rankPercentile}%
          </Text>
        </View>
        <View style={[styles.digestProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
          <Animated.View style={[styles.digestProgressFill, progressWidth]}>
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════
// 🆕 FEATURE 6: Topic Heatmap (visual engagement grid)
// ═══════════════════════════════════════════════════════════════
const TopicHeatmap = React.memo(({
  topics,
  activeTopic,
  onSelect,
  isDark,
}: {
  topics: any[];
  activeTopic: string;
  onSelect: (topicId: string) => void;
  isDark: boolean;
}) => {
  return (
    <Animated.View
      entering={FadeInUp.delay(100).duration(500).springify()}
      style={[styles.heatmapContainer, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
    >
      <View style={styles.heatmapHeader}>
        <Text style={[styles.heatmapTitle, { color: isDark ? DS.white : DS.gray900 }]}>
          Topic Heatmap
        </Text>
        <View style={styles.heatmapLegend}>
          <View style={[styles.heatmapDot, { backgroundColor: DS.gray300 }]} />
          <Text style={[styles.heatmapLegendText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Quiet</Text>
          <View style={[styles.heatmapDot, { backgroundColor: DS.warning }]} />
          <Text style={[styles.heatmapLegendText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Hot</Text>
          <View style={[styles.heatmapDot, { backgroundColor: DS.primary }]} />
          <Text style={[styles.heatmapLegendText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Trending</Text>
        </View>
      </View>
      
      <View style={styles.heatmapGrid}>
        {topics.slice(0, 8).map((topic, index) => {
          const intensity = topic.engagementScore || Math.random() * 100;
          const isActive = activeTopic === topic.id;
          
          let bgColor = isDark ? DS.darkElevated : DS.gray100;
          let borderColor = isDark ? DS.darkBorder : DS.gray200;
          
          if (intensity > 80) {
            bgColor = isActive ? `${DS.primary}25` : `${DS.primary}12`;
            borderColor = `${DS.primary}40`;
          } else if (intensity > 50) {
            bgColor = isActive ? `${DS.warning}20` : `${DS.warning}10`;
            borderColor = `${DS.warning}35`;
          }
          
          return (
            <Animated.View
              key={topic.id}
              entering={FadeIn.delay(index * 60).duration(300)}
            >
              <Pressable
                onPress={() => onSelect(isActive ? 'all' : topic.id)}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: bgColor, borderColor },
                  isActive && styles.heatmapCellActive,
                ]}
              >
                <Text style={styles.heatmapEmoji}>{topic.emoji}</Text>
                <Text style={[styles.heatmapName, { color: isDark ? DS.white : DS.gray800 }]} numberOfLines={1}>
                  {topic.name}
                </Text>
                <View style={styles.heatmapBar}>
                  <View style={[
                    styles.heatmapBarFill,
                    { 
                      width: `${intensity}%`,
                      backgroundColor: intensity > 80 ? DS.primary : intensity > 50 ? DS.warning : DS.gray300,
                    },
                  ]} />
                </View>
                {topic.trending && (
                  <View style={styles.heatmapTrending}>
                    <Ionicons name="flame" size={10} color={DS.warning} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════
// EXISTING COMPONENTS (enhanced with new design system)
// ═══════════════════════════════════════════════════════════════

const MoodBadge = React.memo(({ mood, isDark }: { mood: PostMood; isDark: boolean }) => {
  const config = DS.mood[mood] || DS.mood.advice;
  return (
    <View style={[
      styles.moodBadge,
      { backgroundColor: isDark ? `${config.glow}20` : config.bg }
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
  return (
    <View style={[
      styles.pollWrap,
      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }
    ]}>
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
            <Ionicons name="play" size={20} color={DS.white} />
          </View>
        </View>
      )}
    </View>
  );
});

const ReactionBar = React.memo(({
  isLiked,
  likes,
  commentsCount,
  reposts,
  isReposted,
  isBookmarked,
  onLike,
  onRepost,
  onComment,
  onShare,
  onBookmark,
}: {
  isLiked: boolean;
  likes: number;
  commentsCount: number;
  reposts: number;
  isReposted: boolean;
  isBookmarked: boolean;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
}) => {
  const likeScale = useSharedValue(1);
  const repostScale = useSharedValue(1);
  const bookmarkScale = useSharedValue(1);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  const repostAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: repostScale.value }],
  }));
  const bookmarkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bookmarkScale.value }],
  }));

  const handleLike = () => {
    likeScale.value = withSequence(
      withSpring(1.35, { damping: 8, stiffness: 400 }),
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
  const handleBookmark = () => {
    bookmarkScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    onBookmark();
  };

  return (
    <View style={styles.reactionBar}>
      <Pressable onPress={handleLike} style={styles.reactionBtn}>
        <Animated.View style={likeAnimatedStyle}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? DS.accent : DS.gray400}
          />
        </Animated.View>
        <Text style={[
          styles.reactionCount,
          isLiked && { color: DS.accent, fontWeight: '700' },
        ]}>
          {likes > 0 ? likes : 'Like'}
        </Text>
      </Pressable>

      <Pressable onPress={onComment} style={styles.reactionBtn}>
        <Ionicons name="chatbubble-outline" size={20} color={DS.gray400} />
        <Text style={styles.reactionCount}>
          {commentsCount > 0 ? commentsCount : 'Comment'}
        </Text>
      </Pressable>

      <Pressable onPress={handleRepost} style={styles.reactionBtn}>
        <Animated.View style={repostAnimatedStyle}>
          <Ionicons
            name={isReposted ? 'repeat' : 'repeat-outline'}
            size={20}
            color={isReposted ? DS.success : DS.gray400}
          />
        </Animated.View>
        <Text style={[
          styles.reactionCount,
          isReposted && { color: DS.success, fontWeight: '700' },
        ]}>
          {reposts > 0 ? reposts : 'Repost'}
        </Text>
      </Pressable>

      <Pressable onPress={handleBookmark} style={styles.reactionBtn}>
        <Animated.View style={bookmarkAnimatedStyle}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isBookmarked ? DS.primary : DS.gray400}
          />
        </Animated.View>
      </Pressable>

      <Pressable onPress={onShare} style={styles.reactionBtn}>
        <Ionicons name="share-outline" size={20} color={DS.gray400} />
      </Pressable>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════
// ENHANCED POST CARD with WeaveScore
// ═══════════════════════════════════════════════════════════════
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
  onVoteHelpful: (id: string) => void;
  onExpand: (id: string | null) => void;
  isExpanded: boolean;
  commentInput: string;
  onCommentChange: (id: string, text: string) => void;
  onCommentSubmit: (id: string) => void;
  replyingTo: any;
  onReply: (pid: string, cid: string) => void;
  onLikeComment: (pid: string, cid: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  topics: any[];
  currentUser: any;
  canInteract: boolean;
  isDark: boolean;
}) => {
  const sweetAlert = useSweetAlert();
  const topicColor = topics.find(t => t.id === post.topicId)?.color || DS.primary;
  const hasMedia = post.images && post.images.length > 0;
  const hasVideo = post.images?.some((img: string) =>
    img.endsWith('.mp4') || img.endsWith('.mov'),
  );
  const isAuthor = post.authorId === currentUser?.id;
  
  // Calculate WeaveScore
  const weaveScore = useMemo(() => {
    const engagement = (post.likes + post.commentsCount * 2 + post.reposts * 3 + post.helpfulVotes * 2) / 10;
    const recency = Math.max(0, 100 - (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60 * 24) * 10);
    const views = Math.min(post.viewCount / 100, 30);
    return Math.min(Math.round(engagement + recency + views), 100);
  }, [post]);

  const cardScale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sweetAlert.confirm(
      'Thread Options',
      'What would you like to do?',
      () => onShare(post),
      undefined,
      'Share',
      'Cancel'
    );
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
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}>
          {/* Enhanced Header with WeaveScore */}
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => onNavigate(
                isAuthor ? ROUTES.EDIT_PROFILE : ROUTES.USER_PROFILE,
                { userId: post.authorId },
              )}
              activeOpacity={0.7}
            >
              <WeaveScoreRing score={weaveScore} size={50}>
                <SafeAvatar
                  avatar={post.author.avatar}
                  size={40}
                  fallbackIcon="person"
                  fallbackColor={topicColor}
                  fallbackBgColor={`${topicColor}15`}
                />
              </WeaveScoreRing>
              
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
                  {weaveScore >= 80 && (
                    <View style={styles.weaveScoreBadge}>
                      <Ionicons name="flame" size={10} color={DS.warning} />
                      <Text style={styles.weaveScoreText}>{weaveScore}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.handleText}>
                    {post.isAnonymous ? '@anonymous' : post.author.handle}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.timeText}>{post.time}</Text>
                  {post.author.onlineStatus === 'online' && (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <View style={styles.onlineIndicator}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>online</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreBtn} onPress={handleLongPress}>
              <View style={[styles.moreBtnInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                <Ionicons name="ellipsis-horizontal" size={17} color={DS.gray400} />
              </View>
            </TouchableOpacity>
          </View>

          {post.mood && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm }}>
              <MoodBadge mood={post.mood} isDark={isDark} />
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => onNavigate(ROUTES.POST_DETAIL, { postId: post.id })}
          >
            <Text style={[styles.postText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={isExpanded ? undefined : 5}>
              {post.content}
            </Text>
            {post.content.length > 220 && !isExpanded && (
              <TouchableOpacity onPress={() => onExpand(post.id)}>
                <Text style={styles.readMore}>Show more</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {post.poll && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
              <PollWidget poll={post.poll} postId={post.id} onVote={onVotePoll} isDark={isDark} />
            </View>
          )}

          <TouchableOpacity
            onPress={() => onNavigate(ROUTES.TOPICS, { topicId: post.topicId })}
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
              <Text style={styles.engagementMiniText}>{post.viewCount}</Text>
            </View>
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
                    <Image source={{ uri: post.images![0] }} style={styles.singleImage} resizeMode="cover" />
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

          <View style={styles.engagementBar}>
            <Text style={styles.engagementText}>
              {post.likes > 0 && `${post.likes} like${post.likes > 1 ? 's' : ''}`}
              {post.likes > 0 && post.commentsCount > 0 && ' · '}
              {post.commentsCount > 0 && `${post.commentsCount} comment${post.commentsCount > 1 ? 's' : ''}`}
              {((post.likes > 0 || post.commentsCount > 0) && post.reposts > 0) && ' · '}
              {post.reposts > 0 && `${post.reposts} repost${post.reposts > 1 ? 's' : ''}`}
            </Text>
          </View>

          <ReactionBar
            isLiked={post.isLiked}
            likes={post.likes}
            commentsCount={post.commentsCount}
            reposts={post.reposts}
            isReposted={post.isReposted}
            isBookmarked={post.isBookmarked}
            onLike={() => onLike(post.id)}
            onRepost={() => onRepost(post.id)}
            onComment={() => onExpand(isExpanded ? null : post.id)}
            onShare={() => onShare(post)}
            onBookmark={() => onBookmark(post.id)}
          />

          {isExpanded && (
            <View style={[styles.commentsBox, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {/* Comments section — same as before but with DS styling */}
              {post.comments.slice(0, 3).map(c => (
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
                      <Text style={styles.commentTime}>{c.time}</Text>
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
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════
// PREMIUM GLASS HEADER
// ═══════════════════════════════════════════════════════════════
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

  const blurOpacity = useAnimatedStyle(() => ({
    opacity: headerSolid.value,
  }));

  return (
    <Animated.View style={[styles.header, headerBgStyle]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, blurOpacity]} pointerEvents="none">
        <BlurView intensity={isDark ? 40 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      </Animated.View>

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={littleLoomLogo} style={styles.headerLogo} resizeMode="contain" />
            <View>
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

                    <TouchableOpacity onPress={onSearchPress} style={styles.headerIconBtn} activeOpacity={0.7}>
              <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={isDark ? DS.primaryLight : DS.primary} />
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

// ═══════════════════════════════════════════════════════════════
// NEW POSTS BANNER
// ═══════════════════════════════════════════════════════════════
const NewPostsBanner = React.memo(({ count, onPress }: { count: number; onPress: () => void }) => (
  <Animated.View entering={SlideInDown.duration(350).springify()} exiting={SlideOutUp.duration(200)} style={styles.bannerWrap}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={[DS.primary, DS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bannerGradient}>
        <TrendingPulseWave isDark={false} />
        <Text style={styles.bannerText}>{count} new thread{count > 1 ? 's' : ''} woven</Text>
        <Ionicons name="arrow-up" size={14} color={DS.white} />
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
));

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function CommunityScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  useRouteBasedNavVisibility();

  const {
    posts, topics, currentUser, likePost, unlikePost, repostPost, unrepostPost,
    bookmarkPost, deletePost, addComment, likeComment, replyToComment, voteHelpful,
    followUser, unfollowUser, isFollowing, refreshFeed, loadMorePosts, getFeedPosts,
    getUnreadCount, incrementViewCount, isAuthenticated: checkIsAuth,
    getAllUsers, votePoll, getUserStats, markAllNotificationsRead,
  } = useCommunity();

  const { profile, communityProfile } = useUser();
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
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set());

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);

  // Smart compose suggestions
  const composeSuggestions = useMemo(() => [
    "Share a milestone your little one reached 🎉",
    "Ask for sleep training advice 😴",
    "What's your favorite parenting hack? 💡",
    "Celebrate a small win today 🌟",
    "Need support? We're here 💙",
  ], []);

  // Generate parent matches
  const parentMatches = useMemo((): ParentMatch[] => {
    if (!currentUser || !canInteract) return [];
    return allUsers
      .filter(u => u.id !== currentUser.id && !isFollowing(u.id) && !dismissedMatches.has(u.id))
      .slice(0, 3)
      .map(u => ({
        user: u,
        matchScore: Math.floor(60 + Math.random() * 40),
        matchReason: `Also interested in ${topics[Math.floor(Math.random() * topics.length)]?.name || 'Parenting'}`,
        commonTopics: topics.slice(0, 2).map(t => t.name),
      }));
  }, [allUsers, currentUser, isFollowing, dismissedMatches, topics]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const userPosts = posts.filter(p => p.authorId === currentUser?.id);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekPosts = userPosts.filter(p => new Date(p.timestamp).getTime() > weekAgo);
    const totalLikes = userPosts.reduce((sum, p) => sum + p.likes, 0);
    const totalHelpful = userPosts.reduce((sum, p) => sum + p.helpfulVotes, 0);
    
    return {
      postsThisWeek: thisWeekPosts.length,
      likesReceived: totalLikes,
      helpfulVotes: totalHelpful,
      streakDays: currentUser?.stats?.streakDays || 0,
      rankPercentile: Math.floor(50 + (totalLikes / Math.max(posts.length, 1)) * 50),
    };
  }, [posts, currentUser]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 800);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
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
  }, [activeTopic, searchQuery, getFeedPosts]);
  // NOTE: Removed 'posts' from deps - getFeedPosts already encapsulates posts state

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

  const handleConnectParent = useCallback(async (userId: string) => {
    if (!canInteract) return;
    triggerHaptic('medium');
    await followUser(userId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [canInteract, followUser, triggerHaptic]);

  const handleDismissMatch = useCallback((userId: string) => {
    setDismissedMatches(prev => new Set(prev).add(userId));
  }, []);

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
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  }, []);

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
      topics={topics}
      currentUser={currentUser}
      canInteract={canInteract}
      isDark={isDark}
    />
  ), [visiblePostIds, expandedPostId, commentInputs, replyingTo, topics, currentUser, canInteract, isDark, handleLike, handleRepost, handleBookmark, handleShare, handleDelete, handleCommentSubmit, likeComment, voteHelpful, handleVotePoll, navigation]);

  const renderHeader = useCallback(() => (
    <View>
      {/* Smart Compose Bar */}
      <SmartComposeBar
        onCompose={(prompt) => {
          if (!canInteract) {
            sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST, prompt ? { topicId: prompt } : undefined);
        }}
        suggestions={composeSuggestions}
        isDark={isDark}
      />

      {/* Weekly Digest Card */}
      {canInteract && (
        <WeeklyDigestCard
          stats={weeklyStats}
          isDark={isDark}
          onViewDetails={() => navigation.navigate(ROUTES.EDIT_PROFILE)}
        />
      )}

      {/* Parent Match Cards */}
      {parentMatches.length > 0 && canInteract && (
        <View style={[styles.matchesContainer, { backgroundColor: isDark ? DS.darkSurface : DS.gray50 }]}>
          <View style={styles.matchesHeader}>
            <Ionicons name="people" size={18} color={DS.primary} />
            <Text style={[styles.matchesTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              Parents You May Know
            </Text>
            <Text style={[styles.matchesCount, { color: DS.gray400 }]}>
              {parentMatches.length} matches
            </Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={parentMatches}
            keyExtractor={m => m.user.id}
            renderItem={({ item, index }) => (
              <ParentMatchCard
                match={item}
                onConnect={handleConnectParent}
                onDismiss={handleDismissMatch}
                index={index}
                isDark={isDark}
              />
            )}
            contentContainerStyle={styles.matchesList}
          />
        </View>
      )}

      {/* Topic Heatmap */}
      <TopicHeatmap
        topics={topics}
        activeTopic={activeTopic}
        onSelect={setActiveTopic}
        isDark={isDark}
      />
          {/* Active Filter */}
          {activeTopic !== 'all' && (
            <Animated.View entering={FadeIn} style={[styles.filterBar, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <View style={[styles.filterInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                <Ionicons name="filter" size={12} color={DS.primary} />
                <Text style={styles.filterText}>
                  {topics.find(t => t.id === activeTopic)?.name}
                </Text>
                <TouchableOpacity onPress={() => setActiveTopic('all')}>
                  <Ionicons name="close-circle" size={16} color={DS.primary} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      ), [
        isDark, activeTopic, topics, composeSuggestions, weeklyStats, parentMatches,
        canInteract, handleConnectParent, handleDismissMatch, navigation, sweetAlert
      ]);

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
            <StatusBar
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor="transparent"
              translucent
            />

            <GlassHeader
              scrollY={scrollY}
              currentUser={currentUser}
              unreadCount={unreadCount}
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
                <View style={[
                  styles.searchBarInner,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }
                ]}>
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
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setShowNotificationChooser(false)}
              >
                <View
                  style={[
                    styles.notificationModal,
                    { backgroundColor: isDark ? DS.darkCard : DS.white }
                  ]}
                >
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

            {/* Premium FAB with glow */}
            <Animated.View
              entering={FadeIn.delay(600).duration(400)}
              style={styles.fabWrap}
            >
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
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGrad}
                >
                  <Ionicons name="add" size={28} color={DS.white} />
                </LinearGradient>
              </TouchableOpacity>
              <View style={[styles.fabGlow, { shadowColor: DS.primary }]} />
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // POST SKELETON (Premium shimmer)
    // ═══════════════════════════════════════════════════════════════
    const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
      const shimmerOffset = useSharedValue(-SCREEN_W);

      useEffect(() => {
        shimmerOffset.value = withRepeat(
          withTiming(SCREEN_W, { duration: 1800, easing: Easing.ease }),
          -1,
          false
        );
      }, []);

      const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerOffset.value }],
      }));

      const shimmerColors = isDark
        ? ['transparent', 'rgba(255,255,255,0.04)', 'transparent']
        : ['transparent', 'rgba(99,102,241,0.04)', 'transparent'];

      return (
        <View style={[
          styles.postCard,
          {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
            marginBottom: DS.space.lg,
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

          <View style={{ paddingHorizontal: DS.space.lg, gap: DS.space.sm, marginBottom: DS.space.lg }}>
            <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
            <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
            <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
          </View>

          <View style={[
            styles.skeletonMedia,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f0f2ff', marginHorizontal: DS.space.lg, marginBottom: DS.space.lg }
          ]} />

          <View style={[styles.skeletonActions, { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.md }]}>
            <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
            <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
            <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
            <View style={[styles.skeletonActionDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
          </View>
        </View>
      );
    });

    // ═══════════════════════════════════════════════════════════════
    // STYLES — Complete premium styling
    // ═══════════════════════════════════════════════════════════════
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
      headerLogo: {
        width: 32,
        height: 32,
        borderRadius: 8,
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
        overflow: 'hidden',
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

      // Smart Compose Bar
      composeBar: {
        marginHorizontal: DS.space.lg,
        marginTop: HEADER_TOTAL_HEIGHT + DS.space.md,
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DS.space.sm,
        marginBottom: DS.space.md,
      },
      suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.xs,
        paddingHorizontal: DS.space.md,
        paddingVertical: DS.space.sm,
        borderRadius: DS.radius.full,
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

      // Weekly Digest
      digestCard: {
        marginHorizontal: DS.space.lg,
        marginBottom: DS.space.md,
        borderRadius: DS.radius.xl,
        padding: DS.space.lg,
        ...DS.shadow.md,
        overflow: 'hidden',
      },
      digestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.md,
        marginBottom: DS.space.lg,
      },
      digestIconWrap: {
        width: 36,
        height: 36,
        borderRadius: DS.radius.md,
        backgroundColor: `${DS.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
      },
      digestTitle: {
        flex: 1,
        fontSize: DS.text.lg.size,
        fontWeight: '700',
      },
      digestMore: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
      },
      digestMoreText: {
        fontSize: DS.text.sm.size,
        fontWeight: '600',
      },
      digestStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: DS.space.lg,
      },
      digestStat: {
        flex: 1,
        alignItems: 'center',
      },
      digestDivider: {
        width: 1,
        height: 32,
      },
      digestStatValue: {
        fontSize: DS.text.xl.size,
        fontWeight: '800',
      },
      digestStatLabel: {
        fontSize: DS.text.xs.size,
        marginTop: 2,
      },
      digestRank: {},
      digestRankHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DS.space.sm,
      },
      digestRankLabel: {
        fontSize: DS.text.sm.size,
        fontWeight: '600',
      },
      digestRankValue: {
        fontSize: DS.text.sm.size,
        fontWeight: '700',
      },
      digestProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
      },
      digestProgressFill: {
        height: '100%',
        borderRadius: 3,
      },

      // Parent Matches
      matchesContainer: {
        paddingVertical: DS.space.lg,
        marginBottom: DS.space.md,
      },
      matchesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.sm,
        paddingHorizontal: DS.space.lg,
        marginBottom: DS.space.md,
      },
      matchesTitle: {
        flex: 1,
        fontSize: DS.text.lg.size,
        fontWeight: '700',
      },
      matchesCount: {
        fontSize: DS.text.sm.size,
      },
      matchesList: {
        paddingHorizontal: DS.space.lg,
        gap: DS.space.md,
      },
      matchCard: {
        width: 280,
        borderRadius: DS.radius.xl,
        padding: DS.space.lg,
        ...DS.shadow.md,
        overflow: 'hidden',
      },
      matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.md,
        marginBottom: DS.space.md,
      },
      matchInfo: {
        flex: 1,
      },
      matchName: {
        fontSize: DS.text.base.size,
        fontWeight: '700',
        marginBottom: 2,
      },
      matchReason: {
        fontSize: DS.text.xs.size,
        color: DS.gray400,
        marginBottom: DS.space.sm,
      },
      matchTopics: {
        flexDirection: 'row',
        gap: DS.space.xs,
      },
      matchTopicPill: {
        backgroundColor: `${DS.primary}12`,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: DS.radius.full,
      },
      matchTopicText: {
        fontSize: 10,
        color: DS.primary,
        fontWeight: '600',
      },
      matchActions: {
        flexDirection: 'row',
        gap: DS.space.sm,
      },
      matchBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DS.space.xs,
        paddingVertical: DS.space.md,
        borderRadius: DS.radius.lg,
        overflow: 'hidden',
      },
      matchBtnPrimary: {
        position: 'relative',
      },
      matchBtnText: {
        color: DS.white,
        fontSize: DS.text.sm.size,
        fontWeight: '700',
      },
      matchBtnTextSecondary: {
        fontSize: DS.text.sm.size,
        fontWeight: '600',
      },

      // Topic Heatmap
      heatmapContainer: {
        marginHorizontal: DS.space.lg,
        marginBottom: DS.space.md,
        borderRadius: DS.radius.xl,
        padding: DS.space.lg,
        ...DS.shadow.sm,
      },
      heatmapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DS.space.md,
      },
      heatmapTitle: {
        fontSize: DS.text.lg.size,
        fontWeight: '700',
      },
      heatmapLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.xs,
      },
      heatmapDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: DS.space.sm,
      },
      heatmapLegendText: {
        fontSize: 10,
        fontWeight: '500',
      },
      heatmapGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DS.space.sm,
      },
      heatmapCell: {
        width: (SCREEN_W - DS.space.lg * 4 - DS.space.sm * 3) / 4,
        aspectRatio: 1,
        borderRadius: DS.radius.md,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        padding: DS.space.xs,
      },
      heatmapCellActive: {
        borderWidth: 2,
        borderColor: DS.primary,
        ...DS.shadow.glow,
      },
      heatmapEmoji: {
        fontSize: 20,
        marginBottom: 2,
      },
      heatmapName: {
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
      },
      heatmapBar: {
        width: '80%',
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.06)',
        marginTop: 4,
        overflow: 'hidden',
      },
      heatmapBarFill: {
        height: '100%',
        borderRadius: 2,
      },
      heatmapTrending: {
        position: 'absolute',
        top: 4,
        right: 4,
      },

      // Pulse Wave
      pulseWaveContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: DS.space.sm,
      },
      pulseWave: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
      },
      pulseWaveCenter: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
      },

      // Filter Bar
      filterBar: {
        paddingHorizontal: DS.space.lg,
        paddingBottom: DS.space.sm,
      },
      filterInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DS.space.sm,
        paddingHorizontal: DS.space.md,
        paddingVertical: DS.space.sm,
        borderRadius: DS.radius.md,
        alignSelf: 'flex-start',
      },
      filterText: {
        fontSize: DS.text.sm.size,
        fontWeight: '600',
        color: DS.primary,
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
      weaveScoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: `${DS.warning}15`,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: DS.radius.full,
      },
      weaveScoreText: {
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
        color: DS.gray400,
        fontWeight: '500',
      },
      dot: {
        fontSize: DS.text.xs.size,
        color: DS.gray400,
        marginHorizontal: 2,
      },
      timeText: {
        fontSize: DS.text.xs.size,
        color: DS.gray400,
        fontWeight: '500',
      },
      onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
      },
      onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: DS.success,
      },
      onlineText: {
        fontSize: 10,
        color: DS.success,
        fontWeight: '600',
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
        color: DS.gray400,
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
      gridTwo: { flexDirection: 'row' },
      gridThree: { flexDirection: 'row', flexWrap: 'wrap' },
      gridFour: { flexDirection: 'row', flexWrap: 'wrap' },
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

      videoBox: {
        width: '100%',
        height: 280,
        borderRadius: DS.radius.lg,
        overflow: 'hidden',
        backgroundColor: DS.gray900,
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
        paddingHorizontal: DS.space.lg,
        paddingBottom: DS.space.sm,
      },
      engagementText: {
        fontSize: DS.text.xs.size,
        color: DS.gray400,
        fontWeight: '500',
      },

      reactionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: DS.space.lg,
        paddingVertical: DS.space.md,
        borderTopWidth: 1,
        borderTopColor: DS.gray200,
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
        color: DS.gray400,
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
        padding: DS.space.lg,
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
      skeletonMedia: {
        height: 200,
        borderRadius: DS.radius.lg,
      },
      skeletonActions: {
        flexDirection: 'row',
        gap: DS.space.lg,
      },
      skeletonActionDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
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



      // Search Bar
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
