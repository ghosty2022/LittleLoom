import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { statePersistence } from '../utils/statePersistence';

export function usePersistedForm<T extends Record<string, any>>(
  screenName: string,
  initialState: T,
  options?: {
    debounceMs?: number;
    onRestore?: (restoredState: T) => void;
    validateBeforeSave?: (state: T) => boolean;
  }
) {
  const [formState, setFormState] = useState<T>(initialState);
  const [isRestored, setIsRestored] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isDirty = useRef(false);

  useEffect(() => {
    const restoreState = async () => {
      const restored = await statePersistence.getFormState(screenName);
      if (restored) {
        const mergedState = { ...initialState, ...restored };
        setFormState(mergedState);
        options?.onRestore?.(mergedState);
      }
      setIsRestored(true);
    };

    restoreState();
  }, [screenName]);

  useEffect(() => {
    if (!isRestored) return;
    if (isDirty.current) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        if (!options?.validateBeforeSave || options.validateBeforeSave(formState)) {
          statePersistence.saveFormState(screenName, formState);
        }
        isDirty.current = false;
      }, options?.debounceMs || 1000);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formState, screenName, isRestored]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isDirty.current) {
          statePersistence.saveFormState(screenName, formState);
        }
      };
    }, [formState, screenName])
  );

  const updateFormState = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    isDirty.current = true;
    setFormState(prev => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
  }, []);

  const clearPersistedState = useCallback(async () => {
    await statePersistence.clearFormState(screenName);
    setFormState(initialState);
    isDirty.current = false;
  }, [screenName, initialState]);

  const saveImmediately = useCallback(async () => {
    await statePersistence.saveFormState(screenName, formState);
    isDirty.current = false;
  }, [formState, screenName]);

  return {
    formState,
    setFormState: updateFormState,
    isRestored,
    clearPersistedState,
    saveImmediately,
    isDirty: () => isDirty.current,
  };
}

export function usePersistedScroll(screenName: string) {
  const scrollPosition = useRef(0);

  useEffect(() => {
    const restoreScroll = async () => {
      const position = await statePersistence.getScrollPosition(screenName);
      scrollPosition.current = position;
    };
    restoreScroll();
  }, [screenName]);

  const onScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollPosition.current = y;
    statePersistence.saveScrollPosition(screenName, y);
  }, [screenName]);

  const scrollToSavedPosition = useCallback((scrollViewRef: any) => {
    if (scrollViewRef.current && scrollPosition.current > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollPosition.current,
          animated: false,
        });
      }, 100);
    }
  }, []);

  return { onScroll, scrollToSavedPosition, scrollPosition: scrollPosition.current };
}

export function usePersistedValue<T>(
  key: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => any;
    deserialize?: (value: any) => T;
  }
) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadValue = async () => {
      const saved = await statePersistence.getDraft(key);
      if (saved?.data !== undefined) {
        const deserialized = options?.deserialize 
          ? options.deserialize(saved.data) 
          : saved.data;
        setValue(deserialized);
      }
      setIsLoaded(true);
    };
    loadValue();
  }, [key]);

  useEffect(() => {
    if (isLoaded) {
      const serialized = options?.serialize ? options.serialize(value) : value;
      statePersistence.saveDraft(key, serialized);
    }
  }, [value, key, isLoaded]);

  return { value, setValue, isLoaded };
}