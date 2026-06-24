// src/hooks/useRouteBasedNavVisibility.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationState } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

export type NavVisibility = 'visible' | 'hidden' | 'auto';

interface NavState {
  isVisible: boolean;
  isFullyHidden: boolean;
  progress: number;
}

// Singleton state — shared across all instances
let _currentState: NavState = { isVisible: true, isFullyHidden: false, progress: 1 };
let _listeners = new Set<(state: NavState) => void>();
let _forcedRoute: string | null = null;

const emit = (state: NavState) => {
  _currentState = state;
  _listeners.forEach(cb => cb(state));
};

// ─── ROUTE CLASSIFICATION ─────────────────────────────────────────

// These routes ALWAYS show the tab bar (Home main screen only)
const ALWAYS_VISIBLE_ROUTES = new Set(['Home']);

// These routes are TAB BAR SCREENS — nav shows briefly then hides when entering content
// Actually, we don't need this. The tab bar is part of the navigator, not the screen.
// The tab bar shows when the tab is focused. We control per-tab behavior.

// Routes where tab bar is COMPLETELY HIDDEN
const ALWAYS_HIDDEN_ROUTES = new Set([
  // Auth
  'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
  // Setup
  'Parent2Optional', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent',
  // Security
  'SecurityLock', 'BiometricSetup', 'SecurityCenter',
  // Community sub-screens
  'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 
  'Chat', 'ChatList', 'Notifications', 'CommunityProfile', 
  'TopicMembers', 'Followers', 'Following', 'SearchUsers', 'BlockedUsers', 'Report',
  'CommunitySplash', 'CommunityOnboarding',
  // Main stack screens
  'Timeline', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'SwitchBaby', 'EditProfile', 'EditGuardian',
  'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddEntry', 'Achievements', 'GrowthDashboard', 'Insights', 
  'TrackerReminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 
  'TermsOfService', 'About', 'LanguageSettings', 'UnitSettings',
  'SafetyCorner', 'UniversalTrackerHub', 'CreateCustomTracker',
  'VaccinationSchedule',
]);

// Tab names where the tab bar should HIDE when entering the tab's main screen
// (i.e., not Home — Home stays visible)
const HIDE_ON_ENTER_TABS = new Set(['Track', 'Grow', 'Connect', 'More']);

// ─── HOOK ───────────────────────────────────────────────────────────
export const useRouteBasedNavVisibility = () => {
  const [state, setState] = useState<NavState>(_currentState);

  // Get current route from navigation state
  const routeName = useNavigationState((state) => {
    if (!state) return '';
    
    // Find the deepest active route
    let route = state.routes[state.index];
    while (route.state) {
      const nested = route.state as any;
      route = nested.routes?.[nested.index ?? 0] ?? route;
    }
    return route.name;
  });

  // Get parent tab info
  const parentTab = useNavigationState((state) => {
    if (!state) return null;
    const mainRoute = state.routes[state.index];
    if (mainRoute.state) {
      const nested = mainRoute.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || mainRoute.name;
    }
    return mainRoute.name;
  });

  useEffect(() => {
    const unsub = (cb: (s: NavState) => void) => {
      _listeners.add(cb);
      cb(_currentState);
      return () => { _listeners.delete(cb); };
    };
    return unsub(setState);
  }, []);

  // Core logic: determine visibility based on route
  useEffect(() => {
    const currentRoute = _forcedRoute || routeName;
    
    // 1. Always hidden routes
    if (ALWAYS_HIDDEN_ROUTES.has(currentRoute)) {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
      return;
    }

    // 2. Home tab — always visible
    if (currentRoute === 'Home') {
      emit({ isVisible: true, isFullyHidden: false, progress: 1 });
      return;
    }

    // 3. Track, Grow, Connect, More tabs — hide when entering
    if (HIDE_ON_ENTER_TABS.has(currentRoute)) {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
      return;
    }

    // 4. Community main — check if we should show (only on tab switch, not persist)
    // Actually, CommunityMain is handled by the tab navigator itself
    // The tab bar shows when the tab is focused. We let the navigator handle that.

    // Default: hidden for safety
    emit({ isVisible: false, isFullyHidden: true, progress: 0 });
  }, [routeName, parentTab]);

  const forceHide = useCallback(() => {
    emit({ isVisible: false, isFullyHidden: true, progress: 0 });
  }, []);

  const forceShow = useCallback(() => {
    emit({ isVisible: true, isFullyHidden: false, progress: 1 });
  }, []);

  const reset = useCallback(() => {
    // Re-evaluate based on current route
    const currentRoute = routeName;
    if (ALWAYS_HIDDEN_ROUTES.has(currentRoute)) {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
    } else if (currentRoute === 'Home') {
      emit({ isVisible: true, isFullyHidden: false, progress: 1 });
    } else {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
    }
  }, [routeName]);

  return {
    state,
    isVisible: state.isVisible,
    isFullyHidden: state.isFullyHidden,
    progress: state.progress,
    forceHide,
    forceShow,
    reset,
    subscribe: (cb: (state: NavState) => void) => {
      _listeners.add(cb);
      cb(_currentState);
      return () => { _listeners.delete(cb); };
    },
  };
};

export default useRouteBasedNavVisibility;