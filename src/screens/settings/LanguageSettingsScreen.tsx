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

/* ─── AURA DS ────────────────────────────────────────────────────── */
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
  const { sweetAlert } = useSweetAlert();
  const { themeColors, darkMode, reduceMotion, updateSettings } = useCustomization();
  const { user, isConnected, supabase } = useSupabase();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || AURA.primary;

  const [selected, setSelected] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [isConnected, user, supabase]);

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
      await updateSettings({ language: code as any });

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

      sweetAlert({
        title: 'Language Changed',
        message: `App language set to ${LANGUAGES.find(l => l.code === code)?.name}. Please restart the app for changes to take effect.`,
        type: 'info',
        confirmText: 'OK',
      });
    } catch (error) {
      console.error('Failed to save language:', error);
      sweetAlert({
        title: 'Error',
        message: 'Failed to save language preference. Please try again.',
        type: 'error',
        confirmText: 'OK',
      });
    } finally {
      setIsSaving(false);
    }
  }, [selected, isSaving, isConnected, user, supabase, updateSettings, sweetAlert]);

  const selectedLanguage = LANGUAGES.find(l => l.code === selected);

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || AURA.darkBg, themeColors?.colors?.[1] || '#1a1428', themeColors?.colors?.[2] || AURA.darkBg]
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#eef0ff', themeColors?.colors?.[2] || '#e2e5ff'];

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
              handleHaptic();
              navigation.goBack();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? AURA.white : AURA.gray900} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Language</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Choose your preferred language
          </Text>
        </Animated.View>

        {isConnected && (
          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(150)}>
            <View style={[styles.cloudBadge, { backgroundColor: `${AURA.success}15` }]}>
              <Ionicons name="cloud-outline" size={16} color={AURA.success} />
              <Text style={[styles.cloudText, { color: AURA.success }]}>
                Preferences synced to cloud
              </Text>
            </View>
          </Animated.View>
        )}

        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="checkmark-circle-outline"
            title="Currently Selected"
            color={AURA.primary}
            isDark={isDark}
          />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={[styles.currentCard, { borderColor: `${AURA.primary}26` }]}
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
                  <UniversalSpinner size={16} color={AURA.primary} variant="liquid" section="settings" />
                </View>
              )}
            </View>
          </BlurView>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.sectionWrapper}
        >
          <SectionHeader
            icon="language-outline"
            title="All Languages"
            color={AURA.info}
            isDark={isDark}
          />
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
                      { borderColor: `${AURA.primary}4D`, backgroundColor: `${AURA.primary}14` },
                    ],
                    isDark && styles.langItemDark,
                    selected === lang.code && isDark && [
                      styles.langItemActiveDark,
                      { borderColor: `${AURA.primary}33`, backgroundColor: `${AURA.primary}1A` },
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
                    <View style={[styles.checkmark, { backgroundColor: AURA.primary }]}>
                      <Ionicons name="checkmark" size={16} color={AURA.white} />
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? AURA.gray500 : AURA.gray300}
                    />
                  )}
                </TouchableOpacity>
                {i < LANGUAGES.length - 1 && (
                  <View style={[styles.divider, isDark && styles.dividerDark]} />
                )}
              </React.Fragment>
            ))}
          </BlurView>
        </Animated.View>

        <Text style={[styles.note, isDark && styles.noteDark]}>
          More languages coming soon. Contact us if you'd like to help translate LittleLoom.
        </Text>

        {isConnected && (
          <View style={[styles.restartBanner, { backgroundColor: `${AURA.info}10` }]}>
            <Ionicons name="information-circle" size={20} color={AURA.info} />
            <Text style={[styles.restartText, { color: AURA.info }]}>
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

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '500', color: AURA.gray500 },
  loadingTextDark: { color: AURA.gray400 },

  header: { marginBottom: 24 },
  backButton: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32, fontWeight: '800', color: AURA.gray900,
    letterSpacing: -0.5, marginBottom: 6,
  },
  headerTitleDark: { color: AURA.white },
  headerSubtitle: { fontSize: 15, color: AURA.gray500, fontWeight: '500' },
  headerSubtitleDark: { color: AURA.gray400 },

  cloudBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    marginBottom: 20, gap: 8, alignSelf: 'flex-start',
  },
  cloudText: { fontSize: 13, fontWeight: '600' },

  sectionWrapper: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4, marginBottom: 8,
  },
  sectionIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: AURA.gray900, letterSpacing: -0.3 },
  sectionTitleDark: { color: AURA.white },

  currentCard: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 20,
  },
  currentLang: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  currentFlag: { fontSize: 32 },
  currentName: { fontSize: 18, fontWeight: '700', color: AURA.gray900 },
  currentNameDark: { color: AURA.white },
  currentRegion: { fontSize: 14, color: AURA.gray500, fontWeight: '500', marginTop: 2 },
  currentRegionDark: { color: AURA.gray400 },
  currentNative: { fontSize: 13, color: AURA.gray400, fontWeight: '400', marginTop: 1 },
  currentNativeDark: { color: AURA.gray500 },
  savingBadge: { marginLeft: 'auto' },

  listContainer: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  langItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'transparent',
  },
  langItemDark: {},
  langItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  langItemActiveDark: {
    borderColor: 'rgba(99,102,241,0.2)',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  langItemSaving: { opacity: 0.7 },
  langFlag: { fontSize: 28, marginRight: 14 },
  langInfo: { flex: 1 },
  langName: { fontSize: 16, fontWeight: '600', color: AURA.gray900 },
  langNameDark: { color: AURA.white },
  langRegion: { fontSize: 13, color: AURA.gray500, fontWeight: '500', marginTop: 1 },
  langRegionDark: { color: AURA.gray400 },
  langNative: { fontSize: 12, color: AURA.gray400, fontWeight: '400', marginTop: 1 },
  langNativeDark: { color: AURA.gray500 },
  checkmark: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.04)', marginLeft: 66 },
  dividerDark: { backgroundColor: AURA.darkBorder },

  note: {
    fontSize: 13, color: AURA.gray500, textAlign: 'center',
    fontWeight: '500', lineHeight: 20, marginTop: 8,
  },
  noteDark: { color: AURA.gray400 },

  restartBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, marginTop: 16, gap: 10,
  },
  restartText: { flex: 1, fontSize: 13, fontWeight: '500' },
});