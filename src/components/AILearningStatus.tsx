// src/components/AILearningStatus.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useBaby } from '../context/BabyContext';
import { useCustomization } from '../hooks/useCustomization';

const CONSENT_KEY = '@littleloom_ai_consent_v1';
const BAYES_PREFIX = '@littleloom_bayes_v1:';

interface LearningStats {
  samples: number;
  metrics: number;
  enabled: boolean;
  blocked: boolean;
}

export const AILearningStatus: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, themeColors } = useCustomization();
  const [stats, setStats] = useState<LearningStats>({
    samples: 0,
    metrics: 0,
    enabled: true,
    blocked: false,
  });

  const loadStats = useCallback(async () => {
    if (!currentBaby?.id) return;

    let enabled = true;
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      if (raw) enabled = JSON.parse(raw)?.learningEnabled !== false;
    } catch {}

    // If the baby was GDPR-blocked, the toggle is effectively OFF
    // regardless of the consent flag. Surface that to the user.
    let blocked = false;
    try {
      const blockRaw = await AsyncStorage.getItem(
        `@littleloom_cohort_do_not_contribute_v1:${currentBaby.id}`
      );
      blocked = blockRaw === 'true';
    } catch {}
    if (blocked) enabled = false;

    try {
      const keys = await AsyncStorage.getAllKeys();
      const babyKeys = keys.filter(k =>
        typeof k === 'string' &&
        k.startsWith(`${BAYES_PREFIX}${currentBaby.id}:`)
      );
      let totalSamples = 0;
      let validMetrics = 0;
      for (const key of babyKeys) {
        try {
          const val = await AsyncStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            const n = Number(parsed?.n);
            if (Number.isFinite(n) && n > 0) {
              totalSamples += n;
              validMetrics += 1;
            }
          }
        } catch {}
      }
      setStats({ samples: totalSamples, metrics: validMetrics, enabled, blocked });
    } catch (err) {
      if (__DEV__) console.warn('[AILearningStatus] count failed:', err);
    }
  }, [currentBaby?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!currentBaby) return null;

  const progress = Math.min(100, Math.round((stats.samples / 50) * 100));

  const handlePress = () => {
    navigation.navigate('AIManagement');
  };

  const handleToggle = async () => {
    // When blocked, redirect to the management screen instead of
    // silently flipping a toggle that has no effect.
    if (!stats.enabled && stats.blocked) {
      navigation.navigate('AIManagement');
      return;
    }
    try {
      await AsyncStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ learningEnabled: !stats.enabled })
      );
      setStats(s => ({ ...s, enabled: !s.enabled }));
    } catch {}
  };

  return (
    <Animated.View
      entering={FadeInUp}
      style={[
        styles.container,
        {
          backgroundColor: fullThemeColors.surface,
          borderRadius: borderRadiusValue,
          borderColor: fullThemeColors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${themeColors.primary}15` }]}>
          <Ionicons name="sparkles" size={20} color={themeColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: fullThemeColors.text }]}>
            Personal AI Learning
          </Text>
        <Text style={[styles.subtitle, { color: fullThemeColors.textSecondary }]}>
          {!stats.enabled
            ? 'Contribution disabled — tap to manage'
            : stats.samples < 5
            ? 'Just getting started — log a few more entries'
            : stats.samples < 15
            ? `Learning patterns (${stats.samples} samples · needs 15+)`
            : stats.samples < 50
            ? `Learning your baby's patterns (${stats.samples} samples)`
            : `Personalized (${stats.samples} samples across ${stats.metrics} metric${stats.metrics !== 1 ? 's' : ''})`}
        </Text>
        </View>
        <TouchableOpacity onPress={handleToggle} style={styles.toggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={stats.enabled ? 'toggle' : 'toggle-outline'}
            size={32}
            color={stats.enabled ? themeColors.primary : fullThemeColors.textSecondary}
          />
        </TouchableOpacity>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={fullThemeColors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      <View style={[styles.progressBar, { backgroundColor: fullThemeColors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%`, backgroundColor: themeColors.primary },
          ]}
        />
      </View>

      <TouchableOpacity onPress={handlePress} style={styles.footerLink}>
        <Text style={[styles.footerText, { color: themeColors.primary }]}>
          View detailed learning status →
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  toggle: { padding: 4 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  footerLink: { marginTop: 10, alignItems: 'flex-end' },
  footerText: { fontSize: 12, fontWeight: '700' },
});

export default AILearningStatus;