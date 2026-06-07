import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, Pressable, Modal, Platform, TextInput, ActivityIndicator, StatusBar  } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, FadeInDown, FadeOut, FadeOutDown, Layout, useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolate, runOnJS, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LittleLoomAvatar, BabyAvatar, SkinTonePicker, BABY_EMOJIS, ALL_EMOJIS, ILLUSTRATION_AVATARS, GRADIENT_PRESETS, GENDER_CONFIG, SKIN_TONES, type BabyGender, type AvatarSize } from './LittleLoomAvatars';
﻿/**
 * LittleLoom Avatar Picker Screen v2
 * Premium full-screen avatar selection with glassmorphism,
 * animated transitions, and 5 picker modes
 */


const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type PickerTab = 'photo' | 'emoji' | 'illustration' | 'gradient' | 'letter';

interface AvatarPickerScreenProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (avatar: string, type: 'photo' | 'emoji' | 'gradient' | 'letter') => void;
  currentAvatar?: string | null;
  currentName?: string;
  gender?: BabyGender;
  currentSkinTone?: number;
  onSkinToneChange?: (tone: number) => void;
}

const TABS: { id: PickerTab; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { id: 'photo', icon: 'camera', label: 'Photo', color: '#667eea' },
  { id: 'emoji', icon: 'happy-outline', label: 'Emoji', color: '#f59e0b' },
  { id: 'illustration', icon: 'image-outline', label: 'Art', color: '#ec4899' },
  { id: 'gradient', icon: 'color-palette-outline', label: 'Color', color: '#10b981' },
  { id: 'letter', icon: 'text-outline', label: 'Letter', color: '#8b5cf6' },
];

const GlassCard: React.FC<{ children: React.ReactNode; style?: any; delay?: number }> = ({
  children,
  style,
  delay = 0,
}) => (
  <Animated.View entering={FadeInUp.delay(delay)} layout={Layout.springify()} style={[styles.glassCard, style]}>
    <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="light" />
    <LinearGradient
      colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
    <View style={styles.glassBorder} />
    <View style={styles.glassContent}>{children}</View>
  </Animated.View>
);

const SectionHeader: React.FC<{ title: string; icon: string; color?: string }> = ({
  title,
  icon,
  color = '#667eea',
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  </View>
);

export const AvatarPickerScreen: React.FC<AvatarPickerScreenProps> = ({
  visible,
  onClose,
  onSelect,
  currentAvatar,
  currentName = 'Baby',
  gender = 'other',
  currentSkinTone = 2,
  onSkinToneChange,
}) => {
  const [activeTab, setActiveTab] = useState<PickerTab>('emoji');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar);
  const [selectedSkinTone, setSelectedSkinTone] = useState(currentSkinTone);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const insets = useSafeAreaInsets();
  const genderConfig = GENDER_CONFIG[gender];
  const scrollY = useSharedValue(0);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP),
  }));

  useEffect(() => {
    if (visible) {
      setSelectedAvatar(currentAvatar);
      setSelectedSkinTone(currentSkinTone);
      setActiveTab('emoji');
      setSearchQuery('');
      setShowSearch(false);
    }
  }, [visible, currentAvatar, currentSkinTone]);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const dir = FileSystem.documentDirectory + 'baby_images/';
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        const permanentUri = `${dir}avatar_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });

        setSelectedAvatar(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setIsUploading(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const dir = FileSystem.documentDirectory + 'baby_images/';
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        const permanentUri = `${dir}avatar_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });

        setSelectedAvatar(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
      setIsUploading(false);
    }
  };

  const handleSelect = useCallback(() => {
    if (!selectedAvatar) return;

    let type: 'photo' | 'emoji' | 'gradient' | 'letter' = 'emoji';
    if (selectedAvatar.startsWith('file://') || selectedAvatar.startsWith('http')) {
      type = 'photo';
    } else if (selectedAvatar === 'letter') {
      type = 'letter';
    } else if (GRADIENT_PRESETS[selectedAvatar]) {
      type = 'gradient';
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(selectedAvatar, type);
    onSkinToneChange?.(selectedSkinTone);
    onClose();
  }, [selectedAvatar, selectedSkinTone, onSelect, onSkinToneChange, onClose]);

  const handleAvatarPress = (avatar: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAvatar(avatar);
  };

  const filteredEmojis = useCallback(() => {
    if (!searchQuery.trim()) return BABY_EMOJIS;
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, string[]> = {};
    Object.entries(BABY_EMOJIS).forEach(([category, emojis]) => {
      const matched = emojis.filter((emoji) => {
        return emoji.includes(query) || category.toLowerCase().includes(query);
      });
      if (matched.length > 0) filtered[category] = matched;
    });
    return filtered;
  }, [searchQuery]);

  const renderPhotoTab = () => (
    <View style={styles.tabPanel}>
      <SectionHeader title="Take or Choose" icon="camera" color="#667eea" />

      <View style={styles.photoGrid}>
        <TouchableOpacity style={styles.photoCard} onPress={handleTakePhoto} activeOpacity={0.8}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.photoGradient}>
            <View style={styles.photoIconBg}>
              <Ionicons name="camera" size={32} color="#fff" />
            </View>
            <Text style={styles.photoCardTitle}>Camera</Text>
            <Text style={styles.photoCardSub}>Take a new photo</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.photoCard} onPress={handlePickPhoto} activeOpacity={0.8}>
          <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.photoGradient}>
            <View style={styles.photoIconBg}>
              <Ionicons name="images" size={32} color="#fff" />
            </View>
            <Text style={styles.photoCardTitle}>Gallery</Text>
            <Text style={styles.photoCardSub}>Pick from library</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {isUploading && (
        <GlassCard style={styles.uploadingCard} delay={100}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.uploadingText}>Saving photo...</Text>
        </GlassCard>
      )}

      {selectedAvatar && (selectedAvatar.startsWith('file://') || selectedAvatar.startsWith('http')) && (
        <>
          <SectionHeader title="Preview" icon="eye" color="#10b981" />
          <GlassCard delay={150}>
            <Image source={{ uri: selectedAvatar }} style={styles.photoPreview} />
          </GlassCard>
        </>
      )}
    </View>
  );

  const renderEmojiTab = () => {
    const emojis = filteredEmojis();
    const hasResults = Object.keys(emojis).length > 0;

    return (
      <View style={styles.tabPanel}>
        {/* Search Bar */}
        <GlassCard style={styles.searchCard} delay={0}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search emojis..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {!hasResults ? (
          <GlassCard style={styles.emptyCard} delay={100}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="search-outline" size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No emojis found</Text>
            <Text style={styles.emptyText}>Try a different search term</Text>
          </GlassCard>
        ) : (
          Object.entries(emojis).map(([category, items], catIndex) => (
            <Animated.View
              key={category}
              entering={FadeInUp.delay(catIndex * 80)}
              layout={Layout.springify()}
            >
              <SectionHeader
                title={category.charAt(0).toUpperCase() + category.slice(1)}
                icon="grid-outline"
                color={genderConfig.defaultColor}
              />
              <View style={styles.emojiGrid}>
                {items.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      selectedAvatar === emoji && [
                        styles.emojiOptionSelected,
                        {
                          borderColor: genderConfig.defaultColor,
                          backgroundColor: `${genderConfig.defaultColor }18`,
                        },
                      ],
                    ]}
                    onPress={() => handleAvatarPress(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          ))
        )}
      </View>
    );
  };

  const renderIllustrationTab = () => (
    <View style={styles.tabPanel}>
      {/* Baby Characters */}
      <SectionHeader title="Baby Characters" icon="body" color={genderConfig.defaultColor} />
      <View style={styles.illustrationGrid}>
        {genderConfig.illustrations.map((url, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.illustrationOption,
              selectedAvatar === url && [
                styles.illustrationOptionSelected,
                { borderColor: genderConfig.defaultColor },
              ],
            ]}
            onPress={() => handleAvatarPress(url)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: url }} style={styles.illustrationImage} />
            {selectedAvatar === url && (
              <View style={[styles.illustrationCheck, { backgroundColor: genderConfig.defaultColor }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Animals */}
      <SectionHeader title="Cute Animals" icon="paw" color="#f59e0b" />
      <View style={styles.illustrationGrid}>
        {Object.entries(ILLUSTRATION_AVATARS.animal).map(([key, url]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.illustrationOption,
              selectedAvatar === url && [
                styles.illustrationOptionSelected,
                { borderColor: '#f59e0b' },
              ],
            ]}
            onPress={() => handleAvatarPress(url)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: url }} style={styles.illustrationImage} />
            {selectedAvatar === url && (
              <View style={[styles.illustrationCheck, { backgroundColor: '#f59e0b' }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Baby Items */}
      <SectionHeader title="Baby Items" icon="cube" color="#ec4899" />
      <View style={styles.illustrationGrid}>
        {Object.entries(ILLUSTRATION_AVATARS.object).map(([key, url]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.illustrationOption,
              selectedAvatar === url && [
                styles.illustrationOptionSelected,
                { borderColor: '#ec4899' },
              ],
            ]}
            onPress={() => handleAvatarPress(url)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: url }} style={styles.illustrationImage} />
            {selectedAvatar === url && (
              <View style={[styles.illustrationCheck, { backgroundColor: '#ec4899' }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGradientTab = () => (
    <View style={styles.tabPanel}>
      <SectionHeader title="Color Themes" icon="color-palette" color="#10b981" />
      <View style={styles.gradientGrid}>
        {Object.entries(GRADIENT_PRESETS).map(([key, colors], index) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.gradientOption,
              selectedAvatar === key && [
                styles.gradientOptionSelected,
                { borderColor: colors[0]},
              ],
            ]}
            onPress={() => handleAvatarPress(key)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors}
              style={styles.gradientPreview}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="person" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.gradientName}>
              {key
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}
            </Text>
            {selectedAvatar === key && (
              <View style={[styles.gradientCheck, { backgroundColor: colors[0]}]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLetterTab = () => (
    <View style={styles.tabPanel}>
      <GlassCard delay={0}>
        <View style={styles.letterPreviewSection}>
          <LittleLoomAvatar
            source={null}
            name={currentName}
            size="xxl"
            gender={gender}
            borderWidth={4}
            borderColor="#fff"
            shadow={true}
            animated={true}
          />
          <Text style={styles.letterName}>{currentName}</Text>
          <Text style={styles.letterHint}>Uses the first letter as avatar</Text>
        </View>
      </GlassCard>

      <TouchableOpacity
        style={styles.letterSelectBtn}
        onPress={() => handleAvatarPress('letter')}
        activeOpacity={0.8}
      >
        <LinearGradient colors={genderConfig.defaultGradient} style={styles.letterSelectGradient}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.letterSelectText}>Use Initial Letter</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  const isPhotoSelected = selectedAvatar && (selectedAvatar.startsWith('file://') || selectedAvatar.startsWith('http'));
  const canConfirm = !!selectedAvatar;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* Background Gradient */}
        <LinearGradient
          colors={['#f8fafc', '#e2e8f0', '#dbeafe']}
          style={StyleSheet.absoluteFill}
        />

        {/* Sticky Header */}
        <Animated.View style={[styles.stickyHeader, headerOpacity, { paddingTop: insets.top }]}>
          <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="light" />
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(248,250,252,0.8)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stickyHeaderContent}>
            <TouchableOpacity onPress={onClose} style={styles.stickyBtn}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.stickyTitle}>Choose Avatar</Text>
            <View style={styles.stickyBtn} />
          </View>
        </Animated.View>

        {/* Main Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <BlurView intensity={80} style={styles.headerBlur}>
              <Ionicons name="arrow-back" size={22} color="#1e293b" />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Choose Avatar</Text>
            <Text style={styles.headerSubtitle}>for {currentName}</Text>
          </View>

          <TouchableOpacity
            onPress={handleSelect}
            style={[styles.headerBtn, !canConfirm && styles.headerBtnDisabled]}
            disabled={!canConfirm}
          >
            <BlurView intensity={80} style={[styles.headerBlur, styles.saveBlur]}>
              <Text style={[styles.saveText, !canConfirm && styles.saveTextDisabled]}>Done</Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Preview Section */}
        <View style={styles.previewSection}>
          <View style={styles.previewContainer}>
            <LittleLoomAvatar
              source={selectedAvatar === 'letter' ? null : selectedAvatar}
              name={selectedAvatar === 'letter' ? currentName : undefined}
              size="xxl"
              gender={gender}
              skinTone={selectedSkinTone}
              borderWidth={4}
              borderColor="#fff"
              shadow={true}
              animated={true}
            />
          </View>

          {/* Skin Tone */}
          {activeTab !== 'gradient' && activeTab !== 'letter' && (
            <View style={styles.skinToneSection}>
              <View style={styles.skinToneHeader}>
                <Ionicons name="color-fill-outline" size={14} color="#94a3b8" />
                <Text style={styles.skinToneLabel}>Skin Tone</Text>
                <Text style={styles.skinToneValue}>{SKIN_TONES[selectedSkinTone]?.label}</Text>
              </View>
              <SkinTonePicker
                selected={selectedSkinTone}
                onSelect={(tone) => {
                  setSelectedSkinTone(tone);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                size={36}
              />
            </View>
          )}
        </View>

        {/* Tabs Bar */}
        <View style={styles.tabsBar}>
          <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="light" />
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tab,
                    isActive && {
                      backgroundColor: `$${tab.color }18,
                      borderColor: tab.color,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon}
                    size={20}
                    color={isActive ? tab.color : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      isActive && { color: tab.color, fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content */}
        <AnimatedScrollView
          contentContainerstyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollY.value = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {activeTab === 'photo' && renderPhotoTab()}
          {activeTab === 'emoji' && renderEmojiTab()}
          {activeTab === 'illustration' && renderIllustrationTab()}
          {activeTab === 'gradient' && renderGradientTab()}
          {activeTab === 'letter' && renderLetterTab()}
        </AnimatedScrollView>

        {/* Bottom Confirm Bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleSelect}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={canConfirm ? genderConfig.defaultGradient : ['#cbd5e1', '#94a3b8']}
              style={styles.confirmGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.confirmText}>
                {canConfirm ? 'Use This Avatar' : 'Select an Avatar'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
  },
  stickyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerBtnDisabled: {
    opacity: 0.4,
  },
  headerBlur: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  saveBlur: {
    width: 66,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  saveText: {
    color: '#667eea',
    fontWeight: '700',
    fontSize: 15,
  },
  saveTextDisabled: {
    color: '#94a3b8',
  },

  previewSection: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  previewContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
  },
  skinToneSection: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  skinToneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skinToneLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skinToneValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4,
  },

  tabsBar: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  tabsScroll: {
    padding: 4,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tabPanel: {
    gap: 16,
    paddingBottom: 20,
  },

  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: {
    padding: 16,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },

  photoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  photoGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  photoIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  photoCardSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  uploadingCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },

  searchCard: {
    marginBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    paddingVertical: 4,
  },

  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
  },
  emojiOption: {
    width: (width - 72) / 6,
    height: (width - 72) / 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  emojiOptionSelected: {
    transform: [{ scale: 1.12 }],
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  emojiText: {
    fontSize: 28,
  },

  illustrationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
  },
  illustrationOption: {
    width: (width - 80) / 4,
    height: (width - 80) / 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
    position: 'relative',
  },
  illustrationOptionSelected: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
  },
  illustrationImage: {
    width: '72%',
    height: '72%',
  },
  illustrationCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  gradientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
  },
  gradientOption: {
    width: (width - 68) / 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
    position: 'relative',
  },
  gradientOptionSelected: {
    transform: [{ scale: 1.03 }],
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
  },
  gradientPreview: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  gradientCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  letterPreviewSection: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
  },
  letterName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  letterHint: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  letterSelectBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 8,
  },
  letterSelectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  letterSelectText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(148,163,184,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#64748b',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  confirmBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  confirmText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

export default AvatarPickerScreen;