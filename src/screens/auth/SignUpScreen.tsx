import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../utils/supabase';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;
const { width } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const AURA = {
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
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
};

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

const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
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
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SignUpScreen({ navigation, route }: SignUpScreenProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{
    role: string;
    relationship?: string;
    isPartial?: boolean;
    partialEmail?: string;
    partialPhone?: string;
    partialName?: string;
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [showPartialRecovery, setShowPartialRecovery] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const {
    signUp,
    signUpWithInviteCode,
    signInWithSocial,
    isLoading: authLoading,
    isAuthenticated,
    findUserByEmail,
    userProfile,
  } = useAuth();

  const {
    validateInviteCode: validateInviteCodeFromFamily,
    getPartialSignupInfo,
    recoverPartialSignup,
    markSignupComplete,
  } = useFamily();

  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#6366f1', secondary: '#8b5cf6' };
  const triggerHaptic = customization?.triggerHaptic ?? (() => {});
  const { toast, error: showError, success: showSuccess, info: showInfo } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  const isMounted = useRef(true);
  const signUpAttempted = useRef(false);
  const joinAttempted = useRef(false);
  const codeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialAuthInProgress = useRef(false);

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

  useEffect(() => {
    const code = (route.params as any)?.inviteCode;
    if (code) {
      if (activeTab !== 'join') setActiveTab('join');
      setInviteCode(code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    }
  }, [route.params]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
      socialAuthInProgress.current = false;
    };
  }, []);

  useEffect(() => {
    logoScale.value = withDelay(0, withSpring(1, { damping: 12, stiffness: 100 }));
    formTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 100 }));
  }, []);

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

  const handleGoogleUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await response.json();

      if (userData.email) {
        await handleSocialSignUp('google', userData.email, userData.name || 'Google User', userData.picture);
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

  const handleFacebookUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=email,name,picture&access_token=${accessToken}`
      );
      const userData = await response.json();

      if (userData.email) {
        await handleSocialSignUp(
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

  const handleSocialSignUp = async (
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
      if (typeof signInWithSocial === 'function') {
        const socialResult = await signInWithSocial({
          id: `${provider}_${Date.now()}`,
          email,
          fullName: name,
          avatar,
          provider,
        });

        if (socialResult.success && isMounted.current) {
          showSuccess('Welcome!', `Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
          navigation.replace('BabyOptional');
          return;
        }
      }

      const strongTempPassword = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const success = await signUp(name, email, strongTempPassword);

      if (success && isMounted.current) {
        showSuccess('Welcome!', `Account created with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
        navigation.replace('BabyOptional');
      } else {
        showError('Sign Up Failed', 'Could not create account. The email may already be in use.');
      }
    } catch (error) {
      showError('Sign Up Failed', 'Social authentication failed');
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
        socialAuthInProgress.current = false;
      }
    }
  };

  const handleGoogleSignUp = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await googlePromptAsync();
    } catch (error) {
      showError('Google Error', 'Could not open Google sign-up');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  const handleAppleSignUp = async () => {
    triggerHaptic('light');
    showInfo('Coming Soon', 'Apple Sign-Up will be available shortly');
  };

  const handleFacebookSignUp = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await fbPromptAsync();
    } catch (error) {
      showError('Facebook Error', 'Could not open Facebook sign-up');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  useEffect(() => {
    if (activeTab !== 'join') return;
    if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);

    const trimmed = inviteCode.trim();

    if (trimmed.length !== 6) {
      setCodeValidated(false);
      setCodeInfo(null);
      setShowPartialRecovery(false);
      return;
    }

    console.log('[SignUp] 🔍 Validating invite code:', trimmed);
    setIsValidatingCode(true);
    setShowPartialRecovery(false);

    codeDebounceTimer.current = setTimeout(async () => {
      try {
        const partialInfo = await getPartialSignupInfo(trimmed);
        console.log('[SignUp] 📊 Partial signup info:', partialInfo);

        if (partialInfo.exists) {
          console.log('[SignUp] ⚠️ Partial sign-up detected for code:', trimmed);

          if (isMounted.current) {
            setCodeValidated(true);
            setCodeInfo({
              role: 'partial',
              isPartial: true,
              partialEmail: partialInfo.email,
              partialPhone: partialInfo.phone,
              partialName: partialInfo.name,
            });
            setShowPartialRecovery(true);

            if (partialInfo.email) setJoinEmail(partialInfo.email);
            if (partialInfo.phone) setJoinPhone(partialInfo.phone);
            if (partialInfo.name) setJoinFullName(partialInfo.name);

            showInfo(
              'Resume Sign-up',
              partialInfo.email
                ? `Continue signing up with ${partialInfo.email}`
                : 'Complete your registration'
            );
            setIsValidatingCode(false);
          }
          return;
        }

        const result = await validateInviteCodeFromFamily(trimmed);

        console.log('[SignUp] 📊 Validation result:', result);

        if (isMounted.current) {
          if (result.valid && result.data) {
            setCodeValidated(true);
            setCodeInfo({
              role: result.data.role,
              relationship: result.data.relationship,
              isPartial: result.data.isPartial || false,
            });
            showInfo('Valid Code!', `You'll join as ${result.data.role === 'parent2' ? 'Parent 2' : result.data.role === 'guardian' ? 'Guardian' : 'Viewer'}`);
          } else {
            setCodeValidated(false);
            setCodeInfo(null);
          }
        }
      } catch (error) {
        console.error('Code validation error:', error);
        if (isMounted.current) {
          setCodeValidated(false);
          setCodeInfo(null);
        }
      } finally {
        if (isMounted.current) setIsValidatingCode(false);
      }
    }, 500);
  }, [inviteCode, activeTab, validateInviteCodeFromFamily, getPartialSignupInfo]);

  const handlePartialSignupRecovery = useCallback(async () => {
    if (isProcessing || authLoading) return;

    const trimmedCode = inviteCode.trim();
    if (trimmedCode.length !== 6) {
      showError('Invalid Code', 'Please enter a valid invite code');
      return;
    }

    if (!joinEmail.trim()) {
      showError('Missing Email', 'Please enter your email address');
      return;
    }
    if (!isValidEmail(joinEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (!joinFullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      return;
    }
    if (!joinPassword) {
      showError('Missing Password', 'Please enter a password');
      return;
    }
    if (joinPassword.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      return;
    }

    try {
      const existingUser = await findUserByEmail(joinEmail.trim());
      if (existingUser) {
        showInfo('Account Found', 'You already have an account. Would you like to sign in instead?');
        navigation.navigate('Login', { email: joinEmail.trim() });
        return;
      }
    } catch (e) {
      console.warn('[SignUp] Error checking existing user:', e);
    }

    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const signUpResult = await signUp(
        joinFullName.trim(),
        joinEmail.trim(),
        joinPassword
      );

      if (signUpResult.success && isMounted.current) {
        const { data: { user } } = await supabase.auth.getUser();

        const recoveryResult = await recoverPartialSignup(
          trimmedCode,
          user?.id || '',
          joinEmail.trim(),
          joinPhone.trim() || undefined,
          joinFullName.trim()
        );

        if (recoveryResult.success) {
          showSuccess('Welcome to the family!', recoveryResult.message);
          navigation.replace('BabyOptional');
        } else {
          showSuccess('Account Created!', 'Your account has been created. Please complete your family setup.');
          navigation.replace('BabyOptional');
        }
      } else {
        showError('Failed', signUpResult.message || 'Could not create account. Please try again.');
        joinAttempted.current = false;
      }
    } catch (error) {
      console.error('[SignUp] Partial signup recovery error:', error);
      showError('Error', 'Failed to complete signup. Please try again.');
      joinAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [
    inviteCode,
    joinEmail,
    joinPhone,
    joinFullName,
    joinPassword,
    joinConfirmPassword,
    signUp,
    recoverPartialSignup,
    findUserByEmail,
    userProfile,
    isProcessing,
    authLoading,
    triggerHaptic,
    showError,
    showSuccess,
    showInfo,
    navigation,
  ]);

  const handleSignUp = useCallback(async () => {
    if (signUpAttempted.current || isProcessing || authLoading) return;

    if (!fullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      triggerHaptic('error');
      return;
    }
    if (!email.trim()) {
      showError('Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }
    if (!isValidEmail(email)) {
      showError('Invalid Email', 'Please enter a valid email address');
      triggerHaptic('error');
      return;
    }
    if (!password) {
      showError('Missing Password', 'Please enter a password');
      triggerHaptic('error');
      return;
    }
    if (password.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
      triggerHaptic('error');
      return;
    }
    if (password !== confirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }

    try {
      const existingUser = await findUserByEmail(email.trim());
      if (existingUser) {
        showInfo('Account Exists', 'An account with this email already exists. Redirecting to sign in...');
        setTimeout(() => {
          if (isMounted.current) navigation.navigate('Login', { email: email.trim() });
        }, 1500);
        return;
      }
    } catch (e) {
      console.warn('findUserByEmail failed, continuing with sign-up', e);
    }

    signUpAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const result = await signUp(fullName.trim(), email.trim(), password);

      if (result.success && isMounted.current) {
        showSuccess(`Welcome, ${fullName.trim()}!`, 'Your account has been created successfully');
        navigation.replace('BabyOptional');
      } else {
        try {
          const existing = await findUserByEmail(email.trim());
          if (existing) {
            showInfo('Account Exists', 'An account with this email already exists. Redirecting to sign in...');
            setTimeout(() => {
              if (isMounted.current) navigation.navigate('Login', { email: email.trim() });
            }, 1500);
          } else {
            showError('Sign Up Failed', 'Could not create account. Please try again.');
          }
        } catch {
          showError('Sign Up Failed', 'Could not create account. Please try again.');
        }
        signUpAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Sign up failed. Please try again.');
      signUpAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [
    fullName,
    email,
    password,
    confirmPassword,
    signUp,
    findUserByEmail,
    isProcessing,
    authLoading,
    triggerHaptic,
    showError,
    showSuccess,
    showInfo,
    navigation,
  ]);

  const handleJoinFamily = useCallback(async () => {
    if (joinAttempted.current || isProcessing || authLoading) return;

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
    if (joinPassword.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
      triggerHaptic('error');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }

    try {
      const existingUser = await findUserByEmail(joinEmail.trim());
      if (existingUser) {
        showInfo('Account Exists', 'You already have an account. Redirecting to sign in...');
        setTimeout(() => {
          if (isMounted.current) navigation.navigate('Login', { email: joinEmail.trim() });
        }, 1500);
        return;
      }
    } catch (e) {
      console.warn('findUserByEmail failed during join', e);
    }

    joinAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const result = await signUpWithInviteCode(
        trimmedCode,
        joinFullName.trim(),
        joinEmail.trim(),
        joinPassword
      );

      if (result.success && isMounted.current) {
        if (codeInfo?.isPartial && userProfile?.id) {
          await markSignupComplete(trimmedCode, userProfile.id);
        }

        showSuccess(`Welcome, ${joinFullName.trim()}!`, result.message);
        navigation.replace('BabyOptional');
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
  }, [
    inviteCode,
    codeValidated,
    codeInfo,
    joinFullName,
    joinEmail,
    joinPassword,
    joinConfirmPassword,
    signUpWithInviteCode,
    findUserByEmail,
    markSignupComplete,
    userProfile,
    isProcessing,
    authLoading,
    triggerHaptic,
    showError,
    showSuccess,
    showInfo,
    navigation,
  ]);

  const isLoading = authLoading || isProcessing;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={showSplash || (isLoading && !isAuthenticated)}
        text={activeTab === 'join' ? 'Joining your family...' : 'Creating your account...'}
        subtext="Please wait a moment"
        size="medium"
        overlay={true}
        blur={true}
      />

      {/* Aura gradient */}
      <LinearGradient
        colors={isDark
          ? ['#0c0a09', '#1a1428', '#0c0a09']
          : ['#6366f1', '#8b5cf6', '#ec4899']}
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
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoFloatWrap}>
              <View style={styles.logoGlow} />
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <GradientText colors={['#ffffff', '#fbcfe8', '#c7d2fe']} style={styles.logoText}>
              LittleLoom
            </GradientText>
            <Text style={styles.logoTagline}>Begin weaving precious memories</Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                    : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <Text style={[styles.welcomeText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                {activeTab === 'create' ? 'Create Account' : 'Join Family'}
              </Text>

              {/* Tab Switcher */}
              <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)' }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'create' && { backgroundColor: AURA.primary },
                  ]}
                  onPress={() => setActiveTab('create')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'create' ? AURA.white : isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500 },
                  ]}>
                    Create Account
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'join' && { backgroundColor: AURA.success },
                  ]}
                  onPress={() => setActiveTab('join')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'join' ? AURA.white : isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500 },
                  ]}>
                    Join Family
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'create' ? (
                // ─── CREATE ACCOUNT FORM ──────────────────────────────
                <>
                  <View style={styles.socialIconsContainer}>
                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(219,68,55,0.2)' }]}
                      onPress={handleGoogleSignUp}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/google.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={[styles.socialIconButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                        onPress={handleAppleSignUp}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <Image source={require('../../../assets/social/apple.png')} style={[styles.socialIcon, isDark && { tintColor: AURA.white }]} resizeMode="contain" />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(24,119,242,0.2)' }]}
                      onPress={handleFacebookSignUp}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/facebook.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                      or sign up with email
                    </Text>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  </View>

                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Full name"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      textContentType="name"
                    />
                  </View>

                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="mail-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Email address"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      textContentType="emailAddress"
                    />
                  </View>

                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Password (min 8 characters)"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      returnKeyType="next"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      disabled={isLoading}
                    >
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Confirm password"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleSignUp}
                      textContentType="newPassword"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      disabled={isLoading}
                    >
                      <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                    onPress={handleSignUp}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[AURA.primary, AURA.accent]}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isLoading ? <ActivityIndicator color={AURA.white} size="small" /> : <Text style={styles.loginText}>Create Account</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.termsRow}>
                    <Text style={[styles.termsText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>By signing up, you agree to our </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                      <Text style={[styles.termsLink, { color: isDark ? AURA.primaryLight : AURA.primary }]}>Terms of Service</Text>
                    </TouchableOpacity>
                    <Text style={[styles.termsText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}> and </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                      <Text style={[styles.termsLink, { color: isDark ? AURA.primaryLight : AURA.primary }]}>Privacy Policy</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // ─── JOIN FAMILY FORM ──────────────────────────────────
                <>
                  <View style={styles.joinHeader}>
                    <View style={[styles.joinIconWrap, { backgroundColor: `${AURA.success}18` }]}>
                      <Ionicons name="people-outline" size={26} color={AURA.success} />
                    </View>
                    <Text style={[styles.joinTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>Join Your Family</Text>
                    <Text style={[styles.joinSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                      Enter the invite code shared by your family member
                    </Text>
                  </View>

                  {/* QR button */}
                  <TouchableOpacity
                    style={[
                      styles.qrButton,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      },
                    ]}
                    onPress={() => navigation.navigate('QRScanner' as never)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="qr-code-outline" size={22} color={AURA.primary} />
                    <Text style={[styles.qrButtonText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                      Scan QR Code Instead
                    </Text>
                  </TouchableOpacity>

                  {/* Partial warning */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <View style={[styles.partialWarning, { backgroundColor: `${AURA.warning}15`, borderColor: `${AURA.warning}30` }]}>
                      <Ionicons name="warning" size={18} color={AURA.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.partialWarningText, { color: AURA.warning }]}>
                          Resume your sign-up
                        </Text>
                        {codeInfo.partialEmail && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Email: {codeInfo.partialEmail}
                          </Text>
                        )}
                        {codeInfo.partialPhone && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Phone: {codeInfo.partialPhone}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Invite code input */}
                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: codeInfo?.isPartial
                        ? AURA.warning
                        : codeValidated
                        ? AURA.success
                        : (inviteCode.length === 6 && !isValidatingCode)
                        ? AURA.danger
                        : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)'),
                    },
                  ]}>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={
                        codeInfo?.isPartial
                          ? AURA.warning
                          : codeValidated
                          ? AURA.success
                          : AURA.primary
                      }
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, {
                        color: isDark ? AURA.white : AURA.gray900,
                        letterSpacing: 3,
                        fontWeight: '700',
                        fontSize: 18,
                        textAlign: 'center',
                      }]}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      maxLength={6}
                    />
                    {isValidatingCode && <ActivityIndicator size="small" color={AURA.primary} style={{ marginLeft: 8 }} />}
                    {codeValidated && !isValidatingCode && !codeInfo?.isPartial && (
                      <Ionicons name="checkmark-circle" size={22} color={AURA.success} />
                    )}
                    {codeInfo?.isPartial && !isValidatingCode && (
                      <Ionicons name="warning" size={22} color={AURA.warning} />
                    )}
                  </View>

                  {codeValidated && codeInfo && !codeInfo.isPartial && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${AURA.success}15` }]}>
                      <Ionicons name="shield-checkmark" size={18} color={AURA.success} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#86efac' : '#15803d' }]}>
                        You'll join as <Text style={{ fontWeight: '700' }}>{codeInfo.role === 'parent2' ? 'Parent 2' : codeInfo.role === 'guardian' ? 'Guardian' : 'Viewer'}</Text>
                        {codeInfo.relationship ? ` (${codeInfo.relationship})` : ''}
                      </Text>
                    </View>
                  )}

                  {!codeValidated && inviteCode.length >= 6 && !isValidatingCode && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${AURA.danger}15` }]}>
                      <Ionicons name="alert-circle" size={18} color={AURA.danger} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                        Invalid or expired code. Please check and try again.
                      </Text>
                    </View>
                  )}

                  {codeValidated && !codeInfo?.isPartial && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          set up your account
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                        },
                      ]}>
                        <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Full name"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="name"
                        />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                        },
                      ]}>
                        <Ionicons name="mail-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email address"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
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

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                        },
                      ]}>
                        <Ionicons name="call-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                        },
                      ]}>
                        <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Password (min 8 characters)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
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
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
                        </TouchableOpacity>
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                        },
                      ]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
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
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handleJoinFamily}
                        disabled={isLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[AURA.success, '#059669']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? <ActivityIndicator color={AURA.white} size="small" /> : <Text style={styles.loginText}>Join Family</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Partial sign-up completion form */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          complete your registration
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                        },
                      ]}>
                        <Ionicons name="person-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Full name"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="name"
                        />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                        },
                      ]}>
                        <Ionicons name="mail-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email address"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
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

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                        },
                      ]}>
                        <Ionicons name="call-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                        },
                      ]}>
                        <Ionicons name="lock-closed-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Password (min 8 characters)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
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
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.warning} />
                        </TouchableOpacity>
                      </View>

                      <View style={[
                        styles.inputContainer,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                        },
                      ]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinConfirmPassword}
                          onChangeText={setJoinConfirmPassword}
                          secureTextEntry={!showJoinConfirmPassword}
                          editable={!isLoading}
                          returnKeyType="done"
                          onSubmitEditing={handlePartialSignupRecovery}
                          textContentType="newPassword"
                        />
                        <TouchableOpacity
                          onPress={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)}
                          style={styles.eyeButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          disabled={isLoading}
                        >
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.warning} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handlePartialSignupRecovery}
                        disabled={isLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[AURA.warning, '#d97706']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? <ActivityIndicator color={AURA.white} size="small" /> : <Text style={styles.loginText}>Complete Sign-up</Text>}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.signupLinkContainer}>
                        <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          Already have an account?
                        </Text>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('Login', { email: joinEmail })}
                          disabled={isLoading}
                        >
                          <Text style={[styles.signupLink, { color: AURA.warning }]}>Sign In</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Show sign-up link even without code */}
                  {!codeValidated && inviteCode.length < 6 && (
                    <View style={styles.signupLinkContainer}>
                      <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        Don't have an invite code?
                      </Text>
                      <TouchableOpacity onPress={() => setActiveTab('create')} disabled={isLoading}>
                        <Text style={[styles.signupLink, { color: AURA.success }]}>Sign Up Instead</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(800)} style={styles.footer}>
            <Text style={[styles.footerText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)' }]}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  auraGlowTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoFloatWrap: {
    width: Math.min(width * 0.38, 160),
    height: Math.min(width * 0.38, 160),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoImage: {
    width: Math.min(width * 0.35, 140),
    height: Math.min(width * 0.35, 140),
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    fontWeight: '500',
  },

  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 18,
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

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    height: 54,
    borderWidth: 1,
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },

  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: AURA.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    lineHeight: 18,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    gap: 4,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    color: AURA.white,
    fontSize: 14,
    fontWeight: '800',
  },

  joinHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  joinIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  joinTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  joinSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  codeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  codeInfoText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  qrButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },

  partialWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  partialWarningText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  partialWarningSubtext: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },

  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
  },
  signupLinkText: {
    fontSize: 13,
  },
  signupLink: {
    fontSize: 13,
    fontWeight: '800',
  },
});