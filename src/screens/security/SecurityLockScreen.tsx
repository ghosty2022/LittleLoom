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
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSecurity } from '../../context/SecurityContext';
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

const BiometricIcon = ({
  type,
  size = 80,
  color,
  isDark,
  isScanning = false,
}: {
  type: BiometricTypeInfo;
  size?: number;
  color: string;
  isDark: boolean;
  isScanning?: boolean;
}) => {
  const iconName = isScanning && type.iconFilled ? type.iconFilled : type.icon;
  return (
    <View style={[styles.biometricIconContainer, { width: size, height: size }]}>
      <LinearGradient
        colors={isDark ? [`${color}33`, `${color}0d`] : [`${color}26`, `${color}05`]}
        style={[styles.biometricIconBg, { width: size, height: size }]}
      >
        <Ionicons name={iconName as any} size={size * 0.5} color={color} />
      </LinearGradient>
      {isScanning && (
        <View style={styles.scanningRing}>
          <View style={[styles.scanningDot, { borderColor: color }]} />
        </View>
      )}
    </View>
  );
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

  const { signOut, userProfile } = useAuth();
  const {
    unlockApp,
    forceUnlock,
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    getAvailableAuthMethods,
    resetUnlockLock,
  } = useSecurity();
  const biometricEnabled = isBiometricEnabled ?? false;
  
  // Fallback for older SecurityContext versions
  const effectiveBiometricEnabled = isBiometricEnabled ?? false;

  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, confirm } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric;
  const hasPin = availableMethods.hasPin;

  const userName = userProfile?.fullName || 'Welcome Back';
  const userAvatar = userProfile?.avatar || '👶';

  const colors = {
    background: isDark ? ['#0F172A', '#1E293B'] : ['#F8F9FE', '#EEF2FF'],
    primary: themeColors.primary,
    primaryLight: themeColors.secondary,
    text: isDark ? '#F8FAFC' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceHighlight: isDark ? '#334155' : '#F1F5F9',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  const isMounted = useRef(true);
  const autoPromptTimer = useRef<NodeJS.Timeout | null>(null);
  const unlockInProgress = useRef(false);
  const hasAutoPrompted = useRef(false);
  const handleBiometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  const lastUnlockAttemptRef = useRef<number>(0);

  useEffect(() => {
    loadSecurityQuestions();
  }, []);

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

const hashAnswer = async (answer: string): Promise<string> => {
    const normalized = answer.toLowerCase().trim();
    // React Native safe base64 encoding (btoa not available in all RN environments)
    try {
      return Buffer.from(normalized, 'utf8').toString('base64');
    } catch {
      // Fallback for environments without Buffer
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = normalized;
      let output = '';
      for (
        let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || ((map = '='), i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
      ) {
        charCode = str.charCodeAt((i += 3 / 4));
        if (charCode > 0xff) {
          throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
      }
      return output;
    }
  };

  const verifySecurityAnswers = async () => {
    if (verifyAnswers.some(a => a.trim().length === 0)) {
      showError('Incomplete', 'Please answer all questions');
      return;
    }

    setIsLoading(true);
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
        toast('Verified!', 'Redirecting to PIN reset...', 'success');

        setTimeout(() => {
          navigation.navigate('SecurityCenter', { 
            mode: 'reset', 
            fromForgotPassword: true 
          });
        }, 1500);
      } else {
        triggerHaptic('error');
        showError('Incorrect', 'One or more answers are wrong. Try again.');
        setVerifyAnswers(['', '', '']);
      }
    } finally {
      setIsLoading(false);
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

  useEffect(() => {
    if (!effectiveBiometricEnabled) return;
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (isLockedOut) return;
    if (hasAutoPrompted.current) return;
    if (unlockInProgress.current) return;

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
    }, 600);

    return () => {
      if (autoPromptTimer.current) {
        clearTimeout(autoPromptTimer.current);
      }
    };
  }, [
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    isLockedOut,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      unlockInProgress.current = false;
      resetUnlockLock();
      setShowForgotPin(false);
      setVerifyAnswers(['', '', '']);
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

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
    showError('Too Many Attempts', 'For security purposes, you need to sign out and sign in again.');
    setTimeout(() => {
      confirm(
        'Too Many Attempts',
        'For security purposes, you need to sign out and sign in again.',
        () => signOut(),
        undefined,
        'Sign Out',
        'Cancel'
      );
    }, 500);
  }, [signOut, triggerHaptic, showError, confirm]);

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
              showError('Incorrect PIN', `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
            }
          }
        } else {
          setAttempts(0);
          triggerHaptic('success');
          toast('Welcome Back!', `Good to see you, ${userName}`, 'success');
          // Ensure security lock is fully released
          forceUnlock?.();
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
    [unlockApp, shake, attempts, isLockedOut, handleLockout, triggerHaptic, userName, toast, showError]
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
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (!effectiveBiometricEnabled) return;
    if (isLockedOut || isLoading || unlockInProgress.current) return;

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
        toast('Welcome Back!', `Good to see you, ${userName}`, 'success');
        // Ensure security lock is fully released
        forceUnlock?.();
      } else {
        triggerHaptic('error');
        shake();
      }
    } catch (error) {
      console.error('Biometric error:', error);
    } finally {
      unlockInProgress.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    isBiometricEnabled,
    isLockedOut,
    unlockApp,
    resetUnlockLock,
    shake,
    triggerHaptic,
    userName,
    toast,
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
                backgroundColor: isFilled ? colors.primary : 'transparent',
                borderColor: isFilled ? colors.primary : colors.border,
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
                { backgroundColor: colors.surfaceHighlight },
                (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled,
              ]}
              onPress={() => handleNumberPress(key)}
              disabled={isLoading || isLockedOut || unlockInProgress.current}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadButtonText, { color: colors.text }]}>{key}</Text>
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
                color={colors.primary}
              />
            ) : (
              <View style={{ width: 28 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.keypadButton,
              { backgroundColor: colors.surfaceHighlight },
              (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled,
            ]}
            onPress={() => handleNumberPress('0')}
            disabled={isLoading || isLockedOut || unlockInProgress.current}
            activeOpacity={0.7}
          >
            <Text style={[styles.keypadButtonText, { color: colors.text }]}>0</Text>
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
              color={pin.length > 0 ? colors.textSecondary : colors.border}
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
                      backgroundColor: colors.surfaceHighlight,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Your answer"
                  placeholderTextColor={colors.textSecondary}
                  value={verifyAnswers[index]}
                  onChangeText={(text) => {
                    const newAnswers = [...verifyAnswers];
                    newAnswers[index] = text;
                    setVerifyAnswers(newAnswers);
                  }}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.verifyButton, { backgroundColor: colors.primary }]}
              onPress={verifySecurityAnswers}
              disabled={isLoading}
            >
              {isLoading ? (
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
              No security questions set up.{"\n"}
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
          <Text style={[styles.backToPinText, { color: colors.primary }]}>
            Back to PIN Entry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />

      <LinearGradient colors={colors.background as [string, string]} style={styles.gradient}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
              <Text style={styles.avatarText}>{userAvatar}</Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {isLockedOut ? 'Locked Out' : showForgotPin ? 'PIN Recovery' : `Welcome, ${userName}`}
            </Text>

            {!showForgotPin && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {hasBiometric && hasPin
                  ? `Use ${biometricInfo.name} or enter PIN`
                  : hasPin
                    ? 'Enter your PIN to continue'
                    : `Use ${biometricInfo.name} to unlock`}
              </Text>
            )}

            {attempts > 0 && !isLockedOut && !showForgotPin && (
              <View style={[styles.attemptsBadge, { backgroundColor: `${colors.warning}20` }]}>
                <Text style={[styles.attemptsText, { color: colors.warning }]}>
                  {MAX_ATTEMPTS - attempts} attempts remaining
                </Text>
              </View>
            )}

            {isLockedOut && (
              <View style={[styles.attemptsBadge, { backgroundColor: `${colors.error}20` }]}>
                <Text style={[styles.attemptsText, { color: colors.error }]}>Locked Out</Text>
              </View>
            )}
          </View>

          {/* Forgot PIN Overlay */}
          {showForgotPin && renderForgotPin()}

          {/* Biometric Section */}
          {!showForgotPin && hasBiometric && !isLockedOut && (
            <View style={styles.biometricSection}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                disabled={isLoading || unlockInProgress.current}
                activeOpacity={0.8}
              >
                <BiometricIcon type={biometricInfo} size={100} color={colors.primary} isDark={isDark} />
                <Text style={[styles.biometricLabel, { color: colors.primary }]}>
                  {isLoading ? 'Authenticating...' : `Tap to use ${biometricInfo.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PIN Section */}
          {!showForgotPin && hasPin && (
            <View style={styles.pinSection}>
              {renderPinDots()}
              {isLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />
              )}
              {renderKeypad()}
            </View>
          )}

          {/* Forgot PIN Link */}
          {!showForgotPin && hasPin && !isLockedOut && (
            <TouchableOpacity
              style={styles.forgotPinLink}
              onPress={() => {
                setShowForgotPin(true);
                setPin('');
              }}
            >
              <Text style={[styles.forgotPinLinkText, { color: colors.primary }]}>
                Forgot PIN?
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={() => {
                confirm(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  () => signOut(),
                  undefined,
                  'Sign Out',
                  'Cancel'
                );
              }}
            >
              <Text style={[styles.emergencyText, { color: colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  avatarText: {
    fontSize: 40,
  },
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
    marginBottom: 40,
    height: 140,
    justifyContent: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  biometricIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricIconBg: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  biometricLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  pinSection: {
    flex: 1,
    alignItems: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
    height: 24,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  loadingIndicator: {
    marginBottom: 20,
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  keypadButtonSpecial: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keypadButtonDisabled: {
    opacity: 0.3,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  forgotPinLink: {
    alignItems: 'center',
    marginTop: 20,
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
    marginVertical: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
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
  questionCard: {
    marginBottom: 16,
  },
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
  scanningRing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningDot: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
});