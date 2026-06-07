import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text,
  AppState,
  AppStateStatus,
  InteractionManager,
} from 'react-native';
import { 
  NavigationContainer, 
  DefaultTheme, 
  DarkTheme, 
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import Parent2OptionalScreen from '../screens/baby/Parent2OptionalScreen';
import Parent2SetupScreen from '../screens/baby/Parent2SetupScreen';
import BabyOptionalScreen from '../screens/baby/BabyOptionalScreen';
import CreateBabyProfileScreen from '../screens/baby/CreateBabyProfileScreen';
import AddParentScreen from '../screens/family/AddParentScreen';
import HomeScreen from '../screens/main/HomeScreen';
import TrackScreen from '../screens/main/TrackScreen';
import MoreScreen from '../screens/main/MoreScreen';
import SafetyCornerScreen from '../screens/safety/SafetyCornerScreen';
import BackupRestoreScreen from '../screens/backup/BackupRestoreScreen';
import HelpCenterScreen from '../screens/settings/HelpCenterScreen';
import ContactSupportScreen from '../screens/settings/ContactSupportScreen';
import PrivacyPolicyScreen from '../screens/settings/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/settings/TermsOfServiceScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import LanguageSettingsScreen from '../screens/settings/LanguageSettingsScreen';
import UnitSettingsScreen from '../screens/settings/UnitSettingsScreen';

import CommunityNavigator from './CommunityNavigator';

import AddLogScreen from '../screens/tracking/AddLogScreen';
import AchievementsScreen from '../screens/settings/AchievementsScreen';
import GrowthChartScreen from '../screens/tracking/GrowthChartScreen';
import RemindersScreen from '../screens/tracking/RemindersScreen';
import FamilySharingScreen from '../screens/family/FamilySharingScreen';
import ProfileScreen from '../screens/baby/ProfileScreen';
import EditProfileScreen from '../screens/baby/EditProfileScreen';
import EditGuardianScreen from '../screens/family/EditGuardianScreen';
import SoundMixerScreen from '../screens/gallery/SoundMixerScreen';
import SecurityLockScreen from '../screens/security/SecurityLockScreen';
import BiometricSetupScreen from '../screens/security/BiometricSetupScreen';
import SwitchBabyScreen from '../screens/baby/SwitchBabyScreen';
import CustomizeScreen from '../screens/settings/CustomizeScreen';
import UniversalTrackerScreen from '../screens/tracking/UniversalTrackerScreen';
import GalleryScreen from '../screens/gallery/GalleryScreen';
import FamilyChatListScreen from '../screens/family/FamilyChatListScreen';
import FamilyChatScreen from '../screens/family/FamilyChatScreen';

import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import { InlineSpinner } from '../components/UniversalSpinner';

import { useSecurity } from '../context/SecurityContext';
// 🔑 Use the safe context hooks instead of direct imports to avoid circular issues
import { useSafeApp, useSafeBaby, useSafeAuth } from '../hooks/useSafeContexts';

import { statePersistence } from '../utils/statePersistence';

import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const NAVIGATION_STATE_KEY = '@littleloom_nav_state_v2';
const LAST_ROUTE_KEY = '@littleloom_last_route_v2';
const FIRST_OPEN_KEY = '@littleloom_first_open_v2';

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8faff',
    card: '#ffffff',
    text: '#1a1a1a',
    border: '#e2e8f0',
    notification: '#667eea',
    primary: '#667eea',
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#0a0a0a',
    text: '#ffffff',
    border: '#1a1a1a',
    notification: '#a3bffa',
    primary: '#a3bffa',
  },
};

const MAIN_FLOW_SCREENS = [
  'Main', 'Home', 'Track', 'Grow', 'Connect', 'More',
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'UserProfile', 'Chat', 'ChatList', 'Notifications', 'EditCommunityProfile',
  'Followers', 'Following', 'Report',
  'UniversalTracker', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'SwitchBaby', 'EditProfile', 'EditGuardian',
  'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddLog', 'Achievements', 'GrowthChart', 'Reminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings',
];

const AUTH_FLOW_SCREENS = [
  'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
];

const SETUP_FLOW_SCREENS = [
  'Parent2Optional', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent',
];

function MainTabs() {
  // 🔑 Use safe hook with fallback
  const { isDark, colors } = useSafeApp();

  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassNavigation {...props} />}
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors?.navBackground || '#ffffff',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
      sceneContainerStyle={{ backgroundColor: colors?.background || '#f8faff' }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Grow" component={GrowthChartScreen} />
      <Tab.Screen name="Connect" component={CommunityNavigator} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function getNavigationState(
  authLoading: boolean,
  isAuthenticated: boolean,
  isSecurityLocked: boolean,
  securityEnabled: boolean,
  setupComplete: boolean,
  hasParent2: boolean | 'skipped',
  hasBaby: boolean | 'skipped',
  babiesCount: number,
  hasSkippedBaby: boolean,
  hasSeenOnboarding: boolean,
  isFirstOpen: boolean,
): NavigationState {

  if (authLoading) return 'LOADING';

  if (isFirstOpen && !hasSeenOnboarding) {
    return 'ONBOARDING';
  }

  if (!isAuthenticated) {
    return 'LOGIN';
  }

  if (isSecurityLocked && securityEnabled && setupComplete) {
    return 'SECURITY_LOCK';
  }

  if (!setupComplete) {
    if (hasParent2 !== true && hasParent2 !== 'skipped') {
      return 'SETUP_PARENT2';
    }

    const hasBabyProfile = babiesCount > 0;
    const babySetupDone = hasBaby === true || hasBaby === 'skipped' || hasSkippedBaby || hasBabyProfile;

    if (!babySetupDone) {
      return 'SETUP_BABY';
    }

    return 'MAIN';
  }

  return 'MAIN';
}

const AppLoadingScreen = React.memo(() => {
  const { colors } = useSafeApp();
  return (
    <View style={{ flex: 1, backgroundColor: colors?.background || '#f8faff', justifyContent: 'center', alignItems: 'center' }}>
      <InlineSpinner size={40} color="#667eea" />
      <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '600', color: colors?.text || '#1a1a1a' }}>
        Loading your world...
      </Text>
    </View>
  );
});

// 🔑 FIX: Replace React.lazy with a safe require pattern that won't crash Metro
// React.lazy is not supported in React Native without Suspense boundaries
const SecurityCenterScreen = React.memo(() => {
  const [Component, setComponent] = useState<any>(null);
  
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const module = await import('../screens/security/SecurityCenterScreen');
        if (mounted) setComponent(() => module.default);
      } catch {
        if (mounted) {
          setComponent(() => () => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text>Pin Management Coming Soon</Text>
            </View>
          ));
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []);
  
  if (!Component) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <InlineSpinner size={24} color="#667eea" />
      </View>
    );
  }
  
  return <Component />;
});

function NavigationContent({ 
  isDark: propIsDark, 
  initialState, 
  onStateChange 
}: { 
  isDark?: boolean; 
  initialState?: any;
  onStateChange?: (state: any) => void;
}) {
  const { isDark: contextIsDark, colors } = useSafeApp();
  const isDark = propIsDark !== undefined ? propIsDark : contextIsDark;

  // 🔑 Use safe auth hook with fallback
  const { 
    isLoading: authLoading, 
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
    setSetupCompleteCallback,
    isBiometricLoginEnabled,
  } = useSafeAuth();

  const { 
    babies, 
    isLoading: babyLoading,
    loadBabies,
    hasSkippedBaby,
    currentBabyId,
  } = useSafeBaby();

  const {
    isSecurityLocked,
    checkSecurityOnResume,
    settings: securitySettings,
    forceUnlock,
    clearSecurityState,
  } = useSecurity();

  const [navState, setNavState] = useState<NavigationState>('LOADING');
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [shouldShowSwitchBaby, setShouldShowSwitchBaby] = useState(false);
  const [isNavContainerReady, setIsNavContainerReady] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(false);

  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastNavState = useRef<NavigationState>('LOADING');
  const isNavigating = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  const lastNavigationTime = useRef(0);
  const hasShownSwitchBaby = useRef(false);
  const pendingNavAction = useRef<(() => void) | null>(null);
  const lastSecurityCheckTime = useRef<number>(0);
  const wasOnSecurityLock = useRef<boolean>(false);
  const stateChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  const securityEnabled = useMemo(() => 
    securitySettings?.isPinEnabled || securitySettings?.isBiometricEnabled,
    [securitySettings?.isPinEnabled, securitySettings?.isBiometricEnabled]
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const checkFirstOpen = async () => {
      try {
        const firstOpen = await AsyncStorage.getItem(FIRST_OPEN_KEY);
        if (!firstOpen) {
          setIsFirstOpen(true);
          await AsyncStorage.setItem(FIRST_OPEN_KEY, 'true');
        } else {
          setIsFirstOpen(false);
        }
      } catch (e) {
        setIsFirstOpen(false);
      }
    };
    checkFirstOpen();
  }, []);

  useEffect(() => {
    if (setSetupCompleteCallback && forceUnlock) {
      setSetupCompleteCallback(async () => {
        await forceUnlock();
      });
      return () => {
        setSetupCompleteCallback(null);
      };
    }
  }, [setSetupCompleteCallback, forceUnlock]);

  useEffect(() => {
    if (isNavigating.current) return;

    const newState = getNavigationState(
      authLoading,
      isAuthenticated,
      isSecurityLocked,
      securityEnabled,
      setupComplete,
      hasParent2,
      hasBaby,
      babies?.length || 0,
      hasSkippedBaby,
      hasSeenOnboarding,
      isFirstOpen,
    );

    if (newState === 'MAIN' && 
        lastNavState.current !== 'MAIN' &&
        babies?.length > 1 && 
        !hasShownSwitchBaby.current && 
        isAuthenticated && 
        setupComplete &&
        !isFirstOpen) {
      setShouldShowSwitchBaby(true);
    }

    if (newState !== lastNavState.current) {
      console.log('Navigation state:', lastNavState.current, '->', newState);
      if (lastNavState.current === 'SECURITY_LOCK' && newState === 'MAIN') {
        wasOnSecurityLock.current = true;
        setTimeout(() => {
          wasOnSecurityLock.current = false;
        }, 3000);
      }
      lastNavState.current = newState;
      setNavState(newState);
    }
  }, [
    authLoading,
    isAuthenticated,
    isSecurityLocked,
    securityEnabled,
    setupComplete,
    hasParent2,
    hasBaby,
    babies?.length,
    hasSkippedBaby,
    hasSeenOnboarding,
    isFirstOpen,
  ]);

  useEffect(() => {
    if (!authLoading && !isFirstOpen) {
      setInitialCheckDone(true);
      return;
    }
    if (!authLoading && isFirstOpen) {
      const timer = setTimeout(() => setInitialCheckDone(true), 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isFirstOpen]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      InteractionManager.runAfterInteractions(() => {
        loadBabies();
      });
    }
  }, [isAuthenticated, authLoading, loadBabies]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInactive = appState.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';

      if (appState.current === 'active' && (nextAppState === 'inactive' || nextAppState === 'background')) {
        try {
          const state = navigationRef.current?.getRootState();
          const currentRoute = navigationRef.current?.getCurrentRoute();
          if (currentRoute?.name !== 'SecurityLock' && state) {
            await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
            onStateChange?.(state);
          }
          if (currentRoute && currentRoute.name !== 'SecurityLock') {
            await AsyncStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({
              name: currentRoute.name,
              params: currentRoute.params,
              timestamp: Date.now(),
            }));
            await statePersistence.saveNavigationState(currentRoute.name, currentRoute.params);
          }
        } catch (error) {
          console.warn('Failed to save state on background:', error);
        }
      }

      if (wasInactive && isActive) {
        if (isAuthenticated && setupComplete) {
          const currentRoute = navigationRef.current?.getCurrentRoute()?.name;

          if (currentRoute === 'SecurityLock') {
            appState.current = nextAppState;
            return;
          }

          if (wasOnSecurityLock.current) {
            wasOnSecurityLock.current = false;
            appState.current = nextAppState;
            return;
          }

          const now = Date.now();
          if (now - lastSecurityCheckTime.current < 3000) {
            appState.current = nextAppState;
            return;
          }

          await checkSecurityOnResume();
          lastSecurityCheckTime.current = Date.now();
          loadBabies();

          if (!isSecurityLocked) {
            try {
              const savedRoute = await AsyncStorage.getItem(LAST_ROUTE_KEY);
              if (savedRoute) {
                const { name, params } = JSON.parse(savedRoute);
                const currentRoute = navigationRef.current?.getCurrentRoute();
                const isOnTab = ['Main', 'Home', 'Track', 'Grow', 'Connect', 'More'].includes(currentRoute?.name || '');
                const shouldBeOnTab = ['Main', 'Home', 'Track', 'Grow', 'Connect', 'More'].includes(name);
                if (isOnTab && !shouldBeOnTab && navigationRef.current?.isReady()) {
                  console.log('Restoring route:', name);
                  pendingNavAction.current = () => {
                    navigationRef.current?.navigate(name as any, params);
                  };
                }
              }
            } catch (e) {
              console.warn('Failed to restore route:', e);
            }
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, checkSecurityOnResume, loadBabies, isSecurityLocked, setupComplete, onStateChange]);

  const handleStateChange = useCallback((state: any) => {
    if (!state) return;
    if (stateChangeTimeout.current) {
      clearTimeout(stateChangeTimeout.current);
    }
    stateChangeTimeout.current = setTimeout(() => {
      onStateChange?.(state);
      if (navigationRef.current && state) {
        const currentRoute = navigationRef.current.getCurrentRoute();
        if (currentRoute && currentRoute.name !== 'SecurityLock') {
          statePersistence.saveNavigationState(currentRoute.name, currentRoute.params);
        }
      }
    }, 300);
  }, [onStateChange]);

  useEffect(() => {
    return () => {
      if (stateChangeTimeout.current) {
        clearTimeout(stateChangeTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!navigationRef.current?.isReady() || !isNavContainerReady || isNavigating.current || !initialCheckDone) {
      return;
    }

    const currentRoute = navigationRef.current.getCurrentRoute()?.name;

    if (shouldShowSwitchBaby && !hasShownSwitchBaby.current) {
      hasShownSwitchBaby.current = true;
      setShouldShowSwitchBaby(false);
      if (currentRoute !== 'SwitchBaby') {
        console.log('Navigating to SwitchBaby');
        safeNavigate('SwitchBaby');
        return;
      }
    }

    const routeMap: Record<NavigationState, keyof RootStackParamList> = {
      'LOADING': 'Login',
      'ONBOARDING': 'Onboarding',
      'LOGIN': 'Login',
      'SETUP_PARENT2': 'Parent2Optional',
      'SETUP_BABY': 'BabyOptional',
      'SECURITY_LOCK': 'SecurityLock',
      'MAIN': 'Main',
    };

    const targetRoute = routeMap[navState];

    if (currentRoute === targetRoute) {
      if (pendingNavAction.current) {
        pendingNavAction.current();
        pendingNavAction.current = null;
      }
      return;
    }

    if (navState === 'MAIN' && currentRoute && MAIN_FLOW_SCREENS.includes(currentRoute)) {
      const comingFromNonMain = AUTH_FLOW_SCREENS.includes(lastNavState.current) || 
                                SETUP_FLOW_SCREENS.includes(lastNavState.current) ||
                                lastNavState.current === 'SECURITY_LOCK';

      if (!comingFromNonMain) {
        if (pendingNavAction.current) {
          pendingNavAction.current();
          pendingNavAction.current = null;
        }
        return;
      }
    }

    const now = Date.now();
    if (now - lastNavigationTime.current < 800) {
      return;
    }

    console.log('Enforcing navigation:', currentRoute, '->', targetRoute);

    isNavigating.current = true;
    lastNavigationTime.current = now;

    const shouldReset = 
      navState === 'LOGIN' || 
      navState === 'MAIN' || 
      navState === 'SECURITY_LOCK' ||
      navState === 'ONBOARDING';

    if (shouldReset) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: targetRoute }],
      });
    } else {
      navigationRef.current.navigate(targetRoute);
    }

    setTimeout(() => {
      isNavigating.current = false;
    }, 600);

    lastNavState.current = navState;
  }, [navState, initialCheckDone, shouldShowSwitchBaby, isNavContainerReady]);

  const safeNavigate = useCallback((route: keyof RootStackParamList) => {
    if (!navigationRef.current?.isReady()) return;
    const now = Date.now();
    if (now - lastNavigationTime.current < 800) return;
    lastNavigationTime.current = now;
    navigationRef.current.navigate(route);
  }, []);

  if (authLoading || !initialCheckDone) {
    return <AppLoadingScreen />;
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={() => {
        setIsNavContainerReady(true);
        console.log('Navigation container ready');
      }}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { 
            backgroundColor: colors?.background || '#f8faff',
          },
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />

        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Parent2Optional" component={Parent2OptionalScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Parent2Setup" component={Parent2SetupScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="BabyOptional" component={BabyOptionalScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CreateBabyProfile" component={CreateBabyProfileScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="AddParent" component={AddParentScreen} />
        </Stack.Group>

        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />

        <Stack.Screen name="UniversalTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="PottyTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="FeedTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="SleepTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />

        <Stack.Screen 
          name="SwitchBaby" 
          component={SwitchBabyScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />

        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="EditGuardian" component={EditGuardianScreen} options={{ animation: 'slide_from_right' }} />

        <Stack.Screen name="Gallery" component={GalleryScreen} />
        <Stack.Screen name="FamilyChatList" component={FamilyChatListScreen} />
        <Stack.Screen name="FamilyChat" component={FamilyChatScreen} />

        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="UnitSettings" component={UnitSettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SafetyCorner" component={SafetyCornerScreen} options={{ animation: 'slide_from_right' }} />

        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AddLog" component={AddLogScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="GrowthChart" component={GrowthChartScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
          <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
          <Stack.Screen name="SoundMixer" component={SoundMixerScreen} />
          <Stack.Screen name="Customize" component={CustomizeScreen} />
        </Stack.Group>

        <Stack.Group screenOptions={{ presentation: 'fullScreenModal', animation: 'fade' }}>
          <Stack.Screen name="SecurityLock" component={SecurityLockScreen} />
          <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
          <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator({ 
  isDark: propIsDark, 
  initialState, 
  onStateChange 
}: {
  isDark?: boolean;
  initialState?: any;
  onStateChange?: (state: any) => void;
} = {}) {
  return (
    <NavigationContent 
      isDark={propIsDark} 
      initialState={initialState} 
      onStateChange={onStateChange} 
    />
  );
}