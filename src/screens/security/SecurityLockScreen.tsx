// screens/security/SecurityLockScreen.tsx - COMPLETE FIXED with custom modals
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

// ─── Custom Modal Component ────────────────────────────────────────────
interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  iconColor?: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  isDark: boolean;
  primaryColor: string;
}

const CustomModal = React.memo<CustomModalProps>(({
  visible,
  onClose,
  title,
  message,
  icon = 'information-circle',
  iconColor,
  primaryAction,
  secondaryAction,
  isDark,
  primaryColor,
}) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 20, tension: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Pressable style={styles.customModalOverlay} onPress={onClose}>
      <Animated.View
        style={[
          styles.customModalContent,
          isDark && styles.customModalContentDark,
          { transform: [{ scale }], opacity },
        ]}
      >
        <BlurView
          intensity={isDark ? 60 : 90}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <View style={[styles.customModalIconWrap, { backgroundColor: `${iconColor || primaryColor}15` }]}>
          <Ionicons name={icon as any} size={32} color={iconColor || primaryColor} />
        </View>

        <Text style={[styles.customModalTitle, isDark && styles.textLight]}>{title}</Text>
        <Text style={[styles.customModalDesc, isDark && styles.textMuted]}>{message}</Text>

        <View style={styles.customModalButtons}>
          {secondaryAction && (
            <TouchableOpacity
              style={[styles.customModalSecondaryBtn, { borderColor: `${primaryColor}30`, borderWidth: 1 }]}
              onPress={() => { secondaryAction.onPress(); onClose(); }}
            >
              <Text style={[styles.customModalSecondaryBtnText, { color: primaryColor }]}>
                {secondaryAction.label}
              </Text>
            </TouchableOpacity>
          )}
          {primaryAction && (
            <TouchableOpacity
              style={[styles.customModalPrimaryBtn, { backgroundColor: primaryColor }]}
              onPress={() => { primaryAction.onPress(); onClose(); }}
            >
              <Text style={styles.customModalPrimaryBtnText}>{primaryAction.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});

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

  // ─── Modal States ────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    icon?: string;
    iconColor?: string;
    primaryAction?: { label: string; onPress: () => void };
    secondaryAction?: { label: string; onPress: () => void };
  } | null>(null);

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
  } = useSecurity();
  
  const effectiveBiometricEnabled = isBiometricEnabled ?? false;

  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const insets = useSafeAreaInsets();

  // ─── Custom Modal Helpers ──────────────────────────────────────────────
  const showModal = useCallback((config: {
    title: string;
    message: string;
    icon?: string;
    iconColor?: string;
    primaryAction?: { label: string; onPress: () => void };
    secondaryAction?: { label: string; onPress: () => void };
  }) => {
    setModalConfig(config);
    setModalVisible(true);
  }, []);

  const hideModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setModalConfig(null), 300);
  }, []);

  const showToast = useCallback((title: string, message?: string) => {
    showModal({
      title,
      message: message || '',
      icon: 'information-circle',
      iconColor: themeColors.primary,
      primaryAction: { label: 'OK', onPress: hideModal },
    });
  }, [showModal, hideModal, themeColors.primary]);

  const showError = useCallback((title: string, message?: string) => {
    showModal({
      title,
      message: message || '',
      icon: 'alert-circle',
      iconColor: '#ef4444',
      primaryAction: { label: 'OK', onPress: hideModal },
    });
  }, [showModal, hideModal]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    showModal({
      title,
      message,
      icon: 'warning',
      iconColor: '#f59e0b',
      primaryAction: { label: confirmText, onPress: onConfirm },
      secondaryAction: { label: cancelText, onPress: onCancel || hideModal },
    });
  }, [showModal, hideModal]);

  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric || isBiometricHardwareAvailable;
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
    // Refresh biometric status on mount
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
        showToast('Verified!', 'Redirecting to PIN reset...');

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

  // ─── FIXED: Auto-prompt biometric with better state handling ──────────
  useEffect(() => {
    if (!effectiveBiometricEnabled) return;
    if (!isBiometricHardwareAvailable) return;
    if (isLockedOut) return;
    if (unlockInProgress.current) return;
    if (!isBiometricEnrolled) {
      // Try to refresh enrollment status
      refreshBiometricStatus();
      return;
    }

    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      // Refresh biometric status when screen comes into focus
      refreshBiometricStatus();
    });

    if (autoPromptTimer.current) {
      clearTimeout(autoPromptTimer.current);
    }

    // Delay auto-prompt to let UI settle
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
    isBiometricEnrolled,
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
      // Refresh biometric status on focus
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
    showConfirm(
      'Too Many Attempts',
      'For security purposes, you need to sign out and sign in again.',
      async () => {
        await forceUnlock?.();
        signOut();
      },
      undefined,
      'Sign Out',
      'Cancel'
    );
  }, [signOut, forceUnlock, triggerHaptic, showConfirm]);

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
          showToast('Welcome Back!', `Good to see you, ${userName}`);
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
    [unlockApp, shake, attempts, isLockedOut, handleLockout, triggerHaptic, userName, showToast, showError, forceUnlock, dismissLockScreen]
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

  // ─── FIXED: Biometric authentication with better state handling ──────
  const handleBiometricAuth = useCallback(async () => {
    // First check if biometrics are available
    if (!isBiometricHardwareAvailable) {
      console.log('[SecurityLock] No biometric hardware');
      return;
    }
    
    // Refresh biometric status before attempting
    await refreshBiometricStatus();
    
    if (!effectiveBiometricEnabled) {
      console.log('[SecurityLock] Biometric not enabled');
      return;
    }
    
    if (isLockedOut || isLoading || unlockInProgress.current) {
      console.log('[SecurityLock] Locked or in progress');
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
        showToast('Welcome Back!', `Good to see you, ${userName}`);
        await forceUnlock?.();
        dismissLockScreen();
      } else {
        triggerHaptic('error');
        shake();
      }
    } catch (error) {
      console.error('[SecurityLock] Biometric error:', error);
      if (error instanceof Error && error.message.includes('not_enrolled')) {
        showError('Biometric Not Set Up', 'Please set up biometrics in your device settings first.');
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
    isLockedOut,
    isLoading,
    unlockApp,
    resetUnlockLock,
    shake,
    triggerHaptic,
    userName,
    showToast,
    showError,
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
              {typeof userAvatar === 'number' ? (
                <Image source={userAvatar} style={styles.avatarImage} resizeMode="cover" />
              ) : typeof userAvatar === 'string' && (userAvatar.startsWith('file://') || userAvatar.startsWith('http://') || userAvatar.startsWith('https://') || userAvatar.startsWith('data:')) ? (
                <Image source={{ uri: userAvatar }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{userAvatar}</Text>
              )}
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

          {showForgotPin && renderForgotPin()}

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

          {!showForgotPin && hasPin && (
            <View style={styles.pinSection}>
              {renderPinDots()}
              {isLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />
              )}
              {renderKeypad()}
            </View>
          )}

          {!showForgotPin && !hasBiometric && !hasPin && !isLockedOut && (
            <View style={styles.noSecurityContainer}>
              <Ionicons name="lock-open-outline" size={48} color={colors.primary} />
              <Text style={[styles.noSecurityTitle, { color: colors.text }]}>
                No Security Enabled
              </Text>
              <Text style={[styles.noSecurityText, { color: colors.textSecondary }]}>
                Tap below to unlock the app
              </Text>
              <TouchableOpacity
                style={[styles.unlockButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  await forceUnlock?.();
                  showToast('Unlocked', 'Welcome back!');
                  dismissLockScreen();
                }}
              >
                <Text style={styles.unlockButtonText}>Unlock App</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.setupSecurityLink}
                onPress={() => {
                  forceUnlock?.();
                  navigation.navigate('SecurityCenter', { mode: 'setup' });
                }}
              >
                <Text style={[styles.setupSecurityText, { color: colors.primary }]}>
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
              <Text style={[styles.forgotPinLinkText, { color: colors.primary }]}>
                Forgot PIN?
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={() => {
                showConfirm(
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

      {/* ─── Custom Modal ──────────────────────────────────────────────── */}
      <CustomModal
        visible={modalVisible}
        onClose={hideModal}
        title={modalConfig?.title || ''}
        message={modalConfig?.message || ''}
        icon={modalConfig?.icon}
        iconColor={modalConfig?.iconColor}
        primaryAction={modalConfig?.primaryAction}
        secondaryAction={modalConfig?.secondaryAction}
        isDark={isDark}
        primaryColor={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
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
  keypadButtonDisabled: { opacity: 0.3 },
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
  noSecurityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    color: '#fff',
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
  // ─── Custom Modal Styles ──────────────────────────────────────────────
  customModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  customModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  customModalContentDark: {
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  customModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  customModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  customModalDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  customModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  customModalPrimaryBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  customModalSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  customModalSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  textLight: { color: '#ffffff' },
  textMuted: { color: '#888' },
});