// src/components/LiquidGlassNavigation.tsx
// MODERNIZED: Outline icons, smooth scroll-hide (down only), pill design, unified theming
// FIXED: No sideways movement, respects customization, hides on all non-tab screens

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
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
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

import { useNavigationVisibility, useTheme } from '../context/AppContext';
import { useCustomization } from '../hooks/useCustomization';
import { HomeIcon, TrackIcon, GrowIcon, ConnectIcon, MoreIcon, AddLogIcon } from './TabIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TABS CONFIGURATION
// ============================================

interface TabItem {
  name: string;
  shortName: string;
  route: string;
  color: string;
  hapticStyle: Haptics.ImpactFeedbackStyle;
  description: string;
  Icon: React.FC<any>;
}

const TABS: TabItem[] = [
  { 
    name: 'Home', 
    shortName: 'Home', 
    route: 'Home', 
    color: '#667eea', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Dashboard',
    Icon: HomeIcon,
  },
  { 
    name: 'Track', 
    shortName: 'Track', 
    route: 'Track', 
    color: '#11998e', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium, 
    description: 'Daily Tracking',
    Icon: TrackIcon,
  },
  { 
    name: 'Grow', 
    shortName: 'Grow', 
    route: 'Grow', 
    color: '#fa709a', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium, 
    description: 'Growth & Milestones',
    Icon: GrowIcon,
  },
  { 
    name: 'Connect', 
    shortName: 'Connect', 
    route: 'Connect', 
    color: '#f59e0b', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Community',
    Icon: ConnectIcon,
  },
  { 
    name: 'More', 
    shortName: 'More', 
    route: 'More', 
    color: '#64748b', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Settings',
    Icon: MoreIcon,
  },
];

// ============================================
// ROUTES THAT MUST HIDE THE TAB BAR
// ============================================
// Single source of truth - ONLY these routes show the tab bar
const TAB_VISIBLE_ROUTES = new Set(['Home', 'Track', 'Grow', 'Connect', 'More']);

// All stack screens that push over tabs
const HIDDEN_TAB_ROUTES = new Set([
  'SwitchBaby', 'EditProfile', 'EditGuardian', 'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddLog', 'Achievements', 'GrowthChart', 'Reminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter', 'SecurityLock',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings', 'SafetyCorner',
  'UniversalTracker', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'CreateBabyProfile', 'AddParent',
  // Community screens (nested inside Connect tab)
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'UserProfile', 'Chat', 'ChatList',
  'Notifications', 'EditCommunityProfile', 'TopicMembers', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'Report',
]);

// Dimensions
const PILL_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const PILL_HEIGHT = 64;
const BOTTOM_MARGIN = 16;
const HIDDEN_TRANSLATE_Y = 120;

// ============================================
// TAB BUTTON COMPONENT
// ============================================

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  index: number;
  colors: any;
  customization: ReturnType<typeof useCustomization>;
}

const TabButton: React.FC<TabButtonProps> = ({ 
  tab, isActive, onPress, isDark, index, colors, customization 
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const themeColor = useMemo(() => {
    // Use customization theme color if available, fallback to tab color
    return customization.themeColors?.primary || tab.color;
  }, [customization.themeColors, tab.color]);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.1 : 1, { 
      damping: 15, 
      stiffness: 200,
      mass: 0.8,
    });
    glowOpacity.value = withSpring(isActive ? 1 : 0, { 
      damping: 15, 
      stiffness: 200 
    });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.8, 1.4], Extrapolation.CLAMP) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scaleX: interpolate(glowOpacity.value, [0, 1], [0, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <TouchableOpacity
      style={styles.tabButton}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
    >
      {/* Glow effect behind active tab */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient 
          colors={[themeColor + '30', themeColor + '10', 'transparent']} 
          style={styles.glowGradient} 
        />
      </Animated.View>

      {/* Active indicator dot */}
      <Animated.View 
        style={[
          styles.activeIndicator, 
          indicatorStyle, 
          { backgroundColor: themeColor }
        ]} 
      />

      {/* Icon */}
      <Animated.View style={[animatedStyle, { zIndex: 10 }]}>
        <tab.Icon 
          size={22} 
          color={isActive ? themeColor : isDark ? colors.textSecondary : '#94a3b8'} 
          active={isActive}
          strokeWidth={isActive ? 2.2 : 1.6}
        />
      </Animated.View>

      {/* Label */}
      <Text style={[
        styles.tabLabel,
        isActive && [styles.activeLabel, { color: themeColor }],
        isDark && !isActive && { color: colors.textSecondary },
      ]}>
        {tab.name}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    isNavVisible,
    showNav,
    hideNav,
    isCommunityScreen,
  } = useNavigationVisibility();

  const { isDark, colors } = useTheme();
  const customization = useCustomization();

  const activeIndex = state.index;
  const activeRouteName = state.routes[activeIndex]?.name;

  // Determine if tab bar should be completely hidden
  const shouldHideCompletely = useMemo(() => {
    // If we're on a tab route, check nested state for Connect
    if (activeRouteName === 'Connect') {
      const connectRoute = state.routes[activeIndex];
      
      // Check descriptor.state (React Navigation v6+)
      const connectDescriptor = descriptors[connectRoute?.key];
      if (connectDescriptor?.state) {
        const nestedState = connectDescriptor.state;
        const communityRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (communityRoute && HIDDEN_TAB_ROUTES.has(communityRoute.name)) {
          return true;
        }
      }
      
      // Check route.state (fallback)
      if (connectRoute?.state) {
        const nestedState = connectRoute.state as any;
        const communityRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (communityRoute && HIDDEN_TAB_ROUTES.has(communityRoute.name)) {
          return true;
        }
      }
      
      // Fallback to context flag
      return isCommunityScreen;
    }

    // For non-Connect tabs, check if current route is not a tab route
    if (activeRouteName && !TAB_VISIBLE_ROUTES.has(activeRouteName)) {
      return true;
    }

    return isCommunityScreen;
  }, [activeRouteName, state, descriptors, activeIndex, isCommunityScreen]);

  const isTrackScreen = activeRouteName === 'Track';

  // Animated values - ONLY vertical movement (no sideways)
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Track previous states
  const prevVisible = useRef(true);
  const prevHidden = useRef(false);

  // Update animations
  useEffect(() => {
    // Completely hidden (non-tab screens)
    if (shouldHideCompletely) {
      translateY.value = withSpring(HIDDEN_TRANSLATE_Y, { 
        damping: 25, 
        stiffness: 200,
        mass: 0.8,
      });
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.95, { duration: 200 });
      prevHidden.current = true;
      prevVisible.current = false;
      return;
    }

    // Was previously hidden, now showing
    if (prevHidden.current && !shouldHideCompletely) {
      prevHidden.current = false;
      translateY.value = withSpring(0, { 
        damping: 20, 
        stiffness: 200,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 250 });
      scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    }

    // Normal scroll-based visibility
    if (isNavVisible !== prevVisible.current && !shouldHideCompletely) {
      prevVisible.current = isNavVisible;
      if (isNavVisible) {
        translateY.value = withSpring(0, { 
          damping: 20, 
          stiffness: 200,
          mass: 0.8,
        });
        opacity.value = withTiming(1, { duration: 200 });
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      } else {
        translateY.value = withSpring(HIDDEN_TRANSLATE_Y, { 
          damping: 25, 
          stiffness: 200,
          mass: 0.8,
        });
        opacity.value = withTiming(0.6, { duration: 200 });
        scale.value = withTiming(0.98, { duration: 200 });
      }
    }
  }, [isNavVisible, shouldHideCompletely]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const handlePress = useCallback((index: number, route: string, tab: TabItem) => {
    Haptics.impactAsync(tab.hapticStyle);
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddLog');
  }, [navigation]);

  // ============================================
  // PAN RESPONDER - Only vertical swipe
  // ============================================
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dy } = gestureState;

        if (dy < -30) {
          // Swipe up - show nav
          runOnJS(showNav)();
        } else if (dy > 40) {
          // Swipe down - hide nav
          runOnJS(hideNav)();
        }
      },
    })
  ).current;

  // Don't render at all when completely hidden (performance + no ghost touches)
  if (shouldHideCompletely) {
    return null;
  }

  return (
    <View
      style={[
        styles.outerWrapper, 
        { paddingBottom: Math.max(insets.bottom, 8) + BOTTOM_MARGIN }
      ]}
      {...panResponder.panHandlers}
    >
      {/* Add Log FAB - only on Track screen */}
      {isTrackScreen && (
        <TouchableOpacity 
          style={styles.addLogFab} 
          onPress={handleAddLog}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add new log"
        >
          <BlurView intensity={60} style={styles.addLogBlur} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark 
                ? ['rgba(30,30,30,0.9)', 'rgba(20,20,20,0.8)'] 
                : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <AddLogIcon size={20} color="#11998e" />
          </BlurView>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        <View style={[styles.pillContainer, { 
          backgroundColor: isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.85)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 80}
            style={styles.blurBackground}
            tint={isDark ? 'dark' : 'light'}
          >
            {/* Subtle gradient overlay for depth */}
            <LinearGradient
              colors={isDark
                ? ['rgba(255,255,255,0.03)', 'transparent', 'rgba(255,255,255,0.01)']
                : ['rgba(255,255,255,0.5)', 'transparent', 'rgba(0,0,0,0.02)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            {/* Top highlight line */}
            <View style={[styles.topHighlight, { 
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
            }]} />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {TABS.map((tab, index) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  isActive={index === activeIndex}
                  onPress={() => handlePress(index, tab.route, tab)}
                  isDark={isDark}
                  index={index}
                  colors={colors}
                  customization={customization}
                />
              ))}
            </View>
          </BlurView>
        </View>
      </Animated.View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  container: {
    alignItems: 'center',
  },
  pillContainer: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,
  blurBackground: {
    flex: 1,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    borderRadius: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  } as ViewStyle,
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
    minWidth: 56,
  } as ViewStyle,
  glowContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    zIndex: 0,
  } as ViewStyle,
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  } as ViewStyle,
  activeIndicator: {
    position: 'absolute',
    bottom: 8,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  } as TextStyle,
  activeLabel: {
    fontWeight: '700',
  } as TextStyle,
  addLogFab: {
    position: 'absolute',
    right: 20,
    bottom: PILL_HEIGHT + 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  addLogBlur: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default LiquidGlassNavigation;
