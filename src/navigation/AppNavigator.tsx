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
  hasSeenOnboarding: boolean
): NavigationState {
  if (authLoading) return 'LOADING';
  
  if (!isAuthenticated) {
    if (!hasSeenOnboarding) return 'ONBOARDING';
    return 'LOGIN';
  }
  
  if (!setupComplete) {
    if (!hasParent2) return 'SETUP_PARENT2';
    const hasBabyProfile = babiesCount > 0;
    if (!hasBaby && !hasSkippedBaby && !hasBabyProfile) return 'SETUP_BABY';
  }
  
  if (isSecurityLocked && securityEnabled && setupComplete) {
    return 'SECURITY_LOCK';
  }
  
  return 'MAIN';
}

interface AppNavigatorProps {
  isDark?: boolean;
  initialState?: any; // ADDED: For state persistence
  onStateChange?: (state: any) => void; // ADDED: For state persistence
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
  } = useAuth();
  
  const { 
    babies, 
    isLoading: babyLoading,
    loadBabies,
    hasSkippedBaby,
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
  
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastNavState = useRef<NavigationState>('LOADING');
  const isNavigating = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  const lastNavigationTime = useRef(0);
  const isFirstMount = useRef(true);
  const stateChangeTimeout = useRef<NodeJS.Timeout | null>(null);

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
      hasSeenOnboarding
    );
    
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
    }, 300);
    
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const wasInactive = appState.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';
      
      if (wasInactive && isActive) {
        if (isAuthenticated) {
          if (!setupComplete) {
            if (babies.length === 0 && !babyLoading) {
              loadBabies();
            }
          } else {
            await checkSecurityOnResume();
            loadBabies();
          }
        }
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, checkSecurityOnResume, loadBabies, babies.length, babyLoading, setupComplete]);

  // MODIFIED: Handle navigation state changes with persistence
  const handleStateChange = useCallback((state: any) => {
    // Debounce state changes to avoid excessive writes
    if (stateChangeTimeout.current) {
      clearTimeout(stateChangeTimeout.current);
    }
    
    stateChangeTimeout.current = setTimeout(() => {
      onStateChange?.(state);
      
      // Also save current route to state persistence
      if (navigationRef.current && state) {
        const currentRoute = navigationRef.current.getCurrentRoute();
        if (currentRoute) {
          statePersistence.saveNavigationState(currentRoute.name, currentRoute.params);
        }
      }
    }, 500);
  }, [onStateChange]);

  useEffect(() => {
    if (!navigationRef.current?.isReady() || showSplash || isNavigating.current || !initialCheckDone) return;
    
    const currentRoute = navigationRef.current.getCurrentRoute()?.name;
    
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
    
    if (currentRoute !== targetRoute) {
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
  }, [navState, showSplash, initialCheckDone]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (stateChangeTimeout.current) {
        clearTimeout(stateChangeTimeout.current);
      }
    };
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
      initialState={initialState} // ADDED: Restore persisted state
      onStateChange={handleStateChange} // MODIFIED: Use debounced handler
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
        <Stack.Screen name="SwitchBaby" component={SwitchBabyScreen} />
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
