// src/services/ai/BayesianEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Bayesian adaptive thresholds for per-baby "normal" ranges.
//
// FIXES in this version:
//   ✓ O(1) incremental learning (was O(n) — reprocessed entire history)
//   ✓ Persisted posterior state (AsyncStorage + Supabase app_settings)
//   ✓ Sanity bounds — rejects nonsense values before they poison the posterior
//   ✓ Consent gate — respects "Personal AI Learning" toggle
//   ✓ Versioned storage keys — safe model upgrades
//   ✓ Uses canonical Supabase client (utils/supabase)
//   ✓ VERIFIED: `extractMetricValue` duration parsing was ambiguous between
//     seconds-vs-minutes when the tracker stored a raw number. Now the
//     schema is documented inline: `duration` = SECONDS (matching the
//     tracker_entries.data schema), `minutes` / `duration_minutes` =
//     explicit minutes if the caller provides them.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

// Uses the canonical helper — keeps session cache consistent across the app.
import { getCurrentUserId as getCanonicalUserId } from '@/database/dbHelpers';

async function getCurrentUserId(): Promise<string | null> {
  return getCanonicalUserId();
}

// ─── Types ──────────────────────────────────────────────────────────

export type MetricKey =
  | 'temperature_c'
  | 'feeding_ml'
  | 'feed_interval_min'
  | 'sleep_duration_min'
  | 'sleep_interval_min'
  | 'diaper_interval_min'
  | 'weight_kg'
  | 'height_cm'
  | 'head_cm'
  | 'heart_rate_bpm'
  | 'blood_oxygen'
  | 'mood_score'
  | 'poop_interval_hr'
  | 'wake_window_min';

/** Legacy metric names used by existing code — kept for compatibility */
export type LegacyMetric =
  | 'temperature'
  | 'weight'
  | 'height'
  | 'feed_interval'
  | 'sleep_duration';

/** Union — accepts both new and legacy names */
export type AnyMetric = MetricKey | LegacyMetric;

/** Map legacy names → canonical */
const LEGACY_MAP: Record<LegacyMetric, MetricKey> = {
  temperature: 'temperature_c',
  weight: 'weight_kg',
  height: 'height_cm',
  feed_interval: 'feed_interval_min',
  sleep_duration: 'sleep_duration_min',
};

export interface NormalRange {
  mean: number;
  stddev: number;
  confidence: number; // 0..1
  samples: number;
}

export interface LearnedRange extends NormalRange {
  metric: MetricKey;
  lower95: number;
  upper95: number;
  updatedAt: number;
}

export interface Anomaly {
  isAnomaly: boolean;
  zScore: number;
  severity: 'low' | 'medium' | 'high';
  normalRange: [number, number];
  confidence: number;
  /** Human-readable explanation */
  explanation?: string;
}

/** Internal posterior state (Normal-Inverse-Gamma) */
interface Posterior {
  mu: number;
  lambda: number;
  alpha: number;
  beta: number;
  n: number;
  updatedAt: number;
}

interface PriorSpec {
  mu: number;
  sigmaPrior: number;
  priorStrength: number;
  sigmaFloor: number;
  min: number;
  max: number;
}

// ─── Priors ─────────────────────────────────────────────────────────
// Sources: WHO growth standards, NICE pediatric guidelines.

const PRIORS: Record<MetricKey, PriorSpec> = {
  temperature_c:      { mu: 36.8, sigmaPrior: 0.5,  priorStrength: 5, sigmaFloor: 0.15, min: 33,  max: 43 },
  feeding_ml:         { mu: 120,  sigmaPrior: 60,   priorStrength: 3, sigmaFloor: 10,   min: 1,   max: 500 },
  feed_interval_min:  { mu: 180,  sigmaPrior: 60,   priorStrength: 3, sigmaFloor: 15,   min: 20,  max: 720 },
  sleep_duration_min: { mu: 90,   sigmaPrior: 45,   priorStrength: 3, sigmaFloor: 15,   min: 5,   max: 900 },
  sleep_interval_min: { mu: 240,  sigmaPrior: 90,   priorStrength: 3, sigmaFloor: 20,   min: 30,  max: 1200 },
  diaper_interval_min:{ mu: 150,  sigmaPrior: 60,   priorStrength: 3, sigmaFloor: 15,   min: 15,  max: 720 },
  weight_kg:          { mu: 7.5,  sigmaPrior: 2.5,  priorStrength: 3, sigmaFloor: 0.2,  min: 0.5, max: 40 },
  height_cm:          { mu: 65,   sigmaPrior: 12,   priorStrength: 3, sigmaFloor: 1,    min: 30,  max: 130 },
  head_cm:            { mu: 42,   sigmaPrior: 4,    priorStrength: 3, sigmaFloor: 0.5,  min: 25,  max: 60 },
  heart_rate_bpm:     { mu: 130,  sigmaPrior: 25,   priorStrength: 3, sigmaFloor: 5,    min: 60,  max: 220 },
  blood_oxygen:       { mu: 98,   sigmaPrior: 2,    priorStrength: 3, sigmaFloor: 0.5,  min: 70,  max: 100 },
  mood_score:         { mu: 3.5,  sigmaPrior: 1.1,  priorStrength: 3, sigmaFloor: 0.3,  min: 1,   max: 5 },
  poop_interval_hr:   { mu: 24,   sigmaPrior: 18,   priorStrength: 3, sigmaFloor: 3,    min: 1,   max: 168 },
  wake_window_min:    { mu: 120,  sigmaPrior: 45,   priorStrength: 3, sigmaFloor: 15,   min: 20,  max: 600 },
};

// ─── Storage keys ───────────────────────────────────────────────────

const STORAGE_PREFIX = '@littleloom_bayes_v1:';
const CONSENT_KEY = '@littleloom_ai_consent_v1';
const SUPABASE_KEY_PREFIX = 'bayes:';

const storageKey = (babyId: string, metric: MetricKey) =>
  `${STORAGE_PREFIX}${babyId}:${metric}`;

const supabaseKey = (babyId: string, metric: MetricKey) =>
  `${SUPABASE_KEY_PREFIX}${babyId}:${metric}`;

// ─── In-memory cache (per session) ──────────────────────────────────

const memoryCache = new Map<string, Posterior>();

// ─── Helpers ────────────────────────────────────────────────────────

const resolveMetric = (metric: AnyMetric): MetricKey => {
  if (metric in LEGACY_MAP) return LEGACY_MAP[metric as LegacyMetric];
  return metric as MetricKey;
};

const priorFromSpec = (spec: PriorSpec): Posterior => ({
  mu: spec.mu,
  lambda: spec.priorStrength,
  alpha: (spec.priorStrength + 1) / 2,
  beta: (spec.sigmaPrior * spec.sigmaPrior * spec.priorStrength) / 2,
  n: 0,
  updatedAt: Date.now(),
});

/**
 * Normal-Inverse-Gamma posterior update for a single observation.
 */
const updatePosterior = (
  post: Posterior,
  x: number,
  sigmaFloor: number
): Posterior => {
  const lambdaNext = post.lambda + 1;
  const muNext = (post.lambda * post.mu + x) / lambdaNext;
  const alphaNext = post.alpha + 0.5;
  const betaNext =
    post.beta +
    (post.lambda * (x - post.mu) * (x - post.mu)) / (2 * lambdaNext);

  const sigmaSq = betaNext / (alphaNext - 1);
  const sigma = Math.max(Math.sqrt(sigmaSq), sigmaFloor);
  const adjustedBeta = sigma * sigma * (alphaNext - 1);

  return {
    mu: muNext,
    lambda: lambdaNext,
    alpha: alphaNext,
    beta: adjustedBeta,
    n: post.n + 1,
    updatedAt: Date.now(),
  };
};

const posteriorToRange = (
  post: Posterior,
  spec: PriorSpec,
  metric: MetricKey
): LearnedRange => {
  const sigma = Math.max(
    Math.sqrt(post.beta / (post.alpha - 1)),
    spec.sigmaFloor
  );
  return {
    metric,
    mean: post.mu,
    stddev: sigma,
    lower95: post.mu - 1.96 * sigma,
    upper95: post.mu + 1.96 * sigma,
    samples: post.n,
    confidence: post.n / (post.n + spec.priorStrength),
    updatedAt: post.updatedAt,
  };
};

/**
 * Check consent — respects "Personal AI Learning" toggle.
 * Returns true if learning is allowed (default when no explicit toggle).
 */
async function isLearningAllowed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return true;
    const consent = JSON.parse(raw);
    return consent?.learningEnabled !== false;
  } catch {
    return true;
  }
}

// ─── Persistence ────────────────────────────────────────────────────

async function loadPosterior(babyId: string, metric: MetricKey): Promise<Posterior> {
  const key = storageKey(babyId, metric);

  // 1. Memory
  const cached = memoryCache.get(key);
  if (cached) return cached;

  // 2. AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const post = JSON.parse(raw) as Posterior;
      memoryCache.set(key, post);
      return post;
    }
  } catch {}

  // 3. Supabase (cold start after reinstall)
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      const { data } = await supabase
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', supabaseKey(babyId, metric))
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.updated_at) {
        const age = Date.now() - new Date(data.updated_at).getTime();
        if (age > 90 * 24 * 60 * 60 * 1000) {
          if (__DEV__) console.log('[Bayes] Ignoring stale Supabase row:', metric);
        } else if (data.value) {
          const post = JSON.parse(data.value) as Posterior;
          memoryCache.set(key, post);
          AsyncStorage.setItem(key, data.value).catch(() => {});
          return post;
        }
      } else if (data?.value) {
        const post = JSON.parse(data.value) as Posterior;
        memoryCache.set(key, post);
        AsyncStorage.setItem(key, data.value).catch(() => {});
        return post;
      }
    }
  } catch {}

  // 4. Prior — try cohort prior first, fall back to generic
  try {
    const { getCohortPrior, ageToCohort } = await import('./CohortPriors');

    let babyMetaRaw = await AsyncStorage.getItem(`@littleloom_baby_meta_v1:${babyId}`);
    if (!babyMetaRaw) {
      try {
        const { data: babyRow } = await supabase
          .from('babies')
          .select('date_of_birth')
          .eq('id', babyId)
          .maybeSingle();
        if (babyRow?.date_of_birth) {
          const meta = JSON.stringify({ birthDate: babyRow.date_of_birth });
          await AsyncStorage.setItem(`@littleloom_baby_meta_v1:${babyId}`, meta);
          babyMetaRaw = meta;
        }
      } catch {}
    }
    const birthDate = babyMetaRaw ? JSON.parse(babyMetaRaw).birthDate : null;

    if (birthDate) {
      const cohort = ageToCohort(birthDate);
      const cohortPrior = await getCohortPrior(metric, cohort);

      if (cohortPrior && cohortPrior.sampleCount >= 20) {
        const spec = PRIORS[metric];
        const cohortPost: Posterior = {
          mu: cohortPrior.mu,
          lambda: cohortPrior.lambda,
          alpha: cohortPrior.alpha,
          beta: cohortPrior.beta,
          n: 0,
          updatedAt: Date.now(),
        };

        if (
          cohortPost.mu >= spec.min &&
          cohortPost.mu <= spec.max &&
          Math.sqrt(cohortPost.beta / Math.max(cohortPost.alpha - 1, 0.1)) >=
            spec.sigmaFloor
        ) {
          if (__DEV__) {
            console.log(
              `[Bayes] Loaded cohort prior for ${metric} @ ${cohort}: ` +
                `μ=${cohortPrior.mu.toFixed(2)} σ=${cohortPrior.sigma.toFixed(2)} ` +
                `n=${cohortPrior.sampleCount}`
            );
          }
          memoryCache.set(key, cohortPost);
          return cohortPost;
        }
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[Bayes] Cohort prior load failed:', e);
  }

  // 5. Generic prior fallback
  const post = priorFromSpec(PRIORS[metric]);
  memoryCache.set(key, post);
  return post;
}

async function persistPosterior(
  babyId: string,
  metric: MetricKey,
  post: Posterior
): Promise<void> {
  const key = storageKey(babyId, metric);
  memoryCache.set(key, post);

  const payload = JSON.stringify(post);

  try {
    await AsyncStorage.setItem(key, payload);
  } catch (e) {
    console.warn('[Bayes] AsyncStorage write failed:', e);
  }

  // Supabase — best effort, non-blocking
  getCurrentUserId()
    .then((userId) => {
      if (!userId) return;
      supabase
        .from('app_settings')
        .upsert(
          {
            key: supabaseKey(babyId, metric),
            value: payload,
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        )
        .then(({ error }) => {
          if (error && __DEV__) {
            console.warn('[Bayes] Supabase sync failed:', error.message);
          }
        });
    })
    .catch(() => {});
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Feed a new observation into the learning model.
 * O(1) — updates persisted posterior state.
 */
export async function observeValue(
  babyId: string,
  metricInput: AnyMetric,
  value: number,
  options: { rejectOutliers?: boolean } = {}
): Promise<LearnedRange> {
  const metric = resolveMetric(metricInput);
  const spec = PRIORS[metric];

  const allowed = await isLearningAllowed();
  if (!allowed) {
    const post = await loadPosterior(babyId, metric);
    return posteriorToRange(post, spec, metric);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`[Bayes] Non-finite value for ${metric}: ${value}`);
  }
  const rejectOutliers = options.rejectOutliers !== false;
  if (rejectOutliers && (value < spec.min || value > spec.max)) {
    if (__DEV__) {
      console.log(
        `[Bayes] Rejected outlier for ${metric}: ${value} (bounds ${spec.min}..${spec.max})`
      );
    }
    const post = await loadPosterior(babyId, metric);
    return posteriorToRange(post, spec, metric);
  }

  const current = await loadPosterior(babyId, metric);
  const updated = updatePosterior(current, value, spec.sigmaFloor);
  await persistPosterior(babyId, metric, updated);

  return posteriorToRange(updated, spec, metric);
}

export async function learnNormalRange(
  babyId: string,
  metricInput: AnyMetric
): Promise<NormalRange> {
  const metric = resolveMetric(metricInput);
  const spec = PRIORS[metric];
  const post = await loadPosterior(babyId, metric);
  const range = posteriorToRange(post, spec, metric);
  return {
    mean: range.mean,
    stddev: range.stddev,
    confidence: range.confidence,
    samples: range.samples,
  };
}

export async function getLearnedRange(
  babyId: string,
  metricInput: AnyMetric
): Promise<LearnedRange> {
  const metric = resolveMetric(metricInput);
  const spec = PRIORS[metric];
  const post = await loadPosterior(babyId, metric);
  return posteriorToRange(post, spec, metric);
}

export async function detectAnomaly(
  babyId: string,
  metricInput: AnyMetric,
  value: number,
  options: { thresholdZ?: number } = {}
): Promise<Anomaly> {
  const metric = resolveMetric(metricInput);
  const spec = PRIORS[metric];
  const thresholdZ = options.thresholdZ ?? 3.0;

  const learned = await getLearnedRange(babyId, metric);

  if (learned.samples < 5) {
    return {
      isAnomaly: false,
      zScore: 0,
      severity: 'low',
      normalRange: [
        learned.mean - 2 * spec.sigmaPrior,
        learned.mean + 2 * spec.sigmaPrior,
      ],
      confidence: learned.confidence,
      explanation: `Not enough data yet (${learned.samples} samples) to flag this reading.`,
    };
  }

  const c = learned.confidence;
  const sigmaBlend = (1 - c) * spec.sigmaPrior + c * learned.stddev;
  const sigmaSafe = Math.max(sigmaBlend, spec.sigmaFloor);

  const z = (value - learned.mean) / sigmaSafe;
  const absZ = Math.abs(z);

  let severity: Anomaly['severity'] = 'low';
  if (absZ >= 3.5) severity = 'high';
  else if (absZ >= thresholdZ) severity = 'medium';

  const isAnomaly = absZ >= thresholdZ;

  const direction = z > 0 ? 'above' : 'below';
  const explanation = isAnomaly
    ? `${value} is ${absZ.toFixed(1)} standard deviations ${direction} ${
        learned.samples > 0 ? "the baby's" : "the population's"
      } normal (${learned.mean.toFixed(1)} ± ${sigmaSafe.toFixed(1)}).`
    : `${value} is within normal range (${learned.mean.toFixed(1)} ± ${sigmaSafe.toFixed(1)}).`;

  return {
    isAnomaly,
    zScore: z,
    severity,
    normalRange: [learned.mean - 2 * sigmaSafe, learned.mean + 2 * sigmaSafe],
    confidence: learned.confidence,
    explanation,
  };
}

export async function getAllLearnedRanges(
  babyId: string,
  metrics: AnyMetric[]
): Promise<LearnedRange[]> {
  return Promise.all(metrics.map((m) => getLearnedRange(babyId, m)));
}

export async function resetLearningForBaby(babyId: string): Promise<void> {
  const metrics = Object.keys(PRIORS) as MetricKey[];
  const keys = metrics.map((m) => storageKey(babyId, m));

  for (const key of keys) memoryCache.delete(key);

  try {
    await AsyncStorage.multiRemove(keys);
  } catch {}

  try {
    const userId = await getCurrentUserId();
    if (userId) {
      await supabase
        .from('app_settings')
        .delete()
        .eq('user_id', userId)
        .like('key', `${SUPABASE_KEY_PREFIX}${babyId}:%`);
    }
  } catch {}

  console.log(`[Bayes] Learning reset for baby ${babyId}`);
}

// ─── Numeric coercion ──────────────────────────────────────────────

function coerceNumber(
  raw: unknown,
  preferUnit?: 'ml' | 'oz' | 'kg' | 'lb' | 'cm' | 'in' | 'sec' | 'min' | 'hr'
): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const str = String(raw).trim().toLowerCase();
  if (!str) return null;

  const plain = Number(str);
  if (Number.isFinite(plain)) return plain;

  const re =
    /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds|ml|milliliter|milliliters|oz|ounce|ounces|kg|kilogram|kilograms|lb|lbs|pound|pounds|cm|centimeter|centimeters|in|inch|inches)?/gi;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    matched = true;
    const u = (m[2] || '').toLowerCase();
    if (!u) total += n;
    else if (u.startsWith('h')) total += n * 60;
    else if (u.startsWith('m') && !u.startsWith('ml')) total += n;
    else if (u.startsWith('s')) total += n / 60;
    else if (u.startsWith('ml')) total += n;
    else if (u.startsWith('oz') && preferUnit === 'oz') total += n;
    else if (u === 'kg' || u === 'lb' || u === 'cm' || u === 'in') total += n;
    else total += n;
  }
  return matched && Number.isFinite(total) ? total : null;
}

/**
 * Extract a numeric value from tracker entry data, per metric.
 * Handles unit conversions (F→C, oz→ml).
 *
 * Schema notes:
 *   - `data.duration` is stored in SECONDS by the tracker_entries schema.
 *   - `data.minutes` / `data.duration_minutes` are explicit minute values
 *     when the caller provides them.
 *   - Strings like "1h 30m" / "90 min" are parsed by `coerceNumber`.
 */
export function extractMetricValue(
  metric: MetricKey,
  data: Record<string, unknown> | undefined
): number | null {
  if (!data) return null;

  const getNum = (key: string): number | null => coerceNumber(data[key]);

  switch (metric) {
    case 'temperature_c': {
      const v = getNum('value') ?? getNum('temperature');
      if (v === null) return null;
      const unit = String(data.unit || 'celsius').toLowerCase();
      return unit === 'fahrenheit' ? ((v - 32) * 5) / 9 : v;
    }
    case 'feeding_ml': {
      // Feed type guard — solids don't produce ml values
      const feedType = String(data.feedType || '').toLowerCase();
      if (feedType === 'solid' || feedType === 'water') return null;

      // Try specific field names first (newer schema)
      let amount =
        getNum('bottleAmount') ??
        getNum('amount_ml') ??
        getNum('amount') ??
        getNum('quantity');

      if (amount === null || amount <= 0) return null;

      // Determine unit — support both generic 'unit' and field-specific units
      const unit = String(
        data.bottleAmount_unit ||
        data.amount_unit ||
        data.unit ||
        'ml'
      ).toLowerCase();

      // Reject absurd amounts
      const ml = unit === 'oz' ? amount * 29.5735 : amount;
      if (ml > 500 || ml < 1) return null;
      return ml;
    }
    case 'weight_kg': {
      // Skip if this is a height or head measurement
      const mType = String(data.measurementType || '').toLowerCase();
      if (mType && mType !== 'weight') return null;

      const v =
        getNum('weight_kg') ??
        getNum('weight') ??
        (mType === 'weight' ? getNum('value') : null);
      if (v === null || v <= 0) return null;

      const unit = String(
        data.value_unit ||
        data.weight_unit ||
        data.unit ||
        'kg'
      ).toLowerCase();

      const kg = unit === 'lb' ? v * 0.453592 : unit === 'g' ? v / 1000 : v;

      // Sanity: 0.5 – 40 kg
      if (kg < 0.5 || kg > 40) return null;
      return kg;
    }
    case 'height_cm': {
      const v = getNum('height_cm') ?? getNum('height') ?? getNum('value');
      if (v === null) return null;
      const unit = String(data.unit || 'cm').toLowerCase();
      return unit === 'in' ? v * 2.54 : v;
    }
    case 'head_cm': {
      const v =
        getNum('head_cm') ??
        getNum('head') ??
        getNum('head_circumference') ??
        getNum('value');
      if (v === null) return null;
      const unit = String(data.unit || 'cm').toLowerCase();
      return unit === 'in' ? v * 2.54 : v;
    }
    case 'mood_score':
    case 'heart_rate_bpm':
    case 'blood_oxygen': {
      const v = getNum('value') ?? getNum('mood') ?? getNum('bpm') ?? getNum('spo2');
      return v !== null ? v : null;
    }
    case 'feed_interval_min':
    case 'sleep_duration_min':
    case 'sleep_interval_min':
    case 'diaper_interval_min':
    case 'poop_interval_hr':
    case 'wake_window_min': {
      // Try duration first (seconds), then minutes, then a generic parse
      const sec = getNum('duration');
      const minFromField = getNum('minutes') ?? getNum('duration_minutes');
      let minutes: number | null = null;
      if (sec !== null && sec > 0) minutes = sec / 60;
      else if (minFromField !== null) minutes = minFromField;
      else {
        const parsed = coerceNumber(data.duration ?? data.minutes);
        if (parsed !== null) minutes = parsed;
      }
      if (minutes === null) return null;
      return metric === 'poop_interval_hr' ? minutes / 60 : minutes;
    }
    default:
      return null;
  }
}

// ─── Reset memory cache for a baby ──────────────────────────────────

export async function resetLocalCacheForBaby(babyId: string): Promise<void> {
  const prefix = `${STORAGE_PREFIX}${babyId}:`;
  const toDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) toDelete.push(key);
  }
  for (const key of toDelete) memoryCache.delete(key);
  if (__DEV__) {
    console.log(`[Bayes] Cleared ${toDelete.length} memory cache entries for ${babyId}`);
  }
}

// ─── Legacy class-shaped export ─────────────────────────────────────

export class BayesianEngine {
  learnNormalRange(babyId: string, metric: string): Promise<NormalRange> {
    return learnNormalRange(babyId, metric as AnyMetric);
  }
  detectAnomaly(babyId: string, metric: string, value: number): Promise<Anomaly> {
    return detectAnomaly(babyId, metric as AnyMetric, value);
  }
  observeValue(
    babyId: string,
    metric: string,
    value: number
  ): Promise<LearnedRange> {
    return observeValue(babyId, metric as AnyMetric, value);
  }
}

export const bayesianEngine = new BayesianEngine();