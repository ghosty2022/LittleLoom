// src/navigation/AppNavigator.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  useColorScheme,
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

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import Parent2OptionalScreen from '../screens/Parent2OptionalScreen';
import Parent2SetupScreen from '../screens/Parent2SetupScreen';
import BabyOptionalScreen from '../screens/BabyOptionalScreen';
import CreateBabyProfileScreen from '../screens/CreateBabyProfileScreen';
import AddParentScreen from '../screens/AddParentScreen';
import HomeScreen from '../screens/HomeScreen';
import TrackScreen from '../screens/TrackScreen';
import SafetyCornerScreen from '../screens/SafetyCornerScreen';
import MoreScreen from '../screens/MoreScreen';

import CommunityNavigator from './CommunityNavigator';

import ChatScreen from '../screens/community/ChatScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import NotificationsScreen from '../screens/community/NotificationsScreen';
import EditCommunityProfileScreen from '../screens/community/EditCommunityProfileScreen';

import AddLogScreen from '../screens/AddLogScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import GrowthChartScreen from '../screens/GrowthChartScreen';
import RemindersScreen from '../screens/RemindersScreen';
import FamilySharingScreen from '../screens/FamilySharingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import EditGuardianScreen from '../screens/EditGuardianScreen';
import SoundMixerScreen from '../screens/SoundMixerScreen';
import SecurityLockScreen from '../screens/SecurityLockScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import ChangePinScreen from '../screens/ChangePinScreen';
import SwitchBabyScreen from '../screens/SwitchBabyScreen';
import CustomizeScreen from '../screens/CustomizeScreen';
import UniversalTrackerScreen from '../screens/UniversalTrackerScreen';
import GalleryScreen from '../screens/GalleryScreen';
import FamilyChatListScreen from '../screens/FamilyChatListScreen';
import FamilyChatScreen from '../screens/FamilyChatScreen';

import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import UniversalSpinner from '../components/UniversalSpinner';

import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import { useSecurity } from '../context/SecurityContext';
import { NavigationProvider } from '../context/NavigationContext';

import { statePersistence } from '../utils/statePersistence';

import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const NAVIGATION_STATE_KEY = '@littleloom_nav_state_v1';
const LAST_ROUTE_KEY = '@littleloom_last_route_v1';

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
  'BiometricSetup', 'ChangePin',
];

const AUTH_FLOW_SCREENS = [
  'Splash', 'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
];

const SETUP_FLOW_SCREENS = [
  'Parent2Optional', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent',
];

function MainTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <NavigationProvider>
      <Tab.Navigator
        tabBar={(props) => <LiquidGlassNavigation {...props} />}
        screenOptions={{ 
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
        sceneContainerStyle={{
          backgroundColor: isDark ? '#000000' : '#f8faff',
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Track" component={TrackScreen} />
        <Tab.Screen name="Grow" component={GrowthChartScreen} />
        <Tab.Screen name="Connect" component={CommunityNavigator} />
        <Tab.Screen name="More" component={MoreScreen} />
      </Tab.Navigator>
    </NavigationProvider>
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
): NavigationState {

  if (authLoading) return 'LOADING';

  if (!isAuthenticated) {
    if (!hasSeenOnboarding) {
      return 'ONBOARDING';
    }
    return 'LOGIN';
  }

  if (isSecurityLocked && securityEnabled && setupComplete) {
    return 'SECURITY_LOCK';
  }

  if (!setupComplete) {
    if (!hasParent2) {
      return 'SETUP_PARENT2';
    }
    const hasBabyProfile = babiesCount > 0;
    if (!hasBaby && !hasSkippedBaby && !hasBabyProfile) {
      return 'SETUP_BABY';
    }
    console.log('⚠️ Setup state inconsistent, marking complete');
    return 'MAIN';
  }

  return 'MAIN';
}

interface AppNavigatorProps {
  isDark?: boolean;
  initialState?: any;
  onStateChange?: (state: any) => void;
}

function NavigationContent({ 
  isDark, 
  initialState, 
  onStateChange 
}: { 
  isDark: boolean; 
  initialState?: any;
  onStateChange?: (state: any) => void;
}) {
  const { 
    isLoading: authLoading, 
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
    setSetupCompleteCallback,
    isBiometricLoginEnabled,
  } = useAuth();

  const { 
    babies, 
    isLoading: babyLoading,
    loadBabies,
    hasSkippedBaby,
    currentBabyId,
  } = useBaby();

  const {
    isSecurityLocked,
    checkSecurityOnResume,
    settings: securitySettings,
    forceUnlock,
    clearSecurityState,
  } = useSecurity();

  const [showSplash, setShowSplash] = useState(true);
  const [navState, setNavState] = useState<NavigationState>('LOADING');
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [shouldShowSwitchBaby, setShouldShowSwitchBaby] = useState(false);
  const [isNavContainerReady, setIsNavContainerReady] = useState(false);

  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastNavState = useRef<NavigationState>('LOADING');
  const isNavigating = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  const lastNavigationTime = useRef(0);
  const isFirstMount = useRef(true);
  const stateChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasShownSwitchBaby = useRef(false);
  const pendingNavAction = useRef<(() => void) | null>(null);
  // CRITICAL FIX: Track last security check time to prevent rapid re-checks
  const lastSecurityCheckTime = useRef<number>(0);
  // CRITICAL FIX: Track if we just came from SecurityLock
  const wasOnSecurityLock = useRef<boolean>(false);

  const securityEnabled = useMemo(() => 
    securitySettings.isPinEnabled || securitySettings.isBiometricEnabled,
    [securitySettings.isPinEnabled, securitySettings.isBiometricEnabled]
  );

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
      babies.length,
      hasSkippedBaby,
      hasSeenOnboarding,
    );

    if (newState === 'MAIN' && 
        lastNavState.current !== 'MAIN' &&
        babies.length > 1 && 
        !hasShownSwitchBaby.current && 
        isAuthenticated && 
        setupComplete) {
      setShouldShowSwitchBaby(true);
    }

    if (newState !== lastNavState.current) {
      console.log('🧭 Navigation state:', lastNavState.current, '->', newState);
      // CRITICAL FIX: Track if we're leaving SecurityLock
      if (lastNavState.current === 'SECURITY_LOCK' && newState === 'MAIN') {
        wasOnSecurityLock.current = true;
        // Clear the flag after 3 seconds
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
    babies.length,
    hasSkippedBaby,
    hasSeenOnboarding,
  ]);

  useEffect(() => {
    if (!isFirstMount.current) {
      setShowSplash(false);
      setInitialCheckDone(true);
      return;
    }
    isFirstMount.current = false;
    if (isAuthenticated && !authLoading) {
      setShowSplash(false);
      setInitialCheckDone(true);
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
      setInitialCheckDone(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      InteractionManager.runAfterInteractions(() => {
        loadBabies();
      });
    }
  }, [isAuthenticated, authLoading, loadBabies]);

  // CRITICAL FIX: AppState handling with better guards
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
          
          // CRITICAL FIX: Don't check security if we're currently on SecurityLock
          if (currentRoute === 'SecurityLock') {
            console.log('🔒 Already on SecurityLock, skipping check');
            appState.current = nextAppState;
            return;
          }

          // CRITICAL FIX: Don't check security if we just came from SecurityLock
          if (wasOnSecurityLock.current) {
            console.log('🔒 Just came from SecurityLock, skipping check');
            wasOnSecurityLock.current = false;
            appState.current = nextAppState;
            return;
          }

          // CRITICAL FIX: Throttle security checks (max once per 3 seconds)
          const now = Date.now();
          if (now - lastSecurityCheckTime.current < 3000) {
            console.log('⏸️ Security check throttled');
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
                  console.log('🔄 Restoring route:', name);
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
    if (!navigationRef.current?.isReady() || !isNavContainerReady || showSplash || isNavigating.current || !initialCheckDone) {
      return;
    }

    const currentRoute = navigationRef.current.getCurrentRoute()?.name;

    if (shouldShowSwitchBaby && !hasShownSwitchBaby.current) {
      hasShownSwitchBaby.current = true;
      setShouldShowSwitchBaby(false);
      if (currentRoute !== 'SwitchBaby') {
        console.log('🧭 Navigating to SwitchBaby');
        safeNavigate('SwitchBaby');
        return;
      }
    }

    const routeMap: Record<NavigationState, keyof RootStackParamList> = {
      'LOADING': 'Splash',
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

    console.log('🧭 Enforcing navigation:', currentRoute, '->', targetRoute);

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
  }, [navState, showSplash, initialCheckDone, shouldShowSwitchBaby, isNavContainerReady]);

  const safeNavigate = useCallback((route: keyof RootStackParamList) => {
    if (!navigationRef.current?.isReady()) return;
    const now = Date.now();
    if (now - lastNavigationTime.current < 800) return;
    lastNavigationTime.current = now;
    navigationRef.current.navigate(route);
  }, []);

  if (authLoading || (showSplash && !isAuthenticated)) {
    return <SplashScreen />;
  }

  if (babyLoading && isAuthenticated && !setupComplete) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#f8faff' }}>
        <UniversalSpinner 
          visible={true} 
          text="Loading..." 
          size="large"
          overlay={true}
          blur={true}
        />
      </View>
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={() => {
        setIsNavContainerReady(true);
        console.log('✅ Navigation container ready');
      }}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { 
            backgroundColor: isDark ? '#000000' : '#f8faff',
          },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
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
          <Stack.Screen name="ChangePin" component={ChangePinScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator({ 
  isDark: propIsDark, 
  initialState, 
  onStateChange 
}: AppNavigatorProps = {}) {
  const colorScheme = useColorScheme();
  const isDark = propIsDark !== undefined ? propIsDark : colorScheme === 'dark';

  return (
    <NavigationContent 
      isDark={isDark} 
      initialState={initialState} 
      onStateChange={onStateChange} 
    />
  );
}