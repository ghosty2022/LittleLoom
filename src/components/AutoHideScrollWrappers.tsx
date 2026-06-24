// src/components/AutoHideScrollWrappers.tsx
import React, { forwardRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  FlatList,
  FlatListProps,
  SectionList,
  SectionListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useSmartNavVisibility } from '../hooks/useSmartNavVisibility';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

// ─── Shared scroll tracking hook ─────────────────────────────────────
export const useNavScrollTracking = (
  userOnScroll?: ScrollHandler,
  enabled: boolean = true
): ScrollHandler => {
  const smartNav = useSmartNavVisibility();

  return React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (enabled) {
      smartNav.onScroll(event);
    }
    userOnScroll?.(event);
  }, [smartNav, userOnScroll, enabled]);
};

// ─── AutoHideScrollView ───────────────────────────────────────────────
export const AutoHideScrollView = forwardRef<ScrollView, ScrollViewProps & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <ScrollView ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);

// ─── AutoHideAnimatedScrollView ──────────────────────────────────────
export const AutoHideAnimatedScrollView = forwardRef<ScrollView, ScrollViewProps & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    return (
      <Reanimated.ScrollView
        ref={ref}
        {...props}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />
    );
  }
);

// For animated scroll views that need nav tracking, use this pattern in your screen:
// const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { ... } });
// Then manually call: const smartNav = useSmartNavVisibility(); smartNav.onScroll({ nativeEvent: e } as any);

// ─── AutoHideFlatList ─────────────────────────────────────────────────
export const AutoHideFlatList = forwardRef<FlatList<any>, FlatListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <FlatList ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);

// ─── AutoHideAnimatedFlatList ────────────────────────────────────────
export const AutoHideAnimatedFlatList = forwardRef<FlatList<any>, FlatListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    return <Reanimated.FlatList ref={ref} {...props} onScroll={onScroll} scrollEventThrottle={16} />;
  }
);

// ─── AutoHideSectionList ────────────────────────────────────────────
export const AutoHideSectionList = forwardRef<SectionList<any>, SectionListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <SectionList ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);

export default AutoHideScrollView;