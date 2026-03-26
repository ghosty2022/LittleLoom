// src/screens/SecurityLockScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  useColorScheme,
  Dimensions,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type SecurityLockScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityLock'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

// Modern color palette
const COLORS = {
  primary: { light: '#667eea', dark: '#a3bffa' },
  danger: { light: '#ff4757', dark: '#ff6b6b' },
  warning: { light: '#ffa502', dark: '#ffc107' },
  success: { light: '#43e97b', dark: '#51cf66' },
  text: { light: '#1a1a1a', dark: '#ffffff' },
  subtext: { light: '#666', dark: '#a0a0a0' },
  glass: { light: 'rgba(255,255,255,0.85)', dark: 'rgba(30,30,40,0.75)' },
  glassBorder: { light: 'rgba(255,255,255,0.5)', dark: 'rgba(255,255,255,0.1)' },
};

export default function SecurityLockScreen({ navigation }: SecurityLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [hasCheckedBiometric, setHasCheckedBiometric] = useState(false);
  
  const { signOut } = useAuth();
  const { 
    unlockApp, 
    settings: securitySettings, 
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    authenticateWithBiometric,
    getAvailableAuthMethods,
    checkBiometricCapabilities,
  } = useSecurity();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric;
  const hasPin = availableMethods.hasPin;

  // Check biometric capabilities
  useEffect(() => {
    const init = async () => {
      await checkBiometricCapabilities();
      
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        let typeName = 'Biometric';
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          typeName = 'Face ID';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          typeName = 'Fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          typeName = 'Iris';
        }
        setBiometricType(typeName);
      } catch (error) {
        console.error('Error getting biometric type:', error);
      }
    };
    
    init();
  }, [checkBiometricCapabilities]);

  // Auto-attempt biometric
  useEffect(() => {
    if (hasCheckedBiometric) return;
    if (!securitySettings.isBiometricEnabled) return;
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (pin.length > 0) return;

    const timer = setTimeout(() => {
      setHasCheckedBiometric(true);
      handleBiometricAuth();
    }, 800);
    
    return () => clearTimeout(timer);
  }, [
    securitySettings.isBiometricEnabled, 
    isBiometricHardwareAvailable, 
    isBiometricEnrolled,
    hasCheckedBiometric,
    pin.length
  ]);

  // Re-check on foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !isLockedOut && !isLoading) {
        if (securitySettings.isBiometricEnabled && hasBiometric && pin.length === 0) {
          handleBiometricAuth();
        }
      }
    });
    
    return () => subscription.remove();
  }, [securitySettings.isBiometricEnabled, hasBiometric, isLockedOut, isLoading, pin.length]);

  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleLockout = useCallback(() => {
    setIsLockedOut(true);
    Alert.alert(
      'Too Many Attempts',
      'For security, you must logout and login again.',
      [{ 
        text: 'Logout', 
        onPress: () => signOut(),
        style: 'destructive'
      }]
    );
  }, [signOut]);

  const handlePinComplete = useCallback(async (completedPin: string) => {
    if (isLockedOut) return;
    
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
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
            Alert.alert('Incorrect PIN', `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
      } else {
        setAttempts(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('PIN unlock error:', error);
      shake();
      setPin('');
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [unlockApp, shake, attempts, isLockedOut, handleLockout]);

  const handleNumberPress = useCallback((num: string) => {
    if (pin.length < PIN_LENGTH && !isLoading && !isLockedOut) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => handlePinComplete(newPin), 100);
      }
    }
  }, [pin, isLoading, isLockedOut, handlePinComplete]);

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !isLoading && !isLockedOut) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin(pin.slice(0, -1));
    }
  }, [pin, isLoading, isLockedOut]);

  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (!securitySettings.isBiometricEnabled) return;
    if (isLockedOut || isLoading) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await authenticateWithBiometric(`Unlock with ${biometricType}`);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await unlockApp('biometric');
      } else {
        if (result.error === 'user_cancel') return;
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (result.error === 'not_enrolled' || result.error === 'not_available') {
          Alert.alert('Biometric Unavailable', 'Please use your PIN.');
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
      Alert.alert('Error', 'Biometric authentication failed.');
    } finally {
      setIsLoading(false);
    }
  }, [
    isBiometricHardwareAvailable, 
    isBiometricEnrolled, 
    securitySettings.isBiometricEnabled, 
    isLockedOut, 
    isLoading, 
    authenticateWithBiometric, 
    biometricType, 
    unlockApp
  ]);

  const renderPinDots = () => (
    <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.pinDot,
            isDark && styles.pinDotDark,
            index < pin.length && styles.pinDotFilled,
            index < pin.length && isDark && styles.pinDotFilledDark,
            isLoading && styles.pinDotLoading,
          ]}
        />
      ))}
    </Animated.View>
  );

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['biometric', '0', 'delete'],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => {
              if (key === 'biometric') {
                const showBiometric = isBiometricHardwareAvailable && 
                                     isBiometricEnrolled && 
                                     securitySettings.isBiometricEnabled;
                
                if (!showBiometric) {
                  return <View key={key} style={styles.keypadButtonPlaceholder} />;
                }
                
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keypadButton, styles.biometricButton]}
                    onPress={handleBiometricAuth}
                    disabled={isLoading || isLockedOut}
                  >
                    <Ionicons 
                      name={biometricType.includes('Face') ? 'scan-outline' : 'finger-print'} 
                      size={28} 
                      color={isDark ? COLORS.primary.dark : COLORS.primary.light} 
                    />
                  </TouchableOpacity>
                );
              }

              if (key === 'delete') {
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keypadButton, styles.deleteButton]}
                    onPress={handleDelete}
                    disabled={pin.length === 0 || isLoading || isLockedOut}
                  >
                    <Ionicons 
                      name="backspace" 
                      size={24} 
                      color={pin.length > 0 ? (isDark ? '#fff' : '#1a1a1a') : '#999'} 
                    />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.keypadButton,
                    isDark && styles.keypadButtonDark,
                    (isLoading || isLockedOut) && styles.keypadButtonDisabled
                  ]}
                  onPress={() => handleNumberPress(key)}
                  disabled={isLoading || isLockedOut}
                >
                  <Text style={[
                    styles.keypadButtonText,
                    isDark && styles.keypadButtonTextDark,
                    (isLoading || isLockedOut) && styles.keypadButtonTextDisabled
                  ]}>
                    {key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const getAuthSubtitle = () => {
    const biometricReady = isBiometricHardwareAvailable && 
                          isBiometricEnrolled && 
                          securitySettings.isBiometricEnabled;
    
    if (biometricReady && securitySettings.isPinEnabled) {
      return `Use ${biometricType} or enter your PIN`;
    }
    if (biometricReady) {
      return `Use ${biometricType} to unlock`;
    }
    if (securitySettings.isPinEnabled) {
      return 'Enter your PIN to unlock';
    }
    return 'Security lock enabled';
  };

  return (
    <LinearGradient
      colors={isDark ? ['#0f0f1e', '#1a1a2e', '#16213e'] : ['#f8faff', '#f0f4ff', '#e8eeff']}
      style={styles.container}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
        {/* Glass Card Container */}
        <BlurView 
          intensity={isDark ? 60 : 90} 
          style={styles.glassCard} 
          tint={isDark ? 'dark' : 'light'}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.lockIconContainer, isDark && styles.lockIconContainerDark]}>
              <Ionicons 
                name="lock-closed" 
                size={40} 
                color={isDark ? COLORS.primary.dark : COLORS.primary.light} 
              />
            </View>
            <Text style={[styles.title, isDark && styles.titleDark]}>App Locked</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              {getAuthSubtitle()}
            </Text>
            
            {attempts > 0 && !isLockedOut && (
              <View style={styles.attemptsBadge}>
                <Text style={styles.attemptsText}>
                  {MAX_ATTEMPTS - attempts} attempts left
                </Text>
              </View>
            )}
            
            {isLockedOut && (
              <View style={[styles.attemptsBadge, styles.lockedOutBadge]}>
                <Text style={styles.lockedOutText}>Locked out</Text>
              </View>
            )}
          </View>

          {/* PIN Dots */}
          {securitySettings.isPinEnabled && renderPinDots()}

          {/* Loading */}
          {isLoading && (
            <ActivityIndicator 
              size="large" 
              color={isDark ? COLORS.primary.dark : COLORS.primary.light} 
              style={styles.loadingIndicator}
            />
          )}

          {/* Keypad */}
          <View style={styles.keypadContainer}>
            {securitySettings.isPinEnabled ? (
              renderKeypad()
            ) : (isBiometricHardwareAvailable && isBiometricEnrolled && securitySettings.isBiometricEnabled) ? (
              <TouchableOpacity
                style={styles.biometricOnlyButton}
                onPress={handleBiometricAuth}
                disabled={isLoading || isLockedOut}
              >
                <View style={[styles.biometricIconLarge, isDark && styles.biometricIconLargeDark]}>
                  <Ionicons 
                    name={biometricType.includes('Face') ? 'scan-outline' : 'finger-print'} 
                    size={64} 
                    color={isDark ? COLORS.primary.dark : COLORS.primary.light} 
                  />
                </View>
                <Text style={[styles.biometricOnlyText, isDark && styles.biometricOnlyTextDark]}>
                  Tap to unlock
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noAuthContainer}>
                <Ionicons name="warning" size={48} color={COLORS.danger.light} />
                <Text style={[styles.noAuthText, isDark && styles.noAuthTextDark]}>
                  No authentication method available
                </Text>
              </View>
            )}
          </View>
        </BlurView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.emergencyButton}
            onPress={() => {
              Alert.alert(
                'Emergency Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Logout', 
                    style: 'destructive',
                    onPress: () => signOut()
                  }
                ]
              );
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger.light} />
            <Text style={styles.emergencyText}>Emergency Logout</Text>
          </TouchableOpacity>
          
          <View style={styles.securityNoteContainer}>
            <Ionicons name="shield-checkmark" size={14} color={isDark ? '#666' : '#999'} />
            <Text style={[styles.securityNote, isDark && styles.securityNoteDark]}>
              Secured by LittleLoom
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  glassCard: {
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  lockIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(102,126,234,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  lockIconContainerDark: {
    backgroundColor: 'rgba(102,126,234,0.25)',
    borderColor: 'rgba(163,191,250,0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text.light,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  titleDark: {
    color: COLORS.text.dark,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subtext.light,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleDark: {
    color: COLORS.subtext.dark,
  },
  attemptsBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,165,2,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lockedOutBadge: {
    backgroundColor: 'rgba(255,71,87,0.15)',
  },
  attemptsText: {
    fontSize: 13,
    color: COLORS.warning.light,
    fontWeight: '700',
  },
  lockedOutText: {
    fontSize: 13,
    color: COLORS.danger.light,
    fontWeight: '700',
  },
  
  // PIN Dots
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
    height: 24,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary.light,
    backgroundColor: 'transparent',
  },
  pinDotDark: {
    borderColor: COLORS.primary.dark,
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary.light,
  },
  pinDotFilledDark: {
    backgroundColor: COLORS.primary.dark,
  },
  pinDotLoading: {
    opacity: 0.5,
  },
  
  // Keypad
  keypadContainer: {
    width: '100%',
  },
  keypad: {
    gap: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  keypadButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  keypadButtonDark: {
    backgroundColor: 'rgba(40,40,50,0.9)',
  },
  keypadButtonDisabled: {
    opacity: 0.3,
  },
  keypadButtonPlaceholder: {
    width: 76,
    height: 76,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.text.light,
  },
  keypadButtonTextDark: {
    color: COLORS.text.dark,
  },
  keypadButtonTextDisabled: {
    color: '#999',
  },
  biometricButton: {
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Biometric Only
  biometricOnlyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 40,
  },
  biometricIconLarge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(102,126,234,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  biometricIconLargeDark: {
    backgroundColor: 'rgba(102,126,234,0.25)',
    borderColor: 'rgba(163,191,250,0.3)',
  },
  biometricOnlyText: {
    fontSize: 18,
    color: COLORS.primary.light,
    fontWeight: '700',
  },
  biometricOnlyTextDark: {
    color: COLORS.primary.dark,
  },
  
  // No Auth
  noAuthContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  noAuthText: {
    fontSize: 16,
    color: COLORS.subtext.light,
    textAlign: 'center',
  },
  noAuthTextDark: {
    color: COLORS.subtext.dark,
  },
  
  // Footer
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  emergencyText: {
    fontSize: 15,
    color: COLORS.danger.light,
    fontWeight: '700',
  },
  securityNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityNote: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  securityNoteDark: {
    color: '#666',
  },
  loadingIndicator: {
    marginBottom: 20,
  },
});