
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { useCustomization } from '../../hooks/useCustomization';
import {  Alert, Button, Dimensions, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  Layout,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { format, isSameDay, differenceInHours } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

import { useUnifiedTrackerTheme } from '@/hooks/useUnifiedTrackerTheme';
import { AutoHideAnimatedScrollView } from '@/components/AutoHideScrollWrappers';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';
import { TrackerEntry, UnifiedTrackerConfig } from '@/types/trackers';
import { SafeAvatar } from '@/components/SafeAvatar';
import { useSweetAlert } from '@/components/SweetAlert';
import { TimelinePicker } from '@/components/trackers/TimelinePicker';

import { usePredictiveReminders, PredictiveReminder } from '@/hooks/usePredictiveReminders';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTrackerAchievements } from '@/hooks/useTrackerAchievements';
import { useTrackerProgressive } from '@/hooks/useTrackerProgressive';

const { width } = Dimensions.get('window');

type TimelineScreenRouteProp = RouteProp<RootStackParamList, 'Timeline'>;
type TimelineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SmartSection {
  id: string;
  type: 'insight' | 'correlation' | 'reminder' | 'achievement' | 'streak' | 'growth';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  component: React.ReactNode;
}

const getDateTitle = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';

  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek[date.getDay()] ?? 'Unknown';
  }
  return format(date, 'MMM d, yyyy');
};

const getTrackerIcon = (trackerId: string): string => {
  const iconMap: Record<string, string> = {
    potty: 'water-outline',
    feed: 'nutrition-outline',
    sleep: 'moon-outline',
    growth: 'trending-up-outline',
    milestone: 'trophy-outline',
    medication: 'medical-outline',
    diaper: 'shirt-outline',
    pumping: 'swap-horizontal-outline',
    temperature: 'thermometer-outline',
    symptom: 'pulse-outline',
    note: 'document-text-outline',
    play: 'game-controller-outline',
    reading: 'book-outline',
    tummy_time: 'fitness-outline',
    mood: 'happy-outline',
  };
  return iconMap[trackerId] || 'cube-outline';
};

const getPriorityColor = (priority: string, theme: any) => {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'high': return '#f59e0b';
    case 'normal': return theme.primary;
    case 'low': return theme.text.muted;
    default: return theme.primary;
  }
};

const getRarityGradient = (rarity: string): [string, string] => {
  switch (rarity) {
    case 'legendary': return ['#f59e0b', '#ef4444'];
    case 'epic': return ['#8b5cf6', '#6366f1'];
    case 'rare': return ['#06b6d4', '#3b82f6'];
    default: return ['#10b981', '#22c55e'];
  }
};

const safeArray = <T,>(arr: T[] | undefined | null): T[] => arr || [];
const safeString = (s: string | undefined | null): string => s || '';
const safeNumber = (n: number | undefined | null, fallback = 0): number => {
  if (n === undefined || n === null || Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return n;
};

/**
 * SmartInsightCard — Displays AI-generated insights with action buttons
 */
const SmartInsightCard: React.FC<{
  insight: any;
  theme: any;
  onAction: (trackerId: string) => void;
  onDismiss: () => void;
  index: number;
}> = ({ insight, theme, onAction, onDismiss, index }) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return 'warning-outline';
      case 'pattern': return 'git-branch-outline';
      case 'milestone': return 'trophy-outline';
      case 'correlation': return 'link-outline';
      case 'suggestion': return 'bulb-outline';
      default: return 'information-circle-outline';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'warning': return 'rgba(239,68,68,0.12)';
      case 'good': return 'rgba(16,185,129,0.12)';
      case 'info': return 'rgba(59,130,246,0.12)';
      default: return theme.surface.card;
    }
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80).springify()}
      layout={Layout.springify()}
      style={[styles.smartCard, { backgroundColor: getPriorityBg(insight?.priority) }]}
    >
      <View style={styles.smartCardHeader}>
        <View style={[styles.smartIconContainer, { backgroundColor: `${insight?.priority === 'warning' ? '#ef4444' : theme.primary}20` }]}>
          <Ionicons
            name={getInsightIcon(insight?.type) as any}
            size={20}
            color={insight?.priority === 'warning' ? '#ef4444' : theme.primary}
          />
        </View>
        <View style={styles.smartCardContent}>
          <Text style={[styles.smartCardTitle, { color: theme.text.primary }]}>
            {insight?.emoji} {insight?.title}
          </Text>
          <Text style={[styles.smartCardDesc, { color: theme.text.secondary }]} numberOfLines={2}>
            {insight?.description}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Ionicons name="close" size={18} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      {insight?.action && (
        <TouchableOpacity
          style={[styles.smartActionBtn, { backgroundColor: `${theme.primary}15` }]}
          onPress={() => onAction(insight.action.trackerId)}
        >
          <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
          <Text style={[styles.smartActionText, { color: theme.primary }]}>
            {insight.action.message}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

/**
 * SmartCorrelationCard — Shows cross-tracker pattern discoveries
 */
const SmartCorrelationCard: React.FC<{
  correlation: TimelineCorrelation;
  theme: any;
  onNavigate: (trackerId: string) => void;
  index: number;
}> = ({ correlation, theme, onNavigate, index }) => {
  const getCorrelationIcon = (type: string) => {
    switch (type) {
      case 'feed_sleep_pattern': return ['🍼', '😴'];
      case 'growth_milestone_correlation': return ['📏', '🏆'];
      case 'health_alert': return ['🌡️', '💊'];
      case 'activity_cluster': return ['⚡', '🔗'];
      default: return ['🔗', '✨'];
    }
  };

  const [icon1, icon2] = getCorrelationIcon(correlation?.type || '');
  const safeConfidence = safeNumber(correlation?.confidence, 0);
  const safeColor = correlation?.color || theme.primary;
  const primaryTs = correlation?.primaryEntry?.timestamp || 0;
  const relatedId = correlation?.relatedEntry?.trackerId || '';

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).springify()}
      style={[styles.correlationCard, { borderColor: `${safeColor}40` }]}
    >
      <LinearGradient
        colors={[`${safeColor}08`, `${safeColor}02`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.correlationHeader}>
        <View style={styles.correlationIcons}>
          <Text style={styles.correlationEmoji}>{icon1}</Text>
          <View style={[styles.correlationLink, { backgroundColor: safeColor }]}>
            <Ionicons name="link" size={10} color="#fff" />
          </View>
          <Text style={styles.correlationEmoji}>{icon2}</Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: `${safeColor}20` }]}>
          <Text style={[styles.confidenceText, { color: safeColor }]}>
            {safeConfidence}% match
          </Text>
        </View>
      </View>
      <Text style={[styles.correlationInsight, { color: theme.text.primary }]}>
        {correlation?.insight || 'Pattern detected'}
      </Text>
      <View style={styles.correlationMeta}>
        <Text style={[styles.correlationTime, { color: theme.text.muted }]}>
          <Ionicons name="time-outline" size={12} /> {primaryTs ? format(primaryTs, 'MMM d, h:mm a') : 'Unknown time'}
        </Text>
        <TouchableOpacity
          style={[styles.correlationAction, { backgroundColor: `${safeColor}15` }]}
          onPress={() => onNavigate(relatedId)}
        >
          <Text style={[styles.correlationActionText, { color: safeColor }]}>
            View {relatedId}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

/**
 * SmartReminderCard — Predictive reminders with smart actions
 */
const SmartReminderCard: React.FC<{
  reminder: PredictiveReminder;
  theme: any;
  onApply: (reminder: PredictiveReminder) => void;
  onDismiss: (id: string) => void;
  index: number;
}> = ({ reminder, theme, onApply, onDismiss, index }) => {
  const suggestedTime = reminder?.suggestedTime;
  const isOverdue = suggestedTime && new Date(suggestedTime) < new Date();
  const hoursUntil = suggestedTime
    ? Math.max(0, differenceInHours(new Date(suggestedTime), new Date()))
    : null;

  const safePriority = reminder?.priority || 'normal';
  const safeId = reminder?.id || `reminder-${index}`;
  const actionLabel = reminder?.action?.label || 'Apply';

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 120).springify()}
      style={[
        styles.reminderCard,
        {
          borderLeftColor: getPriorityColor(safePriority, theme),
          borderLeftWidth: 4,
          backgroundColor: isOverdue ? 'rgba(239,68,68,0.06)' : theme.surface.card,
        },
      ]}
    >
      <View style={styles.reminderHeader}>
        <Text style={styles.reminderEmoji}>{reminder?.emoji || '⏰'}</Text>
        <View style={styles.reminderContent}>
          <Text style={[styles.reminderTitle, { color: theme.text.primary }]}>
            {reminder?.title || 'Reminder'}
          </Text>
          <Text style={[styles.reminderDesc, { color: theme.text.secondary }]} numberOfLines={2}>
            {reminder?.description || ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onDismiss(safeId)} style={styles.dismissBtn}>
          <Ionicons name="close" size={18} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.reminderMeta}>
        {suggestedTime && (
          <View style={styles.reminderTimeBadge}>
            <Ionicons name="time-outline" size={12} color={isOverdue ? '#ef4444' : theme.primary} />
            <Text style={[styles.reminderTimeText, { color: isOverdue ? '#ef4444' : theme.primary }]}>
              {isOverdue ? 'Overdue' : hoursUntil === 0 ? 'Due now' : `In ${hoursUntil}h`}
            </Text>
          </View>
        )}
        <View style={[styles.confidenceBadge, { backgroundColor: `${theme.primary}15` }]}>
          <Ionicons name="analytics-outline" size={12} color={theme.primary} />
          <Text style={[styles.confidenceText, { color: theme.primary }]}>
            {safeNumber(reminder?.confidence, 0)}% confidence
          </Text>
        </View>
      </View>

      <View style={styles.reminderActions}>
        <TouchableOpacity
          style={[styles.reminderActionBtn, { backgroundColor: theme.primary }]}
          onPress={() => onApply(reminder)}
        >
          <Ionicons name={actionLabel === 'Log Feed' ? 'nutrition' : 'add'} size={16} color="#fff" />
          <Text style={styles.reminderActionText}>{actionLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reminderActionBtnSecondary, { borderColor: `${theme.primary}30` }]}
          onPress={() => {
          }}
        >
          <Text style={[styles.reminderActionTextSecondary, { color: theme.primary }]}>
            Details
          </Text>
        </TouchableOpacity>
      </View>

      {reminder?.basedOn && reminder.basedOn.length > 0 && (
        <View style={styles.basedOnContainer}>
          <Text style={[styles.basedOnLabel, { color: theme.text.muted }]}>Based on:</Text>
          {safeArray(reminder.basedOn).map((b, i) => (
            <View key={i} style={[styles.basedOnChip, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="analytics-outline" size={10} color={theme.primary} />
              <Text style={[styles.basedOnText, { color: theme.primary }]}>
                {b?.dataPoint || 'Data'}: {b?.value || 'N/A'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
};

/**
 * GrowthScoreCard — Live growth intelligence dashboard
 */
const GrowthScoreCard: React.FC<{
  growthIndex: any;
  theme: any;
  onPress: () => void;
}> = ({ growthIndex, theme, onPress }) => {
  if (!growthIndex) return null;

  const nutritionScore = growthIndex?.nutritionScore;
  const restScore = growthIndex?.restScore;
  const physicalScore = growthIndex?.physicalScore;
  const cognitiveScore = growthIndex?.cognitiveScore;
  const healthStability = growthIndex?.healthStability;
  const compositeIndex = safeNumber(growthIndex?.compositeIndex, 0);

  const scores = [
    { label: 'Nutrition', score: nutritionScore, icon: '🍎', color: '#FF9F43' },
    { label: 'Rest', score: restScore, icon: '😴', color: '#5F27CD' },
    { label: 'Physical', score: physicalScore, icon: '💪', color: '#10AC84' },
    { label: 'Cognitive', score: cognitiveScore, icon: '🧠', color: '#FFD700' },
    { label: 'Health', score: healthStability, icon: '❤️', color: '#EE5A24' },
  ];

  const getScoreColor = (value: number) => {
    if (value >= 80) return '#10b981';
    if (value >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const safeMilestones = safeArray(growthIndex?.milestoneReadiness);

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[`${theme.primary}15`, `${theme.secondary}08`]}
          style={[styles.growthCard, { borderRadius: theme.borderRadiusValue || 20 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.growthHeader}>
            <View style={styles.growthTitleRow}>
              <Text style={styles.growthEmoji}>📊</Text>
              <Text style={[styles.growthTitle, { color: theme.text.primary }]}>
                Growth Intelligence
              </Text>
            </View>
            <View style={[styles.compositeBadge, { backgroundColor: `${getScoreColor(compositeIndex)}20` }]}>
              <Text style={[styles.compositeText, { color: getScoreColor(compositeIndex) }]}>
                {compositeIndex}
              </Text>
            </View>
          </View>

          <View style={styles.scoresGrid}>
            {scores.map((item) => (
              <View key={item.label} style={styles.scoreItem}>
                <Text style={styles.scoreEmoji}>{item.icon}</Text>
                <View style={styles.scoreBarContainer}>
                  <View
                    style={[
                      styles.scoreBar,
                      {
                        width: `${safeNumber(item.score?.value, 0)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.scoreValue, { color: theme.text.primary }]}>
                  {safeNumber(item.score?.value, 0)}
                </Text>
                <Text style={[styles.scoreLabel, { color: theme.text.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {safeMilestones.length > 0 && (
            <View style={styles.milestonePreview}>
              <Text style={[styles.milestonePreviewTitle, { color: theme.text.secondary }]}>
                🎯 Upcoming Milestones
              </Text>
              {safeMilestones.slice(0, 2).map((m: any, idx: number) => (
                <View key={idx} style={styles.milestoneRow}>
                  <View style={styles.milestoneProgressBg}>
                    <View
                      style={[
                        styles.milestoneProgressFill,
                        { width: `${safeNumber(m?.readinessPercent, 0)}%`, backgroundColor: safeNumber(m?.readinessPercent, 0) > 80 ? '#10b981' : '#f59e0b' },
                      ]}
                    />
                  </View>
                  <Text style={[styles.milestoneText, { color: theme.text.primary }]}>
                    {m?.category || 'Milestone'} — {safeNumber(m?.readinessPercent, 0)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * AchievementToast — Shows newly unlocked achievements
 */
const AchievementToast: React.FC<{
  achievements: any[];
  theme: any;
  onDismiss: () => void;
}> = ({ achievements, theme, onDismiss }) => {
  const safeAchievements = safeArray(achievements);
  if (safeAchievements.length === 0) return null;

  const first = safeAchievements[0] || {};

  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeInUp} style={styles.achievementToast}>
      <LinearGradient
        colors={getRarityGradient(first?.rarity || 'common')}
        style={styles.achievementToastGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.achievementToastEmoji}>🎉</Text>
        <View style={styles.achievementToastContent}>
          <Text style={styles.achievementToastTitle}>Achievement Unlocked!</Text>
          <Text style={styles.achievementToastName}>
            {first?.emoji || '🏆'} {first?.title || 'Achievement'}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

/**
 * StreakBanner — Shows current streak status with urgency
 */
const StreakBanner: React.FC<{
  streak: any;
  theme: any;
  onAction: () => void;
}> = ({ streak, theme, onAction }) => {
  if (!streak || streak.currentStreak === 0) return null;

  const isAtRisk = streak?.streakAtRisk;
  const progress = Math.min(safeNumber(streak?.currentStreak, 0) / 30, 1);

  return (
    <Animated.View entering={FadeInUp.springify()}>
      <TouchableOpacity
        onPress={onAction}
        style={[
          styles.streakBanner,
          {
            backgroundColor: isAtRisk ? 'rgba(239,68,68,0.08)' : `${theme.primary}08`,
            borderColor: isAtRisk ? 'rgba(239,68,68,0.2)' : `${theme.primary}15`,
          },
        ]}
      >
        <View style={styles.streakIconContainer}>
          <Text style={styles.streakEmoji}>{isAtRisk ? '⏰' : '🔥'}</Text>
          {isAtRisk && (
            <View style={styles.streakPulse}>
              <View style={[styles.pulseRing, { borderColor: '#ef4444' }]} />
            </View>
          )}
        </View>
        <View style={styles.streakContent}>
          <Text style={[styles.streakTitle, { color: isAtRisk ? '#ef4444' : theme.text.primary }]}>
            {isAtRisk ? 'Streak at Risk!' : `${safeNumber(streak?.currentStreak, 0)} Day Streak`}
          </Text>
          <Text style={[styles.streakSubtitle, { color: theme.text.secondary }]}>
            {isAtRisk
              ? `Log an entry in ${safeNumber(streak?.hoursUntilBreak, 0)}h to keep it alive`
              : `Best: ${safeNumber(streak?.longestStreak, 0)} days • Keep it up!`}
          </Text>
          <View style={styles.streakProgressBg}>
            <View
              style={[
                styles.streakProgressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: isAtRisk ? '#ef4444' : theme.primary,
                },
              ]}
            />
          </View>
        </View>
        <Ionicons
          name={isAtRisk ? 'alert-circle' : 'chevron-forward'}
          size={20}
          color={isAtRisk ? '#ef4444' : theme.text.muted}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function EnhancedTimelineScreen() {
  const navigation = useNavigation<TimelineScreenNavigationProp>();
  const route = useRoute<TimelineScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();
  const { triggerHaptic, borderRadiusValue, shouldReduceMotion, fontSizeMultiplier } = useCustomization();

  const {
    entries,
    isLoading,
    refreshEntries,
    deleteEntry,
    getTracker,
    getEntries,
    currentBabyId,
    currentBaby,
  } = useTracker();
  const { success, confirm } = useSweetAlert();

  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { reminders: predictiveReminders } = usePredictiveReminders();
  const { growthIndex } = useGrowthIntelligence();
  const {
    achievements,
    stats: achievementStats,
    streak: globalStreak,
    newlyUnlocked,
    isLoading: achievementsLoading,
  } = useTrackerAchievements();

  const scrollY = useSharedValue(0);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTimelinePicker, setShowTimelinePicker] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [showAchievementToast, setShowAchievementToast] = useState(false);

  useEffect(() => {
    if (route.params?.filter) setSelectedFilter(route.params.filter);
  }, [route.params]);

  useEffect(() => {
    const safeNewlyUnlocked = safeArray(newlyUnlocked);
    if (safeNewlyUnlocked.length > 0) {
      setShowAchievementToast(true);
      triggerHaptic('success');
      const timer = setTimeout(() => setShowAchievementToast(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [newlyUnlocked, triggerHaptic]);

  const allEntries = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    return [...entries].sort((a, b) => b.timestamp - a.timestamp);
  }, [entries]);

  const { insights: allInsights, dismissInsight } = useTrackerProgressive(
    selectedFilter === 'all' ? 'feed' : selectedFilter
  );

  const activeInsights = useMemo(() => {
    return safeArray(allInsights).filter(i => !dismissedInsights.has(i?.id));
  }, [allInsights, dismissedInsights]);

  const activeReminders = useMemo(() => {
    return safeArray(predictiveReminders).filter(r => !dismissedReminders.has(r?.id));
  }, [predictiveReminders, dismissedReminders]);

  const smartSections = useMemo((): SmartSection[] => {
    const sections: SmartSection[] = [];

    if (globalStreak?.streakAtRisk) {
      sections.push({
        id: 'streak-urgent',
        type: 'streak',
        priority: 'urgent',
        component: (
          <StreakBanner
            streak={globalStreak}
            theme={theme}
            onAction={() => setShowTimelinePicker(true)}
          />
        ),
      });
    }

    activeInsights
      .filter(i => i?.priority === 'warning' || i?.type === 'anomaly')
      .forEach((insight, idx) => {
        sections.push({
          id: `insight-${insight?.id || idx}`,
          type: 'insight',
          priority: 'high',
          component: (
            <SmartInsightCard
              key={insight?.id || idx}
              insight={insight}
              theme={theme}
              onAction={(trackerId) => navigation.navigate('AddEntry', { trackerId })}
              onDismiss={() => {
                if (insight?.id) {
                  setDismissedInsights(prev => new Set([...prev, insight.id]));
                  dismissInsight(insight.id);
                }
              }}
              index={idx}
            />
          ),
        });
      });

    activeReminders
      .filter(r => r?.suggestedTime && new Date(r.suggestedTime) < new Date())
      .forEach((reminder, idx) => {
        sections.push({
          id: `reminder-${reminder?.id || idx}`,
          type: 'reminder',
          priority: 'high',
          component: (
            <SmartReminderCard
              key={reminder?.id || idx}
              reminder={reminder}
              theme={theme}
              onApply={(r) => {
                navigation.navigate('AddEntry', {
                  trackerId: r?.action?.params?.trackerId as string,
                });
              }}
              onDismiss={(id) => setDismissedReminders(prev => new Set([...prev, id]))}
              index={idx}
            />
          ),
        });
      });

    if (growthIndex) {
      sections.push({
        id: 'growth-score',
        type: 'growth',
        priority: 'normal',
        component: (
          <GrowthScoreCard
            growthIndex={growthIndex}
            theme={theme}
            onPress={() => navigation.navigate('GrowthDashboard')}
          />
        ),
      });
    }

    activeReminders
      .filter(r => !r?.suggestedTime || new Date(r.suggestedTime) >= new Date())
      .slice(0, 3)
      .forEach((reminder, idx) => {
        sections.push({
          id: `reminder-${reminder?.id || idx}`,
          type: 'reminder',
          priority: 'normal',
          component: (
            <SmartReminderCard
              key={reminder?.id || idx}
              reminder={reminder}
              theme={theme}
              onApply={(r) => {
                navigation.navigate('AddEntry', {
                  trackerId: r?.action?.params?.trackerId as string,
                });
              }}
              onDismiss={(id) => setDismissedReminders(prev => new Set([...prev, id]))}
              index={idx}
            />
          ),
        });
      });

    activeInsights
      .filter(i => i?.priority !== 'warning' && i?.type !== 'anomaly')
      .forEach((insight, idx) => {
        sections.push({
          id: `insight-${insight?.id || idx}`,
          type: 'insight',
          priority: 'normal',
          component: (
            <SmartInsightCard
              key={insight?.id || idx}
              insight={insight}
              theme={theme}
              onAction={(trackerId) => navigation.navigate('AddEntry', { trackerId })}
              onDismiss={() => {
                if (insight?.id) {
                  setDismissedInsights(prev => new Set([...prev, insight.id]));
                  dismissInsight(insight.id);
                }
              }}
              index={idx}
            />
          ),
        });
      });

    safeArray(timelineCorrelations).slice(0, 3).forEach((correlation, idx) => {
      sections.push({
        id: `correlation-${correlation?.id || idx}`,
        type: 'correlation',
        priority: 'low',
        component: (
          <SmartCorrelationCard
            key={correlation?.id || idx}
            correlation={correlation}
            theme={theme}
            onNavigate={(trackerId) => navigation.navigate('AddEntry', { trackerId })}
            index={idx}
          />
        ),
      });
    });

    if (globalStreak?.currentStreak > 0 && !globalStreak?.streakAtRisk) {
      sections.push({
        id: 'streak-normal',
        type: 'streak',
        priority: 'low',
        component: (
          <StreakBanner
            streak={globalStreak}
            theme={theme}
            onAction={() => setShowTimelinePicker(true)}
          />
        ),
      });
    }

    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return sections.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [
    globalStreak,
    activeInsights,
    activeReminders,
    growthIndex,
    timelineCorrelations,
    theme,
    navigation,
    dismissInsight,
  ]);

  const groupedEvents = useMemo(() => {
    let filtered = allEntries;

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(e => e?.trackerId === selectedFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        safeString(e?.title).toLowerCase().includes(query) ||
        safeString(e?.notes).toLowerCase().includes(query) ||
        safeString(e?.trackerId).toLowerCase().includes(query)
      );
    }

    const groups: { title: string; date: Date; events: TrackerEntry[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    filtered.forEach(event => {
      if (!event?.timestamp) return;
      const eventDate = new Date(event.timestamp);
      if (!currentGroup || !isSameDay(currentGroup.date, eventDate)) {
        currentGroup = { title: getDateTitle(event.timestamp), date: eventDate, events: [] };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });

    return groups;
  }, [allEntries, selectedFilter, searchQuery]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const safeAchievementStats = achievementStats || {};
    return {
      today: allEntries.filter(e => e?.timestamp >= todayStart).length,
      total: allEntries.length,
      milestones: safeArray(getEntries('milestone')).length,
      achievements: safeNumber(safeAchievementStats.unlocked, 0),
      growthScore: safeNumber(growthIndex?.compositeIndex, 0),
    };
  }, [allEntries, getEntries, achievementStats, growthIndex]);

  const filterChips = useMemo(() => {
    const base = [
      { id: 'all', label: 'All', icon: 'grid-outline', color: theme.primary },
    ];
    const uniqueTrackerIds = [...new Set(safeArray(allEntries).map(e => e?.trackerId).filter(Boolean))];
    const trackerChips = uniqueTrackerIds.map(id => {
      const tracker = getTracker(id);
      return {
        id,
        label: tracker?.name || id,
        icon: getTrackerIcon(id),
        color: tracker?.gradient?.[0] || tracker?.color || theme.primary,
      };
    });
    return [...base, ...trackerChips];
  }, [allEntries, getTracker, theme.primary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEntries();
    setRefreshing(false);
  }, [refreshEntries]);

  const handleEditEvent = useCallback((entry: TrackerEntry) => {
    triggerHaptic('light');
    navigation.navigate('AddEntry', { editMode: true, eventId: entry?.id, trackerId: entry?.trackerId });
  }, [navigation, triggerHaptic]);

  const handleDeleteEvent = useCallback((entry: TrackerEntry) => {
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete "${entry?.title || 'entry'}"? This cannot be undone.`,
      async () => {
        if (entry?.id) {
          await deleteEntry(entry.id);
          triggerHaptic('success');
          success('Deleted', 'Entry removed');
        }
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [deleteEntry, triggerHaptic, confirm, success]);

  const handleEventPress = useCallback((entry: TrackerEntry) => {
    navigation.navigate('AddEntry', { viewMode: true, eventId: entry?.id, trackerId: entry?.trackerId });
  }, [navigation]);

    const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  }, [scrollY]);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 100], [-20, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0']}
          style={styles.loadingGradient}
        >
          <SafeAvatar size={64} fallbackIcon="person" borderColor={theme.primary} borderWidth={3} animated />
          <Text style={[styles.loadingText, { color: theme.primary }]}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, { backgroundColor: theme.primary, opacity: 0.4 }]} />
            <View style={[styles.dot, { backgroundColor: theme.secondary, opacity: 0.7 }]} />
            <View style={[styles.dot, { backgroundColor: theme.accent, opacity: 1 }]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0', '#dbeafe']}
        style={styles.backgroundGradient}
      />

      {/* Achievement Toast */}
      {showAchievementToast && (
        <AchievementToast
          achievements={safeArray(achievements).filter(a => safeArray(newlyUnlocked).includes(a?.id))}
          theme={theme}
          onDismiss={() => setShowAchievementToast(false)}
        />
      )}

      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[`${theme.primary}15`, `${theme.secondary}08`, 'transparent']}
          style={styles.headerGradient}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerButton, { borderRadius: borderRadiusValue }]}
          >
            <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>

          <Animated.View style={[styles.headerCenter, titleAnimatedStyle]}>
            <SafeAvatar
              avatar={currentBaby?.avatar}
              size={36}
              fallbackIcon="person"
              borderColor={theme.surface.border}
              borderWidth={2}
              animated={false}
            />
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              🗓️ {format(new Date(), 'MMM d')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>
              {currentBaby?.name || 'Baby'} • {stats.today} today • {stats.achievements} 🏆
            </Text>
          </Animated.View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={[styles.headerButton, { borderRadius: borderRadiusValue }]}
            >
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={[styles.stickyHeader, headerAnimatedStyle, { top: insets.top + 8 }]}>
          <BlurView intensity={theme.isDark ? 40 : 90} style={[styles.stickyBlur, { borderRadius: borderRadiusValue }]} tint={theme.isDark ? 'dark' : 'light'}>
            <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>🗓️ Timeline</Text>
            <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>
              {stats.today} entries • {stats.achievements} achievements
            </Text>
          </BlurView>
        </Animated.View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary, theme.secondary]}
            progressViewOffset={insets.top + 140}
          />
        }
      >
        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeInDown} style={styles.searchContainer}>
            <BlurView intensity={theme.isDark ? 40 : 90} style={[styles.searchBlur, { borderRadius: borderRadiusValue }]} tint={theme.isDark ? 'dark' : 'light'}>
              <Ionicons name="search" size={20} color={theme.text.secondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text.primary, fontSize: 16 * fontSizeMultiplier }]}
                placeholder="Search entries..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.text.secondary}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {/* Smart Stats Overview */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.statsContainer}>
          <AutoHideAnimatedScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              style={[styles.statCard, styles.primaryStatCard, { borderRadius: borderRadiusValue }]}
            >
              <Text style={styles.statEmoji}>📊</Text>
              <Text style={[styles.primaryStatNumber, { fontSize: 36 * fontSizeMultiplier }]}>
                {stats.today}
              </Text>
              <Text style={styles.primaryStatLabel}>Today</Text>
            </LinearGradient>

            <View style={[styles.statCard, styles.secondaryStatCard, { borderRadius: borderRadiusValue, backgroundColor: theme.surface.card }]}>
              <Text style={styles.statEmoji}>📁</Text>
              <Text style={[styles.secondaryStatNumber, { color: theme.text.primary, fontSize: 24 * fontSizeMultiplier }]}>
                {stats.total}
              </Text>
              <Text style={[styles.secondaryStatLabel, { color: theme.text.secondary }]}>Total</Text>
            </View>

            <View style={[styles.statCard, styles.secondaryStatCard, { borderRadius: borderRadiusValue, backgroundColor: theme.surface.card }]}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={[styles.secondaryStatNumber, { color: '#f59e0b', fontSize: 24 * fontSizeMultiplier }]}>
                {stats.achievements}
              </Text>
              <Text style={[styles.secondaryStatLabel, { color: theme.text.secondary }]}>Achievements</Text>
            </View>

            <View style={[styles.statCard, styles.secondaryStatCard, { borderRadius: borderRadiusValue, backgroundColor: theme.surface.card }]}>
              <Text style={styles.statEmoji}>🌱</Text>
              <Text style={[styles.secondaryStatNumber, { color: '#10b981', fontSize: 24 * fontSizeMultiplier }]}>
                {stats.growthScore}
              </Text>
              <Text style={[styles.secondaryStatLabel, { color: theme.text.secondary }]}>Growth</Text>
            </View>
          </AutoHideAnimatedScrollView>
        </Animated.View>

        {/* ── SMART SECTIONS ── */}
        {smartSections.length > 0 && (
          <View style={styles.smartSectionsContainer}>
            <View style={styles.smartSectionHeader}>
              <Ionicons name="sparkles" size={16} color={theme.primary} />
              <Text style={[styles.smartSectionTitle, { color: theme.text.secondary }]}>
                Smart Insights
              </Text>
              {activeReminders.length > 0 && (
                <View style={[styles.badge, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.badgeText, { color: theme.primary }]}>{activeReminders.length}</Text>
                </View>
              )}
            </View>
            {smartSections.map((section) => (
              <View key={section.id} style={styles.smartSectionItem}>
                {section.component}
              </View>
            ))}
          </View>
        )}

        {/* Filter Chips */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.filterContainer}>
          <AutoHideAnimatedScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {filterChips.map((filter, index) => (
              <Animated.View key={filter.id} entering={FadeIn.delay(index * 50)}>
                <TouchableOpacity
                  onPress={() => { triggerHaptic('light'); setSelectedFilter(filter.id); }}
                  style={[
                    styles.filterChip,
                    {
                      borderRadius: borderRadiusValue,
                      backgroundColor: selectedFilter === filter.id ? filter.color : theme.surface.card,
                      borderColor: selectedFilter === filter.id ? filter.color : theme.surface.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={filter.icon as any} size={16} color={selectedFilter === filter.id ? '#fff' : filter.color} />
                  <Text style={[styles.filterText, selectedFilter === filter.id && { color: '#fff', fontWeight: '700' }]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </AutoHideAnimatedScrollView>
        </Animated.View>

        {/* Quick Add */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.quickAddContainer}>
          <Text style={[styles.quickAddTitle, { color: theme.text.secondary, fontSize: 13 * fontSizeMultiplier }]}>
            Quick Add
          </Text>
          <View style={styles.quickAddButtons}>
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: `${theme.primary}15`, borderRadius: borderRadiusValue }]}
              onPress={() => navigation.navigate('AddEntry', { trackerId: 'milestone' })}
            >
              <Ionicons name="trophy" size={18} color={theme.primary} />
              <Text style={[styles.quickAddText, { color: theme.primary }]}>Milestone</Text>
            </TouchableOpacity>
            {['feed', 'sleep', 'diaper'].map(id => {
              const tracker = getTracker(id);
              if (!tracker) return null;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.quickAddBtn, { backgroundColor: `${tracker.gradient?.[0] || tracker.color || theme.primary}15`, borderRadius: borderRadiusValue }]}
                  onPress={() => navigation.navigate('AddEntry', { trackerId: id })}
                >
                  <Ionicons name={getTrackerIcon(id) as any} size={18} color={tracker.gradient?.[0] || tracker.color || theme.primary} />
                  <Text style={[styles.quickAddText, { color: tracker.gradient?.[0] || tracker.color || theme.primary }]}>
                    {tracker.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Timeline Events */}
        <View style={styles.timelineContainer}>
          {groupedEvents.length === 0 ? (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.surface.card }]}>
                <Ionicons name="document-text-outline" size={64} color={theme.text.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary, fontSize: 22 * fontSizeMultiplier }]}>
                {searchQuery ? 'No matches found' : 'No entries yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.text.secondary, fontSize: 15 * fontSizeMultiplier }]}>
                {searchQuery ? 'Try adjusting your search' : "Start tracking with the + button"}
              </Text>
            </Animated.View>
          ) : (
            groupedEvents.map((group, groupIndex) => (
              <View key={group.title} style={styles.daySection}>
                <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(groupIndex * 100)}>
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeader, { color: theme.text.primary, fontSize: 18 * fontSizeMultiplier }]}>
                      {group.title}
                    </Text>
                    <View style={[styles.dateBadge, { backgroundColor: `${theme.primary}20` }]}>
                      <Text style={[styles.dateBadgeText, { color: theme.primary }]}>{group.events.length}</Text>
                    </View>
                  </View>

                  <View style={styles.eventsContainer}>
                    {group.events.map((event, eventIndex) => {
                      const tracker = getTracker(event?.trackerId);
                      if (!tracker) return null;
                      const isLast = eventIndex === group.events.length - 1;
                      const time = event?.timestamp ? format(event.timestamp, 'h:mm a') : '';

                      return (
                        <Animated.View
                          key={event?.id || `event-${groupIndex}-${eventIndex}`}
                          entering={FadeInUp.delay(groupIndex * 100 + eventIndex * 50).springify()}
                        >
                          <View style={styles.eventRow}>
                            <View style={styles.timeColumn}>
                              <Text style={[styles.timeText, { color: tracker.gradient?.[0] || tracker.color || theme.primary }]}>
                                {time}
                              </Text>
                              {!isLast && (
                                <View style={[styles.timelineLine, { backgroundColor: `${tracker.gradient?.[0] || tracker.color || theme.primary}30` }]} />
                              )}
                            </View>

                            <TouchableOpacity
                              style={styles.eventCardContainer}
                              onPress={() => handleEventPress(event)}
                              activeOpacity={0.9}
                            >
                              <View
                                style={[
                                  styles.eventCard,
                                  {
                                    backgroundColor: theme.surface.card,
                                    borderColor: theme.surface.border,
                                    borderRadius: borderRadiusValue,
                                  },
                                ]}
                              >
                                <View style={[styles.eventIconContainer, { backgroundColor: `${tracker.gradient?.[0] || tracker.color || theme.primary}15` }]}>
                                  <Text style={styles.eventIcon}>{tracker.emoji}</Text>
                                </View>
                                <View style={styles.eventContent}>
                                  <Text style={[styles.eventTitle, { color: theme.text.primary }]}>{event?.title || 'Entry'}</Text>
                                  {event?.notes && (
                                    <Text style={[styles.eventSubtitle, { color: theme.text.secondary }]} numberOfLines={2}>
                                      {event.notes}
                                    </Text>
                                  )}
                                  <View style={styles.eventMeta}>
                                    <Text style={[styles.eventTime, { color: theme.text.secondary }]}>
                                      {event?.timestamp ? format(event.timestamp, 'MMM d, h:mm a') : ''}
                                    </Text>
                                    {event?.loggedByName && (
                                      <Text style={[styles.eventAuthor, { color: theme.text.secondary }]}>
                                        by {event.loggedByName}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.eventActions}>
                                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEditEvent(event)}>
                                    <Ionicons name="create-outline" size={18} color={theme.text.secondary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteEvent(event)}>
                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </TouchableOpacity>
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                </Animated.View>
              </View>
            ))
          )}
          <View style={{ height: insets.bottom + 100 }} />
        </View>
      </Animated.ScrollView>

      {/* Floating Action Button */}
      <Animated.View
        entering={FadeIn.delay(600)}
        style={[styles.fabContainer, { bottom: insets.bottom + 20, right: 20 }]}
      >
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.primary, borderRadius: borderRadiusValue }]}
          onPress={() => setShowTimelinePicker(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue }]}
          />
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Timeline Picker Modal */}
      <TimelinePicker
        visible={showTimelinePicker}
        onClose={() => setShowTimelinePicker(false)}
        onSelect={(trackerId: string) => {
          setShowTimelinePicker(false);
          setTimeout(() => navigation.navigate('AddEntry', { trackerId }), 50);
        }}
        currentBabyName={currentBaby?.name}
        currentBabyAvatar={currentBaby?.avatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 32, fontWeight: '800', marginTop: 12 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },

  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  headerButton: { width: 48, height: 48, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: 10, gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  stickyHeader: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 80 },
  stickyBlur: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', minWidth: 200, overflow: 'hidden' },
  stickyTitle: { fontSize: 18, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '600' },

  searchContainer: { marginHorizontal: 20, marginBottom: 16, marginTop: 8 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
  searchInput: { flex: 1, marginLeft: 10, paddingVertical: 12 },

  statsContainer: { marginBottom: 16 },
  statsContent: { paddingHorizontal: 20, gap: 12 },
  statCard: { padding: 16, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  statEmoji: { fontSize: 28 },
  primaryStatCard: { width: 140, height: 140 },
  primaryStatNumber: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  primaryStatLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryStatCard: { width: 100, height: 140, borderWidth: 1 },
  secondaryStatNumber: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  secondaryStatLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  smartSectionsContainer: { marginHorizontal: 20, marginBottom: 20 },
  smartSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  smartSectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  smartSectionItem: { marginBottom: 10 },

  smartCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  smartCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  smartIconContainer: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smartCardContent: { flex: 1 },
  smartCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  smartCardDesc: { fontSize: 13, lineHeight: 18 },
  dismissBtn: { padding: 4 },
  smartActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start' },
  smartActionText: { fontSize: 13, fontWeight: '600' },

  correlationCard: { borderRadius: 16, padding: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  correlationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  correlationIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  correlationEmoji: { fontSize: 24 },
  correlationLink: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confidenceBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  confidenceText: { fontSize: 11, fontWeight: '700' },
  correlationInsight: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  correlationMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  correlationTime: { fontSize: 12, fontWeight: '500' },
  correlationAction: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  correlationActionText: { fontSize: 12, fontWeight: '600' },

  reminderCard: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  reminderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reminderEmoji: { fontSize: 28 },
  reminderContent: { flex: 1 },
  reminderTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  reminderDesc: { fontSize: 13, lineHeight: 18 },
  reminderMeta: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  reminderTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  reminderTimeText: { fontSize: 12, fontWeight: '600' },
  reminderActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reminderActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  reminderActionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  reminderActionBtnSecondary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  reminderActionTextSecondary: { fontSize: 13, fontWeight: '600' },
  basedOnContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  basedOnLabel: { fontSize: 11, fontWeight: '600' },
  basedOnChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  basedOnText: { fontSize: 10, fontWeight: '600' },

  growthCard: { padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  growthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  growthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growthEmoji: { fontSize: 24 },
  growthTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  compositeBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  compositeText: { fontSize: 16, fontWeight: '800' },
  scoresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scoreItem: { width: '47%', gap: 6 },
  scoreEmoji: { fontSize: 20 },
  scoreBarContainer: { height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  scoreBar: { height: '100%', borderRadius: 3 },
  scoreValue: { fontSize: 14, fontWeight: '800' },
  scoreLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  milestonePreview: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  milestonePreviewTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  milestoneProgressBg: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  milestoneProgressFill: { height: '100%', borderRadius: 3 },
  milestoneText: { fontSize: 12, fontWeight: '600', width: 100, textAlign: 'right' },

  achievementToast: { position: 'absolute', top: 100, left: 20, right: 20, zIndex: 200, borderRadius: 16, overflow: 'hidden' },
  achievementToastGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  achievementToastEmoji: { fontSize: 32 },
  achievementToastContent: { flex: 1 },
  achievementToastTitle: { fontSize: 13, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9 },
  achievementToastName: { fontSize: 16, fontWeight: '800', color: '#fff' },

  streakBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10, gap: 12 },
  streakIconContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  streakEmoji: { fontSize: 28 },
  streakPulse: { position: 'absolute', width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  pulseRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  streakContent: { flex: 1, gap: 4 },
  streakTitle: { fontSize: 15, fontWeight: '800' },
  streakSubtitle: { fontSize: 12, fontWeight: '500' },
  streakProgressBg: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  streakProgressFill: { height: '100%', borderRadius: 2 },

  scrollContent: { paddingBottom: 20 },
  filterContainer: { marginBottom: 16 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  quickAddContainer: { marginHorizontal: 20, marginBottom: 20 },
  quickAddTitle: { fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickAddButtons: { flexDirection: 'row', gap: 8 },
  quickAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  quickAddText: { fontSize: 13, fontWeight: '600' },

  timelineContainer: { paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontWeight: '500', textAlign: 'center', lineHeight: 22 },
  daySection: { marginBottom: 24 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateHeader: { fontWeight: '800', letterSpacing: -0.5 },
  dateBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  dateBadgeText: { fontSize: 12, fontWeight: '700' },
  eventsContainer: { gap: 0 },
  eventRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { width: 56, alignItems: 'flex-end', paddingTop: 16 },
  timeText: { fontSize: 12, fontWeight: '700' },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  eventCardContainer: { flex: 1, paddingBottom: 16 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, gap: 12 },
  eventIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  eventIcon: { fontSize: 20 },
  eventContent: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  eventSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  eventMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  eventTime: { fontSize: 11, fontWeight: '500' },
  eventAuthor: { fontSize: 11, fontWeight: '500' },
  eventActions: { flexDirection: 'row', gap: 4 },
  actionButton: { padding: 6 },

  fabContainer: { position: 'absolute', zIndex: 100 },
  fab: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
