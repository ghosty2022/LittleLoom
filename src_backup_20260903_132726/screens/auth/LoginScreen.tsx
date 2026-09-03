import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
const { width, height } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

// ─── OAuth Configuration ──────────────────────────────────────────────
const GOOGLE_CLIENT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
}) ?? 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '1526133312174343';

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'littleloom',
  useProxy: true,
});

// ─── Validation Functions ──────────────────────────────────────────────
const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

const isValidPhone = (phone: string): boolean => {
  const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
  return re.test(phone.trim());
};

const isValidUsername = (username: string): boolean => {
  const trimmed = username.trim();
  return trimmed.length >= 3 && /^[a-zA-Z0-9_.]+$/.test(trimmed);
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────
export default function LoginScreen({ navigation, route }: LoginScreenProps) {
  // ─── STATE ───
  const [activeTab, setActiveTab] = useState<'signin' | 'join'>('signin');
  
  // ─── SIGN IN STATE ───
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // ─── JOIN FAMILY STATE ───
  const [inviteCode, setInviteCode] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{ role: string; relationship?: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const {
    signIn,
    signUpWithInviteCode,
    signInWithSocial,
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
    userProfile,
    findUserByEmail,
    findUserByEmailOrUsername,
  } = useAuth();

  const { resetUnlockLock, forceUnlock } = useSecurity();
  
  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };
  const triggerHaptic = customization?.triggerHaptic ?? (() => {});
  
  const { toast, error: showError, success: showSuccess, confirm, info: showInfo } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const joinAttempted = useRef(false);
  const autoLoginAttempted = useRef(false);
  const biometricCheckComplete = useRef(false);
  const codeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialAuthInProgress = useRef(false);

  // ─── OAuth Requests ──────────────────────────────────────────────────
  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
    },
    { 
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    }
  );

  const [fbRequest, fbResponse, fbPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: FACEBOOK_APP_ID,
      redirectUri,
      scopes: ['public_profile', 'email'],
      responseType: 'token',
    },
    { 
      authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    }
  );

  // ─── Auto-fill invite code from QR scan ─────────────────────────────
  useEffect(() => {
    const code = (route.params as any)?.inviteCode;
    if (code) {
      if (activeTab !== 'join') setActiveTab('join');
      setInviteCode(code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    }
  }, [route.params]);

  const userName = userProfile?.fullName || 'there';

  // ─── GOOGLE RESPONSE HANDLER ────────────────────────────────────────
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleGoogleUserInfo(authentication.accessToken);
      }
    } else if (googleResponse?.type === 'error') {
      showError('Google Error', 'Authentication failed. Please try again.');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    } else if (googleResponse?.type === 'cancel') {
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  }, [googleResponse]);

  // ─── FACEBOOK RESPONSE HANDLER ──────────────────────────────────────
  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const { authentication } = fbResponse;
      if (authentication?.accessToken) {
        handleFacebookUserInfo(authentication.accessToken);
      }
    } else if (fbResponse?.type === 'error') {
      showError('Facebook Error', 'Authentication failed. Please try again.');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    } else if (fbResponse?.type === 'cancel') {
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  }, [fbResponse]);

  // ─── GOOGLE USER INFO ───────────────────────────────────────────────
  const handleGoogleUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await response.json();

      if (userData.email) {
        await handleSocialLogin('google', userData.email, userData.name || 'Google User', userData.picture);
      } else {
        throw new Error('No email in Google response');
      }
    } catch (error) {
      console.error('Google user info error:', error);
      showError('Google Error', 'Could not retrieve account information');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  // ─── FACEBOOK USER INFO ─────────────────────────────────────────────
  const handleFacebookUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=email,name,picture&access_token=${accessToken}`
      );
      const userData = await response.json();

      if (userData.email) {
        await handleSocialLogin(
          'facebook',
          userData.email,
          userData.name || 'Facebook User',
          userData.picture?.data?.url
        );
      } else {
        throw new Error('No email in Facebook response');
      }
    } catch (error) {
      console.error('Facebook user info error:', error);
      showError('Facebook Error', 'Could not retrieve account information');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  // ─── SOCIAL LOGIN HANDLER ───────────────────────────────────────────
  const handleSocialLogin = async (
    provider: 'google' | 'apple' | 'facebook',
    email: string,
    name: string,
    avatar?: string
  ) => {
    if (!email) {
      showError('Auth Failed', `Could not get ${provider} account information`);
      setIsProcessing(false);
      socialAuthInProgress.current = false;
      return;
    }

    setIsProcessing(true);
    try {
      const success = await signInWithSocial({
        id: `${provider}_${Date.now()}`,
        email,
        fullName: name,
        avatar,
        provider,
      });

      if (success && isMounted.current) {
        showSuccess('Welcome!', `Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
        forceUnlock().catch(() => {});
      }
    } catch (error) {
      showError('Login Failed', 'Social authentication failed');
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
        socialAuthInProgress.current = false;
      }
    }
  };

  // ─── AUTH EFFECTS ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMounted.current = false;
      loginAttempted.current = false;
      autoLoginAttempted.current = false;
      joinAttempted.current = false;
      socialAuthInProgress.current = false;
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && setupComplete) {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          forceUnlock().catch(() => {});
          navigation.replace('Main');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, setupComplete, navigation, forceUnlock]);

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

  // ─── CODE VALIDATION ───
  useEffect(() => {
    if (activeTab !== 'join') return;
    if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);

    const trimmed = inviteCode.trim();

    if (trimmed.length !== 6) {
      setCodeValidated(false);
      setCodeInfo(null);
      return;
    }

    setIsValidatingCode(true);
    codeDebounceTimer.current = setTimeout(async () => {
      try {
        let result: { valid: boolean; invite?: any; message?: string };
        try {
          const { validateInviteCode } = await import('@/utils/portableInvite');
          result = await validateInviteCode(trimmed);
        } catch {
          const raw = await AsyncStorage.getItem('littleloom_invite_codes');
          const codes = raw ? JSON.parse(raw) : {};
          const invite = codes[trimmed];
          if (!invite || invite.used || Date.now() > invite.expiresAt) {
            result = { valid: false };
          } else {
            result = { valid: true, invite };
          }
        }

        if (isMounted.current) {
          if (result.valid && result.invite) {
            setCodeValidated(true);
            setCodeInfo({
              role: result.invite.role,
              relationship: result.invite.relationship,
            });
            showInfo('Valid Code!', `You'll join as ${result.invite.role === 'parent2' ? 'Parent 2' : result.invite.role === 'guardian' ? 'Guardian' : 'Viewer'}`);
          } else {
            setCodeValidated(false);
            setCodeInfo(null);
          }
        }
      } catch (error) {
        console.error('Code validation error:', error);
      } finally {
        if (isMounted.current) setIsValidatingCode(false);
      }
    }, 500);
  }, [inviteCode, activeTab]);

  // ─── HANDLE SIGN IN ──────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    loginAttempted.current = false;

    if (isProcessing || authLoading) return;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return;
    }

    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier) {
      showError('Missing Information', 'Please enter your email, phone number, or username');
      triggerHaptic('error');
      return;
    }

    // Check what type of identifier we have
    const isEmail = isValidEmail(trimmedIdentifier);
    const isPhone = isValidPhone(trimmedIdentifier);
    const isUsername = isValidUsername(trimmedIdentifier);

    if (!isEmail && !isPhone && !isUsername) {
      showError('Invalid Input', 'Please enter a valid email, phone number, or username');
      triggerHaptic('error');
      return;
    }

    if (!password) {
      showError('Missing Password', 'Please enter your password');
      triggerHaptic('error');
      return;
    }

    loginAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      // Try to find user by identifier first
      let userIdentifier = trimmedIdentifier;
      
      // If it's a username, try to find the associated email
      if (isUsername) {
        try {
          const user = await findUserByEmailOrUsername(trimmedIdentifier);
          if (user && user.email) {
            userIdentifier = user.email;
            console.log('[Login] Found email for username:', userIdentifier);
          }
        } catch (e) {
          console.warn('[Login] Could not resolve username to email:', e);
        }
      }
      
      // If it's a phone number, we need to find the associated email
      // For now, we'll try to use it as-is (Supabase may not support phone login directly)
      // You'll need to implement phone -> email lookup if you have that mapping

      const success = await signIn(userIdentifier, password);

      if (success && isMounted.current) {
        showSuccess(`Welcome Back${userName !== 'there' ? `, ${userName}` : ''}!`, 'Successfully signed in');
        forceUnlock().catch(() => {});

        if (!setupComplete) {
          if (!hasBaby) {
            navigation.replace('BabyOptional');
          } else if (!hasParent2) {
            navigation.replace('CoParentInviteScreen');
          }
          return;
        }

        if (hasSeenOnboarding) {
          const shouldPrompt = await shouldShowBiometricPrompt();
          if (shouldPrompt) {
            setTimeout(() => {
              promptEnableBiometricLogin(userIdentifier, password);
            }, 1000);
          }
        }
      } else {
        showError('Login Failed', 'Invalid credentials. Please try again.');
        loginAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Login failed. Please try again.');
      loginAttempted.current = false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [
    email,
    password,
    signIn,
    findUserByEmailOrUsername,
    isProcessing,
    authLoading,
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    shouldShowBiometricPrompt,
    hasSeenOnboarding,
    forceUnlock,
    navigation,
    userName,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  // ─── HANDLE JOIN FAMILY ─────────────────────────────────────────────
  const handleJoinFamily = useCallback(async () => {
    joinAttempted.current = false;

    if (isProcessing || authLoading) return;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return;
    }

    const existingUser = await findUserByEmail(joinEmail.trim());
    
    if (existingUser) {
      showInfo('Account Found', 'You already have an account. Please sign in instead.');
      setActiveTab('signin');
      setEmail(joinEmail.trim());
      return;
    }

    const trimmedCode = inviteCode.trim();

    if (trimmedCode.length !== 6) {
      showError('Invalid Code', 'Invite code must be exactly 6 characters');
      triggerHaptic('error');
      return;
    }
    if (!codeValidated) {
      showError('Invalid Code', 'The invite code is not valid or has expired');
      triggerHaptic('error');
      return;
    }
    if (!joinFullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      triggerHaptic('error');
      return;
    }
    if (!joinEmail.trim()) {
      showError('Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }
    if (!isValidEmail(joinEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      triggerHaptic('error');
      return;
    }
    if (!joinPassword) {
      showError('Missing Password', 'Please enter a password');
      triggerHaptic('error');
      return;
    }
    if (joinPassword.length < 6) {
      showError('Weak Password', 'Password must be at least 6 characters');
      triggerHaptic('error');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }

    joinAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const result = await signUpWithInviteCode(trimmedCode, joinFullName.trim(), joinEmail.trim(), joinPassword);

      if (result.success && isMounted.current) {
        showSuccess(`Welcome, ${joinFullName.trim()}!`, result.message);
        forceUnlock().catch(() => {});
      } else {
        showError('Join Failed', result.message || 'Could not join family. Please try again.');
        joinAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Failed to join family. Please try again.');
      joinAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [inviteCode, codeValidated, joinFullName, joinEmail, joinPassword, joinConfirmPassword, signUpWithInviteCode, findUserByEmail, isProcessing, authLoading, isAuthenticated, setupComplete, triggerHaptic, showError, showSuccess, showInfo, forceUnlock, navigation]);

  // ─── BIOMETRIC LOGIN ─────────────────────────────────────────────────
  const handleBiometricLogin = useCallback(async () => {
    loginAttempted.current = false;
    
    if (isProcessing || authLoading) return false;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return true;
    }

    resetUnlockLock();
    loginAttempted.current = true;
    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      const success = await loginWithBiometric();

      if (success && isMounted.current) {
        showSuccess(`Welcome${userName !== 'there' ? `, ${userName}` : ''}!`, 'Biometric login successful');
        forceUnlock().catch(() => {});
        return true;
      } else if (!success) {
        showError('Biometric Failed', 'Please use your password');
        loginAttempted.current = false;
        return false;
      }
    } catch (error) {
      showError('Error', 'Biometric login failed');
      loginAttempted.current = false;
      return false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [
    loginWithBiometric,
    isProcessing,
    authLoading,
    isAuthenticated,
    setupComplete,
    resetUnlockLock,
    forceUnlock,
    navigation,
    userName,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  const promptEnableBiometricLogin = async (userEmail: string, userPassword: string) => {
    if (!isMounted.current) return;

    confirm(
      'Enable Biometric Login?',
      'Would you like to use biometric authentication for faster login next time?',
      async () => {
        try {
          const result = await enableBiometricLogin(userEmail, userPassword);
          if (result && isMounted.current) {
            showSuccess('Enabled!', 'Biometric login is now active');
            setShowBiometricButton(true);
          }
        } catch (error) {
          if (isMounted.current) {
            showError('Error', 'Could not enable biometric login');
          }
        }
      },
      () => {},
      'Enable',
      'Not Now'
    );
  };

  // ─── BIOMETRIC CHECK ─────────────────────────────────────────────────
  useEffect(() => {
    if (biometricCheckComplete.current) return;

    if (!isBiometricAvailable) {
      biometricCheckComplete.current = true;
      setAuthInitialized(true);
      return;
    }

    const checkBiometricStatus = async () => {
      try {
        const hasCreds = await hasBiometricLoginCredentials();
        if (hasCreds && isMounted.current) {
          setShowBiometricButton(true);
        }
        biometricCheckComplete.current = true;
        setAuthInitialized(true);
      } catch (error) {
        console.error('Error checking biometric status:', error);
        biometricCheckComplete.current = true;
        setAuthInitialized(true);
      }
    };

    checkBiometricStatus();
  }, [isBiometricAvailable, hasBiometricLoginCredentials]);

  const isLoading = authLoading || isProcessing || !authInitialized;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  // ─── SOCIAL LOGIN HANDLERS ──────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await googlePromptAsync();
    } catch (error) {
      showError('Google Error', 'Could not open Google sign-in');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  const handleAppleLogin = async () => {
    triggerHaptic('light');
    showInfo('Coming Soon', 'Apple Sign-In will be available shortly');
  };

  const handleFacebookLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await fbPromptAsync();
    } catch (error) {
      showError('Facebook Error', 'Could not open Facebook sign-in');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={isLoading && !isAuthenticated}
        text={activeTab === 'join' ? 'Joining your family...' : 'Signing you in...'}
        subtext="Please wait a moment"
        size="medium"
        overlay={true}
        blur={true}
      />

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
        <Animated.ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoFloatWrap}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Track every precious moment</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)']
                    : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <Text style={[styles.welcomeText, { color: isDark ? '#fff' : '#1e293b' }]}>
                {activeTab === 'signin' ? `Welcome Back${userName !== 'there' ? `, ${userName}` : ''}` : 'Join Family'}
              </Text>

              {/* ─── TAB SWITCHER ─── */}
              <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102,126,234,0.08)' }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'signin' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(102,126,234,0.4)' : '#667eea' }],
                  ]}
                  onPress={() => setActiveTab('signin')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'signin' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }
                  ]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'join' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(34,197,94,0.4)' : '#22c55e' }],
                  ]}
                  onPress={() => setActiveTab('join')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'join' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }
                  ]}>
                    Join Family
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'signin' ? (
                // ─── SIGN IN FORM ──────────────────────────────────────
                <>
                  {/* All Social Login Options */}
                  <View style={styles.socialIconsContainer}>
                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(219,68,55,0.2)' }]}
                      onPress={handleGoogleLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/google.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={[styles.socialIconButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                        onPress={handleAppleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <Image source={require('../../../assets/social/apple.png')} style={[styles.socialIcon, isDark && { tintColor: '#FFFFFF' }]} resizeMode="contain" />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(24,119,242,0.2)' }]}
                      onPress={handleFacebookLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/facebook.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      or sign in with email
                    </Text>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  </View>

                  {/* Biometric Login Button */}
                  {showBiometricButton && (
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.biometricSection}>
                      <TouchableOpacity
                        style={styles.biometricButton}
                        onPress={handleBiometricLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <View style={styles.biometricIconWrapper}>
                          <LinearGradient
                            colors={['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)']}
                            style={styles.biometricIconBg}
                          >
                            <Ionicons name="finger-print" size={28} color="#667eea" />
                          </LinearGradient>
                        </View>
                        <Text style={styles.biometricTitle}>Use Biometrics</Text>
                        <Text style={styles.biometricSubtitle}>Tap to unlock instantly</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}

                  {/* Email/Username/Phone Input */}
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                      placeholder="Email, username, or phone number"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                      value={email}
                      onChangeText={setEmail}
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
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      textContentType="password"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      disabled={isLoading}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#667eea"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Remember Me & Forgot Password */}
                  <View style={styles.rowContainer}>
                    <TouchableOpacity 
                      style={styles.rememberMeContainer}
                      onPress={() => setRememberMe(!rememberMe)}
                    >
                      <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                        {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.rememberMeText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                        Remember me
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => navigation.navigate('ForgotPassword')}
                      disabled={isLoading}
                    >
                      <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Login Button */}
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

                  {/* Sign up link */}
                  <View style={styles.signupLinkContainer}>
                    <Text style={[styles.signupLinkText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Don't have an account?
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                      <Text style={styles.signupLink}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // ─── JOIN FAMILY FORM ──────────────────────────────────
                <>
                  <View style={styles.joinHeader}>
                    <Ionicons name="people-outline" size={28} color="#22c55e" />
                    <Text style={[styles.joinTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                      Join Your Family
                    </Text>
                    <Text style={[styles.joinSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Enter the invite code shared by your family member
                    </Text>
                  </View>

                  {/* Invite Code Input */}
                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    codeValidated && styles.inputContainerSuccess,
                    !codeValidated && inviteCode.length === 6 && !isValidatingCode && styles.inputContainerError,
                  ]}>
                    <Ionicons name="key-outline" size={20} color={codeValidated ? '#22c55e' : '#667eea'} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b', letterSpacing: 3, fontWeight: '700', fontSize: 18, textAlign: 'center' }]}
                      placeholder="Paste invite code"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      maxLength={6}
                    />
                    {isValidatingCode && (
                      <ActivityIndicator size="small" color="#667eea" style={{ marginLeft: 8 }} />
                    )}
                    {codeValidated && !isValidatingCode && (
                      <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                    )}
                  </View>

                  {codeValidated && codeInfo && (
                    <View style={[styles.codeInfoCard, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#22c55e" />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#86efac' : '#15803d' }]}>
                        You'll join as <Text style={{ fontWeight: '700' }}>{codeInfo.role === 'parent2' ? 'Parent 2' : codeInfo.role === 'guardian' ? 'Guardian' : 'Viewer'}</Text>
                        {codeInfo.relationship ? ` (${codeInfo.relationship})` : ''}
                      </Text>
                    </View>
                  )}

                  {!codeValidated && inviteCode.length >= 6 && !isValidatingCode && (
                    <View style={[styles.codeInfoCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }]}>
                      <Ionicons name="alert-circle" size={18} color="#ef4444" />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                        Invalid or expired code. Please check and try again.
                      </Text>
                    </View>
                  )}

                  {codeValidated && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                          set up your account
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Full name"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="name"
                        />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Email address"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinEmail}
                          onChangeText={setJoinEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="emailAddress"
                        />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Password (min 6 characters)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinPassword}
                          onChangeText={setJoinPassword}
                          secureTextEntry={!showJoinPassword}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="newPassword"
                        />
                        <TouchableOpacity
                          onPress={() => setShowJoinPassword(!showJoinPassword)}
                          style={styles.eyeButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          disabled={isLoading}
                        >
                          <Ionicons
                            name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#667eea"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinConfirmPassword}
                          onChangeText={setJoinConfirmPassword}
                          secureTextEntry={!showJoinConfirmPassword}
                          editable={!isLoading}
                          returnKeyType="done"
                          onSubmitEditing={handleJoinFamily}
                          textContentType="newPassword"
                        />
                        <TouchableOpacity
                          onPress={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)}
                          style={styles.eyeButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          disabled={isLoading}
                        >
                          <Ionicons
                            name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color="#667eea"
                          />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handleJoinFamily}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#22c55e', '#16a34a']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <Text style={styles.loginText}>Join Family</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </BlurView>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoFloatWrap: {
    width: Math.min(width * 0.38, 160),
    height: Math.min(width * 0.38, 160),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: Math.min(width * 0.35, 140),
    height: Math.min(width * 0.35, 140),
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
    marginBottom: 20,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  socialIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  socialIcon: {
    width: 28,
    height: 28,
  },
  biometricSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  biometricIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    marginBottom: 20,
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
  inputContainerSuccess: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.05)',
  },
  inputContainerError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
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
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
  signupLinkText: {
    fontSize: 14,
  },
  signupLink: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '700',
  },
  joinHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  joinTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  joinSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  codeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeInfoText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});