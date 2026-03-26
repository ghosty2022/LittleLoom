// src/screens/Parent2SetupScreen.tsx
import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Setup'>;

export default function Parent2SetupScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // FIXED: Use completeSetup and skipSetup from AuthContext
  const { completeSetup, skipSetup } = useAuth();
  const insets = useSafeAreaInsets();

  const handleAddParent = useCallback(async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Error', 'Please enter at least name and email');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      // Simulate API call to invite co-parent
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mark parent2 setup as complete - this persists across sign outs
      await completeSetup('parent2');

      Alert.alert(
        'Invitation Sent! 🎉',
        'Your co-parent will receive an invitation email to join LittleLoom.',
        [{ text: 'Continue', onPress: () => {} }]
      );
      // Navigation to BabyOptional is handled by AppNavigator state change
    } catch (error) {
      console.error('Error adding parent:', error);
      Alert.alert('Error', 'Failed to send invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fullName, email, completeSetup]);

  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Skip Adding Co-Parent?',
      'You can always add a co-parent later from settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        { 
          text: 'Skip', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Mark parent2 as skipped - this persists across sign outs
              await skipSetup('parent2');
              // Navigation to BabyOptional is handled by AppNavigator
            } catch (error) {
              console.error('Error skipping parent2:', error);
              Alert.alert('Error', 'Could not skip setup. Please try again.');
            }
          }
        },
      ]
    );
  }, [skipSetup]);

  return (
    <LinearGradient 
      colors={['#667eea', '#764ba2', '#f093fb']} 
      style={styles.container}
    >
      <StatusBar style="light" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInUp} style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Add Co-Parent</Text>
            <View style={styles.placeholder} />
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.formContainer}>
            <BlurView intensity={60} style={styles.glassCard}>
              <Text style={styles.formTitle}>Partner Details</Text>
              
              {/* Name Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(102,126,234,0.6)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="rgba(102,126,234,0.6)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (Optional)"
                  placeholderTextColor="rgba(102,126,234,0.6)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>

              {/* Info Text */}
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={18} color="#667eea" />
                <Text style={styles.infoText}>
                  An invitation will be sent to this email address
                </Text>
              </View>

              {/* Add Button */}
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddParent}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#667eea', '#764ba2']} 
                  style={styles.addGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#fff" />
                      <Text style={styles.addText}>Send Invitation</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Skip */}
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 44,
  },
  
  formContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  glassCard: {
    borderRadius: 24,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
    textAlign: 'center',
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
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#667eea',
  },
  
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  addText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '600',
  },
});