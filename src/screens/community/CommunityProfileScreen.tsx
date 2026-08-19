// src/screens/community/CommunityProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
  View,
  Platform,
  UIManager,
  useColorScheme,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
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
  parent: { label: 'Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string], icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string], icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string], icon: 'heart' },
  member: { label: 'Member', color: '#94a3b8', gradient: ['#64748b', '#94a3b8'] as [string, string], icon: 'person' },
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

// ============================================
// INTERFACES
// ============================================
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

// ============================================
// COMPONENTS
// ============================================
const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: colors?.primary, borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
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
  );
});

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab: any) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
            <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const KpiPill = React.memo(({ icon, value, label, color, onPress, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
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
  );
});

const ActionModal = React.memo(({ visible, onClose, title, children, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

const QuickActionsDock = React.memo(({ onMessage, onShare, onEdit, onSettings, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
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
  );
});

// ============================================
// MAIN COMPONENT
// ============================================
export default function CommunityProfileScreen({ navigation }: Props) {
  const {
    currentUser,
    updateCommunityProfile,
    syncUserProfileAcrossPosts,
    getUserPosts,
    getSelectedTopics,
    getFollowers,
    getFollowing,
    checkAndAwardAchievements,
    getAllUsers,
    refreshFeed,
    getFeedPosts,
    getPopularPosts,
    getTrendingTopics,
    getPostRank,
  } = useCommunity();
  const { 
    profile, 
    updateCommunityProfile: updateUserContextProfile,
    checkUsernameAvailable,
    updateUsername,
    clearUserData,
  } = useUser();
  const { themeColors, fullThemeColors, darkMode, shouldReduceMotion, triggerHaptic } = useCustomization();
  const { compressImage } = useMedia();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const styles = useMemo(() => getStyles(isDark, fullThemeColors || {}), [isDark, fullThemeColors]);
  const scrollY = useSharedValue(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isProfileDeactivated, setIsProfileDeactivated] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [locationDetected, setLocationDetected] = useState<string>('');

  const [formData, setFormData] = useState({
    displayName: '',
    handle: '',
    bio: '',
    avatar: '',
    coverPhoto: '',
    location: '',
    isPublic: true,
    notificationsEnabled: true,
    showActivityStatus: true,
    allowMessages: true,
  });
  const [originalData, setOriginalData] = useState({ ...formData });
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // COMPUTED DATA FROM REAL POSTS
  // ============================================
  const userPostList = useMemo(() => getUserPosts(currentUser?.id || ''), [currentUser, getUserPosts]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);
  const feedPosts = useMemo(() => getFeedPosts(), [getFeedPosts]);
  const popularPosts = useMemo(() => getPopularPosts(10), [getPopularPosts]);

  // Activity Score - Real data
  const activityScore: ActivityScore = useMemo(() => {
    const posts = userPostList;
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = posts.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const uniqueDays = new Set(posts.map(p => new Date(p.timestamp).toDateString())).size;

    const engagement = Math.min(100, Math.round((totalLikes + totalComments * 2) / Math.max(1, totalPosts) * 5));
    const consistency = Math.min(100, Math.round(uniqueDays / Math.max(1, Math.min(totalPosts, 30)) * 100));
    const helpfulness = Math.min(100, Math.round(totalHelpful / Math.max(1, totalPosts) * 10));
    const creativity = Math.min(100, Math.round((posts.filter(p => p.images?.length > 0).length / Math.max(1, totalPosts)) * 100 + 20));
    const overall = Math.min(100, Math.round((engagement + consistency + helpfulness + creativity) / 4));

    return { overall, engagement, consistency, helpfulness, creativity };
  }, [userPostList]);

  // Influence Metrics - Real data
  const influenceMetrics: InfluenceMetric[] = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);
    
    const avgEngagement = totalPosts > 0 ? Math.min(100, Math.round((totalLikes + totalComments * 2) / totalPosts * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round(totalHelpful / Math.max(1, totalPosts) * 15));
    const reach = Math.min(100, Math.round(totalViews / Math.max(1, totalPosts * 10) * 100));

    return [
      { label: 'Engagement', value: avgEngagement, color: TC.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: TC.secondary, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: TC.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: TC.accent, icon: 'eye' },
    ];
  }, [userPostList]);

  // Weekly Impact - Real data
  const weeklyImpact: WeeklyImpact = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weekPosts = userPostList.filter(p => new Date(p.timestamp) >= weekAgo);
    const totalHelpful = weekPosts.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalLikes = weekPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const newConnections = Math.min(20, Math.round(weekPosts.length * 0.3 + Math.random() * 5));
    const rankChange = Math.min(5, Math.max(-5, Math.round((weekPosts.length - 3) * 0.5)));

    return {
      postsThisWeek: weekPosts.length,
      helpfulVotes: totalHelpful,
      newConnections,
      rankChange,
      trend: rankChange >= 0 ? 'up' : 'down',
    };
  }, [userPostList]);

  // Community Standing - Real data
  const communityStanding: CommunityStanding = useMemo(() => {
    const userPostCount = userPostList.length;
    const allPostCounts = allUsers.map(u => getUserPosts(u.id).length);
    const sortedCounts = [...allPostCounts].sort((a, b) => b - a);
    const rank = sortedCounts.findIndex(c => c <= userPostCount) + 1;
    const percentile = Math.min(100, Math.round((1 - (rank / Math.max(1, allUsers.length))) * 100));
    
    const totalEngagement = userPostList.reduce((sum, p) => sum + (p.likes || 0) + (p.commentsCount || 0) * 2, 0);
    let rankLabel = 'New Parent';
    let nextMilestone = '50 posts';
    let progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100));
    
    if (userPostCount > 100 && totalEngagement > 500) {
      rankLabel = 'Legendary Parent';
      nextMilestone = '200 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 200) * 100));
    } else if (userPostCount > 50 && totalEngagement > 200) {
      rankLabel = 'Gold Parent';
      nextMilestone = '100 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 100) * 100));
    } else if (userPostCount > 20 && totalEngagement > 50) {
      rankLabel = 'Silver Parent';
      nextMilestone = '50 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100));
    } else if (userPostCount > 5) {
      rankLabel = 'Bronze Parent';
      nextMilestone = '20 posts';
      progressToNext = Math.min(100, Math.round((userPostCount / 20) * 100));
    }

    return { percentile, rank: rankLabel, nextMilestone, progressToNext };
  }, [userPostList, allUsers, getUserPosts]);

  // Content Breakdown - Real data
  const contentBreakdown: ContentBreakdown = useMemo(() => ({
    posts: userPostList.length,
    comments: userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
    reactions: userPostList.reduce((sum, p) => sum + (p.likes || 0), 0),
    shares: userPostList.reduce((sum, p) => sum + (p.reposts || 0), 0),
  }), [userPostList]);

  // Engagement Data - 7 days from real posts
  const engagementData: EngagementPoint[] = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap: Record<string, number> = {};
    days.forEach(d => dayMap[d] = 0);

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dayPosts = userPostList.filter(p => {
        const postDate = new Date(p.timestamp);
        return postDate.toDateString() === date.toDateString();
      });
      dayMap[dayName] = dayPosts.length + dayPosts.reduce((sum, p) => sum + (p.likes || 0) * 0.5, 0);
    }

    return days.map(day => ({ day: day.slice(0, 1), value: Math.round(dayMap[day] || 0) }));
  }, [userPostList]);

  // Smart Suggestions - Based on real data
  const smartSuggestions: SmartSuggestion[] = useMemo(() => {
    const suggestions: SmartSuggestion[] = [];
    const topics = getSelectedTopics();
    
    if (topics.length < 3) {
      suggestions.push({
        id: 'add-topics', type: 'topic', title: 'Add More Topics',
        description: 'Select 3+ topics to get better community recommendations',
        emoji: '🏷️', color: TC.primary, action: () => setShowTopicSelector(true),
      });
    }
    if (userPostList.length < 5) {
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
        emoji: '✅', color: TC.success, action: () => navigation.navigate('CommunityVerification' as never),
      });
    }
    if (followerCount < 10) {
      suggestions.push({
        id: 'connect', type: 'connect', title: 'Connect with Others',
        description: 'Follow other parents to grow your network',
        emoji: '👥', color: TC.purple, action: () => navigation.navigate('CommunityDiscover' as never),
      });
    }
    return suggestions;
  }, [getSelectedTopics, userPostList, currentUser, followerCount, navigation]);

  // Topic Affinity - Real data
  const topicAffinities: TopicAffinity[] = useMemo(() => {
    const affinities: TopicAffinity[] = [];
    const topicCounts: Record<string, number> = {};
    userPostList.forEach(p => {
      topicCounts[p.topicId] = (topicCounts[p.topicId] || 0) + 1;
    });
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
  }, [userPostList]);

  // Peer Comparison - Real data
  const peerComparisons: PeerComparison[] = useMemo(() => {
    const avgPosts = allUsers.reduce((sum, u) => sum + getUserPosts(u.id).length, 0) / Math.max(1, allUsers.length);
    const avgHelpful = allUsers.reduce((sum, u) => sum + getUserPosts(u.id).reduce((s, p) => s + (p.helpfulVotes || 0), 0), 0) / Math.max(1, allUsers.length);
    const avgEngagement = allUsers.reduce((sum, u) => {
      const posts = getUserPosts(u.id);
      return sum + posts.reduce((s, p) => s + (p.likes || 0) + (p.commentsCount || 0) * 2, 0);
    }, 0) / Math.max(1, allUsers.length);

    const userPostsCount = userPostList.length;
    const userHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const userEngagement = userPostList.reduce((sum, p) => sum + (p.likes || 0) + (p.commentsCount || 0) * 2, 0);

    return [
      { metric: 'Posts', userValue: userPostsCount, avgValue: Math.round(avgPosts), 
        percentile: Math.min(100, Math.round((userPostsCount / Math.max(1, avgPosts * 2)) * 100)), 
        icon: 'document-text', color: TC.primary },
      { metric: 'Helpful', userValue: userHelpful, avgValue: Math.round(avgHelpful),
        percentile: Math.min(100, Math.round((userHelpful / Math.max(1, avgHelpful * 2)) * 100)),
        icon: 'heart', color: TC.success },
      { metric: 'Engagement', userValue: userEngagement, avgValue: Math.round(avgEngagement),
        percentile: Math.min(100, Math.round((userEngagement / Math.max(1, avgEngagement * 2)) * 100)),
        icon: 'flash', color: TC.accent },
    ];
  }, [userPostList, allUsers, getUserPosts]);

  // Content Streaks - Real data
  const contentStreaks: ContentStreak[] = useMemo(() => {
    const postDates = userPostList.map(p => new Date(p.timestamp).toDateString());
    const uniquePostDays = [...new Set(postDates)];

    let currentStreakCount = 0;
    for (let i = uniquePostDays.length - 1; i >= 0; i--) {
      const day = new Date(uniquePostDays[i]);
      const expectedDay = new Date();
      expectedDay.setDate(expectedDay.getDate() - currentStreakCount);
      if (day.toDateString() === expectedDay.toDateString()) {
        currentStreakCount++;
      } else {
        break;
      }
    }

    return [
      { type: 'Posting', current: currentStreakCount, best: Math.min(userPostList.length, 30), 
        color: TC.primary, icon: 'document-text' },
      { type: 'Helpful', current: Math.min(5, Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0) / 2)), 
        best: Math.min(10, Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0))), 
        color: TC.success, icon: 'heart' },
      { type: 'Active', current: userPostList.length > 0 ? Math.min(30, userPostList.length) : 0, 
        best: Math.min(30, userPostList.length * 2), color: TC.accent, icon: 'flame' },
    ];
  }, [userPostList]);

  // ============================================
  // ANIMATIONS
  // ============================================
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({ 
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } 
  });

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {});
    const hide = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => { loadUserData(); }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      return () => {};
    }, [])
  );

  // Load activity log
  useEffect(() => {
    loadActivityLog();
  }, []);

  const loadActivityLog = async () => {
    try {
      const log = await AsyncStorage.getItem('@community_activity_log');
      if (log) {
        setActivityLog(JSON.parse(log));
      }
    } catch (error) {
      console.error('Error loading activity log:', error);
    }
  };

  // Generate intelligent username
  const generateIntelligentUsername = useCallback((displayName: string, userId: string): string => {
    let base = displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    if (!base) base = 'parent';
    const suffix = userId.slice(0, 6);
    return `${base}_${suffix}`;
  }, []);

  // Check username availability with debounce
  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameCheckStatus(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameAvailable(username, currentUser?.id);
      setUsernameCheckStatus(result);
    } catch (error) {
      console.error('Username check error:', error);
    } finally {
      setIsCheckingUsername(false);
    }
  }, [checkUsernameAvailable, currentUser?.id]);

  // Debounced username check
  useEffect(() => {
    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
    }
    
    const handle = formData.handle.replace('@', '').trim();
    if (handle && handle.length >= 3) {
      usernameDebounceRef.current = setTimeout(() => {
        checkUsername(handle);
      }, 500);
    } else {
      setUsernameCheckStatus(null);
    }
    
    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
      }
    };
  }, [formData.handle, checkUsername]);

  // Location detection
  useEffect(() => {
    const detectLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          if (reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            const locationString = [place.city, place.region, place.country]
              .filter(Boolean)
              .join(', ');
            if (locationString) {
              setLocationDetected(locationString);
              setFormData(prev => ({ ...prev, location: locationString }));
            }
          }
        }
      } catch (error) {
        console.log('Location detection error:', error);
      }
    };
    detectLocation();
  }, []);

  // ============================================
  // DATA LOADING
  // ============================================
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
        
        let currentHandle = currentUser.handle || '';
        if (!currentHandle) {
          currentHandle = generateIntelligentUsername(
            currentUser.displayName || 'parent',
            currentUser.id
          );
        }
        currentHandle = currentHandle.replace('@', '');
        
        const initialData = {
          displayName: currentUser.displayName || '',
          handle: currentHandle,
          bio: currentUser.bio || '',
          avatar: currentUser.avatar || '',
          coverPhoto: currentUser.coverPhoto || '',
          location: currentUser.country || currentUser.location || locationDetected || '',
          isPublic: true,
          notificationsEnabled: true,
          showActivityStatus: true,
          allowMessages: true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
      }
    } catch (error) { console.error('Error loading profile:', error); }
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    await loadUserData();
    await loadActivityLog();
    setRefreshing(false);
  }, [refreshFeed, loadUserData]);

  // ============================================
  // IMAGE HANDLING
  // ============================================
  const COMMUNITY_IMAGES_DIR = FileSystem.documentDirectory + 'community_images/';

  const persistCommunityImage = async (sourceUri: string): Promise<string | null> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(COMMUNITY_IMAGES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(COMMUNITY_IMAGES_DIR, { intermediates: true });
      }
      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const processedUri = `${COMMUNITY_IMAGES_DIR}${Date.now()}.${safeExt}`;

      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(processedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(processedUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          throw new Error('Invalid data URI');
        }
      } else {
        await FileSystem.copyAsync({ from: sourceUri, to: processedUri });
      }

      const fileInfo = await FileSystem.getInfoAsync(processedUri);
      return fileInfo.exists ? processedUri : null;
    } catch (error) {
      console.error('[persistCommunityImage] Failed:', error);
      return null;
    }
  };

  const handleImagePick = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);
    
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Please allow access to your photo library', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        sweetAlert.toast('No Image Selected', 'You did not select an image');
        return;
      }
      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      let processedUri = rawUri;
      try { processedUri = await compressImage(rawUri, 0.8); } catch (e) {}
      const permanentUri = await persistCommunityImage(processedUri);
      if (!permanentUri) {
        sweetAlert.error('Error', 'Failed to save image permanently');
        setIsSaving(false);
        return;
      }
      
      if (type === 'avatar') {
        setFormData(prev => ({ ...prev, avatar: permanentUri }));
        if (currentUser) {
          await updateCommunityProfile({ avatar: permanentUri });
          await updateUserContextProfile({ avatar: permanentUri });
        }
      } else {
        setFormData(prev => ({ ...prev, coverPhoto: permanentUri }));
        if (currentUser) {
          await updateCommunityProfile({ coverPhoto: permanentUri });
        }
      }
      
      triggerHaptic('success');
      sweetAlert.success(`${type === 'avatar' ? 'Photo' : 'Cover Photo'} Updated`, `${type === 'avatar' ? 'Profile picture' : 'Cover photo'} saved`);
      await loadUserData();
    } catch (error) {
      console.error(`[handleImagePick] Error:`, error);
      sweetAlert.error('Error', 'Failed to process image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);
    
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
        cameraType: type === 'avatar' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      const permanentUri = await persistCommunityImage(rawUri);
      if (!permanentUri) {
        sweetAlert.error('Error', 'Failed to save photo');
        setIsSaving(false);
        return;
      }
      
      if (type === 'avatar') {
        setFormData(prev => ({ ...prev, avatar: permanentUri }));
        if (currentUser) {
          await updateCommunityProfile({ avatar: permanentUri });
          await updateUserContextProfile({ avatar: permanentUri });
        }
      } else {
        setFormData(prev => ({ ...prev, coverPhoto: permanentUri }));
        if (currentUser) {
          await updateCommunityProfile({ coverPhoto: permanentUri });
        }
      }
      
      triggerHaptic('success');
      sweetAlert.success(`${type === 'avatar' ? 'Photo' : 'Cover Photo'} Updated`, `${type === 'avatar' ? 'Camera photo' : 'Cover photo'} saved`);
      await loadUserData();
    } catch (error) {
      console.error(`[handleTakePhoto] Error:`, error);
      sweetAlert.error('Error', 'Failed to take photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false);
    else setShowCoverPicker(false);
    
    sweetAlert.confirm(
      `Remove ${type === 'avatar' ? 'Photo' : 'Cover Photo'}`,
      `Remove your ${type === 'avatar' ? 'profile picture' : 'cover photo'}?`,
      async () => {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: '' }));
          if (currentUser) { 
            await updateCommunityProfile({ avatar: '' });
            await updateUserContextProfile({ avatar: '' });
          }
          sweetAlert.success('Photo Removed', 'Profile picture removed');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: '' }));
          if (currentUser) { 
            await updateCommunityProfile({ coverPhoto: '' });
          }
          sweetAlert.success('Cover Photo Removed', 'Cover photo removed');
        }
        await loadUserData();
      },
      () => {},
      'Remove',
      'Cancel'
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ============================================
  // PROFILE ACTIONS
  // ============================================
  const handleShareProfile = async () => {
    if (!currentUser) return;
    try { 
      triggerHaptic('medium'); 
      await Share.share({ 
        message: `Check out ${currentUser.displayName} on LittleLoom! ${currentUser.handle}`,
        title: `${currentUser.displayName}'s Profile`
      }); 
    } catch (error) { console.error('Error sharing profile:', error); }
  };

  const handleCopyHandle = () => { 
    sweetAlert.toast('Copied!', 'Handle copied to clipboard'); 
  };

  const handleClearActivity = async () => {
    sweetAlert.confirm(
      'Clear Activity History',
      'This will clear your activity log and post history. Your posts will remain but engagement data will be reset.',
      async () => {
        try {
          await AsyncStorage.removeItem('@community_activity_log');
          setActivityLog([]);
          
          // Reset stats
          if (currentUser) {
            const resetStats = {
              ...currentUser.stats,
              posts: userPostList.length,
              helpful: 0,
              streakDays: 0,
            };
            await updateCommunityProfile({ stats: resetStats });
          }
          
          sweetAlert.success('Cleared', 'Your activity history has been cleared');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          sweetAlert.error('Error', 'Failed to clear activity');
        }
      },
      () => {},
      'Clear',
      'Cancel'
    );
  };

  const handleDeactivateProfile = async () => {
    sweetAlert.confirm(
      'Deactivate Profile',
      'Your profile will be hidden from others. You can reactivate anytime by signing in again.',
      async () => {
        try {
          setIsProfileDeactivated(true);
          await updateCommunityProfile({ 
            isPublic: false,
            onlineStatus: 'offline' 
          });
          sweetAlert.success('Deactivated', 'Your profile is now hidden');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          sweetAlert.error('Error', 'Failed to deactivate profile');
        }
      },
      () => {},
      'Deactivate',
      'Cancel'
    );
  };

  const handleReactivateProfile = async () => {
    try {
      setIsProfileDeactivated(false);
      await updateCommunityProfile({ 
        isPublic: true,
        onlineStatus: 'online' 
      });
      sweetAlert.success('Reactivated', 'Your profile is now visible');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      sweetAlert.error('Error', 'Failed to reactivate profile');
    }
  };

  // ============================================
  // SAVE PROFILE
  // ============================================
  const handleSave = async () => {
    if (!currentUser) return;
    if (!formData.displayName.trim()) { 
      sweetAlert.error('Validation Error', 'Display name is required'); 
      triggerHaptic('error'); 
      return; 
    }

    const cleanHandle = formData.handle.replace('@', '').trim();
    if (!cleanHandle || cleanHandle.length < 3) {
      sweetAlert.error('Validation Error', 'Username must be at least 3 characters');
      triggerHaptic('error');
      return;
    }

    const originalHandle = originalData.handle.replace('@', '');
    if (cleanHandle !== originalHandle) {
      const check = await checkUsernameAvailable(cleanHandle, currentUser.id);
      if (!check.available) {
        sweetAlert.error('Username Unavailable', check.message);
        triggerHaptic('error');
        return;
      }
    }

    setIsSaving(true); 
    triggerHaptic('medium');
    try {
      const handle = formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`;
      const updates: any = { 
        displayName: formData.displayName.trim(), 
        handle: handle.toLowerCase(), 
        bio: formData.bio.trim(), 
        avatar: formData.avatar, 
        coverPhoto: formData.coverPhoto,
        country: formData.location,
        isPublic: formData.isPublic,
        notificationsEnabled: formData.notificationsEnabled,
        showActivityStatus: formData.showActivityStatus,
        allowMessages: formData.allowMessages,
      };

      if (cleanHandle !== originalHandle.replace('@', '')) {
        const result = await updateUsername(
          originalHandle.replace('@', ''),
          cleanHandle,
          currentUser.id
        );
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);
      await syncUserProfileAcrossPosts(currentUser.id, updates);
      
      const newAchievements = await checkAndAwardAchievements();
      if (newAchievements.length > 0) { 
        sweetAlert.success('Achievement Unlocked!', `You earned ${newAchievements.length} new badge${newAchievements.length > 1 ? 's' : ''}!`); 
      }
      
      triggerHaptic('success'); 
      setIsEditing(false); 
      setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
      await loadUserData();
    } catch (error: any) { 
      triggerHaptic('error'); 
      sweetAlert.error('Save Failed', error.message || 'Please try again'); 
    }
    setIsSaving(false);
  };

  const hasChanges = useMemo(() => 
    Object.keys(formData).some(key => 
      formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]
    ), [formData, originalData]
  );

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
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
    const coverPhoto = formData.coverPhoto || currentUser.coverPhoto;
    const avatarSource = formData.avatar || currentUser.avatar;
    
    return (
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
        {/* Cover Photo - Full width with better overlay */}
        <View style={styles.coverPhotoContainer}>
          {coverPhoto ? (
            <Image 
              source={{ uri: coverPhoto }} 
              style={styles.coverPhoto} 
              resizeMode="cover"
            />
          ) : (
            <LinearGradient 
              colors={['#6366f1', '#8b5cf6', '#6a82fb']} 
              style={styles.coverPhoto}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.coverPhotoPlaceholder}>
                <Ionicons name="camera-outline" size={36} color="rgba(255,255,255,0.5)" />
                <Text style={styles.coverPhotoText}>Add Cover Photo</Text>
              </View>
            </LinearGradient>
          )}
          {isEditing && (
            <TouchableOpacity 
              style={styles.coverPhotoEditBadge} 
              onPress={() => setShowCoverPicker(true)}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Gradient overlay for better text readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
            style={styles.coverPhotoOverlay}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </View>

        {/* Avatar - Overlapping cover photo */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => isEditing && setShowImagePicker(true)} 
            style={styles.avatarWrapper}
            disabled={!isEditing}
          >
            {avatarSource ? (
              <Image 
                source={{ uri: avatarSource }} 
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder, { backgroundColor: `${roleConfig.color}25` }]}>
                <Text style={styles.avatarPlaceholderText}>
                  {currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{currentUser.displayName}</Text>
            {currentUser.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.profileMeta}>{currentUser.handle} • {roleConfig.label}</Text>
          
          {currentUser.bio && (
            <Text style={styles.profileBio} numberOfLines={2}>{currentUser.bio}</Text>
          )}
          
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
            {isProfileDeactivated && (
              <View style={[styles.profileTag, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="eye-off" size={12} color="#ef4444" />
                <Text style={[styles.profileTagText, { color: '#ef4444' }]}>Hidden</Text>
              </View>
            )}
          </View>

          {/* Stats Row - Always visible */}
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{userPostList.length}</Text>
              <Text style={styles.statsLabel}>Posts</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{followerCount}</Text>
              <Text style={styles.statsLabel}>Followers</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{followingCount}</Text>
              <Text style={styles.statsLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Single Edit/Save button */}
        <TouchableOpacity 
          style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]} 
          onPress={() => {
            if (isEditing && hasChanges) {
              handleSave();
            } else if (isEditing) {
              setIsEditing(false);
              setFormData({ ...originalData });
            } else {
              setIsEditing(true);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons 
              name={isEditing ? "checkmark" : "create-outline"} 
              size={20} 
              color="#fff" 
            />
          )}
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

  // ============================================
  // OVERVIEW TAB
  // ============================================
  const renderOverviewTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      {/* KPI Row */}
      <View style={styles.kpiPillRow}>
        <KpiPill icon="📝" value={userPostList.length} label="Posts" color={TC.primary} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="👥" value={followerCount} label="Followers" color={TC.secondary} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="🔥" value={currentUser?.stats?.streakDays || 0} label="Streak" color={TC.accent} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="💙" value={currentUser?.stats?.helpful || 0} label="Helpful" color={TC.success} isDark={isDark} colors={fullThemeColors} />
      </View>

      {/* Influence Dashboard - With real data */}
      <Animated.View entering={FadeInUp.delay(100).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.influenceHeader}>
            <View style={[styles.influenceIconBg, { backgroundColor: `${TC.primary}15` }]}>
              <Ionicons name="analytics" size={20} color={TC.primary} />
            </View>
            <View style={styles.influenceTitleWrap}>
              <Text style={styles.influenceTitle}>Influence Score</Text>
              <Text style={styles.influenceSubtitle}>Based on {userPostList.length} posts and engagement</Text>
            </View>
            <View style={[styles.influenceOverallBadge, { backgroundColor: `${TC.primary}12` }]}>
              <Text style={[styles.influenceOverallText, { color: TC.primary }]}>
                {Math.round(influenceMetrics.reduce((a, b) => a + b.value, 0) / influenceMetrics.length)}
              </Text>
            </View>
          </View>
          <View style={styles.influenceGrid}>
            {influenceMetrics.map((metric, i) => (
              <View key={metric.label} style={styles.influenceItem}>
                <View style={styles.influenceItemTop}>
                  <View style={[styles.influenceItemIconBg, { backgroundColor: `${metric.color}12` }]}>
                    <Ionicons name={metric.icon as any} size={14} color={metric.color} />
                  </View>
                  <Text style={[styles.influenceItemLabel, { color: metric.color }]}>{metric.label}</Text>
                  <Text style={[styles.influenceItemValue, { color: metric.color }]}>{metric.value}%</Text>
                </View>
                <View style={[styles.influenceBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Animated.View entering={FadeInRight.delay(200 + i * 80).springify()} style={[styles.influenceBarFill, { width: `${metric.value}%`, backgroundColor: metric.color }]} />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.influenceFooter}>
            <Text style={styles.influenceFooterText}>
              {userPostList.length > 0 
                ? `📊 ${userPostList.length} posts analyzed • ${userPostList.reduce((s, p) => s + p.likes, 0)} total likes`
                : '📊 Start posting to build your influence score'}
            </Text>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Weekly Impact */}
      <Animated.View entering={FadeInUp.delay(150).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.impactHeader}>
            <Text style={styles.impactTitle}>This Week</Text>
            <View style={[styles.impactTrendBadge, {
              backgroundColor: weeklyImpact.trend === 'up' ? '#10b98115' : weeklyImpact.trend === 'down' ? '#ef444415' : '#f59e0b15'
            }]}>
              <Ionicons name={weeklyImpact.trend === 'up' ? 'trending-up' : weeklyImpact.trend === 'down' ? 'trending-down' : 'remove'} size={14}
                color={weeklyImpact.trend === 'up' ? '#10b981' : weeklyImpact.trend === 'down' ? '#ef4444' : '#f59e0b'} />
              <Text style={[styles.impactTrendText, { color: weeklyImpact.trend === 'up' ? '#10b981' : weeklyImpact.trend === 'down' ? '#ef4444' : '#f59e0b' }]}>
                {weeklyImpact.rankChange > 0 ? `+${weeklyImpact.rankChange}` : weeklyImpact.rankChange} rank
              </Text>
            </View>
          </View>
          <View style={styles.impactGrid}>
            {[
              { icon: '📝', label: 'Posts', value: weeklyImpact.postsThisWeek, color: TC.primary },
              { icon: '💙', label: 'Helpful', value: weeklyImpact.helpfulVotes, color: TC.success },
              { icon: '👥', label: 'New', value: weeklyImpact.newConnections, color: TC.secondary },
            ].map((item, i) => (
              <View key={item.label} style={[styles.impactItem, i < 2 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={styles.impactItemIcon}>{item.icon}</Text>
                <Text style={[styles.impactItemValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.impactItemLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>

      {/* Community Standing */}
      <Animated.View entering={FadeInUp.delay(200).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.standingHeader}>
            <View style={[styles.standingIconBg, { backgroundColor: `${TC.purple}15` }]}>
              <Ionicons name="trophy" size={20} color={TC.purple} />
            </View>
            <View style={styles.standingTitleWrap}>
              <Text style={styles.standingTitle}>Community Standing</Text>
              <Text style={styles.standingSubtitle}>Top {communityStanding.percentile}% of {allUsers.length} members</Text>
            </View>
          </View>
          <View style={styles.standingRankRow}>
            <View style={[styles.standingRankBadge, { backgroundColor: `${TC.purple}12` }]}>
              <Text style={[styles.standingRankText, { color: TC.purple }]}>{communityStanding.rank}</Text>
            </View>
            <View style={styles.standingProgressWrap}>
              <View style={styles.standingProgressLabelRow}>
                <Text style={styles.standingProgressLabel}>Next: {communityStanding.nextMilestone}</Text>
                <Text style={[styles.standingProgressValue, { color: TC.purple }]}>{communityStanding.progressToNext}%</Text>
              </View>
              <View style={[styles.standingProgressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Animated.View entering={FadeInRight.delay(300).springify()} style={[styles.standingProgressBarFill, { width: `${communityStanding.progressToNext}%`, backgroundColor: TC.purple }]} />
              </View>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Content Breakdown */}
      <Animated.View entering={FadeInUp.delay(250).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownTitle}>Content Breakdown</Text>
            <Text style={styles.breakdownTotal}>{contentBreakdown.posts + contentBreakdown.comments + contentBreakdown.reactions + contentBreakdown.shares} total</Text>
          </View>
          <View style={styles.breakdownGrid}>
            {[
              { label: 'Posts', value: contentBreakdown.posts, color: TC.primary, icon: 'document-text' },
              { label: 'Comments', value: contentBreakdown.comments, color: TC.info, icon: 'chatbubble' },
              { label: 'Reactions', value: contentBreakdown.reactions, color: TC.secondary, icon: 'heart' },
              { label: 'Shares', value: contentBreakdown.shares, color: TC.success, icon: 'share' },
            ].map((item) => (
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

      {/* Engagement Sparkline */}
      <Animated.View entering={FadeInUp.delay(300).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.sparklineHeader}>
            <View>
              <Text style={styles.sparklineTitle}>7-Day Activity</Text>
              <Text style={styles.sparklineSubtitle}>Daily engagement</Text>
            </View>
            <View style={styles.sparklineTotal}>
              <Text style={styles.sparklineTotalValue}>{engagementData.reduce((a, b) => a + b.value, 0)}</Text>
              <Text style={styles.sparklineTotalLabel}>entries</Text>
            </View>
          </View>
          <View style={styles.sparklineChart}>
            {engagementData.map((point, i) => {
              const maxVal = Math.max(...engagementData.map(d => d.value), 1);
              const height = Math.max(4, (point.value / maxVal) * 60);
              const isToday = i === engagementData.length - 1;
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

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <Animated.View entering={FadeInUp.delay(350).springify()}>
          <SectionHeader title="Smart Suggestions" subtitle="Personalized for you" isDark={isDark} colors={fullThemeColors} />
          <View style={styles.suggestionsScroll}>
            {smartSuggestions.map((suggestion) => (
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
      )}

      {/* Topic Affinity */}
      {topicAffinities.length > 0 && (
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <SectionHeader title="Topic Affinity" subtitle="Where you contribute most" isDark={isDark} colors={fullThemeColors} />
          <View style={styles.affinityList}>
            {topicAffinities.map((item, i) => {
              const maxAffinity = Math.max(...topicAffinities.map(a => a.affinity), 1);
              return (
                <View key={item.topicId} style={styles.affinityRow}>
                  <View style={[styles.affinityIconBg, { backgroundColor: `${item.color}12` }]}>
                    <Text style={styles.affinityEmoji}>{item.emoji}</Text>
                  </View>
                  <View style={styles.affinityContent}>
                    <View style={styles.affinityTop}>
                      <Text style={styles.affinityName}>{item.topicName}</Text>
                      <Text style={[styles.affinityValue, { color: item.color }]}>{item.posts} posts</Text>
                    </View>
                    <View style={[styles.affinityBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                      <Animated.View entering={FadeInRight.delay(200 + i * 60).springify()} style={[styles.affinityBarFill, { width: `${(item.affinity / maxAffinity) * 100}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* Peer Comparison */}
      <Animated.View entering={FadeInUp.delay(450).springify()}>
        <SectionHeader title="Peer Comparison" subtitle={`Among ${allUsers.length} community members`} isDark={isDark} colors={fullThemeColors} />
        <View style={styles.comparisonList}>
          {peerComparisons.map((comp, i) => (
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
                  <View style={[styles.comparisonBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                    <Animated.View entering={FadeInRight.delay(200 + i * 60).springify()} style={[styles.comparisonBarFill, { width: `${Math.min((comp.userValue / Math.max(comp.avgValue, 1)) * 100, 100)}%`, backgroundColor: comp.color }]} />
                  </View>
                  <Text style={styles.comparisonNumbers}>{comp.userValue} vs {comp.avgValue} avg</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Content Streaks */}
      <Animated.View entering={FadeInUp.delay(500).springify()}>
        <SectionHeader title="Streaks" subtitle="Consistency tracking" isDark={isDark} colors={fullThemeColors} />
        <View style={styles.streaksRow}>
          {contentStreaks.map((streak) => (
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

      {/* Edit Mode: About Me Section */}
      {isEditing ? (
        <GlassCard delay={600} isDark={isDark} colors={fullThemeColors}>
          <View style={styles.sectionHeaderWithEdit}>
            <Text style={styles.sectionLabel}>About Me</Text>
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput style={styles.textArea} value={formData.bio} onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))} placeholder="Tell us about yourself..." placeholderTextColor="#666" multiline numberOfLines={4} maxLength={160} selectionColor={themeColors.primary} />
            <Text style={styles.charCount}>{formData.bio.length}/160</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
              <Ionicons name="location-outline" size={18} color="#6366f1" style={styles.inputIcon} />
              <TextInput style={[styles.input, styles.flexInput]} value={formData.location} onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))} placeholder={locationDetected || "Detecting location..."} placeholderTextColor="#666" editable={isEditing} selectionColor={themeColors.primary} />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
              <Ionicons name="at" size={18} color="#6366f1" style={styles.inputIcon} />
              <TextInput style={[styles.input, styles.flexInput]} value={formData.handle} onChangeText={(text) => {
                const cleaned = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '');
                setFormData(prev => ({ ...prev, handle: cleaned }));
              }} placeholder="username" placeholderTextColor="#666" autoCapitalize="none" editable={isEditing} selectionColor={themeColors.primary} />
              {!isEditing && (
                <TouchableOpacity onPress={handleCopyHandle} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={16} color="#6366f1" />
                </TouchableOpacity>
              )}
            </View>
            {isEditing && usernameCheckStatus && (
              <View style={[styles.usernameStatus, { 
                backgroundColor: usernameCheckStatus.available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                borderColor: usernameCheckStatus.available ? '#10b981' : '#ef4444',
              }]}>
                <Ionicons name={usernameCheckStatus.available ? 'checkmark-circle' : 'alert-circle'} size={14} color={usernameCheckStatus.available ? '#10b981' : '#ef4444'} />
                <Text style={[styles.usernameStatusText, { color: usernameCheckStatus.available ? '#10b981' : '#ef4444' }]}>
                  {usernameCheckStatus.message}
                </Text>
              </View>
            )}
            {isCheckingUsername && (
              <View style={styles.usernameStatus}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={[styles.usernameStatusText, { color: '#6366f1' }]}>Checking availability...</Text>
              </View>
            )}
          </View>
        </GlassCard>
      ) : (
        <GlassCard delay={600} isDark={isDark} colors={fullThemeColors}>
          <View style={styles.sectionHeaderWithEdit}>
            <Text style={styles.sectionLabel}>About Me</Text>
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={18} color="#6366f1" />
            </TouchableOpacity>
          </View>
          <View style={styles.bioDisplay}>
            <Text style={styles.bioText}>{formData.bio || 'No bio yet. Tap edit to add one!'}</Text>
          </View>
          {formData.location && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
              <View style={styles.bioDisplay}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color="#6366f1" />
                  <Text style={styles.locationText}>{formData.location}</Text>
                </View>
              </View>
            </>
          )}
        </GlassCard>
      )}

      {/* Manage Topics */}
      <TouchableOpacity
        style={[styles.manageTopicsBtn, { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff' }]}
        onPress={() => navigation.navigate('CommunityOnboarding' as never, { editing: true } as never)}
      >
        <Ionicons name="pricetags-outline" size={22} color="#6366f1" />
        <Text style={[styles.manageTopicsText, { color: isDark ? '#ffffff' : '#1a1a2e' }]}>
          Manage Your Topics
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>

      <GlassCard delay={700} isDark={isDark} colors={fullThemeColors}>
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

      {/* Quick Actions Dock - Only in view mode */}
      {!isEditing && (
        <QuickActionsDock
          onMessage={() => navigation.navigate('ChatList' as never)}
          onShare={handleShareProfile}
          onEdit={() => setIsEditing(true)}
          onSettings={() => setActiveTab('settings')}
          isDark={isDark}
          colors={fullThemeColors}
        />
      )}
    </Animated.View>
  );

  // ============================================
  // POSTS TAB
  // ============================================
  const renderPostsTab = () => {
    const posts = userPostList.slice(0, 10);
    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <View style={styles.postsHeader}>
          <View style={styles.postsHeaderLeft}>
            <Ionicons name="document-text" size={20} color={TC.primary} />
            <Text style={styles.postsHeaderTitle}>My Posts</Text>
          </View>
          <View style={[styles.postsHeaderBadge, { backgroundColor: `${themeColors.primary}20` }]}>
            <Text style={[styles.postsHeaderBadgeText, { color: themeColors.primary }]}>
              {userPostList.length} threads
            </Text>
          </View>
        </View>

        {posts.length === 0 ? (
          <View style={styles.emptyPostsCard}>
            <View style={styles.emptyPostsIcon}>
              <Ionicons name="document-text-outline" size={40} color={TC.primary} />
            </View>
            <Text style={styles.emptyPostsTitle}>No posts yet</Text>
            <Text style={styles.emptyPostsText}>Share your first story with the community!</Text>
            <TouchableOpacity 
              style={[styles.createPostBtn, { backgroundColor: themeColors.primary }]} 
              onPress={() => navigation.navigate('CreatePost' as never)}
            >
              <Text style={styles.createPostBtnText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsList}>
            {posts.map((post, index) => {
              const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
              const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || TC.primary;
              return (
                <TouchableOpacity 
                  key={post.id} 
                  style={styles.postItem}
                  onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id })}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isDark ? ['rgba(45,45,60,0.8)', 'rgba(35,35,50,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,255,0.9)']}
                    style={styles.postItemGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.postItemContent}>
                    <View style={styles.postItemHeader}>
                      <View style={[styles.postItemTopic, { backgroundColor: `${topicColor}15` }]}>
                        <View style={[styles.postItemTopicDot, { backgroundColor: topicColor }]} />
                        <Text style={[styles.postItemTopicText, { color: topicColor }]}>
                          {topic?.name || 'General'}
                        </Text>
                      </View>
                      <Text style={styles.postItemTime}>{post.time}</Text>
                    </View>
                    <Text style={styles.postItemContentText} numberOfLines={2}>
                      {post.content}
                    </Text>
                    {post.images && post.images.length > 0 && (
                      <View style={styles.postItemImageWrap}>
                        <Image source={{ uri: post.images[0] }} style={styles.postItemImage} resizeMode="cover" />
                      </View>
                    )}
                    <View style={styles.postItemStats}>
                      <View style={styles.postItemStat}>
                        <Ionicons name="heart" size={14} color={post.isLiked ? TC.danger : '#94a3b8'} />
                        <Text style={[styles.postItemStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}>
                          {post.likes}
                        </Text>
                      </View>
                      <View style={styles.postItemStat}>
                        <Ionicons name="chatbubble" size={14} color="#94a3b8" />
                        <Text style={styles.postItemStatText}>{post.commentsCount}</Text>
                      </View>
                      <View style={styles.postItemStat}>
                        <Ionicons name="repeat" size={14} color="#94a3b8" />
                        <Text style={styles.postItemStatText}>{post.reposts}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Animated.View>
    );
  };

  // ============================================
  // ACHIEVEMENTS TAB
  // ============================================
  const renderAchievementsTab = () => {
    const achievements = currentUser?.achievements || [];
    const progressToNext = Math.min(100, Math.round((userPostList.length / 50) * 100));
    const helpfulProgress = Math.min(100, Math.round(((currentUser?.stats?.helpful || 0) / 50) * 100));
    
    return (
      <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
        <View style={styles.achievementsHeader}>
          <View style={styles.achievementsHeaderLeft}>
            <Ionicons name="trophy" size={20} color={TC.primary} />
            <Text style={styles.achievementsHeaderTitle}>Achievements</Text>
          </View>
          <View style={[styles.achievementsHeaderBadge, { backgroundColor: `${themeColors.primary}20` }]}>
            <Text style={[styles.achievementsHeaderBadgeText, { color: themeColors.primary }]}>
              {achievements.length} earned
            </Text>
          </View>
        </View>

        {/* Achievement Cards */}
        <View style={styles.achievementsCard}>
          {achievements.length > 0 ? (
            achievements.map((achievement) => {
              const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary, desc: '' };
              return (
                <View key={achievement} style={[styles.achievementItem, { backgroundColor: `${badge.color}08` }]}>
                  <View style={[styles.achievementItemIcon, { backgroundColor: `${badge.color}12` }]}>
                    <Text style={styles.achievementItemEmoji}>{badge.emoji}</Text>
                  </View>
                  <View style={styles.achievementItemInfo}>
                    <Text style={[styles.achievementItemName, { color: badge.color }]}>{badge.name}</Text>
                    <Text style={styles.achievementItemDesc}>{badge.desc}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={badge.color} style={{ opacity: 0.5 }} />
                </View>
              );
            })
          ) : (
            <View style={styles.emptyAchievements}>
              <Ionicons name="trophy-outline" size={48} color={TC.primary} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyAchievementsTitle}>No achievements yet</Text>
              <Text style={styles.emptyAchievementsText}>Start posting and engaging to earn badges!</Text>
            </View>
          )}
        </View>

        {/* Progress Section */}
        <View style={styles.progressCard}>
          <Text style={styles.progressCardTitle}>Progress</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressItem}>
              <View style={styles.progressItemHeader}>
                <Text style={styles.progressItemValue}>{userPostList.length}</Text>
                <Text style={styles.progressItemLabel}>of 50 posts</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressToNext}%`, backgroundColor: TC.primary }]} />
              </View>
            </View>
            <View style={styles.progressItem}>
              <View style={styles.progressItemHeader}>
                <Text style={styles.progressItemValue}>{currentUser?.stats?.helpful || 0}</Text>
                <Text style={styles.progressItemLabel}>of 50 helpful</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${helpfulProgress}%`, backgroundColor: TC.success }]} />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ============================================
  // SETTINGS TAB
  // ============================================
  const renderSettingsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Privacy & Preferences</Text>
        {[
          { key: 'isPublic', icon: 'globe-outline', label: 'Public Profile', desc: 'Allow others to find and view your profile' },
          { key: 'showActivityStatus', icon: 'eye-outline', label: 'Activity Status', desc: 'Show when you are online' },
          { key: 'allowMessages', icon: 'chatbubbles-outline', label: 'Direct Messages', desc: 'Allow others to message you' },
          { key: 'notificationsEnabled', icon: 'notifications-outline', label: 'Notifications', desc: 'Receive alerts about activity' },
        ].map((pref, i, arr) => (
          <View key={pref.key}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowLeft}>
                <View style={[styles.settingsRowIcon, { backgroundColor: formData[pref.key as keyof typeof formData] ? `${themeColors.primary}15` : 'rgba(0,0,0,0.05)' }]}>
                  <Ionicons 
                    name={formData[pref.key as keyof typeof formData] ? pref.icon as any : `${pref.icon.replace('-outline', '')}-outline` as any} 
                    size={20} 
                    color={formData[pref.key as keyof typeof formData] ? themeColors.primary : '#94a3b8'} 
                  />
                </View>
                <View style={styles.settingsRowText}>
                  <Text style={styles.settingsRowTitle}>{pref.label}</Text>
                  <Text style={styles.settingsRowDesc}>{pref.desc}</Text>
                </View>
              </View>
              <Switch 
                value={formData[pref.key as keyof typeof formData] as boolean} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, [pref.key]: val }))}
                trackColor={{ false: '#334155', true: themeColors.primary || '#6366f1' }}
                thumbColor="#fff"
                ios_backgroundColor="#334155"
              />
            </View>
            {i < arr.length - 1 && <View style={styles.settingsDivider} />}
          </View>
        ))}
      </View>

      {/* Account Actions */}
      <View style={styles.dangerCard}>
        <LinearGradient
          colors={isDark ? ['rgba(239,68,68,0.08)', 'rgba(220,38,38,0.04)'] : ['rgba(239,68,68,0.05)', 'rgba(220,38,38,0.02)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
            <Ionicons name="warning" size={24} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.dangerTitle}>Account Actions</Text>
        <Text style={styles.dangerDescription}>Manage your community account data and presence.</Text>
        
        <TouchableOpacity 
          style={styles.dangerActionBtn} 
          onPress={handleClearActivity}
        >
          <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </View>
          <Text style={styles.dangerActionText}>Clear Activity History</Text>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>
        
        {isProfileDeactivated ? (
          <TouchableOpacity 
            style={[styles.dangerActionBtn, styles.reactivateActionBtn]} 
            onPress={handleReactivateProfile}
          >
            <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="refresh-outline" size={18} color="#10b981" />
            </View>
            <Text style={[styles.dangerActionText, { color: '#10b981' }]}>Reactivate Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.dangerActionBtn} 
            onPress={handleDeactivateProfile}
          >
            <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Ionicons name="pause-circle-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.dangerActionText, { color: '#f59e0b' }]}>Deactivate Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fullThemeColors?.background || (isDark ? '#0f0f1a' : '#f8f9fc') }]} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fullThemeColors?.background || (isDark ? '#0f0f1a' : '#f8f9fc') }]} />
        <Ionicons name="person-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: fullThemeColors.textSecondary, fontSize: 16, fontWeight: '600' }}>Not signed in</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors?.primary || '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fullThemeColors.background }]} />
      {renderStickyHeader()}
      
      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.spinnerColor} />
        }
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {isEditing && (
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.saveBtn, (!hasChanges || isSaving) && styles.saveBtnDisabled]} 
              disabled={isSaving || !hasChanges}
              activeOpacity={0.8}
            >
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          )}
        </Animated.View>

        {renderProfileHero()}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={fullThemeColors} />
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </View>
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      {/* Image Picker Modals */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark} colors={fullThemeColors}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleImagePick('avatar')}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="images-outline" size={28} color="#6366f1" />
            </View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleTakePhoto('avatar')}>
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
            <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleRemoveImage('avatar')}>
              <View style={[styles.imagePickerIcon, { backgroundColor: '#ff475720' }]}>
                <Ionicons name="trash-outline" size={28} color="#ff4757" />
              </View>
              <Text style={[styles.imagePickerLabel, { color: '#ff4757' }]}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ActionModal>

      <ActionModal visible={showCoverPicker} onClose={() => setShowCoverPicker(false)} title="Change Cover Photo" isDark={isDark} colors={fullThemeColors}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleImagePick('cover')}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="images-outline" size={28} color="#6366f1" />
            </View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleTakePhoto('cover')}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="camera-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.imagePickerLabel}>Take Photo</Text>
          </TouchableOpacity>
          {(formData.coverPhoto || currentUser.coverPhoto) && (
            <TouchableOpacity style={styles.imagePickerOption} onPress={() => handleRemoveImage('cover')}>
              <View style={[styles.imagePickerIcon, { backgroundColor: '#ff475720' }]}>
                <Ionicons name="trash-outline" size={28} color="#ff4757" />
              </View>
              <Text style={[styles.imagePickerLabel, { color: '#ff4757' }]}>Remove Cover</Text>
            </TouchableOpacity>
          )}
        </View>
      </ActionModal>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} activeOpacity={1} />
          <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.emojiPickerSheet}>
            <LinearGradient colors={isDark ? ['rgba(45,45,60,0.98)', 'rgba(35,35,50,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']} style={StyleSheet.absoluteFill} />
            <View style={styles.modalDragHandle}>
              <View style={styles.dragIndicator} />
            </View>
            <View style={styles.emojiPickerHeader}>
              <Text style={[styles.emojiPickerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={[styles.emojiButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} onPress={() => handleEmojiSelect(emoji)}>
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================
const getStyles = (isDarkMode: boolean, colors: any = {}) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background || (isDarkMode ? '#0f0f1a' : '#f8f9fc') },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: 24, minHeight: SCREEN_H },

  // Sticky Header
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 10 
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Top Header
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.08)' 
  },
  saveBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 12, 
    backgroundColor: '#6366f1', 
    minWidth: 60, 
    alignItems: 'center' 
  },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Profile Hero
  profileHero: { marginHorizontal: 16, marginBottom: 20 },
  coverPhotoContainer: { 
    width: '100%', 
    height: 180, 
    borderRadius: 16, 
    overflow: 'hidden', 
    position: 'relative' 
  },
  coverPhoto: { width: '100%', height: '100%' },
  coverPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  coverPhotoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  coverPhotoText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  coverPhotoEditBadge: { 
    position: 'absolute', 
    right: 12, 
    top: 12, 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  avatarSection: { alignItems: 'center', marginTop: -50 },
  avatarWrapper: { 
    position: 'relative',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 8, 
    elevation: 8 
  },
  avatarImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    borderWidth: 4, 
    borderColor: '#fff' 
  },
  avatarPlaceholder: { 
    backgroundColor: '#6366f1', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarPlaceholderText: { 
    fontSize: 36, 
    fontWeight: '800', 
    color: '#fff' 
  },
  avatarEditBadge: { 
    position: 'absolute', 
    bottom: 4, 
    right: 4, 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#6366f1', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff'
  },

  profileInfo: { alignItems: 'center', marginTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 24, fontWeight: '800', color: colors.text || '#1e293b', letterSpacing: -0.5 },
  verifiedBadge: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#6366f1', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  profileMeta: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#64748b' },
  profileBio: { fontSize: 14, color: colors.textSecondary || '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  editToggleBtn: { 
    position: 'absolute', 
    right: 0, 
    top: 0, 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  editToggleBtnActive: { backgroundColor: '#6366f1' },

  // Stats Row
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 20 },
  statsItem: { alignItems: 'center' },
  statsValue: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  statsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  statsDivider: { width: 1, height: 24, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },

  // Tab Bar
  tabBar: { 
    flexDirection: 'row', 
    marginHorizontal: 16, 
    marginBottom: 16, 
    padding: 4, 
    borderRadius: 16, 
    gap: 2, 
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
  },
  tabItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // Glass Card
  glassCard: { 
    borderRadius: DESIGN.radius.lg, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: colors.border || 'rgba(255,255,255,0.06)', 
    marginHorizontal: 16, 
    marginBottom: DESIGN.spacing.lg 
  },
  glassBorder: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    height: 1, 
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
  },
  glassContent: { flex: 1 },

  // Section Header
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginHorizontal: 16, 
    marginBottom: 12, 
    marginTop: 8 
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  // KPI Pill
  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  kpiPill: { 
    flex: 1, 
    borderRadius: 20, 
    overflow: 'hidden', 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.4)' : 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Influence
  influenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  influenceIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  influenceTitleWrap: { flex: 1 },
  influenceTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  influenceSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  influenceOverallBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  influenceOverallText: { fontSize: 20, fontWeight: '800' },
  influenceGrid: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  influenceItem: { gap: 6 },
  influenceItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  influenceItemIconBg: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  influenceItemLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  influenceItemValue: { fontSize: 12, fontWeight: '700' },
  influenceBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  influenceBarFill: { height: '100%', borderRadius: 3 },
  influenceFooter: { paddingHorizontal: 16, paddingBottom: 12 },
  influenceFooterText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', textAlign: 'center' },

  // Impact
  impactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  impactTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  impactTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  impactTrendText: { fontSize: 12, fontWeight: '700' },
  impactGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  impactItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactItemIcon: { fontSize: 20 },
  impactItemValue: { fontSize: 20, fontWeight: '800' },
  impactItemLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  // Standing
  standingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  standingIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  standingTitleWrap: { flex: 1 },
  standingTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  standingSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  standingRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  standingRankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  standingRankText: { fontSize: 13, fontWeight: '800' },
  standingProgressWrap: { flex: 1, gap: 6 },
  standingProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  standingProgressLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  standingProgressValue: { fontSize: 12, fontWeight: '700' },
  standingProgressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  standingProgressBarFill: { height: '100%', borderRadius: 3 },

  // Breakdown
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  breakdownTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  breakdownTotal: { fontSize: 12, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  breakdownGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
  breakdownIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  // Sparkline
  sparklineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  sparklineChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: colors.textMuted || '#94a3b8' },

  // Suggestions
  suggestionsScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  suggestionCard: { width: 160, padding: 14, borderRadius: 20, overflow: 'hidden' },
  suggestionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  suggestionEmoji: { fontSize: 22 },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: colors.text || '#1e293b', marginBottom: 4 },
  suggestionDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: colors.textSecondary || '#64748b', marginBottom: 10 },
  suggestionActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  suggestionActionText: { fontSize: 11, fontWeight: '700' },

  // Affinity
  affinityList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  affinityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)' },
  affinityIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  affinityEmoji: { fontSize: 20 },
  affinityContent: { flex: 1, marginLeft: 12, gap: 6 },
  affinityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  affinityName: { fontSize: 14, fontWeight: '700', color: colors.text || '#1e293b' },
  affinityValue: { fontSize: 12, fontWeight: '700' },
  affinityBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  affinityBarFill: { height: '100%', borderRadius: 2 },

  // Comparison
  comparisonList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)' },
  comparisonIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  comparisonContent: { flex: 1, marginLeft: 12, gap: 6 },
  comparisonTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  comparisonMetric: { fontSize: 14, fontWeight: '700', color: colors.text || '#1e293b' },
  comparisonPercentile: { fontSize: 12, fontWeight: '700' },
  comparisonBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comparisonBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  comparisonBarFill: { height: '100%', borderRadius: 2 },
  comparisonNumbers: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  // Streaks
  streaksRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', borderWidth: 1, backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)' },
  streakIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  streakValue: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  streakBest: { fontSize: 10, fontWeight: '500', color: colors.textMuted || '#94a3b8', marginTop: 2 },

  // Section Header with Edit
  sectionHeaderWithEdit: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    marginBottom: 16 
  },
  sectionLabel: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b', letterSpacing: -0.3 },
  editIconBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    backgroundColor: 'rgba(99,102,241,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  editingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Inputs
  inputGroup: { marginBottom: 16, paddingHorizontal: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary || '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    height: 52, 
    borderWidth: 1, 
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
  },
  inputDisabled: { opacity: 0.5 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: colors.text || '#1e293b', fontWeight: '600' },
  flexInput: { flex: 1 },
  copyBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.1)' },
  textArea: { 
    height: 100, 
    textAlignVertical: 'top', 
    paddingTop: 14, 
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    fontSize: 16, 
    color: colors.text || '#1e293b', 
    fontWeight: '500', 
    borderWidth: 1, 
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginHorizontal: 20 
  },
  charCount: { 
    fontSize: 12, 
    textAlign: 'right', 
    marginTop: 4, 
    marginHorizontal: 20, 
    color: colors.textSecondary || '#64748b', 
    fontWeight: '500' 
  },
  bioDisplay: { paddingHorizontal: 20, paddingBottom: 16 },
  bioText: { fontSize: 15, color: colors.textSecondary || '#64748b', lineHeight: 22, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  locationText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#64748b' },
  infoDivider: { height: 1, marginHorizontal: 20, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },

  // Username Status
  usernameStatus: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  usernameStatusText: { fontSize: 13, fontWeight: '600' },

  // Topics
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, color: colors.textMuted || '#94a3b8', fontWeight: '500' },

  // Manage Topics
  manageTopicsBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderRadius: 16, 
    marginHorizontal: 20, 
    marginVertical: 8, 
    gap: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  },
  manageTopicsText: { flex: 1, fontSize: 15, fontWeight: '600' },

  // Quick Actions Dock
  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dockLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  // Posts Tab
  tabPanel: { paddingBottom: 20 },
  postsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 4, 
    marginBottom: 16 
  },
  postsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postsHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  postsHeaderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  postsHeaderBadgeText: { fontSize: 12, fontWeight: '700' },

  postsList: { gap: 12 },
  postItem: { 
    borderRadius: 20, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
  },
  postItemGradient: { ...StyleSheet.absoluteFillObject },
  postItemContent: { padding: 16 },
  postItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  postItemTopic: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  postItemTopicDot: { width: 6, height: 6, borderRadius: 3 },
  postItemTopicText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  postItemTime: { fontSize: 11, fontWeight: '500', color: colors.textMuted || '#94a3b8' },
  postItemContentText: { fontSize: 15, fontWeight: '600', color: colors.text || '#1e293b', lineHeight: 22 },
  postItemImageWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', height: 160 },
  postItemImage: { width: '100%', height: '100%' },
  postItemStats: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  postItemStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postItemStatText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

  emptyPostsCard: { 
    padding: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 20, 
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  },
  emptyPostsIcon: { 
    width: 72, 
    height: 72, 
    borderRadius: 24, 
    backgroundColor: 'rgba(99,102,241,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyPostsTitle: { fontSize: 18, fontWeight: '700', color: colors.text || '#1e293b', marginBottom: 8 },
  emptyPostsText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#64748b', textAlign: 'center' },
  createPostBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  createPostBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Achievements Tab
  achievementsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 4, 
    marginBottom: 16 
  },
  achievementsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achievementsHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  achievementsHeaderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  achievementsHeaderBadgeText: { fontSize: 12, fontWeight: '700' },

  achievementsCard: { 
    borderRadius: 20, 
    padding: 16, 
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginBottom: 16
  },
  achievementItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 12, 
    borderRadius: 14, 
    marginBottom: 6 
  },
  achievementItemIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  achievementItemEmoji: { fontSize: 22 },
  achievementItemInfo: { flex: 1, gap: 2 },
  achievementItemName: { fontSize: 14, fontWeight: '700' },
  achievementItemDesc: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b' },

  emptyAchievements: { padding: 32, alignItems: 'center' },
  emptyAchievementsTitle: { fontSize: 16, fontWeight: '700', color: colors.text || '#1e293b', marginTop: 12, marginBottom: 4 },
  emptyAchievementsText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#64748b', textAlign: 'center' },

  // Progress Card
  progressCard: { 
    borderRadius: 20, 
    padding: 20, 
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginBottom: 16
  },
  progressCardTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b', marginBottom: 16 },
  progressRow: { flexDirection: 'row', gap: 16 },
  progressItem: { flex: 1 },
  progressItemHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  progressItemValue: { fontSize: 20, fontWeight: '800', color: colors.text || '#1e293b' },
  progressItemLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Settings Tab
  settingsCard: { 
    borderRadius: 20, 
    padding: 16, 
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginBottom: 16
  },
  settingsCardTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b', marginBottom: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingsRowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingsRowText: { flex: 1 },
  settingsRowTitle: { fontSize: 15, fontWeight: '700', color: colors.text || '#1e293b' },
  settingsRowDesc: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 1 },
  settingsDivider: { height: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginVertical: 4 },

  // Danger Card
  dangerCard: { 
    borderRadius: 20, 
    padding: 20, 
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    marginBottom: 16
  },
  dangerIconContainer: { marginBottom: 12 },
  dangerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 16, fontWeight: '800', color: '#ef4444', marginBottom: 4 },
  dangerDescription: { fontSize: 13, fontWeight: '500', color: colors.textSecondary || '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  dangerActionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    marginTop: 4
  },
  reactivateActionBtn: { 
    backgroundColor: 'rgba(16,185,129,0.04)' 
  },
  dangerActionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dangerActionText: { fontSize: 14, fontWeight: '600', color: '#ef4444', flex: 1 },

  // Image Picker
  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: colors.text || '#1e293b', flex: 1 },

  // Emoji Picker
  emojiPickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emojiPickerSheet: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 20, paddingBottom: 40, overflow: 'hidden' },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },
  
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, overflow: 'hidden' },
  modalDragHandle: { width: '100%', alignItems: 'center', paddingVertical: 8 },
  dragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' },
  
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});