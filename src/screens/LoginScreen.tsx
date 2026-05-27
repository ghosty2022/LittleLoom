// src/screens/LoginScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  FadeInDown,
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
const { width, height } = Dimensions.get('window');

// ==================== SWEET ALERT COMPONENT ====================

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });
      
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withTiming(-30, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning', bg: isDark ? '#1a1a2e' : '#fff' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]} pointerEvents="box-none">
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: config.bg }]}>
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

// ==================== BIOMETRIC ICON COMPONENT ====================

type BiometricType = 'face' | 'fingerprint' | 'iris' | 'generic';

const BiometricIcon = ({ type, size = 80 }: { type: BiometricType; size?: number }) => {
  const scale = useSharedValue(1);
  
  useEffect(() => {
    const pulse = setInterval(() => {
      scale.value = withSequence(
        withTiming(1.1, { duration: 500 }),
        withTiming(1, { duration: 500 })
      );
    }, 2000);
    return () => clearInterval(pulse);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getIconName = () => {
    switch (type) {
      case 'face': return 'scan-outline';
      case 'fingerprint': return 'finger-print';
      case 'iris': return 'eye';
      default: return 'finger-print';
    }
  };

  const getGradientColors = () => {
    switch (type) {
      case 'face': return ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)'];
      case 'fingerprint': return ['rgba(67,233,123,0.2)', 'rgba(56,249,215,0.1)'];
      case 'iris': return ['rgba(255,165,2,0.2)', 'rgba(255,99,72,0.1)'];
      default: return ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)'];
    }
  };

  return (
    <Animated.View style={[styles.biometricIconContainer, animatedStyle, { width: size, height: size }]}>
      <LinearGradient
        colors={getGradientColors()}
        style={[styles.biometricIconBg, { width: size, height: size }]}
      >
        <Ionicons name={getIconName() as any} size={size * 0.4} color="#667eea" />
      </LinearGradient>
    </Animated.View>
  );
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('generic');
  const [biometricTypeName, setBiometricTypeName] = useState('Biometric');
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  
  const { 
    signIn, 
    isLoading: authLoading,
    isAuthenticated,
    isBiometricAvailable,
    loginWithBiometric,
    hasBiometricLoginCredentials,
    enableBiometricLogin,
    shouldShowBiometricPrompt,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
  } = useAuth();
  
  const { resetUnlockLock, forceUnlock } = useSecurity();
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);
  const biometricScale = useSharedValue(0);
  
  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const autoLoginAttempted = useRef(false);
  const hasNavigated = useRef(false);
  const biometricCheckComplete = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      loginAttempted.current = false;
      autoLoginAttempted.current = false;
    };
  }, []);

  // ============================================
  // CRITICAL: Navigation Logic After Login - FIXED
  // ============================================
  useEffect(() => {
    if (isAuthenticated && !hasNavigated.current) {
      hasNavigated.current = true;
      
      const timer = setTimeout(() => {
        if (!isMounted.current) return;
        
        // Setup flow for new users
        if (!setupComplete) {
          if (!hasParent2) {
            navigation.replace('Parent2Optional');
          } else if (!hasBaby) {
            navigation.replace('BabyOptional');
          } else {
            navigation.replace('Main');
          }
        } else {
          // Existing user
          navigation.replace('Main');
        }
      }, 1200); // Reduced from 1500ms
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, setupComplete, hasParent2, hasBaby, navigation]);

  // Logo animation
  useEffect(() => {
    logoScale.value = withSequence(
      withTiming(0.8, { duration: 0 }),
      withSpring(1, { damping: 12, stiffness: 100 })
    );
    
    formTranslateY.value = withSequence(
      withTiming(50, { duration: 0 }),
      withSpring(0, { damping: 15, stiffness: 100, delay: 200 })
    );
  }, []);

  // Detect biometric type
  useEffect(() => {
    const detectType = async () => {
      try {
        if (!LocalAuthentication || !LocalAuthentication.supportedAuthenticationTypesAsync) {
          return;
        }

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
          setBiometricTypeName('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
          setBiometricTypeName('Fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
          setBiometricTypeName('Iris Scan');
        }
      } catch (error) {
        console.log('Biometric detection error:', error);
      }
    };

    if (isBiometricAvailable) {
      detectType();
    }
  }, [isBiometricAvailable]);

  // Check biometric credentials availability
  useEffect(() => {
    if (biometricCheckComplete.current) return;
    
    const checkBiometricStatus = async () => {
      try {
        const hasCreds = await hasBiometricLoginCredentials();
        if (hasCreds && isBiometricAvailable) {
          setShowBiometricButton(true);
          biometricScale.value = withSpring(1, { damping: 12, delay: 400 });
        }
        biometricCheckComplete.current = true;
      } catch (error) {
        console.error('Error checking biometric status:', error);
      }
    };
    
    checkBiometricStatus();
  }, [isBiometricAvailable, hasBiometricLoginCredentials]);

  // Auto-login with biometric if credentials exist - FIXED
  useEffect(() => {
    if (isAuthenticated) return;
    if (autoLoginAttempted.current) return;
    
    const attemptAutoLogin = async () => {
      const hasCreds = await hasBiometricLoginCredentials();
      if (hasCreds && isBiometricAvailable) {
        autoLoginAttempted.current = true;
        
        // Small delay to let UI render first
        setTimeout(async () => {
          if (!isMounted.current || isAuthenticated) return;
          resetUnlockLock(); // CRITICAL FIX: Clear stuck locks before auto-login
          await handleBiometricLogin();
        }, 800);
      }
    };
    
    attemptAutoLogin();
  }, [isAuthenticated, isBiometricAvailable, hasBiometricLoginCredentials, resetUnlockLock]);

  // CRITICAL FIX: Reset security locks on mount and whenever Login comes into focus
  useEffect(() => {
    resetUnlockLock();
    
    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
      loginAttempted.current = false;
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  const biometricStyle = useAnimatedStyle(() => ({
    transform: [{ scale: biometricScale.value }],
    opacity: biometricScale.value,
  }));

  const showToast = useCallback((type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const handleLogin = useCallback(async () => {
    if (loginAttempted.current || isProcessing || authLoading || hasNavigated.current) {
      return;
    }
    
    if (!email || !password) {
      showToast('error', 'Missing Fields', 'Please enter both email and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    loginAttempted.current = true;
    setIsProcessing(true);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await signIn(email, password);
      
      if (success && isMounted.current) {
        showToast('success', 'Welcome Back!', 'Successfully signed in');
        
        // CRITICAL FIX: Ensure SecurityContext is unlocked after login so the app doesn't re-lock immediately
        forceUnlock().catch(() => {});
        
        // Only prompt for biometric login setup for returning users
        if (hasSeenOnboarding) {
          const shouldPrompt = await shouldShowBiometricPrompt();
          if (shouldPrompt) {
            setTimeout(() => {
              promptEnableBiometricLogin(email, password);
            }, 800);
          }
        }
      } else {
        showToast('error', 'Login Failed', 'Invalid email or password');
        loginAttempted.current = false;
      }
    } catch (error) {
      showToast('error', 'Error', 'Login failed. Please try again.');
      loginAttempted.current = false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [email, password, signIn, isProcessing, authLoading, shouldShowBiometricPrompt, hasSeenOnboarding, forceUnlock]);

  const handleBiometricLogin = useCallback(async () => {
    if (loginAttempted.current || isProcessing || authLoading || hasNavigated.current) {
      return;
    }
    
    // CRITICAL FIX: Clear any stuck SecurityContext locks before attempting biometric login
    resetUnlockLock();
    
    loginAttempted.current = true;
    setIsProcessing(true);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await loginWithBiometric();
      
      if (success && isMounted.current) {
        showToast('success', 'Welcome!', `${biometricTypeName} login successful`);
        
        // CRITICAL FIX: Ensure SecurityContext is unlocked after biometric login
        forceUnlock().catch(() => {});
      } else if (!success) {
        showToast('error', 'Biometric Failed', 'Please use your password');
        loginAttempted.current = false;
      }
    } catch (error) {
      showToast('error', 'Error', 'Biometric login failed');
      loginAttempted.current = false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [loginWithBiometric, isProcessing, authLoading, biometricTypeName, resetUnlockLock, forceUnlock]);

  const promptEnableBiometricLogin = async (userEmail: string, userPassword: string) => {
    Alert.alert(
      `Enable ${biometricTypeName} Login?`,
      'Would you like to use biometric authentication for faster login next time?',
      [
        { 
          text: 'Not Now', 
          style: 'cancel',
        },
        { 
          text: 'Enable', 
          onPress: async () => {
            try {
              const result = await enableBiometricLogin(userEmail, userPassword);
              if (result) {
                showToast('success', 'Enabled!', `${biometricTypeName} login is now active`);
                setShowBiometricButton(true);
                biometricScale.value = withSpring(1, { damping: 12 });
              }
            } catch (error) {
              showToast('error', 'Error', 'Could not enable biometric login');
            }
          }
        },
      ]
    );
  };

  const isLoading = authLoading || isProcessing;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <LinearGradient 
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']} 
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent, 
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }
          ]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={[styles.logoCircle, isDark && styles.logoCircleDark]}>
              <Text style={styles.logoEmoji}>👶</Text>
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Track every precious moment</Text>
          </Animated.View>

          {/* Glass Card Form */}
          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              
              <Text style={[styles.welcomeText, { color: isDark ? '#fff' : '#1e293b' }]}>
                Welcome Back
              </Text>
              
              {/* Biometric Login Section */}
              {showBiometricButton && (
                <Animated.View style={[styles.biometricSection, biometricStyle]}>
                  <TouchableOpacity 
                    style={styles.biometricButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <BiometricIcon type={biometricType} size={90} />
                    <Text style={styles.biometricTitle}>
                      {biometricTypeName} Login
                    </Text>
                    <Text style={styles.biometricSubtitle}>Tap to unlock instantly</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>or continue with</Text>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  </View>
                </Animated.View>
              )}

              {/* Email Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Email address"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)' }
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>

              {/* Password Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Password"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)' }
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)} 
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={isLoading}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#667eea" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#667eea', '#764ba2']} 
                  style={styles.loginGradient}
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.loginText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Fallback Biometric */}
              {!showBiometricButton && isBiometricAvailable && (
                <Animated.View entering={FadeInUp.delay(600)} style={styles.biometricFallback}>
                  <TouchableOpacity 
                    style={styles.biometricFallbackButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Ionicons 
                      name={biometricType === 'face' ? 'scan-outline' : biometricType === 'iris' ? 'eye' : 'finger-print'} 
                      size={24} 
                      color="#667eea" 
                    />
                    <Text style={styles.biometricFallbackText}>
                      Use {biometricTypeName}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(800)} style={styles.footer}>
            <Text style={[styles.footerText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)' }]}>
              Don't have an account? 
            </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignUp')}
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Create Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: { 
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  
  // Alert Styles
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
    maxWidth: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoEmoji: {
    fontSize: 50,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Form
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
  },

  // Biometric
  biometricSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    padding: 16,
  },
  biometricIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconBg: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  biometricTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 4,
  },
  biometricSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },

  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },

  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  biometricFallback: {
    marginTop: 20,
    alignItems: 'center',
  },
  biometricFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  biometricFallbackText: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});