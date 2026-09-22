// src/components/AILearningStatus.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBaby } from '../context/BabyContext';
import { useCustomization } from '../hooks/useCustomization';

const CONSENT_KEY = '@littleloom_ai_consent_v1';
const BAYES_PREFIX = '@littleloom_bayes_v1:';

interface LearningStats {
  samples: number;
  metrics: number;
  enabled: boolean;
}

export const AILearningStatus: React.FC = () => {
  const { currentBaby } = useBaby();
  const { fullThemeColors, borderRadiusValue, themeColors } = useCustomization();
  const [stats, setStats] = useState<LearningStats>({ samples: 0, metrics: 0, enabled: true });

  useEffect(() => {
    (async () => {
      if (!currentBaby?.id) return;

      // Check consent
      let enabled = true;
      try {
        const raw = await AsyncStorage.getItem(CONSENT_KEY);
        if (raw) enabled = JSON.parse(raw)?.learningEnabled !== false;
      } catch {}

      // Count learned metrics
      try {
        const keys = await AsyncStorage.getAllKeys();
        const babyKeys = keys.filter(k => k.startsWith(`${BAYES_PREFIX}${currentBaby.id}:`));
        let totalSamples = 0;
        for (const key of babyKeys) {
          try {
            const val = await AsyncStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              totalSamples += parsed?.n ?? 0;
            }
          } catch {}
        }
        setStats({ samples: totalSamples, metrics: babyKeys.length, enabled });
      } catch {}
    })();
  }, [currentBaby?.id]);

  const toggleEnabled = async () => {
    try {
      await AsyncStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ learningEnabled: !stats.enabled })
      );
      setStats(s => ({ ...s, enabled: !s.enabled }));
    } catch {}
  };

  if (!currentBaby) return null;

  const progress = Math.min(100, Math.round((stats.samples / 50) * 100));

  return (
    <Animated.View entering={FadeInUp} style={[
      styles.container,
      { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }
    ]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${themeColors.primary}15` }]}>
          <Ionicons name="sparkles" size={20} color={themeColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: fullThemeColors.text }]}>
            Personal AI Learning
          </Text>
          <Text style={[styles.subtitle, { color: fullThemeColors.textSecondary }]}>
            {stats.samples < 10
              ? 'Just getting started — keep logging!'
              : stats.samples < 50
              ? `Learning your baby's patterns (${stats.samples} samples)`
              : `Personalized (${stats.samples} samples across ${stats.metrics} metrics)`}
          </Text>
        </View>
        <TouchableOpacity onPress={toggleEnabled} style={styles.toggle}>
          <Ionicons
            name={stats.enabled ? 'toggle' : 'toggle-outline'}
            size={32}
            color={stats.enabled ? themeColors.primary : fullThemeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.progressBar, { backgroundColor: fullThemeColors.border }]}>
        <View style={[
          styles.progressFill,
          { width: `${progress}%`, backgroundColor: themeColors.primary }
        ]} />
      </View>
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
});

export default AILearningStatus;