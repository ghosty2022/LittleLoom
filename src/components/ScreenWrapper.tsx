import React, { useRef, useCallback, useEffect, useMemo } from 'react';
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
const COMMUNITY_BOTTOM = 0;

const FULL_SCREEN_ROUTES = new Set([
  'CommunitySplash',
  'CommunityOnboarding',
  'CreatePost',
  'CommunityProfile',
  'Report',
  'PostDetail',
  'Chat',
  'ChatList',
  'Notifications',
  'Topic',
  'CommunityMemberProfile',
  'Followers',
  'Following',
  'SearchUsers',
  'BlockedUsers',
  'TopicMembers',
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

  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      const nestedRoute = nested.routes?.[nested.index ?? 0];
      return nestedRoute?.name || route.name;
    }
    return route.name;
  });

  const isFullScreen = useMemo(() => {
    return forceHideTabBar || FULL_SCREEN_ROUTES.has(routeName) || isCommunityScreen;
  }, [forceHideTabBar, routeName, isCommunityScreen]);

  const lastYRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const isAtTopRef = useRef(true);
  const scrollDirectionRef = useRef<'up' | 'down'>('up');
  const accumulatedDeltaRef = useRef(0);
  const hideThreshold = 60;
  const showThreshold = 20;

  const handleScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentY = contentOffset.y;
      const now = Date.now();
      const deltaTime = now - lastTimeRef.current;
      const deltaY = currentY - lastYRef.current;
      const isAtTop = currentY <= 2;
      const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;
      isAtTopRef.current = isAtTop;

      if (Math.abs(deltaY) > 0.5) {
        scrollDirectionRef.current = deltaY > 0 ? 'down' : 'up';
      }

      if (scrollDirectionRef.current === 'down' && deltaY > 0) {
        accumulatedDeltaRef.current += deltaY;
      } else if (scrollDirectionRef.current === 'up' && deltaY < 0) {
        accumulatedDeltaRef.current += Math.abs(deltaY);
      } else {
        accumulatedDeltaRef.current = Math.abs(deltaY);
      }

      const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;

      if (!isFullScreen) {
        if (isAtTop || isAtBottom) {
          handleScroll(currentY, velocity, true);
          accumulatedDeltaRef.current = 0;
        } else if (
          scrollDirectionRef.current === 'down' &&
          accumulatedDeltaRef.current > hideThreshold
        ) {
          handleScroll(currentY, velocity, false);
          accumulatedDeltaRef.current = 0;
        } else if (
          scrollDirectionRef.current === 'up' &&
          accumulatedDeltaRef.current > showThreshold
        ) {
          handleScroll(currentY, velocity, true);
          accumulatedDeltaRef.current = 0;
        }
      }

      lastYRef.current = currentY;
      lastTimeRef.current = now;

      onScroll?.(event);
    },
    [handleScroll, isFullScreen, onScroll]
  );

  useEffect(() => {
    lastYRef.current = 0;
    lastTimeRef.current = Date.now();
    isAtTopRef.current = true;
    accumulatedDeltaRef.current = 0;
    scrollDirectionRef.current = 'up';
  }, [isFullScreen, routeName]);

  const bottomPadding = useMemo(() => {
    if (isFullScreen) {
      return Math.max(insets.bottom, 0) + COMMUNITY_BOTTOM + extraBottomPadding;
    }
    return Math.max(insets.bottom, 8) + DOCK_HEIGHT + extraBottomPadding;
  }, [isFullScreen, insets.bottom, extraBottomPadding]);

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

export default ScreenWrapper;