import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  NavigationContainer, 
  NavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, AppState, AppStateStatus } from 'react-native';
import { statePersistence } from '../utils/statePersistence';

const NAVIGATION_STATE_KEY = '@littleloom_nav_state_v1';

interface PersistedNavigationContainerProps {
  children: React.ReactNode;
  isDark: boolean;
  onReady?: () => void;
  fallback?: React.ReactNode;
}

// Custom themes (matching your existing ones)
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

export const PersistedNavigationContainer: React.FC<PersistedNavigationContainerProps> = ({
  children,
  isDark,
  onReady,
  fallback,
}) => {
  const [isReady, setIsReady] = useState(Platform.OS === 'web'); // Don't persist on web
  const [initialState, setInitialState] = useState<any>(undefined);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const currentStateRef = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isNavigatingRef = useRef(false);

  // Restore navigation state on mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        // Check for deep link first
        const initialUrl = await Linking.getInitialURL();
        
        // Only restore if no deep link and not on web
        if (Platform.OS !== 'web' && initialUrl == null) {
          const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
          
          if (savedState) {
            const parsedState = JSON.parse(savedState);
            // Validate the state structure
            if (isValidNavigationState(parsedState)) {
              setInitialState(parsedState);
              console.log('🔄 Restored navigation state:', parsedState);
            } else {
              console.warn('Invalid navigation state found, clearing...');
              await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore navigation state:', error);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  // Save state when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appStateRef.current === 'active' && 
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        // App going to background - save immediately
        if (currentStateRef.current) {
          await persistNavigationState(currentStateRef.current);
        }
        
        // Also save current route for quick restoration
        if (navigationRef.current) {
          const currentRoute = navigationRef.current.getCurrentRoute();
          if (currentRoute) {
            await statePersistence.saveNavigationState(
              currentRoute.name,
              currentRoute.params
            );
          }
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Persist navigation state
  const persistNavigationState = async (state: any) => {
    try {
      await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist navigation state:', error);
    }
  };

  // Handle state changes
  const handleStateChange = useCallback(async (state: any) => {
    currentStateRef.current = state;
    
    // Debounce persistence to avoid excessive writes
    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      
      setTimeout(async () => {
        await persistNavigationState(state);
        
        // Also save to state persistence manager
        if (navigationRef.current) {
          const currentRoute = navigationRef.current.getCurrentRoute();
          if (currentRoute) {
            await statePersistence.saveNavigationState(
              currentRoute.name,
              currentRoute.params
            );
          }
        }
        
        isNavigatingRef.current = false;
      }, 500);
    }
  }, []);

  // Validate navigation state structure
  const isValidNavigationState = (state: any): boolean => {
    if (!state || typeof state !== 'object') return false;
    if (!Array.isArray(state.routes)) return false;
    if (typeof state.index !== 'number') return false;
    return true;
  };

  // Clear persisted state (useful for logout or error recovery)
  const clearPersistedState = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
      await statePersistence.clearAllState();
    } catch (error) {
      console.warn('Failed to clear persisted state:', error);
    }
  }, []);

  // Handle navigation ready
  const handleReady = useCallback(() => {
    onReady?.();
    
    // Restore scroll positions and other screen-specific state
    const currentRoute = navigationRef.current?.getCurrentRoute();
    if (currentRoute) {
      console.log('✅ Navigation ready, current route:', currentRoute.name);
    }
  }, [onReady]);

  if (!isReady) {
    return <>{fallback || null}</>;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={isDark ? CustomDarkTheme : CustomLightTheme}
      initialState={initialState}
      onStateChange={handleStateChange}
      onReady={handleReady}
      fallback={fallback}
    >
      {children}
    </NavigationContainer>
  );
};

// Hook to get the clear function
export const useClearPersistedNavigation = () => {
  const clearState = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
      await statePersistence.clearAllState();
    } catch (error) {
      console.warn('Failed to clear persisted state:', error);
    }
  }, []);

  return clearState;
};

export default PersistedNavigationContainer;
