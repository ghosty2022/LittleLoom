// src/context/NavigationContext.tsx
import React, { 
  createContext, 
  useContext, 
  useRef, 
  useCallback, 
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { 
  NativeScrollEvent, 
  NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigationState } from '@react-navigation/native';
import { registerScrollHandler } from '../utils/GlobalScrollPatch';

interface NavigationContextType {
  // Scroll State
  isNavVisible: boolean;
  isNavCompact: boolean;
  scrollDirection: 'up' | 'down' | null;
  scrollY: number;
  
  // Timeline Specific
  isTimelineFabVisible: boolean;
  currentDate: Date;
  
  // Actions
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  resetScroll: () => void;
  showNav: () => void;
  hideNav: () => void;
  toggleCompact: () => void;
  
  // Route Info
  currentRoute: string;
  isTimelineScreen: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isNavCompact, setIsNavCompact] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isTimelineFabVisible, setIsTimelineFabVisible] = useState(false);
  const [currentDate] = useState(new Date());
  
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const velocityThreshold = 10;

  // Get current route name from navigation state
  const routeName = useNavigationState(state => {
    if (!state) return 'Home';
    const route = state.routes[state.index];
    if (route.state) {
      const nestedState = route.state as any;
      const nestedRoute = nestedState.routes[nestedState.index];
      return nestedRoute.name;
    }
    return route.name;
  });
  
  const isTimelineScreen = routeName === 'Timeline';

  // Auto-show FAB only on Timeline
  useEffect(() => {
    setIsTimelineFabVisible(isTimelineScreen);
  }, [isTimelineScreen]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const delta = currentY - lastScrollY.current;
    
    setScrollY(currentY);
    
    if (Math.abs(delta) > velocityThreshold) {
      const newDirection = delta > 0 ? 'down' : 'up';
      
      if (newDirection !== scrollDirection) {
        setScrollDirection(newDirection);
        
        if (newDirection === 'down' && currentY > 50) {
          setIsNavCompact(true);
        } else if (newDirection === 'up') {
          if (currentY < 100) {
            setIsNavCompact(false);
          }
        }
      }
    }
    
    lastScrollY.current = currentY;
    
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      if (currentY < 50) {
        setIsNavCompact(false);
      }
    }, 150);
  }, [scrollDirection]);

  // FIXED: Use ref to avoid stale closure in global handler
  const handleScrollRef = useRef(handleScroll);
  useEffect(() => {
    handleScrollRef.current = handleScroll;
  }, [handleScroll]);

  // Register scroll handler globally
  useEffect(() => {
    const globalHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollRef.current(event);
    };
    
    return registerScrollHandler(globalHandler);
  }, []);

  const resetScroll = useCallback(() => {
    lastScrollY.current = 0;
    setScrollDirection(null);
    setIsNavVisible(true);
    setIsNavCompact(false);
    setScrollY(0);
  }, []);

  const showNav = useCallback(() => {
    setIsNavVisible(true);
  }, []);

  const hideNav = useCallback(() => {
    setIsNavVisible(false);
  }, []);

  const toggleCompact = useCallback(() => {
    setIsNavCompact(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const value = useMemo(() => ({
    isNavVisible,
    isNavCompact,
    scrollDirection,
    scrollY,
    isTimelineFabVisible,
    currentDate,
    handleScroll,
    resetScroll,
    showNav,
    hideNav,
    toggleCompact,
    currentRoute: routeName,
    isTimelineScreen,
  }), [
    isNavVisible,
    isNavCompact,
    scrollDirection,
    scrollY,
    isTimelineFabVisible,
    currentDate,
    handleScroll,
    resetScroll,
    showNav,
    hideNav,
    toggleCompact,
    routeName,
    isTimelineScreen,
  ]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationContext = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }
  return context;
};