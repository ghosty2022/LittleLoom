import React, { useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'CoParentInviteScreen'>;
const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE CARDS DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const PREVIEW_FEATURES = [
  { icon: 'sync', label: 'Real-time Sync', desc: 'Instant updates across all devices' },
  { icon: 'notifications', label: 'Smart Alerts', desc: 'Get notified for feeds, sleep & meds' },
  { icon: 'image', label: 'Photo Timeline', desc: 'Shared memories and milestones' },
  { icon: 'analytics', label: 'Growth Insights', desc: 'Track percentiles and patterns' },
];

const BENEFITS = [
  { icon: 'people', title: 'Shared Responsibility', desc: 'Both parents stay in sync on every feed, nap, and milestone.' },
  { icon: 'cloud-done', title: 'Cloud Backup', desc: 'All data is securely backed up and accessible to both parents.' },
  { icon: 'lock-closed', title: 'Privacy First', desc: 'End-to-end encryption for sensitive family data.' },
  { icon: 'time', title: 'Activity History', desc: 'Full audit log of who did what and when.' },
];

export default function CoParentInviteScreen({ navigation }: Props) {
  const { userProfile, skipSetup } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useApp();
  const { themeColors, shouldReduceMotion, triggerHaptic, avatar } = useCustomization();

  const dynamicPrimary = themeColors.primary || colors.primary;
  const dynamicSecondary = themeColors.secondary || colors.primaryLight;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  // Animated rings
  const ringProgress = useSharedValue(0);
  if (!shouldReduceMotion) {
    ringProgress.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      false
    );
  }

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringProgress.value, [0, 0.5, 1], [0.4, 0.2, 0]),
    transform: [{ scale: interpolate(ringProgress.value, [0, 1], [1, 1.6]) }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringProgress.value, [0, 0.5, 1], [0.3, 0.15, 0]),
    transform: [{ scale: interpolate(ringProgress.value, [0, 1], [1, 1.4]) }],
  }));

  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    try {
      await skipSetup('parent2');
    } catch (error) {
      console.error('Error skipping Parent2:', error);
    }
  }, [skipSetup, triggerHaptic]);

  const handleAddParent = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('Parent2Setup');
  }, [navigation, triggerHaptic]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.surface] : ['#f8faff', '#eef2ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.duration(700)}
            style={styles.hero}
          >
            <View style={styles.avatarWrapper}>
              <Animated.View style={[styles.pulseRing, ring1Style, { borderColor: dynamicPrimary }]} />
              <Animated.View style={[styles.pulseRing, ring2Style, { borderColor: dynamicSecondary }]} />
              <View style={[
                styles.iconContainer,
                isDark && { backgroundColor: 'rgba(255,255,255,0.08)' },
                { borderColor: dynamicPrimary + '40' }
              ]}>
                <SafeAvatar
                  avatar={avatar}
                  size={72}
                  fallbackIcon="people"
                  fallbackColor={dynamicPrimary}
                  fallbackBgColor={dynamicPrimary + '15'}
                  borderWidth={2}
                  borderColor={dynamicPrimary + '50'}
                  animated={!shouldReduceMotion}
                />
              </View>
              <View style={[styles.badge, { backgroundColor: dynamicPrimary }]}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>

            <Text style={[styles.title, isDark && styles.textDark]}>
              Invite Your Partner
            </Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              Share the journey of raising {userProfile?.babyName || 'your little one'} together
            </Text>
          </Animated.View>

          {/* ── Preview: What they'll see ── */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).duration(600)}
            style={styles.previewSection}
          >
            <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>
              What your co-parent gets
            </Text>
            <View style={styles.previewGrid}>
              {PREVIEW_FEATURES.map((feat, i) => (
                <Animated.View
                  key={feat.label}
                  entering={shouldReduceMotion ? undefined : FadeIn.delay(200 + i * 80)}
                  style={[styles.previewCard, isDark && styles.previewCardDark]}
                >
                  <BlurView intensity={isDark ? 20 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                  <View style={[styles.previewIconBg, { backgroundColor: dynamicPrimary + '12' }]}>
                    <Ionicons name={feat.icon as any} size={18} color={dynamicPrimary} />
                  </View>
                  <Text style={[styles.previewTitle, isDark && styles.textDark]}>{feat.label}</Text>
                  <Text style={[styles.previewDesc, isDark && { color: '#94a3b8' }]}>{feat.desc}</Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* ── Benefits ── */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(300).duration(600)}
            style={styles.benefitsSection}
          >
            <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>
              Why add a co-parent?
            </Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, i) => (
                <View key={b.title} style={[styles.benefitRow, isDark && styles.benefitRowDark]}>
                  <View style={[styles.benefitIconWrap, { backgroundColor: dynamicPrimary + '10' }]}>
                    <Ionicons name={b.icon as any} size={18} color={dynamicPrimary} />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={[styles.benefitTitle, isDark && styles.textDark]}>{b.title}</Text>
                    <Text style={[styles.benefitDesc, isDark && { color: '#94a3b8' }]}>{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Security Note ── */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeIn.delay(500)}
            style={styles.securityNote}
          >
            <Ionicons name="shield-checkmark" size={16} color={dynamicPrimary} />
            <Text style={[styles.securityText, isDark && { color: '#94a3b8' }]}>
              Invites expire in 7 days and can only be used once
            </Text>
          </Animated.View>

          {/* ── CTAs ── */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(400).duration(600)}
            style={styles.buttonsContainer}
          >
            <TouchableOpacity
              style={[styles.primaryButton, { shadowColor: dynamicPrimary }]}
              onPress={handleAddParent}
              activeOpacity={0.85}
            >
              <LinearGradient colors={dynamicGradient} style={styles.primaryGradient}>
                <Ionicons name="person-add" size={22} color="#fff" />
                <Text style={styles.primaryText}>Invite Co-Parent</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={[styles.skipText, isDark && styles.textDark]}>Skip for Now</Text>
              <Text style={[styles.skipSubtext, isDark && { color: '#64748b' }]}>
                You can always add later in Family settings
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Signed-in footer ── */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, isDark && { color: '#64748b' }]}>
              Signed in as {userProfile?.fullName}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  textDark: { color: '#fff' },

  /* Hero */
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  avatarWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(102,126,234,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.25)',
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    fontWeight: '500',
  },

  /* Sections */
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
    marginLeft: 4,
  },

  /* Preview Grid */
  previewSection: { marginBottom: 28 },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewCard: {
    width: (SCREEN_W - 58) / 2,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
    overflow: 'hidden',
  },
  previewCardDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  previewDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    lineHeight: 15,
  },

  /* Benefits */
  benefitsSection: { marginBottom: 24 },
  benefitsList: { gap: 10 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  benefitRowDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: { flex: 1 },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  benefitDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    lineHeight: 17,
  },

  /* Security */
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    opacity: 0.8,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  /* CTAs */
  buttonsContainer: { gap: 14, marginBottom: 20 },
  primaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  skipSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },

  /* Footer */
  footer: { alignItems: 'center', marginTop: 8 },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
});