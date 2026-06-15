import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useCustomization } from '@/hooks/useCustomization';

export interface TimelineCorrelation {
  id: string;
  type: 'feed_sleep_pattern' | 'growth_milestone_correlation' | 'health_alert' | 'activity_cluster';
  primaryEntry: { trackerId: string; title: string; timestamp: number };
  relatedEntry: { trackerId: string; title: string; timestamp: number };
  insight: string;
  confidence: number;
  color: string;
}

interface TrackerCorrelationBadgeProps {
  correlation: TimelineCorrelation;
  index: number;
}

export const TrackerCorrelationBadge: React.FC<TrackerCorrelationBadgeProps> = ({ correlation, index }) => {
  const navigation = useNavigation();
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const typeConfig: Record<string, { icon: string; label: string; gradient: [string, string] }> = {
    feed_sleep_pattern: { icon: 'restaurant', label: 'Feed → Sleep', gradient: ['#FF9F43', '#5F27CD'] },
    growth_milestone_correlation: { icon: 'trending-up', label: 'Growth ↔ Milestone', gradient: ['#10AC84', '#FFD700'] },
    health_alert: { icon: 'warning', label: 'Health Pattern', gradient: ['#EE5A24', '#FF6B6B'] },
    activity_cluster: { icon: 'apps', label: 'Activity Cluster', gradient: ['#54A0FF', '#00D2D3'] },
  };

  const config = typeConfig[correlation.type] || typeConfig.activity_cluster;

  return (
    <Animated.View entering={FadeIn.delay(index * 100)} style={styles.container}>
      <TouchableOpacity
        style={[
          styles.badge,
          {
            backgroundColor: `${config.gradient[0]}10`,
            borderColor: `${config.gradient[0]}25`,
            borderRadius: borderRadiusValue,
            borderWidth: 1.5,
          },
        ]}
        onPress={() => {
          navigation.navigate('Timeline', {
            filter: correlation.primaryEntry.trackerId,
          });
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${config.gradient[0]}20` }]}>
          <Ionicons name={config.icon as any} size={16} color={config.gradient[0]} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 13 * fontSizeMultiplier }]}>
            {config.label}
          </Text>
          <Text style={[styles.insight, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]} numberOfLines={2}>
            {correlation.insight}
          </Text>
        </View>

        <View style={styles.right}>
          <View style={[styles.confidenceBadge, { backgroundColor: `${config.gradient[0]}15` }]}>
            <Text style={[styles.confidenceText, { color: config.gradient[0] }]}>
              {correlation.confidence}%
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={config.gradient[0]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontWeight: '700',
    marginBottom: 2,
  },
  insight: {
    fontWeight: '500',
    lineHeight: 16,
  },
  right: {
    alignItems: 'center',
    marginLeft: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default TrackerCorrelationBadge;
