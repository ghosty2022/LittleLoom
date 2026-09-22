// src/components/trackers/PredictionCard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import {
  getPredictions,
  Prediction,
  PredictorType,
} from '../../services/ai/PredictorEngine';

const TYPE_META: Record<PredictorType, { emoji: string; color: string; trackerId: string }> = {
  sleep: { emoji: '😴', color: '#5F27CD', trackerId: 'sleep' },
  feed: { emoji: '🍼', color: '#FF9F43', trackerId: 'feed' },
  diaper: { emoji: '🧷', color: '#54A0FF', trackerId: 'diaper' },
  wake: { emoji: '⏰', color: '#00D2D3', trackerId: 'sleep' },
  medication: { emoji: '💊', color: '#e74c3c', trackerId: 'medication' },
};

export default function PredictionCard() {
  const navigation = useNavigation<any>();
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentBaby?.id) return;
    try {
      const results = await getPredictions(currentBaby.id, ['sleep', 'feed', 'diaper']);
      setPredictions(results);
    } catch (e) {
      if (__DEV__) console.warn('[PredictionCard] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [currentBaby?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh every 30 seconds so "in 45m" ticks down
  useEffect(() => {
    const iv = setInterval(() => {
      load();
    }, 30_000);
    return () => clearInterval(iv);
  }, [load]);

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

  // Hide the card entirely when there's nothing meaningful to show
  if (predictions.length === 0) return null;

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
      <View style={styles.header}>
        <Text style={{ fontSize: 18 }}>🔮</Text>
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
      </View>

      {predictions.map((p, idx) => {
        const meta = TYPE_META[p.type];
        const conf = Math.round(p.confidence * 100);
        const confidenceColor =
          conf > 60 ? '#10b981' : conf > 30 ? '#f59e0b' : '#94a3b8';

        const earliestText = new Date(p.earliest).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const latestText = new Date(p.latest).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const predictedText = new Date(p.predictedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <TouchableOpacity
            key={p.type}
            onPress={() =>
              navigation.navigate('AddEntry', { trackerId: meta.trackerId })
            }
            style={[
              styles.row,
              {
                backgroundColor: `${meta.color}10`,
                borderRadius: borderRadiusValue / 1.5,
              },
            ]}
            activeOpacity={0.75}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: `${meta.color}20` }]}
            >
              <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[
                  styles.title,
                  {
                    color: fullThemeColors.text,
                    fontSize: 14 * fontSizeMultiplier,
                  },
                ]}
              >
                {p.label}
              </Text>
              <Text
                style={[
                  styles.meta,
                  {
                    color: fullThemeColors.textSecondary,
                    fontSize: 11 * fontSizeMultiplier,
                  },
                ]}
              >
                {predictedText} · Window {earliestText}–{latestText}
              </Text>
            </View>

            <View
              style={[
                styles.confPill,
                { backgroundColor: `${confidenceColor}20` },
              ]}
            >
              <Text style={[styles.confText, { color: confidenceColor }]}>
                {conf}%
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.footer}
        onPress={() => navigation.navigate('Insights')}
      >
        <Text style={[styles.footerText, { color: '#667eea' }]}>
          Predictions get more accurate as you track →
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: { fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700' },
  meta: { marginTop: 3 },
  confPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confText: { fontSize: 11, fontWeight: '800' },
  footer: { alignItems: 'center', paddingVertical: 6, marginTop: 4 },
  footerText: { fontSize: 12, fontWeight: '600' },
});