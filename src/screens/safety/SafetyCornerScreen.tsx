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
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import {
  useSafety,
  type EmergencyContact,
  type SafetyTopic,
  type SafetyChecklist,
  type DoctorReport,
} from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { supabase } from '@/utils/supabase';

import { usePredictiveReminders } from '@/hooks/usePredictiveReminders';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  accentLight: '#f472b6',
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
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

type SafetyTab = 'overview' | 'emergency' | 'topics' | 'checklists' | 'reports' | 'intelligence';
type EmergencyType = 'family' | 'emergency' | 'medical' | 'custom';
interface EmergencyNumber {
  country: string;
  code: string;
  emergency: string;
  police: string;
  ambulance: string;
  fire: string;
  poison: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = memo(({ title, subtitle, icon, color = DS.primary, isDark, action, actionLabel }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  isDark: boolean; action?: () => void; actionLabel?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionActionText, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

const GlassCard = memo(({ children, style, onPress, active, isDark }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; isDark: boolean;
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.glassCard,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
        },
        style,
      ]}
    >
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Safety Pulse
   ═══════════════════════════════════════════════════════════════════════════ */

const SafetyPulse = memo<{
  isDark: boolean;
  safetyScore: number;
  completedCount: number;
  totalTopics: number;
  contactsCount: number;
  streakDays: number;
  onSOS: () => void;
  onAddContact: () => void;
  onReports: () => void;
}>(({ isDark, safetyScore, completedCount, totalTopics, contactsCount, streakDays, onSOS, onAddContact, onReports }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const scoreColor = safetyScore >= 80 ? DS.success : safetyScore >= 50 ? DS.warning : DS.danger;
  const scoreLabel = safetyScore >= 80 ? 'Excellent' : safetyScore >= 50 ? 'Good' : 'Needs attention';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? [`${scoreColor}25`, 'rgba(236,72,153,0.08)', 'rgba(139,92,246,0.04)']
            : [`${scoreColor}12`, 'rgba(236,72,153,0.05)', 'rgba(255,255,255,0.4)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${scoreColor}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <View style={styles.pulseAvatarWrap}>
            <Animated.View style={[styles.pulseAvatarGlow, { backgroundColor: `${scoreColor}35` }, glowStyle]} />
            <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
              <LinearGradient colors={[scoreColor, DS.accent, DS.warning, scoreColor]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Ionicons name="shield-checkmark" size={26} color={scoreColor} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                Safety Corner
              </Text>
              <View style={[styles.pulseScorePill, { backgroundColor: `${scoreColor}18` }]}>
                <Text style={[styles.pulseScoreText, { color: scoreColor }]}>{scoreLabel}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: scoreColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {safetyScore}/100 · {completedCount}/{totalTopics} topics · {streakDays}-day streak
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onAddContact} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="person-add-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onReports} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="document-text-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: scoreColor }]}>{safetyScore}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>score</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{completedCount}/{totalTopics}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>topics</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.accent }]}>{contactsCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>contacts</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{streakDays}d</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>streak</Text>
          </View>
        </View>

        {/* SOS quick access */}
        <PressableScale onPress={onSOS} activeScale={0.97}>
          <LinearGradient
            colors={[DS.danger, '#dc2626']}
            style={styles.sosQuickBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons name="alert-circle" size={20} color={DS.white} />
            <Text style={styles.sosQuickText}>SOS Emergency</Text>
            <Ionicons name="call" size={16} color={DS.white} />
          </LinearGradient>
        </PressableScale>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

const AuraRibbon = memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Tab Bar
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: SafetyTab; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: SafetyTab;
  onChange: (t: SafetyTab) => void;
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons name={tab.icon} size={15} color={isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[
            styles.tabLabel,
            { color: isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500 },
            isActive && { fontWeight: '700' },
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Contact Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const ContactModal = memo(({ visible, onClose, onAdd, isDark }: {
  visible: boolean; onClose: () => void;
  onAdd: (contact: Omit<EmergencyContact, 'id'>) => void; isDark: boolean;
}) => {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<EmergencyType>('family');
  const [relation, setRelation] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !number.trim()) {
      Alert.alert('Missing Info', 'Please enter both name and phone number.');
      return;
    }
    onAdd({
      label: name.trim(),
      number: number.trim(),
      type,
      icon: type === 'emergency' ? 'call' : type === 'medical' ? 'medical' : 'person',
      color: type === 'emergency' ? DS.danger : type === 'medical' ? DS.info : DS.success,
      relation: relation.trim() || undefined,
    } as any);
    setName(''); setNumber(''); setRelation('');
    onClose();
  };

  const contactTypes: { id: EmergencyType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'family', label: 'Family', icon: 'people' },
    { id: 'emergency', label: 'Emergency', icon: 'alert-circle' },
    { id: 'medical', label: 'Medical', icon: 'medical' },
    { id: 'custom', label: 'Custom', icon: 'person' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Add Contact</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.6 }}>
            <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              placeholder="e.g., Mom, Dr. Smith"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Phone number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              placeholder="e.g., 555-123-4567"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={number}
              onChangeText={setNumber}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {contactTypes.map((t) => {
                const active = type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, {
                      backgroundColor: active ? DS.primary : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
                      borderColor: active ? DS.primary : 'transparent',
                    }]}
                    onPress={() => setType(t.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={t.icon} size={14} color={active ? DS.white : isDark ? DS.gray400 : DS.gray500} />
                    <Text style={[{ fontSize: 12, fontWeight: '600', color: active ? DS.white : isDark ? DS.gray400 : DS.gray500 }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Relationship (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              placeholder="e.g., Mother, Pediatrician"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={relation}
              onChangeText={setRelation}
            />
          </ScrollView>

          <PressableScale onPress={handleAdd} activeScale={0.97} style={{ marginTop: 12 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalPrimaryBtn}>
              <Ionicons name="add-circle-outline" size={18} color={DS.white} />
              <Text style={styles.modalPrimaryBtnText}>Add Contact</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Checklist Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const ChecklistModal = memo(({ visible, checklist, onClose, onToggleItem, isDark }: {
  visible: boolean; checklist: SafetyChecklist | null;
  onClose: () => void; onToggleItem: (checklistId: string, itemId: string) => void;
  isDark: boolean;
}) => {
  if (!checklist) return null;
  const completed = checklist.items.filter(i => i.completed).length;
  const total = checklist.items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{checklist.title}</Text>
              <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {progress}% complete · {completed}/{total}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>

          <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray200, marginBottom: 12 }]}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: DS.primary }]} />
          </View>

          <ScrollView style={{ maxHeight: SCREEN_H * 0.5 }} showsVerticalScrollIndicator={false}>
            {checklist.items.map((item) => (
              <PressableScale key={item.id} onPress={() => onToggleItem(checklist.id, item.id)} activeScale={0.98}>
                <View style={[
                  styles.checklistRow,
                  {
                    borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
                    backgroundColor: item.completed ? (isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)') : 'transparent',
                  },
                ]}>
                  <View style={[
                    styles.checkbox,
                    {
                      borderColor: item.completed ? DS.success : isDark ? DS.gray500 : DS.gray400,
                      backgroundColor: item.completed ? DS.success : 'transparent',
                    },
                  ]}>
                    {item.completed && <Ionicons name="checkmark" size={14} color={DS.white} />}
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[
                      styles.checklistText,
                      {
                        color: item.completed ? (isDark ? DS.gray500 : DS.gray400) : (isDark ? DS.white : DS.gray900),
                        textDecorationLine: item.completed ? 'line-through' : 'none',
                        flex: 1,
                      },
                    ]}>
                      {item.text}
                    </Text>
                    {item.critical && (
                      <View style={[styles.criticalBadge, { backgroundColor: `${DS.danger}15` }]}>
                        <Text style={[styles.criticalText, { color: DS.danger }]}>Critical</Text>
                      </View>
                    )}
                  </View>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Report Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const ReportModal = memo(({ visible, onClose, onUpload, onGeneratePDF, reports, onDelete, onUpdate, isDark }: {
  visible: boolean; onClose: () => void; onUpload: () => void; onGeneratePDF: () => void;
  reports: DoctorReport[]; onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<DoctorReport>) => void; isDark: boolean;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Doctor Reports</Text>
          <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <PressableScale onPress={onUpload} activeScale={0.96} style={{ flex: 1 }}>
            <View style={[styles.uploadBtn, { borderColor: DS.primary, backgroundColor: `${DS.primary}08` }]}>
              <Ionicons name="cloud-upload-outline" size={20} color={DS.primary} />
              <Text style={[styles.uploadBtnText, { color: DS.primary }]}>Upload</Text>
            </View>
          </PressableScale>
          <PressableScale onPress={onGeneratePDF} activeScale={0.96} style={{ flex: 1 }}>
            <LinearGradient colors={[DS.accent, '#be185d']} style={styles.uploadBtn}>
              <Ionicons name="document-text-outline" size={20} color={DS.white} />
              <Text style={[styles.uploadBtnText, { color: DS.white }]}>Generate</Text>
            </LinearGradient>
          </PressableScale>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyReports}>
            <Ionicons name="document-text-outline" size={44} color={isDark ? DS.gray600 : DS.gray400} />
            <Text style={[styles.emptyReportsText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
              No reports yet
            </Text>
            <Text style={[styles.emptyReportsSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>
              Upload or generate your first report
            </Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: SCREEN_H * 0.5 }} showsVerticalScrollIndicator={false}>
            {reports.map((report) => {
              const statusColor = report.status === 'approved' ? DS.success : report.status === 'reviewed' ? DS.info : DS.warning;
              const statusLabel = report.status === 'approved' ? 'Approved' : report.status === 'reviewed' ? 'Reviewed' : 'Pending';
              return (
                <View key={report.id} style={[styles.reportRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <View style={[styles.reportIcon, { backgroundColor: `${DS.primary}15` }]}>
                    <Ionicons name="document-text" size={20} color={DS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                      {report.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={[styles.reportMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                        {new Date(report.uploadedAt).toLocaleDateString()}
                      </Text>
                      <View style={[styles.reportStatus, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.reportStatusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {report.uri && (
                      <TouchableOpacity onPress={() => Linking.openURL(report.uri)} style={styles.reportBtn}>
                        <Ionicons name="eye-outline" size={16} color={DS.primary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Update Status', 'Mark this report as:', [
                          { text: 'Pending', onPress: () => onUpdate(report.id, { status: 'pending' }) },
                          { text: 'Reviewed', onPress: () => onUpdate(report.id, { status: 'reviewed' }) },
                          { text: 'Approved', onPress: () => onUpdate(report.id, { status: 'approved' }) },
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                      }}
                      style={styles.reportBtn}
                    >
                      <Ionicons name="pencil-outline" size={16} color={DS.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(report.id)} style={styles.reportBtn}>
                      <Ionicons name="trash-outline" size={16} color={DS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  </Modal>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Reminder Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const ReminderModal = memo(({ visible, onClose, onSchedule, isDark }: {
  visible: boolean; onClose: () => void;
  onSchedule: (title: string, body: string, date: Date) => void; isDark: boolean;
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date] = useState(new Date(Date.now() + 3600000));

  const handleSchedule = () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a reminder title.');
      return;
    }
    onSchedule(title.trim(), body.trim() || 'Safety reminder', date);
    setTitle(''); setBody('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Schedule Reminder</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
            placeholder="e.g., Check babyproofing"
            placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
            placeholder="What do you want to remember?"
            placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            value={body}
            onChangeText={setBody}
            multiline
          />

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Scheduled for</Text>
          <View style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray100, justifyContent: 'center' }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? DS.gray300 : DS.gray700 }}>
              {date.toLocaleString()}
            </Text>
          </View>

          <PressableScale onPress={handleSchedule} activeScale={0.97} style={{ marginTop: 12 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalPrimaryBtn}>
              <Ionicons name="notifications-outline" size={18} color={DS.white} />
              <Text style={styles.modalPrimaryBtnText}>Schedule Reminder</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { triggerHaptic, isDark } = useCustomization();
  const sweetAlert = useSweetAlert();
  const { user } = useAuth();

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
    markTopicCompleted,
    addCustomEmergencyContact,
    removeCustomContact,
    checklists,
    toggleChecklistItem,
    addDoctorReport,
    getDoctorReports,
    deleteDoctorReport,
    updateDoctorReport,
    scheduleSafetyReminder,
    loadSafetyData,
    importDeviceContacts,
    getLocalEmergencyNumbers,
    refreshLocation,
  } = useSafety();

  const { growthIndex } = useGrowthIntelligence();

  const [activeTab, setActiveTab] = useState<SafetyTab>('overview');
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<SafetyChecklist | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<DoctorReport[]>([]);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumber | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadEmergencyNumbers = async () => {
      const numbers = await getLocalEmergencyNumbers();
      if (numbers && numbers.length > 0) {
        const emergency = numbers.find((n: any) => n.type === 'emergency');
        if (emergency) {
          setEmergencyNumbers({
            country: 'Local',
            code: '',
            emergency: emergency.number,
            police: numbers.find((n: any) => n.type === 'police')?.number || emergency.number,
            ambulance: numbers.find((n: any) => n.type === 'ambulance')?.number || emergency.number,
            fire: numbers.find((n: any) => n.type === 'fire')?.number || emergency.number,
            poison: numbers.find((n: any) => n.type === 'poison')?.number || '1-800-222-1222',
          });
        }
      }
    };
    loadEmergencyNumbers();
  }, [getLocalEmergencyNumbers]);

  useFocusEffect(
    useCallback(() => {
      loadSafetyData();
      setReports(getDoctorReports());
    }, [loadSafetyData, getDoctorReports])
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const safetyScore = useMemo(() => getSafetyScore(), [getSafetyScore]);
  const completedCount = useMemo(() => topics.filter((t: SafetyTopic) => t.completedAt).length, [topics]);

  const topRibbon = useMemo(() => {
    const pendingChecklists = checklists.filter((c: any) => c.progress < 100).length;
    const pendingTopics = topics.filter((t: SafetyTopic) => !t.completedAt).length;

    if (emergencyContacts.length === 0) {
      return {
        icon: 'person-add-outline' as const,
        color: DS.warning,
        label: 'Add contacts',
        text: 'Add emergency contacts for faster help',
        onPress: () => setShowContactModal(true),
      };
    }
    if (pendingChecklists > 0) {
      return {
        icon: 'list-outline' as const,
        color: DS.warning,
        label: `${pendingChecklists} checklist${pendingChecklists === 1 ? '' : 's'}`,
        text: 'Complete safety checklists to boost your score',
        onPress: () => setActiveTab('checklists'),
      };
    }
    if (pendingTopics > 0) {
      return {
        icon: 'book-outline' as const,
        color: DS.info,
        label: `${pendingTopics} topic${pendingTopics === 1 ? '' : 's'} to review`,
        text: 'Learn essential safety tips for your baby',
        onPress: () => setActiveTab('topics'),
      };
    }
    return {
      icon: 'shield-checkmark-outline' as const,
      color: DS.success,
      label: 'All set',
      text: 'Your safety setup is complete — you can relax',
    };
  }, [emergencyContacts.length, checklists, topics]);

  const handleTabChange = useCallback((tab: SafetyTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    HAPTIC_LIGHT();
  }, []);

  const handleTopicPress = useCallback((topic: SafetyTopic) => {
    setSelectedTopic(topic);
    setShowTopicModal(true);
    markTipAsViewed(topic.id);
    HAPTIC_LIGHT();
  }, [markTipAsViewed]);

  const handleSOS = useCallback(() => {
    sweetAlert.confirm(
      'SOS Emergency',
      `This will call ${emergencyNumbers?.emergency || '911'} and alert your emergency contacts with your location. Are you sure?`,
      () => {
        Vibration.vibrate([0, 500, 200, 500]);
        triggerSOS();
        sweetAlert.success('SOS Triggered', `Emergency services (${emergencyNumbers?.emergency || '911'}) have been contacted.`);
      },
      () => {},
      `Call ${emergencyNumbers?.emergency || '911'}`,
      'Cancel'
    );
  }, [triggerSOS, sweetAlert, emergencyNumbers]);

  const handleAddContact = useCallback(async (contact: Omit<EmergencyContact, 'id'>) => {
    await addCustomEmergencyContact(contact);
    HAPTIC_SUCCESS();
    sweetAlert.success('Contact Added', `${contact.label} has been added to your emergency contacts.`);
  }, [addCustomEmergencyContact, sweetAlert]);

  const handleImportContacts = useCallback(async () => {
    await importDeviceContacts();
  }, [importDeviceContacts]);

  const handleToggleChecklistItem = useCallback((checklistId: string, itemId: string) => {
    toggleChecklistItem(checklistId, itemId);
    HAPTIC_LIGHT();
  }, [toggleChecklistItem]);

  const handleChecklistPress = useCallback((checklist: SafetyChecklist) => {
    setSelectedChecklist(checklist);
    setShowChecklistModal(true);
    HAPTIC_LIGHT();
  }, []);

  const handleUploadReport = useCallback(async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        setUploading(false);
        return;
      }
      const asset = result.assets[0];
      await addDoctorReport({
        name: asset.name || 'Report',
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size || 0,
        status: 'pending' as const,
      } as any);
      setReports(getDoctorReports());
      setUploading(false);
      HAPTIC_SUCCESS();
      sweetAlert.success('Uploaded', 'Report uploaded successfully.');
    } catch (error) {
      setUploading(false);
      sweetAlert.alert('Error', 'Failed to upload report.');
    }
  }, [addDoctorReport, getDoctorReports, sweetAlert]);

  const handleGeneratePDF = useCallback(() => {
    navigation.navigate('PediatricianPDFExport' as never);
  }, [navigation]);

  const handleDeleteReport = useCallback(async (id: string) => {
    sweetAlert.confirm('Delete Report', 'Are you sure you want to delete this report?',
      async () => {
        await deleteDoctorReport(id);
        setReports(getDoctorReports());
        HAPTIC_SUCCESS();
      },
      () => {},
      'Delete', 'Cancel'
    );
  }, [deleteDoctorReport, getDoctorReports, sweetAlert]);

  const handleUpdateReport = useCallback(async (id: string, updates: Partial<DoctorReport>) => {
    await updateDoctorReport(id, updates);
    setReports(getDoctorReports());
    HAPTIC_SUCCESS();
    sweetAlert.success('Updated', 'Report status updated.');
  }, [updateDoctorReport, getDoctorReports, sweetAlert]);

  const handleScheduleReminder = useCallback(async (title: string, body: string, date: Date) => {
    await scheduleSafetyReminder(title, body, date);
    HAPTIC_SUCCESS();
    sweetAlert.success('Reminder Set', `"${title}" scheduled for ${date.toLocaleString()}`);
  }, [scheduleSafetyReminder, sweetAlert]);

  const handleShareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Location Required', 'Please enable location services.');
        return;
      }
      await shareLocationWithEmergency();
      setLocationSharing(true);
      HAPTIC_SUCCESS();
      sweetAlert.success('Location Shared', 'Your location has been shared with emergency contacts.');
    } catch {
      sweetAlert.alert('Error', 'Could not share location.');
    }
  }, [shareLocationWithEmergency, sweetAlert]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSafetyData();
    setReports(getDoctorReports());
    await refreshLocation();
    setRefreshing(false);
  }, [loadSafetyData, getDoctorReports, refreshLocation]);

  const tabs: { key: SafetyTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'emergency', label: 'Emergency', icon: 'alert-circle-outline' },
    { key: 'topics', label: 'Topics', icon: 'shield-checkmark-outline' },
    { key: 'checklists', label: 'Checklists', icon: 'list-outline' },
    { key: 'intelligence', label: 'AI', icon: 'sparkles-outline' },
    { key: 'reports', label: 'Reports', icon: 'document-text-outline' },
  ];

  const quickActions = [
    { icon: 'people' as const, label: 'Add Contact', color: DS.primary, onPress: () => setShowContactModal(true) },
    { icon: 'download' as const, label: 'Import', color: DS.success, onPress: handleImportContacts },
    { icon: 'notifications' as const, label: 'Reminder', color: DS.warning, onPress: () => setShowReminderModal(true) },
    { icon: 'location' as const, label: 'Location', color: DS.info, onPress: handleShareLocation },
    { icon: 'medical' as const, label: 'Hospitals', color: DS.danger, onPress: findNearbyHospitals },
    { icon: 'document-text' as const, label: 'Reports', color: DS.accent, onPress: () => setActiveTab('reports') },
  ];

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.stickyHeader,
          {
            paddingTop: HEADER_TOP_PADDING,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
          headerAnim,
        ]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              SAFETY
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby?.name || 'Your family'} · {safetyScore}% safe
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowReportModal(true)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="document-text-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={DS.primary}
            colors={[DS.primary, DS.accent]}
            progressViewOffset={HEADER_TOTAL_HEIGHT}
          />
        }
      >
        {/* Pulse */}
        <SafetyPulse
          isDark={isDark}
          safetyScore={safetyScore}
          completedCount={completedCount}
          totalTopics={topics.length}
          contactsCount={emergencyContacts.length}
          streakDays={streakDays}
          onSOS={handleSOS}
          onAddContact={() => setShowContactModal(true)}
          onReports={() => setShowReportModal(true)}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} onPress={topRibbon.onPress} />
        </View>

        {/* Tabs */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Quick Actions" icon="flash-outline" color={DS.warning} isDark={isDark} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
                {quickActions.map((a, i) => (
                  <PressableScale key={i} onPress={a.onPress} activeScale={0.94}>
                    <View style={[styles.quickActionPill, { backgroundColor: `${a.color}12`, borderColor: `${a.color}30` }]}>
                      <Ionicons name={a.icon} size={16} color={a.color} />
                      <Text style={[styles.quickActionText, { color: a.color }]}>{a.label}</Text>
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Streak" icon="flame-outline" color={DS.warning} isDark={isDark} />
              <View style={{ paddingHorizontal: DS.space.lg }}>
                <GlassCard isDark={isDark}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md }}>
                    <View style={[styles.streakIcon, { backgroundColor: `${DS.warning}15` }]}>
                      <Text style={{ fontSize: 26 }}>🔥</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.streakTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                        {streakDays}-Day Safety Streak
                      </Text>
                      <Text style={[styles.streakSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        Keep checking safety daily
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Ionicons key={i} name="flame" size={14}
                          color={i < Math.min(streakDays, 7) ? DS.warning : isDark ? 'rgba(255,255,255,0.08)' : DS.gray200} />
                      ))}
                    </View>
                  </View>
                </GlassCard>
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Location Sharing" icon="location-outline" color={DS.info} isDark={isDark} />
              <View style={{ paddingHorizontal: DS.space.lg }}>
                <GlassCard isDark={isDark}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md }}>
                    <View style={[styles.locationDot, { backgroundColor: locationSharing ? DS.success : DS.danger }]}>
                      <View style={[styles.locationPulse, { backgroundColor: locationSharing ? `${DS.success}30` : `${DS.danger}30` }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                        {locationSharing ? 'Location Sharing On' : 'Location Sharing Off'}
                      </Text>
                      <Text style={[styles.locationDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {locationSharing ? 'Contacts can see your location' : 'Enable for emergency response'}
                      </Text>
                    </View>
                    <Switch
                      value={locationSharing}
                      onValueChange={handleShareLocation}
                      trackColor={{ false: isDark ? DS.gray700 : DS.gray300, true: `${DS.success}50` }}
                      thumbColor={locationSharing ? DS.success : isDark ? DS.gray500 : DS.white}
                    />
                  </View>
                </GlassCard>
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Recent Topics" subtitle={`${completedCount}/${topics.length}`} icon="shield-checkmark-outline" color={DS.primary} isDark={isDark} action={() => setActiveTab('topics')} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {topics.slice(0, 3).map((topic: SafetyTopic, i: number) => (
                  <PressableScale key={topic.id} onPress={() => handleTopicPress(topic)} activeScale={0.98}>
                    <View style={[styles.topicRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <View style={[styles.topicRowIcon, { backgroundColor: `${topic.color}15` }]}>
                        <Ionicons name={topic.icon as any} size={20} color={topic.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.topicRowTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{topic.title}</Text>
                        <Text style={[styles.topicRowDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{topic.description}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray600 : DS.gray400} />
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ═══ EMERGENCY ═══ */}
        {activeTab === 'emergency' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Emergency Numbers" subtitle={emergencyNumbers?.country || 'Local'} icon="alert-circle-outline" color={DS.danger} isDark={isDark} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {[
                  { label: 'Emergency', number: emergencyNumbers?.emergency || '911', color: DS.danger, icon: 'alert-circle' as const },
                  { label: 'Police', number: emergencyNumbers?.police || '911', color: DS.info, icon: 'shield' as const },
                  { label: 'Ambulance', number: emergencyNumbers?.ambulance || '911', color: DS.success, icon: 'medical' as const },
                  { label: 'Fire', number: emergencyNumbers?.fire || '911', color: DS.warning, icon: 'flame' as const },
                  emergencyNumbers?.poison ? { label: 'Poison', number: emergencyNumbers.poison, color: '#8b5cf6', icon: 'warning' as const } : null,
                ].filter(Boolean).map((item: any) => (
                  <PressableScale key={item.label} onPress={() => callEmergency(item.number, item.label, 'emergency')} activeScale={0.97}>
                    <View style={[styles.emergencyNumberRow, { backgroundColor: `${item.color}10`, borderColor: `${item.color}30` }]}>
                      <View style={[styles.emergencyNumberIcon, { backgroundColor: `${item.color}18` }]}>
                        <Ionicons name={item.icon} size={20} color={item.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.emergencyNumberLabel, { color: isDark ? DS.gray300 : DS.gray600 }]}>{item.label}</Text>
                        <Text style={[styles.emergencyNumberValue, { color: item.color }]}>{item.number}</Text>
                      </View>
                      <Ionicons name="call" size={20} color={item.color} />
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Emergency Contacts" subtitle={`${emergencyContacts.filter((c: any) => c.type === 'emergency' || c.type === 'family').length} contacts`} icon="people-outline" color={DS.primary} isDark={isDark} action={() => setShowContactModal(true)} actionLabel="Add" />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {emergencyContacts.filter((c: any) => c.type === 'emergency' || c.type === 'family').map((contact: EmergencyContact) => (
                  <View key={contact.id} style={[styles.contactRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.contactAvatar, { backgroundColor: `${contact.color}15` }]}>
                      <Ionicons name={contact.icon as any} size={20} color={contact.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactName, { color: isDark ? DS.white : DS.gray900 }]}>{contact.label}</Text>
                      <Text style={[styles.contactNumber, { color: isDark ? DS.gray400 : DS.gray500 }]}>{contact.number}</Text>
                      {contact.relation && (
                        <Text style={[styles.contactRelation, { color: isDark ? DS.gray500 : DS.gray400 }]}>{contact.relation}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.contactBtn, { backgroundColor: `${contact.color}15` }]}
                      onPress={() => callEmergency(contact.number, contact.label, contact.type)}
                    >
                      <Ionicons name="call" size={16} color={contact.color} />
                    </TouchableOpacity>
                    {!contact.isDefault && (
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: `${DS.danger}12` }]}
                        onPress={() => {
                          sweetAlert.confirm(
                            'Remove Contact',
                            `Remove "${contact.label}" from emergency contacts?`,
                            () => removeCustomContact(contact.id),
                            () => {},
                            'Remove', 'Cancel'
                          );
                        }}
                      >
                        <Ionicons name="close" size={14} color={DS.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Nearby Help" icon="location-outline" color={DS.info} isDark={isDark} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                <PressableScale onPress={handleShareLocation} activeScale={0.98}>
                  <View style={[styles.locationActionRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.locationActionIcon, { backgroundColor: `${DS.warning}15` }]}>
                      <Ionicons name="share-outline" size={18} color={DS.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationActionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Share Location</Text>
                      <Text style={[styles.locationActionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Send to contacts</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                </PressableScale>
                <PressableScale onPress={findNearbyHospitals} activeScale={0.98}>
                  <View style={[styles.locationActionRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.locationActionIcon, { backgroundColor: `${DS.danger}15` }]}>
                      <Ionicons name="medical" size={18} color={DS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationActionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Hospitals</Text>
                      <Text style={[styles.locationActionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Closest medical facilities</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                </PressableScale>
                <PressableScale onPress={findNearbyPediatricians} activeScale={0.98}>
                  <View style={[styles.locationActionRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.locationActionIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="person" size={18} color={DS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationActionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Pediatricians</Text>
                      <Text style={[styles.locationActionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Nearby specialists</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                </PressableScale>
              </View>
            </View>
          </>
        )}

        {/* ═══ TOPICS ═══ */}
        {activeTab === 'topics' && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Safety Topics" subtitle={`${completedCount}/${topics.length} completed`} icon="shield-checkmark-outline" color={DS.primary} isDark={isDark} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DS.space.lg, gap: 10 }}>
              {topics.map((topic: SafetyTopic, i: number) => {
                const isCompleted = !!topic.completedAt;
                return (
                  <Animated.View key={topic.id} entering={FadeInUp.delay(i * 40).springify()} style={{ width: (SCREEN_W - 40 - 10) / 2 }}>
                    <PressableScale onPress={() => handleTopicPress(topic)} activeScale={0.96}>
                      <View style={[
                        styles.topicCard,
                        {
                          borderColor: isCompleted ? `${DS.success}40` : isDark ? DS.darkBorder : DS.gray200,
                          backgroundColor: isCompleted ? (isDark ? `${DS.success}08` : `${DS.success}04`) : isDark ? DS.darkCard : DS.white,
                        },
                      ]}>
                        <View style={{ position: 'relative' }}>
                          <View style={[styles.topicIcon, { backgroundColor: `${topic.color}15` }]}>
                            <Ionicons name={topic.icon as any} size={22} color={topic.color} />
                          </View>
                          {isCompleted && (
                            <View style={styles.completedBadge}>
                              <Ionicons name="checkmark" size={10} color={DS.white} />
                            </View>
                          )}
                        </View>
                        <Text style={[styles.topicTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>{topic.title}</Text>
                        <Text style={[styles.topicCategory, { color: topic.color }]}>{topic.category}</Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══ CHECKLISTS ═══ */}
        {activeTab === 'checklists' && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Safety Checklists" subtitle={`${checklists.length} available`} icon="list-outline" color={DS.primary} isDark={isDark} />
            <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
              {checklists.map((checklist: SafetyChecklist) => (
                <PressableScale key={checklist.id} onPress={() => handleChecklistPress(checklist)} activeScale={0.98}>
                  <View style={[styles.checklistCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.checklistIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="list" size={20} color={DS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.checklistTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{checklist.title}</Text>
                      <Text style={[styles.checklistMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {checklist.items.filter(i => i.completed).length}/{checklist.items.length} items
                      </Text>
                      <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray200, marginTop: 6 }]}>
                        <View style={[styles.progressBarFill, { width: `${checklist.progress}%`, backgroundColor: DS.primary }]} />
                      </View>
                    </View>
                    <Text style={[styles.checklistPercent, { color: DS.primary }]}>{checklist.progress}%</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        )}

        {/* ═══ INTELLIGENCE ═══ */}
        {activeTab === 'intelligence' && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Safety Intelligence" subtitle="AI-powered monitoring" icon="sparkles-outline" color={DS.accent} isDark={isDark} />
            <View style={{ paddingHorizontal: DS.space.lg }}>
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md, gap: 12 }}>
                  {[
                    {
                      pattern: checklists.some((c: any) => c.progress < 100) ? 'Checklists pending' : 'All checklists complete',
                      confidence: 95,
                      basedOn: `${checklists.filter((c: any) => c.progress < 100).length} incomplete`,
                      emoji: checklists.some((c: any) => c.progress < 100) ? '⚠️' : '✅',
                      color: checklists.some((c: any) => c.progress < 100) ? DS.danger : DS.success,
                    },
                    {
                      pattern: topics.filter((t: SafetyTopic) => !t.completedAt).length > 0 ? 'Topics to review' : 'All topics done',
                      confidence: 88,
                      basedOn: `${topics.filter((t: SafetyTopic) => !t.completedAt).length} pending`,
                      emoji: '📋',
                      color: DS.warning,
                    },
                    {
                      pattern: 'Weekly safety review',
                      confidence: 72,
                      basedOn: 'Habit pattern',
                      emoji: '📅',
                      color: '#8b5cf6',
                    },
                  ].map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.predictorTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{p.pattern}</Text>
                        <Text style={[styles.predictorSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>{p.basedOn}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[styles.predictorBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray200 }]}>
                          <View style={[styles.predictorBarFill, { width: `${p.confidence}%`, backgroundColor: p.color }]} />
                        </View>
                        <Text style={[styles.predictorConf, { color: isDark ? DS.gray400 : DS.gray500 }]}>{p.confidence}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </View>

            {growthIndex && (
              <View style={{ marginTop: DS.space.lg }}>
                <SectionHeader title="Growth Intelligence" icon="trending-up-outline" color={DS.success} isDark={isDark} />
                <View style={{ paddingHorizontal: DS.space.lg }}>
                  <GlassCard isDark={isDark} onPress={() => navigation.navigate('GrowthDashboard' as never)}>
                    <View style={{ padding: DS.space.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
                          <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}15` }]}>
                            <Ionicons name="sparkles" size={14} color={DS.primary} />
                          </View>
                          <Text style={[styles.giTitle, { color: isDark ? DS.white : DS.gray900 }]}>Composite Score</Text>
                        </View>
                        <View style={[styles.giComposite, { backgroundColor: `${growthIndex.compositeIndex >= 80 ? DS.success : growthIndex.compositeIndex >= 60 ? DS.warning : DS.danger}15` }]}>
                          <Text style={[styles.giCompositeText, { color: growthIndex.compositeIndex >= 80 ? DS.success : growthIndex.compositeIndex >= 60 ? DS.warning : DS.danger }]}>
                            {growthIndex.compositeIndex || 0}
                          </Text>
                        </View>
                      </View>
                      {[
                        { label: 'Nutrition', score: growthIndex.nutritionScore?.value || 0, color: '#FF9F43' },
                        { label: 'Rest', score: growthIndex.restScore?.value || 0, color: '#5F27CD' },
                        { label: 'Physical', score: growthIndex.physicalScore?.value || 0, color: '#10AC84' },
                        { label: 'Cognitive', score: growthIndex.cognitiveScore?.value || 0, color: '#FFD700' },
                      ].map((item) => (
                        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <Text style={[styles.giLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{item.label}</Text>
                          <View style={[styles.progressBarBg, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray200 }]}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(item.score, 100)}%`, backgroundColor: item.color }]} />
                          </View>
                          <Text style={[styles.giScore, { color: item.color }]}>{item.score}</Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══ REPORTS ═══ */}
        {activeTab === 'reports' && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Doctor Reports" subtitle={`${reports.length} reports`} icon="document-text-outline" color={DS.primary} isDark={isDark} />

            <View style={{ paddingHorizontal: DS.space.lg, gap: 8, marginBottom: DS.space.md }}>
              <PressableScale onPress={handleUploadReport} disabled={uploading} activeScale={0.97}>
                <View style={[styles.uploadBtn, { borderColor: DS.primary, backgroundColor: `${DS.primary}08` }]}>
                  {uploading ? <ActivityIndicator color={DS.primary} /> : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color={DS.primary} />
                      <Text style={[styles.uploadBtnText, { color: DS.primary }]}>Upload Report</Text>
                    </>
                  )}
                </View>
              </PressableScale>
              <PressableScale onPress={handleGeneratePDF} activeScale={0.97}>
                <LinearGradient colors={[DS.accent, '#be185d']} style={styles.uploadBtn}>
                  <Ionicons name="document-text-outline" size={20} color={DS.white} />
                  <Text style={[styles.uploadBtnText, { color: DS.white }]}>Generate PDF</Text>
                </LinearGradient>
              </PressableScale>
            </View>

            <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
              {reports.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                    <Ionicons name="document-text-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No reports yet</Text>
                  <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Upload or generate your first report</Text>
                </View>
              ) : reports.map((report) => {
                const statusColor = report.status === 'approved' ? DS.success : report.status === 'reviewed' ? DS.info : DS.warning;
                const statusLabel = report.status === 'approved' ? 'Approved' : report.status === 'reviewed' ? 'Reviewed' : 'Pending';
                return (
                  <View key={report.id} style={[styles.reportRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.reportIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="document-text" size={20} color={DS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reportName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{report.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={[styles.reportMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                          {new Date(report.uploadedAt).toLocaleDateString()}
                        </Text>
                        <View style={[styles.reportStatus, { backgroundColor: `${statusColor}15` }]}>
                          <Text style={[styles.reportStatusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {report.uri && (
                        <TouchableOpacity onPress={() => Linking.openURL(report.uri)} style={styles.reportBtn}>
                          <Ionicons name="eye-outline" size={16} color={DS.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Update Status', 'Mark this report as:', [
                            { text: 'Pending', onPress: () => handleUpdateReport(report.id, { status: 'pending' }) },
                            { text: 'Reviewed', onPress: () => handleUpdateReport(report.id, { status: 'reviewed' }) },
                            { text: 'Approved', onPress: () => handleUpdateReport(report.id, { status: 'approved' }) },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        }}
                        style={styles.reportBtn}
                      >
                        <Ionicons name="pencil-outline" size={16} color={DS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteReport(report.id)} style={styles.reportBtn}>
                        <Ionicons name="trash-outline" size={16} color={DS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Topic Modal */}
      <Modal visible={showTopicModal} transparent animationType="fade" onRequestClose={() => setShowTopicModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTopicModal(false)} />
          <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {selectedTopic?.title || 'Topic'}
              </Text>
              <TouchableOpacity onPress={() => setShowTopicModal(false)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.65 }}>
              {selectedTopic && (
                <>
                  <View style={[styles.topicDetailIcon, { backgroundColor: `${selectedTopic.color}15` }]}>
                    <Ionicons name={selectedTopic.icon as any} size={32} color={selectedTopic.color} />
                  </View>
                  <Text style={[styles.topicDetailDesc, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                    {selectedTopic.description}
                  </Text>
                  {selectedTopic.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <View style={[styles.tipBullet, { backgroundColor: selectedTopic.color }]}>
                        <Text style={styles.tipNumber}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.tipText, { color: isDark ? DS.gray300 : DS.gray700 }]}>{tip}</Text>
                    </View>
                  ))}
                  {selectedTopic.emergencyNumbers?.map((num, i) => (
                    <PressableScale key={i} onPress={() => callEmergency(num.number, num.label, 'emergency')} activeScale={0.97}>
                      <LinearGradient
                        colors={[selectedTopic.color, selectedTopic.color + 'cc']}
                        style={styles.topicCallBtn}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="call" size={18} color={DS.white} />
                        <Text style={styles.topicCallText}>Call {num.label}</Text>
                      </LinearGradient>
                    </PressableScale>
                  ))}
                  <PressableScale
                    onPress={() => {
                      if (selectedTopic.completedAt) {
                        sweetAlert.alert('Already Completed', 'This topic has already been marked as completed.');
                      } else {
                        markTopicCompleted(selectedTopic.id);
                        setShowTopicModal(false);
                        sweetAlert.success('Completed!', 'Topic marked as completed.');
                      }
                    }}
                    activeScale={0.97}
                  >
                    <LinearGradient
                      colors={selectedTopic.completedAt ? [DS.gray400, DS.gray500] : [DS.primary, DS.accent]}
                      style={styles.completeBtn}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name={selectedTopic.completedAt ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={DS.white} />
                      <Text style={styles.completeBtnText}>
                        {selectedTopic.completedAt ? 'Completed' : 'Mark as Completed'}
                      </Text>
                    </LinearGradient>
                  </PressableScale>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ContactModal visible={showContactModal} onClose={() => setShowContactModal(false)} onAdd={handleAddContact} isDark={isDark} />
      <ChecklistModal visible={showChecklistModal} checklist={selectedChecklist} onClose={() => setShowChecklistModal(false)} onToggleItem={handleToggleChecklistItem} isDark={isDark} />
      <ReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} onUpload={handleUploadReport} onGeneratePDF={handleGeneratePDF} reports={reports} onDelete={handleDeleteReport} onUpdate={handleUpdateReport} isDark={isDark} />
      <ReminderModal visible={showReminderModal} onClose={() => setShowReminderModal(false)} onSchedule={handleScheduleReminder} isDark={isDark} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33 },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseScorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseScoreText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg, marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },

  sosQuickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: DS.radius.md, marginTop: DS.space.md,
  },
  sosQuickText: { color: DS.white, fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'center' },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Sections */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Glass Card */
  glassCard: {
    borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden',
    ...DS.shadow.sm,
  },
  glassContent: { flex: 1 },

  /* Tabs */
  tabBar: {
    flexDirection: 'row', marginHorizontal: DS.space.lg,
    padding: 4, borderRadius: DS.radius.full, gap: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },

  /* Quick actions */
  quickActionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: DS.radius.full, borderWidth: 1,
  },
  quickActionText: { fontSize: 12, fontWeight: '700' },

  /* Streak */
  streakIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { fontSize: 15, fontWeight: '800' },
  streakSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Location */
  locationDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  locationPulse: { width: 28, height: 28, borderRadius: 14, position: 'absolute' },
  locationTitle: { fontSize: 14, fontWeight: '700' },
  locationDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  locationActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  locationActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locationActionTitle: { fontSize: 13, fontWeight: '700' },
  locationActionDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Topic rows */
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  topicRowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topicRowTitle: { fontSize: 13, fontWeight: '700' },
  topicRowDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Topic cards */
  topicCard: {
    borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1,
    minHeight: 130, ...DS.shadow.sm,
  },
  topicIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  completedBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: DS.success, borderRadius: 10,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: DS.white,
  },
  topicTitle: { fontSize: 13, fontWeight: '700', marginTop: 10, lineHeight: 17 },
  topicCategory: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', marginTop: 4 },

  /* Emergency numbers */
  emergencyNumberRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emergencyNumberIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emergencyNumberLabel: { fontSize: 12, fontWeight: '600' },
  emergencyNumberValue: { fontSize: 16, fontWeight: '800', marginTop: 1 },

  /* Contacts */
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  contactAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 13, fontWeight: '700' },
  contactNumber: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  contactRelation: { fontSize: 10, fontWeight: '500', marginTop: 1, opacity: 0.7 },
  contactBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  /* Checklists */
  checklistCard: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  checklistIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checklistTitle: { fontSize: 13, fontWeight: '700' },
  checklistMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  checklistPercent: { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  /* Progress bar */
  progressBarBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  /* Predictor */
  predictorTitle: { fontSize: 13, fontWeight: '700' },
  predictorSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  predictorBarBg: { width: 60, height: 4, borderRadius: 2, overflow: 'hidden' },
  predictorBarFill: { height: '100%', borderRadius: 2 },
  predictorConf: { fontSize: 10, fontWeight: '700' },

  /* Growth Intelligence */
  giTitle: { fontSize: 13, fontWeight: '700' },
  giComposite: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  giCompositeText: { fontSize: 15, fontWeight: '800' },
  giLabel: { width: 68, fontSize: 11, fontWeight: '600' },
  giScore: { width: 28, fontSize: 11, fontWeight: '800', textAlign: 'right' },

  /* Uploads */
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: DS.radius.md, borderWidth: 2, borderStyle: 'dashed',
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700' },

  /* Reports */
  reportRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  reportIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reportName: { fontSize: 13, fontWeight: '700' },
  reportMeta: { fontSize: 10, fontWeight: '500' },
  reportStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  reportStatusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  reportBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Empty */
  emptyState: {
    alignItems: 'center', paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  emptyReports: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyReportsText: { fontSize: 13, fontWeight: '600' },
  emptyReportsSub: { fontSize: 11, fontWeight: '500' },

  /* Modals */
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'],
    padding: DS.space.lg, ...DS.shadow.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: DS.space.md },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  modalSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  inputLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 6, marginTop: 10,
  },
  input: { height: 46, borderRadius: DS.radius.md, paddingHorizontal: 14, fontSize: 14, fontWeight: '600' },
  inputMulti: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1,
  },
  modalPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: DS.radius.md,
  },
  modalPrimaryBtnText: { color: DS.white, fontSize: 14, fontWeight: '800' },

  /* Checklist rows */
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checklistText: { fontSize: 13, fontWeight: '500' },
  criticalBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  criticalText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  /* Topic modal */
  topicDetailIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: DS.space.md,
  },
  topicDetailDesc: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: DS.space.md, lineHeight: 19 },
  tipBullet: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipNumber: { color: DS.white, fontSize: 11, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  topicCallBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: DS.radius.md, marginTop: 8 },
  topicCallText: { color: DS.white, fontSize: 13, fontWeight: '800' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: DS.radius.md, marginTop: 12 },
  completeBtnText: { color: DS.white, fontSize: 14, fontWeight: '800' },
});