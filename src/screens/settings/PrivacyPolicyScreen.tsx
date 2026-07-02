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


type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: `LittleLoom is designed with privacy at its core. We collect minimal information:

• Baby profile data (name, birth date, gender) — stored locally on your device
• Activity logs (feeding, sleep, potty, etc.) — stored locally on your device
• Growth measurements and milestones — stored locally on your device
• Account information (email, name) — only if you enable cloud features (future)

We do NOT collect:
• Location data
• Contacts from your phone
• Browsing history
• Advertising identifiers`,
  },
  {
    title: '2. How We Use Your Data',
    content: `Your data is used exclusively to provide the baby tracking features you see in the app:

• Display timelines and charts
• Calculate statistics and streaks
• Generate reminders and notifications
• Enable Family Dashboard (only with people you explicitly invite)

We never sell, rent, or share your data with third parties for advertising or marketing purposes.`,
  },
  {
    title: '3. Data Storage & Security',
    content: `All your baby tracking data is stored locally on your device using encrypted storage:

• iOS: Keychain Services and encrypted file system
• Android: Keystore and encrypted SharedPreferences

You control your data through:
• Local PIN/Biometric app lock
• Manual encrypted JSON backups
• Family Dashboard permissions you set

We do not operate servers that store your baby data. Your information never leaves your device unless you explicitly choose to share it (e.g., creating a backup file or inviting a family member).`,
  },
  {
    title: '4. Family Dashboard',
    content: `When you invite a co-parent or guardian:

• They receive only the data you authorize
• You can revoke access at any time
• Their device stores a copy of shared data locally
• Removing a family member removes their access to future updates

You remain the data controller for your baby's information.`,
  },
  {
    title: '5. Your Rights',
    content: `You have full control over your data:

• Access: View all your data anytime in the app
• Export: Create JSON backups at any time
• Delete: Remove individual entries or entire baby profiles
• Portability: Move your data to a new device via backup files
• Account Deletion: Contact us to permanently delete all associated data

To exercise these rights, use the in-app features or contact support@littleloom.app.`,
  },
  {
    title: '6. Childrens Privacy',
    content: `LittleLoom is intended for use by parents and legal guardians. We do not knowingly collect personal information directly from children under 13.

All data entered is provided by the parent/guardian account holder.`,
  },
  {
    title: '7. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of any changes by:

• Updating the "Last Updated" date below
• Displaying a notice in the app
• Sending an email to registered users (if applicable)

Continued use of LittleLoom after changes constitutes acceptance of the updated policy.`,
  },
];

const SectionHeader: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  isDark: boolean;
}> = ({ icon, title, color, isDark }) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionIcon, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
      {title}
    </Text>
  </View>
);

export default function PrivacyPolicyScreen({ navigation }: Props) {
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
      await Linking.openURL('mailto:privacy@littleloom.app');
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
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(100)}
          style={styles.header}
        >
          <TouchableOpacity
            style={[
              styles.backButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ]}
            onPress={() => {
              handleHaptic();
              navigation.goBack();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Privacy Policy</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Last Updated: May 28, 2026
          </Text>
        </Animated.View>

        {/* Intro */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.sectionWrapper}
        >
          <BlurView
            intensity={isDark ? 30 : 70}
            style={[styles.introCard, { borderColor: `${success}26` }]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={[styles.introIcon, { backgroundColor: `${success}15` }]}>
              <Ionicons name="shield-checkmark" size={28} color={success} />
            </View>
            <Text style={[styles.introTitle, isDark && styles.introTitleDark]}>
              Privacy First, Always
            </Text>
            <Text style={[styles.introText, isDark && styles.introTextDark]}>
              LittleLoom is built on a simple principle: your family's data belongs to you, and no one else. We don't run ads, we don't sell data, and we don't operate data-hungry servers.
            </Text>
          </BlurView>
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

        {/* Contact Cards */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(900)}
          style={styles.footer}
        >
          <TouchableOpacity
            style={[styles.footerCard, isDark && styles.footerCardDark]}
            onPress={() => {
              handleHaptic();
              openEmail();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={20} color={primary} />
            <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
              Questions about privacy?
                  <Text style={{ color: primary, fontWeight: '700' }}>privacy@littleloom.app</Text>
            </Text>
            <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerCard, isDark && styles.footerCardDark, { marginTop: 12 }]}
            onPress={() => {
              handleHaptic();
              navigation.navigate('ContactSupport');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={success} />
            <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
              Need to talk to a human?
              <Text style={{ color: success, fontWeight: '700' }}>Contact Support</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.ScrollView>
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
