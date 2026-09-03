// utils/form.ts -- Shared form field visibility logic
import { FieldConfig } from '@/types/trackers';

/**
 * Determine if a field should be visible based on its showIf condition
 * and the current form data.
 */
export function isFieldVisible(
  field: FieldConfig,
  data: Record<string, unknown>
): boolean {
  if (!field.showIf) return true;
  const { field: targetField, equals, notEquals, contains } = field.showIf;
  const targetValue = data[targetField];
  if (equals !== undefined) return targetValue === equals;
  if (notEquals !== undefined) return targetValue !== notEquals;
  if (contains !== undefined) {
    return Array.isArray(targetValue) && targetValue.includes(contains);
  }
  return true;
}