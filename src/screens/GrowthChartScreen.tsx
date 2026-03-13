import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const GROWTH_DATA = {
  height: {
    labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
    datasets: [
      {
        data: [50, 61, 67, 72, 76, 79, 82],
        color: () => '#667eea',
      },
    ],
  },
  weight: {
    labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
    datasets: [
      {
        data: [3.5, 6.0, 7.8, 8.9, 9.8, 10.5, 11.2],
        color: () => '#fa709a',
      },
    ],
  },
  head: {
    labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
    datasets: [
      {
        data: [35, 40, 43, 45, 47, 48, 49],
        color: () => '#11998e',
      },
    ],
  },
};

const ENTRIES = [
  { id: '1', date: 'Mar 1, 2026', type: 'Height', value: '32 in', change: '+0.5 in', emoji: '📏' },
  { id: '2', date: 'Feb 15, 2026', type: 'Weight', value: '24.7 lbs', change: '+0.8 lbs', emoji: '⚖️' },
  { id: '3', date: 'Feb 1, 2026', type: 'Head', value: '19.3 in', change: '+0.2 in', emoji: '🧠' },
];

export default function GrowthChartScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'height' | 'weight' | 'head'>('height');

  const chartConfig = {
    backgroundGradientFrom: 'rgba(255,255,255,0)',
    backgroundGradientTo: 'rgba(255,255,255,0)',
    color: () => '#667eea',
    strokeWidth: 3,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 12,
      fontWeight: '600',
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#fff',
    },
  };

  const tabColors = {
    height: '#667eea',
    weight: '#fa709a',
    head: '#11998e',
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Growth 📈</Text>
          <TouchableOpacity style={styles.addButton}>
            <BlurView intensity={80} style={styles.addBlur}>
              <Ionicons name="add" size={24} color="#667eea" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <BlurView intensity={90} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Height</Text>
            <Text style={styles.summaryValue}>32"</Text>
            <Text style={styles.summarySub}>82 cm</Text>
          </BlurView>
          <BlurView intensity={90} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Weight</Text>
            <Text style={styles.summaryValue}>24.7</Text>
            <Text style={styles.summarySub}>lbs</Text>
          </BlurView>
          <BlurView intensity={90} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Head</Text>
            <Text style={styles.summaryValue}>19.3"</Text>
            <Text style={styles.summarySub}>49 cm</Text>
          </BlurView>
        </View>

        {/* Chart Tabs */}
        <View style={styles.tabContainer}>
          {(['height', 'weight', 'head'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: `${tabColors[tab]}20` }
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && { color: tabColors[tab], fontWeight: '700' }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <BlurView intensity={90} style={styles.chartContainer}>
          <LineChart
            data={GROWTH_DATA[activeTab]}
            width={width - 88}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: () => tabColors[activeTab],
            }}
            bezier
            style={styles.chart}
            withVerticalLines={false}
            withHorizontalLines={true}
            withHorizontalLabels={true}
            withVerticalLabels={true}
            withDots={true}
            withShadow={false}
          />
        </BlurView>

        {/* Percentile Info */}
        <BlurView intensity={80} style={styles.percentileCard}>
          <View style={styles.percentileContent}>
            <Text style={styles.percentileEmoji}>🎯</Text>
            <View>
              <Text style={styles.percentileTitle}>75th Percentile</Text>
              <Text style={styles.percentileText}>
                Emma is growing great! Height is above average for 18 months.
              </Text>
            </View>
          </View>
        </BlurView>

        {/* Recent Entries */}
        <Text style={styles.sectionTitle}>Recent Measurements</Text>
        {ENTRIES.map((entry) => (
          <BlurView key={entry.id} intensity={80} style={styles.entryCard}>
            <Text style={styles.entryEmoji}>{entry.emoji}</Text>
            <View style={styles.entryContent}>
              <Text style={styles.entryType}>{entry.type}</Text>
              <Text style={styles.entryDate}>{entry.date}</Text>
            </View>
            <View style={styles.entryValues}>
              <Text style={styles.entryValue}>{entry.value}</Text>
              <Text style={styles.entryChange}>{entry.change}</Text>
            </View>
          </BlurView>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  summarySub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
  },
  chartContainer: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -10,
  },
  percentileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  percentileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentileEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  percentileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  percentileText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  entryEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  entryContent: {
    flex: 1,
  },
  entryType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  entryDate: {
    fontSize: 13,
    color: '#666',
  },
  entryValues: {
    alignItems: 'flex-end',
  },
  entryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  entryChange: {
    fontSize: 12,
    color: '#11998e',
    fontWeight: '600',
    marginTop: 2,
  },
});