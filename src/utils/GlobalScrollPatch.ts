/**
 * GLOBAL SCROLL PATCH - Safe wrapper approach
 * Use this hook in components instead of patching RN internals
 */

import { 
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { 
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

// Global scroll handler registry
type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
const scrollHandlers = new Set<ScrollHandler>();

export const registerScrollHandler = (handler: ScrollHandler) => {
  scrollHandlers.add(handler);
  return () => scrollHandlers.delete(handler);
};

export const emitScrollEvent = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  scrollHandlers.forEach(handler => {
    try {
      handler(event);
    } catch (e) {
      console.error('Scroll handler error:', e);
    }
  });
};

/**
 * Hook to track scroll events globally
 * Use this in your ScrollViews/FlatLists instead of onScroll
 */
export const useTrackedScroll = (originalOnScroll?: ScrollHandler) => {
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Emit to global handlers (navigation, etc.)
    emitScrollEvent(event);
    // Call original handler if provided
    originalOnScroll?.(event);
  }, [originalOnScroll]);
};

/**
 * Hook to register a global scroll handler (for NavigationContext)
 */
export const useScrollHandlerRegistration = (handler: ScrollHandler) => {
  const handlerRef = useRef(handler);
  
  // Keep ref updated to avoid stale closures
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  useEffect(() => {
    const wrappedHandler: ScrollHandler = (event) => {
      handlerRef.current(event);
    };
    
    return registerScrollHandler(wrappedHandler);
  }, []);
};

export default {
  registerScrollHandler,
  emitScrollEvent,
  useTrackedScroll,
  useScrollHandlerRegistration,
};