
// src/components/LiquidGlassNavigation.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  Pressable,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';

import { useCustomization } from '../hooks/useCustomization';
import { useSmartNavVisibility, SmartNavState } from '../hooks/useSmartNavVisibility';
import { useTheme } from '../context/AppContext';
import { HomeIcon, TrackIcon, GrowIcon, ConnectIcon, MoreIcon, AddLogIcon } from './TabIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItem {
  name: string;
  route: string;
  color: string;
  gradient: readonly [string, string];
  hapticStyle: Haptics.ImpactFeedbackStyle;
  Icon: React.FC<any>;
}

const TABS: TabItem[] = [
  {
    name: 'Home',
    route: 'Home',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as const,
    hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    Icon: HomeIcon
  },
  {
    name: 'Track',
    route: 'Track',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'] as const,
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    Icon: TrackIcon
  },
  {
    name: 'Grow',
    route: 'Grow',
    color: '#fa709a',
    gradient: ['#fa709a', '#fee140'] as const,
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    Icon: GrowIcon
  },
  {
    name: 'Connect',
    route: 'Connect',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#f97316'] as const,
    hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    Icon: ConnectIcon
  },
  {
    name: 'More',
    route: 'More',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'] as const,
    hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    Icon: MoreIcon
  },
];

// Routes where the BOTTOM TAB NAV should be completely hidden.
const HIDDEN_ROUTES = new Set([
  'SwitchBaby', 'EditProfile', 'EditGuardian', 'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddLog', 'Achievements', 'Reminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter', 'SecurityLock',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings', 'SafetyCorner',
  'UniversalTracker', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'CreateBabyProfile', 'AddParent',
  'CreatePost', 'Report', 'CommunityProfile',
]);

// Community nested routes that should hide the bottom tab
const HIDDEN_COMMUNITY_ROUTES = new Set([
  'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 'Chat', 'ChatList',
  'Notifications', 'CommunityProfile', 'TopicMembers', 'Followers', 'Following',
  'SearchUsers', 'BlockedUsers', 'Report',
]);

const PILL_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PILL_HEIGHT = 64;
const BOTTOM_MARGIN = 12;
const HIDDEN_TRANSLATE_Y = 140;

// ─── Date Display for Add Log Button ──────────────────────────────────
const DateDisplay: React.FC<{ isDark: boolean }> = React.memo(({ isDark }) => {
  const [dateStr, setDateStr] = React.useState('');

  useEffect(() => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setDateStr(`${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`);
  }, []);

  return (
    <Text style={[
      styles.dateText,
      { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }
    ]}>
      {dateStr}
    </Text>
  );
});

// ─── Tab Button ──────────────────────────────────────────────────────
interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  index: number;
}

const TabButton: React.FC<TabButtonProps> = React.memo(({
  tab, isActive, onPress, isDark, index
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const indicatorScale = useSharedValue(0);
  const labelTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.12 : 1, {
      damping: 18, stiffness: 400, mass: 0.5
    });
    glowOpacity.value = withTiming(isActive ? 0.25 : 0, { duration: 300 });
    indicatorScale.value = withSpring(isActive ? 1 : 0, {
      damping: 20, stiffness: 450, mass: 0.4
    });
    labelTranslateY.value = withSpring(isActive ? -2 : 0, {
      damping: 20, stiffness: 300
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.25], [0.5, 1.6], Extrapolation.CLAMP) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: indicatorScale.value }],
    opacity: interpolate(indicatorScale.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: labelTranslateY.value }],
  }));

  const inactiveColor = isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.4)';
  const activeLabelColor = isDark ? '#f8fafc' : '#1e293b';

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.88, { duration: 50 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [scale]);

  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
    >
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={tab.gradient}
          style={styles.glowDot}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[
        styles.activeIndicator,
        indicatorStyle,
        { backgroundColor: tab.color }
      ]} />

      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <tab.Icon
          size={22}
          color={isActive ? tab.color : inactiveColor}
          active={isActive}
          strokeWidth={isActive ? 2.4 : 1.5}
        />
      </Animated.View>

      <Animated.Text style={[
        styles.tabLabel,
        { color: isActive ? activeLabelColor : inactiveColor },
        isActive && styles.activeLabel,
        labelStyle,
      ]}>
        {tab.name}
      </Animated.Text>
    </Pressable>
  );
});

// ─── Active Color Wash ─────────────────────────────────────────────
const ActiveColorWash: React.FC<{ activeIndex: number; isDark: boolean }> = React.memo(({ activeIndex, isDark }) => {
  const washOpacity = useSharedValue(0);
  const segmentWidth = PILL_WIDTH / TABS.length;
  const left = activeIndex * segmentWidth;

  useEffect(() => {
    washOpacity.value = withTiming(1, { duration: 400 });
  }, [activeIndex]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washOpacity.value, [0, 1], [0, isDark ? 0.06 : 0.04], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top: 0,
          width: segmentWidth,
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
        },
        washStyle,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[...TABS[activeIndex].gradient.map(c => c + '18'), 'transparent'] as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </Animated.View>
  );
});

// ─── MAIN COMPONENT ────────────────────────────────────────────────
const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const customization = useCustomization();

  const activeIndex = state.index;
  const activeRouteName = state.routes[activeIndex]?.name;

  const shouldHideCompletely = useMemo(() => {
    if (activeRouteName && HIDDEN_ROUTES.has(activeRouteName)) return true;

    if (activeRouteName === 'Connect') {
      const connectRoute = state.routes[activeIndex];
      const nestedState = connectRoute?.state as any;
      if (nestedState) {
        const currentNestedRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (currentNestedRoute && HIDDEN_COMMUNITY_ROUTES.has(currentNestedRoute.name)) return true;
      }
    }

    return false;
  }, [activeRouteName, state, activeIndex]);

  const isTrackScreen = activeRouteName === 'Track';

  // Use smartNav WITHOUT haptics — only the tab buttons trigger haptics
  const smartNav = useSmartNavVisibility({ enableHaptics: false });
  const [scrollNavState, setScrollNavState] = useState<SmartNavState>({
    isVisible: true,
    isFullyHidden: false,
    progress: 1,
  });

  useEffect(() => {
    const unsub = smartNav.subscribe((s) => {
      setScrollNavState(s);
    });
    return unsub;
  }, [smartNav]);

  useEffect(() => {
    if (!shouldHideCompletely) {
      smartNav.forceShow();
    }
  }, [shouldHideCompletely, smartNav]);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const pillScale = useSharedValue(1);
  const blurIntensity = useSharedValue(60);

  useEffect(() => {
    if (shouldHideCompletely) {
      translateY.value = withTiming(HIDDEN_TRANSLATE_Y, {
        duration: 350,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
      opacity.value = withTiming(0, { duration: 250 });
      scale.value = withTiming(0.9, { duration: 300 });
      pillScale.value = withTiming(0.94, { duration: 300 });
      blurIntensity.value = withTiming(0, { duration: 200 });
    } else if (scrollNavState.isFullyHidden) {
      translateY.value = withSpring(HIDDEN_TRANSLATE_Y, {
        damping: 24, stiffness: 320, mass: 0.7
      });
      opacity.value = withTiming(0.3, { duration: 300 });
      scale.value = withTiming(0.96, { duration: 300 });
      pillScale.value = withTiming(0.97, { duration: 300 });
      blurIntensity.value = withTiming(25, { duration: 300 });
    } else {
      translateY.value = withSpring(0, {
        damping: 20, stiffness: 300, mass: 0.6
      });
      opacity.value = withTiming(1, { duration: 350 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      pillScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      blurIntensity.value = withTiming(60, { duration: 350 });
    }
  }, [shouldHideCompletely, scrollNavState.isFullyHidden]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blurIntensity.value, [0, 60], [0.2, 1], Extrapolation.CLAMP),
  }));

  const handlePress = useCallback((index: number, route: string, tab: TabItem) => {
    // Only haptic on actual user tap, not programmatic changes
    Haptics.impactAsync(tab.hapticStyle);
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddEntry');
  }, [navigation]);

  if (shouldHideCompletely) {
    return null;
  }

  const pillBackground = isDark
    ? 'rgba(18, 18, 24, 0.94)'
    : 'rgba(255, 255, 255, 0.96)';
  const pillBorder = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.08)';
  const pillBorderTop = isDark
    ? 'rgba(255, 255, 255, 0.15)'
    : 'rgba(255, 255, 255, 0.9)';

  const borderGradientColors = isDark
    ? ['rgba(102,126,234,0.35)', 'rgba(118,75,162,0.25)', 'rgba(240,147,251,0.15)', 'rgba(79,172,254,0.25)']
    : ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.12)', 'rgba(240,147,251,0.08)', 'rgba(79,172,254,0.12)'];

  return (
    <View
      style={[
        styles.outerWrapper,
        { paddingBottom: Math.max(insets.bottom, 8) + BOTTOM_MARGIN }
      ]}
      pointerEvents="box-none"
    >
      {isTrackScreen && (
        <TouchableOpacity
          style={styles.addLogFab}
          onPress={handleAddLog}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add new log"
        >
          <View style={styles.addLogContainer}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
            <LinearGradient
              colors={isDark
                ? ['rgba(17,153,142,0.3)', 'rgba(56,239,125,0.15)']
                : ['rgba(17,153,142,0.15)', 'rgba(56,239,125,0.08)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <LinearGradient
              colors={['rgba(17,153,142,0.6)', 'transparent']}
              style={styles.addLogTopBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.addLogContent}>
              <View style={styles.addLogIconRing}>
                <AddLogIcon size={18} color="#11998e" />
              </View>
              <View style={styles.addLogTextContainer}>
                <Text style={[styles.addLogLabel, { color: isDark ? '#fff' : '#1e293b' }]}>
                  Log
                </Text>
                <DateDisplay isDark={isDark} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        <Animated.View style={[styles.pillContainer, pillStyle, {
          backgroundColor: pillBackground,
          borderColor: pillBorder,
        }]}>
          <LinearGradient
            colors={borderGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientBorderTop, { opacity: 0.7 }]}
          />
          <LinearGradient
            colors={borderGradientColors.slice(0, 2)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.gradientBorderLeft, { opacity: 0.5 }]}
          />
          <LinearGradient
            colors={borderGradientColors.slice(2, 4)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.gradientBorderRight, { opacity: 0.5 }]}
          />

          <View style={[styles.outerBorderTop, { borderColor: pillBorderTop }]} />

          <Animated.View style={[styles.blurBackground, blurStyle]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 80}
              style={StyleSheet.absoluteFill}
              tint={isDark ? 'dark' : 'light'}
            />

            <ActiveColorWash activeIndex={activeIndex} isDark={isDark} />

            <LinearGradient
              colors={[isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)', 'transparent']}
              style={styles.topHighlight}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <View style={[styles.innerBorder, {
              borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
            }]} />

            <View style={styles.tabsContainer}>
              {TABS.map((tab, index) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  isActive={index === activeIndex}
                  onPress={() => handlePress(index, tab.route, tab)}
                  isDark={isDark}
                  index={index}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 999,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  pillContainer: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1.2,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 14,
  } as ViewStyle,

  gradientBorderTop: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    zIndex: 4,
  },
  gradientBorderLeft: {
    position: 'absolute',
    top: 8,
    left: 0,
    width: 2,
    bottom: 8,
    borderRadius: 1,
    zIndex: 4,
  },
  gradientBorderRight: {
    position: 'absolute',
    top: 8,
    right: 0,
    width: 2,
    bottom: 8,
    borderRadius: 1,
    zIndex: 4,
  },

  outerBorderTop: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.2,
    borderTopWidth: 1,
    borderRadius: 1,
    zIndex: 3,
    opacity: 0.8,
  },
  blurBackground: {
    flex: 1,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    zIndex: 1,
  },
  innerBorder: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: (PILL_HEIGHT - 10) / 2,
    borderWidth: 1,
    zIndex: 2,
    pointerEvents: 'none',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 2,
    gap: 2,
  } as ViewStyle,

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    position: 'relative',
    minWidth: 52,
    height: '100%',
    borderRadius: 14,
  } as ViewStyle,
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  glowContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -26,
    borderRadius: 22,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  glowDot: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    opacity: 0.15,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 5,
    width: 18,
    height: 3.5,
    borderRadius: 2,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 0,
    letterSpacing: 0.2,
    lineHeight: 13,
  } as TextStyle,
  activeLabel: {
    fontWeight: '700',
    letterSpacing: 0,
  } as TextStyle,

  addLogFab: {
    position: 'absolute',
    right: 16,
    bottom: PILL_HEIGHT + 20,
    zIndex: 1000,
  },
  addLogContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17, 153, 142, 0.25)',
    shadowColor: '#11998e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 110,
    minHeight: 50,
  },
  addLogTopBorder: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1.5,
    borderRadius: 1,
  },
  addLogContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addLogIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 153, 142, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(17, 153, 142, 0.25)',
  },
  addLogTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  addLogLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 13,
    marginTop: 1,
  },
});

export default LiquidGlassNavigation;
