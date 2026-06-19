import {
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  useColorScheme,
  StatusBar,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInRight,
  interpolate,
  Layout,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { CommunityUser, Post, useCommunity } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

// DESIGN TOKENS
const { width: SCREEN_W } = Dimensions.get('window');

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const TC = {
  primary: '#667eea', primaryDark: '#764ba2', secondary: '#fa709a', accent: '#f59e0b',
  success: '#10b981', warning: '#fbbf24', danger: '#ef4444', info: '#3b82f6', purple: '#8b5cf6', teal: '#14b8a6',
};

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#667eea', 'topic_2': '#11998e', 'topic_3': '#fa709a',
  'topic_4': '#fee140', 'topic_5': '#fc5c7d', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#fa709a',
  'topic_10': '#43e97b', 'topic_11': '#fa709a', 'topic_12': '#667eea',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#667eea', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#11998e', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#fa709a', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fee140', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#fa709a', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#667eea', desc: 'Identity verified' },
};

// NEW FEATURE TYPES
interface EngagementInsight { label: string; value: number; icon: string; color: string; trend: number; }
interface CommunityInfluence { score: number; rank: string; percentile: number; topContributors: { id: string; name: string; avatar: string }[]; }
interface ContentHighlights { topPost: Post | null; mostLiked: number; mostCommented: number; avgEngagement: number; }
interface ActivityPattern { day: string; activity: number; posts: number; }
interface MutualConnection { id: string; name: string; avatar: string; mutualCount: number; }
interface SmartAction { id: string; title: string; description: string; icon: string; color: string; action: () => void; }

// UNIFIED GLASS CARD
const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} layout={Layout.springify()}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, active && { borderColor: TC.primary, borderWidth: 2 }, style]}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

// SECTION HEADER
const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: any) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: TC.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={TC.primary} />
      </TouchableOpacity>
    )}
  </View>
));

// STAT PILL
const StatPill = React.memo(({ icon, value, label, color }: any) => (
  <View style={styles.statPill}>
    <View style={[styles.statPillIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.statPillEmoji}>{icon}</Text>
    </View>
    <View style={styles.statPillText}>
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  </View>
));

// NEW FEATURE 1: ENGAGEMENT INSIGHTS CARD
const EngagementInsightsCard = React.memo(({ insights, isDark }: any) => (
  <Animated.View entering={FadeInUp.delay(100).springify()}>
    <GlassCard>
      <View style={styles.insightsHeader}>
        <View style={[styles.insightsIconBg, { backgroundColor: `${TC.primary}15` }]}>
          <Ionicons name="analytics" size={20} color={TC.primary} />
        </View>
        <View style={styles.insightsTitleWrap}>
          <Text style={[styles.insightsTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Engagement Insights</Text>
          <Text style={[styles.insightsSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>How this parent connects</Text>
        </View>
      </View>
      <View style={styles.insightsGrid}>
        {insights.map((insight: any, i: number) => (
          <View key={insight.label} style={[styles.insightItem, i < insights.length - 1 && { borderRightWidth: 1, borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={styles.insightItemIcon}>{insight.icon}</Text>
            <Text style={[styles.insightItemValue, { color: insight.color }]}>{insight.value}</Text>
            <Text style={[styles.insightItemLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{insight.label}</Text>
            <View style={styles.insightTrendRow}>
              <Ionicons name={insight.trend >= 0 ? 'trending-up' : 'trending-down'} size={12} color={insight.trend >= 0 ? '#10b981' : '#ef4444'} />
              <Text style={[styles.insightTrendText, { color: insight.trend >= 0 ? '#10b981' : '#ef4444' }]}>
                {insight.trend > 0 ? '+' : ''}{insight.trend}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </GlassCard>
  </Animated.View>
));

// NEW FEATURE 2: COMMUNITY INFLUENCE CARD
const CommunityInfluenceCard = React.memo(({ influence, isDark }: any) => (
  <Animated.View entering={FadeInUp.delay(150).springify()}>
    <GlassCard>
      <View style={styles.influenceHeader}>
        <View style={[styles.influenceIconBg, { backgroundColor: `${TC.purple}15` }]}>
          <Ionicons name="trophy" size={20} color={TC.purple} />
        </View>
        <View style={styles.influenceTitleWrap}>
          <Text style={[styles.influenceTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Community Influence</Text>
          <Text style={[styles.influenceSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>Top {influence.percentile}% of members</Text>
        </View>
        <View style={[styles.influenceScoreBadge, { backgroundColor: `${TC.purple}12` }]}>
          <Text style={[styles.influenceScoreText, { color: TC.purple }]}>{influence.score}</Text>
        </View>
      </View>
      <View style={styles.influenceRankRow}>
        <View style={[styles.influenceRankBadge, { backgroundColor: `${TC.purple}12` }]}>
          <Text style={[styles.influenceRankText, { color: TC.purple }]}>{influence.rank}</Text>
        </View>
        <View style={styles.influenceProgressWrap}>
          <View style={styles.influenceProgressLabelRow}>
            <Text style={[styles.influenceProgressLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Next rank</Text>
            <Text style={[styles.influenceProgressValue, { color: TC.purple }]}>{influence.percentile}%</Text>
          </View>
          <View style={[styles.influenceProgressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.influenceProgressBarFill, { width: `${influence.percentile}%`, backgroundColor: TC.purple }]} />
          </View>
        </View>
      </View>
      {influence.topContributors.length > 0 && (
        <View style={styles.influenceContributors}>
          <Text style={[styles.influenceContributorsLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Connected with</Text>
          <View style={styles.influenceAvatarStack}>
            {influence.topContributors.map((c: any, i: number) => (
              <View key={c.id} style={[styles.influenceAvatar, { marginLeft: i > 0 ? -10 : 0, zIndex: influence.topContributors.length - i }]}>
                <SafeAvatar avatar={c.avatar} size={28} fallbackIcon="person" fallbackColor={TC.purple} />
              </View>
            ))}
            <View style={[styles.influenceAvatarMore, { backgroundColor: `${TC.purple}20` }]}>
              <Text style={[styles.influenceAvatarMoreText, { color: TC.purple }]}>+{influence.topContributors.length}</Text>
            </View>
          </View>
        </View>
      )}
    </GlassCard>
  </Animated.View>
));

// NEW FEATURE 3: CONTENT HIGHLIGHTS CARD
const ContentHighlightsCard = React.memo(({ highlights, isDark, onPostPress }: any) => {
  if (!highlights.topPost) return null;
  const topicColor = TOPIC_COLORS[highlights.topPost.topicId] || TC.primary;
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.highlightsHeader}>
          <Text style={[styles.highlightsTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Content Highlights</Text>
          <View style={[styles.highlightsBadge, { backgroundColor: `${topicColor}12` }]}>
            <Text style={[styles.highlightsBadgeText, { color: topicColor }]}>Top Post</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onPostPress(highlights.topPost)} style={styles.highlightsPostCard}>
          <View style={styles.highlightsPostHeader}>
            <View style={[styles.highlightsTopicDot, { backgroundColor: topicColor }]} />
            <Text style={[styles.highlightsTopicText, { color: topicColor }]}>{highlights.topPost.topic}</Text>
            <Text style={styles.highlightsPostTime}>{highlights.topPost.time}</Text>
          </View>
          <Text style={[styles.highlightsPostContent, isDark && styles.textDark]} numberOfLines={2}>{highlights.topPost.content}</Text>
          <View style={styles.highlightsPostStats}>
            <View style={styles.highlightsPostStat}>
              <Ionicons name="heart" size={14} color={highlights.topPost.isLiked ? TC.danger : '#94a3b8'} />
              <Text style={[styles.highlightsPostStatText, { color: highlights.topPost.isLiked ? TC.danger : '#94a3b8' }]}>{highlights.topPost.likes}</Text>
            </View>
            <View style={styles.highlightsPostStat}>
              <Ionicons name="chatbubble" size={14} color={TC.primary} />
              <Text style={styles.highlightsPostStatText}>{highlights.topPost.commentsCount}</Text>
            </View>
            <View style={styles.highlightsPostStat}>
              <Ionicons name="eye" size={14} color="#94a3b8" />
              <Text style={styles.highlightsPostStatText}>{highlights.topPost.viewCount}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={[styles.highlightsDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        <View style={styles.highlightsMetrics}>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.secondary }]}>{highlights.mostLiked}</Text>
            <Text style={[styles.highlightsMetricLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Most Liked</Text>
          </View>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.info }]}>{highlights.mostCommented}</Text>
            <Text style={[styles.highlightsMetricLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Most Comments</Text>
          </View>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.success }]}>{highlights.avgEngagement}%</Text>
            <Text style={[styles.highlightsMetricLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Avg Engagement</Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// NEW FEATURE 4: ACTIVITY PATTERN MINI GRAPH
const ActivityPatternGraph = React.memo(({ data, isDark }: any) => {
  const maxVal = Math.max(...data.map((d: any) => d.activity), 1);
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.patternHeader}>
          <Text style={[styles.patternTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Activity Pattern</Text>
          <View style={[styles.patternLiveBadge, { backgroundColor: '#10b98115' }]}>
            <View style={styles.patternLiveDot} />
            <Text style={[styles.patternLiveText, { color: '#10b981' }]}>Weekly</Text>
          </View>
        </View>
        <View style={styles.patternBars}>
          {data.map((point: any, i: number) => {
            const height = (point.activity / maxVal) * 60;
            return (
              <View key={i} style={styles.patternBarWrap}>
                <View style={[styles.patternBar, { height: Math.max(height, 4), backgroundColor: point.activity > maxVal * 0.7 ? TC.primary : point.activity > maxVal * 0.3 ? `${TC.primary}80` : `${TC.primary}40` }]} />
                <Text style={[styles.patternBarLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{point.day}</Text>
                {point.posts > 0 && (
                  <View style={[styles.patternPostBadge, { backgroundColor: `${TC.accent}20` }]}>
                    <Text style={[styles.patternPostBadgeText, { color: TC.accent }]}>{point.posts}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// NEW FEATURE 5: MUTUAL CONNECTIONS
const MutualConnections = React.memo(({ connections, isDark, onPress }: any) => {
  if (connections.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Mutual Connections" subtitle="Parents you both know" isDark={isDark} />
      <View style={styles.mutualScroll}>
        {connections.map((conn: any) => (
          <TouchableOpacity key={conn.id} onPress={() => onPress(conn.id)} style={styles.mutualCard}>
            <LinearGradient colors={[TC.primary + '08', TC.primary + '02']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <SafeAvatar avatar={conn.avatar} size={48} fallbackIcon="person" fallbackColor={TC.primary} borderColor={TC.primary} borderWidth={2} />
            <Text style={[styles.mutualName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{conn.name}</Text>
            <Text style={[styles.mutualCount, { color: isDark ? '#94a3b8' : '#64748b' }]}>{conn.mutualCount} mutual</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

// NEW FEATURE 6: SMART ACTIONS
const SmartActions = React.memo(({ actions, isDark }: any) => {
  if (actions.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Smart Actions" subtitle="Quick ways to connect" isDark={isDark} />
      <View style={styles.actionsGrid}>
        {actions.map((action: any) => (
          <TouchableOpacity key={action.id} onPress={action.action} style={styles.actionCard}>
            <LinearGradient colors={[action.color + '12', action.color + '04']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={[styles.actionIconBg, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={[styles.actionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{action.title}</Text>
            <Text style={[styles.actionDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>{action.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

// ACHIEVEMENT BADGE
const AchievementBadge = React.memo(({ achievement, isDark }: any) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary, desc: '' };
  return (
    <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}08` }]}>
      <View style={[styles.achievementIconBg, { backgroundColor: `${badge.color}12` }]}>
        <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      </View>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
        <Text style={[styles.achievementDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>{badge.desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color={badge.color} style={{ opacity: 0.5 }} />
    </View>
  );
});

// POST CARD
const PostCard = React.memo(({ post, index, isDark, onPress }: any) => {
  const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
  return (
    <GlassCard style={styles.postCard} delay={index * 50} onPress={onPress}>
      <View style={styles.postHeader}>
        <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
        <Text style={[styles.topicText, { color: topicColor }]}>{post.topic}</Text>
        <Text style={styles.postTime}>{post.time}</Text>
      </View>
      <Text style={[styles.postContent, isDark && styles.textDark]} numberOfLines={3}>{post.content}</Text>
      {post.images && post.images.length > 0 && (
        <View style={styles.postImageContainer}>
          <Animated.Image source={{ uri: post.images[0] }} style={styles.postImage} resizeMode="cover" entering={FadeIn.delay(100)} />
        </View>
      )}
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={14} color={post.isLiked ? TC.danger : '#94a3b8'} />
          <Text style={[styles.postStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}>{post.likes}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="chatbubble" size={14} color={TC.primary} />
          <Text style={styles.postStatText}>{post.commentsCount}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="repeat" size={14} color={TC.success} />
          <Text style={styles.postStatText}>{post.reposts}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="eye" size={14} color="#94a3b8" />
          <Text style={styles.postStatText}>{post.viewCount}</Text>
        </View>
      </View>
    </GlassCard>
  );
});

// MAIN SCREEN
export default function CommunityMemberProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const {
    currentUser, getUserById, getUserPosts, followUser, unfollowUser,
    isFollowing, blockUser, isUserBlocked, getFollowers, getFollowing,
    likePost,
  } = useCommunity();
  const { themeColors, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'achievements'>('posts');

  const isOwnProfile = currentUser?.id === userId;

  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], 'clamp'),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 140], [-10, 0], 'clamp') }],
  }));

  const bannerGradient = useMemo(() => {
    if (!user) return ['#667eea', '#764ba2'] as [string, string];
    const colors = user.selectedTopics?.map(t => TOPIC_COLORS[t] || TC.primary) || [TC.primary];
    return [colors[0] || TC.primary, colors[1] || TC.primaryDark] as [string, string];
  }, [user]);

  // NEW FEATURE MOCK DATA
  const engagementInsights = useMemo(() => [
    { icon: '❤️', label: 'Likes', value: userPosts.reduce((sum, p) => sum + p.likes, 0), color: TC.danger, trend: 12 },
    { icon: '💬', label: 'Comments', value: userPosts.reduce((sum, p) => sum + p.commentsCount, 0), color: TC.info, trend: 8 },
    { icon: '👁️', label: 'Views', value: userPosts.reduce((sum, p) => sum + p.viewCount, 0), color: TC.primary, trend: -3 },
  ], [userPosts]);

  const communityInfluence = useMemo(() => ({
    score: user?.stats?.influenceScore || 72,
    rank: user?.stats?.rank || 'Silver Parent',
    percentile: user?.stats?.percentile || 18,
    topContributors: [
      { id: '1', name: 'Sarah M.', avatar: '' },
      { id: '2', name: 'John D.', avatar: '' },
      { id: '3', name: 'Emma W.', avatar: '' },
    ],
  }), [user]);

  const contentHighlights = useMemo(() => {
    const sorted = [...userPosts].sort((a, b) => b.likes - a.likes);
    return {
      topPost: sorted[0] || null,
      mostLiked: sorted[0]?.likes || 0,
      mostCommented: Math.max(...userPosts.map(p => p.commentsCount), 0),
      avgEngagement: userPosts.length > 0 ? Math.round(userPosts.reduce((s, p) => s + p.likes + p.commentsCount, 0) / userPosts.length) : 0,
    };
  }, [userPosts]);

  const activityPattern = useMemo(() => [
    { day: 'M', activity: 3, posts: 1 }, { day: 'T', activity: 7, posts: 2 }, { day: 'W', activity: 5, posts: 1 },
    { day: 'T', activity: 9, posts: 3 }, { day: 'F', activity: 4, posts: 1 }, { day: 'S', activity: 12, posts: 4 }, { day: 'S', activity: 8, posts: 2 },
  ], []);

  const mutualConnections = useMemo(() => [
    { id: '1', name: 'Sarah M.', avatar: '', mutualCount: 12 },
    { id: '2', name: 'John D.', avatar: '', mutualCount: 8 },
    { id: '3', name: 'Emma W.', avatar: '', mutualCount: 5 },
    { id: '4', name: 'Mike R.', avatar: '', mutualCount: 3 },
  ], []);

  const smartActions = useMemo(() => {
    const actions: any[] = [];
    if (!isFollowingUser && !isBlocked) {
      actions.push({ id: 'follow', title: 'Follow', description: 'See their posts in your feed', icon: 'person-add', color: TC.primary, action: handleFollowToggle });
    }
    if (!isBlocked) {
      actions.push({ id: 'message', title: 'Message', description: 'Start a private conversation', icon: 'mail', color: TC.secondary, action: handleMessage });
    }
    actions.push({ id: 'share', title: 'Share Profile', description: 'Invite others to connect', icon: 'share-social', color: TC.success, action: handleShareProfile });
    return actions;
  }, [isFollowingUser, isBlocked]);

  useEffect(() => { loadUserData(); }, [userId]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const targetUser = getUserById(userId);
      if (targetUser) {
        setUser(targetUser);
        const posts = getUserPosts(userId);
        setUserPosts(posts);
        setIsFollowingUser(isFollowing(userId));
        setIsBlocked(isUserBlocked(userId));
        const followers = await getFollowers(userId);
        const following = await getFollowing(userId);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      } else {
        sweetAlert.alert('Not Found', 'User not found', 'warning');
        navigation.goBack();
      }
    } catch (error) {
      sweetAlert.error('Error', 'Failed to load profile');
    }
    setIsLoading(false);
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile || !user) return;
    triggerHaptic('medium');
    try {
      if (isFollowingUser) {
        await unfollowUser(userId);
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowingUser(false);
        sweetAlert.toast('Unfollowed', `You unfollowed ${user.displayName}`);
      } else {
        await followUser(userId);
        setFollowerCount(prev => prev + 1);
        setIsFollowingUser(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sweetAlert.toast('Following', `Now following ${user.displayName}`);
      }
    } catch (error) {
      sweetAlert.error('Error', 'Failed to update follow status');
    }
  };

  const handleMessage = () => {
    if (!user || isBlocked) return;
    triggerHaptic('light');
    navigation.navigate('Chat' as never, { userId });
  };

  const handleMoreOptions = () => {
    if (!user) return;
    sweetAlert.confirm(user.displayName || 'User', 'What would you like to do?', () => handleShareProfile(), undefined, 'Share Profile', 'Cancel');
  };

  const handleShareProfile = async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({ message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`, title: `${user.displayName}'s Profile` });
    } catch (error) { console.error('Share error:', error); }
  };

  const handleBlockToggle = async () => {
    if (!user) return;
    await blockUser(userId);
    setIsBlocked(!isBlocked);
    if (!isBlocked) { sweetAlert.alert('Blocked', `${user.displayName} has been blocked`, 'warning'); setIsFollowingUser(false); }
    else { sweetAlert.success('Unblocked', `${user.displayName} has been unblocked`); }
  };

  const handleLikePost = async (postId: string) => {
    triggerHaptic('light');
    await likePost(postId);
    const posts = getUserPosts(userId);
    setUserPosts(posts);
  };

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeAvatar avatar={user?.avatar} size={32} fallbackIcon="person" fallbackColor={themeColors.primary} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>{user?.displayName || 'Member Profile'}</Text>
        </View>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!user) return null;
    const isOnline = user.onlineStatus === 'online';
    return (
      <Animated.View entering={FadeInUp.springify()} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <LinearGradient colors={bannerGradient} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <SafeAvatar avatar={user.avatar} size={100} fallbackIcon="person" fallbackColor={themeColors.primary} fallbackBgColor={`${themeColors.primary}20`} borderWidth={4} borderColor="#fff" showEditBadge={false} />
              {isOnline && <View style={styles.onlineIndicator}><View style={styles.onlineDot} /></View>}
            </View>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, isDark && styles.textDark]}>{user.displayName}</Text>
              {user.isVerified && <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
            </View>
            <Text style={styles.profileHandle}>{user.handle}</Text>
            {user.bio && <Text style={[styles.profileBio, isDark && styles.textMuted]} numberOfLines={2}>{user.bio}</Text>}
            {user.country && <View style={styles.locationRow}><Ionicons name="location-outline" size={14} color="#94a3b8" /><Text style={styles.locationText}>{user.country}</Text></View>}
            <View style={styles.statsPillsRow}>
              <StatPill icon="📝" value={userPosts.length} label="Posts" color={TC.primary} />
              <StatPill icon="👥" value={followerCount} label="Followers" color={TC.secondary} />
              <StatPill icon="👤" value={followingCount} label="Following" color={TC.info} />
              <StatPill icon="💙" value={user.stats?.helpful || 0} label="Helpful" color={TC.success} />
            </View>
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.followBtn, isFollowingUser && styles.followingBtn, isBlocked && styles.blockedBtn]} onPress={handleFollowToggle} disabled={isBlocked}>
                  <Text style={[styles.followBtnText, isFollowingUser && styles.followingBtnText, isBlocked && styles.blockedBtnText]}>{isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.messageBtn, isBlocked && styles.messageBtnDisabled]} onPress={handleMessage} disabled={isBlocked}>
                  <Ionicons name="mail-outline" size={16} color={isBlocked ? '#94a3b8' : TC.primary} />
                  <Text style={[styles.messageBtnText, isBlocked && { color: '#94a3b8' }]}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'posts', icon: 'document-text-outline', label: 'Posts' },
          { id: 'about', icon: 'information-circle-outline', label: 'About' },
          { id: 'achievements', icon: 'trophy-outline', label: 'Badges' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => handleTabChange(tab.id as typeof activeTab)}>
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons name={tab.icon as any} size={18} color={isActive ? TC.primary : (isDark ? '#94a3b8' : '#64748b')} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, isDark && !isActive && styles.textMuted]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <EngagementInsightsCard insights={engagementInsights} isDark={isDark} />
      <CommunityInfluenceCard influence={communityInfluence} isDark={isDark} />
      <ContentHighlightsCard highlights={contentHighlights} isDark={isDark} onPostPress={(post: Post) => navigation.navigate('PostDetail' as never, { postId: post.id })} />
      <ActivityPatternGraph data={activityPattern} isDark={isDark} />
      <MutualConnections connections={mutualConnections} isDark={isDark} onPress={(id: string) => navigation.navigate('CommunityMemberProfile' as never, { userId: id })} />
      <SmartActions actions={smartActions} isDark={isDark} />
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color={TC.primary} />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>All Threads</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{userPosts.length} posts</Text>
        </View>
      </View>
      {userPosts.length === 0 ? (
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}><Ionicons name="document-text-outline" size={32} color={TC.primary} /></View>
          <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No threads yet</Text>
          <Text style={styles.emptyText}>This parent has not shared any stories yet.</Text>
        </GlassCard>
      ) : (
        <View style={styles.postsList}>
          {userPosts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} isDark={isDark} onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id })} />
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderAboutTab = () => {
    if (!user) return null;
    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <GlassCard style={styles.formCard} delay={100}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>About</Text>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: `${TC.primary}20` }]}><Ionicons name="time-outline" size={20} color={TC.primary} /></View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Member Since</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>2024</Text>
            </View>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="flame-outline" size={20} color="#f59e0b" /></View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Active Streak</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.streakDays || 0} days</Text>
            </View>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}><Ionicons name="heart-outline" size={20} color="#10b981" /></View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Total Likes Received</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.totalLikes || 0}</Text>
            </View>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#8b5cf620' }]}><Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" /></View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Total Comments</Text>
              <Text style={[styles.infoValue, isDark && styles.textDark]}>{user.stats?.totalComments || 0}</Text>
            </View>
          </View>
        </GlassCard>
        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassCard style={styles.formCard} delay={200}>
            <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Interested In</Text>
            <View style={styles.topicsWrap}>
              {user.selectedTopics.map((topicId) => (
                <View key={topicId} style={[styles.topicChip, { backgroundColor: `${TOPIC_COLORS[topicId] || TC.primary}20` }]}>
                  <Text style={[styles.topicChipText, { color: TOPIC_COLORS[topicId] || TC.primary }]}>{topicId.replace('topic_', 'Topic ')}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        )}
      </Animated.View>
    );
  };

  const renderAchievementsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color={TC.primary} />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{user?.achievements?.length || 0} earned</Text>
        </View>
      </View>
      <GlassCard style={styles.achievementsCard} delay={100}>
        {user?.achievements && user.achievements.length > 0 ? (
          user.achievements.map((achievement) => <AchievementBadge key={achievement} achievement={achievement} isDark={isDark} />)
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color={TC.primary} />
            <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No achievements yet</Text>
            <Text style={styles.emptyText}>This parent is just getting started!</Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <Ionicons name="person-outline" size={64} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />
      {renderStickyHeader()}
      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        {renderTabs()}
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'about' && renderAboutTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// STYLES — Completely Redesigned (Matches Growth Dashboard)
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // Sticky Header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DESIGN.spacing.lg, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: DESIGN.radius.md, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, maxWidth: 180 },

  // Profile Hero
  profileHero: { paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  banner: { height: 120, borderRadius: DESIGN.radius.xl, marginBottom: -50, marginHorizontal: -20, marginTop: -20 },
  profileHeroContent: { position: 'relative', zIndex: 2 },
  avatarSection: { alignItems: 'center', marginBottom: 12 },
  avatarWrapper: { position: 'relative' },
  onlineIndicator: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: DESIGN.radius.md, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  profileInfo: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  profileHandle: { fontSize: 14, color: '#64748b', marginTop: 4, fontWeight: '600' },
  profileBio: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 8, paddingHorizontal: DESIGN.spacing.xl, lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // Stats Pills
  statsPillsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 16, paddingHorizontal: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.5)' },
  statPillIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statPillEmoji: { fontSize: 16 },
  statPillText: { gap: 0 },
  statPillValue: { fontSize: 16, fontWeight: '800' },
  statPillLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Action Buttons
  actionButtons: { flexDirection: 'row', gap: DESIGN.spacing.lg, marginTop: 20, width: '100%', paddingHorizontal: 20 },
  followBtn: { flex: 1, backgroundColor: '#667eea', borderRadius: DESIGN.radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  blockedBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  followBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: '#64748b' },
  blockedBtnText: { color: '#ef4444' },
  messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(102,126,234,0.1)', borderRadius: DESIGN.radius.md, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(102,126,234,0.2)' },
  messageBtnDisabled: { opacity: 0.5 },
  messageBtnText: { fontSize: 15, fontWeight: '700', color: '#667eea' },

  // Tab Bar
  tabBarContainer: { paddingHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: DESIGN.radius.lg, padding: 4, gap: 4, ...DESIGN.shadow.md },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.75)' },
  tab: { flex: 1, height: 44 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', letterSpacing: -0.2 },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },

  // Glass Card
  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', ...DESIGN.shadow.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // NEW FEATURE 1: Engagement Insights
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  insightsIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightsTitleWrap: { flex: 1 },
  insightsTitle: { fontSize: 16, fontWeight: '800' },
  insightsSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  insightsGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  insightItem: { flex: 1, alignItems: 'center', gap: 4 },
  insightItemIcon: { fontSize: 20 },
  insightItemValue: { fontSize: 20, fontWeight: '800' },
  insightItemLabel: { fontSize: 11, fontWeight: '600' },
  insightTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  insightTrendText: { fontSize: 11, fontWeight: '700' },

  // NEW FEATURE 2: Community Influence
  influenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  influenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  influenceTitleWrap: { flex: 1 },
  influenceTitle: { fontSize: 16, fontWeight: '800' },
  influenceSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  influenceScoreBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  influenceScoreText: { fontSize: 20, fontWeight: '800' },
  influenceRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  influenceRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  influenceRankText: { fontSize: 13, fontWeight: '800' },
  influenceProgressWrap: { flex: 1, gap: 6 },
  influenceProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  influenceProgressLabel: { fontSize: 12, fontWeight: '600' },
  influenceProgressValue: { fontSize: 12, fontWeight: '700' },
  influenceProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  influenceProgressBarFill: { height: '100%', borderRadius: 3 },
  influenceContributors: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  influenceContributorsLabel: { fontSize: 12, fontWeight: '600' },
  influenceAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  influenceAvatar: { borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  influenceAvatarMore: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: -10 },
  influenceAvatarMoreText: { fontSize: 10, fontWeight: '800' },

  // NEW FEATURE 3: Content Highlights
  highlightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  highlightsTitle: { fontSize: 16, fontWeight: '800' },
  highlightsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  highlightsBadgeText: { fontSize: 12, fontWeight: '700' },
  highlightsPostCard: { paddingHorizontal: 16, paddingBottom: 16 },
  highlightsPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  highlightsTopicDot: { width: 8, height: 8, borderRadius: 4 },
  highlightsTopicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  highlightsPostTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  highlightsPostContent: { fontSize: 14, fontWeight: '600', color: '#1e293b', lineHeight: 20, marginBottom: 10 },
  highlightsPostStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  highlightsPostStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  highlightsPostStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  highlightsDivider: { height: 1, marginHorizontal: 16 },
  highlightsMetrics: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  highlightsMetric: { flex: 1, alignItems: 'center', gap: 2 },
  highlightsMetricValue: { fontSize: 18, fontWeight: '800' },
  highlightsMetricLabel: { fontSize: 11, fontWeight: '600' },

  // NEW FEATURE 4: Activity Pattern
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  patternTitle: { fontSize: 16, fontWeight: '800' },
  patternLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  patternLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  patternLiveText: { fontSize: 10, fontWeight: '700' },
  patternBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  patternBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
  patternBar: { width: 20, borderRadius: 6 },
  patternBarLabel: { fontSize: 10, fontWeight: '600' },
  patternPostBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  patternPostBadgeText: { fontSize: 9, fontWeight: '700' },

  // NEW FEATURE 5: Mutual Connections
  mutualScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  mutualCard: { width: 100, padding: 12, borderRadius: 16, overflow: 'hidden', alignItems: 'center', gap: 6, ...DESIGN.shadow.md },
  mutualName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  mutualCount: { fontSize: 10, fontWeight: '600' },

  // NEW FEATURE 6: Smart Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  actionCard: { width: (SCREEN_W - 72) / 3, padding: 14, borderRadius: 16, overflow: 'hidden', alignItems: 'center', gap: 8, ...DESIGN.shadow.md },
  actionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 13, fontWeight: '700' },
  actionDesc: { fontSize: 10, fontWeight: '500', textAlign: 'center', lineHeight: 14 },

  // Achievement Badge
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500' },

  // Post Card
  postCard: { padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  topicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  postTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  postContent: { fontSize: 15, fontWeight: '600', color: '#1e293b', lineHeight: 22, marginBottom: 12 },
  postImageContainer: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', marginBottom: 12 },
  postImage: { width: '100%', height: 180, borderRadius: 16 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

  // Empty State
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: DESIGN.radius.xl, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  // About Tab
  formCard: { padding: 0, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, paddingHorizontal: DESIGN.spacing.xl, paddingTop: 20, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  infoIcon: { width: 40, height: 40, borderRadius: DESIGN.radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2, color: '#64748b' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  infoDivider: { height: 1, marginHorizontal: 20 },

  // Topics
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },

  // Achievements
  achievementsCard: { padding: 20, gap: 12 },

  // Tab Panel
  tabPanel: { paddingBottom: 20 },
  postsList: { gap: 10 },

  // Retry
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});