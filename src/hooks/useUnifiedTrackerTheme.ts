// src/hooks/useUnifiedTrackerTheme.ts
// UNIFIED: Single theme hook for all tracker screens
// Fully synced with useCustomization, SafeAvatar colors, and AppContext
// Production-ready with zero undefined errors

import { useMemo } from 'react';
import { useCustomization, getThemeColorsById, getFullThemeColors } from './useCustomization';
import { useApp } from '../context/AppContext';

export interface UnifiedTrackerTheme {
  // Core identity
  isDark: boolean;
  isTrueBlack: boolean;
  isPureWhite: boolean;
  
  // Brand colors
  primary: string;
  secondary: string;
  accent: string;
  
  // Background gradients
  bgColors: string[];
  
  // Text hierarchy
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  
  // Surface hierarchy (cards, sheets, overlays)
  surface: {
    bg: string;
    border: string;
    card: string;
  };
  
  // Blur & status bar
  blur: 'light' | 'dark';
  statusBar: 'light' | 'dark';
  
  // Accessibility & UX settings (direct passthrough)
  reduceMotion: boolean;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  animationDuration: number;
  hapticFeedback: boolean;
  compactView: boolean;
  useGradients: boolean;
  useBlur: boolean;
  showShadows: boolean;
  highContrast: boolean;
  boldText: boolean;
  
  // Helper: get full theme colors for SafeAvatar
  getFullColors: (themeId?: string) => import('./useCustomization').FullThemeColors;
}

export function useUnifiedTrackerTheme(): UnifiedTrackerTheme {
  const {
    themeColors,
    isDark,
    isTrueBlack,
    isPureWhite,
    shouldReduceMotion,
    fontSizeMultiplier,
    borderRadiusValue,
    animationDuration,
    hapticFeedback,
    compactView,
    useGradients,
    useBlur,
    showShadows,
    highContrast,
    boldText,
  } = useCustomization();

  // App context for navigation-aware theming (optional)
  let appColors = { primary: '#667eea', accent: '#764ba2' };
  let appIsDark = false;
  try {
    const app = useApp();
    appColors = app.colors || appColors;
    appIsDark = app.isDark || false;
  } catch {
    // AppContext not available, use defaults
  }

  return useMemo(() => {
    // Resolve effective dark mode (customization overrides app context)
    const effectiveDark = isDark ?? appIsDark;
    
    // Resolve colors with fallback chain
    const primary = themeColors?.primary || appColors?.primary || '#667eea';
    const secondary = themeColors?.secondary || appColors?.accent || '#764ba2';
    const accent = themeColors?.accent || '#fa709a';
    
    // Background gradients based on theme
    const bgColors = effectiveDark
      ? isTrueBlack
        ? ['#000000', '#0a0a0a', '#0d0d0d']
        : [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
      : isPureWhite
        ? ['#ffffff', '#fafafa', '#f5f5f5']
        : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];
    
    // Text colors with high contrast support
    const textPrimary = effectiveDark
      ? (highContrast ? '#ffffff' : '#f1f5f9')
      : (highContrast ? '#000000' : '#1e293b');
    const textSecondary = effectiveDark
      ? (highContrast ? '#e2e8f0' : '#94a3b8')
      : (highContrast ? '#334155' : '#64748b');
    const textMuted = effectiveDark
      ? (highContrast ? '#cbd5e1' : '#666666')
      : (highContrast ? '#475569' : '#94a3b8');
    
    // Surface colors
    const surfaceBg = effectiveDark
      ? (isTrueBlack ? 'rgba(10,10,10,0.95)' : 'rgba(30,30,40,0.6)')
      : (isPureWhite ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.9)');
    const surfaceBorder = effectiveDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.05)';
    const surfaceCard = effectiveDark
      ? (isTrueBlack ? 'rgba(15,15,15,0.9)' : 'rgba(30,30,40,0.4)')
      : (isPureWhite ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)');

    return {
      isDark: effectiveDark,
      isTrueBlack,
      isPureWhite,
      primary,
      secondary,
      accent,
      bgColors,
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        muted: textMuted,
      },
      surface: {
        bg: surfaceBg,
        border: surfaceBorder,
        card: surfaceCard,
      },
      blur: effectiveDark ? 'dark' : 'light',
      statusBar: effectiveDark ? 'light' : 'dark',
      reduceMotion: shouldReduceMotion,
      fontSizeMultiplier,
      borderRadiusValue,
      animationDuration,
      hapticFeedback,
      compactView,
      useGradients,
      useBlur,
      showShadows,
      highContrast,
      boldText,
      // Helper for SafeAvatar integration
      getFullColors: (themeId?: string) => {
        const id = themeId || themeColors?.primary ? 'custom' : 'purple';
        return getFullThemeColors(id, isDark ? 'dark' : 'light', appIsDark);
      },
    };
  }, [
    isDark, isTrueBlack, isPureWhite, appIsDark, themeColors, appColors,
    shouldReduceMotion, fontSizeMultiplier, borderRadiusValue,
    animationDuration, hapticFeedback, compactView, useGradients,
    useBlur, showShadows, highContrast, boldText,
  ]);
}

export default useUnifiedTrackerTheme;
