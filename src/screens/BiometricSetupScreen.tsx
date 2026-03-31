// src/screens/BiometricSetupScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Easing,
  useColorScheme,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type BiometricSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;
const { width } = Dimensions.get('window');

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }),
      ]).start();
      
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
        ]).start(() => onClose());
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning', bg: isDark ? '#1a1a2e' : '#fff' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View style={[{ opacity, transform: [{ scale }] }, styles.alertContainer, { backgroundColor: config.bg }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const BiometricIcon = ({ isScanning, isDark, biometricType }: { isScanning: boolean; isDark: boolean; biometricType: string }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [isScanning, pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isFace = biometricType.includes('Face');

  return (
    <Animated.View
      style={[
        styles.biometricIconContainer,
        { transform: [{ scale: pulseAnim }, { rotate: isScanning ? rotate : '0deg' }] },
      ]}
    >
      <LinearGradient
        colors={isScanning ? ['#667eea', '#764ba2'] : (isDark ? ['#334155', '#475569'] : ['#e0e7ff', '#c7d2fe'])}
        style={styles.biometricGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons 
          name={isFace ? 'scan-outline' : 'finger-print'} 
          size={50} 
          color={isScanning ? '#fff' : (isDark ? '#a3bffa' : '#667eea')} 
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
  const [availableTypes, setAvailableTypes] = useState<Array<{type: any, name: string, icon: string}>>([]);
  const [selectedType, setSelectedType] = useState<{type: any, name: string, icon: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  
  const { toggleBiometric } = useSecurity();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const successScale = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Settings' });
    }
  }, [navigation]);

  const showToast = (type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  const getBiometricConfigs = (types: LocalAuthentication.AuthenticationType[]) => {
    const configs: Array<{type: any, name: string, icon: string}> = [];
    
    types.forEach(type => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          configs.push({ type, name: 'Face ID', icon: 'scan-outline' });
          break;
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          configs.push({ type, name: 'Fingerprint', icon: 'finger-print' });
          break;
        case LocalAuthentication.AuthenticationType.IRIS:
          configs.push({ type, name: 'Iris Scan', icon: 'eye' });
          break;
      }
    });
    
    return configs;
  };

  useEffect(() => {
    checkBiometricAvailability();
    
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (setupComplete) {
      Animated.spring(successScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
      
      setTimeout(() => {
        safeGoBack();
      }, 2000);
    }
  }, [setupComplete, safeGoBack]);

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
      showToast('error', 'Error', 'Please select a biometric method');
      return;
    }

    if (!hasHardware || !isEnrolled) {
      showToast('error', 'Not Available', 'Please set up biometrics in device settings');
      return;
    }

    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${selectedType.name} for LittleLoom`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      setIsScanning(false);

      if (result.success) {
        const enabled = await toggleBiometric(true);
        if (enabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSetupComplete(true);
          showToast('success', 'Enabled!', `${selectedType.name} is now active`);
        } else {
          showToast('error', 'Error', 'Failed to enable biometric authentication');
        }
      } else {
        if (result.error === 'user_cancel') return;
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (result.error === 'not_enrolled' || result.error === 'not_available') {
          showToast('error', 'Not Available', 'Please set up biometrics in device settings first');
        } else {
          showToast('error', 'Failed', 'Authentication failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
      setIsScanning(false);
      showToast('error', 'Error', 'An error occurred during authentication');
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeGoBack();
  };

  const selectBiometricType = (config: {type: any, name: string, icon: string}) => {
    if (isScanning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(config);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient 
          colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']} 
          style={styles.gradient}
        />
        <View style={[styles.content, { paddingTop: insets.top + 40, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={[styles.loadingText, { color: isDark ? '#94a3b8' : '#fff' }]}>Checking biometric availability...</Text>
        </View>
      </View>
    );
  }

  if (setupComplete) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient 
          colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']} 
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
              You can now unlock LittleLoom securely
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <LinearGradient 
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']} 
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
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#667eea'} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.mainContent}>
            {selectedType && (
              <View style={styles.iconWrapper}>
                <BiometricIcon 
                  isScanning={isScanning} 
                  isDark={isDark} 
                  biometricType={selectedType.name}
                />
              </View>
            )}

            <Text style={[styles.title, { color: isDark ? '#fff' : '#fff' }]}>
              {availableTypes.length > 1 ? 'Choose Biometric Method' : `Enable ${availableTypes[0]?.name || 'Biometric'}`}
            </Text>
            
            <Text style={[styles.subtitle, { color: isDark ? '#cbd5e1' : 'rgba(255,255,255,0.9)' }]}>
              {hasHardware && isEnrolled
                ? 'Use biometric authentication for quick and secure access to your baby\'s memories.'
                : 'Biometric authentication is not available on this device.'
              }
            </Text>

            {/* Multiple biometric options */}
            {availableTypes.length > 1 && hasHardware && isEnrolled && (
              <View style={styles.optionsContainer}>
                {availableTypes.map((config) => (
                  <TouchableOpacity
                    key={config.type}
                    style={[
                      styles.optionCard,
                      selectedType?.type === config.type && styles.optionCardSelected,
                      isDark && styles.optionCardDark,
                    ]}
                    onPress={() => selectBiometricType(config)}
                    disabled={isScanning}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: selectedType?.type === config.type ? 'rgba(102,126,234,0.2)' : 'rgba(100,116,139,0.1)' }]}>
                      <Ionicons 
                        name={config.icon as any} 
                        size={28} 
                        color={selectedType?.type === config.type ? '#667eea' : (isDark ? '#94a3b8' : '#64748b')} 
                      />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionName, { color: isDark ? '#fff' : '#1e293b' }]}>
                        {config.name}
                      </Text>
                      <Text style={[styles.optionDescription, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                        Tap to select
                      </Text>
                    </View>
                    {selectedType?.type === config.type && (
                      <Ionicons name="checkmark-circle" size={24} color="#667eea" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {hasHardware && isEnrolled && (
              <View style={styles.benefitsContainer}>
                {[
                  { icon: 'flash', text: 'Quick Access', color: '#667eea' },
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
        </ScrollView>

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
                    colors={isDark ? ['rgba(102,126,234,0.9)', 'rgba(118,75,162,0.9)'] : ['#667eea', '#764ba2']} 
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
                <Text style={[styles.skipText, { color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)' }]}>Maybe Later</Text>
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
                    : 'Please set up biometrics in your device settings first.'
                  }
                </Text>
              </View>

              <TouchableOpacity style={styles.enableButton} onPress={safeGoBack}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Text style={styles.enableText}>Go Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
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
  
  // Alert
  alertContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 10, 
    minWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

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
  optionCardSelected: {
    borderColor: '#667eea',
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