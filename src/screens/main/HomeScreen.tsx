import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  useColorScheme,
  View,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInRight,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay, differenceInHours, differenceInDays, differenceInMonths } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Contexts
import { useCustomization } from '../../hooks/useCustomization';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCommunity } from '../../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../../context/AudioContext';
import { useMedia } from '../../context/MediaContext';
import { useFamilyChat } from '../../context/FamilyChatContext';
import { useFamily } from '../../context/FamilyContext';
import { useSafety } from '../../context/SafetyContext';
import { useApp } from '../../context/AppContext';

// Components
import CorrelationCard from '../../components/trackers/CorrelationCard';
import PredictionCard from '../../components/trackers/PredictionCard';
import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import FamilyStack from '../../components/FamilyStack';
import { useSweetAlert } from '../../components/SweetAlert';
import { ShimmerLoader } from '../../components/UniversalSpinner';
import { RelationshipBackfillBanner } from '../../components/RelationshipBackfillBanner';

// Types
import type { RootStackParamList } from '../../types/navigation';
import { navigationRef } from '../../navigation/navigationRef';
import { getMemberDisplayLabel } from '../../types/roles';
import { resolveTargetId } from '../../utils/memberNavigation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const littleLoomLogo = require('../../../assets/logo 4.png');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aligned with Community Screen
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  // Primary palette
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

  // Grays
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

  // Dark mode
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',

  // Spacing
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },

  // Radius
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },

  // Shadows
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

/* ═══════════════════════════════════════════════════════════════════════════
   CACHE KEYS
   ═══════════════════════════════════════════════════════════════════════════ */
// Cache keys are namespaced by userId so account-switch on the same device
// can never hydrate one user's cache into another user's session. The bare
// names are kept only for one-time cleanup in signOut (AuthContext).
const CACHE_KEYS = {
  BABY: '@littleloom_cached_baby_v3',
  ACTIVITIES: '@littleloom_cached_activities_v3',
};

const scopedCacheKey = (base: string, userId: string | null | undefined, babyId?: string | null) => {
  if (!userId) return null;
  const babySuffix = babyId ? `_${babyId}` : '';
  return `${base}_${userId}${babySuffix}`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  iconName: string;
  color: string;
  gradient: [string, string];
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
  category: 'daily' | 'health' | 'family' | 'tools';
  badgeCount?: number;
  badgeLabel?: string;
}

interface FeatureCard {
  id: string;
  label: string;
  icon: string;
  color: string;
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
  badge?: string;
  badgeColor?: string;
  description: string;
}

interface SmartNotification {
  id: string;
  type: 'vaccine' | 'milestone' | 'reminder' | 'growth' | 'streak' | 'tip' | 'weather' | 'sleep';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  actionScreen?: keyof RootStackParamList;
  actionParams?: Record<string, any>;
  actionLabel?: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  timestamp: number;
  dismissed?: boolean;
}

interface DailySummary {
  feeds: number;
  sleepHours: number;
  diapers: number;
  lastFeedTime: Date | null;
  lastSleepTime: Date | null;
  yesterdayFeeds: number;
  yesterdaySleepHours: number;
  yesterdayDiapers: number;
}

interface VaccinationReminder {
  id: string;
  vaccineName: string;
  dueDate: Date;
  status: 'upcoming' | 'overdue' | 'completed';
  doseNumber: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER VISUAL CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const TRACKER_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '💧' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🏆' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper', emoji: '👶' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
  pump: { icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pump', emoji: '🔄' },
  pumping: { icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pumping', emoji: '🔄' },
  bath: { icon: 'water-outline', color: '#3b82f6', label: 'Bath', emoji: '🛁' },
  play: { icon: 'game-controller-outline', color: '#ec4899', label: 'Play', emoji: '🎮' },
  walk: { icon: 'walk-outline', color: '#10b981', label: 'Walk', emoji: '🚶' },
  temperature: { icon: 'thermometer-outline', color: '#f97316', label: 'Temp', emoji: '🌡️' },
  symptom: { icon: 'pulse-outline', color: '#ef4444', label: 'Symptom', emoji: '🤒' },
  tummy_time: { icon: 'fitness-outline', color: '#10b981', label: 'Tummy Time', emoji: '🤸' },
  reading: { icon: 'book-outline', color: '#6366f1', label: 'Reading', emoji: '📚' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '•' },
};

const getTrackerCfg = (type?: string) => TRACKER_CONFIG[type || ''] || TRACKER_CONFIG.default;

const getDateTitle = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return format(date, 'EEEE');
  return format(date, 'MMM d, yyyy');
};

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION MAP
   ═══════════════════════════════════════════════════════════════════════════ */
const NAVIGATION_MAP: Record<string, { screen: keyof RootStackParamList; params?: Record<string, any> }> = {
  'Settings': { screen: 'Customize', params: {} },
  'UniversalTracker': { screen: 'UniversalTrackerHub', params: {} },
  'Reminders': { screen: 'TrackerReminders', params: {} },
  'Grow': { screen: 'GrowthDashboard', params: {} },
  'AchievementsScreen': { screen: 'Achievements', params: {} },
};

const DIRECT_SCREENS = new Set<string>([
  'UniversalTrackerHub', 'Timeline', 'GrowthDashboard', 'Achievements',
  'TrackerReminders', 'SafetyCorner', 'Gallery', 'SoundMixer',
  'FamilySharing', 'FamilyChatList', 'HelpCenter', 'ContactSupport',
  'Profile', 'SwitchBaby', 'CreateBabyProfile', 'EditProfile',
  'VaccinationSchedule', 'Customize', 'Main', 'Onboarding',
  'Login', 'SignUp', 'ForgotPassword', 'AddEntry', 'AddParent',
  'EditGuardian', 'SecurityCenter', 'BiometricSetup', 'BackupRestore',
  'LanguageSettings', 'UnitSettings', 'PrivacyPolicy', 'TermsOfService',
  'About', 'EntryDetail', 'Insights', 'CreateCustomTracker', 'More',
  'AllTrackers', 'BabyProfileScreen', 'FamilySettings', 'FamilyDashboard',
  'PediatricianPDFExport', 'CommunityMain', 'CommunityProfile',
  'CommunityMemberProfile', 'CommunityOnboarding', 'CommunityVerification',
  'Topic', 'TopicMembers', 'CreatePost', 'PostDetail', 'ChatList',
  'Chat', 'Notifications', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'Report', 'SecurityLock', 'FamilyChat', 'DoctorReports',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'feed', label: 'Feed', icon: '🍼', iconName: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#fee140'], screen: 'AddEntry', params: { trackerId: 'feed' }, category: 'daily' },
  { id: 'sleep', label: 'Sleep', icon: '😴', iconName: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'], screen: 'AddEntry', params: { trackerId: 'sleep' }, category: 'daily' },
  { id: 'diaper', label: 'Diaper', icon: '🧷', iconName: 'shirt-outline', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'], screen: 'AddEntry', params: { trackerId: 'diaper' }, category: 'daily' },
  { id: 'potty', label: 'Potty', icon: '🚽', iconName: 'water-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'], screen: 'AddEntry', params: { trackerId: 'potty' }, category: 'daily' },
  { id: 'growth', label: 'Growth', icon: '📏', iconName: 'trending-up-outline', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], screen: 'GrowthDashboard', params: {}, category: 'health' },
  { id: 'medication', label: 'Meds', icon: '💊', iconName: 'medical-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'AddEntry', params: { trackerId: 'medication' }, category: 'health' },
  { id: 'vaccine', label: 'Vaccines', icon: '💉', iconName: 'medical-outline', color: '#e11d48', gradient: ['#e11d48', '#fb7185'], screen: 'VaccinationSchedule', params: {}, category: 'health' },
  { id: 'temperature', label: 'Temp', icon: '🌡️', iconName: 'thermometer-outline', color: '#f97316', gradient: ['#f97316', '#fb923c'], screen: 'AddEntry', params: { trackerId: 'temperature' }, category: 'health' },
  { id: 'milestone', label: 'Milestone', icon: '🌟', iconName: 'trophy-outline', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'AddEntry', params: { trackerId: 'milestone' }, category: 'family' },
  { id: 'gallery', label: 'Gallery', icon: '🖼️', iconName: 'images-outline', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'Gallery', params: {}, category: 'family' },
  { id: 'family_chat', label: 'Chat', icon: '💬', iconName: 'chatbubbles-outline', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], screen: 'FamilyChatList', params: {}, category: 'family' },
  { id: 'note', label: 'Note', icon: '📝', iconName: 'document-text-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'AddEntry', params: { trackerId: 'note' }, category: 'family' },
  { id: 'reminders', label: 'Reminders', icon: '⏰', iconName: 'alarm-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'TrackerReminders', params: {}, category: 'tools' },
  { id: 'sound', label: 'Sounds', icon: '🎵', iconName: 'musical-notes-outline', color: '#1DB954', gradient: ['#1DB954', '#1ed760'], screen: 'SoundMixer', params: {}, category: 'tools' },
  { id: 'safety', label: 'Safety', icon: '🛡️', iconName: 'shield-checkmark-outline', color: '#dc2626', gradient: ['#dc2626', '#ef4444'], screen: 'SafetyCorner', params: {}, category: 'tools' },
  { id: 'settings', label: 'More', icon: '⚙️', iconName: 'apps-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'More', params: {}, category: 'tools' },
];

const FEATURE_CARDS: FeatureCard[] = [
  { id: 'growth', label: 'Growth Charts', icon: 'trending-up-outline', color: '#10b981', screen: 'GrowthDashboard', description: 'WHO percentiles & trends', badge: 'Live', badgeColor: '#10b981' },
  { id: 'milestones', label: 'Milestones', icon: 'trophy-outline', color: '#ec4899', screen: 'Achievements', description: 'Track developmental wins', badge: '3 New', badgeColor: '#ec4899' },
  { id: 'reminders', label: 'Reminders', icon: 'alarm-outline', color: '#f59e0b', screen: 'TrackerReminders', description: 'Never miss a thing', badge: '2 Due', badgeColor: '#f59e0b' },
  { id: 'family', label: 'Family Hub', icon: 'people-outline', color: '#3b82f6', screen: 'FamilySharing', description: 'Share with caregivers', badge: 'Live', badgeColor: '#3b82f6' },
  { id: 'safety', label: 'Safety Corner', icon: 'shield-checkmark-outline', color: '#ef4444', screen: 'SafetyCorner', description: 'Tips & emergency info', badge: 'New', badgeColor: '#ef4444' },
  { id: 'gallery', label: 'Memories', icon: 'images-outline', color: '#8b5cf6', screen: 'Gallery', description: 'Photos & moments', badge: '12', badgeColor: '#8b5cf6' },
  { id: 'chat', label: 'Family Chat', icon: 'chatbubbles-outline', color: '#06b6d4', screen: 'FamilyChatList', description: 'Stay connected', badge: '5', badgeColor: '#06b6d4' },
  { id: 'sound', label: 'Sound Mixer', icon: 'musical-notes-outline', color: '#1DB954', screen: 'SoundMixer', description: 'White noise & lullabies', badge: 'Playing', badgeColor: '#1DB954' },
  { id: 'vaccine', label: 'Vaccines', icon: 'medical-outline', color: '#e11d48', screen: 'VaccinationSchedule', description: 'Schedule & records', badge: '1 Due', badgeColor: '#e11d48' },
  { id: 'help', label: 'Help Center', icon: 'help-buoy-outline', color: '#4facfe', screen: 'HelpCenter', description: 'Guides & support', badge: undefined, badgeColor: undefined },
  { id: 'doctor_reports', label: 'Doctor Reports', icon: 'document-attach-outline', color: '#0891b2', screen: 'DoctorReports', description: 'Medical documents', badge: undefined, badgeColor: undefined },
];

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(
  ({
    children,
    style,
    colors = ['#667eea', '#764ba2', '#f093fb'],
    ...props
  }: {
    children: React.ReactNode;
    style?: any;
    colors?: string[];
    [k: string]: any;
  }) => {
    const raw = typeof children === 'string' ? children : String(children ?? '');
    const letters = raw.split('');

    const interpolateColor = (c1: string, c2: string, t: number) => {
      const r1 = parseInt(c1.slice(1, 3), 16);
      const g1 = parseInt(c1.slice(3, 5), 16);
      const b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16);
      const g2 = parseInt(c2.slice(3, 5), 16);
      const b2 = parseInt(c2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {letters.map((letter, index) => {
          const position = index / Math.max(letters.length - 1, 1);
          const colorIndex = position * (colors.length - 1);
          const lowerIndex = Math.floor(colorIndex);
          const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
          const fraction = colorIndex - lowerIndex;
          const startColor = colors[lowerIndex] || colors[0];
          const endColor = colors[upperIndex] || colors[colors.length - 1];
          const color = interpolateColor(startColor, endColor, fraction);
          return (
            <Text key={index} style={[style, { color }]} {...props}>
              {letter}
            </Text>
          );
        })}
      </View>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS CARD
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void }> =
  React.memo(({ children, style, onPress }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
      <Wrapper onPress={onPress} activeOpacity={0.85} style={[styles.glassCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, style]}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    );
  });
(GlassCard as any).displayName = 'GlassCard';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: () => void;
  actionLabel?: string;
  icon?: string;
  theme: any;
}> = React.memo(({ title, subtitle, action, actionLabel, icon, theme }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      {icon && (
        <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
          <Ionicons name={icon as any} size={16} color={theme.primary} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionHeaderSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionHeaderAction}>
        <Text style={[styles.sectionHeaderActionText, { color: theme.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    )}
  </View>
));
(SectionHeader as any).displayName = 'SectionHeader';

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON LOADERS
   ═══════════════════════════════════════════════════════════════════════════ */

const SoftShimmer: React.FC<{
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
  isDark?: boolean;
}> = ({ width = '100%', height = 16, borderRadius = 12, style, isDark = false }) => {
  const baseColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(200,210,230,0.25)';
  const highlightColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)';

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: baseColor, overflow: 'hidden' }, style]}>
      <ShimmerLoader
        width="100%"
        height="100%"
        borderRadius={borderRadius}
        colors={[baseColor, highlightColor, baseColor]}
        style={{ opacity: 0.7 }}
      />
    </View>
  );
};

const GlassSkeletonCard: React.FC<{ children: React.ReactNode; style?: any; isDark?: boolean }> = ({ children, style, isDark = false }) => (
  <View
    style={[
      {
        borderRadius: 20,
        padding: 16,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
      },
      style,
    ]}
  >
    <LinearGradient
      colors={isDark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
      style={StyleSheet.absoluteFill}
    />
    {children}
  </View>
);

const HomeSkeleton: React.FC<{ isDark: boolean; theme: any; borderRadius: number; compact?: boolean }> = React.memo(
  ({ isDark, theme, borderRadius, compact }) => {
    const pad = compact ? 16 : 20;
    return (
      <View style={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: pad, marginTop: 16, gap: 8 }}>
          <SoftShimmer width="55%" height={22} borderRadius={8} isDark={isDark} />
          <SoftShimmer width="35%" height={13} borderRadius={6} isDark={isDark} />
        </View>
        <View style={{ paddingHorizontal: pad, marginTop: 14 }}>
          <GlassSkeletonCard isDark={isDark} style={{ borderRadius: borderRadius, padding: 20, height: 92 }}>
            <SoftShimmer width="100%" height={52} borderRadius={8} isDark={isDark} />
          </GlassSkeletonCard>
        </View>
        <View style={{ paddingHorizontal: pad, marginTop: 14 }}>
          <GlassSkeletonCard isDark={isDark} style={{ borderRadius: borderRadius, padding: 20, height: 118 }}>
            <SoftShimmer width="100%" height={78} borderRadius={8} isDark={isDark} />
          </GlassSkeletonCard>
        </View>
        <View style={{ marginHorizontal: pad, marginTop: 14 }}>
          <GlassSkeletonCard isDark={isDark} style={{ borderRadius: borderRadius, padding: 20, height: 160 }}>
            <SoftShimmer width="100%" height={120} borderRadius={8} isDark={isDark} />
          </GlassSkeletonCard>
        </View>
      </View>
    );
  }
);
(HomeSkeleton as any).displayName = 'HomeSkeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   AURA HERO BANNER
   ═══════════════════════════════════════════════════════════════════════════ */

const AuraHeroBanner: React.FC<{
  isDark: boolean;
  theme: any;
  userProfile: any;
  currentBaby: any;
  greeting: string;
  currentTime: Date;
  postsCount: number;
  streakDays: number;
  unreadCount: number;
  onProfilePress: () => void;
  onBabyPress: () => void;
  onInsightsPress: () => void;
  onQuickAction: (action: string) => void;
}> = React.memo(({
  isDark,
  theme,
  userProfile,
  currentBaby,
  greeting,
  currentTime,
  postsCount,
  streakDays,
  unreadCount,
  onProfilePress,
  onBabyPress,
  onInsightsPress,
  onQuickAction,
}) => {
  return (
    <View
      style={[
        styles.heroBanner,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: isDark ? DS.darkBorder : DS.gray200,
          borderWidth: 1,
        },
      ]}
    >
      {/* Base gradient */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Aura glows */}
      <LinearGradient
        colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']}
        style={styles.auraGlowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      <View style={styles.heroContent}>
        {/* User row */}
        <View style={styles.heroHeader}>
          <TouchableOpacity style={styles.heroUserRow} onPress={onProfilePress} activeOpacity={0.8}>
            <SafeParentAvatar
              avatar={userProfile?.avatar}
              name={userProfile?.fullName || 'Parent'}
              size={52}
              showEditBadge={true}
            />
            <View style={styles.heroUserInfo}>
              <Text style={[styles.heroGreeting, { color: isDark ? DS.gray400 : DS.gray500 }]}>{greeting}</Text>
              <Text style={[styles.heroUserName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {userProfile?.fullName || 'Parent'}
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={[styles.verifiedBadge, { backgroundColor: isDark ? `${DS.success}20` : `${DS.success}15` }]}>
                  <Ionicons name="shield-checkmark" size={10} color={DS.success} />
                  <Text style={[styles.verifiedText, { color: DS.success }]}>Verified</Text>
                </View>
                <Text style={[styles.heroDate, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {format(currentTime, 'EEEE, MMM d')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={[styles.heroStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <TouchableOpacity style={styles.heroStat} onPress={onBabyPress}>
            <SafeBabyAvatar avatar={currentBaby?.avatar || '👶'} gender={currentBaby?.gender} size={24} />
            <View style={styles.heroStatText}>
              <Text style={[styles.heroStatValue, { color: DS.primary }]} numberOfLines={1}>
                {currentBaby?.name || 'Add Baby'}
              </Text>
              <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {currentBaby?.age || 'Setup'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: DS.accent }]}>{streakDays}</Text>
            <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Day Streak</Text>
          </View>
          <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: DS.warning }]}>{postsCount}</Text>
            <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Entries</Text>
          </View>
        </View>

        {/* Primary action row — 3 equal-weight buttons.
            Insights is the ONLY destination that isn't already
            reachable from the sticky header (Safety = shield) or
            the FamilyStack below (Family). So it gets its own
            primary-weight slot here instead of a redundant tile
            row that repeated the other two. */}
        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={[styles.heroActionBtn, { backgroundColor: DS.primary }]}
            onPress={() => onQuickAction('feed')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color={DS.white} />
            <Text style={styles.heroActionText}>Quick Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.heroActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
            onPress={() => onQuickAction('timeline')}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
            <Text style={[styles.heroActionText, { color: isDark ? DS.gray300 : DS.gray600 }]}>Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.heroActionBtn, { backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.10)' }]}
            onPress={onInsightsPress}
            activeOpacity={0.85}
          >
            <Ionicons name="analytics-outline" size={18} color={DS.success} />
            <Text style={[styles.heroActionText, { color: DS.success }]}>Insights</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
(AuraHeroBanner as any).displayName = 'AuraHeroBanner';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 1: DAILY SUMMARY WIDGET
   ═══════════════════════════════════════════════════════════════════════════ */

const DailySummaryWidget: React.FC<{
  summary: DailySummary;
  isDark: boolean;
  theme: any;
  onPress: (type: string) => void;
  streakDays: number;
}> = React.memo(({ summary, isDark, theme, onPress, streakDays }) => {
  const items = [
    { id: 'feeds', label: 'Feeds', value: summary.feeds.toString(), sublabel: summary.lastFeedTime ? formatDistanceToNow(summary.lastFeedTime, { addSuffix: true }) : 'No feeds yet', icon: 'nutrition-outline', gradient: ['#fa709a', '#fee140'] as [string, string] },
    { id: 'sleep', label: 'Sleep', value: `${summary.sleepHours.toFixed(1)}h`, sublabel: summary.lastSleepTime ? formatDistanceToNow(summary.lastSleepTime, { addSuffix: true }) : 'No sleep logged', icon: 'moon-outline', gradient: ['#11998e', '#38ef7d'] as [string, string] },
    { id: 'diapers', label: 'Diapers', value: summary.diapers.toString(), sublabel: 'Today', icon: 'shirt-outline', gradient: ['#667eea', '#764ba2'] as [string, string] },
    { id: 'streak', label: 'Streak', value: streakDays + 'd', sublabel: streakDays > 0 ? 'Keep it up!' : 'Start tracking!', icon: 'flame-outline', gradient: ['#f59e0b', '#fbbf24'] as [string, string] },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <View style={styles.dailySummaryContainer}>
        <View style={styles.dailySummaryHeader}>
          <View style={styles.dailySummaryTitleRow}>
            <View style={[styles.dailySummaryIconWrap, { backgroundColor: `${theme.primary}15` }]}>
              <Ionicons name="today-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.dailySummaryTitle, { color: theme.text }]}>Today's Summary</Text>
          </View>
          <Text style={[styles.dailySummaryDate, { color: theme.textMuted }]}>
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
        </View>
        <View style={styles.dailySummaryGrid}>
          {items.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => onPress(item.id)} activeOpacity={0.85} style={styles.dailySummaryItem}>
              <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dailySummaryGradient}>
                <Ionicons name={item.icon as any} size={20} color="#fff" style={{ opacity: 0.9 }} />
                <Text style={styles.dailySummaryValue}>{item.value}</Text>
                <Text style={styles.dailySummaryLabel}>{item.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );
});
(DailySummaryWidget as any).displayName = 'DailySummaryWidget';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 2: SMART CONTEXT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartContextCard: React.FC<{
  isDark: boolean;
  theme: any;
  currentBaby: any;
  onPress: () => void;
}> = React.memo(({ isDark, theme, currentBaby, onPress }) => {
  const hour = new Date().getHours();

  const context = useMemo(() => {
    let icon = 'sunny-outline';
    let title = 'Perfect Day for a Walk';
    let message = 'Great weather for outdoor tummy time';
    let color = '#f59e0b';
    let bgGradient = ['#fef3c7', '#fde68a'] as [string, string];
    let actionLabel = 'Start Walk Tracker';

    if (hour >= 5 && hour < 9) {
      icon = 'partly-sunny-outline'; title = 'Good Morning!'; message = 'Time for the first feed and morning routine'; color = '#f59e0b'; bgGradient = ['#fef3c7', '#fde68a']; actionLabel = 'Log Morning Feed';
    } else if (hour >= 9 && hour < 12) {
      icon = 'sunny-outline'; title = 'Mid-Morning Activity'; message = 'Ideal time for play and developmental activities'; color = '#10b981'; bgGradient = ['#d1fae5', '#a7f3d0']; actionLabel = 'Log Play Time';
    } else if (hour >= 12 && hour < 15) {
      icon = 'restaurant-outline'; title = 'Lunch Time'; message = "Don't forget to log the midday feed"; color = '#fa709a'; bgGradient = ['#fce7f3', '#fbcfe8']; actionLabel = 'Log Feed';
    } else if (hour >= 15 && hour < 18) {
      icon = 'walk-outline'; title = 'Afternoon Stroll'; message = 'Fresh air helps with nap time later'; color = '#3b82f6'; bgGradient = ['#dbeafe', '#bfdbfe']; actionLabel = 'Start Walk';
    } else if (hour >= 18 && hour < 21) {
      icon = 'moon-outline'; title = 'Wind Down Time'; message = 'Start the bedtime routine for better sleep'; color = '#6366f1'; bgGradient = ['#e0e7ff', '#c7d2fe']; actionLabel = 'Start Sleep Timer';
    } else {
      icon = 'moon-outline'; title = 'Night Mode'; message = 'Quiet time - check if baby needs anything'; color = '#4c1d95'; bgGradient = ['#ede9fe', '#ddd6fe']; actionLabel = 'Log Night Feed';
    }
    return { icon, title, message, color, bgGradient, actionLabel };
  }, [hour]);

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.7)', 'rgba(35,35,50,0.5)'] : context.bgGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.contextCard, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : `${context.color}25` }]}
        >
          <View style={styles.contextLeft}>
            <View style={[styles.contextIconBg, { backgroundColor: `${context.color}18` }]}>
              <Ionicons name={context.icon as any} size={22} color={context.color} />
            </View>
            <View style={styles.contextText}>
              <Text style={[styles.contextTitle, { color: theme.text }]}>{context.title}</Text>
              <Text style={[styles.contextMessage, { color: theme.textSecondary }]} numberOfLines={1}>{context.message}</Text>
            </View>
          </View>
          <View style={[styles.contextActionBadge, { backgroundColor: `${context.color}12` }]}>
            <Text style={[styles.contextActionText, { color: context.color }]}>{context.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={12} color={context.color} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});
(SmartContextCard as any).displayName = 'SmartContextCard';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 3: NEXT BEST ACTION
   ═══════════════════════════════════════════════════════════════════════════ */

const NextBestAction: React.FC<{
  isDark: boolean;
  theme: any;
  currentBaby: any;
  lastActivities: any[];
  onAction: (screen: string, params?: any) => void;
}> = React.memo(({ isDark, theme, currentBaby, lastActivities, onAction }) => {
  const suggestion = useMemo(() => {
    if (!currentBaby) return null;
    const now = new Date();
    const lastFeed = lastActivities.find((a: any) => a.type === 'feed' || a.trackerId === 'feed');
    const lastSleep = lastActivities.find((a: any) => a.type === 'sleep' || a.trackerId === 'sleep');
    const lastDiaper = lastActivities.find((a: any) => a.type === 'diaper' || a.trackerId === 'diaper');

    const hoursSinceFeed = lastFeed ? differenceInHours(now, new Date(lastFeed.timestamp)) : 999;
    const hoursSinceSleep = lastSleep ? differenceInHours(now, new Date(lastSleep.timestamp)) : 999;
    const hoursSinceDiaper = lastDiaper ? differenceInHours(now, new Date(lastDiaper.timestamp)) : 999;

    if (hoursSinceFeed >= 3) return { id: 'feed-now', title: 'Time to Feed', subtitle: `Last feed was ${hoursSinceFeed}h ago`, icon: 'nutrition-outline', gradient: ['#fa709a', '#fee140'] as [string, string], trackerId: 'feed', urgency: 'high' as const };
    if (hoursSinceDiaper >= 3) return { id: 'diaper-now', title: 'Check Diaper', subtitle: `Last change was ${hoursSinceDiaper}h ago`, icon: 'shirt-outline', gradient: ['#667eea', '#764ba2'] as [string, string], trackerId: 'diaper', urgency: 'normal' as const };
    if (hoursSinceSleep >= 4) return { id: 'sleep-now', title: 'Sleep Window Opening', subtitle: `Awake for ${hoursSinceSleep}h — watch for cues`, icon: 'moon-outline', gradient: ['#11998e', '#38ef7d'] as [string, string], trackerId: 'sleep', urgency: 'normal' as const };
    return { id: 'all-good', title: 'All Caught Up!', subtitle: 'Everything looks good. Enjoy the moment', icon: 'checkmark-circle-outline', gradient: ['#10b981', '#34d399'] as [string, string], trackerId: 'note', urgency: 'low' as const };
  }, [currentBaby, lastActivities]);

  if (!suggestion) return null;

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <TouchableOpacity onPress={() => onAction('AddEntry', { trackerId: suggestion.trackerId })} activeOpacity={0.9} style={styles.nextActionContainer}>
        <LinearGradient colors={suggestion.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextActionGradient}>
          <View style={styles.nextActionContent}>
            <View style={styles.nextActionIconWrap}>
              <Ionicons name={suggestion.icon as any} size={24} color="#fff" />
            </View>
            <View style={styles.nextActionText}>
              <Text style={styles.nextActionTitle}>{suggestion.title}</Text>
              <Text style={styles.nextActionSubtitle}>{suggestion.subtitle}</Text>
            </View>
            <View style={styles.nextActionArrow}>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
            </View>
          </View>
          {suggestion.urgency === 'high' && (
            <View style={styles.nextActionUrgency}>
              <View style={styles.urgencyPill}>
                <View style={[styles.urgencyDot, { backgroundColor: '#fff' }]} />
                <Text style={styles.urgencyText}>Now</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});
(NextBestAction as any).displayName = 'NextBestAction';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 4: WEEKLY PATTERN INSIGHT
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyPatternInsight: React.FC<{
  isDark: boolean;
  theme: any;
  activities: any[];
}> = React.memo(({ isDark, theme, activities }) => {
  const patterns = useMemo(() => {
    const last7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    const data = last7Days.map(day => {
      const dayActivities = activities.filter((a: any) => a?.timestamp && isSameDay(new Date(a.timestamp), day));
      return { day: format(day, 'EEE'), feeds: dayActivities.filter((a: any) => a.type === 'feed' || a.trackerId === 'feed').length, total: dayActivities.length };
    });
    const maxTotal = Math.max(...data.map(d => d.total), 1);
    return { data, maxTotal };
  }, [activities]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <View style={[styles.patternContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)', borderColor: theme.border }]}>
        <View style={styles.patternHeader}>
          <View style={styles.patternTitleRow}>
            <View style={[styles.patternIconWrap, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="analytics-outline" size={16} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.patternTitle, { color: theme.text }]}>Weekly Pattern</Text>
              <Text style={[styles.patternSubtitle, { color: theme.textMuted }]}>Activity over last 7 days</Text>
            </View>
          </View>
        </View>
        <View style={styles.patternBars}>
          {patterns.data.map((day, i) => {
            const barHeight = (day.total / patterns.maxTotal) * 100;
            const isToday = i === 6;
            return (
              <View key={day.day} style={styles.patternDay}>
                <View style={styles.patternBarContainer}>
                  <View style={[styles.patternBar, { height: `${Math.max(barHeight, 8)}%`, backgroundColor: isToday ? theme.primary : `${theme.primary}35` }]} />
                </View>
                <Text style={[styles.patternDayLabel, { color: isToday ? theme.primary : theme.textMuted, fontWeight: isToday ? '700' : '500' }]}>{day.day}</Text>
                {day.total > 0 && <Text style={[styles.patternDayCount, { color: theme.textSecondary }]}>{day.total}</Text>}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
});
(WeeklyPatternInsight as any).displayName = 'WeeklyPatternInsight';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 5: CATEGORIZED QUICK ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_TABS = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'daily', label: 'Daily', icon: 'sunny-outline' },
  { key: 'health', label: 'Health', icon: 'medical-outline' },
  { key: 'family', label: 'Family', icon: 'heart-outline' },
  { key: 'tools', label: 'Tools', icon: 'construct-outline' },
] as const;

type CategoryKey = typeof CATEGORY_TABS[number]['key'];

const CategorizedQuickActions: React.FC<{
  actions: QuickAction[];
  onPress: (action: QuickAction) => void;
  isDark: boolean;
  theme: any;
}> = React.memo(({ actions, onPress, isDark, theme }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const filteredActions = useMemo(() => {
    if (activeCategory === 'all') return actions;
    return actions.filter(a => a.category === activeCategory);
  }, [actions, activeCategory]);

  const columns = 4;
  const gap = 10;
  const margin = 20;
  const itemWidth = (SCREEN_W - margin * 2 - (columns - 1) * gap) / columns;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsScroll}>
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.key;
          const count = tab.key === 'all' ? actions.length : actions.filter(a => a.category === tab.key).length;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => { setActiveCategory(tab.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[
                styles.categoryTab,
                isActive && { backgroundColor: DS.primary },
                !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
              ]}
            >
              <Ionicons name={tab.icon as any} size={13} color={isActive ? '#fff' : theme.textSecondary} />
              <Text style={[styles.categoryTabText, { color: isActive ? '#fff' : theme.textSecondary }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
              <View style={[styles.categoryTabBadge, isActive ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.categoryTabBadgeText, { color: isActive ? '#fff' : theme.textMuted }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.categorizedGrid, { gap, paddingHorizontal: margin }]}>
        {filteredActions.map((action, index) => (
          <Animated.View key={action.id} entering={FadeInUp.delay(index * 30).springify()} style={[styles.categorizedGridItem, { width: itemWidth }]}>
            <TouchableOpacity onPress={() => onPress(action)} activeOpacity={1} style={styles.categorizedGridTouchable}>
              <View style={{ width: '100%', aspectRatio: 1, position: 'relative' }}>
                <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.categorizedGridGradient, { width: '100%', height: '100%' }]}>
                  <Ionicons name={action.iconName as any} size={22} color="#fff" />
                </LinearGradient>
                {action.badgeCount !== undefined && action.badgeCount > 0 && (
                  <View style={[styles.actionBadge, { borderColor: action.color }]}>
                    <Text style={[styles.actionBadgeText, { color: action.color }]}>{action.badgeCount}</Text>
                  </View>
                )}
                {action.badgeLabel && (
                  <View style={styles.actionBadgeLabel}>
                    <Text style={styles.actionBadgeLabelText}>{action.badgeLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.categorizedGridLabel, { color: theme.text }]}>{action.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
});
(CategorizedQuickActions as any).displayName = 'CategorizedQuickActions';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 6: VACCINATION REMINDERS
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccinationReminders: React.FC<{
  reminders: VaccinationReminder[];
  isDark: boolean;
  theme: any;
  onPress: () => void;
}> = React.memo(({ reminders, isDark, theme, onPress }) => {
  const activeReminders = reminders.filter(r => r.status !== 'completed').slice(0, 3);
  if (activeReminders.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <View style={[styles.vaccineContainer, { borderColor: theme.border }]}>
        <View style={styles.vaccineHeader}>
          <View style={styles.vaccineTitleRow}>
            <View style={[styles.vaccineIconWrap, { backgroundColor: '#e11d4815' }]}>
              <Ionicons name="medical-outline" size={20} color="#e11d48" />
            </View>
            <View>
              <Text style={[styles.vaccineTitle, { color: theme.text }]}>Vaccination Schedule</Text>
              <Text style={[styles.vaccineSubtitle, { color: theme.textMuted }]}>{activeReminders.length} upcoming</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onPress} style={[styles.vaccineSeeAll, { backgroundColor: `${theme.primary}10` }]}>
            <Text style={[styles.vaccineSeeAllText, { color: theme.primary }]}>View All</Text>
            <Ionicons name="chevron-forward" size={12} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.vaccineList}>
          {activeReminders.map((reminder, i) => {
            const isOverdue = reminder.status === 'overdue';
            const daysUntil = differenceInDays(reminder.dueDate, new Date());
            return (
              <View key={reminder.id} style={[styles.vaccineRow, i < activeReminders.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.vaccineDot, { backgroundColor: isOverdue ? '#ef4444' : '#f59e0b' }]} />
                <View style={styles.vaccineInfo}>
                  <Text style={[styles.vaccineName, { color: theme.text }]} numberOfLines={1}>{reminder.vaccineName}</Text>
                  <Text style={[styles.vaccineDose, { color: theme.textMuted }]}>Dose {reminder.doseNumber}</Text>
                </View>
                <View style={[styles.vaccineBadge, { backgroundColor: isOverdue ? '#ef444415' : '#f59e0b15' }]}>
                  <Text style={[styles.vaccineBadgeText, { color: isOverdue ? '#ef4444' : '#f59e0b' }]}>
                    {isOverdue ? 'Overdue' : daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
});
(VaccinationReminders as any).displayName = 'VaccinationReminders';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 7: AI INSIGHTS CARD
   ═══════════════════════════════════════════════════════════════════════════ */

const AIInsightsCard: React.FC<{
  isDark: boolean;
  theme: any;
  currentBaby: any;
  activities: any[];
  onPress: () => void;
}> = React.memo(({ isDark, theme, currentBaby, activities, onPress }) => {
  const insights = useMemo(() => {
    if (!currentBaby) return [];
    const ageMonths = currentBaby.birthDate ? differenceInMonths(new Date(), new Date(currentBaby.birthDate)) : 0;
    const todayCount = activities.filter((a: any) => a?.timestamp && isSameDay(new Date(a.timestamp), new Date())).length;
    const avgDaily = activities.length > 0 ? Math.round(activities.length / 7) : 0;
    const items: any[] = [];

    if (todayCount > avgDaily * 1.5) {
      items.push({ id: 'active-day', icon: 'flame-outline', color: '#f59e0b', title: 'Super Active Day', message: `${todayCount} activities logged today — above average!` });
    }
    if (ageMonths < 3) {
      items.push({ id: 'newborn-tip', icon: 'bulb-outline', color: '#3b82f6', title: 'Newborn Tip', message: 'Feed every 2-3 hours. Watch for hunger cues like rooting.' });
    } else if (ageMonths >= 6 && ageMonths < 9) {
      items.push({ id: 'solids-tip', icon: 'restaurant-outline', color: '#10b981', title: 'Starting Solids?', message: 'Introduce single-ingredient purees. Watch for allergies.' });
    }
    const sleepCount = activities.filter((a: any) => (a.type === 'sleep' || a.trackerId === 'sleep') && a?.timestamp && isSameDay(new Date(a.timestamp), new Date())).length;
    if (sleepCount === 0 && new Date().getHours() > 14) {
      items.push({ id: 'nap-reminder', icon: 'moon-outline', color: '#6366f1', title: 'Nap Check', message: 'No naps logged today. Most babies need 2-3 naps.' });
    }
    return items.slice(0, 2);
  }, [currentBaby, activities]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(140).springify()}>
      <View style={[styles.aiInsightsContainer, { borderColor: theme.border }]}>
        <View style={styles.aiInsightsHeader}>
          <View style={styles.aiInsightsTitleRow}>
            <View style={[styles.aiInsightsIconWrap, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="sparkles" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.aiInsightsTitle, { color: theme.text }]}>AI Insights</Text>
          </View>
          <TouchableOpacity onPress={onPress}>
            <Text style={[styles.aiInsightsSeeAll, { color: theme.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>
        {insights.map((insight) => (
          <View key={insight.id} style={[styles.aiInsightRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={[styles.aiInsightIconBg, { backgroundColor: `${insight.color}12` }]}>
              <Ionicons name={insight.icon as any} size={18} color={insight.color} />
            </View>
            <View style={styles.aiInsightContent}>
              <Text style={[styles.aiInsightTitle, { color: theme.text }]}>{insight.title}</Text>
              <Text style={[styles.aiInsightMessage, { color: theme.textSecondary }]} numberOfLines={2}>{insight.message}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});
(AIInsightsCard as any).displayName = 'AIInsightsCard';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 8: SMART NOTIFICATIONS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartNotificationPanel: React.FC<{
  notifications: SmartNotification[];
  onDismiss: (id: string) => void;
  onAction: (notif: SmartNotification) => void;
  isDark: boolean;
  theme: any;
}> = React.memo(({ notifications, onDismiss, onAction, isDark, theme }) => {
  const [expanded, setExpanded] = useState(false);
  const urgentCount = notifications.filter(n => n.priority === 'urgent' && !n.dismissed).length;
  if (notifications.length === 0) return null;

  const visibleNotifs = expanded ? notifications.filter(n => !n.dismissed) : notifications.filter(n => !n.dismissed).slice(0, 2);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'alert-circle';
      case 'high': return 'warning';
      case 'normal': return 'information-circle';
      default: return 'time';
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <View style={styles.notificationPanel}>
        <View style={styles.notificationPanelHeader}>
          <View style={styles.notificationPanelTitleRow}>
            <View style={[styles.notificationPanelIconWrap, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.notificationPanelTitle, { color: theme.text }]}>Smart Alerts</Text>
            {urgentCount > 0 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>{urgentCount}</Text>
              </View>
            )}
          </View>
          {notifications.filter(n => !n.dismissed).length > 2 && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
              <Text style={[styles.expandText, { color: theme.primary }]}>
                {expanded ? 'Show Less' : `+${notifications.filter(n => !n.dismissed).length - 2}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {visibleNotifs.map((notif, index) => (
          <Animated.View key={notif.id} entering={FadeInUp.delay(index * 40)}>
            <TouchableOpacity
              style={[styles.smartNotificationCard, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                borderLeftColor: notif.iconColor,
                borderColor: theme.border,
              }]}
              onPress={() => onAction(notif)}
              activeOpacity={0.8}
            >
              <View style={[styles.smartNotifIcon, { backgroundColor: `${notif.iconColor}12` }]}>
                <Ionicons name={getPriorityIcon(notif.priority) as any} size={16} color={notif.iconColor} />
              </View>
              <View style={styles.smartNotifContent}>
                <Text style={[styles.smartNotifTitle, { color: theme.text }]} numberOfLines={1}>{notif.title}</Text>
                <Text style={[styles.smartNotifMessage, { color: theme.textSecondary }]} numberOfLines={1}>{notif.message}</Text>
                <View style={styles.smartNotifMeta}>
                  <Text style={[styles.smartNotifTime, { color: theme.textMuted }]}>{formatDistanceToNow(notif.timestamp, { addSuffix: true })}</Text>
                  {notif.actionLabel && (
                    <View style={[styles.smartNotifActionBadge, { backgroundColor: `${notif.iconColor}10` }]}>
                      <Text style={[styles.smartNotifActionText, { color: notif.iconColor }]}>{notif.actionLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.dismissBtn} onPress={() => onDismiss(notif.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-outline" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
});
(SmartNotificationPanel as any).displayName = 'SmartNotificationPanel';

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE CARDS ROW
   ═══════════════════════════════════════════════════════════════════════════ */

const FeatureCardsRow: React.FC<{
  items: FeatureCard[];
  onPress: (item: FeatureCard) => void;
  isDark: boolean;
  theme: any;
}> = React.memo(({ items, onPress, isDark, theme }) => {
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureCardsScroll} decelerationRate="fast">
        {items.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => onPress(item)} activeOpacity={0.85} style={styles.featureCardTouchable}>
            <View style={[styles.featureCard, {
              borderColor: `${item.color}20`,
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff',
            }]}>
              <View style={styles.featureCardTop}>
                <View style={[styles.featureCardIcon, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={20} color="#fff" />
                </View>
                {item.badge && (
                  <View style={[styles.featureCardBadge, { backgroundColor: item.badgeColor || item.color }]}>
                    <Text style={styles.featureCardBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.featureCardLabel, { color: theme.text }]} numberOfLines={1}>{item.label}</Text>
              <Text style={[styles.featureCardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
              <View style={styles.featureCardArrow}>
                <Text style={[styles.featureCardArrowText, { color: item.color }]}>Open</Text>
                <Ionicons name="arrow-forward" size={12} color={item.color} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
(FeatureCardsRow as any).displayName = 'FeatureCardsRow';

/* ═══════════════════════════════════════════════════════════════════════════
   RECENT ACTIVITY TIMELINE
   ═══════════════════════════════════════════════════════════════════════════ */

interface DayGroup {
  title: string;
  date: Date;
  events: any[];
}

const RecentTimeline: React.FC<{
  activities: any[];
  isDark: boolean;
  theme: any;
  onViewAll: () => void;
  onEntryPress: (entry: any) => void;
  borderRadius: number;
  members?: any[];
  /** Fires when the logger's avatar is tapped. */
  onAvatarPress?: (targetId: string, member: any) => void;
}> = React.memo(({ activities, isDark, theme, onViewAll, onEntryPress, borderRadius, members = [], onAvatarPress }) => {
  const groups: DayGroup[] = useMemo(() => {
    const sorted = [...(activities || [])]
      .filter((e: any) => e?.timestamp)
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 12);

    const result: DayGroup[] = [];
    let current: DayGroup | null = null;
    sorted.forEach((event: any) => {
      const eventDate = new Date(event.timestamp);
      if (!current || !isSameDay(current.date, eventDate)) {
        current = { title: getDateTitle(event.timestamp), date: eventDate, events: [] };
        result.push(current);
      }
      (current as DayGroup).events.push(event);
    });
    return result;
  }, [activities]);

  if (groups.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
          <Ionicons name="time-outline" size={40} color={theme.textMuted} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No activity yet</Text>
        <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>
          Your logged entries will appear here, just like on the Timeline.
        </Text>
        <TouchableOpacity
          style={[styles.logFirstBtn, { backgroundColor: theme.primary, borderRadius }]}
          onPress={onViewAll}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.logFirstBtnText}>Log First Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {groups.map((group, groupIndex) => (
        <View key={`${group.title}-${groupIndex}`} style={styles.daySection}>
          <Animated.View entering={FadeInUp.delay(groupIndex * 80).springify()}>
            <View style={styles.dateHeaderContainer}>
              <Text style={[styles.dateHeader, { color: theme.text }]}>{group.title}</Text>
              <View style={[styles.dateBadge, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={[styles.dateBadgeText, { color: theme.primary }]}>{group.events.length}</Text>
              </View>
            </View>

            <View>
              {group.events.map((event: any, eventIndex: number) => {
                const cfg = getTrackerCfg(event?.trackerId || event?.type);
                const isLast = eventIndex === group.events.length - 1;
                const time = event?.timestamp ? format(event.timestamp, 'h:mm a') : '';
                const fullDate = event?.timestamp ? format(event.timestamp, 'MMM d, h:mm a') : '';
                const title = event?.title || event?.name || cfg.label;

                return (
                  <Animated.View
                    key={event?.id || `evt-${groupIndex}-${eventIndex}`}
                    entering={FadeInUp.delay(groupIndex * 80 + eventIndex * 50).springify()}
                  >
                    <View style={styles.eventRow}>
                      <View style={styles.timeColumn}>
                        <Text style={[styles.timeText, { color: cfg.color }]}>{time}</Text>
                        {!isLast && <View style={[styles.timelineLine, { backgroundColor: `${cfg.color}30` }]} />}
                      </View>

                      <TouchableOpacity
                        style={styles.eventCardContainer}
                        onPress={() => onEntryPress(event)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.entryCard, { borderRadius, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                          <LinearGradient
                            colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          />
                          <View style={styles.entryCardContent}>
                            <View style={styles.entryCardHeader}>
                              {(() => {
                                const logger =
                                  members.find((m: any) => m.userId === event.loggedBy) ||
                                  members.find((m: any) => m.id === event.loggedBy);

                                // No matching family_member for this logger
                                // (deleted / never on this baby) → non-interactive emoji.
                                if (!logger) {
                                  return (
                                    <View style={[styles.entryIconBg, { backgroundColor: `${cfg.color}14` }]}>
                                      <Text style={styles.entryEmoji}>{cfg.emoji}</Text>
                                    </View>
                                  );
                                }

                                // Logger resolved → tappable avatar.
                                return (
                                  <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => {
                                      if (onAvatarPress) {
                                        onAvatarPress(resolveTargetId(logger), logger);
                                      }
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <View style={styles.entryIconBg}>
                                      <SafeAvatar
                                        avatar={logger.avatar}
                                        size={38}
                                        fallbackEmoji={cfg.emoji}
                                        fallbackColor={cfg.color}
                                      />
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()}
                              <View style={styles.entryInfo}>
                                <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>
                                  {title}
                                </Text>
                                <Text style={[styles.entryMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                  {fullDate}
                                  {(() => {
                                    // Resolve the CURRENT name + relationship for
                                    // the logger, so a rename or role change is
                                    // reflected on historical entries.
                                    const logger =
                                      members.find((m: any) => m.userId === event.loggedBy) ||
                                      members.find((m: any) => m.id === event.loggedBy);
                                    const displayName = logger?.fullName || event.loggedByName;
                                    const displayLabel = logger ? getMemberDisplayLabel({ role: logger.role, relationship: logger.relationship }) : '';
                                    if (!displayName) return '';
                                    return displayLabel
                                      ? ` • ${displayName} (${displayLabel})`
                                      : ` • ${displayName}`;
                                  })()}
                                </Text>
                              </View>
                              <View style={[styles.entryTypeBadge, { backgroundColor: `${cfg.color}12` }]}>
                                <Text style={[styles.entryTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                              </View>
                            </View>
                            {(event?.details || event?.notes) ? (
                              <Text style={[styles.entryNotes, { color: theme.textSecondary }]} numberOfLines={2}>
                                {event?.details || event?.notes}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ))}

      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll} activeOpacity={0.7}>
        <Text style={[styles.viewAllText, { color: theme.primary }]}>View Full Timeline</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
});
(RecentTimeline as any).displayName = 'RecentTimeline';

/* ═══════════════════════════════════════════════════════════════════════════
   SOUND MIXER SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const SoundMixerSection: React.FC<{ onPress: () => void; isDark: boolean; theme: any }> =
  React.memo(({ onPress, isDark, theme }) => {
    const audioContext = useAudio();
    const playTrack = audioContext?.playTrack;
    const currentTrack = audioContext?.currentTrack;
    const isPlaying = audioContext?.isPlaying ?? false;
    const togglePlayback = audioContext?.togglePlayback;

    const handlePlayTrack = (track: typeof SOUND_TRACKS[0]) => {
      if (!playTrack) return;
      if (currentTrack?.id === track.id && togglePlayback) togglePlayback();
      else playTrack(track);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <View style={[styles.soundMixerContainer, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff' }]}>
          <View style={styles.soundMixerHeader}>
            <View style={styles.soundMixerTitle}>
              <View style={[styles.soundMixerIconBg, { backgroundColor: '#1DB95418' }]}>
                <Ionicons name="musical-notes-outline" size={18} color="#1DB954" />
              </View>
              <View>
                <Text style={[styles.soundMixerTitleText, { color: theme.text }]}>Sound Mixer</Text>
                <Text style={[styles.soundMixerSubtitle, { color: theme.textMuted }]}>
                  {audioContext && currentTrack && isPlaying ? `Playing: ${currentTrack.title}` : 'Tap to play soothing sounds'}
                </Text>
              </View>
            </View>
            {audioContext && (
              <TouchableOpacity
                style={[styles.playAllButton, isPlaying && styles.playAllButtonActive]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!currentTrack && playTrack) playTrack(SOUND_TRACKS[0]);
                  else if (togglePlayback) togglePlayback();
                }}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={SOUND_TRACKS.slice(0, 4)}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingRight: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.trackCard}
                onPress={(e) => { e.stopPropagation(); handlePlayTrack(item); }}
              >
                <View style={[styles.trackImage, { backgroundColor: isDark ? '#1e1e3f' : '#e2e8f0' }]}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.trackOverlay}>
                    <View style={[styles.trackPlayButton, currentTrack?.id === item.id && isPlaying && styles.trackPlayButtonActive]}>
                      <Ionicons name={currentTrack?.id === item.id && isPlaying ? 'pause' : 'play'} size={12} color="#fff" />
                    </View>
                  </LinearGradient>
                  {currentTrack?.id === item.id && isPlaying && (
                    <View style={styles.playingIndicator}>
                      <View style={[styles.bar, { backgroundColor: '#fff' }]} />
                      <View style={[styles.bar, styles.barMiddle, { backgroundColor: '#fff' }]} />
                      <View style={[styles.bar, { backgroundColor: '#fff' }]} />
                    </View>
                  )}
                </View>
                <Text style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.trackArtist, { color: theme.textMuted }]}>{item.artist}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    );
  });

/* ═══════════════════════════════════════════════════════════════════════════
   GROWTH SNAPSHOT KPIs
   ═══════════════════════════════════════════════════════════════════════════ */

const GrowthSnapshot: React.FC<{
  isDark: boolean;
  theme: any;
  growthStats: Record<string, any> | null;
  onPress: () => void;
}> = React.memo(({ isDark, theme, growthStats, onPress }) => {
  if (!growthStats) return null;

  const metrics = [
    { key: 'height', title: 'Height', icon: '📏', color: '#6366f1', unit: 'cm' },
    { key: 'weight', title: 'Weight', icon: '⚖️', color: '#ec4899', unit: 'kg' },
    { key: 'head', title: 'Head', icon: '🧠', color: '#06b6d4', unit: 'cm' },
    { key: 'bmi', title: 'BMI', icon: '📊', color: '#f59e0b', unit: '' },
  ];

  return (
    <View style={styles.kpiGrid}>
      {metrics.map((m) => {
        const s = growthStats[m.key];
        if (!s) return null;
        const changeNum = s.change ? parseFloat(s.change) : 0;
        return (
          <TouchableOpacity
            key={m.key}
            onPress={onPress}
            activeOpacity={0.85}
            style={[styles.kpiHomeCard, {
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
              borderColor: m.color + '20',
            }]}
          >
            <View style={[styles.kpiHomeIconBg, { backgroundColor: m.color + '12' }]}>
              <Text style={{ fontSize: 20 }}>{m.icon}</Text>
            </View>
            <View style={styles.kpiHomeBody}>
              <Text style={[styles.kpiHomeValue, { color: theme.text }]} numberOfLines={1}>{s.value}</Text>
              <Text style={[styles.kpiHomeUnit, { color: m.color }]}>{m.unit || '—'}</Text>
            </View>
            <Text style={[styles.kpiHomeTitle, { color: theme.textSecondary }]}>{m.title}</Text>
            {s.change !== undefined && (
              <View style={styles.kpiHomeChangeRow}>
                <Ionicons name={changeNum >= 0 ? 'trending-up' : 'trending-down'} size={10} color={changeNum >= 0 ? '#10b981' : '#ef4444'} />
                <Text style={[styles.kpiHomeChange, { color: changeNum >= 0 ? '#10b981' : '#ef4444' }]}>
                  {changeNum > 0 ? '+' : ''}{s.change}{m.unit}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
(GrowthSnapshot as any).displayName = 'GrowthSnapshot';

/* ═══════════════════════════════════════════════════════════════════════════
   STICKY APP HEADER — Matches Community Screen
   ═══════════════════════════════════════════════════════════════════════════ */

interface StickyAppHeaderProps {
  isDark: boolean;
  currentBaby: any;
  userProfile: any;
  onNotificationPress: () => void;
  onLockPress: () => void;
  onBabyPress: () => void;
  onAddBabyPress: () => void;
  unreadCount: number;
  /** Left breadcrumb pill tap → opens MoreScreen (the app "menu"). */
  onMenuPress: () => void;
  /** Shield tap → opens SafetyCorner. Emergency-access feature: must
   *  always be one tap from the primary screen. */
  onSafetyCornerPress: () => void;
  primaryColor: string;
  fullTheme: any;
  fontSizeMultiplier: number;
  compactSpacing: boolean;
}

const StickyAppHeader: React.FC<StickyAppHeaderProps> = React.memo(({
  isDark,
  currentBaby,
  userProfile,
  onNotificationPress,
  onLockPress,
  onBabyPress,
  onAddBabyPress,
  unreadCount,
  onMenuPress,
  onSafetyCornerPress,
  primaryColor,
  fullTheme,
  fontSizeMultiplier,
  compactSpacing,
}) => {
  const insets = useSafeAreaInsets();
  // Respect punch-hole, waterfall, notch, and dynamic island.
  // insets.top is 0 on devices without a cutout, so this is safe everywhere.
  const baseTop = Platform.OS === 'ios' ? (compactSpacing ? 8 : 12) : (compactSpacing ? 8 : 12);
  const headerPaddingTop = insets.top + baseTop;
  const headerPaddingBottom = compactSpacing ? 8 : 12;

  const headerBg = isDark ? (fullTheme?.glassBg || 'rgba(26,26,42,0.96)') : (fullTheme?.glassBg || 'rgba(255,255,255,0.96)');
  const borderColor = isDark ? (fullTheme?.border || 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.04)';

  return (
    <Animated.View
      style={[
        styles.stickyHeaderContainer,
        {
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
          backgroundColor: headerBg,
          borderBottomColor: borderColor,
          borderBottomWidth: 1,
        },
      ]}
    >
      <BlurView intensity={isDark ? 90 : 95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />

      <View style={styles.stickyHeaderContent}>
        {/* Left: "Settings" pill — opens MoreScreen (which IS the
            app's settings hub). Gear glyph + explicit "Settings"
            label so the destination is self-documenting — no
            ambiguity with the "Home" tab. */}
        <TouchableOpacity
          style={styles.stickyHeaderLeft}
          onPress={onMenuPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.headerBreadcrumbPill,
              {
                backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10`,
                borderColor: isDark ? 'rgba(99,102,241,0.25)' : `${DS.primary}20`,
              },
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={Math.round(15 * fontSizeMultiplier)}
              color={isDark ? DS.primaryLight : DS.primary}
            />
            <Text
              style={[
                styles.headerBreadcrumbText,
                { color: isDark ? DS.primaryLight : DS.primary },
              ]}
              numberOfLines={1}
            >
              Settings
            </Text>
          </View>
        </TouchableOpacity>

        {/* Center: Logo + current-baby subtitle. Absolutely positioned
            so the asymmetric action row can't push it off-axis. */}
        <View style={styles.stickyHeaderCenter} pointerEvents="box-none">
          <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
            LITTLELOOM
          </GradientText>
          <Text
            style={[styles.headerSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}
            numberOfLines={1}
          >
            {currentBaby?.name || userProfile?.fullName || 'Welcome'}
          </Text>
        </View>

        {/* Right: 3 actions — bell · baby avatar · lock. Nothing else.
            Profile editing is the hero banner. Family is the hero
            banner. Settings is the ☰ on the left. Safety is in More. */}
        <View style={[styles.stickyHeaderRight, { gap: compactSpacing ? 6 : 8 }]}>
          {/* Notifications */}
          <TouchableOpacity style={styles.headerIconBtn} onPress={onNotificationPress}>
            <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
              <Ionicons name="notifications-outline" size={18} color={isDark ? DS.primaryLight : DS.primary} />
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <LinearGradient colors={[DS.accent, DS.accentLight]} style={styles.headerBadgeGrad}>
                    <Text style={styles.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Safety Corner — one-tap emergency access. This is a
              mission-critical shortcut: a parent shouldn't have to
              tap More → Safety to reach first-aid info at 2 AM. */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onSafetyCornerPress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View
              style={[
                styles.headerIconInner,
                {
                  backgroundColor: isDark
                    ? 'rgba(220,38,38,0.18)'
                    : 'rgba(220,38,38,0.10)',
                },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={DS.danger} />
            </View>
          </TouchableOpacity>

          {/* Baby avatar / add baby */}
          {currentBaby ? (
            <TouchableOpacity style={styles.headerBabyBtn} onPress={onBabyPress}>
              <SafeBabyAvatar
                avatar={currentBaby.avatar || '👶'}
                gender={currentBaby.gender}
                size={Math.round(32 * fontSizeMultiplier)}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.headerIconBtn} onPress={onAddBabyPress}>
              <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                <Ionicons name="add-circle-outline" size={18} color={DS.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Lock */}
          <TouchableOpacity style={styles.headerLockBtn} onPress={onLockPress}>
            <LinearGradient
              colors={['#ff6b6b', '#ee5a5a']}
              style={[styles.headerLockGradient, {
                width: Math.round(34 * fontSizeMultiplier),
                height: Math.round(34 * fontSizeMultiplier),
                borderRadius: Math.round(17 * fontSizeMultiplier),
              }]}
            >
              <Ionicons name="lock-closed-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOMESCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const {
    settings,
    themeColors,
    fullThemeColors,
    darkMode,
    triggerHaptic,
    fontSizeMultiplier,
    borderRadiusValue,
    shouldReduceMotion,
  } = useCustomization();

  const isDark = darkMode ?? (colorScheme === 'dark');
  const primary = themeColors?.primary || DS.primary;
  const secondary = themeColors?.secondary || DS.accent;
  const accent = themeColors?.accent || DS.success;

  const theme = useMemo(() => ({
    text: isDark ? '#f0f0f7' : '#1a1a1a',
    textSecondary: isDark ? '#a0a0b0' : '#4b5563',
    textMuted: isDark ? '#888' : '#6b7280',
    background: isDark ? '#0a0a0a' : '#f8faff',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    ...((fullThemeColors && typeof fullThemeColors === 'object') ? fullThemeColors : {}),
    primary, secondary, accent,
  }), [fullThemeColors, primary, secondary, accent, isDark]);

  const scrollY = useSharedValue(0);

  // Auth & Contexts
  const { userProfile, isLoading: authLoading } = useAuth();
  const {
    babies,
    currentBaby,
    currentBabyId,
    switchBaby,
    loadBabies,
    getPottyStreak,
    growthData,
    milestones,
    getGrowthData,
  } = useBaby();

  // ── Family members (needed by RecentTimeline for attribution) ──
  // This is a REAL hook call, not a comment. It supplies `members`
  // to `<RecentTimeline members={members} />` and to
  // `todayContributors`, both of which broke with
  // `ReferenceError: Property 'members' doesn't exist` when this
  // line was accidentally left inside a JSDoc block.
  //
  // `loadFamily` is pulled in so HomeScreen can trigger the family
  // refresh itself — otherwise the co-parent / guardian row is only
  // ever loaded when the user opens FamilySharing / EditGuardian,
  // which is why the family strip appeared empty for the first
  // several seconds after launch.
  const { members, loadFamily } = useFamily();

  const {
    entries: trackerEntriesRaw,
    refreshEntries: refreshTrackerEntries,
    isLoading: activitiesLoading,
  } = useTracker();

// NOTE: `trackerEntries` memo has been moved BELOW the `displayedBaby`
// declaration (see further down). It cannot be defined here because
// `displayedBaby` is a `const` and is in the temporal dead zone until its
// declaration runs.

const loadActivities = refreshTrackerEntries;

  const { lockApp, getAvailableAuthMethods, getSecuritySnapshot, rehydratePinStatus } = useSecurity();
  const { getUnreadCount } = useCommunity();
  const { getUnreadCount: getFamilyChatUnread } = useFamilyChat();
  const { getSafetyScore, getSafetyLevel } = useSafety();
  const { notificationSettings, getNotificationHistory } = useApp();

  const { success, error, confirm, toast, alert: sweetAlert } = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ label: string; screen: keyof RootStackParamList; params?: Record<string, any> } | null>(null);
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);

  /* ── INSTANT RENDER: cached baby + activities ── */
  const [cachedBaby, setCachedBaby] = useState<any>(null);
  const [cachedActivities, setCachedActivities] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const cacheLoaded = useRef(false);
  const isInitialLoad = useRef(true);
  const dataLoaded = useRef(false);

// Track the userId we hydrated cache for. If it changes (sign-out → sign-in),
// we wipe the in-memory cache and reload scoped keys.
const cacheHydratedForUserRef = useRef<string | null>(null);

useEffect(() => {
  const userId = userProfile?.id ?? null;

  // Account changed or signed out — hard reset cached in-memory state.
  if (cacheHydratedForUserRef.current !== userId) {
    cacheHydratedForUserRef.current = userId;
    setCachedBaby(null);
    setCachedActivities([]);
    setSmartNotifications([]);
    cacheLoaded.current = false;
  }

  if (!userId) {
    // Signed out — nothing to load, and nothing to keep.
    setIsLoadingInitial(false);
    return;
  }

  let cancelled = false;
  (async () => {
    try {
      // Only load the BABY cache keyed by user (baby not yet known here).
      const babyKey = scopedCacheKey(CACHE_KEYS.BABY, userId);
      const babyJson = babyKey ? await AsyncStorage.getItem(babyKey) : null;

      // Activities cache is keyed by user + the cached baby's id, so that a
      // different baby's rows can NEVER leak into this user's session even
      // if they own multiple babies.
      let actJson: string | null = null;
      if (babyJson) {
        try {
          const cachedBabyObj = JSON.parse(babyJson);
          const actKey = scopedCacheKey(CACHE_KEYS.ACTIVITIES, userId, cachedBabyObj?.id ?? null);
          if (actKey) actJson = await AsyncStorage.getItem(actKey);
        } catch {}
      }

      if (cancelled) return;
      if (babyJson) {
        try { setCachedBaby(JSON.parse(babyJson)); } catch {}
      }
      if (actJson) {
        try {
          const parsed = JSON.parse(actJson);
          if (Array.isArray(parsed)) setCachedActivities(parsed);
        } catch {}
      }
    } catch {
      // ignore — fresh load will handle it
    } finally {
      if (!cancelled) {
        cacheLoaded.current = true;
        setIsLoadingInitial(false);
      }
    }
  })();

  return () => { cancelled = true; };
}, [userProfile?.id]);

  const displayedBaby = currentBaby || cachedBaby;
  const hasBaby = !!displayedBaby;

  // HARD BABY SCOPE — the tracker context can briefly hold the *previous*
  // baby's rows during a switch (setState → await loadEntries). We filter
  // here so nothing downstream (activityStats, dailySummary, streak,
  // todayCounts, RecentTimeline) can ever see rows from another baby.
  // (This memo lives here — not above — because `displayedBaby` must be
  // declared before this runs.)
  const trackerEntries = useMemo(() => {
    const currentId = displayedBaby?.id;
    if (!currentId) return [];
    const list = Array.isArray(trackerEntriesRaw) ? trackerEntriesRaw : [];
    return list.filter((e: any) => e?.babyId === currentId);
  }, [trackerEntriesRaw, displayedBaby?.id]);

  const getRecentTimelineEvents = useCallback(
    (_limit?: number, _babyId?: string) => trackerEntries,
    [trackerEntries],
  );

useEffect(() => {
  const userId = userProfile?.id;
  if (!userId || !currentBaby) return;

  const babyKey = scopedCacheKey(CACHE_KEYS.BABY, userId);
  if (babyKey) {
    AsyncStorage.setItem(babyKey, JSON.stringify(currentBaby)).catch(() => {});
  }
}, [currentBaby, userProfile?.id]);

// Whenever the active baby changes, drop any in-memory activities cache
// that belonged to the previous baby. This is the last line of defense
// against showing baby A's entries under baby B.
useEffect(() => {
  setCachedActivities([]);
}, [currentBaby?.id]);

// Smart notifications are scoped by userId so account-switch never inherits
// the previous account's dismissed + generated entries.
const smartNotifsHydratedForUserRef = useRef<string | null>(null);

useEffect(() => {
  const userId = userProfile?.id ?? null;

  if (smartNotifsHydratedForUserRef.current !== userId) {
    smartNotifsHydratedForUserRef.current = userId;
    setSmartNotifications([]);
  }

  if (!userId) return;

  let cancelled = false;
  (async () => {
    try {
      const key = `@littleloom_smart_notifications_${userId}`;
      const saved = await AsyncStorage.getItem(key);
      if (cancelled || !saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setSmartNotifications(parsed);
    } catch {}
  })();

  return () => { cancelled = true; };
}, [userProfile?.id]);

useEffect(() => {
  const userId = userProfile?.id;
  if (!userId) return;
  AsyncStorage.setItem(
    `@littleloom_smart_notifications_${userId}`,
    JSON.stringify(smartNotifications),
  ).catch(() => {});
}, [smartNotifications, userProfile?.id]);

  /* ── Generate smart notifications ── */
  useEffect(() => {
    if (!currentBaby) return;
    const now = Date.now();
    const birthDate = currentBaby.birthDate ? new Date(currentBaby.birthDate) : null;
    const ageInDays = birthDate ? Math.floor((now - birthDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const notifications: SmartNotification[] = [];

    if (ageInDays >= 60 && ageInDays <= 75) {
      notifications.push({
        id: 'vaccine-dtap-1', type: 'vaccine', priority: 'urgent',
        title: 'DTaP Vaccine Due',
        message: `First DTaP dose is due for ${currentBaby.name}. Schedule within the next 2 weeks.`,
        actionScreen: 'VaccinationSchedule', actionLabel: 'View Schedule',
        icon: 'medical', iconColor: '#e11d48', bgColor: '#e11d48', timestamp: now,
      });
    }
    if (ageInDays >= 180 && ageInDays <= 190) {
      notifications.push({
        id: 'growth-6mo', type: 'growth', priority: 'high',
        title: '6-Month Growth Check',
        message: `Time to log ${currentBaby.name}'s 6-month growth measurements.`,
        actionScreen: 'GrowthDashboard', actionLabel: 'Log Growth',
        icon: 'trending-up', iconColor: '#10b981', bgColor: '#10b981', timestamp: now,
      });
    }
    const pottyStreak = getPottyStreak();
    if (pottyStreak > 0 && pottyStreak % 7 === 0) {
      notifications.push({
        id: `streak-${pottyStreak}`, type: 'streak', priority: 'normal',
        title: `${pottyStreak} Day Streak!`,
        message: `Amazing! You've kept a ${pottyStreak}-day tracking streak going.`,
        icon: 'flame', iconColor: '#f59e0b', bgColor: '#f59e0b', timestamp: now,
      });
    }
    const tips = [
      { title: 'Hydration Tip', message: 'Remember to track water intake for better feeding insights.', icon: 'water', color: '#3b82f6' },
      { title: 'Sleep Insight', message: 'Consistent bedtime routines improve sleep quality by 40%.', icon: 'moon', color: '#8b5cf6' },
      { title: 'Tummy Time', message: 'Aim for 30+ minutes of tummy time today for motor development.', icon: 'fitness', color: '#10b981' },
    ];
    const todayTip = tips[Math.floor(now / (1000 * 60 * 60 * 24)) % tips.length];
    notifications.push({
      id: `tip-${Math.floor(now / (1000 * 60 * 60 * 24))}`, type: 'tip', priority: 'low',
      title: todayTip.title, message: todayTip.message,
      icon: todayTip.icon, iconColor: todayTip.color, bgColor: todayTip.color, timestamp: now,
    });

    setSmartNotifications(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newNotifs = notifications.filter(n => !existingIds.has(n.id));
      return [...prev.filter(p => !p.dismissed), ...newNotifs].slice(-10);
    });
  }, [currentBaby?.id, currentBaby?.birthDate, currentBaby?.name, getPottyStreak]);

  /* ── Greeting / clock ── */
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(timer); };
  }, []);

  /* ── Load data instantly on focus + mount ── */
  useFocusEffect(
    useCallback(() => {
      // Always refresh the family on focus — the co-parent /
      // guardian list is defined by `family_members` and can
      // change on another device at any moment. Without this,
      // `members` in `FamilyStack` stays stale until the user
      // happens to navigate into FamilySharing.
      if (typeof loadFamily === 'function') {
        loadFamily().catch(() => {});
      }
      if (isInitialLoad.current || !dataLoaded.current) {
        isInitialLoad.current = false;
        loadBabies();
        loadActivities();
        dataLoaded.current = true;
      }
      rehydratePinStatus().catch(() => {});
    }, [loadBabies, loadActivities, loadFamily, rehydratePinStatus])
  );

  useEffect(() => {
    loadBabies();
    loadActivities();
    // Fire-and-forget initial family load. This runs once on mount
    // so the co-parent / guardian row appears on first paint instead
    // of waiting for the first focus event.
    if (typeof loadFamily === 'function') {
      loadFamily().catch(() => {});
    }
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  /* ── Navigation ── */
  const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
    if (__DEV__) console.log('[HomeScreen] Navigating to:', screenName, params);

    const nav: any = navigationRef.current?.isReady()
      ? navigationRef.current
      : (navigation as any);

    const COMMUNITY_SCREENS = new Set([
      'CommunityMain', 'CommunityProfile', 'CommunityMemberProfile',
      'CommunityOnboarding', 'CommunityVerification', 'Topic', 'TopicMembers',
      'CreatePost', 'PostDetail', 'ChatList', 'Chat', 'Notifications',
      'Followers', 'Following', 'SearchUsers', 'BlockedUsers', 'Report',
    ]);

    if (COMMUNITY_SCREENS.has(screenName)) {
      try {
        nav.navigate('Main', {
          screen: 'Connect',
          params: { screen: screenName, params: params || {} },
        });
      } catch (e) {
        if (__DEV__) console.warn('[HomeScreen] Community navigation failed:', screenName, e);
      }
      return;
    }

    if (DIRECT_SCREENS.has(screenName)) {
      try {
        nav.navigate(screenName, params || {});
      } catch (e) {
        if (__DEV__) console.warn('[HomeScreen] Navigation failed:', screenName, e);
      }
      return;
    }
    const navConfig = NAVIGATION_MAP[screenName];
    if (!navConfig) {
      if (__DEV__) console.warn(`Navigation target "${screenName}" not found`);
      return;
    }
    try {
      nav.navigate(navConfig.screen, { ...navConfig.params, ...params });
    } catch (e) {
      if (__DEV__) console.warn('[HomeScreen] Navigation failed:', navConfig.screen, e);
    }
  }, [navigation]);

  /* ── Guarded navigation: requires baby ── */
  const requireBaby = useCallback((label: string, screen: keyof RootStackParamList, params?: Record<string, any>) => {
    if (!hasBaby) {
      setPendingAction({ label, screen, params });
      setShowBabyRequiredModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }
    return true;
  }, [hasBaby]);

  const handleNotificationPress = useCallback(() => {
    triggerHaptic('light');
    setShowNotificationChooser(true);
  }, [triggerHaptic]);

  const handleSafetyCornerPress = useCallback(() => {
    triggerHaptic('medium');
    navigateToScreen('SafetyCorner');
  }, [navigateToScreen, triggerHaptic]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadBabies(), loadActivities()]);
      success('Refreshed!', 'Your dashboard is up to date.');
    } catch (err) {
      error('Refresh Failed', 'Could not update dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadActivities, success, error]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    triggerHaptic('medium');

    if (action.id === 'milestone') {
      if (!requireBaby(action.label, 'AddEntry', { trackerId: 'milestone' })) return;
      navigateToScreen('AddEntry', { trackerId: 'milestone' });
      return;
    }
    if (action.id === 'growth') {
      if (!requireBaby(action.label, 'GrowthDashboard', action.params)) return;
      navigateToScreen('GrowthDashboard', action.params);
      return;
    }
    if (action.id === 'vaccine') {
      if (!requireBaby(action.label, 'VaccinationSchedule', action.params)) return;
      navigateToScreen('VaccinationSchedule', action.params);
      return;
    }
    if (action.id === 'settings') {
      navigateToScreen('More', action.params);
      return;
    }
    if (!requireBaby(action.label, action.screen, action.params)) return;
    navigateToScreen(action.screen, action.params);
  }, [requireBaby, navigateToScreen, triggerHaptic]);

  const handleFeaturePress = useCallback((item: FeatureCard) => {
    triggerHaptic('light');

    if (item.id === 'chat') {
      navigateToScreen('FamilyChatList');
      return;
    }

    const babyRequired = new Set(['growth', 'milestones', 'reminders', 'family', 'gallery', 'chat', 'vaccine', 'doctor_reports']);
    if (babyRequired.has(item.id) && !requireBaby(item.label, item.screen, item.params)) return;
    navigateToScreen(item.screen, item.params);
  }, [requireBaby, navigateToScreen, triggerHaptic]);

  const handleLockPress = useCallback(async () => {
    triggerHaptic('heavy');
    const snapshot = getSecuritySnapshot();
    if (!snapshot.hasAnySecurity) {
      setShowSecurityModal(true);
      return;
    }
    await lockApp();
    toast('App Locked', 'LittleLoom has been secured.', 'info');
    navigateToScreen('SecurityLock');
  }, [lockApp, getSecuritySnapshot, toast, triggerHaptic, navigateToScreen]);

  const handleSmartNotifDismiss = useCallback((id: string) => {
    setSmartNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const handleSmartNotifAction = useCallback((notif: SmartNotification) => {
    triggerHaptic('light');
    if (notif.actionScreen) navigateToScreen(notif.actionScreen as string, notif.actionParams);
  }, [navigateToScreen, triggerHaptic]);

  const handleDailySummaryPress = useCallback((type: string) => {
    const trackerMap: Record<string, string> = { feeds: 'feed', sleep: 'sleep', diapers: 'diaper', streak: 'potty' };
    const trackerId = trackerMap[type] || 'feed';
    if (!requireBaby('Daily Summary', 'AddEntry', { trackerId })) return;
    navigateToScreen('AddEntry', { trackerId });
  }, [requireBaby, navigateToScreen]);

  const handleContextPress = useCallback(() => {
    const hour = new Date().getHours();
    const trackerId = hour >= 5 && hour < 9 ? 'feed'
      : hour >= 9 && hour < 12 ? 'play'
      : hour >= 12 && hour < 15 ? 'feed'
      : hour >= 15 && hour < 18 ? 'walk'
      : hour >= 18 && hour < 21 ? 'sleep' : 'feed';
    if (!requireBaby('Smart Context', 'AddEntry', { trackerId })) return;
    navigateToScreen('AddEntry', { trackerId });
  }, [requireBaby, navigateToScreen]);

  const handleNextAction = useCallback((screen: string, params?: any) => {
    if (!requireBaby('Next Best Action', screen as keyof RootStackParamList, params)) return;
    navigateToScreen(screen, params);
  }, [requireBaby, navigateToScreen]);

  /* ── Entry press ── */
  const handleEntryPress = useCallback((entry: any) => {
    if (!hasBaby) {
      setPendingAction({ label: 'Activity Details', screen: 'Timeline', params: {} });
      setShowBabyRequiredModal(true);
      return;
    }
    if (entry?.id) {
      navigateToScreen('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId || entry.type });
    } else {
      navigateToScreen('Timeline', {});
    }
  }, [hasBaby, navigateToScreen]);
  // ── Family member avatar tap (from RecentTimeline) ──────────
  // This is the second path into the family-management flow — the
  // first is the "Family" tab inside FamilySharingScreen. But this
  // path can be tapped by ANY role (Parent 1, Parent 2, Guardian,
  // Viewer), so we need to route based on WHO is tapped vs. who I
  // am.
  //
  //   • Tapping myself              → EditGuardian (my own profile)
  //   • Tapping another Parent/     → EditGuardian (guarded: must be a parent)
  //     Guardian while I'm a parent
  //   • Tapping anyone else while   → FamilySharing (read-only view)
  //     I'm a guardian/viewer
  //
  // `getMemberNavTarget` centralises the rule so every call site
  // stays consistent.
  // Synthetic "member" row for the current baby so FamilyStack can
  // render the baby alongside real family members. `role: 'baby'` is
  // not a real UserRole — the avatar-tap handler below intercepts it
  // and routes to the baby profile editor instead of EditGuardian.
  const babyAsMember = useCallback((baby: any) => ({
    id: `baby_${baby.id}`,
    userId: `baby_${baby.id}`,
    babyId: baby.id,
    role: 'baby' as any,
    fullName: baby.name || 'Baby',
    email: '',
    avatar: baby.avatar,
    relationship: 'Baby',
    permissions: { read: true, write: false, delete: false, manageFamily: false, manageSecurity: false, exportData: false },
    joinedAt: baby.createdAt || new Date().toISOString(),
    isActive: true,
    __isBaby: true,
    __baby: baby,
  } as any), []);

  const handleMemberAvatarPress = useCallback(
    // Accepts EITHER:
    //   • (targetId: string, member?: object)  ← RecentTimeline avatar tap
    //   • (member: object)                     ← FamilyStack row tap
    // If only one argument is given and it's an object, treat it as the
    // member and derive targetId from it. This is why tapping a family
    // member card used to fall through to FamilySharing — the signature
    // mismatch left `targetId` as an object and `tappedMember` undefined,
    // so the resolver couldn't find the row.
    async (targetIdOrMember: any, maybeMember?: any) => {
      // ── NORMALIZE ARGUMENTS ─────────────────────────────────
      let tappedMember: any;
      let targetId: string;

      if (targetIdOrMember && typeof targetIdOrMember === 'object') {
        // Called as `onMemberPress(member)` — FamilyStack style.
        tappedMember = targetIdOrMember;
        targetId = String(
          tappedMember.userId || tappedMember.id || '',
        );
      } else {
        targetId = String(targetIdOrMember || '');
        tappedMember = maybeMember;
      }

      // ── BABY ROW ────────────────────────────────────────────
      // Synthetic baby row from the merged FamilyStack list →
      // open the baby profile editor.
      if (
        tappedMember?.__isBaby ||
        targetId.startsWith('baby_')
      ) {
        const baby = tappedMember?.__baby || displayedBaby;
        if (baby?.id) {
          triggerHaptic('light');
          navigateToScreen('EditProfile', { mode: 'baby', babyId: baby.id });
        } else {
          navigateToScreen('CreateBabyProfile');
        }
        return;
      }

      // ── RESOLVE THE MEMBER ROW ──────────────────────────────
      // Prefer the object we were handed; otherwise look it up by
      // userId OR family_members.id (callers vary).
      let member = tappedMember;
      if (!member) {
        member =
          members.find((m: any) => m.userId === targetId) ||
          members.find((m: any) => m.id === targetId);
      }
      if (!member) {
        // No matching family_members row — send the user to the
        // family view so they can see who's still around.
        navigateToScreen('FamilySharing', {});
        return;
      }

      // ── ALWAYS OPEN THAT PERSON'S PROFILE ───────────────────
      // Tapping a member card is an explicit "show me this person"
      // intent. Do NOT route through getMemberNavTarget — that
      // helper is for role-aware editing guards and can downgrade
      // the destination to FamilySharing. The profile screen itself
      // enforces permission guards (canEdit / canRemove).
      const memberId = String(
        (member as any).userId || (member as any).id || '',
      );
      if (!memberId) {
        navigateToScreen('FamilySharing', {});
        return;
      }

      triggerHaptic('light');
      navigateToScreen('EditGuardian', {
        guardianId: memberId,
        // Resolve edit mode from the CURRENT baby's role for this
        // member so the editor opens in the right guard level.
        mode:
          member.role === 'parent2'
            ? 'parent2'
            : member.role === 'viewer'
            ? 'viewer'
            : 'guardian',
        fromChat: false,
        // Show the "Family → Name" breadcrumb so it's obvious this is
        // the per-person profile, not the family screen.
        fromFamily: true,
      });
    },
    [members, navigateToScreen, triggerHaptic, displayedBaby],
  );

  // ── Header profile tap → EditGuardian (self) ────────────────
  // The sticky header's avatar + greeting card both route here.
  // It MUST mirror the MoreScreen profile-header behaviour:
  //
  //   • Parent 1 / Parent 2 → EditGuardian({ guardianId: me.id, mode: 'parent2' })
  //   • Guardian / Viewer    → EditGuardian({ guardianId: me.id, mode: 'guardian' })
  //
  // We resolve the CURRENT baby's role for me (not the global
  // `userProfile.role` hint) so a Parent1-on-BabyA / Guardian-on-BabyB
  // user lands on the right editor for the active baby.
  // ── Header profile tap → EditGuardian (self) ────────────────
  // This is the ONLY entry point for "tap my avatar". Every header
  // surface (sticky header, hero banner, settings menu) funnels here
  // so the routing logic lives in one place.
  //
  // Rules (must match MoreScreen / FamilyDashboardScreen):
  //   • Parent 1 / Parent 2 on the ACTIVE baby → mode 'parent2'
  //   • Guardian / Viewer on the ACTIVE baby    → mode 'guardian'
  //
  // A user who is Parent1-on-Baby-A / Guardian-on-Baby-B must land
  // on the correct editor for whichever baby is currently active,
  // so we resolve `myRoleForBaby` from FamilyContext `members` first
  // (per-baby authoritative), and fall back to the baby's parent
  // slots only if members hasn't hydrated yet.
  const handleEditMyProfile = useCallback(() => {
    const meId = userProfile?.id;
    if (!meId) {
      // Auth hasn't hydrated yet — send to the family dashboard so
      // the user isn't stuck on a dead tap.
      navigateToScreen('Profile');
      return;
    }

    // Try to resolve my role from family_members FIRST — that's the
    // authoritative source and is refreshed on focus. If it's still
    // empty (very first render before loadFamily resolves), fall
    // back to the baby's parent slots, then to 'guardian'.
    const myMemberRow =
      members.find((m: any) => (m as any).userId === meId) ||
      members.find((m: any) => m.id === meId) ||
      null;

    const rawRole = String(myMemberRow?.role || '').toLowerCase();

    const myRoleForBaby: string =
      rawRole ||
      (currentBaby?.parent1Id === meId
        ? 'parent1'
        : currentBaby?.parent2Id === meId
        ? 'parent2'
        : 'guardian');

    const editMode: 'parent2' | 'guardian' | 'viewer' =
      myRoleForBaby === 'parent1' || myRoleForBaby === 'parent2'
        ? 'parent2'
        : myRoleForBaby === 'viewer'
        ? 'viewer'
        : 'guardian';

    navigateToScreen('EditGuardian', {
      guardianId: meId,
      mode: editMode,
      fromChat: false,
      fromFamily: true,
    });
  }, [members, userProfile?.id, currentBaby?.parent1Id, currentBaby?.parent2Id, navigateToScreen]);

  // ── Baby avatar / baby-pill tap ─────────────────────────────
  // The sticky header avatar, the hero-banner stat pill, and the
  // "switch baby" row in the settings area all funnel here.
  //
  // Rules:
  //   • >1 baby  → open the `SwitchBaby` modal so the user can pick
  //                the correct baby before editing anything.
  //   • 1 baby   → open `EditProfile(mode: 'baby')` for that baby.
  //   • 0 babies → open `CreateBabyProfile`.
  //
  // This mirrors `ProfileHeader.handleBabyPress` in MoreScreen
  // exactly, so both screens behave the same.
  const handleBabyHeaderPress = useCallback(() => {
    const totalBabies = Array.isArray(babies) ? babies.length : 0;
    if (totalBabies > 1) {
      navigateToScreen('SwitchBaby', {
        returnTo: 'Main',
        returnLabel: 'Home',
      });
      return;
    }
    if (totalBabies === 1 && babies[0]?.id) {
      navigateToScreen('EditProfile', {
        mode: 'baby',
        babyId: babies[0].id,
      });
      return;
    }
    navigateToScreen('CreateBabyProfile');
  }, [babies, navigateToScreen]);

  /* ── Hero quick actions ── */
  const handleHeroQuickAction = useCallback((action: string) => {
    triggerHaptic('light');
    switch (action) {
      case 'feed':
        if (!requireBaby('Quick Log', 'AddEntry', { trackerId: 'feed' })) return;
        navigateToScreen('AddEntry', { trackerId: 'feed' });
        break;
      case 'timeline':
        if (!requireBaby('Timeline', 'Timeline', {})) return;
        navigateToScreen('Timeline', {});
        break;
      case 'chat':
        navigateToScreen('FamilyChatList');
        break;
      default:
        break;
    }
  }, [requireBaby, navigateToScreen, triggerHaptic]);

  /* ── Unified timeline events ── */
const allTimelineEvents = useMemo(() => {
  const babyId = displayedBaby?.id;
  if (!babyId) return [];

  // 1) Live tracker rows — already baby-scoped by FIX #4
  const trackerList = (trackerEntries || []).filter((e: any) => e?.timestamp);

  // 2) Any additional sources — also filtered to this baby
  const activityEvents = (getRecentTimelineEvents ? getRecentTimelineEvents(50, babyId) : [])
    .filter((e: any) => e?.babyId === babyId);

  const merged = [...trackerList];
  activityEvents.forEach((ae: any) => {
    if (ae && !merged.find((me: any) => me?.id === ae.id)) merged.push(ae);
  });

  // 3) Offline cache fallback — ONLY if every cached row belongs to this
  // baby. Without this guard, after a baby switch the cache still holds
  // the previous baby's rows and they would be rendered as this baby's.
  if (merged.length === 0 && cachedActivities.length > 0) {
    const scoped = cachedActivities.filter((e: any) => e?.babyId === babyId);
    if (scoped.length > 0) {
      return [...scoped].sort((a: any, b: any) => (b?.timestamp || 0) - (a?.timestamp || 0)).slice(0, 50);
    }
  }

  return merged
    .slice(0, 50)
    .sort((a: any, b: any) => (b?.timestamp || 0) - (a?.timestamp || 0));
}, [hasBaby, displayedBaby?.id, trackerEntries, getRecentTimelineEvents, cachedActivities]);

useEffect(() => {
  const userId = userProfile?.id;
  const babyId = displayedBaby?.id;
  if (!userId || !babyId) return;
  if (allTimelineEvents.length === 0) return;

  const actKey = scopedCacheKey(CACHE_KEYS.ACTIVITIES, userId, babyId);
  if (actKey) {
    AsyncStorage.setItem(actKey, JSON.stringify(allTimelineEvents.slice(0, 50))).catch(() => {});
  }
}, [allTimelineEvents, userProfile?.id, displayedBaby?.id]);

  /* ── Real per-tracker today counts ── */
  const todayCounts = useMemo(() => {
    if (!hasBaby) {
      return { feeds: 0, sleep: 0, diapers: 0, potty: 0, medication: 0, temperature: 0, note: 0, milestone: 0 };
    }
    const today = new Date();
    const todayEvents = allTimelineEvents.filter(
      (a: any) => a?.timestamp && isSameDay(new Date(a.timestamp), today)
    );
    const countOf = (ids: string[]) =>
      todayEvents.filter((a: any) => ids.includes(a.type) || ids.includes(a.trackerId)).length;
    return {
      feeds: countOf(['feed']),
      sleep: countOf(['sleep']),
      diapers: countOf(['diaper']),
      potty: countOf(['potty']),
      medication: countOf(['medication']),
      temperature: countOf(['temperature']),
      note: countOf(['note']),
      milestone: countOf(['milestone']),
    };
  }, [allTimelineEvents, hasBaby]);

  /* ── Real potty-day streak ── */
  const trackingStreakDays = useMemo(() => {
    if (!hasBaby || allTimelineEvents.length === 0) return 0;
    const dayKeys = new Set<string>();
    allTimelineEvents.forEach((a: any) => {
      if (!a?.timestamp) return;
      const d = new Date(a.timestamp);
      d.setHours(0, 0, 0, 0);
      dayKeys.add(String(d.getTime()));
    });
    if (dayKeys.size === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const DAY = 86400000;

    let cursor = dayKeys.has(String(todayTime)) ? todayTime : todayTime - DAY;
    if (!dayKeys.has(String(cursor))) return 0;

    let streak = 0;
    while (dayKeys.has(String(cursor))) {
      streak++;
      cursor -= DAY;
    }
    return streak;
  }, [allTimelineEvents, hasBaby]);

  /* ── Daily summary with yesterday counts ── */
  const dailySummary = useMemo((): DailySummary => {
    if (!hasBaby) return {
      feeds: 0, sleepHours: 0, diapers: 0, lastFeedTime: null, lastSleepTime: null,
      yesterdayFeeds: 0, yesterdaySleepHours: 0, yesterdayDiapers: 0
    };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayActivities = allTimelineEvents.filter((a: any) => a?.timestamp && isSameDay(new Date(a.timestamp), today));
    const yesterdayActivities = allTimelineEvents.filter((a: any) => a?.timestamp && isSameDay(new Date(a.timestamp), yesterday));

    const getDurationSeconds = (a: any): number => {
      const raw = a?.data?.duration ?? a?.duration ?? a?.data?.value ?? 0;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const s = String(raw ?? '').trim().toLowerCase();
      if (!s) return 0;
      const asNum = Number(s);
      if (Number.isFinite(asNum)) return asNum;
      let total = 0;
      const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        const n = parseFloat(m[1]);
        const u = m[2][0];
        total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
      }
      return total;
    };

    const feeds = todayActivities.filter((a: any) => a.type === 'feed' || a.trackerId === 'feed').length;
    const sleepEntries = todayActivities.filter((a: any) => a.type === 'sleep' || a.trackerId === 'sleep');
    const sleepHours = sleepEntries.reduce((sum: number, a: any) => sum + getDurationSeconds(a), 0) / 3600;
    const diapers = todayActivities.filter((a: any) => a.type === 'diaper' || a.trackerId === 'diaper').length;

    const yesterdayFeeds = yesterdayActivities.filter((a: any) => a.type === 'feed' || a.trackerId === 'feed').length;
    const yesterdaySleepEntries = yesterdayActivities.filter((a: any) => a.type === 'sleep' || a.trackerId === 'sleep');
    const yesterdaySleepHours = yesterdaySleepEntries.reduce((sum: number, a: any) => sum + getDurationSeconds(a), 0) / 3600;
    const yesterdayDiapers = yesterdayActivities.filter((a: any) => a.type === 'diaper' || a.trackerId === 'diaper').length;

    const lastFeed = allTimelineEvents.filter((a: any) => a.type === 'feed' || a.trackerId === 'feed')[0];
    const lastSleep = allTimelineEvents.filter((a: any) => a.type === 'sleep' || a.trackerId === 'sleep')[0];

    return {
      feeds, sleepHours, diapers,
      lastFeedTime: lastFeed ? new Date(lastFeed.timestamp) : null,
      lastSleepTime: lastSleep ? new Date(lastSleep.timestamp) : null,
      yesterdayFeeds, yesterdaySleepHours, yesterdayDiapers
    };
  }, [allTimelineEvents, hasBaby]);

  /* ── Growth KPIs ── */
const growthStats = useMemo(() => {
  if (!hasBaby) return null;
  const babyId = displayedBaby?.id;
  if (!babyId) return null;

  const result: Record<string, any> = {};
  (['height', 'weight', 'head'] as const).forEach((type) => {
    const raw = getGrowthData(type as any);
    // Growth data must belong to the current baby. Any cached / stale
    // rows from a previous baby get filtered here.
    const data = (Array.isArray(raw) ? raw : [])
      .filter((g: any) => !g?.babyId || g.babyId === babyId)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const current = data[0];
      const prev = data[1];
      if (current) {
        result[type] = { value: Number(current.value).toFixed(1), unit: current.unit, change: prev ? Number(current.value - prev.value).toFixed(1) : undefined, date: current.date };
      }
    });
    if (result.height && result.weight) {
      const h = parseFloat(result.height.value) / 100;
      const w = parseFloat(result.weight.value);
      result.bmi = { value: (w / (h * h)).toFixed(1), unit: '' };
    }
    return result;
  }, [growthData, hasBaby, getGrowthData, displayedBaby?.id]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);
  const unreadFamilyChatCount = useMemo(() => getFamilyChatUnread?.() || 0, [getFamilyChatUnread]);
  const totalUnread = unreadCommunityCount + unreadFamilyChatCount;

  const activeSmartNotifications = useMemo(() =>
    smartNotifications.filter(n => !n.dismissed).sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    [smartNotifications]
  );

  /* ── Vaccination reminders ── */
  const vaccinationReminders = useMemo((): VaccinationReminder[] => {
    if (!displayedBaby?.birthDate) return [];
    const ageDays = differenceInDays(new Date(), new Date(displayedBaby.birthDate));
    const reminders: VaccinationReminder[] = [];
    if (ageDays >= 42 && ageDays <= 60) reminders.push({ id: 'dtap-1', vaccineName: 'DTaP (1st dose)', dueDate: new Date(Date.now() + Math.max(0, 60 - ageDays) * 86400000), status: 'upcoming', doseNumber: 1 });
    if (ageDays >= 60 && ageDays <= 90) reminders.push({ id: 'ipv-1', vaccineName: 'IPV (1st dose)', dueDate: new Date(Date.now() + Math.max(0, 90 - ageDays) * 86400000), status: 'upcoming', doseNumber: 1 });
    if (ageDays >= 180 && ageDays <= 210) reminders.push({ id: 'dtap-2', vaccineName: 'DTaP (2nd dose)', dueDate: new Date(Date.now() + Math.max(0, 210 - ageDays) * 86400000), status: 'upcoming', doseNumber: 2 });
    return reminders;
  }, [displayedBaby]);

  const bgColors = isDark
    ? [theme.background, '#0c0c18', '#12121e']
    : [theme.background, '#eef0f5', '#e4e8f0'];

  const scrollTopPadding = HEADER_TOTAL_HEIGHT + 10;

  const showSkeletons = isLoadingInitial || (authLoading && !cachedBaby && allTimelineEvents.length === 0);

  /* ─── RENDER ─── */
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} style={styles.backgroundGradient} />

      <StickyAppHeader
        isDark={isDark}
        currentBaby={displayedBaby}
        userProfile={userProfile}
        onNotificationPress={handleNotificationPress}
        onLockPress={handleLockPress}
        // Baby avatar → SwitchBaby (if >1) or EditProfile (if 1).
        onBabyPress={handleBabyHeaderPress}
        onAddBabyPress={() => navigateToScreen('CreateBabyProfile')}
        unreadCount={totalUnread}
        // Left pill "⚙️ Settings" → MoreScreen (the app's settings
        // hub). Single entry point for all settings, family, and
        // profile-management shortcuts.
        onMenuPress={() => navigateToScreen('More')}
        // Shield → SafetyCorner. One-tap emergency access. This is
        // the ONLY header icon that isn't a "system" destination —
        // it's a safety/medical shortcut, and emergencies don't
        // wait for 3 taps.
        onSafetyCornerPress={handleSafetyCornerPress}
        primaryColor={primary}
        fullTheme={fullThemeColors || {}}
        fontSizeMultiplier={fontSizeMultiplier}
        compactSpacing={settings.compactSpacing}
      />

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: scrollTopPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary, secondary]} />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {showSkeletons ? (
          <HomeSkeleton isDark={isDark} theme={theme} borderRadius={borderRadiusValue} compact={settings.compactSpacing} />
        ) : (
          <>
            {/* ═══ AURA HERO BANNER ═══ */}
            <AuraHeroBanner
              isDark={isDark}
              theme={theme}
              userProfile={userProfile}
              currentBaby={displayedBaby}
              greeting={greeting}
              currentTime={currentTime}
              postsCount={allTimelineEvents.length}
              streakDays={trackingStreakDays}
              unreadCount={totalUnread}
              onProfilePress={handleEditMyProfile}
              onBabyPress={handleBabyHeaderPress}
              onInsightsPress={() => navigateToScreen('Insights')}
              onQuickAction={handleHeroQuickAction}
            />

            {/* ═══ FAMILY STACK (members list + baby) ═══ */}
            {/* Shows the current baby first, then every family member.
                Tapping the baby routes to the baby profile editor;
                tapping a member routes through handleMemberAvatarPress
                (which picks EditGuardian / FamilySharing based on role). */}
            {members.length > 0 && (
              <View style={{ marginBottom: DS.space.md }}>
                <FamilyStack
                  members={
                    displayedBaby
                      ? [babyAsMember(displayedBaby), ...members]
                      : members
                  }
                  isDark={isDark}
                  // The FamilyStack "Manage" affordance → family OVERVIEW
                  // (Profile / FamilyDashboard). Management actions
                  // (invites, tree, roles) are one tap further in.
                  onPress={() => navigateToScreen('Profile', {})}
                  onMemberPress={handleMemberAvatarPress}
                />
              </View>
            )}

            {/* ═══ RELATIONSHIP BACKFILL (existing users only) ═══ */}
            {userProfile?.id && (
              <RelationshipBackfillBanner
                isDark={isDark}
                userId={userProfile.id}
                onCompleted={() => {
                  // reload family so the chat header label updates
                  try { loadBabies(true); } catch {}
                }}
              />
            )}

            {/* ═══ AI PREDICTIONS ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <PredictionCard />
              </View>
            )}

            {/* ═══ AI CORRELATIONS ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <CorrelationCard />
              </View>
            )}

            {/* ═══ DAILY SUMMARY ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <DailySummaryWidget
                  summary={dailySummary}
                  isDark={isDark}
                  theme={theme}
                  onPress={handleDailySummaryPress}
                  streakDays={trackingStreakDays}
                />

                {/* Yesterday comparison */}
                <View style={[styles.yesterdayComparison, { marginTop: 10 }]}>
                  <Text style={[styles.yesterdayTitle, { color: theme.textMuted }]}>Today vs Yesterday</Text>
                  <View style={styles.yesterdayGrid}>
                    {(() => {
                      const renderDelta = (today: number, yesterday: number, unit = '') => {
                        const diff = today - yesterday;
                        if (yesterday === 0 && today === 0) return <Text style={{ color: theme.textMuted, fontSize: 11 }}>—</Text>;
                        if (diff === 0) return <Text style={{ color: theme.textMuted, fontSize: 11 }}>same</Text>;
                        const isUp = diff > 0;
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Ionicons name={isUp ? 'arrow-up' : 'arrow-down'} size={10} color={isUp ? DS.success : DS.danger} />
                            <Text style={{ color: isUp ? DS.success : DS.danger, fontSize: 11, fontWeight: '700' }}>
                              {Math.abs(Number(diff.toFixed(1)))}{unit}
                            </Text>
                          </View>
                        );
                      };

                      return (
                        <>
                          <View style={[styles.yesterdayItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)' }]}>
                            <Text style={[styles.yesterdayLabel, { color: theme.textSecondary }]}>Feeds</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                              <Text style={[styles.yesterdayValue, { color: theme.text }]}>{dailySummary.feeds}</Text>
                              {renderDelta(dailySummary.feeds, dailySummary.yesterdayFeeds)}
                            </View>
                          </View>
                          <View style={[styles.yesterdayItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)' }]}>
                            <Text style={[styles.yesterdayLabel, { color: theme.textSecondary }]}>Sleep</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                              <Text style={[styles.yesterdayValue, { color: theme.text }]}>{dailySummary.sleepHours.toFixed(1)}h</Text>
                              {renderDelta(Number(dailySummary.sleepHours.toFixed(1)), Number(dailySummary.yesterdaySleepHours.toFixed(1)), 'h')}
                            </View>
                          </View>
                          <View style={[styles.yesterdayItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)' }]}>
                            <Text style={[styles.yesterdayLabel, { color: theme.textSecondary }]}>Diapers</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                              <Text style={[styles.yesterdayValue, { color: theme.text }]}>{dailySummary.diapers}</Text>
                              {renderDelta(dailySummary.diapers, dailySummary.yesterdayDiapers)}
                            </View>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </View>
            )}

            {/* ═══ GROWTH SNAPSHOT ═══ */}
            {hasBaby && growthStats && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
                <View style={[styles.sectionHeader, { paddingHorizontal: DS.space.lg, marginTop: 6 }]}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="pulse-outline" size={18} color={primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Growth Snapshot</Text>
                  </View>
                  <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('GrowthDashboard')}>
                    <Text style={[styles.seeAllText, { color: primary }]}>Full Dashboard</Text>
                    <Ionicons name="arrow-forward-outline" size={13} color={primary} />
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                  <GrowthSnapshot isDark={isDark} theme={theme} growthStats={growthStats} onPress={() => navigateToScreen('GrowthDashboard')} />
                </View>
              </Animated.View>
            )}

            {/* ═══ SMART CONTEXT ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <SmartContextCard isDark={isDark} theme={theme} currentBaby={displayedBaby} onPress={handleContextPress} />
              </View>
            )}

            {/* ═══ NEXT BEST ACTION ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <NextBestAction isDark={isDark} theme={theme} currentBaby={displayedBaby} lastActivities={allTimelineEvents} onAction={handleNextAction} />
              </View>
            )}

            {/* ═══ VACCINATION REMINDERS ═══ */}
            {hasBaby && vaccinationReminders.length > 0 && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <VaccinationReminders reminders={vaccinationReminders} isDark={isDark} theme={theme} onPress={() => navigateToScreen('VaccinationSchedule')} />
              </View>
            )}

            {/* ═══ AI INSIGHTS ═══ */}
            {hasBaby && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <AIInsightsCard isDark={isDark} theme={theme} currentBaby={displayedBaby} activities={allTimelineEvents} onPress={() => navigateToScreen('GrowthDashboard')} />
              </View>
            )}

            {/* ═══ SMART NOTIFICATIONS ═══ */}
            {activeSmartNotifications.length > 0 && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
                <SmartNotificationPanel notifications={activeSmartNotifications} onDismiss={handleSmartNotifDismiss} onAction={handleSmartNotifAction} isDark={isDark} theme={theme} />
              </View>
            )}

            {/* ═══ QUICK ACTIONS ═══ */}
            <View style={styles.sectionFullWidth}>
              <View style={[styles.sectionHeader, { paddingHorizontal: DS.space.lg }]}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="grid-outline" size={18} color={primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
                </View>
              </View>
              <CategorizedQuickActions
                actions={QUICK_ACTIONS.map((a) => {
                  let badgeCount: number | undefined;
                  let badgeLabel: string | undefined;

                  switch (a.id) {
                    case 'feed': badgeCount = todayCounts.feeds; break;
                    case 'sleep': badgeCount = todayCounts.sleep; break;
                    case 'diaper': badgeCount = todayCounts.diapers; break;
                    case 'potty': badgeCount = todayCounts.potty; break;
                    case 'medication': badgeCount = todayCounts.medication; break;
                    case 'temperature': badgeCount = todayCounts.temperature; break;
                    case 'note': badgeCount = todayCounts.note; break;
                    case 'growth':
                      if (growthStats?.height) badgeLabel = growthStats.height.value + 'cm';
                      else if (growthStats?.weight) badgeLabel = growthStats.weight.value + 'kg';
                      break;
                    case 'milestone':
                      if (milestones.length > 0) badgeCount = milestones.length;
                      break;
                    case 'vaccine':
                      if (vaccinationReminders.length > 0) badgeCount = vaccinationReminders.length;
                      break;
                    case 'reminders':
                      if (activeSmartNotifications.length > 0) {
                        badgeCount = activeSmartNotifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length || undefined;
                      }
                      break;
                    case 'family_chat':
                      if (totalUnread > 0) badgeCount = totalUnread;
                      break;
                    default: break;
                  }

                  return { ...a, badgeCount, badgeLabel };
                })}
                onPress={handleQuickAction}
                isDark={isDark}
                theme={theme}
              />
            </View>

            {/* ═══ FEATURE CARDS ═══ */}
            <View style={styles.sectionFullWidth}>
              <View style={[styles.sectionHeader, { paddingHorizontal: DS.space.lg, marginBottom: 10 }]}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="apps-outline" size={18} color={DS.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Tools & Features</Text>
                </View>
              </View>
              <FeatureCardsRow
                items={FEATURE_CARDS.map((f) => {
                  if (f.id === 'growth' && growthStats?.height) return { ...f, badge: growthStats.height.value + 'cm', badgeColor: '#10b981' };
                  if (f.id === 'milestones') return { ...f, badge: milestones.length + ' Total', badgeColor: '#ec4899' };
                  if (f.id === 'vaccine') return { ...f, badge: vaccinationReminders.filter((r) => r.status !== 'completed').length + ' Due', badgeColor: '#e11d48' };
                  if (f.id === 'chat') return { ...f, badge: unreadFamilyChatCount > 0 ? unreadFamilyChatCount + ' New' : undefined, badgeColor: '#06b6d4' };
                  if (f.id === 'sound') return { ...f, badge: undefined, badgeColor: undefined };
                  return f;
                })}
                onPress={handleFeaturePress}
                isDark={isDark}
                theme={theme}
              />
            </View>

            {/* ═══ WEEKLY PATTERN ═══ */}
            {hasBaby && allTimelineEvents.length > 0 && (
              <View style={{ marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.md }}>
                <WeeklyPatternInsight isDark={isDark} theme={theme} activities={allTimelineEvents} />
              </View>
            )}

            {/* ═══ SOUND MIXER ═══ */}
            <View style={[styles.section, { paddingHorizontal: DS.space.lg }]}>
              <SectionHeader title="Sound Mixer" subtitle="White noise & lullabies" action={() => navigateToScreen('SoundMixer')} actionLabel="Full Mixer" icon="musical-notes-outline" theme={theme} />
              <SoundMixerSection onPress={() => navigateToScreen('SoundMixer')} isDark={isDark} theme={theme} />
            </View>

            {/* ═══ RECENT ACTIVITY ═══ */}
            <View style={styles.sectionFullWidth}>
              <View style={[styles.sectionHeader, { paddingHorizontal: DS.space.lg }]}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="time-outline" size={18} color={secondary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
                </View>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => {
                    if (!requireBaby('Timeline', 'Timeline', {})) return;
                    navigateToScreen('Timeline', {});
                  }}
                >
                  <Text style={[styles.seeAllText, { color: primary }]}>View All</Text>
                  <Ionicons name="arrow-forward-outline" size={13} color={primary} />
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: DS.space.lg }}>
                {allTimelineEvents.length === 0 && activitiesLoading ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color={DS.primary} />
                    <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary, marginTop: 12 }]}>Loading activities...</Text>
                  </View>
                ) : (
                  <RecentTimeline
  activities={allTimelineEvents}
  isDark={isDark}
  theme={theme}
  onViewAll={() => {
    if (!requireBaby('Timeline', 'Timeline', {})) return;
    navigateToScreen('Timeline', {});
  }}
  onEntryPress={handleEntryPress}
  borderRadius={borderRadiusValue}
  members={members}
  // NEW: avatar tap resolves the correct route + edit mode for
  // the tapped member based on my role for the current baby.
  onAvatarPress={handleMemberAvatarPress}
/>
                )}
              </View>
            </View>

            <View style={{ height: settings.compactSpacing ? 80 : 120 }} />
          </>
        )}
      </Animated.ScrollView>

      {/* ═══ Notification Chooser Modal ═══ */}
      <Modal visible={showNotificationChooser} transparent animationType="fade" onRequestClose={() => setShowNotificationChooser(false)}>
        <Pressable style={styles.notificationModalOverlay} onPress={() => setShowNotificationChooser(false)}>
          <View style={[styles.notificationModalContent, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={styles.notificationModalHeader}>
              <Text style={[styles.notificationModalTitle, { color: theme.text }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.notificationModalOption}
              onPress={() => { setShowNotificationChooser(false); navigateToScreen('TrackerReminders'); }}
            >
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="notifications" size={20} color={theme.primary} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>App Reminders</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Your tracking reminders & alerts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationModalOption}
              onPress={() => { setShowNotificationChooser(false); navigateToScreen('CommunityMain'); }}
            >
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${theme.secondary}15` }]}>
                <Ionicons name="people" size={20} color={theme.secondary} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>Community</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Mentions, replies & follows</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationModalOption}
              onPress={() => { setShowNotificationChooser(false); toast('Cleared', 'All notification badges reset', 'success'); }}
            >
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${theme.accent}15` }]}>
                <Ionicons name="checkmark-done" size={20} color={theme.accent} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>Mark All as Read</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Clear all notification badges</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ═══ Baby Required Modal ═══ */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={styles.modalIconWrap}>
              <LinearGradient colors={[secondary, primary]} style={styles.modalIconGradient}>
                <Ionicons name="people-outline" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Create a baby profile to {pendingAction ? `use ${pendingAction.label}` : 'start tracking'} and unlock all features.
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: primary }]}
              onPress={() => { setShowBabyRequiredModal(false); navigateToScreen('CreateBabyProfile'); }}
            >
              <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setShowBabyRequiredModal(false)}>
              <Text style={[styles.modalSecondaryBtnText, { color: theme.textMuted }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ═══ Security Setup Modal ═══ */}
      <Modal visible={showSecurityModal} transparent animationType="fade" onRequestClose={() => setShowSecurityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSecurityModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${accent}15` }]}>
              <Ionicons name="shield-outline" size={32} color={accent} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>No Security Enabled</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              You haven't set up a PIN or biometric lock yet. You can still lock the app, but anyone can unlock it.
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: primary }]}
              onPress={() => { setShowSecurityModal(false); navigateToScreen('SecurityCenter', { mode: 'setup' }); }}
            >
              <Text style={styles.modalPrimaryBtnText}>Set Up Security</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSecondaryBtn, { borderColor: `${primary}30`, borderWidth: 1 }]}
              onPress={async () => {
                setShowSecurityModal(false);
                await lockApp();
                toast('App Locked', 'Locked without security. Tap unlock to enter.', 'warning');
                navigateToScreen('SecurityLock');
              }}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: primary }]}>Lock Anyway</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFill },
  scrollContent: { paddingBottom: 24 },

  /* ── Sticky Header ── */
  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: DS.space.lg },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  stickyHeaderLeft: { width: 40, alignItems: 'flex-start' },
  stickyHeaderCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  // Breadcrumb pill — replaces the plain hamburger. A home glyph +
  // "More" label inside a rounded chip. It's a wider (~72×30) tap
  // target than a 36×36 icon, which matters because the top-left is
  // the hardest zone to reach one-handed. Pairing the glyph with a
  // text label removes ambiguity and makes the destination
  // self-documenting ("tap here to open More").
  headerBreadcrumbPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerBreadcrumbText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  headerSubtitle: { fontSize: 11, fontWeight: '500', marginTop: -2 },
  stickyHeaderRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18 },
  headerIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: DS.white,
    zIndex: 10,
  },
  headerBadgeGrad: {
    minWidth: 13,
    height: 13,
    borderRadius: 6.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  headerBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800', lineHeight: 13, textAlign: 'center' },
  headerBabyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerLockBtn: { marginLeft: 2 },
  headerLockGradient: { alignItems: 'center', justifyContent: 'center' },

  /* ── Aura Hero Banner ── */
  heroBanner: {
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.md,
    marginBottom: DS.space.md,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  auraGlowTopLeft: {
    position: 'absolute',
    top: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.9,
  },
  auraGlowTopRight: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.8,
  },
  heroContent: { zIndex: 1 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroUserRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroUserInfo: { marginLeft: DS.space.md, flex: 1 },
  heroGreeting: { fontSize: 12, fontWeight: '500', marginBottom: 1 },
  heroUserName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginTop: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
  verifiedText: { fontSize: 10, fontWeight: '700' },
  heroDate: { fontSize: 11, fontWeight: '500' },
  heroActions: { flexDirection: 'row', gap: DS.space.sm },
  heroIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  heroBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.md,
    gap: DS.space.md,
  },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  heroStatText: { flexDirection: 'column', alignItems: 'flex-start' },
  heroStatValue: { fontSize: 14, fontWeight: '800' },
  heroStatLabel: { fontSize: 10, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 24 },
  heroActionRow: { flexDirection: 'row', gap: DS.space.sm, marginTop: DS.space.md },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.full,
  },
  heroActionText: { fontSize: 13, fontWeight: '700', color: DS.white },
  // 3-tile secondary-action row under the hero quick-action buttons.
  // Each tile is a fat ~100×60 tap target in the natural thumb zone.
  // Replaces the old "Manage family & caregivers" text link, which was
  // too small to serve as the primary family affordance — and gives
  // Safety + Insights permanent one-tap homes in the hero.
  /* heroTile styles removed — the Family · Safety · Insights tile row
     was redundant with the sticky-header shield (Safety) and the
     FamilyStack below (Family). Insights now lives in heroActionRow. */
  /* ── Glass Card ── */
  glassCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 24 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* ── Daily Summary ── */
  dailySummaryContainer: { marginBottom: 0 },
  dailySummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  dailySummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailySummaryIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dailySummaryTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  dailySummaryDate: { fontSize: 12, fontWeight: '500' },
  dailySummaryGrid: { flexDirection: 'row', gap: 8 },
  dailySummaryItem: { flex: 1, borderRadius: 20, overflow: 'hidden', aspectRatio: 0.85 },
  dailySummaryGradient: { padding: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  dailySummaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 6, color: '#fff' },
  dailySummaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 3, color: '#fff' },

  /* ── Yesterday Comparison ── */
  yesterdayComparison: { paddingHorizontal: 4 },
  yesterdayTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  yesterdayGrid: { flexDirection: 'row', gap: 12 },
  yesterdayItem: { flex: 1, padding: 8, borderRadius: 12 },
  yesterdayLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  yesterdayValue: { fontSize: 14, fontWeight: '700' },

  /* ── Context ── */
  contextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 22, borderWidth: 1 },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  contextIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contextText: { flex: 1 },
  contextTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  contextMessage: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  contextActionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  contextActionText: { fontSize: 11, fontWeight: '700' },

  /* ── Next Action ── */
  nextActionContainer: { borderRadius: 22, overflow: 'hidden' },
  nextActionGradient: { padding: 16 },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextActionIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  nextActionText: { flex: 1 },
  nextActionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  nextActionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1, color: 'rgba(255,255,255,0.85)' },
  nextActionArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  nextActionUrgency: { position: 'absolute', top: 10, right: 10 },
  urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  /* ── Weekly Pattern ── */
  patternContainer: { borderRadius: 22, padding: 14, borderWidth: 1 },
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  patternTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patternIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  patternTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  patternSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  patternBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90, gap: 6 },
  patternDay: { flex: 1, alignItems: 'center', gap: 4 },
  patternBarContainer: { width: '100%', height: 60, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  patternBar: { width: '100%', borderRadius: 6, minHeight: 3 },
  patternDayLabel: { fontSize: 10, fontWeight: '600' },
  patternDayCount: { fontSize: 9, fontWeight: '700' },

  /* ── Quick Actions ── */
  categoryTabsScroll: { paddingHorizontal: DS.space.lg, gap: 6, paddingBottom: 10 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  categoryTabText: { fontSize: 12, fontWeight: '600' },
  categoryTabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, minWidth: 18, alignItems: 'center' },
  categoryTabBadgeText: { fontSize: 9, fontWeight: '700' },
  categorizedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', paddingBottom: 6 },
  categorizedGridItem: { alignItems: 'center', marginBottom: 10 },
  categorizedGridTouchable: { alignItems: 'center', width: '100%' },
  categorizedGridGradient: { borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  categorizedGridLabel: { fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  /* ── Vaccination ── */
  vaccineContainer: { borderRadius: 22, padding: 14, borderWidth: 1 },
  vaccineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vaccineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vaccineIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vaccineTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  vaccineSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  vaccineSeeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  vaccineSeeAllText: { fontSize: 11, fontWeight: '700' },
  vaccineList: {},
  vaccineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  vaccineDot: { width: 8, height: 8, borderRadius: 4 },
  vaccineInfo: { flex: 1 },
  vaccineName: { fontSize: 13, fontWeight: '700' },
  vaccineDose: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  vaccineBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vaccineBadgeText: { fontSize: 10, fontWeight: '700' },

  /* ── AI Insights ── */
  aiInsightsContainer: { borderRadius: 22, padding: 14, borderWidth: 1 },
  aiInsightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiInsightsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInsightsIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aiInsightsTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  aiInsightsSeeAll: { fontSize: 12, fontWeight: '700' },
  aiInsightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 6 },
  aiInsightIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiInsightContent: { flex: 1 },
  aiInsightTitle: { fontSize: 13, fontWeight: '700' },
  aiInsightMessage: { fontSize: 11, fontWeight: '500', marginTop: 1, lineHeight: 16 },

  /* ── Feature Cards ── */
  featureCardsScroll: { paddingHorizontal: DS.space.lg, gap: 10, paddingBottom: 4 },
  featureCardTouchable: { width: 150 },
  featureCard: { borderRadius: 22, padding: 14, borderWidth: 1 },
  featureCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  featureCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureCardBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 26, alignItems: 'center' },
  featureCardBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  featureCardLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3, letterSpacing: -0.3 },
  featureCardDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  featureCardArrow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  featureCardArrowText: { fontSize: 11, fontWeight: '700' },

  /* ── Notifications ── */
  notificationPanel: { marginBottom: 0 },
  notificationPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationPanelIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notificationPanelTitle: { fontSize: 15, fontWeight: '800' },
  urgentBadge: { backgroundColor: DS.danger, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  urgentBadgeText: { color: DS.white, fontSize: 10, fontWeight: 'bold' },
  expandBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  expandText: { fontSize: 12, fontWeight: '600' },
  smartNotificationCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 6, borderLeftWidth: 3 },
  smartNotifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  smartNotifContent: { flex: 1 },
  smartNotifTitle: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  smartNotifMessage: { fontSize: 11, lineHeight: 16 },
  smartNotifMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  smartNotifTime: { fontSize: 10, fontWeight: '500' },
  smartNotifActionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smartNotifActionText: { fontSize: 10, fontWeight: '700' },
  dismissBtn: { padding: 3, marginLeft: 3 },

  /* ── Sound Mixer ── */
  soundMixerContainer: { borderRadius: 26, padding: 14, marginBottom: 6, borderWidth: 1 },
  soundMixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  soundMixerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soundMixerIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  soundMixerTitleText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  soundMixerSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  playAllButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DB954' },
  playAllButtonActive: { backgroundColor: DS.warning },
  trackCard: { width: 100, marginRight: 10 },
  trackImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 6, overflow: 'hidden' },
  trackOverlay: { flex: 1, justifyContent: 'flex-end', padding: 6 },
  trackPlayButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  trackPlayButtonActive: { backgroundColor: DS.warning },
  trackTitle: { fontSize: 12, fontWeight: '600', marginBottom: 1 },
  trackArtist: { fontSize: 10, fontWeight: '500' },
  playingIndicator: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.4)' },
  bar: { width: 2.5, height: 10, borderRadius: 1 },
  barMiddle: { height: 16 },

  /* ── Recent Timeline ── */
  daySection: { marginBottom: 20 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  dateBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  dateBadgeText: { fontSize: 12, fontWeight: '700' },
  eventRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { width: 58, alignItems: 'flex-end', paddingTop: 16 },
  timeText: { fontSize: 12, fontWeight: '700' },
  timelineLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  eventCardContainer: { flex: 1, paddingBottom: 14 },
  entryCard: { flex: 1, overflow: 'hidden', borderWidth: 1 },
  entryCardContent: { padding: 14, gap: 8 },
  entryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryIconBg: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  entryEmoji: { fontSize: 19 },
  entryInfo: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  entryMeta: { fontSize: 11, fontWeight: '500' },
  entryTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  entryTypeText: { fontSize: 10, fontWeight: '700' },
  entryNotes: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginLeft: 48 },
  viewAllButton: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  viewAllText: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  emptyStateSubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24, marginBottom: 18 },
  logFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  logFirstBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  /* ── Sections ── */
  section: { marginTop: 6 },
  sectionFullWidth: { marginTop: 6, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  sectionHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeaderActionText: { fontSize: 12, fontWeight: '700' },

  /* ── Notification Modal ── */
  notificationModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  notificationModalContent: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 20 },
  notificationModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  notificationModalTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  notificationModalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  notificationModalIconWrap: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  notificationModalTextWrap: { flex: 1 },
  notificationModalOptionTitle: { fontSize: 16, fontWeight: '600' },
  notificationModalOptionDesc: { fontSize: 13, fontWeight: '500', marginTop: 2 },

  /* ── Modals ── */
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 28, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 24, marginBottom: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalIconGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
  modalDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: 18, gap: 8, marginBottom: 12 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600' },

  /* ── Growth KPIs ── */
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiHomeCard: { width: (SCREEN_W - 56) / 2, borderRadius: 20, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  kpiHomeIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  kpiHomeBody: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
  kpiHomeValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  kpiHomeUnit: { fontSize: 11, fontWeight: '700' },
  kpiHomeTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiHomeChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  kpiHomeChange: { fontSize: 10, fontWeight: '700' },

  /* ── Quick Action Badges ── */
  actionBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  actionBadgeText: { fontSize: 10, fontWeight: '800' },
  actionBadgeLabel: { position: 'absolute', bottom: 4, left: 4, right: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' },
  actionBadgeLabelText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});