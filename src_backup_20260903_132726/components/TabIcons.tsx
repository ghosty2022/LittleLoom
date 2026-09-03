import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  active?: boolean;
}

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE = 1.6;
const ACTIVE_STROKE = 2.4;

const ACTIVE_COLORS: Record<string, string> = {
  Home: '#667eea',
  Track: '#11998e',
  Grow: '#fa709a',
  Connect: '#f59e0b',
  More: '#64748b',
};

export const HomeIcon: React.FC<IconProps> = ({ 
  size = DEFAULT_SIZE, 
  color = '#667eea', 
  strokeWidth = DEFAULT_STROKE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 9.5l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.08 : 0}
    />
    <Path
      d="M9 22V12h6v10"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 1 : 0.7}
    />
    {/* Subtle dot indicator when active */}
    {active && (
      <Circle cx="12" cy="8" r="1.5" fill={color} opacity={0.6} />
    )}
  </Svg>
);

export const TrackIcon: React.FC<IconProps> = ({ 
  size = DEFAULT_SIZE, 
  color = '#11998e', 
  strokeWidth = DEFAULT_STROKE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle
      cx="12"
      cy="12"
      r="10"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.06 : 0}
    />
    <Polyline
      points="12 6 12 12 16 14"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Progress arc when active */}
    {active && (
      <Path
        d="M12 2a10 10 0 0110 10"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.3}
      />
    )}
  </Svg>
);

export const GrowIcon: React.FC<IconProps> = ({ 
  size = DEFAULT_SIZE, 
  color = '#fa709a', 
  strokeWidth = DEFAULT_STROKE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22c4.97 0 9-4.03 9-9-4.5 0-9 4.5-9 9z"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.1 : 0}
    />
    <Path
      d="M12 22c-4.97 0-9-4.03-9-9 4.5 0 9 4.5 9 9z"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 1 : 0.7}
    />
    <Path
      d="M12 13a3 3 0 100-6 3 3 0 000 6z"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.15 : 0}
    />
    {/* Growth indicator line when active */}
    {active && (
      <Path
        d="M12 2v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.5}
      />
    )}
  </Svg>
);

export const ConnectIcon: React.FC<IconProps> = ({ 
  size = DEFAULT_SIZE, 
  color = '#f59e0b', 
  strokeWidth = DEFAULT_STROKE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
      stroke={color}
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.08 : 0}
    />
    {/* Typing dots when active */}
    {active && (
      <G opacity={0.8}>
        <Circle cx="9" cy="12" r="1" fill={color} />
        <Circle cx="12" cy="12" r="1" fill={color} />
        <Circle cx="15" cy="12" r="1" fill={color} />
      </G>
    )}
    {/* Notification dot */}
    {!active && (
      <Circle cx="19" cy="7" r="2.5" fill={color} opacity={0.15} stroke={color} strokeWidth={0.5} />
    )}
  </Svg>
);

export const MoreIcon: React.FC<IconProps> = ({ 
  size = DEFAULT_SIZE, 
  color = '#64748b', 
  strokeWidth = DEFAULT_STROKE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle 
      cx="12" 
      cy="6" 
      r="2" 
      fill={active ? color : 'none'} 
      stroke={color} 
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth} 
    />
    <Circle 
      cx="12" 
      cy="12" 
      r="2" 
      fill={active ? color : 'none'} 
      stroke={color} 
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth} 
    />
    <Circle 
      cx="12" 
      cy="18" 
      r="2" 
      fill={active ? color : 'none'} 
      stroke={color} 
      strokeWidth={active ? ACTIVE_STROKE : strokeWidth} 
    />
    {/* Connecting lines when active */}
    {active && (
      <G opacity={0.4}>
        <Line x1="12" y1="8" x2="12" y2="10" stroke={color} strokeWidth={1} />
        <Line x1="12" y1="14" x2="12" y2="16" stroke={color} strokeWidth={1} />
      </G>
    )}
  </Svg>
);

export const AddLogIcon: React.FC<IconProps> = ({ 
  size = 22, 
  color = '#11998e', 
  strokeWidth = 2.2 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle 
      cx="12" 
      cy="12" 
      r="10" 
      stroke={color} 
      strokeWidth={strokeWidth} 
      fill={color}
      fillOpacity={0.08}
    />
    <Line 
      x1="12" 
      y1="8" 
      x2="12" 
      y2="16" 
      stroke={color} 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
    />
    <Line 
      x1="8" 
      y1="12" 
      x2="16" 
      y2="12" 
      stroke={color} 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
    />
  </Svg>
);

export const TAB_ICONS: Record<string, React.FC<IconProps>> = {
  Home: HomeIcon,
  Track: TrackIcon,
  Grow: GrowIcon,
  Connect: ConnectIcon,
  More: MoreIcon,
};

export default TAB_ICONS;
