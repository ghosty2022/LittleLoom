import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
  InteractionManager,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp, FadeInDown, FadeIn, Layout, useSharedValue, useAnimatedScrollHandler, withSpring, useAnimatedStyle, interpolate, Extrapolation, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths, addMonths, subMonths, parseISO, isValid, isToday, isYesterday, addDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBaby, GrowthMeasurement, Milestone, BabyProfile } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useMedia } from '../../context/MediaContext';
import { useAuth } from '../../context/AuthContext';
import { AutoHideScrollView, AutoHideFlatList, AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar, isImageUri, isEmoji } from '../../components/SafeAvatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedScrollView = AutoHideAnimatedScrollView;

type ChartType = 'line' | 'area' | 'bar' | 'velocity' | 'comparison';
type TimeRange = '3m' | '6m' | '1y' | '2y' | '5y' | 'all';
type MetricType = 'height' | 'weight' | 'head' | 'bmi' | 'velocity';
type PhotoSource = 'app' | 'device';

interface PercentileData {
  p3: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  p97: number[];
  labels: string[];
}

interface GrowthInsight {
  id: string;
  type: 'milestone' | 'trend' | 'alert' | 'prediction' | 'vaccination' | 'comparison' | 'concern';
  title: string;
  description: string;
  icon: string;
  color: string;
  date: string;
  priority?: 'high' | 'medium' | 'low';
  action?: string;
}

interface PhotoCorrelation {
  id: string;
  uri: string;
  date: string;
  measurementId?: string;
  milestoneId?: string;
  age: string;
  source: PhotoSource;
  assetId?: string;
  mediaType?: 'photo' | 'video';
  duration?: number;
  folderName?: string;
  userId: string;
  isPrivate: boolean;
  measurement?: GrowthMeasurement | null;
}

interface SiblingComparison {
  babyId: string;
  name: string;
  color: string;
  data: { date: string; value: number }[];
  percentileDiff: number;
}

interface VaccinationDose {
  id: string;
  vaccineName: string;
  doseNumber: number;
  dueDate: string;
  completedDate?: string;
  status: 'completed' | 'due' | 'overdue' | 'upcoming';
  ageRange: string;
}

interface PhotoFolder {
  id: string;
  title: string;
  assetCount: number;
  thumbnailUri?: string;
}

const BLUR_INTENSITY = Platform.OS === 'ios' ? 80 : 60;

const safeParseDate = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isValid(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};

const safeDifferenceInMonths = (dateLeft: Date | string | undefined, dateRight: Date | string | undefined): number => {
  const left = safeParseDate(typeof dateLeft === 'string' ? dateLeft : undefined) || (dateLeft instanceof Date ? dateLeft : null);
  const right = safeParseDate(typeof dateRight === 'string' ? dateRight : undefined) || (dateRight instanceof Date ? dateRight : null);
  if (!left || !right) return 0;
  return differenceInMonths(left, right);
};

const safeDifferenceInDays = (dateLeft: Date | string | undefined, dateRight: Date | string | undefined): number => {
  const left = safeParseDate(typeof dateLeft === 'string' ? dateLeft : undefined) || (dateLeft instanceof Date ? dateLeft : null);
  const right = safeParseDate(typeof dateRight === 'string' ? dateRight : undefined) || (dateRight instanceof Date ? dateRight : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeFormatDate = (date: Date | string | undefined | null, formatStr: string): string => {
  const parsed = safeParseDate(typeof date === 'string' ? date : undefined) || (date instanceof Date ? date : null);
  if (!parsed) return 'Unknown date';
  try {
    return format(parsed, formatStr);
  } catch {
    return 'Invalid date';
  }
};

const WHO_LMS_PARAMS: Record<string, Record<string, Record<number, { L: number; M: number; S: number }>>> = {
  height: {
    boy: {
      0: { L: 1, M: 49.8842, S: 0.03790 },
      1: { L: 1, M: 54.7244, S: 0.03558 },
      3: { L: 1, M: 61.6054, S: 0.03273 },
      6: { L: 1, M: 67.6026, S: 0.03063 },
      9: { L: 1, M: 71.5045, S: 0.02951 },
      12: { L: 1, M: 74.5350, S: 0.02874 },
      18: { L: 1, M: 79.3076, S: 0.02784 },
      24: { L: 1, M: 83.5488, S: 0.02726 },
    },
    girl: {
      0: { L: 1, M: 49.1477, S: 0.03795 },
      1: { L: 1, M: 53.8982, S: 0.03568 },
      3: { L: 1, M: 60.7509, S: 0.03284 },
      6: { L: 1, M: 66.5963, S: 0.03074 },
      9: { L: 1, M: 70.4628, S: 0.02962 },
      12: { L: 1, M: 73.4903, S: 0.02885 },
      18: { L: 1, M: 78.2556, S: 0.02795 },
      24: { L: 1, M: 82.5554, S: 0.02737 },
    },
  },
  weight: {
    boy: {
      0: { L: -0.1600954, M: 3.5302031, S: 0.11218624 },
      1: { L: -0.2013239, M: 4.3402931, S: 0.11488736 },
      3: { L: -0.0638891, M: 6.1271573, S: 0.10954490 },
      6: { L: -0.1450925, M: 7.7509601, S: 0.10686255 },
      9: { L: -0.2162840, M: 8.9015212, S: 0.10526840 },
      12: { L: -0.2665410, M: 9.7511429, S: 0.10424690 },
      18: { L: -0.3042052, M: 11.1442610, S: 0.10304230 },
      24: { L: -0.2853157, M: 12.1928210, S: 0.10241890 },
    },
    girl: {
      0: { L: 0.0521267, M: 3.4002931, S: 0.11148950 },
      1: { L: -0.0325635, M: 4.1720911, S: 0.11394920 },
      3: { L: -0.0707665, M: 5.7915453, S: 0.10981410 },
      6: { L: -0.1264159, M: 7.2082251, S: 0.10725950 },
      9: { L: -0.1803270, M: 8.2876789, S: 0.10589980 },
      12: { L: -0.2255660, M: 9.1350301, S: 0.10511540 },
      18: { L: -0.2666570, M: 10.4000090, S: 0.10424690 },
      24: { L: -0.2809460, M: 11.5123700, S: 0.10380630 },
    },
  },
  head: {
    boy: {
      0: { L: 1, M: 34.4618, S: 0.03686 },
      1: { L: 1, M: 37.2759, S: 0.03520 },
      3: { L: 1, M: 40.2491, S: 0.03343 },
      6: { L: 1, M: 42.9235, S: 0.03215 },
      9: { L: 1, M: 44.9048, S: 0.03134 },
      12: { L: 1, M: 46.5048, S: 0.03078 },
      18: { L: 1, M: 48.6244, S: 0.03000 },
      24: { L: 1, M: 49.4432, S: 0.02956 },
    },
    girl: {
      0: { L: 1, M: 33.8787, S: 0.03720 },
      1: { L: 1, M: 36.5463, S: 0.03555 },
      3: { L: 1, M: 39.3311, S: 0.03380 },
      6: { L: 1, M: 41.8810, S: 0.03253 },
      9: { L: 1, M: 43.7979, S: 0.03173 },
      12: { L: 1, M: 45.3660, S: 0.03118 },
      18: { L: 1, M: 47.2232, S: 0.03040 },
      24: { L: 1, M: 48.1878, S: 0.02996 },
    },
  },
};

const VACCINATION_SCHEDULE: VaccinationDose[] = [
  { id: '1', vaccineName: 'Hepatitis B', doseNumber: 1, ageRange: 'Birth', dueDate: '0', status: 'completed' },
  { id: '2', vaccineName: 'Hepatitis B', doseNumber: 2, ageRange: '1-2 months', dueDate: '30', status: 'upcoming' },
  { id: '3', vaccineName: 'DTaP', doseNumber: 1, ageRange: '2 months', dueDate: '60', status: 'upcoming' },
  { id: '4', vaccineName: 'IPV', doseNumber: 1, ageRange: '2 months', dueDate: '60', status: 'upcoming' },
  { id: '5', vaccineName: 'Hib', doseNumber: 1, ageRange: '2 months', dueDate: '60', status: 'upcoming' },
  { id: '6', vaccineName: 'PCV13', doseNumber: 1, ageRange: '2 months', dueDate: '60', status: 'upcoming' },
  { id: '7', vaccineName: 'Rotavirus', doseNumber: 1, ageRange: '2 months', dueDate: '60', status: 'upcoming' },
  { id: '8', vaccineName: 'Hepatitis B', doseNumber: 3, ageRange: '6-18 months', dueDate: '180', status: 'upcoming' },
  { id: '9', vaccineName: 'DTaP', doseNumber: 2, ageRange: '4 months', dueDate: '120', status: 'upcoming' },
  { id: '10', vaccineName: 'IPV', doseNumber: 2, ageRange: '4 months', dueDate: '120', status: 'upcoming' },
];

const calculateZScore = (value: number, ageMonths: number, type: MetricType, gender: 'boy' | 'girl'): number => {
  if (type === 'bmi' || type === 'velocity') return 0;
  const clampedAge = Math.min(Math.max(ageMonths, 0), 24);
  const availableAges = Object.keys(WHO_LMS_PARAMS[type]?.[gender] || {}).map(Number).sort((a, b) => a - b);
  let closestAge = availableAges[0] || 0;
  let minDiff = Math.abs(clampedAge - closestAge);
  for (const age of availableAges) {
    const diff = Math.abs(clampedAge - age);
    if (diff < minDiff) {
      minDiff = diff;
      closestAge = age;
    }
  }
  const params = WHO_LMS_PARAMS[type]?.[gender]?.[closestAge];
  if (!params) return 0;
  const { L, M, S } = params;
  let z: number;
  if (Math.abs(L) < 0.001) {
    z = Math.log(value / M) / S;
  } else {
    z = (Math.pow(value / M, L) - 1) / (L * S);
  }
  return z;
};

const zScoreToPercentile = (z: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return Math.round(50 * (1 + sign * y));
};

const calculatePercentile = (value: number, ageMonths: number, type: MetricType, gender: 'boy' | 'girl'): number => {
  if (type === 'bmi' || type === 'velocity') return 50;
  const z = calculateZScore(value, ageMonths, type, gender);
  return zScoreToPercentile(z);
};

const getGrowthStatus = (percentile: number): { label: string; color: string; icon: string } => {
  if (percentile < 3) return { label: 'Severely Low', color: '#ef4444', icon: '⚠️' };
  if (percentile < 10) return { label: 'Low', color: '#f97316', icon: '↓' };
  if (percentile < 25) return { label: 'Below Average', color: '#f59e0b', icon: '↓' };
  if (percentile < 75) return { label: 'Normal', color: '#10b981', icon: '✓' };
  if (percentile < 90) return { label: 'Above Average', color: '#3b82f6', icon: '↑' };
  if (percentile < 97) return { label: 'High', color: '#8b5cf6', icon: '↑' };
  return { label: 'Severely High', color: '#ef4444', icon: '⚠️' };
};

const analyzeGrowthTrend = (measurements: GrowthMeasurement[], type: MetricType): GrowthInsight[] => {
  const insights: GrowthInsight[] = [];
  if (measurements.length < 2) return insights;
  const sorted = [...measurements].sort((a, b) => {
    const dateA = safeParseDate(a.date)?.getTime() || 0;
    const dateB = safeParseDate(b.date)?.getTime() || 0;
    return dateA - dateB;
  });
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const first = sorted[0];
  if (latest.value < previous.value) {
    const drop = ((previous.value - latest.value) / previous.value) * 100;
    if (drop > 5) {
      insights.push({
        id: 'drop-alert',
        type: 'concern',
        title: 'Measurement Decrease Detected',
        description: `Latest ${type} is ${drop.toFixed(1)}% lower than previous. Please verify measurement accuracy.`,
        icon: '⚠️',
        color: '#ef4444',
        date: latest.date,
        priority: 'high',
        action: 'Double-check measurement technique',
      });
    }
  }
  const timeSpanMonths = safeDifferenceInMonths(latest.date, first.date);
  if (timeSpanMonths > 0) {
    const totalGrowth = latest.value - first.value;
    const velocity = totalGrowth / timeSpanMonths;
    let expectedVelocity = 0;
    if (type === 'height') expectedVelocity = 1.5;
    if (type === 'weight') expectedVelocity = 0.4;
    if (expectedVelocity > 0) {
      const ratio = velocity / expectedVelocity;
      if (ratio < 0.7) {
        insights.push({
          id: 'slow-growth',
          type: 'alert',
          title: 'Slower Growth Detected',
          description: `Growth velocity is ${(ratio * 100).toFixed(0)}% of expected. Consider discussing with pediatrician.`,
          icon: '📉',
          color: '#f59e0b',
          date: latest.date,
          priority: 'medium',
        });
      } else if (ratio > 1.3) {
        insights.push({
          id: 'fast-growth',
          type: 'trend',
          title: 'Growing Fast! 🚀',
          description: `Growth velocity is ${(ratio * 100).toFixed(0)}% of expected. Excellent progress!`,
          icon: '📈',
          color: '#10b981',
          date: latest.date,
          priority: 'low',
        });
      }
    }
  }
  if (sorted.length >= 3) {
    const recent = sorted.slice(-3);
    const avgGrowth = (recent[2].value - recent[0].value) / 2;
    const predicted = latest.value + avgGrowth;
    insights.push({
      id: 'prediction',
      type: 'prediction',
      title: 'AI Prediction',
      description: `Based on trends, next ${type} measurement may be around ${predicted.toFixed(1)}${latest.unit}`,
      icon: '🔮',
      color: '#8b5cf6',
      date: new Date().toISOString(),
      priority: 'low',
    });
  }
  return insights;
};

// ==================== SUB-COMPONENTS ====================

const GlassCard = memo(({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.glassCard, style]}>
    <View style={styles.glassBorder} />
    <View style={styles.glassContent}>{children}</View>
  </View>
));

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: string;
  color: string;
  percentile?: number;
  status?: { label: string; color: string; icon: string };
  onPress?: () => void;
}

const MetricCard = memo<MetricCardProps>(({ title, value, unit, change, changeType, icon, color, percentile, status, onPress }) => {
  const { themeColors, shouldReduceMotion } = useCustomization();
  const effectiveColor = color || themeColors.primary;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.metricCard}>
      <GlassCard>
        <View style={styles.metricHeader}>
          <View style={[styles.metricIconBg, { backgroundColor: `${effectiveColor}20` }]}>
            <Text style={styles.metricIcon}>{icon}</Text>
          </View>
          {percentile !== undefined && (
            <View style={[styles.percentileBadge, { backgroundColor: `${effectiveColor}20` }]}>
              <Text style={[styles.percentileText, { color: effectiveColor }]}>{percentile}th</Text>
            </View>
          )}
        </View>
        <View style={styles.metricBody}>
          <Text style={styles.metricValue}>
            {value}
            <Text style={[styles.metricUnit, { color: effectiveColor }]}>{unit}</Text>
          </Text>
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
        <View style={styles.metricFooter}>
          {change && (
            <Text style={[styles.metricChange, changeType === 'positive' ? styles.changePositive : styles.changeNegative]}>
              {change}
            </Text>
          )}
          {status && (
            <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          )}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
});

interface PhotoTimelineProps {
  photos: PhotoCorrelation[];
  measurements: GrowthMeasurement[];
  onPhotoPress: (photo: PhotoCorrelation) => void;
  onAddPhoto: () => void;
  babyBirthDate: string;
  currentUserId: string;
}

const PhotoTimeline = memo<PhotoTimelineProps>(({ photos, measurements, onPhotoPress, onAddPhoto, babyBirthDate, currentUserId }) => {
  const { themeColors, shouldReduceMotion } = useCustomization();
  const userPhotos = photos.filter(p => p.userId === currentUserId);

  return (
    <View style={styles.photoTimelineContainer}>
      <View style={styles.photoTimelineHeader}>
        <Text style={styles.photoTimelineTitle}>📸 Photo Timeline</Text>
        <TouchableOpacity onPress={onAddPhoto} style={styles.addPhotoChip}>
          <Ionicons name="add" size={16} color={themeColors.primary} />
          <Text style={[styles.addPhotoChipText, { color: themeColors.primary }]}>Add</Text>
        </TouchableOpacity>
      </View>
      <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScroll}>
        <TouchableOpacity onPress={onAddPhoto} style={styles.addPhotoButton}>
          <LinearGradient colors={themeColors.gradientColors || ['#667eea', '#764ba2']} style={styles.addPhotoButtonGradient}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.addPhotoText}>Add Photo</Text>
          </LinearGradient>
        </TouchableOpacity>
        {userPhotos.map((photo) => (
          <BlurredPhotoItem
            key={photo.id}
            photo={photo}
            onPress={() => onPhotoPress(photo)}
            onLongPress={() => {}}
          />
        ))}
        {userPhotos.length === 0 && (
          <View style={styles.emptyPhotoContainer}>
            <LinearGradient colors={themeColors.gradientColors || ['#667eea', '#764ba2']} style={styles.emptyPhotoGradient}>
              <Ionicons name="images" size={32} color="#fff" />
              <Text style={styles.emptyPhotoText}>No photos yet</Text>
              <Text style={styles.emptyPhotoSubtext}>Add photos to track memories</Text>
            </LinearGradient>
          </View>
        )}
      </AutoHideScrollView>
    </View>
  );
});

interface SiblingComparisonChartProps {
  comparisons: SiblingComparison[];
  metric: MetricType;
}

const SiblingComparisonChart = memo<SiblingComparisonChartProps>(({ comparisons, metric }) => {
  const { themeColors } = useCustomization();
  return (
    <View style={styles.comparisonContainer}>
      <View style={styles.comparisonHeader}>
        <Text style={styles.comparisonTitle}>Sibling Comparison</Text>
        <View style={styles.comparisonLegend}>
          {comparisons.map((comp) => (
            <View key={comp.babyId} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: comp.color }]} />
              <Text style={styles.legendText}>{comp.name}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.comparisonChart, { backgroundColor: `${themeColors.primary}10` }]}>
        <Text style={{ textAlign: 'center', color: '#64748b', paddingTop: 80 }}>Comparison chart visualization</Text>
      </View>
      <View style={styles.comparisonStats}>
        {comparisons.map((comp) => (
          <View key={comp.babyId} style={styles.comparisonStat}>
            <Text style={[styles.comparisonStatName, { color: comp.color }]}>{comp.name}</Text>
            <Text style={styles.comparisonStatValue}>
              {comp.percentileDiff > 0 ? '+' : ''}{comp.percentileDiff}% percentile
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

interface VaccinationTrackerProps {
  vaccinations: VaccinationDose[];
  birthDate: string;
  onComplete: (id: string) => void;
}

const VaccinationTracker = memo<VaccinationTrackerProps>(({ vaccinations, birthDate, onComplete }) => {
  const { themeColors } = useCustomization();
  const upcoming = vaccinations.filter(v => v.status !== 'completed').slice(0, 5);

  return (
    <View style={styles.vaccinationContainer}>
      <View style={styles.vaccinationHeader}>
        <Text style={styles.vaccinationTitle}>💉 Vaccinations</Text>
        <TouchableOpacity style={styles.vaccinationMenu}>
          <Text style={[styles.vaccinationMenuText, { color: themeColors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>
      {upcoming.map((vax) => {
        const birthDateObj = safeParseDate(birthDate);
        const dueDate = birthDateObj ? addDays(birthDateObj, parseInt(vax.dueDate)) : new Date();
        const isOverdue = vax.status === 'overdue';
        return (
          <View key={vax.id} style={styles.vaccineItem}>
            <View style={[styles.vaccineStatus, { backgroundColor: isOverdue ? '#ef4444' : vax.status === 'due' ? '#f59e0b' : '#10b981' }]} />
            <View style={styles.vaccineContent}>
              <Text style={styles.vaccineName}>{vax.vaccineName} (Dose {vax.doseNumber})</Text>
              <Text style={styles.vaccineDue}>Due: {safeFormatDate(dueDate, 'MMM d, yyyy')}</Text>
              {isOverdue && <Text style={styles.vaccineOverdue}>Overdue - schedule now</Text>}
            </View>
            {vax.status !== 'completed' ? (
              <TouchableOpacity onPress={() => onComplete(vax.id)} style={styles.vaccineCompleteBtn}>
                <Ionicons name="checkmark-circle-outline" size={24} color={themeColors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.vaccineCompleted}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
});

interface AddMeasurementModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Partial<GrowthMeasurement>) => void;
  type: MetricType;
  previousValue?: number;
}

const AddMeasurementModal = memo<AddMeasurementModalProps>(({ visible, onClose, onSave, type, previousValue }) => {
  const { themeColors, triggerHaptic } = useCustomization();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const unit = type === 'weight' ? 'kg' : type === 'height' || type === 'head' ? 'cm' : '';

  const handleSave = useCallback(() => {
    if (!value) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;
    
    onSave({
      type: type,
      value: numValue,
      unit: unit,
      date: new Date(date).toISOString(),
      notes: notes || undefined,
    });
    triggerHaptic('success');
    setValue('');
    setNotes('');
    onClose();
  }, [value, notes, date, type, unit, onSave, onClose, triggerHaptic]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add {type.charAt(0).toUpperCase() + type.slice(1)}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
          {previousValue !== undefined && (
            <View style={styles.decreaseWarning}>
              <Ionicons name="information-circle" size={20} color="#f59e0b" />
              <Text style={styles.decreaseWarningText}>Previous: {previousValue} {unit}</Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Value ({unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholder={`Enter ${type}`}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes..."
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Save Measurement</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

interface DoctorReportModalProps {
  visible: boolean;
  onClose: () => void;
  baby: BabyProfile;
  measurements: GrowthMeasurement[];
  milestones: Milestone[];
}

const DoctorReportModal = memo<DoctorReportModalProps>(({ visible, onClose, baby, measurements, milestones }) => {
  const { themeColors } = useCustomization();
  const latestHeight = measurements.filter(m => m.type === 'height').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const latestWeight = measurements.filter(m => m.type === 'weight').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.reportOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={styles.reportContent}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.reportHeader}>
            <View style={[styles.reportIconBg, { backgroundColor: `${themeColors.primary}20` }]}>
              <Ionicons name="medical" size={28} color={themeColors.primary} />
            </View>
            <Text style={styles.reportTitle}>Growth Report</Text>
            <TouchableOpacity onPress={onClose} style={styles.reportClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.reportBody}>
            <View style={styles.reportSection}>
              <Text style={styles.reportLabel}>Child</Text>
              <Text style={styles.reportValue}>{baby.name}</Text>
              <Text style={styles.reportSubvalue}>{safeFormatDate(baby.birthDate, 'MMM d, yyyy')} • {safeDifferenceInMonths(new Date(), baby.birthDate)} months old</Text>
            </View>
            {latestHeight && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Latest Height</Text>
                <Text style={styles.reportValue}>{latestHeight.value} {latestHeight.unit}</Text>
              </View>
            )}
            {latestWeight && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Latest Weight</Text>
                <Text style={styles.reportValue}>{latestWeight.value} {latestWeight.unit}</Text>
              </View>
            )}
            <View style={styles.reportSection}>
              <Text style={styles.reportLabel}>Milestones</Text>
              <Text style={styles.reportMilestoneCount}>{milestones.length} recorded</Text>
            </View>
            <TouchableOpacity style={styles.shareReportBtn}>
              <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.shareReportGradient}>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareReportText}>Share Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

interface PhotoViewerModalProps {
  visible: boolean;
  photo: PhotoCorrelation | null;
  onClose: () => void;
  onShare: (photo: PhotoCorrelation) => void;
  onDelete: (photo: PhotoCorrelation) => void;
}

const PhotoViewerModal = memo<PhotoViewerModalProps>(({ visible, photo, onClose, onShare, onDelete }) => {
  const { themeColors } = useCustomization();
  if (!photo) return null;

  const imageSource = isImageUri(photo.uri) ? { uri: photo.uri } : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.photoModalContainer}>
        <TouchableOpacity style={styles.photoModalClose} onPress={onClose}>
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.photoModalImageContainer}>
          {imageSource ? (
            <Image source={imageSource} style={styles.photoModalImage} resizeMode="contain" />
          ) : (
            <Ionicons name="image" size={64} color="#fff" />
          )}
        </View>
        <View style={styles.photoModalInfoPanel}>
          <BlurView intensity={90} tint="dark" style={styles.photoInfoBlur}>
            <View style={styles.photoInfoContent}>
              <View style={styles.photoInfoHeader}>
                <View style={styles.photoTypeBadge}>
                  <Ionicons name={photo.mediaType === 'video' ? 'videocam' : 'image'} size={14} color={themeColors.primary} />
                  <Text style={[styles.photoTypeText, { color: themeColors.primary }]}>{photo.mediaType === 'video' ? 'Video' : 'Photo'}</Text>
                </View>
                <Text style={styles.photoModalDate}>{safeFormatDate(photo.date, 'MMM d, yyyy')}</Text>
              </View>
              {photo.measurement && (
                <View style={styles.photoMeasurementInfo}>
                  <Text style={styles.photoMeasurementLabel}>Linked Measurement</Text>
                  <Text style={styles.photoMeasurementValue}>{photo.measurement.type}: {photo.measurement.value} {photo.measurement.unit}</Text>
                </View>
              )}
              <View style={styles.photoActionButtons}>
                <TouchableOpacity style={styles.photoActionButton} onPress={() => onShare(photo)}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                  <Text style={styles.photoActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionButton} onPress={() => onDelete(photo)}>
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  <Text style={[styles.photoActionText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
});

interface SweetAlertProps {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
  showConfirmButton?: boolean;
  confirmText?: string;
  onConfirm?: () => void;
}

const SweetAlert = memo<SweetAlertProps>(({
  visible,
  type,
  title,
  message,
  onClose,
  duration = 3000,
  showConfirmButton = false,
  confirmText = 'OK',
  onConfirm,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: { bg: '#10b981', icon: 'checkmark-circle' },
    error: { bg: '#ef4444', icon: 'close-circle' },
    warning: { bg: '#f59e0b', icon: 'warning' },
    info: { bg: '#3b82f6', icon: 'information-circle' },
  };

  const theme = colors[type];

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      if (!showConfirmButton) {
        const timer = setTimeout(() => {
          scale.value = withSpring(0);
          opacity.value = withSpring(0, {}, () => {
            runOnJS(onClose)();
          });
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
        <LinearGradient colors={[theme.bg, `${theme.bg}dd`]} style={styles.alertGradient}>
          <Ionicons name={theme.icon as any} size={64} color="#fff" />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          {showConfirmButton ? (
            <TouchableOpacity
              style={styles.alertConfirmBtn}
              onPress={() => {
                scale.value = withSpring(0);
                opacity.value = withSpring(0, {}, () => {
                  runOnJS(onConfirm || onClose)();
                });
              }}
            >
              <Text style={styles.alertConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
              <Text style={styles.alertDismissText}>Tap to dismiss</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    </View>
  );
});

interface FolderSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectFolder: (folder: PhotoFolder) => void;
}

const FolderSelectionModal = memo<FolderSelectionModalProps>(({ visible, onClose, onSelectFolder }) => {
  const [folders, setFolders] = useState<PhotoFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const albums = await MediaLibrary.getAlbumsAsync();
      const folderData: PhotoFolder[] = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({
            album: album.id,
            mediaType: ['photo', 'video'],
            first: 1,
          });
          return {
            id: album.id,
            title: album.title,
            assetCount: album.assetCount,
            thumbnailUri: assets.assets[0]?.uri,
          };
        })
      );
      const allPhotos = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        first: 1,
      });
      const allFolder: PhotoFolder = {
        id: 'all',
        title: 'All Photos',
        assetCount: allPhotos.totalCount,
        thumbnailUri: allPhotos.assets[0]?.uri,
      };
      setFolders([allFolder, ...folderData.filter(f => f.assetCount > 0)]);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.folderModalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={styles.folderModalContent}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.folderModalHeader}>
            <Text style={styles.folderModalTitle}>Select Folder</Text>
            <TouchableOpacity onPress={onClose} style={styles.folderModalClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.folderModalSubtitle}>
            Choose which folder to import photos from. Explicit content will be automatically blurred.
          </Text>
          {loading ? (
            <ActivityIndicator size="large" color="#667eea" style={styles.folderLoader} />
          ) : (
            <AutoHideFlatList
              data={folders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.folderItem} onPress={() => onSelectFolder(item)}>
                  <View style={styles.folderThumbnailContainer}>
                    {item.thumbnailUri ? (
                      <>
                        <Image source={{ uri: item.thumbnailUri }} style={styles.folderThumbnail} resizeMode="cover" />
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                      </>
                    ) : (
                      <View style={styles.folderIconBg}>
                        <Ionicons name="folder" size={32} color="#667eea" />
                      </View>
                    )}
                  </View>
                  <View style={styles.folderInfo}>
                    <Text style={styles.folderName}>{item.title}</Text>
                    <Text style={styles.folderCount}>{item.assetCount} items</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.folderList}
              getItemLayout={(data, index) => ({ length: 88, offset: 88 * index, index })}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
});

interface BlurredPhotoItemProps {
  photo: PhotoCorrelation;
  onPress: () => void;
  onLongPress?: () => void;
  isExplicit?: boolean;
}

const BlurredPhotoItem = memo<BlurredPhotoItemProps>(({ photo, onPress, onLongPress, isExplicit = false }) => {
  const [isBlurred, setIsBlurred] = useState(isExplicit);
  const { themeColors } = useCustomization();

  const imageSource = useMemo(() => {
    if (photo.uri.startsWith('file://') || photo.uri.startsWith('http')) {
      return { uri: photo.uri };
    }
    if (photo.uri.startsWith('ph://') || photo.uri.startsWith('assets-library://')) {
      return { uri: photo.uri };
    }
    return { uri: photo.uri };
  }, [photo.uri]);

  return (
    <TouchableOpacity
      onPress={() => {
        if (isBlurred) {
          setIsBlurred(false);
        } else {
          onPress();
        }
      }}
      onLongPress={onLongPress}
      style={styles.blurredPhotoItem}
      activeOpacity={0.9}
    >
      <Image source={imageSource} style={styles.blurredPhotoImage} resizeMode="cover" />
      {isBlurred && (
        <BlurView intensity={95} style={styles.explicitBlur} tint="dark">
          <Ionicons name="eye-off" size={32} color="#fff" />
          <Text style={styles.explicitText}>Potentially Sensitive</Text>
          <Text style={styles.explicitSubtext}>Tap to reveal</Text>
        </BlurView>
      )}
      {photo.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Ionicons name="play-circle" size={28} color="#fff" />
          {photo.duration && (
            <Text style={styles.videoDuration}>
              {Math.floor(photo.duration / 60)}:{(photo.duration % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>
      )}
      {photo.measurement && (
        <View style={[
          styles.correlationBadge,
          {
            backgroundColor: photo.measurement.type === 'height' ? '#667eea' :
              photo.measurement.type === 'weight' ? '#fa709a' :
                photo.measurement.type === 'head' ? '#11998e' : '#f59e0b'
          }
        ]} />
      )}
    </TouchableOpacity>
  );
});

// ==================== MAIN SCREEN ====================

export default function GrowthDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    currentBaby,
    growthData,
    milestones,
    addGrowthMeasurement,
    babies,
    switchBaby,
    getGrowthData
  } = useBaby();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const { pickImage, takePhoto } = useMedia();
  const { themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const [activeMetric, setActiveMetric] = useState<MetricType>('height');
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoCorrelation | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationDose[]>(VACCINATION_SCHEDULE);
  const [devicePhotos, setDevicePhotos] = useState<PhotoCorrelation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (isMounted) {
        setHasMediaPermission(status === 'granted');
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const loadDevicePhotosFromFolder = useCallback(async (folder: PhotoFolder) => {
    try {
      let assets;
      if (folder.id === 'all') {
        assets = await MediaLibrary.getAssetsAsync({
          mediaType: ['photo', 'video'],
          sortBy: MediaLibrary.SortBy.creationTime,
          first: 50,
        });
      } else {
        assets = await MediaLibrary.getAssetsAsync({
          album: folder.id,
          mediaType: ['photo', 'video'],
          sortBy: MediaLibrary.SortBy.creationTime,
          first: 50,
        });
      }
      const currentUserId = userProfile?.id || 'unknown';
      const formattedPhotos: PhotoCorrelation[] = assets.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        date: asset.creationTime ? new Date(asset.creationTime).toISOString() : new Date().toISOString(),
        age: '',
        source: 'device',
        assetId: asset.id,
        mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
        duration: asset.duration,
        folderName: folder.title,
        userId: currentUserId,
        isPrivate: false,
      }));
      setDevicePhotos(prev => [...prev, ...formattedPhotos]);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Photos Added!',
        message: `${formattedPhotos.length} photos imported from ${folder.title}`,
      });
    } catch (error) {
      console.error('Error loading device photos:', error);
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to load photos from folder',
      });
    }
  }, [userProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    InteractionManager.runAfterInteractions(() => {
      setRefreshing(false);
    });
  }, []);

  const allPhotos = useMemo(() => {
    const currentUserId = userProfile?.id || 'unknown';
    const appPhotos: PhotoCorrelation[] = [
      {
        id: 'mock1',
        uri: 'https://picsum.photos/200/200?random=1',
        date: subMonths(new Date(), 1).toISOString(),
        age: '5m',
        source: 'app',
        userId: currentUserId,
        isPrivate: false,
      },
      {
        id: 'mock2',
        uri: 'https://picsum.photos/200/200?random=2',
        date: subMonths(new Date(), 2).toISOString(),
        age: '4m',
        source: 'app',
        userId: currentUserId,
        isPrivate: false,
      },
    ];
    const userDevicePhotos = devicePhotos.filter(p => p.userId === currentUserId);
    return [...appPhotos, ...userDevicePhotos];
  }, [devicePhotos, userProfile]);

  const ageMonths = useMemo(() => {
    if (!currentBaby) return 0;
    return safeDifferenceInMonths(new Date(), currentBaby.birthDate);
  }, [currentBaby]);

  const processedData = useMemo(() => {
    if (!currentBaby) return null;
    const ranges: Record<TimeRange, number> = {
      '3m': 90, '6m': 180, '1y': 365, '2y': 730, '5y': 1825, 'all': 3650,
    };
    const cutoff = subMonths(new Date(), ranges[timeRange] / 30);
    let filtered = growthData
      .filter(g => {
        const gDate = safeParseDate(g.date);
        if (!gDate) return false;
        return gDate >= cutoff && (activeMetric === 'bmi' ? true : g.type === activeMetric);
      })
      .sort((a, b) => {
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
    if (activeMetric === 'bmi') {
      const heightData = getGrowthData('height');
      const weightData = getGrowthData('weight');
      if (heightData.length === 0 || weightData.length === 0) {
        filtered = [];
      } else {
        filtered = weightData.map(w => {
          const wDate = safeParseDate(w.date);
          if (!wDate) return null;
          const closestHeight = heightData.reduce((prev, curr) => {
            const prevDate = safeParseDate(prev?.date);
            const currDate = safeParseDate(curr?.date);
            if (!prevDate || !currDate) return curr;
            const prevDiff = Math.abs(safeDifferenceInDays(prevDate, wDate));
            const currDiff = Math.abs(safeDifferenceInDays(currDate, wDate));
            return prevDiff < currDiff ? prev : curr;
          }, heightData[0]);
          if (closestHeight) {
            const heightM = closestHeight.value / 100;
            const bmi = w.value / (heightM * heightM);
            return { ...w, value: parseFloat(bmi.toFixed(1)), type: 'bmi' as const };
          }
          return null;
        }).filter((item): item is GrowthMeasurement => item !== null);
      }
    }
    const chartData = filtered.map((g, index) => ({
      value: Number(g.value) || 0,
      label: safeFormatDate(g.date, 'MMM d'),
      dataPointText: String(g.value),
      index,
    }));
    return { data: chartData, rawData: filtered };
  }, [growthData, activeMetric, timeRange, currentBaby, getGrowthData]);

  const aiInsights = useMemo(() => {
    if (!currentBaby) return [];
    const typeData = getGrowthData(activeMetric);
    return analyzeGrowthTrend(typeData, activeMetric);
  }, [growthData, activeMetric, currentBaby, getGrowthData]);

  const siblingComparisons = useMemo((): SiblingComparison[] => {
    if (!currentBaby || babies.length < 2) return [];
    return babies
      .filter(b => b.id !== currentBaby.id)
      .map((baby, index) => {
        const babyGrowth = getGrowthData(activeMetric).filter(g => g.babyId === baby.id);
        const currentBabyGrowth = getGrowthData(activeMetric).filter(g => g.babyId === currentBaby.id);
        const avgPercentile = babyGrowth.reduce((sum, g) => {
          const age = safeDifferenceInMonths(g.date, baby.birthDate);
          return sum + calculatePercentile(g.value, age, activeMetric, baby.gender as 'boy' | 'girl');
        }, 0) / (babyGrowth.length || 1);
        const currentAvg = currentBabyGrowth.reduce((sum, g) => {
          const age = safeDifferenceInMonths(g.date, currentBaby.birthDate);
          return sum + calculatePercentile(g.value, age, activeMetric, currentBaby.gender as 'boy' | 'girl');
        }, 0) / (currentBabyGrowth.length || 1);
        return {
          babyId: baby.id,
          name: baby.name,
          color: ['#fa709a', '#11998e', '#f59e0b', '#8b5cf6'][index % 4],
          data: babyGrowth.map(g => ({ date: g.date, value: g.value })),
          percentileDiff: Math.round(avgPercentile - currentAvg),
        };
      });
  }, [babies, currentBaby, activeMetric, getGrowthData]);

  const insights = useMemo((): GrowthInsight[] => {
    if (!currentBaby) return [];
    const items: GrowthInsight[] = [];
    const recentMilestone = [...milestones].sort((a, b) => {
      const dateA = safeParseDate(a.achievedAt);
      const dateB = safeParseDate(b.achievedAt);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    })[0];
    if (recentMilestone) {
      items.push({
        id: '1',
        type: 'milestone',
        title: 'New Milestone! 🌟',
        description: `${currentBaby.name} achieved "${recentMilestone.title}"`,
        icon: '🌟',
        color: '#f59e0b',
        date: recentMilestone.achievedAt || new Date().toISOString(),
        priority: 'high',
      });
    }
    items.push(...aiInsights);
    const upcomingVax = vaccinations.find(v => v.status === 'due' || v.status === 'overdue');
    if (upcomingVax) {
      items.push({
        id: 'vax',
        type: 'vaccination',
        title: upcomingVax.status === 'overdue' ? 'Vaccination Overdue!' : 'Vaccination Due',
        description: `${upcomingVax.vaccineName} (Dose ${upcomingVax.doseNumber}) is ${upcomingVax.status}`,
        icon: '💉',
        color: upcomingVax.status === 'overdue' ? '#ef4444' : '#f59e0b',
        date: new Date().toISOString(),
        priority: 'high',
      });
    }
    return items.slice(0, 6);
  }, [milestones, currentBaby, vaccinations, aiInsights]);

  const stats = useMemo(() => {
    if (!currentBaby) return null;
    const types: MetricType[] = ['height', 'weight', 'head'];
    const result: Record<string, any> = {};
    types.forEach(type => {
      const data = getGrowthData(type);
      const latest = data[data.length - 1];
      const previous = data[data.length - 2];
      if (latest) {
        const ageAtMeasurement = safeDifferenceInMonths(latest.date, currentBaby.birthDate);
        const percentile = calculatePercentile(latest.value, ageAtMeasurement, type, currentBaby.gender as 'boy' | 'girl');
        const status = getGrowthStatus(percentile);
        result[type] = {
          value: latest.value.toFixed(1),
          unit: latest.unit,
          change: previous ? `+${(latest.value - previous.value).toFixed(1)}` : undefined,
          percentile,
          status,
        };
      }
    });
    return result;
  }, [growthData, currentBaby, getGrowthData]);

  const handleAddMeasurement = useCallback(async (data: Partial<GrowthMeasurement>) => {
    if (!currentBaby) return;
    const success = await addGrowthMeasurement({
      babyId: currentBaby.id,
      type: data.type as MetricType,
      value: data.value ?? 0,
      unit: data.unit || 'cm',
      date: data.date || new Date().toISOString(),
      notes: data.notes,
      recordedBy: userProfile?.fullName?.split(' ')[0] || 'Parent',
    });
    if (success) {
      triggerHaptic('success');
      setAlert({
        visible: true,
        type: 'success',
        title: 'Measurement Saved!',
        message: `${data.type} recorded: ${data.value} ${data.unit}`,
      });
    } else {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to save measurement. Please try again.',
      });
    }
  }, [currentBaby, addGrowthMeasurement, userProfile, triggerHaptic]);

  const handleCompleteVaccination = useCallback((id: string) => {
    setVaccinations(prev => prev.map(v =>
      v.id === id ? { ...v, status: 'completed', completedDate: new Date().toISOString() } : v
    ));
    triggerHaptic('success');
    setAlert({
      visible: true,
      type: 'success',
      title: 'Vaccination Recorded!',
      message: 'Keep up with the schedule!',
    });
  }, [triggerHaptic]);

  const handleExportPDF = useCallback(() => {
    Alert.alert(
      'Export Report',
      'Choose format:',
      [
        {
          text: 'PDF Report', onPress: () => {
            setAlert({
              visible: true,
              type: 'info',
              title: 'Coming Soon',
              message: 'PDF export will be available in the next update!',
            });
          }
        },
        {
          text: 'CSV Data', onPress: () => {
            setAlert({
              visible: true,
              type: 'info',
              title: 'Coming Soon',
              message: 'CSV export will be available in the next update!',
            });
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleAddPhoto = useCallback(async () => {
    Alert.alert(
      'Add Photo',
      'Choose source:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) {
              const currentUserId = userProfile?.id || 'unknown';
              const newPhoto: PhotoCorrelation = {
                id: `photo_${Date.now()}`,
                uri,
                date: new Date().toISOString(),
                age: `${ageMonths}m`,
                source: 'app',
                userId: currentUserId,
                isPrivate: false,
              };
              setDevicePhotos(prev => [newPhoto, ...prev]);
              triggerHaptic('success');
              setAlert({
                visible: true,
                type: 'success',
                title: 'Photo Captured!',
                message: 'Photo added to your private gallery',
              });
            }
          }
        },
        {
          text: 'From Gallery',
          onPress: async () => {
            if (hasMediaPermission) {
              setShowFolderModal(true);
            } else {
              setAlert({
                visible: true,
                type: 'warning',
                title: 'Permission Required',
                message: 'Please allow access to photos in settings',
              });
            }
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [takePhoto, hasMediaPermission, ageMonths, userProfile, triggerHaptic]);

  const handleSharePhoto = useCallback(async (photo: PhotoCorrelation) => {
    try {
      await Share.share({
        url: photo.uri,
        message: `Check out this photo of ${currentBaby?.name}!`,
      });
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to share photo',
      });
    }
  }, [currentBaby]);

  const handleDeletePhoto = useCallback((photo: PhotoCorrelation) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDevicePhotos(prev => prev.filter(p => p.id !== photo.id));
            setSelectedPhoto(null);
            triggerHaptic('success');
            setAlert({
              visible: true,
              type: 'success',
              title: 'Photo Deleted',
              message: 'Photo has been removed',
            });
          }
        },
      ]
    );
  }, [triggerHaptic]);

  const handlePhotoPress = useCallback((photo: PhotoCorrelation) => {
    setSelectedPhoto(photo);
  }, []);

  const getPreviousMeasurement = useCallback(() => {
    const data = getGrowthData(activeMetric);
    return data[data.length - 1]?.value;
  }, [activeMetric, getGrowthData]);

  if (!currentBaby) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.noDataText}>No baby profile selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <LinearGradient colors={['#f8fafc', '#e0e7ff', '#ddd6fe']} style={StyleSheet.absoluteFill} />

      {/* SweetAlert */}
      <SweetAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <BlurView intensity={BLUR_INTENSITY} style={StyleSheet.absoluteFill} />
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{currentBaby.name}'s Growth</Text>
            <Text style={styles.headerSubtitle}>{ageMonths} months old • AI Powered</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.headerButton}>
              <BlurView intensity={BLUR_INTENSITY} style={StyleSheet.absoluteFill} />
              <Ionicons name="medical-outline" size={22} color="#1e293b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.headerButton, styles.addButton]}>
              <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={StyleSheet.absoluteFill} />
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Baby Switcher */}
        {babies.length > 1 && (
          <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.babySwitcher}>
            {babies.map((baby) => (
              <TouchableOpacity
                key={baby.id}
                onPress={() => switchBaby(baby.id)}
                style={[styles.babyChip, currentBaby.id === baby.id && styles.babyChipActive]}
              >
                <SafeAvatar
                  avatar={baby.avatar}
                  size={28}
                  fallbackIcon="person"
                  themeId={themeColors.primary === '#667eea' ? 'purple' : undefined}
                  animated={!shouldReduceMotion}
                />
                <Text style={[styles.babyChipName, currentBaby.id === baby.id && styles.babyChipNameActive]}>
                  {baby.name}
                </Text>
              </TouchableOpacity>
            ))}
          </AutoHideScrollView>
        )}
      </Animated.View>

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + (babies.length > 1 ? 160 : 120) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <MetricCard
            title="Height"
            value={stats?.height?.value || '--'}
            unit={stats?.height?.unit || 'cm'}
            change={stats?.height?.change}
            changeType="positive"
            icon="📏"
            color={themeColors.primary}
            percentile={stats?.height?.percentile}
            status={stats?.height?.status}
            onPress={() => setActiveMetric('height')}
          />
          <MetricCard
            title="Weight"
            value={stats?.weight?.value || '--'}
            unit={stats?.weight?.unit || 'kg'}
            change={stats?.weight?.change}
            changeType="positive"
            icon="⚖️"
            color={themeColors.accent || '#fa709a'}
            percentile={stats?.weight?.percentile}
            status={stats?.weight?.status}
            onPress={() => setActiveMetric('weight')}
          />
          <MetricCard
            title="Head"
            value={stats?.head?.value || '--'}
            unit={stats?.head?.unit || 'cm'}
            icon="🧠"
            color="#11998e"
            percentile={stats?.head?.percentile}
            status={stats?.head?.status}
            onPress={() => setActiveMetric('head')}
          />
          <MetricCard
            title="BMI"
            value={stats?.weight?.value && stats?.height?.value ?
              (parseFloat(stats.weight.value) / Math.pow(parseFloat(stats.height.value) / 100, 2)).toFixed(1)
              : '--'}
            unit=""
            icon="📊"
            color="#f59e0b"
            onPress={() => setActiveMetric('bmi')}
          />
        </View>

        {/* Photo Timeline */}
        <PhotoTimeline
          photos={allPhotos}
          measurements={growthData}
          onPhotoPress={handlePhotoPress}
          onAddPhoto={handleAddPhoto}
          babyBirthDate={currentBaby.birthDate}
          currentUserId={userProfile?.id || 'unknown'}
        />

        {/* Chart Controls */}
        <GlassCard style={styles.controlsCard}>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Metric</Text>
            <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['height', 'weight', 'head', 'bmi'] as MetricType[]).map((metric) => (
                <TouchableOpacity
                  key={metric}
                  onPress={() => setActiveMetric(metric)}
                  style={[styles.controlChip, activeMetric === metric && styles.controlChipActive, { backgroundColor: activeMetric === metric ? themeColors.primary : 'rgba(100,116,139,0.08)' }]}
                >
                  <Text style={[styles.controlChipText, activeMetric === metric && styles.controlChipTextActive]}>
                    {metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </AutoHideScrollView>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Time Range</Text>
            <View style={styles.timeRangeContainer}>
              {(['3m', '6m', '1y', '2y', 'all'] as TimeRange[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => setTimeRange(range)}
                                    style={[styles.timeChip, timeRange === range && styles.timeChipActive, { backgroundColor: timeRange === range ? themeColors.primary : 'rgba(100,116,139,0.08)' }]}
                >
                  <Text style={[styles.timeChipText, timeRange === range && styles.timeChipTextActive]}>
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Main Chart */}
        <GlassCard style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Over Time</Text>
              <Text style={styles.chartSubtitle}>{processedData?.rawData.length || 0} measurements • AI-analyzed</Text>
            </View>
          </View>
          
          {processedData && processedData.data.length > 0 ? (
            <LineChart
              data={processedData.data}
              width={SCREEN_WIDTH - 80}
              height={220}
              spacing={30}
              color={themeColors.primary}
              thickness={3}
              hideDataPoints={false}
              dataPointsColor={themeColors.primary}
              dataPointsRadius={4}
              textColor="#64748b"
              xAxisColor="#e2e8f0"
              yAxisColor="#e2e8f0"
              yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
              hideRules={false}
              rulesColor="#f1f5f9"
              rulesType="solid"
              curved
              areaChart
              startFillColor={themeColors.primary}
              endFillColor={themeColors.primary}
              startOpacity={0.3}
              endOpacity={0.05}
              showVerticalLines
              verticalLinesColor="#f1f5f9"
              noOfSections={5}
              isAnimated={false}
              animateOnDataChange={false}
              animationDuration={0}
            />
          ) : (
            <View style={styles.emptyChart}>
              <MaterialCommunityIcons name="chart-line" size={48} color="#cbd5e1" />
              <Text style={styles.emptyChartText}>No data available</Text>
              <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addDataButton, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.addDataButtonText}>Add First Measurement</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {/* AI Insights Section */}
        {aiInsights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🤖 AI Insights</Text>
              <View style={[styles.aiBadge, { backgroundColor: `${themeColors.primary}15` }]}>
                <Text style={[styles.aiBadgeText, { color: themeColors.primary }]}>Smart Analysis</Text>
              </View>
            </View>
            
            {aiInsights.map((insight, index) => (
              <Animated.View key={insight.id} entering={FadeInUp.delay(index * 100).springify()}>
                <GlassCard style={[styles.insightCard, insight.priority === 'high' && styles.insightCardHigh]}>
                  <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}15` }]}>
                    <Text style={styles.insightIcon}>{insight.icon}</Text>
                  </View>
                  <View style={styles.insightContent}>
                    <View style={styles.insightHeader}>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Text style={styles.insightDate}>{safeFormatDate(insight.date, 'MMM d')}</Text>
                    </View>
                    <Text style={styles.insightDescription}>{insight.description}</Text>
                    {insight.action && (
                      <Text style={[styles.insightAction, { color: themeColors.primary }]}>💡 {insight.action}</Text>
                    )}
                  </View>
                  <View style={[styles.insightTypeIndicator, { backgroundColor: insight.color }]} />
                </GlassCard>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Sibling Comparison */}
        {siblingComparisons.length > 0 && (
          <GlassCard style={styles.comparisonCard}>
            <SiblingComparisonChart comparisons={siblingComparisons} metric={activeMetric} />
          </GlassCard>
        )}

        {/* Vaccination Tracker */}
        <GlassCard style={styles.vaccinationCard}>
          <VaccinationTracker 
            vaccinations={vaccinations} 
            birthDate={currentBaby.birthDate}
            onComplete={handleCompleteVaccination}
          />
        </GlassCard>

        {/* All Insights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Insights</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: themeColors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {insights.filter(i => !aiInsights.find(ai => ai.id === i.id)).map((insight, index) => (
            <Animated.View key={insight.id} entering={FadeInUp.delay(index * 100).springify()}>
              <GlassCard style={[styles.insightCard, insight.priority === 'high' && styles.insightCardHigh]}>
                <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}15` }]}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                </View>
                <View style={styles.insightContent}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightDate}>{safeFormatDate(insight.date, 'MMM d')}</Text>
                  </View>
                  <Text style={styles.insightDescription}>{insight.description}</Text>
                </View>
                <View style={[styles.insightTypeIndicator, { backgroundColor: insight.color }]} />
              </GlassCard>
            </Animated.View>
          ))}
        </View>

        {/* Recent Measurements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Measurements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('GrowthHistory')}>
              <Text style={[styles.seeAll, { color: themeColors.primary }]}>History</Text>
            </TouchableOpacity>
          </View>

          <GlassCard style={styles.historyCard}>
            {growthData
              .sort((a, b) => {
                const dateA = safeParseDate(a.date);
                const dateB = safeParseDate(b.date);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 5)
              .map((measurement, index, arr) => (
                <View key={measurement.id} style={[styles.historyItem, index < arr.length - 1 && styles.historyItemBorder]}>
                  <View style={styles.historyIconBg}>
                    <Text>
                      {measurement.type === 'height' ? '📏' : 
                       measurement.type === 'weight' ? '⚖️' : 
                       measurement.type === 'head' ? '🧠' : '🌡️'}
                    </Text>
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyType}>
                      {measurement.type.charAt(0).toUpperCase() + measurement.type.slice(1)}
                    </Text>
                    <Text style={styles.historyDate}>{safeFormatDate(measurement.date, 'MMM d, yyyy')}</Text>
                  </View>
                  <View style={styles.historyValue}>
                    <Text style={[styles.historyValueText, { color: themeColors.primary }]}>{measurement.value} {measurement.unit}</Text>
                    {measurement.notes && <Ionicons name="document-text" size={14} color="#94a3b8" />}
                  </View>
                </View>
              ))}
            
            {growthData.length === 0 && (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No measurements yet</Text>
              </View>
            )}
          </GlassCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Timeline', { filter: 'milestone' })} style={styles.quickAction}>
            <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.quickActionGradient}>
              <Text style={styles.quickActionIcon}>🌟</Text>
              <Text style={styles.quickActionText}>Milestones</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Gallery')} style={styles.quickAction}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.quickActionGradient}>
              <Text style={styles.quickActionIcon}>📸</Text>
              <Text style={styles.quickActionText}>Photos</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleExportPDF} style={styles.quickAction}>
            <LinearGradient colors={['#10b981', '#34d399']} style={styles.quickActionGradient}>
              <Text style={styles.quickActionIcon}>📤</Text>
              <Text style={styles.quickActionText}>Export</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </AnimatedScrollView>

      {/* Modals */}
      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddMeasurement}
        type={activeMetric}
        previousValue={getPreviousMeasurement()}
      />

      <DoctorReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        baby={currentBaby}
        measurements={growthData}
        milestones={milestones}
      />

      <PhotoViewerModal
        visible={selectedPhoto !== null}
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onShare={handleSharePhoto}
        onDelete={handleDeletePhoto}
      />

      <FolderSelectionModal
        visible={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onSelectFolder={(folder) => {
          loadDevicePhotosFromFolder(folder);
          setShowFolderModal(false);
        }}
      />
    </View>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  noDataText: { fontSize: 16, color: '#64748b' },

  // GlassCard styles
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: { flex: 1 },

  // Alert styles
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 28,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertConfirmBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  alertConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  alertDismiss: {
    marginTop: 8,
  },
  alertDismissText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // Folder modal styles
  folderModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  folderModalContent: {
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  folderModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  folderModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  folderModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 24,
    marginBottom: 16,
    lineHeight: 20,
  },
  folderLoader: {
    marginTop: 40,
  },
  folderList: {
    padding: 20,
    gap: 12,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  folderThumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  folderThumbnail: {
    width: '100%',
    height: '100%',
  },
  folderIconBg: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  folderCount: {
    fontSize: 13,
    color: '#64748b',
  },

  // Blurred photo styles
  blurredPhotoItem: {
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  blurredPhotoImage: {
    width: '100%',
    height: '100%',
  },
  explicitBlur: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  explicitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  explicitSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  correlationBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: { marginLeft: 8 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },

  babySwitcher: {
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 10,
  },
  babyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 6,
  },
  babyChipActive: { backgroundColor: '#667eea' },
  babyChipName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  babyChipNameActive: { color: '#fff' },

  scrollContent: { paddingHorizontal: 20 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: { fontSize: 20 },
  percentileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentileText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricBody: { gap: 4 },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -1,
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  metricTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  changePositive: { color: '#10b981' },
  changeNegative: { color: '#ef4444' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Photo timeline
  photoTimelineContainer: {
    marginBottom: 20,
  },
  photoTimelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoTimelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginLeft: 4,
  },
  addPhotoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  addPhotoChipText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  photoScroll: {
    gap: 12,
    paddingRight: 20,
  },
  addPhotoButton: {
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addPhotoButtonGradient: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPhotoText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPhotoContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyPhotoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPhotoText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyPhotoSubtext: {
    color: '#94a3b8',
    fontSize: 13,
  },

  // Controls
  controlsCard: {
    padding: 20,
    marginBottom: 20,
  },
  controlRow: { marginBottom: 16 },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  controlChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    marginRight: 8,
  },
  controlChipActive: { backgroundColor: '#667eea' },
  controlChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  controlChipTextActive: { color: '#fff' },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    alignItems: 'center',
  },
  timeChipActive: { backgroundColor: '#667eea' },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  timeChipTextActive: { color: '#fff' },

  // Chart
  chartCard: {
    padding: 20,
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  emptyChart: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyChartText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  addDataButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addDataButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Comparison
  comparisonCard: {
    padding: 20,
    marginBottom: 20,
  },
  comparisonContainer: { gap: 12 },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  comparisonLegend: { flexDirection: 'row', gap: 12 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  comparisonChart: {
    height: 180,
    borderRadius: 16,
  },
  comparisonStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  comparisonStat: { alignItems: 'center' },
  comparisonStatName: {
    fontSize: 14,
    fontWeight: '700',
  },
  comparisonStatValue: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Vaccination
  vaccinationCard: {
    padding: 20,
    marginBottom: 20,
  },
  vaccinationContainer: { gap: 12 },
  vaccinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vaccinationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  vaccinationMenu: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  vaccinationMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  vaccineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  vaccineStatus: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  vaccineContent: { flex: 1 },
  vaccineName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  vaccineDue: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  vaccineOverdue: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 2,
  },
  vaccineCompleteBtn: { padding: 4 },
  vaccineCompleted: { padding: 4 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Insights
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
  },
  insightCardHigh: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  insightIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  insightIcon: { fontSize: 24 },
  insightContent: { flex: 1 },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  insightDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  insightDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  insightTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginLeft: 12,
  },
  aiBadge: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 11,
    color: '#8b5cf6',
    fontWeight: '700',
  },
  insightAction: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 6,
    fontWeight: '600',
  },

  // History
  historyCard: { padding: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  historyIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyContent: { flex: 1 },
  historyType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  historyDate: { fontSize: 13, color: '#94a3b8' },
  historyValue: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  historyValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#667eea',
  },
  emptyHistory: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryText: { fontSize: 14, color: '#94a3b8' },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  quickActionGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: { fontSize: 24 },
  quickActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  decreaseWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  decreaseWarningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Report modal
  reportOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  reportIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reportTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  reportClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBody: { maxHeight: SCREEN_HEIGHT * 0.6 },
  reportSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.1)',
  },
  reportLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reportValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  reportSubvalue: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  reportMilestoneCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  shareReportBtn: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareReportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  shareReportText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Photo viewer modal
  photoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 100,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
  },
  photoModalInfoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  photoInfoBlur: {
    padding: 24,
    paddingBottom: 40,
  },
  photoInfoContent: {
    gap: 16,
  },
  photoInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  photoTypeText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  photoModalDate: {
    fontSize: 14,
    color: '#64748b',
  },
  photoMeasurementInfo: {
    backgroundColor: 'rgba(100,116,139,0.08)',
    padding: 12,
    borderRadius: 12,
  },
  photoMeasurementLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  photoMeasurementValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
  },
  photoActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  photoActionButton: {
    alignItems: 'center',
    gap: 4,
  },
  photoActionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  bottomSpacer: { height: 40 },
});