import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

type Props = NativeStackScreenProps<RootStackParamList, 'UnitSettings'>;

type UnitSystem = 'metric' | 'imperial';

interface UnitConfig {
  weight: { metric: 'kg'; imperial: 'lb' };
  height: { metric: 'cm'; imperial: 'in' };
  temperature: { metric: '°C'; imperial: '°F' };
  volume: { metric: 'ml'; imperial: 'oz' };
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
  const { themeColors, darkMode, reduceMotion } = useCustomization();
  const insets = useSafeAreaInsets();

  const isDark = darkMode;
  const primary = themeColors?.primary || '#667eea';

  const [system, setSystem] = useState<UnitSystem>('metric');

  const handleHaptic = () => {
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleChange = (newSystem: UnitSystem) => {
    if (newSystem === system) return;
    handleHaptic();
    setSystem(newSystem);
  };

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
        <View style={[styles.unitIcon, { backgroundColor: `${primary}10` }]}>
          <Ionicons name={icon as any} size={20} color={primary} />
        </View>
        <Text style={[styles.unitLabel, isDark && styles.unitLabelDark]}>{label}</Text>
      </View>
      <View style={styles.unitValues}>
        <Text style={[
          styles.unitValue,
          system === 'metric' && [styles.unitValueActive, { color: primary }],
          isDark && styles.unitValueDark,
        ]}>
          {metric}
        </Text>
        <Text style={[styles.unitSlash, isDark && styles.unitSlashDark]}>/</Text>
        <Text style={[
          styles.unitValue,
          system === 'imperial' && [styles.unitValueActive, { color: primary }],
          isDark && styles.unitValueDark,
        ]}>
          {imperial}
        </Text>
      </View>
    </View>
  );

  const bgColors = isDark
    ? [themeColors?.colors?.[0] || '#0f0f1e', themeColors?.colors?.[1] || '#1a1a2e', themeColors?.colors?.[2] || '#16213e']
    : [themeColors?.colors?.[0] || '#f8faff', themeColors?.colors?.[1] || '#f0f4ff', themeColors?.colors?.[2] || '#e8eeff'];

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AutoHideScrollView
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
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Units</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
            Choose your preferred measurement system
          </Text>
        </Animated.View>

        {/* System Selector */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(200)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="options-outline" title="System" color={primary} isDark={isDark} />
          <View style={styles.selector}>
            <TouchableOpacity
              style={[
                styles.selectorBtn,
                system === 'metric' && [styles.selectorBtnActive, { backgroundColor: primary, borderColor: `${primary}4D` }],
                isDark && styles.selectorBtnDark,
              ]}
              onPress={() => handleChange('metric')}
            >
              <Ionicons
                name="earth"
                size={24}
                color={system === 'metric' ? '#fff' : isDark ? '#888' : '#666'}
              />
              <Text style={[
                styles.selectorText,
                system === 'metric' && styles.selectorTextActive,
              ]}>
                Metric
              </Text>
              <Text style={[
                styles.selectorSub,
                system === 'metric' && styles.selectorSubActive,
              ]}>
                kg, cm, °C, ml
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorBtn,
                system === 'imperial' && [styles.selectorBtnActive, { backgroundColor: primary, borderColor: `${primary}4D` }],
                isDark && styles.selectorBtnDark,
              ]}
              onPress={() => handleChange('imperial')}
            >
              <Ionicons
                name="flag"
                size={24}
                color={system === 'imperial' ? '#fff' : isDark ? '#888' : '#666'}
              />
              <Text style={[
                styles.selectorText,
                system === 'imperial' && styles.selectorTextActive,
              ]}>
                Imperial
              </Text>
              <Text style={[
                styles.selectorSub,
                system === 'imperial' && styles.selectorSubActive,
              ]}>
                lb, in, °F, oz
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Unit Preview */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(300)}
          style={styles.sectionWrapper}
        >
          <SectionHeader icon="eye-outline" title="Preview" color="#11998e" isDark={isDark} />
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

        {/* Note */}
        <Text style={[styles.note, isDark && styles.noteDark]}>
          Existing entries will not be converted. New entries will use the selected units.
        </Text>
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

  selector: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectorBtnDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  selectorBtnActive: {
    borderColor: 'rgba(102,126,234,0.3)',
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 10,
    marginBottom: 4,
  },
  selectorTextActive: { color: '#fff' },
  selectorSub: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  selectorSubActive: { color: 'rgba(255,255,255,0.8)' },

  previewContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  unitRowDark: {
    backgroundColor: 'rgba(30,30,40,0.3)',
    borderColor: 'rgba(255,255,255,0.03)',
  },
  unitRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  unitLabelDark: { color: '#fff' },
  unitValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#888',
    minWidth: 30,
    textAlign: 'center',
  },
  unitValueDark: { color: '#666' },
  unitValueActive: {
    fontSize: 18,
  },
  unitSlash: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
  unitSlashDark: { color: '#444' },

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
