// src/context/IntegratedTrackerContext.tsx
// Growth-aware, achievement-driven tracker with Supabase

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { useTracker } from './TrackerContext';
import { useBaby, GrowthMeasurement } from './BabyContext';
import { useAuth } from './AuthContext';

// FIX: Use safe dynamic requires for hooks that may cause circular deps
const useGrowthIntelligenceSafe = () => {
  try {
    const { useGrowthIntelligence } = require('../hooks/useGrowthIntelligence');
    return useGrowthIntelligence();
  } catch {
    return { growthIndex: null, isLoading: false };
  }
};

const usePredictiveRemindersSafe = () => {
  try {
    const { usePredictiveReminders } = require('../hooks/usePredictiveReminders');
    return usePredictiveReminders();
  } catch {
    return { reminders: [], isLoading: false };
  }
};

/* ═══════════════════════════════════════════════════════════════
   INTEGRATED TRACKER CONTEXT
   ═══════════════════════════════════════════════════════════════ */

interface IntegratedTrackerState {
  isLoading: boolean;
  growthScore: any | null;
  smartReminders: any[];
  pendingAchievements: any[];
  unlockedAchievements: string[];
  lastGrowthUpdate: number;
  streakData: {
    currentStreak: number;
    longestStreak: number;
    atRisk: boolean;
    hoursLeft: number;
  };
  correlations: TrackerCorrelation[];
  predictiveAchievements: any[];
}

interface TrackerCorrelation {
  id: string;
  trackerA: string;
  trackerB: string;
  correlationScore: number;
  insight: string;
  emoji: string;
  trend: 'positive' | 'negative' | 'neutral';
  sampleSize: number;
}

interface IntegratedTrackerContextType extends IntegratedTrackerState {
  refreshGrowthScore: () => Promise<void>;
  checkAchievements: () => any[];
  dismissAchievement: (id: string) => void;
  applyReminder: (reminder: any) => Promise<void>;
  dismissReminder: (id: string) => void;
  getGrowthInsights: () => any[];
  getRecommendations: () => string[];
  getDimensionScore: (dimension: string) => number;
  getTrend: () => string;
  isDimensionConcerning: (dimension: string) => boolean;
  getTrackerContribution: (trackerId: string) => { score: number; impact: string };
  getCorrelations: () => TrackerCorrelation[];
  getPredictiveAchievements: () => any[];
}

const IntegratedTrackerContext = createContext<IntegratedTrackerContextType | null>(null);

const ACHIEVEMENT_STORAGE_KEY = '@littleloom_unlocked_achievements_v2';
const REMINDER_DISMISSED_KEY = '@littleloom_dismissed_reminders';

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════ */

export const IntegratedTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { entries, trackers, currentBabyId } = useTracker();
  const { growthData, currentBaby } = useBaby();
  const { userProfile } = useAuth();
  const { growthIndex } = useGrowthIntelligenceSafe();
  const { reminders: predictiveReminders } = usePredictiveRemindersSafe();

  const [state, setState] = useState<IntegratedTrackerState>({
    isLoading: true,
    growthScore: null,
    smartReminders: [],
    pendingAchievements: [],
    unlockedAchievements: [],
    lastGrowthUpdate: 0,
    streakData: { currentStreak: 0, longestStreak: 0, atRisk: false, hoursLeft: 0 },
    correlations: [],
    predictiveAchievements: [],
  });

  /* ── Load persisted achievements ── */
  useEffect(() => {
    const load = async () => {
      try {
        const dbVal = await AsyncStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        if (dbVal) {
          setState(prev => ({ ...prev, unlockedAchievements: JSON.parse(dbVal) }));
        }
      } catch (e) { console.warn('Failed to load achievements:', e); }
    };
    load();
  }, []);

  /* ── Calculate everything ── */
  useEffect(() => {
    if (!currentBabyId || !currentBaby) return;

    const ageMonths = calculateAgeInMonths(currentBaby.birthDate);
    const score = growthIndex ?? null;
    const reminders = typeof growthIndex?.generateReminders === 'function' 
      ? growthIndex.generateReminders(entries, trackers, score) 
      : [];
    const newAchievements = typeof growthIndex?.checkNewAchievements === 'function'
      ? growthIndex.checkNewAchievements(entries, score, state.unlockedAchievements)
      : [];

    const streak = calculateStreak(entries);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = entries.filter(e => new Date(e.timestamp) >= today);
    const atRisk = todayEntries.length === 0 && streak.currentStreak > 0 && new Date().getHours() >= 18;

    const correlations = analyzeCorrelations(entries);

    const predictiveAchievements = buildPredictiveAchievements(
      entries, predictiveReminders, score, state.unlockedAchievements
    );

    setState(prev => ({
      ...prev,
      growthScore: score,
      smartReminders: reminders,
      pendingAchievements: newAchievements,
      lastGrowthUpdate: Date.now(),
      streakData: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        atRisk,
        hoursLeft: atRisk ? 24 - new Date().getHours() : 0,
      },
      correlations,
      predictiveAchievements,
      isLoading: false,
    }));

    if (newAchievements.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [entries, growthData, currentBabyId, currentBaby, growthIndex, predictiveReminders]);

  /* ── Helpers ── */
  const calculateAgeInMonths = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  };

  const calculateStreak = (entries: any[]) => {
    const days = new Set(entries.filter(e => !e.isDeleted).map(e => new Date(e.timestamp).toISOString().split('T')[0]));
    let currentStreak = 0;
    let longestStreak = 0;
    let temp = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const check = new Date(today);
      check.setDate(check.getDate() - i);
      const key = check.toISOString().split('T')[0];
      if (days.has(key)) {
        temp++;
        longestStreak = Math.max(longestStreak, temp);
        if (i === 0) currentStreak = temp;
      } else {
        if (i === 0) currentStreak = 0;
        temp = 0;
      }
    }
    return { currentStreak, longestStreak };
  };

  const analyzeCorrelations = (entries: any[]): TrackerCorrelation[] => {
    const correlations: TrackerCorrelation[] = [];
    
    // Simple correlation analysis
    const sleepEntries = entries.filter(e => e.trackerId === 'sleep' && !e.isDeleted);
    const feedEntries = entries.filter(e => e.trackerId === 'feed' && !e.isDeleted);

    if (sleepEntries.length >= 5 && feedEntries.length >= 5) {
      let feedBeforeSleep = 0;
      sleepEntries.forEach(sleep => {
        const sleepTime = sleep.timestamp;
        const recentFeed = feedEntries.find(f =>
          sleepTime - f.timestamp > 0 && sleepTime - f.timestamp < 2 * 60 * 60 * 1000
        );
        if (recentFeed) feedBeforeSleep++;
      });
      const score = sleepEntries.length > 0 ? feedBeforeSleep / sleepEntries.length : 0;
      correlations.push({
        id: 'feed_sleep',
        trackerA: 'feed',
        trackerB: 'sleep',
        correlationScore: score,
        insight: score > 0.7
          ? 'Feeding consistently precedes sleep — great routine!'
          : score > 0.4
          ? 'Try feeding before naps for better sleep'
          : 'Feeding and sleep patterns seem independent',
        emoji: score > 0.7 ? '🍼😴' : '🍼',
        trend: score > 0.5 ? 'positive' : 'neutral',
        sampleSize: sleepEntries.length,
      });
    }

    return correlations;
  };

  const buildPredictiveAchievements = (entries: any[], reminders: any[], growthScore: any, unlocked: string[]): any[] => {
    const achievements: any[] = [];

    const actedReminders = (reminders || []).filter(r => r.actedUpon).length;
    achievements.push({
      id: 'predictive_parent',
      title: 'Predictive Parent',
      description: 'Act on 3 predictive reminders',
      emoji: '🔮',
      unlocked: actedReminders >= 3,
      progress: actedReminders,
      maxProgress: 3,
      category: 'predictive',
      rarity: 'epic',
      points: 500,
    });

    return achievements;
  };

  /* ── Methods ── */
  const refreshGrowthScore = useCallback(async () => {
    if (!currentBaby || !currentBabyId) return;
    setState(prev => ({ ...prev, isLoading: true }));

    const score = growthIndex ?? null;
    const reminders = typeof growthIndex?.generateReminders === 'function'
      ? growthIndex.generateReminders(entries, trackers, score)
      : [];

    setState(prev => ({
      ...prev,
      growthScore: score,
      smartReminders: reminders,
      lastGrowthUpdate: Date.now(),
      isLoading: false,
    }));
  }, [entries, growthData, currentBaby, currentBabyId, trackers, growthIndex]);

  const checkAchievements = useCallback(() => {
    return state.pendingAchievements;
  }, [state.pendingAchievements]);

  const dismissAchievement = useCallback(async (id: string) => {
    const updated = [...state.unlockedAchievements, id];
    await AsyncStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(updated));
    setState(prev => ({
      ...prev,
      unlockedAchievements: updated,
      pendingAchievements: prev.pendingAchievements.filter(a => a.id !== id),
    }));
  }, [state.unlockedAchievements, state.pendingAchievements]);

  const applyReminder = useCallback(async (reminder: any) => {
    console.log('Applied reminder:', reminder);
    setState(prev => ({
      ...prev,
      smartReminders: prev.smartReminders.filter(r => r.id !== reminder.id),
    }));
  }, []);

  const dismissReminder = useCallback(async (id: string) => {
    try {
      const dismissed = await AsyncStorage.getItem(REMINDER_DISMISSED_KEY);
      const list: string[] = dismissed ? JSON.parse(dismissed) : [];
      if (!list.includes(id)) list.push(id);
      await AsyncStorage.setItem(REMINDER_DISMISSED_KEY, JSON.stringify(list));
    } catch (e) {}

    setState(prev => ({
      ...prev,
      smartReminders: prev.smartReminders.filter(r => r.id !== id),
    }));
  }, []);

  /* ── Getters ── */
  const getGrowthInsights = useCallback(() => {
    return state.growthScore?.insights || [];
  }, [state.growthScore]);

  const getRecommendations = useCallback(() => {
    return state.growthScore?.recommendations || [];
  }, [state.growthScore]);

  const getDimensionScore = useCallback((dimension: string) => {
    return state.growthScore?.dimensions?.[dimension]?.value || 50;
  }, [state.growthScore]);

  const getTrend = useCallback(() => {
    return state.growthScore?.trend || 'stable';
  }, [state.growthScore]);

  const isDimensionConcerning = useCallback((dimension: string) => {
    return (state.growthScore?.dimensions?.[dimension]?.value || 50) < 40;
  }, [state.growthScore]);

  const getTrackerContribution = useCallback((trackerId: string) => {
    const trackerEntries = entries.filter(e => e.trackerId === trackerId && !e.isDeleted);
    return {
      score: trackerEntries.length > 0 ? 50 : 0,
      impact: `${trackerEntries.length} entries tracked`,
    };
  }, [entries]);

  const getCorrelations = useCallback(() => {
    return state.correlations;
  }, [state.correlations]);

  const getPredictiveAchievements = useCallback(() => {
    return state.predictiveAchievements;
  }, [state.predictiveAchievements]);

  /* ── Value ── */
  const value = useMemo(() => ({
    ...state,
    refreshGrowthScore,
    checkAchievements,
    dismissAchievement,
    applyReminder,
    dismissReminder,
    getGrowthInsights,
    getRecommendations,
    getDimensionScore,
    getTrend,
    isDimensionConcerning,
    getTrackerContribution,
    getCorrelations,
    getPredictiveAchievements,
  }), [state, refreshGrowthScore, checkAchievements, dismissAchievement, applyReminder, dismissReminder,
    getGrowthInsights, getRecommendations, getDimensionScore, getTrend, isDimensionConcerning,
    getTrackerContribution, getCorrelations, getPredictiveAchievements]);

  return (
    <IntegratedTrackerContext.Provider value={value}>
      {children}
    </IntegratedTrackerContext.Provider>
  );
};

export const useIntegratedTracker = (): IntegratedTrackerContextType => {
  const context = useContext(IntegratedTrackerContext);
  if (!context) throw new Error('useIntegratedTracker must be used within IntegratedTrackerProvider');
  return context;
};

export default IntegratedTrackerProvider;