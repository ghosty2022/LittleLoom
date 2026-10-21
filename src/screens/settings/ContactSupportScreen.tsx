import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert,
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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import { supabase } from '../../lib/supabase';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactSupport'>;

/* ═══════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════ */

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray700: '#44403c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
};

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  route?: keyof RootStackParamList;
  params?: any;
  helpText?: string;
}

interface AltContact {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  url?: string;
  route?: keyof RootStackParamList;
  color: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Categories (unchanged)
   ═══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: CategoryItem[] = [
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline' },
  { id: 'feature', label: 'Feature Request', icon: 'bulb-outline' },
  {
    id: 'account',
    label: 'Account & Security',
    icon: 'lock-closed-outline',
    route: 'SecurityCenter',
    helpText: 'Check your PIN, biometric, and security settings',
  },
  {
    id: 'password',
    label: 'Change Password/PIN',
    icon: 'key-outline',
    route: 'SecurityCenter',
    params: { mode: 'change' },
    helpText: 'Update your app PIN code',
  },
  {
    id: 'biometric',
    label: 'Biometric Setup',
    icon: 'finger-print-outline',
    route: 'BiometricSetup',
    helpText: 'Configure Face ID / Touch ID login',
  },
  {
    id: 'data',
    label: 'Data & Backup',
    icon: 'cloud-upload-outline',
    route: 'BackupRestore',
    helpText: 'Create backups or restore your data',
  },
  {
    id: 'family',
    label: 'Family Dashboard',
    icon: 'people-outline',
    route: 'FamilySharing',
    helpText: 'Manage co-parents and guardians',
  },
  {
    id: 'profile',
    label: 'Baby Profile',
    icon: 'person-circle-outline',
    route: 'Profile',
    helpText: 'View or edit baby profiles',
  },
  {
    id: 'switch',
    label: 'Switch Baby',
    icon: 'swap-horizontal-outline',
    route: 'SwitchBaby',
    helpText: 'Switch between multiple baby profiles',
  },
  {
    id: 'track',
    label: 'Tracking Issues',
    icon: 'timer-outline',
    route: 'UniversalTrackerHub',
    helpText: 'Check feeding, sleep, and potty tracking',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: 'alarm-outline',
    route: 'TrackerReminders',
    helpText: 'Manage your notification reminders',
  },
  {
    id: 'achievements',
    label: 'Achievements',
    icon: 'trophy-outline',
    route: 'Achievements',
    helpText: 'View milestones and parenting wins',
  },
  {
    id: 'growth',
    label: 'Growth Charts',
    icon: 'trending-up-outline',
    route: 'GrowthDashboard',
    helpText: 'Check height, weight, and milestone charts',
  },
  {
    id: 'gallery',
    label: 'Photos & Gallery',
    icon: 'images-outline',
    route: 'Gallery',
    helpText: 'View and manage your photo memories',
  },
  {
    id: 'sound',
    label: 'Sound Mixer',
    icon: 'musical-notes-outline',
    route: 'SoundMixer',
    helpText: 'White noise and lullaby settings',
  },
  {
    id: 'customize',
    label: 'Customize App',
    icon: 'color-wand-outline',
    route: 'Customize',
    helpText: 'Themes, colors, and appearance settings',
  },
  {
    id: 'language',
    label: 'Language',
    icon: 'language-outline',
    route: 'LanguageSettings',
    helpText: 'Change your app language',
  },
  {
    id: 'units',
    label: 'Unit Settings',
    icon: 'options-outline',
    route: 'UnitSettings',
    helpText: 'Metric or Imperial measurements',
  },
  {
    id: 'safety',
    label: 'Safety Corner',
    icon: 'shield-half-outline',
    route: 'SafetyCorner',
    helpText: 'Baby safety tips and guides',
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    icon: 'document-text-outline',
    route: 'PrivacyPolicy',
    helpText: 'Read our privacy and data policy',
  },
  {
    id: 'chat',
    label: 'Family Chat',
    icon: 'chatbubbles-outline',
    route: 'FamilyChatList',
    helpText: 'Chat with co-parents and family',
  },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

/* ═══════════════════════════════════════════════════════════════════════
   Section Header (Aura)
   ═══════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════ */

export default function ContactSupportScreen({ navigation }: Props) {
  const { sweetAlert } = useSweetAlert();
  const [user, setUser] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { error } = await supabase.from('tracker_entries').select('id').limit(1);
        setIsConnected(!error);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch {
        setIsConnected(false);
      }
    };
    checkSupabase();
  }, []);
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    reduceMotion,
  } = useCustomization();

  const primary = themeColors?.primary || AURA.primary;
  const secondary = themeColors?.secondary || AURA.accent;

  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  const handleHaptic = (style: 'light' | 'medium' | 'success' = 'light') => {
    if (!reduceMotion) {
      const hapticStyle = style === 'success'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(hapticStyle).catch(() => {});
    }
  };

  const handleCategoryPress = (cat: CategoryItem) => {
    handleHaptic('light');
    setCategory(cat.id);
    if (cat.route) {
      sweetAlert({
        title: `Go to ${cat.label}?`,
        message: `We'll take you to the ${cat.label} screen where you can find help with this topic.`,
        type: 'question',
        confirmText: 'Go There',
        cancelText: 'Stay Here',
        showCancel: true,
        onConfirm: () => {
          if (cat.params) {
            navigation.navigate(cat.route as any, cat.params as any);
          } else {
            navigation.navigate(cat.route as any);
          }
        },
      });
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      sweetAlert({
        title: 'Missing Info',
        message: 'Please fill in the subject and message.',
        type: 'warning',
        confirmText: 'OK',
      });
      return;
    }

    handleHaptic('medium');
    setIsSending(true);
    setSendProgress(0);

    const progressInterval = setInterval(() => {
      setSendProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const supportData = {
        email,
        category,
        subject,
        message,
        user_id: user?.id,
        app_version: '1.0.0',
        platform: Platform.OS,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('support_tickets')
        .insert([supportData]);

      if (error) throw error;

      setSendProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));

      sweetAlert({
        title: 'Message Sent! 🎉',
        message: 'Our team will get back to you within 24 hours.',
        type: 'success',
        confirmText: 'Great',
        onConfirm: () => {
          setSubject('');
          setMessage('');
          navigation.goBack();
        },
      });
    } catch (error) {
      console.error('Send error:', error);
      sweetAlert({
        title: 'Send Failed',
        message: 'We could not send your message. Please try again or use an alternative contact method.',
        type: 'error',
        confirmText: 'Try Again',
        onConfirm: () => {
          setIsSending(false);
          setSendProgress(0);
        },
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
    } catch (e) {
      console.warn('Failed to open link:', e);
    }
  };

  const altContacts: AltContact[] = [
    {
      icon: 'mail-outline',
      label: 'Email',
      value: 'support@littleloom.app',
      url: 'mailto:support@littleloom.app',
      color: AURA.primary,
    },
    {
      icon: 'logo-twitter',
      label: 'Twitter / X',
      value: '@LittleLoomApp',
      url: 'https://x.com/LittleLoomApp',
      color: '#1DA1F2',
    },
    {
      icon: 'help-circle-outline',
      label: 'Help Center',
      value: 'Browse FAQs',
      route: 'HelpCenter',
      color: AURA.success,
    },
    {
      icon: 'document-text-outline',
      label: 'Privacy Policy',
      value: 'Read our policy',
      route: 'PrivacyPolicy',
      color: AURA.warning,
    },
  ];

  const handleAltContact = (contact: AltContact) => {
    handleHaptic('light');
    if (contact.route) {
      navigation.navigate(contact.route as any);
    } else if (contact.url) {
      openLink(contact.url);
    }
  };

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || AURA.darkBg, themeColors?.colors?.[1] || '#1a1428', themeColors?.colors?.[2] || AURA.darkBg]
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#eef0ff', themeColors?.colors?.[2] || '#e2e5ff'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={bgColors} style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Header ─── */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(100)}
            style={styles.header}
          >
            <TouchableOpacity
              style={[
                styles.backButton,
                { backgroundColor: isDark ? AURA.darkCard : 'rgba(0,0,0,0.05)' },
              ]}
              onPress={() => {
                handleHaptic('light');
                navigation.goBack();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? AURA.white : AURA.gray900} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
              Contact Support
            </Text>
            <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
              We read every message and reply within 24 hours
            </Text>
          </Animated.View>

          {/* ─── Status Banner ─── */}
          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(150)}>
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: isConnected ? `${AURA.success}12` : `${AURA.warning}12` },
              ]}
            >
              <Ionicons
                name={isConnected ? 'cloud-outline' : 'cloud-offline-outline'}
                size={20}
                color={isConnected ? AURA.success : AURA.warning}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isConnected ? AURA.success : AURA.warning },
                ]}
              >
                {isConnected
                  ? 'Connected to support system'
                  : 'You are offline - messages will be queued'}
              </Text>
            </View>
          </Animated.View>

          {/* ─── Category Selection ─── */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(200)}
            style={styles.sectionWrapper}
          >
            <SectionHeader
              icon="grid-outline"
              title="What do you need help with?"
              color={AURA.primary}
              isDark={isDark}
            />
            <BlurView
              intensity={isDark ? 30 : 70}
              style={styles.categoryContainer}
              tint={isDark ? 'dark' : 'light'}
            >
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      category === cat.id && {
                        backgroundColor: AURA.primary,
                        borderColor: AURA.primary,
                      },
                      isDark && styles.categoryChipDark,
                    ]}
                    onPress={() => handleCategoryPress(cat)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={16}
                      color={
                        category === cat.id
                          ? AURA.white
                          : isDark
                          ? AURA.gray400
                          : AURA.gray500
                      }
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.id && styles.categoryChipTextActive,
                        isDark && styles.categoryChipTextDark,
                      ]}
                    >
                      {cat.label}
                    </Text>
                    {cat.route && category !== cat.id && (
                      <Ionicons
                        name="open-outline"
                        size={12}
                        color={isDark ? AURA.gray500 : AURA.gray400}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
          </Animated.View>

          {/* ─── Form ─── */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(300)}
            style={styles.sectionWrapper}
          >
            <SectionHeader
              icon="create-outline"
              title="Your Message"
              color={AURA.accent}
              isDark={isDark}
            />
            <BlurView
              intensity={isDark ? 30 : 70}
              style={styles.formContainer}
              tint={isDark ? 'dark' : 'light'}
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Your Email</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? AURA.gray500 : AURA.gray400}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Subject</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="What's this about?"
                  placeholderTextColor={isDark ? AURA.gray500 : AURA.gray400}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Message</Text>
                <TextInput
                  style={[styles.textArea, isDark && styles.textAreaDark]}
                  placeholder="Describe your issue or suggestion in detail..."
                  placeholderTextColor={isDark ? AURA.gray500 : AURA.gray400}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              {isSending && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBarBg,
                      { backgroundColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.06)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${sendProgress}%`, backgroundColor: AURA.primary },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.progressText,
                      { color: isDark ? AURA.gray400 : AURA.gray500 },
                    ]}
                  >
                    {sendProgress < 100 ? 'Sending...' : 'Sent!'}
                  </Text>
                </View>
              )}
            </BlurView>
          </Animated.View>

          {/* ─── Send Button ─── */}
          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(400)}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (isSending || !subject.trim() || !message.trim()) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={isSending || !subject.trim() || !message.trim()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  isSending
                    ? [AURA.gray400, AURA.gray500]
                    : [AURA.primary, AURA.accent]
                }
                style={styles.sendGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isSending ? (
                  <View style={styles.sendLoading}>
                    <UniversalSpinner size={20} color={AURA.white} variant="liquid" section="settings" />
                    <Text style={styles.sendButtonText}>Sending...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={AURA.white} style={{ marginRight: 8 }} />
                    <Text style={styles.sendButtonText}>Send Message</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ─── Alternative Contact ─── */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(500)}
            style={styles.sectionWrapper}
          >
            <SectionHeader
              icon="chatbubbles-outline"
              title="Other Ways to Reach Us"
              color={AURA.success}
              isDark={isDark}
            />
            <BlurView
              intensity={isDark ? 30 : 70}
              style={styles.linksContainer}
              tint={isDark ? 'dark' : 'light'}
            >
              {altContacts.map((contact, i) => (
                <React.Fragment key={contact.label}>
                  <TouchableOpacity
                    style={[
                      styles.altItem,
                      isDark && styles.altItemDark,
                      { borderColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.04)' },
                    ]}
                    onPress={() => handleAltContact(contact)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.altIcon, { backgroundColor: `${contact.color}15` }]}>
                      <Ionicons name={contact.icon} size={22} color={contact.color} />
                    </View>
                    <View style={styles.altText}>
                      <Text style={[styles.altLabel, isDark && styles.altLabelDark]}>
                        {contact.label}
                      </Text>
                      <Text style={[styles.altValue, isDark && styles.altValueDark]}>
                        {contact.value}
                      </Text>
                    </View>
                    <Ionicons
                      name={contact.route ? 'chevron-forward' : 'open-outline'}
                      size={18}
                      color={isDark ? AURA.gray500 : AURA.gray400}
                    />
                  </TouchableOpacity>
                  {i < altContacts.length - 1 && (
                    <View style={[styles.divider, isDark && styles.dividerDark]} />
                  )}
                </React.Fragment>
              ))}
            </BlurView>
          </Animated.View>
        </Animated.ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  header: { marginBottom: 20 },
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
    color: AURA.gray900,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerTitleDark: { color: AURA.white },
  headerSubtitle: {
    fontSize: 15,
    color: AURA.gray500,
    fontWeight: '500',
  },
  headerSubtitleDark: { color: AURA.gray400 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },

  sectionWrapper: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AURA.gray900,
    letterSpacing: -0.3,
  },
  sectionTitleDark: { color: AURA.white },

  categoryContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  categoryChipDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
    borderColor: AURA.darkBorder,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AURA.gray500,
  },
  categoryChipTextActive: { color: AURA.white },
  categoryChipTextDark: { color: AURA.gray400 },

  formContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 20,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: AURA.gray900,
    marginBottom: 10,
  },
  labelDark: { color: AURA.white },
  input: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: AURA.gray900,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
    fontWeight: '500',
  },
  inputDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
    color: AURA.white,
    borderColor: AURA.darkBorder,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: AURA.gray900,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
    minHeight: 120,
    fontWeight: '500',
  },
  textAreaDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
    color: AURA.white,
    borderColor: AURA.darkBorder,
  },

  progressContainer: {
    marginTop: 8,
    gap: 8,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  sendButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    minHeight: 56,
  },
  sendLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendButtonText: {
    color: AURA.white,
    fontSize: 16,
    fontWeight: '700',
  },

  linksContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  altItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  altItemDark: {},
  altIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  altText: { flex: 1 },
  altLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: AURA.gray900,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  altLabelDark: { color: AURA.white },
  altValue: {
    fontSize: 13,
    color: AURA.gray500,
    fontWeight: '500',
  },
  altValueDark: { color: AURA.gray400 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 80,
  },
  dividerDark: {
    backgroundColor: AURA.darkBorder,
  },
});