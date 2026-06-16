import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FadeInDown, FadeInLeft, FadeInUp, interpolate, Layout, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useBaby } from '../../context/BabyContext';
import { , Alert, Animated, Button, Dimensions, FlatList, Modal, Platform, RefreshControl, ScrollView, Settings, Share, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';;
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

import { useTracker } from '../../context/TrackerContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useTrackerAchievements, Achievement, AchievementCategory } from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatarSafeAvatar } from '../../components/SafeAvatar';;
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

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
  growth: { label: 'Growth', icon: 'trending-up', color: '#43e97b' },
  predictive: { label: 'Smart Insights', icon: 'bulb', color: '#f472b6' },
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const ACHIEVEMENTS_PAGE_SIZE = 10;

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
          {achievement.sourceTrackers && achievement.sourceTrackers.length > 0 && (
            <View style={styles.sourceTrackers}>
              {achievement.sourceTrackers.map((tid) => (
                <View key={tid} style={[styles.sourceChip, { backgroundColor: `${rarity.text}15` }]}>
                  <Text style={[styles.sourceChipText, { color: rarity.text }]}>{tid}</Text>
                </View>
              ))}
            </View>
          )}
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
          {achievement.unlocked && achievement.earnedSummary && (
            <Text style={styles.earnedSummary}>{achievement.earnedSummary}</Text>
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
  const { currentBaby, babies, refreshCurrentBaby } = useBaby();
  const { entries } = useTracker();
  const {
    achievements,
    stats,
    streak,
    newlyUnlocked,
    growthScore,
    pendingReminders,
    isLoading: achievementsLoading,
    refresh: refreshAchievements,
  } = useTrackerAchievements();

  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ACHIEVEMENT_CATEGORIES | 'all'>('all');
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [showStreakProtector, setShowStreakProtector] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set());
  const [scheduledNotifications, setScheduledNotifications] = useState<Map<string, string>>(new Map());
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
      refreshCurrentBaby();
      refreshAchievements();
      loadReminders();
    }, [baby?.id])
  );

  /* ---- Load saved data on mount ---- */
  useEffect(() => {
    loadReminders();
    loadScheduledNotifications();
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAchievements();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
      sweetAlert('error', 'Save Failed', 'Could not save reminder settings');
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

  /* ---- Show alert helper ---- */
  const sweetAlert = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
    triggerHaptic(type === 'success' || type === 'achievement' ? 'success' : type === 'error' ? 'error' : 'light');
  };

  /* ---- Toggle reminder with proper notification management ---- */
  const toggleReminder = async (achievement: Achievement) => {
    const newEnabled = new Set(reminderEnabled);
    const newScheduled = new Map(scheduledNotifications);

    if (newEnabled.has(achievement.id)) {
      newEnabled.delete(achievement.id);
      const notificationId = newScheduled.get(achievement.id);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        newScheduled.delete(achievement.id);
      }
      sweetAlert('info', 'Reminder Disabled', `No more reminders for "${achievement.title}"`, '🔕');
    } else {
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
            minute: 0,
          },
        });
        newScheduled.set(achievement.id, notificationId);
        sweetAlert('success', 'Reminder Set!', `We'll remind you daily at 9 AM about "${achievement.title}"`, achievement.emoji);
      } catch (e) {
        console.warn('Failed to schedule notification:', e);
        sweetAlert('error', 'Reminder Failed', 'Could not schedule notification. Check permissions.');
      }
    }

    setReminderEnabled(newEnabled);
    setScheduledNotifications(newScheduled);
    await saveReminders(newEnabled);
    await saveScheduledNotifications(newScheduled);
    triggerHaptic('light');
  };

  /* ---- Category filter ---- */
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
    setDisplayCount(ACHIEVEMENTS_PAGE_SIZE);
    const label = category === 'all' ? 'all achievements' : `${ACHIEVEMENT_CATEGORIES[category].label} achievements`;
    sweetAlert('info', 'Filter', `Showing ${label}`);
  };

  /* ---- Refresh ---- */
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentBaby();
    refreshAchievements();
    setRefreshing(false);
    sweetAlert('success', 'Refreshed!', 'Achievement data updated');
  };

  /* ---- Share ---- */
  const handleShare = async () => {
    triggerHaptic('medium');
    try {
      const message = baby
        ? `🏆 ${baby.name} has unlocked ${stats.unlocked} achievements on LittleLoom! Total: ${stats.totalPoints} points. ${streak.currentStreak > 0 ? `${streak.currentStreak}-day streak! 🔥` : ''}`
        : `I've unlocked ${stats.unlocked} achievements on LittleLoom! 🏆 Total: ${stats.totalPoints} points.`;
      await Share.share({ message, title: 'LittleLoom Achievements' });
      sweetAlert('success', 'Shared!', 'Your achievements have been shared');
    } catch { sweetAlert('error', 'Share Failed', 'Could not share achievements'); }
  };

  /* ---- Achievement press ---- */
  const handlePress = (achievement: Achievement) => {
    triggerHaptic('light');
    if (achievement.unlocked) {
      sweetAlert('achievement', achievement.title, `Unlocked! ${achievement.points} points earned`, achievement.emoji);
    } else {
      const remaining = achievement.maxProgress - achievement.progress;
      sweetAlert('info', achievement.title, `${remaining} more to unlock! Keep tracking!`, achievement.emoji);
    }
  };

  /* ---- Navigation helpers ---- */
  const handleNavigateToMilestones = useCallback(() => {
    navigation.navigate('AddEntry', { type: 'milestone', babyId: baby?.id });
  }, [navigation, baby?.id]);

  const handleNavigateToTracker = useCallback((type: string) => {
    navigation.navigate('Timeline', { type, babyId: baby?.id });
  }, [navigation, baby?.id]);

  const handleNavigateToReminders = useCallback(() => {
    navigation.navigate('TrackerReminders', { babyId: baby?.id });
  }, [navigation, baby?.id]);

  /* ---- Scroll handler ---- */
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0.95, 1], Extrapolate.CLAMP),
  }));

  /* ---- Render achievement item for FlatList ---- */
  const renderAchievementItem = useCallback(({ item, index }: { item: Achievement; index: number }) => {
    const rarity = RARITY_COLORS[item.rarity];
    const isNew = newlyUnlocked.includes(item.id);
    const hasReminder = reminderEnabled.has(item.id);

    return (
      <AchievementCard
        achievement={item}
        index={index}
        isDark={isDark}
        isNew={isNew}
        hasReminder={hasReminder}
        rarity={rarity}
        themeColors={themeColors}
        onPress={handlePress}
        onToggleReminder={toggleReminder}
        shouldReduceMotion={shouldReduceMotion}
      />
    );
  }, [isDark, newlyUnlocked, reminderEnabled, themeColors, handlePress, toggleReminder, shouldReduceMotion]);

  const keyExtractor = useCallback((item: Achievement) => item.id, []);

  /* ── Growth Score Mini Card ── */
  const GrowthScoreMini = () => {
    if (!growthScore) return null;
    const overall = growthScore.overall?.value || 0;
    return (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(150).springify()}>
        <GlassmorphismCard style={styles.growthScoreCard}>
          <View style={styles.growthScoreRow}>
            <View style={styles.growthScoreLeft}>
              <Ionicons name="analytics" size={20} color={themeColors.primary} />
              <Text style={[styles.growthScoreTitle, isDark && styles.textDark]}>Growth Score</Text>
            </View>
            <View style={[styles.growthScoreBadge, { backgroundColor: overall >= 80 ? '#11998e20' : overall >= 60 ? '#f59e0b20' : '#ef444420' }]}>
              <Text style={[styles.growthScoreValue, { color: overall >= 80 ? '#11998e' : overall >= 60 ? '#f59e0b' : '#ef4444' }]}>
                {Math.round(overall)}
              </Text>
            </View>
          </View>
          <View style={styles.growthScoreDimensions}>
            {Object.entries(growthScore.dimensions || {}).slice(0, 4).map(([dim, score]: [string, any]) => (
              <View key={dim} style={styles.dimensionItem}>
                <View style={[styles.dimensionDot, { backgroundColor: score >= 70 ? '#11998e' : score >= 50 ? '#f59e0b' : '#ef4444' }]} />
                <Text style={styles.dimensionLabel}>{dim}</Text>
                <Text style={styles.dimensionValue}>{Math.round(score)}</Text>
              </View>
            ))}
          </View>
        </GlassmorphismCard>
      </Animated.View>
    );
  };

  /* ── Predictive Reminders Banner ── */
  const PredictiveBanner = () => {
    if (pendingReminders.length === 0) return null;
    const topReminder = pendingReminders[0];
    return (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(250).springify()}>
        <TouchableOpacity
          style={[styles.predictiveBanner, { borderColor: topReminder.priority === 'high' ? '#ef444450' : '#f59e0b50' }]}
          onPress={() => {
            if (topReminder.action?.screen) {
              navigation.navigate(topReminder.action.screen as any, topReminder.action.params as any);
            }
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={topReminder.priority === 'high' ? ['#ef444415', '#f8717110'] : ['#f59e0b15', '#fbbf2410']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.predictiveHeader}>
            <Text style={styles.predictiveEmoji}>{topReminder.emoji}</Text>
            <View style={styles.predictiveMeta}>
              <Text style={[styles.predictiveTitle, isDark && styles.textDark]}>{topReminder.title}</Text>
              <Text style={styles.predictiveDesc} numberOfLines={2}>{topReminder.description}</Text>
            </View>
            <View style={[styles.confidenceBadge, { backgroundColor: `${topReminder.priority === 'high' ? '#ef4444' : '#f59e0b'}20` }]}>
              <Text style={[styles.confidenceText, { color: topReminder.priority === 'high' ? '#ef4444' : '#f59e0b' }]}>
                {Math.round(topReminder.confidence)}%
              </Text>
            </View>
          </View>
          <View style={styles.predictiveFooter}>
            <Ionicons name="bulb" size={14} color="#f472b6" />
            <Text style={styles.predictiveFooterText}>Based on {topReminder.basedOn?.length || 0} data points</Text>
            <Text style={styles.predictiveAction}>Tap to act →</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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
                    showBadge={streak.currentStreak > 0}
                    animated={!shouldReduceMotion}
                  />
                  <View style={styles.babyInfo}>
                    <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                    <Text style={styles.babyAge}>{baby.age}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: streak.streakAtRisk ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)' }]}>
                      <Ionicons name={streak.streakAtRisk ? 'flame-outline' : 'checkmark-circle'} size={14} color={streak.streakAtRisk ? '#ef4444' : '#10b981'} />
                      <Text style={[styles.statusText, { color: streak.streakAtRisk ? '#ef4444' : '#10b981' }]}>
                        {streak.streakAtRisk ? 'Streak at risk!' : 'On track'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statsCol}>
                    <Text style={[styles.statValue, isDark && styles.textDark]}>{streak.longestStreak}</Text>
                    <Text style={styles.statLabel}>Best</Text>
                  </View>
                </View>
                {streak.streakAtRisk && (
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

            {/* Growth Score Mini Card */}
            <GrowthScoreMini />

            {/* Predictive Reminders Banner */}
            <PredictiveBanner />

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
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowStreakProtector(true); sweetAlert('warning', 'Streak Protector', 'Protect your current streak!'); }}>
                  <LinearGradient colors={['#ef4444', '#f87171']} style={styles.actionGradient}>
                    <Ionicons name="flame" size={20} color="#fff" /><Text style={styles.actionText}>Protect</Text>
                  </LinearGradient>
                </TouchableOpacity>
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
                Your {streak.currentStreak}-day streak ends in <Text style={{ color: '#ef4444', fontWeight: '800' }}>{streak.hoursUntilBreak} hours</Text>!
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
                <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowStreakProtector(false); sweetAlert('info', 'Dismissed', 'You can log an activity anytime'); }}>
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
  sourceTrackers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  sourceChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sourceChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  progressBox: { marginTop: 'auto' },
  progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontSize: 12, fontWeight: '700' },
  pointsSmall: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  reminderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  earnedSummary: { fontSize: 11, color: '#11998e', marginTop: 8, fontWeight: '600' },
  modal: { width: width - 60, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 25 },
  modalHeader: { padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  modalBody: { padding: 24, alignItems: 'center' },
  modalText: { fontSize: 16, color: '#1e293b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  modalActions: { flexDirection: 'column', gap: 10, width: '100%' },
  modalBtn: { borderRadius: 16, overflow: 'hidden' },
  modalBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  growthScoreCard: { borderRadius: 24, marginBottom: 16, padding: 16, overflow: 'hidden' },
  growthScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  growthScoreLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growthScoreTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  growthScoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  growthScoreValue: { fontSize: 18, fontWeight: '800' },
  growthScoreDimensions: { flexDirection: 'row', justifyContent: 'space-between' },
  dimensionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dimensionDot: { width: 8, height: 8, borderRadius: 4 },
  dimensionLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  dimensionValue: { fontSize: 11, fontWeight: '800', color: '#1e293b', marginLeft: 2 },
  predictiveBanner: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1.5, overflow: 'hidden' },
  predictiveHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  predictiveEmoji: { fontSize: 28 },
  predictiveMeta: { flex: 1 },
  predictiveTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  predictiveDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  confidenceText: { fontSize: 12, fontWeight: '800' },
  predictiveFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  predictiveFooterText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  predictiveAction: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: '#f472b6' },
});
