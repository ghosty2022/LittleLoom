import { useMemo, useCallback } from 'react';
import { differenceInHours, differenceInDays, differenceInMonths, addHours, addDays, format } from 'date-fns';

import { useTracker } from './useTrackerContext';
// FIX: Import directly from BabyContext instead of deleted useBabyContext
import { useBaby } from '@/context/BabyContext';
import type { GrowthIndex } from './useGrowthIntelligence';

export interface PredictiveReminder {
  id: string;
  type: string;
  title: string;
  description: string;
  emoji: string;
  priority: 'high' | 'medium' | 'low';
  suggestedTime: Date;
  confidence: number; // 0-100
  basedOn: {
    trackerId: string;
    dataPoint: string;
    value: string;
  }[];
  action: {
    label: string;
    screen: string;
    params: Record<string, unknown>;
  };
  autoDismissConditions?: string[];
  actedUpon?: boolean;
}

interface MinimalGrowthIndex {
  restScore?: { value: number };
  healthStability?: { value: number };
  ageInMonths?: number;
  milestoneReadiness?: Array<{
    category: string;
    readinessPercent: number;
    suggestedActivities: string[];
    relatedTrackerIds: string[];
  }>;
}

export const usePredictiveReminders = () => {
  const { entries, getEntries } = useTracker();
  const { currentBaby, growthData } = useBaby();
  const growthIndex: MinimalGrowthIndex = useMemo(() => ({
    restScore: { value: 70 },
    healthStability: { value: 80 },
    ageInMonths: currentBaby?.birthDate ? 
      Math.max(0, differenceInMonths(new Date(), new Date(currentBaby.birthDate))) : 0,
    milestoneReadiness: [],
  }), [currentBaby]);

  const reminders = useMemo((): PredictiveReminder[] => {
    if (!currentBaby) return [];
    
    const now = new Date();
    const suggestions: PredictiveReminder[] = [];
    
    const feedEntries = getEntries('feed', 20);
    if (feedEntries.length >= 3) {
      const intervals = [];
      for (let i = 1; i < feedEntries.length; i++) {
        intervals.push(differenceInHours(
          new Date(feedEntries[i-1].timestamp),
          new Date(feedEntries[i].timestamp)
        ));
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastFeed = feedEntries[0];
      const hoursSinceLast = differenceInHours(now, new Date(lastFeed.timestamp));
      
      if (hoursSinceLast > avgInterval * 0.8) {
        suggestions.push({
          id: 'feed_predictive',
          type: 'feed',
          title: 'Feeding Time Soon',
          description: `Last feed was ${hoursSinceLast}h ago. Usual interval: ${Math.round(avgInterval)}h.`,
          emoji: '🍼',
          priority: hoursSinceLast > avgInterval * 1.2 ? 'high' : 'medium',
          suggestedTime: addHours(new Date(lastFeed.timestamp), avgInterval),
          confidence: Math.min(95, 60 + hoursSinceLast * 5),
          basedOn: [{
            trackerId: 'feed',
            dataPoint: 'average_interval',
            value: `${Math.round(avgInterval)}h`,
          }],
          action: {
            label: 'Log Feed',
            screen: 'AddEntry',
            params: { trackerId: 'feed' },
          },
        });
      }
    }
    
    const sleepEntries = getEntries('sleep', 14);
    if (sleepEntries.length >= 5) {
      const bedtimes = sleepEntries
        .filter(e => e.data.sleepType === 'night')
        .map(e => new Date(e.timestamp).getHours());
      
      if (bedtimes.length > 0) {
        const avgBedtime = Math.round(bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length);
        const nextBedtime = new Date();
        nextBedtime.setHours(avgBedtime, 0, 0, 0);
        if (nextBedtime < now) nextBedtime.setDate(nextBedtime.getDate() + 1);
        
        const sleepScore = growthIndex.restScore?.value ?? 70;
        if (sleepScore < 70) {
          suggestions.push({
            id: 'sleep_optimization',
            type: 'sleep',
            title: 'Optimize Sleep Schedule',
            description: `Sleep score is ${sleepScore}/100. Consistent bedtime at ${avgBedtime}:00 could help.`,
            emoji: '🌙',
            priority: sleepScore < 50 ? 'high' : 'medium',
            suggestedTime: nextBedtime,
            confidence: 85,
            basedOn: [{
              trackerId: 'sleep',
              dataPoint: 'average_bedtime',
              value: `${avgBedtime}:00`,
            }, {
              trackerId: 'sleep',
              dataPoint: 'sleep_score',
              value: `${sleepScore}/100`,
            }],
            action: {
              label: 'Start Bedtime',
              screen: 'AddEntry',
              params: { trackerId: 'sleep', presetData: { sleepType: 'night' } },
            },
          });
        }
      }
    }
    
    const lastGrowth = [...growthData].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    
    if (lastGrowth) {
      const daysSince = differenceInDays(now, new Date(lastGrowth.date));
      const recommendedInterval = (growthIndex.ageInMonths ?? 0) < 6 ? 14 : 30;
      
      if (daysSince > recommendedInterval * 0.8) {
        suggestions.push({
          id: 'growth_reminder',
          type: 'growth',
          title: 'Growth Check Due',
          description: `Last measurement was ${daysSince} days ago. Recommended: every ${recommendedInterval} days.`,
          emoji: '📏',
          priority: daysSince > recommendedInterval * 1.5 ? 'high' : 'medium',
          suggestedTime: addDays(new Date(lastGrowth.date), recommendedInterval),
          confidence: Math.min(90, 50 + daysSince * 2),
          basedOn: [{
            trackerId: 'growth',
            dataPoint: 'days_since_last',
            value: `${daysSince} days`,
          }],
          action: {
            label: 'Measure Growth',
            screen: 'AddEntry',
            params: { trackerId: 'growth' },
          },
        });
      }
    }
    
    (growthIndex.milestoneReadiness ?? []).forEach((readiness, idx) => {
      if (readiness.readinessPercent > 60) {
        suggestions.push({
          id: `milestone_ready_${idx}`,
          type: 'milestone',
          title: `${readiness.category.charAt(0).toUpperCase() + readiness.category.slice(1)} Milestone Soon!`,
          description: `Readiness: ${readiness.readinessPercent}%. Try: ${readiness.suggestedActivities[0] ?? 'Practice activities'}`,
          emoji: '🏆',
          priority: readiness.readinessPercent > 80 ? 'high' : 'medium',
          suggestedTime: addDays(now, 1),
          confidence: readiness.readinessPercent,
          basedOn: [{
            trackerId: readiness.relatedTrackerIds[0] ?? 'milestone',
            dataPoint: 'milestone_readiness',
            value: `${readiness.readinessPercent}%`,
          }],
          action: {
            label: 'Log Milestone',
            screen: 'AddEntry',
            params: { trackerId: 'milestone', presetData: { category: readiness.category } },
          },
        });
      }
    });
    
    if ((growthIndex.healthStability?.value ?? 100) < 60) {
      const tempEntries = getEntries('temperature', 7);
      const symptomEntries = getEntries('symptom', 7);
      
      if (tempEntries.length > 0 || symptomEntries.length > 0) {
        suggestions.push({
          id: 'health_alert',
          type: 'symptom',
          title: 'Health Pattern Detected',
          description: 'Recent symptoms or temperature entries suggest monitoring needed.',
          emoji: '🤒',
          priority: 'high',
          suggestedTime: now,
          confidence: 90,
          basedOn: [{
            trackerId: 'temperature',
            dataPoint: 'recent_entries',
            value: `${tempEntries.length} in 7 days`,
          }],
          action: {
            label: 'Check Health',
            screen: 'AddEntry',
            params: { trackerId: 'symptom' },
          },
        });
      }
    }
    
    const pottyEntries = getEntries('potty', 30);
    if (pottyEntries.length >= 10) {
      const successful = pottyEntries.filter(e => e.data.successful).length;
      const successRate = (successful / pottyEntries.length) * 100;
      
      if (successRate > 70 && (growthIndex.ageInMonths ?? 0) >= 18) {
        suggestions.push({
          id: 'potty_training',
          type: 'potty',
          title: 'Potty Training Ready?',
          description: `Success rate: ${Math.round(successRate)}%. Age: ${growthIndex.ageInMonths}m. Consider starting!`,
          emoji: '🚽',
          priority: 'medium',
          suggestedTime: addDays(now, 1),
          confidence: successRate,
          basedOn: [{
            trackerId: 'potty',
            dataPoint: 'success_rate',
            value: `${Math.round(successRate)}%`,
          }],
          action: {
            label: 'Log Potty',
            screen: 'AddEntry',
            params: { trackerId: 'potty' },
          },
        });
      }
    }
    
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return suggestions.sort((a, b) => 
      (priorityWeight[b.priority] * b.confidence) - (priorityWeight[a.priority] * a.confidence)
    );
  }, [entries, getEntries, currentBaby, growthData, growthIndex]);

  return { reminders };
};

export default usePredictiveReminders;