import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  differenceInMonths,
  differenceInDays,
  differenceInHours,
  subDays,
  subMonths,
} from 'date-fns';

// FIX: Import directly from context files, NOT from hook wrappers
import { useTracker } from './useTrackerContext';
import { useBaby } from '@/context/BabyContext';
import { TrackerEntry } from '@/types/trackers';
import {
  calculatePercentilePrecise,
  calculateZScore,
  zScoreToPercentile,
  getGrowthStatus,
  calculateGrowthVelocity,
  calculateChildBMI,
  predictGrowth,
  WHO_BOY_LMS,
  WHO_GIRL_LMS,
  LMSParams,
} from '@/hooks/useWHOGrowthCalculator';

export interface SubScore {
  label: string;
  value: number; // 0-100
  color: string;
  weight: number; // contribution to composite
  trend: 'up' | 'down' | 'stable';
  delta: number; // change from last week
}

export interface MilestoneReadiness {
  category: 'physical' | 'cognitive' | 'social' | 'language' | 'emotional';
  readinessPercent: number;
  expectedWindow: { start: number; end: number }; // months
  currentAge: number;
  suggestedActivities: string[];
  relatedTrackerIds: string[];
}

export interface GrowthIndex {
  nutritionScore: SubScore;
  restScore: SubScore;
  physicalScore: SubScore;
  cognitiveScore: SubScore;
  healthStability: SubScore;
  compositeIndex: number;
  predictedNextCheckup: Date;
  milestoneReadiness: MilestoneReadiness[];
  velocityTrends: {
    height: { perMonth: number; percentile: number };
    weight: { perMonth: number; percentile: number };
    head: { perMonth: number; percentile: number };
  };
  lastUpdated: string;
  ageInMonths: number;
  generateReminders?: (entries: TrackerEntry[], trackers: any[], score: any) => any[];
  checkNewAchievements?: (entries: TrackerEntry[], score: any, unlocked: string[]) => any[];
  getTrackerIndex?: (trackerId: string) => any;
  dimensions?: Record<string, any>;
  predicted?: { value: number };
  overall?: { value: number };
  trend?: string;
  insights?: any[];
  recommendations?: string[];
}

const NUTRITION_GUIDELINES: Record<number, { minMl: number; maxMl: number; varietyTarget: number }> = {
  0: { minMl: 400, maxMl: 600, varietyTarget: 1 },
  1: { minMl: 500, maxMl: 700, varietyTarget: 1 },
  3: { minMl: 700, maxMl: 900, varietyTarget: 2 },
  6: { minMl: 800, maxMl: 1000, varietyTarget: 3 },
  9: { minMl: 600, maxMl: 800, varietyTarget: 4 },
  12: { minMl: 500, maxMl: 700, varietyTarget: 5 },
  18: { minMl: 400, maxMl: 600, varietyTarget: 6 },
  24: { minMl: 350, maxMl: 500, varietyTarget: 7 },
};

const SLEEP_GUIDELINES: Record<number, { minHours: number; maxHours: number; naps: number }> = {
  0: { minHours: 14, maxHours: 17, naps: 4 },
  1: { minHours: 14, maxHours: 17, naps: 4 },
  3: { minHours: 13, maxHours: 16, naps: 4 },
  6: { minHours: 12, maxHours: 15, naps: 3 },
  9: { minHours: 12, maxHours: 14, naps: 2 },
  12: { minHours: 11, maxHours: 14, naps: 2 },
  18: { minHours: 11, maxHours: 14, naps: 1 },
  24: { minHours: 11, maxHours: 14, naps: 1 },
};

const MILESTONE_CALENDAR: Record<string, { category: MilestoneReadiness['category']; window: { start: number; end: number }; prerequisites: string[]; suggestedActivities: string[] }> = {
  'head_control': { category: 'physical', window: { start: 1, end: 3 }, prerequisites: [], suggestedActivities: ['Tummy time 10 min/day', 'Supported sitting'] },
  'rolling_over': { category: 'physical', window: { start: 3, end: 6 }, prerequisites: ['head_control'], suggestedActivities: ['Tummy time 20 min/day', 'Side-lying play'] },
  'sitting': { category: 'physical', window: { start: 5, end: 8 }, prerequisites: ['head_control', 'rolling_over'], suggestedActivities: ['Supported sitting', 'Tripod sit practice'] },
  'crawling': { category: 'physical', window: { start: 7, end: 11 }, prerequisites: ['sitting'], suggestedActivities: ['Floor play', 'Reaching toys'] },
  'walking': { category: 'physical', window: { start: 10, end: 15 }, prerequisites: ['crawling', 'standing'], suggestedActivities: ['Cruising furniture', 'Push walker'] },
  'first_words': { category: 'language', window: { start: 10, end: 14 }, prerequisites: ['babbling'], suggestedActivities: ['Reading 20 min/day', 'Narrate activities'] },
  'two_word_phrases': { category: 'language', window: { start: 18, end: 24 }, prerequisites: ['first_words'], suggestedActivities: ['Label everything', 'Simple choices'] },
  'social_smile': { category: 'social', window: { start: 1, end: 3 }, prerequisites: [], suggestedActivities: ['Face-to-face interaction', 'Mirror play'] },
  'stranger_anxiety': { category: 'social', window: { start: 6, end: 9 }, prerequisites: ['social_smile'], suggestedActivities: ['Gradual introductions', 'Consistent caregiver'] },
  'object_permanence': { category: 'cognitive', window: { start: 4, end: 8 }, prerequisites: ['tracking'], suggestedActivities: ['Peekaboo', 'Hidden toy games'] },
  'cause_effect': { category: 'cognitive', window: { start: 8, end: 12 }, prerequisites: ['object_permanence'], suggestedActivities: ['Activity centers', 'Stacking toys'] },
  'pincer_grasp': { category: 'physical', window: { start: 8, end: 11 }, prerequisites: ['reaching'], suggestedActivities: ['Finger foods', 'Small object pickup'] },
};

const getGuidelineForAge = <T>(guidelines: Record<number, T>, ageMonths: number): T => {
  const ages = Object.keys(guidelines).map(Number).sort((a, b) => a - b);
  let closest = ages[0];
  for (const age of ages) {
    if (age <= ageMonths) closest = age;
    else break;
  }
  return guidelines[closest];
};

const safeParseDate = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/* ── Safe gender helper — handles 'other' by defaulting to 'boy' ── */
const safeGender = (gender: string | undefined): 'boy' | 'girl' => {
  return gender === 'girl' ? 'girl' : 'boy';
};

/* ═══════════════════════════════════════════════════════════════
   SAFE NUMBER HELPERS — prevent NaN/Infinity from leaking
   ═════════════════════════════════════════════════════════════ */

const safeNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safePercentile = (p: number): number => {
  if (!Number.isFinite(p)) return 50;
  return Math.max(0, Math.min(100, p));
};

const safeScore = (v: number, fallback = 50): number => {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const safeVelocity = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return v;
};

/* ── Tolerant duration parser — accepts seconds (number), '5m', '1.5h', '90s', '2h30m' ──
   DURATION_PRESETS are strings, so Number('5m') → NaN used to collapse the Rest score. */
const parseDurationSeconds = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 0;
  const asNum = Number(s);
  if (Number.isFinite(asNum)) return asNum;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s)) !== null) {
    const n = parseFloat(match[1]);
    const u = match[2][0];
    total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
  }
  return total;
};

/* ── Normalize free-text milestone titles to MILESTONE_CALENDAR snake_case ids ──
   'Rolling over' → 'rolling_over' so .has() can actually match the calendar keys. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const useGrowthIntelligence = () => {
  const { entries, getEntries } = useTracker();
  const { currentBaby, growthData, milestones, getMilestones } = useBaby();

  const ageInMonths = useMemo(() => {
    if (!currentBaby?.birthDate) return 0;
    const birth = safeParseDate(currentBaby.birthDate);
    if (!birth) return 0;
    const months = Math.max(0, differenceInMonths(new Date(), birth));
    return Number.isFinite(months) ? months : 0;
  }, [currentBaby?.birthDate]);

  const gender = useMemo(() => safeGender(currentBaby?.gender), [currentBaby?.gender]);

  /* ── Union BabyContext growth store with tracker-logged growth entries (split-brain fix) ── */
  const mergedGrowthData = useMemo(() => {
    const fromEntries = (getEntries('growth', 200) || [])
      .map(e => ({
        type: String(e.data?.measurementType || ''),
        value: safeNumber(e.data?.value, NaN),
        date: new Date(e.timestamp).toISOString(),
      }))
      .filter(g => ['height', 'weight', 'head'].includes(g.type) && Number.isFinite(g.value));

    return [...(growthData || []), ...fromEntries].filter(g => g && g.type && g.date);
  }, [growthData, getEntries, entries]);

  /* ── Achieved milestones: BabyContext store + 🏆 tracker entries, slugged to calendar ids ── */
  const achievedMilestoneIds = useMemo(() => {
    const fromContext = (milestones || []).map(m => slug(m.title));
    const fromTracker = (getEntries('milestone', 100) || [])
      .map(e => slug(String(e.data?.title ?? '')));
    return new Set([...fromContext, ...fromTracker].filter(Boolean));
  }, [milestones, getEntries, entries]);

  const nutritionScore = useMemo((): SubScore => {
    const feedEntries = getEntries('feed', 30) || [];
    const last7Days = feedEntries.filter(e => e.timestamp > subDays(new Date(), 7).getTime());

    if (feedEntries.length === 0) {
      return { label: 'Nutrition', value: 0, color: '#FF9F43', weight: 0.25, trend: 'stable', delta: 0 };
    }

    const guideline = getGuidelineForAge(NUTRITION_GUIDELINES, ageInMonths);

    const dailyVolumes: Record<string, number> = {};
    // Breastfed sessions carry no volume. Estimate conservatively (~9ml/min, capped 140ml;
    // 90ml flat when no duration) so breastfed babies aren't scored near zero.
    const BREAST_SESSION_ML = 90;
    last7Days.forEach(entry => {
      const day = new Date(entry.timestamp).toDateString();
      const feedType = String(entry.data?.feedType || '');
      const amount = safeNumber(entry.data?.amount, 0);
      let ml = 0;
      if (amount > 0) {
        const unit = String(entry.data?.unit || '');
        ml = unit === 'oz' ? amount * 29.57 : amount;
      } else if (feedType === 'breast' || feedType === 'breastfeeding') {
        const mins = parseDurationSeconds(entry.data?.duration) / 60;
        ml = mins > 0 ? Math.min(140, mins * 9) : BREAST_SESSION_ML;
      }
      dailyVolumes[day] = (dailyVolumes[day] || 0) + ml;
    });

    const dayCount = Math.max(Object.keys(dailyVolumes).length, 1);
    const avgDailyMl = Object.values(dailyVolumes).reduce((a, b) => a + b, 0) / dayCount;
    const volumeScore = Math.min(100, (avgDailyMl / guideline.maxMl) * 100);

    let varietyScore = 100;
    if (ageInMonths >= 6) {
      const solidEntries = feedEntries.filter(e => e.data?.feedType === 'solid');
      const uniqueFoods = new Set(solidEntries.map(e => String(e.data?.food || '')).filter(f => f));
      varietyScore = Math.min(100, (uniqueFoods.size / guideline.varietyTarget) * 100);
    }

    const value = ageInMonths < 6 ? volumeScore : (volumeScore * 0.6 + varietyScore * 0.4);

    const prevWeek = feedEntries.filter(e => 
      e.timestamp > subDays(new Date(), 14).getTime() && 
      e.timestamp <= subDays(new Date(), 7).getTime()
    );
    const prevAvg = prevWeek.length > 0 ? 
      prevWeek.reduce((sum, e) => sum + safeNumber(e.data?.amount, 0), 0) / prevWeek.length : 0;
    const currentAvg = feedEntries.length > 0 ?
      feedEntries.slice(0, 7).reduce((sum, e) => sum + safeNumber(e.data?.amount, 0), 0) / Math.min(7, feedEntries.length) : 0;
    const delta = safeNumber(currentAvg - prevAvg, 0);

    return {
      label: 'Nutrition',
      value: safeScore(value, 0),
      color: '#FF9F43',
      weight: 0.25,
      trend: delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable',
      delta: Math.round(delta),
    };
  }, [entries, getEntries, ageInMonths]);

  const restScore = useMemo((): SubScore => {
    const sleepEntries = getEntries('sleep', 30) || [];
    const last7Days = sleepEntries.filter(e => e.timestamp > subDays(new Date(), 7).getTime());

    if (sleepEntries.length === 0) {
      return { label: 'Rest', value: 0, color: '#5F27CD', weight: 0.25, trend: 'stable', delta: 0 };
    }

    const guideline = getGuidelineForAge(SLEEP_GUIDELINES, ageInMonths);

    const nightlySleep: number[] = [];
    last7Days.forEach(entry => {
      const sleepType = String(entry.data?.sleepType || '');
      if (sleepType === 'night' || sleepType === 'nap') {
        const hours = parseDurationSeconds(entry.data?.duration) / 3600;
        if (hours > 0) nightlySleep.push(hours);
      }
    });

    const avgSleep = nightlySleep.length > 0 ? 
      nightlySleep.reduce((a, b) => a + b, 0) / nightlySleep.length : 0;
    const sleepScore = Math.min(100, (avgSleep / guideline.maxHours) * 100);

    const qualityEntries = last7Days.filter(e => e.data?.quality);
    const avgQuality = qualityEntries.length > 0 ?
      qualityEntries.reduce((sum, e) => sum + safeNumber(e.data?.quality, 0), 0) / qualityEntries.length : 3;
    const qualityBonus = (avgQuality / 5) * 20;

    const value = Math.min(100, sleepScore + qualityBonus);

    const prevWeek = sleepEntries.filter(e => 
      e.timestamp > subDays(new Date(), 14).getTime() && 
      e.timestamp <= subDays(new Date(), 7).getTime()
    );
    const prevAvg = prevWeek.length > 0 ? 
      prevWeek.reduce((sum, e) => sum + parseDurationSeconds(e.data?.duration), 0) / prevWeek.length / 3600 : 0;
    const delta = avgSleep - prevAvg;

    return {
      label: 'Rest',
      value: safeScore(value, 0),
      color: '#5F27CD',
      weight: 0.25,
      trend: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'stable',
      delta: Math.round(delta * 10) / 10,
    };
  }, [entries, getEntries, ageInMonths]);

  const physicalScore = useMemo((): SubScore => {
    const safeGrowthData = mergedGrowthData;

    const heightData = safeGrowthData.filter(g => g.type === 'height').sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const weightData = safeGrowthData.filter(g => g.type === 'weight').sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (heightData.length === 0 && weightData.length === 0) {
      return { label: 'Physical', value: 50, color: '#10AC84', weight: 0.30, trend: 'stable', delta: 0 };
    }

    let heightPercentile = 50;
    let weightPercentile = 50;

    const birthDate = safeParseDate(currentBaby?.birthDate);

    if (heightData[0]) {
      const ageAtMeasurement = Math.max(0, differenceInMonths(new Date(heightData[0].date), birthDate || new Date()));
      const rawPercentile = calculatePercentilePrecise(
        safeNumber(heightData[0].value, 0),
        Number.isFinite(ageAtMeasurement) ? ageAtMeasurement : 0,
        'height',
        gender
      );
      heightPercentile = safePercentile(rawPercentile);
    }
    if (weightData[0]) {
      const ageAtMeasurement = Math.max(0, differenceInMonths(new Date(weightData[0].date), birthDate || new Date()));
      const rawPercentile = calculatePercentilePrecise(
        safeNumber(weightData[0].value, 0),
        Number.isFinite(ageAtMeasurement) ? ageAtMeasurement : 0,
        'weight',
        gender
      );
      weightPercentile = safePercentile(rawPercentile);
    }

    const heightScore = heightPercentile >= 25 && heightPercentile <= 75 ? 100 :
      heightPercentile < 25 ? (heightPercentile / 25) * 100 :
      100 - ((heightPercentile - 75) / 25) * 20;

    const weightScore = weightPercentile >= 25 && weightPercentile <= 75 ? 100 :
      weightPercentile < 25 ? (weightPercentile / 25) * 100 :
      100 - ((weightPercentile - 75) / 25) * 20;

    const rawValue = (heightScore + weightScore) / 2;

    const velocityTrend = heightData.length >= 2 ? 
      (safeNumber(heightData[0].value, 0) - safeNumber(heightData[1].value, 0)) / 
      Math.max(differenceInMonths(new Date(heightData[0].date), new Date(heightData[1].date)), 1) : 0;
    const expectedVelocity = 1.5;
    const velocityBonus = velocityTrend > expectedVelocity * 0.8 ? 10 : 0;

    const finalValue = Math.min(100, rawValue + velocityBonus);

    return {
      label: 'Physical',
      value: safeScore(finalValue, 50),
      color: '#10AC84',
      weight: 0.30,
      trend: velocityTrend > expectedVelocity ? 'up' : velocityTrend < expectedVelocity * 0.5 ? 'down' : 'stable',
      delta: Math.round(velocityTrend * 10) / 10,
    };
  }, [mergedGrowthData, ageInMonths, gender, currentBaby?.birthDate]);

  const cognitiveScore = useMemo((): SubScore => {
    const milestoneEntries = getEntries('milestone', 50) || [];
    const playEntries = getEntries('play', 30) || [];
    const readingEntries = getEntries('reading', 30) || [];

    // achievedMilestoneIds comes from the hook-level memo (BabyContext + tracker entries, slugged)

    const expectedMilestones = Object.entries(MILESTONE_CALENDAR)
      .filter(([_, data]) => data.window.start <= ageInMonths)
      .map(([name, _]) => name);

    const achievedCount = expectedMilestones.filter(m => achievedMilestoneIds.has(m)).length;
    const milestoneScore = expectedMilestones.length > 0 ? 
      (achievedCount / expectedMilestones.length) * 100 : 100;

    const activityTypes = new Set([
      ...playEntries.map(e => String(e.data?.playType || '')),
      ...readingEntries.map(e => 'reading'),
    ].filter(Boolean));
    const diversityBonus = Math.min(20, activityTypes.size * 5);

    const readingScore = readingEntries.length > 0 ? 
      Math.min(15, readingEntries.length * 3) : 0;

    const value = Math.min(100, milestoneScore + diversityBonus + readingScore);

    return {
      label: 'Cognitive',
      value: safeScore(value, 50),
      color: '#FFD700',
      weight: 0.20,
      trend: milestoneScore > 80 ? 'up' : 'stable',
      delta: achievedCount,
    };
  }, [achievedMilestoneIds, getEntries, ageInMonths]);

  const healthStability = useMemo((): SubScore => {
    const tempEntries = getEntries('temperature', 30) || [];
    const symptomEntries = getEntries('symptom', 30) || [];
    const medicationEntries = getEntries('medication', 30) || [];

    const feverEntries = tempEntries.filter(e => {
      const val = safeNumber(e.data?.value, 0);
      const unit = String(e.data?.unit || '');
      const celsius = unit === 'fahrenheit' ? (val - 32) * 5/9 : val;
      return celsius > 38;
    });

    const daysSinceFever = feverEntries.length > 0 ?
      differenceInDays(new Date(), new Date(feverEntries[0].timestamp)) : 30;

    const symptomDays = new Set(symptomEntries.map(e => 
      new Date(e.timestamp).toDateString()
    ));
    const symptomScore = Math.max(0, 100 - (symptomDays.size * 10));

    const medScore = medicationEntries.length > 0 ? 
      Math.max(60, 100 - (medicationEntries.length * 2)) : 100;

    const value = (daysSinceFever / 30) * 40 + symptomScore * 0.35 + medScore * 0.25;

    return {
      label: 'Health',
      value: safeScore(value, 50),
      color: '#EE5A24',
      weight: 0.10,
      trend: daysSinceFever > 14 ? 'up' : daysSinceFever < 3 ? 'down' : 'stable',
      delta: daysSinceFever,
    };
  }, [entries, getEntries]);

  const milestoneReadiness = useMemo((): MilestoneReadiness[] => {
    const achievedTitles = achievedMilestoneIds;
    const currentAge = ageInMonths;

    return Object.entries(MILESTONE_CALENDAR)
      .filter(([name, data]) => {
        return !achievedTitles.has(name) && 
          data.window.start <= currentAge + 1 &&
          data.window.end >= currentAge;
      })
      .map(([name, data]) => {
        const prerequisitesMet = data.prerequisites.every(p => achievedTitles.has(p));
        const windowProgress = Math.max(0, (currentAge - data.window.start) / (data.window.end - data.window.start));

        const relatedEntries = data.category === 'physical' ? getEntries('tummy_time', 14) :
          data.category === 'language' ? getEntries('reading', 14) :
          data.category === 'social' ? getEntries('mood', 14) :
          data.category === 'cognitive' ? getEntries('play', 14) : [];

        const activityBonus = Math.min(20, (relatedEntries || []).length * 5);
        const readiness = Math.min(100, (windowProgress * 60) + (prerequisitesMet ? 20 : 0) + activityBonus);

        return {
          category: data.category,
          readinessPercent: Math.round(Number.isFinite(readiness) ? readiness : 0),
          expectedWindow: data.window,
          currentAge,
          suggestedActivities: data.suggestedActivities,
          relatedTrackerIds: data.category === 'physical' ? ['tummy_time', 'play'] :
            data.category === 'language' ? ['reading', 'speech'] :
            data.category === 'social' ? ['mood', 'attachment'] :
            data.category === 'cognitive' ? ['play', 'sensory'] : [],
        };
      })
      .sort((a, b) => b.readinessPercent - a.readinessPercent)
      .slice(0, 3);
  }, [achievedMilestoneIds, ageInMonths, getEntries]);

  const velocityTrends = useMemo(() => {
    const safeGrowthData = mergedGrowthData;

    const heightData = safeGrowthData.filter(g => g.type === 'height').sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const weightData = safeGrowthData.filter(g => g.type === 'weight').sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const headData = safeGrowthData.filter(g => g.type === 'head').sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const birthDate = safeParseDate(currentBaby?.birthDate);

    const calcVelocity = (data: typeof heightData, type: 'height' | 'weight' | 'head') => {
      if (data.length < 2) return { perMonth: 0, percentile: 50 };
      const months = Math.max(1, differenceInMonths(new Date(data[0].date), new Date(data[data.length - 1].date)));
      const totalGrowth = safeNumber(data[0].value, 0) - safeNumber(data[data.length - 1].value, 0);
      const perMonth = safeVelocity(totalGrowth / months);

      const ageAtMeasurement = Math.max(0, differenceInMonths(new Date(data[0].date), birthDate || new Date()));
      const rawPercentile = calculatePercentilePrecise(
        safeNumber(data[0].value, 0),
        Number.isFinite(ageAtMeasurement) ? ageAtMeasurement : 0,
        type,
        gender
      );
      const percentile = safePercentile(rawPercentile);
      return { perMonth, percentile };
    };

    return {
      height: calcVelocity(heightData, 'height'),
      weight: calcVelocity(weightData, 'weight'),
      head: calcVelocity(headData, 'head'),
    };
  }, [mergedGrowthData, gender, currentBaby?.birthDate]);

  const compositeIndex = useMemo(() => {
    const nVal = safeNumber(nutritionScore.value, 0);
    const rVal = safeNumber(restScore.value, 0);
    const pVal = safeNumber(physicalScore.value, 0);
    const cVal = safeNumber(cognitiveScore.value, 0);
    const hVal = safeNumber(healthStability.value, 0);

    const weighted = 
      nVal * safeNumber(nutritionScore.weight, 0) +
      rVal * safeNumber(restScore.weight, 0) +
      pVal * safeNumber(physicalScore.weight, 0) +
      cVal * safeNumber(cognitiveScore.weight, 0) +
      hVal * safeNumber(healthStability.weight, 0);

    return safeScore(weighted, 0);
  }, [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability]);

  const predictedNextCheckup = useMemo(() => {
    const safeGrowthData = mergedGrowthData;
    const lastGrowth = safeGrowthData.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    if (!lastGrowth) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const daysSince = differenceInDays(new Date(), new Date(lastGrowth.date));
    const baseInterval = ageInMonths < 6 ? 14 : ageInMonths < 12 ? 30 : 60;
    const overdue = Math.max(0, daysSince - baseInterval);

    const daysUntil = overdue > 0 ? 3 : baseInterval - daysSince;
    return new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
  }, [mergedGrowthData, ageInMonths]);

  /* ── Persisted sleep-score history (last 30 days) — replaces stubbed dimensions.sleep.history ── */
  const SLEEP_HISTORY_KEY = '@littleloom_sleep_score_history';
  const [sleepHistory, setSleepHistory] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SLEEP_HISTORY_KEY);
        const rows: { date: string; value: number }[] = raw ? JSON.parse(raw) : [];
        const today = new Date().toISOString().slice(0, 10);
        const next = [...rows.filter(r => r.date !== today), { date: today, value: restScore.value }].slice(-30);
        await AsyncStorage.setItem(SLEEP_HISTORY_KEY, JSON.stringify(next));
        if (!cancelled) setSleepHistory(next.map(r => r.value));
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [restScore.value]);

  const dimensions = useMemo(() => ({
    nutrition: nutritionScore,
    rest: restScore,
    physical: physicalScore,
    cognitive: cognitiveScore,
    health: healthStability,
    sleep: { ...restScore, history: sleepHistory },
  }), [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability, sleepHistory]);

  /* ── Real insights & recommendations derived from the computed scores ── */
  const intelligence = useMemo(() => {
    const insights: { id: string; title: string; body: string; emoji: string; priority: 'low' | 'medium' | 'high' }[] = [];
    const recommendations: string[] = [];

    const dims = [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability];
    const lowest = [...dims].sort((a, b) => a.value - b.value)[0];
    const highest = [...dims].sort((a, b) => b.value - a.value)[0];

    if (lowest.value < 50) {
      insights.push({
        id: `low_${lowest.label}`,
        title: `${lowest.label} needs attention`,
        body: `${lowest.label} is your lowest dimension at ${lowest.value}/100 and weighs ${Math.round(lowest.weight * 100)}% of the composite index.`,
        emoji: '⚠️',
        priority: 'high',
      });
      recommendations.push(`Focus on ${lowest.label.toLowerCase()} first — consistent logging there lifts the composite fastest.`);
    }
    if (highest.value >= 80) {
      insights.push({
        id: `high_${highest.label}`,
        title: `${highest.label} is thriving`,
        body: `${highest.label} is at ${highest.value}/100. Keep the current rhythm.`,
        emoji: '🌟',
        priority: 'low',
      });
    }
    const v = velocityTrends;
    if (v.height.perMonth > 0 && v.height.perMonth < 0.8 && ageInMonths < 12) {
      insights.push({
        id: 'velocity_height_slow',
        title: 'Height velocity slowing',
        body: `Height is gaining ${v.height.perMonth.toFixed(1)} cm/mo — below the ~1.0–2.5 cm/mo expected in the first year.`,
        emoji: '📏',
        priority: 'medium',
      });
      recommendations.push('Log height at least monthly so velocity is measured over a meaningful span.');
    }
    if (milestoneReadiness[0] && milestoneReadiness[0].readinessPercent >= 80) {
      recommendations.push(`${milestoneReadiness[0].category} milestone window is open — try: ${milestoneReadiness[0].suggestedActivities[0]}.`);
    }
    return { insights, recommendations };
  }, [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability, velocityTrends, milestoneReadiness, ageInMonths]);

  /* ── Real getTrackerIndex: tracker → dimension map + 30-day logging consistency ── */
  const getTrackerIndex = useCallback((trackerId: string) => {
    const map: Record<string, 'nutritionScore' | 'restScore' | 'physicalScore' | 'cognitiveScore' | 'healthStability'> = {
      feed: 'nutritionScore', solid_food: 'nutritionScore', pumping: 'nutritionScore',
      sleep: 'restScore', nap: 'restScore', bedtime: 'restScore',
      growth: 'physicalScore', tummy_time: 'physicalScore',
      milestone: 'cognitiveScore', play: 'cognitiveScore', reading: 'cognitiveScore',
      temperature: 'healthStability', symptom: 'healthStability', medication: 'healthStability', vaccine: 'healthStability',
    };
    const key = map[trackerId];
    if (!key) return null;
    const dimScores = { nutritionScore, restScore, physicalScore, cognitiveScore, healthStability };
    const thirtyDaysAgo = subDays(new Date(), 30).getTime();
    const entries30d = (getEntries(trackerId, 200) || []).filter(e => e.timestamp > thirtyDaysAgo).length;
    // 60% dimension score + 40% logging consistency (14+ logs/month saturates)
    const score = Math.round(dimScores[key].value * 0.6 + Math.min(100, (entries30d / 14) * 100) * 0.4);
    return { trackerId, dimension: key, score: Math.max(0, Math.min(100, score)), entries30d };
  }, [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability, getEntries]);

  /* ── Real generateReminders: guideline gaps, growth interval, milestone windows, fever follow-up ── */
  const generateReminders = useCallback((_entries: TrackerEntry[], _trackers: any[], _score: any) => {
    const reminders: { id: string; title: string; body: string; emoji: string; priority: 'low' | 'medium' | 'high' }[] = [];
    const now = Date.now();
    const dayMs = 86400000;

    const lastGrowth = mergedGrowthData
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const intervalDays = ageInMonths < 6 ? 14 : ageInMonths < 12 ? 30 : 60;
    if (!lastGrowth || now - new Date(lastGrowth.date).getTime() > intervalDays * dayMs) {
      reminders.push({
        id: 'rem_growth_overdue',
        title: 'Growth measurement due',
        body: ageInMonths < 6 ? 'Under 6 months, measure every ~2 weeks.' : 'A fresh weight/height keeps velocity and percentiles accurate.',
        emoji: '📏',
        priority: 'medium',
      });
    }

    const nutritionGuide = getGuidelineForAge(NUTRITION_GUIDELINES, ageInMonths);
    const feedWeek = (getEntries('feed', 60) || []).filter(e => e.timestamp > now - 7 * dayMs);
    if (feedWeek.length >= 3 && nutritionScore.value < 55) {
      reminders.push({
        id: 'rem_nutrition_gap',
        title: 'Intake trending below guideline',
        body: `Daily average is under the ${nutritionGuide.minMl}ml floor for age ${ageInMonths}mo.`,
        emoji: '🍼',
        priority: 'high',
      });
    }

    const sleepGuide = getGuidelineForAge(SLEEP_GUIDELINES, ageInMonths);
    if (restScore.value < 55) {
      reminders.push({
        id: 'rem_sleep_gap',
        title: 'Sleep below age guideline',
        body: `Aim for ${sleepGuide.minHours}–${sleepGuide.maxHours}h total (incl. ${sleepGuide.naps} nap${sleepGuide.naps > 1 ? 's' : ''}).`,
        emoji: '😴',
        priority: 'high',
      });
    }

    milestoneReadiness.forEach(r => {
      if (r.expectedWindow.end - ageInMonths <= 1 && r.readinessPercent < 100) {
        reminders.push({
          id: `rem_milestone_${r.category}`,
          title: `${r.category} milestone window closing`,
          body: `Typical window ends ~${r.expectedWindow.end}mo. Try: ${r.suggestedActivities[0]}.`,
          emoji: '🎯',
          priority: 'low',
        });
      }
    });

    const recentFever = (getEntries('temperature', 10) || []).some(e => {
      const val = safeNumber(e.data?.value, 0);
      const unit = String(e.data?.unit || '');
      const celsius = unit === 'fahrenheit' ? (val - 32) * 5 / 9 : val;
      return celsius > 38 && now - e.timestamp < 2 * dayMs;
    });
    if (recentFever) {
      reminders.push({
        id: 'rem_fever_followup',
        title: 'Re-check temperature',
        body: 'A fever reading was logged in the last 48h — take a follow-up reading.',
        emoji: '🌡️',
        priority: 'high',
      });
    }

    return reminders;
  }, [mergedGrowthData, ageInMonths, nutritionScore.value, restScore.value, milestoneReadiness, getEntries]);

  /* ── Real checkNewAchievements: score thresholds, filtered against already-unlocked ids ── */
  const checkNewAchievements = useCallback((_entries: TrackerEntry[], _score: any, unlocked: string[]) => {
    const candidates = [
      { id: 'gi_composite_80', title: 'Composite index above 80', emoji: '⭐', met: compositeIndex >= 80 },
      { id: 'gi_nutrition_70', title: 'Nutrition score above 70', emoji: '🍎', met: nutritionScore.value >= 70 },
      { id: 'gi_rest_70', title: 'Rest score above 70', emoji: '😴', met: restScore.value >= 70 },
      { id: 'gi_physical_70', title: 'Physical score above 70', emoji: '💪', met: physicalScore.value >= 70 },
      { id: 'gi_cognitive_70', title: 'Cognitive score above 70', emoji: '🧠', met: cognitiveScore.value >= 70 },
      { id: 'gi_health_70', title: 'Health stability above 70', emoji: '❤️', met: healthStability.value >= 70 },
    ];
    return candidates.filter(c => c.met && !unlocked.includes(c.id));
  }, [compositeIndex, nutritionScore.value, restScore.value, physicalScore.value, cognitiveScore.value, healthStability.value]);

  const growthIndex: GrowthIndex = useMemo(() => ({
    nutritionScore,
    restScore,
    physicalScore,
    cognitiveScore,
    healthStability,
    compositeIndex,
    predictedNextCheckup,
    milestoneReadiness,
    velocityTrends,
    lastUpdated: new Date().toISOString(),
    ageInMonths,
    generateReminders,
    checkNewAchievements,
    getTrackerIndex,
    dimensions,
    predicted: { value: compositeIndex },
    overall: { value: compositeIndex },
    trend: compositeIndex > 70 ? 'up' : compositeIndex < 40 ? 'down' : 'stable',
    insights: intelligence.insights,
    recommendations: intelligence.recommendations,
  }), [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability, compositeIndex, predictedNextCheckup, milestoneReadiness, velocityTrends, ageInMonths, generateReminders, checkNewAchievements, getTrackerIndex, dimensions, intelligence]);

  return { growthIndex, ageInMonths };
};

export default useGrowthIntelligence;