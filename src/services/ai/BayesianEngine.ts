// src/services/ai/BayesianEngine.ts
import { supabase } from '@/utils/supabase';

interface NormalRange {
  mean: number;
  stddev: number;
  confidence: number;
  samples: number;
}

interface Anomaly {
  isAnomaly: boolean;
  zScore: number;
  severity: 'low' | 'medium' | 'high';
  normalRange: [number, number];
  confidence: number;
}

// Population priors (can be adjusted based on WHO data)
const POPULATION_MEANS: Record<string, number> = {
  temperature: 37.0, // Celsius
  weight: 7.5, // kg (average 6-month-old)
  height: 65, // cm (average 6-month-old)
  feed_interval: 180, // minutes
  sleep_duration: 720, // minutes (12 hours)
};

export class BayesianEngine {
  /**
   * Learn each baby's normal range for a metric using Bayesian inference.
   * Updates with each new data point (online learning).
   */
  async learnNormalRange(babyId: string, metric: string): Promise<NormalRange> {
    // Get historical data for this baby
    const { data: history } = await supabase
      .from('tracker_entries')
      .select('data')
      .eq('baby_id', babyId)
      .eq('tracker_id', metric)
      .eq('is_deleted', false)
      .order('timestamp', { ascending: false })
      .limit(100); // Use last 100 entries for learning

    const values = (history || [])
      .map(h => this.extractValue(h.data, metric))
      .filter(v => v !== null && !isNaN(v)) as number[];

    if (values.length === 0) {
      // No data yet, return population prior with low confidence
      return {
        mean: POPULATION_MEANS[metric] || 0,
        stddev: 1, // Default uncertainty
        confidence: 0.1,
        samples: 0,
      };
    }

    // Bayesian updating with normal-inverse-gamma prior
    const prior = {
      mu: POPULATION_MEANS[metric] || values[0],
      lambda: 1, // confidence in prior (higher = more confident)
      alpha: 1,
      beta: 1,
    };

    const posterior = values.reduce(
      (acc, value) => this.updatePosterior(acc, value),
      prior
    );

    const stddev = Math.sqrt(posterior.beta / (posterior.alpha - 1));

    return {
      mean: posterior.mu,
      stddev: Math.max(stddev, 0.01), // Prevent division by zero
      confidence: posterior.lambda / (posterior.lambda + values.length),
      samples: values.length,
    };
  }

  /**
   * Detect anomalies using learned normal ranges
   */
  async detectAnomaly(babyId: string, metric: string, value: number): Promise<Anomaly> {
    const normal = await this.learnNormalRange(babyId, metric);
    const zScore = Math.abs((value - normal.mean) / normal.stddev);
    
    return {
      isAnomaly: zScore > 2.5,
      zScore,
      severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
      normalRange: [normal.mean - 2 * normal.stddev, normal.mean + 2 * normal.stddev],
      confidence: normal.confidence,
    };
  }

  private updatePosterior(posterior: any, value: number): any {
    // Simplified Bayesian update for normal distribution
    const n = 1; // Single observation
    const newLambda = posterior.lambda + n;
    const newMu = (posterior.lambda * posterior.mu + n * value) / newLambda;
    const newAlpha = posterior.alpha + n / 2;
    const newBeta = posterior.beta + (n * posterior.lambda * Math.pow(value - posterior.mu, 2)) / (2 * newLambda);
    
    return {
      mu: newMu,
      lambda: newLambda,
      alpha: newAlpha,
      beta: newBeta,
    };
  }

  private extractValue(data: any, metric: string): number | null {
    if (!data) return null;
    switch (metric) {
      case 'temperature':
        const unit = data.unit || 'celsius';
        const temp = Number(data.value);
        return unit === 'fahrenheit' ? (temp - 32) * 5 / 9 : temp;
      case 'weight':
        return Number(data.value);
      case 'height':
        return Number(data.value);
      case 'feed_interval':
        return Number(data.duration) / 60; // Convert to minutes
      case 'sleep_duration':
        return Number(data.duration) / 60; // Convert to minutes
      default:
        return Number(data.value) || null;
    }
  }
}

export const bayesianEngine = new BayesianEngine();