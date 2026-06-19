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
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay, differenceInHours, differenceInDays } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Polyline, Path } from 'react-native-svg';

import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');
const SCREEN_W = width;
const SCREEN_H = height;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM - Cohesive, modern tokens
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
    glow: { shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 6 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION MAP
   ═══════════════════════════════════════════════════════════════════════════ */
const NAVIGATION_MAP: Record<string, { screen: keyof RootStackParamList; params?: Record<string, any> }> = {
  'Main': { screen: 'Main', params: {} },
  'Connect': { screen: 'Main', params: { screen: 'Connect' } },
  'Settings': { screen: 'Customize', params: {} },
  'More': { screen: 'Main', params: { screen: 'More' } },
  'UniversalTracker': { screen: 'UniversalTrackerHub', params: {} },
  'Grow': { screen: 'GrowthDashboard', params: {} },
  'Achievements': { screen: 'Achievements', params: {} },
  'Reminders': { screen: 'TrackerReminders', params: {} },
  'SafetyCorner': { screen: 'SafetyCorner', params: {} },
  'Gallery': { screen: 'Gallery', params: {} },
  'SoundMixer': { screen: 'SoundMixer', params: {} },
  'FamilySharing': { screen: 'FamilySharing', params: {} },
  'FamilyChatList': { screen: 'FamilyChatList', params: {} },
  'HelpCenter': { screen: 'HelpCenter', params: {} },
  'ContactSupport': { screen: 'ContactSupport', params: {} },
  'Profile': { screen: 'Profile', params: {} },
  'SwitchBaby': { screen: 'SwitchBaby', params: {} },
  'CreateBabyProfile': { screen: 'CreateBabyProfile', params: {} },
  'EditProfile': { screen: 'EditProfile', params: {} },
  'VaccinationSchedule': { screen: 'VaccinationSchedule', params: {} },
  'Timeline': { screen: 'Timeline', params: {} },
  'GrowthDashboard': { screen: 'GrowthDashboard', params: {} },
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

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const getFullThemeColors = (theme: string, appearance: string, isDarkMode: boolean) => {
  return {
    background: isDarkMode ? '#0a0a0f' : '#f0f4f8',
    surface: isDarkMode ? '#141420' : '#ffffff',
    surfaceElevated: isDarkMode ? '#1c1c2e' : '#ffffff',
    surfaceGlass: isDarkMode ? 'rgba(28,28,46,0.85)' : 'rgba(255,255,255,0.92)',
    text: isDarkMode ? '#f0f0f5' : '#1a1a2e',
    textSecondary: isDarkMode ? '#a0a0b8' : '#64748b',
    textMuted: isDarkMode ? '#6b6b8a' : '#94a3b8',
    border: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderLight: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    glassBg: isDarkMode ? 'rgba(28,28,46,0.95)' : 'rgba(255,255,255,0.95)',
    shadow: '#000',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATA - Refined Quick Actions with Categories
   ═══════════════════════════════════════════════════════════════════════════ */

const QUICK_ACTIONS: QuickAction[] = [
  // Daily Care
  { id: 'feed', label: 'Feed', icon: '\ud83c\udf7c', iconName: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#fee140'], screen: 'UniversalTrackerHub', params: { type: 'feed' }, category: 'daily' },
  { id: 'sleep', label: 'Sleep', icon: '\ud83d\ude34', iconName: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'], screen: 'UniversalTrackerHub', params: { type: 'sleep' }, category: 'daily' },
  { id: 'diaper', label: 'Diaper', icon: '\ud83e\uddf7', iconName: 'shirt-outline', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'], screen: 'UniversalTrackerHub', params: { type: 'diaper' }, category: 'daily' },
  { id: 'potty', label: 'Potty', icon: '\ud83d\udebd', iconName: 'water-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'], screen: 'UniversalTrackerHub', params: { type: 'potty' }, category: 'daily' },
  // Health
  { id: 'growth', label: 'Growth', icon: '\ud83d\udccf', iconName: 'trending-up-outline', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], screen: 'GrowthDashboard', params: {}, category: 'health' },
  { id: 'medication', label: 'Meds', icon: '\ud83d\udc8a', iconName: 'medical-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'UniversalTrackerHub', params: { type: 'medication' }, category: 'health' },
  { id: 'vaccine', label: 'Vaccines', icon: '\ud83d\udc89', iconName: 'medical-outline', color: '#e11d48', gradient: ['#e11d48', '#fb7185'], screen: 'VaccinationSchedule', params: {}, category: 'health' },
  { id: 'temperature', label: 'Temp', icon: '\ud83c\udf21\ufe0f', iconName: 'thermometer-outline', color: '#f97316', gradient: ['#f97316', '#fb923c'], screen: 'UniversalTrackerHub', params: { type: 'temperature' }, category: 'health' },
  // Family
  { id: 'milestone', label: 'Milestone', icon: '\ud83c\udf1f', iconName: 'trophy-outline', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'Achievements', params: {}, category: 'family' },
  { id: 'gallery', label: 'Gallery', icon: '\ud83d\uddbc\ufe0f', iconName: 'images-outline', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'Gallery', params: {}, category: 'family' },
  { id: 'family_chat', label: 'Chat', icon: '\ud83d\udcac', iconName: 'chatbubbles-outline', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], screen: 'FamilyChatList', params: {}, category: 'family' },
  { id: 'note', label: 'Note', icon: '\ud83d\udcdd', iconName: 'document-text-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'UniversalTrackerHub', params: { type: 'note' }, category: 'family' },
  // Tools
  { id: 'reminders', label: 'Reminders', icon: '\u23f0', iconName: 'alarm-outline', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'TrackerReminders', params: {}, category: 'tools' },
  { id: 'sound', label: 'Sounds', icon: '\ud83c\udfb5', iconName: 'musical-notes-outline', color: '#1DB954', gradient: ['#1DB954', '#1ed760'], screen: 'SoundMixer', params: {}, category: 'tools' },
  { id: 'safety', label: 'Safety', icon: '\ud83d\udee1\ufe0f', iconName: 'shield-checkmark-outline', color: '#dc2626', gradient: ['#dc2626', '#ef4444'], screen: 'SafetyCorner', params: {}, category: 'tools' },
  { id: 'settings', label: 'Settings', icon: '\u2699\ufe0f', iconName: 'settings-outline', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'Customize', params: {}, category: 'tools' },
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
   NEW FEATURE 1: AI DAILY SUMMARY WIDGET
   Shows today's key metrics in a sleek horizontal scroll
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
            <Ionicons name="today-outline" size={18} color={theme.primary} />
            <Text style={[styles.dailySummaryTitle, { color: theme.text }]}>Today's Summary</Text>
          </View>
          <Text style={[styles.dailySummaryDate, { color: theme.textMuted }]}>
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.dailySummaryScroll}
          decelerationRate="fast"
          snapToInterval={140}
          snapToAlignment="start"
        >
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
                <View style={styles.dailySummaryIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.dailySummaryValue}>{item.value}</Text>
                <Text style={styles.dailySummaryLabel}>{item.label}</Text>
                <Text style={styles.dailySummarySublabel} numberOfLines={1}>{item.sublabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: SMART CONTEXT CARD
   Context-aware recommendations based on time of day
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
          colors={isDark ? ['rgba(45,45,60,0.8)', 'rgba(35,35,50,0.6)'] : context.bgGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.contextCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : `${context.color}30` }]}
        >
          <View style={styles.contextLeft}>
            <View style={[styles.contextIconBg, { backgroundColor: `${context.color}20` }]}>
              <Ionicons name={context.icon as any} size={24} color={context.color} />
            </View>
            <View style={styles.contextText}>
              <Text style={[styles.contextTitle, { color: theme.text }]}>{context.title}</Text>
              <Text style={[styles.contextMessage, { color: theme.textSecondary }]} numberOfLines={2}>
                {context.message}
              </Text>
            </View>
          </View>
          <View style={[styles.contextActionBadge, { backgroundColor: `${context.color}15` }]}>
            <Text style={[styles.contextActionText, { color: context.color }]}>{context.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={context.color} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: NEXT BEST ACTION - AI-POWERED SUGGESTION
   Predicts what the parent should do next based on patterns
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
        subtitle: `Awake for ${hoursSinceSleep}h - watch for cues`,
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
              <Ionicons name={suggestion.icon as any} size={28} color="#fff" />
            </View>
            <View style={styles.nextActionText}>
              <Text style={styles.nextActionTitle}>{suggestion.title}</Text>
              <Text style={styles.nextActionSubtitle}>{suggestion.subtitle}</Text>
            </View>
            <View style={styles.nextActionArrow}>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
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
   NEW FEATURE 4: WEEKLY PATTERN INSIGHT
   Shows weekly trends with mini visualizations
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
      <View style={styles.patternContainer}>
        <View style={styles.patternHeader}>
          <View style={styles.patternTitleRow}>
            <Ionicons name="analytics-outline" size={18} color={theme.primary} />
            <Text style={[styles.patternTitle, { color: theme.text }]}>Weekly Pattern</Text>
          </View>
          <Text style={[styles.patternSubtitle, { color: theme.textMuted }]}>Last 7 days</Text>
        </View>

        <View style={styles.patternBars}>
          {patterns.data.map((day, i) => {
            const barHeight = (day.total / patterns.maxTotal) * 100;
            const isToday = i === 6;

            return (
              <View key={day.day} style={styles.patternDay}>
                <View style={styles.patternBarContainer}>
                  <View style={[styles.patternBar, { height: `${barHeight}%`, backgroundColor: isToday ? theme.primary : `${theme.primary}40` }]} />
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
   NEW FEATURE 5: SMART CATEGORY TABS FOR QUICK ACTIONS
   Organized by category with smooth horizontal tabs
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

  const getGridColumns = () => {
    if (width >= 768) return 4;
    if (width >= 414) return 4;
    return 4;
  };

  const columns = getGridColumns();
  const gap = 12;
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
                !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
              ]}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={14} 
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
                isActive ? { backgroundColor: 'rgba(255,255,255,0.3)' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
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
            entering={FadeInUp.delay(index * 40).springify()}
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
                <Ionicons name={action.iconName as any} size={24} color="#fff" />
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
   NEW FEATURE 6: EMERGENCY QUICK ACCESS BAR
   Always-visible safety shortcuts
   ═══════════════════════════════════════════════════════════════════════════ */

const EmergencyQuickBar: React.FC<{
  isDark: boolean;
  theme: any;
  onSafetyPress: () => void;
  onSOSPress: () => void;
  onCallPediatrician: () => void;
}> = React.memo(({ isDark, theme, onSafetyPress, onSOSPress, onCallPediatrician }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <View style={[styles.emergencyBar, { backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.08)' }]}>
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.emergencyBarHeader}
        >
          <View style={styles.emergencyBarLeft}>
            <View style={styles.emergencyIconBg}>
              <Ionicons name="shield-half-outline" size={18} color="#dc2626" />
            </View>
            <Text style={[styles.emergencyBarTitle, { color: '#dc2626' }]}>Safety Hub</Text>
          </View>
          <Ionicons 
            name={expanded ? "chevron-up-outline" : "chevron-down-outline"} 
            size={18} 
            color="#dc2626" 
          />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.emergencyActions}>
            <TouchableOpacity onPress={onSafetyPress} style={styles.emergencyAction}>
              <LinearGradient colors={['#dc2626', '#ef4444']} style={styles.emergencyActionGradient}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                <Text style={styles.emergencyActionText}>Safety Tips</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSOSPress} style={styles.emergencyAction}>
              <LinearGradient colors={['#ef4444', '#f87171']} style={styles.emergencyActionGradient}>
                <Ionicons name="alert-circle-outline" size={20} color="#fff" />
                <Text style={styles.emergencyActionText}>Emergency Info</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onCallPediatrician} style={styles.emergencyAction}>
              <LinearGradient colors={['#f97316', '#fb923c']} style={styles.emergencyActionGradient}>
                <Ionicons name="call-outline" size={20} color="#fff" />
                <Text style={styles.emergencyActionText}>Call Doctor</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   REFINED GLASS CARD
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; intensity?: number }> = 
  React.memo(({ children, style, onPress, intensity = 80 }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
      <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient 
          colors={isDark ? ['rgba(45,45,60,0.8)', 'rgba(35,35,50,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.75)']} 
          style={StyleSheet.absoluteFill} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
        />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    );
  });

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED FEATURE CARDS - Horizontal scroll with rich info
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
            <LinearGradient
              colors={[`${item.color}12`, `${item.color}04`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.featureCard, { borderColor: `${item.color}25` }]}
            >
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
                <Ionicons name="arrow-forward" size={14} color={item.color} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SMART NOTIFICATION PANEL
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
            <Ionicons name="notifications-outline" size={18} color={theme.primary} />
            <Text style={[styles.notificationPanelTitle, { color: theme.text }]}>Smart Alerts</Text>
            {urgentCount > 0 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>{urgentCount}</Text>
              </View>
            )}
          </View>
          {notifications.filter(n => !n.dismissed).length > 2 && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)}>
              <Text style={[styles.expandText, { color: theme.primary }]}>
                {expanded ? 'Show Less' : `+${notifications.filter(n => !n.dismissed).length - 2} more`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {visibleNotifs.map((notif, index) => (
          <Animated.View key={notif.id} entering={FadeInUp.delay(index * 60)}>
            <TouchableOpacity
              style={[
                styles.smartNotificationCard,
                {
                  backgroundColor: notif.bgColor + (isDark ? '18' : '10'),
                  borderLeftColor: notif.iconColor,
                  borderLeftWidth: 3,
                },
              ]}
              onPress={() => onAction(notif)}
              activeOpacity={0.8}
            >
              <View style={[styles.smartNotifIcon, { backgroundColor: notif.iconColor + '15' }]}>
                <Ionicons name={getPriorityIcon(notif.priority) as any} size={18} color={notif.iconColor} />
              </View>
              <View style={styles.smartNotifContent}>
                <Text style={[styles.smartNotifTitle, { color: theme.text }]}>{notif.title}</Text>
                <Text style={[styles.smartNotifMessage, { color: theme.textSecondary }]} numberOfLines={2}>
                  {notif.message}
                </Text>
                <View style={styles.smartNotifMeta}>
                  <Text style={[styles.smartNotifTime, { color: theme.textMuted }]}>
                    {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                  </Text>
                  {notif.actionLabel && (
                    <View style={[styles.smartNotifActionBadge, { backgroundColor: notif.iconColor + '12' }]}>
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
                <Ionicons name="close-outline" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED RECENT ACTIVITY LIST
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

  const getActivityIcon = (type?: string): string => {
    const iconMap: Record<string, string> = {
      potty: 'water-outline',
      feed: 'nutrition-outline',
      sleep: 'moon-outline',
      diaper: 'shirt-outline',
      growth: 'trending-up-outline',
      milestone: 'trophy-outline',
      medication: 'medical-outline',
      note: 'document-text-outline',
      pump: 'swap-horizontal-outline',
      bath: 'water-outline',
      play: 'game-controller-outline',
      walk: 'walk-outline',
      temperature: 'thermometer-outline',
      symptom: 'pulse-outline',
    };
    return iconMap[type || ''] || 'ellipse-outline';
  };

  const getActivityColor = (type?: string): string => {
    const colorMap: Record<string, string> = {
      potty: '#667eea',
      feed: '#fa709a',
      sleep: '#11998e',
      diaper: '#fc5c7d',
      growth: '#43e97b',
      milestone: '#f59e0b',
      medication: '#ef4444',
      note: '#64748b',
      pump: '#8b5cf6',
      bath: '#3b82f6',
      play: '#ec4899',
      walk: '#10b981',
    };
    return colorMap[type || ''] || '#667eea';
  };

  if (activities.length === 0) {
    return (
      <GlassCard style={styles.emptyStateCard} intensity={60}>
        <View style={styles.emptyStateIcon}>
          <Ionicons name="document-text-outline" size={32} color={theme.primary} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No activities yet</Text>
        <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
          Tap a quick action above to log your first activity!
        </Text>
      </GlassCard>
    );
  }

  return (
    <View>
      {displayedActivities.map((item, index) => {
        const iconName = getActivityIcon(item?.type);
        const iconColor = getActivityColor(item?.type);
        return (
          <Animated.View 
            key={item.id || `activity-${index}`} 
            entering={FadeInUp.delay(index * 60).springify()}
          >
            <TouchableOpacity onPress={() => onActivityPress(item)} activeOpacity={0.8}>
              <GlassCard style={styles.activityItem} intensity={60}>
                <View style={[styles.activityIcon, { backgroundColor: `${iconColor}15` }]}>
                  <Ionicons name={iconName as any} size={20} color={iconColor} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: theme.text }]}>
                    {item.title || 'Activity'}
                  </Text>
                  <Text style={[styles.activityTime, { color: theme.textMuted }]}>
                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                  </Text>
                  {item.details && (
                    <Text style={[styles.activityDetails, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.details}
                    </Text>
                  )}
                </View>
                <View style={[styles.activityArrow, { backgroundColor: `${iconColor}10` }]}>
                  <Ionicons name="chevron-forward" size={16} color={iconColor} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {displayCount < activities.length && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={() => setDisplayCount(prev => prev + 5)}>
          <Text style={[styles.loadMoreText, { color: theme.primary }]}>
            Load More ({activities.length - displayCount} remaining)
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.primary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
        <Text style={[styles.viewAllText, { color: theme.primary }]}>View All Activity</Text>
        <Ionicons name="arrow-forward" size={16} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SOUND MIXER SECTION
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
        <LinearGradient 
          colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#f0f4f8', '#e2e8f0', '#dbeafe']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
          style={styles.soundMixerContainer}
        >
          <View style={styles.soundMixerHeader}>
            <View style={styles.soundMixerTitle}>
              <View style={[styles.soundMixerIconBg, { backgroundColor: '#1DB95420' }]}>
                <Ionicons name="musical-notes-outline" size={20} color="#1DB954" />
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
              <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
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
                      <Ionicons name={currentTrack?.id === item.id && isPlaying ? "pause" : "play"} size={14} color="#fff" />
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
        </LinearGradient>
      </TouchableOpacity>
    );
  });

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED STICKY HEADER
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
  const iconSize = Math.round(22 * fontSizeMultiplier);
  const titleSize = Math.round(20 * fontSizeMultiplier);
  const badgeSize = Math.round(18 * fontSizeMultiplier);
  const avatarSize = Math.round(40 * fontSizeMultiplier);

  const headerBg = isDark ? (fullTheme?.glassBg || 'rgba(28,28,46,0.95)') : (fullTheme?.glassBg || 'rgba(255,255,255,0.95)');
  const borderColor = isDark ? (fullTheme?.border || 'rgba(255,255,255,0.08)') : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? (fullTheme?.text || '#f0f0f5') : (fullTheme?.text || '#1a1a2e');

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

      <View style={[styles.stickyHeaderContent, { height: compactSpacing ? 44 : 50 }]}>
        {/* Left: Safety */}
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity
            style={[styles.safetyCornerBtn, { borderRadius: 12 }]}
            onPress={onSafetyCornerPress}
          >
            <LinearGradient
              colors={['#dc2626', '#ef4444']}
              style={[styles.safetyCornerGradient, { width: 36, height: 36, borderRadius: 10 }]}
            >
              <Ionicons name="shield-half-outline" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Center: Title */}
        <View style={styles.stickyHeaderCenter}>
          <Text style={[styles.stickyHeaderTitle, { color: textColor, fontSize: titleSize }]}>LittleLoom</Text>
          <View style={[styles.stickyHeaderUnderline, { backgroundColor: primaryColor, width: Math.round(32 * fontSizeMultiplier), height: Math.max(3, Math.round(4 * fontSizeMultiplier)), borderRadius: Math.max(1, Math.round(2 * fontSizeMultiplier)), marginTop: compactSpacing ? 2 : 4 }]} />
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
   SECTION HEADER COMPONENT
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
      {icon && <Ionicons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 8 }} />}
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
   MAIN HOMESCREEN - REDESIGNED
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

  // Scroll handler for header animation only
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
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
    return getRecentTimelineEvents(50, currentBaby.id);
  }, [currentBaby, getRecentTimelineEvents, activities]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);

  const activeSmartNotifications = useMemo(() =>
    smartNotifications.filter(n => !n.dismissed).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    [smartNotifications]
  );

  const bgColors = isDark
    ? [theme.background, '#141420', '#1c1c2e']
    : [theme.background, '#e8ecf1', '#dbeafe'];

  const scrollTopPadding = Platform.OS === 'ios'
    ? (settings.compactSpacing ? 120 : 140)
    : (settings.compactSpacing ? 110 : 125);

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
            GREETING & PARENT CARD
           ═══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.springify()}>
          <GlassCard style={[styles.parentCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={90}>
            <View style={[styles.parentHeader, { padding: settings.compactSpacing ? 16 : 20 }]}>
              <SafeParentAvatar
                avatar={userProfile?.avatar}
                name={userProfile?.fullName || 'Parent'}
                size={Math.round(60 * fontSizeMultiplier)}
                onPress={() => navigateToScreen('Profile')}
                showEditBadge={true}
              />
              <View style={styles.parentInfo}>
                <Text style={[styles.greetingText, { color: theme.textMuted, fontSize: Math.round(13 * fontSizeMultiplier) }]}>
                  {greeting}
                </Text>
                <Text style={[styles.parentName, { color: theme.text, fontSize: Math.round(20 * fontSizeMultiplier) }]}>
                  {userProfile?.fullName || 'Parent'}
                </Text>
                <View style={styles.parentMeta}>
                  <View style={[styles.verifiedBadge, { borderRadius: borderRadiusValue / 2 }]}>
                    <Ionicons name="shield-checkmark-outline" size={Math.round(12 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.verifiedText, { color: accent, fontSize: Math.round(11 * fontSizeMultiplier) }]}>Verified</Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textMuted, fontSize: Math.round(11 * fontSizeMultiplier) }]}>
                    {format(currentTime, 'EEEE, MMM d')}
                  </Text>
                </View>
              </View>
              <View style={styles.parentQuickLinks}>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${primary}15`, borderRadius: borderRadiusValue - 10 }]} 
                  onPress={() => navigateToScreen('Achievements')}
                >
                  <Ionicons name="ribbon-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${secondary}15`, borderRadius: borderRadiusValue - 10 }]} 
                  onPress={() => navigateToScreen('Connect')}
                >
                  <Ionicons name="sparkles-outline" size={Math.round(18 * fontSizeMultiplier)} color={secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════════
            BABY CARD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby ? (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
            <GlassCard style={[styles.babyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={95}>
              <View style={[styles.babyHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20, paddingTop: settings.compactSpacing ? 12 : 16 }]}>
                <TouchableOpacity style={styles.babySelector} onPress={() => navigateToScreen('SwitchBaby')}>
                  <Text style={[styles.babySelectorLabel, { color: theme.textMuted, fontSize: Math.round(12 * fontSizeMultiplier) }]}>
                    Current Baby
                  </Text>
                  <Ionicons name="chevron-down-outline" size={Math.round(14 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.editButton, { borderRadius: borderRadiusValue / 2, backgroundColor: `${primary}10` }]} 
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                >
                  <Ionicons name="create-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.babyMainInfo, { padding: settings.compactSpacing ? 16 : 20 }]}>
                <SafeBabyAvatar
                  avatar={currentBaby.avatar}
                  gender={currentBaby.gender}
                  size={Math.round(72 * fontSizeMultiplier)}
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                  showBadge={true}
                />
                <View style={styles.babyDetails}>
                  <Text style={[styles.babyName, { color: theme.text, fontSize: Math.round(22 * fontSizeMultiplier) }]}>
                    {currentBaby.name}
                  </Text>
                  <Text style={[styles.babyAge, { color: theme.textSecondary, fontSize: Math.round(14 * fontSizeMultiplier) }]}>
                    {currentBaby.age}
                  </Text>
                  <View style={styles.babyStatus}>
                    <Ionicons name="pulse-outline" size={Math.round(12 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.babyStatusText, { color: accent, fontSize: Math.round(13 * fontSizeMultiplier) }]}>
                      Healthy & Active
                    </Text>
                  </View>
                </View>
                <LinearGradient colors={[secondary, '#fee140']} style={[styles.streakBadge, { borderRadius: borderRadiusValue }]}>
                  <Ionicons name="flame-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
                  <Text style={[styles.streakText, { fontSize: Math.round(12 * fontSizeMultiplier) }]}>{getPottyStreak()}d</Text>
                </LinearGradient>
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
            <TouchableOpacity onPress={() => navigateToScreen('CreateBabyProfile')}>
              <GlassCard style={[styles.noBabyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={90}>
                <LinearGradient colors={[primary, '#764ba2']} style={[styles.noBabyGradient, { borderRadius: borderRadiusValue }]}>
                  <Text style={[styles.noBabyEmoji, { fontSize: Math.round(48 * fontSizeMultiplier) }]}>\ud83d\udc76</Text>
                  <Text style={[styles.noBabyTitle, { fontSize: Math.round(20 * fontSizeMultiplier) }]}>Welcome to LittleLoom!</Text>
                  <Text style={[styles.noBabyText, { fontSize: Math.round(14 * fontSizeMultiplier) }]}>
                    Create your first baby profile to start tracking
                  </Text>
                  <View style={[styles.noBabyButton, { borderRadius: borderRadiusValue - 8 }]}>
                    <Text style={[styles.noBabyButtonText, { fontSize: Math.round(15 * fontSizeMultiplier) }]}>Get Started</Text>
                    <Ionicons name="arrow-forward-outline" size={Math.round(16 * fontSizeMultiplier)} color={primary} />
                  </View>
                </LinearGradient>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 1: DAILY SUMMARY WIDGET
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <DailySummaryWidget
            summary={dailySummary}
            isDark={isDark}
            theme={theme}
            onPress={handleDailySummaryPress}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 2: SMART CONTEXT CARD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 16 }}>
            <SmartContextCard
              isDark={isDark}
              theme={theme}
              currentBaby={currentBaby}
              onPress={handleContextPress}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            NEW FEATURE 3: NEXT BEST ACTION
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 16 }}>
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
            SMART NOTIFICATIONS
           ═══════════════════════════════════════════════════════════════════ */}
        {activeSmartNotifications.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20 }}>
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
            NEW FEATURE 5: CATEGORIZED QUICK ACTIONS
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={Math.round(20 * fontSizeMultiplier)} color={primary} />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(18 * fontSizeMultiplier) }]}>
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
            FEATURE CARDS - Horizontal Scroll
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps-outline" size={Math.round(20 * fontSizeMultiplier)} color="#f59e0b" />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(18 * fontSizeMultiplier) }]}>
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
            NEW FEATURE 4: WEEKLY PATTERN INSIGHT
           ═══════════════════════════════════════════════════════════════════ */}
        {currentBaby && activities.length > 0 && (
          <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 16 }}>
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
            NEW FEATURE 6: EMERGENCY QUICK ACCESS
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={{ marginHorizontal: settings.compactSpacing ? 16 : 20, marginBottom: 16 }}>
          <EmergencyQuickBar
            isDark={isDark}
            theme={theme}
            onSafetyPress={() => navigateToScreen('SafetyCorner')}
            onSOSPress={() => {
              // Open emergency info modal or screen
              navigateToScreen('SafetyCorner');
            }}
            onCallPediatrician={() => {
              // This would trigger a phone call in a real app
              toast('Calling...', 'Dialing pediatrician', 'info');
            }}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            RECENT ACTIVITY
           ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={Math.round(20 * fontSizeMultiplier)} color={secondary} />
              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: Math.round(18 * fontSizeMultiplier) }]}>
                Recent Activity
              </Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('Timeline', { type: 'all' })}>
              <Text style={[styles.seeAllText, { color: primary, fontSize: Math.round(14 * fontSizeMultiplier) }]}>View All</Text>
              <Ionicons name="arrow-forward-outline" size={Math.round(14 * fontSizeMultiplier)} color={primary} />
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

        <View style={{ height: settings.compactSpacing ? 100 : 140 }} />
      </Animated.ScrollView>
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES - Completely Redesigned
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  /* ── Base ── */
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 30 },

  /* ── Loading States ── */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontWeight: '800', color: '#fff', marginBottom: 20 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  /* ── Sticky Header ── */
  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 16 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickyHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stickyHeaderCenter: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  stickyHeaderTitle: { fontWeight: '900', letterSpacing: -0.5 },
  stickyHeaderUnderline: { alignSelf: 'center' },
  stickyHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  stickyHeaderIconBtn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stickyHeaderBadge: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderWidth: 2, borderColor: 'white' },
  stickyHeaderBadgeText: { color: 'white', fontWeight: 'bold' },
  stickyHeaderBaby: { overflow: 'hidden' },
  stickyHeaderLockBtn: { marginLeft: 4 },
  stickyHeaderLockGradient: { alignItems: 'center', justifyContent: 'center' },
  safetyCornerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  safetyCornerGradient: { alignItems: 'center', justifyContent: 'center' },

  /* ── Glass Card ── */
  glassCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, ...DESIGN.shadow.md },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* ── Parent Card ── */
  parentCard: { marginBottom: 16, marginTop: 20 },
  parentHeader: { flexDirection: 'row', alignItems: 'center' },
  parentInfo: { flex: 1, marginLeft: 16 },
  greetingText: { fontWeight: '500', marginBottom: 2 },
  parentName: { fontWeight: '800', letterSpacing: -0.5 },
  parentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(67,233,123,0.1)', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  verifiedText: { fontWeight: '600' },
  timeText: { fontWeight: '500' },
  parentQuickLinks: { flexDirection: 'row', gap: 8 },
  parentQuickLink: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  /* ── Baby Card ── */
  babyCard: { marginBottom: 20 },
  babyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  babySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  babySelectorLabel: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  editButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  babyMainInfo: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  babyDetails: { flex: 1, marginLeft: 16 },
  babyName: { fontWeight: '800', letterSpacing: -0.5 },
  babyAge: { marginTop: 2, fontWeight: '500' },
  babyStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  babyStatusText: { fontWeight: '600' },
  streakBadge: { position: 'absolute', top: 20, right: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { color: '#fff', fontWeight: '700' },

  /* ── No Baby Card ── */
  noBabyCard: { marginBottom: 20, overflow: 'hidden', marginTop: 20 },
  noBabyGradient: { padding: 32, alignItems: 'center' },
  noBabyEmoji: { marginBottom: 16 },
  noBabyTitle: { fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabyText: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 20 },
  noBabyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, gap: 8 },
  noBabyButtonText: { color: '#667eea', fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 1: DAILY SUMMARY WIDGET STYLES
     ═══════════════════════════════════════════════════════════════════ */
  dailySummaryContainer: { marginHorizontal: 20, marginBottom: 16 },
  dailySummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  dailySummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailySummaryTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  dailySummaryDate: { fontSize: 13, fontWeight: '500' },
  dailySummaryScroll: { gap: 10, paddingRight: 20 },
  dailySummaryItem: { width: 130, borderRadius: 20, overflow: 'hidden' },
  dailySummaryGradient: { padding: 14, alignItems: 'center', aspectRatio: 0.85 },
  dailySummaryIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  dailySummaryValue: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  dailySummaryLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  dailySummarySublabel: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 2: SMART CONTEXT CARD STYLES
     ═══════════════════════════════════════════════════════════════════ */
  contextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20, borderWidth: 1 },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  contextIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contextText: { flex: 1 },
  contextTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  contextMessage: { fontSize: 13, fontWeight: '500', marginTop: 2, lineHeight: 18 },
  contextActionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  contextActionText: { fontSize: 12, fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 3: NEXT BEST ACTION STYLES
     ═══════════════════════════════════════════════════════════════════ */
  nextActionContainer: { borderRadius: 20, overflow: 'hidden' },
  nextActionGradient: { padding: 18 },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextActionIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  nextActionText: { flex: 1 },
  nextActionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  nextActionSubtitle: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  nextActionArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  nextActionUrgency: { position: 'absolute', top: 12, right: 12 },
  urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 4: WEEKLY PATTERN STYLES
     ═══════════════════════════════════════════════════════════════════ */
  patternContainer: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  patternTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patternTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  patternSubtitle: { fontSize: 13, fontWeight: '500' },
  patternBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, gap: 8 },
  patternDay: { flex: 1, alignItems: 'center', gap: 6 },
  patternBarContainer: { width: '100%', height: 70, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8, overflow: 'hidden' },
  patternBar: { width: '100%', borderRadius: 8, minHeight: 4 },
  patternDayLabel: { fontSize: 11, fontWeight: '600' },
  patternDayCount: { fontSize: 10, fontWeight: '700' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 5: CATEGORIZED QUICK ACTIONS STYLES
     ═══════════════════════════════════════════════════════════════════ */
  categoryTabsScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  categoryTabText: { fontSize: 13, fontWeight: '600' },
  categoryTabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 20, alignItems: 'center' },
  categoryTabBadgeText: { fontSize: 10, fontWeight: '700' },
  categorizedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', paddingBottom: 8 },
  categorizedGridItem: { alignItems: 'center', marginBottom: 12 },
  categorizedGridTouchable: { alignItems: 'center', width: '100%' },
  categorizedGridGradient: { width: '100%', aspectRatio: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  categorizedGridLabel: { fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  /* ═══════════════════════════════════════════════════════════════════
     NEW FEATURE 6: EMERGENCY QUICK ACCESS STYLES
     ═══════════════════════════════════════════════════════════════════ */
  emergencyBar: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(220,38,38,0.15)' },
  emergencyBarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  emergencyBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emergencyIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.1)', alignItems: 'center', justifyContent: 'center' },
  emergencyBarTitle: { fontSize: 15, fontWeight: '800' },
  emergencyActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  emergencyAction: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  emergencyActionGradient: { paddingVertical: 12, alignItems: 'center', gap: 6 },
  emergencyActionText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  /* ── Feature Cards Row ── */
  featureCardsScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  featureCardTouchable: { width: 160 },
  featureCard: { borderRadius: 20, padding: 16, borderWidth: 1, ...DESIGN.shadow.sm },
  featureCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  featureCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureCardBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, minWidth: 28, alignItems: 'center' },
  featureCardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  featureCardLabel: { fontSize: 15, fontWeight: '700', marginBottom: 4, letterSpacing: -0.3 },
  featureCardDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 10 },
  featureCardArrow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featureCardArrowText: { fontSize: 12, fontWeight: '700' },

  /* ── Smart Notifications ── */
  notificationPanel: { marginBottom: 16, marginTop: 4 },
  notificationPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationPanelTitle: { fontSize: 16, fontWeight: '800' },
  urgentBadge: { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  urgentBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  expandText: { fontSize: 13, fontWeight: '600' },
  smartNotificationCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  smartNotifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  smartNotifContent: { flex: 1 },
  smartNotifTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  smartNotifMessage: { fontSize: 12, lineHeight: 18 },
  smartNotifMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  smartNotifTime: { fontSize: 11, fontWeight: '500' },
  smartNotifActionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  smartNotifActionText: { fontSize: 11, fontWeight: '700' },
  dismissBtn: { padding: 4, marginLeft: 4 },

  /* ── Sound Mixer ── */
  soundMixerContainer: { borderRadius: 24, padding: 16, marginBottom: 8, marginHorizontal: 20 },
  soundMixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  soundMixerTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soundMixerIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  soundMixerTitleText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  soundMixerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  playAllButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  playAllButtonActive: { backgroundColor: '#f59e0b' },
  trackCard: { width: 110, marginRight: 12 },
  trackImage: { width: 110, height: 110, borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  trackOverlay: { flex: 1, justifyContent: 'flex-end', padding: 8 },
  trackPlayButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  trackPlayButtonActive: { backgroundColor: '#f59e0b' },
  trackTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  trackArtist: { fontSize: 11, fontWeight: '500' },
  playingIndicator: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 },
  bar: { width: 3, height: 12, backgroundColor: '#1DB954', borderRadius: 1 },
  barMiddle: { height: 18 },

  /* ── Activity List ── */
  activityItem: { marginVertical: 6, padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  activityIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  activityTime: { fontSize: 12, fontWeight: '500' },
  activityDetails: { fontSize: 12, marginTop: 2 },
  activityArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyStateCard: { padding: 32, alignItems: 'center', borderRadius: 24 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyStateText: { fontSize: 14, textAlign: 'center' },
  loadMoreButton: { marginTop: 16, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: 'rgba(102,126,234,0.08)' },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
  viewAllButton: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  viewAllText: { fontSize: 14, fontWeight: '700' },

  /* ── Section Headers ── */
  section: { marginTop: 8 },
  sectionFullWidth: { marginTop: 8, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.3 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontWeight: '600' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  sectionHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeaderActionText: { fontSize: 13, fontWeight: '700' },
});