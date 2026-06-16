import { useCallback, useMemo } from 'react';
import { differenceInMonths, differenceInDays, differenceInHours, subDays, subMonths } from 'date-fns';

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
  LMSParams
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
    height: { cmPerMonth: number; percentile: number };
    weight: { kgPerMonth: number; percentile: number };
    head: { cmPerMonth: number; percentile: number };
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

  const nutritionScore = useMemo((): SubScore => {
    const feedEntries = getEntries('feed', 30) || [];
    const last7Days = feedEntries.filter(e => e.timestamp > subDays(new Date(), 7).getTime());

    if (feedEntries.length === 0) {
      return { label: 'Nutrition', value: 0, color: '#FF9F43', weight: 0.25, trend: 'stable', delta: 0 };
    }

    const guideline = getGuidelineForAge(NUTRITION_GUIDELINES, ageInMonths);

    const dailyVolumes: Record<string, number> = {};
    last7Days.forEach(entry => {
      const day = new Date(entry.timestamp).toDateString();
      const amount = safeNumber(entry.data?.amount, 0);
      const unit = String(entry.data?.unit || '');
      const ml = unit === 'oz' ? amount * 29.57 : amount;
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
        const duration = safeNumber(entry.data?.duration, 0);
        const hours = duration / 3600;
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
      prevWeek.reduce((sum, e) => sum + safeNumber(e.data?.duration, 0), 0) / prevWeek.length / 3600 : 0;
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
    const safeGrowthData = (growthData || []).filter(g => g && g.type && g.date);

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
  }, [growthData, ageInMonths, gender, currentBaby?.birthDate]);

  const cognitiveScore = useMemo((): SubScore => {
    const milestoneEntries = getEntries('milestone', 50) || [];
    const playEntries = getEntries('play', 30) || [];
    const readingEntries = getEntries('reading', 30) || [];

    const safeMilestones = milestones || [];
    const achievedMilestoneIds = new Set(safeMilestones.map(m => m.title));

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
  }, [milestones, getEntries, ageInMonths]);

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
    const safeMilestones = milestones || [];
    const achievedTitles = new Set(safeMilestones.map(m => m.title));
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
  }, [milestones, ageInMonths, getEntries]);

  const velocityTrends = useMemo(() => {
    const safeGrowthData = (growthData || []).filter(g => g && g.date);

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
  }, [growthData, gender, currentBaby?.birthDate]);

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
    const safeGrowthData = (growthData || []).filter(g => g && g.date);
    const lastGrowth = safeGrowthData.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    if (!lastGrowth) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const daysSince = differenceInDays(new Date(), new Date(lastGrowth.date));
    const baseInterval = ageInMonths < 6 ? 14 : ageInMonths < 12 ? 30 : 60;
    const overdue = Math.max(0, daysSince - baseInterval);

    const daysUntil = overdue > 0 ? 3 : baseInterval - daysSince;
    return new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
  }, [growthData, ageInMonths]);

  const dimensions = useMemo(() => ({
    nutrition: nutritionScore,
    rest: restScore,
    physical: physicalScore,
    cognitive: cognitiveScore,
    health: healthStability,
    sleep: { ...restScore, history: [] as number[] }, // For sleepScoreHistory compatibility
  }), [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability]);

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
    generateReminders: () => [],
    checkNewAchievements: () => [],
    getTrackerIndex: () => null,
    dimensions,
    predicted: { value: compositeIndex },
    overall: { value: compositeIndex },
    trend: compositeIndex > 70 ? 'up' : compositeIndex < 40 ? 'down' : 'stable',
    insights: [],
    recommendations: [],
  }), [nutritionScore, restScore, physicalScore, cognitiveScore, healthStability, compositeIndex, predictedNextCheckup, milestoneReadiness, velocityTrends, ageInMonths, dimensions]);

  return { growthIndex, ageInMonths };
};

export default useGrowthIntelligence;
