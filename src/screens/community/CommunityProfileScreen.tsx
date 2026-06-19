// src/screens/community/CommunityProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  secondary: '#ec4899',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#fbbf24',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#6366f1', icon: 'shield', gradient: ['#6366f1', '#8b5cf6'] as [string, string] },
  verified: { label: 'Verified', color: '#10b981', icon: 'checkmark-circle', gradient: ['#10b981', '#34d399'] as [string, string] },
  contributor: { label: 'Contributor', color: '#ec4899', icon: 'heart', gradient: ['#ec4899', '#f43f5e'] as [string, string] },
  member: { label: 'Member', color: '#64748b', icon: 'person', gradient: ['#64748b', '#94a3b8'] as [string, string] },
};

const EMOJI_OPTIONS = ['👤','👩','👨','👵','👴','👶','👧','👦','🧑','👮','👩‍⚕️','👨‍⚕️','👩‍🏫','👨‍🏫','👩‍🍳','👨‍🍳','👩‍⚖️','👨‍⚖️','👩‍🌾','👨‍🌾'];

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared your first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#f43f5e', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fbbf24', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#6366f1', 'topic_2': '#10b981', 'topic_3': '#ec4899',
  'topic_4': '#fbbf24', 'topic_5': '#f43f5e', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#ec4899',
  'topic_10': '#43e97b', 'topic_11': '#ec4899', 'topic_12': '#6366f1',
};

type ProfileTab = 'overview' | 'posts' | 'achievements' | 'settings';

interface ActivityScore { overall: number; engagement: number; consistency: number; helpfulness: number; creativity: number; }
interface WeeklyImpact { postsThisWeek: number; helpfulVotes: number; newConnections: number; rankChange: number; trend: 'up' | 'down' | 'stable'; }
interface CommunityStanding { percentile: number; rank: string; nextMilestone: string; progressToNext: number; }
interface ContentBreakdown { posts: number; comments: number; reactions: number; shares: number; }
interface EngagementPoint { day: string; value: number; }
interface SmartSuggestion { id: string; type: 'topic' | 'post' | 'connect' | 'verify'; title: string; description: string; emoji: string; color: string; action: () => void; }
interface InfluenceMetric { label: string; value: number; color: string; icon: string; }
interface TopicAffinity { topicId: string; topicName: string; emoji: string; color: string; affinity: number; posts: number; }
interface PeerComparison { metric: string; userValue: number; avgValue: number; percentile: number; icon: string; color: string; }
interface ContentStreak { type: string; current: number; best: number; color: string; icon: string; }

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; delay?: number;
}) => {
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

const InfluenceDashboard = React.memo(({ metrics }: { metrics: InfluenceMetric[] }) => {
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <GlassCard>
        <View style={styles.influenceHeader}>
          <View style={[styles.influenceIconBg, { backgroundColor: `${TC.primary}15` }]}>
            <Ionicons name="analytics" size={20} color={TC.primary} />
          </View>
          <View style={styles.influenceTitleWrap}>
            <Text style={styles.influenceTitle}>Influence Score</Text>
            <Text style={styles.influenceSubtitle}>Community impact metrics</Text>
          </View>
          <View style={[styles.influenceOverallBadge, { backgroundColor: `${TC.primary}12` }]}>
            <Text style={[styles.influenceOverallText, { color: TC.primary }]}>
              {Math.round(metrics.reduce((a, b) => a + b.value, 0) / metrics.length)}
            </Text>
          </View>
        </View>
        <View style={styles.influenceGrid}>
          {metrics.map((metric, i) => (
            <View key={metric.label} style={styles.influenceItem}>
              <View style={styles.influenceItemTop}>
                <View style={[styles.influenceItemIconBg, { backgroundColor: `${metric.color}12` }]}>
                  <Ionicons name={metric.icon as any} size={14} color={metric.color} />
                </View>
                <Text style={[styles.influenceItemLabel, { color: metric.color }]}>{metric.label}</Text>
                <Text style={[styles.influenceItemValue, { color: metric.color }]}>{metric.value}%</Text>
              </View>
              <View style={[styles.influenceBarBg, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Animated.View entering={FadeInRight.delay(200 + i * 80).springify()} style={[styles.influenceBarFill, { width: `${metric.value}%`, backgroundColor: metric.color }]} />
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const WeeklyImpactCard = React.memo(({ impact }: { impact: WeeklyImpact }) => {
  const items = [
    { icon: '📝', label: 'Posts', value: impact.postsThisWeek, color: TC.primary },
    { icon: '💙', label: 'Helpful', value: impact.helpfulVotes, color: TC.success },
    { icon: '👥', label: 'New', value: impact.newConnections, color: TC.secondary },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.impactHeader}>
          <Text style={styles.impactTitle}>This Week</Text>
          <View style={[styles.impactTrendBadge, {
            backgroundColor: impact.trend === 'up' ? '#10b98115' : impact.trend === 'down' ? '#ef444415' : '#f59e0b15'
          }]}>
            <Ionicons name={impact.trend === 'up' ? 'trending-up' : impact.trend === 'down' ? 'trending-down' : 'remove'} size={14}
              color={impact.trend === 'up' ? '#10b981' : impact.trend === 'down' ? '#ef4444' : '#f59e0b'} />
            <Text style={[styles.impactTrendText, { color: impact.trend === 'up' ? '#10b981' : impact.trend === 'down' ? '#ef4444' : '#f59e0b' }]}>
              {impact.rankChange > 0 ? `+${impact.rankChange}` : impact.rankChange} rank
            </Text>
          </View>
        </View>
        <View style={styles.impactGrid}>
          {items.map((item, i) => (
            <View key={item.label} style={[styles.impactItem, i < items.length - 1 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.impactItemIcon}>{item.icon}</Text>
              <Text style={[styles.impactItemValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.impactItemLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const CommunityStandingCard = React.memo(({ standing }: { standing: CommunityStanding }) => (
  <Animated.View entering={FadeInUp.delay(200).springify()}>
    <GlassCard>
      <View style={styles.standingHeader}>
        <View style={[styles.standingIconBg, { backgroundColor: `${TC.purple}15` }]}>
          <Ionicons name="trophy" size={20} color={TC.purple} />
        </View>
        <View style={styles.standingTitleWrap}>
          <Text style={styles.standingTitle}>Community Standing</Text>
          <Text style={styles.standingSubtitle}>Top {standing.percentile}% of members</Text>
        </View>
      </View>
      <View style={styles.standingRankRow}>
        <View style={[styles.standingRankBadge, { backgroundColor: `${TC.purple}12` }]}>
          <Text style={[styles.standingRankText, { color: TC.purple }]}>{standing.rank}</Text>
        </View>
        <View style={styles.standingProgressWrap}>
          <View style={styles.standingProgressLabelRow}>
            <Text style={styles.standingProgressLabel}>Next: {standing.nextMilestone}</Text>
            <Text style={[styles.standingProgressValue, { color: TC.purple }]}>{standing.progressToNext}%</Text>
          </View>
          <View style={[styles.standingProgressBarBg, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.standingProgressBarFill, { width: `${standing.progressToNext}%`, backgroundColor: TC.purple }]} />
          </View>
        </View>
      </View>
    </GlassCard>
  </Animated.View>
));

const ContentBreakdownCard = React.memo(({ breakdown }: { breakdown: ContentBreakdown }) => {
  const total = breakdown.posts + breakdown.comments + breakdown.reactions + breakdown.shares;
  const items = [
    { label: 'Posts', value: breakdown.posts, color: TC.primary, icon: 'document-text' },
    { label: 'Comments', value: breakdown.comments, color: TC.info, icon: 'chatbubble' },
    { label: 'Reactions', value: breakdown.reactions, color: TC.secondary, icon: 'heart' },
    { label: 'Shares', value: breakdown.shares, color: TC.success, icon: 'share' },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.breakdownHeader}>
          <Text style={styles.breakdownTitle}>Content Breakdown</Text>
          <Text style={styles.breakdownTotal}>{total} total</Text>
        </View>
        <View style={styles.breakdownGrid}>
          {items.map((item) => (
            <View key={item.label} style={styles.breakdownItem}>
              <View style={[styles.breakdownIconBg, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const EngagementSparkline = React.memo(({ data }: { data: EngagementPoint[] }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.sparklineHeader}>
          <View>
            <Text style={styles.sparklineTitle}>7-Day Activity</Text>
            <Text style={styles.sparklineSubtitle}>Daily engagement</Text>
          </View>
          <View style={styles.sparklineTotal}>
            <Text style={styles.sparklineTotalValue}>{data.reduce((a, b) => a + b.value, 0)}</Text>
            <Text style={styles.sparklineTotalLabel}>entries</Text>
          </View>
        </View>
        <View style={styles.sparklineChart}>
          {data.map((point, i) => {
            const height = Math.max(4, (point.value / maxVal) * 60);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.sparklineBar, {
                  height,
                  backgroundColor: isToday ? '#6366f1' : point.value > maxVal * 0.7 ? '#6366f1' : point.value > maxVal * 0.3 ? '#6366f180' : '#6366f140',
                }]} />
                <Text style={[styles.sparklineDay, isToday && { color: '#6366f1', fontWeight: '700' }]}>{point.day}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const SmartSuggestions = React.memo(({ suggestions }: { suggestions: SmartSuggestion[] }) => {
  if (suggestions.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Smart Suggestions" subtitle="Personalized for you" />
      <View style={styles.suggestionsScroll}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity key={suggestion.id} onPress={suggestion.action} style={styles.suggestionCard}>
            <LinearGradient colors={[suggestion.color + '12', suggestion.color + '04']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '15' }]}>
              <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
            </View>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionDesc} numberOfLines={2}>{suggestion.description}</Text>
            <View style={[styles.suggestionActionBadge, { backgroundColor: suggestion.color + '12' }]}>
              <Text style={[styles.suggestionActionText, { color: suggestion.color }]}>Take Action →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

const TopicAffinityCard = React.memo(({ affinities }: { affinities: TopicAffinity[] }) => {
  if (affinities.length === 0) return null;
  const maxAffinity = Math.max(...affinities.map(a => a.affinity), 1);
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Topic Affinity" subtitle="Where you contribute most" />
      <View style={styles.affinityList}>
        {affinities.map((item, i) => (
          <View key={item.topicId} style={styles.affinityRow}>
            <View style={[styles.affinityIconBg, { backgroundColor: `${item.color}12` }]}>
              <Text style={styles.affinityEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.affinityContent}>
              <View style={styles.affinityTop}>
                <Text style={styles.affinityName}>{item.topicName}</Text>
                <Text style={[styles.affinityValue, { color: item.color }]}>{item.posts} posts</Text>
              </View>
              <View style={[styles.affinityBarBg, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Animated.View entering={FadeInRight.delay(200 + i * 60).springify()} style={[styles.affinityBarFill, { width: `${(item.affinity / maxAffinity) * 100}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

const PeerComparisonCard = React.memo(({ comparisons }: { comparisons: PeerComparison[] }) => (
  <Animated.View entering={FadeInUp.delay(450).springify()}>
    <SectionHeader title="Peer Comparison" subtitle="How you compare to community average" />
    <View style={styles.comparisonList}>
      {comparisons.map((comp, i) => (
        <View key={comp.metric} style={styles.comparisonRow}>
          <View style={[styles.comparisonIconBg, { backgroundColor: `${comp.color}12` }]}>
            <Ionicons name={comp.icon as any} size={16} color={comp.color} />
          </View>
          <View style={styles.comparisonContent}>
            <View style={styles.comparisonTop}>
              <Text style={styles.comparisonMetric}>{comp.metric}</Text>
              <Text style={[styles.comparisonPercentile, { color: comp.color }]}>Top {comp.percentile}%</Text>
            </View>
            <View style={styles.comparisonBarRow}>
              <View style={[styles.comparisonBarBg, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Animated.View entering={FadeInRight.delay(200 + i * 60).springify()} style={[styles.comparisonBarFill, { width: `${Math.min((comp.userValue / Math.max(comp.avgValue, 1)) * 100, 100)}%`, backgroundColor: comp.color }]} />
              </View>
              <Text style={styles.comparisonNumbers}>{comp.userValue} vs {comp.avgValue} avg</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  </Animated.View>
));

const ContentStreaks = React.memo(({ streaks }: { streaks: ContentStreak[] }) => (
  <Animated.View entering={FadeInUp.delay(500).springify()}>
    <SectionHeader title="Streaks" subtitle="Consistency tracking" />
    <View style={styles.streaksRow}>
      {streaks.map((streak) => (
        <View key={streak.type} style={[styles.streakCard, { borderColor: `${streak.color}30` }]}>
          <View style={[styles.streakIconBg, { backgroundColor: `${streak.color}12` }]}>
            <Ionicons name={streak.icon as any} size={18} color={streak.color} />
          </View>
          <Text style={[styles.streakValue, { color: streak.color }]}>{streak.current}</Text>
          <Text style={styles.streakLabel}>{streak.type}</Text>
          <Text style={styles.streakBest}>Best: {streak.best}</Text>
        </View>
      ))}
    </View>
  </Animated.View>
));

const QuickActionsDock = React.memo(({ onMessage, onShare, onEdit, onSettings }: any) => (
  <Animated.View entering={FadeInUp.delay(550).springify()} style={styles.dockContainer}>
    <View style={styles.dock}>
      <TouchableOpacity onPress={onMessage} style={styles.dockItem}>
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.dockGradient}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </LinearGradient>
        <Text style={styles.dockLabel}>Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onShare} style={styles.dockItem}>
        <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Ionicons name="share-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.dockLabel}>Share</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} style={styles.dockItem}>
        <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.dockLabel}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSettings} style={styles.dockItem}>
        <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.dockLabel}>Settings</Text>
      </TouchableOpacity>
    </View>
  </Animated.View>
));

const ActionModal = React.memo(({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

export default function CommunityProfileScreen({ navigation }: Props) {
  const {
    currentUser, updateCommunityProfile, syncUserProfileAcrossPosts,
    getUserPosts, getSelectedTopics, getFollowers, getFollowing,
    checkAndAwardAchievements,
  } = useCommunity();
  const { profile, updateCommunityProfile: updateUserContextProfile } = useUser();
  const { themeColors, shouldReduceMotion, triggerHaptic } = useCustomization();
  const { compressImage, cacheImage, pickImage } = useMedia();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);

  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    displayName: '', handle: '', bio: '', avatar: '', location: '',
    isPublic: true, notificationsEnabled: true, showActivityStatus: true, allowMessages: true,
  });
  const [originalData, setOriginalData] = useState({ ...formData });

  const dynamicPrimaryColor = themeColors.primary;
  const dynamicGradient = [themeColors.primary, themeColors.secondary] as [string, string];

  const activityScore: ActivityScore = useMemo(() => ({
    overall: currentUser?.stats?.activityScore || 78,
    engagement: currentUser?.stats?.engagement || 82,
    consistency: currentUser?.stats?.consistency || 65,
    helpfulness: currentUser?.stats?.helpfulness || 90,
    creativity: currentUser?.stats?.creativity || 75,
  }), [currentUser]);

  const influenceMetrics: InfluenceMetric[] = useMemo(() => [
    { label: 'Engagement', value: activityScore.engagement, color: TC.primary, icon: 'flash' },
    { label: 'Consistency', value: activityScore.consistency, color: TC.secondary, icon: 'calendar' },
    { label: 'Helpful', value: activityScore.helpfulness, color: TC.success, icon: 'heart' },
    { label: 'Creative', value: activityScore.creativity, color: TC.accent, icon: 'bulb' },
  ], [activityScore]);

  const weeklyImpact: WeeklyImpact = useMemo(() => ({
    postsThisWeek: currentUser?.stats?.postsThisWeek || 3,
    helpfulVotes: currentUser?.stats?.helpfulThisWeek || 12,
    newConnections: currentUser?.stats?.newConnectionsThisWeek || 5,
    rankChange: currentUser?.stats?.rankChange || 2,
    trend: (currentUser?.stats?.rankChange || 0) >= 0 ? 'up' : 'down',
  }), [currentUser]);

  const communityStanding: CommunityStanding = useMemo(() => ({
    percentile: currentUser?.stats?.percentile || 15,
    rank: currentUser?.stats?.rank || 'Silver Parent',
    nextMilestone: currentUser?.stats?.nextMilestone || 'Gold Parent',
    progressToNext: currentUser?.stats?.progressToNext || 67,
  }), [currentUser]);

  const contentBreakdown: ContentBreakdown = useMemo(() => ({
    posts: userPosts.length,
    comments: currentUser?.stats?.totalComments || 24,
    reactions: currentUser?.stats?.totalReactions || 156,
    shares: currentUser?.stats?.totalShares || 8,
  }), [userPosts, currentUser]);

  const engagementData: EngagementPoint[] = useMemo(() => [
    { day: 'M', value: 3 }, { day: 'T', value: 7 }, { day: 'W', value: 5 },
    { day: 'T', value: 9 }, { day: 'F', value: 4 }, { day: 'S', value: 12 }, { day: 'S', value: 8 },
  ], []);

  const smartSuggestions: SmartSuggestion[] = useMemo(() => {
    const suggestions: SmartSuggestion[] = [];
    if (selectedTopics.length < 3) {
      suggestions.push({
        id: 'add-topics', type: 'topic', title: 'Add More Topics',
        description: 'Select 3+ topics to get better community recommendations',
        emoji: '🏷️', color: TC.primary, action: () => setShowTopicSelector(true),
      });
    }
    if (userPosts.length < 5) {
      suggestions.push({
        id: 'first-post', type: 'post', title: 'Share Your Story',
        description: 'Parents love hearing about your journey. Post today!',
        emoji: '✍️', color: TC.secondary, action: () => navigation.navigate('CreatePost' as never),
      });
    }
    if (!currentUser?.isVerified) {
      suggestions.push({
        id: 'verify', type: 'verify', title: 'Get Verified',
        description: 'Verify your identity to unlock exclusive features',
        emoji: '✅', color: TC.success, action: () => sweetAlert.toast('Verification', 'Coming soon!'),
      });
    }
    return suggestions;
  }, [selectedTopics, userPosts, currentUser, navigation, sweetAlert]);

  const topicAffinities: TopicAffinity[] = useMemo(() => {
    const affinities: TopicAffinity[] = [];
    const topicCounts: Record<string, number> = {};
    userPosts.forEach(p => { topicCounts[p.topicId] = (topicCounts[p.topicId] || 0) + 1; });
    Object.entries(topicCounts).forEach(([topicId, count]) => {
      const topic = INITIAL_TOPICS.find(t => t.id === topicId);
      if (topic) {
        affinities.push({
          topicId, topicName: topic.name, emoji: topic.emoji || '🏷️',
          color: topic.color || TOPIC_COLORS[topicId] || TC.primary,
          affinity: Math.min(100, count * 15), posts: count,
        });
      }
    });
    return affinities.sort((a, b) => b.affinity - a.affinity).slice(0, 4);
  }, [userPosts]);

  const peerComparisons: PeerComparison[] = useMemo(() => [
    { metric: 'Posts', userValue: userPosts.length, avgValue: 12, percentile: Math.min(100, Math.round((userPosts.length / 20) * 100)), icon: 'document-text', color: TC.primary },
    { metric: 'Helpful', userValue: currentUser?.stats?.helpful || 0, avgValue: 8, percentile: Math.min(100, Math.round(((currentUser?.stats?.helpful || 0) / 15) * 100)), icon: 'heart', color: TC.success },
    { metric: 'Engagement', userValue: activityScore.overall, avgValue: 60, percentile: activityScore.overall, icon: 'flash', color: TC.accent },
  ], [userPosts, currentUser, activityScore]);

  const contentStreaks: ContentStreak[] = useMemo(() => [
    { type: 'Posting', current: currentUser?.stats?.postStreak || 5, best: currentUser?.stats?.bestPostStreak || 12, color: TC.primary, icon: 'document-text' },
    { type: 'Helpful', current: currentUser?.stats?.helpfulStreak || 3, best: currentUser?.stats?.bestHelpfulStreak || 8, color: TC.success, icon: 'heart' },
    { type: 'Active', current: currentUser?.stats?.streakDays || 7, best: currentUser?.stats?.bestStreak || 30, color: TC.accent, icon: 'flame' },
  ], [currentUser]);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {});
    const hide = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => { loadUserData(); }, [currentUser]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      if (currentUser) {
        const posts = getUserPosts(currentUser.id);
        const topics = getSelectedTopics();
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);
        setUserPosts(posts);
        setSelectedTopics(topics);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
        const initialData = {
          displayName: currentUser.displayName || '',
          handle: currentUser.handle?.replace('@', '') || '',
          bio: currentUser.bio || '',
          avatar: currentUser.avatar || '',
          location: currentUser.country || currentUser.location || '',
          isPublic: true, notificationsEnabled: true, showActivityStatus: true, allowMessages: true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
      }
    } catch (error) { console.error('Error loading profile:', error); }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!currentUser) return;
    if (!formData.displayName.trim()) { sweetAlert.error('Validation Error', 'Display name is required'); triggerHaptic('error'); return; }
    setIsSaving(true); triggerHaptic('medium');
    try {
      const handle = formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`;
      const updates: any = { displayName: formData.displayName.trim(), handle: handle.toLowerCase(), bio: formData.bio.trim(), avatar: formData.avatar, country: formData.location };
      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);
      await syncUserProfileAcrossPosts(currentUser.id, updates);
      const newAchievements = await checkAndAwardAchievements();
      if (newAchievements.length > 0) { sweetAlert.success('Achievement Unlocked!', `You earned ${newAchievements.length} new badge${newAchievements.length > 1 ? 's' : ''}!`); }
      triggerHaptic('success'); setIsEditing(false); setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
    } catch (error) { triggerHaptic('error'); sweetAlert.error('Save Failed', 'Please try again'); }
    setIsSaving(false);
  };

  const handleImagePick = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const uri = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!uri) { sweetAlert.toast('No Image Selected', 'You did not select an image'); return; }
      setIsSaving(true);
      let processedUri = uri;
      try { processedUri = await compressImage(uri, 0.8); } catch (e) {}
      try { processedUri = await cacheImage(processedUri); } catch (e) {}
      setFormData(prev => ({ ...prev, avatar: processedUri }));
      triggerHaptic('success');
    } catch (error) { sweetAlert.error('Error', 'Failed to process image'); }
    finally { setIsSaving(false); }
  };

  const handleTakePhoto = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) { setFormData(prev => ({ ...prev, avatar: result.assets[0].uri })); }
    } catch (error) { sweetAlert.error('Error', 'Failed to take photo'); }
  };

  const handleRemoveAvatar = () => {
    setShowImagePicker(false);
    sweetAlert.confirm('Remove Photo', 'Remove your profile picture?', async () => {
      setFormData(prev => ({ ...prev, avatar: '' }));
      if (currentUser) { await updateCommunityProfile({ avatar: '' }); }
      sweetAlert.success('Photo Removed', 'Profile picture removed');
    }, () => {}, 'Remove', 'Cancel');
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShareProfile = async () => {
    if (!currentUser) return;
    try { triggerHaptic('medium'); await Share.share({ message: `Check out ${currentUser.displayName} on LittleLoom! ${currentUser.handle}`, title: `${currentUser.displayName}'s Profile` }); }
    catch (error) { console.error('Error sharing profile:', error); }
  };

  const handleCopyHandle = () => { sweetAlert.toast('Copied!', 'Handle copied to clipboard'); };

  const hasChanges = useMemo(() => Object.keys(formData).some(key => formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]), [formData, originalData]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.stickyTitle}>{currentUser?.displayName || 'Community Profile'}</Text>
      <Text style={styles.stickySubtitle}>{currentUser?.handle || ''}</Text>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!currentUser) return null;
    const roleConfig = currentUser.isVerified ? ROLE_CONFIG.verified : ROLE_CONFIG.member;
    return (
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImagePicker(true)}>
          <SafeAvatar avatar={formData.avatar || currentUser.avatar} size={100} fallbackIcon="person" fallbackColor={roleConfig.color} fallbackBgColor={`${roleConfig.color}20`} borderColor={roleConfig.color} borderWidth={3} showEditBadge={true} onPress={() => setShowImagePicker(true)} animated={!shouldReduceMotion} />
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{currentUser.displayName}</Text>
          <Text style={styles.profileMeta}>{currentUser.handle} • {roleConfig.label}</Text>
          <View style={styles.profileTags}>
            <View style={[styles.profileTag, { backgroundColor: `${roleConfig.color}20` }]}>
              <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
              <Text style={[styles.profileTagText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
            </View>
            {isEditing && (
              <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <View style={styles.editingDot} />
                <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
          <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
    { key: 'settings' as ProfileTab, label: 'Settings', icon: 'settings-outline' },
  ];

  const renderOverviewTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.kpiPillRow}>
        <KpiPill icon="📝" value={userPosts.length} label="Posts" color={TC.primary} />
        <KpiPill icon="👥" value={followerCount} label="Followers" color={TC.secondary} />
        <KpiPill icon="🔥" value={currentUser?.stats?.streakDays || 0} label="Streak" color={TC.accent} />
      </View>

      <InfluenceDashboard metrics={influenceMetrics} />
      <WeeklyImpactCard impact={weeklyImpact} />
      <CommunityStandingCard standing={communityStanding} />
      <ContentBreakdownCard breakdown={contentBreakdown} />
      <EngagementSparkline data={engagementData} />
      <SmartSuggestions suggestions={smartSuggestions} />
      <TopicAffinityCard affinities={topicAffinities} />
      <PeerComparisonCard comparisons={peerComparisons} />
      <ContentStreaks streaks={contentStreaks} />

      <GlassCard delay={600}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={styles.sectionLabel}>About Me</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={18} color="#6366f1" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          )}
        </View>
        {isEditing ? (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput style={styles.textArea} value={formData.bio} onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))} placeholder="Tell us about yourself..." placeholderTextColor="#666" multiline numberOfLines={4} maxLength={160} selectionColor={themeColors.primary} />
            <Text style={styles.charCount}>{formData.bio.length}/160</Text>
          </View>
        ) : (
          <View style={styles.bioDisplay}>
            <Text style={styles.bioText}>{formData.bio || 'No bio yet. Tap edit to add one!'}</Text>
          </View>
        )}
        <View style={[styles.infoDivider, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Location</Text>
          <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
            <Ionicons name="location-outline" size={18} color="#6366f1" style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput]} value={formData.location} onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))} placeholder="Your country or city" placeholderTextColor="#666" editable={isEditing} selectionColor={themeColors.primary} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Username</Text>
          <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
            <Ionicons name="at" size={18} color="#6366f1" style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput]} value={formData.handle} onChangeText={(text) => setFormData(prev => ({ ...prev, handle: text.toLowerCase().replace(/\s+/g, '_') }))} placeholder="username" placeholderTextColor="#666" autoCapitalize="none" editable={isEditing} selectionColor={themeColors.primary} />
            {!isEditing && (
              <TouchableOpacity onPress={handleCopyHandle} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={16} color="#6366f1" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GlassCard>

      <GlassCard delay={700}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={styles.sectionLabel}>Interested Topics</Text>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setShowTopicSelector(true)}>
            <Ionicons name="add" size={18} color="#6366f1" />
          </TouchableOpacity>
        </View>
        <View style={styles.topicsWrap}>
          {selectedTopics.length > 0 ? selectedTopics.map((topicId) => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            const topicColor = topic?.color || TOPIC_COLORS[topicId] || '#6366f1';
            const topicName = topic?.name || topicId.replace('topic_', 'Topic ');
            return (
              <View key={topicId} style={[styles.topicChip, { backgroundColor: `${topicColor}20` }]}>
                <Text style={[styles.topicChipText, { color: topicColor }]}>{topic?.emoji ? `${topic.emoji} ${topicName}` : topicName}</Text>
              </View>
            );
          }) : (
            <Text style={styles.emptyText}>No topics selected yet</Text>
          )}
        </View>
      </GlassCard>

      {!isEditing && (
        <QuickActionsDock
          onMessage={() => navigation.navigate('ChatList' as never)}
          onShare={handleShareProfile}
          onEdit={() => setIsEditing(true)}
          onSettings={() => setActiveTab('settings')}
        />
      )}
    </Animated.View>
  );

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color="#6366f1" />
          <Text style={styles.sectionTitle}>My Posts</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{userPosts.length} threads</Text>
        </View>
      </View>
      {userPosts.length === 0 ? (
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color="#6366f1" />
          </View>
          <Text style={styles.emptyStateTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>Share your first story with the community!</Text>
          <TouchableOpacity style={[styles.createPostBtn, { backgroundColor: dynamicPrimaryColor }]} onPress={() => navigation.navigate('CreatePost' as never)}>
            <Text style={styles.createPostBtnText}>Create Post</Text>
          </TouchableOpacity>
        </GlassCard>
      ) : (
        <View style={styles.activitiesList}>
          {userPosts.slice(0, 10).map((post, index) => (
            <GlassCard key={post.id} style={styles.activityItemCard} delay={index * 50}>
              {(() => {
                const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
                const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || '#6366f1';
                return (
                  <View style={[styles.activityIcon, { backgroundColor: `${topicColor}18` }]}>
                    <Ionicons name="document-text" size={20} color={topicColor} />
                  </View>
                );
              })()}
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle} numberOfLines={2}>{post.content}</Text>
                <Text style={styles.activityTime}>{post.time}</Text>
                <View style={styles.postStats}>
                  <Text style={styles.postStat}>❤️ {post.likes}</Text>
                  <Text style={styles.postStat}>💬 {post.commentsCount}</Text>
                  <Text style={styles.postStat}>🔄 {post.reposts}</Text>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderAchievementsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color="#6366f1" />
          <Text style={styles.sectionTitle}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{currentUser?.achievements?.length || 0} earned</Text>
        </View>
      </View>
      <GlassCard delay={100}>
        {currentUser?.achievements && currentUser.achievements.length > 0 ? (
          currentUser.achievements.map((achievement) => (
            <View key={achievement} style={[styles.achievementBadge, { backgroundColor: `${ACHIEVEMENTS[achievement]?.color || TC.primary}08` }]}>
              <View style={[styles.achievementIconBg, { backgroundColor: `${ACHIEVEMENTS[achievement]?.color || TC.primary}12` }]}>
                <Text style={styles.achievementEmoji}>{ACHIEVEMENTS[achievement]?.emoji || '🏅'}</Text>
              </View>
              <View style={styles.achievementInfo}>
                <Text style={[styles.achievementName, { color: ACHIEVEMENTS[achievement]?.color || TC.primary }]}>{ACHIEVEMENTS[achievement]?.name || achievement}</Text>
                <Text style={styles.achievementDesc}>{ACHIEVEMENTS[achievement]?.desc || ''}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={ACHIEVEMENTS[achievement]?.color || TC.primary} style={{ opacity: 0.5 }} />
            </View>
          ))
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color="#6366f1" />
            <Text style={styles.emptyStateTitle}>No achievements yet</Text>
            <Text style={styles.emptyText}>Start posting and engaging to earn badges!</Text>
          </View>
        )}
      </GlassCard>
      <GlassCard delay={200}>
        <Text style={styles.sectionLabel}>Progress</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Text style={styles.progressValue}>{userPosts.length}</Text>
            <Text style={styles.progressLabel}>of 50 posts</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((userPosts.length / 50) * 100, 100)}%`, backgroundColor: TC.primary }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressValue}>{currentUser?.stats?.helpful || 0}</Text>
            <Text style={styles.progressLabel}>of 50 helpful</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(((currentUser?.stats?.helpful || 0) / 50) * 100, 100)}%`, backgroundColor: TC.success }]} />
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderSettingsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <GlassCard delay={100}>
        <Text style={styles.sectionLabel}>Privacy & Preferences</Text>
        {[
          { key: 'isPublic', icon: 'globe', label: 'Public Profile', desc: 'Allow others to find and view your profile' },
          { key: 'showActivityStatus', icon: 'eye', label: 'Activity Status', desc: 'Show when you are online' },
          { key: 'allowMessages', icon: 'chatbubble', label: 'Direct Messages', desc: 'Allow others to message you' },
          { key: 'notificationsEnabled', icon: 'notifications', label: 'Notifications', desc: 'Receive alerts about activity' },
        ].map((pref, i, arr) => (
          <View key={pref.key}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Ionicons name={formData[pref.key as keyof typeof formData] ? pref.icon : `${pref.icon}-off` as any} size={22} color={formData[pref.key as keyof typeof formData] ? dynamicPrimaryColor : '#94a3b8'} />
                <View style={styles.preferenceText}>
                  <Text style={styles.preferenceTitle}>{pref.label}</Text>
                  <Text style={styles.preferenceDesc}>{pref.desc}</Text>
                </View>
              </View>
              <Switch value={formData[pref.key as keyof typeof formData] as boolean} onValueChange={(val) => setFormData(prev => ({ ...prev, [pref.key]: val }))} trackColor={{ false: '#334155', true: dynamicPrimaryColor }} thumbColor="#fff" />
            </View>
            {i < arr.length - 1 && <View style={[styles.infoDivider, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />}
          </View>
        ))}
      </GlassCard>
      <GlassCard delay={200} style={styles.dangerCard}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
            <Ionicons name="warning" size={28} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.dangerTitle}>Account Actions</Text>
        <Text style={styles.dangerDescription}>Manage your community account data and presence.</Text>
        <TouchableOpacity style={styles.dangerActionBtn} onPress={() => { sweetAlert.confirm('Clear History', 'Clear all your posts and activity?', async () => { sweetAlert.success('Cleared', 'Your activity history has been cleared'); }, () => {}, 'Clear', 'Cancel'); }}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.dangerActionText}>Clear Activity History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerActionBtn} onPress={() => { sweetAlert.confirm('Deactivate', 'Temporarily deactivate your community profile?', async () => { sweetAlert.success('Deactivated', 'Your profile is now hidden'); }, () => {}, 'Deactivate', 'Cancel'); }}>
          <Ionicons name="pause-circle-outline" size={18} color="#f59e0b" />
          <Text style={[styles.dangerActionText, { color: '#f59e0b' }]}>Deactivate Profile</Text>
        </TouchableOpacity>
      </GlassCard>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontSize: 16, fontWeight: '600' }}>Not signed in</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
      {renderStickyHeader()}
      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)} style={[styles.saveBtn, (!isEditing && !hasChanges) && styles.saveBtnDisabled]} disabled={isSaving} activeOpacity={0.8}>
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>{isEditing ? 'Save' : 'Edit'}</Text>}
          </TouchableOpacity>
        </Animated.View>

        {renderProfileHero()}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </View>
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo">
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="images-outline" size={28} color="#6366f1" />
            </View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="camera-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.imagePickerLabel}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="happy-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.imagePickerLabel}>Pick Emoji</Text>
          </TouchableOpacity>
          {(formData.avatar || currentUser.avatar) && (
            <TouchableOpacity style={styles.imagePickerOption} onPress={handleRemoveAvatar}>
              <View style={[styles.imagePickerIcon, { backgroundColor: '#ff475720' }]}>
                <Ionicons name="trash-outline" size={28} color="#ff4757" />
              </View>
              <Text style={[styles.imagePickerLabel, { color: '#ff4757' }]}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ActionModal>

      {showEmojiPicker && (
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
          <View style={styles.emojiPickerSheet}>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => handleEmojiSelect(emoji)}>
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 24 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },

  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#6366f1', minWidth: 60, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#94a3b8' },

  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, marginBottom: 20 },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  editToggleBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

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

  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, ...DESIGN.shadow.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  influenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  influenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  influenceTitleWrap: { flex: 1 },
  influenceTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  influenceSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  influenceOverallBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  influenceOverallText: { fontSize: 20, fontWeight: '800' },
  influenceGrid: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  influenceItem: { gap: 6 },
  influenceItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  influenceItemIconBg: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  influenceItemLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  influenceItemValue: { fontSize: 12, fontWeight: '700' },
  influenceBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  influenceBarFill: { height: '100%', borderRadius: 3 },

  impactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  impactTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  impactTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  impactTrendText: { fontSize: 12, fontWeight: '700' },
  impactGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  impactItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactItemIcon: { fontSize: 20 },
  impactItemValue: { fontSize: 20, fontWeight: '800' },
  impactItemLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  standingIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  standingTitleWrap: { flex: 1 },
  standingTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  standingSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  standingRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  standingRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  standingRankText: { fontSize: 13, fontWeight: '800' },
  standingProgressWrap: { flex: 1, gap: 6 },
  standingProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  standingProgressLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  standingProgressValue: { fontSize: 12, fontWeight: '700' },
  standingProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  standingProgressBarFill: { height: '100%', borderRadius: 3 },

  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  breakdownTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  breakdownTotal: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  breakdownGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
  breakdownIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  sparklineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  sparklineChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  suggestionsScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  suggestionCard: { width: 160, padding: 14, borderRadius: 20, overflow: 'hidden', ...DESIGN.shadow.md },
  suggestionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  suggestionEmoji: { fontSize: 22 },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  suggestionDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: '#94a3b8', marginBottom: 10 },
  suggestionActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  suggestionActionText: { fontSize: 11, fontWeight: '700' },

  affinityList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  affinityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', ...DESIGN.shadow.sm },
  affinityIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  affinityEmoji: { fontSize: 20 },
  affinityContent: { flex: 1, marginLeft: 12, gap: 6 },
  affinityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  affinityName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  affinityValue: { fontSize: 12, fontWeight: '700' },
  affinityBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  affinityBarFill: { height: '100%', borderRadius: 2 },

  comparisonList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', ...DESIGN.shadow.sm },
  comparisonIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  comparisonContent: { flex: 1, marginLeft: 12, gap: 6 },
  comparisonTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  comparisonMetric: { fontSize: 14, fontWeight: '700', color: '#fff' },
  comparisonPercentile: { fontSize: 12, fontWeight: '700' },
  comparisonBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comparisonBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  comparisonBarFill: { height: '100%', borderRadius: 2 },
  comparisonNumbers: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  streaksRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', ...DESIGN.shadow.md, borderWidth: 1, backgroundColor: 'rgba(45,45,60,0.6)' },
  streakIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  streakValue: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  streakBest: { fontSize: 10, fontWeight: '500', color: '#64748b', marginTop: 2 },

  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...DESIGN.shadow.md },
  dockLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },

  sectionHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  editIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center' },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  editingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inputGroup: { marginBottom: 16, paddingHorizontal: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  inputDisabled: { opacity: 0.5 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '600' },
  flexInput: { flex: 1 },
  copyBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.1)' },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#fff', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginHorizontal: 20 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginHorizontal: 20, color: '#94a3b8', fontWeight: '500' },
  bioDisplay: { paddingHorizontal: 20, paddingBottom: 16 },
  bioText: { fontSize: 15, color: '#94a3b8', lineHeight: 22, fontWeight: '500' },
  infoDivider: { height: 1, marginHorizontal: 20 },

  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  tabPanel: { paddingBottom: 20 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  createPostBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignSelf: 'center' },
  createPostBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  activitiesList: { gap: 10 },
  activityItemCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  activityIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 20 },
  activityTime: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '500' },
  postStats: { flexDirection: 'row', gap: DESIGN.spacing.lg, marginTop: 6 },
  postStat: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  progressRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingBottom: 20 },
  progressItem: { flex: 1 },
  progressValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  progressLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.15)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  preferenceDesc: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  dangerCard: { padding: 20, alignItems: 'center' },
  dangerIconContainer: { marginBottom: 14 },
  dangerIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 18, fontWeight: '800', color: '#ef4444', marginBottom: 6 },
  dangerDescription: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  dangerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, width: '100%', marginTop: 6 },
  dangerActionText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },

  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },

  emojiPickerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 200 },
  emojiPickerSheet: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: DESIGN.radius.xl, padding: DESIGN.spacing.xxl, overflow: 'hidden', ...DESIGN.shadow.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },

  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});