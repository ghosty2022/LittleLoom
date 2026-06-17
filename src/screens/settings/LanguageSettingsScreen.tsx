import { useSweetAlert } from '../../components/SweetAlert';
import React, { useState } from 'react';
import {  Alert, Button, ScrollView, Settings, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSettings'>;

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  region: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', region: 'United States' },
  { code: 'en-gb', name: 'English', flag: '🇬🇧', region: 'United Kingdom' },
  { code: 'es', name: 'Español', flag: '🇪🇸', region: 'Spanish' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', region: 'French' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', region: 'German' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', region: 'Italian' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', region: 'Portuguese' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', region: 'Dutch' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪', region: 'Swedish' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', region: 'Japanese' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', region: 'Korean' },
  { code: 'zh', name: '中文', flag: '🇨🇳', region: 'Chinese (Simplified)' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', region: 'Arabic' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', region: 'Hindi' },
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

export default function LanguageSettingsScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';

  const [selected, setSelected] = useState('en');

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleSelect = (code: string) => {
    if (code === selected) return;
    handleHaptic();
    setSelected(code);

    sweetAlert.alert('Language Changed', 'App restart required to apply the new language. This feature will be fully implemented in a future update.', 'info');
  };

  const selectedLanguage = LANGUAGES.find(l => l.code === selected);

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AutoHideAnimatedScrollView
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
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Language</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Choose your preferred language
          </Text>
        </Animated.View>

        {/* Current */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="checkmark-circle-outline" title="Currently Selected" color={primary} isDark={isDark} />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={[styles.currentCard, { borderColor: `${primary}26` }]}
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.currentLang}>
              <Text style={styles.currentFlag}>{selectedLanguage?.flag}</Text>
              <View>
                <Text style={[styles.currentName, isDark && styles.currentNameDark]}>
                  {selectedLanguage?.name}
                </Text>
                <Text style={[styles.currentRegion, isDark && styles.currentRegionDark]}>
                  {selectedLanguage?.region}
                </Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Language List */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="language-outline" title="All Languages" color="#4facfe" isDark={isDark} />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.listContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            {LANGUAGES.map((lang, i) => (
              <React.Fragment key={lang.code}>
                <TouchableOpacity
                  style={[
                    styles.langItem,
                    selected === lang.code && [
                      styles.langItemActive,
                      { borderColor: `${primary}4D`, backgroundColor: `${primary}14` },
                    ],
                    isDark && styles.langItemDark,
                    selected === lang.code && isDark && [
                      styles.langItemActiveDark,
                      { borderColor: `${primary}33`, backgroundColor: `${primary}1A` },
                    ],
                  ]}
                  onPress={() => handleSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <View style={styles.langInfo}>
                    <Text style={[styles.langName, isDark && styles.langNameDark]}>{lang.name}</Text>
                    <Text style={[styles.langRegion, isDark && styles.langRegionDark]}>{lang.region}</Text>
                  </View>
                  {selected === lang.code && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={primary} />
                    </View>
                  )}
                </TouchableOpacity>
                {i < LANGUAGES.length - 1 && (
                  <View style={[styles.divider, isDark && styles.dividerDark]} />
                )}
              </React.Fragment>
            ))}
          </BlurView>
        </Animated.View>

        {/* Note */}
        <Text style={[styles.note, isDark && styles.noteDark]}>
          More languages coming soon. Contact us if you'd like to help translate LittleLoom.
        </Text>
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

  currentCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 20,
  },
  currentLang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  currentFlag: { fontSize: 32 },
  currentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  currentNameDark: { color: '#fff' },
  currentRegion: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    marginTop: 2,
  },
  currentRegionDark: { color: '#888' },

  listContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  langItemDark: {},
  langItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
    backgroundColor: 'rgba(102,126,234,0.08)',
  },
  langItemActiveDark: {
    borderColor: 'rgba(102,126,234,0.2)',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  langFlag: { fontSize: 28, marginRight: 14 },
  langInfo: { flex: 1 },
  langName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  langNameDark: { color: '#fff' },
  langRegion: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginTop: 2,
  },
  langRegionDark: { color: '#888' },
  checkmark: {
    width: 32,
    alignItems: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 66,
  },
  dividerDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  note: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 8,
  },
  noteDark: { color: '#666' },
});
