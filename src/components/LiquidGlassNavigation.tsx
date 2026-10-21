import React, { useCallback, useEffect, memo, useRef } from 'react';
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
import { useTheme } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouteBasedNavVisibility } from '../hooks/useRouteBasedNavVisibility';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
};

/* ═══════════════════════════════════════════════════════════════════════════
   GEOMETRY
   ═══════════════════════════════════════════════════════════════════════════ */
const PILL_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PILL_HEIGHT = 60;
const PILL_INNER_PAD = 4;
const SEGMENT_WIDTH = (PILL_WIDTH - PILL_INNER_PAD * 2) / 5;
const BOTTOM_MARGIN = 10;
const HIDDEN_TRANSLATE_Y = 120;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const icons = {
  Home: (props: any) => <Ionicons name="home-outline" size={20} {...props} />,
  HomeActive: (props: any) => <Ionicons name="home" size={20} {...props} />,
  Track: (props: any) => <Ionicons name="flash-outline" size={20} {...props} />,
  TrackActive: (props: any) => <Ionicons name="flash" size={20} {...props} />,
  Timeline: (props: any) => <Ionicons name="albums-outline" size={20} {...props} />,
  TimelineActive: (props: any) => <Ionicons name="albums" size={20} {...props} />,
  Grow: (props: any) => <Ionicons name="trending-up-outline" size={20} {...props} />,
  GrowActive: (props: any) => <Ionicons name="trending-up" size={20} {...props} />,
  Connect: (props: any) => <Ionicons name="planet-outline" size={20} {...props} />,
  ConnectActive: (props: any) => <Ionicons name="planet" size={20} {...props} />,
  AddLog: (props: any) => <Ionicons name="add" size={18} {...props} />,
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAB CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const TABS = [
  { name: 'Home', route: 'Home', color: '#6366f1', haptic: Haptics.ImpactFeedbackStyle.Light, Icon: icons.Home, IconActive: icons.HomeActive },
  { name: 'Track', route: 'Track', color: '#10b981', haptic: Haptics.ImpactFeedbackStyle.Medium, Icon: icons.Track, IconActive: icons.TrackActive },
  { name: 'Timeline', route: 'Timeline', color: '#8b5cf6', haptic: Haptics.ImpactFeedbackStyle.Light, Icon: icons.Timeline, IconActive: icons.TimelineActive },
  { name: 'Grow', route: 'Grow', color: '#ec4899', haptic: Haptics.ImpactFeedbackStyle.Medium, Icon: icons.Grow, IconActive: icons.GrowActive },
  { name: 'Connect', route: 'Connect', color: '#f59e0b', haptic: Haptics.ImpactFeedbackStyle.Light, Icon: icons.Connect, IconActive: icons.ConnectActive },
];

/* ═══════════════════════════════════════════════════════════════════════════
   DATE
   ═══════════════════════════════════════════════════════════════════════════ */
const DateDisplay = memo(({ isDark }: { isDark: boolean }) => {
  const [dateStr, setDateStr] = React.useState('');
  useEffect(() => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setDateStr(`${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`);
  }, []);
  return (
    <Text style={[styles.dateText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>
      {dateStr}
    </Text>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */
const TabButton = memo(({ tab, isActive, onPress, isDark }: {
  tab: typeof TABS[0];
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
}) => {
  const iconScale = useSharedValue(1);
  const labelOpacity = useSharedValue(0.4);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);

  useEffect(() => {
    iconScale.value = withSpring(isActive ? 1.1 : 1, { damping: 18, stiffness: 550, mass: 0.25 });
    labelOpacity.value = withTiming(isActive ? 1 : 0.4, { duration: 220 });
    glowOpacity.value = withTiming(isActive ? 1 : 0, { duration: 260 });
    glowScale.value = withSpring(isActive ? 1 : 0.8, { damping: 20, stiffness: 400, mass: 0.3 });
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value, transform: [{ scale: glowScale.value }] }));

  const inactiveColor = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';
  const activeLabelColor = isDark ? DS.white : '#1e293b';
  const IconComponent = isActive ? tab.IconActive : tab.Icon;

  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      android_ripple={{ color: `${tab.color}15`, borderless: true, radius: 30 }}
    >
      <Animated.View style={[styles.glowRing, glowStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${tab.color}30`, `${tab.color}08`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <IconComponent color={isActive ? tab.color : inactiveColor} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tabLabel,
          { color: isActive ? activeLabelColor : inactiveColor },
          isActive && styles.activeLabel,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {tab.name}
      </Animated.Text>

      {isActive && <View style={[styles.activeDot, { backgroundColor: tab.color }]} />}
    </Pressable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVE COLOR WASH
   ═══════════════════════════════════════════════════════════════════════════ */
const ActiveColorWash = memo(({ activeIndex, isDark }: { activeIndex: number; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * SEGMENT_WIDTH, { damping: 25, stiffness: 400, mass: 0.6 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [activeIndex]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0, isDark ? 0.14 : 0.09], Extrapolation.CLAMP),
    transform: [{ translateX: translateX.value }],
  }));

  const activeTab = TABS[activeIndex];
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: PILL_INNER_PAD,
          top: PILL_INNER_PAD,
          width: SEGMENT_WIDTH,
          height: PILL_HEIGHT - PILL_INNER_PAD * 2,
          borderRadius: (PILL_HEIGHT - PILL_INNER_PAD * 2) / 2,
        },
        washStyle,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[`${activeTab.color}28`, `${activeTab.color}05`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SLIDING INDICATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const SlidingIndicator = memo(({ activeIndex, isDark }: { activeIndex: number; isDark: boolean }) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * SEGMENT_WIDTH, { damping: 26, stiffness: 450, mass: 0.55 });
  }, [activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <Animated.View
      style={[
        styles.slidingIndicator,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        },
        indicatorStyle,
      ]}
      pointerEvents="none"
    />
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const activeIndex = state.index;
  const activeRouteName = state.routes[activeIndex]?.name;
  const { isVisible, isFullyHidden } = useRouteBasedNavVisibility();

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const pillScale = useSharedValue(1);

  const visibilityRef = useRef(false);

  useEffect(() => {
    if (visibilityRef.current === isFullyHidden) return;
    visibilityRef.current = isFullyHidden;

    if (isFullyHidden) {
      translateY.value = withTiming(HIDDEN_TRANSLATE_Y, { duration: 250, easing: Easing.out(Easing.ease) });
      opacity.value = withTiming(0, { duration: 200 });
      pillScale.value = withTiming(0.92, { duration: 250 });
    } else {
      translateY.value = withSpring(0, { damping: 25, stiffness: 500, mass: 0.4 });
      opacity.value = withTiming(1, { duration: 200 });
      pillScale.value = withSpring(1, { damping: 25, stiffness: 500, mass: 0.4 });
    }
  }, [isFullyHidden]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: pillScale.value }],
    opacity: opacity.value,
  }));

  const handlePress = useCallback((route: string, tab: typeof TABS[0]) => {
    Haptics.impactAsync(tab.haptic).catch(() => {});
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes.find((r) => r.name === route)?.key || route,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigation.navigate(route as never);
  }, [navigation, state.routes]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate('AddEntry' as never);
  }, [navigation]);

  const pillBackground = isDark ? 'rgba(18,18,24,0.92)' : 'rgba(255,255,255,0.94)';
  const pillBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View
      style={[styles.outerWrapper, { paddingBottom: Math.max(insets.bottom, 6) + BOTTOM_MARGIN }]}
      pointerEvents="box-none"
    >
      {/* ─── ADD LOG FAB ─── */}
      {activeRouteName === 'Track' && isVisible && (
        <TouchableOpacity
          style={styles.addLogFab}
          onPress={handleAddLog}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add new log"
        >
          <View
            style={[
              styles.addLogContainer,
              {
                backgroundColor: isDark ? 'rgba(18,18,24,0.88)' : 'rgba(255,255,255,0.94)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <BlurView intensity={isDark ? 40 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
            <LinearGradient
              colors={isDark
                ? ['rgba(16,185,129,0.18)', 'rgba(16,185,129,0.06)']
                : ['rgba(16,185,129,0.10)', 'rgba(16,185,129,0.03)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.addLogContent}>
              <View style={styles.addLogIconRing}>
                <LinearGradient
                  colors={['#10b981', '#34d399']}
                  style={styles.addLogIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <icons.AddLog color={DS.white} />
                </LinearGradient>
              </View>
              <View style={styles.addLogTextContainer}>
                <Text style={[styles.addLogLabel, { color: isDark ? DS.white : '#1e293b' }]}>Log</Text>
                <DateDisplay isDark={isDark} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ─── MAIN PILL NAV (clean, no aura halo) ─── */}
      <Animated.View style={[styles.container, containerStyle]}>
        <View style={[styles.pillContainer, { backgroundColor: pillBackground, borderColor: pillBorderColor }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 80}
            style={StyleSheet.absoluteFill}
            tint={isDark ? 'dark' : 'light'}
          />

          <SlidingIndicator activeIndex={activeIndex} isDark={isDark} />
          <ActiveColorWash activeIndex={activeIndex} isDark={isDark} />

          {/* Inner top highlight — gives the pill its inner "glass edge" */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'transparent']
                : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.30)', 'transparent']
            }
            style={styles.topHighlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />

          {/* Inner bottom shade — subtle depth edge inside the pill */}
          <LinearGradient
            colors={
              isDark
                ? ['transparent', 'rgba(0,0,0,0.10)']
                : ['transparent', 'rgba(0,0,0,0.02)']
            }
            style={styles.bottomShade}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />

          {/* Hairline border */}
          <View style={[styles.pillBorder, { borderColor: pillBorderColor }]} pointerEvents="none" />

          <View style={styles.tabsContainer}>
            {TABS.map((tab, index) => (
              <TabButton
                key={tab.name}
                tab={tab}
                isActive={index === activeIndex}
                onPress={() => handlePress(tab.route, tab)}
                isDark={isDark}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 999,
  } as ViewStyle,

  container: {
    alignItems: 'center',
    width: '100%',
  } as ViewStyle,

  pillContainer: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    /* No shadows, no outer aura — the pill is fully self-contained */
  } as ViewStyle,

  pillBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 3,
  } as ViewStyle,

  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 1,
  } as ViewStyle,

  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
    zIndex: 1,
  } as ViewStyle,

  slidingIndicator: {
    position: 'absolute',
    top: PILL_INNER_PAD,
    left: PILL_INNER_PAD,
    width: SEGMENT_WIDTH,
    height: PILL_HEIGHT - PILL_INNER_PAD * 2,
    borderRadius: (PILL_HEIGHT - PILL_INNER_PAD * 2) / 2,
    borderWidth: 1,
    zIndex: 0,
  } as ViewStyle,

  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: PILL_INNER_PAD,
    paddingVertical: PILL_INNER_PAD,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 2,
  } as ViewStyle,

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
    height: '100%',
    borderRadius: 12,
  } as ViewStyle,

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  glowRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -26,
    borderRadius: 22,
    zIndex: 0,
    overflow: 'hidden',
  } as ViewStyle,

  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 12,
    marginTop: 2,
  } as TextStyle,

  activeLabel: {
    fontWeight: '800',
  } as TextStyle,

  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  } as ViewStyle,

  /* Add Log FAB */
  addLogFab: {
    position: 'absolute',
    right: 16,
    bottom: PILL_HEIGHT + 16,
    zIndex: 1000,
  } as ViewStyle,

  addLogContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    minWidth: 96,
    minHeight: 44,
  } as ViewStyle,

  addLogContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,

  addLogIconRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  } as ViewStyle,

  addLogIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  addLogTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  } as ViewStyle,

  addLogLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 15,
  } as TextStyle,

  dateText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
    lineHeight: 12,
    marginTop: 0.5,
  } as TextStyle,
});

export default LiquidGlassNavigation;