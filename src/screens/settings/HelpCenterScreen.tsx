import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpCenter'>;

const { width } = Dimensions.get('window');

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
    ],
  },
  {
    category: 'Data & Privacy',
    icon: 'shield-checkmark-outline',
    color: '#fa709a',
    items: [
      { q: 'Is my data backed up?', a: 'Data is stored locally. Use Backup & Restore in Settings to create shareable backups.' },
      { q: 'Can I export my data?', a: 'Yes, the backup file is standard JSON — readable by you, portable to any device.' },
      { q: 'Who can see my data?', a: 'Only people you invite to Family Dashboard. We never upload your data to servers.' },
    ],
  },
  {
    category: 'Account',
    icon: 'person-outline',
    color: '#fee140',
    items: [
      { q: 'How do I reset my PIN?', a: 'Settings → Security → PIN Code → Change PIN. You\'ll need your current PIN.' },
      { q: 'I forgot my PIN. What now?', a: "You'll need to reinstall the app and restore from backup. We can't reset PINs for security." },
      { q: 'How do I delete my account?', a: 'Settings → Support → Contact Us and request deletion. All data will be permanently removed.' },
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
    route: 'Reminders',
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
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleTipPress = (tip: TipItem) => {
    handleHaptic();
    if (tip.route) {
      navigation.navigate(tip.route as any, tip.params);
    }
  };

  const filteredFaqs = searchQuery
    ? FAQS.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)
    : FAQS;

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AutoHideScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
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
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Help Center</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Find answers and learn how to use LittleLoom
          </Text>
        </Animated.View>

        {/* Search */}
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
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={isDark ? '#666' : '#999'} />
              </TouchableOpacity>
            )}
          </BlurView>
        </Animated.View>

        {/* Quick Tips — Now Navigable */}
        {!searchQuery && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(300)}
            style={styles.sectionWrapper}
          >
            <SectionHeader icon="bulb-outline" title="Quick Tips" color="#f59e0b" isDark={isDark} />
            <AutoHideScrollView
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
            </AutoHideScrollView>
          </Animated.View>
        )}

        {/* FAQ Categories */}
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
                onPress={() => {
                  handleHaptic();
                  setExpandedCategory(
                    expandedCategory === category.category ? null : category.category
                  );
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}15` }]}>
                  <Ionicons name={category.icon as any} size={20} color={category.color} />
                </View>
                <Text style={[styles.categoryTitle, isDark && styles.categoryTitleDark]}>{category.category}</Text>
                <Ionicons
                  name={expandedCategory === category.category ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={isDark ? '#666' : '#999'}
                />
              </TouchableOpacity>

              {expandedCategory === category.category && category.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => {
                      handleHaptic();
                      setExpandedFaq(expandedFaq === `${catIndex}-${itemIndex}` ? null : `${catIndex}-${itemIndex}`);
                    }}
                  >
                    <Text style={[styles.faqQText, isDark && styles.faqQTextDark]}>{item.q}</Text>
                    <Ionicons
                      name={expandedFaq === `${catIndex}-${itemIndex}` ? 'remove' : 'add'}
                      size={20}
                      color={primary}
                    />
                  </TouchableOpacity>

                  {expandedFaq === `${catIndex}-${itemIndex}` && (
                    <View style={styles.faqAnswer}>
                      <Text style={[styles.faqAText, isDark && styles.faqATextDark]}>{item.a}</Text>
                    </View>
                  )}
                </View>
              ))}
            </BlurView>
          ))}
        </Animated.View>

        {/* Contact Support CTA */}
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
                handleHaptic();
                navigation.navigate('ContactSupport');
              }}
            >
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </AutoHideScrollView>
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
