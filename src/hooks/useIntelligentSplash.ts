import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SPLASH_KEYS = {
  MAIN_APP_SHOWN: '@littleloom_main_splash_shown',
  COMMUNITY_SHOWN: '@littleloom_community_splash_shown',
  LAST_SPLASH_DATE: '@littleloom_last_splash_date',
  SPLASH_FREQUENCY: '@littleloom_splash_frequency', // 'always', 'daily', 'weekly', 'never'
  SECTION_PREFERENCES: '@littleloom_section_preferences',
} as const;

export type SplashSection = 'main' | 'community';
export type SplashFrequency = 'always' | 'daily' | 'weekly' | 'never';

export interface SplashConfig {
  frequency: SplashFrequency;
  showOnColdStart: boolean;
  showOnSectionSwitch: boolean;
  minSplashInterval: number; // ms
  respectReduceMotion: boolean;
  respectCompactView: boolean;
}

export interface SectionState {
  lastVisited: number;
  visitCount: number;
  onboardingComplete: boolean;
  topicSelected: boolean;
  firstTime: boolean;
}

export const DEFAULT_SPLASH_CONFIG: SplashConfig = {
  frequency: 'daily',
  showOnColdStart: true,
  showOnSectionSwitch: true,
  minSplashInterval: 300000, // 5 minutes
  respectReduceMotion: true,
  respectCompactView: true,
};


export async function loadSplashConfig(): Promise<SplashConfig> {
  try {
    const saved = await AsyncStorage.getItem(SPLASH_KEYS.SPLASH_FREQUENCY);
    const config = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_SPLASH_CONFIG, ...config };
  } catch {
    return DEFAULT_SPLASH_CONFIG;
  }
}

export async function saveSplashConfig(config: Partial<SplashConfig>): Promise<void> {
  try {
    const current = await loadSplashConfig();
    await AsyncStorage.setItem(SPLASH_KEYS.SPLASH_FREQUENCY, JSON.stringify({ ...current, ...config }));
  } catch (error) {
    console.warn('Failed to save splash config:', error);
  }
}

export async function getSectionState(section: SplashSection): Promise<SectionState> {
  try {
    const key = `${SPLASH_KEYS.SECTION_PREFERENCES}_${section}`;
    const saved = await AsyncStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return {
      lastVisited: 0,
      visitCount: 0,
      onboardingComplete: false,
      topicSelected: false,
      firstTime: true,
    };
  } catch {
    return {
      lastVisited: 0,
      visitCount: 0,
      onboardingComplete: false,
      topicSelected: false,
      firstTime: true,
    };
  }
}

export async function updateSectionState(
  section: SplashSection,
  updates: Partial<SectionState>
): Promise<void> {
  try {
    const key = `${SPLASH_KEYS.SECTION_PREFERENCES}_${section}`;
    const current = await getSectionState(section);
    const updated = { ...current, ...updates, lastVisited: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to update section state:', error);
  }
}

export async function shouldShowSplash(
  section: SplashSection,
  config: SplashConfig,
  reduceMotion: boolean = false
): Promise<{ shouldShow: boolean; reason: string }> {
  if (config.respectReduceMotion && reduceMotion) {
    return { shouldShow: false, reason: 'reduce_motion' };
  }

  if (config.frequency === 'never') {
    return { shouldShow: false, reason: 'frequency_never' };
  }

  const sectionState = await getSectionState(section);
  const now = Date.now();

  if (sectionState.firstTime) {
    return { shouldShow: true, reason: 'first_time' };
  }

  if (now - sectionState.lastVisited < config.minSplashInterval) {
    return { shouldShow: false, reason: 'too_soon' };
  }

  if (config.frequency === 'always') {
    return { shouldShow: true, reason: 'frequency_always' };
  }

  if (config.frequency === 'daily') {
    const lastDate = new Date(sectionState.lastVisited).toDateString();
    const today = new Date().toDateString();
    if (lastDate === today) {
      return { shouldShow: false, reason: 'already_today' };
    }
    return { shouldShow: true, reason: 'new_day' };
  }

  if (config.frequency === 'weekly') {
    const daysSince = Math.floor((now - sectionState.lastVisited) / (1000 * 60 * 60 * 24));
    if (daysSince < 7) {
      return { shouldShow: false, reason: 'already_this_week' };
    }
    return { shouldShow: true, reason: 'new_week' };
  }

  return { shouldShow: false, reason: 'unknown' };
}

export async function markSplashShown(section: SplashSection): Promise<void> {
  try {
    const key = section === 'main' ? SPLASH_KEYS.MAIN_APP_SHOWN : SPLASH_KEYS.COMMUNITY_SHOWN;
    await AsyncStorage.setItem(key, Date.now().toString());
    await updateSectionState(section, { firstTime: false });
  } catch (error) {
    console.warn('Failed to mark splash shown:', error);
  }
}


export interface UseIntelligentSplashReturn {
  isReady: boolean;
  shouldShowSplash: boolean;
  splashReason: string;
  sectionState: SectionState | null;
  config: SplashConfig;
  markShown: () => Promise<void>;
  updateConfig: (updates: Partial<SplashConfig>) => Promise<void>;
  forceShow: () => void;
  dismiss: () => void;
}

export function useIntelligentSplash(
  section: SplashSection,
  reduceMotion: boolean = false,
  compactView: boolean = false
): UseIntelligentSplashReturn {
  const [isReady, setIsReady] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [reason, setReason] = useState('');
  const [sectionState, setSectionState] = useState<SectionState | null>(null);
  const [config, setConfig] = useState<SplashConfig>(DEFAULT_SPLASH_CONFIG);
  const [forceShowFlag, setForceShowFlag] = useState(false);
  
  const isMounted = useRef(true);

  useEffect(() => {
    const init = async () => {
      const [loadedConfig, state, splashCheck] = await Promise.all([
        loadSplashConfig(),
        getSectionState(section),
        shouldShowSplash(section, DEFAULT_SPLASH_CONFIG, reduceMotion),
      ]);

      if (isMounted.current) {
        setConfig(loadedConfig);
        setSectionState(state);
        setShouldShow(splashCheck.shouldShow || forceShowFlag);
        setReason(splashCheck.reason);
        setIsReady(true);
      }
    };

    init();
    return () => { isMounted.current = false; };
  }, [section, reduceMotion, forceShowFlag]);

  const markShown = useCallback(async () => {
    await markSplashShown(section);
    setShouldShow(false);
  }, [section]);

  const updateConfig = useCallback(async (updates: Partial<SplashConfig>) => {
    await saveSplashConfig(updates);
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const forceShow = useCallback(() => {
    setForceShowFlag(prev => !prev);
    setShouldShow(true);
  }, []);

  const dismiss = useCallback(() => {
    setShouldShow(false);
  }, []);

  return {
    isReady,
    shouldShowSplash: shouldShow,
    splashReason: reason,
    sectionState,
    config,
    markShown,
    updateConfig,
    forceShow,
    dismiss,
  };
}

export default useIntelligentSplash;
