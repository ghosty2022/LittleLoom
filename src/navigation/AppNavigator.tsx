
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  useColorScheme,
  AppState,
  AppStateStatus,
} from 'react-native';
import { 
  NavigationContainer, 
  DefaultTheme, 
  DarkTheme, 
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { InteractionManager } from 'react-native';

// Import screens directly - NO lazy loading
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
import TimelineScreen from '../screens/TimelineScreen';
import SafetyCornerScreen from '../screens/SafetyCornerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import TopicScreen from '../screens/community/TopicScreen';
import CreatePostScreen from '../screens/community/CreatePostScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import ChatScreen from '../screens/community/ChatScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import NotificationsScreen from '../screens/community/NotificationsScreen';
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

// Components
import LiquidGlassNavigation from '../components/LiquidGlassNavigation';
import UniversalSpinner from '../components/UniversalSpinner';

// Contexts
import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import { useSecurity } from '../context/SecurityContext';
import { NavigationProvider } from '../context/NavigationContext';

// State persistence
import { statePersistence } from '../utils/statePersistence';

import { RootStackParamList, MainTabParamList, NavigationState } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const CommunityStackNavigator = createNativeStackNavigator();

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

function CommunityStack() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <CommunityStackNavigator.Navigator 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: isDark ? '#000000' : '#f8faff',
        },
      }}
    >
      <CommunityStackNavigator.Screen name="CommunityMain" component={CommunityScreen} />
      <CommunityStackNavigator.Screen name="Topic" component={TopicScreen} />
      <CommunityStackNavigator.Screen name="CreatePost" component={CreatePostScreen} />
      <CommunityStackNavigator.Screen name="PostDetail" component={PostDetailScreen} />
      <CommunityStackNavigator.Screen name="Chat" component={ChatScreen} />
      <CommunityStackNavigator.Screen name="UserProfile" component={UserProfileScreen} />
      <CommunityStackNavigator.Screen name="Notifications" component={NotificationsScreen} />
    </CommunityStackNavigator.Navigator>
  );
}

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
        <Tab.Screen name="Community" component={CommunityStack} />
        <Tab.Screen name="Timeline" component={TimelineScreen} />
        <Tab.Screen name="SafetyCorner" component={SafetyCornerScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationProvider>
  );
}

// ============================================
// CORRECTED NAVIGATION STATE LOGIC
// ============================================
// FLOW:
// 1. Splash (always first)
// 2. First-time user (hasSeenOnboarding = false): Onboarding → Login → Setup (Parent2/Baby)
// 3. Existing user (hasSeenOnboarding = true): Login → [SwitchBaby if >1 babies] → Main
// 4. Setup only happens ONCE for first-time users after their first login
// ============================================

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
  isFirstTimeLogin: boolean // NEW: Track if this is the first login after onboarding
): NavigationState {
  
  if (authLoading) return 'LOADING';
  
  // NOT AUTHENTICATED: Show Onboarding first time, otherwise Login
  if (!isAuthenticated) {
    // First time ever user - show onboarding before login
    if (!hasSeenOnboarding) {
      return 'ONBOARDING';
    }
    // Returning user - straight to login
    return 'LOGIN';
  }
  
  // AUTHENTICATED - Check security lock first
  if (isSecurityLocked && securityEnabled && setupComplete) {
    return 'SECURITY_LOCK';
  }
  
  // AUTHENTICATED - Check if setup is needed (only for first-time users)
  // setupComplete = false means they haven't completed the initial setup flow yet
  if (!setupComplete) {
    // Check if they need to add Parent 2
    if (!hasParent2) {
      return 'SETUP_PARENT2';
    }
    
    // Check if they need to add Baby
    const hasBabyProfile = babiesCount > 0;
    if (!hasBaby && !hasSkippedBaby && !hasBabyProfile) {
      return 'SETUP_BABY';
    }
  }
  
  // AUTHENTICATED + Setup Complete - Check for multiple babies
  // If user has more than 1 baby, show SwitchBaby screen
  if (babiesCount > 1) {
    // We could return a special state here, but for now we'll handle in Main
    // or you can add a 'SWITCH_BABY' state if you want it as a separate screen
    // For now, we'll navigate to Main and let the screen handle it
    // Actually, let's add logic to show SwitchBaby before Main
    // This is handled by navigation.replace in the component
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
  } = useSecurity();

  const [showSplash, setShowSplash] = useState(true);
  const [navState, setNavState] = useState<NavigationState>('LOADING');
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [shouldShowSwitchBaby, setShouldShowSwitchBaby] = useState(false);
  
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastNavState = useRef<NavigationState>('LOADING');
  const isNavigating = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  const lastNavigationTime = useRef(0);
  const isFirstMount = useRef(true);
  const stateChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasShownSwitchBaby = useRef(false);

  const securityEnabled = useMemo(() => 
    securitySettings.isPinEnabled || securitySettings.isBiometricEnabled,
    [securitySettings.isPinEnabled, securitySettings.isBiometricEnabled]
  );

  // Register forceUnlock callback for setup completion
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

  // Calculate navigation state
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
      false // isFirstTimeLogin - determined by setupComplete check
    );
    
    // Check if we should show Switch Baby screen
    // Only show once per session when user has >1 babies and just logged in
    if (newState === 'MAIN' && 
        babies.length > 1 && 
        !hasShownSwitchBaby.current && 
        isAuthenticated && 
        setupComplete) {
      setShouldShowSwitchBaby(true);
    }
    
    if (newState !== lastNavState.current) {
      console.log('🧭 Navigation state:', lastNavState.current, '->', newState);
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

  // Handle splash screen timing
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
    }, 1500); // Slightly longer splash for better UX
    
    return () => clearTimeout(timer);
  }, []);

  // Load babies when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      InteractionManager.runAfterInteractions(() => {
        loadBabies();
      });
    }
  }, [isAuthenticated, authLoading, loadBabies]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInactive = appState.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';
      
      if (wasInactive && isActive) {
        if (isAuthenticated) {
          if (!setupComplete) {
            // Still in setup flow, reload babies if needed
            if (babies.length === 0 && !babyLoading) {
              loadBabies();
            }
          } else {
            // Fully set up user - check security and reload
            await checkSecurityOnResume();
            loadBabies();
            
            // Reset switch baby flag when coming back to app
            // (optional - depends if you want to show it every time)
            // hasShownSwitchBaby.current = false;
          }
        }
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, checkSecurityOnResume, loadBabies, babies.length, babyLoading, setupComplete]);

  // Handle state persistence
  const handleStateChange = useCallback((state: any) => {
    if (stateChangeTimeout.current) {
      clearTimeout(stateChangeTimeout.current);
    }
    
    stateChangeTimeout.current = setTimeout(() => {
      onStateChange?.(state);
      
      if (navigationRef.current && state) {
        const currentRoute = navigationRef.current.getCurrentRoute();
        if (currentRoute) {
          statePersistence.saveNavigationState(currentRoute.name, currentRoute.params);
        }
      }
    }, 500);
  }, [onStateChange]);

  // Handle navigation based on state
  useEffect(() => {
    if (!navigationRef.current?.isReady() || showSplash || isNavigating.current || !initialCheckDone) return;
    
    const currentRoute = navigationRef.current.getCurrentRoute()?.name;
    
    // Handle Switch Baby screen before Main if needed
    if (shouldShowSwitchBaby && !hasShownSwitchBaby.current) {
      hasShownSwitchBaby.current = true;
      setShouldShowSwitchBaby(false);
      
      // Navigate to SwitchBaby first, then it will go to Main
      if (currentRoute !== 'SwitchBaby') {
        console.log('🔄 Navigating to SwitchBaby (multiple babies detected)');
        navigationRef.current.navigate('SwitchBaby');
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
    
    if (currentRoute !== targetRoute && currentRoute !== 'SwitchBaby') {
      const now = Date.now();
      if (now - lastNavigationTime.current < 1000) {
        return;
      }
      
      console.log('🔄 Navigating:', currentRoute, '->', targetRoute);
      
      isNavigating.current = true;
      lastNavigationTime.current = now;
      
      const shouldReset = 
        navState === 'LOGIN' || 
        navState === 'MAIN' || 
        navState === 'SECURITY_LOCK' ||
        navState === 'SETUP_PARENT2' ||
        navState === 'SETUP_BABY' ||
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
      }, 1000);
    }
  }, [navState, showSplash, initialCheckDone, shouldShowSwitchBaby]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (stateChangeTimeout.current) {
        clearTimeout(stateChangeTimeout.current);
      }
    };
  }, []);

  // Show loading states
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
        {/* Initial Screens */}
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        
        {/* Auth Screens */}
        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        {/* Setup Screens - Only for first-time users */}
        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Parent2Optional" component={Parent2OptionalScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Parent2Setup" component={Parent2SetupScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="BabyOptional" component={BabyOptionalScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="CreateBabyProfile" component={CreateBabyProfileScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="AddParent" component={AddParentScreen} />
        </Stack.Group>

        {/* Main App */}
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade', gestureEnabled: false }} />

        {/* Feature Screens */}
        <Stack.Screen name="UniversalTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="PottyTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="FeedTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="SleepTracker" component={UniversalTrackerScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        
        {/* Switch Baby Screen - Shown conditionally */}
        <Stack.Screen 
          name="SwitchBaby" 
          component={SwitchBabyScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        
        <Stack.Screen 
          name="EditProfile" 
          component={EditProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen 
          name="EditGuardian" 
          component={EditGuardianScreen}
          options={{ animation: 'slide_from_right' }}
        />
        
        <Stack.Screen name="Gallery" component={GalleryScreen} />
        <Stack.Screen name="FamilyChatList" component={FamilyChatListScreen} />
        <Stack.Screen name="FamilyChat" component={FamilyChatScreen} />
        
        {/* Modal Screens */}
        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="AddLog" component={AddLogScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="GrowthChart" component={GrowthChartScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
          <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
          <Stack.Screen name="SoundMixer" component={SoundMixerScreen} />
          <Stack.Screen name="Customize" component={CustomizeScreen} />
        </Stack.Group>

        {/* Security Screens */}
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
