import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

// Import from correct contexts
import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type CreateBabyProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateBabyProfile'>;

const { width } = Dimensions.get('window');

const SKIN_TONES = [
  { id: 0, emoji: '👶', color: '#F5D0C5', label: 'Light' },
  { id: 1, emoji: '👶🏻', color: '#F5D0C5', label: 'Fair' },
  { id: 2, emoji: '👶🏼', color: '#E8C4A0', label: 'Medium' },
  { id: 3, emoji: '👶🏽', color: '#D4A373', label: 'Tan' },
  { id: 4, emoji: '👶🏾', color: '#A67C52', label: 'Brown' },
  { id: 5, emoji: '👶🏿', color: '#6B4423', label: 'Dark' },
];

const AVATAR_OPTIONS = ['👶', '🍼', '🧸', '🎀', '👼', '🤱', '👨‍🍼', '👩‍🍼', '🐣', '🌟'];

export default function CreateBabyProfileScreen({ navigation }: CreateBabyProfileScreenProps) {
  const insets = useSafeAreaInsets();
  
  // Get user from AuthContext, baby methods from BabyContext
  // FIXED: Added completeSetup from AuthContext
  const { userProfile, completeSetup } = useAuth();
  const { createBaby } = useBaby();
  
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('boy');
  const [skinTone, setSkinTone] = useState(0);
  const [avatar, setAvatar] = useState('👶');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const calculateAge = useCallback((date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days old`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} old`;
    } else {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      return months > 0 ? `${years}y ${months}m old` : `${years} years old`;
    }
  }, []);

  const onDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const validateStep1 = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your baby\'s name');
      return false;
    }
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters');
      return false;
    }
    return true;
  }, [name]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  }, [currentStep, validateStep1]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  // FIXED: Added completeSetup call after successful baby creation
  const handleCreateProfile = useCallback(async () => {
    if (!validateStep1()) return;
    
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await createBaby({
        name: name.trim(),
        birthDate: birthDate.toISOString(),
        gender,
        skinTone,
        avatar: typeof avatar === 'string' ? avatar : '👶',
        weight: weight.trim() || undefined,
        height: height.trim() || undefined,
        bloodType: bloodType.trim() || undefined,
        allergies: allergies.trim() ? allergies.split(',').map(a => a.trim()) : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
      });

      if (success) {
        // ADDED: Mark baby setup as complete in AuthContext
        // This tells AppNavigator that setup flow is done
        await completeSetup('baby');
        
        Alert.alert(
          'Welcome! 🎉',
          `${name}'s profile has been created successfully.`,
          [
            { 
              text: 'Go to Home', 
              onPress: () => navigation.replace('Main')
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [name, birthDate, gender, skinTone, avatar, weight, height, bloodType, allergies, medicalNotes, createBaby, completeSetup, navigation, validateStep1]);

  const renderStep1 = () => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.stepContainer}>
      {/* Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Baby's Name *</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter baby's name"
            placeholderTextColor="#999"
            autoFocus
            maxLength={50}
          />
        </View>
      </View>

      {/* Birth Date */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Birth Date *</Text>
        <TouchableOpacity 
          style={styles.dateButton} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#667eea" />
          <Text style={styles.dateText}>
            {birthDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <Text style={styles.agePreview}>{calculateAge(birthDate)}</Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(2020, 0, 1)}
          />
        )}
      </View>

      {/* Gender Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderContainer}>
          {(['boy', 'girl', 'other'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && styles.genderButtonActive
              ]}
              onPress={() => {
                setGender(g);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.genderEmoji}>
                {g === 'boy' ? '👦' : g === 'girl' ? '👧' : '👶'}
              </Text>
              <Text style={[
                styles.genderText,
                gender === g && styles.genderTextActive
              ]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Skin Tone */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Skin Tone</Text>
        <View style={styles.skinToneContainer}>
          {SKIN_TONES.map((tone) => (
            <TouchableOpacity
              key={tone.id}
              style={[
                styles.skinToneButton,
                skinTone === tone.id && styles.skinToneButtonActive
              ]}
              onPress={() => {
                setSkinTone(tone.id);
                setAvatar(tone.emoji);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.skinToneEmoji}>{tone.emoji}</Text>
              {skinTone === tone.id && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={16} color="#667eea" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Avatar Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Avatar</Text>
        <TouchableOpacity style={styles.avatarSelector} onPress={() => setShowAvatarPicker(true)}>
          <Text style={styles.selectedAvatar}>{avatar}</Text>
          <Text style={styles.changeAvatarText}>Tap to change</Text>
        </TouchableOpacity>
        
        {showAvatarPicker && (
          <Animated.View entering={FadeIn} style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.avatarOption,
                  avatar === emoji && styles.avatarOptionActive
                ]}
                onPress={() => {
                  setAvatar(emoji);
                  setShowAvatarPicker(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.avatarOption} onPress={pickImage}>
              <Ionicons name="camera-outline" size={24} color="#667eea" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.stepContainer}>
      <Text style={styles.sectionSubtitle}>Optional Health Information</Text>
      
      {/* Weight */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Birth Weight (kg)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="scale-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g., 3.5"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Height */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Birth Height (cm)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="resize-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            placeholder="e.g., 50"
            placeholderTextColor="#999"
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Blood Type */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Blood Type</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="water-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={bloodType}
            onChangeText={setBloodType}
            placeholder="e.g., A+"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={3}
          />
        </View>
      </View>

      {/* Allergies */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Allergies (comma separated)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="warning-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g., peanuts, dairy"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Medical Notes */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Medical Notes</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
            placeholder="Any important medical information..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient colors={['#f0f4ff', '#e0e7ff', '#d1d5ff']} style={styles.gradient}>
        <StatusBar style="dark" />
        
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent, 
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInUp} style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <BlurView intensity={80} style={styles.backBlur}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
              </BlurView>
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Text style={styles.title}>Create Profile</Text>
              <Text style={styles.subtitle}>Step {currentStep} of 2</Text>
            </View>
            
            <View style={styles.placeholder} />
          </Animated.View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: currentStep === 1 ? '50%' : '100%' }]} />
          </View>

          {/* Profile Preview Card */}
          <Animated.View entering={FadeInUp.delay(50)}>
            <BlurView intensity={90} style={styles.previewCard}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.previewAvatar}
              >
                <Text style={styles.previewAvatarText}>{avatar}</Text>
              </LinearGradient>
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{name || 'Baby Name'}</Text>
                <Text style={styles.previewDetails}>
                  {calculateAge(birthDate)} • {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </Text>
                {userProfile && (
                  <Text style={styles.previewParent}>
                    Parent: {userProfile.fullName}
                  </Text>
                )}
              </View>
            </BlurView>
          </Animated.View>

          {/* Form Steps */}
          {currentStep === 1 ? renderStep1() : renderStep2()}

          {/* Spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Bottom Buttons */}
        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
          <BlurView intensity={90} style={styles.bottomBlur}>
            {currentStep === 1 ? (
              <TouchableOpacity 
                style={styles.nextButton} 
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Next Step</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={styles.backStepButton} 
                  onPress={() => setCurrentStep(1)}
                  disabled={isLoading}
                >
                  <Text style={styles.backStepText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.createButton, isLoading && styles.buttonDisabled]} 
                  onPress={handleCreateProfile}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.buttonGradient}
                  >
                    {isLoading ? (
                      <Text style={styles.buttonText}>Creating...</Text>
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Create Profile</Text>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </BlurView>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  placeholder: { width: 48 },
  
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(102,126,234,0.2)',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  previewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewAvatarText: { fontSize: 40 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  previewDetails: { fontSize: 14, color: '#666', marginBottom: 2 },
  previewParent: { fontSize: 12, color: '#999' },
  
  stepContainer: { gap: 20 },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 8,
  },
  
  inputGroup: { marginBottom: 4 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  textAreaWrapper: { height: 120, alignItems: 'flex-start', paddingTop: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  dateText: { flex: 1, fontSize: 16, color: '#1a1a1a', fontWeight: '600' },
  agePreview: { fontSize: 14, color: '#667eea', fontWeight: '700' },
  
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderColor: '#667eea',
  },
  genderEmoji: { fontSize: 32, marginBottom: 8 },
  genderText: { fontSize: 14, color: '#666', fontWeight: '600' },
  genderTextActive: { color: '#667eea', fontWeight: '700' },
  
  skinToneContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  skinToneButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  skinToneButtonActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  skinToneEmoji: { fontSize: 32 },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  
  avatarSelector: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  selectedAvatar: { fontSize: 64, marginBottom: 8 },
  changeAvatarText: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionActive: { borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)' },
  avatarOptionEmoji: { fontSize: 32 },
  
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  bottomBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
  },
  nextButton: { borderRadius: 16, overflow: 'hidden' },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  backStepButton: {
    flex: 1,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  backStepText: { color: '#667eea', fontSize: 16, fontWeight: '700' },
  createButton: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
});