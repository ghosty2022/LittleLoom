import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Easing,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSecurity } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

type BiometricSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;
  label: string;
  description: string;
  color: string;
}

const getBiometricConfigs = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeConfig[] => {
  const configs: BiometricTypeConfig[] = [];
  types.forEach((type) => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        configs.push({
          type,
          name: 'Face ID',
          icon: 'scan-outline',
          label: 'Face Recognition',
          description: 'Use your face to unlock',
          color: '#667eea',
        });
        break;
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        configs.push({
          type,
          name: 'Fingerprint',
          icon: 'finger-print',
          label: 'Touch ID',
          description: 'Use your fingerprint to unlock',
          color: '#43e97b',
        });
        break;
      case LocalAuthentication.AuthenticationType.IRIS:
        configs.push({
          type,
          name: 'Iris Scan',
          icon: 'eye',
          label: 'Iris Recognition',
          description: 'Use your eyes to unlock',
          color: '#ffa502',
        });
        break;
    }
  });
  return configs;
};

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

  const { toggleBiometric, resetUnlockLock } = useSecurity();
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
      navigation.navigate('Main', { screen: 'Settings' });
    }
  }, [navigation]);

  useEffect(() => {
    resetUnlockLock();

    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    checkBiometricAvailability();

    if (shouldReduceMotion) {
      slideAnim.setValue(0);
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldReduceMotion]);

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

  const checkBiometricAvailability = async () => {
    try {
      const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setHasHardware(hardwareAvailable);
      setIsEnrolled(enrolled);

      if (hardwareAvailable && enrolled && types.length > 0) {
        const configs = getBiometricConfigs(types);
        setAvailableTypes(configs);
        setSelectedType(configs[0]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Biometric check failed:', error);
      setHasHardware(false);
      setIsEnrolled(false);
      setIsLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!selectedType) {
      showError('Error', 'Please select a biometric method');
      return;
    }

    if (!hasHardware || !isEnrolled) {
      showError('Not Available', 'Please set up biometrics in device settings');
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
          <ActivityIndicator size="large" color={themeColors.spinnerColor} />
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

        <AutoHideScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
              {hasHardware && isEnrolled
                ? `Hi ${userName}, use biometric authentication for quick and secure access to your baby's memories.`
                : 'Biometric authentication is not available on this device.'}
            </Text>

            {/* Multiple biometric options */}
            {availableTypes.length > 1 && hasHardware && isEnrolled && (
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
                        name={config.icon as any}
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

            {hasHardware && isEnrolled && (
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
        </AutoHideScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {hasHardware && isEnrolled ? (
            <>
              <TouchableOpacity
                style={[styles.enableButton, (!selectedType || isScanning) && styles.enableButtonDisabled]}
                onPress={handleEnableBiometric}
                disabled={!selectedType || isScanning}
              >
                <BlurView intensity={isDark ? 60 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
                  <LinearGradient
                    colors={[themeColors.primary, themeColors.secondary]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </BlurView>
                {isScanning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.enableButtonContent}>
                    <Ionicons name={selectedType?.icon as any || 'finger-print'} size={24} color="#fff" />
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
                    : 'Please set up biometrics in your device settings first.'}
                </Text>
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
