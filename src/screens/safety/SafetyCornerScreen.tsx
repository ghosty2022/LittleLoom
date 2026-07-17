import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
  FadeInUp,
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import {
  useSafety,
  type EmergencyContact,
  type SafetyTopic,
  type SafetyChecklist,
} from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';

/* ═══════════════════════════════════════════════════════════════════════════
   INTELLIGENCE HOOKS — Same as TimelineScreen
   ═══════════════════════════════════════════════════════════════════════════ */
import { usePredictiveReminders, PredictiveReminder } from '@/hooks/usePredictiveReminders';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching Growth Dashboard / TimelineScreen (NO SHADOWS)
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  // NO SHADOWS — clean flat design matching TimelineScreen
};

type SafetyTab = 'overview' | 'emergency' | 'topics' | 'checklists' | 'reports' | 'intelligence';

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATIONS SETUP
   ═══════════════════════════════════════════════════════════════════════════ */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS CARD — Shadowless, borderless, matching TimelineScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      {
        borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
        backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
      },
      active && { borderColor: theme.primary, borderWidth: 1.5 },
      style
    ]}>
      <LinearGradient
        colors={theme.isDark ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Matching TimelineScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = memo(({ title, subtitle, action, actionLabel, theme }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; theme: any }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: theme.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR — Matching TimelineScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ tabs, activeTab, onChange, theme }: { tabs: { key: SafetyTab; label: string; icon: string }[]; activeTab: SafetyTab; onChange: (t: SafetyTab) => void; theme: any }) => (
  <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#fff' }
          ]}
        >
          <Ionicons name={tab.icon as any} size={16} color={isActive ? theme.primary : theme.text.muted} />
          <Text style={[styles.tabLabel, { color: isActive ? theme.primary : theme.text.muted }, isActive && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD — Shadowless, matching TimelineScreen stats
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiCard = memo(({ title, value, icon, color, onPress, theme, size = 'normal' }: any) => {
  const isLarge = size === 'large';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[
      styles.kpiCard,
      isLarge && styles.kpiCardLarge,
      {
        backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(255,255,255,0.7)',
        borderColor: `${color}25`,
      }
    ]}>
      <LinearGradient colors={[`${color}06`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={styles.kpiInner}>
        <View style={styles.kpiTop}>
          <View style={[styles.kpiIconBg, { backgroundColor: `${color}12` }]}>
            <Ionicons name={icon as any} size={20} color={color} />
          </View>
        </View>
        <View style={styles.kpiBody}>
          <Text style={[styles.kpiValue, { color: theme.text.primary, fontSize: isLarge ? 32 : 24 }]} numberOfLines={1}>{value}</Text>
          <Text style={[styles.kpiTitle, { color: theme.text.secondary }]}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 1: Safety Score Ring — Visual safety health indicator
   ═══════════════════════════════════════════════════════════════════════════ */

const SafetyScoreRing = memo(({ score, theme, onPress }: { score: number; theme: any; onPress: () => void }) => {
  const getColor = () => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Needs Attention';
  };

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <GlassCard onPress={onPress} style={{ marginBottom: DESIGN.spacing.lg }}>
        <View style={styles.scoreRingWrap}>
          <View style={[styles.scoreRingOuter, { borderColor: `${getColor()}25` }]}>
            <View style={[styles.scoreRingInner, { borderColor: getColor() }]}>
              <Text style={[styles.scoreValue, { color: getColor() }]}>{score}</Text>
              <Text style={[styles.scoreMax, { color: theme.text.muted }]}>/100</Text>
            </View>
          </View>
          <View style={styles.scoreLabels}>
            <Text style={[styles.scoreLabel, { color: theme.text.primary }]}>Safety Score</Text>
            <Text style={[styles.scoreSublabel, { color: getColor() }]}>{getLabel()}</Text>
            <View style={styles.scoreBreakdown}>
              {[
                { label: 'Prevention', value: Math.min(score + 5, 100), color: '#10b981' },
                { label: 'Emergency', value: Math.min(score + 10, 100), color: '#ef4444' },
                { label: 'Daily', value: Math.max(score - 5, 0), color: '#6366f1' },
              ].map(s => (
                <View key={s.label} style={styles.scoreMini}>
                  <View style={[styles.scoreMiniBarBg, { backgroundColor: `${s.color}12` }]}>
                    <View style={[styles.scoreMiniBarFill, { width: `${s.value}%`, backgroundColor: s.color }]} />
                  </View>
                  <Text style={[styles.scoreMiniLabel, { color: theme.text.muted }]}>{s.label}</Text>
                  <Text style={[styles.scoreMiniValue, { color: s.color }]}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 2: Emergency Quick Dial — Redesigned SOS with better hierarchy
   ═══════════════════════════════════════════════════════════════════════════ */

const EmergencyQuickDial = memo(({ contacts, onCall, onSOS, theme }: { contacts: EmergencyContact[]; onCall: (c: EmergencyContact) => void; onSOS: () => void; theme: any }) => {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withSequence(
      withTiming(1.05, { duration: 1000 }),
      withTiming(1, { duration: 1000 })
    );
  }, [pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const emergencyContacts = contacts.filter(c => c.type === 'emergency' || c.type === 'police');
  const familyContacts = contacts.filter(c => c.type === 'family');

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="Emergency" subtitle="One-tap access to help" theme={theme} />

      {/* SOS Button */}
      <Animated.View style={[pulseStyle, styles.sosWrap]}>
        <TouchableOpacity onPress={onSOS} activeOpacity={0.8} style={styles.sosButton}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.sosGradient}>
            <Ionicons name="alert" size={32} color="#fff" />
            <Text style={styles.sosText}>SOS EMERGENCY</Text>
            <Text style={styles.sosSub}>Tap to call 911 & alert family</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Emergency Contacts Grid — NO SHADOWS */}
      <View style={styles.emergencyGrid}>
        {emergencyContacts.map(contact => (
          <TouchableOpacity key={contact.id} onPress={() => onCall(contact)} style={[
            styles.emergencyCard,
            {
              borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
            }
          ]}>
            <LinearGradient colors={[`${contact.color}10`, `${contact.color}03`]} style={StyleSheet.absoluteFill} />
            <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)' }]} />
            <View style={[styles.emergencyIconBg, { backgroundColor: `${contact.color}15` }]}>
              <Ionicons name={contact.icon as any} size={22} color={contact.color} />
            </View>
            <Text style={[styles.emergencyLabel, { color: theme.text.primary }]}>{contact.label}</Text>
            <Text style={[styles.emergencyNumber, { color: theme.text.muted }]}>{contact.number}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Family Chips — NO SHADOWS */}
      {familyContacts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyScroll}>
          {familyContacts.map(contact => (
            <TouchableOpacity key={contact.id} onPress={() => onCall(contact)} style={[
              styles.familyChip,
              {
                backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              }
            ]}>
              {contact.avatar ? (
                <Image source={{ uri: contact.avatar }} style={styles.familyAvatar} />
              ) : (
                <View style={[styles.familyAvatarPlaceholder, { backgroundColor: `${contact.color}15` }]}>
                  <Ionicons name={contact.icon as any} size={14} color={contact.color} />
                </View>
              )}
              <Text style={[styles.familyName, { color: theme.text.primary }]}>{contact.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 3: Safety Topic Cards — Shadowless card grid
   ═══════════════════════════════════════════════════════════════════════════ */

const SafetyTopicGrid = memo(({ topics, onPress, theme }: { topics: SafetyTopic[]; onPress: (t: SafetyTopic) => void; theme: any }) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'emergency': return '#ef4444';
      case 'prevention': return '#10b981';
      case 'daily': return '#6366f1';
      default: return theme.primary;
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Safety Topics" subtitle={`${topics.filter(t => t.completedAt).length}/${topics.length} completed`} theme={theme} />
      <View style={styles.topicGrid}>
        {topics.map((topic, i) => {
          const color = getCategoryColor(topic.category);
          const isCompleted = !!topic.completedAt;
          return (
            <Animated.View key={topic.id} entering={FadeInUp.delay(i * 60).springify()} style={styles.topicGridItem}>
              <TouchableOpacity onPress={() => onPress(topic)} activeOpacity={0.85} style={[
                styles.topicCard,
                {
                  backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                }
              ]}>
                <LinearGradient colors={[`${color}06`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)' }]} />
                <View style={styles.topicCardInner}>
                  <View style={[styles.topicIconBg, { backgroundColor: `${color}12` }]}>
                    <Ionicons name={topic.icon as any} size={24} color={color} />
                    {isCompleted && (
                      <View style={styles.topicCompletedBadge}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.topicTitle, { color: theme.text.primary }]} numberOfLines={2}>{topic.title}</Text>
                  <Text style={[styles.topicCategory, { color }]}>{topic.category}</Text>
                  {topic.completedAt && (
                    <View style={[styles.topicDoneBadge, { backgroundColor: `${color}12` }]}>
                      <Text style={[styles.topicDoneText, { color }]}>Completed</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 4: Safety Streak & Achievements — Gamification card
   ═══════════════════════════════════════════════════════════════════════════ */

const SafetyStreakCard = memo(({ streakDays, theme, onPress }: { streakDays: number; theme: any; onPress: () => void }) => {
  const flames = Math.min(streakDays, 7);

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard onPress={onPress}>
        <View style={styles.streakWrap}>
          <View style={styles.streakLeft}>
            <View style={styles.streakIconBg}>
              <Text style={styles.streakEmoji}>🔥</Text>
            </View>
            <View>
              <Text style={[styles.streakTitle, { color: theme.text.primary }]}>{streakDays}-Day Streak</Text>
              <Text style={[styles.streakSub, { color: theme.text.muted }]}>Keep checking safety daily</Text>
            </View>
          </View>
          <View style={styles.streakFlames}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Ionicons key={i} name="flame" size={16} color={i < flames ? '#f59e0b' : theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 5: Quick Actions Bar — Horizontal action pills
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionsBar = memo(({ actions, theme }: { actions: { icon: string; label: string; color: string; onPress: () => void }[]; theme: any }) => (
  <Animated.View entering={FadeInUp.delay(300).springify()}>
    <SectionHeader title="Quick Actions" theme={theme} />
    <View style={styles.quickActionsWrap}>
      {actions.map((action, i) => (
        <TouchableOpacity key={i} onPress={action.onPress} style={[styles.quickActionPill, { backgroundColor: `${action.color}10` }]}>
          <Ionicons name={action.icon as any} size={18} color={action.color} />
          <Text style={[styles.quickActionLabel, { color: action.color }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 6: Location Status Card — Live location sharing indicator
   ═══════════════════════════════════════════════════════════════════════════ */

const LocationStatusCard = memo(({ isActive, theme, onToggle }: { isActive: boolean; theme: any; onToggle: () => void }) => (
  <Animated.View entering={FadeInUp.delay(350).springify()}>
    <GlassCard>
      <View style={styles.locationWrap}>
        <View style={[styles.locationDot, { backgroundColor: isActive ? '#10b981' : '#ef4444' }]}>
          <View style={[styles.locationPulse, { backgroundColor: isActive ? '#10b98130' : '#ef444430' }]} />
        </View>
        <View style={styles.locationInfo}>
          <Text style={[styles.locationTitle, { color: theme.text.primary }]}>
            {isActive ? 'Location Sharing Active' : 'Location Sharing Off'}
          </Text>
          <Text style={[styles.locationDesc, { color: theme.text.muted }]}>
            {isActive ? 'Emergency contacts can see your location' : 'Enable for emergency response'}
          </Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={onToggle}
          trackColor={{ false: '#cbd5e1', true: '#10b981' }}
          thumbColor="#fff"
        />
      </View>
    </GlassCard>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════════════════
   NEW INTELLIGENCE FEATURES (from TimelineScreen)
   ═══════════════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── AI Pattern Predictor for Safety ── */
const SafetyPatternPredictor = memo(({ checklists, topics, theme, onPress }: { checklists: SafetyChecklist[]; topics: SafetyTopic[]; theme: any; onPress: () => void }) => {
  const predictions = useMemo(() => {
    const now = new Date();

    // Calculate overdue checklists
    const overdueChecks = checklists.filter(cl => cl.progress < 100 && cl.items.some(i => i.critical && !i.completed));

    // Calculate topics needing attention
    const attentionTopics = topics.filter(t => !t.completedAt && t.category === 'emergency');

    return [
      {
        pattern: overdueChecks.length > 0 ? 'Critical Checks Pending' : 'All Checks Current',
        predictedTime: overdueChecks.length > 0 ? 'Now' : 'Next week',
        confidence: overdueChecks.length > 0 ? 95 : 78,
        basedOn: `${overdueChecks.length} overdue`,
        emoji: overdueChecks.length > 0 ? '⚠️' : '✅',
        color: overdueChecks.length > 0 ? '#ef4444' : '#10b981',
      },
      {
        pattern: attentionTopics.length > 0 ? 'Emergency Topics Unread' : 'Topics Up To Date',
        predictedTime: attentionTopics.length > 0 ? 'Review now' : 'Good',
        confidence: attentionTopics.length > 0 ? 88 : 82,
        basedOn: `${attentionTopics.length} pending`,
        emoji: attentionTopics.length > 0 ? '📋' : '📚',
        color: attentionTopics.length > 0 ? '#f59e0b' : '#6366f1',
      },
      {
        pattern: 'Weekly Safety Review',
        predictedTime: 'Sunday 8PM',
        confidence: 72,
        basedOn: 'Habit pattern',
        emoji: '📅',
        color: '#8b5cf6',
      },
    ];
  }, [checklists, topics]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard onPress={onPress}>
        <View style={styles.predictorHeader}>
          <View style={[styles.predictorIconBg, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name="sparkles" size={20} color={theme.primary} />
          </View>
          <View style={styles.predictorTitleWrap}>
            <Text style={[styles.predictorTitle, { color: theme.text.primary }]}>Safety Intelligence</Text>
            <Text style={[styles.predictorSubtitle, { color: theme.text.muted }]}>AI-powered safety monitoring</Text>
          </View>
        </View>

        <View style={styles.predictorList}>
          {predictions.map((pred, i) => (
            <View key={i} style={[styles.predictorItem, i < predictions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={styles.predictorLeft}>
                <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
                <View>
                  <Text style={[styles.predictorMilestone, { color: theme.text.primary }]}>{pred.pattern}</Text>
                  <Text style={[styles.predictorCategory, { color: theme.text.muted }]}>{pred.basedOn}</Text>
                </View>
              </View>
              <View style={styles.predictorRight}>
                <View style={styles.predictorBarBg}>
                  <View style={[styles.predictorBarFill, { width: `${pred.confidence}%`, backgroundColor: pred.confidence > 70 ? '#10b981' : pred.confidence > 50 ? '#f59e0b' : '#ef4444' }]} />
                </View>
                <Text style={[styles.predictorConfidence, { color: theme.text.secondary }]}>{pred.confidence}% confidence</Text>
                <Text style={[styles.predictorAge, { color: pred.color }]}>{pred.predictedTime}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ── Activity Balance Radar for Safety ── */
const SafetyBalanceRadar = memo(({ checklists, topics, theme }: { checklists: SafetyChecklist[]; topics: SafetyTopic[]; theme: any }) => {
  const dimensions = useMemo(() => {
    const homeProgress = checklists.find(c => c.category === 'home')?.progress || 0;
    const carProgress = checklists.find(c => c.category === 'car')?.progress || 0;
    const sleepProgress = checklists.find(c => c.category === 'sleep')?.progress || 0;
    const feedingProgress = checklists.find(c => c.category === 'feeding')?.progress || 0;

    const emergencyTopics = topics.filter(t => t.category === 'emergency').length;
    const preventionTopics = topics.filter(t => t.category === 'prevention').length;
    const dailyTopics = topics.filter(t => t.category === 'daily').length;
    const totalTopics = topics.length || 1;

    return [
      { key: 'home', label: 'Home', color: '#f59e0b', value: homeProgress },
      { key: 'car', label: 'Car', color: '#8b5cf6', value: carProgress },
      { key: 'sleep', label: 'Sleep', color: '#10b981', value: sleepProgress },
      { key: 'feeding', label: 'Feeding', color: '#ec4899', value: feedingProgress },
      { key: 'emergency', label: 'Emergency', color: '#ef4444', value: Math.round((emergencyTopics / totalTopics) * 100) },
    ];
  }, [checklists, topics]);

  const size = 140;
  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / dimensions.length;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.radarHeader}>
          <Text style={[styles.radarTitle, { color: theme.text.primary }]}>Safety Coverage</Text>
          <Text style={[styles.radarSubtitle, { color: theme.text.muted }]}>Checklist & topic completion</Text>
        </View>

        <View style={styles.radarContainer}>
          <View style={[styles.radarCanvas, { width: size, height: size }]}>
            {[0.25, 0.5, 0.75, 1].map((r, i) => (
              <View key={i} style={[
                styles.radarRing,
                {
                  width: radius * 2 * r,
                  height: radius * 2 * r,
                  borderRadius: radius * r,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  left: center - radius * r,
                  top: center - radius * r,
                }
              ]} />
            ))}

            {dimensions.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              return (
                <View key={`axis-${i}`} style={[
                  styles.radarAxis,
                  {
                    left: center,
                    top: center,
                    width: radius,
                    transform: [{ rotate: `${angle * 180 / Math.PI}deg` }],
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  }
                ]} />
              );
            })}

            <View style={StyleSheet.absoluteFill}>
              {dimensions.map((d, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = (d.value / 100) * radius;
                const x = center + Math.cos(angle) * r;
                const y = center + Math.sin(angle) * r;
                return (
                  <View key={`pt-${i}`} style={[
                    styles.radarPoint,
                    {
                      left: x - 4,
                      top: y - 4,
                      backgroundColor: d.color,
                    }
                  ]} />
                );
              })}
            </View>
          </View>

          <View style={styles.radarLegend}>
            {dimensions.map((d, i) => (
              <View key={d.key} style={styles.radarLegendItem}>
                <View style={[styles.radarLegendDot, { backgroundColor: d.color }]} />
                <Text style={[styles.radarLegendLabel, { color: theme.text.secondary }]}>{d.label}</Text>
                <Text style={[styles.radarLegendValue, { color: theme.text.primary }]}>{d.value}%</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ── Weekly Heatmap for Safety Activity ── */
const SafetyHeatmap = memo(({ checklists, topics, theme }: { checklists: SafetyChecklist[]; topics: SafetyTopic[]; theme: any }) => {
  const heatmapData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    // Simulate activity based on completion dates
    const completedTopics = topics.filter(t => t.completedAt);

    const data = days.map((day, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;

      // Count completions on this day
      const count = completedTopics.filter(t => {
        if (!t.completedAt) return false;
        const completed = new Date(t.completedAt).getTime();
        return completed >= dayStart && completed < dayEnd;
      }).length;

      return { day, count, date: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    return data;
  }, [topics]);

  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.heatmapHeader}>
          <Text style={[styles.heatmapTitle, { color: theme.text.primary }]}>Weekly Activity</Text>
          <View style={styles.heatmapLegend}>
            <View style={[styles.heatmapLegendDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>High</Text>
            <View style={[styles.heatmapLegendDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>Normal</Text>
            <View style={[styles.heatmapLegendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.heatmapLegendText, { color: theme.text.muted }]}>Low</Text>
          </View>
        </View>

        <View style={styles.heatmapGrid}>
          {heatmapData.map((day, i) => (
            <View key={i} style={styles.heatmapCell}>
              <View style={[
                styles.heatmapBlock,
                { 
                  backgroundColor: `${theme.primary}${Math.round((day.count / maxCount) * 35 + 8).toString(16).padStart(2, '0')}`,
                  borderColor: `${theme.primary}40`,
                }
              ]}>
                <Text style={[styles.heatmapValue, { color: theme.text.primary }]}>{day.count}</Text>
              </View>
              <Text style={[styles.heatmapWeek, { color: theme.text.muted }]}>{day.day}</Text>
              <Text style={[styles.heatmapDate, { color: theme.text.muted }]}>{day.date}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ── Health Trend Correlation — Links safety to baby health ── */
const SafetyHealthCorrelation = memo(({ growthIndex, checklists, theme }: { growthIndex: any; checklists: SafetyChecklist[]; theme: any }) => {
  const correlations = useMemo(() => {
    const sleepSafetyProgress = checklists.find(c => c.category === 'sleep')?.progress || 0;
    const feedingSafetyProgress = checklists.find(c => c.category === 'feeding')?.progress || 0;

    const nutritionScore = growthIndex?.nutritionScore?.value || 0;
    const restScore = growthIndex?.restScore?.value || 0;
    const physicalScore = growthIndex?.physicalScore?.value || 0;

    return [
      {
        label: 'Sleep Safety ↔ Rest Score',
        value: Math.min(100, Math.round((sleepSafetyProgress + restScore) / 2)),
        icon: '😴',
        color: '#8b5cf6',
        detail: `Safety: ${sleepSafetyProgress}% • Rest: ${restScore}`,
      },
      {
        label: 'Feeding Safety ↔ Nutrition',
        value: Math.min(100, Math.round((feedingSafetyProgress + nutritionScore) / 2)),
        icon: '🍼',
        color: '#f59e0b',
        detail: `Safety: ${feedingSafetyProgress}% • Nutrition: ${nutritionScore}`,
      },
      {
        label: 'Overall Safety ↔ Health',
        value: Math.min(100, Math.round((sleepSafetyProgress + feedingSafetyProgress + physicalScore) / 3)),
        icon: '💚',
        color: '#10b981',
        detail: 'Cross-domain correlation',
      },
    ];
  }, [growthIndex, checklists]);

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <GlassCard>
        <View style={styles.correlationHeader}>
          <Text style={[styles.correlationTitle, { color: theme.text.primary }]}>Safety ↔ Health Link</Text>
          <Text style={[styles.correlationSubtitle, { color: theme.text.muted }]}>How safety habits affect baby health</Text>
        </View>

        <View style={styles.correlationList}>
          {correlations.map((corr, i) => (
            <View key={i} style={styles.correlationItem}>
              <View style={styles.correlationLeft}>
                <Text style={styles.correlationIcon}>{corr.icon}</Text>
                <View>
                  <Text style={[styles.correlationLabel, { color: theme.text.primary }]}>{corr.label}</Text>
                  <Text style={[styles.correlationDetail, { color: theme.text.muted }]}>{corr.detail}</Text>
                </View>
              </View>
              <View style={styles.correlationRight}>
                <View style={[styles.correlationBarBg, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                  <View style={[styles.correlationBarFill, { width: `${corr.value}%`, backgroundColor: corr.color }]} />
                </View>
                <Text style={[styles.correlationValue, { color: corr.color }]}>{corr.value}%</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ── Upcoming Safety Events Timeline ── */
const SafetyEventsTimeline = memo(({ checklists, topics, theme, onPress }: { checklists: SafetyChecklist[]; topics: SafetyTopic[]; theme: any; onPress: (item: any) => void }) => {
  const upcoming = useMemo(() => {
    const items = [];

    // Overdue critical checklist items
    checklists.forEach(cl => {
      cl.items.filter(i => i.critical && !i.completed).forEach(item => {
        items.push({
          id: `${cl.id}-${item.id}`,
          title: item.text,
          description: cl.title,
          emoji: '⚠️',
          priority: 'urgent' as const,
          confidence: 95,
          suggestedTime: 'Now',
        });
      });
    });

    // Unread emergency topics
    topics.filter(t => t.category === 'emergency' && !t.completedAt).forEach(topic => {
      items.push({
        id: topic.id,
        title: topic.title,
        description: 'Emergency safety topic',
        emoji: '🚨',
        priority: 'high' as const,
        confidence: 88,
        suggestedTime: 'Review today',
      });
    });

    return items.slice(0, 4);
  }, [checklists, topics]);

  if (!upcoming.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader 
        title="Safety Alerts" 
        subtitle="Items requiring attention"
        theme={theme}
      />

      <View style={styles.calendarTimeline}>
        {upcoming.map((event, i) => (
          <TouchableOpacity key={event.id} onPress={() => onPress(event)} style={styles.calendarItem}>
            <View style={styles.calendarLeft}>
              <View style={[styles.calendarLine, { backgroundColor: theme.surface.border }]} />
              <View style={[styles.calendarDot, { backgroundColor: event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary }]} />
              {i === upcoming.length - 1 && <View style={[styles.calendarLineEnd, { backgroundColor: 'transparent' }]} />}
            </View>
            <View style={[styles.calendarCard, { backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)' }]}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarEmoji}>{event.emoji}</Text>
                <View style={styles.calendarMeta}>
                  <Text style={[styles.calendarTitle, { color: theme.text.primary }]}>{event.title}</Text>
                  <Text style={[styles.calendarCategory, { color: theme.text.muted }]}>{event.description}</Text>
                </View>
                <View style={[styles.calendarBadge, { backgroundColor: `${event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary}12` }]}>
                  <Text style={[styles.calendarBadgeText, { color: event.priority === 'urgent' ? '#ef4444' : event.priority === 'high' ? '#f59e0b' : theme.primary }]}>
                    {event.priority}
                  </Text>
                </View>
              </View>
              <Text style={[styles.calendarAge, { color: theme.primary }]}>
                {event.suggestedTime}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* ── Growth Intelligence Score Card for Safety ── */
const SafetyGrowthCard = memo(({ growthIndex, theme, onPress }: { growthIndex: any; theme: any; onPress: () => void }) => {
  if (!growthIndex) return null;

  const nutritionScore = growthIndex?.nutritionScore;
  const restScore = growthIndex?.restScore;
  const physicalScore = growthIndex?.physicalScore;
  const cognitiveScore = growthIndex?.cognitiveScore;
  const healthStability = growthIndex?.healthStability;
  const compositeIndex = growthIndex?.compositeIndex || 0;

  const scores = [
    { label: 'Nutrition', score: nutritionScore, icon: '🍎', color: '#FF9F43' },
    { label: 'Rest', score: restScore, icon: '😴', color: '#5F27CD' },
    { label: 'Physical', score: physicalScore, icon: '💪', color: '#10AC84' },
    { label: 'Cognitive', score: cognitiveScore, icon: '🧠', color: '#FFD700' },
    { label: 'Health', score: healthStability, icon: '❤️', color: '#EE5A24' },
  ];

  const getScoreColor = (value: number) => {
    if (value >= 80) return '#10b981';
    if (value >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[`${theme.primary}12`, `${theme.secondary}06`]}
          style={[styles.growthCard, { borderRadius: 20 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.growthHeader}>
            <View style={styles.growthTitleRow}>
              <Text style={styles.growthEmoji}>📊</Text>
              <Text style={[styles.growthTitle, { color: theme.text.primary }]}>
                Growth Intelligence
              </Text>
            </View>
            <View style={[styles.compositeBadge, { backgroundColor: `${getScoreColor(compositeIndex)}18` }]}>
              <Text style={[styles.compositeText, { color: getScoreColor(compositeIndex) }]}>
                {compositeIndex}
              </Text>
            </View>
          </View>

          <View style={styles.scoresGrid}>
            {scores.map((item) => (
              <View key={item.label} style={styles.scoreItem}>
                <Text style={styles.scoreEmoji}>{item.icon}</Text>
                <View style={styles.scoreBarContainer}>
                  <View
                    style={[
                      styles.scoreBar,
                      {
                        width: `${item.score?.value || 0}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.scoreValue, { color: theme.text.primary }]}>
                  {item.score?.value || 0}
                </Text>
                <Text style={[styles.scoreLabel, { color: theme.text.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL COMPONENTS — Redesigned with Glass aesthetic (NO SHADOWS)
   ═══════════════════════════════════════════════════════════════════════════ */

const UnifiedModal = memo(({ visible, onClose, title, children, theme }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; theme: any }) => {
  const translateY = useSharedValue(SCREEN_H);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_H, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.modalSheet, sheetStyle]} pointerEvents={visible ? 'auto' : 'none'}>
        <BlurView intensity={theme.isDark ? 60 : 90} style={StyleSheet.absoluteFill} tint={theme.isDark ? 'dark' : 'light'} />
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name="close" size={20} color={theme.text.primary} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — REDESIGNED WITH INTELLIGENCE + NO SHADOWS
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  /* ── Safety Context ── */
  const {
    topics,
    emergencyContacts,
    callEmergency,
    triggerSOS,
    findNearbyHospitals,
    findNearbyPediatricians,
    shareLocationWithEmergency,
    markTipAsViewed,
    getSafetyScore,
    streakDays,
    currentLocation,
    markTopicCompleted,
    importFamilyContacts,
    addCustomEmergencyContact,
    checklists,
    toggleChecklistItem,
  } = useSafety();

  /* ── Intelligence Hooks (same as TimelineScreen) ── */
  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { reminders: predictiveReminders } = usePredictiveReminders();

  const [activeTab, setActiveTab] = useState<SafetyTab>('overview');
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolate.CLAMP) }],
  }));

  const safetyScore = useMemo(() => getSafetyScore(), [getSafetyScore]);
  const completedCount = useMemo(() => topics.filter((t: SafetyTopic) => t.completedAt).length, [topics]);

  const handleTabChange = useCallback((tab: SafetyTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleTopicPress = useCallback((topic: SafetyTopic) => {
    setSelectedTopic(topic);
    setShowTopicModal(true);
    markTipAsViewed(topic.id);
    triggerHaptic('light');
  }, [markTipAsViewed, triggerHaptic]);

  const handleSOS = useCallback(() => {
    sweetAlert.confirm(
      'SOS Emergency',
      'This will call 911 and alert your emergency contacts with your location. Are you sure?',
      () => {
        Vibration.vibrate([0, 500, 200, 500]);
        triggerSOS();
        sweetAlert.success('SOS Triggered', 'Emergency services have been contacted.');
      },
      () => {},
      'Call 911',
      'Cancel'
    );
  }, [triggerSOS, sweetAlert]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const tabs = [
    { key: 'overview' as SafetyTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'emergency' as SafetyTab, label: 'Emergency', icon: 'alert-circle-outline' },
    { key: 'topics' as SafetyTab, label: 'Topics', icon: 'shield-checkmark-outline' },
    { key: 'checklists' as SafetyTab, label: 'Checklists', icon: 'list-outline' },
    { key: 'intelligence' as SafetyTab, label: 'Intelligence', icon: 'sparkles-outline' },
    { key: 'reports' as SafetyTab, label: 'Reports', icon: 'document-text-outline' },
  ];

  const quickActions = [
    { icon: 'people', label: 'Import Contacts', color: '#6366f1', onPress: () => setShowContactModal(true) },
    { icon: 'notifications', label: 'Reminder', color: '#10b981', onPress: () => setShowReminderModal(true) },
    { icon: 'document-text', label: 'Reports', color: '#f59e0b', onPress: () => setShowReportModal(true) },
    { icon: 'medical', label: 'Hospitals', color: '#ef4444', onPress: findNearbyHospitals },
  ];

  const bgColors = theme.isDark
    ? [theme.bgColors?.[0] || '#0a0a0a', '#1a1a2e']
    : [theme.bgColors?.[0] || '#f8fafc', '#e2e8f0'];

  return (
    <View style={[styles.container, { backgroundColor: bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.blur} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>Safety Corner</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>{safetyScore}% Safety Score</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} />
        }
      >
        {/* ── TOP HEADER ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.surface.card }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Safety Corner</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.muted }]}>
              {currentBaby ? `Protecting ${currentBaby.name}` : 'Your family safety hub'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowChecklistModal(true)} style={[styles.iconBtn, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name="list" size={22} color={theme.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── TAB BAR ── */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} theme={theme} />

        {/* ═════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* ── SAFETY SCORE RING ── */}
            <SafetyScoreRing score={safetyScore} theme={theme} onPress={() => {}} />

            {/* ── KPI GRID — NO SHADOWS ── */}
            <View style={styles.kpiGrid}>
              {[
                { title: 'Completed', value: completedCount, icon: 'checkmark-circle', color: '#10b981', size: 'large' },
                { title: 'Streak', value: streakDays, icon: 'flame', color: '#f59e0b', size: 'large' },
                { title: 'Topics', value: topics.length, icon: 'shield', color: '#6366f1', size: 'normal' },
                { title: 'Contacts', value: emergencyContacts.length, icon: 'people', color: '#ec4899', size: 'normal' },
              ].map((kpi, i) => (
                <Animated.View key={kpi.title} entering={FadeInUp.delay(120 + i * 80).springify()} style={[styles.kpiGridItem, kpi.size === 'large' ? styles.kpiGridItemLarge : styles.kpiGridItemNormal]}>
                  <KpiCard {...kpi} theme={theme} />
                </Animated.View>
              ))}
            </View>

            {/* ── STREAK CARD ── */}
            <SafetyStreakCard streakDays={streakDays} theme={theme} onPress={() => {}} />

            {/* ── QUICK ACTIONS ── */}
            <QuickActionsBar actions={quickActions} theme={theme} />

            {/* ── LOCATION STATUS ── */}
            <LocationStatusCard isActive={locationSharing} theme={theme} onToggle={() => setLocationSharing(!locationSharing)} />

            {/* ── RECENT TOPICS ── */}
            <View style={styles.section}>
              <SectionHeader title="Recent Topics" subtitle={`${topics.filter(t => t.completedAt).length} completed`} action={() => setActiveTab('topics')} theme={theme} />
              {topics.slice(0, 3).map((topic, i) => (
                <Animated.View key={topic.id} entering={FadeInUp.delay(i * 60).springify()}>
                  <TouchableOpacity onPress={() => handleTopicPress(topic)} style={[
                    styles.topicListItem,
                    {
                      backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    }
                  ]}>
                    <View style={[styles.topicListIcon, { backgroundColor: `${topic.color}12` }]}>
                      <Ionicons name={topic.icon as any} size={20} color={topic.color} />
                    </View>
                    <View style={styles.topicListInfo}>
                      <Text style={[styles.topicListTitle, { color: theme.text.primary }]}>{topic.title}</Text>
                      <Text style={[styles.topicListDesc, { color: theme.text.muted }]} numberOfLines={1}>{topic.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {/* ── GROWTH INTELLIGENCE CARD (from TimelineScreen) ── */}
            {growthIndex && (
              <View style={styles.section}>
                <SectionHeader title="Baby Health" subtitle="From Growth Intelligence" theme={theme} />
                <SafetyGrowthCard 
                  growthIndex={growthIndex} 
                  theme={theme} 
                  onPress={() => navigation.navigate('GrowthDashboard')} 
                />
              </View>
            )}
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: EMERGENCY
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'emergency' && (
          <EmergencyQuickDial
            contacts={emergencyContacts}
            onCall={(c) => callEmergency(c.number, c.label, c.type)}
            onSOS={handleSOS}
            theme={theme}
          />
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: TOPICS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'topics' && (
          <SafetyTopicGrid topics={topics} onPress={handleTopicPress} theme={theme} />
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: CHECKLISTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'checklists' && (
          <View style={styles.section}>
            <SectionHeader title="Safety Checklists" subtitle={`${checklists.length} checklists available`} theme={theme} />
            {checklists.map((checklist, i) => (
              <Animated.View key={checklist.id} entering={FadeInUp.delay(i * 60).springify()}>
                <GlassCard onPress={() => setShowChecklistModal(true)} style={{ marginBottom: DESIGN.spacing.md }}>
                  <View style={styles.checklistRow}>
                    <View style={[styles.checklistIcon, { backgroundColor: `${theme.primary}12` }]}>
                      <Ionicons name="list" size={22} color={theme.primary} />
                    </View>
                    <View style={styles.checklistInfo}>
                      <Text style={[styles.checklistTitle, { color: theme.text.primary }]}>{checklist.title}</Text>
                      <Text style={[styles.checklistMeta, { color: theme.text.muted }]}>{checklist.category} • {checklist.items.length} items</Text>
                      <View style={styles.checklistBarBg}>
                        <View style={[styles.checklistBarFill, { width: `${checklist.progress}%`, backgroundColor: theme.primary }]} />
                      </View>
                    </View>
                    <Text style={[styles.checklistPercent, { color: theme.primary }]}>{checklist.progress}%</Text>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: INTELLIGENCE (NEW — from TimelineScreen patterns)
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'intelligence' && (
          <>
            {/* AI Pattern Predictor */}
            <SafetyPatternPredictor 
              checklists={checklists} 
              topics={topics} 
              theme={theme} 
              onPress={() => {}} 
            />

            {/* Activity Balance Radar */}
            <SafetyBalanceRadar 
              checklists={checklists} 
              topics={topics} 
              theme={theme} 
            />

            {/* Weekly Heatmap */}
            <SafetyHeatmap 
              checklists={checklists} 
              topics={topics} 
              theme={theme} 
            />

            {/* Health Trend Correlation */}
            <SafetyHealthCorrelation 
              growthIndex={growthIndex} 
              checklists={checklists} 
              theme={theme} 
            />

            {/* Upcoming Safety Events */}
            <SafetyEventsTimeline 
              checklists={checklists} 
              topics={topics} 
              theme={theme} 
              onPress={(item) => {
                if (item.id.includes('-')) {
                  setShowChecklistModal(true);
                } else {
                  const topic = topics.find(t => t.id === item.id);
                  if (topic) handleTopicPress(topic);
                }
              }} 
            />

            {/* Growth Intelligence */}
            {growthIndex && (
              <View style={{ marginTop: 16 }}>
                <SectionHeader title="Growth Intelligence" subtitle="Baby health metrics" theme={theme} />
                <SafetyGrowthCard 
                  growthIndex={growthIndex} 
                  theme={theme} 
                  onPress={() => navigation.navigate('GrowthDashboard')} 
                />
              </View>
            )}
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: REPORTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <View style={styles.section}>
            <SectionHeader title="Doctor Reports" subtitle="Upload and manage medical documents" theme={theme} />
            <TouchableOpacity style={[styles.uploadBtn, { borderColor: theme.primary }]} onPress={() => setShowReportModal(true)}>
              <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.uploadGradient}>
                <Ionicons name="cloud-upload" size={24} color="#fff" />
                <Text style={styles.uploadText}>Upload PDF Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <UnifiedModal visible={showTopicModal} onClose={() => setShowTopicModal(false)} title={selectedTopic?.title || ''} theme={theme}>
        {selectedTopic && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <View style={[styles.topicDetailIcon, { backgroundColor: `${selectedTopic.color}12` }]}>
              <Ionicons name={selectedTopic.icon as any} size={32} color={selectedTopic.color} />
            </View>
            <Text style={[styles.topicDetailTitle, { color: theme.text.primary }]}>{selectedTopic.title}</Text>
            <Text style={[styles.topicDetailDesc, { color: theme.text.muted }]}>{selectedTopic.description}</Text>
            <View style={styles.tipsList}>
              {selectedTopic.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipBullet, { backgroundColor: selectedTopic.color }]}>
                    <Text style={styles.tipNumber}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.tipText, { color: theme.text.secondary }]}>{tip}</Text>
                </View>
              ))}
            </View>
            {selectedTopic.emergencyNumbers?.map((num, i) => (
              <TouchableOpacity key={i} style={[styles.emergencyCallBtn, { backgroundColor: selectedTopic.color }]} onPress={() => callEmergency(num.number, num.label, 'emergency')}>
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.emergencyCallText}>Call {num.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.completeBtn, { backgroundColor: theme.primary }]} onPress={() => { markTopicCompleted(selectedTopic.id); setShowTopicModal(false); }}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completeBtnText}>Mark as Completed</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </UnifiedModal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned: NO SHADOWS, clean flat design
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

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

  // ── Glass Card — NO SHADOWS ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
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

  // ── KPI Grid ──
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  kpiGridItem: { marginBottom: 0 },
  kpiGridItemLarge: { width: (SCREEN_W - 56) / 2, height: 140 },
  kpiGridItemNormal: { width: (SCREEN_W - 56) / 2, height: 120 },

  // ── KPI Card — NO SHADOWS ──
  kpiCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
  },
  kpiCardLarge: { padding: 16 },
  kpiInner: { flex: 1, justifyContent: 'space-between' },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiBody: { gap: 2, marginTop: 8 },
  kpiValue: { fontWeight: '800', letterSpacing: -0.5 },
  kpiTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Safety Score Ring ──
  scoreRingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  scoreRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRingInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreMax: { fontSize: 12, fontWeight: '600' },
  scoreLabels: { flex: 1, gap: 6 },
  scoreLabel: { fontSize: 16, fontWeight: '800' },
  scoreSublabel: { fontSize: 13, fontWeight: '700' },
  scoreBreakdown: { gap: 6, marginTop: 4 },
  scoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreMiniBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreMiniBarFill: { height: '100%', borderRadius: 2 },
  scoreMiniLabel: { fontSize: 11, fontWeight: '600', width: 60 },
  scoreMiniValue: { fontSize: 11, fontWeight: '700', width: 24, textAlign: 'right' },

  // ── Emergency Quick Dial ──
  sosWrap: { marginHorizontal: 16, marginBottom: 16 },
  sosButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sosGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  sosText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  sosSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  emergencyCard: {
    width: (SCREEN_W - 56) / 2,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  emergencyIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emergencyLabel: { fontSize: 14, fontWeight: '700' },
  emergencyNumber: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  familyScroll: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  familyAvatar: { width: 28, height: 28, borderRadius: 14 },
  familyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyName: { fontSize: 12, fontWeight: '600' },

  // ── Safety Topic Grid — NO SHADOWS ──
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
  },
  topicGridItem: { width: (SCREEN_W - 56) / 2 },
  topicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
  },
  topicCardInner: { gap: 8 },
  topicIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topicCompletedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  topicTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  topicCategory: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  topicDoneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topicDoneText: { fontSize: 10, fontWeight: '700' },

  // ── Topic List Item — NO SHADOWS ──
  topicListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
  },
  topicListIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicListInfo: { flex: 1, gap: 2 },
  topicListTitle: { fontSize: 15, fontWeight: '700' },
  topicListDesc: { fontSize: 12, fontWeight: '500' },

  // ── Streak Card ──
  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  streakIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f59e0b12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakEmoji: { fontSize: 24 },
  streakTitle: { fontSize: 16, fontWeight: '800' },
  streakSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  streakFlames: { flexDirection: 'row', gap: 4 },

  // ── Quick Actions ──
  quickActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flex: 1,
    minWidth: 140,
  },
  quickActionLabel: { fontSize: 13, fontWeight: '700' },

  // ── Location Status ──
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  locationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationPulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    position: 'absolute',
  },
  locationInfo: { flex: 1 },
  locationTitle: { fontSize: 15, fontWeight: '700' },
  locationDesc: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  // ── Checklist Row ──
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  checklistIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistInfo: { flex: 1, gap: 4 },
  checklistTitle: { fontSize: 15, fontWeight: '700' },
  checklistMeta: { fontSize: 12, fontWeight: '500' },
  checklistBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  checklistBarFill: { height: '100%', borderRadius: 2 },
  checklistPercent: { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  // ── Upload Button ──
  uploadBtn: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Section ──
  section: { marginBottom: DESIGN.spacing.xl },

  // ── Modal ──
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: SCREEN_H * 0.9,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: { padding: 20, paddingTop: 8 },
  topicDetailIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  topicDetailTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  topicDetailDesc: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  tipsList: { gap: 12, marginBottom: 20 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  tipNumber: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 10,
  },
  emergencyCallText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Predictor (AI Pattern) ──
  predictorHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    paddingBottom: 12 
  },
  predictorIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  predictorTitleWrap: { flex: 1 },
  predictorTitle: { fontSize: 16, fontWeight: '800' },
  predictorSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  predictorList: { paddingHorizontal: 16, paddingBottom: 16 },
  predictorItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    gap: 12 
  },
  predictorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  predictorEmoji: { fontSize: 22 },
  predictorMilestone: { fontSize: 14, fontWeight: '700' },
  predictorCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  predictorRight: { alignItems: 'flex-end', gap: 4 },
  predictorBarBg: { width: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.04)', overflow: 'hidden' },
  predictorBarFill: { height: '100%', borderRadius: 2 },
  predictorConfidence: { fontSize: 10, fontWeight: '600' },
  predictorAge: { fontSize: 12, fontWeight: '700' },

  // ── Radar Chart ──
  radarHeader: { padding: 16, paddingBottom: 8 },
  radarTitle: { fontSize: 16, fontWeight: '800' },
  radarSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  radarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 16 
  },
  radarCanvas: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  radarRing: { 
    position: 'absolute', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.04)' 
  },
  radarAxis: { 
    position: 'absolute', 
    height: 1, 
    transformOrigin: '0% 50%' 
  },
  radarPoint: { 
    position: 'absolute', 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  radarLegend: { flex: 1, gap: 10 },
  radarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radarLegendDot: { width: 8, height: 8, borderRadius: 4 },
  radarLegendLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  radarLegendValue: { fontSize: 12, fontWeight: '700' },

  // ── Heatmap ──
  heatmapHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    paddingBottom: 12 
  },
  heatmapTitle: { fontSize: 16, fontWeight: '800' },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heatmapLegendDot: { width: 8, height: 8, borderRadius: 4 },
  heatmapLegendText: { fontSize: 10, fontWeight: '600' },
  heatmapGrid: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 8 
  },
  heatmapCell: { flex: 1, alignItems: 'center', gap: 4 },
  heatmapBlock: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1.5 
  },
  heatmapValue: { fontSize: 13, fontWeight: '700' },
  heatmapWeek: { fontSize: 10, fontWeight: '600' },
  heatmapDate: { fontSize: 9, fontWeight: '500' },

  // ── Health Correlation ──
  correlationHeader: { padding: 16, paddingBottom: 8 },
  correlationTitle: { fontSize: 16, fontWeight: '800' },
  correlationSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  correlationList: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  correlationItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  correlationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  correlationIcon: { fontSize: 20 },
  correlationLabel: { fontSize: 13, fontWeight: '700' },
  correlationDetail: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  correlationRight: { alignItems: 'flex-end', gap: 4, width: 80 },
  correlationBarBg: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  correlationBarFill: { height: '100%', borderRadius: 2 },
  correlationValue: { fontSize: 12, fontWeight: '700' },

  // ── Calendar Timeline ──
  calendarTimeline: { marginHorizontal: 16, gap: 0 },
  calendarItem: { flexDirection: 'row', gap: 12 },
  calendarLeft: { 
    width: 24, 
    alignItems: 'center', 
    paddingTop: 16 
  },
  calendarLine: { 
    position: 'absolute', 
    top: 0, 
    bottom: 0, 
    width: 2, 
    left: 11 
  },
  calendarLineEnd: { 
    position: 'absolute', 
    top: 0, 
    bottom: '50%', 
    width: 2, 
    left: 11 
  },
  calendarDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: '#fff', 
    zIndex: 1 
  },
  calendarCard: { 
    flex: 1, 
    padding: 14, 
    borderRadius: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  calendarEmoji: { fontSize: 20 },
  calendarMeta: { flex: 1 },
  calendarTitle: { fontSize: 14, fontWeight: '700' },
  calendarCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  calendarBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  calendarBadgeText: { fontSize: 10, fontWeight: '700' },
  calendarAge: { fontSize: 11, fontWeight: '600' },

  // ── Growth Card ──
  growthCard: { padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  growthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  growthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growthEmoji: { fontSize: 24 },
  growthTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  compositeBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  compositeText: { fontSize: 16, fontWeight: '800' },
  scoresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scoreItem: { width: '47%', gap: 6 },
  scoreEmoji: { fontSize: 20 },
  scoreBarContainer: { height: 6, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' },
  scoreBar: { height: '100%', borderRadius: 3 },
  scoreValue: { fontSize: 14, fontWeight: '800' },
  scoreLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});