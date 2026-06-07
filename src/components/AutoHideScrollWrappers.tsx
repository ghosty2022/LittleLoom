import React from 'react';
import {
  ScrollView,
  ScrollViewProps,
  FlatList,
  FlatListProps,
  SectionList,
  SectionListProps,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useTrackedScroll } from '../hooks/useTrackedScroll';

export const AutoHideScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const onScroll = useTrackedScroll(props.onScroll);

    return (
      <ScrollView
        ref={ref}
        {...props}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export function AutoHideFlatList<T>(props: FlatListProps<T>) {
  const onScroll = useTrackedScroll(props.onScroll);

  return (
    <FlatList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

export function AutoHideSectionList<T, SectionT>(props: SectionListProps<T, SectionT>) {
  const onScroll = useTrackedScroll(props.onScroll);

  return (
    <SectionList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export const AutoHideAnimatedScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const onScroll = useTrackedScroll(props.onScroll);

    return (
      <AnimatedScrollView
        ref={ref}
        {...props}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export default AutoHideScrollView;