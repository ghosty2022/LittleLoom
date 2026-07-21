import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Vibration,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  subDays,
  isValid,
} from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching GrowthDashboard exactly
   ═══════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: {
    xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999,
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

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
type ViewMode = 'today' | 'upcoming' | 'all' | 'smart' | 'analytics';

interface Reminder {
  id: string;
  title: string;
  time: string;
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
  daysOfWeek?: number[];
  endDate?: string;
  completedDates?: string[];
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

interface DailyInsight {
  id: string;
  type: 'pattern' | 'streak' | 'health' | 'milestone' | 'urgent';
  title: string;
  message: string;
  emoji: string;
  color: string;
  actionLabel?: string;
  actionScreen?: string;
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
  REMINDERS: '@littleloom_reminders_v4',
  COMPLETED: '@littleloom_completed_reminders_v3',
  SNOOZED: '@littleloom_snoozed_reminders_v2',
  SMART_DISMISSED: '@littleloom_smart_dismissed_v2',
  ANALYTICS: '@littleloom_reminder_analytics',
};

const CATEGORY_CONFIG: Record<CategoryType, { emoji: string; color: string; label: string; gradient: [string, string]; icon: any }> = {
  potty: { emoji: '🚽', color: '#667eea', label: 'Potty', gradient: ['#667eea', '#764ba2'], icon: 'water-outline' },
  feed: { emoji: '🍼', color: '#fa709a', label: 'Feed', gradient: ['#fa709a', '#f5576c'], icon: 'nutrition-outline' },
  sleep: { emoji: '😴', color: '#11998e', label: 'Sleep', gradient: ['#11998e', '#38ef7d'], icon: 'moon-outline' },
  milestone: { emoji: '🌟', color: '#f59e0b', label: 'Milestone', gradient: ['#f59e0b', '#fbbf24'], icon: 'trophy-outline' },
  medication: { emoji: '💊', color: '#ef4444', label: 'Medication', gradient: ['#ef4444', '#f87171'], icon: 'medical-outline' },
  play: { emoji: '🎮', color: '#ec4899', label: 'Play', gradient: ['#ec4899', '#f472b6'], icon: 'game-controller-outline' },
  growth: { emoji: '📏', color: '#43e97b', label: 'Growth', gradient: ['#43e97b', '#38f9d7'], icon: 'trending-up-outline' },
  diaper: { emoji: '🧷', color: '#fc5c7d', label: 'Diaper', gradient: ['#fc5c7d', '#ff6b6b'], icon: 'shirt-outline' },
  symptom: { emoji: '🤒', color: '#f97316', label: 'Symptom', gradient: ['#f97316', '#fb923c'], icon: 'pulse-outline' },
  custom: { emoji: '⏰', color: '#64748b', label: 'Custom', gradient: ['#94a3b8', '#cbd5e1'], icon: 'timer-outline' },
};

const REPEAT_LABELS: Record<RepeatType, string> = {
  daily: 'Every day',
  weekdays: 'Mon-Fri',
  weekends: 'Sat-Sun',
  weekly: 'Weekly',
  once: 'One time',
  custom: 'Custom',
};

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
      return daysSince < 7;
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
   GLASS CARD — GrowthDashboard Style
   ═══════════════════════════════════════════════════════════════ */

const GlassCard = ({ children, style, onPress, active = false, intensity = 80 }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; intensity?: number }) => {
  const { darkMode: isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, active && { borderColor: '#667eea', borderWidth: 2 }, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(40,40,40,0.9)', 'rgba(20,20,20,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']}
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
   SECTION HEADER — GrowthDashboard Style
   ═══════════════════════════════════════════════════════════════ */

const SectionHeader = ({ title, subtitle, action, actionLabel, themeColors }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; themeColors: any }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: '#1e293b' }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: '#64748b' }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: themeColors?.primary || '#667eea' }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={themeColors?.primary || '#667eea'} />
      </TouchableOpacity>
    )}
  </View>
);

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
   NEW FEATURE 1: DAILY INSIGHTS CAROUSEL
   AI-powered daily summary cards that rotate based on context
   ═══════════════════════════════════════════════════════════════ */

const DailyInsights = memo(({ insights, themeColors, onAction }: { insights: DailyInsight[]; themeColors: any; onAction: (insight: DailyInsight) => void }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % insights.length;
        scrollRef.current?.scrollTo({ x: next * (width - 48), animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [insights.length]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <SectionHeader title="Daily Insights" subtitle={`${insights.length} smart suggestions`} themeColors={themeColors} />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (width - 48));
          setActiveIndex(index);
        }}
        contentContainerStyle={styles.insightsScroll}
      >
        {insights.map((insight, i) => (
          <TouchableOpacity
            key={insight.id}
            onPress={() => onAction(insight)}
            activeOpacity={0.9}
            style={[styles.insightCard, { borderLeftColor: insight.color }]}
          >
            <LinearGradient
              colors={[`${insight.color}08`, `${insight.color}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.insightRow}>
              <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}15` }]}>
                <Text style={styles.insightEmoji}>{insight.emoji}</Text>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle} numberOfLines={1}>{insight.title}</Text>
                <Text style={styles.insightMessage} numberOfLines={2}>{insight.message}</Text>
                {insight.actionLabel && (
                  <View style={[styles.insightActionBadge, { backgroundColor: `${themeColors?.primary || '#667eea'}10` }]}>
                    <Text style={[styles.insightActionText, { color: themeColors?.primary || '#667eea' }]}>{insight.actionLabel} →</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.insightDots}>
        {insights.map((_, i) => (
          <View key={i} style={[styles.insightDot, i === activeIndex && { backgroundColor: themeColors?.primary || '#667eea', width: 16 }]} />
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 2: HORIZONTAL TIMELINE
   Visual timeline showing today's reminders in chronological order
   ═══════════════════════════════════════════════════════════════ */

const TodayTimeline = memo(({ reminders, onReminderPress, themeColors }: { reminders: Reminder[]; onReminderPress: (r: Reminder) => void; themeColors: any }) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const timelineItems = useMemo(() => {
    return [...reminders]
      .filter(r => r.enabled)
      .sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      })
      .map(r => {
        const [h, m] = r.time.split(':').map(Number);
        const reminderMinutes = h * 60 + m;
        const isPast = reminderMinutes < currentMinutes;
        const isNext = !isPast && reminderMinutes <= currentMinutes + 60;
        return { ...r, isPast, isNext, minutes: reminderMinutes };
      });
  }, [reminders, currentMinutes]);

  if (timelineItems.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Today" subtitle={`${timelineItems.filter(r => !r.isPast).length} remaining`} themeColors={themeColors} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
        {timelineItems.map((item, index) => {
          const config = CATEGORY_CONFIG[item.category];
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onReminderPress(item)}
              activeOpacity={0.85}
              style={[styles.timelineNode, item.isNext && styles.timelineNodeNext]}
            >
              <View style={[styles.timelineDot, {
                backgroundColor: item.isPast ? config.color : '#fff',
                borderColor: config.color,
                borderWidth: item.isPast ? 0 : 3,
              }]}>
                {item.isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
              </View>
              {index < timelineItems.length - 1 && (
                <View style={[styles.timelineConnector, item.isPast && { backgroundColor: config.color }]} />
              )}
              <View style={styles.timelineNodeContent}>
                <Text style={[styles.timelineTime, { color: item.isPast ? '#94a3b8' : '#1e293b' }]}>{item.time}</Text>
                <Text style={[styles.timelineLabel, { color: item.isPast ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{item.title}</Text>
                {item.isNext && (
                  <View style={[styles.timelineNextBadge, { backgroundColor: config.color }]}>
                    <Text style={styles.timelineNextText}>NEXT</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 3: COMPLETION STREAK HEATMAP
   Visual calendar-style heatmap showing reminder completion consistency
   ═══════════════════════════════════════════════════════════════ */

const StreakHeatmap = memo(({ analytics, themeColors }: { analytics: any; themeColors: any }) => {
  const heatmapData = useMemo(() => {
    const days: { date: string; count: number; intensity: number }[] = [];
    for (let i = 27; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = analytics?.dailyCompletions?.[dateStr] || 0;
      days.push({
        date: dateStr,
        count,
        intensity: Math.min(count / 5, 1),
      });
    }
    return days;
  }, [analytics]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].count > 0) streak++;
      else break;
    }
    return streak;
  }, [heatmapData]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.heatmapHeader}>
          <View style={styles.heatmapHeaderLeft}>
            <View style={[styles.heatmapIconBg, { backgroundColor: `${themeColors?.primary || '#667eea'}15` }]}>
              <Ionicons name="flame" size={20} color={themeColors?.primary || '#667eea'} />
            </View>
            <View>
              <Text style={styles.heatmapTitle}>Consistency</Text>
              <Text style={styles.heatmapSubtitle}>{currentStreak} day streak</Text>
            </View>
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={styles.heatmapLegendText}>Less</Text>
            {[0.2, 0.4, 0.6, 0.8, 1].map((level, i) => (
              <View key={i} style={[styles.heatmapLegendDot, { backgroundColor: `${themeColors?.primary || '#667eea'}${Math.round(level * 255).toString(16).padStart(2, '0')}` }]} />
            ))}
            <Text style={styles.heatmapLegendText}>More</Text>
          </View>
        </View>
        <View style={styles.heatmapGrid}>
          {heatmapData.map((day, i) => (
            <View
              key={i}
              style={[styles.heatmapCell, {
                backgroundColor: day.count > 0 ? `${themeColors?.primary || '#667eea'}${Math.round(day.intensity * 255).toString(16).padStart(2, '0')}` : '#f1f5f9',
              }]}
            />
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 4: CATEGORY PILL GRID
   Compact category filter pills with progress indicators
   ═══════════════════════════════════════════════════════════════ */

const CategoryPillGrid = memo(({ reminders, activeCategory, onCategoryChange, themeColors }: { reminders: Reminder[]; activeCategory: string; onCategoryChange: (cat: string) => void; themeColors: any }) => {
  const categories = useMemo(() => [
    { key: 'all', label: 'All', icon: 'grid-outline', color: themeColors?.primary || '#667eea' },
    ...Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({ key, label: config.label, icon: config.icon, color: config.color })),
  ], [themeColors]);

  const stats = useMemo(() => {
    const s: Record<string, { total: number; active: number }> = { all: { total: reminders.length, active: reminders.filter(r => r.enabled).length } };
    Object.keys(CATEGORY_CONFIG).forEach(cat => {
      const catReminders = reminders.filter(r => r.category === cat);
      s[cat] = { total: catReminders.length, active: catReminders.filter(r => r.enabled).length };
    });
    return s;
  }, [reminders]);

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          const stat = stats[cat.key] || { total: 0, active: 0 };
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => onCategoryChange(cat.key)}
              style={[styles.categoryPill, isActive && { backgroundColor: `${cat.color}20`, borderColor: cat.color }]}
            >
              <Ionicons name={cat.icon as any} size={16} color={isActive ? cat.color : '#94a3b8'} />
              <Text style={[styles.categoryPillLabel, isActive && { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
              {stat.total > 0 && (
                <View style={[styles.categoryPillBadge, { backgroundColor: isActive ? cat.color : '#e2e8f0' }]}>
                  <Text style={[styles.categoryPillBadgeText, { color: isActive ? '#fff' : '#64748b' }]}>{stat.active}/{stat.total}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 5: SMART SUGGESTION CARDS (Redesigned)
   Compact, actionable AI suggestion cards
   ═══════════════════════════════════════════════════════════════ */

const SmartSuggestionCard = memo(({ suggestion, onApply, onDismiss, index, themeColors }: { suggestion: SmartSuggestion; onApply: (s: SmartSuggestion) => void; onDismiss: (id: string) => void; index: number; themeColors: any }) => {
  const config = CATEGORY_CONFIG[suggestion.type];

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <GlassCard style={styles.smartCard}>
        <View style={styles.smartCardHeader}>
          <View style={styles.smartCardLeft}>
            <View style={[styles.smartCardIconBg, { backgroundColor: `${config.color}15` }]}>
              <Text style={styles.smartCardEmoji}>{suggestion.emoji}</Text>
            </View>
            <View>
              <Text style={styles.smartCardTitle} numberOfLines={1}>{suggestion.title}</Text>
              <View style={styles.smartCardMeta}>
                <View style={[styles.confidenceBadge, { backgroundColor: suggestion.confidence > 85 ? '#22c55e' : suggestion.confidence > 70 ? '#f59e0b' : '#3b82f6' }]}>
                  <Text style={styles.confidenceText}>{suggestion.confidence}%</Text>
                </View>
                {suggestion.priority === 'high' && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>URGENT</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => onDismiss(suggestion.id)} style={styles.dismissBtn}>
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.smartCardDesc} numberOfLines={2}>{suggestion.description}</Text>

        <View style={styles.smartCardFooter}>
          <View style={styles.smartCardTimeRow}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.smartCardTime}>Best at {suggestion.optimalTime}</Text>
          </View>
          <Text style={styles.smartCardBasedOn}>Based on: {suggestion.basedOn}</Text>
        </View>

        <View style={styles.smartCardActions}>
          <TouchableOpacity style={styles.smartCardApplyBtn} onPress={() => onApply(suggestion)}>
            <LinearGradient colors={config.gradient} style={styles.smartCardApplyGradient}>
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.smartCardApplyText}>Add Reminder</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 6: REMINDER ANALYTICS DASHBOARD
   Visual stats showing reminder effectiveness and patterns
   ═══════════════════════════════════════════════════════════════ */

const ReminderAnalytics = memo(({ reminders, analytics, themeColors }: { reminders: Reminder[]; analytics: any; themeColors: any }) => {
  const stats = useMemo(() => {
    const total = reminders.length;
    const active = reminders.filter(r => r.enabled).length;
    const completed = analytics?.totalCompletions || 0;
    const completionRate = total > 0 ? Math.round((completed / (total * 30)) * 100) : 0;
    const avgResponseTime = analytics?.avgResponseTime || 0;

    const byCategory: Record<string, number> = {};
    reminders.forEach(r => {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    });

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return { total, active, completed, completionRate, avgResponseTime, topCategory };
  }, [reminders, analytics]);

  return (
    <View style={styles.analyticsSection}>
      <SectionHeader title="Analytics" subtitle="Your reminder performance" themeColors={themeColors} />

      <View style={styles.analyticsGrid}>
        <GlassCard style={styles.analyticsCard}>
          <View style={[styles.analyticsIconBg, { backgroundColor: `${themeColors?.primary || '#667eea'}15` }]}>
            <Ionicons name="checkmark-done" size={20} color={themeColors?.primary || '#667eea'} />
          </View>
          <Text style={styles.analyticsValue}>{stats.completionRate}%</Text>
          <Text style={styles.analyticsLabel}>Completion Rate</Text>
        </GlassCard>

        <GlassCard style={styles.analyticsCard}>
          <View style={[styles.analyticsIconBg, { backgroundColor: '#10b98115' }]}>
            <Ionicons name="time" size={20} color="#10b981" />
          </View>
          <Text style={styles.analyticsValue}>{stats.avgResponseTime}m</Text>
          <Text style={styles.analyticsLabel}>Avg Response</Text>
        </GlassCard>

        <GlassCard style={styles.analyticsCard}>
          <View style={[styles.analyticsIconBg, { backgroundColor: '#f59e0b15' }]}>
            <Ionicons name="trending-up" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.analyticsValue}>{stats.active}</Text>
          <Text style={styles.analyticsLabel}>Active Now</Text>
        </GlassCard>

        <GlassCard style={styles.analyticsCard}>
          <View style={[styles.analyticsIconBg, { backgroundColor: '#8b5cf615' }]}>
            <Ionicons name="trophy" size={20} color="#8b5cf6" />
          </View>
          <Text style={styles.analyticsValue}>{stats.topCategory ? CATEGORY_CONFIG[stats.topCategory[0] as CategoryType]?.label : 'None'}</Text>
          <Text style={styles.analyticsLabel}>Top Category</Text>
        </GlassCard>
      </View>

      {/* Weekly completion chart */}
      <GlassCard>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Weekly Activity</Text>
          <Text style={styles.chartSubtitle}>Reminders completed per day</Text>
        </View>
        <View style={styles.chartBars}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
            const count = analytics?.weekly?.[day] || 0;
            const maxCount = Math.max(...Object.values(analytics?.weekly || {}), 1);
            const height = (count / maxCount) * 80;
            return (
              <View key={day} style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { height: Math.max(height, 4), backgroundColor: themeColors?.primary || '#667eea' }]} />
                <Text style={styles.chartBarLabel}>{day}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
});


/* ═══════════════════════════════════════════════════════════════
   REMINDER LIST ITEM (Redesigned — compact, information-dense)
   ═══════════════════════════════════════════════════════════════ */

const ReminderListItem = memo(({ item, index, isNext, onToggle, onPress, onLongPress, isDark, themeColors }: {
  item: Reminder;
  index: number;
  isNext: boolean;
  onToggle: (id: string) => void;
  onPress: (item: Reminder) => void;
  onLongPress: (id: string) => void;
  isDark: boolean;
  themeColors: any;
}) => {
  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.custom;
  const [h, m] = item.time.split(':').map(Number);
  const timeDate = set(new Date(), { hours: h, minutes: m });
  const isPast = !item.enabled || timeDate < new Date();

  return (
    <Animated.View entering={FadeInUp.delay(index * 30).springify()} layout={Layout.springify()}>
      <TouchableOpacity
        onPress={() => onPress(item)}
        onLongPress={() => { Vibration.vibrate(50); onLongPress(item.id); }}
        activeOpacity={0.85}
        style={[
          styles.reminderItem,
          isNext && styles.reminderItemNext,
          !item.enabled && styles.reminderItemDisabled,
        ]}
      >
        {/* Left: Time block */}
        <View style={[styles.reminderTimeBlock, { backgroundColor: `${config.color}12` }]}>
          <Text style={[styles.reminderTimeText, { color: config.color }]}>{item.time}</Text>
          <Text style={styles.reminderPeriodText}>{h < 12 ? 'AM' : 'PM'}</Text>
        </View>

        {/* Center: Content */}
        <View style={styles.reminderContent}>
          <View style={styles.reminderTopRow}>
            <Text style={[styles.reminderTitle, isDark && styles.textDark, !item.enabled && styles.reminderTitleDisabled]} numberOfLines={1}>
              {item.emoji} {item.title}
            </Text>
          </View>
          <View style={styles.reminderMetaRow}>
            <View style={[styles.categoryTag, { backgroundColor: `${config.color}15` }]}>
              <Text style={[styles.categoryTagText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{REPEAT_LABELS[item.repeat]}</Text>
            {item.smartSuggestion && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={10} color="#f59e0b" />
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              </>
            )}
          </View>
          {item.notes && (
            <Text style={styles.reminderNotes} numberOfLines={1}>{item.notes}</Text>
          )}
        </View>

        {/* Right: Actions */}
        <View style={styles.reminderRight}>
          <Switch
            value={item.enabled}
            onValueChange={() => onToggle(item.id)}
            trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: `${config.color}40` }}
            thumbColor={item.enabled ? config.color : isDark ? '#64748b' : '#fff'}
            ios_backgroundColor={isDark ? '#334155' : '#e2e8f0'}
          />
          {isNext && item.enabled && (
            <View style={[styles.nextIndicator, { backgroundColor: config.color }]}>
              <Text style={styles.nextIndicatorText}>NEXT</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QUICK ADD FAB
   ═══════════════════════════════════════════════════════════════ */

const QuickAddFAB = memo(({ onPress, themeColors }: { onPress: () => void; themeColors: any }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.fab}>
    <LinearGradient colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']} style={styles.fabGradient}>
      <Ionicons name="add" size={28} color="#fff" />
    </LinearGradient>
  </TouchableOpacity>
));

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN — COMPLETE REDESIGN
   ═══════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

export default function RemindersScreen({ navigation, route }: Props) {
  const { darkMode: isDark, themeColors, triggerHaptic, reduceMotion } = useCustomization();
  const sweetAlert = useSweetAlert();
  const { currentBaby, babies, loadBabies } = useBaby();
  const { entries: activities } = useActivity();

  /* ---- State ---- */
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [streakData, setStreakData] = useState({ current: 0, atRisk: false, hoursLeft: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [analytics, setAnalytics] = useState<any>({});
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('custom');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('daily');
  const [formTime, setFormTime] = useState(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formColor, setFormColor] = useState(CATEGORY_CONFIG.custom.color);

  const scrollY = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);

  /* ---- Scroll handler ---- */
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  /* ---- Derived ---- */
  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find((b) => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  /* ---- Focus effect ---- */
  useFocusEffect(
    useCallback(() => {
      loadData();
      checkStreakStatus();
      generateSmartSuggestions();
      generateDailyInsights();
    }, [baby?.id])
  );

  /* ---- Initial load ---- */
  useEffect(() => {
    loadData();
    loadAnalytics();
    requestNotificationPermissions();
    loadDismissedSuggestions();

    if (route.params?.suggestedType || route.params?.fromAchievement) {
      handleAchievementSuggestion();
    }
  }, [baby?.id]);

  /* ---- Notification listener ---- */
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

  const loadAnalytics = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ANALYTICS);
      if (saved) setAnalytics(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load analytics:', e);
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
      sweetAlert.error(
        'Notifications Required',
        'Please enable notifications in Settings to receive reminder alerts.'
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
        id: 'default_1', title: 'Morning Potty', time: '08:00', emoji: '🚽', enabled: true,
        repeat: 'daily', category: 'potty', babyId, babyName,
        createdAt: new Date().toISOString(), color: CATEGORY_CONFIG.potty.color,
      },
      {
        id: 'default_2', title: 'First Feed', time: '07:00', emoji: '🍼', enabled: true,
        repeat: 'daily', category: 'feed', babyId, babyName,
        createdAt: new Date().toISOString(), color: CATEGORY_CONFIG.feed.color,
      },
      {
        id: 'default_3', title: 'Bedtime Routine', time: '19:30', emoji: '🌙', enabled: true,
        repeat: 'daily', category: 'sleep', babyId, babyName,
        createdAt: new Date().toISOString(), color: CATEGORY_CONFIG.sleep.color,
      },
      {
        id: 'default_4', title: 'Vitamin D', time: '08:30', emoji: '💊', enabled: true,
        repeat: 'daily', category: 'medication', babyId, babyName,
        createdAt: new Date().toISOString(), color: CATEGORY_CONFIG.medication.color,
      },
    ];
  };

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
      const allReminders: Reminder[] = saved ? JSON.parse(saved) : [];
      const otherReminders = allReminders.filter((r) => r.babyId && r.babyId !== baby?.id);
      const merged = [...otherReminders, ...newReminders];
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(merged));
    } catch (error) {
      console.warn('Failed to save reminders:', error);
      showToast('error', 'Save Failed', 'Could not save reminders');
    }
  };

  /* ---- Smart suggestions ---- */
  const generateSmartSuggestions = useCallback(() => {
    if (!baby) { setSmartSuggestions([]); return; }
    const engine = new IntelligentReminderEngine(activities, baby, [], reminders);
    const suggestions = engine.analyzePatterns();
    setSmartSuggestions(suggestions.filter((s) => !dismissedSuggestions.has(s.id)));
  }, [activities, baby, reminders, dismissedSuggestions]);

  /* ---- Daily insights generation ---- */
  const generateDailyInsights = useCallback(() => {
    if (!baby) { setDailyInsights([]); return; }
    const insights: DailyInsight[] = [];
    const now = new Date();

    // Streak insight
    const babyActs = activities.filter((a) => a.babyId === baby.id);
    let streak = 0;
    let currentDate = new Date();
    while (true) {
      const hasActivity = babyActs.some((a) => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) { streak++; currentDate = addDays(currentDate, -1); }
      else break;
    }
    if (streak >= 3) {
      insights.push({
        id: 'streak-insight', type: 'streak', title: `${streak}-Day Streak!`,
        message: "You're on fire! Keep logging to maintain your streak.",
        emoji: '🔥', color: '#f59e0b', actionLabel: 'Quick Log', actionScreen: 'Timeline',
      });
    }

    // Overdue reminders insight
    const overdueCount = reminders.filter(r => {
      const [h, m] = r.time.split(':').map(Number);
      const reminderMinutes = h * 60 + m;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return r.enabled && reminderMinutes < currentMinutes && !r.lastTriggered;
    }).length;
    if (overdueCount > 0) {
      insights.push({
        id: 'overdue-insight', type: 'urgent', title: `${overdueCount} Reminders Overdue`,
        message: 'Some reminders have passed their scheduled time today.',
        emoji: '⚠️', color: '#ef4444', actionLabel: 'View All', actionScreen: 'Reminders',
      });
    }

    // Upcoming insight
    const upcomingCount = reminders.filter(r => {
      const [h, m] = r.time.split(':').map(Number);
      const reminderMinutes = h * 60 + m;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return r.enabled && reminderMinutes > currentMinutes && reminderMinutes <= currentMinutes + 120;
    }).length;
    if (upcomingCount > 0) {
      insights.push({
        id: 'upcoming-insight', type: 'pattern', title: `${upcomingCount} Coming Up`,
        message: 'You have reminders scheduled in the next 2 hours.',
        emoji: '⏰', color: '#3b82f6', actionLabel: 'Prepare', actionScreen: 'Reminders',
      });
    }

    setDailyInsights(insights);
  }, [activities, baby, reminders]);

  /* ---- Streak status ---- */
  const checkStreakStatus = useCallback(() => {
    if (!baby) return;
    const babyActs = activities.filter((a) => a.babyId === baby.id);
    let streak = 0;
    let currentDate = new Date();
    while (true) {
      const hasActivity = babyActs.some((a) => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) { streak++; currentDate = addDays(currentDate, -1); }
      else break;
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
      case 'potty': title = 'Potty Training Goal'; emoji = '🚽'; category = 'potty'; break;
      case 'feed': title = 'Feeding Goal'; emoji = '🍼'; category = 'feed'; break;
      case 'sleep': title = 'Sleep Routine Goal'; emoji = '😴'; category = 'sleep'; break;
      case 'milestone': title = 'Record Milestone'; emoji = '🌟'; category = 'milestone'; break;
      case 'streak': title = 'Protect Your Streak'; emoji = '🔥'; category = 'custom'; break;
    }

    openAddModal({ title, category, emoji, isAchievementRelated: true, achievementId: fromAchievement });
  };

  /* ---- Notification scheduling ---- */
  const scheduleNotification = async (reminder: Reminder): Promise<string | undefined> => {
    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const now = new Date();

      let trigger: Notifications.NotificationTriggerInput;

      switch (reminder.repeat) {
        case 'daily':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours, minute: minutes };
          break;
        case 'weekdays':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: hours, minute: minutes };
          break;
        case 'weekends':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 7, hour: hours, minute: minutes };
          break;
        case 'weekly':
          trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (now.getDay() + 1) || 7, hour: hours, minute: minutes };
          break;
        case 'custom':
          if (reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
            const today = now.getDay();
            const nextDay = reminder.daysOfWeek.find((d) => d > today) || reminder.daysOfWeek[0];
            const daysUntil = nextDay > today ? nextDay - today : 7 - today + nextDay;
            const targetDate = addDays(now, daysUntil);
            targetDate.setHours(hours, minutes, 0, 0);
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: targetDate };
          } else {
            trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours, minute: minutes };
          }
          break;
        default:
          const scheduledDate = new Date();
          scheduledDate.setHours(hours, minutes, 0, 0);
          if (scheduledDate < now) scheduledDate.setDate(scheduledDate.getDate() + 1);
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: scheduledDate };
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${reminder.emoji} ${reminder.title}`,
          body: reminder.notes || `Time for ${reminder.title.toLowerCase()}!`,
          sound: true,
          badge: 1,
          data: { screen: 'Reminders', reminderId: reminder.id, category: reminder.category, babyId: reminder.babyId, type: reminder.category },
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
    if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
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
    sweetAlert.confirm(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      async () => {
        await cancelNotification(reminder.notificationId);
        const updated = reminders.filter((r) => r.id !== id);
        setReminders(updated);
        await saveReminders(updated);
        showToast('success', 'Deleted', `${reminder.title} removed`);
      },
      () => {},
      'Delete',
      'Cancel',
      true
    );
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

  /* ---- Filtering ---- */
  const filteredReminders = useMemo(() => {
    let list = [...reminders];

    if (activeCategory !== 'all') {
      list = list.filter(r => r.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }

    if (viewMode === 'today') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      list = list.filter(r => r.enabled).sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
    } else if (viewMode === 'upcoming') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      list = list.filter(r => r.enabled).sort((a, b) => {
        const aMin = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
        const bMin = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]);
        const aDiff = aMin >= currentMinutes ? aMin - currentMinutes : aMin + 1440 - currentMinutes;
        const bDiff = bMin >= currentMinutes ? bMin - currentMinutes : bMin + 1440 - currentMinutes;
        return aDiff - bDiff;
      });
    }

    return list;
  }, [reminders, activeCategory, searchQuery, viewMode]);

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
    if (selectedDate) setFormTime(selectedDate);
  };

  /* ---- View mode tabs ---- */
  const viewTabs = [
    { key: 'today' as ViewMode, label: 'Today', icon: 'sunny-outline' },
    { key: 'upcoming' as ViewMode, label: 'Upcoming', icon: 'time-outline' },
    { key: 'all' as ViewMode, label: 'All', icon: 'list-outline' },
    { key: 'smart' as ViewMode, label: 'Smart', icon: 'sparkles-outline', badge: smartSuggestions.length },
    { key: 'analytics' as ViewMode, label: 'Stats', icon: 'bar-chart-outline' },
  ];

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e2e8f0']} style={StyleSheet.absoluteFill} />
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
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <GlassCard intensity={90}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.noBabyGradient}>
              <Text style={styles.noBabyEmoji}>⏰</Text>
              <Text style={styles.noBabyTitle}>No Baby Selected</Text>
              <Text style={styles.noBabySubtitle}>Select a baby profile to manage reminders</Text>
              <TouchableOpacity style={styles.noBabyButton} onPress={() => navigation.navigate('SwitchBaby')}>
                <Text style={[styles.noBabyButtonText, { color: '#667eea' }]}>Select Baby</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8faff', '#e2e8f0', '#f1f5f9']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, headerAnimatedStyle]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Text style={[styles.stickyTitle, isDark && styles.textDark]}>{baby.name}'s Reminders</Text>
        <Text style={styles.stickySubtitle}>{reminders.filter(r => r.enabled).length} active • {smartSuggestions.length} smart suggestions</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, isDark && styles.textDark]}>Reminders</Text>
            <Text style={styles.headerSubtitle}>for {baby.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSearch(!showSearch)}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>
          </View>
        </Animated.View>

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

        {/* Daily Insights Carousel */}
        <DailyInsights insights={dailyInsights} themeColors={themeColors} onAction={(insight) => {
          triggerHaptic('light');
          if (insight.actionScreen) navigation.navigate(insight.actionScreen as any);
        }} />

        {/* Today's Timeline */}
        {viewMode === 'today' && (
          <TodayTimeline reminders={reminders} onReminderPress={openEditModal} themeColors={themeColors} />
        )}

        {/* Streak Heatmap */}
        <StreakHeatmap analytics={analytics} themeColors={themeColors} />

        {/* View Mode Tabs */}
        <View style={styles.viewTabBar}>
          {viewTabs.map((tab) => {
            const isActive = viewMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setViewMode(tab.key);
                  triggerHaptic('light');
                }}
                style={[styles.viewTab, isActive && { backgroundColor: '#fff', /* no shadow */ }]}
              >
                <Ionicons name={tab.icon as any} size={16} color={isActive ? themeColors?.primary || '#667eea' : '#94a3b8'} />
                <Text style={[styles.viewTabLabel, { color: isActive ? themeColors?.primary || '#667eea' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>
                  {tab.label}
                </Text>
                {tab.badge && tab.badge > 0 && !isActive && (
                  <View style={[styles.viewTabBadge, { backgroundColor: themeColors?.primary || '#667eea' }]}>
                    <Text style={styles.viewTabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category Filter Pills */}
        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && (
          <CategoryPillGrid
            reminders={reminders}
            activeCategory={activeCategory}
            onCategoryChange={(cat) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveCategory(cat);
              triggerHaptic('light');
            }}
            themeColors={themeColors}
          />
        )}

        {/* Content based on view mode */}
        {viewMode === 'smart' && (
          <View style={styles.section}>
            <SectionHeader
              title="Smart Suggestions"
              subtitle={`${smartSuggestions.length} AI-powered recommendations`}
              themeColors={themeColors}
            />
            {smartSuggestions.map((suggestion, i) => (
              <SmartSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApply={applySmartSuggestion}
                onDismiss={dismissSuggestion}
                index={i}
                themeColors={themeColors}
              />
            ))}
            {smartSuggestions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={56} color="#cbd5e1" />
                <Text style={[styles.emptyTitle, isDark && styles.textDark]}>No smart suggestions</Text>
                <Text style={styles.emptyText}>Keep tracking activities and AI will suggest optimal reminders</Text>
              </View>
            )}
          </View>
        )}

        {viewMode === 'analytics' && (
          <ReminderAnalytics reminders={reminders} analytics={analytics} themeColors={themeColors} />
        )}

        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && (
          <View style={styles.section}>
            <SectionHeader
              title={viewMode === 'today' ? "Today's Schedule" : viewMode === 'upcoming' ? 'Upcoming' : 'All Reminders'}
              subtitle={`${filteredReminders.length} reminder${filteredReminders.length !== 1 ? 's' : ''}`}
              themeColors={themeColors}
            />
            {filteredReminders.map((item, index) => (
              <ReminderListItem
                key={item.id}
                item={item}
                index={index}
                isNext={nextReminder?.id === item.id}
                onToggle={toggleReminder}
                onPress={openEditModal}
                onLongPress={deleteReminder}
                isDark={isDark}
                themeColors={themeColors}
              />
            ))}
            {filteredReminders.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={56} color="#cbd5e1" />
                <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
                  {searchQuery ? 'No matches found' : 'No reminders yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Try a different search term' : 'Tap + to add your first reminder'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Streak Warning */}
        {streakData.atRisk && (
          <Animated.View entering={FadeInDown.springify()}>
            <GlassCard style={styles.streakCard} intensity={90}>
              <LinearGradient colors={['#ef4444', '#f87171']} style={styles.streakGradient}>
                <View style={styles.streakRow}>
                  <View style={styles.streakIconCircle}>
                    <Ionicons name="flame" size={28} color="#ef4444" />
                  </View>
                  <View style={styles.streakTextBlock}>
                    <Text style={styles.streakTitle}>🔥 Streak at Risk!</Text>
                    <Text style={styles.streakSubtitle}>{streakData.hoursLeft} hours left to save your {streakData.current}-day streak</Text>
                  </View>
                </View>
                <View style={styles.streakActions}>
                  <TouchableOpacity style={styles.streakActionBtn} onPress={() => quickLog('potty')}>
                    <Text style={styles.streakActionText}>Quick Log</Text>
                    <Ionicons name="add-circle" size={16} color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.streakActionBtn, styles.streakActionBtnSecondary]} onPress={() => openAddModal({ title: 'Protect Streak', category: 'custom' })}>
                    <Text style={[styles.streakActionText, { color: '#fff' }]}>Set Reminder</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </GlassCard>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Quick Add FAB */}
      <QuickAddFAB onPress={() => openAddModal()} themeColors={themeColors} />

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="auto">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
            activeOpacity={1}
          >
            <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>

          <Animated.View entering={FadeInUp.springify()} style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>
                {showEditModal ? 'Edit Reminder' : 'New Reminder'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>What to remind?</Text>
              <TextInput
                style={[styles.textInput, isDark && styles.textInputDark]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g., Give Vitamin D"
                placeholderTextColor="#94a3b8"
                maxLength={50}
              />

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Category</Text>
              <View style={styles.categoryGrid}>
                {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, formCategory === cat && { backgroundColor: `${CATEGORY_CONFIG[cat].color}20`, borderColor: CATEGORY_CONFIG[cat].color, borderWidth: 2 }]}
                    onPress={() => { setFormCategory(cat); setFormColor(CATEGORY_CONFIG[cat].color); triggerHaptic('light'); }}
                  >
                    <Text style={styles.categoryChipEmoji}>{CATEGORY_CONFIG[cat].emoji}</Text>
                    <Text style={[styles.categoryChipText, formCategory === cat && { color: CATEGORY_CONFIG[cat].color, fontWeight: '700' }]}>
                      {CATEGORY_CONFIG[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Time</Text>
              <View style={styles.timePickerRow}>
                <TouchableOpacity style={[styles.timePickerButton, isDark && styles.timePickerButtonDark]} onPress={() => setShowTimePicker(true)}>
                  <Ionicons name="time-outline" size={22} color={themeColors?.primary || '#667eea'} />
                  <Text style={[styles.timePickerText, isDark && styles.textDark]}>{format(formTime, 'h:mm a')}</Text>
                </TouchableOpacity>
                <View style={styles.quickTimesRow}>
                  {[
                    { label: 'Morning', time: '08:00' },
                    { label: 'Noon', time: '12:00' },
                    { label: 'Evening', time: '18:00' },
                    { label: 'Night', time: '21:00' },
                  ].map((qt) => (
                    <TouchableOpacity key={qt.label} style={styles.quickTimeChip} onPress={() => {
                      const [h, m] = qt.time.split(':').map(Number);
                      setFormTime(set(new Date(), { hours: h, minutes: m }));
                      triggerHaptic('light');
                    }}>
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

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Repeat</Text>
              <View style={styles.repeatGrid}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.repeatChip, formRepeat === opt && { backgroundColor: themeColors?.primary || '#667eea' }]}
                    onPress={() => { setFormRepeat(opt); triggerHaptic('light'); }}
                  >
                    <Text style={[styles.repeatChipText, formRepeat === opt && styles.repeatChipTextActive]}>
                      {REPEAT_LABELS[opt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formRepeat === 'custom' && (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Days of Week</Text>
                  <View style={styles.daysRow}>
                    {WEEKDAYS.map((day) => (
                      <TouchableOpacity
                        key={day.id}
                        style={[styles.dayChip, formDaysOfWeek.includes(day.id) && { backgroundColor: themeColors?.primary || '#667eea' }]}
                        onPress={() => {
                          setFormDaysOfWeek((prev) =>
                            prev.includes(day.id) ? prev.filter((d) => d !== day.id) : [...prev, day.id].sort()
                          );
                          triggerHaptic('light');
                        }}
                      >
                        <Text style={[styles.dayChipText, formDaysOfWeek.includes(day.id) && styles.dayChipTextActive]}>{day.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

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

              <TouchableOpacity style={styles.saveButton} onPress={showEditModal ? updateReminder : addReminder} activeOpacity={0.9}>
                <LinearGradient colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']} style={styles.saveButtonGradient}>
                  <Ionicons name={showEditModal ? 'checkmark' : 'add'} size={22} color="#fff" />
                  <Text style={styles.saveButtonText}>{showEditModal ? 'Update Reminder' : 'Create Reminder'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {showEditModal && editingReminder && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => { setShowEditModal(false); deleteReminder(editingReminder.id); }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteButtonText}>Delete Reminder</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Sweet Alert */}
      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned (Matching GrowthDashboard)
   ═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  textDark: { color: '#ffffff' },
  scrollContent: { paddingBottom: 24 },

  /* ---- Loading ---- */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 15, fontWeight: '600', color: '#64748b' },

  /* ---- Glass Card ---- */
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    /* no shadow */
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  glassContent: { flex: 1 },

  /* ---- Section Header ---- */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginHorizontal: 20, marginBottom: 12, marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  /* ---- Sticky Header ---- */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, paddingTop: 50,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },

  /* ---- Top Header ---- */
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16, marginTop: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },

  /* ---- Search ---- */
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.1)',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 16, gap: 10,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '500', paddingVertical: 4 },
  searchInputDark: { color: '#fff' },

  /* ---- Insights Carousel ---- */
  insightsScroll: { paddingHorizontal: 16, gap: 0 },
  insightCard: {
    width: width - 48, padding: 18, borderRadius: 20, marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.85)', /* no shadow */
    borderLeftWidth: 4,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  insightIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 28 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  insightMessage: { fontSize: 13, color: '#64748b', lineHeight: 18, fontWeight: '500' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 6 },
  insightActionText: { fontSize: 12, fontWeight: '700' },
  insightDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' },

  /* ---- Timeline ---- */
  timelineScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 0 },
  timelineNode: { alignItems: 'center', width: 80, marginRight: 4 },
  timelineNodeNext: { transform: [{ scale: 1.05 }] },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', zIndex: 2, backgroundColor: '#fff',
  },
  timelineConnector: { width: 52, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: -2 },
  timelineNodeContent: { alignItems: 'center', gap: 2, marginTop: 8 },
  timelineTime: { fontSize: 13, fontWeight: '800' },
  timelineLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center', maxWidth: 70 },
  timelineNextBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  timelineNextText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- Heatmap ---- */
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  heatmapHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heatmapIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  heatmapTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  heatmapSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heatmapLegendText: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  heatmapLegendDot: { width: 10, height: 10, borderRadius: 2 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 16, paddingBottom: 16, justifyContent: 'center' },
  heatmapCell: { width: 28, height: 28, borderRadius: 6 },

  /* ---- View Tabs ---- */
  viewTabBar: {
    flexDirection: 'row', gap: 6, marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(100,116,139,0.06)', padding: 4, borderRadius: 16,
  },
  viewTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, position: 'relative',
  },
  viewTabLabel: { fontSize: 11, fontWeight: '600' },
  viewTabBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewTabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- Category Pills ---- */
  pillScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'transparent',
    /* no shadow */
  },
  categoryPillLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  categoryPillBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  categoryPillBadgeText: { fontSize: 10, fontWeight: '700' },

  /* ---- Reminder List Item ---- */
  reminderItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16,
    padding: 14, marginBottom: 10, marginHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    /* no shadow */
  },
  reminderItemNext: { borderColor: 'rgba(102,126,234,0.3)', borderWidth: 2 },
  reminderItemDisabled: { opacity: 0.55 },
  reminderTimeBlock: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  reminderTimeText: { fontSize: 15, fontWeight: '800' },
  reminderPeriodText: { fontSize: 10, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  reminderContent: { flex: 1 },
  reminderTopRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  reminderTitleDisabled: { color: '#94a3b8', textDecorationLine: 'line-through' },
  reminderMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryTagText: { fontSize: 10, fontWeight: '700' },
  metaDot: { fontSize: 12, color: '#94a3b8' },
  metaText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  aiBadgeText: { fontSize: 10, fontWeight: '700', color: '#f59e0b' },
  reminderNotes: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' },
  reminderRight: { alignItems: 'center', gap: 6, marginLeft: 8 },
  nextIndicator: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nextIndicatorText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- Smart Suggestion Card ---- */
  smartCard: { padding: 16, marginBottom: 10, marginHorizontal: 16 },
  smartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  smartCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smartCardIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  smartCardEmoji: { fontSize: 24 },
  smartCardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  smartCardMeta: { flexDirection: 'row', gap: 8 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidenceText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  urgentBadge: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  dismissBtn: { padding: 4 },
  smartCardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 10, fontWeight: '500' },
  smartCardFooter: { gap: 4, marginBottom: 12 },
  smartCardTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartCardTime: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  smartCardBasedOn: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },
  smartCardActions: { flexDirection: 'row' },
  smartCardApplyBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  smartCardApplyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  smartCardApplyText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ---- Analytics ---- */
  analyticsSection: { marginBottom: 20 },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  analyticsCard: { width: (width - 56) / 2, padding: 16, alignItems: 'center' },
  analyticsIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  analyticsValue: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  analyticsLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  chartHeader: { padding: 16, paddingBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  chartSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 16, height: 120 },
  chartBarContainer: { alignItems: 'center', gap: 6 },
  chartBar: { width: 24, borderRadius: 6, minHeight: 4 },
  chartBarLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },

  /* ---- FAB ---- */
  fab: {
    position: 'absolute', bottom: 32, right: 24, zIndex: 50,
    shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  fabGradient: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  /* ---- Section ---- */
  section: { marginBottom: 20 },

  /* ---- Empty State ---- */
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22, paddingHorizontal: 40 },

  /* ---- Streak Card ---- */
  streakCard: { borderRadius: 24, marginBottom: 20, marginHorizontal: 16, overflow: 'hidden' },
  streakGradient: { padding: 20 },
  streakRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  streakIconCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  streakTextBlock: { marginLeft: 14, flex: 1 },
  streakTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  streakSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  streakActions: { flexDirection: 'row', gap: 10 },
  streakActionBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  streakActionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.2)' },
  streakActionText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  /* ---- No Baby ---- */
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyEmoji: { fontSize: 56, marginBottom: 16 },
  noBabyTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, textAlign: 'center' },
  noBabyButton: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, marginTop: 8 },
  noBabyButtonText: { fontSize: 15, fontWeight: '700' },

  /* ---- Modal ---- */
  modal: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: height * 0.88, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  modalScroll: { paddingBottom: 40 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1e293b', marginBottom: 20, fontWeight: '500' },
  textInputDark: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' },

  /* ---- Category Grid (Modal) ---- */
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(100,116,139,0.06)', borderWidth: 2, borderColor: 'transparent' },
  categoryChipEmoji: { fontSize: 18 },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  /* ---- Time Picker ---- */
  timePickerRow: { marginBottom: 20, gap: 12 },
  timePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(100,116,139,0.08)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
  timePickerButtonDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  timePickerText: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  quickTimesRow: { flexDirection: 'row', gap: 8 },
  quickTimeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.06)' },
  quickTimeChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  /* ---- Repeat ---- */
  repeatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  repeatChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.08)' },
  repeatChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  repeatChipTextActive: { color: '#fff', fontWeight: '700' },

  /* ---- Days of Week ---- */
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.08)' },
  dayChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  dayChipTextActive: { color: '#fff', fontWeight: '700' },

  /* ---- Notes ---- */
  notesInput: { backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1e293b', marginBottom: 24, minHeight: 80, fontWeight: '500' },
  notesInputDark: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' },

  /* ---- Save Button ---- */
  saveButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* ---- Delete Button ---- */
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.08)' },
  deleteButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  /* ---- Alert ---- */
  alertContainer: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    minWidth: 300, maxWidth: width - 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },
});