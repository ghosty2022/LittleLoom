import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Dimensions,
  Platform,
  Alert,
  TextInput,
  StatusBar,
  SectionList,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format,
  addDays,
  isSameDay,
  parseISO,
  startOfDay,
  differenceInDays,
  differenceInHours,
  isToday,
  isTomorrow,
  addMinutes,
  set,
} from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView, AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';

const { width, height } = Dimensions.get('window');
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION HANDLER
   ═══════════════════════════════════════════════════════════════ */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type RepeatType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'once' | 'custom';
type CategoryType = 'potty' | 'feed' | 'sleep' | 'milestone' | 'medication' | 'play' | 'custom' | 'growth' | 'diaper' | 'symptom';

interface Reminder {
  id: string;
  title: string;
  time: string; // "HH:mm"
  emoji: string;
  enabled: boolean;
  repeat: RepeatType;
  category: CategoryType;
  babyId?: string;
  babyName?: string;
  notes?: string;
  lastTriggered?: string;
  streakDay?: number;
  isAchievementRelated?: boolean;
  achievementId?: string;
  smartSuggestion?: boolean;
  notificationId?: string;
  createdAt: string;
  color?: string;
  daysOfWeek?: number[]; // 0-6 for custom repeat
  endDate?: string; // ISO date for one-time reminders
}

interface SmartSuggestion {
  id: string;
  type: CategoryType;
  title: string;
  description: string;
  emoji: string;
  reason: string;
  optimalTime: string;
  confidence: number;
  basedOn: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

interface TimeSlot {
  hour: number;
  label: string;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
}

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning' | 'achievement';
  title: string;
  message: string;
  emoji?: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  REMINDERS: '@littleloom_reminders_v3',
  COMPLETED: '@littleloom_completed_reminders_v2',
  SNOOZED: '@littleloom_snoozed_reminders',
  SMART_DISMISSED: '@littleloom_smart_dismissed',
};

const CATEGORY_CONFIG: Record<CategoryType, { emoji: string; color: string; label: string; icon: any }> = {
  potty: { emoji: '🚽', color: '#667eea', label: 'Potty', icon: 'water-outline' },
  feed: { emoji: '🍼', color: '#fa709a', label: 'Feed', icon: 'nutrition-outline' },
  sleep: { emoji: '😴', color: '#11998e', label: 'Sleep', icon: 'moon-outline' },
  milestone: { emoji: '🌟', color: '#f59e0b', label: 'Milestone', icon: 'trophy-outline' },
  medication: { emoji: '💊', color: '#ef4444', label: 'Medication', icon: 'medical-outline' },
  play: { emoji: '🎮', color: '#ec4899', label: 'Play', icon: 'game-controller-outline' },
  growth: { emoji: '📏', color: '#43e97b', label: 'Growth', icon: 'trending-up-outline' },
  diaper: { emoji: '🧷', color: '#fc5c7d', label: 'Diaper', icon: 'shirt-outline' },
  symptom: { emoji: '🤒', color: '#f97316', label: 'Symptom', icon: 'pulse-outline' },
  custom: { emoji: '⏰', color: '#64748b', label: 'Custom', icon: 'timer-outline' },
};

const REPEAT_LABELS: Record<RepeatType, string> = {
  daily: 'Every day',
  weekdays: 'Mon-Fri',
  weekends: 'Sat-Sun',
  weekly: 'Weekly',
  once: 'One time',
  custom: 'Custom',
};

const TIME_SLOTS: TimeSlot[] = [
  { hour: 6, label: 'Early Morning', period: 'morning' },
  { hour: 8, label: 'Morning', period: 'morning' },
  { hour: 12, label: 'Noon', period: 'afternoon' },
  { hour: 14, label: 'Afternoon', period: 'afternoon' },
  { hour: 17, label: 'Evening', period: 'evening' },
  { hour: 19, label: 'Night', period: 'evening' },
  { hour: 21, label: 'Late Night', period: 'night' },
  { hour: 23, label: 'Midnight', period: 'night' },
];

const WEEKDAYS = [
  { id: 1, label: 'M', full: 'Monday' },
  { id: 2, label: 'T', full: 'Tuesday' },
  { id: 3, label: 'W', full: 'Wednesday' },
  { id: 4, label: 'T', full: 'Thursday' },
  { id: 5, label: 'F', full: 'Friday' },
  { id: 6, label: 'S', full: 'Saturday' },
  { id: 0, label: 'S', full: 'Sunday' },
];

/* ═══════════════════════════════════════════════════════════════
   UTILITY: INTELLIGENT REMINDER ENGINE
   ═══════════════════════════════════════════════════════════════ */

class IntelligentReminderEngine {
  constructor(
    private activities: any[],
    private baby: any,
    private milestones: any[],
    private existingReminders: Reminder[]
  ) {}

  analyzePatterns(): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    if (!this.baby) return suggestions;

    const babyActs = this.activities.filter((a) => a.babyId === this.baby.id);
    const now = new Date();
    const currentHour = now.getHours();

    const pottyActs = babyActs.filter((a) => a.type === 'potty');
    if (pottyActs.length >= 3) {
      const avgInterval = this.calculateAverageInterval(pottyActs);
      const lastPotty = pottyActs[pottyActs.length - 1];
      const hoursSince = lastPotty ? differenceInHours(now, new Date(lastPotty.timestamp)) : 999;
      const nextPottyTime = lastPotty ? addMinutes(new Date(lastPotty.timestamp), avgInterval * 60) : null;

      if (hoursSince > avgInterval * 0.8) {
        suggestions.push({
          id: 'potty_urgent',
          type: 'potty',
          title: 'Potty Break Soon',
          description: `Last potty was ${hoursSince}h ago. Usual interval: ${Math.round(avgInterval)}h.`,
          emoji: '🚽',
          reason: 'Pattern detected from your logs',
          optimalTime: nextPottyTime ? format(nextPottyTime, 'HH:mm') : format(addMinutes(now, 30), 'HH:mm'),
          confidence: Math.min(95, 60 + hoursSince * 5),
          basedOn: `${pottyActs.length} potty logs`,
          action: 'Log potty now',
          priority: hoursSince > avgInterval ? 'high' : 'medium',
        });
      }
    }

    const sleepActs = babyActs.filter((a) => a.type === 'sleep');
    if (sleepActs.length >= 2) {
      const bedtimes = sleepActs
        .filter((a) => a.data?.sleepType === 'night' || a.data?.sleepType === 'nap')
        .map((a) => new Date(a.timestamp).getHours());
      if (bedtimes.length > 0) {
        const avgBedtime = Math.round(bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length);
        const bedtimeStr = `${String(avgBedtime).padStart(2, '0')}:00`;
        const isNearBedtime = currentHour >= avgBedtime - 1 && currentHour < avgBedtime + 1;

        if (!this.hasReminderFor('sleep', bedtimeStr)) {
          suggestions.push({
            id: 'sleep_routine',
            type: 'sleep',
            title: 'Bedtime Routine',
            description: `Start winding down around ${bedtimeStr} for better sleep.`,
            emoji: '😴',
            reason: 'Consistent bedtime improves sleep quality',
            optimalTime: `${String(Math.max(0, avgBedtime - 1)).padStart(2, '0')}:30`,
            confidence: 90,
            basedOn: `${sleepActs.length} sleep sessions`,
            action: 'Start bedtime routine',
            priority: isNearBedtime ? 'high' : 'medium',
          });
        }
      }
    }

    const feedActs = babyActs.filter((a) => a.type === 'feed');
    if (feedActs.length >= 3) {
      const avgInterval = this.calculateAverageInterval(feedActs);
      const lastFeed = feedActs[feedActs.length - 1];
      const hoursSince = lastFeed ? differenceInHours(now, new Date(lastFeed.timestamp)) : 999;

      if (hoursSince > avgInterval * 0.7) {
        suggestions.push({
          id: 'feed_soon',
          type: 'feed',
          title: 'Feeding Time',
          description: `Average gap: ${Math.round(avgInterval)}h. Last feed: ${hoursSince}h ago.`,
          emoji: '🍼',
          reason: 'Regular feeding schedule detected',
          optimalTime: format(addMinutes(now, 15), 'HH:mm'),
          confidence: Math.min(90, 50 + hoursSince * 8),
          basedOn: `${feedActs.length} feeding logs`,
          action: 'Prepare feeding',
          priority: hoursSince > avgInterval ? 'high' : 'medium',
        });
      }
    }

    const medActs = babyActs.filter((a) => a.type === 'medication');
    const activeMeds = medActs.filter((a) => {
      const daysSince = differenceInDays(now, new Date(a.timestamp));
      return daysSince < 7; // Active within last week
    });
    if (activeMeds.length > 0) {
      const lastMed = activeMeds[activeMeds.length - 1];
      const medName = lastMed.data?.medName || 'Medication';
      suggestions.push({
        id: 'medication_reminder',
        type: 'medication',
        title: `${medName} Due`,
        description: 'Keep up with the medication schedule.',
        emoji: '💊',
        reason: 'Active medication tracking',
        optimalTime: '09:00',
        confidence: 85,
        basedOn: `${activeMeds.length} recent medication logs`,
        action: 'Log medication',
        priority: 'high',
      });
    }

    const milestoneActs = babyActs.filter((a) => a.type === 'milestone');
    const daysSinceMilestone = milestoneActs.length > 0
      ? differenceInDays(now, new Date(milestoneActs[milestoneActs.length - 1].timestamp))
      : 999;

    if (daysSinceMilestone > 14) {
      suggestions.push({
        id: 'milestone_check',
        type: 'milestone',
        title: 'Record a Milestone',
        description: `It's been ${daysSinceMilestone} days since the last milestone.`,
        emoji: '🌟',
        reason: 'Documenting milestones creates memories',
        optimalTime: '10:00',
        confidence: 75,
        basedOn: `${milestoneActs.length} milestones recorded`,
        action: 'Add milestone',
        priority: 'low',
      });
    }

    const streak = this.calculateStreak();
    if (streak >= 3) {
      const hasTodayActivity = babyActs.some((a) => isSameDay(new Date(a.timestamp), now));
      if (!hasTodayActivity && currentHour >= 18) {
        suggestions.push({
          id: 'streak_protect',
          type: 'custom',
          title: `🔥 Protect ${streak}-Day Streak!`,
          description: `${24 - currentHour} hours left to log something today.`,
          emoji: '🔥',
          reason: "Don't break your tracking streak",
          optimalTime: `${String(currentHour + 1).padStart(2, '0')}:00`,
          confidence: 95,
          basedOn: `${streak} day activity streak`,
          action: 'Quick log',
          priority: 'high',
        });
      }
    }

    const growthActs = babyActs.filter((a) => a.type === 'growth');
    const daysSinceGrowth = growthActs.length > 0
      ? differenceInDays(now, new Date(growthActs[growthActs.length - 1].timestamp))
      : 999;
    if (daysSinceGrowth > 30) {
      suggestions.push({
        id: 'growth_check',
        type: 'growth',
        title: 'Monthly Growth Check',
        description: `Last measurement was ${daysSinceGrowth} days ago.`,
        emoji: '📏',
        reason: 'Monthly growth tracking recommended',
        optimalTime: '09:00',
        confidence: 70,
        basedOn: `${growthActs.length} growth measurements`,
        action: 'Measure now',
        priority: 'medium',
      });
    }

    return suggestions.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority] || b.confidence - a.confidence;
    });
  }

  private calculateAverageInterval(activities: any[]): number {
    if (activities.length < 2) return 3;
    let totalDiff = 0;
    let count = 0;
    for (let i = 1; i < activities.length; i++) {
      const diff = differenceInHours(new Date(activities[i].timestamp), new Date(activities[i - 1].timestamp));
      if (diff > 0 && diff < 24) {
        totalDiff += diff;
        count++;
      }
    }
    return count > 0 ? totalDiff / count : 3;
  }

  private calculateStreak(): number {
    const dailyActivities = this.activities.filter((a) => a.babyId === this.baby?.id);
    let streak = 0;
    let currentDate = new Date();
    while (true) {
      const hasActivity = dailyActivities.some((a) => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) {
        streak++;
        currentDate = addDays(currentDate, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  private hasReminderFor(category: CategoryType, time: string): boolean {
    return this.existingReminders.some(
      (r) => r.category === category && r.time === time && r.enabled
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   GLASSMORPHISM CARD
   ═══════════════════════════════════════════════════════════════ */

const GlassmorphismCard = ({
  children,
  style,
  onPress,
  intensity = 80,
  activeOpacity = 0.8,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  activeOpacity?: number;
}) => {
  const { darkMode: isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={activeOpacity} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)']
            : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SWEET ALERT
   ═══════════════════════════════════════════════════════════════ */

const SweetAlert = ({
  visible,
  type,
  title,
  message,
  emoji,
  onClose,
  isDark,
}: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withTiming(-30, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'] as const, icon: 'checkmark-circle' as const },
    error: { colors: ['#ef4444', '#f87171'] as const, icon: 'alert-circle' as const },
    info: { colors: ['#3b82f6', '#60a5fa'] as const, icon: 'information-circle' as const },
    warning: { colors: ['#f59e0b', '#fbbf24'] as const, icon: 'warning' as const },
    achievement: { colors: ['#f59e0b', '#fbbf24'] as const, icon: 'trophy' as const },
  }[type];

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 9999,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: Platform.OS === 'ios' ? 60 : 40,
          pointerEvents: 'none',
        },
      ]}
    >
      <Animated.View
        style={[
          style,
          styles.alertContainer,
          { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
        ]}
      >
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          {emoji ? (
            <Text style={{ fontSize: 28 }}>{emoji}</Text>
          ) : (
            <Ionicons name={config.icon} size={28} color="#fff" />
          )}
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
   QUICK TIME BUTTON
   ═══════════════════════════════════════════════════════════════ */

const QuickTimeButton = ({
  label,
  time,
  selected,
  onPress,
  color,
}: {
  label: string;
  time: string;
  selected: boolean;
  onPress: () => void;
  color: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.quickTimeBtn,
      selected && { backgroundColor: `${color}20`, borderColor: color, borderWidth: 2 },
    ]}
  >
    <Text style={[styles.quickTimeLabel, selected && { color, fontWeight: '700' }]}>{label}</Text>
    <Text style={[styles.quickTimeValue, selected && { color }]}>{time}</Text>
  </TouchableOpacity>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

export default function RemindersScreen({ navigation, route }: Props) {
  const { darkMode: isDark, themeColors, triggerHaptic, reduceMotion } = useCustomization();
  const { currentBaby, babies, loadBabies } = useBaby();
  const { entries: activities } = useActivity();

  /* ---- State ---- */
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'smart'>('upcoming');
  const [streakData, setStreakData] = useState({ current: 0, atRisk: false, hoursLeft: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('custom');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('daily');
  const [formTime, setFormTime] = useState(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formColor, setFormColor] = useState(CATEGORY_CONFIG.custom.color);

  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);

  /* ---- Derived ---- */
  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find((b) => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  /* ---- Scroll handler ---- */
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      headerOpacity.value = interpolate(
        event.contentOffset.y,
        [0, 100],
        [1, 0.95],
        Extrapolation.CLAMP
      );
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 100], [0, -5], Extrapolation.CLAMP),
      },
    ],
  }));

  /* ---- Focus effect: refresh on return ---- */
  useFocusEffect(
    useCallback(() => {
      loadData();
      checkStreakStatus();
      generateSmartSuggestions();
    }, [baby?.id])
  );

  /* ---- Initial load ---- */
  useEffect(() => {
    loadData();
    requestNotificationPermissions();
    loadDismissedSuggestions();

    if (route.params?.suggestedType || route.params?.fromAchievement) {
      handleAchievementSuggestion();
    }
  }, [baby?.id]);

  /* ---- Notification response listener ---- */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        if (data.screen === 'UniversalTracker' && data.type) {
          navigation.navigate('Timeline', { type: data.type, babyId: data.babyId });
        } else if (data.screen === 'AddLog') {
          navigation.navigate('AddEntry', { type: data.type, babyId: data.babyId });
        } else {
          navigation.navigate(data.screen as any, data.params || {});
        }
      }
    });
    return () => subscription.remove();
  }, [navigation]);

  /* ---- Data loading ---- */
  const loadData = async () => {
    setIsLoading(true);
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      if (saved) {
        const parsed: Reminder[] = JSON.parse(saved);
        const filtered = baby ? parsed.filter((r) => !r.babyId || r.babyId === baby.id) : parsed;
        setReminders(filtered);
      } else {
        setReminders(getDefaultReminders());
      }
    } catch (error) {
      console.warn('Failed to load reminders:', error);
      setReminders(getDefaultReminders());
    } finally {
      setIsLoading(false);
    }
  };

  const loadDismissedSuggestions = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SMART_DISMISSED);
      if (saved) setDismissedSuggestions(new Set(JSON.parse(saved)));
    } catch (e) {
      console.warn('Failed to load dismissed suggestions:', e);
    }
  };

  const saveDismissedSuggestions = async (set: Set<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SMART_DISMISSED, JSON.stringify([...set]));
    } catch (e) {
      console.warn('Failed to save dismissed suggestions:', e);
    }
  };

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'Notifications Required',
        'Please enable notifications in Settings to receive reminder alerts.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  /* ---- Default reminders ---- */
  const getDefaultReminders = (): Reminder[] => {
    if (!baby) return [];
    const babyId = baby.id;
    const babyName = baby.name;
    return [
      {
        id: 'default_1',
        title: 'Morning Potty',
        time: '08:00',
        emoji: '🚽',
        enabled: true,
        repeat: 'daily',
        category: 'potty',
        babyId,
        babyName,
        createdAt: new Date().toISOString(),
        color: CATEGORY_CONFIG.potty.color,
      },
      {
        id: 'default_2',
        title: 'First Feed',
        time: '07:00',
        emoji: '🍼',
        enabled: true,
        repeat: 'daily',
        category: 'feed',
        babyId,
        babyName,
        createdAt: new Date().toISOString(),
        color: CATEGORY_CONFIG.feed.color,
      },
      {
        id: 'default_3',
        title: 'Bedtime Routine',
        time: '19:30',
        emoji: '🌙',
        enabled: true,
        repeat: 'daily',
        category: 'sleep',
        babyId,
        babyName,
        createdAt: new Date().toISOString(),
        color: CATEGORY_CONFIG.sleep.color,
      },
      {
        id: 'default_4',
        title: 'Vitamin D',
        time: '08:30',
        emoji: '💊',
        enabled: true,
        repeat: 'daily',
        category: 'medication',
        babyId,
        babyName,
        createdAt: new Date().toISOString(),
        color: CATEGORY_CONFIG.medication.color,
      },
    ];
  };

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      const allReminders: Reminder[] = saved ? JSON.parse(saved) : [];
      const otherReminders = allReminders.filter(
        (r) => r.babyId && r.babyId !== baby?.id
      );
      const merged = [...otherReminders, ...newReminders];
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(merged));
    } catch (error) {
      console.warn('Failed to save reminders:', error);
      showToast('error', 'Save Failed', 'Could not save reminders');
    }
  };

  /* ---- Smart suggestions ---- */
  const generateSmartSuggestions = useCallback(() => {
    if (!baby) {
      setSmartSuggestions([]);
      return;
    }
    const engine = new IntelligentReminderEngine(activities, baby, [], reminders);
    const suggestions = engine.analyzePatterns();
    setSmartSuggestions(suggestions.filter((s) => !dismissedSuggestions.has(s.id)));
  }, [activities, baby, reminders, dismissedSuggestions]);

  /* ---- Streak status ---- */
  const checkStreakStatus = useCallback(() => {
    if (!baby) return;
    const babyActs = activities.filter((a) => a.babyId === baby.id);
    let streak = 0;
    let currentDate = new Date();
    while (true) {
      const hasActivity = babyActs.some((a) => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) {
        streak++;
        currentDate = addDays(currentDate, -1);
      } else {
        break;
      }
    }
    const todayActivity = babyActs.some((a) => isSameDay(new Date(a.timestamp), new Date()));
    const hour = new Date().getHours();
    const atRisk = !todayActivity && hour >= 18 && streak > 0;
    const hoursLeft = atRisk ? 24 - hour : 0;
    setStreakData({ current: streak, atRisk, hoursLeft });
  }, [baby, activities]);

  /* ---- Achievement suggestion handler ---- */
  const handleAchievementSuggestion = () => {
    const { suggestedType, fromAchievement } = route.params || {};
    let title = 'Achievement Reminder';
    let emoji = '🎯';
    let category: CategoryType = 'custom';

    switch (suggestedType) {
      case 'potty':
        title = 'Potty Training Goal';
        emoji = '🚽';
        category = 'potty';
        break;
      case 'feed':
        title = 'Feeding Goal';
        emoji = '🍼';
        category = 'feed';
        break;
      case 'sleep':
        title = 'Sleep Routine Goal';
        emoji = '😴';
        category = 'sleep';
        break;
      case 'milestone':
        title = 'Record Milestone';
        emoji = '🌟';
        category = 'milestone';
        break;
      case 'streak':
        title = 'Protect Your Streak';
        emoji = '🔥';
        category = 'custom';
        break;
    }

    openAddModal({
      title,
      category,
      emoji,
      isAchievementRelated: true,
      achievementId: fromAchievement,
    });
  };

  /* ---- Notification scheduling ---- */
  const scheduleNotification = async (reminder: Reminder): Promise<string | undefined> => {
    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const now = new Date();

      let trigger: Notifications.NotificationTriggerInput;

      switch (reminder.repeat) {
        case 'daily':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          };
          break;
        case 'weekdays':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 2, // Monday
            hour: hours,
            minute: minutes,
          };
          break;
        case 'weekends':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 7, // Saturday
            hour: hours,
            minute: minutes,
          };
          break;
        case 'weekly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: (now.getDay() + 1) || 7, // Convert 0-6 to 1-7
            hour: hours,
            minute: minutes,
          };
          break;
        case 'custom':
          if (reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
            const today = now.getDay();
            const nextDay = reminder.daysOfWeek.find((d) => d > today) || reminder.daysOfWeek[0];
            const daysUntil = nextDay > today ? nextDay - today : 7 - today + nextDay;
            const targetDate = addDays(now, daysUntil);
            targetDate.setHours(hours, minutes, 0, 0);
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate,
            };
          } else {
            trigger = {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: hours,
              minute: minutes,
            };
          }
          break;
        default:
          const scheduledDate = new Date();
          scheduledDate.setHours(hours, minutes, 0, 0);
          if (scheduledDate < now) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
          }
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledDate,
          };
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${reminder.emoji} ${reminder.title}`,
          body: reminder.notes || `Time for ${reminder.title.toLowerCase()}!`,
          sound: true,
          badge: 1,
          data: {
            screen: 'Reminders',
            reminderId: reminder.id,
            category: reminder.category,
            babyId: reminder.babyId,
            type: reminder.category,
          },
        },
        trigger,
      });

      return id;
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
      return undefined;
    }
  };

  const cancelNotification = async (notificationId?: string) => {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  };

  /* ---- CRUD Operations ---- */
  const toggleReminder = async (id: string) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    const newEnabled = !reminder.enabled;
    let newNotificationId = reminder.notificationId;

    triggerHaptic(newEnabled ? 'success' : 'light');

    if (newEnabled) {
      newNotificationId = await scheduleNotification(reminder);
      if (newNotificationId) {
        showToast('success', 'Reminder On', `You'll be notified at ${reminder.time}`, reminder.emoji);
      }
    } else {
      await cancelNotification(reminder.notificationId);
      showToast('info', 'Reminder Off', `${reminder.title} is paused`);
    }

    const updated = reminders.map((r) =>
      r.id === id ? { ...r, enabled: newEnabled, notificationId: newNotificationId } : r
    );

    setReminders(updated);
    await saveReminders(updated);
  };

  const openAddModal = (preset?: Partial<Reminder>) => {
    setFormTitle(preset?.title || '');
    setFormCategory(preset?.category || 'custom');
    setFormRepeat('daily');
    setFormTime(set(new Date(), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }));
    setFormNotes(preset?.notes || '');
    setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormColor(preset?.color || CATEGORY_CONFIG[preset?.category || 'custom'].color);
    setEditingReminder(null);
    setShowAddModal(true);
  };

  const openEditModal = (reminder: Reminder) => {
    const [h, m] = reminder.time.split(':').map(Number);
    setFormTitle(reminder.title);
    setFormCategory(reminder.category);
    setFormRepeat(reminder.repeat);
    setFormTime(set(new Date(), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }));
    setFormNotes(reminder.notes || '');
    setFormDaysOfWeek(reminder.daysOfWeek || [1, 2, 3, 4, 5]);
    setFormColor(reminder.color || CATEGORY_CONFIG[reminder.category].color);
    setEditingReminder(reminder);
    setShowEditModal(true);
  };

  const validateForm = (): boolean => {
    if (!formTitle.trim()) {
      showToast('error', 'Title Required', 'Please enter a reminder title');
      return false;
    }
    return true;
  };

  const buildReminderFromForm = (id?: string): Reminder => {
    const timeStr = format(formTime, 'HH:mm');
    return {
      id: id || `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: formTitle.trim(),
      time: timeStr,
      emoji: CATEGORY_CONFIG[formCategory].emoji,
      enabled: true,
      repeat: formRepeat,
      category: formCategory,
      babyId: baby?.id,
      babyName: baby?.name,
      notes: formNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      color: formColor,
      daysOfWeek: formRepeat === 'custom' ? formDaysOfWeek : undefined,
      isAchievementRelated: editingReminder?.isAchievementRelated,
      achievementId: editingReminder?.achievementId,
    };
  };

  const addReminder = async () => {
    if (!validateForm()) return;

    const newReminder = buildReminderFromForm();
    const notificationId = await scheduleNotification(newReminder);
    newReminder.notificationId = notificationId;

    const updated = [...reminders, newReminder];
    setReminders(updated);
    await saveReminders(updated);

    setShowAddModal(false);
    resetForm();
    showToast('success', 'Reminder Added', `${newReminder.title} set for ${newReminder.time}`, newReminder.emoji);
    triggerHaptic('medium');
  };

  const updateReminder = async () => {
    if (!editingReminder || !validateForm()) return;

    await cancelNotification(editingReminder.notificationId);

    const updatedReminder = buildReminderFromForm(editingReminder.id);
    const notificationId = await scheduleNotification(updatedReminder);
    updatedReminder.notificationId = notificationId;

    const updated = reminders.map((r) => (r.id === editingReminder.id ? updatedReminder : r));
    setReminders(updated);
    await saveReminders(updated);

    setShowEditModal(false);
    setEditingReminder(null);
    resetForm();
    showToast('success', 'Reminder Updated', `${updatedReminder.title} updated`, updatedReminder.emoji);
  };

  const deleteReminder = async (id: string) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    showAlert('Delete Reminder', `Remove "${reminder.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelNotification(reminder.notificationId);
          const updated = reminders.filter((r) => r.id !== id);
          setReminders(updated);
          await saveReminders(updated);
          showToast('info', 'Deleted', `${reminder.title} removed`);
          triggerHaptic('light');
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormCategory('custom');
    setFormRepeat('daily');
    setFormTime(new Date());
    setFormNotes('');
    setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormColor(CATEGORY_CONFIG.custom.color);
  };

  const dismissSuggestion = async (id: string) => {
    const newSet = new Set(dismissedSuggestions);
    newSet.add(id);
    setDismissedSuggestions(newSet);
    await saveDismissedSuggestions(newSet);
    setSmartSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const applySmartSuggestion = async (suggestion: SmartSuggestion) => {
    const [hours, minutes] = suggestion.optimalTime.split(':').map(Number);
    const time = set(new Date(), { hours, minutes, seconds: 0, milliseconds: 0 });

    const newReminder: Reminder = {
      id: `smart_${Date.now()}`,
      title: suggestion.title,
      time: suggestion.optimalTime,
      emoji: suggestion.emoji,
      enabled: true,
      repeat: 'daily',
      category: suggestion.type,
      babyId: baby?.id,
      babyName: baby?.name,
      smartSuggestion: true,
      notes: suggestion.reason,
      createdAt: new Date().toISOString(),
      color: CATEGORY_CONFIG[suggestion.type].color,
    };

    const notificationId = await scheduleNotification(newReminder);
    newReminder.notificationId = notificationId;

    const updated = [...reminders, newReminder];
    setReminders(updated);
    await saveReminders(updated);

    dismissSuggestion(suggestion.id);

    showToast('success', 'Smart Reminder Added', `AI scheduled: ${suggestion.title}`, suggestion.emoji);
    triggerHaptic('success');
  };

  const quickLog = (type: CategoryType) => {
    navigation.navigate('Timeline', { type, babyId: baby?.id });
  };

  /* ---- Filtering & Sorting ---- */
  const filteredReminders = useMemo(() => {
    let list = [...reminders];

    if (activeTab === 'upcoming') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      list = list.sort((a, b) => {
        const aMin = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
        const bMin = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]);
        const aDiff = aMin >= currentMinutes ? aMin - currentMinutes : aMin + 1440 - currentMinutes;
        const bDiff = bMin >= currentMinutes ? bMin - currentMinutes : bMin + 1440 - currentMinutes;
        return aDiff - bDiff;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [reminders, activeTab, searchQuery]);

  const sections = useMemo(() => {
    if (activeTab === 'smart') {
      return smartSuggestions.length > 0
        ? [{ title: 'AI Suggestions', data: smartSuggestions as any[] }]
        : [];
    }

    if (activeTab === 'upcoming') {
      const morning: Reminder[] = [];
      const afternoon: Reminder[] = [];
      const evening: Reminder[] = [];
      const night: Reminder[] = [];
      const passed: Reminder[] = [];
      const currentHour = new Date().getHours();

      filteredReminders.forEach((r) => {
        const hour = parseInt(r.time.split(':')[0]);
        if (!r.enabled) {
          passed.push(r);
          return;
        }
        if (hour < currentHour) {
          passed.push(r);
        } else if (hour < 12) {
          morning.push(r);
        } else if (hour < 17) {
          afternoon.push(r);
        } else if (hour < 21) {
          evening.push(r);
        } else {
          night.push(r);
        }
      });

      const result: { title: string; data: Reminder[] }[] = [];
      if (morning.length) result.push({ title: 'Morning', data: morning });
      if (afternoon.length) result.push({ title: 'Afternoon', data: afternoon });
      if (evening.length) result.push({ title: 'Evening', data: evening });
      if (night.length) result.push({ title: 'Night', data: night });
      if (passed.length) result.push({ title: 'Later / Disabled', data: passed });
      return result;
    }

    const byCategory: Record<string, Reminder[]> = {};
    filteredReminders.forEach((r) => {
      const cat = CATEGORY_CONFIG[r.category]?.label || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(r);
    });
    return Object.entries(byCategory).map(([title, data]) => ({ title, data }));
  }, [filteredReminders, activeTab, smartSuggestions]);

  const getNextReminder = (): Reminder | null => {
    const enabled = reminders.filter((r) => r.enabled);
    if (enabled.length === 0) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let next = enabled.find((r) => {
      const [h, m] = r.time.split(':').map(Number);
      return h * 60 + m > currentMinutes;
    });
    if (!next) next = enabled[0];
    return next;
  };

  const nextReminder = getNextReminder();

  /* ---- Toast helper ---- */
  const showToast = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormTime(selectedDate);
    }
  };

  /* ---- Render helpers ---- */
  const renderSmartSuggestion = ({ item }: { item: SmartSuggestion }) => (
    <Animated.View entering={FadeInUp.springify()} layout={Layout.springify()}>
      <TouchableOpacity
        onPress={() => applySmartSuggestion(item)}
        activeOpacity={0.9}
        style={styles.suggestionCard}
      >
        <BlurView intensity={70} style={styles.suggestionBlur} tint={isDark ? 'dark' : 'light'}>
          <View style={styles.suggestionHeader}>
            <View style={[styles.suggestionEmojiBox, { backgroundColor: `${CATEGORY_CONFIG[item.type].color}20` }]}>
              <Text style={styles.suggestionEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.suggestionMeta}>
              <View
                style={[
                  styles.confidenceBadge,
                  {
                    backgroundColor:
                      item.confidence > 85 ? '#22c55e' : item.confidence > 70 ? '#f59e0b' : '#3b82f6',
                  },
                ]}
              >
                <Text style={styles.confidenceText}>{item.confidence}% match</Text>
              </View>
              {item.priority === 'high' && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>URGENT</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.suggestionTitle, isDark && styles.textDark]}>{item.title}</Text>
          <Text style={styles.suggestionDescription}>{item.description}</Text>
          <View style={styles.suggestionFooter}>
            <View style={styles.suggestionTimeRow}>
              <Ionicons name="time-outline" size={14} color="#64748b" />
              <Text style={styles.suggestionTime}>Best at {item.optimalTime}</Text>
            </View>
            <Text style={styles.suggestionBasedOn}>Based on: {item.basedOn}</Text>
          </View>
          <View style={styles.suggestionActions}>
            <TouchableOpacity style={styles.suggestionApplyBtn} onPress={() => applySmartSuggestion(item)}>
              <LinearGradient
                colors={[CATEGORY_CONFIG[item.type].color, `${CATEGORY_CONFIG[item.type].color}dd`]}
                style={styles.suggestionApplyGradient}
              >
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={styles.suggestionApplyText}>Add Reminder</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggestionDismissBtn} onPress={() => dismissSuggestion(item.id)}>
              <Text style={styles.suggestionDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderReminderItem = ({ item, index }: { item: Reminder; index: number }) => {
    const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.custom;
    const isNext = nextReminder?.id === item.id;
    const [h, m] = item.time.split(':').map(Number);
    const timeDate = set(new Date(), { hours: h, minutes: m });
    const isPast = !item.enabled || timeDate < new Date();

    return (
      <Animated.View
        entering={reduceMotion ? undefined : FadeInUp.delay(index * 30)}
        layout={reduceMotion ? undefined : Layout.springify()}
      >
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          onLongPress={() => {
            Vibration.vibrate(50);
            deleteReminder(item.id);
          }}
          activeOpacity={0.85}
          style={[
            styles.reminderItem,
            isNext && styles.reminderItemNext,
            !item.enabled && styles.reminderItemDisabled,
          ]}
        >
          <View style={[styles.reminderTimeBlock, { backgroundColor: `${config.color}15` }]}>
            <Text style={[styles.reminderTimeText, { color: config.color }]}>{item.time}</Text>
            <Text style={styles.reminderPeriodText}>
              {h < 12 ? 'AM' : 'PM'}
            </Text>
          </View>

          <View style={styles.reminderContent}>
            <View style={styles.reminderTopRow}>
              <View style={[styles.reminderIconSmall, { backgroundColor: `${config.color}20` }]}>
                <Text style={styles.reminderEmojiSmall}>{item.emoji}</Text>
              </View>
              <View style={styles.reminderTitleBlock}>
                <Text
                  style={[
                    styles.reminderTitle,
                    isDark && styles.textDark,
                    !item.enabled && styles.reminderTitleDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <View style={styles.reminderMetaRow}>
                  <Text style={styles.reminderCategoryText}>{config.label}</Text>
                  <Text style={styles.reminderDot}>•</Text>
                  <Text style={styles.reminderRepeatText}>{REPEAT_LABELS[item.repeat]}</Text>
                  {item.smartSuggestion && (
                    <>
                      <Text style={styles.reminderDot}>•</Text>
                      <View style={styles.smartBadge}>
                        <Ionicons name="sparkles" size={10} color="#f59e0b" />
                        <Text style={styles.smartBadgeText}>AI</Text>
                      </View>
                    </>
                  )}
                  {item.isAchievementRelated && (
                    <>
                      <Text style={styles.reminderDot}>•</Text>
                      <View style={styles.achievementBadge}>
                        <Ionicons name="trophy" size={10} color="#f59e0b" />
                        <Text style={styles.achievementBadgeText}>Goal</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>

            {item.notes && <Text style={styles.reminderNotesText} numberOfLines={1}>{item.notes}</Text>}

            {isNext && item.enabled && (
              <View style={styles.nextBadgeRow}>
                <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.nextBadgeGradient}>
                  <Ionicons name="alarm" size={12} color="#fff" />
                  <Text style={styles.nextBadgeText}>Next</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          <View style={styles.reminderRightActions}>
            <Switch
              value={item.enabled}
              onValueChange={() => toggleReminder(item.id)}
              trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: `${config.color}50` }}
              thumbColor={item.enabled ? config.color : isDark ? '#64748b' : '#fff'}
              ios_backgroundColor={isDark ? '#334155' : '#e2e8f0'}
            />
            <TouchableOpacity style={styles.reminderChevron} onPress={() => openEditModal(item)}>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#475569' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeaderText, isDark && styles.textDark]}>{section.title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e2e8f0']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors?.primary || '#667eea'} />
          <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading reminders...</Text>
        </View>
      </View>
    );
  }

  /* ---- No baby state ---- */
  if (!baby) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e2e8f0']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centerContent}>
          <GlassmorphismCard intensity={90}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.noBabyGradient}>
              <Text style={styles.noBabyEmoji}>⏰</Text>
              <Text style={styles.noBabyTitle}>No Baby Selected</Text>
              <Text style={styles.noBabySubtitle}>Select a baby profile to manage reminders</Text>
              <TouchableOpacity
                style={styles.noBabyButton}
                onPress={() => navigation.navigate('SwitchBaby')}
              >
                <Text style={[styles.noBabyButtonText, { color: '#667eea' }]}>Select Baby</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassmorphismCard>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8faff', '#e2e8f0', '#f1f5f9']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated Header */}
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, isDark && styles.textDark]}>Reminders</Text>
            {baby && <Text style={styles.headerSubtitle}>for {baby.name}</Text>}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSearch(!showSearch)}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.addBtn]} onPress={() => openAddModal()}>
              <LinearGradient colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']} style={styles.addBtnGradient}>
                <Ionicons name="add" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search reminders..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* Main Content */}
      <AnimatedSectionList
        sections={sections}
        keyExtractor={(item: any) => item.id}
        renderItem={activeTab === 'smart' ? renderSmartSuggestion : renderReminderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {/* Streak Warning Card */}
            {streakData.atRisk && (
              <Animated.View entering={FadeInDown.springify()}>
                <GlassmorphismCard style={styles.streakCard} intensity={90}>
                  <LinearGradient colors={['#ef4444', '#f87171']} style={styles.streakGradient}>
                    <View style={styles.streakRow}>
                      <View style={styles.streakIconCircle}>
                        <Ionicons name="flame" size={28} color="#ef4444" />
                      </View>
                      <View style={styles.streakTextBlock}>
                        <Text style={styles.streakTitle}>🔥 Streak at Risk!</Text>
                        <Text style={styles.streakSubtitle}>
                          {streakData.hoursLeft} hours left to save your {streakData.current}-day streak
                        </Text>
                      </View>
                    </View>
                    <View style={styles.streakActions}>
                      <TouchableOpacity
                        style={styles.streakActionBtn}
                        onPress={() => quickLog('potty')}
                      >
                        <Text style={styles.streakActionText}>Quick Log</Text>
                        <Ionicons name="add-circle" size={16} color="#ef4444" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.streakActionBtn, styles.streakActionBtnSecondary]}
                        onPress={() => openAddModal({ title: 'Protect Streak', category: 'custom' })}
                      >
                        <Text style={[styles.streakActionText, { color: '#fff' }]}>Set Reminder</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </GlassmorphismCard>
              </Animated.View>
            )}

            {/* Next Reminder Hero Card */}
            {nextReminder && activeTab !== 'smart' && (
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <GlassmorphismCard style={styles.nextCard} intensity={90}>
                  <View style={styles.nextHeader}>
                    <Text style={styles.nextLabel}>UPCOMING</Text>
                    <View
                      style={[
                        styles.nextTimeBadge,
                        { backgroundColor: CATEGORY_CONFIG[nextReminder.category]?.color || '#667eea' },
                      ]}
                    >
                      <Text style={styles.nextTimeBadgeText}>{nextReminder.time}</Text>
                    </View>
                  </View>
                  <View style={styles.nextBody}>
                    <Text style={styles.nextEmoji}>{nextReminder.emoji}</Text>
                    <View style={styles.nextInfo}>
                      <Text style={[styles.nextTitle, isDark && styles.textDark]}>
                        {nextReminder.title}
                      </Text>
                      <View style={styles.nextMeta}>
                        <Text style={styles.nextMetaText}>
                          {CATEGORY_CONFIG[nextReminder.category]?.label}
                        </Text>
                        <Text style={styles.nextMetaDot}>•</Text>
                        <Text style={styles.nextMetaText}>{REPEAT_LABELS[nextReminder.repeat]}</Text>
                        {nextReminder.babyName && (
                          <>
                            <Text style={styles.nextMetaDot}>•</Text>
                            <Text style={styles.nextMetaText}>{nextReminder.babyName}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  {nextReminder.notes && (
                    <Text style={styles.nextNotes} numberOfLines={2}>
                      {nextReminder.notes}
                    </Text>
                  )}
                </GlassmorphismCard>
              </Animated.View>
            )}

            {/* Smart Suggestions Horizontal Scroll (only on upcoming tab) */}
            {activeTab === 'upcoming' && smartSuggestions.length > 0 && (
              <View style={styles.smartSection}>
                <View style={styles.smartHeader}>
                  <View style={styles.smartTitleRow}>
                    <Ionicons name="sparkles" size={20} color="#f59e0b" />
                    <Text style={[styles.smartTitle, isDark && styles.textDark]}>Smart Suggestions</Text>
                  </View>
                  <Text style={styles.smartCount}>{smartSuggestions.length} found</Text>
                </View>
                <AutoHideScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.smartScroll}
                >
                  {smartSuggestions.map((suggestion, index) => (
                    <Animated.View
                      key={suggestion.id}
                      entering={FadeInRight.delay(index * 80).springify()}
                    >
                      <TouchableOpacity
                        onPress={() => applySmartSuggestion(suggestion)}
                        style={styles.smartCard}
                      >
                        <LinearGradient
                          colors={[
                            CATEGORY_CONFIG[suggestion.type]?.color + '20',
                            CATEGORY_CONFIG[suggestion.type]?.color + '05',
                          ]}
                          style={styles.smartCardGradient}
                        >
                          <View style={styles.smartCardHeader}>
                            <Text style={styles.smartCardEmoji}>{suggestion.emoji}</Text>
                            {suggestion.priority === 'high' && (
                              <View style={styles.smartCardUrgent}>
                                <Text style={styles.smartCardUrgentText}>NOW</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.smartCardTitle, isDark && styles.textDark]} numberOfLines={1}>
                            {suggestion.title}
                          </Text>
                          <Text style={styles.smartCardDesc} numberOfLines={2}>
                            {suggestion.description}
                          </Text>
                          <View style={styles.smartCardFooter}>
                            <Ionicons name="time-outline" size={12} color="#64748b" />
                            <Text style={styles.smartCardTime}>{suggestion.optimalTime}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </AutoHideScrollView>
              </View>
            )}

            {/* Tab Navigation */}
            <View style={styles.tabBar}>
              {([
                { key: 'upcoming', label: 'Upcoming', icon: 'time-outline' },
                { key: 'all', label: 'All', icon: 'list-outline' },
                { key: 'smart', label: 'Smart', icon: 'sparkles-outline', badge: smartSuggestions.length },
              ] as const).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && {
                      backgroundColor: isDark ? 'rgba(102,126,234,0.2)' : 'rgba(102,126,234,0.1)',
                      borderColor: themeColors?.primary || '#667eea',
                    },
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={activeTab === tab.key ? themeColors?.primary || '#667eea' : isDark ? '#64748b' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === tab.key && { color: themeColors?.primary || '#667eea', fontWeight: '700' },
                      isDark && { color: activeTab === tab.key ? themeColors?.primary || '#667eea' : '#64748b' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.badge > 0 && activeTab !== tab.key && (
                    <View style={[styles.tabBadge, { backgroundColor: themeColors?.primary || '#667eea' }]}>
                      <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats Row */}
            {activeTab !== 'smart' && (
              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillValue}>{reminders.filter((r) => r.enabled).length}</Text>
                  <Text style={styles.statPillLabel}>Active</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillValue}>{reminders.length}</Text>
                  <Text style={styles.statPillLabel}>Total</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillValue}>
                    {reminders.filter((r) => r.smartSuggestion).length}
                  </Text>
                  <Text style={styles.statPillLabel}>AI</Text>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'smart' ? 'sparkles-outline' : 'notifications-off-outline'}
              size={56}
              color={isDark ? '#334155' : '#cbd5e1'}
            />
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
              {activeTab === 'smart'
                ? 'No smart suggestions'
                : searchQuery
                ? 'No matches found'
                : 'No reminders yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'smart'
                ? 'Keep tracking activities and AI will suggest optimal reminders'
                : searchQuery
                ? 'Try a different search term'
                : 'Tap + to add your first reminder'}
            </Text>
            {activeTab !== 'smart' && !searchQuery && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => openAddModal()}>
                <LinearGradient
                  colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']}
                  style={styles.emptyAddGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.emptyAddText}>Add Reminder</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="auto">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}
            activeOpacity={1}
          >
            <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View
            entering={FadeInUp.springify()}
            style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>
                {showEditModal ? 'Edit Reminder' : 'New Reminder'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <AutoHideScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Title Input */}
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>What to remind?</Text>
              <TextInput
                style={[styles.textInput, isDark && styles.textInputDark]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g., Give Vitamin D"
                placeholderTextColor="#94a3b8"
                maxLength={50}
              />

                              {/* Category Grid */}
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Category</Text>
              <View style={styles.categoryGrid}>
                {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      formCategory === cat && {
                        backgroundColor: `${CATEGORY_CONFIG[cat].color}20`,
                        borderColor: CATEGORY_CONFIG[cat].color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => {
                      setFormCategory(cat);
                      setFormColor(CATEGORY_CONFIG[cat].color);
                      triggerHaptic('light');
                    }}
                  >
                    <Text style={styles.categoryChipEmoji}>{CATEGORY_CONFIG[cat].emoji}</Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        formCategory === cat && {
                          color: CATEGORY_CONFIG[cat].color,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {CATEGORY_CONFIG[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time Picker */}
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Time</Text>
              <View style={styles.timePickerRow}>
                <TouchableOpacity
                  style={[styles.timePickerButton, isDark && styles.timePickerButtonDark]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={22} color={themeColors?.primary || '#667eea'} />
                  <Text style={[styles.timePickerText, isDark && styles.textDark]}>
                    {format(formTime, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
                <View style={styles.quickTimesRow}>
                  {[
                    { label: 'Morning', time: '08:00' },
                    { label: 'Noon', time: '12:00' },
                    { label: 'Evening', time: '18:00' },
                    { label: 'Night', time: '21:00' },
                  ].map((qt) => (
                    <TouchableOpacity
                      key={qt.label}
                      style={styles.quickTimeChip}
                      onPress={() => {
                        const [h, m] = qt.time.split(':').map(Number);
                        setFormTime(set(new Date(), { hours: h, minutes: m }));
                        triggerHaptic('light');
                      }}
                    >
                      <Text style={styles.quickTimeChipText}>{qt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {showTimePicker && (
                <DateTimePicker
                  value={formTime}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                  textColor={Platform.OS === 'ios' ? (isDark ? '#fff' : '#000') : undefined}
                />
              )}

              {/* Repeat Options */}
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Repeat</Text>
              <View style={styles.repeatGrid}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.repeatChip,
                      formRepeat === opt && {
                        backgroundColor: themeColors?.primary || '#667eea',
                      },
                    ]}
                    onPress={() => {
                      setFormRepeat(opt);
                      triggerHaptic('light');
                    }}
                  >
                    <Text
                      style={[
                        styles.repeatChipText,
                        formRepeat === opt && styles.repeatChipTextActive,
                      ]}
                    >
                      {REPEAT_LABELS[opt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Days (if custom repeat) */}
              {formRepeat === 'custom' && (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Days of Week</Text>
                  <View style={styles.daysRow}>
                    {WEEKDAYS.map((day) => (
                      <TouchableOpacity
                        key={day.id}
                        style={[
                          styles.dayChip,
                          formDaysOfWeek.includes(day.id) && {
                            backgroundColor: themeColors?.primary || '#667eea',
                          },
                        ]}
                        onPress={() => {
                          setFormDaysOfWeek((prev) =>
                            prev.includes(day.id)
                              ? prev.filter((d) => d !== day.id)
                              : [...prev, day.id].sort()
                          );
                          triggerHaptic('light');
                        }}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            formDaysOfWeek.includes(day.id) && styles.dayChipTextActive,
                          ]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Notes */}
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Notes (optional)</Text>
              <TextInput
                style={[styles.notesInput, isDark && styles.notesInputDark]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Add details..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={showEditModal ? updateReminder : addReminder}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']}
                  style={styles.saveButtonGradient}
                >
                  <Ionicons
                    name={showEditModal ? 'checkmark' : 'add'}
                    size={22}
                    color="#fff"
                  />
                  <Text style={styles.saveButtonText}>
                    {showEditModal ? 'Update Reminder' : 'Create Reminder'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {showEditModal && editingReminder && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setShowEditModal(false);
                    deleteReminder(editingReminder.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteButtonText}>Delete Reminder</Text>
                </TouchableOpacity>
              )}
            </AutoHideScrollView>
          </Animated.View>
        </View>
      )}

      {/* Sweet Alert */}
      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
        isDark={isDark}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 160 : 140,
    paddingBottom: 40,
  },
  textDark: {
    color: '#ffffff',
  },

  /* ---- Loading ---- */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },

  /* ---- Header ---- */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    padding: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  addBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* ---- Search ---- */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    gap: 10,
  },
  searchIcon: {
    marginLeft: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
    paddingVertical: 4,
  },
  searchInputDark: {
    color: '#fff',
  },

  /* ---- Glass Card ---- */
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: {
    flex: 1,
  },

  /* ---- Streak Card ---- */
  streakCard: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  streakGradient: {
    padding: 20,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTextBlock: {
    marginLeft: 14,
    flex: 1,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  streakSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  streakActions: {
    flexDirection: 'row',
    gap: 10,
  },
  streakActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  streakActionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  streakActionText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ---- Next Card ---- */
  nextCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  nextTimeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nextTimeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  nextBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  nextInfo: {
    flex: 1,
  },
  nextTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
  },
  nextMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextMetaText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  nextMetaDot: {
    fontSize: 14,
    color: '#94a3b8',
  },
  nextNotes: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  /* ---- Smart Suggestions ---- */
  smartSection: {
    marginBottom: 20,
  },
  smartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  smartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  smartCount: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  smartScroll: {
    paddingRight: 20,
    gap: 12,
  },
  smartCard: {
    width: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  smartCardGradient: {
    padding: 16,
    height: 180,
    justifyContent: 'space-between',
  },
  smartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  smartCardEmoji: {
    fontSize: 32,
  },
  smartCardUrgent: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smartCardUrgentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  smartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  smartCardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  smartCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smartCardTime: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },

  /* ---- Tab Bar ---- */
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(100,116,139,0.08)',
    padding: 4,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  /* ---- Stats Row ---- */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statPillValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  statPillLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },

  /* ---- Section Header ---- */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
    gap: 12,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(100,116,139,0.15)',
  },

  /* ---- Reminder Item ---- */
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  reminderItemNext: {
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 2,
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  reminderItemDisabled: {
    opacity: 0.6,
  },
  reminderTimeBlock: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reminderTimeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  reminderPeriodText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderEmojiSmall: {
    fontSize: 16,
  },
  reminderTitleBlock: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  reminderTitleDisabled: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  reminderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderCategoryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  reminderDot: {
    fontSize: 12,
    color: '#94a3b8',
  },
  reminderRepeatText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  smartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  achievementBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  reminderNotesText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  nextBadgeRow: {
    marginTop: 8,
  },
  nextBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  nextBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  reminderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  reminderChevron: {
    padding: 4,
  },

  /* ---- Smart Suggestion Card (List View) ---- */
  suggestionCard: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionBlur: {
    padding: 20,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  suggestionEmojiBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionEmoji: {
    fontSize: 28,
  },
  suggestionMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  priorityBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  suggestionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 14,
  },
  suggestionFooter: {
    gap: 8,
    marginBottom: 16,
  },
  suggestionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionTime: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  suggestionBasedOn: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  suggestionApplyBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  suggestionApplyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  suggestionApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionDismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.1)',
  },
  suggestionDismissText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },

  /* ---- Empty State ---- */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyAddBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyAddText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- No Baby ---- */
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noBabyGradient: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 24,
  },
  noBabyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  noBabyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  noBabySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
    textAlign: 'center',
  },
  noBabyButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginTop: 8,
  },
  noBabyButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Modal ---- */
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.88,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  modalScroll: {
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 20,
    fontWeight: '500',
  },
  textInputDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
  },

  /* ---- Category Grid ---- */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.06)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryChipEmoji: {
    fontSize: 18,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },

  /* ---- Time Picker ---- */
  timePickerRow: {
    marginBottom: 20,
    gap: 12,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  timePickerButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timePickerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  quickTimesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTimeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.06)',
  },
  quickTimeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  /* ---- Repeat ---- */
  repeatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  repeatChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
  },
  repeatChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  repeatChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  /* ---- Days of Week ---- */
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.08)',
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  dayChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  /* ---- Notes ---- */
  notesInput: {
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 24,
    minHeight: 80,
    fontWeight: '500',
  },
  notesInputDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
  },

  /* ---- Save Button ---- */
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ---- Delete Button ---- */
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ---- Alert ---- */
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 300,
    maxWidth: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 13,
    color: '#64748b',
  },
});
