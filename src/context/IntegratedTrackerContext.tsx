import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getEntriesByBabyFromDb, getAppSetting } from '../database/dbHelpers';

// FIX: Import directly from context sources
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
  /** NEW: Correlation insights between trackers */
  correlations: TrackerCorrelation[];
  /** NEW: Predictive reminder achievements */
  predictiveAchievements: any[];
}

interface TrackerCorrelation {
  id: string;
  trackerA: string;
  trackerB: string;
  correlationScore: number; // -1 to 1
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
  /** NEW: Get cross-tracker correlations */
  getCorrelations: () => TrackerCorrelation[];
  /** NEW: Get predictive achievements */
  getPredictiveAchievements: () => any[];
}

const IntegratedTrackerContext = createContext<IntegratedTrackerContextType | null>(null);

const ACHIEVEMENT_STORAGE_KEY = '@littleloom_unlocked_achievements_v2';
const REMINDER_DISMISSED_KEY = '@littleloom_dismissed_reminders';
const CORRELATIONS_KEY = '@littleloom_tracker_correlations';

/* ═══════════════════════════════════════════════════════════════
   CORRELATION ENGINE — Cross-tracker pattern detection
   ═══════════════════════════════════════════════════════════════ */

const analyzeCorrelations = (entries: TrackerEntry[]): TrackerCorrelation[] => {
  const correlations: TrackerCorrelation[] = [];
  const trackerTypes = [...new Set(entries.map(e => e.trackerId))];

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

  const medEntries = entries.filter(e => e.trackerId === 'medication' && !e.isDeleted);
  const symptomEntries = entries.filter(e => e.trackerId === 'symptom' && !e.isDeleted);

  if (medEntries.length >= 3 && symptomEntries.length >= 3) {
    let symptomAfterMed = 0;
    medEntries.forEach(med => {
      const symptomAfter = symptomEntries.find(s =>
        s.timestamp - med.timestamp > 0 && s.timestamp - med.timestamp < 24 * 60 * 60 * 1000
      );
      if (symptomAfter) symptomAfterMed++;
    });
    const score = medEntries.length > 0 ? symptomAfterMed / medEntries.length : 0;
    correlations.push({
      id: 'med_symptom',
      trackerA: 'medication',
      trackerB: 'symptom',
      correlationScore: score,
      insight: score > 0.5
        ? 'Symptoms tracked after medication — monitor effectiveness'
        : 'Good symptom management with medication tracking',
      emoji: '💊🤒',
      trend: score > 0.5 ? 'negative' : 'positive',
      sampleSize: medEntries.length,
    });
  }

  return correlations;
};

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE ACHIEVEMENT ENGINE
   ═══════════════════════════════════════════════════════════════ */

const buildPredictiveAchievements = (
  entries: TrackerEntry[],
  reminders: any[],
  growthScore: any,
  unlocked: string[]
): any[] => {
  const achievements: any[] = [];

  const actedReminders = reminders.filter(r => r.actedUpon).length;
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

  const feedPredictions = (reminders ?? []).filter(r => r.type === 'feed' && r.actedUpon).length;
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

  const sleepScoreHistory = (growthScore?.dimensions?.sleep?.history ?? []) as number[];
  const sleepImproved = sleepScoreHistory.length >= 2 &&
    sleepScoreHistory[sleepScoreHistory.length - 1] - sleepScoreHistory[0] >= 10;
  achievements.push({
    id: 'sleep_sage',
    title: 'Sleep Sage',
    description: 'Improve sleep score by 10+ points',
    emoji: '🌙✨',
    unlocked: sleepImproved,
    progress: sleepImproved ? 1 : 0,
    maxProgress: 1,
    category: 'predictive',
    rarity: 'epic',
    points: 400,
  });

  return achievements;
};

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
        // Try DB first, fallback to AsyncStorage for migration
        const dbVal = await getAppSetting('unlocked_achievements');
        if (dbVal) {
          setState(prev => ({ ...prev, unlockedAchievements: JSON.parse(dbVal) }));
        } else {
          const saved = await AsyncStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
          if (saved) {
            setState(prev => ({ ...prev, unlockedAchievements: JSON.parse(saved) }));
            // Migrate to DB
            await (await import('../database/dbHelpers')).setAppSetting('unlocked_achievements', saved);
          }
        }
      } catch (e) { console.warn('Failed to load achievements:', e); }
    };
    load();
  }, []);

  /* ── Calculate everything whenever entries or growth data change ── */
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

  const calculateStreak = (entries: TrackerEntry[]) => {
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
    if (!currentBaby || !currentBabyId) return;
    setState(prev => ({ ...prev, isLoading: true }));

    const ageMonths = calculateAgeInMonths(currentBaby.birthDate);
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

  /* ── Check achievements ── */
  const checkAchievements = useCallback(() => {
    return state.pendingAchievements;
  }, [state.pendingAchievements]);

  /* ── Dismiss achievement ── */
  const dismissAchievement = useCallback(async (id: string) => {
    const updated = [...state.unlockedAchievements, id];
    const { setAppSetting } = await import('../database/dbHelpers');
    await setAppSetting('unlocked_achievements', JSON.stringify(updated));
    setState(prev => ({
      ...prev,
      unlockedAchievements: updated,
      pendingAchievements: prev.pendingAchievements.filter(a => a.id !== id),
    }));
  }, [state.unlockedAchievements, state.pendingAchievements]);

  /* ── Apply reminder (creates actual reminder) ── */
  const applyReminder = useCallback(async (reminder: any) => {
    console.log('Applied reminder:', reminder);
    setState(prev => ({
      ...prev,
      smartReminders: prev.smartReminders.filter(r => r.id !== reminder.id),
    }));
  }, []);
  
  /* ── Dismiss reminder ── */
  const dismissReminder = useCallback(async (id: string) => {
    try {
      const { getAppSetting, setAppSetting } = await import('../database/dbHelpers');
      const dismissed = await getAppSetting('dismissed_reminders');
      const list: string[] = dismissed ? JSON.parse(dismissed) : [];
      if (!list.includes(id)) list.push(id);
      await setAppSetting('dismissed_reminders', JSON.stringify(list));
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
    const trackerIndex = state.growthScore?.getTrackerIndex?.(trackerId);
    if (!trackerIndex) {
      const trackerEntries = entries.filter(e => e.trackerId === trackerId && !e.isDeleted);
      return { 
        score: trackerEntries.length > 0 ? 50 : 0, 
        impact: `${trackerEntries.length} entries tracked` 
      };
    }

    const trackerEntries = entries.filter(e => e.trackerId === trackerId && !e.isDeleted);
    const count = trackerEntries.length;
    const dimScores = (trackerIndex.growthDimensions || []).map((d: any) => ({
      dim: d.type,
      score: state.growthScore?.dimensions?.[d.type]?.value || 50,
      weight: d.weight,
    }));

    const avgImpact = dimScores.reduce((sum: number, d: any) => sum + (d.score * d.weight), 0) / (dimScores.length || 1);
    const impactText = dimScores.map((d: any) => `${d.dim}: ${Math.round(d.score)}`).join(', ');

    return {
      score: Math.round(avgImpact),
      impact: `${count} entries • ${impactText}`,
    };
  }, [entries, state.growthScore]);

  /* ── NEW: Get correlations ── */
  const getCorrelations = useCallback(() => {
    return state.correlations;
  }, [state.correlations]);

  /* ── NEW: Get predictive achievements ── */
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
