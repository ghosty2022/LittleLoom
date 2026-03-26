import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Import from contexts
import { useBaby } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

// Timeout wrapper for async operations
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

export default function BabyOptionalScreen({ navigation }: Props) {
  // Get baby methods from BabyContext
  const { 
    skipBaby, 
    babies, 
    currentBabyId, 
    switchBaby, 
    loadBabies,
    isLoading: babyLoading 
  } = useBaby();
  
  // Get setup tracking from AuthContext
  const { userProfile, skipSetup, completeSetup } = useAuth();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Failsafe: Clear loading after 8 seconds
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      if (localLoading) {
        console.log('BabyOptionalScreen: Force clearing loading state after timeout');
        setLocalLoading(false);
        setHasAttemptedLoad(true);
      }
    }, 8000);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Load babies when screen mounts
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (hasAttemptedLoad) return;
      
      try {
        setLocalLoading(true);
        setLoadError(null);
        
        await withTimeout(
          loadBabies(),
          6000,
          'Loading babies timed out'
        );
        
        if (isMounted) {
          setLocalLoading(false);
          setHasAttemptedLoad(true);
        }
      } catch (error) {
        console.error('BabyOptionalScreen: Error loading babies:', error);
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load babies');
          setLocalLoading(false);
          setHasAttemptedLoad(true);
        }
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [loadBabies, hasAttemptedLoad]);

  // FIXED: Handle skip with proper setup tracking
  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    try {
      // Mark baby setup as skipped in both contexts
      await skipBaby(); // BabyContext
      await skipSetup('baby'); // AuthContext - marks setup flow complete
      // Navigation to Main is handled by AppNavigator based on hasSkippedBaby state
    } catch (error) {
      console.error('Error skipping baby:', error);
      Alert.alert('Error', 'Could not skip baby setup. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [skipBaby, skipSetup]);

  // Navigate to create baby profile
  const handleCreateBaby = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  // FIXED: Handle baby selection with setup completion
  const handleSelectBaby = useCallback(async (babyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await switchBaby(babyId);
      // Mark baby setup as complete
      await completeSetup('baby'); // AuthContext - marks setup flow complete
      // Navigation to Main is handled by AppNavigator
    } catch (error) {
      console.error('Error switching baby:', error);
      Alert.alert('Error', 'Could not switch baby. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [switchBaby, completeSetup]);

  // Navigate to create another baby
  const handleAddAnotherBaby = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  // Retry loading babies
  const handleRetry = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHasAttemptedLoad(false);
    setLoadError(null);
    
    try {
      setLocalLoading(true);
      await withTimeout(loadBabies(), 6000, 'Loading timed out');
      setLocalLoading(false);
      setHasAttemptedLoad(true);
    } catch (error) {
      setLoadError('Still unable to load. Please try again.');
      setLocalLoading(false);
    }
  }, [loadBabies]);

  // Show loading state
  const showLoading = localLoading || babyLoading;
  
  // Show error state
  if (loadError && !showLoading) {
    return (
      <LinearGradient 
        colors={['#11998e', '#38ef7d', '#667eea']} 
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar style="light" />
        <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline" size={64} color="rgba(255,255,255,0.8)" />
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipErrorButton} onPress={handleSkip}>
              <Text style={styles.skipErrorText}>Continue Without Baby →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Show spinner while loading
  if (showLoading) {
    return (
      <LinearGradient 
        colors={['#11998e', '#38ef7d', '#667eea']} 
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar style="light" />
        <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading your babies...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Check if user has existing babies
  const hasExistingBabies = babies && babies.length > 0;

  return (
    <LinearGradient 
      colors={['#11998e', '#38ef7d', '#667eea']} 
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      
      <ScrollView 
        contentContainerStyle={[
          styles.content, 
          { 
            paddingTop: insets.top + 40, 
            paddingBottom: insets.bottom + 40,
            flexGrow: 1,
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp} style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>👶</Text>
          </View>
          <Text style={styles.title}>
            {hasExistingBabies ? 'Select Your Baby' : 'Add Your Baby?'}
          </Text>
          <Text style={styles.subtitle}>
            {hasExistingBabies 
              ? `Welcome back, ${userProfile?.fullName?.split(' ')[0] || 'Parent'}! Select a baby profile to continue`
              : 'Create a profile to start tracking milestones, activities, and precious moments'
            }
          </Text>
        </Animated.View>

        {/* Existing Babies List - ONLY SHOW IF HAS BABIES */}
        {hasExistingBabies && (
          <Animated.View entering={FadeInUp.delay(200)} style={styles.babiesContainer}>
            <Text style={styles.sectionTitle}>Your Babies</Text>
            {babies.map((baby, index) => (
              <AnimatedTouchableOpacity
                key={baby.id}
                entering={FadeInDown.delay(300 + index * 100)}
                style={[
                  styles.babyCard,
                  currentBabyId === baby.id && styles.babyCardActive
                ]}
                onPress={() => handleSelectBaby(baby.id)}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="light" />
                <LinearGradient
                  colors={currentBabyId === baby.id 
                    ? ['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)']
                    : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
                  }
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
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
                    <Text style={styles.babyName}>{baby.name}</Text>
                    <Text style={styles.babyAge}>{baby.age}</Text>
                    <View style={styles.babyMeta}>
                      <Text style={styles.babyGender}>
                        {baby.gender === 'girl' ? '👧 Girl' : baby.gender === 'boy' ? '👦 Boy' : '👶 Other'}
                      </Text>
                      <Text style={styles.dot}>•</Text>
                      <Text style={styles.babyStreak}>
                        <Ionicons name="flame" size={12} color="#fa709a" /> {baby.streak || 0} day streak
                      </Text>
                    </View>
                  </View>
                  
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={currentBabyId === baby.id ? '#667eea' : '#999'} 
                  />
                </View>
              </AnimatedTouchableOpacity>
            ))}

            {/* Add Another Baby Button */}
            <TouchableOpacity 
              style={styles.addAnotherButton}
              onPress={handleAddAnotherBaby}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <LinearGradient 
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} 
                style={styles.addAnotherGradient}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.addAnotherText}>Add Another Baby</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Preview Cards - Only show if no existing babies */}
        {!hasExistingBabies && (
          <Animated.View entering={FadeInUp.delay(200)} style={styles.previewContainer}>
            <BlurView intensity={60} style={styles.glassCard}>
              <View style={styles.featureRow}>
                <FeatureIcon icon="camera" color="#11998e" />
                <FeatureIcon icon="stats-chart" color="#667eea" />
                <FeatureIcon icon="calendar" color="#f093fb" />
                <FeatureIcon icon="heart" color="#f5576c" />
              </View>
              <Text style={styles.featuresText}>
                Photos • Growth Charts • Milestones • Memories
              </Text>
            </BlurView>
          </Animated.View>
        )}

        {/* Parents Info */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.parentsContainer}>
          <View style={styles.parentBadge}>
            <Ionicons name="person" size={16} color="#11998e" />
            <Text style={styles.parentText}>{userProfile?.fullName || 'Parent'}</Text>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeIn.delay(500)} style={styles.buttonsContainer}>
          {/* Only show Create button if NO existing babies */}
          {!hasExistingBabies && (
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleCreateBaby}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <LinearGradient 
                colors={['#fff', '#f8faff']} 
                style={styles.primaryGradient}
              >
                <Ionicons name="add-circle" size={24} color="#11998e" />
                <Text style={styles.primaryText}>Create Baby Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Skip button - always visible */}
          <TouchableOpacity 
            style={[styles.skipButton, hasExistingBabies && styles.skipButtonFull]}
            onPress={handleSkip}
            disabled={isProcessing}
          >
            <Text style={styles.skipText}>
              {hasExistingBabies ? "I'll decide later" : "I'll do this later"}
            </Text>
            <Text style={styles.skipSubtext}>
              {hasExistingBabies 
                ? "Continue without selecting a baby" 
                : "You can create a profile anytime from settings"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Note */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.noteContainer}>
          <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.noteText}>All data is securely encrypted</Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

function FeatureIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.featureIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  
  // Loading State
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
  },
  
  // Error State
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  errorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  retryText: {
    color: '#11998e',
    fontSize: 16,
    fontWeight: '700',
  },
  skipErrorButton: {
    padding: 12,
  },
  skipErrorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  icon: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },

  // Babies List Section
  babiesContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    marginLeft: 4,
  },
  babyCard: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  babyCardActive: {
    borderColor: '#667eea',
    borderWidth: 2,
  },
  babyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  babyAvatar: {
    fontSize: 48,
  },
  activeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  babyInfo: {
    flex: 1,
  },
  babyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  babyAge: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 4,
    fontWeight: '600',
  },
  babyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  babyGender: {
    fontSize: 13,
    color: '#666',
  },
  dot: {
    fontSize: 13,
    color: '#999',
  },
  babyStreak: {
    fontSize: 13,
    color: '#fa709a',
    fontWeight: '600',
  },
  addAnotherButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  addAnotherGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  addAnotherText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  previewContainer: {
    marginVertical: 20,
  },
  glassCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  
  parentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  parentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  parentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  buttonsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  primaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11998e',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  skipButtonFull: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  skipSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 20,
  },
  noteText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
});