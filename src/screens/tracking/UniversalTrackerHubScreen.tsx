// UniversalTrackerHubScreen.tsx — COMPLETE REDESIGN v2.0
// Inspired by GrowthDashboardScreen patterns with 6 new intelligent features

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  SlideInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import {
  format,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  addHours,
  isAfter,
} from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../context/TrackerContext';
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { useNavigationContext } from '../../context/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type HubNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'home' | 'quick' | 'insights' | 'family';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Cohesive system matching GrowthDashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface TrackerSubAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  presetData?: Record<string, unknown>;
}

interface TrackerConfig {
  emoji: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: 'essential' | 'health' | 'development' | 'care';
  subActions: TrackerSubAction[];
}

interface SmartInsight {
  id: string;
  type: 'pattern' | 'alert' | 'tip' | 'milestone' | 'streak' | 'prediction';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
  timestamp: number;
}

interface NextEvent {
  id: string;
  trackerId: string;
  label: string;
  emoji: string;
  color: string;
  dueInMinutes: number;
  predictedTime: string;
  confidence: number;
}

interface FamilyActivity {
  id: string;
  userName: string;
  userAvatar?: string;
  action: string;
  trackerEmoji: string;
  timeAgo: string;
  babyName: string;
}

interface DailyGoal {
  id: string;
  label: string;
  icon: string;
  target: number;
  current: number;
  color: string;
  unit: string;
}

interface RoutineSuggestion {
  id: string;
  time: string;
  label: string;
  emoji: string;
  color: string;
  isCompleted: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
  feed: {
    emoji: '🍼',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    description: 'Feeding sessions',
    category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left Breast', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right Breast', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'breast_both', label: 'Both Sides', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { feedType: 'breast', side: 'both' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solid Food', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ],
  },
  sleep: {
    emoji: '🌙',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    description: 'Sleep tracking',
    category: 'essential',
    subActions: [
      { id: 'nap', label: 'Start Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'End Sleep', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ],
  },
  diaper: {
    emoji: '👶',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#A78BFA'],
    description: 'Diaper changes',
    category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
      { id: 'dry', label: 'Dry', icon: 'checkmark-circle-outline', color: '#10b981', presetData: { type: 'dry' } },
    ],
  },
  potty: {
    emoji: '💧',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    description: 'Potty training',
    category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'both', label: 'Both', icon: 'water', color: '#667eea', presetData: { type: 'both', successful: true } },
      { id: 'dry', label: 'Dry Attempt', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ],
  },
  growth: {
    emoji: '📏',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Growth measurements',
    category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ],
  },
  milestone: {
    emoji: '🏆',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    description: 'Development milestones',
    category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
      { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#3b82f6', presetData: { category: 'language' } },
    ],
  },
  medication: {
    emoji: '💊',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Health & medication',
    category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temperature', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
      { id: 'vaccine', label: 'Vaccination', icon: 'shield-checkmark-outline', color: '#10b981', presetData: { type: 'vaccine' } },
    ],
  },
  pumping: {
    emoji: '🤱',
    color: '#ec4899',
    gradient: ['#ec4899', '#f472b6'],
    description: 'Pumping sessions',
    category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

const TABS: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'home', label: 'Home', icon: 'home-outline' },
  { id: 'quick', label: 'Quick', icon: 'flash-outline' },
  { id: 'insights', label: 'Insights', icon: 'analytics-outline' },
  { id: 'family', label: 'Family', icon: 'people-outline' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
};

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const formatDistanceToNow = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?', months: 0 };
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?', months: 0 };
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const days = differenceInDays(now, birth) % 30;
  let display: string;
  if (years > 0) display = `${years}y ${months}m`;
  else if (months > 0) display = `${months}m ${days}d`;
  else display = `${days} days`;
  return { display, shortDisplay: months > 0 ? `${months}m` : `${days}d`, months: years * 12 + months };
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS CARD — Matching GrowthDashboard pattern
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const { isDark, colors } = useApp();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      hubStyles.glassCard,
      active && { borderColor: colors.primary, borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={isDark 
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] 
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[hubStyles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={hubStyles.glassContent}>{children}</View>
    </Wrapper>
  );
});
GlassCard.displayName = 'GlassCard';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Matching GrowthDashboard pattern
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, colors, textColor }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; colors: any; textColor: any }) => (
  <View style={hubStyles.sectionHeader}>
    <View>
      <Text style={[hubStyles.sectionTitle, { color: textColor }]}>{title}</Text>
      {subtitle && <Text style={[hubStyles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={hubStyles.sectionAction}>
        <Text style={[hubStyles.sectionActionText, { color: colors.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </TouchableOpacity>
    )}
  </View>
));
SectionHeader.displayName = 'SectionHeader';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI NEXT EVENT PREDICTOR
   Predicts when baby needs next feed, sleep, diaper based on patterns
   ═══════════════════════════════════════════════════════════════════════════ */

const NextEventPredictor = React.memo(({ entries, themeColors, textColors, onEventPress }: { entries: any[]; themeColors: any; textColors: any; onEventPress: (trackerId: string, action: TrackerSubAction) => void }) => {
  const predictions = useMemo((): NextEvent[] => {
    const now = Date.now();
    const result: NextEvent[] = [];

    // Feed prediction
    const feedEntries = entries.filter(e => e.trackerId === 'feed').sort((a, b) => b.timestamp - a.timestamp);
    if (feedEntries.length >= 2) {
      const avgGap = (feedEntries[0].timestamp - feedEntries[Math.min(3, feedEntries.length - 1)].timestamp) / Math.min(3, feedEntries.length - 1);
      const nextFeed = feedEntries[0].timestamp + avgGap;
      const dueIn = Math.max(0, Math.floor((nextFeed - now) / 60000));
      if (dueIn < 180) {
        result.push({
          id: 'next-feed',
          trackerId: 'feed',
          label: 'Next Feed',
          emoji: '🍼',
          color: '#fa709a',
          dueInMinutes: dueIn,
          predictedTime: format(new Date(nextFeed), 'h:mm a'),
          confidence: Math.min(95, 60 + feedEntries.length * 5),
        });
      }
    }

    // Sleep prediction
    const sleepEntries = entries.filter(e => e.trackerId === 'sleep').sort((a, b) => b.timestamp - a.timestamp);
    if (sleepEntries.length >= 2) {
      const lastSleep = sleepEntries[0];
      const avgWakeWindow = 3 * 60;
      const nextSleep = lastSleep.timestamp + (lastSleep.duration || avgWakeWindow) * 60000;
      const dueIn = Math.max(0, Math.floor((nextSleep - now) / 60000));
      if (dueIn < 240) {
        result.push({
          id: 'next-sleep',
          trackerId: 'sleep',
          label: 'Next Sleep',
          emoji: '🌙',
          color: '#11998e',
          dueInMinutes: dueIn,
          predictedTime: format(new Date(nextSleep), 'h:mm a'),
          confidence: Math.min(90, 50 + sleepEntries.length * 4),
        });
      }
    }

    // Diaper prediction
    const diaperEntries = entries.filter(e => e.trackerId === 'diaper').sort((a, b) => b.timestamp - a.timestamp);
    if (diaperEntries.length >= 2) {
      const avgGap = (diaperEntries[0].timestamp - diaperEntries[Math.min(5, diaperEntries.length - 1)].timestamp) / Math.min(5, diaperEntries.length - 1);
      const nextDiaper = diaperEntries[0].timestamp + avgGap;
      const dueIn = Math.max(0, Math.floor((nextDiaper - now) / 60000));
      if (dueIn < 120) {
        result.push({
          id: 'next-diaper',
          trackerId: 'diaper',
          label: 'Next Diaper',
          emoji: '👶',
          color: '#8B5CF6',
          dueInMinutes: dueIn,
          predictedTime: format(new Date(nextDiaper), 'h:mm a'),
          confidence: Math.min(85, 55 + diaperEntries.length * 3),
        });
      }
    }

    return result.sort((a, b) => a.dueInMinutes - b.dueInMinutes).slice(0, 3);
  }, [entries]);

  if (predictions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Up Next" subtitle="AI predictions based on patterns" colors={themeColors} textColor={textColors.text} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hubStyles.predictorScroll}>
        {predictions.map((pred, i) => (
          <TouchableOpacity
            key={pred.id}
            onPress={() => {
              const config = TRACKER_CONFIGS[pred.trackerId];
              const action = config?.subActions[0];
              if (action) onEventPress(pred.trackerId, action);
            }}
            style={[hubStyles.predictorCard, { borderColor: `${pred.color}30` }]}
          >
            <LinearGradient
              colors={[`${pred.color}12`, `${pred.color}04`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={hubStyles.predictorTop}>
              <Text style={hubStyles.predictorEmoji}>{pred.emoji}</Text>
              <View style={[hubStyles.predictorConfidenceBadge, { backgroundColor: `${pred.color}15` }]}>
                <Text style={[hubStyles.predictorConfidenceText, { color: pred.color }]}>{pred.confidence}%</Text>
              </View>
            </View>
            <Text style={[hubStyles.predictorLabel, { color: textColors.text }]}>{pred.label}</Text>
            <Text style={[hubStyles.predictorTime, { color: pred.color }]}>
              {pred.dueInMinutes === 0 ? 'Due now!' : pred.dueInMinutes < 60 ? `In ${pred.dueInMinutes}m` : `In ${Math.floor(pred.dueInMinutes / 60)}h ${pred.dueInMinutes % 60}m`}
            </Text>
            <Text style={[hubStyles.predictorPredicted, { color: textColors.textSecondary }]}>~{pred.predictedTime}</Text>
            <View style={[hubStyles.predictorBarBg, { backgroundColor: `${pred.color}10` }]}>
              <View style={[hubStyles.predictorBarFill, { width: `${pred.confidence}%`, backgroundColor: pred.color }]} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
NextEventPredictor.displayName = 'NextEventPredictor';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: SMART DAILY GOALS
   Tracks daily targets for feeds, sleep, diapers with visual progress
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartDailyGoals = React.memo(({ entries, themeColors, textColors, onGoalPress }: { entries: any[]; themeColors: any; textColors: any; onGoalPress: (trackerId: string) => void }) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const goals = useMemo((): DailyGoal[] => {
    const todayEntries = entries.filter(e => e?.timestamp >= today);

    return [
      {
        id: 'feed-goal',
        label: 'Feeds',
        icon: '🍼',
        target: 8,
        current: todayEntries.filter(e => e.trackerId === 'feed').length,
        color: '#fa709a',
        unit: 'feeds',
      },
      {
        id: 'sleep-goal',
        label: 'Sleep',
        icon: '🌙',
        target: 14,
        current: Math.floor(todayEntries.filter(e => e.trackerId === 'sleep').reduce((sum, e) => sum + (e.duration || 0), 0) / 60),
        color: '#11998e',
        unit: 'hrs',
      },
      {
        id: 'diaper-goal',
        label: 'Diapers',
        icon: '👶',
        target: 6,
        current: todayEntries.filter(e => e.trackerId === 'diaper').length,
        color: '#8B5CF6',
        unit: 'changes',
      },
      {
        id: 'milestone-goal',
        label: 'Moments',
        icon: '🏆',
        target: 1,
        current: todayEntries.filter(e => e.trackerId === 'milestone').length,
        color: '#ffd700',
        unit: 'logs',
      },
    ];
  }, [entries, today]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="Daily Goals" subtitle={`${goals.filter(g => g.current >= g.target).length}/${goals.length} completed`} colors={themeColors} textColor={textColors.text} />
      <View style={hubStyles.goalsGrid}>
        {goals.map((goal) => {
          const progress = Math.min(goal.current / goal.target, 1);
          const isComplete = goal.current >= goal.target;
          return (
            <TouchableOpacity
              key={goal.id}
              onPress={() => onGoalPress(goal.id.split('-')[0])}
              style={[hubStyles.goalCard, { borderColor: `${goal.color}20` }]}
            >
              <LinearGradient
                colors={[`${goal.color}08`, `${goal.color}02`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={hubStyles.goalTop}>
                <Text style={hubStyles.goalIcon}>{goal.icon}</Text>
                {isComplete && (
                  <View style={[hubStyles.goalCompleteBadge, { backgroundColor: '#10b98115' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  </View>
                )}
              </View>
              <Text style={[hubStyles.goalCurrent, { color: textColors.text }]}>
                {goal.current}<Text style={[hubStyles.goalTarget, { color: textColors.textSecondary }]}>/{goal.target}</Text>
              </Text>
              <Text style={[hubStyles.goalLabel, { color: textColors.textSecondary }]}>{goal.label}</Text>
              <View style={hubStyles.goalBarWrap}>
                <View style={[hubStyles.goalBarBg, { backgroundColor: `${goal.color}15` }]}>
                  <View style={[hubStyles.goalBarFill, { width: `${progress * 100}%`, backgroundColor: isComplete ? '#10b981' : goal.color }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});
SmartDailyGoals.displayName = 'SmartDailyGoals';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: FAMILY ACTIVITY FEED
   Shows what other family members logged recently
   ═══════════════════════════════════════════════════════════════════════════ */

const FamilyActivityFeed = React.memo(({ entries, themeColors, textColors, onViewAll }: { entries: any[]; themeColors: any; textColors: any; onViewAll: () => void }) => {
  const activities = useMemo((): FamilyActivity[] => {
    return entries
      .filter(e => e.recordedBy && e.recordedBy !== 'You')
      .slice(0, 5)
      .map((e, i) => ({
        id: e.id || `act-${i}`,
        userName: e.recordedBy || 'Family',
        userAvatar: e.userAvatar,
        action: e.title || `${e.trackerId} logged`,
        trackerEmoji: TRACKER_CONFIGS[e.trackerId]?.emoji || '📋',
        timeAgo: formatDistanceToNow(e.timestamp),
        babyName: e.babyName || 'Baby',
      }));
  }, [entries]);

  if (activities.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Family Activity" subtitle="Recent logs from caregivers" colors={themeColors} textColor={textColors.text} action={onViewAll} />
      <GlassCard>
        {activities.map((act, i) => (
          <View key={act.id} style={[hubStyles.activityRow, i < activities.length - 1 && hubStyles.activityRowBorder]}>
            <View style={[hubStyles.activityAvatar, { backgroundColor: `${themeColors.primary}15` }]}>
              <Text style={hubStyles.activityAvatarText}>{act.userName.charAt(0)}</Text>
            </View>
            <View style={hubStyles.activityContent}>
              <Text style={[hubStyles.activityName, { color: textColors.text }]}>
                <Text style={{ fontWeight: '800' }}>{act.userName}</Text> logged {act.action}
              </Text>
              <Text style={[hubStyles.activityMeta, { color: textColors.textSecondary }]}>
                {act.trackerEmoji} {act.babyName} • {act.timeAgo}
              </Text>
            </View>
            <Text style={hubStyles.activityEmoji}>{act.trackerEmoji}</Text>
          </View>
        ))}
      </GlassCard>
    </Animated.View>
  );
});
FamilyActivityFeed.displayName = 'FamilyActivityFeed';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: INTELLIGENT ROUTINE SUGGESTIONS
   Suggests next routine actions based on time of day and baby's age
   ═══════════════════════════════════════════════════════════════════════════ */

const RoutineSuggestions = React.memo(({ baby, entries, themeColors, textColors, onRoutinePress }: { baby: BabyProfile | null; entries: any[]; themeColors: any; textColors: any; onRoutinePress: (trackerId: string, action: TrackerSubAction) => void }) => {
  const ageMonths = useMemo(() => {
    if (!baby?.birthDate) return 0;
    return differenceInMonths(new Date(), new Date(baby.birthDate));
  }, [baby]);

  const routines = useMemo((): RoutineSuggestion[] => {
    const hour = new Date().getHours();
    const result: RoutineSuggestion[] = [];

    if (hour >= 6 && hour < 10) {
      result.push({ id: 'morning-feed', time: 'Morning', label: 'First Feed', emoji: '🍼', color: '#fa709a', isCompleted: entries.some(e => e.trackerId === 'feed' && e.timestamp > new Date().setHours(6,0,0,0)) });
      if (ageMonths >= 6) result.push({ id: 'morning-solid', time: 'Morning', label: 'Breakfast', emoji: '🥣', color: '#f59e0b', isCompleted: entries.some(e => e.trackerId === 'feed' && e.presetData?.feedType === 'solid' && e.timestamp > new Date().setHours(6,0,0,0)) });
    }

    if (hour >= 10 && hour < 14) {
      result.push({ id: 'midday-nap', time: 'Midday', label: 'Nap Time', emoji: '🌙', color: '#11998e', isCompleted: entries.some(e => e.trackerId === 'sleep' && e.timestamp > new Date().setHours(10,0,0,0)) });
      result.push({ id: 'midday-diaper', time: 'Midday', label: 'Diaper Check', emoji: '👶', color: '#8B5CF6', isCompleted: entries.some(e => e.trackerId === 'diaper' && e.timestamp > new Date().setHours(10,0,0,0)) });
    }

    if (hour >= 14 && hour < 18) {
      result.push({ id: 'afternoon-play', time: 'Afternoon', label: 'Tummy Time', emoji: '👶', color: '#10b981', isCompleted: entries.some(e => e.trackerId === 'milestone' && e.timestamp > new Date().setHours(14,0,0,0)) });
      result.push({ id: 'afternoon-feed', time: 'Afternoon', label: 'Snack Feed', emoji: '🍼', color: '#fa709a', isCompleted: entries.some(e => e.trackerId === 'feed' && e.timestamp > new Date().setHours(14,0,0,0)) });
    }

    if (hour >= 18 && hour < 22) {
      result.push({ id: 'evening-bath', time: 'Evening', label: 'Bath Time', emoji: '🛁', color: '#06b6d4', isCompleted: false });
      result.push({ id: 'evening-bedtime', time: 'Evening', label: 'Bedtime Routine', emoji: '🌙', color: '#6366f1', isCompleted: entries.some(e => e.trackerId === 'sleep' && e.presetData?.sleepType === 'night' && e.timestamp > new Date().setHours(18,0,0,0)) });
    }

    if (hour >= 22 || hour < 6) {
      result.push({ id: 'night-feed', time: 'Night', label: 'Night Feed', emoji: '🍼', color: '#fa709a', isCompleted: entries.some(e => e.trackerId === 'feed' && e.timestamp > new Date().setHours(22,0,0,0)) });
      result.push({ id: 'night-diaper', time: 'Night', label: 'Night Diaper', emoji: '👶', color: '#8B5CF6', isCompleted: entries.some(e => e.trackerId === 'diaper' && e.timestamp > new Date().setHours(22,0,0,0)) });
    }

    return result.filter(r => !r.isCompleted).slice(0, 3);
  }, [ageMonths, entries]);

  if (routines.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Suggested Next" subtitle="Based on time & routine" colors={themeColors} textColor={textColors.text} />
      <View style={hubStyles.routineList}>
        {routines.map((routine) => {
          const trackerId = routine.id.split('-')[1] || 'feed';
          const config = TRACKER_CONFIGS[trackerId];
          const action = config?.subActions[0];
          return (
            <TouchableOpacity
              key={routine.id}
              onPress={() => action && onRoutinePress(trackerId, action)}
              style={[hubStyles.routineCard, { borderColor: `${routine.color}25` }]}
            >
              <LinearGradient
                colors={[`${routine.color}10`, `${routine.color}03`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[hubStyles.routineIconBg, { backgroundColor: `${routine.color}15` }]}>
                <Text style={hubStyles.routineEmoji}>{routine.emoji}</Text>
              </View>
              <View style={hubStyles.routineContent}>
                <Text style={[hubStyles.routineLabel, { color: textColors.text }]}>{routine.label}</Text>
                <Text style={[hubStyles.routineTime, { color: textColors.textSecondary }]}>{routine.time}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={routine.color} />
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});
RoutineSuggestions.displayName = 'RoutineSuggestions';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: SMART INSIGHTS CAROUSEL
   AI-powered insights based on tracking patterns
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartInsightsCarousel = React.memo(({ entries, baby, themeColors, textColors, onInsightPress }: { entries: any[]; baby: BabyProfile | null; themeColors: any; textColors: any; onInsightPress: (insight: SmartInsight) => void }) => {
  const insights = useMemo((): SmartInsight[] => {
    if (!baby) return [];
    const items: SmartInsight[] = [];
    const now = Date.now();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEntries = entries.filter(e => e?.timestamp >= today.getTime());

    const feedEntries = entries.filter(e => e.trackerId === 'feed').sort((a, b) => b.timestamp - a.timestamp);
    if (feedEntries.length >= 2) {
      const gap = (feedEntries[0].timestamp - feedEntries[1].timestamp) / 3600000;
      if (gap > 4) {
        items.push({
          id: 'feed-gap',
          type: 'alert',
          title: 'Long Gap Between Feeds',
          description: `It's been ${Math.floor(gap)} hours since the last feed. Consider offering a feed soon.`,
          emoji: '⏰',
          color: '#f59e0b',
          priority: 'medium',
          action: { label: 'Log Feed', screen: 'AddEntry', params: { trackerId: 'feed' } },
          timestamp: now,
        });
      }
    }

    const sleepMins = todayEntries.filter(e => e.trackerId === 'sleep').reduce((sum, e) => sum + (e.duration || 0), 0);
    const ageMonths = differenceInMonths(new Date(), new Date(baby.birthDate));
    const expectedSleep = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    if (sleepMins > 0 && sleepMins / 60 < expectedSleep * 0.7) {
      items.push({
        id: 'low-sleep',
        type: 'alert',
        title: 'Sleep Total Low Today',
        description: `Only ${Math.floor(sleepMins / 60)}h logged. Aim for ~${expectedSleep}h for ${ageMonths}mo.`,
        emoji: '😴',
        color: '#6366f1',
        priority: 'medium',
        action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } },
        timestamp: now,
      });
    }

    const uniqueDays = new Set(entries.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))).size;
    if (uniqueDays >= 7) {
      items.push({
        id: 'tracking-streak',
        type: 'streak',
        title: `${uniqueDays}-Day Tracking Streak!`,
        description: 'Great consistency! Your data is getting richer and predictions more accurate.',
        emoji: '🔥',
        color: '#f59e0b',
        priority: 'low',
        action: { label: 'View Stats', screen: 'Timeline' },
        timestamp: now,
      });
    }

    const growthEntries = entries.filter(e => e.trackerId === 'growth');
    if (growthEntries.length > 0) {
      const lastGrowth = Math.max(...growthEntries.map(e => e.timestamp));
      const daysSince = differenceInDays(new Date(), new Date(lastGrowth));
      if (daysSince > 14) {
        items.push({
          id: 'growth-check',
          type: 'prediction',
          title: 'Growth Check Due',
          description: `Last measurement was ${daysSince} days ago. Time for a new measurement!`,
          emoji: '📏',
          color: '#43e97b',
          priority: 'low',
          action: { label: 'Measure', screen: 'AddEntry', params: { trackerId: 'growth' } },
          timestamp: now,
        });
      }
    }

    const milestoneEntries = entries.filter(e => e.trackerId === 'milestone');
    if (milestoneEntries.length === 0 && ageMonths >= 3) {
      items.push({
        id: 'first-milestone',
        type: 'tip',
        title: 'Log First Milestone',
        description: 'At this age, babies start reaching exciting milestones. Log them to track progress!',
        emoji: '🏆',
        color: '#ffd700',
        priority: 'low',
        action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } },
        timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }).slice(0, 4);
  }, [entries, baby]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Smart Insights" subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`} colors={themeColors} textColor={textColors.text} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hubStyles.insightsScroll}>
        {insights.map((insight) => (
          <TouchableOpacity
            key={insight.id}
            onPress={() => onInsightPress(insight)}
            style={[hubStyles.insightCard, { borderLeftColor: insight.color, borderLeftWidth: 3 }]}
          >
            <LinearGradient
              colors={[`${insight.color}08`, `${insight.color}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={hubStyles.insightTop}>
              <Text style={hubStyles.insightEmoji}>{insight.emoji}</Text>
              <View style={[hubStyles.insightPriorityDot, { backgroundColor: insight.color }]} />
            </View>
            <Text style={[hubStyles.insightTitle, { color: textColors.text }]} numberOfLines={1}>{insight.title}</Text>
            <Text style={[hubStyles.insightDesc, { color: textColors.textSecondary }]} numberOfLines={2}>{insight.description}</Text>
            {insight.action && (
              <View style={[hubStyles.insightActionBadge, { backgroundColor: `${themeColors.primary}10` }]}>
                <Text style={[hubStyles.insightActionText, { color: themeColors.primary }]}>{insight.action.label} →</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
SmartInsightsCarousel.displayName = 'SmartInsightsCarousel';

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: QUICK ACTION FAB GRID
   Redesigned tracker cards as a sleek horizontal scroll with category grouping
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionFabGrid = React.memo(({ 
  trackerCards, 
  themeColors, 
  textColors, 
  onTrackerPress, 
  onCustomPress 
}: { 
  trackerCards: any[]; 
  themeColors: any; 
  textColors: any; 
  onTrackerPress: (id: string, hasSub: boolean) => void;
  onCustomPress: () => void;
}) => {
  const categories = ['essential', 'health', 'development', 'care'];

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Trackers" subtitle={`${trackerCards.length} active`} colors={themeColors} textColor={textColors.text} action={onCustomPress} actionLabel="Custom" />

      {categories.map(cat => {
        const catTrackers = trackerCards.filter(t => t.category === cat);
        if (catTrackers.length === 0) return null;

        return (
          <View key={cat} style={hubStyles.trackerCategorySection}>
            <View style={hubStyles.trackerCategoryHeader}>
              <View style={[hubStyles.trackerCategoryDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
              <Text style={[hubStyles.trackerCategoryLabel, { color: textColors.textSecondary }]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hubStyles.trackerScroll}>
              {catTrackers.map((tracker, i) => (
                <TouchableOpacity
                  key={tracker.id}
                  onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)}
                  style={hubStyles.trackerFabCard}
                >
                  <LinearGradient
                    colors={tracker.gradient}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={hubStyles.trackerFabContent}>
                    <Text style={hubStyles.trackerFabEmoji}>{tracker.emoji}</Text>
                    <Text style={hubStyles.trackerFabTitle}>{tracker.title}</Text>
                    <View style={hubStyles.trackerFabMeta}>
                      <Text style={hubStyles.trackerFabCount}>{tracker.count}</Text>
                      {tracker.lastEntry && (
                        <Text style={hubStyles.trackerFabLast}>{tracker.lastEntry}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[hubStyles.trackerFabArrow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </Animated.View>
  );
});
QuickActionFabGrid.displayName = 'QuickActionFabGrid';

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ACTION MODAL (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackerActionModal = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity',
    category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[hubStyles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose}>
        <Animated.View
          style={[hubStyles.modalContent, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={config.gradient}
            style={[hubStyles.modalHeader, {
              borderTopLeftRadius: borderRadiusValue * 2,
              borderTopRightRadius: borderRadiusValue * 2,
            }]}
          >
            <View style={hubStyles.modalHeaderContent}>
              <Text style={hubStyles.modalEmoji}>{config.emoji}</Text>
              <Text style={hubStyles.modalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={hubStyles.modalDescription}>{config.description}</Text>
            </View>
            <TouchableOpacity style={hubStyles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={[hubStyles.modalBody, { backgroundColor: fullThemeColors.surface }]}>
            <Text style={[hubStyles.modalSectionTitle, { color: fullThemeColors.textSecondary }]}>
              WHAT WOULD YOU LIKE TO LOG?
            </Text>
            <View style={hubStyles.subActionsGrid}>
              {config.subActions.map((action, index) => (
                <Animated.View
                  key={action.id}
                  entering={FadeInUp.delay(index * 60).springify()}
                  style={{ width: '50%', padding: 6 }}
                >
                  <TouchableOpacity
                    style={[hubStyles.subActionCard, {
                      backgroundColor: fullThemeColors.glassBg,
                      borderColor: `${action.color}30`,
                      borderRadius: borderRadiusValue,
                      borderWidth: 1.5,
                    }]}
                    onPress={() => onSelect(trackerId, action)}
                    activeOpacity={0.8}
                  >
                    <View style={[hubStyles.subActionIcon, { backgroundColor: `${action.color}15` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[hubStyles.subActionLabel, { color: fullThemeColors.text }]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
TrackerActionModal.displayName = 'TrackerActionModal';

/* ═══════════════════════════════════════════════════════════════════════════
   BABY SWITCHER PILL (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const BabySwitcherPill = React.memo(({ baby, onPress, isDark }: { baby: BabyProfile | null; onPress: () => void; isDark: boolean }) => {
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={hubStyles.babyPill}>
      <LinearGradient
        colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeBabyAvatar avatar={baby?.avatar} gender={baby?.gender} size={36} showBadge={false} />
      <View style={hubStyles.babyPillText}>
        <Text style={[hubStyles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
          {safeStr(baby?.name, 'Baby')}
        </Text>
        <Text style={[hubStyles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {age.shortDisplay}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
    </TouchableOpacity>
  );
});
BabySwitcherPill.displayName = 'BabySwitcherPill';

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY SUMMARY BAR (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const TodaySummaryBar = React.memo(({ todayCount, entries, themeColors, textColors, isDark }: any) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayEntries = useMemo(() =>
    entries.filter((e: any) => e?.timestamp >= today),
    [entries, today]
  );

  const lastEntry = todayEntries[0];
  const timeSinceLast = lastEntry ? formatDistanceToNow(lastEntry.timestamp) : null;

  const trackerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayEntries.forEach((e: any) => {
      counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 3);
  }, [todayEntries]);

  return (
    <GlassCard style={hubStyles.todayBar}>
      <View style={hubStyles.todayBarLeft}>
        <View style={[hubStyles.todayBarIcon, { backgroundColor: `${themeColors.primary}20` }]}>
          <Ionicons name="today-outline" size={18} color={themeColors.primary} />
        </View>
        <View>
          <Text style={[hubStyles.todayBarCount, { color: textColors.text }]}>
            {safeNum(todayCount, 0)}{' '}
            <Text style={{ fontSize: 13, fontWeight: '600', color: textColors.textSecondary }}>
              entries today
            </Text>
          </Text>
          {timeSinceLast && (
            <Text style={[hubStyles.todayBarLast, { color: textColors.textSecondary }]}>
              Last: {timeSinceLast}
            </Text>
          )}
        </View>
      </View>
      <View style={hubStyles.todayBarDots}>
        {trackerCounts.map(([trackerId, count]: any) => {
          const config = TRACKER_CONFIGS[trackerId];
          return (
            <View key={trackerId} style={[hubStyles.todayBarDot, { backgroundColor: config?.color || themeColors.primary }]}>
              <Text style={hubStyles.todayBarDotText}>{config?.emoji || '📋'} {count}</Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
});
TodaySummaryBar.displayName = 'TodaySummaryBar';

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR (Redesigned — Bottom Navigation Style)
   ═══════════════════════════════════════════════════════════════════════════ */

const BottomTabBar = React.memo(({ tabs, activeTab, onChange, themeColors, textColors, isDark }: any) => (
  <View style={[hubStyles.bottomTabBar, { backgroundColor: isDark ? 'rgba(30,30,45,0.95)' : 'rgba(255,255,255,0.95)' }]}>
    {tabs.map((tab: any) => {
      const isActive = activeTab === tab.id;
      return (
        <TouchableOpacity
          key={tab.id}
          onPress={() => { HAPTIC_LIGHT(); onChange(tab.id); }}
          style={[hubStyles.bottomTabItem, isActive && hubStyles.bottomTabItemActive]}
          activeOpacity={0.8}
        >
          <View style={[hubStyles.bottomTabIconWrap, isActive && { backgroundColor: `${themeColors.primary}15` }]}>
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? themeColors.primary : textColors.textSecondary}
            />
          </View>
          <Text style={[hubStyles.bottomTabLabel, { color: isActive ? themeColors.primary : textColors.textSecondary }]}>
            {tab.label}
          </Text>
          {isActive && <View style={[hubStyles.bottomTabIndicator, { backgroundColor: themeColors.primary }]} />}
        </TouchableOpacity>
      );
    })}
  </View>
));
BottomTabBar.displayName = 'BottomTabBar';

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK LOG STRIP (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickLogStrip = React.memo(({ onQuickLog, themeColors, textColors }: any) => {
  const shortcuts = [
    { trackerId: 'feed', subActionId: 'breast_left', label: 'Feed L', icon: 'arrow-back-outline' as const, color: '#f472b6' },
    { trackerId: 'feed', subActionId: 'breast_right', label: 'Feed R', icon: 'arrow-forward-outline' as const, color: '#f472b6' },
    { trackerId: 'sleep', subActionId: 'nap', label: 'Nap', icon: 'sunny-outline' as const, color: '#10b981' },
    { trackerId: 'diaper', subActionId: 'wet', label: 'Wet', icon: 'water-outline' as const, color: '#3b82f6' },
    { trackerId: 'diaper', subActionId: 'dirty', label: 'Dirty', icon: 'flame-outline' as const, color: '#8B4513' },
    { trackerId: 'pumping', subActionId: 'both', label: 'Pump', icon: 'swap-horizontal-outline' as const, color: '#ec4899' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Quick Log" subtitle="One-tap actions" colors={themeColors} textColor={textColors.text} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hubStyles.quickLogScroll}>
        {shortcuts.map((shortcut) => (
          <TouchableOpacity
            key={`${shortcut.trackerId}-${shortcut.subActionId}`}
            onPress={() => onQuickLog(shortcut.trackerId, shortcut.subActionId)}
            style={[hubStyles.quickLogChip, { borderColor: `${shortcut.color}25` }]}
          >
            <LinearGradient
              colors={[`${shortcut.color}10`, `${shortcut.color}03`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name={shortcut.icon} size={18} color={shortcut.color} />
            <Text style={[hubStyles.quickLogLabel, { color: shortcut.color }]}>{shortcut.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
QuickLogStrip.displayName = 'QuickLogStrip';

/* ═══════════════════════════════════════════════════════════════════════════
   RECENT ACTIVITY STRIP (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const RecentActivityStrip = React.memo(({ entries, onViewAll, onEntryPress, themeColors, textColors }: any) => {
  const recent = useMemo(() =>
    [...entries].sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 8),
    [entries]
  );

  if (recent.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader title="Recent Activity" subtitle="Latest logs" colors={themeColors} textColor={textColors.text} action={onViewAll} actionLabel="Timeline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hubStyles.recentScroll}>
        {recent.map((entry: any, index: number) => {
          const config = TRACKER_CONFIGS[entry.trackerId];
          return (
            <Animated.View key={entry.id} entering={FadeIn.delay(index * 50)} style={{ marginRight: 10 }}>
              <TouchableOpacity
                onPress={() => onEntryPress(entry)}
                style={[hubStyles.recentCard, { borderColor: `${config?.color || themeColors.primary}25` }]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[`${config?.color || themeColors.primary}12`, `${config?.color || themeColors.primary}04`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={hubStyles.recentEmoji}>{config?.emoji || '📋'}</Text>
                <Text style={[hubStyles.recentTitle, { color: textColors.text }]} numberOfLines={1}>
                  {safeStr(entry.title, 'Entry')}
                </Text>
                <Text style={[hubStyles.recentTime, { color: textColors.textSecondary }]}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});
RecentActivityStrip.displayName = 'RecentActivityStrip';

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK TAB: ALL ACTIONS GRID (Redesigned)
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionsFull = React.memo(({ onSubActionSelect, getEntries, themeColors, textColors, isDark }: any) => {
  return (
    <Animated.View entering={SlideInRight.duration(300)}>
      <View style={hubStyles.quickActionsFull}>
        <Text style={[hubStyles.sectionTitle, { color: textColors.text, marginBottom: 16, marginHorizontal: 16 }]}>
          All Quick Actions
        </Text>

        {Object.entries(TRACKER_CONFIGS).map(([trackerId, config]: [string, any]) => (
          <View key={trackerId} style={[hubStyles.quickActionGroup, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
            borderRadius: 20,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}>
            <View style={hubStyles.quickActionGroupHeader}>
              <Text style={hubStyles.quickActionGroupEmoji}>{config.emoji}</Text>
              <Text style={[hubStyles.quickActionGroupTitle, { color: textColors.text }]}>
                {trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}
              </Text>
              <View style={[hubStyles.quickActionGroupBadge, { backgroundColor: `${config.color}15` }]}>
                <Text style={[hubStyles.quickActionGroupBadgeText, { color: config.color }]}>
                  {getEntries(trackerId).length}
                </Text>
              </View>
            </View>
            <View style={hubStyles.quickActionGroupButtons}>
              {config.subActions.map((action: TrackerSubAction) => (
                <TouchableOpacity
                  key={action.id}
                  style={[hubStyles.quickActionFullBtn, {
                    backgroundColor: `${action.color}10`,
                    borderColor: `${action.color}20`,
                    borderRadius: 14,
                  }]}
                  onPress={() => onSubActionSelect(trackerId, action)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={action.icon} size={20} color={action.color} />
                  <Text style={[hubStyles.quickActionFullLabel, { color: action.color }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});
QuickActionsFull.displayName = 'QuickActionsFull';

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

const InsightsTab = React.memo(({ entries, baby, themeColors, textColors, onInsightPress }: any) => {
  const insights = useMemo((): SmartInsight[] => {
    if (!baby) return [];
    const items: SmartInsight[] = [];
    const now = Date.now();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEntries = entries.filter((e: any) => e?.timestamp >= today.getTime());

    const feedEntries = entries.filter((e: any) => e.trackerId === 'feed').sort((a: any, b: any) => b.timestamp - a.timestamp);
    if (feedEntries.length >= 2) {
      const gap = (feedEntries[0].timestamp - feedEntries[1].timestamp) / 3600000;
      if (gap > 4) {
        items.push({
          id: 'feed-gap',
          type: 'alert',
          title: 'Long Gap Between Feeds',
          description: `It's been ${Math.floor(gap)} hours since the last feed. Consider offering a feed soon.`,
          emoji: '⏰',
          color: '#f59e0b',
          priority: 'medium',
          action: { label: 'Log Feed', screen: 'AddEntry', params: { trackerId: 'feed' } },
          timestamp: now,
        });
      }
    }

    const sleepMins = todayEntries.filter((e: any) => e.trackerId === 'sleep').reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
    const ageMonths = differenceInMonths(new Date(), new Date(baby.birthDate));
    const expectedSleep = ageMonths < 3 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
    if (sleepMins > 0 && sleepMins / 60 < expectedSleep * 0.7) {
      items.push({
        id: 'low-sleep',
        type: 'alert',
        title: 'Sleep Total Low Today',
        description: `Only ${Math.floor(sleepMins / 60)}h logged. Aim for ~${expectedSleep}h for ${ageMonths}mo.`,
        emoji: '😴',
        color: '#6366f1',
        priority: 'medium',
        action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } },
        timestamp: now,
      });
    }

    const uniqueDays = new Set(entries.map((e: any) => format(new Date(e.timestamp), 'yyyy-MM-dd'))).size;
    if (uniqueDays >= 7) {
      items.push({
        id: 'tracking-streak',
        type: 'streak',
        title: `${uniqueDays}-Day Tracking Streak!`,
        description: 'Great consistency! Your data is getting richer and predictions more accurate.',
        emoji: '🔥',
        color: '#f59e0b',
        priority: 'low',
        action: { label: 'View Stats', screen: 'Timeline' },
        timestamp: now,
      });
    }

    const growthEntries = entries.filter((e: any) => e.trackerId === 'growth');
    if (growthEntries.length > 0) {
      const lastGrowth = Math.max(...growthEntries.map((e: any) => e.timestamp));
      const daysSince = differenceInDays(new Date(), new Date(lastGrowth));
      if (daysSince > 14) {
        items.push({
          id: 'growth-check',
          type: 'prediction',
          title: 'Growth Check Due',
          description: `Last measurement was ${daysSince} days ago. Time for a new measurement!`,
          emoji: '📏',
          color: '#43e97b',
          priority: 'low',
          action: { label: 'Measure', screen: 'AddEntry', params: { trackerId: 'growth' } },
          timestamp: now,
        });
      }
    }

    const milestoneEntries = entries.filter((e: any) => e.trackerId === 'milestone');
    if (milestoneEntries.length === 0 && ageMonths >= 3) {
      items.push({
        id: 'first-milestone',
        type: 'tip',
        title: 'Log First Milestone',
        description: 'At this age, babies start reaching exciting milestones. Log them to track progress!',
        emoji: '🏆',
        color: '#ffd700',
        priority: 'low',
        action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } },
        timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [entries, baby]);

  if (insights.length === 0) {
    return (
      <Animated.View entering={SlideInRight.duration(300)} style={{ paddingHorizontal: 16, paddingTop: 40 }}>
        <GlassCard style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="analytics-outline" size={48} color={textColors.textSecondary} />
          <Text style={[hubStyles.sectionTitle, { color: textColors.text, marginTop: 16 }]}>No Insights Yet</Text>
          <Text style={[hubStyles.sectionSubtitle, { color: textColors.textSecondary, textAlign: 'center' }]}>
            Keep tracking daily to get personalized AI insights and recommendations.
          </Text>
        </GlassCard>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={SlideInRight.duration(300)} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Text style={[hubStyles.sectionTitle, { color: textColors.text, marginBottom: 16 }]}>
        All Insights
      </Text>
      {insights.map((insight: SmartInsight, i: number) => (
        <Animated.View key={insight.id} entering={FadeInUp.delay(i * 60).springify()}>
          <TouchableOpacity
            onPress={() => onInsightPress(insight)}
            style={[hubStyles.insightCardFull, { borderLeftColor: insight.color, borderLeftWidth: 3, marginBottom: 10 }]}
          >
            <LinearGradient
              colors={[`${insight.color}08`, `${insight.color}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={hubStyles.insightFullTop}>
              <View style={[hubStyles.insightFullIconBg, { backgroundColor: `${insight.color}12` }]}>
                <Text style={hubStyles.insightFullEmoji}>{insight.emoji}</Text>
              </View>
              <View style={hubStyles.insightFullContent}>
                <View style={hubStyles.insightFullHeader}>
                  <Text style={[hubStyles.insightFullTitle, { color: textColors.text }]} numberOfLines={1}>{insight.title}</Text>
                  <View style={[hubStyles.insightFullPriority, { backgroundColor: insight.color }]} />
                </View>
                <Text style={[hubStyles.insightFullDesc, { color: textColors.textSecondary }]} numberOfLines={2}>{insight.description}</Text>
                {insight.action && (
                  <View style={[hubStyles.insightFullActionBadge, { backgroundColor: `${themeColors.primary}10` }]}>
                    <Text style={[hubStyles.insightFullActionText, { color: themeColors.primary }]}>{insight.action.label} →</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );
});
InsightsTab.displayName = 'InsightsTab';

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY TAB
   ═══════════════════════════════════════════════════════════════════════════ */

const FamilyTab = React.memo(({ entries, themeColors, textColors, isDark, onViewAll }: any) => {
  const activities = useMemo((): FamilyActivity[] => {
    return entries
      .filter((e: any) => e.recordedBy && e.recordedBy !== 'You')
      .slice(0, 10)
      .map((e: any, i: number) => ({
        id: e.id || `act-${i}`,
        userName: e.recordedBy || 'Family',
        userAvatar: e.userAvatar,
        action: e.title || `${e.trackerId} logged`,
        trackerEmoji: TRACKER_CONFIGS[e.trackerId]?.emoji || '📋',
        timeAgo: formatDistanceToNow(e.timestamp),
        babyName: e.babyName || 'Baby',
      }));
  }, [entries]);

  return (
    <Animated.View entering={SlideInRight.duration(300)} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Text style={[hubStyles.sectionTitle, { color: textColors.text, marginBottom: 16 }]}>
        Family Activity
      </Text>

      {activities.length === 0 ? (
        <GlassCard style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="people-outline" size={48} color={textColors.textSecondary} />
          <Text style={[hubStyles.sectionTitle, { color: textColors.text, marginTop: 16 }]}>No Family Activity</Text>
          <Text style={[hubStyles.sectionSubtitle, { color: textColors.textSecondary, textAlign: 'center' }]}>
            When family members log entries, they will appear here.
          </Text>
        </GlassCard>
      ) : (
        <GlassCard>
          {activities.map((act: FamilyActivity, i: number) => (
            <View key={act.id} style={[hubStyles.activityRow, i < activities.length - 1 && hubStyles.activityRowBorder]}>
              <View style={[hubStyles.activityAvatar, { backgroundColor: `${themeColors.primary}15` }]}>
                <Text style={hubStyles.activityAvatarText}>{act.userName.charAt(0)}</Text>
              </View>
              <View style={hubStyles.activityContent}>
                <Text style={[hubStyles.activityName, { color: textColors.text }]}>
                  <Text style={{ fontWeight: '800' }}>{act.userName}</Text> logged {act.action}
                </Text>
                <Text style={[hubStyles.activityMeta, { color: textColors.textSecondary }]}>
                  {act.trackerEmoji} {act.babyName} • {act.timeAgo}
                </Text>
              </View>
              <Text style={hubStyles.activityEmoji}>{act.trackerEmoji}</Text>
            </View>
          ))}
        </GlassCard>
      )}
    </Animated.View>
  );
});
FamilyTab.displayName = 'FamilyTab';

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — COMPLETE REDESIGN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<HubNavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    triggerHaptic,
    fontSizeMultiplier,
  } = useCustomization();
  const { entries, getEntries, trackers } = useTracker();
  const { stats, streak, growthScore } = useTrackerAchievements();
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError, confirm: showConfirm } = useSweetAlert();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsRefreshing(true);
      try {
        await loadBabies();
      } catch (err) {
        if (isMountedRef.current) {
          showError('Error', 'Failed to load baby profiles');
        }
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    };
    init();
  }, [loadBabies, showError]);

  useEffect(() => {
    const refresh = async () => {
      if (currentBaby) await refreshCurrentBaby();
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [currentBaby, refreshCurrentBaby]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayCount = useMemo(() =>
    entries.filter((e: any) => e?.timestamp >= today).length,
    [entries, today]
  );

  const trackerCards = useMemo(() => {
    const sourceTrackers = trackers?.length > 0
      ? trackers
      : Object.keys(TRACKER_CONFIGS).map(id => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          emoji: TRACKER_CONFIGS[id].emoji,
          color: TRACKER_CONFIGS[id].color,
          gradient: TRACKER_CONFIGS[id].gradient,
          category: TRACKER_CONFIGS[id].category,
        }));

    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const config = TRACKER_CONFIGS[id];
      const entriesForTracker = getEntries(id);
      const lastEntry = entriesForTracker[0];
      return {
        id,
        title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: (tracker.gradient || config?.gradient || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries]);

  // Handlers
  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowActionModal(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowActionModal(false);
    setTimeout(() => navigation.navigate('AddEntry', { trackerId, presetData: action.presetData }), 100);
  }, [navigation]);

  const handleQuickLog = useCallback((trackerId: string, subActionId: string) => {
    const config = TRACKER_CONFIGS[trackerId];
    const action = config?.subActions.find(a => a.id === subActionId);
    if (action) handleSubActionSelect(trackerId, action);
  }, [handleSubActionSelect]);

  const handleSwitchBaby = useCallback(() => {
    HAPTIC_LIGHT();
    if (babies.length > 1) {
      navigation.navigate('SwitchBaby');
    } else {
      showConfirm(
        'Switch Baby Profile',
        'You only have one baby profile. Would you like to add another?',
        () => navigation.navigate('CreateBabyProfile'),
        () => {},
        'Add New',
        'Cancel'
      );
    }
  }, [babies.length, navigation, showConfirm]);

  const handleViewTimeline = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('Timeline');
  }, [navigation]);

  const handleViewAchievements = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('Achievements');
  }, [navigation]);

  const handleCreateCustom = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  const handleEntryPress = useCallback((entry: any) => {
    navigation.navigate('AddEntry', { viewMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [navigation]);

  const handleInsightPress = useCallback((insight: SmartInsight) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen as never, insight.action.params as never);
    }
  }, [navigation]);

  const handleTabChange = useCallback((tab: TabType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleGoalPress = useCallback((trackerId: string) => {
    HAPTIC_LIGHT();
    handleTrackerPress(trackerId, true);
  }, [handleTrackerPress]);

  if (babyLoading && !currentBaby) {
    return (
      <View style={[hubStyles.container, {
        backgroundColor: fullThemeColors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 16, color: fullThemeColors.textSecondary, fontSize: 16 }}>
          Loading baby profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[hubStyles.container, { backgroundColor: fullThemeColors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark
          ? [fullThemeColors.background, fullThemeColors.surface]
          : ['#f8fafc', '#e2e8f0', '#dbeafe']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View style={[hubStyles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[hubStyles.stickyTitle, { color: fullThemeColors.text }]}>
          {safeStr(currentBaby?.name, 'Baby')}'s Hub
        </Text>
        <Text style={[hubStyles.stickySubtitle, { color: fullThemeColors.textSecondary }]}>
          {format(new Date(), 'EEEE, MMM d')}
        </Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={hubStyles.topHeader}>
          <TouchableOpacity
            style={[hubStyles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
            onPress={() => { HAPTIC_LIGHT(); navigation.navigate('Settings'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={22} color={fullThemeColors.textSecondary} />
          </TouchableOpacity>

          <BabySwitcherPill
            baby={currentBaby}
            onPress={handleSwitchBaby}
            isDark={isDark}
          />

          <TouchableOpacity
            style={[hubStyles.addBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleCreateCustom}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── TAB CONTENT ── */}
        {activeTab === 'home' && (
          <Animated.View entering={SlideInRight.duration(300)}>
            {/* Today Summary */}
            <TodaySummaryBar
              todayCount={todayCount}
              entries={entries}
              themeColors={themeColors}
              textColors={fullThemeColors}
              isDark={isDark}
            />

            {/* NEW FEATURE 1: AI Next Event Predictor */}
            <NextEventPredictor
              entries={entries}
              themeColors={themeColors}
              textColors={fullThemeColors}
              onEventPress={handleSubActionSelect}
            />

            {/* NEW FEATURE 2: Smart Daily Goals */}
            <SmartDailyGoals
              entries={entries}
              themeColors={themeColors}
              textColors={fullThemeColors}
              onGoalPress={handleGoalPress}
            />

            {/* NEW FEATURE 4: Intelligent Routine Suggestions */}
            <RoutineSuggestions
              baby={currentBaby}
              entries={entries}
              themeColors={themeColors}
              textColors={fullThemeColors}
              onRoutinePress={handleSubActionSelect}
            />

            {/* NEW FEATURE 5: Smart Insights Carousel */}
            <SmartInsightsCarousel
              entries={entries}
              baby={currentBaby}
              themeColors={themeColors}
              textColors={fullThemeColors}
              onInsightPress={handleInsightPress}
            />

            {/* NEW FEATURE 6: Quick Action FAB Grid */}
            <QuickActionFabGrid
              trackerCards={trackerCards}
              themeColors={themeColors}
              textColors={fullThemeColors}
              onTrackerPress={handleTrackerPress}
              onCustomPress={handleCreateCustom}
            />

            {/* Quick Log Strip */}
            <QuickLogStrip
              onQuickLog={handleQuickLog}
              themeColors={themeColors}
              textColors={fullThemeColors}
            />

            {/* Recent Activity */}
            <RecentActivityStrip
              entries={entries}
              onViewAll={handleViewTimeline}
              onEntryPress={handleEntryPress}
              themeColors={themeColors}
              textColors={fullThemeColors}
            />
          </Animated.View>
        )}

        {activeTab === 'quick' && (
          <QuickActionsFull
            onSubActionSelect={handleSubActionSelect}
            getEntries={getEntries}
            themeColors={themeColors}
            textColors={fullThemeColors}
            isDark={isDark}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsTab
            entries={entries}
            baby={currentBaby}
            themeColors={themeColors}
            textColors={fullThemeColors}
            onInsightPress={handleInsightPress}
          />
        )}

        {activeTab === 'family' && (
          <FamilyTab
            entries={entries}
            themeColors={themeColors}
            textColors={fullThemeColors}
            isDark={isDark}
            onViewAll={handleViewTimeline}
          />
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ── BOTTOM TAB BAR ── */}
      <BottomTabBar
        tabs={TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        themeColors={themeColors}
        textColors={fullThemeColors}
        isDark={isDark}
      />

      {/* ── MODALS ── */}
      <TrackerActionModal
        visible={showActionModal}
        trackerId={selectedTrackerId}
        onClose={() => setShowActionModal(false)}
        onSelect={handleSubActionSelect}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned to match GrowthDashboard aesthetic
   ═══════════════════════════════════════════════════════════════════════════ */

const hubStyles = StyleSheet.create({
  container: { flex: 1 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DESIGN.shadow.md,
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

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Baby Switcher Pill ──
  babyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,126,234,0.15)',
    flex: 1,
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },

  // ── Today Summary Bar ──
  todayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  todayBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBarCount: { fontSize: 15, fontWeight: '700' },
  todayBarLast: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  todayBarDots: { flexDirection: 'row', gap: 6 },
  todayBarDot: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBarDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // ── Predictor Cards (New Feature 1) ──
  predictorScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  predictorCard: {
    width: 150,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...DESIGN.shadow.md,
  },
  predictorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  predictorEmoji: { fontSize: 24 },
  predictorConfidenceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  predictorConfidenceText: { fontSize: 10, fontWeight: '800' },
  predictorLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  predictorTime: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  predictorPredicted: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  predictorBarBg: { height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' },
  predictorBarFill: { height: '100%', borderRadius: 2 },

  // ── Daily Goals (New Feature 2) ──
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  goalCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...DESIGN.shadow.md,
  },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  goalIcon: { fontSize: 22 },
  goalCompleteBadge: { padding: 4, borderRadius: 8 },
  goalCurrent: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  goalTarget: { fontSize: 14, fontWeight: '600' },
  goalLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalBarWrap: { marginTop: 8 },
  goalBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 3 },

  // ── Routine Suggestions (New Feature 4) ──
  routineList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...DESIGN.shadow.sm,
  },
  routineIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routineEmoji: { fontSize: 22 },
  routineContent: { flex: 1 },
  routineLabel: { fontSize: 14, fontWeight: '700' },
  routineTime: { fontSize: 12, fontWeight: '500', marginTop: 1, opacity: 0.7 },

  // ── Smart Insights Carousel (New Feature 5) ──
  insightsScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  insightCard: {
    width: 200,
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    ...DESIGN.shadow.md,
  },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  insightEmoji: { fontSize: 22 },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  insightActionText: { fontSize: 11, fontWeight: '700' },

  // ── Insight Card Full (Insights Tab) ──
  insightCardFull: {
    padding: 14,
    borderRadius: 16,
    overflow: 'hidden',
    ...DESIGN.shadow.sm,
  },
  insightFullTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightFullIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightFullEmoji: { fontSize: 20 },
  insightFullContent: { flex: 1, gap: 3 },
  insightFullHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightFullTitle: { fontSize: 14, fontWeight: '700' },
  insightFullPriority: { width: 4, height: 36, borderRadius: 2 },
  insightFullDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  insightFullActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  insightFullActionText: { fontSize: 11, fontWeight: '700' },

  // ── Quick Action FAB Grid (New Feature 6) ──
  trackerCategorySection: { marginBottom: 16 },
  trackerCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10 },
  trackerCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  trackerCategoryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  trackerScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  trackerFabCard: {
    width: 140,
    height: 120,
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    ...DESIGN.shadow.md,
  },
  trackerFabContent: { flex: 1, justifyContent: 'flex-end' },
  trackerFabEmoji: { fontSize: 28, marginBottom: 6 },
  trackerFabTitle: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  trackerFabMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trackerFabCount: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  trackerFabLast: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  trackerFabArrow: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Quick Log Strip ──
  quickLogScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  quickLogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...DESIGN.shadow.sm,
  },
  quickLogLabel: { fontWeight: '700', fontSize: 12 },

  // ── Recent Activity ──
  recentScroll: { paddingHorizontal: 16, paddingBottom: 4 },
  recentCard: {
    width: 110,
    height: 90,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    ...DESIGN.shadow.sm,
  },
  recentEmoji: { fontSize: 22, marginBottom: 4 },
  recentTitle: { fontWeight: '700', letterSpacing: -0.2, fontSize: 13 },
  recentTime: { fontWeight: '500', marginTop: 2, fontSize: 11 },

  // ── Family Activity Feed ──
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityAvatarText: { fontSize: 14, fontWeight: '800', color: '#667eea' },
  activityContent: { flex: 1, gap: 2 },
  activityName: { fontSize: 13, fontWeight: '500' },
  activityMeta: { fontSize: 11, fontWeight: '500' },
  activityEmoji: { fontSize: 18 },

  // ── Quick Actions Full ──
  quickActionsFull: { marginBottom: 20 },
  quickActionGroup: {
    marginBottom: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    ...DESIGN.shadow.sm,
  },
  quickActionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  quickActionGroupEmoji: { fontSize: 20 },
  quickActionGroupTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  quickActionGroupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickActionGroupBadgeText: { fontSize: 12, fontWeight: '700' },
  quickActionGroupButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: '45%',
    justifyContent: 'center',
  },
  quickActionFullLabel: { fontSize: 12, fontWeight: '700' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
    ...DESIGN.shadow.lg,
  },
  modalHeader: {
    padding: 20,
    paddingTop: 24,
    alignItems: 'center',
  },
  modalHeaderContent: { alignItems: 'center' },
  modalEmoji: { fontSize: 44, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalDescription: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 14 },
  modalSectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 2,
    fontSize: 12,
  },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: {
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  subActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },

  // ── Bottom Tab Bar ──
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    ...DESIGN.shadow.lg,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
  },
  bottomTabItemActive: {},
  bottomTabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  bottomTabLabel: { fontSize: 11, fontWeight: '600' },
  bottomTabIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
  },
});