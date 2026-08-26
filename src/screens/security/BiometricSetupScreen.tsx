// screens/security/BiometricSetupScreen.tsx - COMPLETE FIXED VERSION FOR SAMSUNG A06
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Easing, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View, Animated, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSecurity, BiometricTypeConfig } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';

type BiometricSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

interface BiometricIconProps {
  isScanning: boolean;
  isDark: boolean;
  biometricType: BiometricTypeConfig;
  shouldReduceMotion: boolean;
  themeColors: {
    primary: string;
    secondary: string;
  };
}

const BiometricIcon = ({ isScanning, isDark, biometricType, shouldReduceMotion, themeColors }: BiometricIconProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldReduceMotion) {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
      return;
    }
    if (isScanning) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ]),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }

    return () => {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    };
  }, [isScanning, pulseAnim, rotateAnim, shouldReduceMotion]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isFace = biometricType.name.includes('Face');

  return (
    <Animated.View
      style={[
        styles.biometricIconContainer,
        { transform: [{ scale: pulseAnim }, { rotate: isScanning ? rotate : '0deg' }] },
      ]}
    >
      <LinearGradient
        colors={
          isScanning
            ? [themeColors.primary, themeColors.secondary]
            : isDark
              ? ['#334155', '#475569']
              : ['#e0e7ff', '#c7d2fe']
        }
        style={styles.biometricGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons
          name={biometricType.icon as any}
          size={50}
          color={isScanning ? '#fff' : isDark ? '#a3bffa' : themeColors.primary}
        />
      </LinearGradient>
      {isScanning && isFace && (
        <View style={styles.scanningOverlay}>
          <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />
        </View>
      )}
    </Animated.View>
  );
};

export default function BiometricSetupScreen({ navigation }: BiometricSetupScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<BiometricTypeConfig[]>([]);
  const [selectedType, setSelectedType] = useState<BiometricTypeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  const { 
    toggleBiometric, 
    resetUnlockLock, 
    getAvailableBiometricTypes,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    availableBiometricTypes: contextTypes,
    getBiometricTypeName,
  } = useSecurity();
  const { userProfile } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const { toast, error: showError, success: showSuccess } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const userName = userProfile?.fullName || 'there';
  const successScale = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main' as never);
    }
  }, [navigation]);

  // ✅ FIXED: Properly detect biometric types for Samsung A06
  useEffect(() => {
    let mounted = true;

    const checkBiometrics = async () => {
      try {
        setIsLoading(true);
        console.log('[BiometricSetup] Checking biometrics...');
        
        let hasHardware = false;
        let isEnrolled = false;
        let types: LocalAuthentication.AuthenticationType[] = [];

        try {
          hasHardware = await LocalAuthentication.hasHardwareAsync();
          console.log('[BiometricSetup] Has hardware:', hasHardware);
        } catch (e) {
          console.warn('[BiometricSetup] hasHardwareAsync failed:', e);
        }

        if (hasHardware) {
          try {
            isEnrolled = await LocalAuthentication.isEnrolledAsync();
            console.log('[BiometricSetup] Is enrolled:', isEnrolled);
          } catch (e) {
            console.warn('[BiometricSetup] isEnrolledAsync failed:', e);
          }

          try {
            types = await LocalAuthentication.supportedAuthenticationTypesAsync() || [];
            console.log('[BiometricSetup] Supported types:', types);
          } catch (e) {
            console.warn('[BiometricSetup] supportedAuthenticationTypesAsync failed:', e);
          }
        }

        // ✅ FIXED: For Samsung A06, even if enrollment check fails, try to proceed
        // Sometimes Samsung devices return false for isEnrolled even when biometrics are set up
        if (hasHardware && !isEnrolled) {
          console.log('[BiometricSetup] isEnrolled returned false, but trying to proceed anyway');
          // Try to authenticate to verify
          try {
            const testAuth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Verify biometric setup',
              disableDeviceFallback: true,
            });
            if (testAuth.success) {
              isEnrolled = true;
              console.log('[BiometricSetup] Biometric verification successful');
            }
          } catch (e) {
            console.log('[BiometricSetup] Test auth failed:', e);
          }
        }

        // If we have hardware but no types, assume fingerprint
        if (hasHardware && types.length === 0) {
          console.log('[BiometricSetup] No types detected, assuming fingerprint');
          types = [LocalAuthentication.AuthenticationType.FINGERPRINT];
        }

        if (mounted) {
          setHasHardware(hasHardware);
          setIsEnrolled(isEnrolled && hasHardware);

          // Get available types from context or build manually
          let configs: BiometricTypeConfig[] = [];
          
          try {
            const contextConfigs = await getAvailableBiometricTypes();
            if (contextConfigs && contextConfigs.length > 0) {
              configs = contextConfigs;
            }
          } catch (e) {
            console.warn('[BiometricSetup] getAvailableBiometricTypes failed:', e);
          }

          // If no configs from context, build manually
          if (configs.length === 0 && hasHardware) {
            console.log('[BiometricSetup] Building manual configs');
            const manualConfigs: BiometricTypeConfig[] = [];
            
            if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
              manualConfigs.push({
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
              manualConfigs.push({
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

            // If still no configs but we have hardware, add a generic one
            if (manualConfigs.length === 0) {
              manualConfigs.push({
                type: LocalAuthentication.AuthenticationType.FINGERPRINT,
                name: 'Biometric',
                icon: 'finger-print',
                iconFilled: 'finger-print',
                label: 'Biometric Authentication',
                description: 'Use your device biometrics to unlock',
                color: '#667eea',
                gradient: ['#667eea', '#764ba2'],
                isAvailable: true,
              });
            }
            
            configs = manualConfigs;
          }

          setAvailableTypes(configs);
          if (configs.length > 0) {
            setSelectedType(configs[0]);
          }
        }
      } catch (error) {
        console.error('[BiometricSetup] Biometric check failed:', error);
        if (mounted) {
          setHasHardware(false);
          setIsEnrolled(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    resetUnlockLock();
    checkBiometrics();

    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [navigation, resetUnlockLock, getAvailableBiometricTypes]);

  // Animate in
  useEffect(() => {
    if (!shouldReduceMotion) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [shouldReduceMotion]);

  // Success animation
  useEffect(() => {
    if (setupComplete) {
      if (shouldReduceMotion) {
        successScale.setValue(1);
      } else {
        Animated.spring(successScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }

      setTimeout(() => {
        safeGoBack();
      }, 2000);
    }
  }, [setupComplete, safeGoBack, shouldReduceMotion]);

  const handleEnableBiometric = async () => {
    if (!selectedType) {
      showError('Error', 'Please select a biometric method');
      return;
    }

    if (!hasHardware) {
      Alert.alert(
        'Not Available',
        'This device does not support biometric authentication.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsScanning(true);
    triggerHaptic('medium');

    try {
      const enabled = await toggleBiometric(true);
      setIsScanning(false);

      if (enabled) {
        triggerHaptic('success');
        setSetupComplete(true);
        showSuccess('Enabled!', `${selectedType.name} is now active for ${userName}`);
      } else {
        showError('Cancelled', 'Biometric setup was cancelled');
      }
    } catch (error) {
      console.error('Biometric error:', error);
      setIsScanning(false);
      showError('Error', 'An error occurred during authentication');
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

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar barStyle={isDark ? 'light' : 'dark'} />
        <LinearGradient
          colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : [themeColors.primary, themeColors.secondary, themeColors.accent]}
          style={styles.gradient}
        />
        <View style={[styles.content, { paddingTop: insets.top + 40, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: isDark ? '#94a3b8' : '#fff' }]}>
            Checking biometric availability...
          </Text>
        </View>
      </View>
    );
  }

  if (setupComplete) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar barStyle={isDark ? 'light' : 'dark'} />
        <LinearGradient
          colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : [themeColors.primary, themeColors.secondary, themeColors.accent]}
          style={styles.gradient}
        />
        <View style={[styles.content, { paddingTop: insets.top + 100, justifyContent: 'center', alignItems: 'center' }]}>
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <View style={[styles.successCircle, isDark && styles.successCircleDark]}>
              <Ionicons name="checkmark" size={60} color="#fff" />
            </View>
            <Text style={[styles.successTitle, { color: isDark ? '#fff' : '#fff' }]}>
              {selectedType?.name || 'Biometric'} Enabled!
            </Text>
            <Text style={[styles.successSubtitle, { color: isDark ? '#cbd5e1' : 'rgba(255,255,255,0.9)' }]}>
              You can now unlock LittleLoom securely, {userName}
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  const hasBiometricAvailable = hasHardware && isEnrolled;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : [themeColors.primary, themeColors.secondary, themeColors.accent]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View style={[styles.content, { paddingTop: insets.top + 20, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, isDark && styles.backButtonDark]}
            onPress={safeGoBack}
          >
            <Ionicons name="close" size={24} color={isDark ? '#fff' : themeColors.primary} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.mainContent}>
            {selectedType && (
              <View style={styles.iconWrapper}>
                <BiometricIcon
                  isScanning={isScanning}
                  isDark={isDark}
                  biometricType={selectedType}
                  shouldReduceMotion={shouldReduceMotion}
                  themeColors={themeColors}
                />
              </View>
            )}

            <Text style={[styles.title, { color: isDark ? '#fff' : '#fff' }]}>
              {availableTypes.length > 1 ? 'Choose Biometric Method' : `Enable ${availableTypes[0]?.name || 'Biometric'}`}
            </Text>

            <Text style={[styles.subtitle, { color: isDark ? '#cbd5e1' : 'rgba(255,255,255,0.9)' }]}>
              {hasBiometricAvailable
                ? `Hi ${userName}, use biometric authentication for quick and secure access to your baby's memories.`
                : hasHardware 
                  ? 'Please set up biometrics in your device settings first, then try again.'
                  : 'Biometric authentication is not available on this device.'}
            </Text>

            {/* Show available biometric options */}
            {availableTypes.length > 0 && hasBiometricAvailable && (
              <View style={styles.optionsContainer}>
                {availableTypes.map((config) => (
                  <TouchableOpacity
                    key={config.type}
                    style={[
                      styles.optionCard,
                      selectedType?.type === config.type && { borderColor: themeColors.primary },
                      isDark && styles.optionCardDark,
                    ]}
                    onPress={() => selectBiometricType(config)}
                    disabled={isScanning}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        {
                          backgroundColor:
                            selectedType?.type === config.type
                              ? themeColors.primary + '33'
                              : 'rgba(100,116,139,0.1)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={(config.iconFilled || config.icon) as any}
                        size={28}
                        color={
                          selectedType?.type === config.type
                            ? themeColors.primary
                            : isDark
                              ? '#94a3b8'
                              : '#64748b'
                        }
                      />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionName, { color: isDark ? '#fff' : '#1e293b' }]}>
                        {config.name}
                      </Text>
                      <Text style={[styles.optionDescription, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                        {config.description}
                      </Text>
                    </View>
                    {selectedType?.type === config.type && (
                      <Ionicons name="checkmark-circle" size={24} color={themeColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {hasBiometricAvailable && (
              <View style={styles.benefitsContainer}>
                {[
                  { icon: 'flash', text: 'Quick Access', color: themeColors.primary },
                  { icon: 'shield-checkmark', text: 'Secure', color: '#11998e' },
                  { icon: 'happy', text: 'Convenient', color: '#f59e0b' },
                ].map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <View style={[styles.benefitIcon, { backgroundColor: `${benefit.color}20` }]}>
                      <Ionicons name={benefit.icon as any} size={20} color={benefit.color} />
                    </View>
                    <Text style={[styles.benefitText, { color: isDark ? '#cbd5e1' : 'rgba(255,255,255,0.9)' }]}>
                      {benefit.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {hasBiometricAvailable ? (
            <>
              <TouchableOpacity
                style={[styles.enableButton, (!selectedType || isScanning) && styles.enableButtonDisabled]}
                onPress={handleEnableBiometric}
                disabled={!selectedType || isScanning}
              >
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {isScanning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.enableButtonContent}>
                    <Ionicons name={selectedType?.icon || 'finger-print'} size={24} color="#fff" />
                    <Text style={styles.enableText}>Enable {selectedType?.name || 'Biometric'}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isScanning}>
                <Text style={[styles.skipText, { color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)' }]}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.unavailableCard, isDark && styles.unavailableCardDark]}>
                <Ionicons name="alert-circle" size={48} color="#ef4444" />
                <Text style={[styles.unavailableTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                  {!hasHardware ? 'Not Supported' : 'Not Set Up'}
                </Text>
                <Text style={[styles.unavailableText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {!hasHardware
                    ? 'This device does not support biometric authentication.'
                    : 'Please set up biometrics in your device settings first, then try again.'}
                </Text>
                {!hasHardware && (
                  <Text style={[styles.unavailableText, { color: isDark ? '#94a3b8' : '#64748b', marginTop: 8 }]}>
                    You can still use PIN or password protection.
                  </Text>
                )}
              </View>

              <TouchableOpacity style={styles.enableButton} onPress={safeGoBack}>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.enableText}>Go Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonDark: {
    backgroundColor: 'rgba(30,41,59,0.8)',
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  iconWrapper: {
    marginBottom: 32,
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 70,
  },
  scanLine: {
    width: 140,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardDark: {
    backgroundColor: 'rgba(30,41,59,0.8)',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 32,
  },
  benefitItem: {
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  enableButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  enableButtonDisabled: {
    opacity: 0.5,
  },
  enableButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  enableText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    alignSelf: 'center',
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  unavailableCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  unavailableCardDark: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  unavailableTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#11998e',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    shadowColor: '#11998e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successCircleDark: {
    shadowColor: '#0d9488',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});