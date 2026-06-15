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

const ICON_COMPONENTS: Record<IconSet, any> = {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  AntDesign,
};

/**
 * OptimizedIcon — uses preloaded fonts for instant display
 * 
 * All icon fonts are preloaded in App.tsx during splash screen.
 * This component just renders them — no loading delay.
 * 
 * Usage:
 * <OptimizedIcon set="Ionicons" name="home" size={24} color="#667eea" />
 * <OptimizedIcon set="MaterialIcons" name="arrow-back" size={24} color="#000" />
 */
const OptimizedIcon = memo<OptimizedIconProps>(({
  set = 'Ionicons',
  name,
  size = 24,
  color = '#000',
  style,
}) => {
  const IconComponent = ICON_COMPONENTS[set];

  if (!IconComponent) {
    console.warn(`Icon set "${set}" not found, falling back to Ionicons`);
    return <Ionicons name="help-circle-outline" size={size} color={color} style={style} />;
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