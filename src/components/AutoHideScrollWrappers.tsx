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
AutoHideScrollView.displayName = 'AutoHideScrollView';

// ─── AutoHideAnimatedScrollView ──────────────────────────────────────
export const AutoHideAnimatedScrollView = forwardRef<any, ScrollViewProps & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return (
      <Reanimated.ScrollView
        ref={ref}
        {...props}
        onScroll={trackedOnScroll}
        scrollEventThrottle={16}
      />
    );
  }
);
AutoHideAnimatedScrollView.displayName = 'AutoHideAnimatedScrollView';

// For animated scroll views that need nav tracking with worklets, use this pattern in your screen:
// const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { ... } });
// Then manually call: const smartNav = useSmartNavVisibility(); smartNav.onScroll({ nativeEvent: e } as any);

// ─── AutoHideFlatList ─────────────────────────────────────────────────
export const AutoHideFlatList = forwardRef<FlatList<any>, FlatListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <FlatList ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);
AutoHideFlatList.displayName = 'AutoHideFlatList';

// ─── AutoHideAnimatedFlatList ────────────────────────────────────────
export const AutoHideAnimatedFlatList = forwardRef<any, FlatListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <Reanimated.FlatList ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);
AutoHideAnimatedFlatList.displayName = 'AutoHideAnimatedFlatList';

// ─── AutoHideSectionList ────────────────────────────────────────────
export const AutoHideSectionList = forwardRef<SectionList<any>, SectionListProps<any> & { enableNavHiding?: boolean }>(
  ({ onScroll, enableNavHiding = true, ...props }, ref) => {
    const trackedOnScroll = useNavScrollTracking(onScroll, enableNavHiding);
    return <SectionList ref={ref} {...props} onScroll={trackedOnScroll} scrollEventThrottle={16} />;
  }
);
AutoHideSectionList.displayName = 'AutoHideSectionList';

export default AutoHideScrollView;
