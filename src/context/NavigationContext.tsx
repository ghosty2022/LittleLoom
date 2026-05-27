// src/context/NavigationContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { useNavigationState } from '@react-navigation/native';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useScrollHandlerRegistration,
  ScrollState,
} from '../utils/GlobalScrollPatch';

// ============================================
// THEME CONFIGURATION
// ============================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
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
  background: '#f8faff',
  card: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  primary: '#667eea',
  primaryLight: '#a3bffa',
  accent: '#fa709a',
  success: '#11998e',
  warning: '#f59e0b',
  error: '#ef4444',
  glassBackground: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(255,255,255,0.5)',
  navBackground: '#ffffff',
  handleBar: 'rgba(0,0,0,0.15)',
  shadowColor: '#667eea',
};

const DARK_COLORS: ThemeColors = {
  background: '#000000',
  card: '#0a0a0a',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  border: '#1a1a1a',
  primary: '#a3bffa',
  primaryLight: '#667eea',
  accent: '#fa709a',
  success: '#38ef7d',
  warning: '#fbbf24',
  error: '#f87171',
  glassBackground: 'rgba(25,25,25,0.9)',
  glassBorder: 'rgba(255,255,255,0.1)',
  navBackground: '#0a0a0a',
  handleBar: 'rgba(255,255,255,0.25)',
  shadowColor: '#000000',
};

const THEME_STORAGE_KEY = '@littleloom_theme_preference_v1';

// ============================================
// NAVIGATION CONTEXT TYPES
// ============================================

interface NavigationContextType {
  // Nav visibility
  isNavVisible: boolean;
  isNavCompact: boolean;
  showNav: () => void;
  hideNav: () => void;
  toggleCompact: () => void;
  isCommunityScreen: boolean;
  forceShowNav: () => void;
  forceHideNav: () => void;

  // Theme
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// ============================================
// CONTEXT
// ============================================

const NavigationContext = createContext<NavigationContextType>({
  isNavVisible: true,
  isNavCompact: false,
  showNav: () => {},
  hideNav: () => {},
  toggleCompact: () => {},
  isCommunityScreen: false,
  forceShowNav: () => {},
  forceHideNav: () => {},

  themeMode: 'system',
  isDark: false,
  colors: LIGHT_COLORS,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

// ============================================
// SCROLL CONFIGURATION
// ============================================

const SCROLL_CONFIG = {
  HIDE_THRESHOLD: 60,
  SHOW_THRESHOLD: 20,
  VELOCITY_THRESHOLD: 0.3,
  SCROLL_END_DELAY: 150,
};

// ============================================
// THEME RESOLVER
// ============================================

const resolveTheme = (mode: ThemeMode, systemScheme: 'light' | 'dark' | null): boolean => {
  if (mode === 'system') {
    return systemScheme === 'dark';
  }
  return mode === 'dark';
};

// ============================================
// PROVIDER
// ============================================

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();

  // ==================== THEME STATE ====================
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      } finally {
        setThemeLoaded(true);
      }
    };
    loadTheme();
  }, []);

  // Persist theme preference
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, []);

  // Toggle between light/dark/system (cycles through all three)
  const toggleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setThemeMode(nextMode);
  }, [themeMode, setThemeMode]);

  // Resolved dark mode state (respects system theme when in 'system' mode)
  const isDark = useMemo(
    () => resolveTheme(themeMode, systemColorScheme),
    [themeMode, systemColorScheme]
  );

  // Current color palette
  const colors = useMemo(
    () => (isDark ? DARK_COLORS : LIGHT_COLORS),
    [isDark]
  );

  // ==================== NAV VISIBILITY STATE ====================
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isNavCompact, setIsNavCompact] = useState(false);
  const [isCommunityScreen, setIsCommunityScreen] = useState(false);

  const accumulatedScrollDown = useRef(0);
  const accumulatedScrollUp = useRef(0);
  const isNavHiddenByScroll = useRef(false);
  const scrollEndTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastOffsetY = useRef(0);

  // Detect community screens
  const routeNames = useNavigationState(state => state?.routes?.map(r => r.name) || []);
  useEffect(() => {
    const communityRoutes = [
      'CommunityMain', 'Topic', 'CreatePost', 'PostDetail',
      'Chat', 'UserProfile', 'Notifications', 'EditCommunityProfile',
      'ChatList', 'TopicMembers', 'Followers', 'Following',
      'SearchUsers', 'BlockedUsers', 'Report'
    ];
    const isCommunity = routeNames.some(name => communityRoutes.includes(name));
    setIsCommunityScreen(isCommunity);
  }, [routeNames]);

  const showNav = useCallback(() => {
    setIsNavVisible(true);
    isNavHiddenByScroll.current = false;
    accumulatedScrollDown.current = 0;
    accumulatedScrollUp.current = 0;
  }, []);

  const hideNav = useCallback(() => {
    setIsNavVisible(false);
    isNavHiddenByScroll.current = true;
  }, []);

  const toggleCompact = useCallback(() => {
    setIsNavCompact(prev => !prev);
  }, []);

  const forceShowNav = useCallback(() => {
    showNav();
    setIsNavCompact(false);
  }, [showNav]);

  const forceHideNav = useCallback(() => {
    hideNav();
  }, [hideNav]);

  // ==================== GLOBAL SCROLL HANDLER ====================
  const handleGlobalScroll = useCallback((event: any, state: ScrollState) => {
    if (isCommunityScreen) return;

    if (scrollEndTimeout.current) {
      clearTimeout(scrollEndTimeout.current);
    }

    const { direction, offsetY, velocity, isAtTop } = state;
    const deltaY = offsetY - lastOffsetY.current;
    lastOffsetY.current = offsetY;

    // At top — always show
    if (isAtTop) {
      if (isNavHiddenByScroll.current) {
        showNav();
      }
      return;
    }

    // Scrolling down — hide when threshold reached
    if (direction === 'down' && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      accumulatedScrollDown.current += Math.abs(deltaY);
      accumulatedScrollUp.current = 0;

      if (!isNavHiddenByScroll.current && accumulatedScrollDown.current > SCROLL_CONFIG.HIDE_THRESHOLD) {
        hideNav();
      }
    }

    // Scrolling up — show immediately
    if (direction === 'up' && velocity > SCROLL_CONFIG.VELOCITY_THRESHOLD) {
      accumulatedScrollUp.current += Math.abs(deltaY);
      accumulatedScrollDown.current = 0;

      if (isNavHiddenByScroll.current && accumulatedScrollUp.current > SCROLL_CONFIG.SHOW_THRESHOLD) {
        showNav();
      }
    }

    // Reset after scroll ends
    scrollEndTimeout.current = setTimeout(() => {
      accumulatedScrollDown.current = 0;
      accumulatedScrollUp.current = 0;
      lastOffsetY.current = 0;
    }, SCROLL_CONFIG.SCROLL_END_DELAY);
  }, [isCommunityScreen, showNav, hideNav]);

  useScrollHandlerRegistration(handleGlobalScroll);

  useEffect(() => {
    return () => {
      if (scrollEndTimeout.current) {
        clearTimeout(scrollEndTimeout.current);
      }
    };
  }, []);

  // ==================== APP STATE HANDLING ====================
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // When returning from background, ensure nav is visible
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        showNav();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [showNav]);

  const value = useMemo(() => ({
    // Nav
    isNavVisible,
    isNavCompact,
    showNav,
    hideNav,
    toggleCompact,
    isCommunityScreen,
    forceShowNav,
    forceHideNav,

    // Theme
    themeMode,
    isDark,
    colors,
    setThemeMode,
    toggleTheme,
  }), [
    isNavVisible, isNavCompact, isCommunityScreen,
    showNav, hideNav, toggleCompact, forceShowNav, forceHideNav,
    themeMode, isDark, colors, setThemeMode, toggleTheme,
  ]);

  if (!themeLoaded) {
    return null;
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useNavigationContext = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }
  return context;
};

export default NavigationContext;