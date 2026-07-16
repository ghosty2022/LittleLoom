import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
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
  useColorScheme,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { useCustomization } from '../../hooks/useCustomization';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCommunity } from '../../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../../context/AudioContext';
import { useMedia } from '../../context/MediaContext';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInRight,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay, differenceInHours, differenceInDays, differenceInMonths } from 'date-fns';

import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');
const SCREEN_W = width;
const SCREEN_H = height;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Ultra-Refined, Cohesive Tokens (GrowthDashboard DNA)
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 10, sm: 14, md: 18, lg: 22, xl: 28, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 40 },
  shadow: {
    xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 8 },
    glow: { shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 6 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION MAP — FIXED: Keys match actual screen names used in code
   ═══════════════════════════════════════════════════════════════════════════ */
const NAVIGATION_MAP: Record<string, { screen: keyof RootStackParamList; params?: Record<string, any> }> = {
  // Tab roots
  'Main': { screen: 'Main', params: {} },
  'Connect': { screen: 'Main', params: { screen: 'Connect' } },
  'More': { screen: 'Main', params: { screen: 'More' } },
  
  // Auth & Setup
  'Onboarding': { screen: 'Onboarding', params: {} },
  'Login': { screen: 'Login', params: {} },
  'SignUp': { screen: 'SignUp', params: {} },
  'ForgotPassword': { screen: 'ForgotPassword', params: {} },
  'CreateBabyProfile': { screen: 'CreateBabyProfile', params: {} },
  'SwitchBaby': { screen: 'SwitchBaby', params: {} },
  
  // Main screens — FIXED: Keys now match actual screen names
  'UniversalTrackerHub': { screen: 'UniversalTrackerHub', params: {} },
  'Timeline': { screen: 'Timeline', params: {} },
  'GrowthDashboard': { screen: 'GrowthDashboard', params: {} },
  'Achievements': { screen: 'Achievements', params: {} },
  'TrackerReminders': { screen: 'TrackerReminders', params: {} },
  'SafetyCorner': { screen: 'SafetyCorner', params: {} },
  'Gallery': { screen: 'Gallery', params: {} },
  'SoundMixer': { screen: 'SoundMixer', params: {} },
  'FamilySharing': { screen: 'FamilySharing', params: {} },
  'FamilyChatList': { screen: 'FamilyChatList', params: {} },
  'HelpCenter': { screen: 'HelpCenter', params: {} },
  'ContactSupport': { screen: 'ContactSupport', params: {} },
  'Profile': { screen: 'Profile', params: {} },
  'EditProfile': { screen: 'EditProfile', params: {} },
  'VaccinationSchedule': { screen: 'VaccinationSchedule', params: {} },
  'Customize': { screen: 'Customize', params: {} },
  
  // Legacy aliases (keep for backward compatibility)
  'Settings': { screen: 'Customize', params: {} },
  'UniversalTracker': { screen: 'UniversalTrackerHub', params: {} },
  'Reminders': { screen: 'TrackerReminders', params: {} },
  'Grow': { screen: 'GrowthDashboard', params: {} },
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
}

interface VaccinationReminder {
  id: string;
  vaccineName: string;
  dueDate: Date;
  status: 'upcoming' | 'overdue' | 'completed';
  doseNumber: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const getFullThemeColors = (theme: string, appearance: string, isDarkMode: boolean) => {
  return {
    background: isDarkMode ? '#08080f' : '#f4f6fa',
    surface: isDarkMode ? '#12121e' : '#ffffff',
    surfaceElevated: isDarkMode ? '#1a1a2a' : '#ffffff',
    surfaceGlass: isDarkMode ? 'rgba(26,26,42,0.88)' : 'rgba(255,255,255,0.94)',
    text: isDarkMode ? '#f0f0f7' : '#111827',
    textSecondary: isDarkMode ? '#9ca3af' : '#6b7280',
    textMuted: isDarkMode ? '#6b7280' : '#9ca3af',
    border: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderLight: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    glassBg: isDarkMode ? 'rgba(26,26,42,0.96)' : 'rgba(255,255,255,0.96)',
    shadow: '#000',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATA — Refined Quick Actions with Categories
   ═══════════════════════════════════════════════════════════════════════════ */

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'feed', label: 'Feed', icon: '🍼', iconName: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#fee140'], screen: 'UniversalTrackerHub', params: { type: 'feed' }, category: 'daily' },
  { id: 'sleep', label: 'Sleep', icon: '😴', iconName: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'], screen: 'UniversalTrackerHub', params: { type: 'sleep' }, category: 'daily' },
  { id: 'diaper', label: 'Diaper', icon: '🧷', iconName: 'shirt-outline', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'], screen: 'UniversalTrackerHub', params: { type: 'diaper' }, category: 'daily' },
  { id: 'potty', label: 'Potty', icon: '🚽', iconName: 'water-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'], screen: 'UniversalTrackerHub', params: { type: 'potty' }, category: 'daily' },
  { id: 'growth', label: 'Growth', icon: '📏', iconName: 'trending-up-outline', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], screen: 'GrowthDashboard', params: {}, category: 'health' },
  { id: 'medication', label: 'Meds', icon: '💊', iconName: 'medical-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'UniversalTrackerHub', params: { type: 'medication' }, category: 'health' },
  { id: 'vaccine', label: 'Vaccines', icon: '💉', iconName: 'medical-outline', color: '#e11d48', gradient: ['#e11d48', '#fb7185'], screen: 'VaccinationSchedule', params: {}, category: 'health' },
  { id: 'temperature', label: 'Temp', icon: '🌡️', iconName: 'thermometer-outline', color: '#f97316', gradient: ['#f97316', '#fb923c'], screen: 'UniversalTrackerHub', params: { type: 'temperature' }, category: 'health' },
  { id: 'milestone', label: 'Milestone', icon: '🌟', iconName: 'trophy-outline', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'Achievements', params: {}, category: 'family' },
  { id: 'gallery', label: 'Gallery', icon: '🖼️', iconName: 'images-outline', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'Gallery', params: {}, category: 'family' },
  { id: 'family_chat', label: 'Chat', icon: '💬', iconName: 'chatbubbles-outline', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], screen: 'FamilyChatList', params: {}, category: 'family' },
  { id: 'note', label: 'Note', icon: '📝', iconName: 'document-text-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'UniversalTrackerHub', params: { type: 'note' }, category: 'family' },
  { id: 'reminders', label: 'Reminders', icon: '⏰', iconName: 'alarm-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'TrackerReminders', params: {}, category: 'tools' },
  { id: 'sound', label: 'Sounds', icon: '🎵', iconName: 'musical-notes-outline', color: '#1DB954', gradient: ['#1DB954', '#1ed760'], screen: 'SoundMixer', params: {}, category: 'tools' },
  { id: 'safety', label: 'Safety', icon: '🛡️', iconName: 'shield-checkmark-outline', color: '#dc2626', gradient: ['#dc2626', '#ef4444'], screen: 'SafetyCorner', params: {}, category: 'tools' },
  { id: 'settings', label: 'Settings', icon: '⚙️', iconName: 'settings-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'Customize', params: {}, category: 'tools' },
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
];

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED GLASS CARD — GrowthDashboard Style (NO BLUR — solid gradients)
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; intensity?: number }> = 
  React.memo(({ children, style, onPress }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
      <Wrapper onPress={onPress} activeOpacity={0.85} style={[styles.glassCard, style]}>
        <LinearGradient 
          colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']} 
          style={StyleSheet.absoluteFill} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
        />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    );
  });

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER COMPONENT — Clean, Minimal (GrowthDashboard Style)
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
      {icon && <Ionicons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 10 }} />}
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI DAILY SUMMARY WIDGET — Redesigned as Sleek Horizontal Strip
   ═══════════════════════════════════════════════════════════════════════════ */

const DailySummaryWidget: React.FC<{
  summary: DailySummary;
  isDark: boolean;
  theme: any;
  onPress: (type: string) => void;
}> = React.memo(({ summary, isDark, theme, onPress }) => {
  const items = [
    {
      id: 'feeds',
      label: 'Feeds',
      value: summary.feeds.toString(),
      sublabel: summary.lastFeedTime ? formatDistanceToNow(summary.lastFeedTime, { addSuffix: true }) : 'No feeds yet',
      icon: 'nutrition-outline',
      color: '#fa709a',
      gradient: ['#fa709a', '#fee140'] as [string, string],
    },
    {
      id: 'sleep',
      label: 'Sleep',
      value: `${summary.sleepHours.toFixed(1)}h`,
      sublabel: summary.lastSleepTime ? formatDistanceToNow(summary.lastSleepTime, { addSuffix: true }) : 'No sleep logged',
      icon: 'moon-outline',
      color: '#11998e',
      gradient: ['#11998e', '#38ef7d'] as [string, string],
    },
    {
      id: 'diapers',
      label: 'Diapers',
      value: summary.diapers.toString(),
      sublabel: 'Today',
      icon: 'shirt-outline',
      color: '#667eea',
      gradient: ['#667eea', '#764ba2'] as [string, string],
    },
    {
      id: 'streak',
      label: 'Streak',
      value: '7d',
      sublabel: 'Keep it up!',
      icon: 'flame-outline',
      color: '#f59e0b',
      gradient: ['#f59e0b', '#fbbf24'] as [string, string],
    },
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
            <TouchableOpacity
              key={item.id}
              onPress={() => onPress(item.id)}
              activeOpacity={0.85}
              style={styles.dailySummaryItem}
            >
              <LinearGradient
                colors={item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dailySummaryGradient}
              >
                <Ionicons name={item.icon as any} size={18} color="#fff" style={{ opacity: 0.9 }} />
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: SMART CONTEXT CARD — Redesigned as Compact Pill
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
      icon = 'partly-sunny-outline';
      title = 'Good Morning!';
      message = 'Time for the first feed and morning routine';
      color = '#f59e0b';
      bgGradient = ['#fef3c7', '#fde68a'];
      actionLabel = 'Log Morning Feed';
    } else if (hour >= 9 && hour < 12) {
      icon = 'sunny-outline';
      title = 'Mid-Morning Activity';
      message = 'Ideal time for play and developmental activities';
      color = '#10b981';
      bgGradient = ['#d1fae5', '#a7f3d0'];
      actionLabel = 'Log Play Time';
    } else if (hour >= 12 && hour < 15) {
      icon = 'restaurant-outline';
      title = 'Lunch Time';
      message = "Don't forget to log the midday feed";
      color = '#fa709a';
      bgGradient = ['#fce7f3', '#fbcfe8'];
      actionLabel = 'Log Feed';
    } else if (hour >= 15 && hour < 18) {
      icon = 'walk-outline';
      title = 'Afternoon Stroll';
      message = 'Fresh air helps with nap time later';
      color = '#3b82f6';
      bgGradient = ['#dbeafe', '#bfdbfe'];
      actionLabel = 'Start Walk';
    } else if (hour >= 18 && hour < 21) {
      icon = 'moon-outline';
      title = 'Wind Down Time';
      message = 'Start the bedtime routine for better sleep';
      color = '#6366f1';
      bgGradient = ['#e0e7ff', '#c7d2fe'];
      actionLabel = 'Start Sleep Timer';
    } else {
      icon = 'moon-outline';
      title = 'Night Mode';
      message = 'Quiet time - check if baby needs anything';
      color = '#4c1d95';
      bgGradient = ['#ede9fe', '#ddd6fe'];
      actionLabel = 'Log Night Feed';
    }

    return { icon, title, message, color, bgGradient, actionLabel };
  }, [hour]);

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.7)', 'rgba(35,35,50,0.5)'] : context.bgGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.contextCard, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : `${context.color}25` }]}
        >
          <View style={styles.contextLeft}>
            <View style={[styles.contextIconBg, { backgroundColor: `${context.color}18` }]}>
              <Ionicons name={context.icon as any} size={22} color={context.color} />
            </View>
            <View style={styles.contextText}>
              <Text style={[styles.contextTitle, { color: theme.text }]}>{context.title}</Text>
              <Text style={[styles.contextMessage, { color: theme.textSecondary }]} numberOfLines={1}>
                {context.message}
              </Text>
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: NEXT BEST ACTION — Redesigned as Floating Action Banner
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
    const lastFeed = lastActivities.find((a: any) => a.type === 'feed');
    const lastSleep = lastActivities.find((a: any) => a.type === 'sleep');
    const lastDiaper = lastActivities.find((a: any) => a.type === 'diaper');

    const hoursSinceFeed = lastFeed ? differenceInHours(now, new Date(lastFeed.timestamp)) : 999;
    const hoursSinceSleep = lastSleep ? differenceInHours(now, new Date(lastSleep.timestamp)) : 999;
    const hoursSinceDiaper = lastDiaper ? differenceInHours(now, new Date(lastDiaper.timestamp)) : 999;

    if (hoursSinceFeed >= 3) {
      return {
        id: 'feed-now',
        title: 'Time to Feed',
        subtitle: `Last feed was ${hoursSinceFeed}h ago`,
        icon: 'nutrition-outline',
        color: '#fa709a',
        gradient: ['#fa709a', '#fee140'] as [string, string],
        screen: 'UniversalTrackerHub',
        params: { type: 'feed' },
        urgency: 'high',
      };
    }
    if (hoursSinceDiaper >= 3) {
      return {
        id: 'diaper-now',
        title: 'Check Diaper',
        subtitle: `Last change was ${hoursSinceDiaper}h ago`,
        icon: 'shirt-outline',
        color: '#667eea',
        gradient: ['#667eea', '#764ba2'] as [string, string],
        screen: 'UniversalTrackerHub',
        params: { type: 'diaper' },
        urgency: 'normal',
      };
    }
    if (hoursSinceSleep >= 4) {
      return {
        id: 'sleep-now',
        title: 'Sleep Window Opening',
        subtitle: `Awake for ${hoursSinceSleep}h — watch for cues`,
        icon: 'moon-outline',
        color: '#11998e',
        gradient: ['#11998e', '#38ef7d'] as [string, string],
        screen: 'UniversalTrackerHub',
        params: { type: 'sleep' },
        urgency: 'normal',
      };
    }

    return {
      id: 'all-good',
      title: 'All Caught Up!',
      subtitle: 'Everything looks good. Enjoy the moment',
      icon: 'checkmark-circle-outline',
      color: '#10b981',
      gradient: ['#10b981', '#34d399'] as [string, string],
      screen: 'UniversalTrackerHub',
      params: { type: 'note' },
      urgency: 'low',
    };
  }, [currentBaby, lastActivities]);

  if (!suggestion) return null;

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <TouchableOpacity
        onPress={() => onAction(suggestion.screen, suggestion.params)}
        activeOpacity={0.9}
        style={styles.nextActionContainer}
      >
        <LinearGradient
          colors={suggestion.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextActionGradient}
        >
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: WEEKLY PATTERN INSIGHT — Redesigned as Clean Bar Chart
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyPatternInsight: React.FC<{
  isDark: boolean;
  theme: any;
  activities: any[];
}> = React.memo(({ isDark, theme, activities }) => {
  const patterns = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    const data = last7Days.map(day => {
      const dayActivities = activities.filter((a: any) => {
        const aDate = new Date(a.timestamp);
        return isSameDay(aDate, day);
      });

      return {
        day: format(day, 'EEE'),
        fullDate: format(day, 'MMM d'),
        feeds: dayActivities.filter((a: any) => a.type === 'feed').length,
        sleep: dayActivities.filter((a: any) => a.type === 'sleep').length,
        diapers: dayActivities.filter((a: any) => a.type === 'diaper').length,
        total: dayActivities.length,
      };
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
                <Text style={[styles.patternDayLabel, { color: isToday ? theme.primary : theme.textMuted, fontWeight: isToday ? '700' : '500' }]}>
                  {day.day}
                </Text>
                {day.total > 0 && (
                  <Text style={[styles.patternDayCount, { color: theme.textSecondary }]}>{day.total}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: CATEGORIZED QUICK ACTIONS — Redesigned as Smooth Grid
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

  const columns = width >= 768 ? 4 : 4;
  const gap = 10;
  const margin = 20;
  const availableWidth = width - (margin * 2);
  const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

  return (
    <View>
      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabsScroll}
      >
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.key;
          const count = tab.key === 'all' ? actions.length : actions.filter(a => a.category === tab.key).length;

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveCategory(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.categoryTab,
                isActive && { backgroundColor: theme.primary },
                !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
              ]}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={13} 
                color={isActive ? '#fff' : theme.textSecondary} 
              />
              <Text style={[
                styles.categoryTabText,
                { color: isActive ? '#fff' : theme.textSecondary },
                isActive && { fontWeight: '700' },
              ]}>
                {tab.label}
              </Text>
              <View style={[
                styles.categoryTabBadge,
                isActive ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}>
                <Text style={[
                  styles.categoryTabBadgeText,
                  { color: isActive ? '#fff' : theme.textMuted },
                ]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Action Grid */}
      <View style={[styles.categorizedGrid, { gap, paddingHorizontal: margin }]}>
        {filteredActions.map((action, index) => (
          <Animated.View
            key={action.id}
            entering={FadeInUp.delay(index * 30).springify()}
            layout={Layout.springify()}
            style={[styles.categorizedGridItem, { width: itemWidth }]}
          >
            <TouchableOpacity
              onPress={() => onPress(action)}
              activeOpacity={0.8}
              style={styles.categorizedGridTouchable}
            >
              <LinearGradient
                colors={action.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.categorizedGridGradient}
              >
                <Ionicons name={action.iconName as any} size={22} color="#fff" />
              </LinearGradient>
              <Text style={[styles.categorizedGridLabel, { color: theme.text }]}>{action.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: VACCINATION REMINDERS SECTION
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
              <Ionicons name="medical-outline" size={16} color="#e11d48" />
            </View>
            <View>
              <Text style={[styles.vaccineTitle, { color: theme.text }]}>Vaccination Schedule</Text>
              <Text style={[styles.vaccineSubtitle, { color: theme.textMuted }]}>
                {activeReminders.length} upcoming
              </Text>
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
                  <Text style={[styles.vaccineName, { color: theme.text }]} numberOfLines={1}>
                    {reminder.vaccineName}
                  </Text>
                  <Text style={[styles.vaccineDose, { color: theme.textMuted }]}>
                    Dose {reminder.doseNumber}
                  </Text>
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 7: AI INSIGHTS CARD — GrowthDashboard Style Intelligence
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
    const todayCount = activities.filter((a: any) => isSameDay(new Date(a.timestamp), new Date())).length;
    const avgDaily = activities.length > 0 ? Math.round(activities.length / 7) : 0;

    const items = [];

    if (todayCount > avgDaily * 1.5) {
      items.push({
        id: 'active-day',
        icon: 'flame-outline',
        color: '#f59e0b',
        title: 'Super Active Day',
        message: `${todayCount} activities logged today — above average!`,
      });
    }

    if (ageMonths < 3) {
      items.push({
        id: 'newborn-tip',
        icon: 'bulb-outline',
        color: '#3b82f6',
        title: 'Newborn Tip',
        message: 'Feed every 2-3 hours. Watch for hunger cues like rooting.',
      });
    } else if (ageMonths >= 6 && ageMonths < 9) {
      items.push({
        id: 'solids-tip',
        icon: 'restaurant-outline',
        color: '#10b981',
        title: 'Starting Solids?',
        message: 'Introduce single-ingredient purees. Watch for allergies.',
      });
    }

    const sleepCount = activities.filter((a: any) => a.type === 'sleep' && isSameDay(new Date(a.timestamp), new Date())).length;
    if (sleepCount === 0 && new Date().getHours() > 14) {
      items.push({
        id: 'nap-reminder',
        icon: 'moon-outline',
        color: '#6366f1',
        title: 'Nap Check',
        message: 'No naps logged today. Most babies need 2-3 naps.',
      });
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
              <Ionicons name="sparkles" size={16} color={theme.primary} />
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 8: SMART NOTIFICATIONS — Redesigned as Clean List
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

  const visibleNotifs = expanded
    ? notifications.filter(n => !n.dismissed)
    : notifications.filter(n => !n.dismissed).slice(0, 2);

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
              <Ionicons name="notifications-outline" size={16} color={theme.primary} />
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
              style={[
                styles.smartNotificationCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                  borderLeftColor: notif.iconColor,
                  borderLeftWidth: 3,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderLeftWidth: 3,
                },
              ]}
              onPress={() => onAction(notif)}
              activeOpacity={0.8}
            >
              <View style={[styles.smartNotifIcon, { backgroundColor: `${notif.iconColor}12` }]}>
                <Ionicons name={getPriorityIcon(notif.priority) as any} size={16} color={notif.iconColor} />
              </View>
              <View style={styles.smartNotifContent}>
                <Text style={[styles.smartNotifTitle, { color: theme.text }]} numberOfLines={1}>{notif.title}</Text>
                <Text style={[styles.smartNotifMessage, { color: theme.textSecondary }]} numberOfLines={1}>
                  {notif.message}
                </Text>
                <View style={styles.smartNotifMeta}>
                  <Text style={[styles.smartNotifTime, { color: theme.textMuted }]}>
                    {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                  </Text>
                  {notif.actionLabel && (
                    <View style={[styles.smartNotifActionBadge, { backgroundColor: `${notif.iconColor}10` }]}>
                      <Text style={[styles.smartNotifActionText, { color: notif.iconColor }]}>{notif.actionLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => onDismiss(notif.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-outline" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED FEATURE CARDS — Horizontal Scroll, Clean SOLID cards (NO BLUR)
   ═══════════════════════════════════════════════════════════════════════════ */

const FeatureCardsRow: React.FC<{
  items: FeatureCard[];
  onPress: (item: FeatureCard) => void;
  isDark: boolean;
  theme: any;
}> = React.memo(({ items, onPress, isDark, theme }) => {
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featureCardsScroll}
        decelerationRate="fast"
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
            style={styles.featureCardTouchable}
          >
            <View style={[
              styles.featureCard, 
              { 
                borderColor: `${item.color}20`,
                backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff',
                ...DESIGN.shadow.sm
              }
            ]}>
              <View style={styles.featureCardTop}>
                <View style={[styles.featureCardIcon, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={18} color="#fff" />
                </View>
                {item.badge && (
                  <View style={[styles.featureCardBadge, { backgroundColor: item.badgeColor || item.color }]}>
                    <Text style={styles.featureCardBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.featureCardLabel, { color: theme.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.featureCardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>

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

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED RECENT ACTIVITY LIST — Clean, Compact (GrowthDashboard Style)
   ═══════════════════════════════════════════════════════════════════════════ */

const RecentActivityList: React.FC<{
  activities: any[];
  isDark: boolean;
  theme: any;
  onViewAll: () => void;
  onActivityPress: (activity: any) => void;
}> = React.memo(({ activities, isDark, theme, onViewAll, onActivityPress }) => {
  const [displayCount, setDisplayCount] = useState(5);
  const displayedActivities = activities.slice(0, displayCount);

  const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; emoji: string }> = {
    potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '💧' },
    feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
    sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
    growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
    medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
    milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🏆' },
    diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper', emoji: '👶' },
    note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
    pump: { icon: 'swap-horizontal-outline', color: '#8b5cf6', label: 'Pump', emoji: '🔄' },
    bath: { icon: 'water-outline', color: '#3b82f6', label: 'Bath', emoji: '🛁' },
    play: { icon: 'game-controller-outline', color: '#ec4899', label: 'Play', emoji: '🎮' },
    walk: { icon: 'walk-outline', color: '#10b981', label: 'Walk', emoji: '🚶' },
    temperature: { icon: 'thermometer-outline', color: '#f97316', label: 'Temp', emoji: '🌡️' },
    symptom: { icon: 'pulse-outline', color: '#ef4444', label: 'Symptom', emoji: '🤒' },
    default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '•' },
  };

  const formatTimeAgo = (timestamp: number): string => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!activities || activities.length === 0) {
    return (
      <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
        <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
        <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>No recent activity</Text>
        <TouchableOpacity style={[styles.addFirstActivityBtn, { backgroundColor: theme.primary }]} onPress={onViewAll}>
          <Text style={styles.addFirstActivityText}>Log First Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      {displayedActivities.map((event, index) => {
        const config = ACTIVITY_CONFIG[event?.type || event?.trackerId] || ACTIVITY_CONFIG.default;
        const isLast = index === displayedActivities.length - 1;

        return (
          <Animated.View
            key={event?.id || `activity-${index}`}
            entering={FadeInUp.delay(index * 40).springify()}
          >
            <TouchableOpacity
              onPress={() => onActivityPress(event)}
              style={styles.timelineItem}
              activeOpacity={0.7}
            >
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: config.color, borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]} />
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />}
              </View>

              <View style={[
                styles.timelineCard, 
                isDark && styles.timelineCardDark,
                { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
              ]}>
                <LinearGradient
                  colors={isDark ? ['rgba(55,55,75,0.50)', 'rgba(42,42,60,0.35)'] : ['rgba(255,255,255,0.80)', 'rgba(250,252,255,0.60)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                <View style={styles.timelineCardContent}>
                  <View style={styles.timelineCardHeader}>
                    <View style={[styles.timelineIconBg, { backgroundColor: config.color + '10' }]}>
                      <Text style={styles.timelineEmoji}>{config.emoji}</Text>
                    </View>
                    <View style={styles.timelineCardInfo}>
                      <Text style={[styles.timelineCardTitle, isDark && styles.textDark]} numberOfLines={1}>
                        {event?.title || event?.name || config.label}
                      </Text>
                      <Text style={[styles.timelineCardActor, isDark && styles.textMuted]}>
                        {formatTimeAgo(event?.timestamp)}
                        {event?.loggedByName ? ` • by ${event.loggedByName}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.timelineTypeBadge, { backgroundColor: config.color + '08' }]}>
                      <Text style={[styles.timelineTypeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                  </View>

                  {event?.details && (
                    <Text style={[styles.timelineCardDesc, isDark && styles.textMuted]} numberOfLines={2}>{event.details}</Text>
                  )}
                  {event?.notes && (
                    <Text style={[styles.timelineCardDesc, isDark && styles.textMuted]} numberOfLines={2}>{event.notes}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {displayCount < activities.length && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={() => setDisplayCount(prev => prev + 5)}>
          <Text style={[styles.loadMoreText, { color: theme.primary }]}>
            Load More ({activities.length - displayCount})
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
        <Text style={[styles.viewAllText, { color: theme.primary }]}>View All Activity</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SOUND MIXER SECTION — Compact, Embedded
   ═══════════════════════════════════════════════════════════════════════════ */

const SoundMixerSection: React.FC<{ onPress: () => void; isDark: boolean; theme: any }> = 
  React.memo(({ onPress, isDark, theme }) => {
    const { playTrack, currentTrack, isPlaying, togglePlayback } = useAudio();

    const handlePlayTrack = (track: typeof SOUND_TRACKS[0]) => {
      if (currentTrack?.id === track.id) togglePlayback();
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
                  {currentTrack && isPlaying ? `Playing: ${currentTrack.title}` : 'Tap to play soothing sounds'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.playAllButton, isPlaying && styles.playAllButtonActive]}
              onPress={(e) => { 
                e.stopPropagation(); 
                if (!currentTrack) playTrack(SOUND_TRACKS[0]); 
                else togglePlayback(); 
              }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
            </TouchableOpacity>
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
                      <Ionicons name={currentTrack?.id === item.id && isPlaying ? "pause" : "play"} size={12} color="#fff" />
                    </View>
                  </LinearGradient>
                  {currentTrack?.id === item.id && isPlaying && (
                    <View style={styles.playingIndicator}>
                      <View style={styles.bar} /><View style={[styles.bar, styles.barMiddle]} /><View style={styles.bar} />
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
   REFINED STICKY HEADER — GrowthDashboard Style with scroll animation
   ═══════════════════════════════════════════════════════════════════════════ */

interface StickyAppHeaderProps {
  isDark: boolean;
  currentBaby: any;
  onNotificationPress: () => void;
  onLockPress: () => void;
  onProfilePress: () => void;
  onBabyPress: () => void;
  onAddBabyPress: () => void;
  unreadCount: number;
  scrollY: Animated.SharedValue<number>;
  onSafetyCornerPress: () => void;
  primaryColor: string;
  fullTheme: any;
  fontSizeMultiplier: number;
  compactSpacing: boolean;
}

const StickyAppHeader: React.FC<StickyAppHeaderProps> = React.memo(({
  isDark,
  currentBaby,
  onNotificationPress,
  onLockPress,
  onProfilePress,
  onBabyPress,
  onAddBabyPress,
  unreadCount,
  scrollY,
  onSafetyCornerPress,
  primaryColor,
  fullTheme,
  fontSizeMultiplier,
  compactSpacing,
}) => {
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const currentY = scrollY.value;
    const translateY = interpolate(currentY, [0, 80, 140], [0, 0, -140], Extrapolate.CLAMP);
    const opacity = interpolate(currentY, [0, 80, 140], [1, 1, 0], Extrapolate.CLAMP);
    return { transform: [{ translateY }], opacity };
  });

  const headerPaddingTop = Platform.OS === 'ios' ? (compactSpacing ? 44 : 52) : (compactSpacing ? 28 : 36);
  const headerPaddingBottom = compactSpacing ? 8 : 12;
  const iconSize = Math.round(20 * fontSizeMultiplier);
  const titleSize = Math.round(18 * fontSizeMultiplier);
  const badgeSize = Math.round(16 * fontSizeMultiplier);
  const avatarSize = Math.round(36 * fontSizeMultiplier);

  const headerBg = isDark ? (fullTheme?.glassBg || 'rgba(26,26,42,0.96)') : (fullTheme?.glassBg || 'rgba(255,255,255,0.96)');
  const borderColor = isDark ? (fullTheme?.border || 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.04)';
  const textColor = isDark ? (fullTheme?.text || '#f0f0f7') : (fullTheme?.text || '#111827');

  return (
    <Animated.View
      style={[
        styles.stickyHeaderContainer,
        headerAnimatedStyle,
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

      <View style={[styles.stickyHeaderContent, { height: compactSpacing ? 40 : 48 }]}>
        {/* Left: Safety */}
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity
            style={[styles.safetyCornerBtn, { borderRadius: 10 }]}
            onPress={onSafetyCornerPress}
          >
            <LinearGradient
              colors={['#dc2626', '#ef4444']}
              style={[styles.safetyCornerGradient, { width: 34, height: 34, borderRadius: 10 }]}
            >
              <Ionicons name="shield-half-outline" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Center: Title */}
        <View style={styles.stickyHeaderCenter}>
          <Text style={[styles.stickyHeaderTitle, { color: textColor, fontSize: titleSize }]}>LittleLoom</Text>
          <View style={[styles.stickyHeaderUnderline, { backgroundColor: primaryColor, width: Math.round(28 * fontSizeMultiplier), height: Math.max(3, Math.round(3 * fontSizeMultiplier)), borderRadius: Math.max(1, Math.round(2 * fontSizeMultiplier)), marginTop: compactSpacing ? 2 : 3 }]} />
        </View>

        {/* Right: Actions */}
        <View style={styles.stickyHeaderRight}>
          <TouchableOpacity
            style={[styles.stickyHeaderIconBtn, { width: avatarSize + 2, height: avatarSize + 2, borderRadius: (avatarSize + 2) / 2 }]}
            onPress={onNotificationPress}
          >
            <Ionicons name="notifications-outline" size={iconSize} color={isDark ? '#fff' : primaryColor} />
            {unreadCount > 0 && (
              <View style={[styles.stickyHeaderBadge, { minWidth: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
                <Text style={[styles.stickyHeaderBadgeText, { fontSize: Math.round(10 * fontSizeMultiplier) }]}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {currentBaby ? (
            <TouchableOpacity 
              style={[styles.stickyHeaderBaby, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} 
              onPress={onBabyPress}
            >
              <SafeBabyAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={avatarSize} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.stickyHeaderIconBtn, { width: avatarSize + 2, height: avatarSize + 2, borderRadius: (avatarSize + 2) / 2 }]} 
              onPress={onAddBabyPress}
            >
              <Ionicons name="add-circle-outline" size={iconSize + 2} color={primaryColor} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.stickyHeaderLockBtn} onPress={onLockPress}>
            <LinearGradient
              colors={['#ff6b6b', '#ee5a5a']}
              style={[styles.stickyHeaderLockGradient, { width: avatarSize - 4, height: avatarSize - 4, borderRadius: (avatarSize - 4) / 2 }]}
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
   MAIN HOMESCREEN — COMPLETELY REDESIGNED with GrowthDashboard patterns
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();

  const {
    settings,
    themeColors,
    darkMode,
    triggerHaptic,
    fontSizeMultiplier,
    borderRadiusValue,
    shouldReduceMotion,
  } = useCustomization();

  const isDark = darkMode ?? (colorScheme === 'dark');
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const fullThemeColors = useMemo(() =>
    getFullThemeColors(settings.theme, settings.appearance, colorScheme === 'dark'),
    [settings.theme, settings.appearance, colorScheme]
  );

  const theme = useMemo(() => ({
    ...fullThemeColors,
    primary,
    secondary,
    accent,
  }), [fullThemeColors, primary, secondary, accent]);

  const scrollY = useSharedValue(0);

  const { userProfile, signOut, isLoading: authLoading } = useAuth();
  const { currentBaby, loadBabies, getPottyStreak } = useBaby();
  const { entries: activities, getRecentTimelineEvents, getTodayCount, loadEntries: loadActivities, isLoading: activitiesLoading } = useActivity();
  const { lockApp } = useSecurity();
  const { getUnreadCount } = useCommunity();
  const media = useMedia();

  const { success, error, confirm, toast } = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);

  // Smart notifications state
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);

  /* ── Load saved data ── */
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedNotifs = await AsyncStorage.getItem('@littleloom_smart_notifications');
        if (savedNotifs) {
          const parsed = JSON.parse(savedNotifs);
          if (Array.isArray(parsed)) setSmartNotifications(parsed);
        }
      } catch (err) {
        console.warn('Failed to load saved data:', err);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => { AsyncStorage.setItem('@littleloom_smart_notifications', JSON.stringify(smartNotifications)).catch(() => {}); }, [smartNotifications]);

  /* ── Generate smart notifications based on baby data ── */
  useEffect(() => {
    if (!currentBaby) return;
    const now = Date.now();
    const birthDate = currentBaby.birthDate ? new Date(currentBaby.birthDate) : null;
    const ageInDays = birthDate ? Math.floor((now - birthDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const notifications: SmartNotification[] = [];

    if (ageInDays >= 60 && ageInDays <= 75) {
      notifications.push({
        id: 'vaccine-dtap-1',
        type: 'vaccine',
        priority: 'urgent',
        title: 'DTaP Vaccine Due',
        message: `First DTaP dose is due for ${currentBaby.name}. Schedule within the next 2 weeks.`,
        actionScreen: 'VaccinationSchedule',
        actionLabel: 'View Schedule',
        icon: 'medical',
        iconColor: '#e11d48',
        bgColor: '#e11d48',
        timestamp: now,
      });
    }

    if (ageInDays >= 180 && ageInDays <= 190) {
      notifications.push({
        id: 'growth-6mo',
        type: 'growth',
        priority: 'high',
        title: '6-Month Growth Check',
        message: `Time to log ${currentBaby.name}'s 6-month growth measurements.`,
        actionScreen: 'GrowthDashboard',
        actionLabel: 'Log Growth',
        icon: 'trending-up',
        iconColor: '#10b981',
        bgColor: '#10b981',
        timestamp: now,
      });
    }

    const pottyStreak = getPottyStreak();
    if (pottyStreak > 0 && pottyStreak % 7 === 0) {
      notifications.push({
        id: `streak-${pottyStreak}`,
        type: 'streak',
        priority: 'normal',
        title: `${pottyStreak} Day Streak!`,
        message: `Amazing! You've kept a ${pottyStreak}-day tracking streak going.`,
        icon: 'flame',
        iconColor: '#f59e0b',
        bgColor: '#f59e0b',
        timestamp: now,
      });
    }

    const tips = [
      { title: 'Hydration Tip', message: 'Remember to track water intake for better feeding insights.', icon: 'water', color: '#3b82f6' },
      { title: 'Sleep Insight', message: 'Consistent bedtime routines improve sleep quality by 40%.', icon: 'moon', color: '#8b5cf6' },
      { title: 'Tummy Time', message: 'Aim for 30+ minutes of tummy time today for motor development.', icon: 'fitness', color: '#10b981' },
    ];
    const todayTip = tips[Math.floor(now / (1000 * 60 * 60 * 24)) % tips.length];
    notifications.push({
      id: `tip-${Math.floor(now / (1000 * 60 * 60 * 24))}`,
      type: 'tip',
      priority: 'low',
      title: todayTip.title,
      message: todayTip.message,
      icon: todayTip.icon,
      iconColor: todayTip.color,
      bgColor: todayTip.color,
      timestamp: now,
    });

    setSmartNotifications(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newNotifs = notifications.filter(n => !existingIds.has(n.id));
      return [...prev.filter(p => !p.dismissed), ...newNotifs].slice(-10);
    });
  }, [currentBaby?.id, currentBaby?.birthDate, currentBaby?.name, getPottyStreak]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(timer); };
  }, []);

  useEffect(() => {
    loadBabies();
    loadActivities();
  }, [loadBabies, loadActivities]);

  // Scroll handler for header animation (GrowthDashboard pattern)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
  // Direct screen names that exist in RootStackParamList
  const directScreens = new Set([
    'UniversalTrackerHub', 'Timeline', 'GrowthDashboard', 'Achievements',
    'TrackerReminders', 'SafetyCorner', 'Gallery', 'SoundMixer',
    'FamilySharing', 'FamilyChatList', 'HelpCenter', 'ContactSupport',
    'Profile', 'SwitchBaby', 'CreateBabyProfile', 'EditProfile',
    'VaccinationSchedule', 'Customize', 'Main', 'Onboarding',
    'Login', 'SignUp', 'ForgotPassword', 'AddEntry'
  ]);
  
  // If it's a direct screen name, navigate directly (most common case)
  if (directScreens.has(screenName)) {
    navigation.navigate(screenName as any, params || {});
    return;
  }
  
  // Otherwise look up in NAVIGATION_MAP for aliases
  const navConfig = NAVIGATION_MAP[screenName];
  if (!navConfig) {
    console.warn(`Navigation target "${screenName}" not found`);
    return;
  }
  
  if (navConfig.params?.screen) {
    navigation.navigate(navConfig.screen as any, {
      screen: navConfig.params.screen,
      params: { ...navConfig.params.params, ...params },
    });
  } else {
    navigation.navigate(navConfig.screen as any, { ...navConfig.params, ...params });
  }
}, [navigation]);

  const handleNotificationPress = useCallback(() => {
    triggerHaptic('light');
    setShowNotificationChooser(true);
  }, [triggerHaptic]);

  const handleNotificationSelect = useCallback((type: 'app' | 'community') => {
    if (type === 'app') navigateToScreen('Reminders');
    else navigateToScreen('Connect');
  }, [navigateToScreen]);

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
    const noBabyRequired = ['note', 'settings', 'family_chat', 'family_center', 'reminders', 'safety', 'gallery', 'sound'];
    if (!currentBaby && !noBabyRequired.includes(action.id)) {
      error('No Baby Profile', 'Please create a baby profile first.');
      return;
    }
    navigateToScreen(action.screen, action.params);
    success(`${action.label} Logged`, 'Activity recorded successfully!');
  }, [currentBaby, navigateToScreen, success, error, triggerHaptic]);

  const handleFeaturePress = useCallback((item: FeatureCard) => {
    triggerHaptic('light');
    navigateToScreen(item.screen, item.params);
  }, [navigateToScreen, triggerHaptic]);

  const handleLockPress = useCallback(async () => {
    triggerHaptic('heavy');
    await lockApp();
    toast('App Locked', 'LittleLoom has been secured.', 'info');
  }, [lockApp, toast, triggerHaptic]);

  const handleSmartNotifDismiss = useCallback((id: string) => {
    setSmartNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const handleSmartNotifAction = useCallback((notif: SmartNotification) => {
    triggerHaptic('light');
    if (notif.actionScreen) {
      navigateToScreen(notif.actionScreen as string, notif.actionParams);
    }
  }, [navigateToScreen, triggerHaptic]);

  const handleDailySummaryPress = useCallback((type: string) => {
    const typeMap: Record<string, string> = {
      feeds: 'feed',
      sleep: 'sleep',
      diapers: 'diaper',
      streak: 'potty',
    };
    navigateToScreen('UniversalTrackerHub', { type: typeMap[type] || type });
  }, [navigateToScreen]);

  const handleContextPress = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
    else if (hour >= 9 && hour < 12) navigateToScreen('UniversalTrackerHub', { type: 'play' });
    else if (hour >= 12 && hour < 15) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
    else if (hour >= 15 && hour < 18) navigateToScreen('UniversalTrackerHub', { type: 'walk' });
    else if (hour >= 18 && hour < 21) navigateToScreen('UniversalTrackerHub', { type: 'sleep' });
    else navigateToScreen('UniversalTrackerHub', { type: 'feed' });
  }, [navigateToScreen]);

  const handleNextAction = useCallback((screen: string, params?: any) => {
    navigateToScreen(screen, params);
  }, [navigateToScreen]);

  const handleActivityPress = useCallback((activity: any) => {
    navigation.navigate('Timeline', { type: activity.type });
  }, [navigation]);

  // Compute daily summary
  const dailySummary = useMemo((): DailySummary => {
    if (!currentBaby) return { feeds: 0, sleepHours: 0, diapers: 0, lastFeedTime: null, lastSleepTime: null };

    const todayActivities = activities.filter((a: any) => {
      const aDate = new Date(a.timestamp);
      return isSameDay(aDate, new Date());
    });

    const feeds = todayActivities.filter((a: any) => a.type === 'feed').length;
    const sleepEntries = todayActivities.filter((a: any) => a.type === 'sleep');
    const sleepHours = sleepEntries.reduce((sum: number, a: any) => sum + (a.duration || a.value || 0), 0) / 60;
    const diapers = todayActivities.filter((a: any) => a.type === 'diaper').length;

    const lastFeed = activities.filter((a: any) => a.type === 'feed').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
    const lastSleep = activities.filter((a: any) => a.type === 'sleep').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

    return {
      feeds,
      sleepHours,
      diapers,
      lastFeedTime: lastFeed ? new Date(lastFeed.timestamp) : null,
      lastSleepTime: lastSleep ? new Date(lastSleep.timestamp) : null,
    };
  }, [activities, currentBaby]);

  const allTimelineEvents = useMemo(() => {
    if (!currentBaby) return [];
    // Use activities from useActivity hook directly for real-time updates
    const timelineEvents = getRecentTimelineEvents(50, currentBaby.id);
    // Also include entries from useTracker if available
    return timelineEvents.length > 0 ? timelineEvents : activities.slice(0, 50);
  }, [currentBaby, getRecentTimelineEvents, activities]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);

  const activeSmartNotifications = useMemo(() =>
    smartNotifications.filter(n => !n.dismissed).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    [smartNotifications]
  );

  // Vaccination reminders
  const vaccinationReminders = useMemo((): VaccinationReminder[] => {
    if (!currentBaby?.birthDate) return [];
    const ageDays = differenceInDays(new Date(), new Date(currentBaby.birthDate));
    const reminders: VaccinationReminder[] = [];

    if (ageDays >= 42 && ageDays <= 60) {
      reminders.push({ id: 'dtap-1', vaccineName: 'DTaP (1st dose)', dueDate: new Date(Date.now() + (60 - ageDays) * 86400000), status: ageDays > 60 ? 'overdue' : 'upcoming', doseNumber: 1 });
    }
    if (ageDays >= 60 && ageDays <= 90) {
      reminders.push({ id: 'ipv-1', vaccineName: 'IPV (1st dose)', dueDate: new Date(Date.now() + (90 - ageDays) * 86400000), status: ageDays > 90 ? 'overdue' : 'upcoming', doseNumber: 1 });
    }
    if (ageDays >= 180 && ageDays <= 210) {
      reminders.push({ id: 'dtap-2', vaccineName: 'DTaP (2nd dose)', dueDate: new Date(Date.now() + (210 - ageDays) * 86400000), status: ageDays > 210 ? 'overdue' : 'upcoming', doseNumber: 2 });
    }

    return reminders;
  }, [currentBaby]);

  const bgColors = isDark
    ? [theme.background, '#0c0c18', '#12121e']
    : [theme.background, '#eef0f5', '#e4e8f0'];

  const scrollTopPadding = Platform.OS === 'ios'
    ? (settings.compactSpacing ? 110 : 130)
    : (settings.compactSpacing ? 100 : 115);

  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={[primary, '#764ba2', secondary]} style={styles.loadingGradient}>
          <Text style={[styles.loadingText, { fontSize: Math.round(32 * fontSizeMultiplier) }]}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (activitiesLoading && activities.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={bgColors} style={styles.backgroundGradient} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgColors} style={styles.backgroundGradient} />

      <StickyAppHeader
        isDark={isDark}
        currentBaby={currentBaby}
        onNotificationPress={handleNotificationPress}
        onLockPress={handleLockPress}
        onProfilePress={() => navigateToScreen('Profile')}
        onBabyPress={() => navigateToScreen('SwitchBaby')}
        onAddBabyPress={() => navigateToScreen('CreateBabyProfile')}
        unreadCount={unreadCommunityCount}
        scrollY={scrollY}
        onSafetyCornerPress={handleSafetyCornerPress}
        primaryColor={primary}
        fullTheme={fullThemeColors}
        fontSizeMultiplier={fontSizeMultiplier}
        compactSpacing={settings.compactSpacing}
      />

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: scrollTopPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
            colors={[primary, secondary]}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            GREETING & PARENT CARD — Compact, Elegant
           ═══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.springify()}>
          <GlassCard style={[styles.parentCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={[styles.parentHeader, { padding: settings.compactSpacing ? 14 : 18 }]}>
              <SafeParentAvatar
                avatar={userProfile?.avatar}
                name={userProfile?.fullName || 'Parent'}
                size={Math.round(52 * fontSizeMultiplier)}
                onPress={() => navigateToScreen('Profile')}
                showEditBadge={true}
              />
              <View style={styles.parentInfo}>
                <Text style={[styles.greetingText, { color: theme.textMuted, fontSize: Math.round(12 * fontSizeMultiplier) }]}>
                  {greeting}
                </Text>
                <Text style={[styles.parentName, { color: theme.text, fontSize: Math.round(18 * fontSizeMultiplier) }]}>
                  {userProfile?.fullName || 'Parent'}
                </Text>
                <View style={styles.parentMeta}>
                  <View style={[styles.verifiedBadge, { borderRadius: borderRadiusValue / 2 }]}>
                    <Ionicons name="shield-checkmark-outline" size={Math.round(11 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.verifiedText, { color: accent, fontSize: Math.round(10 * fontSizeMultiplier) }]}>Verified</Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textMuted, fontSize: Math.round(10 * fontSizeMultiplier) }]}>
                    {format(currentTime, 'EEEE, MMM d')}
                  </Text>
                </View>
              </View>
              <View style={styles.parentQuickLinks}>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${primary}12`, borderRadius: borderRadiusValue - 10 }]} 
                  onPress={() => navigateToScreen('AchievementsScreen')}
                >
                  <Ionicons name="ribbon-outline" size={Math.round(16 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${secondary}12`, borderRadius: borderRadiusValue - 10 }]} 
                  onPress={() => navigateToScreen('Connect')}
                >
                  <Ionicons name="sparkles-outline" size={Math.round(16 * fontSizeMultiplier)} color={secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════════
            BABY CARD — Sleek, Modern
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby ? (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(40).springify()}>
            <GlassCard style={[styles.babyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]}>
              <View style={[styles.babyHeader, { paddingHorizontal: settings.compactSpacing ? 14 : 18, paddingTop: settings.compactSpacing ? 10 : 14 }]}>
                <TouchableOpacity style={styles.babySelector} onPress={() => navigateToScreen('SwitchBaby')}>
                  <Text style={[styles.babySelectorLabel, { color: theme.textMuted, fontSize: Math.round(11 * fontSizeMultiplier) }]}>
                    Current Baby
                  </Text>
                  <Ionicons name="chevron-down-outline" size={Math.round(13 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.editButton, { borderRadius: borderRadiusValue / 2, backgroundColor: `${primary}08` }]} 
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                >
                  <Ionicons name="create-outline" size={Math.round(16 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.babyMainInfo, { padding: settings.compactSpacing ? 14 : 18 }]}>
                <SafeBabyAvatar
                  avatar={currentBaby.avatar}
                  gender={currentBaby.gender}
                  size={Math.round(64 * fontSizeMultiplier)}
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                  showBadge={true}
                />
                <View style={styles.babyDetails}>
                  <Text style={[styles.babyName, { color: theme.text, fontSize: Math.round(20 * fontSizeMultiplier) }]}>
                    {currentBaby.name}
                  </Text>
                  <Text style={[styles.babyAge, { color: theme.textSecondary, fontSize: Math.round(13 * fontSizeMultiplier) }]}>
                    {currentBaby.age}
                  </Text>
                  <View style={styles.babyStatus}>
                    <Ionicons name="pulse-outline" size={Math.round(11 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.babyStatusText, { color: accent, fontSize: Math.round(12 * fontSizeMultiplier) }]}>
                      Healthy & Active
                    </Text>
                  </View>
                </View>
                <LinearGradient colors={[secondary, '#fee140']} style={[styles.streakBadge, { borderRadius: borderRadiusValue }]}>
                  <Ionicons name="flame-outline" size={Math.round(13 * fontSizeMultiplier)} color="#fff" />
                  <Text style={[styles.streakText, { fontSize: Math.round(11 * fontSizeMultiplier) }]}>{getPottyStreak()}d</Text>
                </LinearGradient>
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(40).springify()}>
            <TouchableOpacity onPress={() => navigateToScreen('CreateBabyProfile')}>
              <GlassCard style={[styles.noBabyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]}>
                <LinearGradient colors={[primary, '#764ba2']} style={[styles.noBabyGradient, { borderRadius: borderRadiusValue }]}>
                  <Text style={[styles.noBabyEmoji, { fontSize: Math.round(44 * fontSizeMultiplier) }]}>👶</Text>
                  <Text style={[styles.noBabyTitle, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>Welcome to LittleLoom!</Text>
                  <Text style={[styles.noBabyText, { fontSize: Math.round(13 * fontSizeMultiplier) }]}>
                    Create your first baby profile to start tracking
                  </Text>
                  <View style={[styles.noBabyButton, { borderRadius: borderRadiusValue - 8 }]}>
                    <Text style={[styles.noBabyButtonText, { fontSize: Math.round(14 * fontSizeMultiplier) }]}>Get Started</Text>
                    <Ionicons name="arrow-forward-outline" size={Math.round(15 * fontSizeMultiplier)} color={primary} />
                  </View>
                </LinearGradient>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 1: DAILY SUMMARY WIDGET — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <DailySummaryWidget
              summary={dailySummary}
              isDark={isDark}
              theme={theme}
              onPress={handleDailySummaryPress}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 2: SMART CONTEXT CARD — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <SmartContextCard
              isDark={isDark}
              theme={theme}
              currentBaby={currentBaby}
              onPress={handleContextPress}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 3: NEXT BEST ACTION — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <NextBestAction
              isDark={isDark}
              theme={theme}
              currentBaby={currentBaby}
              lastActivities={allTimelineEvents}
              onAction={handleNextAction}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 6: VACCINATION REMINDERS
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && vaccinationReminders.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <VaccinationReminders
              reminders={vaccinationReminders}
              isDark={isDark}
              theme={theme}
              onPress={() => navigateToScreen('VaccinationSchedule')}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 7: AI INSIGHTS CARD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <AIInsightsCard
              isDark={isDark}
              theme={theme}
              currentBaby={currentBaby}
              activities={allTimelineEvents}
              onPress={() => navigateToScreen('GrowthDashboard')}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SMART NOTIFICATIONS — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        {activeSmartNotifications.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <SmartNotificationPanel
              notifications={activeSmartNotifications}
              onDismiss={handleSmartNotifDismiss}
              onAction={handleSmartNotifAction}
              isDark={isDark}
              theme={theme}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 5: CATEGORIZED QUICK ACTIONS — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(16 * fontSizeMultiplier) }]}>
                Quick Actions
              </Text>
            </View>
          </View>
          <CategorizedQuickActions
            actions={QUICK_ACTIONS}
            onPress={handleQuickAction}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FEATURE CARDS — Horizontal Scroll, Clean SOLID cards (NO BLUR)
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 10 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps-outline" size={Math.round(18 * fontSizeMultiplier)} color="#f59e0b" />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(16 * fontSizeMultiplier) }]}>
                Tools & Features
              </Text>
            </View>
          </View>
          <FeatureCardsRow
            items={FEATURE_CARDS}
            onPress={handleFeaturePress}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 4: WEEKLY PATTERN INSIGHT — Redesigned
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && activities.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <WeeklyPatternInsight
              isDark={isDark}
              theme={theme}
              activities={allTimelineEvents}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SOUND MIXER — Compact, Embedded
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.section, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
          <SectionHeader
            title="Sound Mixer"
            subtitle="White noise & lullabies"
            action={() => navigateToScreen('SoundMixer')}
            actionLabel="Full Mixer"
            icon="musical-notes-outline"
            theme={theme}
          />
          <SoundMixerSection onPress={() => navigateToScreen('SoundMixer')} isDark={isDark} theme={theme} />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            RECENT ACTIVITY — Clean, Compact (GrowthDashboard Style)
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={Math.round(18 * fontSizeMultiplier)} color={secondary} />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(16 * fontSizeMultiplier) }]}>
                Recent Activity
              </Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('Timeline', { type: 'all' })}>
              <Text style={[styles.seeAllText, { color: primary, fontSize: Math.round(13 * fontSizeMultiplier) }]}>View All</Text>
              <Ionicons name="arrow-forward-outline" size={Math.round(13 * fontSizeMultiplier)} color={primary} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            <RecentActivityList
              activities={allTimelineEvents}
              isDark={isDark}
              theme={theme}
              onViewAll={() => navigateToScreen('Timeline', { type: 'all' })}
              onActivityPress={handleActivityPress}
            />
          </View>
        </View>

        <View style={{ height: settings.compactSpacing ? 80 : 120 }} />
      </Animated.ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned, Smooth, Cohesive (NO BLUR CARDS)
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  /* ── Base ── */
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 24 },

  /* ── Loading States ── */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontWeight: '800', color: '#fff', marginBottom: 20 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  /* ── Sticky Header ── */
  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 16 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickyHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stickyHeaderCenter: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  stickyHeaderTitle: { fontWeight: '900', letterSpacing: -0.3 },
  stickyHeaderUnderline: { alignSelf: 'center' },
  stickyHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stickyHeaderIconBtn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stickyHeaderBadge: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderWidth: 2, borderColor: 'white' },
  stickyHeaderBadgeText: { color: 'white', fontWeight: 'bold' },
  stickyHeaderBaby: { overflow: 'hidden' },
  stickyHeaderLockBtn: { marginLeft: 4 },
  stickyHeaderLockGradient: { alignItems: 'center', justifyContent: 'center' },
  safetyCornerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  safetyCornerGradient: { alignItems: 'center', justifyContent: 'center' },

  /* ── Glass Card (NO BLUR — solid gradients) ── */
  glassCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, ...DESIGN.shadow.md },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* ── Parent Card ── */
  parentCard: { marginBottom: 12, marginTop: 16 },
  parentHeader: { flexDirection: 'row', alignItems: 'center' },
  parentInfo: { flex: 1, marginLeft: 14 },
  greetingText: { fontWeight: '500', marginBottom: 1 },
  parentName: { fontWeight: '800', letterSpacing: -0.5 },
  parentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 10 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(67,233,123,0.08)', paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  verifiedText: { fontWeight: '600' },
  timeText: { fontWeight: '500' },
  parentQuickLinks: { flexDirection: 'row', gap: 6 },
  parentQuickLink: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  /* ── Baby Card ── */
  babyCard: { marginBottom: 14 },
  babyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  babySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  babySelectorLabel: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  editButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  babyMainInfo: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  babyDetails: { flex: 1, marginLeft: 14 },
  babyName: { fontWeight: '800', letterSpacing: -0.5 },
  babyAge: { marginTop: 1, fontWeight: '500' },
  babyStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  babyStatusText: { fontWeight: '600' },
  streakBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { color: '#fff', fontWeight: '700' },

  /* ── No Baby Card ── */
  noBabyCard: { marginBottom: 14, overflow: 'hidden', marginTop: 16 },
  noBabyGradient: { padding: 28, alignItems: 'center' },
  noBabyEmoji: { marginBottom: 12 },
  noBabyTitle: { fontWeight: '800', color: '#fff', marginBottom: 6 },
  noBabyText: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 16 },
  noBabyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 20, gap: 6 },
  noBabyButtonText: { color: '#667eea', fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 1: DAILY SUMMARY WIDGET STYLES — Redesigned Grid
     ═══════════════════════════════════════════════════════════════════ */
  dailySummaryContainer: { marginBottom: 0 },
  dailySummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  dailySummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailySummaryIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dailySummaryTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  dailySummaryDate: { fontSize: 12, fontWeight: '500' },
  dailySummaryGrid: { flexDirection: 'row', gap: 8 },
  dailySummaryItem: { flex: 1, borderRadius: 16, overflow: 'hidden', aspectRatio: 0.85 },
  dailySummaryGradient: { padding: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  dailySummaryValue: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 6 },
  dailySummaryLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 3 },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 2: SMART CONTEXT CARD STYLES — Compact Pill
     ═══════════════════════════════════════════════════════════════════ */
  contextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 18, borderWidth: 1 },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  contextIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contextText: { flex: 1 },
  contextTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  contextMessage: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  contextActionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  contextActionText: { fontSize: 11, fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 3: NEXT BEST ACTION STYLES — Floating Banner
     ═══════════════════════════════════════════════════════════════════ */
  nextActionContainer: { borderRadius: 18, overflow: 'hidden' },
  nextActionGradient: { padding: 16 },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextActionIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  nextActionText: { flex: 1 },
  nextActionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  nextActionSubtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  nextActionArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  nextActionUrgency: { position: 'absolute', top: 10, right: 10 },
  urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 4: WEEKLY PATTERN STYLES — Clean Bar Chart
     ═══════════════════════════════════════════════════════════════════ */
  patternContainer: { borderRadius: 18, padding: 14, borderWidth: 1 },
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  patternTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patternIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  patternTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  patternSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  patternBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90, gap: 6 },
  patternDay: { flex: 1, alignItems: 'center', gap: 4 },
  patternBarContainer: { width: '100%', height: 60, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 6, overflow: 'hidden' },
  patternBar: { width: '100%', borderRadius: 6, minHeight: 3 },
  patternDayLabel: { fontSize: 10, fontWeight: '600' },
  patternDayCount: { fontSize: 9, fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 5: CATEGORIZED QUICK ACTIONS STYLES — Smooth Grid
     ═══════════════════════════════════════════════════════════════════ */
  categoryTabsScroll: { paddingHorizontal: 20, gap: 6, paddingBottom: 10 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  categoryTabText: { fontSize: 12, fontWeight: '600' },
  categoryTabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, minWidth: 18, alignItems: 'center' },
  categoryTabBadgeText: { fontSize: 9, fontWeight: '700' },
  categorizedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', paddingBottom: 6 },
  categorizedGridItem: { alignItems: 'center', marginBottom: 10 },
  categorizedGridTouchable: { alignItems: 'center', width: '100%' },
  categorizedGridGradient: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  categorizedGridLabel: { fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 6: VACCINATION REMINDERS STYLES
     ═══════════════════════════════════════════════════════════════════ */
  vaccineContainer: { borderRadius: 18, padding: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  vaccineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vaccineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vaccineIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vaccineTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  vaccineSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  vaccineSeeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  vaccineSeeAllText: { fontSize: 11, fontWeight: '700' },
  vaccineList: { gap: 0 },
  vaccineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  vaccineDot: { width: 8, height: 8, borderRadius: 4 },
  vaccineInfo: { flex: 1 },
  vaccineName: { fontSize: 13, fontWeight: '700' },
  vaccineDose: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  vaccineBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vaccineBadgeText: { fontSize: 10, fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 7: AI INSIGHTS STYLES
     ═══════════════════════════════════════════════════════════════════ */
  aiInsightsContainer: { borderRadius: 18, padding: 14, borderWidth: 1 },
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

  /* ── Feature Cards Row (SOLID — NO BLUR) ── */
  featureCardsScroll: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  featureCardTouchable: { width: 150 },
  featureCard: { borderRadius: 18, padding: 14, borderWidth: 1 },
  featureCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  featureCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureCardBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 26, alignItems: 'center' },
  featureCardBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  featureCardLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3, letterSpacing: -0.3 },
  featureCardDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  featureCardArrow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  featureCardArrowText: { fontSize: 11, fontWeight: '700' },

  /* ── Smart Notifications ── */
  notificationPanel: { marginBottom: 0, marginTop: 0 },
  notificationPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationPanelIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notificationPanelTitle: { fontSize: 15, fontWeight: '800' },
  urgentBadge: { backgroundColor: '#ef4444', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  urgentBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  expandBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  expandText: { fontSize: 12, fontWeight: '600' },
  smartNotificationCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 6 },
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
  soundMixerContainer: { borderRadius: 22, padding: 14, marginBottom: 6, marginHorizontal: 20, borderWidth: 1 },
  soundMixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  soundMixerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soundMixerIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  soundMixerTitleText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  soundMixerSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  playAllButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  playAllButtonActive: { backgroundColor: '#f59e0b' },
  trackCard: { width: 100, marginRight: 10 },
  trackImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 6, overflow: 'hidden' },
  trackOverlay: { flex: 1, justifyContent: 'flex-end', padding: 6 },
  trackPlayButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  trackPlayButtonActive: { backgroundColor: '#f59e0b' },
  trackTitle: { fontSize: 12, fontWeight: '600', marginBottom: 1 },
  trackArtist: { fontSize: 10, fontWeight: '500' },
  playingIndicator: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 6 },
  bar: { width: 2.5, height: 10, backgroundColor: '#1DB954', borderRadius: 1 },
  barMiddle: { height: 16 },

  /* ── Timeline Activity List (Borrowed from FamilySharing) ── */
  timelineContainer: { marginBottom: 0 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 0, bottom: -12, width: 2, left: 11 },
  timelineCard: { 
    flex: 1, 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)',
  },
  timelineCardDark: { 
    borderColor: 'rgba(255,255,255,0.06)',
  },
  timelineCardContent: { padding: 14, gap: 8 },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  timelineEmoji: { fontSize: 18 },
  timelineCardInfo: { flex: 1, gap: 2 },
  timelineCardTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  timelineCardActor: { fontSize: 11, fontWeight: '500' },
  timelineTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timelineTypeText: { fontSize: 10, fontWeight: '700' },
  timelineCardDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginLeft: 46 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateDark: { backgroundColor: 'rgba(30,30,35,0.5)' },
  emptyStateText: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  addFirstActivityBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  addFirstActivityText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  loadMoreButton: { marginTop: 14, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(102,126,234,0.06)' },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  viewAllButton: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  /* ── Section Headers ── */
  section: { marginTop: 6 },
  sectionFullWidth: { marginTop: 6, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.3 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontWeight: '600' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  sectionHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeaderActionText: { fontSize: 12, fontWeight: '700' },
});