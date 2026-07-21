// EntryDetailScreen.tsx — INTELLIGENCE EDITION v6.0
// Unified with Timeline + GrowthDashboard aesthetics
// No card shadows, glass surfaces, KPIs, trend sparklines, audit intelligence

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import {
  format,
  isToday,
  isYesterday,
  isSameDay,
  formatDistanceToNow,
  differenceInHours,
  differenceInDays,
  differenceInMonths,
  parseISO,
  isValid,
} from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useCustomization } from '@/hooks/useCustomization';
import { useUnifiedTrackerTheme } from '@/hooks/useUnifiedTrackerTheme';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';
import { SafeAvatar } from '@/components/SafeAvatar';
import { useSweetAlert } from '@/components/SweetAlert';

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified with Timeline + GrowthDashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    none: { shadowOpacity: 0, elevation: 0 },
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  },
};

const SKIP_KEYS = new Set([
  'id', 'timestamp', 'babyId', 'type', 'title', 'icon',
  'photoUris', 'photos', 'photo', 'notes', 'tags', 'location', 'syncedAt',
  'loggedBy', 'loggedByName', 'loggedByRole', 'editedAt', 'editedBy', 'editedByName',
]);

const ROLE_META: Record<string, { label: string; color: string }> = {
  parent1: { label: 'Primary Parent', color: '#667eea' },
  parent2: { label: 'Co-Parent', color: '#fa709a' },
  guardian: { label: 'Guardian', color: '#11998e' },
  viewer: { label: 'Viewer', color: '#64748b' },
  admin: { label: 'Admin', color: '#f59e0b' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const safeNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
};

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT HISTORY
   ═══════════════════════════════════════════════════════════════════════════ */

const EDIT_HISTORY_KEY = '@littleloom_edit_history_v1';

interface EntryEditVersion {
  editedAt: number;
  editedBy?: string;
  editedByName: string;
  prevTitle?: string;
  prevNotes?: string;
  prevTimestamp: number;
  prevData?: Record<string, unknown>;
  prevPhotoUris?: string[];
  prevTags?: string[];
}

const versionValueText = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '—';
  if (typeof v === 'object') {
    const o = v as any;
    if (o?.name) return String(o.name);
    if (o?.label) return String(o.label);
    return JSON.stringify(v);
  }
  return String(v);
};

/* ═══════════════════════════════════════════════════════════════════════════
   VALUE INTELLIGENCE
   ═══════════════════════════════════════════════════════════════════════════ */

type FieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'bool'; bool: boolean }
  | { kind: 'rating'; rating: number }
  | { kind: 'chips'; chips: string[] }
  | { kind: 'duration'; minutes: number }
  | { kind: 'measurement'; value: number; unit: string };

const humanizeKey = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const formatDurationMin = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatValue = (
  key: string,
  value: unknown,
  data: Record<string, unknown>
): FieldValue | null => {
  if (value === undefined || value === null || value === '') return null;

  if ((key === 'unit' || key === 'value_unit') && data.value !== undefined) return null;

  if (typeof value === 'boolean') return { kind: 'bool', bool: value };

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return { kind: 'chips', chips: value.map((v) => String(v)) };
  }

  if (typeof value === 'object') {
    const anyVal = value as any;
    if (anyVal?.name) return { kind: 'text', text: String(anyVal.name) };
    if (anyVal?.label) return { kind: 'text', text: String(anyVal.label) };
    return { kind: 'text', text: JSON.stringify(value) };
  }

  if (typeof value === 'number') {
    const lk = key.toLowerCase();
    if (
      (lk.includes('quality') || lk.includes('rating') || lk.includes('mood') || lk.includes('severity')) &&
      value >= 1 && value <= 5
    ) {
      return { kind: 'rating', rating: value };
    }
    if (lk.includes('duration') || lk.endsWith('minutes') || lk === 'mins') {
      return { kind: 'duration', minutes: value };
    }
    if (key === 'value') {
      const unit = (data.unit ?? data.value_unit) as string | undefined;
      if (unit) return { kind: 'measurement', value, unit };
    }
    return { kind: 'text', text: String(value) };
  }

  const str = String(value).replace(/_/g, ' ');
  const pretty = str.length > 1 ? str[0].toUpperCase() + str.slice(1) : str;
  return { kind: 'text', text: pretty };
};

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFIED GLASS CARD — No shadows, clean borders
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = ({ children, style, onPress, active = false }: any) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.glassCard,
        active && { borderColor: theme.primary, borderWidth: 1.5 },
        style,
      ]}
    >
      <LinearGradient
        colors={theme.isDark
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, {
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Unified style
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = ({ title, subtitle, action, actionLabel, icon }: any) => {
  const theme = useUnifiedTrackerTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={[styles.sectionActionText, { color: theme.primary }]}>
            {actionLabel || 'See All'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD — Intelligence metric card
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiCard = ({ title, value, unit, change, changeLabel, icon, color, onPress }: any) => {
  const theme = useUnifiedTrackerTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiCard}>
      <View style={styles.kpiInner}>
        <View style={[styles.kpiIconBg, { backgroundColor: `${color}12` }]}>
          <Text style={styles.kpiIcon}>{icon}</Text>
        </View>
        <View style={styles.kpiBody}>
          <Text style={[styles.kpiValue, { color: theme.text.primary }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={[styles.kpiUnit, { color }]}>{unit}</Text>
        </View>
        <Text style={[styles.kpiTitle, { color: theme.text.secondary }]}>{title}</Text>
        {change !== undefined && (
          <View style={styles.kpiFooter}>
            <View style={styles.kpiChangeRow}>
              <Ionicons
                name={change >= 0 ? 'trending-up' : 'trending-down'}
                size={10}
                color={change >= 0 ? '#10b981' : '#ef4444'}
              />
              <Text style={[styles.kpiChange, { color: change >= 0 ? '#10b981' : '#ef4444' }]}>
                {change > 0 ? '+' : ''}{change}
              </Text>
              {changeLabel && (
                <Text style={[styles.kpiChangeLabel, { color: theme.text.muted }]}>{changeLabel}</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SPARKLINE — Mini trend graph
   ═══════════════════════════════════════════════════════════════════════════ */

const Sparkline = ({ data, color, width = 80, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) => {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data, 0.1);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * chartW,
    y: padding + chartH - ((v - minVal) / range) * chartH,
  }));

  return (
    <View style={{ width, height }}>
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const len = Math.sqrt(Math.pow(pt.x - prev.x, 2) + Math.pow(pt.y - prev.y, 2));
        const angle = Math.atan2(pt.y - prev.y, pt.x - prev.x) * 180 / Math.PI;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: prev.x,
            top: prev.y,
            width: len,
            height: 2,
            backgroundColor: color,
            transform: [{ translateX: 0 }, { translateY: -1 }, { rotate: `${angle}deg` }],
            transformOrigin: '0% 50%',
            borderRadius: 1,
            opacity: 0.7,
          }} />
        );
      })}
      {points.map((pt, i) => (
        <View key={`pt-${i}`} style={{
          position: 'absolute',
          left: pt.x - 2,
          top: pt.y - 2,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: '#fff',
        }} />
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   VALUE CELL RENDERER
   ═══════════════════════════════════════════════════════════════════════════ */

const ValueCell = ({ value, theme, accent }: { value: FieldValue; theme: any; accent: string }) => {
  if (value.kind === 'bool') {
    const on = value.bool;
    return (
      <View style={[styles.boolPill, { backgroundColor: on ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)' }]}>
        <Text style={[styles.boolPillText, { color: on ? '#10b981' : '#ef4444' }]}>{on ? 'Yes' : 'No'}</Text>
      </View>
    );
  }
  if (value.kind === 'rating') {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={i}
            name={i <= value.rating ? 'star' : 'star-outline'}
            size={14}
            color={i <= value.rating ? '#f59e0b' : theme.text.muted}
          />
        ))}
      </View>
    );
  }
  if (value.kind === 'chips') {
    return (
      <View style={styles.chipsWrap}>
        {value.chips.map((c, i) => (
          <View key={`${c}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.valueChipText, { color: accent }]}>{c}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (value.kind === 'duration') {
    return <Text style={[styles.rowValue, { color: theme.text.primary }]}>{formatDurationMin(value.minutes)}</Text>;
  }
  if (value.kind === 'measurement') {
    return <Text style={[styles.rowValue, { color: theme.text.primary }]}>{value.value} {value.unit}</Text>;
  }
  return <Text style={[styles.rowValue, { color: theme.text.primary }]}>{value.text}</Text>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   INTELLIGENCE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const EntryIntelligencePanel = ({ entry, tracker, allEntries, theme }: any) => {
  const stats = useMemo(() => {
    if (!entry || !allEntries?.length) return null;

    const trackerEntries = allEntries.filter((e: any) => e.trackerId === entry.trackerId).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const entryIndex = trackerEntries.findIndex((e: any) => e.id === entry.id);
    const prevEntry = entryIndex > 0 ? trackerEntries[entryIndex - 1] : null;

    const sameDay = allEntries.filter((e: any) => e.id !== entry.id && isSameDay(new Date(e.timestamp), new Date(entry.timestamp)));

    const valueTrend = trackerEntries.map((e: any) => {
      const val = e.data?.value ?? e.data?.amount ?? e.data?.duration ?? e.data?.temperature ?? 0;
      return safeNum(val, 0);
    });

    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = trackerEntries.filter((e: any) => e.timestamp >= weekAgo).length;
    const prevWeek = trackerEntries.filter((e: any) => e.timestamp >= weekAgo - 7 * 86400000 && e.timestamp < weekAgo).length;
    const weekTrend = prevWeek === 0 ? 100 : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);

    const gapMs = prevEntry ? entry.timestamp - prevEntry.timestamp : null;
    const avgGapMs = trackerEntries.length >= 2
      ? trackerEntries.reduce((sum: number, e: any, i: number) => {
          if (i === 0) return sum;
          return sum + (e.timestamp - trackerEntries[i - 1].timestamp);
        }, 0) / (trackerEntries.length - 1)
      : null;

    const fmtGap = (ms: number): string => {
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      return `${d}d`;
    };

    const dayEntries = allEntries.filter((e: any) => isSameDay(new Date(e.timestamp), new Date(entry.timestamp))).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const dayIndex = dayEntries.findIndex((e: any) => e.id === entry.id) + 1;

    return {
      totalInTracker: trackerEntries.length,
      entryNumber: entryIndex + 1,
      prevEntry,
      sameDayCount: sameDay.length,
      dayPosition: dayIndex,
      dayTotal: dayEntries.length,
      sincePrev: gapMs ? fmtGap(gapMs) : null,
      avgGap: avgGapMs ? fmtGap(avgGapMs) : null,
      weekTrend,
      thisWeek,
      valueTrend: valueTrend.slice(-7),
      isFirst: entryIndex === 0,
      isLatest: entryIndex === trackerEntries.length - 1,
    };
  }, [entry, allEntries]);

  if (!stats) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Entry Intelligence" subtitle="Patterns & context around this log" icon="analytics-outline" />
      <GlassCard>
        <View style={styles.intelGrid}>
          <View style={styles.intelTile}>
            <View style={[styles.intelIconBg, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="list-outline" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.intelValue, { color: theme.text.primary }]}>{stats.entryNumber}</Text>
            <Text style={[styles.intelLabel, { color: theme.text.muted }]}>of {stats.totalInTracker} in {tracker?.name || 'tracker'}</Text>
          </View>

          <View style={styles.intelTile}>
            <View style={[styles.intelIconBg, { backgroundColor: '#f59e0b12' }]}>
              <Ionicons name="calendar-number-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.intelValue, { color: theme.text.primary }]}>{stats.dayPosition}</Text>
            <Text style={[styles.intelLabel, { color: theme.text.muted }]}>{stats.dayTotal} entries that day</Text>
          </View>

          {stats.sincePrev && (
            <View style={styles.intelTile}>
              <View style={[styles.intelIconBg, { backgroundColor: '#8b5cf612' }]}>
                <Ionicons name="timer-outline" size={18} color="#8b5cf6" />
              </View>
              <Text style={[styles.intelValue, { color: theme.text.primary }]}>{stats.sincePrev}</Text>
              <Text style={[styles.intelLabel, { color: theme.text.muted }]}>since previous</Text>
            </View>
          )}

          {stats.avgGap && (
            <View style={styles.intelTile}>
              <View style={[styles.intelIconBg, { backgroundColor: '#10b98112' }]}>
                <Ionicons name="stats-chart-outline" size={18} color="#10b981" />
              </View>
              <Text style={[styles.intelValue, { color: theme.text.primary }]}>{stats.avgGap}</Text>
              <Text style={[styles.intelLabel, { color: theme.text.muted }]}>typical gap</Text>
            </View>
          )}
        </View>

        {stats.valueTrend.length >= 2 && (
          <View style={[styles.trendRow, { borderTopColor: theme.surface.border }]}>
            <View style={styles.trendLeft}>
              <Text style={[styles.trendLabel, { color: theme.text.secondary }]}>Value Trend</Text>
              <Text style={[styles.trendSub, { color: theme.text.muted }]}>Last {stats.valueTrend.length} entries</Text>
            </View>
            <Sparkline data={stats.valueTrend} color={tracker?.gradient?.[0] || theme.primary} />
          </View>
        )}

        <View style={[styles.trendRow, { borderTopColor: theme.surface.border }]}>
          <View style={styles.trendLeft}>
            <Text style={[styles.trendLabel, { color: theme.text.secondary }]}>This Week</Text>
            <Text style={[styles.trendSub, { color: theme.text.muted }]}>{stats.thisWeek} entries</Text>
          </View>
          <View style={styles.trendRight}>
            <View style={[styles.trendBadge, {
              backgroundColor: stats.weekTrend >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
            }]}>
              <Ionicons name={stats.weekTrend >= 0 ? 'trending-up' : 'trending-down'} size={12} color={stats.weekTrend >= 0 ? '#10b981' : '#ef4444'} />
              <Text style={[styles.trendBadgeText, { color: stats.weekTrend >= 0 ? '#10b981' : '#ef4444' }]}>
                {stats.weekTrend > 0 ? '+' : ''}{stats.weekTrend}%
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const SimilarEntriesPanel = ({ entry, allEntries, getTracker, onOpenEntry, theme }: any) => {
  const similar = useMemo(() => {
    if (!entry) return [];
    return allEntries
      .filter((e: any) => e.id !== entry.id && e.trackerId === entry.trackerId)
      .slice(0, 3)
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  }, [entry, allEntries]);

  if (similar.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader title="Recent Similar" subtitle={`Other ${getTracker(entry?.trackerId)?.name || 'entries'}`} icon="copy-outline" />
      <View style={{ gap: 8 }}>
        {similar.map((e: any, i: number) => {
          const t = getTracker(e.trackerId);
          const c = t?.gradient?.[0] || t?.color || theme.primary;
          return (
            <TouchableOpacity
              key={e.id}
              onPress={() => onOpenEntry(e)}
              activeOpacity={0.8}
            >
              <GlassCard>
                <View style={styles.similarRow}>
                  <View style={[styles.similarIconBg, { backgroundColor: `${c}12` }]}>
                    <Text style={styles.similarEmoji}>{t?.emoji || '📋'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.similarTitle, { color: theme.text.primary }]} numberOfLines={1}>{e.title || t?.name || 'Entry'}</Text>
                    <Text style={[styles.similarMeta, { color: theme.text.muted }]}>
                      {safeFmt(e.timestamp, 'MMM d, h:mm a')}
                      {e.loggedByName ? ` • ${e.loggedByName}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.similarValueBadge, { backgroundColor: `${c}12` }]}>
                    <Text style={[styles.similarValueText, { color: c }]}>
                      {e.data?.value ?? e.data?.amount ?? '—'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={theme.text.muted} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EntryDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();
  const { triggerHaptic, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion } = useCustomization();
  const {
    getEntryById, getTracker, getEntries, getEntriesByDate,
    addEntry, deleteEntry, canEditEntry, canDeleteEntry, canCreateEntry,
    entries: allEntries,
  } = useTracker();
  const { babies, currentBaby } = useBaby();
  const { success, confirm } = useSweetAlert();

  const entryId = route.params?.entryId;
  const entry = entryId ? getEntryById(entryId) : undefined;
  const tracker = entry ? getTracker(entry.trackerId) : undefined;

  const accent = tracker?.gradient?.[0] || tracker?.color || theme.primary;
  const heroColors: [string, string] = [accent, (tracker?.gradient?.[1] as string) || theme.secondary || accent];
  const radius = borderRadiusValue || DESIGN.radius.lg;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editHistory, setEditHistory] = useState<EntryEditVersion[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  /* Load edit history */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!entryId) return;
      try {
        const raw = await AsyncStorage.getItem(EDIT_HISTORY_KEY);
        const store = raw ? JSON.parse(raw) : {};
        const list = Array.isArray(store[entryId]) ? store[entryId] : [];
        if (mounted) setEditHistory(list);
      } catch { }
    })();
    return () => { mounted = false; };
  }, [entryId, entry?.editedAt]);

  const baby = useMemo(() => {
    if (!entry) return currentBaby;
    return babies?.find((b) => b.id === entry.babyId) || currentBaby;
  }, [entry, babies, currentBaby]);

  const entryDate = entry ? new Date(entry.timestamp) : null;
  const photos = useMemo(() => entry?.photoUris ?? [], [entry]);
  const tags = useMemo(() => entry?.tags ?? [], [entry]);
  const locationName = typeof entry?.location?.name === 'string' ? entry.location.name : '';

  const canEdit = entry ? canEditEntry(entry) : false;
  const canDelete = entry ? canDeleteEntry(entry) : false;
  const canDuplicate = entry ? canCreateEntry(entry.trackerId) : false;

  const dayLabel = useMemo(() => {
    if (!entryDate) return '';
    if (isToday(entryDate)) return 'Today';
    if (isYesterday(entryDate)) return 'Yesterday';
    return format(entryDate, 'EEEE');
  }, [entryDate]);

  const relativeLabel = useMemo(() => {
    if (!entryDate) return '';
    try {
      return formatDistanceToNow(entryDate, { addSuffix: true });
    } catch { return ''; }
  }, [entryDate]);

  /* Detail rows */
  const detailRows = useMemo(() => {
    if (!entry?.data) return [] as { key: string; label: string; value: FieldValue }[];
    const data = entry.data as Record<string, unknown>;
    const orderedKeys: string[] = [];
    (tracker?.fields || []).forEach((f: any) => {
      if (f?.id && data[f.id] !== undefined) orderedKeys.push(f.id);
    });
    Object.keys(data).forEach((k) => {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    return orderedKeys
      .filter((k) => !SKIP_KEYS.has(k))
      .map((k) => {
        const field = tracker?.fields?.find((fl: any) => fl.id === k);
        return {
          key: k,
          label: field?.label || humanizeKey(k),
          value: formatValue(k, data[k], data),
        };
      })
      .filter((r): r is { key: string; label: string; value: FieldValue } => r.value !== null);
  }, [entry, tracker]);

  /* Same-day entries */
  const sameDayEntries = useMemo(() => {
    if (!entry) return [] as any[];
    return getEntriesByDate(new Date(entry.timestamp))
      .filter((e) => e.id !== entry.id)
      .slice(0, 8);
  }, [entry, getEntriesByDate]);

  /* Prev / next */
  const trackerHistory = useMemo(() => {
    if (!entry) return { prev: null as any, next: null as any, index: -1, total: 0 };
    const list = getEntries(entry.trackerId).slice().sort((a, b) => a.timestamp - b.timestamp);
    const index = list.findIndex((e) => e.id === entry.id);
    return {
      prev: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
      index,
      total: list.length,
    };
  }, [entry, getEntries]);

  const syncedLabel = useMemo(() => {
    if (!entry?.syncedAt) return null;
    const d = new Date(entry.syncedAt as any);
    return isNaN(d.getTime()) ? null : format(d, 'MMM d, h:mm a');
  }, [entry]);

  /* Edit history */
  const historyRows = useMemo(() => {
    if (!entry || editHistory.length === 0) return [] as any[];
    return editHistory.map((v, idx) => {
      const isLast = idx === editHistory.length - 1;
      const afterData = (isLast ? entry.data : editHistory[idx + 1]?.prevData) as Record<string, unknown> | undefined;
      const afterTitle = isLast ? entry.title : editHistory[idx + 1]?.prevTitle;
      const afterNotes = isLast ? entry.notes : editHistory[idx + 1]?.prevNotes;
      const afterTimestamp = isLast ? entry.timestamp : editHistory[idx + 1]?.prevTimestamp;
      const changes: { label: string; before: string; after: string }[] = [];
      if ((v.prevTitle || '') !== (afterTitle || '')) {
        changes.push({ label: 'Title', before: versionValueText(v.prevTitle), after: versionValueText(afterTitle) });
      }
      if ((v.prevNotes || '') !== (afterNotes || '')) {
        changes.push({ label: 'Notes', before: versionValueText(v.prevNotes), after: versionValueText(afterNotes) });
      }
      if (afterTimestamp && v.prevTimestamp !== afterTimestamp) {
        changes.push({
          label: 'Time',
          before: format(new Date(v.prevTimestamp), 'MMM d, h:mm a'),
          after: format(new Date(afterTimestamp), 'MMM d, h:mm a'),
        });
      }
      const prevData = (v.prevData || {}) as Record<string, unknown>;
      const nextData = (afterData || {}) as Record<string, unknown>;
      const allKeys = [...new Set([...Object.keys(prevData), ...Object.keys(nextData)])].filter(k => !SKIP_KEYS.has(k));
      allKeys.forEach(k => {
        const before = versionValueText(prevData[k]);
        const after = versionValueText(nextData[k]);
        if (before !== after) {
          const field = tracker?.fields?.find((fl: any) => fl.id === k);
          changes.push({ label: field?.label || humanizeKey(k), before, after });
        }
      });
      return {
        key: `${v.editedAt}-${idx}`,
        version: idx + 1,
        editedAt: v.editedAt,
        editedByName: v.editedByName || 'Unknown',
        changes,
      };
    }).reverse();
  }, [entry, editHistory, tracker]);

  /* Age at logging */
  const ageAtLogging = useMemo(() => {
    const dobStr = (baby as any)?.birthDate;
    if (!dobStr || !entryDate) return baby?.age ? `${baby.age} old at logging` : '';
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return baby?.age ? `${baby.age} old at logging` : '';
    const totalDays = Math.floor((entryDate.getTime() - dob.getTime()) / 86400000);
    if (totalDays < 0) return '';
    if (totalDays < 1) return 'Newborn at logging';
    if (totalDays < 14) return `${totalDays} day${totalDays === 1 ? '' : 's'} old at logging`;
    if (totalDays < 60) {
      const weeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;
      return remDays > 0 ? `${weeks}w ${remDays}d old at logging` : `${weeks} week${weeks === 1 ? '' : 's'} old at logging`;
    }
    let months = (entryDate.getFullYear() - dob.getFullYear()) * 12;
    months += entryDate.getMonth() - dob.getMonth();
    if (entryDate.getDate() < dob.getDate()) months--;
    if (months < 0) months = 0;
    if (months < 24) {
      const anchor = new Date(dob);
      anchor.setMonth(anchor.getMonth() + months);
      const remDays = Math.max(0, Math.floor((entryDate.getTime() - anchor.getTime()) / 86400000));
      return remDays > 0 ? `${months}m ${remDays}d old at logging` : `${months} month${months === 1 ? '' : 's'} old at logging`;
    }
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}m old at logging` : `${years} year${years === 1 ? '' : 's'} old at logging`;
  }, [baby, entryDate]);

  /* Share text */
  const shareText = useMemo(() => {
    if (!entry || !entryDate) return '';
    const lines = [
      `${tracker?.emoji || '📝'} ${entry.title || 'Entry'}`,
      `${tracker?.name || entry.trackerId} — ${format(entryDate, 'EEEE, MMM d, yyyy')} at ${format(entryDate, 'h:mm a')}`,
      '',
      ...detailRows.map((r) => {
        const v = r.value;
        const txt =
          v.kind === 'bool' ? (v.bool ? 'Yes' : 'No')
            : v.kind === 'rating' ? `${v.rating}/5`
              : v.kind === 'chips' ? v.chips.join(', ')
                : v.kind === 'duration' ? formatDurationMin(v.minutes)
                  : v.kind === 'measurement' ? `${v.value} ${v.unit}`
                    : v.text;
        return `• ${r.label}: ${txt}`;
      }),
    ];
    if (entry.notes) lines.push('', `Notes: ${entry.notes}`);
    if (tags.length > 0) lines.push(`Tags: ${tags.map((t) => `#${t}`).join(' ')}`);
    if (photos.length > 0) lines.push(`📷 ${photos.length} photo${photos.length > 1 ? 's' : ''} attached`);
    lines.push('', `Logged by ${entry.loggedByName || 'You'} • LittleLoom`);
    return lines.join('\n');
  }, [entry, entryDate, detailRows, tracker, tags, photos]);

  /* Handlers */
  const handleShare = useCallback(async () => {
    if (!shareText) return;
    triggerHaptic('light');
    try { await Share.share({ message: shareText }); } catch { }
  }, [shareText, triggerHaptic]);

  const handleEdit = useCallback(() => {
    if (!entry) return;
    triggerHaptic('light');
    navigation.navigate('AddEntry', { editMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [entry, navigation, triggerHaptic]);

  const handleDuplicate = useCallback(async () => {
    if (!entry) return;
    triggerHaptic('medium');
    const copy = await addEntry(entry.trackerId, { ...(entry.data as Record<string, unknown>) }, {
      title: entry.title,
      notes: entry.notes,
      photoUris: entry.photoUris,
      tags: entry.tags,
    });
    if (copy) {
      triggerHaptic('success');
      success('Duplicated', 'A copy was logged with the current time.');
    }
  }, [entry, addEntry, success, triggerHaptic]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete "${entry.title || 'this entry'}"? This cannot be undone.`,
      async () => {
        const ok = await deleteEntry(entry.id);
        if (ok) {
          triggerHaptic('success');
          success('Deleted', 'Entry removed');
          navigation.goBack();
        }
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [entry, confirm, deleteEntry, navigation, success, triggerHaptic]);

  const openEntry = useCallback((e: any) => {
    triggerHaptic('light');
    navigation.push('EntryDetail', { entryId: e.id, trackerId: e.trackerId });
  }, [navigation, triggerHaptic]);

  // Resolve logged-by name intelligently
  const loggedByDisplay = useMemo(() => {
    if (!entry) return { name: 'You', role: 'parent1', avatar: '' };
    const name = entry.loggedByName || 'You';
    const role = entry.loggedByRole || 'parent1';
    return { name, role, avatar: '' };
  }, [entry]);

  const roleMeta = ROLE_META[loggedByDisplay.role] || { label: 'Member', color: theme.primary };

  /* Missing entry fallback */
  if (!entry || !entryDate) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0']}
          style={styles.backgroundGradient}
        />
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Entry Details</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </View>
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.surface.card }]}>
            <Ionicons name="search-outline" size={40} color={theme.text.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>Entry not found</Text>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            This entry may have been deleted, or it belongs to a different baby profile.
          </Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0', '#dbeafe']}
        style={styles.backgroundGradient}
      />

      {/* Header */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
            <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Entry Details</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>
              {tracker?.name || entry.trackerId}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
              <Ionicons name="share-social-outline" size={20} color={theme.text.primary} />
            </TouchableOpacity>
            {canDelete && (
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(60)}>
          <View style={[styles.heroCard, { borderRadius: radius }]}>
            <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroEmojiBubble}>
                  <Text style={styles.heroEmoji}>{tracker?.emoji || '📝'}</Text>
                </View>
                <View style={styles.heroTitleWrap}>
                  <View style={styles.heroTrackerChip}>
                    <Text style={styles.heroTrackerChipText}>{tracker?.name || entry.trackerId}</Text>
                  </View>
                  <Text style={[styles.heroTitle, { fontSize: 22 * fontSizeMultiplier }]} numberOfLines={2}>
                    {entry.title || 'Entry'}
                  </Text>
                </View>
              </View>

              <View style={styles.heroDateRow}>
                <View style={styles.heroDateBadge}>
                  <Text style={styles.heroDateBadgeText}>{dayLabel}</Text>
                </View>
                <View style={styles.heroDateBadge}>
                  <Text style={styles.heroDateBadgeText}>{format(entryDate, 'h:mm a')}</Text>
                </View>
                <Text style={styles.heroDateText}>{format(entryDate, 'EEEE, MMMM d, yyyy')}</Text>
              </View>
              {!!relativeLabel && <Text style={styles.heroRelative}>{relativeLabel}</Text>}

              {baby && (
                <View style={styles.heroBabyRow}>
                  <SafeAvatar avatar={baby.avatar} size={36} fallbackIcon="person" borderColor="rgba(255,255,255,0.6)" borderWidth={2} animated={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroBabyName}>{baby.name}</Text>
                    {!!ageAtLogging && <Text style={styles.heroBabyMeta}>{ageAtLogging}</Text>}
                  </View>
                  {photos.length > 0 && (
                    <View style={styles.heroDateBadge}>
                      <Text style={styles.heroDateBadgeText}>📷 {photos.length}</Text>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── KPI ROW ── */}
        <Animated.View entering={FadeInUp.delay(80).springify()}>
          <View style={styles.kpiRow}>
            <KpiCard
              title="Entry #"
              value={`#${trackerHistory.index + 1}`}
              unit={`of ${trackerHistory.total}`}
              icon="🔢"
              color={accent}
            />
            <KpiCard
              title="Same Day"
              value={sameDayEntries.length}
              unit="entries"
              icon="📅"
              color="#f59e0b"
            />
            <KpiCard
              title="Logged"
              value={format(entryDate, 'h:mm')}
              unit={format(entryDate, 'a')}
              icon="⏰"
              color="#8b5cf6"
            />
            <KpiCard
              title="Age"
              value={ageAtLogging ? ageAtLogging.split(' ')[0] : '—'}
              unit={ageAtLogging ? ageAtLogging.split(' ').slice(1).join(' ') : ''}
              icon="👶"
              color="#10b981"
            />
          </View>
        </Animated.View>

        {/* ── ENTRY INTELLIGENCE ── */}
        <EntryIntelligencePanel
          entry={entry}
          tracker={tracker}
          allEntries={allEntries}
          theme={theme}
        />

        {/* ── PHOTOS ── */}
        {photos.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(140)}>
            <GlassCard>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="images-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Photos</Text>
                  <View style={[styles.countPill, { backgroundColor: `${accent}15` }]}>
                    <Text style={[styles.countPillText, { color: accent }]}>{photos.length}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {photos.map((uri: string, idx: number) => (
                    <TouchableOpacity
                      key={`${uri}-${idx}`}
                      style={styles.photoThumb}
                      activeOpacity={0.9}
                      onPress={() => { triggerHaptic('light'); setViewerIndex(idx); }}
                    >
                      <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                      {idx === 0 && photos.length > 1 && (
                        <View style={styles.photoBadge}>
                          <Text style={styles.photoBadgeText}>+{photos.length - 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── PARTICULARS ── */}
        {detailRows.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(180)}>
            <GlassCard>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="list-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Details</Text>
                </View>
                {detailRows.map((r, i) => (
                  <View key={r.key} style={[styles.row, i > 0 && styles.rowBorder, i > 0 && { borderTopColor: theme.surface.border }]}>
                    <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>{r.label}</Text>
                    <View style={styles.rowValueWrap}>
                      <ValueCell value={r.value} theme={theme} accent={accent} />
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── NOTES ── */}
        {!!entry.notes && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(220)}>
            <GlassCard>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="document-text-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Notes</Text>
                </View>
                <Text style={[styles.notesText, { color: theme.text.primary }]}>{entry.notes}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── TAGS & LOCATION ── */}
        {(tags.length > 0 || !!locationName) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(260)}>
            <GlassCard>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="pricetags-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Tags & Location</Text>
                </View>
                {!!locationName && (
                  <View style={styles.auditSubRow}>
                    <Ionicons name="navigate-outline" size={14} color={accent} />
                    <Text style={[styles.auditSubText, { color: theme.text.primary }]}>{locationName}</Text>
                  </View>
                )}
                {tags.length > 0 && (
                  <View style={[styles.chipsWrap, { justifyContent: 'flex-start', marginTop: locationName ? 10 : 0 }]}>
                    {tags.map((t: string, i: number) => (
                      <View key={`${t}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
                        <Text style={[styles.valueChipText, { color: accent }]}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── AUDIT: logged by / edited / synced ── */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)}>
          <GlassCard>
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={accent} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Record Info</Text>
              </View>
              <View style={styles.auditRow}>
                <View style={[styles.auditAvatar, { backgroundColor: roleMeta.color }]}>
                  <Text style={styles.auditAvatarText}>
                    {loggedByDisplay.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.auditName, { color: theme.text.primary }]}>
                    {loggedByDisplay.name}
                  </Text>
                  <Text style={[styles.auditMeta, { color: theme.text.muted }]}>
                    Logged {format(entryDate, 'MMM d, yyyy • h:mm a')}
                  </Text>
                  <View style={[styles.rolePill, { backgroundColor: `${roleMeta.color}18` }]}>
                    <Text style={[styles.rolePillText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                  </View>
                </View>
              </View>
              {!!entry.editedAt && (
                <View style={styles.auditSubRow}>
                  <Ionicons name="create-outline" size={13} color={theme.text.muted} />
                  <Text style={[styles.auditSubText, { color: theme.text.muted }]}>
                    Edited {format(new Date(entry.editedAt), 'MMM d, yyyy • h:mm a')}
                  </Text>
                </View>
              )}
              {historyRows.length > 0 && (
                <View style={[styles.historyWrap, { borderColor: theme.surface.border }]}>
                  <TouchableOpacity
                    style={styles.historyHeader}
                    activeOpacity={0.75}
                    onPress={() => { triggerHaptic('light'); setHistoryExpanded(prev => !prev); }}
                  >
                    <Ionicons name="time-outline" size={14} color={accent} />
                    <Text style={[styles.historyHeaderText, { color: theme.text.primary }]}>
                      Edit history · {historyRows.length} previous version{historyRows.length > 1 ? 's' : ''}
                    </Text>
                    <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.text.muted} />
                  </TouchableOpacity>
                  {historyExpanded && historyRows.map((row: any) => (
                    <View key={row.key} style={[styles.historyVersion, { borderColor: theme.surface.border }]}>
                      <View style={styles.historyVersionHeader}>
                        <View style={[styles.historyVersionBadge, { backgroundColor: `${accent}15` }]}>
                          <Text style={[styles.historyVersionBadgeText, { color: accent }]}>v{row.version}</Text>
                        </View>
                        <Text style={[styles.historyVersionMeta, { color: theme.text.secondary }]} numberOfLines={1}>
                          {row.editedByName} • {format(new Date(row.editedAt), 'MMM d, yyyy • h:mm a')}
                        </Text>
                      </View>
                      {row.changes.length === 0 ? (
                        <Text style={[styles.historyChangeText, { color: theme.text.muted }]}>No field changes recorded</Text>
                      ) : (
                        row.changes.map((c: any, i: number) => (
                          <View key={`${row.key}-${i}`} style={styles.historyChangeRow}>
                            <Text style={[styles.historyChangeLabel, { color: theme.text.muted }]}>{c.label}</Text>
                            <Text style={[styles.historyChangeText, { color: theme.text.secondary }]} numberOfLines={2}>
                              <Text style={{ textDecorationLine: 'line-through', color: theme.text.muted }}>{c.before}</Text>
                              {'  →  '}
                              <Text style={{ color: theme.text.primary, fontWeight: '600' }}>{c.after}</Text>
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  ))}
                </View>
              )}
              {!!syncedLabel && (
                <View style={styles.auditSubRow}>
                  <Ionicons name="cloud-done-outline" size={13} color={theme.text.muted} />
                  <Text style={[styles.auditSubText, { color: theme.text.muted }]}>Synced {syncedLabel}</Text>
                </View>
              )}
              <View style={styles.auditSubRow}>
                <Ionicons name="finger-print-outline" size={13} color={theme.text.muted} />
                <Text style={[styles.auditSubText, { color: theme.text.muted }]}>ID …{entry.id.slice(-6)}</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── MORE FROM THIS DAY ── */}
        {sameDayEntries.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(340)}>
            <GlassCard>
              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: `${accent}15` }]}>
                    <Ionicons name="calendar-outline" size={15} color={accent} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>More from {dayLabel}</Text>
                  <View style={[styles.countPill, { backgroundColor: `${accent}15` }]}>
                    <Text style={[styles.countPillText, { color: accent }]}>{sameDayEntries.length}</Text>
                  </View>
                </View>
                {sameDayEntries.map((e: any, i: number) => {
                  const t = getTracker(e.trackerId);
                  const c = t?.gradient?.[0] || t?.color || theme.primary;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      onPress={() => openEntry(e)}
                      style={[styles.dayRow, i > 0 && styles.rowBorder, i > 0 && { borderTopColor: theme.surface.border }]}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.dayEmojiWrap, { backgroundColor: `${c}15` }]}>
                        <Text style={styles.dayEmoji}>{t?.emoji || '📋'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dayTitle, { color: theme.text.primary }]} numberOfLines={1}>
                          {e.title || t?.name || 'Entry'}
                        </Text>
                        <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                          {format(new Date(e.timestamp), 'h:mm a')}
                          {e.loggedByName ? ` • ${e.loggedByName}` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.dayFooter, { borderTopColor: theme.surface.border }]}
                  onPress={() => { triggerHaptic('light'); navigation.navigate('Timeline'); }}
                >
                  <Text style={[styles.dayFooterText, { color: accent }]}>Open full day in Timeline</Text>
                  <Ionicons name="arrow-forward" size={14} color={accent} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SIMILAR ENTRIES ── */}
        <SimilarEntriesPanel
          entry={entry}
          allEntries={allEntries}
          getTracker={getTracker}
          onOpenEntry={openEntry}
          theme={theme}
        />

        {/* ── PREV / NEXT ── */}
        {(trackerHistory.prev || trackerHistory.next) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(380)}>
            <View style={styles.prevNextBar}>
              {trackerHistory.prev ? (
                <TouchableOpacity
                  style={[styles.prevNextBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border }]}
                  onPress={() => openEntry(trackerHistory.prev!)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="chevron-back" size={12} color={theme.text.muted} />
                    <Text style={[styles.prevNextLabel, { color: theme.text.muted }]}>Older</Text>
                  </View>
                  <Text style={[styles.prevNextTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {trackerHistory.prev.title || 'Entry'}
                  </Text>
                  <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                    {format(new Date(trackerHistory.prev.timestamp), 'MMM d, h:mm a')}
                  </Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}
              {trackerHistory.next ? (
                <TouchableOpacity
                  style={[styles.prevNextBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border, alignItems: 'flex-end' }]}
                  onPress={() => openEntry(trackerHistory.next!)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.prevNextLabel, { color: theme.text.muted }]}>Newer</Text>
                    <Ionicons name="chevron-forward" size={12} color={theme.text.muted} />
                  </View>
                  <Text style={[styles.prevNextTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {trackerHistory.next.title || 'Entry'}
                  </Text>
                  <Text style={[styles.dayMeta, { color: theme.text.muted }]}>
                    {format(new Date(trackerHistory.next.timestamp), 'MMM d, h:mm a')}
                  </Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}
            </View>
            {trackerHistory.total > 0 && (
              <Text style={[styles.positionText, { color: theme.text.muted }]}>
                Entry {trackerHistory.index + 1} of {trackerHistory.total} in {tracker?.name || entry.trackerId}
              </Text>
            )}
          </Animated.View>
        )}

        {/* ── ACTION BAR ── */}
        {(canEdit || canDuplicate || canDelete) && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(420)} style={styles.actionBar}>
            {canEdit && (
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleEdit} activeOpacity={0.85}>
                <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnPrimaryInner}>
                  <Ionicons name="create-outline" size={17} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>Edit</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {canDuplicate && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.surface.card, borderColor: theme.surface.border }]}
                onPress={handleDuplicate}
                activeOpacity={0.85}
              >
                <Ionicons name="copy-outline" size={16} color={accent} />
                <Text style={[styles.actionBtnText, { color: accent }]}>Duplicate</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}
                onPress={handleDelete}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* ── FULLSCREEN PHOTO VIEWER ── */}
      <Modal visible={viewerIndex !== null} animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewerContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * SCREEN_W, y: 0 }}
            onMomentumScrollEnd={(e) => setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          >
            {photos.map((uri: string, idx: number) => (
              <View key={`viewer-${uri}-${idx}`} style={{ width: SCREEN_W, flex: 1, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width: SCREEN_W, height: '80%' }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerIndex(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={[styles.viewerCounter, { top: insets.top + 20 }]}>
              <Text style={styles.viewerCounterText}>{(viewerIndex ?? 0) + 1} / {photos.length}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — No card shadows, unified aesthetic
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.md,
    marginTop: DESIGN.spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.spacing.sm,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: DESIGN.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Header ──
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: { width: 42, height: 42, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', /* no shadow */ },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  // ── Hero ──
  heroCard: { overflow: 'hidden', marginBottom: 16, marginHorizontal: 16, /* no shadow */ },
  heroGradient: { padding: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroEmojiBubble: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  heroEmoji: { fontSize: 30 },
  heroTitleWrap: { flex: 1 },
  heroTrackerChip: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 6 },
  heroTrackerChipText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontWeight: '800', letterSpacing: -0.4 },
  heroDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  heroDateBadge: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroDateBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroDateText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  heroRelative: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 6 },
  heroBabyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 10 },
  heroBabyName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  heroBabyMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 1 },

  // ── KPI Row ──
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  kpiCard: {
    width: (SCREEN_W - 56) / 2,
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
  },
  kpiInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  kpiIconBg: {
    width: 44,
    height: 44,
    borderRadius: DESIGN.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiIcon: { fontSize: 22 },
  kpiBody: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  kpiValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    fontSize: 22,
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  kpiFooter: { marginTop: 10, gap: 4, alignItems: 'center' },
  kpiChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiChange: { fontSize: 11, fontWeight: '700' },
  kpiChangeLabel: { fontSize: 10, fontWeight: '500', marginLeft: 2 },

  // ── Intelligence Panel ──
  intelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  intelTile: {
    width: (SCREEN_W - 72) / 2,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: DESIGN.radius.sm,
    gap: 4,
  },
  intelIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intelValue: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  intelLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  // ── Trend Row ──
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  trendLeft: { flex: 1 },
  trendLabel: { fontSize: 13, fontWeight: '700' },
  trendSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  trendRight: { alignItems: 'flex-end' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendBadgeText: { fontSize: 12, fontWeight: '700' },

  // ── Similar Entries ──
  similarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  similarIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  similarEmoji: { fontSize: 20 },
  similarTitle: { fontSize: 14, fontWeight: '700' },
  similarMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  similarValueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  similarValueText: { fontSize: 12, fontWeight: '800' },

  // ── Card Inner ──
  card: { overflow: 'hidden', marginBottom: 16, borderWidth: 1, /* no shadow */ },
  cardInner: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardHeaderIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flex: 1 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 11, fontWeight: '800' },

  // ── Photo Strip ──
  photoStrip: { gap: 10 },
  photoThumb: { width: 110, height: 110, borderRadius: 14, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoBadge: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Detail Rows ──
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 13, fontWeight: '600', width: 118 },
  rowValueWrap: { flex: 1, alignItems: 'flex-end' },
  rowValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  boolPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  boolPillText: { fontSize: 12, fontWeight: '800' },
  starsRow: { flexDirection: 'row', gap: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  valueChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  valueChipText: { fontSize: 12, fontWeight: '700' },

  // ── Notes ──
  notesText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

  // ── Audit ──
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  auditAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  auditAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  auditName: { fontSize: 14, fontWeight: '800' },
  auditMeta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start', marginTop: 4 },
  rolePillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  auditSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  auditSubText: { fontSize: 12, fontWeight: '600' },

  // ── Edit History ──
  historyWrap: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyHeaderText: { flex: 1, fontSize: 13, fontWeight: '800' },
  historyVersion: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: DESIGN.radius.sm, padding: 10 },
  historyVersionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyVersionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  historyVersionBadgeText: { fontSize: 10, fontWeight: '800' },
  historyVersionMeta: { flex: 1, fontSize: 11, fontWeight: '600' },
  historyChangeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  historyChangeLabel: { width: 72, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  historyChangeText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },

  // ── Same Day ──
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dayEmojiWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayEmoji: { fontSize: 18 },
  dayTitle: { fontSize: 14, fontWeight: '700' },
  dayMeta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  dayFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  dayFooterText: { fontSize: 13, fontWeight: '800' },

  // ── Prev / Next ──
  prevNextBar: { flexDirection: 'row', gap: 10, marginBottom: 16, marginHorizontal: 16 },
  prevNextBtn: { flex: 1, borderWidth: 1, padding: 12, borderRadius: DESIGN.radius.md },
  prevNextLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  prevNextTitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  positionText: { textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: -8, marginBottom: 16 },

  // ── Action Bar ──
  actionBar: { flexDirection: 'row', gap: 10, marginTop: 4, marginHorizontal: 16 },
  actionBtnPrimary: { flex: 1.4, borderRadius: DESIGN.radius.md, overflow: 'hidden' },
  actionBtnPrimaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionBtn: { flex: 1, borderRadius: DESIGN.radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '800' },

  // ── Empty State ──
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },

  // ── Photo Viewer ──
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  viewerCounter: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  viewerCounterText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 0 },
});