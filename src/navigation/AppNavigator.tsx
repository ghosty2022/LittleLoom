// src/navigation/AppNavigator.tsx (Fixed Navigation)
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, AppState, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import CommunityProfileScreen from '../screens/community/CommunityProfileScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import CoParentInviteScreen from '../screens/baby/CoParentInviteScreen';
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
import PediatricianPDFExport from '../screens/tracking/PediatricianPDFExport';

import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import { InlineSpinner } from '../components/UniversalSpinner';
import { useSecurity } from '../context/SecurityContext';
import { useSafeApp, useSafeBaby, useSafeAuth } from '../hooks/useSafeContexts';
import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';
import { supabase } from '@/utils/supabase';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';
const NAV_INITIALIZED_KEY = '@littleloom_nav_initialized_v1';

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
  'Notifications', 'CommunityProfile', 'CommunityVerification', 'CommunityOnboarding',
  'Followers', 'Following', 'Report', 'TopicMembers', 'SearchUsers', 'BlockedUsers',
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
const SETUP_FLOW_SCREENS = new Set(['CoParentInviteScreen', 'BabyOptional', 'CreateBabyProfile']);
const SECURITY_SCREENS = new Set(['SecurityLock', 'BiometricSetup', 'SecurityCenter']);

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
   MAIN TABS
   ═══════════════════════════════════════════════════════════════════════════ */

function MainTabs() {
  const { isDark, colors } = useSafeApp();

  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassNavigation {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: true,
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
      <Tab.Screen name="Track" component={UniversalTrackerHubScreen} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Grow" component={GrowthDashboardScreen} />
      <Tab.Screen name="Connect" component={CommunityNavigator} />
    </Tab.Navigator>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDATE SESSION
   ═══════════════════════════════════════════════════════════════════════════ */

async function validateSupabaseSession(): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.log('[Navigation] Session validation failed:', error?.message || 'No user');
      return false;
    }
    console.log('[Navigation] Session validated for user:', user.id);
    return true;
  } catch (error) {
    console.error('[Navigation] Session validation error:', error);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET NAV STATE - FIXED
   ═══════════════════════════════════════════════════════════════════════════ */

function getNavState(
  authLoading: boolean,
  isAuth: boolean,
  isValidSession: boolean,
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
  // ─── FIX: Check auth state first ──────────────────────────────────
  if (authLoading) return 'LOADING';
  
  if (!isAuth || !isValidSession) {
    if (firstOpen && !seenOnboarding) return 'ONBOARDING';
    return 'LOGIN';
  }

  // ─── FIX: Security lock check ─────────────────────────────────────
  // Only show security lock if there's actual security enabled
  if (isLocked && securityOn) {
    return 'SECURITY_LOCK';
  }

  // ─── FIX: Check if baby is addressed ─────────────────────────────
  const babyAddressed = hasBaby === true || hasBaby === 'skipped' || babyCount > 0;
  const p2Addressed = hasP2 === true || hasP2 === 'skipped';
  
  // ─── FIX: Setup is complete if both steps are addressed ─────────
  const isActuallySetupComplete = setupDone || (babyAddressed && p2Addressed);

  // ─── FIX: If setup is complete, go to MAIN ──────────────────────
  if (isActuallySetupComplete) {
    return 'MAIN';
  }

  // ─── FIX: Otherwise navigate to setup screens ────────────────────
  if (!babyAddressed) return 'SETUP_BABY';
  if (!p2Addressed) return 'SETUP_PARENT2';

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
  const { isSecurityLocked, checkSecurityOnResume, settings: secSettings, resetUnlockLock, forceUnlock } = useSecurity();

  const [navState, setNavState] = useState<NavigationState>('LOADING');
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [isNavReady, setIsNavReady] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(false);
  const [babiesReady, setBabiesReady] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const navRef = navigationRef;
  const lastNavState = useRef<NavigationState>('LOADING');
  const appState = useRef(AppState.currentState);
  const isNavigating = useRef(false);
  const lastNavTime = useRef(0);
  const wasOnSecurityLock = useRef(false);
  const lastSecCheck = useRef(0);
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const babiesLoaded = useRef(false);
  const firstOpenChecked = useRef(false);
  const hasInitializedNav = useRef(false);
  const isMounted = useRef(true);
  const effectRunCount = useRef(0);
  const navReadyCalled = useRef(false);

  const babyCountRef = useRef(0);
  const hasSkippedBabyRef = useRef(false);

  const checkSecurityOnResumeRef = useRef(checkSecurityOnResume);
  const loadBabiesRef = useRef(loadBabies);
  const resetUnlockLockRef = useRef(resetUnlockLock);
  const forceUnlockRef = useRef(forceUnlock);

  // ─── Validate session ────────────────────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      if (!isAuthenticated) {
        setIsValidSession(false);
        setSessionChecked(true);
        return;
      }
      
      const valid = await validateSupabaseSession();
      setIsValidSession(valid);
      setSessionChecked(true);
      
      if (!valid && isMounted.current) {
        console.log('[Navigation] Session invalid, forcing logout state');
      }
    };
    
    checkSession();
  }, [isAuthenticated]);

  // ─── Load persisted nav state ────────────────────────────────────────
  useEffect(() => {
    const loadNavState = async () => {
      try {
        const val = await AsyncStorage.getItem(NAV_INITIALIZED_KEY);
        if (val === 'true') {
          hasInitializedNav.current = true;
          console.log('[Navigation] Loaded persisted nav initialized state: true');
        }
      } catch (e) {
        // Ignore
      }
    };
    loadNavState();
  }, []);

  // ─── Save nav initialized ────────────────────────────────────────────
  const saveNavInitialized = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(NAV_INITIALIZED_KEY, value ? 'true' : 'false');
    } catch (e) {
      // Ignore
    }
  }, []);

  // ─── Update refs ─────────────────────────────────────────────────────
  useEffect(() => {
    checkSecurityOnResumeRef.current = checkSecurityOnResume;
    loadBabiesRef.current = loadBabies;
    resetUnlockLockRef.current = resetUnlockLock;
    forceUnlockRef.current = forceUnlock;
  }, [checkSecurityOnResume, loadBabies, resetUnlockLock, forceUnlock]);

  const securityOn = useMemo(() =>
    !!(secSettings?.isPinEnabled || secSettings?.isBiometricEnabled || secSettings?.isAppLockEnabled),
    [secSettings?.isPinEnabled, secSettings?.isBiometricEnabled, secSettings?.isAppLockEnabled]
  );

  const stackScreenOptions = useMemo(() => ({
    headerShown: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: colors?.background || '#f8faff' },
  }), [colors?.background]);

  // ─── Check first open ────────────────────────────────────────────────
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

  // ─── Update refs for babies ──────────────────────────────────────────
  useEffect(() => {
    const newCount = babies?.length || 0;
    babyCountRef.current = newCount;
    hasSkippedBabyRef.current = hasSkippedBaby;
  }, [babies?.length, hasSkippedBaby]);

  // ─── Compute nav state ──────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !firstOpenChecked.current || !sessionChecked) return;
    if (isAuthenticated && !babiesReady) return;

    const newState = getNavState(
      authLoading,
      isAuthenticated,
      isValidSession,
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

    if (newState !== lastNavState.current) {
      if (lastNavState.current === 'SECURITY_LOCK' && newState === 'MAIN') {
        wasOnSecurityLock.current = true;
        setTimeout(() => { wasOnSecurityLock.current = false; }, 3000);
      }
      lastNavState.current = newState;
      setNavState(newState);
      console.log('[Navigation] State changed to:', newState);
    }

    if (!initialCheckDone) setInitialCheckDone(true);
  }, [
    authLoading,
    isAuthenticated,
    isValidSession,
    sessionChecked,
    isSecurityLocked,
    securityOn,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
    isFirstOpen,
    babiesReady,
    babies?.length,
  ]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // ─── Load babies ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && isValidSession && !authLoading && !babiesLoaded.current) {
      babiesLoaded.current = true;
      loadBabies().finally(() => {
        if (isMounted.current) setBabiesReady(true);
      });
    }
  }, [isAuthenticated, isValidSession, authLoading]);

  // ─── AppState listener ──────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const previous = appState.current;
      appState.current = next;

      if ((previous === 'background' || previous === 'inactive') && next === 'active') {
        await new Promise(r => setTimeout(r, 30));

        const currentRoute = navRef.current?.getCurrentRoute()?.name;
        if (currentRoute === 'SecurityLock') {
          // If we're on SecurityLock, reset unlock lock to prevent issues
          resetUnlockLockRef.current();
          return;
        }
        if (wasOnSecurityLock.current) {
          wasOnSecurityLock.current = false;
          return;
        }

        const now = Date.now();
        if (now - lastSecCheck.current < 2000) return;

        if (isAuthenticated && isValidSession) {
          await checkSecurityOnResumeRef.current();
        }

        lastSecCheck.current = now;
        loadBabiesRef.current();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, isValidSession]);

  // ─── State change handler ────────────────────────────────────────────
  const handleStateChange = useCallback((state: any) => {
    if (!state) return;
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => {
      onStateChange?.(state);
      stateTimer.current = null;
    }, 80);
  }, [onStateChange]);

  useEffect(() => {
    return () => {
      if (stateTimer.current) clearTimeout(stateTimer.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // FIXED: MAIN NAVIGATION EFFECT
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!navRef.current?.isReady() || !isNavReady || !initialCheckDone) return;

    const currentRoute = navRef.current.getCurrentRoute()?.name;
    
    console.log('[Navigation] State:', navState, 'Current route:', currentRoute);

    // Prevent multiple rapid navigations
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;

    // ─── LOGIN ──────────────────────────────────────────────────────────
    if (navState === 'LOGIN') {
      if (currentRoute !== 'Login' && currentRoute !== 'Onboarding' && currentRoute !== 'SignUp') {
        console.log('[Navigation] → Login');
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
      return;
    }

    // ─── ONBOARDING ────────────────────────────────────────────────────
    if (navState === 'ONBOARDING') {
      if (currentRoute !== 'Onboarding') {
        console.log('[Navigation] → Onboarding');
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      }
      return;
    }

    // ─── SECURITY_LOCK ────────────────────────────────────────────────
    if (navState === 'SECURITY_LOCK') {
      // ✅ FIXED: Only navigate to SecurityLock if we're not already there
      if (currentRoute !== 'SecurityLock') {
        console.log('[Navigation] → SecurityLock');
        lastNavTime.current = now;
        // Reset unlock lock before showing security lock
        resetUnlockLockRef.current();
        navRef.current.reset({ index: 0, routes: [{ name: 'SecurityLock' }] });
      }
      return;
    }

    // ─── SETUP_BABY ────────────────────────────────────────────────────
    if (navState === 'SETUP_BABY') {
      // If we already have babies, go to Main
      if (babyCountRef.current > 0 || (babies && babies.length > 0)) {
        if (currentRoute !== 'Main' && !SECURITY_SCREENS.has(currentRoute || '')) {
          console.log('[Navigation] → Main (has babies)');
          lastNavTime.current = now;
          navRef.current.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
        return;
      }
      
      if (currentRoute !== 'BabyOptional') {
        console.log('[Navigation] → BabyOptional');
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'BabyOptional' }] });
      }
      return;
    }

    // ─── SETUP_PARENT2 ─────────────────────────────────────────────────
    if (navState === 'SETUP_PARENT2') {
      if (currentRoute !== 'CoParentInviteScreen') {
        console.log('[Navigation] → CoParentInviteScreen');
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'CoParentInviteScreen' }] });
      }
      return;
    }

    // ─── MAIN ──────────────────────────────────────────────────────────
    if (navState === 'MAIN') {
      // If we're on a setup screen, go to Main
      if (currentRoute && SETUP_FLOW_SCREENS.has(currentRoute)) {
        console.log('[Navigation] → Main (from setup)');
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'Main' }] });
        return;
      }
      
      // If we're on a security screen and shouldn't be, force unlock
      if (currentRoute === 'SecurityLock') {
        console.log('[Navigation] Force unlocking from SecurityLock');
        forceUnlockRef.current();
        lastNavTime.current = now;
        navRef.current.reset({ index: 0, routes: [{ name: 'Main' }] });
        return;
      }
      
      // If we're already on a main screen, stay
      if (currentRoute && MAIN_FLOW_SCREENS.has(currentRoute)) {
        return;
      }
      
      // Otherwise navigate to Main
      console.log('[Navigation] → Main');
      lastNavTime.current = now;
      navRef.current.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }

    // ─── Fallback ──────────────────────────────────────────────────────
    console.log('[Navigation] → Fallback to Login');
    lastNavTime.current = now;
    navRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
    
  }, [navState, initialCheckDone, isNavReady, babies, isSecurityLocked]);

  // ─── Handle navigation ready ────────────────────────────────────────
  const handleNavReady = useCallback(() => {
    if (!navReadyCalled.current) {
      navReadyCalled.current = true;
      setIsNavReady(true);
    }
  }, []);

  // ─── Early return ────────────────────────────────────────────────────
  if (authLoading || !initialCheckDone || !sessionChecked) {
    return <AppLoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={handleNavReady}
      key="app-navigation-container"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }} collapsable={false}>
        <Stack.Navigator screenOptions={stackScreenOptions}>
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
            <Stack.Screen name="BabyOptional" component={BabyOnboardingScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="CreateBabyProfile" component={BabyProfileCreateScreen} options={{ gestureEnabled: false }} />
          </Stack.Group>

          {/* MAIN TAB */}
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />

          {/* MAIN SCREENS */}
          <Stack.Screen name="Timeline" component={TimelineScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="PottyTracker" component={TimelineScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="FeedTracker" component={TimelineScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="SleepTracker" component={TimelineScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="CommunityProfile" component={CommunityProfileScreen} options={{ animation: 'slide_from_bottom' }} />
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
          <Stack.Screen name="VaccinationSchedule" component={VaccinationScheduleScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="PediatricianPDFExport" component={PediatricianPDFExport} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SafetyCorner" component={SafetyCornerScreen} options={{ animation: 'none' }} />
          
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
          <Stack.Screen name="AllTrackers" component={TrackScreen} options={{ animation: 'slide_from_right' }} />
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