
import type { ColorValue } from 'react-native';

/**
 * Coerces a possibly-empty/undefined array of colors into the tuple
 * that expo-linear-gradient expects. Falls back to a safe default.
 */
export function asGradient(
  colors: ReadonlyArray<ColorValue | string | undefined> | null | undefined,
  fallback: [ColorValue, ColorValue, ...ColorValue[]] = ['#667eea', '#764ba2'],
): readonly [ColorValue, ColorValue, ...ColorValue[]] {
  if (!colors || colors.length < 2) return fallback;
  const first = colors[0] ?? fallback[0];
  const second = colors[1] ?? fallback[1];
  const rest = colors.slice(2).filter((c): c is ColorValue => c != null);
  return [first, second, ...rest];
}