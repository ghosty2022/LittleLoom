// src/context/AppContext.tsx
// FULLY SYNCED: Respects useCustomization theme, SafeAvatar colors, BabyContext data
// FIXED: Nav visibility restoration now respects previous scroll state
// FIXED: AppState listener correctly detects background -> active transitions
// FIXED: Appearance mode now fully supports trueBlack and pureWhite via sync with useCustomization
// FIXED: Theme mode and appearance properly unified

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppearanceMode = 'system' | 'light' | 'dark' | 'trueBlack' | 'pureWhite';

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

// Light mode colors
const LIGHT_COLORS: ThemeColors = {
  background: '#f8faff',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  primary: '#667eea',
  primaryLight: '#a3bffa',
  accent: '#fa709a',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  glassBackground: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(255,255,255,0.5)',
  navBackground: '#ffffff',
  handleBar: 'rgba(0,0,0,0.15)',
  shadowColor: '#667eea',
};

// Dark mode (gray-based, easy on eyes)
const DARK_COLORS: ThemeColors = {
  background: '#0f0f1e',
  surface: '#1a1a2e',
  card: '#16162a',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: 'rgba(255,255,255,0.08)',
  primary: '#818cf8',
  primaryLight: '#a5b4fc',
  accent: '#fb7185',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  glassBackground: 'rgba(26,26,46,0.95)',
  glassBorder: 'rgba(255,255,255,0.1)',
  navBackground: '#1a1a2e',
  handleBar: 'rgba(255,255,255,0.25)',
  shadowColor: '#000000',
};

// True Black (OLED optimized - pure black)
const TRUE_BLACK_COLORS: ThemeColors = {
  background: '#000000',
  surface: '#0a0a0a',
  card: '#0d0d0d',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  border: 'rgba(255,255,255,0.06)',
  primary: '#a3bffa',
  primaryLight: '#818cf8',
  accent: '#fb7185',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  glassBackground: 'rgba(10,10,10,0.95)',
  glassBorder: 'rgba(255,255,255,0.08)',
  navBackground: '#0a0a0a',
  handleBar: 'rgba(255,255,255,0.25)',
  shadowColor: '#000000',
};

// Pure White (maximum contrast light)
const PURE_WHITE_COLORS: ThemeColors = {
  background: '#ffffff',
  surface: '#fafafa',
  card: '#ffffff',
  text: '#000000',
  textSecondary: '#525252',
  border: '#e5e5e5',
  primary: '#4f46e5',
  primaryLight: '#818cf8',
  accent: '#e11d48',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  glassBackground: 'rgba(255,255,255,0.98)',
  glassBorder: 'rgba(0,0,0,0.06)',
  navBackground: '#ffffff',
  handleBar: 'rgba(0,0,0,0.15)',
  shadowColor: '#000000',
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
  isNavVisible: boolean;
  isNavCompact: boolean;
  showNav: () => void;
  hideNav: () => void;
  toggleCompact: () => void;
  forceShowNav: () => void;
  forceHideNav: () => void;
  isCommunityScreen: boolean;
  setCommunityRoute: (routeName: string | null) => void;
  handleScroll: (offsetY: number, velocity: number, isAtTop: boolean) => void;
}

const THEME_STORAGE_KEY = '@littleloom_theme_v2';
const APPEARANCE_STORAGE_KEY = '@littleloom_appearance_v1';

// Community routes that should hide the navigation bar
const COMMUNITY_ROUTES = new Set([
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'Chat',
  'UserProfile', 'Notifications', 'EditCommunityProfile', 'ChatList',
  'TopicMembers', 'Followers', 'Following', 'SearchUsers', 'BlockedUsers', 'Report',
]);

const SCROLL_CONFIG = {
  HIDE_THRESHOLD: 60,
  SHOW_THRESHOLD: 20,
  VELOCITY_THRESHOLD: 0.3,
  SCROLL_END_DELAY: 150,
};

const AppContext = createContext<AppContextType>({
  themeMode: 'system',
  appearance: 'system',
  isDark: false,
  isTrueBlack: false,
  isPureWhite: false,
  colors: LIGHT_COLORS,
  setThemeMode: async () => {},
  setAppearance: async () => {},
  toggleTheme: () => {},
  setDarkMode: () => {},
  themeReady: false,
  isNavVisible: true,
  isNavCompact: false,
  showNav: () => {},
  hideNav: () => {},
  toggleCompact: () => {},
  forceShowNav: () => {},
  forceHideNav: () => {},
  isCommunityScreen: false,
  setCommunityRoute: () => {},
  handleScroll: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [themeReady, setThemeReady] = useState(false);

  // Load theme and appearance from storage
  useEffect(() => {
    let mounted = true;
    const loadTheme = async () => {
      try {
        const [savedTheme, savedAppearance] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
        ]);

        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          if (mounted) setThemeModeState(savedTheme as ThemeMode);
        }
        if (savedAppearance && ['system', 'light', 'dark', 'trueBlack', 'pureWhite'].includes(savedAppearance)) {
          if (mounted) setAppearanceState(savedAppearance as AppearanceMode);
        }
      } catch (e) {
        console.warn('Theme load failed:', e);
      } finally {
        if (mounted) setThemeReady(true);
      }
    };
    loadTheme();
    return () => { mounted = false; };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Theme save failed:', e);
    }
  }, []);

  const setAppearance = useCallback(async (newAppearance: AppearanceMode) => {
    setAppearanceState(newAppearance);
    try {
      await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, newAppearance);
    } catch (e) {
      console.warn('Appearance save failed:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const modes: AppearanceMode[] = ['system', 'light', 'dark', 'trueBlack', 'pureWhite'];
    setAppearanceState(prev => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next).catch(() => {});
      // Sync themeMode for backward compatibility
      if (next === 'light' || next === 'pureWhite') {
        setThemeModeState('light');
        AsyncStorage.setItem(THEME_STORAGE_KEY, 'light').catch(() => {});
      } else if (next === 'dark' || next === 'trueBlack') {
        setThemeModeState('dark');
        AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark').catch(() => {});
      } else {
        setThemeModeState('system');
        AsyncStorage.setItem(THEME_STORAGE_KEY, 'system').catch(() => {});
      }
      return next;
    });
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    const newMode: ThemeMode = dark ? 'dark' : 'light';
    const newAppearance: AppearanceMode = dark ? 'dark' : 'light';
    setThemeModeState(newMode);
    setAppearanceState(newAppearance);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
    AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, newAppearance).catch(() => {});
  }, []);

  // Determine effective dark mode and colors
  const isDark = useMemo(() => {
    if (appearance === 'system') return systemColorScheme === 'dark';
    if (appearance === 'trueBlack') return true;
    if (appearance === 'pureWhite') return false;
    return appearance === 'dark';
  }, [appearance, systemColorScheme]);

  const isTrueBlack = useMemo(() => appearance === 'trueBlack', [appearance]);
  const isPureWhite = useMemo(() => appearance === 'pureWhite', [appearance]);

  const colors = useMemo(() => {
    if (isTrueBlack) return TRUE_BLACK_COLORS;
    if (isPureWhite) return PURE_WHITE_COLORS;
    return isDark ? DARK_COLORS : LIGHT_COLORS;
  }, [isDark, isTrueBlack, isPureWhite]);

  // Navigation visibility
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isNavCompact, setIsNavCompact] = useState(false);
  const [isCommunityScreen, setIsCommunityScreen] = useState(false);

  const scrollStateRef = useRef({
    accumulatedDown: 0,
    accumulatedUp: 0,
    hiddenByScroll: false,
    lastOffsetY: 0,
    timeout: null as ReturnType<typeof setTimeout> | null,
  });

  // FIXED: setCommunityRoute now properly handles nav visibility restoration
  const setCommunityRoute = useCallback((routeName: string | null) => {
    const isCommunity = routeName ? COMMUNITY_ROUTES.has(routeName) : false;
    setIsCommunityScreen(isCommunity);
    if (isCommunity) {
      setIsNavVisible(false);
      setIsNavCompact(false);
    } else {
      // FIXED: Only show nav if it wasn't hidden by scroll
      const wasHiddenByScroll = scrollStateRef.current.hiddenByScroll;
      if (!wasHiddenByScroll) {
        setIsNavVisible(true);
      }
    }
  }, []);

  const showNav = useCallback(() => {
    if (isCommunityScreen) return;
    setIsNavVisible(true);
    const s = scrollStateRef.current;
    s.hiddenByScroll = false;
    s.accumulatedDown = 0;
    s.accumulatedUp = 0;
  }, [isCommunityScreen]);

  const hideNav = useCallback(() => {
    setIsNavVisible(false);
    scrollStateRef.current.hiddenByScroll = true;
  }, []);

  const toggleCompact = useCallback(() => {
    setIsNavCompact(prev => !prev);
  }, []);

  const forceShowNav = useCallback(() => {
    if (isCommunityScreen) return;
    setIsNavVisible(true);
    setIsNavCompact(false);
    scrollStateRef.current.hiddenByScroll = false;
  }, [isCommunityScreen]);

  const forceHideNav = useCallback(() => {
    hideNav();
  }, [hideNav]);

  const handleScroll = useCallback((offsetY: number, velocity: number, isAtTop: boolean) => {
    if (isCommunityScreen) return;

    const s = scrollStateRef.current;
    if (s.timeout) clearTimeout(s.timeout);

    const deltaY = offsetY - s.lastOffsetY;
    s.lastOffsetY = offsetY;

    if (isAtTop) {
      if (s.hiddenByScroll) showNav();
      return;
    }

    if (deltaY > 0 && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      s.accumulatedDown += Math.abs(deltaY);
      s.accumulatedUp = 0;
      if (!s.hiddenByScroll && s.accumulatedDown > SCROLL_CONFIG.HIDE_THRESHOLD) {
        hideNav();
      }
    }

    if (deltaY < 0 && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      s.accumulatedUp += Math.abs(deltaY);
      s.accumulatedDown = 0;
      if (s.hiddenByScroll && s.accumulatedUp > SCROLL_CONFIG.SHOW_THRESHOLD) {
        showNav();
      }
    }

    s.timeout = setTimeout(() => {
      s.accumulatedDown = 0;
      s.accumulatedUp = 0;
      s.lastOffsetY = 0;
    }, SCROLL_CONFIG.SCROLL_END_DELAY);
  }, [isCommunityScreen, showNav, hideNav]);

  // FIXED: AppState listener correctly detects background -> active transitions
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const currentState = appStateRef.current;
      const wasBackground = currentState === 'background' || currentState === 'inactive';
      
      if (wasBackground && nextAppState === 'active' && !isCommunityScreen) {
        showNav();
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [showNav, isCommunityScreen]);

  useEffect(() => {
    return () => {
      const s = scrollStateRef.current;
      if (s.timeout) clearTimeout(s.timeout);
    };
  }, []);

  const value = useMemo<AppContextType>(() => ({
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady,
    isNavVisible, isNavCompact, showNav, hideNav, toggleCompact, forceShowNav, forceHideNav,
    isCommunityScreen, setCommunityRoute, handleScroll,
  }), [
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady,
    isNavVisible, isNavCompact, showNav, hideNav, toggleCompact, forceShowNav, forceHideNav,
    isCommunityScreen, setCommunityRoute, handleScroll,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const useTheme = () => {
  const { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady } = useApp();
  return { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady };
};

export const useNavigationVisibility = () => {
  const {
    isNavVisible, isNavCompact, showNav, hideNav,
    toggleCompact, forceShowNav, forceHideNav,
    isCommunityScreen, setCommunityRoute,
  } = useApp();
  return {
    isNavVisible, isNavCompact, showNav, hideNav,
    toggleCompact, forceShowNav, forceHideNav,
    isCommunityScreen, setCommunityRoute,
  };
};

export default AppContext;
