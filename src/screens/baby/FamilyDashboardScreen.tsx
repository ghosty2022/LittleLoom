/**
 * FamilyDashboardScreen  →  "Family Overview"   (route: 'Profile')
 *
 * PURPOSE: a quick, READ-ONLY snapshot of how the family is doing.
 *   ✅ Who is in the family, how engaged they are, what happened today
 *   ✅ Active baby card (switch / edit baby)
 *   ✅ Growth summary
 *   ❌ No member management, roles, invites, backup, leaving  → "Manage Family"
 *
 * One "Manage" button in the header is the only bridge to FamilySharing.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { differenceInMonths, format, formatDistanceToNow } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { useSweetAlert } from '../../components/SweetAlert';
import FamilyStack from '../../components/FamilyStack';
import {
  Card,
  DS,
  EmptyState,
  HEADER_TOTAL_HEIGHT,
  HeaderButton,
  IconName,
  PressableScale,
  SafeAvatar,
  ScreenHeader,
  SectionHeader,
  SheetModal,
  TabBar,
  formatRelative,
  isActiveWithin,
  isPendingMember,
  memberEditParams,
  theme,
} from '../../components/FamilyUI';
import { UserRole } from '../../types/roles';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type TabKey = 'overview' | 'growth';

const ACTIVITY_ICONS: Record<string, string> = {
  feed: '🍼', sleep: '😴', potty: '🚽', diaper: '🧷',
  growth: '📏', medication: '💊', milestone: '🏆', note: '📝',
};

/* ═══════════════════════════ Baby card ═══════════════════════════ */
const BabyCard = memo(({ isDark, baby, streak, canSwitch, onSwitch, onEdit, onGrowth, onAdd }: {
  isDark: boolean; baby: any; streak: number; canSwitch: boolean;
  onSwitch: () => void; onEdit: () => void; onGrowth: () => void; onAdd: () => void;
}) => {
  const t = theme(isDark);
  if (!baby) {
    return (
      <EmptyState
        isDark={isDark}
        icon="happy-outline"
        title="Add your baby"
        text="Create a baby profile to start tracking and sharing with your family."
        ctaLabel="Create baby profile"
        onCta={onAdd}
      />
    );
  }
  const birth = baby.birthDate || baby.dateOfBirth;
  const age = baby.age || (birth ? formatDistanceToNow(new Date(birth)) : '');
  const gender = baby.gender ? String(baby.gender).charAt(0).toUpperCase() + String(baby.gender).slice(1) : '';

  return (
    <Card isDark={isDark} tint={DS.accent}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={60} />
        <View style={{ flex: 1, marginLeft: DS.space.md }}>
          <TouchableOpacity
            disabled={!canSwitch}
            onPress={onSwitch}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={[s.babyName, { color: t.title }]} numberOfLines={1}>{baby.name}</Text>
            {canSwitch ? <Ionicons name="chevron-down" size={16} color={t.muted} /> : null}
          </TouchableOpacity>
          <Text style={[s.babyMeta, { color: t.muted }]} numberOfLines={1}>
            {[age, gender].filter(Boolean).join(' • ')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {streak > 0 ? (
              <View style={[s.tag, { backgroundColor: `${DS.accent}18` }]}>
                <Ionicons name="flame" size={11} color={DS.accent} />
                <Text style={[s.tagText, { color: DS.accent }]}>{streak}d streak</Text>
              </View>
            ) : null}
            <PressableScale onPress={onGrowth} activeScale={0.94}>
              <View style={[s.tag, { backgroundColor: `${DS.success}18` }]}>
                <Ionicons name="trending-up" size={11} color={DS.success} />
                <Text style={[s.tagText, { color: DS.success }]}>Growth</Text>
              </View>
            </PressableScale>
          </View>
        </View>
        <HeaderButton icon="create-outline" onPress={onEdit} isDark={isDark} color={DS.primary} label="Edit baby profile" />
      </View>
    </Card>
  );
});

/* ═══════════════════════════ Snapshot strip ═══════════════════════════ */
const Snapshot = memo(({ isDark, items }: {
  isDark: boolean; items: { label: string; value: number; color: string }[];
}) => {
  const t = theme(isDark);
  return (
    <Animated.View entering={FadeInUp.delay(40).springify()}>
      <Card isDark={isDark} tint={DS.primary} style={{ paddingVertical: DS.space.md, flexDirection: 'row', alignItems: 'center' }}>
        {items.map((it, i) => (
          <React.Fragment key={it.label}>
            {i > 0 ? <View style={[s.vDiv, { backgroundColor: t.border }]} /> : null}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.snapVal, { color: it.color }]}>{it.value}</Text>
              <Text style={[s.snapLbl, { color: t.muted }]}>{it.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </Card>
    </Animated.View>
  );
});

/* ═══════════════════════════ Engagement ═══════════════════════════ */
const Engagement = memo(({ isDark, members }: { isDark: boolean; members: any[] }) => {
  const t = theme(isDark);
  const DAY = 86400000;
  const stats = useMemo(() => {
    const total = members.length || 1;
    const today = members.filter((m) => isActiveWithin(m, DAY)).length;
    const week = members.filter((m) => isActiveWithin(m, 7 * DAY)).length;
    const pending = members.filter(isPendingMember).length;
    const score = Math.round(Math.round((week / total) * 100) * 0.6 + Math.min(100, members.length * 15) * 0.4);
    return { today, week, pending, score };
  }, [members]);

  const color = stats.score >= 80 ? DS.success : stats.score >= 50 ? DS.warning : DS.danger;
  const label = stats.score >= 80 ? 'Thriving' : stats.score >= 50 ? 'Active' : 'Needs attention';

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <SectionHeader isDark={isDark} title="Family Engagement" subtitle="How involved everyone has been" icon="heart-circle-outline" color={color} />
      <Card isDark={isDark} tint={color}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            <Text style={[s.scoreVal, { color }]}>{stats.score}</Text>
            <Text style={[s.scoreMax, { color: t.faint }]}>/100</Text>
          </View>
          <View style={[s.scorePill, { backgroundColor: `${color}1c` }]}>
            <Text style={[s.scorePillText, { color }]}>{label}</Text>
          </View>
        </View>
        <View style={[s.barBg, { backgroundColor: `${color}1c` }]}>
          <View style={[s.barFill, { width: `${Math.max(4, stats.score)}%`, backgroundColor: color }]} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: DS.space.md }}>
          {[
            { l: 'Active today', v: stats.today, c: DS.success },
            { l: 'This week', v: stats.week, c: DS.warning },
            { l: 'Pending invites', v: stats.pending, c: stats.pending ? DS.danger : t.faint },
          ].map((x) => (
            <View key={x.l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.miniVal, { color: x.c }]}>{x.v}</Text>
              <Text style={[s.miniLbl, { color: t.muted }]}>{x.l}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
});

/* ═══════════════════════════ Today at a glance ═══════════════════════════ */
interface GlanceStat { key: string; icon: string; label: string; count: number; color: string }

const TodayGlance = memo(({ isDark, stats, onPress }: {
  isDark: boolean; stats: GlanceStat[]; onPress: (key: string) => void;
}) => {
  const t = theme(isDark);
  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <SectionHeader isDark={isDark} title="Today at a Glance" subtitle={format(new Date(), 'EEEE, MMM d')} icon="today-outline" color={DS.info} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {stats.map((st) => (
          <PressableScale key={st.key} onPress={() => onPress(st.key)} activeScale={0.94}>
            <View style={[s.glanceCard, { backgroundColor: t.card, borderColor: isDark ? t.border : `${st.color}30` }]}>
              <LinearGradient colors={[`${st.color}12`, `${st.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[s.glanceIconBg, { backgroundColor: `${st.color}1c` }]}>
                <Text style={{ fontSize: 20 }}>{st.icon}</Text>
              </View>
              <Text style={[s.glanceCount, { color: st.color }]}>{st.count}</Text>
              <Text style={[s.glanceLabel, { color: t.muted }]}>{st.label}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════ Family activity (who + what) ═══════════════════════════ */
interface Contributor { id: string; name: string; avatar?: string; count: number }
interface FeedEvent { id: string; type: string; title: string; timestamp: number; actorName: string }

const FamilyActivity = memo(({ isDark, contributors, events, onSeeAll, onLog }: {
  isDark: boolean; contributors: Contributor[]; events: FeedEvent[]; onSeeAll: () => void; onLog: () => void;
}) => {
  const t = theme(isDark);
  if (events.length === 0) {
    return (
      <Animated.View entering={FadeInUp.delay(160).springify()}>
        <SectionHeader isDark={isDark} title="Family Activity" icon="pulse-outline" color={DS.success} />
        <EmptyState
          isDark={isDark}
          icon="time-outline"
          color={DS.success}
          title="Nothing logged yet"
          text="Entries from everyone in the family will show up here."
          ctaLabel="Log first entry"
          onCta={onLog}
        />
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <SectionHeader
        isDark={isDark}
        title="Family Activity"
        subtitle={contributors.length ? `${contributors.length} logging today` : 'Latest entries'}
        icon="pulse-outline"
        color={DS.success}
        action={onSeeAll}
        actionLabel="Timeline"
      />
      <Card isDark={isDark} style={{ padding: 0 }}>
        {contributors.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.contribRow}>
            {contributors.map((c) => (
              <View key={c.id} style={[s.contribChip, { backgroundColor: t.chip }]}>
                <SafeAvatar avatar={c.avatar} size={24} />
                <Text style={[s.contribName, { color: t.title }]} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                <View style={[s.contribCount, { backgroundColor: `${DS.primary}20` }]}>
                  <Text style={[s.contribCountText, { color: DS.primary }]}>{c.count}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {events.map((e, i) => (
          <View
            key={e.id}
            style={[
              s.feedRow,
              (i > 0 || contributors.length > 0) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
            ]}
          >
            <View style={[s.feedIcon, { backgroundColor: t.chip }]}>
              <Text style={{ fontSize: 16 }}>{ACTIVITY_ICONS[e.type] || '📝'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.feedTitle, { color: t.title }]} numberOfLines={1}>{e.title}</Text>
              <Text style={[s.feedMeta, { color: t.muted }]} numberOfLines={1}>
                by {e.actorName} · {formatRelative(e.timestamp)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Animated.View>
  );
});

/* ═══════════════════════════ Suggestion ═══════════════════════════ */
interface Suggestion { icon: string; title: string; description: string; color: string; actionLabel: string; target: string }

const SuggestionCard = memo(({ isDark, suggestion, onAction }: {
  isDark: boolean; suggestion: Suggestion; onAction: () => void;
}) => {
  const t = theme(isDark);
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <Card isDark={isDark} tint={suggestion.color}>
        <View style={{ flexDirection: 'row', gap: DS.space.md }}>
          <LinearGradient colors={[suggestion.color, `${suggestion.color}aa`]} style={s.sugIcon}>
            <Text style={{ fontSize: 24 }}>{suggestion.icon}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[s.sugKicker, { color: suggestion.color }]}>TIP FOR TODAY</Text>
            <Text style={[s.sugTitle, { color: t.title }]} numberOfLines={2}>{suggestion.title}</Text>
            <Text style={[s.sugDesc, { color: t.muted }]} numberOfLines={3}>{suggestion.description}</Text>
          </View>
        </View>
        <PressableScale onPress={onAction} activeScale={0.96}>
          <View style={[s.sugBtn, { backgroundColor: `${suggestion.color}18` }]}>
            <Text style={[s.sugBtnText, { color: suggestion.color }]}>{suggestion.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={suggestion.color} />
          </View>
        </PressableScale>
      </Card>
    </Animated.View>
  );
});

/* ═══════════════════════════ Explore links ═══════════════════════════ */
const Explore = memo(({ isDark, onNavigate }: { isDark: boolean; onNavigate: (screen: string) => void }) => {
  const t = theme(isDark);
  const links: { id: string; label: string; icon: IconName; color: string; screen: string }[] = [
    { id: 'timeline', label: 'Timeline', icon: 'time-outline', color: DS.success, screen: 'Timeline' },
    { id: 'milestones', label: 'Milestones', icon: 'trophy-outline', color: DS.warning, screen: 'Achievements' },
    { id: 'gallery', label: 'Gallery', icon: 'images-outline', color: DS.accent, screen: 'Gallery' },
    { id: 'insights', label: 'Insights', icon: 'bar-chart-outline', color: DS.primary, screen: 'Insights' },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <SectionHeader isDark={isDark} title="Explore" icon="compass-outline" color={DS.primary} />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DS.space.lg }}>
        {links.map((l) => (
          <PressableScale key={l.id} onPress={() => onNavigate(l.screen)} activeScale={0.94} style={{ flex: 1 }}>
            <View style={[s.exploreCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={[s.exploreIcon, { backgroundColor: `${l.color}1c` }]}>
                <Ionicons name={l.icon} size={20} color={l.color} />
              </View>
              <Text style={[s.exploreLabel, { color: t.body }]} numberOfLines={1}>{l.label}</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════ Growth tab ═══════════════════════════ */
const GrowthTab = memo(({ isDark, growthData, milestoneCount, onFullChart, onMilestones }: {
  isDark: boolean; growthData: any[]; milestoneCount: number; onFullChart: () => void; onMilestones: () => void;
}) => {
  const t = theme(isDark);
  const latest = (type: string) => {
    const rows = growthData.filter((g) => g.type === type);
    return rows[rows.length - 1];
  };
  const h = latest('height');
  const w = latest('weight');
  const items = [
    { icon: 'resize-outline' as IconName, color: '#667eea', value: h ? `${h.value}${h.unit || 'cm'}` : '--', label: 'Height' },
    { icon: 'scale-outline' as IconName, color: '#fa709a', value: w ? `${w.value}${w.unit || 'kg'}` : '--', label: 'Weight' },
    { icon: 'analytics-outline' as IconName, color: '#11998e', value: String(growthData.length), label: 'Records' },
  ];

  if (growthData.length === 0) {
    return (
      <View style={{ gap: 12 }}>
        <EmptyState
          isDark={isDark}
          icon="trending-up-outline"
          color={DS.success}
          title="No growth records yet"
          text="Add height and weight to see charts and percentiles."
          ctaLabel="Open growth charts"
          onCta={onFullChart}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Animated.View entering={FadeInUp.delay(60).springify()}>
        <Card isDark={isDark} tint={DS.primary}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {items.map((it) => (
              <View key={it.label} style={{ alignItems: 'center', gap: 6 }}>
                <View style={[s.growthIcon, { backgroundColor: `${it.color}1c` }]}>
                  <Ionicons name={it.icon} size={22} color={it.color} />
                </View>
                <Text style={[s.growthVal, { color: t.title }]} numberOfLines={1}>{it.value}</Text>
                <Text style={[s.growthLbl, { color: t.muted }]}>{it.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>

      <PressableScale onPress={onFullChart} activeScale={0.97} style={{ marginHorizontal: DS.space.lg }}>
        <LinearGradient colors={[DS.primary, DS.accent]} style={s.ctaPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="trending-up" size={20} color={DS.white} />
          <Text style={s.ctaPrimaryText}>Full growth charts</Text>
          <Ionicons name="arrow-forward" size={18} color={DS.white} />
        </LinearGradient>
      </PressableScale>

      <PressableScale onPress={onMilestones} activeScale={0.97} style={{ marginHorizontal: DS.space.lg }}>
        <View style={[s.ctaSecondary, { borderColor: `${DS.primary}35`, backgroundColor: `${DS.primary}0d` }]}>
          <Ionicons name="trophy-outline" size={20} color={DS.primary} />
          <Text style={[s.ctaSecondaryText, { color: DS.primary }]}>
            Milestones{milestoneCount ? ` (${milestoneCount})` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={DS.primary} />
        </View>
      </PressableScale>
    </View>
  );
});

/* ═══════════════════════════ MAIN SCREEN ═══════════════════════════ */
export default function FamilyDashboardScreen({ navigation }: Props) {
  const nav = navigation as any;
  const systemDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? systemDark;
  const t = theme(isDark);

  useAuth(); // keeps auth subscription alive for member resolution
  const { babies, currentBaby, currentBabyId, switchBaby, growthData, milestones, loadBabies, getPottyStreak } = useBaby();
  const { members, loadFamily } = useFamily();
  const { entries: trackerEntries } = useTracker();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showBabySelector, setShowBabySelector] = useState(false);

  /* ── Refresh ── */
  useFocusEffect(
    useCallback(() => {
      loadFamily().catch(() => {});
    }, [loadFamily]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadBabies(true), loadFamily()]);
    } catch {
      sweetAlert.toast('Refresh failed', 'Check your connection and try again.', 'info');
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadFamily, sweetAlert]);

  /* ── Navigation helpers ── */
  const go = useCallback((screen: string, params?: any) => nav.navigate(screen, params), [nav]);
  const editBaby = useCallback((id: string) => nav.navigate('EditProfile', { mode: 'baby', babyId: id }), [nav]);
  const openMember = useCallback((member: any) => {
    if (!(member?.userId || member?.id)) {
      sweetAlert.toast('Cannot open', 'This member has no linked profile yet.', 'info');
      return;
    }
    triggerHaptic('light');
    nav.navigate('EditGuardian', memberEditParams(member));
  }, [nav, sweetAlert, triggerHaptic]);

  /* ── Derived data (computed once, reused) ── */
  const todayEntries = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return (trackerEntries || []).filter((e: any) => e?.timestamp >= start.getTime() && !e.isDeleted);
  }, [trackerEntries]);

  const streak = useMemo(() => getPottyStreak(), [getPottyStreak]);

  const findActor = useCallback((e: any) =>
    members.find((m: any) => m.userId === e.loggedBy) ||
    members.find((m: any) => m.id === e.loggedBy) ||
    members.find((m: any) => m.fullName === e.loggedByName), [members]);

  const glanceStats = useMemo<GlanceStat[]>(() => {
    const count = (id: string) => todayEntries.filter((e: any) => e.trackerId === id).length;
    return [
      { key: 'feed', icon: '🍼', label: 'Feeds', count: count('feed'), color: '#f59e0b' },
      { key: 'sleep', icon: '😴', label: 'Sleeps', count: count('sleep'), color: '#8b5cf6' },
      { key: 'diaper', icon: '🧷', label: 'Diapers', count: count('diaper'), color: '#06b6d4' },
      { key: 'potty', icon: '🚽', label: 'Potty', count: count('potty'), color: '#10b981' },
      { key: 'medication', icon: '💊', label: 'Meds', count: count('medication'), color: '#ef4444' },
    ].filter((x) => x.count > 0 || ['feed', 'sleep', 'diaper'].includes(x.key));
  }, [todayEntries]);

  const contributors = useMemo<Contributor[]>(() => {
    const map = new Map<string, Contributor>();
    todayEntries.forEach((e: any) => {
      const key = e.loggedBy || e.loggedByName || 'unknown';
      const hit = map.get(key);
      if (hit) { hit.count += 1; return; }
      const actor: any = findActor(e);
      map.set(key, { id: key, name: actor?.fullName || e.loggedByName || 'Someone', avatar: actor?.avatar, count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [todayEntries, findActor]);

  const recentEvents = useMemo<FeedEvent[]>(() => {
    return (trackerEntries || [])
      .filter((e: any) => e?.timestamp && !e.isDeleted)
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map((e: any, i: number) => {
        const type = e.trackerId || e.type || 'note';
        const actor: any = findActor(e);
        return {
          id: e.id || `evt-${i}`,
          type,
          title: e.title || `${type.charAt(0).toUpperCase()}${type.slice(1)} logged`,
          timestamp: e.timestamp,
          actorName: actor?.fullName || e.loggedByName || 'Someone',
        };
      });
  }, [trackerEntries, findActor]);

  const suggestion = useMemo<Suggestion>(() => {
    if (currentBaby) {
      const birth = currentBaby.birthDate || currentBaby.dateOfBirth;
      if (birth) {
        const m = differenceInMonths(new Date(), new Date(birth));
        if (m >= 0 && m < 3) return { icon: '📸', title: 'Capture this stage', description: "Newborn weeks fly by — a quick photo today becomes tomorrow's treasure.", color: '#ec4899', actionLabel: 'Open gallery', target: 'Gallery' };
        if (m >= 4 && m <= 8) return { icon: '👶', title: 'Tummy time matters', description: `At ${m} months, aim for 3 short tummy-time sessions a day, then log them.`, color: '#10b981', actionLabel: 'Log an entry', target: 'AddEntry' };
        if (m >= 10 && m <= 14) return { icon: '🗣️', title: 'First words approaching', description: 'Narrate your day to encourage speech, and record the big moments.', color: '#f59e0b', actionLabel: 'See milestones', target: 'Achievements' };
      }
    }
    return { icon: '📊', title: 'Check your weekly insights', description: 'See patterns in feeding, sleep and growth this week.', color: DS.primary, actionLabel: 'View insights', target: 'Insights' };
  }, [currentBaby]);

  const ribbon = useMemo(() => {
    if (contributors.length > 1) return { icon: 'people-outline' as IconName, color: DS.success, label: 'Teamwork', text: `${contributors.length} family members logged today`, screen: 'Timeline' };
    if (streak > 0) return { icon: 'flame' as IconName, color: DS.warning, label: 'Streak', text: `${streak}-day tracking streak going strong`, screen: 'Achievements' };
    return null;
  }, [contributors.length, streak]);

  const familyStackMembers = useMemo(() => {
    if (!currentBaby) return members;
    return [
      {
        id: `baby_${currentBaby.id}`, userId: `baby_${currentBaby.id}`, babyId: currentBaby.id,
        role: 'baby' as any, fullName: currentBaby.name || 'Baby', email: '', avatar: currentBaby.avatar,
        relationship: 'Baby',
        permissions: { read: true, write: false, delete: false, manageFamily: false, manageSecurity: false, exportData: false },
        joinedAt: currentBaby.createdAt || new Date().toISOString(), isActive: true,
        __isBaby: true, __baby: currentBaby,
      } as any,
      ...members,
    ];
  }, [currentBaby, members]);

  const tabs = [
    { key: 'overview' as TabKey, label: 'Overview', icon: 'grid-outline' as IconName },
    { key: 'growth' as TabKey, label: 'Growth', icon: 'trending-up-outline' as IconName },
  ];

  /* ── Render ── */
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={t.screenGradient} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        isDark={isDark}
        title="Family Overview"
        subtitle={currentBaby?.name ? `${currentBaby.name}'s family · ${members.length} member${members.length === 1 ? '' : 's'}` : 'No baby yet'}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : go('Home'))}
        right={
          <PressableScale onPress={() => go('FamilySharing')} activeScale={0.94}>
            <View style={s.manageBtn}>
              <Ionicons name="settings-outline" size={15} color={DS.white} />
              <Text style={s.manageText}>Manage</Text>
            </View>
          </PressableScale>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
      >
        <BabyCard
          isDark={isDark}
          baby={currentBaby}
          streak={streak}
          canSwitch={babies.length > 1}
          onSwitch={() => setShowBabySelector(true)}
          onEdit={() => currentBaby && editBaby(currentBaby.id)}
          onGrowth={() => go('GrowthDashboard')}
          onAdd={() => go('CreateBabyProfile')}
        />

        {ribbon ? (
          <Animated.View entering={FadeInUp.delay(60).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <PressableScale onPress={() => go(ribbon.screen)} activeScale={0.98}>
              <View style={[s.ribbon, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={[s.ribbonIcon, { backgroundColor: `${ribbon.color}1c` }]}>
                  <Ionicons name={ribbon.icon} size={16} color={ribbon.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.ribbonLabel, { color: ribbon.color }]}>{ribbon.label}</Text>
                  <Text style={[s.ribbonText, { color: t.body }]} numberOfLines={1}>{ribbon.text}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.faint} />
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}

        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} isDark={isDark} />
        </View>

        {activeTab === 'overview' ? (
          <View style={{ paddingTop: DS.space.lg, gap: DS.space.lg }}>
            <Snapshot
              isDark={isDark}
              items={[
                { label: 'Members', value: members.length, color: DS.primary },
                { label: 'Babies', value: babies.length, color: DS.accent },
                { label: 'Logs today', value: todayEntries.length, color: DS.success },
                { label: 'Milestones', value: milestones.length, color: DS.warning },
              ]}
            />

            {members.length > 0 ? <Engagement isDark={isDark} members={members} /> : null}

            <TodayGlance isDark={isDark} stats={glanceStats} onPress={(key) => { triggerHaptic('light'); go('Timeline', { trackerId: key, filter: 'today' }); }} />

            <FamilyActivity
              isDark={isDark}
              contributors={contributors}
              events={recentEvents}
              onSeeAll={() => go('Timeline')}
              onLog={() => go('AddEntry')}
            />

            <SuggestionCard
              isDark={isDark}
              suggestion={suggestion}
              onAction={() => { triggerHaptic('medium'); go(suggestion.target); }}
            />

            <Animated.View entering={FadeInUp.delay(240).springify()}>
              <SectionHeader
                isDark={isDark}
                title="Your Family"
                subtitle={`${members.length} member${members.length === 1 ? '' : 's'} · tap anyone to open their profile`}
                icon="people-outline"
                color={DS.primary}
              />
              <FamilyStack
                members={familyStackMembers}
                isDark={isDark}
                onPress={() => go('FamilySharing')}
                onMemberPress={(m: any) => {
                  if (m?.__isBaby || String(m?.id || '').startsWith('baby_')) {
                    const baby = m?.__baby || currentBaby;
                    if (baby?.id) editBaby(baby.id);
                    return;
                  }
                  openMember(m);
                }}
              />
            </Animated.View>

            <Explore isDark={isDark} onNavigate={(screen) => go(screen)} />
          </View>
        ) : (
          <View style={{ paddingTop: DS.space.lg }}>
            <GrowthTab
              isDark={isDark}
              growthData={growthData}
              milestoneCount={milestones.length}
              onFullChart={() => go('GrowthDashboard')}
              onMilestones={() => go('Achievements')}
            />
          </View>
        )}
      </ScrollView>

      {/* Floating quick-log button */}
      <PressableScale
        onPress={() => go('AddEntry')}
        activeScale={0.92}
        haptic="medium"
        style={[s.fab, { bottom: insets.bottom + 24 }]}
      >
        <LinearGradient colors={[DS.primary, DS.accent]} style={s.fabInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={22} color={DS.white} />
          <Text style={s.fabText}>Log entry</Text>
        </LinearGradient>
      </PressableScale>

      {/* Baby switcher */}
      <SheetModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Switch baby"
        subtitle="Everything on this screen follows the selected baby"
        isDark={isDark}
      >
        <View style={{ gap: 8 }}>
          {babies.map((baby: any) => {
            const active = baby.id === currentBabyId || baby.id === currentBaby?.id;
            const birth = baby.birthDate || baby.dateOfBirth;
            return (
              <PressableScale
                key={baby.id}
                onPress={() => {
                  if (!active) { triggerHaptic('light'); switchBaby(baby.id); }
                  setShowBabySelector(false);
                }}
                activeScale={0.98}
              >
                <View style={[s.babyOption, {
                  backgroundColor: active ? `${DS.primary}12` : t.chip,
                  borderColor: active ? DS.primary : t.border,
                  borderWidth: active ? 2 : 1,
                }]}>
                  <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.babyOptionName, { color: t.title }]}>{baby.name}</Text>
                    <Text style={[s.babyOptionMeta, { color: t.muted }]}>
                      {birth ? new Date(birth).toLocaleDateString() : 'Baby'}{baby.gender ? ` • ${baby.gender}` : ''}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={DS.primary} /> : null}
                </View>
              </PressableScale>
            );
          })}
          <PressableScale onPress={() => { setShowBabySelector(false); go('CreateBabyProfile'); }} activeScale={0.98}>
            <View style={[s.babyOption, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.border }]}>
              <View style={[s.addBabyIcon, { backgroundColor: `${DS.primary}18` }]}>
                <Ionicons name="add" size={22} color={DS.primary} />
              </View>
              <Text style={[s.babyOptionName, { color: DS.primary }]}>Add new baby</Text>
            </View>
          </PressableScale>
        </View>
      </SheetModal>
    </View>
  );
}

/* ═══════════════════════════ Styles ═══════════════════════════ */
const s = StyleSheet.create({
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DS.primary, paddingHorizontal: 12, height: 36, borderRadius: 18 },
  manageText: { color: DS.white, fontSize: 12, fontWeight: '800' },

  babyName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  babyMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  vDiv: { width: 1, height: 28 },
  snapVal: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  snapLbl: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  scoreVal: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  scoreMax: { fontSize: 13, fontWeight: '600' },
  scorePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
  scorePillText: { fontSize: 11, fontWeight: '800' },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: DS.space.sm },
  barFill: { height: '100%', borderRadius: 4 },
  miniVal: { fontSize: 17, fontWeight: '800' },
  miniLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },

  glanceCard: { width: 96, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 4, overflow: 'hidden' },
  glanceIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  glanceCount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  glanceLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  contribRow: { paddingHorizontal: DS.space.md, paddingVertical: DS.space.md, gap: 8 },
  contribChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 8, paddingVertical: 5, borderRadius: DS.radius.full },
  contribName: { fontSize: 12, fontWeight: '700', maxWidth: 80 },
  contribCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  contribCountText: { fontSize: 10, fontWeight: '800' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  feedIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  feedTitle: { fontSize: 13, fontWeight: '700' },
  feedMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  sugIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sugKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 3 },
  sugTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  sugDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  sugBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, marginTop: DS.space.md },
  sugBtnText: { fontSize: 12, fontWeight: '700' },

  exploreCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 6 },
  exploreIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exploreLabel: { fontSize: 11, fontWeight: '700' },

  growthIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  growthVal: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  growthLbl: { fontSize: 11, fontWeight: '600' },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: DS.radius.md, gap: 10 },
  ctaPrimaryText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  ctaSecondary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: DS.radius.md, borderWidth: 1 },
  ctaSecondaryText: { flex: 1, fontSize: 14, fontWeight: '700' },

  fab: { position: 'absolute', right: DS.space.lg, borderRadius: 28, ...DS.shadow.lg },
  fabInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 18, height: 52, borderRadius: 26 },
  fabText: { color: DS.white, fontSize: 14, fontWeight: '800' },

  babyOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: DS.radius.md, gap: DS.space.md },
  babyOptionName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  babyOptionMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  addBabyIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
