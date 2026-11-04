/**
 * useUnits — thin, ergonomic wrapper around the `units` field that
 * already lives in `useCustomization`'s `CustomizationSettings`.
 * Same rationale as `useLanguage`: single storage key, single
 * subscriber list, single setter, narrow re-render surface.
 *
 * The hook also exposes the CONVERSION helpers so any screen can go
 * from raw-canonical values to display strings without re-deriving
 * the math. Canonical storage in the DB is ALWAYS metric:
 *   • weight  → kg
 *   • height  → cm
 *   • temp    → °C
 *   • volume  → ml
 * The hook converts on read.
 */
import { useCallback, useMemo } from 'react';
import { useCustomization } from './useCustomization';

export type UnitSystem = 'metric' | 'imperial';

export const KG_TO_LB = 2.2046226218;
export const CM_TO_IN = 0.3937007874;
export const ML_TO_OZ = 0.0338140227;

export interface UnitDisplay {
  weight: string;       // 'kg' | 'lb'
  height: string;       // 'cm' | 'in'
  temperature: string;  // '°C' | '°F'
  volume: string;       // 'ml' | 'oz'
}

export const METRIC_DISPLAY: UnitDisplay = {
  weight: 'kg',
  height: 'cm',
  temperature: '°C',
  volume: 'ml',
};

export const IMPERIAL_DISPLAY: UnitDisplay = {
  weight: 'lb',
  height: 'in',
  temperature: '°F',
  volume: 'oz',
};

export interface UseUnitsReturn {
  /** 'metric' | 'imperial' */
  units: UnitSystem;
  /** Short labels the UI can drop directly into a row. */
  display: UnitDisplay;
  /** Convenience label like "Metric (kg, cm, °C, ml)". */
  unitsLabel: string;
  /** Persist a new system. */
  setUnits: (system: UnitSystem) => Promise<void>;

  // ── Conversion helpers (canonical → display) ─────────────────
  /** Convert a canonical kg value to the current display system. */
  kgToDisplay: (kg: number) => number;
  /** Convert a canonical cm value to the current display system. */
  cmToDisplay: (cm: number) => number;
  /** Convert a canonical ml value to the current display system. */
  mlToDisplay: (ml: number) => number;
  /** Convert a canonical °C value to the current display system. */
  celsiusToDisplay: (c: number) => number;
  /** Convert a display value back to canonical kg. */
  displayToKg: (v: number) => number;
  /** Convert a display value back to canonical cm. */
  displayToCm: (v: number) => number;
  /** Convert a display value back to canonical ml. */
  displayToMl: (v: number) => number;
  /** Convert a display value back to canonical °C. */
  displayToCelsius: (v: number) => number;
}

export function useUnits(): UseUnitsReturn {
  const { units, updateSettings } = useCustomization();
  const resolved = (units === 'imperial' ? 'imperial' : 'metric') as UnitSystem;

  const display = useMemo(
    () => (resolved === 'imperial' ? IMPERIAL_DISPLAY : METRIC_DISPLAY),
    [resolved],
  );

  const unitsLabel = useMemo(
    () =>
      resolved === 'imperial'
        ? 'Imperial (lb, in, °F, oz)'
        : 'Metric (kg, cm, °C, ml)',
    [resolved],
  );

  const setUnits = useCallback(
    async (next: UnitSystem) => {
      await updateSettings({ units: next === 'imperial' ? 'imperial' : 'metric' });
    },
    [updateSettings],
  );

  const kgToDisplay = useCallback(
    (kg: number) => (resolved === 'imperial' ? kg * KG_TO_LB : kg),
    [resolved],
  );
  const cmToDisplay = useCallback(
    (cm: number) => (resolved === 'imperial' ? cm * CM_TO_IN : cm),
    [resolved],
  );
  const mlToDisplay = useCallback(
    (ml: number) => (resolved === 'imperial' ? ml * ML_TO_OZ : ml),
    [resolved],
  );
  const celsiusToDisplay = useCallback(
    (c: number) => (resolved === 'imperial' ? c * 1.8 + 32 : c),
    [resolved],
  );

  const displayToKg = useCallback(
    (v: number) => (resolved === 'imperial' ? v / KG_TO_LB : v),
    [resolved],
  );
  const displayToCm = useCallback(
    (v: number) => (resolved === 'imperial' ? v / CM_TO_IN : v),
    [resolved],
  );
  const displayToMl = useCallback(
    (v: number) => (resolved === 'imperial' ? v / ML_TO_OZ : v),
    [resolved],
  );
  const displayToCelsius = useCallback(
    (v: number) => (resolved === 'imperial' ? (v - 32) / 1.8 : v),
    [resolved],
  );

  return {
    units: resolved,
    display,
    unitsLabel,
    setUnits,
    kgToDisplay,
    cmToDisplay,
    mlToDisplay,
    celsiusToDisplay,
    displayToKg,
    displayToCm,
    displayToMl,
    displayToCelsius,
  };
}

export default useUnits;