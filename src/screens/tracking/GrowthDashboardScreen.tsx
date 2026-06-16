import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
  TextInput,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { differenceInDays, differenceInMonths, format, isValid, parseISO } from 'date-fns';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowthIndex, useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAvatar } from '@/components/SafeAvatar';
import { useAuth } from '@/context/AuthContext';
import { useCustomization } from '@/hooks/useCustomization';
import { useFamily } from '@/context/FamilyContext';
import { useMedia } from '@/context/MediaContext';
import { useSweetAlert } from '@/components/SweetAlert';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';
import { useTracker } from '@/context/TrackerContext';
import { useTrackerAchievements } from '@/hooks/useTrackerAchievements';
import { useTrackerProgressive } from '@/hooks/useTrackerProgressive';
import { useUnifiedTrackerTheme } from '@/hooks/useUnifiedTrackerTheme';
import { useWHOGrowthCalculator } from '@/hooks/useWHOGrowthCalculator';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { showAlert } from '../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby } from '@/context/BabyContext';
import type { GrowthMeasurement, BabyProfile } from '@/types';

// ── CONTEXTS ──

// ── HOOKS ──

// ── COMPONENTS ──

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeGender = (g?: string): 'boy' | 'girl' => g === 'girl' ? 'girl' : 'boy';

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

const isValidUri = (uri?: string): boolean => {
  if (!uri) return false;
  return /^https?:\/\/|^file:\/\/|^ph:\/\/|^assets-library:/.test(uri);
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type MetricType = 'height' | 'weight' | 'head' | 'bmi';
type TimeRange = '1m' | '3m' | '6m' | '1y' | 'all';
type ChartMode = 'trend' | 'velocity' | 'percentile' | 'comparison';

interface PhotoItem {
  id: string;
  uri: string;
  date: string;
  ageMonths: number;
  source: 'app' | 'device';
  measurementId?: string;
  milestoneId?: string;
}

interface InsightItem {
  id: string;
  type: 'milestone' | 'growth' | 'health' | 'sleep' | 'nutrition' | 'correlation' | 'achievement' | 'vaccination';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
  timestamp: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = memo(({ children, style, onPress }: { children: React.ReactNode; style?: any; onPress?: () => void }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, style]}>
      <LinearGradient
        colors={theme.isDark ? ['rgba(40,40,55,0.6)', 'rgba(30,30,45,0.4)'] : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.48)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

const ScoreRing = memo(({ value, size = 56, stroke = 5, color }: { value: number; size?: number; stroke?: number; color: string }) => {
  const progress = Math.min(value, 100) / 100;
  const rotation = progress * 360;
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background circle */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: 'rgba(100,116,139,0.12)',
      }} />
      {/* Progress overlay using two half-circles */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '-90deg' }],
      }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: progress > 0.5 ? color : 'transparent',
          borderBottomColor: progress > 0.75 ? color : 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate: `${Math.min(rotation, 180)}deg` }],
        }} />
        {progress > 0.5 && (
          <View style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: progress > 0.75 ? color : 'transparent',
            borderBottomColor: progress > 0.875 ? color : 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate: `${Math.min(rotation - 180, 180)}deg` }],
          }} />
        )}
      </View>
      <Text style={[styles.scoreRingText, { fontSize: size * 0.28, color: '#1e293b' }]}>{Math.round(value)}</Text>
    </View>
  );
});

const MetricCard = memo(({ title, value, unit, change, icon, color, percentile, status, onPress, theme }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.metricCard}>
    <GlassCard>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconBg, { backgroundColor: `${color}18` }]}>
          <Text style={styles.metricIcon}>{icon}</Text>
        </View>
        {percentile !== undefined && (
          <View style={[styles.percentileBadge, { backgroundColor: `${color}15` }]}>
            <Text style={[styles.percentileText, { color }]}>P{percentile}</Text>
          </View>
        )}
      </View>
      <View style={styles.metricBody}>
        <Text style={styles.metricValue}>
          {value}
          <Text style={[styles.metricUnit, { color }]}>{unit}</Text>
        </Text>
        <Text style={[styles.metricTitle, { color: theme.text.secondary }]}>{title}</Text>
      </View>
      {change && (
        <View style={styles.metricFooter}>
          <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={12} color={change >= 0 ? '#10b981' : '#ef4444'} />
          <Text style={[styles.metricChange, { color: change >= 0 ? '#10b981' : '#ef4444' }]}>
            {change > 0 ? '+' : ''}{change}{unit}
          </Text>
        </View>
      )}
      {status && (
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      )}
    </GlassCard>
  </TouchableOpacity>
));

const InsightRow = memo(({ insight, theme, onPress, index }: { insight: InsightItem; theme: any; onPress: () => void; index: number }) => (
  <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <GlassCard style={[styles.insightCard, insight.priority === 'high' && { borderLeftWidth: 3, borderLeftColor: insight.color }]}>
        <View style={styles.insightRow}>
          <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}15` }]}>
            <Text style={styles.insightEmoji}>{insight.emoji}</Text>
          </View>
          <View style={styles.insightContent}>
            <View style={styles.insightHeader}>
              <Text style={[styles.insightTitle, { color: theme.text.primary }]} numberOfLines={1}>{insight.title}</Text>
              <Text style={[styles.insightTime, { color: theme.text.muted }]}>{safeFmt(insight.timestamp, 'MMM d')}</Text>
            </View>
            <Text style={[styles.insightDesc, { color: theme.text.secondary }]} numberOfLines={2}>{insight.description}</Text>
            {insight.action && (
              <View style={[styles.insightActionBadge, { backgroundColor: `${theme.primary}12` }]}>
                <Text style={[styles.insightActionText, { color: theme.primary }]}>{insight.action.label} →</Text>
              </View>
            )}
          </View>
          <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  </Animated.View>
));

const PhotoStrip = memo(({ photos, onAdd, onPress, theme }: { photos: PhotoItem[]; onAdd: () => void; onPress: (p: PhotoItem) => void; theme: any }) => (
  <View style={styles.photoSection}>
    <View style={styles.photoHeader}>
      <Text style={[styles.photoTitle, { color: theme.text.primary }]}>📸 Memories</Text>
      <TouchableOpacity onPress={onAdd} style={[styles.addPhotoChip, { backgroundColor: `${theme.primary}12` }]}>
        <Ionicons name="add" size={16} color={theme.primary} />
        <Text style={[styles.addPhotoChipText, { color: theme.primary }]}>Add</Text>
      </TouchableOpacity>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScroll}>
      <TouchableOpacity onPress={onAdd} style={[styles.addPhotoBtn, { borderColor: theme.primary }]}>
        <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.addPhotoGradient}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.addPhotoText}>Add</Text>
        </LinearGradient>
      </TouchableOpacity>
      {photos.map((photo, i) => (
        <TouchableOpacity key={photo.id} onPress={() => onPress(photo)} style={styles.photoItem}>
          {isValidUri(photo.uri) ? (
            <Image source={{ uri: photo.uri }} style={styles.photoImage} />
          ) : (
            <View style={[styles.photoImage, { backgroundColor: theme.surface.bg, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image" size={24} color={theme.text.muted} />
            </View>
          )}
          <View style={styles.photoOverlay}>
            <Text style={styles.photoAge}>{photo.ageMonths}m</Text>
          </View>
        </TouchableOpacity>
      ))}
      {photos.length === 0 && (
        <View style={[styles.emptyPhoto, { backgroundColor: theme.surface.card }]}>
          <Ionicons name="images-outline" size={32} color={theme.text.muted} />
          <Text style={[styles.emptyPhotoText, { color: theme.text.secondary }]}>No photos yet</Text>
        </View>
      )}
    </ScrollView>
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MODALS (centered, not top-left)
   ═══════════════════════════════════════════════════════════════════════════ */

const AddMeasurementModal = memo(({ visible, onClose, onSave, type, previousValue, theme }: any) => {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const unit = type === 'weight' ? 'kg' : 'cm';

  const handleSave = useCallback(() => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    onSave({ type, value: num, unit, date: new Date(date).toISOString(), notes: notes || undefined });
    setValue(''); setNotes(''); onClose();
  }, [value, notes, date, type, unit, onSave, onClose]);

  useEffect(() => { if (visible) { setValue(''); setNotes(''); setDate(format(new Date(), 'yyyy-MM-dd')); } }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { backgroundColor: theme.surface.bg }]}>
          <LinearGradient colors={theme.isDark ? ['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Add {type}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {previousValue !== undefined && (
            <View style={[styles.prevValueBox, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="information-circle" size={18} color={theme.primary} />
              <Text style={[styles.prevValueText, { color: theme.primary }]}>Previous: {previousValue} {unit}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Value ({unit})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholder={`Enter ${type}`}
              placeholderTextColor={theme.text.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              value={date}
              onChangeText={setDate}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text.primary }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              placeholderTextColor={theme.text.muted}
            />
          </View>

          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Save Measurement</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

const GrowthReportModal = memo(({ visible, onClose, baby, measurements, milestones, growthIndex, theme }: any) => {
  if (!visible || !baby) return null;

  const latestHeight = measurements.filter((m: GrowthMeasurement) => m.type === 'height').sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const latestWeight = measurements.filter((m: GrowthMeasurement) => m.type === 'weight').sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const latestHead = measurements.filter((m: GrowthMeasurement) => m.type === 'head').sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { maxHeight: SCREEN_H * 0.82, backgroundColor: theme.surface.bg }]}>
          <LinearGradient colors={theme.isDark ? ['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <View style={[styles.reportIconBg, { backgroundColor: `${theme.primary}15` }]}>
              <Ionicons name="medical" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Growth Report</Text>
              <Text style={[styles.modalSubtitle, { color: theme.text.secondary }]}>{baby.name} • {safeFmt(baby.birthDate, 'MMM d, yyyy')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {/* Composite Score */}
            {growthIndex && (
              <View style={[styles.reportScoreCard, { backgroundColor: `${theme.primary}10` }]}>
                <ScoreRing value={growthIndex.compositeIndex || 0} size={72} color={theme.primary} />
                <View style={styles.reportScoreText}>
                  <Text style={[styles.reportScoreLabel, { color: theme.text.secondary }]}>Growth Score</Text>
                  <Text style={[styles.reportScoreValue, { color: theme.text.primary }]}>{growthIndex.compositeIndex || '—'}/100</Text>
                </View>
              </View>
            )}

            {/* Latest Measurements */}
            <Text style={[styles.reportSectionTitle, { color: theme.text.primary }]}>Latest Measurements</Text>
            {latestHeight && (
              <View style={[styles.reportRow, { borderBottomColor: theme.surface.border }]}>
                <Text style={[styles.reportLabel, { color: theme.text.secondary }]}>Height</Text>
                <Text style={[styles.reportValue, { color: theme.text.primary }]}>{latestHeight.value} {latestHeight.unit}</Text>
              </View>
            )}
            {latestWeight && (
              <View style={[styles.reportRow, { borderBottomColor: theme.surface.border }]}>
                <Text style={[styles.reportLabel, { color: theme.text.secondary }]}>Weight</Text>
                <Text style={[styles.reportValue, { color: theme.text.primary }]}>{latestWeight.value} {latestWeight.unit}</Text>
              </View>
            )}
            {latestHead && (
              <View style={[styles.reportRow, { borderBottomColor: theme.surface.border }]}>
                <Text style={[styles.reportLabel, { color: theme.text.secondary }]}>Head Circumference</Text>
                <Text style={[styles.reportValue, { color: theme.text.primary }]}>{latestHead.value} {latestHead.unit}</Text>
              </View>
            )}

            {/* Milestones */}
            <Text style={[styles.reportSectionTitle, { color: theme.text.primary }]}>Milestones</Text>
            <Text style={[styles.reportValue, { color: theme.primary }]}>{milestones.length} recorded</Text>

            {/* Sub-scores */}
            {growthIndex && (
              <>
                <Text style={[styles.reportSectionTitle, { color: theme.text.primary }]}>Dimension Scores</Text>
                {[
                  { label: 'Nutrition', score: growthIndex.nutritionScore?.value, icon: '🍎', color: '#FF9F43' },
                  { label: 'Rest', score: growthIndex.restScore?.value, icon: '😴', color: '#5F27CD' },
                  { label: 'Physical', score: growthIndex.physicalScore?.value, icon: '💪', color: '#10AC84' },
                  { label: 'Cognitive', score: growthIndex.cognitiveScore?.value, icon: '🧠', color: '#FFD700' },
                  { label: 'Health', score: growthIndex.healthStability?.value, icon: '❤️', color: '#EE5A24' },
                ].map((dim) => (
                  <View key={dim.label} style={[styles.reportRow, { borderBottomColor: theme.surface.border }]}>
                    <Text style={[styles.reportLabel, { color: theme.text.secondary }]}>{dim.icon} {dim.label}</Text>
                    <Text style={[styles.reportValue, { color: dim.color }]}>{dim.score ?? '—'}</Text>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={[styles.shareBtn, { marginTop: 16 }]}>
              <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.shareBtnGradient}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

const BabySwitcherModal = memo(({ visible, onClose, babies, currentBaby, onSwitch, theme }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={95} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.babySwitcherModal, { backgroundColor: theme.surface.bg }]}>
          <LinearGradient colors={theme.isDark ? ['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={[styles.babySwitcherTitle, { color: theme.text.primary }]}>Select Baby</Text>
          {babies.map((baby: BabyProfile) => (
            <TouchableOpacity
              key={baby.id}
              onPress={() => { onSwitch(baby.id); onClose(); }}
              style={[styles.babySwitcherItem, currentBaby?.id === baby.id && { backgroundColor: `${theme.primary}15` }]}
            >
              <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="person" borderColor={currentBaby?.id === baby.id ? theme.primary : theme.surface.border} borderWidth={2} />
              <View style={styles.babySwitcherInfo}>
                <Text style={[styles.babySwitcherName, { color: theme.text.primary }]}>{baby.name}</Text>
                <Text style={[styles.babySwitcherMeta, { color: theme.text.secondary }]}>{safeFmt(baby.birthDate, 'MMM d, yyyy')} • {safeDiffMonths(new Date(), baby.birthDate)} months</Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PURE REACT NATIVE CHART (No SVG, no extra deps)
   ═══════════════════════════════════════════════════════════════════════════ */

const PureChart = memo(({ data, mode, theme, width, height }: any) => {
  if (!data || data.length === 0) return null;
  
  const values = data.map((d: any) => d.value);
  const maxVal = Math.max(...values, 0.1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const padding = { top: 20, right: 10, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  
  const getX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartW;
  const getY = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;
  
  if (mode === 'velocity') {
    // Bar chart
    const barW = Math.max(4, (chartW / data.length) * 0.6);
    return (
      <View style={{ width, height }}>
        {/* Y-axis labels */}
        {[0, 0.33, 0.66, 1].map((r, i) => (
          <Text key={`y-${i}`} style={{
            position: 'absolute',
            left: 0,
            top: padding.top + chartH - r * chartH - 6,
            width: padding.left - 4,
            fontSize: 9,
            color: theme.text.muted,
            textAlign: 'right',
          }}>
            {(minVal + r * range).toFixed(1)}
          </Text>
        ))}
        {/* Bars */}
        {data.map((d: any, i: number) => (
          <View key={i} style={{
            position: 'absolute',
            left: getX(i) - barW / 2,
            top: getY(d.value),
            width: barW,
            height: padding.top + chartH - getY(d.value),
            backgroundColor: theme.primary,
            borderRadius: 4,
            opacity: 0.85,
          }} />
        ))}
        {/* X labels */}
        {data.map((d: any, i: number) => (
          <Text key={`x-${i}`} style={{
            position: 'absolute',
            left: getX(i) - 20,
            top: padding.top + chartH + 4,
            width: 40,
            fontSize: 8,
            color: theme.text.muted,
            textAlign: 'center',
          }} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    );
  }
  
  // Line chart
  const points = data.map((d: any, i: number) => `${getX(i)},${getY(d.value)}`).join(' ');
  
  return (
    <View style={{ width, height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <View key={`grid-${i}`} style={{
          position: 'absolute',
          left: padding.left,
          right: padding.right,
          top: padding.top + chartH - r * chartH,
          height: 1,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }} />
      ))}
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <Text key={`y-${i}`} style={{
          position: 'absolute',
          left: 0,
          top: padding.top + chartH - r * chartH - 6,
          width: padding.left - 4,
          fontSize: 9,
          color: theme.text.muted,
          textAlign: 'right',
        }}>
          {(minVal + r * range).toFixed(1)}
        </Text>
      ))}
      {/* Area fill (simplified as line segments) */}
      {data.map((d: any, i: number) => {
        if (i === 0) return null;
        const prev = data[i - 1];
        const x1 = getX(i - 1), y1 = getY(prev.value);
        const x2 = getX(i), y2 = getY(d.value);
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`line-${i}`} style={{
            position: 'absolute',
            left: x1,
            top: y1,
            width: len,
            height: 3,
            backgroundColor: theme.primary,
            transform: [{ translateX: 0 }, { translateY: -1.5 }, { rotate: `${angle}deg` }],
            transformOrigin: '0% 50%',
            borderRadius: 1.5,
          }} />
        );
      })}
      {/* Data points */}
      {data.map((d: any, i: number) => (
        <View key={`pt-${i}`} style={{
          position: 'absolute',
          left: getX(i) - 4,
          top: getY(d.value) - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.primary,
          borderWidth: 2,
          borderColor: theme.surface.bg,
        }} />
      ))}
      {/* X labels */}
      {data.filter((_: any, i: number) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d: any, i: number) => (
        <Text key={`x-${i}`} style={{
          position: 'absolute',
          left: getX(data.indexOf(d)) - 20,
          top: padding.top + chartH + 4,
          width: 40,
          fontSize: 8,
          color: theme.text.muted,
          textAlign: 'center',
        }} numberOfLines={1}>
          {d.label}
        </Text>
      ))}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GrowthDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();
  const { triggerHaptic } = useCustomization();

  // ── Contexts ──
  const {
    currentBaby,
    growthData,
    milestones,
    addGrowthMeasurement,
    babies,
    switchBaby,
    getGrowthData,
  } = useBaby();
  const { userProfile } = useAuth();
  const { pickImage, takePhoto } = useMedia();
  const { entries: trackerEntries } = useTracker();

  // ── Intelligence Hooks ──
  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { achievements, newlyUnlocked, streak: globalStreak } = useTrackerAchievements();
  const { insights: progressiveInsights } = useTrackerProgressive('growth');

  // ── WHO Calculator ──
  const { getPercentile, getStatus, getVelocity, getPrediction } = useWHOGrowthCalculator();

  // ── State ──
  const [activeMetric, setActiveMetric] = useState<MetricType>('height');
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [chartMode, setChartMode] = useState<ChartMode>('trend');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [devicePhotos, setDevicePhotos] = useState<PhotoItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  // ── Media permission ──
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaPermission(status === 'granted');
    })();
  }, []);

  // ── Age ──
  const ageMonths = useMemo(() => {
    if (!currentBaby) return 0;
    return safeDiffMonths(new Date(), currentBaby.birthDate);
  }, [currentBaby]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    if (!currentBaby) return [];
    const ranges: Record<TimeRange, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 3650 };
    const cutoff = new Date(Date.now() - ranges[timeRange] * 24 * 60 * 60 * 1000);

    let data = getGrowthData(activeMetric)
      .filter(g => {
        const d = safeParseDate(g.date);
        return d && d >= cutoff;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // For BMI, compute from height+weight
    if (activeMetric === 'bmi') {
      const heights = getGrowthData('height').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const weights = getGrowthData('weight').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      data = weights.map(w => {
        const wDate = safeParseDate(w.date);
        if (!wDate) return null;
        const h = heights.reduce((best, curr) => {
          const bestDate = safeParseDate(best?.date);
          const currDate = safeParseDate(curr?.date);
          if (!bestDate || !currDate) return curr;
          return Math.abs(safeDiffDays(currDate, wDate)) < Math.abs(safeDiffDays(bestDate, wDate)) ? curr : best;
        }, heights[0]);
        if (!h) return null;
        const bmi = w.value / Math.pow(h.value / 100, 2);
        return { ...w, value: parseFloat(bmi.toFixed(2)), type: 'bmi' as const };
      }).filter(Boolean) as GrowthMeasurement[];
    }

    return data.map((g, i) => ({
      value: Number(g.value) || 0,
      label: safeFmt(g.date, 'MMM d'),
      dataPointText: String(g.value),
      index: i,
    }));
  }, [growthData, activeMetric, timeRange, currentBaby, getGrowthData]);

  // ── Velocity Data ──
  const velocityData = useMemo(() => {
    if (chartData.length < 2) return [];
    const velocities: { value: number; label: string }[] = [];
    for (let i = 1; i < chartData.length; i++) {
      const days = safeDiffDays(
        safeParseDate(growthData.find(g => g.date.includes(chartData[i].label))?.date) || new Date(),
        safeParseDate(growthData.find(g => g.date.includes(chartData[i - 1].label))?.date) || new Date()
      );
      if (days <= 0) continue;
      const velocity = (chartData[i].value - chartData[i - 1].value) / days * 30; // per month
      velocities.push({ value: parseFloat(velocity.toFixed(2)), label: chartData[i].label });
    }
    return velocities;
  }, [chartData, growthData]);

  // ── Percentile bands for chart background ──
  const percentileBands = useMemo(() => {
    if (!currentBaby || chartData.length === 0) return null;
    const gender = safeGender(currentBaby.gender);
    return chartData.map(d => {
      // This would need the actual age at each data point
      // Simplified: use current age for all (approximate for short time ranges)
      const p = getPercentile(d.value, ageMonths, activeMetric, gender);
      return { ...d, percentile: p };
    });
  }, [chartData, currentBaby, ageMonths, activeMetric, getPercentile]);

  // ── Stats with WHO percentiles ──
  const stats = useMemo(() => {
    if (!currentBaby) return null;
    const gender = safeGender(currentBaby.gender);
    const result: Record<string, any> = {};

    (['height', 'weight', 'head'] as MetricType[]).forEach(type => {
      const data = getGrowthData(type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0];
      const prev = data[1];

      if (latest) {
        const ageAt = Math.max(0, safeDiffMonths(latest.date, currentBaby.birthDate));
        const percentile = getPercentile(latest.value, ageAt, type, gender);
        const status = getStatus(percentile);

        result[type] = {
          value: latest.value.toFixed(1),
          unit: latest.unit,
          change: prev ? (latest.value - prev.value).toFixed(1) : undefined,
          percentile,
          status,
        };
      }
    });

    // BMI
    if (result.height && result.weight) {
      const h = parseFloat(result.height.value) / 100;
      const w = parseFloat(result.weight.value);
      const bmi = w / (h * h);
      const ageAt = Math.max(0, safeDiffMonths(new Date(), currentBaby.birthDate));
      const percentile = getPercentile(bmi, ageAt, 'bmi', gender);
      result.bmi = {
        value: bmi.toFixed(1),
        unit: '',
        percentile,
        status: getStatus(percentile),
      };
    }

    return result;
  }, [growthData, currentBaby, getGrowthData, getPercentile, getStatus]);

  // ── Smart Insights (REAL, not hardcoded) ──
  const smartInsights = useMemo((): InsightItem[] => {
    if (!currentBaby) return [];
    const items: InsightItem[] = [];
    const now = Date.now();

    // 1. Growth Intelligence insights
    if (growthIndex) {
      if (growthIndex.nutritionScore?.value < 50) {
        items.push({
          id: 'gi-nutrition',
          type: 'nutrition',
          title: 'Nutrition Needs Attention',
          description: `Nutrition score is ${growthIndex.nutritionScore.value}/100. Consider reviewing feeding patterns.`,
          emoji: '🍎',
          color: '#FF9F43',
          priority: 'high',
          action: { label: 'Track Feed', screen: 'AddEntry', params: { trackerId: 'feed' } },
          timestamp: now,
        });
      }
      if (growthIndex.restScore?.value < 50) {
        items.push({
          id: 'gi-sleep',
          type: 'sleep',
          title: 'Sleep Quality Low',
          description: `Rest score is ${growthIndex.restScore.value}/100. Check sleep schedule consistency.`,
          emoji: '😴',
          color: '#5F27CD',
          priority: 'medium',
          action: { label: 'Track Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' } },
          timestamp: now,
        });
      }
      if (growthIndex.milestoneReadiness?.length > 0) {
        const top = growthIndex.milestoneReadiness[0];
        items.push({
          id: 'gi-milestone',
          type: 'milestone',
          title: `${top.category} Milestone Ready!`,
          description: `${top.readinessPercent}% readiness for ${top.category} milestones. ${top.suggestedActivities?.[0] || ''}`,
          emoji: '🎯',
          color: '#10AC84',
          priority: 'medium',
          action: { label: 'Log Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' } },
          timestamp: now,
        });
      }
    }

    // 2. Timeline correlations
    timelineCorrelations.slice(0, 2).forEach(c => {
      items.push({
        id: `corr-${c.id}`,
        type: 'correlation',
        title: 'Pattern Discovered',
        description: c.insight,
        emoji: '🔗',
        color: '#54A0FF',
        priority: 'low',
        timestamp: now,
      });
    });

    // 3. Recent milestone
    const recentMilestone = [...milestones].sort((a, b) => {
      const da = safeParseDate(a.achievedAt);
      const db = safeParseDate(b.achievedAt);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })[0];
    if (recentMilestone && safeParseDate(recentMilestone.achievedAt) && safeDiffDays(new Date(), recentMilestone.achievedAt) < 7) {
      items.push({
        id: 'recent-milestone',
        type: 'milestone',
        title: 'New Milestone! 🌟',
        description: `${currentBaby.name} achieved "${recentMilestone.title}"`,
        emoji: '🏆',
        color: '#f59e0b',
        priority: 'high',
        timestamp: safeParseDate(recentMilestone.achievedAt)?.getTime() || now,
      });
    }

    // 4. Growth velocity alerts
    const typeData = getGrowthData(activeMetric);
    if (typeData.length >= 2) {
      const sorted = [...typeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      if (latest.value < prev.value) {
        const drop = ((prev.value - latest.value) / prev.value) * 100;
        if (drop > 5) {
          items.push({
            id: 'growth-drop',
            type: 'growth',
            title: 'Measurement Decrease',
            description: `Latest ${activeMetric} dropped ${drop.toFixed(1)}% from previous. Please verify.`,
            emoji: '⚠️',
            color: '#ef4444',
            priority: 'high',
            action: { label: 'Re-measure', screen: 'AddEntry', params: { trackerId: 'growth' } },
            timestamp: now,
          });
        }
      }
    }

    // 5. Streak at risk
    if (globalStreak?.streakAtRisk && globalStreak.currentStreak > 0) {
      items.push({
        id: 'streak-risk',
        type: 'achievement',
        title: '🔥 Streak at Risk!',
        description: `Log an entry in ${globalStreak.hoursUntilBreak}h to keep your ${globalStreak.currentStreak}-day streak alive.`,
        emoji: '⏰',
        color: '#ef4444',
        priority: 'high',
        action: { label: 'Log Now', screen: 'AddEntry' },
        timestamp: now,
      });
    }

    // 6. New achievement
    if (newlyUnlocked?.length > 0) {
      items.push({
        id: 'new-achievement',
        type: 'achievement',
        title: 'Achievement Unlocked! 🎉',
        description: `${newlyUnlocked.length} new achievement${newlyUnlocked.length > 1 ? 's' : ''} earned!`,
        emoji: '🏆',
        color: '#8b5cf6',
        priority: 'medium',
        action: { label: 'View All', screen: 'Achievements' },
        timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    }).slice(0, 6);
  }, [growthIndex, timelineCorrelations, milestones, currentBaby, activeMetric, getGrowthData, globalStreak, newlyUnlocked]);

  // ── Photos ──
  const allPhotos = useMemo((): PhotoItem[] => {
    const currentUserId = userProfile?.id || 'unknown';
    // From tracker entries with photos
    const entryPhotos: PhotoItem[] = trackerEntries
      .filter((e: any) => e.photoUris?.length > 0 && e.babyId === currentBaby?.id)
      .flatMap((e: any) => e.photoUris.map((uri: string, i: number) => ({
        id: `${e.id}-photo-${i}`,
        uri,
        date: new Date(e.timestamp).toISOString(),
        ageMonths: safeDiffMonths(new Date(e.timestamp), currentBaby?.birthDate),
        source: 'app' as const,
      })));
    // From device
    const deviceItems = devicePhotos.filter(p => p.source === 'device');
    return [...entryPhotos.slice(0, 10), ...deviceItems].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, 15);
  }, [trackerEntries, devicePhotos, currentBaby, userProfile]);

  // ── Handlers ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800)); // Let hooks refresh
    setRefreshing(false);
  }, []);

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
      setShowAddModal(false);
    }
  }, [currentBaby, addGrowthMeasurement, userProfile, triggerHaptic]);

  const handleAddPhoto = useCallback(async () => {

showAlert('Add Photo', 'Choose source:', [
      {
        text: '📷 Take Photo',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) {
            setDevicePhotos(prev => [{
              id: `device-${Date.now()}`,
              uri,
              date: new Date().toISOString(),
              ageMonths,
              source: 'device',
            }, ...prev]);
            triggerHaptic('success');
          }
        }
      },
      {
        text: '🖼️ From Gallery',
        onPress: async () => {
          if (!hasMediaPermission) {

showAlert('Permission Required', 'Please allow photo access in settings');
            return;
          }
          const uri = await pickImage();
          if (uri) {
            setDevicePhotos(prev => [{
              id: `device-${Date.now()}`,
              uri,
              date: new Date().toISOString(),
              ageMonths,
              source: 'device',
            }, ...prev]);
            triggerHaptic('success');
          }
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [takePhoto, pickImage, hasMediaPermission, ageMonths, triggerHaptic]);

  const handleInsightPress = useCallback((insight: InsightItem) => {
    triggerHaptic('light');
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  }, [navigation, triggerHaptic]);

  const getPreviousValue = useCallback(() => {
    const data = getGrowthData(activeMetric).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return data[0]?.value;
  }, [activeMetric, getGrowthData]);

  // ── Loading / No baby states ──
  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bgColors[0] }, styles.center]}>
        <StatusBar barStyle={theme.statusBar} />
        <LinearGradient colors={theme.bgColors} style={StyleSheet.absoluteFill} />
        <Ionicons name="person-add" size={64} color={theme.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.noDataTitle, { color: theme.text.primary }]}>No Baby Profile</Text>
        <Text style={[styles.noDataText, { color: theme.text.secondary }]}>Create a profile to start tracking growth</Text>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('CreateBabyProfile')}>
          <Text style={styles.createBtnText}>Create Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Background */}
      <LinearGradient colors={theme.bgColors} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.blur} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>{currentBaby.name}'s Growth</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>{ageMonths} months</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} />
        }
      >
        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: theme.surface.card }]}>
              <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowBabySwitcher(true)} style={styles.babySelector}>
              <SafeAvatar avatar={currentBaby.avatar} size={40} fallbackIcon="person" borderColor={theme.primary} borderWidth={2} />
              <View style={styles.babySelectorText}>
                <Text style={[styles.babyName, { color: theme.text.primary }]}>{currentBaby.name}</Text>
                <Text style={[styles.babyAge, { color: theme.text.secondary }]}>{ageMonths} months • Tap to switch</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={theme.text.muted} />
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setShowReportModal(true)} style={[styles.headerBtn, { backgroundColor: theme.surface.card }]}>
                <Ionicons name="document-text" size={20} color={theme.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.headerBtn, styles.addBtn, { backgroundColor: theme.primary }]}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── GROWTH SCORE CARD ── */}
        {growthIndex && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <GlassCard onPress={() => navigation.navigate('GrowthIntelligence')}>
              <View style={styles.scoreCard}>
                <View style={styles.scoreLeft}>
                  <ScoreRing value={growthIndex.compositeIndex || 0} size={80} stroke={6} color={theme.primary} />
                  <View style={styles.scoreLabels}>
                    <Text style={[styles.scoreLabel, { color: theme.text.secondary }]}>Growth Score</Text>
                    <Text style={[styles.scoreValue, { color: theme.text.primary }]}>{growthIndex.compositeIndex || '—'}</Text>
                  </View>
                </View>
                <View style={styles.scoreRight}>
                  {[
                    { label: 'Nutrition', value: growthIndex.nutritionScore?.value, color: '#FF9F43', icon: '🍎' },
                    { label: 'Rest', value: growthIndex.restScore?.value, color: '#5F27CD', icon: '😴' },
                    { label: 'Physical', value: growthIndex.physicalScore?.value, color: '#10AC84', icon: '💪' },
                  ].map(s => (
                    <View key={s.label} style={styles.scoreMini}>
                      <Text style={styles.scoreMiniIcon}>{s.icon}</Text>
                      <View style={[styles.scoreMiniBar, { backgroundColor: `${s.color}20` }]}>
                        <View style={[styles.scoreMiniFill, { width: `${Math.min(s.value || 0, 100)}%`, backgroundColor: s.color }]} />
                      </View>
                      <Text style={[styles.scoreMiniValue, { color: s.color }]}>{s.value ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── STATS GRID ── */}
        <View style={styles.statsGrid}>
          {[
            { key: 'height', title: 'Height', icon: '📏', color: theme.primary },
            { key: 'weight', title: 'Weight', icon: '⚖️', color: '#FF6B9D' },
            { key: 'head', title: 'Head', icon: '🧠', color: '#00D9C0' },
            { key: 'bmi', title: 'BMI', icon: '📊', color: '#FFB347' },
          ].map((m, i) => {
            const s = stats?.[m.key];
            return (
              <Animated.View key={m.key} entering={FadeInUp.delay(150 + i * 60).springify()} style={styles.metricCardWrapper}>
                <MetricCard
                  title={m.title}
                  value={s?.value || '—'}
                  unit={s?.unit || (m.key === 'weight' ? 'kg' : m.key === 'bmi' ? '' : 'cm')}
                  change={s?.change ? parseFloat(s.change) : undefined}
                  icon={m.icon}
                  color={m.color}
                  percentile={s?.percentile}
                  status={s?.status}
                  onPress={() => { setActiveMetric(m.key as MetricType); triggerHaptic('light'); }}
                  theme={theme}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* ── PHOTO STRIP ── */}
        <PhotoStrip photos={allPhotos} onAdd={handleAddPhoto} onPress={(p) => {}} theme={theme} />

        {/* ── CHART CONTROLS ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <GlassCard style={styles.chartControls}>
            {/* Metric selector */}
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: theme.text.muted }]}>Metric</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['height', 'weight', 'head', 'bmi'] as MetricType[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setActiveMetric(m)}
                    style={[styles.controlChip, activeMetric === m && { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.controlChipText, { color: activeMetric === m ? '#fff' : theme.text.secondary }]}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Time range */}
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: theme.text.muted }]}>Range</Text>
              <View style={styles.timeRangeRow}>
                {(['1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setTimeRange(r)}
                    style={[styles.timeChip, timeRange === r && { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.timeChipText, { color: timeRange === r ? '#fff' : theme.text.secondary }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Chart mode */}
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: theme.text.muted }]}>View</Text>
              <View style={styles.timeRangeRow}>
                {([
                  { key: 'trend' as ChartMode, label: 'Trend', icon: 'trending-up' },
                  { key: 'velocity' as ChartMode, label: 'Velocity', icon: 'speedometer' },
                  { key: 'percentile' as ChartMode, label: 'Percentile', icon: 'analytics' },
                ]).map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setChartMode(m.key)}
                    style={[styles.timeChip, chartMode === m.key && { backgroundColor: theme.secondary }]}
                  >
                    <Ionicons name={m.icon as any} size={14} color={chartMode === m.key ? '#fff' : theme.text.secondary} />
                    <Text style={[styles.timeChipText, { color: chartMode === m.key ? '#fff' : theme.text.secondary, marginLeft: 4 }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── MAIN CHART ── */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <GlassCard style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTitle, { color: theme.text.primary }]}>
                  {chartMode === 'trend' ? `${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Trend` :
                   chartMode === 'velocity' ? 'Growth Velocity' : 'Percentile Tracking'}
                </Text>
                <Text style={[styles.chartSubtitle, { color: theme.text.muted }]}>
                  {chartData.length} measurements • WHO Standard
                </Text>
              </View>
              {percentileBands && percentileBands.length > 0 && (
                <View style={[styles.currentPercentile, { backgroundColor: `${theme.primary}15` }]}>
                  <Text style={[styles.currentPercentileText, { color: theme.primary }]}>
                    P{percentileBands[percentileBands.length - 1]?.percentile || '—'}
                  </Text>
                </View>
              )}
            </View>

            {chartData.length > 0 ? (
              <PureChart
                data={chartMode === 'velocity' ? velocityData : chartData}
                mode={chartMode}
                theme={theme}
                width={SCREEN_W - 72}
                height={220}
              />
            ) : (
              <View style={styles.emptyChart}>
                <MaterialCommunityIcons name="chart-line" size={48} color={theme.text.muted} />
                <Text style={[styles.emptyChartText, { color: theme.text.muted }]}>No data yet</Text>
                <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addDataBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.addDataBtnText}>Add First Measurement</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* ── SMART INSIGHTS (REAL, NOT HARDCODED) ── */}
        {smartInsights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="sparkles" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Smart Insights</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${theme.primary}15` }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>{smartInsights.filter(i => i.priority === 'high').length}</Text>
              </View>
            </View>
            {smartInsights.map((insight, i) => (
              <InsightRow
                key={insight.id}
                insight={insight}
                theme={theme}
                onPress={() => handleInsightPress(insight)}
                index={i}
              />
            ))}
          </View>
        )}

        {/* ── MILESTONE READINESS ── */}
        {growthIndex?.milestoneReadiness && growthIndex.milestoneReadiness.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>🎯 Milestone Readiness</Text>
            </View>
            <GlassCard>
              {growthIndex.milestoneReadiness.map((m: any, i: number) => (
                <View key={i} style={[styles.milestoneRow, i < growthIndex.milestoneReadiness.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
                  <View style={styles.milestoneLeft}>
                    <Text style={styles.milestoneCategory}>{m.category}</Text>
                    <View style={[styles.milestoneBarBg, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                      <View style={[styles.milestoneBarFill, { width: `${Math.min(m.readinessPercent, 100)}%`, backgroundColor: m.readinessPercent > 80 ? '#10b981' : m.readinessPercent > 50 ? '#f59e0b' : '#ef4444' }]} />
                    </View>
                  </View>
                  <Text style={[styles.milestonePercent, { color: theme.text.primary }]}>{m.readinessPercent}%</Text>
                </View>
              ))}
            </GlassCard>
          </View>
        )}

        {/* ── VELOCITY TRENDS ── */}
        {growthIndex?.velocityTrends && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>📈 Velocity Trends</Text>
            </View>
            <View style={styles.velocityGrid}>
              {[
                { key: 'height', label: 'Height', unit: 'cm/mo', color: theme.primary },
                { key: 'weight', label: 'Weight', unit: 'kg/mo', color: '#FF6B9D' },
                { key: 'head', label: 'Head', unit: 'cm/mo', color: '#00D9C0' },
              ].map(v => {
                const data = (growthIndex.velocityTrends as any)?.[v.key];
                return (
                  <GlassCard key={v.key} style={styles.velocityCard}>
                    <Text style={[styles.velocityLabel, { color: theme.text.secondary }]}>{v.label}</Text>
                    <Text style={[styles.velocityValue, { color: v.color }]}>{data?.perMonth?.toFixed(2) || '—'}</Text>
                    <Text style={[styles.velocityUnit, { color: theme.text.muted }]}>{v.unit}</Text>
                    <Text style={[styles.velocityPercentile, { color: theme.text.muted }]}>P{data?.percentile || '—'}</Text>
                  </GlassCard>
                );
              })}
            </View>
          </View>
        )}

        {/* ── RECENT MEASUREMENTS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Recent Measurements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Timeline', { filter: 'growth' })}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See All →</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.historyCard}>
            {getGrowthData(activeMetric)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((m, i, arr) => {
                const ageAt = Math.max(0, safeDiffMonths(m.date, currentBaby.birthDate));
                const gender = safeGender(currentBaby.gender);
                const percentile = getPercentile(m.value, ageAt, m.type as MetricType, gender);
                return (
                  <View key={m.id} style={[styles.historyRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
                    <View style={[styles.historyIcon, { backgroundColor: `${theme.primary}12` }]}>
                      <Text style={{ fontSize: 16 }}>
                        {m.type === 'height' ? '📏' : m.type === 'weight' ? '⚖️' : m.type === 'head' ? '🧠' : '📊'}
                      </Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={[styles.historyType, { color: theme.text.primary }]}>{m.type.charAt(0).toUpperCase() + m.type.slice(1)}</Text>
                      <Text style={[styles.historyDate, { color: theme.text.muted }]}>{safeFmt(m.date, 'MMM d, yyyy')}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={[styles.historyValue, { color: theme.primary }]}>{m.value} {m.unit}</Text>
                      <View style={[styles.historyPercentile, { backgroundColor: `${getStatus(percentile).color}15` }]}>
                        <Text style={[styles.historyPercentileText, { color: getStatus(percentile).color }]}>P{percentile}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            {getGrowthData(activeMetric).length === 0 && (
              <View style={styles.emptyHistory}>
                <Text style={[styles.emptyHistoryText, { color: theme.text.muted }]}>No measurements yet</Text>
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.quickActions}>
          {[
            { icon: '🌟', label: 'Milestones', screen: 'Timeline', params: { filter: 'milestone' }, gradient: ['#f59e0b', '#fbbf24'] },
            { icon: '💉', label: 'Vaccines', screen: 'VaccinationSchedule', params: {}, gradient: [theme.primary, theme.secondary] },
            { icon: '📸', label: 'Photos', screen: 'Gallery', params: {}, gradient: ['#10b981', '#34d399'] },
            { icon: '🏆', label: 'Achievements', screen: 'Achievements', params: {}, gradient: ['#8b5cf6', '#a78bfa'] },
          ].map((action, i) => (
            <TouchableOpacity key={i} onPress={() => navigation.navigate(action.screen, action.params)} style={styles.quickAction}>
              <LinearGradient colors={action.gradient as [string, string]} style={styles.quickActionGradient}>
                <Text style={styles.quickActionIcon}>{action.icon}</Text>
                <Text style={styles.quickActionText}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddMeasurement}
        type={activeMetric}
        previousValue={getPreviousValue()}
        theme={theme}
      />

      <GrowthReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        baby={currentBaby}
        measurements={growthData}
        milestones={milestones}
        growthIndex={growthIndex}
        theme={theme}
      />

      <BabySwitcherModal
        visible={showBabySwitcher}
        onClose={() => setShowBabySwitcher(false)}
        babies={babies}
        currentBaby={currentBaby}
        onSwitch={switchBaby}
        theme={theme}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { marginHorizontal: 16, marginBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 48, height: 48, borderRadius: 16 },
  headerActions: { flexDirection: 'row', gap: 8 },

  // Baby selector
  babySelector: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  babySelectorText: { flex: 1 },
  babyName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  babyAge: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  // Sticky header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // Score card
  scoreCard: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  scoreLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreLabels: { gap: 2 },
  scoreLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreRight: { flex: 1, gap: 8 },
  scoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreMiniIcon: { fontSize: 14, width: 20 },
  scoreMiniBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreMiniFill: { height: '100%', borderRadius: 3 },
  scoreMiniValue: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },

  // Score ring
  scoreRingText: { position: 'absolute', fontWeight: '800' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  metricCardWrapper: { width: (SCREEN_W - 42) / 2 },
  metricCard: { padding: 14 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  metricIconBg: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricIcon: { fontSize: 18 },
  percentileBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  percentileText: { fontSize: 11, fontWeight: '800' },
  metricBody: { gap: 3 },
  metricValue: { fontSize: 26, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  metricUnit: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  metricTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metricChange: { fontSize: 12, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Glass card
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  glassContent: { flex: 1 },

  // Photo section
  photoSection: { marginBottom: 16 },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 10 },
  photoTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  addPhotoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  addPhotoChipText: { fontSize: 13, fontWeight: '600' },
  photoScroll: { paddingHorizontal: 16, gap: 10 },
  addPhotoBtn: { width: 100, height: 130, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden' },
  addPhotoGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  addPhotoText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  photoItem: { width: 100, height: 130, borderRadius: 16, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.4)' },
  photoAge: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyPhoto: { width: 100, height: 130, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 6 },
  emptyPhotoText: { fontSize: 12, fontWeight: '500' },

  // Chart controls
  chartControls: { padding: 16, gap: 12 },
  controlRow: { gap: 8 },
  controlLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  controlChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.08)', marginRight: 8 },
  controlChipText: { fontSize: 13, fontWeight: '600' },
  timeRangeRow: { flexDirection: 'row', gap: 8 },
  timeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.08)', alignItems: 'center' },
  timeChipText: { fontSize: 12, fontWeight: '600' },

  // Chart
  chartCard: { padding: 16, marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  chartTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  chartSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  currentPercentile: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  currentPercentileText: { fontSize: 13, fontWeight: '800' },
  emptyChart: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyChartText: { fontSize: 14, fontWeight: '500' },
  addDataBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  addDataBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  // Insights
  insightCard: { padding: 14, marginBottom: 8 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700' },
  insightTime: { fontSize: 11, fontWeight: '500' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },

  // Milestones
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  milestoneLeft: { flex: 1, gap: 6 },
  milestoneCategory: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', color: '#64748b' },
  milestoneBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  milestoneBarFill: { height: '100%', borderRadius: 3 },
  milestonePercent: { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  // Velocity
  velocityGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  velocityCard: { flex: 1, padding: 14, alignItems: 'center', gap: 4 },
  velocityLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  velocityValue: { fontSize: 22, fontWeight: '800' },
  velocityUnit: { fontSize: 11, fontWeight: '500' },
  velocityPercentile: { fontSize: 12, fontWeight: '600' },

  // History
  historyCard: { padding: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  historyIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyInfo: { flex: 1, gap: 2 },
  historyType: { fontSize: 14, fontWeight: '700' },
  historyDate: { fontSize: 11, fontWeight: '500' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyValue: { fontSize: 16, fontWeight: '800' },
  historyPercentile: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyPercentileText: { fontSize: 10, fontWeight: '800' },
  emptyHistory: { padding: 24, alignItems: 'center' },
  emptyHistoryText: { fontSize: 14, fontWeight: '500' },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 },
  quickAction: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  quickActionGradient: { paddingVertical: 16, alignItems: 'center', gap: 6 },
  quickActionIcon: { fontSize: 22 },
  quickActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(100,116,139,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Add measurement modal
  prevValueBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  prevValueText: { fontSize: 13, fontWeight: '600' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { marginTop: 6, borderRadius: 12, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Report modal
  reportIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  reportScoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, marginBottom: 16 },
  reportScoreText: { gap: 2 },
  reportScoreLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reportScoreValue: { fontSize: 28, fontWeight: '800' },
  reportSectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  reportLabel: { fontSize: 13, fontWeight: '600' },
  reportValue: { fontSize: 15, fontWeight: '700' },
  shareBtn: { borderRadius: 12, overflow: 'hidden' },
  shareBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Baby switcher modal
  babySwitcherModal: { width: '85%', maxWidth: 360, borderRadius: 24, padding: 20, overflow: 'hidden' },
  babySwitcherTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  babySwitcherItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, marginBottom: 8 },
  babySwitcherInfo: { flex: 1 },
  babySwitcherName: { fontSize: 16, fontWeight: '700' },
  babySwitcherMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // No data states
  noDataTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  noDataText: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginHorizontal: 40, marginBottom: 24 },
  createBtn: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Scroll
  scrollContent: { paddingBottom: 20 },
});