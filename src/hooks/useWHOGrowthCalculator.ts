import React, { useCallback, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   WHO GROWTH CALCULATOR — LMS Method for Accurate Percentiles
   Based on WHO Multicentre Growth Reference Study (MGRS) 2006
   
   Data Source: WHO Child Growth Standards
   https://www.who.int/tools/child-growth-standards
   
   LMS Method: Cole TJ, Green PJ (1992) Smoothing reference centile curves:
   the LMS method and penalized likelihood. Statistics in Medicine 11:1305-1319
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LMSParams {
  L: number;  // Box-Cox power (skewness)
  M: number;  // Median
  S: number;  // Coefficient of variation (CV)
}

/* ──────────────────────────────────────────────────────────────────────────
   VERIFIED WHO LMS PARAMETERS — Boys 0-24 months
   
   Source: WHO MGRS 2006 official tables
   All values cross-referenced against WHO anthro software
   ────────────────────────────────────────────────────────────────────────── */

export const WHO_BOY_LMS: Record<number, { height: LMSParams; weight: LMSParams; head: LMSParams; bmi: LMSParams }> = {
  0: { height: { L: 1, M: 49.8842, S: 0.03795 }, weight: { L: 0.3487, M: 3.3464, S: 0.14602 }, head: { L: 1, M: 34.4618, S: 0.03686 }, bmi: { L: -0.3053, M: 13.4069, S: 0.0956 } },
  1: { height: { L: 1, M: 54.7244, S: 0.03557 }, weight: { L: 0.2297, M: 4.4709, S: 0.13395 }, head: { L: 1, M: 37.2759, S: 0.03133 }, bmi: { L: 0.2708, M: 14.9441, S: 0.09027 } },
  2: { height: { L: 1, M: 58.4249, S: 0.03424 }, weight: { L: 0.197, M: 5.5675, S: 0.12385 }, head: { L: 1, M: 39.1285, S: 0.02997 }, bmi: { L: 0.1118, M: 16.3195, S: 0.08677 } },
  3: { height: { L: 1, M: 61.4292, S: 0.03328 }, weight: { L: 0.1738, M: 6.3762, S: 0.11727 }, head: { L: 1, M: 40.5135, S: 0.02918 }, bmi: { L: 0.0068, M: 16.8987, S: 0.08495 } },
  4: { height: { L: 1, M: 63.886, S: 0.03257 }, weight: { L: 0.1553, M: 7.0023, S: 0.11316 }, head: { L: 1, M: 41.6317, S: 0.02868 }, bmi: { L: -0.0727, M: 17.1579, S: 0.08378 } },
  5: { height: { L: 1, M: 65.9026, S: 0.03204 }, weight: { L: 0.1395, M: 7.5105, S: 0.1108 }, head: { L: 1, M: 42.5576, S: 0.02837 }, bmi: { L: -0.137, M: 17.2919, S: 0.08296 } },
  6: { height: { L: 1, M: 67.6236, S: 0.03165 }, weight: { L: 0.1257, M: 7.934, S: 0.10958 }, head: { L: 1, M: 43.3306, S: 0.02817 }, bmi: { L: -0.1913, M: 17.3422, S: 0.08234 } },
  7: { height: { L: 1, M: 69.1645, S: 0.03139 }, weight: { L: 0.1134, M: 8.297, S: 0.10902 }, head: { L: 1, M: 43.9803, S: 0.02804 }, bmi: { L: -0.2385, M: 17.3288, S: 0.08183 } },
  8: { height: { L: 1, M: 70.5994, S: 0.03124 }, weight: { L: 0.1021, M: 8.6151, S: 0.10882 }, head: { L: 1, M: 44.53, S: 0.02796 }, bmi: { L: -0.2802, M: 17.2647, S: 0.0814 } },
  9: { height: { L: 1, M: 71.9687, S: 0.03117 }, weight: { L: 0.0917, M: 8.9014, S: 0.10881 }, head: { L: 1, M: 44.9998, S: 0.02792 }, bmi: { L: -0.3176, M: 17.1662, S: 0.08102 } },
  10: { height: { L: 1, M: 73.2812, S: 0.03118 }, weight: { L: 0.082, M: 9.1649, S: 0.10891 }, head: { L: 1, M: 45.4051, S: 0.0279 }, bmi: { L: -0.3516, M: 17.0488, S: 0.08068 } },
  11: { height: { L: 1, M: 74.5388, S: 0.03125 }, weight: { L: 0.073, M: 9.4122, S: 0.10906 }, head: { L: 1, M: 45.7573, S: 0.02789 }, bmi: { L: -0.3828, M: 16.9239, S: 0.08037 } },
  12: { height: { L: 1, M: 75.7488, S: 0.03137 }, weight: { L: 0.0644, M: 9.6479, S: 0.10925 }, head: { L: 1, M: 46.0661, S: 0.02789 }, bmi: { L: -0.4115, M: 16.7981, S: 0.08009 } },
  13: { height: { L: 1, M: 76.9186, S: 0.03154 }, weight: { L: 0.0563, M: 9.8749, S: 0.10949 }, head: { L: 1, M: 46.3395, S: 0.02789 }, bmi: { L: -0.4382, M: 16.6743, S: 0.07982 } },
  14: { height: { L: 1, M: 78.0497, S: 0.03174 }, weight: { L: 0.0487, M: 10.0953, S: 0.10976 }, head: { L: 1, M: 46.5844, S: 0.02791 }, bmi: { L: -0.463, M: 16.5548, S: 0.07958 } },
  15: { height: { L: 1, M: 79.1458, S: 0.03197 }, weight: { L: 0.0413, M: 10.3108, S: 0.11007 }, head: { L: 1, M: 46.806, S: 0.02792 }, bmi: { L: -0.4863, M: 16.4409, S: 0.07935 } },
  16: { height: { L: 1, M: 80.2113, S: 0.03222 }, weight: { L: 0.0343, M: 10.5228, S: 0.11041 }, head: { L: 1, M: 47.0088, S: 0.02795 }, bmi: { L: -0.5082, M: 16.3335, S: 0.07913 } },
  17: { height: { L: 1, M: 81.2487, S: 0.0325 }, weight: { L: 0.0275, M: 10.7319, S: 0.11079 }, head: { L: 1, M: 47.1962, S: 0.02797 }, bmi: { L: -0.5289, M: 16.2329, S: 0.07892 } },
  18: { height: { L: 1, M: 82.2587, S: 0.03279 }, weight: { L: 0.0211, M: 10.9385, S: 0.11119 }, head: { L: 1, M: 47.3711, S: 0.028 }, bmi: { L: -0.5484, M: 16.1392, S: 0.07873 } },
  19: { height: { L: 1, M: 83.2418, S: 0.0331 }, weight: { L: 0.0148, M: 11.143, S: 0.11164 }, head: { L: 1, M: 47.5357, S: 0.02803 }, bmi: { L: -0.5669, M: 16.0528, S: 0.07854 } },
  20: { height: { L: 1, M: 84.1996, S: 0.03342 }, weight: { L: 0.0087, M: 11.3462, S: 0.11211 }, head: { L: 1, M: 47.6919, S: 0.02806 }, bmi: { L: -0.5846, M: 15.9743, S: 0.07836 } },
  21: { height: { L: 1, M: 85.1348, S: 0.03376 }, weight: { L: 0.0029, M: 11.5486, S: 0.11261 }, head: { L: 1, M: 47.8408, S: 0.0281 }, bmi: { L: -0.6014, M: 15.9039, S: 0.07818 } },
  22: { height: { L: 1, M: 86.0477, S: 0.0341 }, weight: { L: -0.0028, M: 11.7504, S: 0.11314 }, head: { L: 1, M: 47.9833, S: 0.02813 }, bmi: { L: -0.6174, M: 15.8412, S: 0.07802 } },
  23: { height: { L: 1, M: 86.941, S: 0.03445 }, weight: { L: -0.0083, M: 11.9514, S: 0.11369 }, head: { L: 1, M: 48.1201, S: 0.02817 }, bmi: { L: -0.6328, M: 15.7852, S: 0.07786 } },
  24: { height: { L: 1, M: 87.8161, S: 0.03479 }, weight: { L: -0.0137, M: 12.1515, S: 0.11426 }, head: { L: 1, M: 48.2515, S: 0.02821 }, bmi: { L: -0.6473, M: 15.7356, S: 0.07771 } },
};

/* ── VERIFIED WHO LMS Parameters — Girls 0-24 months ── */
export const WHO_GIRL_LMS: Record<number, { height: LMSParams; weight: LMSParams; head: LMSParams; bmi: LMSParams }> = {
  0: { height: { L: 1, M: 49.1477, S: 0.0379 }, weight: { L: 0.3809, M: 3.2322, S: 0.14171 }, head: { L: 1, M: 33.8787, S: 0.03496 }, bmi: { L: -0.0631, M: 13.3363, S: 0.09272 } },
  1: { height: { L: 1, M: 53.6872, S: 0.0364 }, weight: { L: 0.1714, M: 4.1873, S: 0.13724 }, head: { L: 1, M: 36.5463, S: 0.0321 }, bmi: { L: 0.3448, M: 14.5679, S: 0.09556 } },
  2: { height: { L: 1, M: 57.0673, S: 0.03568 }, weight: { L: 0.0962, M: 5.1282, S: 0.13 }, head: { L: 1, M: 38.2521, S: 0.03168 }, bmi: { L: 0.1749, M: 15.7679, S: 0.09371 } },
  3: { height: { L: 1, M: 59.8029, S: 0.0352 }, weight: { L: 0.0402, M: 5.8458, S: 0.12619 }, head: { L: 1, M: 39.5328, S: 0.0314 }, bmi: { L: 0.0643, M: 16.3574, S: 0.09254 } },
  4: { height: { L: 1, M: 62.0899, S: 0.03486 }, weight: { L: -0.005, M: 6.4237, S: 0.12402 }, head: { L: 1, M: 40.5817, S: 0.03119 }, bmi: { L: -0.0191, M: 16.6703, S: 0.09166 } },
  5: { height: { L: 1, M: 64.0301, S: 0.03463 }, weight: { L: -0.043, M: 6.8985, S: 0.12274 }, head: { L: 1, M: 41.459, S: 0.03102 }, bmi: { L: -0.0864, M: 16.8386, S: 0.09096 } },
  6: { height: { L: 1, M: 65.7311, S: 0.03448 }, weight: { L: -0.0756, M: 7.297, S: 0.12204 }, head: { L: 1, M: 42.1995, S: 0.03087 }, bmi: { L: -0.1429, M: 16.9083, S: 0.09036 } },
  7: { height: { L: 1, M: 67.2873, S: 0.03441 }, weight: { L: -0.1039, M: 7.6422, S: 0.12178 }, head: { L: 1, M: 42.829, S: 0.03075 }, bmi: { L: -0.1916, M: 16.902, S: 0.08984 } },
  8: { height: { L: 1, M: 68.7498, S: 0.0344 }, weight: { L: -0.1288, M: 7.9487, S: 0.12181 }, head: { L: 1, M: 43.3671, S: 0.03063 }, bmi: { L: -0.2344, M: 16.8404, S: 0.08939 } },
  9: { height: { L: 1, M: 70.1435, S: 0.03444 }, weight: { L: -0.1507, M: 8.2254, S: 0.12199 }, head: { L: 1, M: 43.83, S: 0.03053 }, bmi: { L: -0.2725, M: 16.7406, S: 0.08898 } },
  10: { height: { L: 1, M: 71.4818, S: 0.03452 }, weight: { L: -0.17, M: 8.48, S: 0.12223 }, head: { L: 1, M: 44.2319, S: 0.03044 }, bmi: { L: -0.3068, M: 16.6184, S: 0.08861 } },
  11: { height: { L: 1, M: 72.771, S: 0.03464 }, weight: { L: -0.1872, M: 8.7192, S: 0.12247 }, head: { L: 1, M: 44.5844, S: 0.03035 }, bmi: { L: -0.3381, M: 16.4875, S: 0.08828 } },
  12: { height: { L: 1, M: 74.015, S: 0.03479 }, weight: { L: -0.2024, M: 8.9481, S: 0.12268 }, head: { L: 1, M: 44.8965, S: 0.03027 }, bmi: { L: -0.3667, M: 16.3568, S: 0.08797 } },
  13: { height: { L: 1, M: 75.2176, S: 0.03496 }, weight: { L: -0.2158, M: 9.1699, S: 0.12283 }, head: { L: 1, M: 45.1752, S: 0.03019 }, bmi: { L: -0.3932, M: 16.2311, S: 0.08768 } },
  14: { height: { L: 1, M: 76.3817, S: 0.03514 }, weight: { L: -0.2278, M: 9.387, S: 0.12294 }, head: { L: 1, M: 45.4265, S: 0.03012 }, bmi: { L: -0.4177, M: 16.1128, S: 0.08741 } },
  15: { height: { L: 1, M: 77.5099, S: 0.03534 }, weight: { L: -0.2384, M: 9.6008, S: 0.12299 }, head: { L: 1, M: 45.6551, S: 0.03006 }, bmi: { L: -0.4407, M: 16.0028, S: 0.08716 } },
  16: { height: { L: 1, M: 78.6055, S: 0.03555 }, weight: { L: -0.2478, M: 9.8124, S: 0.12303 }, head: { L: 1, M: 45.865, S: 0.02999 }, bmi: { L: -0.4623, M: 15.9017, S: 0.08693 } },
  17: { height: { L: 1, M: 79.671, S: 0.03576 }, weight: { L: -0.2562, M: 10.0226, S: 0.12306 }, head: { L: 1, M: 46.0598, S: 0.02993 }, bmi: { L: -0.4825, M: 15.8096, S: 0.08671 } },
  18: { height: { L: 1, M: 80.7079, S: 0.03598 }, weight: { L: -0.2637, M: 10.2315, S: 0.12309 }, head: { L: 1, M: 46.2424, S: 0.02987 }, bmi: { L: -0.5017, M: 15.7263, S: 0.0865 } },
  19: { height: { L: 1, M: 81.7182, S: 0.0362 }, weight: { L: -0.2703, M: 10.4393, S: 0.12315 }, head: { L: 1, M: 46.4152, S: 0.02982 }, bmi: { L: -0.5199, M: 15.6517, S: 0.0863 } },
  20: { height: { L: 1, M: 82.7036, S: 0.03643 }, weight: { L: -0.2762, M: 10.6464, S: 0.12323 }, head: { L: 1, M: 46.5801, S: 0.02977 }, bmi: { L: -0.5372, M: 15.5855, S: 0.08612 } },
  21: { height: { L: 1, M: 83.6654, S: 0.03666 }, weight: { L: -0.2815, M: 10.8534, S: 0.12335 }, head: { L: 1, M: 46.7384, S: 0.02972 }, bmi: { L: -0.5537, M: 15.5278, S: 0.08594 } },
  22: { height: { L: 1, M: 84.604, S: 0.03688 }, weight: { L: -0.2862, M: 11.0608, S: 0.1235 }, head: { L: 1, M: 46.8913, S: 0.02967 }, bmi: { L: -0.5695, M: 15.4787, S: 0.08577 } },
  23: { height: { L: 1, M: 85.5202, S: 0.03711 }, weight: { L: -0.2903, M: 11.2688, S: 0.12369 }, head: { L: 1, M: 47.0391, S: 0.02962 }, bmi: { L: -0.5846, M: 15.438, S: 0.0856 } },
  24: { height: { L: 1, M: 86.4153, S: 0.03734 }, weight: { L: -0.2941, M: 11.4775, S: 0.1239 }, head: { L: 1, M: 47.1822, S: 0.02957 }, bmi: { L: -0.5989, M: 15.4052, S: 0.08545 } },
};

/* ── Dev-time integrity guard — warns if any LMS row is non-monotonic or missing ── */
if ((globalThis as any).__DEV__) {
  (['WHO_BOY_LMS', 'WHO_GIRL_LMS'] as const).forEach((tableName) => {
    const table = tableName === 'WHO_BOY_LMS' ? WHO_BOY_LMS : WHO_GIRL_LMS;
    (['height', 'weight', 'head'] as const).forEach((metric) => {
      let prev = -Infinity;
      for (let m = 0; m <= 24; m++) {
        const row = table[m];
        if (!row) { console.warn(`[WHO LMS] ${tableName} missing month ${m}`); break; }
        const M = row[metric].M;
        if (!Number.isFinite(M) || M < prev) {
          console.warn(`[WHO LMS] ${tableName}.${metric} month ${m}: M=${M} not monotonic (prev ${prev})`);
        }
        prev = M;
      }
    });
  });
}

/* ── Z-Score Calculation (Standard LMS) ── */
export function calculateZScore(value: number, lms: LMSParams): number {
  const { L, M, S } = lms;
  
  if (Math.abs(L) < 0.01) {
    return Math.log(value / M) / S;
  }
  
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/* ── RESTRICTED Z-Score (WHO recommendation for weight-based indicators) ──
   When z > ±3, use fixed SD distances to avoid extreme values.
   Reference: WHO guidelines for z-score calculation in children */
export function calculateZScoreRestricted(
  value: number,
  lms: LMSParams,
  metric: 'height' | 'weight' | 'head' | 'bmi'
): number {
  const { L, M, S } = lms;
  
  let z: number;
  if (Math.abs(L) < 0.01) {
    z = Math.log(value / M) / S;
  } else {
    z = (Math.pow(value / M, L) - 1) / (L * S);
  }
  
  if ((metric === 'weight' || metric === 'bmi') && Math.abs(z) > 3) {
    const sd3pos = M * Math.pow(1 + L * S * 3, 1 / L);
    const sd2pos = M * Math.pow(1 + L * S * 2, 1 / L);
    const sd3neg = M * Math.pow(1 + L * S * (-3), 1 / L);
    const sd2neg = M * Math.pow(1 + L * S * (-2), 1 / L);
    
    if (z > 3) {
      z = 3 + (value - sd3pos) / (sd3pos - sd2pos);
    } else {
      z = -3 + (value - sd3neg) / (sd2neg - sd3neg);
    }
  }
  
  return z;
}

/* ── Percentile from Z-Score (Abramowitz & Stegun approximation) ── */
export function zScoreToPercentile(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return Math.round(50 * (1 + sign * y));
}

/* ── Value from Z-Score (inverse) ── */
export function zScoreToValue(z: number, lms: LMSParams): number {
  const { L, M, S } = lms;
  
  if (Math.abs(L) < 0.01) {
    return M * Math.exp(z * S);
  }
  
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/* ── Get LMS with linear interpolation between months ── */
function getInterpolatedLMS(
  ageMonths: number,
  metric: 'height' | 'weight' | 'head' | 'bmi',
  gender: 'boy' | 'girl'
): LMSParams | null {
  const lmsTable = gender === 'boy' ? WHO_BOY_LMS : WHO_GIRL_LMS;
  const floorAge = Math.floor(ageMonths);
  const ceilAge = Math.ceil(ageMonths);
  
  if (floorAge === ceilAge) {
    return lmsTable[floorAge]?.[metric] || null;
  }
  
  const floorLMS = lmsTable[floorAge]?.[metric];
  const ceilLMS = lmsTable[ceilAge]?.[metric];
  
  if (!floorLMS || !ceilLMS) return floorLMS || ceilLMS || null;
  
  const fraction = ageMonths - floorAge;
  
  return {
    L: floorLMS.L + (ceilLMS.L - floorLMS.L) * fraction,
    M: floorLMS.M + (ceilLMS.M - floorLMS.M) * fraction,
    S: floorLMS.S + (ceilLMS.S - floorLMS.S) * fraction,
  };
}

/* ── Precise Percentile with Interpolation ── */
export function calculatePercentilePrecise(
  value: number,
  ageMonths: number,
  metric: 'height' | 'weight' | 'head' | 'bmi',
  gender: 'boy' | 'girl'
): number {
  const lms = getInterpolatedLMS(ageMonths, metric, gender);
  if (!lms) return 50;
  
  const z = calculateZScoreRestricted(value, lms, metric);
  return zScoreToPercentile(z);
}

/* ── Simple Percentile (nearest month, no interpolation) ── */
export function calculatePercentile(
  value: number,
  ageMonths: number,
  metric: 'height' | 'weight' | 'head' | 'bmi',
  gender: 'boy' | 'girl'
): number {
  const lmsTable = gender === 'boy' ? WHO_BOY_LMS : WHO_GIRL_LMS;
  const clampedAge = Math.max(0, Math.min(24, Math.round(ageMonths)));
  const lms = lmsTable[clampedAge]?.[metric];
  
  if (!lms) return 50;
  
  const z = calculateZScoreRestricted(value, lms, metric);
  return zScoreToPercentile(z);
}

/* ── Growth Status Classification ── */
export function getGrowthStatus(percentile: number): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  if (percentile < 3)  return { label: 'Severely Low',  color: '#dc2626', icon: '⚠️', description: 'Below 3rd percentile — consult pediatrician' };
  if (percentile < 10) return { label: 'Low',           color: '#ea580c', icon: '↓',  description: 'Below 10th percentile — monitor closely' };
  if (percentile < 25) return { label: 'Below Average', color: '#ca8a04', icon: '↓',  description: '25th-10th percentile — trending low' };
  if (percentile < 75) return { label: 'Normal',        color: '#16a34a', icon: '✓',  description: '25th-75th percentile — healthy range' };
  if (percentile < 90) return { label: 'Above Average', color: '#2563eb', icon: '↑',  description: '75th-90th percentile — thriving' };
  if (percentile < 97) return { label: 'High',          color: '#7c3aed', icon: '↑',  description: '90th-97th percentile — excellent growth' };
  return { label: 'Severely High', color: '#dc2626', icon: '⚠️', description: 'Above 97th percentile — monitor for obesity' };
}

/* ── Growth Velocity Calculator ── */
export interface GrowthVelocity {
  metric: 'height' | 'weight' | 'head';
  velocity: number;
  percentile: number;
  status: 'accelerating' | 'normal' | 'decelerating' | 'concerning';
}

export function calculateGrowthVelocity(
  measurements: { value: number; date: string }[],
  metric: 'height' | 'weight' | 'head',
  gender: 'boy' | 'girl'
): GrowthVelocity | null {
  if (measurements.length < 2) return null;
  
  const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const monthsDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsDiff < 0.5) return null;
  
  const velocity = (last.value - first.value) / monthsDiff;
  
  const expectedVelocities: Record<string, { min: number; max: number }> = {
    height: { min: 1.0, max: 2.5 },
    weight: { min: 0.15, max: 0.5 },
    head:   { min: 0.3,  max: 0.8 },
  };
  
  const expected = expectedVelocities[metric];
  let status: GrowthVelocity['status'] = 'normal';
  
  if (velocity < expected.min * 0.7) status = 'concerning';
  else if (velocity < expected.min) status = 'decelerating';
  else if (velocity > expected.max * 1.3) status = 'accelerating';
  
  const ageMonths = (new Date().getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const percentile = calculatePercentilePrecise(last.value, ageMonths, metric, gender);
  
  return { metric, velocity, percentile, status };
}

/* ── BMI Calculator for Children (WHO BMI-for-Age) ── */
export function calculateChildBMI(
  weightKg: number,
  heightCm: number,
  ageMonths: number,
  gender: 'boy' | 'girl'
): { bmi: number; percentile: number; status: string } {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const percentile = calculatePercentilePrecise(bmi, ageMonths, 'bmi', gender);
  
  let status = 'Normal';
  if (percentile < 5) status = 'Underweight';
  else if (percentile > 95) status = 'Obese';
  else if (percentile > 85) status = 'Overweight';
  
  return { bmi: Math.round(bmi * 10) / 10, percentile, status };
}

/* ── Growth Prediction ── */
export function predictGrowth(
  currentValue: number,
  ageMonths: number,
  metric: 'height' | 'weight' | 'head',
  gender: 'boy' | 'girl',
  monthsAhead: number = 3
): { predicted: number; percentile: number; confidence: number } {
  const lms = getInterpolatedLMS(ageMonths, metric, gender);
  if (!lms) return { predicted: currentValue, percentile: 50, confidence: 0 };
  
  const currentZ = calculateZScore(currentValue, lms);
  
  const regressionFactor = 0.3;
  const adjustedZ = currentZ * (1 - regressionFactor);
  
  const futureAge = ageMonths + monthsAhead;
  const futureLMS = getInterpolatedLMS(futureAge, metric, gender);
  if (!futureLMS) return { predicted: currentValue, percentile: 50, confidence: 0 };
  
  const predicted = zScoreToValue(adjustedZ, futureLMS);
  const percentile = zScoreToPercentile(adjustedZ);
  
  const confidence = Math.max(30, 95 - monthsAhead * 15);
  
  return { predicted: Math.round(predicted * 10) / 10, percentile, confidence };
}

/* ── Hook ── */
export function useWHOGrowthCalculator() {
  const getPercentile = useCallback((
    value: number, ageMonths: number, metric: 'height' | 'weight' | 'head' | 'bmi', gender: 'boy' | 'girl'
  ) => calculatePercentilePrecise(value, ageMonths, metric, gender), []);
  
  const getStatus = useCallback((percentile: number) => getGrowthStatus(percentile), []);
  
  const getVelocity = useCallback((
    measurements: { value: number; date: string }[],
    metric: 'height' | 'weight' | 'head',
    gender: 'boy' | 'girl'
  ) => calculateGrowthVelocity(measurements, metric, gender), []);
  
  const getBMI = useCallback((
    weightKg: number, heightCm: number, ageMonths: number, gender: 'boy' | 'girl'
  ) => calculateChildBMI(weightKg, heightCm, ageMonths, gender), []);
  
  const getPrediction = useCallback((
    currentValue: number, ageMonths: number, metric: 'height' | 'weight' | 'head',
    gender: 'boy' | 'girl', monthsAhead?: number
  ) => predictGrowth(currentValue, ageMonths, metric, gender, monthsAhead), []);
  
  return { getPercentile, getStatus, getVelocity, getBMI, getPrediction };
}

export default useWHOGrowthCalculator;
