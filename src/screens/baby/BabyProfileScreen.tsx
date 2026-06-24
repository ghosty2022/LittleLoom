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
  useColorScheme,
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified system matching Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:') || value.startsWith('ph://') || value.startsWith('assets-library://');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  if (!d) return '—';
  try {
    const date = d instanceof Date ? d : new Date(d);
    return format(date, fmt);
  } catch { return '—'; }
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  try {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return Math.max(0, differenceInMonths(da, db));
  } catch { return 0; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  try {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return differenceInDays(da, db);
  } catch { return 0; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const SKIN_TONES = [
  { color: '#F5D5C5', label: 'Fair' },
  { color: '#E8C4A0', label: 'Light' },
  { color: '#D4A574', label: 'Medium' },
  { color: '#C68642', label: 'Tan' },
  { color: '#8D5524', label: 'Brown' },
  { color: '#5C3A21', label: 'Dark' },
  { color: '#3D2314', label: 'Deep' },
  { color: '#E0AC69', label: 'Olive' },
  { color: '#CD853F', label: 'Bronze' },
  { color: '#A0522D', label: 'Chestnut' },
  { color: '#F4C2C2', label: 'Rose Fair' },
  { color: '#D2691E', label: 'Amber' },
];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#06b6d4', gradient: ['#06b6d4', '#10b981'] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#6366f1' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#ef4444' },
];

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#8b5cf6', emoji: '🚽' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#3b82f6', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#f97316', emoji: '🌟' },
  diaper: { icon: 'layers-outline', color: '#06b6d4', emoji: '🧷' },
  note: { icon: 'document-text-outline', color: '#6b7280', emoji: '📝' },
};

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'overview' | 'milestones' | 'health' | 'danger';

interface HealthInsight {
  id: string;
  type: 'growth' | 'sleep' | 'nutrition' | 'milestone' | 'alert' | 'tip';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
}

interface DevelopmentStage {
  stage: string;
  ageRange: string;
  description: string;
  emoji: string;
  color: string;
  progress: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  delay?: number;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && styles.glassCardActive, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark 
            ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] 
            : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string; 
  isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderText}>
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: { 
  tabs: { key: ProfileTab; label: string; icon: string }[]; 
  activeTab: ProfileTab; 
  onChange: (t: ProfileTab) => void; 
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      const isDanger = tab.key === 'danger';
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { 
              backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : (isDark ? 'rgba(102,126,234,0.25)' : 'rgba(102,126,234,0.12)'),
              ...DESIGN.shadow.sm,
            },
            isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 }
          ]}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={18} 
            color={isActive ? (isDanger ? '#ef4444' : '#6366f1') : (isDark ? '#94a3b8' : '#64748b')} 
          />
          <Text style={[
            styles.tabLabel,
            isActive && (isDanger ? styles.tabLabelDanger : styles.tabLabelActive),
            isDark && !isActive && styles.textMuted
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

const KpiCard = React.memo(({ title, value, unit, change, icon, color, onPress, isDark, size = 'normal' }: any) => {
  const isLarge = size === 'large';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[
      styles.kpiCard,
      isLarge && styles.kpiCardLarge,
      { backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' }
    ]}>
      <LinearGradient colors={[`${color}08`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={styles.kpiInner}>
        <View style={styles.kpiTop}>
          <View style={[styles.kpiIconBg, { backgroundColor: `${color}15` }]}>
            <Text style={styles.kpiIcon}>{icon}</Text>
          </View>
        </View>
        <View style={styles.kpiBody}>
          <Text style={[styles.kpiValue, isDark && styles.textDark, { fontSize: isLarge ? 32 : 24 }]} numberOfLines={1}>
            {value}
            <Text style={[styles.kpiUnit, { color }]}>{unit}</Text>
          </Text>
          <Text style={[styles.kpiTitle, isDark && styles.textMuted]}>{title}</Text>
        </View>
        {change !== undefined && (
          <View style={styles.kpiFooter}>
            <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={12} color={change >= 0 ? '#10b981' : '#ef4444'} />
            <Text style={[styles.kpiChange, { color: change >= 0 ? '#10b981' : '#ef4444' }]}>
              {change > 0 ? '+' : ''}{change}{unit}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const SafeBabyAvatar = React.memo(({ avatar, gender = 'other', size = 72, showEditButton = false, onEdit, isDark }: any) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#6366f1', '#8b5cf6'];

  const imageSource = useMemo(() => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('file://') || avatar.startsWith('ph://') || avatar.startsWith('assets-library://')) {
      return { uri: avatar };
    }
    return null;
  }, [avatar]);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size * 0.33 }]}
      >
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


/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI Development Stage Tracker
   ═══════════════════════════════════════════════════════════════════════════ */

const DevelopmentStageTracker = React.memo(({ baby, isDark }: { baby: any; isDark: boolean }) => {
  const ageMonths = safeDiffMonths(new Date(), baby?.birthDate);

  const stages = useMemo((): DevelopmentStage[] => {
    const allStages: DevelopmentStage[] = [
      { stage: 'Newborn', ageRange: '0-1 month', description: 'Reflexes, feeding, bonding', emoji: '👶', color: '#6366f1', progress: 100 },
      { stage: 'Infant', ageRange: '1-6 months', description: 'Head control, smiling, cooing', emoji: '😊', color: '#ec4899', progress: 100 },
      { stage: 'Sitter', ageRange: '6-9 months', description: 'Sitting, babbling, grasping', emoji: '🪑', color: '#f59e0b', progress: 0 },
      { stage: 'Crawler', ageRange: '9-12 months', description: 'Crawling, first words, waving', emoji: '🐛', color: '#10b981', progress: 0 },
      { stage: 'Toddler', ageRange: '12-24 months', description: 'Walking, talking, independence', emoji: '🚶', color: '#06b6d4', progress: 0 },
      { stage: 'Preschooler', ageRange: '2-4 years', description: 'Running, sentences, imagination', emoji: '🏃', color: '#8b5cf6', progress: 0 },
    ];

    return allStages.map((s, i) => {
      const [minAge] = s.ageRange.split('-').map(x => parseInt(x));
      let progress = 0;
      if (ageMonths >= minAge) {
        const nextStage = allStages[i + 1];
        const nextMin = nextStage ? parseInt(nextStage.ageRange.split('-')[0]) : minAge + 12;
        progress = Math.min(100, ((ageMonths - minAge) / (nextMin - minAge)) * 100);
      }
      return { ...s, progress };
    });
  }, [ageMonths]);

  const currentStage = stages.find(s => s.progress > 0 && s.progress < 100) || stages.filter(s => s.progress === 100).pop() || stages[0];

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <GlassCard>
        <View style={styles.stageHeader}>
          <View style={[styles.stageIconBg, { backgroundColor: `${currentStage.color}15` }]}>
            <Text style={styles.stageEmoji}>{currentStage.emoji}</Text>
          </View>
          <View style={styles.stageTitleWrap}>
            <Text style={[styles.stageTitle, isDark && styles.textDark]}>{currentStage.stage} Stage</Text>
            <Text style={[styles.stageSubtitle, isDark && styles.textMuted]}>{currentStage.description}</Text>
          </View>
          <View style={[styles.stageBadge, { backgroundColor: `${currentStage.color}15` }]}>
            <Text style={[styles.stageBadgeText, { color: currentStage.color }]}>{Math.round(currentStage.progress)}%</Text>
          </View>
        </View>

        <View style={styles.stageProgressBar}>
          <View style={[styles.stageProgressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={[styles.stageProgressFill, { width: `${currentStage.progress}%`, backgroundColor: currentStage.color }]} />
          </View>
        </View>

        <View style={styles.stageTimeline}>
          {stages.slice(0, 4).map((stage, i) => (
            <View key={i} style={styles.stageTimelineItem}>
              <View style={[styles.stageDot, { 
                backgroundColor: stage.progress === 100 ? stage.color : stage.progress > 0 ? `${stage.color}50` : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                borderColor: stage.progress > 0 ? stage.color : 'transparent',
              }]} />
              <Text style={[styles.stageTimelineLabel, isDark && styles.textMuted, stage.progress > 0 && { color: stage.color, fontWeight: '700' }]}>
                {stage.stage}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Smart Health Insights Engine
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartHealthInsights = React.memo(({ baby, stats, recentActivities, isDark }: { baby: any; stats: any; recentActivities: any[]; isDark: boolean }) => {
  const insights = useMemo((): HealthInsight[] => {
    const items: HealthInsight[] = [];
    const ageMonths = safeDiffMonths(new Date(), baby?.birthDate);

    if (stats?.height?.change) {
      const change = parseFloat(stats.height.change);
      items.push({
        id: 'growth-velocity',
        type: 'growth',
        title: change > 0 ? 'Growing Strong!' : 'Growth Check Needed',
        description: change > 0 
          ? `Height increased by ${change}cm since last measurement.` 
          : 'Height decreased. Please verify the measurement.',
        emoji: change > 0 ? '📈' : '⚠️',
        color: change > 0 ? '#10b981' : '#ef4444',
        priority: change > 0 ? 'low' : 'high',
      });
    }

    const lastActivity = recentActivities[0];
    if (lastActivity) {
      const daysSince = safeDiffDays(new Date(), new Date(lastActivity.timestamp));
      if (daysSince > 2) {
        items.push({
          id: 'activity-streak',
          type: 'tip',
          title: 'Keep the Streak Alive!',
          description: `No activity logged in ${daysSince} days. Log something to maintain tracking.`,
          emoji: '🔥',
          color: '#f59e0b',
          priority: 'medium',
          action: { label: 'Log Now', screen: 'AddEntry', params: {} },
        });
      }
    }

    const milestoneTips: Record<number, { title: string; desc: string; emoji: string }> = {
      0: { title: 'Tummy Time', desc: 'Start with 3-5 minutes of supervised tummy time daily.', emoji: '👶' },
      3: { title: 'Reach & Grasp', desc: 'Place toys within reach to encourage hand-eye coordination.', emoji: '👋' },
      6: { title: 'Sitting Practice', desc: 'Support baby in sitting position to strengthen core.', emoji: '🪑' },
      9: { title: 'Crawl Space', desc: 'Create a safe crawling area with interesting toys.', emoji: '🐛' },
      12: { title: 'First Words', desc: 'Read books and talk to baby to encourage language.', emoji: '🗣️' },
    };

    const tipKey = Object.keys(milestoneTips).map(Number).filter(k => k <= ageMonths).pop();
    if (tipKey !== undefined) {
      const tip = milestoneTips[tipKey];
      items.push({
        id: 'milestone-tip',
        type: 'tip',
        title: tip.title,
        description: tip.desc,
        emoji: tip.emoji,
        color: '#6366f1',
        priority: 'low',
      });
    }

    if (stats?.bmi?.status?.label === 'Underweight' || stats?.bmi?.status?.label === 'Overweight') {
      items.push({
        id: 'bmi-alert',
        type: 'alert',
        title: `BMI: ${stats.bmi.status.label}`,
        description: `Current BMI is ${stats.bmi.value}. Consider consulting your pediatrician.`,
        emoji: '🩺',
        color: '#ef4444',
        priority: 'high',
      });
    }

    return items.slice(0, 3);
  }, [baby, stats, recentActivities]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="Smart Insights" subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`} isDark={isDark} />
      {insights.map((insight, i) => (
        <GlassCard key={insight.id} style={[styles.insightCard, insight.priority === 'high' && { borderLeftWidth: 3, borderLeftColor: insight.color }]} delay={i * 60}>
          <View style={styles.insightRow}>
            <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
              <Text style={styles.insightEmoji}>{insight.emoji}</Text>
            </View>
            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <Text style={[styles.insightTitle, isDark && styles.textDark]} numberOfLines={1}>{insight.title}</Text>
                <View style={[styles.insightPriorityBadge, { backgroundColor: `${insight.color}15` }]}>
                  <View style={[styles.insightPriorityDot, { backgroundColor: insight.color }]} />
                  <Text style={[styles.insightPriorityText, { color: insight.color }]}>{insight.priority}</Text>
                </View>
              </View>
              <Text style={[styles.insightDesc, isDark && styles.textMuted]} numberOfLines={2}>{insight.description}</Text>
              {insight.action && (
                <View style={[styles.insightActionBadge, { backgroundColor: '#6366f115' }]}>
                  <Text style={styles.insightActionText}>{insight.action.label} →</Text>
                </View>
              )}
            </View>
          </View>
        </GlassCard>
      ))}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Weekly Activity Pattern Radar
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklyPatternRadar = React.memo(({ activities, isDark }: { activities: any[]; isDark: boolean }) => {
  const weekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);

    activities.forEach(a => {
      try {
        const day = new Date(a.timestamp).getDay();
        counts[day]++;
      } catch {}
    });

    const maxCount = Math.max(...counts, 1);
    return days.map((day, i) => ({ day, count: counts[i], height: (counts[i] / maxCount) * 100 }));
  }, [activities]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Weekly Activity" subtitle="Your tracking patterns" isDark={isDark} />
      <GlassCard>
        <View style={styles.weeklyRadar}>
          {weekData.map((d, i) => (
            <View key={i} style={styles.weeklyDay}>
              <View style={styles.weeklyBarWrap}>
                <View style={[styles.weeklyBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.weeklyBarFill, { height: `${d.height}%`, backgroundColor: d.count > 0 ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }]} />
                </View>
              </View>
              <Text style={[styles.weeklyDayLabel, isDark && styles.textMuted, d.count > 0 && { color: '#6366f1', fontWeight: '700' }]}>
                {d.day}
              </Text>
              <Text style={[styles.weeklyCount, isDark && styles.textMuted]}>{d.count}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Family Connection Hub
   ═══════════════════════════════════════════════════════════════════════════ */

const FamilyConnectionHub = React.memo(({ members, isDark, onManage }: { members: FamilyMember[]; isDark: boolean; onManage: () => void }) => {
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Family" subtitle={`${members.length} connected`} action={onManage} actionLabel="Manage" isDark={isDark} />
      <GlassCard onPress={onManage}>
        <View style={styles.familyHubRow}>
          <View style={styles.familyHubAvatars}>
            {members.slice(0, 4).map((member, idx) => (
              <View key={member.id} style={[styles.familyHubAvatar, { 
                marginLeft: idx > 0 ? -10 : 0, 
                zIndex: 4 - idx,
                backgroundColor: member.avatar ? 'transparent' : '#6366f1',
                borderColor: isDark ? '#1a1a2e' : '#fff',
              }]}>
                {member.avatar ? (
                  <Image source={{ uri: member.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <Text style={styles.familyHubAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>
                )}
              </View>
            ))}
            {members.length > 4 && (
              <View style={[styles.familyHubAvatar, styles.familyHubAvatarMore, { marginLeft: -10, borderColor: isDark ? '#1a1a2e' : '#fff' }]}>
                <Text style={styles.familyHubAvatarMoreText}>+{members.length - 4}</Text>
              </View>
            )}
          </View>
          <View style={styles.familyHubContent}>
            <Text style={[styles.familyHubTitle, isDark && styles.textDark]}>Family Members</Text>
            <Text style={[styles.familyHubSubtitle, isDark && styles.textMuted]}>Tap to manage access</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6366f1" />
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Quick Action Dock
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionDock = React.memo(({ onAction, isDark }: { onAction: (screen: string, params?: any) => void; isDark: boolean }) => {
  const actions = [
    { icon: '📏', label: 'Measure', screen: 'GrowthDashboard', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] },
    { icon: '🍼', label: 'Feed', screen: 'AddEntry', params: { type: 'feed' }, color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
    { icon: '😴', label: 'Sleep', screen: 'AddEntry', params: { type: 'sleep' }, color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'] },
    { icon: '💊', label: 'Med', screen: 'AddEntry', params: { type: 'medication' }, color: '#ef4444', gradient: ['#ef4444', '#f87171'] },
    { icon: '🌟', label: 'Milestone', screen: 'AddEntry', params: { type: 'milestone' }, color: '#10b981', gradient: ['#10b981', '#34d399'] },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Quick Actions" isDark={isDark} />
      <View style={styles.quickDock}>
        {actions.map((action, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => onAction(action.screen, action.params)} 
            style={styles.quickDockItem}
            activeOpacity={0.8}
          >
            <LinearGradient colors={action.gradient as [string, string]} style={styles.quickDockGradient}>
              <Text style={styles.quickDockIcon}>{action.icon}</Text>
            </LinearGradient>
            <Text style={[styles.quickDockLabel, isDark && styles.textMuted]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: Next Milestone Countdown
   ═══════════════════════════════════════════════════════════════════════════ */

const NextMilestoneCountdown = React.memo(({ baby, milestones, isDark }: { baby: any; milestones: any[]; isDark: boolean }) => {
  const ageMonths = safeDiffMonths(new Date(), baby?.birthDate);

  const nextMilestone = useMemo(() => {
    const achieved = new Set(milestones.map(m => m.title?.toLowerCase()));
    const allMilestones = [
      { title: 'Rolling Over', typicalAge: 4, emoji: '🔄', category: 'Physical' },
      { title: 'Sitting Up', typicalAge: 6, emoji: '🪑', category: 'Physical' },
      { title: 'Crawling', typicalAge: 9, emoji: '🐛', category: 'Physical' },
      { title: 'First Steps', typicalAge: 12, emoji: '👣', category: 'Physical' },
      { title: 'First Words', typicalAge: 12, emoji: '🗣️', category: 'Cognitive' },
      { title: 'Waving Bye', typicalAge: 9, emoji: '👋', category: 'Social' },
      { title: 'Clapping', typicalAge: 9, emoji: '👏', category: 'Social' },
      { title: 'Pointing', typicalAge: 12, emoji: '👉', category: 'Cognitive' },
    ];

    return allMilestones.find(m => !achieved.has(m.title.toLowerCase()) && m.typicalAge >= ageMonths) || null;
  }, [milestones, ageMonths]);

  if (!nextMilestone) return null;

  const monthsUntil = nextMilestone.typicalAge - ageMonths;

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <GlassCard>
        <View style={styles.countdownRow}>
          <View style={[styles.countdownIconBg, { backgroundColor: '#6366f115' }]}>
            <Text style={styles.countdownEmoji}>{nextMilestone.emoji}</Text>
          </View>
          <View style={styles.countdownContent}>
            <Text style={[styles.countdownTitle, isDark && styles.textDark]}>Next: {nextMilestone.title}</Text>
            <Text style={[styles.countdownSubtitle, isDark && styles.textMuted]}>{nextMilestone.category} • Expected around {nextMilestone.typicalAge} months</Text>
          </View>
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownBadgeValue}>{monthsUntil}</Text>
            <Text style={styles.countdownBadgeLabel}>mo</Text>
          </View>
        </View>
        <View style={styles.countdownProgress}>
          <View style={[styles.countdownProgressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={[styles.countdownProgressFill, { 
              width: `${Math.max(0, Math.min(100, (ageMonths / nextMilestone.typicalAge) * 100))}%`,
              backgroundColor: '#6366f1' 
            }]} />
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   EMOJI PICKER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

const EmojiPickerModal = React.memo(({ visible, onClose, onSelect, isDark }: { visible: boolean; onClose: () => void; onSelect: (emoji: string) => void; isDark: boolean }) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
          <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={onClose} style={styles.emojiPickerClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiButton}
                onPress={() => { onSelect(emoji); onClose(); }}
              >
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId } = route.params || { mode: 'baby' };
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const {
    babies, updateBaby, currentBaby, currentBabyId, addMilestone, deleteMilestone,
    loadBabies, switchBaby, deleteBaby, milestones, calculateAge,
  } = useBaby();
  const { entries: allActivities, getEntriesByBaby } = useActivity();
  const { members, loadFamily, parent2, guardians } = useFamily();

  const isBabyMode = mode === 'baby';
  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    if (babyId) return babies.find(b => b.id === babyId) || currentBaby;
    return currentBaby;
  }, [isBabyMode, babyId, babies, currentBaby]);

  // ── State ──
  const [babyName, setBabyName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedGender, setSelectedGender] = useState('boy');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Medical & Extended Fields
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  // Animated header values
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolate.CLAMP),
  }));

  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));

  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP),
    }],
  }));

  // ── Init Data ──
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBabies(), loadFamily()]);
    setRefreshing(false);
  }, [loadBabies, loadFamily]);

  // ── Image Handling ──
  const getPermanentImagePath = (babyId: string, isAvatar: boolean = true) => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    return `${dir}${babyId}_${isAvatar ? 'avatar' : 'photo'}_${Date.now()}.jpg`;
  };

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showErrorModal({ title: 'Permission Required', message: 'Please allow access to your camera.' });
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) {
      setIsUploading(false);
      showErrorModal({ title: 'Error', message: 'Failed to save photo' });
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showErrorModal({ title: 'Permission Required', message: 'Please allow access to your photo library.' });
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) {
      setIsUploading(false);
      showErrorModal({ title: 'Error', message: 'Failed to save photo' });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal({ title: 'Avatar Updated!', message: 'Emoji avatar saved.' });
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handlePickImage();
          else if (buttonIndex === 3) setShowEmojiPicker(true);
        }
      );
    } else {
      showConfirmModal({ title: 'Change Photo', message: 'Choose an option', onConfirm: () => handlePickImage(), onCancel: () => {} });
    }
  };

  // ── Derived Data ──
  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return getEntriesByBaby(currentBabyData.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [allActivities, currentBabyData?.id, getEntriesByBaby]);

  const babyMilestones = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return milestones.filter(m => m.babyId === currentBabyData.id).sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [milestones, currentBabyData?.id]);

  const babyStats = useMemo(() => {
    if (!currentBabyData) return null;
    return { 
      streak: currentBabyData.streak || 0, 
      milestones: babyMilestones.length, 
      photos: currentBabyData.photos || 0, 
      entries: recentActivities.length 
    };
  }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    if (userProfile) {
      membersList.push({ 
        id: userProfile.id, 
        userId: userProfile.id, 
        fullName: userProfile.fullName, 
        email: userProfile.email, 
        avatar: userProfile.avatar, 
        role: 'parent1', 
        relationship: 'Parent', 
        permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true }, 
        addedAt: currentBabyData?.createdAt || new Date().toISOString(), 
        addedBy: userProfile.id, 
        canBeRemoved: false, 
        phoneNumber: userProfile.phoneNumber, 
        notificationsEnabled: true 
      });
    }
    if (parent2) membersList.push(parent2);
    if (guardians && guardians.length > 0) membersList.push(...guardians);
    return membersList;
  }, [userProfile, parent2, guardians, currentBabyData?.createdAt]);

  // ── Change Detection & Save ──
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

  const handleSavePress = () => {
    const changes = checkForChanges();
    if (changes.length === 0) {
      showErrorModal({ title: 'No Changes', message: 'No modifications detected.' });
      return;
    }
    showConfirmModal({
      title: 'Save Changes?',
      message: `You are about to update:\n${changes.join('\n')}`,
      onConfirm: handleSave,
      onCancel: () => {},
    });
  };

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;
      setIsSaving(true);
      const babyUpdates: any = {
        name: babyName,
        skinTone: selectedSkin,
        gender: selectedGender,
        birthDate: birthDate.toISOString(),
        avatar: babyPhoto,
        bloodType,
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
        medicalNotes,
        weight,
        height,
        emergencyContact,
        pediatrician,
        notificationsEnabled,
        lastUpdated: new Date().toISOString(),
      };
      await updateBaby(currentBabyData.id, babyUpdates);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Profile Saved!', message: `${babyName}'s profile has been updated successfully.` });
    } catch (error) {
      showErrorModal({ title: 'Error', message: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Milestones ──
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '', category: 'physical' as Milestone['category'], description: '', achievedAt: new Date().toISOString().split('T')[0],
  });

  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;
    const success = await addMilestone({ 
      babyId: currentBabyData.id, 
      title: newMilestone.title, 
      category: newMilestone.category, 
      description: newMilestone.description, 
      achievedAt: newMilestone.achievedAt 
    });
    if (success) {
      setShowAddMilestone(false);
      setNewMilestone({ title: '', category: 'physical', description: '', achievedAt: new Date().toISOString().split('T')[0] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Milestone Recorded!', message: 'Another amazing achievement!' });
    }
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    showConfirmModal({
      title: 'Delete Milestone',
      message: 'Are you sure you want to delete this milestone?',
      onConfirm: async () => {
        await deleteMilestone(milestoneId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showSuccessModal({ title: 'Deleted', message: 'Milestone has been removed.' });
      },
    });
  };

  const handleDeleteBaby = async () => {
    showConfirmModal({
      title: 'Delete Profile?',
      message: `This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`,
      onConfirm: async () => {
        if (currentBabyData) {
          await deleteBaby(currentBabyData.id);
          showSuccessModal({ title: 'Profile Deleted', message: 'Baby profile has been removed.' });
          setTimeout(() => navigation.goBack(), 1500);
        }
      },
    });
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); }
  };

  // ── Scroll Handler ──
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // ── Tab Change ──
  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Quick Action Handler ──
  const handleQuickAction = useCallback((screen: string, params?: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen as never, params as never);
  }, [navigation]);

  // ── Render Sections ──
  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' },
    { key: 'danger' as ProfileTab, label: 'Danger', icon: 'warning-outline' },
  ];

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={32} isDark={isDark} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>
            {currentBabyData?.name || 'Baby Profile'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSavePress}
          style={[styles.saveBtn, (!isEditing || isSaving) && styles.saveBtnDisabled]}
          disabled={!isEditing || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!currentBabyData) return null;
    const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
    const ageMonths = safeDiffMonths(new Date(), currentBabyData.birthDate);

    return (
      <Animated.View entering={FadeInDown.springify()} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <SafeBabyAvatar 
              avatar={babyPhoto} 
              gender={selectedGender} 
              size={90} 
              showEditButton 
              onEdit={showPhotoOptions} 
              isDark={isDark}
            />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>
              {ageMonths} months • {genderOption?.label}
            </Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${medicalNotes || allergies ? '#f59e0b' : '#10b981'}18` }]}>
                <Ionicons name={medicalNotes || allergies ? 'medical-outline' : 'checkmark-circle'} size={12} color={medicalNotes || allergies ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.profileTagText, { color: medicalNotes || allergies ? '#f59e0b' : '#10b981' }]}>
                  {medicalNotes || allergies ? 'Monitor' : 'Healthy'}
                </Text>
              </View>
              {isEditing && (
                <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <View style={styles.editingDot} />
                  <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderOverview = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {/* ── KPI GRID (2x2) ── */}
      <View style={styles.kpiGrid}>
        {[
          { key: 'streak', title: 'Day Streak', icon: '🔥', color: '#ec4899', value: babyStats?.streak || 0, unit: '' },
          { key: 'milestones', title: 'Milestones', icon: '🌟', color: '#f59e0b', value: babyStats?.milestones || 0, unit: '' },
          { key: 'photos', title: 'Photos', icon: '📸', color: '#8b5cf6', value: babyStats?.photos || 0, unit: '' },
          { key: 'entries', title: 'Entries', icon: '📝', color: '#6366f1', value: babyStats?.entries || 0, unit: '' },
        ].map((stat, i) => (
          <Animated.View key={stat.key} entering={FadeInUp.delay(100 + i * 80).springify()} style={styles.kpiGridItem}>
            <KpiCard
              title={stat.title}
              value={stat.value}
              unit={stat.unit}
              icon={stat.icon}
              color={stat.color}
              isDark={isDark}
              size="normal"
            />
          </Animated.View>
        ))}
      </View>

      {/* ── NEW FEATURE 1: Development Stage Tracker ── */}
      {currentBabyData && <DevelopmentStageTracker baby={currentBabyData} isDark={isDark} />}

      {/* ── NEW FEATURE 6: Next Milestone Countdown ── */}
      {currentBabyData && <NextMilestoneCountdown baby={currentBabyData} milestones={babyMilestones} isDark={isDark} />}

      {/* ── NEW FEATURE 2: Smart Health Insights ── */}
      {currentBabyData && (
        <SmartHealthInsights 
          baby={currentBabyData} 
          stats={babyStats} 
          recentActivities={recentActivities} 
          isDark={isDark} 
        />
      )}

      {/* ── NEW FEATURE 3: Weekly Activity Pattern ── */}
      <WeeklyPatternRadar activities={recentActivities} isDark={isDark} />

      {/* ── NEW FEATURE 4: Family Connection Hub ── */}
      <FamilyConnectionHub 
        members={familyMembers} 
        isDark={isDark} 
        onManage={() => navigation.navigate('FamilySettings' as never)} 
      />

      {/* ── NEW FEATURE 5: Quick Action Dock ── */}
      <QuickActionDock onAction={handleQuickAction} isDark={isDark} />

      {/* ── Recent Activity ── */}
      <SectionHeader 
        title="Recent Activity" 
        action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)}
        actionLabel="View All"
        isDark={isDark}
      />

      {recentActivities.length > 0 ? (
        recentActivities.map((activity, index) => {
          const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
          return (
            <GlassCard key={activity.id || index} style={styles.activityItemCard} delay={400 + index * 50}>
              <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
                <Text style={styles.activityEmoji}>{config.emoji}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]}>{activity.title || activity.type}</Text>
                <Text style={styles.activityTime}>
                  {format(activity.timestamp, 'MMM d, h:mm a')}
                </Text>
                {activity.details && (
                  <Text style={styles.activityDetails}>{activity.details}</Text>
                )}
              </View>
              <View style={styles.activityArrow}>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#6366f1' : '#8b5cf6'} />
              </View>
            </GlassCard>
          );
        })
      ) : (
        <GlassCard style={styles.emptyCard} delay={400}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color="#6366f1" />
          </View>
          <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
          <Text style={styles.emptyText}>Start tracking your baby's daily activities to see them here.</Text>
        </GlassCard>
      )}
    </Animated.View>
  );

  const renderMilestones = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
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
                  <Text style={[styles.milestoneTitle, isDark && styles.textDark]}>{milestone.title}</Text>
                  <Text style={[styles.milestoneCategory, { color: category?.color || '#6366f1' }]}>{category?.label}</Text>
                  <Text style={styles.milestoneDate}>
                    {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
                  </Text>
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
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="trophy-outline" size={32} color="#f59e0b" />
          </View>
          <Text style={styles.emptyStateTitle}>No Milestones Yet</Text>
          <Text style={styles.emptyText}>Record your baby's first smile, steps, words, and more!</Text>
        </GlassCard>
      )}
    </Animated.View>
  );

  const renderHealthForm = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.formCard} delay={100}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Health Information</Text>
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
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Blood Type</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="water-outline" size={20} color="#6366f1" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={bloodType}
              onChangeText={(text) => { setBloodType(text); setIsEditing(true); }}
              placeholder="e.g., O+"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Allergies (comma separated)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="warning-outline" size={20} color="#6366f1" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={allergies}
              onChangeText={(text) => { setAllergies(text); setIsEditing(true); }}
              placeholder="e.g., Peanuts, Dairy"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Weight (kg)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="fitness-outline" size={20} color="#6366f1" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={weight}
              onChangeText={(text) => { setWeight(text); setIsEditing(true); }}
              placeholder="e.g., 4.2"
              keyboardType="decimal-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Height (cm)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="resize-outline" size={20} color="#6366f1" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={height}
              onChangeText={(text) => { setHeight(text); setIsEditing(true); }}
              placeholder="e.g., 58"
              keyboardType="decimal-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Medical Notes</Text>
          <TextInput
            style={[styles.textArea, isDark && styles.textAreaDark, !isEditing && styles.inputDisabled]}
            value={medicalNotes}
            onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }}
            placeholder="Any important medical information..."
            multiline
            numberOfLines={4}
            placeholderTextColor={isDark ? '#666' : '#999'}
            editable={isEditing}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.formCard} delay={200}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Emergency & Pediatrician</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Emergency Contact</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="call-outline" size={20} color="#ef4444" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={emergencyContact}
              onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }}
              placeholder="e.g., +1 (555) 123-4567"
              keyboardType="phone-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Pediatrician</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={pediatrician}
              onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }}
              placeholder="Dr. Smith - City Children's Hospital"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.formCard} delay={300}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Preferences</Text>
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="notifications-outline" size={22} color="#6366f1" />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Receive milestone & health reminders</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }}
            trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
            thumbColor="#fff"
            disabled={!isEditing}
          />
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderDangerZone = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.dangerCard} delay={100}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
            <Ionicons name="warning" size={32} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDescription}>
          Permanently delete {currentBabyData?.name}'s profile and all associated data. 
          This action cannot be undone.
        </Text>

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
    </Animated.View>
  );

  // ── Main Render ──
  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />

      {renderStickyHeader()}

      <AutoHideAnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}

        <View style={styles.tabBarContainer}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'milestones' && renderMilestones()}
          {activeTab === 'health' && renderHealthForm()}
          {activeTab === 'danger' && renderDangerZone()}
        </View>
      </AutoHideAnimatedScrollView>

      <EmojiPickerModal 
        visible={showEmojiPicker} 
        onClose={() => setShowEmojiPicker(false)} 
        onSelect={handleEmojiSelect}
        isDark={isDark}
      />
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned to match Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
    maxWidth: 180,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(100,116,139,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  saveBtnTextDisabled: {
    color: '#64748b',
  },

  // ── Profile Hero ──
  profileHero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarSection: {
    position: 'relative',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  profileMeta: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  profileTags: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  profileTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  editToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tab Bar ──
  tabBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBarDark: {
    backgroundColor: 'rgba(30,30,40,0.8)',
  },
  tabItem: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
  tabLabelDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassCardActive: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Avatar ──
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarEmoji: {},
  editAvatarBtn: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editAvatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── KPI Grid ──
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiGridItem: {
    width: (SCREEN_W - 56) / 2,
    height: 120,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    ...DESIGN.shadow.md,
  },
  kpiCardLarge: {
    padding: 16,
  },
  kpiInner: { flex: 1, justifyContent: 'space-between' },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiIcon: { fontSize: 18 },
  kpiBody: { gap: 2, marginTop: 8 },
  kpiValue: { fontWeight: '800', letterSpacing: -0.5, color: '#1e293b' },
  kpiUnit: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  kpiTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' },
  kpiFooter: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiChange: { fontSize: 12, fontWeight: '700' },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderText: { gap: 2 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  // ── Insight Card ──
  insightCard: {
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    ...DESIGN.shadow.sm,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#64748b' },
  insightPriorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  insightPriorityDot: { width: 6, height: 6, borderRadius: 3 },
  insightPriorityText: { fontSize: 10, fontWeight: '700' },
  insightActionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  insightActionText: { fontSize: 11, fontWeight: '700', color: '#6366f1' },

  // ── Development Stage Tracker ──
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  stageIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageEmoji: { fontSize: 22 },
  stageTitleWrap: { flex: 1 },
  stageTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  stageSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  stageBadgeText: { fontSize: 12, fontWeight: '800' },
  stageProgressBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stageProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stageProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stageTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stageTimelineItem: {
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  stageTimelineLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },

  // ── Weekly Pattern Radar ──
  weeklyRadar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 16,
    gap: 8,
  },
  weeklyDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  weeklyBarWrap: {
    height: 80,
    justifyContent: 'flex-end',
  },
  weeklyBarBg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weeklyBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  weeklyDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  weeklyCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },

  // ── Family Hub ──
  familyHubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  familyHubAvatars: {
    flexDirection: 'row',
  },
  familyHubAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  familyHubAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  familyHubAvatarMore: {
    backgroundColor: '#64748b',
  },
  familyHubAvatarMoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  familyHubContent: { flex: 1 },
  familyHubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  familyHubSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },

  // ── Quick Action Dock ──
  quickDock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  quickDockItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickDockGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...DESIGN.shadow.md,
  },
  quickDockIcon: { fontSize: 24 },
  quickDockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  // ── Next Milestone Countdown ──
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 8,
  },
  countdownIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownEmoji: { fontSize: 22 },
  countdownContent: { flex: 1 },
  countdownTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  countdownSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 1 },
  countdownBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  countdownBadgeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  countdownBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  countdownProgress: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  countdownProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  countdownProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Activity ──
  activityItemCard: {
    marginVertical: 6,
    padding: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityEmoji: { fontSize: 24 },
  activityContent: { flex: 1 },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  activityDetails: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activityArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty States ──
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },

  // ── Milestones ──
  addMilestoneBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addMilestoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  addMilestoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  milestoneCard: {
    padding: 0,
    marginBottom: 12,
    borderRadius: 20,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  milestoneIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  milestoneContent: { flex: 1 },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 3,
  },
  milestoneCategory: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 3,
  },
  milestoneDate: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  deleteEntryBtn: {
    padding: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Form Card ──
  formCard: {
    padding: 0,
    marginBottom: 16,
  },
  sectionHeaderWithEdit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editingBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  inputGroup: { marginBottom: 20, paddingHorizontal: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputDisabled: { opacity: 0.6 },
  inputIcon: { marginRight: 14 },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '600',
  },
  inputDark: { color: '#ffffff' },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
    paddingTop: 18,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    paddingHorizontal: 18,
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  textAreaDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.06)',
  },

  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  preferenceText: { gap: 2 },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  preferenceDesc: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },

  // ── Danger Zone ──
  dangerCard: {
    padding: 24,
    alignItems: 'center',
    borderColor: '#ef4444',
    borderWidth: 2,
    borderRadius: 24,
  },
  dangerIconContainer: { marginBottom: 16 },
  dangerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  dangerStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  dangerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dangerStatText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  deleteButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  dangerNoteText: {
    fontSize: 13,
    color: '#94a3b8',
  },

  // ── Tab Panel ──
  tabPanel: { marginTop: 4, gap: 16 },

  // ── Emoji Picker ──
  emojiPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  emojiPickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  emojiPickerSheetDark: {
    backgroundColor: '#1a1a2e',
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiPickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  emojiPickerClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  emojiButton: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(100,116,139,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: { fontSize: 32 },
});