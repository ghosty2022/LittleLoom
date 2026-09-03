// src/hooks/useUnifiedTrackerTheme.ts
// FIX: Use direct imports, not useSafeContexts

import { useMemo } from 'react';
import { useCustomization } from './useCustomization';
import { useApp } from '../context/AppContext';

export interface UnifiedTrackerTheme {
  isDark: boolean;
  isTrueBlack: boolean;
  isPureWhite: boolean;
  
  primary: string;
  secondary: string;
  accent: string;
  
  bgColors: string[];
  
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  
  surface: {
    bg: string;
    border: string;
    card: string;
  };
  
  blur: 'light' | 'dark';
  statusBar: 'light' | 'dark';
  
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

  let appColors = { primary: '#667eea', accent: '#764ba2' };
  let appIsDark = false;
  try {
    const app = useApp();
    appColors = app.colors || appColors;
    appIsDark = app.isDark || false;
  } catch {
  }

  return useMemo(() => {
    const effectiveDark = isDark ?? appIsDark;
    
    const primary = themeColors?.primary || appColors?.primary || '#667eea';
    const secondary = themeColors?.secondary || appColors?.accent || '#764ba2';
    const accent = themeColors?.accent || '#fa709a';
    
    const bgColors = effectiveDark
      ? isTrueBlack
        ? ['#000000', '#0a0a0a', '#0d0d0d']
        : [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
      : isPureWhite
        ? ['#ffffff', '#fafafa', '#f5f5f5']
        : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];
    
    const textPrimary = effectiveDark
      ? (highContrast ? '#ffffff' : '#f1f5f9')
      : (highContrast ? '#000000' : '#1e293b');
    const textSecondary = effectiveDark
      ? (highContrast ? '#e2e8f0' : '#94a3b8')
      : (highContrast ? '#334155' : '#64748b');
    const textMuted = effectiveDark
      ? (highContrast ? '#cbd5e1' : '#666666')
      : (highContrast ? '#475569' : '#94a3b8');
    
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
      getFullColors: (themeId?: string) => {
// Guard: if getFullThemeColors is not available from useCustomization,
// return a minimal safe fallback instead of crashing.
const id = themeId || (themeColors?.primary ? 'custom' : 'purple');
try {
// Dynamic require to avoid hard dependency on potentially missing export
const { getFullThemeColors } = require('./useCustomization');
if (getFullThemeColors) {
return getFullThemeColors(id, isDark ? 'dark' : 'light', appIsDark);
}
} catch {
// Fallback minimal theme if useCustomization doesn't export this
}
return {
background: isDark ? '#0f0f1e' : '#f8faff',
surface: isDark ? 'rgba(30,30,40,0.6)' : 'rgba(255,255,255,0.9)',
text: isDark ? '#f1f5f9' : '#1e293b',
textSecondary: isDark ? '#94a3b8' : '#64748b',
border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
primary: themeColors?.primary || '#667eea',
error: '#ef4444',
success: '#10b981',
warning: '#f59e0b',
info: '#3b82f6',
glassBg: isDark ? 'rgba(30,30,40,0.4)' : 'rgba(255,255,255,0.5)',
} as any;
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
