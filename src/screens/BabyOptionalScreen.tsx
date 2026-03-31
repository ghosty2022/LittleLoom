import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBaby } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

// Reusable SweetAlert component
const SweetAlert = ({ visible, type, title, message, onClose, isDark }: any) => {
  const [opacity, setOpacity] = useState(0);
  
  useEffect(() => {
    if (visible) {
      setOpacity(1);
      const timer = setTimeout(() => {
        setOpacity(0);
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  }[type as keyof typeof config] || config.success;

  return (
    <View style={[styles.alertWrapper, { opacity }]}>
      <View style={[styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </View>
    </View>
  );
};

export default function BabyOptionalScreen({ navigation }: Props) {
  const { 
    skipBaby, babies, currentBabyId, switchBaby, loadBabies, isLoading: babyLoading 
  } = useBaby();
  const { userProfile, skipSetup, completeSetup } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      if (localLoading) {
        setLocalLoading(false);
      }
    }, 8000);
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLocalLoading(true);
        await loadBabies();
        if (isMounted) setLocalLoading(false);
      } catch (error) {
        if (isMounted) {
          setLoadError('Failed to load babies');
          setLocalLoading(false);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [loadBabies]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  // CRITICAL FIX: Handle skip baby - mark setup complete and go to Main
  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    try {
      await skipBaby();
      await skipSetup('baby');
      showToast('info', 'Skipped', 'You can add a baby later from settings');
      setTimeout(() => navigation.replace('Main'), 1000);
    } catch (error) {
      showToast('error', 'Error', 'Could not skip baby setup');
      setIsProcessing(false);
    }
  }, [skipBaby, skipSetup, navigation, showToast]);

  // CRITICAL FIX: Navigate to create baby profile
  const handleCreateBaby = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  // CRITICAL FIX: Select existing baby and complete setup
  const handleSelectBaby = useCallback(async (babyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await switchBaby(babyId);
      await completeSetup('baby');
      showToast('success', 'Welcome Back!', 'Baby profile selected');
      setTimeout(() => navigation.replace('Main'), 500);
    } catch (error) {
      showToast('error', 'Error', 'Could not switch baby');
      setIsProcessing(false);
    }
  }, [switchBaby, completeSetup, navigation, showToast]);

  const handleRetry = useCallback(async () => {
    setLoadError(null);
    setLocalLoading(true);
    try {
      await loadBabies();
      setLocalLoading(false);
    } catch (error) {
      setLoadError('Still unable to load');
      setLocalLoading(false);
    }
  }, [loadBabies]);

  const showLoading = localLoading || babyLoading;
  const hasExistingBabies = babies && babies.length > 0;

  if (loadError && !showLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="cloud-offline" size={64} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text style={[styles.errorTitle, isDark && styles.textDark]}>Oops!</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipErrorText}>Continue Without Baby →</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (showLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading your babies...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        <ScrollView 
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp} style={styles.header}>
            <View style={[styles.iconContainer, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.icon}>👶</Text>
            </View>
            <Text style={[styles.title, isDark && styles.textDark]}>
              {hasExistingBabies ? 'Select Your Baby' : 'Add Your Baby?'}
            </Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              {hasExistingBabies 
                ? `Welcome back, ${userProfile?.fullName?.split(' ')[0] || 'Parent'}!`
                : 'Create a profile to start tracking milestones and activities'}
            </Text>
          </Animated.View>

          {hasExistingBabies && (
            <Animated.View entering={FadeInUp.delay(200)} style={styles.babiesContainer}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Your Babies</Text>
              {babies.map((baby, index) => (
                <AnimatedTouchableOpacity
                  key={baby.id}
                  entering={FadeInDown.delay(300 + index * 100)}
                  style={[styles.babyCard, currentBabyId === baby.id && styles.babyCardActive]}
                  onPress={() => handleSelectBaby(baby.id)}
                  disabled={isProcessing}
                >
                  <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                  <LinearGradient
                    colors={currentBabyId === baby.id 
                      ? ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)']
                      : isDark ? ['rgba(40,40,50,0.9)', 'rgba(30,30,40,0.7)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />
                  
                  <View style={styles.babyCardContent}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.babyAvatar}>{baby.avatar || '👶'}</Text>
                      {currentBabyId === baby.id && (
                        <View style={styles.activeBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#667eea" />
                        </View>
                      )}
                    </View>
                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={styles.babyAge}>{baby.age}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={isDark ? '#94a3b8' : '#999'} />
                  </View>
                </AnimatedTouchableOpacity>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.delay(400)} style={styles.buttonsContainer}>
            {!hasExistingBabies && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateBaby} activeOpacity={0.8}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.primaryGradient}>
                  <Ionicons name="add-circle" size={24} color="white" />
                  <Text style={styles.primaryText}>Create Baby Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.skipButton, hasExistingBabies && styles.skipButtonFull]} onPress={handleSkip} disabled={isProcessing}>
              <Text style={[styles.skipText, isDark && styles.textDark]}>
                {hasExistingBabies ? "I'll decide later" : "I'll do this later"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
      
      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { paddingHorizontal: 24 },
  textDark: { color: '#fff' },
  
  alertWrapper: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  alertContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, minWidth: 300, maxWidth: 360, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  header: { alignItems: 'center', marginBottom: 32 },
  iconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 2, borderColor: 'rgba(102,126,234,0.3)' },
  icon: { fontSize: 60 },
  title: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  
  babiesContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16, marginLeft: 4 },
  babyCard: { borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(102,126,234,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  babyCardActive: { borderColor: '#667eea', borderWidth: 2 },
  babyCardContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatarContainer: { position: 'relative', marginRight: 16 },
  babyAvatar: { fontSize: 48 },
  activeBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#fff', borderRadius: 10 },
  babyInfo: { flex: 1 },
  babyName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  babyAge: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  
  buttonsContainer: { gap: 16, marginBottom: 24 },
  primaryButton: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  primaryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  primaryText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  skipButton: { alignItems: 'center', paddingVertical: 16, backgroundColor: 'rgba(102,126,234,0.1)', borderRadius: 16 },
  skipButtonFull: { backgroundColor: 'rgba(102,126,234,0.15)' },
  skipText: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  
  errorTitle: { color: '#1a1a1a', fontSize: 28, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  errorText: { color: '#64748b', fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryButton: { backgroundColor: '#667eea', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, marginBottom: 12 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipErrorText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
  loadingText: { color: '#1a1a1a', fontSize: 18, fontWeight: '600', marginTop: 20 },
});