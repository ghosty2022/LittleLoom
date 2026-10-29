import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import AnimatedRe, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSecurity, BiometricTypeConfig } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';

type BiometricSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Gradient Text
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#ffffff', '#fbcfe8', '#c7d2fe'],
}: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Pulsing Biometric Hero
   ═══════════════════════════════════════════════════════════════════════════ */

const PulsingBiometricHero = React.memo(({
  icon, active, isDark, size = 140,
}: {
  icon: string; active: boolean; isDark: boolean; size?: number;
}) => {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (!active) {
      pulse.value = withTiming(1, { duration: 300 });
      glow.value = withTiming(0.35, { duration: 300 });
      return;
    }
    glow.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 1600 }), withTiming(0.35, { duration: 1600 })),
      -1, true,
    );
    pulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1600 }), withTiming(1, { duration: 1600 })),
      -1, true,
    );
  }, [active, pulse, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={{ width: size + 30, height: size + 30, alignItems: 'center', justifyContent: 'center' }}>
      <AnimatedRe.View
        style={[
          {
            position: 'absolute',
            width: size + 30, height: size + 30, borderRadius: (size + 30) / 2,
            backgroundColor: 'rgba(99,102,241,0.25)',
          },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={active
          ? [AURA.primary, AURA.accent]
          : isDark
            ? ['#334155', '#475569']
            : ['#e0e7ff', '#c7d2fe']}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View
          style={{
            width: size - 10, height: size - 10, borderRadius: (size - 10) / 2,
            backgroundColor: isDark ? 'rgba(20,20,28,0.85)' : 'rgba(255,255,255,0.92)',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
          }}
        >
          <Ionicons
            name={icon as any}
            size={size * 0.4}
            color={active ? AURA.primary : isDark ? AURA.primaryLight : AURA.primary}
          />
        </View>
      </LinearGradient>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BiometricSetupScreen({ navigation }: BiometricSetupScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<BiometricTypeConfig[]>([]);
  const [selectedType, setSelectedType] = useState<BiometricTypeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricCheckComplete, setBiometricCheckComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    toggleBiometric,
    resetUnlockLock,
    refreshBiometricStatus,
    availableBiometricTypes: contextTypes,
  } = useSecurity();
  const { userProfile } = useAuth();
  const { darkMode: isDark, triggerHaptic, shouldReduceMotion } = useCustomization();

  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const userName = userProfile?.fullName || 'there';
  const successScale = useSharedValue(0);

  const isInitialized = useRef(false);
  const isMounted = useRef(true);

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main' as never);
  }, [navigation]);

  /* ─── Biometric detection ──────────────────────────────────── */
  useEffect(() => {
    isMounted.current = true;
    if (isInitialized.current) return;

    const checkBiometrics = async () => {
      if (isInitialized.current) return;
      try {
        setIsLoading(true);
        isInitialized.current = true;

        let hw = false;
        let enrolled = false;
        let types: LocalAuthentication.AuthenticationType[] = [];

        try { hw = await LocalAuthentication.hasHardwareAsync(); } catch {}
        if (hw) {
          try { enrolled = await LocalAuthentication.isEnrolledAsync(); } catch {}
          try { types = await LocalAuthentication.supportedAuthenticationTypesAsync() || []; } catch {}

          if (!enrolled) {
            try {
              const testAuth = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify biometric setup',
                disableDeviceFallback: true,
                cancelLabel: 'Cancel',
              });
              if (testAuth.success || testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
                enrolled = true;
              }
            } catch {}
          }

          if (types.length === 0) {
            types = [LocalAuthentication.AuthenticationType.FINGERPRINT];
          }
        }

        let configs: BiometricTypeConfig[] = [];
        if (contextTypes && contextTypes.length > 0) {
          configs = contextTypes;
        } else if (hw) {
          if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) || types.length === 0) {
            configs.push({
              type: LocalAuthentication.AuthenticationType.FINGERPRINT,
              name: 'Fingerprint',
              icon: 'finger-print',
              iconFilled: 'finger-print',
              label: 'Touch ID / Fingerprint',
              description: 'Use your fingerprint to unlock',
              color: '#10b981',
              gradient: ['#11998e', '#38ef7d'],
              isAvailable: true,
            });
          }
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            configs.push({
              type: LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
              name: 'Face ID',
              icon: 'scan-outline',
              iconFilled: 'scan',
              label: 'Face Recognition',
              description: 'Use your face to unlock',
              color: '#667eea',
              gradient: ['#667eea', '#764ba2'],
              isAvailable: true,
            });
          }
          if (configs.length === 0) {
            configs.push({
              type: LocalAuthentication.AuthenticationType.FINGERPRINT,
              name: 'Biometric',
              icon: 'finger-print',
              iconFilled: 'finger-print',
              label: 'Biometric Authentication',
              description: 'Use device biometrics to unlock',
              color: '#667eea',
              gradient: ['#667eea', '#764ba2'],
              isAvailable: true,
            });
          }
        }

        if (isMounted.current) {
          setHasHardware(hw);
          setIsEnrolled(enrolled && hw);
          setAvailableTypes(configs);
          if (configs.length > 0) setSelectedType(configs[0]);
          setBiometricCheckComplete(true);
        }
      } catch {
        if (isMounted.current) {
          setHasHardware(false);
          setIsEnrolled(false);
          setBiometricCheckComplete(true);
        }
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    };

    resetUnlockLock();
    const timer = setTimeout(checkBiometrics, 400);
    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  /* ─── Success animation ─────────────────────────────────────── */
  useEffect(() => {
    if (setupComplete) {
      if (shouldReduceMotion) successScale.value = 1;
      else successScale.value = withSpring(1, { damping: 10, stiffness: 80 });
      const t = setTimeout(() => safeGoBack(), 2000);
      return () => clearTimeout(t);
    }
  }, [setupComplete, shouldReduceMotion, safeGoBack]);

  const handleEnableBiometric = async () => {
    if (!selectedType) {
      sweetAlert.warning('Oops', 'Please pick a biometric method first');
      return;
    }
    if (isScanning) return;

    await refreshBiometricStatus();

    let hwNow = false;
    let enrolledNow = false;
    try {
      hwNow = await LocalAuthentication.hasHardwareAsync();
      enrolledNow = await LocalAuthentication.isEnrolledAsync();
    } catch {}

    if (!hwNow) {
      sweetAlert.warning('Not Available', "Your device doesn't support biometric authentication. You can use a PIN instead.");
      return;
    }
    if (!enrolledNow) {
      sweetAlert.warning('Not Set Up', 'Please set up biometrics in your device settings first, then try again.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    triggerHaptic('medium');

    try {
      const enabled = await toggleBiometric(true);
      setIsScanning(false);
      if (enabled) {
        triggerHaptic('success');
        setSetupComplete(true);
        sweetAlert.success('All Set! 🎉', `${selectedType.name} is now active for ${userName}`);
        await refreshBiometricStatus();
        setTimeout(() => safeGoBack(), 2000);
      } else {
        setErrorMessage("Setup was cancelled or didn't complete");
        sweetAlert.info('Cancelled', 'Biometric setup was cancelled');
      }
    } catch {
      setIsScanning(false);
      setErrorMessage('Something went wrong during setup');
      sweetAlert.error('Error', 'An error occurred during authentication');
    }
  };

  const handleSkip = () => {
    triggerHaptic('light');
    safeGoBack();
  };

  const selectBiometricType = (config: BiometricTypeConfig) => {
    if (isScanning) return;
    triggerHaptic('light');
    setSelectedType(config);
  };

  /* ─── Loading state ─────────────────────────────────────────── */
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={isDark ? [AURA.darkBg, '#1a1428', AURA.darkBg] : ['#6366f1', '#8b5cf6', '#ec4899']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
          <ActivityIndicator size="large" color={AURA.white} />
          <Text style={{ marginTop: 16, color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' }}>
            Checking biometric availability…
          </Text>
        </View>
      </View>
    );
  }

  /* ─── Success state ─────────────────────────────────────────── */
  if (setupComplete) {
    const successStyle = useAnimatedStyle(() => ({ transform: [{ scale: successScale.value }] }));
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={isDark ? [AURA.darkBg, '#1a1428', AURA.darkBg] : ['#6366f1', '#8b5cf6', '#ec4899']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'transparent']}
          style={styles.auraGlowTopLeft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <AnimatedRe.View style={successStyle}>
            <LinearGradient
              colors={[AURA.success, '#059669']}
              style={{
                width: 130, height: 130, borderRadius: 65,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark" size={68} color={AURA.white} />
            </LinearGradient>
          </AnimatedRe.View>
          <GradientText style={{ fontSize: 28, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12, textAlign: 'center' }}>
            {selectedType?.name || 'Biometric'} Enabled!
          </GradientText>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 }}>
            You can now unlock LittleLoom securely, {userName}
          </Text>
        </View>
      </View>
    );
  }

  const hasBiometricAvailable = hasHardware && isEnrolled;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={isDark ? [AURA.darkBg, '#1a1428', AURA.darkBg] : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={safeGoBack} activeOpacity={0.8}>
            <BlurView intensity={isDark ? 30 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
            <Ionicons name="arrow-back" size={22} color={AURA.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Biometric Setup</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160 }}>
          {/* Logo */}
          <AnimatedRe.View entering={FadeInDown.duration(500).springify()} style={{ alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
            <View style={styles.logoWrap}>
              <View style={styles.logoGlow} />
              <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
          </AnimatedRe.View>

          {/* Biometric hero icon */}
          {selectedType && (
            <AnimatedRe.View entering={FadeInUp.delay(150).duration(500).springify()} style={{ alignItems: 'center', marginBottom: 20 }}>
              <PulsingBiometricHero icon={selectedType.icon} active={isScanning} isDark={isDark} />
            </AnimatedRe.View>
          )}

          {/* Title */}
          <GradientText style={styles.title}>
            {`Turn on ${availableTypes[0]?.name || 'Biometric'}`}
          </GradientText>

          <Text style={styles.subtitle}>
            {hasBiometricAvailable
              ? `Hey ${userName}! 👋 Use biometrics to unlock LittleLoom quickly and securely.`
              : hasHardware
                ? 'Please set up biometrics in your device settings first, then come back here.'
                : "Biometric authentication isn't available on this device. You can use a PIN instead."}
          </Text>

          {/* Error */}
          {errorMessage && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color={AURA.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Options card */}
          {availableTypes.length > 0 && hasBiometricAvailable && (
            <AnimatedRe.View entering={FadeInUp.delay(250).duration(500)} style={{ marginTop: 8 }}>
              <Text style={styles.sectionLabel}>UNLOCK METHOD</Text>
              {availableTypes.slice(0, 1).map((config) => {
                const selected = selectedType?.type === config.type;
                return (
                  <TouchableOpacity
                    key={config.type}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => selectBiometricType(config)}
                    disabled={isScanning}
                    activeOpacity={0.85}
                  >
                    <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                    <LinearGradient
                      colors={isDark
                        ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                        : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={[styles.optionIconWrap, { backgroundColor: `${AURA.primary}18` }]}>
                      <Ionicons name={(config.iconFilled || config.icon) as any} size={26} color={AURA.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionName, { color: isDark ? AURA.white : AURA.gray900 }]}>{config.name}</Text>
                      <Text style={[styles.optionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        {config.description}
                      </Text>
                    </View>
                    {selected && (
                      <View style={[styles.checkCircle, { backgroundColor: AURA.success }]}>
                        <Ionicons name="checkmark" size={14} color={AURA.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </AnimatedRe.View>
          )}

          {/* Benefits */}
          {hasBiometricAvailable && (
            <AnimatedRe.View entering={FadeInUp.delay(350).duration(500)} style={styles.benefitsRow}>
              {[
                { icon: 'flash', text: 'Quick' },
                { icon: 'shield-checkmark', text: 'Secure' },
                { icon: 'happy', text: 'Easy' },
              ].map((b, i) => (
                <View key={i} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name={b.icon as any} size={18} color={AURA.primaryLight} />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </AnimatedRe.View>
          )}

          {/* Unavailable card */}
          {!hasBiometricAvailable && (
            <AnimatedRe.View entering={FadeInUp.delay(250).duration(500)} style={{ marginTop: 8 }}>
              <BlurView intensity={isDark ? 40 : 80} style={styles.unavailableCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark
                    ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                    : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.unavailableIcon, { backgroundColor: `${AURA.danger}15` }]}>
                  <Ionicons name="alert-circle" size={42} color={AURA.danger} />
                </View>
                <Text style={[styles.unavailableTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                  {!hasHardware ? 'Not Supported' : 'Not Set Up'}
                </Text>
                <Text style={[styles.unavailableText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                  {!hasHardware
                    ? "Your device doesn't support biometric authentication. You can use a PIN instead."
                    : 'Please set up biometrics in your device settings first, then try again.'}
                </Text>
              </BlurView>
            </AnimatedRe.View>
          )}
        </ScrollView>

        {/* Sticky footer buttons */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {hasBiometricAvailable ? (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, (!selectedType || isScanning) && { opacity: 0.55 }]}
                onPress={handleEnableBiometric}
                disabled={!selectedType || isScanning}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[AURA.primary, AURA.accent]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {isScanning ? (
                  <ActivityIndicator color={AURA.white} />
                ) : (
                  <>
                    <Ionicons name={selectedType?.icon || 'finger-print'} size={22} color={AURA.white} />
                    <Text style={styles.primaryBtnText}>Turn On {selectedType?.name || 'Biometric'}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={isScanning} activeOpacity={0.7}>
                <Text style={styles.skipBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={safeGoBack} activeOpacity={0.85}>
              <LinearGradient
                colors={[AURA.primary, AURA.accent]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="arrow-back" size={20} color={AURA.white} />
              <Text style={styles.primaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

  auraGlowTopLeft: {
    position: 'absolute', top: -140, left: -100,
    width: 340, height: 340, borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -160, right: -120,
    width: 360, height: 360, borderRadius: 180,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: { color: AURA.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  logoWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoGlow: {
    position: 'absolute', width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoImage: { width: 76, height: 76 },

  title: {
    fontSize: 28, fontWeight: '800', letterSpacing: 0.4,
    marginBottom: 10, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 21, marginBottom: 22,
    paddingHorizontal: 8,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginLeft: 4,
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, marginBottom: 16,
    backgroundColor: `${AURA.danger}15`,
    borderWidth: 1, borderColor: `${AURA.danger}33`,
  },
  errorText: { color: AURA.danger, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: AURA.primary,
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  optionIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  optionName: { fontSize: 16, fontWeight: '800', marginBottom: 3, letterSpacing: -0.2 },
  optionDesc: { fontSize: 12, lineHeight: 17 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  benefitsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 20, paddingHorizontal: 8,
  },
  benefitItem: { alignItems: 'center', gap: 8 },
  benefitIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  benefitText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  unavailableCard: {
    borderRadius: 28, padding: 28, alignItems: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  unavailableIcon: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  unavailableTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  unavailableText: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 18, overflow: 'hidden',
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryBtnText: { color: AURA.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  skipBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  skipBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
});