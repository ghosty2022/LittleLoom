
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  useColorScheme,
  RefreshControl,
  Platform,
  Share,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp,
  FadeInDown,
  FadeInLeft,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useBaby } from '../context/BabyContext';
import { useActivity } from '../context/ActivityContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ==================== TYPES ====================
interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  category: 'milestone' | 'streak' | 'tracking' | 'social' | 'special';
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  reminderType?: 'daily' | 'streak' | 'milestone';
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string | null;
  streakAtRisk: boolean;
  hoursUntilBreak: number;
}

const ACHIEVEMENT_CATEGORIES = {
  milestone: { label: 'Milestones', icon: 'trophy', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
  streak: { label: 'Streaks', icon: 'flame', color: '#ef4444', gradient: ['#ef4444', '#f87171'] },
  tracking: { label: 'Tracking', icon: 'analytics', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'] },
  social: { label: 'Social', icon: 'people', color: '#10b981', gradient: ['#10b981', '#34d399'] },
  special: { label: 'Special', icon: 'star', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'] },
};

const RARITY_COLORS = {
  common: { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.3)', glow: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' },
  rare: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.4)', glow: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
  epic: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.5)', glow: 'rgba(139, 92, 246, 0.4)', text: '#8b5cf6' },
  legendary: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.6)', glow: 'rgba(245, 158, 11, 0.5)', text: '#f59e0b' },
};

const ACHIEVEMENT_REMINDERS_KEY = '@littleloom_achievement_reminders';
const LONGEST_STREAK_KEY = '@littleloom_longest_streak';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==================== COMPONENTS ====================
const GlassmorphismCard = ({ children, style, onPress, intensity = 80 }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
          <Circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size/2} cy={size/2} r={radius} stroke={`url(#grad-${label})`} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </Svg>
        <Text style={[styles.progressValue, { color, fontSize: size * 0.28 }]}>{value}</Text>
      </View>
      <Text style={[styles.progressLabel, { fontSize: size * 0.2 }]}>{label}</Text>
    </View>
  );
};

const SweetAlert = ({ visible, type, title, message, emoji, onClose, isDark }: any) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
    achievement: { colors: ['#f59e0b', '#fbbf24'], icon: 'trophy' },
  }[type as keyof typeof config];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 }]} pointerEvents="none">
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          {emoji ? <Text style={{ fontSize: 28 }}>{emoji}</Text> : <Ionicons name={config.icon as any} size={28} color="#fff" />}
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

// ==================== MAIN SCREEN ====================
type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation, route }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const { currentBaby, babies, getPottyStreak, milestones, switchBaby } = useBaby();
  const { entries: activities, getTodayCount, getSuccessRate, getStreak, getRecentTimelineEvents } = useActivity();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ACHIEVEMENT_CATEGORIES | 'all'>('all');
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '', emoji: '' });
  const [showStreakProtector, setShowStreakProtector] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set());
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, lastActivity: null, streakAtRisk: false, hoursUntilBreak: 0,
  });

  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find(b => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  useEffect(() => {
    loadReminders();
    checkStreak();
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const interval = setInterval(checkStreak, 60000);
    return () => clearInterval(interval);
  }, [baby, activities]);

  const loadReminders = async () => {
    try {
      const saved = await AsyncStorage.getItem(ACHIEVEMENT_REMINDERS_KEY);
      if (saved) setReminderEnabled(new Set(JSON.parse(saved)));
    } catch (e) { console.warn(e); }
  };

  const saveReminders = async (enabled: Set<string>) => {
    try {
      await AsyncStorage.setItem(ACHIEVEMENT_REMINDERS_KEY, JSON.stringify([...enabled]));
    } catch (e) { console.warn(e); }
  };

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
      if (hoursSince > 20) {
        streakAtRisk = true;
        hoursUntilBreak = Math.max(0, 24 - hoursSince);
      }
    }

    const savedLongest = await AsyncStorage.getItem(LONGEST_STREAK_KEY);
    setStreakData({
      currentStreak: pottyStreak,
      longestStreak: Math.max(pottyStreak, parseInt(savedLongest || '0')),
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      streakAtRisk,
      hoursUntilBreak,
    });

    if (streakAtRisk && !showStreakProtector) {
      setShowStreakProtector(true);
    }
  }, [baby, getPottyStreak, getRecentTimelineEvents, showStreakProtector]);

  const toggleReminder = async (achievement: Achievement) => {
    const newEnabled = new Set(reminderEnabled);
    if (newEnabled.has(achievement.id)) {
      newEnabled.delete(achievement.id);
      setAlert({ visible: true, type: 'info', title: 'Reminder Disabled', message: `No more reminders for ${achievement.title}`, emoji: '' });
    } else {
      newEnabled.add(achievement.id);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${achievement.emoji} Achievement Goal`,
          body: `Work on: ${achievement.title}`,
          data: { type: 'achievement_reminder', screen: 'Achievements' },
        },
        trigger: { hour: 9, minute: 0, repeats: true },
      });
      setAlert({ visible: true, type: 'success', title: 'Reminder Set!', message: `We'll remind you about "${achievement.title}"`, emoji: achievement.emoji });
    }
    setReminderEnabled(newEnabled);
    await saveReminders(newEnabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const achievements: Achievement[] = useMemo(() => {
    if (!baby?.id) return [];
    const babyId = baby.id;
    const todaySleep = getTodayCount('sleep', babyId);
    const todayFeed = getTodayCount('feed', babyId);
    const todayPotty = getTodayCount('potty', babyId);
    const pottyStreak = getPottyStreak();
    const pottySuccess = getSuccessRate('potty', babyId);
    const sleepStreak = getStreak('sleep', babyId);
    const totalMilestones = milestones?.length || 0;
    const totalActivities = activities?.filter(a => a.babyId === babyId).length || 0;

    return [
      { id: 'first_milestone', title: 'First Steps', description: 'Record your first milestone', emoji: '🏆', unlocked: totalMilestones >= 1, progress: Math.min(totalMilestones, 1), maxProgress: 1, category: 'milestone', rarity: 'common', points: 100 },
      { id: 'milestone_collector', title: 'Milestone Collector', description: 'Record 10 milestones', emoji: '🌟', unlocked: totalMilestones >= 10, progress: totalMilestones, maxProgress: 10, category: 'milestone', rarity: totalMilestones >= 10 ? 'epic' : 'rare', points: 500 },
      { id: 'week_warrior', title: 'Week Warrior', description: '7 day potty streak', emoji: '🔥', unlocked: pottyStreak >= 7, progress: pottyStreak, maxProgress: 7, category: 'streak', rarity: pottyStreak >= 7 ? 'rare' : 'common', points: 200 },
      { id: 'month_master', title: 'Month Master', description: '30 day potty streak', emoji: '🔥', unlocked: pottyStreak >= 30, progress: pottyStreak, maxProgress: 30, category: 'streak', rarity: 'legendary', points: 1000 },
      { id: 'first_log', title: 'First Log', description: 'Create your first activity log', emoji: '📝', unlocked: totalActivities >= 1, progress: Math.min(totalActivities, 1), maxProgress: 1, category: 'tracking', rarity: 'common', points: 50 },
      { id: 'tracking_pro', title: 'Tracking Pro', description: 'Log 100 activities', emoji: '📊', unlocked: totalActivities >= 100, progress: totalActivities, maxProgress: 100, category: 'tracking', rarity: totalActivities >= 100 ? 'epic' : 'rare', points: 750 },
      { id: 'potty_pro', title: 'Potty Pro', description: '80% potty success rate', emoji: '🚽', unlocked: pottySuccess >= 80, progress: pottySuccess, maxProgress: 80, category: 'special', rarity: pottySuccess >= 80 ? 'epic' : 'rare', points: 600 },
    ];
  }, [baby, activities, milestones, getTodayCount, getPottyStreak, getSuccessRate, getStreak]);

  const stats = useMemo(() => {
    const unlocked = achievements.filter(a => a.unlocked);
    const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);
    const byCategory = Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => ({
      category: key as keyof typeof ACHIEVEMENT_CATEGORIES,
      ...cat,
      unlocked: achievements.filter(a => a.category === key && a.unlocked).length,
      total: achievements.filter(a => a.category === key).length,
    }));
    return { total: achievements.length, unlocked: unlocked.length, progress: Math.round((unlocked.length / achievements.length) * 100), totalPoints, byCategory };
  }, [achievements]);

  const filtered = selectedCategory === 'all' ? achievements : achievements.filter(a => a.category === selectedCategory);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    checkStreak();
    setRefreshing(false);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const message = baby 
        ? `🏆 ${baby.name} has unlocked ${stats.unlocked} achievements! Total: ${stats.totalPoints} points. ${streakData.currentStreak > 0 ? `${streakData.currentStreak}-day streak! 🔥` : ''}`
        : `I've unlocked ${stats.unlocked} achievements! 🏆 Total: ${stats.totalPoints} points.`;
      await Share.share({ message, title: 'LittleLoom Achievements' });
    } catch { setAlert({ visible: true, type: 'error', title: 'Share Failed', message: 'Could not share', emoji: '' }); }
  };

  const handlePress = (achievement: Achievement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (achievement.unlocked) {
      setAlert({ visible: true, type: 'achievement', title: achievement.title, message: 'Achievement unlocked!', emoji: achievement.emoji });
    } else {
      setAlert({ visible: true, type: 'info', title: achievement.title, message: `${achievement.maxProgress - achievement.progress} more to unlock!`, emoji: achievement.emoji });
    }
  };

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0.95, 1], Extrapolate.CLAMP),
  }));

  if (!baby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <GlassmorphismCard intensity={90}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.noBabyGradient}>
              <Text style={styles.noBabyEmoji}>🏆</Text>
              <Text style={styles.noBabyTitle}>No Baby Profile</Text>
              <TouchableOpacity style={styles.noBabyButton} onPress={() => navigation.navigate('CreateBabyProfile')}>
                <Text style={styles.noBabyButtonText}>Get Started</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassmorphismCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#667eea'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>{baby.name}'s Achievements</Text>
          <View style={styles.headerRight}>
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.pointsText}>{stats.totalPoints}</Text>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={22} color={isDark ? '#fff' : '#667eea'} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <AnimatedScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Baby Info */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <GlassmorphismCard style={styles.babyCard} onPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}>
            <View style={styles.babyRow}>
              <LinearGradient colors={['#fa709a', '#fee140']} style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{baby.avatar || '👶'}</Text>
                {streakData.currentStreak > 0 && (
                  <View style={[styles.streakBadge, { backgroundColor: streakData.streakAtRisk ? '#ef4444' : '#f59e0b' }]}>
                    <Text style={styles.streakBadgeText}>{streakData.currentStreak}</Text>
                  </View>
                )}
              </LinearGradient>
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
              </View>
            )}
          </GlassmorphismCard>
        </Animated.View>

        {/* Overview */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <GlassmorphismCard style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <CircularProgress progress={stats.progress} value={`${stats.progress}%`} label="Complete" color="#667eea" size={90} />
              <View style={styles.overviewInfo}>
                <Text style={[styles.overviewTitle, isDark && styles.textDark]}>Progress</Text>
                <Text style={styles.overviewSubtitle}>{stats.unlocked} of {stats.total} unlocked</Text>
                <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.pointsPill}>
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={styles.pointsPillText}>{stats.totalPoints} pts</Text>
                </LinearGradient>
              </View>
            </View>
            <View style={styles.categoryRow}>
              {stats.byCategory.map((cat, i) => (
                <Animated.View key={cat.category} entering={FadeInLeft.delay(i * 100)} style={styles.categoryItem}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
                    <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                  </View>
                  <Text style={[styles.categoryValue, isDark && styles.textDark]}>{cat.unlocked}/{cat.total}</Text>
                </Animated.View>
              ))}
            </View>
          </GlassmorphismCard>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.quickActions}>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Reminders', { babyId: baby.id })}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.actionGradient}>
                <Ionicons name="alarm" size={20} color="#fff" />
                <Text style={styles.actionText}>Remind</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('UniversalTracker', { type: 'potty', babyId: baby.id })}>
              <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.actionGradient}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.actionText}>Log</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowStreakProtector(true)}>
              <LinearGradient colors={['#ef4444', '#f87171']} style={styles.actionGradient}>
                <Ionicons name="flame" size={20} color="#fff" />
                <Text style={styles.actionText}>Protect</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity style={[styles.filterChip, selectedCategory === 'all' && styles.filterActive]} onPress={() => setSelectedCategory('all')}>
            <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => (
            <TouchableOpacity key={key} style={[styles.filterChip, selectedCategory === key && styles.filterActive]} onPress={() => setSelectedCategory(key as any)}>
              <Ionicons name={cat.icon as any} size={14} color={selectedCategory === key ? '#fff' : cat.color} />
              <Text style={[styles.filterText, { color: selectedCategory === key ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Achievements */}
        <View style={styles.achievementsSection}>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
            {selectedCategory === 'all' ? 'All Achievements' : ACHIEVEMENT_CATEGORIES[selectedCategory as keyof typeof ACHIEVEMENT_CATEGORIES].label}
          </Text>
          <View style={styles.achievementsList}>
            {filtered.map((achievement, index) => {
              const rarity = RARITY_COLORS[achievement.rarity];
              const progress = (achievement.progress / achievement.maxProgress) * 100;
              const hasReminder = reminderEnabled.has(achievement.id);
              
              return (
                <Animated.View key={achievement.id} entering={FadeInUp.delay(index * 50)} layout={Layout.springify()}>
                  <TouchableOpacity onPress={() => handlePress(achievement)} activeOpacity={0.9}>
                    <BlurView intensity={achievement.unlocked ? 90 : 70} style={[styles.achievementCard, { backgroundColor: rarity.bg, borderColor: achievement.unlocked ? rarity.border : 'rgba(255,255,255,0.1)' }]} tint={isDark ? 'dark' : 'light'}>
                      <View style={styles.achievementHeader}>
                        <View style={[styles.emojiBox, { backgroundColor: achievement.unlocked ? `${rarity.border}40` : 'rgba(100,116,139,0.1)' }]}>
                          <Text style={[styles.emoji, !achievement.unlocked && { opacity: 0.4 }]}>{achievement.emoji}</Text>
                        </View>
                        <View style={styles.badges}>
                          {achievement.unlocked ? (
                            <View style={[styles.badge, { backgroundColor: '#11998e' }]}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                          ) : (
                            <View style={styles.badge}>
                              <Ionicons name="lock-closed" size={12} color="#94a3b8" />
                            </View>
                          )}
                          <View style={[styles.badge, { backgroundColor: rarity.border }]}>
                            <Text style={styles.rarityLetter}>{achievement.rarity[0].toUpperCase()}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.achievementTitle, !achievement.unlocked && { color: '#94a3b8' }, isDark && achievement.unlocked && styles.textDark]}>{achievement.title}</Text>
                      <Text style={styles.achievementDesc}>{achievement.description}</Text>
                      <View style={styles.progressBox}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: achievement.unlocked ? '#11998e' : rarity.text }]} />
                        </View>
                        <View style={styles.progressLabels}>
                          <Text style={[styles.progressCount, { color: achievement.unlocked ? '#11998e' : rarity.text }]}>{achievement.progress}/{achievement.maxProgress}</Text>
                          <Text style={styles.pointsSmall}>+{achievement.points}</Text>
                        </View>
                      </View>
                      {!achievement.unlocked && (
                        <View style={styles.reminderRow}>
                          <Text style={styles.reminderLabel}>Remind me</Text>
                          <Switch value={hasReminder} onValueChange={() => toggleReminder(achievement)} trackColor={{ false: '#ddd', true: rarity.text }} />
                        </View>
                      )}
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </AnimatedScrollView>

      {/* Streak Protector Modal */}
      {showStreakProtector && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
          <Animated.View entering={FadeInUp.springify()} style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <LinearGradient colors={['#ef4444', '#f87171']} style={styles.modalHeader}>
              <Ionicons name="flame" size={40} color="#fff" />
              <Text style={styles.modalTitle}>Streak at Risk! 🔥</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text style={[styles.modalText, isDark && styles.textDark]}>
                Your {streakData.currentStreak}-day streak ends in <Text style={{ color: '#ef4444', fontWeight: '800' }}>{streakData.hoursUntilBreak} hours</Text>!
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowStreakProtector(false); navigation.navigate('Reminders', { babyId: baby.id }); }}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.modalBtnGradient}>
                    <Text style={styles.modalBtnText}>Set Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setShowStreakProtector(false)}>
                  <View style={[styles.modalBtnGradient, { backgroundColor: 'rgba(100,116,139,0.1)' }]}>
                    <Text style={[styles.modalBtnText, { color: '#64748b' }]}>Dismiss</Text>
                  </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 140 : 120, paddingHorizontal: 20, paddingBottom: 30 },
  textDark: { color: '#ffffff' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  // Header
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 12, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  pointsText: { fontSize: 13, fontWeight: '700', color: '#f59e0b' },

  // Glass Card
  glassCard: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  glassContent: { flex: 1 },

  // Alert
  alertContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, minWidth: 300, maxWidth: width - 40 },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // No Baby
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyEmoji: { fontSize: 56, marginBottom: 16 },
  noBabyTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabyButton: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, marginTop: 16 },
  noBabyButtonText: { color: '#667eea', fontSize: 15, fontWeight: '700' },

  // Baby Card
  babyCard: { borderRadius: 24, marginBottom: 16, overflow: 'hidden' },
  babyRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarEmoji: { fontSize: 36 },
  streakBadge: { position: 'absolute', bottom: -4, right: -4, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  streakBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  babyInfo: { flex: 1, marginLeft: 16 },
  babyName: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  babyAge: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsCol: { alignItems: 'center', marginLeft: 'auto', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(100,116,139,0.2)' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(239,68,68,0.2)' },
  warningText: { fontSize: 13, color: '#ef4444', marginLeft: 8, fontWeight: '600' },

  // Overview
  overviewCard: { borderRadius: 28, marginBottom: 20, padding: 20 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  overviewInfo: { flex: 1, marginLeft: 16 },
  overviewTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  overviewSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, alignSelf: 'flex-start' },
  pointsPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  categoryItem: { alignItems: 'center', flex: 1 },
  categoryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  categoryValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },

  // Progress
  progressItem: { alignItems: 'center' },
  progressSvgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  progressValue: { position: 'absolute', fontWeight: '800' },
  progressLabel: { color: '#64748b', marginTop: 6, fontWeight: '600' },

  // Quick Actions
  quickActions: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Filter
  filterScroll: { marginBottom: 20 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)', marginRight: 8, gap: 6 },
  filterActive: { backgroundColor: '#667eea', borderColor: 'transparent' },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  // Achievements
  achievementsSection: { marginTop: 8 },
  achievementsList: { gap: 12 },
  achievementCard: { borderRadius: 20, padding: 16, borderWidth: 1, overflow: 'hidden' },
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
  reminderLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  // Modal
  modal: { width: width - 60, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 25 },
  modalHeader: { padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  modalBody: { padding: 24, alignItems: 'center' },
  modalText: { fontSize: 16, color: '#1e293b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  modalBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
