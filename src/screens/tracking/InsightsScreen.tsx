import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
} from 'react-native';

import { useCustomization } from '../../hooks/useCustomization';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useTracker } from '../../context/TrackerContext';
import { useGrowthIntelligence } from '../../hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '../../hooks/useTimelineCorrelations';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';

import { useWHOGrowthCalculator } from '../../hooks/useWHOGrowthCalculator';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, formatDistanceToNow, isSameDay, subDays, differenceInHours, differenceInDays, differenceInMonths, parseISO, isValid } from 'date-fns';

import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Match HomeScreen & GrowthDashboard exactly
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 10, sm: 14, md: 18, lg: 22, xl: 28, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type InsightsScreenProps = NativeStackScreenProps<RootStackParamList, 'Insights'>;

interface InsightItem {
  id: string;
  type: 'milestone' | 'growth' | 'health' | 'sleep' | 'nutrition' | 'correlation' | 'achievement' | 'vaccination' | 'prediction' | 'pattern' | 'tip';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: keyof RootStackParamList; params?: any };
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PatternData {
  day: string;
  feeds: number;
  sleep: number;
  diapers: number;
  total: number;
}

interface WeeklyStats {
  totalActivities: number;
  avgDaily: number;
  mostActiveDay: string;
  streakDays: number;
  topCategory: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOLID CARD — HomeScreen style (NO BLUR, clean solid backgrounds)
   ═══════════════════════════════════════════════════════════════════════════ */

const SolidCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  active?: boolean;
  borderColor?: string;
}> = React.memo(({ children, style, onPress, active, borderColor }) => {
  const colorScheme = Platform.OS === 'ios' ? 'light' : 'light'; // simplified
  const isDark = false; // Will be overridden by theme prop in parent

  // We accept borderColor prop for theming
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.solidCard,
      active && { borderColor: borderColor || '#667eea', borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={['#ffffff', '#fafaff']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.solidCardBorder, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
      <View style={styles.solidCardContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — HomeScreen style
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
      {icon && <Ionicons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 10 }} />}
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
   INSIGHT CARD — Solid style, no blur
   ═══════════════════════════════════════════════════════════════════════════ */

const InsightCard: React.FC<{
  insight: InsightItem;
  theme: any;
  onPress: () => void;
  index: number;
  isDark: boolean;
}> = React.memo(({ insight, theme, onPress, index, isDark }) => (
  <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.85} 
      style={[
        styles.insightCard,
        insight.priority === 'high' && { borderLeftWidth: 3, borderLeftColor: insight.color },
        { 
          backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          /* no shadow */
        }
      ]}
    >
      <View style={styles.insightRow}>
        <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
          <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        </View>
        <View style={styles.insightContent}>
          <View style={styles.insightHeader}>
            <Text style={[styles.insightTitle, { color: theme.text }]} numberOfLines={1}>{insight.title}</Text>
            <Text style={[styles.insightTime, { color: theme.textMuted }]}>
              {formatDistanceToNow(insight.timestamp, { addSuffix: true })}
            </Text>
          </View>
          <Text style={[styles.insightDesc, { color: theme.textSecondary }]} numberOfLines={2}>{insight.description}</Text>
          {insight.action && (
            <View style={[styles.insightActionBadge, { backgroundColor: `${theme.primary}10` }]}>
              <Text style={[styles.insightActionText, { color: theme.primary }]}>{insight.action.label} →</Text>
            </View>
          )}
        </View>
        <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
      </View>
    </TouchableOpacity>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   WEEKLY PATTERN CHART — Solid bars, no blur
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyPatternChart: React.FC<{
  patterns: PatternData[];
  theme: any;
  isDark: boolean;
}> = React.memo(({ patterns, theme, isDark }) => {
  const maxTotal = Math.max(...patterns.map(d => d.total), 1);

  return (
    <View style={[
      styles.patternContainer, 
      { 
        backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }
    ]}>
      <View style={styles.patternBars}>
        {patterns.map((day, i) => {
          const barHeight = (day.total / maxTotal) * 100;
          const isToday = i === 6;

          return (
            <View key={day.day} style={styles.patternDay}>
              <View style={styles.patternBarContainer}>
                <View style={[
                  styles.patternBar, 
                  { 
                    height: `${Math.max(barHeight, 8)}%`, 
                    backgroundColor: isToday ? theme.primary : `${theme.primary}40` 
                  }
                ]} />
              </View>
              <Text style={[
                styles.patternDayLabel, 
                { 
                  color: isToday ? theme.primary : theme.textMuted, 
                  fontWeight: isToday ? '700' : '500' 
                }
              ]}>
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
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD — Solid mini cards for quick stats
   ═══════════════════════════════════════════════════════════════════════════ */

const StatCard: React.FC<{
  label: string;
  value: string;
  subvalue?: string;
  icon: string;
  color: string;
  theme: any;
  isDark: boolean;
  delay?: number;
}> = React.memo(({ label, value, subvalue, icon, color, theme, isDark, delay = 0 }) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={{ flex: 1 }}>
    <View style={[
      styles.statCard,
      { 
        backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        /* no shadow */
      }
    ]}>
      <View style={[styles.statIconBg, { backgroundColor: `${color}12` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      {subvalue && (
        <Text style={[styles.statSubvalue, { color: theme.textMuted }]}>{subvalue}</Text>
      )}
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   CATEGORY FILTER CHIP — Solid, no blur
   ═══════════════════════════════════════════════════════════════════════════ */

const CategoryFilter: React.FC<{
  categories: { key: string; label: string; icon: string; color: string }[];
  activeCategory: string;
  onChange: (cat: string) => void;
  theme: any;
  isDark: boolean;
}> = React.memo(({ categories, activeCategory, onChange, theme, isDark }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.categoryFilterScroll}
  >
    {categories.map((cat) => {
      const isActive = activeCategory === cat.key;
      return (
        <TouchableOpacity
          key={cat.key}
          onPress={() => onChange(cat.key)}
          style={[
            styles.categoryFilterChip,
            isActive && { backgroundColor: cat.color },
            !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
          ]}
        >
          <Ionicons 
            name={cat.icon as any} 
            size={13} 
            color={isActive ? '#fff' : theme.textSecondary} 
          />
          <Text style={[
            styles.categoryFilterText,
            { color: isActive ? '#fff' : theme.textSecondary },
            isActive && { fontWeight: '700' },
          ]}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN INSIGHTS SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function InsightsScreen({ navigation }: InsightsScreenProps) {
  const insets = useSafeAreaInsets();
  const { triggerHaptic, themeColors, darkMode, fontSizeMultiplier } = useCustomization();
  const { userProfile } = useAuth();
  const { currentBaby, growthData, milestones, babies, getGrowthData } = useBaby();
  const { entries: trackerEntries, getRecentTimelineEvents } = useActivity();
  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { achievements, newlyUnlocked, streak: globalStreak } = useTrackerAchievements();
  const { getInsights: getEngineInsights, getEntries: getTrackerEntries, refreshEntries } = useTracker();
  const { getPercentile, getStatus } = useWHOGrowthCalculator();
  const sweetAlert = useSweetAlert();

  const isDark = darkMode ?? false;
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const theme = useMemo(() => ({
    text: isDark ? '#f0f0f7' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    primary,
    secondary,
    accent,
    background: isDark ? '#08080f' : '#f4f6fa',
    surface: isDark ? '#12121e' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  }), [isDark, primary, secondary, accent]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

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

  /* ── Load dismissed insights ── */
  useEffect(() => {
    AsyncStorage.getItem('@littleloom_dismissed_insights').then(saved => {
      if (saved) {
        try {
          setDismissedIds(new Set(JSON.parse(saved)));
        } catch { /* ignore */ }
      }
    });
  }, []);

  const saveDismissed = useCallback((ids: Set<string>) => {
    AsyncStorage.setItem('@littleloom_dismissed_insights', JSON.stringify([...ids])).catch(() => {});
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
    triggerHaptic('light');
  }, [saveDismissed, triggerHaptic]);

  /* ── Generate all insights ── */
  const allInsights = useMemo((): InsightItem[] => {
    if (!currentBaby) return [];
    const items: InsightItem[] = [];
    const now = Date.now();
    const ageMonths = currentBaby.birthDate ? safeDiffMonths(new Date(), currentBaby.birthDate) : 0;

    // Growth Intelligence insights
    if (growthIndex) {
      if (growthIndex.nutritionScore?.value < 50) {
        items.push({
          id: 'gi-nutrition',
          type: 'nutrition',
          title: 'Nutrition Needs Attention',
          description: `Nutrition score is ${growthIndex.nutritionScore.value}/100. Consider reviewing feeding patterns and ensuring consistent meal times.`,
          emoji: '🍎',
          color: '#FF9F43',
          priority: 'high',
          action: { label: 'Track Feed', screen: 'UniversalTrackerHub', params: { type: 'feed' } },
          timestamp: now,
        });
      }
      if (growthIndex.restScore?.value < 50) {
        items.push({
          id: 'gi-sleep',
          type: 'sleep',
          title: 'Sleep Quality Low',
          description: `Rest score is ${growthIndex.restScore.value}/100. Check sleep schedule consistency and bedtime routine.`,
          emoji: '😴',
          color: '#5F27CD',
          priority: 'medium',
          action: { label: 'Track Sleep', screen: 'UniversalTrackerHub', params: { type: 'sleep' } },
          timestamp: now,
        });
      }
      if (growthIndex.milestoneReadiness?.length > 0) {
        const top = growthIndex.milestoneReadiness[0];
        items.push({
          id: 'gi-milestone',
          type: 'milestone',
          title: `${top.category} Milestone Ready!`,
          description: `${top.readinessPercent}% readiness for ${top.category} milestones. Watch for signs and encourage practice.`,
          emoji: '🎯',
          color: '#10AC84',
          priority: 'medium',
          action: { label: 'Log Milestone', screen: 'Achievements', params: {} },
          timestamp: now,
        });
      }
      if (growthIndex.physicalScore?.value > 80) {
        items.push({
          id: 'gi-physical-great',
          type: 'health',
          title: 'Physical Development Excelling',
          description: `Physical score is ${growthIndex.physicalScore.value}/100. ${currentBaby.name} is showing great motor skills!`,
          emoji: '💪',
          color: '#10b981',
          priority: 'low',
          timestamp: now,
        });
      }
    }

    // Timeline correlations
    timelineCorrelations.slice(0, 3).forEach((c, i) => {
      items.push({
        id: `corr-${c.id || i}`,
        type: 'correlation',
        title: 'Pattern Discovered',
        description: c.insight || 'New pattern found in your tracking data.',
        emoji: '🔗',
        color: '#54A0FF',
        priority: 'low',
        timestamp: now - i * 3600000,
      });
    });

    // Recent milestone
    const recentMilestone = [...milestones].sort((a, b) => {
      const da = safeParseDate(a.achievedAt);
      const db = safeParseDate(b.achievedAt);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })[0];
    if (recentMilestone && safeParseDate(recentMilestone.achievedAt) && safeDiffDays(new Date(), recentMilestone.achievedAt) < 7) {
      items.push({
        id: 'recent-milestone',
        type: 'milestone',
        title: 'New Milestone Achieved! 🌟',
        description: `${currentBaby.name} achieved "${recentMilestone.title}". Celebrate this win!`,
        emoji: '🏆',
        color: '#f59e0b',
        priority: 'high',
        action: { label: 'View Milestones', screen: 'Achievements', params: {} },
        timestamp: safeParseDate(recentMilestone.achievedAt)?.getTime() || now,
      });
    }

    // Growth drop alert
    const growthTypes = ['height', 'weight', 'head'] as const;
    growthTypes.forEach(type => {
      const typeData = getGrowthData(type);
      if (typeData.length >= 2) {
        const sorted = [...typeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        if (latest.value < prev.value) {
          const drop = ((prev.value - latest.value) / prev.value) * 100;
          if (drop > 5) {
            items.push({
              id: `growth-drop-${type}`,
              type: 'growth',
              title: `${type.charAt(0).toUpperCase() + type.slice(1)} Decrease Detected`,
              description: `Latest ${type} dropped ${drop.toFixed(1)}% from previous measurement. Please verify accuracy.`,
              emoji: '⚠️',
              color: '#ef4444',
              priority: 'high',
              action: { label: 'Re-measure', screen: 'GrowthDashboard', params: {} },
              timestamp: now,
            });
          }
        }
      }
    });

    // WHO percentile insights
    growthTypes.forEach(type => {
      const data = getGrowthData(type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0];
      if (latest) {
        const ageAt = Math.max(0, safeDiffMonths(latest.date, currentBaby.birthDate));
        const gender = currentBaby.gender === 'girl' ? 'girl' : 'boy';
        const percentile = getPercentile(latest.value, ageAt, type, gender);

        if (percentile < 5) {
          items.push({
            id: `who-low-${type}`,
            type: 'health',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Below 5th Percentile`,
            description: `${currentBaby.name}'s ${type} is at P${percentile}. Consider discussing with your pediatrician.`,
            emoji: '📉',
            color: '#ef4444',
            priority: 'high',
            action: { label: 'View Growth', screen: 'GrowthDashboard', params: {} },
            timestamp: now,
            metadata: { percentile, type },
          });
        } else if (percentile > 95) {
          items.push({
            id: `who-high-${type}`,
            type: 'health',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Above 95th Percentile`,
            description: `${currentBaby.name}'s ${type} is at P${percentile}. This is perfectly healthy but worth monitoring.`,
            emoji: '📈',
            color: '#3b82f6',
            priority: 'medium',
            action: { label: 'View Growth', screen: 'GrowthDashboard', params: {} },
            timestamp: now,
            metadata: { percentile, type },
          });
        }
      }
    });

    // Streak alerts
    if (globalStreak?.streakAtRisk && globalStreak.currentStreak > 0) {
      items.push({
        id: 'streak-risk',
        type: 'achievement',
        title: '🔥 Streak at Risk!',
        description: `Log an entry in ${globalStreak.hoursUntilBreak}h to keep your ${globalStreak.currentStreak}-day streak alive.`,
        emoji: '⏰',
        color: '#ef4444',
        priority: 'high',
        action: { label: 'Log Now', screen: 'UniversalTrackerHub', params: {} },
        timestamp: now,
      });
    }

    if (newlyUnlocked?.length > 0) {
      items.push({
        id: 'new-achievement',
        type: 'achievement',
        title: `Achievement Unlocked! 🎉`,
        description: `${newlyUnlocked.length} new achievement${newlyUnlocked.length > 1 ? 's' : ''} earned! Keep up the great tracking.`,
        emoji: '🏆',
        color: '#8b5cf6',
        priority: 'medium',
        action: { label: 'View All', screen: 'Achievements', params: {} },
        timestamp: now,
      });
    }

    // Age-based tips
    if (ageMonths < 3) {
      items.push({
        id: 'tip-newborn',
        type: 'tip',
        title: 'Newborn Feeding Tip',
        description: 'Feed every 2-3 hours. Look for hunger cues like rooting, sucking motions, and hand-to-mouth movements.',
        emoji: '🍼',
        color: '#fa709a',
        priority: 'low',
        timestamp: now,
      });
    } else if (ageMonths >= 6 && ageMonths < 9) {
      items.push({
        id: 'tip-solids',
        type: 'tip',
        title: 'Starting Solid Foods',
        description: 'Introduce single-ingredient purees. Wait 3-5 days between new foods to watch for allergies.',
        emoji: '🥄',
        color: '#10b981',
        priority: 'low',
        timestamp: now,
      });
    }

    // Sleep pattern insight
    const todaySleep = getTrackerEntries('sleep').filter((e: any) => isSameDay(new Date(e.timestamp), new Date()));
    if (todaySleep.length === 0 && new Date().getHours() > 14) {
      items.push({
        id: 'nap-reminder',
        type: 'sleep',
        title: 'Nap Check',
        description: `No naps logged for ${currentBaby.name} today. Most ${ageMonths}-month-olds need 2-3 naps.`,
        emoji: '😴',
        color: '#6366f1',
        priority: 'medium',
        action: { label: 'Track Sleep', screen: 'UniversalTrackerHub', params: { type: 'sleep' } },
        timestamp: now,
      });
    }

    // Tracker-engine insights (med streak, fever, sleep quality, feed-mood, growth reminder)
    getEngineInsights().forEach((i) => {
      items.push({
        id: `engine-${i.id}`,
        type: i.trackerId === 'sleep' ? 'sleep' : i.trackerId === 'feed' ? 'nutrition' : i.trackerId === 'growth' ? 'growth' : 'health',
        title: i.title,
        description: i.description,
        emoji: i.emoji || '💡',
        color: i.priority === 'warning' ? '#ef4444' : i.priority === 'good' ? '#10b981' : '#6366f1',
        priority: i.priority === 'warning' ? 'high' : i.priority === 'good' ? 'low' : 'medium',
        action: i.action?.trackerId
          ? { label: i.action.message || 'Log Now', screen: 'UniversalTrackerHub', params: { type: i.action.trackerId } }
          : undefined,
        timestamp: i.generatedAt || now,
      });
    });

    return items.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      if (prioOrder[a.priority] !== prioOrder[b.priority]) {
        return prioOrder[a.priority] - prioOrder[b.priority];
      }
      return b.timestamp - a.timestamp;
    });
  }, [growthIndex, timelineCorrelations, milestones, currentBaby, getGrowthData, globalStreak, newlyUnlocked, trackerEntries, getPercentile, getEngineInsights, getTrackerEntries]);

  /* ── Filtered insights ── */
  const filteredInsights = useMemo(() => {
    let filtered = allInsights.filter(i => !dismissedIds.has(i.id));
    if (activeCategory !== 'all') {
      filtered = filtered.filter(i => i.type === activeCategory);
    }
    return filtered;
  }, [allInsights, dismissedIds, activeCategory]);

  /* ── Weekly pattern data ── */
  const weeklyPattern = useMemo((): PatternData[] => {
    if (!trackerEntries.length) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));

    return last7Days.map(day => {
      const dayActivities = trackerEntries.filter((a: any) => {
        const aDate = new Date(a.timestamp || a.date);
        return isSameDay(aDate, day);
      });

      return {
        day: format(day, 'EEE'),
        feeds: dayActivities.filter((a: any) => a.type === 'feed' || a.trackerId === 'feed').length,
        sleep: dayActivities.filter((a: any) => a.type === 'sleep' || a.trackerId === 'sleep').length,
        diapers: dayActivities.filter((a: any) => a.type === 'diaper' || a.trackerId === 'diaper').length,
        total: dayActivities.length,
      };
    });
  }, [trackerEntries]);

  /* ── Weekly stats ── */
  const weeklyStats = useMemo((): WeeklyStats => {
    if (!weeklyPattern.length) {
      return { totalActivities: 0, avgDaily: 0, mostActiveDay: '—', streakDays: 0, topCategory: '—' };
    }
    const total = weeklyPattern.reduce((sum, d) => sum + d.total, 0);
    const avg = Math.round(total / 7);
    const maxDay = weeklyPattern.reduce((max, d) => d.total > max.total ? d : max, weeklyPattern[0]);

    // Calculate streak
    let streak = 0;
    for (let i = weeklyPattern.length - 1; i >= 0; i--) {
      if (weeklyPattern[i].total > 0) streak++;
      else break;
    }

    // Top category
    const catCounts: Record<string, number> = {};
    weeklyPattern.forEach(d => {
      catCounts['feed'] = (catCounts['feed'] || 0) + d.feeds;
      catCounts['sleep'] = (catCounts['sleep'] || 0) + d.sleep;
      catCounts['diaper'] = (catCounts['diaper'] || 0) + d.diapers;
    });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalActivities: total,
      avgDaily: avg,
      mostActiveDay: maxDay?.day || '—',
      streakDays: streak,
      topCategory: topCat ? topCat[0].charAt(0).toUpperCase() + topCat[0].slice(1) : '—',
    };
  }, [weeklyPattern]);

  /* ── Categories ── */
  const categories = useMemo(() => [
    { key: 'all', label: 'All', icon: 'grid-outline', color: primary },
    { key: 'high', label: 'Urgent', icon: 'alert-circle-outline', color: '#ef4444' },
    { key: 'health', label: 'Health', icon: 'medical-outline', color: '#10b981' },
    { key: 'growth', label: 'Growth', icon: 'trending-up-outline', color: '#3b82f6' },
    { key: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#6366f1' },
    { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: '#fa709a' },
    { key: 'milestone', label: 'Milestones', icon: 'trophy-outline', color: '#f59e0b' },
    { key: 'achievement', label: 'Wins', icon: 'ribbon-outline', color: '#8b5cf6' },
  ], [primary]);

  /* ── Handlers ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshEntries(); // re-reads entries from the DB; BabyContext data re-reads on its own provider cycle
    } catch { /* keep the spinner honest even on failure */ }
    setRefreshing(false);
  }, [refreshEntries]);

  const handleInsightPress = useCallback((insight: InsightItem) => {
    triggerHaptic('light');
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen as any, insight.action.params);
    }
  }, [navigation, triggerHaptic]);

  const handleCategoryChange = useCallback((cat: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(cat);
    triggerHaptic('light');
  }, [triggerHaptic]);

  /* ── Sticky header opacity ── */
  const stickyHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  /* ── Render ── */
  const urgentCount = filteredInsights.filter(i => i.priority === 'high').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Background gradient */}
      <LinearGradient
        colors={isDark ? [theme.background, '#0c0c18', '#12121e'] : [theme.background, '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, stickyHeaderStyle]}>
        <View style={[styles.stickyHeaderBg, { backgroundColor: isDark ? 'rgba(26,26,42,0.96)' : 'rgba(255,255,255,0.96)' }]} />
        <Text style={[styles.stickyTitle, { color: theme.text }]}>Insights</Text>
        <Text style={[styles.stickySubtitle, { color: theme.textSecondary }]}>
          {filteredInsights.length} items • {urgentCount} urgent
        </Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary, secondary]} />
        }
      >
        {/* ── TOP HEADER ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.surface }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Insights</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
              {currentBaby ? `${currentBaby.name}'s personalized insights` : 'Your tracking insights'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </Animated.View>

        {/* ── STATS ROW ── */}
        {currentBaby && (
          <Animated.View entering={FadeInUp.delay(50).springify()} style={styles.statsRow}>
            <StatCard
              label="Total"
              value={String(weeklyStats.totalActivities)}
              subvalue="this week"
              icon="analytics-outline"
              color={primary}
              theme={theme}
              isDark={isDark}
              delay={50}
            />
            <StatCard
              label="Streak"
              value={`${weeklyStats.streakDays}d`}
              subvalue="active"
              icon="flame-outline"
              color="#f59e0b"
              theme={theme}
              isDark={isDark}
              delay={100}
            />
            <StatCard
              label="Top"
              value={weeklyStats.topCategory}
              subvalue="category"
              icon="trending-up-outline"
              color={secondary}
              theme={theme}
              isDark={isDark}
              delay={150}
            />
            <StatCard
              label="Urgent"
              value={String(urgentCount)}
              subvalue="need attention"
              icon="alert-circle-outline"
              color="#ef4444"
              theme={theme}
              isDark={isDark}
              delay={200}
            />
          </Animated.View>
        )}

        {/* ── WEEKLY PATTERN ── */}
        {currentBaby && weeklyPattern.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Weekly Pattern"
              subtitle={`Most active: ${weeklyStats.mostActiveDay}`}
              icon="bar-chart-outline"
              theme={theme}
            />
            <WeeklyPatternChart patterns={weeklyPattern} theme={theme} isDark={isDark} />
          </View>
        )}

        {/* ── CATEGORY FILTER ── */}
        <View style={styles.filterSection}>
          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onChange={handleCategoryChange}
            theme={theme}
            isDark={isDark}
          />
        </View>

        {/* ── INSIGHTS LIST ── */}
        <View style={styles.section}>
          <SectionHeader
            title={activeCategory === 'all' ? 'All Insights' : `${categories.find(c => c.key === activeCategory)?.label || 'Insights'}`}
            subtitle={`${filteredInsights.length} items`}
            icon="bulb-outline"
            theme={theme}
          />

          {filteredInsights.length > 0 ? (
            filteredInsights.map((insight, i) => (
              <View key={insight.id} style={{ position: 'relative' }}>
                <InsightCard
                  insight={insight}
                  theme={theme}
                  onPress={() => handleInsightPress(insight)}
                  index={i}
                  isDark={isDark}
                />
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismiss(insight.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-outline" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[
              styles.emptyState,
              { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff', borderColor: theme.border }
            ]}>
              <View style={[styles.emptyIconBg, { backgroundColor: `${primary}12` }]}>
                <Ionicons name="checkmark-done-outline" size={32} color={primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {activeCategory === 'all' ? 'All Caught Up!' : 'No insights in this category'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {activeCategory === 'all' 
                  ? 'You have no pending insights. Keep tracking to get more personalized recommendations.'
                  : 'Try switching to a different category to see more insights.'
                }
              </Text>
              {dismissedIds.size > 0 && (
                <TouchableOpacity
                  style={[styles.restoreButton, { backgroundColor: `${primary}10` }]}
                  onPress={() => {
                    setDismissedIds(new Set());
                    saveDismissed(new Set());
                    triggerHaptic('light');
                  }}
                >
                  <Text style={[styles.restoreText, { color: primary }]}>Restore Dismissed ({dismissedIds.size})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── GROWTH INTELLIGENCE SUMMARY ── */}
        {growthIndex && (
          <View style={styles.section}>
            <SectionHeader
              title="Growth Intelligence"
              subtitle={`Score: ${growthIndex.compositeIndex || 0}/100`}
              icon="sparkles-outline"
              theme={theme}
            />
            <View style={[
              styles.giCard,
              { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : '#ffffff', borderColor: theme.border }
            ]}>
              <View style={styles.giScores}>
                {[
                  { label: 'Nutrition', value: growthIndex.nutritionScore?.value, color: '#FF9F43', icon: '🍎' },
                  { label: 'Rest', value: growthIndex.restScore?.value, color: '#5F27CD', icon: '😴' },
                  { label: 'Physical', value: growthIndex.physicalScore?.value, color: '#10AC84', icon: '💪' },
                  { label: 'Cognitive', value: growthIndex.cognitiveScore?.value, color: '#FFD700', icon: '🧠' },
                ].map(s => (
                  <View key={s.label} style={styles.giScoreItem}>
                    <Text style={styles.giScoreEmoji}>{s.icon}</Text>
                    <View style={styles.giScoreBarBg}>
                      <View style={[styles.giScoreBarFill, { width: `${Math.min(s.value || 0, 100)}%`, backgroundColor: s.color }]} />
                    </View>
                    <Text style={[styles.giScoreValue, { color: s.color }]}>{s.value ?? '—'}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.giActionButton, { backgroundColor: `${primary}10` }]}
                onPress={() => navigation.navigate('GrowthDashboard' as any)}
              >
                <Text style={[styles.giActionText, { color: primary }]}>View Full Dashboard →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Solid cards, no blur, matching HomeScreen exactly
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  /* ── Top Header ── */
  topHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginHorizontal: 20, 
    marginBottom: 16 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    /* no shadow */
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* ── Sticky Header ── */
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 10 
  },
  stickyHeaderBg: { ...StyleSheet.absoluteFillObject },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* ── Stats Row ── */
  statsRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginHorizontal: 20, 
    marginBottom: 16 
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    /* no shadow */,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statSubvalue: { fontSize: 10, fontWeight: '500', marginTop: 1 },

  /* ── Section Header ── */
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginHorizontal: 20, 
    marginBottom: 12, 
    marginTop: 8 
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  sectionHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeaderActionText: { fontSize: 13, fontWeight: '700' },

  /* ── Section ── */
  section: { marginBottom: 20 },
  filterSection: { marginBottom: 12, marginTop: 4 },

  /* ── Solid Card ── */
  solidCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    /* no shadow */,
  },
  solidCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  solidCardContent: { flex: 1 },

  /* ── Insight Card ── */
  insightCard: { 
    padding: 14, 
    marginBottom: 8, 
    borderRadius: 16, 
    marginHorizontal: 20, 
    borderWidth: 1,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: { 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700' },
  insightTime: { fontSize: 11, fontWeight: '500' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  insightActionBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8, 
    marginTop: 4 
  },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },
  dismissButton: {
    position: 'absolute',
    top: 16,
    right: 32,
    padding: 4,
    zIndex: 10,
  },

  /* ── Category Filter ── */
  categoryFilterScroll: { paddingHorizontal: 20, gap: 6, paddingBottom: 4 },
  categoryFilterChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10 
  },
  categoryFilterText: { fontSize: 12, fontWeight: '600' },

  /* ── Weekly Pattern ── */
  patternContainer: { 
    borderRadius: 18, 
    padding: 14, 
    marginHorizontal: 20,
    borderWidth: 1,
    /* no shadow */,
  },
  patternBars: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    height: 90, 
    gap: 6 
  },
  patternDay: { flex: 1, alignItems: 'center', gap: 4 },
  patternBarContainer: { 
    width: '100%', 
    height: 60, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.02)', 
    borderRadius: 6, 
    overflow: 'hidden' 
  },
  patternBar: { 
    width: '100%', 
    borderRadius: 6, 
    minHeight: 3 
  },
  patternDayLabel: { fontSize: 10, fontWeight: '600' },
  patternDayCount: { fontSize: 9, fontWeight: '700' },

  /* ── Empty State ── */
  emptyState: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    /* no shadow */,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  restoreButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  restoreText: { fontSize: 13, fontWeight: '700' },

  /* ── Growth Intelligence Card ── */
  giCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    /* no shadow */,
  },
  giScores: { gap: 12 },
  giScoreItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  giScoreEmoji: { fontSize: 16, width: 24 },
  giScoreBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  giScoreBarFill: { height: '100%', borderRadius: 3 },
  giScoreValue: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },
  giActionButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  giActionText: { fontSize: 13, fontWeight: '700' },
});
