// src/components/LiquidGlassNavigation.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  withRepeat,
  withDelay,
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
  hapticStyle: Haptics.ImpactFeedbackStyle;
  Icon: React.FC<any>;
}

const TABS: TabItem[] = [
  { name: 'Home', route: 'Home', color: '#667eea', hapticStyle: Haptics.ImpactFeedbackStyle.Light, Icon: HomeIcon },
  { name: 'Track', route: 'Track', color: '#11998e', hapticStyle: Haptics.ImpactFeedbackStyle.Medium, Icon: TrackIcon },
  { name: 'Grow', route: 'Grow', color: '#fa709a', hapticStyle: Haptics.ImpactFeedbackStyle.Medium, Icon: GrowIcon },
  { name: 'Connect', route: 'Connect', color: '#f59e0b', hapticStyle: Haptics.ImpactFeedbackStyle.Light, Icon: ConnectIcon },
  { name: 'More', route: 'More', color: '#64748b', hapticStyle: Haptics.ImpactFeedbackStyle.Light, Icon: MoreIcon },
];

const HIDDEN_ROUTES = new Set([
  'SwitchBaby', 'EditProfile', 'EditGuardian', 'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddLog', 'Achievements', 'Reminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter', 'SecurityLock',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings', 'SafetyCorner',
  'UniversalTracker', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'CreateBabyProfile', 'AddParent',
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 'Chat', 'ChatList',
  'Notifications', 'CommunityProfile', 'TopicMembers', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'Report', 'CommunitySplash', 'CommunityOnboarding',
]);

const PILL_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PILL_HEIGHT = 64;
const BOTTOM_MARGIN = 12;
const HIDDEN_TRANSLATE_Y = 120;

// ─── Tab Button ──────────────────────────────────────────────────────
interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  colors: any;
  customization: ReturnType<typeof useCustomization>;
  index: number;
}

const TabButton: React.FC<TabButtonProps> = React.memo(({ 
  tab, isActive, onPress, isDark, colors, customization, index 
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const indicatorScale = useSharedValue(0);

  const themeColor = useMemo(() => 
    customization.themeColors?.primary || tab.color
  , [customization.themeColors, tab.color]);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.08 : 1, { 
      damping: 20, stiffness: 350, mass: 0.6 
    });
    glowOpacity.value = withTiming(isActive ? 0.15 : 0, { duration: 250 });
    indicatorScale.value = withSpring(isActive ? 1 : 0, { 
      damping: 22, stiffness: 400, mass: 0.5 
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.15], [0.6, 1.4], Extrapolation.CLAMP) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: indicatorScale.value }],
    opacity: interpolate(indicatorScale.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const inactiveColor = isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.45)';
  const activeLabelColor = isDark ? '#f8fafc' : '#1e293b';

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.9, { duration: 60 });
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
        <View style={[styles.glowDot, { backgroundColor: themeColor }]} />
      </Animated.View>

      <Animated.View style={[
        styles.activeIndicator, 
        indicatorStyle, 
        { backgroundColor: themeColor }
      ]} />

      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <tab.Icon 
          size={22} 
          color={isActive ? themeColor : inactiveColor} 
          active={isActive}
          strokeWidth={isActive ? 2.2 : 1.5}
        />
      </Animated.View>

      <Text style={[
        styles.tabLabel,
        { color: isActive ? activeLabelColor : inactiveColor },
        isActive && styles.activeLabel,
      ]}>
        {tab.name}
      </Text>
    </Pressable>
  );
});

// ─── Kinetic Particles ───────────────────────────────────────────────
const KineticParticles: React.FC<{ isDark: boolean; isActive: number }> = React.memo(({ isDark, isActive }) => {
  const particles = useMemo(() => [
    { x: 0.2, y: 0.3, size: 2, delay: 0, duration: 5000 },
    { x: 0.7, y: 0.6, size: 1.5, delay: 1000, duration: 6000 },
    { x: 0.5, y: 0.8, size: 2, delay: 2000, duration: 7000 },
  ], []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <KineticParticle key={i} {...p} isDark={isDark} isActive={isActive} />
      ))}
    </View>
  );
});

const KineticParticle: React.FC<{
  x: number; y: number; size: number; delay: number; duration: number; isDark: boolean; isActive: number;
}> = React.memo(({ x, y, size, delay, duration, isDark }) => {
  const floatY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    floatY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-4, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
    opacity: interpolate(opacity.value, [0, 1], [0, isDark ? 0.12 : 0.08], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * PILL_WIDTH,
          top: y * PILL_HEIGHT,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(102,126,234,0.25)',
        },
        style,
      ]}
    />
  );
});

// ─── Active Color Wash ─────────────────────────────────────────────
const ActiveColorWash: React.FC<{ activeIndex: number; isDark: boolean }> = React.memo(({ activeIndex, isDark }) => {
  const washOpacity = useSharedValue(0);
  const tabColors = ['rgba(102,126,234,', 'rgba(17,153,142,', 'rgba(250,112,154,', 'rgba(245,158,11,', 'rgba(100,116,139,'];

  useEffect(() => {
    washOpacity.value = withTiming(1, { duration: 350 });
  }, [activeIndex]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washOpacity.value, [0, 1], [0, isDark ? 0.05 : 0.04], Extrapolation.CLAMP),
  }));

  const segmentWidth = PILL_WIDTH / TABS.length;
  const left = activeIndex * segmentWidth;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top: 0,
          width: segmentWidth,
          height: PILL_HEIGHT,
          backgroundColor: tabColors[activeIndex] + '1)',
          borderRadius: PILL_HEIGHT / 2,
        },
        washStyle,
      ]}
      pointerEvents="none"
    />
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
    if (activeRouteName && HIDDEN_ROUTES.has(activeRouteName)) {
      return true;
    }
    
    if (activeRouteName === 'Connect') {
      const connectRoute = state.routes[activeIndex];
      const nestedState = connectRoute?.state as any;
      if (nestedState) {
        const currentNestedRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (currentNestedRoute && HIDDEN_ROUTES.has(currentNestedRoute.name)) {
          return true;
        }
      }
    }
    
    return false;
  }, [activeRouteName, state, activeIndex]);

  const isTrackScreen = activeRouteName === 'Track';

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const pillScale = useSharedValue(1);
  const blurIntensity = useSharedValue(60);

  const smartNav = useSmartNavVisibility({
    hideVelocityThreshold: 0.6,
    showVelocityThreshold: 0.4,
    hideDistanceThreshold: 60,
    showDistanceThreshold: 30,
    hideDelay: 200,
    showDelay: 100,
    enableHaptics: true,
  });

  const [scrollNavState, setScrollNavState] = useState<SmartNavState>({
    isVisible: true,
    isFullyHidden: false,
    progress: 1,
  });

  useEffect(() => {
    const unsub = smartNav.subscribe((state) => {
      setScrollNavState(state);
    });
    return unsub;
  }, [smartNav]);

  useEffect(() => {
    if (shouldHideCompletely) {
      translateY.value = withTiming(HIDDEN_TRANSLATE_Y, { 
        duration: 300,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.92, { duration: 280 });
      pillScale.value = withTiming(0.95, { duration: 280 });
      blurIntensity.value = withTiming(0, { duration: 200 });
      return;
    }

    if (scrollNavState.isFullyHidden) {
      translateY.value = withSpring(HIDDEN_TRANSLATE_Y, { 
        damping: 22, stiffness: 280, mass: 0.6 
      });
      opacity.value = withTiming(0.35, { duration: 250 });
      scale.value = withTiming(0.96, { duration: 250 });
      pillScale.value = withTiming(0.98, { duration: 250 });
      blurIntensity.value = withTiming(30, { duration: 250 });
    } else {
      translateY.value = withSpring(0, { 
        damping: 20, stiffness: 300, mass: 0.6 
      });
      opacity.value = withTiming(1, { duration: 280 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      pillScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      blurIntensity.value = withTiming(60, { duration: 300 });
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
    opacity: interpolate(blurIntensity.value, [0, 60], [0.3, 1], Extrapolation.CLAMP),
  }));

  const handlePress = useCallback((index: number, route: string, tab: TabItem) => {
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
    ? 'rgba(18, 18, 24, 0.92)' 
    : 'rgba(255, 255, 255, 0.94)';
  const pillBorder = isDark 
    ? 'rgba(255, 255, 255, 0.08)' 
    : 'rgba(0, 0, 0, 0.06)';
  const pillBorderTop = isDark 
    ? 'rgba(255, 255, 255, 0.12)' 
    : 'rgba(255, 255, 255, 0.8)';

  const gradientColors = isDark
    ? ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.14)', 'rgba(240,147,251,0.08)', 'rgba(79,172,254,0.14)']
    : ['rgba(102,126,234,0.12)', 'rgba(118,75,162,0.08)', 'rgba(240,147,251,0.04)', 'rgba(79,172,254,0.08)'];

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
          <BlurView intensity={50} style={styles.addLogBlur} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark 
                ? ['rgba(40, 40, 48, 0.95)', 'rgba(28, 28, 36, 0.92)'] 
                : ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 252, 0.96)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.addLogInnerRing}>
              <AddLogIcon size={20} color="#11998e" />
            </View>
          </BlurView>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        <Animated.View style={[styles.pillContainer, pillStyle, { 
          backgroundColor: pillBackground,
          borderColor: pillBorder,
        }]}>

          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBorderTop}
          />
          <LinearGradient
            colors={gradientColors.slice(0, 2)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientBorderLeft}
          />
          <LinearGradient
            colors={gradientColors.slice(2, 4)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientBorderRight}
          />

          <View style={[styles.outerBorderTop, { borderColor: pillBorderTop }]} />

          <Animated.View style={[styles.blurBackground, blurStyle]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 80}
              style={StyleSheet.absoluteFill}
              tint={isDark ? 'dark' : 'light'}
            />
            
            <ActiveColorWash activeIndex={activeIndex} isDark={isDark} />
            <KineticParticles isDark={isDark} isActive={activeIndex} />

            <LinearGradient
              colors={[isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)', 'transparent']}
              style={styles.topHighlight}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <View style={[styles.innerBorder, { 
              borderColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'
            }]} />

            <View style={styles.tabsContainer}>
              {TABS.map((tab, index) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  isActive={index === activeIndex}
                  onPress={() => handlePress(index, tab.route, tab)}
                  isDark={isDark}
                  colors={colors}
                  customization={customization}
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
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  } as ViewStyle,

  gradientBorderTop: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1.5,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.5,
  },
  gradientBorderLeft: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: 1.5,
    bottom: 10,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.3,
  },
  gradientBorderRight: {
    position: 'absolute',
    top: 10,
    right: 0,
    width: 1.5,
    bottom: 10,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.3,
  },

  outerBorderTop: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    borderTopWidth: 0.8,
    borderRadius: 1,
    zIndex: 3,
    opacity: 0.6,
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
    height: 20,
    zIndex: 1,
  },
  innerBorder: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: (PILL_HEIGHT - 10) / 2,
    borderWidth: 0.8,
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
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -24,
    borderRadius: 20,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  glowDot: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    opacity: 0.1,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 16,
    height: 3,
    borderRadius: 1.5,
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
    right: 20,
    bottom: PILL_HEIGHT + 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  addLogBlur: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  addLogInnerRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(17, 153, 142, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LiquidGlassNavigation;