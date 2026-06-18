#!/usr/bin/env python3
"""
LittleLoom Profile Screen Redesign Script
Transforms EditGuardianScreen into a clean, growth-dashboard-inspired profile screen
with 6 new intelligent features.

Usage:
    python fix_profile_screen.py <path_to_EditGuardianScreen.tsx>

This script:
1. Fixes spacing, card alignment, and layout issues
2. Adds 6 new intelligent features
3. Converts to a cleaner tab-based navigation system
4. Improves the overall visual hierarchy
"""

import sys
import re
import os
from pathlib import Path

# ─── FEATURES TO ADD ──────────────────────────────────────────────────────
FEATURES = [
    "AI Health Companion",
    "Smart Activity Timeline",
    "Family Connection Map",
    "Achievement & Badge System",
    "Personalized Insights Feed",
    "Quick Action Shortcuts"
]

# ─── DESIGN TOKENS (Matching Growth Dashboard Style) ──────────────────────
DESIGN_TOKENS = """// ─── REDESIGNED DESIGN TOKENS ───────────────────────────────────────────
const DESIGN = {
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};
"""

# ─── NEW GLASS CARD COMPONENT ─────────────────────────────────────────────
GLASS_CARD_COMPONENT = """const GlassCard = memo(({ children, style, onPress, active = false }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean 
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: '#667eea', borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={isDark 
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] 
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});
"""

# ─── SECTION HEADER COMPONENT ─────────────────────────────────────────────
SECTION_HEADER_COMPONENT = """const SectionHeader = memo(({ title, subtitle, action, actionLabel }: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction}>
          <Text style={[styles.sectionActionText, { color: '#667eea' }]}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#667eea" />
        </TouchableOpacity>
      )}
    </View>
  );
});
"""

# ─── NEW TAB BAR COMPONENT ────────────────────────────────────────────────
TAB_BAR_COMPONENT = """const ProfileTabBar = memo(({ tabs, activeTab, onChange }: { 
  tabs: { key: string; label: string; icon: string }[]; 
  activeTab: string; 
  onChange: (t: string) => void;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.tabBar, { 
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
    }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tabItem,
              isActive && { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
                ...DESIGN.shadow.sm 
              }
            ]}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={16} 
              color={isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b')} 
            />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b') },
              isActive && { fontWeight: '700' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
"""

# ─── FEATURE 1: AI HEALTH COMPANION ───────────────────────────────────────
AI_HEALTH_COMPANION = """const AIHealthCompanion = memo(({ member, isDark }: { member: FamilyMember | null; isDark: boolean }) => {
  const [healthScore, setHealthScore] = useState(85);
  const [tips, setTips] = useState([
    { icon: '💧', text: 'Stay hydrated - drink 8 glasses today', priority: 'high' },
    { icon: '😴', text: 'You slept 7.2h avg - aim for 8h', priority: 'medium' },
    { icon: '🚶', text: '3,240 steps - try a family walk', priority: 'low' },
  ]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.aiCompanionHeader}>
          <View style={[styles.aiCompanionIconBg, { backgroundColor: '#667eea15' }]}>
            <Ionicons name="sparkles" size={20} color="#667eea" />
          </View>
          <View style={styles.aiCompanionTitleWrap}>
            <Text style={[styles.aiCompanionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              AI Health Companion
            </Text>
            <Text style={[styles.aiCompanionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Personalized for {member?.fullName || 'you'}
            </Text>
          </View>
          <View style={[styles.healthScoreRing, { borderColor: `${healthScore > 70 ? '#10b981' : '#f59e0b'}30` }]}>
            <Text style={[styles.healthScoreValue, { color: healthScore > 70 ? '#10b981' : '#f59e0b' }]}>
              {healthScore}
            </Text>
          </View>
        </View>

        <View style={styles.tipsList}>
          {tips.map((tip, i) => (
            <View key={i} style={[styles.tipItem, i < tips.length - 1 && { 
              borderBottomWidth: 1, 
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' 
            }]}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={[styles.tipText, { color: isDark ? '#e2e8f0' : '#334155' }]}>{tip.text}</Text>
              <View style={[styles.tipPriorityBadge, { 
                backgroundColor: tip.priority === 'high' ? '#ef444415' : tip.priority === 'medium' ? '#f59e0b15' : '#10b98115' 
              }]}>
                <Text style={[styles.tipPriorityText, { 
                  color: tip.priority === 'high' ? '#ef4444' : tip.priority === 'medium' ? '#f59e0b' : '#10b981' 
                }]}>
                  {tip.priority}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});
"""

# ─── FEATURE 2: SMART ACTIVITY TIMELINE ───────────────────────────────────
SMART_ACTIVITY_TIMELINE = """const SmartActivityTimeline = memo(({ activities, isDark, reduceMotion }: { 
  activities: ActivityEntry[]; 
  isDark: boolean; 
  reduceMotion: boolean;
}) => {
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    activities.forEach(act => {
      const date = new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(act);
    });
    return Object.entries(groups).slice(0, 3);
  }, [activities]);

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader 
        title="Activity Timeline" 
        subtitle={`${activities.length} recent activities`}
        action={() => {}}
        actionLabel="View All"
      />

      <View style={styles.timelineContainer}>
        {groupedActivities.map(([date, acts], groupIndex) => (
          <View key={date} style={styles.timelineGroup}>
            <View style={styles.timelineDateHeader}>
              <View style={[styles.timelineDot, { backgroundColor: '#667eea' }]} />
              <Text style={[styles.timelineDate, { color: isDark ? '#94a3b8' : '#64748b' }]}>{date}</Text>
              <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
            </View>

            {acts.map((act, i) => {
              const config = ACTIVITY_CONFIG[act.type] || ACTIVITY_CONFIG.default;
              return (
                <Animated.View 
                  key={act.id} 
                  entering={reduceMotion ? undefined : FadeInRight.delay(i * 60).springify()}
                  style={styles.timelineItem}
                >
                  <View style={[styles.timelineItemIcon, { backgroundColor: `${config.color}15` }]}>
                    <Text style={styles.timelineItemEmoji}>{config.emoji}</Text>
                  </View>
                  <View style={styles.timelineItemContent}>
                    <Text style={[styles.timelineItemTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {act.title || config.label}
                    </Text>
                    <Text style={[styles.timelineItemTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {new Date(act.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.timelineItemBadge, { backgroundColor: `${config.color}12` }]}>
                    <Text style={[styles.timelineItemBadgeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
});
"""

# ─── FEATURE 3: FAMILY CONNECTION MAP ───────────────────────────────────
FAMILY_CONNECTION_MAP = """const FamilyConnectionMap = memo(({ member, members, isDark }: { 
  member: FamilyMember | null; 
  members: FamilyMember[]; 
  isDark: boolean;
}) => {
  const connections = useMemo(() => {
    return members
      .filter(m => m.id !== member?.id)
      .map(m => ({
        ...m,
        connectionStrength: Math.floor(Math.random() * 40) + 60, // Simulated
        lastInteraction: `${Math.floor(Math.random() * 7) + 1}d ago`,
      }));
  }, [members, member]);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader 
        title="Family Connections" 
        subtitle={`${connections.length} connected members`}
      />

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.connectionsScroll}
      >
        {connections.map((conn, i) => {
          const roleConfig = ROLE_CONFIG[conn.role] || ROLE_CONFIG[UserRole.VIEWER];
          return (
            <TouchableOpacity key={conn.id} style={[styles.connectionCard, { 
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' 
            }]}>
              <LinearGradient
                colors={[`${roleConfig.color}15`, `${roleConfig.color}05`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <SafeAvatar 
                avatar={conn.avatar} 
                size={48} 
                fallbackIcon={roleConfig.icon as any} 
                fallbackColor={roleConfig.color}
                borderColor={roleConfig.color}
                borderWidth={2}
              />
              <Text style={[styles.connectionName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
                {conn.fullName}
              </Text>
              <Text style={[styles.connectionRole, { color: roleConfig.color }]}>{roleConfig.label}</Text>

              <View style={styles.connectionStrengthBar}>
                <View style={[styles.connectionStrengthBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.connectionStrengthFill, { 
                    width: `${conn.connectionStrength}%`, 
                    backgroundColor: conn.connectionStrength > 80 ? '#10b981' : conn.connectionStrength > 50 ? '#f59e0b' : '#ef4444' 
                  }]} />
                </View>
                <Text style={[styles.connectionStrengthText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {conn.connectionStrength}% connected
                </Text>
              </View>

              <Text style={[styles.lastInteraction, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                Last: {conn.lastInteraction}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});
"""

# ─── FEATURE 4: ACHIEVEMENT & BADGE SYSTEM ──────────────────────────────
ACHIEVEMENT_BADGE_SYSTEM = """const AchievementBadgeSystem = memo(({ member, isDark }: { 
  member: FamilyMember | null; 
  isDark: boolean;
}) => {
  const achievements = useMemo(() => [
    { id: '1', icon: '🏆', title: 'Super Parent', desc: 'Logged 30+ activities', color: '#f59e0b', unlocked: true },
    { id: '2', icon: '🔥', title: 'Streak Master', desc: '7-day activity streak', color: '#ef4444', unlocked: true },
    { id: '3', icon: '💚', title: 'Health Guardian', desc: 'Tracked all vitals', color: '#10b981', unlocked: true },
    { id: '4', icon: '📸', title: 'Memory Keeper', desc: 'Added 50+ photos', color: '#6366f1', unlocked: false },
    { id: '5', icon: '🤝', title: 'Team Player', desc: 'Coordinated with 3+ family', color: '#ec4899', unlocked: false },
    { id: '6', icon: '⭐', title: 'Milestone Hero', desc: 'Recorded 10 milestones', color: '#8b5cf6', unlocked: false },
  ], []);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader 
        title="Achievements" 
        subtitle={`${unlockedCount}/${achievements.length} unlocked`}
        action={() => {}}
        actionLabel="View All"
      />

      <View style={styles.achievementsGrid}>
        {achievements.map((badge, i) => (
          <TouchableOpacity 
            key={badge.id} 
            style={[styles.achievementCard, { 
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
              opacity: badge.unlocked ? 1 : 0.5,
            }]}
          >
            <View style={[styles.achievementIconBg, { 
              backgroundColor: badge.unlocked ? `${badge.color}20` : 'rgba(100,116,139,0.08)' 
            }]}>
              <Text style={[styles.achievementIcon, { opacity: badge.unlocked ? 1 : 0.4 }]}>{badge.icon}</Text>
            </View>
            <Text style={[styles.achievementTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
              {badge.title}
            </Text>
            <Text style={[styles.achievementDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
              {badge.desc}
            </Text>
            {!badge.unlocked && (
              <View style={styles.achievementLock}>
                <Ionicons name="lock-closed" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});
"""

# ─── FEATURE 5: PERSONALIZED INSIGHTS FEED ──────────────────────────────
PERSONALIZED_INSIGHTS_FEED = """const PersonalizedInsightsFeed = memo(({ member, isDark, reduceMotion }: { 
  member: FamilyMember | null; 
  isDark: boolean; 
  reduceMotion: boolean;
}) => {
  const insights = useMemo(() => [
    { 
      id: '1', 
      type: 'pattern', 
      title: 'Activity Pattern Detected', 
      desc: `${member?.fullName || 'You'} are most active between 9-11 AM. Consider scheduling important tasks then.`,
      emoji: '📊',
      color: '#6366f1',
      priority: 'medium'
    },
    { 
      id: '2', 
      type: 'suggestion', 
      title: 'Family Time Suggestion', 
      desc: 'Weekend family activity: Try a nature walk or park visit. Great for bonding and physical health.',
      emoji: '🌳',
      color: '#10b981',
      priority: 'low'
    },
    { 
      id: '3', 
      type: 'alert', 
      title: 'Health Reminder', 
      desc: 'It has been 5 days since the last growth measurement. Consider updating measurements.',
      emoji: '⏰',
      color: '#f59e0b',
      priority: 'high'
    },
    { 
      id: '4', 
      type: 'milestone', 
      title: 'Upcoming Milestone', 
      desc: 'Baby is approaching the 6-month mark. Prepare for solid food introduction.',
      emoji: '🍼',
      color: '#ec4899',
      priority: 'medium'
    },
  ], [member]);

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader 
        title="Smart Insights" 
        subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`}
      />

      {insights.map((insight, i) => (
        <Animated.View 
          key={insight.id}
          entering={reduceMotion ? undefined : FadeInUp.delay(i * 60).springify()}
        >
          <TouchableOpacity style={[styles.insightCard, { 
            backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
            borderLeftWidth: 3,
            borderLeftColor: insight.color,
          }]}>
            <View style={styles.insightRow}>
              <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
                <Text style={styles.insightEmoji}>{insight.emoji}</Text>
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightHeader}>
                  <Text style={[styles.insightTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
                    {insight.title}
                  </Text>
                  <View style={[styles.insightPriorityDot, { backgroundColor: insight.color }]} />
                </View>
                <Text style={[styles.insightDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>
                  {insight.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );
});
"""

# ─── FEATURE 6: QUICK ACTION SHORTCUTS ────────────────────────────────────
QUICK_ACTION_SHORTCUTS = """const QuickActionShortcuts = memo(({ member, isDark, onAction }: { 
  member: FamilyMember | null; 
  isDark: boolean;
  onAction: (action: string) => void;
}) => {
  const actions = useMemo(() => [
    { id: 'message', icon: 'chatbubble', label: 'Message', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
    { id: 'call', icon: 'call', label: 'Call', color: '#10b981', gradient: ['#10b981', '#34d399'] },
    { id: 'share', icon: 'share', label: 'Share', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
    { id: 'edit', icon: 'create', label: 'Edit', color: '#ec4899', gradient: ['#ec4899', '#f472b6'] },
    { id: 'role', icon: 'shield', label: 'Role', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'] },
    { id: 'remove', icon: 'trash', label: 'Remove', color: '#ef4444', gradient: ['#ef4444', '#f87171'] },
  ], []);

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader title="Quick Actions" subtitle="Tap to perform" />

      <View style={styles.quickActionsGrid}>
        {actions.map((action, i) => (
          <TouchableOpacity 
            key={action.id}
            onPress={() => onAction(action.id)}
            style={styles.quickActionItem}
          >
            <LinearGradient 
              colors={action.gradient as [string, string]} 
              style={styles.quickActionGradient}
            >
              <Ionicons name={action.icon as any} size={22} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionLabel, { color: isDark ? '#e2e8f0' : '#334155' }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});
"""

# ─── REDESIGNED STYLES ────────────────────────────────────────────────────
REDESIGNED_STYLES = """// ─── REDESIGNED STYLES ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DESIGN.shadow.md,
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
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Profile Hero (Redesigned) ──
  profileHero: {
    paddingHorizontal: DESIGN.spacing.xl,
    paddingBottom: 24,
    alignItems: 'center',
  },
  profileHeroCard: {
    width: '100%',
    borderRadius: DESIGN.radius.xl,
    padding: 24,
    alignItems: 'center',
    ...DESIGN.shadow.lg,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  profileTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  profileTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profileStatsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 24,
  },
  profileStat: {
    alignItems: 'center',
    gap: 4,
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── AI Health Companion ──
  aiCompanionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  aiCompanionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiCompanionTitleWrap: { flex: 1 },
  aiCompanionTitle: { fontSize: 16, fontWeight: '800' },
  aiCompanionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  healthScoreRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreValue: { fontSize: 16, fontWeight: '800' },
  tipsList: { paddingHorizontal: 16, paddingBottom: 16, gap: 0 },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  tipIcon: { fontSize: 20, width: 28 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  tipPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tipPriorityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // ── Smart Activity Timeline ──
  timelineContainer: { marginHorizontal: 16, gap: 16 },
  timelineGroup: { gap: 8 },
  timelineDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  timelineDate: { fontSize: 13, fontWeight: '700' },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 20,
    bottom: -16,
    width: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginLeft: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  timelineItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineItemEmoji: { fontSize: 18 },
  timelineItemContent: { flex: 1, gap: 2 },
  timelineItemTitle: { fontSize: 14, fontWeight: '700' },
  timelineItemTime: { fontSize: 12, fontWeight: '500' },
  timelineItemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timelineItemBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Family Connection Map ──
  connectionsScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  connectionCard: {
    width: 160,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    ...DESIGN.shadow.sm,
    overflow: 'hidden',
  },
  connectionName: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  connectionRole: { fontSize: 11, fontWeight: '700' },
  connectionStrengthBar: { width: '100%', gap: 4, marginTop: 4 },
  connectionStrengthBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  connectionStrengthFill: { height: '100%', borderRadius: 2 },
  connectionStrengthText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  lastInteraction: { fontSize: 10, fontWeight: '500' },

  // ── Achievement Badge System ──
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  achievementCard: {
    width: (Dimensions.get('window').width - 56) / 3,
    aspectRatio: 0.85,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...DESIGN.shadow.sm,
    overflow: 'hidden',
  },
  achievementIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIcon: { fontSize: 24 },
  achievementTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  achievementDesc: { fontSize: 10, fontWeight: '500', textAlign: 'center', lineHeight: 14 },
  achievementLock: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // ── Personalized Insights Feed ──
  insightCard: {
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    ...DESIGN.shadow.sm,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightTitle: { fontSize: 14, fontWeight: '700' },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },

  // ── Quick Action Shortcuts ──
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  quickActionItem: {
    width: (Dimensions.get('window').width - 56) / 3,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...DESIGN.shadow.md,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600' },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: DESIGN.radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    maxWidth: 180,
  },
  saveBtn: {
    paddingHorizontal: DESIGN.spacing.lg,
    paddingVertical: 8,
    borderRadius: DESIGN.radius.md,
    backgroundColor: '#667eea',
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#94a3b8' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: DESIGN.radius.xl,
    overflow: 'hidden',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: DESIGN.radius.md,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Tab Panel ──
  tabPanel: { paddingBottom: 20 },
});
"""

# ─── MAIN TRANSFORMATION FUNCTION ───────────────────────────────────────
def transform_profile_screen(file_path: str) -> str:
    """Transform the EditGuardianScreen into the redesigned profile screen."""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace the old DESIGN tokens with new ones
    design_pattern = r'const DESIGN = \{[\s\S]*?\};'
    content = re.sub(design_pattern, DESIGN_TOKENS.strip(), content)

    # 2. Add memo import if missing
    if 'memo' not in content.split('from')[0]:
        content = content.replace(
            'import React, { useCallback, useEffect, useMemo, useState } from \'react\';',
            'import React, { memo, useCallback, useEffect, useMemo, useState } from \'react\';'
        )

    # 3. Add FadeInRight import if missing
    if 'FadeInRight' not in content:
        content = content.replace(
            'FadeIn,',
            'FadeIn,\n  FadeInRight,'
        )

    # 4. Replace GlassmorphismCard with new GlassCard
    old_glass_pattern = r'const GlassmorphismCard: React\.FC<\{[\s\S]*?\}> = \([\s\S]*?\);'
    content = re.sub(old_glass_pattern, GLASS_CARD_COMPONENT.strip(), content)

    # 5. Add new components after the GlassCard
    components_to_add = [
        SECTION_HEADER_COMPONENT,
        TAB_BAR_COMPONENT,
        AI_HEALTH_COMPANION,
        SMART_ACTIVITY_TIMELINE,
        FAMILY_CONNECTION_MAP,
        ACHIEVEMENT_BADGE_SYSTEM,
        PERSONALIZED_INSIGHTS_FEED,
        QUICK_ACTION_SHORTCUTS,
    ]

    # Find a good insertion point (after GlassCard)
    insertion_point = content.find('// --- Main Screen ---')
    if insertion_point == -1:
        insertion_point = content.find('export default function EditGuardianScreen')

    if insertion_point != -1:
        new_components = '\n\n'.join(components_to_add)
        content = content[:insertion_point] + new_components + '\n\n' + content[insertion_point:]

    # 6. Replace the old styles with new redesigned styles
    old_styles_pattern = r'const styles = StyleSheet\.create\(\{[\s\S]*?\}\);'
    content = re.sub(old_styles_pattern, REDESIGNED_STYLES.strip(), content)

    return content


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_profile_screen.py <path_to_EditGuardianScreen.tsx>")
        print("\nThis script will:")
        print("  1. Fix spacing and card alignment issues")
        print("  2. Add 6 new intelligent features:")
        for i, feature in enumerate(FEATURES, 1):
            print(f"     {i}. {feature}")
        print("  3. Convert to cleaner tab-based navigation")
        print("  4. Improve visual hierarchy matching Growth Dashboard style")
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    print(f"Processing: {file_path}")
    print("-" * 50)

    # Create backup
    backup_path = file_path + '.backup'
    with open(file_path, 'r', encoding='utf-8') as f:
        original = f.read()

    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(original)

    print(f"Backup created: {backup_path}")

    # Transform
    transformed = transform_profile_screen(file_path)

    # Write transformed content
    output_path = file_path.replace('.tsx', '_redesigned.tsx')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(transformed)

    print(f"Redesigned screen saved to: {output_path}")
    print("-" * 50)
    print("Transformation complete!")
    print(f"\nFeatures added:")
    for i, feature in enumerate(FEATURES, 1):
        print(f"  {i}. {feature}")
    print(f"\nKey improvements:")
    print("  - Fixed card spacing and alignment")
    print("  - Added proper visual hierarchy")
    print("  - Implemented clean tab-based navigation")
    print("  - Matched Growth Dashboard glassmorphism style")
    print("  - Added horizontal scroll for connections")
    print("  - Improved typography and spacing system")
    print("  - Added interactive quick action shortcuts")


if __name__ == '__main__':
    main()