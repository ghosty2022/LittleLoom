
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
import CoParentInviteScreen from '../screens/baby/CoParentInviteScreen';
import CoParentSetupScreen from '../screens/baby/CoParentSetupScreen';
import BabyOnboardingScreen from '../screens/baby/BabyOnboardingScreen';
import BabyProfileCreateScreen from '../screens/baby/BabyProfileCreateScreen';
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

import AddEntryScreen from '../screens/tracking/AddEntryScreen';
import AchievementsScreen from '../screens/settings/AchievementsScreen';
import GrowthDashboardScreen from '../screens/tracking/GrowthDashboardScreen';
import TrackerRemindersScreen from '../screens/tracking/TrackerRemindersScreen';
import FamilySharingScreen from '../screens/family/FamilySharingScreen';
import FamilyDashboardScreen from '../screens/baby/FamilyDashboardScreen';
import BabyProfileScreen from '../screens/baby/BabyProfileScreen';
import EditGuardianScreen from '../screens/family/EditGuardianScreen';
import SoundMixerScreen from '../screens/gallery/SoundMixerScreen';
import SecurityLockScreen from '../screens/security/SecurityLockScreen';
import BiometricSetupScreen from '../screens/security/BiometricSetupScreen';
import BabySelectorScreen from '../screens/baby/BabySelectorScreen';
import CustomizeScreen from '../screens/settings/CustomizeScreen';
import TimelineScreen from '../screens/tracking/TimelineScreen';
import GalleryScreen from '../screens/gallery/GalleryScreen';
import FamilyChatListScreen from '../screens/family/FamilyChatListScreen';
import FamilyChatScreen from '../screens/family/FamilyChatScreen';
import SecurityCenterScreen from '../screens/security/SecurityCenterScreen';

import UniversalTrackerHubScreen from '../screens/tracking/UniversalTrackerHubScreen';
import CreateCustomTrackerScreen from '../screens/tracking/CreateCustomTrackerScreen';

import VaccinationScheduleScreen from '../screens/tracking/VaccinationScheduleScreen';

import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import { UniversalSpinner } from '../components/UniversalSpinner';

import { useSecurity } from '../context/SecurityContext';
import { useSafeApp, useSafeBaby, useSafeAuth } from '../hooks/useSafeContexts';

import { statePersistence } from '../utils/statePersistence';

import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── USE SAME KEYS AS AUTH CONTEXT ──────────────────────────────────────
const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

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

const MAIN_FLOW_SCREENS = new Set([
  'Main', 'Home', 'Track', 'Grow', 'Connect', 'More',
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 'Chat', 'ChatList', 
  'Notifications', 'CommunityProfile', 'Followers', 'Following', 'Report',
  'Timeline', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'SwitchBaby', 'EditProfile', 'EditGuardian',
  'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddEntry', 'Achievements', 'GrowthDashboard', 'TrackerReminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings',
  'UniversalTrackerHub', 'CreateCustomTracker',
  'VaccinationSchedule', 'SafetyCorner',
]);

const AUTH_FLOW_SCREENS = new Set([
  'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
]);

const SETUP_FLOW_SCREENS = new Set([
  'Parent2Optional', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent',
]);


function MainTabs() {
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
        sceneStyle: { backgroundColor: colors?.background || '#f8faff' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen as any} />
      <Tab.Screen name="Track" component={TrackScreen as any} />
      <Tab.Screen name="Grow" component={GrowthDashboardScreen as any} />
      <Tab.Screen name="Connect" component={CommunityNavigator as any} />
      <Tab.Screen name="More" component={MoreScreen as any} />
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

  // ─── FIX: If user is authenticated, NEVER show onboarding ─────────────
  if (isAuthenticated) {
    if (isSecurityLocked && securityEnabled && setupComplete) {
      return 'SECURITY_LOCK';
    }
    if (!setupComplete) {
      if (hasParent2 !== true && hasParent2 !== 'skipped') {
        return 'SETUP_PARENT2';
      }
      const babySetupDone = hasBaby === true || hasBaby === 'skipped' || babiesCount > 0;
      if (!babySetupDone) {
        return 'SETUP_BABY';
      }
      return 'MAIN';
    }
    return 'MAIN';
  }

  // Only show onboarding for unauthenticated first-time users
  if (isFirstOpen && !hasSeenOnboarding) {
    return 'ONBOARDING';
  }

  if (!isAuthenticated) {
    return 'LOGIN';
  }

  return 'MAIN';
}


const AppLoadingScreen = React.memo(() => {
  const { colors } = useSafeApp();

  const loadingMessages = [
    'Getting everything ready...',
    'Preparing your babys space...',
    'Almost there...',
    'Setting things up...',
  ];

  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors?.background || '#f8faff', justifyContent: 'center', alignItems: 'center' }}>
      <UniversalSpinner 
        visible={true}
        text={loadingMessages[messageIndex]}
        subtext="Just a moment"
        size="medium"
        overlay={false}
        blur={false}
        section="main"
        variant="liquid"
      />
    </View>
  );
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

  const { 
    isLoading: authLoading, 
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
  } = useSafeAuth();

  const { 
    babies, 
    loadBabies,
    hasSkippedBaby,
  } = useSafeBaby();

  const {
    isSecurityLocked,
    checkSecurityOnResume,
    settings: securitySettings,
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
  const wasOnSecurityLock = useRef<boolean>(false);
  const lastSecurityCheckTime = useRef<number>(0);
  const stateChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const securityEnabled = useMemo(() => 
    securitySettings?.isPinEnabled || securitySettings?.isBiometricEnabled,
    [securitySettings?.isPinEnabled, securitySettings?.isBiometricEnabled]
  );

  // ─── FIX: Read onboarding state from same keys as AuthContext ──────────
  useEffect(() => {
    const checkFirstOpen = async () => {
      try {
        const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        const onboardingSeen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
        const hasCompletedOnboarding = onboardingComplete === 'true' || onboardingSeen === 'true';
        setIsFirstOpen(!hasCompletedOnboarding);
      } catch (e) {
        console.warn('Failed to check onboarding state:', e);
        setIsFirstOpen(false);
      }
    };
    checkFirstOpen();
  }, []);


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
        setTimeout(() => { wasOnSecurityLock.current = false; }, 3000);
      }
      lastNavState.current = newState;
      setNavState(newState);
    }
  }, [
    authLoading, isAuthenticated, isSecurityLocked, securityEnabled,
    setupComplete, hasParent2, hasBaby, babies?.length, hasSkippedBaby,
    hasSeenOnboarding, isFirstOpen,
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
    if (isAuthenticated && !authLoading) {
      const shouldLoad = !hasInitiallyLoaded.current || setupComplete;
      if (shouldLoad) {
        hasInitiallyLoaded.current = true;
        InteractionManager.runAfterInteractions(() => {
          loadBabies();
        });
      }
    }
  }, [isAuthenticated, authLoading, setupComplete, loadBabies]);


  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInactive = appState.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';

      if (appState.current === 'active' && (nextAppState === 'inactive' || nextAppState === 'background')) {
        try {
          const state = navigationRef.current?.getRootState();
          const currentRoute = navigationRef.current?.getCurrentRoute();
          if (currentRoute?.name !== 'SecurityLock' && state && currentRoute) {
            await statePersistence.saveNavigationState(
              state,
              currentRoute.name,
              currentRoute.params
            );
            await statePersistence.saveLastRoute(currentRoute.name, currentRoute.params);
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
          lastSecurityCheckTime.current = now;
          loadBabies();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, checkSecurityOnResume, loadBabies, setupComplete]);


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
          statePersistence.saveNavigationState(state, currentRoute.name, currentRoute.params);
          statePersistence.saveLastRoute(currentRoute.name, currentRoute.params);
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
      return;
    }

    if (navState === 'MAIN' && currentRoute && MAIN_FLOW_SCREENS.has(currentRoute)) {
      const comingFromNonMain = AUTH_FLOW_SCREENS.has(lastNavState.current) || 
                                SETUP_FLOW_SCREENS.has(lastNavState.current) ||
                                lastNavState.current === 'SECURITY_LOCK';

      if (!comingFromNonMain) {
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
      navigationRef.current.navigate(targetRoute as never);
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
    navigationRef.current.navigate(route as never);
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
        {/* Onboarding */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />

        {/* Auth Flow */}
        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        {/* Setup Flow */}
        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Parent2Optional" component={CoParentInviteScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Parent2Setup" component={CoParentSetupScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="BabyOptional" component={BabyOnboardingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CreateBabyProfile" component={BabyProfileCreateScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="AddParent" component={CoParentSetupScreen as any} />
        </Stack.Group>

        {/* Main App */}
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Timeline" component={TimelineScreen} />
        <Stack.Screen name="PottyTracker" component={TimelineScreen} />
        <Stack.Screen name="FeedTracker" component={TimelineScreen} />
        <Stack.Screen name="SleepTracker" component={TimelineScreen} />

        {/* Profile Screens */}
        <Stack.Screen name="Profile" component={FamilyDashboardScreen} />
        <Stack.Screen 
          name="SwitchBaby" 
          component={BabySelectorScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen name="EditProfile" component={BabyProfileScreen} options={{ animation: 'slide_from_right' }} />

        {/* Media & Chat */}
        <Stack.Screen name="EditGuardian" component={EditGuardianScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Gallery" component={GalleryScreen} />
        <Stack.Screen name="FamilyChatList" component={FamilyChatListScreen} />
        <Stack.Screen name="FamilyChat" component={FamilyChatScreen} />

        {/* Settings & Info */}
        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="UnitSettings" component={UnitSettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SafetyCorner" component={SafetyCornerScreen} options={{ animation: 'slide_from_right' }} />

        {/* Vaccination Schedule Screen */}
        <Stack.Screen 
          name="VaccinationSchedule" 
          component={VaccinationScheduleScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Modal Screens */}
        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AddEntry" component={AddEntryScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="GrowthDashboard" component={GrowthDashboardScreen} />
          <Stack.Screen name="TrackerReminders" component={TrackerRemindersScreen} />
          <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
          <Stack.Screen name="SoundMixer" component={SoundMixerScreen} />
          <Stack.Screen name="Customize" component={CustomizeScreen} />
        </Stack.Group>

        {/* Full Screen Security */}
        <Stack.Group screenOptions={{ presentation: 'fullScreenModal', animation: 'fade' }}>
          <Stack.Screen name="SecurityLock" component={SecurityLockScreen} />
          <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
          <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} />
        </Stack.Group>

        {/* Tracker Hub Screens */}
        <Stack.Screen name="UniversalTrackerHub" component={UniversalTrackerHubScreen} />
        <Stack.Screen name="CreateCustomTracker" component={CreateCustomTrackerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


export default function AppNavigator({
  isDark,
  initialState,
  onStateChange,
}: {
  isDark?: boolean;
  initialState?: any;
  onStateChange?: (state: any) => void;
}) {
  return (
    <NavigationContent
      isDark={isDark}
      initialState={initialState}
      onStateChange={onStateChange}
    />
  );
}
