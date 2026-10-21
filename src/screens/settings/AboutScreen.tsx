import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
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
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import packageJson from '../../../package.json';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

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
const CARD_GAP = 10;
const HORIZONTAL_PADDING = 40;
const CARD_WIDTH = (SCREEN_W - HORIZONTAL_PADDING - CARD_GAP) / 2;

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES + DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface ServiceLink {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  url?: string;
  route?: keyof RootStackParamList;
  color: string;
  isExternal: boolean;
}

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  route?: keyof RootStackParamList;
  params?: any;
  color: string;
}

interface SocialLink {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
  color: string;
}

const FEATURES: FeatureItem[] = [
  { icon: 'shield-checkmark', title: 'Privacy First', desc: 'Your data stays on your device or encrypted in the cloud', route: 'PrivacyPolicy', color: DS.success },
  { icon: 'people', title: 'Family Dashboard', desc: 'Invite co-parents and guardians', route: 'FamilySharing', color: DS.primary },
  { icon: 'trending-up', title: 'Growth Tracking', desc: 'Monitor height, weight, milestones', route: 'GrowthDashboard', color: DS.warning },
  { icon: 'moon', title: 'Sleep Insights', desc: 'Track and understand sleep patterns', route: 'SleepTracker', color: DS.secondary },
  { icon: 'restaurant', title: 'Feeding Log', desc: 'Track breast, bottle, and solids', route: 'FeedTracker', color: '#fb923c' },
  { icon: 'medical', title: 'Health Records', desc: 'Medications, allergies, and more', route: 'UniversalTrackerHub', params: { type: 'health' }, color: DS.danger },
  { icon: 'color-wand', title: 'Customize', desc: 'Themes, colors, and app look', route: 'Customize', color: DS.accent },
  { icon: 'trophy', title: 'Achievements', desc: 'Milestones and parenting wins', route: 'Achievements', color: '#eab308' },
  { icon: 'images', title: 'Gallery', desc: 'Photos and precious memories', route: 'Gallery', color: DS.info },
  { icon: 'alarm', title: 'Reminders', desc: 'Never miss an important moment', route: 'TrackerReminders', color: '#14b8a6' },
  { icon: 'shield-half', title: 'Safety Corner', desc: 'Tips and guides for baby safety', route: 'SafetyCorner', color: '#dc2626' },
  { icon: 'musical-notes', title: 'Sound Mixer', desc: 'White noise and lullabies', route: 'SoundMixer', color: DS.primary },
];

const SOCIAL_LINKS: SocialLink[] = [
  { icon: 'logo-twitter', label: 'Twitter', url: 'https://twitter.com/littleloom', color: '#1DA1F2' },
  { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/littleloom', color: '#E4405F' },
  { icon: 'logo-github', label: 'GitHub', url: 'https://github.com/littleloom', color: DS.gray900 },
  { icon: 'logo-youtube', label: 'YouTube', url: 'https://youtube.com/littleloom', color: '#FF0000' },
];

const TEAM = [
  { name: 'Refresh', role: 'By TPM Solutions', emoji: '🚀' },
  { name: 'Community', role: 'Powered by Supabase', emoji: '⚡' },
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

/* ─── Brand Capsule (replaces logo card) ─── */
const BrandCapsule = React.memo<any>(({ isDark, avatar, appVersion, isSupabaseConnected }) => {
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
              <SafeAvatar uri={avatar} fallbackEmoji="🧵" size={48} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              LittleLoom
            </Text>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              v{appVersion} · Weaving parenthood
            </Text>
            {isSupabaseConnected && (
              <View style={[styles.statusPill, { backgroundColor: `${DS.success}15`, marginTop: 6 }]}>
                <View style={[styles.statusDot, { backgroundColor: DS.success }]} />
                <Text style={[styles.statusText, { color: DS.success }]}>Cloud connected</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Insight Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} disabled={!onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── Feature Tile ─── */
const FeatureTile = React.memo<any>(({ feature, index, isDark, onPress }) => (
  <Animated.View entering={FadeInUp.delay(150 + index * 40).springify()} style={{ width: CARD_WIDTH }}>
    <PressableScale onPress={onPress} activeScale={0.94}>
      <View style={[styles.featureTile, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
          <Ionicons name={feature.icon} size={20} color={feature.color} />
        </View>
        <Text style={[styles.featureTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{feature.title}</Text>
        <Text style={[styles.featureDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{feature.desc}</Text>
        {feature.route && (
          <View style={[styles.featureArrow, { backgroundColor: `${feature.color}12` }]}>
            <Ionicons name="arrow-forward" size={11} color={feature.color} />
          </View>
        )}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── Service Link Row ─── */
const ServiceLinkRow = React.memo<any>(({ item, isDark, onPress, isLast }) => (
  <>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.linkRow, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
        <View style={[styles.linkIcon, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon} size={18} color={item.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, { color: isDark ? DS.white : DS.gray900 }]}>{item.title}</Text>
          <Text style={[styles.linkSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{item.subtitle}</Text>
        </View>
        <Ionicons name={item.isExternal ? 'open-outline' : 'chevron-forward'} size={16} color={isDark ? DS.gray500 : DS.gray400} />
      </View>
    </PressableScale>
    {!isLast && <View style={[styles.linkDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
  </>
));

/* ─── Social Chip ─── */
const SocialChip = React.memo<any>(({ social, isDark, onPress }) => (
  <PressableScale onPress={onPress} activeScale={0.94} style={{ flex: 1 }}>
    <View style={[styles.socialChip, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <View style={[styles.socialIcon, { backgroundColor: `${social.color}15` }]}>
        <Ionicons name={social.icon} size={18} color={social.color} />
      </View>
      <Text style={[styles.socialLabel, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{social.label}</Text>
    </View>
  </PressableScale>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AboutScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion, avatar } = useCustomization();
  const { colors, isDark: appIsDark } = useApp();
  const { user } = useAuth();
  const { sweetAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const isDark = darkMode ?? appIsDark;
  const primary = themeColors?.primary || colors.primary || DS.primary;

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('tracker_entries').select('id').limit(1);
        setIsSupabaseConnected(!error);
      } catch { setIsSupabaseConnected(false); }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    try { setAppVersion(packageJson.version || '1.0.0'); } catch {}
  }, []);

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else sweetAlert({ title: 'Cannot Open Link', message: `Unable to open ${url}`, type: 'warning', confirmText: 'OK' });
    } catch (error) { console.warn('Failed to open link:', error); }
  };

  const handleHaptic = (style: 'light' | 'medium' | 'success' = 'light') => {
    if (!reduceMotion) {
      Haptics.impactAsync(style === 'success' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleFeaturePress = (feature: FeatureItem) => {
    handleHaptic('light');
    if (feature.route) navigation.navigate(feature.route as any, feature.params);
  };

  const handleShareApp = async () => {
    handleHaptic('medium');
    try {
      await Share.share({
        message: `Check out LittleLoom - the best baby tracking app! 🍼\n\nVersion ${appVersion}\nDownload now: https://littleloom.app/download`,
        title: 'LittleLoom Baby Tracker',
      });
    } catch (error) { console.error('Share error:', error); }
  };

  const serviceLinks: ServiceLink[] = [
    { icon: 'document-text-outline', title: 'Privacy Policy', subtitle: 'How we protect your data', route: 'PrivacyPolicy', color: primary, isExternal: false },
    { icon: 'reader-outline', title: 'Terms of Service', subtitle: 'Legal terms and conditions', url: 'https://littleloom.app/terms', color: DS.secondary, isExternal: true },
    { icon: 'cloud-outline', title: 'Cloud Status', subtitle: isSupabaseConnected ? 'Connected to Supabase' : 'Offline mode', url: 'https://status.littleloom.app', color: isSupabaseConnected ? DS.success : DS.warning, isExternal: true },
    { icon: 'globe-outline', title: 'Website', subtitle: 'Visit our official website', url: 'https://littleloom.app', color: DS.info, isExternal: true },
    { icon: 'mail-outline', title: 'Contact Support', subtitle: 'Get help from our team', route: 'ContactSupport', color: DS.success, isExternal: false },
    { icon: 'star-outline', title: 'Rate the App', subtitle: 'Share your feedback', url: 'https://littleloom.app/review', color: DS.warning, isExternal: true },
  ];

  const handleLinkPress = (item: ServiceLink) => {
    handleHaptic('light');
    if (item.route) navigation.navigate(item.route as any);
    else if (item.url) openLink(item.url);
  };

  const topRibbon = {
    icon: 'sparkles-outline' as const,
    color: DS.primary,
    label: 'Made with love',
    text: `v${appVersion} · ${isSupabaseConnected ? 'Cloud synced' : 'Offline ready'}`,
    onPress: undefined,
  };

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
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>About</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>LittleLoom v{appVersion}</Text>
      </Animated.View>

      {/* Header row */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
        <View style={{ flex: 1 }} />
        <PressableScale onPress={handleShareApp} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="share-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        bounces={true}
      >
        {/* Brand Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          <BrandCapsule isDark={isDark} avatar={avatar} appVersion={appVersion} isSupabaseConnected={isSupabaseConnected} />
        </View>

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Features grid */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
          <SectionHeader title="Features" subtitle="Everything you can do" icon="grid-outline" color={DS.primary} />
          <View style={styles.featuresGrid}>
            {FEATURES.map((feature, i) => (
              <FeatureTile key={feature.title} feature={feature} index={i} isDark={isDark} onPress={() => handleFeaturePress(feature)} />
            ))}
          </View>
        </View>

        {/* Social */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
          <SectionHeader title="Connect With Us" subtitle="Follow the journey" icon="share-social-outline" color={DS.info} />
          <View style={styles.socialGrid}>
            {SOCIAL_LINKS.map(social => (
              <SocialChip key={social.label} social={social} isDark={isDark} onPress={() => { handleHaptic('light'); openLink(social.url); }} />
            ))}
          </View>
        </View>

        {/* Team */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
          <SectionHeader title="Team" subtitle="Who builds LittleLoom" icon="people-outline" color={DS.secondary} />
          <View style={{ gap: 8 }}>
            {TEAM.map((member, i) => (
              <View key={i} style={[styles.teamRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.teamAvatar, { backgroundColor: `${DS.primary}15` }]}>
                  <Text style={{ fontSize: 20 }}>{member.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teamName, { color: isDark ? DS.white : DS.gray900 }]}>{member.name}</Text>
                  <Text style={[styles.teamRole, { color: isDark ? DS.gray400 : DS.gray500 }]}>{member.role}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Links */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
          <SectionHeader title="Links & Services" subtitle="Legal, status & more" icon="link-outline" color={DS.info} />
          <View style={[styles.linkList, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            {serviceLinks.map((item, i) => (
              <ServiceLinkRow
                key={item.title}
                item={item}
                isDark={isDark}
                onPress={() => handleLinkPress(item)}
                isLast={i === serviceLinks.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Copyright */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.copyright}>
          <View style={[styles.appIconContainer, { backgroundColor: `${DS.primary}10`, borderColor: `${DS.primary}20` }]}>
            <SafeAvatar uri={avatar} fallbackEmoji="🧵" size={28} />
          </View>
          <Text style={[styles.copyrightText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            © 2026 LittleLoom. All rights reserved.
          </Text>
          <View style={styles.madeWithLove}>
            <Ionicons name="heart" size={11} color={DS.accent} />
            <Text style={[styles.madeWithText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
              Made with love for parents everywhere
            </Text>
          </View>
          {user && (
            <Text style={[styles.userInfo, { color: isDark ? DS.gray600 : DS.gray400 }]}>
              Signed in as {user.email}
            </Text>
          )}
        </Animated.View>
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
  capsuleName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, maxWidth: '80%' },
  capsuleSub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  /* Features grid */
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  featureTile: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  featureIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.sm },
  featureTitle: { fontSize: 12, fontWeight: '800', marginBottom: 3 },
  featureDesc: { fontSize: 10, fontWeight: '500', lineHeight: 14 },
  featureArrow: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: DS.space.sm, alignSelf: 'flex-start' },

  /* Social */
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DS.space.sm + 2, paddingVertical: DS.space.sm, borderRadius: DS.radius.md, borderWidth: 1, minWidth: '47%' },
  socialIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { fontSize: 12, fontWeight: '700', flex: 1 },

  /* Team */
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1 },
  teamAvatar: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 13, fontWeight: '800' },
  teamRole: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Links list */
  linkList: { borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  linkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 13, fontWeight: '700' },
  linkSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  linkDivider: { height: StyleSheet.hairlineWidth, marginLeft: DS.space.md + 36 + DS.space.md },

  /* Copyright */
  copyright: { alignItems: 'center', marginTop: DS.space['2xl'], gap: 8, paddingHorizontal: DS.space.lg },
  appIconContainer: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: DS.space.sm },
  copyrightText: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  madeWithLove: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  madeWithText: { fontSize: 11, fontWeight: '600' },
  userInfo: { fontSize: 10, fontWeight: '500', marginTop: 4 },
});