// src/utils/displayName.ts
import { supabase } from './supabase';

export async function resolveDisplayNames(
  userIds: string[]
): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  if (uniq.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, community_display_name')
    .in('id', uniq);
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: any) => {
    map[p.id] = p.community_display_name || p.full_name || 'Family Member';
  });
  return map;
}