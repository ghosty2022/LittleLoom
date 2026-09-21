// src/screens/family/SecureAccessListScreen.tsx
// ─────────────────────────────────────────────────────────────────────
// Single-source-of-truth view of who can access the current baby.
// Shows role, permissions, last active, and status per member.
// Parent1/Parent2 can tap a member to edit their permissions.
// ─────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';

type PermissionKey =
  | 'canView'
  | 'canAddEntry'
  | 'canEditEntry'
  | 'canEditOthersEntries'
  | 'canDeleteEntry'
  | 'canEditBaby'
  | 'canInvite'
  | 'canExport'
  | 'canManageFamily';

const PERMISSION_META: Record<
  PermissionKey,
  { label: string; icon: string; color: string }
> = {
  canView: { label: 'View', icon: 'eye', color: '#3b82f6' },
  canAddEntry: { label: 'Log', icon: 'add-circle', color: '#10b981' },
  canEditEntry: { label: 'Edit Own', icon: 'create', color: '#8b5cf6' },
  canEditOthersEntries: { label: 'Edit Others', icon: 'pencil', color: '#f59e0b' },
  canDeleteEntry: { label: 'Delete', icon: 'trash', color: '#ef4444' },
  canEditBaby: { label: 'Baby Profile', icon: 'person', color: '#06b6d4' },
  canInvite: { label: 'Invite', icon: 'mail', color: '#ec4899' },
  canExport: { label: 'Export', icon: 'download', color: '#a855f7' },
  canManageFamily: { label: 'Manage Family', icon: 'people', color: '#f97316' },
};

const ROLE_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  parent1: { bg: '#667eea20', text: '#667eea', label: 'Parent 1' },
  parent2: { bg: '#11998e20', text: '#11998e', label: 'Parent 2' },
  guardian: { bg: '#f59e0b20', text: '#f59e0b', label: 'Guardian' },
  viewer: { bg: '#64748b20', text: '#64748b', label: 'Viewer' },
};

export default function SecureAccessListScreen() {
  const navigation = useNavigation<any>();
  const { currentBaby, currentBabyId, userPermissions, getUserRoleForBaby } =
    useBaby();
  const { members, parent1, parent2, guardians } = useFamily();
  const { userProfile } = useAuth();
  const { fullThemeColors, isDark, borderRadiusValue, fontSizeMultiplier } =
    useCustomization();

  const myRole = userProfile
    ? getUserRoleForBaby(currentBabyId || undefined)
    : null;

  const canManageFamily = currentBabyId
    ? userPermissions[currentBabyId]?.canManageFamily ?? false
    : false;

  // ─── Unified list of everyone with access ──────────────────────
  const accessList = useMemo(() => {
    const list: Array<{
      id: string;
      userId?: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      isYou: boolean;
      status: 'active' | 'pending' | 'inactive';
      lastActive?: string;
      permissions: Record<string, boolean>;
      canBeRemoved: boolean;
    }> = [];

    // Parent 1
    if (parent1) {
      list.push({
        id: parent1.id,
        userId: parent1.userId,
        name: parent1.fullName + ' (Owner)',
        email: parent1.email,
        avatar: parent1.avatar,
        role: 'parent1',
        isYou: parent1.userId === userProfile?.id,
        status: 'active',
        lastActive: parent1.lastActive,
        permissions: {
          canView: true,
          canAddEntry: true,
          canEditEntry: true,
          canEditOthersEntries: true,
          canDeleteEntry: true,
          canEditBaby: true,
          canInvite: true,
          canExport: true,
          canManageFamily: true,
        },
        canBeRemoved: false,
      });
    }

    // Parent 2
    if (parent2) {
      list.push({
        id: parent2.id,
        userId: parent2.userId,
        name: parent2.fullName,
        email: parent2.email,
        avatar: parent2.avatar,
        role: 'parent2',
        isYou: parent2.userId === userProfile?.id,
        status: (parent2.status as any) || 'active',
        lastActive: parent2.lastActive,
        permissions: (parent2.permissions as any) || {},
        canBeRemoved: parent2.canBeRemoved !== false,
      });
    }

    // Guardians + viewers
    guardians.forEach(g => {
      list.push({
        id: g.id,
        userId: g.userId,
        name: g.fullName,
        email: g.email,
        avatar: g.avatar,
        role: g.role,
        isYou: g.userId === userProfile?.id,
        status: (g.status as any) || 'active',
        lastActive: g.lastActive,
        permissions: (g.permissions as any) || {},
        canBeRemoved: g.canBeRemoved !== false,
      });
    });

    return list;
  }, [parent1, parent2, guardians, userProfile?.id]);

  const formatLastActive = (iso?: string): string => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (!currentBaby) {
    return (
      <View
        style={[
          styles.emptyWrap,
          { backgroundColor: fullThemeColors.background },
        ]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={fullThemeColors.textSecondary}
        />
        <Text
          style={{
            color: fullThemeColors.textSecondary,
            marginTop: 12,
          }}
        >
          No baby selected
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: fullThemeColors.background }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(0)}>
        <LinearGradient
          colors={
            isDark
              ? ['#1a1a2e', '#0f0f1e']
              : ['#667eea18', '#764ba208']
          }
          style={[
            styles.headerCard,
            { borderRadius: borderRadiusValue * 1.5 },
          ]}
        >
          <View style={styles.headerTop}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: '#667eea20' },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={26}
                color="#667eea"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: fullThemeColors.text,
                    fontSize: 18 * fontSizeMultiplier,
                  },
                ]}
              >
                Secure Access List
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  {
                    color: fullThemeColors.textSecondary,
                    fontSize: 13 * fontSizeMultiplier,
                  },
                ]}
              >
                {accessList.length}{' '}
                {accessList.length === 1 ? 'person has' : 'people have'}{' '}
                access to {currentBaby.name}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.roleBadge,
              { backgroundColor: ROLE_COLORS[myRole || 'viewer']?.bg },
            ]}
          >
            <Text
              style={[
                styles.roleBadgeText,
                { color: ROLE_COLORS[myRole || 'viewer']?.text },
              ]}
            >
              You are {ROLE_COLORS[myRole || 'viewer']?.label}
            </Text>
          </View>

          {!canManageFamily && (
            <View style={styles.readOnlyBanner}>
              <Ionicons
                name="eye-outline"
                size={14}
                color="#f59e0b"
              />
              <Text style={styles.readOnlyText}>
                You can view this list, but only Parent 1 / Parent 2 can
                change permissions
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Members list */}
      {accessList.map((member, idx) => {
        const roleMeta =
          ROLE_COLORS[member.role] || ROLE_COLORS.viewer;
        const activePerms = (
          Object.keys(PERMISSION_META) as PermissionKey[]
        ).filter(k => member.permissions[k]);

        return (
          <Animated.View
            key={member.id}
            entering={FadeInUp.delay(80 + idx * 40)}
          >
            <TouchableOpacity
              activeOpacity={
                canManageFamily && member.role !== 'parent1' ? 0.75 : 1
              }
              onPress={() => {
                if (!canManageFamily) return;
                if (member.role === 'parent1') return;
                navigation.navigate('EditGuardian', {
  guardianId: member.id,
  mode:
    member.role === 'parent2'
      ? 'parent2'
      : member.role === 'guardian'
      ? 'guardian'
      : 'viewer',
});
              }}
              style={[
                styles.memberCard,
                {
                  backgroundColor: fullThemeColors.surface,
                  borderColor: fullThemeColors.border,
                  borderRadius: borderRadiusValue,
                },
              ]}
            >
              <View style={styles.memberHeader}>
                <SafeAvatar
                  avatar={member.avatar}
                  size={44}
                  fallbackIcon="person"
                  borderColor={roleMeta.text}
                  borderWidth={2}
                  animated={false}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        styles.memberName,
                        {
                          color: fullThemeColors.text,
                          fontSize: 15 * fontSizeMultiplier,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {member.name}
                    </Text>
                    {member.isYou && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.memberEmail,
                      {
                        color: fullThemeColors.textSecondary,
                        fontSize: 12 * fontSizeMultiplier,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {member.email}
                  </Text>
                </View>
                <View
                  style={[
                    styles.rolePill,
                    { backgroundColor: roleMeta.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      { color: roleMeta.text },
                    ]}
                  >
                    {roleMeta.label}
                  </Text>
                </View>
              </View>

              {/* Last active row */}
              <View style={styles.metaRow}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={fullThemeColors.textSecondary}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: fullThemeColors.textSecondary },
                  ]}
                >
                  Last active: {formatLastActive(member.lastActive)}
                </Text>

                {member.status === 'pending' && (
                  <View
                    style={[
                      styles.pendingPill,
                      { backgroundColor: '#f59e0b20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pendingText,
                        { color: '#f59e0b' },
                      ]}
                    >
                      Invite Pending
                    </Text>
                  </View>
                )}
              </View>

              {/* Permission chips */}
              <View style={styles.permsWrap}>
                {activePerms.length === 0 ? (
                  <Text
                    style={[
                      styles.noPermsText,
                      { color: fullThemeColors.textSecondary },
                    ]}
                  >
                    No permissions
                  </Text>
                ) : (
                  activePerms.map(key => {
                    const meta = PERMISSION_META[key];
                    return (
                      <View
                        key={key}
                        style={[
                          styles.permChip,
                          { backgroundColor: `${meta.color}15` },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon as any}
                          size={11}
                          color={meta.color}
                        />
                        <Text
                          style={[
                            styles.permChipText,
                            { color: meta.color },
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Chevron for editable rows */}
              {canManageFamily && member.role !== 'parent1' && (
                <View style={styles.chevronWrap}>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={fullThemeColors.textSecondary}
                  />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      <View style={styles.footer}>
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={fullThemeColors.textSecondary}
        />
        <Text
          style={[
            styles.footerText,
            { color: fullThemeColors.textSecondary },
          ]}
        >
          All access changes sync instantly across family devices.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  headerCard: {
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontWeight: '800' },
  headerSubtitle: { marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 12,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f59e0b10',
  },
  readOnlyText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  memberCard: {
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    position: 'relative',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontWeight: '700', flexShrink: 1 },
  memberEmail: { marginTop: 2 },
  youBadge: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: { color: '#10b981', fontSize: 10, fontWeight: '800' },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rolePillText: { fontSize: 11, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  metaText: { fontSize: 11, fontWeight: '500' },
  pendingPill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingText: { fontSize: 10, fontWeight: '700' },
  permsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  permChipText: { fontSize: 11, fontWeight: '600' },
  noPermsText: { fontSize: 11, fontStyle: 'italic' },
  chevronWrap: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -9,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  footerText: { fontSize: 11, flex: 1 },
});