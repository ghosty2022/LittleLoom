import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { InlineSpinner } from '../../components/UniversalSpinner';


const LL = {
  primary: '#7c6cf1',
  primaryLight: '#a5b4fc',
  primaryDark: '#6b5ce7',
  primaryGhost: '#7c6cf118',
  accent: '#f472b6',
  accentSoft: '#fbcfe8',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#38bdf8',
  white: '#ffffff',
  gray50: '#f8f9ff',
  gray100: '#f0f2ff',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '600' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 16, line: 24, weight: '600' as const },
    xl: { size: 18, line: 26, weight: '700' as const },
    '2xl': { size: 22, line: 30, weight: '800' as const },
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const AVATARS = ['👤', '👩', '👨', '👧', '👦', '👶', '🤱', '👨‍🍼', '👩‍🍼', '🧑‍🍼', '👵', '👴', '🦸', '🦹', '🧙', '🧚'];

type Props = NativeStackScreenProps<CommunityStackParamList, 'EditCommunityProfile'>;

export default function EditCommunityFamilyCenterScreen
  ({ navigation }: Props) {
  const { currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, validateUsername } = useCommunity();
  const {
    communityProfile,
    updateCommunityProfile: updateUserContextProfile,
    checkUsernameAvailable,
    registerUsername,
    unregisterUsername,
    updateUsername,
  } = useUser();

  const { compressImage, cacheImage, isValidImageUri } = useMedia();
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

  const avatarSource = profileImage || selectedAvatar;

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
          const uri = result.assets[0].uri;
          const compressed = await compressImage(uri, 0.8);
          const cached = await cacheImage(compressed);
          setProfileImage(cached);
          setSelectedAvatar(cached);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          console.warn('Image processing failed:', err);
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
          setUsernameError('At least 3 characters');
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
      setUsernameError('Failed to validate');
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

      const updateData = {
        displayName: displayName.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim(),
        avatar: profileImage || selectedAvatar,
      };

      await updateUserContextProfile(updateData);
      await updateCommunityProfile(updateData);
      await syncUserProfileAcrossPosts(currentUser?.id || '', updateData);

      setIsSaving(false);
      sweetAlert.success('Profile Updated!', 'Your community profile has been saved.');
      navigation.goBack();
    } catch (error) {
      setIsSaving(false);
      console.error('Profile update error:', error);
      sweetAlert.error('Save Failed', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: LL.gray50 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: LL.white, borderBottomColor: LL.gray200 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.cancelText, { color: LL.gray500 }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: LL.gray900 }]}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, displayName.length > 0 && !isSaving && { backgroundColor: LL.primary }]}
          disabled={displayName.length === 0 || isSaving}
          onPress={handleSave}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={LL.white} />
          ) : (
            <Text style={[styles.saveBtnText, displayName.length > 0 && !isSaving && { color: LL.white }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {/* Avatar Upload */}
          <Animated.View entering={FadeInUp.duration(400)}>
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handleImagePick} style={styles.avatarUploadBtn}>
                <SafeAvatar
                  avatar={avatarSource}
                  size={100}
                  fallbackIcon="person"
                  fallbackColor={LL.primary}
                  fallbackBgColor={`${LL.primary}15`}
                  borderWidth={3}
                  borderColor={`${LL.primary}30`}
                />
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color={LL.white} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color={LL.white} />
                </View>
              </TouchableOpacity>
              <Text style={[styles.avatarHint, { color: LL.primary }]}>Tap to change photo</Text>
            </View>
          </Animated.View>

          {/* Avatar Selection */}
          <Animated.View entering={FadeInUp.delay(100)}>
            <Text style={[styles.sectionLabel, { color: LL.gray500 }]}>Or Choose Avatar</Text>
            <View style={styles.avatarsGrid}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar && !profileImage && styles.avatarOptionSelected,
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
          <Animated.View entering={FadeInUp.delay(200)}>
            <View style={[styles.formCard, { backgroundColor: LL.white, borderColor: LL.gray200 }]}>
              {/* Display Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: LL.gray500 }]}>Display Name</Text>
                <TextInput
                  style={[styles.textInput, { color: LL.gray800, borderColor: LL.gray200 }]}
                  placeholder="Your display name"
                  placeholderTextColor={LL.gray400}
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={30}
                />
                <Text style={[styles.charCount, { color: LL.gray400 }]}>{displayName.length}/30</Text>
              </View>

              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: LL.gray500 }]}>Username</Text>
                <View style={[styles.usernameWrap, { borderColor: LL.gray200 }]}>
                  <Text style={[styles.atSymbol, { color: LL.gray400 }]}>@</Text>
                  <TextInput
                    style={[styles.usernameInput, { color: LL.gray800 }]}
                    placeholder="username"
                    placeholderTextColor={LL.gray400}
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text.toLowerCase().replace(/\s+/g, '_'));
                      setUsernameError('');
                    }}
                    onBlur={() => validateUsernameAsync(username)}
                    autoCapitalize="none"
                    maxLength={30}
                  />
                  {isCheckingUsername && (
                    <ActivityIndicator size="small" color={LL.primary} />
                  )}
                </View>
                {usernameError ? (
                  <Text style={styles.errorText}>{usernameError}</Text>
                ) : (
                  <Text style={[styles.charCount, { color: LL.gray400 }]}>{username.length}/30</Text>
                )}
              </View>

              {/* Bio */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: LL.gray500 }]}>Bio</Text>
                <TextInput
                  style={[styles.bioInput, { color: LL.gray700, borderColor: LL.gray200 }]}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={LL.gray400}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  maxLength={160}
                />
                <Text style={[styles.charCount, { color: LL.gray400 }]}>{bio.length}/160</Text>
              </View>
            </View>
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.tipsCard}>
            <LinearGradient colors={[`${LL.primary}10`, `${LL.primary}05`]} style={styles.tipsGradient}>
              <Text style={[styles.tipsTitle, { color: LL.primary }]}>💡 Profile Tips</Text>
              <Text style={[styles.tipText, { color: LL.gray600 }]}>• Use a friendly display name parents can relate to</Text>
              <Text style={[styles.tipText, { color: LL.gray600 }]}>• Share your parenting journey in your bio</Text>
              <Text style={[styles.tipText, { color: LL.gray600 }]}>• Choose an avatar that represents you</Text>
              <Text style={[styles.tipText, { color: LL.gray600 }]}>• Be authentic and kind in the community</Text>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    paddingBottom: LL.space['4xl'],
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LL.space.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 12,
    paddingBottom: LL.space.md,
    borderBottomWidth: 1,
    zIndex: 100,
  },
  headerBtn: {
    paddingVertical: LL.space.sm,
    minWidth: 60,
  },
  cancelText: {
    fontSize: LL.text.base.size,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: LL.text.lg.size,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  saveBtn: {
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    borderRadius: LL.radius.full,
    backgroundColor: LL.gray100,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: LL.text.base.size,
    fontWeight: '700',
    color: LL.gray400,
  },

  avatarSection: {
    alignItems: 'center',
    marginTop: LL.space.xl,
    marginBottom: LL.space.lg,
  },
  avatarUploadBtn: {
    position: 'relative',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LL.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: LL.white,
    zIndex: 20,
  },
  avatarHint: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
    marginTop: LL.space.md,
  },

  sectionLabel: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: LL.space.lg,
    marginBottom: LL.space.md,
  },
  avatarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: LL.space.lg,
    gap: LL.space.md,
    marginBottom: LL.space.xl,
  },
  avatarOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LL.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: LL.primary,
    backgroundColor: `${LL.primary}15`,
  },
  avatarEmoji: { fontSize: 28 },

  formCard: {
    marginHorizontal: LL.space.lg,
    borderRadius: LL.radius['2xl'],
    borderWidth: 1,
    padding: LL.space.lg,
    ...LL.shadow.sm,
  },
  inputGroup: {
    marginBottom: LL.space.xl,
  },
  inputLabel: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: LL.space.sm,
  },
  textInput: {
    fontSize: LL.text.base.size,
    backgroundColor: LL.gray50,
    borderRadius: LL.radius.lg,
    padding: LL.space.lg,
    minHeight: 50,
    borderWidth: 1,
  },
  usernameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LL.gray50,
    borderRadius: LL.radius.lg,
    borderWidth: 1,
    paddingHorizontal: LL.space.lg,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: LL.space.xs,
  },
  usernameInput: {
    flex: 1,
    fontSize: LL.text.base.size,
    fontWeight: '600',
    paddingVertical: LL.space.md,
  },
  bioInput: {
    fontSize: LL.text.base.size,
    backgroundColor: LL.gray50,
    borderRadius: LL.radius.lg,
    padding: LL.space.lg,
    minHeight: 100,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: LL.text.xs.size,
    textAlign: 'right',
    marginTop: LL.space.xs,
    fontWeight: '500',
  },
  errorText: {
    fontSize: LL.text.sm.size,
    color: '#ef4444',
    marginTop: LL.space.xs,
    fontWeight: '600',
  },

  tipsCard: {
    marginHorizontal: LL.space.lg,
    marginTop: LL.space.xl,
    borderRadius: LL.radius['2xl'],
    overflow: 'hidden',
    ...LL.shadow.sm,
  },
  tipsGradient: {
    padding: LL.space.lg,
  },
  tipsTitle: {
    fontSize: LL.text.sm.size,
    fontWeight: '800',
    marginBottom: LL.space.md,
  },
  tipText: {
    fontSize: LL.text.sm.size,
    marginBottom: LL.space.sm,
    lineHeight: 20,
  },
});
