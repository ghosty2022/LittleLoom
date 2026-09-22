// src/components/trackers/PredictionCard.tsx
// ─────────────────────────────────────────────────────────────────────
// Upgraded "What's Next?" card.
//
// Improvements over v1:
//   ✓ Shows the actual predicted clock time ("~2:45 PM")
//   ✓ Shows sample count + learned interval ("avg 2h 45m · 23 samples")
//   ✓ Visual confidence bar (not just a % pill)
//   ✓ Urgency color (red = now, amber = soon, green = later)
//   ✓ Real "learning" state when n=0 (no more fake 32%)
//   ✓ Tap → navigates to the correct tracker form
//   ✓ Pulls live state from AsyncStorage so we can show n + level
// ─────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import {
  getPredictions,
  formatMinutes,
  Prediction,
  PredictorType,
} from '../../services/ai/PredictorEngine';

// ─── Per-type visual metadata ────────────────────────────────────────

const TYPE_META: Record<
  PredictorType,
  {
    emoji: string;
    color: string;
    trackerId: string;
    label: string;
  }
> = {
  sleep: { emoji: '😴', color: '#8b5cf6', trackerId: 'sleep', label: 'Sleep' },
  feed: { emoji: '🍼', color: '#f59e0b', trackerId: 'feed', label: 'Feed' },
  diaper: { emoji: '🧷', color: '#3b82f6', trackerId: 'diaper', label: 'Diaper' },
  wake: { emoji: '⏰', color: '#06b6d4', trackerId: 'sleep', label: 'Wake' },
  medication: {
    emoji: '💊',
    color: '#ef4444',
    trackerId: 'medication',
    label: 'Medication',
  },
};

// ─── Read raw predictor state so we can show n + level ──────────────

const STORAGE_PREFIX = '@littleloom_predictor_v1:';

const readState = async (
  babyId: string,
  type: PredictorType
): Promise<{ n: number; level: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${babyId}:${type}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { n: parsed.n ?? 0, level: parsed.level ?? 0 };
  } catch {
    return null;
  }
};

// ─── Urgency ─────────────────────────────────────────────────────────

type Urgency = 'now' | 'soon' | 'later' | 'unknown';

const getUrgency = (minutesUntil: number, confidence: number): Urgency => {
  if (confidence < 0.3) return 'unknown';
  if (minutesUntil <= 15) return 'now';
  if (minutesUntil <= 45) return 'soon';
  return 'later';
};

const URGENCY_STYLE: Record<
  Urgency,
  { label: string; color: string; bg: string; icon: string }
> = {
  now: { label: 'Now', color: '#ef4444', bg: '#ef444415', icon: 'alert-circle' },
  soon: { label: 'Soon', color: '#f59e0b', bg: '#f59e0b15', icon: 'time' },
  later: {
    label: 'Later',
    color: '#10b981',
    bg: '#10b98115',
    icon: 'checkmark-circle',
  },
  unknown: {
    label: 'Learning',
    color: '#94a3b8',
    bg: '#94a3b815',
    icon: 'hourglass',
  },
};

interface Row {
  prediction: Prediction;
  n: number;
  level: number;
}

// ─── Component ───────────────────────────────────────────────────────

export default function PredictionCard() {
  const navigation = useNavigation<any>();
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } =
    useCustomization();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [sampleCounts, setSampleCounts] = useState<
    Record<string, { n: number; level: number }>
  >({});
  const [loading, setLoading] = useState(true);

  const babyId = currentBaby?.id;

  const load = useCallback(async () => {
    if (!babyId) return;
    try {
      const types: PredictorType[] = ['sleep', 'feed', 'diaper'];
      const [results, ...states] = await Promise.all([
        getPredictions(babyId, types),
        ...types.map((t) => readState(babyId, t)),
      ]);

      setPredictions(results);

      const counts: Record<string, { n: number; level: number }> = {};
      types.forEach((t, i) => {
        const s = states[i];
        if (s) counts[t] = s;
      });
      setSampleCounts(counts);
    } catch (e) {
      if (__DEV__) console.warn('[PredictionCard] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh every 30s so "in 45m" ticks down
  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Merge prediction + state into rows, sorted by urgency
  const rows: Row[] = useMemo(() => {
    return predictions
      .map((p) => {
        const state = sampleCounts[p.type] || { n: 0, level: 0 };
        return { prediction: p, n: state.n, level: state.level };
      })
      .sort((a, b) => {
        const order: Record<Urgency, number> = {
          now: 0,
          soon: 1,
          later: 2,
          unknown: 3,
        };
        const ua = getUrgency(
          a.prediction.minutesUntil,
          a.prediction.confidence
        );
        const ub = getUrgency(
          b.prediction.minutesUntil,
          b.prediction.confidence
        );
        if (order[ua] !== order[ub]) return order[ua] - order[ub];
        return a.prediction.minutesUntil - b.prediction.minutesUntil;
      });
  }, [predictions, sampleCounts]);

  if (!currentBaby) return null;

  if (loading && predictions.length === 0) {
    return (
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: fullThemeColors.surface,
            borderRadius: borderRadiusValue,
            borderColor: fullThemeColors.border,
          },
        ]}
      >
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  }

  const totalSamples = Object.values(sampleCounts).reduce(
    (sum, s) => sum + (s.n || 0),
    0
  );
  const isLearning = totalSamples < 15;

  return (
    <Animated.View
      entering={FadeInUp}
      style={[
        styles.wrap,
        {
          backgroundColor: fullThemeColors.surface,
          borderRadius: borderRadiusValue,
          borderColor: fullThemeColors.border,
        },
      ]}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={{ fontSize: 18 }}>🔮</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerText,
              {
                color: fullThemeColors.text,
                fontSize: 14 * fontSizeMultiplier,
              },
            ]}
          >
            What's Next?
          </Text>
          <Text
            style={[
              styles.headerSub,
              {
                color: fullThemeColors.textSecondary,
                fontSize: 11 * fontSizeMultiplier,
              },
            ]}
          >
            {isLearning
              ? `Learning ${currentBaby.name}'s rhythm… (${totalSamples} samples)`
              : `Based on ${totalSamples} tracked events`}
          </Text>
        </View>
      </View>

      {/* ─── Learning banner ─────────────────────────────────────── */}
      {isLearning && (
        <Animated.View
          entering={FadeIn}
          style={[
            styles.learningBanner,
            {
              backgroundColor: `${fullThemeColors.primary}08`,
              borderRadius: borderRadiusValue / 1.5,
            },
          ]}
        >
          <Ionicons
            name="sparkles"
            size={16}
            color={fullThemeColors.primary}
          />
          <Text
            style={[
              styles.learningText,
              {
                color: fullThemeColors.textSecondary,
                fontSize: 12 * fontSizeMultiplier,
              },
            ]}
          >
            Log a few more feeds, sleeps, and diaper changes and we'll start
            predicting accurately.
          </Text>
        </Animated.View>
      )}

      {/* ─── Prediction rows ─────────────────────────────────────── */}
      {!isLearning &&
        rows.map(({ prediction: p, n, level }, idx) => {
          const meta = TYPE_META[p.type];
          const urgency = getUrgency(p.minutesUntil, p.confidence);
          const urg = URGENCY_STYLE[urgency];
          const conf = Math.round(p.confidence * 100);

          const predictedTime = new Date(p.predictedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });

          const learnedInterval = n > 0 ? formatMinutes(Math.round(level)) : null;

          return (
            <Animated.View
              key={p.type}
              entering={FadeInUp.delay(idx * 60)}
              style={[
                styles.row,
                {
                  backgroundColor: `${meta.color}0A`,
                  borderRadius: borderRadiusValue / 1.5,
                  borderColor: `${meta.color}25`,
                  borderWidth: 1,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('AddEntry', { trackerId: meta.trackerId })
                }
                activeOpacity={0.75}
                style={styles.rowTouchable}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: `${meta.color}20` },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowTopLine}>
                    <Text
                      style={[
                        styles.rowTitle,
                        {
                          color: fullThemeColors.text,
                          fontSize: 14 * fontSizeMultiplier,
                        },
                      ]}
                    >
                      {meta.label}
                    </Text>
                    <View
                      style={[styles.urgencyPill, { backgroundColor: urg.bg }]}
                    >
                      <Ionicons
                        name={urg.icon as any}
                        size={11}
                        color={urg.color}
                      />
                      <Text
                        style={[
                          styles.urgencyPillText,
                          { color: urg.color },
                        ]}
                      >
                        {urg.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowTimeLine}>
                    <Text
                      style={[
                        styles.rowTime,
                        {
                          color: fullThemeColors.text,
                          fontSize: 15 * fontSizeMultiplier,
                        },
                      ]}
                    >
                      ~{predictedTime}
                    </Text>
                    <Text
                      style={[
                        styles.rowIn,
                        {
                          color: fullThemeColors.textSecondary,
                          fontSize: 12 * fontSizeMultiplier,
                        },
                      ]}
                    >
                      in {formatMinutes(Math.max(0, p.minutesUntil))}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.learnedLine,
                      {
                        color: fullThemeColors.textSecondary,
                        fontSize: 11 * fontSizeMultiplier,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {learnedInterval
                      ? `Every ${learnedInterval} · ${n} sample${
                          n === 1 ? '' : 's'
                        }`
                      : 'Building baseline…'}
                  </Text>

                  <View style={styles.confidenceRow}>
                    <View
                      style={[
                        styles.confidenceTrack,
                        { backgroundColor: `${meta.color}15` },
                      ]}
                    >
                      <View
                        style={[
                          styles.confidenceFill,
                          {
                            width: `${Math.max(6, conf)}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.confidenceText,
                        { color: fullThemeColors.textSecondary },
                      ]}
                    >
                      {conf}%
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={fullThemeColors.textSecondary}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.footer}
        onPress={() => navigation.navigate('Insights')}
      >
        <Text style={[styles.footerText, { color: '#667eea' }]}>
          {isLearning
            ? 'Every log makes predictions sharper →'
            : 'View full insights →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    padding: 14,
    marginHorizontal: 0,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerText: { fontWeight: '800' },
  headerSub: { marginTop: 1, fontWeight: '500' },
  learningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 4,
  },
  learningText: { flex: 1, fontWeight: '500', lineHeight: 16 },
  row: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  rowTitle: { fontWeight: '700' },
  urgencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgencyPillText: { fontSize: 10, fontWeight: '700' },
  rowTimeLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  rowTime: { fontWeight: '800', letterSpacing: -0.3 },
  rowIn: { fontWeight: '500' },
  learnedLine: { fontWeight: '500', marginBottom: 6 },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: { height: '100%', borderRadius: 2 },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
  footer: { alignItems: 'center', paddingVertical: 6, marginTop: 4 },
  footerText: { fontSize: 12, fontWeight: '600' },
});