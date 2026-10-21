import React, { useState, useCallback, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import { useSupabase } from '../../hooks/useSupabase';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSettings'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5',
  accent: '#ec4899', accentLight: '#f472b6', secondary: '#8b5cf6',
  success: '#10b981', warning: '#f59e0b', info: '#0ea5e9', danger: '#ef4444',
  white: '#ffffff', gray50: '#fafaf9', gray100: '#f5f5f4', gray200: '#e7e5e4',
  gray300: '#d6d3d1', gray400: '#a8a29e', gray500: '#78716c',
  gray600: '#57534e', gray700: '#44403c', gray800: '#292524', gray900: '#1c1917',
  darkBg: '#0c0a09', darkSurface: '#1c1917', darkCard: '#292524', darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
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

/* ═══════════════════════════════════════════════════════════════════════════
   AURA SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
  </View>
));

/* ─── Language Capsule ─── */
const LanguageCapsule = React.memo<any>(({ isDark, selectedLanguage, isConnected, isSaving }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.info}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <View style={styles.avatarWrap}>
            <Animated.View style={[styles.avatarGlow, glowStyle]} />
            <Animated.View style={[styles.avatarRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.info, DS.accent, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Text style={{ fontSize: 32 }}>{selectedLanguage?.flag || '🌐'}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {selectedLanguage?.name}
            </Text>
            <Text style={[styles.capsuleSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {selectedLanguage?.region}
            </Text>
            {selectedLanguage?.nativeName && selectedLanguage.nativeName !== selectedLanguage.name && (
              <Text style={[styles.capsuleNative, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                Native: {selectedLanguage.nativeName}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {isConnected && (
                <View style={[styles.statusPill, { backgroundColor: `${DS.success}15` }]}>
                  <View style={[styles.statusDot, { backgroundColor: DS.success }]} />
                  <Text style={[styles.statusText, { color: DS.success }]}>Synced</Text>
                </View>
              )}
              {isSaving && (
                <View style={[styles.statusPill, { backgroundColor: `${DS.primary}15` }]}>
                  <UniversalSpinner size={10} color={DS.primary} variant="liquid" section="settings" />
                  <Text style={[styles.statusText, { color: DS.primary }]}>Saving</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Insight Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
        <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
      </View>
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LanguageSettingsScreen({ navigation }: Props) {
  const { sweetAlert } = useSweetAlert();
  const { themeColors, darkMode, reduceMotion, updateSettings } = useCustomization();
  const { user, isConnected, supabase } = useSupabase();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || DS.primary;

  const [selected, setSelected] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    const loadLanguage = async () => {
      if (isConnected && user) {
        try {
          const { data } = await supabase.from('user_preferences').select('language').eq('user_id', user.id).single();
          if (data?.language) setSelected(data.language);
        } catch (e) { console.warn('Failed to load language:', e); }
      }
      setIsLoading(false);
    };
    loadLanguage();
  }, [isConnected, user, supabase]);

  const handleHaptic = () => {
    if (!reduceMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleSelect = useCallback(async (code: string) => {
    if (code === selected || isSaving) return;
    handleHaptic();
    setIsSaving(true);
    setSelected(code);
    try {
      await updateSettings({ language: code as any });
      if (isConnected && user) {
        const { error } = await supabase.from('user_preferences').upsert({
          user_id: user.id, language: code, updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      sweetAlert({
        title: 'Language Changed',
        message: `App language set to ${LANGUAGES.find(l => l.code === code)?.name}. Restart app for changes to take effect.`,
        type: 'info', confirmText: 'OK',
      });
    } catch (error) {
      console.error('Failed to save language:', error);
      sweetAlert({ title: 'Error', message: 'Failed to save language preference. Please try again.', type: 'error', confirmText: 'OK' });
    } finally { setIsSaving(false); }
  }, [selected, isSaving, isConnected, user, supabase, updateSettings, sweetAlert]);

  const selectedLanguage = LANGUAGES.find(l => l.code === selected);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <UniversalSpinner size={32} color={primary} variant="liquid" section="settings" />
        <Text style={{ color: isDark ? DS.gray400 : DS.gray500, fontSize: 13, fontWeight: '600' }}>Loading languages…</Text>
      </View>
    );
  }

  const topRibbon = {
    icon: (isConnected ? 'cloud-done-outline' : 'cloud-offline-outline') as any,
    color: isConnected ? DS.success : DS.warning,
    label: isConnected ? 'Cloud synced' : 'Local only',
    text: `${LANGUAGES.length} languages available · Restart to apply`,
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Language</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {selectedLanguage?.name} · {selectedLanguage?.region}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ paddingHorizontal: DS.space.lg }}>
          <LanguageCapsule isDark={isDark} selectedLanguage={selectedLanguage} isConnected={isConnected} isSaving={isSaving} />
        </View>

        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* All languages */}
        <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
          <SectionHeader title="All Languages" subtitle={`${LANGUAGES.length} available`} icon="language-outline" color={DS.info} />
          <View style={[styles.listCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            {LANGUAGES.map((lang, i) => {
              const active = selected === lang.code;
              return (
                <React.Fragment key={lang.code}>
                  <PressableScale onPress={() => handleSelect(lang.code)} disabled={isSaving} activeScale={0.98}>
                    <View style={[styles.langRow, active && { backgroundColor: `${DS.primary}10` }]}>
                      <Text style={styles.langFlag}>{lang.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.langName, { color: isDark ? DS.white : DS.gray900 }]}>{lang.name}</Text>
                        <Text style={[styles.langRegion, { color: isDark ? DS.gray400 : DS.gray500 }]}>{lang.region}</Text>
                        {lang.nativeName && lang.nativeName !== lang.name && (
                          <Text style={[styles.langNative, { color: isDark ? DS.gray500 : DS.gray400 }]}>{lang.nativeName}</Text>
                        )}
                      </View>
                      {active ? (
                        <View style={[styles.checkBadge, { backgroundColor: DS.primary }]}>
                          <Ionicons name="checkmark" size={13} color={DS.white} />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />
                      )}
                    </View>
                  </PressableScale>
                  {i < LANGUAGES.length - 1 && <View style={[styles.langDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Info banner */}
        {isConnected && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <View style={[styles.infoBanner, { backgroundColor: `${DS.info}10`, borderColor: `${DS.info}25` }]}>
              <Ionicons name="information-circle-outline" size={18} color={DS.info} />
              <Text style={[styles.infoText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                Changes require app restart to take full effect
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.note, { color: isDark ? DS.gray500 : DS.gray400 }]}>
          More languages coming soon. Contact us if you'd like to help translate LittleLoom.
        </Text>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: `${DS.primary}35` },
  avatarRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  avatarInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  capsuleName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '80%' },
  capsuleSub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  capsuleNative: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  listCard: { borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  langFlag: { fontSize: 26 },
  langName: { fontSize: 13, fontWeight: '700' },
  langRegion: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  langNative: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  langDivider: { height: StyleSheet.hairlineWidth, marginLeft: DS.space.md + 26 + DS.space.md },
  checkBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm + 2, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 15 },

  note: { fontSize: 11, fontWeight: '500', textAlign: 'center', paddingHorizontal: DS.space.lg, marginTop: DS.space.md, lineHeight: 16 },
});