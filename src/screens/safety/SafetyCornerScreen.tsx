import React, { useCallback, useEffect, useMemo, useRef, useState, memo, useLayoutEffect } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, RefreshControl, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Vibration, View, LayoutAnimation, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '../../components/EmptyState';
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

import { useSafety, type EmergencyContact, type SafetyTopic, type SafetyChecklist } from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 8 },
    glow: { shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 6 },
  },
};

type SafetyTab = 'overview' | 'emergency' | 'topics' | 'checklists' | 'reports';

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
   GLASS CARD — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      {
        borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
      },
      active && { borderColor: theme.primary, borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={theme.isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Inspired by Growth Dashboard
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
   TAB BAR — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ tabs, activeTab, onChange, theme }: { tabs: { key: SafetyTab; label: string; icon: string }[]; activeTab: SafetyTab; onChange: (t: SafetyTab) => void; theme: any }) => (
  <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#fff', ...DESIGN.shadow.sm }]}
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
   KPI CARD — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiCard = memo(({ title, value, icon, color, onPress, theme, size = 'normal' }: any) => {
  const isLarge = size === 'large';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[
      styles.kpiCard,
      isLarge && styles.kpiCardLarge,
      {
        backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
        borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        ...DESIGN.shadow.md,
      }
    ]}>
      <LinearGradient colors={[`${color}08`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
      <View style={styles.kpiInner}>
        <View style={styles.kpiTop}>
          <View style={[styles.kpiIconBg, { backgroundColor: `${color}15` }]}>
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
          <View style={[styles.scoreRingOuter, { borderColor: `${getColor()}30` }]}>
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
                  <View style={[styles.scoreMiniBarBg, { backgroundColor: `${s.color}15` }]}>
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

      {/* Emergency Contacts Grid */}
      <View style={styles.emergencyGrid}>
        {emergencyContacts.map(contact => (
          <TouchableOpacity key={contact.id} onPress={() => onCall(contact)} style={[
            styles.emergencyCard,
            {
              borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
              ...DESIGN.shadow.md,
            }
          ]}>
            <LinearGradient colors={[`${contact.color}15`, `${contact.color}05`]} style={StyleSheet.absoluteFill} />
            <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
            <View style={[styles.emergencyIconBg, { backgroundColor: `${contact.color}20` }]}>
              <Ionicons name={contact.icon as any} size={22} color={contact.color} />
            </View>
            <Text style={[styles.emergencyLabel, { color: theme.text.primary }]}>{contact.label}</Text>
            <Text style={[styles.emergencyNumber, { color: theme.text.muted }]}>{contact.number}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Family Chips */}
      {familyContacts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyScroll}>
          {familyContacts.map(contact => (
            <TouchableOpacity key={contact.id} onPress={() => onCall(contact)} style={[
              styles.familyChip,
              {
                backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                ...DESIGN.shadow.sm,
              }
            ]}>
              {contact.avatar ? (
                <Image source={{ uri: contact.avatar }} style={styles.familyAvatar} />
              ) : (
                <View style={[styles.familyAvatarPlaceholder, { backgroundColor: `${contact.color}20` }]}>
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
   FEATURE 3: Safety Topic Cards — Redesigned from list to card grid
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
                  backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  ...DESIGN.shadow.md,
                }
              ]}>
                <LinearGradient colors={[`${color}08`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
                <View style={styles.topicCardInner}>
                  <View style={[styles.topicIconBg, { backgroundColor: `${color}15` }]}>
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
                    <View style={[styles.topicDoneBadge, { backgroundColor: `${color}15` }]}>
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
              <Ionicons key={i} name="flame" size={16} color={i < flames ? '#f59e0b' : theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
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
        <TouchableOpacity key={i} onPress={action.onPress} style={[styles.quickActionPill, { backgroundColor: `${action.color}12` }]}>
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
          <View style={[styles.locationPulse, { backgroundColor: isActive ? '#10b98140' : '#ef444440' }]} />
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
   MODAL COMPONENTS — Redesigned with Glass aesthetic
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
          <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name="close" size={20} color={theme.text.primary} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — REDESIGNED
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

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

          <TouchableOpacity onPress={() => setShowChecklistModal(true)} style={[styles.iconBtn, { backgroundColor: `${theme.primary}15` }]}>
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
            {/* ── SAFETY SCORE RING (Feature 1) ── */}
            <SafetyScoreRing score={safetyScore} theme={theme} onPress={() => {}} />

            {/* ── KPI GRID ── */}
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

            {/* ── STREAK CARD (Feature 4) ── */}
            <SafetyStreakCard streakDays={streakDays} theme={theme} onPress={() => {}} />

            {/* ── QUICK ACTIONS (Feature 5) ── */}
            <QuickActionsBar actions={quickActions} theme={theme} />

            {/* ── LOCATION STATUS (Feature 6) ── */}
            <LocationStatusCard isActive={locationSharing} theme={theme} onToggle={() => setLocationSharing(!locationSharing)} />

            {/* ── RECENT TOPICS ── */}
            <View style={styles.section}>
              <SectionHeader title="Recent Topics" subtitle={`${topics.filter(t => t.completedAt).length} completed`} action={() => setActiveTab('topics')} theme={theme} />
              {topics.slice(0, 3).map((topic, i) => (
                <Animated.View key={topic.id} entering={FadeInUp.delay(i * 60).springify()}>
                  <TouchableOpacity onPress={() => handleTopicPress(topic)} style={[
                    styles.topicListItem,
                    {
                      backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      ...DESIGN.shadow.sm,
                    }
                  ]}>
                    <View style={[styles.topicListIcon, { backgroundColor: `${topic.color}15` }]}>
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
                    <View style={[styles.checklistIcon, { backgroundColor: `${theme.primary}15` }]}>
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
            <View style={[styles.topicDetailIcon, { backgroundColor: `${selectedTopic.color}15` }]}>
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
   STYLES — Completely Redesigned with Growth Dashboard DNA
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

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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

  // ── KPI Card ──
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
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
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

  // ── Safety Topic Grid ──
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

  // ── Topic List Item ──
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
    backgroundColor: '#f59e0b15',
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
    backgroundColor: 'rgba(0,0,0,0.06)',
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
});