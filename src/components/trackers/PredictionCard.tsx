import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { getPredictions, formatMinutes, Prediction, PredictorType } from '../../services/ai/PredictorEngine';

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
};

// Replace TYPE_META with Aura-aligned tracker colors
const TYPE_META: Record<PredictorType, { emoji: string; color: string; trackerId: string; label: string }> = {
  sleep:      { emoji: '😴', color: '#8b5cf6', trackerId: 'sleep',      label: 'Sleep' }, // violet — matches sleep tracker
  feed:       { emoji: '🍼', color: DS.warning, trackerId: 'feed',       label: 'Feed' },  // amber
  diaper:     { emoji: '🧷', color: DS.info,    trackerId: 'diaper',     label: 'Diaper' },// sky
  wake:       { emoji: '⏰', color: DS.info,    trackerId: 'sleep',      label: 'Wake' },  // sky
  medication: { emoji: '💊', color: DS.danger,  trackerId: 'medication', label: 'Med' },   // red
};

const STORAGE_PREFIX = '@littleloom_predictor_v1:';

const readState = async (babyId: string, type: PredictorType): Promise<{ n: number; level: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${babyId}:${type}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { n: parsed.n ?? 0, level: parsed.level ?? 0 };
  } catch {
    return null;
  }
};

type Urgency = 'now' | 'soon' | 'later' | 'unknown';

const getUrgency = (mins: number, conf: number): Urgency => {
  if (conf < 0.3) return 'unknown';
  if (mins <= 15) return 'now';
  if (mins <= 45) return 'soon';
  return 'later';
};

const URGENCY_STYLE: Record<Urgency, { label: string; color: string; bg: string; icon: any }> = {
  now: { label: 'Now', color: DS.danger, bg: `${DS.danger}15`, icon: 'alert-circle' },
  soon: { label: 'Soon', color: DS.warning, bg: `${DS.warning}15`, icon: 'time' },
  later: { label: 'Later', color: DS.success, bg: `${DS.success}15`, icon: 'checkmark-circle' },
  unknown: { label: 'Learning', color: DS.gray400, bg: `${DS.gray400}15`, icon: 'hourglass' },
};

interface Row {
  prediction: Prediction;
  n: number;
  level: number;
}

export default function PredictionCard() {
  const navigation = useNavigation<any>();
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier, isDark } = useCustomization();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [sampleCounts, setSampleCounts] = useState<Record<string, { n: number; level: number }>>({});
  const [loading, setLoading] = useState(true);

  const babyId = currentBaby?.id;

  const load = useCallback(async () => {
    if (!babyId) {
      setLoading(false);
      return;
    }
    try {
      const types: PredictorType[] = ['sleep', 'feed', 'diaper'];
      const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
      const loadPromise = Promise.all([getPredictions(babyId, types), ...types.map((t) => readState(babyId, t))]);
      const [results, ...states] = await Promise.race([loadPromise, timeoutPromise]);
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

  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const rows: Row[] = useMemo(() => {
    return predictions
      .map((p) => ({
        prediction: p,
        n: (sampleCounts[p.type] || { n: 0, level: 0 }).n,
        level: (sampleCounts[p.type] || { n: 0, level: 0 }).level,
      }))
      .sort((a, b) => {
        const order: Record<Urgency, number> = { now: 0, soon: 1, later: 2, unknown: 3 };
        const ua = getUrgency(a.prediction.minutesUntil, a.prediction.confidence);
        const ub = getUrgency(b.prediction.minutesUntil, b.prediction.confidence);
        if (order[ua] !== order[ub]) return order[ua] - order[ub];
        return a.prediction.minutesUntil - b.prediction.minutesUntil;
      });
  }, [predictions, sampleCounts]);

  if (!currentBaby) return null;

  if (loading && predictions.length === 0) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: fullThemeColors.surface,
            borderColor: fullThemeColors.border,
            borderRadius: borderRadiusValue,
            alignItems: 'center',
            paddingVertical: 20,
          },
        ]}
      >
        <ActivityIndicator size="small" color={DS.primary} />
        <Text style={{ color: fullThemeColors.textSecondary, marginTop: 8, fontSize: 12 }}>
          Analyzing patterns…
        </Text>
      </View>
    );
  }

  const totalSamples = Object.values(sampleCounts).reduce((s, v) => s + (v.n || 0), 0);
  const isLearning = totalSamples < 15;

  return (
    <Animated.View
      entering={FadeInUp}
      style={[
        styles.card,
        {
          backgroundColor: fullThemeColors.surface,
          borderColor: fullThemeColors.border,
          borderRadius: borderRadiusValue,
        },
      ]}
    >
      <LinearGradient
        colors={isDark ? ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.03)'] : ['rgba(99,102,241,0.04)', 'rgba(236,72,153,0.02)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${DS.primary}15` }]}>
          <Ionicons name="sparkles" size={16} color={DS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
            What's Next?
          </Text>
          <Text style={[styles.sub, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
            {isLearning
              ? `Learning ${currentBaby.name}'s rhythm · ${totalSamples} samples`
              : `Based on ${totalSamples} tracked events`}
          </Text>
        </View>
      </View>

      {/* Learning banner */}
      {isLearning && (
        <Animated.View
          entering={FadeIn}
          style={[styles.learningBanner, { backgroundColor: `${DS.primary}10`, borderColor: `${DS.primary}25` }]}
        >
          <Ionicons name="sparkles" size={14} color={DS.primary} />
          <Text style={[styles.learningText, { color: fullThemeColors.textSecondary }]}>
            Log more feeds, sleeps & diapers — predictions sharpen with each entry.
          </Text>
        </Animated.View>
      )}

      {/* Rows */}
      {!isLearning &&
        rows.map(({ prediction: p, n, level }, idx) => {
          const meta = TYPE_META[p.type];
          const urg = URGENCY_STYLE[getUrgency(p.minutesUntil, p.confidence)];
          const conf = Math.round(p.confidence * 100);
          const predictedTime = new Date(p.predictedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
          const learned = n > 0 ? formatMinutes(Math.round(level)) : null;

          return (
            <Animated.View
              key={p.type}
              entering={FadeInUp.delay(idx * 60)}
              style={{ marginBottom: 8 }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('AddEntry', { trackerId: meta.trackerId })}
                style={[
                  styles.row,
                  {
                    backgroundColor: `${meta.color}08`,
                    borderColor: `${meta.color}30`,
                    borderRadius: borderRadiusValue / 1.4,
                  },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${meta.color}18` }]}>
                  <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.rowTopLine}>
                    <Text style={[styles.rowTitle, { color: fullThemeColors.text, fontSize: 13 * fontSizeMultiplier }]}>
                      {meta.label}
                    </Text>
                    <View style={[styles.urgencyPill, { backgroundColor: urg.bg }]}>
                      <Ionicons name={urg.icon} size={10} color={urg.color} />
                      <Text style={[styles.urgencyText, { color: urg.color }]}>{urg.label}</Text>
                    </View>
                  </View>

                  <View style={styles.timeLine}>
                    <Text style={[styles.timeBig, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
                      ~{predictedTime}
                    </Text>
                    <Text style={[styles.timeIn, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
                      · in {formatMinutes(Math.max(0, p.minutesUntil))}
                    </Text>
                  </View>

                  {learned && (
                    <Text style={[styles.learned, { color: fullThemeColors.textSecondary, fontSize: 10.5 * fontSizeMultiplier }]}>
                      Every {learned} · {n} sample{n === 1 ? '' : 's'}
                    </Text>
                  )}

                  <View style={styles.confRow}>
                    <View style={[styles.confTrack, { backgroundColor: `${meta.color}15` }]}>
                      <View style={[styles.confFill, { width: `${Math.max(6, conf)}%`, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={[styles.confText, { color: fullThemeColors.textSecondary }]}>{conf}%</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={14} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

      {/* Footer */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Insights')}
        style={styles.footer}
      >
        <Text style={[styles.footerText, { color: DS.primary, fontSize: 11.5 * fontSizeMultiplier }]}>
          {isLearning ? 'Every log makes predictions sharper →' : 'View full insights →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontWeight: '500', marginTop: 1 },

  learningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  learningText: { flex: 1, fontWeight: '500', lineHeight: 15, fontSize: 11 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderWidth: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  urgencyText: { fontSize: 9.5, fontWeight: '800' },
  timeLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  timeBig: { fontWeight: '800', letterSpacing: -0.3 },
  timeIn: { fontWeight: '500' },
  learned: { fontWeight: '500', marginBottom: 6 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  confFill: { height: '100%', borderRadius: 2 },
  confText: { fontSize: 10, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  footer: { alignItems: 'center', paddingVertical: 6, marginTop: 2 },
  footerText: { fontWeight: '700' },
});