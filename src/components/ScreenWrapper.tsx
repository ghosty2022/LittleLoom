// src/components/ScreenWrapper.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSmartNavVisibility, SmartNavState } from '../hooks/useSmartNavVisibility';
import { useTheme } from '../context/AppContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  forceHideTabBar?: boolean;
  extraBottomPadding?: number;
  /** Enable smart nav hiding on this screen (default: true) */
  enableNavHiding?: boolean;
  /** Custom hide config for this screen */
  navConfig?: Parameters<typeof useSmartNavVisibility>[0];
}

const DOCK_HEIGHT = 72;
const SAFE_BOTTOM = 8;

// Full-screen routes where nav should NEVER show
const FULL_SCREEN_ROUTES = new Set([
  'CommunitySplash', 'CommunityOnboarding', 'CreatePost', 'CommunityProfile',
  'Report', 'PostDetail', 'Chat', 'ChatList', 'Notifications', 'Topic',
  'CommunityMemberProfile', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'TopicMembers', 'SecurityLock', 'BiometricSetup',
  'AddEntry', 'SwitchBaby',
]);

// Routes where nav hiding is disabled (always visible)
const ALWAYS_VISIBLE_ROUTES = new Set([
  'Home', 'Track', 'Grow', 'More',
]);

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  scrollable = true,
  refreshControl,
  contentContainerStyle,
  style,
  onScroll,
  scrollEventThrottle = 16,
  forceHideTabBar = false,
  extraBottomPadding = 0,
  enableNavHiding = true,
  navConfig,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  // Get current route name efficiently
  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isFullScreen = FULL_SCREEN_ROUTES.has(routeName) || forceHideTabBar;
  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  // Smart nav visibility with direct state
  const smartNav = useSmartNavVisibility(navConfig);
  const [navState, setNavState] = useState<SmartNavState>({
    isVisible: true,
    isFullyHidden: false,
    progress: 1,
  });

  // Subscribe to nav state changes
  useEffect(() => {
    const unsub = smartNav.subscribe((state) => {
      setNavState(state);
    });
    return unsub;
  }, [smartNav]);

  // Reset nav on mount/unmount
  useEffect(() => {
    if (isFullScreen) {
      smartNav.forceHide();
    } else if (isAlwaysVisible || !enableNavHiding) {
      smartNav.forceShow();
    } else {
      smartNav.reset();
    }
    return () => {
      smartNav.forceShow(); // Always restore on unmount
    };
  }, [routeName, isFullScreen, isAlwaysVisible, enableNavHiding, smartNav]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isFullScreen && !isAlwaysVisible && enableNavHiding) {
        smartNav.onScroll(event);
      }
      onScroll?.(event);
    },
    [smartNav, onScroll, isFullScreen, isAlwaysVisible, enableNavHiding]
  );

  // Compute bottom padding based on nav state
  const bottomPadding = isFullScreen
    ? Math.max(insets.bottom, 0) + extraBottomPadding
    : isAlwaysVisible || !enableNavHiding
      ? Math.max(insets.bottom, SAFE_BOTTOM) + DOCK_HEIGHT + extraBottomPadding
      : Math.max(insets.bottom, SAFE_BOTTOM) + (navState.isVisible ? DOCK_HEIGHT : SAFE_BOTTOM) + extraBottomPadding;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: bottomPadding },
        style,
      ]}
    >
      {children}
    </View>
  );
};

// Animated variant for screens with Reanimated scroll
export const AnimatedScreenWrapper: React.FC<ScreenWrapperProps> = (props) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scrollY = useSharedValue(0);
  
  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isFullScreen = FULL_SCREEN_ROUTES.has(routeName) || props.forceHideTabBar;
  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  const smartNav = useSmartNavVisibility(props.navConfig);
  const [navState, setNavState] = useState<SmartNavState>({
    isVisible: true,
    isFullyHidden: false,
    progress: 1,
  });

  useEffect(() => {
    const unsub = smartNav.subscribe(setNavState);
    return unsub;
  }, [smartNav]);

  useEffect(() => {
    if (isFullScreen) smartNav.forceHide();
    else if (isAlwaysVisible) smartNav.forceShow();
    return () => { smartNav.forceShow(); };
  }, [routeName, isFullScreen, isAlwaysVisible, smartNav]);

  const scrollHandler = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isFullScreen && !isAlwaysVisible && props.enableNavHiding !== false) {
      smartNav.onScroll(event);
    }
    props.onScroll?.(event);
  }, [smartNav, props.onScroll, isFullScreen, isAlwaysVisible, props.enableNavHiding]);

  const bottomPadding = isFullScreen
    ? Math.max(insets.bottom, 0) + (props.extraBottomPadding || 0)
    : Math.max(insets.bottom, SAFE_BOTTOM) + (navState.isVisible ? DOCK_HEIGHT : SAFE_BOTTOM) + (props.extraBottomPadding || 0);

  return (
    <Animated.ScrollView
      style={[styles.container, { backgroundColor: colors.background }, props.style]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: bottomPadding },
        props.contentContainerStyle,
      ]}
      onScroll={scrollHandler}
      scrollEventThrottle={props.scrollEventThrottle || 16}
      refreshControl={props.refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {props.children}
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default ScreenWrapper;