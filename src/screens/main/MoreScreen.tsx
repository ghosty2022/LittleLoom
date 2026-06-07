import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Dimensions,
  Image,
  Switch,
  Modal,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';
import { useBaby } from '../../context/BabyContext';
import { useUser } from '../../context/UserContext';
import { useFamily } from '../../context/FamilyContext';
import { FamilyMember, UserRole } from '../../types/roles';
import { useActivity } from '../../context/ActivityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  isEnabled?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  color: string;
  isDark: boolean;
  showArrow?: boolean;
  disabled?: boolean;
  isDestructive?: boolean;
  badge?: number | string;
}

interface SectionHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  isDark: boolean;
  isExpanded?: boolean;
  onPress?: () => void;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  color,
  isDark,
  isExpanded,
  onPress,
  action,
}) => (
  <TouchableOpacity
    style={styles.sectionHeader}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
        {title}
      </Text>
    </View>
    <View style={styles.sectionActions}>
      {action}
      {onPress && (
        <Animated.View
          style={{
            transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
            marginLeft: 8,
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? '#666' : '#999'}
          />
        </Animated.View>
      )}
    </View>
  </TouchableOpacity>
);

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  value,
  isEnabled,
  onToggle,
  onPress,
  color,
  isDark,
  showArrow = false,
  disabled = false,
  isDestructive = false,
  badge,
}) => {
  const scaleAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePress = () => {
    if (disabled) return;

    scaleAnim.value = withSequence(
      withTiming(0.96, { duration: 50 }),
      withTiming(1, { duration: 100 })
    );

    setTimeout(() => {
      if (onPress) onPress();
      else if (onToggle) onToggle(!isEnabled);
    }, 150);
  };

  return (
    <AnimatedTouchable
      style={[styles.menuItem, animatedStyle, disabled && styles.menuItemDisabled]}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View
        style={[
          styles.menuIcon,
          {
            backgroundColor: isDestructive
              ? 'rgba(255,71,87,0.12)'
              : `${color}15`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={
            isDestructive
              ? '#ff4757'
              : disabled
                ? '#999'
                : color
          }
        />
      </View>

      <View style={styles.menuTextContainer}>
        <View style={styles.menuTitleRow}>
          <Text
            style={[
              styles.menuTitle,
              isDark && styles.menuTitleDark,
              disabled && styles.menuTextDisabled,
              isDestructive && styles.destructiveText,
            ]}
          >
            {title}
          </Text>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {(subtitle || value) && (
          <Text
            style={[
              styles.menuSubtitle,
              isDark && styles.menuSubtitleDark,
              disabled && styles.menuTextDisabled,
            ]}
          >
            {value || subtitle}
          </Text>
        )}
      </View>

      {onToggle ? (
        <Switch
          value={isEnabled}
          onValueChange={disabled ? undefined : onToggle}
          trackColor={{
            false: isDark ? '#444' : '#d1d5db',
            true: `${color}50`,
          }}
          thumbColor={isEnabled ? color : isDark ? '#666' : '#f4f3f4'}
          disabled={disabled}
        />
      ) : showArrow ? (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={disabled ? '#666' : isDark ? '#666' : '#999'}
        />
      ) : null}
    </AnimatedTouchable>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
  isDark: boolean;
}> = ({ icon, value, label, color, isDark }) => (
  <View style={[styles.statCard, isDark && styles.statCardDark]}>
    <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, isDark && styles.statValueDark]}>{value}</Text>
    <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>{label}</Text>
  </View>
);

const BabySelectionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  babies: any[];
  currentBabyId: string | null;
  onSelectBaby: (baby: any) => void;
  isDark: boolean;
}> = ({ visible, onClose, babies, currentBabyId, onSelectBaby, isDark }) => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <BlurView
        intensity={isDark ? 70 : 90}
        style={styles.modalContainer}
        tint={isDark ? 'dark' : 'light'}
      >
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
            Select Baby Profile
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons
              name="close"
              size={24}
              color={isDark ? '#fff' : '#1a1a1a'}
            />
          </TouchableOpacity>
        </View>

        <AutoHideScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalContentContainer}
        >
          {babies.map((baby) => {
            const isActive = baby.id === currentBabyId;
            return (
              <TouchableOpacity
                key={baby.id}
                style={[
                  styles.babyOption,
                  isDark && styles.babyOptionDark,
                  isActive && styles.babyOptionActive,
                  isActive && isDark && styles.babyOptionActiveDark,
                ]}
                onPress={() => onSelectBaby(baby)}
              >
                <View style={styles.babyOptionEmojiContainer}>
                  <SafeBabyAvatar
                    avatar={baby.avatar}
                    gender={baby.gender}
                    size={50}
                  />
                  {isActive && (
                    <View style={styles.activeIndicator}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#43e97b"
                      />
                    </View>
                  )}
                </View>
                <View style={styles.babyOptionInfo}>
                  <Text
                    style={[
                      styles.babyOptionName,
                      isDark && styles.babyOptionNameDark,
                      isActive && styles.babyOptionNameActive,
                    ]}
                  >
                    {baby.name}
                  </Text>
                  <Text
                    style={[
                      styles.babyOptionAge,
                      isDark && styles.babyOptionAgeDark,
                    ]}
                  >
                    {baby.age || 'Age unknown'} • {baby.gender || 'Unknown'}
                  </Text>
                </View>
                <Ionicons
                  name={isActive ? 'checkmark' : 'chevron-forward'}
                  size={20}
                  color={
                    isActive
                      ? '#43e97b'
                      : isDark
                        ? '#666'
                        : '#999'
                  }
                />
              </TouchableOpacity>
            );
          })}
        </AutoHideScrollView>
      </BlurView>
    </View>
  </Modal>
);

const ProfileCard: React.FC<{
  navigation: any;
  isDark: boolean;
  userProfile: any;
  babies: any[];
  currentBaby: any;
  currentBabyId: string | null;
  parent2Profile: FamilyMember | null;
  guardians: FamilyMember[];
  onShowBabyModal: () => void;
  stats: { entries: number; streak: number; milestones: number };
  primaryColor: string;
  secondaryColor: string;
}> = ({
  navigation,
  isDark,
  userProfile,
  babies,
  currentBaby,
  currentBabyId,
  parent2Profile,
  guardians,
  onShowBabyModal,
  stats,
  primaryColor,
  secondaryColor,
}) => {
  const safeBabies = babies || [];
  const hasMultipleBabies = safeBabies.length > 1;

  const handleBabyPress = () => {
    if (safeBabies.length === 1 && currentBaby) {
      navigation.navigate('EditProfile', {
        mode: 'baby',
        babyId: currentBaby.id,
      });
    } else if (safeBabies.length > 1) {
      onShowBabyModal();
    } else {
      navigation.navigate('CreateBabyProfile');
    }
  };

  const handleCurrentUserPress = () => {
    const guardianId = userProfile?.id || userProfile?.uid || 'parent1';
    navigation.navigate('EditGuardian', {
      guardianId: guardianId,
      mode: 'parent2',
      fromChat: false,
    });
  };

  const handleParent2Press = () => {
    if (parent2Profile) {
      navigation.navigate('EditGuardian', {
        guardianId: parent2Profile.id,
        mode: 'parent2',
        fromChat: false,
      });
    } else {
      navigation.navigate('AddParent');
    }
  };

  const handleGuardianPress = (guardian: FamilyMember) => {
    navigation.navigate('EditGuardian', {
      guardianId: guardian.id,
      mode: 'guardian',
      fromChat: false,
    });
  };

  // ─── Navigate to Community Profile ───
  const handleCommunityProfile = () => {
    navigation.navigate('Main', {
      screen: 'Connect',
      params: {
        screen: 'EditCommunityProfile',
        params: { userId: userProfile?.id },
      },
    });
  };

  return (
    <BlurView
      intensity={isDark ? 40 : 90}
      style={styles.profileCard}
      tint={isDark ? 'dark' : 'light'}
    >
      <View style={styles.profileHeader}>
        <SafeAvatar
          avatar={userProfile?.avatar}
          size={72}
          fallbackIcon="person"
          fallbackColor={primaryColor}
          showEditBadge={true}
          onPress={handleCurrentUserPress}
        />

        <View style={styles.profileInfo}>
          <Text
            style={[styles.profileName, isDark && styles.profileNameDark]}
          >
            {userProfile?.fullName || 'Parent'}
          </Text>
          <Text
            style={[styles.profileEmail, isDark && styles.profileEmailDark]}
          >
            {userProfile?.email || 'parent@littleloom.app'}
          </Text>
          {currentBaby && (
            <View style={[styles.babyTag, { backgroundColor: `${secondaryColor}20` }]}>
              <Ionicons
                name="heart"
                size={12}
                color={secondaryColor}
              />
              <Text style={[styles.babyTagText, { color: secondaryColor }]}>
                {currentBaby.name} • {currentBaby.age}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleCurrentUserPress}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={isDark ? '#fff' : '#1a1a1a'}
          />
        </TouchableOpacity>
      </View>

      {/* Community Profile Quick Link */}
      <TouchableOpacity
        style={[styles.communityLink, { backgroundColor: `${primaryColor}12` }]}
        onPress={handleCommunityProfile}
        activeOpacity={0.7}
      >
        <View style={[styles.communityIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Ionicons name="globe-outline" size={18} color={primaryColor} />
        </View>
        <View style={styles.communityLinkText}>
          <Text style={[styles.communityLinkTitle, isDark && styles.communityLinkTitleDark]}>
            Community Profile
          </Text>
          <Text style={[styles.communityLinkSub, isDark && styles.communityLinkSubDark]}>
            Edit your public profile & bio
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#999'} />
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <StatCard
          icon="time-outline"
          value={stats.entries}
          label="Entries"
          color="#4facfe"
          isDark={isDark}
        />
        <StatCard
          icon="flame-outline"
          value={stats.streak}
          label="Day Streak"
          color="#fee140"
          isDark={isDark}
        />
        <StatCard
          icon="trophy-outline"
          value={stats.milestones}
          label="Milestones"
          color="#9b59b6"
          isDark={isDark}
        />
      </View>

      <View style={styles.familySection}>
        <Text
          style={[
            styles.familySectionTitle,
            isDark && styles.familySectionTitleDark,
          ]}
        >
          Family Members
        </Text>
        <AutoHideScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.familyMembersRow}
        >
          <TouchableOpacity
            style={styles.familyMemberItem}
            onPress={handleCurrentUserPress}
          >
            <View
              style={[
                styles.familyMemberIcon,
                { backgroundColor: `${primaryColor}20` },
              ]}
            >
              <SafeAvatar
                avatar={userProfile?.avatar}
                size={40}
                fallbackIcon="person"
                fallbackColor={primaryColor}
                borderWidth={0}
              />
              <View style={styles.onlineIndicator} />
            </View>
            <Text
              style={[
                styles.familyMemberLabel,
                isDark && styles.familyMemberLabelDark,
              ]}
            >
              You
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.familyMemberItem}
            onPress={handleBabyPress}
          >
            <View
              style={[
                styles.familyMemberIcon,
                { backgroundColor: `${secondaryColor}20` },
              ]}
            >
              <SafeBabyAvatar
                avatar={currentBaby?.avatar}
                gender={currentBaby?.gender}
                size={40}
              />
              {hasMultipleBabies && (
                <View style={styles.babyIndicator}>
                  <Text style={styles.babyIndicatorText}>
                    {safeBabies.length}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.familyMemberLabel,
                isDark && styles.familyMemberLabelDark,
              ]}
              numberOfLines={1}
            >
              {currentBaby?.name || 'Baby'}
            </Text>
          </TouchableOpacity>

          {parent2Profile && (
            <TouchableOpacity
              style={styles.familyMemberItem}
              onPress={handleParent2Press}
            >
              <View
                style={[
                  styles.familyMemberIcon,
                  { backgroundColor: `#11998e20` },
                ]}
              >
                <SafeAvatar
                  avatar={parent2Profile?.avatar}
                  size={40}
                  fallbackIcon="people"
                  fallbackColor="#11998e"
                  borderWidth={0}
                />
              </View>
              <Text
                style={[
                  styles.familyMemberLabel,
                  isDark && styles.familyMemberLabelDark,
                ]}
              >
                Co-Parent
              </Text>
            </TouchableOpacity>
          )}

          {guardians?.map((guardian, index) => (
            <TouchableOpacity
              key={guardian.id || index}
              style={styles.familyMemberItem}
              onPress={() => handleGuardianPress(guardian)}
            >
              <View
                style={[
                  styles.familyMemberIcon,
                  { backgroundColor: `#9b59b620` },
                ]}
              >
                <SafeAvatar
                  avatar={guardian?.avatar}
                  size={40}
                  fallbackIcon="shield-checkmark"
                  fallbackColor="#9b59b6"
                  borderWidth={0}
                />
              </View>
              <Text
                style={[
                  styles.familyMemberLabel,
                  isDark && styles.familyMemberLabelDark,
                ]}
                numberOfLines={1}
              >
                {guardian.fullName || 'Guardian'}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.familyMemberItem}
            onPress={() => navigation.navigate('FamilySharing')}
          >
            <View
              style={[
                styles.familyMemberIcon,
                styles.addMemberIcon,
                isDark && styles.addMemberIconDark,
              ]}
            >
              <Ionicons
                name="add"
                size={28}
                color={isDark ? '#fff' : primaryColor}
              />
            </View>
            <Text
              style={[
                styles.familyMemberLabel,
                isDark && styles.familyMemberLabelDark,
              ]}
            >
              Add
            </Text>
          </TouchableOpacity>
        </AutoHideScrollView>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={handleCurrentUserPress}
        >
          <View
            style={[
              styles.quickActionIcon,
              { backgroundColor: `${primaryColor}15` },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={primaryColor}
            />
          </View>
          <Text style={styles.quickActionLabel}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={handleBabyPress}
        >
          <View
            style={[
              styles.quickActionIcon,
              { backgroundColor: `${secondaryColor}15` },
            ]}
          >
            <Ionicons
              name="heart-outline"
              size={20}
              color={secondaryColor}
            />
          </View>
          <Text style={styles.quickActionLabel}>Baby</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('FamilySharing')}
        >
          <View
            style={[
              styles.quickActionIcon,
              { backgroundColor: `#11998e15` },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color="#11998e"
            />
          </View>
          <Text style={styles.quickActionLabel}>Family</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('Reminders')}
        >
          <View
            style={[
              styles.quickActionIcon,
              { backgroundColor: `#fee14015` },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#fee140"
            />
          </View>
          <Text style={styles.quickActionLabel}>Alerts</Text>
        </TouchableOpacity>
      </View>

      {hasMultipleBabies && (
        <TouchableOpacity
          style={styles.switchBabyRow}
          onPress={() => navigation.navigate('SwitchBaby')}
        >
          <View style={styles.switchBabyIcon}>
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={primaryColor}
            />
          </View>
          <Text style={styles.switchBabyText}>Switch Active Baby</Text>
          <View style={[styles.switchBabyBadge, { backgroundColor: primaryColor }]}>
            <Text style={styles.switchBabyBadgeText}>{safeBabies.length}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={primaryColor}
          />
        </TouchableOpacity>
      )}
    </BlurView>
  );
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['security', 'preferences'])
  );
  const [showBabyModal, setShowBabyModal] = useState(false);

  const { signOut, userProfile, isLoading: authLoading } = useAuth();

  const {
    babies,
    currentBaby,
    currentBabyId,
    isLoading: babyLoading,
    hasSkippedBaby,
    getBabyStats,
  } = useBaby();

  const {
    settings: securitySettings,
    toggleBiometric,
    toggleAppLock,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    getBiometricTypeName,
    lockApp,
    updateAutoLockTimeout,
    getAvailableAuthMethods,
  } = useSecurity();

  const { profile: userContextProfile } = useUser();
  const { guardians, parent2: parent2Profile } = useFamily();
  const { entries } = useActivity();

  // ─── Theme Integration ───
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  // Prefer useCustomization darkMode, fallback to system
  const isDark = darkMode ?? (colorScheme === 'dark');
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const availableMethods = getAvailableAuthMethods();
  const biometricTypeName = getBiometricTypeName();
  const hasBiometric = isBiometricHardwareAvailable && isBiometricEnrolled;

  const safeBabies = babies || [];

  const babyStats = currentBaby
    ? getBabyStats()
    : { streak: 0, milestones: 0, photos: 0, entries: 0 };
  const activityStats = {
    entries: entries?.length || 0,
    streak: babyStats.streak || 0,
    milestones: babyStats.milestones || 0,
  };

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const toggleSection = (section: string) => {
    handleHaptic();
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) newSet.delete(section);
      else newSet.add(section);
      return newSet;
    });
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!hasBiometric) {
        Alert.alert(
          'Biometric Not Available',
          'Please set up biometric authentication in your device settings first.',
          [{ text: 'OK' }]
        );
        return;
      }
      navigation.navigate('BiometricSetup');
    } else {
      Alert.alert(
        'Disable Biometric?',
        'Are you sure you want to disable biometric authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              const success = await toggleBiometric(false);
              if (!success)
                Alert.alert(
                  'Error',
                  'Could not disable biometric authentication.'
                );
            },
          },
        ]
      );
    }
  };

  const handlePinSetup = () => navigation.navigate('SecurityCenter');

  const handleLockNow = async () => {
    if (!availableMethods.hasPin && !availableMethods.hasBiometric) {
      Alert.alert(
        'No Security Enabled',
        'Please enable PIN or Biometric authentication first.',
        [{ text: 'OK' }]
      );
      return;
    }
    await lockApp();
  };

  const handleAutoLockTimeout = () => {
    const options = [
      { label: '1 minute', value: 1 },
      { label: '2 minutes', value: 2 },
      { label: '5 minutes', value: 5 },
      { label: '10 minutes', value: 10 },
      { label: '15 minutes', value: 15 },
      { label: '30 minutes', value: 30 },
      { label: '1 hour', value: 60 },
    ];

    Alert.alert(
      'Auto-Lock Timeout',
      'Select when to automatically lock the app',
      [
        ...options.map((opt) => ({
          text: opt.label,
          onPress: () => updateAutoLockTimeout(opt.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleSelectBabyFromModal = (baby: any) => {
    setShowBabyModal(false);
    navigation.navigate('EditProfile', { mode: 'baby', babyId: baby.id });
  };

  const formatTimeout = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  // ─── Background gradient from theme ───
  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  const renderSecuritySection = () => {
    const isExpanded = expandedSections.has('security');

    return (
      <View style={styles.section}>
        <SectionHeader
          icon="shield-checkmark"
          title="Security & Privacy"
          color={primary}
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('security')}
        />

        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon={
                securitySettings.isBiometricEnabled
                  ? 'finger-print'
                  : 'finger-print-outline'
              }
              title={`${biometricTypeName} Unlock`}
              subtitle={
                securitySettings.isBiometricEnabled
                  ? 'Enabled'
                  : hasBiometric
                    ? 'Disabled'
                    : 'Not Available'
              }
              isEnabled={securitySettings.isBiometricEnabled}
              onToggle={handleBiometricToggle}
              color={primary}
              isDark={isDark}
              disabled={!hasBiometric}
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="keypad"
              title="PIN Code"
              subtitle={
                securitySettings.isPinEnabled ? 'Change PIN' : 'Set up PIN'
              }
              onPress={handlePinSetup}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="lock-closed"
              title="Auto-Lock App"
              subtitle={
                securitySettings.isAppLockEnabled
                  ? `After ${formatTimeout(securitySettings.autoLockTimeout)}`
                  : 'Disabled'
              }
              isEnabled={securitySettings.isAppLockEnabled}
              onToggle={toggleAppLock}
              color={accent}
              isDark={isDark}
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="time"
              title="Lock Timeout"
              value={formatTimeout(securitySettings.autoLockTimeout)}
              onPress={handleAutoLockTimeout}
              color="#f59e0b"
              isDark={isDark}
              showArrow
              disabled={!securitySettings.isAppLockEnabled}
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="lock-closed-outline"
              title="Lock Now"
              subtitle="Immediately lock the app"
              onPress={handleLockNow}
              color="#ef4444"
              isDark={isDark}
              showArrow
            />
          </BlurView>
        )}
      </View>
    );
  };

  const renderPreferencesSection = () => {
    const isExpanded = expandedSections.has('preferences');

    return (
      <View style={styles.section}>
        <SectionHeader
          icon="options"
          title="Preferences"
          color="#11998e"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('preferences')}
        />

        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="notifications"
              title="Notifications"
              subtitle="Manage push notifications"
              onPress={() => navigation.navigate('Reminders')}
              color="#4facfe"
              isDark={isDark}
              showArrow
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="color-palette"
              title="Customize App"
              subtitle="Themes, avatars, appearance & preferences"
              onPress={() => navigation.navigate('Customize')}
              color="#9b59b6"
              isDark={isDark}
              showArrow
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="language"
              title="Language"
              subtitle="English (US)"
              onPress={() => navigation.navigate('LanguageSettings')}
              color="#fa8231"
              isDark={isDark}
              showArrow
            />
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            <MenuItem
              icon="bar-chart"
              title="Units"
              subtitle="Metric (kg, cm)"
              onPress={() => navigation.navigate('UnitSettings')}
              color="#5f27cd"
              isDark={isDark}
              showArrow
            />
          </BlurView>
        )}
      </View>
    );
  };

  const renderFamilySection = () => (
    <View style={styles.section}>
      <SectionHeader
        icon="people"
        title="Family & Sharing"
        color={secondary}
        isDark={isDark}
      />
      <BlurView
        intensity={isDark ? 30 : 70}
        style={styles.menuContainer}
        tint={isDark ? 'dark' : 'light'}
      >
        <MenuItem
          icon="people-outline"
          title="Family Sharing"
          subtitle="Manage co-parents and guardians"
          onPress={() => navigation.navigate('FamilySharing')}
          color={secondary}
          isDark={isDark}
          showArrow
          badge={guardians?.length || undefined}
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="person-add"
          title="Invite Co-Parent"
          subtitle="Add another parent to your account"
          onPress={() => navigation.navigate('AddParent')}
          color="#11998e"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="share-outline"
          title="Export Data"
          subtitle="Backup and restore your data"
          onPress={() => navigation.navigate('BackupRestore')}
          color="#43e97b"
          isDark={isDark}
          showArrow
        />
      </BlurView>
    </View>
  );

  const renderTrackingSection = () => (
    <View style={styles.section}>
      <SectionHeader
        icon="analytics"
        title="Tracking & Insights"
        color="#4facfe"
        isDark={isDark}
      />
      <BlurView
        intensity={isDark ? 30 : 70}
        style={styles.menuContainer}
        tint={isDark ? 'dark' : 'light'}
      >
        <MenuItem
          icon="trophy-outline"
          title="Achievements"
          subtitle="View your parenting milestones"
          onPress={() => navigation.navigate('Achievements')}
          color="#fee140"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="trending-up"
          title="Growth Charts"
          subtitle="Track height, weight, and more"
          onPress={() => navigation.navigate('GrowthChart')}
          color="#43e97b"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="calendar-outline"
          title="Activity History"
          subtitle="View complete timeline"
          onPress={() =>
            Alert.alert('Timeline', 'Timeline view coming in next update!')
          }
          color={primary}
          isDark={isDark}
          showArrow
        />
      </BlurView>
    </View>
  );

  const renderSafetySection = () => (
    <View style={styles.section}>
      <SectionHeader
        icon="shield-half"
        title="Safety"
        color="#ef4444"
        isDark={isDark}
      />
      <BlurView
        intensity={isDark ? 30 : 70}
        style={styles.menuContainer}
        tint={isDark ? 'dark' : 'light'}
      >
        <MenuItem
          icon="shield-checkmark"
          title="Safety Corner"
          subtitle="Emergency contacts, first aid & safety tips"
          onPress={() => navigation.navigate('SafetyCorner')}
          color="#ef4444"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="medical"
          title="Emergency Info"
          subtitle="Quick access to emergency details"
          onPress={() => navigation.navigate('SafetyCorner')}
          color="#f59e0b"
          isDark={isDark}
          showArrow
        />
      </BlurView>
    </View>
  );

  const renderSupportSection = () => (
    <View style={styles.section}>
      <SectionHeader
        icon="help-circle"
        title="Support & About"
        color="#9b59b6"
        isDark={isDark}
      />
      <BlurView
        intensity={isDark ? 30 : 70}
        style={styles.menuContainer}
        tint={isDark ? 'dark' : 'light'}
      >
        <MenuItem
          icon="help-buoy"
          title="Help Center"
          subtitle="FAQs and tutorials"
          onPress={() => navigation.navigate('HelpCenter')}
          color="#4facfe"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="chatbubble-ellipses"
          title="Contact Support"
          subtitle="Get help from our team"
          onPress={() => navigation.navigate('ContactSupport')}
          color={secondary}
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="document-text"
          title="Privacy Policy"
          subtitle="Read our privacy terms"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          color="#11998e"
          isDark={isDark}
          showArrow
        />
        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <MenuItem
          icon="information-circle"
          title="About LittleLoom"
          subtitle="Version 1.0.0"
          onPress={() => navigation.navigate('About')}
          color="#5f27cd"
          isDark={isDark}
          showArrow
        />
      </BlurView>
    </View>
  );

  if (authLoading || babyLoading) {
    return (
      <View
        style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}
      >
        <ActivityIndicator size="large" color={primary} />
        <Text
          style={[styles.loadingText, isDark && styles.loadingTextDark]}
        >
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={bgColors}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AutoHideScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            Settings
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              isDark && styles.headerSubtitleDark,
            ]}
          >
            Manage your account, family, and preferences
          </Text>
        </View>

        <ProfileCard
          navigation={navigation}
          isDark={isDark}
          userProfile={userProfile || userContextProfile}
          babies={safeBabies}
          currentBaby={currentBaby}
          currentBabyId={currentBabyId}
          parent2Profile={parent2Profile}
          guardians={guardians || []}
          onShowBabyModal={() => setShowBabyModal(true)}
          stats={activityStats}
          primaryColor={primary}
          secondaryColor={secondary}
        />

        {renderSecuritySection()}
        {renderPreferencesSection()}
        {renderFamilySection()}
        {renderTrackingSection()}
        {renderSafetySection()}
        {renderSupportSection()}

        <View style={styles.appInfo}>
          <View
            style={[
              styles.appIconContainer,
              isDark && styles.appIconContainerDark,
            ]}
          >
            <Text style={styles.appIcon}>🧵</Text>
          </View>
          <Text
            style={[styles.appVersion, isDark && styles.appVersionDark]}
          >
            LittleLoom v1.0.0
          </Text>
          <View style={styles.securityBadge}>
            <Ionicons
              name={
                availableMethods.hasBiometric || availableMethods.hasPin
                  ? 'lock-closed'
                  : 'lock-open'
              }
              size={14}
              color={
                availableMethods.hasBiometric || availableMethods.hasPin
                  ? accent
                  : '#f59e0b'
              }
            />
            <Text
              style={[
                styles.appSecurity,
                {
                  color:
                    availableMethods.hasBiometric || availableMethods.hasPin
                      ? accent
                      : '#f59e0b',
                },
              ]}
            >
              {availableMethods.hasBiometric || availableMethods.hasPin
                ? 'Secured'
                : 'Standard Security'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['rgba(255,71,87,0.1)', 'rgba(255,71,87,0.05)']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color="#ef4444"
            />
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#ef4444"
            />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </AutoHideScrollView>

      <BabySelectionModal
        visible={showBabyModal}
        onClose={() => setShowBabyModal(false)}
        babies={safeBabies}
        currentBabyId={currentBabyId}
        onSelectBaby={handleSelectBabyFromModal}
        isDark={isDark}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8faff',
  },
  loadingContainerDark: {
    backgroundColor: '#0f0f1e',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  loadingTextDark: {
    color: '#a0a0a0',
  },

  header: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  headerSubtitleDark: {
    color: '#a0a0a0',
  },

  profileCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  profileNameDark: {
    color: '#ffffff',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  profileEmailDark: {
    color: '#a0a0a0',
  },
  babyTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  babyTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Community Profile Link ───
  communityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 16,
    gap: 12,
  },
  communityIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityLinkText: {
    flex: 1,
  },
  communityLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  communityLinkTitleDark: {
    color: '#ffffff',
  },
  communityLinkSub: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  communityLinkSubDark: {
    color: '#888',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  statCardDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statValueDark: {
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statLabelDark: {
    color: '#a0a0a0',
  },

  familySection: {
    marginBottom: 20,
  },
  familySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  familySectionTitleDark: {
    color: '#a0a0a0',
  },
  familyMembersRow: {
    paddingRight: 20,
    gap: 16,
  },
  familyMemberItem: {
    alignItems: 'center',
    minWidth: 64,
  },
  familyMemberIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  familyMemberLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    maxWidth: 70,
    textAlign: 'center',
  },
  familyMemberLabelDark: {
    color: '#a0a0a0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#43e97b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  babyIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#667eea',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  babyIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  addMemberIcon: {
    borderStyle: 'dashed',
    borderColor: 'rgba(102,126,234,0.4)',
    backgroundColor: 'rgba(102,126,234,0.05)',
  },
  addMemberIconDark: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },

  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  switchBabyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBabyText: {
    flex: 1,
    fontSize: 15,
    color: '#667eea',
    fontWeight: '700',
  },
  switchBabyBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  switchBabyBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  sectionTitleDark: {
    color: '#ffffff',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  menuTitleDark: {
    color: '#ffffff',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
    fontWeight: '500',
  },
  menuSubtitleDark: {
    color: '#888',
  },
  menuTextDisabled: {
    color: '#999',
  },
  destructiveText: {
    color: '#ef4444',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 80,
  },
  dividerDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    gap: 12,
  },
  appIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  appIconContainerDark: {
    backgroundColor: 'rgba(102,126,234,0.2)',
    borderColor: 'rgba(102,126,234,0.3)',
  },
  appIcon: {
    fontSize: 32,
  },
  appVersion: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  appVersionDark: {
    color: '#888',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(67,233,123,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  appSecurity: {
    fontSize: 13,
    fontWeight: '700',
  },

  logoutButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ef4444',
    flex: 1,
    marginLeft: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  modalTitleDark: {
    color: '#ffffff',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  modalContentContainer: {
    gap: 12,
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  babyOptionDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
  },
  babyOptionActive: {
    borderColor: '#43e97b',
    backgroundColor: 'rgba(67,233,123,0.1)',
  },
  babyOptionActiveDark: {
    backgroundColor: 'rgba(67,233,123,0.15)',
  },
  babyOptionEmojiContainer: {
    position: 'relative',
    marginRight: 16,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  babyOptionInfo: {
    flex: 1,
  },
  babyOptionName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  babyOptionNameDark: {
    color: '#ffffff',
  },
  babyOptionNameActive: {
    color: '#43e97b',
  },
  babyOptionAge: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  babyOptionAgeDark: {
    color: '#888',
  },
});