import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

// ✅ FIX: Import Svg at the top before any usage
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching Achievements/GrowthDashboard exactly
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
   GLASS CARD — Matching Achievements screen
   ═══════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false }: any) => {
  const { darkMode: isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: '#6366f1', borderWidth: 2 },
      style,
    ]}>
      <LinearGradient
        colors={isDark
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER — Matching Achievements screen
   ═══════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: any) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: '#6366f1' }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════
   SWEET ALERT — Matching Achievements screen
   ═══════════════════════════════════════════════════════════════ */

const SweetAlert = React.memo(({ visible, type, title, message, emoji, onClose, isDark }: any) => {
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
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
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
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 1: Reminder Stats Ring — Like Achievements Streak Ring
   ═══════════════════════════════════════════════════════════════ */

const ReminderStatsRing = React.memo(({ total, active, isDark }: { total: number; active: number; isDark: boolean }) => {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (active / total) * 100 : 0;
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.statsRingContainer}>
      <View style={[styles.statsRingWrap, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id="statsRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#6366f1" />
              <Stop offset="100%" stopColor="#a78bfa" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#statsRingGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.statsRingInner}>
          <Text style={[styles.statsRingValue, { color: isDark ? '#fff' : '#1e293b' }]}>{active}</Text>
          <Text style={[styles.statsRingLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>active</Text>
        </View>
      </View>
      <View style={styles.statsRingMeta}>
        <View style={styles.statsRingMetaItem}>
          <View style={[styles.statsRingMetaDot, { backgroundColor: '#6366f1' }]} />
          <Text style={[styles.statsRingMetaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{active} active</Text>
        </View>
        <View style={styles.statsRingMetaItem}>
          <View style={[styles.statsRingMetaDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
          <Text style={[styles.statsRingMetaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{total - active} paused</Text>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 2: Category Breakdown — Like Rarity Showcase
   ═══════════════════════════════════════════════════════════════ */

const CategoryBreakdown = React.memo(({ reminders, isDark }: { reminders: Reminder[]; isDark: boolean }) => {
  const categories = useMemo(() => {
    const counts: Record<string, { label: string; color: string; count: number }> = {};
    Object.entries(CATEGORY_CONFIG).forEach(([key, config]) => {
      counts[key] = { label: config.label, color: config.color, count: 0 };
    });
    reminders.forEach(r => {
      if (counts[r.category]) counts[r.category].count++;
    });
    return Object.entries(counts)
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count);
  }, [reminders]);

  if (categories.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="Categories" subtitle="Your reminder breakdown" isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBreakdownScroll}>
        {categories.map(([key, data]) => (
          <View key={key} style={[
            styles.categoryBreakdownCard,
            { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' },
          ]}>
            <LinearGradient
              colors={[`${data.color}15`, `${data.color}05`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.categoryBreakdownIcon, { backgroundColor: `${data.color}15` }]}>
              <Text style={styles.categoryBreakdownEmoji}>{CATEGORY_CONFIG[key as CategoryType]?.emoji || '⏰'}</Text>
            </View>
            <Text style={[styles.categoryBreakdownCount, { color: isDark ? '#fff' : '#1e293b' }]}>{data.count}</Text>
            <Text style={[styles.categoryBreakdownLabel, { color: data.color }]}>{data.label}</Text>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NEW FEATURE 3: Upcoming Timeline — Enhanced with visual flair
   ═══════════════════════════════════════════════════════════════ */

const UpcomingTimeline = React.memo(({ reminders, onPress, isDark }: { reminders: Reminder[]; onPress: (r: Reminder) => void; isDark: boolean }) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = useMemo(() => {
    return reminders
      .filter(r => r.enabled)
      .sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      })
      .map(r => {
        const [h, m] = r.time.split(':').map(Number);
        const minutes = h * 60 + m;
        const isPast = minutes < currentMinutes;
        const isNext = !isPast && minutes <= currentMinutes + 60;
        return { ...r, isPast, isNext, minutes };
      });
  }, [reminders, currentMinutes]);

  if (upcoming.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Today's Timeline" subtitle={`${upcoming.filter(r => !r.isPast).length} remaining`} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
        {upcoming.map((item, index) => {
          const config = CATEGORY_CONFIG[item.category];
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onPress(item)}
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
              {index < upcoming.length - 1 && (
                <View style={[styles.timelineConnector, item.isPast && { backgroundColor: config.color }]} />
              )}
              <View style={styles.timelineNodeContent}>
                <Text style={[styles.timelineTime, { color: item.isPast ? '#94a3b8' : isDark ? '#fff' : '#1e293b' }]}>{item.time}</Text>
                <Text style={[styles.timelineLabel, { color: item.isPast ? '#94a3b8' : isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{item.title}</Text>
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
   NEW FEATURE 4: Daily Insights — Matching Achievements style
   ═══════════════════════════════════════════════════════════════ */

const DailyInsights = memo(({ insights, isDark, onAction }: { insights: DailyInsight[]; isDark: boolean; onAction: (insight: DailyInsight) => void }) => {
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
      <SectionHeader title="Daily Insights" subtitle={`${insights.length} smart suggestions`} isDark={isDark} />
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
                <Text style={[styles.insightTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{insight.title}</Text>
                <Text style={[styles.insightMessage, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>{insight.message}</Text>
                {insight.actionLabel && (
                  <View style={[styles.insightActionBadge, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                    <Text style={[styles.insightActionText, { color: '#6366f1' }]}>{insight.actionLabel} →</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.insightDots}>
        {insights.map((_, i) => (
          <View key={i} style={[styles.insightDot, i === activeIndex && { backgroundColor: '#6366f1', width: 16 }]} />
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REMINDER LIST ITEM — Matching Achievements card style
   ═══════════════════════════════════════════════════════════════ */

const ReminderListItem = memo(({ item, index, isNext, onToggle, onPress, onLongPress, isDark }: {
  item: Reminder;
  index: number;
  isNext: boolean;
  onToggle: (id: string) => void;
  onPress: (item: Reminder) => void;
  onLongPress: (id: string) => void;
  isDark: boolean;
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
          { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' },
        ]}
      >
        <LinearGradient
          colors={[`${config.color}08`, `${config.color}02`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        {/* Left: Emoji/Icon */}
        <View style={[styles.reminderEmojiWrap, { backgroundColor: `${config.color}15` }]}>
          <Text style={styles.reminderEmoji}>{item.emoji || config.emoji}</Text>
        </View>

        {/* Center: Content */}
        <View style={styles.reminderContent}>
          <View style={styles.reminderTopRow}>
            <Text style={[styles.reminderTitle, isDark && styles.textDark, !item.enabled && styles.reminderTitleDisabled]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.reminderTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>{item.time}</Text>
          </View>
          <View style={styles.reminderMetaRow}>
            <View style={[styles.categoryTag, { backgroundColor: `${config.color}15` }]}>
              <Text style={[styles.categoryTagText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={[styles.metaDot, { color: isDark ? '#64748b' : '#94a3b8' }]}>•</Text>
            <Text style={[styles.metaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{REPEAT_LABELS[item.repeat]}</Text>
            {item.smartSuggestion && (
              <>
                <Text style={[styles.metaDot, { color: isDark ? '#64748b' : '#94a3b8' }]}>•</Text>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={10} color="#f59e0b" />
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              </>
            )}
          </View>
          {item.notes && (
            <Text style={[styles.reminderNotes, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{item.notes}</Text>
          )}
        </View>

        {/* Right: Toggle */}
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
   VIEW MODE TABS — Matching Achievements tab bar
   ═══════════════════════════════════════════════════════════════ */

const ViewModeTabs = React.memo(({
  tabs,
  activeTab,
  onChange,
  isDark,
}: {
  tabs: { key: ViewMode; label: string; icon: string; badge?: number }[];
  activeTab: ViewMode;
  onChange: (t: ViewMode) => void;
  isDark: boolean;
}) => (
  <View style={[
    styles.viewTabBar,
    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
  ]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.viewTab,
            isActive && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
            },
          ]}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={isActive ? '#6366f1' : isDark ? '#94a3b8' : '#64748b'}
          />
          <Text style={[
            styles.viewTabLabel,
            { color: isActive ? '#6366f1' : isDark ? '#94a3b8' : '#64748b' },
            isActive && { fontWeight: '700' },
          ]}>
            {tab.label}
          </Text>
          {tab.badge && tab.badge > 0 && !isActive && (
            <View style={[styles.viewTabBadge, { backgroundColor: '#6366f1' }]}>
              <Text style={styles.viewTabBadgeText}>{tab.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════
   CATEGORY FILTER — Matching Achievements filter
   ═══════════════════════════════════════════════════════════════ */

const CategoryFilter = React.memo(({
  selectedCategory,
  onChange,
  reminders,
  isDark,
}: {
  selectedCategory: string;
  onChange: (c: string) => void;
  reminders: Reminder[];
  isDark: boolean;
}) => {
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: reminders.length };
    Object.keys(CATEGORY_CONFIG).forEach((key) => {
      counts[key] = reminders.filter((r) => r.category === key).length;
    });
    return counts;
  }, [reminders]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <TouchableOpacity
        style={[
          styles.filterChip,
          selectedCategory === 'all' && { backgroundColor: '#6366f1', borderColor: 'transparent' },
        ]}
        onPress={() => onChange('all')}
      >
        <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>
          All
        </Text>
        <View style={[styles.filterBadge, { backgroundColor: selectedCategory === 'all' ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.filterBadgeText, { color: selectedCategory === 'all' ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>
            {categoryCounts.all}
          </Text>
        </View>
      </TouchableOpacity>
      {Object.entries(CATEGORY_CONFIG).map(([key, cat]) => {
        const isActive = selectedCategory === key;
        const count = categoryCounts[key] || 0;
        if (count === 0) return null;
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              isActive && { backgroundColor: cat.color, borderColor: 'transparent' },
            ]}
            onPress={() => onChange(key)}
          >
            <Text style={styles.filterChipEmoji}>{cat.emoji}</Text>
            <Text style={[
              styles.filterText,
              { color: isActive ? '#fff' : isDark ? '#cbd5e1' : '#475569' },
            ]}>
              {cat.label}
            </Text>
            {!isActive && (
              <View style={[styles.filterBadge, { backgroundColor: `${cat.color}20` }]}>
                <Text style={[styles.filterBadgeText, { color: cat.color }]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QUICK ADD FAB — Matching Achievements style
   ═══════════════════════════════════════════════════════════════ */

const QuickAddFAB = React.memo(({ onPress, themeColors }: { onPress: () => void; themeColors: any }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.fab}>
    <LinearGradient colors={[themeColors?.primary || '#6366f1', themeColors?.secondary || '#a78bfa']} style={styles.fabGradient}>
      <Ionicons name="add" size={28} color="#fff" />
    </LinearGradient>
  </TouchableOpacity>
));

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN — COMPLETE REDESIGN with Achievements UI
   ═══════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerReminders'>;

export default function RemindersScreen({ navigation, route }: Props) {
  const scrollY = useSharedValue(0);
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const sweetAlert = useSweetAlert();
  const { currentBaby, babies, loadBabies, isLoading: babyLoading } = useBaby();
  const { entries: activities, isLoading: activityLoading } = useActivity();

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
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('custom');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('daily');
  const [formTime, setFormTime] = useState(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formColor, setFormColor] = useState(CATEGORY_CONFIG.custom.color);

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
      loadBabies();
      loadData();
      checkStreakStatus();
      generateSmartSuggestions();
      generateDailyInsights();
    }, [baby?.id, loadBabies])
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

  /* ---- Baby required modal ---- */
  useEffect(() => {
    if (!baby && !isInitialLoad) {
      setShowBabyRequiredModal(true);
    } else {
      setShowBabyRequiredModal(false);
    }
  }, [baby]);

  /* ---- Data loading with instant display ---- */
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
      setIsInitialLoad(false);
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

  /* ---- Share ---- */
  const handleShare = async () => {
    triggerHaptic('medium');
    try {
      const activeCount = reminders.filter(r => r.enabled).length;
      const message = baby
        ? `⏰ ${baby.name} has ${activeCount} active reminders on LittleLoom! Stay on track with daily routines.`
        : `I'm using LittleLoom to track ${activeCount} daily reminders! 🏆`;
      await Share.share({ message, title: 'LittleLoom Reminders' });
      showToast('success', 'Shared!', 'Your reminders have been shared');
    } catch {
      showToast('error', 'Share Failed', 'Could not share reminders');
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     ⚡ INSTANT LOADING: Show content immediately, no spinner
     ═══════════════════════════════════════════════════════════════ */

  // ❌ No loading spinner - show content instantly even if data is loading
  // Only show loading if truly nothing exists and still loading

  /* ---- No baby state (shown instantly) ---- */
  if (!baby && !isInitialLoad) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <GlassCard>
            <LinearGradient colors={[themeColors?.primary || '#6366f1', themeColors?.secondary || '#a78bfa']} style={styles.noBabyGradient}>
              <Ionicons name="add-circle" size={56} color="#fff" />
              <Text style={styles.noBabyTitle}>Baby Profile Needed</Text>
              <Text style={styles.noBabySubtitle}>Create a baby profile to manage reminders</Text>
              <TouchableOpacity style={styles.noBabyButton} onPress={() => navigation.navigate('CreateBabyProfile')}>
                <Text style={[styles.noBabyButtonText, { color: themeColors?.primary || '#6366f1' }]}>Create Baby Profile</Text>
              </TouchableOpacity>
            </LinearGradient>
          </GlassCard>
        </View>

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
                <LinearGradient colors={[themeColors?.secondary || '#fa709a', themeColors?.primary || '#6366f1']} style={styles.modalIconGradient}>
                  <Ionicons name="people-outline" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>Baby Profile Needed</Text>
              <Text style={[styles.modalDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Create a baby profile to start tracking activities and unlock all features.
              </Text>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: themeColors?.primary || '#6366f1' }]}
                onPress={() => {
                  setShowBabyRequiredModal(false);
                  navigation.navigate('CreateBabyProfile');
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setShowBabyRequiredModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: isDark ? '#94a3b8' : '#94a3b8' }]}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ⚡ Show content even while loading - no spinner
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, headerAnimatedStyle]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
          {baby?.name ? `${baby.name}'s Reminders` : 'Reminders'}
        </Text>
        <Text style={[styles.stickySubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {reminders.filter(r => r.enabled).length} active
        </Text>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              {baby?.name ? `${baby.name}'s Reminders` : 'Reminders'}
            </Text>
            <View style={[styles.pointsBadge, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Ionicons name="time" size={14} color="#6366f1" />
              <Text style={[styles.pointsText, { color: '#6366f1' }]}>{reminders.filter(r => r.enabled).length} active</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleShare} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="share-outline" size={22} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── BABY INFO CARD ── */}
        {baby && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <GlassCard onPress={() => babies.length > 1 && navigation.navigate('SwitchBaby')}>
              <View style={styles.babyRow}>
                <SafeBabyAvatar
                  avatar={baby.avatar}
                  gender={baby.gender}
                  size={60}
                  showBadge={streakData.current > 0}
                  animated={!shouldReduceMotion}
                />
                <View style={styles.babyInfo}>
                  <Text style={[styles.babyName, { color: isDark ? '#fff' : '#1e293b' }]}>{baby.name}</Text>
                  <Text style={[styles.babyAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>{baby.age}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: streakData.atRisk ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                    <Ionicons name={streakData.atRisk ? 'flame-outline' : 'checkmark-circle'} size={14} color={streakData.atRisk ? '#ef4444' : '#10b981'} />
                    <Text style={[styles.statusText, { color: streakData.atRisk ? '#ef4444' : '#10b981' }]}>
                      {streakData.atRisk ? 'Streak at risk!' : `${streakData.current}d streak`}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsCol}>
                  <Text style={[styles.statValue, { color: isDark ? '#fff' : '#1e293b' }]}>{reminders.filter(r => r.enabled).length}</Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Active</Text>
                </View>
              </View>
              {streakData.atRisk && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning" size={16} color="#ef4444" />
                  <Text style={styles.warningText}>Log an activity today to keep your streak!</Text>
                  <TouchableOpacity style={styles.warningAction} onPress={() => quickLog('potty')}>
                    <Text style={styles.warningActionText}>Log Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>
          </Animated.View>
        )}

        {/* ── NEW FEATURE 1: Reminder Stats Ring ── */}
        {baby && reminders.length > 0 && (
          <View style={styles.statsRingSection}>
            <ReminderStatsRing
              total={reminders.length}
              active={reminders.filter(r => r.enabled).length}
              isDark={isDark}
            />
          </View>
        )}

        {/* ── NEW FEATURE 2: Category Breakdown ── */}
        {baby && reminders.length > 0 && (
          <CategoryBreakdown reminders={reminders} isDark={isDark} />
        )}

        {/* ── Daily Insights ── */}
        {baby && dailyInsights.length > 0 && (
          <DailyInsights insights={dailyInsights} isDark={isDark} onAction={(insight) => {
            triggerHaptic('light');
            if (insight.actionScreen) navigation.navigate(insight.actionScreen as any);
          }} />
        )}

        {/* ── NEW FEATURE 3: Upcoming Timeline ── */}
        {baby && reminders.filter(r => r.enabled).length > 0 && (
          <UpcomingTimeline reminders={reminders} onPress={openEditModal} isDark={isDark} />
        )}

        {/* ── View Mode Tabs ── */}
        <ViewModeTabs
          tabs={viewTabs}
          activeTab={viewMode}
          onChange={(tab) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setViewMode(tab);
            triggerHaptic('light');
          }}
          isDark={isDark}
        />

        {/* ── Category Filter ── */}
        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && reminders.length > 0 && (
          <CategoryFilter
            reminders={reminders}
            selectedCategory={activeCategory}
            onChange={(cat) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveCategory(cat);
              triggerHaptic('light');
            }}
            isDark={isDark}
          />
        )}

        {/* ── Content based on view mode ── */}
        {viewMode === 'smart' && (
          <View style={styles.section}>
            <SectionHeader
              title="Smart Suggestions"
              subtitle={`${smartSuggestions.length} AI-powered recommendations`}
              isDark={isDark}
            />
            {smartSuggestions.map((suggestion, i) => (
              <Animated.View key={suggestion.id} entering={FadeInUp.delay(i * 60).springify()}>
                <GlassCard style={styles.smartCard}>
                  <View style={styles.smartCardHeader}>
                    <View style={styles.smartCardLeft}>
                      <View style={[styles.smartCardIconBg, { backgroundColor: `${CATEGORY_CONFIG[suggestion.type].color}15` }]}>
                        <Text style={styles.smartCardEmoji}>{suggestion.emoji}</Text>
                      </View>
                      <View>
                        <Text style={[styles.smartCardTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{suggestion.title}</Text>
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
                    <TouchableOpacity onPress={() => dismissSuggestion(suggestion.id)} style={styles.dismissBtn}>
                      <Ionicons name="close" size={18} color={isDark ? '#94a3b8' : '#94a3b8'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.smartCardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>{suggestion.description}</Text>
                  <View style={styles.smartCardFooter}>
                    <View style={styles.smartCardTimeRow}>
                      <Ionicons name="time-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                      <Text style={[styles.smartCardTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>Best at {suggestion.optimalTime}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.smartCardApplyBtn} onPress={() => applySmartSuggestion(suggestion)}>
                    <LinearGradient colors={CATEGORY_CONFIG[suggestion.type].gradient} style={styles.smartCardApplyGradient}>
                      <Ionicons name="add-circle" size={16} color="#fff" />
                      <Text style={styles.smartCardApplyText}>Add Reminder</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </GlassCard>
              </Animated.View>
            ))}
            {smartSuggestions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={56} color={isDark ? '#64748b' : '#cbd5e1'} />
                <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#1e293b' }]}>No smart suggestions</Text>
                <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Keep tracking activities and AI will suggest optimal reminders</Text>
              </View>
            )}
          </View>
        )}

        {viewMode === 'analytics' && (
          <View style={styles.analyticsSection}>
            <SectionHeader title="Analytics" subtitle="Your reminder performance" isDark={isDark} />
            <View style={styles.analyticsGrid}>
              {[
                { label: 'Active', value: reminders.filter(r => r.enabled).length, icon: 'checkmark-done', color: '#10b981' },
                { label: 'Paused', value: reminders.filter(r => !r.enabled).length, icon: 'pause', color: '#94a3b8' },
                { label: 'Categories', value: Object.keys(CATEGORY_CONFIG).filter(c => reminders.some(r => r.category === c)).length, icon: 'grid', color: '#6366f1' },
                { label: 'Smart', value: reminders.filter(r => r.smartSuggestion).length, icon: 'sparkles', color: '#f59e0b' },
              ].map((stat) => (
                <GlassCard key={stat.label} style={styles.analyticsCard}>
                  <View style={[styles.analyticsIconBg, { backgroundColor: `${stat.color}15` }]}>
                    <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                  </View>
                  <Text style={[styles.analyticsValue, { color: isDark ? '#fff' : '#1e293b' }]}>{stat.value}</Text>
                  <Text style={[styles.analyticsLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{stat.label}</Text>
                </GlassCard>
              ))}
            </View>

            {/* Weekly chart */}
            <GlassCard>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Weekly Activity</Text>
                <Text style={[styles.chartSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>Reminders completed per day</Text>
              </View>
              <View style={styles.chartBars}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                  const count = analytics?.weekly?.[day] || 0;
                  const maxCount = Math.max(...Object.values(analytics?.weekly || {}), 1);
                  const height = (count / maxCount) * 80;
                  return (
                    <View key={day} style={styles.chartBarContainer}>
                      <View style={[styles.chartBar, { height: Math.max(height, 4), backgroundColor: '#6366f1' }]} />
                      <Text style={[styles.chartBarLabel, { color: isDark ? '#94a3b8' : '#94a3b8' }]}>{day}</Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>
          </View>
        )}

        {(viewMode === 'today' || viewMode === 'upcoming' || viewMode === 'all') && (
          <View style={styles.section}>
            <SectionHeader
              title={viewMode === 'today' ? "Today's Schedule" : viewMode === 'upcoming' ? 'Upcoming' : 'All Reminders'}
              subtitle={`${filteredReminders.length} reminder${filteredReminders.length !== 1 ? 's' : ''}`}
              isDark={isDark}
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
              />
            ))}
            {filteredReminders.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={56} color={isDark ? '#64748b' : '#cbd5e1'} />
                <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                  {searchQuery ? 'No matches found' : 'No reminders yet'}
                </Text>
                <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {searchQuery ? 'Try a different search term' : 'Tap + to add your first reminder'}
                </Text>
              </View>
            )}
          </View>
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
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                {showEditModal ? 'Edit Reminder' : 'New Reminder'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>What to remind?</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: isDark ? '#fff' : '#1e293b' }]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g., Give Vitamin D"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                maxLength={50}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, formCategory === cat && { backgroundColor: `${CATEGORY_CONFIG[cat].color}20`, borderColor: CATEGORY_CONFIG[cat].color, borderWidth: 2 }]}
                    onPress={() => { setFormCategory(cat); setFormColor(CATEGORY_CONFIG[cat].color); triggerHaptic('light'); }}
                  >
                    <Text style={styles.categoryChipEmoji}>{CATEGORY_CONFIG[cat].emoji}</Text>
                    <Text style={[styles.categoryChipText, formCategory === cat && { color: CATEGORY_CONFIG[cat].color, fontWeight: '700' }, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                      {CATEGORY_CONFIG[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Time</Text>
              <View style={styles.timePickerRow}>
                <TouchableOpacity style={[styles.timePickerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} onPress={() => setShowTimePicker(true)}>
                  <Ionicons name="time-outline" size={22} color="#6366f1" />
                  <Text style={[styles.timePickerText, { color: isDark ? '#fff' : '#1e293b' }]}>{format(formTime, 'h:mm a')}</Text>
                </TouchableOpacity>
                <View style={styles.quickTimesRow}>
                  {[
                    { label: 'Morning', time: '08:00' },
                    { label: 'Noon', time: '12:00' },
                    { label: 'Evening', time: '18:00' },
                    { label: 'Night', time: '21:00' },
                  ].map((qt) => (
                    <TouchableOpacity key={qt.label} style={[styles.quickTimeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} onPress={() => {
                      const [h, m] = qt.time.split(':').map(Number);
                      setFormTime(set(new Date(), { hours: h, minutes: m }));
                      triggerHaptic('light');
                    }}>
                      <Text style={[styles.quickTimeChipText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{qt.label}</Text>
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

              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Repeat</Text>
              <View style={styles.repeatGrid}>
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.repeatChip, formRepeat === opt && { backgroundColor: '#6366f1' }]}
                    onPress={() => { setFormRepeat(opt); triggerHaptic('light'); }}
                  >
                    <Text style={[styles.repeatChipText, formRepeat === opt && styles.repeatChipTextActive, { color: formRepeat === opt ? '#fff' : isDark ? '#cbd5e1' : '#64748b' }]}>
                      {REPEAT_LABELS[opt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formRepeat === 'custom' && (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Days of Week</Text>
                  <View style={styles.daysRow}>
                    {WEEKDAYS.map((day) => (
                      <TouchableOpacity
                        key={day.id}
                        style={[styles.dayChip, formDaysOfWeek.includes(day.id) && { backgroundColor: '#6366f1' }]}
                        onPress={() => {
                          setFormDaysOfWeek((prev) =>
                            prev.includes(day.id) ? prev.filter((d) => d !== day.id) : [...prev, day.id].sort()
                          );
                          triggerHaptic('light');
                        }}
                      >
                        <Text style={[styles.dayChipText, formDaysOfWeek.includes(day.id) && styles.dayChipTextActive, { color: formDaysOfWeek.includes(day.id) ? '#fff' : isDark ? '#cbd5e1' : '#64748b' }]}>{day.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: isDark ? '#fff' : '#1e293b' }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Add details..."
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.saveButton} onPress={showEditModal ? updateReminder : addReminder} activeOpacity={0.9}>
                <LinearGradient colors={[themeColors?.primary || '#6366f1', themeColors?.secondary || '#a78bfa']} style={styles.saveButtonGradient}>
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

// IntelligentReminderEngine class (same as before)
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
   STYLES — Completely Redesigned matching Achievements screen
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
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  /* ---- Sticky Header ---- */
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* ---- Top Header ---- */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  pointsText: { fontSize: 13, fontWeight: '700' },

  /* ---- Section Header ---- */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  /* ---- Baby Card ---- */
  babyRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  babyInfo: { flex: 1, marginLeft: 14 },
  babyName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  babyAge: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsCol: { alignItems: 'center', marginLeft: 'auto', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(100,116,139,0.15)' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },
  warningText: { fontSize: 13, color: '#ef4444', marginLeft: 8, fontWeight: '600', flex: 1 },
  warningAction: { marginLeft: 'auto', backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  warningActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  /* ---- Stats Ring ---- */
  statsRingSection: { alignItems: 'center', marginVertical: 8 },
  statsRingContainer: { alignItems: 'center' },
  statsRingWrap: { justifyContent: 'center', alignItems: 'center' },
  statsRingInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  statsRingValue: { fontSize: 32, fontWeight: '800' },
  statsRingLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statsRingMeta: { flexDirection: 'row', gap: 16, marginTop: 12 },
  statsRingMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsRingMetaDot: { width: 8, height: 8, borderRadius: 4 },
  statsRingMetaText: { fontSize: 12, fontWeight: '500' },

  /* ---- Category Breakdown ---- */
  categoryBreakdownScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  categoryBreakdownCard: {
    width: 100,
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
  },
  categoryBreakdownIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  categoryBreakdownEmoji: { fontSize: 22 },
  categoryBreakdownCount: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  categoryBreakdownLabel: { fontSize: 11, fontWeight: '700' },

  /* ---- Insights ---- */
  insightsScroll: { paddingHorizontal: 16, gap: 0 },
  insightCard: {
    width: width - 48,
    padding: 18,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderLeftWidth: 4,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  insightIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 28 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 16, fontWeight: '800' },
  insightMessage: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 6 },
  insightActionText: { fontSize: 12, fontWeight: '700' },
  insightDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' },

  /* ---- Timeline ---- */
  timelineScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 0 },
  timelineNode: { alignItems: 'center', width: 80, marginRight: 4 },
  timelineNodeNext: { transform: [{ scale: 1.05 }] },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: '#fff',
  },
  timelineConnector: { width: 52, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: -2 },
  timelineNodeContent: { alignItems: 'center', gap: 2, marginTop: 8 },
  timelineTime: { fontSize: 13, fontWeight: '800' },
  timelineLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center', maxWidth: 70 },
  timelineNextBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  timelineNextText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- View Tabs ---- */
  viewTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    position: 'relative',
  },
  viewTabLabel: { fontSize: 12, fontWeight: '600' },
  viewTabBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewTabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- Category Filter ---- */
  filterScroll: { marginBottom: 16, marginTop: 4, paddingLeft: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.15)',
    marginRight: 8,
    gap: 6,
  },
  filterChipEmoji: { fontSize: 14 },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '800' },

  /* ---- Reminder Item ---- */
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  reminderItemNext: { borderColor: 'rgba(99,102,241,0.3)', borderWidth: 2 },
  reminderItemDisabled: { opacity: 0.55 },
  reminderEmojiWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  reminderEmoji: { fontSize: 22 },
  reminderContent: { flex: 1 },
  reminderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  reminderTitleDisabled: { textDecorationLine: 'line-through' },
  reminderTime: { fontSize: 13, fontWeight: '600' },
  reminderMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryTagText: { fontSize: 10, fontWeight: '700' },
  metaDot: { fontSize: 12 },
  metaText: { fontSize: 11, fontWeight: '500' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  aiBadgeText: { fontSize: 10, fontWeight: '700', color: '#f59e0b' },
  reminderNotes: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  reminderRight: { alignItems: 'center', gap: 6, marginLeft: 8 },
  nextIndicator: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nextIndicatorText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* ---- Smart Suggestions ---- */
  smartCard: { padding: 16, marginBottom: 10 },
  smartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  smartCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  smartCardIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  smartCardEmoji: { fontSize: 24 },
  smartCardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  smartCardMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidenceText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  urgentBadge: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  dismissBtn: { padding: 4 },
  smartCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10, fontWeight: '500' },
  smartCardFooter: { gap: 4, marginBottom: 12 },
  smartCardTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartCardTime: { fontSize: 12, fontWeight: '600' },
  smartCardApplyBtn: { borderRadius: 12, overflow: 'hidden' },
  smartCardApplyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  smartCardApplyText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ---- Analytics ---- */
  analyticsSection: { marginBottom: 20 },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  analyticsCard: { width: (width - 56) / 2, padding: 16, alignItems: 'center' },
  analyticsIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  analyticsValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  analyticsLabel: { fontSize: 11, fontWeight: '600' },
  chartHeader: { padding: 16, paddingBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: '800' },
  chartSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 16, height: 120 },
  chartBarContainer: { alignItems: 'center', gap: 6 },
  chartBar: { width: 24, borderRadius: 6, minHeight: 4 },
  chartBarLabel: { fontSize: 10, fontWeight: '600' },

  /* ---- FAB ---- */
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    zIndex: 50,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  /* ---- Section ---- */
  section: { marginBottom: 20 },

  /* ---- Empty State ---- */
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 40 },

  /* ---- Center Content (No Baby) ---- */
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  noBabyGradient: { padding: 40, alignItems: 'center', borderRadius: 24 },
  noBabyEmoji: { fontSize: 56, marginBottom: 16 },
  noBabyTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, textAlign: 'center' },
  noBabyButton: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, marginTop: 8 },
  noBabyButtonText: { fontSize: 15, fontWeight: '700' },

  /* ---- Modal (Baby Required) ---- */
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

  /* ---- Add/Edit Modal ---- */
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  modalScroll: { paddingBottom: 40 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 20, fontWeight: '500' },

  /* ---- Category Grid ---- */
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(100,116,139,0.06)', borderWidth: 2, borderColor: 'transparent' },
  categoryChipEmoji: { fontSize: 18 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },

  /* ---- Time Picker ---- */
  timePickerRow: { marginBottom: 20, gap: 12 },
  timePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
  timePickerText: { fontSize: 18, fontWeight: '700' },
  quickTimesRow: { flexDirection: 'row', gap: 8 },
  quickTimeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  quickTimeChipText: { fontSize: 12, fontWeight: '600' },

  /* ---- Repeat ---- */
  repeatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  repeatChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.08)' },
  repeatChipText: { fontSize: 13, fontWeight: '600' },
  repeatChipTextActive: { color: '#fff', fontWeight: '700' },

  /* ---- Days ---- */
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.08)' },
  dayChipText: { fontSize: 14, fontWeight: '600' },
  dayChipTextActive: { color: '#fff', fontWeight: '700' },

  /* ---- Notes ---- */
  notesInput: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 24, minHeight: 80, fontWeight: '500' },

  /* ---- Save Button ---- */
  saveButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* ---- Delete Button ---- */
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.08)' },
  deleteButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

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
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },
});