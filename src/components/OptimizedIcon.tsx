import React, { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AntDesign from '@expo/vector-icons/AntDesign';
import { TextStyle } from 'react-native';

type IconSet = 'Ionicons' | 'MaterialIcons' | 'MaterialCommunityIcons' | 'Feather' | 'FontAwesome' | 'AntDesign';

interface OptimizedIconProps {
  set?: IconSet;
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

// ─── FIX #1: Module-level lookup table, no object allocation per render ─
const ICON_COMPONENTS: Record<IconSet, React.ComponentType<any>> = {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  AntDesign,
};

// ─── FIX #2: Pre-computed fallback, no warn in production ──────────────
const FALLBACK_ICON = Ionicons;
const FALLBACK_NAME = 'help-circle-outline';

const OptimizedIcon = memo<OptimizedIconProps>(({
  set = 'Ionicons',
  name,
  size = 24,
  color = '#000',
  style,
}) => {
  const IconComponent = ICON_COMPONENTS[set];

  if (!IconComponent) {
    // Only warn in dev, not production
    if (__DEV__) console.warn(`Icon set "${set}" not found, falling back to Ionicons`);
    return <FALLBACK_ICON name={FALLBACK_NAME} size={size} color={color} style={style} />;
  }

  return (
    <IconComponent
      name={name as any}
      size={size}
      color={color}
      style={style}
    />
  );
});

OptimizedIcon.displayName = 'OptimizedIcon';

export default OptimizedIcon;