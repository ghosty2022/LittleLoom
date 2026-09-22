// src/screens/baby/FamilyDashboardScreen.tsx
// Redesigned — deduped against Timeline/Growth/FamilySharing screens.

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { differenceInMonths, format } from 'date-fns';
import Animated, {
  FadeInUp,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  Layout,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useFamily } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { UserRole } from '../../types/roles';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import OptimizedImage from '../../components/OptimizedImage';

const AnimatedScrollView = Animated.ScrollView;

type FamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    color: string;
    gradient: [string, string];
    icon: keyof typeof Ionicons.glyphMap;
    badge: string;
  }
> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    icon: 'shield',
    badge: 'Owner',
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    icon: 'heart',
    badge: 'Co-Parent',
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    icon: 'shield-checkmark',
    badge: 'Guardian',
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    badge: 'Viewer',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

// ─── SafeAvatar ──────────────────────────────────────────────────────

interface SafeAvatarProps {
  avatar?: string | null;
  gender?: string;
  size?: number;
  showEditButton?: boolean;
  onEdit?: () => void;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
}

const SafeAvatar = memo<SafeAvatarProps>(
  ({ avatar, gender = 'other', size = 56, showEditButton = false, onEdit, fallbackIcon, fallbackColor }) => {
    const [imageError, setImageError] = useState(false);
    const hasImage = isImageUri(avatar) && !imageError;
    const hasEmoji = isEmoji(avatar);

    const gradientColors =
      gender === 'boy'
        ? ['#667eea', '#764ba2']
        : gender === 'girl'
        ? ['#fa709a', '#fee140']
        : ['#11998e', '#38ef7d'];

    const iconName = fallbackIcon || (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'person');
    const color = fallbackColor || (gender === 'boy' ? '#667eea' : gender === 'girl' ? '#fa709a' : '#11998e');

    const normalizedUri = useMemo(() => {
      if (!avatar) return null;
      if (avatar.startsWith('file://') && Platform.OS === 'android') {
        try {
          return avatar.replace(/file:\/\//g, 'file://').replace('file://', 'file:///');
        } catch {
          return avatar;
        }
      }
      return avatar;
    }, [avatar]);

    return (
      <View style={[styles.avatarWrapper, { width: size, height: size }]}>
        <LinearGradient
          colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
          style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2.8 }]}
        >
          {hasImage && normalizedUri ? (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2.8,
                overflow: 'hidden',
                backgroundColor: '#f0f0f0',
              }}
            >
              <OptimizedImage
                source={{ uri: normalizedUri }}
                style={{ width: size, height: size }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onError={() => setImageError(true)}
                transition={200}
              />
            </View>
          ) : hasEmoji ? (
            <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
          ) : (
            <Ionicons name={iconName as any} size={size * 0.4} color="#fff" />
          )}
        </LinearGradient>

        {showEditButton && onEdit && (
          <TouchableOpacity
            style={[styles.editAvatarBtn, { bottom: -4, right: -4 }]}
            onPress={onEdit}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.editAvatarGradient}>
              <Ionicons name="camera" size={14} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

// ─── GlassCard ───────────────────────────────────────────────────────

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  isDark?: boolean;
  radius?: number;
}

const GlassCard = memo<GlassCardProps>(({ children, style, onPress, isDark = false, radius = DESIGN.radius.lg }) => {
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[styles.glassCard, { borderRadius: radius }, isDark && styles.glassCardDark, style]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)']
            : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {children}
    </Wrapper>
  );
});

// ─── StatBadge ───────────────────────────────────────────────────────

interface StatBadgeProps {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  isDark: boolean;
}

const StatBadge = memo<StatBadgeProps>(({ icon, value, label, color, isDark }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
  </View>
));

// ─── ActionModal ─────────────────────────────────────────────────────

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  title,
  children,
  isDark,
  showCloseButton = true,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View
          entering={FadeInUp.springify()}
          style={[styles.modalContent, isDark && styles.modalContentDark]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)']
                : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']
            }
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            )}
          </View>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {children}
          </Animated.ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Today at a Glance
// ═══════════════════════════════════════════════════════════════════════════

interface TodayGlanceStat {
  key: string;
  icon: string;
  label: string;
  count: number;
  color: string;
}

const TodayAtAGlance = memo<{
  stats: TodayGlanceStat[];
  isDark: boolean;
  onPressStat: (key: string) => void;
  shouldReduceMotion: boolean;
}>(({ stats, isDark, onPressStat, shouldReduceMotion }) => (
  <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
    <View style={styles.sectionHeader}>
      <View>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Today at a Glance</Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
          Quick snapshot for {format(new Date(), 'EEEE, MMM d')}
        </Text>
      </View>
    </View>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.glanceScroll}
    >
      {stats.map((stat) => (
        <TouchableOpacity
          key={stat.key}
          activeOpacity={0.85}
          onPress={() => onPressStat(stat.key)}
          style={[
            styles.glanceCard,
            isDark ? styles.glanceCardDark : styles.glanceCardLight,
            { borderColor: stat.color + '30' },
          ]}
        >
          <View style={[styles.glanceIconBg, { backgroundColor: stat.color + '15' }]}>
            <Text style={styles.glanceIcon}>{stat.icon}</Text>
          </View>
          <Text style={[styles.glanceCount, { color: stat.color }]}>{stat.count}</Text>
          <Text style={[styles.glanceLabel, isDark && styles.textMuted]}>{stat.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </Animated.View>
));

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Smart Suggestion of the Day (single card, not a horizontal scroller)
// ═══════════════════════════════════════════════════════════════════════════

interface SuggestionOfTheDayProps {
  isDark: boolean;
  suggestion: {
    icon: string;
    title: string;
    description: string;
    color: string;
    actionLabel: string;
  } | null;
  onAction: () => void;
  shouldReduceMotion: boolean;
}

const SuggestionOfTheDay = memo<SuggestionOfTheDayProps>(
  ({ isDark, suggestion, onAction, shouldReduceMotion }) => {
    if (!suggestion) return null;
    return (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
        <GlassCard isDark={isDark}>
          <View style={styles.suggestionRow}>
            <LinearGradient
              colors={[suggestion.color, suggestion.color + 'AA']}
              style={styles.suggestionIconBg}
            >
              <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
            </LinearGradient>
            <View style={styles.suggestionBody}>
              <Text style={[styles.suggestionKicker, { color: suggestion.color }]}>
                SUGGESTION OF THE DAY
              </Text>
              <Text style={[styles.suggestionTitle, isDark && styles.textDark]} numberOfLines={2}>
                {suggestion.title}
              </Text>
              <Text style={[styles.suggestionDesc, isDark && styles.textMuted]} numberOfLines={2}>
                {suggestion.description}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.85}
            style={[styles.suggestionActionBtn, { backgroundColor: suggestion.color + '15' }]}
          >
            <Text style={[styles.suggestionActionText, { color: suggestion.color }]}>
              {suggestion.actionLabel}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={suggestion.color} />
          </TouchableOpacity>
        </GlassCard>
      </Animated.View>
    );
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Who's Active Today (compact, one line per contributor)
// ═══════════════════════════════════════════════════════════════════════════

interface TodayContributor {
  id: string;
  name: string;
  avatar?: string;
  count: number;
}

const WhosActiveToday = memo<{
  contributors: TodayContributor[];
  isDark: boolean;
  themeColors: any;
  onPressSeeAll: () => void;
  shouldReduceMotion: boolean;
}>(({ contributors, isDark, themeColors, onPressSeeAll, shouldReduceMotion }) => {
  if (contributors.length === 0) return null;
  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).springify()}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Active Today</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
            {contributors.length} {contributors.length === 1 ? 'contributor' : 'contributors'}
          </Text>
        </View>
        <TouchableOpacity onPress={onPressSeeAll} style={styles.seeAllBtn}>
          <Text style={[styles.seeAll, { color: themeColors.primary }]}>Timeline</Text>
          <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
        </TouchableOpacity>
      </View>
      <GlassCard isDark={isDark}>
        {contributors.map((c, i) => (
          <View
            key={c.id}
            style={[
              styles.contributorRow,
              i > 0 && {
                borderTopWidth: 1,
                borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,116,139,0.08)',
              },
            ]}
          >
            <SafeAvatar avatar={c.avatar} size={32} />
            <Text style={[styles.contributorName, isDark && styles.textDark]} numberOfLines={1}>
              {c.name}
            </Text>
            <View style={[styles.contributorCountBadge, { backgroundColor: themeColors.primary + '15' }]}>
              <Text style={[styles.contributorCountText, { color: themeColors.primary }]}>
                {c.count} {c.count === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
          </View>
        ))}
      </GlassCard>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function FamilyDashboardScreen({ navigation }: FamilyCenterScreenProps) {
  const systemDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { userProfile } = useAuth();
  const { profile } = useUser();
  const {
    babies,
    currentBaby,
    currentBabyId,
    switchBaby,
    growthData,
    milestones,
    activities,
    loadBabies,
    getPottyStreak,
  } = useBaby();
  const { members, loadFamily } = useFamily();
  const sweetAlert = useSweetAlert();

  const { darkMode, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const isDark = darkMode ?? systemDark;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'growth'>('overview');
  const [showBabySelector, setShowBabySelector] = useState(false);

  const effectiveUser = useMemo(() => userProfile || profile, [userProfile, profile]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(10,10,10,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`
      : `rgba(248,250,252,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`,
    borderBottomColor: isDark
      ? `rgba(255,255,255,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`
      : `rgba(0,0,0,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`,
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    InteractionManager.runAfterInteractions(async () => {
      await Promise.all([loadBabies(), loadFamily()]);
      setRefreshing(false);
    });
  }, [loadBabies, loadFamily]);

  const handleSwitchBaby = useCallback(
    (babyId: string) => {
      if (babyId === currentBabyId) return;
      triggerHaptic('light');
      switchBaby(babyId);
    },
    [currentBabyId, switchBaby, triggerHaptic]
  );

  // ─── Handlers ────────────────────────────────────────────────────

  const handleBabyEdit = useCallback(
    (babyId: string) => {
      navigation.navigate('EditProfile', { mode: 'baby', babyId });
    },
    [navigation]
  );

  const handleCurrentUserEdit = useCallback(() => {
    if (effectiveUser?.id) {
      navigation.navigate('EditGuardian', { guardianId: effectiveUser.id, mode: 'parent2' });
    }
  }, [navigation, effectiveUser]);

  const handleNavigateFamily = useCallback(() => navigation.navigate('FamilySharing'), [navigation]);
  const handleNavigateFamilySettings = useCallback(() => navigation.navigate('FamilySettings'), [navigation]);
  const handleNavigateTimeline = useCallback(() => navigation.navigate('Timeline'), [navigation]);
  const handleNavigateAchievements = useCallback(() => navigation.navigate('Achievements'), [navigation]);
  const handleNavigateGrowthChart = useCallback(() => navigation.navigate('GrowthDashboard'), [navigation]);
  const handleNavigateCreateBaby = useCallback(() => navigation.navigate('CreateBabyProfile'), [navigation]);
  const handleNavigateInvite = useCallback(() => navigation.navigate('CoParentInviteScreen'), [navigation]);

  const { entries: trackerEntries } = useTracker();

  // ─── Today at a Glance data ──────────────────────────────────────
  const todayStats = useMemo<TodayGlanceStat[]>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEntries = trackerEntries.filter(
      (e: any) => e.timestamp >= todayStart.getTime() && !e.isDeleted
    );
    const countBy = (id: string) => todayEntries.filter((e: any) => e.trackerId === id).length;
    return [
      { key: 'feed', icon: '🍼', label: 'Feeds', count: countBy('feed'), color: '#f59e0b' },
      { key: 'sleep', icon: '😴', label: 'Sleeps', count: countBy('sleep'), color: '#8b5cf6' },
      { key: 'diaper', icon: '🧷', label: 'Diapers', count: countBy('diaper'), color: '#06b6d4' },
      { key: 'potty', icon: '🚽', label: 'Potty', count: countBy('potty'), color: '#10b981' },
      { key: 'medication', icon: '💊', label: 'Meds', count: countBy('medication'), color: '#ef4444' },
    ].filter(s => s.count > 0 || ['feed', 'sleep', 'diaper'].includes(s.key));
  }, [trackerEntries]);

  // ─── Suggestion of the Day ───────────────────────────────────────
  const suggestionOfTheDay = useMemo(() => {
    if (currentBaby) {
      const ageMonths = differenceInMonths(new Date(), new Date(currentBaby.birthDate || currentBaby.dateOfBirth || new Date()));
      if (ageMonths >= 4 && ageMonths <= 8) {
        return {
          icon: '👶',
          title: 'Tummy time matters',
          description: `At ${ageMonths} months, aim for 3 short tummy-time sessions daily to build core strength.`,
          color: '#10b981',
          actionLabel: 'Learn More',
        };
      }
      if (ageMonths >= 10 && ageMonths <= 14) {
        return {
          icon: '🗣️',
          title: 'First words approaching',
          description: 'Baby is near the age where first words typically emerge. Narrate your day to encourage speech.',
          color: '#f59e0b',
          actionLabel: 'Explore Milestones',
        };
      }
      if (ageMonths < 3) {
        return {
          icon: '📸',
          title: 'Capture this stage',
          description: 'Newborn weeks fly by — a quick photo today becomes tomorrow\'s treasure.',
          color: '#ec4899',
          actionLabel: 'Open Gallery',
        };
      }
    }
    return {
      icon: '📊',
      title: 'Check your weekly insights',
      description: 'See patterns in feeding, sleep, and growth this week.',
      color: themeColors.primary,
      actionLabel: 'View Insights',
    };
  }, [currentBaby, themeColors.primary]);

  // ─── Who's active today ──────────────────────────────────────────
  const todayContributors = useMemo<TodayContributor[]>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const map = new Map<string, TodayContributor>();
    trackerEntries.forEach((e: any) => {
      if (e.isDeleted || e.timestamp < todayStart.getTime()) return;
      const key = e.loggedBy || e.loggedByName || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Try to match with a family member for avatar
        const memberMatch = members.find(
          (m) => m.userId === e.loggedBy || m.id === e.loggedBy || m.fullName === e.loggedByName
        );
        map.set(key, {
          id: key,
          name: e.loggedByName || memberMatch?.fullName || 'Someone',
          avatar: memberMatch?.avatar,
          count: 1,
        });
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [trackerEntries, members]);

  // ─── Suggestion action ───────────────────────────────────────────
  const handleSuggestionAction = useCallback(() => {
    triggerHaptic('medium');
    if (suggestionOfTheDay.actionLabel === 'View Insights') {
      navigation.navigate('Insights');
    } else if (suggestionOfTheDay.actionLabel === 'Explore Milestones') {
      navigation.navigate('Achievements');
    } else if (suggestionOfTheDay.actionLabel === 'Open Gallery') {
      navigation.navigate('Gallery');
    } else {
      sweetAlert.toast('Coming Soon', 'This tip will be actionable soon', 'info');
    }
  }, [suggestionOfTheDay, navigation, sweetAlert, triggerHaptic]);

  // ─── Tap on Today stat ───────────────────────────────────────────
  const handleTodayStatPress = useCallback(
    (key: string) => {
      triggerHaptic('light');
      navigation.navigate('Timeline', { trackerId: key, filter: 'today' });
    },
    [navigation, triggerHaptic]
  );

  // ─── Render Header ───────────────────────────────────────────────
  const renderHeader = () => (
    <Animated.View
      style={[styles.headerContainer, { paddingTop: insets.top }, headerAnimatedStyle]}
      pointerEvents="box-none"
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, isDark && styles.headerBtnDark]}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family</Text>
          {currentBaby && (
            <TouchableOpacity
              style={[styles.babySelectorChip, { backgroundColor: themeColors.colors[0] }]}
              onPress={() => setShowBabySelector(true)}
            >
              <Text style={[styles.babySelectorText, { color: themeColors.primary }]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.headerBtn, styles.headerBtnAccent, { backgroundColor: themeColors.primary }]}
          onPress={handleNavigateInvite}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateTimeline}>
          <Ionicons name="time" size={22} color="#10b981" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateAchievements}>
          <Ionicons name="trophy" size={22} color="#f59e0b" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Milestones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateGrowthChart}>
          <Ionicons name="trending-up" size={22} color={themeColors.primary} />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Growth</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateFamilySettings}>
          <Ionicons name="settings" size={22} color="#8b5cf6" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Modern Tab Bar — removed "family" tab (was just a redirect) */}
      <View style={[styles.modernTabBar, isDark && styles.modernTabBarDark]}>
        {(['overview', 'growth'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const iconName = tab === 'overview' ? 'grid' : 'trending-up';
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.modernTab,
                isActive && [styles.modernTabActive, { backgroundColor: themeColors.colors[0] }],
              ]}
              onPress={() => {
                triggerHaptic('light');
                setActiveTab(tab);
              }}
            >
              <Ionicons
                name={iconName as any}
                size={16}
                color={isActive ? themeColors.primary : isDark ? '#94a3b8' : '#64748b'}
              />
              <Text
                style={[
                  styles.modernTabText,
                  isActive && [styles.modernTabTextActive, { color: themeColors.primary }],
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );

  // ─── Overview Tab ────────────────────────────────────────────────
  const renderOverview = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabPanel}>
      {/* Stats Summary */}
      <LinearGradient
        colors={[themeColors.colors[0], themeColors.colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.familyStatsGradient}
      >
        <View style={styles.familyStatsRow}>
          {[
            { value: members.length, label: 'Members' },
            { value: babies.length, label: 'Babies' },
            { value: activities.length, label: 'Activities' },
            { value: milestones.length, label: 'Milestones' },
          ].map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && (
                <View
                  style={[
                    styles.familyStatDivider,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                  ]}
                />
              )}
              <View style={styles.familyStat}>
                <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{stat.value}</Text>
                <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      {/* NEW: Today at a Glance */}
      <TodayAtAGlance
        stats={todayStats}
        isDark={isDark}
        onPressStat={handleTodayStatPress}
        shouldReduceMotion={shouldReduceMotion}
      />

      {/* NEW: Suggestion of the Day */}
      <SuggestionOfTheDay
        isDark={isDark}
        suggestion={suggestionOfTheDay}
        onAction={handleSuggestionAction}
        shouldReduceMotion={shouldReduceMotion}
      />

      {/* Slim Hero Card */}
      {currentBaby && (
        <GlassCard isDark={isDark} style={styles.heroCard} radius={DESIGN.radius.xl}>
          <View style={styles.heroHeader}>
            <SafeAvatar
              avatar={currentBaby.avatar}
              gender={currentBaby.gender}
              size={64}
              showEditButton
              onEdit={() => handleBabyEdit(currentBaby.id)}
            />
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, isDark && styles.textDark]}>{currentBaby.name}</Text>
              <Text style={[styles.heroMeta, isDark && styles.textMuted]}>
                {currentBaby.age} • {currentBaby.gender}
              </Text>
              <View style={styles.heroTags}>
                <View style={[styles.heroTag, { backgroundColor: '#fa709a20' }]}>
                  <Ionicons name="flame" size={12} color="#fa709a" />
                  <Text style={[styles.heroTagText, { color: '#fa709a' }]}>
                    {getPottyStreak()}d streak
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: themeColors.colors[0] }]}
              onPress={() => handleBabyEdit(currentBaby.id)}
            >
              <Ionicons name="create-outline" size={20} color={themeColors.primary} />
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}

      {/* NEW: Active Today */}
      <WhosActiveToday
        contributors={todayContributors}
        isDark={isDark}
        themeColors={themeColors}
        onPressSeeAll={handleNavigateTimeline}
        shouldReduceMotion={shouldReduceMotion}
      />

      {/* Compact Family Stack — replaces the old member rows */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200).springify()}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Your Family</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleNavigateFamily} style={styles.seeAllBtn}>
            <Text style={[styles.seeAll, { color: themeColors.primary }]}>Manage</Text>
            <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
          </TouchableOpacity>
        </View>
        <GlassCard isDark={isDark} onPress={handleNavigateFamily}>
          <View style={styles.familyStackRow}>
            {members.slice(0, 5).map((member, i) => (
              <View
                key={member.id}
                style={[
                  styles.stackAvatar,
                  {
                    marginLeft: i > 0 ? -12 : 0,
                    zIndex: members.length - i,
                    borderColor: isDark ? '#1a1a2e' : '#fff',
                  },
                ]}
              >
                <SafeAvatar avatar={member.avatar} size={44} />
              </View>
            ))}
            {members.length > 5 && (
              <View
                style={[
                  styles.stackAvatar,
                  styles.stackAvatarMore,
                  {
                    marginLeft: -12,
                    backgroundColor: isDark ? '#2a2a3c' : '#e2e8f0',
                    borderColor: isDark ? '#1a1a2e' : '#fff',
                  },
                ]}
              >
                <Text style={[styles.stackAvatarMoreText, isDark && styles.textDark]}>
                  +{members.length - 5}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={20} color={themeColors.primary} />
          </View>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );

  // ─── Growth Tab ──────────────────────────────────────────────────
  const renderGrowth = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabPanel}>
      <GlassCard isDark={isDark} style={styles.growthSummaryCard}>
        <View style={styles.growthStatsRow}>
          {[
            {
              icon: 'resize-outline',
              gradient: ['#667eea', '#764ba2'] as [string, string],
              value: `${growthData.filter((g) => g.type === 'height').pop()?.value || '--'}${
                growthData.filter((g) => g.type === 'height').pop()?.unit || ''
              }`,
              label: 'Height',
            },
            {
              icon: 'scale-outline',
              gradient: ['#fa709a', '#fee140'] as [string, string],
              value: `${growthData.filter((g) => g.type === 'weight').pop()?.value || '--'}${
                growthData.filter((g) => g.type === 'weight').pop()?.unit || ''
              }`,
              label: 'Weight',
            },
            {
              icon: 'analytics-outline',
              gradient: ['#11998e', '#38ef7d'] as [string, string],
              value: `${growthData.length}`,
              label: 'Records',
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.growthStatItem}>
              <LinearGradient colors={stat.gradient} style={styles.growthStatIcon}>
                <Ionicons name={stat.icon as any} size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={[styles.growthStatValue, isDark && styles.textDark]}>{stat.value}</Text>
                <Text style={[styles.growthStatLabel, isDark && styles.textMuted]}>{stat.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>

      <TouchableOpacity style={styles.fullChartBtn} onPress={handleNavigateGrowthChart}>
        <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.fullChartGradient}>
          <Ionicons name="trending-up" size={20} color="#fff" />
          <Text style={styles.fullChartText}>Full Growth Charts</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleNavigateAchievements}>
        <View
          style={[
            styles.secondaryBtnInner,
            { borderColor: themeColors.primary + '30', backgroundColor: themeColors.primary + '08' },
          ]}
        >
          <Ionicons name="trophy-outline" size={20} color={themeColors.primary} />
          <Text style={[styles.secondaryBtnText, { color: themeColors.primary }]}>
            View All Milestones
          </Text>
          <Ionicons name="chevron-forward" size={18} color={themeColors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {renderHeader()}

      <AnimatedScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 220 + insets.top, paddingBottom: insets.bottom + 30 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'growth' && renderGrowth()}
        <View style={styles.bottomSpacer} />
      </AnimatedScrollView>

      {/* Baby Selector Modal */}
      <ActionModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Select Baby"
        isDark={isDark}
      >
        <View style={styles.babySelectorContent}>
          {babies.map((baby) => {
            const isActive = currentBaby?.id === baby.id;
            return (
              <TouchableOpacity
                key={baby.id}
                style={[
                  styles.babyOption,
                  isActive && [
                    styles.babyOptionActive,
                    { borderColor: themeColors.primary, backgroundColor: themeColors.colors[0] },
                  ],
                  isDark && styles.babyOptionDark,
                ]}
                onPress={() => {
                  handleSwitchBaby(baby.id);
                  setShowBabySelector(false);
                }}
              >
                <View
                  style={[
                    styles.babyOptionIcon,
                    { backgroundColor: isActive ? themeColors.primary : isDark ? '#333' : '#e2e8f0' },
                  ]}
                >
                  {isImageUri(baby.avatar) ? (
                    <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={36} />
                  ) : (
                    <Text style={styles.babyOptionEmoji}>{baby.avatar || '👶'}</Text>
                  )}
                </View>
                <View style={styles.babyOptionInfo}>
                  <Text style={[styles.babyOptionName, isDark && styles.textDark]}>{baby.name}</Text>
                  <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                    {new Date(baby.dateOfBirth).toLocaleDateString()} • {baby.gender || 'Baby'}
                  </Text>
                </View>
                {isActive && <Ionicons name="checkmark" size={24} color={themeColors.primary} />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.addBabyOption, isDark && styles.addBabyOptionDark]}
            onPress={() => {
              setShowBabySelector(false);
              handleNavigateCreateBaby();
            }}
          >
            <View style={[styles.addBabyIcon, { backgroundColor: themeColors.colors[0] }]}>
              <Ionicons name="add" size={24} color={themeColors.primary} />
            </View>
            <Text style={[styles.addBabyText, isDark && styles.textDark, { color: themeColors.primary }]}>
              Add New Baby
            </Text>
          </TouchableOpacity>
        </View>
      </ActionModal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Base ──
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  containerDark: { backgroundColor: '#0a0a0a' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg },
  bottomSpacer: { height: 40 },

  // ── Avatar ──
  avatarWrapper: { position: 'relative', borderRadius: DESIGN.radius.md, overflow: 'hidden' },
  avatarGradient: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarEmoji: {},
  editAvatarBtn: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editAvatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  headerBtnDark: { backgroundColor: 'rgba(40,40,50,0.95)', borderColor: 'rgba(255,255,255,0.08)' },
  headerBtnAccent: { borderWidth: 0 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },
  babySelectorChip: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  babySelectorText: { fontSize: 12, fontWeight: '700' },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingTop: 2,
    paddingBottom: 10,
  },
  iconAction: { alignItems: 'center', padding: 6, minWidth: 60 },
  iconActionLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 4 },

  // ── Modern Tab Bar ──
  modernTabBar: {
    flexDirection: 'row',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.md,
    padding: 4,
    borderRadius: DESIGN.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.04)',
    gap: 4,
  },
  modernTabBarDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  modernTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modernTabActive: {},
  modernTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modernTabTextActive: { fontWeight: '700' },

  // ── Section headers ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, fontWeight: '700' },

  // ── Glass Card ──
  glassCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  glassCardDark: { borderColor: 'rgba(255,255,255,0.08)' },

  // ── Tab Panel ──
  tabPanel: { marginTop: 8, gap: 16 },

  // ── Family Stats ──
  familyStatsGradient: { borderRadius: DESIGN.radius.lg, padding: 16 },
  familyStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  familyStat: { alignItems: 'center', flex: 1 },
  familyStatValue: { fontSize: 22, fontWeight: '800' },
  familyStatLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 4 },
  familyStatDivider: { width: 1, height: 36 },

  // ── Today at a Glance ──
  glanceScroll: { gap: 10, paddingRight: 8, paddingBottom: 2 },
  glanceCard: {
    width: 96,
    padding: 12,
    borderRadius: DESIGN.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  glanceCardLight: { backgroundColor: 'rgba(255,255,255,0.98)' },
  glanceCardDark: { backgroundColor: 'rgba(45,45,60,0.9)' },
  glanceIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  glanceIcon: { fontSize: 20 },
  glanceCount: { fontSize: 22, fontWeight: '800' },
  glanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ── Suggestion of the Day ──
  suggestionRow: { flexDirection: 'row', gap: 12, padding: 16 },
  suggestionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIcon: { fontSize: 26 },
  suggestionBody: { flex: 1, gap: 4 },
  suggestionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  suggestionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  suggestionDesc: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  suggestionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  suggestionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Hero Card ──
  heroCard: { padding: 16 },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroInfo: { flex: 1, marginLeft: 14 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#1e293b', letterSpacing: -0.4 },
  heroMeta: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
  heroTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  heroTagText: { fontSize: 12, fontWeight: '700' },
  editBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // ── Active Today contributors ──
  contributorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  contributorName: { flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  contributorCountBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  contributorCountText: { fontSize: 12, fontWeight: '700' },

  // ── Compact family stack ──
  familyStackRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  stackAvatar: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
  },
  stackAvatarMore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarMoreText: { fontSize: 13, fontWeight: '800', color: '#1a1a1a' },

  // ── Growth Tab ──
  growthSummaryCard: { padding: 20 },
  growthStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  growthStatItem: { alignItems: 'center', gap: 10 },
  growthStatIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  growthStatValue: { fontSize: 18, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  growthStatLabel: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },

  fullChartBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  fullChartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  fullChartText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryBtn: { marginTop: 4 },
  secondaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryBtnText: { flex: 1, fontSize: 15, fontWeight: '700' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: DESIGN.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modalContentDark: { backgroundColor: '#1a1a2e' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScrollContent: { padding: 16 },

  // ── Baby Selector ──
  babySelectorContent: { padding: 16 },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  babyOptionActive: { borderWidth: 2, backgroundColor: 'rgba(102,126,234,0.05)' },
  babyOptionDark: { backgroundColor: 'rgba(255,255,255,0.03)' },
  babyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  babyOptionEmoji: { fontSize: 24 },
  babyOptionInfo: { flex: 1 },
  babyOptionName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.2 },
  babyOptionMeta: { fontSize: 13, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  addBabyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  addBabyOptionDark: { borderColor: 'rgba(255,255,255,0.08)' },
  addBabyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addBabyText: { fontSize: 16, fontWeight: '700' },
});