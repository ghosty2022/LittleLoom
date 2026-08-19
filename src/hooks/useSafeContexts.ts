// src/hooks/useSafeContexts.ts
// Safe context hooks that never throw - for use in components that may render before contexts are ready

import { useContext } from 'react';
import { useTheme as useThemeOriginal } from '../context/AppContext';
import { useAuth as useAuthOriginal } from '../context/AuthContext';
import { useBaby as useBabyOriginal } from '../context/BabyContext';
import { useActivity as useActivityOriginal } from '../context/ActivityContext';
import useCustomizationOriginal from './useCustomization';

// FIX: Direct import of the context, NOT the hook wrapper
import { TrackerContext } from '../context/TrackerContext';

const DEFAULT_APP_COLORS = {
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

const DEFAULT_CUSTOMIZATION = {
  settings: {
    theme: 'purple',
    avatar: 0,
    appearance: 'system' as const,
    fontSize: 'normal' as const,
    borderRadius: 'normal' as const,
    animationSpeed: 'normal' as const,
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
  },
  isLoaded: true,
  themeColors: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#fa709a',
    colors: ['#e0e7ff', '#d1d5ff', '#c7b8ff'],
    spinnerColor: '#667eea',
    darkText: '#4338ca',
    lightText: '#ffffff',
  },
  avatar: '👶',
  isDark: false,
  isTrueBlack: false,
  isPureWhite: false,
  shouldReduceMotion: false,
  fontSizeMultiplier: 1,
  borderRadiusValue: 14,
  animationDuration: 300,
  updateSettings: async () => {},
  reset: async () => {},
  triggerHaptic: async () => {},
};

// ─── SAFE APP ──────────────────────────────────────────────────────────

export function useSafeApp() {
  try {
    const app = useThemeOriginal();
    return {
      ...app,
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
    };
  } catch (e) {
    return {
      themeMode: 'system' as const,
      appearance: 'system' as const,
      isDark: false,
      isTrueBlack: false,
      isPureWhite: false,
      colors: DEFAULT_APP_COLORS,
      setThemeMode: async () => {},
      setAppearance: async () => {},
      toggleTheme: () => {},
      setDarkMode: () => {},
      themeReady: true,
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
    };
  }
}

// ─── SAFE AUTH ─────────────────────────────────────────────────────────

export function useSafeAuth() {
  try {
    return useAuthOriginal();
  } catch (e) {
    return {
      isLoading: false,
      isAuthenticated: false,
      userToken: null,
      userProfile: null,
      onboardingComplete: false,
      hasSeenOnboarding: false,
      isBiometricAvailable: false,
      isBiometricEnabled: false,
      isBiometricLoginEnabled: false,
      setupComplete: false,
      hasParent2: false,
      hasBaby: false,
      availableBiometricTypes: [],
      biometricTypeName: 'Biometric',
      signIn: async () => false,
      signUp: async () => false,
      signInWithSocial: async () => false,
      signOut: async () => {},
      checkBiometricAvailability: async () => false,
      authenticateWithBiometric: async () => ({ success: false, error: 'not_available' }),
      enableBiometricForApp: async () => false,
      enableBiometricLogin: async () => false,
      disableBiometricLogin: async () => {},
      hasBiometricLoginCredentials: async () => false,
      loginWithBiometric: async () => false,
      updateUserProfile: async () => false,
      updateUserPreferences: async () => false,
      skipSetup: async () => {},
      completeSetup: async () => {},
      resetSetupFlow: async () => {},
      wasSetupCompleted: async () => ({ hasParent2: false, hasBaby: false, setupComplete: false }),
      setSetupCompleteCallback: () => {},
      markOnboardingSeen: async () => {},
      shouldShowBiometricPrompt: async () => false,
      isAppActive: () => true,
      getLastActiveTime: () => Date.now(),
      getBiometricTypeInfo: () => ({ type: 'Biometric', icon: 'finger-print' }),
      clearAllLocks: () => {},
      getCurrentUserProfile: () => null,
      updateCommunityProfile: async () => false,
      getCommunityProfile: async () => null,
      updateCommunityStats: async () => false,
      updateCommunityTopics: async () => false,
      isUsernameAvailable: async () => ({ available: true, message: '' }),
      registerCommunityUsername: async () => false,
      updateCommunityAvatar: async () => false,
    };
  }
}

// ─── SAFE BABY ─────────────────────────────────────────────────────────

export function useSafeBaby() {
  try {
    return useBabyOriginal();
  } catch (e) {
    return {
      isLoading: false,
      babies: [],
      currentBabyId: null,
      currentBaby: null,
      hasSkippedBaby: false,
      growthData: [],
      milestones: [],
      sleepLogs: [],
      feedingLogs: [],
      pottyLogs: [],
      medicationLogs: [],
      activities: [],
      entries: [],
      isLoadingEntries: false,
      loadBabies: async () => {},
      createBaby: async () => false,
      updateBaby: async () => {},
      deleteBaby: async () => false,
      switchBaby: async () => false,
      refreshCurrentBaby: async () => {},
      skipBaby: async () => {},
      clearSkipBaby: async () => {},
      calculateAge: () => '',
      getBabyAge: () => '',
      addGrowthMeasurement: async () => false,
      getGrowthData: () => [],
      getLatestMeasurements: () => ({ height: null, weight: null, head: null, temperature: null }),
      deleteGrowthMeasurement: async () => false,
      addMilestone: async () => false,
      getMilestones: () => [],
      deleteMilestone: async () => false,
      addSleepLog: async () => false,
      getSleepLogs: () => [],
      endSleepSession: async () => false,
      getTodaySleepCount: () => 0,
      addFeedingLog: async () => false,
      getFeedingLogs: () => [],
      getTodayFeedCount: () => 0,
      addPottyLog: async () => false,
      getPottyLogs: () => [],
      getPottyStreak: () => 0,
      getTodayPottyCount: () => 0,
      getPottySuccessRate: () => 0,
      addMedicationLog: async () => false,
      getMedicationLogs: () => [],
      addActivity: async () => false,
      getRecentActivities: () => [],
      getActivitiesByType: () => [],
      deleteActivity: async () => false,
      getBabyStats: () => ({ streak: 0, milestones: 0, photos: 0, entries: 0 }),
      updateBabyStats: async () => {},
      loadEntries: async () => {},
      deleteEntry: async () => false,
      addEntry: async () => false,
      updateEntry: async () => false,
      getEntryById: () => undefined,
      getDateTitle: () => 'Today',
      syncWithActivityContext: async () => {},
      scheduleActivityReminder: async () => null,
      cancelActivityReminder: async () => {},
    };
  }
}

// ─── SAFE ACTIVITY ─────────────────────────────────────────────────────

export function useSafeActivity() {
  try {
    return useActivityOriginal();
  } catch (e) {
    return {
      entries: [],
      isLoading: false,
      error: null,
      addEntry: async () => {},
      updateEntry: async () => {},
      deleteEntry: async () => {},
      getEntriesByType: () => [],
      getEntriesByBaby: () => [],
      getEntriesByDateRange: () => [],
      getEntryById: () => undefined,
      getRecentTimelineEvents: () => [],
      addTimelineEvent: async () => {},
      getTodayCount: () => 0,
      getSuccessRate: () => 0,
      getStreak: () => 0,
      getDateTitle: () => 'Today',
      getRelativeTime: () => 'just now',
      formatDuration: () => '0m',
      loadEntries: async () => {},
      syncEntries: async () => {},
      clearEntries: async () => {},
    };
  }
}

// ─── SAFE CUSTOMIZATION ──────────────────────────────────────────────

export function useSafeCustomization() {
  try {
    return useCustomizationOriginal();
  } catch (e) {
    return DEFAULT_CUSTOMIZATION;
  }
}

// ─── SAFE TRACKER ─────────────────────────────────────────────────────
// FIX: Directly use useContext with the imported TrackerContext
// NO circular dependency because we don't import from ./useTrackerContext

export function useSafeTracker() {
  try {
    // Directly use useContext with the imported TrackerContext
    const ctx = useContext(TrackerContext);
    if (!ctx) {
      // Return fallback if context not available
      return getFallbackTrackerContext();
    }
    return ctx;
  } catch (e) {
    return getFallbackTrackerContext();
  }
}

// FIX: Separate fallback function to avoid re-creation
function getFallbackTrackerContext() {
  return {
    isLoading: false,
    trackers: [],
    customTrackers: [],
    entries: [],
    entriesByTracker: {},
    lastTrackerId: null,
    currentBabyId: null,
    progressive: {
      todayEntries: [],
      yesterdayEntries: [],
      streaks: [],
      insights: [],
      pendingReminders: [],
      recentTemplates: [],
      detectedPatterns: [],
    },
    getTracker: () => undefined,
    getTrackersByCategory: () => [],
    searchTrackers: () => [],
    createCustomTracker: async () => null,
    updateCustomTracker: async () => false,
    deleteCustomTracker: async () => false,
    duplicateTracker: async () => null,
    addEntry: async () => null,
    updateEntry: async () => false,
    deleteEntry: async () => false,
    getEntries: () => [],
    getEntriesByDate: () => [],
    getEntryById: () => undefined,
    getTrackerStats: () => ({ totalEntries: 0, thisWeek: 0, thisMonth: 0, lastEntry: null, streakDays: 0 }),
    getTodaySummary: () => [],
    canUseTracker: () => false,
    canCreateEntry: () => false,
    canEditEntry: () => false,
    canDeleteEntry: () => false,
    getSmartSuggestions: () => ({}),
    getYesterdayData: () => null,
    getStreak: () => undefined,
    getInsights: () => [],
    dismissInsight: () => {},
    scheduleReminder: async () => '',
    cancelReminder: async () => {},
    getPendingReminders: () => [],
    snoozeReminder: async () => {},
    saveTemplate: async () => {},
    getTemplates: async () => [],
    linkEntries: async () => {},
    getLinkedEntries: () => [],
    syncToLegacyActivity: () => ({}) as any,
    getLegacyActivities: () => [],
    syncFromBabyContext: async () => {},
    refreshTrackers: async () => {},
    refreshEntries: async () => {},
    setCurrentBabyId: () => {},
  };
}

// ─── UNIFIED THEME ────────────────────────────────────────────────────

export function useUnifiedTheme() {
  const app = useSafeApp();
  const customization = useSafeCustomization();

  const isDark = customization.isDark ?? app.isDark ?? false;
  const primary = customization.themeColors?.primary || app.colors?.primary || '#667eea';
  const secondary = customization.themeColors?.secondary || app.colors?.accent || '#fa709a';

  return {
    isDark,
    primary,
    secondary,
    reduceMotion: customization.shouldReduceMotion ?? false,
    avatar: customization.avatar ?? '👶',
    themeColors: customization.themeColors,
    appColors: app.colors,
    bgColors: isDark
      ? [customization.themeColors?.colors?.[0] || '#0f0f1e', customization.themeColors?.colors?.[1] || '#1a1a2e', customization.themeColors?.colors?.[2] || '#16213e']
      : [customization.themeColors?.colors?.[0] || '#f8faff', customization.themeColors?.colors?.[1] || '#f0f4ff', customization.themeColors?.colors?.[2] || '#e8eeff'],
    text: {
      primary: isDark ? '#ffffff' : '#1e293b',
      secondary: isDark ? '#a0a0a0' : '#64748b',
      muted: isDark ? '#666666' : '#94a3b8',
    },
    surface: {
      bg: isDark ? 'rgba(30,30,40,0.6)' : 'rgba(255,255,255,0.9)',
      border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      card: isDark ? 'rgba(30,30,40,0.4)' : 'rgba(255,255,255,0.5)',
    },
    blur: isDark ? 'dark' as const : 'light' as const,
    statusBar: isDark ? 'light' as const : 'dark' as const,
  };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────

export {
  useSafeApp,
  useSafeAuth,
  useSafeBaby,
  useSafeActivity,
  useSafeCustomization,
  useSafeTracker,
  useUnifiedTheme,
};

export default useUnifiedTheme;