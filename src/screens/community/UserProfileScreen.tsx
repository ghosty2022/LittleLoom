
// src/screens/community/UserProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Image,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Post, CommunityUser, Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showSuccessModal, showErrorModal } from '../../utils/modal';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type UserProfileScreenProps = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;

const { width } = Dimensions.get('window');

const BADGES = [
  { emoji: '🏆', name: 'Top Contributor', color: CommunityColors.accent, description: '100+ helpful posts' },
  { emoji: '💙', name: 'Helpful Parent', color: CommunityColors.primary, description: '50+ likes received' },
  { emoji: '🔥', name: '30 Day Streak', color: CommunityColors.error, description: 'Active for 30 days' },
  { emoji: '⭐', name: 'Rising Star', color: CommunityColors.info, description: 'Gained 1000 followers' },
  { emoji: '📝', name: 'Storyteller', color: CommunityColors.secondary, description: '50+ posts shared' },
];

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

// Validate unique username
const validateUsername = (username: string): { valid: boolean; message: string } => {
  const trimmed = username.trim();
  if (!trimmed) return { valid: false, message: 'Username is required' };
  if (trimmed.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
  if (trimmed.length > 30) return { valid: false, message: 'Username must be less than 30 characters' };
  
  const validPattern = /^[a-zA-Z@][a-zA-Z0-9_.]*$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, message: 'Username can only contain letters, numbers, underscores, and dots. Must start with a letter.' };
  }
  
  if (/[_.]{2,}/.test(trimmed)) {
    return { valid: false, message: 'Username cannot contain consecutive special characters' };
  }
  
  if (/[_.]$/.test(trimmed)) {
    return { valid: false, message: 'Username cannot end with a special character' };
  }
  
  return { valid: true, message: '' };
};

// Helper to check if avatar is an image URL
const isImageAvatar = (avatar: string): boolean => {
  if (!avatar) return false;
  return avatar.startsWith('file://') || avatar.startsWith('http') || avatar.startsWith('data:image');
};

export default function UserProfileScreen({ navigation, route }: UserProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'media'>('posts');
  const [showImageModal, setShowImageModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const { userId } = route.params;
  const { 
    currentUser, 
    getUserById, 
    getUserPosts, 
    followUser, 
    unfollowUser, 
    isFollowing,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    updateCommunityProfile,
    blockUser,
    isUserBlocked,
    topics,
    updateSelectedTopics,
    getSelectedTopics,
    getFollowers,
    getFollowing,
    getAllUsers,
  } = useCommunity();
  const { profile: currentUserProfile } = useUser();

  const isOwnProfile = userId === currentUser?.id;
  const selectedTopics = isOwnProfile ? getSelectedTopics() : (profile?.selectedTopics || []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const user = getUserById(userId);
      const posts = getUserPosts(userId);
      
      if (user) {
        setProfile(user);
        setUserPosts(posts);
      } else {
        const fallbackProfile: CommunityUser = {
          id: userId,
          displayName: 'Unknown User',
          handle: '@unknown_user',
          avatar: '👤',
          isVerified: false,
          bio: 'This user profile is unavailable.',
          country: 'Unknown',
          onlineStatus: 'offline',
          lastActive: new Date().toISOString(),
          stats: { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
          achievements: [],
          selectedTopics: [],
        };
        setProfile(fallbackProfile);
        setUserPosts([]);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showErrorModal({ message: 'Failed to load profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [userId, getUserById, getUserPosts]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProfile();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isFollowing(profile.id)) {
        await unfollowUser(profile.id);
      } else {
        await followUser(profile.id);
      }
      await loadProfile();
    } catch (error) {
      console.error('Follow error:', error);
      showErrorModal({ message: 'Failed to update follow status. Please try again.' });
    }
  };

  const handleMessage = () => {
    if (!profile) return;
    if (isUserBlocked(profile.id)) {
      showErrorModal({ message: 'You have blocked this user. Unblock them to send messages.' });
      return;
    }
    navigation.navigate('Chat', { userId: profile.id });
  };

  const handleReport = () => {
    if (!profile) return;
    navigation.navigate('Report', { 
      type: 'user', 
      targetId: userId, 
      targetUserId: userId 
    });
  };

  const handleEditProfile = () => {
    navigation.navigate('EditCommunityProfile', { userId });
  };

  const handlePostLike = async (post: Post) => {
    try {
      if (post.isLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
      await loadProfile();
    } catch (error) {
      console.error('Post like error:', error);
    }
  };

  const handlePostRepost = async (post: Post) => {
    try {
      if (post.isReposted) {
        await unrepostPost(post.id);
      } else {
        await repostPost(post.id);
      }
      await loadProfile();
    } catch (error) {
      console.error('Post repost error:', error);
    }
  };

  const navigateToPostDetail = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const navigateToFollowers = () => {
    if (!profile) return;
    navigation.navigate('Followers', { userId });
  };

  const navigateToFollowing = () => {
    if (!profile) return;
    navigation.navigate('Following', { userId });
  };

  // FIXED: Image picker with proper permissions and upload
  const handleImagePick = async () => {
    if (!isOwnProfile) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile picture.');
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
        
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const imageUri = result.assets[0].uri;
        
        // Update community profile with new avatar
        await updateCommunityProfile({
          avatar: imageUri,
        });
        
        setIsUploadingImage(false);
        showSuccessModal({ message: 'Profile picture updated!' });
        await loadProfile();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      setIsUploadingImage(false);
      console.error('Image upload error:', error);
      showErrorModal({ message: 'Failed to upload image. Please try again.' });
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out ${profile.displayName}'s profile on LittleLoom! ${profile.handle}`,
        title: `${profile.displayName} on LittleLoom`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleBlockUser = () => {
    if (!profile || isOwnProfile) return;
    const isBlocked = isUserBlocked(profile.id);
    
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      isBlocked 
        ? `Unblock ${profile.displayName}? You'll be able to see their content again.`
        : `Block ${profile.displayName}? You won't see their content and they can't message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(profile.id);
              showSuccessModal({ 
                message: isBlocked ? 'User unblocked' : 'User blocked successfully' 
              });
              await loadProfile();
            } catch (error) {
              showErrorModal({ message: 'Failed to block user' });
            }
          }
        },
      ]
    );
  };

  const handleMoreMenuAction = (action: string) => {
    setShowMoreMenu(false);
    
    setTimeout(() => {
      switch (action) {
        case 'share':
          handleShareProfile();
          break;
        case 'report':
          handleReport();
          break;
        case 'block':
          handleBlockUser();
          break;
        case 'message':
          handleMessage();
          break;
        case 'topics':
          if (isOwnProfile) {
            setShowTopicModal(true);
          }
          break;
        case 'edit':
          if (isOwnProfile) {
            handleEditProfile();
          }
          break;
        default:
          break;
      }
    }, 300);
  };

  // Topic management - FIXED: Max 5 topics enforcement
  const handleToggleTopic = async (topicId: string) => {
    if (!isOwnProfile) return;
    
    const currentTopics = getSelectedTopics();
    let newTopics: string[];
    
    if (currentTopics.includes(topicId)) {
      newTopics = currentTopics.filter(id => id !== topicId);
    } else {
      if (currentTopics.length >= 5) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showErrorModal({ message: 'You can select up to 5 topics. Remove one to add another.' });
        return;
      }
      newTopics = [...currentTopics, topicId];
    }
    
    await updateSelectedTopics(newTopics);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Username edit
  const handleUsernameSave = async () => {
    const validation = validateUsername(usernameInput);
    if (!validation.valid) {
      setUsernameError(validation.message);
      return;
    }
    
    await updateCommunityProfile({ handle: usernameInput.toLowerCase() });
    setShowEditUsername(false);
    setUsernameError('');
    showSuccessModal({ message: 'Username updated!' });
    await loadProfile();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.darkBg]}>
        <ActivityIndicator size="large" color={CommunityColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.darkBg]}>
        <Text style={[styles.errorText, isDark && styles.textLight]}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const followingStatus = isFollowing(profile.id);
  const blocked = isUserBlocked(profile.id);

  // Render avatar component
  const renderAvatar = (avatar: string, size: number, style?: any) => {
    if (isImageAvatar(avatar)) {
      return (
        <Image 
          source={{ uri: avatar }} 
          style={[{ width: size, height: size, borderRadius: size / 2 }, style]} 
          resizeMode="cover"
        />
      );
    }
    return <Text style={[{ fontSize: size * 0.6, textAlign: 'center', lineHeight: size }, style]}>{avatar}</Text>;
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Animated Header */}
      <Animated.View style={[styles.floatingHeader, headerAnimatedStyle]}>
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.headerBlur}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMoreMenu(true);
            }} 
            style={styles.headerButton}
          >
            <Ionicons 
              name="ellipsis-horizontal" 
              size={24} 
              color={isDark ? '#fff' : CommunityColors.text.primary} 
            />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={[styles.moreMenu, isDark && styles.moreMenuDark]}>
            <TouchableOpacity style={styles.moreMenuItem} onPress={() => handleMoreMenuAction('share')}>
              <Ionicons name="share-outline" size={22} color={CommunityColors.primary} />
              <Text style={styles.moreMenuText}>Share Profile</Text>
            </TouchableOpacity>
            
            {!isOwnProfile && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={() => handleMoreMenuAction('message')}>
                <Ionicons name="mail-outline" size={22} color={CommunityColors.primary} />
                <Text style={styles.moreMenuText}>Send Message</Text>
              </TouchableOpacity>
            )}
            
            {isOwnProfile && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={() => handleMoreMenuAction('topics')}>
                <Ionicons name="grid-outline" size={22} color={CommunityColors.primary} />
                <Text style={styles.moreMenuText}>Manage Topics</Text>
              </TouchableOpacity>
            )}
            
            {isOwnProfile && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={() => handleMoreMenuAction('edit')}>
                <Ionicons name="create-outline" size={22} color={CommunityColors.primary} />
                <Text style={styles.moreMenuText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
            
            {!isOwnProfile && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={() => handleMoreMenuAction('block')}>
                <Ionicons name={blocked ? "checkmark-circle" : "ban"} size={22} color={blocked ? CommunityColors.success : CommunityColors.error} />
                <Text style={[styles.moreMenuText, blocked && { color: CommunityColors.success }]}>
                  {blocked ? 'Unblock User' : 'Block User'}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[styles.moreMenuItem, styles.moreMenuItemLast]} onPress={() => handleMoreMenuAction('report')}>
              <Ionicons name="flag-outline" size={22} color={CommunityColors.error} />
              <Text style={[styles.moreMenuText, { color: CommunityColors.error }]}>Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Topic Management Modal - FIXED: Max 5 topics */}
      <Modal
        visible={showTopicModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.topicModalOverlay}>
          <View style={[styles.topicModalContent, isDark && styles.darkCard]}>
            <View style={styles.topicModalHeader}>
              <View>
                <Text style={[styles.topicModalTitle, isDark && styles.textLight]}>Your Topics</Text>
                <Text style={styles.topicModalSubtitle}>
                  Select up to 5 topics ({selectedTopics.length}/5)
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.topicModalClose} 
                onPress={() => setShowTopicModal(false)}
              >
                <Ionicons name="close" size={24} color={CommunityColors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.topicsGrid}>
                {topics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.topicSelectCard,
                      selectedTopics.includes(topic.id) && styles.topicSelectCardActive,
                      selectedTopics.length >= 5 && !selectedTopics.includes(topic.id) && styles.topicSelectCardDisabled,
                    ]}
                    onPress={() => handleToggleTopic(topic.id)}
                    disabled={selectedTopics.length >= 5 && !selectedTopics.includes(topic.id)}
                  >
                    <LinearGradient
                      colors={selectedTopics.includes(topic.id) 
                        ? [topic.color + '40', topic.color + '15']
                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                      }
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.topicSelectEmoji}>{topic.emoji}</Text>
                    <Text style={[styles.topicSelectName, isDark && styles.textLight]}>{topic.name}</Text>
                    {selectedTopics.includes(topic.id) && (
                      <View style={styles.topicCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color={topic.color} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Username Edit Modal */}
      <Modal
        visible={showEditUsername}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditUsername(false)}
      >
        <View style={styles.topicModalOverlay}>
          <View style={[styles.topicModalContent, isDark && styles.darkCard]}>
            <Text style={[styles.topicModalTitle, isDark && styles.textLight]}>Edit Username</Text>
            <TextInput
              style={[styles.usernameInput, isDark && styles.darkInput]}
              placeholder="Enter username"
              placeholderTextColor={CommunityColors.text.tertiary}
              value={usernameInput}
              onChangeText={(text) => {
                setUsernameInput(text);
                setUsernameError('');
              }}
              autoCapitalize="none"
              maxLength={30}
            />
            {usernameError ? <Text style={styles.usernameError}>{usernameError}</Text> : null}
            <View style={styles.usernameButtons}>
              <TouchableOpacity style={styles.usernameCancel} onPress={() => setShowEditUsername(false)}>
                <Text style={styles.usernameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.usernameSave} onPress={handleUsernameSave}>
                <LinearGradient colors={CommunityGradients.primary} style={styles.usernameSaveGradient}>
                  <Text style={styles.usernameSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.imageModalOverlay} 
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalContent}>
            {isImageAvatar(profile.avatar) ? (
              <Image source={{ uri: profile.avatar }} style={styles.fullAvatar} resizeMode="cover" />
            ) : (
              <Text style={styles.fullAvatarEmoji}>{profile.avatar}</Text>
            )}
            {isOwnProfile && (
              <TouchableOpacity style={styles.changePhotoBtn} onPress={handleImagePick}>
                <Ionicons name="camera" size={20} color="white" />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : CommunityColors.text.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowMoreMenu(true);
              }} 
              style={styles.headerBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : CommunityColors.text.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.delay(100)}>
          <BlurView 
            intensity={isDark ? 40 : 90} 
            style={styles.profileCard} 
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.profileHeader}>
              <TouchableOpacity 
                style={styles.avatarContainer} 
                onPress={() => setShowImageModal(true)}
                disabled={isUploadingImage}
              >
                {renderAvatar(profile.avatar, 80)}
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
                {profile.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                )}
                {isOwnProfile && (
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={12} color="white" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={[styles.userTypeBadge, { backgroundColor: CommunityColors.primary + '20' }]}>
                <Ionicons name="people" size={12} color={CommunityColors.primary} />
                <Text style={[styles.userTypeText, { color: CommunityColors.primary }]}>Parent</Text>
              </View>
            </View>
            
            <View style={styles.nameRow}>
              <Text style={[styles.name, isDark && styles.textLight]}>{profile.displayName}</Text>
              {isOwnProfile && (
                <View style={[styles.relationshipBadge, { backgroundColor: CommunityColors.primary + '20' }]}>
                  <Text style={[styles.relationshipText, { color: CommunityColors.primary }]}>You</Text>
                </View>
              )}
            </View>
            
            {/* Unique Username Display */}
            <TouchableOpacity 
              style={styles.handleRow}
              onPress={() => {
                if (isOwnProfile) {
                  setUsernameInput(profile.handle);
                  setShowEditUsername(true);
                }
              }}
              disabled={!isOwnProfile}
            >
              <Text style={styles.handle}>{profile.handle}</Text>
              {profile.isVerified && (
                <View style={styles.verifiedBadgeSmall}>
                  <Ionicons name="checkmark" size={10} color="white" />
                </View>
              )}
              {isOwnProfile && (
                <Ionicons name="pencil" size={14} color={CommunityColors.text.tertiary} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
            
            <Text style={[styles.bio, isDark && styles.textMuted]}>{profile.bio || 'No bio yet'}</Text>
            
            {profile.country && profile.country !== 'Unknown' && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                <Text style={[styles.location, isDark && styles.textMuted]}>{profile.country}</Text>
              </View>
            )}

            {/* Online Status */}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { 
                backgroundColor: profile.onlineStatus === 'online' ? CommunityColors.success : 
                                 profile.onlineStatus === 'away' ? CommunityColors.accent : 
                                 CommunityColors.text.tertiary 
              }]} />
              <Text style={styles.statusText}>
                {profile.onlineStatus === 'online' ? 'Online now' : 
                 profile.onlineStatus === 'away' ? 'Away' : 
                 `Active ${new Date(profile.lastActive).toLocaleDateString()}`}
              </Text>
            </View>

            {/* Selected Topics Display */}
            {selectedTopics.length > 0 && (
              <View style={styles.topicsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedTopics.map(topicId => {
                    const topic = topics.find(t => t.id === topicId);
                    if (!topic) return null;
                    return (
                      <View key={topicId} style={[styles.topicBadge, { backgroundColor: topic.color + '20' }]}>
                        <Text style={styles.topicBadgeEmoji}>{topic.emoji}</Text>
                        <Text style={[styles.topicBadgeText, { color: topic.color }]}>{topic.name}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Action Buttons */}
            {!isOwnProfile ? (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.followButton, followingStatus && styles.followingButton, blocked && styles.blockedButton]}
                  onPress={handleFollow}
                  disabled={blocked}
                >
                  <Text style={[styles.followText, followingStatus && styles.followingText, blocked && styles.blockedText]}>
                    {blocked ? 'Blocked' : followingStatus ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                  <Ionicons name="mail-outline" size={20} color={CommunityColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton} onPress={() => setShowMoreMenu(true)}>
                  <Ionicons name="chevron-down" size={20} color={CommunityColors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ownActionButtons}>
                <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile}>
                  <Ionicons name="create-outline" size={18} color={CommunityColors.primary} />
                  <Text style={styles.editProfileText}>Edit Community Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareProfileBtn} onPress={handleShareProfile}>
                  <Ionicons name="share-outline" size={18} color={CommunityColors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </BlurView>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.posts)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Posts</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.followers)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Followers</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowing}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.following)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Following</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, isDark && styles.dividerDark]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDark && styles.textLight]}>
              {formatNumber(profile.stats.helpful)}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textMuted]}>Helpful</Text>
          </View>
        </Animated.View>

        {/* Badges */}
        <Animated.View entering={FadeInUp.delay(300)}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Achievements</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {profile.achievements?.map((achievementId, index) => {
              const badge = BADGES.find(b => b.name.toLowerCase().replace(/\\s+/g, '_') === achievementId) || BADGES[index % BADGES.length];
              return (
                <TouchableOpacity key={achievementId} style={styles.badgeCard}>
                  <View style={[styles.badgeIcon, { backgroundColor: badge.color + '30' }]}>
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  </View>
                  <Text style={[styles.badgeName, isDark && styles.textLight]} numberOfLines={1}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeDescription} numberOfLines={1}>
                    {badge.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(!profile.achievements || profile.achievements.length === 0) && (
              <Text style={[styles.noAchievements, isDark && styles.textMuted]}>
                No achievements yet. Start engaging to earn badges!
              </Text>
            )}
          </ScrollView>
        </Animated.View>

        {/* Content Tabs */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.tabContainer}>
          {(['posts', 'about', 'media'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText, 
                activeTab === tab && styles.tabTextActive, 
                isDark && styles.textLight
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          <View style={styles.postsContainer}>
            {userPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.tertiary} />
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>No posts yet</Text>
              </View>
            ) : (
              userPosts.map((post, index) => (
                <Animated.View key={post.id} entering={FadeInUp.delay(500 + index * 100)}>
                  <TouchableOpacity 
                    onPress={() => navigateToPostDetail(post.id)}
                    activeOpacity={0.9}
                  >
                    <BlurView 
                      intensity={isDark ? 40 : 80} 
                      style={styles.postCard} 
                      tint={isDark ? 'dark' : 'light'}
                    >
                      <View style={styles.postHeader}>
                        <Text style={styles.postTopic}>{post.topic}</Text>
                        <Text style={[styles.postTime, isDark && styles.textMuted]}>{post.time}</Text>
                      </View>
                      <Text style={[styles.postContent, isDark && styles.textLight]} numberOfLines={3}>
                        {post.content}
                      </Text>
                      
                      {/* FIXED: Image display in posts */}
                      {post.images && post.images.length > 0 && (
                        <View style={styles.postImagesRow}>
                          {post.images.slice(0, 3).map((img, idx) => (
                            <Image key={idx} source={{ uri: img }} style={styles.postThumbnail} />
                          ))}
                          {post.images.length > 3 && (
                            <View style={styles.moreImagesOverlay}>
                              <Text style={styles.moreImagesText}>+{post.images.length - 3}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      
                      <View style={styles.postStats}>
                        <TouchableOpacity 
                          style={styles.postStat}
                          onPress={() => handlePostLike(post)}
                        >
                          <Ionicons 
                            name={post.isLiked ? "heart" : "heart-outline"} 
                            size={18} 
                            color={post.isLiked ? CommunityColors.error : (isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary)} 
                          />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.likes}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.commentsCount}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.postStat}
                          onPress={() => handlePostRepost(post)}
                        >
                          <Ionicons 
                            name={post.isReposted ? "repeat" : "repeat-outline"} 
                            size={18} 
                            color={post.isReposted ? CommunityColors.secondary : (isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary)} 
                          />
                          <Text style={[styles.postStatText, isDark && styles.textMuted]}>
                            {post.reposts}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {activeTab === 'about' && (
          <Animated.View entering={FadeInUp.delay(500)} style={styles.aboutContainer}>
            <BlurView 
              intensity={isDark ? 40 : 80} 
              style={styles.aboutCard} 
              tint={isDark ? 'dark' : 'light'}
            >
              <Text style={[styles.aboutTitle, isDark && styles.textLight]}>About</Text>
              
              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Bio</Text>
                <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                  {profile.bio || 'No bio yet'}
                </Text>
              </View>

              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Username</Text>
                <View style={styles.aboutValueRow}>
                  <Ionicons name="at" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                  <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                    {profile.handle}
                  </Text>
                </View>
              </View>

              {profile.country && profile.country !== 'Unknown' && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Location</Text>
                  <View style={styles.aboutValueRow}>
                    <Ionicons name="location-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                    <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                      {profile.country}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Joined</Text>
                <View style={styles.aboutValueRow}>
                  <Ionicons name="calendar-outline" size={18} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.secondary} />
                  <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                    {new Date(profile.lastActive).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              </View>

              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Streak</Text>
                <View style={styles.aboutValueRow}>
                  <Ionicons name="flame-outline" size={18} color={CommunityColors.error} />
                  <Text style={[styles.aboutValue, isDark && styles.textLight]}>
                    {profile.stats.streakDays} day{profile.stats.streakDays !== 1 ? 's' : ''} active
                  </Text>
                </View>
              </View>

              {/* Topics Section in About */}
              <View style={styles.aboutSection}>
                <Text style={[styles.aboutLabel, isDark && styles.textMuted]}>Topics</Text>
                {selectedTopics.length > 0 ? (
                  <View style={styles.aboutTopicsRow}>
                    {selectedTopics.map(topicId => {
                      const topic = topics.find(t => t.id === topicId);
                      if (!topic) return null;
                      return (
                        <View key={topicId} style={[styles.aboutTopicBadge, { backgroundColor: topic.color + '20' }]}>
                          <Text style={styles.aboutTopicEmoji}>{topic.emoji}</Text>
                          <Text style={[styles.aboutTopicText, { color: topic.color }]}>{topic.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.aboutValue, isDark && styles.textLight]}>No topics selected</Text>
                )}
              </View>

              {isOwnProfile && (
                <TouchableOpacity 
                  style={styles.manageAccountBtn}
                  onPress={() => {
                    const parentNav = navigation.getParent();
                    if (parentNav) {
                      parentNav.navigate('Main', { screen: 'Settings' });
                    }
                  }}
                >
                  <Ionicons name="settings-outline" size={18} color={CommunityColors.primary} />
                  <Text style={styles.manageAccountText}>Manage Account Settings</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {activeTab === 'media' && (
          <View style={styles.mediaContainer}>
            {userPosts.filter(p => p.images && p.images.length > 0).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={48} color={isDark ? CommunityColors.text.secondary : CommunityColors.text.tertiary} />
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>No media yet</Text>
              </View>
            ) : (
              <View style={styles.mediaGrid}>
                {userPosts
                  .filter(p => p.images && p.images.length > 0)
                  .flatMap(p => p.images || [])
                  .map((img, idx) => (
                    <TouchableOpacity key={idx} style={styles.mediaItem}>
                      <Image source={{ uri: img }} style={styles.mediaImage} />
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CommunityColors.background.main },
  darkBg: { backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButton: { padding: 8, borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, flex: 1, textAlign: 'center', marginHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: { 
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CommunityColors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: CommunityColors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  userTypeText: { fontSize: 12, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '700', color: CommunityColors.text.primary },
  relationshipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  relationshipText: { fontSize: 11, fontWeight: '600' },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  handle: { fontSize: 15, color: CommunityColors.primary },
  verifiedBadgeSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: CommunityColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: { fontSize: 14, color: CommunityColors.text.secondary, lineHeight: 20, marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  location: { fontSize: 13, color: CommunityColors.text.secondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: CommunityColors.text.secondary },
  topicsRow: { marginBottom: 16 },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  topicBadgeEmoji: { fontSize: 14 },
  topicBadgeText: { fontSize: 12, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  ownActionButtons: { flexDirection: 'row', gap: 12 },
  followButton: {
    flex: 1,
    backgroundColor: CommunityColors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: CommunityColors.primary },
  blockedButton: { backgroundColor: CommunityColors.error + '15', borderColor: CommunityColors.error },
  followText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingText: { color: CommunityColors.primary },
  blockedText: { color: CommunityColors.error },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CommunityColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CommunityColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CommunityColors.primary + '10',
    paddingVertical: 12,
    borderRadius: 12,
  },
  editProfileText: { color: CommunityColors.primary, fontSize: 15, fontWeight: '600' },
  shareProfileBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CommunityColors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: CommunityColors.text.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: CommunityColors.text.secondary },
  statDivider: { width: 1, height: '60%', backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center' },
  dividerDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  badgesContainer: { paddingHorizontal: 20, gap: 12 },
  badgeCard: { alignItems: 'center', marginRight: 16, width: 80 },
  badgeIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: 12, fontWeight: '500', color: CommunityColors.text.primary, textAlign: 'center' },
  badgeDescription: { fontSize: 10, color: CommunityColors.text.secondary, textAlign: 'center', marginTop: 2 },
  noAchievements: { fontSize: 14, color: CommunityColors.text.secondary, fontStyle: 'italic', marginLeft: 20 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  tabText: { fontSize: 14, fontWeight: '500', color: CommunityColors.text.secondary },
  tabTextActive: { color: CommunityColors.text.primary, fontWeight: '600' },
  postsContainer: { marginTop: 16, paddingHorizontal: 20 },
  postCard: { borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  postTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: CommunityColors.primary,
    backgroundColor: CommunityColors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  postTime: { fontSize: 12, color: CommunityColors.text.tertiary },
  postContent: { fontSize: 14, color: CommunityColors.text.primary, lineHeight: 20, marginBottom: 12 },
  postImagesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  postThumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: CommunityColors.background.elevated },
  moreImagesOverlay: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: { color: 'white', fontSize: 14, fontWeight: '700' },
  postStats: { flexDirection: 'row', gap: 20 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postStatText: { fontSize: 13, color: CommunityColors.text.secondary },
  aboutContainer: { marginTop: 16, paddingHorizontal: 20 },
  aboutCard: { borderRadius: 16, padding: 20, overflow: 'hidden' },
  aboutTitle: { fontSize: 18, fontWeight: '700', color: CommunityColors.text.primary, marginBottom: 16 },
  aboutSection: { marginBottom: 16 },
  aboutLabel: { fontSize: 12, color: CommunityColors.text.tertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  aboutValue: { fontSize: 15, color: CommunityColors.text.primary, fontWeight: '500', lineHeight: 20 },
  aboutValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aboutTopicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  aboutTopicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  aboutTopicEmoji: { fontSize: 14 },
  aboutTopicText: { fontSize: 12, fontWeight: '600' },
  manageAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
  },
  manageAccountText: { fontSize: 14, color: CommunityColors.primary, fontWeight: '600' },
  mediaContainer: { marginTop: 16, paddingHorizontal: 20 },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaItem: {
    width: (width - 56) / 3,
    height: (width - 56) / 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%', backgroundColor: CommunityColors.background.elevated },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: CommunityColors.text.secondary, marginTop: 12 },
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16 },
  goBackButton: { backgroundColor: CommunityColors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
  textLight: { color: '#fff' },
  textMuted: { color: CommunityColors.text.secondary },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingRight: 20,
  },
  moreMenu: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginLeft: 'auto',
    width: 220,
    ...CommunityShadows.lg,
  },
  moreMenuDark: {
    backgroundColor: '#1a1a1a',
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
  },
  moreMenuItemLast: { borderBottomWidth: 0 },
  moreMenuText: { fontSize: 16, color: CommunityColors.text.primary, fontWeight: '600' },
  
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    alignItems: 'center',
  },
  fullAvatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: 'white',
  },
  fullAvatarEmoji: {
    fontSize: 150,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  changePhotoText: { color: 'white', fontSize: 15, fontWeight: '700' },
  
  // Topic Modal Styles
  topicModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  topicModalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    ...CommunityShadows.lg,
  },
  darkCard: {
    backgroundColor: '#1a1a1a',
  },
  topicModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topicModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  topicModalSubtitle: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    marginTop: 4,
  },
  topicModalClose: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: CommunityColors.background.elevated,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  topicSelectCard: {
    width: (width - 80) / 2,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  topicSelectCardActive: {
    borderColor: CommunityColors.primary,
  },
  topicSelectCardDisabled: {
    opacity: 0.4,
  },
  topicSelectEmoji: { fontSize: 32, marginBottom: 8 },
  topicSelectName: { fontSize: 14, fontWeight: '700', color: CommunityColors.text.primary },
  topicCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  
  // Username Edit Styles
  usernameInput: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CommunityColors.border,
    marginBottom: 8,
  },
  darkInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderColor: '#444',
  },
  usernameError: {
    fontSize: 13,
    color: CommunityColors.error,
    marginBottom: 12,
  },
  usernameButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  usernameCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: CommunityColors.background.elevated,
    alignItems: 'center',
  },
  usernameCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: CommunityColors.text.primary,
  },
  usernameSave: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  usernameSaveGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  usernameSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
