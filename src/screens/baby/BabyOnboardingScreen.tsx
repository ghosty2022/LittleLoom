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
import { 
  createBabyInDb, 
  setCurrentBabyInDb, 
  getAllBabiesFromDb, 
  getBabyByIdFromDb, 
  getAppSetting 
} from '../../database/dbHelpers';

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
  const [syncInProgress, setSyncInProgress] = useState(false);

  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationAttemptedRef = useRef(false);
  const loadAttemptedRef = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── SYNC BABIES FROM SUPABASE ──────────────────────────────────────
  const syncBabiesFromSupabase = useCallback(async (userId: string): Promise<boolean> => {
    if (syncInProgress) return false;
    setSyncInProgress(true);
    
    try {
      console.log('[BabyOnboarding] Syncing babies from Supabase for user:', userId);
      
      const { data: supabaseBabies, error } = await supabase
        .from('babies')
        .select('*')
        .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
        .eq('is_active', true);

      if (error) {
        console.error('[BabyOnboarding] Supabase query error:', error.message);
        setSyncInProgress(false);
        return false;
      }

      if (!supabaseBabies || supabaseBabies.length === 0) {
        console.log('[BabyOnboarding] No babies found in Supabase for user');
        setSyncInProgress(false);
        return false;
      }

      console.log(`[BabyOnboarding] Found ${supabaseBabies.length} babies in Supabase:`, 
        supabaseBabies.map(b => ({ id: b.id, name: b.name })));

      let syncedCount = 0;
      for (const baby of supabaseBabies) {
        try {
          const exists = await getBabyByIdFromDb(baby.id);
          if (!exists) {
            console.log(`[BabyOnboarding] Creating local baby: ${baby.name} (${baby.id})`);
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
            syncedCount++;
          } else {
            console.log(`[BabyOnboarding] Baby already exists locally: ${baby.name}`);
          }
        } catch (babyError) {
          console.error(`[BabyOnboarding] Error syncing baby ${baby.name}:`, babyError);
        }
      }

      console.log(`[BabyOnboarding] Synced ${syncedCount} new babies`);

      const currentId = await getAppSetting('current_baby_id');
      if (!currentId && supabaseBabies[0]) {
        await setCurrentBabyInDb(supabaseBabies[0].id);
        console.log(`[BabyOnboarding] Set current baby to: ${supabaseBabies[0].name}`);
      }

      setSyncInProgress(false);
      return syncedCount > 0 || supabaseBabies.length > 0;
    } catch (error) {
      console.error('[BabyOnboarding] Sync error:', error);
      setSyncInProgress(false);
      return false;
    }
  }, [syncInProgress]);

  // ─── CHECK AND SYNC BABIES ──────────────────────────────────────────
  const checkAndSyncBabies = useCallback(async () => {
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

      const localBabies = await getAllBabiesFromDb();
      console.log(`[BabyOnboarding] Local babies count: ${localBabies.length}`);

      if (localBabies && localBabies.length > 0) {
        setHasBabies(true);
        setRemoteBabies(localBabies);
        console.log(`[BabyOnboarding] Found ${localBabies.length} local babies`);
        return;
      }

      console.log('[BabyOnboarding] No local babies, syncing from Supabase...');
      const synced = await syncBabiesFromSupabase(userId);
      
      if (synced) {
        await loadBabies();
        const updatedLocalBabies = await getAllBabiesFromDb();
        if (updatedLocalBabies && updatedLocalBabies.length > 0) {
          setHasBabies(true);
          setRemoteBabies(updatedLocalBabies);
          console.log(`[BabyOnboarding] Synced ${updatedLocalBabies.length} babies`);
          await checkAndNavigate();
        }
      } else {
        try {
          const { data: remoteData } = await supabase
            .from('babies')
            .select('*')
            .or(`parent1_id.eq.${userId},parent2_id.eq.${userId}`)
            .eq('is_active', true);
          
          if (remoteData && remoteData.length > 0) {
            console.log(`[BabyOnboarding] Found ${remoteData.length} babies in Supabase, showing import option`);
            setRemoteBabies(remoteData);
            setShowImportOption(true);
          }
        } catch (e) {
          console.warn('[BabyOnboarding] Could not fetch remote babies for import:', e);
        }
      }
    } catch (error) {
      console.error('[BabyOnboarding] Check error:', error);
    }
  }, [userProfile, loadBabies, syncBabiesFromSupabase, checkAndNavigate]);

  // ─── CHECK NAVIGATION ─────────────────────────────────────────────
  const checkAndNavigate = useCallback(async () => {
    if (navigationAttemptedRef.current) return;
    if (!isMountedRef.current) return;
    
    try {
      const localBabies = await getAllBabiesFromDb();
      
      if (localBabies && localBabies.length > 0) {
        console.log('[BabyOnboarding] Found babies, checking setup');
        setHasBabies(true);
        
        const { setupComplete } = await wasSetupCompleted();
        
        if (setupComplete) {
          navigationAttemptedRef.current = true;
          console.log('[BabyOnboarding] Setup complete, navigating to Main');
          navigation.replace('Main');
          return true;
        }
        
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
  }, [navigation, wasSetupCompleted, completeSetup]);

  // ─── LOAD BABIES ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    loadAttemptedRef.current = false;
    navigationAttemptedRef.current = false;
    hasCheckedRef.current = false;
    
    const loadData = async () => {
      if (loadAttemptedRef.current) return;
      loadAttemptedRef.current = true;
      
      try {
        setLocalLoading(true);
        console.log('[BabyOnboarding] Starting load...');
        
        await loadBabies();
        console.log('[BabyOnboarding] loadBabies completed');
        
        if (!isMountedRef.current) return;
        
        const localBabies = await getAllBabiesFromDb();
        console.log(`[BabyOnboarding] Local babies after load: ${localBabies.length}`);
        
        if (localBabies && localBabies.length > 0) {
          setHasBabies(true);
          setLocalLoading(false);
          await checkAndNavigate();
          return;
        }
        
        console.log('[BabyOnboarding] No local babies, syncing from Supabase...');
        await checkAndSyncBabies();
        
        setLocalLoading(false);
        await checkAndNavigate();
        
      } catch (error) {
        console.error('[BabyOnboarding] Load error:', error);
        if (isMountedRef.current) {
          setLocalLoading(false);
          setLoadError('Failed to load babies');
        }
      }
    };
    
    const timer = setTimeout(loadData, 300);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    };
  }, [loadBabies, checkAndSyncBabies, checkAndNavigate]);

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
      const userId = userProfile?.id;
      if (userId) {
        const synced = await syncBabiesFromSupabase(userId);
        if (synced) {
          await loadBabies();
          const localBabies = await getAllBabiesFromDb();
          if (localBabies && localBabies.length > 0) {
            setHasBabies(true);
            setLocalLoading(false);
            await checkAndNavigate();
            return;
          }
        }
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
  }, [loadBabies, checkAndNavigate, userProfile, syncBabiesFromSupabase]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hasCheckedRef.current = false;
    navigationAttemptedRef.current = false;
    try {
      await loadBabies();
      await checkAndSyncBabies();
      if (babies.length > 0 || hasBabies) {
        await checkAndNavigate();
      }
    } catch (error) {
      console.warn('[BabyOnboarding] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, babies.length, hasBabies, checkAndNavigate, checkAndSyncBabies]);

  const showLoading = localLoading || babyLoading || syncInProgress;
  const hasExistingBabies = (babies && babies.length > 0) || hasBabies || remoteBabies.length > 0;

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
            <Text style={[styles.loadingText, isDark && styles.textDark]}>
              {syncInProgress ? 'Syncing your babies...' : 'Loading your babies...'}
            </Text>
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
  // Check if we have babies from either local or remote
  const displayBabies = babies.length > 0 ? babies : remoteBabies;
  const displayHasBabies = hasExistingBabies;

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
              {displayHasBabies ? 'Select Your Baby' : remoteBabies.length > 0 ? 'Import Your Baby?' : 'Add Your Baby?'}
            </Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              {displayHasBabies
                ? `Welcome back, ${userProfile?.fullName?.split(' ')[0] || 'Parent'}!`
                : remoteBabies.length > 0
                ? 'We found existing baby profiles linked to your account'
                : 'Create a profile to start tracking milestones and activities'}
            </Text>
          </Animated.View>

          {/* Remote Babies - Import Option */}
          {showImportOption && remoteBabies.length > 0 && !displayHasBabies && (
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

          {displayHasBabies && displayBabies.length > 0 && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.babiesContainer}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Your Babies</Text>
              {displayBabies.map((baby, index) => (
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
                      <Text style={[styles.babyAge, { color: themeColors.primary }]}>{baby.age || 'Newborn'}</Text>
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
            {!displayHasBabies && (
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
                displayHasBabies && { backgroundColor: themeColors.colors[0] }
              ]}
              onPress={handleSkip}
              disabled={isProcessing}
            >
              <Text style={[styles.skipText, isDark && styles.textDark]}>
                {displayHasBabies ? "I'll decide later" : "I'll do this later"}
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