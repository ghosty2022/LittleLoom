import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { supabase } from '../../services/supabaseClient';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityVerification'>;

/* ── The Loom palette ─────────────────────────────────────── */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  purple: '#8b5cf6',
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
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 },
};

interface SecurityRequirement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  check: (cu: any, profile: any) => boolean;
  securityLevel: 'low' | 'medium' | 'high';
  route?: keyof CommunityStackParamList;
}

const REQUIREMENTS: SecurityRequirement[] = [
  {
    id: 'profile',
    icon: 'person',
    label: 'Complete Profile',
    desc: 'Name, bio, and avatar',
    check: (cu) =>
      !!(
        cu?.displayName &&
        cu.displayName.length > 2 &&
        cu?.bio &&
        cu.bio.length > 10 &&
        cu?.avatar &&
        cu.avatar.length > 0
      ),
    securityLevel: 'low',
    route: 'CommunityProfile' as any,
  },
  {
    id: 'email',
    icon: 'mail',
    label: 'Email Confirmed',
    desc: 'Valid verified email on file',
    check: (_cu, p) => !!(p?.email && p.email.includes('@') && p?.emailVerified),
    securityLevel: 'high',
    route: 'CommunityProfile' as any,
  },
  {
    id: 'phone',
    icon: 'call',
    label: 'Phone Verified',
    desc: 'Phone number verified via SMS',
    check: (_cu, p) => !!(p?.phoneNumber && p?.phoneVerified),
    securityLevel: 'high',
    route: 'CommunityProfile' as any,
  },
  {
    id: 'active',
    icon: 'flame',
    label: 'Active Member',
    desc: 'At least 7 days of activity',
    check: (cu) => (cu?.stats?.streakDays || 0) >= 7 || (cu?.stats?.posts || 0) >= 5,
    securityLevel: 'medium',
  },
  {
    id: 'topics',
    icon: 'pricetags',
    label: 'Topics Selected',
    desc: 'Follow 3+ community topics',
    check: (cu) => (cu?.selectedTopics?.length || 0) >= 3,
    securityLevel: 'low',
    route: 'CommunityOnboarding' as any,
  },
];

const BENEFITS = [
  { icon: 'checkmark-circle', color: DS.success, text: 'Verified badge on your profile' },
  { icon: 'shield-checkmark', color: DS.primary, text: 'Enhanced trust with other parents' },
  { icon: 'star', color: DS.warning, text: 'Access to exclusive community features' },
  { icon: 'trending-up', color: DS.accent, text: 'Higher visibility in discussions' },
  { icon: 'lock-closed', color: DS.purple, text: 'Advanced security & anti-spam protection' },
  { icon: 'people', color: DS.info, text: 'Priority support from the community team' },
];

const SecurityBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
  const colors = {
    low: { bg: `${DS.warning}15`, text: DS.warning, label: 'Basic' },
    medium: { bg: `${DS.info}15`, text: DS.info, label: 'Good' },
    high: { bg: `${DS.success}15`, text: DS.success, label: 'Strong' },
  };
  const c = colors[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
};

export default function CommunityVerificationScreen({ navigation }: Props) {
  const { currentUser, updateCommunityProfile, syncUserProfileAcrossPosts } = useCommunity();
  const { profile } = useUser();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [securityScore, setSecurityScore] = useState(0);

  /* ── Device fingerprint ─────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      try {
        const info = [
          Device.deviceName || '',
          Device.modelName || '',
          Device.osName || '',
          Device.osVersion || '',
          Device.deviceYearClass || '',
        ].join('|');
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, info);
        if (cancelled) return;
        setDeviceFingerprint(hash);

        await supabase.from('user_devices').upsert(
          {
            user_id: currentUser?.id,
            device_id: hash,
            device_name: Device.deviceName || 'Unknown Device',
            device_model: Device.modelName || 'Unknown Model',
            os_name: Device.osName || 'Unknown OS',
            last_active: new Date().toISOString(),
            is_trusted: false,
          },
          { onConflict: 'device_id' },
        );
      } catch (err) {
        if (__DEV__) console.warn('[Verification] fingerprint failed:', err);
      }
    };
    if (currentUser?.id) generate();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  /* ── Compute checks (memo) ──────────────────────────── */
  const securityChecks = useMemo(() => {
    const result: Record<string, boolean> = {};
    REQUIREMENTS.forEach((r) => {
      try {
        result[r.id] = r.check(currentUser, profile);
      } catch {
        result[r.id] = false;
      }
    });
    return result;
  }, [currentUser, profile]);

  /* ── Compute score (effect, never during render) ────── */
  useEffect(() => {
    let score = 0;
    let maxScore = 0;
    const weights = { low: 1, medium: 2, high: 3 } as const;
    REQUIREMENTS.forEach((r) => {
      maxScore += weights[r.securityLevel];
      if (securityChecks[r.id]) score += weights[r.securityLevel];
    });
    maxScore += 2; // device trust
    if (deviceFingerprint) score += 2;
    const pct = Math.min(100, Math.round((score / Math.max(1, maxScore)) * 100));
    setSecurityScore(pct);
  }, [securityChecks, deviceFingerprint]);

  const allMet = useMemo(() => Object.values(securityChecks).every(Boolean), [securityChecks]);
  const metCount = useMemo(() => Object.values(securityChecks).filter(Boolean).length, [securityChecks]);

  /* ── Request verification ───────────────────────────── */
  const handleRequest = useCallback(async () => {
    if (!currentUser) return;
    if (!allMet) {
      triggerHaptic?.('error');
      sweetAlert.alert(
        'Requirements Not Met',
        `Please complete all security requirements before requesting verification. Security score: ${securityScore}%.`,
        'warning',
      );
      return;
    }

    // Rate limit (60s)
    const key = `verification_request_${currentUser.id}`;
    try {
      const last = await AsyncStorage.getItem(key);
      if (last) {
        const ts = new Date(JSON.parse(last)).getTime();
        if (Date.now() - ts < 60_000) {
          sweetAlert.alert('Too Many Requests', 'Please wait a moment before requesting again.', 'warning');
          return;
        }
      }
    } catch {}

    setIsSubmitting(true);
    triggerHaptic?.('medium');

    try {
      // Require trusted device
      if (deviceFingerprint) {
        const { data: deviceRow } = await supabase
          .from('user_devices')
          .select('is_trusted')
          .eq('device_id', deviceFingerprint)
          .maybeSingle();

        if (!deviceRow?.is_trusted) {
          // Trust the device now that verification is completing.
          await supabase
            .from('user_devices')
            .update({ is_trusted: true, last_active: new Date().toISOString() })
            .eq('device_id', deviceFingerprint);
        }
      }

      await updateCommunityProfile({
        isVerified: true,
        verificationDate: new Date().toISOString(),
        verificationMethod: 'security_bundle',
        securityScore,
      } as any);

      await syncUserProfileAcrossPosts(currentUser.id, {
        isVerified: true,
      } as any);

      try {
        await supabase.from('verification_events').insert({
          user_id: currentUser.id,
          event_type: 'verification_granted',
          security_score: securityScore,
          device_id: deviceFingerprint,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        if (__DEV__) console.warn('[Verification] event log failed:', err);
      }

      try {
        await AsyncStorage.setItem(key, JSON.stringify(new Date().toISOString()));
      } catch {}

      triggerHaptic?.('success');
      sweetAlert.success(
        'Verified! 🎉',
        `Your profile is now verified with a security score of ${securityScore}%.`,
      );
      navigation.goBack();
    } catch (err) {
      console.error('[Verification] request failed:', err);
      triggerHaptic?.('error');
      sweetAlert.error('Error', 'Could not complete verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [allMet, currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, navigation, sweetAlert, triggerHaptic, deviceFingerprint, securityScore]);

  const handleGoBack = useCallback(() => {
    if (!isSubmitting && navigation.canGoBack()) navigation.goBack();
  }, [isSubmitting, navigation]);

  /* ── Status config ─────────────────────────────────── */
  const status = useMemo(() => {
    if (currentUser?.isVerified) return 'verified' as const;
    if (allMet) return 'ready' as const;
    if (securityScore > 50) return 'partial' as const;
    return 'incomplete' as const;
  }, [currentUser?.isVerified, allMet, securityScore]);

  const statusConfig = {
    verified: {
      icon: 'shield-checkmark',
      color: DS.success,
      title: 'Verified Parent',
      desc: 'Your identity is fully verified. You have full access to all community features.',
    },
    ready: {
      icon: 'shield-checkmark',
      color: DS.primary,
      title: 'Ready to Verify',
      desc: 'You meet all requirements. Tap below to get verified instantly.',
    },
    partial: {
      icon: 'shield-half',
      color: DS.warning,
      title: 'Almost There',
      desc: `Security score: ${securityScore}%. Complete remaining requirements to get verified.`,
    },
    incomplete: {
      icon: 'shield-outline',
      color: DS.gray400,
      title: 'Get Verified',
      desc: `Security score: ${securityScore}%. Complete the requirements below to unlock verification.`,
    },
  };
  const cs = statusConfig[status];

  /* ── Theme constants ──────────────────────────────── */
  const cardBg = isDark ? DS.darkCard : DS.white;
  const cardBorder = isDark ? DS.darkBorder : DS.lightBorder;
  const textPrimary = isDark ? DS.white : DS.gray900;
  const textSecondary = isDark ? DS.gray400 : DS.gray500;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Aura bg */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.14)', 'rgba(236,72,153,0.06)', 'transparent']
            : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity
          onPress={handleGoBack}
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white }]}
        >
          <Ionicons name="arrow-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Verification</Text>
        <View style={styles.headerBtn} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score card */}
        <Animated.View entering={FadeInUp.delay(50).springify()}>
          <View style={[styles.scoreCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <LinearGradient
              colors={
                isDark
                  ? [`${DS.primary}22`, `${DS.accent}10`]
                  : [`${DS.primary}14`, `${DS.accent}06`]
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />
            <View style={styles.scoreRow}>
              <View>
                <Text style={[styles.scoreLabel, { color: textSecondary }]}>Security Score</Text>
                <Text
                  style={[
                    styles.scoreValue,
                    {
                      color:
                        securityScore >= 70
                          ? DS.success
                          : securityScore >= 40
                          ? DS.warning
                          : DS.gray400,
                    },
                  ]}
                >
                  {securityScore}%
                </Text>
              </View>
              <View
                style={[
                  styles.scoreRing,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray200 },
                ]}
              >
                <LinearGradient
                  colors={
                    securityScore >= 70
                      ? [DS.success, '#34d399']
                      : securityScore >= 40
                      ? [DS.warning, DS.accent]
                      : [DS.gray400, DS.gray500]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.scoreRingFill, { width: `${securityScore}%` }]}
                />
              </View>
            </View>
            <View style={styles.scoreBadges}>
              <View style={[styles.scoreBadge, { backgroundColor: `${DS.success}18` }]}>
                <Ionicons name="shield-checkmark" size={11} color={DS.success} />
                <Text style={[styles.scoreBadgeText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                  {metCount}/{REQUIREMENTS.length} requirements
                </Text>
              </View>
              {deviceFingerprint ? (
                <View style={[styles.scoreBadge, { backgroundColor: `${DS.primary}18` }]}>
                  <Ionicons name="phone-portrait" size={11} color={DS.primary} />
                  <Text style={[styles.scoreBadgeText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                    Device recognized
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* Status card */}
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <View style={[styles.statusCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <LinearGradient
              colors={[`${cs.color}20`, `${cs.color}06`]}
              style={styles.statusIconBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={cs.icon as any} size={36} color={cs.color} />
            </LinearGradient>
            <Text style={[styles.statusTitle, { color: cs.color }]}>{cs.title}</Text>
            <Text style={[styles.statusDesc, { color: textSecondary }]}>{cs.desc}</Text>
          </View>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeInUp.delay(150).springify()}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>✨ Benefits</Text>
          <View style={[styles.benefitsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {BENEFITS.map((b, i) => (
              <View
                key={i}
                style={[
                  styles.benefitRow,
                  i < BENEFITS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
                  },
                ]}
              >
                <View style={[styles.benefitIconBg, { backgroundColor: `${b.color}15` }]}>
                  <Ionicons name={b.icon as any} size={16} color={b.color} />
                </View>
                <Text style={[styles.benefitText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                  {b.text}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Requirements */}
        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>🔒 Requirements</Text>
            <View style={[styles.reqCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {REQUIREMENTS.map((req, idx) => {
                const met = securityChecks[req.id] || false;
                return (
                  <TouchableOpacity
                    key={req.id}
                    activeOpacity={req.route && !met ? 0.75 : 1}
                    onPress={() => {
                      if (met || !req.route) return;
                      triggerHaptic?.('light');
                      try {
                        navigation.navigate(req.route as any);
                      } catch {}
                    }}
                    style={[
                      styles.reqRow,
                      idx < REQUIREMENTS.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
                      },
                      !met && { opacity: 0.92 },
                    ]}
                  >
                    <View
                      style={[
                        styles.reqIconBg,
                        { backgroundColor: met ? `${DS.success}18` : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
                      ]}
                    >
                      <Ionicons
                        name={met ? 'checkmark' : (req.icon as any)}
                        size={16}
                        color={met ? DS.success : isDark ? DS.gray500 : DS.gray400}
                      />
                    </View>
                    <View style={styles.reqContent}>
                      <View style={styles.reqLabelRow}>
                        <Text style={[styles.reqLabel, { color: met ? textPrimary : textSecondary }]}>
                          {req.label}
                        </Text>
                        <SecurityBadge level={req.securityLevel} />
                      </View>
                      <Text style={[styles.reqDesc, { color: textSecondary }]}>{req.desc}</Text>
                    </View>
                    {met ? (
                      <Ionicons name="checkmark-circle" size={20} color={DS.success} />
                    ) : req.route ? (
                      <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Action button */}
        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(280).springify()} style={{ marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleRequest}
              disabled={isSubmitting}
              activeOpacity={0.88}
              style={[styles.actionBtn, !allMet && { opacity: 0.85 }]}
            >
              {allMet ? (
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <LinearGradient
                  colors={
                    isDark ? ['rgba(51,65,85,1)', 'rgba(71,85,105,1)'] : [DS.gray300, DS.gray400]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {isSubmitting ? (
                <ActivityIndicator size="small" color={DS.white} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color={DS.white} />
                  <Text style={styles.actionBtnText}>
                    {allMet ? 'Request Verification' : `${securityScore}% · ${REQUIREMENTS.length - metCount} left`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.actionHint, { color: textSecondary }]}>
              {allMet
                ? 'You meet all requirements. Tap above to verify instantly.'
                : `Complete ${REQUIREMENTS.length - metCount} more requirement${
                    REQUIREMENTS.length - metCount === 1 ? '' : 's'
                  } to unlock verification.`}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  scrollContent: { paddingHorizontal: DS.space.lg, paddingTop: 8 },

  scoreCard: {
    borderRadius: DS.radius.xl,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  scoreValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  scoreRing: { width: 84, height: 8, borderRadius: 4, overflow: 'hidden' },
  scoreRingFill: { height: '100%', borderRadius: 4 },
  scoreBadges: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreBadgeText: { fontSize: 10.5, fontWeight: '700' },

  statusCard: {
    borderRadius: DS.radius.xl,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  statusIconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 8 },
  statusDesc: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
    marginTop: 4,
  },

  benefitsCard: { borderRadius: DS.radius.xl, padding: 6, borderWidth: 1, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  benefitIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { fontSize: 13, fontWeight: '600', flex: 1 },

  reqCard: { borderRadius: DS.radius.xl, padding: 6, borderWidth: 1, marginBottom: 20 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  reqIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqContent: { flex: 1, gap: 3 },
  reqLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reqLabel: { fontSize: 14, fontWeight: '700' },
  reqDesc: { fontSize: 11.5, fontWeight: '500' },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  actionBtn: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: DS.white, letterSpacing: 0.2 },
  actionHint: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 16,
    lineHeight: 17,
  },
});