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
import Animated, { FadeInUp } from 'react-native-reanimated';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 40;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING - CARD_GAP) / 2;

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════
   Data (Aura palette for feature cards)
   ═══════════════════════════════════════════════════════════════════════ */

const FEATURES: FeatureItem[] = [
  {
    icon: 'shield-checkmark',
    title: 'Privacy First',
    desc: 'Your data stays on your device or encrypted in the cloud',
    route: 'PrivacyPolicy',
    color: AURA.success,
  },
  {
    icon: 'people',
    title: 'Family Dashboard',
    desc: 'Invite co-parents and guardians',
    route: 'FamilySharing',
    color: AURA.primary,
  },
  {
    icon: 'trending-up',
    title: 'Growth Tracking',
    desc: 'Monitor height, weight, milestones',
    route: 'GrowthDashboard',
    color: AURA.warning,
  },
  {
    icon: 'moon',
    title: 'Sleep Insights',
    desc: 'Track and understand sleep patterns',
    route: 'SleepTracker',
    color: AURA.secondary,
  },
  {
    icon: 'restaurant',
    title: 'Feeding Log',
    desc: 'Track breast, bottle, and solids',
    route: 'FeedTracker',
    color: '#fb923c',
  },
  {
    icon: 'medical',
    title: 'Health Records',
    desc: 'Medications, allergies, and more',
    route: 'UniversalTrackerHub',
    params: { type: 'health' },
    color: AURA.danger,
  },
  {
    icon: 'color-wand',
    title: 'Customize',
    desc: 'Themes, colors, and app look',
    route: 'Customize',
    color: AURA.accent,
  },
  {
    icon: 'trophy',
    title: 'Achievements',
    desc: 'Milestones and parenting wins',
    route: 'Achievements',
    color: '#eab308',
  },
  {
    icon: 'images',
    title: 'Gallery',
    desc: 'Photos and precious memories',
    route: 'Gallery',
    color: AURA.info,
  },
  {
    icon: 'alarm',
    title: 'Reminders',
    desc: 'Never miss an important moment',
    route: 'TrackerReminders',
    color: '#14b8a6',
  },
  {
    icon: 'shield-half',
    title: 'Safety Corner',
    desc: 'Tips and guides for baby safety',
    route: 'SafetyCorner',
    color: '#dc2626',
  },
  {
    icon: 'musical-notes',
    title: 'Sound Mixer',
    desc: 'White noise and lullabies',
    route: 'SoundMixer',
    color: AURA.primary,
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  { icon: 'logo-twitter', label: 'Twitter', url: 'https://twitter.com/littleloom', color: '#1DA1F2' },
  { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/littleloom', color: '#E4405F' },
  { icon: 'logo-github', label: 'GitHub', url: 'https://github.com/littleloom', color: AURA.gray900 },
  { icon: 'logo-youtube', label: 'YouTube', url: 'https://youtube.com/littleloom', color: '#FF0000' },
];

const TEAM = [
  { name: 'Refresh', role: 'By TPM Solutions', emoji: '🚀' },
  { name: 'Community', role: 'Powered by Supabase', emoji: '⚡' },
];

/* ═══════════════════════════════════════════════════════════════════════
   SectionHeader
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
   ServiceLinkItem
   ═══════════════════════════════════════════════════════════════════════ */

const ServiceLinkItem: React.FC<{
  item: ServiceLink;
  isDark: boolean;
  primaryColor: string;
  onPress: () => void;
}> = ({ item, isDark, primaryColor, onPress }) => (
  <TouchableOpacity
    style={[
      styles.linkItem,
      isDark && styles.linkItemDark,
      { borderColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.04)' },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.linkIcon, { backgroundColor: `${item.color}15` }]}>
      <Ionicons name={item.icon} size={22} color={item.color} />
    </View>
    <View style={styles.linkTextContainer}>
      <Text style={[styles.linkTitle, isDark && styles.linkTitleDark]}>
        {item.title}
      </Text>
      <Text style={[styles.linkSubtitle, isDark && styles.linkSubtitleDark]}>
        {item.subtitle}
      </Text>
    </View>
    <Ionicons
      name={item.isExternal ? 'open-outline' : 'chevron-forward'}
      size={18}
      color={isDark ? AURA.gray500 : AURA.gray400}
    />
  </TouchableOpacity>
);

/* ═══════════════════════════════════════════════════════════════════════
   FeatureCard / FeatureRow
   ═══════════════════════════════════════════════════════════════════════ */

const FeatureCard: React.FC<{
  feature: FeatureItem;
  index: number;
  isDark: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}> = ({ feature, index, isDark, reduceMotion, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    onPress={onPress}
    style={styles.featureCardWrapper}
  >
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(300 + index * 60)}
      style={[
        styles.featureCard,
        isDark && styles.featureCardDark,
        { borderColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.04)' },
      ]}
    >
      <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
        <Ionicons name={feature.icon} size={24} color={feature.color} />
      </View>
      <Text style={[styles.featureTitle, isDark && styles.featureTitleDark]}>
        {feature.title}
      </Text>
      <Text style={[styles.featureDesc, isDark && styles.featureDescDark]}>
        {feature.desc}
      </Text>
      {feature.route && (
        <View style={[styles.featureArrow, { backgroundColor: `${feature.color}12` }]}>
          <Ionicons name="arrow-forward" size={14} color={feature.color} />
        </View>
      )}
    </Animated.View>
  </TouchableOpacity>
);

const FeatureRow: React.FC<{
  features: [FeatureItem, FeatureItem] | [FeatureItem];
  startIndex: number;
  isDark: boolean;
  reduceMotion: boolean;
  onPressFeature: (feature: FeatureItem) => void;
}> = ({ features, startIndex, isDark, reduceMotion, onPressFeature }) => (
  <View style={styles.featureRow}>
    {features.map((feature, i) => (
      <FeatureCard
        key={feature.title}
        feature={feature}
        index={startIndex + i}
        isDark={isDark}
        reduceMotion={reduceMotion}
        onPress={() => onPressFeature(feature)}
      />
    ))}
    {features.length === 1 && <View style={styles.featureCardWrapper} />}
  </View>
);

/* ═══════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════ */

export default function AboutScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion, avatar } = useCustomization();
  const { colors, isDark: appIsDark } = useApp();
  const { user } = useAuth();
  const { sweetAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const isDark = darkMode ?? appIsDark;
  const primary = themeColors?.primary || colors.primary || AURA.primary;
  const secondary = themeColors?.secondary || colors.accent || AURA.accent;

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('tracker_entries').select('id').limit(1);
        setIsSupabaseConnected(!error);
      } catch {
        setIsSupabaseConnected(false);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    try {
      setAppVersion(packageJson.version || '1.0.0');
    } catch {
      /* package.json not available */
    }
  }, []);

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        sweetAlert({
          title: 'Cannot Open Link',
          message: `Unable to open ${url}`,
          type: 'warning',
          confirmText: 'OK',
        });
      }
    } catch (error) {
      console.warn('Failed to open link:', error);
    }
  };

  const handleHaptic = (style: 'light' | 'medium' | 'success' = 'light') => {
    if (!reduceMotion) {
      const hapticStyle = style === 'success'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(hapticStyle).catch(() => {});
    }
  };

  const handleFeaturePress = (feature: FeatureItem) => {
    handleHaptic('light');
    if (feature.route) {
      navigation.navigate(feature.route as any, feature.params);
    }
  };

  const handleShareApp = async () => {
    handleHaptic('medium');
    try {
      await Share.share({
        message: `Check out LittleLoom - the best baby tracking app! 🍼\n\nVersion ${appVersion}\nDownload now: https://littleloom.app/download`,
        title: 'LittleLoom Baby Tracker',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const serviceLinks: ServiceLink[] = [
    {
      icon: 'document-text-outline',
      title: 'Privacy Policy',
      subtitle: 'How we protect your data',
      route: 'PrivacyPolicy',
      color: primary,
      isExternal: false,
    },
    {
      icon: 'reader-outline',
      title: 'Terms of Service',
      subtitle: 'Legal terms and conditions',
      url: 'https://littleloom.app/terms',
      color: secondary,
      isExternal: true,
    },
    {
      icon: 'cloud-outline',
      title: 'Cloud Status',
      subtitle: isSupabaseConnected ? 'Connected to Supabase' : 'Offline mode',
      url: 'https://status.littleloom.app',
      color: isSupabaseConnected ? AURA.success : AURA.warning,
      isExternal: true,
    },
    {
      icon: 'globe-outline',
      title: 'Website',
      subtitle: 'Visit our official website',
      url: 'https://littleloom.app',
      color: AURA.info,
      isExternal: true,
    },
    {
      icon: 'logo-github',
      title: 'Open Source',
      subtitle: 'Contribute on GitHub',
      url: 'https://github.com/littleloom',
      color: AURA.gray900,
      isExternal: true,
    },
    {
      icon: 'mail-outline',
      title: 'Contact Support',
      subtitle: 'Get help from our team',
      route: 'ContactSupport',
      color: AURA.success,
      isExternal: false,
    },
    {
      icon: 'star-outline',
      title: 'Rate the App',
      subtitle: 'Share your feedback',
      url: 'https://littleloom.app/review',
      color: AURA.warning,
      isExternal: true,
    },
  ];

  const handleLinkPress = (item: ServiceLink) => {
    handleHaptic('light');
    if (item.route) {
      navigation.navigate(item.route as any);
    } else if (item.url) {
      openLink(item.url);
    }
  };

  const featurePairs: (FeatureItem[] | [FeatureItem])[] = [];
  for (let i = 0; i < FEATURES.length; i += 2) {
    if (i + 1 < FEATURES.length) {
      featurePairs.push([FEATURES[i], FEATURES[i + 1]]);
    } else {
      featurePairs.push([FEATURES[i]]);
    }
  }

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || AURA.darkBg, themeColors?.colors?.[1] || '#1a1428', themeColors?.colors?.[2] || AURA.darkBg]
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
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
            About
          </Text>
          <TouchableOpacity
            onPress={handleShareApp}
            style={[
              styles.shareButton,
              { backgroundColor: isDark ? AURA.darkCard : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <Ionicons name="share-outline" size={22} color={isDark ? AURA.white : AURA.gray900} />
          </TouchableOpacity>
        </Animated.View>

        {/* ─── App Logo / Brand ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.logoSection}
        >
          <BlurView
            intensity={isDark ? 40 : 90}
            style={styles.logoCard}
            tint={isDark ? 'dark' : 'light'}
          >
            <View
              style={[
                styles.logoContainer,
                {
                  backgroundColor: `${AURA.primary}20`,
                  borderColor: `${AURA.primary}40`,
                },
              ]}
            >
              <SafeAvatar
                uri={avatar}
                fallbackEmoji="🧵"
                size={48}
                style={styles.safeAvatar}
              />
            </View>
            <Text style={[styles.appName, isDark && styles.appNameDark]}>
              LittleLoom
            </Text>
            <Text style={[styles.version, isDark && styles.versionDark]}>
              Version {appVersion}
            </Text>
            <Text style={[styles.tagline, isDark && styles.taglineDark]}>
              Weaving together the precious moments of parenthood
            </Text>
            {isSupabaseConnected && (
              <View style={[styles.cloudBadge, { backgroundColor: `${AURA.success}15` }]}>
                <View style={[styles.cloudDot, { backgroundColor: AURA.success }]} />
                <Text style={[styles.cloudText, { color: AURA.success }]}>
                  Connected to Supabase
                </Text>
              </View>
            )}
          </BlurView>
        </Animated.View>

        {/* ─── Features Grid ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="grid-outline"
            title="Features"
            color={AURA.primary}
            isDark={isDark}
          />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.featuresContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.featuresGrid}>
              {featurePairs.map((pair, rowIndex) => (
                <FeatureRow
                  key={rowIndex}
                  features={pair as [FeatureItem, FeatureItem] | [FeatureItem]}
                  startIndex={rowIndex * 2}
                  isDark={isDark}
                  reduceMotion={reduceMotion}
                  onPressFeature={handleFeaturePress}
                />
              ))}
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── Social Links ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(400)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="share-social-outline"
            title="Connect With Us"
            color={AURA.info}
            isDark={isDark}
          />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.socialContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.socialGrid}>
              {SOCIAL_LINKS.map((social) => (
                <TouchableOpacity
                  key={social.label}
                  style={[
                    styles.socialItem,
                    isDark && styles.socialItemDark,
                    { borderColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.04)' },
                  ]}
                  onPress={() => {
                    handleHaptic('light');
                    openLink(social.url);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.socialIcon, { backgroundColor: `${social.color}15` }]}>
                    <Ionicons name={social.icon} size={24} color={social.color} />
                  </View>
                  <Text style={[styles.socialLabel, isDark && styles.socialLabelDark]}>
                    {social.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── Team ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(500)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="people-outline"
            title="Team"
            color={AURA.secondary}
            isDark={isDark}
          />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.teamContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            {TEAM.map((member, i) => (
              <View
                key={i}
                style={[
                  styles.teamCard,
                  isDark && styles.teamCardDark,
                  { borderColor: isDark ? AURA.darkBorder : 'rgba(0,0,0,0.04)' },
                ]}
              >
                <View style={[styles.teamAvatar, { backgroundColor: `${AURA.primary}15` }]}>
                  <Text style={styles.teamEmoji}>{member.emoji}</Text>
                </View>
                <View style={styles.teamInfo}>
                  <Text style={[styles.teamName, isDark && styles.teamNameDark]}>
                    {member.name}
                  </Text>
                  <Text style={[styles.teamRole, isDark && styles.teamRoleDark]}>
                    {member.role}
                  </Text>
                </View>
              </View>
            ))}
          </BlurView>
        </Animated.View>

        {/* ─── Service Links ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(600)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="link-outline"
            title="Links & Services"
            color={AURA.info}
            isDark={isDark}
          />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.linksContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            {serviceLinks.map((item, i) => (
              <React.Fragment key={item.title}>
                <ServiceLinkItem
                  item={item}
                  isDark={isDark}
                  primaryColor={primary}
                  onPress={() => handleLinkPress(item)}
                />
                {i < serviceLinks.length - 1 && (
                  <View style={[styles.divider, isDark && styles.dividerDark]} />
                )}
              </React.Fragment>
            ))}
          </BlurView>
        </Animated.View>

        {/* ─── Copyright ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(700)}
          style={styles.copyright}
        >
          <View style={[styles.appIconContainer, isDark && styles.appIconContainerDark]}>
            <SafeAvatar
              uri={avatar}
              fallbackEmoji="🧵"
              size={32}
              style={styles.safeAvatarSmall}
            />
          </View>
          <Text style={[styles.copyrightText, isDark && styles.copyrightTextDark]}>
            {'\u00A9 2026 LittleLoom. All rights reserved.'}
          </Text>
          <View style={styles.madeWithLove}>
            <Ionicons name="heart" size={12} color={AURA.accent} />
            <Text style={[styles.madeWithText, isDark && styles.madeWithTextDark]}>
              {' Made with love for parents everywhere'}
            </Text>
          </View>
          {user && (
            <Text style={[styles.userInfo, isDark && styles.userInfoDark]}>
              Signed in as {user.email}
            </Text>
          )}
        </Animated.View>
      </Animated.ScrollView>
    </LinearGradient>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Styles (structure unchanged, Aura values now flow through)
   ═══════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: AURA.gray900,
    letterSpacing: -0.5,
  },
  headerTitleDark: { color: AURA.white },

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

  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoCard: {
    width: '100%',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  safeAvatar: {
    width: 48,
    height: 48,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: AURA.gray900,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appNameDark: { color: AURA.white },
  version: {
    fontSize: 14,
    color: AURA.gray400,
    fontWeight: '600',
    marginBottom: 8,
  },
  versionDark: { color: AURA.gray400 },
  tagline: {
    fontSize: 14,
    color: AURA.gray500,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 280,
    lineHeight: 20,
  },
  taglineDark: { color: AURA.gray400 },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  cloudDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cloudText: {
    fontSize: 13,
    fontWeight: '600',
  },

  featuresContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  featuresGrid: {
    gap: CARD_GAP,
  },
  featureRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    justifyContent: 'space-between',
  },
  featureCardWrapper: {
    width: CARD_WIDTH,
  },
  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    width: '100%',
  },
  featureCardDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AURA.gray900,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureTitleDark: { color: AURA.white },
  featureDesc: {
    fontSize: 12,
    color: AURA.gray500,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  featureDescDark: { color: AURA.gray400 },
  featureArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  socialContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
  },
  socialItemDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AURA.gray900,
  },
  socialLabelDark: { color: AURA.white },

  teamContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  teamCardDark: {
    backgroundColor: 'rgba(41,37,36,0.4)',
  },
  teamAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  teamEmoji: { fontSize: 24 },
  teamInfo: { flex: 1 },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: AURA.gray900,
    marginBottom: 2,
  },
  teamNameDark: { color: AURA.white },
  teamRole: {
    fontSize: 13,
    color: AURA.gray500,
    fontWeight: '500',
  },
  teamRoleDark: { color: AURA.gray400 },

  linksContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  linkItemDark: {},
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  linkTextContainer: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AURA.gray900,
    letterSpacing: -0.2,
  },
  linkTitleDark: { color: AURA.white },
  linkSubtitle: {
    fontSize: 13,
    color: AURA.gray500,
    marginTop: 3,
    fontWeight: '500',
  },
  linkSubtitleDark: { color: AURA.gray400 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 80,
  },
  dividerDark: {
    backgroundColor: AURA.darkBorder,
  },

  copyright: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    gap: 12,
  },
  appIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: `${AURA.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${AURA.primary}20`,
  },
  appIconContainerDark: {
    backgroundColor: `${AURA.primary}15`,
    borderColor: `${AURA.primary}25`,
  },
  safeAvatarSmall: {
    width: 32,
    height: 32,
  },
  copyrightText: {
    fontSize: 12,
    color: AURA.gray400,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  copyrightTextDark: { color: AURA.gray500 },
  madeWithLove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  madeWithText: {
    fontSize: 12,
    color: AURA.gray400,
    fontWeight: '600',
  },
  madeWithTextDark: { color: AURA.gray500 },
  userInfo: {
    fontSize: 11,
    color: AURA.gray400,
    fontWeight: '500',
    marginTop: 4,
  },
  userInfoDark: { color: AURA.gray500 },
});