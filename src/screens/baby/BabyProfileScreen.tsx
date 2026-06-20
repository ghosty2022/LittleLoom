import {
  StyleSheet, ActionSheetIOS, ActivityIndicator, Dimensions, Image, Modal,
  RefreshControl, ScrollView, Switch, TextInput, TouchableOpacity, useColorScheme,
  View, Platform, StatusBar, Text, LayoutAnimation,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeInRight, Layout,
  useSharedValue, useAnimatedStyle, interpolate, Extrapolate,
  useAnimatedScrollHandler, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { Milestone, useBaby } from '../../context/BabyContext';
import { showConfirmModal, showErrorModal, showSuccessModal } from '../../utils/modal';
import { useActivity } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';

const { width, height } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Matching EditGuardianScreen quality
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:') || value.startsWith('ph://') || value.startsWith('assets-library://');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const getAgeLabel = (birthDate: string | Date): string => {
  const birth = new Date(birthDate);
  const now = new Date();
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const days = differenceInDays(now, birth);
  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m ${days % 30}d`;
  return `${days}d`;
};

const getNextMilestone = (ageInMonths: number): { title: string; dueIn: string; icon: string } => {
  const milestones = [
    { age: 0, title: 'First Smile', icon: '😊' },
    { age: 2, title: 'Holds Head Up', icon: '👶' },
    { age: 4, title: 'Rolls Over', icon: '🔄' },
    { age: 6, title: 'Sits Without Support', icon: '🪑' },
    { age: 9, title: 'Crawls', icon: '🐛' },
    { age: 12, title: 'First Steps', icon: '🚶' },
    { age: 15, title: 'First Words', icon: '💬' },
    { age: 18, title: 'Runs', icon: '🏃' },
    { age: 24, title: 'Potty Training', icon: '🚽' },
    { age: 36, title: 'Full Sentences', icon: '📖' },
  ];
  const next = milestones.find(m => m.age > ageInMonths);
  if (!next) return { title: 'Growing Up!', dueIn: 'Keep tracking!', icon: '⭐' };
  const dueIn = next.age - ageInMonths;
  return { title: next.title, dueIn: dueIn <= 1 ? 'Soon!' : `${dueIn} months`, icon: next.icon };
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

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
  { value: 'boy', label: 'Boy', icon: 'male', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#667eea' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#f97316' },
];

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; emoji: string; label: string }> = {
  potty: { icon: 'water-outline', color: '#8b5cf6', emoji: '🚽', label: 'Potty' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', emoji: '🍼', label: 'Feeding' },
  sleep: { icon: 'moon-outline', color: '#3b82f6', emoji: '😴', label: 'Sleep' },
  growth: { icon: 'trending-up-outline', color: '#10b981', emoji: '📏', label: 'Growth' },
  medication: { icon: 'medical-outline', color: '#ef4444', emoji: '💊', label: 'Medication' },
  milestone: { icon: 'trophy-outline', color: '#f97316', emoji: '🌟', label: 'Milestone' },
  diaper: { icon: 'layers-outline', color: '#06b6d4', emoji: '🧷', label: 'Diaper' },
  note: { icon: 'document-text-outline', color: '#6b7280', emoji: '📝', label: 'Note' },
};

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'overview' | 'milestones' | 'health' | 'insights' | 'danger';

// ═══════════════════════════════════════════════════════════════════════════
// REFINED SUB-COMPONENTS (Matching EditGuardianScreen quality)
// ═══════════════════════════════════════════════════════════════════════════

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; delay?: number;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[
      styles.glassCard,
      active && { borderColor: '#667eea', borderWidth: 2 },
      style,
    ]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#667eea" />
        </TouchableOpacity>
      )}
    </View>
  );
});

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

const TabBar = React.memo(({ tabs, activeTab, onChange }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab; onChange: (t: ProfileTab) => void;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
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
                backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : (isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)'),
                ...DESIGN.shadow.sm,
              },
              isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 },
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={isActive ? (isDanger ? '#ef4444' : '#667eea') : (isDark ? '#94a3b8' : '#64748b')}
            />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? (isDanger ? '#ef4444' : '#667eea') : (isDark ? '#94a3b8' : '#64748b') },
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

const SafeBabyAvatar = React.memo(({
  avatar, gender = 'other', size = 72, showEditButton = false, onEdit
}: {
  avatar?: string | null; gender?: string; size?: number; showEditButton?: boolean; onEdit?: () => void;
}) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#667eea', '#764ba2'];

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
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.editAvatarGradient}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 1: AI Growth Prediction Card
// ═══════════════════════════════════════════════════════════════════════════

const AIGrowthPrediction = React.memo(({ baby, milestones }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ageInMonths = useMemo(() => {
    if (!baby?.birthDate) return 0;
    return differenceInMonths(new Date(), new Date(baby.birthDate));
  }, [baby?.birthDate]);

  const prediction = useMemo(() => getNextMilestone(ageInMonths), [ageInMonths]);
  const achievedCount = milestones?.filter((m: any) => m.babyId === baby?.id).length || 0;
  const progressPercent = Math.min(100, (achievedCount / 20) * 100);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <GlassCard>
        <View style={styles.aiCardHeader}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={14} color="#667eea" />
            <Text style={styles.aiBadgeText}>AI Prediction</Text>
          </View>
        </View>
        <View style={styles.aiPredictionRow}>
          <View style={styles.aiPredictionLeft}>
            <Text style={styles.aiPredictionEmoji}>{prediction.icon}</Text>
            <View style={styles.aiPredictionInfo}>
              <Text style={[styles.aiPredictionTitle, isDark && styles.textDark]}>Next: {prediction.title}</Text>
              <Text style={styles.aiPredictionDue}>Expected in {prediction.dueIn}</Text>
            </View>
          </View>
          <View style={styles.aiProgressRing}>
            <View style={styles.aiProgressBg} />
            <View style={[styles.aiProgressFill, { transform: [{ rotate: `${(progressPercent / 100) * 360}deg` }] }]} />
            <View style={styles.aiProgressCenter}>
              <Text style={styles.aiProgressText}>{achievedCount}</Text>
              <Text style={styles.aiProgressLabel}>done</Text>
            </View>
          </View>
        </View>
        <View style={styles.aiProgressBar}>
          <View style={[styles.aiProgressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 2: Daily Pattern Insights
// ═══════════════════════════════════════════════════════════════════════════

const DailyPatternInsights = React.memo(({ activities }: { activities: any[] }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const patterns = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recent = activities.filter(a => a.timestamp > dayAgo);
    const sleepCount = recent.filter(a => a.type === 'sleep').length;
    const feedCount = recent.filter(a => a.type === 'feed').length;
    const total = recent.length;

    const items = [];
    if (total > 0) {
      items.push({
        emoji: sleepCount >= 3 ? '😴' : '⚠️',
        title: sleepCount >= 3 ? 'Good Sleep Pattern' : 'Low Sleep Today',
        desc: sleepCount >= 3 ? `${sleepCount} naps recorded today` : `Only ${sleepCount} sleep sessions`,
        color: sleepCount >= 3 ? '#10b981' : '#f59e0b',
      });
      items.push({
        emoji: feedCount >= 4 ? '🍼' : '⚠️',
        title: feedCount >= 4 ? 'Well Fed' : 'Fewer Feeds',
        desc: `${feedCount} feeding sessions today`,
        color: feedCount >= 4 ? '#10b981' : '#f59e0b',
      });
      items.push({
        emoji: '📊',
        title: 'Activity Level',
        desc: `${total} total entries today`,
        color: total >= 8 ? '#667eea' : '#94a3b8',
      });
    }
    return items;
  }, [activities]);

  if (patterns.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Daily Patterns" subtitle="Today's routine insights" />
      <View style={styles.patternList}>
        {patterns.map((p, i) => (
          <View key={i} style={[styles.patternRow, { borderLeftColor: p.color }]}>
            <View style={[styles.patternIconBg, { backgroundColor: `${p.color}12` }]}>
              <Text style={styles.patternEmoji}>{p.emoji}</Text>
            </View>
            <View style={styles.patternContent}>
              <Text style={[styles.patternTitle, isDark && styles.textDark]}>{p.title}</Text>
              <Text style={styles.patternDesc}>{p.desc}</Text>
            </View>
            <View style={[styles.patternIndicator, { backgroundColor: p.color }]} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 3: Growth Velocity Tracker
// ═══════════════════════════════════════════════════════════════════════════

const GrowthVelocityTracker = React.memo(({ baby, activities }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const growthData = useMemo(() => {
    const growthEntries = activities.filter((a: any) => a.type === 'growth').slice(0, 7);
    return growthEntries.map((a: any) => ({
      weight: a.details?.weight || a.weight || 0,
      date: new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'narrow' }),
    })).reverse();
  }, [activities]);

  const latestWeight = baby?.weight || '—';
  const latestHeight = baby?.height || '—';

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Growth Tracking" />
      <GlassCard>
        <View style={styles.growthRow}>
          <View style={styles.growthMetric}>
            <View style={[styles.growthIconBg, { backgroundColor: '#f59e0b15' }]}>
              <Ionicons name="fitness-outline" size={22} color="#f59e0b" />
            </View>
            <View>
              <Text style={[styles.growthValue, isDark && styles.textDark]}>{latestWeight} kg</Text>
              <Text style={styles.growthLabel}>Weight</Text>
            </View>
          </View>
          <View style={styles.growthDivider} />
          <View style={styles.growthMetric}>
            <View style={[styles.growthIconBg, { backgroundColor: '#10b98115' }]}>
              <Ionicons name="resize-outline" size={22} color="#10b981" />
            </View>
            <View>
              <Text style={[styles.growthValue, isDark && styles.textDark]}>{latestHeight} cm</Text>
              <Text style={styles.growthLabel}>Height</Text>
            </View>
          </View>
        </View>
        {growthData.length > 1 && (
          <View style={styles.growthSparkline}>
            {growthData.map((d: any, i: number) => {
              const maxW = Math.max(...growthData.map((g: any) => g.weight || 0), 1);
              const barHeight = Math.max(4, ((d.weight || 0) / maxW) * 40);
              return (
                <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[styles.growthBar, { height: barHeight, backgroundColor: i === growthData.length - 1 ? '#f59e0b' : '#f59e0b60' }]} />
                  <Text style={styles.growthBarLabel}>{d.date}</Text>
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 4: Smart Health Monitor
// ═══════════════════════════════════════════════════════════════════════════

const SmartHealthMonitor = React.memo(({ baby }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const healthStatus = useMemo(() => {
    const items = [];
    const hasAllergies = baby?.allergies && baby.allergies.length > 0;
    const hasMedicalNotes = baby?.medicalNotes && baby.medicalNotes.length > 0;
    const hasEmergency = baby?.emergencyContact && baby.emergencyContact.length > 0;
    const hasPediatrician = baby?.pediatrician && baby.pediatrician.length > 0;

    if (hasAllergies) {
      items.push({
        icon: 'warning-outline', color: '#f59e0b', title: 'Allergy Alert',
        desc: `${baby.allergies.length} allergen${baby.allergies.length > 1 ? 's' : ''} registered`,
      });
    } else {
      items.push({
        icon: 'checkmark-circle', color: '#10b981', title: 'No Allergies',
        desc: 'No known allergies on record',
      });
    }

    if (hasMedicalNotes) {
      items.push({
        icon: 'medical-outline', color: '#667eea', title: 'Medical Notes',
        desc: 'Health information available',
      });
    }

    if (hasEmergency && hasPediatrician) {
      items.push({
        icon: 'shield-checkmark', color: '#10b981', title: 'Emergency Ready',
        desc: 'Contacts configured',
      });
    } else if (!hasEmergency) {
      items.push({
        icon: 'alert-circle', color: '#ef4444', title: 'Missing Emergency Contact',
        desc: 'Add emergency contact in Health tab',
      });
    }

    return items;
  }, [baby]);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Health Monitor" />
      <View style={styles.healthList}>
        {healthStatus.map((item, i) => (
          <View key={i} style={[styles.healthRow, { borderLeftColor: item.color }]}>
            <View style={[styles.healthIconBg, { backgroundColor: `${item.color}12` }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={styles.healthContent}>
              <Text style={[styles.healthTitle, isDark && styles.textDark]}>{item.title}</Text>
              <Text style={styles.healthDesc}>{item.desc}</Text>
            </View>
            <View style={[styles.healthStatusDot, { backgroundColor: item.color }]} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 5: Family Engagement Score
// ═══════════════════════════════════════════════════════════════════════════

const FamilyEngagementScore = React.memo(({ familyMembers, activities }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const engagement = useMemo(() => {
    if (!familyMembers?.length) return [];
    return familyMembers.slice(0, 4).map((member: any) => {
      const memberActs = activities.filter((a: any) =>
        a.loggedBy === member.id || a.loggedByName === member.fullName
      ).length;
      const score = Math.min(100, memberActs * 10);
      return { ...member, score, activities: memberActs };
    });
  }, [familyMembers, activities]);

  if (engagement.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Family Engagement" subtitle="Who's most active with baby" />
      <GlassCard>
        <View style={styles.engagementList}>
          {engagement.map((m: any, i: number) => (
            <View key={m.id || i} style={styles.engagementRow}>
              <View style={[styles.engagementAvatar, { backgroundColor: m.avatar ? 'transparent' : '#667eea' }]}>
                {m.avatar ? (
                  <Image source={{ uri: m.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <Text style={styles.engagementAvatarText}>{m.fullName?.charAt(0) || '?'}</Text>
                )}
              </View>
              <View style={styles.engagementInfo}>
                <Text style={[styles.engagementName, isDark && styles.textDark]}>{m.fullName}</Text>
                <Text style={styles.engagementRole}>{m.role || 'Family Member'}</Text>
              </View>
              <View style={styles.engagementBarContainer}>
                <View style={styles.engagementBarBg}>
                  <View style={[styles.engagementBarFill, { width: `${m.score}%`, backgroundColor: i === 0 ? '#f59e0b' : '#667eea' }]} />
                </View>
                <Text style={styles.engagementCount}>{m.activities} entries</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 6: Quick Actions Dock
// ═══════════════════════════════════════════════════════════════════════════

const QuickActionsDock = React.memo(({
  onAddActivity, onGrowth, onMedication, onTimeline, onFamilyChat
}: any) => {
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.dockContainer}>
      <View style={styles.dock}>
        <TouchableOpacity onPress={onAddActivity} style={styles.dockItem}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.dockGradient}>
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.dockLabel}>Log</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGrowth} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
            <Ionicons name="trending-up-outline" size={20} color="#10b981" />
          </View>
          <Text style={styles.dockLabel}>Growth</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMedication} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
            <Ionicons name="medical-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.dockLabel}>Meds</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onTimeline} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
            <Ionicons name="time-outline" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.dockLabel}>Timeline</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onFamilyChat} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.dockLabel}>Chat</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

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
  const [newMilestone, setNewMilestone] = useState({
    title: '', category: 'physical' as Milestone['category'], description: '', achievedAt: new Date().toISOString().split('T')[0],
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));

  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP),
    }],
  }));

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

  const getPermanentImagePath = (id: string, isAvatar: boolean = true) => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    return `${dir}${id}_${isAvatar ? 'avatar' : 'photo'}_${Date.now()}.jpg`;
  };

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showErrorModal({ title: 'Permission Required', message: 'Please allow access to your camera.' }); return; }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri); setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) { setIsUploading(false); showErrorModal({ title: 'Error', message: 'Failed to save photo' }); }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showErrorModal({ title: 'Permission Required', message: 'Please allow access to your photo library.' }); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri); setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) { setIsUploading(false); showErrorModal({ title: 'Error', message: 'Failed to save photo' }); }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji); setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal({ title: 'Avatar Updated!', message: 'Emoji avatar saved.' });
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'], cancelButtonIndex: 0 },
        (buttonIndex) => { if (buttonIndex === 1) handleTakePhoto(); else if (buttonIndex === 2) handlePickImage(); else if (buttonIndex === 3) setShowEmojiPicker(true); }
      );
    } else { showConfirmModal({ title: 'Change Photo', message: 'Choose an option', onConfirm: () => handlePickImage(), onCancel: () => {} }); }
  };

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
    return { streak: currentBabyData.streak || 0, milestones: babyMilestones.length, photos: currentBabyData.photos || 0, entries: recentActivities.length };
  }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    if (userProfile) {
      membersList.push({
        id: userProfile.id, userId: userProfile.id, fullName: userProfile.fullName, email: userProfile.email,
        avatar: userProfile.avatar, role: 'parent1', relationship: 'Parent',
        permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true },
        addedAt: currentBabyData?.createdAt || new Date().toISOString(), addedBy: userProfile.id,
        canBeRemoved: false, phoneNumber: userProfile.phoneNumber, notificationsEnabled: true,
      });
    }
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

  const handleSavePress = () => {
    const changes = checkForChanges();
    if (changes.length === 0) { showErrorModal({ title: 'No Changes', message: 'No modifications detected.' }); return; }
    showConfirmModal({ title: 'Save Changes?', message: `You are about to update:\n${changes.join('\n')}`, onConfirm: handleSave, onCancel: () => {} });
  };

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;
      setIsSaving(true);
      const babyUpdates: any = {
        name: babyName, skinTone: selectedSkin, gender: selectedGender,
        birthDate: birthDate.toISOString(), avatar: babyPhoto, bloodType,
        allergies: allergies.split(',').map((a: string) => a.trim()).filter(Boolean),
        medicalNotes, weight, height, emergencyContact, pediatrician,
        notificationsEnabled, lastUpdated: new Date().toISOString(),
      };
      await updateBaby(currentBabyData.id, babyUpdates);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Profile Saved!', message: `${babyName}'s profile has been updated successfully.` });
    } catch (error) { showErrorModal({ title: 'Error', message: 'Failed to update profile' }); }
    finally { setIsSaving(false); }
  };

  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;
    const success = await addMilestone({
      babyId: currentBabyData.id, title: newMilestone.title,
      category: newMilestone.category, description: newMilestone.description,
      achievedAt: newMilestone.achievedAt,
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
      title: 'Delete Milestone', message: 'Are you sure you want to delete this milestone?',
      onConfirm: async () => { await deleteMilestone(milestoneId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); showSuccessModal({ title: 'Deleted', message: 'Milestone has been removed.' }); },
    });
  };

  const handleDeleteBaby = async () => {
    showConfirmModal({
      title: 'Delete Profile?', message: `This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`,
      onConfirm: async () => { if (currentBabyData) { await deleteBaby(currentBabyData.id); showSuccessModal({ title: 'Profile Deleted', message: 'Baby profile has been removed.' }); setTimeout(() => navigation.goBack(), 1500); } },
    });
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); }
  };

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; } });

  const EmojiPicker = () => {
    if (!showEmojiPicker) return null;
    return (
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
        <View style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
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
    );
  };

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={32} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>{currentBabyData?.name || 'Baby Profile'}</Text>
        </View>
        <TouchableOpacity onPress={handleSavePress} style={[styles.saveBtn, (!isEditing || isSaving) && styles.saveBtnDisabled]} disabled={!isEditing || isSaving} activeOpacity={0.8}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>Save</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!currentBabyData) return null;
    const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
    const ageLabel = getAgeLabel(currentBabyData.birthDate);
    return (
      <Animated.View entering={FadeInUp} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={100} showEditButton onEdit={showPhotoOptions} />
            {isUploading && <View style={styles.uploadingOverlay}><ActivityIndicator color="#fff" size="large" /></View>}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>{ageLabel} old • {genderOption?.label}</Text>
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
          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' },
    { key: 'insights' as ProfileTab, label: 'Insights', icon: 'analytics-outline' },
    { key: 'danger' as ProfileTab, label: 'Danger', icon: 'warning-outline' },
  ];

  const renderOverview = () => {
    const allBabyActivities = currentBabyData?.id ? getEntriesByBaby(currentBabyData.id) : [];
    return (
      <Animated.View entering={FadeInUp} style={styles.tabPanel}>
        <QuickActionsDock
          onAddActivity={() => navigation.navigate('UniversalAddLog' as never, { babyId: currentBabyData?.id } as never)}
          onGrowth={() => navigation.navigate('GrowthDashboard' as never, { babyId: currentBabyData?.id } as never)}
          onMedication={() => navigation.navigate('Timeline' as never, { type: 'medication' } as never)}
          onTimeline={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)}
          onFamilyChat={() => navigation.navigate('FamilyChat' as never, { memberName: 'Family', memberRole: 'family' } as never)}
        />
        <View style={styles.kpiPillRow}>
          <KpiPill icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#fa709a" />
          <KpiPill icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#f59e0b" />
          <KpiPill icon="📸" value={babyStats?.photos || 0} label="Photos" color="#8b5cf6" />
        </View>
        <AIGrowthPrediction baby={currentBabyData} milestones={milestones} />
        <DailyPatternInsights activities={allBabyActivities} />
        <GrowthVelocityTracker baby={currentBabyData} activities={allBabyActivities} />
        <SmartHealthMonitor baby={currentBabyData} />
        <FamilyEngagementScore familyMembers={familyMembers} activities={allBabyActivities} />
        <SectionHeader title="Family" action={() => navigation.navigate('FamilySettings' as never)} actionLabel="Manage" />
        <GlassCard>
          <View style={styles.familyRow}>
            <View style={styles.familyAvatars}>
              {familyMembers.slice(0, 3).map((member, idx) => (
                <View key={member.id} style={[styles.familyAvatar, { marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx, backgroundColor: member.avatar ? 'transparent' : '#667eea' }]}>
                  {member.avatar ? <Image source={{ uri: member.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Text style={styles.familyAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>}
                </View>
              ))}
              {familyMembers.length > 3 && <View style={[styles.familyAvatar, styles.familyAvatarMore, { marginLeft: -12 }]}><Text style={styles.familyAvatarMoreText}>+{familyMembers.length - 3}</Text></View>}
            </View>
            <View style={styles.familyContent}>
              <Text style={[styles.familyTitle, isDark && styles.textDark]}>{familyMembers.length} Family Members</Text>
              <Text style={styles.familySubtitle}>Manage access & permissions</Text>
            </View>
          </View>
        </GlassCard>
        <SectionHeader title="Recent Activity" action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)} actionLabel="View All" />
        {recentActivities.length > 0 ? (
          recentActivities.map((activity, index) => {
            const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
            return (
              <GlassCard key={activity.id || index} style={styles.activityItemCard} delay={400 + index * 50}>
                <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}><Text style={styles.activityEmoji}>{config.emoji}</Text></View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, isDark && styles.textDark]}>{activity.title || config.label}</Text>
                  <Text style={styles.activityTime}>{format(activity.timestamp, 'MMM d, h:mm a')}</Text>
                  {activity.details && <Text style={styles.activityDetails}>{activity.details}</Text>}
                </View>
                <View style={styles.activityArrow}><Ionicons name="chevron-forward" size={16} color={isDark ? '#667eea' : '#764ba2'} /></View>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard style={styles.emptyCard} delay={400}>
            <View style={styles.emptyStateIcon}><Ionicons name="document-text-outline" size={32} color="#667eea" /></View>
            <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
            <Text style={styles.emptyText}>Start tracking your baby's daily activities to see them here.</Text>
          </GlassCard>
        )}
      </Animated.View>
    );
  };

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
                <View style={[styles.milestoneIcon, { backgroundColor: `${category?.color || '#667eea'}20` }]}>
                  <Ionicons name={category?.icon as any || 'star'} size={24} color={category?.color || '#667eea'} />
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneTitle, isDark && styles.textDark]}>{milestone.title}</Text>
                  <Text style={[styles.milestoneCategory, { color: category?.color || '#667eea' }]}>{category?.label}</Text>
                  <Text style={styles.milestoneDate}>{format(new Date(milestone.achievedAt), 'MMM d, yyyy')}</Text>
                </View>
                <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => handleDeleteMilestone(milestone.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {milestone.description && <Text style={styles.milestoneDescription}>{milestone.description}</Text>}
            </GlassCard>
          );
        })
      ) : (
        <GlassCard style={styles.emptyCard} delay={100}>
          <View style={styles.emptyStateIcon}><Ionicons name="trophy-outline" size={32} color="#f59e0b" /></View>
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
              <Ionicons name="create-outline" size={20} color="#667eea" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Blood Type</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="water-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={bloodType} onChangeText={(text) => { setBloodType(text); setIsEditing(true); }} placeholder="e.g., O+" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Allergies (comma separated)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="warning-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={allergies} onChangeText={(text) => { setAllergies(text); setIsEditing(true); }} placeholder="e.g., Peanuts, Dairy" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Weight (kg)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="fitness-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={weight} onChangeText={(text) => { setWeight(text); setIsEditing(true); }} placeholder="e.g., 4.2" keyboardType="decimal-pad" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Height (cm)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="resize-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={height} onChangeText={(text) => { setHeight(text); setIsEditing(true); }} placeholder="e.g., 58" keyboardType="decimal-pad" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Medical Notes</Text>
          <TextInput style={[styles.textArea, isDark && styles.textAreaDark, !isEditing && styles.inputDisabled]} value={medicalNotes} onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }} placeholder="Any important medical information..." multiline numberOfLines={4} placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
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
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={emergencyContact} onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }} placeholder="e.g., +1 (555) 123-4567" keyboardType="phone-pad" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Pediatrician</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={pediatrician} onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }} placeholder="Dr. Smith - City Children's Hospital" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} />
          </View>
        </View>
      </GlassCard>
      <GlassCard style={styles.formCard} delay={300}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Preferences</Text>
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="notifications-outline" size={22} color="#667eea" />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Receive milestone & health reminders</Text>
            </View>
          </View>
          <Switch value={notificationsEnabled} onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }} trackColor={{ false: '#cbd5e1', true: '#667eea' }} thumbColor="#fff" disabled={!isEditing} />
        </View>
      </GlassCard>
      <SectionHeader title="Quick Actions" />
      <GlassCard style={styles.actionCard} delay={400} onPress={() => navigation.navigate('Timeline' as never, { type: 'medication' } as never)}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#ef444418' }]}><Ionicons name="medical-outline" size={26} color="#ef4444" /></View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Medications</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Track medications & dosages</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>
      <GlassCard style={styles.actionCard} delay={500} onPress={() => navigation.navigate('Timeline' as never, { type: 'sleep' } as never)}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#3b82f618' }]}><Ionicons name="moon-outline" size={26} color="#3b82f6" /></View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Sleep Tracking</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Monitor sleep patterns</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>
      <GlassCard style={styles.actionCard} delay={600} onPress={() => navigation.navigate('Timeline' as never, { type: 'feed' } as never)}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#f59e0b18' }]}><Ionicons name="restaurant-outline" size={26} color="#f59e0b" /></View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Feeding Log</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Record meals & nutrition</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>
      <GlassCard style={styles.actionCard} delay={700} onPress={() => navigation.navigate('GrowthDashboard' as never, { babyId: currentBabyData?.id } as never)}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#10b98118' }]}><Ionicons name="trending-up-outline" size={26} color="#10b981" /></View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Growth Charts</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>View detailed growth analytics</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderInsights = () => {
    const allBabyActivities = currentBabyData?.id ? getEntriesByBaby(currentBabyData.id) : [];
    return (
      <Animated.View entering={FadeInUp} style={styles.tabPanel}>
        <AIGrowthPrediction baby={currentBabyData} milestones={milestones} />
        <DailyPatternInsights activities={allBabyActivities} />
        <GrowthVelocityTracker baby={currentBabyData} activities={allBabyActivities} />
        <SmartHealthMonitor baby={currentBabyData} />
        <FamilyEngagementScore familyMembers={familyMembers} activities={allBabyActivities} />
        <SectionHeader title="Activity Breakdown" />
        {allBabyActivities.length > 0 ? (
          <GlassCard>
            <View style={styles.breakdownContainer}>
              {Object.entries(allBabyActivities.reduce((acc: any, act: any) => { acc[act.type] = (acc[act.type] || 0) + 1; return acc; }, {} as Record<string, number>))
                .sort(([, a], [, b]) => (b as number) - (a as number)).map(([type, count]) => {
                  const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.note;
                  const percentage = Math.round((count as number / allBabyActivities.length) * 100);
                  return (
                    <View key={type} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.breakdownIcon, { backgroundColor: `${config.color}20` }]}><Text style={styles.breakdownEmoji}>{config.emoji}</Text></View>
                        <Text style={[styles.breakdownLabel, isDark && styles.textDark]}>{config.label}</Text>
                      </View>
                      <View style={styles.breakdownRight}>
                        <View style={[styles.breakdownBar, { backgroundColor: `${config.color}15` }]}>
                          <View style={[styles.breakdownFill, { backgroundColor: config.color, width: `${percentage}%` }]} />
                        </View>
                        <Text style={[styles.breakdownCount, { color: config.color }]}>{count}</Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyStateIcon}><Ionicons name="analytics-outline" size={32} color="#667eea" /></View>
            <Text style={styles.emptyStateTitle}>No Data Yet</Text>
            <Text style={styles.emptyText}>Start logging activities to see insights here.</Text>
          </GlassCard>
        )}
      </Animated.View>
    );
  };

  const renderDangerZone = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.dangerCard} delay={100}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}><Ionicons name="warning" size={32} color="#fff" /></LinearGradient>
        </View>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDescription}>Permanently delete {currentBabyData?.name}'s profile and all associated data. This action cannot be undone.</Text>
        <View style={styles.dangerStats}>
          <View style={styles.dangerStat}><Ionicons name="images-outline" size={20} color="#94a3b8" /><Text style={styles.dangerStatText}>{babyStats?.photos || 0} Photos</Text></View>
          <View style={styles.dangerStat}><Ionicons name="trophy-outline" size={20} color="#94a3b8" /><Text style={styles.dangerStatText}>{babyStats?.milestones || 0} Milestones</Text></View>
          <View style={styles.dangerStat}><Ionicons name="document-text-outline" size={20} color="#94a3b8" /><Text style={styles.dangerStatText}>{babyStats?.entries || 0} Entries</Text></View>
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

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />
      {renderStickyHeader()}
      <AutoHideAnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        <View style={styles.tabBarContainer}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={(tab) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab(tab); }} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'milestones' && renderMilestones()}
          {activeTab === 'health' && renderHealthForm()}
          {activeTab === 'insights' && renderInsights()}
          {activeTab === 'danger' && renderDangerZone()}
        </View>
      </AutoHideAnimatedScrollView>
      <EmojiPicker />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — Completely Redesigned to match EditGuardianScreen quality
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, maxWidth: 180 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#667eea', minWidth: 60, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.35)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#64748b' },

  // ── Profile Hero ──
  profileHero: { paddingHorizontal: 20, paddingBottom: 20 },
  profileHeroContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarSection: { position: 'relative' },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, color: '#64748b', marginTop: 2, fontWeight: '500' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  editToggleBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Tab Bar ──
  tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, ...DESIGN.shadow.md },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', ...DESIGN.shadow.md, marginBottom: DESIGN.spacing.lg,
  },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#667eea' },

  // ── KPI Pills ──
  kpiPillRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, ...DESIGN.shadow.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Quick Actions Dock ──
  dockContainer: { marginBottom: 16 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...DESIGN.shadow.md },
  dockLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // ── AI Growth Prediction ──
  aiCardHeader: { padding: 16, paddingBottom: 8 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(102,126,234,0.1)' },
  aiBadgeText: { fontSize: 11, fontWeight: '700', color: '#667eea' },
  aiPredictionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  aiPredictionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiPredictionEmoji: { fontSize: 32 },
  aiPredictionInfo: { flex: 1 },
  aiPredictionTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  aiPredictionDue: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  aiProgressRing: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(102,126,234,0.15)' },
  aiProgressBg: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(102,126,234,0.1)' },
  aiProgressFill: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderTopColor: '#667eea', borderRightColor: 'transparent', borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  aiProgressCenter: { alignItems: 'center' },
  aiProgressText: { fontSize: 16, fontWeight: '800', color: '#667eea' },
  aiProgressLabel: { fontSize: 9, fontWeight: '600', color: '#94a3b8' },
  aiProgressBar: { height: 4, backgroundColor: 'rgba(102,126,234,0.1)', marginHorizontal: 16, marginBottom: 16, borderRadius: 2, overflow: 'hidden' },
  aiProgressBarFill: { height: '100%', backgroundColor: '#667eea', borderRadius: 2 },

  // ── Daily Patterns ──
  patternList: { gap: 8, marginBottom: 16 },
  patternRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  patternIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  patternEmoji: { fontSize: 20 },
  patternContent: { flex: 1, marginLeft: 12 },
  patternTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  patternDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  patternIndicator: { width: 6, height: 6, borderRadius: 3 },

  // ── Growth Velocity ──
  growthRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  growthMetric: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  growthIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  growthValue: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  growthLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  growthDivider: { width: 1, height: 40, backgroundColor: 'rgba(100,116,139,0.15)' },
  growthSparkline: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 70 },
  growthBar: { width: 8, borderRadius: 4 },
  growthBarLabel: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  // ── Smart Health ──
  healthList: { gap: 8, marginBottom: 16 },
  healthRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  healthIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  healthContent: { flex: 1, marginLeft: 12 },
  healthTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  healthDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  healthStatusDot: { width: 6, height: 6, borderRadius: 3 },

  // ── Family Engagement ──
  engagementList: { padding: 8 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  engagementAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  engagementAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  engagementInfo: { flex: 1 },
  engagementName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  engagementRole: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  engagementBarContainer: { width: 80, alignItems: 'flex-end' },
  engagementBarBg: { width: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  engagementBarFill: { height: '100%', borderRadius: 2 },
  engagementCount: { fontSize: 10, fontWeight: '600', color: '#94a3b8', marginTop: 4 },

  // ── Avatar ──
  avatarWrapper: { position: 'relative' },
  avatarGradient: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  avatarEmoji: {},
  editAvatarBtn: { position: 'absolute', width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  editAvatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  // ── Family Card ──
  familyRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  familyAvatars: { flexDirection: 'row', marginRight: 16 },
  familyAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  familyAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  familyAvatarMore: { backgroundColor: '#64748b', alignItems: 'center', justifyContent: 'center' },
  familyAvatarMoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  familyContent: { flex: 1 },
  familyTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 3 },
  familySubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  // ── Activity ──
  activityItemCard: { marginVertical: 6, padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  activityIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  activityEmoji: { fontSize: 24 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  activityTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  activityDetails: { fontSize: 12, color: '#64748b', marginTop: 2 },
  activityArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Form Card ──
  formCard: { padding: 0, marginBottom: 16 },
  sectionHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  editIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  editingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  inputGroup: { marginBottom: 20, paddingHorizontal: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 18, paddingHorizontal: 18, height: 56, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  inputContainerDark: { backgroundColor: 'rgba(30,30,40,0.5)', borderColor: 'rgba(255,255,255,0.06)' },
  inputDisabled: { opacity: 0.6 },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, fontSize: 17, color: '#1e293b', fontWeight: '600' },
  inputDark: { color: '#ffffff' },
  textArea: { height: 110, textAlignVertical: 'top', paddingTop: 18, backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 18, paddingHorizontal: 18, fontSize: 17, color: '#1e293b', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  textAreaDark: { backgroundColor: 'rgba(30,30,40,0.5)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.06)' },

  genderContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  genderButton: { flex: 1, backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 20, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  genderButtonDisabled: { opacity: 0.5 },
  genderText: { fontSize: 15, fontWeight: '600', color: '#64748b', marginTop: 10 },
  genderTextDark: { color: '#94a3b8' },

  skinContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingHorizontal: 20 },
  skinButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  skinButtonActive: { borderColor: '#fff', transform: [{ scale: 1.1 }], shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  skinButtonDisabled: { opacity: 0.5 },
  skinToneLabel: { textAlign: 'center', marginTop: 12, fontSize: 14, fontWeight: '600', color: '#64748b' },

  tabPanel: { marginTop: 4, gap: 16 },

  // ── Milestones ──
  addMilestoneBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 8, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  addMilestoneGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  addMilestoneText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  milestoneCard: { padding: 0, marginBottom: 12, borderRadius: 20 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  milestoneIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 3 },
  milestoneCategory: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', marginBottom: 3 },
  milestoneDate: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  milestoneDescription: { fontSize: 14, color: '#64748b', marginTop: 10, lineHeight: 20, fontWeight: '500', paddingHorizontal: 16, paddingBottom: 16 },
  deleteEntryBtn: { padding: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },

  // ── Empty States ──
  emptyCard: { padding: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', fontWeight: '500', lineHeight: 22 },

  // ── Action Cards ──
  actionCard: { padding: 0, marginBottom: 12, borderRadius: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  actionIconBg: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  actionSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  // ── Danger Zone ──
  dangerCard: { padding: 24, alignItems: 'center', borderColor: '#ef4444', borderWidth: 2, borderRadius: 24 },
  dangerIconContainer: { marginBottom: 16 },
  dangerIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 24, fontWeight: '800', color: '#ef4444', marginBottom: 8 },
  dangerDescription: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  dangerStats: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  dangerStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dangerStatText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  deleteButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  deleteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  dangerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  dangerNoteText: { fontSize: 13, color: '#94a3b8' },

  // ── Preferences ──
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  preferenceDesc: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  // ── Insights Breakdown ──
  breakdownContainer: { padding: 16 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownEmoji: { fontSize: 16 },
  breakdownLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownBar: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownCount: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  // ── Emoji Picker ──
  emojiPickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 1000 },
  emojiPickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  emojiPickerSheetDark: { backgroundColor: '#1a1a2e' },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  emojiPickerTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  emojiButton: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(100,116,139,0.08)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 32 },
});