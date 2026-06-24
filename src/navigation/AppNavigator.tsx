
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, AppState, TouchableOpacity, StatusBar } from 'react-native';
import {
  NavigationContainer, DefaultTheme, DarkTheme, NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import InsightsScreen from '../screens/tracking/InsightsScreen';
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

// Safe import with fallback for LiquidGlassNavigation
let LiquidGlassNavigation: React.FC<any>;
try {
  const lgModule = require('../components/LiquidGlassNavigation');
  LiquidGlassNavigation = lgModule.default || lgModule.LiquidGlassNavigation || lgModule;
} catch (e) {
  console.warn('Failed to load LiquidGlassNavigation, using fallback tab bar', e);
  LiquidGlassNavigation = ({ state, descriptors, navigation }: any) => null;
}

import { UniversalSpinner } from '../components/UniversalSpinner';
import { useSecurity } from '../context/SecurityContext';
import { useSafeApp, useSafeBaby, useSafeAuth } from '../hooks/useSafeContexts';
import { statePersistence } from '../utils/statePersistence';
import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

const CustomLightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#f8faff', card: '#ffffff', text: '#1a1a1a', border: '#e2e8f0', notification: '#667eea', primary: '#667eea' },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#000000', card: '#0a0a0a', text: '#ffffff', border: '#1a1a1a', notification: '#a3bffa', primary: '#a3bffa' },
};

const MAIN_FLOW_SCREENS = new Set([
  'Main', 'Home', 'Track', 'Grow', 'Connect', 'More',
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 'Chat', 'ChatList',
  'Notifications', 'CommunityProfile', 'Followers', 'Following', 'Report',
  'Timeline', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'SwitchBaby', 'EditProfile', 'EditGuardian',
  'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddEntry', 'Achievements', 'GrowthDashboard', 'Insights', 'TrackerReminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings',
  'UniversalTrackerHub', 'CreateCustomTracker',
  'VaccinationSchedule', 'SafetyCorner',
]);

const AUTH_FLOW_SCREENS = new Set(['Onboarding', 'Login', 'SignUp', 'ForgotPassword']);
const SETUP_FLOW_SCREENS = new Set(['Parent2Optional', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent']);

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER COMPONENTS — For screens that explicitly want headers
   ═══════════════════════════════════════════════════════════════════════════ */

function HeaderRightWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
      {children}
    </View>
  );
}

function HeaderIconButton({ 
  icon, 
  onPress, 
  color = '#667eea', 
  size = 22 
}: { 
  icon: keyof typeof Ionicons.glyphMap; 
  onPress: () => void; 
  color?: string; 
  size?: number;
}) {
  return (
    <TouchableOpacity 
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCREEN OPTIONS — Default: NO header. Only opt-in per screen.
   ═══════════════════════════════════════════════════════════════════════════ */

const getScreenOptions = (colors: any, isDark: boolean) => ({
  headerShown: false,
  headerStyle: { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' },
  headerTintColor: colors?.primary || '#667eea',
  headerTitleStyle: { fontWeight: '800', fontSize: 17, letterSpacing: -0.3 },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  animation: 'slide_from_right' as const,
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN TABS — With Liquid Glass Navigation
   ═══════════════════════════════════════════════════════════════════════════ */

function MainTabs() {
  const { isDark, colors } = useSafeApp();

  return (
    <Tab.Navigator
      tabBar={(props) => {
        if (typeof LiquidGlassNavigation !== 'function') {
          console.error('LiquidGlassNavigation is not a valid component:', typeof LiquidGlassNavigation, LiquidGlassNavigation);
          return null;
        }
        return <LiquidGlassNavigation {...props} />;
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors?.navBackground || '#ffffff', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 },
        sceneStyle: { backgroundColor: colors?.background || '#f8faff' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Grow" component={GrowthDashboardScreen} />
      <Tab.Screen name="Connect" component={CommunityNavigator} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAV STATE COMPUTATION
   ═══════════════════════════════════════════════════════════════════════════ */

function getNavState(
  authLoading: boolean,
  isAuth: boolean,
  isLocked: boolean,
  securityOn: boolean,
  setupDone: boolean,
  hasP2: boolean | 'skipped',
  hasBaby: boolean | 'skipped',
  babyCount: number,
  skippedBaby: boolean,
  seenOnboarding: boolean,
  firstOpen: boolean,
): NavigationState {
  if (authLoading) return 'LOADING';
  if (isAuth) {
    if (isLocked && securityOn && setupDone) return 'SECURITY_LOCK';
    if (!setupDone) {
      if (hasP2 !== true && hasP2 !== 'skipped') return 'SETUP_PARENT2';
      const babyDone = hasBaby === true || hasBaby === 'skipped' || babyCount > 0;
      if (!babyDone) return 'SETUP_BABY';
      return 'MAIN';
    }
    return 'MAIN';
  }
  if (firstOpen && !seenOnboarding) return 'ONBOARDING';
  if (!isAuth) return 'LOGIN';
  return 'MAIN';
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

const AppLoadingScreen = React.memo(() => {
  const { colors } = useSafeApp();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors?.background || '#f8faff' }}>
      <UniversalSpinner size={48} color={colors?.primary || '#667eea'} />
      <Text style={{ marginTop: 24, fontSize: 16, color: colors?.text || '#1a1a1a', fontWeight: '500' }}>
        Getting everything ready...
      </Text>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

function NavigationContent({
  isDark: propIsDark,
  initialState,
  onStateChange,
}: {
  isDark?: boolean;
  initialState?: any;
  onStateChange?: (state: any) => void;
}) {
  const { isDark: ctxDark, colors } = useSafeApp();
  const isDark = propIsDark ?? ctxDark;

  const {
    isLoading: authLoading,
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
  } = useSafeAuth();

  const { babies, loadBabies, hasSkippedBaby } = useSafeBaby();
  const { isSecurityLocked, checkSecurityOnResume, settings: secSettings } = useSecurity();

  const [navState, setNavState] = useState<NavigationState>('LOADING');
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [shouldShowSwitchBaby, setShouldShowSwitchBaby] = useState(false);
  const [isNavReady, setIsNavReady] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(false);

  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const lastNavState = useRef<NavigationState>('LOADING');
  const isNavigating = useRef(false);
  const lastNavTime = useRef(0);
  const hasShownSwitchBaby = useRef(false);
  const wasOnSecurityLock = useRef(false);
  const lastSecCheck = useRef(0);
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const babiesLoaded = useRef(false);

  const securityOn = useMemo(() =>
    !!(secSettings?.isPinEnabled || secSettings?.isBiometricEnabled),
    [secSettings?.isPinEnabled, secSettings?.isBiometricEnabled]
  );

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then(v => {
      const complete = v === 'true';
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then(v2 => {
        setIsFirstOpen(!(complete || v2 === 'true'));
      }).catch(() => setIsFirstOpen(false));
    }).catch(() => setIsFirstOpen(false));
  }, []);

  useEffect(() => {
    if (authLoading || isFirstOpen === undefined) return;

    const newState = getNavState(
      authLoading, isAuthenticated, isSecurityLocked, securityOn,
      setupComplete, hasParent2, hasBaby, babies?.length || 0,
      hasSkippedBaby, hasSeenOnboarding, isFirstOpen,
    );

    if (newState === 'MAIN' && lastNavState.current !== 'MAIN' &&
        babies?.length > 1 && !hasShownSwitchBaby.current &&
        isAuthenticated && setupComplete && !isFirstOpen) {
      setShouldShowSwitchBaby(true);
    }

    if (newState !== lastNavState.current) {
      if (lastNavState.current === 'SECURITY_LOCK' && newState === 'MAIN') {
        wasOnSecurityLock.current = true;
        setTimeout(() => { wasOnSecurityLock.current = false; }, 3000);
      }
      lastNavState.current = newState;
      setNavState(newState);
    }

    setInitialCheckDone(true);
  }, [authLoading, isAuthenticated, isSecurityLocked, securityOn, setupComplete,
      hasParent2, hasBaby, babies?.length, hasSkippedBaby, hasSeenOnboarding, isFirstOpen]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !babiesLoaded.current) {
      babiesLoaded.current = true;
      loadBabies();
    }
  }, [isAuthenticated, authLoading, loadBabies]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const current = AppState.currentState;
      const wasBg = current === 'background' || current === 'inactive';

      if (current === 'active' && (next === 'inactive' || next === 'background')) {
        try {
          const route = navRef.current?.getCurrentRoute();
          const state = navRef.current?.getRootState();
          if (route?.name !== 'SecurityLock' && state && route) {
            await statePersistence.saveNavigationState(state, route.name, route.params);
            await statePersistence.saveLastRoute(route.name, route.params);
          }
        } catch (e) {
          console.warn('Save state failed:', e);
        }
      }

      if (wasBg && next === 'active' && isAuthenticated && setupComplete) {
        const currentRoute = navRef.current?.getCurrentRoute()?.name;
        if (currentRoute === 'SecurityLock') return;
        if (wasOnSecurityLock.current) { wasOnSecurityLock.current = false; return; }

        const now = Date.now();
        if (now - lastSecCheck.current < 3000) return;
        await checkSecurityOnResume();
        lastSecCheck.current = now;
        loadBabies();
      }
    });
    return () => sub.remove();
  }, []);

  const handleStateChange = useCallback((state: any) => {
    if (!state) return;
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => {
      onStateChange?.(state);
      const route = navRef.current?.getCurrentRoute();
      if (route && route.name !== 'SecurityLock') {
        statePersistence.saveNavigationState(state, route.name, route.params);
        statePersistence.saveLastRoute(route.name, route.params);
      }
      stateTimer.current = null;
    }, 300);
  }, [onStateChange]);

  useEffect(() => () => {
    if (stateTimer.current) clearTimeout(stateTimer.current);
  }, []);

  useEffect(() => {
    if (!navRef.current?.isReady() || !isNavReady || isNavigating.current || !initialCheckDone) return;

    const currentRoute = navRef.current.getCurrentRoute()?.name;
    if (shouldShowSwitchBaby && !hasShownSwitchBaby.current) {
      hasShownSwitchBaby.current = true;
      setShouldShowSwitchBaby(false);
      if (currentRoute !== 'SwitchBaby') {
        navRef.current.navigate('SwitchBaby' as never);
        return;
      }
    }

    const routeMap: Record<NavigationState, keyof RootStackParamList> = {
      LOADING: 'Login', ONBOARDING: 'Onboarding', LOGIN: 'Login',
      SETUP_PARENT2: 'Parent2Optional', SETUP_BABY: 'BabyOptional',
      SECURITY_LOCK: 'SecurityLock', MAIN: 'Main',
    };
    const target = routeMap[navState];
    if (currentRoute === target) return;

    if (navState === 'MAIN' && currentRoute && MAIN_FLOW_SCREENS.has(currentRoute)) {
      const fromNonMain = AUTH_FLOW_SCREENS.has(lastNavState.current) ||
                          SETUP_FLOW_SCREENS.has(lastNavState.current) ||
                          lastNavState.current === 'SECURITY_LOCK';
      if (!fromNonMain) return;
    }

    const now = Date.now();
    if (now - lastNavTime.current < 800) return;

    isNavigating.current = true;
    lastNavTime.current = now;

    const shouldReset = navState === 'LOGIN' || navState === 'MAIN' || navState === 'SECURITY_LOCK' || navState === 'ONBOARDING';
    if (shouldReset) {
      navRef.current.reset({ index: 0, routes: [{ name: target }] });
    } else {
      navRef.current.navigate(target as never);
    }

    setTimeout(() => { isNavigating.current = false; }, 600);
    lastNavState.current = navState;
  }, [navState, initialCheckDone, shouldShowSwitchBaby, isNavReady]);

  if (authLoading || !initialCheckDone) return <AppLoadingScreen />;

  const screenOptions = getScreenOptions(colors, isDark);
  const primaryColor = colors?.primary || '#667eea';

  return (
    <NavigationContainer
      ref={navRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={() => setIsNavReady(true)}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors?.background || '#f8faff' } }}>
        {/* AUTH FLOW */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        {/* SETUP FLOW */}
        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Parent2Optional" component={CoParentInviteScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Parent2Setup" component={CoParentSetupScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="BabyOptional" component={BabyOnboardingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CreateBabyProfile" component={BabyProfileCreateScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="AddParent" component={CoParentSetupScreen} />
        </Stack.Group>

        {/* MAIN TAB (no header) */}
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />

        {/* MAIN SCREENS — NO HEADERS by default */}
        <Stack.Screen name="Timeline" component={TimelineScreen} />
        <Stack.Screen name="PottyTracker" component={TimelineScreen} />
        <Stack.Screen name="FeedTracker" component={TimelineScreen} />
        <Stack.Screen name="SleepTracker" component={TimelineScreen} />

        <Stack.Screen name="Profile" component={FamilyDashboardScreen} />
        <Stack.Screen name="SwitchBaby" component={BabySelectorScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="EditProfile" component={BabyProfileScreen} />
        <Stack.Screen name="EditGuardian" component={EditGuardianScreen} />

        <Stack.Screen name="Gallery" component={GalleryScreen} />

        <Stack.Screen name="FamilyChatList" component={FamilyChatListScreen} />
        <Stack.Screen name="FamilyChat" component={FamilyChatScreen} />

        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        <Stack.Screen name="UnitSettings" component={UnitSettingsScreen} />

        <Stack.Screen name="SafetyCorner" component={SafetyCornerScreen} />
        <Stack.Screen name="VaccinationSchedule" component={VaccinationScheduleScreen} />

        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AddEntry" component={AddEntryScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="GrowthDashboard" component={GrowthDashboardScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="TrackerReminders" component={TrackerRemindersScreen} />
          <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
          <Stack.Screen name="SoundMixer" component={SoundMixerScreen} />
          <Stack.Screen name="Customize" component={CustomizeScreen} />
        </Stack.Group>

        <Stack.Group screenOptions={{ presentation: 'fullScreenModal', animation: 'fade' }}>
          <Stack.Screen name="SecurityLock" component={SecurityLockScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
          <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} />
        </Stack.Group>

        <Stack.Screen name="UniversalTrackerHub" component={UniversalTrackerHubScreen} />
        <Stack.Screen name="CreateCustomTracker" component={CreateCustomTrackerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator({ isDark, initialState, onStateChange }: {
  isDark?: boolean; initialState?: any; onStateChange?: (state: any) => void;
}) {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContent isDark={isDark} initialState={initialState} onStateChange={onStateChange} />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
