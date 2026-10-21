import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../../context/AppContext';
import {
  useCustomization,
  THEME_MAP,
  AVATAR_OPTIONS,
  APPEARANCE_OPTIONS,
  DEFAULT_SETTINGS,
  getFullThemeColors,
  getFontSizeMultiplier,
} from '../../hooks/useCustomization';
import type { CustomizationSettings, AppearanceMode } from '../../hooks/useCustomization';

import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSupabase } from '../../hooks/useSupabase';
import { UniversalSpinner } from '../../components/UniversalSpinner';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  secondary: '#8b5cf6',
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

const { width: SCREEN_W } = Dimensions.get('window');

const THEME_OPTIONS = [
  { id: 'purple', name: 'Lavender', emoji: '💜', desc: 'Dreamy' },
  { id: 'pink', name: 'Rose', emoji: '🌸', desc: 'Soft' },
  { id: 'blue', name: 'Ocean', emoji: '🌊', desc: 'Fresh' },
  { id: 'green', name: 'Mint', emoji: '🌿', desc: 'Clean' },
  { id: 'yellow', name: 'Sunny', emoji: '☀️', desc: 'Bright' },
  { id: 'coral', name: 'Coral', emoji: '🐠', desc: 'Warm' },
  { id: 'midnight', name: 'Midnight', emoji: '🌙', desc: 'Elegant' },
  { id: 'teal', name: 'Aqua', emoji: '💧', desc: 'Crisp' },
  { id: 'rose', name: 'Berry', emoji: '🍓', desc: 'Bold' },
  { id: 'indigo', name: 'Indigo', emoji: '🔮', desc: 'Mystic' },
  { id: 'emerald', name: 'Forest', emoji: '🌲', desc: 'Earthy' },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', desc: 'Glow' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small' as const, label: 'Small' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'large' as const, label: 'Large' },
  { value: 'extraLarge' as const, label: 'XL' },
];

const RADIUS_OPTIONS = [
  { value: 'sharp' as const, label: 'Sharp' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'round' as const, label: 'Round' },
  { value: 'extraRound' as const, label: 'Soft' },
];

const ANIMATION_OPTIONS = [
  { value: 'slow' as const, label: 'Slow', icon: 'timer-outline' as const },
  { value: 'normal' as const, label: 'Normal', icon: 'speedometer-outline' as const },
  { value: 'fast' as const, label: 'Fast', icon: 'flash-outline' as const },
  { value: 'instant' as const, label: 'Instant', icon: 'stopwatch-outline' as const },
];

const ACCENT_COLORS = [
  DS.primary, DS.accent, DS.info, DS.success, DS.warning, '#fb923c',
  DS.danger, '#14b8a6', DS.secondary, '#e11d48', '#06b6d4', '#84cc16',
];

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
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
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
  </View>
));

/* ─── Theme Pulse Capsule (replaces big preview card) ─── */
const ThemePulse = React.memo<any>(({
  isDark, themeName, themeEmoji, themeColors, appearanceLabel, fontSize,
  avatarEmoji, accentColor, useGradients, borderRadiusValue, fontSizeMultiplier,
  pending, isConnected, user, onReset,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const effectivePrimary = accentColor || themeColors.primary;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={useGradients
            ? [`${themeColors.colors[0]}${isDark ? '35' : '20'}`, `${themeColors.colors[1]}${isDark ? '20' : '10'}`, 'rgba(139,92,246,0.04)']
            : [isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${themeColors.colors[0]}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${themeColors.colors[1]}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.avatarGlow, { backgroundColor: `${themeColors.colors[0]}35` }, glowStyle]} />
            <Animated.View style={[styles.avatarRing, ringStyle]}>
              <LinearGradient colors={[themeColors.colors[0], themeColors.colors[1], DS.warning, themeColors.colors[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Text style={{ fontSize: 32 * Math.min(fontSizeMultiplier, 1.2) }}>{avatarEmoji}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {themeEmoji} {themeName}
              </Text>
              {isConnected && user && (
                <View style={[styles.livePill, { backgroundColor: `${DS.success}18` }]}>
                  <View style={[styles.liveDot, { backgroundColor: DS.success }]} />
                  <Text style={[styles.liveText, { color: DS.success }]}>synced</Text>
                </View>
              )}
            </View>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {appearanceLabel} · {fontSize} text · {pending.useBlur ? 'blur' : 'flat'}
            </Text>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <View style={[styles.colorDot, { backgroundColor: effectivePrimary }]} />
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>accent</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <View style={[styles.radiusDot, { backgroundColor: effectivePrimary, borderRadius: Math.min(borderRadiusValue / 2, 6) }]} />
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{pending.borderRadius}</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Ionicons name={pending.reduceMotion ? 'pause' : 'play'} size={11} color={effectivePrimary} />
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{pending.animationSpeed}</Text>
              </View>
            </View>
          </View>

          <PressableScale onPress={onReset} activeScale={0.9}>
            <View style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="refresh-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
            </View>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98} disabled={!onPress}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── Pill Selector ─── */
const PillSelector = <T extends string>({
  options, selected, onSelect, activeColor, isDark,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  selected: T;
  onSelect: (val: T) => void;
  activeColor: string;
  isDark: boolean;
}) => (
  <View style={styles.pillRow}>
    {options.map((opt) => {
      const isActive = selected === opt.value;
      return (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onSelect(opt.value)}
          activeOpacity={0.85}
          style={[styles.pill, {
            backgroundColor: isActive ? activeColor : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100),
            borderColor: isActive ? activeColor : 'transparent',
          }]}
        >
          {opt.icon && <Ionicons name={opt.icon} size={14} color={isActive ? DS.white : (isDark ? DS.gray400 : DS.gray500)} style={{ marginRight: 5 }} />}
          <Text style={[styles.pillText, { color: isActive ? DS.white : (isDark ? DS.gray300 : DS.gray700) }, isActive && { fontWeight: '800' }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ─── Color Dot ─── */
const ColorDot = ({ color, selected, onPress, size = 38 }: any) => {
  const scale = useSharedValue(1);
  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 300 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }, 100);
    onPress();
  };
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View
        style={[
          animatedStyle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color, justifyContent: 'center', alignItems: 'center' },
          selected && { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
        ]}
      >
        {selected && <Ionicons name="checkmark" size={size * 0.45} color={DS.white} />}
      </Animated.View>
    </Pressable>
  );
};

/* ─── Modern Toggle ─── */
const ModernToggle = ({ icon, title, subtitle, value, onToggle, color, isDark, disabled = false }: any) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onToggle}
    activeOpacity={0.85}
    style={[
      styles.modernToggle,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white,
        borderColor: value ? `${color}35` : (isDark ? DS.darkBorder : DS.gray200),
        opacity: disabled ? 0.5 : 1,
      },
    ]}
    disabled={disabled}
  >
    <View style={styles.modernToggleInner}>
      <View style={[styles.modernToggleIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.modernToggleTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        <Text style={[styles.modernToggleSubtitle, { color: isDark ? DS.gray500 : DS.gray400 }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onToggle}
        trackColor={{ false: isDark ? 'rgba(255,255,255,0.12)' : DS.gray200, true: `${color}60` }}
        thumbColor={value ? color : (isDark ? DS.gray500 : DS.gray100)}
        style={{ transform: [{ scale: 0.82 }] }}
        disabled={disabled}
      />
    </View>
  </TouchableOpacity>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CustomizeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { setAppearance } = useTheme();
  const { sweetAlert } = useSweetAlert();
  const { user, isConnected, supabase } = useSupabase();

  const { settings, isLoaded, updateSettings, reset } = useCustomization();

  const [pending, setPending] = useState<CustomizationSettings>(settings);
  const [isSyncing, setIsSyncing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const effectiveIsDark = useMemo(() => {
    if (pending.appearance === 'system') return systemColorScheme === 'dark';
    return pending.appearance === 'dark' || pending.appearance === 'trueBlack';
  }, [pending.appearance, systemColorScheme]);

  useEffect(() => {
    if (isLoaded) setPending(settings);
  }, [isLoaded, settings]);

  const hasChanges = useMemo(() => JSON.stringify(pending) !== JSON.stringify(settings), [pending, settings]);

  const applyImmediately = useCallback(async (newSettings: Partial<CustomizationSettings>) => {
    const updated = { ...pending, ...newSettings };
    setPending(updated);
    if (newSettings.appearance) await setAppearance(newSettings.appearance);
  }, [pending, setAppearance]);

  const hapticLight = useCallback(() => {
    if (pending.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [pending.hapticFeedback]);

  const hapticMedium = useCallback(() => {
    if (pending.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [pending.hapticFeedback]);

  const hapticSuccess = useCallback(() => {
    if (pending.hapticFeedback) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [pending.hapticFeedback]);

  const handleThemeSelect = useCallback((themeId: string) => { applyImmediately({ theme: themeId }); hapticMedium(); }, [applyImmediately, hapticMedium]);
  const handleAppearanceSelect = useCallback((appearance: AppearanceMode) => { applyImmediately({ appearance }); hapticMedium(); }, [applyImmediately, hapticMedium]);
  const handleAvatarSelect = useCallback((index: number) => { setPending(prev => ({ ...prev, avatar: index })); hapticMedium(); }, [hapticMedium]);
  const toggleSetting = useCallback((key: keyof CustomizationSettings) => { setPending(prev => ({ ...prev, [key]: !prev[key] } as CustomizationSettings)); hapticLight(); }, [hapticLight]);
  const handleFontSize = useCallback((size: CustomizationSettings['fontSize']) => { setPending(prev => ({ ...prev, fontSize: size })); hapticLight(); }, [hapticLight]);
  const handleBorderRadius = useCallback((radius: CustomizationSettings['borderRadius']) => { setPending(prev => ({ ...prev, borderRadius: radius })); hapticLight(); }, [hapticLight]);
  const handleAnimationSpeed = useCallback((speed: CustomizationSettings['animationSpeed']) => { setPending(prev => ({ ...prev, animationSpeed: speed })); hapticLight(); }, [hapticLight]);
  const handleAccentColor = useCallback((color: string | null) => { setPending(prev => ({ ...prev, accentColor: color })); hapticMedium(); }, [hapticMedium]);

  const savePreferences = useCallback(async () => {
    setIsSyncing(true);
    try {
      await updateSettings(pending);

      if (isConnected && user) {
        const { error } = await supabase.from('user_preferences').upsert({
          user_id: user.id,
          theme: pending.theme, avatar: pending.avatar, appearance: pending.appearance,
          font_size: pending.fontSize, border_radius: pending.borderRadius,
          animation_speed: pending.animationSpeed, accent_color: pending.accentColor,
          use_gradients: pending.useGradients, use_blur: pending.useBlur,
          show_shadows: pending.showShadows, compact_spacing: pending.compactSpacing,
          reduce_motion: pending.reduceMotion, high_contrast: pending.highContrast,
          bold_text: pending.boldText, haptic_feedback: pending.hapticFeedback,
          sound_effects: pending.soundEffects, notifications: pending.notifications,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) console.warn('Failed to sync preferences:', error);
      }

      hapticSuccess();
      sweetAlert({
        title: 'Saved!',
        message: isConnected ? 'Style locked in and synced ✨' : 'Style locked in ✨',
        type: 'success',
        confirmText: 'Done',
        onConfirm: () => navigation.goBack(),
      });
    } catch (e) {
      console.error('Save error:', e);
      sweetAlert({ title: 'Oops!', message: 'Could not save. Try again.', type: 'error', confirmText: 'Retry' });
    } finally {
      setIsSyncing(false);
    }
  }, [pending, updateSettings, isConnected, user, supabase, hapticSuccess, sweetAlert, navigation]);

  const handleResetDefaults = useCallback(() => {
    sweetAlert({
      title: 'Reset Everything?',
      message: 'All customizations will return to defaults.',
      type: 'warning',
      confirmText: 'Reset',
      cancelText: 'Keep',
      showCancel: true,
      onConfirm: async () => {
        await reset();
        await setAppearance('system');
        setPending(DEFAULT_SETTINGS);
        hapticSuccess();
        if (isConnected && user) {
          try {
            await supabase.from('user_preferences').upsert({
              user_id: user.id,
              theme: DEFAULT_SETTINGS.theme, avatar: DEFAULT_SETTINGS.avatar,
              appearance: DEFAULT_SETTINGS.appearance, font_size: DEFAULT_SETTINGS.fontSize,
              border_radius: DEFAULT_SETTINGS.borderRadius, animation_speed: DEFAULT_SETTINGS.animationSpeed,
              accent_color: DEFAULT_SETTINGS.accentColor, use_gradients: DEFAULT_SETTINGS.useGradients,
              use_blur: DEFAULT_SETTINGS.useBlur, show_shadows: DEFAULT_SETTINGS.showShadows,
              compact_spacing: DEFAULT_SETTINGS.compactSpacing, reduce_motion: DEFAULT_SETTINGS.reduceMotion,
              high_contrast: DEFAULT_SETTINGS.highContrast, bold_text: DEFAULT_SETTINGS.boldText,
              haptic_feedback: DEFAULT_SETTINGS.hapticFeedback, sound_effects: DEFAULT_SETTINGS.soundEffects,
              notifications: DEFAULT_SETTINGS.notifications,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          } catch (e) { console.warn('Failed to reset cloud preferences:', e); }
        }
      },
    });
  }, [reset, setAppearance, hapticSuccess, sweetAlert, isConnected, user, supabase]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      sweetAlert({
        title: 'Unsaved Changes', message: 'Save before leaving?', type: 'question',
        confirmText: 'Save', cancelText: 'Discard', showCancel: true,
        onConfirm: savePreferences,
        onCancel: () => navigation.goBack(),
      });
    } else navigation.goBack();
  }, [hasChanges, savePreferences, sweetAlert, navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => { handleBack(); return true; });
    return () => backHandler.remove();
  }, [handleBack]);

  const previewColors = useMemo(() => getFullThemeColors(pending.theme, pending.appearance, systemColorScheme === 'dark'), [pending.theme, pending.appearance, systemColorScheme]);
  const currentTheme = THEME_MAP[pending.theme] || THEME_MAP.purple;
  const fontSizeMultiplier = getFontSizeMultiplier(pending.fontSize);
  const borderRadiusValue = { sharp: 8, normal: 16, round: 24, extraRound: 32 }[pending.borderRadius] || 16;
  const effectivePrimary = pending.accentColor || currentTheme.primary;
  const themeName = THEME_OPTIONS.find(t => t.id === pending.theme)?.name || 'Lavender';
  const themeEmoji = THEME_OPTIONS.find(t => t.id === pending.theme)?.emoji || '💜';
  const appearanceLabel = APPEARANCE_OPTIONS.find(a => a.id === pending.appearance)?.label || 'System';

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: previewColors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <UniversalSpinner size={40} color={currentTheme.primary} variant="liquid" section="settings" />
        <Text style={{ color: effectiveIsDark ? DS.gray400 : DS.gray500, fontSize: 13, fontWeight: '600' }}>Loading your style…</Text>
      </View>
    );
  }

  const topRibbon = hasChanges
    ? { icon: 'alert-circle-outline' as const, color: DS.warning, label: 'Unsaved changes', text: 'Tap save below to keep your style', onPress: undefined }
    : { icon: 'checkmark-circle-outline' as const, color: DS.success, label: 'Up to date', text: `${themeName} · ${appearanceLabel}${isConnected ? ' · Synced' : ''}`, onPress: undefined };

  return (
    <View style={[styles.container, { backgroundColor: isDarkBg(effectiveIsDark) }]}>
      <StatusBar barStyle={effectiveIsDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={effectiveIsDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={effectiveIsDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: effectiveIsDark ? DS.white : DS.gray900 }]}>Customize</Text>
        <Text style={[styles.stickySub, { color: effectiveIsDark ? DS.gray400 : DS.gray500 }]}>
          {themeName} · {appearanceLabel}
        </Text>
      </Animated.View>

      {/* Back */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={handleBack} disabled={isSyncing} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: effectiveIsDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: effectiveIsDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={effectiveIsDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Pulse */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          <ThemePulse
            isDark={effectiveIsDark}
            themeName={themeName}
            themeEmoji={themeEmoji}
            themeColors={currentTheme}
            appearanceLabel={appearanceLabel}
            fontSize={pending.fontSize}
            avatarEmoji={AVATAR_OPTIONS[pending.avatar] || '👤'}
            accentColor={pending.accentColor}
            useGradients={pending.useGradients}
            borderRadiusValue={borderRadiusValue}
            fontSizeMultiplier={fontSizeMultiplier}
            pending={pending}
            isConnected={isConnected}
            user={user}
            onReset={handleResetDefaults}
          />
        </View>

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={effectiveIsDark} {...topRibbon} />
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <SectionHeader title="Appearance" subtitle={appearanceLabel} icon="contrast-outline" color={DS.primary} />
          <PillSelector
            options={APPEARANCE_OPTIONS.map(a => ({ value: a.id, label: a.label }))}
            selected={pending.appearance}
            onSelect={handleAppearanceSelect}
            activeColor={effectivePrimary}
            isDark={effectiveIsDark}
          />
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <SectionHeader title="Color Theme" subtitle={themeName} icon="color-palette-outline" color={DS.secondary} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {THEME_OPTIONS.map(theme => {
              const tc = THEME_MAP[theme.id];
              const active = pending.theme === theme.id;
              return (
                <PressableScale key={theme.id} onPress={() => handleThemeSelect(theme.id)} activeScale={0.94}>
                  <View style={[styles.themeBubble, {
                    borderColor: active ? (tc?.primary || DS.primary) : (effectiveIsDark ? DS.darkBorder : DS.gray200),
                    backgroundColor: active ? `${tc?.primary || DS.primary}12` : (effectiveIsDark ? DS.darkCard : DS.white),
                  }]}>
                    <LinearGradient colors={tc?.colors || [DS.primaryLight, DS.secondary]} style={styles.themeBubbleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={styles.themeBubbleEmoji}>{theme.emoji}</Text>
                    </LinearGradient>
                    <Text style={[styles.themeBubbleName, { color: effectiveIsDark ? DS.white : DS.gray900 }]}>{theme.name}</Text>
                    <Text style={[styles.themeBubbleDesc, { color: effectiveIsDark ? DS.gray500 : DS.gray400 }]}>{theme.desc}</Text>
                    {active && <View style={[styles.themeBubbleCheck, { backgroundColor: tc?.primary || DS.primary }]}><Ionicons name="checkmark" size={9} color={DS.white} /></View>}
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>

        {/* Accent */}
        <View style={styles.section}>
          <SectionHeader title="Accent Color" subtitle={pending.accentColor ? 'Custom' : 'Theme default'} icon="color-fill-outline" color={DS.accent} />
          <View style={styles.dotGrid}>
            <ColorDot color={currentTheme.colors[0]} selected={pending.accentColor === null} onPress={() => handleAccentColor(null)} size={38} />
            {ACCENT_COLORS.map(color => (
              <ColorDot key={color} color={color} selected={pending.accentColor === color} onPress={() => handleAccentColor(color)} size={38} />
            ))}
          </View>
        </View>

        {/* Avatar */}
        <View style={styles.section}>
          <SectionHeader title="Avatar" subtitle="Choose your character" icon="happy-outline" color={DS.accent} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {AVATAR_OPTIONS.map((emoji, index) => {
              const active = pending.avatar === index;
              return (
                <PressableScale key={index} onPress={() => handleAvatarSelect(index)} activeScale={0.92}>
                  <View style={[styles.avatarBubble, {
                    backgroundColor: active ? `${effectivePrimary}15` : (effectiveIsDark ? DS.darkCard : DS.white),
                    borderColor: active ? effectivePrimary : (effectiveIsDark ? DS.darkBorder : DS.gray200),
                    borderRadius: borderRadiusValue,
                  }]}>
                    <Text style={styles.avatarEmoji}>{emoji}</Text>
                    {active && <View style={[styles.avatarCheck, { backgroundColor: effectivePrimary }]}><Ionicons name="checkmark" size={9} color={DS.white} /></View>}
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>

        {/* Typography */}
        <View style={styles.section}>
          <SectionHeader title="Typography" subtitle={`${pending.fontSize} text`} icon="text-outline" color={DS.warning} />
          <PillSelector
            options={FONT_SIZE_OPTIONS.map(f => ({ value: f.value, label: f.label }))}
            selected={pending.fontSize}
            onSelect={handleFontSize}
            activeColor={effectivePrimary}
            isDark={effectiveIsDark}
          />
        </View>

        {/* Shape */}
        <View style={styles.section}>
          <SectionHeader title="Shape" subtitle={`${pending.borderRadius} corners`} icon="shapes-outline" color={DS.success} />
          <PillSelector
            options={RADIUS_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
            selected={pending.borderRadius}
            onSelect={handleBorderRadius}
            activeColor={effectivePrimary}
            isDark={effectiveIsDark}
          />
        </View>

        {/* Motion */}
        <View style={styles.section}>
          <SectionHeader title="Motion" subtitle={`${pending.animationSpeed} speed`} icon="speedometer-outline" color={DS.secondary} />
          <PillSelector
            options={ANIMATION_OPTIONS.map(a => ({ value: a.value, label: a.label, icon: a.icon }))}
            selected={pending.animationSpeed}
            onSelect={handleAnimationSpeed}
            activeColor={effectivePrimary}
            isDark={effectiveIsDark}
          />
        </View>

        {/* Visual Effects */}
        <View style={styles.section}>
          <SectionHeader title="Visual Effects" subtitle="Fine-tune the look" icon="sparkles-outline" color="#fb923c" />
          <View style={{ gap: 8 }}>
            <ModernToggle icon="image-outline" title="Gradients" subtitle="Smooth blends" value={pending.useGradients} onToggle={() => toggleSetting('useGradients')} color={DS.primary} isDark={effectiveIsDark} />
            <ModernToggle icon="water-outline" title="Blur" subtitle="Glassmorphism" value={pending.useBlur} onToggle={() => toggleSetting('useBlur')} color={DS.secondary} isDark={effectiveIsDark} />
            <ModernToggle icon="sunny-outline" title="Shadows" subtitle="Depth & glow" value={pending.showShadows} onToggle={() => toggleSetting('showShadows')} color={DS.accent} isDark={effectiveIsDark} />
            <ModernToggle icon="contract-outline" title="Compact" subtitle="Tight layout" value={pending.compactSpacing} onToggle={() => toggleSetting('compactSpacing')} color={DS.warning} isDark={effectiveIsDark} />
          </View>
        </View>

        {/* Accessibility */}
        <View style={styles.section}>
          <SectionHeader title="Accessibility" subtitle="Make it work for you" icon="accessibility-outline" color="#14b8a6" />
          <View style={{ gap: 8 }}>
            <ModernToggle icon="eye-off-outline" title="Reduce Motion" subtitle="Minimize animations" value={pending.reduceMotion} onToggle={() => toggleSetting('reduceMotion')} color={DS.success} isDark={effectiveIsDark} />
            <ModernToggle icon="contrast-outline" title="High Contrast" subtitle="Enhanced visibility" value={pending.highContrast} onToggle={() => toggleSetting('highContrast')} color={DS.primary} isDark={effectiveIsDark} />
            <ModernToggle icon="text-outline" title="Bold Text" subtitle="Heavier weight" value={pending.boldText} onToggle={() => toggleSetting('boldText')} color="#e11d48" isDark={effectiveIsDark} />
            <ModernToggle icon="hand-left-outline" title="Haptics" subtitle="Vibrate on tap" value={pending.hapticFeedback} onToggle={() => toggleSetting('hapticFeedback')} color={DS.accent} isDark={effectiveIsDark} />
          </View>
        </View>

        {/* Sounds */}
        <View style={styles.section}>
          <SectionHeader title="Sounds & Alerts" subtitle="Audio preferences" icon="volume-high-outline" color={DS.accent} />
          <View style={{ gap: 8 }}>
            <ModernToggle icon="musical-note-outline" title="Sound FX" subtitle="Action sounds" value={pending.soundEffects} onToggle={() => toggleSetting('soundEffects')} color={DS.accent} isDark={effectiveIsDark} />
            <ModernToggle icon="notifications-outline" title="Notifications" subtitle="Push alerts" value={pending.notifications} onToggle={() => toggleSetting('notifications')} color={DS.secondary} isDark={effectiveIsDark} />
          </View>
        </View>

        <View style={{ height: 20 }} />
      </Animated.ScrollView>

      {/* Bottom save bar */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.saveBar, { paddingBottom: insets.bottom + 12, backgroundColor: effectiveIsDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderTopColor: effectiveIsDark ? DS.darkBorder : DS.gray200 }]}>
        <BlurView intensity={effectiveIsDark ? 90 : 95} tint={effectiveIsDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        {hasChanges && (
          <View style={styles.unsavedPill}>
            <View style={[styles.unsavedDot, { backgroundColor: DS.warning }]} />
            <Text style={[styles.unsavedText, { color: effectiveIsDark ? DS.gray300 : DS.gray700 }]}>Unsaved changes</Text>
          </View>
        )}
        <PressableScale onPress={savePreferences} disabled={!hasChanges || isSyncing} activeScale={0.97} style={{ flex: 1 }}>
          <LinearGradient
            colors={hasChanges && !isSyncing ? [effectivePrimary, DS.accent] : [effectiveIsDark ? DS.gray700 : DS.gray300, effectiveIsDark ? DS.gray700 : DS.gray400]}
            style={styles.saveBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {isSyncing ? <UniversalSpinner size={18} color={DS.white} variant="liquid" section="settings" /> : <Ionicons name="checkmark" size={20} color={DS.white} />}
            <Text style={styles.saveBtnText}>{isSyncing ? 'Saving…' : hasChanges ? 'Save Changes' : 'Saved'}</Text>
          </LinearGradient>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

function isDarkBg(isDark: boolean) { return isDark ? DS.darkBg : DS.gray50; }

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
  avatarRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  avatarInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  capsuleName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '60%' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  capsuleSub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capsuleStatLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  capsuleStatDiv: { width: 1, height: 14 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  radiusDot: { width: 10, height: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  section: { marginTop: DS.space.lg, paddingHorizontal: DS.space.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2, color: 'inherit' },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.full, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },

  themeBubble: { width: 78, padding: 8, borderRadius: 18, borderWidth: 2, alignItems: 'center' },
  themeBubbleGradient: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  themeBubbleEmoji: { fontSize: 26 },
  themeBubbleName: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  themeBubbleDesc: { fontSize: 9, fontWeight: '500', textAlign: 'center', marginTop: 1 },
  themeBubbleCheck: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DS.white },

  dotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },

  avatarBubble: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarEmoji: { fontSize: 26 },
  avatarCheck: { position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DS.white },

  modernToggle: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  modernToggleInner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  modernToggleIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modernToggleTitle: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  modernToggleSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg, paddingTop: DS.space.md, borderTopWidth: 1 },
  unsavedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  unsavedDot: { width: 6, height: 6, borderRadius: 3 },
  unsavedText: { fontSize: 11, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBtnText: { color: DS.white, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
});