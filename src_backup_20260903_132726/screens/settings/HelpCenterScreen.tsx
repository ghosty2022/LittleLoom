// screens/settings/HelpCenterScreen.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Dimensions, 
  StatusBar, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  category: string;
  icon: string;
  color: string;
  items: FaqItem[];
}

const FAQS: FaqCategory[] = [
  {
    category: 'Getting Started',
    icon: 'rocket-outline',
    color: '#667eea',
    items: [
      { q: 'How do I add my first baby?', a: 'Go to Settings → Family → Add Baby, or tap the baby icon on your profile card.' },
      { q: 'Can I track multiple babies?', a: 'Yes! Add multiple profiles and switch between them from the profile card or Switch Baby screen.' },
      { q: 'How do I invite a co-parent?', a: "Settings → Family Dashboard → Invite Co-Parent. They'll receive a link to join." },
      { q: 'What is Supabase and how does it work?', a: 'Supabase is our cloud backend that enables real-time sync, family sharing, and community features. Your data is encrypted and secure.' },
    ],
  },
  {
    category: 'Tracking',
    icon: 'analytics-outline',
    color: '#43e97b',
    items: [
      { q: 'What activities can I track?', a: 'Feeding, sleep, potty, growth measurements, medications, and milestones. Use the + button on any tab.' },
      { q: 'How do I start a sleep timer?', a: 'Go to Track → Sleep, tap "Start Sleep Session." We\'ll track the duration automatically.' },
      { q: 'Can I edit or delete an entry?', a: 'Yes, tap any entry in your timeline to edit or delete it.' },
      { q: 'Does tracking sync across devices?', a: 'With Supabase enabled, your tracking data syncs in real-time across all your devices and family members.' },
    ],
  },
  {
    category: 'Data & Privacy',
    icon: 'shield-checkmark-outline',
    color: '#fa709a',
    items: [
      { q: 'Is my data backed up?', a: 'Data is stored locally AND synced to Supabase for cloud backup. Use Backup & Restore in Settings to create manual backups.' },
      { q: 'Can I export my data?', a: 'Yes, the backup file is standard JSON — readable by you, portable to any device.' },
      { q: 'Who can see my data?', a: 'Only people you invite to Family Dashboard. All data is encrypted in transit and at rest.' },
      { q: 'Is my data safe in the cloud?', a: 'Yes! We use Supabase with row-level security, encryption, and strict access controls.' },
    ],
  },
  {
    category: 'Account & Security',
    icon: 'lock-closed-outline',
    color: '#fee140',
    items: [
      { q: 'How do I reset my PIN?', a: 'Settings → Security → PIN Code → Change PIN. You\'ll need your current PIN.' },
      { q: 'I forgot my PIN. What now?', a: "You'll need to reinstall the app and restore from backup. We can't reset PINs for security." },
      { q: 'How do I delete my account?', a: 'Settings → Support → Contact Us and request deletion. All data will be permanently removed.' },
      { q: 'What is biometric authentication?', a: 'Biometric auth uses Face ID (iOS) or Fingerprint (Android) to unlock the app securely and quickly.' },
    ],
  },
  {
    category: 'Community & Social',
    icon: 'people-outline',
    color: '#8b5cf6',
    items: [
      { q: 'What is the Community feature?', a: 'Connect with other parents, share experiences, and get support in our parenting community.' },
      { q: 'Is my community profile public?', a: 'You control your privacy settings. Choose between public, family-only, or private profiles.' },
      { q: 'How do I find other parents?', a: 'Use the search feature in Community to find parents with similar interests or in your area.' },
    ],
  },
];

interface TipItem {
  icon: string;
  title: string;
  desc: string;
  route?: keyof RootStackParamList;
  params?: any;
}

const TIPS: TipItem[] = [
  { 
    icon: 'moon', 
    title: 'Night Mode', 
    desc: 'Enable dark mode in your device settings — we follow automatically.',
    route: 'Customize',
  },
  { 
    icon: 'notifications', 
    title: 'Smart Reminders', 
    desc: 'Set feeding, sleep, and medication reminders.',
    route: 'TrackerReminders',
  },
  { 
    icon: 'trophy', 
    title: 'Achievements', 
    desc: 'Track milestones to unlock parenting achievements and streaks.',
    route: 'Achievements',
  },
  { 
    icon: 'people', 
    title: 'Family Chat', 
    desc: 'Coordinate with co-parents using the built-in family chat feature.',
    route: 'FamilyChatList',
  },
  { 
    icon: 'images', 
    title: 'Gallery', 
    desc: 'Save and organize precious photos and memories.',
    route: 'Gallery',
  },
  { 
    icon: 'color-wand', 
    title: 'Customize', 
    desc: 'Personalize themes, colors, and your app experience.',
    route: 'Customize',
  },
  { 
    icon: 'cloud', 
    title: 'Cloud Sync', 
    desc: 'Enable Supabase to sync data across devices and family members.',
    route: 'SyncSettings',
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

export default function HelpCenterScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const { sweetAlert } = useSweetAlert();
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Check Supabase connection and get user
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

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');

  const handleHaptic = (style: 'light' | 'medium' = 'light') => {
    if (!reduceMotion) {
      Haptics.impactAsync(
        style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
    }
  };

  const handleTipPress = (tip: TipItem) => {
    handleHaptic('light');
    if (tip.route) {
      navigation.navigate(tip.route as any, tip.params);
    }
  };

  const handleCategoryPress = (category: string) => {
    handleHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleFaqPress = (key: string) => {
    handleHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    
    return FAQS.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter(cat => cat.items.length > 0);
  }, [searchQuery]);

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
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
      >
        {/* ─── Header ─── */}
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
              handleHaptic('light');
              navigation.goBack();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Help Center</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Find answers and learn how to use LittleLoom
          </Text>
        </Animated.View>

        {/* ─── Connection Status ─── */}
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(150)}>
          <View style={[styles.connectionBadge, { backgroundColor: isConnected ? `${primary}15` : `${themeColors?.secondary}15` }]}>
            <Ionicons 
              name={isConnected ? 'cloud-outline' : 'cloud-offline-outline'} 
              size={16} 
              color={isConnected ? primary : themeColors?.secondary || '#fa709a'} 
            />
            <Text style={[styles.connectionText, { color: isConnected ? primary : themeColors?.secondary || '#fa709a' }]}>
              {isConnected ? 'Connected to cloud services' : 'Offline - some features may be limited'}
            </Text>
          </View>
        </Animated.View>

        {/* ─── Search ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.sectionWrapper}
        >
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.searchContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <Ionicons name="search" size={20} color={isDark ? '#666' : '#999'} />
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search help articles..."
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={isDark ? '#666' : '#999'} />
              </TouchableOpacity>
            )}
          </BlurView>
          {searchQuery.length > 0 && (
            <Text style={[styles.searchResultCount, isDark && styles.searchResultCountDark]}>
              Found {filteredFaqs.reduce((acc, cat) => acc + cat.items.length, 0)} results
            </Text>
          )}
        </Animated.View>

        {/* ─── Quick Tips ─── */}
        {!searchQuery && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(300)}
            style={styles.sectionWrapper}
          >
            <SectionHeader icon="bulb-outline" title="Quick Tips" color="#f59e0b" isDark={isDark} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tipsScroll}
            >
              {TIPS.map((tip, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => handleTipPress(tip)}
                  style={styles.tipCardWrapper}
                >
                  <View style={[styles.tipCard, isDark && styles.tipCardDark]}>
                    <View style={[styles.tipIcon, { backgroundColor: `${primary}15` }]}>
                      <Ionicons name={tip.icon as any} size={24} color={primary} />
                    </View>
                    <Text style={[styles.tipTitle, isDark && styles.tipTitleDark]}>{tip.title}</Text>
                    <Text style={[styles.tipDesc, isDark && styles.tipDescDark]} numberOfLines={2}>{tip.desc}</Text>
                    <View style={[styles.tipArrow, { backgroundColor: `${primary}12` }]}>
                      <Ionicons name="arrow-forward" size={12} color={primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ─── FAQ Categories ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(400)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="help-circle-outline" title="Frequently Asked" color={primary} isDark={isDark} />

          {filteredFaqs.map((category, catIndex) => (
            <BlurView
              key={catIndex}
              intensity={isDark ? 30 : 70}
              style={[styles.categoryCard, isDark && styles.categoryCardDark]}
              tint={isDark ? 'dark' : 'light'}
            >
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => handleCategoryPress(category.category)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}15` }]}>
                  <Ionicons name={category.icon as any} size={20} color={category.color} />
                </View>
                <Text style={[styles.categoryTitle, isDark && styles.categoryTitleDark]}>{category.category}</Text>
                <Text style={[styles.categoryCount, isDark && styles.categoryCountDark]}>
                  {category.items.length}
                </Text>
                <Ionicons
                  name={expandedCategory === category.category ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={isDark ? '#666' : '#999'}
                />
              </TouchableOpacity>

              {expandedCategory === category.category && category.items.map((item, itemIndex) => {
                const key = `${catIndex}-${itemIndex}`;
                const isExpanded = expandedFaq === key;
                return (
                  <View key={key} style={styles.faqItem}>
                    <TouchableOpacity
                      style={styles.faqQuestion}
                      onPress={() => handleFaqPress(key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.faqQText, isDark && styles.faqQTextDark]}>{item.q}</Text>
                      <Ionicons
                        name={isExpanded ? 'remove' : 'add'}
                        size={20}
                        color={primary}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <Animated.View entering={FadeInUp.delay(50)} style={styles.faqAnswer}>
                        <Text style={[styles.faqAText, isDark && styles.faqATextDark]}>{item.a}</Text>
                      </Animated.View>
                    )}
                  </View>
                );
              })}
            </BlurView>
          ))}
        </Animated.View>

        {/* ─── Contact Support CTA ─── */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(500)}
          style={styles.supportCta}
        >
          <BlurView
            intensity={isDark ? 40 : 90}
            style={styles.supportBlur}
            tint={isDark ? 'dark' : 'light'}
          >
            <Ionicons name="chatbubble-ellipses" size={32} color={primary} style={{ marginBottom: 12 }} />
            <Text style={[styles.supportTitle, isDark && styles.supportTitleDark]}>Still need help?</Text>
            <Text style={[styles.supportDesc, isDark && styles.supportDescDark]}>
              Our team is here for you. Send us a message and we'll respond within 24 hours.
            </Text>
            <TouchableOpacity
              style={[styles.supportButton, { backgroundColor: primary }]}
              onPress={() => {
                handleHaptic('medium');
                navigation.navigate('ContactSupport');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </Animated.ScrollView>
    </LinearGradient>
  );
}

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

  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    gap: 8,
    alignSelf: 'flex-start',
  },
  connectionText: {
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
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  sectionTitleDark: { color: '#ffffff' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 10,
    fontWeight: '500',
  },
  searchInputDark: { color: '#fff' },
  searchResultCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  searchResultCountDark: { color: '#888' },

  tipsScroll: { gap: 12, paddingRight: 20 },
  tipCardWrapper: {
    width: 170,
  },
  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  tipCardDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  tipTitleDark: { color: '#fff' },
  tipDesc: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  tipDescDark: { color: '#888' },
  tipArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  categoryCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryCardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  categoryTitleDark: { color: '#fff' },
  categoryCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginRight: 8,
  },
  categoryCountDark: { color: '#666' },

  faqItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 68,
  },
  faqQText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 20,
  },
  faqQTextDark: { color: '#fff' },
  faqAnswer: {
    paddingHorizontal: 68,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '500',
  },
  faqATextDark: { color: '#a0a0a0' },

  supportCta: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
  },
  supportBlur: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  supportTitleDark: { color: '#fff' },
  supportDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  supportDescDark: { color: '#a0a0a0' },
  supportButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});