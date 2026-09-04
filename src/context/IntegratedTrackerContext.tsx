// src/context/IntegratedTrackerContext.tsx
// Growth-aware, achievement-driven tracker with Supabase

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/database/dbHelpers';
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
   INTEGRATED TRACKER CONTEXT — Growth-aware, Achievement-driven
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
const CORRELATIONS_KEY = '@littleloom_tracker_correlations';

// ─── CORRELATION ENGINE ────────────────────────────────────────────────
const analyzeCorrelations = (entries: any[]): TrackerCorrelation[] => {
  const correlations: TrackerCorrelation[] = [];

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

  const growthEntries = entries.filter(e => e.trackerId === 'growth' && !e.isDeleted);
  const milestoneEntries = entries.filter(e => e.trackerId === 'milestone' && !e.isDeleted);

  if (growthEntries.length >= 3 && milestoneEntries.length >= 3) {
    const growthTimestamps = growthEntries.map(e => e.timestamp).sort((a, b) => a - b);
    const milestoneTimestamps = milestoneEntries.map(e => e.timestamp).sort((a, b) => a - b);

    let nearGrowth = 0;
    milestoneTimestamps.forEach(mt => {
      const near = growthTimestamps.some(gt => Math.abs(mt - gt) < 7 * 24 * 60 * 60 * 1000);
      if (near) nearGrowth++;
    });

    const score = milestoneTimestamps.length > 0 ? nearGrowth / milestoneTimestamps.length : 0;
    correlations.push({
      id: 'growth_milestone',
      trackerA: 'growth',
      trackerB: 'milestone',
      correlationScore: score,
      insight: score > 0.6
        ? 'Growth spurts align with milestones — tracking both pays off!'
        : 'Growth and milestones may be independent',
      emoji: '📏🏆',
      trend: score > 0.5 ? 'positive' : 'neutral',
      sampleSize: milestoneEntries.length,
    });
  }

  const pottyEntries = entries.filter(e => e.trackerId === 'potty' && !e.isDeleted);
  if (pottyEntries.length >= 10 && feedEntries.length >= 10) {
    const successfulPotty = pottyEntries.filter(e => e.data?.successful === true);
    let feedAfterPotty = 0;
    successfulPotty.forEach(potty => {
      const feedSoon = feedEntries.find(f =>
        f.timestamp - potty.timestamp > 0 && f.timestamp - potty.timestamp < 30 * 60 * 1000
      );
      if (feedSoon) feedAfterPotty++;
    });
    const score = successfulPotty.length > 0 ? feedAfterPotty / successfulPotty.length : 0;
    correlations.push({
      id: 'potty_feed',
      trackerA: 'potty',
      trackerB: 'feed',
      correlationScore: score,
      insight: score > 0.5
        ? 'Reward feeding after potty success reinforces training'
        : 'Consider rewarding with feeding after successful potty',
      emoji: '🚽🍼',
      trend: score > 0.4 ? 'positive' : 'neutral',
      sampleSize: successfulPotty.length,
    });
  }

  return correlations;
};

// ─── PREDICTIVE ACHIEVEMENT ENGINE ─────────────────────────────────────
const buildPredictiveAchievements = (
  entries: any[],
  reminders: any[],
  growthScore: any,
  unlocked: string[]
): any[] => {
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

  const predictedGrowth = growthScore?.predicted?.value || 0;
  const actualGrowth = growthScore?.overall?.value || 0;
  const accurate = Math.abs(predictedGrowth - actualGrowth) < 10;
  achievements.push({
    id: 'growth_forecaster',
    title: 'Growth Forecaster',
    description: 'Growth prediction within 10% of actual',
    emoji: '🔮📈',
    unlocked: accurate && predictedGrowth > 0,
    progress: accurate ? 1 : 0,
    maxProgress: 1,
    category: 'predictive',
    rarity: 'rare',
    points: 200,
  });

  const feedPredictions = (reminders || []).filter(r => r.type === 'feed' && r.actedUpon).length;
  achievements.push({
    id: 'routine_optimizer',
    title: 'Routine Optimizer',
    description: 'Follow 5 feeding time predictions',
    emoji: '⏰🍼',
    unlocked: feedPredictions >= 5,
    progress: feedPredictions,
    maxProgress: 5,
    category: 'predictive',
    rarity: 'rare',
    points: 250,
  });

  return achievements;
};

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════ */

export const IntegratedTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { entries, trackers } = useTracker();
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

  // ─── FIXED: Use refs to track previous values and prevent infinite loops ──
  const prevEntriesRef = useRef<any[]>([]);
  const prevGrowthDataRef = useRef<any[]>([]);
  const prevBabyIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  /* ── Load persisted achievements from Supabase ── */
  useEffect(() => {
    const load = async () => {
      try {
        const dbVal = await getAppSetting(ACHIEVEMENT_STORAGE_KEY);
        if (dbVal) {
          setState(prev => ({ ...prev, unlockedAchievements: JSON.parse(dbVal) }));
        } else {
          const saved = await AsyncStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
          if (saved) {
            setState(prev => ({ ...prev, unlockedAchievements: JSON.parse(saved) }));
            await setAppSetting(ACHIEVEMENT_STORAGE_KEY, saved);
          }
        }
      } catch (e) { console.warn('Failed to load achievements:', e); }
    };
    load();
  }, []);

  /* ── Calculate everything whenever entries or growth data change ── */
  // FIXED: Added proper dependency tracking to prevent infinite loops
  useEffect(() => {
    const babyId = currentBaby?.id || null;

    // Check if we should process
    const entriesChanged = JSON.stringify(entries) !== JSON.stringify(prevEntriesRef.current);
    const growthDataChanged = JSON.stringify(growthData) !== JSON.stringify(prevGrowthDataRef.current);
    const babyChanged = babyId !== prevBabyIdRef.current;

    if (!entriesChanged && !growthDataChanged && !babyChanged) {
      return;
    }

    // Update refs
    prevEntriesRef.current = entries;
    prevGrowthDataRef.current = growthData;
    prevBabyIdRef.current = babyId;

    if (!babyId || !currentBaby) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

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

    processingRef.current = false;
  }, [entries, growthData, currentBaby, growthIndex, predictiveReminders, state.unlockedAchievements, trackers]);

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

  /* ── Refresh growth score ── */
  const refreshGrowthScore = useCallback(async () => {
    if (!currentBaby || !currentBaby.id) return;
    setState(prev => ({ ...prev, isLoading: true }));

    const score = growthIndex ?? null;
    const reminders = typeof growthIndex?.generateReminders === 'function'
      ? growthIndex.generateReminders(entries, trackers, score)
      : [];

    try {
      await setAppSetting('last_growth_update', JSON.stringify(Date.now()));
    } catch (e) {
      console.warn('Failed to save growth update timestamp:', e);
    }

    setState(prev => ({
      ...prev,
      growthScore: score,
      smartReminders: reminders,
      lastGrowthUpdate: Date.now(),
      isLoading: false,
    }));
  }, [entries, currentBaby, trackers, growthIndex]);

  /* ── Check achievements ── */
  const checkAchievements = useCallback(() => {
    return state.pendingAchievements;
  }, [state.pendingAchievements]);

  /* ── Dismiss achievement ── */
  const dismissAchievement = useCallback(async (id: string) => {
    const updated = [...state.unlockedAchievements, id];
    await setAppSetting(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(updated));
    setState(prev => ({
      ...prev,
      unlockedAchievements: updated,
      pendingAchievements: prev.pendingAchievements.filter(a => a.id !== id),
    }));
  }, [state.unlockedAchievements, state.pendingAchievements]);

  /* ── Apply reminder ── */
  const applyReminder = useCallback(async (reminder: any) => {
    console.log('Applied reminder:', reminder);
    
    try {
      const { data, error } = await supabase
        .from('applied_reminders')
        .insert({
          reminder_id: reminder.id,
          reminder_type: reminder.type || 'general',
          baby_id: currentBaby?.id,
          user_id: userProfile?.id,
          applied_at: new Date().toISOString(),
          metadata: reminder,
        });

      if (error) {
        console.warn('Failed to sync applied reminder:', error);
      }
    } catch (e) {
      console.warn('Failed to sync applied reminder:', e);
    }
    
    setState(prev => ({
      ...prev,
      smartReminders: prev.smartReminders.filter(r => r.id !== reminder.id),
    }));
  }, [currentBaby, userProfile?.id]);

  /* ── Dismiss reminder ── */
  const dismissReminder = useCallback(async (id: string) => {
    try {
      const dismissed = await getAppSetting(REMINDER_DISMISSED_KEY);
      const list: string[] = dismissed ? JSON.parse(dismissed) : [];
      if (!list.includes(id)) list.push(id);
      await setAppSetting(REMINDER_DISMISSED_KEY, JSON.stringify(list));
      
      const { error } = await supabase
        .from('applied_reminders')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('reminder_id', id)
        .eq('baby_id', currentBaby?.id);

      if (error) {
        console.warn('Failed to update dismissed reminder:', error);
      }
    } catch (e) {
      console.warn('Failed to save dismissed reminder:', e);
    }

    setState(prev => ({
      ...prev,
      smartReminders: prev.smartReminders.filter(r => r.id !== id),
    }));
  }, [currentBaby]);

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
    const count = trackerEntries.length;
    const impact = count > 0 
      ? `${count} entries tracked` 
      : 'No entries tracked yet';
    
    return {
      score: count > 0 ? Math.min(100, 50 + count * 2) : 0,
      impact,
    };
  }, [entries]);

  const getCorrelations = useCallback(() => {
    return state.correlations;
  }, [state.correlations]);

  const getPredictiveAchievements = useCallback(() => {
    return state.predictiveAchievements;
  }, [state.predictiveAchievements]);

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