import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import type { FamilyMember } from '../../types/roles';
import type { RootStackParamList } from '../../types/navigation';
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import { useActivity } from '../../context/ActivityContext';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useMedia } from '../../context/MediaContext';
import { useSecurity } from '../../context/SecurityContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
  FadeInUp,
  FadeIn,
  Layout,
} from 'react-native-reanimated';


type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
  hapticType?: 'light' | 'medium' | 'heavy';
}

const PressableScale: React.FC<PressableScaleProps> = React.memo(({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  activeScale = 0.96,
  hapticType = 'light',
}) => {
  const scale = useSharedValue(1);
  const { triggerHaptic, hapticFeedback } = useCustomization();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(activeScale, { duration: 80 });
  }, [activeScale, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticFeedback) {
      triggerHaptic(hapticType).catch(() => {});
    }
    onPress?.();
  }, [disabled, hapticFeedback, triggerHaptic, hapticType, onPress]);

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

interface SectionHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  color: string;
  isDark: boolean;
  isExpanded: boolean;
  onPress: () => void;
  badge?: number | string;
  rightAction?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({
  icon,
  title,
  subtitle,
  color,
  isDark,
  isExpanded,
  onPress,
  badge,
  rightAction,
}) => {
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, { duration: 250 });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: `${interpolate(rotation.value, [0, 1], [0, 90], Extrapolate.CLAMP)}deg`,
    }],
  }));

  return (
    <PressableScale onPress={onPress} hapticType="light">
      <View style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {rightAction}
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? '#666' : '#999'}
            />
          </Animated.View>
        </View>
      </View>
    </PressableScale>
  );
});

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
  isLast?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = React.memo(({
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
  isLast = false,
}) => {
  const { hapticFeedback, triggerHaptic } = useCustomization();

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (onToggle) {
      onToggle(!isEnabled);
    } else if (onPress) {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      onPress();
    }
  }, [disabled, onToggle, onPress, isEnabled, hapticFeedback, triggerHaptic]);

  const iconColor = isDestructive ? '#ef4444' : disabled ? '#999' : color;
  const titleColor = isDestructive ? '#ef4444' : disabled ? '#999' : isDark ? '#fff' : '#1a1a1a';
  const subtitleColor = isDark ? '#888' : '#999';

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled}
      activeScale={0.98}
      style={!isLast ? styles.menuItemBorder : undefined}
    >
      <View style={[styles.menuItem, disabled && styles.menuItemDisabled]}>
        <View style={[styles.menuIconWrap, {
          backgroundColor: isDestructive ? 'rgba(239,68,68,0.12)' : `${color}12`,
        }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>

        <View style={styles.menuTextContainer}>
          <View style={styles.menuTitleRow}>
            <Text style={[styles.menuTitle, { color: titleColor }]} numberOfLines={1}>
              {title}
            </Text>
            {badge !== undefined && (
              <View style={[styles.badgeSmall, { backgroundColor: color }]}>
                <Text style={styles.badgeTextSmall}>{badge}</Text>
              </View>
            )}
          </View>
          {(subtitle || value) && (
            <Text style={[styles.menuSubtitle, { color: subtitleColor }]} numberOfLines={1}>
              {value || subtitle}
            </Text>
          )}
        </View>

        <View style={styles.menuRight}>
          {onToggle ? (
            <Switch
              value={isEnabled}
              onValueChange={disabled ? undefined : onToggle}
              trackColor={{
                false: isDark ? '#333' : '#d1d5db',
                true: `${color}50`,
              }}
              thumbColor={isEnabled ? color : isDark ? '#555' : '#f4f3f4'}
              disabled={disabled}
              style={styles.switch}
            />
          ) : showArrow ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={disabled ? '#555' : isDark ? '#666' : '#bbb'}
            />
          ) : value ? (
            <Text style={[styles.menuValue, isDark && styles.textMuted]}>{value}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
  isDark: boolean;
  onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = React.memo(({ icon, value, label, color, isDark, onPress }) => (
  <PressableScale onPress={onPress} activeScale={0.95} style={{ flex: 1 }}>
    <BlurView
      intensity={isDark ? 40 : 80}
      style={[styles.statCard, isDark && styles.statCardDark]}
      tint={isDark ? 'dark' : 'light'}
    >
      <View style={[styles.statIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, isDark && styles.textLight]}>{value}</Text>
      <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
    </BlurView>
  </PressableScale>
));

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  isDark: boolean;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = React.memo(({ icon, label, color, isDark, onPress }) => (
  <PressableScale onPress={onPress} activeScale={0.9} style={styles.quickAction}>
    <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={[styles.quickActionLabel, isDark && styles.textMuted]}>{label}</Text>
  </PressableScale>
));

interface FamilyMemberProps {
  avatar?: string | number;
  name: string;
  label: string;
  color: string;
  isDark: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
  isBaby?: boolean;
  gender?: 'boy' | 'girl' | 'other';
}

const FamilyMemberItem: React.FC<FamilyMemberProps> = React.memo(({
  avatar,
  name,
  label,
  color,
  isDark,
  onPress,
  badge,
  isBaby = false,
  gender = 'other',
}) => (
  <PressableScale onPress={onPress} activeScale={0.92} style={styles.familyMember}>
    <View style={[styles.familyAvatarWrap, { borderColor: `${color}40` }]}>
      {isBaby ? (
        <SafeBabyAvatar
          avatar={avatar}
          gender={gender}
          size={48}
          showBadge={false}
        />
      ) : (
        <SafeAvatar
          avatar={avatar}
          size={48}
          fallbackIcon="person"
          fallbackColor={color}
          borderWidth={0}
        />
      )}
      {badge}
    </View>
    <Text style={[styles.familyName, isDark && styles.textLight]} numberOfLines={1}>
      {name}
    </Text>
    <Text style={[styles.familyLabel, isDark && styles.textMuted]}>{label}</Text>
  </PressableScale>
));

interface BabySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  babies: any[];
  currentBabyId: string | null;
  onSelectBaby: (baby: any) => void;
  isDark: boolean;
  primaryColor: string;
}

const BabySelectionModal: React.FC<BabySelectionModalProps> = React.memo(({
  visible,
  onClose,
  babies,
  currentBabyId,
  onSelectBaby,
  isDark,
  primaryColor,
}) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.modalBackdrop, backdropStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[styles.modalSheet, sheetStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <BlurView
          intensity={isDark ? 60 : 90}
          style={styles.modalSheetBlur}
          tint={isDark ? 'dark' : 'light'}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalSheetHeader}>
            <Text style={[styles.modalSheetTitle, isDark && styles.textLight]}>
              Select Baby Profile
            </Text>
            <PressableScale onPress={onClose} hapticType="light">
              <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                <Ionicons name="close" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
              </View>
            </PressableScale>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalSheetContent}
          >
            {babies.map((baby) => {
              const isActive = baby.id === currentBabyId;
              return (
                <PressableScale
                  key={baby.id}
                  onPress={() => onSelectBaby(baby)}
                  activeScale={0.98}
                >
                  <View style={[
                    styles.babyOption,
                    isDark && styles.babyOptionDark,
                    isActive && [styles.babyOptionActive, { borderColor: primaryColor }],
                    isActive && isDark && styles.babyOptionActiveDark,
                  ]}>
                    <SafeBabyAvatar
                      avatar={baby.avatar}
                      gender={baby.gender}
                      size={52}
                    />
                    <View style={styles.babyOptionInfo}>
                      <Text style={[
                        styles.babyOptionName,
                        isDark && styles.textLight,
                        isActive && { color: primaryColor },
                      ]}>
                        {baby.name}
                      </Text>
                      <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                        {baby.age || 'Age unknown'} · {baby.gender || 'Unknown'}
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={[styles.activeCheck, { backgroundColor: primaryColor }]}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
                    )}
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </BlurView>
      </Animated.View>
    </View>
  );
});

interface ProfileHeaderProps {
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
  accentColor: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = React.memo(({
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
  accentColor,
}) => {
  const safeBabies = babies || [];
  const hasMultipleBabies = safeBabies.length > 1;
  const { triggerHaptic, hapticFeedback } = useCustomization();

  const handleBabyPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    if (safeBabies.length === 1 && currentBaby) {
      navigation.navigate('EditProfile', { mode: 'baby', babyId: currentBaby.id });
    } else if (safeBabies.length > 1) {
      onShowBabyModal();
    } else {
      navigation.navigate('CreateBabyProfile');
    }
  }, [safeBabies.length, currentBaby, hapticFeedback, triggerHaptic, navigation, onShowBabyModal]);

  const handleCurrentUserPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    const guardianId = userProfile?.id || userProfile?.uid || 'parent1';
    navigation.navigate('EditGuardian', {
      guardianId,
      mode: 'parent2',
      fromChat: false,
    });
  }, [userProfile, hapticFeedback, triggerHaptic, navigation]);

  const handleParent2Press = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    if (parent2Profile) {
      navigation.navigate('EditGuardian', {
        guardianId: parent2Profile.id,
        mode: 'parent2',
        fromChat: false,
      });
    } else {
      navigation.navigate('AddParent');
    }
  }, [parent2Profile, hapticFeedback, triggerHaptic, navigation]);

  const handleGuardianPress = useCallback((guardian: FamilyMember) => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    navigation.navigate('EditGuardian', {
      guardianId: guardian.id,
      mode: 'guardian',
      fromChat: false,
    });
  }, [hapticFeedback, triggerHaptic, navigation]);

  const handleCommunityProfile = useCallback(() => {
    if (hapticFeedback) triggerHaptic('medium').catch(() => {});
    navigation.navigate('Main', {
      screen: 'Connect',
      params: {
        screen: 'CommunityProfile',
        params: { userId: userProfile?.id },
      },
    });
  }, [userProfile, hapticFeedback, triggerHaptic, navigation]);

  return (
    <BlurView
      intensity={isDark ? 35 : 85}
      style={styles.profileCard}
      tint={isDark ? 'dark' : 'light'}
    >
      {/* User Info Row */}
      <View style={styles.profileTopRow}>
        <PressableScale onPress={handleCurrentUserPress} activeScale={0.92}>
          <SafeAvatar
            avatar={userProfile?.avatar}
            size={72}
            fallbackIcon="person"
            fallbackColor={primaryColor}
            showEditBadge={true}
            borderWidth={3}
            borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#fff'}
          />
        </PressableScale>

        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, isDark && styles.textLight]} numberOfLines={1}>
            {userProfile?.fullName || 'Parent'}
          </Text>
          <Text style={[styles.profileEmail, isDark && styles.textMuted]} numberOfLines={1}>
            {userProfile?.email || 'parent@littleloom.app'}
          </Text>
          {currentBaby && (
            <View style={[styles.babyTag, { backgroundColor: `${secondaryColor}18` }]}>
              <Ionicons name="heart" size={12} color={secondaryColor} />
              <Text style={[styles.babyTagText, { color: secondaryColor }]}>
                {currentBaby.name} · {currentBaby.age}
              </Text>
            </View>
          )}
        </View>

        <PressableScale onPress={handleCurrentUserPress} activeScale={0.85}>
          <View style={[styles.settingsBtn, isDark && styles.settingsBtnDark]}>
            <Ionicons name="settings-outline" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
          </View>
        </PressableScale>
      </View>

      {/* Community Profile Link */}
      <PressableScale onPress={handleCommunityProfile} activeScale={0.98}>
        <View style={[styles.communityLink, { backgroundColor: `${primaryColor}10` }]}>
          <View style={[styles.communityIcon, { backgroundColor: `${primaryColor}18` }]}>
            <Ionicons name="globe-outline" size={18} color={primaryColor} />
          </View>
          <View style={styles.communityLinkText}>
            <Text style={[styles.communityLinkTitle, isDark && styles.textLight]}>
              Community Profile
            </Text>
            <Text style={[styles.communityLinkSub, isDark && styles.textMuted]}>
              Edit your public profile & bio
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#bbb'} />
        </View>
      </PressableScale>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard
          icon="time-outline"
          value={stats.entries}
          label="Entries"
          color="#4facfe"
          isDark={isDark}
          onPress={() => navigation.navigate('Main', { screen: 'Track' })}
        />
        <StatCard
          icon="flame-outline"
          value={stats.streak}
          label="Day Streak"
          color="#f59e0b"
          isDark={isDark}
          onPress={() => navigation.navigate('Achievements')}
        />
        <StatCard
          icon="trophy-outline"
          value={stats.milestones}
          label="Milestones"
          color={accentColor}
          isDark={isDark}
          onPress={() => navigation.navigate('Achievements', { highlightAchievement: 'milestones' })}
        />
      </View>

      {/* Family Members Scroll */}
      <View style={styles.familySection}>
        <Text style={[styles.familySectionTitle, isDark && styles.textMuted]}>
          FAMILY MEMBERS
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.familyScroll}
        >
          <FamilyMemberItem
            avatar={userProfile?.avatar}
            name="You"
            label="Parent"
            color={primaryColor}
            isDark={isDark}
            onPress={handleCurrentUserPress}
            badge={
              <View style={[styles.onlineIndicator, { backgroundColor: accentColor, borderColor: isDark ? '#1a1a2e' : '#fff' }]} />
            }
          />

          <FamilyMemberItem
            avatar={currentBaby?.avatar}
            name={currentBaby?.name || 'Baby'}
            label="Baby"
            color={secondaryColor}
            isDark={isDark}
            onPress={handleBabyPress}
            isBaby={true}
            gender={currentBaby?.gender}
            badge={hasMultipleBabies ? (
              <View style={[styles.babyCountBadge, { backgroundColor: primaryColor }]}>
                <Text style={styles.babyCountText}>{safeBabies.length}</Text>
              </View>
            ) : undefined}
          />

          {parent2Profile && (
            <FamilyMemberItem
              avatar={parent2Profile?.avatar}
              name={parent2Profile?.fullName || 'Co-Parent'}
              label="Co-Parent"
              color="#11998e"
              isDark={isDark}
              onPress={handleParent2Press}
            />
          )}

          {guardians?.map((guardian, index) => (
            <FamilyMemberItem
              key={guardian.id || index}
              avatar={guardian?.avatar}
              name={guardian.fullName || 'Guardian'}
              label="Guardian"
              color="#9b59b6"
              isDark={isDark}
              onPress={() => handleGuardianPress(guardian)}
            />
          ))}

          <FamilyMemberItem
            avatar={undefined}
            name="Add"
            label="Member"
            color={primaryColor}
            isDark={isDark}
            onPress={() => navigation.navigate('FamilySharing')}
            badge={
              <View style={[styles.addBadge, isDark && styles.addBadgeDark]}>
                <Ionicons name="add" size={18} color={primaryColor} />
              </View>
            }
          />
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="person-outline"
          label="Profile"
          color={primaryColor}
          isDark={isDark}
          onPress={handleCurrentUserPress}
        />
        <QuickAction
          icon="heart-outline"
          label="Baby"
          color={secondaryColor}
          isDark={isDark}
          onPress={handleBabyPress}
        />
        <QuickAction
          icon="people-outline"
          label="Family"
          color="#11998e"
          isDark={isDark}
          onPress={() => navigation.navigate('FamilySharing')}
        />
        <QuickAction
          icon="notifications-outline"
          label="Alerts"
          color="#f59e0b"
          isDark={isDark}
          onPress={() => navigation.navigate('TrackerReminders')}
        />
      </View>

      {/* Switch Baby Row */}
      {hasMultipleBabies && (
        <PressableScale
          onPress={() => navigation.navigate('SwitchBaby')}
          activeScale={0.98}
        >
          <View style={styles.switchBabyRow}>
            <View style={[styles.switchBabyIcon, { backgroundColor: `${primaryColor}12` }]}>
              <Ionicons name="swap-horizontal" size={18} color={primaryColor} />
            </View>
            <Text style={[styles.switchBabyText, { color: primaryColor }]}>
              Switch Active Baby
            </Text>
            <View style={[styles.switchBabyBadge, { backgroundColor: primaryColor }]}>
              <Text style={styles.switchBabyBadgeText}>{safeBabies.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={primaryColor} />
          </View>
        </PressableScale>
      )}
    </BlurView>
  );
});

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['security', 'preferences', 'family'])
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
    isBiometricEnabled,
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
  const { pickImage } = useMedia();
  const sweetAlert = useSweetAlert();
  const { isNavVisible, showNav } = useApp();

  const {
    themeColors,
    fullThemeColors,
    darkMode,
    reduceMotion,
    hapticFeedback,
    triggerHaptic,
    isDark: customizationIsDark,
  } = useCustomization();

  const insets = useSafeAreaInsets();
  const isDark = customizationIsDark;
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const availableMethods = getAvailableAuthMethods();
  const biometricTypeName = getBiometricTypeName();
  const hasBiometric = isBiometricHardwareAvailable && isBiometricEnrolled;

  const safeBabies = babies || [];

  const babyStats = currentBaby ? getBabyStats() : { streak: 0, milestones: 0, photos: 0, entries: 0 };
  const activityStats = {
    entries: entries?.length || 0,
    streak: babyStats.streak || 0,
    milestones: babyStats.milestones || 0,
  };

  const toggleSection = useCallback((section: string) => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, [hapticFeedback, triggerHaptic]);

  const handleBiometricToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (!hasBiometric) {
        sweetAlert.error('Biometric Not Available', 'Please set up biometric authentication in your device settings first.');
        return;
      }
      navigation.navigate('BiometricSetup');
    } else {
      sweetAlert.confirm(
        'Disable Biometric?',
        'Are you sure you want to disable biometric authentication?',
        async () => {
          const success = await toggleBiometric(false);
          if (!success) {
            sweetAlert.error('Error', 'Could not disable biometric authentication.');
          }
        },
        undefined,
        'Disable',
        'Cancel'
      );
    }
  }, [hasBiometric, navigation, sweetAlert, toggleBiometric]);

  const handlePinSetup = useCallback(() => {
    navigation.navigate('SecurityCenter', { mode: 'setup' });
  }, [navigation]);

  const handleLockNow = useCallback(async () => {
    if (!availableMethods.hasPin && !availableMethods.hasBiometric) {
      sweetAlert.error('No Security Enabled', 'Please enable PIN or Biometric authentication first.');
      return;
    }
    await lockApp();
  }, [availableMethods, lockApp, sweetAlert]);

  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  const handleAutoLockTimeout = useCallback(() => {
    if (!securitySettings.isAppLockEnabled) {
      sweetAlert.toast('Enable App Lock first', 'Turn on Auto-Lock App to set a timeout', 'warning');
      return;
    }
    setShowTimeoutModal(true);
  }, [securitySettings.isAppLockEnabled, sweetAlert]);

  const handleSelectTimeout = useCallback(async (minutes: number) => {
    setShowTimeoutModal(false);
    try {
      await updateAutoLockTimeout(minutes);
      sweetAlert.toast('Timeout Updated', `Auto-lock set to ${formatTimeout(minutes)}`, 'success');
    } catch (err) {
      sweetAlert.error('Update Failed', 'Could not update auto-lock timeout.');
    }
  }, [updateAutoLockTimeout, sweetAlert, formatTimeout]);

  const handleLogout = useCallback(() => {
    sweetAlert.confirm(
      'Logout',
      'Are you sure you want to sign out? You will need to sign in again to access your data.',
      () => {
        signOut();
      },
      undefined,
      'Logout',
      'Stay'
    );
  }, [signOut, sweetAlert]);

  const handleSelectBabyFromModal = useCallback((baby: any) => {
    setShowBabyModal(false);
    navigation.navigate('EditProfile', { mode: 'baby', babyId: baby.id });
  }, [navigation]);

  const formatTimeout = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, []);

  const bgColors = useMemo(() => {
    if (isDark) {
      return [
        fullThemeColors?.background || '#0f0f1e',
        fullThemeColors?.surface || '#1a1a2e',
        fullThemeColors?.card || '#16162a',
      ];
    }
    return [
      fullThemeColors?.background || '#f8faff',
      fullThemeColors?.surface || '#ffffff',
      fullThemeColors?.card || '#f0f4ff',
    ];
  }, [isDark, fullThemeColors]);

  const renderSecuritySection = useCallback(() => {
    const isExpanded = expandedSections.has('security');
    return (
      <Animated.View entering={FadeInUp.delay(100)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="shield-checkmark"
          title="Security & Privacy"
          subtitle={isBiometricEnabled ? `${biometricTypeName} enabled` : 'Protect your data'}
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
              icon={isBiometricEnabled ? 'finger-print' : 'finger-print-outline'}
              title={`${biometricTypeName} Unlock`}
              subtitle={isBiometricEnabled ? 'Enabled' : hasBiometric ? 'Disabled' : 'Not Available'}
              isEnabled={isBiometricEnabled}
              onToggle={handleBiometricToggle}
              color={primary}
              isDark={isDark}
              disabled={!hasBiometric}
            />
            <MenuItem
              icon="keypad"
              title="PIN Code"
              subtitle={securitySettings.isPinEnabled ? 'Change PIN' : 'Set up PIN'}
              onPress={handlePinSetup}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="lock-closed"
              title="Auto-Lock App"
              subtitle={securitySettings.isAppLockEnabled ? `After ${formatTimeout(securitySettings.autoLockTimeout)}` : 'Disabled'}
              isEnabled={securitySettings.isAppLockEnabled}
              onToggle={toggleAppLock}
              color={accent}
              isDark={isDark}
            />
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
            <MenuItem
              icon="lock-closed-outline"
              title="Lock Now"
              subtitle="Immediately lock the app"
              onPress={handleLockNow}
              color="#ef4444"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, securitySettings, biometricTypeName, hasBiometric, primary, secondary, accent, isDark, toggleSection, handleBiometricToggle, handlePinSetup, toggleAppLock, handleAutoLockTimeout, formatTimeout, handleLockNow]);

  const renderPreferencesSection = useCallback(() => {
    const isExpanded = expandedSections.has('preferences');
    return (
      <Animated.View entering={FadeInUp.delay(150)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="options"
          title="Preferences"
          subtitle="Themes, notifications, language"
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
              onPress={() => navigation.navigate('TrackerReminders')}
              color="#4facfe"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="color-palette"
              title="Customize App"
              subtitle="Themes, avatars, appearance"
              onPress={() => navigation.navigate('Customize')}
              color="#9b59b6"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="language"
              title="Language"
              value="English (US)"
              onPress={() => navigation.navigate('LanguageSettings')}
              color="#fa8231"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="bar-chart"
              title="Units"
              value="Metric (kg, cm)"
              onPress={() => navigation.navigate('UnitSettings')}
              color="#5f27cd"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, isDark, toggleSection, navigation]);

  const renderFamilySection = useCallback(() => {
    const isExpanded = expandedSections.has('family');
    return (
      <Animated.View entering={FadeInUp.delay(200)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="people"
          title="Family & Sharing"
          subtitle={`${guardians?.length || 0} guardians connected`}
          color={secondary}
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('family')}
          badge={guardians?.length || undefined}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="people-outline"
              title="Family Dashboard"
              subtitle="Manage co-parents and guardians"
              onPress={() => navigation.navigate('FamilySharing')}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="person-add"
              title="Invite Co-Parent"
              subtitle="Add another parent to your account"
              onPress={() => navigation.navigate('AddParent')}
              color="#11998e"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="share-outline"
              title="Export Data"
              subtitle="Backup and restore your data"
              onPress={() => navigation.navigate('BackupRestore')}
              color={accent}
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, guardians, secondary, accent, isDark, toggleSection, navigation]);

  const renderTrackingSection = useCallback(() => {
    const isExpanded = expandedSections.has('tracking');
    return (
      <Animated.View entering={FadeInUp.delay(250)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="analytics"
          title="Tracking & Insights"
          subtitle="Growth, achievements, history"
          color="#4facfe"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('tracking')}
        />
        {isExpanded && (
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
              color="#f59e0b"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="trending-up"
              title="Growth Charts"
              subtitle="Track height, weight, and more"
              onPress={() => navigation.navigate('GrowthDashboard')}
              color={accent}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="calendar-outline"
              title="Activity History"
              subtitle="View complete timeline"
              onPress={() => navigation.navigate('Main', { screen: 'Track' })}
              color={primary}
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, primary, accent, isDark, toggleSection, navigation]);

  const renderSafetySection = useCallback(() => {
    const isExpanded = expandedSections.has('safety');
    return (
      <Animated.View entering={FadeInUp.delay(300)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="shield-half"
          title="Safety"
          subtitle="Emergency contacts & first aid"
          color="#ef4444"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('safety')}
        />
        {isExpanded && (
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
            <MenuItem
              icon="medical"
              title="Emergency Info"
              subtitle="Quick access to emergency details"
              onPress={() => navigation.navigate('SafetyCorner')}
              color="#f59e0b"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, isDark, toggleSection, navigation]);

  const renderSupportSection = useCallback(() => {
    const isExpanded = expandedSections.has('support');
    return (
      <Animated.View entering={FadeInUp.delay(350)} layout={Layout.springify()} style={styles.section}>
        <SectionHeader
          icon="help-circle"
          title="Support & About"
          subtitle="Help, privacy, app info"
          color="#9b59b6"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('support')}
        />
        {isExpanded && (
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
            <MenuItem
              icon="chatbubble-ellipses"
              title="Contact Support"
              subtitle="Get help from our team"
              onPress={() => navigation.navigate('ContactSupport')}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="document-text"
              title="Privacy Policy"
              subtitle="Read our privacy terms"
              onPress={() => navigation.navigate('PrivacyPolicy')}
              color="#11998e"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="information-circle"
              title="About LittleLoom"
              subtitle="Version 1.0.0 · Build 2024.06"
              onPress={() => navigation.navigate('About')}
              color="#5f27cd"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, secondary, isDark, toggleSection, navigation]);

  if (authLoading || babyLoading) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <View style={[styles.loadingSpinner, { borderColor: primary }]}>
            <Ionicons name="settings-outline" size={40} color={primary} />
          </View>
          <Text style={[styles.loadingText, isDark && styles.textMuted]}>
            Loading your settings...
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>
            Settings
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            Manage your account, family, and preferences
          </Text>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.delay(50).duration(500)}>
          <ProfileHeader
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
            accentColor={accent}
          />
        </Animated.View>

        {/* Sections */}
        {renderSecuritySection()}
        {renderPreferencesSection()}
        {renderFamilySection()}
        {renderTrackingSection()}
        {renderSafetySection()}
        {renderSupportSection()}

        {/* App Info Footer */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.appInfo}>
          <View style={[styles.appIconWrap, isDark && styles.appIconWrapDark]}>
            <Text style={styles.appIcon}>🧵</Text>
          </View>
          <Text style={[styles.appVersion, isDark && styles.textMuted]}>
            LittleLoom v1.0.0
          </Text>
          <View style={[styles.securityBadge, {
            backgroundColor: (availableMethods.hasBiometric || availableMethods.hasPin)
              ? `${accent}15`
              : 'rgba(245,158,11,0.15)',
          }]}>
            <Ionicons
              name={availableMethods.hasBiometric || availableMethods.hasPin ? 'lock-closed' : 'lock-open'}
              size={14}
              color={availableMethods.hasBiometric || availableMethods.hasPin ? accent : '#f59e0b'}
            />
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: availableMethods.hasBiometric || availableMethods.hasPin ? accent : '#f59e0b',
            }}>
              {availableMethods.hasBiometric || availableMethods.hasPin ? 'Secured' : 'Standard Security'}
            </Text>
          </View>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeInUp.delay(450)}>
          <PressableScale onPress={handleLogout} activeScale={0.97} hapticType="medium">
            <LinearGradient
              colors={['rgba(239,68,68,0.08)', 'rgba(239,68,68,0.04)']}
              style={styles.logoutButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.logoutContent}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                <Text style={styles.logoutText}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={20} color="#ef4444" />
              </View>
            </LinearGradient>
          </PressableScale>
        </Animated.View>

        <View style={{ height: 30 }} />
      </Animated.ScrollView>

      {/* Auto-Lock Timeout Selection Modal */}
      <Modal
        visible={showTimeoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeoutModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <BlurView
            intensity={isDark ? 60 : 90}
            style={[styles.timeoutModal, isDark && styles.timeoutModalDark]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.timeoutModalHeader}>
              <Text style={[styles.timeoutModalTitle, isDark && styles.textLight]}>
                Auto-Lock Timeout
              </Text>
              <PressableScale onPress={() => setShowTimeoutModal(false)} hapticType="light">
                <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                  <Ionicons name="close" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
                </View>
              </PressableScale>
            </View>
            <Text style={[styles.timeoutModalSubtitle, isDark && styles.textMuted]}>
              Select when to automatically lock the app
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: '1 minute', value: 1 },
                { label: '2 minutes', value: 2 },
                { label: '5 minutes', value: 5 },
                { label: '10 minutes', value: 10 },
                { label: '15 minutes', value: 15 },
                { label: '30 minutes', value: 30 },
                { label: '1 hour', value: 60 },
              ].map((option) => {
                const isActive = securitySettings.autoLockTimeout === option.value;
                return (
                  <PressableScale
                    key={option.value}
                    onPress={() => handleSelectTimeout(option.value)}
                    activeScale={0.98}
                  >
                    <View style={[
                      styles.timeoutOption,
                      isDark && styles.timeoutOptionDark,
                      isActive && [styles.timeoutOptionActive, { borderColor: primary }],
                      isActive && isDark && styles.timeoutOptionActiveDark,
                    ]}>
                      <View style={[styles.timeoutOptionIcon, { backgroundColor: isActive ? `${primary}18` : 'transparent' }]}>
                        <Ionicons
                          name={isActive ? 'time' : 'time-outline'}
                          size={22}
                          color={isActive ? primary : isDark ? '#666' : '#999'}
                        />
                      </View>
                      <Text style={[
                        styles.timeoutOptionLabel,
                        isDark && styles.textLight,
                        isActive && { color: primary, fontWeight: '800' },
                      ]}>
                        {option.label}
                      </Text>
                      {isActive && (
                        <View style={[styles.activeCheck, { backgroundColor: primary }]}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Baby Selection Modal */}
      <BabySelectionModal
        visible={showBabyModal}
        onClose={() => setShowBabyModal(false)}
        babies={safeBabies}
        currentBabyId={currentBabyId}
        onSelectBaby={handleSelectBabyFromModal}
        isDark={isDark}
        primaryColor={primary}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },

  textLight: { color: '#ffffff' },
  textMuted: { color: '#888' },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerDark: { backgroundColor: '#0f0f1e' },
  loadingSpinner: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },

  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },

  profileCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  babyTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  babyTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

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
  communityLinkText: { flex: 1 },
  communityLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  communityLinkSub: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  statCardDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  familySection: { marginBottom: 18 },
  familySectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  familyScroll: {
    paddingRight: 16,
    gap: 14,
  },
  familyMember: {
    alignItems: 'center',
    minWidth: 64,
  },
  familyAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  familyName: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '700',
    maxWidth: 70,
    textAlign: 'center',
  },
  familyLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    marginTop: 1,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  babyCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  babyCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addBadgeDark: {
    backgroundColor: '#1a1a2e',
    borderColor: 'rgba(255,255,255,0.1)',
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  quickAction: {
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
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },

  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    gap: 12,
  },
  switchBabyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBabyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  switchBabyBadge: {
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  switchBabyBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionHeaderDark: {
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },

  menuContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContainer: {
    flex: 1,
    gap: 2,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuValue: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },

  badge: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  badgeSmall: {
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  section: {
    marginBottom: 4,
  },

  appInfo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    gap: 10,
  },
  appIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconWrapDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  appIcon: {
    fontSize: 28,
  },
  appVersion: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  logoutButton: {
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },

  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalSheetBlur: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalSheetContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 14,
  },
  babyOptionDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.08)',
  },
  babyOptionActiveDark: {
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  babyOptionInfo: {
    flex: 1,
  },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  babyOptionMeta: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  activeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Timeout Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  timeoutModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  timeoutModalDark: {
    backgroundColor: 'rgba(26,26,46,0.95)',
  },
  timeoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeoutModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  timeoutModalSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    marginBottom: 16,
  },
  timeoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  timeoutOptionDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  timeoutOptionActive: {
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderWidth: 2,
  },
  timeoutOptionActiveDark: {
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  timeoutOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeoutOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});