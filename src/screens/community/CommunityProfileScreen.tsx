// ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================
interface UserProfile {
  id: string;
  displayName: string;
  handle: string;
  bio: string;
  avatar: string;
  coverPhoto: string;
  isVerified: boolean;
  role: 'parent' | 'verified' | 'contributor' | 'member';
  stats: {
    posts: number;
    followers: number;
    following: number;
    helpful: number;
    streakDays: number;
  };
}

// ============================================
// CONSTANTS
// ============================================
const COLORS = {
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  secondary: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  parent: { label: 'Parent', color: '#6366f1', icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#ec4899', icon: 'heart' },
  member: { label: 'Member', color: '#94a3b8', icon: 'person' },
};

const EMOJI_OPTIONS = ['👤', '👩', '👨', '👵', '👴', '👶', '👧', '👦', '🧑', '👮', '👩‍⚕️', '👨‍⚕️'];

// ============================================
// MAIN COMPONENT
// ============================================
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mock user data
  const [user, setUser] = useState<UserProfile>({
    id: '1',
    displayName: 'Alexander Ross',
    handle: '@alexander_ross',
    bio: 'Motion designer & creative storyteller. Passionate about animation and design.',
    avatar: '👨', // Emoji avatar
    coverPhoto: '',
    isVerified: true,
    role: 'verified',
    stats: {
      posts: 48,
      followers: 1247,
      following: 342,
      helpful: 89,
      streakDays: 12,
    },
  });

  const [formData, setFormData] = useState({
    displayName: user.displayName,
    bio: user.bio,
    avatar: user.avatar,
  });

  // Styles
  const styles = getStyles(isDark);

  // Handlers
  const handleSave = () => {
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate save
    setTimeout(() => {
      setUser({
        ...user,
        displayName: formData.displayName,
        bio: formData.bio,
        avatar: formData.avatar,
      });
      setIsEditing(false);
      setIsSaving(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // If editing, check if changes were made
      const hasChanges =
        formData.displayName !== user.displayName ||
        formData.bio !== user.bio ||
        formData.avatar !== user.avatar;

      if (hasChanges) {
        handleSave();
      } else {
        setIsEditing(false);
      }
    } else {
      setIsEditing(true);
      setFormData({
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
      });
    }
  };

  const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.member;

  // Check if avatar is emoji
  const isEmojiAvatar = (avatar: string): boolean => {
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]/u;
    return avatar.length <= 2 && emojiRegex.test(avatar);
  };

  const isEmoji = isEmojiAvatar(user.avatar);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Cover Photo */}
      <View style={styles.coverPhotoContainer}>
        {user.coverPhoto ? (
          <Image source={{ uri: user.coverPhoto }} style={styles.coverPhoto} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#6a82fb']}
            style={styles.coverPhoto}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
          style={styles.coverPhotoOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Edit/Save Button */}
        <TouchableOpacity
          style={[styles.editButton, isEditing && styles.editButtonActive]}
          onPress={handleEditToggle}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={isEditing ? 'checkmark' : 'create-outline'}
              size={20}
              color="#fff"
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Avatar Section */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.avatarSection}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => isEditing && setShowEmojiPicker(true)}
            style={styles.avatarWrapper}
            disabled={!isEditing}
          >
            {isEmoji ? (
              <View style={[styles.avatarImage, styles.avatarEmojiContainer]}>
                <Text style={styles.avatarEmojiText}>{user.avatar}</Text>
              </View>
            ) : user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Info */}
        <Animated.View
          entering={FadeInUp.delay(150).springify()}
          style={styles.profileInfo}
        >
          {/* Name Row */}
          <View style={styles.nameRow}>
            {isEditing ? (
              <TextInput
                style={[styles.nameInput, { color: isDark ? '#fff' : '#1e293b' }]}
                value={formData.displayName}
                onChangeText={(text) =>
                  setFormData(prev => ({ ...prev, displayName: text }))
                }
                placeholder="Your name"
                placeholderTextColor="#64748b"
                selectionColor={COLORS.primary}
              />
            ) : (
              <Text style={styles.profileName}>{user.displayName}</Text>
            )}
            {user.isVerified && !isEditing && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>

          {/* Handle and Role */}
          <View style={styles.metaRow}>
            <Text style={styles.profileMeta}>{user.handle}</Text>
            <View style={styles.metaDot} />
            <View style={[styles.roleBadge, { backgroundColor: `${roleConfig.color}20` }]}>
              <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
              <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                {roleConfig.label}
              </Text>
            </View>
          </View>

          {/* Bio */}
          {isEditing ? (
            <TextInput
              style={[styles.bioInput, { color: isDark ? '#e2e8f0' : '#475569' }]}
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              maxLength={160}
              selectionColor={COLORS.primary}
            />
          ) : (
            user.bio && <Text style={styles.profileBio}>{user.bio}</Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{user.stats.posts}</Text>
              <Text style={styles.statsLabel}>Posts</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{user.stats.followers}</Text>
              <Text style={styles.statsLabel}>Followers</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{user.stats.following}</Text>
              <Text style={styles.statsLabel}>Following</Text>
            </View>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInUp.delay(200).springify()}
          style={styles.actionButtons}
        >
          <TouchableOpacity style={styles.primaryButton}>
            <Ionicons name="chatbubble" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <Ionicons name="share-social" size={18} color={COLORS.primary} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.followButton]}
            onPress={handleEditToggle}
          >
            <Ionicons
              name={isEditing ? 'close' : 'person-add'}
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.secondaryButtonText}>
              {isEditing ? 'Cancel' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEmojiPicker(false)}
            activeOpacity={1}
          />
          <View style={styles.emojiPickerSheet}>
            <View style={styles.emojiPickerHeader}>
              <Text style={[styles.emojiPickerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                Choose an Emoji
              </Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================
const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f1a' : '#f8f9fc',
    },

    // Cover Photo
    coverPhotoContainer: {
      width: '100%',
      height: 200,
      position: 'relative',
      overflow: 'hidden',
    },
    coverPhoto: {
      width: '100%',
      height: '100%',
    },
    coverPhotoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 100,
    },

    // Back Button
    backButton: {
      position: 'absolute',
      top: 12,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },

    // Edit Button
    editButton: {
      position: 'absolute',
      top: 12,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    editButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    scrollView: {
      flex: 1,
      marginTop: -50,
    },
    scrollContent: {
      paddingBottom: 40,
    },

    // Avatar Section
    avatarSection: {
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    avatarWrapper: {
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 10,
    },
    avatarImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: '#fff',
    },
    avatarEmojiContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#6366f125',
    },
    avatarEmojiText: {
      fontSize: 44,
      lineHeight: 100,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    avatarPlaceholder: {
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 36,
      fontWeight: '800',
      color: '#fff',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },

    // Profile Info
    profileInfo: {
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    profileName: {
      fontSize: 24,
      fontWeight: '800',
      color: isDark ? '#fff' : '#1e293b',
      letterSpacing: -0.5,
    },
    nameInput: {
      fontSize: 24,
      fontWeight: '800',
      padding: 0,
      textAlign: 'center',
      minWidth: 100,
      letterSpacing: -0.5,
    },
    verifiedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    profileMeta: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#94a3b8' : '#64748b',
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: isDark ? '#475569' : '#cbd5e1',
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    roleBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    profileBio: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#475569',
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      lineHeight: 20,
    },
    bioInput: {
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      lineHeight: 20,
      width: '100%',
      minHeight: 48,
    },

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
      gap: 24,
    },
    statsItem: {
      alignItems: 'center',
    },
    statsValue: {
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? '#fff' : '#1e293b',
    },
    statsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#64748b',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    statsDivider: {
      width: 1,
      height: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },

    // Action Buttons
    actionButtons: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 20,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: COLORS.primary,
      paddingVertical: 12,
      borderRadius: 14,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.primary,
    },
    followButton: {
      flex: 0.6,
    },

    // Emoji Picker
    emojiPickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    emojiPickerSheet: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderRadius: 24,
      padding: 20,
      paddingBottom: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
    },
    emojiPickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    emojiPickerTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    emojiButton: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiButtonText: {
      fontSize: 28,
    },
  });