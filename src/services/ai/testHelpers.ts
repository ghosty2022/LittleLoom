// src/services/ai/testHelpers.ts
// ─────────────────────────────────────────────────────────────────────
// Debug-only helpers for populating test data. Stripped in production.
// Call from a dev menu or console only.
// ─────────────────────────────────────────────────────────────────────

import { supabase } from '@/utils/supabase';

export async function seedTestEntries(
  babyId: string,
  trackerId: string,
  count: number = 5
): Promise<number> {
  if (!__DEV__) {
    console.warn('[TestHelpers] Only available in DEV builds');
    return 0;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const now = Date.now();
  const rows = [];

  for (let i = 0; i < count; i++) {
    // Space entries ~2h apart going back in time
    const ts = new Date(now - i * 2 * 60 * 60 * 1000);

    // Tracker-specific data payloads
    const data = buildTestData(trackerId, i);

    rows.push({
      id: `test_${trackerId}_${now}_${i}`,
      baby_id: babyId,
      tracker_id: trackerId,
      tracker_type: trackerId,
      timestamp: ts.toISOString(),
      title: `Test ${trackerId} ${i + 1}`,
      data,
      logged_by: user.id,
      logged_by_name: 'Test Harness',
      logged_by_role: 'parent1',
      created_by: user.id,
      created_by_name: 'Test Harness',
      created_by_role: 'parent1',
      is_deleted: false,
      created_at: ts.toISOString(),
      updated_at: ts.toISOString(),
    });
  }

  const { error } = await supabase.from('tracker_entries').insert(rows);
  if (error) {
    console.error('[TestHelpers] Seed failed:', error.message);
    return 0;
  }

  console.log(`[TestHelpers] Seeded ${count} ${trackerId} entries`);
  return count;
}

function buildTestData(trackerId: string, index: number): Record<string, unknown> {
  switch (trackerId) {
    case 'feed':
      return {
        feedType: index % 2 === 0 ? 'bottle' : 'breast',
        bottleAmount: 90 + index * 10,
        bottleAmount_unit: 'ml',
      };
    case 'sleep':
      return {
        sleepType: index % 3 === 0 ? 'night' : 'nap',
        status: 'completed',
        duration: 1800 + index * 300,
        quality: 3 + (index % 3),
      };
    case 'diaper':
      return {
        type: ['wet', 'dirty', 'both'][index % 3],
      };
    case 'growth':
      return {
        measurementType: 'weight',
        value: 5 + index * 0.2,
        value_unit: 'kg',
      };
    case 'temperature':
      return {
        value: 36.5 + (index % 3) * 0.3,
        unit: 'celsius',
        method: 'forehead',
      };
    case 'mood':
      return { mood: 3 + (index % 3) };
    default:
      return { note: `Test entry ${index + 1}` };
  }
}

export async function clearTestEntries(babyId: string): Promise<number> {
  if (!__DEV__) return 0;

  const { data, error } = await supabase
    .from('tracker_entries')
    .delete()
    .eq('baby_id', babyId)
    .like('id', 'test_%')
    .select('id');

  if (error) return 0;
  return data?.length ?? 0;
}