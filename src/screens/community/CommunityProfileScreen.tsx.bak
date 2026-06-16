// src/screens/community/CommunityProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Platform,
  ActivityIndicator,
  Share,
  Dimensions,
  Switch,
  Modal,
  Linking,
  StatusBar,
  Keyboard,
  ScrollView,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>;

const AnimatedScrollView = AutoHideAnimatedScrollView;
const { width, height } = Dimensions.get('window');

// ─── DESIGN TOKENS (Unified with Guardian/Baby screens) ──────────────
const THEME = {
  primary: '#667eea',
  primaryDark: '#764ba2',
  secondary: '#fa709a',
  accent: '#f59e0b',
  success: '#10b981',
  warning: '#fbbf24',
  danger: '#ef4444',
  info: '#3b82f6',
};

const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#667eea', gradient: ['#667eea', '#764ba2'] as [string, string], icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', gradient: ['#10b981', '#059669'] as [string, string], icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#fa709a', gradient: ['#fa709a', '#f5576c'] as [string, string], icon: 'heart' },
  member: { label: 'Member', color: '#64748b', gradient: ['#64748b', '#94a3b8'] as [string, string], icon: 'person' },
};

const EMOJI_OPTIONS = ['👤', '👩', '👨', '👵', '👴', '👶', '👧', '👦', '🧑', '👮', '👩‍⚕️', '👨‍⚕️', '👩‍🏫', '👨‍🏫', '👩‍🍳', '👨‍🍳', '👩‍⚖️', '👨‍⚖️', '👩‍🌾', '👨‍🌾'];

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#667eea', desc: 'Shared your first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#11998e', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#fa709a', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fee140', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#fa709a', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#667eea', desc: 'Identity verified' },
};

const TOPIC_COLORS: Record<string, string> = {
  'topic_1': '#667eea', 'topic_2': '#11998e', 'topic_3': '#fa709a',
  'topic_4': '#fee140', 'topic_5': '#fc5c7d', 'topic_6': '#6a82fb',
  'topic_7': '#f093fb', 'topic_8': '#4facfe', 'topic_9': '#fa709a',
  'topic_10': '#43e97b', 'topic_11': '#fa709a', 'topic_12': '#667eea',
};

// ─── GLASSMORPHISM CARD (From Guardian/Baby screens) ───────────────────
const GlassmorphismCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  delay?: number;
}> = ({ children, style, onPress, intensity = 80, delay = 0 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View entering={FadeInUp.delay(delay)} layout={Layout.springify()} style={[styles.glassCard, style]}>
      <Wrapper onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
};

const StatBadge: React.FC<{ icon: string; value: number | string; label: string; color: string }> = ({
  icon, value, label, color
}) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}> = ({ visible, onClose, title, children, isDark }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.modalOverlay}>
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <Animated.View entering={FadeInUp} style={[styles.modalContent, isDark && styles.modalContentDark]}>
        <LinearGradient
          colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  </Modal>
);

const AchievementBadge: React.FC<{ achievement: string; isDark: boolean }> = ({ achievement, isDark }) => {
  const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: '#667eea', desc: '' };
  return (
    <View style={[styles.achievementBadge, { backgroundColor: `${badge.color}15` }]}>
      <Text style={styles.achievementEmoji}>{badge.emoji}</Text>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
        <Text style={[styles.achievementDesc, isDark && styles.textMuted]}>{badge.desc}</Text>
      </View>
    </View>
  );
};

// ─── MAIN SCREEN ─────────────────────────────────────────────────────
export default function CommunityProfileScreen({ navigation }: Props) {
  const {
    currentUser, updateCommunityProfile, syncUserProfileAcrossPosts,
    getUserPosts, getSelectedTopics, getFollowers, getFollowing,
    checkAndAwardAchievements, updateUsername,
  } = useCommunity();
  const { profile, updateCommunityProfile: updateUserContextProfile } = useUser();
  const { themeColors, shouldReduceMotion, triggerHaptic } = useCustomization();
  const { compressImage, cacheImage, isValidImageUri, pickImage } = useMedia();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  // ─── State ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'achievements' | 'settings'>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    displayName: '',
    handle: '',
    bio: '',
    avatar: '',
    location: '',
    isPublic: true,
    notificationsEnabled: true,
    showActivityStatus: true,
    allowMessages: true,
  });

  const [originalData, setOriginalData] = useState({ ...formData });

  const dynamicPrimaryColor = themeColors.primary;
  const dynamicGradient = [themeColors.primary, themeColors.secondary] as [string, string];

  // Animated header
  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP) }],
  }));

  // ─── Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    loadUserData();
  }, [currentUser]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      if (currentUser) {
        const posts = getUserPosts(currentUser.id);
        const topics = getSelectedTopics();
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);

        setUserPosts(posts);
        setSelectedTopics(topics);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);

        const initialData = {
          displayName: currentUser.displayName || '',
          handle: currentUser.handle?.replace('@', '') || '',
          bio: currentUser.bio || '',
          avatar: currentUser.avatar || '',
          location: currentUser.country || currentUser.location || '',
          isPublic: true,
          notificationsEnabled: true,
          showActivityStatus: true,
          allowMessages: true,
        };

        setFormData(initialData);
        setOriginalData(initialData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
    setIsLoading(false);
  };

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentUser) return;
    if (!formData.displayName.trim()) {
      sweetAlert.error('Validation Error', 'Display name is required');
      triggerHaptic('error');
      return;
    }

    setIsSaving(true);
    triggerHaptic('medium');

    try {
      const handle = formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`;
      const updates: any = {
        displayName: formData.displayName.trim(),
        handle: handle.toLowerCase(),
        bio: formData.bio.trim(),
        avatar: formData.avatar,
        country: formData.location,
      };

      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);
      await syncUserProfileAcrossPosts(currentUser.id, updates);

      // Check for new achievements
      const newAchievements = await checkAndAwardAchievements();
      if (newAchievements.length > 0) {
        sweetAlert.success('Achievement Unlocked!', `You earned ${newAchievements.length} new badge${newAchievements.length > 1 ? 's' : ''}!`);
      }

      triggerHaptic('success');
      setIsEditing(false);
      setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
    } catch (error) {
      triggerHaptic('error');
      sweetAlert.error('Save Failed', 'Please try again');
    }
    setIsSaving(false);
  };

  const handleImagePick = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const uri = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!uri) {
        sweetAlert.toast('No Image Selected', 'You did not select an image');
        return;
      }
      setIsSaving(true);
      let processedUri = uri;
      try { processedUri = await compressImage(uri, 0.8); } catch (e) {}
      try { processedUri = await cacheImage(processedUri); } catch (e) {}
      setFormData(prev => ({ ...prev, avatar: processedUri }));
      triggerHaptic('success');
    } catch (error) {
      sweetAlert.error('Error', 'Failed to process image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({ ...prev, avatar: result.assets[0].uri }));
      }
    } catch (error) {
      sweetAlert.error('Error', 'Failed to take photo');
    }
  };

  const handleRemoveAvatar = () => {
    setShowImagePicker(false);
    sweetAlert.confirm('Remove Photo', 'Remove your profile picture?', async () => {
      setFormData(prev => ({ ...prev, avatar: '' }));
      if (currentUser) {
        await updateCommunityProfile({ avatar: '' });
      }
      sweetAlert.success('Photo Removed', 'Profile picture removed');
    }, () => {}, 'Remove', 'Cancel');
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShareProfile = async () => {
    if (!currentUser) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${currentUser.displayName} on LittleLoom! ${currentUser.handle}`,
        title: `${currentUser.displayName}'s Profile`,
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const handleCopyHandle = () => {
    // Clipboard.setString(formData.handle); // Requires expo-clipboard
    sweetAlert.toast('Copied!', 'Handle copied to clipboard');
  };

  const hasChanges = useMemo(() => {
    return Object.keys(formData).some(key => 
      formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]
    );
  }, [formData, originalData]);

  // ─── Scroll Handler ─────────────────────────────────────────────────
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  // ─── Emoji Picker ───────────────────────────────────────────────────
  const EmojiPicker = () => {
    if (!showEmojiPicker) return null;
    return (
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
        <View style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => handleEmojiSelect(emoji)}>
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // ─── RENDER SECTIONS ────────────────────────────────────────────────

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeAvatar avatar={formData.avatar || currentUser?.avatar} size={32} fallbackIcon="person" fallbackColor={dynamicPrimaryColor} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>
            {currentUser?.displayName || 'Community Profile'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          style={[styles.saveBtn, (!isEditing && !hasChanges) && styles.saveBtnDisabled]}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>
              {isEditing ? 'Save' : 'Edit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!currentUser) return null;
    const roleConfig = currentUser.isVerified ? ROLE_CONFIG.verified : ROLE_CONFIG.member;

    return (
      <Animated.View entering={FadeInUp} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImagePicker(true)}>
              <SafeAvatar
                avatar={formData.avatar || currentUser.avatar}
                size={100}
                fallbackIcon="person"
                fallbackColor={roleConfig.color}
                fallbackBgColor={`${roleConfig.color}20`}
                borderColor={roleConfig.color}
                borderWidth={3}
                showEditBadge={true}
                onPress={() => setShowImagePicker(true)}
                themeId={themeColors.primary}
                animated={!shouldReduceMotion}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{currentUser.displayName}</Text>
            <Text style={styles.profileMeta}>{currentUser.handle} • {roleConfig.label}</Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${roleConfig.color}20` }]}>
                <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
                <Text style={[styles.profileTagText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
              </View>
              {isEditing && (
                <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <View style={styles.editingDot} />
                  <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'overview', icon: 'grid-outline', label: 'Overview' },
          { id: 'posts', icon: 'document-text-outline', label: 'Posts' },
          { id: 'achievements', icon: 'trophy-outline', label: 'Badges' },
          { id: 'settings', icon: 'settings-outline', label: 'Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.id as typeof activeTab); }}
            >
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons name={tab.icon as any} size={18} color={isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b')} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, isDark && !isActive && styles.textMuted]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderQuickStats = () => (
    <GlassmorphismCard style={styles.statsCard} intensity={80} delay={100}>
      <View style={styles.statsRow}>
        <StatBadge icon="📝" value={userPosts.length} label="Posts" color="#667eea" />
        <StatBadge icon="👥" value={followerCount} label="Followers" color="#fa709a" />
        <StatBadge icon="🔥" value={currentUser?.stats?.streakDays || 0} label="Day Streak" color="#f59e0b" />
        <StatBadge icon="💙" value={currentUser?.stats?.helpful || 0} label="Helpful" color="#10b981" />
      </View>
    </GlassmorphismCard>
  );

  const renderOverviewTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {renderQuickStats()}

      {/* Bio Card */}
      <GlassmorphismCard style={styles.formCard} intensity={90} delay={200}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>About Me</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={20} color="#667eea" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          )}
        </View>

        {isEditing ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Bio</Text>
            <TextInput
              style={[styles.textArea, isDark && styles.textAreaDark]}
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself..."
              placeholderTextColor={isDark ? '#666' : '#999'}
              multiline
              numberOfLines={4}
              maxLength={160}
              selectionColor={themeColors.primary}
            />
            <Text style={[styles.charCount, { color: isDark ? '#94a3b8' : '#64748b' }]}>{formData.bio.length}/160</Text>
          </View>
        ) : (
          <View style={styles.bioDisplay}>
            <Text style={[styles.bioText, isDark && styles.textDark]}>
              {formData.bio || 'No bio yet. Tap edit to add one!'}
            </Text>
          </View>
        )}

        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Location</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="location-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.flexInput, isDark && styles.inputDark]}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="Your country or city"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
              selectionColor={themeColors.primary}
            />
          </View>
        </View>

        {/* Handle */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Username</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="at" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.flexInput, isDark && styles.inputDark]}
              value={formData.handle}
              onChangeText={(text) => setFormData(prev => ({ ...prev, handle: text.toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="username"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none"
              editable={isEditing}
              selectionColor={themeColors.primary}
            />
            {!isEditing && (
              <TouchableOpacity onPress={handleCopyHandle} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={18} color="#667eea" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GlassmorphismCard>

      {/* Topics Card */}
      <GlassmorphismCard style={styles.formCard} intensity={90} delay={300}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Interested Topics</Text>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setShowTopicSelector(true)}>
            <Ionicons name="add" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
        <View style={styles.topicsWrap}>
          {selectedTopics.length > 0 ? selectedTopics.map((topicId) => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            const topicColor = topic?.color || TOPIC_COLORS[topicId] || '#667eea';
            const topicName = topic?.name || topicId.replace('topic_', 'Topic ');
            return (
              <View key={topicId} style={[styles.topicChip, { backgroundColor: `${topicColor}20` }]}>
                <Text style={[styles.topicChipText, { color: topicColor }]}>
                  {topic?.emoji ? `${topic.emoji} ${topicName}` : topicName}
                </Text>
              </View>
            );
          }) : (
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>No topics selected yet</Text>
          )}
        </View>
      </GlassmorphismCard>

      {/* Quick Actions */}
      {!isEditing && (
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ChatList')}>
            <LinearGradient colors={dynamicGradient} style={styles.quickActionGradient}>
              <Ionicons name="chatbubbles" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Messages</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleShareProfile}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
              <Text style={[styles.quickActionText, { color: isDark ? '#fff' : '#1a1a1a' }]}>Share</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowPrivacySettings(true)}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="shield-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>My Posts</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{userPosts.length} threads</Text>
        </View>
      </View>

      {userPosts.length === 0 ? (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color="#667eea" />
          </View>
          <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No posts yet</Text>
          <Text style={styles.emptyText}>Share your first story with the community!</Text>
          <TouchableOpacity
            style={[styles.createPostBtn, { backgroundColor: dynamicPrimaryColor }]}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <Text style={styles.createPostBtnText}>Create Post</Text>
          </TouchableOpacity>
        </GlassmorphismCard>
      ) : (
        <View style={styles.activitiesList}>
          {userPosts.slice(0, 10).map((post, index) => (
            <GlassmorphismCard key={post.id} style={styles.activityItemCard} intensity={85} delay={index * 50}>
              {(() => {
                const topic = INITIAL_TOPICS.find(t => t.id === post.topicId);
                const topicColor = topic?.color || TOPIC_COLORS[post.topicId] || '#667eea';
                return (
                  <View style={[styles.activityIcon, { backgroundColor: `${topicColor}18` }]}>
                    <Ionicons name="document-text" size={20} color={topicColor} />
                  </View>
                );
              })()}
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={2}>{post.content}</Text>
                <Text style={styles.activityTime}>{post.time}</Text>
                <View style={styles.postStats}>
                  <Text style={styles.postStat}>❤️ {post.likes}</Text>
                  <Text style={styles.postStat}>💬 {post.commentsCount}</Text>
                  <Text style={styles.postStat}>🔄 {post.reposts}</Text>
                </View>
              </View>
            </GlassmorphismCard>
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderAchievementsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Achievements</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${dynamicPrimaryColor}20` }]}>
          <Text style={[styles.badgeText, { color: dynamicPrimaryColor }]}>{currentUser?.achievements?.length || 0} earned</Text>
        </View>
      </View>

      <GlassmorphismCard style={styles.achievementsCard} intensity={90} delay={100}>
        {currentUser?.achievements && currentUser.achievements.length > 0 ? (
          currentUser.achievements.map((achievement) => (
            <AchievementBadge key={achievement} achievement={achievement} isDark={isDark} />
          ))
        ) : (
          <View style={styles.emptyStateSmall}>
            <Ionicons name="trophy-outline" size={40} color="#667eea" />
            <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>No achievements yet</Text>
            <Text style={styles.emptyText}>Start posting and engaging to earn badges!</Text>
          </View>
        )}
      </GlassmorphismCard>

      {/* Progress to next achievements */}
      <GlassmorphismCard style={styles.formCard} intensity={85} delay={200}>
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Progress</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Text style={styles.progressValue}>{userPosts.length}</Text>
            <Text style={styles.progressLabel}>of 50 posts</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((userPosts.length / 50) * 100, 100)}%`, backgroundColor: '#667eea' }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressValue}>{currentUser?.stats?.helpful || 0}</Text>
            <Text style={styles.progressLabel}>of 50 helpful</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(((currentUser?.stats?.helpful || 0) / 50) * 100, 100)}%`, backgroundColor: '#10b981' }]} />
            </View>
          </View>
        </View>
      </GlassmorphismCard>
    </Animated.View>
  );

  const renderSettingsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassmorphismCard style={styles.formCard} intensity={90} delay={100}>
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Privacy & Preferences</Text>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name={formData.isPublic ? "globe" : "lock-closed"} size={22} color={formData.isPublic ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Public Profile</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Allow others to find and view your profile</Text>
            </View>
          </View>
          <Switch
            value={formData.isPublic}
            onValueChange={(val) => setFormData(prev => ({ ...prev, isPublic: val }))}
            trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name={formData.showActivityStatus ? "eye" : "eye-off"} size={22} color={formData.showActivityStatus ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Activity Status</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Show when you're online</Text>
            </View>
          </View>
          <Switch
            value={formData.showActivityStatus}
            onValueChange={(val) => setFormData(prev => ({ ...prev, showActivityStatus: val }))}
            trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name={formData.allowMessages ? "chatbubble" : "chatbubble-off"} size={22} color={formData.allowMessages ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Direct Messages</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Allow others to message you</Text>
            </View>
          </View>
          <Switch
            value={formData.allowMessages}
            onValueChange={(val) => setFormData(prev => ({ ...prev, allowMessages: val }))}
            trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name={formData.notificationsEnabled ? "notifications" : "notifications-off"} size={22} color={formData.notificationsEnabled ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Receive alerts about activity</Text>
            </View>
          </View>
          <Switch
            value={formData.notificationsEnabled}
            onValueChange={(val) => setFormData(prev => ({ ...prev, notificationsEnabled: val }))}
            trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }}
            thumbColor="#fff"
          />
        </View>
      </GlassmorphismCard>

      {/* Danger Zone */}
      <GlassmorphismCard style={styles.dangerCard} intensity={90} delay={200}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
            <Ionicons name="warning" size={32} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.dangerTitle}>Account Actions</Text>
        <Text style={styles.dangerDescription}>Manage your community account data and presence.</Text>

        <TouchableOpacity style={styles.dangerActionBtn} onPress={() => {
          sweetAlert.confirm('Clear History', 'Clear all your posts and activity?', async () => {
            sweetAlert.success('Cleared', 'Your activity history has been cleared');
          }, () => {}, 'Clear', 'Cancel');
        }}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={styles.dangerActionText}>Clear Activity History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerActionBtn} onPress={() => {
          sweetAlert.confirm('Deactivate', 'Temporarily deactivate your community profile?', async () => {
            sweetAlert.success('Deactivated', 'Your profile is now hidden');
          }, () => {}, 'Deactivate', 'Cancel');
        }}>
          <Ionicons name="pause-circle-outline" size={20} color="#f59e0b" />
          <Text style={[styles.dangerActionText, { color: '#f59e0b' }]}>Deactivate Profile</Text>
        </TouchableOpacity>
      </GlassmorphismCard>
    </Animated.View>
  );

  // ─── Main Render ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <Ionicons name="person-outline" size={64} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>Not signed in</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />
      {renderStickyHeader()}
      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        {renderTabs()}
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </View>
      </AnimatedScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      {/* Image Picker Modal */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.primary}20` }]}>
              <Ionicons name="images-outline" size={28} color={themeColors.primary} />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.accent}20` }]}>
              <Ionicons name="camera-outline" size={28} color={themeColors.accent} />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="happy-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Pick Emoji</Text>
          </TouchableOpacity>
          {(formData.avatar || currentUser.avatar) && (
            <TouchableOpacity style={styles.imagePickerOption} onPress={handleRemoveAvatar}>
              <View style={[styles.imagePickerIcon, { backgroundColor: '#ff475720' }]}>
                <Ionicons name="trash-outline" size={28} color="#ff4757" />
              </View>
              <Text style={[styles.imagePickerLabel, { color: '#ff4757' }]}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ActionModal>

      <EmojiPicker />
    </View>
  );
}

// ─── STYLES (Unified Guardian/Baby/Community Design) ─────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // Sticky Header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3, maxWidth: 180 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#667eea', minWidth: 60, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#94a3b8' },

  // Profile Hero
  profileHero: { paddingHorizontal: 20, paddingBottom: 20 },
  profileHeroContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarSection: { position: 'relative' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, color: '#64748b', marginTop: 2, fontWeight: '500' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  editToggleBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Tab Bar
  tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)' },
  tab: { flex: 1 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },

  // GlassCard
  glassCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
  glassContent: { flex: 1 },

  // Stats
  statsCard: { padding: 0, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
  statBadge: { alignItems: 'center', gap: 6 },
  statIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Form Card
  formCard: { padding: 0, marginBottom: 16 },
  sectionHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  editIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },
  editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  editingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  inputGroup: { marginBottom: 20, paddingHorizontal: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 18, paddingHorizontal: 18, height: 56, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  inputContainerDark: { backgroundColor: 'rgba(30,30,40,0.5)', borderColor: 'rgba(255,255,255,0.06)' },
  inputDisabled: { opacity: 0.6 },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, fontSize: 17, color: '#1e293b', fontWeight: '600' },
  inputDark: { color: '#ffffff' },
  flexInput: { flex: 1 },
  copyBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(102,126,234,0.1)' },

  textArea: { height: 110, textAlignVertical: 'top', paddingTop: 18, backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 18, paddingHorizontal: 18, fontSize: 17, color: '#1e293b', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', marginHorizontal: 20 },
  textAreaDark: { backgroundColor: 'rgba(30,30,40,0.5)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.06)' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginHorizontal: 20, fontWeight: '500' },

  bioDisplay: { paddingHorizontal: 20, paddingBottom: 16 },
  bioText: { fontSize: 15, color: '#475569', lineHeight: 22, fontWeight: '500' },

  // Topics
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  topicChipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickActionBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  quickActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Activity / Posts
  tabPanel: { paddingBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateSmall: { padding: 32, alignItems: 'center' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  activitiesList: { gap: 10 },
  activityItemCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  activityIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 20 },
  activityTime: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
  postStats: { flexDirection: 'row', gap: 12, marginTop: 6 },
  postStat: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  createPostBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignSelf: 'center' },
  createPostBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Achievements
  achievementsCard: { padding: 20, gap: 12 },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16 },
  achievementEmoji: { fontSize: 28 },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 16, fontWeight: '700' },
  achievementDesc: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },

  progressRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingBottom: 20 },
  progressItem: { flex: 1 },
  progressValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  progressLabel: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.15)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Preferences
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  preferenceDesc: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  // Danger Zone
  dangerCard: { padding: 24, alignItems: 'center' },
  dangerIconContainer: { marginBottom: 16 },
  dangerIcon: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 20, fontWeight: '800', color: '#ef4444', marginBottom: 8 },
  dangerDescription: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  dangerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, width: '100%', marginTop: 8 },
  dangerActionText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  // Image Picker
  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },

  // Emoji Picker (continued)
  emojiPickerSheetDark: { backgroundColor: '#1e1e2e' },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(100,116,139,0.08)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden', padding: 24 },
  modalContentDark: { backgroundColor: '#1e1e2e' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Retry
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Info Items
  infoDivider: { height: 1, marginHorizontal: 20 },
});
