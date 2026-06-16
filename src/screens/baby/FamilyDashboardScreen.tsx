import React, { memo, useCallback, useMemo, useState } from 'react';

import { format, formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { AutoHideAnimatedScrollView, AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';

import { showAlert } from '@/utils/alert';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  Layout,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const AnimatedScrollView = AutoHideAnimatedScrollView;

type FamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

// ─── Shared Utilities ─────────────────────────────────────────────────

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

// ─── Shared Components (matching FamilySharingScreen) ─────────────────

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
  ({
    avatar,
    gender = 'other',
    size = 56,
    showEditButton = false,
    onEdit,
    fallbackIcon,
    fallbackColor,
  }) => {
    const hasImage = isImageUri(avatar);
    const hasEmoji = isEmoji(avatar);

    const gradientColors =
      gender === 'boy'
        ? ['#667eea', '#764ba2']
        : gender === 'girl'
        ? ['#fa709a', '#fee140']
        : ['#11998e', '#38ef7d'];

    const iconName =
      fallbackIcon ||
      (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'person');
    const color =
      fallbackColor ||
      (gender === 'boy' ? '#667eea' : gender === 'girl' ? '#fa709a' : '#11998e');

    return (
      <View style={[styles.avatarWrapper, { width: size, height: size }]}>
        <LinearGradient
          colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
          style={[
            styles.avatarGradient,
            { width: size, height: size, borderRadius: size / 2.8 },
          ]}
        >
          {hasImage ? (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2.8,
                overflow: 'hidden',
                backgroundColor: '#f0f0f0',
              }}
            >
              <Image
                source={{ uri: avatar! }}
                style={{ width: size, height: size }}
                resizeMode="cover"
                onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
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
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.editAvatarGradient}
            >
              <Ionicons name="camera" size={14} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
}

const GlassCard = memo<GlassCardProps>(
  ({ children, style, onPress, intensity = 60 }) => {
    const isDark = useColorScheme() === 'dark';
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
      <Wrapper
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.glassCard, style]}
      >
        <BlurView
          intensity={intensity}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(40,40,45,0.6)', 'rgba(25,25,30,0.4)']
              : ['rgba(255,255,255,0.8)', 'rgba(250,250,255,0.6)']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    );
  }
);

interface StatBadgeProps {
  icon: string;
  value: number | string;
  label: string;
  color: string;
}

const StatBadge = memo<StatBadgeProps>(({ icon, value, label, color }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

interface FamilyAvatarStackProps {
  members: any[];
  maxDisplay?: number;
  onPress: () => void;
}

const FamilyAvatarStack = memo<FamilyAvatarStackProps>(
  ({ members, maxDisplay = 4, onPress }) => {
    const isDark = useColorScheme() === 'dark';
    const displayMembers = members.slice(0, maxDisplay);
    const remaining = members.length - maxDisplay;

    const roleColors: Record<string, string[]> = {
      [UserRole.PARENT_1]: ['#667eea', '#764ba2'],
      [UserRole.PARENT_2]: ['#fa709a', '#fee140'],
      [UserRole.GUARDIAN]: ['#11998e', '#38ef7d'],
      [UserRole.VIEWER]: ['#64748b', '#94a3b8'],
    };

    return (
      <TouchableOpacity onPress={onPress} style={styles.avatarStackContainer}>
        <View style={styles.avatarStack}>
          {displayMembers.map((member, index) => (
            <LinearGradient
              key={member.id}
              colors={roleColors[member.role] || roleColors[UserRole.VIEWER]}
              style={[
                styles.stackAvatar,
                { marginLeft: index > 0 ? -12 : 0, zIndex: maxDisplay - index },
              ]}
            >
              <Text style={styles.stackAvatarText}>
                {member.fullName?.charAt(0) || '?'}
              </Text>
            </LinearGradient>
          ))}
          {remaining > 0 && (
            <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -12, zIndex: 0 }]}>
              <Text style={styles.stackAvatarMoreText}>+{remaining}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isDark ? '#667eea' : '#764ba2'}
        />
      </TouchableOpacity>
    );
  }
);

interface ActivityItemProps {
  activity: ActivityEntry;
  isDark: boolean;
}

const ActivityItem = memo<ActivityItemProps>(({ activity, isDark }) => {
  const config = useMemo(() => {
    const configs: Record<string, { icon: string; color: string }> = {
      potty: { icon: '🚽', color: '#8b5cf6' },
      feed: { icon: '🍼', color: '#f59e0b' },
      sleep: { icon: '😴', color: '#3b82f6' },
      growth: { icon: '📏', color: '#10b981' },
      medication: { icon: '💊', color: '#ef4444' },
      milestone: { icon: '🌟', color: '#f97316' },
      diaper: { icon: '🧷', color: '#06b6d4' },
      note: { icon: '📝', color: '#6b7280' },
    };
    return configs[activity.type] || { icon: '📝', color: '#6b7280' };
  }, [activity.type]);

  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: config.color + '15' }]}>
        <Text style={styles.activityEmoji}>{config.icon}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.activityTime}>
          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </Text>
      </View>
    </View>
  );
});

interface MilestoneItemProps {
  milestone: Milestone;
  isDark: boolean;
}

const MilestoneItem = memo<MilestoneItemProps>(({ milestone, isDark }) => (
  <View style={styles.milestoneItem}>
    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.milestoneIcon}>
      <Text style={styles.milestoneEmoji}>🌟</Text>
    </LinearGradient>
    <View style={styles.milestoneContent}>
      <Text style={[styles.milestoneTitle, isDark && styles.textDark]} numberOfLines={1}>
        {milestone.title}
      </Text>
      <Text style={styles.milestoneCategory}>{milestone.category}</Text>
      <Text style={styles.milestoneDate}>
        {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
      </Text>
    </View>
  </View>
));

// ─── Action Modal (from FamilySharingScreen) ───────────────────────────

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
  primaryColor?: string;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  title,
  children,
  isDark,
  showCloseButton = true,
  primaryColor = '#667eea',
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View entering={FadeInUp} style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <LinearGradient
            colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            )}
          </View>
          <AutoHideScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
            {children}
          </AutoHideScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────

export default function FamilyDashboardScreen({ navigation }: FamilyCenterScreenProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { userProfile } = useAuth();
  const { profile } = useUser();
  const {
    babies,
    currentBaby,
    currentBabyId,
    switchBaby,
    deleteBaby,
    growthData,
    milestones,
    activities,
    getBabyStats,
    loadBabies,
    getPottyStreak,
  } = useBaby();
  const { members, parent1, parent2, guardians, loadFamily, removeMember } = useFamily();

  const {
    darkMode,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'family' | 'growth'>('overview');
  const [showBabySelector, setShowBabySelector] = useState(false);

  const effectiveUser = useMemo(() => userProfile || profile, [userProfile, profile]);
  const hasUser = !!effectiveUser;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

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
    [currentBabyId, switchBaby]
  );

  const handleDeleteBaby = useCallback(
    (baby: (typeof babies)[0]) => {

showAlert(
        'Delete Profile',
        `Remove ${baby.name}'s profile permanently?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteBaby(baby.id);
              triggerHaptic('success');
            },
          },
        ]
      );
    },
    [deleteBaby]
  );

  const handleRemoveMember = useCallback(
    (member: any) => {

showAlert('Remove Member', `Remove ${member.fullName} from family?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember(member.id),
        },
      ]);
    },
    [removeMember]
  );

  const handleMemberPress = useCallback(
    (member: any, isYou: boolean = false) => {
      navigation.navigate('EditGuardian', {
        guardianId: member.id,
        mode: isYou || member.role === UserRole.PARENT_2 ? 'parent2' : 'guardian',
      });
    },
    [navigation]
  );

  const handleBabyEdit = useCallback(
    (babyId: string) => {
      navigation.navigate('EditProfile', { mode: 'baby', babyId });
    },
    [navigation]
  );

  const handleCurrentUserEdit = useCallback(() => {
    if (effectiveUser?.id) {
      navigation.navigate('EditGuardian', {
        guardianId: effectiveUser.id,
        mode: 'parent2',
      });
    }
  }, [navigation, effectiveUser]);

  const handleNavigateFamily = useCallback(() => {
    navigation.navigate('FamilySharing');
  }, [navigation]);

  const handleNavigateTimeline = useCallback(() => {
    navigation.navigate('Timeline');
  }, [navigation]);

  const handleNavigateAchievements = useCallback(() => {
    navigation.navigate('Achievements');
  }, [navigation]);

  const handleNavigateGrowthChart = useCallback(() => {
    navigation.navigate('GrowthDashboard');
  }, [navigation]);

  const handleNavigateCreateBaby = useCallback(() => {
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  const handleNavigateParent2 = useCallback(() => {
    navigation.navigate('Parent2Optional');
  }, [navigation]);

  const handleNavigateAddGuardian = useCallback(() => {
    navigation.navigate('AddParent');
  }, [navigation]);

  const displayMembers = useMemo(() => {
    if (members.length > 0) return members;
    if (!hasUser) return [];
    return [
      {
        id: effectiveUser.id || '1',
        fullName: effectiveUser.fullName || 'You',
        role: UserRole.PARENT_1,
        relationship: 'Parent',
        email: effectiveUser.email || '',
        addedAt: new Date().toISOString(),
        addedBy: '',
        canBeRemoved: false,
        permissions: {
          read: true, write: true, delete: true,
          manageFamily: true, manageSecurity: true, exportData: true,
        },
      },
    ];
  }, [members, hasUser, effectiveUser]);

  const recentActivities = useMemo(
    () => activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [activities]
  );

  const recentMilestones = useMemo(
    () => milestones
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
      .slice(0, 3),
    [milestones]
  );

  const babyStats = useMemo(() => (currentBaby ? getBabyStats() : null), [currentBaby, getBabyStats]);

  // ─── Animated Header Styles ───────────────────────────────────────

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(10,10,10,${interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP)})`
      : `rgba(248,250,252,${interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP)})`,
  }));

  const blurAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolate.CLAMP),
  }));

  // ─── Render Header ───────────────────────────────────────────────

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { paddingTop: insets.top }, headerAnimatedStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, blurAnimatedStyle, { zIndex: -1 }]}>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, isDark && styles.headerBtnDark]}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family Center</Text>
          {currentBaby && (
            <TouchableOpacity
              style={[styles.babySelector, { backgroundColor: themeColors.colors[0] }]}
              onPress={() => setShowBabySelector(true)}
            >
              <Text style={[styles.babySelectorText, { color: themeColors.primary }]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnAccent, { backgroundColor: themeColors.primary }]}
            onPress={handleNavigateFamily}
          >
            <Ionicons name="people" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateTimeline}>
          <Ionicons name="time" size={24} color="#10b981" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateAchievements}>
          <Ionicons name="trophy" size={24} color="#f59e0b" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Milestones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateGrowthChart}>
          <Ionicons name="trending-up" size={24} color={themeColors.primary} />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Growth</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconAction} onPress={handleNavigateFamily}>
          <Ionicons name="settings" size={24} color="#8b5cf6" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, isDark && styles.tabContainerDark]}>
        {(['overview', 'family', 'growth'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const tabConfig = {
            overview: { icon: 'grid-outline', label: 'Overview' },
            family: { icon: 'people-outline', label: 'Family' },
            growth: { icon: 'trending-up-outline', label: 'Growth' },
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                isActive && { borderBottomColor: themeColors.primary, backgroundColor: themeColors.colors[0] },
              ]}
              onPress={() => {
                if (tab === 'family') {
                  handleNavigateFamily();
                  return;
                }
                triggerHaptic('light');
                setActiveTab(tab);
              }}
            >
              <Ionicons
                name={tabConfig[tab].icon as any}
                size={18}
                color={isActive ? themeColors.primary : isDark ? '#94a3b8' : '#64748b'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isActive && [styles.tabLabelActive, { color: themeColors.primary }],
                  isDark && !isActive && styles.textMuted,
                ]}
              >
                {tabConfig[tab].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );

  // ─── Render Baby Chips ────────────────────────────────────────────

  const renderBabyChips = () => (
    <View style={styles.babyChipsContainer}>
      <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.babyChipsContent}>
        {babies.map((baby) => (
          <TouchableOpacity
            key={baby.id}
            onPress={() => handleSwitchBaby(baby.id)}
            style={[styles.babyChip, currentBabyId === baby.id && styles.babyChipActive]}
          >
            <LinearGradient
              colors={
                currentBabyId === baby.id
                  ? [themeColors.primary, themeColors.secondary]
                  : isDark
                  ? ['rgba(60,60,70,0.8)', 'rgba(40,40,50,0.6)']
                  : ['rgba(255,255,255,0.9)', 'rgba(245,245,250,0.7)']
              }
              style={styles.babyChipGradient}
            >
              <Text style={styles.babyChipEmoji}>{baby.avatar || '👶'}</Text>
              <Text
                style={[
                  styles.babyChipName,
                  currentBabyId === baby.id && styles.babyChipNameActive,
                  isDark && currentBabyId !== baby.id && styles.textDark,
                ]}
              >
                {baby.name}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addBabyChip} onPress={handleNavigateCreateBaby}>
          <View style={[styles.addBabyChipInner, isDark && { borderColor: '#475569', backgroundColor: 'rgba(60,60,70,0.5)' }]}>
            <Ionicons name="add" size={20} color={themeColors.primary} />
            <Text style={[styles.addBabyText, isDark && styles.textDark]}>Add</Text>
          </View>
        </TouchableOpacity>
      </AutoHideScrollView>
    </View>
  );

  // ─── Render Overview ──────────────────────────────────────────────

  const renderOverview = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabPanel}>
      {/* Family Stats Summary */}
      <View style={styles.familyStatsContainer}>
        <LinearGradient
          colors={[themeColors.colors[0], themeColors.colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.familyStatsGradient}
        >
          <View style={styles.familyStatsRow}>
            <View style={styles.familyStat}>
              <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{members.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Members</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{babies.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Babies</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{activities.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Activities</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{milestones.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Milestones</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {currentBaby && (
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <SafeAvatar
              avatar={currentBaby.avatar}
              gender={currentBaby.gender}
              size={72}
              showEditButton
              onEdit={() => handleBabyEdit(currentBaby.id)}
            />
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, isDark && styles.textDark]}>{currentBaby.name}</Text>
              <Text style={styles.heroMeta}>
                {currentBaby.age} • {currentBaby.gender}
              </Text>
              <View style={styles.heroTags}>
                <View style={[styles.heroTag, { backgroundColor: '#fa709a20' }]}>
                  <Ionicons name="flame" size={12} color="#fa709a" />
                  <Text style={[styles.heroTagText, { color: '#fa709a' }]}>{getPottyStreak()}d streak</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => handleBabyEdit(currentBaby.id)}>
              <Ionicons name="create-outline" size={20} color={themeColors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatBadge icon="🌟" value={currentBaby.milestones || 0} label="Milestones" color="#f59e0b" />
            <StatBadge icon="📸" value={currentBaby.photos || 0} label="Photos" color="#8b5cf6" />
            <StatBadge icon="📏" value={growthData.length} label="Records" color="#10b981" />
          </View>

          {(currentBaby.weight || currentBaby.height) && (
            <View style={styles.quickStats}>
              {currentBaby.weight && (
                <View style={styles.quickStat}>
                  <Ionicons name="scale-outline" size={16} color="#fa709a" />
                  <Text style={[styles.quickStatValue, isDark && styles.textDark]}>{currentBaby.weight}</Text>
                </View>
              )}
              {currentBaby.height && (
                <View style={styles.quickStat}>
                  <Ionicons name="resize-outline" size={16} color={themeColors.primary} />
                  <Text style={[styles.quickStatValue, isDark && styles.textDark]}>{currentBaby.height}</Text>
                </View>
              )}
            </View>
          )}
        </GlassCard>
      )}

      <GlassCard style={styles.parentCard} onPress={handleCurrentUserEdit}>
        <LinearGradient colors={['#11998e20', '#38ef7d10']} style={StyleSheet.absoluteFill} />
        <View style={styles.parentRow}>
          <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.parentAvatar}>
            <Text style={styles.parentAvatarText}>{effectiveUser?.fullName?.charAt(0) || 'P'}</Text>
          </LinearGradient>
          <View style={styles.parentInfo}>
            <Text style={[styles.parentName, isDark && styles.textDark]}>
              {effectiveUser?.fullName || 'Parent'}
            </Text>
            <Text style={styles.parentRole}>Primary Parent</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      {recentActivities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
            <TouchableOpacity onPress={handleNavigateTimeline}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.activityCard}>
            {recentActivities.slice(0, 3).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} isDark={isDark} />
            ))}
          </GlassCard>
        </View>
      )}
    </Animated.View>
  );

  // ─── Render Family ────────────────────────────────────────────────

  const renderFamily = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabPanel}>
      {renderMemberSection('Primary Parent', members.filter((m) => m.role === UserRole.PARENT_1))}
      {renderMemberSection('Co-Parent', members.filter((m) => m.role === UserRole.PARENT_2), 'No co-parent added yet')}
      {renderMemberSection('Guardians', members.filter((m) => m.role === UserRole.GUARDIAN), 'No guardians added')}
      {renderMemberSection('Viewers', members.filter((m) => m.role === UserRole.VIEWER), 'No viewers added')}

      {/* Add Co-Parent Button */}
      {!parent2 && (
        <TouchableOpacity style={styles.addBtn} onPress={handleNavigateParent2}>
          <LinearGradient colors={['#fa709a', '#fee140']} style={styles.addBtnGradient}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Co-Parent</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Add Guardian Button */}
      <TouchableOpacity style={styles.addGuardianBtn} onPress={handleNavigateAddGuardian}>
        <View style={[styles.addGuardianInner, isDark && { borderColor: '#475569' }]}>
          <Ionicons name="add-circle" size={22} color={themeColors.primary} />
          <Text style={[styles.addGuardianText, isDark && styles.textDark]}>Add Guardian</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderMemberSection = (title: string, data: any[], emptyText?: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
        <Text style={[styles.sectionCount, isDark && styles.textMuted]}>{data.length}</Text>
      </View>

      {data.length === 0 && emptyText ? (
        <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
          <Ionicons name="people-outline" size={32} color={isDark ? '#555' : '#ccc'} />
          <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>{emptyText}</Text>
        </View>
      ) : (
        data.map((member, index) => (
          <Animated.View
            key={member.id}
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 100)}
            layout={shouldReduceMotion ? undefined : Layout.springify()}
            style={styles.memberCardWrapper}
          >
            <GlassCard onPress={() => handleMemberPress(member, member.id === (userProfile?.id || profile?.id))}>
              <View style={styles.memberRow}>
                <LinearGradient
                  colors={
                    member.role === UserRole.PARENT_1
                      ? ['#667eea', '#764ba2']
                      : member.role === UserRole.PARENT_2
                      ? ['#fa709a', '#fee140']
                      : ['#11998e', '#38ef7d']
                  }
                  style={styles.memberAvatar}
                >
                  <Text style={styles.memberAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>
                </LinearGradient>
                <View style={styles.memberDetails}>
                  <Text style={[styles.memberName, isDark && styles.textDark]}>{member.fullName}</Text>
                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor:
                          member.role === UserRole.PARENT_1
                            ? '#667eea20'
                            : member.role === UserRole.PARENT_2
                            ? '#fa709a20'
                            : '#11998e20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rolePillText,
                        {
                          color:
                            member.role === UserRole.PARENT_1
                              ? '#667eea'
                              : member.role === UserRole.PARENT_2
                              ? '#fa709a'
                              : '#11998e',
                        },
                      ]}
                    >
                      {member.role === UserRole.PARENT_1 ? 'Primary' : member.role === UserRole.PARENT_2 ? 'Co-Parent' : member.relationship}
                    </Text>
                  </View>
                </View>
                {member.canBeRemoved && (
                  <TouchableOpacity onPress={() => handleRemoveMember(member)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#667eea' : '#764ba2'} />
              </View>
            </GlassCard>
          </Animated.View>
        ))
      )}
    </View>
  );

  // ─── Render Growth ────────────────────────────────────────────────

  const renderGrowth = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.growthSummaryCard}>
        <View style={styles.growthStatsRow}>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.growthStatIcon}>
              <Ionicons name="resize-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>
                {growthData.filter((g) => g.type === 'height').pop()?.value || '--'}
                {growthData.filter((g) => g.type === 'height').pop()?.unit || ''}
              </Text>
              <Text style={styles.growthStatLabel}>Height</Text>
            </View>
          </View>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#fa709a', '#fee140']} style={styles.growthStatIcon}>
              <Ionicons name="scale-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>
                {growthData.filter((g) => g.type === 'weight').pop()?.value || '--'}
                {growthData.filter((g) => g.type === 'weight').pop()?.unit || ''}
              </Text>
              <Text style={styles.growthStatLabel}>Weight</Text>
            </View>
          </View>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.growthStatIcon}>
              <Ionicons name="analytics-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>{growthData.length}</Text>
              <Text style={styles.growthStatLabel}>Records</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {recentMilestones.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Latest Milestones</Text>
            <TouchableOpacity onPress={handleNavigateAchievements}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.milestonesCard}>
            {recentMilestones.map((m) => (
              <MilestoneItem key={m.id} milestone={m} isDark={isDark} />
            ))}
          </GlassCard>
        </View>
      )}

      <TouchableOpacity style={styles.fullChartBtn} onPress={handleNavigateGrowthChart}>
        <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.fullChartGradient}>
          <Ionicons name="trending-up" size={20} color="#fff" />
          <Text style={styles.fullChartText}>Full Growth Charts</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {renderHeader()}

      <View style={[styles.babyChipsWrapper, { top: insets.top + 180 }]}>
        {renderBabyChips()}
      </View>

      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 250, paddingBottom: insets.bottom + 30 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'family' && renderFamily()}
        {activeTab === 'growth' && renderGrowth()}

        <View style={styles.bottomSpacer} />
      </AnimatedScrollView>

      {/* Baby Selector Modal */}
      <ActionModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Select Baby"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.babySelectorContent}>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.babyOption,
                currentBaby?.id === baby.id && [
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
                  { backgroundColor: currentBaby?.id === baby.id ? themeColors.primary : isDark ? '#333' : '#e2e8f0' },
                ]}
              >
                <Text style={styles.babyOptionEmoji}>👶</Text>
              </View>
              <View style={styles.babyOptionInfo}>
                <Text style={[styles.babyOptionName, isDark && styles.textDark]}>{baby.name}</Text>
                <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                  {new Date(baby.dateOfBirth).toLocaleDateString()} • {baby.gender || 'Baby'}
                </Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark" size={24} color={themeColors.primary} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.addBabyOption, isDark && styles.addBabyOptionDark]}
            onPress={() => {
              setShowBabySelector(false);
              navigation.navigate('CreateBabyProfile');
            }}
          >
            <View style={[styles.addBabyIcon, { backgroundColor: themeColors.colors[0] }]}>
              <Ionicons name="add" size={24} color={themeColors.primary} />
            </View>
            <Text style={[styles.addBabyText, isDark && styles.textDark, { color: themeColors.primary }]}>Add New Baby</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>
    </View>
  );
}

// ─── Styles (Unified with FamilySharingScreen) ───────────────────────

const styles = StyleSheet.create({
  // ── Base ──────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  textDark: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#94a3b8',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  bottomSpacer: {
    height: 40,
  },

  // ── Avatar ────────────────────────────────────────────────────────
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

  // ── Header ────────────────────────────────────────────────────────
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerTop: {
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
  },
  headerBtnDark: {
    backgroundColor: 'rgba(30,30,35,0.9)',
  },
  headerBtnAccent: {
    backgroundColor: '#667eea',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  babySelector: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 12,
  },
  babySelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconAction: {
    alignItems: 'center',
    padding: 8,
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },

  // ── Tabs ────────────────────────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2, backgroundColor: 'rgba(255,255,255,0.95)' },
    }),
  },
  tabContainerDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: { backgroundColor: 'rgba(30,30,35,0.95)' },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderBottomColor: '#667eea',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    fontWeight: '700',
  },

  // ── Baby Chips ──────────────────────────────────────────────────
  babyChipsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 98,
    paddingVertical: 12,
  },
  babyChipsContainer: {
    marginTop: 8,
  },
  babyChipsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  babyChip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  babyChipActive: {
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  babyChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  babyChipEmoji: {
    fontSize: 18,
  },
  babyChipName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  babyChipNameActive: {
    color: '#fff',
    fontWeight: '700',
  },
  addBabyChip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBabyChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  addBabyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  // ── Glass Card ──────────────────────────────────────────────────
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3, backgroundColor: 'rgba(255,255,255,0.95)' },
    }),
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  glassContent: {
    flex: 1,
  },

  // ── Tab Panel ───────────────────────────────────────────────────
  tabPanel: {
    marginTop: 16,
    gap: 16,
  },

  // ── Family Stats Summary ───────────────────────────────────────
  familyStatsContainer: {
    marginBottom: 20,
  },
  familyStatsGradient: {
    borderRadius: 20,
    padding: 16,
  },
  familyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  familyStat: {
    alignItems: 'center',
  },
  familyStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  familyStatLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  familyStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  // ── Hero Card ───────────────────────────────────────────────────
  heroCard: {
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  heroTags: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Stats Row ───────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  statBadge: {
    alignItems: 'center',
    gap: 6,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Quick Stats ─────────────────────────────────────────────────
  quickStats: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },

  // ── Parent Card ─────────────────────────────────────────────────
  parentCard: {
    padding: 16,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  parentInfo: {
    flex: 1,
    marginLeft: 14,
  },
  parentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  parentRole: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // ── Section ─────────────────────────────────────────────────────
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // ── Activity ────────────────────────────────────────────────────
  activityCard: {
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // ── Member Section ──────────────────────────────────────────────
  memberCardWrapper: {
    marginBottom: 14,
    borderRadius: 20,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeBtn: {
    padding: 4,
    marginRight: 8,
  },

  // ── Add Buttons ─────────────────────────────────────────────────
  addBtn: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  addGuardianBtn: {
    marginTop: 12,
  },
  addGuardianInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  addGuardianText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },

  // ── Empty State ─────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  emptyStateDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 8,
  },

  // ── Growth ──────────────────────────────────────────────────────
  growthSummaryCard: {
    padding: 20,
  },
  growthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  growthStatItem: {
    alignItems: 'center',
    gap: 10,
  },
  growthStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  growthStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },

  milestonesCard: {
    padding: 16,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  milestoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  milestoneEmoji: {
    fontSize: 22,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  milestoneCategory: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  milestoneDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },

  fullChartBtn: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fullChartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  fullChartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Avatar Stack ────────────────────────────────────────────────
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stackAvatarMore: {
    backgroundColor: '#64748b',
  },
  stackAvatarMoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Modal ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modalContentDark: {
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScrollContent: {
    padding: 16,
  },

  // ── Baby Selector Modal ─────────────────────────────────────────
  babySelectorContent: {
    padding: 16,
  },
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
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.05)',
  },
  babyOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  babyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  babyOptionEmoji: {
    fontSize: 24,
  },
  babyOptionInfo: {
    flex: 1,
  },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  babyOptionMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
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
  addBabyOptionDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addBabyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
});
