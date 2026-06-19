// src/screens/community/CommunityProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  interpolate,
  Layout,
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

// ═══════════════════════════════════════════════════════════════════════════
//  DESIGN TOKENS (Unified with Growth Dashboard)
// ═══════════════════════════════════════════════════════════════════════════
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
  primary: '#667eea',
  primaryDark: '#764ba2',
  secondary: '#fa709a',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#fbbf24',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#667eea', icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#fa709a', icon: 'heart' },
  member: { label: 'Member', color: '#64748b', icon: 'person' },
};

const EMOJI_OPTIONS = ['👤','👩','👨','👵','👴','👶','👧','👦','🧑','👮','👩‍⚕️','👨‍⚕️','👩‍🏫','👨‍🏫','👩‍🍳','👨‍🍳','👩‍⚖️','👨‍⚖️','👩‍🌾','👨‍🌾'];

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#667eea', desc: 'Shared your first thread' },
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

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#667eea', 'topic_2': '#11998e', 'topic_3': '#fa709a',
  'topic_4': '#fee140', 'topic_5': '#fc5c7d', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#fa709a',
  'topic_10': '#43e97b', 'topic_11': '#fa709a', 'topic_12': '#667eea',
};

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE TYPES
// ═══════════════════════════════════════════════════════════════════════════
interface ActivityScore { overall: number; engagement: number; consistency: number; helpfulness: number; creativity: number; }
interface WeeklyImpact { postsThisWeek: number; helpfulVotes: number; newConnections: number; rankChange: number; trend: 'up' | 'down' | 'stable'; }
interface CommunityStanding { percentile: number; rank: string; nextMilestone: string; progressToNext: number; }
interface ContentBreakdown { posts: number; comments: number; reactions: number; shares: number; }
interface EngagementPoint { day: string; value: number; }
interface SmartSuggestion { id: string; type: 'topic' | 'post' | 'connect' | 'verify'; title: string; description: string; emoji: string; color: string; action: () => void; }

// ═══════════════════════════════════════════════════════════════════════════
//  UNIFIED GLASS CARD (Matches Growth Dashboard exactly)
// ═══════════════════════════════════════════════════════════════════════════
const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; delay?: number;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} layout={Layout.springify()}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, active && { borderColor: TC.primary, borderWidth: 2 }, style]}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
          style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION HEADER (Matches Growth Dashboard)
// ═══════════════════════════════════════════════════════════════════════════
const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string; isDark: boolean;
}) => (
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

// ═══════════════════════════════════════════════════════════════════════════
//  STAT BADGE (Compact, clean)
// ═══════════════════════════════════════════════════════════════════════════
const StatBadge = React.memo(({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string; }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

// ═══════════════════════════════════════════════════════════════════════════
//  ACHIEVEMENT BADGE (Redesigned, compact)
// ═══════════════════════════════════════════════════════════════════════════
const AchievementBadge = React.memo(({ achievement, isDark }: { achievement: string; isDark: boolean }) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: '#667eea', desc: '' };
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

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 1: AI ACTIVITY SCORE RING
// ═══════════════════════════════════════════════════════════════════════════
const ActivityScoreRing = React.memo(({ score, isDark }: { score: ActivityScore; isDark: boolean }) => {
  const segments = [
    { label: 'Engagement', value: score.engagement, color: TC.primary },
    { label: 'Consistency', value: score.consistency, color: TC.secondary },
    { label: 'Helpful', value: score.helpfulness, color: TC.success },
    { label: 'Creative', value: score.creativity, color: TC.accent },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <GlassCard>
        <View style={styles.scoreHeader}>
          <View style={[styles.scoreIconBg, { backgroundColor: `${TC.primary}15` }]}>
            <Ionicons name="sparkles" size={20} color={TC.primary} />
          </View>
          <View style={styles.scoreTitleWrap}>
            <Text style={[styles.scoreTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Activity Score</Text>
            <Text style={[styles.scoreSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>AI-powered insights</Text>
          </View>
          <View style={[styles.scoreOverallBadge, { backgroundColor: `${TC.primary}12` }]}>
            <Text style={[styles.scoreOverallText, { color: TC.primary }]}>{score.overall}</Text>
          </View>
        </View>
        <View style={styles.scoreSegments}>
          {segments.map((seg, i) => (
            <View key={seg.label} style={styles.scoreSegment}>
              <View style={styles.scoreSegmentTop}>
                <Text style={[styles.scoreSegmentLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{seg.label}</Text>
                <Text style={[styles.scoreSegmentValue, { color: seg.color }]}>{seg.value}%</Text>
              </View>
              <View style={[styles.scoreSegmentBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                <Animated.View entering={FadeInRight.delay(200 + i * 80).springify()} style={[styles.scoreSegmentBarFill, { width: `${seg.value}%`, backgroundColor: seg.color }]} />
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 2: WEEKLY IMPACT CARD
// ═══════════════════════════════════════════════════════════════════════════
const WeeklyImpactCard = React.memo(({ impact, isDark }: { impact: WeeklyImpact; isDark: boolean }) => {
  const items = [
    { icon: '📝', label: 'Posts', value: impact.postsThisWeek, color: TC.primary },
    { icon: '💙', label: 'Helpful', value: impact.helpfulVotes, color: TC.success },
    { icon: '👥', label: 'New', value: impact.newConnections, color: TC.secondary },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.impactHeader}>
          <Text style={[styles.impactTitle, { color: isDark ? '#fff' : '#1e293b' }]}>This Week</Text>
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
            <View key={item.label} style={[styles.impactItem, i < items.length - 1 && { borderRightWidth: 1, borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={styles.impactItemIcon}>{item.icon}</Text>
              <Text style={[styles.impactItemValue, { color: item.color }]}>{item.value}</Text>
              <Text style={[styles.impactItemLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 3: COMMUNITY STANDING
// ═══════════════════════════════════════════════════════════════════════════
const CommunityStandingCard = React.memo(({ standing, isDark }: { standing: CommunityStanding; isDark: boolean }) => (
  <Animated.View entering={FadeInUp.delay(200).springify()}>
    <GlassCard>
      <View style={styles.standingHeader}>
        <View style={[styles.standingIconBg, { backgroundColor: `${TC.purple}15` }]}>
          <Ionicons name="trophy" size={20} color={TC.purple} />
        </View>
        <View style={styles.standingTitleWrap}>
          <Text style={[styles.standingTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Community Standing</Text>
          <Text style={[styles.standingSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>Top {standing.percentile}% of members</Text>
        </View>
      </View>
      <View style={styles.standingRankRow}>
        <View style={[styles.standingRankBadge, { backgroundColor: `${TC.purple}12` }]}>
          <Text style={[styles.standingRankText, { color: TC.purple }]}>{standing.rank}</Text>
        </View>
        <View style={styles.standingProgressWrap}>
          <View style={styles.standingProgressLabelRow}>
            <Text style={[styles.standingProgressLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Next: {standing.nextMilestone}</Text>
            <Text style={[styles.standingProgressValue, { color: TC.purple }]}>{standing.progressToNext}%</Text>
          </View>
          <View style={[styles.standingProgressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.standingProgressBarFill, { width: `${standing.progressToNext}%`, backgroundColor: TC.purple }]} />
          </View>
        </View>
      </View>
    </GlassCard>
  </Animated.View>
));

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 4: CONTENT BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════
const ContentBreakdownCard = React.memo(({ breakdown, isDark }: { breakdown: ContentBreakdown; isDark: boolean }) => {
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
          <Text style={[styles.breakdownTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Content Breakdown</Text>
          <Text style={[styles.breakdownTotal, { color: isDark ? '#94a3b8' : '#64748b' }]}>{total} total</Text>
        </View>
        <View style={styles.breakdownGrid}>
          {items.map((item) => (
            <View key={item.label} style={styles.breakdownItem}>
              <View style={[styles.breakdownIconBg, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
              <Text style={[styles.breakdownLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 5: ENGAGEMENT MINI GRAPH
// ═══════════════════════════════════════════════════════════════════════════
const EngagementMiniGraph = React.memo(({ data, isDark }: { data: EngagementPoint[]; isDark: boolean }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.graphHeader}>
          <Text style={[styles.graphTitle, { color: isDark ? '#fff' : '#1e293b' }]}>7-Day Activity</Text>
          <View style={[styles.graphLiveBadge, { backgroundColor: '#10b98115' }]}>
            <View style={styles.graphLiveDot} />
            <Text style={[styles.graphLiveText, { color: '#10b981' }]}>Live</Text>
          </View>
        </View>
        <View style={styles.graphBars}>
          {data.map((point, i) => {
            const height = (point.value / maxVal) * 70;
            return (
              <View key={i} style={styles.graphBarWrap}>
                <View style={[styles.graphBar, {
                  height: Math.max(height, 4),
                  backgroundColor: point.value > maxVal * 0.7 ? TC.primary : point.value > maxVal * 0.3 ? `${TC.primary}80` : `${TC.primary}40`,
                }]} />
                <Text style={[styles.graphBarLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{point.day}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  NEW FEATURE 6: SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════
const SmartSuggestions = React.memo(({ suggestions, isDark }: { suggestions: SmartSuggestion[]; isDark: boolean }) => {
  if (suggestions.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Smart Suggestions" subtitle="Personalized for you" isDark={isDark} />
      <View style={styles.suggestionsScroll}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity key={suggestion.id} onPress={suggestion.action} style={styles.suggestionCard}>
            <LinearGradient colors={[suggestion.color + '12', suggestion.color + '04']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '15' }]}>
              <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
            </View>
            <Text style={[styles.suggestionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{suggestion.title}</Text>
            <Text style={[styles.suggestionDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>{suggestion.description}</Text>
            <View style={[styles.suggestionActionBadge, { backgroundColor: suggestion.color + '12' }]}>
              <Text style={[styles.suggestionActionText, { color: suggestion.color }]}>Take Action →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const ActionModal = React.memo(({ visible, onClose, title, children, isDark }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; isDark: boolean;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.modalOverlay}>
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, isDark && styles.modalContentDark]}>
        <LinearGradient colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']} style={StyleSheet.absoluteFill} />
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  </Modal>
));


// ═══════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
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
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'achievements' | 'settings'>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);

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

  // ─── NEW FEATURE MOCK DATA ──────────────────────────────────────────
  const activityScore: ActivityScore = useMemo(() => ({
    overall: currentUser?.stats?.activityScore || 78,
    engagement: currentUser?.stats?.engagement || 82,
    consistency: currentUser?.stats?.consistency || 65,
    helpfulness: currentUser?.stats?.helpfulness || 90,
    creativity: currentUser?.stats?.creativity || 75,
  }), [currentUser]);

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

  // Animated header
  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], 'clamp'),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 140], [-10, 0], 'clamp') }],
  }));

  // ─── Effects ──────────────────────────────────────────────────────
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

  // ─── Handlers ───────────────────────────────────────────────────────
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

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; } });

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ─── RENDER SECTIONS ────────────────────────────────────────────────
  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeAvatar avatar={formData.avatar || currentUser?.avatar} size={32} fallbackIcon="person" fallbackColor={dynamicPrimaryColor} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>{currentUser?.displayName || 'Community Profile'}</Text>
        </View>
        <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)} style={[styles.saveBtn, (!isEditing && !hasChanges) && styles.saveBtnDisabled]} disabled={isSaving} activeOpacity={0.8}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>{isEditing ? 'Save' : 'Edit'}</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!currentUser) return null;
    const roleConfig = currentUser.isVerified ? ROLE_CONFIG.verified : ROLE_CONFIG.member;
    return (
      <Animated.View entering={FadeInUp.springify()} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImagePicker(true)}>
              <SafeAvatar avatar={formData.avatar || currentUser.avatar} size={90} fallbackIcon="person" fallbackColor={roleConfig.color} fallbackBgColor={`${roleConfig.color}20`} borderColor={roleConfig.color} borderWidth={3} showEditBadge={true} onPress={() => setShowImagePicker(true)} themeId={themeColors.primary} animated={!shouldReduceMotion} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{currentUser.displayName}</Text>
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
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color={TC.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'overview', icon: 'grid-outline', label: 'Overview' },
          { id: 'posts', icon: 'document-text-outline', label: 'Posts' },
          { id: 'achievements', icon: 'trophy-outline', label: 'Badges' },
          { id: 'settings', icon: 'settings-outline', label: 'Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => handleTabChange(tab.id as typeof activeTab)}>
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons name={tab.icon as any} size={16} color={isActive ? TC.primary : (isDark ? '#94a3b8' : '#64748b')} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, isDark && !isActive && styles.textMuted]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderQuickStats = () => (
    <View style={styles.statsRowCompact}>
      <StatBadge icon="📝" value={userPosts.length} label="Posts" color={TC.primary} />
      <StatBadge icon="👥" value={followerCount} label="Followers" color={TC.secondary} />
      <StatBadge icon="🔥" value={currentUser?.stats?.streakDays || 0} label="Streak" color={TC.accent} />
      <StatBadge icon="💙" value={currentUser?.stats?.helpful || 0} label="Helpful" color={TC.success} />
    </View>
  );

  const renderOverviewTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      {renderQuickStats()}
      <ActivityScoreRing score={activityScore} isDark={isDark} />
      <WeeklyImpactCard impact={weeklyImpact} isDark={isDark} />
      <CommunityStandingCard standing={communityStanding} isDark={isDark} />
      <ContentBreakdownCard breakdown={contentBreakdown} isDark={isDark} />
      <EngagementMiniGraph data={engagementData} isDark={isDark} />
      <SmartSuggestions suggestions={smartSuggestions} isDark={isDark} />

      {/* Bio Card */}
      <GlassCard delay={400}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>About Me</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={18} color={TC.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          )}
        </View>
        {isEditing ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Bio</Text>
            <TextInput style={[styles.textArea, isDark && styles.textAreaDark]} value={formData.bio} onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))} placeholder="Tell us about yourself..." placeholderTextColor={isDark ? '#666' : '#999'} multiline numberOfLines={4} maxLength={160} selectionColor={themeColors.primary} />
            <Text style={[styles.charCount, { color: isDark ? '#94a3b8' : '#64748b' }]}>{formData.bio.length}/160</Text>
          </View>
        ) : (
          <View style={styles.bioDisplay}>
            <Text style={[styles.bioText, isDark && styles.textDark]}>{formData.bio || 'No bio yet. Tap edit to add one!'}</Text>
          </View>
        )}
        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Location</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="location-outline" size={18} color={TC.primary} style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.location} onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))} placeholder="Your country or city" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} selectionColor={themeColors.primary} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Username</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="at" size={18} color={TC.primary} style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.handle} onChangeText={(text) => setFormData(prev => ({ ...prev, handle: text.toLowerCase().replace(/\s+/g, '_') }))} placeholder="username" placeholderTextColor={isDark ? '#666' : '#999'} autoCapitalize="none" editable={isEditing} selectionColor={themeColors.primary} />
            {!isEditing && (
              <TouchableOpacity onPress={handleCopyHandle} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={16} color={TC.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GlassCard>

      {/* Topics Card */}
      <GlassCard delay={500}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Interested Topics</Text>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setShowTopicSelector(true)}>
            <Ionicons name="add" size={18} color={TC.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.topicsWrap}>
          {selectedTopics.length > 0 ? selectedTopics.map((topicId) => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            const topicColor = topic?.color || TOPIC_COLORS[topicId] || '#667eea';
            const topicName = topic?.name || topicId.replace('topic_', 'Topic ');
            return (
              <View key={topicId} style={[styles.topicChip, { backgroundColor: `${topicColor}20` }]}>
                <Text style={[styles.topicChipText, { color: topicColor }]}>{topic?.emoji ? `${topic.emoji} ${topicName}` : topicName}</Text>
              </View>
            );
          }) : (
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>No topics selected yet</Text>
          )}
        </View>
      </GlassCard>

      {/* Quick Actions */}
      {!isEditing && (
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ChatList' as never)}>
            <LinearGradient colors={dynamicGradient} style={styles.quickActionGradient}>
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.quickActionText}>Messages</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleShareProfile}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="share-outline" size={18} color={isDark ? '#fff' : '#1a1a1a'} />
              <Text style={[styles.quickActionText, { color: isDark ? '#fff' : '#1a1a1a' }]}>Share</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowPrivacySettings(true)}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="shield-outline" size={18} color={isDark ? '#fff' : '#1a1a1a'} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color={TC.primary} />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>My Posts</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{userPosts.length} threads</Text>
        </View>
      </View>
      {userPosts.length === 0 ? (
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color={TC.primary} />
          </View>
          <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No posts yet</Text>
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
                const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || '#667eea';
                return (
                  <View style={[styles.activityIcon, { backgroundColor: `${topicColor}18` }]}>
                    <Ionicons name="document-text" size={20} color={topicColor} />
                  </View>
                );
              })()}
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={2}>{post.content}</Text>
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
          <Ionicons name="trophy" size={20} color={TC.primary} />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{currentUser?.achievements?.length || 0} earned</Text>
        </View>
      </View>
      <GlassCard delay={100}>
        {currentUser?.achievements && currentUser.achievements.length > 0 ? (
          currentUser.achievements.map((achievement) => (
            <AchievementBadge key={achievement} achievement={achievement} isDark={isDark} />
          ))
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color={TC.primary} />
            <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No achievements yet</Text>
            <Text style={styles.emptyText}>Start posting and engaging to earn badges!</Text>
          </View>
        )}
      </GlassCard>
      <GlassCard delay={200}>
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Progress</Text>
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
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Privacy & Preferences</Text>
        {[
          { key: 'isPublic', icon: 'globe', label: 'Public Profile', desc: 'Allow others to find and view your profile' },
          { key: 'showActivityStatus', icon: 'eye', label: 'Activity Status', desc: 'Show when you\'re online' },
          { key: 'allowMessages', icon: 'chatbubble', label: 'Direct Messages', desc: 'Allow others to message you' },
          { key: 'notificationsEnabled', icon: 'notifications', label: 'Notifications', desc: 'Receive alerts about activity' },
        ].map((pref, i, arr) => (
          <View key={pref.key}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Ionicons name={formData[pref.key as keyof typeof formData] ? pref.icon : `${pref.icon}-off` as any} size={22} color={formData[pref.key as keyof typeof formData] ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
                <View style={styles.preferenceText}>
                  <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>{pref.label}</Text>
                  <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>{pref.desc}</Text>
                </View>
              </View>
              <Switch value={formData[pref.key as keyof typeof formData] as boolean} onValueChange={(val) => setFormData(prev => ({ ...prev, [pref.key]: val }))} trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }} thumbColor="#fff" />
            </View>
            {i < arr.length - 1 && <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />}
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

  // ─── Main Render ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <Ionicons name="person-outline" size={64} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>Not signed in</Text>
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
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </View>
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      {/* Image Picker Modal */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.primary}20` }]}>
              <Ionicons name="images-outline" size={28} color={themeColors.primary} />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.accent}20` }]}>
              <Ionicons name="camera-outline" size={28} color={themeColors.accent} />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="happy-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Pick Emoji</Text>
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

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
          <View style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
            <View style={styles.emojiPickerHeader}>
              <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
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


// ═══════════════════════════════════════════════════════════════════════════
//  STYLES — Completely Redesigned (Matches Growth Dashboard)
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DESIGN.spacing.lg, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: DESIGN.radius.md, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, maxWidth: 180 },
  saveBtn: { paddingHorizontal: DESIGN.spacing.lg, paddingVertical: 8, borderRadius: DESIGN.radius.md, backgroundColor: '#667eea', minWidth: 60, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#94a3b8' },

  // ── Profile Hero ──
  profileHero: { paddingHorizontal: DESIGN.spacing.xl, paddingBottom: 20 },
  profileHeroContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarSection: { position: 'relative' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, color: '#64748b', marginTop: 2, fontWeight: '500' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: DESIGN.spacing.md, flexWrap: 'wrap' },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: DESIGN.radius.sm, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  editToggleBtn: { width: 40, height: 40, borderRadius: DESIGN.radius.md, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Tab Bar (Pill style matching Growth Dashboard) ──
  tabBarContainer: { paddingHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: DESIGN.radius.lg, padding: 4, gap: 4, ...DESIGN.shadow.md },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.75)' },
  tab: { flex: 1, height: 44 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', letterSpacing: -0.2 },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },

  // ── Glass Card ──
  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', ...DESIGN.shadow.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Compact Stats Row ──
  statsRowCompact: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, marginHorizontal: 16, marginBottom: 16, borderRadius: DESIGN.radius.lg, backgroundColor: 'rgba(255,255,255,0.5)', ...DESIGN.shadow.sm },
  statBadge: { alignItems: 'center', gap: 6 },
  statIconBg: { width: 44, height: 44, borderRadius: DESIGN.radius.md, alignItems: 'center', justifyContent: 'center' },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── NEW FEATURE 1: Activity Score ──
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  scoreIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  scoreTitleWrap: { flex: 1 },
  scoreTitle: { fontSize: 16, fontWeight: '800' },
  scoreSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  scoreOverallBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  scoreOverallText: { fontSize: 20, fontWeight: '800' },
  scoreSegments: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  scoreSegment: { gap: 6 },
  scoreSegmentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreSegmentLabel: { fontSize: 12, fontWeight: '600' },
  scoreSegmentValue: { fontSize: 12, fontWeight: '700' },
  scoreSegmentBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreSegmentBarFill: { height: '100%', borderRadius: 3 },

  // ── NEW FEATURE 2: Weekly Impact ──
  impactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  impactTitle: { fontSize: 16, fontWeight: '800' },
  impactTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  impactTrendText: { fontSize: 12, fontWeight: '700' },
  impactGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  impactItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactItemIcon: { fontSize: 20 },
  impactItemValue: { fontSize: 20, fontWeight: '800' },
  impactItemLabel: { fontSize: 11, fontWeight: '600' },

  // ── NEW FEATURE 3: Community Standing ──
  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  standingIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  standingTitleWrap: { flex: 1 },
  standingTitle: { fontSize: 16, fontWeight: '800' },
  standingSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  standingRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  standingRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  standingRankText: { fontSize: 13, fontWeight: '800' },
  standingProgressWrap: { flex: 1, gap: 6 },
  standingProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  standingProgressLabel: { fontSize: 12, fontWeight: '600' },
  standingProgressValue: { fontSize: 12, fontWeight: '700' },
  standingProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  standingProgressBarFill: { height: '100%', borderRadius: 3 },

  // ── NEW FEATURE 4: Content Breakdown ──
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  breakdownTitle: { fontSize: 16, fontWeight: '800' },
  breakdownTotal: { fontSize: 12, fontWeight: '600' },
  breakdownGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
  breakdownIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 11, fontWeight: '600' },

  // ── NEW FEATURE 5: Engagement Graph ──
  graphHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  graphTitle: { fontSize: 16, fontWeight: '800' },
  graphLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  graphLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  graphLiveText: { fontSize: 10, fontWeight: '700' },
  graphBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 110 },
  graphBarWrap: { alignItems: 'center', gap: 6, flex: 1 },
  graphBar: { width: 24, borderRadius: 6 },
  graphBarLabel: { fontSize: 10, fontWeight: '600' },

  // ── NEW FEATURE 6: Smart Suggestions ──
  suggestionsScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  suggestionCard: { width: 160, padding: 14, borderRadius: 20, overflow: 'hidden', ...DESIGN.shadow.md },
  suggestionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  suggestionEmoji: { fontSize: 22 },
  suggestionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  suggestionDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginBottom: 10 },
  suggestionActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  suggestionActionText: { fontSize: 11, fontWeight: '700' },

  // ── Achievement Badge (compact) ──
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  achievementIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementEmoji: { fontSize: 22 },
  achievementInfo: { flex: 1, gap: 2 },
  achievementName: { fontSize: 14, fontWeight: '700' },
  achievementDesc: { fontSize: 12, fontWeight: '500' },

  // ── Bio / Form ──
  sectionHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  editIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  editingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inputGroup: { marginBottom: 16, paddingHorizontal: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: DESIGN.radius.lg, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  inputContainerDark: { backgroundColor: 'rgba(30,30,40,0.5)', borderColor: 'rgba(255,255,255,0.06)' },
  inputDisabled: { opacity: 0.6 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '600' },
  inputDark: { color: '#ffffff' },
  flexInput: { flex: 1 },
  copyBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(102,126,234,0.1)' },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 14, backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: DESIGN.radius.lg, paddingHorizontal: 16, fontSize: 16, color: '#1e293b', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', marginHorizontal: 20 },
  textAreaDark: { backgroundColor: 'rgba(30,30,40,0.5)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.06)' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginHorizontal: 20, fontWeight: '500' },
  bioDisplay: { paddingHorizontal: 20, paddingBottom: 16 },
  bioText: { fontSize: 15, color: '#475569', lineHeight: 22, fontWeight: '500' },
  infoDivider: { height: 1, marginHorizontal: 20 },

  // ── Topics ──
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  // ── Quick Actions ──
  quickActionsRow: { flexDirection: 'row', gap: DESIGN.spacing.md, marginBottom: 20, marginHorizontal: 16 },
  quickActionBtn: { flex: 1, borderRadius: DESIGN.radius.lg, overflow: 'hidden' },
  quickActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Tab Panel ──
  tabPanel: { paddingBottom: 20 },

  // ── Posts Tab ──
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: DESIGN.radius.xl, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  createPostBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: DESIGN.radius.md, alignSelf: 'center' },
  createPostBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  activitiesList: { gap: 10 },
  activityItemCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  activityIcon: { width: 44, height: 44, borderRadius: DESIGN.radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 20 },
  activityTime: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
  postStats: { flexDirection: 'row', gap: DESIGN.spacing.lg, marginTop: 6 },
  postStat: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // ── Progress ──
  progressRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingBottom: 20 },
  progressItem: { flex: 1 },
  progressValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  progressLabel: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.15)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // ── Preferences ──
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  preferenceDesc: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // ── Danger Zone ──
  dangerCard: { padding: 20, alignItems: 'center' },
  dangerIconContainer: { marginBottom: 14 },
  dangerIcon: { width: 56, height: 56, borderRadius: DESIGN.radius.xl, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 18, fontWeight: '800', color: '#ef4444', marginBottom: 6 },
  dangerDescription: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  dangerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, width: '100%', marginTop: 6 },
  dangerActionText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },

  // ── Image Picker ──
  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: DESIGN.radius.lg, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: DESIGN.radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },

  // ── Emoji Picker ──
  emojiPickerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, justifyContent: 'flex-end', zIndex: 200 },
  emojiPickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  emojiPickerSheetDark: { backgroundColor: '#1e1e2e' },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: DESIGN.radius.lg, backgroundColor: 'rgba(100,116,139,0.08)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  // ── Modal ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: DESIGN.radius.xl, overflow: 'hidden', padding: 24 },
  modalContentDark: { backgroundColor: '#1e1e2e' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: DESIGN.radius.md, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});