// src/components/ScreenWrapper.tsx
import React from 'react';
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
}

const DOCK_HEIGHT = 72;
const SAFE_BOTTOM = 8;

// Only Home shows the tab bar persistently
const ALWAYS_VISIBLE_ROUTES = new Set(['Home']);

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
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const routeName = useNavigationState((navState) => {
    if (!navState) return '';
    let route = navState.routes[navState.index];
    while (route.state) {
      const nested = route.state as any;
      route = nested.routes?.[nested.index ?? 0] ?? route;
    }
    return route.name;
  });

  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  // Home gets dock height padding, everything else just safe area
  const bottomPadding = isAlwaysVisible && !forceHideTabBar
    ? Math.max(insets.bottom, SAFE_BOTTOM) + DOCK_HEIGHT + extraBottomPadding
    : Math.max(insets.bottom, SAFE_BOTTOM) + extraBottomPadding;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        onScroll={onScroll}
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

  const routeName = useNavigationState((navState) => {
    if (!navState) return '';
    let route = navState.routes[navState.index];
    while (route.state) {
      const nested = route.state as any;
      route = nested.routes?.[nested.index ?? 0] ?? route;
    }
    return route.name;
  });

  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  const bottomPadding = isAlwaysVisible && !props.forceHideTabBar
    ? Math.max(insets.bottom, SAFE_BOTTOM) + DOCK_HEIGHT + (props.extraBottomPadding || 0)
    : Math.max(insets.bottom, SAFE_BOTTOM) + (props.extraBottomPadding || 0);

  return (
    <Animated.ScrollView
      style={[styles.container, { backgroundColor: colors.background }, props.style]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: bottomPadding },
        props.contentContainerStyle,
      ]}
      onScroll={props.onScroll}
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