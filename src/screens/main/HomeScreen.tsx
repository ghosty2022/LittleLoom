// screens/HomeScreen.tsx - Complete with Supabase Integration (FIXED IMPORTS)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Pressable,
  useColorScheme,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay, differenceInHours, differenceInDays, differenceInMonths } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Context Imports ──────────────────────────────────────────────────────
import { useCustomization } from '../../hooks/useCustomization';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useTracker } from '../../context/TrackerContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCommunity } from '../../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../../context/AudioContext';

// ─── Component Imports ──────────────────────────────────────────────────
import { SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

// ─── Types ──────────────────────────────────────────────────────────────
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

// ─── Supabase Service ──────────────────────────────────────────────────
import { supabase } from '../../services/supabase';
import { babyService } from '../../services/babyService';
import { activityService } from '../../services/activityService';
import { communityService } from '../../services/communityService';

const { width, height } = Dimensions.get('window');
const SCREEN_W = width;
const SCREEN_H = height;

const littleLoomLogo = require('../../../assets/logo.png');

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
}

interface VaccinationReminder {
  id: string;
  vaccineName: string;
  dueDate: Date;
  status: 'upcoming' | 'overdue' | 'completed';
  doseNumber: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION MAP — FIXED: Keys match actual screen names used in code
   ═══════════════════════════════════════════════════════════════════════════ */
const NAVIGATION_MAP: Record<string, { screen: keyof RootStackParamList; params?: Record<string, any> }> = {
  // Tab roots
  'Main': { screen: 'Main', params: {} },
  'Connect': { screen: 'Main', params: { screen: 'Connect' } },
  'More': { screen: 'More', params: {} },

  // Auth & Setup
  'Onboarding': { screen: 'Onboarding', params: {} },
  'Login': { screen: 'Login', params: {} },
  'SignUp': { screen: 'SignUp', params: {} },
  'ForgotPassword': { screen: 'ForgotPassword', params: {} },
  'CreateBabyProfile': { screen: 'CreateBabyProfile', params: {} },
  'SwitchBaby': { screen: 'SwitchBaby', params: {} },
  'AddParent': { screen: 'AddParent', params: {} },

  // Main screens
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
  'EditGuardian': { screen: 'EditGuardian', params: {} },
  'VaccinationSchedule': { screen: 'VaccinationSchedule', params: {} },
  'Customize': { screen: 'Customize', params: {} },
  'SecurityCenter': { screen: 'SecurityCenter', params: {} },
  'BiometricSetup': { screen: 'BiometricSetup', params: {} },
  'BackupRestore': { screen: 'BackupRestore', params: {} },
  'LanguageSettings': { screen: 'LanguageSettings', params: {} },
  'UnitSettings': { screen: 'UnitSettings', params: {} },
  'PrivacyPolicy': { screen: 'PrivacyPolicy', params: {} },
  'TermsOfService': { screen: 'TermsOfService', params: {} },
  'About': { screen: 'About', params: {} },
  'EntryDetail': { screen: 'EntryDetail', params: {} },
  'Insights': { screen: 'Insights', params: {} },
  'CreateCustomTracker': { screen: 'CreateCustomTracker', params: {} },

  // Legacy aliases (keep for backward compatibility)
  'Settings': { screen: 'Customize', params: {} },
  'UniversalTracker': { screen: 'UniversalTrackerHub', params: {} },
  'Reminders': { screen: 'TrackerReminders', params: {} },
  'Grow': { screen: 'GrowthDashboard', params: {} },
  'AchievementsScreen': { screen: 'Achievements', params: {} },
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATA — Quick Actions with Categories
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
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS — All components defined below
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Glass Card ──────────────────────────────────────────────────────────
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
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    );
  });
GlassCard.displayName = 'GlassCard';

// ─── Section Header ──────────────────────────────────────────────────────
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
      {icon && <Ionicons name={icon as any} size={20} color={theme.primary} style={{ marginRight: 10 }} />}
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
SectionHeader.displayName = 'SectionHeader';

// ─── Daily Summary Widget ───────────────────────────────────────────────
const DailySummaryWidget: React.FC<{
  summary: DailySummary;
  isDark: boolean;
  theme: any;
  onPress: (type: string) => void;
  streakDays: number;
}> = React.memo(({ summary, isDark, theme, onPress, streakDays }) => {
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
      value: streakDays + 'd',
      sublabel: streakDays > 0 ? 'Keep it up!' : 'Start tracking!',
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

// ─── Smart Context Card ─────────────────────────────────────────────────
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

// ─── Next Best Action ───────────────────────────────────────────────────
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

// ─── Weekly Pattern Insight ─────────────────────────────────────────────
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

// ─── Categorized Quick Actions ──────────────────────────────────────────
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
  const availableWidth = width - (margin * 2);
  const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

  return (
    <View>
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

      <View style={[styles.categorizedGrid, { gap, paddingHorizontal: margin }]}>
        {filteredActions.map((action, index) => (
          <Animated.View
            key={action.id}
            entering={FadeInUp.delay(index * 30).springify()}
            style={[styles.categorizedGridItem, { width: itemWidth }]}
          >
           <TouchableOpacity
              onPress={() => onPress(action)}
              activeOpacity={1}
              style={styles.categorizedGridTouchable}
            >
              <View style={{ width: '100%', aspectRatio: 1, position: 'relative' }}>
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.categorizedGridGradient, { width: '100%', height: '100%' }]}
                >
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

// ─── Vaccination Reminders ──────────────────────────────────────────────
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

// ─── AI Insights Card ──────────────────────────────────────────────────
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

// ─── Smart Notification Panel ──────────────────────────────────────────
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

// ─── Feature Cards Row ──────────────────────────────────────────────────
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
              }
            ]}>
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

// ─── Recent Activity List ──────────────────────────────────────────────
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

// ─── Sound Mixer Section ──────────────────────────────────────────────
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

// ─── Sticky App Header ──────────────────────────────────────────────────
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
  onSettingsPress: () => void;
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
  onSettingsPress,
  primaryColor,
  fullTheme,
  fontSizeMultiplier,
  compactSpacing,
}) => {
  const headerPaddingTop = Platform.OS === 'ios' ? (compactSpacing ? 44 : 52) : (compactSpacing ? 28 : 36);
  const headerPaddingBottom = compactSpacing ? 8 : 12;
  const titleSize = Math.round(22 * fontSizeMultiplier);

  const headerBg = isDark ? (fullTheme?.glassBg || 'rgba(26,26,42,0.96)') : (fullTheme?.glassBg || 'rgba(255,255,255,0.96)');
  const borderColor = isDark ? (fullTheme?.border || 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.04)';
  const textColor = isDark ? (fullTheme?.text || '#f0f0f7') : (fullTheme?.text || '#111827');

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
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity
            style={[styles.safetyCornerBtn, { borderRadius: 10 }]}
            onPress={onSafetyCornerPress}
          >
            <LinearGradient
              colors={['#dc2626', '#ef4444']}
              style={[styles.safetyCornerGradient, { width: Math.round(34 * fontSizeMultiplier), height: Math.round(34 * fontSizeMultiplier), borderRadius: 12 }]}
            >
              <Ionicons name="shield-checkmark-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.stickyHeaderCenter}>
          <View style={styles.logoFloatWrap}>
            <Image 
              source={littleLoomLogo} 
              style={[
                styles.headerLogoImage, 
                { 
                  width: Math.round(56 * fontSizeMultiplier), 
                  height: Math.round(56 * fontSizeMultiplier),
                }
              ]} 
              resizeMode="contain" 
            />
            <View style={styles.logoTextColumn}>
              <Text style={[styles.stickyHeaderTitle, { color: textColor, fontSize: titleSize }]}>LittleLoom</Text>
              <View style={[styles.stickyHeaderUnderline, { backgroundColor: primaryColor, width: Math.round(34 * fontSizeMultiplier), height: Math.max(3, Math.round(3 * fontSizeMultiplier)), borderRadius: Math.max(2, Math.round(2 * fontSizeMultiplier)), marginTop: compactSpacing ? 3 : 4 }]} />
            </View>
          </View>
        </View>

        <View style={[styles.stickyHeaderRight, { gap: 10 }]}>
          <TouchableOpacity
            style={[styles.stickyHeaderIconBtn, { width: Math.round(36 * fontSizeMultiplier), height: Math.round(36 * fontSizeMultiplier), borderRadius: Math.round(18 * fontSizeMultiplier) }]}
            onPress={onNotificationPress}
          >
            <Ionicons name="notifications-outline" size={Math.round(17 * fontSizeMultiplier)} color={isDark ? '#fff' : primaryColor} />
            {unreadCount > 0 && (
              <View style={[styles.stickyHeaderBadge, { minWidth: Math.round(14 * fontSizeMultiplier), height: Math.round(14 * fontSizeMultiplier), borderRadius: Math.round(7 * fontSizeMultiplier) }]}>
                <Text style={[styles.stickyHeaderBadgeText, { fontSize: Math.round(9 * fontSizeMultiplier) }]}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stickyHeaderIconBtn, { width: Math.round(36 * fontSizeMultiplier), height: Math.round(36 * fontSizeMultiplier), borderRadius: Math.round(18 * fontSizeMultiplier) }]}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={Math.round(17 * fontSizeMultiplier)} color={isDark ? '#fff' : primaryColor} />
          </TouchableOpacity>

          {currentBaby ? (
            <TouchableOpacity 
              style={[styles.stickyHeaderBaby, { width: Math.round(36 * fontSizeMultiplier), height: Math.round(36 * fontSizeMultiplier), borderRadius: Math.round(18 * fontSizeMultiplier) }]} 
              onPress={onBabyPress}
            >
              <SafeBabyAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={Math.round(30 * fontSizeMultiplier)} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.stickyHeaderIconBtn, { width: Math.round(32 * fontSizeMultiplier), height: Math.round(32 * fontSizeMultiplier), borderRadius: Math.round(16 * fontSizeMultiplier) }]} 
              onPress={onAddBabyPress}
            >
              <Ionicons name="add-circle-outline" size={Math.round(19 * fontSizeMultiplier)} color={primaryColor} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.stickyHeaderLockBtn} onPress={onLockPress}>
            <LinearGradient
              colors={['#ff6b6b', '#ee5a5a']}
              style={[styles.stickyHeaderLockGradient, { width: Math.round(32 * fontSizeMultiplier), height: Math.round(32 * fontSizeMultiplier), borderRadius: Math.round(16 * fontSizeMultiplier) }]}
            >
              <Ionicons name="lock-closed-outline" size={Math.round(12 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOMESCREEN — COMPLETE WITH SUPABASE INTEGRATION
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();

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
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const theme = useMemo(() => ({
    text: isDark ? '#f0f0f7' : '#1a1a1a',
    textSecondary: isDark ? '#a0a0b0' : '#4b5563',
    textMuted: isDark ? '#888' : '#6b7280',
    background: isDark ? '#0a0a0a' : '#f8faff',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    ...((fullThemeColors && typeof fullThemeColors === 'object') ? fullThemeColors : {}),
    primary,
    secondary,
    accent,
  }), [fullThemeColors, primary, secondary, accent, isDark]);

  const scrollY = useSharedValue(0);

  // ─── Context Hooks ────────────────────────────────────────────────────
  const { userProfile, signOut, isLoading: authLoading } = useAuth();
  const {
    currentBaby,
    loadBabies,
    getPottyStreak,
    growthData,
    milestones,
    getGrowthData,
    getLatestMeasurements,
    getTodaySleepCount,
    getTodayFeedCount,
    getTodayPottyCount,
  } = useBaby();
  const { entries: activities, getRecentTimelineEvents, getTodayCount, loadEntries: loadActivities, isLoading: activitiesLoading } = useActivity();
  const { entries } = useTracker();
  const { lockApp, getAvailableAuthMethods } = useSecurity();
  const { getUnreadCount } = useCommunity();

  const { success, error, confirm, toast } = useSweetAlert();

  // ─── Local State ──────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Load Saved Data ──────────────────────────────────────────────────
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

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_smart_notifications', JSON.stringify(smartNotifications)).catch(() => {});
  }, [smartNotifications]);

  // ─── Generate Smart Notifications ────────────────────────────────────
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

  // ─── Greeting Timer ──────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(timer); };
  }, []);

  // ─── Supabase Data Loading ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load babies from Supabase
      await loadBabies();
      
      // Load activities from Supabase
      await loadActivities();
      
      // Get community notifications count
      await getUnreadCount();
      
      // Get growth data
      if (currentBaby?.id) {
        await getGrowthData('weight');
        await getGrowthData('height');
        await getGrowthData('head');
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      error('Loading Error', 'Could not load your data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadBabies, loadActivities, getUnreadCount, getGrowthData, currentBaby?.id, error]);

  // ─── Initial Load ────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, []);

  // ─── Focus Refresh ──────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      // Refresh data when screen comes into focus
      loadData();
    }, [loadData])
  );

  // ─── Scroll Handler ──────────────────────────────────────────────────
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // ─── Navigation Helper ──────────────────────────────────────────────
  const DIRECT_SCREENS = new Set([
    'UniversalTrackerHub', 'Timeline', 'GrowthDashboard', 'Achievements',
    'TrackerReminders', 'SafetyCorner', 'Gallery', 'SoundMixer',
    'FamilySharing', 'FamilyChatList', 'HelpCenter', 'ContactSupport',
    'Profile', 'SwitchBaby', 'CreateBabyProfile', 'EditProfile',
    'VaccinationSchedule', 'Customize', 'Main', 'Onboarding',
    'Login', 'SignUp', 'ForgotPassword', 'AddEntry', 'AddParent',
    'EditGuardian', 'SecurityCenter', 'BiometricSetup', 'BackupRestore',
    'LanguageSettings', 'UnitSettings', 'PrivacyPolicy', 'TermsOfService',
    'About', 'EntryDetail', 'Insights', 'CreateCustomTracker', 'More'
  ]);

  const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
    if (DIRECT_SCREENS.has(screenName)) {
      navigation.navigate(screenName as any, params || {});
      return;
    }
    
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

  // ─── Action Handlers ─────────────────────────────────────────────────
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
      await loadData();
      success('Refreshed!', 'Your dashboard is up to date.');
    } catch (err) {
      error('Refresh Failed', 'Could not update dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadData, success, error]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    triggerHaptic('medium');
    const noBabyRequired = ['settings'];
    if (!currentBaby && !noBabyRequired.includes(action.id)) {
      setPendingAction(action);
      setShowBabyRequiredModal(true);
      return;
    }
    navigateToScreen(action.screen, action.params);
  }, [currentBaby, navigateToScreen, triggerHaptic]);

  const handleFeaturePress = useCallback((item: FeatureCard) => {
    triggerHaptic('light');
    const babyRequiredFeatures = new Set([
      'growth', 'milestones', 'reminders', 'family', 'gallery', 'chat', 'vaccine', 'sound'
    ]);
    if (!currentBaby && babyRequiredFeatures.has(item.id)) {
      setPendingAction({
        id: item.id,
        label: item.label,
        icon: '',
        iconName: item.icon,
        color: item.color,
        gradient: [item.color, item.color] as [string, string],
        screen: item.screen,
        params: item.params,
        category: 'tools',
      });
      setShowBabyRequiredModal(true);
      return;
    }
    navigateToScreen(item.screen, item.params);
  }, [currentBaby, navigateToScreen, triggerHaptic]);

  const handleLockPress = useCallback(async () => {
    triggerHaptic('heavy');
    const methods = getAvailableAuthMethods();
    if (!methods.hasPin && !methods.hasBiometric) {
      setShowSecurityModal(true);
      return;
    }
    await lockApp();
    toast('App Locked', 'LittleLoom has been secured.', 'info');
  }, [lockApp, getAvailableAuthMethods, toast, triggerHaptic]);

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
    if (!currentBaby) {
      setPendingAction({ id: 'summary', label: 'Daily Summary', icon: '', iconName: 'today-outline', color: '#667eea', gradient: ['#667eea', '#667eea'] as [string, string], screen: 'UniversalTrackerHub', params: {}, category: 'daily' });
      setShowBabyRequiredModal(true);
      return;
    }
    const typeMap: Record<string, string> = {
      feeds: 'feed',
      sleep: 'sleep',
      diapers: 'diaper',
      streak: 'potty',
    };
    navigateToScreen('UniversalTrackerHub', { type: typeMap[type] || type });
  }, [currentBaby, navigateToScreen]);

  const handleContextPress = useCallback(() => {
    if (!currentBaby) {
      setPendingAction({ id: 'context', label: 'Smart Context', icon: '', iconName: 'partly-sunny-outline', color: '#f59e0b', gradient: ['#f59e0b', '#f59e0b'] as [string, string], screen: 'UniversalTrackerHub', params: {}, category: 'daily' });
      setShowBabyRequiredModal(true);
      return;
    }
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
    else if (hour >= 9 && hour < 12) navigateToScreen('UniversalTrackerHub', { type: 'play' });
    else if (hour >= 12 && hour < 15) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
    else if (hour >= 15 && hour < 18) navigateToScreen('UniversalTrackerHub', { type: 'walk' });
    else if (hour >= 18 && hour < 21) navigateToScreen('UniversalTrackerHub', { type: 'sleep' });
    else navigateToScreen('UniversalTrackerHub', { type: 'feed' });
  }, [currentBaby, navigateToScreen]);

  const handleNextAction = useCallback((screen: string, params?: any) => {
    if (!currentBaby) {
      setPendingAction({ id: 'next-action', label: 'Next Best Action', icon: '', iconName: 'flash-outline', color: '#fa709a', gradient: ['#fa709a', '#fa709a'] as [string, string], screen: screen as any, params: params || {}, category: 'daily' });
      setShowBabyRequiredModal(true);
      return;
    }
    navigateToScreen(screen, params);
  }, [currentBaby, navigateToScreen]);

  const handleActivityPress = useCallback((activity: any) => {
    if (!currentBaby) {
      setPendingAction({ id: 'activity', label: 'Activity Details', icon: '', iconName: 'time-outline', color: secondary, gradient: [secondary, secondary] as [string, string], screen: 'Timeline', params: { type: activity.type }, category: 'daily' });
      setShowBabyRequiredModal(true);
      return;
    }
    navigation.navigate('Timeline', { type: activity.type });
  }, [currentBaby, navigation, secondary]);

  // ─── Computed Values ──────────────────────────────────────────────────
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

  const growthStats = useMemo(() => {
    if (!currentBaby) return null;
    const result: Record<string, any> = {};
    const types = ['height', 'weight', 'head'] as const;

    types.forEach((type) => {
      const data = getGrowthData(type as any).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const current = data[0];
      const prev = data[1];
      if (current) {
        result[type] = {
          value: Number(current.value).toFixed(1),
          unit: current.unit,
          change: prev ? Number(current.value - prev.value).toFixed(1) : undefined,
          date: current.date,
        };
      }
    });

    if (result.height && result.weight) {
      const h = parseFloat(result.height.value) / 100;
      const w = parseFloat(result.weight.value);
      result.bmi = {
        value: (w / (h * h)).toFixed(1),
        unit: '',
      };
    }
    return result;
  }, [growthData, currentBaby, getGrowthData]);

  const allTimelineEvents = useMemo(() => {
    if (!currentBaby) return [];
    const trackerEntries = (entries || []).filter((e: any) => e?.timestamp).sort((a: any, b: any) => b.timestamp - a.timestamp);
    const activityEvents = getRecentTimelineEvents(50, currentBaby.id);
    const merged = [...trackerEntries];
    activityEvents.forEach((ae: any) => {
      if (!merged.find((me: any) => me.id === ae.id)) merged.push(ae);
    });
    return merged.slice(0, 50).sort((a: any, b: any) => (b?.timestamp || 0) - (a?.timestamp || 0));
  }, [currentBaby, entries, getRecentTimelineEvents, activities]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);

  const activeSmartNotifications = useMemo(() =>
    smartNotifications.filter(n => !n.dismissed).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    [smartNotifications]
  );

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

  // ─── Loading State ──────────────────────────────────────────────────
  if (authLoading || isLoading) {
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

  // ─── Render ──────────────────────────────────────────────────────────
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
        onSettingsPress={() => navigateToScreen('More')}
        primaryColor={primary}
        fullTheme={fullThemeColors || {}}
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
            GREETING & PARENT CARD
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
                  onPress={() => navigateToScreen('Achievements')}
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
            BABY CARD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby ? (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(40).springify()}>
            <GlassCard style={[styles.babyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]}>
              <View style={[styles.babyHeader, { paddingHorizontal: settings.compactSpacing ? 14 : 18, paddingTop: settings.compactSpacing ? 10 : 14 }]}>
                <TouchableOpacity style={styles.babySelector} onPress={() => navigateToScreen('SwitchBaby', { returnTo: 'Main' })}>
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
            GROWTH SNAPSHOT KPIs
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && growthStats && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
            <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20, marginTop: 6 }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="pulse-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
                <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(16 * fontSizeMultiplier) }]}>
                  Growth Snapshot
                </Text>
              </View>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('GrowthDashboard')}>
                <Text style={[styles.seeAllText, { color: primary, fontSize: Math.round(13 * fontSizeMultiplier) }]}>Full Dashboard</Text>
                <Ionicons name="arrow-forward-outline" size={Math.round(13 * fontSizeMultiplier)} color={primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.kpiGrid, { paddingHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }]}>
              {[
                { key: 'height', title: 'Height', icon: '📏', color: '#6366f1', unit: 'cm' },
                { key: 'weight', title: 'Weight', icon: '⚖️', color: '#ec4899', unit: 'kg' },
                { key: 'head', title: 'Head', icon: '🧠', color: '#06b6d4', unit: 'cm' },
                { key: 'bmi', title: 'BMI', icon: '📊', color: '#f59e0b', unit: '' },
              ].map((m) => {
                const s = growthStats?.[m.key];
                if (!s) return null;
                const changeNum = s.change ? parseFloat(s.change) : 0;
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => navigateToScreen('GrowthDashboard')}
                    activeOpacity={0.85}
                    style={[
                      styles.kpiHomeCard,
                      {
                        backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
                        borderColor: m.color + '20',
                      },
                    ]}
                  >
                    <View style={[styles.kpiHomeIconBg, { backgroundColor: m.color + '12' }]}>
                      <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                    </View>
                    <View style={styles.kpiHomeBody}>
                      <Text
                        style={[styles.kpiHomeValue, { color: theme.text, fontSize: Math.round(20 * fontSizeMultiplier) }]}
                        numberOfLines={1}
                      >
                        {s.value}
                      </Text>
                      <Text style={[styles.kpiHomeUnit, { color: m.color, fontSize: Math.round(11 * fontSizeMultiplier) }]}>
                        {m.unit || '—'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.kpiHomeTitle,
                        { color: theme.textSecondary, fontSize: Math.round(11 * fontSizeMultiplier) },
                      ]}
                    >
                      {m.title}
                    </Text>
                    {s.change !== undefined && (
                      <View style={styles.kpiHomeChangeRow}>
                        <Ionicons
                          name={changeNum >= 0 ? 'trending-up' : 'trending-down'}
                          size={10}
                          color={changeNum >= 0 ? '#10b981' : '#ef4444'}
                        />
                        <Text
                          style={[
                            styles.kpiHomeChange,
                            {
                              color: changeNum >= 0 ? '#10b981' : '#ef4444',
                              fontSize: Math.round(10 * fontSizeMultiplier),
                            },
                          ]}
                        >
                          {changeNum > 0 ? '+' : ''}
                          {s.change}
                          {m.unit}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            DAILY SUMMARY WIDGET
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <DailySummaryWidget
              summary={dailySummary}
              isDark={isDark}
              theme={theme}
              onPress={handleDailySummaryPress}
              streakDays={getPottyStreak()}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SMART CONTEXT CARD
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
            NEXT BEST ACTION
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
            VACCINATION REMINDERS
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && vaccinationReminders.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <VaccinationReminders
              reminders={vaccinationReminders}
              isDark={isDark}
              theme={theme}
              onPress={() => {
                if (!currentBaby) {
                  setPendingAction({ id: 'vaccine', label: 'Vaccination Schedule', icon: '', iconName: 'medical-outline', color: '#e11d48', gradient: ['#e11d48', '#e11d48'] as [string, string], screen: 'VaccinationSchedule', params: {}, category: 'health' });
                  setShowBabyRequiredModal(true);
                  return;
                }
                navigateToScreen('VaccinationSchedule');
              }}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AI INSIGHTS CARD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 14 }}>
            <AIInsightsCard
              isDark={isDark}
              theme={theme}
              currentBaby={currentBaby}
              activities={allTimelineEvents}
              onPress={() => {
                if (!currentBaby) {
                  setPendingAction({ id: 'insights', label: 'AI Insights', icon: '', iconName: 'sparkles', color: theme.primary, gradient: [theme.primary, theme.primary] as [string, string], screen: 'GrowthDashboard', params: {}, category: 'tools' });
                  setShowBabyRequiredModal(true);
                  return;
                }
                navigateToScreen('GrowthDashboard');
              }}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SMART NOTIFICATIONS
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
            CATEGORIZED QUICK ACTIONS
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
            actions={QUICK_ACTIONS.map((a) => {
              let badgeCount: number | undefined;
              let badgeLabel: string | undefined;
              if (a.id === 'feed') badgeCount = getTodayFeedCount();
              if (a.id === 'sleep') badgeCount = getTodaySleepCount();
              if (a.id === 'diaper') badgeCount = getTodayPottyCount();
              if (a.id === 'potty') badgeCount = getTodayPottyCount();
              if (a.id === 'growth' && growthStats?.height) badgeLabel = growthStats.height.value + 'cm';
              if (a.id === 'growth' && growthStats?.weight && !badgeLabel) badgeLabel = growthStats.weight.value + 'kg';
              return { ...a, badgeCount, badgeLabel };
            })}
            onPress={handleQuickAction}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FEATURE CARDS
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
            items={FEATURE_CARDS.map((f) => {
              if (f.id === 'growth' && growthStats?.height) return { ...f, badge: growthStats.height.value + 'cm', badgeColor: '#10b981' };
              if (f.id === 'milestones') return { ...f, badge: milestones.length + ' Total', badgeColor: '#ec4899' };
              if (f.id === 'vaccine') return { ...f, badge: vaccinationReminders.filter((r) => r.status !== 'completed').length + ' Due', badgeColor: '#e11d48' };
              if (f.id === 'gallery') return { ...f, badge: (currentBaby?.photos || 0) + '', badgeColor: '#8b5cf6' };
              if (f.id === 'chat') return { ...f, badge: unreadCommunityCount > 0 ? unreadCommunityCount + ' New' : undefined, badgeColor: '#06b6d4' };
              if (f.id === 'sound') return { ...f, badge: undefined, badgeColor: undefined };
              return f;
            })}
            onPress={handleFeaturePress}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            WEEKLY PATTERN INSIGHT
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
            SOUND MIXER
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
            RECENT ACTIVITY
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
              onViewAll={() => {
                if (!currentBaby) {
                  setPendingAction({ id: 'timeline', label: 'Timeline', icon: '', iconName: 'time-outline', color: secondary, gradient: [secondary, secondary] as [string, string], screen: 'Timeline', params: { type: 'all' }, category: 'daily' });
                  setShowBabyRequiredModal(true);
                  return;
                }
                navigateToScreen('Timeline', { type: 'all' });
              }}
              onActivityPress={handleActivityPress}
            />
          </View>
        </View>

        <View style={{ height: settings.compactSpacing ? 80 : 120 }} />
      </Animated.ScrollView>

      {/* Notification Chooser Modal */}
      <Modal
        visible={showNotificationChooser}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationChooser(false)}
      >
        <Pressable
          style={styles.notificationModalOverlay}
          onPress={() => setShowNotificationChooser(false)}
        >
          <View style={[styles.notificationModalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.notificationModalHeader}>
              <Text style={[styles.notificationModalTitle, { color: theme.text }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.notificationModalOption}
              onPress={() => {
                setShowNotificationChooser(false);
                navigateToScreen('TrackerReminders');
              }}
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
              onPress={() => {
                setShowNotificationChooser(false);
                navigateToScreen('Connect');
              }}
            >
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${theme.secondary}15` }]}>
                <Ionicons name="people" size={20} color={theme.secondary} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>Community</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Loom mentions, replies & follows</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notificationModalOption}
              onPress={() => {
                setShowNotificationChooser(false);
                toast('Cleared', 'All notification badges reset', 'success');
              }}
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

      {/* Baby Required Modal */}
      <Modal
        visible={showBabyRequiredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBabyRequiredModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBabyRequiredModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.modalIconWrap}>
              <LinearGradient colors={[secondary, primary]} style={styles.modalIconGradient}>
                <Ionicons name="people-outline" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Create a baby profile to start tracking {pendingAction?.label || 'activities'} and unlock all features.
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: primary }]}
              onPress={() => {
                setShowBabyRequiredModal(false);
                navigateToScreen('CreateBabyProfile');
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => setShowBabyRequiredModal(false)}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: theme.textMuted }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Security Setup Modal */}
      <Modal
        visible={showSecurityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSecurityModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${accent}15` }]}>
              <Ionicons name="shield-outline" size={32} color={accent} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>No Security Enabled</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              You haven't set up a PIN or biometric lock yet. You can still lock the app, but anyone can unlock it.
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: primary }]}
              onPress={() => {
                setShowSecurityModal(false);
                navigateToScreen('SecurityCenter', { mode: 'setup' });
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Set Up Security</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSecondaryBtn, { borderColor: `${primary}30`, borderWidth: 1 }]}
              onPress={async () => {
                setShowSecurityModal(false);
                await lockApp(true);
                toast('App Locked', 'Locked without security. Tap unlock to enter.', 'warning');
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
   STYLES — Complete Styles (Keep your existing styles)
   ═══════════════════════════════════════════════════════════════════════════ */

// Keep your existing styles array - they are already complete
// The styles object is defined at the bottom of your file
/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Complete Styles
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  /* ── Base ── */
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 24 },

  /* ── Loading States ── */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontWeight: '800', marginBottom: 20, color: '#fff' },
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
  stickyHeaderTitle: { fontWeight: '900', letterSpacing: -0.3, color: '#fff' },
  stickyHeaderUnderline: { alignSelf: 'center' },
  logoFloatWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogoImage: { zIndex: 2, backgroundColor: 'transparent' },
  logoTextColumn: { alignItems: 'flex-start', justifyContent: 'center' },
  stickyHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stickyHeaderIconBtn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stickyHeaderBadge: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderWidth: 2, borderColor: 'white' },
  stickyHeaderBadgeText: { color: 'white', fontWeight: 'bold' },
  stickyHeaderBaby: { overflow: 'hidden' },
  stickyHeaderLockBtn: { marginLeft: 4 },
  stickyHeaderLockGradient: { alignItems: 'center', justifyContent: 'center' },
  safetyCornerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  safetyCornerGradient: { alignItems: 'center', justifyContent: 'center' },

  /* ── Glass Card ── */
  glassCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 24 },
  glassContent: { flex: 1 },

  /* ── Parent Card ── */
  parentCard: { marginBottom: 12, marginTop: 16 },
  parentHeader: { flexDirection: 'row', alignItems: 'center' },
  parentInfo: { flex: 1, marginLeft: 14 },
  greetingText: { fontWeight: '500', marginBottom: 1 },
  parentName: { fontWeight: '800', letterSpacing: -0.5 },
  parentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 10 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
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
  streakText: { fontWeight: '700', color: '#fff' },

  /* ── No Baby Card ── */
  noBabyCard: { marginBottom: 14, overflow: 'hidden', marginTop: 16 },
  noBabyGradient: { padding: 28, alignItems: 'center' },
  noBabyEmoji: { marginBottom: 12 },
  noBabyTitle: { fontWeight: '800', marginBottom: 6, color: '#fff' },
  noBabyText: { textAlign: 'center', marginBottom: 16, color: 'rgba(255,255,255,0.9)' },
  noBabyButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 6, backgroundColor: '#fff' },
  noBabyButtonText: { fontWeight: '700', color: '#667eea' },

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
  dailySummaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 3, color: 'rgba(255,255,255,0.9)' },

  /* ── Context Card ── */
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
  nextActionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1, color: 'rgba(255,255,255,0.9)' },
  nextActionArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  nextActionUrgency: { position: 'absolute', top: 10, right: 10 },
  urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  urgencyDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
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
  categoryTabsScroll: { paddingHorizontal: 20, gap: 6, paddingBottom: 10 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  categoryTabText: { fontSize: 12, fontWeight: '600' },
  categoryTabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, minWidth: 18, alignItems: 'center' },
  categoryTabBadgeText: { fontSize: 9, fontWeight: '700' },
  categorizedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', paddingBottom: 6 },
  categorizedGridItem: { alignItems: 'center', marginBottom: 10 },
  categorizedGridTouchable: { alignItems: 'center', width: '100%' },
  categorizedGridGradient: { width: '100%', aspectRatio: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
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
  vaccineList: { gap: 0 },
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
  featureCardsScroll: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
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
  notificationPanel: { marginBottom: 0, marginTop: 0 },
  notificationPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationPanelIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notificationPanelTitle: { fontSize: 15, fontWeight: '800' },
  urgentBadge: { backgroundColor: '#ef4444', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  urgentBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  expandBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  expandText: { fontSize: 12, fontWeight: '600' },
  smartNotificationCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 6 },
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
  soundMixerContainer: { borderRadius: 26, padding: 14, marginBottom: 6, marginHorizontal: 20, borderWidth: 1 },
  soundMixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  soundMixerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soundMixerIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  soundMixerTitleText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  soundMixerSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  playAllButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DB954' },
  playAllButtonActive: { backgroundColor: '#f59e0b' },
  trackCard: { width: 100, marginRight: 10 },
  trackImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 6, overflow: 'hidden' },
  trackOverlay: { flex: 1, justifyContent: 'flex-end', padding: 6 },
  trackPlayButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.3)' },
  trackPlayButtonActive: { backgroundColor: '#f59e0b' },
  trackTitle: { fontSize: 12, fontWeight: '600', marginBottom: 1 },
  trackArtist: { fontSize: 10, fontWeight: '500' },
  playingIndicator: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.4)' },
  bar: { width: 2.5, height: 10, borderRadius: 1, backgroundColor: '#fff' },
  barMiddle: { height: 16 },

  /* ── Timeline ── */
  timelineContainer: { marginBottom: 0 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 0, bottom: -12, width: 2, left: 11 },
  timelineCard: { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  timelineCardDark: {},
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
  emptyStateDark: {},
  emptyStateText: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  addFirstActivityBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  addFirstActivityText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  loadMoreButton: { marginTop: 14, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  viewAllButton: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  /* ── Section Headers ── */
  section: { marginTop: 6 },
  sectionFullWidth: { marginTop: 6, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', letterSpacing: -0.5 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontWeight: '600' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  sectionHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeaderActionText: { fontSize: 12, fontWeight: '700' },

  /* ── Notification Modal ── */
  notificationModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  notificationModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notificationModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  notificationModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  notificationModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationModalTextWrap: {
    flex: 1,
  },
  notificationModalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationModalOptionDesc: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  /* ── Reusable Modals ── */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
  },
  modalIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
    marginBottom: 12,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  /* ── Growth Snapshot KPIs ── */
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiHomeCard: {
    width: (width - 56) / 2,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiHomeIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  kpiHomeBody: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
  kpiHomeValue: { fontWeight: '800', letterSpacing: -0.5 },
  kpiHomeUnit: { fontWeight: '700' },
  kpiHomeTitle: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiHomeChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  kpiHomeChange: { fontWeight: '700' },

  /* ── Quick Action Badges ── */
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBadgeText: { fontSize: 10, fontWeight: '800' },
  actionBadgeLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  actionBadgeLabelText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  /* ── Text Colors ── */
  textDark: { color: '#f0f0f7' },
  textMuted: { color: '#888' },
});