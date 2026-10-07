
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationState } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

export type NavVisibility = 'visible' | 'hidden' | 'auto';

interface NavState {
  isVisible: boolean;
  isFullyHidden: boolean;
  progress: number;
}


let _currentState: NavState = { isVisible: true, isFullyHidden: false, progress: 1 };
let _listeners = new Set<(state: NavState) => void>();
let _forcedRoute: string | null = null;

const emit = (state: NavState) => {
  _currentState = state;
  _listeners.forEach(cb => cb(state));
};




const ALWAYS_VISIBLE_ROUTES = new Set(['Home']);






const ALWAYS_HIDDEN_ROUTES = new Set([
  
  'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
  
  'CoParentInviteScreen', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent',
  
  'SecurityLock', 'BiometricSetup', 'SecurityCenter',
  
  'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 
  'Chat', 'ChatList', 'Notifications', 'CommunityProfile', 
  'TopicMembers', 'Followers', 'Following', 'SearchUsers', 'BlockedUsers', 'Report',
  'CommunitySplash', 'CommunityOnboarding',
  
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



const HIDE_ON_ENTER_TABS = new Set(['Track', 'Grow', 'Connect', 'More']);


export const useRouteBasedNavVisibility = () => {
  const [state, setState] = useState<NavState>(_currentState);

  
  const routeName = useNavigationState((state) => {
    if (!state || typeof state.index !== 'number') return '';
    
    
    let route = state.routes?.[state.index];
    if (!route) return '';
    
    while (route?.state) {
      const nested = route.state as any;
      route = nested.routes?.[nested.index ?? 0] ?? route;
      if (!route) return '';
    }
    return route?.name || '';
  });

  
  const parentTab = useNavigationState((state) => {
    if (!state || typeof state.index !== 'number') return null;
    const mainRoute = state.routes?.[state.index];
    if (!mainRoute) return null;
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

  
  useEffect(() => {
    const currentRoute = _forcedRoute || routeName;
    
    
    if (ALWAYS_HIDDEN_ROUTES.has(currentRoute)) {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
      return;
    }

    
    if (currentRoute === 'Home') {
      emit({ isVisible: true, isFullyHidden: false, progress: 1 });
      return;
    }

    
    if (HIDE_ON_ENTER_TABS.has(currentRoute)) {
      emit({ isVisible: false, isFullyHidden: true, progress: 0 });
      return;
    }

    
    
    

    
    emit({ isVisible: false, isFullyHidden: true, progress: 0 });
  }, [routeName, parentTab]);

  const forceHide = useCallback(() => {
    emit({ isVisible: false, isFullyHidden: true, progress: 0 });
  }, []);

  const forceShow = useCallback(() => {
    emit({ isVisible: true, isFullyHidden: false, progress: 1 });
  }, []);

  const reset = useCallback(() => {
    
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