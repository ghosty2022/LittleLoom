import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Import from contexts
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Optional'>;

const { width } = Dimensions.get('window');

export default function Parent2OptionalScreen({ navigation }: Props) {
  // Get setup tracking functions from AuthContext
  const { userProfile, skipSetup } = useAuth();
  const insets = useSafeAreaInsets();

  // FIXED: Mark Parent2 as skipped and navigate to BabyOptional
  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await skipSetup('parent2'); // Mark Parent2 setup as skipped
      // Navigation to BabyOptional is handled by AppNavigator based on state
    } catch (error) {
      console.error('Error skipping Parent2:', error);
      // Fallback navigation if state update fails
      navigation.replace('BabyOptional');
    }
  }, [navigation, skipSetup]);

  // Navigate to Parent2Setup to add co-parent
  const handleAddParent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Parent2Setup');
  }, [navigation]);

  return (
    <LinearGradient 
      colors={['#f093fb', '#f5576c', '#667eea']} 
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        {/* Header */}
        <Animated.View entering={FadeInUp} style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>👨‍👩‍👧</Text>
          </View>
          <Text style={styles.title}>Add Co-Parent?</Text>
          <Text style={styles.subtitle}>
            Invite your partner to share and track your baby's journey together
          </Text>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.benefitsContainer}>
          <BlurView intensity={60} style={styles.glassCard}>
            <BenefitItem icon="sync" text="Real-time sync of all activities" />
            <BenefitItem icon="notifications" text="Instant notifications for both parents" />
            <BenefitItem icon="calendar" text="Shared calendar and reminders" />
            <BenefitItem icon="analytics" text="Combined insights and analytics" />
          </BlurView>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleAddParent}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={['#fff', '#f8faff']} 
              style={styles.primaryGradient}
            >
              <Ionicons name="person-add" size={24} color="#f5576c" />
              <Text style={styles.primaryText}>Add Co-Parent</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipText}>Skip for Now</Text>
            <Text style={styles.skipSubtext}>You can add later in settings</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* User Info */}
        <Animated.View entering={FadeIn.delay(600)} style={styles.userInfo}>
          <Text style={styles.userText}>Signed in as {userProfile?.fullName}</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function BenefitItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon as any} size={20} color="#f5576c" />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  
  header: {
    alignItems: 'center',
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
  
  benefitsContainer: {
    marginVertical: 20,
  },
  glassCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,87,108,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  
  buttonsContainer: {
    gap: 16,
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
    color: '#f5576c',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
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
  
  userInfo: {
    alignItems: 'center',
  },
  userText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});