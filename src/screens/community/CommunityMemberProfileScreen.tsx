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
  Extrapolation,
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
  primary: '#6366f1', primaryDark: '#8b5cf6', secondary: '#ec4899', accent: '#f59e0b',
  success: '#10b981', warning: '#fbbf24', danger: '#ef4444', info: '#3b82f6', purple: '#8b5cf6', teal: '#14b8a6',
};

const TOPIC_COLORS: Record<string, string> = {
  topic_1: '#6366f1', topic_2: '#10b981', topic_3: '#ec4899',
  topic_4: '#f59e0b', topic_5: '#fc5c7d', topic_6: '#8b5cf6',
  topic_7: '#f093fb', topic_8: '#4facfe', topic_9: '#ec4899',
  topic_10: '#43e97b', topic_11: '#ec4899', topic_12: '#6366f1',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#f59e0b', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#8b5cf6', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

interface EngagementInsight { label: string; value: number; icon: string; color: string; trend: number; }
interface CommunityInfluence { score: number; rank: string; percentile: number; topContributors: { id: string; name: string; avatar: string }[]; }
interface ContentHighlights { topPost: Post | null; mostLiked: number; mostCommented: number; avgEngagement: number; }
interface ActivityPattern { day: string; activity: number; posts: number; }
interface MutualConnection { id: string; name: string; avatar: string; mutualCount: number; }
interface SmartAction { id: string; title: string; description: string; icon: string; color: string; action: () => void; }
interface ParentingTip { id: string; emoji: string; title: string; tip: string; color: string; }
interface PostTopic { topicId: string; count: number; color: string; label: string; percentage: number; }

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: any) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: TC.primary, borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));

const StatPill = React.memo(({ icon, value, label, color }: any) => (
  <View style={styles.statPill}>
    <LinearGradient colors={[`${color}15`, `${color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    <View style={[styles.statPillIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.statPillEmoji}>{icon}</Text>
    </View>
    <View style={styles.statPillText}>
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  </View>
));

const EngagementInsightsCard = React.memo(({ insights }: any) => (
  <Animated.View entering={FadeInUp.delay(100).springify()}>
    <GlassCard>
      <View style={styles.insightsHeader}>
        <View style={[styles.insightsIconBg, { backgroundColor: `${TC.primary}15` }]}>
          <Ionicons name="analytics" size={20} color={TC.primary} />
        </View>
        <View style={styles.insightsTitleWrap}>
          <Text style={styles.insightsTitle}>Engagement Insights</Text>
          <Text style={styles.insightsSubtitle}>How this parent connects</Text>
        </View>
      </View>
      <View style={styles.insightsGrid}>
        {insights.map((insight: any, i: number) => (
          <View key={insight.label} style={[styles.insightItem, i < insights.length - 1 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={styles.insightItemIcon}>{insight.icon}</Text>
            <Text style={[styles.insightItemValue, { color: insight.color }]}>{insight.value}</Text>
            <Text style={styles.insightItemLabel}>{insight.label}</Text>
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

const CommunityInfluenceCard = React.memo(({ influence }: any) => (
  <Animated.View entering={FadeInUp.delay(150).springify()}>
    <GlassCard>
      <View style={styles.influenceHeader}>
        <View style={[styles.influenceIconBg, { backgroundColor: `${TC.purple}15` }]}>
          <Ionicons name="trophy" size={20} color={TC.purple} />
        </View>
        <View style={styles.influenceTitleWrap}>
          <Text style={styles.influenceTitle}>Community Influence</Text>
          <Text style={styles.influenceSubtitle}>Top {influence.percentile}% of members</Text>
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
            <Text style={styles.influenceProgressLabel}>Next rank</Text>
            <Text style={[styles.influenceProgressValue, { color: TC.purple }]}>{influence.percentile}%</Text>
          </View>
          <View style={styles.influenceProgressBarBg}>
            <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.influenceProgressBarFill, { width: `${influence.percentile}%`, backgroundColor: TC.purple }]} />
          </View>
        </View>
      </View>
      {influence.topContributors.length > 0 && (
        <View style={styles.influenceContributors}>
          <Text style={styles.influenceContributorsLabel}>Connected with</Text>
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

const ContentHighlightsCard = React.memo(({ highlights, onPostPress }: any) => {
  if (!highlights.topPost) return null;
  const topicColor = TOPIC_COLORS[highlights.topPost.topicId] || TC.primary;
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.highlightsHeader}>
          <Text style={styles.highlightsTitle}>Content Highlights</Text>
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
          <Text style={styles.highlightsPostContent} numberOfLines={2}>{highlights.topPost.content}</Text>
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
        <View style={styles.highlightsDivider} />
        <View style={styles.highlightsMetrics}>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.secondary }]}>{highlights.mostLiked}</Text>
            <Text style={styles.highlightsMetricLabel}>Most Liked</Text>
          </View>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.info }]}>{highlights.mostCommented}</Text>
            <Text style={styles.highlightsMetricLabel}>Most Comments</Text>
          </View>
          <View style={styles.highlightsMetric}>
            <Text style={[styles.highlightsMetricValue, { color: TC.success }]}>{highlights.avgEngagement}%</Text>
            <Text style={styles.highlightsMetricLabel}>Avg Engagement</Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ActivityPatternGraph = React.memo(({ data }: any) => {
  const maxVal = Math.max(...data.map((d: any) => d.activity), 1);
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.patternHeader}>
          <Text style={styles.patternTitle}>Activity Pattern</Text>
          <View style={styles.patternLiveBadge}>
            <View style={styles.patternLiveDot} />
            <Text style={styles.patternLiveText}>Weekly</Text>
          </View>
        </View>
        <View style={styles.patternBars}>
          {data.map((point: any, i: number) => {
            const height = (point.activity / maxVal) * 60;
            return (
              <View key={i} style={styles.patternBarWrap}>
                <View style={[styles.patternBar, { height: Math.max(height, 4), backgroundColor: point.activity > maxVal * 0.7 ? TC.primary : point.activity > maxVal * 0.3 ? `${TC.primary}80` : `${TC.primary}40` }]} />
                <Text style={styles.patternBarLabel}>{point.day}</Text>
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

const MutualConnections = React.memo(({ connections, onPress }: any) => {
  if (connections.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Mutual Connections" subtitle="Parents you both know" />
      <View style={styles.mutualScroll}>
        {connections.map((conn: any) => (
          <TouchableOpacity key={conn.id} onPress={() => onPress(conn.id)} style={styles.mutualCard}>
            <LinearGradient colors={[TC.primary + '08', TC.primary + '02']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <SafeAvatar avatar={conn.avatar} size={48} fallbackIcon="person" fallbackColor={TC.primary} borderColor={TC.primary} borderWidth={2} />
            <Text style={styles.mutualName} numberOfLines={1}>{conn.name}</Text>
            <Text style={styles.mutualCount}>{conn.mutualCount} mutual</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

const SmartActions = React.memo(({ actions }: any) => {
  if (actions.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Smart Actions" subtitle="Quick ways to connect" />
      <View style={styles.actionsGrid}>
        {actions.map((action: any) => (
          <TouchableOpacity key={action.id} onPress={action.action} style={styles.actionCard}>
            <LinearGradient colors={[action.color + '12', action.color + '04']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={[styles.actionIconBg, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionDesc} numberOfLines={2}>{action.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

const ParentingTipsEngine = React.memo(({ userPosts, member }: any) => {
  const tips = useMemo(() => {
    const items: ParentingTip[] = [];
    const topicCounts = userPosts.reduce((acc: any, p: any) => { acc[p.topicId] = (acc[p.topicId] || 0) + 1; return acc; }, {});
    const topTopic = Object.entries(topicCounts).sort(([,a]: any, [,b]: any) => b - a)[0]?.[0] as string;

    if (topTopic === 'topic_1') items.push({ id: '1', emoji: '📚', title: 'Learning Focus', tip: 'You share lots of educational content. Try creating a weekly learning schedule for your little one.', color: '#6366f1' });
    if (topTopic === 'topic_3') items.push({ id: '2', emoji: '💤', title: 'Sleep Expert', tip: 'Your sleep tips are popular! Consider writing a guide on bedtime routines.', color: '#8b5cf6' });
    if (topTopic === 'topic_5') items.push({ id: '3', emoji: '🍼', title: 'Nutrition Guide', tip: 'Your feeding posts get great engagement. Share meal prep ideas!', color: '#ec4899' });
    if (userPosts.length > 20) items.push({ id: '4', emoji: '🌟', title: 'Top Contributor', tip: "You're a pillar of the community! Host a Q&A session this week.", color: '#f59e0b' });
    if (userPosts.length < 3) items.push({ id: '5', emoji: '💡', title: 'Get Started', tip: 'Share your first parenting milestone to connect with other parents.', color: '#10b981' });
    if (items.length === 0) items.push({ id: '6', emoji: '💬', title: 'Engage More', tip: 'Comment on 3 posts this week to boost your community presence.', color: '#3b82f6' });
    return items.slice(0, 2);
  }, [userPosts, member]);

  if (tips.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Parenting Insights" subtitle="Personalized for this parent" />
      <View style={styles.tipsList}>
        {tips.map((tip) => (
          <View key={tip.id} style={[styles.tipCard, { borderLeftColor: tip.color }]}>
            <View style={[styles.tipIconBg, { backgroundColor: `${tip.color}12` }]}>
              <Text style={styles.tipEmoji}>{tip.emoji}</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.tip}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const TopicBreakdown = React.memo(({ userPosts }: any) => {
  const topics = useMemo(() => {
    const counts = userPosts.reduce((acc: any, p: any) => { acc[p.topicId] = (acc[p.topicId] || 0) + 1; return acc; }, {});
    const total = userPosts.length;
    return Object.entries(counts).map(([topicId, count]: [string, any]) => ({
      topicId,
      count,
      color: TOPIC_COLORS[topicId] || TC.primary,
      label: topicId.replace('topic_', 'Topic '),
      percentage: Math.round((count / total) * 100),
    })).sort((a: any, b: any) => b.count - a.count).slice(0, 4);
  }, [userPosts]);

  if (topics.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader title="Topic Breakdown" subtitle="What they talk about most" />
      <GlassCard>
        <View style={styles.topicBreakdown}>
          {topics.map((topic: PostTopic) => (
            <View key={topic.topicId} style={styles.topicBreakdownRow}>
              <View style={styles.topicBreakdownLeft}>
                <View style={[styles.topicBreakdownDot, { backgroundColor: topic.color }]} />
                <Text style={styles.topicBreakdownLabel}>{topic.label}</Text>
              </View>
              <View style={styles.topicBreakdownRight}>
                <View style={styles.topicBreakdownBarBg}>
                  <View style={[styles.topicBreakdownBarFill, { width: `${topic.percentage}%`, backgroundColor: topic.color }]} />
                </View>
                <Text style={[styles.topicBreakdownCount, { color: topic.color }]}>{topic.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const InteractionHeatMap = React.memo(({ userPosts }: any) => {
  const heatData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    userPosts.forEach((p: any) => {
      const hour = new Date(p.createdAt || Date.now()).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    const maxVal = Math.max(...Object.values(hours), 1);
    return Object.entries(hours).map(([hour, count]) => ({
      hour: parseInt(hour),
      activity: count,
      intensity: count / maxVal,
    })).slice(6, 22);
  }, [userPosts]);

  if (heatData.length === 0 || userPosts.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(500).springify()}>
      <SectionHeader title="Active Hours" subtitle="When they engage most" />
      <GlassCard>
        <View style={styles.heatMapContainer}>
          <View style={styles.heatMapRow}>
            {heatData.map((item) => (
              <View key={item.hour} style={styles.heatMapCell}>
                <View style={[styles.heatMapBar, { 
                  height: Math.max(4, item.intensity * 50),
                  backgroundColor: item.intensity > 0.7 ? TC.primary : item.intensity > 0.3 ? `${TC.primary}80` : `${TC.primary}30`,
                }]} />
                <Text style={styles.heatMapLabel}>{item.hour % 12 || 12}{item.hour >= 12 ? 'p' : 'a'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heatMapLegend}>
            <Text style={styles.heatMapLegendText}>Low</Text>
            <View style={[styles.heatMapLegendDot, { backgroundColor: `${TC.primary}30` }]} />
            <View style={[styles.heatMapLegendDot, { backgroundColor: `${TC.primary}80` }]} />
            <View style={[styles.heatMapLegendDot, { backgroundColor: TC.primary }]} />
            <Text style={styles.heatMapLegendText}>High</Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ContributionStreakCard = React.memo(({ userPosts }: any) => {
  const streak = useMemo(() => {
    const now = new Date();
    const weeks: boolean[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const hasActivity = userPosts.some((p: any) => {
        const d = new Date(p.createdAt || Date.now());
        return d >= weekStart && d < weekEnd;
      });
      weeks.push(hasActivity);
    }
    const current = weeks.reduce((acc, active, i) => {
      if (!active) return 0;
      return acc + 1;
    }, 0);
    const longest = weeks.reduce((acc, active, i, arr) => {
      if (!active) return acc;
      let count = 1;
      for (let j = i + 1; j < arr.length && arr[j]; j++) count++;
      return Math.max(acc, count);
    }, 0);
    return { current, longest, weeks };
  }, [userPosts]);

  return (
    <Animated.View entering={FadeInUp.delay(550).springify()}>
      <GlassCard>
        <View style={styles.streakHeader}>
          <View>
            <Text style={styles.streakTitle}>Contribution Streak</Text>
            <Text style={styles.streakSubtitle}>Last 12 weeks</Text>
          </View>
          <View style={styles.streakNumbers}>
            <View style={styles.streakNumberItem}>
              <Text style={styles.streakNumberValue}>{streak.current}</Text>
              <Text style={styles.streakNumberLabel}>Current</Text>
            </View>
            <View style={styles.streakNumberItem}>
              <Text style={styles.streakNumberValue}>{streak.longest}</Text>
              <Text style={styles.streakNumberLabel}>Best</Text>
            </View>
          </View>
        </View>
        <View style={styles.streakGrid}>
          {streak.weeks.map((active, i) => (
            <View key={i} style={[styles.streakCell, active && { backgroundColor: TC.primary }]} />
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const SocialGraphCard = React.memo(({ userPosts, user }: any) => {
  const data = useMemo(() => {
    const likes = userPosts.reduce((s: number, p: any) => s + p.likes, 0);
    const comments = userPosts.reduce((s: number, p: any) => s + p.commentsCount, 0);
    const views = userPosts.reduce((s: number, p: any) => s + p.viewCount, 0);
    const posts = userPosts.length;
    const maxVal = Math.max(likes, comments, views, posts, 1);
    return [
      { name: 'Posts', value: Math.round((posts / maxVal) * 100), color: TC.primary },
      { name: 'Likes', value: Math.round((likes / maxVal) * 100), color: TC.secondary },
      { name: 'Comments', value: Math.round((comments / maxVal) * 100), color: TC.info },
      { name: 'Views', value: Math.round((views / maxVal) * 100), color: TC.success },
    ];
  }, [userPosts, user]);

  return (
    <Animated.View entering={FadeInUp.delay(600).springify()}>
      <SectionHeader title="Social Graph" subtitle="Engagement distribution" />
      <GlassCard>
        <View style={styles.socialGraph}>
          {data.map((item) => (
            <View key={item.name} style={styles.socialGraphItem}>
              <View style={styles.socialGraphBarWrap}>
                <View style={[styles.socialGraphBarBg]}>
                  <View style={[styles.socialGraphBarFill, { height: `${item.value}%`, backgroundColor: item.color }]} />
                </View>
              </View>
              <Text style={styles.socialGraphLabel}>{item.name}</Text>
              <Text style={[styles.socialGraphValue, { color: item.color }]}>{item.value}%</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const RecentInteractions = React.memo(({ userPosts, onPostPress }: any) => {
  const recent = useMemo(() => userPosts.slice(0, 3), [userPosts]);
  if (recent.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(650).springify()}>
      <SectionHeader title="Recent Interactions" subtitle="Latest activity" />
      <View style={styles.recentList}>
        {recent.map((post: Post, i: number) => {
          const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
          return (
            <TouchableOpacity key={post.id} onPress={() => onPostPress(post)} style={styles.recentItem}>
              <LinearGradient colors={[`${topicColor}08`, `${topicColor}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.recentDot, { backgroundColor: topicColor }]} />
              <View style={styles.recentContent}>
                <Text style={styles.recentTopic} numberOfLines={1}>{post.topic}</Text>
                <Text style={styles.recentText} numberOfLines={1}>{post.content}</Text>
              </View>
              <View style={styles.recentStats}>
                <Ionicons name="heart" size={12} color={post.isLiked ? TC.danger : '#64748b'} />
                <Text style={styles.recentStatText}>{post.likes}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});

const AchievementBadge = React.memo(({ achievement }: any) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary, desc: '' };
  return (
    <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}08` }]}>
      <View style={[styles.achievementIconBg, { backgroundColor: `${badge.color}12` }]}>
        <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      </View>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
        <Text style={styles.achievementDesc}>{badge.desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color={badge.color} style={{ opacity: 0.5 }} />
    </View>
  );
});

const PostCard = React.memo(({ post, index, onPress }: any) => {
  const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
  return (
    <GlassCard style={styles.postCard} delay={index * 50} onPress={onPress}>
      <View style={styles.postHeader}>
        <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
        <Text style={[styles.topicText, { color: topicColor }]}>{post.topic}</Text>
        <Text style={styles.postTime}>{post.time}</Text>
      </View>
      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
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

type ProfileTab = 'posts' | 'about' | 'achievements' | 'insights';

const TabBar = React.memo(({ tabs, activeTab, onChange }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab; onChange: (t: ProfileTab) => void;
}) => (
  <View style={styles.tabBar}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)', ...DESIGN.shadow.sm }]}>
          <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

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
  const scrollY = useSharedValue(0);

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const isOwnProfile = currentUser?.id === userId;

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const bannerGradient = useMemo(() => {
    if (!user) return ['#6366f1', '#8b5cf6'] as [string, string];
    const colors = user.selectedTopics?.map(t => TOPIC_COLORS[t] || TC.primary) || [TC.primary];
    return [colors[0] || TC.primary, colors[1] || TC.primaryDark] as [string, string];
  }, [user]);

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

  const tabs = [
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'about' as ProfileTab, label: 'About', icon: 'information-circle-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
    { key: 'insights' as ProfileTab, label: 'Insights', icon: 'analytics-outline' },
  ];

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

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.stickyTitle}>{user?.displayName || 'Member Profile'}</Text>
      <Text style={styles.stickySubtitle}>{user?.handle || ''}</Text>
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
              <Text style={styles.profileName}>{user.displayName}</Text>
              {user.isVerified && <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
            </View>
            <Text style={styles.profileHandle}>{user.handle}</Text>
            {user.bio && <Text style={styles.profileBio} numberOfLines={2}>{user.bio}</Text>}
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

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <EngagementInsightsCard insights={engagementInsights} />
      <CommunityInfluenceCard influence={communityInfluence} />
      <ContentHighlightsCard highlights={contentHighlights} onPostPress={(post: Post) => navigation.navigate('PostDetail' as never, { postId: post.id })} />
      <ActivityPatternGraph data={activityPattern} />
      <MutualConnections connections={mutualConnections} onPress={(id: string) => navigation.navigate('CommunityMemberProfile' as never, { userId: id })} />
      <SmartActions actions={smartActions} />
      <ParentingTipsEngine userPosts={userPosts} member={user} />
      <TopicBreakdown userPosts={userPosts} />
      <InteractionHeatMap userPosts={userPosts} />
      <ContributionStreakCard userPosts={userPosts} />
      <SocialGraphCard userPosts={userPosts} user={user} />
      <RecentInteractions userPosts={userPosts} onPostPress={(post: Post) => navigation.navigate('PostDetail' as never, { postId: post.id })} />
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color={TC.primary} />
          <Text style={styles.sectionTitle}>All Threads</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{userPosts.length} posts</Text>
        </View>
      </View>
      {userPosts.length === 0 ? (
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}><Ionicons name="document-text-outline" size={32} color={TC.primary} /></View>
          <Text style={styles.emptyStateTitle}>No threads yet</Text>
          <Text style={styles.emptyText}>This parent has not shared any stories yet.</Text>
        </GlassCard>
      ) : (
        <View style={styles.postsList}>
          {userPosts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id })} />
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
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: `${TC.primary}20` }]}><Ionicons name="time-outline" size={20} color={TC.primary} /></View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>2024</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="flame-outline" size={20} color="#f59e0b" /></View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Active Streak</Text>
              <Text style={styles.infoValue}>{user.stats?.streakDays || 0} days</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}><Ionicons name="heart-outline" size={20} color="#10b981" /></View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Likes Received</Text>
              <Text style={styles.infoValue}>{user.stats?.totalLikes || 0}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: '#8b5cf620' }]}><Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" /></View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Total Comments</Text>
              <Text style={styles.infoValue}>{user.stats?.totalComments || 0}</Text>
            </View>
          </View>
        </GlassCard>
        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassCard style={styles.formCard} delay={200}>
            <Text style={styles.sectionLabel}>Interested In</Text>
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
          <Text style={styles.sectionTitle}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${themeColors.primary}20` }]}>
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>{user?.achievements?.length || 0} earned</Text>
        </View>
      </View>
      <GlassCard style={styles.achievementsCard} delay={100}>
        {user?.achievements && user.achievements.length > 0 ? (
          user.achievements.map((achievement) => <AchievementBadge key={achievement} achievement={achievement} />)
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color={TC.primary} />
            <Text style={styles.emptyStateTitle}>No achievements yet</Text>
            <Text style={styles.emptyText}>This parent is just getting started!</Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );

  const renderInsightsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <ParentingTipsEngine userPosts={userPosts} member={user} />
      <TopicBreakdown userPosts={userPosts} />
      <InteractionHeatMap userPosts={userPosts} />
      <ContributionStreakCard userPosts={userPosts} />
      <SocialGraphCard userPosts={userPosts} user={user} />
      <RecentInteractions userPosts={userPosts} onPostPress={(post: Post) => navigation.navigate('PostDetail' as never, { postId: post.id })} />
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        {isDark ? (
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f8f9fc' }]} />
      )}
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        {isDark ? (
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f8f9fc' }]} />
      )}
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={styles.bg} />
      {renderStickyHeader()}

      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleMoreOptions} style={styles.backBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'about' && renderAboutTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'insights' && renderInsightsTab()}
        </View>
      </Animated.ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },

  // ── Top Header ──
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  // ── Profile Hero ──
  profileHero: { paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  banner: { height: 120, borderRadius: DESIGN.radius.xl, marginBottom: -50, marginHorizontal: -20, marginTop: -20 },
  profileHeroContent: { position: 'relative', zIndex: 2 },
  avatarSection: { alignItems: 'center', marginBottom: 12 },
  avatarWrapper: { position: 'relative' },
  onlineIndicator: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: DESIGN.radius.md, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  profileInfo: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  profileHandle: { fontSize: 14, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
  profileBio: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, paddingHorizontal: DESIGN.spacing.xl, lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── Stats Pills ──
  statsPillsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 16, paddingHorizontal: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, overflow: 'hidden' },
  statPillIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statPillEmoji: { fontSize: 16 },
  statPillText: { gap: 0 },
  statPillValue: { fontSize: 16, fontWeight: '800' },
  statPillLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Action Buttons ──
  actionButtons: { flexDirection: 'row', gap: DESIGN.spacing.lg, marginTop: 20, width: '100%', paddingHorizontal: 20 },
  followBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: DESIGN.radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  blockedBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  followBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: '#64748b' },
  blockedBtnText: { color: '#ef4444' },
  messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: DESIGN.radius.md, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  messageBtnDisabled: { opacity: 0.5 },
  messageBtnText: { fontSize: 15, fontWeight: '700', color: '#6366f1' },

  // ── Tab Bar ──
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 16, gap: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Glass Card ──
  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: 0, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // ── Engagement Insights ──
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  insightsIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightsTitleWrap: { flex: 1 },
  insightsTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  insightsSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  insightsGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  insightItem: { flex: 1, alignItems: 'center', gap: 4 },
  insightItemIcon: { fontSize: 20 },
  insightItemValue: { fontSize: 20, fontWeight: '800' },
  insightItemLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  insightTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  insightTrendText: { fontSize: 11, fontWeight: '700' },

  // ── Community Influence ──
  influenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  influenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  influenceTitleWrap: { flex: 1 },
  influenceTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  influenceSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  influenceScoreBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  influenceScoreText: { fontSize: 20, fontWeight: '800' },
  influenceRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  influenceRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  influenceRankText: { fontSize: 13, fontWeight: '800' },
  influenceProgressWrap: { flex: 1, gap: 6 },
  influenceProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  influenceProgressLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  influenceProgressValue: { fontSize: 12, fontWeight: '700' },
  influenceProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  influenceProgressBarFill: { height: '100%', borderRadius: 3 },
  influenceContributors: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  influenceContributorsLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  influenceAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  influenceAvatar: { borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  influenceAvatarMore: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: -10 },
  influenceAvatarMoreText: { fontSize: 10, fontWeight: '800' },

  // ── Content Highlights ──
  highlightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  highlightsTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  highlightsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  highlightsBadgeText: { fontSize: 12, fontWeight: '700' },
  highlightsPostCard: { paddingHorizontal: 16, paddingBottom: 16 },
  highlightsPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  highlightsTopicDot: { width: 8, height: 8, borderRadius: 4 },
  highlightsTopicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  highlightsPostTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  highlightsPostContent: { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20, marginBottom: 10 },
  highlightsPostStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  highlightsPostStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  highlightsPostStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  highlightsDivider: { height: 1, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  highlightsMetrics: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  highlightsMetric: { flex: 1, alignItems: 'center', gap: 2 },
  highlightsMetricValue: { fontSize: 18, fontWeight: '800' },
  highlightsMetricLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // ── Activity Pattern ──
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  patternTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  patternLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#10b98115' },
  patternLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  patternLiveText: { fontSize: 10, fontWeight: '700', color: '#10b981' },
  patternBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  patternBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
  patternBar: { width: 20, borderRadius: 6 },
  patternBarLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
  patternPostBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  patternPostBadgeText: { fontSize: 9, fontWeight: '700' },

  // ── Mutual Connections ──
  mutualScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  mutualCard: { width: 100, padding: 12, borderRadius: 16, overflow: 'hidden', alignItems: 'center', gap: 6, ...DESIGN.shadow.md },
  mutualName: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' },
  mutualCount: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },

  // ── Smart Actions ──
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  actionCard: { width: (SCREEN_W - 72) / 3, padding: 14, borderRadius: 16, overflow: 'hidden', alignItems: 'center', gap: 8, ...DESIGN.shadow.md },
  actionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  actionDesc: { fontSize: 10, fontWeight: '500', color: '#94a3b8', textAlign: 'center', lineHeight: 14 },

  // ── Parenting Tips ──
  tipsList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  tipCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  tipIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tipEmoji: { fontSize: 20 },
  tipContent: { flex: 1, marginLeft: 12, gap: 3 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  tipText: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#94a3b8' },

  // ── Topic Breakdown ──
  topicBreakdown: { padding: 16, gap: 12 },
  topicBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topicBreakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicBreakdownDot: { width: 8, height: 8, borderRadius: 4 },
  topicBreakdownLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  topicBreakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicBreakdownBarBg: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  topicBreakdownBarFill: { height: '100%', borderRadius: 3 },
  topicBreakdownCount: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  // ── Heat Map ──
  heatMapContainer: { padding: 16 },
  heatMapRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 70 },
  heatMapCell: { alignItems: 'center', gap: 4, flex: 1 },
  heatMapBar: { width: 8, borderRadius: 4 },
  heatMapLabel: { fontSize: 9, fontWeight: '600', color: '#64748b' },
  heatMapLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  heatMapLegendText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  heatMapLegendDot: { width: 8, height: 8, borderRadius: 4 },

  // ── Contribution Streak ──
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  streakTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  streakSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  streakNumbers: { flexDirection: 'row', gap: 16 },
  streakNumberItem: { alignItems: 'center' },
  streakNumberValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  streakNumberLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  streakGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  streakCell: { flex: 1, height: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' },

  // ── Social Graph ──
  socialGraph: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, paddingBottom: 20, height: 140 },
  socialGraphItem: { alignItems: 'center', gap: 6 },
  socialGraphBarWrap: { height: 80, justifyContent: 'flex-end' },
  socialGraphBarBg: { width: 24, height: 80, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', justifyContent: 'flex-end' },
  socialGraphBarFill: { width: '100%', borderRadius: 12 },
  socialGraphLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  socialGraphValue: { fontSize: 12, fontWeight: '700' },

  // ── Recent Interactions ──
  recentList: { gap: 8, marginHorizontal: 16, marginBottom: 16 },
  recentItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, overflow: 'hidden', gap: 12 },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentContent: { flex: 1, gap: 2 },
  recentTopic: { fontSize: 13, fontWeight: '700', color: '#fff' },
  recentText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  recentStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentStatText: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  // ── Achievement Badge ──
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },

  // ── Post Card ──
  postCard: { padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  topicText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  postTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  postContent: { fontSize: 15, fontWeight: '600', color: '#fff', lineHeight: 22, marginBottom: 12 },
  postImageContainer: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', marginBottom: 12 },
  postImage: { width: '100%', height: 180, borderRadius: 16 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

  // ── Empty State ──
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  // ── About Tab ──
  formCard: { padding: 0, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3, paddingHorizontal: DESIGN.spacing.xl, paddingTop: 20, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  infoIcon: { width: 40, height: 40, borderRadius: DESIGN.radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2, color: '#94a3b8' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#fff' },
  infoDivider: { height: 1, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.06)' },

  // ── Topics ──
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },

  // ── Achievements ──
  achievementsCard: { padding: 20, gap: 12 },

  // ── Tab Panel ──
  tabPanel: { paddingBottom: 20 },
  postsList: { gap: 10 },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});