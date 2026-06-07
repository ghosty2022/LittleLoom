import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  RefreshControl, Platform, Share, Switch, StatusBar, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp, FadeInDown, FadeInLeft, Layout,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolate, useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { differenceInHours, isSameDay, subDays, format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  category: 'milestone' | 'streak' | 'tracking' | 'social' | 'special' | 'care' | 'health';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string | null;
  streakAtRisk: boolean;
  hoursUntilBreak: number;
}

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning' | 'achievement';
  title: string;
  message: string;
  emoji?: string;
}

interface ScheduledReminder {
  notificationId: string;
  achievementId: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const ACHIEVEMENT_CATEGORIES = {
  milestone: { label: 'Milestones', icon: 'trophy', color: '#f59e0b' },
  streak: { label: 'Streaks', icon: 'flame', color: '#ef4444' },
  tracking: { label: 'Tracking', icon: 'analytics', color: '#3b82f6' },
  social: { label: 'Social', icon: 'people', color: '#10b981' },
  special: { label: 'Special', icon: 'star', color: '#8b5cf6' },
  care: { label: 'Care', icon: 'heart', color: '#ec4899' },
  health: { label: 'Health', icon: 'medical', color: '#06b6d4' },
} as const;

const RARITY_COLORS = {
  common: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', text: '#94a3b8' },
  rare: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.4)', text: '#3b82f6' },
  epic: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.5)', text: '#8b5cf6' },
  legendary: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.6)', text: '#f59e0b' },
};

const ACHIEVEMENT_REMINDERS_KEY = '@littleloom_achievement_reminders';
const SCHEDULED_NOTIFICATIONS_KEY = '@littleloom_achievement_notifications';
const LONGEST_STREAK_KEY = '@littleloom_longest_streak';
const ACHIEVEMENTS_UNLOCKED_KEY = '@littleloom_achievements_unlocked';
const ACHIEVEMENTS_PAGE_SIZE = 10;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   GLASSMORPHISM CARD
   ═══════════════════════════════════════════════════════════════ */

const GlassmorphismCard = ({ children, style, onPress, intensity = 80 }: any) => {
  const { darkMode: isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CIRCULAR PROGRESS
   ═══════════════════════════════════════════════════════════════ */

const CircularProgress = ({ progress, value, label, color, size = 70, strokeWidth = 6 }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;
  return (
    <View style={[styles.progressItem, { width: size + 16 }]}>
      <View style={[styles.progressSvgContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={color + '80'} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#grad-${label})`} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <Text style={[styles.progressValue, { color, fontSize: size * 0.28 }]}>{value}</Text>
      </View>
      <Text style={[styles.progressLabel, { fontSize: size * 0.2 }]}>{label}</Text>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SWEET ALERT
   ═══════════════════════════════════════════════════════════════ */

const SweetAlert = ({ visible, type, title, message, emoji, onClose, isDark }: any) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value, transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const config: any = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
    achievement: { colors: ['#f59e0b', '#fbbf24'], icon: 'trophy' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 }]} pointerEvents="none">
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          {emoji ? <Text style={{ fontSize: 28 }}>{emoji}</Text> : <Ionicons name={config.icon} size={28} color="#fff" />}
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT CARD ITEM (for FlatList)
   ═══════════════════════════════════════════════════════════════ */

interface AchievementCardProps {
  achievement: Achievement;
  index: number;
  isDark: boolean;
  isNew: boolean;
  hasReminder: boolean;
  reminderEnabled: Set<string>;
  rarity: typeof RARITY_COLORS[keyof typeof RARITY_COLORS];
  themeColors: any;
  onPress: (a: Achievement) => void;
  onToggleReminder: (a: Achievement) => void;
  shouldReduceMotion: boolean;
}

const AchievementCard = React.memo(({ 
  achievement, index, isDark, isNew, hasReminder, rarity, onPress, onToggleReminder, shouldReduceMotion 
}: AchievementCardProps) => {
  const progress = (achievement.progress / achievement.maxProgress) * 100;
  
  return (
    <Animated.View 
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50)} 
      layout={shouldReduceMotion ? undefined : Layout.springify()}
    >
      <TouchableOpacity onPress={() => onPress(achievement)} activeOpacity={0.9}>
        <BlurView intensity={achievement.unlocked ? 90 : 70} 
          style={[
            styles.achievementCard, 
            { backgroundColor: rarity.bg, borderColor: achievement.unlocked ? rarity.border : 'rgba(255,255,255,0.1)' }
          ]} 
          tint={isDark ? 'dark' : 'light'}
        >
          {isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
          <View style={styles.achievementHeader}>
            <View style={[styles.emojiBox, { backgroundColor: achievement.unlocked ? rarity.border + '40' : 'rgba(100,116,139,0.1)' }]}>
              <Text style={[styles.emoji, !achievement.unlocked && { opacity: 0.4 }]}>{achievement.emoji}</Text>
            </View>
            <View style={styles.badges}>
              {achievement.unlocked ? (
                <View style={[styles.badge, { backgroundColor: '#11998e' }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
              ) : (
                <View style={styles.badge}><Ionicons name="lock-closed" size={12} color="#94a3b8" /></View>
              )}
              <View style={[styles.badge, { backgroundColor: rarity.border }]}><Text style={styles.rarityLetter}>{achievement.rarity[0].toUpperCase()}</Text></View>
            </View>
          </View>
          <Text style={[
            styles.achievementTitle, 
            !achievement.unlocked && { color: '#94a3b8' }, 
            isDark && achievement.unlocked && styles.textDark
          ]}>
            {achievement.title}
          </Text>
          <Text style={styles.achievementDesc}>{achievement.description}</Text>
          <View style={styles.progressBox}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: achievement.unlocked ? '#11998e' : rarity.text }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressCount, { color: achievement.unlocked ? '#11998e' : rarity.text }]}>
                {achievement.progress}/{achievement.maxProgress}
              </Text>
              <Text style={styles.pointsSmall}>+{achievement.points}</Text>
            </View>
          </View>
          {!achievement.unlocked && (
            <View style={styles.reminderRow}>
              <View style={styles.reminderLeft}>
                <Ionicons name={hasReminder ? 'notifications' : 'notifications-off-outline'} size={16} color={hasReminder ? rarity.text : '#94a3b8'} />
                <Text style={[styles.reminderLabel, hasReminder && { color: rarity.text }]}>
                  {hasReminder ? 'Daily reminder on' : 'Remind me'}
                </Text>
              </View>
              <Switch 
                value={hasReminder} 
                onValueChange={() => onToggleReminder(achievement)} 
                trackColor={{ false: '#ddd', true: rarity.text }} 
                thumbColor="#fff" 
                ios_backgroundColor="#ddd" 
              />
            </View>
          )}
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation, route }: Props) {
  const scrollY = useSharedValue(0);
  const { 
    currentBaby, babies, getPottyStreak, milestones, growthData, 
    feedingLogs, sleepLogs, pottyLogs, medicationLogs, loadBabies, refreshCurrentBaby 
  } = useBaby();
  const { entries: activities, getTodayCount, getSuccessRate, getStreak, getRecentTimelineEvents, getEntryById } = useActivity();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ACHIEVEMENT_CATEGORIES | 'all'>('all');
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [showStreakProtector, setShowStreakProtector] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set());
  const [scheduledNotifications, setScheduledNotifications] = useState<Map<string, string>>(new Map());
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, lastActivity: null, streakAtRisk: false, hoursUntilBreak: 0,
  });
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set());
  const [unlockedHistory, setUnlockedHistory] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(ACHIEVEMENTS_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find(b => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  /* ---- Auto-refresh when returning from other screens ---- */
  useFocusEffect(
    useCallback(() => {
      // Refresh data when user comes back from AddLog/Reminders/etc
      refreshCurrentBaby();
      checkStreak();
      loadReminders();
      loadUnlockedHistory();
    }, [baby?.id])
  );

  /* ---- Load saved data on mount ---- */
  useEffect(() => {
    loadReminders();
    loadScheduledNotifications();
    loadUnlockedHistory();
    checkStreak();
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const interval = setInterval(checkStreak, 60000);
    return () => clearInterval(interval);
  }, [baby, activities]);

  /* ---- Load reminders from storage ---- */
  const loadReminders = async () => {
    try {
      const saved = await AsyncStorage.getItem(ACHIEVEMENT_REMINDERS_KEY);
      if (saved) setReminderEnabled(new Set(JSON.parse(saved)));
    } catch (e) { console.warn('Failed to load reminders:', e); }
  };

  /* ---- Load scheduled notification IDs ---- */
  const loadScheduledNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
      if (saved) {
        const parsed: ScheduledReminder[] = JSON.parse(saved);
        const map = new Map<string, string>();
        parsed.forEach(r => map.set(r.achievementId, r.notificationId));
        setScheduledNotifications(map);
      }
    } catch (e) { console.warn('Failed to load scheduled notifications:', e); }
  };

  /* ---- Save reminders to storage ---- */
  const saveReminders = async (enabled: Set<string>) => {
    try {
      await AsyncStorage.setItem(ACHIEVEMENT_REMINDERS_KEY, JSON.stringify([...enabled]));
    } catch (e) {
      console.warn('Failed to save reminders:', e);
      showAlert('error', 'Save Failed', 'Could not save reminder settings');
    }
  };

  /* ---- Save scheduled notification mapping ---- */
  const saveScheduledNotifications = async (map: Map<string, string>) => {
    try {
      const arr: ScheduledReminder[] = [];
      map.forEach((notificationId, achievementId) => {
        arr.push({ notificationId, achievementId });
      });
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(arr));
    } catch (e) { console.warn('Failed to save scheduled notifications:', e); }
  };

  /* ---- Load unlocked history ---- */
  const loadUnlockedHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem(ACHIEVEMENTS_UNLOCKED_KEY);
      if (saved) setUnlockedHistory(new Set(JSON.parse(saved)));
    } catch (e) { console.warn('Failed to load unlocked history:', e); }
  };

  /* ---- Save unlocked history ---- */
  const saveUnlockedHistory = async (history: Set<string>) => {
    try {
      await AsyncStorage.setItem(ACHIEVEMENTS_UNLOCKED_KEY, JSON.stringify([...history]));
    } catch (e) { console.warn('Failed to save unlocked history:', e); }
  };

  /* ---- Check streak status ---- */
  const checkStreak = useCallback(async () => {
    if (!baby) return;
    const pottyStreak = getPottyStreak();
    const recentEvents = getRecentTimelineEvents(30, baby.id);
    const lastActivity = recentEvents.length > 0 ? recentEvents[0].timestamp : null;
    const now = new Date();
    let streakAtRisk = false;
    let hoursUntilBreak = 0;

    if (lastActivity) {
      const hoursSince = differenceInHours(now, new Date(lastActivity));
      if (hoursSince > 20) { streakAtRisk = true; hoursUntilBreak = Math.max(0, 24 - hoursSince); }
    }

    const savedLongest = await AsyncStorage.getItem(LONGEST_STREAK_KEY);
    const parsedLongest = parseInt(savedLongest || '0');
    const currentLongest = Math.max(pottyStreak, parsedLongest);
    if (pottyStreak > parsedLongest) await AsyncStorage.setItem(LONGEST_STREAK_KEY, pottyStreak.toString());

    setStreakData({ 
      currentStreak: pottyStreak, 
      longestStreak: currentLongest, 
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null, 
      streakAtRisk, 
      hoursUntilBreak 
    });
    if (streakAtRisk && !showStreakProtector) setShowStreakProtector(true);
  }, [baby, getPottyStreak, getRecentTimelineEvents, showStreakProtector]);

  /* ---- Show alert helper ---- */
  const showAlert = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
    triggerHaptic(type === 'success' || type === 'achievement' ? 'success' : type === 'error' ? 'error' : 'light');
  };

  /* ---- Toggle reminder with proper notification management ---- */
  const toggleReminder = async (achievement: Achievement) => {
    const newEnabled = new Set(reminderEnabled);
    const newScheduled = new Map(scheduledNotifications);
    
    if (newEnabled.has(achievement.id)) {
      // Disable reminder
      newEnabled.delete(achievement.id);
      const notificationId = newScheduled.get(achievement.id);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        newScheduled.delete(achievement.id);
      }
      showAlert('info', 'Reminder Disabled', `No more reminders for "${achievement.title}"`, '🔕');
    } else {
      // Enable reminder
      newEnabled.add(achievement.id);
      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${achievement.emoji} Achievement Goal: ${achievement.title}`,
            body: `Keep working on: ${achievement.description}. You're at ${achievement.progress}/${achievement.maxProgress}!`,
            data: { type: 'achievement_reminder', screen: 'Achievements', achievementId: achievement.id },
            sound: true,
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.DAILY, 
            hour: 9, 
            minute: 0 
          },
        });
        newScheduled.set(achievement.id, notificationId);
        showAlert('success', 'Reminder Set!', `We'll remind you daily at 9 AM about "${achievement.title}"`, achievement.emoji);
      } catch (e) { 
        console.warn('Failed to schedule notification:', e);
        showAlert('error', 'Reminder Failed', 'Could not schedule notification. Check permissions.');
      }
    }
    
    setReminderEnabled(newEnabled);
    setScheduledNotifications(newScheduled);
    await saveReminders(newEnabled);
    await saveScheduledNotifications(newScheduled);
    triggerHaptic('light');
  };

  /* ---- Build achievements with real data - FULLY SYNCED ---- */
  const achievements: Achievement[] = useMemo(() => {
    if (!baby?.id) return [];
    const babyId = baby.id;
    
    // Get ALL activities for this baby from ActivityContext (single source of truth)
    const babyActivities = activities.filter(a => a.babyId === babyId);
    
    // Calculate counts from activities
    const totalSleep = babyActivities.filter(a => a.type === 'sleep').length;
    const totalFeed = babyActivities.filter(a => a.type === 'feed').length;
    const totalPotty = babyActivities.filter(a => a.type === 'potty').length;
    const totalDiaper = babyActivities.filter(a => a.type === 'diaper').length;
    const totalMedication = babyActivities.filter(a => a.type === 'medication').length;
    const totalMilestone = babyActivities.filter(a => a.type === 'milestone').length;
    const totalNote = babyActivities.filter(a => a.type === 'note').length;
    
    // Get streaks and rates from context
    const pottyStreak = getPottyStreak();
    const pottySuccess = getSuccessRate('potty', babyId);
    const feedStreak = getStreak('feed', babyId);
    const sleepStreak = getStreak('sleep', babyId);
    
    // Growth data from BabyContext
    const totalMilestones = milestones?.length || 0;
    const totalActivities = babyActivities.length;
    const growthCount = growthData?.length || 0;
    const hasWeight = growthData?.some(g => g.type === 'weight') || false;
    const hasHeight = growthData?.some(g => g.type === 'height') || false;
    
    // Feeding diversity
    const feedTypes = new Set(feedingLogs?.map(f => f.type) || []);
    const feedTypeCount = feedTypes.size;
    
    // Sleep quality
    const goodSleepCount = sleepLogs?.filter(s => s.quality === 'good' || s.quality === 'excellent').length || 0;
    
    // Medication
    const medLogs = medicationLogs?.length || 0;
    
    // Age calculations
    const birthDate = baby.birthDate ? new Date(baby.birthDate) : null;
    const daysOld = birthDate ? Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    // Tracking streak (consecutive days with any activity)
    let trackingStreak = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = subDays(new Date(), i);
      const hasActivity = babyActivities.some(a => isSameDay(new Date(a.timestamp), checkDate));
      if (hasActivity) trackingStreak++; else if (i > 0) break;
    }
    
    // Activity type diversity
    const usedTypes = new Set(babyActivities.map(a => a.type)).size;
    
    // Photos
    const photoCount = babyActivities.filter(a => a.photo).length;
    
    // Time-based achievements
    const earlyBird = babyActivities.some(a => new Date(a.timestamp).getHours() < 7);
    const nightOwl = babyActivities.some(a => new Date(a.timestamp).getHours() >= 22);
    
    // Social sharing (from activity entries that were shared)
    const sharedCount = babyActivities.filter(a => a.shared).length;

    return [
      { id: 'first_milestone', title: 'First Steps', description: 'Record your first milestone', emoji: '🏆', unlocked: totalMilestones >= 1, progress: Math.min(totalMilestones, 1), maxProgress: 1, category: 'milestone', rarity: 'common', points: 100 },
      { id: 'milestone_collector_5', title: 'Milestone Hunter', description: 'Record 5 milestones', emoji: '🌟', unlocked: totalMilestones >= 5, progress: totalMilestones, maxProgress: 5, category: 'milestone', rarity: 'rare', points: 250 },
      { id: 'milestone_collector', title: 'Milestone Collector', description: 'Record 10 milestones', emoji: '💫', unlocked: totalMilestones >= 10, progress: totalMilestones, maxProgress: 10, category: 'milestone', rarity: totalMilestones >= 10 ? 'epic' : 'rare', points: 500 },
      { id: 'milestone_master', title: 'Milestone Master', description: 'Record 25 milestones', emoji: '👑', unlocked: totalMilestones >= 25, progress: totalMilestones, maxProgress: 25, category: 'milestone', rarity: 'legendary', points: 1000 },
      
      { id: 'week_warrior', title: 'Week Warrior', description: '7 day potty streak', emoji: '🔥', unlocked: pottyStreak >= 7, progress: pottyStreak, maxProgress: 7, category: 'streak', rarity: pottyStreak >= 7 ? 'rare' : 'common', points: 200 },
      { id: 'fortnight_hero', title: 'Fortnight Hero', description: '14 day potty streak', emoji: '🔥', unlocked: pottyStreak >= 14, progress: pottyStreak, maxProgress: 14, category: 'streak', rarity: 'rare', points: 400 },
      { id: 'month_master', title: 'Month Master', description: '30 day potty streak', emoji: '🔥', unlocked: pottyStreak >= 30, progress: pottyStreak, maxProgress: 30, category: 'streak', rarity: 'legendary', points: 1000 },
      { id: 'tracking_streak_7', title: 'Consistent Tracker', description: '7 days of any activity tracking', emoji: '📅', unlocked: trackingStreak >= 7, progress: trackingStreak, maxProgress: 7, category: 'streak', rarity: 'rare', points: 300 },
      { id: 'tracking_streak_30', title: 'Daily Devotee', description: '30 days of consecutive tracking', emoji: '📆', unlocked: trackingStreak >= 30, progress: trackingStreak, maxProgress: 30, category: 'streak', rarity: 'legendary', points: 1500 },
      
      { id: 'first_log', title: 'First Log', description: 'Create your first activity log', emoji: '📝', unlocked: totalActivities >= 1, progress: Math.min(totalActivities, 1), maxProgress: 1, category: 'tracking', rarity: 'common', points: 50 },
      { id: 'tracking_pro', title: 'Tracking Pro', description: 'Log 50 activities', emoji: '📊', unlocked: totalActivities >= 50, progress: totalActivities, maxProgress: 50, category: 'tracking', rarity: totalActivities >= 50 ? 'epic' : 'rare', points: 500 },
      { id: 'tracking_legend', title: 'Tracking Legend', description: 'Log 200 activities', emoji: '📈', unlocked: totalActivities >= 200, progress: totalActivities, maxProgress: 200, category: 'tracking', rarity: 'legendary', points: 2000 },
      { id: 'sleep_tracker', title: 'Sleep Tracker', description: 'Log 20 sleep sessions', emoji: '😴', unlocked: totalSleep >= 20, progress: totalSleep, maxProgress: 20, category: 'tracking', rarity: 'rare', points: 300 },
      { id: 'feed_tracker', title: 'Feed Tracker', description: 'Log 30 feeding sessions', emoji: '🍼', unlocked: totalFeed >= 30, progress: totalFeed, maxProgress: 30, category: 'tracking', rarity: 'rare', points: 300 },
      { id: 'diary_keeper', title: 'Diary Keeper', description: 'Write 10 notes', emoji: '📔', unlocked: totalNote >= 10, progress: totalNote, maxProgress: 10, category: 'tracking', rarity: 'rare', points: 250 },
      
      { id: 'diaper_duty', title: 'Diaper Duty', description: 'Log 50 diaper changes', emoji: '🧷', unlocked: totalDiaper >= 50, progress: totalDiaper, maxProgress: 50, category: 'care', rarity: 'rare', points: 350 },
      { id: 'feeding_diversity', title: 'Food Explorer', description: 'Try all feeding types', emoji: '🍎', unlocked: feedTypeCount >= 4, progress: feedTypeCount, maxProgress: 4, category: 'care', rarity: 'epic', points: 600 },
      { id: 'good_sleep_10', title: 'Sweet Dreams', description: '10 good or excellent sleep sessions', emoji: '🌙', unlocked: goodSleepCount >= 10, progress: goodSleepCount, maxProgress: 10, category: 'care', rarity: 'rare', points: 350 },
      
      { id: 'growth_tracker', title: 'Growth Tracker', description: 'Record weight and height measurements', emoji: '📏', unlocked: hasWeight && hasHeight, progress: (hasWeight ? 1 : 0) + (hasHeight ? 1 : 0), maxProgress: 2, category: 'health', rarity: 'common', points: 150 },
      { id: 'growth_pro', title: 'Growth Pro', description: 'Record 10 growth measurements', emoji: '📐', unlocked: growthCount >= 10, progress: growthCount, maxProgress: 10, category: 'health', rarity: 'rare', points: 400 },
      { id: 'medication_master', title: 'Health Guardian', description: 'Log 20 medication records', emoji: '💊', unlocked: medLogs >= 20, progress: medLogs, maxProgress: 20, category: 'health', rarity: 'epic', points: 700 },
      { id: 'medication_adherent', title: 'Perfect Patient', description: '7 days of medication tracking', emoji: '🩺', unlocked: totalMedication >= 7, progress: totalMedication, maxProgress: 7, category: 'health', rarity: 'rare', points: 350 },
      
      { id: 'potty_pro', title: 'Potty Pro', description: '80% potty success rate', emoji: '🚽', unlocked: pottySuccess >= 80, progress: pottySuccess, maxProgress: 80, category: 'special', rarity: pottySuccess >= 80 ? 'epic' : 'rare', points: 600 },
      { id: 'potty_perfect', title: 'Potty Perfect', description: '95% potty success rate', emoji: '✨', unlocked: pottySuccess >= 95, progress: pottySuccess, maxProgress: 95, category: 'special', rarity: 'legendary', points: 1200 },
      { id: 'early_bird', title: 'Early Bird', description: 'Track an activity before 7 AM', emoji: '🌅', unlocked: earlyBird, progress: earlyBird ? 1 : 0, maxProgress: 1, category: 'special', rarity: 'rare', points: 300 },
      { id: 'night_owl', title: 'Night Owl', description: 'Track an activity after 10 PM', emoji: '🦉', unlocked: nightOwl, progress: nightOwl ? 1 : 0, maxProgress: 1, category: 'special', rarity: 'rare', points: 300 },
      { id: 'hundred_days', title: 'Century Club', description: '100 days of tracking any activity', emoji: '💯', unlocked: trackingStreak >= 100, progress: trackingStreak, maxProgress: 100, category: 'special', rarity: 'legendary', points: 2500 },
      { id: 'jack_of_all', title: 'Jack of All Trades', description: 'Use all 8 activity types', emoji: '🎯', unlocked: usedTypes >= 8, progress: usedTypes, maxProgress: 8, category: 'special', rarity: 'epic', points: 800 },
      { id: 'photo_journal', title: 'Photo Journalist', description: 'Add 5 photos to activities', emoji: '📸', unlocked: photoCount >= 5, progress: photoCount, maxProgress: 5, category: 'special', rarity: 'rare', points: 350 },
      { id: 'veteran_parent', title: 'Veteran Parent', description: 'Track for 365 days', emoji: '🏅', unlocked: daysOld >= 365, progress: Math.min(daysOld, 365), maxProgress: 365, category: 'special', rarity: 'legendary', points: 3000 },
      { id: 'social_sharer', title: 'Social Sharer', description: 'Share 5 activities', emoji: '🔗', unlocked: sharedCount >= 5, progress: sharedCount, maxProgress: 5, category: 'social', rarity: 'rare', points: 400 },
    ];
  }, [baby, activities, milestones, getTodayCount, getPottyStreak, getSuccessRate, getStreak, growthData, feedingLogs, sleepLogs, pottyLogs, medicationLogs]);

  /* ---- Detect newly unlocked achievements ---- */
  useEffect(() => {
    const newUnlocks = new Set<string>();
    achievements.forEach(a => { if (a.unlocked && !unlockedHistory.has(a.id)) newUnlocks.add(a.id); });
    if (newUnlocks.size > 0) {
      const firstNew = achievements.find(a => newUnlocks.has(a.id));
      if (firstNew) showAlert('achievement', 'Achievement Unlocked!', `"${firstNew.title}" — ${firstNew.points} points!`, firstNew.emoji);
      const updatedHistory = new Set([...unlockedHistory, ...newUnlocks]);
      setUnlockedHistory(updatedHistory);
      saveUnlockedHistory(updatedHistory);
      setNewlyUnlocked(newUnlocks);
      setTimeout(() => setNewlyUnlocked(new Set()), 5000);
    }
  }, [achievements]);

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const unlocked = achievements.filter(a => a.unlocked);
    const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);
    const byCategory = Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => ({
      category: key as keyof typeof ACHIEVEMENT_CATEGORIES, ...cat,
      unlocked: achievements.filter(a => a.category === key && a.unlocked).length,
      total: achievements.filter(a => a.category === key).length,
    }));
    return {
      total: achievements.length, unlocked: unlocked.length,
      progress: Math.round((unlocked.length / achievements.length) * 100),
      totalPoints, byCategory,
      legendary: unlocked.filter(a => a.rarity === 'legendary').length,
      epic: unlocked.filter(a => a.rarity === 'epic').length,
      rare: unlocked.filter(a => a.rarity === 'rare').length,
      common: unlocked.filter(a => a.rarity === 'common').length,
    };
  }, [achievements]);

  const filtered = useMemo(() => {
    const list = selectedCategory === 'all' 
      ? achievements 
      : achievements.filter(a => a.category === selectedCategory);
    return list;
  }, [selectedCategory, achievements]);

  const paginatedAchievements = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  /* ---- Pagination handlers ---- */
  const handleLoadMore = useCallback(() => {
    if (displayCount >= filtered.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + ACHIEVEMENTS_PAGE_SIZE, filtered.length));
      setIsLoadingMore(false);
    }, 300);
  }, [displayCount, filtered.length]);

  const handleCategoryChange = (category: keyof typeof ACHIEVEMENT_CATEGORIES | 'all') => {
    setSelectedCategory(category);
    setDisplayCount(ACHIEVEMENTS_PAGE_SIZE); // Reset pagination
    const label = category === 'all' ? 'all achievements' : `${ACHIEVEMENT_CATEGORIES[category].label} achievements`;
    showAlert('info', 'Filter', `Showing ${label}`);
  };

  /* ---- Refresh ---- */
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentBaby();
    await checkStreak();
    setRefreshing(false);
    showAlert('success', 'Refreshed!', 'Achievement data updated');
  };

  /* ---- Share ---- */
  const handleShare = async () => {
    triggerHaptic('medium');
    try {
      const message = baby
        ? `🏆 ${baby.name} has unlocked ${stats.unlocked} achievements on LittleLoom! Total: ${stats.totalPoints} points. ${streakData.currentStreak > 0 ? `${streakData.currentStreak}-day streak! 🔥` : ''}`
        : `I've unlocked ${stats.unlocked} achievements on LittleLoom! 🏆 Total: ${stats.totalPoints} points.`;
      await Share.share({ message, title: 'LittleLoom Achievements' });
      showAlert('success', 'Shared!', 'Your achievements have been shared');
    } catch { showAlert('error', 'Share Failed', 'Could not share achievements'); }
  };

  /* ---- Achievement press ---- */
  const handlePress = (achievement: Achievement) => {
    triggerHaptic('light');
    if (achievement.unlocked) {
      showAlert('achievement', achievement.title, `Unlocked! ${achievement.points} points earned`, achievement.emoji);
    } else {
      const remaining = achievement.maxProgress - achievement.progress;
      showAlert('info', achievement.title, `${remaining} more to unlock! Keep tracking!`, achievement.emoji);
    }
  };

  /* ---- Navigation to AddLog (Milestones) ---- */
  const handleNavigateToMilestones = useCallback(() => {
    // Navigate to AddLog with milestone type - this opens the milestone modal
    navigation.navigate('AddLog', { 
      type: 'milestone', 
      babyId: baby?.id 
    });
  }, [navigation, baby?.id]);

  /* ---- Navigation to UniversalTracker ---- */
  const handleNavigateToTracker = useCallback((type: string) => {
    navigation.navigate('UniversalTracker', { 
      type, 
      babyId: baby?.id 
    });
  }, [navigation, baby?.id]);

  /* ---- Navigation to Reminders ---- */
  const handleNavigateToReminders = useCallback(() => {
    navigation.navigate('Reminders', { 
      babyId: baby?.id 
    });
  }, [navigation, baby?.id]);

  /* ---- Scroll handler ---- */
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0.95, 1], Extrapolate.CLAMP),
  }));

  /* ---- Render achievement item for FlatList ---- */
  const renderAchievementItem = useCallback(({ item, index }: { item: Achievement; index: number }) => {
    const rarity = RARITY_COLORS[item.rarity];
    const isNew = newlyUnlocked.has(item.id);
    const hasReminder = reminderEnabled.has(item.id);
    
    return (
      <AchievementCard
        achievement={item}
        index={index}
        isDark={isDark}
        isNew={isNew}
        hasReminder={hasReminder}
        reminderEnabled={reminderEnabled}
        rarity={rarity}
        themeColors={themeColors}
        onPress={handlePress}
        onToggleReminder={toggleReminder}
        shouldReduceMotion={shouldReduceMotion}
      />
    );
  }, [isDark, newlyUnlocked, reminderEnabled, themeColors, handlePress, toggleReminder, shouldReduceMotion]);

  const keyExtractor = useCallback((item: Achievement) => item.id, []);

  /* ---- No baby state ---- */
  if (!baby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <GlassmorphismCard intensity={90}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.noBabyGradient}>
              <Text style={styles.noBabyEmoji}>🏆</Text>
              <Text style={styles.noBabyTitle}>No Baby Profile</Text>
              <Text style={styles.noBabySubtitle}>Create a profile to start earning achievements</Text>
              <TouchableOpacity style={styles.noBabyButton} onPress={() => navigation.navigate('CreateBabyProfile')}>
                <Text style={[styles.noBabyButtonText, { color: themeColors.primary }]}>Get Started</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassmorphismCard>
        </View>
        <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : themeColors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>{baby.name}'s Achievements</Text>
          <View style={styles.headerRight}>
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.pointsText}>{stats.totalPoints}</Text>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={22} color={isDark ? '#fff' : themeColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <AnimatedFlatList
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        data={paginatedAchievements}
        renderItem={renderAchievementItem}
        keyExtractor={keyExtractor}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {/* Baby Info Card with SafeBabyAvatar */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(100).springify()}>
              <GlassmorphismCard style={styles.babyCard} onPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}>
                <View style={styles.babyRow}>
                  <SafeBabyAvatar
                    avatar={baby.avatar}
                    gender={baby.gender}
                    size={70}
                    showBadge={streakData.currentStreak > 0}
                    animated={!shouldReduceMotion}
                  />
                  <View style={styles.babyInfo}>
                    <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                    <Text style={styles.babyAge}>{baby.age}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: streakData.streakAtRisk ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)' }]}>
                      <Ionicons name={streakData.streakAtRisk ? 'flame-outline' : 'checkmark-circle'} size={14} color={streakData.streakAtRisk ? '#ef4444' : '#10b981'} />
                      <Text style={[styles.statusText, { color: streakData.streakAtRisk ? '#ef4444' : '#10b981' }]}>
                        {streakData.streakAtRisk ? 'Streak at risk!' : 'On track'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statsCol}>
                    <Text style={[styles.statValue, isDark && styles.textDark]}>{streakData.longestStreak}</Text>
                    <Text style={styles.statLabel}>Best</Text>
                  </View>
                </View>
                {streakData.streakAtRisk && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={16} color="#ef4444" />
                    <Text style={styles.warningText}>Log an activity today to keep your streak!</Text>
                    <TouchableOpacity style={styles.warningAction} onPress={() => handleNavigateToTracker('potty')}>
                      <Text style={styles.warningActionText}>Log Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassmorphismCard>
            </Animated.View>

            {/* Overview Card */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(200).springify()}>
              <GlassmorphismCard style={styles.overviewCard}>
                <View style={styles.overviewRow}>
                  <CircularProgress progress={stats.progress} value={`${stats.progress}%`} label="Complete" color={themeColors.primary} size={90} />
                  <View style={styles.overviewInfo}>
                    <Text style={[styles.overviewTitle, isDark && styles.textDark]}>Progress</Text>
                    <Text style={styles.overviewSubtitle}>{stats.unlocked} of {stats.total} unlocked</Text>
                    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.pointsPill}>
                      <Ionicons name="star" size={14} color="#fff" />
                      <Text style={styles.pointsPillText}>{stats.totalPoints} pts</Text>
                    </LinearGradient>
                  </View>
                </View>
                <View style={styles.rarityRow}>
                  {[
                    { label: 'Legendary', count: stats.legendary, color: '#f59e0b' },
                    { label: 'Epic', count: stats.epic, color: '#8b5cf6' },
                    { label: 'Rare', count: stats.rare, color: '#3b82f6' },
                    { label: 'Common', count: stats.common, color: '#94a3b8' },
                  ].map((r) => (
                    <View key={r.label} style={styles.rarityItem}>
                      <View style={[styles.rarityDot, { backgroundColor: r.color }]} />
                      <Text style={[styles.rarityCount, isDark && styles.textDark]}>{r.count}</Text>
                      <Text style={styles.rarityLabel}>{r.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.categoryRow}>
                  {stats.byCategory.map((cat, i) => (
                    <Animated.View key={cat.category} entering={shouldReduceMotion ? undefined : FadeInLeft.delay(i * 100)} style={styles.categoryItem}>
                      <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
                        <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                      </View>
                      <Text style={[styles.categoryValue, isDark && styles.textDark]}>{cat.unlocked}/{cat.total}</Text>
                    </Animated.View>
                  ))}
                </View>
              </GlassmorphismCard>
            </Animated.View>

            {/* Quick Actions - FIXED NAVIGATION */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300).springify()} style={styles.quickActions}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Quick Actions</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleNavigateToReminders}>
                  <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.actionGradient}>
                    <Ionicons name="alarm" size={20} color="#fff" /><Text style={styles.actionText}>Remind</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleNavigateToTracker('potty')}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.actionGradient}>
                    <Ionicons name="add-circle" size={20} color="#fff" /><Text style={styles.actionText}>Log</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowStreakProtector(true); showAlert('warning', 'Streak Protector', 'Protect your current streak!'); }}>
                  <LinearGradient colors={['#ef4444', '#f87171']} style={styles.actionGradient}>
                    <Ionicons name="flame" size={20} color="#fff" /><Text style={styles.actionText}>Protect</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {/* FIXED: Navigate to AddLog with milestone type instead of non-existent Milestones screen */}
                <TouchableOpacity style={styles.actionBtn} onPress={handleNavigateToMilestones}>
                  <LinearGradient colors={['#8b5cf6', '#a78bfa']} style={styles.actionGradient}>
                    <Ionicons name="trophy" size={20} color="#fff" /><Text style={styles.actionText}>Milestones</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Category Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity 
                style={[styles.filterChip, selectedCategory === 'all' && { backgroundColor: themeColors.primary, borderColor: 'transparent' }]} 
                onPress={() => handleCategoryChange('all')}
              >
                <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>All</Text>
              </TouchableOpacity>
              {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => (
                <TouchableOpacity 
                  key={key} 
                  style={[styles.filterChip, selectedCategory === key && { backgroundColor: themeColors.primary, borderColor: 'transparent' }]} 
                  onPress={() => handleCategoryChange(key as any)}
                >
                  <Ionicons name={cat.icon as any} size={14} color={selectedCategory === key ? '#fff' : cat.color} />
                  <Text style={[styles.filterText, { color: selectedCategory === key ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>{cat.label}</Text>
                  {selectedCategory !== key && (
                    <View style={[styles.filterBadge, { backgroundColor: `${cat.color}30` }]}>
                      <Text style={[styles.filterBadgeText, { color: cat.color }]}>{achievements.filter(a => a.category === key && a.unlocked).length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, isDark && styles.textDark, { marginTop: 8, marginBottom: 12 }]}>
              {selectedCategory === 'all' ? 'All Achievements' : ACHIEVEMENT_CATEGORIES[selectedCategory as keyof typeof ACHIEVEMENT_CATEGORIES].label}
              <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '500' }}>  ({filtered.length})</Text>
            </Text>
          </>
        }
        ListFooterComponent={
          <>
            {isLoadingMore && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={24} color={themeColors.primary} />
                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Loading more...</Text>
              </View>
            )}
            {displayCount >= filtered.length && filtered.length > ACHIEVEMENTS_PAGE_SIZE && (
              <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, paddingVertical: 16 }}>
                — All achievements loaded —
              </Text>
            )}
            <View style={{ height: 100 }} />
          </>
        }
      />

      {/* Streak Protector Modal */}
      {showStreakProtector && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.springify()} style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <LinearGradient colors={['#ef4444', '#f87171']} style={styles.modalHeader}>
              <Ionicons name="flame" size={40} color="#fff" />
              <Text style={styles.modalTitle}>Streak at Risk! 🔥</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text style={[styles.modalText, isDark && styles.textDark]}>
                Your {streakData.currentStreak}-day streak ends in <Text style={{ color: '#ef4444', fontWeight: '800' }}>{streakData.hoursUntilBreak} hours</Text>!
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { 
                  setShowStreakProtector(false); 
                  handleNavigateToReminders();
                }}>
                  <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.modalBtnGradient}>
                    <Text style={styles.modalBtnText}>Set Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowStreakProtector(false); showAlert('info', 'Dismissed', 'You can log an activity anytime'); }}>
                  <View style={[styles.modalBtnGradient, { backgroundColor: 'rgba(100,116,139,0.1)' }]}>
                    <Text style={[styles.modalBtnText, { color: '#64748b' }]}>Dismiss</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { 
                  setShowStreakProtector(false); 
                  handleNavigateToTracker('potty');
                }}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.modalBtnGradient}>
                    <Text style={styles.modalBtnText}>Log Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 140 : 120, paddingHorizontal: 20, paddingBottom: 30 },
  textDark: { color: '#ffffff' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 12, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  pointsText: { fontSize: 13, fontWeight: '700', color: '#f59e0b' },
  glassCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  glassContent: { flex: 1 },
  alertContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, minWidth: 300, maxWidth: width - 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyEmoji: { fontSize: 56, marginBottom: 16 },
  noBabyTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, textAlign: 'center' },
  noBabyButton: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, marginTop: 8 },
  noBabyButtonText: { fontSize: 15, fontWeight: '700' },
  babyCard: { borderRadius: 24, marginBottom: 16, overflow: 'hidden' },
  babyRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  babyInfo: { flex: 1, marginLeft: 16 },
  babyName: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  babyAge: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsCol: { alignItems: 'center', marginLeft: 'auto', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(100,116,139,0.2)' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(239,68,68,0.2)' },
  warningText: { fontSize: 13, color: '#ef4444', marginLeft: 8, fontWeight: '600', flex: 1 },
  warningAction: { marginLeft: 'auto', backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  warningActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  overviewCard: { borderRadius: 28, marginBottom: 20, padding: 20 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  overviewInfo: { flex: 1, marginLeft: 16 },
  overviewTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  overviewSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, alignSelf: 'flex-start' },
  pointsPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rarityRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)', borderBottomColor: 'rgba(100,116,139,0.1)' },
  rarityItem: { alignItems: 'center' },
  rarityDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  rarityCount: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  rarityLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  categoryItem: { alignItems: 'center', flex: 1 },
  categoryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  categoryValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  progressItem: { alignItems: 'center' },
  progressSvgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  progressValue: { position: 'absolute', fontWeight: '800' },
  progressLabel: { color: '#64748b', marginTop: 6, fontWeight: '600' },
  quickActions: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterScroll: { marginBottom: 20 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)', marginRight: 8, gap: 6 },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '800' },
  achievementsSection: { marginTop: 8 },
  achievementsList: { gap: 12 },
  achievementCard: { borderRadius: 20, padding: 16, borderWidth: 1, overflow: 'hidden', position: 'relative', marginBottom: 12 },
  newBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 10 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  achievementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  emojiBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rarityLetter: { fontSize: 10, fontWeight: '800', color: '#fff' },
  achievementTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  achievementDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  progressBox: { marginTop: 'auto' },
  progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontSize: 12, fontWeight: '700' },
  pointsSmall: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  reminderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  unlockedAt: { fontSize: 11, color: '#11998e', marginTop: 8, fontWeight: '600' },
  modal: { width: width - 60, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 25 },
  modalHeader: { padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  modalBody: { padding: 24, alignItems: 'center' },
  modalText: { fontSize: 16, color: '#1e293b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  modalActions: { flexDirection: 'column', gap: 10, width: '100%' },
  modalBtn: { borderRadius: 16, overflow: 'hidden' },
  modalBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});