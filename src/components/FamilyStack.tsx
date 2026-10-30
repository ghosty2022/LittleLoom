import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { UserRole, getMemberDisplayLabel, normalizeRole } from '../types/roles';
import { SafeAvatar } from './SafeAvatar';

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
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
  gray900: '#1c1917',
  darkCard: '#292524',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16 },
  radius: { lg: 18, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  },
};

const ROLE_COLORS: Record<string, string> = {
  parent1: '#667eea',
  parent2: '#fa709a',
  guardian: '#11998e',
  viewer: '#64748b',
};

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

interface FamilyStackProps {
  members: any[];
  isDark: boolean;
  /** Header "Manage" action. */
  onPress: () => void;
  /** Fires when a member chip is tapped. Defaults to `onPress`. */
  onMemberPress?: (member: any) => void;
}

export const FamilyStack: React.FC<FamilyStackProps> = ({
  members,
  isDark,
  onPress,
  onMemberPress,
}) => {
  const ordered = useMemo(() => {
    const rank: Record<string, number> = { parent1: 0, parent2: 1, guardian: 2, viewer: 3 };
    return [...(members || [])].sort((a, b) => {
      const ra = rank[normalizeRole((a as any).role)] ?? 4;
      const rb = rank[normalizeRole((b as any).role)] ?? 4;
      return ra - rb;
    });
  }, [members]);

  return (
    <Animated.View entering={FadeInUp.delay(260).springify()}>
      <SectionHeader
        title="Your Family"
        subtitle={`${ordered.length} member${ordered.length !== 1 ? 's' : ''}`}
        icon="people-outline"
        color={DS.primary}
        action={onPress}
        actionLabel="Manage"
      />
      {ordered.length === 0 ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
          <View
            style={[
              styles.familyStackCard,
              {
                backgroundColor: isDark ? DS.darkCard : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
          >
            <View style={{ padding: DS.space.lg, alignItems: 'center', gap: 6 }}>
              <Ionicons name="people-outline" size={28} color={isDark ? DS.gray500 : DS.gray400} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? DS.gray300 : DS.gray700 }}>
                Invite someone to your family
              </Text>
              <Text style={{ fontSize: 11, color: isDark ? DS.gray500 : DS.gray500, textAlign: 'center' }}>
                Tap Manage to add a co-parent, guardian, or viewer.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.familyStackCard,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isDark ? DS.darkBorder : DS.gray200,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.familyStackRow}
          >
            {ordered.slice(0, 10).map((m, i) => {
              const roleCfg = ROLE_COLORS[normalizeRole((m as any).role)] || ROLE_COLORS.viewer;
              const label = getMemberDisplayLabel({
                role: m.role,
                relationship: m.relationship,
              });
              return (
                <TouchableOpacity
                  key={`${m.id}_${m.role}_${i}`}
                  onPress={() => {
                    if (onMemberPress) onMemberPress(m);
                    else onPress();
                  }}
                  activeOpacity={0.85}
                  style={{ alignItems: 'center', width: 72, marginRight: 8 }}
                >
                  <View
                    style={{
                      borderRadius: 26,
                      borderWidth: 2,
                      borderColor: isDark ? DS.darkCard : DS.white,
                    }}
                  >
                    <SafeAvatar avatar={m.avatar} size={48} fallbackColor={roleCfg} />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isDark ? DS.white : DS.gray900,
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {m.fullName?.split(' ')[0] || 'Member'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: roleCfg,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {ordered.length > 10 && (
              <View style={{ alignItems: 'center', width: 72 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark ? DS.darkSurface : DS.gray100,
                    borderWidth: 2,
                    borderColor: isDark ? DS.darkCard : DS.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: isDark ? DS.gray300 : DS.gray600,
                    }}
                  >
                    +{ordered.length - 10}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    color: isDark ? DS.gray500 : DS.gray500,
                    marginTop: 6,
                  }}
                >
                  more
                </Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: isDark ? DS.darkBorder : DS.gray200,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: DS.primary,
                }}
              >
                Manage family
              </Text>
              <Ionicons name="chevron-forward" size={13} color={DS.primary} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    marginTop: DS.space.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  familyStackCard: {
    marginHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  familyStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DS.space.lg,
  },
});

export default FamilyStack;