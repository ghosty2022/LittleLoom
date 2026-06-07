// src/hooks/useCustomization.ts
// FULLY SYNCED: Single source of truth for all customization settings
// FIXED: Removed redundant saveSettings/updateSettings
// FIXED: isDark now properly handles pureWhite as light mode
// FIXED: getFullThemeColors now integrated and exposed
// FIXED: Haptic spam reduced (no console.warn on unsupported devices)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// ==================== THEME COLOR DEFINITIONS ====================

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  colors: string[];
  spinnerColor: string;
  darkText: string;
  lightText: string;
}

export interface FullThemeColors extends ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  glassBg: string;
  glassBorder: string;
  shadow: string;
}

// Light mode base colors
const LIGHT_BASE = {
  background: '#f8faff',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  glassBg: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(255,255,255,0.5)',
  shadow: '#667eea',
};

// Dark mode (gray-dark, not pure black)
const DARK_BASE = {
  background: '#0f0f1e',
  surface: '#1a1a2e',
  card: '#16162a',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: 'rgba(255,255,255,0.08)',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  glassBg: 'rgba(26,26,46,0.95)',
  glassBorder: 'rgba(255,255,255,0.1)',
  shadow: '#000000',
};

// True Black (OLED optimized)
const TRUE_BLACK_BASE = {
  background: '#000000',
  surface: '#0a0a0a',
  card: '#0d0d0d',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  border: 'rgba(255,255,255,0.06)',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  glassBg: 'rgba(10,10,10,0.95)',
  glassBorder: 'rgba(255,255,255,0.08)',
  shadow: '#000000',
};

// Pure White (high contrast light)
const PURE_WHITE_BASE = {
  background: '#ffffff',
  surface: '#fafafa',
  card: '#ffffff',
  text: '#000000',
  textSecondary: '#525252',
  border: '#e5e5e5',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  glassBg: 'rgba(255,255,255,0.98)',
  glassBorder: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

export const THEME_MAP: Record<string, ThemeColors> = {
  purple: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#fa709a',
    colors: ['#e0e7ff', '#d1d5ff', '#c7b8ff'],
    spinnerColor: '#667eea',
    darkText: '#4338ca',
    lightText: '#ffffff',
  },
  pink: {
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#fb7185',
    colors: ['#fce7f3', '#fbcfe8', '#f9a8d4'],
    spinnerColor: '#ec4899',
    darkText: '#be185d',
    lightText: '#ffffff',
  },
  blue: {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    accent: '#0ea5e9',
    colors: ['#dbeafe', '#bfdbfe', '#93c5fd'],
    spinnerColor: '#3b82f6',
    darkText: '#1d4ed8',
    lightText: '#ffffff',
  },
  green: {
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#059669',
    colors: ['#d1fae5', '#a7f3d0', '#6ee7b7'],
    spinnerColor: '#10b981',
    darkText: '#047857',
    lightText: '#ffffff',
  },
  yellow: {
    primary: '#f59e0b',
    secondary: '#fbbf24',
    accent: '#d97706',
    colors: ['#fef3c7', '#fde68a', '#fcd34d'],
    spinnerColor: '#f59e0b',
    darkText: '#92400e',
    lightText: '#ffffff',
  },
  coral: {
    primary: '#f97316',
    secondary: '#fb923c',
    accent: '#ea580c',
    colors: ['#ffedd5', '#fed7aa', '#fdba74'],
    spinnerColor: '#f97316',
    darkText: '#9a3412',
    lightText: '#ffffff',
  },
  midnight: {
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#4f46e5',
    colors: ['#e0e7ff', '#c7d2fe', '#a5b4fc'],
    spinnerColor: '#6366f1',
    darkText: '#3730a3',
    lightText: '#ffffff',
  },
  teal: {
    primary: '#14b8a6',
    secondary: '#2dd4bf',
    accent: '#0d9488',
    colors: ['#ccfbf1', '#99f6e4', '#5eead4'],
    spinnerColor: '#14b8a6',
    darkText: '#0f766e',
    lightText: '#ffffff',
  },
  rose: {
    primary: '#e11d48',
    secondary: '#fb7185',
    accent: '#be123c',
    colors: ['#ffe4e6', '#fecdd3', '#fda4af'],
    spinnerColor: '#e11d48',
    darkText: '#9f1239',
    lightText: '#ffffff',
  },
  indigo: {
    primary: '#4f46e5',
    secondary: '#6366f1',
    accent: '#4338ca',
    colors: ['#e0e7ff', '#c7d2fe', '#a5b4fc'],
    spinnerColor: '#4f46e5',
    darkText: '#3730a3',
    lightText: '#ffffff',
  },
  emerald: {
    primary: '#059669',
    secondary: '#10b981',
    accent: '#047857',
    colors: ['#d1fae5', '#a7f3d0', '#6ee7b7'],
    spinnerColor: '#059669',
    darkText: '#065f46',
    lightText: '#ffffff',
  },
  sunset: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    accent: '#e11d48',
    colors: ['#ffe4e6', '#fecdd3', '#fda4af'],
    spinnerColor: '#f43f5e',
    darkText: '#9f1239',
    lightText: '#ffffff',
  },
};

// ==================== APPEARANCE MODES ====================

export type AppearanceMode = 'system' | 'light' | 'dark' | 'trueBlack' | 'pureWhite';

export const APPEARANCE_OPTIONS: { id: AppearanceMode; label: string; emoji: string; desc: string }[] = [
  { id: 'system', label: 'System', emoji: '🖥️', desc: 'Follow device setting' },
  { id: 'light', label: 'Light', emoji: '☀️', desc: 'Clean & bright' },
  { id: 'dark', label: 'Dark', emoji: '🌙', desc: 'Easy on the eyes' },
  { id: 'trueBlack', label: 'True Black', emoji: '⚫', desc: 'OLED optimized' },
  { id: 'pureWhite', label: 'Pure White', emoji: '⚪', desc: 'Maximum contrast' },
];

// ==================== AVATAR OPTIONS ====================

export const AVATAR_OPTIONS = [
  '👶', '🍼', '🧸', '🎀', '👑', '🌟', '🦁', '🐰', '🐻', '🦊',
  '🐼', '🐨', '🦄', '🐣', '🌈', '🍭', '🎈', '🎁', '⭐', '💫',
  '🌸', '🌺', '🌻', '🍀', '🦋', '🐞', '🐙', '🐬', '🦕', '🦖',
];

// ==================== CUSTOMIZATION SETTINGS ====================

export interface CustomizationSettings {
  theme: string;
  avatar: number;
  appearance: AppearanceMode;
  fontSize: 'small' | 'normal' | 'large' | 'extraLarge';
  borderRadius: 'sharp' | 'normal' | 'round' | 'extraRound';
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  accentColor: string | null;
  useGradients: boolean;
  useBlur: boolean;
  showShadows: boolean;
  compactSpacing: boolean;
  useSystemFont: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  boldText: boolean;
  hapticFeedback: boolean;
  soundEffects: boolean;
  notifications: boolean;
}

export const DEFAULT_SETTINGS: CustomizationSettings = {
  theme: 'purple',
  avatar: 0,
  appearance: 'system',
  fontSize: 'normal',
  borderRadius: 'normal',
  animationSpeed: 'normal',
  accentColor: null,
  useGradients: true,
  useBlur: true,
  showShadows: true,
  compactSpacing: false,
  useSystemFont: true,
  reduceMotion: false,
  highContrast: false,
  boldText: false,
  hapticFeedback: true,
  soundEffects: true,
  notifications: true,
};

const STORAGE_KEY = '@littleloom_customization_v3';

// ==================== UTILITY FUNCTIONS ====================

export const getThemeColorsById = (themeId: string): ThemeColors => {
  return THEME_MAP[themeId] || THEME_MAP.purple;
};

export const getFullThemeColors = (
  themeId: string,
  appearance: AppearanceMode,
  systemDark: boolean
): FullThemeColors => {
  const theme = getThemeColorsById(themeId);

  let isDark = false;
  let isTrueBlack = false;
  let isPureWhite = false;

  if (appearance === 'system') {
    isDark = systemDark;
  } else if (appearance === 'dark') {
    isDark = true;
  } else if (appearance === 'trueBlack') {
    isDark = true;
    isTrueBlack = true;
  } else if (appearance === 'pureWhite') {
    isPureWhite = true;
  }

  let base;
  if (isTrueBlack) {
    base = TRUE_BLACK_BASE;
  } else if (isPureWhite) {
    base = PURE_WHITE_BASE;
  } else if (isDark) {
    base = DARK_BASE;
  } else {
    base = LIGHT_BASE;
  }

  return {
    ...theme,
    ...base,
  };
};

export const getFontSizeMultiplier = (size: CustomizationSettings['fontSize']): number => {
  switch (size) {
    case 'small': return 0.875;
    case 'normal': return 1;
    case 'large': return 1.15;
    case 'extraLarge': return 1.3;
    default: return 1;
  }
};

export const getBorderRadiusValue = (radius: CustomizationSettings['borderRadius']): number => {
  switch (radius) {
    case 'sharp': return 4;
    case 'normal': return 14;
    case 'round': return 22;
    case 'extraRound': return 32;
    default: return 14;
  }
};

export const getAnimationDuration = (speed: CustomizationSettings['animationSpeed']): number => {
  switch (speed) {
    case 'slow': return 500;
    case 'normal': return 300;
    case 'fast': return 150;
    case 'instant': return 0;
    default: return 300;
  }
};

// ==================== HAPTIC FEEDBACK TYPES ====================

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

// ==================== HOOK ====================

export function useCustomization() {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<CustomizationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.warn('Failed to load customization:', e);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Save to storage — SINGLE unified save function
  const updateSettings = useCallback(async (newSettings: Partial<CustomizationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save customization:', e);
    }
  }, [settings]);

  const reset = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.warn('Failed to reset customization:', e);
    }
  }, []);

  const themeColors = useMemo(() => getThemeColorsById(settings.theme), [settings.theme]);

  const fullThemeColors = useMemo(() => 
    getFullThemeColors(settings.theme, settings.appearance, systemColorScheme === 'dark'),
    [settings.theme, settings.appearance, systemColorScheme]
  );

  const avatar = useMemo(() => AVATAR_OPTIONS[settings.avatar] || AVATAR_OPTIONS[0], [settings.avatar]);

  // FIXED: Properly handle all appearance modes including pureWhite
  const isDark = useMemo(() => {
    if (settings.appearance === 'system') {
      return systemColorScheme === 'dark';
    }
    if (settings.appearance === 'pureWhite') {
      return false; // pureWhite is explicitly light
    }
    return settings.appearance === 'dark' || settings.appearance === 'trueBlack';
  }, [settings.appearance, systemColorScheme]);

  const isTrueBlack = useMemo(() => settings.appearance === 'trueBlack', [settings.appearance]);
  const isPureWhite = useMemo(() => settings.appearance === 'pureWhite', [settings.appearance]);

  const shouldReduceMotion = useMemo(() => settings.reduceMotion, [settings.reduceMotion]);

  const fontSizeMultiplier = useMemo(() => getFontSizeMultiplier(settings.fontSize), [settings.fontSize]);
  const borderRadiusValue = useMemo(() => getBorderRadiusValue(settings.borderRadius), [settings.borderRadius]);
  const animationDuration = useMemo(() => getAnimationDuration(settings.animationSpeed), [settings.animationSpeed]);

  // ==================== HAPTIC TRIGGER ====================
  const triggerHaptic = useCallback(async (type: HapticType) => {
    if (!settings.hapticFeedback) return;
    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
      }
    } catch {
      // Silently fail on devices without haptics — no console spam
    }
  }, [settings.hapticFeedback]);

  return {
    // Core settings object
    settings,
    isLoaded,
    
    // Derived theme values
    themeColors,
    fullThemeColors,
    avatar,
    isDark,
    isTrueBlack,
    isPureWhite,
    
    // Accessibility/UX
    shouldReduceMotion,
    fontSizeMultiplier,
    borderRadiusValue,
    animationDuration,
    
    // Convenience direct access to common settings (prevents undefined errors)
    hapticFeedback: settings.hapticFeedback,
    soundEffects: settings.soundEffects,
    reduceMotion: settings.reduceMotion,
    compactView: settings.compactSpacing,
    darkMode: isDark,
    useGradients: settings.useGradients,
    useBlur: settings.useBlur,
    showShadows: settings.showShadows,
    highContrast: settings.highContrast,
    boldText: settings.boldText,
    notifications: settings.notifications,
    
    // Actions
    updateSettings,
    reset,
    triggerHaptic,
  };
}

export default useCustomization;
