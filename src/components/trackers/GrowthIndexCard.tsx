import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useGrowthIntelligence, SubScore } from '../../hooks/';
import { SafeAvatar } from '../../components/';
import { useCustomization } from '../../hooks/useCustomization';

interface SubScoreBarProps {
  score: SubScore;
  index: number;
}

const SubScoreBar: React.FC<SubScoreBarProps> = ({ score, index }) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 100)} style={styles.subScoreContainer}>
      <View style={styles.subScoreHeader}>
        <View style={[styles.subScoreIcon, { backgroundColor: `${score.color}20` }]}>
          <Text style={styles.subScoreEmoji}>{getEmojiForLabel(score.label)}</Text>
        </View>
        <View style={styles.subScoreInfo}>
          <Text style={[styles.subScoreLabel, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
            {score.label}
          </Text>
          <Text style={[styles.subScoreTrend, { color: score.trend === 'up' ? '#10AC84' : score.trend === 'down' ? '#EE5A24' : fullThemeColors.textSecondary }]}>
            {score.trend === 'up' ? '↑' : score.trend === 'down' ? '↓' : '→'} {score.delta > 0 ? '+' : ''}{score.delta}
          </Text>
        </View>
        <Text style={[styles.subScoreValue, { color: score.color, fontSize: 18 * fontSizeMultiplier }]}>
          {score.value}
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: fullThemeColors.border, borderRadius: borderRadiusValue / 2 }]}>
        <View style={[
          styles.progressFill, 
          { 
            width: `${score.value}%`, 
            backgroundColor: score.color,
            borderRadius: borderRadiusValue / 2,
          }
        ]} />
      </View>
      <Text style={[styles.weightLabel, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
        Weight: {Math.round(score.weight * 100)}% of composite
      </Text>
    </Animated.View>
  );
};

const getEmojiForLabel = (label: string): string => {
  const map: Record<string, string> = {
    'Nutrition': '🍎',
    'Rest': '😴',
    'Physical': '💪',
    'Cognitive': '🧠',
    'Health': '❤️',
  };
  return map[label] || '📊';
};

export const GrowthIndexCard: React.FC = () => {
  const navigation = useNavigation();
  const { fullThemeColors, themeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const { growthIndex } = useGrowthIntelligence();

  const getIndexColor = (index: number): [string, string] => {
    if (index >= 85) return ['#10AC84', '#1DD1A1']; // Green
    if (index >= 70) return ['#FFD700', '#FF9F43']; // Yellow
    if (index >= 50) return ['#FF9F43', '#EE5A24']; // Orange
    return ['#EE5A24', '#FF6B6B']; // Red
  };

  const [gradientStart, gradientEnd] = getIndexColor(growthIndex.compositeIndex);

  return (
    <Animated.View entering={FadeInUp} style={[styles.container, { borderRadius: borderRadiusValue * 1.5 }]}>
      <LinearGradient
        colors={[gradientStart + '15', gradientEnd + '08']}
        style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue * 1.5 }]}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: fullThemeColors.text, fontSize: 20 * fontSizeMultiplier }]}>
            🧬 Growth Index
          </Text>
          <Text style={[styles.subtitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
            Last updated: {new Date(growthIndex.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.scoreCircle, { borderColor: gradientStart }]}>
          <Text style={[styles.scoreValue, { color: gradientStart, fontSize: 28 * fontSizeMultiplier }]}>
            {growthIndex.compositeIndex}
          </Text>
          <Text style={[styles.scoreLabel, { color: fullThemeColors.textSecondary }]}>/100</Text>
        </View>
      </View>

      {/* Sub Scores */}
      <View style={styles.subScores}>
        <SubScoreBar score={growthIndex.nutritionScore} index={0} />
        <SubScoreBar score={growthIndex.restScore} index={1} />
        <SubScoreBar score={growthIndex.physicalScore} index={2} />
        <SubScoreBar score={growthIndex.cognitiveScore} index={3} />
        <SubScoreBar score={growthIndex.healthStability} index={4} />
      </View>

      {/* Velocity Summary */}
      <View style={[styles.velocityCard, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}>
        <Text style={[styles.velocityTitle, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
          📈 Growth Velocity
        </Text>
        <View style={styles.velocityRow}>
          <VelocityPill 
            label="Height" 
            value={growthIndex.velocityTrends.height.perMonth} 
            unit="cm/mo" 
            percentile={growthIndex.velocityTrends.height.percentile}
            color="#667eea"
          />
          <VelocityPill 
            label="Weight" 
            value={growthIndex.velocityTrends.weight.perMonth} 
            unit="kg/mo" 
            percentile={growthIndex.velocityTrends.weight.percentile}
            color="#fa709a"
          />
          <VelocityPill 
            label="Head" 
            value={growthIndex.velocityTrends.head.perMonth} 
            unit="cm/mo" 
            percentile={growthIndex.velocityTrends.head.percentile}
            color="#11998e"
          />
        </View>
      </View>

      {/* Milestone Readiness */}
      {growthIndex.milestoneReadiness.length > 0 && (
        <View style={styles.readinessSection}>
          <Text style={[styles.readinessTitle, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
            🎯 Milestone Readiness
          </Text>
          {growthIndex.milestoneReadiness.map((readiness, idx) => (
            <TouchableOpacity 
              key={idx}
              style={[styles.readinessItem, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}
              onPress={() => navigation.navigate('AddEntry', { 
                trackerId: 'milestone', 
                presetData: { category: readiness.category } 
              })}
            >
              <View style={[styles.readinessBar, { backgroundColor: fullThemeColors.border }]}>
                <View style={[
                  styles.readinessFill,
                  { 
                    width: `${readiness.readinessPercent}%`,
                    backgroundColor: readiness.readinessPercent > 80 ? '#10AC84' : readiness.readinessPercent > 50 ? '#FFD700' : '#FF9F43',
                  }
                ]} />
              </View>
              <View style={styles.readinessInfo}>
                <Text style={[styles.readinessCategory, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
                  {readiness.category.charAt(0).toUpperCase() + readiness.category.slice(1)}
                </Text>
                <Text style={[styles.readinessPercent, { color: fullThemeColors.textSecondary }]}>
                  {readiness.readinessPercent}% ready
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={fullThemeColors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Predicted Checkup */}
      <View style={[styles.checkupCard, { backgroundColor: `${themeColors.primary}10`, borderRadius: borderRadiusValue }]}>
        <Ionicons name="calendar" size={20} color={themeColors.primary} />
        <Text style={[styles.checkupText, { color: fullThemeColors.text, fontSize: 13 * fontSizeMultiplier }]}>
          Next checkup suggested: {growthIndex.predictedNextCheckup.toLocaleDateString()}
        </Text>
      </View>
    </Animated.View>
  );
};

const VelocityPill: React.FC<{ label: string; value: number; unit: string; percentile: number; color: string }> = ({
  label, value, unit, percentile, color
}) => (
  <View style={styles.velocityPill}>
    <Text style={[styles.velocityPillLabel, { color }]}>{label}</Text>
    <Text style={styles.velocityPillValue}>
      {value > 0 ? value.toFixed(1) : '--'} <Text style={styles.velocityPillUnit}>{unit}</Text>
    </Text>
    <Text style={[styles.velocityPillPercentile, { color }]}>{percentile}th %ile (latest)</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontWeight: '500',
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  subScores: {
    gap: 14,
  },
  subScoreContainer: {
    gap: 6,
  },
  subScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subScoreIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subScoreEmoji: {
    fontSize: 18,
  },
  subScoreInfo: {
    flex: 1,
  },
  subScoreLabel: {
    fontWeight: '700',
  },
  subScoreTrend: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  subScoreValue: {
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  weightLabel: {
    fontWeight: '500',
    marginTop: 2,
  },
  velocityCard: {
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  velocityTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  velocityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  velocityPill: {
    alignItems: 'center',
    flex: 1,
  },
  velocityPillLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  velocityPillValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  velocityPillUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  velocityPillPercentile: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  readinessSection: {
    marginTop: 16,
    gap: 8,
  },
  readinessTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  readinessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  readinessBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  readinessFill: {
    height: '100%',
  },
  readinessInfo: {
    flex: 1,
  },
  readinessCategory: {
    fontWeight: '700',
  },
  readinessPercent: {
    fontSize: 12,
    marginTop: 2,
  },
  checkupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  checkupText: {
    fontWeight: '600',
    flex: 1,
  },
});

export default GrowthIndexCard;
