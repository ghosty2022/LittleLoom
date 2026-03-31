// src/screens/community/CreatePostScreen.tsx
import React, { useState, useCallback } from 'react';
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
import { useCommunity } from '../../context/CommunityContext';
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
  const { topicId } = route.params || {};
  const { topics, createPost, currentUser, updateUserLocation } = useCommunity();
  const { communityProfile } = useUser();
  
  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(
    topics.find(t => t.id === topicId) || topics[0]
  );
  const [images, setImages] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(currentUser?.country || '');

  const pickImage = async () => {
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
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, 4));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const characterCount = content.length;
  const maxCharacters = 1000;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header - Themed */}
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
          {/* Topic Selector - Themed */}
          <Animated.View entering={FadeInUp}>
            <Text style={styles.sectionLabel}>Select Topic</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsContainer}
            >
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  style={[
                    styles.topicChip,
                    selectedTopic.id === topic.id && { 
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
                    selectedTopic.id === topic.id && { color: topic.color, fontWeight: '800' }
                  ]}>
                    {topic.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Content Input - Themed */}
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
                    <Text style={styles.inputTopic}>Posting in {selectedTopic.name}</Text>
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
            </BlurView>
          </Animated.View>

          {/* Image Preview - Themed */}
          {images.length > 0 && (
            <Animated.View entering={FadeInUp} style={styles.imagesContainer}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeImage}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Tools - Themed with Community Colors */}
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

          {/* Options - Themed */}
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

          {/* Tips - Themed */}
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

      {/* Country Picker Modal - Themed */}
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginLeft: CommunitySpacing.lg,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CommunitySpacing.lg,
    gap: 12,
    marginBottom: 16,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: CommunityBorderRadius.lg,
    overflow: 'hidden',
    ...CommunityShadows.sm,
  },
  previewImage: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
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
});

