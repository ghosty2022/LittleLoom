// src/screens/community/CommunityVerificationScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useColorScheme,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { CommunityColors } from '../../theme/CommunityTheme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityVerification'>;

const REQUIREMENTS = [
  { id: 'profile', icon: 'person', label: 'Complete Profile', desc: 'Name, bio, and avatar' },
  { id: 'email', icon: 'mail', label: 'Email Confirmed', desc: 'Valid email address on file' },
  { id: 'active', icon: 'flame', label: 'Active Member', desc: 'At least 3 days of activity' },
  { id: 'topics', icon: 'pricetags', label: 'Topics Selected', desc: 'Follow 3+ community topics' },
];

const BENEFITS = [
  { icon: 'checkmark-circle', color: '#10b981', text: 'Verified badge on your profile' },
  { icon: 'shield-checkmark', color: '#6366f1', text: 'Enhanced trust with other parents' },
  { icon: 'star', color: '#f59e0b', text: 'Access to exclusive community features' },
  { icon: 'trending-up', color: '#ec4899', text: 'Higher visibility in discussions' },
];

export default function CommunityVerificationScreen({ navigation }: Props) {
  const { currentUser, updateCommunityProfile, syncUserProfileAcrossPosts } = useCommunity();
  const { profile } = useUser();
  const { darkMode, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const checks = useMemo(() => {
    const hasName = !!(currentUser?.displayName && currentUser.displayName.length > 2);
    const hasBio = !!(currentUser?.bio && currentUser.bio.length > 10);
    const hasAvatar = !!(currentUser?.avatar && currentUser.avatar.length > 0);
    const hasEmail = !!(profile?.email && profile.email.includes('@'));
    const isActive = (currentUser?.stats?.streakDays || 0) >= 3 || (currentUser?.stats?.posts || 0) > 0;
    const hasTopics = (currentUser?.selectedTopics?.length || 0) >= 3;

    return {
      profile: hasName && hasBio && hasAvatar,
      email: hasEmail,
      active: isActive,
      topics: hasTopics,
    };
  }, [currentUser, profile]);

  const allMet = useMemo(() => Object.values(checks).every(Boolean), [checks]);

  const handleRequest = useCallback(async () => {
    if (!currentUser) return;
    if (!allMet) {
      triggerHaptic('error');
      sweetAlert.alert('Requirements Not Met', 'Please complete all requirements before requesting verification.', 'warning');
      return;
    }
    setIsSubmitting(true);
    triggerHaptic('medium');
    try {
      await updateCommunityProfile({ isVerified: true });
      await syncUserProfileAcrossPosts(currentUser.id, { isVerified: true });
      triggerHaptic('success');
      sweetAlert.success('Verified!', 'Your profile is now verified. Welcome to the trusted parent community.');
      navigation.goBack();
    } catch (error) {
      triggerHaptic('error');
      sweetAlert.error('Error', 'Could not complete verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [allMet, currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, navigation, sweetAlert, triggerHaptic]);

  const handleGoBack = useCallback(() => {
    if (!isSubmitting) navigation.goBack();
  }, [isSubmitting, navigation]);

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
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <View style={styles.statusCard}>
            <LinearGradient colors={['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={styles.statusBorder} />
            {currentUser?.isVerified ? (
              <>
                <View style={[styles.statusIconBg, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="shield-checkmark" size={40} color="#10b981" />
                </View>
                <Text style={styles.statusTitle}>Verified Parent</Text>
                <Text style={styles.statusDesc}>Your identity has been verified. You have full access to all community features.</Text>
              </>
            ) : (
              <>
                <View style={[styles.statusIconBg, { backgroundColor: '#6366f120' }]}>
                  <Ionicons name="shield-outline" size={40} color="#6366f1" />
                </View>
                <Text style={styles.statusTitle}>Get Verified</Text>
                <Text style={styles.statusDesc}>Complete the requirements below to verify your identity and unlock exclusive features.</Text>
              </>
            )}
          </View>
        </Animated.View>

        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <Text style={styles.sectionTitle}>Benefits</Text>
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
        )}

        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementsCard}>
              <LinearGradient colors={['rgba(45,45,60,0.6)', 'rgba(35,35,50,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={styles.statusBorder} />
              {REQUIREMENTS.map((req) => {
                const met = checks[req.id as keyof typeof checks];
                return (
                  <View key={req.id} style={[styles.reqRow, !met && styles.reqRowMuted]}>
                    <View style={[styles.reqIconBg, { backgroundColor: met ? '#10b98115' : '#64748b15' }]}>
                      <Ionicons name={met ? 'checkmark' : req.icon as any} size={18} color={met ? '#10b981' : '#64748b'} />
                    </View>
                    <View style={styles.reqContent}>
                      <Text style={[styles.reqLabel, { color: met ? '#fff' : '#94a3b8' }]}>{req.label}</Text>
                      <Text style={styles.reqDesc}>{req.desc}</Text>
                    </View>
                    {met && <Ionicons name="checkmark-circle" size={22} color="#10b981" />}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {!currentUser?.isVerified && (
          <Animated.View entering={FadeInUp.delay(400).springify()} style={{ marginTop: 8 }}>
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
              <Text style={styles.actionBtnText}>
                {isSubmitting ? 'Verifying...' : allMet ? 'Request Verification' : 'Complete Requirements'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionHint}>
              {allMet
                ? 'You meet all requirements. Tap above to verify instantly.'
                : 'Finish the requirements above to unlock verification.'}
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

  statusCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, alignItems: 'center', marginBottom: 20 },
  statusBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  statusIconBg: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statusTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
  statusDesc: { fontSize: 14, fontWeight: '500', color: '#94a3b8', textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginBottom: 12, marginTop: 4 },

  benefitsCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  benefitDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  benefitText: { fontSize: 14, fontWeight: '600', color: '#e2e8f0', flex: 1 },

  requirementsCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 20 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  reqRowMuted: { opacity: 0.7 },
  reqIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  reqContent: { flex: 1, gap: 2 },
  reqLabel: { fontSize: 15, fontWeight: '700' },
  reqDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },

  actionBtn: { height: 56, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginHorizontal: 16 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  actionHint: { fontSize: 12, fontWeight: '500', color: '#64748b', textAlign: 'center', marginTop: 12, marginHorizontal: 24, lineHeight: 18 },
});