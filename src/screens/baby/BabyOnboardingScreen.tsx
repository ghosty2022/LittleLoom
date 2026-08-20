import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { supabase } from '@/utils/supabase';
import { createBabyInDb, setCurrentBabyInDb, getAllBabiesFromDb } from '../../database/dbHelpers';

const { width } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

export default function BabyOnboardingScreen({ navigation }: Props) {
  const {
    babies, currentBabyId, switchBaby, loadBabies, isLoading: babyLoading
  } = useBaby();
  const { userProfile, skipSetup, completeSetup, wasSetupCompleted } = useAuth();
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const { toast, error: showError, success: showSuccess, info: showInfo } = useSweetAlert();

  const [isProcessing, setIsProcessing] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remoteBabies, setRemoteBabies] = useState<any[]>([]);
  const [showImportOption, setShowImportOption] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBabies, setHasBabies] = useState(false);

  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationAttemptedRef = useRef(false);
  const loadAttemptedRef = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── CHECK REMOTE BABIES ──────────────────────────────────────────
  const checkRemoteBabies = useCallback(async () => {
    if (hasCheckedRef.current) {
      console.log('[BabyOnboarding] Already checked, skipping');
      return;
    }
    hasCheckedRef.current = true;

    try {
      let userId: string | null = null;
      
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch (e) {}
      
      if (!userId) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user?.id) userId = data.session.user.id;
        } catch (e) {}
      }
      
      if (!userId && userProfile?.id) {
        userId = userProfile.id;
      }

      if (!userId) {
        console.log('[BabyOnboarding] No user found');
        return;
      }

      console.log('[BabyOnboarding] Checking for babies with userId:', userId);

      const { data: remoteData, error } = await supabase
        .from('babies')
        .select('*')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
        .eq('is_active', true);

      if (error) {
        console.warn('[BabyOnboarding] Query error:', error.message);
        return;
      }

      if (remoteData && remoteData.length > 0 && isMountedRef.current) {
        const localBabyIds = new Set(babies.map(b => b.id));
        const newRemoteBabies = remoteData.filter(b => !localBabyIds.has(b.id));
        
        if (newRemoteBabies.length > 0) {
          setRemoteBabies(newRemoteBabies);
          setShowImportOption(true);
        }
      }
    } catch (error) {
      console.warn('[BabyOnboarding] Error checking remote babies:', error);
    }
  }, [babies, userProfile]);

  // ─── CHECK NAVIGATION ─────────────────────────────────────────────
  const checkAndNavigate = useCallback(async () => {
    if (navigationAttemptedRef.current) return;
    if (!isMountedRef.current) return;
    
    try {
      // First try to get babies from Supabase directly
      let localBabies = await getAllBabiesFromDb();
      let hasBabies = localBabies && localBabies.length > 0;
      
      // If no local babies, try to sync from Supabase
      if (!hasBabies) {
        try {
          console.log('[BabyOnboarding] No local babies, checking Supabase...');
          const userId = userProfile?.id || (await supabase.auth.getUser()).data?.user?.id;
          if (userId) {
            const { data: supabaseBabies, error } = await supabase
              .from('babies')
              .select('*')
              .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
              .eq('is_active', true);
            
            if (!error && supabaseBabies && supabaseBabies.length > 0) {
              console.log(`[BabyOnboarding] Found ${supabaseBabies.length} babies in Supabase`);
              // Sync them to local DB
              const { createBabyInDb, setCurrentBabyInDb } = await import('../../database/dbHelpers');
              for (const baby of supabaseBabies) {
                await createBabyInDb({
                  id: baby.id,
                  name: baby.name,
                  avatar: baby.avatar || undefined,
                  dateOfBirth: baby.date_of_birth,
                  gender: baby.gender || undefined,
                  bloodType: baby.blood_type || undefined,
                  medicalNotes: baby.medical_notes || undefined,
                  parent1Id: baby.parent1_id || undefined,
                  parent2Id: baby.parent2_id || undefined,
                });
              }
              // Set first baby as current
              await setCurrentBabyInDb(supabaseBabies[0].id);
              // Reload babies
              localBabies = await getAllBabiesFromDb();
              hasBabies = localBabies && localBabies.length > 0;
            }
          }
        } catch (syncError) {
          console.warn('[BabyOnboarding] Failed to sync from Supabase:', syncError);
        }
      }
      
      if (hasBabies) {
        console.log('[BabyOnboarding] Found babies, checking setup');
        setHasBabies(true);
        
        const { setupComplete } = await wasSetupCompleted();
        
        if (setupComplete) {
          navigationAttemptedRef.current = true;
          console.log('[BabyOnboarding] Setup complete, navigating to Main');
          navigation.replace('Main');
          return true;
        }
        
        // If we have babies but setup not complete, mark baby as complete
        await completeSetup('baby');
        const { setupComplete: newSetupComplete } = await wasSetupCompleted();
        if (newSetupComplete) {
          navigationAttemptedRef.current = true;
          console.log('[BabyOnboarding] Marked baby complete, navigating to Main');
          navigation.replace('Main');
          return true;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('[BabyOnboarding] Check navigate error:', error);
      return false;
    }
  }, [completeSetup, navigation, wasSetupCompleted, userProfile]);

  // ─── LOAD BABIES ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    loadAttemptedRef.current = false;
    navigationAttemptedRef.current = false;
    
    const loadData = async () => {
      if (loadAttemptedRef.current) return;
      loadAttemptedRef.current = true;
      
      try {
        setLocalLoading(true);
        console.log('[BabyOnboarding] Starting loadBabies...');
        
        // Force load with timeout
        const loadPromise = loadBabies();
        const timeoutPromise = new Promise((_, reject) => {
          loadTimeoutRef.current = setTimeout(() => {
            reject(new Error('Load babies timeout'));
          }, 8000);
        });
        
        await Promise.race([loadPromise, timeoutPromise]);
        
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        
        console.log('[BabyOnboarding] loadBabies completed');
        
        if (!isMountedRef.current) return;
        
        setLocalLoading(false);
        
        // Check local DB directly as fallback
        const localBabies = await getAllBabiesFromDb();
        if (localBabies && localBabies.length > 0) {
          setHasBabies(true);
        }
        
        // Try to navigate
        const navigated = await checkAndNavigate();
        if (navigated) return;
        
        // Check remote babies after a delay
        if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            checkRemoteBabies();
          }
        }, 500);
        
      } catch (error) {
        console.error('[BabyOnboarding] Load error:', error);
        if (isMountedRef.current) {
          setLocalLoading(false);
          // Check if we have babies in DB directly
          try {
            const localBabies = await getAllBabiesFromDb();
            if (localBabies && localBabies.length > 0) {
              setHasBabies(true);
              // Try to navigate even if loadBabies failed
              await checkAndNavigate();
              return;
            }
          } catch (e) {}
          setLoadError('Failed to load babies');
        }
      }
    };
    
    loadData();
    
    return () => {
      isMountedRef.current = false;
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [loadBabies, checkRemoteBabies, checkAndNavigate]);

  // ─── HANDLERS ──────────────────────────────────────────────────────
  const handleImportBaby = useCallback(async (baby: any) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    
    try {
      await createBabyInDb({
        id: baby.id,
        name: baby.name,
        avatar: baby.avatar || undefined,
        dateOfBirth: baby.date_of_birth,
        gender: baby.gender || undefined,
        bloodType: baby.blood_type || undefined,
        medicalNotes: baby.medical_notes || undefined,
        parent1Id: baby.parent1_id || undefined,
        parent2Id: baby.parent2_id || undefined,
      });

      await setCurrentBabyInDb(baby.id);
      await loadBabies();
      await switchBaby(baby.id);
      await completeSetup('baby');

      const { hasParent2 } = await wasSetupCompleted();
      
      if (hasParent2 === false) {
        showInfo('Next Step', 'Invite a co-parent to join the family');
        navigation.replace('CoParentInviteScreen');
      } else {
        await completeSetup('parent2');
        showSuccess('Welcome Back!', `Imported ${baby.name}'s profile`);
        navigation.replace('Main');
      }
    } catch (error) {
      console.error('Import baby error:', error);
      showError('Error', 'Could not import baby profile');
    } finally {
      setIsProcessing(false);
    }
  }, [loadBabies, switchBaby, completeSetup, wasSetupCompleted, showError, showSuccess, showInfo, triggerHaptic, navigation]);

  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await skipSetup('baby');
      
      const { hasParent2 } = await wasSetupCompleted();
      
      if (hasParent2 === false) {
        showInfo('Next Step', 'Let\'s set up family sharing');
        navigation.replace('CoParentInviteScreen');
      } else {
        showInfo('Skipped', 'You can add a baby later from settings');
        const { setupComplete } = await wasSetupCompleted();
        if (setupComplete) {
          navigation.replace('Main');
        }
      }
    } catch (error) {
      console.error('handleSkip error:', error);
      showError('Error', 'Could not skip baby setup');
    } finally {
      setIsProcessing(false);
    }
  }, [skipSetup, wasSetupCompleted, showError, showInfo, triggerHaptic, navigation]);

  const handleCreateBaby = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('CreateBabyProfile');
  }, [navigation, triggerHaptic]);

  const handleSelectBaby = useCallback(async (babyId: string) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      await switchBaby(babyId);
      await completeSetup('baby');
      
      const { hasParent2 } = await wasSetupCompleted();
      
      if (hasParent2 === false) {
        showInfo('Next Step', 'Invite a co-parent to join the family');
        navigation.replace('CoParentInviteScreen');
      } else if (hasParent2 === 'skipped' || hasParent2 === true) {
        await completeSetup('parent2');
        showSuccess('Welcome Back!', 'Baby profile selected');
        navigation.replace('Main');
      } else {
        showSuccess('Welcome Back!', 'Baby profile selected');
        navigation.replace('Main');
      }
    } catch (error) {
      console.error('handleSelectBaby error:', error);
      showError('Error', 'Could not switch baby');
    } finally {
      setIsProcessing(false);
    }
  }, [switchBaby, completeSetup, wasSetupCompleted, showError, showSuccess, showInfo, triggerHaptic, navigation]);

  const handleRetry = useCallback(async () => {
    setLoadError(null);
    setLocalLoading(true);
    hasCheckedRef.current = false;
    loadAttemptedRef.current = false;
    navigationAttemptedRef.current = false;
    
    try {
      // Try direct DB check first
      const localBabies = await getAllBabiesFromDb();
      if (localBabies && localBabies.length > 0) {
        setHasBabies(true);
        setLocalLoading(false);
        await checkAndNavigate();
        return;
      }
      
      await loadBabies();
      if (isMountedRef.current) {
        setLocalLoading(false);
        await checkAndNavigate();
      }
    } catch (error) {
      if (isMountedRef.current) {
        setLoadError('Still unable to load');
        setLocalLoading(false);
      }
    }
  }, [loadBabies, checkAndNavigate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hasCheckedRef.current = false;
    navigationAttemptedRef.current = false;
    try {
      await loadBabies();
      if (babies.length > 0) {
        await checkAndNavigate();
      }
    } catch (error) {
      console.warn('[BabyOnboarding] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, babies.length, checkAndNavigate]);

  const showLoading = localLoading || babyLoading;
  const hasExistingBabies = (babies && babies.length > 0) || hasBabies;

  // ─── ERROR STATE ──────────────────────────────────────────────────
  if (loadError && !showLoading) {
    return (
      <View style={[styles.container]}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="cloud-offline" size={64} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text style={[styles.errorTitle, isDark && styles.textDark]}>Oops!</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={[styles.skipErrorText, { color: themeColors.primary }]}>Continue Without Baby →</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ─── LOADING STATE ─────────────────────────────────────────────────
  if (showLoading) {
    return (
      <View style={[styles.container]}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading your babies...</Text>
            <TouchableOpacity 
              style={[styles.cancelLoadingButton, { marginTop: 20 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.cancelLoadingText, { color: themeColors.primary }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ─── MAIN CONTENT ──────────────────────────────────────────────────
  return (
    <View style={[styles.container]}>
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <Animated.ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.primary]} />
          }
        >
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
            <View style={[styles.iconContainer, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.icon}>👶</Text>
            </View>
            <Text style={[styles.title, isDark && styles.textDark]}>
              {hasExistingBabies ? 'Select Your Baby' : remoteBabies.length > 0 ? 'Import Your Baby?' : 'Add Your Baby?'}
            </Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              {hasExistingBabies
                ? `Welcome back, ${userProfile?.fullName?.split(' ')[0] || 'Parent'}!`
                : remoteBabies.length > 0
                ? 'We found existing baby profiles linked to your account'
                : 'Create a profile to start tracking milestones and activities'}
            </Text>
          </Animated.View>

          {/* Remote Babies - Import Option */}
          {showImportOption && remoteBabies.length > 0 && !hasExistingBabies && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.importContainer}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
                Import Existing Profile{remoteBabies.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.importSubtitle, isDark && { color: '#94a3b8' }]}>
                We found {remoteBabies.length} baby profile{remoteBabies.length > 1 ? 's' : ''} linked to your account
              </Text>
              {remoteBabies.map((baby, index) => (
                <AnimatedTouchableOpacity
                  key={baby.id}
                  entering={shouldReduceMotion ? undefined : FadeInDown.delay(200 + index * 100)}
                  style={[styles.babyCard, styles.importCard]}
                  onPress={() => handleImportBaby(baby)}
                  disabled={isProcessing}
                >
                  <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                  <LinearGradient
                    colors={isDark ? ['rgba(40,40,50,0.9)', 'rgba(30,30,40,0.7)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.babyCardContent}>
                    <SafeBabyAvatar
                      avatar={baby.avatar}
                      gender={baby.gender === 'male' ? 'boy' : baby.gender === 'female' ? 'girl' : 'other'}
                      size={64}
                      animated={!shouldReduceMotion}
                    />
                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={[styles.babyAge, { color: themeColors.primary }]}>
                        {baby.date_of_birth ? new Date(baby.date_of_birth).toLocaleDateString() : 'No DOB'}
                      </Text>
                    </View>
                    <View style={styles.importBadge}>
                      <Ionicons name="download-outline" size={20} color={themeColors.primary} />
                      <Text style={[styles.importBadgeText, { color: themeColors.primary }]}>Import</Text>
                    </View>
                    {isProcessing && (
                      <ActivityIndicator size="small" color={themeColors.primary} style={styles.smallSpinner} />
                    )}
                  </View>
                </AnimatedTouchableOpacity>
              ))}
            </Animated.View>
          )}

          {hasExistingBabies && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.babiesContainer}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Your Babies</Text>
              {babies.map((baby, index) => (
                <AnimatedTouchableOpacity
                  key={baby.id}
                  entering={shouldReduceMotion ? undefined : FadeInDown.delay(300 + index * 100)}
                  style={[
                    styles.babyCard,
                    currentBabyId === baby.id && { borderColor: themeColors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => handleSelectBaby(baby.id)}
                  disabled={isProcessing}
                >
                  <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                  <LinearGradient
                    colors={currentBabyId === baby.id
                      ? [themeColors.colors[0], themeColors.colors[1]]
                      : isDark ? ['rgba(40,40,50,0.9)', 'rgba(30,30,40,0.7)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.babyCardContent}>
                    <SafeBabyAvatar
                      avatar={baby.avatar}
                      gender={baby.gender}
                      size={64}
                      animated={!shouldReduceMotion}
                    />
                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={[styles.babyAge, { color: themeColors.primary }]}>{baby.age}</Text>
                    </View>
                    {currentBabyId === baby.id && (
                      <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={themeColors.primary} />
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={24} color={isDark ? '#94a3b8' : '#999'} />
                  </View>
                </AnimatedTouchableOpacity>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(400)} style={styles.buttonsContainer}>
            {!hasExistingBabies && (
              <>
                <TouchableOpacity style={styles.primaryButton} onPress={handleCreateBaby} activeOpacity={0.8}>
                  <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.primaryGradient}>
                    <Ionicons name="add-circle" size={24} color="white" />
                    <Text style={styles.primaryText}>Create Baby Profile</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                {remoteBabies.length === 0 && (
                  <Text style={[styles.orText, isDark && { color: '#94a3b8' }]}>or</Text>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.skipButton,
                hasExistingBabies && { backgroundColor: themeColors.colors[0] }
              ]}
              onPress={handleSkip}
              disabled={isProcessing}
            >
              <Text style={[styles.skipText, isDark && styles.textDark]}>
                {hasExistingBabies ? "I'll decide later" : "I'll do this later"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    color: '#64748b',
  },
  textDark: {
    color: '#fff',
  },
  babiesContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e293b',
  },
  babyCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  babyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  babyInfo: {
    flex: 1,
    marginLeft: 16,
  },
  babyName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1e293b',
  },
  babyAge: {
    fontSize: 14,
  },
  activeBadge: {
    marginRight: 8,
  },
  buttonsContainer: {
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: '#1e293b',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipErrorText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  cancelLoadingButton: {
    padding: 12,
  },
  cancelLoadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  importContainer: {
    marginBottom: 24,
  },
  importSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    color: '#64748b',
  },
  importCard: {
    borderColor: '#10b981',
    borderWidth: 1,
  },
  importBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  importBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 8,
  },
  smallSpinner: {
    marginLeft: 8,
  },
});