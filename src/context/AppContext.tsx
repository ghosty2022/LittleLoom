// src/context/AppContext.ts
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useColorScheme, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomization, AppearanceMode } from '../hooks/useCustomization';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  glassBackground: string;
  glassBorder: string;
  navBackground: string;
  handleBar: string;
  shadowColor: string;
}

const LIGHT_COLORS: ThemeColors = {
  background: '#f8faff', surface: '#ffffff', card: '#ffffff',
  text: '#1a1a1a', textSecondary: '#64748b', border: '#e2e8f0',
  primary: '#667eea', primaryLight: '#a3bffa', accent: '#fa709a',
  success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
  glassBackground: 'rgba(255,255,255,0.95)', glassBorder: 'rgba(255,255,255,0.5)',
  navBackground: '#ffffff', handleBar: 'rgba(0,0,0,0.15)', shadowColor: '#667eea',
};

const DARK_COLORS: ThemeColors = {
  background: '#0f0f1e', surface: '#1a1a2e', card: '#16162a',
  text: '#f1f5f9', textSecondary: '#94a3b8', border: 'rgba(255,255,255,0.08)',
  primary: '#818cf8', primaryLight: '#a5b4fc', accent: '#fb7185',
  success: '#4ade80', warning: '#fbbf24', error: '#f87171',
  glassBackground: 'rgba(26,26,46,0.95)', glassBorder: 'rgba(255,255,255,0.1)',
  navBackground: '#1a1a2e', handleBar: 'rgba(255,255,255,0.25)', shadowColor: '#000000',
};

const TRUE_BLACK_COLORS: ThemeColors = {
  background: '#000000', surface: '#0a0a0a', card: '#0d0d0d',
  text: '#ffffff', textSecondary: '#a0a0b0', border: 'rgba(255,255,255,0.06)',
  primary: '#a3bffa', primaryLight: '#818cf8', accent: '#fb7185',
  success: '#4ade80', warning: '#fbbf24', error: '#f87171',
  glassBackground: 'rgba(10,10,10,0.95)', glassBorder: 'rgba(255,255,255,0.08)',
  navBackground: '#0a0a0a', handleBar: 'rgba(255,255,255,0.25)', shadowColor: '#000000',
};

const PURE_WHITE_COLORS: ThemeColors = {
  background: '#ffffff', surface: '#fafafa', card: '#ffffff',
  text: '#000000', textSecondary: '#525252', border: '#e5e5e5',
  primary: '#4f46e5', primaryLight: '#818cf8', accent: '#e11d48',
  success: '#16a34a', warning: '#d97706', error: '#dc2626',
  glassBackground: 'rgba(255,255,255,0.98)', glassBorder: 'rgba(0,0,0,0.06)',
  navBackground: '#ffffff', handleBar: 'rgba(0,0,0,0.15)', shadowColor: '#000000',
};

export interface AppContextType {
  themeMode: ThemeMode;
  appearance: AppearanceMode;
  isDark: boolean;
  isTrueBlack: boolean;
  isPureWhite: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAppearance: (appearance: AppearanceMode) => Promise<void>;
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
  themeReady: boolean;
  isCommunityScreen: boolean;
  setCommunityScreen: (isCommunity: boolean) => void;
}

const THEME_STORAGE_KEY = '@littleloom_theme_v2';
const APPEARANCE_STORAGE_KEY = '@littleloom_appearance_v1';

// ─── STATIC CACHE: Survives re-renders, read once ─────────────────────
let _cachedAppearance: AppearanceMode | null = null;
let _cachedThemeMode: ThemeMode | null = null;
let _themeLoaded = false;

const AppContext = createContext<AppContextType>({
  themeMode: 'system', appearance: 'system', isDark: false,
  isTrueBlack: false, isPureWhite: false, colors: LIGHT_COLORS,
  setThemeMode: async () => {}, setAppearance: async () => {},
  toggleTheme: () => {}, setDarkMode: () => {}, themeReady: false,
  isCommunityScreen: false, setCommunityScreen: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const customization = useCustomization();

  const [themeMode, setThemeModeState] = useState<ThemeMode>(_cachedThemeMode ?? 'system');
  const [appearance, setAppearanceState] = useState<AppearanceMode>(_cachedAppearance ?? 'system');
  const [themeReady, setThemeReady] = useState(_themeLoaded);
  const [isCommunityScreen, setIsCommunityScreen] = useState(false);

  // ─── Load theme once on mount ──────────────────────────────────────
  useEffect(() => {
    if (_themeLoaded) return;

    let mounted = true;
    const load = async () => {
      try {
        const [savedTheme, savedAppearance] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
        ]);

        if (!mounted) return;

        const finalAppearance = (savedAppearance && ['system','light','dark','trueBlack','pureWhite'].includes(savedAppearance))
          ? savedAppearance as AppearanceMode
          : customization.settings.appearance ?? 'system';

        const finalThemeMode = (savedTheme && ['light','dark','system'].includes(savedTheme))
          ? savedTheme as ThemeMode
          : (finalAppearance === 'light' || finalAppearance === 'pureWhite') ? 'light'
          : (finalAppearance === 'dark' || finalAppearance === 'trueBlack') ? 'dark'
          : 'system';

        _cachedAppearance = finalAppearance;
        _cachedThemeMode = finalThemeMode;
        _themeLoaded = true;

        setAppearanceState(finalAppearance);
        setThemeModeState(finalThemeMode);
        setThemeReady(true);
      } catch (e) {
        console.warn('Theme load failed:', e);
        _themeLoaded = true;
        if (mounted) setThemeReady(true);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  // ─── Sync with customization when it changes ───────────────────────
  useEffect(() => {
    if (!customization?.isLoaded || !_themeLoaded) return;
    const customApp = customization.settings?.appearance;
    if (customApp && customApp !== _cachedAppearance) {
      _cachedAppearance = customApp;
      setAppearanceState(customApp);

      const newMode: ThemeMode = (customApp === 'light' || customApp === 'pureWhite') ? 'light'
        : (customApp === 'dark' || customApp === 'trueBlack') ? 'dark' : 'system';
      _cachedThemeMode = newMode;
      setThemeModeState(newMode);

      AsyncStorage.multiSet([
        [APPEARANCE_STORAGE_KEY, customApp],
        [THEME_STORAGE_KEY, newMode],
      ]).catch(() => {});
    }
  }, [customization.isLoaded, customization.settings.appearance]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    _cachedThemeMode = mode;
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const setAppearance = useCallback(async (newAppearance: AppearanceMode) => {
    setAppearanceState(newAppearance);
    _cachedAppearance = newAppearance;
    customization?.updateSettings?.({ appearance: newAppearance });
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, newAppearance).catch(() => {});
  }, [customization]);

  const toggleTheme = useCallback(() => {
    const modes: AppearanceMode[] = ['system', 'light', 'dark', 'trueBlack', 'pureWhite'];
    setAppearanceState(prev => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      _cachedAppearance = next;
      const nextTheme: ThemeMode = (next === 'light' || next === 'pureWhite') ? 'light'
        : (next === 'dark' || next === 'trueBlack') ? 'dark' : 'system';
      _cachedThemeMode = nextTheme;
      setThemeModeState(nextTheme);
      AsyncStorage.multiSet([
        [APPEARANCE_STORAGE_KEY, next],
        [THEME_STORAGE_KEY, nextTheme],
      ]).catch(() => {});
      customization.updateSettings({ appearance: next });
      return next;
    });
  }, [customization]);

  const setDarkMode = useCallback((dark: boolean) => {
    const newMode: ThemeMode = dark ? 'dark' : 'light';
    const newAppearance: AppearanceMode = dark ? 'dark' : 'light';
    setThemeModeState(newMode);
    setAppearanceState(newAppearance);
    _cachedThemeMode = newMode;
    _cachedAppearance = newAppearance;
    customization.updateSettings({ appearance: newAppearance });
    AsyncStorage.multiSet([
      [THEME_STORAGE_KEY, newMode],
      [APPEARANCE_STORAGE_KEY, newAppearance],
    ]).catch(() => {});
  }, [customization]);

  const isDark = useMemo(() => {
    if (appearance === 'system') return systemColorScheme === 'dark';
    if (appearance === 'trueBlack') return true;
    if (appearance === 'pureWhite') return false;
    return appearance === 'dark';
  }, [appearance, systemColorScheme]);

  const isTrueBlack = appearance === 'trueBlack';
  const isPureWhite = appearance === 'pureWhite';

  const colors = useMemo(() => {
    if (isTrueBlack) return TRUE_BLACK_COLORS;
    if (isPureWhite) return PURE_WHITE_COLORS;
    return isDark ? DARK_COLORS : LIGHT_COLORS;
  }, [isDark, isTrueBlack, isPureWhite]);

  const setCommunityScreen = useCallback((isComm: boolean) => {
    setIsCommunityScreen(isComm);
  }, []);

  // ─── Stable value object ───────────────────────────────────────────
  const value = useMemo(() => ({
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady,
    isCommunityScreen, setCommunityScreen,
  }), [
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, themeReady,
    isCommunityScreen,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, setCommunityScreen,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const useTheme = () => {
  const { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady } = useApp();
  return { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady };
};

export default AppContext;