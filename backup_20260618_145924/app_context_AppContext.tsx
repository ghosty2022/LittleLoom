import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
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
  isNavVisible: boolean;
  showNav: () => void;
  hideNav: () => void;
  forceShowNav: () => void;
  forceHideNav: () => void;
  isCommunityScreen: boolean;
  setCommunityRoute: (routeName: string | null) => void;
  setCommunityScreen: (isCommunity: boolean) => void;
  handleScroll: (offsetY: number, velocity: number, isAtTop: boolean) => void;
}

const THEME_STORAGE_KEY = '@littleloom_theme_v2';
const APPEARANCE_STORAGE_KEY = '@littleloom_appearance_v1';
const NAV_VISIBILITY_KEY = '@littleloom_nav_visible_v1';

const COMMUNITY_ROUTES = new Set([
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'Chat',
  'CommunityMemberProfile', 'Notifications', 'CommunityProfile', 'ChatList',
  'TopicMembers', 'Followers', 'Following', 'SearchUsers', 'BlockedUsers', 'Report',
]);

const SCROLL_CONFIG = {
  HIDE_THRESHOLD: 50,
  SHOW_THRESHOLD: 15,
  VELOCITY_THRESHOLD: 0.25,
  SCROLL_END_DELAY: 120,
};

// ─── STATIC CACHE: Survives re-renders, read once ─────────────────────
let _cachedAppearance: AppearanceMode | null = null;
let _cachedThemeMode: ThemeMode | null = null;
let _themeLoaded = false;

const AppContext = createContext<AppContextType>({
  themeMode: 'system', appearance: 'system', isDark: false,
  isTrueBlack: false, isPureWhite: false, colors: LIGHT_COLORS,
  setThemeMode: async () => {}, setAppearance: async () => {},
  toggleTheme: () => {}, setDarkMode: () => {}, themeReady: false,
  isNavVisible: true, showNav: () => {}, hideNav: () => {},
  forceShowNav: () => {}, forceHideNav: () => {},
  isCommunityScreen: false, setCommunityRoute: () => {},
  setCommunityScreen: () => {}, handleScroll: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const customization = useCustomization();

  // ─── FIX #1: Single state for theme, no isThemeLoaded flag ───────────
  // Use cached values immediately, update async in background
  const [themeMode, setThemeModeState] = useState<ThemeMode>(_cachedThemeMode ?? 'system');
  const [appearance, setAppearanceState] = useState<AppearanceMode>(_cachedAppearance ?? 'system');
  const [themeReady, setThemeReady] = useState(_themeLoaded);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isCommunityScreen, setIsCommunityScreen] = useState(false);

  // ─── FIX #2: Single effect loads theme ONCE, parallel with customization ─
  useEffect(() => {
    if (_themeLoaded) return; // Already loaded

    let mounted = true;
    const load = async () => {
      try {
        const [savedTheme, savedAppearance, savedNavVis] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
          AsyncStorage.getItem(NAV_VISIBILITY_KEY),
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

        if (savedNavVis !== null) setIsNavVisible(savedNavVis === 'true');
      } catch (e) {
        console.warn('Theme load failed:', e);
        _themeLoaded = true;
        if (mounted) setThemeReady(true);
      }
    };

    load();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── FIX #3: Sync with customization ONLY when it changes ─────────────
  useEffect(() => {
    if (!customization.isLoaded || !_themeLoaded) return;
    const customApp = customization.settings.appearance;
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
    customization.updateSettings({ appearance: newAppearance });
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

  // ─── FIX #4: Direct computation, no effectiveAppearance useMemo ─────
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

  // ─── NAV VISIBILITY: Simplified, no scrollStateRef on every render ────
  const scrollRef = useRef({
    accDown: 0, accUp: 0, hidden: false, lastY: 0, timer: null as ReturnType<typeof setTimeout> | null,
  });

  const showNav = useCallback(() => {
    if (isCommunityScreen) return;
    setIsNavVisible(true);
    const s = scrollRef.current;
    s.hidden = false; s.accDown = 0; s.accUp = 0;
    AsyncStorage.setItem(NAV_VISIBILITY_KEY, 'true').catch(() => {});
  }, [isCommunityScreen]);

  const hideNav = useCallback(() => {
    setIsNavVisible(false);
    scrollRef.current.hidden = true;
    AsyncStorage.setItem(NAV_VISIBILITY_KEY, 'false').catch(() => {});
  }, []);

  const forceShowNav = useCallback(() => {
    if (isCommunityScreen) return;
    setIsNavVisible(true);
    scrollRef.current.hidden = false;
    AsyncStorage.setItem(NAV_VISIBILITY_KEY, 'true').catch(() => {});
  }, [isCommunityScreen]);

  const forceHideNav = useCallback(() => hideNav(), [hideNav]);

  // ─── FIX #5: Unified community setter ─────────────────────────────────
  const setCommunityRoute = useCallback((routeName: string | null) => {
    const isComm = routeName ? COMMUNITY_ROUTES.has(routeName) : false;
    setIsCommunityScreen(isComm);
    setIsNavVisible(!isComm && !scrollRef.current.hidden);
  }, []);

  const setCommunityScreen = useCallback((isComm: boolean) => {
    setIsCommunityScreen(isComm);
    setIsNavVisible(!isComm && !scrollRef.current.hidden);
  }, []);

  const handleScroll = useCallback((offsetY: number, velocity: number, isAtTop: boolean) => {
    if (isCommunityScreen) return;
    const s = scrollRef.current;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }

    const delta = offsetY - s.lastY;
    s.lastY = offsetY;

    if (isAtTop) { if (s.hidden) showNav(); return; }

    if (delta > 0 && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      s.accDown += Math.abs(delta); s.accUp = 0;
      if (!s.hidden && s.accDown > SCROLL_CONFIG.HIDE_THRESHOLD) hideNav();
    }
    if (delta < 0 && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      s.accUp += Math.abs(delta); s.accDown = 0;
      if (s.hidden && s.accUp > SCROLL_CONFIG.SHOW_THRESHOLD) showNav();
    }

    s.timer = setTimeout(() => { s.accDown = 0; s.accUp = 0; s.lastY = 0; s.timer = null; }, SCROLL_CONFIG.SCROLL_END_DELAY);
  }, [isCommunityScreen, showNav, hideNav]);

  // ─── FIX #6: Stable AppState listener, no re-attachment ────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBg = AppState.currentState === 'background' || AppState.currentState === 'inactive';
      if (wasBg && next === 'active' && !isCommunityScreen) {
        showNav();
      }
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup scroll timer
  useEffect(() => () => {
    const t = scrollRef.current.timer;
    if (t) clearTimeout(t);
  }, []);

  // ─── FIX #7: Minimal value object, stable references ────────────────────
  const value = useMemo(() => ({
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady,
    isNavVisible, showNav, hideNav, forceShowNav, forceHideNav,
    isCommunityScreen, setCommunityRoute, setCommunityScreen, handleScroll,
  }), [
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, themeReady,
    isNavVisible, isCommunityScreen,
    setThemeMode, setAppearance, toggleTheme, setDarkMode,
    showNav, hideNav, forceShowNav, forceHideNav,
    setCommunityRoute, setCommunityScreen, handleScroll,
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

export const useNavigationVisibility = () => {
  const { isNavVisible, showNav, hideNav, forceShowNav, forceHideNav, isCommunityScreen, setCommunityRoute, setCommunityScreen } = useApp();
  return { isNavVisible, showNav, hideNav, forceShowNav, forceHideNav, isCommunityScreen, setCommunityRoute, setCommunityScreen };
};

export default AppContext;