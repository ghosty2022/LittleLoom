import {
  StyleSheet,
  Dimensions,
  Image,
  Share,
  Text,
  TouchableOpacity,
  StatusBar,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
  RefreshControl,
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
  'topic_1': '#6366f1', 'topic_2': '#10b981', 'topic_3': '#ec4899',
  'topic_4': '#f59e0b', 'topic_5': '#fc5c7d', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#ec4899',
  'topic_10': '#43e97b', 'topic_11': '#ec4899', 'topic_12': '#6366f1',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#f59e0b', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

type ProfileTab = 'posts' | 'about' | 'achievements';

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

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
}) => (
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

const KpiPill = React.memo(({ icon, value, label, color, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiPill}>
    <LinearGradient colors={[`${color}15`, `${color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    <View style={[styles.kpiPillIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.kpiPillEmoji}>{icon}</Text>
    </View>
    <View style={styles.kpiPillBody}>
      <Text style={[styles.kpiPillValue, { color }]}>{value}</Text>
      <Text style={styles.kpiPillLabel}>{label}</Text>
    </View>
  </TouchableOpacity>
));

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

const PersonalityDNA = React.memo(({ user, posts }: any) => {
  const dna = useMemo(() => {
    const traits = [];
    const totalLikes = posts.reduce((s: number, p: Post) => s + p.likes, 0);
    const totalComments = posts.reduce((s: number, p: Post) => s + p.commentsCount, 0);
    const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;

    if (avgLikes > 20) traits.push({ emoji: '🔥', label: 'Viral Magnet', desc: 'Posts get exceptional engagement', color: '#ef4444', score: 92 });
    else if (avgLikes > 5) traits.push({ emoji: '💫', label: 'Engaging', desc: 'Consistently gets good reactions', color: '#f59e0b', score: 78 });
    else traits.push({ emoji: '🌱', label: 'Growing', desc: 'Building their community presence', color: '#10b981', score: 55 });

    if (totalComments > 50) traits.push({ emoji: '💬', label: 'Conversation Starter', desc: 'Sparks meaningful discussions', color: '#6366f1', score: 85 });
    if (posts.length > 20) traits.push({ emoji: '📚', label: 'Prolific Writer', desc: 'Regular content contributor', color: '#8b5cf6', score: 88 });
    if (user?.stats?.helpful > 10) traits.push({ emoji: '💙', label: 'Community Helper', desc: 'Others find their advice valuable', color: '#10b981', score: 90 });

    return traits.slice(0, 3);
  }, [user, posts]);

  if (dna.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Personality DNA" subtitle="AI-powered community profile" />
      <View style={styles.dnaContainer}>
        {dna.map((trait: any, i: number) => (
          <View key={i} style={[styles.dnaCard, { borderLeftColor: trait.color }]}>
            <View style={styles.dnaLeft}>
              <View style={[styles.dnaIconBg, { backgroundColor: `${trait.color}15` }]}>
                <Text style={styles.dnaEmoji}>{trait.emoji}</Text>
              </View>
              <View style={styles.dnaInfo}>
                <Text style={styles.dnaLabel}>{trait.label}</Text>
                <Text style={styles.dnaDesc}>{trait.desc}</Text>
              </View>
            </View>
            <View style={styles.dnaRight}>
              <View style={[styles.dnaScoreRing, { borderColor: `${trait.color}30` }]}>
                <Text style={[styles.dnaScoreText, { color: trait.color }]}>{trait.score}</Text>
              </View>
              <View style={[styles.dnaScoreFill, { backgroundColor: trait.color, width: `${trait.score}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const ImpactScoreCard = React.memo(({ user, posts }: any) => {
  const impact = useMemo(() => {
    const totalEngagement = posts.reduce((s: number, p: Post) => s + p.likes + p.commentsCount + p.reposts, 0);
    const reach = posts.reduce((s: number, p: Post) => s + p.viewCount, 0);
    const consistency = posts.length > 0 ? Math.min(100, (posts.length / 30) * 100) : 0;
    const score = Math.round((totalEngagement * 0.4) + (reach * 0.003) + (consistency * 0.3));
    const clamped = Math.min(100, Math.max(0, score));

    let rank = { label: 'Newcomer', color: '#94a3b8', emoji: '🌱' };
    if (clamped > 90) rank = { label: 'Legend', color: '#f59e0b', emoji: '👑' };
    else if (clamped > 75) rank = { label: 'Influencer', color: '#ec4899', emoji: '⭐' };
    else if (clamped > 50) rank = { label: 'Contributor', color: '#6366f1', emoji: '💎' };
    else if (clamped > 25) rank = { label: 'Active', color: '#10b981', emoji: '🌿' };

    return { score: clamped, rank, totalEngagement, reach };
  }, [user, posts]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.impactContainer}>
          <View style={styles.impactLeft}>
            <Text style={styles.impactTitle}>Community Impact</Text>
            <Text style={styles.impactSubtitle}>Overall influence score</Text>
            <View style={styles.impactMetrics}>
              <View style={styles.impactMetric}>
                <Text style={styles.impactMetricValue}>{impact.totalEngagement}</Text>
                <Text style={styles.impactMetricLabel}>Engagements</Text>
              </View>
              <View style={styles.impactMetric}>
                <Text style={styles.impactMetricValue}>{impact.reach}</Text>
                <Text style={styles.impactMetricLabel}>Reach</Text>
              </View>
            </View>
          </View>
          <View style={styles.impactRingWrap}>
            <View style={styles.impactRing}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.impactRingEmoji}>{impact.rank.emoji}</Text>
                <Text style={[styles.impactRingScore, { color: impact.rank.color }]}>{impact.score}</Text>
                <Text style={styles.impactRingLabel}>{impact.rank.label}</Text>
              </View>
              <View style={[styles.impactRingBg, { borderColor: 'rgba(255,255,255,0.06)' }]} />
              <View style={[styles.impactRingFill, { borderColor: impact.rank.color, transform: [{ rotate: `${(impact.score / 100) * 360}deg` }] }]} />
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ContentVelocity = React.memo(({ posts }: { posts: Post[] }) => {
  const data = useMemo(() => {
    const days: Record<string, { count: number; likes: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().split('T')[0]] = { count: 0, likes: 0 };
    }
    posts.forEach(p => {
      const d = new Date(p.timestamp || Date.now()).toISOString().split('T')[0];
      if (days[d]) { days[d].count++; days[d].likes += p.likes; }
    });
    return Object.values(days);
  }, [posts]);

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const totalPosts = data.reduce((a, b) => a + b.count, 0);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.velocityHeader}>
          <View>
            <Text style={styles.velocityTitle}>Content Velocity</Text>
            <Text style={styles.velocitySubtitle}>Weekly posting activity</Text>
          </View>
          <View style={styles.velocityTotal}>
            <Text style={styles.velocityTotalValue}>{totalPosts}</Text>
            <Text style={styles.velocityTotalLabel}>this week</Text>
          </View>
        </View>
        <View style={styles.velocityChart}>
          {data.map((point, i) => {
            const height = Math.max(4, (point.count / maxVal) * 60);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.velocityBar, { height, backgroundColor: isToday ? '#6366f1' : point.count > 0 ? '#8b5cf6' : '#334155' }]} />
                <Text style={[styles.velocityDay, isToday && { color: '#6366f1', fontWeight: '700' }]}>{['M','T','W','T','F','S','S'][i]}</Text>
                {point.likes > 0 && (
                  <View style={[styles.velocityLikeBadge, { backgroundColor: '#ef444415' }]}>
                    <Text style={styles.velocityLikeText}>❤️{point.likes}</Text>
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

const TopicAffinity = React.memo(({ user }: any) => {
  const topics = useMemo(() => {
    if (!user?.selectedTopics || user.selectedTopics.length === 0) return [];
    return user.selectedTopics.map((t: string, i: number) => ({
      id: t,
      name: t.replace('topic_', 'Topic '),
      color: TOPIC_COLORS[t] || TC.primary,
      affinity: Math.max(30, 100 - i * 15),
    }));
  }, [user]);

  if (topics.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Topic Affinity" subtitle="Where they contribute most" />
      <View style={styles.affinityContainer}>
        {topics.map((topic: any) => (
          <View key={topic.id} style={styles.affinityRow}>
            <View style={[styles.affinityDot, { backgroundColor: topic.color }]} />
            <Text style={styles.affinityName}>{topic.name}</Text>
            <View style={styles.affinityBarBg}>
              <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.affinityBarFill, { width: `${topic.affinity}%`, backgroundColor: topic.color }]} />
            </View>
            <Text style={[styles.affinityValue, { color: topic.color }]}>{topic.affinity}%</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const EngagementTimeline = React.memo(({ user, posts }: any) => {
  const timelineItems = useMemo(() => {
    const items = [];
    if (user?.joinedAt) items.push({ date: user.joinedAt, title: 'Joined Community', desc: 'Started their parenting journey', emoji: '👋', color: '#6366f1', type: 'join' });
    const firstPost = [...posts].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0];
    if (firstPost) items.push({ date: new Date(firstPost.timestamp || Date.now()).toISOString(), title: 'First Thread', desc: firstPost.topic || 'Shared their first story', emoji: '📝', color: '#10b981', type: 'first' });
    const topPost = [...posts].sort((a, b) => b.likes - a.likes)[0];
    if (topPost) items.push({ date: new Date(topPost.timestamp || Date.now()).toISOString(), title: 'Top Performing Post', desc: `${topPost.likes} likes • ${topPost.commentsCount} comments`, emoji: '🏆', color: '#f59e0b', type: 'top' });
    if (user?.stats?.streakDays > 0) items.push({ date: new Date().toISOString(), title: 'Active Streak', desc: `${user.stats.streakDays} day streak ongoing`, emoji: '🔥', color: '#ef4444', type: 'streak' });
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-4);
  }, [user, posts]);

  if (timelineItems.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Journey Timeline" subtitle="Key milestones" />
      <View style={styles.timelineContainer}>
        {timelineItems.map((item, i) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineLine, i === 0 && { top: '50%' }, i === timelineItems.length - 1 && { bottom: '50%' }]} />
              <View style={[styles.timelineDot, { backgroundColor: item.color, borderColor: item.color }]} />
            </View>
            <View style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineEmoji}>{item.emoji}</Text>
                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDate}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
              </View>
              <Text style={styles.timelineDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const QuickActionsDock = React.memo(({ isOwnProfile, isFollowing, isBlocked, onFollow, onMessage, onShare, onMore }: any) => {
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()} style={styles.dockContainer}>
      <View style={styles.dock}>
        {!isOwnProfile && (
          <TouchableOpacity onPress={onFollow} style={styles.dockItem}>
            <LinearGradient colors={isFollowing ? ['#334155', '#475569'] : ['#6366f1', '#8b5cf6']} style={styles.dockGradient}>
              <Ionicons name={isFollowing ? "checkmark" : "person-add"} size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
        {!isOwnProfile && !isBlocked && (
          <TouchableOpacity onPress={onMessage} style={styles.dockItem}>
            <LinearGradient colors={['#10b981', '#34d399']} style={styles.dockGradient}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>Message</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onShare} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.dockLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMore} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </View>
          <Text style={styles.dockLabel}>More</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const PostCard = React.memo(({ post, index, onPress }: any) => {
  const topicColor = TOPIC_COLORS[post.topicId] || TC.primary;
  return (
    <GlassCard style={styles.postCard} delay={index * 60} onPress={onPress}>
      <View style={styles.postHeader}>
        <View style={[styles.topicDot, { backgroundColor: topicColor }]} />
        <Text style={[styles.topicText, { color: topicColor }]}>{post.topic}</Text>
        <Text style={styles.postTime}>{post.time}</Text>
      </View>
      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
      {post.images && post.images.length > 0 && (
        <View style={styles.postImageContainer}>
          <Image source={{ uri: post.images[0] }} style={styles.postImage} resizeMode="cover" />
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

const AchievementBadge = React.memo(({ achievement }: any) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary, desc: '' };
  return (
    <View style={[styles.achievementBadge, { borderLeftColor: badge.color }]}>
      <View style={[styles.achievementIconBg, { backgroundColor: `${badge.color}15` }]}>
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
  const [refreshing, setRefreshing] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 160], [0, 1], Extrapolation.CLAMP),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 160], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const bannerGradient = useMemo(() => {
    if (!user) return ['#6366f1', '#8b5cf6'] as [string, string];
    const colors = user.selectedTopics?.map(t => TOPIC_COLORS[t] || TC.primary) || [TC.primary];
    return [colors[0] || TC.primary, colors[1] || TC.primaryDark] as [string, string];
  }, [user]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, []);

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

  const handleShareProfile = async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({ message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`, title: `${user.displayName}'s Profile` });
    } catch (error) { console.error('Share error:', error); }
  };

  const handleMoreOptions = () => {
    if (!user) return;
    sweetAlert.confirm(user.displayName || 'User', 'What would you like to do?', () => handleShareProfile(), undefined, 'Share Profile', 'Cancel');
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
    triggerHaptic('light');
  }, [triggerHaptic]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  const tabs = [
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'about' as ProfileTab, label: 'About', icon: 'information-circle-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOnline = user.onlineStatus === 'online';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.stickyHeaderCenter}>
            <SafeAvatar avatar={user?.avatar} size={32} fallbackIcon="person" fallbackColor={themeColors.primary} />
            <Text style={styles.stickyHeaderTitle} numberOfLines={1}>{user?.displayName || 'Member Profile'}</Text>
          </View>
          <TouchableOpacity onPress={handleMoreOptions} style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1', '#8b5cf6']} />}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleMoreOptions} style={styles.backBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
          <LinearGradient colors={bannerGradient} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.profileHeroContent}>
            <View style={styles.avatarWrapper}>
              <SafeAvatar avatar={user.avatar} size={100} fallbackIcon="person" fallbackColor={themeColors.primary} fallbackBgColor={`${themeColors.primary}20`} borderWidth={4} borderColor="#fff" showEditBadge={false} />
              {isOnline && (
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{user.displayName}</Text>
                {user.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.profileHandle}>{user.handle}</Text>
              {user.bio && <Text style={styles.profileBio} numberOfLines={2}>{user.bio}</Text>}
              {user.country && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#94a3b8" />
                  <Text style={styles.locationText}>{user.country}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        <View style={styles.kpiPillRow}>
          <KpiPill icon="📝" value={userPosts.length} label="Posts" color="#6366f1" />
          <KpiPill icon="👥" value={followerCount} label="Followers" color="#ec4899" />
          <KpiPill icon="👤" value={followingCount} label="Following" color="#3b82f6" />
          <KpiPill icon="💙" value={user.stats?.helpful || 0} label="Helpful" color="#10b981" />
        </View>

        <QuickActionsDock
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowingUser}
          isBlocked={isBlocked}
          onFollow={handleFollowToggle}
          onMessage={handleMessage}
          onShare={handleShareProfile}
          onMore={handleMoreOptions}
        />

        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === 'posts' && (
          <>
            <PersonalityDNA user={user} posts={userPosts} />
            <ImpactScoreCard user={user} posts={userPosts} />
            <ContentVelocity posts={userPosts} />
            <TopicAffinity user={user} />
            <EngagementTimeline user={user} posts={userPosts} />
            <View style={{ marginTop: 8 }}>
              <SectionHeader title="All Threads" subtitle={`${userPosts.length} posts`} />
            </View>
            {userPosts.length === 0 ? (
              <GlassCard style={styles.emptyCard} delay={100}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="document-text-outline" size={32} color="#6366f1" />
                </View>
                <Text style={styles.emptyStateTitle}>No threads yet</Text>
                <Text style={styles.emptyText}>This parent has not shared any stories yet.</Text>
              </GlassCard>
            ) : (
              <View style={styles.postsList}>
                {userPosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id })}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'about' && (
          <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
            <GlassCard style={styles.formCard} delay={100}>
              <Text style={styles.sectionLabel}>About</Text>
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: '#6366f115' }]}>
                  <Ionicons name="time-outline" size={20} color="#6366f1" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Member Since</Text>
                  <Text style={styles.infoValue}>2024</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: '#f59e0b15' }]}>
                  <Ionicons name="flame-outline" size={20} color="#f59e0b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Active Streak</Text>
                  <Text style={styles.infoValue}>{user.stats?.streakDays || 0} days</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: '#10b98115' }]}>
                  <Ionicons name="heart-outline" size={20} color="#10b981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Total Likes Received</Text>
                  <Text style={styles.infoValue}>{user.stats?.totalLikes || 0}</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: '#8b5cf615' }]}>
                  <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
                </View>
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
        )}

        {activeTab === 'achievements' && (
          <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
            <SectionHeader title="Achievements" subtitle={`${user?.achievements?.length || 0} earned`} />
            <GlassCard style={styles.achievementsCard} delay={100}>
              {user?.achievements && user.achievements.length > 0 ? (
                user.achievements.map((achievement) => (
                  <AchievementBadge key={achievement} achievement={achievement} />
                ))
              ) : (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="trophy-outline" size={40} color="#6366f1" />
                  <Text style={styles.emptyStateTitle}>No achievements yet</Text>
                  <Text style={styles.emptyText}>This parent is just getting started!</Text>
                </View>
              )}
            </GlassCard>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 24 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, width: '100%' },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3, maxWidth: 180 },

  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  profileHero: { marginHorizontal: 16, marginBottom: 20, borderRadius: DESIGN.radius.xl, overflow: 'hidden' },
  banner: { height: 120, borderRadius: DESIGN.radius.xl, marginBottom: -50 },
  profileHeroContent: { position: 'relative', zIndex: 2, alignItems: 'center', paddingBottom: 16 },
  avatarWrapper: { position: 'relative' },
  onlineIndicator: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 3, borderColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  profileInfo: { alignItems: 'center', marginTop: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  profileHandle: { fontSize: 14, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
  profileBio: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 20, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 },
  kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, ...DESIGN.shadow.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...DESIGN.shadow.md },
  dockLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 16, gap: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...DESIGN.shadow.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  glassContent: { flex: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  dnaContainer: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  dnaCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  dnaLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  dnaIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dnaEmoji: { fontSize: 20 },
  dnaInfo: { flex: 1, gap: 2 },
  dnaLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dnaDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  dnaRight: { alignItems: 'center', gap: 4 },
  dnaScoreRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  dnaScoreText: { fontSize: 14, fontWeight: '800' },
  dnaScoreFill: { height: 3, borderRadius: 2, width: 44, marginTop: 2 },

  impactContainer: { flexDirection: 'row', padding: 16, gap: 16 },
  impactLeft: { flex: 1, gap: 4 },
  impactTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  impactSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginBottom: 8 },
  impactMetrics: { flexDirection: 'row', gap: 16, marginTop: 4 },
  impactMetric: { alignItems: 'center', gap: 2 },
  impactMetricValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  impactMetricLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  impactRingWrap: { justifyContent: 'center', alignItems: 'center' },
  impactRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  impactRingBg: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.06)' },
  impactRingFill: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderTopColor: 'transparent', borderRightColor: 'transparent', borderLeftColor: 'transparent' },
  impactRingEmoji: { fontSize: 16 },
  impactRingScore: { fontSize: 20, fontWeight: '800' },
  impactRingLabel: { fontSize: 9, fontWeight: '600', color: '#94a3b8' },

  velocityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  velocityTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  velocitySubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  velocityTotal: { alignItems: 'flex-end' },
  velocityTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  velocityTotalLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  velocityChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  velocityBar: { width: 8, borderRadius: 4 },
  velocityDay: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  velocityLikeBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  velocityLikeText: { fontSize: 8, fontWeight: '700', color: '#ef4444' },

  affinityContainer: { marginHorizontal: 16, gap: 10, marginBottom: 16 },
  affinityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  affinityDot: { width: 8, height: 8, borderRadius: 4 },
  affinityName: { fontSize: 13, fontWeight: '600', color: '#fff', width: 80 },
  affinityBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  affinityBarFill: { height: '100%', borderRadius: 3 },
  affinityValue: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  timelineContainer: { marginHorizontal: 16, gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 11, backgroundColor: 'rgba(255,255,255,0.06)' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', zIndex: 1 },
  timelineCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', marginBottom: 12, ...DESIGN.shadow.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timelineEmoji: { fontSize: 20 },
  timelineMeta: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  timelineDate: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 1 },
  timelineDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', lineHeight: 17 },

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

  achievementsCard: { padding: 20, gap: 12 },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6, backgroundColor: 'rgba(45,45,60,0.4)', borderLeftWidth: 3 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },

  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  tabPanel: { paddingBottom: 20 },
  formCard: { padding: 0, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3, paddingHorizontal: DESIGN.spacing.xl, paddingTop: 20, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  infoIcon: { width: 40, height: 40, borderRadius: DESIGN.radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2, color: '#94a3b8' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#fff' },
  infoDivider: { height: 1, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },

  postsList: { gap: 10, marginHorizontal: 16 },

  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});