import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SafeAvatar } from './SafeAvatar';
import {
  UserRole,
  FamilyMember,
  ROLE_PERMISSIONS,
  getMemberDisplayLabel,
  canonicalizeRelationship,
} from '../types/roles';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura (shared with FamilyDashboardScreen)
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkCard: '#292524',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   ROLE CONFIG — single source of truth for colors/icons per role
   ═══════════════════════════════════════════════════════════════════════════ */
const ROLE_CONFIG: Record<UserRole, {
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tier: 'parent' | 'guardian' | 'viewer';
}> = {
  [UserRole.PARENT_1]: {
    color: '#6366f1',
    gradient: ['#6366f1', '#8b5cf6'],
    icon: 'shield',
    label: 'Primary Parent',
    tier: 'parent',
  },
  [UserRole.PARENT_2]: {
    color: '#ec4899',
    gradient: ['#ec4899', '#f43f5e'],
    icon: 'heart',
    label: 'Co-Parent',
    tier: 'parent',
  },
  [UserRole.GUARDIAN]: {
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    icon: 'shield-checkmark',
    label: 'Guardian',
    tier: 'guardian',
  },
  [UserRole.VIEWER]: {
    color: '#94a3b8',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    label: 'Viewer',
    tier: 'viewer',
  },
};

const HAPTIC_LIGHT = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════════════════ */
interface FamilyTreeProps {
  members: FamilyMember[];
  currentBaby: any;
  isDark: boolean;
  onManage: () => void;
  onMemberPress: (member: FamilyMember) => void;
  onAddCoParent: () => void;
  onAddGuardian: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBER NODE — one card per person
   ═══════════════════════════════════════════════════════════════════════════ */
const MemberNode = React.memo(
  ({
    member,
    isDark,
    onPress,
    compact = false,
  }: {
    member: FamilyMember;
    isDark: boolean;
    onPress: () => void;
    compact?: boolean;
  }) => {
    const role = (member.role as UserRole) || UserRole.VIEWER;
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG[UserRole.VIEWER];

    // The human label shown under the name. Prefers the explicit
    // relationship ("Mother", "Nana", "Nanny"), falls back to the
    // role label so we never show an empty subtitle.
    const displayLabel = getMemberDisplayLabel({
      role,
      relationship: member.relationship,
    });
    const relationshipLabel = canonicalizeRelationship(member.relationship);
    const showRelationshipHint =
      relationshipLabel &&
      relationshipLabel.toLowerCase() !== displayLabel.toLowerCase();

    const avatarSize = compact ? 40 : 52;

    return (
      <TouchableOpacity
        onPress={() => {
          HAPTIC_LIGHT();
          onPress();
        }}
        activeOpacity={0.85}
        style={{ alignItems: 'center', width: compact ? 76 : 96 }}
      >
        <View
          style={{
            width: avatarSize + 8,
            height: avatarSize + 8,
            borderRadius: (avatarSize + 8) / 2,
            padding: 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LinearGradient
            colors={cfg.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: (avatarSize + 8) / 2,
            }}
          />
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? DS.darkSurface : DS.white,
            }}
          >
            <SafeAvatar
              avatar={member.avatar}
              size={avatarSize}
              fallbackIcon={cfg.icon as any}
              fallbackColor={cfg.color}
              fallbackBgColor={`${cfg.color}20`}
              borderWidth={0}
            />
          </View>
        </View>

        <Text
          style={{
            fontSize: compact ? 10 : 11,
            fontWeight: '700',
            color: isDark ? DS.white : DS.gray900,
            marginTop: 4,
            textAlign: 'center',
            maxWidth: compact ? 70 : 90,
          }}
          numberOfLines={1}
        >
          {member.fullName?.split(' ')[0] || 'Member'}
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '800',
            color: cfg.color,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            marginTop: 1,
            maxWidth: compact ? 70 : 90,
          }}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        {showRelationshipHint && !compact && (
          <Text
            style={{
              fontSize: 8,
              fontWeight: '500',
              color: isDark ? DS.gray500 : DS.gray400,
              textAlign: 'center',
              marginTop: 1,
              maxWidth: 90,
            }}
            numberOfLines={1}
          >
            {relationshipLabel}
          </Text>
        )}
      </TouchableOpacity>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   CONNECTOR — vertical dotted line between tiers
   ═══════════════════════════════════════════════════════════════════════════ */
const Connector = React.memo(({ color }: { color: string }) => (
  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
    <View
      style={{
        width: 2,
        height: 18,
        backgroundColor: color,
        opacity: 0.35,
        borderRadius: 1,
      }}
    />
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TIER LABEL — "Primary Parent", "Co-Parent", "Guardians", "Viewers"
   ═══════════════════════════════════════════════════════════════════════════ */
const TierLabel = React.memo(
  ({
    label,
    count,
    color,
    isDark,
  }: {
    label: string;
    count: number;
    color: string;
    isDark: boolean;
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 6,
      }}
    >
      <View
        style={{
          height: 1,
          width: 20,
          backgroundColor: color,
          opacity: 0.3,
        }}
      />
      <Text
        style={{
          fontSize: 9,
          fontWeight: '800',
          color,
          textTransform: 'uppercase',
          letterSpacing: 0.7,
        }}
      >
        {label}
        {count > 1 ? ` · ${count}` : ''}
      </Text>
      <View
        style={{
          height: 1,
          width: 20,
          backgroundColor: color,
          opacity: 0.3,
        }}
      />
    </View>
  ),
);

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY SLOT — dashed invite button inside the tree
   ═══════════════════════════════════════════════════════════════════════════ */
const EmptySlot = React.memo(
  ({
    label,
    icon,
    color,
    isDark,
    onPress,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    isDark: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={() => {
        HAPTIC_LIGHT();
        onPress();
      }}
      activeOpacity={0.85}
      style={{ alignItems: 'center', width: 96 }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: `${color}80`,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : `${color}08`,
        }}
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color,
          marginTop: 6,
          textAlign: 'center',
          maxWidth: 90,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  ),
);

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY TREE — the main component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FamilyTree({
  members,
  currentBaby,
  isDark,
  onManage,
  onMemberPress,
  onAddCoParent,
  onAddGuardian,
}: FamilyTreeProps) {
  // ── Bucket members by tier. This is the DISPLAY hierarchy:
  //    • parents   = parent1 + parent2, shown side-by-side at the top
  //    • guardians = guardian role only
  //    • viewers   = viewer role only
  //
  //    The tree renders in this order: parents → connectors → guardians
  //    → connectors → viewers. We never mix tiers.
  const { parent1, parent2, guardians, viewers, total } = useMemo(() => {
    // ── NORMALISE ROLE ──────────────────────────────────────────
    // `family_members.role` is technically a string. Legacy rows may
    // hold 'parent1', 'Parent 1', 'parent_1', or even the enum value.
    // Normalise before bucketing so a role value mismatch never hides
    // a member from the tree (this was the guardian-invisible bug).
    const normalise = (raw: unknown): UserRole => {
      const s = String(raw || '').toLowerCase().replace(/[\s_-]+/g, '');
      if (s === 'parent1' || s === 'primaryparent' || s === 'owner') return UserRole.PARENT_1;
      if (s === 'parent2' || s === 'coparent') return UserRole.PARENT_2;
      if (s === 'guardian') return UserRole.GUARDIAN;
      if (s === 'viewer') return UserRole.VIEWER;
      return UserRole.VIEWER;
    };

    const normalised: FamilyMember[] = members
      .map((m) => ({ ...m, role: normalise((m as any).role) }))
      // Drop non-real rows (invite placeholders with no userId AND no
      // lastActive are not yet a family member — they belong in the
      // invite list, not the tree).
      .filter((m) => !!(m as any).userId || !!m.id);

    const p1: FamilyMember | null =
      normalised.find((m) => m.role === UserRole.PARENT_1) || null;
    const p2: FamilyMember | null =
      normalised.find((m) => m.role === UserRole.PARENT_2) || null;
    const gs = normalised.filter((m) => m.role === UserRole.GUARDIAN);
    const vs = normalised.filter((m) => m.role === UserRole.VIEWER);
    return {
      parent1: p1,
      parent2: p2,
      guardians: gs,
      viewers: vs,
      total: normalised.length,
    };
  }, [members]);

  const babyName = currentBaby?.name || 'your baby';
  const babyAvatar = currentBaby?.avatar;

  const handleManage = useCallback(() => {
    HAPTIC_LIGHT();
    onManage();
  }, [onManage]);

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: `${DS.primary}18` },
              ]}
            >
              <Ionicons name="git-network-outline" size={15} color={DS.primary} />
            </View>
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? DS.white : DS.gray900 },
                ]}
              >
                Family Tree
              </Text>
              <Text
                style={[
                  styles.headerSub,
                  { color: isDark ? DS.gray500 : DS.gray400 },
                ]}
              >
                {total} {total === 1 ? 'member' : 'members'} · {babyName}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleManage}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            activeOpacity={0.8}
          >
            <Text style={styles.manageText}>Manage</Text>
            <Ionicons name="chevron-forward" size={13} color={DS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── THE TREE ─────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.treeScroll}
        >
          <View style={{ alignItems: 'center' }}>
            {/* ── TIER 1: PARENTS (parent1 + parent2, centered around baby) ── */}
            {(parent1 || parent2) && (
              <>
                <TierLabel
                  label="Parents"
                  count={(parent1 ? 1 : 0) + (parent2 ? 1 : 0)}
                  color={DS.primary}
                  isDark={isDark}
                />
                <View style={styles.parentsRow}>
                  {parent1 && (
                    <MemberNode
                      member={parent1}
                      isDark={isDark}
                      onPress={() => onMemberPress(parent1)}
                    />
                  )}
                  {!parent1 && (
                    <EmptySlot
                      label="Add Primary Parent"
                      icon="add"
                      color={DS.primary}
                      isDark={isDark}
                      onPress={onManage}
                    />
                  )}
                  {parent2 && (
                    <MemberNode
                      member={parent2}
                      isDark={isDark}
                      onPress={() => onMemberPress(parent2)}
                    />
                  )}
                  {!parent2 && (
                    <EmptySlot
                      label="Add Co-Parent"
                      icon="heart-outline"
                      color={DS.accent}
                      isDark={isDark}
                      onPress={onAddCoParent}
                    />
                  )}
                </View>
              </>
            )}

            {/* ── CENTER: BABY NODE ────────────────────────────────── */}
            <Connector color={isDark ? DS.gray600 : DS.gray300} />
            <View style={styles.babyNode}>
              <LinearGradient
                colors={['#6366f1', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.babyAura}
              />
              <View
                style={[
                  styles.babyInner,
                  { backgroundColor: isDark ? DS.darkSurface : DS.white },
                ]}
              >
                <SafeAvatar
                  avatar={babyAvatar}
                  size={54}
                  fallbackIcon="happy-outline"
                  fallbackColor={DS.primary}
                  fallbackBgColor={`${DS.primary}20`}
                  borderWidth={0}
                />
              </View>
            </View>
            <Text
              style={[
                styles.babyName,
                { color: isDark ? DS.white : DS.gray900 },
              ]}
              numberOfLines={1}
            >
              {babyName}
            </Text>
            <Text
              style={[
                styles.babyMeta,
                { color: isDark ? DS.gray500 : DS.gray400 },
              ]}
            >
              {currentBaby?.gender ? String(currentBaby.gender) : 'Baby'}
            </Text>

            {/* ── TIER 2: GUARDIANS ────────────────────────────────── */}
            {guardians.length > 0 && (
              <>
                <Connector color={isDark ? DS.gray600 : DS.gray300} />
                <TierLabel
                  label="Guardians"
                  count={guardians.length}
                  color={DS.success}
                  isDark={isDark}
                />
                <View style={styles.row}>
                  {guardians.map((g) => (
                    <MemberNode
                      key={g.id}
                      member={g}
                      isDark={isDark}
                      onPress={() => onMemberPress(g)}
                      compact={guardians.length > 3}
                    />
                  ))}
                  <EmptySlot
                    label="Add Guardian"
                    icon="person-add-outline"
                    color={DS.success}
                    isDark={isDark}
                    onPress={onAddGuardian}
                  />
                </View>
              </>
            )}

            {/* ── TIER 3: VIEWERS ──────────────────────────────────── */}
            {viewers.length > 0 && (
              <>
                <Connector color={isDark ? DS.gray600 : DS.gray300} />
                <TierLabel
                  label="Viewers"
                  count={viewers.length}
                  color={DS.gray500}
                  isDark={isDark}
                />
                <View style={styles.row}>
                  {viewers.map((v) => (
                    <MemberNode
                      key={v.id}
                      member={v}
                      isDark={isDark}
                      onPress={() => onMemberPress(v)}
                      compact
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── FALLBACK: no guardians yet, no viewers, no parent2 ─ */}
            {guardians.length === 0 && viewers.length === 0 && !parent2 && (
              <>
                <Connector color={isDark ? DS.gray600 : DS.gray300} />
                <TouchableOpacity
                  onPress={onAddGuardian}
                  activeOpacity={0.85}
                  style={[
                    styles.emptyCta,
                    {
                      borderColor: `${DS.success}50`,
                      backgroundColor: `${DS.success}08`,
                    },
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={DS.success} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.emptyCtaTitle,
                        { color: isDark ? DS.white : DS.gray900 },
                      ]}
                    >
                      Invite your first Guardian
                    </Text>
                    <Text
                      style={[
                        styles.emptyCtaSub,
                        { color: isDark ? DS.gray400 : DS.gray500 },
                      ]}
                    >
                      Grandparents, nannies, and caregivers can help log entries.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={DS.success} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: {
    marginHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.lg,
    paddingBottom: DS.space.md,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  manageText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.primary,
  },
  treeScroll: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.lg,
    minWidth: '100%',
  },
  parentsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: 400,
  },
  babyNode: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  babyAura: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    opacity: 0.9,
  },
  babyInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyName: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 140,
  },
  babyMeta: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginTop: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    minWidth: 260,
    maxWidth: 340,
  },
  emptyCtaTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCtaSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 14,
  },
});

export { FamilyTree };