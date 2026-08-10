// src/navigation/AppNavigator.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, AppState, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, DefaultTheme, DarkTheme, NavigationContainerRef,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';

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
import EntryDetailScreen from '../screens/tracking/EntryDetailScreen';
import TrackerRemindersScreen from '../screens/tracking/TrackerRemindersScreen';
import FamilySharingScreen from '../screens/family/FamilySharingScreen';
import FamilySettingsScreen from '../screens/family/FamilySettingsScreen';
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
import InviteCodeScreen from '../screens/family/InviteCodeScreen';

import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import { InlineSpinner } from '../components/UniversalSpinner';
import { useSecurity } from '../context/SecurityContext';
import { useSafeApp, useSafeBaby, useSafeAuth } from '../hooks/useSafeContexts';
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
  'EntryDetail',
  'BiometricSetup', 'SecurityCenter',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings',
  'UniversalTrackerHub', 'CreateCustomTracker',
  'VaccinationSchedule', 'SafetyCorner',
]);

const AUTH_FLOW_SCREENS = new Set(['Onboarding', 'Login', 'SignUp', 'ForgotPassword']);
const SETUP_FLOW_SCREENS = new Set(['CoParentInviteScreen', 'Parent2Setup', 'BabyOptional', 'CreateBabyProfile', 'AddParent']);

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER COMPONENTS
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
   SCREEN OPTIONS
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
   MAIN TABS — Route-based tab bar visibility (NO scroll hiding)
   ═══════════════════════════════════════════════════════════════════════════ */

// Tab bar visibility is handled internally by LiquidGlassNavigation

function MainTabs() {
  const { isDark, colors } = useSafeApp();

  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassNavigation {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: colors?.navBackground || '#ffffff', 
          borderTopWidth: 0, 
          elevation: 0, 
          shadowOpacity: 0,
        },
        sceneStyle: { backgroundColor: colors?.background || '#f8faff' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Grow" component={GrowthDashboardScreen} />
      <Tab.Screen name="Connect" component={CommunityNavigator} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
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
  if (!isAuth) {
    if (firstOpen && !seenOnboarding) return 'ONBOARDING';
    return 'LOGIN';
  }
  
  // isAuth === true from here on
  // Show security lock whenever the context says we're locked (regardless of how we got there)
  if (isLocked && setupDone) return 'SECURITY_LOCK';
  
  if (!setupDone) {
    // Check parent2 setup first - must be completed OR skipped
    const p2Addressed = hasP2 === true || hasP2 === 'skipped';
    if (!p2Addressed) return 'SETUP_PARENT2';
    
    // Then check baby setup - must be completed OR skipped OR have babies
    const babyAddressed = hasBaby === true || hasBaby === 'skipped' || babyCount > 0;
    if (!babyAddressed) return 'SETUP_BABY';
  }
  
  return 'MAIN';
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

const AppLoadingScreen = React.memo(() => {
  const { colors, isDark } = useSafeApp();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#f093fb']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={{ alignItems: 'center', zIndex: 1 }}>
        <InlineSpinner size={56} color="#ffffff" section="main" variant="liquid" />
        <Text style={{ marginTop: 20, fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600', letterSpacing: 0.5 }}>
          Preparing your baby's world...
        </Text>
      </View>
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
  // Switch-baby navigation is now handled imperatively (no state)
  // const [shouldShowSwitchBaby, setShouldShowSwitchBaby] = useState(false);
  const [isNavReady, setIsNavReady] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(false);
  const [babiesReady, setBabiesReady] = useState(false);

  // Shared ref so useAppLock() in App.tsx can navigate imperatively to SecurityLock
  const navRef = navigationRef;
  const lastNavState = useRef<NavigationState>('LOADING');
  const appState = useRef(AppState.currentState);
  const isNavigating = useRef(false);
  const lastNavTime = useRef(0);
  // const hasShownSwitchBaby = useRef(false); // no longer needed — routed directly
  const wasOnSecurityLock = useRef(false);
  const lastSecCheck = useRef(0);
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const babiesLoaded = useRef(false);
  const firstOpenChecked = useRef(false);
  const pendingNavTarget = useRef<string | null>(null);
  const processedNavState = useRef<NavigationState>('LOADING');
  const hasConsumedInitialState = useRef(false);
  // const processedSwitchBaby = useRef(false); // no longer needed
  const isMounted = useRef(true);

  // Refs to track current baby values without causing re-renders
  const babyCountRef = useRef(0);
  const hasSkippedBabyRef = useRef(false);

  // FIX: Use refs for callbacks to keep AppState effect stable
  const checkSecurityOnResumeRef = useRef(checkSecurityOnResume);
  const loadBabiesRef = useRef(loadBabies);
  useEffect(() => {
    checkSecurityOnResumeRef.current = checkSecurityOnResume;
    loadBabiesRef.current = loadBabies;
  }, [checkSecurityOnResume, loadBabies]);

  const securityOn = useMemo(() =>
    !!(secSettings?.isPinEnabled || secSettings?.isBiometricEnabled || secSettings?.isAppLockEnabled),
    [secSettings?.isPinEnabled, secSettings?.isBiometricEnabled, secSettings?.isAppLockEnabled]
  );

  // FIX: Move ALL hooks BEFORE any conditional return
  const stackScreenOptions = useMemo(() => ({
    headerShown: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: colors?.background || '#f8faff' },
  }), [colors?.background]);

  // FIX #1: Load isFirstOpen ONCE using ref guard
  useEffect(() => {
    if (firstOpenChecked.current) return;
    firstOpenChecked.current = true;

    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then(v => {
      const complete = v === 'true';
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then(v2 => {
        const seen = v2 === 'true';
        setIsFirstOpen(!(complete || seen));
      }).catch(() => setIsFirstOpen(false));
    }).catch(() => setIsFirstOpen(false));
  }, []);

  // Keep refs in sync — switch-baby is handled imperatively after MAIN navigation
  useEffect(() => {
    const newCount = babies?.length || 0;
    babyCountRef.current = newCount;
    hasSkippedBabyRef.current = hasSkippedBaby;
  }, [babies?.length, hasSkippedBaby, isAuthenticated, setupComplete, isFirstOpen]);

  // FIX #2: Compute navState with stable deps — wait for babies if authenticated
  const computingNavState = useRef(false);
  useEffect(() => {
    if (authLoading || !firstOpenChecked.current) return;
    if (computingNavState.current) return;
    // For authenticated users, wait until baby list is loaded so we route correctly
    if (isAuthenticated && !babiesReady) return;
    computingNavState.current = true;

    const newState = getNavState(
      authLoading,
      isAuthenticated,
      isSecurityLocked,
      securityOn,
      setupComplete,
      hasParent2,
      hasBaby,
      babyCountRef.current,
      hasSkippedBabyRef.current,
      hasSeenOnboarding,
      isFirstOpen,
    );

    // Switch-baby is handled imperatively after Main navigation (no state)

    if (newState !== lastNavState.current) {
      if (lastNavState.current === 'SECURITY_LOCK' && newState === 'MAIN') {
        wasOnSecurityLock.current = true;
        setTimeout(() => { wasOnSecurityLock.current = false; }, 3000);
      }
      lastNavState.current = newState;
      setNavState(newState);
    }

    if (!initialCheckDone) setInitialCheckDone(true);
    // Defer unlock so parallel setStates in this batch don't re-trigger
    setTimeout(() => { computingNavState.current = false; }, 0);
  }, [
    authLoading,
    isAuthenticated,
    isSecurityLocked,
    securityOn,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
    isFirstOpen,
    babiesReady,
  ]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // FIX #3: Load babies ONCE and track readiness
  useEffect(() => {
    if (isAuthenticated && !authLoading && !babiesLoaded.current) {
      babiesLoaded.current = true;
      loadBabies().finally(() => {
        // Allow one tick for BabyContext state to propagate
        setTimeout(() => {
          if (isMounted.current) setBabiesReady(true);
        }, 50);
      });
    }
  }, [isAuthenticated, authLoading]);

  // FIX #4: AppState listener — check security on EVERY resume when authenticated
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const previous = appState.current;
      appState.current = next;
      
      // Only trigger when coming BACK to active from background/inactive
      if ((previous === 'background' || previous === 'inactive') && next === 'active') {
        // Small delay to let React Native settle
        await new Promise(r => setTimeout(r, 100));
        
        const currentRoute = navRef.current?.getCurrentRoute()?.name;
        
        // Don't re-trigger if already on security lock
        if (currentRoute === 'SecurityLock') return;
        
        // Skip if we just came from security lock (handled by the unlock flow)
        if (wasOnSecurityLock.current) {
          wasOnSecurityLock.current = false;
          return;
        }

        const now = Date.now();
        if (now - lastSecCheck.current < 2000) return;
        
        // ALWAYS check security when authenticated, regardless of setup state
        // (but security lock only shows if setup is done AND security is enabled)
        if (isAuthenticated) {
          await checkSecurityOnResumeRef.current();
        }
        
        lastSecCheck.current = now;
        loadBabiesRef.current();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // FIX: Deduplicated state change handler — forward ONLY to App.tsx prop
  const handleStateChange = useCallback((state: any) => {
    if (!state) return;
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => {
      onStateChange?.(state);
      stateTimer.current = null;
    }, 300);
  }, [onStateChange]);

  useEffect(() => {
    return () => {
      if (stateTimer.current) clearTimeout(stateTimer.current);
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
     SWITCH BABY NAVIGATION — handled imperatively inside main nav effect
     ═══════════════════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN NAVIGATION EFFECT (navState only)
     ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!navRef.current?.isReady() || !isNavReady || !initialCheckDone) return;

    // Deduplicate: skip if we've already processed this navState
    if (navState === processedNavState.current && !pendingNavTarget.current) return;
    processedNavState.current = navState;

    // If we restored state from persistence, let NavigationContainer handle it
    // on first boot. Don't override with a reset to Main.
    if (initialState && !hasConsumedInitialState.current) {
      hasConsumedInitialState.current = true;
      if (navState === 'MAIN') {
        pendingNavTarget.current = 'Main';
        return;
      }
    }

    // Block concurrent navigation
    if (isNavigating.current) return;

    const currentRoute = navRef.current.getCurrentRoute()?.name;

    // Route map
    const routeMap: Record<NavigationState, keyof RootStackParamList> = {
      LOADING: 'Login',
      ONBOARDING: 'Onboarding',
      LOGIN: 'Login',
      SETUP_PARENT2: 'CoParentInviteScreen',
      SETUP_BABY: 'BabyOptional',
      SECURITY_LOCK: 'SecurityLock',
      MAIN: 'Main',
    };
    let target = routeMap[navState];

    // Cold-start optimisation: go straight to baby selector instead of flashing Main
    if (navState === 'MAIN' && babyCountRef.current > 1) {
      target = 'SwitchBaby';
    }
    if (!target) return;

    // Already at the target we want
    if (currentRoute === target) {
      pendingNavTarget.current = null;
      return;
    }

    // Already issued this navigation command and waiting for it to land
    if (pendingNavTarget.current === target) return;

    // If we're already in a main flow screen and navState is MAIN, stay put
    if (navState === 'MAIN' && currentRoute && MAIN_FLOW_SCREENS.has(currentRoute)) {
      const fromNonMain =
        AUTH_FLOW_SCREENS.has(lastNavState.current) ||
        SETUP_FLOW_SCREENS.has(lastNavState.current) ||
        lastNavState.current === 'SECURITY_LOCK';
      if (!fromNonMain) {
        pendingNavTarget.current = null;
        return;
      }

      // Single baby + restored state: let NavigationContainer's initialState do its job
      if (babyCountRef.current <= 1 && fromNonMain && initialState) {
        pendingNavTarget.current = null;
        return;
      }
    }

    // Cooldown guard (800ms) — prevents rapid reset/navigate loops
    const now = Date.now();
    if (now - lastNavTime.current < 800) return;

    isNavigating.current = true;
    lastNavTime.current = now;
    pendingNavTarget.current = target;

    const shouldReset =
      navState === 'LOGIN' ||
      navState === 'MAIN' ||
      navState === 'SECURITY_LOCK' ||
      navState === 'ONBOARDING';
    if (shouldReset) {
      navRef.current.reset({ index: 0, routes: [{ name: target }] });

      // SwitchBaby is now routed directly via target above — no imperative flash
    } else {
      navRef.current.navigate(target as never);
    }

    setTimeout(() => {
      isNavigating.current = false;
      pendingNavTarget.current = null;
    }, 300);
  }, [navState, initialCheckDone, isNavReady, initialState]);

  // Early return MUST come after ALL hooks
  // Keep showing loading until auth + firstOpen are resolved
  // NOTE: Removed babiesReady check to prevent NavigationContainer remount
  // which resets isNavReady and can block post-auth navigation to setup flow
  if (authLoading || !initialCheckDone) {
    return <AppLoadingScreen />;
  }

  // FIX: Wrap in a non-collapsable View to prevent Reanimated index desync
  return (
    <NavigationContainer
      ref={navRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={() => setIsNavReady(true)}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }} collapsable={false}>
        <Stack.Navigator screenOptions={stackScreenOptions} screenListeners={{ focus: () => {} }}>
        {/* AUTH FLOW */}
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen} 
          options={{ animation: 'fade', gestureEnabled: false }} 
        />
        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ gestureEnabled: false, animation: 'none' }}
          />
          <Stack.Screen 
            name="SignUp" 
            component={SignUpScreen}
            options={{ gestureEnabled: false, animation: 'none' }}
          />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        {/* SETUP FLOW */}
        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="CoParentInviteScreen" component={CoParentInviteScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Parent2Setup" component={CoParentSetupScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="BabyOptional" component={BabyOnboardingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CreateBabyProfile" component={BabyProfileCreateScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="AddParent" component={CoParentSetupScreen} />
          <Stack.Screen name="InviteCodeScreen" component={InviteCodeScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack.Group>

        {/* MAIN TAB */}
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />

        {/* MAIN SCREENS */}
        <Stack.Screen name="Timeline" component={TimelineScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="PottyTracker" component={TimelineScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="FeedTracker" component={TimelineScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="SleepTracker" component={TimelineScreen} options={{ animation: 'none' }} />

        <Stack.Screen name="Profile" component={FamilyDashboardScreen} options={{ animation: 'none' }} />
        <Stack.Screen
          name="SwitchBaby"
          component={BabySelectorScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="EditProfile" component={BabyProfileScreen} />
        <Stack.Screen name="EditGuardian" component={EditGuardianScreen} />

        <Stack.Screen name="Gallery" component={GalleryScreen} />

        <Stack.Screen name="FamilyChatList" component={FamilyChatListScreen} />
        <Stack.Screen name="FamilyChat" component={FamilyChatScreen} />

        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="UnitSettings" component={UnitSettingsScreen} options={{ animation: 'none' }} />
       <Stack.Screen name="SafetyCorner" component={SafetyCornerScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="VaccinationSchedule" component={VaccinationScheduleScreen} options={{ animation: 'none' }} />

        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AddEntry" component={AddEntryScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="GrowthDashboard" component={GrowthDashboardScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="TrackerReminders" component={TrackerRemindersScreen} />
          <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
          <Stack.Screen name="FamilySettings" component={FamilySettingsScreen} options={{ animation: 'slide_from_right' }} />
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
        <Stack.Screen name="More" component={MoreScreen} options={{ animation: 'none' }} />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

export default function AppNavigator({ isDark, initialState, onStateChange }: {
  isDark?: boolean; initialState?: any; onStateChange?: (state: any) => void;
}) {
  return (
    <NavigationContent isDark={isDark} initialState={initialState} onStateChange={onStateChange} />
  );
}