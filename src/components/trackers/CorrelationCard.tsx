// src/components/trackers/CorrelationCard.tsx
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
  discoverCorrelations,
  DiscoveredCorrelation,
} from '../../services/ai/CorrelationEngine';

export default function CorrelationCard() {
  const navigation = useNavigation<any>();
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } =
    useCustomization();

  const [correlations, setCorrelations] = useState<DiscoveredCorrelation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentBaby?.id) return;
    setLoading(true);
    try {
      const list = await discoverCorrelations(currentBaby.id, 45);
      setCorrelations(list);
    } catch (e) {
      if (__DEV__) console.warn('[CorrelationCard] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [currentBaby?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!currentBaby) return null;

  if (loading && correlations.length === 0) {
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

  if (correlations.length === 0) return null;

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
        <Text style={{ fontSize: 18 }}>🔍</Text>
        <Text
          style={[
            styles.headerText,
            {
              color: fullThemeColors.text,
              fontSize: 14 * fontSizeMultiplier,
            },
          ]}
        >
          Patterns in {currentBaby.name}'s Data
        </Text>
      </View>

      {correlations.slice(0, 3).map((c, idx) => (
        <Animated.View
          key={c.id}
          entering={FadeInUp.delay(idx * 60)}
          style={[
            styles.card,
            {
              backgroundColor: `${
                c.direction === 'positive' ? '#10b981' : '#f59e0b'
              }10`,
              borderRadius: borderRadiusValue / 1.5,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={[
                  styles.headline,
                  {
                    color: fullThemeColors.text,
                    fontSize: 14 * fontSizeMultiplier,
                  },
                ]}
              >
                {c.headline}
              </Text>
              <Text
                style={[
                  styles.description,
                  {
                    color: fullThemeColors.textSecondary,
                    fontSize: 12 * fontSizeMultiplier,
                  },
                ]}
              >
                {c.description}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.effectBadge,
              {
                backgroundColor: `${
                  c.direction === 'positive' ? '#10b981' : '#f59e0b'
                }20`,
              },
            ]}
          >
            <Ionicons
              name={
                c.direction === 'positive' ? 'trending-up' : 'trending-down'
              }
              size={12}
              color={c.direction === 'positive' ? '#10b981' : '#f59e0b'}
            />
            <Text
              style={[
                styles.effectText,
                { color: c.direction === 'positive' ? '#10b981' : '#f59e0b' },
              ]}
            >
              {c.effectSize > 0.7
                ? 'Strong'
                : c.effectSize > 0.5
                ? 'Moderate'
                : 'Weak'}{' '}
              pattern · {c.samples} samples
            </Text>
          </View>

          <View style={styles.suggestionRow}>
            <Ionicons
              name="bulb-outline"
              size={14}
              color={fullThemeColors.textSecondary}
            />
            <Text
              style={[
                styles.suggestionText,
                { color: fullThemeColors.textSecondary },
              ]}
            >
              {c.suggestion}
            </Text>
          </View>
        </Animated.View>
      ))}

      <TouchableOpacity
        style={styles.footer}
        onPress={() => navigation.navigate('Insights')}
      >
        <Text style={[styles.footerText, { color: '#667eea' }]}>
          View all patterns in Insights →
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
  card: { padding: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  headline: { fontWeight: '700' },
  description: { marginTop: 3, lineHeight: 16 },
  effectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  effectText: { fontSize: 11, fontWeight: '700' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  suggestionText: { fontSize: 12, flex: 1, lineHeight: 16 },
  footer: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  footerText: { fontSize: 12, fontWeight: '600' },
});