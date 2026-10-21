import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
  Image,
  Platform,
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  FadeInUp,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSecurity, hashAnswer } from '../../context/SecurityContext';
import { useSweetAlert } from '../../components/SweetAlert';

type SecurityLockScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityLock'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
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
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
};

interface BiometricTypeInfo {
  name: string;
  icon: string;
  label: string;
  iconFilled?: string;
}

interface SecurityQuestion {
  question: string;
  answerHash: string;
}

const getBiometricInfo = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeInfo => {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { name: 'Face ID', icon: 'scan-outline', label: 'Face Recognition' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { name: 'Fingerprint', icon: 'finger-print', label: 'Touch ID' };
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
   Pulsing Biometric Ring
   ═══════════════════════════════════════════════════════════════════════════ */

const PulsingBiometricRing = React.memo(({
  icon, size = 100, isLoading, onPress, disabled,
}: {
  icon: string; size?: number; isLoading: boolean;
  onPress: () => void; disabled?: boolean;
}) => {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1400 }), withTiming(1, { duration: 1400 })),
      -1,
      true
    );
    glow.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 1800 }), withTiming(0.4, { duration: 1800 })),
      -1,
      true
    );
  }, [pulse, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || isLoading} activeOpacity={0.85}>
      <View style={{ width: size + 20, height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
        {/* Pulsing glow */}
        <AnimatedReanimated.View
          style={[
            styles.biometricGlow,
            { width: size + 20, height: size + 20, borderRadius: (size + 20) / 2 },
            glowStyle,
          ]}
          pointerEvents="none"
        />
        {/* Gradient ring */}
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.biometricRing, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={[styles.biometricInner, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }]}>
            {isLoading ? (
              <ActivityIndicator size="large" color={DS.white} />
            ) : (
              <Ionicons name={icon as any} size={size * 0.42} color={DS.white} />
            )}
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PIN Dots with aura fill
   ═══════════════════════════════════════════════════════════════════════════ */

const PinDots = React.memo(({
  pin, shakeAnim, pinProgress,
}: {
  pin: string;
  shakeAnim: Animated.Value;
  pinProgress: Animated.Value;
}) => (
  <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}>
    {Array.from({ length: PIN_LENGTH }).map((_, index) => {
      const isFilled = index < pin.length;
      return (
        <View key={index} style={styles.pinDotWrap}>
          {isFilled && (
            <LinearGradient
              colors={[DS.primary, DS.accent, '#fbbf24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pinDotGlow}
            />
          )}
          <Animated.View
            style={[
              styles.pinDot,
              {
                backgroundColor: isFilled ? DS.white : 'rgba(255,255,255,0.15)',
                borderColor: isFilled ? DS.white : 'rgba(255,255,255,0.35)',
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
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SecurityLockScreen({ navigation }: SecurityLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [biometricInfo, setBiometricInfo] = useState<BiometricTypeInfo>({
    name: 'Biometric',
    icon: 'finger-print',
    label: 'Biometric',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [pinProgress] = useState(new Animated.Value(0));

  const [showForgotPin, setShowForgotPin] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [verifyAnswers, setVerifyAnswers] = useState(['', '', '']);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);
  const [isVerifyingQuestions, setIsVerifyingQuestions] = useState(false);

  const { signOut, userProfile } = useAuth();
  const {
    unlockApp,
    forceUnlock,
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    getAvailableAuthMethods,
    resetUnlockLock,
    refreshBiometricStatus,
    settings: securitySettings,
  } = useSecurity();

  const [biometricReady, setBiometricReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('littleloom_biometric_enabled');
        const enabledFromStorage = stored === 'true';
        if (mounted) {
          setBiometricReady(
            !!isBiometricHardwareAvailable &&
            !!isBiometricEnrolled &&
            (isBiometricEnabled === true || enabledFromStorage)
          );
        }
      } catch {
        if (mounted) {
          setBiometricReady(
            !!isBiometricHardwareAvailable &&
            !!isBiometricEnrolled &&
            !!isBiometricEnabled
          );
        }
      }
    })();
    return () => { mounted = false; };
  }, [isBiometricHardwareAvailable, isBiometricEnrolled, isBiometricEnabled]);

  const biometricAvailable = biometricReady;
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const hasBiometric = biometricReady;
  const hasPin = !!securitySettings?.isPinEnabled || getAvailableAuthMethods().hasPin;

  const userName = userProfile?.fullName || 'Welcome Back';
  const userAvatar = userProfile?.avatar || '👶';

  const isMounted = useRef(true);
  const autoPromptTimer = useRef<NodeJS.Timeout | null>(null);
  const unlockInProgress = useRef(false);
  const hasAutoPrompted = useRef(false);
  const handleBiometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  const lastUnlockAttemptRef = useRef<number>(0);

  const dismissLockScreen = useCallback(() => {
    setTimeout(() => {
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' as never }],
        });
      } catch {
        navigation.replace('Main' as never);
      }
    }, 250);
  }, [navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isLockedOut) return true;
      return false;
    });
    return () => backHandler.remove();
  }, [isLockedOut]);

  useEffect(() => {
    loadSecurityQuestions();
    refreshBiometricStatus();
  }, [refreshBiometricStatus]);

  const loadSecurityQuestions = async () => {
    try {
      const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
      if (questionsStr) {
        const parsed = JSON.parse(questionsStr);
        setSecurityQuestions(parsed);
        setHasSecurityQuestions(true);
      }
    } catch (error) {
      console.log('No security questions available');
    }
  };

  const verifySecurityAnswers = async () => {
    if (verifyAnswers.some(a => a.trim().length === 0)) {
      sweetAlert.warning('Incomplete', 'Please answer all questions');
      return;
    }

    setIsVerifyingQuestions(true);
    try {
      const allCorrect = await Promise.all(
        securityQuestions.map(async (sq, i) => {
          const hashed = await hashAnswer(verifyAnswers[i]);
          return hashed === sq.answerHash;
        })
      );

      if (allCorrect.every(Boolean)) {
        triggerHaptic('success');
        setShowForgotPin(false);
        sweetAlert.success('Verified!', 'Redirecting to PIN reset...');

        setTimeout(() => {
          navigation.navigate('SecurityCenter', {
            mode: 'reset',
            fromForgotPassword: true,
          });
        }, 1500);
      } else {
        triggerHaptic('error');
        sweetAlert.error('Incorrect', 'One or more answers are wrong. Try again.');
        setVerifyAnswers(['', '', '']);
      }
    } finally {
      setIsVerifyingQuestions(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    resetUnlockLock();
    hasAutoPrompted.current = false;
    unlockInProgress.current = false;
    lastUnlockAttemptRef.current = 0;

    return () => {
      isMounted.current = false;
      hasAutoPrompted.current = false;
      if (autoPromptTimer.current) {
        clearTimeout(autoPromptTimer.current);
      }
    };
  }, [resetUnlockLock]);

  const bailOutChecked = useRef(false);
  useEffect(() => {
    if (bailOutChecked.current) return;
    if (isLoading) return;
    if (biometricReady) return;
    bailOutChecked.current = true;

    const hasAnyAuthMethod = hasPin || hasBiometric;
    if (hasAnyAuthMethod) return;

    console.log('[SecurityLock] No auth method configured — force-unlocking');
    (async () => {
      try {
        await forceUnlock?.();
        await AsyncStorage.removeItem('littleloom_security_lock');
      } catch {}
      dismissLockScreen();
    })();
  }, [biometricReady, hasPin, hasBiometric, isLoading, forceUnlock, dismissLockScreen]);

  useEffect(() => {
    Animated.spring(pinProgress, {
      toValue: pin.length,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [pin]);

  useEffect(() => {
    const detectBiometricType = async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricInfo(getBiometricInfo(types));
      } catch (error) {
        console.error('Error detecting biometric type:', error);
      }
    };
    detectBiometricType();
  }, []);

  useEffect(() => {
    if (!biometricAvailable) return;
    if (!isBiometricHardwareAvailable) return;
    if (isLockedOut) return;
    if (unlockInProgress.current) return;

    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      refreshBiometricStatus();
    });

    if (autoPromptTimer.current) {
      clearTimeout(autoPromptTimer.current);
    }

    autoPromptTimer.current = setTimeout(() => {
      if (
        isMounted.current &&
        !unlockInProgress.current &&
        !isLockedOut &&
        !hasAutoPrompted.current &&
        handleBiometricAuthRef.current
      ) {
        hasAutoPrompted.current = true;
        handleBiometricAuthRef.current();
      }
    }, 1200);

    return () => {
      unsubscribe();
      if (autoPromptTimer.current) {
        clearTimeout(autoPromptTimer.current);
      }
    };
  }, [
    biometricAvailable,
    isBiometricHardwareAvailable,
    isLockedOut,
    navigation,
    refreshBiometricStatus,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      setShowForgotPin(false);
      setVerifyAnswers(['', '', '']);
      refreshBiometricStatus();
    });
    return unsubscribe;
  }, [navigation, refreshBiometricStatus]);

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

  const handleLockout = useCallback(() => {
    setIsLockedOut(true);
    triggerHaptic('error');
    sweetAlert.confirm(
      'Too Many Attempts',
      'For security purposes, you need to sign out and sign in again.',
      async () => {
        await forceUnlock?.();
        signOut();
      },
      undefined,
      'Sign Out',
      'Cancel',
      true
    );
  }, [signOut, forceUnlock, triggerHaptic, sweetAlert]);

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
              sweetAlert.warning(
                'Incorrect PIN',
                `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              );
            }
          }
        } else {
          setAttempts(0);
          triggerHaptic('success');
          sweetAlert.success('Welcome Back!', `Good to see you, ${userName}`);
          await forceUnlock?.();
          dismissLockScreen();
        }
      } catch (error) {
        shake();
        setPin('');
      } finally {
        unlockInProgress.current = false;
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [unlockApp, shake, attempts, isLockedOut, handleLockout, triggerHaptic, userName, sweetAlert, forceUnlock, dismissLockScreen]
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
    [pin, isLoading, isLockedOut, handlePinComplete, triggerHaptic]
  );

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !isLoading && !isLockedOut) {
      triggerHaptic('light');
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin.length, isLoading, isLockedOut, triggerHaptic]);

  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable) {
      sweetAlert.warning(
        'Biometric Not Available',
        'This device does not support biometric authentication.'
      );
      return;
    }

    await refreshBiometricStatus();

    if (!isBiometricEnabled) {
      sweetAlert.warning(
        'Biometric Not Enabled',
        'Please enable biometric unlock in Settings first.'
      );
      return;
    }

    if (isLockedOut || isLoading || unlockInProgress.current) {
      return;
    }

    let isEnrolled = isBiometricEnrolled;
    if (!isEnrolled && Platform.OS === 'android') {
      try {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          const testAuth = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify biometric setup',
            disableDeviceFallback: true,
            cancelLabel: 'Cancel',
          });
          if (testAuth.success || testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
            isEnrolled = true;
          }
        } else {
          isEnrolled = enrolled;
        }
      } catch (e) {
        console.log('[SecurityLock] Enrollment check failed:', e);
      }
    }

    if (!isEnrolled) {
      sweetAlert.warning(
        'Biometric Not Set Up',
        'Please set up biometrics in your device settings first.'
      );
      refreshBiometricStatus();
      return;
    }

    const now = Date.now();
    if (now - lastUnlockAttemptRef.current < 1500) {
      return;
    }
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
      console.error('[SecurityLock] Biometric error:', error);
      if (error instanceof Error && error.message.includes('not_enrolled')) {
        sweetAlert.warning(
          'Biometric Not Set Up',
          'Please set up biometrics in your device settings first.'
        );
        refreshBiometricStatus();
      }
    } finally {
      unlockInProgress.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    isBiometricHardwareAvailable,
    isBiometricEnabled,
    isBiometricEnrolled,
    isLockedOut,
    isLoading,
    unlockApp,
    resetUnlockLock,
    shake,
    triggerHaptic,
    userName,
    sweetAlert,
    forceUnlock,
    dismissLockScreen,
    refreshBiometricStatus,
  ]);

  useEffect(() => {
    handleBiometricAuthRef.current = handleBiometricAuth;
  }, [handleBiometricAuth]);

  /* ─── Keypad ──────────────────────────────────────────────────────── */

  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const disabled = isLoading || isLockedOut || unlockInProgress.current;

    return (
      <View style={styles.keypadContainer}>
        <View style={styles.keypadGrid}>
          {keys.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.keypadButton, disabled && styles.keypadButtonDisabled]}
              onPress={() => handleNumberPress(key)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.keypadInnerRing} pointerEvents="none" />
              <Text style={styles.keypadButtonText}>{key}</Text>
            </TouchableOpacity>
          ))}

          {/* Biometric slot */}
          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (disabled || !biometricAvailable) && styles.keypadButtonDisabled,
            ]}
            onPress={handleBiometricAuth}
            disabled={disabled || !biometricAvailable}
          >
            {biometricAvailable ? (
              <View style={styles.keypadBiometricWrap}>
                <LinearGradient
                  colors={[`${DS.primary}80`, `${DS.accent}80`]}
                  style={styles.keypadBiometricBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name={biometricInfo.icon as any} size={26} color={DS.white} />
              </View>
            ) : (
              <View style={{ width: 26 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keypadButton, disabled && styles.keypadButtonDisabled]}
            onPress={() => handleNumberPress('0')}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.keypadInnerRing} pointerEvents="none" />
            <Text style={styles.keypadButtonText}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (pin.length === 0 || disabled) && styles.keypadButtonDisabled,
            ]}
            onPress={handleDelete}
            disabled={pin.length === 0 || disabled}
          >
            <Ionicons
              name="backspace-outline"
              size={24}
              color={pin.length > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ─── Forgot PIN sheet ───────────────────────────────────────────── */

  const renderForgotPin = () => {
    if (!showForgotPin) return null;

    return (
      <AnimatedReanimated.View entering={FadeInUp.duration(300)} style={styles.forgotPinOverlay}>
        <BlurView
          intensity={isDark ? 40 : 80}
          style={styles.forgotPinContainer}
          tint={isDark ? 'dark' : 'light'}
        >
          <View style={styles.forgotPinHeader}>
            <View style={styles.forgotPinIconWrap}>
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="help-circle-outline" size={28} color={DS.white} />
            </View>
            <Text style={styles.forgotPinTitle}>Forgot Your PIN?</Text>
            <Text style={styles.forgotPinSubtitle}>
              Answer your security questions to reset
            </Text>
          </View>

          {hasSecurityQuestions ? (
            <>
              {securityQuestions.map((sq, index) => (
                <View key={index} style={styles.questionCard}>
                  <Text style={styles.questionText}>
                    {index + 1}. {sq.question}
                  </Text>
                  <View style={styles.answerInputWrap}>
                    <TextInput
                      style={styles.answerInput}
                      placeholder="Your answer"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={verifyAnswers[index]}
                      onChangeText={(text) => {
                        const newAnswers = [...verifyAnswers];
                        newAnswers[index] = text;
                        setVerifyAnswers(newAnswers);
                      }}
                      autoCapitalize="none"
                      editable={!isVerifyingQuestions}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.verifyButton}
                onPress={verifySecurityAnswers}
                disabled={isVerifyingQuestions}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {isVerifyingQuestions ? (
                  <ActivityIndicator color={DS.white} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color={DS.white} />
                    <Text style={styles.verifyButtonText}>Verify & Reset PIN</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noQuestionsContainer}>
              <Ionicons name="warning-outline" size={48} color={DS.warning} />
              <Text style={styles.noQuestionsText}>
                No security questions set up.{'\n'}
                Please sign out and sign in again to reset your PIN.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.backToPinButton}
            onPress={() => {
              setShowForgotPin(false);
              setVerifyAnswers(['', '', '']);
            }}
          >
            <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.backToPinText}>Back to PIN Entry</Text>
          </TouchableOpacity>
        </BlurView>
      </AnimatedReanimated.View>
    );
  };

  /* ─── Context ribbon ─────────────────────────────────────────────── */

  const ribbon = (() => {
    if (isLockedOut) {
      return {
        icon: 'lock-closed' as const,
        color: DS.danger,
        label: 'Locked',
        text: 'Too many attempts — sign out to continue',
      };
    }
    if (showForgotPin) {
      return {
        icon: 'help-circle-outline' as const,
        color: DS.warning,
        label: 'Recovery',
        text: 'Verify your security questions',
      };
    }
    if (attempts > 0) {
      const remaining = MAX_ATTEMPTS - attempts;
      return {
        icon: 'warning-outline' as const,
        color: DS.warning,
        label: 'Attempts',
        text: `${remaining} attempt${remaining === 1 ? '' : 's'} remaining`,
      };
    }
    if (hasBiometric && hasPin) {
      return {
        icon: biometricInfo.icon as any,
        color: DS.success,
        label: 'Secured',
        text: `${biometricInfo.name} or PIN unlock available`,
      };
    }
    if (hasBiometric) {
      return {
        icon: biometricInfo.icon as any,
        color: DS.success,
        label: 'Biometric',
        text: `${biometricInfo.name} unlock enabled`,
      };
    }
    if (hasPin) {
      return {
        icon: 'keypad' as const,
        color: DS.primary,
        label: 'PIN',
        text: 'Enter your 4-digit PIN to unlock',
      };
    }
    return {
      icon: 'lock-open-outline' as const,
      color: DS.info,
      label: 'Setup',
      text: 'Set up security in settings',
    };
  })();

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Aura gradient — matches app palette */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Aura glows */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 },
        ]}
      >
        {/* ── Header ── */}
        <AnimatedReanimated.View entering={FadeInDown.duration(500).springify()} style={styles.header}>
          {/* Avatar with animated gradient ring */}
          <View style={styles.avatarRingWrap}>
            <View style={styles.avatarGlow} />
            <LinearGradient
              colors={['#ffffff', '#fbcfe8', '#c7d2fe', '#ffffff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {typeof userAvatar === 'number' ? (
                  <Image source={userAvatar} style={styles.avatarImage} resizeMode="cover" />
                ) : typeof userAvatar === 'string' && (userAvatar.startsWith('file://') || userAvatar.startsWith('http://') || userAvatar.startsWith('https://') || userAvatar.startsWith('data:')) ? (
                  <Image source={{ uri: userAvatar }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>{userAvatar}</Text>
                )}
              </View>
            </LinearGradient>
            {/* Lock badge */}
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color={DS.white} />
            </View>
          </View>

          <GradientText
            colors={['#ffffff', '#fbcfe8', '#c7d2fe']}
            style={styles.title}
          >
            {isLockedOut ? 'LOCKED OUT' : showForgotPin ? 'RECOVERY' : 'WELCOME BACK'}
          </GradientText>

          <Text style={styles.subtitle} numberOfLines={1}>
            {userName}
          </Text>
        </AnimatedReanimated.View>

        {/* ── Context Ribbon ── */}
        <AnimatedReanimated.View entering={FadeInUp.delay(100).duration(400)} style={styles.ribbonWrap}>
          <View style={styles.ribbon}>
            <View style={[styles.ribbonIcon, { backgroundColor: `${ribbon.color}30` }]}>
              <Ionicons name={ribbon.icon} size={16} color={DS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ribbonLabel}>{ribbon.label}</Text>
              <Text style={styles.ribbonText} numberOfLines={1}>{ribbon.text}</Text>
            </View>
          </View>
        </AnimatedReanimated.View>

        {/* ── Forgot PIN sheet ── */}
        {showForgotPin && renderForgotPin()}

        {/* ── Biometric button ── */}
        {!showForgotPin && hasBiometric && !isLockedOut && (
          <AnimatedReanimated.View entering={FadeInUp.delay(150).springify()} style={styles.biometricSection}>
            <PulsingBiometricRing
              icon={biometricInfo.icon}
              isLoading={isLoading}
              onPress={handleBiometricAuth}
              disabled={isLoading || unlockInProgress.current}
            />
            <Text style={styles.biometricLabel}>
              {isLoading ? 'Authenticating...' : `Tap to use ${biometricInfo.name}`}
            </Text>
          </AnimatedReanimated.View>
        )}

        {/* ── PIN section ── */}
        {!showForgotPin && hasPin && (
          <AnimatedReanimated.View entering={FadeInUp.delay(200).springify()} style={styles.pinSection}>
            <PinDots pin={pin} shakeAnim={shakeAnim} pinProgress={pinProgress} />
            {isLoading && (
              <ActivityIndicator size="small" color={DS.white} style={styles.loadingIndicator} />
            )}
            {renderKeypad()}
          </AnimatedReanimated.View>
        )}

        {/* ── No security configured ── */}
        {!showForgotPin && !hasBiometric && !hasPin && !isLockedOut && (
          <AnimatedReanimated.View entering={FadeInUp.delay(200).springify()} style={styles.noSecurityContainer}>
            <View style={styles.noSecurityIconWrap}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="lock-open-outline" size={44} color={DS.white} />
            </View>
            <Text style={styles.noSecurityTitle}>No Security Enabled</Text>
            <Text style={styles.noSecurityText}>
              Tap below to unlock the app
            </Text>
            <TouchableOpacity
              style={styles.unlockButton}
              onPress={async () => {
                await forceUnlock?.();
                try {
                  await AsyncStorage.removeItem('littleloom_security_lock');
                } catch {}
                sweetAlert.success('Unlocked', 'Welcome back!');
                dismissLockScreen();
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[DS.white, '#f0f0f0']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Ionicons name="lock-open" size={18} color={DS.primary} />
              <Text style={styles.unlockButtonText}>Unlock App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.setupSecurityLink}
              onPress={() => {
                forceUnlock?.();
                navigation.navigate('SecurityCenter', { mode: 'setup' });
              }}
            >
              <Text style={styles.setupSecurityText}>
                Set Up Security Now
              </Text>
            </TouchableOpacity>
          </AnimatedReanimated.View>
        )}

        {/* ── Forgot PIN link ── */}
        {!showForgotPin && hasPin && !isLockedOut && (
          <TouchableOpacity
            style={styles.forgotPinLink}
            onPress={() => {
              setShowForgotPin(true);
              setPin('');
            }}
          >
            <Ionicons name="help-circle-outline" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.forgotPinLinkText}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => {
              sweetAlert.confirm(
                'Sign Out',
                'Are you sure you want to sign out?',
                () => signOut(),
                undefined,
                'Sign Out',
                'Cancel',
                true
              );
            }}
          >
            <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emergencyText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

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

  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarRingWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatarGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(30,30,40,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarText: { fontSize: 40 },
  lockBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: '85%',
  },

  /* Ribbon */
  ribbonWrap: {
    width: '100%',
    marginBottom: 16,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ribbonIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.95)',
  },
  ribbonText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
    color: 'rgba(255,255,255,0.85)',
  },

  /* Biometric */
  biometricSection: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  biometricGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  biometricRing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  biometricInner: {
    backgroundColor: 'rgba(30,30,40,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  /* PIN */
  pinSection: {
    width: '100%',
    alignItems: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 24,
    height: 30,
    alignItems: 'center',
  },
  pinDotWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinDotGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.35,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  loadingIndicator: { marginBottom: 12 },

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
  keypadButton: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    maxWidth: 84,
    maxHeight: 84,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  keypadInnerRing: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  keypadButtonSpecial: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  keypadButtonDisabled: { opacity: 0.35 },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: DS.white,
    fontVariant: ['tabular-nums'],
  },
  keypadBiometricWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keypadBiometricBg: { ...StyleSheet.absoluteFillObject },

  /* Forgot PIN */
  forgotPinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  forgotPinContainer: {
    position: 'absolute',
    top: '12%',
    left: 16,
    right: 16,
    bottom: '12%',
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(30,30,40,0.6)',
  },
  forgotPinHeader: {
    alignItems: 'center',
    marginBottom: 20,
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
    color: DS.white,
    marginBottom: 6,
    textAlign: 'center',
  },
  forgotPinSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    color: 'rgba(255,255,255,0.75)',
  },
  questionCard: { marginBottom: 14 },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  answerInputWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  answerInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: DS.white,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
    overflow: 'hidden',
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  verifyButtonText: {
    color: DS.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backToPinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  backToPinText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },
  noQuestionsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noQuestionsText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 14,
    color: 'rgba(255,255,255,0.75)',
  },

  /* No security */
  noSecurityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
    marginTop: 20,
  },
  noSecurityIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  noSecurityTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: DS.white,
    marginTop: 4,
  },
  noSecurityText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  unlockButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: DS.primary,
  },
  setupSecurityLink: {
    marginTop: 8,
    paddingVertical: 10,
  },
  setupSecurityText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textDecorationLine: 'underline',
  },

  /* Forgot PIN link */
  forgotPinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
  },
  forgotPinLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },

  /* Footer */
  footer: {
    marginTop: 'auto',
    paddingVertical: 12,
    alignItems: 'center',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});