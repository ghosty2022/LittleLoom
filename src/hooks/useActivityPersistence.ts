import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { statePersistence } from '../utils/statePersistence';

interface ActivityPersistenceOptions {
  onSave?: () => Promise<void> | void;
  onRestore?: () => void;
  saveOnBackground?: boolean;
  saveOnBlur?: boolean;
  debounceMs?: number;
}

/**
 * Hook to track user activity and save state when they become inactive
 * Useful for preventing data loss when user switches apps or gets interrupted
 */
export function useActivityPersistence(options: ActivityPersistenceOptions = {}) {
  const {
    onSave,
    onRestore,
    saveOnBackground = true,
    saveOnBlur = false,
    debounceMs = 1000,
  } = options;

  const navigation = useNavigation();
  const isActiveRef = useRef(true);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Track user activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave();
        console.log('💾 Activity-based save completed');
      } catch (error) {
        console.warn('Failed to save on activity change:', error);
      }
    }
  }, [onSave]);

  // App state change handler
  useEffect(() => {
    if (!saveOnBackground) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const isActive = nextAppState === 'active';
      const wasActive = isActiveRef.current;

      // App going to background
      if (wasActive && !isActive) {
        console.log('📱 App going to background - triggering save');
        
        // Cancel any pending debounced save
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        
        // Save immediately
        InteractionManager.runAfterInteractions(() => {
          handleSave();
        });
      }
      
      // App coming to foreground
      if (!wasActive && isActive) {
        console.log('📱 App returning to foreground');
        onRestore?.();
      }

      isActiveRef.current = isActive;
    });

    return () => subscription.remove();
  }, [saveOnBackground, handleSave, onRestore]);

  // Navigation blur handler (when user leaves screen)
  useEffect(() => {
    if (!saveOnBlur) return;

    const unsubscribe = navigation.addListener('blur', () => {
      console.log('👋 Screen losing focus - triggering save');
      handleSave();
    });

    return unsubscribe;
  }, [navigation, saveOnBlur, handleSave]);

  // Debounced save for active usage
  const triggerDebouncedSave = useCallback(() => {
    recordActivity();
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, debounceMs);
  }, [debounceMs, handleSave, recordActivity]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    recordActivity,
    triggerDebouncedSave,
    isActive: () => isActiveRef.current,
    timeSinceLastActivity: () => Date.now() - lastActivityRef.current,
  };
}

/**
 * Hook specifically for emergency state preservation
 * Saves critical data immediately when app is about to be killed
 */
export function useEmergencySave<T>(
  data: T,
  saveFn: (data: T) => Promise<void> | void,
  options: {
    enabled?: boolean;
    critical?: boolean;
  } = {}
) {
  const { enabled = true, critical = false } = options;
  const dataRef = useRef(data);
  const hasSavedRef = useRef(false);

  // Keep ref updated
  useEffect(() => {
    dataRef.current = data;
    hasSavedRef.current = false;
  }, [data]);

  useEffect(() => {
    if (!enabled) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Save when app goes to background/inactive
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (!hasSavedRef.current) {
          console.log(critical ? '🚨 Critical save triggered' : '💾 Emergency save triggered');
          
          try {
            await saveFn(dataRef.current);
            hasSavedRef.current = true;
          } catch (error) {
            console.error('Emergency save failed:', error);
          }
        }
      }
      
      // Reset save flag when app becomes active again
      if (nextAppState === 'active') {
        hasSavedRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Also save on beforeunload for web (if applicable)
    const handleBeforeUnload = () => {
      if (!hasSavedRef.current) {
        saveFn(dataRef.current);
        hasSavedRef.current = true;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      subscription.remove();
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [enabled, critical, saveFn]);
}

/**
 * Hook to persist component state across remounts
 * Useful for modals, wizards, or multi-step processes
 */
export function useComponentPersistence<T extends Record<string, any>>(
  componentId: string,
  initialState: T,
  options?: {
    persistOnDismount?: boolean;
    restoreOnMount?: boolean;
    expiryMs?: number;
  }
) {
  const {
    persistOnDismount = true,
    restoreOnMount = true,
    expiryMs = 24 * 60 * 60 * 1000, // 24 hours
  } = options || {};

  const [state, setState] = useState<T>(initialState);
  const [isRestored, setIsRestored] = useState(false);

  // Restore on mount
  useEffect(() => {
    if (!restoreOnMount) {
      setIsRestored(true);
      return;
    }

    const restore = async () => {
      const saved = await statePersistence.getDraft(componentId);
      
      if (saved?.data && saved?.timestamp) {
        const isExpired = Date.now() - saved.timestamp > expiryMs;
        
        if (!isExpired) {
          setState(prev => ({ ...prev, ...saved.data }));
        }
      }
      
      setIsRestored(true);
    };

    restore();
  }, [componentId, restoreOnMount, expiryMs]);

  // Persist on dismount
  useEffect(() => {
    return () => {
      if (persistOnDismount) {
        statePersistence.saveDraft(componentId, state);
      }
    };
  }, [componentId, state, persistOnDismount]);

  const clearPersistedState = useCallback(async () => {
    await statePersistence.saveDraft(componentId, null);
    setState(initialState);
  }, [componentId, initialState]);

  const updateState = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
  }, []);

  return {
    state,
    setState: updateState,
    isRestored,
    clearPersistedState,
  };
}
