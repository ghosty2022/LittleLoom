// screens/main/MoreScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
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
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase integration
import { supabase } from '../../lib/supabase';
import { useSupabase } from '../../hooks/useSupabase';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

// Contexts
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';

// Components
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useSweetAlert } from '../../components/SweetAlert';

// Types
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import type { FamilyMember } from '../../types/roles';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ──────────────────────────────────────────────────────────

const SECTION_ICONS = {
  security: 'shield-checkmark',
  preferences: 'options',
  family: 'people',
  tracking: 'analytics',
  safety: 'shield-half',
  support: 'help-circle',
} as const;

const QUICK_ACTIONS = [
  { icon: 'person-outline', label: 'Profile', route: 'Profile' },
  { icon: 'heart-outline', label: 'Baby', route: 'EditProfile' },
  { icon: 'people-outline', label: 'Family', route: 'FamilySharing' },
  { icon: 'notifications-outline', label: 'Alerts', route: 'TrackerReminders' },
] as const;

// ─── Animated Components ──────────────────────────────────────────────

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success';
}

const PressableScale = React.memo<PressableScaleProps>(({
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

// ─── Skeleton Loader ──────────────────────────────────────────────────

const SkeletonLoader = React.memo(({ isDark }: { isDark: boolean }) => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3, 4].map((i) => (
      <Animated.View
        key={i}
        entering={FadeInUp.delay(i * 80)}
        style={[styles.skeletonCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
      >
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.skeletonText}>
          <View style={[styles.skeletonLine, { width: '60%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
          <View style={[styles.skeletonLine, { width: '40%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]} />
        </View>
      </Animated.View>
    ))}
  </View>
));

// ─── Section Components ──────────────────────────────────────────────

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

const SectionHeader = React.memo<SectionHeaderProps>(({
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
  loading?: boolean;
}

const MenuItem = React.memo<MenuItemProps>(({
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
  loading = false,
}) => {
  const { hapticFeedback, triggerHaptic } = useCustomization();

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (onToggle) {
      onToggle(!isEnabled);
    } else if (onPress) {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      onPress();
    }
  }, [disabled, loading, onToggle, onPress, isEnabled, hapticFeedback, triggerHaptic]);

  const iconColor = isDestructive ? '#ef4444' : disabled ? '#999' : color;
  const titleColor = isDestructive ? '#ef4444' : disabled ? '#999' : isDark ? '#fff' : '#1a1a1a';
  const subtitleColor = isDark ? '#888' : '#999';

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled || loading}
      activeScale={0.98}
      style={!isLast ? styles.menuItemBorder : undefined}
    >
      <View style={[styles.menuItem, (disabled || loading) && styles.menuItemDisabled]}>
        <View style={[styles.menuIconWrap, {
          backgroundColor: isDestructive ? 'rgba(239,68,68,0.12)' : `${color}12`,
        }]}>
          {loading ? (
            <UniversalSpinner size={18} color={color} variant="liquid" section="settings" />
          ) : (
            <Ionicons name={icon} size={22} color={iconColor} />
          )}
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

// ─── Main Component ──────────────────────────────────────────────────

function MoreScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { sweetAlert } = useSweetAlert();
  
  // ─── Contexts ────────────────────────────────────────────────────
  const { signOut, userProfile, isLoading: authLoading } = useAuth();
  const { 
    babies, 
    currentBaby, 
    currentBabyId, 
    isLoading: babyLoading, 
    hasSkippedBaby,
    getBabyStats,
    loadBabies,
  } = useBaby();
  const { guardians, parent2: parent2Profile, familyMembers } = useFamily();
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
  const { 
    themeColors, 
    fullThemeColors,
    darkMode, 
    reduceMotion, 
    hapticFeedback,
    triggerHaptic,
    isDark: customizationIsDark,
  } = useCustomization();
  const { isNavVisible, showNav } = useApp();

  // ─── State ──────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['security', 'preferences', 'family'])
  );
  const [refreshing, setRefreshing] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [onlineStatus, setOnlineStatus] = useState(true);

  // ─── Refs ──────────────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const isMounted = useRef(true);

  // ─── Computed ──────────────────────────────────────────────────
  const isDark = customizationIsDark;
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const safeBabies = babies || [];
  const availableMethods = getAvailableAuthMethods();
  const biometricTypeName = getBiometricTypeName();
  const hasBiometric = isBiometricHardwareAvailable && isBiometricEnrolled;

  const babyStats = currentBaby ? getBabyStats() : { streak: 0, milestones: 0, photos: 0, entries: 0 };
  const activityStats = {
    entries: babyStats.entries || 0,
    streak: babyStats.streak || 0,
    milestones: babyStats.milestones || 0,
  };

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

  // ─── Supabase Integration ──────────────────────────────────────
  const { user, session, isConnected } = useSupabase();

  // Real-time subscription for family updates
  useRealtimeSubscription({
    table: 'family_members',
    filter: `baby_id=eq.${currentBaby?.id}`,
    onInsert: (payload) => {
      // Refresh family data
      loadBabies();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onUpdate: (payload) => {
      loadBabies();
    },
    onDelete: (payload) => {
      loadBabies();
    },
    enabled: !!currentBaby?.id && isConnected,
  });

  // ─── Handlers ──────────────────────────────────────────────────

  const toggleSection = useCallback((section: string) => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, [hapticFeedback, triggerHaptic]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBabies(),
        // Sync with Supabase
        supabase.from('family_members').select('*').eq('baby_id', currentBaby?.id),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, currentBaby?.id]);

  const handleSync = useCallback(async () => {
    if (syncStatus === 'syncing') return;
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Sync family members
      if (currentBaby?.id && familyMembers.length > 0) {
        const { error } = await supabase
          .from('family_members')
          .upsert(
            familyMembers.map(member => ({
              ...member,
              baby_id: currentBaby.id,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'id' }
          );
        
        if (error) throw error;
      }
      
      setSyncStatus('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert({
        title: 'Synced!',
        message: 'Your family data is now in sync',
        type: 'success',
        confirmText: 'Great',
      });
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      sweetAlert({
        title: 'Sync Failed',
        message: 'Could not sync data. Please try again.',
        type: 'error',
        confirmText: 'OK',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [currentBaby?.id, familyMembers, sweetAlert]);

  const handleBiometricToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (!hasBiometric) {
        sweetAlert({
          title: 'Biometric Not Available',
          message: 'Please set up biometric authentication in your device settings first.',
          type: 'warning',
          confirmText: 'OK',
        });
        return;
      }
      navigation.navigate('BiometricSetup');
    } else {
      const confirmed = await sweetAlert.confirm({
        title: 'Disable Biometric?',
        message: 'Are you sure you want to disable biometric authentication?',
        confirmText: 'Disable',
        cancelText: 'Cancel',
        destructive: true,
      });
      if (confirmed) {
        const success = await toggleBiometric(false);
        if (!success) {
          sweetAlert.error('Error', 'Could not disable biometric authentication.');
        }
      }
    }
  }, [hasBiometric, navigation, sweetAlert, toggleBiometric]);

  const handlePinSetup = useCallback(() => {
    navigation.navigate('SecurityCenter', { mode: 'setup' });
  }, [navigation]);

  const handleLockNow = useCallback(async () => {
    const hasAnySecurity = availableMethods.hasPin || availableMethods.hasBiometric || securitySettings.isAppLockEnabled;
    if (!hasAnySecurity) {
      const confirmed = await sweetAlert.confirm({
        title: 'No Security Enabled',
        message: 'You can lock the app without protection, or set up PIN / Biometric first.',
        confirmText: 'Lock Anyway',
        cancelText: 'Set Up Security',
      });
      if (confirmed) {
        await lockApp(true);
        sweetAlert.toast('App Locked', 'Locked without security. Tap unlock to enter.', 'warning');
      } else {
        navigation.navigate('SecurityCenter', { mode: 'setup' });
      }
      return;
    }
    await lockApp();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [availableMethods, securitySettings.isAppLockEnabled, lockApp, sweetAlert, navigation]);

  const handleSelectTimeout = useCallback(async (minutes: number) => {
    setShowTimeoutModal(false);
    try {
      await updateAutoLockTimeout(minutes);
      sweetAlert.toast('Timeout Updated', `Auto-lock set to ${formatTimeout(minutes)}`, 'success');
    } catch (err) {
      sweetAlert.error('Update Failed', 'Could not update auto-lock timeout.');
    }
  }, [updateAutoLockTimeout, sweetAlert]);

  const handleLogout = useCallback(async () => {
    const confirmed = await sweetAlert.confirm({
      title: 'Logout',
      message: 'Are you sure you want to sign out? You will need to sign in again to access your data.',
      confirmText: 'Logout',
      cancelText: 'Stay',
      destructive: true,
    });
    if (confirmed) {
      // Sign out from Supabase
      await supabase.auth.signOut();
      signOut();
    }
  }, [signOut, sweetAlert]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out LittleLoom - the best baby tracking app! 🍼\n\nI've been tracking ${currentBaby?.name || 'my baby'}'s milestones and activities. Join me!`,
        title: 'LittleLoom Baby Tracker',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [currentBaby]);

  // ─── Timeout Helpers ──────────────────────────────────────────

  const formatTimeout = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, []);

  // ─── Scroll Handler ────────────────────────────────────────────

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ─── Render Sections ───────────────────────────────────────────

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
              onPress={() => setShowTimeoutModal(true)}
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
  }, [
    expandedSections,
    securitySettings,
    biometricTypeName,
    hasBiometric,
    primary,
    secondary,
    accent,
    isDark,
    toggleSection,
    handleBiometricToggle,
    handlePinSetup,
    toggleAppLock,
    formatTimeout,
    handleLockNow,
  ]);

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
              subtitle="Generate an invite code for family members"
              onPress={() => navigation.navigate('CoParentInviteScreen')}
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
            />
            <MenuItem
              icon="cloud-upload"
              title="Sync with Cloud"
              subtitle={isConnected ? 'Connected to Supabase' : 'Offline mode'}
              onPress={handleSync}
              color="#3b82f6"
              isDark={isDark}
              loading={isSyncing}
              value={syncStatus === 'success' ? '✓ Synced' : syncStatus === 'error' ? '✗ Failed' : undefined}
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, guardians, secondary, accent, isDark, toggleSection, navigation, isConnected, isSyncing, syncStatus, handleSync]);

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

  // ─── Loading State ─────────────────────────────────────────────

  const isInitialLoading = authLoading || (babyLoading && safeBabies.length === 0);

  if (isInitialLoading) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <SkeletonLoader isDark={isDark} />
      </LinearGradient>
    );
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ─── Sync Status Indicator ──────────────────────────────── */}
      {isSyncing && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.syncStatusBar}>
          <BlurView intensity={isDark ? 40 : 80} style={styles.syncStatusContent} tint={isDark ? 'dark' : 'light'}>
            <UniversalSpinner size={16} color={primary} variant="liquid" section="settings" />
            <Text style={[styles.syncStatusText, { color: isDark ? '#fff' : '#1a1a1a' }]}>
              Syncing with cloud...
            </Text>
          </BlurView>
        </Animated.View>
      )}

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primary}
            colors={[primary]}
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ─── Header ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>
            Settings
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            Manage your account, family, and preferences
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleShare}
              style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
            >
              <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSync}
              style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              disabled={isSyncing}
            >
              <Ionicons 
                name={syncStatus === 'success' ? 'checkmark' : isSyncing ? 'refresh' : 'cloud-outline'} 
                size={20} 
                color={syncStatus === 'success' ? '#10b981' : isDark ? '#fff' : '#1a1a1a'} 
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── Sections ──────────────────────────────────────────── */}
        {renderSecuritySection()}
        {renderPreferencesSection()}
        {renderFamilySection()}
        {renderTrackingSection()}
        {renderSafetySection()}
        {renderSupportSection()}

        {/* ─── App Info ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.appInfo}>
          <View style={styles.appLogoFloatWrap}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.appLogoImage}
              resizeMode="contain"
            />
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
          {isConnected && (
            <View style={[styles.onlineBadge, { backgroundColor: `${accent}15` }]}>
              <View style={[styles.onlineDot, { backgroundColor: accent }]} />
              <Text style={[styles.onlineText, { color: accent }]}>Connected to Supabase</Text>
            </View>
          )}
        </Animated.View>

        {/* ─── Logout ────────────────────────────────────────────── */}
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

      {/* ─── Timeout Modal ──────────────────────────────────────── */}
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
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },

  textLight: { color: '#ffffff' },
  textMuted: { color: '#888' },

  // ─── Header ────────────────────────────────────────────────────
  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    width: '100%',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Section ──────────────────────────────────────────────────
  section: { marginBottom: 4 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 2,
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
  sectionHeaderDark: {},

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

  // ─── App Info ──────────────────────────────────────────────────
  appInfo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    gap: 10,
  },
  appLogoFloatWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appLogoImage: {
    width: 120,
    height: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 14,
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
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Logout ────────────────────────────────────────────────────
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

  // ─── Sync Status ──────────────────────────────────────────────
  syncStatusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
  },
  syncStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  syncStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Timeout Modal ────────────────────────────────────────────
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
  activeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Skeleton ──────────────────────────────────────────────────
  skeletonContainer: {
    padding: 20,
    gap: 12,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  skeletonText: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
});

export default React.memo(MoreScreen);