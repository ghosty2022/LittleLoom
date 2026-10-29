import React, { useEffect, useState } from 'react';
import { TextInput, TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

/**
 * RelationshipBackfillBanner
 *
 * Shown ONCE on HomeScreen (or Profile) for users who:
 *   • Are signed in
 *   • Own at least one baby (parent1_id = their uid)
 *   • Have a family_members row with `relationship IS NULL` or 'Parent'
 *
 * Lets them pick "Mother / Father / Guardian / Custom" without needing
 * to open EditGuardian. Saves to family_members + user_metadata so future
 * babies inherit it too.
 *
 * Hides itself permanently once saved (per-user, AsyncStorage flag).
 */
const BACKFILL_PROMPTED_KEY = (uid: string) => `@littleloom_relationship_backfill_${uid}`;

interface Props {
  isDark: boolean;
  userId: string;
  onCompleted: () => void; // triggers loadFamily() in parent
}

export const RelationshipBackfillBanner: React.FC<Props> = ({ isDark, userId, onCompleted }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prompted = await AsyncStorage.getItem(BACKFILL_PROMPTED_KEY(userId));
        if (prompted === 'true') {
          if (!cancelled) setLoading(false);
          return;
        }

        // Find parent1 babies owned by this user with a NULL/'Parent' relationship
        const { data: babies } = await supabase
          .from('babies')
          .select('id')
          .eq('parent1_id', userId)
          .eq('is_active', true);

        if (!babies || babies.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        const babyIds = babies.map((b: any) => b.id);
        const { data: fmRows } = await supabase
          .from('family_members')
          .select('id, relationship, baby_id')
          .in('baby_id', babyIds)
          .eq('user_id', userId)
          .eq('role', 'parent1')
          .is('deleted_at', null);

        const needsBackfill = (fmRows || []).some(
          (r: any) => !r.relationship || r.relationship.trim().toLowerCase() === 'parent'
        );

        if (!cancelled && needsBackfill) {
          setVisible(true);
        }
      } catch (e) {
        if (__DEV__) console.warn('[RelationshipBackfill] check failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const save = async (value: string) => {
    const rel = value.trim();
    if (!rel) return;
    setSaving(true);
    try {
      // 1) Mirror into every parent1 family_members row for this user
      const { data: babies } = await supabase
        .from('babies')
        .select('id')
        .eq('parent1_id', userId)
        .eq('is_active', true);

      if (babies && babies.length > 0) {
        const babyIds = babies.map((b: any) => b.id);
        await supabase
          .from('family_members')
          .update({ relationship: rel, updated_at: new Date().toISOString() })
          .in('baby_id', babyIds)
          .eq('user_id', userId)
          .eq('role', 'parent1');
      }

      // 2) Persist into user_metadata so the NEXT baby inherits it
      try {
        await supabase.auth.updateUser({ data: { relationship: rel } });
      } catch {}

      // 3) Mirror into profiles.community_bio as fallback for other
      //    surfaces (UserContext, EditGuardian).
      try {
        await supabase
          .from('profiles')
          .update({ community_bio: rel.slice(0, 160), updated_at: new Date().toISOString() })
          .eq('id', userId);
      } catch {}

      // 4) Mark prompted
      await AsyncStorage.setItem(BACKFILL_PROMPTED_KEY(userId), 'true');

      // 5) Notify downstream
      try {
        const { broadcastProfileChange } = require('@/context/AuthContext');
        await broadcastProfileChange({ userId, fields: ['role'] });
      } catch {}

      setVisible(false);
      onCompleted();
    } catch (e) {
      if (__DEV__) console.warn('[RelationshipBackfill] save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async () => {
    await AsyncStorage.setItem(BACKFILL_PROMPTED_KEY(userId), 'true');
    setVisible(false);
  };

  if (loading || !visible) return null;

  const chips = ['Mother', 'Father', 'Parent', 'Guardian', 'Caregiver'];

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? '#1c1917' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e7e5e4',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="heart" size={16} color="#6366f1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#f5f5f4' : '#1c1917' }}>
            Complete your profile
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? '#a8a29e' : '#78716c', marginTop: 1 }}>
            Tell us who you are to your child
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={isDark ? '#78716c' : '#a8a29e'} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((c) => (
          <TouchableOpacity
            key={c}
            disabled={saving}
            onPress={() => save(c)}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
              backgroundColor: 'rgba(99,102,241,0.08)',
              borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366f1' }}>{c}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          disabled={saving}
          onPress={() => setShowCustom((v) => !v)}
          style={{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
            backgroundColor: 'rgba(236,72,153,0.08)',
            borderWidth: 1, borderColor: 'rgba(236,72,153,0.2)',
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}
        >
          <Ionicons name="create-outline" size={12} color="#ec4899" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ec4899' }}>Other</Text>
        </TouchableOpacity>
      </View>

      {showCustom && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TextInput
            style={{
              flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafaf9',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e7e5e4',
              color: isDark ? '#f5f5f4' : '#1c1917', fontSize: 13,
            }}
            placeholder="e.g. Godmother, Au Pair"
            placeholderTextColor={isDark ? '#57534e' : '#a8a29e'}
            value={custom}
            onChangeText={setCustom}
            autoCapitalize="words"
            maxLength={40}
          />
          <TouchableOpacity
            disabled={!custom.trim() || saving}
            onPress={() => save(custom)}
            style={{
              paddingHorizontal: 14, borderRadius: 10,
              backgroundColor: custom.trim() ? '#6366f1' : '#d6d3d1',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    borderRadius: 16, borderWidth: 1,
  },
});