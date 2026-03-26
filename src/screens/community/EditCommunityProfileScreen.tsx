// src/screens/community/EditCommunityProfileScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { showSuccessModal, showErrorModal } from '../../utils/modal';

type EditCommunityProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'EditCommunityProfile'>;

const AVATARS = ['👤', '👩', '👨', '👧', '👦', '👶', '🤱', '👨‍🍼', '👩‍🍼', '🧑‍🍼', '👵', '👴'];

export default function EditCommunityProfileScreen({ navigation, route }: EditCommunityProfileScreenProps) {
  const { userId } = route.params || {};
  const { currentUser, updateCommunityProfile, updateUserBio, updateUserLocation } = useCommunity();
  
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || '👤');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      showErrorModal({ message: 'Display name is required' });
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      await updateCommunityProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: selectedAvatar,
      });
      
      if (bio.trim()) {
        await updateUserBio(bio.trim());
      }
      
      setIsSaving(false);
      showSuccessModal({ message: 'Profile updated successfully!' });
      navigation.goBack();
    } catch (error) {
      setIsSaving(false);
      showErrorModal({ message: 'Failed to update profile. Please try again.' });
    }
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity 
            style={[styles.saveButton, displayName.length > 0 && styles.saveButtonActive]}
            disabled={displayName.length === 0 || isSaving}
            onPress={handleSave}
          >
            <Text style={[styles.saveButtonText, displayName.length > 0 && styles.saveButtonTextActive]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Avatar Selection */}
          <Animated.View entering={FadeInUp}>
            <Text style={styles.sectionLabel}>Choose Avatar</Text>
            <View style={styles.avatarsContainer}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar && styles.avatarOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedAvatar(avatar);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.avatarEmoji}>{avatar}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(100)}>
            <BlurView intensity={80} style={styles.formContainer} tint="light">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your display name"
                  placeholderTextColor="#999"
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={30}
                />
                <Text style={styles.characterCount}>{displayName.length}/30</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.textInput, styles.bioInput]}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#999"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  maxLength={160}
                />
                <Text style={styles.characterCount}>{bio.length}/160</Text>
              </View>
            </BlurView>
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Profile Tips</Text>
            <Text style={styles.tipText}>• Use a friendly display name</Text>
            <Text style={styles.tipText}>• Share your parenting journey in your bio</Text>
            <Text style={styles.tipText}>• Choose an avatar that represents you</Text>
            <Text style={styles.tipText}>• Be authentic and kind</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  saveButtonActive: { backgroundColor: '#667eea' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#999' },
  saveButtonTextActive: { color: 'white' },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  avatarOption: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  avatarEmoji: { fontSize: 32 },
  formContainer: {
    margin: 24,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 16,
    minHeight: 50,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  tipsContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 20,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#667eea', marginBottom: 12 },
  tipText: { fontSize: 13, color: '#666', marginBottom: 6 },
});