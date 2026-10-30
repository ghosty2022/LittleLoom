/**
 * FamilySharingScreen  →  "Manage Family"   (route: 'FamilySharing')
 *
 * PURPOSE: the place where you CHANGE things about the family.
 *   Members tab → add people, see everyone grouped by role, pending invites
 *   Tree tab    → visual hierarchy
 *   Access tab  → what each role can do, family tools (backup, reminders),
 *                 transfer ownership, leave family
 *
 *   ❌ No engagement scores, activity feeds or daily stats → "Family Overview"
 *   ❌ No inline editing of a person → every tap opens EditGuardian
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '@/utils/supabase';
import type { RootStackParamList } from '../../types/navigation';
import {
  UserRole,
  FamilyMember,
  getMemberDisplayLabel,
  canonicalizeRelationship,
  normalizeRole,
} from '../../types/roles';
import FamilyTree from '../../components/FamilyTree';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSafeUser } from '../../hooks/useSafeContexts';
import { useSweetAlert } from '../../components/SweetAlert';
import {
  Card,
  DS,
  EmptyState,
  HEADER_TOTAL_HEIGHT,
  HeaderButton,
  IconName,
  PressableScale,
  ROLE_CONFIG,
  SafeAvatar,
  ScreenHeader,
  SectionHeader,
  SheetModal,
  TabBar,
  isActiveWithin,
  isPendingMember,
  memberEditParams,
  theme,
} from '../../components/FamilyUI';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;
type TabKey = 'members' | 'tree' | 'access';

/* ═══════════════════════════ Permissions config ═══════════════════════════ */
type PermissionKey =
  | 'canView' | 'canAddEntry' | 'canEditEntry' | 'canEditOthersEntries'
  | 'canDeleteEntry' | 'canEditBaby' | 'canInvite' | 'canExport' | 'canManageFamily';

const PERMISSION_META: Record<PermissionKey, { label: string; icon: IconName; color: string }> = {
  canView: { label: 'View', icon: 'eye', color: '#3b82f6' },
  canAddEntry: { label: 'Log', icon: 'add-circle', color: '#10b981' },
  canEditEntry: { label: 'Edit own', icon: 'create', color: '#8b5cf6' },
  canEditOthersEntries: { label: 'Edit others', icon: 'pencil', color: '#f59e0b' },
  canDeleteEntry: { label: 'Delete', icon: 'trash', color: '#ef4444' },
  canEditBaby: { label: 'Baby profile', icon: 'person', color: '#06b6d4' },
  canInvite: { label: 'Invite', icon: 'mail', color: '#ec4899' },
  canExport: { label: 'Export', icon: 'download', color: '#a855f7' },
  canManageFamily: { label: 'Manage family', icon: 'people', color: '#f97316' },
};

const ALL: Record<PermissionKey, boolean> = {
  canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: true,
  canDeleteEntry: true, canEditBaby: true, canInvite: true, canExport: true, canManageFamily: true,
};
const NONE: Record<PermissionKey, boolean> = {
  canView: true, canAddEntry: false, canEditEntry: false, canEditOthersEntries: false,
  canDeleteEntry: false, canEditBaby: false, canInvite: false, canExport: false, canManageFamily: false,
};
const ROLE_PERMISSION_MAP: Record<UserRole, Record<PermissionKey, boolean>> = {
  [UserRole.PARENT_1]: ALL,
  [UserRole.PARENT_2]: ALL,
  [UserRole.GUARDIAN]: { ...NONE, canAddEntry: true, canEditEntry: true },
  [UserRole.VIEWER]: NONE,
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  [UserRole.PARENT_1]: 'Owner — full access to everything',
  [UserRole.PARENT_2]: 'Full access to manage the family and baby data',
  [UserRole.GUARDIAN]: 'Can log and edit own entries, cannot delete or manage',
  [UserRole.VIEWER]: 'View only',
};

const INVITE_STATUS: Record<string, { label: string; color: string; icon: IconName }> = {
  active: { label: 'Active', color: '#22c55e', icon: 'checkmark-circle' },
  used: { label: 'Used', color: '#64748b', icon: 'checkmark-done-circle' },
  partial: { label: 'Unfinished', color: '#f59e0b', icon: 'warning' },
  revoked: { label: 'Revoked', color: '#ef4444', icon: 'close-circle' },
  expired: { label: 'Expired', color: '#f59e0b', icon: 'time' },
};

const getRoleCfg = (role: any) => ROLE_CONFIG[normalizeRole(role) as UserRole] || ROLE_CONFIG[UserRole.VIEWER];
const memberKey = (m: any) => m.userId || m.id;

/* ═══════════════════════════ Summary ═══════════════════════════ */
const Summary = memo(({ isDark, members, hasCoParent, guardianCount, pendingCount }: {
  isDark: boolean; members: number; hasCoParent: boolean; guardianCount: number; pendingCount: number;
}) => {
  const t = theme(isDark);
  const items = [
    { label: 'Members', value: String(members), color: DS.primary },
    { label: 'Co-Parent', value: hasCoParent ? 'Yes' : 'No', color: hasCoParent ? DS.accent : t.faint },
    { label: 'Guardians', value: String(guardianCount), color: DS.success },
    { label: 'Pending', value: String(pendingCount), color: pendingCount ? DS.warning : t.faint },
  ];
  return (
    <Card isDark={isDark} tint={DS.primary} style={{ paddingVertical: DS.space.md, flexDirection: 'row', alignItems: 'center' }}>
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View style={[s.vDiv, { backgroundColor: t.border }]} /> : null}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.sumVal, { color: it.color }]}>{it.value}</Text>
            <Text style={[s.sumLbl, { color: t.muted }]}>{it.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
});

/* ═══════════════════════════ Member card ═══════════════════════════ */
const MemberCard = memo(({ member, isYou, isDark, index, onPress }: {
  member: FamilyMember; isYou: boolean; isDark: boolean; index: number; onPress: () => void;
}) => {
  const t = theme(isDark);
  const cfg = getRoleCfg(member.role);
  const online = isActiveWithin(member, 5 * 60000);
  const pending = isPendingMember(member);
  const roleLabel = getMemberDisplayLabel({ role: member.role, relationship: member.relationship });
  const rel = member.relationship ? canonicalizeRelationship(member.relationship) : '';
  const showRel = !!rel && rel.toLowerCase() !== roleLabel.toLowerCase();

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[s.memberCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <LinearGradient colors={cfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.memberStrip} />
          <View style={s.memberRow}>
            <View>
              <SafeAvatar avatar={member.avatar} size={48} fallbackColor={cfg.color} />
              {online ? <View style={[s.onlineDot, { borderColor: t.card }]} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: DS.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.memberName, { color: t.title }]} numberOfLines={1}>{member.fullName}</Text>
                {isYou ? (
                  <View style={[s.youBadge, { backgroundColor: `${DS.primary}1c` }]}>
                    <Text style={[s.youText, { color: DS.primary }]}>You</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <LinearGradient colors={cfg.gradient} style={s.roleBadge}>
                  <Ionicons name={cfg.icon} size={9} color={DS.white} />
                  <Text style={s.roleBadgeText}>{roleLabel}</Text>
                </LinearGradient>
                {showRel ? <Text style={[s.memberRel, { color: t.faint }]} numberOfLines={1}>· {rel}</Text> : null}
              </View>
              {pending ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="time-outline" size={11} color={DS.warning} />
                  <Text style={[s.statusText, { color: DS.warning }]}>Invitation pending</Text>
                </View>
              ) : member.lastActive ? (
                <Text style={[s.statusText, { color: t.faint, marginTop: 4 }]}>
                  {online ? 'Active now' : `Active ${formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })}`}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.faint} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════ Settings-style row ═══════════════════════════ */
const ActionRow = memo(({ isDark, icon, color, title, subtitle, onPress, destructive }: {
  isDark: boolean; icon: IconName; color: string; title: string; subtitle: string;
  onPress: () => void; destructive?: boolean;
}) => {
  const t = theme(isDark);
  const tint = destructive ? DS.danger : color;
  return (
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[s.row, { backgroundColor: t.card, borderColor: destructive ? `${DS.danger}40` : t.border }]}>
        <View style={[s.rowIcon, { backgroundColor: `${tint}18` }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: destructive ? DS.danger : t.title }]}>{title}</Text>
          <Text style={[s.rowSub, { color: t.muted }]} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={t.faint} />
      </View>
    </PressableScale>
  );
});

/* ═══════════════════════════ MAIN SCREEN ═══════════════════════════ */
export default function FamilySharingScreen({ navigation }: Props) {
  const nav = navigation as any;
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const t = theme(isDark);

  const {
    members, parent1, parent2, loadFamily,
    getActiveInviteCodes, revokeInviteCode, transferOwnership,
  } = useFamily();
  const { profile } = useSafeUser();
  const { userProfile } = useAuth();
  const { currentBaby, loadBabies } = useBaby();

  const [activeTab, setActiveTab] = useState<TabKey>('members');
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ── Identity ── */
  const currentUserId = useMemo(
    () => userProfile?.id || (userProfile as any)?.uid || profile?.id || '',
    [userProfile, profile],
  );
  const isMe = useCallback((m: any) => !!currentUserId && (m.id === currentUserId || m.userId === currentUserId), [currentUserId]);

  const isPrimaryParent = useMemo(() => {
    if (!currentUserId) return false;
    if (parent1 && isMe(parent1)) return true;
    return members.some((m) => m.role === UserRole.PARENT_1 && isMe(m));
  }, [parent1, members, currentUserId, isMe]);

  /* ── Derived ── */
  const hasCoParent = useMemo(() => members.some((m) => m.role === UserRole.PARENT_2) || !!parent2, [members, parent2]);
  const guardianCount = useMemo(() => members.filter((m) => m.role === UserRole.GUARDIAN).length, [members]);
  const pendingCount = useMemo(() => members.filter(isPendingMember).length, [members]);

  const dedupe = (list: FamilyMember[]) =>
    list.filter((m, i, arr) => i === arr.findIndex((x) => memberKey(x) === memberKey(m)));

  const primary = useMemo(() => dedupe(members.filter((m) => normalizeRole((m as any).role) === UserRole.PARENT_1)), [members]);
  const coParents = useMemo(() => dedupe(members.filter((m) => normalizeRole((m as any).role) === UserRole.PARENT_2)), [members]);
  const others = useMemo(() => dedupe(members.filter((m) => {
    const r = normalizeRole((m as any).role);
    return r === UserRole.GUARDIAN || r === UserRole.VIEWER;
  })), [members]);

  const transferCandidates = useMemo(
    () => members.filter((m) => m.role !== UserRole.PARENT_1 && !isMe(m) && !!m.lastActive),
    [members, isMe],
  );

  /* ── Data loading ── (defined BEFORE use — fixes the old TDZ crash) */
  const loadActiveCodes = useCallback(async () => {
    if (!currentBaby || !isPrimaryParent) { setActiveCodes([]); return; }
    try {
      const codes = await getActiveInviteCodes();
      setActiveCodes((codes || []).filter((c: any) => c.status === 'active' || c.status === 'partial'));
    } catch (e) {
      if (__DEV__) console.warn('[ManageFamily] loadActiveCodes failed', e);
    }
  }, [currentBaby, isPrimaryParent, getActiveInviteCodes]);

  useEffect(() => { loadActiveCodes(); }, [loadActiveCodes]);

  // Fresh data every time the screen regains focus (e.g. after EditGuardian).
  useFocusEffect(
    useCallback(() => {
      loadFamily().catch(() => {});
    }, [loadFamily]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFamily(), loadActiveCodes()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadFamily, loadActiveCodes]);

  /* ── Actions ── */
  const openMember = useCallback((member: any) => {
    if (!memberKey(member)) {
      sweetAlert.toast('Cannot open', 'This member has no linked profile yet.', 'info');
      return;
    }
    triggerHaptic('light');
    nav.navigate('EditGuardian', memberEditParams(member));
  }, [nav, sweetAlert, triggerHaptic]);

  const goInvite = useCallback(() => nav.navigate('CoParentInviteScreen'), [nav]);
  const goDirectAdd = useCallback(() => nav.navigate('CoParentInviteScreen', { initialMode: 'direct' }), [nav]);
  const goBack = useCallback(() => (navigation.canGoBack() ? navigation.goBack() : nav.navigate('Profile')), [navigation, nav]);

  const handleRevoke = useCallback((code: string) => {
    sweetAlert.confirm('Revoke invite', `Revoke code ${code}? It will stop working immediately.`, async () => {
      const ok = await revokeInviteCode(code);
      if (ok) { sweetAlert.toast('Revoked', 'Invite code revoked', 'success'); loadActiveCodes(); }
      else sweetAlert.alert('Error', 'Could not revoke this code. Try again.', 'warning');
    }, () => {}, 'Revoke', 'Cancel', true);
  }, [revokeInviteCode, loadActiveCodes, sweetAlert]);

  const handleShareCode = useCallback(async (code: any) => {
    const baby = currentBaby?.name ? `${currentBaby.name}'s family` : 'my family';
    const lines = [`Join ${baby} on LittleLoom!`, `Invite code: ${code.code}`];
    if (code.status === 'partial') lines.unshift("You started signing up but didn't finish — pick up where you left off.");
    lines.push(`https://littleloom.app/join?code=${code.code}`);
    try { await Share.share({ message: lines.join('\n') }); } catch {}
  }, [currentBaby]);

  const confirmTransfer = useCallback((target: FamilyMember) => {
    setShowTransfer(false);
    sweetAlert.confirm(
      'Transfer ownership?',
      `${target.fullName} will become Primary Parent and you will become Co-Parent. This changes who controls the family.`,
      async () => {
        setBusy(true);
        try {
          const res = await transferOwnership(target.id);
          if (res.success) { sweetAlert.success('Ownership transferred', res.message); await loadFamily(); }
          else sweetAlert.error('Transfer failed', res.message);
        } finally { setBusy(false); }
      },
      () => {}, 'Transfer', 'Cancel', true,
    );
  }, [sweetAlert, transferOwnership, loadFamily]);

  const startTransfer = useCallback(() => {
    if (transferCandidates.length === 0) {
      sweetAlert.alert('No eligible members', 'Invite another parent or guardian and wait until they join before transferring ownership.', 'warning');
      return;
    }
    setShowTransfer(true);
  }, [transferCandidates.length, sweetAlert]);

  const handleLeave = useCallback(() => {
    if (!currentBaby?.id || !currentUserId) return;
    if (isPrimaryParent) {
      sweetAlert.alert(
        'Transfer ownership first',
        'You are the Primary Parent. Hand ownership to another member before leaving so the family is not left without an owner.',
        'warning',
      );
      return;
    }
    sweetAlert.confirm(
      'Leave this family?',
      `You will lose access to ${currentBaby.name ? `${currentBaby.name}'s` : "this family's"} data unless you are invited again.`,
      async () => {
        setBusy(true);
        try {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('family_members')
            .update({ deleted_at: now, updated_at: now })
            .eq('baby_id', currentBaby.id)
            .eq('user_id', currentUserId)
            .is('deleted_at', null);
          if (error) throw error;
          try {
            await supabase.from('babies').update({ parent2_id: null, updated_at: now })
              .eq('id', currentBaby.id).eq('parent2_id', currentUserId);
          } catch {}
          await Promise.all([loadBabies(true), loadFamily()]);
          sweetAlert.toast('Left family', 'You have been removed from this family.', 'info');
          goBack();
        } catch (e: any) {
          sweetAlert.alert('Could not leave', e?.message || 'Something went wrong. Please try again.', 'error');
        } finally { setBusy(false); }
      },
      () => {}, 'Leave', 'Stay', true,
    );
  }, [currentBaby, currentUserId, isPrimaryParent, sweetAlert, loadBabies, loadFamily, goBack]);

  /* ── Render pieces ── */
  const renderGroup = (title: string, data: FamilyMember[], emptyTitle?: string, emptyText?: string) => {
    if (data.length === 0 && !emptyTitle) return null;
    return (
      <View style={{ marginBottom: DS.space.lg }}>
        <SectionHeader
          isDark={isDark}
          title={title}
          subtitle={`${data.length} ${data.length === 1 ? 'person' : 'people'}`}
          icon="people-outline"
        />
        {data.length === 0 ? (
          <EmptyState
            isDark={isDark}
            icon="person-add-outline"
            title={emptyTitle!}
            text={isPrimaryParent ? emptyText : 'Only the Primary Parent can add people.'}
            ctaLabel={isPrimaryParent ? 'Invite' : undefined}
            onCta={isPrimaryParent ? goInvite : undefined}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {data.map((m, i) => (
              <MemberCard key={`${m.id}_${m.role}`} member={m} index={i} isDark={isDark} isYou={isMe(m)} onPress={() => openMember(m)} />
            ))}
          </View>
        )}
      </View>
    );
  };

  const tabs = [
    { key: 'members' as TabKey, label: 'Members', icon: 'people-outline' as IconName, badge: pendingCount },
    { key: 'tree' as TabKey, label: 'Tree', icon: 'git-network-outline' as IconName },
    { key: 'access' as TabKey, label: 'Access', icon: 'shield-checkmark-outline' as IconName },
  ];

  /* ── Render ── */
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={t.screenGradient} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        isDark={isDark}
        title="Manage Family"
        subtitle={`${currentBaby?.name ? `${currentBaby.name} · ` : ''}${members.length} member${members.length === 1 ? '' : 's'}`}
        onBack={goBack}
        right={
          <>
            <HeaderButton icon="chatbubbles-outline" onPress={() => nav.navigate('FamilyChatList')} isDark={isDark} color={DS.accent} label="Family chat" />
            {isPrimaryParent ? <HeaderButton icon="person-add" onPress={goInvite} isDark={isDark} filled label="Invite" /> : null}
          </>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
      >
        <Summary isDark={isDark} members={members.length} hasCoParent={hasCoParent} guardianCount={guardianCount} pendingCount={pendingCount} />

        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} isDark={isDark} />
        </View>

        {/* ══════════ MEMBERS ══════════ */}
        {activeTab === 'members' && (
          <View style={{ paddingTop: DS.space.lg }}>
            {isPrimaryParent ? (
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DS.space.lg, marginBottom: DS.space.lg }}>
                <PressableScale onPress={goInvite} activeScale={0.96} haptic="medium" style={{ flex: 1 }}>
                  <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addTile}>
                    <Ionicons name="key-outline" size={20} color={DS.white} />
                    <Text style={s.addTileTitle}>Invite with code</Text>
                    <Text style={s.addTileSub}>For people not on LittleLoom</Text>
                  </LinearGradient>
                </PressableScale>
                <PressableScale onPress={goDirectAdd} activeScale={0.96} haptic="medium" style={{ flex: 1 }}>
                  <LinearGradient colors={[DS.success, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addTile}>
                    <Ionicons name="person-add-outline" size={20} color={DS.white} />
                    <Text style={s.addTileTitle}>Add existing user</Text>
                    <Text style={s.addTileSub}>@username, email or phone</Text>
                  </LinearGradient>
                </PressableScale>
              </View>
            ) : null}

            <View style={{ paddingHorizontal: DS.space.lg }}>
              {renderGroup('Primary Parent', primary)}
              {renderGroup('Co-Parent', coParents, 'No co-parent yet', 'Invite your partner so you can both track and share.')}
              {renderGroup('Guardians & Viewers', others, 'No guardians or viewers', 'Grandparents, nannies and friends can help log or just follow along.')}
            </View>

            {isPrimaryParent && activeCodes.length > 0 ? (
              <View style={{ marginBottom: DS.space.lg }}>
                <SectionHeader
                  isDark={isDark}
                  title="Pending invite codes"
                  subtitle={`${activeCodes.filter((c) => c.status === 'active').length} waiting · ${activeCodes.filter((c) => c.status === 'partial').length} unfinished`}
                  icon="key-outline"
                  color={DS.warning}
                  action={loadActiveCodes}
                  actionLabel="Refresh"
                />
                <View style={{ gap: 8, paddingHorizontal: DS.space.lg }}>
                  {activeCodes.map((code, i) => {
                    const st = INVITE_STATUS[code.status] || INVITE_STATUS.active;
                    const partial = code.status === 'partial';
                    return (
                      <Animated.View
                        key={`${code.code}_${i}`}
                        entering={FadeInUp.delay(Math.min(i, 6) * 50).springify()}
                        style={[s.inviteCard, { backgroundColor: t.card, borderColor: partial ? `${DS.warning}50` : t.border }]}
                      >
                        <View style={[s.rowIcon, { backgroundColor: partial ? `${DS.warning}18` : `${DS.primary}18` }]}>
                          <Ionicons name="key-outline" size={20} color={partial ? DS.warning : DS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[s.inviteCode, { color: t.title }]} numberOfLines={1}>{code.code}</Text>
                            <View style={[s.inviteStatus, { backgroundColor: `${st.color}1c` }]}>
                              <Ionicons name={st.icon} size={10} color={st.color} />
                              <Text style={[s.inviteStatusText, { color: st.color }]}>{st.label}</Text>
                            </View>
                          </View>
                          <Text style={[s.inviteMeta, { color: t.muted }]} numberOfLines={1}>
                            {getRoleCfg(code.role).label}{code.used_by_name ? ` · ${code.used_by_name}` : ''}
                          </Text>
                          {code.used_by_email ? <Text style={[s.inviteMeta, { color: t.muted }]} numberOfLines={1}>{code.used_by_email}</Text> : null}
                          {partial ? <Text style={[s.inviteMeta, { color: DS.warning }]}>Didn't finish registration</Text> : null}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <PressableScale onPress={() => handleShareCode(code)} activeScale={0.9}>
                            <View style={[s.inviteAction, { backgroundColor: `${DS.primary}18` }]}>
                              <Ionicons name="share-outline" size={16} color={DS.primary} />
                            </View>
                          </PressableScale>
                          {code.status === 'active' ? (
                            <PressableScale onPress={() => handleRevoke(code.code)} activeScale={0.9}>
                              <View style={[s.inviteAction, { backgroundColor: `${DS.danger}18` }]}>
                                <Ionicons name="close" size={16} color={DS.danger} />
                              </View>
                            </PressableScale>
                          ) : null}
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* ══════════ TREE ══════════ */}
        {activeTab === 'tree' && (
          <View style={{ paddingTop: DS.space.lg }}>
            <FamilyTree
              members={members}
              currentBaby={currentBaby}
              isDark={isDark}
              onManage={() => setActiveTab('members')}
              onMemberPress={openMember}
              onAddCoParent={goInvite}
              onAddGuardian={goInvite}
            />
          </View>
        )}

        {/* ══════════ ACCESS ══════════ */}
        {activeTab === 'access' && (
          <View style={{ paddingTop: DS.space.lg, paddingHorizontal: DS.space.lg, gap: DS.space.lg }}>
            <View style={{ marginHorizontal: -DS.space.lg }}>
              <SectionHeader
                isDark={isDark}
                title="Roles & permissions"
                subtitle={isPrimaryParent ? 'Tap a member to change their role' : 'Only the Primary Parent can change roles'}
                icon="shield-checkmark-outline"
                color={DS.warning}
              />
            </View>

            <View style={{ gap: 10, marginTop: -DS.space.sm }}>
              {members.map((m, idx) => {
                const role = normalizeRole((m as any).role) as UserRole;
                const cfg = getRoleCfg(role);
                const perms = ROLE_PERMISSION_MAP[role] || NONE;
                const chips = (Object.keys(PERMISSION_META) as PermissionKey[]).filter((k) => perms[k]);
                const you = isMe(m);
                const tappable = you || (isPrimaryParent && role !== UserRole.PARENT_1);
                return (
                  <Animated.View key={`${m.id}_${idx}`} entering={FadeInUp.delay(Math.min(idx, 6) * 40).springify()}>
                    <PressableScale onPress={() => tappable && openMember(m)} activeScale={tappable ? 0.98 : 1}>
                      <View style={[s.permCard, { backgroundColor: t.card, borderColor: t.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                          <SafeAvatar avatar={m.avatar} size={42} fallbackColor={cfg.color} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[s.memberName, { color: t.title }]} numberOfLines={1}>{m.fullName}</Text>
                              {you ? (
                                <View style={[s.youBadge, { backgroundColor: `${DS.primary}1c` }]}>
                                  <Text style={[s.youText, { color: DS.primary }]}>You</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={[s.rowSub, { color: cfg.color, fontWeight: '700' }]}>
                              {getMemberDisplayLabel({ role: m.role, relationship: m.relationship })}
                            </Text>
                          </View>
                          {tappable ? <Ionicons name="chevron-forward" size={16} color={t.faint} /> : null}
                        </View>
                        <Text style={[s.permDesc, { color: t.muted }]}>{ROLE_DESCRIPTION[role]}</Text>
                        <View style={s.permChips}>
                          {chips.map((k) => {
                            const meta = PERMISSION_META[k];
                            return (
                              <View key={k} style={[s.permChip, { backgroundColor: `${meta.color}18` }]}>
                                <Ionicons name={meta.icon} size={10} color={meta.color} />
                                <Text style={[s.permChipText, { color: meta.color }]}>{meta.label}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>

            <View>
              <View style={{ marginHorizontal: -DS.space.lg }}>
                <SectionHeader isDark={isDark} title="Family tools" subtitle="Apply to the whole family" icon="construct-outline" color={DS.info} />
              </View>
              <View style={{ gap: 10 }}>
                <ActionRow isDark={isDark} icon="cloud-upload-outline" color={DS.success} title="Export & backup" subtitle="Back up and restore family records" onPress={() => nav.navigate('BackupRestore')} />
                <ActionRow isDark={isDark} icon="notifications-outline" color={DS.info} title="Notifications & reminders" subtitle="Alerts for family activity" onPress={() => nav.navigate('TrackerReminders')} />
              </View>
            </View>

            <View>
              <View style={{ marginHorizontal: -DS.space.lg }}>
                <SectionHeader isDark={isDark} title="Ownership" icon="warning-outline" color={DS.danger} />
              </View>
              <View style={{ gap: 10 }}>
                {isPrimaryParent ? (
                  <ActionRow isDark={isDark} icon="swap-horizontal-outline" color={DS.warning} title="Transfer ownership" subtitle="Hand Primary Parent to another member" onPress={startTransfer} />
                ) : null}
                <ActionRow
                  isDark={isDark}
                  icon="exit-outline"
                  color={DS.danger}
                  destructive
                  title="Leave family"
                  subtitle={isPrimaryParent ? 'Transfer ownership first, then you can leave' : 'Remove yourself from this family'}
                  onPress={handleLeave}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Transfer ownership picker */}
      <SheetModal
        visible={showTransfer}
        onClose={() => setShowTransfer(false)}
        title="Choose new Primary Parent"
        subtitle="Only members who have joined are listed"
        isDark={isDark}
      >
        <View style={{ gap: 8 }}>
          {transferCandidates.map((m) => {
            const cfg = getRoleCfg(m.role);
            return (
              <PressableScale key={m.id} onPress={() => confirmTransfer(m)} activeScale={0.98}>
                <View style={[s.row, { backgroundColor: t.chip, borderColor: t.border }]}>
                  <SafeAvatar avatar={m.avatar} size={42} fallbackColor={cfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: t.title }]}>{m.fullName}</Text>
                    <Text style={[s.rowSub, { color: t.muted }]}>
                      {getMemberDisplayLabel({ role: m.role, relationship: m.relationship })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.faint} />
                </View>
              </PressableScale>
            );
          })}
        </View>
      </SheetModal>

      {busy ? (
        <View style={s.busy} pointerEvents="auto">
          <ActivityIndicator size="large" color={DS.white} />
        </View>
      ) : null}
    </View>
  );
}

/* ═══════════════════════════ Styles ═══════════════════════════ */
const s = StyleSheet.create({
  vDiv: { width: 1, height: 30 },
  sumVal: { fontSize: 21, fontWeight: '800' },
  sumLbl: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  addTile: { padding: DS.space.md, borderRadius: DS.radius.md, gap: 3, minHeight: 92, justifyContent: 'center', ...DS.shadow.md },
  addTileTitle: { color: DS.white, fontSize: 14, fontWeight: '800', marginTop: 4 },
  addTileSub: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },

  memberCard: { borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  memberStrip: { height: 3, width: '100%' },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: DS.space.md },
  onlineDot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: DS.success, borderWidth: 2 },
  memberName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800' },
  memberRel: { fontSize: 11, fontWeight: '500', flexShrink: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },
  youBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  youText: { fontSize: 9, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  inviteCode: { fontSize: 13, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inviteStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  inviteStatusText: { fontSize: 9, fontWeight: '700' },
  inviteMeta: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  inviteAction: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  permCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8 },
  permDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16 },
  permChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  permChipText: { fontSize: 10, fontWeight: '600' },

  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
});
