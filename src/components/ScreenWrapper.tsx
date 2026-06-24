// src/components/ScreenWrapper.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
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
  enableNavHiding?: boolean;
}

const DOCK_HEIGHT = 72;
const SAFE_BOTTOM = 8;

// ONLY truly full-screen routes hide the nav completely.
// All other routes (including community screens) should show the tab bar.
const HIDDEN_ROUTES = new Set([
  'SecurityLock', 'BiometricSetup',
  'CommunitySplash', 'CommunityOnboarding',
]);

// Main tabs where nav always stays visible
const ALWAYS_VISIBLE_ROUTES = new Set(['Home', 'Track', 'Grow', 'More']);

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
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isHidden = HIDDEN_ROUTES.has(routeName) || forceHideTabBar;
  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  const smartNav = useSmartNavVisibility();
  const [navState, setNavState] = useState<SmartNavState>({
    isVisible: true,
    isFullyHidden: false,
    progress: 1,
  });

  useEffect(() => {
    const unsub = smartNav.subscribe(setNavState);
    return unsub;
  }, [smartNav]);

  // Route-based nav control
  useEffect(() => {
    if (isHidden) {
      smartNav.forceHide();
    } else if (isAlwaysVisible || !enableNavHiding) {
      smartNav.forceShow();
    } else {
      // Normal scroll-driven behavior: reset to allow scroll hiding
      smartNav.reset();
    }
  }, [routeName, isHidden, isAlwaysVisible, enableNavHiding, smartNav]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isHidden && !isAlwaysVisible && enableNavHiding) {
      smartNav.onScroll(event);
    }
    onScroll?.(event);
  }, [smartNav, onScroll, isHidden, isAlwaysVisible, enableNavHiding]);

  const bottomPadding = isHidden
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: bottomPadding }, style]}>
      {children}
    </View>
  );
};

export const AnimatedScreenWrapper: React.FC<ScreenWrapperProps> = (props) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isHidden = HIDDEN_ROUTES.has(routeName) || props.forceHideTabBar;
  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  const smartNav = useSmartNavVisibility();
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
    if (isHidden) smartNav.forceHide();
    else if (isAlwaysVisible) smartNav.forceShow();
    else smartNav.reset();
  }, [routeName, isHidden, isAlwaysVisible, smartNav]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isHidden && !isAlwaysVisible && props.enableNavHiding !== false) {
      smartNav.onScroll(event);
    }
    props.onScroll?.(event);
  }, [smartNav, props.onScroll, isHidden, isAlwaysVisible, props.enableNavHiding]);

  const bottomPadding = isHidden
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
      onScroll={handleScroll}
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
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
});

export default ScreenWrapper;