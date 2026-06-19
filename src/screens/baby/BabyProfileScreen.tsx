import {
  StyleSheet,
  ActionSheetIOS,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  Text,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { Milestone, useBaby } from '../../context/BabyContext';
import { showConfirmModal, showErrorModal, showSuccessModal } from '../../utils/modal';
import { useActivity } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* DESIGN TOKENS */
const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:') || value.startsWith('ph://') || value.startsWith('assets-library://');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const SKIN_TONES = [
  { color: '#F5D5C5', label: 'Fair' }, { color: '#E8C4A0', label: 'Light' },
  { color: '#D4A574', label: 'Medium' }, { color: '#C68642', label: 'Tan' },
  { color: '#8D5524', label: 'Brown' }, { color: '#5C3A21', label: 'Dark' },
  { color: '#3D2314', label: 'Deep' }, { color: '#E0AC69', label: 'Olive' },
  { color: '#CD853F', label: 'Bronze' }, { color: '#A0522D', label: 'Chestnut' },
  { color: '#F4C2C2', label: 'Rose Fair' }, { color: '#D2691E', label: 'Amber' },
];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#10b981', gradient: ['#10b981', '#34d399'] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#6366f1' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#f97316' },
];

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; emoji: string; label: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', emoji: '🚽', label: 'Potty' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', emoji: '🍼', label: 'Feeding' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', emoji: '😴', label: 'Sleep' },
  growth: { icon: 'trending-up-outline', color: '#10b981', emoji: '📏', label: 'Growth' },
  medication: { icon: 'medical-outline', color: '#ef4444', emoji: '💊', label: 'Medication' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', emoji: '🌟', label: 'Milestone' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', emoji: '🧷', label: 'Diaper' },
  note: { icon: 'document-text-outline', color: '#6b7280', emoji: '📝', label: 'Note' },
};

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'overview' | 'milestones' | 'health' | 'danger';

/* SUB-COMPONENTS */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: any) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: '#6366f1', borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = React.memo(({ tabs, activeTab, onChange }: any) => (
  <View style={styles.tabBar}>
    {tabs.map((tab: any) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)', ...DESIGN.shadow.sm }]}>
          <Ionicons name={tab.icon} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

const KpiPill = React.memo(({ icon, value, label, color, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiPill}>
    <LinearGradient colors={[`${color}15`, `${color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    <View style={[styles.kpiPillIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.kpiPillEmoji}>{icon}</Text>
    </View>
    <View style={styles.kpiPillBody}>
      <Text style={[styles.kpiPillValue, { color }]}>{value}</Text>
      <Text style={styles.kpiPillLabel}>{label}</Text>
    </View>
  </TouchableOpacity>
));

const SafeBabyAvatar = React.memo(({ avatar, gender = 'other', size = 72, showEditButton = false, onEdit }: any) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#6366f1', '#8b5cf6'];
  const imageSource = useMemo(() => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('file://') || avatar.startsWith('ph://') || avatar.startsWith('assets-library://')) return { uri: avatar };
    return null;
  }, [avatar]);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient colors={hasImage ? ['#2d2d3a', '#1a1a2e'] : gradientColors} style={[styles.avatarGradient, { width: size, height: size, borderRadius: size * 0.33 }]}>
        {hasImage && imageSource ? (
          <View style={{ width: size, height: size, borderRadius: size * 0.33, overflow: 'hidden' }}>
            <Image source={imageSource} style={{ width: size, height: size }} resizeMode="cover" />
          </View>
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Ionicons name={genderOption?.icon as any || 'ellipse'} size={size * 0.4} color="#fff" />
        )}
      </LinearGradient>
      {showEditButton && onEdit && (
        <TouchableOpacity style={[styles.editAvatarBtn, { bottom: -4, right: -4 }]} onPress={onEdit} activeOpacity={0.8}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.editAvatarGradient}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

/* NEW FEATURE 1: Baby Growth Velocity Tracker */
const GrowthVelocityTracker = React.memo(({ baby }: { baby: any }) => {
  const velocityData = useMemo(() => {
    const now = new Date();
    const birthDate = new Date(baby?.birthDate || now);
    const ageInDays = differenceInDays(now, birthDate);
    const ageInMonths = differenceInMonths(now, birthDate);
    const weight = parseFloat(baby?.weight || '0');
    const height = parseFloat(baby?.height || '0');
    const milestones = baby?.milestones?.length || 0;
    const weightPercentile = weight > 0 ? Math.min(100, Math.round((weight / (ageInMonths * 0.5 + 3)) * 50)) : 0;
    const heightPercentile = height > 0 ? Math.min(100, Math.round((height / (ageInMonths * 1.5 + 50)) * 50)) : 0;
    const items = [];
    if (weightPercentile > 0) items.push({ label: 'Weight', value: `${weight}kg`, percentile: weightPercentile, status: weightPercentile > 90 ? 'High' : weightPercentile < 10 ? 'Low' : 'Normal', color: weightPercentile > 90 ? '#f59e0b' : weightPercentile < 10 ? '#ef4444' : '#10b981', icon: '⚖️' });
    if (heightPercentile > 0) items.push({ label: 'Height', value: `${height}cm`, percentile: heightPercentile, status: heightPercentile > 90 ? 'Tall' : heightPercentile < 10 ? 'Short' : 'Normal', color: heightPercentile > 90 ? '#6366f1' : heightPercentile < 10 ? '#f59e0b' : '#10b981', icon: '📏' });
    items.push({ label: 'Age', value: ageInDays < 30 ? `${ageInDays}d` : `${ageInMonths}m`, percentile: Math.min(100, Math.round((ageInDays / 365) * 100)), status: 'Tracking', color: '#8b5cf6', icon: '👶' });
    items.push({ label: 'Milestones', value: `${milestones}`, percentile: Math.min(100, milestones * 10), status: milestones > 5 ? 'Advanced' : 'On Track', color: milestones > 5 ? '#fbbf24' : '#6366f1', icon: '🌟' });
    return items;
  }, [baby]);

  if (velocityData.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Growth Velocity" subtitle="Percentile tracking & development" />
      <View style={styles.velocityGrid}>
        {velocityData.map((item: any, i: number) => (
          <GlassCard key={i} style={styles.velocityCard} delay={i * 60}>
            <View style={styles.velocityHeader}>
              <Text style={styles.velocityEmoji}>{item.icon}</Text>
              <View style={[styles.velocityBadge, { backgroundColor: `${item.color}15` }]}>
                <Text style={[styles.velocityBadgeText, { color: item.color }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.velocityValue}>{item.value}</Text>
            <Text style={styles.velocityLabel}>{item.label}</Text>
            <View style={styles.velocityBarBg}>
              <View style={[styles.velocityBarFill, { width: `${item.percentile}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={[styles.velocityPercentile, { color: item.color }]}>{item.percentile}th percentile</Text>
          </GlassCard>
        ))}
      </View>
    </Animated.View>
  );
});

/* NEW FEATURE 2: Smart Development Timeline */
const DevelopmentTimeline = React.memo(({ milestones, baby }: { milestones: any[]; baby: any }) => {
  const timelineItems = useMemo(() => {
    const items = [];
    if (baby?.birthDate) items.push({ date: baby.birthDate, title: 'Born', desc: `Welcome to the world, ${baby.name || 'Baby'}!`, emoji: '👶', color: '#6366f1', type: 'birth' });
    const sortedMilestones = [...milestones].sort((a, b) => new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime()).slice(0, 4);
    sortedMilestones.forEach((m) => {
      const category = MILESTONE_CATEGORIES.find(c => c.id === m.category);
      items.push({ date: m.achievedAt, title: m.title, desc: category?.label || 'Milestone', emoji: '🏆', color: category?.color || '#f59e0b', type: 'milestone' });
    });
    return items.slice(0, 5);
  }, [milestones, baby]);

  if (timelineItems.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Development Timeline" subtitle="Key milestones in order" />
      <View style={styles.timelineContainer}>
        {timelineItems.map((item: any, i: number) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineLine, i === 0 && { top: '50%' }, i === timelineItems.length - 1 && { bottom: '50%' }]} />
              <View style={[styles.timelineDot, { backgroundColor: item.color, borderColor: item.color }]} />
            </View>
            <View style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineEmoji}>{item.emoji}</Text>
                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDate}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
              </View>
              <Text style={styles.timelineDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

/* NEW FEATURE 3: AI Health Insights */
const AIHealthInsights = React.memo(({ baby, activities }: { baby: any; activities: any[] }) => {
  const insights = useMemo(() => {
    const items = [];
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentActivities = activities.filter((a: any) => a.timestamp > weekAgo);
    const hasAllergies = baby?.allergies && baby.allergies.length > 0;
    const hasMedicalNotes = baby?.medicalNotes && baby.medicalNotes.length > 0;
    const weight = parseFloat(baby?.weight || '0');
    const birthDate = new Date(baby?.birthDate || now);
    const ageInMonths = differenceInMonths(new Date(), birthDate);

    if (recentActivities.length > 10) items.push({ emoji: '🔥', title: 'Very Active', desc: `${recentActivities.length} activities this week — great tracking!`, color: '#f59e0b', priority: 'low' });
    else if (recentActivities.length === 0) items.push({ emoji: '💤', title: 'No Recent Activity', desc: 'Consider logging daily activities', color: '#ef4444', priority: 'high', action: 'Log Now' });
    if (hasAllergies) items.push({ emoji: '⚠️', title: 'Allergy Alert', desc: `Allergies: ${baby.allergies.join(', ')}`, color: '#f59e0b', priority: 'high' });
    if (hasMedicalNotes) items.push({ emoji: '📋', title: 'Medical Notes', desc: 'Important medical information on file', color: '#6366f1', priority: 'medium' });
    if (weight > 0 && ageInMonths > 0) {
      const expectedWeight = ageInMonths * 0.5 + 3;
      const diff = Math.abs(weight - expectedWeight);
      if (diff > 2) items.push({ emoji: '📊', title: 'Weight Check', desc: `Weight differs from expected by ${diff.toFixed(1)}kg`, color: '#f59e0b', priority: 'medium' });
      else items.push({ emoji: '✅', title: 'Weight On Track', desc: 'Weight is within expected range', color: '#10b981', priority: 'low' });
    }
    const sleepEntries = activities.filter((a: any) => a.type === 'sleep');
    if (sleepEntries.length > 0) {
      const avgSleep = sleepEntries.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / sleepEntries.length;
      if (avgSleep < 10 * 60 * 60 * 1000) items.push({ emoji: '😴', title: 'Sleep Alert', desc: 'Average sleep seems low for this age', color: '#f59e0b', priority: 'medium' });
    }
    return items.slice(0, 3);
  }, [baby, activities]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="AI Health Insights" subtitle="Intelligent health monitoring" />
      <View style={styles.insightsList}>
        {insights.map((insight: any, i: number) => (
          <TouchableOpacity key={i} activeOpacity={0.85} style={[styles.insightRow, { borderLeftColor: insight.color }]}>
            <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
              <Text style={styles.insightEmoji}>{insight.emoji}</Text>
            </View>
            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                {insight.action && (
                  <View style={[styles.insightActionBadge, { backgroundColor: `${insight.color}15` }]}>
                    <Text style={[styles.insightActionText, { color: insight.color }]}>{insight.action}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.insightDesc}>{insight.desc}</Text>
            </View>
            <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* NEW FEATURE 4: Activity Pattern Sparkline */
const ActivitySparkline = React.memo(({ activities }: { activities: any[] }) => {
  const data = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days[d.toISOString().split('T')[0]] = 0; }
    activities.forEach((a: any) => { const d = new Date(a.timestamp).toISOString().split('T')[0]; if (days[d] !== undefined) days[d]++; });
    return Object.values(days);
  }, [activities]);

  const maxVal = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <GlassCard>
        <View style={styles.sparklineHeader}>
          <View>
            <Text style={styles.sparklineTitle}>Activity This Week</Text>
            <Text style={styles.sparklineSubtitle}>Daily entry count</Text>
          </View>
          <View style={styles.sparklineTotal}>
            <Text style={styles.sparklineTotalValue}>{total}</Text>
            <Text style={styles.sparklineTotalLabel}>entries</Text>
          </View>
        </View>
        <View style={styles.sparklineChart}>
          {data.map((val, i) => {
            const barHeight = Math.max(4, (val / maxVal) * 60);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.sparklineBar, { height: barHeight, backgroundColor: isToday ? '#6366f1' : val > 0 ? '#8b5cf6' : '#334155' }]} />
                <Text style={[styles.sparklineDay, isToday && { color: '#6366f1', fontWeight: '700' }]}>{['M','T','W','T','F','S','S'][i]}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* NEW FEATURE 5: Next Milestone Predictor */
const NextMilestonePredictor = React.memo(({ baby, milestones }: { baby: any; milestones: any[] }) => {
  const predictions = useMemo(() => {
    const birthDate = new Date(baby?.birthDate || new Date());
    const ageInDays = differenceInDays(new Date(), birthDate);
    const achievedTitles = new Set(milestones.map(m => m.title.toLowerCase()));
    const upcoming = [];
    const milestoneMap = [
      { ageDays: 30, title: 'First Smile', category: 'social', desc: 'Social smile response' },
      { ageDays: 60, title: 'Head Control', category: 'physical', desc: 'Can hold head up briefly' },
      { ageDays: 90, title: 'Rolling Over', category: 'physical', desc: 'Rolls from tummy to back' },
      { ageDays: 120, title: 'Laughing', category: 'social', desc: 'Genuine laughter' },
      { ageDays: 150, title: 'Sitting Up', category: 'physical', desc: 'Sits with support' },
      { ageDays: 180, title: 'Babbling', category: 'language', desc: 'Consonant sounds' },
      { ageDays: 210, title: 'Crawling', category: 'physical', desc: 'Moves on hands and knees' },
      { ageDays: 270, title: 'First Words', category: 'language', desc: 'Mama or Dada intentionally' },
      { ageDays: 300, title: 'Standing', category: 'physical', desc: 'Pulls to stand' },
      { ageDays: 365, title: 'First Steps', category: 'physical', desc: 'Takes first independent steps' },
    ];
    for (const m of milestoneMap) {
      if (!achievedTitles.has(m.title.toLowerCase()) && ageInDays <= m.ageDays + 30) {
        const daysUntil = m.ageDays - ageInDays;
        const progress = Math.max(0, Math.min(100, ((ageInDays - (m.ageDays - 60)) / 60) * 100));
        upcoming.push({ ...m, daysUntil, progress });
      }
    }
    return upcoming.slice(0, 3);
  }, [baby, milestones]);

  if (predictions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Coming Soon" subtitle="AI-predicted next milestones" />
      <View style={styles.predictionsList}>
        {predictions.map((pred: any, i: number) => {
          const category = MILESTONE_CATEGORIES.find(c => c.id === pred.category);
          return (
            <GlassCard key={i} style={styles.predictionCard} delay={i * 80}>
              <View style={styles.predictionHeader}>
                <View style={[styles.predictionIcon, { backgroundColor: `${category?.color || '#6366f1'}20` }]}>
                  <Ionicons name={category?.icon as any || 'star'} size={20} color={category?.color || '#6366f1'} />
                </View>
                <View style={styles.predictionInfo}>
                  <Text style={styles.predictionTitle}>{pred.title}</Text>
                  <Text style={styles.predictionDesc}>{pred.desc}</Text>
                </View>
                <View style={styles.predictionCountdown}>
                  <Text style={styles.predictionCountdownValue}>{pred.daysUntil > 0 ? pred.daysUntil : 0}</Text>
                  <Text style={styles.predictionCountdownLabel}>days</Text>
                </View>
              </View>
              <View style={styles.predictionBarBg}>
                <View style={[styles.predictionBarFill, { width: `${pred.progress}%`, backgroundColor: category?.color || '#6366f1' }]} />
              </View>
              <Text style={styles.predictionProgressText}>{Math.round(pred.progress)}% ready</Text>
            </GlassCard>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* NEW FEATURE 6: Family Engagement Ring */
const FamilyEngagementRing = React.memo(({ familyMembers, activities }: { familyMembers: FamilyMember[]; activities: any[] }) => {
  const engagementData = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const memberEngagement = familyMembers.map(member => {
      const memberActs = activities.filter((a: any) => { if (a.loggedBy === member.id) return true; if (a.loggedByName === member.fullName) return true; return false; });
      const recentCount = memberActs.filter((a: any) => a.timestamp > weekAgo).length;
      const totalCount = memberActs.length;
      const score = Math.min(100, Math.round((recentCount / 5) * 100 + (totalCount / 20) * 50));
      return { ...member, recentCount, totalCount, score };
    });
    const avgScore = Math.round(memberEngagement.reduce((sum, m) => sum + (m as any).score, 0) / memberEngagement.length) || 0;
    return { members: memberEngagement, avgScore };
  }, [familyMembers, activities]);

  const statusColor = engagementData.avgScore > 70 ? '#10b981' : engagementData.avgScore > 40 ? '#f59e0b' : '#ef4444';
  const statusEmoji = engagementData.avgScore > 70 ? '💚' : engagementData.avgScore > 40 ? '💛' : '❤️';

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader title="Family Engagement" subtitle="Who's been active this week" />
      <GlassCard>
        <View style={styles.engagementContainer}>
          <View style={styles.engagementLeft}>
            <Text style={styles.engagementTitle}>Team Score</Text>
            <Text style={styles.engagementSubtitle}>Family activity level</Text>
            <View style={styles.engagementMetrics}>
              {engagementData.members.slice(0, 3).map((m: any, i: number) => (
                <View key={i} style={styles.engagementMetric}>
                  <Text style={styles.engagementMetricValue}>{m.recentCount}</Text>
                  <Text style={styles.engagementMetricLabel} numberOfLines={1}>{m.fullName?.split(' ')[0] || '?'}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.engagementRingContainer}>
            <View style={styles.engagementRing}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.engagementRingEmoji}>{statusEmoji}</Text>
                <Text style={[styles.engagementRingScore, { color: statusColor }]}>{engagementData.avgScore}</Text>
                <Text style={styles.engagementRingLabel}>Score</Text>
              </View>
              <View style={[styles.engagementRingBg, { borderColor: 'rgba(255,255,255,0.06)' }]} />
              <View style={[styles.engagementRingFill, { borderColor: statusColor, transform: [{ rotate: `${(engagementData.avgScore / 100) * 360}deg` }] }]} />
            </View>
          </View>
        </View>
        <View style={styles.engagementAvatars}>
          {engagementData.members.slice(0, 5).map((member: any, i: number) => (
            <View key={member.id} style={[styles.engagementAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }]}>
              {member.avatar ? (
                <Image source={{ uri: member.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
              ) : (
                <View style={[styles.engagementAvatarFallback, { backgroundColor: member.score > 50 ? '#6366f1' : '#334155' }]}>
                  <Text style={styles.engagementAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>
                </View>
              )}
            </View>
          ))}
          <Text style={styles.engagementAvatarLabel}>{engagementData.members.length} family members</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* MODALS */
const ActionModal = React.memo(({ visible, onClose, title, children }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

/* MAIN SCREEN */
export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId } = route.params || { mode: 'baby' };
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const { babies, updateBaby, currentBaby, currentBabyId, addMilestone, deleteMilestone, loadBabies, switchBaby, deleteBaby, milestones, calculateAge } = useBaby();
  const { entries: allActivities, getEntriesByBaby } = useActivity();
  const { members, loadFamily, parent2, guardians } = useFamily();

  const isBabyMode = mode === 'baby';
  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    if (babyId) return babies.find(b => b.id === babyId) || currentBaby;
    return currentBaby;
  }, [isBabyMode, babyId, babies, currentBaby]);

  const [babyName, setBabyName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedGender, setSelectedGender] = useState('boy');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', category: 'physical' as Milestone['category'], description: '', achievedAt: new Date().toISOString().split('T')[0] });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const headerOpacity = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP), transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolate.CLAMP) }] }));
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  useEffect(() => {
    if (currentBabyData) {
      setBabyName(currentBabyData.name || '');
      setSelectedSkin(typeof currentBabyData.skinTone === 'number' ? currentBabyData.skinTone : 2);
      setSelectedGender(currentBabyData.gender || 'boy');
      setBirthDate(new Date(currentBabyData.birthDate));
      setBabyPhoto(currentBabyData.avatar || null);
      setBloodType(currentBabyData.bloodType || '');
      setAllergies(currentBabyData.allergies?.join(', ') || '');
      setMedicalNotes(currentBabyData.medicalNotes || '');
      setWeight(currentBabyData.weight || '');
      setHeight(currentBabyData.height || '');
      setEmergencyContact(currentBabyData.emergencyContact || '');
      setPediatrician(currentBabyData.pediatrician || '');
      setNotificationsEnabled(currentBabyData.notificationsEnabled !== false);
      setIsEditing(false);
    }
  }, [currentBabyData?.id]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await Promise.all([loadBabies(), loadFamily()]); setRefreshing(false); }, [loadBabies, loadFamily]);

  const getPermanentImagePath = (id: string, isAvatar: boolean = true) => { const dir = FileSystem.documentDirectory + 'baby_images/'; return `${dir}${id}_${isAvatar ? 'avatar' : 'photo'}_${Date.now()}.jpg`; };
  const ensureDirExists = async () => { const dir = FileSystem.documentDirectory + 'baby_images/'; const dirInfo = await FileSystem.getInfoAsync(dir); if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showErrorModal({ title: 'Permission Required', message: 'Please allow camera access.' }); return; }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true); await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri); setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) { setIsUploading(false); showErrorModal({ title: 'Error', message: 'Failed to save photo' }); }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showErrorModal({ title: 'Permission Required', message: 'Please allow photo library access.' }); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true); await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri); setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) { setIsUploading(false); showErrorModal({ title: 'Error', message: 'Failed to save photo' }); }
  };

  const handleEmojiSelect = (emoji: string) => { setBabyPhoto(emoji); setIsEditing(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); showSuccessModal({ title: 'Avatar Updated!', message: 'Emoji avatar saved.' }); };
  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') { ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'], cancelButtonIndex: 0 }, (buttonIndex) => { if (buttonIndex === 1) handleTakePhoto(); else if (buttonIndex === 2) handlePickImage(); else if (buttonIndex === 3) setShowEmojiPicker(true); }); }
    else { showConfirmModal({ title: 'Change Photo', message: 'Choose an option', onConfirm: handlePickImage, onCancel: () => {} }); }
  };

  const recentActivities = useMemo(() => { if (!currentBabyData?.id) return []; return getEntriesByBaby(currentBabyData.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5); }, [allActivities, currentBabyData?.id, getEntriesByBaby]);
  const babyMilestones = useMemo(() => { if (!currentBabyData?.id) return []; return milestones.filter(m => m.babyId === currentBabyData.id).sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()); }, [milestones, currentBabyData?.id]);
  const babyStats = useMemo(() => { if (!currentBabyData) return null; return { streak: currentBabyData.streak || 0, milestones: babyMilestones.length, photos: currentBabyData.photos || 0, entries: recentActivities.length }; }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    if (userProfile) membersList.push({ id: userProfile.id, userId: userProfile.id, fullName: userProfile.fullName, email: userProfile.email, avatar: userProfile.avatar, role: 'parent1', relationship: 'Parent', permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true }, addedAt: currentBabyData?.createdAt || new Date().toISOString(), addedBy: userProfile.id, canBeRemoved: false, phoneNumber: userProfile.phoneNumber, notificationsEnabled: true });
    if (parent2) membersList.push(parent2);
    if (guardians && guardians.length > 0) membersList.push(...guardians);
    return membersList;
  }, [userProfile, parent2, guardians, currentBabyData?.createdAt]);

  const checkForChanges = useCallback(() => {
    if (!currentBabyData) return [];
    const changes: string[] = [];
    if (babyName !== currentBabyData.name) changes.push(`Name: ${babyName}`);
    if (selectedGender !== currentBabyData.gender) changes.push(`Gender: ${GENDER_OPTIONS.find(g => g.value === selectedGender)?.label}`);
    if (babyPhoto !== currentBabyData.avatar) changes.push('Profile Photo');
    if (bloodType !== (currentBabyData.bloodType || '')) changes.push(`Blood Type: ${bloodType}`);
    if (allergies !== (currentBabyData.allergies?.join(', ') || '')) changes.push('Allergies updated');
    if (medicalNotes !== (currentBabyData.medicalNotes || '')) changes.push('Medical Notes updated');
    if (weight !== (currentBabyData.weight || '')) changes.push('Weight updated');
    if (height !== (currentBabyData.height || '')) changes.push('Height updated');
    if (emergencyContact !== (currentBabyData.emergencyContact || '')) changes.push('Emergency Contact updated');
    if (pediatrician !== (currentBabyData.pediatrician || '')) changes.push('Pediatrician updated');
    return changes;
  }, [currentBabyData, babyName, selectedGender, babyPhoto, bloodType, allergies, medicalNotes, weight, height, emergencyContact, pediatrician]);

  const handleSavePress = () => { const changes = checkForChanges(); if (changes.length === 0) { showErrorModal({ title: 'No Changes', message: 'No modifications detected.' }); return; } showConfirmModal({ title: 'Save Changes?', message: `You are about to update:\n${changes.join('\n')}`, onConfirm: handleSave, onCancel: () => {} }); };

  const handleSave = async () => {
    try { if (!currentBabyData) return; setIsSaving(true);
      const babyUpdates: any = { name: babyName, skinTone: selectedSkin, gender: selectedGender, birthDate: birthDate.toISOString(), avatar: babyPhoto, bloodType, allergies: allergies.split(',').map((a: string) => a.trim()).filter(Boolean), medicalNotes, weight, height, emergencyContact, pediatrician, notificationsEnabled, lastUpdated: new Date().toISOString() };
      await updateBaby(currentBabyData.id, babyUpdates); setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Profile Saved!', message: `${babyName}'s profile has been updated.` });
    } catch (error) { showErrorModal({ title: 'Error', message: 'Failed to update profile' }); } finally { setIsSaving(false); }
  };

  const handleAddMilestone = async () => { if (!currentBabyData || !newMilestone.title) return; const success = await addMilestone({ babyId: currentBabyData.id, title: newMilestone.title, category: newMilestone.category, description: newMilestone.description, achievedAt: newMilestone.achievedAt }); if (success) { setShowAddMilestone(false); setNewMilestone({ title: '', category: 'physical', description: '', achievedAt: new Date().toISOString().split('T')[0] }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); showSuccessModal({ title: 'Milestone Recorded!', message: 'Another amazing achievement!' }); } };
  const handleDeleteMilestone = (milestoneId: string) => { showConfirmModal({ title: 'Delete Milestone', message: 'Are you sure?', onConfirm: async () => { await deleteMilestone(milestoneId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); showSuccessModal({ title: 'Deleted', message: 'Milestone removed.' }); } }); };
  const handleDeleteBaby = async () => { showConfirmModal({ title: 'Delete Profile?', message: `This will permanently delete ${currentBabyData?.name}'s profile. This cannot be undone.`, onConfirm: async () => { if (currentBabyData) { await deleteBaby(currentBabyData.id); showSuccessModal({ title: 'Profile Deleted', message: 'Baby profile removed.' }); setTimeout(() => navigation.goBack(), 1500); } } }); };
  const handleSwitchBaby = async (newBabyId: string) => { if (newBabyId === currentBabyId) return; if (isEditing) { showConfirmModal({ title: 'Unsaved Changes', message: 'Switching will discard changes. Continue?', onConfirm: async () => { await switchBaby(newBabyId); setIsEditing(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }); } else { await switchBaby(newBabyId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } };
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { setShowDatePicker(Platform.OS === 'ios'); if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); } };
  const handleTabChange = useCallback((tab: ProfileTab) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, []);

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' },
    { key: 'danger' as ProfileTab, label: 'Danger', icon: 'warning-outline' },
  ];

  const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);

  if (!currentBabyData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontSize: 16, fontWeight: '600' }}>No baby profile found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={styles.bg} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.stickyHeaderCenter}>
            <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={32} />
            <Text style={styles.stickyHeaderTitle} numberOfLines={1}>{currentBabyData?.name || 'Baby Profile'}</Text>
          </View>
          <TouchableOpacity onPress={handleSavePress} style={[styles.saveBtn, (!isEditing || isSaving) && styles.saveBtnDisabled]} disabled={!isEditing || isSaving}>
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1', '#8b5cf6']} />}
      >
        {/* Top Header Row */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[styles.editToggleBtn, isEditing && { backgroundColor: 'rgba(99,102,241,0.3)' }]}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color={isEditing ? '#6366f1' : '#fff'} />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Hero */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
          <TouchableOpacity activeOpacity={0.9} onPress={showPhotoOptions}>
            <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={100} showEditButton onEdit={showPhotoOptions} />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>{currentBabyData.age || calculateAge(currentBabyData.birthDate)} • {genderOption?.label}</Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${medicalNotes || allergies ? '#f59e0b' : '#10b981'}20` }]}>
                <Ionicons name={medicalNotes || allergies ? 'medical-outline' : 'checkmark-circle'} size={12} color={medicalNotes || allergies ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.profileTagText, { color: medicalNotes || allergies ? '#f59e0b' : '#10b981' }]}>{medicalNotes || allergies ? 'Monitor' : 'Healthy'}</Text>
              </View>
              {isEditing && (
                <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <View style={styles.editingDot} />
                  <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* KPI Pills Row */}
        <View style={styles.kpiPillRow}>
          <KpiPill icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#f59e0b" />
          <KpiPill icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#fbbf24" />
          <KpiPill icon="📸" value={babyStats?.photos || 0} label="Photos" color="#8b5cf6" />
        </View>

        {/* Tab Bar */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            <GrowthVelocityTracker baby={currentBabyData} />
            <AIHealthInsights baby={currentBabyData} activities={recentActivities} />
            <ActivitySparkline activities={recentActivities} />
            <NextMilestonePredictor baby={currentBabyData} milestones={babyMilestones} />
            <FamilyEngagementRing familyMembers={familyMembers} activities={recentActivities} />
            <DevelopmentTimeline milestones={babyMilestones} baby={currentBabyData} />

            {/* Family Section */}
            <SectionHeader title="Family" action={() => navigation.navigate('FamilySettings' as never)} actionLabel="Manage" />
            <GlassCard>
              <View style={styles.familyRow}>
                <View style={styles.familyAvatars}>
                  {familyMembers.slice(0, 3).map((member, idx) => (
                    <View key={member.id} style={[styles.familyAvatar, { marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx, backgroundColor: member.avatar ? 'transparent' : '#6366f1' }]}>
                      {member.avatar ? (
                        <Image source={{ uri: member.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                      ) : (
                        <Text style={styles.familyAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>
                      )}
                    </View>
                  ))}
                  {familyMembers.length > 3 && (
                    <View style={[styles.familyAvatar, styles.familyAvatarMore, { marginLeft: -12 }]}>
                      <Text style={styles.familyAvatarMoreText}>+{familyMembers.length - 3}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.familyContent}>
                  <Text style={styles.familyTitle}>{familyMembers.length} Family Members</Text>
                  <Text style={styles.familySubtitle}>Manage access & permissions</Text>
                </View>
              </View>
              {babies.length > 1 && (
                <TouchableOpacity style={styles.switchBabyRow} onPress={() => {}}>
                  <Ionicons name="swap-horizontal" size={18} color="#6366f1" />
                  <Text style={styles.switchBabyText}>Switch Baby Profile</Text>
                </TouchableOpacity>
              )}
            </GlassCard>

            {/* Recent Activity */}
            <SectionHeader title="Recent Activity" action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)} actionLabel="View All" />
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => {
                const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
                return (
                  <GlassCard key={activity.id || index} style={styles.activityItemCard} delay={index * 60}>
                    <View style={styles.activityRow}>
                      <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
                        <Text style={styles.activityEmoji}>{config.emoji}</Text>
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityTitle}>{activity.title || config.label}</Text>
                        <Text style={styles.activityTime}>{format(activity.timestamp, 'MMM d, h:mm a')}</Text>
                        {activity.details && <Text style={styles.activityDetails} numberOfLines={2}>{activity.details}</Text>}
                      </View>
                      <View style={styles.activityArrow}>
                        <Ionicons name="chevron-forward" size={16} color="#6366f1" />
                      </View>
                    </View>
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard style={styles.emptyCard}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="document-text-outline" size={32} color="#6366f1" />
                </View>
                <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
                <Text style={styles.emptyText}>Start tracking daily activities to see them here.</Text>
              </GlassCard>
            )}

            <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)}>
              <Text style={styles.viewAllText}>View Full Timeline</Text>
              <Ionicons name="arrow-forward" size={18} color="#6366f1" />
            </TouchableOpacity>
          </>
        )}

        {/* TAB: MILESTONES */}
        {activeTab === 'milestones' && (
          <>
            <TouchableOpacity style={styles.addMilestoneBtn} onPress={() => setShowAddMilestone(true)}>
              <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.addMilestoneGradient}>
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.addMilestoneText}>Record New Milestone</Text>
              </LinearGradient>
            </TouchableOpacity>

            {babyMilestones.length > 0 ? (
              babyMilestones.map((milestone, index) => {
                const category = MILESTONE_CATEGORIES.find(c => c.id === milestone.category);
                return (
                  <GlassCard key={milestone.id} style={styles.milestoneCard} delay={index * 100}>
                    <View style={styles.milestoneRow}>
                      <View style={[styles.milestoneIcon, { backgroundColor: `${category?.color || '#6366f1'}20` }]}>
                        <Ionicons name={category?.icon as any || 'star'} size={24} color={category?.color || '#6366f1'} />
                      </View>
                      <View style={styles.milestoneContent}>
                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                        <Text style={[styles.milestoneCategory, { color: category?.color || '#6366f1' }]}>{category?.label}</Text>
                        <Text style={styles.milestoneDate}>{format(new Date(milestone.achievedAt), 'MMM d, yyyy')}</Text>
                      </View>
                      <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => handleDeleteMilestone(milestone.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {milestone.description && (
                      <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                    )}
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard style={styles.emptyCard}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="trophy-outline" size={32} color="#f59e0b" />
                </View>
                <Text style={styles.emptyStateTitle}>No Milestones Yet</Text>
                <Text style={styles.emptyText}>Record your baby's first smile, steps, words, and more!</Text>
              </GlassCard>
            )}
          </>
        )}

        {/* TAB: HEALTH */}
        {activeTab === 'health' && (
          <>
            <GlassCard style={styles.formCard} delay={100}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Health Information</Text>
                {!isEditing ? (
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
                    <Ionicons name="create-outline" size={20} color="#6366f1" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editingBadge}>
                    <Text style={styles.editingBadgeText}>Editing</Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Blood Type</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="water-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={bloodType} onChangeText={(text) => { setBloodType(text); setIsEditing(true); }} placeholder="e.g., O+" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Allergies (comma separated)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="warning-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={allergies} onChangeText={(text) => { setAllergies(text); setIsEditing(true); }} placeholder="e.g., Peanuts, Dairy" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="fitness-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={weight} onChangeText={(text) => { setWeight(text); setIsEditing(true); }} placeholder="e.g., 4.2" keyboardType="decimal-pad" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="resize-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={height} onChangeText={(text) => { setHeight(text); setIsEditing(true); }} placeholder="e.g., 58" keyboardType="decimal-pad" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Medical Notes</Text>
                <TextInput style={[styles.textArea, !isEditing && styles.inputDisabled]} value={medicalNotes} onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }} placeholder="Any important medical information..." multiline numberOfLines={4} placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={200}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Emergency & Pediatrician</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emergency Contact</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="call-outline" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={emergencyContact} onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }} placeholder="e.g., +1 (555) 123-4567" keyboardType="phone-pad" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pediatrician</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={pediatrician} onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }} placeholder="Dr. Smith - City Children's Hospital" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={300}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Preferences</Text>
              </View>
              <View style={styles.preferenceRow}>
                <View style={styles.preferenceInfo}>
                  <Ionicons name="notifications-outline" size={22} color="#6366f1" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceTitle}>Notifications</Text>
                    <Text style={styles.preferenceDesc}>Receive milestone & health reminders</Text>
                  </View>
                </View>
                <Switch value={notificationsEnabled} onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }} trackColor={{ false: '#334155', true: '#6366f1' }} thumbColor="#fff" disabled={!isEditing} />
              </View>
            </GlassCard>

            <SectionHeader title="Quick Actions" />
            <GlassCard style={styles.actionCard} delay={400} onPress={() => navigation.navigate('Timeline' as never, { type: 'medication' } as never)}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIconBg, { backgroundColor: '#ef444418' }]}>
                  <Ionicons name="medical-outline" size={26} color="#ef4444" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Medications</Text>
                  <Text style={styles.actionSubtitle}>Track medications & dosages</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#6366f1" />
              </View>
            </GlassCard>

            <GlassCard style={styles.actionCard} delay={500} onPress={() => navigation.navigate('Timeline' as never, { type: 'sleep' } as never)}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIconBg, { backgroundColor: '#3b82f618' }]}>
                  <Ionicons name="moon-outline" size={26} color="#3b82f6" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Sleep Tracking</Text>
                  <Text style={styles.actionSubtitle}>Monitor sleep patterns</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#6366f1" />
              </View>
            </GlassCard>

            <GlassCard style={styles.actionCard} delay={600} onPress={() => navigation.navigate('Timeline' as never, { type: 'feed' } as never)}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIconBg, { backgroundColor: '#f59e0b18' }]}>
                  <Ionicons name="restaurant-outline" size={26} color="#f59e0b" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Feeding Log</Text>
                  <Text style={styles.actionSubtitle}>Record meals & nutrition</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#6366f1" />
              </View>
            </GlassCard>

            <GlassCard style={styles.actionCard} delay={700} onPress={() => navigation.navigate('GrowthDashboard' as never, { babyId: currentBabyData?.id } as never)}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIconBg, { backgroundColor: '#10b98118' }]}>
                  <Ionicons name="trending-up-outline" size={26} color="#10b981" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Growth Charts</Text>
                  <Text style={styles.actionSubtitle}>View detailed growth analytics</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#6366f1" />
              </View>
            </GlassCard>

            {isEditing && (
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.saveButtonGradient}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TAB: DANGER */}
        {activeTab === 'danger' && (
          <>
            <GlassCard style={styles.dangerCard} delay={100}>
              <View style={styles.dangerIconContainer}>
                <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
                  <Ionicons name="warning" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <Text style={styles.dangerDescription}>Permanently delete {currentBabyData?.name}'s profile and all associated data. This cannot be undone.</Text>
              <View style={styles.dangerStats}>
                <View style={styles.dangerStat}>
                  <Ionicons name="images-outline" size={20} color="#94a3b8" />
                  <Text style={styles.dangerStatText}>{babyStats?.photos || 0} Photos</Text>
                </View>
                <View style={styles.dangerStat}>
                  <Ionicons name="trophy-outline" size={20} color="#94a3b8" />
                  <Text style={styles.dangerStatText}>{babyStats?.milestones || 0} Milestones</Text>
                </View>
                <View style={styles.dangerStat}>
                  <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
                  <Text style={styles.dangerStatText}>{babyStats?.entries || 0} Entries</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteBaby}>
                <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteGradient}>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.deleteButtonText}>Delete Baby Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>
            <View style={styles.dangerNote}>
              <Ionicons name="information-circle" size={14} color="#94a3b8" />
              <Text style={styles.dangerNoteText}>Consider exporting data before deletion</Text>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </Animated.ScrollView>

      {/* Modals */}
      <ActionModal visible={showAddMilestone} onClose={() => setShowAddMilestone(false)} title="Record Milestone">
        <View style={styles.modalForm}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="trophy-outline" size={20} color="#6366f1" style={styles.inputIcon} />
              <TextInput style={[styles.inputField, styles.flexInput]} value={newMilestone.title} onChangeText={(text) => setNewMilestone(prev => ({ ...prev, title: text }))} placeholder="e.g., First Steps" placeholderTextColor="#666" selectionColor="#6366f1" />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {MILESTONE_CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.categoryChip, newMilestone.category === cat.id && { backgroundColor: `${cat.color}25`, borderColor: cat.color }]} onPress={() => setNewMilestone(prev => ({ ...prev, category: cat.id as any }))}>
                  <Ionicons name={cat.icon as any} size={16} color={newMilestone.category === cat.id ? cat.color : '#94a3b8'} />
                  <Text style={[styles.categoryChipText, { color: newMilestone.category === cat.id ? cat.color : '#94a3b8' }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput style={styles.textArea} value={newMilestone.description} onChangeText={(text) => setNewMilestone(prev => ({ ...prev, description: text }))} placeholder="Optional details..." multiline numberOfLines={3} placeholderTextColor="#666" selectionColor="#6366f1" />
          </View>
          <TouchableOpacity onPress={handleAddMilestone} style={styles.saveButton}>
            <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Record Milestone</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
          <View style={styles.emojiPickerSheet}>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => { handleEmojiSelect(emoji); setShowEmojiPicker(false); }}>
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {showDatePicker && (
        <DateTimePicker value={birthDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} maximumDate={new Date()} />
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely redesigned to match EditGuardianScreen quality
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  bg: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3, maxWidth: 180 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#6366f1', minWidth: 60, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.35)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#64748b' },

  // ── Top Header ──
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  editToggleBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  // ── Profile Hero ──
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, marginBottom: 20 },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

  // ── Avatar ──
  avatarWrapper: { position: 'relative' },
  avatarGradient: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  avatarEmoji: {},
  editAvatarBtn: { position: 'absolute', width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  editAvatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  // ── KPI Pills ──
  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, ...DESIGN.shadow.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Tab Bar ──
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 16, gap: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Glass Card ──
  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...DESIGN.shadow.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  // ── Velocity Grid ──
  velocityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  velocityCard: { flex: 1, minWidth: '45%', padding: 16 },
  velocityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  velocityEmoji: { fontSize: 20 },
  velocityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  velocityBadgeText: { fontSize: 10, fontWeight: '700' },
  velocityValue: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  velocityLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  velocityBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 10, overflow: 'hidden' },
  velocityBarFill: { height: '100%', borderRadius: 2 },
  velocityPercentile: { fontSize: 10, fontWeight: '700', marginTop: 6 },

  // ── Insights ──
  insightsList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  insightRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  insightIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, marginHorizontal: 12, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#94a3b8' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },

  // ── Sparkline ──
  sparklineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  sparklineChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  // ── Timeline ──
  timelineContainer: { marginHorizontal: 16, gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 11, backgroundColor: 'rgba(255,255,255,0.06)' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', zIndex: 1 },
  timelineCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', marginBottom: 12, ...DESIGN.shadow.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timelineEmoji: { fontSize: 20 },
  timelineMeta: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  timelineDate: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 1 },
  timelineDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', lineHeight: 17 },

  // ── Predictions ──
  predictionsList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  predictionCard: { padding: 16 },
  predictionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  predictionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  predictionInfo: { flex: 1 },
  predictionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  predictionDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  predictionCountdown: { alignItems: 'center' },
  predictionCountdownValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  predictionCountdownLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
  predictionBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  predictionBarFill: { height: '100%', borderRadius: 2 },
  predictionProgressText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 6 },

  // ── Engagement Ring ──
  engagementContainer: { flexDirection: 'row', padding: 16, gap: 16 },
  engagementLeft: { flex: 1, gap: 4 },
  engagementTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  engagementSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginBottom: 8 },
  engagementMetrics: { flexDirection: 'row', gap: 16, marginTop: 4 },
  engagementMetric: { alignItems: 'center', gap: 2 },
  engagementMetricValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  engagementMetricLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  engagementRingContainer: { justifyContent: 'center', alignItems: 'center' },
  engagementRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  engagementRingBg: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.06)' },
  engagementRingFill: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderTopColor: 'transparent', borderRightColor: 'transparent', borderLeftColor: 'transparent' },
  engagementRingEmoji: { fontSize: 16 },
  engagementRingScore: { fontSize: 20, fontWeight: '800' },
  engagementRingLabel: { fontSize: 9, fontWeight: '600', color: '#94a3b8' },
  engagementAvatars: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  engagementAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#1a1a2e' },
  engagementAvatarFallback: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  engagementAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  engagementAvatarLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginLeft: 8 },

  // ── Family ──
  familyRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  familyAvatars: { flexDirection: 'row', marginRight: 16 },
  familyAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1a1a2e', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  familyAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  familyAvatarMore: { backgroundColor: '#64748b', alignItems: 'center', justifyContent: 'center' },
  familyAvatarMoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  familyContent: { flex: 1 },
  familyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 3 },
  familySubtitle: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  switchBabyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 16, marginTop: 8, gap: 8 },
  switchBabyText: { fontSize: 15, fontWeight: '600', color: '#6366f1' },

  // ── Activity ──
  activityItemCard: { padding: 0 },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityEmoji: { fontSize: 20 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  activityTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  activityDetails: { fontSize: 12, color: '#64748b', marginTop: 2 },
  activityArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center' },
  viewAllButton: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  viewAllText: { fontSize: 14, fontWeight: '700', color: '#6366f1' },

  // ── Milestones ──
  addMilestoneBtn: { borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginBottom: 16, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  addMilestoneGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  addMilestoneText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  milestoneCard: { padding: 0, marginBottom: 12 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  milestoneIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 3 },
  milestoneCategory: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', marginBottom: 3 },
  milestoneDate: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  milestoneDescription: { fontSize: 14, color: '#94a3b8', marginTop: 10, lineHeight: 20, fontWeight: '500', paddingHorizontal: 16, paddingBottom: 16 },
  deleteEntryBtn: { padding: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Empty States ──
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // ── Form Card ──
  formCard: { padding: 0, marginBottom: 16 },
  sectionHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  editIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center' },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  editingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  inputGroup: { marginBottom: 16, paddingHorizontal: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  inputDisabled: { opacity: 0.5 },
  inputIcon: { marginRight: 12 },
  inputField: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '600' },
  flexInput: { flex: 1 },
  textArea: { height: 110, textAlignVertical: 'top', paddingTop: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, paddingHorizontal: 18, fontSize: 16, color: '#fff', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },

  // ── Preferences ──
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  preferenceDesc: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── Save Button ──
  saveButton: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Action Cards ──
  actionCard: { padding: 0, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  actionIconBg: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  actionSubtitle: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  // ── Danger Zone ──
  dangerCard: { padding: 24, alignItems: 'center', borderColor: '#ef4444', borderWidth: 2, borderRadius: 24 },
  dangerIconContainer: { marginBottom: 16 },
  dangerIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 24, fontWeight: '800', color: '#ef4444', marginBottom: 8 },
  dangerDescription: { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  dangerStats: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  dangerStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dangerStatText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  deleteButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  deleteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  dangerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  dangerNoteText: { fontSize: 13, color: '#94a3b8' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: DESIGN.radius.xl, padding: DESIGN.spacing.xxl, overflow: 'hidden', ...DESIGN.shadow.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  modalForm: { padding: 8 },

  // ── Category Grid ──
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent', gap: 6 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },

  // ── Emoji Picker ──
  emojiPickerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 200 },
  emojiPickerSheet: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});