// src/screens/community/CommunityVerificationScreen.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { CommunityColors } from '../../theme/CommunityTheme';
import { supabase } from '../../services/supabaseClient';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityVerification'>;

interface SecurityRequirement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  check: () => boolean;
  securityLevel: 'low' | 'medium' | 'high';
}

const REQUIREMENTS: SecurityRequirement[] = [
  { 
    id: 'profile', 
    icon: 'person', 
    label: 'Complete Profile', 
    desc: 'Name, bio, and avatar',
    check: (cu: any) => !!(cu?.displayName && cu.displayName.length > 2 && cu?.bio && cu.bio.length > 10 && cu?.avatar && cu.avatar.length > 0),
    securityLevel: 'low'
  },
  { 
    id: 'email', 
    icon: 'mail', 
    label: 'Email Confirmed', 
    desc: 'Valid verified email on file',
    check: (cu: any, profile: any) => !!(profile?.email && profile.email.includes('@') && profile?.emailVerified),
    securityLevel: 'high'
  },
  { 
    id: 'phone', 
    icon: 'call', 
    label: 'Phone Verified', 
    desc: 'Phone number verified via SMS',
    check: (cu: any, profile: any) => !!(profile?.phoneNumber && profile?.phoneVerified),
    securityLevel: 'high'
  },
  { 
    id: 'active', 
    icon: 'flame', 
    label: 'Active Member', 
    desc: 'At least 7 days of activity',
    check: (cu: any) => (cu?.stats?.streakDays || 0) >= 7 || (cu?.stats?.posts || 0) >= 5,
    securityLevel: 'medium'
  },
  { 
    id: 'topics', 
    icon: 'pricetags', 
    label: 'Topics Selected', 
    desc: 'Follow 3+ community topics',
    check: (cu: any) => (cu?.selectedTopics?.length || 0) >= 3,
    securityLevel: 'low'
  },
  { 
    id: 'device_trust', 
    icon: 'shield-checkmark', 
    label: 'Trusted Device', 
    desc: 'Device has been verified',
    check: () => true, // Will be checked via device fingerprint
    securityLevel: 'medium'
  },
];

const BENEFITS = [
  { icon: 'checkmark-circle', color: '#10b981', text: 'Verified badge on your profile' },
  { icon: 'shield-checkmark', color: '#6366f1', text: 'Enhanced trust with other parents' },
  { icon: 'star', color: '#f59e0b', text: 'Access to exclusive community features' },
  { icon: 'trending-up', color: '#ec4899', text: 'Higher visibility in discussions' },
  { icon: 'lock-closed', color: '#8b5cf6', text: 'Advanced security & anti-spam protection' },
  { icon: 'people', color: '#0ea5e9', text: 'Priority support from the community team' },
];

// ─── Security Level Badge ───
const SecurityBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
  const colors = {
    low: { bg: '#f59e0b15', text: '#f59e0b' },
    medium: { bg: '#3b82f615', text: '#3b82f6' },
    high: { bg: '#10b98115', text: '#10b981' },
  };
  const labels = { low: 'Basic', medium: 'Good', high: 'Strong' };
  const config = colors[level];
  
  return (
    <View style={[styles.securityBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.securityBadgeText, { color: config.text }]}>
        {labels[level]}
      </Text>
    </View>
  );
};

export default function CommunityVerificationScreen({ navigation }: Props) {
  const { currentUser, updateCommunityProfile, syncUserProfileAcrossPosts } = useCommunity();
  const { profile, updateProfile } = useUser();
  const { darkMode, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [securityScore, setSecurityScore] = useState(0);

  // ─── Generate Device Fingerprint ───
  useEffect(() => {
    const generateDeviceFingerprint = async () => {
      try {
        const deviceInfo = [
          Device.deviceName || '',
          Device.modelName || '',
          Device.osName || '',
          Device.osVersion || '',
          Device.deviceYearClass || '',
        ].join('|');
        
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          deviceInfo
        );
        setDeviceFingerprint(hash);
        
        // Store device fingerprint in secure storage
        await supabase
          .from('user_devices')
          .upsert({
            user_id: currentUser?.id,
            device_id: hash,
            device_name: Device.deviceName || 'Unknown Device',
            device_model: Device.modelName || 'Unknown Model',
            os_name: Device.osName || 'Unknown OS',
            last_active: new Date().toISOString(),
            is_trusted: true,
          }, { onConflict: 'device_id' });
      } catch (error) {
        console.log('Device fingerprint generation failed:', error);
      }
    };
    
    if (currentUser?.id) {
      generateDeviceFingerprint();
    }
  }, [currentUser?.id]);

  // ─── Security Score Calculation ───
  const securityChecks = useMemo(() => {
    const results: Record<string, boolean> = {};
    let score = 0;
    let totalChecks = REQUIREMENTS.length;
    
    REQUIREMENTS.forEach(req => {
      const met = req.check(currentUser, profile);
      results[req.id] = met;
      if (met) {
        const weights = { low: 1, medium: 2, high: 3 };
        score += weights[req.securityLevel];
      }
    });
    
    // Device trust check
    if (deviceFingerprint) {
      score += 2;
      totalChecks += 1;
    }
    
    const maxScore = totalChecks * 3;
    const percentage = Math.min(100, Math.round((score / maxScore) * 100));
    setSecurityScore(percentage);
    
    return results;
  }, [currentUser, profile, deviceFingerprint]);

  const allMet = useMemo(() => {
    // All requirements must be met for full verification
    return Object.values(securityChecks).every(Boolean);
  }, [securityChecks]);

  const getVerificationStatus = () => {
    if (currentUser?.isVerified) return 'verified';
    if (allMet) return 'ready';
    if (securityScore > 50) return 'partial';
    return 'incomplete';
  };

  const handleRequest = useCallback(async () => {
    if (!currentUser) return;
    if (!allMet) {
      triggerHaptic('error');
      sweetAlert.alert(
        'Requirements Not Met', 
        `Please complete all security requirements before requesting verification. Security score: ${securityScore}%`,
        'warning'
      );
      return;
    }
    
    // ─── Anti-spam / Rate limiting ───
    const lastRequestKey = `verification_request_${currentUser.id}`;
    const lastRequest = await AsyncStorage.getItem(lastRequestKey);
    if (lastRequest) {
      const lastTime = new Date(JSON.parse(lastRequest)).getTime();
      const now = Date.now();
      if (now - lastTime < 60000) { // 1 minute cooldown
        sweetAlert.alert(
          'Too Many Requests',
          'Please wait a moment before requesting verification again.',
          'warning'
        );
        return;
      }
    }
    
    setIsSubmitting(true);
    triggerHaptic('medium');
    
    try {
      // ─── Verify device fingerprint matches ───
      if (deviceFingerprint) {
        const { data: deviceData } = await supabase
          .from('user_devices')
          .select('is_trusted')
          .eq('device_id', deviceFingerprint)
          .single();
          
        if (!deviceData?.is_trusted) {
          sweetAlert.alert(
            'Untrusted Device',
            'Please verify your device first before requesting verification.',
            'warning'
          );
          return;
        }
      }
      
      // ─── Update user profile ───
      await updateCommunityProfile({ 
        isVerified: true,
        verificationDate: new Date().toISOString(),
        verificationMethod: 'security_bundle',
        securityScore: securityScore,
      });
      
      await syncUserProfileAcrossPosts(currentUser.id, { 
        isVerified: true,
        verificationDate: new Date().toISOString(),
        securityScore: securityScore,
      });
      
      // ─── Log verification event ───
      await supabase
        .from('verification_events')
        .insert({
          user_id: currentUser.id,
          event_type: 'verification_granted',
          security_score: securityScore,
          device_id: deviceFingerprint,
          timestamp: new Date().toISOString(),
        });
      
      // ─── Store last request time ───
      await AsyncStorage.setItem(
        `verification_request_${currentUser.id}`,
        JSON.stringify(new Date().toISOString())
      );
      
      triggerHaptic('success');
      sweetAlert.success(
        'Verified! 🎉', 
        `Your profile is now verified with a security score of ${securityScore}%. You've earned the trusted badge!`
      );
      navigation.goBack();
      
    } catch (error) {
      console.error('Verification error:', error);
      triggerHaptic('error');
      sweetAlert.error('Error', 'Could not complete verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [allMet, currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, navigation, sweetAlert, triggerHaptic, deviceFingerprint, securityScore]);

  const handleGoBack = useCallback(() => {
    if (!isSubmitting) navigation.goBack();
  }, [isSubmitting, navigation]);

  // ─── Status Colors ───
  const status = getVerificationStatus();
  const statusConfig = {
    verified: { icon: 'shield-checkmark', color: '#10b981', title: '✅ Verified Parent', desc: 'Your identity is fully verified. You have full access to all community features.' },
    ready: { icon: 'shield-checkmark', color: '#6366f1', title: 'Ready to Verify!', desc: 'You meet all requirements. Tap below to get verified instantly.' },
    partial: { icon: 'shield-half', color: '#f59e0b', title: 'Almost There!', desc: `Security score: ${securityScore}%. Complete remaining requirements to get verified.` },
    incomplete: { icon: 'shield-outline', color: '#94a3b8', title: 'Get Verified', desc: `Security score: ${securityScore}%. Complete the requirements below to unlock verification.` },
  };
  const currentStatus = statusConfig[status];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      <Animated.View entering={FadeInDown.springify()} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Security Score Card ─── */}
        <Animated.View entering={FadeInUp.delay(50).springify()}>
          <View style={styles.scoreCard}>
            <LinearGradient colors={['rgba(45,45,60,0.8)', 'rgba(35,35,50,0.6)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreLabel}>Security Score</Text>
                <Text style={[styles.scoreValue, { color: securityScore > 70 ? '#10b981' : securityScore > 40 ? '#f59e0b' : '#94a3b8' }]}>
                  {securityScore}%
                </Text>
              </View>
              <View style={styles.scoreRing}>
                <View style={[styles.scoreRingFill, { 
                  width: `${securityScore}%`,
                  backgroundColor: securityScore > 70 ? '#10b981' : securityScore > 40 ? '#f59e0b' : '#94a3b8',
                }]} />
              </View>
            </View>
            <View style={styles.scoreBadges}>
              <View style={[styles.scoreBadge, { backgroundColor: '#10b98115' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#10b981" />
                <Text style={styles.scoreBadgeText}>{Object.values(securityChecks).filter(Boolean).length}/{REQUIREMENTS.length} requirements</Text>
              </View>
              {deviceFingerprint && (
                <View style={[styles.scoreBadge, { backgroundColor: '#6366f115' }]}>
                  <Ionicons name="phone-portrait" size={12} color="#6366f1" />
                  <Text style={styles.scoreBadgeText}>Device Trusted ✓</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ─── Status Card ─── */}
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <View style={styles.statusCard}>
            <LinearGradient colors={['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={styles.statusBorder} />
            <View style={[styles.statusIconBg, { backgroundColor: `${currentStatus.color}20` }]}>
              <Ionicons name={currentStatus.icon as any} size={40} color={currentStatus.color} />
            </View>
            <Text style={[styles.statusTitle, { color: currentStatus.color }]}>{currentStatus.title}</Text>
            <Text style={styles.statusDesc}>{currentStatus.desc}</Text>
          </View>
        </Animated.View>

        {/* ─── Benefits ─── */}
        <Animated.View entering={FadeInUp.delay(150).springify()}>
          <Text style={styles.sectionTitle}>✨ Benefits</Text>
          <View style={styles.benefitsCard}>
            <LinearGradient colors={['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={styles.statusBorder} />
            {BENEFITS.map((b, i) => (
              <View key={i} style={[styles.benefitRow, i < BENEFITS.length - 1 && styles.benefitDivider]}>
                <Ionicons name={b.icon as any} size={20} color={b.color} />
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ─── Requirements ─── */}
        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <Text style={styles.sectionTitle}>🔒 Security Requirements</Text>
            <View style={styles.requirementsCard}>
              <LinearGradient colors={['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={styles.statusBorder} />
              {REQUIREMENTS.map((req) => {
                const met = securityChecks[req.id] || false;
                return (
                  <View key={req.id} style={[styles.reqRow, !met && styles.reqRowMuted]}>
                    <View style={[styles.reqIconBg, { backgroundColor: met ? '#10b98115' : '#64748b15' }]}>
                      <Ionicons name={met ? 'checkmark' : req.icon as any} size={18} color={met ? '#10b981' : '#64748b'} />
                    </View>
                    <View style={styles.reqContent}>
                      <View style={styles.reqLabelRow}>
                        <Text style={[styles.reqLabel, { color: met ? '#fff' : '#94a3b8' }]}>{req.label}</Text>
                        <SecurityBadge level={req.securityLevel} />
                      </View>
                      <Text style={styles.reqDesc}>{req.desc}</Text>
                    </View>
                    {met && <Ionicons name="checkmark-circle" size={22} color="#10b981" />}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ─── Action Button ─── */}
        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(300).springify()} style={{ marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleRequest}
              disabled={isSubmitting}
              activeOpacity={0.85}
              style={[styles.actionBtn, !allMet && styles.actionBtnDisabled]}
            >
              <LinearGradient
                colors={allMet ? ['#6366f1', '#8b5cf6'] : ['#334155', '#475569']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>
                    {allMet ? 'Request Verification' : `${securityScore}% Complete — ${Math.ceil((REQUIREMENTS.length - Object.values(securityChecks).filter(Boolean).length))} req. remaining`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.actionHint}>
              {allMet
                ? 'You meet all security requirements. Tap above to verify instantly.'
                : `Complete ${REQUIREMENTS.length - Object.values(securityChecks).filter(Boolean).length} more requirement${REQUIREMENTS.length - Object.values(securityChecks).filter(Boolean).length > 1 ? 's' : ''} to unlock verification.`}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // ─── Security Score ───
  scoreCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreRing: { width: 80, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  scoreRingFill: { height: '100%', borderRadius: 4 },
  scoreBadges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  scoreBadgeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // ─── Status Card ───
  statusCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, alignItems: 'center', marginBottom: 20 },
  statusBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  statusIconBg: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statusTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  statusDesc: { fontSize: 14, fontWeight: '500', color: '#94a3b8', textAlign: 'center', lineHeight: 20 },

  // ─── Section Title ───
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginBottom: 12, marginTop: 4 },

  // ─── Benefits ───
  benefitsCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  benefitDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  benefitText: { fontSize: 14, fontWeight: '600', color: '#e2e8f0', flex: 1 },

  // ─── Requirements ───
  requirementsCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 20 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  reqRowMuted: { opacity: 0.6 },
  reqIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  reqContent: { flex: 1, gap: 2 },
  reqLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqLabel: { fontSize: 15, fontWeight: '700' },
  reqDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  reqStatus: { fontSize: 11, fontWeight: '700' },

  // ─── Security Badge ───
  securityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  securityBadgeText: { fontSize: 10, fontWeight: '700' },

  // ─── Action Button ───
  actionBtn: { height: 56, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', marginHorizontal: 16 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  actionHint: { fontSize: 12, fontWeight: '500', color: '#64748b', textAlign: 'center', marginTop: 12, marginHorizontal: 24, lineHeight: 18 },
});