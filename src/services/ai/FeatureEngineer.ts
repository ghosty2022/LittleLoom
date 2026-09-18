// src/services/ai/FeatureEngineer.ts
import { supabase } from '@/utils/supabase';
import { TrackerEntry } from '@/types/trackers';

export class FeatureEngineer {
  /**
   * Compute features for a baby for a given date range
   */
  async computeAndStoreFeatures(babyId: string, date: Date): Promise<void> {
    const entries = await this.getEntriesForDay(babyId, date);
    if (entries.length === 0) return; // No data to compute

    const previousFeatures = await this.getPreviousFeatures(babyId, date);
    const features = this.computeFeatures(entries, previousFeatures);
    
    // Upsert into ai_features table
    await supabase.from('ai_features').upsert({
      baby_id: babyId,
      feature_date: date.toISOString().split('T')[0],
      ...features,
    }, { onConflict: 'baby_id, feature_date' });
  }

  private async getEntriesForDay(babyId: string, date: Date): Promise<TrackerEntry[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .eq('baby_id', babyId)
      .eq('is_deleted', false)
      .gte('timestamp', startOfDay.toISOString())
      .lt('timestamp', endOfDay.toISOString());

    if (error) {
      console.error('Error fetching entries:', error);
      return [];
    }
    return data || [];
  }

  private async getPreviousFeatures(babyId: string, date: Date): Promise<any> {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const { data } = await supabase
      .from('ai_features')
      .select('*')
      .eq('baby_id', babyId)
      .eq('feature_date', prevDate.toISOString().split('T')[0])
      .maybeSingle();
    return data;
  }

  private computeFeatures(entries: TrackerEntry[], previous: any): any {
    const feedEntries = entries.filter(e => e.trackerId === 'feed');
    const sleepEntries = entries.filter(e => e.trackerId === 'sleep');
    const growthEntries = entries.filter(e => e.trackerId === 'growth');
    const tempEntries = entries.filter(e => e.trackerId === 'temperature');

    // Basic computation (expanded in Phase 2)
    const feedCount = feedEntries.length;
    const sleepTotalMinutes = sleepEntries.reduce((acc, e) => {
      const duration = Number(e.data.duration) || 0;
      return acc + (duration / 60); // assuming duration is in seconds
    }, 0);
    
    // Weight velocity
    let weightVelocity = null;
    if (growthEntries.length > 0 && previous?.weight_kg) {
      const latestWeight = growthEntries.find(e => e.data.measurementType === 'weight')?.data.value;
      if (latestWeight && previous.weight_kg) {
        weightVelocity = (Number(latestWeight) - previous.weight_kg) / 7; // per day, will adjust
      }
    }

    // Consistency Score (simplified: how many hours of the day have at least one entry)
    const hoursWithEntries = new Set(entries.map(e => new Date(e.timestamp).getHours()));
    const consistencyScore = Math.min(100, (hoursWithEntries.size / 24) * 100 * 2.5); // scaled

    return {
      feed_count: feedCount,
      feed_total_ml: feedEntries.reduce((acc, e) => acc + (Number(e.data.amount) || 0), 0),
      sleep_total_minutes: sleepTotalMinutes,
      sleep_nap_count: sleepEntries.filter(e => e.data.sleepType === 'nap').length,
      weight_kg: Number(growthEntries.find(e => e.data.measurementType === 'weight')?.data.value) || previous?.weight_kg,
      weight_velocity_kg_per_week: weightVelocity,
      temperature_max: Math.max(...tempEntries.map(e => Number(e.data.value) || 0), 0),
      symptom_count: entries.filter(e => e.trackerId === 'symptom').length,
      routine_consistency_score: consistencyScore,
      parent_engagement_score: Math.min(100, entries.length * 2), // simplified
    };
  }
}