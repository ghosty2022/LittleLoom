import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useMedia } from '../../context/MediaContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { CommunityColors, CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

type EditCommunityProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'EditCommunityProfile'>;

const AVATARS = ['👤', '👩', '👨', '👧', '👦', '👶', '🤱', '👨‍🍼', '👩‍🍼', '🧑‍🍼', '👵', '👴'];

export default function EditCommunityProfileScreen({ navigation, route }: EditCommunityProfileScreenProps) {
  const { userId } = route.params || {};
  const { currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, validateUsername } = useCommunity();
  const { 
    communityProfile, 
    updateCommunityProfile: updateUserContextProfile,
    checkUsernameAvailable,
    registerUsername,
    unregisterUsername,
    updateUsername,
  } = useUser();

  // MediaContext for proper image handling
  const { compressImage, cacheImage, isValidImageUri } = useMedia();
  // SweetAlert for all alerts
  const sweetAlert = useSweetAlert();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.handle?.replace('@', '') || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || '👤');
  const [profileImage, setProfileImage] = useState<string | null>(
    currentUser?.avatar?.startsWith('file://') || currentUser?.avatar?.startsWith('http') 
      ? currentUser.avatar 
      : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Please allow access to your photo library.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        
        try {
          // Process image: compress and cache to fix file:// issues
          const uri = result.assets[0].uri;
          const compressed = await compressImage(uri, 0.8);
          const cached = await cacheImage(compressed);
          
          setProfileImage(cached);
          setSelectedAvatar(cached);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          console.warn('Image processing failed:', err);
          // Fallback to raw URI
          if (isValidImageUri(result.assets[0].uri)) {
            setProfileImage(result.assets[0].uri);
            setSelectedAvatar(result.assets[0].uri);
          }
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      setIsUploadingImage(false);
      console.error('Image upload error:', error);
      sweetAlert.error('Upload Failed', 'Failed to upload image. Please try again.');
    }
  };

  const validateUsernameAsync = useCallback(async (value: string): Promise<boolean> => {
    if (!value.trim()) {
      setUsernameError('Username is required');
      return false;
    }

    setIsCheckingUsername(true);
    
    try {
      let result;
      if (validateUsername) {
        result = await validateUsername(value, currentUser?.id);
      } else if (checkUsernameAvailable) {
        result = await checkUsernameAvailable(value, currentUser?.id);
      } else {
        const trimmed = value.trim().toLowerCase().replace(/^@/, '');
        if (trimmed.length < 3) {
          setUsernameError('Username must be at least 3 characters');
          return false;
        }
        result = { available: true, message: '' };
      }
      
      setIsCheckingUsername(false);

      if (!result.available) {
        setUsernameError(result.message);
        return false;
      }

      setUsernameError('');
      return true;
    } catch (error) {
      setIsCheckingUsername(false);
      console.error('Username validation error:', error);
      setUsernameError('Failed to validate username');
      return false;
    }
  }, [validateUsername, checkUsernameAvailable, currentUser?.id]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      sweetAlert.error('Missing Name', 'Display name is required');
      return;
    }

    const isUsernameValid = await validateUsernameAsync(username);
    if (!isUsernameValid) {
      sweetAlert.error('Invalid Username', usernameError || 'Please check your username');
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const handle = username.startsWith('@') ? username : `@${username}`;
      const oldHandle = currentUser?.handle;

      if (oldHandle && oldHandle !== handle && updateUsername) {
        const result = await updateUsername(oldHandle, handle, currentUser?.id || '');
        if (!result.success) {
          throw new Error(result.message);
        }
      } else if (oldHandle && oldHandle !== handle) {
        await unregisterUsername(oldHandle);
        await registerUsername(handle, currentUser?.id || '');
      }

      await updateUserContextProfile({
        displayName: displayName.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim(),
        avatar: profileImage || selectedAvatar,
      });

      await updateCommunityProfile({
        displayName: displayName.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim(),
        avatar: profileImage || selectedAvatar,
      });

      await syncUserProfileAcrossPosts(currentUser?.id || '', {
        displayName: displayName.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim(),
        avatar: profileImage || selectedAvatar,
      });

      setIsSaving(false);
      sweetAlert.success('Profile Updated!', 'Your community profile has been saved.');
      navigation.goBack();
    } catch (error) {
      setIsSaving(false);
      console.error('Profile update error:', error);
      sweetAlert.error('Save Failed', 'Failed to update profile. Please try again.');
    }
  };

  // Determine avatar source for SafeAvatar
  const avatarSource = profileImage || selectedAvatar;

  return (
    <View style={[styles.container]}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />

      {/* Image Processing Spinner */}
      <CommunitySpinner
        visible={isUploadingImage}
        text="Processing image..."
        size="medium"
        overlay={true}
        blur={true}
        variant="nebula"
      />

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
            style={[styles.saveButton, displayName.length > 0 && !isSaving && styles.saveButtonActive]}
            disabled={displayName.length === 0 || isSaving}
            onPress={handleSave}
          >
            {isSaving ? (
              <InlineSpinner size={16} color="#fff" section="community" variant="liquid" />
            ) : (
              <Text style={[styles.saveButtonText, displayName.length > 0 && !isSaving && styles.saveButtonTextActive]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <AutoHideScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Profile Image Upload - with SafeAvatar */}
          <Animated.View entering={FadeInUp}>
            <View style={styles.imageUploadContainer}>
              <TouchableOpacity style={styles.imageUploadButton} onPress={handleImagePick}>
                {/* REPLACED: Raw Image/Text → SafeAvatar */}
                <SafeAvatar
                  avatar={avatarSource}
                  size={100}
                  fallbackIcon="person"
                  fallbackColor={CommunityColors.primary}
                  borderWidth={3}
                  borderColor={CommunityColors.primary + '30'}
                  showEditBadge={true}
                  animated={true}
                />
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <InlineSpinner size={24} color="#fff" section="community" variant="liquid" />
                  </View>
                )}
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              <Text style={styles.imageUploadText}>Tap to change photo</Text>
            </View>
          </Animated.View>

          {/* Avatar Selection */}
          <Animated.View entering={FadeInUp.delay(50)}>
            <Text style={styles.sectionLabel}>Or Choose Avatar</Text>
            <View style={styles.avatarsContainer}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar && !profileImage && styles.avatarOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedAvatar(avatar);
                    setProfileImage(null);
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
                  placeholderTextColor={CommunityColors.text.tertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={30}
                />
                <Text style={styles.characterCount}>{displayName.length}/30</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.usernameInputContainer}>
                  <Text style={styles.atSymbol}>@</Text>
                  <TextInput
                    style={[styles.textInput, styles.usernameInput]}
                    placeholder="username"
                    placeholderTextColor={CommunityColors.text.tertiary}
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text.toLowerCase().replace(/\\s+/g, '_'));
                      setUsernameError('');
                    }}
                    onBlur={() => validateUsernameAsync(username)}
                    autoCapitalize="none"
                    maxLength={30}
                  />
                  {isCheckingUsername && (
                    <InlineSpinner size={16} color={CommunityColors.primary} section="community" variant="liquid" />
                  )}
                </View>
                {usernameError ? (
                  <Text style={styles.errorText}>{usernameError}</Text>
                ) : (
                  <Text style={styles.characterCount}>{username.length}/30</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.textInput, styles.bioInput]}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={CommunityColors.text.tertiary}
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
            <LinearGradient 
              colors={[CommunityColors.secondary + '15', CommunityColors.secondary + '05']}
              style={styles.tipsGradient}
            >
              <Text style={styles.tipsTitle}>💡 Profile Tips</Text>
              <Text style={styles.tipText}>• Use a friendly display name</Text>
              <Text style={styles.tipText}>• Share your parenting journey in your bio</Text>
              <Text style={styles.tipText}>• Choose an avatar that represents you</Text>
              <Text style={styles.tipText}>• Be authentic and kind</Text>
            </LinearGradient>
          </Animated.View>
        </AutoHideScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cancelText: { fontSize: 16, color: CommunityColors.text.secondary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: CommunityColors.text.primary },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CommunityColors.primary + '20',
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonActive: { 
    backgroundColor: CommunityColors.primary,
    ...CommunityShadows.md,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: CommunityColors.text.tertiary },
  saveButtonTextActive: { color: 'white' },

  imageUploadContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageUploadButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: CommunityColors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    zIndex: 20,
  },
  imageUploadText: {
    fontSize: 14,
    color: CommunityColors.primary,
    fontWeight: '600',
    marginTop: 12,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginLeft: CommunitySpacing.lg,
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
    backgroundColor: CommunityColors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...CommunityShadows.sm,
  },
  avatarOptionSelected: {
    borderColor: CommunityColors.primary,
    backgroundColor: CommunityColors.primary + '20',
  },
  avatarEmoji: { fontSize: 32 },
  formContainer: {
    margin: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.xl,
    padding: 20,
    overflow: 'hidden',
    ...CommunityShadows.md,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 12,
    padding: 16,
    minHeight: 50,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  atSymbol: {
    fontSize: 18,
    color: CommunityColors.text.tertiary,
    paddingLeft: 16,
    fontWeight: '600',
  },
  usernameInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  errorText: {
    fontSize: 13,
    color: CommunityColors.error,
    marginTop: 4,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    textAlign: 'right',
    marginTop: 4,
  },
  tipsContainer: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 24,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.sm,
  },
  tipsGradient: {
    padding: 20,
  },
  tipsTitle: { fontSize: 14, fontWeight: '800', color: CommunityColors.secondary, marginBottom: 12 },
  tipText: { fontSize: 13, color: CommunityColors.text.secondary, marginBottom: 6 },
});