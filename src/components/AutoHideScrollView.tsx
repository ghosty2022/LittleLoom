// src/components/AutoHideScrollView.tsx
import React from 'react';
import {
  ScrollView,
  ScrollViewProps,
  FlatList,
  FlatListProps,
  SectionList,
  SectionListProps,
} from 'react-native';
import { useTrackedScroll } from '../utils/GlobalScrollPatch';

// Typed wrapper for ScrollView
export const AutoHideScrollView = React.forwardRef<<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const trackedScroll = useTrackedScroll(props.onScroll);

    return (
      <ScrollView
        ref={ref}
        {...props}
        onScroll={trackedScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// Typed wrapper for FlatList
export function AutoHideFlatList<T>(props: FlatListProps<T>) {
  const trackedScroll = useTrackedScroll(props.onScroll);

  return (
    <FlatList
      {...props}
      onScroll={trackedScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// Typed wrapper for SectionList
export function AutoHideSectionList<T, SectionT>(props: SectionListProps<T, SectionT>) {
  const trackedScroll = useTrackedScroll(props.onScroll);

  return (
    <SectionList
      {...props}
      onScroll={trackedScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}