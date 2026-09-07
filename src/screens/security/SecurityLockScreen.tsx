// screens/security/SecurityLockScreen.tsx - COMPLETE FIXED with Login Screen UI
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
  Modal,
  Pressable,
  Platform,
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
    getBiometricTypeName,
    getBiometricIcon,
  } = useSecurity();

  const effectiveBiometricEnabled = isBiometricEnabled ?? false;

  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const insets = useSafeAreaInsets();
  
  const sweetAlert = useSweetAlert();

  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric || isBiometricHardwareAvailable;
  const hasPin = availableMethods.hasPin;

  const userName = userProfile?.fullName || 'Welcome Back';
  const userAvatar = userProfile?.avatar || '👶';

  const colors = {
    background: isDark ? ['#0F172A', '#1E293B'] : ['#667eea', '#764ba2'],
    primary: themeColors.primary,
    primaryLight: themeColors.secondary,
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.8)',
    textMuted: 'rgba(255,255,255,0.5)',
    surface: 'rgba(255,255,255,0.15)',
    surfaceHighlight: 'rgba(255,255,255,0.25)',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    border: 'rgba(255,255,255,0.2)',
  };

  const isMounted = useRef(true);
  const autoPromptTimer = useRef<NodeJS.Timeout | null>(null);
  const unlockInProgress = useRef(false);
  const hasAutoPrompted = useRef(false);
  const handleBiometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  const lastUnlockAttemptRef = useRef<number>(0);

  const dismissLockScreen = useCallback(() => {
    setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
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
            fromForgotPassword: true
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

  // ─── Auto-prompt biometric ──────────────────────────────────────
  useEffect(() => {
    if (!effectiveBiometricEnabled) return;
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
    effectiveBiometricEnabled,
    isBiometricHardwareAvailable,
    isLockedOut,
    navigation,
    refreshBiometricStatus,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      unlockInProgress.current = false;
      resetUnlockLock();
      setShowForgotPin(false);
      setVerifyAnswers(['', '', '']);
      refreshBiometricStatus();
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock, refreshBiometricStatus]);

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

  // ─── Biometric authentication ──────────────────────────────────
  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable) {
      console.log('[SecurityLock] No biometric hardware');
      return;
    }

    await refreshBiometricStatus();

    if (!effectiveBiometricEnabled) {
      console.log('[SecurityLock] Biometric not enabled');
      return;
    }

    if (isLockedOut || isLoading || unlockInProgress.current) {
      console.log('[SecurityLock] Locked or in progress');
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
      console.log('⏸️ Biometric attempt throttled');
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
    effectiveBiometricEnabled,
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

  const renderPinDots = () => (
    <Animated.View
      style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, index) => {
        const isFilled = index < pin.length;
        return (
          <Animated.View
            key={index}
            style={[
              styles.pinDot,
              {
                backgroundColor: isFilled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                borderColor: isFilled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                transform: [
                  {
                    scale: pinProgress.interpolate({
                      inputRange: [index - 0.5, index, index + 0.5],
                      outputRange: [1, 1.3, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );

  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return (
      <View style={styles.keypadContainer}>
        <View style={styles.keypadGrid}>
          {keys.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.keypadButton,
                { backgroundColor: 'rgba(255,255,255,0.15)' },
                (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled,
              ]}
              onPress={() => handleNumberPress(key)}
              disabled={isLoading || isLockedOut || unlockInProgress.current}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadButtonText, { color: '#fff' }]}>{key}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (isLoading || isLockedOut || !hasBiometric || unlockInProgress.current) && styles.keypadButtonDisabled,
            ]}
            onPress={handleBiometricAuth}
            disabled={isLoading || isLockedOut || !hasBiometric || unlockInProgress.current}
          >
            {hasBiometric ? (
              <Ionicons
                name={biometricInfo.icon as any}
                size={28}
                color="#fff"
              />
            ) : (
              <View style={{ width: 28 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keypadButton,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
              (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled,
            ]}
            onPress={() => handleNumberPress('0')}
            disabled={isLoading || isLockedOut || unlockInProgress.current}
            activeOpacity={0.7}
          >
            <Text style={[styles.keypadButtonText, { color: '#fff' }]}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (pin.length === 0 || isLoading || isLockedOut) && styles.keypadButtonDisabled,
            ]}
            onPress={handleDelete}
            disabled={pin.length === 0 || isLoading || isLockedOut}
          >
            <Ionicons
              name="backspace-outline"
              size={24}
              color={pin.length > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderForgotPin = () => {
    if (!showForgotPin) return null;

    return (
      <View style={[styles.forgotPinContainer, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
        <BlurView
          intensity={isDark ? 40 : 80}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <View style={styles.forgotPinHeader}>
          <Text style={[styles.forgotPinTitle, { color: colors.text }]}>
            Forgot Your PIN?
          </Text>
          <Text style={[styles.forgotPinSubtitle, { color: colors.textSecondary }]}>
            Answer your security questions to reset
          </Text>
        </View>

        {hasSecurityQuestions ? (
          <>
            {securityQuestions.map((sq, index) => (
              <View key={index} style={styles.questionCard}>
                <Text style={[styles.questionText, { color: colors.textSecondary }]}>
                  {index + 1}. {sq.question}
                </Text>
                <TextInput
                  style={[
                    styles.answerInput,
                    {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Your answer"
                  placeholderTextColor={colors.textMuted}
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
            ))}

            <TouchableOpacity
              style={[styles.verifyButton, { backgroundColor: '#667eea' }]}
              onPress={verifySecurityAnswers}
              disabled={isVerifyingQuestions}
            >
              {isVerifyingQuestions ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify & Reset PIN</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noQuestionsContainer}>
            <Ionicons name="warning-outline" size={48} color={colors.warning} />
            <Text style={[styles.noQuestionsText, { color: colors.textSecondary }]}>
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
          <Text style={[styles.backToPinText, { color: '#667eea' }]}>
            Back to PIN Entry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={['#667eea', '#764ba2', '#f093fb']} style={styles.gradient}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoFloatWrap}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              {typeof userAvatar === 'number' ? (
                <Image source={userAvatar} style={styles.avatarImage} resizeMode="cover" />
              ) : typeof userAvatar === 'string' && (userAvatar.startsWith('file://') || userAvatar.startsWith('http://') || userAvatar.startsWith('https://') || userAvatar.startsWith('data:')) ? (
                <Image source={{ uri: userAvatar }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{userAvatar}</Text>
              )}
            </View>

            <Text style={[styles.title, { color: '#fff' }]}>
              {isLockedOut ? 'Locked Out' : showForgotPin ? 'PIN Recovery' : `Welcome, ${userName}`}
            </Text>

            {!showForgotPin && (
              <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
                {hasBiometric && hasPin
                  ? `Use ${biometricInfo.name} or enter PIN`
                  : hasPin
                    ? 'Enter your PIN to continue'
                    : `Use ${biometricInfo.name} to unlock`}
              </Text>
            )}

            {attempts > 0 && !isLockedOut && !showForgotPin && (
              <View style={[styles.attemptsBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <Text style={[styles.attemptsText, { color: '#f59e0b' }]}>
                  {MAX_ATTEMPTS - attempts} attempts remaining
                </Text>
              </View>
            )}

            {isLockedOut && (
              <View style={[styles.attemptsBadge, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                <Text style={[styles.attemptsText, { color: '#ef4444' }]}>Locked Out</Text>
              </View>
            )}
          </View>

          {showForgotPin && renderForgotPin()}

          {!showForgotPin && hasBiometric && !isLockedOut && (
            <View style={styles.biometricSection}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                disabled={isLoading || unlockInProgress.current}
                activeOpacity={0.8}
              >
                <View style={styles.biometricIconWrapper}>
                  <View style={styles.biometricIconBg}>
                    <Ionicons name={biometricInfo.icon as any} size={50} color="#fff" />
                  </View>
                  {isLoading && (
                    <View style={styles.biometricLoadingRing}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.biometricLabel, { color: 'rgba(255,255,255,0.9)' }]}>
                  {isLoading ? 'Authenticating...' : `Tap to use ${biometricInfo.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showForgotPin && hasPin && (
            <View style={styles.pinSection}>
              {renderPinDots()}
              {isLoading && (
                <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
              )}
              {renderKeypad()}
            </View>
          )}

          {!showForgotPin && !hasBiometric && !hasPin && !isLockedOut && (
            <View style={styles.noSecurityContainer}>
              <Ionicons name="lock-open-outline" size={48} color="#fff" />
              <Text style={[styles.noSecurityTitle, { color: '#fff' }]}>
                No Security Enabled
              </Text>
              <Text style={[styles.noSecurityText, { color: 'rgba(255,255,255,0.8)' }]}>
                Tap below to unlock the app
              </Text>
              <TouchableOpacity
                style={[styles.unlockButton, { backgroundColor: '#fff' }]}
                onPress={async () => {
                  await forceUnlock?.();
                  sweetAlert.success('Unlocked', 'Welcome back!');
                  dismissLockScreen();
                }}
              >
                <Text style={[styles.unlockButtonText, { color: '#667eea' }]}>Unlock App</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.setupSecurityLink}
                onPress={() => {
                  forceUnlock?.();
                  navigation.navigate('SecurityCenter', { mode: 'setup' });
                }}
              >
                <Text style={[styles.setupSecurityText, { color: '#fff' }]}>
                  Set Up Security Now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showForgotPin && hasPin && !isLockedOut && (
            <TouchableOpacity
              style={styles.forgotPinLink}
              onPress={() => {
                setShowForgotPin(true);
                setPin('');
              }}
            >
              <Text style={[styles.forgotPinLinkText, { color: 'rgba(255,255,255,0.8)' }]}>
                Forgot PIN?
              </Text>
            </TouchableOpacity>
          )}

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
              <Text style={[styles.emergencyText, { color: 'rgba(255,255,255,0.7)' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoFloatWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: 40 },
  avatarImage: { width: 80, height: 80, borderRadius: 24 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  attemptsBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  attemptsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  biometricSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  biometricButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  biometricIconWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  biometricLoadingRing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  pinSection: {
    width: '100%',
    alignItems: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 30,
    height: 24,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  loadingIndicator: { marginBottom: 20 },
  keypadContainer: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  keypadButton: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    maxWidth: 90,
    maxHeight: 90,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  keypadButtonSpecial: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  keypadButtonDisabled: { opacity: 0.4 },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  forgotPinLink: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  forgotPinLinkText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPinContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 12,
    marginVertical: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  forgotPinHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgotPinTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  forgotPinSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionCard: { marginBottom: 16 },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  answerInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
  },
  verifyButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backToPinButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  backToPinText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  noQuestionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noQuestionsText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 20,
    alignItems: 'center',
  },
  emergencyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  noSecurityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  noSecurityTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  noSecurityText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  unlockButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  setupSecurityLink: {
    marginTop: 8,
    paddingVertical: 8,
  },
  setupSecurityText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});