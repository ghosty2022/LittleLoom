// src/screens/main/HomeScreen.tsx - Complete with Supabase Integration
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
  TextInput,
  TouchableOpacity,
  Pressable,
  useColorScheme,
  View,
} from 'react-native';

import { useCustomization } from '../../hooks/useCustomization';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../context/TrackerContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCommunity } from '../../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../../context/AudioContext';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay, differenceInHours, differenceInDays, differenceInMonths } from 'date-fns';

import { SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');
const SCREEN_W = width;

// ─── LOGO - Handle missing file gracefully ───
let littleLoomLogo: any = null;
try {
  littleLoomLogo = require('../../../assets/logo.png');
} catch (e) {
  // Logo not found - use a fallback
  littleLoomLogo = null;
}

// ─── TYPES ───
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
  type: 'vaccine' | 'milestone' | 'reminder' | 'growth' | 'streak' | 'tip';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  actionScreen?: keyof RootStackParamList;
  actionParams?: Record<string, any>;
  actionLabel?: string;
  icon: string;
  iconColor: string;
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

// ─── DATA ───
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
  { id: 'milestones', label: 'Milestones', icon: 'trophy-outline', color: '#ec4899', screen: 'Achievements', description: 'Track developmental wins' },
  { id: 'reminders', label: 'Reminders', icon: 'alarm-outline', color: '#f59e0b', screen: 'TrackerReminders', description: 'Never miss a thing' },
  { id: 'family', label: 'Family Hub', icon: 'people-outline', color: '#3b82f6', screen: 'FamilySharing', description: 'Share with caregivers' },
  { id: 'safety', label: 'Safety Corner', icon: 'shield-checkmark-outline', color: '#ef4444', screen: 'SafetyCorner', description: 'Tips & emergency info' },
  { id: 'gallery', label: 'Memories', icon: 'images-outline', color: '#8b5cf6', screen: 'Gallery', description: 'Photos & moments' },
  { id: 'chat', label: 'Family Chat', icon: 'chatbubbles-outline', color: '#06b6d4', screen: 'FamilyChatList', description: 'Stay connected' },
  { id: 'sound', label: 'Sound Mixer', icon: 'musical-notes-outline', color: '#1DB954', screen: 'SoundMixer', description: 'White noise & lullabies' },
  { id: 'vaccine', label: 'Vaccines', icon: 'medical-outline', color: '#e11d48', screen: 'VaccinationSchedule', description: 'Schedule & records' },
  { id: 'help', label: 'Help Center', icon: 'help-buoy-outline', color: '#4facfe', screen: 'HelpCenter', description: 'Guides & support' },
];

// ─── COMPONENT: Sticky Header ───
interface StickyHeaderProps {
  isDark: boolean;
  currentBaby: any;
  onNotificationPress: () => void;
  onLockPress: () => void;
  onProfilePress: () => void;
  onBabyPress: () => void;
  onAddBabyPress: () => void;
  unreadCount: number;
  onSettingsPress: () => void;
  onSafetyPress: () => void;
  primary: string;
  theme: any;
  fontSizeMultiplier: number;
}

const StickyHeader: React.FC<StickyHeaderProps> = React.memo(({
  isDark,
  currentBaby,
  onNotificationPress,
  onLockPress,
  onProfilePress,
  onBabyPress,
  onAddBabyPress,
  unreadCount,
  onSettingsPress,
  onSafetyPress,
  primary,
  theme,
  fontSizeMultiplier,
}) => {
  const iconSize = Math.round(20 * fontSizeMultiplier);
  const headerBg = isDark ? 'rgba(10,10,20,0.92)' : 'rgba(255,255,255,0.92)';

  return (
    <Animated.View style={[styles.stickyHeader, { backgroundColor: headerBg, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
      <BlurView intensity={isDark ? 80 : 90} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      
      <View style={styles.stickyHeaderContent}>
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity onPress={onSafetyPress} style={[styles.headerIconBtn, { width: 36, height: 36 }]}>
            <LinearGradient colors={['#dc2626', '#ef4444']} style={[styles.safetyIconGradient, { width: 34, height: 34, borderRadius: 10 }]}>
              <Ionicons name="shield-checkmark-outline" size={Math.round(15 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.stickyHeaderCenter}>
          <View style={styles.logoWrap}>
            {littleLoomLogo ? (
              <Image source={littleLoomLogo} style={[styles.logoImage, { width: Math.round(40 * fontSizeMultiplier), height: Math.round(40 * fontSizeMultiplier) }]} resizeMode="contain" />
            ) : (
              <View style={[styles.logoFallback, { width: Math.round(40 * fontSizeMultiplier), height: Math.round(40 * fontSizeMultiplier), borderRadius: Math.round(20 * fontSizeMultiplier), backgroundColor: primary }]}>
                <Text style={[styles.logoFallbackText, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>LL</Text>
              </View>
            )}
            <Text style={[styles.logoText, { color: theme.text, fontSize: Math.round(18 * fontSizeMultiplier) }]}>LittleLoom</Text>
          </View>
        </View>

        <View style={styles.stickyHeaderRight}>
          <TouchableOpacity onPress={onNotificationPress} style={[styles.headerIconBtn, { width: 36, height: 36 }]}>
            <Ionicons name="notifications-outline" size={iconSize} color={theme.text} />
            {unreadCount > 0 && (
              <View style={[styles.badgeDot, { backgroundColor: '#ef4444' }]}>
                <Text style={[styles.badgeText, { fontSize: Math.round(9 * fontSizeMultiplier) }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSettingsPress} style={[styles.headerIconBtn, { width: 36, height: 36 }]}>
            <Ionicons name="settings-outline" size={iconSize} color={theme.text} />
          </TouchableOpacity>

          {currentBaby ? (
            <TouchableOpacity onPress={onBabyPress} style={[styles.headerIconBtn, { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' }]}>
              <SafeBabyAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={32} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onAddBabyPress} style={[styles.headerIconBtn, { width: 36, height: 36 }]}>
              <Ionicons name="add-circle-outline" size={iconSize + 4} color={primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onLockPress} style={[styles.headerIconBtn, { width: 36, height: 36 }]}>
            <LinearGradient colors={['#ff6b6b', '#ee5a5a']} style={[styles.lockIconGradient, { width: 32, height: 32, borderRadius: 16 }]}>
              <Ionicons name="lock-closed-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── COMPONENT: Glass Card ───
const GlassCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; isDark: boolean }> = 
  React.memo(({ children, style, onPress, isDark }) => {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
      <Wrapper onPress={onPress} activeOpacity={0.85} style={[
        styles.glassCard,
        {
          backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        style
      ]}>
        {children}
      </Wrapper>
    );
  });

// ─── COMPONENT: Daily Summary ───
const DailySummaryWidget: React.FC<{
  summary: DailySummary;
  isDark: boolean;
  theme: any;
  onPress: (type: string) => void;
  streakDays: number;
}> = React.memo(({ summary, isDark, theme, onPress, streakDays }) => {
  const items = [
    { id: 'feeds', label: 'Feeds', value: summary.feeds.toString(), sublabel: summary.lastFeedTime ? formatDistanceToNow(summary.lastFeedTime, { addSuffix: true }) : 'No feeds', icon: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#fee140'] as [string, string] },
    { id: 'sleep', label: 'Sleep', value: `${summary.sleepHours.toFixed(1)}h`, sublabel: summary.lastSleepTime ? formatDistanceToNow(summary.lastSleepTime, { addSuffix: true }) : 'No sleep', icon: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'] as [string, string] },
    { id: 'diapers', label: 'Diapers', value: summary.diapers.toString(), sublabel: 'Today', icon: 'shirt-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] as [string, string] },
    { id: 'streak', label: 'Streak', value: `${streakDays}d`, sublabel: streakDays > 0 ? 'Keep it up!' : 'Start tracking!', icon: 'flame-outline', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] as [string, string] },
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
            {format(new Date(), 'EEE, MMM d')}
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

// ─── COMPONENT: Smart Context ───
const SmartContextCard: React.FC<{
  isDark: boolean;
  theme: any;
  onPress: () => void;
}> = React.memo(({ isDark, theme, onPress }) => {
  const hour = new Date().getHours();
  
  const context = useMemo(() => {
    if (hour >= 5 && hour < 9) {
      return { icon: 'partly-sunny-outline', title: 'Good Morning!', message: 'Time for the first feed and morning routine', color: '#f59e0b', bg: '#fef3c7', action: 'Log Morning Feed' };
    } else if (hour >= 9 && hour < 12) {
      return { icon: 'sunny-outline', title: 'Mid-Morning Activity', message: 'Ideal time for play and developmental activities', color: '#10b981', bg: '#d1fae5', action: 'Log Play Time' };
    } else if (hour >= 12 && hour < 15) {
      return { icon: 'restaurant-outline', title: 'Lunch Time', message: "Don't forget to log the midday feed", color: '#fa709a', bg: '#fce7f3', action: 'Log Feed' };
    } else if (hour >= 15 && hour < 18) {
      return { icon: 'walk-outline', title: 'Afternoon Stroll', message: 'Fresh air helps with nap time later', color: '#3b82f6', bg: '#dbeafe', action: 'Start Walk' };
    } else if (hour >= 18 && hour < 21) {
      return { icon: 'moon-outline', title: 'Wind Down Time', message: 'Start the bedtime routine for better sleep', color: '#6366f1', bg: '#e0e7ff', action: 'Start Sleep Timer' };
    } else {
      return { icon: 'moon-outline', title: 'Night Mode', message: 'Quiet time - check if baby needs anything', color: '#4c1d95', bg: '#ede9fe', action: 'Log Night Feed' };
    }
  }, [hour]);

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.7)', 'rgba(35,35,50,0.5)'] : [`${context.bg}80`, `${context.bg}40`]}
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
            <Text style={[styles.contextActionText, { color: context.color }]}>{context.action}</Text>
            <Ionicons name="arrow-forward" size={12} color={context.color} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── COMPONENT: Next Best Action ───
const NextBestAction: React.FC<{
  isDark: boolean;
  theme: any;
  lastActivities: any[];
  onAction: (screen: string, params?: any) => void;
}> = React.memo(({ isDark, theme, lastActivities, onAction }) => {
  const suggestion = useMemo(() => {
    const now = new Date();
    const lastFeed = lastActivities.find((a: any) => a.type === 'feed');
    const lastSleep = lastActivities.find((a: any) => a.type === 'sleep');
    const lastDiaper = lastActivities.find((a: any) => a.type === 'diaper');

    const hoursSinceFeed = lastFeed ? differenceInHours(now, new Date(lastFeed.timestamp)) : 999;
    const hoursSinceSleep = lastSleep ? differenceInHours(now, new Date(lastSleep.timestamp)) : 999;
    const hoursSinceDiaper = lastDiaper ? differenceInHours(now, new Date(lastDiaper.timestamp)) : 999;

    if (hoursSinceFeed >= 3) {
      return { id: 'feed-now', title: 'Time to Feed', subtitle: `Last feed was ${hoursSinceFeed}h ago`, icon: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#fee140'] as [string, string], screen: 'UniversalTrackerHub', params: { type: 'feed' }, urgency: 'high' };
    }
    if (hoursSinceDiaper >= 3) {
      return { id: 'diaper-now', title: 'Check Diaper', subtitle: `Last change was ${hoursSinceDiaper}h ago`, icon: 'shirt-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] as [string, string], screen: 'UniversalTrackerHub', params: { type: 'diaper' }, urgency: 'normal' };
    }
    if (hoursSinceSleep >= 4) {
      return { id: 'sleep-now', title: 'Sleep Window Opening', subtitle: `Awake for ${hoursSinceSleep}h — watch for cues`, icon: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'] as [string, string], screen: 'UniversalTrackerHub', params: { type: 'sleep' }, urgency: 'normal' };
    }

    return { id: 'all-good', title: 'All Caught Up!', subtitle: 'Everything looks good. Enjoy the moment', icon: 'checkmark-circle-outline', color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string], screen: 'UniversalTrackerHub', params: { type: 'note' }, urgency: 'low' };
  }, [lastActivities]);

  if (!suggestion) return null;

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <TouchableOpacity onPress={() => onAction(suggestion.screen, suggestion.params)} activeOpacity={0.9} style={styles.nextActionContainer}>
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

// ─── COMPONENT: Recent Activity ───
const RecentActivityList: React.FC<{
  activities: any[];
  isDark: boolean;
  theme: any;
  onViewAll: () => void;
  onActivityPress: (activity: any) => void;
}> = React.memo(({ activities, isDark, theme, onViewAll, onActivityPress }) => {
  const displayedActivities = activities.slice(0, 5);

  const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; emoji: string }> = {
    potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '💧' },
    feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
    sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
    growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
    medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
    milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🏆' },
    diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper', emoji: '👶' },
    note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
    default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '•' },
  };

  const formatTimeAgo = (timestamp: number): string => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return format(new Date(timestamp), 'MMM d');
  };

  if (!activities || activities.length === 0) {
    return (
      <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
        <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
        <Text style={[styles.emptyStateText, { color: theme.textMuted }]}>No recent activity</Text>
        <TouchableOpacity style={[styles.addFirstActivityBtn, { backgroundColor: theme.primary }]} onPress={onViewAll}>
          <Text style={styles.addFirstActivityText}>Log First Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      {displayedActivities.map((event, index) => {
        const config = ACTIVITY_CONFIG[event?.type || 'default'] || ACTIVITY_CONFIG.default;
        const isLast = index === displayedActivities.length - 1;

        return (
          <Animated.View key={event?.id || `activity-${index}`} entering={FadeInUp.delay(index * 40).springify()}>
            <TouchableOpacity onPress={() => onActivityPress(event)} style={styles.timelineItem} activeOpacity={0.7}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: config.color, borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]} />
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />}
              </View>

              <View style={[styles.timelineCard, { backgroundColor: isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.8)', borderColor: theme.border }]}>
                <View style={styles.timelineCardContent}>
                  <View style={styles.timelineCardHeader}>
                    <View style={[styles.timelineIconBg, { backgroundColor: config.color + '10' }]}>
                      <Text style={styles.timelineEmoji}>{config.emoji}</Text>
                    </View>
                    <View style={styles.timelineCardInfo}>
                      <Text style={[styles.timelineCardTitle, { color: theme.text }]} numberOfLines={1}>
                        {event?.title || event?.name || config.label}
                      </Text>
                      <Text style={[styles.timelineCardActor, { color: theme.textMuted }]}>
                        {formatTimeAgo(event?.timestamp)}
                        {event?.loggedByName ? ` • by ${event.loggedByName}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.timelineTypeBadge, { backgroundColor: config.color + '08' }]}>
                      <Text style={[styles.timelineTypeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                  </View>
                  {(event?.details || event?.notes) && (
                    <Text style={[styles.timelineCardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {event.details || event.notes}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
        <Text style={[styles.viewAllText, { color: theme.primary }]}>View All Activity</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
});

// ─── COMPONENT: Categorized Quick Actions ───
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
  const availableWidth = SCREEN_W - (margin * 2);
  const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

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
                isActive && { backgroundColor: theme.primary },
                !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
              ]}
            >
              <Ionicons name={tab.icon as any} size={13} color={isActive ? '#fff' : theme.textSecondary} />
              <Text style={[styles.categoryTabText, { color: isActive ? '#fff' : theme.textSecondary }, isActive && { fontWeight: '700' }]}>
                {tab.label}
              </Text>
              <View style={[styles.categoryTabBadge, isActive ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.categoryTabBadgeText, { color: isActive ? '#fff' : theme.textMuted }]}>
                  {count}
                </Text>
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

// ─── COMPONENT: Feature Cards Row ───
const FeatureCardsRow: React.FC<{
  items: FeatureCard[];
  onPress: (item: FeatureCard) => void;
  isDark: boolean;
  theme: any;
}> = React.memo(({ items, onPress, isDark, theme }) => (
  <Animated.View entering={FadeInUp.delay(150).springify()}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureCardsScroll} decelerationRate="fast">
      {items.map((item) => (
        <TouchableOpacity key={item.id} onPress={() => onPress(item)} activeOpacity={0.85} style={styles.featureCardTouchable}>
          <View style={[styles.featureCard, { borderColor: `${item.color}20`, backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff' }]}>
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
));

// ─── MAIN HOMESCREEN ───
export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const { 
    themeColors, 
    fullThemeColors, 
    darkMode, 
    triggerHaptic, 
    fontSizeMultiplier,
    settings,
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
    ...fullThemeColors,
    primary,
    secondary,
    accent,
  }), [fullThemeColors, primary, secondary, accent, isDark]);

  const scrollY = useSharedValue(0);

  const { userProfile, isAuthenticated } = useAuth();
  const { 
    currentBaby, 
    loadBabies, 
    getPottyStreak, 
    growthData, 
    milestones,
    getGrowthData,
    getTodayFeedCount,
    getTodaySleepCount,
    getTodayPottyCount,
  } = useBaby();
  const { entries: trackerEntries, loadEntries: loadTrackerEntries } = useTracker();
  const { lockApp, getAvailableAuthMethods } = useSecurity();
  const { getUnreadCount } = useCommunity();
  const { success, error, toast } = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);

  // ── Load Data ──
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([loadBabies(), loadTrackerEntries()]);
      } catch (err) {
        console.warn('[HomeScreen] Load data error:', err);
      }
    };
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBabies();
      loadTrackerEntries();
    }, [loadBabies, loadTrackerEntries])
  );

  // ── Greeting ──
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Smart Notifications ──
  useEffect(() => {
    if (!currentBaby) return;
    const now = Date.now();
    const birthDate = currentBaby.dateOfBirth ? new Date(currentBaby.dateOfBirth) : null;
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
        timestamp: now,
      });
    }

    setSmartNotifications(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newNotifs = notifications.filter(n => !existingIds.has(n.id));
      return [...prev.filter(p => !p.dismissed), ...newNotifs].slice(-10);
    });
  }, [currentBaby?.id, currentBaby?.dateOfBirth, currentBaby?.name, getPottyStreak]);

  // ── Daily Summary ──
  const dailySummary = useMemo((): DailySummary => {
    if (!currentBaby) return { feeds: 0, sleepHours: 0, diapers: 0, lastFeedTime: null, lastSleepTime: null };

    const todayEntries = trackerEntries.filter((e: any) => {
      const eDate = new Date(e.timestamp);
      return isSameDay(eDate, new Date());
    });

    const feeds = todayEntries.filter((e: any) => e.type === 'feed').length;
    const sleepEntries = todayEntries.filter((e: any) => e.type === 'sleep');
    const sleepHours = sleepEntries.reduce((sum: number, e: any) => sum + (e.duration || e.value || 0), 0) / 60;
    const diapers = todayEntries.filter((e: any) => e.type === 'diaper').length;

    const lastFeed = trackerEntries.filter((e: any) => e.type === 'feed').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
    const lastSleep = trackerEntries.filter((e: any) => e.type === 'sleep').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

    return {
      feeds,
      sleepHours,
      diapers,
      lastFeedTime: lastFeed ? new Date(lastFeed.timestamp) : null,
      lastSleepTime: lastSleep ? new Date(lastSleep.timestamp) : null,
    };
  }, [trackerEntries, currentBaby]);

  // ── Growth Stats ──
  const growthStats = useMemo(() => {
    if (!currentBaby) return null;
    const result: Record<string, any> = {};
    const types = ['height', 'weight', 'head'] as const;

    types.forEach((type) => {
      const data = getGrowthData(type as any).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const current = data[0];
      const prev = data[1];
      if (current) {
        result[type] = {
          value: Number(current.value).toFixed(1),
          unit: current.unit || 'cm',
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

  // ── Vaccination Reminders ──
  const vaccinationReminders = useMemo((): VaccinationReminder[] => {
    if (!currentBaby?.dateOfBirth) return [];
    const ageDays = differenceInDays(new Date(), new Date(currentBaby.dateOfBirth));
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

    return reminders.slice(0, 3);
  }, [currentBaby]);

  // ── Navigation ──
  const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
    navigation.navigate(screenName as any, params || {});
  }, [navigation]);

  // ── Handlers ──
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
    const babyRequiredFeatures = new Set(['growth', 'milestones', 'reminders', 'family', 'gallery', 'chat', 'vaccine']);
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

  const handleSmartNotifAction = useCallback((notif: SmartNotification) => {
    triggerHaptic('light');
    if (notif.actionScreen) {
      navigateToScreen(notif.actionScreen as string, notif.actionParams);
    }
  }, [navigateToScreen, triggerHaptic]);

  const handleSmartNotifDismiss = useCallback((id: string) => {
    setSmartNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadBabies(), loadTrackerEntries()]);
      success('Refreshed!', 'Your dashboard is up to date.');
    } catch (err) {
      error('Refresh Failed', 'Could not update dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadTrackerEntries, success, error]);

  const unreadCount = getUnreadCount();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const scrollTopPadding = Platform.OS === 'ios' ? (settings.compactSpacing ? 100 : 120) : (settings.compactSpacing ? 90 : 105);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#0c0c18', '#12121e'] : ['#f8faff', '#eef0f5', '#e4e8f0']} 
        style={StyleSheet.absoluteFill} 
      />

      <StickyHeader
        isDark={isDark}
        currentBaby={currentBaby}
        onNotificationPress={() => setShowNotificationChooser(true)}
        onLockPress={handleLockPress}
        onProfilePress={() => navigateToScreen('Profile')}
        onBabyPress={() => navigateToScreen('SwitchBaby', { returnTo: 'Main' })}
        onAddBabyPress={() => navigateToScreen('CreateBabyProfile')}
        unreadCount={unreadCount}
        onSettingsPress={() => navigateToScreen('More')}
        onSafetyPress={() => navigateToScreen('SafetyCorner')}
        primary={primary}
        theme={theme}
        fontSizeMultiplier={fontSizeMultiplier}
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
        {/* ── Parent Card ── */}
        <Animated.View entering={FadeInDown.springify()}>
          <GlassCard isDark={isDark} style={[styles.parentCard, { marginHorizontal: 20 }]}>
            <View style={[styles.parentHeader, { padding: 16 }]}>
              <SafeParentAvatar
                avatar={userProfile?.avatar}
                name={userProfile?.fullName || 'Parent'}
                size={52}
                onPress={() => navigateToScreen('Profile')}
                showEditBadge={true}
              />
              <View style={styles.parentInfo}>
                <Text style={[styles.greetingText, { color: theme.textMuted }]}>{greeting}</Text>
                <Text style={[styles.parentName, { color: theme.text }]}>{userProfile?.fullName || 'Parent'}</Text>
                <View style={styles.parentMeta}>
                  <View style={[styles.verifiedBadge, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={accent} />
                    <Text style={[styles.verifiedText, { color: accent }]}>Verified</Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.textMuted }]}>
                    {format(currentTime, 'EEE, MMM d')}
                  </Text>
                </View>
              </View>
              <View style={styles.parentQuickLinks}>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${primary}12`, borderRadius: 10 }]} 
                  onPress={() => navigateToScreen('Achievements')}
                >
                  <Ionicons name="ribbon-outline" size={18} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.parentQuickLink, { backgroundColor: `${secondary}12`, borderRadius: 10 }]} 
                  onPress={() => navigateToScreen('Connect')}
                >
                  <Ionicons name="people-outline" size={18} color={secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Baby Card ── */}
        {currentBaby ? (
          <Animated.View entering={FadeInUp.delay(40).springify()}>
            <GlassCard isDark={isDark} style={[styles.babyCard, { marginHorizontal: 20 }]}>
              <View style={[styles.babyHeader, { paddingHorizontal: 16, paddingTop: 12 }]}>
                <TouchableOpacity style={styles.babySelector} onPress={() => navigateToScreen('SwitchBaby', { returnTo: 'Main' })}>
                  <Text style={[styles.babySelectorLabel, { color: theme.textMuted }]}>Current Baby</Text>
                  <Ionicons name="chevron-down-outline" size={14} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editButton, { backgroundColor: `${primary}08`, borderRadius: 8 }]} onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}>
                  <Ionicons name="create-outline" size={16} color={primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.babyMainInfo, { padding: 16 }]}>
                <SafeBabyAvatar
                  avatar={currentBaby.avatar}
                  gender={currentBaby.gender}
                  size={64}
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                  showBadge={true}
                />
                <View style={styles.babyDetails}>
                  <Text style={[styles.babyName, { color: theme.text }]}>{currentBaby.name}</Text>
                  <Text style={[styles.babyAge, { color: theme.textSecondary }]}>{currentBaby.age}</Text>
                  <View style={styles.babyStatus}>
                    <Ionicons name="pulse-outline" size={12} color="#10b981" />
                    <Text style={[styles.babyStatusText, { color: '#10b981' }]}>Healthy & Active</Text>
                  </View>
                </View>
                <LinearGradient colors={[secondary, '#fee140']} style={[styles.streakBadge, { borderRadius: 12 }]}>
                  <Ionicons name="flame-outline" size={14} color="#fff" />
                  <Text style={styles.streakText}>{getPottyStreak()}d</Text>
                </LinearGradient>
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.delay(40).springify()}>
            <TouchableOpacity onPress={() => navigateToScreen('CreateBabyProfile')}>
              <GlassCard isDark={isDark} style={[styles.noBabyCard, { marginHorizontal: 20 }]}>
                <LinearGradient colors={[primary, '#764ba2']} style={[styles.noBabyGradient, { borderRadius: 22 }]}>
                  <Text style={styles.noBabyEmoji}>👶</Text>
                  <Text style={[styles.noBabyTitle, { color: '#fff' }]}>Welcome to LittleLoom!</Text>
                  <Text style={[styles.noBabyText, { color: 'rgba(255,255,255,0.85)' }]}>
                    Create your first baby profile to start tracking
                  </Text>
                  <View style={[styles.noBabyButton, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14 }]}>
                    <Text style={[styles.noBabyButtonText, { color: '#fff' }]}>Get Started</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color="#fff" />
                  </View>
                </LinearGradient>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Growth Snapshot ── */}
        {currentBaby && growthStats && (
          <Animated.View entering={FadeInUp.delay(50).springify()}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 20, marginTop: 6 }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="pulse-outline" size={18} color={primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Growth Snapshot</Text>
              </View>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('GrowthDashboard')}>
                <Text style={[styles.seeAllText, { color: primary }]}>Full Dashboard</Text>
                <Ionicons name="arrow-forward-outline" size={14} color={primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.kpiGrid, { paddingHorizontal: 20 }]}>
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
                  <TouchableOpacity key={m.key} onPress={() => navigateToScreen('GrowthDashboard')} activeOpacity={0.85} style={[styles.kpiHomeCard, { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)', borderColor: m.color + '20' }]}>
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
          </Animated.View>
        )}

        {/* ── Daily Summary ── */}
        {currentBaby && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <DailySummaryWidget
              summary={dailySummary}
              isDark={isDark}
              theme={theme}
              onPress={(type) => {
                const typeMap: Record<string, string> = { feeds: 'feed', sleep: 'sleep', diapers: 'diaper', streak: 'potty' };
                navigateToScreen('UniversalTrackerHub', { type: typeMap[type] || type });
              }}
              streakDays={getPottyStreak()}
            />
          </View>
        )}

        {/* ── Smart Context ── */}
        {currentBaby && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <SmartContextCard isDark={isDark} theme={theme} onPress={() => {
              const hour = new Date().getHours();
              if (hour >= 5 && hour < 9) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
              else if (hour >= 9 && hour < 12) navigateToScreen('UniversalTrackerHub', { type: 'play' });
              else if (hour >= 12 && hour < 15) navigateToScreen('UniversalTrackerHub', { type: 'feed' });
              else if (hour >= 15 && hour < 18) navigateToScreen('UniversalTrackerHub', { type: 'walk' });
              else if (hour >= 18 && hour < 21) navigateToScreen('UniversalTrackerHub', { type: 'sleep' });
              else navigateToScreen('UniversalTrackerHub', { type: 'feed' });
            }} />
          </View>
        )}

        {/* ── Next Best Action ── */}
        {currentBaby && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <NextBestAction
              isDark={isDark}
              theme={theme}
              lastActivities={trackerEntries}
              onAction={(screen, params) => navigateToScreen(screen, params)}
            />
          </View>
        )}

        {/* ── Smart Notifications ── */}
        {smartNotifications.filter(n => !n.dismissed).length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <View style={styles.notificationPanel}>
              <View style={styles.notificationPanelHeader}>
                <View style={styles.notificationPanelTitleRow}>
                  <View style={[styles.notificationPanelIconWrap, { backgroundColor: `${primary}12`, borderRadius: 8 }]}>
                    <Ionicons name="notifications-outline" size={18} color={primary} />
                  </View>
                  <Text style={[styles.notificationPanelTitle, { color: theme.text }]}>Smart Alerts</Text>
                </View>
              </View>
              {smartNotifications.filter(n => !n.dismissed).slice(0, 2).map((notif, index) => (
                <Animated.View key={notif.id} entering={FadeInUp.delay(index * 40)}>
                  <TouchableOpacity
                    style={[styles.smartNotificationCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)', borderColor: theme.border, borderLeftColor: notif.iconColor, borderLeftWidth: 3 }]}
                    onPress={() => handleSmartNotifAction(notif)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.smartNotifIcon, { backgroundColor: `${notif.iconColor}12`, borderRadius: 10 }]}>
                      <Ionicons name={notif.icon as any} size={16} color={notif.iconColor} />
                    </View>
                    <View style={styles.smartNotifContent}>
                      <Text style={[styles.smartNotifTitle, { color: theme.text }]} numberOfLines={1}>{notif.title}</Text>
                      <Text style={[styles.smartNotifMessage, { color: theme.textSecondary }]} numberOfLines={1}>{notif.message}</Text>
                      {notif.actionLabel && (
                        <View style={[styles.smartNotifActionBadge, { backgroundColor: `${notif.iconColor}10`, borderRadius: 6 }]}>
                          <Text style={[styles.smartNotifActionText, { color: notif.iconColor }]}>{notif.actionLabel}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity style={styles.dismissBtn} onPress={() => handleSmartNotifDismiss(notif.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* ── Categorized Quick Actions ── */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={18} color={primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
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

        {/* ── Feature Cards ── */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps-outline" size={18} color="#f59e0b" />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Tools & Features</Text>
            </View>
          </View>
          <FeatureCardsRow
            items={FEATURE_CARDS.map((f) => {
              if (f.id === 'growth' && growthStats?.height) return { ...f, badge: growthStats.height.value + 'cm', badgeColor: '#10b981' };
              if (f.id === 'milestones') return { ...f, badge: milestones.length + ' Total', badgeColor: '#ec4899' };
              if (f.id === 'vaccine') return { ...f, badge: vaccinationReminders.filter(r => r.status !== 'completed').length + ' Due', badgeColor: '#e11d48' };
              return f;
            })}
            onPress={handleFeaturePress}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ── Vaccination Reminders ── */}
        {currentBaby && vaccinationReminders.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <Animated.View entering={FadeInUp.delay(120).springify()}>
              <View style={[styles.vaccineContainer, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(45,45,60,0.4)' : 'rgba(255,255,255,0.7)', borderRadius: 22, padding: 14 }]}>
                <View style={styles.vaccineHeader}>
                  <View style={styles.vaccineTitleRow}>
                    <View style={[styles.vaccineIconWrap, { backgroundColor: '#e11d4815', borderRadius: 8 }]}>
                      <Ionicons name="medical-outline" size={20} color="#e11d48" />
                    </View>
                    <View>
                      <Text style={[styles.vaccineTitle, { color: theme.text }]}>Vaccination Schedule</Text>
                      <Text style={[styles.vaccineSubtitle, { color: theme.textMuted }]}>
                        {vaccinationReminders.filter(r => r.status !== 'completed').length} upcoming
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => navigateToScreen('VaccinationSchedule')} style={[styles.vaccineSeeAll, { backgroundColor: `${primary}10`, borderRadius: 8 }]}>
                    <Text style={[styles.vaccineSeeAllText, { color: primary }]}>View All</Text>
                    <Ionicons name="chevron-forward" size={12} color={primary} />
                  </TouchableOpacity>
                </View>

                {vaccinationReminders.slice(0, 3).map((reminder, i) => {
                  const isOverdue = reminder.status === 'overdue';
                  const daysUntil = differenceInDays(reminder.dueDate, new Date());
                  return (
                    <View key={reminder.id} style={[styles.vaccineRow, i < vaccinationReminders.slice(0, 3).length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                      <View style={[styles.vaccineDot, { backgroundColor: isOverdue ? '#ef4444' : '#f59e0b' }]} />
                      <View style={styles.vaccineInfo}>
                        <Text style={[styles.vaccineName, { color: theme.text }]} numberOfLines={1}>{reminder.vaccineName}</Text>
                        <Text style={[styles.vaccineDose, { color: theme.textMuted }]}>Dose {reminder.doseNumber}</Text>
                      </View>
                      <View style={[styles.vaccineBadge, { backgroundColor: isOverdue ? '#ef444415' : '#f59e0b15', borderRadius: 6 }]}>
                        <Text style={[styles.vaccineBadgeText, { color: isOverdue ? '#ef4444' : '#f59e0b' }]}>
                          {isOverdue ? 'Overdue' : daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        )}

        {/* ── Recent Activity ── */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={18} color={secondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('Timeline', { type: 'all' })}>
              <Text style={[styles.seeAllText, { color: primary }]}>View All</Text>
              <Ionicons name="arrow-forward-outline" size={14} color={primary} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            <RecentActivityList
              activities={trackerEntries}
              isDark={isDark}
              theme={theme}
              onViewAll={() => navigateToScreen('Timeline', { type: 'all' })}
              onActivityPress={(activity) => navigateToScreen('Timeline', { type: activity.type })}
            />
          </View>
        </View>

        <View style={{ height: settings.compactSpacing ? 80 : 120 }} />
      </Animated.ScrollView>

      {/* ── Notification Chooser Modal ── */}
      <Modal visible={showNotificationChooser} transparent animationType="fade" onRequestClose={() => setShowNotificationChooser(false)}>
        <Pressable style={styles.notificationModalOverlay} onPress={() => setShowNotificationChooser(false)}>
          <View style={[styles.notificationModalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)', borderRadius: 24 }]}>
            <View style={styles.notificationModalHeader}>
              <Text style={[styles.notificationModalTitle, { color: theme.text }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.notificationModalOption} onPress={() => { setShowNotificationChooser(false); navigateToScreen('TrackerReminders'); }}>
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${primary}15`, borderRadius: 14 }]}>
                <Ionicons name="notifications" size={20} color={primary} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>App Reminders</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Your tracking reminders & alerts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.notificationModalOption} onPress={() => { setShowNotificationChooser(false); navigateToScreen('Connect'); }}>
              <View style={[styles.notificationModalIconWrap, { backgroundColor: `${secondary}15`, borderRadius: 14 }]}>
                <Ionicons name="people" size={20} color={secondary} />
              </View>
              <View style={styles.notificationModalTextWrap}>
                <Text style={[styles.notificationModalOptionTitle, { color: theme.text }]}>Community</Text>
                <Text style={[styles.notificationModalOptionDesc, { color: theme.textMuted }]}>Loom mentions, replies & follows</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Baby Required Modal ── */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)', borderRadius: 28 }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${secondary}15`, borderRadius: 24 }]}>
              <LinearGradient colors={[secondary, primary]} style={[styles.modalIconGradient, { borderRadius: 24 }]}>
                <Ionicons name="people-outline" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Create a baby profile to start tracking {pendingAction?.label || 'activities'} and unlock all features.
            </Text>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: primary, borderRadius: 18 }]} onPress={() => { setShowBabyRequiredModal(false); navigateToScreen('CreateBabyProfile'); }}>
              <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setShowBabyRequiredModal(false)}>
              <Text style={[styles.modalSecondaryBtnText, { color: theme.textMuted }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Security Setup Modal ── */}
      <Modal visible={showSecurityModal} transparent animationType="fade" onRequestClose={() => setShowSecurityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSecurityModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)', borderRadius: 28 }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${primary}15`, borderRadius: 24 }]}>
              <Ionicons name="shield-outline" size={32} color={primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>No Security Enabled</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              You haven't set up a PIN or biometric lock yet. You can still lock the app, but anyone can unlock it.
            </Text>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: primary, borderRadius: 18 }]} onPress={() => { setShowSecurityModal(false); navigateToScreen('SecurityCenter', { mode: 'setup' }); }}>
              <Text style={styles.modalPrimaryBtnText}>Set Up Security</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSecondaryBtn, { borderColor: `${primary}30`, borderWidth: 1, borderRadius: 18 }]} onPress={async () => { setShowSecurityModal(false); await lockApp(true); toast('App Locked', 'Locked without security. Tap unlock to enter.', 'warning'); }}>
              <Text style={[styles.modalSecondaryBtnText, { color: primary }]}>Lock Anyway</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 48 : 28, paddingBottom: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickyHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stickyHeaderCenter: { flex: 2, alignItems: 'center' },
  stickyHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  headerIconBtn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  safetyIconGradient: { alignItems: 'center', justifyContent: 'center' },
  lockIconGradient: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: { backgroundColor: 'transparent' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { color: '#fff', fontWeight: 'bold' },
  logoText: { fontWeight: '800', letterSpacing: -0.5 },
  badgeDot: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  badgeText: { color: 'white', fontWeight: 'bold' },

  // ── Glass Card ──
  glassCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 22 },

  // ── Parent Card ──
  parentCard: { marginBottom: 12, marginTop: 16 },
  parentHeader: { flexDirection: 'row', alignItems: 'center' },
  parentInfo: { flex: 1, marginLeft: 14 },
  greetingText: { fontWeight: '500', marginBottom: 1 },
  parentName: { fontWeight: '800', letterSpacing: -0.5 },
  parentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 10 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedText: { fontWeight: '600' },
  timeText: { fontWeight: '500' },
  parentQuickLinks: { flexDirection: 'row', gap: 6 },
  parentQuickLink: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // ── Baby Card ──
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

  // ── No Baby Card ──
  noBabyCard: { marginBottom: 14, overflow: 'hidden', marginTop: 16 },
  noBabyGradient: { padding: 28, alignItems: 'center' },
  noBabyEmoji: { fontSize: 44, marginBottom: 12 },
  noBabyTitle: { fontWeight: '800', fontSize: 18, marginBottom: 6 },
  noBabyText: { textAlign: 'center', fontSize: 13, marginBottom: 16 },
  noBabyButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 6 },
  noBabyButtonText: { fontWeight: '700' },

  // ── Daily Summary ──
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

  // ── Context Card ──
  contextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 22, borderWidth: 1 },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  contextIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contextText: { flex: 1 },
  contextTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  contextMessage: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  contextActionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  contextActionText: { fontSize: 11, fontWeight: '700' },

  // ── Next Action ──
  nextActionContainer: { borderRadius: 22, overflow: 'hidden' },
  nextActionGradient: { padding: 16 },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextActionIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextActionText: { flex: 1 },
  nextActionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  nextActionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1, color: 'rgba(255,255,255,0.85)' },
  nextActionArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextActionUrgency: { position: 'absolute', top: 10, right: 10 },
  urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // ── Timeline ──
  timelineContainer: { marginBottom: 0 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 0, bottom: -12, width: 2, left: 11 },
  timelineCard: { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
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
  addFirstActivityText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  viewAllButton: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  // ── Quick Actions ──
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
  actionBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  actionBadgeText: { fontSize: 10, fontWeight: '800' },
  actionBadgeLabel: { position: 'absolute', bottom: 4, left: 4, right: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' },
  actionBadgeLabelText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // ── Feature Cards ──
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

  // ── Notifications ──
  notificationPanel: { marginBottom: 0, marginTop: 0 },
  notificationPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationPanelIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  notificationPanelTitle: { fontSize: 15, fontWeight: '800' },
  smartNotificationCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 6, borderWidth: 1 },
  smartNotifIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  smartNotifContent: { flex: 1 },
  smartNotifTitle: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  smartNotifMessage: { fontSize: 11, lineHeight: 16 },
  smartNotifActionBadge: { paddingHorizontal: 8, paddingVertical: 3, marginTop: 3, alignSelf: 'flex-start' },
  smartNotifActionText: { fontSize: 10, fontWeight: '700' },
  dismissBtn: { padding: 3, marginLeft: 3 },

  // ── Vaccination ──
  vaccineContainer: { borderWidth: 1 },
  vaccineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vaccineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vaccineIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  vaccineTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  vaccineSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  vaccineSeeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4 },
  vaccineSeeAllText: { fontSize: 11, fontWeight: '700' },
  vaccineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  vaccineDot: { width: 8, height: 8, borderRadius: 4 },
  vaccineInfo: { flex: 1 },
  vaccineName: { fontSize: 13, fontWeight: '700' },
  vaccineDose: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  vaccineBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  vaccineBadgeText: { fontSize: 10, fontWeight: '700' },

  // ── Section Headers ──
  section: { marginTop: 6 },
  sectionFullWidth: { marginTop: 6, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', letterSpacing: -0.5 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontWeight: '600' },

  // ── Growth KPIs ──
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiHomeCard: { width: (SCREEN_W - 56) / 2, borderRadius: 20, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  kpiHomeIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  kpiHomeBody: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
  kpiHomeValue: { fontWeight: '800', letterSpacing: -0.5 },
  kpiHomeUnit: { fontWeight: '700' },
  kpiHomeTitle: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiHomeChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  kpiHomeChange: { fontWeight: '700' },

  // ── Modals ──
  notificationModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  notificationModalContent: { width: '100%', maxWidth: 360, padding: 20 },
  notificationModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  notificationModalTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  notificationModalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  notificationModalIconWrap: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notificationModalTextWrap: { flex: 1 },
  notificationModalOptionTitle: { fontSize: 16, fontWeight: '600' },
  notificationModalOptionDesc: { fontSize: 13, fontWeight: '500', marginTop: 2 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '100%', maxWidth: 360, padding: 28, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, marginBottom: 16, overflow: 'hidden' },
  modalIconGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
  modalDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, gap: 8, marginBottom: 12 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: { width: '100%', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600' },
});