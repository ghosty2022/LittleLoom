// screens/settings/LanguageSettingsScreen.tsx
import { useSweetAlert } from '../../components/SweetAlert';
import React, { useState, useCallback, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import { useSupabase } from '../../hooks/useSupabase';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSettings'>;

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  region: string;
  nativeName?: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', region: 'United States', nativeName: 'English' },
  { code: 'en-gb', name: 'English', flag: '🇬🇧', region: 'United Kingdom', nativeName: 'English' },
  { code: 'es', name: 'Español', flag: '🇪🇸', region: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', region: 'French', nativeName: 'Français' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', region: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', region: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', region: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', region: 'Dutch', nativeName: 'Nederlands' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪', region: 'Swedish', nativeName: 'Svenska' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', region: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', region: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: '中文', flag: '🇨🇳', region: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', region: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', region: 'Hindi', nativeName: 'हिन्दी' },
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
  const { alert: showAlert } = useSweetAlert();
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const { user, isConnected, supabase } = useSupabase();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';

  const [selected, setSelected] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference
  useEffect(() => {
    const loadLanguage = async () => {
      if (isConnected && user) {
        try {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('language')
            .eq('user_id', user.id)
            .single();

          if (data?.language) {
            setSelected(data.language);
          }
        } catch (e) {
          console.warn('Failed to load language:', e);
        }
      }
      setIsLoading(false);
    };
    loadLanguage();
  }, [isConnected, user]);

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleSelect = useCallback(async (code: string) => {
    if (code === selected || isSaving) return;
    handleHaptic();

    setIsSaving(true);
    setSelected(code);

    try {
      // Save to Supabase if connected
      if (isConnected && user) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            language: code,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) throw error;
      }

      showAlert(
        'Language Changed',
        `App language set to ${LANGUAGES.find(l => l.code === code)?.name}. Please restart the app for changes to take effect.`,
        'info'
      );
    } catch (error) {
      console.error('Failed to save language:', error);
      showAlert('Error', 'Failed to save language preference. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selected, isSaving, isConnected, user, supabase, showAlert]);

  const selectedLanguage = LANGUAGES.find(l => l.code === selected);

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  if (isLoading) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniversalSpinner size={32} color={primary} variant="liquid" section="settings" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading languages...
          </Text>
        </View>
      </LinearGradient>
    );
  }

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

        {/* ─── Cloud Sync Status ─── */}
        {isConnected && (
          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(150)}>
            <View style={[styles.cloudBadge, { backgroundColor: `${primary}15` }]}>
              <Ionicons name="cloud-outline" size={16} color={primary} />
              <Text style={[styles.cloudText, { color: primary }]}>
                Preferences synced to cloud
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── Current Selection ─── */}
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
                {selectedLanguage?.nativeName && selectedLanguage.nativeName !== selectedLanguage.name && (
                  <Text style={[styles.currentNative, isDark && styles.currentNativeDark]}>
                    {selectedLanguage.nativeName}
                  </Text>
                )}
              </View>
              {isSaving && (
                <View style={styles.savingBadge}>
                  <UniversalSpinner size={16} color={primary} variant="liquid" section="settings" />
                </View>
              )}
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── Language List ─── */}
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
                    isSaving && selected === lang.code && styles.langItemSaving,
                  ]}
                  onPress={() => handleSelect(lang.code)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <View style={styles.langInfo}>
                    <Text style={[styles.langName, isDark && styles.langNameDark]}>
                      {lang.name}
                    </Text>
                    <Text style={[styles.langRegion, isDark && styles.langRegionDark]}>
                      {lang.region}
                    </Text>
                    {lang.nativeName && lang.nativeName !== lang.name && (
                      <Text style={[styles.langNative, isDark && styles.langNativeDark]}>
                        {lang.nativeName}
                      </Text>
                    )}
                  </View>
                  {selected === lang.code ? (
                    <View style={[styles.checkmark, { backgroundColor: primary }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
                  )}
                </TouchableOpacity>
                {i < LANGUAGES.length - 1 && (
                  <View style={[styles.divider, isDark && styles.dividerDark]} />
                )}
              </React.Fragment>
            ))}
          </BlurView>
        </Animated.View>

        {/* ─── Note ─── */}
        <Text style={[styles.note, isDark && styles.noteDark]}>
          More languages coming soon. Contact us if you'd like to help translate LittleLoom.
        </Text>

        {/* ─── Restart Required ─── */}
        {isConnected && (
          <View style={[styles.restartBanner, { backgroundColor: `${primary}10` }]}>
            <Ionicons name="information-circle" size={20} color={primary} />
            <Text style={[styles.restartText, { color: primary }]}>
              Changes require app restart to take full effect
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  loadingTextDark: { color: '#94a3b8' },

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

  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 20,
    gap: 8,
    alignSelf: 'flex-start',
  },
  cloudText: {
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
  currentNative: {
    fontSize: 13,
    color: '#aaa',
    fontWeight: '400',
    marginTop: 1,
  },
  currentNativeDark: { color: '#666' },
  savingBadge: {
    marginLeft: 'auto',
  },

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
  langItemSaving: {
    opacity: 0.7,
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
    marginTop: 1,
  },
  langRegionDark: { color: '#888' },
  langNative: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '400',
    marginTop: 1,
  },
  langNativeDark: { color: '#666' },
  checkmark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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

  restartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginTop: 16,
    gap: 10,
  },
  restartText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});