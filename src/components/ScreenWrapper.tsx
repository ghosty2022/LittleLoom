import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationVisibility, useTheme } from '../context/AppContext';
import { useNavigationState } from '@react-navigation/native';

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

// ─── FIX #1: Module-level Set, not recreated per render ───────────────
const FULL_SCREEN_ROUTES = new Set([
  'CommunitySplash', 'CommunityOnboarding', 'CreatePost', 'CommunityProfile',
  'Report', 'PostDetail', 'Chat', 'ChatList', 'Notifications', 'Topic',
  'CommunityMemberProfile', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'TopicMembers',
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
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { handleScroll, isCommunityScreen } = useNavigationVisibility();

  // ─── FIX #2: Single navigation state read, no nested traversal ─────
  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  // ─── FIX #3: Direct boolean, no useMemo overhead for simple check ────
  const isFullScreen = forceHideTabBar || FULL_SCREEN_ROUTES.has(routeName) || isCommunityScreen;

  // ─── FIX #4: Single ref object instead of 5 separate refs ────────────
  const scrollRef = useRef({
    lastY: 0,
    lastTime: Date.now(),
    accumulated: 0,
    direction: 'up' as 'up' | 'down',
  });

  // ─── FIX #5: Reset refs when route changes (was useEffect + useEffect) ─
  useEffect(() => {
    const s = scrollRef.current;
    s.lastY = 0;
    s.lastTime = Date.now();
    s.accumulated = 0;
    s.direction = 'up';
  }, [isFullScreen, routeName]);

  const handleScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentY = contentOffset.y;
      const now = Date.now();
      const deltaY = currentY - scrollRef.current.lastY;
      const isAtTop = currentY <= 2;
      const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;

      // Update direction
      if (Math.abs(deltaY) > 0.5) {
        scrollRef.current.direction = deltaY > 0 ? 'down' : 'up';
      }

      // Accumulate delta in current direction
      const s = scrollRef.current;
      if (s.direction === 'down' && deltaY > 0) {
        s.accumulated += deltaY;
      } else if (s.direction === 'up' && deltaY < 0) {
        s.accumulated += Math.abs(deltaY);
      } else {
        s.accumulated = Math.abs(deltaY);
      }

      const deltaTime = now - s.lastTime;
      const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;

      if (!isFullScreen) {
        if (isAtTop || isAtBottom) {
          handleScroll(currentY, velocity, true);
          s.accumulated = 0;
        } else if (s.direction === 'down' && s.accumulated > 60) {
          handleScroll(currentY, velocity, false);
          s.accumulated = 0;
        } else if (s.direction === 'up' && s.accumulated > 20) {
          handleScroll(currentY, velocity, true);
          s.accumulated = 0;
        }
      }

      s.lastY = currentY;
      s.lastTime = now;

      onScroll?.(event);
    },
    [handleScroll, isFullScreen, onScroll]
  );

  // ─── FIX #6: Direct computation, no useMemo for simple math ──────────
  const bottomPadding = isFullScreen
    ? Math.max(insets.bottom, 0) + extraBottomPadding
    : Math.max(insets.bottom, 8) + DOCK_HEIGHT + extraBottomPadding;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        onScroll={handleScrollEvent}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});