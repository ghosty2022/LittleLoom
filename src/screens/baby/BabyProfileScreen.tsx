// src/screens/BabyFamilyCenterScreen.tsx
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
import { useApp } from '../../context/AppContext';
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
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { Milestone, useBaby } from '../../context/BabyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useActivity } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
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

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#06b6d4', gradient: ['#06b6d4', '#10b981'] as [string, string] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#6366f1' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#ef4444' },
];

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; emoji: string; label: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', emoji: '🚽', label: 'Potty' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', emoji: '🍼', label: 'Feeding' },
  sleep: { icon: 'moon-outline', color: '#3b82f6', emoji: '😴', label: 'Sleep' },
  growth: { icon: 'trending-up-outline', color: '#10b981', emoji: '📏', label: 'Growth' },
  medication: { icon: 'medical-outline', color: '#ef4444', emoji: '💊', label: 'Medication' },
  milestone: { icon: 'trophy-outline', color: '#f97316', emoji: '🌟', label: 'Milestone' },
  diaper: { icon: 'layers-outline', color: '#06b6d4', emoji: '🧷', label: 'Diaper' },
  note: { icon: 'document-text-outline', color: '#6b7280', emoji: '📝', label: 'Note' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', emoji: '✨', label: 'Activity' },
};

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

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

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  delay?: number;
  isDark?: boolean;
  colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: colors?.primary || '#6366f1', borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark, colors }: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string; 
  isDark?: boolean;
  colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
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
  );
});

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark, colors }: { 
  tabs: { key: ProfileTab; label: string; icon: string }[]; 
  activeTab: ProfileTab; 
  onChange: (t: ProfileTab) => void; 
  isDark?: boolean;
  colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.tabBar}>
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
                backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              },
              isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 }
            ]}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={16} 
              color={isActive ? (isDanger ? '#ef4444' : '#6366f1') : '#94a3b8'} 
            />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? (isDanger ? '#ef4444' : '#6366f1') : '#94a3b8' },
              isActive && { fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const KpiPill = React.memo(({ icon, value, label, color, onPress, isDark, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
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
  );
});

const SafeBabyAvatar = React.memo(({ avatar, gender = 'other', size = 72, showEditButton = false, onEdit, isDark, colors }: any) => {
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

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
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

const DevelopmentStageTracker = React.memo(({ baby, isDark, colors }: { baby: any; isDark?: boolean; colors?: any }) => {
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

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.stageHeader}>
          <View style={[styles.stageIconBg, { backgroundColor: `${currentStage.color}15` }]}>
            <Text style={styles.stageEmoji}>{currentStage.emoji}</Text>
          </View>
          <View style={styles.stageTitleWrap}>
            <Text style={styles.stageTitle}>{currentStage.stage} Stage</Text>
            <Text style={styles.stageSubtitle}>{currentStage.description}</Text>
          </View>
          <View style={[styles.stageBadge, { backgroundColor: `${currentStage.color}15` }]}>
            <Text style={[styles.stageBadgeText, { color: currentStage.color }]}>{Math.round(currentStage.progress)}%</Text>
          </View>
        </View>

        <View style={styles.stageProgressBar}>
          <View style={[styles.stageProgressBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={[styles.stageProgressFill, { width: `${currentStage.progress}%`, backgroundColor: currentStage.color }]} />
          </View>
        </View>

        <View style={styles.stageTimeline}>
          {stages.slice(0, 4).map((stage, i) => (
            <View key={i} style={styles.stageTimelineItem}>
              <View style={[styles.stageDot, { 
                backgroundColor: stage.progress === 100 ? stage.color : stage.progress > 0 ? `${stage.color}50` : 'rgba(255,255,255,0.1)',
                borderColor: stage.progress > 0 ? stage.color : 'transparent',
              }]} />
              <Text style={[styles.stageTimelineLabel, stage.progress > 0 && { color: stage.color, fontWeight: '700' }]}>
                {stage.stage}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const SmartHealthInsights = React.memo(({ baby, stats, recentActivities, isDark, colors }: { baby: any; stats: any; recentActivities: any[]; isDark?: boolean; colors?: any }) => {
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

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="AI Insights" subtitle="Intelligence-powered analysis" isDark={isDark} colors={colors} />
      <View style={styles.insightsList}>
        {insights.map((insight, i) => (
          <TouchableOpacity key={insight.id} activeOpacity={0.85} style={[styles.insightRow, { borderLeftColor: insight.color }]}>
            <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
              <Text style={styles.insightEmoji}>{insight.emoji}</Text>
            </View>
            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                {insight.action && (
                  <View style={[styles.insightActionBadge, { backgroundColor: '#6366f115' }]}>
                    <Text style={styles.insightActionText}>{insight.action.label} →</Text>
                  </View>
                )}
              </View>
              <Text style={styles.insightDesc}>{insight.description}</Text>
            </View>
            <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

const ActivitySparkline = React.memo(({ activities, isDark, colors }: { activities: any[]; isDark?: boolean; colors?: any }) => {
  const data = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { 
      const d = new Date(now); 
      d.setDate(d.getDate() - i); 
      days[d.toISOString().split('T')[0]] = 0; 
    }
    activities.forEach(a => { 
      const d = new Date(a.timestamp).toISOString().split('T')[0]; 
      if (days[d] !== undefined) days[d]++; 
    });
    return Object.values(days);
  }, [activities]);

  const maxVal = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard isDark={isDark} colors={colors}>
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
            const height = Math.max(4, (val / maxVal) * 60);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.sparklineBar, { height, backgroundColor: isToday ? '#6366f1' : val > 0 ? '#8b5cf6' : '#334155' }]} />
                <Text style={[styles.sparklineDay, isToday && { color: '#6366f1', fontWeight: '700' }]}>{['M','T','W','T','F','S','S'][i]}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const NextMilestoneCountdown = React.memo(({ baby, milestones, isDark, colors }: { baby: any; milestones: any[]; isDark?: boolean; colors?: any }) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
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
  const progressPercent = Math.max(0, Math.min(100, (ageMonths / nextMilestone.typicalAge) * 100));

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.countdownRow}>
          <View style={[styles.countdownIconBg, { backgroundColor: '#6366f115' }]}>
            <Text style={styles.countdownEmoji}>{nextMilestone.emoji}</Text>
          </View>
          <View style={styles.countdownContent}>
            <Text style={styles.countdownTitle}>Next: {nextMilestone.title}</Text>
            <Text style={styles.countdownSubtitle}>{nextMilestone.category} • Expected around {nextMilestone.typicalAge} months</Text>
          </View>
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownBadgeValue}>{monthsUntil}</Text>
            <Text style={styles.countdownBadgeLabel}>mo</Text>
          </View>
        </View>
        <View style={styles.countdownProgress}>
          <View style={[styles.countdownProgressBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <View style={[styles.countdownProgressFill, { width: `${progressPercent}%`, backgroundColor: '#6366f1' }]} />
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const FamilyConnectionHub = React.memo(({ members, onManage, babyName, isDark, colors }: { members: FamilyMember[]; onManage: () => void; babyName?: string; isDark?: boolean; colors?: any }) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  
  const isPending = (m: FamilyMember) => (m as any).status === 'pending' || !m.lastActive || m.fullName === 'Pending Invitation';
  
  const parents = members.filter(m => m.role === 'parent1' || m.role === 'parent2');
  const confirmedParents = parents.filter(m => !isPending(m));
  const pendingParents = parents.filter(m => isPending(m));
  const others = members.filter(m => !parents.find(p => p.id === m.id));
  const confirmedOthers = others.filter(m => !isPending(m));
  const pendingOthers = others.filter(m => isPending(m));
  
  const renderAvatar = (member: FamilyMember, size: number = 48, pending: boolean = false) => {
    const hasImage = member.avatar && (member.avatar.startsWith('http') || member.avatar.startsWith('file://') || member.avatar.startsWith('data:') || member.avatar.startsWith('ph://'));
    return (
      <View style={[styles.familyHubAvatar, { width: size, height: size, borderRadius: size/2, backgroundColor: hasImage ? 'transparent' : '#6366f1', borderColor: pending ? '#94a3b8' : '#1a1a2e', borderWidth: 2, opacity: pending ? 0.5 : 1 }]}>
        {hasImage ? (
          <Image source={{ uri: member.avatar }} style={{ width: size, height: size, borderRadius: size/2 }} resizeMode="cover" />
        ) : (
          <Text style={[styles.familyHubAvatarText, { fontSize: size * 0.4 }]}>{member.fullName?.charAt(0) || '?'}</Text>
        )}
      </View>
    );
  };

  const renderStatusBadge = (text: string, color: string = '#94a3b8') => (
    <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color }}>{text}</Text>
    </View>
  );

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Family Tree" subtitle={`${confirmedParents.length + confirmedOthers.length} active · ${pendingParents.length + pendingOthers.length} pending`} action={onManage} actionLabel="Manage" isDark={isDark} colors={colors} />
      <GlassCard onPress={onManage} isDark={isDark} colors={colors}>
        <View style={{ padding: 16, alignItems: 'center' }}>
          {/* Parents Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
            {parents.map((parent) => {
              const pending = isPending(parent);
              return (
                <View key={parent.id} style={{ alignItems: 'center', gap: 6, opacity: pending ? 0.55 : 1 }}>
                  {renderAvatar(parent, 56, pending)}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{parent.fullName || 'Parent'}</Text>
                  <View style={{ backgroundColor: pending ? 'rgba(148,163,184,0.15)' : 'rgba(99,102,241,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: pending ? '#94a3b8' : '#6366f1' }}>{parent.relationship || 'Parent'}</Text>
                  </View>
                  {pending && renderStatusBadge('Invited', '#94a3b8')}
                </View>
              );
            })}
            {confirmedParents.length < 2 && pendingParents.length === 0 && (
              <TouchableOpacity onPress={onManage} style={{ alignItems: 'center', gap: 6, opacity: 0.6 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' }}>
                  <Ionicons name="add" size={24} color="#94a3b8" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Add Co-Parent</Text>
              </TouchableOpacity>
            )}
            {pendingParents.length > 0 && confirmedParents.length < 2 && (
              <View style={{ alignItems: 'center', gap: 6, opacity: 0.45 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' }}>
                  <Ionicons name="time-outline" size={24} color="#94a3b8" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Awaiting Response</Text>
              </View>
            )}
          </View>
          
          {/* Connector */}
          <View style={{ width: 2, height: 20, backgroundColor: 'rgba(99,102,241,0.4)', marginVertical: 4 }} />
          
          {/* Baby Node */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#6366f1' }}>👶 {babyName || 'Baby'}</Text>
            </View>
          </View>
          
          {/* Connector down */}
          {(confirmedOthers.length > 0 || pendingOthers.length > 0) && <View style={{ width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 8 }} />}
          
          {/* Guardians / Others — Confirmed */}
          {confirmedOthers.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: pendingOthers.length > 0 ? 10 : 0 }}>
              {confirmedOthers.map((member) => (
                <View key={member.id} style={{ alignItems: 'center', gap: 4 }}>
                  {renderAvatar(member, 40, false)}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{member.fullName?.split(' ')[0] || 'Member'}</Text>
                  <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#6366f1' }}>{member.relationship || 'Guardian'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          
          {/* Guardians / Others — Pending (dimmed) */}
          {pendingOthers.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              {pendingOthers.map((member) => (
                <View key={member.id} style={{ alignItems: 'center', gap: 4, opacity: 0.45 }}>
                  {renderAvatar(member, 40, true)}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{member.fullName?.split(' ')[0] || 'Invited'}</Text>
                  {renderStatusBadge('Invited', '#94a3b8')}
                </View>
              ))}
            </View>
          )}
          
          {/* Empty guardian slot CTA */}
          {confirmedOthers.length === 0 && pendingOthers.length === 0 && (
            <TouchableOpacity onPress={onManage} style={{ alignItems: 'center', gap: 6, opacity: 0.5, marginTop: 4 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' }}>
                <Ionicons name="add" size={20} color="#94a3b8" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Add Guardian</Text>
            </TouchableOpacity>
          )}
          
          {/* Manage CTA */}
          <TouchableOpacity onPress={onManage} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
            <Ionicons name="people-outline" size={16} color="#6366f1" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366f1' }}>Manage Family Access</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const QuickActionDock = React.memo(({ onAction, isDark, colors }: { onAction: (screen: string, params?: any) => void; isDark?: boolean; colors?: any }) => {
  const actions = [
    { icon: '📏', label: 'Measure', screen: 'GrowthDashboard', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string] },
    { icon: '🍼', label: 'Feed', screen: 'AddEntry', params: { trackerId: 'feed' }, color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] as [string, string] },
    { icon: '😴', label: 'Sleep', screen: 'AddEntry', params: { trackerId: 'sleep' }, color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'] as [string, string] },
    { icon: '💊', label: 'Med', screen: 'AddEntry', params: { trackerId: 'medication' }, color: '#ef4444', gradient: ['#ef4444', '#f87171'] as [string, string] },
    { icon: '🌟', label: 'Milestone', screen: 'AddEntry', params: { trackerId: 'milestone' }, color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string] },
  ];

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(450).springify()} style={styles.dockContainer}>
      <View style={styles.dock}>
        {actions.map((action, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => onAction(action.screen, action.params)} 
            style={styles.dockItem}
            activeOpacity={0.8}
          >
            <LinearGradient colors={action.gradient} style={styles.dockGradient}>
              <Text style={styles.dockIcon}>{action.icon}</Text>
            </LinearGradient>
            <Text style={styles.dockLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

const BabyHealthScore = React.memo(({ baby, stats, recentActivities, isDark, colors }: { baby: any; stats: any; recentActivities: any[]; isDark?: boolean; colors?: any }) => {
  const health = useMemo(() => {
    const ageMonths = safeDiffMonths(new Date(), baby?.birthDate);

    const frequency = Math.min(100, (recentActivities.length / 10) * 100);
    const lastActivity = recentActivities[0];
    const recency = lastActivity ? Math.max(0, 100 - (safeDiffDays(new Date(), new Date(lastActivity.timestamp)) / 7) * 100) : 0;
    const diversity = new Set(recentActivities.map(a => a.type)).size;
    const diversityScore = Math.min(100, (diversity / 5) * 100);

    const score = Math.round((frequency * 0.3) + (recency * 0.35) + (diversityScore * 0.35));

    let status = { label: 'Excellent', color: '#10b981', emoji: '💚' };
    if (score < 40) status = { label: 'Needs Attention', color: '#ef4444', emoji: '⚠️' };
    else if (score < 70) status = { label: 'Good', color: '#f59e0b', emoji: '💛' };
    else if (score < 90) status = { label: 'Great', color: '#6366f1', emoji: '💙' };

    return { score, status, frequency, recency, diversityScore };
  }, [baby, stats, recentActivities]);

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <GlassCard isDark={isDark} colors={colors}>
        <View style={styles.healthContainer}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthTitle}>Tracking Health</Text>
            <Text style={styles.healthSubtitle}>Activity & wellness score</Text>
            <View style={styles.healthMetrics}>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{Math.round(health.frequency)}%</Text>
                <Text style={styles.healthMetricLabel}>Frequency</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{Math.round(health.recency)}%</Text>
                <Text style={styles.healthMetricLabel}>Recency</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{Math.round(health.diversityScore)}%</Text>
                <Text style={styles.healthMetricLabel}>Diversity</Text>
              </View>
            </View>
          </View>
          <View style={styles.healthRingContainer}>
            <View style={styles.healthRing}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.healthRingEmoji}>{health.status.emoji}</Text>
                <Text style={[styles.healthRingScore, { color: health.status.color }]}>{health.score}</Text>
                <Text style={styles.healthRingLabel}>{health.status.label}</Text>
              </View>
              <View style={[styles.healthRingBg, { borderColor: 'rgba(255,255,255,0.06)' }]} />
              <View style={[styles.healthRingFill, { borderColor: health.status.color, transform: [{ rotate: `${(health.score / 100) * 360}deg` }] }]} />
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

const ActionModal = React.memo(({ visible, onClose, title, children, isDark = true, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

const EmojiPickerModal = React.memo(({ visible, onClose, onSelect, isDark, colors }: { visible: boolean; onClose: () => void; onSelect: (emoji: string) => void; isDark?: boolean; colors?: any }) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.emojiPickerSheet}>
          <LinearGradient colors={isDark ? ['rgba(45,45,60,0.98)', 'rgba(35,35,50,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
                onPress={() => { onSelect(emoji); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
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

export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId } = route.params || { mode: 'baby' };
  const { isDark, colors: appColors } = useApp();
  const { fullThemeColors } = useCustomization();
  const themeColors = appColors || fullThemeColors;
  const styles = useMemo(() => getStyles(isDark, themeColors), [isDark, themeColors]);
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const sweetAlert = useSweetAlert();
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
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({ 
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } 
  });

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
      sweetAlert.error('Permission Required', 'Please allow access to your camera.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        const rawUri = result.assets[0].uri;
        
        if (rawUri.startsWith('content://')) {
          const base64 = await FileSystem.readAsStringAsync(rawUri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          await FileSystem.copyAsync({ from: rawUri, to: permanentUri });
        }
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        sweetAlert.success('Photo Saved!', 'Profile picture updated.');
      }
    } catch (error) {
      setIsUploading(false);
      sweetAlert.error('Error', 'Failed to save photo');
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      sweetAlert.error('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        const rawUri = result.assets[0].uri;
        
        if (rawUri.startsWith('content://')) {
          const base64 = await FileSystem.readAsStringAsync(rawUri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          await FileSystem.copyAsync({ from: rawUri, to: permanentUri });
        }
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        sweetAlert.success('Photo Saved!', 'Profile picture updated.');
      }
    } catch (error) {
      setIsUploading(false);
      sweetAlert.error('Error', 'Failed to save photo');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sweetAlert.success('Avatar Updated!', 'Emoji avatar saved.');
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
      setShowImagePicker(true);
    }
  };

  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return getEntriesByBaby(currentBabyData.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
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

  const familyMembers = useMemo(() => members, [members]);

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
      sweetAlert.toast('No Changes', 'No modifications detected');
      return;
    }
    sweetAlert.confirm('Save Changes?', `You are about to update:\n${changes.join('\n')}`, async () => {
      await handleSave();
    }, () => {}, 'Save', 'Cancel');
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
      sweetAlert.success('Profile Saved!', `${babyName}'s profile has been updated successfully.`);
    } catch (error) {
      sweetAlert.error('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

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
      sweetAlert.success('Milestone Recorded!', 'Another amazing achievement!');
    }
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    sweetAlert.confirm('Delete Milestone', 'Are you sure you want to delete this milestone?', async () => {
      await deleteMilestone(milestoneId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sweetAlert.success('Deleted', 'Milestone has been removed.');
    }, () => {}, 'Delete', 'Cancel');
  };

  const { verifyPassword } = useAuth();

  const handleDeleteBaby = useCallback(async () => {
    sweetAlert.confirm(
      'Delete Profile?',
      `⚠️ This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`,
      async () => {
        // Ask for password confirmation
        sweetAlert.prompt(
          'Confirm Password',
          'Enter your password to confirm deletion:',
          'secure-text',
          async (password) => {
            if (!password) {
              sweetAlert.error('Error', 'Password is required');
              return;
            }
            
            // Verify password
            const isValid = await verifyPassword(password);
            if (!isValid) {
              sweetAlert.error('Error', 'Incorrect password. Please try again.');
              return;
            }
            
            // Proceed with deletion
            if (currentBabyData) {
              try {
                // Delete from database
                await deleteBaby(currentBabyData.id);
                sweetAlert.success('Profile Deleted', `${currentBabyData.name}'s profile has been removed.`);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => navigation.goBack(), 1500);
              } catch (error) {
                sweetAlert.error('Error', 'Failed to delete profile');
              }
            }
          },
          'Delete',
          'Cancel'
        );
      },
      () => {},
      'Delete',
      'Cancel'
    );
  }, [currentBabyData, deleteBaby, navigation, sweetAlert, verifyPassword]);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); }
  };

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleQuickAction = useCallback((screen: string, params?: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen as never, params as never);
  }, [navigation]);

  if (!currentBabyData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.background }]} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
  const ageMonths = safeDiffMonths(new Date(), currentBabyData.birthDate);

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' },
    { key: 'danger' as ProfileTab, label: 'Danger', icon: 'warning-outline' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.background }]} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>{currentBabyData.name}</Text>
        <Text style={styles.stickySubtitle}>{ageMonths} months • {genderOption?.label}</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1', '#8b5cf6']} />}
      >
        {/* Top Header Row */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            onPress={() => setIsEditing(!isEditing)} 
            style={[styles.editToggleBtn, isEditing && { backgroundColor: 'rgba(99,102,241,0.3)' }]}
          >
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color={isEditing ? '#6366f1' : '#fff'} />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Hero */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
          <View style={styles.avatarSection}>
            <SafeBabyAvatar 
              avatar={babyPhoto} 
              gender={selectedGender} 
              size={100} 
              showEditButton 
              onEdit={showPhotoOptions}
              isDark={isDark}
              colors={themeColors}
            />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>{ageMonths} months • {genderOption?.label}</Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${medicalNotes || allergies ? '#f59e0b' : '#10b981'}20` }]}>
                <Ionicons name={medicalNotes || allergies ? 'medical-outline' : 'checkmark-circle'} size={12} color={medicalNotes || allergies ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.profileTagText, { color: medicalNotes || allergies ? '#f59e0b' : '#10b981' }]}>
                  {medicalNotes || allergies ? 'Monitor' : 'Healthy'}
                </Text>
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

        {/* Quick Actions Dock */}
        <QuickActionDock onAction={handleQuickAction} isDark={isDark} colors={themeColors} />

        {/* Tab Bar */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={themeColors} />

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.kpiPillRow}>
              <KpiPill icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#f59e0b" isDark={isDark} colors={themeColors} />
              <KpiPill icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#ec4899" isDark={isDark} colors={themeColors} />
              <KpiPill icon="📝" value={babyStats?.entries || 0} label="Entries" color="#6366f1" isDark={isDark} colors={themeColors} />
            </View>

            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.birthDateCard}>
              <Ionicons name="calendar-outline" size={20} color="#6366f1" />
              <View style={styles.birthDateContent}>
                <Text style={styles.birthDateLabel}>Birth Date</Text>
                <Text style={styles.birthDateValue}>{format(birthDate, 'MMMM d, yyyy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>

            <SmartHealthInsights baby={currentBabyData} stats={babyStats} recentActivities={recentActivities} isDark={isDark} colors={themeColors} />
            <ActivitySparkline activities={recentActivities} isDark={isDark} colors={themeColors} />
            <BabyHealthScore baby={currentBabyData} stats={babyStats} recentActivities={recentActivities} isDark={isDark} colors={themeColors} />
            <DevelopmentStageTracker baby={currentBabyData} isDark={isDark} colors={themeColors} />
            <NextMilestoneCountdown baby={currentBabyData} milestones={babyMilestones} isDark={isDark} colors={themeColors} />
            <FamilyConnectionHub 
              members={familyMembers} 
              onManage={() => navigation.navigate('FamilySharing' as never)} 
              babyName={currentBabyData?.name}
              isDark={isDark}
              colors={themeColors}
            />

            <Animated.View entering={FadeInUp.delay(500).springify()}>
              <SectionHeader 
                title="Recent Activity" 
                subtitle={`${recentActivities.length} entries`}
                action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)}
                actionLabel="See All"
                isDark={isDark}
                colors={themeColors}
              />
              {recentActivities.length === 0 ? (
                <GlassCard style={styles.emptyCard} isDark={isDark} colors={themeColors}>
                  <View style={styles.emptyStateIcon}>
                    <Ionicons name="time-outline" size={32} color="#6366f1" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
                  <Text style={styles.emptyText}>Start tracking your baby's daily activities to see them here.</Text>
                </GlassCard>
              ) : (
                <View style={styles.activitiesList}>
                  {recentActivities.slice(0, 5).map((activity, index) => {
                    const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
                    return (
                      <Animated.View key={activity.id || index} entering={FadeInUp.delay(index * 60).springify()}>
                        <GlassCard style={styles.activityCard} delay={index * 60} isDark={isDark} colors={themeColors}>
                          <View style={styles.activityRow}>
                            <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
                              <Text style={styles.activityEmoji}>{config.emoji}</Text>
                            </View>
                            <View style={styles.activityContent}>
                              <Text style={styles.activityTitle}>{activity.title || config.label}</Text>
                              {activity.details && <Text style={styles.activityDetails} numberOfLines={2}>{activity.details}</Text>}
                              <Text style={styles.activityTime}>{format(activity.timestamp, 'MMM d, h:mm a')}</Text>
                            </View>
                            <View style={[styles.activityTypeBadge, { backgroundColor: `${config.color}15` }]}>
                              <Text style={[styles.activityTypeText, { color: config.color }]}>{config.label}</Text>
                            </View>
                          </View>
                        </GlassCard>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
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
                  <GlassCard key={milestone.id} style={styles.milestoneCard} delay={index * 100} isDark={isDark} colors={themeColors}>
                    <View style={styles.milestoneRow}>
                      <View style={[styles.milestoneIcon, { backgroundColor: `${category?.color || '#6366f1'}20` }]}>
                        <Ionicons name={category?.icon as any || 'star'} size={24} color={category?.color || '#6366f1'} />
                      </View>
                      <View style={styles.milestoneContent}>
                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
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
              <GlassCard style={styles.emptyCard} delay={100} isDark={isDark} colors={themeColors}>
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
            <GlassCard style={styles.formCard} delay={100} isDark={isDark} colors={themeColors}>
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
                  <TextInput
                    style={styles.inputField}
                    value={bloodType}
                    onChangeText={(text) => { setBloodType(text); setIsEditing(true); }}
                    placeholder="e.g., O+"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Allergies (comma separated)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="warning-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={allergies}
                    onChangeText={(text) => { setAllergies(text); setIsEditing(true); }}
                    placeholder="e.g., Peanuts, Dairy"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="fitness-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={weight}
                    onChangeText={(text) => { setWeight(text); setIsEditing(true); }}
                    placeholder="e.g., 4.2"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="resize-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={height}
                    onChangeText={(text) => { setHeight(text); setIsEditing(true); }}
                    placeholder="e.g., 58"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Medical Notes</Text>
                <TextInput
                  style={[styles.textArea, !isEditing && styles.inputDisabled]}
                  value={medicalNotes}
                  onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }}
                  placeholder="Any important medical information..."
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#666"
                  editable={isEditing}
                  selectionColor="#6366f1"
                />
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={200} isDark={isDark} colors={themeColors}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Emergency & Pediatrician</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emergency Contact</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="call-outline" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={emergencyContact}
                    onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }}
                    placeholder="e.g., +1 (555) 123-4567"
                    keyboardType="phone-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pediatrician</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={pediatrician}
                    onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }}
                    placeholder="Dr. Smith - City Children's Hospital"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={300} isDark={isDark} colors={themeColors}>
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
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }}
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor="#fff"
                  disabled={!isEditing}
                />
              </View>
            </GlassCard>

            {isEditing && (
              <TouchableOpacity onPress={handleSavePress} style={styles.saveButton}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.saveButtonGradient}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TAB: DANGER */}
        {activeTab === 'danger' && (
          <Animated.View entering={FadeInUp} style={styles.tabPanel}>
            <GlassCard style={styles.dangerCard} delay={100} isDark={isDark} colors={themeColors}>
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
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* Modals */}
      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark} colors={themeColors}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handlePickImage}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="images-outline" size={28} color="#6366f1" />
            </View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="camera-outline" size={28} color="#10b981" />
            </View>
            <Text style={styles.imagePickerLabel}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="happy-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.imagePickerLabel}>Pick Emoji</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>

      <ActionModal visible={showAddMilestone} onClose={() => setShowAddMilestone(false)} title="Record Milestone" isDark={isDark} colors={themeColors}>
        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</Text>
            <TextInput
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 14, paddingHorizontal: 16, height: 52, color: themeColors.text, fontWeight: '600', fontSize: 16 }}
              value={newMilestone.title}
              onChangeText={(text) => setNewMilestone(prev => ({ ...prev, title: text }))}
              placeholder="e.g., First Steps"
              placeholderTextColor="#666"
            />
          </View>
          <View>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MILESTONE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setNewMilestone(prev => ({ ...prev, category: cat.id as Milestone['category'] }))}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: newMilestone.category === cat.id ? `${cat.color}20` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: newMilestone.category === cat.id ? cat.color : 'transparent' }}
                >
                  <Text style={{ color: newMilestone.category === cat.id ? cat.color : themeColors.text, fontWeight: '700', fontSize: 13 }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
            <TextInput
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 14, paddingHorizontal: 16, paddingTop: 14, height: 80, color: themeColors.text, fontWeight: '500', fontSize: 16, textAlignVertical: 'top' }}
              value={newMilestone.description}
              onChangeText={(text) => setNewMilestone(prev => ({ ...prev, description: text }))}
              placeholder="Optional details..."
              placeholderTextColor="#666"
              multiline
            />
          </View>
          <TouchableOpacity onPress={handleAddMilestone} style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}>
            <LinearGradient colors={['#f59e0b', '#f97316']} style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Save Milestone</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      <EmojiPickerModal 
        visible={showEmojiPicker} 
        onClose={() => setShowEmojiPicker(false)} 
        onSelect={handleEmojiSelect}
        isDark={isDark}
        colors={themeColors}
      />

      {showDatePicker && (
        <DateTimePicker
          value={birthDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

const getStyles = (isDarkMode: boolean, colors: any) => {
  if (!colors) colors = {};
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background || '#0f0f1a' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { flexGrow: 1, paddingBottom: 24, minHeight: SCREEN_H },

    // Sticky Header
    stickyHeader: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      zIndex: 100, 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingBottom: 10 
    },
    stickyTitle: { fontSize: 17, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    stickySubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || 'rgba(255,255,255,0.7)', marginTop: 2 },

    // Top Header
    topHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 10, 
      marginHorizontal: 16, 
      marginBottom: 16, 
      marginTop: 8 
    },
    backBtn: { 
      width: 40, 
      height: 40, 
      borderRadius: 12, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'rgba(255,255,255,0.08)' 
    },
    editToggleBtn: { 
      width: 40, 
      height: 40, 
      borderRadius: 12, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'rgba(255,255,255,0.08)' 
    },

    // Profile Hero
    profileHero: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 16, 
      marginHorizontal: 16, 
      marginBottom: 20 
    },
    avatarSection: { position: 'relative' },
    uploadingOverlay: { 
      ...StyleSheet.absoluteFillObject, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      borderRadius: 33, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    profileInfo: { flex: 1, gap: 4 },
    profileName: { fontSize: 24, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.5 },
    profileMeta: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#94a3b8' },
    profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
    profileTag: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 10, 
      paddingVertical: 5, 
      borderRadius: 10, 
      gap: 4 
    },
    profileTagText: { fontSize: 12, fontWeight: '700' },
    editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

    // Avatar
    avatarWrapper: { position: 'relative' },
    avatarGradient: { alignItems: 'center', justifyContent: 'center' },
    avatarEmoji: {},
    editAvatarBtn: { 
      position: 'absolute', 
      width: 28, 
      height: 28, 
      borderRadius: 14, 
      overflow: 'hidden', 
      borderWidth: 2, 
      borderColor: colors.background || '#1a1a2e' 
    },
    editAvatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

    // Birth Date Card
    birthDateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    birthDateContent: { flex: 1 },
    birthDateLabel: { 
      fontSize: 11, 
      fontWeight: '700', 
      color: colors.textSecondary || '#94a3b8', 
      textTransform: 'uppercase', 
      letterSpacing: 0.5 
    },
    birthDateValue: { 
      fontSize: 15, 
      fontWeight: '600', 
      color: colors.text || '#fff', 
      marginTop: 2 
    },

    // Quick Actions Dock
    dockContainer: { marginHorizontal: 16, marginBottom: 20 },
    dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    dockItem: { alignItems: 'center', gap: 6, flex: 1 },
    dockGradient: { 
      width: 52, 
      height: 52, 
      borderRadius: 16, 
      justifyContent: 'center', 
      alignItems: 'center' 
    },
    dockIcon: { fontSize: 24 },
    dockLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },

    // Tab Bar
    tabBar: { 
      flexDirection: 'row', 
      marginHorizontal: 16, 
      marginBottom: 16, 
      padding: 4, 
      borderRadius: 16, 
      gap: 2, 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
    },
    tabItem: { 
      flex: 1, 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: 6, 
      paddingVertical: 10, 
      borderRadius: 12 
    },
    tabLabel: { fontSize: 12, fontWeight: '600' },

    // Glass Card
    glassCard: { 
      borderRadius: DESIGN.radius.lg, 
      overflow: 'hidden', 
      borderWidth: 1, 
      borderColor: colors.border || 'rgba(255,255,255,0.06)', 
      marginHorizontal: 16, 
      marginBottom: DESIGN.spacing.lg 
    },
    glassBorder: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      height: 1, 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
    },
    glassContent: { flex: 1 },

    // Section Header
    sectionHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      marginHorizontal: 16, 
      marginBottom: 12, 
      marginTop: 8 
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginTop: 2 },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

    // KPI Pills
    kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
    kpiPill: { 
      flex: 1, 
      borderRadius: 20, 
      overflow: 'hidden', 
      padding: 14, 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 10 
    },
    kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    kpiPillEmoji: { fontSize: 20 },
    kpiPillBody: { flex: 1 },
    kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    kpiPillLabel: { 
      fontSize: 11, 
      fontWeight: '600', 
      color: colors.textSecondary || '#94a3b8', 
      textTransform: 'uppercase', 
      letterSpacing: 0.5 
    },

    // AI Insights
    insightsList: { marginHorizontal: 0, gap: 8, marginBottom: 16 },
    insightRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 14, 
      borderRadius: 16, 
      backgroundColor: isDarkMode ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)', 
      borderLeftWidth: 3 
    },
    insightIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    insightEmoji: { fontSize: 20 },
    insightContent: { flex: 1, gap: 3 },
    insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    insightTitle: { fontSize: 14, fontWeight: '700', color: colors.text || '#fff' },
    insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: colors.textSecondary || '#94a3b8' },
    insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
    insightActionText: { fontSize: 11, fontWeight: '700', color: '#6366f1' },
    insightPriority: { width: 4, height: 36, borderRadius: 2 },

    // Sparkline
    sparklineHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      padding: 16, 
      paddingBottom: 12 
    },
    sparklineTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#fff' },
    sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginTop: 2 },
    sparklineTotal: { alignItems: 'flex-end' },
    sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
    sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },
    sparklineChart: { 
      flexDirection: 'row', 
      justifyContent: 'space-around', 
      alignItems: 'flex-end', 
      paddingHorizontal: 16, 
      paddingBottom: 16, 
      height: 100 
    },
    sparklineBar: { width: 8, borderRadius: 4 },
    sparklineDay: { fontSize: 10, fontWeight: '600', color: colors.textMuted || '#64748b' },

    // Health Score
    healthContainer: { flexDirection: 'row', padding: 16, gap: 16 },
    healthLeft: { flex: 1, gap: 4 },
    healthTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#fff' },
    healthSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginBottom: 8 },
    healthMetrics: { flexDirection: 'row', gap: 16, marginTop: 4 },
    healthMetric: { alignItems: 'center', gap: 2 },
    healthMetricValue: { fontSize: 18, fontWeight: '800', color: colors.text || '#fff' },
    healthMetricLabel: { 
      fontSize: 10, 
      fontWeight: '600', 
      color: colors.textMuted || '#64748b', 
      textTransform: 'uppercase', 
      letterSpacing: 0.5 
    },
    healthRingContainer: { justifyContent: 'center', alignItems: 'center' },
    healthRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
    healthRingBg: { 
      position: 'absolute', 
      width: 80, 
      height: 80, 
      borderRadius: 40, 
      borderWidth: 4, 
      borderColor: 'rgba(255,255,255,0.06)' 
    },
    healthRingFill: { 
      position: 'absolute', 
      width: 80, 
      height: 80, 
      borderRadius: 40, 
      borderWidth: 4, 
      borderTopColor: 'transparent', 
      borderRightColor: 'transparent', 
      borderLeftColor: 'transparent' 
    },
    healthRingEmoji: { fontSize: 16 },
    healthRingScore: { fontSize: 20, fontWeight: '800' },
    healthRingLabel: { fontSize: 9, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },

    // Development Stage
    stageHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 12, 
      padding: 16, 
      paddingBottom: 12 
    },
    stageIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    stageEmoji: { fontSize: 22 },
    stageTitleWrap: { flex: 1 },
    stageTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#fff' },
    stageSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginTop: 2 },
    stageBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    stageBadgeText: { fontSize: 12, fontWeight: '800' },
    stageProgressBar: { paddingHorizontal: 16, paddingBottom: 12 },
    stageProgressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    stageProgressFill: { height: '100%', borderRadius: 3 },
    stageTimeline: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      paddingHorizontal: 16, 
      paddingBottom: 16 
    },
    stageTimelineItem: { alignItems: 'center', gap: 6 },
    stageDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
    stageTimelineLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted || '#64748b' },

    // Next Milestone Countdown
    countdownRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 12, 
      padding: 16, 
      paddingBottom: 8 
    },
    countdownIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    countdownEmoji: { fontSize: 22 },
    countdownContent: { flex: 1 },
    countdownTitle: { fontSize: 15, fontWeight: '800', color: colors.text || '#fff' },
    countdownSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginTop: 1 },
    countdownBadge: { 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#6366f1', 
      width: 48, 
      height: 48, 
      borderRadius: 14 
    },
    countdownBadgeValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
    countdownBadgeLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
    countdownProgress: { paddingHorizontal: 16, paddingBottom: 16 },
    countdownProgressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    countdownProgressFill: { height: '100%', borderRadius: 3 },

    // Family Hub
    familyHubRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    familyHubAvatars: { flexDirection: 'row' },
    familyHubAvatar: { 
      width: 40, 
      height: 40, 
      borderRadius: 20, 
      alignItems: 'center', 
      justifyContent: 'center', 
      borderWidth: 2, 
      overflow: 'hidden' 
    },
    familyHubAvatarText: { color: colors.text || '#fff', fontSize: 14, fontWeight: '800' },
    familyHubAvatarMore: { backgroundColor: colors.textMuted || '#64748b' },
    familyHubAvatarMoreText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    familyHubContent: { flex: 1 },
    familyHubTitle: { fontSize: 15, fontWeight: '800', color: colors.text || '#fff' },
    familyHubSubtitle: { fontSize: 12, color: colors.textSecondary || '#94a3b8', fontWeight: '500', marginTop: 1 },

    // Activity Tab
    activitiesList: { gap: 8, marginHorizontal: 0 },
    activityCard: { padding: 0 },
    activityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    activityIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    activityEmoji: { fontSize: 20 },
    activityContent: { flex: 1, gap: 2 },
    activityTitle: { fontSize: 15, fontWeight: '700', color: colors.text || '#fff' },
    activityDetails: { fontSize: 13, color: colors.textSecondary || '#94a3b8', marginTop: 2, lineHeight: 18 },
    activityTime: { fontSize: 12, color: colors.textMuted || '#64748b', marginTop: 4, fontWeight: '500' },
    activityTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
    activityTypeText: { fontSize: 11, fontWeight: '700' },

    // Empty States
    emptyCard: { 
      padding: 40, 
      alignItems: 'center', 
      justifyContent: 'center', 
      borderRadius: 20, 
      overflow: 'hidden' 
    },
    emptyStateIcon: { 
      width: 64, 
      height: 64, 
      borderRadius: 20, 
      backgroundColor: 'rgba(99,102,241,0.1)', 
      alignItems: 'center', 
      justifyContent: 'center', 
      marginBottom: 16 
    },
    emptyStateTitle: { fontSize: 16, fontWeight: '700', color: colors.text || '#fff', textAlign: 'center', marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textMuted || '#64748b', textAlign: 'center', lineHeight: 20 },

    // Milestones
    addMilestoneBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 8, marginHorizontal: 16 },
    addMilestoneGradient: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 16, 
      gap: 10 
    },
    addMilestoneText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    milestoneCard: { padding: 0, marginBottom: 12, borderRadius: 20 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    milestoneIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    milestoneContent: { flex: 1 },
    milestoneTitle: { fontSize: 16, fontWeight: '800', color: colors.text || '#fff', marginBottom: 3 },
    milestoneCategory: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', marginBottom: 3 },
    milestoneDate: { fontSize: 13, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },
    milestoneDescription: { 
      fontSize: 14, 
      color: colors.textMuted || '#64748b', 
      marginTop: 10, 
      lineHeight: 20, 
      fontWeight: '500', 
      paddingHorizontal: 16, 
      paddingBottom: 16 
    },
    deleteEntryBtn: { 
      padding: 6, 
      width: 36, 
      height: 36, 
      borderRadius: 18, 
      backgroundColor: 'rgba(239,68,68,0.1)', 
      alignItems: 'center', 
      justifyContent: 'center' 
    },

    // Health Form
    formCard: { padding: 0, marginBottom: 16 },
    sectionHeaderWithEdit: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingTop: 20, 
      marginBottom: 16 
    },
    sectionLabel: { fontSize: 20, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    editIconBtn: { 
      width: 40, 
      height: 40, 
      borderRadius: 12, 
      backgroundColor: 'rgba(99,102,241,0.1)', 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    editingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    inputGroup: { marginBottom: 20, paddingHorizontal: 20 },
    inputLabel: { 
      fontSize: 13, 
      fontWeight: '700', 
      color: colors.textSecondary || '#94a3b8', 
      marginBottom: 10, 
      textTransform: 'uppercase', 
      letterSpacing: 0.5 
    },
    inputContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
      borderRadius: 14, 
      paddingHorizontal: 16, 
      height: 52, 
      borderWidth: 1, 
      borderColor: 'rgba(255,255,255,0.04)' 
    },
    inputDisabled: { opacity: 0.5 },
    inputIcon: { marginRight: 12 },
    inputField: { flex: 1, fontSize: 16, color: colors.text || '#fff', fontWeight: '600' },
    textArea: { 
      height: 110, 
      textAlignVertical: 'top', 
      paddingTop: 18, 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
      borderRadius: 14, 
      paddingHorizontal: 16, 
      fontSize: 16, 
      color: colors.text || '#fff', 
      fontWeight: '500', 
      borderWidth: 1, 
      borderColor: 'rgba(255,255,255,0.04)' 
    },

    preferenceRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: 20, 
      paddingVertical: 16 
    },
    preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    preferenceText: { gap: 2 },
    preferenceTitle: { fontSize: 16, fontWeight: '700', color: colors.text || '#fff' },
    preferenceDesc: { fontSize: 13, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },

    saveButton: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' },
    saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Danger Zone
    dangerCard: { 
      padding: 24, 
      alignItems: 'center', 
      borderColor: '#ef4444', 
      borderWidth: 2, 
      borderRadius: 24 
    },
    dangerIconContainer: { marginBottom: 16 },
    dangerIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    dangerTitle: { fontSize: 24, fontWeight: '800', color: '#ef4444', marginBottom: 8 },
    dangerDescription: { 
      fontSize: 15, 
      color: colors.textSecondary || '#94a3b8', 
      textAlign: 'center', 
      lineHeight: 22, 
      marginBottom: 20 
    },
    dangerStats: { flexDirection: 'row', gap: 20, marginBottom: 24 },
    dangerStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dangerStatText: { fontSize: 14, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },
    deleteButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
    deleteGradient: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 16, 
      gap: 8 
    },
    deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    dangerNote: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      marginTop: 16, 
      gap: 6 
    },
    dangerNoteText: { fontSize: 13, color: colors.textSecondary || '#94a3b8' },

    // Tab Panel
    tabPanel: { marginTop: 4, gap: 16 },

    // Modals
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, overflow: 'hidden' },
    modalDragHandle: { width: '100%', alignItems: 'center', paddingVertical: 8 },
    dragIndicator: { 
      width: 40, 
      height: 4, 
      borderRadius: 2, 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' 
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    modalClose: { 
      width: 36, 
      height: 36, 
      borderRadius: 10, 
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', 
      justifyContent: 'center', 
      alignItems: 'center' 
    },

    imagePickerOptions: { padding: 8 },
    imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
    imagePickerIcon: { 
      width: 48, 
      height: 48, 
      borderRadius: 14, 
      alignItems: 'center', 
      justifyContent: 'center', 
      marginRight: 14 
    },
    imagePickerLabel: { fontSize: 16, fontWeight: '600', color: colors.text || '#fff', flex: 1 },

    // Emoji Picker
    emojiPickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    emojiPickerSheet: { 
      width: '100%', 
      maxWidth: 400, 
      borderRadius: 24, 
      padding: 20, 
      paddingBottom: 40, 
      overflow: 'hidden' 
    },
    emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#fff' },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    emojiButton: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emojiButtonText: { fontSize: 28 },
  });
};