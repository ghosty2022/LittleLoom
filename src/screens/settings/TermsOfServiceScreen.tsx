import React from 'react';
import { Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5',
  accent: '#ec4899', accentLight: '#f472b6', secondary: '#8b5cf6',
  success: '#10b981', warning: '#f59e0b', info: '#0ea5e9', danger: '#ef4444',
  white: '#ffffff', gray50: '#fafaf9', gray100: '#f5f5f4', gray200: '#e7e5e4',
  gray300: '#d6d3d1', gray400: '#a8a29e', gray500: '#78716c',
  gray600: '#57534e', gray700: '#44403c', gray800: '#292524', gray900: '#1c1917',
  darkBg: '#0c0a09', darkSurface: '#1c1917', darkCard: '#292524', darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const SECTIONS = [
  { title: '1. Acceptance of Terms', content: `By downloading, installing, or using LittleLoom ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.\n\nThese terms apply to all users, including parents, guardians, and any family members invited through Family Dashboard features.` },
  { title: '2. Description of Service', content: `LittleLoom is a baby tracking and family coordination application designed to help parents and caregivers:\n\n• Track feeding, sleep, potty, and growth milestones\n• Manage baby profiles and health records\n• Coordinate care schedules with family members\n• Share updates through secure family chat\n• Store memories and photos in a private gallery\n\nThe App is intended for personal, non-commercial use.` },
  { title: '3. User Accounts & Eligibility', content: `To use LittleLoom, you must:\n\n• Be at least 18 years old or legal age of majority\n• Be a parent, legal guardian, or authorized caregiver\n• Provide accurate information during registration\n• Maintain the security of your credentials\n\nYou are responsible for all activity under your account.` },
  { title: '4. Family Dashboard & Permissions', content: `When you invite family members or guardians:\n\n• You control what data each person can view and edit\n• You can revoke access at any time\n• Invited members must accept the invitation\n• You are responsible for who you invite\n\nLittleLoom is not responsible for disputes between family members.` },
  { title: '5. Data Ownership & Privacy', content: `You retain ownership of all data you enter. We respect your privacy:\n\n• All baby tracking data is stored locally by default\n• We do not sell, rent, or share your data\n• We do not use your data for advertising\n• Cloud features use encrypted transmission\n\nFor details, see our Privacy Policy.` },
  { title: '6. Acceptable Use', content: `You agree not to use LittleLoom to:\n\n• Harass, abuse, or harm other users\n• Share illegal or inappropriate content\n• Access accounts without authorization\n• Reverse engineer the App\n• Use the App commercially without consent\n• Upload viruses or malware\n\nViolations may result in account termination.` },
  { title: '7. Intellectual Property', content: `LittleLoom and all associated content are owned by LittleLoom Inc. and protected by copyright, trademark, and IP laws.\n\nYou may not copy, modify, create derivative works, remove notices, use trademarks without permission, or distribute the App without authorization.` },
  { title: '8. Disclaimer of Warranties', content: `LittleLoom is provided "as is" and "as available" without warranties of any kind.\n\nWe do not guarantee the App will be error-free, data always secure, or that medical info is accurate for your situation.\n\nAlways consult qualified healthcare professionals. LittleLoom is not a substitute for medical care.` },
  { title: '9. Limitation of Liability', content: `To the maximum extent permitted by law, LittleLoom Inc. shall not be liable for indirect, incidental, or consequential damages, including loss of data, profits, or goodwill.\n\nOur total liability shall not exceed the amount you paid for the App in the twelve months preceding the claim.` },
  { title: '10. Subscription & Payments', content: `Some features may require a subscription:\n\n• Fees are charged through your app store\n• Subscriptions auto-renew unless cancelled 24 hours prior\n• Manage subscriptions in device settings\n• Refunds follow app store policies\n• Prices subject to change with notice\n\nFree features remain available.` },
  { title: '11. Termination', content: `You may terminate your account at any time by deleting the App, using in-app settings, or contacting support@littleloom.app.\n\nWe may suspend or terminate accounts that violate these terms. Upon termination, data is deleted per our retention policy.` },
  { title: '12. Changes to Terms', content: `We may update these Terms. We will notify you by:\n\n• Updating the "Last Updated" date\n• Displaying a notice in the App\n• Sending an email to registered users\n\nContinued use after changes constitutes acceptance.` },
  { title: '13. Governing Law', content: `These Terms are governed by the laws of the State of California, United States, without regard to conflict of law provisions.\n\nDisputes shall be resolved through binding arbitration in San Francisco, California, except for injunctive relief in court.` },
  { title: '14. Contact Information', content: `For questions about these Terms:\n\nEmail: legal@littleloom.app\nSupport: support@littleloom.app\nWebsite: www.littleloom.app\n\nWe aim to respond within 48 business hours.` },
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

const TermsCapsule = React.memo<any>(({ isDark, lastUpdated }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  React.useEffect(() => {
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
              <Ionicons name="document-text" size={30} color={DS.primary} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              Terms of Service
            </Text>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              Your agreement with LittleLoom
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${DS.primary}15`, marginTop: 6 }]}>
              <View style={[styles.statusDot, { backgroundColor: DS.primary }]} />
              <Text style={[styles.statusText, { color: DS.primary }]}>Updated {lastUpdated}</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

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

export default function TermsOfServiceScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const insets = useSafeAreaInsets();
  const isDark = darkMode;
  const primary = themeColors?.primary || DS.primary;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const handleHaptic = () => {
    if (!reduceMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const openEmail = async () => {
    try { await Linking.openURL('mailto:legal@littleloom.app'); } catch (e) { console.warn('Failed to open email:', e); }
  };

  const topRibbon = {
    icon: 'shield-checkmark-outline' as const,
    color: DS.success,
    label: 'Legal agreement',
    text: 'Read carefully before using the app',
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Terms of Service</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Updated June 7, 2026</Text>
      </Animated.View>

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
        <View style={{ paddingHorizontal: DS.space.lg }}>
          <TermsCapsule isDark={isDark} lastUpdated="June 7, 2026" />
        </View>

        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Intro note */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <View style={[styles.introCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <LinearGradient colors={[`${DS.primary}10`, `${DS.accent}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Ionicons name="information-circle" size={18} color={DS.primary} />
            <Text style={[styles.introText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
              These Terms govern your use of LittleLoom. By continuing, you accept them.
            </Text>
          </View>
        </View>

        {/* Accept CTA */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <PressableScale onPress={() => { handleHaptic(); navigation.navigate('SignUp'); }} activeScale={0.97}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="checkmark-circle" size={18} color={DS.white} />
              <Text style={styles.acceptText}>I Accept the Terms</Text>
            </LinearGradient>
          </PressableScale>
        </View>

        {/* Sections */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg, gap: 8 }}>
          {SECTIONS.map((section, i) => (
            <Animated.View key={i} entering={FadeInUp.delay(100 + i * 30).springify()}>
              <View style={[styles.sectionCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.sm }}>
                  <View style={[styles.sectionNumBadge, { backgroundColor: `${DS.primary}15` }]}>
                    <Text style={[styles.sectionNum, { color: DS.primary }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}>
                    {section.title.replace(/^\d+\.\s*/, '')}
                  </Text>
                </View>
                <Text style={[styles.sectionBody, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {section.content}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg, gap: 8 }}>
          <PressableScale onPress={() => { handleHaptic(); openEmail(); }} activeScale={0.98}>
            <View style={[styles.footerCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={[styles.footerIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="mail-outline" size={18} color={DS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.footerLabel, { color: isDark ? DS.white : DS.gray900 }]}>Legal questions?</Text>
                <Text style={[styles.footerValue, { color: DS.primary }]} numberOfLines={1}>legal@littleloom.app</Text>
              </View>
              <Ionicons name="open-outline" size={15} color={isDark ? DS.gray500 : DS.gray400} />
            </View>
          </PressableScale>

          <PressableScale onPress={() => { handleHaptic(); navigation.navigate('PrivacyPolicy'); }} activeScale={0.98}>
            <View style={[styles.footerCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={[styles.footerIcon, { backgroundColor: `${DS.success}15` }]}>
                <Ionicons name="shield-checkmark" size={18} color={DS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.footerLabel, { color: isDark ? DS.white : DS.gray900 }]}>View our</Text>
                <Text style={[styles.footerValue, { color: DS.success }]} numberOfLines={1}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />
            </View>
          </PressableScale>
        </View>
      </Animated.ScrollView>
    </View>
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
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  introCard: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.sm + 2, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1, overflow: 'hidden' },
  introText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  acceptText: { color: DS.white, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },

  sectionCard: { borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, ...DS.shadow.sm },
  sectionNumBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionNum: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  sectionBody: { fontSize: 12, fontWeight: '500', lineHeight: 18 },

  footerCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1 },
  footerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerLabel: { fontSize: 12, fontWeight: '700' },
  footerValue: { fontSize: 11, fontWeight: '600', marginTop: 1 },
});