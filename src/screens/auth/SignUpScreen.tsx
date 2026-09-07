// src/screens/auth/SignUpScreen.tsx - COMPLETE FIXED VERSION
// FIX: Invite code validation, partial sign-up handling, and user isolation

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useFamily } from '../../context/FamilyContext';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;
const { width } = Dimensions.get('window');

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

// ─── Email Validation ──────────────────────────────────────────────────
const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────
export default function SignUpScreen({ navigation, route }: SignUpScreenProps) {
  // ─── TAB STATE ───
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // ─── CREATE ACCOUNT STATE ───
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ─── JOIN FAMILY STATE ───
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

  // ─── FIX: Use FamilyContext for invite validation ─────────────────────
  const { 
    validateInviteCode: validateInviteCodeFromFamily,
    getPartialSignupInfo,
    recoverPartialSignup,
    markSignupComplete,
  } = useFamily();

  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };
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

  // ─── Cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
      socialAuthInProgress.current = false;
    };
  }, []);

  // ─── Animations ──────────────────────────────────────────────────────
  useEffect(() => {
    logoScale.value = withDelay(0, withSpring(1, { damping: 12, stiffness: 100 }));
    formTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 100 }));
  }, []);

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

  // ─── FACEBOOK USER INFO ─────────────────────────────────────────────
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

  // ─── SOCIAL SIGN UP HANDLER ─────────────────────────────────────────
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
      // Try social sign-in first
      if (typeof signInWithSocial === 'function') {
        const success = await signInWithSocial({
          id: `${provider}_${Date.now()}`,
          email,
          fullName: name,
          avatar,
          provider,
        });

        if (success && isMounted.current) {
          showSuccess('Welcome!', `Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
          navigation.replace('BabyOptional');
          return;
        }
      }

      // Fallback: create account with strong temporary password
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

  // ─── SOCIAL BUTTON HANDLERS ─────────────────────────────────────────
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

  // ─── FIXED: CODE VALIDATION using FamilyContext ──────────────────────
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
        // ─── First check for partial signup info ────────────────────
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
            
            // Pre-fill fields with partial data if available
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

        // ─── Use FamilyContext validateInviteCode ──────────────────
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

  // ─── HANDLE PARTIAL SIGNUP RECOVERY ──────────────────────────────────
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

    // Check if user already exists
    try {
      const existingUser = await findUserByEmail(joinEmail.trim());
      if (existingUser) {
        // User exists - try to recover the partial signup
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
      // ─── First, create the account via signUp ──────────────────────
      const signUpResult = await signUp(
        joinFullName.trim(), 
        joinEmail.trim(), 
        joinPassword
      );

      if (signUpResult.success && isMounted.current) {
        // ─── Now mark the partial signup as complete ──────────────────
        const recoveryResult = await recoverPartialSignup(
          trimmedCode,
          userProfile?.id || '',
          joinEmail.trim(),
          joinPhone.trim() || undefined,
          joinFullName.trim()
        );

        if (recoveryResult.success) {
          showSuccess('Welcome to the family!', recoveryResult.message);
          navigation.replace('BabyOptional');
        } else {
          // Even if recovery fails, the user is signed up
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

  // ─── CREATE ACCOUNT HANDLER ─────────────────────────────────────────
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

    // Check for existing account
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
      const success = await signUp(fullName.trim(), email.trim(), password);

      if (success && isMounted.current) {
        showSuccess(`Welcome, ${fullName.trim()}!`, 'Your account has been created successfully');
        navigation.replace('BabyOptional');
      } else {
        // Double-check existence on failure
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

  // ─── JOIN FAMILY HANDLER ────────────────────────────────────────────
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

    // Prevent duplicate accounts
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
        // ─── If this was a partial signup, mark it as complete ──────
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

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={showSplash || (isLoading && !isAuthenticated)}
        text={activeTab === 'join' ? 'Joining your family...' : 'Creating your account...'}
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
            { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoFloatWrap}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Begin weaving precious memories</Text>
          </Animated.View>

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
                {activeTab === 'create' ? 'Create Account' : 'Join Family'}
              </Text>

              {/* ─── TAB SWITCHER ─── */}
              <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102,126,234,0.08)' }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'create' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(102,126,234,0.4)' : '#667eea' }],
                  ]}
                  onPress={() => setActiveTab('create')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'create' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }
                  ]}>
                    Create Account
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'join' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(102,126,234,0.4)' : '#667eea' }],
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
                        <Image source={require('../../../assets/social/apple.png')} style={[styles.socialIcon, isDark && { tintColor: '#FFFFFF' }]} resizeMode="contain" />
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
                    <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>or sign up with email</Text>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  </View>

                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                      placeholder="Full name"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                      value={fullName}
                      onChangeText={setFullName}
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

                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                      placeholder="Password (min 8 characters)"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
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
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#667eea" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                      placeholder="Confirm password"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
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
                      <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#667eea" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                    onPress={handleSignUp}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.loginText}>Create Account</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.termsRow}>
                    <Text style={[styles.termsText, { color: isDark ? '#94a3b8' : '#64748b' }]}>By signing up, you agree to our </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                      <Text style={[styles.termsLink, { color: themeColors.primary }]}>Terms of Service</Text>
                    </TouchableOpacity>
                    <Text style={[styles.termsText, { color: isDark ? '#94a3b8' : '#64748b' }]}> and </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                      <Text style={[styles.termsLink, { color: themeColors.primary }]}>Privacy Policy</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // ─── JOIN FAMILY FORM ──────────────────────────────────
                <>
                  <View style={styles.joinHeader}>
                    <Ionicons name="people-outline" size={28} color="#667eea" />
                    <Text style={[styles.joinTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Join Your Family</Text>
                    <Text style={[styles.joinSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Enter the invite code shared by your family member
                    </Text>
                  </View>

                  {/* ─── QR SCAN BUTTON ─── */}
                  <TouchableOpacity
                    style={[styles.qrButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102,126,234,0.05)' }]}
                    onPress={() => navigation.navigate('QRScanner' as never)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="qr-code-outline" size={22} color="#667eea" />
                    <Text style={[styles.qrButtonText, { color: isDark ? '#fff' : '#1e293b' }]}>Scan QR Code Instead</Text>
                  </TouchableOpacity>

                  {/* ─── Partial Sign-up Warning ─── */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <View style={[styles.partialWarning, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b30' }]}>
                      <Ionicons name="warning" size={18} color="#f59e0b" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.partialWarningText, { color: '#f59e0b' }]}>
                          Resume your sign-up
                        </Text>
                        {codeInfo.partialEmail && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                            Email: {codeInfo.partialEmail}
                          </Text>
                        )}
                        {codeInfo.partialPhone && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                            Phone: {codeInfo.partialPhone}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    codeValidated && !codeInfo?.isPartial && styles.inputContainerSuccess,
                    codeInfo?.isPartial && styles.inputContainerPartial,
                    !codeValidated && inviteCode.length === 6 && !isValidatingCode && styles.inputContainerError,
                  ]}>
                    <Ionicons name="key-outline" size={20} color={
                      codeInfo?.isPartial ? '#f59e0b' : 
                      codeValidated ? '#22c55e' : '#667eea'
                    } style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#fff' : '#1e293b', letterSpacing: 3, fontWeight: '700', fontSize: 18, textAlign: 'center' }]}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      maxLength={6}
                    />
                    {isValidatingCode && <ActivityIndicator size="small" color="#667eea" style={{ marginLeft: 8 }} />}
                    {codeValidated && !isValidatingCode && !codeInfo?.isPartial && (
                      <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                    )}
                    {codeInfo?.isPartial && !isValidatingCode && (
                      <Ionicons name="warning" size={22} color="#f59e0b" />
                    )}
                  </View>

                  {codeValidated && codeInfo && !codeInfo.isPartial && (
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
                      <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>Invalid or expired code. Please check and try again.</Text>
                    </View>
                  )}

                  {codeValidated && !codeInfo?.isPartial && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>set up your account</Text>
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
                        <Ionicons name="call-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Password (min 8 characters)"
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
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#667eea" />
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
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#667eea" />
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
                          {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.loginText}>Join Family</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ─── Partial Sign-up Completion Form ─── */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                          complete your registration
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="person-outline" size={20} color="#f59e0b" style={styles.inputIcon} />
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
                        <Ionicons name="mail-outline" size={20} color="#f59e0b" style={styles.inputIcon} />
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
                        <Ionicons name="call-outline" size={20} color="#f59e0b" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={20} color="#f59e0b" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Password (min 8 characters)"
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
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#f59e0b" />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#f59e0b" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
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
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#f59e0b" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handlePartialSignupRecovery}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#f59e0b', '#d97706']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.loginText}>Complete Sign-up</Text>}
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* ─── Already have an account? ─── */}
                      <View style={styles.signupLinkContainer}>
                        <Text style={[styles.signupLinkText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                          Already have an account?
                        </Text>
                        <TouchableOpacity 
                          onPress={() => navigation.navigate('Login', { email: joinEmail })} 
                          disabled={isLoading}
                        >
                          <Text style={[styles.signupLink, { color: '#f59e0b' }]}>Sign In</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* ─── SHOW SIGN UP LINK EVEN WITHOUT CODE ─── */}
                  {!codeValidated && inviteCode.length < 6 && (
                    <View style={styles.signupLinkContainer}>
                      <Text style={[styles.signupLinkText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                        Don't have an invite code?
                      </Text>
                      <TouchableOpacity onPress={() => setActiveTab('create')} disabled={isLoading}>
                        <Text style={[styles.signupLink, { color: '#22c55e' }]}>Sign Up Instead</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 16,
  },
  logoImage: {
    width: Math.min(width * 0.35, 140),
    height: Math.min(width * 0.35, 140),
  },
  logoText: {
    fontSize: 28,
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
  inputContainerSuccess: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.05)',
  },
  inputContainerError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  inputContainerPartial: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.05)',
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
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
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
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
    backgroundColor: 'rgba(102,126,234,0.05)',
    marginBottom: 16,
    gap: 8,
  },
  qrButtonText: {
    fontWeight: '600',
    fontSize: 15,
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
  // ─── Partial Sign-up Styles ───
  partialWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  partialWarningText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  partialWarningSubtext: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});