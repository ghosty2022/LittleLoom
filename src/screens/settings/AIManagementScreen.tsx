// src/screens/settings/AIManagementScreen.tsx
// ─────────────────────────────────────────────────────────────────────
// Complete AI learning management screen.
// Shows: personal learning status, per-metric progress, cohort
// contributions, privacy controls, and GDPR erasure.
// ─────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';

import {
  getAllLearnedRanges,
  MetricKey,
  LearnedRange,
  resetLearningForBaby,
} from '../../services/ai/BayesianEngine';
import {
  isCollaborativeLearningEnabled,
  setCollaborativeLearningEnabled,
  isCohortContributionBlocked,
  deleteCohortContributions,
  getCohortPrior,
  ageToCohort,
} from '../../services/ai/CohortPriors';
import type { RootStackParamList } from '../../types/navigation';

// ─── Metric display metadata ────────────────────────────────────────

const METRIC_META: Record<MetricKey, { label: string; emoji: string; unit: string; format: (v: number) => string }> = {
  temperature_c:      { label: 'Temperature',      emoji: '🌡️', unit: '°C',   format: v => v.toFixed(2) },
  feeding_ml:         { label: 'Feeding Amount',   emoji: '🍼', unit: 'ml',   format: v => v.toFixed(0) },
  feed_interval_min:  { label: 'Feed Interval',    emoji: '⏱️', unit: 'min',  format: v => v.toFixed(0) },
  sleep_duration_min: { label: 'Sleep Duration',   emoji: '😴', unit: 'min',  format: v => v.toFixed(0) },
  sleep_interval_min: { label: 'Sleep Interval',   emoji: '🌙', unit: 'min',  format: v => v.toFixed(0) },
  diaper_interval_min:{ label: 'Diaper Interval',  emoji: '🧷', unit: 'min',  format: v => v.toFixed(0) },
  weight_kg:          { label: 'Weight',           emoji: '⚖️', unit: 'kg',   format: v => v.toFixed(2) },
  height_cm:          { label: 'Height',           emoji: '📏', unit: 'cm',   format: v => v.toFixed(1) },
  head_cm:            { label: 'Head Circumference', emoji: '🧠', unit: 'cm', format: v => v.toFixed(1) },
  heart_rate_bpm:     { label: 'Heart Rate',       emoji: '❤️', unit: 'bpm',  format: v => v.toFixed(0) },
  blood_oxygen:       { label: 'Blood Oxygen',     emoji: '🫁', unit: '%',    format: v => v.toFixed(1) },
  mood_score:         { label: 'Mood Score',       emoji: '😊', unit: '/5',   format: v => v.toFixed(1) },
  poop_interval_hr:   { label: 'Poop Interval',    emoji: '💩', unit: 'hr',   format: v => v.toFixed(1) },
  wake_window_min:    { label: 'Wake Window',      emoji: '⏰', unit: 'min',  format: v => v.toFixed(0) },
};

const ALL_METRICS: MetricKey[] = [
  'temperature_c', 'feeding_ml', 'feed_interval_min',
  'sleep_duration_min', 'sleep_interval_min', 'diaper_interval_min',
  'weight_kg', 'height_cm', 'head_cm', 'mood_score',
  'heart_rate_bpm', 'blood_oxygen', 'poop_interval_hr', 'wake_window_min',
];

// Confidence threshold: samples >= 15 means "learned"
const LEARNED_THRESHOLD = 15;
const PARTIAL_THRESHOLD = 5;

interface MetricRow {
  metric: MetricKey;
  range: LearnedRange;
}

type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AIManagement'>;

export default function AIManagementScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ScreenNavigationProp>();
  const { currentBaby } = useBaby();
  const { userProfile } = useAuth();
  const { fullThemeColors, themeColors, isDark, borderRadiusValue, fontSizeMultiplier, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [collaborativeEnabled, setCollaborativeEnabled] = useState(false);
  const [cohortBlocked, setCohortBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [erasing, setErasing] = useState(false);

  const primary = themeColors?.primary || '#667eea';

  // ─── Load all metric ranges ──────────────────────────────────────

  const loadMetrics = useCallback(async () => {
    if (!currentBaby?.id) return;

    try {
      const ranges = await getAllLearnedRanges(currentBaby.id, ALL_METRICS);

      const rows: MetricRow[] = ALL_METRICS.map((metric, i) => ({
        metric,
        range: ranges[i],
      }));

      setMetrics(rows);
    } catch (e) {
      if (__DEV__) console.warn('[AIManagement] loadMetrics failed:', e);
    }
  }, [currentBaby?.id]);

  const loadSettings = useCallback(async () => {
    try {
      const [collab, blocked] = await Promise.all([
        isCollaborativeLearningEnabled(),
        currentBaby?.id ? isCohortContributionBlocked(currentBaby.id) : Promise.resolve(false),
      ]);
      setCollaborativeEnabled(collab);
      setCohortBlocked(blocked);
    } catch {}
  }, [currentBaby?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadMetrics(), loadSettings()]);
    setLoading(false);
  }, [loadMetrics, loadSettings]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleResetLearning = useCallback(() => {
    if (!currentBaby?.id) return;

    Alert.alert(
      'Reset AI Learning?',
      `This will erase all personalized learning for ${currentBaby.name}. The AI will start fresh with population priors. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetLearningForBaby(currentBaby.id);
              triggerHaptic('success');
              await loadAll();
              sweetAlert.success('Learning Reset', 'AI learning has been reset for this baby.');
            } catch (e) {
              sweetAlert.error('Error', 'Failed to reset learning.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [currentBaby, loadAll, triggerHaptic, sweetAlert]);

  const handleEraseCohort = useCallback(() => {
    if (!currentBaby?.id || !userProfile?.id) {
      sweetAlert.warning('No Baby Selected', 'Select a baby profile first.');
      return;
    }

    Alert.alert(
      'Erase Cohort Contributions?',
      'This removes your local AI caches and prevents future contributions to the shared cohort pool. Already-aggregated priors cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            setErasing(true);
            try {
              const res = await deleteCohortContributions(currentBaby.id, userProfile.id);
              if (res.success) {
                triggerHaptic('success');
                await loadSettings();
                sweetAlert.success('Erased', res.message);
              } else {
                sweetAlert.error('Error', res.message);
              }
            } catch (e) {
              sweetAlert.error('Error', 'Failed to erase contributions.');
            } finally {
              setErasing(false);
            }
          },
        },
      ]
    );
  }, [currentBaby, userProfile, loadSettings, triggerHaptic, sweetAlert]);

  const handleToggleCollaborative = useCallback(async (value: boolean) => {
    try {
      await setCollaborativeLearningEnabled(value);
      setCollaborativeEnabled(value);
      triggerHaptic(value ? 'success' : 'light');

      if (value && currentBaby?.id) {
        const { bootstrapAI } = await import('../../services/ai/bootstrap');
        bootstrapAI(currentBaby.id, true).catch(() => {});
      }
    } catch (e) {
      sweetAlert.error('Error', 'Could not update the setting.');
    }
  }, [currentBaby, triggerHaptic, sweetAlert]);

  // ─── Derived stats ──────────────────────────────────────────────

  const stats = React.useMemo(() => {
    const totalSamples = metrics.reduce((sum, r) => sum + (r.range?.samples || 0), 0);
    const learnedCount = metrics.filter(r => (r.range?.samples || 0) >= LEARNED_THRESHOLD).length;
    const partialCount = metrics.filter(r => {
      const n = r.range?.samples || 0;
      return n >= PARTIAL_THRESHOLD && n < LEARNED_THRESHOLD;
    }).length;
    const notStarted = metrics.filter(r => (r.range?.samples || 0) < PARTIAL_THRESHOLD).length;
    const avgConfidence = metrics.length > 0
      ? metrics.reduce((sum, r) => sum + (r.range?.confidence || 0), 0) / metrics.length
      : 0;

    return { totalSamples, learnedCount, partialCount, notStarted, avgConfidence };
  }, [metrics]);

  // ─── Render helpers ─────────────────────────────────────────────

  const renderMetricRow = (row: MetricRow, index: number) => {
    const meta = METRIC_META[row.metric];
    const samples = row.range?.samples || 0;
    const confidence = row.range?.confidence || 0;

    let status: 'learned' | 'learning' | 'not_started';
    let statusColor: string;
    let statusLabel: string;
    let statusIcon: string;

    if (samples >= LEARNED_THRESHOLD) {
      status = 'learned';
      statusColor = '#10b981';
      statusLabel = 'Learned';
      statusIcon = 'checkmark-circle';
    } else if (samples >= PARTIAL_THRESHOLD) {
      status = 'learning';
      statusColor = '#f59e0b';
      statusLabel = 'Learning';
      statusIcon = 'hourglass';
    } else {
      status = 'not_started';
      statusColor = '#94a3b8';
      statusLabel = 'Not started';
      statusIcon = 'ellipse-outline';
    }

    const progress = Math.min(100, (samples / LEARNED_THRESHOLD) * 100);

    return (
      <Animated.View
        key={row.metric}
        entering={FadeInUp.delay(index * 30)}
        style={[
          styles.metricRow,
          {
            backgroundColor: fullThemeColors.surface,
            borderRadius: borderRadiusValue,
            borderColor: fullThemeColors.border,
          },
        ]}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricEmoji}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.metricLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
              {meta.label}
            </Text>
            <Text style={[styles.metricMeta, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
              {samples} sample{samples === 1 ? '' : 's'} · {Math.round(confidence * 100)}% confidence
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Ionicons name={statusIcon as any} size={12} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Range summary */}
        {samples >= PARTIAL_THRESHOLD && row.range && (
          <View style={[styles.rangeBox, { backgroundColor: `${primary}08`, borderRadius: borderRadiusValue / 1.5 }]}>
            <View style={styles.rangeItem}>
              <Text style={[styles.rangeLabel, { color: fullThemeColors.textSecondary }]}>Mean</Text>
              <Text style={[styles.rangeValue, { color: fullThemeColors.text }]}>
                {meta.format(row.range.mean)} {meta.unit}
              </Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={[styles.rangeLabel, { color: fullThemeColors.textSecondary }]}>Normal range</Text>
              <Text style={[styles.rangeValue, { color: fullThemeColors.text }]}>
                {meta.format(row.range.lower95)} – {meta.format(row.range.upper95)} {meta.unit}
              </Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={[styles.rangeLabel, { color: fullThemeColors.textSecondary }]}>Std dev</Text>
              <Text style={[styles.rangeValue, { color: fullThemeColors.text }]}>
                ± {meta.format(row.range.stddev)} {meta.unit}
              </Text>
            </View>
          </View>
        )}

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: fullThemeColors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
      </Animated.View>
    );
  };

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={64} color={fullThemeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: fullThemeColors.text }]}>No Baby Selected</Text>
          <Text style={[styles.emptySubtitle, { color: fullThemeColors.textSecondary }]}>
            Select a baby profile to view AI learning.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: fullThemeColors.surface, borderBottomColor: fullThemeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: fullThemeColors.text }]}>AI Learning</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <UniversalSpinner size={40} color={primary} variant="liquid" section="settings" />
          <Text style={[styles.loadingText, { color: fullThemeColors.textSecondary }]}>
            Loading learning data…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary]} />
          }
        >
          {/* ─── Overview card ─────────────────────────────────── */}
          <Animated.View entering={FadeInUp} style={[styles.overviewCard, { borderRadius: borderRadiusValue * 1.5 }]}>
            <LinearGradient
              colors={[`${primary}15`, `${primary}05`]}
              style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue * 1.5 }]}
            />
            <View style={styles.overviewHeader}>
              <View style={[styles.overviewIcon, { backgroundColor: `${primary}20` }]}>
                <Ionicons name="sparkles" size={24} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overviewTitle, { color: fullThemeColors.text }]}>
                  {currentBaby.name}'s Personal AI
                </Text>
                <Text style={[styles.overviewSubtitle, { color: fullThemeColors.textSecondary }]}>
                  {stats.totalSamples < 20
                    ? 'Just getting started — keep logging!'
                    : stats.totalSamples < 100
                    ? `Learning patterns (${stats.totalSamples} samples)`
                    : `Personalized from ${stats.totalSamples} samples`}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.learnedCount}</Text>
                <Text style={[styles.statLabel, { color: fullThemeColors.textSecondary }]}>Learned</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.partialCount}</Text>
                <Text style={[styles.statLabel, { color: fullThemeColors.textSecondary }]}>Learning</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#94a3b8' }]}>{stats.notStarted}</Text>
                <Text style={[styles.statLabel, { color: fullThemeColors.textSecondary }]}>Not started</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: primary }]}>
                  {Math.round(stats.avgConfidence * 100)}%
                </Text>
                <Text style={[styles.statLabel, { color: fullThemeColors.textSecondary }]}>Avg confidence</Text>
              </View>
            </View>
          </Animated.View>

          {/* ─── Collaborative learning ────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary }]}>
              PRIVACY & SHARING
            </Text>

            <View style={[styles.settingRow, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }]}>
              <View style={[styles.settingIcon, { backgroundColor: '#8b5cf618' }]}>
                <Ionicons name="people-circle-outline" size={22} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                  Collaborative AI Learning
                </Text>
                <Text style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}>
                  {collaborativeEnabled
                    ? 'Sharing anonymized patterns with other families'
                    : 'Off — your data stays on this device'}
                </Text>
              </View>
              <Switch
                value={collaborativeEnabled}
                onValueChange={handleToggleCollaborative}
                trackColor={{ false: isDark ? '#333' : '#d1d5db', true: '#8b5cf650' }}
                thumbColor={collaborativeEnabled ? '#8b5cf6' : isDark ? '#555' : '#f4f3f4'}
              />
            </View>

            {cohortBlocked && (
              <View style={[styles.infoBox, { backgroundColor: '#ef444415', borderRadius: borderRadiusValue }]}>
                <Ionicons name="ban" size={16} color="#ef4444" />
                <Text style={[styles.infoText, { color: '#ef4444' }]}>
                  This baby is blocked from contributing to the shared pool (GDPR erasure applied).
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ─── Metrics ───────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(150)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary }]}>
              WHAT THE AI HAS LEARNED
            </Text>
            {metrics.map(renderMetricRow)}
          </Animated.View>

          {/* ─── Danger zone ───────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(250)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary }]}>
              DATA MANAGEMENT
            </Text>

            <TouchableOpacity
              onPress={handleResetLearning}
              disabled={resetting}
              style={[styles.dangerRow, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#f59e0b18' }]}>
                <Ionicons name="refresh" size={22} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                  Reset AI Learning
                </Text>
                <Text style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}>
                  Start fresh — the AI will re-learn from scratch
                </Text>
              </View>
              {resetting ? (
                <UniversalSpinner size={20} color="#f59e0b" variant="liquid" section="settings" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={fullThemeColors.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEraseCohort}
              disabled={erasing}
              style={[styles.dangerRow, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#ef444418' }]}>
                <Ionicons name="trash-bin-outline" size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: fullThemeColors.text }]}>
                  Erase Cohort Contributions
                </Text>
                <Text style={[styles.settingSubtitle, { color: fullThemeColors.textSecondary }]}>
                  Remove local caches and block future sharing
                </Text>
              </View>
              {erasing ? (
                <UniversalSpinner size={20} color="#ef4444" variant="liquid" section="settings" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={fullThemeColors.textSecondary} />
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  scrollContent: { padding: 16 },
  overviewCard: { padding: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  overviewIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  overviewTitle: { fontSize: 17, fontWeight: '800' },
  overviewSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 1, marginBottom: 8 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 1, marginBottom: 8 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 4 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 16 },
  metricRow: { padding: 14, marginBottom: 10, borderWidth: 1 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricEmoji: { fontSize: 22 },
  metricLabel: { fontWeight: '700' },
  metricMeta: { fontWeight: '500', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rangeBox: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, marginTop: 10, gap: 8 },
  rangeItem: { flex: 1 },
  rangeLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  rangeValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});