import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, Dimensions, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');


export type AvatarType = 'photo' | 'emoji' | 'illustration' | 'gradient' | 'letter';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'profile';
export type BabyGender = 'boy' | 'girl' | 'other';
export type AvatarTheme = 'pastel' | 'vibrant' | 'neutral' | 'warm' | 'cool';

interface AvatarConfig {
  type: AvatarType;
  value: string;
  gender?: BabyGender;
  skinTone?: number;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  xxl: 128,
  profile: 160,
};


export const BABY_EMOJIS = {
  faces: [
    '👶', '👧', '👦', '🧒', '👼', '🤱',
  ],

  animals: [
    '🐣', '🐥', '🐤', '🐱', '🐶', '🐰',
    '🐻', '🐨', '🐼', '🐸', '🦁', '🐯',
    '🦄', '🦊', '🐷', '🐹', '🐭', '🐮',
  ],

  fantasy: [
    '🧸', '🎀', '⭐', '🔆', '🌈', '🦄',
    '🧚', '🧜', '🧞', '🎠', '🎡', '🎢',
  ],

  nature: [
    '🌸', '🌺', '🌻', '🌷', '🍄', '🌵',
    '🌲', '🌳', '🍁', '🍂', '🌊', '☀️',
  ],

  food: [
    '🍼', '🍎', '🍌', '🍇', '🍓', '🫐',
    '🥕', '🌽', '🍞', '🧀', '🍪', '🧁',
  ],

  toys: [
    '🎈', '🎉', '🎊', '🎁', '🎮', '🧩',
    '🎨', '🎭', '🎪', '🎯', '🎲', '🧸',
  ],

  celestial: [
    '⭐', '🌟', '✨', '💫', '☀️', '🌙',
    '🌕', '🌈', '☁️', '⛅', '🌤️', '🔆',
  ],

  hearts: [
    '❤️', '🧡', '💛', '💚', '💙', '💜',
    '🖤', '🤍', '🤎', '💗', '💖', '💝',
  ],
} as const;

export const ALL_EMOJIS = Object.values(BABY_EMOJIS).flat();


export const ILLUSTRATION_AVATARS = {
  baby: {
    boy: [
      'https://cdn-icons-png.flaticon.com/512/2922/2922506.png',  // Baby boy
      'https://cdn-icons-png.flaticon.com/512/2922/2922510.png',  // Toddler boy
      'https://cdn-icons-png.flaticon.com/512/2922/2922511.png',  // Boy with pacifier
    ],
    girl: [
      'https://cdn-icons-png.flaticon.com/512/2922/2922507.png',  // Baby girl
      'https://cdn-icons-png.flaticon.com/512/2922/2922509.png',  // Toddler girl
      'https://cdn-icons-png.flaticon.com/512/2922/2922512.png',  // Girl with bow
    ],
    other: [
      'https://cdn-icons-png.flaticon.com/512/2922/2922508.png',  // Neutral baby
      'https://cdn-icons-png.flaticon.com/512/2922/2922513.png',  // Sleeping baby
    ],
  },

  animal: {
    bear: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png',
    bunny: 'https://cdn-icons-png.flaticon.com/512/3069/3069187.png',
    cat: 'https://cdn-icons-png.flaticon.com/512/3069/3069224.png',
    dog: 'https://cdn-icons-png.flaticon.com/512/3069/3069236.png',
    elephant: 'https://cdn-icons-png.flaticon.com/512/3069/3069180.png',
    fox: 'https://cdn-icons-png.flaticon.com/512/3069/3069221.png',
    giraffe: 'https://cdn-icons-png.flaticon.com/512/3069/3069220.png',
    lion: 'https://cdn-icons-png.flaticon.com/512/3069/3069231.png',
    monkey: 'https://cdn-icons-png.flaticon.com/512/3069/3069233.png',
    panda: 'https://cdn-icons-png.flaticon.com/512/3069/3069235.png',
    penguin: 'https://cdn-icons-png.flaticon.com/512/3069/3069237.png',
    unicorn: 'https://cdn-icons-png.flaticon.com/512/3069/3069244.png',
  },

  object: {
    rattle: 'https://cdn-icons-png.flaticon.com/512/3069/3069238.png',
    bottle: 'https://cdn-icons-png.flaticon.com/512/3069/3069239.png',
    pacifier: 'https://cdn-icons-png.flaticon.com/512/3069/3069240.png',
    blocks: 'https://cdn-icons-png.flaticon.com/512/3069/3069241.png',
    duck: 'https://cdn-icons-png.flaticon.com/512/3069/3069242.png',
    star: 'https://cdn-icons-png.flaticon.com/512/3069/3069243.png',
  },
} as const;


export const GRADIENT_PRESETS: Record<string, [string, string]> = {
  boy_blue: ['#667eea', '#764ba2'],
  boy_ocean: ['#11998e', '#38ef7d'],
  boy_sky: ['#3b82f6', '#06b6d4'],
  boy_navy: ['#1e3a8a', '#3b82f6'],

  girl_pink: ['#fa709a', '#fee140'],
  girl_rose: ['#f472b6', '#db2777'],
  girl_coral: ['#ff6b6b', '#feca57'],
  girl_lavender: ['#c084fc', '#a855f7'],

  neutral_mint: ['#10b981', '#34d399'],
  neutral_sage: ['#84cc16', '#a3e635'],
  neutral_sand: ['#d4a574', '#e8c4a0'],
  neutral_slate: ['#64748b', '#94a3b8'],

  warm_sunset: ['#f97316', '#fbbf24'],
  warm_peach: ['#fb923c', '#fdba74'],
  warm_gold: ['#f59e0b', '#fbbf24'],

  cool_ice: ['#06b6d4', '#22d3ee'],
  cool_lavender: ['#818cf8', '#a5b4fc'],
  cool_mint: ['#14b8a6', '#2dd4bf'],
} as const;


export const SKIN_TONES = [
  { color: '#F5D5C5', label: 'Fair', undertone: 'warm', id: 0 },
  { color: '#E8C4A0', label: 'Light', undertone: 'neutral', id: 1 },
  { color: '#D4A574', label: 'Medium', undertone: 'warm', id: 2 },
  { color: '#C68642', label: 'Tan', undertone: 'golden', id: 3 },
  { color: '#8D5524', label: 'Brown', undertone: 'rich', id: 4 },
  { color: '#5C3A21', label: 'Dark', undertone: 'deep', id: 5 },
  { color: '#3D2314', label: 'Deep', undertone: 'ebony', id: 6 },
  { color: '#E0AC69', label: 'Olive', undertone: 'mediterranean', id: 7 },
  { color: '#CD853F', label: 'Bronze', undertone: 'copper', id: 8 },
  { color: '#A0522D', label: 'Chestnut', undertone: 'warm', id: 9 },
  { color: '#F4C2C2', label: 'Rose Fair', undertone: 'cool', id: 10 },
  { color: '#D2691E', label: 'Amber', undertone: 'golden', id: 11 },
] as const;


export const GENDER_CONFIG = {
  boy: {
    label: 'Boy',
    icon: 'male',
    defaultGradient: GRADIENT_PRESETS.boy_blue,
    defaultColor: '#667eea',
    defaultEmoji: '👦',
    illustrations: ILLUSTRATION_AVATARS.baby.boy,
  },
  girl: {
    label: 'Girl',
    icon: 'female',
    defaultGradient: GRADIENT_PRESETS.girl_pink,
    defaultColor: '#fa709a',
    defaultEmoji: '👧',
    illustrations: ILLUSTRATION_AVATARS.baby.girl,
  },
  other: {
    label: 'Other',
    icon: 'ellipse',
    defaultGradient: GRADIENT_PRESETS.neutral_mint,
    defaultColor: '#10b981',
    defaultEmoji: '👶',
    illustrations: ILLUSTRATION_AVATARS.baby.other,
  },
} as const;


const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return (
    trimmed.startsWith('http') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('asset:') ||
    trimmed.startsWith('content:')
  );
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 8) return false;
  const code = value.codePointAt(0) || 0;
  return (
    (code >= 0x1F600 && code <= 0x1F64F) ||
    (code >= 0x1F300 && code <= 0x1F5FF) ||
    (code >= 0x1F680 && code <= 0x1F6FF) ||
    (code >= 0x1F1E0 && code <= 0x1F1FF) ||
    (code >= 0x2600 && code <= 0x26FF) ||
    (code >= 0x2700 && code <= 0x27BF) ||
    (code >= 0x1F900 && code <= 0x1F9FF) ||
    code === 0x2B50 || code === 0x2B55 || code === 0x2764 || code === 0x2763
  );
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};


interface LittleLoomAvatarProps {
  source?: string | null;  // Photo URI, emoji, or illustration URL
  name?: string;           // For letter fallback

  size?: AvatarSize | number;
  gender?: BabyGender;
  skinTone?: number;

  borderColor?: string;
  borderWidth?: number;
  shadow?: boolean;

  showEditBadge?: boolean;
  showStatusIndicator?: boolean;
  statusColor?: string;
  onPress?: () => void;
  onEdit?: () => void;

  animated?: boolean;
  animationDelay?: number;

  style?: any;
  gradient?: [string, string];
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}

export const LittleLoomAvatar: React.FC<LittleLoomAvatarProps> = ({
  source,
  name,
  size = 'md',
  gender = 'other',
  skinTone = 2,
  borderColor = '#fff',
  borderWidth = 3,
  shadow = true,
  showEditBadge = false,
  showStatusIndicator = false,
  statusColor = '#10b981',
  onPress,
  onEdit,
  animated = true,
  animationDelay = 0,
  style,
  gradient,
  fallbackIcon = 'person',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scaleAnim = useSharedValue(0.8);
  const opacityAnim = useSharedValue(0);

  const avatarSize = typeof size === 'string' ? SIZE_MAP[size] : size;
  const genderConfig = GENDER_CONFIG[gender];
  const skinToneColor = SKIN_TONES[skinTone]?.color || SKIN_TONES[2].color;

  const avatarType: AvatarType = useMemo(() => {
    if (isImageUri(source) && !hasError) return 'photo';
    if (isEmoji(source)) return 'emoji';
    if (name) return 'letter';
    return 'gradient';
  }, [source, hasError, name]);

  React.useEffect(() => {
    if (animated) {
      scaleAnim.value = withSpring(1, { damping: 15, stiffness: 150 });
      opacityAnim.value = withTiming(1, { duration: 300 });
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: opacityAnim.value,
  }));

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const renderAvatarContent = () => {
    switch (avatarType) {
      case 'photo':
        return (
          <>
            <Image
              source={{ uri: source! }}
              style={[
                styles.image,
                { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              ]}
              resizeMode="cover"
              onError={handleError}
              onLoad={handleLoad}
            />
            {isLoading && (
              <View style={[styles.loadingOverlay, { borderRadius: avatarSize / 2 }]}>
                <ActivityIndicator size="small" color={genderConfig.defaultColor} />
              </View>
            )}
          </>
        );

      case 'emoji':
        return (
          <View style={[
            styles.emojiContainer,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: `${genderConfig.defaultColor}15`,
            },
          ]}>
            <Text style={[styles.emoji, { fontSize: avatarSize * 0.5 }]}>
              {source}
            </Text>
          </View>
        );

      case 'letter':
        return (
          <LinearGradient
            colors={gradient || genderConfig.defaultGradient}
            style={[
              styles.letterContainer,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2 },
            ]}
          >
            <Text style={[styles.letter, { fontSize: avatarSize * 0.4 }]}>
              {getInitials(name || '')}
            </Text>
          </LinearGradient>
        );

      case 'gradient':
      default:
        return (
          <LinearGradient
            colors={gradient || genderConfig.defaultGradient}
            style={[
              styles.gradientContainer,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2 },
            ]}
          >
            <Ionicons
              name={genderConfig.icon as any}
              size={avatarSize * 0.4}
              color="#fff"
            />
          </LinearGradient>
        );
    }
  };

  const Wrapper = onPress ? TouchableOpacity : View;
  const Container = animated ? Animated.View : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.wrapper, style]}>
      <Container style={[animated && animatedStyle]}>
        <View
          style={[
            styles.container,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderWidth,
              borderColor },
            shadow && styles.shadow,
          ]}
        >
          {renderAvatarContent()}
        </View>

        {/* Edit Badge */}
        {showEditBadge && onEdit && (
          <TouchableOpacity
            style={[
              styles.editBadge,
              {
                backgroundColor: genderConfig.defaultColor,
                width: Math.max(24, avatarSize * 0.2),
                height: Math.max(24, avatarSize * 0.2),
                borderRadius: Math.max(12, avatarSize * 0.1),
                bottom: -borderWidth,
                right: -borderWidth },
            ]}
            onPress={onEdit}
            activeOpacity={0.8}
          >
            <Ionicons
              name="camera"
              size={Math.max(10, avatarSize * 0.1)}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* Status Indicator */}
        {showStatusIndicator && (
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: statusColor,
                width: Math.max(12, avatarSize * 0.12),
                height: Math.max(12, avatarSize * 0.12),
                borderRadius: Math.max(6, avatarSize * 0.06),
                borderWidth: Math.max(2, avatarSize * 0.025),
                borderColor,
                bottom: avatarSize * 0.05,
                right: avatarSize * 0.05 },
            ]}
          />
        )}
      </Container>
    </Wrapper>
  );
};


interface BabyAvatarProps {
  avatar?: string | null;
  name?: string;
  gender?: BabyGender;
  age?: string;
  size?: AvatarSize | number;
  skinTone?: number;
  showAge?: boolean;
  showGender?: boolean;
  selected?: boolean;
  onPress?: () => void;
  style?: any;
}

export const BabyAvatar: React.FC<BabyAvatarProps> = ({
  avatar,
  name,
  gender = 'other',
  age,
  size = 'lg',
  skinTone = 2,
  showAge = false,
  showGender = false,
  selected = false,
  onPress,
  style,
}) => {
  const avatarSize = typeof size === 'string' ? SIZE_MAP[size] : size;
  const genderConfig = GENDER_CONFIG[gender];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.babyAvatarWrapper, style]}
    >
      <View style={styles.avatarRow}>
        <LittleLoomAvatar
          source={avatar}
          name={name}
          size={size}
          gender={gender}
          skinTone={skinTone}
          borderWidth={selected ? 3 : 2}
          borderColor={selected ? genderConfig.defaultColor : '#fff'}
          shadow={true}
        />

        {showGender && (
          <View style={[
            styles.genderBadge,
            { backgroundColor: genderConfig.defaultColor },
          ]}>
            <Ionicons name={genderConfig.icon as any} size={12} color="#fff" />
          </View>
        )}

        {selected && (
          <View style={[
            styles.selectedCheck,
            { backgroundColor: genderConfig.defaultColor },
          ]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </View>

      {name && (
        <Text style={[styles.avatarName, { maxWidth: avatarSize * 1.5 }]} numberOfLines={1}>
          {name}
        </Text>
      )}

      {showAge && age && (
        <Text style={styles.avatarAge}>{age}</Text>
      )}
    </TouchableOpacity>
  );
};


interface AvatarGroupProps {
  avatars: Array<{
    id: string;
    avatar?: string | null;
    name?: string;
    gender?: BabyGender;
  }>;
  maxDisplay?: number;
  size?: AvatarSize;
  onAvatarPress?: (id: string) => void;
  style?: any;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  maxDisplay = 3,
  size = 'sm',
  onAvatarPress,
  style,
}) => {
  const displayAvatars = avatars.slice(0, maxDisplay);
  const remaining = avatars.length - maxDisplay;
  const avatarSize = typeof size === 'string' ? SIZE_MAP[size] : size;

  return (
    <View style={[styles.avatarGroup, style]}>
      {displayAvatars.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.avatarGroupItem,
            { marginLeft: index > 0 ? -avatarSize * 0.3 : 0, zIndex: displayAvatars.length - index },
          ]}
        >
          <LittleLoomAvatar
            source={item.avatar}
            name={item.name}
            size={size}
            gender={item.gender || 'other'}
            borderWidth={2}
            borderColor="#fff"
            onPress={() => onAvatarPress?.(item.id)}
          />
        </View>
      ))}

      {remaining > 0 && (
        <View
          style={[
            styles.avatarGroupMore,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              marginLeft: -avatarSize * 0.3 },
          ]}
        >
          <Text style={[styles.avatarGroupMoreText, { fontSize: avatarSize * 0.35 }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
};


interface AvatarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (avatar: string) => void;
  currentAvatar?: string | null;
  gender?: BabyGender;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  visible,
  onClose,
  onSelect,
  currentAvatar,
  gender = 'other',
}) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'illustration' | 'gradient'>('emoji');
  const genderConfig = GENDER_CONFIG[gender];

  const handleSelect = (avatar: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(avatar);
    onClose();
  };

  const renderEmojiTab = () => (
    <View style={styles.pickerGrid}>
      {Object.entries(BABY_EMOJIS).map(([category, emojis]) => (
        <View key={category} style={styles.emojiCategory}>
          <Text style={styles.emojiCategoryTitle}>
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Text>
          <View style={styles.emojiRow}>
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiOption,
                  currentAvatar === emoji && styles.emojiOptionSelected,
                ]}
                onPress={() => handleSelect(emoji)}
              >
                <Text style={styles.emojiOptionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderIllustrationTab = () => (
    <View style={styles.pickerGrid}>
      <Text style={styles.emojiCategoryTitle}>Baby Characters</Text>
      <View style={styles.emojiRow}>
        {genderConfig.illustrations.map((url, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.illustrationOption,
              currentAvatar === url && styles.illustrationOptionSelected,
            ]}
            onPress={() => handleSelect(url)}
          >
            <Image source={{ uri: url }} style={styles.illustrationImage} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.emojiCategoryTitle}>Animals</Text>
      <View style={styles.emojiRow}>
        {Object.entries(ILLUSTRATION_AVATARS.animal).map(([key, url]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.illustrationOption,
              currentAvatar === url && styles.illustrationOptionSelected,
            ]}
            onPress={() => handleSelect(url)}
          >
            <Image source={{ uri: url }} style={styles.illustrationImage} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGradientTab = () => (
    <View style={styles.pickerGrid}>
      {Object.entries(GRADIENT_PRESETS).map(([key, colors]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.gradientOption,
            currentAvatar === key && styles.gradientOptionSelected,
          ]}
          onPress={() => handleSelect(key)}
        >
          <LinearGradient
            colors={colors}
            style={styles.gradientPreview}
          >
            <Ionicons name="person" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.gradientLabel}>
            {key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={styles.pickerBackdrop} onPress={onClose} />
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHandle} />

          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choose Avatar</Text>
            <TouchableOpacity onPress={onClose} style={styles.pickerClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.pickerTabs}>
            {(['emoji', 'illustration', 'gradient'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.pickerTab,
                  activeTab === tab && { backgroundColor: `${genderConfig.defaultColor}20` },
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.pickerTabText,
                    activeTab === tab && { color: genderConfig.defaultColor, fontWeight: '700' },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
            {activeTab === 'emoji' && renderEmojiTab()}
            {activeTab === 'illustration' && renderIllustrationTab()}
            {activeTab === 'gradient' && renderGradientTab()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};


interface SkinTonePickerProps {
  selected: number;
  onSelect: (tone: number) => void;
  size?: number;
}

export const SkinTonePicker: React.FC<SkinTonePickerProps> = ({
  selected,
  onSelect,
  size = 48,
}) => {
  return (
    <View style={styles.skinToneContainer}>
      {SKIN_TONES.map((tone) => (
        <TouchableOpacity
          key={tone.id}
          style={[
            styles.skinToneButton,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: tone.color },
            selected === tone.id && [
              styles.skinToneSelected,
              { borderColor: tone.id > 5 ? '#fff' : '#1e293b' },
            ],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(tone.id);
          }}
          accessibilityLabel={tone.label}
        >
          {selected === tone.id && (
            <Ionicons
              name="checkmark"
              size={size * 0.4}
              color={tone.id > 5 ? '#fff' : '#1e293b'}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};


const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  image: {
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
  letterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
  },
  gradientContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusIndicator: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  babyAvatarWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  avatarRow: {
    position: 'relative',
  },
  genderBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  avatarAge: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },

  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGroupItem: {
    position: 'relative',
  },
  avatarGroupMore: {
    backgroundColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarGroupMoreText: {
    color: '#fff',
    fontWeight: '800',
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  pickerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pickerTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  pickerTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  pickerScroll: {
    maxHeight: 400,
  },
  pickerGrid: {
    gap: 16,
    paddingBottom: 20,
  },
  emojiCategory: {
    gap: 10,
  },
  emojiCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiOption: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderColor: '#667eea',
    transform: [{ scale: 1.05 }],
  },
  emojiOptionText: {
    fontSize: 28,
  },
  illustrationOption: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  illustrationOptionSelected: {
    borderColor: '#667eea',
    transform: [{ scale: 1.05 }],
  },
  illustrationImage: {
    width: 56,
    height: 56,
  },
  gradientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradientOptionSelected: {
    borderColor: '#667eea',
  },
  gradientPreview: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },

  skinToneContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  skinToneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skinToneSelected: {
    transform: [{ scale: 1.15 }],
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default LittleLoomAvatar;
