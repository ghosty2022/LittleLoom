/**
 * LittleLoom Custom Icon Library
 * Comprehensive baby-care themed icons with theme support
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';


export type IconCategory = 
  | 'care' 
  | 'health' 
  | 'development' 
  | 'daily' 
  | 'mood' 
  | 'food' 
  | 'sleep' 
  | 'hygiene' 
  | 'medical' 
  | 'social' 
  | 'weather' 
  | 'achievement';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const SIZE_MAP: Record<IconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
};


export const BABY_ICONS = {
  care: {
    potty: { name: 'water-outline', label: 'Potty', color: '#667eea' },
    diaper: { name: 'shirt-outline', label: 'Diaper', color: '#fc5c7d' },
    feed: { name: 'nutrition-outline', label: 'Feed', color: '#fa709a' },
    bottle: { name: 'flask-outline', label: 'Bottle', color: '#3b82f6' },
    breast: { name: 'heart-outline', label: 'Breast', color: '#ec4899' },
    pump: { name: 'flash-outline', label: 'Pump', color: '#f59e0b' },
    sleep: { name: 'moon-outline', label: 'Sleep', color: '#11998e' },
    bath: { name: 'water-outline', label: 'Bath', color: '#06b6d4' },
    brush: { name: 'sparkles-outline', label: 'Brush', color: '#8b5cf6' },
    lotion: { name: 'sunny-outline', label: 'Lotion', color: '#fbbf24' },
    nail: { name: 'cut-outline', label: 'Nails', color: '#94a3b8' },
    hair: { name: 'color-wand-outline', label: 'Hair', color: '#a855f7' },
  },

  health: {
    thermometer: { name: 'thermometer-outline', label: 'Temp', color: '#ef4444' },
    medication: { name: 'medical-outline', label: 'Meds', color: '#ff6b6b' },
    vaccine: { name: 'shield-checkmark-outline', label: 'Vaccine', color: '#10b981' },
    doctor: { name: 'person-outline', label: 'Doctor', color: '#3b82f6' },
    hospital: { name: 'business-outline', label: 'Hospital', color: '#ef4444' },
    growth: { name: 'trending-up-outline', label: 'Growth', color: '#43e97b' },
    weight: { name: 'scale-outline', label: 'Weight', color: '#f59e0b' },
    height: { name: 'resize-outline', label: 'Height', color: '#3b82f6' },
    head: { name: 'ellipse-outline', label: 'Head', color: '#ec4899' },
    symptom: { name: 'pulse-outline', label: 'Symptom', color: '#f97316' },
    allergy: { name: 'warning-outline', label: 'Allergy', color: '#f59e0b' },
    bandage: { name: 'bandage-outline', label: 'Injury', color: '#ef4444' },
    eye: { name: 'eye-outline', label: 'Eye', color: '#3b82f6' },
    ear: { name: 'ear-outline', label: 'Ear', color: '#f59e0b' },
    tooth: { name: 'sunny-outline', label: 'Teeth', color: '#fff' },
  },

  development: {
    milestone: { name: 'trophy-outline', label: 'Milestone', color: '#ffd700' },
    play: { name: 'game-controller-outline', label: 'Play', color: '#a855f7' },
    tummy: { name: 'body-outline', label: 'Tummy', color: '#f59e0b' },
    crawl: { name: 'walk-outline', label: 'Crawl', color: '#10b981' },
    walk: { name: 'footsteps-outline', label: 'Walk', color: '#3b82f6' },
    talk: { name: 'chatbubble-outline', label: 'Talk', color: '#ec4899' },
    read: { name: 'book-outline', label: 'Reading', color: '#8b5cf6' },
    music: { name: 'musical-notes-outline', label: 'Music', color: '#a855f7' },
    art: { name: 'color-palette-outline', label: 'Art', color: '#06b6d4' },
    blocks: { name: 'cube-outline', label: 'Blocks', color: '#f97316' },
    puzzle: { name: 'extension-puzzle-outline', label: 'Puzzle', color: '#10b981' },
    bike: { name: 'bicycle-outline', label: 'Bike', color: '#3b82f6' },
    swim: { name: 'water-outline', label: 'Swim', color: '#06b6d4' },
    dance: { name: 'musical-note-outline', label: 'Dance', color: '#ec4899' },
    sing: { name: 'mic-outline', label: 'Sing', color: '#f59e0b' },
  },

  daily: {
    note: { name: 'document-text-outline', label: 'Note', color: '#94a3b8' },
    photo: { name: 'camera-outline', label: 'Photo', color: '#ec4899' },
    video: { name: 'videocam-outline', label: 'Video', color: '#ef4444' },
    voice: { name: 'mic-outline', label: 'Voice', color: '#8b5cf6' },
    calendar: { name: 'calendar-outline', label: 'Calendar', color: '#3b82f6' },
    clock: { name: 'time-outline', label: 'Clock', color: '#64748b' },
    alarm: { name: 'alarm-outline', label: 'Alarm', color: '#f59e0b' },
    timer: { name: 'timer-outline', label: 'Timer', color: '#ef4444' },
    location: { name: 'location-outline', label: 'Location', color: '#10b981' },
    home: { name: 'home-outline', label: 'Home', color: '#3b82f6' },
    car: { name: 'car-outline', label: 'Car', color: '#64748b' },
    stroller: { name: 'walk-outline', label: 'Stroll', color: '#10b981' },
    park: { name: 'leaf-outline', label: 'Park', color: '#10b981' },
    store: { name: 'cart-outline', label: 'Store', color: '#f59e0b' },
    school: { name: 'school-outline', label: 'School', color: '#3b82f6' },
  },

  mood: {
    happy: { name: 'happy-outline', label: 'Happy', color: '#f59e0b' },
    sad: { name: 'sad-outline', label: 'Sad', color: '#3b82f6' },
    excited: { name: 'rocket-outline', label: 'Excited', color: '#ec4899' },
    calm: { name: 'leaf-outline', label: 'Calm', color: '#10b981' },
    tired: { name: 'bed-outline', label: 'Tired', color: '#8b5cf6' },
    fussy: { name: 'alert-circle-outline', label: 'Fussy', color: '#f97316' },
    sick: { name: 'skull-outline', label: 'Sick', color: '#ef4444' },
    playful: { name: 'balloon-outline', label: 'Playful', color: '#ec4899' },
    curious: { name: 'search-outline', label: 'Curious', color: '#3b82f6' },
    scared: { name: 'shield-outline', label: 'Scared', color: '#64748b' },
    surprised: { name: 'flash-outline', label: 'Surprised', color: '#f59e0b' },
    loving: { name: 'heart-outline', label: 'Loving', color: '#ef4444' },
  },

  food: {
    milk: { name: 'flask-outline', label: 'Milk', color: '#f5f5f5' },
    formula: { name: 'beaker-outline', label: 'Formula', color: '#fbbf24' },
    solid: { name: 'restaurant-outline', label: 'Solid', color: '#f97316' },
    snack: { name: 'cafe-outline', label: 'Snack', color: '#10b981' },
    water: { name: 'water-outline', label: 'Water', color: '#3b82f6' },
    juice: { name: 'wine-outline', label: 'Juice', color: '#f59e0b' },
    fruit: { name: 'nutrition-outline', label: 'Fruit', color: '#ef4444' },
    veggie: { name: 'leaf-outline', label: 'Veggie', color: '#10b981' },
    meat: { name: 'restaurant-outline', label: 'Meat', color: '#f97316' },
    grain: { name: 'grid-outline', label: 'Grain', color: '#fbbf24' },
    dairy: { name: 'egg-outline', label: 'Dairy', color: '#f5f5f5' },
    treat: { name: 'ice-cream-outline', label: 'Treat', color: '#ec4899' },
  },

  sleep: {
    nap: { name: 'sunny-outline', label: 'Nap', color: '#f59e0b' },
    night: { name: 'moon-outline', label: 'Night', color: '#6366f1' },
    crib: { name: 'bed-outline', label: 'Crib', color: '#3b82f6' },
    coSleep: { name: 'people-outline', label: 'Co-sleep', color: '#ec4899' },
    dream: { name: 'cloud-outline', label: 'Dream', color: '#8b5cf6' },
    wake: { name: 'eye-outline', label: 'Wake', color: '#f97316' },
    yawn: { name: 'ellipse-outline', label: 'Yawn', color: '#94a3b8' },
    lullaby: { name: 'musical-notes-outline', label: 'Lullaby', color: '#a855f7' },
  },

  hygiene: {
    wash: { name: 'water-outline', label: 'Wash', color: '#06b6d4' },
    soap: { name: 'sparkles-outline', label: 'Soap', color: '#8b5cf6' },
    shampoo: { name: 'color-wand-outline', label: 'Shampoo', color: '#3b82f6' },
    towel: { name: 'shirt-outline', label: 'Towel', color: '#f5f5f5' },
    wipe: { name: 'trash-outline', label: 'Wipe', color: '#10b981' },
    sanitize: { name: 'shield-checkmark-outline', label: 'Sanitize', color: '#10b981' },
    diaperCream: { name: 'color-fill-outline', label: 'Cream', color: '#fbbf24' },
    powder: { name: 'cloud-outline', label: 'Powder', color: '#f5f5f5' },
  },

  medical: {
    pill: { name: 'ellipse-outline', label: 'Pill', color: '#ef4444' },
    liquid: { name: 'beaker-outline', label: 'Liquid', color: '#3b82f6' },
    dropper: { name: 'eyedrop-outline', label: 'Dropper', color: '#06b6d4' },
    syringe: { name: 'git-commit-outline', label: 'Syringe', color: '#ef4444' },
    cream: { name: 'color-fill-outline', label: 'Cream', color: '#fbbf24' },
    spray: { name: 'water-outline', label: 'Spray', color: '#06b6d4' },
    inhaler: { name: 'cloud-outline', label: 'Inhaler', color: '#8b5cf6' },
    patch: { name: 'bandage-outline', label: 'Patch', color: '#f59e0b' },
  },

  social: {
    family: { name: 'people-outline', label: 'Family', color: '#ec4899' },
    friend: { name: 'person-add-outline', label: 'Friend', color: '#3b82f6' },
    babysitter: { name: 'woman-outline', label: 'Sitter', color: '#a855f7' },
    grandparent: { name: 'man-outline', label: 'Grandparent', color: '#64748b' },
    sibling: { name: 'people-circle-outline', label: 'Sibling', color: '#10b981' },
    pet: { name: 'paw-outline', label: 'Pet', color: '#f59e0b' },
    party: { name: 'balloon-outline', label: 'Party', color: '#ec4899' },
    visit: { name: 'enter-outline', label: 'Visit', color: '#3b82f6' },
    call: { name: 'call-outline', label: 'Call', color: '#10b981' },
    message: { name: 'chatbubble-outline', label: 'Message', color: '#8b5cf6' },
  },

  weather: {
    sunny: { name: 'sunny-outline', label: 'Sunny', color: '#f59e0b' },
    cloudy: { name: 'cloudy-outline', label: 'Cloudy', color: '#94a3b8' },
    rainy: { name: 'rainy-outline', label: 'Rainy', color: '#3b82f6' },
    snowy: { name: 'snow-outline', label: 'Snowy', color: '#e2e8f0' },
    windy: { name: 'swap-horizontal-outline', label: 'Windy', color: '#64748b' },
    hot: { name: 'flame-outline', label: 'Hot', color: '#ef4444' },
    cold: { name: 'snow-outline', label: 'Cold', color: '#3b82f6' },
    humid: { name: 'water-outline', label: 'Humid', color: '#06b6d4' },
  },

  achievement: {
    star: { name: 'star-outline', label: 'Star', color: '#ffd700' },
    medal: { name: 'ribbon-outline', label: 'Medal', color: '#f59e0b' },
    trophy: { name: 'trophy-outline', label: 'Trophy', color: '#ffd700' },
    crown: { name: 'diamond-outline', label: 'Crown', color: '#ffd700' },
    heart: { name: 'heart-outline', label: 'Heart', color: '#ef4444' },
    sparkle: { name: 'sparkles-outline', label: 'Sparkle', color: '#fbbf24' },
    rocket: { name: 'rocket-outline', label: 'Rocket', color: '#ef4444' },
    diamond: { name: 'diamond-outline', label: 'Diamond', color: '#06b6d4' },
    badge: { name: 'shield-checkmark-outline', label: 'Badge', color: '#10b981' },
    flag: { name: 'flag-outline', label: 'Flag', color: '#ef4444' },
    check: { name: 'checkmark-circle-outline', label: 'Check', color: '#10b981' },
    fire: { name: 'flame-outline', label: 'Streak', color: '#f97316' },
  },
} as const;


export type BabyIconKey = {
  [K in keyof typeof BABY_ICONS]: keyof (typeof BABY_ICONS)[K];
}[keyof typeof BABY_ICONS];

export const getIconConfig = (category: IconCategory, key: string) => {
  const cat = BABY_ICONS[category];
  return cat?.[key as keyof typeof cat] || null;
};

export const getIconByName = (name: string): { name: string; label: string; color: string } | null => {
  for (const category of Object.values(BABY_ICONS)) {
    for (const [key, config] of Object.entries(category)) {
      if (config.name === name) {
        return { ...config, label: key };
      }
    }
  }
  return null;
};


interface LittleLoomIconProps {
  category: IconCategory;
  name: string;
  size?: IconSize | number;
  color?: string;
  bgColor?: string;
  gradient?: [string, string];
  showLabel?: boolean;
  labelPosition?: 'bottom' | 'right';
  animated?: boolean;
  style?: any;
  onPress?: () => void;
}

export const LittleLoomIcon: React.FC<LittleLoomIconProps> = ({
  category,
  name,
  size = 'md',
  color,
  bgColor,
  gradient,
  showLabel = false,
  labelPosition = 'bottom',
  animated = false,
  style,
  onPress,
}) => {
  const config = getIconConfig(category, name);
  if (!config) return null;

  const iconSize = typeof size === 'string' ? SIZE_MAP[size] : size;
  const iconColor = color || config.color;
  const backgroundColor = bgColor || `${iconColor}15`;

  const Wrapper = onPress ? Animated.createAnimatedComponent(View) : View;
  const wrapperProps = animated ? { entering: FadeIn.duration(300) } : {};

  const content = (
    <Wrapper {...wrapperProps} style={[
      styles.iconWrapper,
      labelPosition === 'right' && styles.iconWrapperRow,
      style
    ]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          style={[
            styles.iconContainer,
            { width: iconSize * 1.6, height: iconSize * 1.6, borderRadius: iconSize * 0.4 },
          ]}
        >
          <Ionicons name={config.name as any} size={iconSize} color="#fff" />
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.iconContainer,
            {
              width: iconSize * 1.6,
              height: iconSize * 1.6,
              borderRadius: iconSize * 0.4,
              backgroundColor },
          ]}
        >
          <Ionicons name={config.name as any} size={iconSize} color={iconColor} />
        </View>
      )}
      {showLabel && (
        <Text style={[
          styles.iconLabel,
          labelPosition === 'right' && styles.iconLabelRight,
          { color: iconColor }}
        ]}>
          {config.label}
        </Text>
      )}
    </Wrapper>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};


interface IconBadgeProps {
  category: IconCategory;
  name: string;
  count?: number;
  size?: IconSize;
  color?: string;
  style?: any;
}

export const IconBadge: React.FC<IconBadgeProps> = ({
  category,
  name,
  count,
  size = 'md',
  color,
  style,
}) => {
  const config = getIconConfig(category, name);
  if (!config) return null;

  const iconSize = typeof size === 'string' ? SIZE_MAP[size] : size;
  const badgeColor = color || config.color;

  return (
    <View style={[styles.badgeWrapper, style]}>
      <View style={[
        styles.badgeContainer,
        {
          width: iconSize * 1.8,
          height: iconSize * 1.8,
          borderRadius: iconSize * 0.5,
          backgroundColor: `${badgeColor }15`,
        }
      ]}>
        <Ionicons name={config.name as any} size={iconSize} color={badgeColor} />
      </View>
      {count !== undefined && count > 0 && (
        <View style={[styles.badgeCount, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeCountText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
};


export const getActivityIcon = (type: string): { category: IconCategory; name: string; color: string } => {
  const mappings: Record<string, { category: IconCategory; name: string }> = {
    potty: { category: 'care', name: 'potty' },
    diaper: { category: 'care', name: 'diaper' },
    feed: { category: 'care', name: 'feed' },
    sleep: { category: 'care', name: 'sleep' },
    bath: { category: 'care', name: 'bath' },
    growth: { category: 'health', name: 'growth' },
    medication: { category: 'health', name: 'medication' },
    temperature: { category: 'health', name: 'thermometer' },
    symptom: { category: 'health', name: 'symptom' },
    milestone: { category: 'development', name: 'milestone' },
    play: { category: 'development', name: 'play' },
    note: { category: 'daily', name: 'note' },
  };

  const mapping = mappings[type];
  if (mapping) {
    const config = getIconConfig(mapping.category, mapping.name);
    return {
      category: mapping.category,
      name: mapping.name,
      color: config?.color || '#667eea',
    };
  }

  return { category: 'daily', name: 'note', color: '#94a3b8' };
};


export const MOOD_ICONS = [
  { key: 'happy', emoji: '😊', label: 'Happy', color: '#f59e0b' },
  { key: 'excited', emoji: '🤩', label: 'Excited', color: '#ec4899' },
  { key: 'calm', emoji: '😌', label: 'Calm', color: '#10b981' },
  { key: 'tired', emoji: '😴', label: 'Tired', color: '#8b5cf6' },
  { key: 'fussy', emoji: '😣', label: 'Fussy', color: '#f97316' },
  { key: 'sad', emoji: '😢', label: 'Sad', color: '#3b82f6' },
  { key: 'sick', emoji: '🤒', label: 'Sick', color: '#ef4444' },
  { key: 'scared', emoji: '😨', label: 'Scared', color: '#64748b' },
];


const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  iconWrapperRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  iconLabelRight: {
    marginTop: 0,
    fontSize: 14,
  },
  badgeWrapper: {
    position: 'relative',
  },
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});

export default BABY_ICONS;