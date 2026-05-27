// src/screens/community/CreatePostScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showSuccessModal, showErrorModal, showConfirmModal } from '../../utils/modal';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type CreatePostScreenProps = NativeStackScreenProps<CommunityStackParamList, 'CreatePost'>;

const { width } = Dimensions.get('window');

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
];

export default function CreatePostScreen({ navigation, route }: CreatePostScreenProps) {
  // FIX: Safer route params extraction with full fallback chain
  const routeParams = route?.params ?? {};
  const topicId = routeParams?.topicId;

  const { 
    topics, 
    createPost, 
    currentUser, 
    updateUserLocation, 
    getSelectedTopics,
    updateSelectedTopics 
  } = useCommunity();
  const { communityProfile } = useUser();

  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(currentUser?.country || '');
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [userSelectedTopics, setUserSelectedTopics] = useState<string[]>([]);

  // Load user\'s selected topics from onboarding/profile
  useEffect(() => {
    const loadSelectedTopics = async () => {
      try {
        const savedTopics = getSelectedTopics();
        // FIX: If empty (skipped onboarding), use first 3 topics as fallback
        if (!savedTopics || savedTopics.length === 0) {
          const fallbackTopics = topics.slice(0, 3).map(t => t.id);
          setUserSelectedTopics(fallbackTopics);
          // Also save these as selected topics
          await updateSelectedTopics(fallbackTopics);
        } else {
          setUserSelectedTopics(savedTopics);
        }
      } catch (error) {
        console.error('Error loading selected topics:', error);
        // Fallback to all topics if error
        setUserSelectedTopics(topics.map(t => t.id));
      }
    };
    if (topics.length > 0) {
      loadSelectedTopics();
    }
  }, [topics, getSelectedTopics, updateSelectedTopics]);

  // CRITICAL FIX: Update selected topic when topics load after mount
  useEffect(() => {
    if (topics.length > 0) {
      let targetTopic: Topic | undefined;

      // First try the route param topicId
      if (topicId) {
        targetTopic = topics.find(t => t.id === topicId);
      }

      // Then try user\'s selected topics
      if (!targetTopic && userSelectedTopics.length > 0) {
        targetTopic = topics.find(t => userSelectedTopics.includes(t.id));
      }

      // Finally fallback to first topic
      if (!targetTopic) {
        targetTopic = topics[0];
      }

      setSelectedTopic(targetTopic || null);
      setTopicsLoaded(true);
    }
  }, [topics, topicId, userSelectedTopics]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 4,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(a => a.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 4));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      showErrorModal({ message: 'Failed to pick images. Please try again.' });
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled) {
        setImages(prev => [...prev, result.assets[0].uri].slice(0, 4));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      showErrorModal({ message: 'Failed to take photo. Please try again.' });
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages(images.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0) {
      showErrorModal({ message: 'Please add some content or images to your post' });
      return;
    }

    if (!selectedTopic) {
      showErrorModal({ message: 'Please select a topic' });
      return;
    }

    setIsPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await createPost(content.trim(), selectedTopic.id, images, isAnonymous);
      setIsPosting(false);
      showSuccessModal({ message: 'Post created successfully!' });
      navigation.goBack();
    } catch (error) {
      setIsPosting(false);
      showErrorModal({ message: 'Failed to create post. Please try again.' });
    }
  };

  const handleCancel = () => {
    if (content.trim() || images.length > 0) {
      showConfirmModal({
        title: 'Discard Post?',
        message: 'You have unsaved changes. Are you sure you want to discard them?',
        onConfirm: () => navigation.goBack(),
      });
    } else {
      navigation.goBack();
    }
  };

  const handleCountrySelect = async (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country.name);
    await updateUserLocation(country.name);
    setShowCountryPicker(false);
  };

  const handleTopicSelect = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowTopicSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveSelectedTopics = async (newSelectedTopics: string[]) => {
    await updateSelectedTopics(newSelectedTopics);
    setUserSelectedTopics(newSelectedTopics);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const characterCount = content.length;
  const maxCharacters = 1000;

  // FIX: If no user selected topics, show all topics
  const getFilteredTopics = () => {
    if (!userSelectedTopics || userSelectedTopics.length === 0) return topics;
    return topics.filter(t => userSelectedTopics.includes(t.id));
  };

  const filteredTopics = getFilteredTopics();

  // FIX: Better loading state - show loading until topics are ready AND we have a selected topic
  if (!topicsLoaded || topics.length === 0 || !selectedTopic) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="dark" />
        <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={CommunityColors.primary} />
        <Text style={{ marginTop: 16, color: CommunityColors.text.secondary, fontWeight: '600' }}>
          {topics.length === 0 ? 'Loading topics...' : 'Setting up...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <TouchableOpacity 
            style={[styles.postButton, (content.trim() || images.length > 0) && styles.postButtonActive]}
            disabled={(!content.trim() && images.length === 0) || isPosting}
            onPress={handlePost}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.postButtonText, (content.trim() || images.length > 0) && styles.postButtonTextActive]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Selected Topics Section */}
          <Animated.View entering={FadeInUp}>
            <View style={styles.selectedTopicsHeader}>
              <Text style={styles.sectionLabel}>Your Topics</Text>
              <TouchableOpacity 
                style={styles.manageTopicsButton}
                onPress={() => setShowTopicSelector(true)}
              >
                <Ionicons name="options-outline" size={16} color={CommunityColors.primary} />
                <Text style={styles.manageTopicsText}>
                  {userSelectedTopics.length > 0 ? 'Manage' : 'Select Topics'}
                </Text>
              </TouchableOpacity>
            </View>

            {filteredTopics.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicsContainer}
              >
                {filteredTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.topicChip,
                      selectedTopic?.id === topic.id && { 
                        backgroundColor: topic.color + '30',
                        borderColor: topic.color,
                      }
                    ]}
                    onPress={() => {
                      setSelectedTopic(topic);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                    <Text style={[
                      styles.topicName,
                      selectedTopic?.id === topic.id && { color: topic.color, fontWeight: '800' }
                    ]}>
                      {topic.name}
                    </Text>
                    {selectedTopic?.id === topic.id && (
                      <Ionicons name="checkmark-circle" size={16} color={topic.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity 
                style={styles.noTopicsBanner}
                onPress={() => setShowTopicSelector(true)}
              >
                <LinearGradient
                  colors={[CommunityColors.primary + '15', CommunityColors.primary + '05']}
                  style={styles.noTopicsGradient}
                >
                  <Ionicons name="bookmark-outline" size={24} color={CommunityColors.primary} />
                  <Text style={styles.noTopicsTitle}>No topics selected yet</Text>
                  <Text style={styles.noTopicsSubtext}>
                    Tap here to choose topics you\'re interested in
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* All Topics Quick Access */}
          {userSelectedTopics.length > 0 && (
            <Animated.View entering={FadeInUp.delay(50)}>
              <TouchableOpacity 
                style={styles.allTopicsButton}
                onPress={() => setShowTopicSelector(true)}
              >
                <Text style={styles.allTopicsText}>
                  Browse all {topics.length} topics
                </Text>
                <Ionicons name="chevron-forward" size={16} color={CommunityColors.text.tertiary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Content Input */}
          <Animated.View entering={FadeInUp.delay(100)}>
            <BlurView intensity={80} style={styles.inputContainer} tint="light">
              <LinearGradient 
                colors={CommunityGradients.glass}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.inputHeader}>
                <Text style={styles.inputAvatar}>
                  {isAnonymous ? '🎭' : (currentUser?.avatar || '👤')}
                </Text>
                <View style={styles.inputMeta}>
                  <Text style={styles.inputName}>
                    {isAnonymous ? 'Anonymous' : (currentUser?.displayName || 'You')}
                  </Text>
                  <View style={styles.locationRow}>
                    <View style={styles.topicBadge}>
                      <Text style={styles.topicBadgeEmoji}>{selectedTopic?.emoji}</Text>
                      <Text style={styles.inputTopic}>{selectedTopic?.name}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.countrySelector}
                      onPress={() => setShowCountryPicker(true)}
                    >
                      <Ionicons name="location-outline" size={14} color={CommunityColors.primary} />
                      <Text style={styles.countryText}>
                        {selectedCountry || 'Add location'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="What\'s on your mind? Share your experience, ask a question, or offer support..."
                placeholderTextColor={CommunityColors.text.tertiary}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                maxLength={maxCharacters}
              />
              <Text style={styles.characterCount}>
                {characterCount}/{maxCharacters}
              </Text>
            </BlurView>
          </Animated.View>

          {/* IMAGE PREVIEW - FULL DISPLAY */}
          {images.length > 0 && (
            <Animated.View entering={FadeInUp} style={styles.imagesContainer}>
              {images.map((uri, index) => (
                <View key={index} style={[
                  styles.imageWrapper,
                  images.length === 1 ? styles.imageWrapperSingle :
                  images.length === 2 ? styles.imageWrapperDouble :
                  images.length === 3 ? styles.imageWrapperTriple :
                  styles.imageWrapperQuad
                ]}>
                  <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity 
                    style={styles.removeImage}
                    onPress={() => removeImage(index)}
                  >
                    <BlurView intensity={90} style={styles.removeImageBlur}>
                      <Ionicons name="close" size={16} color="white" />
                    </BlurView>
                  </TouchableOpacity>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Tools */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.toolsContainer}>
            <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
              <View style={[styles.toolIcon, { backgroundColor: CommunityColors.primary + '20' }]}>
                <Ionicons name="image-outline" size={24} color={CommunityColors.primary} />
              </View>
              <Text style={styles.toolText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={takePhoto}>
              <View style={[styles.toolIcon, { backgroundColor: CommunityColors.secondary + '20' }]}>
                <Ionicons name="camera-outline" size={24} color={CommunityColors.secondary} />
              </View>
              <Text style={styles.toolText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => {}}>
              <View style={[styles.toolIcon, { backgroundColor: CommunityColors.accent + '20' }]}>
                <Ionicons name="mic-outline" size={24} color={CommunityColors.accentDark} />
              </View>
              <Text style={styles.toolText}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => {}}>
              <View style={[styles.toolIcon, { backgroundColor: CommunityColors.info + '20' }]}>
                <Ionicons name="bar-chart-outline" size={24} color={CommunityColors.info} />
              </View>
              <Text style={styles.toolText}>Poll</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Options */}
          <Animated.View entering={FadeInUp.delay(300)}>
            <BlurView intensity={80} style={styles.optionsContainer} tint="light">
              <LinearGradient 
                colors={CommunityGradients.glass}
                style={StyleSheet.absoluteFill}
              />
              <TouchableOpacity 
                style={styles.optionRow}
                onPress={() => setIsAnonymous(!isAnonymous)}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIcon, { backgroundColor: CommunityColors.primary + '20' }]}>
                    <Ionicons name="eye-off-outline" size={20} color={CommunityColors.primary} />
                  </View>
                  <View>
                    <Text style={styles.optionText}>Post anonymously</Text>
                    <Text style={styles.optionSubtext}>Your identity will be hidden</Text>
                  </View>
                </View>
                <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
                  {isAnonymous && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.tipsContainer}>
            <LinearGradient 
              colors={[CommunityColors.primary + '15', CommunityColors.primary + '05']}
              style={styles.tipsGradient}
            >
              <Text style={styles.tipsTitle}>💡 Tips for great posts</Text>
              <Text style={styles.tipText}>• Be kind and supportive</Text>
              <Text style={styles.tipText}>• Share specific details</Text>
              <Text style={styles.tipText}>• Use photos to tell your story</Text>
              <Text style={styles.tipText}>• Ask questions to engage others</Text>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={95} style={styles.modalContent} tint="light">
            <LinearGradient 
              colors={CommunityGradients.glass}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.countryList}>
              {COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryItem,
                    selectedCountry === country.name && styles.countryItemSelected
                  ]}
                  onPress={() => handleCountrySelect(country)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={[
                    styles.countryName,
                    selectedCountry === country.name && styles.countryNameSelected
                  ]}>
                    {country.name}
                  </Text>
                  {selectedCountry === country.name && (
                    <Ionicons name="checkmark" size={20} color={CommunityColors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Topic Selector Modal */}
      <Modal
        visible={showTopicSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={95} style={[styles.modalContent, { maxHeight: '85%' }]} tint="light">
            <LinearGradient 
              colors={CommunityGradients.glass}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Your Topics</Text>
                <Text style={styles.modalSubtitle}>
                  Choose up to 5 topics to personalize your feed
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopicSelector(false)}>
                <Ionicons name="close" size={24} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.topicCounter}>
              {userSelectedTopics.length}/5 selected
            </Text>

            <ScrollView style={styles.topicList} showsVerticalScrollIndicator={false}>
              <View style={styles.topicGrid}>
                {topics.map((topic) => {
                  const isSelected = userSelectedTopics.includes(topic.id);
                  const isMaxReached = userSelectedTopics.length >= 5 && !isSelected;

                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        styles.topicGridItem,
                        isSelected && { 
                          borderColor: topic.color,
                          backgroundColor: topic.color + '15'
                        },
                        isMaxReached && styles.topicGridItemDisabled
                      ]}
                      onPress={() => {
                        if (isMaxReached) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          Alert.alert(
                            'Maximum Topics Reached',
                            'You can select up to 5 topics. Remove one to add another.',
                            [{ text: 'OK' }]
                          );
                          return;
                        }

                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const newTopics = isSelected
                          ? userSelectedTopics.filter(id => id !== topic.id)
                          : [...userSelectedTopics, topic.id];

                        handleSaveSelectedTopics(newTopics);
                      }}
                      disabled={isMaxReached}
                    >
                      <Text style={styles.topicGridEmoji}>{topic.emoji}</Text>
                      <Text style={[
                        styles.topicGridName,
                        isSelected && { color: topic.color, fontWeight: '800' }
                      ]}>
                        {topic.name}
                      </Text>

                      {isSelected && (
                        <View style={[styles.topicGridCheck, { backgroundColor: topic.color }]}>
                          <Ionicons name="checkmark" size={14} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.topicSelectorFooter}>
              <TouchableOpacity 
                style={styles.topicSelectorDoneButton}
                onPress={() => setShowTopicSelector(false)}
              >
                <LinearGradient
                  colors={CommunityGradients.primary}
                  style={styles.topicSelectorDoneGradient}
                >
                  <Text style={styles.topicSelectorDoneText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
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
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CommunityColors.primary + '20',
  },
  postButtonActive: { 
    backgroundColor: CommunityColors.primary,
    ...CommunityShadows.md,
  },
  postButtonText: { fontSize: 16, fontWeight: '700', color: CommunityColors.text.tertiary },
  postButtonTextActive: { color: 'white' },

  // Selected Topics Section
  selectedTopicsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manageTopicsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: CommunityColors.primary + '10',
    borderRadius: 16,
  },
  manageTopicsText: {
    fontSize: 13,
    fontWeight: '700',
    color: CommunityColors.primary,
  },
  topicsContainer: {
    paddingHorizontal: CommunitySpacing.md,
    gap: 12,
    paddingBottom: 8,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CommunityColors.background.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
    ...CommunityShadows.sm,
  },
  topicEmoji: { fontSize: 20 },
  topicName: { fontSize: 14, fontWeight: '600', color: CommunityColors.text.secondary },

  // No Topics Banner
  noTopicsBanner: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.md,
  },
  noTopicsGradient: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  noTopicsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  noTopicsSubtext: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
  },

  // All Topics Button
  allTopicsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.lg,
    gap: 4,
    ...CommunityShadows.sm,
  },
  allTopicsText: {
    fontSize: 14,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },

  // Input Section
  inputContainer: {
    margin: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.xl,
    padding: 20,
    overflow: 'hidden',
    ...CommunityShadows.md,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputAvatar: { fontSize: 40, marginRight: 12 },
  inputMeta: { flex: 1 },
  inputName: { fontSize: 16, fontWeight: '800', color: CommunityColors.text.primary },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CommunityColors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topicBadgeEmoji: { fontSize: 12 },
  inputTopic: { fontSize: 13, color: CommunityColors.primary, fontWeight: '600' },
  countrySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countryText: { fontSize: 13, color: CommunityColors.primary, fontWeight: '600' },
  textInput: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    lineHeight: 24,
    minHeight: 150,
  },
  characterCount: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    textAlign: 'right',
    marginTop: 8,
  },

  // IMAGE PREVIEW STYLES - FULL GRID DISPLAY
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CommunitySpacing.lg,
    gap: 8,
    marginBottom: 16,
  },
  imageWrapper: {
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...CommunityShadows.sm,
  },
  imageWrapperSingle: {
    width: '100%',
    height: 280,
  },
  imageWrapperDouble: {
    width: (width - 48) / 2,
    height: 200,
  },
  imageWrapperTriple: {
    width: (width - 56) / 3,
    height: 140,
  },
  imageWrapperQuad: {
    width: (width - 56) / 2,
    height: 160,
  },
  previewImage: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  removeImageBlur: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: CommunitySpacing.lg,
    marginBottom: 24,
  },
  toolButton: { alignItems: 'center', gap: 8 },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: CommunityBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontSize: 12, color: CommunityColors.text.secondary, fontWeight: '600' },
  optionsContainer: {
    marginHorizontal: CommunitySpacing.lg,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    marginBottom: 24,
    ...CommunityShadows.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: 16, fontWeight: '700', color: CommunityColors.text.primary },
  optionSubtext: { fontSize: 13, color: CommunityColors.text.tertiary, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: CommunityColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: CommunityColors.primary, borderColor: CommunityColors.primary },
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
  tipsTitle: { fontSize: 14, fontWeight: '800', color: CommunityColors.primary, marginBottom: 12 },
  tipText: { fontSize: 13, color: CommunityColors.text.secondary, marginBottom: 6 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: CommunityColors.text.primary },
  modalSubtitle: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  countryList: { maxHeight: 400 },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  countryItemSelected: { backgroundColor: CommunityColors.primary + '10' },
  countryFlag: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 16, color: CommunityColors.text.primary },
  countryNameSelected: { color: CommunityColors.primary, fontWeight: '700' },

  // Topic Selector Modal Styles
  topicCounter: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  topicList: { maxHeight: 500 },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  topicGridItem: {
    width: (width - 72) / 2,
    padding: 16,
    borderRadius: CommunityBorderRadius.xl,
    backgroundColor: CommunityColors.background.card,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 8,
    ...CommunityShadows.sm,
  },
  topicGridItemDisabled: {
    opacity: 0.4,
  },
  topicGridEmoji: { fontSize: 32 },
  topicGridName: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: CommunityColors.text.primary,
    textAlign: 'center',
  },
  topicGridCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicSelectorFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.border,
  },
  topicSelectorDoneButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...CommunityShadows.md,
  },
  topicSelectorDoneGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  topicSelectorDoneText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
});