import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FadeIn, FadeInUp, Layout, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { , ActivityIndicator, Alert, Animated, BackHandler, Button, Dimensions, Image, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';

import { useNavigationVisibility, useTheme } from '../../context/AppContext';
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

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Customize'>;

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MARGIN = 16;
const GAP = 10;
const PILL_HEIGHT = 44;

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
  { value: 'small' as const, label: 'Small', sample: 'Aa' },
  { value: 'normal' as const, label: 'Normal', sample: 'Aa' },
  { value: 'large' as const, label: 'Large', sample: 'Aa' },
  { value: 'extraLarge' as const, label: 'XL', sample: 'Aa' },
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
  '#667eea', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
  '#f97316', '#ef4444', '#14b8a6', '#8b5cf6', '#e11d48',
  '#06b6d4', '#84cc16',
];

const PillSelector = <T extends string>({
  options,
  selected,
  onSelect,
  activeColor,
  textColor,
  subTextColor,
  isDark,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  selected: T;
  onSelect: (val: T) => void;
  activeColor: string;
  textColor: string;
  subTextColor: string;
  isDark: boolean;
}) => {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.pill,
              isActive && {
                backgroundColor: activeColor,
                shadowColor: activeColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
              },
              !isActive && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
            ]}
            android_ripple={{ color: activeColor + '20', borderless: true }}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={16}
                color={isActive ? '#fff' : subTextColor}
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={[
                styles.pillText,
                { color: isActive ? '#fff' : textColor },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const ColorDot = ({
  color,
  selected,
  onPress,
  size = 36,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  size?: number;
}) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 300 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }, 100);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View
        style={[
          animatedStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            justifyContent: 'center',
            alignItems: 'center',
          },
          selected && {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={size * 0.5} color="#fff" />
        )}
      </Animated.View>
    </Pressable>
  );
};

const ModernToggle = ({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  color,
  textColor,
  subTextColor,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  color: string;
  textColor: string;
  subTextColor: string;
  isDark: boolean;
}) => {
  const translateX = useSharedValue(0);

  const handlePress = () => {
    translateX.value = withTiming(value ? -3 : 3, { duration: 80 });
    setTimeout(() => {
      translateX.value = withTiming(0, { duration: 120 });
    }, 80);
    onToggle();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.modernToggle,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: value ? color + '25' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        },
      ]}
      android_ripple={{ color: color + '10', borderless: false }}
    >
      <Animated.View style={[styles.modernToggleInner, animatedStyle]}>
        <View style={[styles.modernToggleIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={styles.modernToggleText}>
          <Text style={[styles.modernToggleTitle, { color: textColor }]}>{title}</Text>
          <Text style={[styles.modernToggleSubtitle, { color: subTextColor }]}>{subtitle}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0', true: color + '50' }}
          thumbColor={value ? color : isDark ? '#555' : '#f4f3f4'}
          style={{ transform: [{ scale: 0.85 }] }}
        />
      </Animated.View>
    </Pressable>
  );
};

const SectionHeader = ({
  icon,
  color,
  title,
  subtitle,
  textColor,
  subTextColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  textColor: string;
  subTextColor: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionHeaderIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <View>
      <Text style={[styles.sectionHeaderTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.sectionHeaderSubtitle, { color: subTextColor }]}>{subtitle}</Text>
    </View>
  </View>
);

export default function CustomizeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { setThemeMode, setAppearance } = useTheme();
  const { sweetAlert } = useSweetAlert();
  const {
    settings,
    isLoaded,
    themeColors,
    borderRadiusValue,
    updateSettings,
    reset,
  } = useCustomization();

  const effectiveIsDark = useMemo(() => {
    if (settings.appearance === 'system') return systemColorScheme === 'dark';
    return settings.appearance === 'dark' || settings.appearance === 'trueBlack';
  }, [settings.appearance, systemColorScheme]);

  const [pending, setPending] = useState<CustomizationSettings>(settings);

  useEffect(() => {
    if (isLoaded) setPending(settings);
  }, [isLoaded, settings]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(pending) !== JSON.stringify(settings);
  }, [pending, settings]);

  const applyImmediately = useCallback(async (newSettings: Partial<CustomizationSettings>) => {
    const updated = { ...pending, ...newSettings };
    setPending(updated);

    if (newSettings.appearance) {
      const appearance = newSettings.appearance;
      await setAppearance(appearance);
      
      if (appearance === 'light' || appearance === 'pureWhite') {
        await setThemeMode('light');
      } else if (appearance === 'dark' || appearance === 'trueBlack') {
        await setThemeMode('dark');
      } else {
        await setThemeMode('system');
      }
    }
  }, [pending, setAppearance, setThemeMode]);

  const hapticLight = useCallback(() => {
    if (pending.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [pending.hapticFeedback]);

  const hapticMedium = useCallback(() => {
    if (pending.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [pending.hapticFeedback]);

  const hapticSuccess = useCallback(() => {
    if (pending.hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [pending.hapticFeedback]);

  const handleThemeSelect = useCallback((themeId: string) => {
    applyImmediately({ theme: themeId });
    hapticMedium();
  }, [applyImmediately, hapticMedium]);

  const handleAppearanceSelect = useCallback((appearance: AppearanceMode) => {
    applyImmediately({ appearance });
    hapticMedium();
  }, [applyImmediately, hapticMedium]);

  const handleAvatarSelect = useCallback((index: number) => {
    setPending(prev => ({ ...prev, avatar: index }));
    hapticMedium();
  }, [hapticMedium]);

  const toggleSetting = useCallback((key: keyof CustomizationSettings) => {
    setPending(prev => ({ ...prev, [key]: !prev[key] } as CustomizationSettings));
    hapticLight();
  }, [hapticLight]);

  const handleFontSize = useCallback((size: CustomizationSettings['fontSize']) => {
    setPending(prev => ({ ...prev, fontSize: size }));
    hapticLight();
  }, [hapticLight]);

  const handleBorderRadius = useCallback((radius: CustomizationSettings['borderRadius']) => {
    setPending(prev => ({ ...prev, borderRadius: radius }));
    hapticLight();
  }, [hapticLight]);

  const handleAnimationSpeed = useCallback((speed: CustomizationSettings['animationSpeed']) => {
    setPending(prev => ({ ...prev, animationSpeed: speed }));
    hapticLight();
  }, [hapticLight]);

  const handleAccentColor = useCallback((color: string | null) => {
    setPending(prev => ({ ...prev, accentColor: color }));
    hapticMedium();
  }, [hapticMedium]);

  const savePreferences = useCallback(async () => {
    try {
      await updateSettings(pending);
      hapticSuccess();
      sweetAlert({
        title: 'Saved!',
        message: 'Your style is locked in ✨',
        type: 'success',
        confirmText: 'Done',
        onConfirm: () => navigation.goBack(),
      });
    } catch (error) {
      sweetAlert({
        title: 'Oops!',
        message: 'Could not save. Try again.',
        type: 'error',
        confirmText: 'Retry',
      });
    }
  }, [pending, updateSettings, hapticSuccess, sweetAlert, navigation]);

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
        await setThemeMode('system');
        setPending(DEFAULT_SETTINGS);
        hapticSuccess();
      },
    });
  }, [reset, setAppearance, setThemeMode, hapticSuccess, sweetAlert]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      sweetAlert({
        title: 'Unsaved Changes',
        message: 'Save before leaving?',
        type: 'question',
        confirmText: 'Save',
        cancelText: 'Discard',
        showCancel: true,
        onConfirm: savePreferences,
        onCancel: () => navigation.goBack(),
      });
    } else {
      navigation.goBack();
    }
  }, [hasChanges, savePreferences, sweetAlert, navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleBack]);

  const previewColors = useMemo(() => {
    return getFullThemeColors(pending.theme, pending.appearance, systemColorScheme === 'dark');
  }, [pending.theme, pending.appearance, systemColorScheme]);

  const currentTheme = THEME_MAP[pending.theme] || THEME_MAP.purple;
  const fontSizeMultiplier = getFontSizeMultiplier(pending.fontSize);

  const effectivePrimary = pending.accentColor || currentTheme.primary;
  const effectiveSecondary = pending.accentColor ? currentTheme.secondary : currentTheme.secondary;

  const textColor = effectiveIsDark ? '#f1f5f9' : '#1a1a1a';
  const subTextColor = effectiveIsDark ? '#94a3b8' : '#64748b';
  const cardBg = effectiveIsDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)';
  const sectionBorder = effectiveIsDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  if (!isLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: previewColors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, { color: subTextColor }]}>Loading your style...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: previewColors.background }]}>
      <StatusBar barStyle={effectiveIsDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: CARD_MARGIN,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== MODERN HEADER ===== */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.modernHeader}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: cardBg }]}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={textColor} />
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Customize</Text>
              <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
                Make it yours
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: cardBg }]}
              onPress={handleResetDefaults}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color={textColor} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ===== LIVE PREVIEW CARD ===== */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)}>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: cardBg,
                borderColor: sectionBorder,
                borderRadius: borderRadiusValue,
              },
            ]}
          >
            <LinearGradient
              colors={pending.useGradients ? [currentTheme.colors[0], currentTheme.colors[1]] : [cardBg, cardBg]}
              style={[styles.previewGradient, { borderRadius: borderRadiusValue * 0.85 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <SafeAvatar
                avatar={AVATAR_OPTIONS[pending.avatar]}
                size={72}
                themeId={pending.theme}
                animated={!pending.reduceMotion}
              />
              <Text
                style={[
                  styles.previewName,
                  {
                    color: previewColors.text,
                    fontSize: 22 * fontSizeMultiplier,
                    fontWeight: pending.boldText ? '800' : '700',
                  },
                ]}
              >
                {THEME_OPTIONS.find(t => t.id === pending.theme)?.name}
              </Text>
              <View style={styles.previewTags}>
                <View style={[styles.previewTag, { backgroundColor: effectivePrimary + '30' }]}>
                  <Text style={[styles.previewTagText, { color: effectivePrimary }]}>
                    {APPEARANCE_OPTIONS.find(a => a.id === pending.appearance)?.label}
                  </Text>
                </View>
                <View style={[styles.previewTag, { backgroundColor: currentTheme.accent + '30' }]}>
                  <Text style={[styles.previewTagText, { color: currentTheme.accent }]}>
                    {pending.fontSize}
                  </Text>
                </View>
                {pending.accentColor && (
                  <View style={[styles.previewTag, { backgroundColor: pending.accentColor + '30' }]}>
                    <Text style={[styles.previewTagText, { color: pending.accentColor }]}>
                      Custom
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ===== APPEARANCE ===== */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.section}>
          <SectionHeader
            icon="contrast"
            color={effectivePrimary}
            title="Appearance"
            subtitle={APPEARANCE_OPTIONS.find(a => a.id === pending.appearance)?.label || 'System'}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <PillSelector
            options={APPEARANCE_OPTIONS.map(a => ({ value: a.id, label: a.label }))}
            selected={pending.appearance}
            onSelect={handleAppearanceSelect}
            activeColor={effectivePrimary}
            textColor={textColor}
            subTextColor={subTextColor}
            isDark={effectiveIsDark}
          />
        </Animated.View>

        {/* ===== COLOR THEME ===== */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.section}>
          <SectionHeader
            icon="color-palette"
            color={currentTheme.secondary}
            title="Color Theme"
            subtitle={THEME_OPTIONS.find(t => t.id === pending.theme)?.name || 'Lavender'}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeScroll}
            decelerationRate="fast"
            snapToInterval={88}
          >
            {THEME_OPTIONS.map((theme) => {
              const themeColors = THEME_MAP[theme.id];
              const isActive = pending.theme === theme.id;
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => handleThemeSelect(theme.id)}
                  style={[
                    styles.themeBubble,
                    isActive && {
                      borderColor: themeColors?.primary,
                      backgroundColor: (themeColors?.primary || '#667eea') + '12',
                      shadowColor: themeColors?.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                      elevation: 6,
                    },
                    !isActive && {
                      borderColor: sectionBorder,
                      backgroundColor: cardBg,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={themeColors?.colors || ['#e0e7ff', '#d1d5ff']}
                    style={styles.themeBubbleGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.themeBubbleEmoji}>{theme.emoji}</Text>
                  </LinearGradient>
                  <Text style={[styles.themeBubbleName, { color: textColor }]}>{theme.name}</Text>
                  <Text style={[styles.themeBubbleDesc, { color: subTextColor }]}>{theme.desc}</Text>
                  {isActive && (
                    <View style={[styles.themeBubbleCheck, { backgroundColor: themeColors?.primary }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ===== ACCENT COLOR ===== */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.section}>
          <SectionHeader
            icon="color-fill"
            color={currentTheme.accent}
            title="Accent Color"
            subtitle={pending.accentColor ? 'Custom' : 'Theme Default'}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <View style={styles.dotGrid}>
            <ColorDot
              color={currentTheme.colors[0]}
              selected={pending.accentColor === null}
              onPress={() => handleAccentColor(null)}
              size={42}
            />
            {ACCENT_COLORS.map((color) => (
              <ColorDot
                key={color}
                color={color}
                selected={pending.accentColor === color}
                onPress={() => handleAccentColor(color)}
                size={42}
              />
            ))}
          </View>
        </Animated.View>

        {/* ===== AVATAR ===== */}
        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.section}>
          <SectionHeader
            icon="happy-outline"
            color={currentTheme.accent}
            title="Avatar"
            subtitle="Choose your character"
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarScroll}
          >
            {AVATAR_OPTIONS.map((emoji, index) => {
              const isActive = pending.avatar === index;
              return (
                <Pressable
                  key={index}
                  onPress={() => handleAvatarSelect(index)}
                  style={[
                    styles.avatarBubble,
                    {
                      backgroundColor: isActive ? effectivePrimary + '15' : cardBg,
                      borderColor: isActive ? effectivePrimary : sectionBorder,
                      borderRadius: borderRadiusValue,
                    },
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                  {isActive && (
                    <View style={[styles.avatarCheck, { backgroundColor: effectivePrimary }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ===== TYPOGRAPHY ===== */}
        <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.section}>
          <SectionHeader
            icon="text"
            color="#f59e0b"
            title="Typography"
            subtitle={`Size: ${pending.fontSize}`}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <PillSelector
            options={FONT_SIZE_OPTIONS.map(f => ({ value: f.value, label: f.label }))}
            selected={pending.fontSize}
            onSelect={handleFontSize}
            activeColor={effectivePrimary}
            textColor={textColor}
            subTextColor={subTextColor}
            isDark={effectiveIsDark}
          />
        </Animated.View>

        {/* ===== SHAPE ===== */}
        <Animated.View entering={FadeInUp.delay(700).duration(500)} style={styles.section}>
          <SectionHeader
            icon="shapes"
            color="#10b981"
            title="Shape"
            subtitle={`Radius: ${pending.borderRadius}`}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <PillSelector
            options={RADIUS_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
            selected={pending.borderRadius}
            onSelect={handleBorderRadius}
            activeColor={effectivePrimary}
            textColor={textColor}
            subTextColor={subTextColor}
            isDark={effectiveIsDark}
          />
        </Animated.View>

        {/* ===== ANIMATION ===== */}
        <Animated.View entering={FadeInUp.delay(800).duration(500)} style={styles.section}>
          <SectionHeader
            icon="speedometer"
            color="#8b5cf6"
            title="Motion"
            subtitle={`Speed: ${pending.animationSpeed}`}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <PillSelector
            options={ANIMATION_OPTIONS.map(a => ({ value: a.value, label: a.label, icon: a.icon }))}
            selected={pending.animationSpeed}
            onSelect={handleAnimationSpeed}
            activeColor={effectivePrimary}
            textColor={textColor}
            subTextColor={subTextColor}
            isDark={effectiveIsDark}
          />
        </Animated.View>

        {/* ===== VISUAL EFFECTS ===== */}
        <Animated.View entering={FadeInUp.delay(900).duration(500)} style={styles.section}>
          <SectionHeader
            icon="sparkles"
            color="#f97316"
            title="Visual Effects"
            subtitle="Fine-tune the look"
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <View style={styles.toggleGrid}>
            <ModernToggle
              icon="image"
              title="Gradients"
              subtitle="Smooth blends"
              value={pending.useGradients}
              onToggle={() => toggleSetting('useGradients')}
              color={effectivePrimary}
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="water"
              title="Blur"
              subtitle="Glassmorphism"
              value={pending.useBlur}
              onToggle={() => toggleSetting('useBlur')}
              color={currentTheme.secondary}
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="sunny"
              title="Shadows"
              subtitle="Depth & glow"
              value={pending.showShadows}
              onToggle={() => toggleSetting('showShadows')}
              color={currentTheme.accent}
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="contract"
              title="Compact"
              subtitle="Tight layout"
              value={pending.compactSpacing}
              onToggle={() => toggleSetting('compactSpacing')}
              color="#f59e0b"
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
          </View>
        </Animated.View>

        {/* ===== ACCESSIBILITY ===== */}
        <Animated.View entering={FadeInUp.delay(1000).duration(500)} style={styles.section}>
          <SectionHeader
            icon="accessibility"
            color="#14b8a6"
            title="Accessibility"
            subtitle="Make it work for you"
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <View style={styles.toggleGrid}>
            <ModernToggle
              icon="eye-off"
              title="Reduce Motion"
              subtitle="Minimize animations"
              value={pending.reduceMotion}
              onToggle={() => toggleSetting('reduceMotion')}
              color="#11998e"
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="contrast"
              title="High Contrast"
              subtitle="Enhanced visibility"
              value={pending.highContrast}
              onToggle={() => toggleSetting('highContrast')}
              color="#667eea"
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="text"
              title="Bold Text"
              subtitle="Heavier weight"
              value={pending.boldText}
              onToggle={() => toggleSetting('boldText')}
              color="#e11d48"
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="hand-left"
              title="Haptics"
              subtitle="Vibrate on tap"
              value={pending.hapticFeedback}
              onToggle={() => toggleSetting('hapticFeedback')}
              color="#fc5c7d"
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
          </View>
        </Animated.View>

        {/* ===== SOUNDS ===== */}
        <Animated.View entering={FadeInUp.delay(1100).duration(500)} style={styles.section}>
          <SectionHeader
            icon="volume-high"
            color="#ec4899"
            title="Sounds & Alerts"
            subtitle="Audio preferences"
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <View style={styles.toggleGrid}>
            <ModernToggle
              icon="musical-note"
              title="Sound FX"
              subtitle="Action sounds"
              value={pending.soundEffects}
              onToggle={() => toggleSetting('soundEffects')}
              color={currentTheme.accent}
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
            <ModernToggle
              icon="notifications"
              title="Notifications"
              subtitle="Push alerts"
              value={pending.notifications}
              onToggle={() => toggleSetting('notifications')}
              color={currentTheme.secondary}
              textColor={textColor}
              subTextColor={subTextColor}
              isDark={effectiveIsDark}
            />
          </View>
        </Animated.View>

        {/* ===== SAVE FAB ===== */}
        <Animated.View entering={FadeInUp.delay(1200).duration(500)} style={styles.fabContainer}>
          {hasChanges && (
            <View style={styles.unsavedPill}>
              <View style={[styles.unsavedDot, { backgroundColor: effectivePrimary }]} />
              <Text style={[styles.unsavedText, { color: textColor }]}>Unsaved changes</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.fab,
              {
                opacity: hasChanges ? 1 : 0.4,
                shadowColor: effectivePrimary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 10,
              },
            ]}
            onPress={savePreferences}
            activeOpacity={0.85}
            disabled={!hasChanges}
          >
            <LinearGradient
              colors={[effectivePrimary, currentTheme.secondary]}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.fabText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 16, fontWeight: '500' },

  modernHeader: { marginBottom: 24 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: { alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  headerSubtitle: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  previewCard: {
    borderRadius: 28,
    padding: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  previewGradient: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  previewName: { letterSpacing: -0.5 },
  previewTags: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  previewTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  previewTagText: { fontSize: 12, fontWeight: '700' },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    minHeight: PILL_HEIGHT,
  },
  pillText: { fontSize: 14, fontWeight: '700' },

  themeScroll: { gap: 10, paddingRight: 16 },
  themeBubble: {
    width: 80,
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
  },
  themeBubbleGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  themeBubbleEmoji: { fontSize: 28 },
  themeBubbleName: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  themeBubbleDesc: { fontSize: 9, fontWeight: '500', textAlign: 'center', marginTop: 1 },
  themeBubbleCheck: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },

  avatarScroll: { gap: 10, paddingRight: 16 },
  avatarBubble: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: 28 },
  avatarCheck: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  modernToggle: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modernToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  modernToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernToggleText: { flex: 1 },
  modernToggleTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  modernToggleSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  toggleGrid: { gap: 10 },

  fabContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  unsavedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unsavedText: { fontSize: 13, fontWeight: '600' },
  fab: {
    borderRadius: 30,
    overflow: 'hidden',
    minWidth: 160,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    gap: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

export default CustomizeScreen;