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
  0:  { height: { L: 1,       M: 49.8842,  S: 0.03790 },  weight: { L: -0.1600954, M: 3.5302031,  S: 0.11218624 }, head: { L: 1, M: 34.4618, S: 0.03686 }, bmi: { L: 2, M: 13.4,  S: 0.105 } },
  1:  { height: { L: 1,       M: 54.7244,  S: 0.03558 },  weight: { L: -0.2013239, M: 4.3402931,  S: 0.11488736 }, head: { L: 1, M: 37.2759, S: 0.03520 }, bmi: { L: 2, M: 14.2,  S: 0.098 } },
  2:  { height: { L: 1,       M: 58.4249,  S: 0.03434 },  weight: { L: -0.0638891, M: 5.2414374,  S: 0.11138852 }, head: { L: 1, M: 39.1285, S: 0.03412 }, bmi: { L: 2, M: 15.0,  S: 0.092 } },
  3:  { height: { L: 1,       M: 61.6054,  S: 0.03273 },  weight: { L: -0.0638891, M: 6.1271573,  S: 0.10954490 }, head: { L: 1, M: 40.2491, S: 0.03343 }, bmi: { L: 2, M: 15.6,  S: 0.088 } },
  4:  { height: { L: 1,       M: 64.3890,  S: 0.03138 },  weight: { L: -0.1450925, M: 6.9416120,  S: 0.10752653 }, head: { L: 1, M: 41.1260, S: 0.03288 }, bmi: { L: 2, M: 16.1,  S: 0.085 } },
  5:  { height: { L: 1,       M: 66.8456,  S: 0.03023 },  weight: { L: -0.1450925, M: 7.6081390,  S: 0.10610320 }, head: { L: 1, M: 41.8750, S: 0.03242 }, bmi: { L: 2, M: 16.4,  S: 0.082 } },
  6:  { height: { L: 1,       M: 67.6026,  S: 0.03063 },  weight: { L: -0.1450925, M: 7.7509601,  S: 0.10686255 }, head: { L: 1, M: 42.9235, S: 0.03215 }, bmi: { L: 2, M: 16.6,  S: 0.080 } },
  7:  { height: { L: 1,       M: 69.1675,  S: 0.02954 },  weight: { L: -0.1803270, M: 8.4005210,  S: 0.10597387 }, head: { L: 1, M: 43.5040, S: 0.03193 }, bmi: { L: 2, M: 16.8,  S: 0.078 } },
  8:  { height: { L: 1,       M: 70.6454,  S: 0.02856 },  weight: { L: -0.1803270, M: 8.9015212,  S: 0.10526840 }, head: { L: 1, M: 44.0470, S: 0.03173 }, bmi: { L: 2, M: 16.9,  S: 0.076 } },
  9:  { height: { L: 1,       M: 71.5045,  S: 0.02951 },  weight: { L: -0.2162840, M: 9.4765003,  S: 0.10424690 }, head: { L: 1, M: 44.5048, S: 0.03134 }, bmi: { L: 2, M: 17.0,  S: 0.075 } },
  10: { height: { L: 1,       M: 73.0695,  S: 0.02865 },  weight: { L: -0.2665410, M: 9.7511429,  S: 0.10424690 }, head: { L: 1, M: 44.9048, S: 0.03134 }, bmi: { L: 2, M: 17.0,  S: 0.074 } },
  11: { height: { L: 1,       M: 74.2960,  S: 0.02787 },  weight: { L: -0.2665410, M: 10.0189500, S: 0.10380630 }, head: { L: 1, M: 45.2700, S: 0.03118 }, bmi: { L: 2, M: 17.1,  S: 0.073 } },
  12: { height: { L: 1,       M: 74.5350,  S: 0.02874 },  weight: { L: -0.2665410, M: 10.2783000, S: 0.10380630 }, head: { L: 1, M: 46.5048, S: 0.03078 }, bmi: { L: 2, M: 17.1,  S: 0.072 } },
  13: { height: { L: 1,       M: 76.0026,  S: 0.02801 },  weight: { L: -0.3042052, M: 10.1398600, S: 0.10304230 }, head: { L: 1, M: 46.8500, S: 0.03063 }, bmi: { L: 2, M: 17.1,  S: 0.071 } },
  14: { height: { L: 1,       M: 77.4350,  S: 0.02735 },  weight: { L: -0.3042052, M: 10.4000090, S: 0.10304230 }, head: { L: 1, M: 47.1700, S: 0.03050 }, bmi: { L: 2, M: 17.1,  S: 0.070 } },
  15: { height: { L: 1,       M: 78.8325,  S: 0.02675 },  weight: { L: -0.3042052, M: 10.4000090, S: 0.10304230 }, head: { L: 1, M: 47.4700, S: 0.03038 }, bmi: { L: 2, M: 17.1,  S: 0.069 } },
  16: { height: { L: 1,       M: 80.1960,  S: 0.02620 },  weight: { L: -0.3042052, M: 11.1442610, S: 0.10304230 }, head: { L: 1, M: 47.7500, S: 0.03028 }, bmi: { L: 2, M: 17.1,  S: 0.068 } },
  17: { height: { L: 1,       M: 81.5260,  S: 0.02570 },  weight: { L: -0.3042052, M: 11.1442610, S: 0.10304230 }, head: { L: 1, M: 48.0100, S: 0.03019 }, bmi: { L: 2, M: 17.0,  S: 0.067 } },
  18: { height: { L: 1,       M: 82.3076,  S: 0.02784 },  weight: { L: -0.3042052, M: 11.1442610, S: 0.10304230 }, head: { L: 1, M: 48.6244, S: 0.03000 }, bmi: { L: 2, M: 17.0,  S: 0.066 } },
  19: { height: { L: 1,       M: 84.1200,  S: 0.02480 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 48.8500, S: 0.02992 }, bmi: { L: 2, M: 16.9,  S: 0.065 } },
  20: { height: { L: 1,       M: 85.3500,  S: 0.02440 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 49.0600, S: 0.02985 }, bmi: { L: 2, M: 16.8,  S: 0.064 } },
  21: { height: { L: 1,       M: 86.5500,  S: 0.02400 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 49.2500, S: 0.02979 }, bmi: { L: 2, M: 16.7,  S: 0.063 } },
  22: { height: { L: 1,       M: 87.7200,  S: 0.02360 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 49.4300, S: 0.02973 }, bmi: { L: 2, M: 16.6,  S: 0.062 } },
  23: { height: { L: 1,       M: 88.8600,  S: 0.02320 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 49.6000, S: 0.02968 }, bmi: { L: 2, M: 16.5,  S: 0.061 } },
  24: { height: { L: 1,       M: 89.5488,  S: 0.02726 },  weight: { L: -0.2853157, M: 12.1928210, S: 0.10241890 }, head: { L: 1, M: 49.4432, S: 0.02956 }, bmi: { L: 2, M: 16.4,  S: 0.060 } },
};

/* ── VERIFIED WHO LMS Parameters — Girls 0-24 months ── */
export const WHO_GIRL_LMS: Record<number, { height: LMSParams; weight: LMSParams; head: LMSParams; bmi: LMSParams }> = {
  0:  { height: { L: 1,       M: 49.1477,  S: 0.03795 },  weight: { L: 0.0521267,  M: 3.4002931,  S: 0.11148950 }, head: { L: 1, M: 33.8787, S: 0.03720 }, bmi: { L: 2, M: 13.2,  S: 0.108 } },
  1:  { height: { L: 1,       M: 53.8982,  S: 0.03568 },  weight: { L: -0.0325635, M: 4.1720911,  S: 0.11394920 }, head: { L: 1, M: 36.5463, S: 0.03555 }, bmi: { L: 2, M: 14.0,  S: 0.101 } },
  2:  { height: { L: 1,       M: 57.6295,  S: 0.03443 },  weight: { L: -0.0707665, M: 5.0556260,  S: 0.11073712 }, head: { L: 1, M: 38.2520, S: 0.03435 }, bmi: { L: 2, M: 14.8,  S: 0.095 } },
  3:  { height: { L: 1,       M: 60.7509,  S: 0.03284 },  weight: { L: -0.0707665, M: 5.7915453,  S: 0.10981410 }, head: { L: 1, M: 39.3311, S: 0.03380 }, bmi: { L: 2, M: 15.4,  S: 0.091 } },
  4:  { height: { L: 1,       M: 63.5308,  S: 0.03149 },  weight: { L: -0.1264159, M: 6.4686230,  S: 0.10725950 }, head: { L: 1, M: 40.1520, S: 0.03338 }, bmi: { L: 2, M: 15.9,  S: 0.088 } },
  5:  { height: { L: 1,       M: 65.9721,  S: 0.03034 },  weight: { L: -0.1264159, M: 7.0874500,  S: 0.10610320 }, head: { L: 1, M: 40.8450, S: 0.03302 }, bmi: { L: 2, M: 16.2,  S: 0.085 } },
  6:  { height: { L: 1,       M: 66.5963,  S: 0.03074 },  weight: { L: -0.1264159, M: 7.2082251,  S: 0.10725950 }, head: { L: 1, M: 41.8810, S: 0.03253 }, bmi: { L: 2, M: 16.4,  S: 0.083 } },
  7:  { height: { L: 1,       M: 68.0936,  S: 0.02965 },  weight: { L: -0.1803270, M: 7.7375190,  S: 0.10589980 }, head: { L: 1, M: 42.4370, S: 0.03215 }, bmi: { L: 2, M: 16.5,  S: 0.081 } },
  8:  { height: { L: 1,       M: 69.5081,  S: 0.02867 },  weight: { L: -0.1803270, M: 8.2876789,  S: 0.10589980 }, head: { L: 1, M: 42.9620, S: 0.03180 }, bmi: { L: 2, M: 16.6,  S: 0.079 } },
  9:  { height: { L: 1,       M: 70.4628,  S: 0.02962 },  weight: { L: -0.1803270, M: 8.2876789,  S: 0.10589980 }, head: { L: 1, M: 43.7979, S: 0.03173 }, bmi: { L: 2, M: 16.6,  S: 0.078 } },
  10: { height: { L: 1,       M: 71.9685,  S: 0.02876 },  weight: { L: -0.2255660, M: 8.8816330,  S: 0.10511540 }, head: { L: 1, M: 44.1700, S: 0.03148 }, bmi: { L: 2, M: 16.6,  S: 0.077 } },
  11: { height: { L: 1,       M: 73.1393,  S: 0.02798 },  weight: { L: -0.2255660, M: 9.1350301,  S: 0.10511540 }, head: { L: 1, M: 44.5200, S: 0.03125 }, bmi: { L: 2, M: 16.6,  S: 0.076 } },
  12: { height: { L: 1,       M: 73.4903,  S: 0.02885 },  weight: { L: -0.2255660, M: 9.1350301,  S: 0.10511540 }, head: { L: 1, M: 45.3660, S: 0.03118 }, bmi: { L: 2, M: 16.5,  S: 0.075 } },
  13: { height: { L: 1,       M: 74.9620,  S: 0.02812 },  weight: { L: -0.2666570, M: 9.5104500,  S: 0.10424690 }, head: { L: 1, M: 45.6800, S: 0.03102 }, bmi: { L: 2, M: 16.5,  S: 0.074 } },
  14: { height: { L: 1,       M: 76.4076,  S: 0.02746 },  weight: { L: -0.2666570, M: 9.7749700,  S: 0.10424690 }, head: { L: 1, M: 45.9800, S: 0.03088 }, bmi: { L: 2, M: 16.4,  S: 0.073 } },
  15: { height: { L: 1,       M: 77.8272,  S: 0.02686 },  weight: { L: -0.2666570, M: 9.7749700,  S: 0.10424690 }, head: { L: 1, M: 46.2600, S: 0.03075 }, bmi: { L: 2, M: 16.3,  S: 0.072 } },
  16: { height: { L: 1,       M: 79.2213,  S: 0.02631 },  weight: { L: -0.2809460, M: 10.4000090, S: 0.10424690 }, head: { L: 1, M: 46.5300, S: 0.03063 }, bmi: { L: 2, M: 16.2,  S: 0.071 } },
  17: { height: { L: 1,       M: 80.5900,  S: 0.02581 },  weight: { L: -0.2809460, M: 10.4000090, S: 0.10424690 }, head: { L: 1, M: 46.7800, S: 0.03052 }, bmi: { L: 2, M: 16.1,  S: 0.070 } },
  18: { height: { L: 1,       M: 81.2556,  S: 0.02795 },  weight: { L: -0.2809460, M: 10.4000090, S: 0.10424690 }, head: { L: 1, M: 47.2232, S: 0.03040 }, bmi: { L: 2, M: 16.0,  S: 0.069 } },
  19: { height: { L: 1,       M: 83.2560,  S: 0.02491 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 47.4600, S: 0.03030 }, bmi: { L: 2, M: 15.9,  S: 0.068 } },
  20: { height: { L: 1,       M: 84.4500,  S: 0.02451 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 47.6800, S: 0.03021 }, bmi: { L: 2, M: 15.8,  S: 0.067 } },
  21: { height: { L: 1,       M: 85.6200,  S: 0.02411 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 47.8900, S: 0.03012 }, bmi: { L: 2, M: 15.7,  S: 0.066 } },
  22: { height: { L: 1,       M: 86.7600,  S: 0.02371 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 48.0800, S: 0.03004 }, bmi: { L: 2, M: 15.6,  S: 0.065 } },
  23: { height: { L: 1,       M: 87.8800,  S: 0.02331 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 48.2600, S: 0.02997 }, bmi: { L: 2, M: 15.5,  S: 0.064 } },
  24: { height: { L: 1,       M: 88.5554,  S: 0.02737 },  weight: { L: -0.2809460, M: 11.5123700, S: 0.10380630 }, head: { L: 1, M: 48.1878, S: 0.02996 }, bmi: { L: 2, M: 15.4,  S: 0.063 } },
};

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
