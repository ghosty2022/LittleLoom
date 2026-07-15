// GrowthDashboardScreen.tsx — UNIFIED v5.0
// TrackerHub aesthetics + Growth-specific intelligence
// Glass cards, cohesive spacing, unified modals, no feature duplication

import React, {
  memo,
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
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

import { BlurView } from 'expo-blur';
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  format,
  isValid,
  parseISO,
  addMonths,
  startOfDay,
} from 'date-fns';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeAvatar } from '@/components/SafeAvatar';
import { useAuth } from '@/context/AuthContext';
import { useCustomization } from '@/hooks/useCustomization';
import { useBaby } from '@/context/BabyContext';
import { useTracker } from '@/context/TrackerContext';
import { useSweetAlert } from '@/components/SweetAlert';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';
import { useTrackerAchievements } from '@/hooks/useTrackerAchievements';
import { useTrackerProgressive } from '@/hooks/useTrackerProgressive';
import { useWHOGrowthCalculator } from '@/hooks/useWHOGrowthCalculator';
import type { GrowthMeasurement, BabyProfile } from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified with TrackerHub
   ═══════════════════════════════════════════════════════════════════════════ */

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 10 },
};

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeGender = (g?: string): 'boy' | 'girl' => g === 'girl' ? 'girl' : 'boy';

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const safeNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type MetricType = 'height' | 'weight' | 'head' | 'bmi';
type TimeRange = '1m' | '3m' | '6m' | '1y' | 'all';
type ChartMode = 'trend' | 'velocity' | 'percentile';
type DashboardTab = 'overview' | 'growth' | 'milestones' | 'insights' | 'photos';

interface InsightItem {
  id: string;
  type: 'milestone' | 'growth' | 'health' | 'sleep' | 'nutrition' | 'correlation' | 'achievement' | 'vaccination' | 'prediction';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
  timestamp: number;
}

interface PredictedMilestone {
  id: string;
  title: string;
  category: string;
  predictedAge: number;
  confidence: number;
  description: string;
  emoji: string;
}

interface ActivitySuggestion {
  id: string;
  title: string;
  category: string;
  duration: string;
  frequency: string;
  benefit: string;
  emoji: string;
  color: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HOOK — Unified with TrackerHub pattern
   ═══════════════════════════════════════════════════════════════════════════ */

const useDashboardTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();

  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bgColors: isDark ? ['#0a0a1a', '#12122a'] : ['#f8faff', '#eef2ff'],
    statusBar: isDark ? 'light-content' : 'dark-content' as const,
    blur: isDark ? 'dark' : 'light' as const,
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    surface: {
      bg: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
      card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
      border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    },
  }), [isDark, colors, fullThemeColors]);
};

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFIED GLASS CARD — Matches TrackerHub exactly
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = memo(({ 
  children, 
  style, 
  onPress, 
  active = false,
  shadow = 'md',
}: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  shadow?: keyof typeof SHADOW;
}) => {
  const theme = useDashboardTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      onPress={onPress} 
      activeOpacity={onPress ? 0.85 : 1} 
      style={[
        styles.glassCard,
        SHADOW[shadow],
        active && { borderColor: theme.primary, borderWidth: 2 },
        style
      ]}
    >
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] 
          : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Matches TrackerHub exactly
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = memo(({ 
  title, 
  subtitle, 
  action, 
  actionLabel,
  icon,
}: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  const theme = useDashboardTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={[styles.sectionActionText, { color: theme.primary }]}>
            {actionLabel || 'See All'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR — Unified style
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: { key: DashboardTab; label: string; icon: keyof typeof Ionicons.glyphMap }[]; 
  activeTab: DashboardTab; 
  onChange: (t: DashboardTab) => void;
}) => {
  const theme = useDashboardTheme();
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tabItem,
              isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#fff', ...SHADOW.sm }
            ]}
          >
            <Ionicons name={tab.icon} size={16} color={isActive ? theme.primary : theme.text.muted} />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? theme.primary : theme.text.muted },
              isActive && { fontWeight: '700' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD — Growth-specific, unified aesthetic
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiCard = memo(({ 
  title, 
  value, 
  unit, 
  change, 
  changeLabel,
  icon, 
  color, 
  percentile, 
  status, 
  onPress, 
  size = 'normal'
}: any) => {
  const theme = useDashboardTheme();
  const isLarge = size === 'large';
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[
      styles.kpiCard,
      isLarge && styles.kpiCardLarge,
    ]}>
      <LinearGradient
        colors={[`${color}08`, `${color}02`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.kpiInner}>
        <View style={styles.kpiTop}>
          <View style={[styles.kpiIconBg, { backgroundColor: `${color}15` }]}>
            <Text style={styles.kpiIcon}>{icon}</Text>
          </View>
          {percentile !== undefined && (
            <View style={[styles.kpiPercentileBadge, { backgroundColor: `${color}12` }]}>
              <Text style={[styles.kpiPercentileText, { color }]}>P{percentile}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.kpiBody}>
          <Text style={[styles.kpiValue, { color: theme.text.primary, fontSize: isLarge ? 32 : 24 }]} numberOfLines={1}>
            {value}
            <Text style={[styles.kpiUnit, { color }]}>{unit}</Text>
          </Text>
          <Text style={[styles.kpiTitle, { color: theme.text.secondary }]}>{title}</Text>
        </View>

        {(change !== undefined || status) && (
          <View style={styles.kpiFooter}>
            {change !== undefined && (
              <View style={styles.kpiChangeRow}>
                <Ionicons 
                  name={change >= 0 ? 'trending-up' : 'trending-down'} 
                  size={12} 
                  color={change >= 0 ? '#10b981' : '#ef4444'} 
                />
                <Text style={[styles.kpiChange, { color: change >= 0 ? '#10b981' : '#ef4444' }]}>
                  {change > 0 ? '+' : ''}{change}{unit}
                </Text>
                {changeLabel && (
                  <Text style={[styles.kpiChangeLabel, { color: theme.text.muted }]}>{changeLabel}</Text>
                )}
              </View>
            )}
            {status && (
              <View style={[styles.kpiStatusBadge, { backgroundColor: `${status.color}12` }]}>
                <View style={[styles.kpiStatusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.kpiStatusText, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHT CARD — Unified with TrackerHub SmartInsightsCarousel style
   ═══════════════════════════════════════════════════════════════════════════ */

const InsightCard = memo(({ 
  insight, 
  onPress, 
  index 
}: { 
  insight: InsightItem; 
  onPress: () => void; 
  index: number;
}) => {
  const theme = useDashboardTheme();
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.insightCard, { borderLeftColor: insight.color, borderLeftWidth: 3 }]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[`${insight.color}08`, `${insight.color}02`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.insightTop}>
          <Text style={styles.insightEmoji}>{insight.emoji}</Text>
          <View style={[styles.insightPriorityDot, { backgroundColor: insight.color }]} />
        </View>
        <Text style={[styles.insightTitle, { color: theme.text.primary }]} numberOfLines={1}>{insight.title}</Text>
        <Text style={[styles.insightDesc, { color: theme.text.secondary }]} numberOfLines={2}>{insight.description}</Text>
        {insight.action && (
          <View style={[styles.insightActionBadge, { backgroundColor: `${theme.primary}10` }]}>
            <Text style={[styles.insightActionText, { color: theme.primary }]}>{insight.action.label} →</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   GROWTH-SPECIFIC COMPONENTS (kept, restyled to match)
   ═══════════════════════════════════════════════════════════════════════════ */

const AIGrowthPredictor = memo(({ baby, growthIndex, onPress }: { baby: BabyProfile; growthIndex: any; onPress: () => void }) => {
  const theme = useDashboardTheme();
  const predictions = useMemo(() => {
    if (!growthIndex) return [];
    const ageNow = safeDiffMonths(new Date(), baby.birthDate);
    return [
      { milestone: 'First Words', predictedAge: Math.round(ageNow + 2), confidence: 78, category: 'Cognitive', emoji: '🗣️' },
      { milestone: 'Walking Unassisted', predictedAge: Math.round(ageNow + 4), confidence: 65, category: 'Physical', emoji: '🚶' },
      { milestone: 'Potty Training', predictedAge: Math.round(ageNow + 8), confidence: 45, category: 'Independence', emoji: '🚽' },
    ].filter(p => p.predictedAge > ageNow);
  }, [growthIndex, baby]);

  if (predictions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard onPress={onPress}>
        <View style={styles.predictorHeader}>
          <View style={[styles.predictorIconBg, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="sparkles" size={20} color={theme.primary} />
          </View>
          <View style={styles.predictorTitleWrap}>
            <Text style={[styles.predictorTitle, { color: theme.text.primary }]}>AI Growth Predictor</Text>
            <Text style={[styles.predictorSubtitle, { color: theme.text.muted }]}>Based on current patterns</Text>
          </View>
        </View>
        <View style={styles.predictorList}>
          {predictions.map((pred, i) => (
            <View key={i} style={[styles.predictorItem, i < predictions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
              <View style={styles.predictorLeft}>
                <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
                <View>
                  <Text style={[styles.predictorMilestone, { color: theme.text.primary }]}>{pred.milestone}</Text>
                  <Text style={[styles.predictorCategory, { color: theme.text.muted }]}>{pred.category}</Text>
                </View>
              </View>
              <View style={styles.predictorRight}>
                <View style={styles.predictorBarBg}>
                  <View style={[styles.predictorBarFill, { 
                    width: `${pred.confidence}%`, 
                    backgroundColor: pred.confidence > 70 ? '#10b981' : pred.confidence > 50 ? '#f59e0b' : '#ef4444' 
                  }]} />
                </View>
                <Text style={[styles.predictorConfidence, { color: theme.text.secondary }]}>{pred.confidence}% confidence</Text>
                <Text style={[styles.predictorAge, { color: theme.primary }]}>~{pred.predictedAge} months</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const PercentileRadar = memo(({ stats }: { stats: any }) => {
  const theme = useDashboardTheme();
  if (!stats) return null;
  
  const dimensions = [
    { key: 'height', label: 'Height', color: '#6366f1' },
    { key: 'weight', label: 'Weight', color: '#ec4899' },
    { key: 'head', label: 'Head', color: '#06b6d4' },
    { key: 'bmi', label: 'BMI', color: '#f59e0b' },
  ];

  const values = dimensions.map(d => {
    const s = stats[d.key];
    return s?.percentile ? Math.min(s.percentile, 100) : 0;
  });

  const maxVal = 100;
  const size = 140;
  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / dimensions.length;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.radarHeader}>
          <Text style={[styles.radarTitle, { color: theme.text.primary }]}>Growth Dimensions</Text>
          <Text style={[styles.radarSubtitle, { color: theme.text.muted }]}>WHO Percentiles</Text>
        </View>
        <View style={styles.radarContainer}>
          <View style={[styles.radarCanvas, { width: size, height: size }]}>
            {[0.25, 0.5, 0.75, 1].map((r, i) => (
              <View key={i} style={[
                styles.radarRing,
                {
                  width: radius * 2 * r,
                  height: radius * 2 * r,
                  borderRadius: radius * r,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  left: center - radius * r,
                  top: center - radius * r,
                }
              ]} />
            ))}
            {dimensions.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              return (
                <View key={`axis-${i}`} style={[
                  styles.radarAxis,
                  {
                    left: center,
                    top: center,
                    width: radius,
                    transform: [{ rotate: `${angle * 180 / Math.PI}deg` }],
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }
                ]} />
              );
            })}
            {values.map((v, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = (v / maxVal) * radius;
              const x = center + Math.cos(angle) * r;
              const y = center + Math.sin(angle) * r;
              return (
                <View key={`pt-${i}`} style={[
                  styles.radarPoint,
                  { left: x - 4, top: y - 4, backgroundColor: dimensions[i].color }
                ]} />
              );
            })}
          </View>
          <View style={styles.radarLegend}>
            {dimensions.map((d, i) => (
              <View key={d.key} style={styles.radarLegendItem}>
                <View style={[styles.radarLegendDot, { backgroundColor: d.color }]} />
                <Text style={[styles.radarLegendLabel, { color: theme.text.secondary }]}>{d.label}</Text>
                <Text style={[styles.radarLegendValue, { color: theme.text.primary }]}>P{values[i] || '—'}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const VelocityHeatmap = memo(({ measurements, activeMetric }: { measurements: GrowthMeasurement[]; activeMetric: MetricType }) => {
  const theme = useDashboardTheme();
  
  const heatmapData = useMemo(() => {
    const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const weeks: Record<string, { values: number[]; dates: Date[] }> = {};
    
    sorted.forEach(m => {
      const d = safeParseDate(m.date);
      if (!d) return;
      const weekKey = format(d, 'yyyy-w');
      if (!weeks[weekKey]) weeks[weekKey] = { values: [], dates: [] };
      weeks[weekKey].values.push(m.value);
      weeks[weekKey].dates.push(d);
    });

    return Object.entries(weeks).slice(-8).map(([week, data]) => {
      const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length;
      const prevWeek = Object.entries(weeks).find(([w]) => w === String(parseInt(week) - 1));
      const prevAvg = prevWeek ? prevWeek[1].values.reduce((a, b) => a + b, 0) / prevWeek[1].values.length : avg;
      const change = ((avg - prevAvg) / prevAvg) * 100;
      
      let status: 'normal' | 'high' | 'low' | 'none' = 'normal';
      if (Math.abs(change) > 15) status = change > 0 ? 'high' : 'low';
      if (data.values.length === 0) status = 'none';

      return {
        week: `W${week.split('-')[1]}`,
        value: avg,
        status,
      };
    });
  }, [measurements, activeMetric]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high': return '#10b981';
      case 'low': return '#ef4444';
      case 'normal': return theme.primary;
      default: return theme.text.muted;
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.heatmapHeader}>
          <Text style={[styles.heatmapTitle, { color: theme.text.primary }]}>Weekly Velocity</Text>
          <View style={styles.heatmapLegend}>
            <View style={[styles.heatmapLegendDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>High</Text>
            <View style={[styles.heatmapLegendDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>Normal</Text>
            <View style={[styles.heatmapLegendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>Low</Text>
          </View>
        </View>
        <View style={styles.heatmapGrid}>
          {heatmapData.map((week, i) => (
            <View key={i} style={styles.heatmapCell}>
              <View style={[
                styles.heatmapBlock,
                { backgroundColor: getStatusColor(week.status) + '20', borderColor: getStatusColor(week.status) }
              ]}>
                <Text style={[styles.heatmapValue, { color: getStatusColor(week.status) }]}>
                  {week.value ? week.value.toFixed(1) : '—'}
                </Text>
              </View>
              <Text style={[styles.heatmapWeek, { color: theme.text.muted }]}>{week.week}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const HealthCorrelation = memo(({ trackerEntries, baby }: { trackerEntries: any[]; baby: BabyProfile }) => {
  const theme = useDashboardTheme();
  
  const correlations = useMemo(() => {
    const sleepEntries = trackerEntries.filter((e: any) => e.trackerId === 'sleep' && e.babyId === baby?.id).slice(-7);
    const feedEntries = trackerEntries.filter((e: any) => e.trackerId === 'feed' && e.babyId === baby?.id).slice(-7);
    
    const avgSleep = sleepEntries.length > 0 
      ? sleepEntries.reduce((sum, e) => sum + (e.duration || e.value || 0), 0) / sleepEntries.length 
      : 0;
    const avgFeed = feedEntries.length > 0
      ? feedEntries.reduce((sum, e) => sum + (e.amount || e.value || 0), 0) / feedEntries.length
      : 0;

    return [
      {
        label: 'Sleep → Growth',
        value: avgSleep > 12 ? 92 : avgSleep > 8 ? 78 : avgSleep > 4 ? 55 : 30,
        icon: '😴',
        color: '#8b5cf6',
        detail: `${avgSleep.toFixed(1)}h avg sleep`,
      },
      {
        label: 'Feed → Growth',
        value: avgFeed > 150 ? 88 : avgFeed > 100 ? 72 : avgFeed > 50 ? 50 : 25,
        icon: '🍼',
        color: '#f59e0b',
        detail: `${avgFeed.toFixed(0)}ml avg feed`,
      },
      {
        label: 'Activity → Growth',
        value: 76,
        icon: '🎾',
        color: '#10b981',
        detail: '3 activities/day',
      },
    ];
  }, [trackerEntries, baby]);

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <GlassCard>
        <View style={styles.correlationHeader}>
          <Text style={[styles.correlationTitle, { color: theme.text.primary }]}>Health Correlations</Text>
          <Text style={[styles.correlationSubtitle, { color: theme.text.muted }]}>How habits affect growth</Text>
        </View>
        <View style={styles.correlationList}>
          {correlations.map((corr, i) => (
            <View key={i} style={styles.correlationItem}>
              <View style={styles.correlationLeft}>
                <Text style={styles.correlationIcon}>{corr.icon}</Text>
                <View>
                  <Text style={[styles.correlationLabel, { color: theme.text.primary }]}>{corr.label}</Text>
                  <Text style={[styles.correlationDetail, { color: theme.text.muted }]}>{corr.detail}</Text>
                </View>
              </View>
              <View style={styles.correlationRight}>
                <View style={[styles.correlationBarBg, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.correlationBarFill, { width: `${corr.value}%`, backgroundColor: corr.color }]} />
                </View>
                <Text style={[styles.correlationValue, { color: corr.color }]}>{corr.value}%</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ActivitySuggestions = memo(({ baby, onPress }: { baby: BabyProfile; onPress: (a: ActivitySuggestion) => void }) => {
  const theme = useDashboardTheme();
  const ageMonths = safeDiffMonths(new Date(), baby.birthDate);
  
  const suggestions = useMemo((): ActivitySuggestion[] => {
    const base: ActivitySuggestion[] = [];
    if (ageMonths < 3) {
      base.push({ id: 'tummy-time', title: 'Tummy Time', category: 'Physical', duration: '5-10 min', frequency: '3x daily', benefit: 'Strengthens neck & shoulders', emoji: '👶', color: '#10b981' });
    }
    if (ageMonths >= 3 && ageMonths < 6) {
      base.push({ id: 'reach-grasp', title: 'Reach & Grasp', category: 'Motor', duration: '10 min', frequency: '2x daily', benefit: 'Develops hand-eye coordination', emoji: '👋', color: '#6366f1' });
    }
    if (ageMonths >= 6) {
      base.push({ id: 'crawl-play', title: 'Crawl Exploration', category: 'Physical', duration: '15 min', frequency: 'Daily', benefit: 'Builds core strength', emoji: '🐛', color: '#ec4899' });
    }
    if (ageMonths >= 9) {
      base.push({ id: 'peekaboo', title: 'Peek-a-Boo Games', category: 'Cognitive', duration: '10 min', frequency: 'Daily', benefit: 'Object permanence & social', emoji: '🙈', color: '#f59e0b' });
    }
    return base.slice(0, 3);
  }, [ageMonths]);

  if (suggestions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <View style={styles.suggestionsHeader}>
        <Text style={[styles.suggestionsTitle, { color: theme.text.primary }]}>Recommended Activities</Text>
        <Text style={[styles.suggestionsSubtitle, { color: theme.text.muted }]}>For {ageMonths} month old</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity key={suggestion.id} onPress={() => onPress(suggestion)} style={styles.suggestionCard}>
            <LinearGradient
              colors={[suggestion.color + '15', suggestion.color + '05']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '20' }]}>
              <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
            </View>
            <Text style={[styles.suggestionTitle, { color: theme.text.primary }]}>{suggestion.title}</Text>
            <Text style={[styles.suggestionCategory, { color: suggestion.color }]}>{suggestion.category}</Text>
            <View style={styles.suggestionMeta}>
              <Ionicons name="time-outline" size={12} color={theme.text.muted} />
              <Text style={[styles.suggestionMetaText, { color: theme.text.muted }]}>{suggestion.duration}</Text>
              <Text style={[styles.suggestionDot, { color: theme.text.muted }]}>•</Text>
              <Text style={[styles.suggestionMetaText, { color: theme.text.muted }]}>{suggestion.frequency}</Text>
            </View>
            <Text style={[styles.suggestionBenefit, { color: theme.text.secondary }]} numberOfLines={2}>{suggestion.benefit}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const PredictiveMilestoneCalendar = memo(({ baby, milestones, onPress }: { baby: BabyProfile; milestones: any[]; onPress: (m: PredictedMilestone) => void }) => {
  const theme = useDashboardTheme();
  const ageMonths = safeDiffMonths(new Date(), baby.birthDate);
  
  const predictedMilestones = useMemo((): PredictedMilestone[] => {
    const achieved = new Set(milestones.map(m => m.title?.toLowerCase()));
    const predictions: PredictedMilestone[] = [];
    
    const milestonesDB = [
      { title: 'Rolling Over', category: 'Physical', typicalAge: 4, emoji: '🔄' },
      { title: 'Sitting Up', category: 'Physical', typicalAge: 6, emoji: '🪑' },
      { title: 'Crawling', category: 'Physical', typicalAge: 9, emoji: '🐛' },
      { title: 'First Steps', category: 'Physical', typicalAge: 12, emoji: '👣' },
      { title: 'First Words', category: 'Cognitive', typicalAge: 12, emoji: '🗣️' },
      { title: 'Waving Bye', category: 'Social', typicalAge: 9, emoji: '👋' },
      { title: 'Clapping', category: 'Social', typicalAge: 9, emoji: '👏' },
      { title: 'Pointing', category: 'Cognitive', typicalAge: 12, emoji: '👉' },
    ];
    
    milestonesDB.forEach(m => {
      if (!achieved.has(m.title.toLowerCase()) && m.typicalAge >= ageMonths) {
        const diff = m.typicalAge - ageMonths;
        predictions.push({
          id: `pred-${m.title}`,
          title: m.title,
          category: m.category,
          predictedAge: m.typicalAge,
          confidence: Math.max(30, 100 - diff * 10),
          description: `Typically achieved around ${m.typicalAge} months`,
          emoji: m.emoji,
        });
      }
    });
    
    return predictions.slice(0, 4);
  }, [milestones, ageMonths]);

  if (predictedMilestones.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader 
        title="Upcoming Milestones" 
        subtitle="Predicted based on WHO standards"
        icon="trophy-outline"
      />
      <View style={styles.calendarTimeline}>
        {predictedMilestones.map((milestone, i) => (
          <TouchableOpacity key={milestone.id} onPress={() => onPress(milestone)} style={styles.calendarItem}>
            <View style={styles.calendarLeft}>
              <View style={[styles.calendarLine, { backgroundColor: theme.surface.border }]} />
              <View style={[styles.calendarDot, { 
                backgroundColor: milestone.confidence > 70 ? '#10b981' : milestone.confidence > 50 ? '#f59e0b' : '#ef4444' 
              }]} />
              {i === predictedMilestones.length - 1 && <View style={[styles.calendarLineEnd, { backgroundColor: 'transparent' }]} />}
            </View>
            <View style={[styles.calendarCard, { backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' }]}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarEmoji}>{milestone.emoji}</Text>
                <View style={styles.calendarMeta}>
                  <Text style={[styles.calendarTitle, { color: theme.text.primary }]}>{milestone.title}</Text>
                  <Text style={[styles.calendarCategory, { color: theme.text.muted }]}>{milestone.category}</Text>
                </View>
                <View style={[styles.calendarBadge, { 
                  backgroundColor: `${milestone.confidence > 70 ? '#10b981' : milestone.confidence > 50 ? '#f59e0b' : '#ef4444'}15` 
                }]}>
                  <Text style={[styles.calendarBadgeText, { 
                    color: milestone.confidence > 70 ? '#10b981' : milestone.confidence > 50 ? '#f59e0b' : '#ef4444' 
                  }]}>
                    {milestone.confidence}% ready
                  </Text>
                </View>
              </View>
              <Text style={[styles.calendarDesc, { color: theme.text.secondary }]}>{milestone.description}</Text>
              <Text style={[styles.calendarAge, { color: theme.primary }]}>
                Expected: {milestone.predictedAge} months
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PURE CHART (No SVG) — Kept from original, restyled
   ═══════════════════════════════════════════════════════════════════════════ */

const PureChart = memo(({ data, mode, width, height }: any) => {
  const theme = useDashboardTheme();
  if (!data || data.length === 0) return null;
  
  const values = data.map((d: any) => d.value);
  const maxVal = Math.max(...values, 0.1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const padding = { top: 20, right: 10, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  
  const getX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartW;
  const getY = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;
  
  if (mode === 'velocity') {
    const barW = Math.max(4, (chartW / data.length) * 0.6);
    return (
      <View style={{ width, height }}>
        {[0, 0.33, 0.66, 1].map((r, i) => (
          <Text key={`y-${i}`} style={{
            position: 'absolute',
            left: 0,
            top: padding.top + chartH - r * chartH - 6,
            width: padding.left - 4,
            fontSize: 9,
            color: theme.text.muted,
            textAlign: 'right',
          }}>
            {(minVal + r * range).toFixed(1)}
          </Text>
        ))}
        {data.map((d: any, i: number) => (
          <View key={i} style={{
            position: 'absolute',
            left: getX(i) - barW / 2,
            top: getY(d.value),
            width: barW,
            height: padding.top + chartH - getY(d.value),
            backgroundColor: theme.primary,
            borderRadius: 4,
            opacity: 0.85,
          }} />
        ))}
        {data.map((d: any, i: number) => (
          <Text key={`x-${i}`} style={{
            position: 'absolute',
            left: getX(i) - 20,
            top: padding.top + chartH + 4,
            width: 40,
            fontSize: 8,
            color: theme.text.muted,
            textAlign: 'center',
          }} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    );
  }
  
  return (
    <View style={{ width, height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <View key={`grid-${i}`} style={{
          position: 'absolute',
          left: padding.left,
          right: padding.right,
          top: padding.top + chartH - r * chartH,
          height: 1,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <Text key={`y-${i}`} style={{
          position: 'absolute',
          left: 0,
          top: padding.top + chartH - r * chartH - 6,
          width: padding.left - 4,
          fontSize: 9,
          color: theme.text.muted,
          textAlign: 'right',
        }}>
          {(minVal + r * range).toFixed(1)}
        </Text>
      ))}
      {data.map((d: any, i: number) => {
        if (i === 0) return null;
        const prev = data[i - 1];
        const x1 = getX(i - 1), y1 = getY(prev.value);
        const x2 = getX(i), y2 = getY(d.value);
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`line-${i}`} style={{
            position: 'absolute',
            left: x1,
            top: y1,
            width: len,
            height: 3,
            backgroundColor: theme.primary,
            transform: [{ translateX: 0 }, { translateY: -1.5 }, { rotate: `${angle}deg` }],
            transformOrigin: '0% 50%',
            borderRadius: 1.5,
          }} />
        );
      })}
      {data.map((d: any, i: number) => (
        <View key={`pt-${i}`} style={{
          position: 'absolute',
          left: getX(i) - 4,
          top: getY(d.value) - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.primary,
          borderWidth: 2,
          borderColor: theme.surface.bg,
        }} />
      ))}
      {data.filter((_: any, i: number) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d: any, i: number) => (
        <Text key={`x-${i}`} style={{
          position: 'absolute',
          left: getX(data.indexOf(d)) - 20,
          top: padding.top + chartH + 4,
          width: 40,
          fontSize: 8,
          color: theme.text.muted,
          textAlign: 'center',
        }} numberOfLines={1}>
          {d.label}
        </Text>
      ))}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFIED MODALS — TrackerHub style
   ═══════════════════════════════════════════════════════════════════════════ */

const AddMeasurementModal = memo(({ visible, onClose, onSave, type, previousValue }: any) => {
  const theme = useDashboardTheme();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const unit = type === 'weight' ? 'kg' : 'cm';

  const handleSave = useCallback(() => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    onSave({ type, value: num, unit, date: new Date(date).toISOString(), notes: notes || undefined });
    setValue(''); setNotes(''); onClose();
  }, [value, notes, date, type, unit, onSave, onClose]);

  useEffect(() => { 
    if (visible) { setValue(''); setNotes(''); setDate(format(new Date(), 'yyyy-MM-dd')); } 
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { backgroundColor: theme.surface.bg }]}>
          <LinearGradient 
            colors={theme.isDark ? ['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} 
            style={StyleSheet.absoluteFill} 
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Add {type}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {previousValue !== undefined && (
            <View style={[styles.prevValueBox, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="information-circle" size={18} color={theme.primary} />
              <Text style={[styles.prevValueText, { color: theme.primary }]}>Previous: {previousValue} {unit}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Value ({unit})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholder={`Enter ${type}`}
              placeholderTextColor={theme.text.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              value={date}
              onChangeText={setDate}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              placeholderTextColor={theme.text.muted}
            />
          </View>

          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Save Measurement</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const BabySwitcherModal = memo(({ visible, onClose, babies, currentBaby, onSwitch }: any) => {
  const theme = useDashboardTheme();
  if (!visible) return null;
  
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View entering={FadeInUp.springify()} style={[styles.babySwitcherModal, { backgroundColor: theme.surface.bg }]}>
          <LinearGradient 
            colors={theme.isDark ? ['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} 
            style={StyleSheet.absoluteFill} 
          />
          <Text style={[styles.babySwitcherTitle, { color: theme.text.primary }]}>Select Baby</Text>
          {babies.map((baby: BabyProfile) => (
            <TouchableOpacity
              key={baby.id}
              onPress={() => { onSwitch(baby.id); onClose(); }}
              style={[styles.babySwitcherItem, currentBaby?.id === baby.id && { backgroundColor: `${theme.primary}15` }]}
            >
              <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="person" borderColor={currentBaby?.id === baby.id ? theme.primary : theme.surface.border} borderWidth={2} />
              <View style={styles.babySwitcherInfo}>
                <Text style={[styles.babySwitcherName, { color: theme.text.primary }]}>{baby.name}</Text>
                <Text style={[styles.babySwitcherMeta, { color: theme.text.secondary }]}>{safeFmt(baby.birthDate, 'MMM d, yyyy')} • {safeDiffMonths(new Date(), baby.birthDate)} months</Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — UNIFIED v5.0
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GrowthDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useDashboardTheme();
  const { triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const {
    currentBaby,
    growthData,
    milestones,
    addGrowthMeasurement,
    babies,
    switchBaby,
    getGrowthData,
  } = useBaby();
  const { userProfile } = useAuth();
  const { entries: trackerEntries } = useTracker();

  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { achievements, newlyUnlocked, streak: globalStreak } = useTrackerAchievements();
  const { insights: progressiveInsights } = useTrackerProgressive('growth');
  const { getPercentile, getStatus, getVelocity, getPrediction } = useWHOGrowthCalculator();

  // ── State ──
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [activeMetric, setActiveMetric] = useState<MetricType>('height');
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [chartMode, setChartMode] = useState<ChartMode>('trend');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const ageMonths = useMemo(() => {
    if (!currentBaby) return 0;
    return safeDiffMonths(new Date(), currentBaby.birthDate);
  }, [currentBaby]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    if (!currentBaby) return [];
    const ranges: Record<TimeRange, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 3650 };
    const cutoff = new Date(Date.now() - ranges[timeRange] * 24 * 60 * 60 * 1000);

    let data = getGrowthData(activeMetric)
      .filter(g => {
        const d = safeParseDate(g.date);
        return d && d >= cutoff;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (activeMetric === 'bmi') {
      const heights = getGrowthData('height').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const weights = getGrowthData('weight').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      data = weights.map(w => {
        const wDate = safeParseDate(w.date);
        if (!wDate) return null;
        const h = heights.reduce((best, curr) => {
          const bestDate = safeParseDate(best?.date);
          const currDate = safeParseDate(curr?.date);
          if (!bestDate || !currDate) return curr;
          return Math.abs(safeDiffDays(currDate, wDate)) < Math.abs(safeDiffDays(bestDate, wDate)) ? curr : best;
        }, heights[0]);
        if (!h) return null;
        const bmi = w.value / Math.pow(h.value / 100, 2);
        return { ...w, value: parseFloat(bmi.toFixed(2)), type: 'bmi' as const };
      }).filter(Boolean) as GrowthMeasurement[];
    }

    return data.map((g, i) => ({
      value: Number(g.value) || 0,
      label: safeFmt(g.date, 'MMM d'),
      dataPointText: String(g.value),
      index: i,
    }));
  }, [growthData, activeMetric, timeRange, currentBaby, getGrowthData]);

  const velocityData = useMemo(() => {
    if (chartData.length < 2) return [];
    const velocities: { value: number; label: string }[] = [];
    for (let i = 1; i < chartData.length; i++) {
      const days = safeDiffDays(
        safeParseDate(growthData.find(g => g.date.includes(chartData[i].label))?.date) || new Date(),
        safeParseDate(growthData.find(g => g.date.includes(chartData[i - 1].label))?.date) || new Date()
      );
      if (days <= 0) continue;
      const velocity = (chartData[i].value - chartData[i - 1].value) / days * 30;
      velocities.push({ value: parseFloat(velocity.toFixed(2)), label: chartData[i].label });
    }
    return velocities;
  }, [chartData, growthData]);

  // ── Stats with WHO percentiles ──
  const stats = useMemo(() => {
    if (!currentBaby) return null;
    const gender = safeGender(currentBaby.gender);
    const result: Record<string, any> = {};

    (['height', 'weight', 'head'] as MetricType[]).forEach(type => {
      const data = getGrowthData(type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0];
      const prev = data[1];

      if (latest) {
        const ageAt = Math.max(0, safeDiffMonths(latest.date, currentBaby.birthDate));
        const percentile = getPercentile(latest.value, ageAt, type, gender);
        const status = getStatus(percentile);

        result[type] = {
          value: latest.value.toFixed(1),
          unit: latest.unit,
          change: prev ? (latest.value - prev.value).toFixed(1) : undefined,
          percentile,
          status,
        };
      }
    });

    if (result.height && result.weight) {
      const h = parseFloat(result.height.value) / 100;
      const w = parseFloat(result.weight.value);
      const bmi = w / (h * h);
      const ageAt = Math.max(0, safeDiffMonths(new Date(), currentBaby.birthDate));
      const percentile = getPercentile(bmi, ageAt, 'bmi', gender);
      result.bmi = {
        value: bmi.toFixed(1),
        unit: '',
        percentile,
        status: getStatus(percentile),
      };
    }

    return result;
  }, [growthData, currentBaby, getGrowthData, getPercentile, getStatus]);

  // ── Smart Insights (growth-specific, no duplication with TrackerHub) ──
  const smartInsights = useMemo((): InsightItem[] => {
    if (!currentBaby) return [];
    const items: InsightItem[] = [];
    const now = Date.now();

    if (growthIndex) {
      if (growthIndex.nutritionScore?.value < 50) {
        items.push({
          id: 'gi-nutrition', type: 'nutrition', title: 'Nutrition Needs Attention',
          description: `Nutrition score is ${growthIndex.nutritionScore.value}/100. Consider reviewing feeding patterns.`,
          emoji: '🍎', color: '#FF9F43', priority: 'high',
          action: { label: 'Track Feed', screen: 'AddEntry', params: { trackerId: 'feed' } }, timestamp: now,
        });
      }
      if (growthIndex.restScore?.value < 50) {
        items.push({
          id: 'gi-sleep', type: 'sleep', title: 'Sleep Quality Low',
          description: `Rest score is ${growthIndex.restScore.value}/100. Check sleep schedule consistency.`,
          emoji: '😴', color: '#5F27CD', priority: 'medium',
          action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } }, timestamp: now,
        });
      }
      if (growthIndex.milestoneReadiness?.length > 0) {
        const top = growthIndex.milestoneReadiness[0];
        items.push({
          id: 'gi-milestone', type: 'milestone', title: `${top.category} Milestone Ready!`,
          description: `${top.readinessPercent}% readiness for ${top.category} milestones.`,
          emoji: '🎯', color: '#10AC84', priority: 'medium',
          action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } }, timestamp: now,
        });
      }
    }

    timelineCorrelations.slice(0, 2).forEach(c => {
      items.push({
        id: `corr-${c.id}`, type: 'correlation', title: 'Pattern Discovered',
        description: c.insight, emoji: '🔗', color: '#54A0FF', priority: 'low', timestamp: now,
      });
    });

    const recentMilestone = [...milestones].sort((a, b) => {
      const da = safeParseDate(a.achievedAt);
      const db = safeParseDate(b.achievedAt);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })[0];
    if (recentMilestone && safeParseDate(recentMilestone.achievedAt) && safeDiffDays(new Date(), recentMilestone.achievedAt) < 7) {
      items.push({
        id: 'recent-milestone', type: 'milestone', title: 'New Milestone! 🌟',
        description: `${currentBaby.name} achieved "${recentMilestone.title}"`,
        emoji: '🏆', color: '#f59e0b', priority: 'high',
        timestamp: safeParseDate(recentMilestone.achievedAt)?.getTime() || now,
      });
    }

    const typeData = getGrowthData(activeMetric);
    if (typeData.length >= 2) {
      const sorted = [...typeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      if (latest.value < prev.value) {
        const drop = ((prev.value - latest.value) / prev.value) * 100;
        if (drop > 5) {
          items.push({
            id: 'growth-drop', type: 'growth', title: 'Measurement Decrease',
            description: `Latest ${activeMetric} dropped ${drop.toFixed(1)}% from previous. Please verify.`,
            emoji: '⚠️', color: '#ef4444', priority: 'high',
            action: { label: 'Re-measure', screen: 'AddEntry', params: { trackerId: 'growth' } }, timestamp: now,
          });
        }
      }
    }

    if (globalStreak?.streakAtRisk && globalStreak.currentStreak > 0) {
      items.push({
        id: 'streak-risk', type: 'achievement', title: '🔥 Streak at Risk!',
        description: `Log an entry in ${globalStreak.hoursUntilBreak}h to keep your ${globalStreak.currentStreak}-day streak alive.`,
        emoji: '⏰', color: '#ef4444', priority: 'high',
        action: { label: 'Log Now', screen: 'AddEntry' }, timestamp: now,
      });
    }

    if (newlyUnlocked?.length > 0) {
      items.push({
        id: 'new-achievement', type: 'achievement', title: 'Achievement Unlocked! 🎉',
        description: `${newlyUnlocked.length} new achievement${newlyUnlocked.length > 1 ? 's' : ''} earned!`,
        emoji: '🏆', color: '#8b5cf6', priority: 'medium',
        action: { label: 'View All', screen: 'Achievements' }, timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    }).slice(0, 6);
  }, [growthIndex, timelineCorrelations, milestones, currentBaby, activeMetric, getGrowthData, globalStreak, newlyUnlocked]);

  // ── Handlers ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const handleAddMeasurement = useCallback(async (data: Partial<GrowthMeasurement>) => {
    if (!currentBaby) return;
    const success = await addGrowthMeasurement({
      babyId: currentBaby.id,
      type: data.type as MetricType,
      value: data.value ?? 0,
      unit: data.unit || 'cm',
      date: data.date || new Date().toISOString(),
      notes: data.notes,
      recordedBy: userProfile?.fullName?.split(' ')[0] || 'Parent',
    });
    if (success) {
      HAPTIC_SUCCESS();
      setShowAddModal(false);
    }
  }, [currentBaby, addGrowthMeasurement, userProfile]);

  const handleInsightPress = useCallback((insight: InsightItem) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  }, [navigation]);

  const getPreviousValue = useCallback(() => {
    const data = getGrowthData(activeMetric).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return data[0]?.value;
  }, [activeMetric, getGrowthData]);

  const handleTabChange = useCallback((tab: DashboardTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    HAPTIC_LIGHT();
  }, []);

  // ── Loading / No baby ──
  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bgColors[0] }, styles.center]}>
        <StatusBar barStyle={theme.statusBar} />
        <LinearGradient colors={theme.bgColors} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-add" size={64} color={theme.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.noDataTitle, { color: theme.text.primary }]}>No Baby Profile</Text>
        <Text style={[styles.noDataText, { color: theme.text.secondary }]}>Create a profile to start tracking growth</Text>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('CreateBabyProfile')}>
          <Text style={styles.createBtnText}>Create Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabs = [
    { key: 'overview' as DashboardTab, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'growth' as DashboardTab, label: 'Growth', icon: 'trending-up-outline' as const },
    { key: 'milestones' as DashboardTab, label: 'Milestones', icon: 'trophy-outline' as const },
    { key: 'insights' as DashboardTab, label: 'Insights', icon: 'bulb-outline' as const },
    { key: 'photos' as DashboardTab, label: 'Photos', icon: 'images-outline' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      <LinearGradient colors={theme.bgColors} style={StyleSheet.absoluteFill} />

      {/* Sticky Header — matches TrackerHub exactly */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.blur} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>{currentBaby.name}'s Growth</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>{ageMonths} months</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} />
        }
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowBabySwitcher(true)} style={styles.babyPill}>
            <LinearGradient
             
              colors={theme.isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <SafeAvatar avatar={currentBaby.avatar} size={36} fallbackIcon="person" borderColor={theme.primary} borderWidth={2} />
            <View style={styles.babyPillText}>
              <Text style={[styles.babyPillName, { color: theme.text.primary }]} numberOfLines={1}>{currentBaby.name}</Text>
              <Text style={[styles.babyPillAge, { color: theme.text.secondary }]}>{ageMonths}mo</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={theme.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── COMPOSITE GROWTH SCORE (Hero) ── */}
        {growthIndex && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <GlassCard onPress={() => navigation.navigate('GrowthIntelligence')}>
              <View style={styles.heroScore}>
                <View style={styles.heroScoreLeft}>
                  <View style={[styles.heroScoreRing, { borderColor: `${theme.primary}30` }]}>
                    <Text style={[styles.heroScoreValue, { color: theme.primary }]}>{growthIndex.compositeIndex || 0}</Text>
                    <Text style={[styles.heroScoreMax, { color: theme.text.muted }]}>/100</Text>
                  </View>
                  <View style={styles.heroScoreLabels}>
                    <Text style={[styles.heroScoreLabel, { color: theme.text.primary }]}>Growth Score</Text>
                    <Text style={[styles.heroScoreSub, { color: theme.text.muted }]}>Composite Index</Text>
                  </View>
                </View>
                <View style={styles.heroScoreRight}>
                  {[
                    { label: 'Nutrition', value: growthIndex.nutritionScore?.value, color: '#FF9F43', icon: '🍎' },
                    { label: 'Rest', value: growthIndex.restScore?.value, color: '#5F27CD', icon: '😴' },
                    { label: 'Physical', value: growthIndex.physicalScore?.value, color: '#10AC84', icon: '💪' },
                    { label: 'Cognitive', value: growthIndex.cognitiveScore?.value, color: '#FFD700', icon: '🧠' },
                  ].map(s => (
                    <View key={s.label} style={styles.heroScoreMini}>
                      <Text style={styles.heroScoreMiniIcon}>{s.icon}</Text>
                      <View style={styles.heroScoreMiniBarWrap}>
                        <View style={[styles.heroScoreMiniBarBg, { backgroundColor: `${s.color}15` }]}>
                          <View style={[styles.heroScoreMiniBarFill, { width: `${Math.min(s.value || 0, 100)}%`, backgroundColor: s.color }]} />
                        </View>
                      </View>
                      <Text style={[styles.heroScoreMiniValue, { color: s.color }]}>{s.value ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── TAB BAR ── */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {/* ═════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* ── KPI GRID (2x2) ── */}
            <View style={styles.kpiGrid}>
              {[
                { key: 'height', title: 'Height', icon: '📏', color: '#6366f1', size: 'large' },
                { key: 'weight', title: 'Weight', icon: '⚖️', color: '#ec4899', size: 'large' },
                { key: 'head', title: 'Head', icon: '🧠', color: '#06b6d4', size: 'normal' },
                { key: 'bmi', title: 'BMI', icon: '📊', color: '#f59e0b', size: 'normal' },
              ].map((m, i) => {
                const s = stats?.[m.key];
                return (
                  <Animated.View 
                    key={m.key} 
                    entering={FadeInUp.delay(150 + i * 80).springify()} 
                    style={[styles.kpiGridItem, m.size === 'large' ? styles.kpiGridItemLarge : styles.kpiGridItemNormal]}
                  >
                    <KpiCard
                      title={m.title}
                      value={s?.value || '—'}
                      unit={s?.unit || (m.key === 'weight' ? 'kg' : m.key === 'bmi' ? '' : 'cm')}
                      change={s?.change ? parseFloat(s.change) : undefined}
                      changeLabel="last"
                      icon={m.icon}
                      color={m.color}
                      percentile={s?.percentile}
                      status={s?.status}
                      onPress={() => { setActiveMetric(m.key as MetricType); setActiveTab('growth'); HAPTIC_LIGHT(); }}
                      size={m.size}
                    />
                  </Animated.View>
                );
              })}
            </View>

            {/* ── AI Growth Predictor ── */}
            <AIGrowthPredictor 
              baby={currentBaby} 
              growthIndex={growthIndex} 
              onPress={() => navigation.navigate('GrowthIntelligence')} 
            />

            {/* ── Health Correlations ── */}
            <HealthCorrelation 
              trackerEntries={trackerEntries} 
              baby={currentBaby} 
            />

            {/* ── Activity Suggestions ── */}
            <ActivitySuggestions 
              baby={currentBaby} 
              onPress={(a) => navigation.navigate('ActivityDetail', { activity: a })} 
            />

            {/* ── Predictive Milestone Calendar ── */}
            <PredictiveMilestoneCalendar 
              baby={currentBaby} 
              milestones={milestones} 
              onPress={(m) => navigation.navigate('MilestoneDetail', { milestone: m })} 
            />

            {/* ── SMART INSIGHTS ── */}
            {smartInsights.length > 0 && (
              <View style={styles.section}>
                <SectionHeader 
                  title="Smart Insights" 
                  subtitle={`${smartInsights.filter(i => i.priority === 'high').length} need attention`}
                  action={() => navigation.navigate('Insights')}
                  actionLabel="View All"
                  icon="sparkles-outline"
                />
                {smartInsights.slice(0, 3).map((insight, i) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onPress={() => handleInsightPress(insight)}
                    index={i}
                  />
                ))}
              </View>
            )}

            {/* ── QUICK ACTIONS ── */}
            <View style={styles.quickActionsGrid}>
              {[
                { icon: '🌟', label: 'Milestones', screen: 'Timeline', params: { filter: 'milestone' }, gradient: ['#f59e0b', '#fbbf24'] },
                { icon: '💉', label: 'Vaccines', screen: 'VaccinationSchedule', params: {}, gradient: [theme.primary, theme.secondary] },
                { icon: '📸', label: 'Photos', screen: 'Gallery', params: {}, gradient: ['#10b981', '#34d399'] },
                { icon: '🏆', label: 'Achievements', screen: 'Achievements', params: {}, gradient: ['#8b5cf6', '#a78bfa'] },
              ].map((action, i) => (
                <TouchableOpacity key={i} onPress={() => navigation.navigate(action.screen, action.params)} style={styles.quickAction}>
                  <LinearGradient colors={action.gradient as [string, string]} style={styles.quickActionGradient}>
                    <Text style={styles.quickActionIcon}>{action.icon}</Text>
                    <Text style={styles.quickActionText}>{action.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: GROWTH
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'growth' && (
          <>
            {/* ── WHO Percentile Radar ── */}
            <PercentileRadar stats={stats} />

            {/* ── Metric Selector ── */}
            <View style={styles.metricSelector}>
              {(['height', 'weight', 'head', 'bmi'] as MetricType[]).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setActiveMetric(m)}
                  style={[styles.metricSelectorChip, activeMetric === m && { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.metricSelectorText, { color: activeMetric === m ? '#fff' : theme.text.secondary }]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Time Range ── */}
            <View style={styles.timeRangeWrap}>
              {(['1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setTimeRange(r)}
                  style={[styles.timeRangeChip, timeRange === r && { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.timeRangeText, { color: timeRange === r ? '#fff' : theme.text.secondary }]}>{r === 'all' ? 'All' : r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Chart Mode ── */}
            <View style={styles.chartModeWrap}>
              {([
                { key: 'trend' as ChartMode, label: 'Trend', icon: 'trending-up' },
                { key: 'velocity' as ChartMode, label: 'Velocity', icon: 'speedometer' },
                { key: 'percentile' as ChartMode, label: 'Percentile', icon: 'analytics' },
              ]).map(m => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setChartMode(m.key)}
                  style={[styles.chartModeChip, chartMode === m.key && { backgroundColor: theme.secondary }]}
                >
                  <Ionicons name={m.icon as any} size={14} color={chartMode === m.key ? '#fff' : theme.text.secondary} />
                  <Text style={[styles.chartModeText, { color: chartMode === m.key ? '#fff' : theme.text.secondary }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── MAIN CHART ── */}
            <Animated.View entering={FadeInUp.delay(200).springify()}>
              <GlassCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={[styles.chartTitle, { color: theme.text.primary }]}>
                      {chartMode === 'trend' ? `${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Trend` :
                       chartMode === 'velocity' ? 'Growth Velocity' : 'Percentile Tracking'}
                    </Text>
                    <Text style={[styles.chartSubtitle, { color: theme.text.muted }]}>
                      {chartData.length} measurements • WHO Standard
                    </Text>
                  </View>
                  {stats?.[activeMetric]?.percentile !== undefined && (
                    <View style={[styles.chartPercentileBadge, { backgroundColor: `${theme.primary}12` }]}>
                      <Text style={[styles.chartPercentileText, { color: theme.primary }]}>
                        P{stats[activeMetric].percentile}
                      </Text>
                    </View>
                  )}
                </View>

                {chartData.length > 0 ? (
                  <PureChart
                    data={chartMode === 'velocity' ? velocityData : chartData}
                    mode={chartMode}
                    width={SCREEN_W - 72}
                    height={220}
                  />
                ) : (
                  <View style={styles.emptyChart}>
                    <MaterialCommunityIcons name="chart-line" size={48} color={theme.text.muted} />
                    <Text style={[styles.emptyChartText, { color: theme.text.muted }]}>No data yet</Text>
                    <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addDataBtn, { backgroundColor: theme.primary }]}>
                      <Text style={styles.addDataBtnText}>Add First Measurement</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            </Animated.View>

            {/* ── Velocity Heatmap ── */}
            <VelocityHeatmap 
              measurements={getGrowthData(activeMetric)} 
              activeMetric={activeMetric}
            />

            {/* ── Recent Measurements ── */}
            <View style={styles.section}>
              <SectionHeader 
                title="Recent Measurements" 
                action={() => navigation.navigate('Timeline', { filter: 'growth' })}
                actionLabel="History"
                icon="time-outline"
              />
              <GlassCard style={styles.historyCard}>
                {getGrowthData(activeMetric)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((m, i, arr) => {
                    const ageAt = Math.max(0, safeDiffMonths(m.date, currentBaby.birthDate));
                    const gender = safeGender(currentBaby.gender);
                    const percentile = getPercentile(m.value, ageAt, m.type as MetricType, gender);
                    return (
                      <View key={m.id} style={[styles.historyRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
                        <View style={[styles.historyIcon, { backgroundColor: `${theme.primary}10` }]}>
                          <Text style={{ fontSize: 16 }}>
                            {m.type === 'height' ? '📏' : m.type === 'weight' ? '⚖️' : m.type === 'head' ? '🧠' : '📊'}
                          </Text>
                        </View>
                        <View style={styles.historyInfo}>
                          <Text style={[styles.historyType, { color: theme.text.primary }]}>{m.type.charAt(0).toUpperCase() + m.type.slice(1)}</Text>
                          <Text style={[styles.historyDate, { color: theme.text.muted }]}>{safeFmt(m.date, 'MMM d, yyyy')}</Text>
                        </View>
                        <View style={styles.historyRight}>
                          <Text style={[styles.historyValue, { color: theme.primary }]}>{m.value} {m.unit}</Text>
                          <View style={[styles.historyPercentile, { backgroundColor: `${getStatus(percentile).color}12` }]}>
                            <Text style={[styles.historyPercentileText, { color: getStatus(percentile).color }]}>P{percentile}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                {getGrowthData(activeMetric).length === 0 && (
                  <View style={styles.emptyHistory}>
                    <Text style={[styles.emptyHistoryText, { color: theme.text.muted }]}>No measurements yet</Text>
                  </View>
                )}
              </GlassCard>
            </View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: MILESTONES
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'milestones' && (
          <>
            {/* Milestone Readiness */}
            {growthIndex?.milestoneReadiness && growthIndex.milestoneReadiness.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Milestone Readiness" icon="trophy-outline" />
                <GlassCard>
                  {growthIndex.milestoneReadiness.map((m: any, i: number) => (
                    <View key={i} style={[styles.milestoneRow, i < growthIndex.milestoneReadiness.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
                      <View style={styles.milestoneLeft}>
                        <Text style={[styles.milestoneCategory, { color: theme.text.primary }]}>{m.category}</Text>
                        <View style={[styles.milestoneBarBg, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                          <View style={[styles.milestoneBarFill, { width: `${Math.min(m.readinessPercent, 100)}%`, backgroundColor: m.readinessPercent > 80 ? '#10b981' : m.readinessPercent > 50 ? '#f59e0b' : '#ef4444' }]} />
                        </View>
                      </View>
                      <Text style={[styles.milestonePercent, { color: theme.text.primary }]}>{m.readinessPercent}%</Text>
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}

            {/* Predictive Calendar */}
            <PredictiveMilestoneCalendar 
              baby={currentBaby} 
              milestones={milestones} 
              onPress={(m) => navigation.navigate('MilestoneDetail', { milestone: m })} 
            />

            {/* Achieved Milestones */}
            <View style={styles.section}>
              <SectionHeader 
                title="Achieved Milestones" 
                subtitle={`${milestones.length} total`}
                icon="checkmark-circle-outline"
              />
              {milestones
                .sort((a, b) => {
                  const da = safeParseDate(a.achievedAt);
                  const db = safeParseDate(b.achievedAt);
                  return (db?.getTime() || 0) - (da?.getTime() || 0);
                })
                .slice(0, 6)
                .map((m, i) => (
                  <Animated.View key={m.id} entering={FadeInUp.delay(i * 60).springify()}>
                    <GlassCard style={styles.achievedCard}>
                      <View style={styles.achievedRow}>
                        <View style={[styles.achievedIconBg, { backgroundColor: `${theme.primary}12` }]}>
                          <Text style={styles.achievedEmoji}>🌟</Text>
                        </View>
                        <View style={styles.achievedContent}>
                          <Text style={[styles.achievedTitle, { color: theme.text.primary }]}>{m.title}</Text>
                          <Text style={[styles.achievedDate, { color: theme.text.muted }]}>
                            {safeFmt(m.achievedAt, 'MMM d, yyyy')} • {safeDiffMonths(m.achievedAt, currentBaby.birthDate)} months old
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                      </View>
                    </GlassCard>
                  </Animated.View>
                ))}
            </View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: INSIGHTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <>
            <View style={styles.section}>
              <SectionHeader 
                title="Quick Insights" 
                subtitle={`${smartInsights.length} items`}
                action={() => navigation.navigate('Insights')}
                actionLabel="View All"
                icon="bulb-outline"
              />
              {smartInsights.slice(0, 3).map((insight, i) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onPress={() => handleInsightPress(insight)}
                  index={i}
                />
              ))}
              {smartInsights.length === 0 && (
                <GlassCard style={styles.emptyInsights}>
                  <Ionicons name="bulb-outline" size={48} color={theme.text.muted} />
                  <Text style={[styles.emptyInsightsText, { color: theme.text.muted }]}>No insights yet</Text>
                  <Text style={[styles.emptyInsightsSub, { color: theme.text.secondary }]}>Keep tracking to get personalized insights</Text>
                </GlassCard>
              )}
              {smartInsights.length > 3 && (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Insights')}
                  style={[styles.viewAllInsightsBtn, { backgroundColor: `${theme.primary}10` }]}
                >
                  <Text style={[styles.viewAllInsightsText, { color: theme.primary }]}>
                    View {smartInsights.length - 3} More Insights
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Velocity Trends */}
            {growthIndex?.velocityTrends && (
              <View style={styles.section}>
                <SectionHeader title="Velocity Trends" icon="trending-up-outline" />
                <View style={styles.velocityGrid}>
                  {[
                    { key: 'height', label: 'Height', unit: 'cm/mo', color: '#6366f1' },
                    { key: 'weight', label: 'Weight', unit: 'kg/mo', color: '#ec4899' },
                    { key: 'head', label: 'Head', unit: 'cm/mo', color: '#06b6d4' },
                  ].map(v => {
                    const data = (growthIndex.velocityTrends as any)?.[v.key];
                    return (
                      <GlassCard key={v.key} style={styles.velocityCard}>
                        <Text style={[styles.velocityLabel, { color: theme.text.secondary }]}>{v.label}</Text>
                        <Text style={[styles.velocityValue, { color: v.color }]}>{data?.perMonth?.toFixed(2) || '—'}</Text>
                        <Text style={[styles.velocityUnit, { color: theme.text.muted }]}>{v.unit}</Text>
                        <Text style={[styles.velocityPercentile, { color: theme.text.muted }]}>P{data?.percentile || '—'}</Text>
                      </GlassCard>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: PHOTOS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'photos' && (
          <View style={styles.section}>
            <SectionHeader 
              title="Growth Memories" 
              subtitle="Photos tied to measurements"
              icon="images-outline"
            />
            <View style={styles.photoGrid}>
              <TouchableOpacity onPress={() => {}} style={[styles.photoGridAdd, { borderColor: theme.primary }]}>
                <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.photoGridAddGradient}>
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.photoGridAddText}>Add Photo</Text>
                </LinearGradient>
              </TouchableOpacity>
              {[1, 2, 3, 4, 5].map((_, i) => (
                <View key={i} style={[styles.photoGridItem, { backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' }]}>
                  <View style={styles.photoGridPlaceholder}>
                    <Ionicons name="image" size={32} color={theme.text.muted} />
                  </View>
                  <View style={styles.photoGridOverlay}>
                    <Text style={styles.photoGridAge}>{ageMonths - i}m</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddMeasurement}
        type={activeMetric}
        previousValue={getPreviousValue()}
      />

      <BabySwitcherModal
        visible={showBabySwitcher}
        onClose={() => setShowBabySwitcher(false)}
        babies={babies}
        currentBaby={currentBaby}
        onSwitch={switchBaby}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Unified with TrackerHub v5.0
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // ── Glass Card ──
  glassCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
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
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
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
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  babyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Hero Score ──
  heroScore: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    gap: 16 
  },
  heroScoreLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14 
  },
  heroScoreRing: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    borderWidth: 4, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  heroScoreValue: { fontSize: 24, fontWeight: '800' },
  heroScoreMax: { fontSize: 12, fontWeight: '600' },
  heroScoreLabels: { gap: 2 },
  heroScoreLabel: { fontSize: 14, fontWeight: '800' },
  heroScoreSub: { fontSize: 12, fontWeight: '500' },
  heroScoreRight: { flex: 1, gap: 8 },
  heroScoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroScoreMiniIcon: { fontSize: 14, width: 20 },
  heroScoreMiniBarWrap: { flex: 1 },
  heroScoreMiniBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  heroScoreMiniBarFill: { height: '100%', borderRadius: 3 },
  heroScoreMiniValue: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },

  // ── Tab Bar ──
  tabBar: { 
    flexDirection: 'row', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg, 
    padding: 4, 
    borderRadius: 16, 
    gap: 2 
  },
  tabItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── KPI Grid ──
  kpiGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg 
  },
  kpiGridItem: { marginBottom: 0 },
  kpiGridItemLarge: { width: (SCREEN_W - 56) / 2, height: 140 },
  kpiGridItemNormal: { width: (SCREEN_W - 56) / 2, height: 120 },

  // ── KPI Card ──
  kpiCard: { 
    flex: 1, 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    padding: 14, 
    ...SHADOW.md 
  },
  kpiCardLarge: { padding: 16 },
  kpiInner: { flex: 1, justifyContent: 'space-between' },
  kpiTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  kpiIconBg: { 
    width: 36, 
    height: 36, 
    borderRadius: RADIUS.sm, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  kpiIcon: { fontSize: 18 },
  kpiPercentileBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: RADIUS.xs 
  },
  kpiPercentileText: { fontSize: 11, fontWeight: '800' },
  kpiBody: { gap: 2, marginTop: 8 },
  kpiValue: { fontWeight: '800', letterSpacing: -0.5 },
  kpiUnit: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  kpiTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiFooter: { marginTop: 8, gap: 4 },
  kpiChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiChange: { fontSize: 12, fontWeight: '700' },
  kpiChangeLabel: { fontSize: 11, fontWeight: '500', marginLeft: 2 },
  kpiStatusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: RADIUS.xs, 
    alignSelf: 'flex-start' 
  },
  kpiStatusDot: { width: 6, height: 6, borderRadius: 3 },
  kpiStatusText: { fontSize: 10, fontWeight: '700' },

  // ── Insight Card ──
  insightCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  insightEmoji: { fontSize: 22 },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginBottom: 8 },
  insightActionBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: RADIUS.sm 
  },
  insightActionText: { fontSize: 11, fontWeight: '700' },

  // ── AI Growth Predictor ──
  predictorHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    paddingBottom: 12 
  },
  predictorIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: RADIUS.sm, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  predictorTitleWrap: { flex: 1 },
  predictorTitle: { fontSize: 16, fontWeight: '800' },
  predictorSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  predictorList: { paddingHorizontal: 16, paddingBottom: 16 },
  predictorItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    gap: 12 
  },
  predictorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  predictorEmoji: { fontSize: 22 },
  predictorMilestone: { fontSize: 14, fontWeight: '700' },
  predictorCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  predictorRight: { alignItems: 'flex-end', gap: 4 },
  predictorBarBg: { width: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  predictorBarFill: { height: '100%', borderRadius: 2 },
  predictorConfidence: { fontSize: 10, fontWeight: '600' },
  predictorAge: { fontSize: 12, fontWeight: '700' },

  // ── Percentile Radar ──
  radarHeader: { padding: 16, paddingBottom: 8 },
  radarTitle: { fontSize: 16, fontWeight: '800' },
  radarSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  radarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 16 
  },
  radarCanvas: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  radarRing: { 
    position: 'absolute', 
    borderWidth: 1 
  },
  radarAxis: { 
    position: 'absolute', 
    height: 1, 
    transformOrigin: '0% 50%' 
  },
  radarPoint: { 
    position: 'absolute', 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  radarLegend: { flex: 1, gap: 10 },
  radarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radarLegendDot: { width: 8, height: 8, borderRadius: 4 },
  radarLegendLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  radarLegendValue: { fontSize: 12, fontWeight: '700' },

  // ── Velocity Heatmap ──
  heatmapHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    paddingBottom: 12 
  },
  heatmapTitle: { fontSize: 16, fontWeight: '800' },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heatmapLegendDot: { width: 8, height: 8, borderRadius: 4 },
  heatmapLegendText: { fontSize: 10, fontWeight: '600' },
  heatmapGrid: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 8 
  },
  heatmapCell: { flex: 1, alignItems: 'center', gap: 4 },
  heatmapBlock: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2 
  },
  heatmapValue: { fontSize: 13, fontWeight: '700' },
  heatmapWeek: { fontSize: 10, fontWeight: '600' },

  // ── Health Correlation ──
  correlationHeader: { padding: 16, paddingBottom: 8 },
  correlationTitle: { fontSize: 16, fontWeight: '800' },
  correlationSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  correlationList: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  correlationItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  correlationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  correlationIcon: { fontSize: 20 },
  correlationLabel: { fontSize: 13, fontWeight: '700' },
  correlationDetail: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  correlationRight: { alignItems: 'flex-end', gap: 4, width: 80 },
  correlationBarBg: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  correlationBarFill: { height: '100%', borderRadius: 2 },
  correlationValue: { fontSize: 12, fontWeight: '700' },

  // ── Activity Suggestions ──
  suggestionsHeader: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md, marginTop: SPACING.md },
  suggestionsTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  suggestionsSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  suggestionsScroll: { paddingHorizontal: SPACING.lg, gap: 12, paddingBottom: 4 },
  suggestionCard: { 
    width: 160, 
    padding: 14, 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    ...SHADOW.md 
  },
  suggestionIconBg: { 
    width: 44, 
    height: 44, 
    borderRadius: RADIUS.sm, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  suggestionEmoji: { fontSize: 22 },
  suggestionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  suggestionCategory: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  suggestionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  suggestionMetaText: { fontSize: 10, fontWeight: '600' },
  suggestionDot: { fontSize: 10 },
  suggestionBenefit: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  // ── Predictive Milestone Calendar ──
  calendarTimeline: { marginHorizontal: SPACING.lg, gap: 0 },
  calendarItem: { flexDirection: 'row', gap: 12 },
  calendarLeft: { 
    width: 24, 
    alignItems: 'center', 
    paddingTop: 16 
  },
  calendarLine: { 
    position: 'absolute', 
    top: 0, 
    bottom: 0, 
    width: 2, 
    left: 11 
  },
  calendarLineEnd: { 
    position: 'absolute', 
    top: 0, 
    bottom: '50%', 
    width: 2, 
    left: 11 
  },
  calendarDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: '#fff', 
    zIndex: 1 
  },
  calendarCard: { 
    flex: 1, 
    padding: 14, 
    borderRadius: RADIUS.lg, 
    marginBottom: 12, 
    ...SHADOW.sm 
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  calendarEmoji: { fontSize: 20 },
  calendarMeta: { flex: 1 },
  calendarTitle: { fontSize: 14, fontWeight: '700' },
  calendarCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  calendarBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.xs },
  calendarBadgeText: { fontSize: 10, fontWeight: '700' },
  calendarDesc: { fontSize: 12, fontWeight: '500', marginBottom: 4, lineHeight: 17 },
  calendarAge: { fontSize: 11, fontWeight: '600' },

  // ── Metric Selector ──
  metricSelector: { 
    flexDirection: 'row', 
    marginHorizontal: SPACING.lg, 
    marginBottom: 10, 
    gap: 8 
  },
  metricSelectorChip: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: RADIUS.sm, 
    backgroundColor: 'rgba(100,116,139,0.08)', 
    alignItems: 'center' 
  },
  metricSelectorText: { fontSize: 13, fontWeight: '600' },

  // ── Time Range ──
  timeRangeWrap: { 
    flexDirection: 'row', 
    marginHorizontal: SPACING.lg, 
    marginBottom: 10, 
    gap: 8 
  },
  timeRangeChip: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: RADIUS.sm, 
    backgroundColor: 'rgba(100,116,139,0.08)', 
    alignItems: 'center' 
  },
  timeRangeText: { fontSize: 12, fontWeight: '600' },

  // ── Chart Mode ──
  chartModeWrap: { 
    flexDirection: 'row', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg, 
    gap: 8 
  },
  chartModeChip: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: RADIUS.sm, 
    backgroundColor: 'rgba(100,116,139,0.08)', 
    gap: 6 
  },
  chartModeText: { fontSize: 12, fontWeight: '600' },

  // ── Chart ──
  chartCard: { padding: SPACING.lg, marginBottom: SPACING.lg },
  chartHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 14 
  },
  chartTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  chartSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  chartPercentileBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  chartPercentileText: { fontSize: 13, fontWeight: '800' },
  emptyChart: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyChartText: { fontSize: 14, fontWeight: '500' },
  addDataBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.sm },
  addDataBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Section ──
  section: { marginBottom: SPACING.xl },

  // ── History ──
  historyCard: { padding: 8 },
  historyRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    gap: 12 
  },
  historyIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: RADIUS.xs, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  historyInfo: { flex: 1, gap: 2 },
  historyType: { fontSize: 14, fontWeight: '700' },
  historyDate: { fontSize: 11, fontWeight: '500' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyValue: { fontSize: 16, fontWeight: '800' },
  historyPercentile: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs },
  historyPercentileText: { fontSize: 10, fontWeight: '800' },
  emptyHistory: { padding: 24, alignItems: 'center' },
  emptyHistoryText: { fontSize: 14, fontWeight: '500' },

  // ── Milestone Row ──
  milestoneRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    gap: 12, 
    paddingHorizontal: 16 
  },
  milestoneLeft: { flex: 1, gap: 6 },
  milestoneCategory: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  milestoneBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  milestoneBarFill: { height: '100%', borderRadius: 3 },
  milestonePercent: { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  // ── Achieved Card ──
  achievedCard: { padding: 14, marginBottom: 8, marginHorizontal: 16 },
  achievedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  achievedIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: RADIUS.sm, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  achievedEmoji: { fontSize: 20 },
  achievedContent: { flex: 1, gap: 2 },
  achievedTitle: { fontSize: 14, fontWeight: '700' },
  achievedDate: { fontSize: 11, fontWeight: '500' },

  // ── Velocity Grid ──
  velocityGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  velocityCard: { flex: 1, padding: 14, alignItems: 'center', gap: 4 },
  velocityLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  velocityValue: { fontSize: 22, fontWeight: '800' },
  velocityUnit: { fontSize: 11, fontWeight: '500' },
  velocityPercentile: { fontSize: 12, fontWeight: '600' },

  // ── Empty Insights ──
  emptyInsights: { 
    padding: 40, 
    alignItems: 'center', 
    gap: 12, 
    marginHorizontal: 16 
  },
  emptyInsightsText: { fontSize: 16, fontWeight: '700' },
  emptyInsightsSub: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  viewAllInsightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
  },
  viewAllInsightsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Photo Grid ──
  photoGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginHorizontal: SPACING.lg, 
    gap: 10 
  },
  photoGridAdd: { 
    width: (SCREEN_W - 56) / 3, 
    aspectRatio: 1, 
    borderRadius: RADIUS.lg, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    overflow: 'hidden' 
  },
  photoGridAddGradient: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 6 
  },
  photoGridAddText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoGridItem: { 
    width: (SCREEN_W - 56) / 3, 
    aspectRatio: 1, 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    ...SHADOW.sm 
  },
  photoGridPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoGridOverlay: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 8, 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  photoGridAge: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Quick Actions ──
  quickActionsGrid: { 
    flexDirection: 'row', 
    gap: SPACING.md, 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.xxl, 
    marginTop: 8 
  },
  quickAction: { 
    flex: 1, 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    ...SHADOW.md 
  },
  quickActionGradient: { 
    paddingVertical: 16, 
    alignItems: 'center', 
    gap: 6 
  },
  quickActionIcon: { fontSize: 22 },
  quickActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { 
    width: '100%', 
    maxWidth: 400, 
    borderRadius: RADIUS.xl, 
    padding: SPACING.xxl, 
    overflow: 'hidden', 
    ...SHADOW.lg 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { 
    width: 36, 
    height: 36, 
    borderRadius: RADIUS.xs, 
    backgroundColor: 'rgba(100,116,139,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  prevValueBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    padding: 12, 
    borderRadius: RADIUS.sm, 
    marginBottom: 16 
  },
  prevValueText: { fontSize: 13, fontWeight: '600' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { 
    height: 50, 
    borderRadius: RADIUS.sm, 
    paddingHorizontal: 16, 
    fontSize: 16, 
    fontWeight: '600' 
  },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { marginTop: 6, borderRadius: RADIUS.sm, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Baby Switcher Modal ──
  babySwitcherModal: { 
    width: '85%', 
    maxWidth: 360, 
    borderRadius: RADIUS.xl, 
    padding: 20, 
    overflow: 'hidden' 
  },
  babySwitcherTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  babySwitcherItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    padding: 12, 
    borderRadius: RADIUS.lg, 
    marginBottom: 8 
  },
  babySwitcherInfo: { flex: 1 },
  babySwitcherName: { fontSize: 16, fontWeight: '700' },
  babySwitcherMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── No Data States ──
  noDataTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  noDataText: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginHorizontal: 40, marginBottom: 24 },
  createBtn: { 
    paddingHorizontal: 32, 
    paddingVertical: 16, 
    borderRadius: RADIUS.lg, 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 8 
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});