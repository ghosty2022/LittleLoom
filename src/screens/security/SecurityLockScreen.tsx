import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AnimatedReanimated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSecurity, hashAnswer } from '../../context/SecurityContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type SecurityLockScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityLock'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

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
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
};

interface BiometricTypeInfo {
  name: string;
  icon: string;
  label: string;
}

interface SecurityQuestion {
  question: string;
  answerHash: string;
}

const getBiometricInfo = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeInfo => {
  if (!types || types.length === 0) {
    return { name: 'Biometric', icon: 'finger-print', label: 'Biometric' };
  }
  const preferFingerprint = Platform.OS === 'android';
  if (preferFingerprint && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { name: 'Fingerprint', icon: 'finger-print', label: 'Touch ID' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return {
      name: Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock',
      icon: 'scan-outline',
      label: 'Face Recognition',
    };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { name: Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint', icon: 'finger-print', label: 'Touch ID' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { name: 'Iris Scan', icon: 'eye', label: 'Iris Recognition' };
  }
  return { name: 'Biometric', icon: 'finger-print', label: 'Biometric' };
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
   Hero Avatar with status ring — the lock screen "face"
   ═══════════════════════════════════════════════════════════════════════════ */

const HeroAvatar = React.memo(({
  userAvatar, ringColor, isDark, pulse,
}: {
  userAvatar: any;
  ringColor: string;
  isDark: boolean;
  pulse: boolean;
}) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (!pulse) {
      scale.value = withTiming(1, { duration: 300 });
      glow.value = withTiming(0.35, { duration: 300 });
      return;
    }
    glow.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 1600 }), withTiming(0.35, { duration: 1600 })),
      -1,
      true,
    );
    scale.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 1600 }), withTiming(1, { duration: 1600 })),
      -1,
      true,
    );
  }, [pulse, scale, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value }],
  }));

  const size = Math.min(SCREEN_WIDTH * 0.3, 124);
  const inner = size - 12;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
      <AnimatedReanimated.View
        style={[
          {
            position: 'absolute',
            width: size + 10,
            height: size + 10,
            borderRadius: (size + 10) / 2,
            backgroundColor: ringColor,
            opacity: 0.25,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[ringColor, `${ringColor}AA`, `${ringColor}55`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 3,
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: isDark ? 'rgba(20,20,28,0.85)' : 'rgba(255,255,255,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
          }}
        >
          {typeof userAvatar === 'number' ? (
            <Image source={userAvatar} style={{ width: inner, height: inner, borderRadius: inner / 2 }} resizeMode="cover" />
          ) : typeof userAvatar === 'string' && (
            userAvatar.startsWith('file://') ||
            userAvatar.startsWith('http://') ||
            userAvatar.startsWith('https://') ||
            userAvatar.startsWith('data:')
          ) ? (
            <Image source={{ uri: userAvatar }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: inner * 0.55 }}>{userAvatar}</Text>
          )}
        </View>
      </LinearGradient>

      {/* Lock badge */}
      <View
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2.5,
          borderColor: isDark ? AURA.darkBg : '#ffffff',
          shadowColor: ringColor,
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        <Ionicons name="lock-closed" size={13} color={AURA.white} />
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Segmented unlock-method pill row
   ═══════════════════════════════════════════════════════════════════════════ */

const MethodPill = React.memo(({
  label, icon, active, onPress, disabled, isDark, tint,
}: {
  label: string; icon: string; active: boolean; onPress: () => void;
  disabled?: boolean; isDark: boolean; tint: string;
}) => {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedReanimated.View style={[style, { flex: 1 }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: active
            ? tint
            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.05)'),
          borderWidth: 1,
          borderColor: active
            ? `${tint}55`
            : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)'),
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Ionicons name={icon as any} size={15} color={active ? AURA.white : tint} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: active ? AURA.white : (isDark ? 'rgba(255,255,255,0.85)' : tint),
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </AnimatedReanimated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Pulsing Biometric Hero
   ═══════════════════════════════════════════════════════════════════════════ */

const PulsingBiometric = React.memo(({
  onPress, disabled, isDark, icon, label, isLoading,
}: {
  onPress: () => void; disabled?: boolean; isDark: boolean;
  icon: string; label: string; isLoading: boolean;
}) => {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    glow.value = withRepeat(withSequence(withTiming(0.9, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.biometricButton}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.biometricIconWrap}>
        <AnimatedReanimated.View style={[styles.biometricGlow, glowStyle]} pointerEvents="none" />
        <AnimatedReanimated.View style={[styles.biometricGlowInner]} pointerEvents="none" />
        <LinearGradient
          colors={['rgba(99,102,241,0.28)', 'rgba(236,72,153,0.18)']}
          style={styles.biometricIconBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={AURA.primary} />
          ) : (
            <Ionicons name={icon as any} size={34} color={AURA.primary} />
          )}
        </LinearGradient>
      </View>
      <Text style={[styles.biometricTitle, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
        {isLoading ? 'Authenticating…' : `Use ${label}`}
      </Text>
      <Text style={[styles.biometricSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
        Tap to unlock instantly
      </Text>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PIN Display — dots in a glass "panel"
   ═══════════════════════════════════════════════════════════════════════════ */

const PinDisplay = React.memo(({
  pin, shakeAnim, pinProgress, isDark,
}: {
  pin: string;
  shakeAnim: Animated.Value;
  pinProgress: Animated.Value;
  isDark: boolean;
}) => (
  <Animated.View style={[styles.pinDisplay, { transform: [{ translateX: shakeAnim }] }]}>
    {Array.from({ length: PIN_LENGTH }).map((_, index) => {
      const isFilled = index < pin.length;
      return (
        <View key={index} style={styles.pinDotWrap}>
          {isFilled && (
            <LinearGradient
              colors={[AURA.primary, AURA.accent, '#fbbf24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pinDotGlow}
            />
          )}
          <Animated.View
            style={[
              styles.pinDot,
              {
                backgroundColor: isFilled
                  ? AURA.primary
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.1)',
                borderColor: isFilled
                  ? AURA.primary
                  : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(99,102,241,0.22)',
                transform: [
                  {
                    scale: pinProgress.interpolate({
                      inputRange: [index - 0.5, index, index + 0.5],
                      outputRange: [1, 1.35, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      );
    })}
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Keypad Key with press feedback
   ═══════════════════════════════════════════════════════════════════════════ */

const KeypadKey = React.memo(({
  value, onPress, disabled, isDark,
}: {
  value: string; onPress: (v: string) => void; disabled: boolean; isDark: boolean;
}) => {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressedOverlayStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * 0.9,
  }));

  return (
    <AnimatedReanimated.View style={[styles.keypadButtonOuter, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
          pressed.value = withTiming(1, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
          pressed.value = withTiming(0, { duration: 180 });
        }}
        onPress={() => onPress(value)}
        style={[styles.keypadButton, { opacity: disabled ? 0.35 : 1 }]}
      >
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']
            : ['rgba(99,102,241,0.10)', 'rgba(99,102,241,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <AnimatedReanimated.View style={[StyleSheet.absoluteFill, pressedOverlayStyle]} pointerEvents="none">
          <LinearGradient
            colors={[AURA.primary, AURA.accent]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </AnimatedReanimated.View>
        <View style={styles.keypadInnerRing} pointerEvents="none" />
        <Text style={[styles.keypadButtonText, { color: isDark ? AURA.white : AURA.gray900 }]}>
          {value}
        </Text>
      </TouchableOpacity>
    </AnimatedReanimated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SecurityLockScreen({ navigation }: SecurityLockScreenProps) {
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();
  const { signOut, userProfile } = useAuth();
  const { darkMode: isDark, triggerHaptic } = useCustomization();

  const {
    unlockApp,
    forceUnlock,
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    getAvailableAuthMethods,
    resetUnlockLock,
    refreshBiometricStatus,
    clearPinOnly,
    getBiometricTypeName,
    getBiometricIcon,
    settings: securitySettings,
  } = useSecurity();

  // ── State ────────────────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [pinProgress] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'biometric' | 'pin'>('pin');

  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricTypeInfo>({
    name: 'Biometric',
    icon: 'finger-print',
    label: 'Biometric',
  });

  // Forgot PIN state
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [verifyAnswers, setVerifyAnswers] = useState(['', '', '']);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);
  const [isVerifyingQuestions, setIsVerifyingQuestions] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────
  const isMounted = useRef(true);
  const autoPromptTimer = useRef<NodeJS.Timeout | null>(null);
  const unlockInProgress = useRef(false);
  const hasAutoPrompted = useRef(false);
  const handleBiometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  const lastUnlockAttemptRef = useRef(0);

  const hasBiometric = biometricReady;
  const hasPin = !!securitySettings?.isPinEnabled || getAvailableAuthMethods().hasPin;

  const userName = userProfile?.fullName || 'Welcome Back';
  const userAvatar = userProfile?.avatar || '👶';

  // Auto-set active method to biometric when only biometric available
  useEffect(() => {
    if (hasBiometric && !hasPin) setActiveMethod('biometric');
    else if (hasPin) setActiveMethod('pin');
  }, [hasBiometric, hasPin]);

  // ── biometricReady refresh ───────────────────────────────────────
  const refreshBiometricReady = useCallback(async () => {
    let enabledFromStorage = false;
    try {
      const stored = await AsyncStorage.getItem('littleloom_biometric_enabled');
      enabledFromStorage = stored === 'true';
    } catch {}
    if (!isMounted.current) return;
    setBiometricReady(
      !!isBiometricHardwareAvailable &&
      !!isBiometricEnrolled &&
      (isBiometricEnabled === true || enabledFromStorage),
    );
  }, [isBiometricHardwareAvailable, isBiometricEnrolled, isBiometricEnabled]);

  useEffect(() => {
    refreshBiometricReady();
  }, [refreshBiometricReady]);

  useFocusEffect(
    useCallback(() => {
      refreshBiometricReady();
      refreshBiometricStatus();
    }, [refreshBiometricReady, refreshBiometricStatus]),
  );

  // ── Detect biometric type ────────────────────────────────────────
  useEffect(() => {
    const contextName = getBiometricTypeName?.();
    const contextIcon = getBiometricIcon?.();
    if (contextName && contextName !== 'Biometric') {
      setBiometricInfo({ name: contextName, icon: contextIcon || 'finger-print', label: contextName });
      return;
    }
    (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (isMounted.current) setBiometricInfo(getBiometricInfo(types));
      } catch {}
    })();
  }, [getBiometricTypeName, getBiometricIcon]);

  // ── Lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    resetUnlockLock();
    hasAutoPrompted.current = false;
    unlockInProgress.current = false;
    lastUnlockAttemptRef.current = 0;
    return () => {
      isMounted.current = false;
      if (autoPromptTimer.current) clearTimeout(autoPromptTimer.current);
    };
  }, [resetUnlockLock]);

  // ── Load security questions once ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
        if (questionsStr) {
          const parsed = JSON.parse(questionsStr);
          if (isMounted.current) {
            setSecurityQuestions(parsed);
            setHasSecurityQuestions(parsed.length > 0);
          }
        }
      } catch {}
    })();
    refreshBiometricStatus();
  }, [refreshBiometricStatus]);

  // ── Back-handler ─────────────────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isLockedOut) return true;
      return false;
    });
    return () => backHandler.remove();
  }, [isLockedOut]);

  // ── PIN animation ────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(pinProgress, {
      toValue: pin.length,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [pin]);

  // ── Auto-prompt biometrics ───────────────────────────────────────
  useEffect(() => {
    if (!hasBiometric) return;
    if (!isBiometricHardwareAvailable) return;
    if (isLockedOut) return;
    if (showForgotPin) return;
    if (unlockInProgress.current) return;

    if (autoPromptTimer.current) clearTimeout(autoPromptTimer.current);

    autoPromptTimer.current = setTimeout(() => {
      if (
        isMounted.current &&
        !unlockInProgress.current &&
        !isLockedOut &&
        !hasAutoPrompted.current &&
        !showForgotPin &&
        handleBiometricAuthRef.current
      ) {
        hasAutoPrompted.current = true;
        handleBiometricAuthRef.current();
      }
    }, 1800);

    return () => {
      if (autoPromptTimer.current) clearTimeout(autoPromptTimer.current);
    };
  }, [hasBiometric, isBiometricHardwareAvailable, isLockedOut, showForgotPin]);

  // ── Reset state on focus ─────────────────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      setShowForgotPin(false);
      setVerifyAnswers(['', '', '']);
      refreshBiometricStatus();
      refreshBiometricReady();
    });
    return unsub;
  }, [navigation, refreshBiometricStatus, refreshBiometricReady]);

  // ── Bail-out if no security is configured ───────────────────────
  const bailOutChecked = useRef(false);
  useEffect(() => {
    if (bailOutChecked.current) return;
    if (isLoading) return;
    if (!biometricReady && isBiometricHardwareAvailable !== false) return;
    bailOutChecked.current = true;

    if (hasPin || hasBiometric) return;

    (async () => {
      try {
        await forceUnlock?.();
        await AsyncStorage.removeItem('littleloom_security_lock');
      } catch {}
      try {
        navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
      } catch {
        navigation.replace('Main' as never);
      }
    })();
  }, [biometricReady, hasPin, hasBiometric, isLoading, forceUnlock, navigation, isBiometricHardwareAvailable]);

  // ── Helpers ──────────────────────────────────────────────────────
  const dismissLockScreen = useCallback(() => {
    setTimeout(() => {
      try {
        navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
      } catch {
        navigation.replace('Main' as never);
      }
    }, 250);
  }, [navigation]);

  const shake = useCallback(() => {
    triggerHaptic('error');
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, triggerHaptic]);

  const performSignOut = useCallback(async () => {
    try {
      triggerHaptic('medium');
      await AsyncStorage.setItem('littleloom_security_lock', 'false');
      await AsyncStorage.multiRemove([
        'littleloom_nav_state_v4',
        '@littleloom_nav_state_v4',
        'littleloom_last_auth_state',
        'littleloom_security_lock',
      ]);
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
      sweetAlert.success('Signed Out', 'You have been signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      try {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
      } catch {}
      sweetAlert.error('Error', 'Failed to sign out. Please try again.');
    }
  }, [signOut, triggerHaptic, navigation, sweetAlert]);

  const handleLockout = useCallback(() => {
    setIsLockedOut(true);
    triggerHaptic('error');
    sweetAlert.confirm(
      'Too Many Attempts',
      'For security purposes, you need to sign out and sign in again.',
      async () => {
        try { await forceUnlock?.(); } catch {}
        await performSignOut();
      },
      undefined,
      'Sign Out',
      'Cancel',
      true,
    );
  }, [performSignOut, forceUnlock, triggerHaptic, sweetAlert]);

  // ── PIN flow ─────────────────────────────────────────────────────
  const handlePinComplete = useCallback(
    async (completedPin: string) => {
      if (isLockedOut || unlockInProgress.current) return;

      unlockInProgress.current = true;
      setIsLoading(true);
      triggerHaptic('medium');

      try {
        const success = await unlockApp('pin', completedPin);
        if (!success) {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          shake();
          setPin('');
          if (newAttempts >= MAX_ATTEMPTS) {
            handleLockout();
          } else {
            const remaining = MAX_ATTEMPTS - newAttempts;
            if (remaining <= 2) {
              triggerHaptic('warning');
              sweetAlert.warning('Incorrect PIN', `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
            }
          }
        } else {
          setAttempts(0);
          triggerHaptic('success');
          sweetAlert.success('Welcome Back!', `Good to see you, ${userName}`);
          await forceUnlock?.();
          dismissLockScreen();
        }
      } catch {
        shake();
        setPin('');
      } finally {
        unlockInProgress.current = false;
        if (isMounted.current) setIsLoading(false);
      }
    },
    [unlockApp, shake, attempts, isLockedOut, handleLockout, triggerHaptic, userName, sweetAlert, forceUnlock, dismissLockScreen],
  );

  const handleNumberPress = useCallback(
    (num: string) => {
      if (pin.length < PIN_LENGTH && !isLoading && !isLockedOut && !unlockInProgress.current) {
        triggerHaptic('light');
        const newPin = pin + num;
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          setTimeout(() => handlePinComplete(newPin), 150);
        }
      }
    },
    [pin, isLoading, isLockedOut, handlePinComplete, triggerHaptic],
  );

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !isLoading && !isLockedOut) {
      triggerHaptic('light');
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin.length, isLoading, isLockedOut, triggerHaptic]);

  // ── Biometric flow ───────────────────────────────────────────────
  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable) {
      sweetAlert.warning('Biometric Not Available', 'This device does not support biometric authentication.');
      return;
    }
    if (isLockedOut || isLoading || unlockInProgress.current) return;

    await refreshBiometricStatus();

    let enabledNow = false;
    try {
      enabledNow = (await AsyncStorage.getItem('littleloom_biometric_enabled')) === 'true';
    } catch {}
    if (!enabledNow && isBiometricEnabled) enabledNow = true;

    if (!enabledNow) {
      sweetAlert.warning('Biometric Not Enabled', 'Please enable biometric unlock in Settings first.');
      return;
    }

    let enrolledNow = isBiometricEnrolled;
    try {
      const fresh = await LocalAuthentication.isEnrolledAsync();
      if (fresh) enrolledNow = true;
    } catch {}
    if (!enrolledNow && Platform.OS === 'android') {
      try {
        const testAuth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify biometric setup',
          disableDeviceFallback: true,
          cancelLabel: 'Cancel',
        });
        if (testAuth.success || testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
          enrolledNow = true;
        }
      } catch {}
    }

    if (!enrolledNow) {
      sweetAlert.warning('Biometric Not Set Up', 'Please set up biometrics in your device settings first.');
      refreshBiometricStatus();
      return;
    }

    const now = Date.now();
    if (now - lastUnlockAttemptRef.current < 1500) return;
    lastUnlockAttemptRef.current = now;

    resetUnlockLock();
    unlockInProgress.current = true;
    setIsLoading(true);

    try {
      triggerHaptic('medium');
      const success = await unlockApp('biometric');
      if (success) {
        triggerHaptic('success');
        sweetAlert.success('Welcome Back!', `Good to see you, ${userName}`);
        await forceUnlock?.();
        dismissLockScreen();
      } else {
        triggerHaptic('error');
        shake();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not_enrolled')) {
        sweetAlert.warning('Biometric Not Set Up', 'Please set up biometrics in your device settings first.');
        refreshBiometricStatus();
      }
    } finally {
      unlockInProgress.current = false;
      if (isMounted.current) setIsLoading(false);
    }
  }, [
    isBiometricHardwareAvailable, isBiometricEnabled, isBiometricEnrolled,
    isLockedOut, isLoading, unlockApp, resetUnlockLock, shake, triggerHaptic,
    userName, sweetAlert, forceUnlock, dismissLockScreen, refreshBiometricStatus,
  ]);

  useEffect(() => {
    handleBiometricAuthRef.current = handleBiometricAuth;
  }, [handleBiometricAuth]);

  // ── Forgot-PIN flow ─────────────────────────────────────────────
  const verifySecurityAnswers = useCallback(async () => {
    if (verifyAnswers.some((a) => a.trim().length === 0)) {
      sweetAlert.warning('Incomplete', 'Please answer all questions');
      return;
    }

    setIsVerifyingQuestions(true);
    try {
      const allCorrect = await Promise.all(
        securityQuestions.map(async (sq, i) => {
          const hashed = await hashAnswer(verifyAnswers[i]);
          return hashed === sq.answerHash;
        }),
      );

      if (allCorrect.every(Boolean)) {
        triggerHaptic('success');

        try { await clearPinOnly(); } catch {}
        try {
          await forceUnlock?.();
          await AsyncStorage.setItem('littleloom_security_lock', 'false');
          await AsyncStorage.setItem('littleloom_last_active', Date.now().toString());
        } catch {}

        setShowForgotPin(false);
        setVerifyAnswers(['', '', '']);
        sweetAlert.success('Verified!', 'Set a new PIN to continue.');

        setTimeout(() => {
          try {
            navigation.reset({
              index: 0,
              routes: [
                { name: 'Main' as never },
                {
                  name: 'SecurityCenter' as never,
                  params: { mode: 'reset', fromForgotPassword: true },
                },
              ],
            });
          } catch {
            navigation.navigate('SecurityCenter' as never, {
              mode: 'reset',
              fromForgotPassword: true,
            } as never);
          }
        }, 900);
      } else {
        triggerHaptic('error');
        sweetAlert.error('Incorrect', 'One or more answers are wrong. Try again.');
        setVerifyAnswers(['', '', '']);
      }
    } finally {
      if (isMounted.current) setIsVerifyingQuestions(false);
    }
  }, [
    verifyAnswers, securityQuestions, triggerHaptic, clearPinOnly, forceUnlock,
    navigation, sweetAlert,
  ]);

  // ══════════════════════════════════════════════════════════════════
  // DERIVED STATE
  // ══════════════════════════════════════════════════════════════════

  const ringColor = useMemo(() => {
    if (isLockedOut) return AURA.danger;
    if (attempts > 0) return AURA.warning;
    return AURA.success;
  }, [isLockedOut, attempts]);

  const statusText = useMemo(() => {
    if (isLockedOut) return 'Too many attempts';
    if (showForgotPin) return 'Recovery mode';
    if (attempts > 0) {
      const remaining = MAX_ATTEMPTS - attempts;
      return `${remaining} attempt${remaining === 1 ? '' : 's'} remaining`;
    }
    if (hasBiometric && hasPin) return `${biometricInfo.name} or PIN`;
    if (hasBiometric) return `${biometricInfo.name} ready`;
    if (hasPin) return 'PIN required';
    return 'No security set';
  }, [isLockedOut, showForgotPin, attempts, hasBiometric, hasPin, biometricInfo]);

  const showMethodToggle = hasBiometric && hasPin && !isLockedOut && !showForgotPin;
  const showKeypad = !showForgotPin && hasPin && !isLockedOut && (activeMethod === 'pin' || !hasBiometric);
  const showBiometricPanel = !showForgotPin && hasBiometric && !isLockedOut && (activeMethod === 'biometric' || !hasPin);

  // ══════════════════════════════════════════════════════════════════
  // RENDER — Keypad
  // ══════════════════════════════════════════════════════════════════
  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const disabled = isLoading || isLockedOut || unlockInProgress.current;

    return (
      <View style={styles.keypadContainer}>
        <View style={styles.keypadGrid}>
          {keys.map((k) => (
            <KeypadKey key={k} value={k} onPress={handleNumberPress} disabled={disabled} isDark={isDark} />
          ))}

          {/* left slot: biometric shortcut or empty */}
          {hasBiometric ? (
            <TouchableOpacity
              style={[styles.keypadButton, styles.keypadButtonSpecial, disabled && { opacity: 0.35 }]}
              onPress={() => { setActiveMethod('biometric'); handleBiometricAuth(); }}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <View style={styles.keypadBiometricWrap}>
                <LinearGradient
                  colors={[`${AURA.primary}CC`, `${AURA.accent}CC`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name={biometricInfo.icon as any} size={26} color={AURA.white} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.keypadButton} />
          )}

          <KeypadKey value="0" onPress={handleNumberPress} disabled={disabled} isDark={isDark} />

          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (pin.length === 0 || disabled) && { opacity: 0.35 },
            ]}
            onPress={handleDelete}
            disabled={pin.length === 0 || disabled}
            activeOpacity={0.75}
          >
            <Ionicons
              name="backspace-outline"
              size={26}
              color={pin.length > 0
                ? (isDark ? 'rgba(255,255,255,0.9)' : AURA.gray900)
                : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(99,102,241,0.3)')}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER — Forgot PIN sheet
  // ══════════════════════════════════════════════════════════════════
  const renderForgotPin = () => {
    if (!showForgotPin) return null;
    const answeredCount = verifyAnswers.filter((a) => a.trim().length > 0).length;
    const progress = securityQuestions.length > 0 ? answeredCount / securityQuestions.length : 0;

    return (
      <AnimatedReanimated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(160)}
        style={styles.forgotPinOverlay}
      >
        <BlurView
          intensity={isDark ? 60 : 90}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.forgotPinKAV}
        >
          <AnimatedReanimated.View
            entering={SlideInDown.duration(320)}
            exiting={SlideOutDown.duration(220)}
            style={[
              styles.forgotPinSheet,
              {
                backgroundColor: isDark ? 'rgba(20,20,32,0.97)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.forgotPinHeader}>
              <View style={styles.forgotPinIconWrap}>
                <LinearGradient
                  colors={[AURA.primary, AURA.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="shield-checkmark-outline" size={26} color={AURA.white} />
              </View>
              <Text style={[styles.forgotPinTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                Reset Your PIN
              </Text>
              <Text style={[styles.forgotPinSubtitle, { color: isDark ? 'rgba(255,255,255,0.7)' : AURA.gray500 }]}>
                Answer your security questions to prove it's you
              </Text>
            </View>

            {/* Progress bar */}
            {hasSecurityQuestions && securityQuestions.length > 0 && (
              <View style={[styles.progressTrack, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.1)',
              }]}>
                <View style={[styles.progressFillWrap, { width: `${progress * 100}%` }]}>
                  <LinearGradient
                    colors={[AURA.primary, AURA.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
            )}

            <ScrollView
              style={styles.forgotPinScroll}
              contentContainerStyle={styles.forgotPinScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {hasSecurityQuestions && securityQuestions.length > 0 ? (
                <>
                  {securityQuestions.map((sq, index) => {
                    const filled = verifyAnswers[index]?.trim().length > 0;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.questionCard,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.04)',
                            borderColor: filled
                              ? `${AURA.success}55`
                              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)'),
                          },
                        ]}
                      >
                        <View style={styles.questionHeaderRow}>
                          <View style={[
                            styles.questionIndexBadge,
                            { backgroundColor: filled ? `${AURA.success}22` : `${AURA.primary}20` },
                          ]}>
                            {filled ? (
                              <Ionicons name="checkmark" size={12} color={AURA.success} />
                            ) : (
                              <Text style={[styles.questionIndexText, { color: AURA.primary }]}>
                                {index + 1}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.questionText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                            {sq.question}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.answerInputWrap,
                            {
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                            },
                          ]}
                        >
                          <Ionicons
                            name="key-outline"
                            size={16}
                            color={AURA.primary}
                            style={{ marginLeft: 12 }}
                          />
                          <TextInput
                            style={[styles.answerInput, { color: isDark ? AURA.white : AURA.gray900 }]}
                            placeholder="Your answer"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                            value={verifyAnswers[index]}
                            onChangeText={(text) => {
                              const newAnswers = [...verifyAnswers];
                              newAnswers[index] = text;
                              setVerifyAnswers(newAnswers);
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isVerifyingQuestions}
                            returnKeyType={index === securityQuestions.length - 1 ? 'done' : 'next'}
                          />
                        </View>
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={verifySecurityAnswers}
                    disabled={isVerifyingQuestions}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[AURA.primary, AURA.accent]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    {isVerifyingQuestions ? (
                      <ActivityIndicator color={AURA.white} />
                    ) : (
                      <>
                        <Ionicons name="shield-checkmark" size={18} color={AURA.white} />
                        <Text style={styles.verifyButtonText}>Verify & Reset PIN</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.noQuestionsContainer}>
                  <View style={styles.noQuestionsIconWrap}>
                    <Ionicons name="warning-outline" size={42} color={AURA.warning} />
                  </View>
                  <Text style={[styles.noQuestionsTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                    No Security Questions
                  </Text>
                  <Text style={[styles.noQuestionsText, { color: isDark ? 'rgba(255,255,255,0.7)' : AURA.gray500 }]}>
                    Security questions haven't been set up. Please sign out and sign in again to reset your PIN, or contact support.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.backToPinButton}
              onPress={() => {
                setShowForgotPin(false);
                setVerifyAnswers(['', '', '']);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color={isDark ? 'rgba(255,255,255,0.85)' : AURA.gray500} />
              <Text style={[styles.backToPinText, { color: isDark ? 'rgba(255,255,255,0.85)' : AURA.gray500 }]}>
                Back to PIN Entry
              </Text>
            </TouchableOpacity>
          </AnimatedReanimated.View>
        </KeyboardAvoidingView>
      </AnimatedReanimated.View>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={isLoading && !isLockedOut}
        text={unlockInProgress.current ? 'Unlocking…' : 'Verifying…'}
        subtext="Please wait a moment"
        size="medium"
        overlay={true}
        blur={true}
      />

      {/* Base gradient */}
      <LinearGradient
        colors={isDark
          ? ['#0c0a09', '#1a1428', '#0c0a09']
          : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Ambient aurora blobs */}
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
      <View style={styles.auraDotTopRight} pointerEvents="none" />
      <View style={styles.auraDotBottomLeft} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero header ── */}
          <AnimatedReanimated.View
            entering={FadeInDown.duration(500).springify()}
            style={styles.header}
          >
            <HeroAvatar
              userAvatar={userAvatar}
              ringColor={ringColor}
              isDark={isDark}
              pulse={!isLockedOut && !showForgotPin}
            />

            <GradientText
              colors={['#ffffff', '#fbcfe8', '#c7d2fe']}
              style={styles.title}
            >
              {isLockedOut ? 'LOCKED OUT' : showForgotPin ? 'RECOVERY' : 'WELCOME BACK'}
            </GradientText>

            <Text style={styles.subtitle} numberOfLines={1}>
              {userName}
            </Text>

            {/* Status chip */}
            <View style={[styles.statusChip, {
              backgroundColor: `${ringColor}22`,
              borderColor: `${ringColor}55`,
            }]}>
              <View style={[styles.statusDot, { backgroundColor: ringColor }]} />
              <Text style={[styles.statusChipText, { color: ringColor }]} numberOfLines={1}>
                {statusText}
              </Text>
            </View>
          </AnimatedReanimated.View>

          {/* ── Glass card ── */}
          <AnimatedReanimated.View
            entering={FadeInUp.delay(150).duration(400).springify()}
            style={styles.formContainer}
          >
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(30,30,40,0.94)', 'rgba(50,50,60,0.88)']
                    : ['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.90)']
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              {/* inner glow/vignette */}
              <LinearGradient
                colors={isDark
                  ? ['rgba(255,255,255,0.06)', 'transparent']
                  : ['rgba(255,255,255,0.5)', 'transparent']}
                style={styles.cardTopShine}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                pointerEvents="none"
              />

              {/* ── Method toggle (only when both available) ── */}
              {showMethodToggle && (
                <View style={styles.methodRow}>
                  <MethodPill
                    label="PIN"
                    icon="keypad"
                    active={activeMethod === 'pin'}
                    onPress={() => { triggerHaptic('light'); setActiveMethod('pin'); }}
                    disabled={isLoading}
                    isDark={isDark}
                    tint={AURA.primary}
                  />
                  <MethodPill
                    label={biometricInfo.name}
                    icon={biometricInfo.icon}
                    active={activeMethod === 'biometric'}
                    onPress={() => { triggerHaptic('light'); setActiveMethod('biometric'); handleBiometricAuth(); }}
                    disabled={isLoading}
                    isDark={isDark}
                    tint={AURA.accent}
                  />
                </View>
              )}

              {/* ── Biometric panel ── */}
              {showBiometricPanel && (
                <PulsingBiometric
                  onPress={handleBiometricAuth}
                  disabled={isLoading || isLockedOut}
                  isDark={isDark}
                  icon={biometricInfo.icon}
                  label={biometricInfo.name}
                  isLoading={isLoading && unlockInProgress.current}
                />
              )}

              {/* ── PIN panel ── */}
              {showKeypad && (
                <View style={styles.pinSection}>
                  <PinDisplay
                    pin={pin}
                    shakeAnim={shakeAnim}
                    pinProgress={pinProgress}
                    isDark={isDark}
                  />
                  {isLoading && !unlockInProgress.current && (
                    <ActivityIndicator size="small" color={AURA.primary} style={styles.loadingIndicator} />
                  )}
                  {renderKeypad()}
                </View>
              )}

              {/* ── No security ── */}
              {!showForgotPin && !hasBiometric && !hasPin && !isLockedOut && (
                <View style={styles.noSecurityContainer}>
                  <View style={[styles.noSecurityIconWrap, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                  }]}>
                    <Ionicons name="lock-open-outline" size={44} color={AURA.primary} />
                  </View>
                  <Text style={[styles.noSecurityTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                    No Security Enabled
                  </Text>
                  <Text style={[styles.noSecurityText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    Tap below to unlock the app
                  </Text>
                  <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={async () => {
                      await forceUnlock?.();
                      try { await AsyncStorage.removeItem('littleloom_security_lock'); } catch {}
                      sweetAlert.success('Unlocked', 'Welcome back!');
                      dismissLockScreen();
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[AURA.primary, AURA.accent]}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="lock-open" size={18} color={AURA.white} />
                      <Text style={styles.unlockButtonText}>Unlock App</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.setupSecurityLink}
                    onPress={() => {
                      forceUnlock?.();
                      navigation.navigate('SecurityCenter', { mode: 'setup' });
                    }}
                  >
                    <Text style={[styles.setupSecurityText, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
                      Set Up Security Now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Forgot PIN link ── */}
              {!showForgotPin && hasPin && !isLockedOut && (
                <TouchableOpacity
                  style={styles.forgotPinLink}
                  onPress={() => {
                    triggerHaptic('light');
                    setShowForgotPin(true);
                    setPin('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="help-circle-outline" size={16} color={isDark ? AURA.primaryLight : AURA.primary} />
                  <Text style={[styles.forgotPinLinkText, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
                    Forgot PIN?
                  </Text>
                </TouchableOpacity>
              )}

              {/* ── Sign-out footer ── */}
              {!showForgotPin && (
                <TouchableOpacity
                  style={styles.emergencyButton}
                  onPress={() => {
                    sweetAlert.confirm(
                      'Sign Out',
                      'Are you sure you want to sign out? You will need to sign in again to access your account.',
                      () => { performSignOut(); },
                      undefined,
                      'Sign Out',
                      'Cancel',
                      true,
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={16} color={isDark ? AURA.gray400 : AURA.gray500} />
                  <Text style={[styles.emergencyText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    Sign Out
                  </Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </AnimatedReanimated.View>

          {/* ── Footer ── */}
          <AnimatedReanimated.View entering={FadeIn.delay(800)} style={styles.footer}>
            <Ionicons name="shield-checkmark" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={styles.footerText}>Protected by LittleLoom</Text>
          </AnimatedReanimated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showForgotPin && renderForgotPin()}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1 },

  auraGlowTopLeft: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute',
    bottom: -160,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  auraDotTopRight: {
    position: 'absolute',
    top: 100,
    right: 24,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  auraDotBottomLeft: {
    position: 'absolute',
    bottom: 140,
    left: 32,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    maxWidth: '85%',
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '90%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  /* Glass card */
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 8,
  },
  cardTopShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  /* Method toggle */
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  /* Biometric */
  biometricButton: {
    alignItems: 'center',
    paddingVertical: 18,
    width: '100%',
    marginBottom: 4,
  },
  biometricIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  biometricGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(99,102,241,0.22)',
  },
  biometricGlowInner: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(236,72,153,0.1)',
  },
  biometricIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  biometricTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  biometricSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* PIN display */
  pinSection: {
    width: '100%',
    alignItems: 'center',
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 22,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.12)',
  },
  pinDotWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinDotGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    opacity: 0.3,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  loadingIndicator: { marginBottom: 10 },

  /* Keypad */
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  keypadButtonOuter: {
    width: (SCREEN_WIDTH - 100) / 3,
    height: (SCREEN_WIDTH - 100) / 3,
    maxWidth: 80,
    maxHeight: 80,
  },
  keypadButton: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
    overflow: 'hidden',
    position: 'relative',
  },
  keypadInnerRing: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  keypadButtonSpecial: {
    width: (SCREEN_WIDTH - 100) / 3,
    height: (SCREEN_WIDTH - 100) / 3,
    maxWidth: 80,
    maxHeight: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  keypadBiometricWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  /* Forgot PIN sheet */
  forgotPinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  forgotPinKAV: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  forgotPinSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 22,
    maxHeight: '88%',
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.35)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  forgotPinHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  forgotPinIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  forgotPinTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  forgotPinSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFillWrap: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  forgotPinScroll: {
    maxHeight: 380,
  },
  forgotPinScrollContent: {
    paddingBottom: 8,
  },
  questionCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  questionIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  questionIndexText: {
    fontSize: 11,
    fontWeight: '800',
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  answerInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  answerInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  verifyButtonText: {
    color: AURA.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backToPinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
  },
  backToPinText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  noQuestionsContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 8,
  },
  noQuestionsIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: `${AURA.warning}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noQuestionsTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  noQuestionsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },

  /* No security */
  noSecurityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  noSecurityIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  noSecurityTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  noSecurityText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  unlockButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    width: '100%',
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  loginGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unlockButtonText: {
    color: AURA.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  setupSecurityLink: {
    marginTop: 8,
    paddingVertical: 10,
  },
  setupSecurityText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  /* Forgot PIN link */
  forgotPinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  forgotPinLinkText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  /* Footer */
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  emergencyText: {
    fontSize: 13,
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
});