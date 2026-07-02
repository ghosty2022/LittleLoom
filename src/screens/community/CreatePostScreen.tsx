import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useCommunity } from '../../context/CommunityContext';
import {  Alert, Button, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useMedia } from '../../context/MediaContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import { CommunityColors, CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

type CreatePostScreenProps = NativeStackScreenProps<CommunityStackParamList, 'CreatePost'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const MOODS: { value: PostMood; emoji: string; label: string; color: string; bgColor: string }[] = [
  { value: 'celebrating', emoji: '🎉', label: 'Celebrating', color: '#f59e0b', bgColor: '#f59e0b15' },
  { value: 'support', emoji: '💙', label: 'Support', color: '#3b82f6', bgColor: '#3b82f615' },
  { value: 'advice', emoji: '💡', label: 'Advice', color: '#8b5cf6', bgColor: '#8b5cf615' },
  { value: 'milestone', emoji: '🏆', label: 'Milestone', color: '#10b981', bgColor: '#10b98115' },
  { value: 'venting', emoji: '💨', label: 'Venting', color: '#ef4444', bgColor: '#ef444415' },
];

interface ImageGridProps {
  images: string[];
  onRemove: (index: number) => void;
}

const ImageGrid = ({
  images, onRemove }: ImageGridProps) => {
  if (images.length === 0) return null;

  return (
    <View style={styles.imageGridWrapper}>
      {images.length === 1 ? (
        <View style={styles.singleImageContainer}>
          <Image source={{ uri: images[0] }} style={styles.singleImage} resizeMode="cover" />
          <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => onRemove(0)}>
            <View style={styles.imageRemoveInner}>
              <Ionicons name="close" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.multiImageGrid}>
          {images.slice(0, 4).map((uri, index) => (
            <View key={index} style={styles.gridImageItem}>
              <Image source={{ uri }} style={styles.gridImage} resizeMode="cover" />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => onRemove(index)}>
                <View style={styles.imageRemoveInner}>
                  <Ionicons name="close" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              {index === 3 && images.length > 4 && (
                <View style={styles.gridMoreOverlay}>
                  <Text style={styles.gridMoreText}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

interface ToolButtonProps {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
  badge?: number;
}

const ToolButton = ({ icon, label, color, bgColor, onPress, badge }: ToolButtonProps) => (
  <TouchableOpacity style={styles.toolButton} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.toolIcon, { backgroundColor: bgColor }]}>
      <Ionicons name={icon as any} size={22} color={color} />
      {badge !== undefined && badge > 0 && (
        <View style={[styles.toolBadge, { backgroundColor: color }]}>
          <Text style={styles.toolBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.toolText}>{label}</Text>
  </TouchableOpacity>
);

export default function CreatePostScreen({ navigation, route }: CreatePostScreenProps) {
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

  const { 
    pickImage: mediaPickImage, 
    pickMultipleImages, 
    takePhoto: mediaTakePhoto,
    compressImage,
    cacheImage,
    isValidImageUri,
  } = useMedia();

  const sweetAlert = useSweetAlert();

  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [postStatus, setPostStatus] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(currentUser?.country || '');
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [userSelectedTopics, setUserSelectedTopics] = useState<string[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  
  const [selectedMood, setSelectedMood] = useState<PostMood | undefined>(undefined);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [showMoodPicker, setShowMoodPicker] = useState(false);

  useEffect(() => {
    const loadSelectedTopics = async () => {
      try {
        const savedTopics = getSelectedTopics();
        if (!savedTopics || savedTopics.length === 0) {
          const fallbackTopics = topics.slice(0, 3).map(t => t.id);
          setUserSelectedTopics(fallbackTopics);
          await updateSelectedTopics(fallbackTopics);
        } else {
          setUserSelectedTopics(savedTopics);
        }
      } catch (error) {
        console.error('Error loading selected topics:', error);
        setUserSelectedTopics(topics.map(t => t.id));
      }
    };
    if (topics.length > 0) {
      loadSelectedTopics();
    }
  }, [topics, getSelectedTopics, updateSelectedTopics]);

  useEffect(() => {
    if (topics.length > 0) {
      let targetTopic: Topic | undefined;

      if (topicId) {
        targetTopic = topics.find(t => t.id === topicId);
      }

      if (!targetTopic && userSelectedTopics.length > 0) {
        targetTopic = topics.find(t => userSelectedTopics.includes(t.id));
      }

      if (!targetTopic) {
        targetTopic = topics[0];
      }

      setSelectedTopic(targetTopic || null);
      setTopicsLoaded(true);
    }
  }, [topics, topicId, userSelectedTopics]);

  useEffect(() => {
    const saveDraft = async () => {
      const draft = { 
        content, 
        images, 
        selectedTopicId: selectedTopic?.id,
        mood: selectedMood,
        pollQuestion,
        pollOptions,
      };
      await AsyncStorage.setItem('post_draft', JSON.stringify(draft));
    };

    const timer = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timer);
  }, [content, images, selectedTopic, selectedMood, pollQuestion, pollOptions]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draftJson = await AsyncStorage.getItem('post_draft');
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.content) setContent(draft.content);
          if (draft.images) {
            const validImages = draft.images.filter((uri: string) => isValidImageUri(uri));
            setImages(validImages);
          }
          if (draft.mood) setSelectedMood(draft.mood);
          if (draft.pollQuestion) setPollQuestion(draft.pollQuestion);
          if (draft.pollOptions) setPollOptions(draft.pollOptions);
        }
      } catch (error) {
        console.warn('Failed to load draft:', error);
      }
    };
    loadDraft();
  }, [isValidImageUri]);

  const pickImage = async () => {
    try {
      setIsProcessingImages(true);
      
      const pickedUris = await pickMultipleImages(4);
      
      if (pickedUris && pickedUris.length > 0) {
        const processedUris: string[] = [];
        
        for (const uri of pickedUris) {
          try {
            const compressed = await compressImage(uri, 0.8);
            const cached = await cacheImage(compressed);
            processedUris.push(cached);
          } catch (err) {
            console.warn('Failed to process image:', err);
            if (isValidImageUri(uri)) {
              processedUris.push(uri);
            }
          }
        }

        setImages(prev => [...prev, ...processedUris].slice(0, 4));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      sweetAlert.error('Image Error', 'Failed to pick images. Please try again.');
    } finally {
      setIsProcessingImages(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Please allow camera access to take photos.', 'warning');
        return;
      }

      setIsProcessingImages(true);

      const photoUri = await mediaTakePhoto();
      
      if (photoUri) {
        try {
          const compressed = await compressImage(photoUri, 0.8);
          const cached = await cacheImage(compressed);
          setImages(prev => [...prev, cached].slice(0, 4));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (err) {
          console.warn('Failed to process photo:', err);
          if (isValidImageUri(photoUri)) {
            setImages(prev => [...prev, photoUri].slice(0, 4));
          }
        }
      }
    } catch (error) {
      sweetAlert.error('Camera Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsProcessingImages(false);
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages(images.filter((_, i) => i !== index));
  };

  const simulateProgress = async () => {
    const stages = [
      { progress: 15, status: 'Preparing your post...', delay: 300 },
      { progress: 35, status: 'Uploading images...', delay: 800 },
      { progress: 55, status: 'Processing media...', delay: 600 },
      { progress: 75, status: 'Almost there...', delay: 500 },
      { progress: 90, status: 'Finalizing...', delay: 400 },
      { progress: 100, status: 'Posted!', delay: 300 },
    ];

    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, stage.delay));
      setPostProgress(stage.progress);
      setPostStatus(stage.status);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0 && !pollQuestion.trim()) {
      sweetAlert.error('Empty Post', 'Please add some content, images, or a poll to your post');
      return;
    }

    if (!selectedTopic) {
      sweetAlert.error('No Topic', 'Please select a topic');
      return;
    }

    let poll: Poll | undefined;
    if (showPollCreator && pollQuestion.trim()) {
      const validOptions = pollOptions.filter(o => o.trim().length > 0);
      if (validOptions.length < 2) {
        sweetAlert.error('Invalid Poll', 'Please add at least 2 poll options');
        return;
      }
      poll = {
        question: pollQuestion.trim(),
        options: validOptions.map((text, idx) => ({ id: `opt_${idx}`, text: text.trim(), votes: 0 })),
        totalVotes: 0,
        hasVoted: false,
      };
    }

    setIsPosting(true);
    setPostProgress(0);
    setPostStatus('Starting...');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const progressPromise = simulateProgress();

      await createPost(content.trim(), selectedTopic.id, images, isAnonymous, selectedMood, poll);

      await progressPromise;

      await AsyncStorage.removeItem('post_draft');

      sweetAlert.success('Posted!', 'Your post has been created successfully.');

      setTimeout(() => {
        setIsPosting(false);
        navigation.goBack();
      }, 500);

    } catch (error) {
      setIsPosting(false);
      setPostProgress(0);
      sweetAlert.error('Post Failed', 'Failed to create post. Please try again.');
    }
  };

  const handleCancel = () => {
    if (content.trim() || images.length > 0 || pollQuestion.trim()) {
      sweetAlert.confirm(
        'Discard Post?',
        'You have unsaved changes. Are you sure you want to discard them?',
        () => navigation.goBack(),
        () => {},
        'Discard',
        'Keep Editing'
      );
    } else {
      navigation.goBack();
    }
  };

  const handleCountrySelect = async (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country.name);
    await updateUserLocation(country.name);
    setShowCountryPicker(false);
    sweetAlert.toast('Location Updated', 'Set to ${country.flag} ${country.name}', 'success');
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
    sweetAlert.toast('Topics Updated', 'Your feed preferences have been saved', 'success');
  };

  const handleMoodSelect = (mood: PostMood) => {
    setSelectedMood(mood);
    setShowMoodPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const updatePollOption = (index: number, text: string) => {
    const updated = [...pollOptions];
    updated[index] = text;
    setPollOptions(updated);
  };

  const characterCount = content.length;
  const maxCharacters = 1000;
  const hasContent = content.trim().length > 0 || images.length > 0 || pollQuestion.trim().length > 0;

  const getFilteredTopics = () => {
    if (!userSelectedTopics || userSelectedTopics.length === 0) return topics;
    return topics.filter(t => userSelectedTopics.includes(t.id));
  };

  const filteredTopics = getFilteredTopics();

  const avatarSource = isAnonymous 
    ? '🎭' 
    : (currentUser?.avatar || currentUser?.photoURL || undefined);

  const selectedMoodConfig = selectedMood ? MOODS.find(m => m.value === selectedMood) : null;

  if (!topicsLoaded || topics.length === 0 || !selectedTopic) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#f8f9ff', '#fff5f8']} style={StyleSheet.absoluteFill} />
        <CommunitySpinner 
          visible={true} 
          text="Loading topics..." 
          size="medium"
          overlay={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f8f9ff', '#fff5f8']} style={StyleSheet.absoluteFill} />

      {/* Posting Progress Overlay - UniversalSpinner */}
      <CommunitySpinner
        visible={isPosting}
        text={postStatus}
        subtext={images.length > 0 ? `${images.length} image${images.length > 1 ? 's' : ''}` : undefined}
        size="large"
        overlay={true}
        blur={true}
        showProgress={true}
        progress={postProgress}
        variant="liquid"
      />

      {/* Image Processing Spinner */}
      <CommunitySpinner
        visible={isProcessingImages}
        text="Processing images..."
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
          <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={CommunityColors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <TouchableOpacity 
            style={[styles.postButton, hasContent && styles.postButtonActive]}
            disabled={!hasContent || isPosting}
            onPress={handlePost}
          >
            {isPosting ? (
              <InlineSpinner size={20} color="#fff" section="community" variant="liquid" />
            ) : (
              <Text style={[styles.postButtonText, hasContent && styles.postButtonTextActive]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Animated.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Author Card - with SafeAvatar */}
          <Animated.View entering={FadeInUp.duration(400)}>
            <View style={styles.authorCard}>
              <View style={styles.authorRow}>
                <SafeAvatar
                  avatar={avatarSource}
                  size={48}
                  fallbackIcon={isAnonymous ? 'mask' : 'person'}
                  fallbackColor={selectedTopic?.color || '#667eea'}
                  borderWidth={2}
                  borderColor="#fff"
                  showEditBadge={false}
                  animated={true}
                />
                
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>
                    {isAnonymous ? 'Anonymous' : (currentUser?.displayName || 'You')}
                  </Text>
                  <View style={styles.authorMeta}>
                    <View style={[styles.topicBadge, { backgroundColor: (selectedTopic?.color || '#667eea') + '15' }]}>
                      <Text style={styles.topicBadgeEmoji}>{selectedTopic?.emoji}</Text>
                      <Text style={[styles.topicBadgeText, { color: selectedTopic?.color || '#667eea' }]}>
                        {selectedTopic?.name}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.locationChip}
                      onPress={() => setShowCountryPicker(true)}
                    >
                      <Ionicons name="location-outline" size={12} color="#667eea" />
                      <Text style={styles.locationChipText}>
                        {selectedCountry || 'Add location'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.anonToggle}
                  onPress={() => setIsAnonymous(!isAnonymous)}
                >
                  <Ionicons 
                    name={isAnonymous ? "eye-off" : "eye-outline"} 
                    size={20} 
                    color={isAnonymous ? '#667eea' : CommunityColors.text.tertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Mood Selector */}
          <Animated.View entering={FadeInUp.delay(30).duration(400)}>
            <View style={styles.moodSection}>
              <Text style={styles.sectionLabel}>How are you feeling?</Text>
              <View style={styles.moodRow}>
                {MOODS.map((mood) => (
                  <TouchableOpacity
                    key={mood.value}
                    style={[
                      styles.moodPill,
                      selectedMood === mood.value && { 
                        backgroundColor: mood.bgColor,
                        borderColor: mood.color,
                      },
                    ]}
                    onPress={() => {
                      if (selectedMood === mood.value) {
                        setSelectedMood(undefined);
                      } else {
                        setSelectedMood(mood.value);
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.moodPillEmoji}>{mood.emoji}</Text>
                    <Text style={[
                      styles.moodPillLabel,
                      selectedMood === mood.value && { color: mood.color, fontWeight: '800' },
                    ]}>
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Content Input */}
          <Animated.View entering={FadeInUp.delay(50).duration(400)}>
            <View style={styles.contentArea}>
              <TextInput
                style={styles.textInput}
                placeholder="What's on your mind? Share your experience, ask a question, or offer support..."
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
            </View>
          </Animated.View>

          {/* Image Grid Preview - MODERN STYLE */}
          {images.length > 0 && (
            <Animated.View entering={FadeInUp.duration(300)}>
              <ImageGrid images={images} onRemove={removeImage} />
            </Animated.View>
          )}

          {/* Poll Creator */}
          {showPollCreator && (
            <Animated.View entering={FadeInUp.duration(300)}>
              <View style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <View style={styles.pollHeaderLeft}>
                    <Ionicons name="stats-chart" size={18} color="#667eea" />
                    <Text style={styles.pollTitle}>Poll</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setShowPollCreator(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                  }}>
                    <Ionicons name="close" size={20} color={CommunityColors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.pollQuestionInput}
                  placeholder="Ask a question..."
                  placeholderTextColor={CommunityColors.text.tertiary}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  maxLength={200}
                />
                
                <View style={styles.pollOptionsList}>
                  {pollOptions.map((option, index) => (
                    <View key={index} style={styles.pollOptionRow}>
                      <View style={styles.pollOptionInputWrap}>
                        <Text style={styles.pollOptionBullet}>{String.fromCharCode(65 + index)}</Text>
                        <TextInput
                          style={styles.pollOptionInput}
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor={CommunityColors.text.tertiary}
                          value={option}
                          onChangeText={(text) => updatePollOption(index, text)}
                          maxLength={100}
                        />
                      </View>
                      {pollOptions.length > 2 && (
                        <TouchableOpacity 
                          style={styles.pollOptionRemove}
                          onPress={() => removePollOption(index)}
                        >
                          <Ionicons name="close-circle" size={22} color="#fc5c7d" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                
                {pollOptions.length < 4 && (
                  <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                    <Ionicons name="add-circle-outline" size={18} color="#667eea" />
                    <Text style={styles.addOptionText}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}

          {/* Topics Strip */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View style={styles.topicsStripHeader}>
              <Text style={styles.sectionLabel}>Your Topics</Text>
              <TouchableOpacity 
                style={styles.manageTopicsBtn}
                onPress={() => setShowTopicSelector(true)}
              >
                <Ionicons name="options-outline" size={14} color="#667eea" />
                <Text style={styles.manageTopicsText}>Manage</Text>
              </TouchableOpacity>
            </View>

            {filteredTopics.length > 0 ? (
              <Animated.ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicsStrip}
              >
                {filteredTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.topicPill,
                      selectedTopic?.id === topic.id && { 
                        backgroundColor: topic.color + '20',
                        borderColor: topic.color,
                      },
                    ]}
                    onPress={() => {
                      setSelectedTopic(topic);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.topicPillEmoji}>{topic.emoji}</Text>
                    <Text style={[
                      styles.topicPillName,
                      selectedTopic?.id === topic.id && { color: topic.color, fontWeight: '800' },
                    ]}>
                      {topic.name}
                    </Text>
                    {selectedTopic?.id === topic.id && (
                      <Ionicons name="checkmark-circle" size={14} color={topic.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </Animated.ScrollView>
            ) : (
              <TouchableOpacity 
                style={styles.noTopicsBanner}
                onPress={() => setShowTopicSelector(true)}
              >
                <LinearGradient
                  colors={['#667eea12', '#667eea04']}
                  style={styles.noTopicsGradient}
                >
                  <Ionicons name="bookmark-outline" size={22} color="#667eea" />
                  <Text style={styles.noTopicsTitle}>No topics selected yet</Text>
                  <Text style={styles.noTopicsSubtext}>
                    Tap here to choose topics you're interested in
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Media Tools */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.toolsSection}>
            <Text style={styles.toolsLabel}>Add to your post</Text>
            <View style={styles.toolsRow}>
              <ToolButton 
                icon="image-outline" 
                label="Gallery" 
                color="#667eea" 
                bgColor="#667eea12"
                onPress={pickImage}
                badge={images.length > 0 ? images.length : undefined}
              />
              <ToolButton 
                icon="camera-outline" 
                label="Camera" 
                color="#43e97b" 
                bgColor="#43e97b12"
                onPress={takePhoto}
              />
              <ToolButton 
                icon="stats-chart-outline" 
                label="Poll" 
                color="#fa709a" 
                bgColor="#fa709a12"
                onPress={() => {
                  setShowPollCreator(!showPollCreator);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                badge={showPollCreator ? 1 : undefined}
              />
            </View>
          </Animated.View>

          {/* Tips Card */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.tipsContainer}>
            <LinearGradient 
              colors={['#667eea10', '#667eea02']}
              style={styles.tipsGradient}
            >
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={18} color="#667eea" />
                <Text style={styles.tipsTitle}>Tips for great posts</Text>
              </View>
              <View style={styles.tipsList}>
                <View style={styles.tipItem}>
                  <View style={[styles.tipDot, { backgroundColor: '#667eea' }]} />
                  <Text style={styles.tipText}>Be kind and supportive</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={[styles.tipDot, { backgroundColor: '#43e97b' }]} />
                  <Text style={styles.tipText}>Share specific details</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={[styles.tipDot, { backgroundColor: '#fa709a' }]} />
                  <Text style={styles.tipText}>Use photos to tell your story</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={[styles.tipDot, { backgroundColor: '#4facfe' }]} />
                  <Text style={styles.tipText}>Ask questions to engage others</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.ScrollView>
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
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={CommunityColors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
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
                    <Ionicons name="checkmark" size={20} color="#667eea" />
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
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.95)']}
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
                          backgroundColor: topic.color + '15',
                        },
                        isMaxReached && styles.topicGridItemDisabled
                      ]}
                      onPress={() => {
                        if (isMaxReached) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          sweetAlert.warning('Maximum Topics Reached', 'You can select up to 5 topics. Remove one to add another.');
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
                        isSelected && { color: topic.color, fontWeight: '800' },
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
                  colors={['#667eea', '#764ba2']}
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
  container: { 
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  keyboardView: { 
    flex: 1 
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...CommunityShadows.small,
  },
  title: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: CommunityColors.text.primary 
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#667eea15',
  },
  postButtonActive: { 
    backgroundColor: '#667eea',
    ...CommunityShadows.medium,
  },
  postButtonText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: CommunityColors.text.tertiary 
  },
  postButtonTextActive: { 
    color: 'white' 
  },

  authorCard: {
    marginHorizontal: CommunitySpacing.lg,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: CommunityBorderRadius.xl,
    padding: 16,
    backgroundColor: '#fff',
    ...CommunityShadows.medium,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorInfo: { 
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 6,
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topicBadgeEmoji: { 
    fontSize: 12 
  },
  topicBadgeText: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f0f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  anonToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  moodSection: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
    ...CommunityShadows.small,
  },
  moodPillEmoji: {
    fontSize: 16,
  },
  moodPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },

  contentArea: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
  },
  textInput: {
    fontSize: 17,
    color: CommunityColors.text.primary,
    lineHeight: 26,
    minHeight: 120,
    paddingVertical: 8,
  },
  characterCount: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '600',
  },

  imageGridWrapper: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
  },
  singleImageContainer: {
    position: 'relative',
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  singleImage: {
    width: '100%',
    height: 240,
    borderRadius: CommunityBorderRadius.xl,
  },
  multiImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImageItem: {
    width: (SCREEN_WIDTH - CommunitySpacing.lg * 2 - 4) / 2,
    height: (SCREEN_WIDTH - CommunitySpacing.lg * 2 - 4) / 2,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...CommunityShadows.small,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  imageRemoveInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CommunityBorderRadius.lg,
  },
  gridMoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },

  pollCard: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
    borderRadius: CommunityBorderRadius.xl,
    padding: 16,
    backgroundColor: '#fff',
    ...CommunityShadows.medium,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pollHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  pollQuestionInput: {
    fontSize: 16,
    color: CommunityColors.text.primary,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f8f9ff',
    borderRadius: CommunityBorderRadius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e5',
  },
  pollOptionsList: {
    gap: 10,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollOptionInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    borderRadius: CommunityBorderRadius.lg,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e5',
  },
  pollOptionBullet: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    width: 24,
  },
  pollOptionInput: {
    flex: 1,
    fontSize: 14,
    color: CommunityColors.text.primary,
    paddingVertical: 10,
  },
  pollOptionRemove: {
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#667eea08',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
  },

  topicsStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.lg,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: CommunityColors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  manageTopicsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#667eea08',
    borderRadius: 12,
  },
  manageTopicsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
  },
  topicsStrip: {
    paddingHorizontal: CommunitySpacing.md,
    gap: 10,
    paddingBottom: 4,
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
    ...CommunityShadows.small,
  },
  topicPillEmoji: { 
    fontSize: 16 
  },
  topicPillName: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: CommunityColors.text.secondary 
  },

  noTopicsBanner: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 16,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.medium,
  },
  noTopicsGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  noTopicsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  noTopicsSubtext: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
  },

  toolsSection: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 20,
  },
  toolsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: CommunityColors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toolButton: { 
    alignItems: 'center', 
    gap: 6 
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  toolBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f8f9ff',
  },
  toolBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  toolText: { 
    fontSize: 12, 
    color: CommunityColors.text.secondary, 
    fontWeight: '600' 
  },

  tipsContainer: {
    marginHorizontal: CommunitySpacing.lg,
    marginBottom: 24,
    borderRadius: CommunityBorderRadius.xl,
    overflow: 'hidden',
    ...CommunityShadows.small,
  },
  tipsGradient: {
    padding: 20,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  tipsTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#667eea' 
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tipText: { 
    fontSize: 13, 
    color: CommunityColors.text.secondary, 
    fontWeight: '500' 
  },

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
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: CommunityColors.text.primary 
  },
  modalSubtitle: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  countryList: { 
    maxHeight: 400 
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  countryItemSelected: { 
    backgroundColor: '#667eea10' 
  },
  countryFlag: { 
    fontSize: 24 
  },
  countryName: { 
    flex: 1, 
        fontSize: 16,
    color: CommunityColors.text.primary,
  },
  countryNameSelected: { 
    color: '#667eea', 
    fontWeight: '700' 
  },

  topicCounter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 16,
    textAlign: 'center',
  },
  topicList: { 
    maxHeight: 500 
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  topicGridItem: {
    width: (SCREEN_WIDTH - 72) / 2,
    padding: 16,
    borderRadius: CommunityBorderRadius.xl,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 8,
    ...CommunityShadows.small,
  },
  topicGridItemDisabled: {
    opacity: 0.4,
  },
  topicGridEmoji: { 
    fontSize: 32 
  },
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
    borderTopColor: '#e0e0e5',
  },
  topicSelectorDoneButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...CommunityShadows.medium,
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
