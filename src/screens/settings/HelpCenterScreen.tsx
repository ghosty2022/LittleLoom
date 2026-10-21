import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

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

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface FaqItem { q: string; a: string }
interface FaqCategory { category: string; icon: string; color: string; items: FaqItem[] }

const FAQS: FaqCategory[] = [
  {
    category: 'Getting Started', icon: 'rocket-outline', color: DS.primary,
    items: [
      { q: 'How do I add my first baby?', a: 'Go to Settings → Family → Add Baby, or tap the baby icon on your profile card.' },
      { q: 'Can I track multiple babies?', a: 'Yes! Add multiple profiles and switch between them from the profile card or Switch Baby screen.' },
      { q: 'How do I invite a co-parent?', a: "Settings → Family Dashboard → Invite Co-Parent. They'll receive a link to join." },
      { q: 'What is Supabase and how does it work?', a: 'Supabase is our cloud backend that enables real-time sync, family sharing, and community features. Your data is encrypted and secure.' },
    ],
  },
  {
    category: 'Tracking', icon: 'analytics-outline', color: DS.success,
    items: [
      { q: 'What activities can I track?', a: 'Feeding, sleep, potty, growth measurements, medications, and milestones. Use the + button on any tab.' },
      { q: 'How do I start a sleep timer?', a: 'Go to Track → Sleep, tap "Start Sleep Session." We\'ll track the duration automatically.' },
      { q: 'Can I edit or delete an entry?', a: 'Yes, tap any entry in your timeline to edit or delete it.' },
      { q: 'Does tracking sync across devices?', a: 'With Supabase enabled, your tracking data syncs in real-time across all your devices and family members.' },
    ],
  },
  {
    category: 'Data & Privacy', icon: 'shield-checkmark-outline', color: DS.accent,
    items: [
      { q: 'Is my data backed up?', a: 'Data is stored locally AND synced to Supabase for cloud backup. Use Backup & Restore in Settings to create manual backups.' },
      { q: 'Can I export my data?', a: 'Yes, the backup file is standard JSON — readable by you, portable to any device.' },
      { q: 'Who can see my data?', a: 'Only people you invite to Family Dashboard. All data is encrypted in transit and at rest.' },
      { q: 'Is my data safe in the cloud?', a: 'Yes! We use Supabase with row-level security, encryption, and strict access controls.' },
    ],
  },
  {
    category: 'Account & Security', icon: 'lock-closed-outline', color: DS.warning,
    items: [
      { q: 'How do I reset my PIN?', a: 'Settings → Security → PIN Code → Change PIN. You\'ll need your current PIN.' },
      { q: 'I forgot my PIN. What now?', a: "You'll need to reinstall the app and restore from backup. We can't reset PINs for security." },
      { q: 'How do I delete my account?', a: 'Settings → Support → Contact Us and request deletion. All data will be permanently removed.' },
      { q: 'What is biometric authentication?', a: 'Biometric auth uses Face ID (iOS) or Fingerprint (Android) to unlock the app securely and quickly.' },
    ],
  },
  {
    category: 'Community & Social', icon: 'people-outline', color: DS.secondary,
    items: [
      { q: 'What is the Community feature?', a: 'Connect with other parents, share experiences, and get support in our parenting community.' },
      { q: 'Is my community profile public?', a: 'You control your privacy settings. Choose between public, family-only, or private profiles.' },
      { q: 'How do I find other parents?', a: 'Use the search feature in Community to find parents with similar interests or in your area.' },
    ],
  },
];

interface TipItem { icon: string; title: string; desc: string; route?: keyof RootStackParamList; params?: any }

const TIPS: TipItem[] = [
  { icon: 'moon', title: 'Night Mode', desc: 'Enable dark mode in your device settings — we follow automatically.', route: 'Customize' },
  { icon: 'notifications', title: 'Smart Reminders', desc: 'Set feeding, sleep, and medication reminders.', route: 'TrackerReminders' },
  { icon: 'trophy', title: 'Achievements', desc: 'Track milestones to unlock parenting achievements.', route: 'Achievements' },
  { icon: 'people', title: 'Family Chat', desc: 'Coordinate with co-parents using family chat.', route: 'FamilyChatList' },
  { icon: 'images', title: 'Gallery', desc: 'Save and organize precious photos.', route: 'Gallery' },
  { icon: 'color-wand', title: 'Customize', desc: 'Personalize themes, colors, and app look.', route: 'Customize' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   AURA SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
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
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
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

/* ─── Help Capsule (replaces header) ─── */
const HelpCapsule = React.memo<any>(({ isDark, isConnected, user }) => {
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
              <Ionicons name="help-buoy" size={30} color={DS.primary} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              Help Center
            </Text>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              Find answers & learn LittleLoom
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15`, marginTop: 6 }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {isConnected ? 'Cloud connected' : 'Offline mode'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Insight Ribbon ─── */
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

export default function HelpCenterScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const { sweetAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);

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

  const isDark = darkMode;
  const primary = themeColors?.primary || DS.primary;

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const handleHaptic = (style: 'light' | 'medium' = 'light') => {
    if (!reduceMotion) {
      Haptics.impactAsync(style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleTipPress = (tip: TipItem) => {
    handleHaptic('light');
    if (tip.route) navigation.navigate(tip.route as any, tip.params);
  };

  const handleCategoryPress = (category: string) => {
    handleHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleFaqPress = (key: string) => {
    handleHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    return FAQS.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter(cat => cat.items.length > 0);
  }, [searchQuery]);

  const totalResults = useMemo(() => filteredFaqs.reduce((acc, cat) => acc + cat.items.length, 0), [filteredFaqs]);

  const topRibbon = searchQuery
    ? { icon: 'search-outline' as const, color: primary, label: 'Search', text: `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${searchQuery}"` }
    : { icon: 'sparkles-outline' as const, color: DS.success, label: 'Welcome', text: 'Browse FAQs, quick tips, or message our team' };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Help Center</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>FAQs, tips & support</Text>
      </Animated.View>

      {/* Back button */}
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
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
      >
        {/* Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          <HelpCapsule isDark={isDark} isConnected={isConnected} user={user} />
        </View>

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <View style={[styles.searchWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name="search" size={18} color={isDark ? DS.gray500 : DS.gray400} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
              placeholder="Search help articles…"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              selectionColor={primary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={isDark ? DS.gray500 : DS.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Tips */}
        {!searchQuery && (
          <View style={{ marginTop: DS.space.lg }}>
            <View style={{ paddingHorizontal: DS.space.lg }}>
              <SectionHeader title="Quick Tips" subtitle="Shortcuts & tricks" icon="bulb-outline" color={DS.warning} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
              {TIPS.map((tip, i) => (
                <PressableScale key={i} onPress={() => handleTipPress(tip)} activeScale={0.94}>
                  <View style={[styles.tipCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.tipIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name={tip.icon as any} size={20} color={DS.primary} />
                    </View>
                    <Text style={[styles.tipTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{tip.title}</Text>
                    <Text style={[styles.tipDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{tip.desc}</Text>
                    <View style={[styles.tipArrow, { backgroundColor: `${DS.primary}12` }]}>
                      <Ionicons name="arrow-forward" size={11} color={DS.primary} />
                    </View>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}

        {/* FAQ Categories */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg, gap: 8 }}>
          <SectionHeader
            title="Frequently Asked"
            subtitle={searchQuery ? `${totalResults} result${totalResults !== 1 ? 's' : ''}` : `${FAQS.length} categories`}
            icon="help-circle-outline"
            color={DS.primary}
          />
          {filteredFaqs.map((category, catIndex) => {
            const isCategoryExpanded = expandedCategory === category.category || !!searchQuery;
            return (
              <GlassCard key={catIndex} isDark={isDark} delay={catIndex * 40}>
                <TouchableOpacity style={styles.categoryHeader} onPress={() => handleCategoryPress(category.category)} activeOpacity={0.7}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${category.color}18` }]}>
                    <Ionicons name={category.icon as any} size={18} color={category.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.categoryTitle, { color: isDark ? DS.white : DS.gray900 }]}>{category.category}</Text>
                    <Text style={[styles.categoryCount, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                      {category.items.length} question{category.items.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name={isCategoryExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>

                {isCategoryExpanded && category.items.map((item, itemIndex) => {
                  const key = `${catIndex}-${itemIndex}`;
                  const isExpanded = expandedFaq === key;
                  return (
                    <View key={key} style={[styles.faqItem, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <TouchableOpacity style={styles.faqQuestion} onPress={() => handleFaqPress(key)} activeOpacity={0.7}>
                        <Text style={[styles.faqQText, { color: isDark ? DS.white : DS.gray900 }]}>{item.q}</Text>
                        <Ionicons name={isExpanded ? 'remove' : 'add'} size={18} color={DS.primary} />
                      </TouchableOpacity>
                      {isExpanded && (
                        <Animated.View entering={FadeInUp.delay(30).springify()} style={styles.faqAnswer}>
                          <Text style={[styles.faqAText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{item.a}</Text>
                        </Animated.View>
                      )}
                    </View>
                  );
                })}
              </GlassCard>
            );
          })}
        </View>

        {/* Support CTA */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <LinearGradient
              colors={[`${primary}20`, `${DS.accent}10`, 'rgba(139,92,246,0.04)']}
              style={[styles.supportCard, { borderColor: `${primary}30` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={[styles.supportIcon, { backgroundColor: `${primary}18` }]}>
                <Ionicons name="chatbubble-ellipses" size={26} color={primary} />
              </View>
              <Text style={[styles.supportTitle, { color: isDark ? DS.white : DS.gray900 }]}>Still need help?</Text>
              <Text style={[styles.supportDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Our team responds within 24 hours. Send us a message and we'll help you out.
              </Text>
              <PressableScale
                onPress={() => { handleHaptic('medium'); navigation.navigate('ContactSupport'); }}
                activeScale={0.97}
                style={{ width: '100%' }}
              >
                <LinearGradient colors={[primary, DS.accent]} style={styles.supportBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="mail-outline" size={16} color={DS.white} />
                  <Text style={styles.supportBtnText}>Contact Support</Text>
                </LinearGradient>
              </PressableScale>
            </LinearGradient>
          </Animated.View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  /* Capsule */
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

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Search */
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: DS.radius.full, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  /* Glass card */
  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },

  /* Tip card */
  tipCard: { width: 150, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  tipIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.sm },
  tipTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  tipDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  tipArrow: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: DS.space.sm, alignSelf: 'flex-start' },

  /* Category */
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  categoryIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  categoryTitle: { fontSize: 13, fontWeight: '700' },
  categoryCount: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* FAQ */
  faqItem: { borderTopWidth: StyleSheet.hairlineWidth },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, paddingLeft: DS.space.md + 46 },
  faqQText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  faqAnswer: { paddingHorizontal: DS.space.md, paddingBottom: DS.space.md, paddingLeft: DS.space.md + 46 },
  faqAText: { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  /* Support */
  supportCard: { padding: DS.space.lg, borderRadius: DS.radius.xl, borderWidth: 1, alignItems: 'center', gap: DS.space.sm, ...DS.shadow.md },
  supportIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  supportTitle: { fontSize: 16, fontWeight: '800', marginTop: DS.space.sm },
  supportDesc: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17, marginBottom: DS.space.sm },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, ...DS.shadow.sm },
  supportBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },
});