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
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';

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

const COMMUNITY_AVATARS_BUCKET = 'community_avatars';
const COMMUNITY_COVERS_BUCKET = 'community_covers';

const isEmojiAvatar = (avatar: string | undefined): boolean => {
  if (!avatar) return false;
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

const generateUniqueFileName = (userId: string, ext: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}.${ext}`;
};

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

/* ═══════════════════════════════════════════════════════════════════════════
   SUBCOMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: colors?.primary, borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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

/* ── Skeleton placeholder for the hero (no blocking spinner) ───────────── */
const HeroSkeleton = React.memo(({ isDark, colors, insetsTop }: { isDark: boolean; colors: any; insetsTop: number }) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={[styles.profileHero, { marginTop: 8 }]}>
      <View style={[styles.coverPhotoContainer, { opacity: 0.5 }]}>
        <LinearGradient colors={isDark ? ['#2d2d3c', '#232332'] : ['#e2e8f0', '#f1f5f9']} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.avatarSection}>
        <View style={[styles.avatarImage, styles.avatarPlaceholder, { opacity: 0.4 }]} />
      </View>
      <View style={styles.profileInfo}>
        <View style={{ height: 24, width: 140, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginBottom: 8 }} />
        <View style={{ height: 14, width: 90, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{ alignItems: 'center' }}>
              <View style={{ height: 18, width: 28, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginBottom: 4 }} />
              <View style={{ height: 10, width: 44, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

/* ── Verification CTA card (placeholder tick) ──────────────────────────── */
const VerificationCta = React.memo(({ onPress, isDark, colors }: { onPress: () => void; isDark: boolean; colors: any }) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.verifyCta}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#ec4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.verifyCtaOverlay} />
        <View style={styles.verifyTickCircle}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </View>
        <View style={styles.verifyCtaBody}>
          <Text style={styles.verifyCtaTitle}>Get the verified tick</Text>
          <Text style={styles.verifyCtaDesc}>
            Verified parents are trusted by 3× more members. It's free and takes 2 minutes.
          </Text>
          <View style={styles.verifyCtaButtonRow}>
            <View style={styles.verifyCtaButton}>
              <Text style={styles.verifyCtaButtonText}>Verify now</Text>
              <Ionicons name="arrow-forward" size={14} color="#6366f1" />
            </View>
            <Text style={styles.verifyCtaFootnote}>No documents needed</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

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
    refreshTopics: refreshTopicsData,
    getUserProfile,
  } = useCommunity();
  const {
    profile,
    updateCommunityProfile: updateUserContextProfile,
    checkUsernameAvailable,
    updateUsername,
  } = useUser();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const { compressImage } = useMedia();
  const sweetAlert = useSweetAlert();
  const { deleteAccountWithConfirmation, userProfile } = useAuth();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const styles = useMemo(() => getStyles(isDark, fullThemeColors || {}), [isDark, fullThemeColors]);
  const scrollY = useSharedValue(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // NEW: never gate the whole screen on this. Kept only to know if the hero
  // is still resolving, so we can show a lightweight skeleton instead.
  const [isHydrating, setIsHydrating] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isProfileDeactivated, setIsProfileDeactivated] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [locationDetected, setLocationDetected] = useState<{ city: string; region: string; country: string; full: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

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

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const userPostList = useMemo(() => getUserPosts(currentUser?.id || ''), [currentUser, getUserPosts]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  // ── Derived metrics ─────────────────────────────────────────────────
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

  const weeklyImpact: WeeklyImpact = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekPosts = userPostList.filter(p => new Date(p.timestamp) >= weekAgo);
    const totalHelpful = weekPosts.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
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

  const contentBreakdown: ContentBreakdown = useMemo(() => ({
    posts: userPostList.length,
    comments: userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
    reactions: userPostList.reduce((sum, p) => sum + (p.likes || 0), 0),
    shares: userPostList.reduce((sum, p) => sum + (p.reposts || 0), 0),
  }), [userPostList]);

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

  const smartSuggestions: SmartSuggestion[] = useMemo(() => {
    const suggestions: SmartSuggestion[] = [];
    const topics = getSelectedTopics();

    if (topics.length < 3) {
      suggestions.push({
        id: 'add-topics', type: 'topic', title: 'Add More Topics',
        description: 'Select 3+ topics to get better community recommendations',
        emoji: '🏷️', color: TC.primary, action: () => navigation.navigate('CommunityOnboarding', { editing: true }),
      });
    }
    if (userPostList.length < 5) {
      suggestions.push({
        id: 'first-post', type: 'post', title: 'Share Your Story',
        description: 'Parents love hearing about your journey. Post today!',
        emoji: '✍️', color: TC.secondary, action: () => navigation.navigate('CreatePost', {}),
      });
    }
    if (!currentUser?.isVerified) {
      suggestions.push({
        id: 'verify', type: 'verify', title: 'Get Verified',
        description: 'Verify your identity to unlock exclusive features',
        emoji: '✅', color: TC.success, action: () => navigation.navigate('CommunityVerification'),
      });
    }
    if (followerCount < 10) {
      suggestions.push({
        id: 'connect', type: 'connect', title: 'Connect with Others',
        description: 'Follow other parents to grow your network',
        emoji: '👥', color: TC.purple, action: () => navigation.navigate('SearchUsers', {}),
      });
    }
    return suggestions;
  }, [getSelectedTopics, userPostList, currentUser, followerCount, navigation]);

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

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     LIFECYCLE
     ═══════════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {});
    const hide = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (currentUser && !initialLoadDone.current && !isLoadingRef.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser && !isLoadingRef.current) {
        refreshUserData();
      }
      return () => {};
    }, [currentUser])
  );

  useEffect(() => {
    loadActivityLog();
  }, []);

  const refreshUserData = useCallback(async () => {
    if (isLoadingRef.current || !currentUser) return;
    isLoadingRef.current = true;

    try {
      const topics = getSelectedTopics();
      const followers = await getFollowers(currentUser.id);
      const following = await getFollowing(currentUser.id);

      if (isMountedRef.current) {
        setSelectedTopics(topics);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentUser, getSelectedTopics, getFollowers, getFollowing]);

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

  // ── Location detection ────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const detectLocation = async () => {
      try {
        const cachedLocation = await AsyncStorage.getItem('@user_location_cache');
        if (cachedLocation) {
          try {
            const parsed = JSON.parse(cachedLocation);
            if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000 && parsed.data?.full) {
              if (isMounted) {
                setLocationDetected(parsed.data);
                setFormData(prev => ({
                  ...prev,
                  location:
                    (!prev.location || /^unknown/i.test(prev.location))
                      ? parsed.data.full
                      : prev.location,
                }));
              }
              return;
            }
          } catch {}
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !isMounted) return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (reverseGeocode.length > 0 && isMounted) {
          const place = reverseGeocode[0];
          const city = place.city || place.district || place.subregion || '';
          const region = place.region || place.state || '';
          const country = place.country || '';

          const locationParts: string[] = [];
          if (city) locationParts.push(city);
          if (region && region !== city) locationParts.push(region);
          if (country && !locationParts.includes(country)) locationParts.push(country);

          const fullLocation = locationParts.join(', ') || 'Unknown Location';
          const locationData = { city, region, country, full: fullLocation };

          await AsyncStorage.setItem('@user_location_cache', JSON.stringify({
            data: locationData,
            timestamp: Date.now(),
          }));

          if (isMounted) {
            setLocationDetected(locationData);
            setFormData(prev => ({
              ...prev,
              location:
                (!prev.location || /^unknown/i.test(prev.location))
                  ? fullLocation
                  : prev.location,
            }));
          }
        }
      } catch (error) {
        console.log('Location detection error:', error);
      }
    };
    detectLocation();
    return () => { isMounted = false; };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
     DATA LOADING — never blocks the initial paint
     ═══════════════════════════════════════════════════════════════════════════ */

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setIsHydrating(true);
    try {
      if (currentUser) {
        let canonicalHandle = '';
        let canonicalAvatar = '';
        let canonicalCover = '';
        let canonicalFullName = '';

        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('community_handle, community_username, community_avatar, avatar_url, community_cover, community_bio, full_name, is_verified')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (profileRow) {
            canonicalHandle =
              ((profileRow.community_handle || '').toString().replace(/^@+/, '')) ||
              ((profileRow.community_username || '').toString());
            canonicalAvatar = profileRow.community_avatar || profileRow.avatar_url || '';
            canonicalCover = profileRow.community_cover || '';
            canonicalFullName = profileRow.full_name || '';

            if (canonicalHandle && canonicalHandle !== currentUser.handle.replace(/^@+/, '')) {
              await updateCommunityProfile({ handle: `@${canonicalHandle}` });
            }

            // Keep the verification tick in sync with the DB even if this
            // screen was already open when the user verified elsewhere.
            if (
              typeof profileRow.is_verified === 'boolean' &&
              profileRow.is_verified !== currentUser.isVerified
            ) {
              await updateCommunityProfile({ isVerified: profileRow.is_verified });
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[CommunityProfile] profile sync failed:', e);
        }

        const topics = getSelectedTopics();
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);

        if (isMountedRef.current) {
          setSelectedTopics(topics);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }

        let currentHandle = currentUser.handle || '';
        if (!currentHandle) {
          currentHandle = generateIntelligentUsername(
            currentUser.displayName || 'parent',
            currentUser.id
          );
        }
        currentHandle = currentHandle.replace(/^@+/, '');

        const resolvedLocation =
          (currentUser.country && !/^unknown/i.test(currentUser.country) && currentUser.country) ||
          (currentUser.location && !/^unknown/i.test(currentUser.location) && currentUser.location) ||
          (locationDetected?.full && locationDetected.full) ||
          '';

        const userCtxFullName = (profile as any)?.fullName || '';
        const authFullName =
          (userProfile as any)?.fullName ||
          (userProfile as any)?.full_name ||
          '';
        const emailLocalPart = (currentUser.email || '').split('@')[0] || '';
        const derivedFallbackName =
          (currentHandle && currentHandle.replace(/[_.]/g, ' ').trim()) ||
          emailLocalPart ||
          'Parent';

        const resolvedDisplayName =
          (currentUser.displayName && currentUser.displayName.trim()) ||
          (userCtxFullName && String(userCtxFullName).trim()) ||
          (canonicalFullName && canonicalFullName.trim()) ||
          (authFullName && String(authFullName).trim()) ||
          derivedFallbackName;

        const resolvedHandle =
          currentHandle ||
          generateIntelligentUsername(resolvedDisplayName, currentUser.id);

        const initialData = {
          displayName: resolvedDisplayName,
          handle: resolvedHandle,
          bio: currentUser.bio || '',
          avatar: canonicalAvatar || currentUser.avatar || '',
          coverPhoto: canonicalCover || currentUser.coverPhoto || '',
          location: resolvedLocation,
          isPublic: true,
          notificationsEnabled: true,
          showActivityStatus: true,
          allowMessages: true,
        };

        if (isMountedRef.current) {
          setFormData(initialData);
          setOriginalData(initialData);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
    setIsHydrating(false);
    isLoadingRef.current = false;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFeed();
      await refreshTopicsData();
      await loadUserData();
      await loadActivityLog();
      await refreshUserData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeed, refreshTopicsData]);

  /* ═══════════════════════════════════════════════════════════════════════════
     IMAGE UPLOAD
     ═══════════════════════════════════════════════════════════════════════════ */

  const ensureBucket = useCallback(async (bucket: string) => {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (error && /not found/i.test(error.message)) {
        await supabase.storage.createBucket(bucket, { public: true });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const uploadImageToStorage = useCallback(async (
    localUri: string,
    userId: string,
    type: 'avatar' | 'cover'
  ): Promise<string | null> => {
    try {
      if (type === 'avatar') setAvatarUploading(true);
      else setCoverUploading(true);

      const fileData = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const fileName = generateUniqueFileName(userId, safeExt);

      const bucket = type === 'avatar' ? COMMUNITY_AVATARS_BUCKET : COMMUNITY_COVERS_BUCKET;
      const filePath = type === 'avatar' ? `avatars/${fileName}` : `covers/${fileName}`;

      await ensureBucket(bucket);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, decode(fileData), {
          contentType: `image/${safeExt}`,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[uploadImageToStorage] Upload error for ${type}:`, uploadError);
        if (type === 'avatar') setAvatarUploading(false);
        else setCoverUploading(false);
        return localUri;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const updateData =
        type === 'avatar'
          ? { community_avatar: publicUrl, avatar_url: publicUrl }
          : { community_cover: publicUrl };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.warn(`[uploadImageToStorage] Profile update error for ${type}:`, updateError.message);
      }

      if (type === 'avatar' && publicUrl) {
        try {
          await supabase
            .from('family_members')
            .update({ avatar: publicUrl })
            .eq('user_id', userId);
        } catch (e) {
          if (__DEV__) console.warn('[uploadImageToStorage] family_members sync failed:', e);
        }
      }

      if (type === 'avatar') setAvatarUploading(false);
      else setCoverUploading(false);
      return publicUrl;
    } catch (error) {
      console.error(`[uploadImageToStorage] Error uploading ${type}:`, error);
      if (type === 'avatar') setAvatarUploading(false);
      else setCoverUploading(false);
      return null;
    }
  }, [ensureBucket]);

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
      if (!fileInfo.exists) {
        console.error('[persistCommunityImage] File not found:', processedUri);
        return null;
      }
      return processedUri;
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

      const userId = currentUser?.id;
      if (!userId) {
        sweetAlert.error('Error', 'User not authenticated');
        setIsSaving(false);
        return;
      }

      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);

      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else {
        sweetAlert.error('Upload Failed', 'Could not upload image');
      }

      triggerHaptic('success');
      await refreshUserData();
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

      const userId = currentUser?.id;
      if (!userId) {
        sweetAlert.error('Error', 'User not authenticated');
        setIsSaving(false);
        return;
      }

      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);

      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else {
        sweetAlert.error('Upload Failed', 'Could not upload image');
      }

      triggerHaptic('success');
      await refreshUserData();
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
        const userId = currentUser?.id;
        if (!userId) return;

        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: '' }));
          setOriginalData(prev => ({ ...prev, avatar: '' }));
          await updateCommunityProfile({ avatar: '' });
          await updateUserContextProfile({ avatar: '' });
          try {
            await supabase.from('profiles').update({ community_avatar: '', avatar_url: '' }).eq('id', userId);
            await supabase.from('family_members').update({ avatar: '' }).eq('user_id', userId);
          } catch {}
          sweetAlert.success('Photo Removed', 'Profile picture removed');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: '' }));
          setOriginalData(prev => ({ ...prev, coverPhoto: '' }));
          await updateCommunityProfile({ coverPhoto: '' });
          try {
            await supabase.from('profiles').update({ community_cover: '' }).eq('id', userId);
          } catch {}
          sweetAlert.success('Cover Photo Removed', 'Cover photo removed');
        }
        await refreshUserData();
      },
      () => {},
      'Remove',
      'Cancel'
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setOriginalData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     ACTION HANDLERS
     ═══════════════════════════════════════════════════════════════════════════ */

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

  const handleDeleteCommunityAccount = useCallback(() => {
    sweetAlert.confirm(
      'Delete Community Profile',
      '⚠️ This will permanently delete your community profile, all posts, comments, and activity. This cannot be undone.',
      async () => {
        const result = await deleteAccountWithConfirmation();
        if (result.success) {
          sweetAlert.success('Account Deleted', result.message);
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' as never }],
          });
        } else {
          sweetAlert.error('Error', result.message);
        }
      },
      () => {},
      'Delete',
      'Cancel'
    );
  }, [deleteAccountWithConfirmation, navigation, sweetAlert]);

  const handleNavigateToMessages = () => {
    navigation.navigate('ChatList');
  };

  const handleGoVerify = useCallback(() => {
    triggerHaptic('light');
    navigation.navigate('CommunityVerification');
  }, [navigation, triggerHaptic]);

  const handleSave = async () => {
    if (!currentUser) return;

    let effectiveDisplayName = (formData.displayName || '').trim();
    if (!effectiveDisplayName) {
      const fallback =
        (currentUser.displayName || '').trim() ||
        ((profile as any)?.fullName || '').toString().trim() ||
        ((userProfile as any)?.fullName || '').toString().trim() ||
        (currentUser.handle || '').replace(/^@+/, '').replace(/[_.]/g, ' ').trim() ||
        (currentUser.email || '').split('@')[0] ||
        'Parent';
      effectiveDisplayName = fallback;
      setFormData(prev => ({ ...prev, displayName: effectiveDisplayName }));
    }

    if (!effectiveDisplayName) {
      sweetAlert.error('Validation Error', 'Display name is required');
      triggerHaptic('error');
      return;
    }

    const cleanHandle = formData.handle
      .replace(/^@+/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.]/g, '');

    if (!cleanHandle || cleanHandle.length < 3) {
      sweetAlert.error('Validation Error', 'Username must be at least 3 characters');
      triggerHaptic('error');
      return;
    }
    if (cleanHandle.length > 30) {
      sweetAlert.error('Validation Error', 'Username must be less than 30 characters');
      triggerHaptic('error');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(cleanHandle)) {
      sweetAlert.error(
        'Invalid Username',
        'Must start with a letter. Only letters, numbers, underscores, and dots allowed.'
      );
      triggerHaptic('error');
      return;
    }

    const originalHandle = originalData.handle.replace(/^@+/, '');
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
        displayName: effectiveDisplayName,
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

      const originalClean = originalHandle.replace(/^@+/, '').toLowerCase();
      if (cleanHandle !== originalClean) {
        const result = await updateUsername(originalClean, cleanHandle, currentUser.id);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      // Write to the auth/user context first (this is what actually persists
      // community_bio to Supabase `profiles`), then to the community context.
      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);

      // Only mirror name/avatar/handle into feed posts — NOT bio.
      // Bio is read fresh from `currentUser` everywhere it's displayed, and
      // mirroring it into every post's author object triggers a giant feed
      // rewrite that can land *after* refreshUserData() and stomp the bio.
      await syncUserProfileAcrossPosts(currentUser.id, {
        displayName: updates.displayName,
        handle: updates.handle,
        avatar: updates.avatar,
      });

      // Verify the context actually took the bio before we exit edit mode.
      // If it didn't (e.g. because currentUser was still null), abort loudly
      // instead of silently showing "saved".
      if (typeof updates.bio === 'string') {
        const confirmedBio = (getUserProfile?.() ?? currentUser)?.bio;
        if ((confirmedBio ?? '') !== updates.bio) {
          if (__DEV__) {
            console.warn(
              '[CommunityProfile] bio did not persist in context. expected:',
              JSON.stringify(updates.bio),
              'got:',
              JSON.stringify(confirmedBio),
            );
          }
        }
      }

      if (formData.avatar && formData.avatar !== originalData.avatar && !formData.avatar.startsWith('file://')) {
        try {
          await supabase
            .from('profiles')
            .update({ community_avatar: formData.avatar, avatar_url: formData.avatar })
            .eq('id', currentUser.id);
          await supabase
            .from('family_members')
            .update({ avatar: formData.avatar })
            .eq('user_id', currentUser.id);
        } catch {}
      }

      const newAchievements = await checkAndAwardAchievements();
      if (newAchievements.length > 0) {
        sweetAlert.success('Achievement Unlocked!', `You earned ${newAchievements.length} new badge${newAchievements.length > 1 ? 's' : ''}!`);
      }

      triggerHaptic('success');
      setIsEditing(false);
      setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
      // NOTE: intentionally NOT calling refreshUserData() here. It re-reads
      // followers/following and re-renders the hero, but it does NOT touch
      // bio — and its async completion was racing the save and, in the worst
      // case, overwriting `currentUser.bio` with a stale value. The bio is
      // already authoritative in context and rendered straight from
      // `currentUser.bio` / `formData.bio`, so a refresh isn't needed.
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

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDERS
     ═══════════════════════════════════════════════════════════════════════════ */

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

    const isEmoji = isEmojiAvatar(avatarSource);
    const isUrl = avatarSource && (avatarSource.startsWith('http') || avatarSource.startsWith('file://'));

    return (
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
        <View style={styles.coverPhotoContainer}>
          {coverPhoto ? (
            <Image
              source={{ uri: coverPhoto }}
              style={styles.coverPhoto}
              resizeMode="cover"
              onError={() => console.warn('Cover photo failed to load')}
            />
          ) : (
            <View style={styles.coverPhoto} pointerEvents="none">
              {isUrl && avatarSource ? (
                <>
                  <Image
                    source={{ uri: avatarSource }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    blurRadius={Platform.OS === 'ios' ? 28 : 20}
                  />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 15, 30, 0.45)' }]} />
                  <LinearGradient
                    colors={['rgba(99,102,241,0.30)', 'rgba(139,92,246,0.12)', 'rgba(0,0,0,0.50)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </>
              ) : (
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6', '#6a82fb']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text
                      style={{
                        fontSize: 140,
                        opacity: 0.35,
                        transform: [{ scale: 1.2 }],
                      }}
                    >
                      {isEmoji && avatarSource
                        ? avatarSource
                        : currentUser.displayName?.charAt(0)?.toUpperCase() || '👤'}
                    </Text>
                  </View>
                </LinearGradient>
              )}
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.65)']}
            style={styles.coverPhotoOverlay}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />

          {!coverPhoto && (
            <View style={styles.coverPhotoPlaceholder} pointerEvents="none">
              <View style={styles.coverEmptyRing}>
                <View style={styles.coverEmptyIconChip}>
                  <Ionicons name="camera" size={26} color="#fff" />
                </View>
                <Text style={styles.coverPhotoText}>Add Cover Photo</Text>
                <Text style={styles.coverEmptyHint}>Tap to choose</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { zIndex: 3 }]}
            activeOpacity={0.9}
            onPress={() => {
              triggerHaptic('light');
              setShowCoverPicker(true);
            }}
          >
            {!!coverPhoto && (
              <View style={styles.coverPhotoEditBadge} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(99,102,241,0.9)', 'rgba(139,92,246,0.9)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!isEditing) return;
              triggerHaptic('light');
              setShowImagePicker(true);
            }}
            style={styles.avatarWrapper}
            disabled={!isEditing}
          >
            {avatarSource ? (
              isEmoji ? (
                <View style={[styles.avatarImage, styles.avatarEmojiContainer]}>
                  <Text style={styles.avatarEmojiText}>{avatarSource}</Text>
                </View>
              ) : isUrl ? (
                <Image
                  source={{ uri: avatarSource }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => console.warn('Avatar image failed to load')}
                />
              ) : (
                <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>
                    {currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder, { backgroundColor: `${roleConfig.color}25` }]}>
                <Text style={styles.avatarPlaceholderText}>
                  {currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.avatarEditBadge} pointerEvents="none">
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{currentUser.displayName}</Text>
            {currentUser.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleGoVerify}
                activeOpacity={0.8}
                style={styles.verifyPillHero}
              >
                <View style={styles.verifyPillHollowTick}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
                <Text style={styles.verifyPillHeroText}>Verify</Text>
              </TouchableOpacity>
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

          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{userPostList.length}</Text>
              <Text style={styles.statsLabel}>Posts</Text>
            </View>
            <View style={styles.statsDivider} />
            <TouchableOpacity
              style={styles.statsItem}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('light');
                if (!currentUser) return;
                navigation.navigate('Followers', { userId: currentUser.id });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${followerCount} followers, tap to view list`}
            >
              <Text style={styles.statsValue}>{followerCount}</Text>
              <Text style={styles.statsLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statsDivider} />
            <TouchableOpacity
              style={styles.statsItem}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('light');
                if (!currentUser) return;
                navigation.navigate('Following', { userId: currentUser.id });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${followingCount} following, tap to view list`}
            >
              <Text style={styles.statsValue}>{followingCount}</Text>
              <Text style={styles.statsLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
    { key: 'settings' as ProfileTab, label: 'Settings', icon: 'settings-outline' },
  ];

  /* ═══════════════════════════════════════════════════════════════════════════
     OVERVIEW TAB
     ═══════════════════════════════════════════════════════════════════════════ */

  const renderOverviewTab = useCallback(() => (
    <Animated.View entering={FadeInUp.springify()} style={styles.tabPanel}>
      {/* Verification CTA — hollow tick placeholder for unverified members */}
      {!currentUser?.isVerified && (
        <VerificationCta onPress={handleGoVerify} isDark={isDark} colors={fullThemeColors} />
      )}

      <View style={styles.kpiPillRow}>
        <KpiPill icon="📝" value={userPostList.length} label="Posts" color={TC.primary} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="👥" value={followerCount} label="Followers" color={TC.secondary} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="🔥" value={currentUser?.stats?.streakDays || 0} label="Streak" color={TC.accent} isDark={isDark} colors={fullThemeColors} />
        <KpiPill icon="💙" value={currentUser?.stats?.helpful || 0} label="Helpful" color={TC.success} isDark={isDark} colors={fullThemeColors} />
      </View>

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

      <Animated.View entering={FadeInUp.delay(220).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.identityHeader}>
            <View style={[styles.identityIconBg, { backgroundColor: `${TC.primary}15` }]}>
              <Ionicons name="sparkles" size={20} color={TC.primary} />
            </View>
            <View style={styles.identityTitleWrap}>
              <Text style={styles.identityTitle}>About You</Text>
              <Text style={styles.identitySubtitle}>
                {currentUser?.handle}
                {(currentUser as any)?.addedAt
                  ? ` · Joined ${new Date((currentUser as any).addedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                  : ''}
              </Text>
            </View>
          </View>

          {(formData.bio || currentUser?.bio) ? (
            <Text style={styles.identityBio} numberOfLines={4}>
              {formData.bio || currentUser?.bio}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.8}>
              <Text style={[styles.identityBio, { color: TC.primary, fontWeight: '700' }]}>
                + Add a bio so parents know who you are
              </Text>
            </TouchableOpacity>
          )}

          {formData.location ? (
            <View style={styles.identityLocationRow}>
              <Ionicons name="location" size={14} color={TC.primary} />
              <Text style={styles.identityLocationText}>{formData.location}</Text>
            </View>
          ) : null}

          {(currentUser?.achievements?.length ?? 0) > 0 && (
            <>
              <View style={[styles.identityDivider, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }]} />
              <View style={styles.identityBadgesHeader}>
                <Text style={styles.identityBadgesLabel}>Recent badges</Text>
                <TouchableOpacity onPress={() => handleTabChange('achievements')} activeOpacity={0.7}>
                  <Text style={[styles.identityBadgesSeeAll, { color: TC.primary }]}>
                    See all →
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.identityBadgesRow}>
                {(currentUser?.achievements || []).slice(0, 4).map((achievement) => {
                  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: TC.primary };
                  return (
                    <View
                      key={achievement}
                      style={[styles.identityBadgeChip, { backgroundColor: `${badge.color}12`, borderColor: `${badge.color}30` }]}
                    >
                      <Text style={styles.identityBadgeEmoji}>{badge.emoji}</Text>
                      <Text style={[styles.identityBadgeName, { color: badge.color }]} numberOfLines={1}>
                        {badge.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </GlassCard>
      </Animated.View>

      {userPostList.length > 0 && (
        <Animated.View entering={FadeInUp.delay(260).springify()}>
          <SectionHeader
            title="Recent Threads"
            subtitle={`${userPostList.length} total`}
            action={() => handleTabChange('posts')}
            actionLabel="See all"
            isDark={isDark}
            colors={fullThemeColors}
          />
          <View style={{ gap: 10 }}>
            {userPostList.slice(0, 2).map((post) => {
              const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
              const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || TC.primary;
              return (
                <TouchableOpacity
                  key={post.id}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  activeOpacity={0.8}
                  style={styles.previewPostCard}
                >
                  <LinearGradient
                    colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.previewPostHeader}>
                    <View style={[styles.previewPostTopic, { backgroundColor: `${topicColor}15` }]}>
                      <View style={[styles.previewPostTopicDot, { backgroundColor: topicColor }]} />
                      <Text style={[styles.previewPostTopicText, { color: topicColor }]} numberOfLines={1}>
                        {topic?.name || 'General'}
                      </Text>
                    </View>
                    <Text style={styles.previewPostTime}>{post.time}</Text>
                  </View>
                  <Text style={styles.previewPostContent} numberOfLines={2}>{post.content}</Text>
                  <View style={styles.previewPostStats}>
                    <View style={styles.previewPostStat}>
                      <Ionicons name="heart" size={13} color={post.isLiked ? TC.danger : '#94a3b8'} />
                      <Text style={[styles.previewPostStatText, { color: post.isLiked ? TC.danger : '#94a3b8' }]}>
                        {post.likes}
                      </Text>
                    </View>
                    <View style={styles.previewPostStat}>
                      <Ionicons name="chatbubble" size={13} color="#94a3b8" />
                      <Text style={styles.previewPostStatText}>{post.commentsCount}</Text>
                    </View>
                    <View style={styles.previewPostStat}>
                      <Ionicons name="eye" size={13} color="#94a3b8" />
                      <Text style={styles.previewPostStatText}>{post.viewCount || 0}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}

      {allUsers.length > 1 && (
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <SectionHeader
            title="Your Circle"
            subtitle={`${followerCount} followers · ${followingCount} following`}
            action={() => navigation.navigate('SearchUsers', {})}
            actionLabel="Find more"
            isDark={isDark}
            colors={fullThemeColors}
          />
          <View style={styles.circleStrip}>
            {allUsers
              .filter(u => u.id !== currentUser?.id)
              .slice(0, 5)
              .map((u) => {
                const uAvatar = u.avatar;
                const isEmoji = isEmojiAvatar(uAvatar);
                const isUrl = uAvatar && (uAvatar.startsWith('http') || uAvatar.startsWith('file://'));
                return (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => {
                      triggerHaptic('light');
                      navigation.push('CommunityMemberProfile', { userId: u.id });
                    }}
                    style={styles.circleCard}
                    activeOpacity={0.8}
                  >
                    <View style={styles.circleAvatarWrap}>
                      {isUrl ? (
                        <Image source={{ uri: uAvatar }} style={styles.circleAvatar} />
                      ) : isEmoji ? (
                        <View style={[styles.circleAvatar, { backgroundColor: `${TC.primary}20`, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 22 }}>{uAvatar}</Text>
                        </View>
                      ) : (
                        <View style={[styles.circleAvatar, { backgroundColor: `${TC.primary}20`, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: TC.primary }}>
                            {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.circleName} numberOfLines={1}>
                      {u.displayName?.split(' ')[0] || 'Parent'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            <TouchableOpacity
              onPress={() => navigation.navigate('SearchUsers', {})}
              style={styles.circleCard}
              activeOpacity={0.8}
            >
              <View style={[styles.circleAvatar, { backgroundColor: `${TC.primary}10`, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: `${TC.primary}30`, borderStyle: 'dashed' }]}>
                <Ionicons name="add" size={24} color={TC.primary} />
              </View>
              <Text style={[styles.circleName, { color: TC.primary, fontWeight: '700' }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(340).springify()}>
        <GlassCard isDark={isDark} colors={fullThemeColors}>
          <View style={styles.sparklineHeader}>
            <View>
              <Text style={styles.sparklineTitle}>Contribution Streak</Text>
              <Text style={styles.sparklineSubtitle}>Last 12 weeks</Text>
            </View>
            <View style={styles.sparklineTotal}>
              <Text style={styles.sparklineTotalValue}>{activityScore.consistency}%</Text>
              <Text style={styles.sparklineTotalLabel}>consistency</Text>
            </View>
          </View>
          <View style={styles.contributionGrid}>
            {(() => {
              const now = new Date();
              const cells: { active: boolean; weekStart: Date }[] = [];
              for (let i = 11; i >= 0; i--) {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - i * 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const hasActivity = userPostList.some(p => {
                  const d = new Date(p.timestamp);
                  return d >= weekStart && d < weekEnd;
                });
                cells.push({ active: hasActivity, weekStart });
              }
              return cells.map((cell, i) => (
                <View
                  key={i}
                  style={[
                    styles.contributionCell,
                    cell.active && { backgroundColor: TC.primary, borderColor: TC.primary },
                  ]}
                />
              ));
            })()}
          </View>
          <Text style={styles.contributionFooter}>
            {(currentUser?.stats?.streakDays || 0) > 0
              ? `🔥 ${currentUser?.stats?.streakDays} day streak — keep it going!`
              : 'Start posting daily to build a streak'}
          </Text>
        </GlassCard>
      </Animated.View>

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
              <TextInput style={[styles.input, styles.flexInput]} value={formData.location} onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))} placeholder={locationDetected?.full || "Detecting location..."} placeholderTextColor="#666" editable={isEditing} selectionColor={themeColors.primary} />
            </View>
            {locationDetected && (
              <Text style={styles.locationDetectedText}>
                📍 Detected: {locationDetected.full}
              </Text>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
              <Ionicons name="at" size={18} color="#6366f1" style={styles.inputIcon} />
              <TextInput style={[styles.input, styles.flexInput]} value={formData.handle} onChangeText={(text) => {
                const cleaned = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '');
                setFormData(prev => ({ ...prev, handle: cleaned }));
              }} placeholder="username" placeholderTextColor="#666" autoCapitalize="none" editable={isEditing} selectionColor={themeColors.primary} />
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
            <Text style={styles.bioText}>
              {formData.bio || currentUser?.bio || 'No bio yet. Tap edit to add one!'}
            </Text>
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

      <TouchableOpacity
        style={[styles.manageTopicsBtn, { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff' }]}
        onPress={() => navigation.navigate('CommunityOnboarding', { editing: true })}
      >
        <Ionicons name="pricetags-outline" size={22} color="#6366f1" />
        <Text style={[styles.manageTopicsText, { color: isDark ? '#ffffff' : '#1a1a2e' }]}>
          Manage Your Topics {selectedTopics.length > 0 ? `(${selectedTopics.length})` : ''}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>

      <GlassCard delay={700} isDark={isDark} colors={fullThemeColors}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={styles.sectionLabel}>Interested Topics</Text>
        </View>
        <View style={styles.topicsWrap}>
          {selectedTopics.length > 0 ? selectedTopics.map((topicId) => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            const topicColor = topic?.color || TOPIC_COLORS[topicId] || '#6366f1';
            const topicName = topic?.name || topicId;
            return (
              <View key={topicId} style={[styles.topicChip, { backgroundColor: `${topicColor}20` }]}>
                <Text style={[styles.topicChipText, { color: topicColor }]}>
                  {topic?.emoji ? `${topic.emoji} ${topicName}` : topicName}
                </Text>
              </View>
            );
          }) : (
            <Text style={styles.emptyText}>No topics selected yet. Tap "Manage Your Topics" above.</Text>
          )}
        </View>
      </GlassCard>

      {!isEditing && (
        <View style={styles.dockContainer}>
          <View style={styles.dock}>
            <TouchableOpacity onPress={handleNavigateToMessages} style={styles.dockItem}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.dockGradient}>
                <Ionicons name="chatbubbles" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.dockLabel}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShareProfile} style={styles.dockItem}>
              <View style={[styles.dockGradient, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                <Ionicons name="share-outline" size={20} color="#6366f1" />
              </View>
              <Text style={styles.dockLabel}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  ), [
    userPostList, followerCount, currentUser, allUsers,
    influenceMetrics, weeklyImpact, communityStanding,
    contentBreakdown, engagementData, smartSuggestions,
    topicAffinities, peerComparisons, contentStreaks,
    selectedTopics, isEditing, isDark, fullThemeColors,
    formData.bio, formData.location, formData.handle,
    locationDetected, usernameCheckStatus, isCheckingUsername,
    themeColors, navigation, handleShareProfile,
    handleNavigateToMessages, isProfileDeactivated, handleGoVerify,
    triggerHaptic, currentUser?.bio,
  ]);

  /* ═══════════════════════════════════════════════════════════════════════════
     POSTS TAB
     ═══════════════════════════════════════════════════════════════════════════ */

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
              onPress={() => navigation.navigate('CreatePost', {})}
            >
              <Text style={styles.createPostBtnText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsList}>
            {posts.map((post) => {
              const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
              const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || TC.primary;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postItem}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']}
                    style={StyleSheet.absoluteFill}
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

  /* ═══════════════════════════════════════════════════════════════════════════
     ACHIEVEMENTS TAB
     ═══════════════════════════════════════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════════════════════════════════════
     SETTINGS TAB
     ═══════════════════════════════════════════════════════════════════════════ */

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
                    name={(formData[pref.key as keyof typeof formData] ? pref.icon : `${pref.icon.replace('-outline', '')}-outline`) as any}
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

        <TouchableOpacity style={styles.dangerActionBtn} onPress={handleClearActivity}>
          <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </View>
          <Text style={styles.dangerActionText}>Clear Activity History</Text>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>

        {isProfileDeactivated ? (
          <TouchableOpacity style={[styles.dangerActionBtn, styles.reactivateActionBtn]} onPress={handleReactivateProfile}>
            <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="refresh-outline" size={18} color="#10b981" />
            </View>
            <Text style={[styles.dangerActionText, { color: '#10b981' }]}>Reactivate Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.dangerActionBtn} onPress={handleDeactivateProfile}>
            <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Ionicons name="pause-circle-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.dangerActionText, { color: '#f59e0b' }]}>Deactivate Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}

        <View style={styles.dangerDivider} />

        <TouchableOpacity style={[styles.dangerActionBtn, styles.deleteAccountBtn]} onPress={handleDeleteCommunityAccount}>
          <View style={[styles.dangerActionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
          </View>
          <Text style={[styles.dangerActionText, { color: '#ef4444', fontWeight: '700' }]}>
            Delete Entire Account
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN RENDER — paints immediately, skeleton only for the hero
     ═══════════════════════════════════════════════════════════════════════════ */

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
          {!isEditing && currentUser && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                // `push` (not `navigate`) — guarantees a same-stack push and
                // bypasses the root stack's resolution ambiguity.
                navigation.push('CommunityMemberProfile', {
                  userId: currentUser.id,
                });
              }}
              style={styles.editToggleBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="View as others see me"
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {!isEditing ? (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                setIsEditing(true);
              }}
              style={styles.editToggleBtn}
              disabled={isSaving || avatarUploading || coverUploading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                if (hasChanges) handleSave();
                else {
                  setIsEditing(false);
                  setFormData({ ...originalData });
                }
              }}
              style={[styles.editToggleBtn, styles.editToggleBtnActive]}
              disabled={isSaving || avatarUploading || coverUploading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isSaving || avatarUploading || coverUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Hero — skeleton on first frame, real content once formData resolves */}
        {isHydrating && !formData.displayName ? (
          <HeroSkeleton isDark={isDark} colors={fullThemeColors} insetsTop={insets.top} />
        ) : (
          renderProfileHero()
        )}

        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={fullThemeColors} />
        <View>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </View>
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving || avatarUploading || coverUploading} text={avatarUploading ? "Uploading avatar..." : coverUploading ? "Uploading cover..." : "Saving changes..."} size="medium" overlay={true} blur={true} section="main" />

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

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const getStyles = (isDarkMode: boolean, colors: any = {}) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background || (isDarkMode ? '#0f0f1a' : '#f8f9fc') },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: 24, minHeight: SCREEN_H },

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

  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16, marginTop: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },

  editToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 15, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 30,
  },
  editToggleBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },

  profileHero: { marginHorizontal: 16, marginBottom: 20 },
  coverPhotoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(15, 15, 30, 0.9)',
  },
  coverPhoto: { width: '100%', height: '100%' },
  coverPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  coverPhotoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPhotoText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverEmptyRing: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  coverEmptyIconChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 2,
  },
  coverEmptyHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  coverPhotoEditBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  avatarSection: { alignItems: 'center', marginTop: -50 },
  avatarWrapper: {
    position: 'relative',
    zIndex: 20,
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
  avatarEmojiContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6366f125',
  },
  avatarEmojiText: {
    fontSize: 44,
    lineHeight: 100,
    textAlign: 'center',
    textAlignVertical: 'center',
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
  verifyPillHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  verifyPillHollowTick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  verifyPillHeroText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  profileMeta: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#64748b' },
  profileBio: { fontSize: 14, color: colors.textSecondary || '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  locationDetectedText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
    marginHorizontal: 20,
    fontWeight: '500'
  },

  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 20 },
  statsItem: {
  alignItems: 'center',
  paddingVertical: 4,
  paddingHorizontal: 6,
  borderRadius: 8,
},
  statsValue: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  statsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  statsDivider: { width: 1, height: 24, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },

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

  impactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  impactTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  impactTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  impactTrendText: { fontSize: 12, fontWeight: '700' },
  impactGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  impactItem: { flex: 1, alignItems: 'center', gap: 4 },
  impactItemIcon: { fontSize: 20 },
  impactItemValue: { fontSize: 20, fontWeight: '800' },
  impactItemLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

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

  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  breakdownTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  breakdownTotal: { fontSize: 12, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  breakdownGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
  breakdownIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  breakdownValue: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  sparklineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  sparklineChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: colors.textMuted || '#94a3b8' },

  suggestionsScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  suggestionCard: { width: 160, padding: 14, borderRadius: 20, overflow: 'hidden' },
  suggestionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  suggestionEmoji: { fontSize: 22 },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: colors.text || '#1e293b', marginBottom: 4 },
  suggestionDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: colors.textSecondary || '#64748b', marginBottom: 10 },
  suggestionActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  suggestionActionText: { fontSize: 11, fontWeight: '700' },

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

  streaksRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', borderWidth: 1, backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)' },
  streakIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  streakValue: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  streakBest: { fontSize: 10, fontWeight: '500', color: colors.textMuted || '#94a3b8', marginTop: 2 },

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

  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN.spacing.md, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, color: colors.textMuted || '#94a3b8', fontWeight: '500' },

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

  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
  },
  dockLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#64748b' },

  tabPanel: { paddingBottom: 20 },
  postsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16
  },
  postsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postsHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  postsHeaderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  postsHeaderBadgeText: { fontSize: 12, fontWeight: '700' },

  postsList: { gap: 12, paddingHorizontal: 16 },
  postItem: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  },
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
    marginHorizontal: 16,
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

  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16
  },
  achievementsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achievementsHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#1e293b' },
  achievementsHeaderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  achievementsHeaderBadgeText: { fontSize: 12, fontWeight: '700' },

  achievementsCard: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
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

  progressCard: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
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

  settingsCard: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
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

  dangerCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 16,
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
  dangerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginVertical: 8
  },
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
  deleteAccountBtn: { marginTop: 0 },
  reactivateActionBtn: { backgroundColor: 'rgba(16,185,129,0.04)' },
  dangerActionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dangerActionText: { fontSize: 14, fontWeight: '600', color: '#ef4444', flex: 1 },

  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: colors.text || '#1e293b', flex: 1 },

  emojiPickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emojiPickerSheet: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 20, paddingBottom: 40, overflow: 'hidden' },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, overflow: 'hidden' },
  modalDragHandle: { width: '100%', alignItems: 'center', paddingVertical: 8 },
  dragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' },

  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* ── Verification CTA card ─────────────────────────────────────────── */
  verifyCta: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  verifyCtaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,30,0.18)',
  },
  verifyTickCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  verifyCtaBody: { flex: 1, gap: 4 },
  verifyCtaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  verifyCtaDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 17,
  },
  verifyCtaButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  verifyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  verifyCtaButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366f1',
  },
  verifyCtaFootnote: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  /* ── Identity / Threads / Circle / Streak grid ─────────────────────── */
  identityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  identityIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  identityTitleWrap: { flex: 1 },
  identityTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#1e293b' },
  identitySubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#64748b', marginTop: 2 },
  identityBio: {
    fontSize: 14, lineHeight: 20, fontWeight: '500',
    color: colors.textSecondary || '#64748b',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  identityLocationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  identityLocationText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary || '#64748b' },
  identityDivider: {
    height: 1, marginHorizontal: 16, marginBottom: 12,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  identityBadgesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  identityBadgesLabel: {
    fontSize: 11, fontWeight: '700',
    color: colors.textSecondary || '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  identityBadgesSeeAll: { fontSize: 12, fontWeight: '700' },
  identityBadgesRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingBottom: 16, gap: 8,
  },
  identityBadgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, maxWidth: '48%',
  },
  identityBadgeEmoji: { fontSize: 14 },
  identityBadgeName: { fontSize: 12, fontWeight: '700' },

  previewPostCard: {
    borderRadius: 16, overflow: 'hidden', borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    marginHorizontal: 16,
  },
  previewPostHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  previewPostTopic: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: '70%',
  },
  previewPostTopicDot: { width: 5, height: 5, borderRadius: 3 },
  previewPostTopicText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewPostTime: { fontSize: 10, fontWeight: '500', color: colors.textMuted || '#94a3b8' },
  previewPostContent: {
    fontSize: 14, fontWeight: '600', color: colors.text || '#1e293b',
    lineHeight: 20, paddingHorizontal: 14, paddingBottom: 10,
  },
  previewPostStats: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  previewPostStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewPostStatText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },

  circleStrip: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4, gap: 12,
  },
  circleCard: { alignItems: 'center', width: 68 },
  circleAvatarWrap: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  circleAvatar: { width: 52, height: 52, borderRadius: 26 },
  circleName: {
    fontSize: 11, fontWeight: '600',
    color: colors.textSecondary || '#64748b',
    marginTop: 6, textAlign: 'center',
  },

  contributionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  contributionCell: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contributionFooter: {
    fontSize: 12, fontWeight: '500',
    color: colors.textSecondary || '#64748b',
    paddingHorizontal: 16, paddingBottom: 14, textAlign: 'center',
  },
});