import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import * as Haptics from 'expo-haptics';

import { useTracker } from '../../hooks';
import { useCustomization } from '../../hooks/useCustomization';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_WARNING = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const EMOJI_CATEGORIES = [
  { title: 'Care', emojis: ['🍼', '💧', '🚽', '🛁', '💊', '🤱', '👶', '🧴', '🪥', '🧷'] },
  { title: 'Sleep', emojis: ['🌙', '😴', '🛏️', '💤', '⭐', '🌛', '🌜', '☁️', '🌧️', '☀️'] },
  { title: 'Development', emojis: ['📏', '🏆', '📚', '🎨', '🎵', '🧸', '🎓', '🔤', '🔢', '🧩'] },
  { title: 'Activities', emojis: ['🚗', '🏠', '🐶', '🌳', '🍎', '🥕', '🍌', '🥦', '🍓', '🍇'] },
  { title: 'Health', emojis: ['🌡️', '❤️', '🩹', '🏥', '🩺', '💪', '🧠', '👀', '👂', '🦷'] },
  { title: 'Mood', emojis: ['😭', '😟', '😐', '🙂', '😄', '🥰', '😤', '😴', '🤢', '🤒'] },
];

const COLORS = [
  '#667eea', '#fa709a', '#11998e', '#43e97b', '#ffd700',
  '#ff6b6b', '#4facfe', '#00f2fe', '#f093fb', '#f5576c',
  '#5ee7df', '#b490ca', '#a8edea', '#fed6e3', '#d299c2',
  '#ff9a9e', '#a18cd1', '#fbc2eb', '#8fd3f4', '#84fab0',
];

const PRESET_UNITS = ['minutes', 'hours', 'oz', 'ml', 'grams', 'lbs', 'kg', 'cm', 'inches', 'steps', 'times', '°C', '°F'];

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, isDark }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
      </View>
    </View>
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Live Preview Pulse — animated header preview
   ═══════════════════════════════════════════════════════════════════════════ */

const LivePreviewPulse = React.memo<{
  isDark: boolean;
  emoji: string;
  name: string;
  description: string;
  color: string;
  unit: string;
  nameValid: boolean;
}>(({ isDark, emoji, name, description, color, unit, nameValid }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const statusColor = nameValid ? DS.success : name.trim() ? DS.warning : DS.info;
  const statusLabel = !name.trim()
    ? 'Name your tracker to begin'
    : !nameValid
    ? 'Name must be 2-30 characters'
    : 'Ready to preview';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? [`${color}25`, `${color}10`, 'rgba(139,92,246,0.04)']
            : [`${color}12`, `${color}06`, 'rgba(255,255,255,0.4)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${color}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${color}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <View style={styles.pulseAvatarWrap}>
            <Animated.View style={[styles.pulseAvatarGlow, { backgroundColor: `${color}35` }, glowStyle]} />
            <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
              <LinearGradient
                colors={[color, `${color}cc`, DS.warning, color]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {name.trim() || 'My Tracker'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            {!!description.trim() && (
              <Text style={[styles.pulseDesc, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={2}>
                {description.trim()}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color }]}>{emoji}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>icon</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <View style={[styles.pulseColorDot, { backgroundColor: color }]} />
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>color</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning, fontSize: 13 }]} numberOfLines={1}>
              {unit || '—'}
            </Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>unit</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

const AuraRibbon = React.memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   ColorButton — springy color swatch
   ═══════════════════════════════════════════════════════════════════════════ */

const ColorButton = React.memo(({ color, isSelected, isDark, onPress }: {
  color: string; isSelected: boolean; isDark: boolean; onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        scale.value = withSpring(0.85, { damping: 15 }, () => {
          scale.value = withSpring(1, { damping: 12 });
        });
        onPress();
      }}
    >
      <Animated.View style={[
        styles.colorButton,
        { backgroundColor: color },
        isSelected && {
          borderWidth: 3,
          borderColor: isDark ? DS.white : DS.gray900,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        },
        animStyle,
      ]}>
        {isSelected && (
          <Ionicons name="checkmark" size={18} color={DS.white} style={styles.colorCheck} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   UnitChip
   ═══════════════════════════════════════════════════════════════════════════ */

const UnitChip = React.memo(({ unit, isSelected, color, isDark, onPress }: {
  unit: string; isSelected: boolean; color: string; isDark: boolean; onPress: () => void;
}) => (
  <TouchableOpacity
    style={[
      styles.unitChip,
      {
        backgroundColor: isSelected ? `${color}18` : isDark ? DS.darkCard : DS.white,
        borderColor: isSelected ? color : isDark ? DS.darkBorder : DS.gray200,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Text style={[
      styles.unitChipText,
      { color: isSelected ? color : isDark ? DS.gray300 : DS.gray700 },
      isSelected && { fontWeight: '700' },
    ]}>
      {unit}
    </Text>
    {isSelected && <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginLeft: 4 }} />}
  </TouchableOpacity>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

type CreateTrackerNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateCustomTrackerScreen() {
  const navigation = useNavigation<CreateTrackerNavProp>();
  const insets = useSafeAreaInsets();
  const { createCustomTracker: addCustomTracker } = useTracker();
  const { isDark, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍼');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [unit, setUnit] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const finalUnit = unit === 'custom' ? customUnit : unit;

  const isValid = useMemo(() => {
    return name.trim().length >= 2 && name.trim().length <= 30;
  }, [name]);

  const topRibbon = useMemo(() => {
    if (!name.trim()) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'Name required',
        text: 'Give your tracker a name (2-30 characters) to continue',
      };
    }
    if (name.trim().length < 2) {
      return {
        icon: 'alert-circle-outline' as const,
        color: DS.warning,
        label: 'Name too short',
        text: 'Name must be at least 2 characters',
      };
    }
    if (isSubmitting) {
      return {
        icon: 'hourglass-outline' as const,
        color: DS.primary,
        label: 'Creating…',
        text: 'Setting up your tracker — this takes just a moment',
      };
    }
    return {
      icon: 'checkmark-circle-outline' as const,
      color: DS.success,
      label: 'Ready to create',
      text: `"${name.trim()}" · ${selectedEmoji} · ${finalUnit || 'no unit'}`,
    };
  }, [name, isSubmitting, selectedEmoji, finalUnit]);

  const handleCreate = useCallback(async () => {
    if (!isValid) {
      HAPTIC_WARNING();
      return;
    }

    setIsSubmitting(true);
    HAPTIC_SUCCESS();

    const trackerConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      gradient: [selectedColor, selectedColor + 'dd'] as [string, string],
      description: description.trim() || `Custom ${name.trim()} tracker`,
      unit: finalUnit || undefined,
      isCustom: true,
      category: 'custom',
      fields: [
        {
          id: 'value',
          type: 'number',
          label: finalUnit ? `Amount (${finalUnit})` : 'Value',
          placeholder: 'Enter value...',
          required: false,
        },
        {
          id: 'notes',
          type: 'textarea',
          label: 'Notes',
          placeholder: 'Any additional details...',
          required: false,
        },
      ],
      quickTags: ['Morning', 'Afternoon', 'Evening', 'Night'],
    };

    await new Promise(resolve => setTimeout(resolve, 400));

    await addCustomTracker?.(
      trackerConfig.name,
      trackerConfig.emoji,
      trackerConfig.category,
      trackerConfig.fields as any,
      'parent1',
      {
        icon: (trackerConfig as any).icon,
        color: trackerConfig.color,
        gradient: trackerConfig.gradient,
        description: trackerConfig.description,
        quickTags: trackerConfig.quickTags,
      }
    );
    navigation.goBack();
  }, [name, selectedEmoji, selectedColor, description, finalUnit, isValid, addCustomTracker, navigation]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    HAPTIC_LIGHT();
    setSelectedEmoji(emoji);
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    HAPTIC_LIGHT();
    setSelectedColor(color);
  }, []);

  /* ─── RENDER ─── */
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient
          colors={isDark
            ? [DS.darkBg, `${selectedColor}08`, DS.darkBg]
            : ['#f8faff', `${selectedColor}08`, '#eef0f5']}
          style={StyleSheet.absoluteFill}
        />

        {/* Sticky Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[
            styles.stickyHeader,
            {
              paddingTop: HEADER_TOP_PADDING,
              backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
              borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
            headerAnim,
          ]}
        >
          <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.headerInner}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
            >
              <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
                NEW TRACKER
              </GradientText>
              <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Personalize your tracking
              </Text>
            </View>
            <View style={{ width: 38 }} />
          </View>
        </Animated.View>

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 140, paddingHorizontal: DS.space.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Live Preview Pulse */}
          <LivePreviewPulse
            isDark={isDark}
            emoji={selectedEmoji}
            name={name}
            description={description}
            color={selectedColor}
            unit={finalUnit}
            nameValid={isValid}
          />

          {/* Aura Ribbon */}
          <View style={{ marginTop: DS.space.md }}>
            <AuraRibbon isDark={isDark} {...topRibbon} />
          </View>

          {/* Name Input */}
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Tracker Name" subtitle="Give it a memorable name" icon="create-outline" color={selectedColor} isDark={isDark} />
            <View style={[styles.inputWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="pricetag-outline" size={18} color={isDark ? DS.gray500 : DS.gray400} />
              <TextInput
                style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                placeholder="e.g., Reading Time, Tummy Time..."
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                value={name}
                onChangeText={setName}
                maxLength={30}
                autoFocus
              />
              <Text style={[styles.charCount, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                {name.length}/30
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Description" subtitle="What are you tracking?" icon="document-text-outline" color={DS.info} isDark={isDark} />
            <View style={[styles.inputWrap, styles.textareaWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="chatbubble-outline" size={18} color={isDark ? DS.gray500 : DS.gray400} style={{ marginTop: 4 }} />
              <TextInput
                style={[styles.input, styles.textarea, { color: isDark ? DS.white : DS.gray900 }]}
                multiline
                numberOfLines={2}
                placeholder="Brief description of what this tracker monitors..."
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                value={description}
                onChangeText={setDescription}
                maxLength={100}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Emoji Selector */}
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Choose Icon" subtitle="Pick an emoji that fits" icon="happy-outline" color={DS.warning} isDark={isDark} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {EMOJI_CATEGORIES.map((cat, index) => {
                const active = activeEmojiCategory === index;
                return (
                  <TouchableOpacity
                    key={cat.title}
                    style={[
                      styles.catTab,
                      {
                        backgroundColor: active ? `${selectedColor}18` : isDark ? DS.darkCard : DS.white,
                        borderColor: active ? selectedColor : isDark ? DS.darkBorder : DS.gray200,
                      },
                    ]}
                    onPress={() => {
                      HAPTIC_LIGHT();
                      setActiveEmojiCategory(index);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.emojis[0]}</Text>
                    <Text style={[styles.catTabText, { color: active ? selectedColor : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
                      {cat.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: DS.space.md }}>
              {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => {
                const active = selectedEmoji === emoji;
                return (
                  <PressableScale key={emoji} onPress={() => handleEmojiSelect(emoji)} activeScale={0.88}>
                    <View style={[
                      styles.emojiButton,
                      {
                        backgroundColor: active ? `${selectedColor}20` : isDark ? DS.darkCard : DS.white,
                        borderColor: active ? selectedColor : isDark ? DS.darkBorder : DS.gray200,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}>
                      <Text style={[styles.emojiText, active && { transform: [{ scale: 1.15 }] }]}>
                        {emoji}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Color Selector */}
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Choose Color" subtitle="This sets your tracker theme" icon="color-palette-outline" color={DS.accent} isDark={isDark} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {COLORS.map((color) => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={selectedColor === color}
                  isDark={isDark}
                  onPress={() => handleColorSelect(color)}
                />
              ))}
            </View>
          </View>

          {/* Unit Selector */}
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Measurement Unit" subtitle="Optional — helps with quick logging" icon="scale-outline" color={DS.success} isDark={isDark} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_UNITS.map((presetUnit) => (
                <UnitChip
                  key={presetUnit}
                  unit={presetUnit}
                  isSelected={unit === presetUnit}
                  color={selectedColor}
                  isDark={isDark}
                  onPress={() => {
                    HAPTIC_LIGHT();
                    setUnit(presetUnit);
                    setCustomUnit('');
                  }}
                />
              ))}
              <UnitChip
                unit="Custom"
                isSelected={unit === 'custom'}
                color={selectedColor}
                isDark={isDark}
                onPress={() => {
                  HAPTIC_LIGHT();
                  setUnit('custom');
                }}
              />
            </View>

            {unit === 'custom' && (
              <Animated.View entering={FadeInUp.delay(100).springify()} style={{ marginTop: 10 }}>
                <View style={[styles.inputWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <Ionicons name="create-outline" size={18} color={isDark ? DS.gray500 : DS.gray400} />
                  <TextInput
                    style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                    placeholder="Enter custom unit..."
                    placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                    value={customUnit}
                    onChangeText={setCustomUnit}
                    maxLength={15}
                    autoFocus
                  />
                </View>
              </Animated.View>
            )}
          </View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={{ marginTop: DS.space.lg }}>
            <View style={[styles.tipsCard, { backgroundColor: `${DS.primary}08`, borderColor: `${DS.primary}20` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons name="bulb-outline" size={18} color={DS.primary} />
                <Text style={[styles.tipsTitle, { color: DS.primary }]}>Pro Tips</Text>
              </View>
              {[
                'Keep names short for easy quick-logging',
                'Units help when viewing charts and summaries',
                'You can edit this tracker later in Settings',
              ].map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={13} color={DS.primary} style={{ marginTop: 2, marginRight: 8 }} />
                  <Text style={[styles.tipText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>

        {/* Floating Create Button */}
        <Animated.View
          entering={FadeInUp.delay(300).springify()}
          style={[styles.floatingButtonWrap, { bottom: insets.bottom + 20 }]}
        >
          <PressableScale onPress={handleCreate} disabled={!isValid || isSubmitting} activeScale={0.97}>
            <LinearGradient
              colors={isValid ? [selectedColor, `${selectedColor}dd`] : [DS.gray400, DS.gray500]}
              style={styles.createButton}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {isSubmitting ? (
                <Text style={styles.createButtonText}>Creating...</Text>
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color={DS.white} />
                  <Text style={styles.createButtonText}>Create {name.trim() || 'Tracker'}</Text>
                </>
              )}
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: {
    marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 70, height: 70, borderRadius: 35 },
  pulseAvatarRing: { position: 'absolute', width: 66, height: 66, borderRadius: 33, overflow: 'hidden' },
  pulseAvatarInner: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '75%' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseDesc: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg, marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1, gap: 2 },
  pulseStatVal: { fontSize: 18, fontWeight: '800' },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  pulseStatDiv: { width: 1, height: 24 },
  pulseColorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DS.white },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: DS.space.md,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  /* Inputs */
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: DS.radius.md, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  textareaWrap: { alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 14, fontWeight: '600', padding: 0 },
  textarea: { minHeight: 60, paddingTop: 2 },
  charCount: { fontSize: 11, fontWeight: '600' },

  /* Categories */
  catTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: DS.radius.full, borderWidth: 1,
  },
  catTabText: { fontSize: 12, fontWeight: '600' },

  /* Emoji */
  emojiButton: {
    width: (SCREEN_W - 40 - 40) / 5,
    height: (SCREEN_W - 40 - 40) / 5,
    borderRadius: DS.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 26 },

  /* Color */
  colorButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...DS.shadow.sm,
  },
  colorCheck: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Units */
  unitChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: DS.radius.full, borderWidth: 1.5,
  },
  unitChipText: { fontSize: 12, fontWeight: '600' },

  /* Tips */
  tipsCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1 },
  tipsTitle: { fontSize: 14, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },

  /* Floating button */
  floatingButtonWrap: { position: 'absolute', left: DS.space.lg, right: DS.space.lg },
  createButton: {
    height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: DS.radius.lg, ...DS.shadow.lg,
  },
  createButtonText: { color: DS.white, fontSize: 15, fontWeight: '800' },
});