import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';

import { useTrackerProgressive } from '../../hooks/useTrackerProgressive';
import { useTrackerAchievements } from '../../hooks/useTrackerAchievements';
import { useTracker } from '../../hooks/useTrackerContext';
import { formatTimeShort, formatDateShort } from '@/utils/time';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { DynamicTrackerForm } from './DynamicTrackerForm';
import type { UnifiedTrackerConfig, TrackerEntry } from '../../types/trackers';

interface SmartTrackerScreenProps {
  tracker: UnifiedTrackerConfig;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════
   SAFE HELPERS — guard against undefined values from context
   ═══════════════════════════════════════════════════════════════════════ */

const safeArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const safeString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.length > 0 ? v : fallback;

const safeNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/* Fallback theme color map — used when themeColors lacks a key */
const FALLBACK_COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

const pickColor = (
  themeColors: any,
  key: 'success' | 'warning' | 'error' | 'info'
): string => {
  const value = themeColors?.[key];
  return typeof value === 'string' && value.length > 0 ? value : FALLBACK_COLORS[key];
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export const SmartTrackerScreen: React.FC<SmartTrackerScreenProps> = ({ tracker, onClose }) => {
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
    triggerHaptic,
  } = useCustomization();
  const { success } = useSweetAlert();
  const {
    addEntry,
    linkEntries,
  } = useTracker();

  const progressive = useTrackerProgressive(tracker.id);

  // ─── Defensive destructure with safe defaults ──────────────────────
  const prefillData = useMemo(
    () => safeObject(progressive?.prefillData),
    [progressive?.prefillData]
  );
  const suggestions = useMemo(
    () => safeArray<any>(progressive?.suggestions),
    [progressive?.suggestions]
  );
  const streak = progressive?.streak ?? null;
  const isAtRisk = Boolean(progressive?.isAtRisk);
  const hoursUntilBreak = safeNumber(progressive?.hoursUntilBreak, 0);
  const streakMessage = safeString(progressive?.streakMessage);
  const insights = useMemo(
    () => safeArray<any>(progressive?.insights),
    [progressive?.insights]
  );
  const hasNewInsights = Boolean(progressive?.hasNewInsights);
  const correlations = useMemo(
    () => safeArray<any>(progressive?.correlations),
    [progressive?.correlations]
  );
  const activeReminders = useMemo(
    () => safeArray<any>(progressive?.activeReminders),
    [progressive?.activeReminders]
  );
  const hasUrgentReminders = Boolean(progressive?.hasUrgentReminders);
  const templates = useMemo(
    () => safeArray<any>(progressive?.templates),
    [progressive?.templates]
  );
  const trends = useMemo(
    () => safeObject(progressive?.trends) as Record<string, any>,
    [progressive?.trends]
  );
  const timeContext = useMemo(
    () => ({
      timeOfDay: 'morning' as const,
      dayOfWeek: 0,
      isWeekend: false,
      isHoliday: false,
      usualTimes: [] as string[],
      nextSuggestedTime: undefined as string | undefined,
      ...safeObject(progressive?.timeContext),
    }),
    [progressive?.timeContext]
  );
  const todayEntries = useMemo(
    () => safeArray<TrackerEntry>(progressive?.todayEntries),
    [progressive?.todayEntries]
  );
  const yesterdayEntries = useMemo(
    () => safeArray<TrackerEntry>(progressive?.yesterdayEntries),
    [progressive?.yesterdayEntries]
  );
  const recentEntries = useMemo(
    () => safeArray<TrackerEntry>(progressive?.recentEntries),
    [progressive?.recentEntries]
  );
  const isLoading = Boolean(progressive?.isLoading);
  const dismissInsight = progressive?.dismissInsight;
  const refresh = progressive?.refresh;

  // ─── Theme color fallbacks ─────────────────────────────────────────
  const successColor = pickColor(themeColors, 'success');
  const warningColor = pickColor(themeColors, 'warning');
  const errorColor = pickColor(themeColors, 'error');
  const infoColor = pickColor(themeColors, 'info');

  // Pull real streak data from achievements hook (single source of truth)
  const { streak: globalStreak } = useTrackerAchievements();

  const [mode, setMode] = useState<'dashboard' | 'form' | 'history' | 'insights'>('dashboard');
  // NOTE: linkedEntryId is reserved for future correlation-driven linking.
  const [linkedEntryId, setLinkedEntryId] = useState<string | undefined>(undefined);
  // One-shot override merged over prefillData when opening the form from a
  // template or correlation action. Cleared on plain quick-log and after save.
  const [formPreset, setFormPreset] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (mode === 'dashboard' && typeof refresh === 'function') {
      refresh();
    }
  }, [mode, refresh]);

  const handleSubmit = useCallback(async (
    data: Record<string, unknown>,
    options: { title?: string; notes?: string; photoUris?: string[]; tags?: string[]; linkedEntryId?: string }
  ) => {
    const entry = await addEntry(tracker.id, data, {
      title: options.title || `${tracker.emoji} ${tracker.name}`,
      notes: options.notes,
      photoUris: options.photoUris,
      tags: options.tags,
    });

    if (!entry) return; // context already showed the error alert — do NOT claim success

    if (options.linkedEntryId) {
      await linkEntries(entry.id, options.linkedEntryId, 'related');
    }

    setFormPreset(null);
    success('Saved!', `${tracker.emoji} ${tracker.name} logged successfully.`);
    setMode('dashboard');
  }, [tracker, addEntry, linkEntries, success]);

  const applyTemplate = useCallback((template: any) => {
    triggerHaptic('light');
    setFormPreset(safeObject(template?.data));
    setMode('form');
  }, [triggerHaptic]);

  const quickLog = useCallback(() => {
    triggerHaptic('light');
    setFormPreset(null); // plain quick-log must not inherit a stale preset
    setMode('form');
  }, [triggerHaptic]);

  const handleCorrelationAction = useCallback((correlation: any) => {
    triggerHaptic('light');
    if (
      (correlation?.action === 'log_now' || correlation?.action === 'prefill') &&
      correlation?.prefillData
    ) {
      setFormPreset(safeObject(correlation.prefillData));
    } else {
      setFormPreset(null);
    }
    setMode('form');
  }, [triggerHaptic]);

  const handleDismissInsight = useCallback((insightId: string) => {
    triggerHaptic('light');
    if (typeof dismissInsight === 'function') {
      dismissInsight(insightId);
    }
  }, [triggerHaptic, dismissInsight]);

  /* ═══════════════════════════════════════════════════════════════════
     DASHBOARD MODE
     ═══════════════════════════════════════════════════════════════════ */

  if (mode === 'dashboard') {
    const urgentCount = activeReminders.filter(
      (r) => r?.priority === 'high' || r?.priority === 'urgent'
    ).length;

    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.dashboardHeader,
            {
              backgroundColor: tracker.gradient[0] + '15',
              borderBottomLeftRadius: borderRadiusValue * 2,
              borderBottomRightRadius: borderRadiusValue * 2,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={fullThemeColors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerEmoji, { fontSize: 48 * fontSizeMultiplier }]}>
              {tracker.emoji}
            </Text>
            <TouchableOpacity onPress={() => setMode('history')} style={styles.historyBtn}>
              <Ionicons name="time-outline" size={24} color={fullThemeColors.text} />
            </TouchableOpacity>
          </View>

          <Text
            style={[
              styles.headerTitle,
              { color: fullThemeColors.text, fontSize: 24 * fontSizeMultiplier },
            ]}
          >
            {tracker.name}
          </Text>
          <Text
            style={[
              styles.headerDesc,
              { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier },
            ]}
          >
            {tracker.description}
          </Text>

          {/* Time Context Badge */}
          {Array.isArray(timeContext.usualTimes) && timeContext.usualTimes.length > 0 && (
            <Animated.View
              entering={shouldReduceMotion ? undefined : FadeIn}
              style={[
                styles.timeContextBadge,
                { backgroundColor: `${tracker.color}10` },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={tracker.color} />
              <Text style={[styles.timeContextText, { color: tracker.color }]}>
                Usually at {timeContext.usualTimes.join(', ')}
                {timeContext.nextSuggestedTime
                  ? ` • Next: ${timeContext.nextSuggestedTime}`
                  : ''}
              </Text>
            </Animated.View>
          )}

          {/* Streak - Real data from tracker entries */}
          {streak && safeNumber(streak.currentStreak, 0) > 0 && (
            <Animated.View
              entering={shouldReduceMotion ? undefined : FadeIn}
              style={[
                styles.streakCard,
                {
                  backgroundColor: isAtRisk ? '#FF6B6B15' : `${tracker.color}15`,
                  borderColor: isAtRisk ? '#FF6B6B30' : `${tracker.color}30`,
                },
              ]}
            >
              <Ionicons name="flame" size={28} color={isAtRisk ? '#FF6B6B' : tracker.color} />
              <View style={styles.streakInfo}>
                <Text
                  style={[
                    styles.streakCount,
                    { color: isAtRisk ? '#FF6B6B' : tracker.color },
                  ]}
                >
                  {safeNumber(streak.currentStreak, 0)} Day
                  {safeNumber(streak.currentStreak, 0) !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.streakLabel, { color: fullThemeColors.textSecondary }]}>
                  {streakMessage}
                </Text>
              </View>
              {isAtRisk && (
                <TouchableOpacity
                  onPress={quickLog}
                  style={[styles.streakAction, { backgroundColor: '#FF6B6B' }]}
                >
                  <Text style={styles.streakActionText}>
                    Log Now ({hoursUntilBreak}h left)
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Urgent Reminders Banner */}
          {hasUrgentReminders && urgentCount > 0 && (
            <Animated.View
              entering={shouldReduceMotion ? undefined : FadeInUp}
              style={[
                styles.urgentBanner,
                { backgroundColor: '#FF6B6B15', borderColor: '#FF6B6B30' },
              ]}
            >
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={[styles.urgentText, { color: '#FF6B6B' }]}>
                {urgentCount} urgent reminder{urgentCount !== 1 ? 's' : ''}
              </Text>
            </Animated.View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.dashboardBody}>
          {/* Active Reminders */}
          {activeReminders.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Reminders ({activeReminders.length})
              </Text>
              {activeReminders.slice(0, 3).map((reminder, i) => {
                if (!reminder) return null;
                const isUrgent = reminder.priority === 'urgent';
                const isHigh = reminder.priority === 'high';
                const borderColor = isUrgent
                  ? '#FF6B6B'
                  : isHigh
                  ? warningColor
                  : tracker.color;
                return (
                  <Animated.View
                    key={reminder.id || `reminder-${i}`}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 50)}
                    style={[
                      styles.reminderCard,
                      {
                        backgroundColor: isUrgent || isHigh
                          ? '#FF6B6B08'
                          : fullThemeColors.surface,
                        borderRadius: borderRadiusValue,
                        borderLeftWidth: 3,
                        borderLeftColor: borderColor,
                      },
                    ]}
                  >
                    <Text style={styles.reminderEmoji}>{reminder.emoji || '🔔'}</Text>
                    <View style={styles.reminderInfo}>
                      <Text style={[styles.reminderTitle, { color: fullThemeColors.text }]}>
                        {reminder.title || 'Reminder'}
                      </Text>
                      <Text
                        style={[
                          styles.reminderBody,
                          { color: fullThemeColors.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {reminder.body || ''}
                      </Text>
                      {reminder.dueAt && (
                        <Text style={[styles.reminderDue, { color: tracker.color }]}>
                          Due {formatTimeShort(reminder.dueAt)}
                        </Text>
                      )}
                    </View>
                    {Array.isArray(reminder.actionButtons) &&
                      reminder.actionButtons.map((btn: any) => (
                        <TouchableOpacity
                          key={btn?.id || `btn-${Math.random()}`}
                          style={[styles.reminderAction, { backgroundColor: tracker.color }]}
                          onPress={() => {
                            if (btn?.action === 'log_now') quickLog();
                          }}
                        >
                          <Text style={styles.reminderActionText}>
                            {btn?.label || 'Action'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Correlations */}
          {correlations.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Smart Connections
              </Text>
              {correlations.slice(0, 3).map((correlation, i) => {
                if (!correlation) return null;
                return (
                  <Animated.View
                    key={correlation.id || `corr-${i}`}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 50)}
                    style={[
                      styles.correlationCard,
                      {
                        backgroundColor: fullThemeColors.surface,
                        borderRadius: borderRadiusValue,
                      },
                    ]}
                  >
                    <Text style={styles.correlationEmoji}>
                      {correlation.emoji || '🔗'}
                    </Text>
                    <View style={styles.correlationInfo}>
                      <Text
                        style={[styles.correlationMessage, { color: fullThemeColors.text }]}
                      >
                        {correlation.message || 'Pattern detected'}
                      </Text>
                      <Text
                        style={[
                          styles.correlationMeta,
                          { color: fullThemeColors.textSecondary },
                        ]}
                      >
                        {correlation.trackerEmoji || '📊'}{' '}
                        {correlation.trackerName || 'Tracker'} •{' '}
                        {safeNumber(correlation.confidence, 0)}% confidence
                      </Text>
                    </View>
                    {correlation.action && correlation.action !== 'none' && (
                      <TouchableOpacity
                        style={[
                          styles.correlationAction,
                          { backgroundColor: tracker.color },
                        ]}
                        onPress={() => handleCorrelationAction(correlation)}
                      >
                        <Text style={styles.correlationActionText}>
                          {correlation.action === 'log_now'
                            ? 'Log'
                            : correlation.action === 'prefill'
                            ? 'Apply'
                            : 'View'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Today's Entries */}
          {todayEntries.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Today ({todayEntries.length})
              </Text>
              {todayEntries.slice(0, 3).map((entry, i) => {
                if (!entry) return null;
                return (
                  <Animated.View
                    key={entry.id || `today-${i}`}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 50)}
                    style={[
                      styles.entryCard,
                      {
                        backgroundColor: fullThemeColors.surface,
                        borderRadius: borderRadiusValue,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.entryTime, { color: fullThemeColors.textSecondary }]}
                    >
                      {formatTimeShort(entry.timestamp)}
                    </Text>
                    <Text
                      style={[styles.entryTitle, { color: fullThemeColors.text }]}
                      numberOfLines={1}
                    >
                      {entry.title || tracker.name}
                    </Text>
                    {entry.notes && (
                      <Text
                        style={[
                          styles.entryNotes,
                          { color: fullThemeColors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {entry.notes}
                      </Text>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Quick Templates */}
          {templates.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Quick Templates
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.templatesScroll}
              >
                {templates.map((template, i) => {
                  if (!template) return null;
                  const isAuto = template.source === 'auto_generated';
                  return (
                    <TouchableOpacity
                      key={template.id || `template-${i}`}
                      style={[
                        styles.templateCard,
                        {
                          backgroundColor: fullThemeColors.surface,
                          borderRadius: borderRadiusValue,
                          borderColor: isAuto
                            ? '#FF6B6B30'
                            : `${tracker.color}30`,
                          borderWidth: isAuto ? 2 : 1.5,
                        },
                      ]}
                      onPress={() => applyTemplate(template)}
                    >
                      <Text style={styles.templateEmoji}>{template.emoji || '⭐'}</Text>
                      <Text
                        style={[styles.templateName, { color: fullThemeColors.text }]}
                        numberOfLines={2}
                      >
                        {template.name || 'Template'}
                      </Text>
                      {isAuto && (
                        <View style={[styles.autoBadge, { backgroundColor: '#FF6B6B' }]}>
                          <Text style={styles.autoText}>Auto</Text>
                        </View>
                      )}
                      {template.isDefault && (
                        <View
                          style={[
                            styles.defaultBadge,
                            { backgroundColor: tracker.color },
                          ]}
                        >
                          <Text style={styles.defaultText}>Default</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Smart Insights */}
          {insights.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                  ]}
                >
                  Smart Insights
                </Text>
                {hasNewInsights && (
                  <View style={[styles.newBadge, { backgroundColor: successColor }]}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}
              </View>
              {insights.slice(0, 3).map((insight, i) => {
                if (!insight) return null;
                const bg =
                  insight.priority === 'good'
                    ? `${successColor}10`
                    : insight.priority === 'warning'
                    ? `${warningColor}10`
                    : `${infoColor}10`;
                return (
                  <Animated.View
                    key={insight.id || `insight-${i}`}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 100)}
                    style={[
                      styles.insightRow,
                      { backgroundColor: bg, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={styles.insightEmoji}>{insight.emoji || '💡'}</Text>
                    <View style={styles.insightInfo}>
                      <Text
                        style={[styles.insightTitle, { color: fullThemeColors.text }]}
                      >
                        {insight.title || 'Insight'}
                      </Text>
                      <Text
                        style={[
                          styles.insightDesc,
                          { color: fullThemeColors.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {insight.description || ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDismissInsight(insight.id)}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={fullThemeColors.textSecondary}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Yesterday Preview */}
          {Object.keys(prefillData).length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Yesterday's Values
              </Text>
              <View
                style={[
                  styles.yesterdayCard,
                  {
                    backgroundColor: fullThemeColors.surface,
                    borderRadius: borderRadiusValue,
                  },
                ]}
              >
                {Object.entries(prefillData)
                  .slice(0, 4)
                  .map(([key, value]) => (
                    <View key={key} style={styles.yesterdayRow}>
                      <Text
                        style={[
                          styles.yesterdayKey,
                          { color: fullThemeColors.textSecondary },
                        ]}
                      >
                        {key}
                      </Text>
                      <Text
                        style={[styles.yesterdayValue, { color: fullThemeColors.text }]}
                      >
                        {String(value).length > 20
                          ? String(value).slice(0, 20) + '...'
                          : String(value)}
                      </Text>
                    </View>
                  ))}
                <TouchableOpacity
                  style={[styles.yesterdayBtn, { backgroundColor: tracker.color }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setMode('form');
                  }}
                >
                  <Text style={styles.yesterdayBtnText}>Use Yesterday's Values</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Suggestions Chips */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
              >
                Suggestions
              </Text>
              <View style={styles.suggestionsWrap}>
                {suggestions.slice(0, 5).map((suggestion, i) => {
                  if (!suggestion) return null;
                  return (
                    <View
                      key={`${suggestion.fieldId}-${suggestion.source}-${i}`}
                      style={[
                        styles.suggestionChip,
                        {
                          backgroundColor: `${tracker.color}10`,
                          borderRadius: borderRadiusValue,
                        },
                      ]}
                    >
                      <Text style={styles.suggestionEmoji}>
                        {suggestion.emoji || '✨'}
                      </Text>
                      <Text
                        style={[
                          styles.suggestionLabel,
                          { color: fullThemeColors.text },
                        ]}
                      >
                        {suggestion.label || suggestion.fieldId}:{' '}
                        {String(suggestion.value).slice(0, 15)}
                      </Text>
                      <Text
                        style={[styles.confidenceBadge, { color: tracker.color }]}
                      >
                        {safeNumber(suggestion.confidence, 0)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Spacer for FAB */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: tracker.gradient[0],
              borderRadius: borderRadiusValue * 1.5,
            },
          ]}
          onPress={quickLog}
        >
          <Ionicons name="add" size={28} color="#fff" />
          <Text style={styles.fabText}>Log {tracker.emoji}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     FORM MODE
     ═══════════════════════════════════════════════════════════════════ */

  if (mode === 'form') {
    return (
      <View style={{ flex: 1 }}>
        <View
          style={[styles.formHeader, { backgroundColor: tracker.gradient[0] + '15' }]}
        >
          <TouchableOpacity onPress={() => setMode('dashboard')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.formHeaderTitle, { color: fullThemeColors.text }]}>
            {tracker.emoji} {tracker.name}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <DynamicTrackerForm
          tracker={tracker}
          progressiveState={{
            prefillData: { ...prefillData, ...(formPreset || {}) },
            suggestions,
            streak,
            insights,
            correlations,
            activeReminders,
            templates,
            trends,
            timeContext,
            yesterdayEntries,
            todayEntries,
          }}
          onSubmit={handleSubmit}
          onCancel={() => setMode('dashboard')}
          linkedEntryId={linkedEntryId}
          showInsights={true}
          quickMode={false}
        />
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     HISTORY MODE
     ═══════════════════════════════════════════════════════════════════ */

  if (mode === 'history') {
    const allEntries = [...todayEntries, ...yesterdayEntries, ...recentEntries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter(
        (entry, index, self) =>
          entry && index === self.findIndex((e) => e.id === entry.id)
      ); // Deduplicate + guard null

    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <View
          style={[styles.historyHeader, { backgroundColor: tracker.gradient[0] + '15' }]}
        >
          <TouchableOpacity onPress={() => setMode('dashboard')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.historyHeaderTitle, { color: fullThemeColors.text }]}>
            {tracker.emoji} History
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {allEntries.map((entry, i) => {
            if (!entry) return null;
            const entryData = safeObject(entry.data);
            const entryDataKeys = Object.keys(entryData);
            const linkedEntries = safeArray<any>(entry.linkedEntries);

            return (
              <Animated.View
                key={entry.id || `history-${i}`}
                entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 30)}
                style={[
                  styles.historyCard,
                  {
                    backgroundColor: fullThemeColors.surface,
                    borderRadius: borderRadiusValue,
                  },
                ]}
              >
                <View style={styles.historyCardHeader}>
                  <Text
                    style={[
                      styles.historyDate,
                      { color: fullThemeColors.textSecondary },
                    ]}
                  >
                    {formatDateShort(entry.timestamp)} •{' '}
                    {formatTimeShort(entry.timestamp)}
                  </Text>
                  {entry.loggedByRole === 'parent2' && (
                    <View
                      style={[
                        styles.partnerBadge,
                        { backgroundColor: `${tracker.color}20` },
                      ]}
                    >
                      <Text style={[styles.partnerText, { color: tracker.color }]}>
                        Partner
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.historyTitle, { color: fullThemeColors.text }]}>
                  {entry.title || tracker.name}
                </Text>
                {entryDataKeys.length > 0 && (
                  <View style={styles.historyData}>
                    {Object.entries(entryData)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <View key={key} style={styles.historyDataRow}>
                          <Text
                            style={[
                              styles.historyDataKey,
                              { color: fullThemeColors.textSecondary },
                            ]}
                          >
                            {key}:
                          </Text>
                          <Text
                            style={[
                              styles.historyDataValue,
                              { color: fullThemeColors.text },
                            ]}
                          >
                            {String(value).length > 15
                              ? String(value).slice(0, 15) + '...'
                              : String(value)}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
                {linkedEntries.length > 0 && (
                  <View
                    style={[
                      styles.linkedBadge,
                      { backgroundColor: `${tracker.color}15` },
                    ]}
                  >
                    <Ionicons name="link-outline" size={14} color={tracker.color} />
                    <Text style={[styles.linkedText, { color: tracker.color }]}>
                      Linked to {linkedEntries.length} other{' '}
                      {linkedEntries.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                )}
              </Animated.View>
            );
          })}
          {allEntries.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>📝</Text>
              <Text
                style={[styles.emptyText, { color: fullThemeColors.textSecondary }]}
              >
                No entries yet. Start tracking!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     INSIGHTS MODE
     ═══════════════════════════════════════════════════════════════════ */

  if (mode === 'insights') {
    const trendEntries = Object.entries(trends);
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <View
          style={[styles.historyHeader, { backgroundColor: tracker.gradient[0] + '15' }]}
        >
          <TouchableOpacity onPress={() => setMode('dashboard')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.historyHeaderTitle, { color: fullThemeColors.text }]}>
            {tracker.emoji} Insights
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 16 }}>
          {/* Trends Section */}
          {trendEntries.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier },
                ]}
              >
                Trends
              </Text>
              {trendEntries.map(([fieldId, trend]) => {
                if (!trend) return null;
                const dir = trend.direction || 'same';
                const trendColor =
                  dir === 'up'
                    ? successColor
                    : dir === 'down'
                    ? errorColor
                    : fullThemeColors.textSecondary;
                return (
                  <View
                    key={fieldId}
                    style={[
                      styles.trendCard,
                      {
                        backgroundColor: fullThemeColors.surface,
                        borderRadius: borderRadiusValue,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        dir === 'up'
                          ? 'trending-up'
                          : dir === 'down'
                          ? 'trending-down'
                          : 'remove'
                      }
                      size={24}
                      color={trendColor}
                    />
                    <View style={styles.trendInfo}>
                      <Text style={[styles.trendField, { color: fullThemeColors.text }]}>
                        {fieldId}
                      </Text>
                      <Text style={[styles.trendDelta, { color: trendColor }]}>
                        {trend.deltaLabel || 'No change'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* All Insights */}
          {insights.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier },
                ]}
              >
                All Insights
              </Text>
              {insights.map((insight, i) => {
                if (!insight) return null;
                const bg =
                  insight.priority === 'good'
                    ? `${successColor}10`
                    : insight.priority === 'warning'
                    ? `${warningColor}10`
                    : `${infoColor}10`;
                return (
                  <Animated.View
                    key={insight.id || `all-insight-${i}`}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 50)}
                    style={[
                      styles.insightRow,
                      { backgroundColor: bg, borderRadius: borderRadiusValue },
                    ]}
                  >
                    <Text style={styles.insightEmoji}>{insight.emoji || '💡'}</Text>
                    <View style={styles.insightInfo}>
                      <Text
                        style={[styles.insightTitle, { color: fullThemeColors.text }]}
                      >
                        {insight.title || 'Insight'}
                      </Text>
                      <Text
                        style={[
                          styles.insightDesc,
                          { color: fullThemeColors.textSecondary },
                        ]}
                      >
                        {insight.description || ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDismissInsight(insight.id)}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={fullThemeColors.textSecondary}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Time Patterns */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier },
              ]}
            >
              Time Patterns
            </Text>
            <View
              style={[
                styles.timePatternCard,
                {
                  backgroundColor: fullThemeColors.surface,
                  borderRadius: borderRadiusValue,
                },
              ]}
            >
              <View style={styles.timePatternRow}>
                <Text
                  style={[
                    styles.timePatternLabel,
                    { color: fullThemeColors.textSecondary },
                  ]}
                >
                  Time of Day
                </Text>
                <Text style={[styles.timePatternValue, { color: fullThemeColors.text }]}>
                  {timeContext.timeOfDay}
                </Text>
              </View>
              <View style={styles.timePatternRow}>
                <Text
                  style={[
                    styles.timePatternLabel,
                    { color: fullThemeColors.textSecondary },
                  ]}
                >
                  Weekend
                </Text>
                <Text style={[styles.timePatternValue, { color: fullThemeColors.text }]}>
                  {timeContext.isWeekend ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.timePatternRow}>
                <Text
                  style={[
                    styles.timePatternLabel,
                    { color: fullThemeColors.textSecondary },
                  ]}
                >
                  Usual Times
                </Text>
                <Text style={[styles.timePatternValue, { color: fullThemeColors.text }]}>
                  {Array.isArray(timeContext.usualTimes) &&
                  timeContext.usualTimes.length > 0
                    ? timeContext.usualTimes.join(', ')
                    : 'None yet'}
                </Text>
              </View>
              {timeContext.nextSuggestedTime && (
                <View style={styles.timePatternRow}>
                  <Text
                    style={[
                      styles.timePatternLabel,
                      { color: fullThemeColors.textSecondary },
                    ]}
                  >
                    Next Suggested
                  </Text>
                  <Text
                    style={[styles.timePatternValue, { color: tracker.color }]}
                  >
                    {timeContext.nextSuggestedTime}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
};

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — unchanged from original
   ═══════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  dashboardHeader: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeBtn: { padding: 8 },
  historyBtn: { padding: 8 },
  headerEmoji: { marginBottom: 4 },
  headerTitle: { fontWeight: '700', textAlign: 'center' },
  headerDesc: { textAlign: 'center', marginTop: 2 },

  timeContextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  timeContextText: { fontSize: 12, fontWeight: '500' },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    width: '100%',
  },
  streakInfo: { flex: 1 },
  streakCount: { fontSize: 18, fontWeight: '700' },
  streakLabel: { fontSize: 13, marginTop: 2 },
  streakAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  streakActionText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginTop: 8,
  },
  urgentText: { fontSize: 13, fontWeight: '600' },

  dashboardBody: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: '700' },

  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reminderEmoji: { fontSize: 24 },
  reminderInfo: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: '600' },
  reminderBody: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  reminderDue: { fontSize: 11, marginTop: 4, fontWeight: '500' },
  reminderAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  reminderActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  correlationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  correlationEmoji: { fontSize: 24 },
  correlationInfo: { flex: 1 },
  correlationMessage: { fontSize: 14, fontWeight: '500' },
  correlationMeta: { fontSize: 12, marginTop: 2 },
  correlationAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  correlationActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  entryCard: {
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  entryTime: { fontSize: 12, marginBottom: 4 },
  entryTitle: { fontSize: 15, fontWeight: '600' },
  entryNotes: { fontSize: 13, marginTop: 2 },

  templatesScroll: { marginHorizontal: -4 },
  templateCard: {
    width: 120,
    padding: 14,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  templateEmoji: { fontSize: 28, marginBottom: 8 },
  templateName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  defaultText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  autoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  autoText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
  },
  insightEmoji: { fontSize: 24 },
  insightInfo: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: '600' },
  insightDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  yesterdayCard: {
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  yesterdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  yesterdayKey: { fontSize: 13 },
  yesterdayValue: { fontSize: 13, fontWeight: '600' },
  yesterdayBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  yesterdayBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionEmoji: { fontSize: 16 },
  suggestionLabel: { fontSize: 13, fontWeight: '500' },
  confidenceBadge: { fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  backBtn: { padding: 8 },
  formHeaderTitle: { fontSize: 18, fontWeight: '700' },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  historyHeaderTitle: { fontSize: 18, fontWeight: '700' },
  historyCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: { fontSize: 12 },
  partnerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  partnerText: { fontSize: 11, fontWeight: '600' },
  historyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  historyData: { gap: 4 },
  historyDataRow: {
    flexDirection: 'row',
    gap: 8,
  },
  historyDataKey: { fontSize: 12, width: 80 },
  historyDataValue: { fontSize: 12, fontWeight: '500', flex: 1 },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  linkedText: { fontSize: 12, fontWeight: '500' },
  emptyState: {
    alignItems: 'center',
    padding: 60,
    gap: 12,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },

  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
  },
  trendInfo: { flex: 1 },
  trendField: { fontSize: 14, fontWeight: '600' },
  trendDelta: { fontSize: 13, marginTop: 2 },

  timePatternCard: {
    padding: 16,
    gap: 10,
  },
  timePatternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timePatternLabel: { fontSize: 14 },
  timePatternValue: { fontSize: 14, fontWeight: '600' },
});

export default SmartTrackerScreen;