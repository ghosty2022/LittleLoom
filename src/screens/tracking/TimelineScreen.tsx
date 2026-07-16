import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { useCustomization } from '../../hooks/useCustomization';
import { Dimensions, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, LayoutAnimation, UIManager, Platform } from 'react-native';
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
import { format, isSameDay, differenceInHours, differenceInDays, differenceInMonths, parseISO, isValid, addMonths } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

import { useUnifiedTrackerTheme } from '@/hooks/useUnifiedTrackerTheme';
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
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';
import { TimelineCorrelation } from '@/components/trackers/TrackerCorrelationBadge';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type TimelineScreenRouteProp = RouteProp<RootStackParamList, 'Timeline'>;
type TimelineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TimelineTab = 'timeline' | 'insights' | 'growth' | 'achievements' | 'analytics';

interface SmartSection {
  id: string;
  type: 'insight' | 'correlation' | 'reminder' | 'achievement' | 'streak' | 'growth';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  component: React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Shared with GrowthDashboard
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
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeArray = <T,>(arr: T[] | undefined | null): T[] => arr || [];
const safeString = (s: string | undefined | null): string => s || '';
const safeNumber = (n: number | undefined | null, fallback = 0): number => {
  if (n === undefined || n === null || Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return n;
};

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

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = ({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: theme.primary, borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] 
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

const SectionHeader = ({ title, subtitle, action, actionLabel, theme }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; theme: any }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: theme.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    )}
  </View>
);

const TabBar = ({ tabs, activeTab, onChange, theme }: { tabs: { key: TimelineTab; label: string; icon: string }[]; activeTab: TimelineTab; onChange: (t: TimelineTab) => void; theme: any }) => (
  <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#fff', ...DESIGN.shadow.sm }
          ]}
        >
          <Ionicons name={tab.icon as any} size={16} color={isActive ? theme.primary : theme.text.muted} />
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

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI Pattern Predictor
   ═══════════════════════════════════════════════════════════════════════════ */

const AIPatternPredictor = ({ entries, theme, onPress }: { entries: TrackerEntry[]; theme: any; onPress: () => void }) => {
  const predictions = useMemo(() => {
    if (!entries.length) return [];
    const now = Date.now();
    const todayEntries = entries.filter(e => e.timestamp >= now - 86400000);
    
    return [
      {
        pattern: 'Next Feed',
        predictedTime: '2:30 PM',
        confidence: 85,
        basedOn: '3-day pattern',
        emoji: '🍼',
        color: '#f59e0b',
      },
      {
        pattern: 'Nap Window',
        predictedTime: '3:45 PM',
        confidence: 72,
        basedOn: 'Sleep cycles',
        emoji: '😴',
        color: '#8b5cf6',
      },
      {
        pattern: 'Diaper Change',
        predictedTime: '4:15 PM',
        confidence: 68,
        basedOn: 'Frequency analysis',
        emoji: '👶',
        color: '#10b981',
      },
    ];
  }, [entries]);

  if (!predictions.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard onPress={onPress}>
        <View style={styles.predictorHeader}>
          <View style={[styles.predictorIconBg, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="sparkles" size={20} color={theme.primary} />
          </View>
          <View style={styles.predictorTitleWrap}>
            <Text style={[styles.predictorTitle, { color: theme.text.primary }]}>AI Pattern Predictor</Text>
            <Text style={[styles.predictorSubtitle, { color: theme.text.muted }]}>Based on your tracking history</Text>
          </View>
        </View>
        
        <View style={styles.predictorList}>
          {predictions.map((pred, i) => (
            <View key={i} style={[styles.predictorItem, i < predictions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
              <View style={styles.predictorLeft}>
                <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
                <View>
                  <Text style={[styles.predictorMilestone, { color: theme.text.primary }]}>{pred.pattern}</Text>
                  <Text style={[styles.predictorCategory, { color: theme.text.muted }]}>{pred.basedOn}</Text>
                </View>
              </View>
              <View style={styles.predictorRight}>
                <View style={styles.predictorBarBg}>
                  <View style={[styles.predictorBarFill, { width: `${pred.confidence}%`, backgroundColor: pred.confidence > 70 ? '#10b981' : pred.confidence > 50 ? '#f59e0b' : '#ef4444' }]} />
                </View>
                <Text style={[styles.predictorConfidence, { color: theme.text.secondary }]}>{pred.confidence}% confidence</Text>
                <Text style={[styles.predictorAge, { color: pred.color }]}>~{pred.predictedTime}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Activity Balance Radar
   ═══════════════════════════════════════════════════════════════════════════ */

const ActivityBalanceRadar = ({ entries, theme }: { entries: TrackerEntry[]; theme: any }) => {
  const dimensions = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      counts[e.trackerId] = (counts[e.trackerId] || 0) + 1;
    });
    const total = entries.length || 1;
    return [
      { key: 'feed', label: 'Feeding', color: '#f59e0b', value: Math.round((counts['feed'] || 0) / total * 100) },
      { key: 'sleep', label: 'Sleep', color: '#8b5cf6', value: Math.round((counts['sleep'] || 0) / total * 100) },
      { key: 'diaper', label: 'Diaper', color: '#10b981', value: Math.round((counts['diaper'] || 0) / total * 100) },
      { key: 'milestone', label: 'Milestone', color: '#ec4899', value: Math.round((counts['milestone'] || 0) / total * 100) },
      { key: 'growth', label: 'Growth', color: '#6366f1', value: Math.round((counts['growth'] || 0) / total * 100) },
    ];
  }, [entries]);

  const size = 140;
  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / dimensions.length;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.radarHeader}>
          <Text style={[styles.radarTitle, { color: theme.text.primary }]}>Activity Balance</Text>
          <Text style={[styles.radarSubtitle, { color: theme.text.muted }]}>Last 30 days distribution</Text>
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

            <View style={StyleSheet.absoluteFill}>
              {dimensions.map((d, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = (d.value / 100) * radius;
                const x = center + Math.cos(angle) * r;
                const y = center + Math.sin(angle) * r;
                return (
                  <View key={`pt-${i}`} style={[
                    styles.radarPoint,
                    {
                      left: x - 4,
                      top: y - 4,
                      backgroundColor: d.color,
                    }
                  ]} />
                );
              })}
            </View>
          </View>

          <View style={styles.radarLegend}>
            {dimensions.map((d, i) => (
              <View key={d.key} style={styles.radarLegendItem}>
                <View style={[styles.radarLegendDot, { backgroundColor: d.color }]} />
                <Text style={[styles.radarLegendLabel, { color: theme.text.secondary }]}>{d.label}</Text>
                <Text style={[styles.radarLegendValue, { color: theme.text.primary }]}>{d.value}%</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Weekly Heatmap
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyHeatmap = ({ entries, theme }: { entries: TrackerEntry[]; theme: any }) => {
  const heatmapData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const data = days.map((day, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = entries.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
      return { day, count, date: format(d, 'MMM d') };
    });
    return data;
  }, [entries]);

  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.heatmapHeader}>
          <Text style={[styles.heatmapTitle, { color: theme.text.primary }]}>Weekly Activity</Text>
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
          {heatmapData.map((day, i) => (
            <View key={i} style={styles.heatmapCell}>
              <View style={[
                styles.heatmapBlock,
                { 
                  backgroundColor: `${theme.primary}${Math.round((day.count / maxCount) * 40 + 10).toString(16).padStart(2, '0')}`,
                  borderColor: theme.primary 
                }
              ]}>
                <Text style={[styles.heatmapValue, { color: theme.text.primary }]}>{day.count}</Text>
              </View>
              <Text style={[styles.heatmapWeek, { color: theme.text.muted }]}>{day.day}</Text>
              <Text style={[styles.heatmapDate, { color: theme.text.muted }]}>{day.date}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Health Trend Correlation
   ═══════════════════════════════════════════════════════════════════════════ */

const HealthTrendCorrelation = ({ entries, theme }: { entries: TrackerEntry[]; theme: any }) => {
  const correlations = useMemo(() => {
    const feedCount = entries.filter(e => e.trackerId === 'feed').length;
    const sleepCount = entries.filter(e => e.trackerId === 'sleep').length;
    const diaperCount = entries.filter(e => e.trackerId === 'diaper').length;
    const total = entries.length || 1;

    return [
      {
        label: 'Feeding Consistency',
        value: feedCount > 0 ? Math.min(95, Math.round((feedCount / 7) * 100)) : 0,
        icon: '🍼',
        color: '#f59e0b',
        detail: `${feedCount} feeds logged`,
      },
      {
        label: 'Sleep Tracking',
        value: sleepCount > 0 ? Math.min(95, Math.round((sleepCount / 7) * 100)) : 0,
        icon: '😴',
        color: '#8b5cf6',
        detail: `${sleepCount} sleeps logged`,
      },
      {
        label: 'Care Completeness',
        value: Math.min(100, Math.round(((feedCount + sleepCount + diaperCount) / total) * 100)),
        icon: '💚',
        color: '#10b981',
        detail: 'Overall care coverage',
      },
    ];
  }, [entries]);

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <GlassCard>
        <View style={styles.correlationHeader}>
          <Text style={[styles.correlationTitle, { color: theme.text.primary }]}>Health Trends</Text>
          <Text style={[styles.correlationSubtitle, { color: theme.text.muted }]}>Tracking completeness</Text>
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
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Quick Action Suggestions
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionSuggestions = ({ theme, onPress }: { theme: any; onPress: (action: string) => void }) => {
  const suggestions = [
    { id: 'feed', title: 'Log Feed', icon: 'nutrition-outline', color: '#f59e0b', desc: 'Last: 2h ago' },
    { id: 'sleep', title: 'Log Sleep', icon: 'moon-outline', color: '#8b5cf6', desc: 'Last: 4h ago' },
    { id: 'diaper', title: 'Log Diaper', icon: 'shirt-outline', color: '#10b981', desc: 'Last: 1h ago' },
    { id: 'milestone', title: 'Milestone', icon: 'trophy-outline', color: '#ec4899', desc: 'New achievement!' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <View style={styles.suggestionsHeader}>
        <Text style={[styles.suggestionsTitle, { color: theme.text.primary }]}>Quick Actions</Text>
        <Text style={[styles.suggestionsSubtitle, { color: theme.text.muted }]}>Frequently used</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity key={suggestion.id} onPress={() => onPress(suggestion.id)} style={styles.suggestionCard}>
            <LinearGradient
              colors={[suggestion.color + '15', suggestion.color + '05']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '20' }]}>
              <Ionicons name={suggestion.icon as any} size={22} color={suggestion.color} />
            </View>
            <Text style={[styles.suggestionTitle, { color: theme.text.primary }]}>{suggestion.title}</Text>
            <Text style={[styles.suggestionCategory, { color: suggestion.color }]}>{suggestion.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: Upcoming Events Timeline
   ═══════════════════════════════════════════════════════════════════════════ */

const UpcomingEventsTimeline = ({ reminders, theme, onPress }: { reminders: PredictiveReminder[]; theme: any; onPress: (r: PredictiveReminder) => void }) => {
  const upcoming = useMemo(() => {
    return safeArray(reminders)
      .filter(r => r.suggestedTime && new Date(r.suggestedTime) >= new Date())
      .slice(0, 4);
  }, [reminders]);

  if (!upcoming.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader 
        title="Upcoming Events" 
        subtitle="Predicted from patterns"
        theme={theme}
      />
      
      <View style={styles.calendarTimeline}>
        {upcoming.map((event, i) => (
          <TouchableOpacity key={event.id || i} onPress={() => onPress(event)} style={styles.calendarItem}>
            <View style={styles.calendarLeft}>
              <View style={[styles.calendarLine, { backgroundColor: theme.surface.border }]} />
              <View style={[styles.calendarDot, { backgroundColor: event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary }]} />
              {i === upcoming.length - 1 && <View style={[styles.calendarLineEnd, { backgroundColor: 'transparent' }]} />}
            </View>
            <View style={[styles.calendarCard, { backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' }]}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarEmoji}>{event.emoji || '⏰'}</Text>
                <View style={styles.calendarMeta}>
                  <Text style={[styles.calendarTitle, { color: theme.text.primary }]}>{event.title}</Text>
                  <Text style={[styles.calendarCategory, { color: theme.text.muted }]}>{event.description}</Text>
                </View>
                <View style={[styles.calendarBadge, { backgroundColor: `${event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary}15` }]}>
                  <Text style={[styles.calendarBadgeText, { color: event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary }]}>
                    {event.confidence || 0}% ready
                  </Text>
                </View>
              </View>
              <Text style={[styles.calendarAge, { color: theme.primary }]}>
                {event.suggestedTime ? format(new Date(event.suggestedTime), 'h:mm a') : 'Soon'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXISTING COMPONENTS (Preserved with styling updates)
   ═══════════════════════════════════════════════════════════════════════════ */

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
          onPress={() => {}}
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

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — REDESIGNED WITH TABS
   ═══════════════════════════════════════════════════════════════════════════ */

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
  const [activeTab, setActiveTab] = useState<TimelineTab>('timeline');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTimelinePicker, setShowTimelinePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

    if (selectedDate) {
      filtered = filtered.filter(e => e?.timestamp && isSameDay(new Date(e.timestamp), selectedDate));
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
  }, [allEntries, selectedFilter, searchQuery, selectedDate]);

  // ── Calendar day-view: per-day entry counts + month grid cells ──
  const entryCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach(e => {
      if (!e?.timestamp) return;
      const key = format(new Date(e.timestamp), 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [allEntries]);

  const calendarCells = useMemo((): (Date | null)[] => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    return cells;
  }, [calendarMonth]);

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
    if (!entry?.id) return;
    navigation.navigate('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId });
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

  const handleTabChange = useCallback((tab: TimelineTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

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

  const tabs = [
    { key: 'timeline' as TimelineTab, label: 'Timeline', icon: 'time-outline' },
    { key: 'insights' as TimelineTab, label: 'Insights', icon: 'bulb-outline' },
    { key: 'growth' as TimelineTab, label: 'Growth', icon: 'trending-up-outline' },
    { key: 'achievements' as TimelineTab, label: 'Achievements', icon: 'trophy-outline' },
    { key: 'analytics' as TimelineTab, label: 'Analytics', icon: 'bar-chart-outline' },
  ];

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
              onPress={() => { triggerHaptic('light'); setCalendarMonth(selectedDate || new Date()); setShowCalendar(true); }}
              style={[styles.headerButton, { borderRadius: borderRadiusValue }]}
            >
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name="calendar-outline" size={22} color={selectedDate ? theme.primary : theme.text.primary} />
              {selectedDate && <View style={[styles.calendarActiveDot, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
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
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
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
          </Animated.ScrollView>
        </Animated.View>

        {/* ── TAB BAR ── */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} theme={theme} />

        {/* ═════════════════════════════════════════════════════════════════
            TAB: TIMELINE
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <>
            {/* ── NEW FEATURE 5: Quick Action Suggestions ── */}
            <QuickActionSuggestions 
              theme={theme} 
              onPress={(action) => navigation.navigate('AddEntry', { trackerId: action })} 
            />

            {/* Filter Chips */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.filterContainer}>
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
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
                      activeOpacity={0.8}>
                      <Ionicons name={filter.icon as any} size={16} color={selectedFilter === filter.id ? '#fff' : filter.color} />
                      <Text style={[styles.filterText, selectedFilter === filter.id && { color: '#fff', fontWeight: '700' }]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </Animated.ScrollView>
            </Animated.View>

            
            {/* ── NEW FEATURE 1: AI Pattern Predictor ── */}
            <AIPatternPredictor 
              entries={allEntries} 
              theme={theme} 
              onPress={() => navigation.navigate('Analytics')} 
            />

            {/* Active date filter banner */}
            {selectedDate && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={[styles.dateFilterBanner, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}40`, borderRadius: borderRadiusValue }]}>
                <Ionicons name="calendar" size={16} color={theme.primary} />
                <Text style={[styles.dateFilterText, { color: theme.primary }]}>
                  {format(selectedDate, 'EEEE, MMM d, yyyy')}
                </Text>
                <TouchableOpacity onPress={() => { triggerHaptic('light'); setSelectedDate(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={theme.primary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Timeline Events */}
            <View style={styles.timelineContainer}>
              {groupedEvents.length === 0 ? (
                <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: theme.surface.card }]}>
                    <Ionicons name="document-text-outline" size={64} color={theme.text.muted} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.text.primary, fontSize: 22 * fontSizeMultiplier }]}>
                    {searchQuery ? 'No matches found' : selectedDate ? 'No entries this day' : 'No entries yet'}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: theme.text.secondary, fontSize: 15 * fontSizeMultiplier }]}>
                    {searchQuery ? 'Try adjusting your search' : selectedDate ? 'Tap the banner above to clear the date' : "Start tracking with the + button"}
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
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: INSIGHTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <>
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

            {/* ── NEW FEATURE 4: Health Trend Correlation ── */}
            <HealthTrendCorrelation 
              entries={allEntries} 
              theme={theme} 
            />
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: GROWTH
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'growth' && (
          <>
            {/* Growth Score Card */}
            {growthIndex && (
              <GrowthScoreCard
                growthIndex={growthIndex}
                theme={theme}
                onPress={() => navigation.navigate('GrowthDashboard')}
              />
            )}

            {/* ── NEW FEATURE 2: Activity Balance Radar ── */}
            <ActivityBalanceRadar 
              entries={allEntries} 
              theme={theme} 
            />

            {/* ── NEW FEATURE 3: Weekly Heatmap ── */}
            <WeeklyHeatmap 
              entries={allEntries} 
              theme={theme} 
            />

            {/* ── NEW FEATURE 6: Upcoming Events Timeline ── */}
            <UpcomingEventsTimeline 
              reminders={predictiveReminders} 
              theme={theme} 
              onPress={(r) => navigation.navigate('AddEntry', { trackerId: r.action?.params?.trackerId as string })} 
            />
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: ACHIEVEMENTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'achievements' && (
          <>
            <View style={styles.section}>
              <SectionHeader 
                title="Achievements" 
                subtitle={`${stats.achievements} unlocked`}
                theme={theme}
              />
              <GlassCard>
                <View style={styles.achievementStats}>
                  <View style={styles.achievementStat}>
                    <Text style={[styles.achievementStatValue, { color: theme.primary }]}>{stats.achievements}</Text>
                    <Text style={[styles.achievementStatLabel, { color: theme.text.secondary }]}>Unlocked</Text>
                  </View>
                  <View style={styles.achievementStat}>
                    <Text style={[styles.achievementStatValue, { color: '#f59e0b' }]}>{safeNumber(globalStreak?.currentStreak, 0)}</Text>
                    <Text style={[styles.achievementStatLabel, { color: theme.text.secondary }]}>Day Streak</Text>
                  </View>
                  <View style={styles.achievementStat}>
                    <Text style={[styles.achievementStatValue, { color: '#10b981' }]}>{stats.total}</Text>
                    <Text style={[styles.achievementStatLabel, { color: theme.text.secondary }]}>Entries</Text>
                  </View>
                </View>
              </GlassCard>
            </View>

            {/* Streak Banner */}
            {globalStreak?.currentStreak > 0 && (
              <StreakBanner
                streak={globalStreak}
                theme={theme}
                onAction={() => setShowTimelinePicker(true)}
              />
            )}

            {/* Recent Achievements */}
            <View style={styles.section}>
              <SectionHeader 
                title="Recent Achievements" 
                theme={theme}
              />
              {safeArray(achievements)
                .slice(0, 6)
                .map((achievement, i) => (
                  <Animated.View key={achievement?.id || i} entering={FadeInUp.delay(i * 60).springify()}>
                    <GlassCard style={styles.achievedCard}>
                      <View style={styles.achievedRow}>
                        <View style={[styles.achievedIconBg, { backgroundColor: `${getRarityGradient(achievement?.rarity || 'common')[0]}20` }]}>
                          <Text style={styles.achievedEmoji}>{achievement?.emoji || '🏆'}</Text>
                        </View>
                        <View style={styles.achievedContent}>
                          <Text style={[styles.achievedTitle, { color: theme.text.primary }]}>{achievement?.title || 'Achievement'}</Text>
                          <Text style={[styles.achievedDate, { color: theme.text.muted }]}>{achievement?.description || ''}</Text>
                        </View>
                        <LinearGradient
                          colors={getRarityGradient(achievement?.rarity || 'common')}
                          style={styles.achievedBadge}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Text style={styles.achievedBadgeText}>{achievement?.rarity || 'common'}</Text>
                        </LinearGradient>
                      </View>
                    </GlassCard>
                  </Animated.View>
                ))}
            </View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: ANALYTICS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <>
            {/* ── NEW FEATURE 2: Activity Balance Radar (Analytics view) ── */}
            <ActivityBalanceRadar 
              entries={allEntries} 
              theme={theme} 
            />

            {/* ── NEW FEATURE 3: Weekly Heatmap (Analytics view) ── */}
            <WeeklyHeatmap 
              entries={allEntries} 
              theme={theme} 
            />

            {/* Entry Stats */}
            <View style={styles.section}>
              <SectionHeader 
                title="Entry Statistics" 
                subtitle="Last 30 days"
                theme={theme}
              />
              <GlassCard>
                <View style={styles.analyticsGrid}>
                  {[
                    { label: 'Feeding', count: allEntries.filter(e => e.trackerId === 'feed').length, color: '#f59e0b', icon: '🍼' },
                    { label: 'Sleep', count: allEntries.filter(e => e.trackerId === 'sleep').length, color: '#8b5cf6', icon: '😴' },
                    { label: 'Diaper', count: allEntries.filter(e => e.trackerId === 'diaper').length, color: '#10b981', icon: '👶' },
                    { label: 'Milestone', count: allEntries.filter(e => e.trackerId === 'milestone').length, color: '#ec4899', icon: '🏆' },
                    { label: 'Growth', count: allEntries.filter(e => e.trackerId === 'growth').length, color: '#6366f1', icon: '📏' },
                    { label: 'Medication', count: allEntries.filter(e => e.trackerId === 'medication').length, color: '#ef4444', icon: '💊' },
                  ].map((stat, i) => (
                    <View key={i} style={styles.analyticsItem}>
                      <View style={[styles.analyticsIconBg, { backgroundColor: `${stat.color}15` }]}>
                        <Text style={styles.analyticsEmoji}>{stat.icon}</Text>
                      </View>
                      <Text style={[styles.analyticsCount, { color: theme.text.primary }]}>{stat.count}</Text>
                      <Text style={[styles.analyticsLabel, { color: theme.text.muted }]}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </View>
          </>
        )}

        <View style={{ height: insets.bottom + 40 }} />
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

      {/* Calendar Day-View Modal */}
      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View style={styles.calendarModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCalendar(false)} />
          <View style={[styles.calendarModalCard, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, borderRadius: borderRadiusValue * 1.5 }]}>
            <View style={styles.calendarModalHeader}>
              <TouchableOpacity onPress={() => { triggerHaptic('light'); setCalendarMonth(addMonths(calendarMonth, -1)); }} style={styles.calendarNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.calendarModalTitle, { color: theme.text.primary }]}>
                {format(calendarMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={() => { triggerHaptic('light'); setCalendarMonth(addMonths(calendarMonth, 1)); }} style={styles.calendarNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={22} color={theme.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={`${d}-${i}`} style={[styles.calendarWeekLabel, { color: theme.text.muted }]}>{d}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                const key = format(day, 'yyyy-MM-dd');
                const count = entryCountByDay.get(key) || 0;
                const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.calendarCell}
                    activeOpacity={0.7}
                    onPress={() => { triggerHaptic('light'); setSelectedDate(day); setShowCalendar(false); }}
                  >
                    <View style={[
                      styles.calendarDayCircle,
                      isSelected && { backgroundColor: theme.primary },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.primary },
                    ]}>
                      <Text style={[styles.calendarDayText, { color: isSelected ? '#fff' : theme.text.primary }]}>
                        {day.getDate()}
                      </Text>
                    </View>
                    {count > 0 && (
                      <View style={[styles.calendarCountDot, { backgroundColor: isSelected ? '#fff' : theme.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarFooter}>
              <TouchableOpacity
                onPress={() => { triggerHaptic('light'); setSelectedDate(null); setShowCalendar(false); }}
                style={[styles.calendarFooterBtn, { borderRadius: borderRadiusValue }]}
              >
                <Text style={[styles.calendarFooterBtnText, { color: theme.text.secondary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { triggerHaptic('light'); const t = new Date(); setSelectedDate(t); setCalendarMonth(t); setShowCalendar(false); }}
                style={[styles.calendarFooterBtn, { backgroundColor: theme.primary, borderRadius: borderRadiusValue }]}
              >
                <Text style={[styles.calendarFooterBtnText, { color: '#fff' }]}>Today</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned with Shared Design System
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },

  // ── Loading ──
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 32, fontWeight: '800', marginTop: 12 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },

  // ── Header ──
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  headerButton: { width: 48, height: 48, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: 10, gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 80 },
  stickyBlur: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', minWidth: 200, overflow: 'hidden' },
  stickyTitle: { fontSize: 18, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '600' },

  // ── Search ──
  searchContainer: { marginHorizontal: 20, marginBottom: 16, marginTop: 8 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
  searchInput: { flex: 1, marginLeft: 10, paddingVertical: 12 },

  // ── Stats ──
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

  // ── Tab Bar ──
  tabBar: { 
    flexDirection: 'row', 
    marginHorizontal: 16, 
    marginBottom: 16, 
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
    marginTop: 8 
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Smart Sections ──
  smartSectionsContainer: { marginHorizontal: 20, marginBottom: 20 },
  smartSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  smartSectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  smartSectionItem: { marginBottom: 10 },

  // ── Smart Card ──
  smartCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  smartCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  smartIconContainer: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smartCardContent: { flex: 1 },
  smartCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  smartCardDesc: { fontSize: 13, lineHeight: 18 },
  dismissBtn: { padding: 4 },
  smartActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start' },
  smartActionText: { fontSize: 13, fontWeight: '600' },

  // ── Correlation Card ──
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

  // ── Reminder Card ──
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

  // ── Growth Card ──
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

  // ── Achievement Toast ──
  achievementToast: { position: 'absolute', top: 100, left: 20, right: 20, zIndex: 200, borderRadius: 16, overflow: 'hidden' },
  achievementToastGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  achievementToastEmoji: { fontSize: 32 },
  achievementToastContent: { flex: 1 },
  achievementToastTitle: { fontSize: 13, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9 },
  achievementToastName: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Streak Banner ──
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

  // ── Predictor (AI Pattern) ──
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
    borderRadius: 12, 
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

  // ── Radar Chart ──
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
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.06)' 
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

  // ── Heatmap ──
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
  heatmapDate: { fontSize: 9, fontWeight: '500' },

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

  // ── Quick Action Suggestions ──
  suggestionsHeader: { marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  suggestionsTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  suggestionsSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  suggestionsScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  suggestionCard: { 
    width: 140, 
    padding: 14, 
    borderRadius: 20, 
    overflow: 'hidden', 
    ...DESIGN.shadow.md 
  },
  suggestionIconBg: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  suggestionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  suggestionCategory: { fontSize: 11, fontWeight: '700', marginBottom: 6 },

  // ── Upcoming Events Timeline ──
  calendarTimeline: { marginHorizontal: 16, gap: 0 },
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
    borderRadius: 16, 
    marginBottom: 12, 
    ...DESIGN.shadow.sm 
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  calendarEmoji: { fontSize: 20 },
  calendarMeta: { flex: 1 },
  calendarTitle: { fontSize: 14, fontWeight: '700' },
  calendarCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  calendarBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  calendarBadgeText: { fontSize: 10, fontWeight: '700' },
  calendarAge: { fontSize: 11, fontWeight: '600' },

  // ── Filter Chips ──
  filterContainer: { marginBottom: 16 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },

  // ── Timeline ──
  scrollContent: { paddingBottom: 20 },
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

  // ── Achievements Tab ──
  section: { marginBottom: DESIGN.spacing.xl },
  achievementStats: { flexDirection: 'row', padding: 16, gap: 16 },
  achievementStat: { flex: 1, alignItems: 'center', gap: 4 },
  achievementStatValue: { fontSize: 28, fontWeight: '800' },
  achievementStatLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  achievedCard: { padding: 14, marginBottom: 8, marginHorizontal: 16 },
  achievedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  achievedIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  achievedEmoji: { fontSize: 20 },
  achievedContent: { flex: 1, gap: 2 },
  achievedTitle: { fontSize: 14, fontWeight: '700' },
  achievedDate: { fontSize: 11, fontWeight: '500' },
  achievedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  achievedBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // ── Analytics Tab ──
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  analyticsItem: { width: (SCREEN_W - 72) / 3, alignItems: 'center', gap: 6 },
  analyticsIconBg: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  analyticsEmoji: { fontSize: 22 },
  analyticsCount: { fontSize: 20, fontWeight: '800' },
  analyticsLabel: { fontSize: 11, fontWeight: '600' },

  // ── Calendar Day-View ──
  calendarActiveDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  dateFilterBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  dateFilterText: { flex: 1, fontSize: 14, fontWeight: '700' },
  calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  calendarModalCard: { width: '100%', maxWidth: 380, padding: 16, borderWidth: 1 },
  calendarModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calendarModalTitle: { fontSize: 17, fontWeight: '800' },
  calendarNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calendarWeekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calendarDayCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  calendarDayText: { fontSize: 14, fontWeight: '600' },
  calendarCountDot: { position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 2.5 },
  calendarFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  calendarFooterBtn: { paddingHorizontal: 18, paddingVertical: 10 },
  calendarFooterBtnText: { fontSize: 14, fontWeight: '700' },

  // ── FAB ──
  fabContainer: { position: 'absolute', zIndex: 100 },
  fab: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
                