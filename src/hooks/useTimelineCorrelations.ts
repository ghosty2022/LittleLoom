import { useMemo } from 'react';
import { differenceInHours, differenceInDays } from 'date-fns';

// FIX: Import directly from context source
import { useTracker } from './useTrackerContext';
import { TimelineCorrelation } from '@/components/trackers/TrackerCorrelationBadge';

export const useTimelineCorrelations = () => {
  const { entries, getEntries } = useTracker();

  const correlations = useMemo((): TimelineCorrelation[] => {
    const results: TimelineCorrelation[] = [];
    const allEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

    const feedEntries = getEntries('feed', 50);
    feedEntries.forEach((feed, idx) => {
      const sleepAfter = allEntries.find(e =>
        e.trackerId === 'sleep' &&
        e.timestamp > feed.timestamp &&
        e.timestamp - feed.timestamp < 2 * 60 * 60 * 1000 // 2 hours
      );

      if (sleepAfter) {
        results.push({
          id: `feed-sleep-${feed.id}`,
          type: 'feed_sleep_pattern',
          primaryEntry: { trackerId: feed.trackerId, title: feed.title, timestamp: feed.timestamp },
          relatedEntry: { trackerId: sleepAfter.trackerId, title: sleepAfter.title, timestamp: sleepAfter.timestamp },
          insight: `Post-feed nap: ${Math.round((sleepAfter.timestamp - feed.timestamp) / 60000)} min after feeding`,
          confidence: 85,
          color: '#FF9F43',
        });
      }
    });

    const growthEntries = getEntries('growth', 20);
    const milestoneEntries = getEntries('milestone', 20);

    growthEntries.forEach(growth => {
      const nearbyMilestone = milestoneEntries.find(m =>
        Math.abs(m.timestamp - growth.timestamp) < 7 * 24 * 60 * 60 * 1000 // 7 days
      );

      if (nearbyMilestone) {
        const daysDiff = Math.abs(differenceInDays(
          new Date(growth.timestamp),
          new Date(nearbyMilestone.timestamp)
        ));

        results.push({
          id: `growth-milestone-${growth.id}`,
          type: 'growth_milestone_correlation',
          primaryEntry: { trackerId: growth.trackerId, title: growth.title, timestamp: growth.timestamp },
          relatedEntry: { trackerId: nearbyMilestone.trackerId, title: nearbyMilestone.title, timestamp: nearbyMilestone.timestamp },
          insight: `Growth spurt ${daysDiff} days from "${nearbyMilestone.title}" milestone`,
          confidence: Math.round(70 + (7 - daysDiff) * 4),
          color: '#10AC84',
        });
      }
    });

    const tempEntries = getEntries('temperature', 14);
    const symptomEntries = getEntries('symptom', 14);
    const medEntries = getEntries('medication', 14);

    tempEntries.forEach(temp => {
      const nearbySymptom = symptomEntries.find(s =>
        Math.abs(s.timestamp - temp.timestamp) < 24 * 60 * 60 * 1000
      );
      const nearbyMed = medEntries.find(m =>
        Math.abs(m.timestamp - temp.timestamp) < 48 * 60 * 60 * 1000
      );

      if (nearbySymptom || nearbyMed) {
        results.push({
          id: `health-${temp.id}`,
          type: 'health_alert',
          primaryEntry: { trackerId: temp.trackerId, title: temp.title, timestamp: temp.timestamp },
          relatedEntry: {
            trackerId: nearbySymptom?.trackerId || nearbyMed?.trackerId || 'symptom',
            title: nearbySymptom?.title || nearbyMed?.title || 'Health event',
            timestamp: nearbySymptom?.timestamp || nearbyMed?.timestamp || temp.timestamp,
          },
          insight: `Health event: ${nearbySymptom ? 'symptom logged' : ''}${nearbySymptom && nearbyMed ? ' + ' : ''}${nearbyMed ? 'medication given' : ''}`,
          confidence: 90,
          color: '#EE5A24',
        });
      }
    });

    const timeWindows: Record<string, typeof allEntries> = {};
    allEntries.forEach(entry => {
      const hour = Math.floor(entry.timestamp / (60 * 60 * 1000));
      const key = `${hour}`;
      if (!timeWindows[key]) timeWindows[key] = [];
      timeWindows[key].push(entry);
    });

    Object.entries(timeWindows)
      .filter(([_, entries]) => entries.length >= 3)
      .forEach(([hour, entries]) => {
        const uniqueTrackers = [...new Set(entries.map(e => e.trackerId))];
        if (uniqueTrackers.length >= 2) {
          results.push({
            id: `cluster-${hour}`,
            type: 'activity_cluster',
            primaryEntry: { trackerId: entries[0].trackerId, title: entries[0].title, timestamp: entries[0].timestamp },
            relatedEntry: { trackerId: entries[1].trackerId, title: entries[1].title, timestamp: entries[1].timestamp },
            insight: `${entries.length} activities in 1 hour: ${uniqueTrackers.join(', ')}`,
            confidence: 75,
            color: '#54A0FF',
          });
        }
      });

    const seen = new Set<string>();
    return results.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 10);
  }, [entries, getEntries]);

  return { correlations };
};

export default useTimelineCorrelations;