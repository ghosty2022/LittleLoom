// AddEntryScreen.tsx
// FIXED: Hook order violation resolved — useTrackerProgressive moved to inner component

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  Dimensions, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View, UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday, subDays, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';

import { useTracker } from '../../context/TrackerContext';
import { UnifiedTrackerConfig } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';
import { DynamicTrackerForm } from '../../components/trackers/DynamicTrackerForm';
import { useTrackerProgressive } from '../../hooks/useTrackerProgressive';
import type { ProgressiveCorrelation, ProgressiveReminder } from '../../hooks/useTrackerProgressive';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

type AddEntryRouteProp = RouteProp<RootStackParamList, 'AddEntry'>;
type AddEntryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface YesterdayEntry {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
  notes?: string;
  tags?: string[];
  title?: string;
}

interface QuickTemplate {
  id: string;
  label: string;
  icon: string;
  data: Record<string, unknown>;
  color: string;
}

interface SmartSuggestion {
  id: string;
  fieldId: string;
  label: string;
  value: unknown;
  confidence: number;
  reason: string;
}

interface ContextInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'tip' | 'trend';
  message: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
}

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const MODAL_BACKDROP_OPACITY = 0.5;
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

const formatFieldValue = (key: string, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getEntryFields = (entry: YesterdayEntry) => {
  return Object.entries(entry.data || {}).filter(([k, v]) => {
    if (['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k)) return false;
    return formatFieldValue(k, v) !== null;
  });
};

const shouldFilterField = (k: string) =>
  ['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k);

// ─── GlassCard ────────────────────────────────────────────────

const GlassCard = memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      glassStyles.glassCard,
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
      <View style={[glassStyles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={glassStyles.glassContent}>{children}</View>
    </Wrapper>
  );
});

const glassStyles = StyleSheet.create({
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DESIGN.shadow.md,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },
});

// ─── SmartContextHeader ─────────────────────────────────────────

const SmartContextHeader = memo(({
  tracker, currentBaby, lastEntryTime, entriesToday, colors, borderRadiusValue, fontSizeMultiplier,
}: any) => {
  const now = new Date();
  const hour = now.getHours();
  const timeLabel = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const timeIcon = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';

  const timeSinceLast = lastEntryTime ? differenceInMinutes(now, lastEntryTime) : null;
  const timeSinceText = timeSinceLast !== null
    ? timeSinceLast < 60 ? `${timeSinceLast}m ago`
    : timeSinceLast < 1440 ? `${Math.floor(timeSinceLast / 60)}h ago`
    : `${Math.floor(timeSinceLast / 1440)}d ago`
    : 'No recent entries';

  return (
    <Animated.View entering={FadeInUp.springify()}>
      <GlassCard>
        <View style={contextStyles.container}>
          <View style={contextStyles.topRow}>
            <View style={[contextStyles.timeBadge, { backgroundColor: `${tracker.gradient[0]}15` }]}>
              <Ionicons name={timeIcon as any} size={16} color={tracker.gradient[0]} />
              <Text style={[contextStyles.timeBadgeText, { color: tracker.gradient[0] }]}>{timeLabel}</Text>
            </View>
            <View style={[contextStyles.countBadge, { backgroundColor: colors.glassBg }]}>
              <Text style={[contextStyles.countText, { color: colors.textSecondary }]}>{entriesToday} today</Text>
            </View>
          </View>
          <View style={contextStyles.middleRow}>
            <SafeAvatar avatar={currentBaby?.avatar} size={48} fallbackIcon="person" borderColor={tracker.gradient[0]} borderWidth={2} animated={false} />
            <View style={contextStyles.infoColumn}>
              <Text style={[contextStyles.babyName, { color: colors.text, fontSize: 18 * fontSizeMultiplier }]}>{currentBaby?.name || 'Baby'}</Text>
              <Text style={[contextStyles.trackerLabel, { color: colors.textSecondary }]}>{tracker.emoji} {tracker.name}</Text>
            </View>
            {lastEntryTime && (
              <View style={contextStyles.lastEntryBox}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted || colors.textSecondary} />
                <Text style={[contextStyles.lastEntryText, { color: colors.textMuted || colors.textSecondary }]}>{timeSinceText}</Text>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const contextStyles = StyleSheet.create({
  container: { padding: DESIGN.spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DESIGN.spacing.md },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: DESIGN.radius.sm },
  timeBadgeText: { fontSize: 13, fontWeight: '700' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: DESIGN.radius.sm },
  countText: { fontSize: 12, fontWeight: '600' },
  middleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoColumn: { flex: 1 },
  babyName: { fontWeight: '800', letterSpacing: -0.3 },
  trackerLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  lastEntryBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastEntryText: { fontSize: 12, fontWeight: '500' },
});

// ─── QuickTemplateStrip ─────────────────────────────────────────

const QuickTemplateStrip = memo(({ templates, tracker, onSelect, colors, borderRadiusValue }: any) => {
  if (!templates || templates.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <View style={templateStyles.header}>
        <Text style={[templateStyles.headerTitle, { color: colors.text }]}>Quick Templates</Text>
        <Text style={[templateStyles.headerSubtitle, { color: colors.textSecondary }]}>Tap to prefill</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={templateStyles.scrollContent}>
        {templates.map((tmpl: QuickTemplate) => (
          <TouchableOpacity key={tmpl.id} onPress={() => { HAPTIC_LIGHT(); onSelect(tmpl); }}
            style={[templateStyles.chip, { backgroundColor: `${tmpl.color}12`, borderColor: `${tmpl.color}30`, borderWidth: 1, borderRadius: borderRadiusValue }]}
            activeOpacity={0.8}>
            <Text style={templateStyles.chipIcon}>{tmpl.icon}</Text>
            <Text style={[templateStyles.chipLabel, { color: colors.text }]}>{tmpl.label}</Text>
            <Ionicons name="flash-outline" size={12} color={tmpl.color} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const templateStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.sm, marginTop: DESIGN.spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '500' },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg, gap: 10, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  chipIcon: { fontSize: 18 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
});

// ─── SmartSuggestionChips ───────────────────────────────────────

const SmartSuggestionChips = memo(({ suggestions, appliedSuggestions, onApply, onDismiss, theme, colors, borderRadiusValue }: any) => {
  const visible = suggestions.filter((s: SmartSuggestion) => !appliedSuggestions.has(s.id) && s.confidence >= 60);
  if (visible.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <View style={suggestionStyles.header}>
        <Ionicons name="sparkles" size={16} color={theme.primary} />
        <Text style={[suggestionStyles.headerTitle, { color: colors.text }]}>Smart Suggestions</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={suggestionStyles.scrollContent}>
        {visible.map((s: SmartSuggestion) => (
          <TouchableOpacity key={s.id} onPress={() => { HAPTIC_LIGHT(); onApply(s); }}
            style={[suggestionStyles.chip, { backgroundColor: s.confidence >= 90 ? `${theme.primary}15` : `${theme.primary}08`, borderColor: s.confidence >= 90 ? `${theme.primary}40` : `${theme.primary}20`, borderWidth: 1, borderRadius: borderRadiusValue }]}
            activeOpacity={0.8}>
            <View style={[suggestionStyles.confidenceDot, { backgroundColor: s.confidence >= 90 ? '#10b981' : s.confidence >= 75 ? '#f59e0b' : '#ef4444' }]} />
            <Text style={[suggestionStyles.chipLabel, { color: colors.text }]}>{s.label}</Text>
            <Text style={[suggestionStyles.chipValue, { color: colors.textSecondary }]}>{String(s.value)}</Text>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDismiss(s.id); }} style={suggestionStyles.dismissBtn}>
              <Ionicons name="close" size={14} color={colors.textMuted || colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const suggestionStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.sm, marginTop: DESIGN.spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg, gap: 10, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  chipValue: { fontSize: 12, fontWeight: '600' },
  dismissBtn: { marginLeft: 4, padding: 2 },
});

// ─── TimeWheelSelector ──────────────────────────────────────────

const TimeWheelSelector = memo(({ date, onDateChange, onTimeChange, trackerColor, colors, borderRadiusValue, fontSizeMultiplier }: any) => {
  const timeBlocks = useMemo(() => {
    const blocks: { label: string; time: string; period: string; isSuggested: boolean }[] = [];
    for (let h = 6; h <= 22; h += 2) {
      const d = new Date(date);
      d.setHours(h, 0, 0, 0);
      const label = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      const isSuggested = Math.abs(d.getHours() - date.getHours()) <= 1;
      blocks.push({ label, time: format(d, 'h:mm a'), period: h < 12 ? 'AM' : 'PM', isSuggested });
    }
    return blocks;
  }, [date]);

  const isTodayDate = isToday(date);
  const isYesterdayDate = isYesterday(date);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <View style={timeWheelStyles.header}>
        <Text style={[timeWheelStyles.headerTitle, { color: colors.text }]}>When</Text>
        <View style={timeWheelStyles.dateRow}>
          <TouchableOpacity onPress={onDateChange} style={[timeWheelStyles.dateChip, { backgroundColor: colors.glassBg, borderRadius: borderRadiusValue }]}>
            <Ionicons name="calendar-outline" size={16} color={trackerColor} />
            <Text style={[timeWheelStyles.dateChipText, { color: colors.text }]}>
              {isTodayDate ? 'Today' : isYesterdayDate ? 'Yesterday' : format(date, 'EEE, MMM d')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDateChange} style={[timeWheelStyles.timeChip, { backgroundColor: `${trackerColor}12`, borderRadius: borderRadiusValue }]}>
            <Ionicons name="time-outline" size={16} color={trackerColor} />
            <Text style={[timeWheelStyles.timeChipText, { color: trackerColor, fontWeight: '800' }]}>{format(date, 'h:mm a')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={timeWheelStyles.scrollContent}>
        {timeBlocks.map((block, i) => (
          <TouchableOpacity key={i} onPress={() => {
            HAPTIC_LIGHT();
            const newDate = new Date(date);
            const hourPart = parseInt(block.time.split(':')[0]);
            const isPM = block.period === 'PM' && hourPart !== 12;
            const isAM = block.period === 'AM' && hourPart === 12;
            const h = isPM ? hourPart + 12 : isAM ? 0 : hourPart;
            newDate.setHours(h, 0, 0, 0);
            onTimeChange(newDate);
          }} style={[timeWheelStyles.block, { backgroundColor: block.isSuggested ? `${trackerColor}15` : colors.glassBg, borderColor: block.isSuggested ? `${trackerColor}40` : `${colors.border}60`, borderWidth: 1, borderRadius: borderRadiusValue }]}>
            <Text style={[timeWheelStyles.blockLabel, { color: colors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>{block.label}</Text>
            <Text style={[timeWheelStyles.blockTime, { color: block.isSuggested ? trackerColor : colors.text, fontSize: 14 * fontSizeMultiplier }]}>{block.time}</Text>
            {block.isSuggested && (
              <View style={[timeWheelStyles.suggestedBadge, { backgroundColor: trackerColor }]}>
                <Text style={timeWheelStyles.suggestedText}>Now</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const timeWheelStyles = StyleSheet.create({
  header: { marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.sm, marginTop: DESIGN.spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: DESIGN.spacing.sm },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: DESIGN.spacing.md },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, flex: 1 },
  dateChipText: { fontSize: 14, fontWeight: '700', flex: 1 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  timeChipText: { fontSize: 14, fontWeight: '800' },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg, gap: 10, paddingBottom: 4 },
  block: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginRight: 8, gap: 4 },
  blockLabel: { fontWeight: '600' },
  blockTime: { fontWeight: '800' },
  suggestedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  suggestedText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ─── ContextInsightsStrip ───────────────────────────────────────

const ContextInsightsStrip = memo(({ insights, onAction, colors, borderRadiusValue }: any) => {
  if (!insights || insights.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <View style={insightStripStyles.header}>
        <Ionicons name="analytics-outline" size={16} color={colors.textSecondary} />
        <Text style={[insightStripStyles.headerTitle, { color: colors.text }]}>Context Insights</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={insightStripStyles.scrollContent}>
        {insights.map((insight: ContextInsight) => (
          <TouchableOpacity key={insight.id} onPress={() => onAction(insight)}
            style={[insightStripStyles.card, { backgroundColor: `${insight.color}08`, borderLeftWidth: 3, borderLeftColor: insight.color, borderRadius: borderRadiusValue }]}
            activeOpacity={0.85}>
            <Text style={insightStripStyles.cardEmoji}>{insight.emoji}</Text>
            <Text style={[insightStripStyles.cardMessage, { color: colors.text }]} numberOfLines={2}>{insight.message}</Text>
            <View style={[insightStripStyles.priorityBadge, { backgroundColor: `${insight.color}15` }]}>
              <Text style={[insightStripStyles.priorityText, { color: insight.color }]}>{insight.priority}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

const insightStripStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.sm, marginTop: DESIGN.spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg, gap: 10, paddingBottom: 4 },
  card: { width: 200, padding: 14, marginRight: 8, gap: 6 },
  cardEmoji: { fontSize: 22 },
  cardMessage: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  priorityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});

// ─── StreakGoalRing ─────────────────────────────────────────────

const StreakGoalRing = memo(({ streak, isAtRisk, hoursUntilBreak, streakMessage, entriesToday, dailyGoal, trackerColor, colors, borderRadiusValue, onLogNow }: any) => {
  if (!streak || streak.currentStreak === 0) return null;
  const progress = Math.min(entriesToday / (dailyGoal || 3), 1);
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={ringStyles.container}>
          <View style={ringStyles.ringWrap}>
            <View style={[ringStyles.ringOuter, { borderColor: `${trackerColor}20` }]}>
              <View style={[ringStyles.ringInner, { borderColor: isAtRisk ? '#FF6B6B' : trackerColor, borderTopColor: 'transparent', transform: [{ rotate: `${-90 + (progress * 360)}deg` }] }]} />
              <View style={ringStyles.ringCenter}>
                <Text style={[ringStyles.ringValue, { color: isAtRisk ? '#FF6B6B' : trackerColor }]}>{entriesToday}</Text>
                <Text style={[ringStyles.ringLabel, { color: colors.textSecondary }]}>of {dailyGoal || 3}</Text>
              </View>
            </View>
          </View>
          <View style={ringStyles.infoColumn}>
            <View style={ringStyles.streakRow}>
              <Ionicons name={isAtRisk ? 'flame-outline' : 'flame'} size={22} color={isAtRisk ? '#FF6B6B' : trackerColor} />
              <Text style={[ringStyles.streakText, { color: isAtRisk ? '#FF6B6B' : trackerColor }]}>{streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}</Text>
            </View>
            <Text style={[ringStyles.message, { color: colors.textSecondary }]} numberOfLines={2}>{streakMessage}</Text>
            {isAtRisk && (
              <TouchableOpacity style={[ringStyles.actionBtn, { backgroundColor: '#FF6B6B', borderRadius: borderRadiusValue }]} onPress={onLogNow} activeOpacity={0.85}>
                <Text style={ringStyles.actionText}>Log Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ringStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', padding: DESIGN.spacing.lg, gap: 16 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 4 },
  ringCenter: { alignItems: 'center' },
  ringValue: { fontSize: 22, fontWeight: '800' },
  ringLabel: { fontSize: 11, fontWeight: '600' },
  infoColumn: { flex: 1, gap: 4 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { fontSize: 18, fontWeight: '800' },
  message: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  actionBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ─── YesterdayStrip ─────────────────────────────────────────────

const YesterdayStrip = memo(({ entries, tracker, onCopyEntry, onViewAll, colors, borderRadiusValue, fontSizeMultiplier }: any) => {
  if (!entries || entries.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <View style={yesterdayStyles.header}>
        <View style={yesterdayStyles.headerLeft}>
          <Ionicons name="calendar-outline" size={18} color={tracker.gradient[0]} />
          <Text style={[yesterdayStyles.headerTitle, { color: colors.text }]}>Yesterday</Text>
          <View style={[yesterdayStyles.countBadge, { backgroundColor: `${tracker.gradient[0]}15` }]}>
            <Text style={[yesterdayStyles.countText, { color: tracker.gradient[0] }]}>{entries.length}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[yesterdayStyles.viewAll, { color: tracker.gradient[0] }]}>View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={yesterdayStyles.scrollContent}>
        {entries.map((entry: YesterdayEntry) => {
          const fields = getEntryFields(entry);
          const entryDate = new Date(entry.timestamp);
          return (
            <TouchableOpacity key={entry.id} onPress={() => { HAPTIC_MEDIUM(); onCopyEntry(entry); }}
              style={[yesterdayStyles.card, { backgroundColor: colors.glassBg, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadiusValue }]} activeOpacity={0.85}>
              <View style={yesterdayStyles.cardHeader}>
                <View style={[yesterdayStyles.timeBadge, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                  <Ionicons name="time-outline" size={12} color={tracker.gradient[0]} />
                  <Text style={[yesterdayStyles.timeText, { color: tracker.gradient[0] }]}>{format(entryDate, 'h:mm a')}</Text>
                </View>
                <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
              </View>
              {fields.slice(0, 2).map(([key, value]) => (
                <View key={key} style={yesterdayStyles.fieldRow}>
                  <Text style={[yesterdayStyles.fieldLabel, { color: colors.textSecondary }]}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
                  <Text style={[yesterdayStyles.fieldValue, { color: colors.text }]} numberOfLines={1}>{formatFieldValue(key, value)}</Text>
                </View>
              ))}
              {fields.length > 2 && (
                <Text style={[yesterdayStyles.moreText, { color: colors.textMuted || colors.textSecondary }]}>+{fields.length - 2} more</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

const yesterdayStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.sm, marginTop: DESIGN.spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countText: { fontSize: 12, fontWeight: '800' },
  viewAll: { fontSize: 13, fontWeight: '700' },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg, gap: 10, paddingBottom: 4 },
  card: { width: 160, padding: 14, marginRight: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timeText: { fontSize: 11, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '500', flex: 1 },
  fieldValue: { fontSize: 11, fontWeight: '700', maxWidth: 80 },
  moreText: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});

// ─── ConfirmModal ─────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: Record<string, unknown>;
  tracker: UnifiedTrackerConfig;
  babyName: string;
  babyAvatar?: string;
  date: Date;
  notes?: string;
  tags: string[];
}

const ConfirmModal = memo<ConfirmModalProps>(({
  visible, onClose, onConfirm, data, tracker, babyName, babyAvatar, date, notes, tags,
}) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const preview = useMemo(() =>
    Object.entries(data).filter(([k, v]) => {
      if (shouldFilterField(k)) return false;
      return formatFieldValue(k, v) !== null;
    }),
    [data]
  );

  const handleConfirm = useCallback(() => {
    HAPTIC_SUCCESS();
    onConfirm();
  }, [onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[modalStyles.modalOverlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]} onPress={onClose}>
        <Animated.View style={[modalStyles.modalContent, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
          <LinearGradient colors={[fullThemeColors.surface, fullThemeColors.background]} style={[modalStyles.modalGradient, { borderRadius: borderRadiusValue * 2 }]}>
            <View style={modalStyles.modalHeader}>
              <View style={[modalStyles.modalIconContainer, { backgroundColor: `${tracker.gradient[0]}20`, borderRadius: borderRadiusValue }]}>
                <Text style={modalStyles.modalIcon}>{tracker.emoji}</Text>
              </View>
              <Text style={[modalStyles.modalTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>Confirm {tracker.name}</Text>
              <View style={modalStyles.modalBabyRow}>
                <SafeAvatar avatar={babyAvatar} size={28} fallbackIcon="person" borderWidth={0} animated={false} />
                <Text style={[modalStyles.modalSubtitle, { color: fullThemeColors.textSecondary }]}>For {babyName}</Text>
              </View>
            </View>
            <Animated.ScrollView style={modalStyles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[modalStyles.previewCard, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}>
                <Text style={[modalStyles.previewTime, { color: fullThemeColors.textSecondary }]}>{format(date, 'MMM d, yyyy \u2022 h:mm a')}</Text>
                 {(data.photoUris as string[])?.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {(data.photoUris as string[]).map((uri, idx) => (
                      <Image
                        key={idx}
                        source={{ uri }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: borderRadiusValue,
                          backgroundColor: fullThemeColors.border,
                        }}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                )}                <Text style={[modalStyles.previewTitle, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>{tracker.emoji} {tracker.name}</Text>
                {notes && <Text style={[modalStyles.previewDetails, { color: fullThemeColors.textSecondary }]}>{notes}</Text>}
                {preview.length > 0 && (
                  <View style={modalStyles.previewFields}>
                    {preview.map(([k, v]) => (
                      <View key={k} style={modalStyles.previewField}>
                        <Text style={[modalStyles.previewFieldLabel, { color: fullThemeColors.textSecondary }]}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
                        <Text style={[modalStyles.previewFieldValue, { color: fullThemeColors.text }]}>{formatFieldValue(k, v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {tags.length > 0 && (
                  <View style={modalStyles.previewNotes}>
                    <Ionicons name="pricetag-outline" size={16} color={fullThemeColors.textSecondary} />
                    <Text style={[modalStyles.previewNotesText, { color: fullThemeColors.textSecondary }]}>{tags.join(', ')}</Text>
                  </View>
                )}
              </View>
            </Animated.ScrollView>
            <View style={modalStyles.modalActions}>
              <TouchableOpacity onPress={onClose} style={[modalStyles.cancelButton, { borderRadius: borderRadiusValue }]} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Edit entry">
                <Text style={[modalStyles.cancelButtonText, { color: fullThemeColors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={[modalStyles.confirmButton, { borderRadius: borderRadiusValue }]} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Save entry">
                <LinearGradient colors={tracker.gradient} style={modalStyles.confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={modalStyles.confirmButtonText}>Save Entry</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
ConfirmModal.displayName = 'ConfirmModal';

const modalStyles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxHeight: '80%', overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 30 },
  modalGradient: { padding: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIconContainer: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalIcon: { fontSize: 32 },
  modalTitle: { fontWeight: '800', marginBottom: 4 },
  modalBabyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSubtitle: { fontSize: 14, fontWeight: '500' },
  modalBody: { maxHeight: 300 },
  previewCard: { padding: 20, borderWidth: StyleSheet.hairlineWidth },
  previewTime: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewPhotoContainer: { overflow: 'hidden', marginBottom: 12, height: 120 },
  previewTitle: { fontWeight: '800', marginBottom: 8 },
  previewDetails: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  previewFields: { gap: 8, marginTop: 8 },
  previewField: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  previewFieldLabel: { fontSize: 13, fontWeight: '500' },
  previewFieldValue: { fontSize: 13, fontWeight: '600' },
  previewNotes: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.05)' },
  previewNotesText: { flex: 1, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '700' },
  confirmButton: { flex: 2, overflow: 'hidden' },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ─── YesterdayEntriesModal ──────────────────────────────────────

interface YesterdayEntriesModalProps {
  visible: boolean;
  onClose: () => void;
  entries: YesterdayEntry[];
  tracker: UnifiedTrackerConfig;
  onCopyEntry: (entry: YesterdayEntry) => void;
  colors: Record<string, string>;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
}

const YesterdayEntriesModal = memo<YesterdayEntriesModalProps>(({
  visible, onClose, entries, tracker, onCopyEntry, colors, borderRadiusValue, fontSizeMultiplier,
}) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleCopy = useCallback((entry: YesterdayEntry) => {
    HAPTIC_MEDIUM();
    onCopyEntry(entry);
    onClose();
  }, [onCopyEntry, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[yesterdayModalStyles.overlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]} onPress={onClose}>
        <Animated.View style={[yesterdayModalStyles.content, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
          <LinearGradient colors={[colors.surface, colors.background]} style={[yesterdayModalStyles.gradient, { borderRadius: borderRadiusValue * 2 }]}>
            <View style={yesterdayModalStyles.header}>
              <View style={[yesterdayModalStyles.iconContainer, { backgroundColor: `${tracker.gradient[0]}20`, borderRadius: borderRadiusValue }]}>
                <Ionicons name="calendar-outline" size={28} color={tracker.gradient[0]} />
              </View>
              <Text style={[yesterdayModalStyles.title, { color: colors.text, fontSize: 20 * fontSizeMultiplier }]}>Yesterday's {tracker.name}</Text>
              <Text style={[yesterdayModalStyles.subtitle, { color: colors.textSecondary }]}>{entries.length} record{entries.length !== 1 ? 's' : ''} from yesterday</Text>
              <TouchableOpacity onPress={onClose} style={[yesterdayModalStyles.closeBtn, { borderRadius: borderRadiusValue }]} accessibilityRole="button" accessibilityLabel="Close modal">
                <BlurView intensity={40} style={[yesterdayModalStyles.closeBlur, { borderRadius: borderRadiusValue }]} tint="dark">
                  <Ionicons name="close" size={22} color={colors.text} />
                </BlurView>
              </TouchableOpacity>
            </View>
            <Animated.ScrollView style={yesterdayModalStyles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={yesterdayModalStyles.scrollContent}>
              {entries.map((entry, index) => {
                const fields = getEntryFields(entry);
                const entryDate = new Date(entry.timestamp);
                return (
                  <Animated.View key={entry.id} entering={FadeInUp.delay(index * 80).springify()}
                    style={[yesterdayModalStyles.entryCard, { backgroundColor: colors.glassBg, borderColor: colors.border, borderRadius: borderRadiusValue, borderWidth: 1 }]}>
                    <View style={yesterdayModalStyles.entryHeader}>
                      <View style={[yesterdayModalStyles.timeBadge, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                        <Ionicons name="time-outline" size={14} color={tracker.gradient[0]} />
                        <Text style={[yesterdayModalStyles.timeText, { color: tracker.gradient[0] }]}>{format(entryDate, 'h:mm a')}</Text>
                      </View>
                      {entry.title && (
                        <Text style={[yesterdayModalStyles.entryTitle, { color: colors.text }]} numberOfLines={1}>{entry.title}</Text>
                      )}
                    </View>
                    {fields.length > 0 && (
                      <View style={yesterdayModalStyles.fieldsContainer}>
                        {fields.map(([key, value]) => (
                          <View key={key} style={yesterdayModalStyles.fieldRow}>
                            <Text style={[yesterdayModalStyles.fieldLabel, { color: colors.textSecondary }]}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
                            <Text style={[yesterdayModalStyles.fieldValue, { color: colors.text }]}>{formatFieldValue(key, value)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {entry.notes && (
                      <View style={[yesterdayModalStyles.notesContainer, { borderTopColor: `${colors.border}40` }]}>
                        <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                        <Text style={[yesterdayModalStyles.notesText, { color: colors.textSecondary }]}>{entry.notes}</Text>
                      </View>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <View style={yesterdayModalStyles.tagsContainer}>
                        {entry.tags.map((tag, idx) => (
                          <View key={idx} style={[yesterdayModalStyles.tag, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                            <Text style={[yesterdayModalStyles.tagText, { color: tracker.gradient[0] }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                     )}
                    {(entry as any).photoUris && (entry as any).photoUris.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                        {(entry as any).photoUris.map((uri: string, idx: number) => (
                          <Image key={idx} source={{ uri }}
                            style={{ width: 48, height: 48, borderRadius: borderRadiusValue / 2 }}
                            resizeMode="cover" />
                        ))}
                      </ScrollView>
                    )}
                    <TouchableOpacity style={[yesterdayModalStyles.copyBtn, { backgroundColor: tracker.gradient[0], borderRadius: borderRadiusValue }]}                      onPress={() => handleCopy(entry)} activeOpacity={0.85} accessibilityRole="button"
                      accessibilityLabel={`Copy ${tracker.name} entry from ${format(entryDate, 'h:mm a')}`}>
                      <Ionicons name="copy-outline" size={16} color="#fff" />
                      <Text style={yesterdayModalStyles.copyBtnText}>Copy to Today</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
            <View style={yesterdayModalStyles.footer}>
              <TouchableOpacity style={[yesterdayModalStyles.doneBtn, { borderRadius: borderRadiusValue, borderColor: colors.border }]} onPress={onClose} activeOpacity={0.8} accessibilityRole="button">
                <Text style={[yesterdayModalStyles.doneBtnText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
YesterdayEntriesModal.displayName = 'YesterdayEntriesModal';

const yesterdayModalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { width: '100%', maxHeight: '85%', overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 30 },
  gradient: { padding: 0 },
  header: { alignItems: 'center', padding: 24, paddingBottom: 16, position: 'relative' },
  iconContainer: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: '500' },
  closeBtn: { position: 'absolute', top: 16, right: 16, overflow: 'hidden' },
  closeBlur: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollView: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  entryCard: { padding: 16, marginBottom: 4 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timeText: { fontSize: 13, fontWeight: '700' },
  entryTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  fieldsContainer: { gap: 8, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.04)' },
  fieldLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  fieldValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  notesContainer: { flexDirection: 'row', gap: 8, paddingTop: 10, marginBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  notesText: { flex: 1, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 4 },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { padding: 20, paddingTop: 12 },
  doneBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  doneBtnText: { fontSize: 16, fontWeight: '700' },
});

// ─── DatePickerModal ──────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  date: Date;
  mode: 'date' | 'time';
  onChange: (event: any, selectedDate?: Date) => void;
  onClose: () => void;
  themeColors: Record<string, string>;
  fullThemeColors: Record<string, string>;
  borderRadiusValue: number;
}

const DatePickerModal = memo<DatePickerModalProps>(({
  visible, date, mode, onChange, onClose, themeColors, fullThemeColors, borderRadiusValue,
}) => (
  <Modal transparent animationType="slide" visible={visible} statusBarTranslucent>
    <Pressable style={[pickerStyles.overlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]} onPress={onClose}>
      <View style={[pickerStyles.content, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue * 2 }]}
        onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
        <View style={[pickerStyles.header, { borderBottomColor: fullThemeColors.border }]}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={[pickerStyles.doneButton, { color: themeColors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
        <DateTimePicker value={date} mode={mode} display="spinner" onChange={onChange} textColor={fullThemeColors.text} />
      </View>
    </Pressable>
  </Modal>
));
DatePickerModal.displayName = 'DatePickerModal';

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  content: { paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  header: { alignItems: 'flex-end', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  doneButton: { fontSize: 16, fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════════
// TRACKER CONTENT — All progressive hooks called HERE only
// This component only renders when tracker is guaranteed to exist
// ═══════════════════════════════════════════════════════════════

function TrackerContent({
  tracker,
  selectedTrackerId,
  date,
  setDate,
  pendingData,
  setPendingData,
  pendingOptions,
  setPendingOptions,
  showConfirm,
  setShowConfirm,
  showYesterdayModal,
  setShowYesterdayModal,
  yesterdayEntries,
  setYesterdayEntries,
  errors,
  setErrors,
  dismissedCorrelations,
  setDismissedCorrelations,
  dismissedReminders,
  setDismissedReminders,
  appliedCorrelationPrefill,
  setAppliedCorrelationPrefill,
  appliedSuggestions,
  setAppliedSuggestions,
  editEntryId,
  route,
  navigation,
  showPicker,
  setShowPicker,
  handleTrackerSelect,
  handlePickerClose,
}: any) {
  const theme = useUnifiedTrackerTheme();
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  
  const {
    fullThemeColors,
    themeColors,
    isDark,
    triggerHaptic,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
  } = useCustomization();
  const { success, error } = useSweetAlert();
  const { getEntries, currentBaby, addEntry } = useTracker();
  const insets = useSafeAreaInsets();

  // ═══════════════════════════════════════════════════════════════
  // CRITICAL FIX: useTrackerProgressive is called HERE, not in wrapper
  // This component only mounts when selectedTrackerId is valid
  // ═══════════════════════════════════════════════════════════════
  const progressive = useTrackerProgressive(selectedTrackerId || '');

  const {
    prefillData,
    suggestions,
    streak,
    isAtRisk,
    hoursUntilBreak,
    streakMessage,
    insights,
    correlations,
    activeReminders,
    hasUrgentReminders,
    templates,
    trends,
    timeContext,
    refresh: refreshProgressive,
  } = progressive;

  // ─── Derived State ─────────────────────────────────────────────
  const recentEntries = useMemo(() => tracker ? getEntries(tracker.id, 3) : [], [tracker, getEntries]);

  const visibleCorrelations = useMemo(() =>
    correlations.filter((c: any) => !dismissedCorrelations.has(c.id)),
    [correlations, dismissedCorrelations]
  );

  const visibleReminders = useMemo(() =>
    activeReminders.filter((r: any) => !dismissedReminders.has(r.id)),
    [activeReminders, dismissedReminders]
  );

  const hasYesterdayEntries = yesterdayEntries.length > 0;

  const entriesToday = useMemo(() => {
    if (!tracker) return 0;
    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = endOfDay(new Date()).getTime();
    return getEntries(tracker.id).filter((e: any) => {
      const t = e.timestamp;
      return t >= todayStart && t <= todayEnd;
    }).length;
  }, [tracker, getEntries]);

  const lastEntryTime = useMemo(() => {
    if (!tracker) return null;
    const entries = getEntries(tracker.id).sort((a: any, b: any) => b.timestamp - a.timestamp);
    return entries.length > 0 ? new Date(entries[0].timestamp) : null;
  }, [tracker, getEntries]);

  const quickTemplates = useMemo((): QuickTemplate[] => {
    if (!tracker) return [];
    const base: QuickTemplate[] = [];
    switch (tracker.id) {
      case 'feed':
        base.push(
          { id: 'breast-left', label: 'Breast Left', icon: '\uD83E\uDD31', data: { feedType: 'Breast', side: 'Left' }, color: '#ec4899' },
          { id: 'breast-right', label: 'Breast Right', icon: '\uD83E\uDD31', data: { feedType: 'Breast', side: 'Right' }, color: '#ec4899' },
          { id: 'bottle-4oz', label: 'Bottle 4oz', icon: '\uD83C\uDF7C', data: { feedType: 'Bottle', amount: '4 oz' }, color: '#6366f1' },
          { id: 'bottle-6oz', label: 'Bottle 6oz', icon: '\uD83C\uDF7C', data: { feedType: 'Bottle', amount: '6 oz' }, color: '#6366f1' },
        );
        break;
      case 'sleep':
        base.push(
          { id: 'nap-30', label: 'Short Nap', icon: '\uD83D\uDE34', data: { sleepType: 'Nap', duration: '30 min' }, color: '#8b5cf6' },
          { id: 'nap-60', label: 'Long Nap', icon: '\uD83D\uDE34', data: { sleepType: 'Nap', duration: '1 hr' }, color: '#8b5cf6' },
          { id: 'night-sleep', label: 'Night Sleep', icon: '\uD83C\uDF19', data: { sleepType: 'Night', duration: '8 hr' }, color: '#5F27CD' },
        );
        break;
      case 'diaper':
        base.push(
          { id: 'wet', label: 'Wet', icon: '\uD83D\uDCA7', data: { type: 'Wet' }, color: '#06b6d4' },
          { id: 'dirty', label: 'Dirty', icon: '\uD83D\uDCA9', data: { type: 'Dirty' }, color: '#f59e0b' },
          { id: 'both', label: 'Both', icon: '\uD83D\uDCA7\uD83D\uDCA9', data: { type: 'Both' }, color: '#ef4444' },
        );
        break;
      case 'potty':
        base.push(
          { id: 'pee', label: 'Pee', icon: '\uD83D\uDCA7', data: { type: 'Pee', successful: true }, color: '#06b6d4' },
          { id: 'poop', label: 'Poop', icon: '\uD83D\uDCA9', data: { type: 'Poop', successful: true }, color: '#f59e0b' },
        );
        break;
    }
    return base;
  }, [tracker]);

  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    if (!tracker) return [];
    const items: SmartSuggestion[] = [];
    suggestions.forEach((s: any, i: number) => {
      items.push({
        id: `sugg-${i}`,
        fieldId: s.fieldId,
        label: s.fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: s.value,
        confidence: s.confidence || 75,
        reason: s.reason || 'Based on your patterns',
      });
    });
    if (tracker.id === 'feed' && !pendingData.feedType) {
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 10) {
        items.push({ id: 'pattern-morning', fieldId: 'feedType', label: 'Feed Type', value: 'Breast', confidence: 82, reason: 'Morning pattern' });
      } else if (hour >= 18 && hour <= 22) {
        items.push({ id: 'pattern-evening', fieldId: 'feedType', label: 'Feed Type', value: 'Bottle', confidence: 78, reason: 'Evening pattern' });
      }
    }
    return items;
  }, [tracker, suggestions, pendingData]);

  const contextInsights = useMemo((): ContextInsight[] => {
    if (!tracker) return [];
    const items: ContextInsight[] = [];
    if (entriesToday === 0) {
      items.push({ id: 'first-entry', type: 'tip', message: `First ${tracker.name.toLowerCase()} of the day. Great time to log!`, emoji: '\u2728', color: '#10b981', priority: 'low' });
    }
    if (isAtRisk && streak?.currentStreak > 0) {
      items.push({ id: 'streak-risk', type: 'anomaly', message: `Streak at risk! Log within ${hoursUntilBreak}h to keep ${streak.currentStreak} days.`, emoji: '\uD83D\uDD25', color: '#ef4444', priority: 'high' });
    }
    if (timeContext?.nextSuggestedTime) {
      items.push({ id: 'next-suggested', type: 'pattern', message: `Usually logged around ${timeContext.nextSuggestedTime}`, emoji: '\u23F0', color: '#6366f1', priority: 'medium' });
    }
    if (entriesToday >= 3 && tracker.id === 'feed') {
      items.push({ id: 'feeding-count', type: 'trend', message: `${entriesToday} feeds today \u2014 on track for healthy intake`, emoji: '\uD83D\uDCC8', color: '#10b981', priority: 'low' });
    }
    return items;
  }, [tracker, entriesToday, isAtRisk, streak, hoursUntilBreak, timeContext]);

  // ─── Effects ───────────────────────────────────────────────────

  useEffect(() => {
    if (selectedTrackerId) {
      refreshProgressive();
    }
  }, [selectedTrackerId, refreshProgressive]);

  useEffect(() => {
    if (!tracker || editEntryId) return;
    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday).getTime();
    const yesterdayEnd = endOfDay(yesterday).getTime();
    const filtered = getEntries(tracker.id)
      .filter((entry: any) => {
        const entryTime = entry.timestamp;
        return entryTime >= yesterdayStart && entryTime <= yesterdayEnd;
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((entry: any) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        data: entry.data || {},
        notes: entry.notes,
        tags: entry.tags,
        title: entry.title,
      }));
    setYesterdayEntries(filtered);
  }, [tracker, getEntries, editEntryId, setYesterdayEntries]);

  useEffect(() => {
    if (!tracker) return;
    setPendingData((prev: any) => {
      const newData = { ...prev };
      let hasChanges = false;
      Object.entries(prefillData).forEach(([key, value]) => {
        if (newData[key] === undefined && value !== undefined && value !== '') {
          newData[key] = value;
          hasChanges = true;
        }
      });
      suggestions.forEach((s: any) => {
        if (newData[s.fieldId] === undefined && s.confidence >= 80) {
          newData[s.fieldId] = s.value;
          hasChanges = true;
        }
      });
      if (appliedCorrelationPrefill) {
        Object.entries(appliedCorrelationPrefill).forEach(([key, value]) => {
          newData[key] = value;
          hasChanges = true;
        });
        // Note: setAppliedCorrelationPrefill(null) should be handled by parent
      }
      return hasChanges ? newData : prev;
    });
  }, [prefillData, suggestions, appliedCorrelationPrefill, tracker, setPendingData]);

  useEffect(() => {
    if (!editEntryId || !tracker) return;
    const entry = getEntries(tracker.id).find((e: any) => e.id === editEntryId);
    if (entry) {
      setDate(new Date(entry.timestamp));
      setPendingData(entry.data || {});
      setPendingOptions({
        notes: entry.notes,
        tags: entry.tags,
        photoUris: entry.photoUris,
      });
    }
  }, [editEntryId, tracker, getEntries, setDate, setPendingData, setPendingOptions]);

  // ─── Callbacks ────────────────────────────────────────────────

  const dateRef = useRef(date);
  dateRef.current = date;

  const handleCopyYesterdayEntry = useCallback((entry: YesterdayEntry) => {
    HAPTIC_SUCCESS();
    const copiedData = { ...entry.data };
    const now = new Date();
    setDate(now);
    setPendingData(copiedData);
    if (entry.notes || entry.tags) {
      setPendingOptions((prev: any) => ({
        ...prev,
        notes: entry.notes || prev.notes,
        tags: entry.tags || prev.tags,
      }));
    }
    success('Copied!', `Yesterday's ${tracker?.name || 'entry'} data loaded. Time set to now.`);
  }, [success, tracker?.name, setDate, setPendingData, setPendingOptions]);

  const showAndroidPicker = useCallback((mode: 'date' | 'time') => {
    try {
      DateTimePickerAndroid.open({
        value: dateRef.current,
        mode,
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            const d = new Date(dateRef.current);
            if (mode === 'date') {
              d.setFullYear(selectedDate.getFullYear());
              d.setMonth(selectedDate.getMonth());
              d.setDate(selectedDate.getDate());
              setDate(d);
              setTimeout(() => showAndroidPicker('time'), 300);
            } else {
              d.setHours(selectedDate.getHours());
              d.setMinutes(selectedDate.getMinutes());
              setDate(d);
            }
          }
        },
      });
    } catch {
      error('Error', 'Could not open date picker.');
    }
  }, [error, setDate]);

  const handleDatePress = useCallback(() => {
    HAPTIC_LIGHT();
    if (Platform.OS === 'android') {
      showAndroidPicker('date');
    } else {
      setShowDatePicker(true);
    }
  }, [showAndroidPicker, setShowDatePicker]);

  const handleTimePress = useCallback(() => {
    HAPTIC_LIGHT();
    if (Platform.OS === 'android') {
      showAndroidPicker('time');
    } else {
      setShowTimePicker(true);
    }
  }, [showAndroidPicker, setShowTimePicker]);

  const onDateChange = useCallback((_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (selectedDate) setDate(selectedDate);
  }, [setDate, setShowDatePicker, setShowTimePicker]);

  const buildTitle = useCallback((data: Record<string, unknown>): string => {
    if (!tracker) return 'Entry';
    const d = data;
    switch (tracker.id) {
      case 'potty': return `${d.type || 'Potty'} ${d.successful ? '\u2713' : ''}`;
      case 'feed': return `${d.feedType || 'Feed'}${d.amount ? ` (${d.amount})` : ''}`;
      case 'sleep': return `${d.sleepType || 'Sleep'}${d.duration ? ` \u2022 ${d.duration}` : ''}`;
      case 'growth': return `${d.measurementType || 'Measurement'}: ${d.value || ''}${d.unit || ''}`;
      case 'medication': return `${d.name || 'Medicine'} ${d.dosage || ''}`;
      case 'milestone': return `\uD83C\uDF1F ${d.title || 'New Milestone'}`;
      case 'diaper': return `${d.type || 'Diaper'} Change`;
      case 'temperature': return `\uD83C\uDF21\uFE0F ${d.value || ''}${d.unit === 'fahrenheit' ? '\u00B0F' : '\u00B0C'}`;
      case 'note': return (d.title as string) || 'Note';
      default: return `${tracker.emoji} ${tracker.name}`;
    }
  }, [tracker]);

  const handleFormSubmit = useCallback((data: Record<string, unknown>, options: { title?: string; notes?: string; photoUris?: string[]; tags?: string[] }) => {
    setPendingData(data);
    setPendingOptions(options);
    setShowConfirm(true);
  }, [setPendingData, setPendingOptions, setShowConfirm]);

  const confirmSave = useCallback(async () => {
    if (!tracker) return;
    try {
      const entry = await addEntry(tracker.id, pendingData, {
        title: buildTitle(pendingData),
        notes: pendingOptions.notes,
        tags: pendingOptions.tags,
        photoUris: pendingOptions.photoUris,
      });
      if (entry) {
        triggerHaptic('success');
        setShowConfirm(false);
        success('Saved!', `${tracker.name} entry added successfully.`);
        navigation.goBack();
      }
    } catch {
      error('Error', 'Failed to save entry. Please try again.');
    }
  }, [tracker, pendingData, pendingOptions, addEntry, triggerHaptic, success, error, navigation, buildTitle, setShowConfirm]);

  const handleTemplateSelect = useCallback((tmpl: QuickTemplate) => {
    HAPTIC_MEDIUM();
    setPendingData((prev: any) => ({ ...prev, ...tmpl.data }));
    success('Template Applied', `${tmpl.label} prefill loaded.`);
  }, [success, setPendingData]);

  const handleApplySuggestion = useCallback((suggestion: SmartSuggestion) => {
    HAPTIC_LIGHT();
    setPendingData((prev: any) => ({ ...prev, [suggestion.fieldId]: suggestion.value }));
    setAppliedSuggestions((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(suggestion.id);
      return next;
    });
  }, [setPendingData, setAppliedSuggestions]);

  const handleDismissSuggestion = useCallback((id: string) => {
    setAppliedSuggestions((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [setAppliedSuggestions]);

  const handleCorrelationAction = useCallback((correlation: ProgressiveCorrelation) => {
    HAPTIC_LIGHT();
    if (correlation.prefillData) {
      setAppliedCorrelationPrefill(correlation.prefillData);
    }
  }, [setAppliedCorrelationPrefill]);

  const handleDismissCorrelation = useCallback((id: string) => {
    setDismissedCorrelations((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [setDismissedCorrelations]);

  const handleDismissReminder = useCallback((id: string) => {
    setDismissedReminders((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [setDismissedReminders]);

  const handleInsightAction = useCallback((insight: ContextInsight) => {
    HAPTIC_LIGHT();
    if (insight.type === 'anomaly' && insight.id === 'streak-risk') {
      // Scroll to form or trigger save
    }
  }, []);

  // ─── Picker state (local to this component) ────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const progressiveState = useMemo(() => ({
    prefillData,
    suggestions,
    streak,
    insights,
    correlations,
    activeReminders,
    templates,
    trends,
    timeContext,
    yesterdayEntries: [],
    todayEntries: [],
  }), [prefillData, suggestions, streak, insights, correlations, activeReminders, templates, trends, timeContext]);

  const gradientColors: [string, string, string] = [
    tracker.gradient[0] + '08',
    tracker.gradient[1] + '04',
    fullThemeColors.background,
  ];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <Animated.ScrollView ref={scrollViewRef} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          {/* Top Nav Row */}
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.springify()} style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { borderRadius: borderRadiusValue }]} activeOpacity={0.8}>
              <BlurView intensity={isDark ? 40 : 80} style={[styles.iconBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
                <Ionicons name="arrow-back" size={22} color={fullThemeColors.text} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.trackerChip, { borderRadius: borderRadiusValue }]} onPress={() => { HAPTIC_LIGHT(); setShowPicker(true); }} activeOpacity={0.8}>
              <BlurView intensity={isDark ? 40 : 80} style={[styles.trackerChipBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
                <Text style={styles.trackerChipEmoji}>{tracker.emoji}</Text>
                <Text style={[styles.trackerChipText, { color: fullThemeColors.text }]}>{editEntryId ? 'Edit' : 'Add'} {tracker.name}</Text>
                <Ionicons name="chevron-down" size={16} color={fullThemeColors.textSecondary} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { borderRadius: borderRadiusValue }]} onPress={() => { HAPTIC_LIGHT(); setShowPicker(true); }} activeOpacity={0.8}>
              <BlurView intensity={isDark ? 40 : 80} style={[styles.iconBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
                <Ionicons name="swap-horizontal" size={20} color={fullThemeColors.text} />
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Smart Context Header */}
          <View style={styles.sectionMargin}>
            <SmartContextHeader tracker={tracker} currentBaby={currentBaby} lastEntryTime={lastEntryTime} entriesToday={entriesToday}
              colors={fullThemeColors} borderRadiusValue={borderRadiusValue} fontSizeMultiplier={fontSizeMultiplier} />
          </View>

          {/* Streak & Goal Ring */}
          {streak && streak.currentStreak > 0 && (
            <View style={styles.sectionMargin}>
              <StreakGoalRing streak={streak} isAtRisk={isAtRisk} hoursUntilBreak={hoursUntilBreak} streakMessage={streakMessage}
                entriesToday={entriesToday} dailyGoal={3} trackerColor={tracker.gradient[0]} colors={fullThemeColors}
                borderRadiusValue={borderRadiusValue} onLogNow={() => {
                  // Scroll to form area
                  scrollViewRef.current?.scrollTo({ y: 500, animated: true });
                }} />
            </View>
          )}

          {/* Quick Template Strip */}
          <QuickTemplateStrip templates={quickTemplates} tracker={tracker} onSelect={handleTemplateSelect}
            colors={fullThemeColors} borderRadiusValue={borderRadiusValue} />

          {/* Smart Suggestion Chips */}
          <SmartSuggestionChips suggestions={smartSuggestions} appliedSuggestions={appliedSuggestions}
            onApply={handleApplySuggestion} onDismiss={handleDismissSuggestion} theme={theme}
            colors={fullThemeColors} borderRadiusValue={borderRadiusValue} />

          {/* Time Wheel Selector */}
          <TimeWheelSelector date={date} onDateChange={handleDatePress} onTimeChange={(newDate: Date) => setDate(newDate)}
            trackerColor={tracker.gradient[0]} colors={fullThemeColors} borderRadiusValue={borderRadiusValue} fontSizeMultiplier={fontSizeMultiplier} />

          {/* Context Insights Strip */}
          <ContextInsightsStrip insights={contextInsights} onAction={handleInsightAction}
            colors={fullThemeColors} borderRadiusValue={borderRadiusValue} />

          {/* Urgent Reminders Banner */}
          {hasUrgentReminders && visibleReminders.some((r: any) => r.priority === 'urgent' || r.priority === 'high') && (
            <Animated.View entering={FadeInUp.springify()} style={[styles.urgentBanner, { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: borderRadiusValue }]}>
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={[styles.urgentText, { color: '#FF6B6B' }]}>
                {visibleReminders.filter((r: any) => r.priority === 'urgent' || r.priority === 'high').length} urgent reminder(s)
              </Text>
            </Animated.View>
          )}

          {/* Reminders */}
          {visibleReminders.length > 0 && (
            <View style={styles.remindersSection}>
              {visibleReminders.slice(0, 2).map((reminder: any) => (
                <View key={reminder.id} style={[styles.reminderPill, {
                  backgroundColor: (reminder.priority === 'urgent' || reminder.priority === 'high') ? 'rgba(255,107,107,0.08)' : `${tracker.gradient[0]}08`,
                  borderRadius: borderRadiusValue,
                  borderLeftWidth: 3,
                  borderLeftColor: (reminder.priority === 'urgent' || reminder.priority === 'high') ? '#FF6B6B' : tracker.gradient[0],
                }]}>
                  <Text style={styles.reminderEmoji}>{reminder.emoji}</Text>
                  <View style={styles.reminderTextContainer}>
                    <Text style={[styles.reminderTitle, { color: fullThemeColors.text }]} numberOfLines={1}>{reminder.title}</Text>
                    <Text style={[styles.reminderBody, { color: fullThemeColors.textSecondary }]} numberOfLines={1}>{reminder.body}</Text>
                  </View>
                  {reminder.actionButtons?.map((btn: any) => (
                    <TouchableOpacity key={btn.id} style={[styles.reminderActionBtn, {
                      backgroundColor: btn.action === 'log_now' ? tracker.gradient[0] : fullThemeColors.surface,
                      borderRadius: borderRadiusValue / 2,
                    }]} onPress={() => {}} activeOpacity={0.85}>
                      <Text style={[styles.reminderActionText, { color: btn.action === 'log_now' ? '#fff' : fullThemeColors.text }]}>{btn.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => handleDismissReminder(reminder.id)} style={styles.correlationDismiss}>
                    <Ionicons name="close" size={18} color={fullThemeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Correlations */}
          {visibleCorrelations.length > 0 && (
            <View style={styles.correlationsSection}>
              {visibleCorrelations.slice(0, 2).map((correlation: any) => (
                <Animated.View key={correlation.id} entering={FadeInUp.springify()} style={[styles.correlationAlert, {
                  backgroundColor: `${tracker.gradient[0]}08`,
                  borderRadius: borderRadiusValue,
                  borderLeftWidth: 3,
                  borderLeftColor: tracker.gradient[0],
                }]}>
                  <View style={styles.correlationIconContainer}>
                    <Text style={styles.correlationEmoji}>{correlation.emoji}</Text>
                  </View>
                  <View style={styles.correlationTextContainer}>
                    <Text style={[styles.correlationMessage, { color: fullThemeColors.text }]} numberOfLines={2}>{correlation.message}</Text>
                    <Text style={[styles.correlationMeta, { color: fullThemeColors.textSecondary }]}>
                      {correlation.trackerEmoji} {correlation.trackerName} \u2022 {correlation.confidence}% match
                    </Text>
                  </View>
                  <View style={styles.correlationActions}>
                    {correlation.action !== 'none' && (
                      <TouchableOpacity style={[styles.correlationActionBtn, { backgroundColor: tracker.gradient[0] }]} onPress={() => handleCorrelationAction(correlation)} activeOpacity={0.85}>
                        <Text style={styles.correlationActionText}>
                          {correlation.action === 'log_now' ? 'Log' : correlation.action === 'prefill' ? 'Apply' : 'View'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDismissCorrelation(correlation.id)} style={styles.correlationDismiss}>
                      <Ionicons name="close" size={18} color={fullThemeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Yesterday Entries Strip */}
          <YesterdayStrip entries={yesterdayEntries} tracker={tracker} onCopyEntry={handleCopyYesterdayEntry}
            onViewAll={() => setShowYesterdayModal(true)} colors={fullThemeColors}
            borderRadiusValue={borderRadiusValue} fontSizeMultiplier={fontSizeMultiplier} />

          {/* Recent entries */}
          {recentEntries.length > 0 && !editEntryId && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()} style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>Recent {tracker.name}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                 {recentEntries.map((entry: any) => (
                  <View key={entry.id} style={[styles.recentCard, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}>
                    <Text style={styles.recentEmoji}>{tracker.emoji}</Text>
                    <Text style={[styles.recentTime, { color: fullThemeColors.textSecondary }]}>{format(new Date(entry.timestamp), 'h:mm a')}</Text>
                    {entry.photoUris && entry.photoUris.length > 0 && (
                      <View style={{ position: 'absolute', top: 4, right: 4 }}>
                        <Ionicons name="image" size={12} color={fullThemeColors.textSecondary} />
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.springify()} style={[styles.errorsContainer, {
              backgroundColor: `${fullThemeColors.error}15`,
              borderLeftColor: fullThemeColors.error,
              borderRadius: borderRadiusValue,
            }]}>
              {errors.map((err: string, idx: number) => (
                <View key={idx} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={fullThemeColors.error} />
                  <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{err}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Form */}
          <View style={styles.formWrapper}>
            <DynamicTrackerForm tracker={tracker} initialData={pendingData} progressiveState={progressiveState}
              onSubmit={handleFormSubmit} onCancel={() => navigation.goBack()} />
          </View>

          <View style={styles.bottomPadding} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ConfirmModal visible={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={confirmSave}
        data={{ ...pendingData, photoUris: pendingOptions.photoUris }} tracker={tracker}
        babyName={currentBaby?.name || 'Baby'} babyAvatar={currentBaby?.avatar} date={date}
        notes={pendingOptions.notes} tags={pendingOptions.tags || []} />

      <YesterdayEntriesModal visible={showYesterdayModal} onClose={() => setShowYesterdayModal(false)}
        entries={yesterdayEntries} tracker={tracker} onCopyEntry={handleCopyYesterdayEntry}
        colors={fullThemeColors} borderRadiusValue={borderRadiusValue} fontSizeMultiplier={fontSizeMultiplier} />

      {/* iOS Pickers */}
      {Platform.OS === 'ios' && (
        <>
          <DatePickerModal visible={showDatePicker} date={date} mode="date" onChange={onDateChange}
            onClose={() => setShowDatePicker(false)} themeColors={themeColors} fullThemeColors={fullThemeColors} borderRadiusValue={borderRadiusValue} />
          <DatePickerModal visible={showTimePicker} date={date} mode="time" onChange={onDateChange}
            onClose={() => setShowTimePicker(false)} themeColors={themeColors} fullThemeColors={fullThemeColors} borderRadiusValue={borderRadiusValue} />
        </>
      )}
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN — WRAPPER COMPONENT
// All state lives here. No conditional hooks. No useTrackerProgressive.
// ═══════════════════════════════════════════════════════════════

export default function AddEntryScreen() {
  const navigation = useNavigation<AddEntryNavigationProp>();
  const route = useRoute<AddEntryRouteProp>();

  const { fullThemeColors, isDark } = useCustomization();
  const { getTracker, currentBaby } = useTracker();

  // ─── State (all unconditional) ────────────────────────────────
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(
    route.params?.trackerId || null
  );
  const [showPicker, setShowPicker] = useState(!route.params?.trackerId);
  const [date, setDate] = useState(new Date());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showYesterdayModal, setShowYesterdayModal] = useState(false);
  const [yesterdayEntries, setYesterdayEntries] = useState<YesterdayEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dismissedCorrelations, setDismissedCorrelations] = useState<Set<string>>(new Set());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [appliedCorrelationPrefill, setAppliedCorrelationPrefill] = useState<Record<string, unknown> | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  // Form state
  const [pendingData, setPendingData] = useState<Record<string, unknown>>(() => {
    const preset = route.params?.presetData;
    return { ...preset };
  });

  const [pendingOptions, setPendingOptions] = useState<{
    notes?: string;
    tags?: string[];
    photoUris?: string[];
  }>({});

  // ─── Derived (no hooks inside) ──────────────────────────────────
  const tracker = useMemo(() =>
    selectedTrackerId ? getTracker(selectedTrackerId) : undefined,
    [selectedTrackerId, getTracker]
  );

  const editEntryId = useMemo(() =>
    route.params?.editMode ? route.params?.eventId : undefined,
    [route.params?.editMode, route.params?.eventId]
  );

  // ─── Callbacks ─────────────────────────────────────────────────
  const handleTrackerSelect = useCallback((trackerId: string) => {
    setSelectedTrackerId(trackerId);
    setShowPicker(false);
    setPendingOptions({});
    setErrors([]);
    setDismissedCorrelations(new Set());
    setDismissedReminders(new Set());
    setAppliedCorrelationPrefill(null);
    setAppliedSuggestions(new Set());
    setShowYesterdayModal(false);
    setYesterdayEntries([]);
  }, []);

  const handlePickerClose = useCallback(() => {
    if (!selectedTrackerId) {
      navigation.goBack();
    } else {
      setShowPicker(false);
    }
  }, [selectedTrackerId, navigation]);

  // ─── Render: Picker State ──────────────────────────────────────
  if (showPicker) {
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <TimelinePicker
          visible={showPicker}
          onClose={handlePickerClose}
          onSelect={handleTrackerSelect}
          currentBabyName={currentBaby?.name}
          currentBabyAvatar={currentBaby?.avatar}
        />
      </View>
    );
  }

  // ─── Render: No Tracker Found ──────────────────────────────────
  if (!tracker) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: fullThemeColors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="alert-circle-outline" size={48} color={fullThemeColors.textSecondary} />
        <Text style={[styles.errorText, { color: fullThemeColors.textSecondary, fontSize: 18 }]}>Tracker not found</Text>
      </View>
    );
  }

  // ─── Render: Full Tracker Content ──────────────────────────────
  return (
    <TrackerContent
      tracker={tracker}
      selectedTrackerId={selectedTrackerId}
      date={date}
      setDate={setDate}
      pendingData={pendingData}
      setPendingData={setPendingData}
      pendingOptions={pendingOptions}
      setPendingOptions={setPendingOptions}
      showConfirm={showConfirm}
      setShowConfirm={setShowConfirm}
      showYesterdayModal={showYesterdayModal}
      setShowYesterdayModal={setShowYesterdayModal}
      yesterdayEntries={yesterdayEntries}
      setYesterdayEntries={setYesterdayEntries}
      errors={errors}
      setErrors={setErrors}
      dismissedCorrelations={dismissedCorrelations}
      setDismissedCorrelations={setDismissedCorrelations}
      dismissedReminders={dismissedReminders}
      setDismissedReminders={setDismissedReminders}
      appliedCorrelationPrefill={appliedCorrelationPrefill}
      setAppliedCorrelationPrefill={setAppliedCorrelationPrefill}
      appliedSuggestions={appliedSuggestions}
      setAppliedSuggestions={setAppliedSuggestions}
      editEntryId={editEntryId}
      route={route}
      navigation={navigation}
      showPicker={showPicker}
      setShowPicker={setShowPicker}
      handleTrackerSelect={handleTrackerSelect}
      handlePickerClose={handlePickerClose}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { paddingHorizontal: 0, paddingBottom: 40 },
  sectionMargin: { marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  iconBtn: { overflow: 'hidden' },
  iconBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerChip: { overflow: 'hidden', flex: 1, marginHorizontal: 12 },
  trackerChipBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  trackerChipEmoji: { fontSize: 18 },
  trackerChipText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },

  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  urgentText: { fontSize: 13, fontWeight: '600' },

  remindersSection: { gap: 10, marginBottom: 16, marginHorizontal: 16 },
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  reminderEmoji: { fontSize: 20 },
  reminderTextContainer: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: '600' },
  reminderBody: { fontSize: 12, marginTop: 2 },
  reminderActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reminderActionText: { fontSize: 12, fontWeight: '600' },

  correlationsSection: { gap: 10, marginBottom: 16, marginHorizontal: 16 },
  correlationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  correlationIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correlationEmoji: { fontSize: 24 },
  correlationTextContainer: { flex: 1 },
  correlationMessage: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  correlationMeta: { fontSize: 11, marginTop: 2 },
  correlationActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  correlationActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  correlationActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  correlationDismiss: { padding: 4 },

  recentSection: { marginBottom: 20, marginHorizontal: 16 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentCard: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentEmoji: { fontSize: 28 },
  recentTime: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  errorsContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    marginHorizontal: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorText: { fontSize: 13, fontWeight: '500' },

  formWrapper: { marginTop: 8, paddingHorizontal: 16 },
  bottomPadding: { height: 100 },
});