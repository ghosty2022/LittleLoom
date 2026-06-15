
import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomization } from '../../hooks/useCustomization';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════ */

export const TOKENS = {
  colors: {
    primary: '#667eea',
    primaryLight: '#e0e7ff',
    secondary: '#764ba2',
    accent: '#fa709a',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: 'rgba(255,255,255,0.85)',
    border: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
  },
  typography: {
    hero: { fontSize: 32, fontWeight: '800', letterSpacing: -1.5 },
    title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { fontSize: 15, fontWeight: '600' },
    body: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
    metric: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
    small: { fontSize: 11, fontWeight: '600' },
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  },
  radius: {
    sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════
   ENHANCED GLASS CARD
   ═══════════════════════════════════════════════════════════════ */

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  borderColor?: string;
  delay?: number;
  animated?: boolean;
}

export const GlassCard = memo<GlassCardProps>(({
  children, style, onPress, intensity = 80, borderColor, delay = 0, animated = true,
}) => {
  const { isDark } = useCustomization();
  const tint = isDark ? 'dark' : 'light';

  const CardWrapper = animated
    ? ({ children: c }: { children: React.ReactNode }) => (
        <Animated.View entering={FadeInUp.delay(delay).springify()}>{c}</Animated.View>
      )
    : React.Fragment;

  const content = (
    <View style={[
      styles.glassCard,
      {
        backgroundColor: isDark ? 'rgba(30,41,59,0.7)' : TOKENS.colors.surfaceElevated,
        borderColor: borderColor || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'),
      },
      style,
    ]}>
      <View style={[styles.glassBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]} />
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={tint} />
      <View style={styles.glassContent}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <CardWrapper>
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>
      </CardWrapper>
    );
  }

  return <CardWrapper>{content}</CardWrapper>;
});

/* ═══════════════════════════════════════════════════════════════
   UNIFIED HEADER
   ═══════════════════════════════════════════════════════════════ */

interface UnifiedHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightActions?: React.ReactNode;
  scrollY?: Animated.SharedValue<number>;
  compact?: boolean;
}

export const UnifiedHeader = memo<UnifiedHeaderProps>(({
  title, subtitle, showBack = true, onBack, rightActions, scrollY, compact = false,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, themeColors } = useCustomization();

  const headerStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const opacity = interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 80], [-20, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  return (
    <>
      {/* Sticky compact header */}
      {scrollY && (
        <Animated.View style={[styles.stickyHeader, { top: insets.top + 8 }, headerStyle]}>
          <BlurView intensity={isDark ? 40 : 90} style={[styles.stickyBlur, { borderRadius: TOKENS.radius.xl }]} tint={isDark ? 'dark' : 'light'}>
            <Text style={[styles.stickyTitle, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>{title}</Text>
            {subtitle && <Text style={styles.stickySubtitle}>{subtitle}</Text>}
          </BlurView>
        </Animated.View>
      )}

      {/* Main header */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          {showBack && (
            <TouchableOpacity onPress={onBack} style={styles.headerButton}>
              <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : TOKENS.colors.textPrimary} />
            </TouchableOpacity>
          )}

          <Animated.View style={[styles.headerCenter, titleStyle]}>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>{title}</Text>
            {subtitle && <Text style={[styles.headerSubtitle, { color: TOKENS.colors.textSecondary }]}>{subtitle}</Text>}
          </Animated.View>

          {rightActions && <View style={styles.headerActions}>{rightActions}</View>}
        </View>
      </Animated.View>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════
   UNIFIED METRIC CARD
   ═══════════════════════════════════════════════════════════════ */

interface UnifiedMetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  color: string;
  percentile?: number;
  status?: { label: string; color: string };
  sparklineData?: number[];
  onPress?: () => void;
  delay?: number;
  size?: 'small' | 'medium' | 'large';
}

export const UnifiedMetricCard = memo<UnifiedMetricCardProps>(({
  title, value, unit = '', change, changeType = 'neutral', icon, color,
  percentile, status, sparklineData, onPress, delay = 0, size = 'medium',
}) => {
  const { isDark } = useCustomization();

  const sizeStyles = {
    small: { width: (SCREEN_W - 52) / 2, padding: 12 },
    medium: { width: (SCREEN_W - 52) / 2, padding: 16 },
    large: { width: SCREEN_W - 40, padding: 20 },
  };

  const changeColors = {
    positive: TOKENS.colors.success,
    negative: TOKENS.colors.danger,
    neutral: TOKENS.colors.textSecondary,
  };

  const changeIcons = {
    positive: 'trending-up',
    negative: 'trending-down',
    neutral: 'remove',
  };

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[sizeStyles[size]]}>
        <GlassCard style={{ padding: sizeStyles[size].padding }}>
          <View style={styles.metricHeader}>
            <View style={[styles.metricIconBg, { backgroundColor: `${color}18` }]}>
              <Text style={styles.metricIcon}>{icon}</Text>
            </View>
            {percentile !== undefined && (
              <View style={[styles.percentileBadge, { backgroundColor: `${color}15` }]}>
                <Text style={[styles.percentileText, { color }]}>{percentile}th</Text>
              </View>
            )}
          </View>

          <View style={styles.metricBody}>
            <Text style={[styles.metricValue, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>
              {value}
              <Text style={[styles.metricUnit, { color }]}>{unit}</Text>
            </Text>
            <Text style={[styles.metricTitle, { color: TOKENS.colors.textSecondary }]}>{title}</Text>
          </View>

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 1 && (
            <View style={styles.sparklineContainer}>
              <Sparkline data={sparklineData} color={color} />
            </View>
          )}

          <View style={styles.metricFooter}>
            {change && (
              <View style={styles.changeRow}>
                <Ionicons name={changeIcons[changeType] as any} size={12} color={changeColors[changeType]} />
                <Text style={[styles.metricChange, { color: changeColors[changeType] }]}>{change}</Text>
              </View>
            )}
            {status && (
              <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SPARKLINE (Mini Chart)
   ═══════════════════════════════════════════════════════════════ */

const Sparkline = memo(({ data, color }: { data: number[]; color: string }) => {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: height - ((val - min) / range) * height,
  }));

  const pathD = points.reduce((acc, p, i) => 
    `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, ''
  );

  return (
    <View style={{ width, height }}>
      <Text style={{ fontSize: 8, color }}>{pathD}</Text>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SMART INSIGHT CARD
   ═══════════════════════════════════════════════════════════════ */

interface SmartInsightCardProps {
  type: 'trend' | 'alert' | 'prediction' | 'milestone' | 'correlation' | 'concern';
  title: string;
  description: string;
  icon?: string;
  color?: string;
  priority?: 'high' | 'medium' | 'low';
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  delay?: number;
}

export const SmartInsightCard = memo<SmartInsightCardProps>(({
  type, title, description, icon, color, priority = 'medium', action, onDismiss, delay = 0,
}) => {
  const { isDark } = useCustomization();

  const typeConfig = {
    trend: { icon: '📈', color: TOKENS.colors.success },
    alert: { icon: '⚠️', color: TOKENS.colors.warning },
    prediction: { icon: '🔮', color: TOKENS.colors.info },
    milestone: { icon: '🏆', color: '#f59e0b' },
    correlation: { icon: '🔗', color: TOKENS.colors.primary },
    concern: { icon: '🚨', color: TOKENS.colors.danger },
  };

  const config = typeConfig[type];
  const effectiveColor = color || config.color;
  const effectiveIcon = icon || config.icon;

  const priorityBorder = {
    high: { borderLeftWidth: 3, borderLeftColor: TOKENS.colors.danger },
    medium: { borderLeftWidth: 2, borderLeftColor: effectiveColor },
    low: {},
  };

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <GlassCard style={[styles.insightCard, priorityBorder[priority]]}>
        <View style={styles.insightHeader}>
          <View style={[styles.insightIconBg, { backgroundColor: `${effectiveColor}12` }]}>
            <Text style={styles.insightIcon}>{effectiveIcon}</Text>
          </View>
          <View style={styles.insightContent}>
            <Text style={[styles.insightTitle, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.insightDesc, { color: TOKENS.colors.textSecondary }]} numberOfLines={2}>{description}</Text>
          </View>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
              <Ionicons name="close" size={18} color={TOKENS.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {action && (
          <TouchableOpacity style={[styles.insightAction, { backgroundColor: `${effectiveColor}12` }]} onPress={action.onPress}>
            <Ionicons name="arrow-forward" size={14} color={effectiveColor} />
            <Text style={[styles.insightActionText, { color: effectiveColor }]}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════ */

interface SectionHeaderProps {
  title: string;
  icon?: string;
  action?: { label: string; onPress: () => void };
  badge?: number | string;
}

export const SectionHeader = memo<SectionHeaderProps>(({ title, icon, action, badge }) => {
  const { isDark } = useCustomization();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>{title}</Text>
        {badge !== undefined && (
          <View style={[styles.sectionBadge, { backgroundColor: `${TOKENS.colors.primary}15` }]}>
            <Text style={[styles.sectionBadgeText, { color: TOKENS.colors.primary }]}>{badge}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} style={styles.sectionAction}>
          <Text style={[styles.sectionActionText, { color: TOKENS.colors.primary }]}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={TOKENS.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QUICK ACTION BUTTON
   ═══════════════════════════════════════════════════════════════ */

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  delay?: number;
  variant?: 'filled' | 'outlined' | 'ghost';
}

export const QuickAction = memo<QuickActionProps>(({ icon, label, color, onPress, delay = 0, variant = 'filled' }) => {
  const variants = {
    filled: { backgroundColor: color, textColor: '#fff' },
    outlined: { backgroundColor: `${color}12`, textColor: color, borderColor: `${color}25`, borderWidth: 1 },
    ghost: { backgroundColor: 'transparent', textColor: color },
  };

  const v = variants[variant];

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.quickAction, { backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: v.borderWidth || 0, borderRadius: TOKENS.radius.md }]}
      >
        <Ionicons name={icon} size={22} color={v.textColor} />
        <Text style={[styles.quickActionLabel, { color: v.textColor }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════ */

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  delay?: number;
}

export const EmptyState = memo<EmptyStateProps>(({ icon, title, subtitle, actionLabel, onAction, delay = 0 }) => {
  const { isDark } = useCustomization();

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : TOKENS.colors.surface }]}>
        <Text style={styles.emptyIcon}>{icon}</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : TOKENS.colors.textPrimary }]}>{title}</Text>
      {subtitle && <Text style={[styles.emptySubtitle, { color: TOKENS.colors.textSecondary }]}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={[styles.emptyAction, { backgroundColor: TOKENS.colors.primary }]}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════════════ */

export const SkeletonCard = memo(({ height = 100, width = '100%' }: { height?: number; width?: number | string }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withTiming(0.7, { duration: 800 });
    const interval = setInterval(() => {
      opacity.value = opacity.value === 0.3 ? 0.7 : 0.3;
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, { height, width: width as any, borderRadius: TOKENS.radius.lg, backgroundColor: TOKENS.colors.border }]} />
  );
});

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: TOKENS.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...TOKENS.shadow.md,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
  glassContent: { flex: 1, position: 'relative', zIndex: 2 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: TOKENS.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: TOKENS.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: TOKENS.spacing.md },
  headerTitle: { fontSize: TOKENS.typography.title.fontSize, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: TOKENS.spacing.sm },

  stickyHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 80,
    zIndex: 99,
  },
  stickyBlur: {
    paddingHorizontal: TOKENS.spacing.lg,
    paddingVertical: TOKENS.spacing.sm,
    alignItems: 'center',
    minWidth: 200,
    overflow: 'hidden',
  },
  stickyTitle: { fontSize: 16, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '600', color: TOKENS.colors.textSecondary },

  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: TOKENS.spacing.md,
  },
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: TOKENS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: { fontSize: 20 },
  percentileBadge: {
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: TOKENS.radius.sm,
  },
  percentileText: { fontSize: 11, fontWeight: '700' },
  metricBody: { gap: TOKENS.spacing.xs },
  metricValue: {
    fontSize: TOKENS.typography.metric.fontSize,
    fontWeight: '800',
    letterSpacing: -1,
  },
  metricUnit: { fontSize: 14, fontWeight: '600', marginLeft: 2 },
  metricTitle: {
    fontSize: TOKENS.typography.caption.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sparklineContainer: { marginTop: TOKENS.spacing.sm },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: TOKENS.spacing.sm,
  },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricChange: { fontSize: 12, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: TOKENS.radius.sm,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  insightCard: { padding: TOKENS.spacing.lg, marginBottom: TOKENS.spacing.md },
  insightHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: TOKENS.spacing.md },
  insightIconBg: {
    width: 44,
    height: 44,
    borderRadius: TOKENS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIcon: { fontSize: 22 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 13, lineHeight: 18 },
  dismissBtn: { padding: 4 },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: TOKENS.spacing.md,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radius.md,
    alignSelf: 'flex-start',
  },
  insightActionText: { fontSize: 13, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: TOKENS.spacing.md,
    paddingHorizontal: TOKENS.spacing.xs,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: TOKENS.spacing.sm },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: TOKENS.typography.title.fontSize, fontWeight: '800', letterSpacing: -0.3 },
  sectionBadge: {
    borderRadius: TOKENS.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionText: { fontSize: 13, fontWeight: '600' },

  quickAction: {
    alignItems: 'center',
    paddingVertical: TOKENS.spacing.lg,
    paddingHorizontal: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: TOKENS.spacing.xxxl, paddingHorizontal: TOKENS.spacing.xl },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: TOKENS.radius.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: TOKENS.spacing.lg,
    ...TOKENS.shadow.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: TOKENS.spacing.sm },
  emptySubtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  emptyAction: {
    marginTop: TOKENS.spacing.lg,
    paddingHorizontal: TOKENS.spacing.xl,
    paddingVertical: TOKENS.spacing.md,
    borderRadius: TOKENS.radius.lg,
    ...TOKENS.shadow.sm,
  },
  emptyActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default {
  TOKENS,
  GlassCard,
  UnifiedHeader,
  UnifiedMetricCard,
  SmartInsightCard,
  SectionHeader,
  QuickAction,
  EmptyState,
  SkeletonCard,
};
