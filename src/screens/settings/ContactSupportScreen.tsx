import React, { useState, useCallback, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import { supabase } from '../../lib/supabase';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactSupport'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  secondary: '#8b5cf6',
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

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE RUNTIME HELPERS (defensive — prevent "undefined is not a function")
   ═══════════════════════════════════════════════════════════════════════════ */

// Haptics might be missing in some builds. Wrap so it never throws.
const safeHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    Haptics.impactAsync?.(style).catch(() => {});
  } catch {
    /* noop */
  }
};

// Spinner fallback if UniversalSpinner export is undefined
const SafeSpinner: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#fff' }) =>
  typeof UniversalSpinner === 'function' ? (
    <UniversalSpinner size={size} color={color} variant="liquid" section="settings" />
  ) : (
    <Text style={{ color, fontSize: 14, fontWeight: '700' }}>…</Text>
  );

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES + CATEGORIES
   ═══════════════════════════════════════════════════════════════════════════ */

interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  route?: keyof RootStackParamList;
  params?: any;
}

interface AltContact {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  url?: string;
  route?: keyof RootStackParamList;
  color: string;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline' },
  { id: 'feature', label: 'Feature Request', icon: 'bulb-outline' },
  { id: 'account', label: 'Account & Security', icon: 'lock-closed-outline', route: 'SecurityCenter' },
  { id: 'password', label: 'Change Password/PIN', icon: 'key-outline', route: 'SecurityCenter', params: { mode: 'change' } },
  { id: 'biometric', label: 'Biometric Setup', icon: 'finger-print-outline', route: 'BiometricSetup' },
  { id: 'data', label: 'Data & Backup', icon: 'cloud-upload-outline', route: 'BackupRestore' },
  { id: 'family', label: 'Family Dashboard', icon: 'people-outline', route: 'FamilySharing' },
  { id: 'profile', label: 'Baby Profile', icon: 'person-circle-outline', route: 'Profile' },
  { id: 'switch', label: 'Switch Baby', icon: 'swap-horizontal-outline', route: 'SwitchBaby' },
  { id: 'track', label: 'Tracking Issues', icon: 'timer-outline', route: 'UniversalTrackerHub' },
  { id: 'reminders', label: 'Reminders', icon: 'alarm-outline', route: 'TrackerReminders' },
  { id: 'achievements', label: 'Achievements', icon: 'trophy-outline', route: 'Achievements' },
  { id: 'growth', label: 'Growth Charts', icon: 'trending-up-outline', route: 'GrowthDashboard' },
  { id: 'gallery', label: 'Photos & Gallery', icon: 'images-outline', route: 'Gallery' },
  { id: 'sound', label: 'Sound Mixer', icon: 'musical-notes-outline', route: 'SoundMixer' },
  { id: 'customize', label: 'Customize App', icon: 'color-wand-outline', route: 'Customize' },
  { id: 'language', label: 'Language', icon: 'language-outline', route: 'LanguageSettings' },
  { id: 'units', label: 'Unit Settings', icon: 'options-outline', route: 'UnitSettings' },
  { id: 'safety', label: 'Safety Corner', icon: 'shield-half-outline', route: 'SafetyCorner' },
  { id: 'privacy', label: 'Privacy Policy', icon: 'document-text-outline', route: 'PrivacyPolicy' },
  { id: 'chat', label: 'Family Chat', icon: 'chatbubbles-outline', route: 'FamilyChatList' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   AURA SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { safeHaptic(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const GlassCard = React.memo(({ children, style, isDark, delay = 0 }: any) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
    <LinearGradient colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    {children}
  </Animated.View>
));

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
  </View>
));

/* ─── Support Capsule ─── */
const SupportCapsule = React.memo<any>(({ isDark, isConnected }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const statusColor = isConnected ? DS.success : DS.warning;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.avatarGlow, glowStyle]} />
            <Animated.View style={[styles.avatarRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Ionicons name="chatbubble-ellipses" size={30} color={DS.primary} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              Contact Support
            </Text>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              We respond within 24 hours
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15`, marginTop: 6 }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {isConnected ? 'Connected' : 'Offline queue'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
        <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
      </View>
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContactSupportScreen({ navigation }: Props) {
  // ── SAFE sweetAlert: works whether hook returns { sweetAlert }, { show }, { alert } or { confirm }
  const sweetApi: any = useSweetAlert();
  const sweetAlert: (opts: any) => void =
    typeof sweetApi?.sweetAlert === 'function' ? sweetApi.sweetAlert
    : typeof sweetApi?.show === 'function' ? sweetApi.show
    : typeof sweetApi?.alert === 'function' ? sweetApi.alert
    : typeof sweetApi?.confirm === 'function' ? sweetApi.confirm
    : (opts: any) => {
        // Last-resort fallback so the app never crashes on a missing alert API
        // eslint-disable-next-line no-console
        console.warn('[ContactSupport] sweetAlert unavailable:', opts?.title, opts?.message);
      };

  const insets = useSafeAreaInsets();
  const { darkMode: isDark, themeColors, reduceMotion } = useCustomization();
  const primary = themeColors?.primary || DS.primary;

  const [user, setUser] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { error } = await supabase.from('tracker_entries').select('id').limit(1);
        setIsConnected(!error);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch { setIsConnected(false); }
    };
    checkSupabase();
  }, []);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleHaptic = (style: 'light' | 'medium' = 'light') => {
    if (!reduceMotion) {
      safeHaptic(
        style === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
    }
  };

  const handleCategoryPress = (cat: CategoryItem) => {
    handleHaptic('light');
    setCategory(cat.id);
    if (cat.route) {
      sweetAlert({
        title: `Go to ${cat.label}?`,
        message: `We'll take you to the ${cat.label} screen for help with this topic.`,
        type: 'question', confirmText: 'Go There', cancelText: 'Stay', showCancel: true,
        onConfirm: () => {
          if (cat.params) navigation.navigate(cat.route as any, cat.params as any);
          else navigation.navigate(cat.route as any);
        },
      });
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      sweetAlert({ title: 'Missing Info', message: 'Please fill in the subject and message.', type: 'warning', confirmText: 'OK' });
      return;
    }

    handleHaptic('medium');
    setIsSending(true);
    setSendProgress(0);

    const progressInterval = setInterval(() => {
      setSendProgress(prev => prev >= 90 ? (clearInterval(progressInterval), 90) : prev + 10);
    }, 200);

    try {
      const supportData = {
        email, category, subject, message,
        user_id: user?.id, app_version: '1.0.0',
        platform: Platform.OS,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('support_tickets').insert([supportData]);
      if (error) throw error;

      setSendProgress(100);
      await new Promise(r => setTimeout(r, 300));

      sweetAlert({
        title: 'Message Sent! 🎉',
        message: 'Our team will get back to you within 24 hours.',
        type: 'success', confirmText: 'Great',
        onConfirm: () => { setSubject(''); setMessage(''); navigation.goBack(); },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Send error:', error);
      sweetAlert({
        title: 'Send Failed',
        message: 'Could not send. Try again or use an alternative contact method.',
        type: 'error', confirmText: 'Try Again',
        onConfirm: () => { setIsSending(false); setSendProgress(0); },
      });
    } finally {
      clearInterval(progressInterval);
      setIsSending(false);
    }
  };

  const openLink = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (e) { /* eslint-disable-next-line no-console */ console.warn('Failed to open link:', e); }
  };

  const altContacts: AltContact[] = [
    { icon: 'mail-outline', label: 'Email', value: 'support@littleloom.app', url: 'mailto:support@littleloom.app', color: DS.primary },
    { icon: 'logo-twitter', label: 'Twitter / X', value: '@LittleLoomApp', url: 'https://x.com/LittleLoomApp', color: '#1DA1F2' },
    { icon: 'help-circle-outline', label: 'Help Center', value: 'Browse FAQs', route: 'HelpCenter', color: DS.success },
    { icon: 'document-text-outline', label: 'Privacy Policy', value: 'Read our policy', route: 'PrivacyPolicy', color: DS.warning },
  ];

  const handleAltContact = (contact: AltContact) => {
    handleHaptic('light');
    if (contact.route) navigation.navigate(contact.route as any);
    else if (contact.url) openLink(contact.url);
  };

  const selectedCategory = CATEGORIES.find(c => c.id === category);
  const canSend = !!subject.trim() && !!message.trim() && !isSending;

  const topRibbon = canSend
    ? { icon: 'checkmark-circle-outline' as const, color: DS.success, label: 'Ready to send', text: `${selectedCategory?.label || 'Message'} · Complete` }
    : { icon: 'information-circle-outline' as const, color: DS.info, label: 'Getting started', text: `${selectedCategory?.label || 'Choose a category'} · ${subject ? 'Add message' : 'Add subject'}` };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
          style={StyleSheet.absoluteFill}
        />

        {/* Sticky header */}
        <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Contact Support</Text>
          <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>We reply within 24 hours</Text>
        </Animated.View>

        {/* Back */}
        <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
            <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
              <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
            </View>
          </PressableScale>
        </Animated.View>

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        >
          {/* Capsule */}
          <View style={{ paddingHorizontal: DS.space.lg }}>
            <SupportCapsule isDark={isDark} isConnected={isConnected} />
          </View>

          {/* Ribbon */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <InsightRibbon isDark={isDark} {...topRibbon} />
          </View>

          {/* Category selection */}
          <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="What do you need help with?" subtitle={`${CATEGORIES.length} topics`} icon="grid-outline" color={DS.primary} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => handleCategoryPress(cat)}
                      activeOpacity={0.85}
                      style={[
                        styles.catChip,
                        { backgroundColor: active ? DS.primary : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100), borderColor: active ? DS.primary : 'transparent' },
                      ]}
                    >
                      <Ionicons name={cat.icon as any} size={14} color={active ? DS.white : (isDark ? DS.gray400 : DS.gray500)} />
                      <Text style={[styles.catChipText, { color: active ? DS.white : (isDark ? DS.gray300 : DS.gray700) }, active && { fontWeight: '800' }]}>
                        {cat.label}
                      </Text>
                      {cat.route && !active && <Ionicons name="open-outline" size={10} color={isDark ? DS.gray500 : DS.gray400} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          </View>

          {/* Form */}
          <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="Your Message" subtitle={`${selectedCategory?.label}`} icon="create-outline" color={DS.accent} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md, gap: DS.space.md }}>
                <View>
                  <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Your Email</Text>
                  <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="mail-outline" size={16} color={DS.primary} />
                    <TextInput
                      style={[styles.inputText, { color: isDark ? DS.white : DS.gray900 }]}
                      placeholder="you@example.com"
                      placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      selectionColor={primary}
                    />
                  </View>
                </View>

                <View>
                  <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Subject</Text>
                  <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="text-outline" size={16} color={DS.primary} />
                    <TextInput
                      style={[styles.inputText, { color: isDark ? DS.white : DS.gray900 }]}
                      placeholder="What's this about?"
                      placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                      value={subject}
                      onChangeText={setSubject}
                      selectionColor={primary}
                    />
                  </View>
                </View>

                <View>
                  <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Message</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, color: isDark ? DS.white : DS.gray900, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}
                    placeholder="Describe your issue or suggestion..."
                    placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    selectionColor={primary}
                  />
                </View>

                {isSending && (
                  <View style={{ gap: 6 }}>
                    <View style={[styles.progressBg, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <View style={[styles.progressFill, { width: `${sendProgress}%`, backgroundColor: DS.primary }]} />
                    </View>
                    <Text style={[styles.progressText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {sendProgress < 100 ? 'Sending…' : 'Sent!'}
                    </Text>
                  </View>
                )}
              </View>
            </GlassCard>
          </View>

          {/* Send */}
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <PressableScale onPress={handleSend} disabled={!canSend} activeScale={0.97}>
              <LinearGradient
                colors={canSend ? [DS.primary, DS.accent] : (isDark ? [DS.gray700, DS.gray700] : [DS.gray300, DS.gray400])}
                style={styles.sendBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {isSending ? <SafeSpinner size={18} color={DS.white} /> : <Ionicons name="send" size={16} color={DS.white} />}
                <Text style={styles.sendText}>{isSending ? 'Sending…' : 'Send Message'}</Text>
              </LinearGradient>
            </PressableScale>
          </View>

          {/* Alt contacts */}
          <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="Other Ways to Reach Us" subtitle="Email, social & help" icon="chatbubbles-outline" color={DS.success} />
            <View style={[styles.linkList, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {altContacts.map((contact, i) => (
                <React.Fragment key={contact.label}>
                  <PressableScale onPress={() => handleAltContact(contact)} activeScale={0.98}>
                    <View style={styles.linkRow}>
                      <View style={[styles.linkIcon, { backgroundColor: `${contact.color}15` }]}>
                        <Ionicons name={contact.icon} size={18} color={contact.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.linkLabel, { color: isDark ? DS.white : DS.gray900 }]}>{contact.label}</Text>
                        <Text style={[styles.linkValue, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{contact.value}</Text>
                      </View>
                      <Ionicons name={contact.route ? 'chevron-forward' : 'open-outline'} size={15} color={isDark ? DS.gray500 : DS.gray400} />
                    </View>
                  </PressableScale>
                  {i < altContacts.length - 1 && <View style={[styles.linkDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        </Animated.ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: `${DS.primary}35` },
  avatarRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  avatarInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  capsuleName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '80%' },
  capsuleSub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },

  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '600' },

  inputLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 11, borderWidth: 1 },
  inputText: { flex: 1, fontSize: 13, fontWeight: '600' },
  textArea: { height: 100, borderRadius: 11, padding: DS.space.sm + 2, fontSize: 13, fontWeight: '500', borderWidth: 1 },

  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  sendText: { color: DS.white, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },

  linkList: { borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  linkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 13, fontWeight: '700' },
  linkValue: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  linkDivider: { height: StyleSheet.hairlineWidth, marginLeft: DS.space.md + 36 + DS.space.md },
});