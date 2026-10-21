import React, { useState, useCallback, useEffect } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import { useSupabase } from '../../hooks/useSupabase';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'UnitSettings'>;

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

type UnitSystem = 'metric' | 'imperial';

interface UnitConfig {
  weight: { metric: string; imperial: string };
  height: { metric: string; imperial: string };
  temperature: { metric: string; imperial: string };
  volume: { metric: string; imperial: string };
}

const UNIT_CONFIG: UnitConfig = {
  weight: { metric: 'kg', imperial: 'lb' },
  height: { metric: 'cm', imperial: 'in' },
  temperature: { metric: '°C', imperial: '°F' },
  volume: { metric: 'ml', imperial: 'oz' },
};

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

export default function UnitSettingsScreen({ navigation }: Props) {
  const { themeColors, darkMode, reduceMotion, updateSettings } = useCustomization();
  const { user, isConnected, supabase } = useSupabase();
  const { sweetAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || AURA.primary;

  const [system, setSystem] = useState<UnitSystem>('metric');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadUnits = async () => {
      if (isConnected && user) {
        try {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('units')
            .eq('user_id', user.id)
            .single();

          if (data?.units) {
            setSystem(data.units as UnitSystem);
          }
        } catch (e) {
          console.warn('Failed to load units:', e);
        }
      }
      setIsLoading(false);
    };
    loadUnits();
  }, [isConnected, user, supabase]);

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleChange = useCallback(async (newSystem: UnitSystem) => {
    if (newSystem === system || isSaving) return;
    handleHaptic();

    setIsSaving(true);
    setSystem(newSystem);

    try {
      await updateSettings({ units: newSystem as any });

      if (isConnected && user) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            units: newSystem,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) throw error;
      }

      sweetAlert({
        title: 'Units Updated',
        message: `Measurement system set to ${newSystem === 'metric' ? 'Metric' : 'Imperial'}.`,
        type: 'success',
        confirmText: 'OK',
      });
    } catch (error) {
      console.error('Failed to save units:', error);
      sweetAlert({
        title: 'Error',
        message: 'Failed to save unit preference. Please try again.',
        type: 'error',
        confirmText: 'OK',
      });
    } finally {
      setIsSaving(false);
    }
  }, [system, isSaving, isConnected, user, supabase, updateSettings, sweetAlert]);

  const UnitRow = ({
    label,
    icon,
    metric,
    imperial,
  }: {
    label: string;
    icon: string;
    metric: string;
    imperial: string;
  }) => (
    <View style={[styles.unitRow, isDark && styles.unitRowDark]}>
      <View style={styles.unitRowLeft}>
        <View style={[styles.unitIcon, { backgroundColor: `${AURA.primary}10` }]}>
          <Ionicons name={icon as any} size={20} color={AURA.primary} />
        </View>
        <Text style={[styles.unitLabel, isDark && styles.unitLabelDark]}>{label}</Text>
      </View>
      <View style={styles.unitValues}>
        <Text style={[
          styles.unitValue,
          system === 'metric' && [styles.unitValueActive, { color: AURA.primary }],
          isDark && styles.unitValueDark,
        ]}>
          {metric}
        </Text>
        <Text style={[styles.unitSlash, isDark && styles.unitSlashDark]}>/</Text>
        <Text style={[
          styles.unitValue,
          system === 'imperial' && [styles.unitValueActive, { color: AURA.primary }],
          isDark && styles.unitValueDark,
        ]}>
          {imperial}
        </Text>
      </View>
    </View>
  );

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || AURA.darkBg, themeColors?.colors?.[1] || '#1a1428', themeColors?.colors?.[2] || AURA.darkBg]
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#eef0ff', themeColors?.colors?.[2] || '#e2e5ff'];

  if (isLoading) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniversalSpinner size={32} color={primary} variant="liquid" section="settings" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Loading units...
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
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(100)} style={styles.header}>
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
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Units</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Choose your preferred measurement system
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
          <SectionHeader icon="options-outline" title="System" color={AURA.primary} isDark={isDark} />
          <View style={styles.selector}>
            <TouchableOpacity
              style={[
                styles.selectorBtn,
                system === 'metric' && [
                  styles.selectorBtnActive,
                  { backgroundColor: AURA.primary, borderColor: `${AURA.primary}4D` },
                ],
                isDark && styles.selectorBtnDark,
                isSaving && styles.selectorBtnDisabled,
              ]}
              onPress={() => handleChange('metric')}
              disabled={isSaving}
            >
              <Ionicons
                name="earth"
                size={24}
                color={system === 'metric' ? AURA.white : isDark ? AURA.gray400 : AURA.gray500}
              />
              <Text style={[
                styles.selectorText,
                system === 'metric' && styles.selectorTextActive,
                isDark && !system.startsWith('metric') && { color: AURA.gray400 },
              ]}>
                Metric
              </Text>
              <Text style={[
                styles.selectorSub,
                system === 'metric' && styles.selectorSubActive,
                isDark && system !== 'metric' && { color: AURA.gray500 },
              ]}>
                kg, cm, °C, ml
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorBtn,
                system === 'imperial' && [
                  styles.selectorBtnActive,
                  { backgroundColor: AURA.primary, borderColor: `${AURA.primary}4D` },
                ],
                isDark && styles.selectorBtnDark,
                isSaving && styles.selectorBtnDisabled,
              ]}
              onPress={() => handleChange('imperial')}
              disabled={isSaving}
            >
              <Ionicons
                name="flag"
                size={24}
                color={system === 'imperial' ? AURA.white : isDark ? AURA.gray400 : AURA.gray500}
              />
              <Text style={[
                styles.selectorText,
                system === 'imperial' && styles.selectorTextActive,
                isDark && system !== 'imperial' && { color: AURA.gray400 },
              ]}>
                Imperial
              </Text>
              <Text style={[
                styles.selectorSub,
                system === 'imperial' && styles.selectorSubActive,
                isDark && system !== 'imperial' && { color: AURA.gray500 },
              ]}>
                lb, in, °F, oz
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="eye-outline" title="Preview" color={AURA.success} isDark={isDark} />
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.previewContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <UnitRow
              label="Weight"
              icon="fitness-outline"
              metric={UNIT_CONFIG.weight.metric}
              imperial={UNIT_CONFIG.weight.imperial}
            />
            <UnitRow
              label="Height"
              icon="resize-outline"
              metric={UNIT_CONFIG.height.metric}
              imperial={UNIT_CONFIG.height.imperial}
            />
            <UnitRow
              label="Temperature"
              icon="thermometer-outline"
              metric={UNIT_CONFIG.temperature.metric}
              imperial={UNIT_CONFIG.temperature.imperial}
            />
            <UnitRow
              label="Volume"
              icon="beaker-outline"
              metric={UNIT_CONFIG.volume.metric}
              imperial={UNIT_CONFIG.volume.imperial}
            />
          </BlurView>
        </Animated.View>

        <Text style={[styles.note, isDark && styles.noteDark]}>
          Existing entries will not be converted. New entries will use the selected units.
        </Text>

        {isSaving && (
          <View style={[styles.savingContainer, { backgroundColor: `${AURA.primary}10` }]}>
            <UniversalSpinner size={20} color={AURA.primary} variant="liquid" section="settings" />
            <Text style={[styles.savingText, isDark && styles.savingTextDark]}>
              Saving preferences...
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

  selector: { flexDirection: 'row', gap: 12 },
  selectorBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20, padding: 20, alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  selectorBtnDark: { backgroundColor: 'rgba(41,37,36,0.4)' },
  selectorBtnActive: { borderColor: 'rgba(99,102,241,0.3)' },
  selectorBtnDisabled: { opacity: 0.6 },
  selectorText: {
    fontSize: 16, fontWeight: '700', color: AURA.gray900,
    marginTop: 10, marginBottom: 4,
  },
  selectorTextActive: { color: AURA.white },
  selectorSub: { fontSize: 13, color: AURA.gray500, fontWeight: '500' },
  selectorSubActive: { color: 'rgba(255,255,255,0.8)' },

  previewContainer: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 16,
  },
  unitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.08)',
  },
  unitRowDark: {
    backgroundColor: 'rgba(41,37,36,0.3)',
    borderColor: AURA.darkBorder,
  },
  unitRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  unitLabel: { fontSize: 15, fontWeight: '600', color: AURA.gray900 },
  unitLabelDark: { color: AURA.white },
  unitValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitValue: {
    fontSize: 16, fontWeight: '700', color: AURA.gray500,
    minWidth: 30, textAlign: 'center',
  },
  unitValueDark: { color: AURA.gray500 },
  unitValueActive: { fontSize: 18 },
  unitSlash: { fontSize: 14, color: AURA.gray300, fontWeight: '500' },
  unitSlashDark: { color: AURA.gray700 },

  note: {
    fontSize: 13, color: AURA.gray500, textAlign: 'center',
    fontWeight: '500', lineHeight: 20, marginTop: 8,
  },
  noteDark: { color: AURA.gray400 },

  savingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginTop: 16, padding: 12, borderRadius: 16,
  },
  savingText: { fontSize: 14, fontWeight: '500', color: AURA.gray500 },
  savingTextDark: { color: AURA.gray400 },
});