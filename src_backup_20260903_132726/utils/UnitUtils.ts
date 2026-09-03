import React from 'react';

export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';
export type HeightUnit = 'cm' | 'm' | 'ft' | 'in';
export type TemperatureUnit = 'c' | 'f';
export type VolumeUnit = 'ml' | 'l' | 'oz' | 'cup';

export interface UnitPreferences {
  weight: WeightUnit;
  height: HeightUnit;
  temperature: TemperatureUnit;
  volume: VolumeUnit;
  useMetric: boolean;
}

export const DEFAULT_UNITS: UnitPreferences = {
  weight: 'kg',
  height: 'cm',
  temperature: 'c',
  volume: 'ml',
  useMetric: true,
};

const CONVERSIONS = {
  weight: {
    kg: { toBase: 1, label: 'kg', symbol: 'kg' },
    g: { toBase: 0.001, label: 'g', symbol: 'g' },
    lb: { toBase: 0.453592, label: 'lbs', symbol: 'lb' },
    oz: { toBase: 0.0283495, label: 'oz', symbol: 'oz' },
  },
  height: {
    cm: { toBase: 1, label: 'cm', symbol: 'cm' },
    m: { toBase: 100, label: 'm', symbol: 'm' },
    ft: { toBase: 30.48, label: 'ft', symbol: 'ft' },
    in: { toBase: 2.54, label: 'in', symbol: 'in' },
  },
  temperature: {
    c: { label: '°C', symbol: '°C' },
    f: { label: '°F', symbol: '°F' },
  },
  volume: {
    ml: { toBase: 1, label: 'ml', symbol: 'ml' },
    l: { toBase: 1000, label: 'L', symbol: 'l' },
    oz: { toBase: 29.5735, label: 'fl oz', symbol: 'oz' },
    cup: { toBase: 236.588, label: 'cups', symbol: 'cup' },
  },
};

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  const baseValue = value * CONVERSIONS.weight[from].toBase;
  return baseValue / CONVERSIONS.weight[to].toBase;
}

export function convertHeight(value: number, from: HeightUnit, to: HeightUnit): number {
  if (from === to) return value;
  const baseValue = value * CONVERSIONS.height[from].toBase;
  return baseValue / CONVERSIONS.height[to].toBase;
}

export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return value;
  if (from === 'c' && to === 'f') return (value * 9/5) + 32;
  if (from === 'f' && to === 'c') return (value - 32) * 5/9;
  return value;
}

export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  if (from === to) return value;
  const baseValue = value * CONVERSIONS.volume[from].toBase;
  return baseValue / CONVERSIONS.volume[to].toBase;
}

export function formatWeight(value: number, unit: WeightUnit, decimals: number = 2): string {
  return `${value.toFixed(decimals)} ${CONVERSIONS.weight[unit].label}`;
}

export function formatHeight(value: number, unit: HeightUnit, decimals: number = 1): string {
  if (unit === 'ft') {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    return `${feet}'${inches}"`;
  }
  return `${value.toFixed(decimals)} ${CONVERSIONS.height[unit].label}`;
}

export function formatTemperature(value: number, unit: TemperatureUnit, decimals: number = 1): string {
  return `${value.toFixed(decimals)}${CONVERSIONS.temperature[unit].symbol}`;
}

export function formatVolume(value: number, unit: VolumeUnit, decimals: number = 0): string {
  return `${value.toFixed(decimals)} ${CONVERSIONS.volume[unit].label}`;
}

export function smartWeightDisplay(valueKg: number, locale: string = 'en'): string {
  const isMetric = !['US', 'LR', 'MM'].includes(locale); // US, Liberia, Myanmar use imperial
  if (isMetric) {
    if (valueKg < 1) return formatWeight(valueKg * 1000, 'g', 0);
    return formatWeight(valueKg, 'kg', 2);
  }
  const lbs = convertWeight(valueKg, 'kg', 'lb');
  if (lbs < 1) return formatWeight(convertWeight(valueKg, 'kg', 'oz'), 'oz', 1);
  return formatWeight(lbs, 'lb', 2);
}

export function smartHeightDisplay(valueCm: number, locale: string = 'en'): string {
  const isMetric = !['US', 'LR', 'MM'].includes(locale);
  if (isMetric) {
    if (valueCm >= 100) return formatHeight(valueCm / 100, 'm', 2);
    return formatHeight(valueCm, 'cm', 1);
  }
  const totalInches = convertHeight(valueCm, 'cm', 'in');
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export function parseHeightInput(input: string): { value: number; unit: HeightUnit } | null {
  const trimmed = input.trim().toLowerCase();

  const ftInMatch = trimmed.match(/^(\d+)'(\d+)(?:"|in)?$/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1]);
    const inches = parseInt(ftInMatch[2]);
    return { value: feet + inches / 12, unit: 'ft' };
  }

  const cmMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(cm|m)$/);
  if (cmMatch) {
    const value = parseFloat(cmMatch[1]);
    const unit = cmMatch[2] as HeightUnit;
    return { value: unit === 'm' ? value * 100 : value, unit: 'cm' };
  }

  return null;
}

export function useUnitPreferences() {
  const [preferences, setPreferences] = React.useState<UnitPreferences>(DEFAULT_UNITS);

  const updatePreferences = React.useCallback((updates: Partial<UnitPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  }, []);

  const convert = React.useCallback((
    type: 'weight' | 'height' | 'temperature' | 'volume',
    value: number,
    to: WeightUnit | HeightUnit | TemperatureUnit | VolumeUnit
  ) => {
    switch (type) {
      case 'weight': return convertWeight(value, preferences.weight as WeightUnit, to as WeightUnit);
      case 'height': return convertHeight(value, preferences.height as HeightUnit, to as HeightUnit);
      case 'temperature': return convertTemperature(value, preferences.temperature as TemperatureUnit, to as TemperatureUnit);
      case 'volume': return convertVolume(value, preferences.volume as VolumeUnit, to as VolumeUnit);
      default: return value;
    }
  }, [preferences]);

  return {
    preferences,
    updatePreferences,
    convert,
    isMetric: preferences.useMetric,
  };
}

export const UnitUtils = {
  convertWeight,
  convertHeight,
  convertTemperature,
  convertVolume,
  formatWeight,
  formatHeight,
  formatTemperature,
  formatVolume,
  smartWeightDisplay,
  smartHeightDisplay,
  parseHeightInput,
  DEFAULT_UNITS,
};

export default UnitUtils;