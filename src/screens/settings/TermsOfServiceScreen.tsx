import React from 'react';
import { Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';


type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: `By downloading, installing, or using LittleLoom ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.

These terms apply to all users, including parents, guardians, and any family members invited to use the App through Family Dashboard features.`,
  },
  {
    title: '2. Description of Service',
    content: `LittleLoom is a baby tracking and family coordination application designed to help parents and caregivers:

• Track feeding, sleep, potty, and growth milestones
• Manage baby profiles and health records
• Coordinate care schedules with family members
• Share updates through secure family chat
• Store memories and photos in a private gallery

The App is intended for personal, non-commercial use by families and caregivers.`,
  },
  {
    title: '3. User Accounts & Eligibility',
    content: `To use LittleLoom, you must:

• Be at least 18 years old or the legal age of majority in your jurisdiction
• Be a parent, legal guardian, or authorized caregiver of the child(ren) being tracked
• Provide accurate and complete information during registration
• Maintain the security of your account credentials

You are responsible for all activity that occurs under your account. Notify us immediately of any unauthorized use.`,
  },
  {
    title: '4. Family Dashboard & Permissions',
    content: `When you invite family members or guardians to access your baby's data:

• You control what data each person can view and edit
• You can revoke access at any time through the app settings
• Invited members must accept the invitation and comply with these terms
• You are responsible for ensuring invited members are appropriate caregivers

LittleLoom is not responsible for disputes between family members regarding data access or sharing permissions.`,
  },
  {
    title: '5. Data Ownership & Privacy',
    content: `You retain ownership of all data you enter into LittleLoom. We respect your privacy:

• All baby tracking data is stored locally on your device by default
• We do not sell, rent, or share your personal data with third parties
• We do not use your data for advertising purposes
• Cloud features (if enabled) use encrypted transmission and storage

For complete details, please review our Privacy Policy.`,
  },
  {
    title: '6. Acceptable Use',
    content: `You agree not to use LittleLoom to:

• Harass, abuse, or harm other users
• Share content that is illegal, offensive, or inappropriate for children
• Attempt to access other users' accounts without authorization
• Reverse engineer, decompile, or modify the App
• Use the App for any commercial purpose without our consent
• Upload viruses, malware, or other harmful code

Violation of these rules may result in termination of your account.`,
  },
  {
    title: '7. Intellectual Property',
    content: `LittleLoom and all associated content, features, and functionality are owned by LittleLoom Inc. and are protected by copyright, trademark, and other intellectual property laws.

You may not:
• Copy, modify, or create derivative works of the App
• Remove any copyright or proprietary notices
• Use our trademarks without prior written permission
• Distribute or publicly display the App without authorization`,
  },
  {
    title: '8. Disclaimer of Warranties',
    content: `LittleLoom is provided "as is" and "as available" without warranties of any kind, either express or implied.

We do not guarantee that:
• The App will be error-free or uninterrupted
• Data will be completely secure or never lost
• The App will meet your specific requirements
• Medical or health information is accurate for your situation

Always consult qualified healthcare professionals for medical advice. LittleLoom is not a substitute for professional medical care.`,
  },
  {
    title: '9. Limitation of Liability',
    content: `To the maximum extent permitted by law, LittleLoom Inc. shall not be liable for:

• Indirect, incidental, special, or consequential damages
• Loss of data, profits, or goodwill
• Damages arising from your use or inability to use the App
• Issues arising from Family Dashboard disputes or unauthorized access by invited members
• Any medical decisions made based on information tracked in the App

Our total liability shall not exceed the amount you paid for the App (if any) in the twelve months preceding the claim.`,
  },
  {
    title: '10. Subscription & Payments',
    content: `Some features of LittleLoom may require a subscription:

• Subscription fees are charged through your device's app store
• Subscriptions automatically renew unless cancelled 24 hours before renewal
• You can manage or cancel subscriptions in your device settings
• Refunds are handled according to your app store's policies
• Prices are subject to change with notice

Free features remain available even if you cancel your subscription.`,
  },
  {
    title: '11. Termination',
    content: `You may terminate your account at any time by:
• Deleting the App from your device
• Requesting account deletion through the app settings
• Contacting support@littleloom.app

We may suspend or terminate your account if you violate these terms. Upon termination, your data will be deleted according to our data retention policy.`,
  },
  {
    title: '12. Changes to Terms',
    content: `We may update these Terms of Service from time to time. We will notify you of significant changes by:

• Updating the "Last Updated" date below
• Displaying a notice in the App
• Sending an email to registered users

Continued use of LittleLoom after changes constitutes acceptance of the updated terms.`,
  },
  {
    title: '13. Governing Law',
    content: `These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.

Any disputes arising from these terms shall be resolved through binding arbitration in San Francisco, California, except that either party may seek injunctive relief in court.`,
  },
  {
    title: '14. Contact Information',
    content: `If you have questions about these Terms of Service, please contact us:

Email: legal@littleloom.app
Support: support@littleloom.app
Website: www.littleloom.app

We aim to respond to all inquiries within 48 business hours.`,
  },
];

export default function TermsOfServiceScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';
  const success = themeColors?.accent || '#43e97b';

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const openEmail = async () => {
    try {
      await Linking.openURL('mailto:legal@littleloom.app');
    } catch (e) {
      console.warn('Failed to open email:', e);
    }
  };

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AutoHideAnimatedScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(100)} style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => { handleHaptic(); navigation.goBack(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Terms of Service</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Last Updated: June 7, 2026
          </Text>
        </Animated.View>

        {/* Intro */}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(200)} style={styles.sectionWrapper}>
          <BlurView
            intensity={isDark ? 30 : 70}
            style={[styles.introCard, { borderColor: `${primary}26` }]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={[styles.introIcon, { backgroundColor: `${primary}15` }]}>
              <Ionicons name="document-text" size={28} color={primary} />
            </View>
            <Text style={[styles.introTitle, isDark && styles.introTitleDark]}>
              Your Agreement with LittleLoom
            </Text>
            <Text style={[styles.introText, isDark && styles.introTextDark]}>
              These Terms of Service govern your use of LittleLoom. By using our app, you agree to these terms. Please read them carefully.
            </Text>
          </BlurView>
        </Animated.View>

        {/* Accept Button (for signup flow) */}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(250)} style={styles.sectionWrapper}>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: success }]}
            onPress={() => {
              handleHaptic();
              navigation.navigate('SignUp');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.acceptButtonText}>I Accept the Terms of Service</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <Animated.View
            key={index}
            entering={reduceMotion ? undefined : FadeInUp.delay(300 + index * 80)}
            style={styles.sectionWrapper}
          >
            <BlurView
              intensity={isDark ? 30 : 70}
              style={[styles.sectionCard, isDark && styles.sectionCardDark]}
              tint={isDark ? 'dark' : 'light'}
            >
              <Text style={[styles.sectionCardTitle, isDark && styles.sectionCardTitleDark]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionText, isDark && styles.sectionTextDark]}>
                {section.content}
              </Text>
            </BlurView>
          </Animated.View>
        ))}

        {/* Footer */}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(900)} style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerCard, isDark && styles.footerCardDark]}
            onPress={() => { handleHaptic(); openEmail(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={20} color={primary} />
            <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
              Legal questions? <Text style={{ color: primary, fontWeight: '700' }}>legal@littleloom.app</Text>
            </Text>
            <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerCard, isDark && styles.footerCardDark, { marginTop: 12 }]}
            onPress={() => { handleHaptic(); navigation.navigate('PrivacyPolicy'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark" size={20} color={success} />
            <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
              View our <Text style={{ color: success, fontWeight: '700' }}>Privacy Policy</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>
        </Animated.View>
      </AutoHideAnimatedScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  header: { marginBottom: 24 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerTitleDark: { color: '#fff' },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  headerSubtitleDark: { color: '#a0a0a0' },

  sectionWrapper: { marginBottom: 12 },

  introCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  introTitleDark: { color: '#fff' },
  introText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  introTextDark: { color: '#a0a0a0' },

  acceptButton: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  sectionCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sectionCardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionCardTitleDark: { color: '#fff' },
  sectionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    fontWeight: '500',
  },
  sectionTextDark: { color: '#a0a0a0' },

  footer: {
    marginTop: 20,
    marginBottom: 20,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  footerCardDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
    fontWeight: '500',
  },
  footerTextDark: { color: '#666' },
});
