import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  FadeIn, FadeInUp, FadeInDown, FadeInRight,
  useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
  useAnimatedScrollHandler, withRepeat, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import {
  ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView,
  Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
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
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../utils/supabase';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

WebBrowser.maybeCompleteAuthSession();

const REMEMBER_ME_EMAIL_KEY = '@littleloom_remember_me_email';
const REMEMBER_ME_FLAG_KEY = '@littleloom_remember_me_enabled';

const GOOGLE_CLIENT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
}) ?? 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '1526133312174343';
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'littleloom', useProxy: true });

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
const isValidPhone = (phone: string): boolean => /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im.test(phone.trim());
const isValidUsername = (username: string): boolean => {
  const trimmed = username.trim();
  return trimmed.length >= 3 && /^[a-zA-Z0-9_.]+$/.test(trimmed);
};

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM — shared across all auth screens
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

/* ── Shared primitives ── */
const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) onPress?.(); }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const AuraLogo = React.memo(({ size = 96, imageSource }: { size?: number; imageSource: any }) => {
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1800 }), withTiming(1, { duration: 1800 })), -1, true);
  }, [rotate, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [1, 1.08], [0.35, 0.55], Extrapolation.CLAMP), transform: [{ scale: pulse.value }] }));
  return (
    <View style={{ width: size + 32, height: size + 32, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glowStyle]}>
        <LinearGradient colors={['#6366f1', '#ec4899', '#f59e0b', '#6366f1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, opacity: 0.35 }} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, ringStyle]}>
        <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 2, borderColor: 'transparent', borderTopColor: '#6366f1', borderRightColor: '#ec4899' }} />
      </Animated.View>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...DS.shadow.lg }}>
        <Image source={imageSource} style={{ width: size * 0.72, height: size * 0.72 }} resizeMode="contain" />
      </View>
    </View>
  );
});

const AuroraDots = React.memo(({ isDark }: { isDark: boolean }) => {
  const drift = useSharedValue(0);
  useEffect(() => { drift.value = withRepeat(withTiming(1, { duration: 20000 }), -1, true); }, [drift]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(drift.value, [0, 1], [0, -30], Extrapolation.CLAMP) }],
    opacity: interpolate(drift.value, [0, 1], [0.3, 0.6], Extrapolation.CLAMP),
  }));
  const positions = [
    { x: 0.08, y: 0.15, size: 60, color: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)' },
    { x: 0.85, y: 0.22, size: 80, color: isDark ? 'rgba(236,72,153,0.20)' : 'rgba(236,72,153,0.10)' },
    { x: 0.15, y: 0.75, size: 90, color: isDark ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.10)' },
    { x: 0.75, y: 0.85, size: 70, color: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.08)' },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {positions.map((p, i) => (
        <Animated.View key={i} style={[{ position: 'absolute', left: SCREEN_W * p.x - p.size / 2, top: SCREEN_H * p.y - p.size / 2, width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.color }, dotStyle]} />
      ))}
    </View>
  );
});

export default function LoginScreen({ navigation, route }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'join'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberMeLoaded, setRememberMeLoaded] = useState(false);
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
    role: string; relationship?: string; used?: boolean; signupCompleted?: boolean;
    isPartial?: boolean; partialEmail?: string; partialPhone?: string; partialName?: string;
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [showPartialRecovery, setShowPartialRecovery] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const {
    signIn, signUpWithInviteCode, signInWithSocial, isLoading: authLoading,
    isAuthenticated, isBiometricAvailable, loginWithBiometric, hasBiometricLoginCredentials,
    enableBiometricLogin, shouldShowBiometricPrompt, setupComplete, hasParent2, hasBaby,
    hasSeenOnboarding, userProfile, findUserByEmail, findUserByEmailOrUsername, findUserByEmailOrUsernameOrPhone,
  } = useAuth();
  const { validateInviteCode: validateInviteCodeFromFamily, getInviteCodeById, getPartialSignupInfo, recoverPartialSignup, markSignupComplete } = useFamily();
  const { resetUnlockLock, forceUnlock } = useSecurity();
  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };
  const triggerHaptic = customization?.triggerHaptic ?? (() => {});
  const { toast, error: showError, success: showSuccess, confirm, info: showInfo, alert: showAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const joinAttempted = useRef(false);
  const autoLoginAttempted = useRef(false);
  const biometricCheckComplete = useRef(false);
  const codeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialAuthInProgress = useRef(false);
  const navigationAttemptedRef = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedEmail, savedFlag] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_ME_EMAIL_KEY),
          AsyncStorage.getItem(REMEMBER_ME_FLAG_KEY),
        ]);
        if (cancelled) return;
        if (savedFlag === 'true' && savedEmail) { setRememberMe(true); setEmail(savedEmail); }
      } catch (e) {
        if (__DEV__) console.warn('[Login] Failed to load remember-me:', e);
      } finally { if (!cancelled) setRememberMeLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistRememberMe = useCallback(async (enabled: boolean, emailToSave?: string) => {
    try {
      if (enabled && emailToSave) {
        await AsyncStorage.multiSet([[REMEMBER_ME_FLAG_KEY, 'true'], [REMEMBER_ME_EMAIL_KEY, emailToSave.trim()]]);
      } else {
        await AsyncStorage.multiRemove([REMEMBER_ME_FLAG_KEY, REMEMBER_ME_EMAIL_KEY]);
      }
    } catch (e) { if (__DEV__) console.warn('[Login] Failed to save remember-me:', e); }
  }, []);

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    { clientId: GOOGLE_CLIENT_ID, redirectUri, scopes: ['openid', 'profile', 'email'], responseType: 'token' },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token' }
  );
  const [fbRequest, fbResponse, fbPromptAsync] = AuthSession.useAuthRequest(
    { clientId: FACEBOOK_APP_ID, redirectUri, scopes: ['public_profile', 'email'], responseType: 'token' },
    { authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth', tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token' }
  );

  useEffect(() => {
    const code = (route.params as any)?.inviteCode;
    if (code) { if (activeTab !== 'join') setActiveTab('join'); setInviteCode(code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); }
  }, [route.params]);

  const userName = userProfile?.fullName || 'there';

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) handleGoogleUserInfo(authentication.accessToken);
    } else if (googleResponse?.type === 'error') {
      showError('Google Error', 'Authentication failed. Please try again.');
      setIsProcessing(false); socialAuthInProgress.current = false;
    } else if (googleResponse?.type === 'cancel') { setIsProcessing(false); socialAuthInProgress.current = false; }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const { authentication } = fbResponse;
      if (authentication?.accessToken) handleFacebookUserInfo(authentication.accessToken);
    } else if (fbResponse?.type === 'error') {
      showError('Facebook Error', 'Authentication failed. Please try again.');
      setIsProcessing(false); socialAuthInProgress.current = false;
    } else if (fbResponse?.type === 'cancel') { setIsProcessing(false); socialAuthInProgress.current = false; }
  }, [fbResponse]);

  const handleGoogleUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const userData = await response.json();
      if (userData.email) await handleSocialLogin('google', userData.email, userData.name || 'Google User', userData.picture);
      else throw new Error('No email in Google response');
    } catch (error) {
      console.error('Google user info error:', error);
      showError('Google Error', 'Could not retrieve account information');
      setIsProcessing(false); socialAuthInProgress.current = false;
    }
  };

  const handleFacebookUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(`https://graph.facebook.com/me?fields=email,name,picture&access_token=${accessToken}`);
      const userData = await response.json();
      if (userData.email) await handleSocialLogin('facebook', userData.email, userData.name || 'Facebook User', userData.picture?.data?.url);
      else throw new Error('No email in Facebook response');
    } catch (error) {
      console.error('Facebook user info error:', error);
      showError('Facebook Error', 'Could not retrieve account information');
      setIsProcessing(false); socialAuthInProgress.current = false;
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'facebook', email: string, name: string, avatar?: string) => {
    if (!email) { showError('Auth Failed', `Could not get ${provider} account information`); setIsProcessing(false); socialAuthInProgress.current = false; return; }
    setIsProcessing(true);
    try {
      const success = await signInWithSocial({ id: `${provider}_${Date.now()}`, email, fullName: name, avatar, provider });
      if (success && isMounted.current) { showSuccess('Welcome!', `Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`); forceUnlock().catch(() => {}); }
    } catch { showError('Login Failed', 'Social authentication failed'); }
    finally { if (isMounted.current) { setIsProcessing(false); socialAuthInProgress.current = false; } }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false; loginAttempted.current = false; autoLoginAttempted.current = false;
      joinAttempted.current = false; socialAuthInProgress.current = false;
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return; if (!isAuthenticated) return; if (isProcessing) return;
    if (navigationAttemptedRef.current) return; if (loginAttempted.current) return;
    navigationAttemptedRef.current = true;
    const parent2Addressed = hasParent2 === true || hasParent2 === 'skipped';
    const babyAddressed = hasBaby === true || hasBaby === 'skipped';
    const timer = setTimeout(() => {
      if (!isMounted.current) return; if (loginAttempted.current) return;
      forceUnlock().catch(() => {});
      if (!setupComplete) {
        if (!babyAddressed) navigation.replace('BabyOptional');
        else if (!parent2Addressed) navigation.replace('CoParentInviteScreen');
        else navigation.replace('Main');
        return;
      }
      navigation.replace('Main');
    }, 200);
    return () => clearTimeout(timer);
  }, [authLoading, isAuthenticated, isProcessing, setupComplete, hasParent2, hasBaby, navigation, forceUnlock]);

  useEffect(() => {
    logoScale.value = withSequence(withTiming(0.8, { duration: 0 }), withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  useEffect(() => {
    if (activeTab !== 'join') return;
    if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
    const trimmed = inviteCode.trim();
    if (trimmed.length !== 6) { setCodeValidated(false); setCodeInfo(null); setShowPartialRecovery(false); return; }
    setIsValidatingCode(true); setShowPartialRecovery(false);
    codeDebounceTimer.current = setTimeout(async () => {
      try {
        const partialInfo = await getPartialSignupInfo(trimmed);
        if (partialInfo.exists) {
          if (isMounted.current) {
            setCodeValidated(true);
            setCodeInfo({ role: 'partial', isPartial: true, partialEmail: partialInfo.email, partialPhone: partialInfo.phone, partialName: partialInfo.name, used: true, signupCompleted: false });
            setShowPartialRecovery(true);
            if (partialInfo.email) setJoinEmail(partialInfo.email);
            if (partialInfo.phone) setJoinPhone(partialInfo.phone);
            if (partialInfo.name) setJoinFullName(partialInfo.name);
            showInfo('Resume Sign-up', partialInfo.email ? `Continue signing up with ${partialInfo.email}` : 'Complete your registration');
            setIsValidatingCode(false);
          }
          return;
        }
        let codeDetails = await getInviteCodeById(trimmed);
        if (codeDetails) {
          if (codeDetails.used && codeDetails.signup_completed) {
            if (isMounted.current) {
              setCodeValidated(false); setCodeInfo(null);
              showInfo('Code Already Used', 'This invite code has already been used. Please sign in with your account.');
              setTimeout(() => { if (isMounted.current) setActiveTab('signin'); }, 2000);
              setIsValidatingCode(false);
            }
            return;
          }
        }
        const result = await validateInviteCodeFromFamily(trimmed);
        if (isMounted.current) {
          if (result.valid && result.data) {
            setCodeValidated(true);
            setCodeInfo({ role: result.data.role, relationship: result.data.relationship, used: result.data.used || false, signupCompleted: result.data.signup_completed || false, isPartial: result.data.isPartial || false });
            showInfo('Valid Code!', `You'll join as ${result.data.role === 'parent2' ? 'Parent 2' : result.data.role === 'guardian' ? 'Guardian' : 'Viewer'}`);
          } else { setCodeValidated(false); setCodeInfo(null); }
        }
      } catch (error) {
        console.error('[Login] Code validation error:', error);
        if (isMounted.current) { setCodeValidated(false); setCodeInfo(null); }
      } finally { if (isMounted.current) setIsValidatingCode(false); }
    }, 500);
  }, [inviteCode, activeTab, validateInviteCodeFromFamily, getInviteCodeById, getPartialSignupInfo, showInfo, showAlert]);

  const handlePartialSignupRecovery = useCallback(async () => {
    if (isProcessing || authLoading) return;
    const trimmedCode = inviteCode.trim();
    if (trimmedCode.length !== 6) { showError('Invalid Code', 'Please enter a valid invite code'); return; }
    if (!joinEmail.trim()) { showError('Missing Email', 'Please enter your email address'); return; }
    if (!isValidEmail(joinEmail)) { showError('Invalid Email', 'Please enter a valid email address'); return; }
    if (!joinFullName.trim()) { showError('Missing Name', 'Please enter your full name'); return; }
    if (!joinPassword) { showError('Missing Password', 'Please enter a password'); return; }
    if (joinPassword.length < 8) { showError('Weak Password', 'Password must be at least 8 characters'); return; }
    if (joinPassword !== joinConfirmPassword) { showError('Password Mismatch', 'Passwords do not match'); return; }
    try {
      const existingUser = await findUserByEmail(joinEmail.trim());
      if (existingUser) { showInfo('Account Found', 'You already have an account. Would you like to sign in instead?'); setActiveTab('signin'); setEmail(joinEmail.trim()); return; }
    } catch (e) { console.warn('[Login] Error checking existing user:', e); }
    setIsProcessing(true); Keyboard.dismiss(); triggerHaptic('medium');
    try {
      const signUpResult = await signUpWithInviteCode(trimmedCode, joinFullName.trim(), joinEmail.trim(), joinPassword);
      if (signUpResult.success && isMounted.current) {
        const { data: { user } } = await supabase.auth.getUser();
        const recoveryResult = await recoverPartialSignup(trimmedCode, user?.id || '', joinEmail.trim(), joinPhone.trim() || undefined, joinFullName.trim());
        if (recoveryResult.success) { showSuccess('Welcome to the family!', recoveryResult.message); forceUnlock().catch(() => {}); }
        else { showSuccess('Account Created!', 'Your account has been created. Please complete your family setup.'); forceUnlock().catch(() => {}); }
      } else { showError('Failed', signUpResult.message || 'Could not create account. Please try again.'); joinAttempted.current = false; }
    } catch (error) {
      console.error('[Login] Partial signup recovery error:', error);
      showError('Error', 'Failed to complete signup. Please try again.');
      joinAttempted.current = false;
    } finally { if (isMounted.current) setIsProcessing(false); }
  }, [inviteCode, joinEmail, joinPhone, joinFullName, joinPassword, joinConfirmPassword, signUpWithInviteCode, recoverPartialSignup, findUserByEmail, userProfile, isProcessing, authLoading, triggerHaptic, showError, showSuccess, showInfo, forceUnlock]);

  const handleLogin = useCallback(async () => {
    loginAttempted.current = false;
    if (isProcessing || authLoading) return;
    if (isAuthenticated && setupComplete) { forceUnlock().catch(() => {}); navigation.replace('Main'); return; }
    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier) { showError('Missing Information', 'Please enter your email, phone number, or username'); triggerHaptic('error'); return; }
    const isEmail = isValidEmail(trimmedIdentifier);
    const isPhone = isValidPhone(trimmedIdentifier);
    const isUsername = isValidUsername(trimmedIdentifier);
    if (!isEmail && !isPhone && !isUsername) { showError('Invalid Input', 'Please enter a valid email, phone number, or username'); triggerHaptic('error'); return; }
    if (!password) { showError('Missing Password', 'Please enter your password'); triggerHaptic('error'); return; }
    if (loginAttempted.current) return;
    loginAttempted.current = true;
    setIsProcessing(true); Keyboard.dismiss(); triggerHaptic('medium');
    try {
      let userIdentifier = trimmedIdentifier;
      if (!isEmail) {
        try {
          const user = await findUserByEmailOrUsernameOrPhone(trimmedIdentifier);
          if (user && user.email) userIdentifier = user.email;
          else { showError('Account Not Found', 'No account matches that email, username, or phone number.'); triggerHaptic('error'); loginAttempted.current = false; setIsProcessing(false); return; }
        } catch (e) { if (__DEV__) console.warn('[Login] Identifier resolve failed:', e); }
      }
      const success = await signIn(userIdentifier, password);
      if (success && isMounted.current) {
        await persistRememberMe(rememberMe, userIdentifier);
        showSuccess(`Welcome Back${userName !== 'there' ? `, ${userName}` : ''}!`, 'Successfully signed in');
        forceUnlock().catch(() => {});
        if (isBiometricAvailable && !(await hasBiometricLoginCredentials()) && await shouldShowBiometricPrompt()) {
          promptEnableBiometricLogin(userIdentifier, password);
        }
      } else if (isMounted.current) {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
        showError('Login Failed', 'Invalid credentials. Please try again.');
        loginAttempted.current = false;
      }
    } catch (error) { showError('Error', 'Login failed. Please try again.'); loginAttempted.current = false; }
    finally { if (isMounted.current) setIsProcessing(false); }
  }, [email, password, rememberMe, persistRememberMe, signIn, isProcessing, authLoading, isAuthenticated, setupComplete, hasParent2, hasBaby, shouldShowBiometricPrompt, findUserByEmailOrUsernameOrPhone, forceUnlock, navigation, userName, triggerHaptic, showError, showSuccess]);

  const handleJoinFamily = useCallback(async () => {
    joinAttempted.current = false;
    if (isProcessing || authLoading) return;
    if (isAuthenticated && setupComplete) { forceUnlock().catch(() => {}); navigation.replace('Main'); return; }
    const trimmedCode = inviteCode.trim();
    let isPartialSignup = false;
    if (trimmedCode.length === 6) {
      try {
        const partialInfo = await getPartialSignupInfo(trimmedCode);
        if (partialInfo.exists) {
          isPartialSignup = true;
          if (partialInfo.email && joinEmail.trim().toLowerCase() !== partialInfo.email.toLowerCase()) {
            showError('Email Mismatch', `This partial sign-up was started with ${partialInfo.email}. Please use the same email to continue.`);
            setJoinEmail(partialInfo.email || ''); return;
          }
        }
      } catch (e) { console.warn('[Login] Error checking partial sign-up:', e); }
    }
    const existingUser = await findUserByEmail(joinEmail.trim());
    if (existingUser) {
      if (isPartialSignup) {
        confirm('Account Exists', 'You already have an account. Would you like to sign in instead?',
          () => { setActiveTab('signin'); setEmail(joinEmail.trim()); }, () => {}, 'Sign In', 'Continue');
        return;
      }
      showInfo('Account Found', 'You already have an account. Please sign in instead.');
      setActiveTab('signin'); setEmail(joinEmail.trim()); return;
    }
    if (trimmedCode.length !== 6) { showError('Invalid Code', 'Invite code must be exactly 6 characters'); triggerHaptic('error'); return; }
    if (!codeValidated) { showError('Invalid Code', 'The invite code is not valid or has expired'); triggerHaptic('error'); return; }
    if (!joinFullName.trim()) { showError('Missing Name', 'Please enter your full name'); triggerHaptic('error'); return; }
    if (!joinEmail.trim()) { showError('Missing Email', 'Please enter your email address'); triggerHaptic('error'); return; }
    if (!isValidEmail(joinEmail)) { showError('Invalid Email', 'Please enter a valid email address'); triggerHaptic('error'); return; }
    if (!joinPassword) { showError('Missing Password', 'Please enter a password'); triggerHaptic('error'); return; }
    if (joinPassword.length < 8) { showError('Weak Password', 'Password must be at least 8 characters'); triggerHaptic('error'); return; }
    if (joinPassword !== joinConfirmPassword) { showError('Password Mismatch', 'Passwords do not match'); triggerHaptic('error'); return; }
    joinAttempted.current = true;
    setIsProcessing(true); Keyboard.dismiss(); triggerHaptic('medium');
    try {
      const result = await signUpWithInviteCode(trimmedCode, joinFullName.trim(), joinEmail.trim(), joinPassword);
      if (result.success && isMounted.current) {
        if (isPartialSignup && userProfile?.id) await markSignupComplete(trimmedCode, userProfile.id);
        await persistRememberMe(rememberMe, joinEmail.trim());
        showSuccess(`Welcome, ${joinFullName.trim()}!`, result.message);
        forceUnlock().catch(() => {});
      } else { showError('Join Failed', result.message || 'Could not join family. Please try again.'); joinAttempted.current = false; }
    } catch { showError('Error', 'Failed to join family. Please try again.'); joinAttempted.current = false; }
    finally { if (isMounted.current) setIsProcessing(false); }
  }, [inviteCode, codeValidated, joinFullName, joinEmail, joinPassword, joinConfirmPassword, signUpWithInviteCode, findUserByEmail, getPartialSignupInfo, markSignupComplete, userProfile, isProcessing, authLoading, isAuthenticated, setupComplete, triggerHaptic, showError, showSuccess, showInfo, confirm, forceUnlock, navigation, rememberMe, persistRememberMe]);

  const handleBiometricLogin = useCallback(async () => {
    loginAttempted.current = false;
    if (isProcessing || authLoading) return false;
    if (isAuthenticated && setupComplete) { forceUnlock().catch(() => {}); navigation.replace('Main'); return true; }
    resetUnlockLock(); loginAttempted.current = true; setIsProcessing(true); triggerHaptic('medium');
    try {
      const success = await loginWithBiometric();
      if (success && isMounted.current) { showSuccess(`Welcome${userName !== 'there' ? `, ${userName}` : ''}!`, 'Biometric login successful'); forceUnlock().catch(() => {}); return true; }
      else if (!success) { showError('Biometric Failed', 'Please use your password'); loginAttempted.current = false; return false; }
    } catch { showError('Error', 'Biometric login failed'); loginAttempted.current = false; return false; }
    finally { if (isMounted.current) setIsProcessing(false); }
  }, [loginWithBiometric, isProcessing, authLoading, isAuthenticated, setupComplete, resetUnlockLock, forceUnlock, navigation, userName, triggerHaptic, showError, showSuccess]);

  const promptEnableBiometricLogin = async (userEmail: string, userPassword: string) => {
    if (!isMounted.current) return;
    confirm('Enable Biometric Login?', 'Would you like to use biometric authentication for faster login next time?',
      async () => {
        try {
          const result = await enableBiometricLogin(userEmail, userPassword);
          if (result && isMounted.current) { showSuccess('Enabled!', 'Biometric login is now active'); setShowBiometricButton(true); }
        } catch { if (isMounted.current) showError('Error', 'Could not enable biometric login'); }
      }, () => {}, 'Enable', 'Not Now');
  };

  useEffect(() => {
    if (biometricCheckComplete.current) return;
    if (!isBiometricAvailable) { biometricCheckComplete.current = true; setAuthInitialized(true); return; }
    const checkBiometricStatus = async () => {
      try {
        const hasCreds = await hasBiometricLoginCredentials();
        if (hasCreds && isMounted.current) setShowBiometricButton(true);
        biometricCheckComplete.current = true; setAuthInitialized(true);
      } catch { biometricCheckComplete.current = true; setAuthInitialized(true); }
    };
    checkBiometricStatus();
  }, [isBiometricAvailable, hasBiometricLoginCredentials]);

  const isLoading = authLoading || isProcessing || !authInitialized;

  const handleGoogleLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true; triggerHaptic('light'); setIsProcessing(true);
    try { await googlePromptAsync(); } catch { showError('Google Error', 'Could not open Google sign-in'); setIsProcessing(false); socialAuthInProgress.current = false; }
  };

  const handleAppleLogin = async () => { triggerHaptic('light'); showInfo('Coming Soon', 'Apple Sign-In will be available shortly'); };

  const handleFacebookLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true; triggerHaptic('light'); setIsProcessing(true);
    try { await fbPromptAsync(); } catch { showError('Facebook Error', 'Could not open Facebook sign-in'); setIsProcessing(false); socialAuthInProgress.current = false; }
  };

  const handleScanQR = useCallback(() => { triggerHaptic('light'); navigation.navigate('QRScanner' as never); }, [navigation, triggerHaptic]);
  const handleGoToSignUp = useCallback(() => { triggerHaptic('light'); navigation.navigate('SignUp'); }, [navigation, triggerHaptic]);
  const handleToggleRememberMe = useCallback(() => {
    triggerHaptic('light');
    setRememberMe((prev) => { const next = !prev; if (!next) persistRememberMe(false).catch(() => {}); return next; });
  }, [persistRememberMe, triggerHaptic]);

  const bgColors = isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0'];

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <UniversalSpinner visible={isLoading && !isAuthenticated} text={activeTab === 'join' ? 'Joining your family...' : 'Signing you in...'} subtext="Please wait a moment" size="medium" overlay={true} blur={true} />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
      <AuroraDots isDark={isDark} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_TOP_PADDING + 20, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + brand */}
          <Animated.View style={[styles.logoSection, logoStyle]}>
            <AuraLogo imageSource={require('../../../assets/logo.png')} size={88} />
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.brandTitle}>LittleLoom</GradientText>
            <Text style={[styles.brandTagline, { color: isDark ? DS.gray400 : DS.gray500 }]}>Track every precious moment</Text>
          </Animated.View>

          {/* Tab switcher pill */}
          <View style={[styles.tabPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'signin' && { backgroundColor: isDark ? DS.darkCard : DS.white, ...DS.shadow.sm }]}
              onPress={() => setActiveTab('signin')}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={14} color={activeTab === 'signin' ? DS.primary : (isDark ? DS.gray400 : DS.gray500)} />
              <Text style={[styles.tabText, { color: activeTab === 'signin' ? DS.primary : (isDark ? DS.gray400 : DS.gray500) }, activeTab === 'signin' && { fontWeight: '700' }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'join' && { backgroundColor: isDark ? DS.darkCard : DS.white, ...DS.shadow.sm }]}
              onPress={() => setActiveTab('join')}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={14} color={activeTab === 'join' ? DS.success : (isDark ? DS.gray400 : DS.gray500)} />
              <Text style={[styles.tabText, { color: activeTab === 'join' ? DS.success : (isDark ? DS.gray400 : DS.gray500) }, activeTab === 'join' && { fontWeight: '700' }]}>Join Family</Text>
            </TouchableOpacity>
          </View>

          {/* Glass card */}
          <View style={styles.card}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />

              {activeTab === 'signin' ? (
                <>
                  {/* Social row */}
                  <View style={styles.socialRow}>
                    <PressableScale onPress={handleGoogleLogin} disabled={isLoading} activeScale={0.92}>
                      <View style={[styles.socialBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <Image source={require('../../../assets/social/google.png')} style={styles.socialIcon} resizeMode="contain" />
                      </View>
                    </PressableScale>
                    {Platform.OS === 'ios' && (
                      <PressableScale onPress={handleAppleLogin} disabled={isLoading} activeScale={0.92}>
                        <View style={[styles.socialBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                          <Image source={require('../../../assets/social/apple.png')} style={[styles.socialIcon, isDark && { tintColor: DS.white }]} resizeMode="contain" />
                        </View>
                      </PressableScale>
                    )}
                    <PressableScale onPress={handleFacebookLogin} disabled={isLoading} activeScale={0.92}>
                      <View style={[styles.socialBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <Image source={require('../../../assets/social/facebook.png')} style={styles.socialIcon} resizeMode="contain" />
                      </View>
                    </PressableScale>
                  </View>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? DS.gray500 : DS.gray400 }]}>or continue with email</Text>
                    <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  </View>

                  {showBiometricButton && (
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.biometricSection}>
                      <PressableScale onPress={handleBiometricLogin} disabled={isLoading} activeScale={0.97}>
                        <View style={[styles.biometricBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : `${DS.primary}08`, borderColor: isDark ? 'rgba(99,102,241,0.25)' : `${DS.primary}20` }]}>
                          <View style={[styles.biometricIconWrap, { backgroundColor: `${DS.primary}18` }]}>
                            <Ionicons name="finger-print" size={22} color={DS.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.biometricTitle, { color: isDark ? DS.white : DS.gray900 }]}>Use Biometrics</Text>
                            <Text style={[styles.biometricSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Tap to unlock instantly</Text>
                          </View>
                          <Ionicons name="arrow-forward" size={18} color={DS.primary} />
                        </View>
                      </PressableScale>
                    </Animated.View>
                  )}

                  <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Email, username, or phone</Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="person-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                      placeholder="you@example.com"
                      placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                    />
                  </View>

                  <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Password</Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="lock-closed-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                      placeholder="Enter your password"
                      placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      textContentType="password"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }} disabled={isLoading}>
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={isDark ? DS.gray400 : DS.gray500} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.rowContainer}>
                    <TouchableOpacity style={styles.rememberMeContainer} onPress={handleToggleRememberMe} disabled={isLoading || !rememberMeLoaded} activeOpacity={0.7}>
                      <View style={[styles.checkbox, { borderColor: DS.primary }, rememberMe && { backgroundColor: DS.primary }]}>
                        {rememberMe && <Ionicons name="checkmark" size={12} color={DS.white} />}
                      </View>
                      <Text style={[styles.rememberMeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Remember me</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={isLoading}>
                      <Text style={[styles.forgotText, { color: DS.primary }]}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>

                  <PressableScale onPress={handleLogin} disabled={isLoading} activeScale={0.97} style={{ marginTop: DS.space.sm }}>
                    <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
                      {isLoading ? <ActivityIndicator color={DS.white} size="small" /> : (
                        <>
                          <Ionicons name="log-in-outline" size={18} color={DS.white} />
                          <Text style={styles.submitText}>Sign In</Text>
                        </>
                      )}
                    </LinearGradient>
                  </PressableScale>

                  <View style={styles.footerRow}>
                    <Text style={[styles.footerText, { color: isDark ? DS.gray400 : DS.gray500 }]}>New to LittleLoom?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                      <Text style={[styles.footerLink, { color: DS.primary }]}>Create account</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Join Family */}
                  <View style={styles.joinHeader}>
                    <View style={[styles.cardIconWrap, { backgroundColor: `${DS.success}18` }]}>
                      <Ionicons name="people-outline" size={22} color={DS.success} />
                    </View>
                    <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Join Your Family</Text>
                    <Text style={[styles.cardDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Enter the invite code shared by your family member
                    </Text>
                  </View>

                  <PressableScale onPress={handleScanQR} disabled={isLoading} activeScale={0.97}>
                    <View style={[styles.qrBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : `${DS.primary}08`, borderColor: isDark ? DS.darkBorder : `${DS.primary}20` }]}>
                      <Ionicons name="qr-code-outline" size={20} color={DS.primary} />
                      <Text style={[styles.qrText, { color: isDark ? DS.white : DS.gray800 }]}>Scan QR Code Instead</Text>
                    </View>
                  </PressableScale>

                  {codeInfo?.isPartial && showPartialRecovery && (
                    <View style={[styles.partialBanner, { backgroundColor: `${DS.warning}10`, borderColor: `${DS.warning}30` }]}>
                      <Ionicons name="warning" size={16} color={DS.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.partialTitle, { color: DS.warning }]}>Resume your sign-up</Text>
                        {codeInfo.partialEmail && <Text style={[styles.partialSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Email: {codeInfo.partialEmail}</Text>}
                        {codeInfo.partialPhone && <Text style={[styles.partialSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Phone: {codeInfo.partialPhone}</Text>}
                      </View>
                    </View>
                  )}

                  <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Invite code</Text>
                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    codeValidated && !codeInfo?.isPartial && { borderColor: DS.success, backgroundColor: `${DS.success}08` },
                    codeInfo?.isPartial && { borderColor: DS.warning, backgroundColor: `${DS.warning}08` },
                    !codeValidated && inviteCode.length === 6 && !isValidatingCode && { borderColor: DS.danger, backgroundColor: `${DS.danger}08` },
                  ]}>
                    <Ionicons name="key-outline" size={18} color={codeInfo?.isPartial ? DS.warning : codeValidated ? DS.success : DS.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? DS.white : DS.gray900, letterSpacing: 3, fontWeight: '700', fontSize: 18 }]}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      maxLength={6}
                    />
                    {isValidatingCode && <ActivityIndicator size="small" color={DS.primary} style={{ marginLeft: 8 }} />}
                    {codeValidated && !isValidatingCode && !codeInfo?.isPartial && <Ionicons name="checkmark-circle" size={20} color={DS.success} />}
                    {codeInfo?.isPartial && !isValidatingCode && <Ionicons name="warning" size={20} color={DS.warning} />}
                  </View>

                  {codeValidated && codeInfo && !codeInfo.isPartial && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${DS.success}10` }]}>
                      <Ionicons name="shield-checkmark" size={16} color={DS.success} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#86efac' : '#15803d' }]}>
                        You'll join as <Text style={{ fontWeight: '700' }}>{codeInfo.role === 'parent2' ? 'Parent 2' : codeInfo.role === 'guardian' ? 'Guardian' : 'Viewer'}</Text>
                        {codeInfo.relationship ? ` (${codeInfo.relationship})` : ''}
                      </Text>
                    </View>
                  )}

                  {!codeValidated && inviteCode.length >= 6 && !isValidatingCode && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${DS.danger}10` }]}>
                      <Ionicons name="alert-circle" size={16} color={DS.danger} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>Invalid or expired code. Please check and try again.</Text>
                    </View>
                  )}

                  {codeValidated && !codeInfo?.isPartial && (
                    <>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Full name</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="person-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="Your full name"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                        />
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Email</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="mail-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="you@example.com"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={joinEmail}
                          onChangeText={setJoinEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                        />
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Phone (optional)</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="call-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="+1 (555) 000-0000"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                        />
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="Min. 8 characters"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={joinPassword}
                          onChangeText={setJoinPassword}
                          secureTextEntry={!showJoinPassword}
                          editable={!isLoading}
                          returnKeyType="next"
                        />
                        <TouchableOpacity onPress={() => setShowJoinPassword(!showJoinPassword)} style={{ padding: 4 }} disabled={isLoading}>
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={isDark ? DS.gray400 : DS.gray500} />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Confirm password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="Re-enter password"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={joinConfirmPassword}
                          onChangeText={setJoinConfirmPassword}
                          secureTextEntry={!showJoinConfirmPassword}
                          editable={!isLoading}
                          returnKeyType="done"
                          onSubmitEditing={handleJoinFamily}
                        />
                        <TouchableOpacity onPress={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)} style={{ padding: 4 }} disabled={isLoading}>
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={isDark ? DS.gray400 : DS.gray500} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.rowContainer}>
                        <TouchableOpacity style={styles.rememberMeContainer} onPress={handleToggleRememberMe} disabled={isLoading || !rememberMeLoaded} activeOpacity={0.7}>
                          <View style={[styles.checkbox, { borderColor: DS.primary }, rememberMe && { backgroundColor: DS.primary }]}>
                            {rememberMe && <Ionicons name="checkmark" size={12} color={DS.white} />}
                          </View>
                          <Text style={[styles.rememberMeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Remember me</Text>
                        </TouchableOpacity>
                      </View>

                      <PressableScale onPress={handleJoinFamily} disabled={isLoading} activeScale={0.97}>
                        <LinearGradient colors={[DS.success, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
                          {isLoading ? <ActivityIndicator color={DS.white} size="small" /> : (
                            <>
                              <Ionicons name="people-outline" size={18} color={DS.white} />
                              <Text style={styles.submitText}>Join Family</Text>
                            </>
                          )}
                        </LinearGradient>
                      </PressableScale>

                      <View style={styles.footerRow}>
                        <Text style={[styles.footerText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Don't have an invite code?</Text>
                        <TouchableOpacity onPress={handleGoToSignUp} disabled={isLoading}>
                          <Text style={[styles.footerLink, { color: DS.success }]}>Sign up instead</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {codeInfo?.isPartial && showPartialRecovery && (
                    <>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Full name</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="person-outline" size={18} color={DS.warning} style={styles.inputIcon} />
                        <TextInput style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]} placeholder="Full name" placeholderTextColor={isDark ? DS.gray600 : DS.gray400} value={joinFullName} onChangeText={setJoinFullName} autoCapitalize="words" editable={!isLoading} />
                      </View>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Email</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="mail-outline" size={18} color={DS.warning} style={styles.inputIcon} />
                        <TextInput style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]} placeholder="you@example.com" placeholderTextColor={isDark ? DS.gray600 : DS.gray400} value={joinEmail} onChangeText={setJoinEmail} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />
                      </View>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Phone (optional)</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="call-outline" size={18} color={DS.warning} style={styles.inputIcon} />
                        <TextInput style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]} placeholder="+1 (555) 000-0000" placeholderTextColor={isDark ? DS.gray600 : DS.gray400} value={joinPhone} onChangeText={setJoinPhone} keyboardType="phone-pad" editable={!isLoading} />
                      </View>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={18} color={DS.warning} style={styles.inputIcon} />
                        <TextInput style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]} placeholder="Min. 8 characters" placeholderTextColor={isDark ? DS.gray600 : DS.gray400} value={joinPassword} onChangeText={setJoinPassword} secureTextEntry={!showJoinPassword} editable={!isLoading} />
                        <TouchableOpacity onPress={() => setShowJoinPassword(!showJoinPassword)} style={{ padding: 4 }}>
                          <Ionicons name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={DS.warning} />
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Confirm password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={DS.warning} style={styles.inputIcon} />
                        <TextInput style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]} placeholder="Re-enter password" placeholderTextColor={isDark ? DS.gray600 : DS.gray400} value={joinConfirmPassword} onChangeText={setJoinConfirmPassword} secureTextEntry={!showJoinConfirmPassword} editable={!isLoading} onSubmitEditing={handlePartialSignupRecovery} />
                        <TouchableOpacity onPress={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)} style={{ padding: 4 }}>
                          <Ionicons name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={DS.warning} />
                        </TouchableOpacity>
                      </View>
                      <PressableScale onPress={handlePartialSignupRecovery} disabled={isLoading} activeScale={0.97} style={{ marginTop: DS.space.sm }}>
                        <LinearGradient colors={[DS.warning, '#d97706']} style={styles.submitBtn}>
                          {isLoading ? <ActivityIndicator color={DS.white} size="small" /> : (
                            <>
                              <Ionicons name="checkmark-circle" size={18} color={DS.white} />
                              <Text style={styles.submitText}>Complete Sign-up</Text>
                            </>
                          )}
                        </LinearGradient>
                      </PressableScale>
                      <View style={styles.footerRow}>
                        <Text style={[styles.footerText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Already have an account?</Text>
                        <TouchableOpacity onPress={() => { setActiveTab('signin'); setEmail(joinEmail); }} disabled={isLoading}>
                          <Text style={[styles.footerLink, { color: DS.warning }]}>Sign in</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {!codeValidated && inviteCode.length < 6 && (
                    <View style={styles.footerRow}>
                      <Text style={[styles.footerText, { color: isDark ? DS.gray400 : DS.gray500 }]}>Don't have an invite code?</Text>
                      <TouchableOpacity onPress={handleGoToSignUp} disabled={isLoading}>
                        <Text style={[styles.footerLink, { color: DS.success }]}>Sign up instead</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </BlurView>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

  logoSection: { alignItems: 'center', marginBottom: DS.space.lg },
  brandTitle: { fontSize: 30, fontWeight: '800', letterSpacing: 1, marginTop: DS.space.sm },
  brandTagline: { fontSize: 13, fontWeight: '500', marginTop: 4 },

  tabPill: { flexDirection: 'row', borderRadius: DS.radius.full, padding: 4, marginBottom: DS.space.lg, alignSelf: 'center', gap: 4 },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: DS.radius.full },
  tabText: { fontSize: 12, fontWeight: '600' },

  card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  glassCard: { borderRadius: DS.radius['2xl'], padding: DS.space.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', ...DS.shadow.lg },

  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: DS.space.lg },
  socialBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, ...DS.shadow.sm },
  socialIcon: { width: 26, height: 26 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: DS.space.lg },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  biometricSection: { marginBottom: DS.space.lg },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: DS.radius.md, borderWidth: 1 },
  biometricIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  biometricTitle: { fontSize: 14, fontWeight: '700' },
  biometricSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  fieldLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: DS.space.sm },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(102,126,234,0.08)', borderRadius: DS.radius.md, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: 'rgba(102,126,234,0.15)' },
  inputContainerDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  rowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: DS.space.md, marginBottom: DS.space.md },
  rememberMeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rememberMeText: { fontSize: 12, fontWeight: '500' },
  forgotText: { fontSize: 12, fontWeight: '700' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: DS.radius.md },
  submitText: { color: DS.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: DS.space.lg },
  footerText: { fontSize: 12, fontWeight: '500' },
  footerLink: { fontSize: 12, fontWeight: '700' },

  cardIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.sm },
  cardTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  cardDesc: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  joinHeader: { alignItems: 'center', marginBottom: DS.space.lg },
  qrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: DS.radius.md, borderWidth: 1, marginBottom: DS.space.lg },
  qrText: { fontSize: 13, fontWeight: '600' },

  partialBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: DS.radius.md, borderWidth: 1, marginBottom: DS.space.md },
  partialTitle: { fontSize: 12, fontWeight: '700' },
  partialSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  codeInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: DS.radius.sm, marginTop: DS.space.sm },
  codeInfoText: { fontSize: 12, fontWeight: '500', flex: 1 },
});