import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

import { useTracker } from '../../context/TrackerContext';

const { width } = Dimensions.get('window');

type CreateTrackerNavProp = NativeStackNavigationProp<RootStackParamList>;

const EMOJI_CATEGORIES = [
  {
    title: 'Care',
    emojis: ['🍼', '💧', '🚽', '🛁', '💊', '🤱', '👶', '🧴', '🪥', '🧷'],
  },
  {
    title: 'Sleep',
    emojis: ['🌙', '😴', '🛏️', '💤', '⭐', '🌛', '🌜', '☁️', '🌧️', '☀️'],
  },
  {
    title: 'Development',
    emojis: ['📏', '🏆', '📚', '🎨', '🎵', '🧸', '🎓', '🔤', '🔢', '🧩'],
  },
  {
    title: 'Activities',
    emojis: ['🚗', '🏠', '🐶', '🌳', '🍎', '🥕', '🍌', '🥦', '🍓', '🍇'],
  },
  {
    title: 'Health',
    emojis: ['🌡️', '❤️', '🩹', '🏥', '🩺', '💪', '🧠', '👀', '👂', '🦷'],
  },
  {
    title: 'Mood',
    emojis: ['😭', '😟', '😐', '🙂', '😄', '🥰', '😤', '😴', '🤢', '🤒'],
  },
];

const COLORS = [
  '#667eea', '#fa709a', '#11998e', '#43e97b', '#ffd700',
  '#ff6b6b', '#4facfe', '#00f2fe', '#f093fb', '#f5576c',
  '#5ee7df', '#b490ca', '#a8edea', '#fed6e3', '#d299c2',
  '#ff9a9e', '#a18cd1', '#fbc2eb', '#8fd3f4', '#84fab0',
];

const PRESET_UNITS = ['minutes', 'hours', 'oz', 'ml', 'grams', 'lbs', 'kg', 'cm', 'inches', 'steps', 'times', '°C', '°F'];

const SectionHeader: React.FC<{ title: string; subtitle?: string; delay?: number; colors: any }> = ({
  title, subtitle, delay = 0, colors
}) => (
  <Animated.View entering={FadeInUp.delay(delay)} style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    {subtitle && <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
  </Animated.View>
);

const ColorButton: React.FC<{
  color: string;
  isSelected: boolean;
  isDark: boolean;
  onPress: () => void;
}> = ({ color, isSelected, isDark, onPress }) => {
  const scale = useSharedValue(1);
  
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        scale.value = withSpring(0.85, { damping: 15 }, () => {
          scale.value = withSpring(1, { damping: 12 });
        });
        onPress();
      }}
    >
      <Animated.View style={[
        styles.colorButton,
        { backgroundColor: color },
        isSelected && {
          borderWidth: 3,
          borderColor: isDark ? '#fff' : '#1a1a1a',
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        },
        animStyle,
      ]}>
        {isSelected && (
          <Ionicons name="checkmark" size={18} color="#fff" style={styles.colorCheck} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const UnitChip: React.FC<{
  unit: string;
  isSelected: boolean;
  color: string;
  surfaceColor: string;
  borderColor: string;
  onPress: () => void;
}> = ({ unit, isSelected, color, surfaceColor, borderColor, onPress }) => (
  <TouchableOpacity
    style={[
      styles.unitChip,
      {
        backgroundColor: isSelected ? `${color}18` : surfaceColor,
        borderColor: isSelected ? color : borderColor,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[
      styles.unitChipText,
      { color: isSelected ? color : borderColor },
      isSelected && { fontWeight: '700' },
    ]}>
      {unit}
    </Text>
    {isSelected && <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginLeft: 4 }} />}
  </TouchableOpacity>
);

export default function CreateCustomTrackerScreen() {
  const navigation = useNavigation<CreateTrackerNavProp>();
  const insets = useSafeAreaInsets();
  const { addCustomTracker } = useTracker();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    borderRadiusValue,
    triggerHaptic,
    fontSizeMultiplier,
  } = useCustomization();

  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍼');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [unit, setUnit] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewScale = useSharedValue(1);
  const previewAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
  }));

  const finalUnit = unit === 'custom' ? customUnit : unit;

  const isValid = useMemo(() => {
    return name.trim().length >= 2 && name.trim().length <= 30;
  }, [name]);

  const handleCreate = useCallback(async () => {
    if (!isValid) {
      triggerHaptic('warning');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('success');

    const trackerConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      gradient: [selectedColor, selectedColor + 'dd'] as [string, string],
      description: description.trim() || `Custom ${name.trim()} tracker`,
      unit: finalUnit || undefined,
      isCustom: true,
      fields: [
        {
          id: 'value',
          type: 'number',
          label: finalUnit ? `Amount (${finalUnit})` : 'Value',
          placeholder: 'Enter value...',
          required: false,
        },
        {
          id: 'notes',
          type: 'textarea',
          label: 'Notes',
          placeholder: 'Any additional details...',
          required: false,
        },
      ],
      quickTags: ['Morning', 'Afternoon', 'Evening', 'Night'],
    };

    await new Promise(resolve => setTimeout(resolve, 400));
    
    addCustomTracker?.(trackerConfig);
    navigation.goBack();
  }, [name, selectedEmoji, selectedColor, description, finalUnit, isValid, triggerHaptic, addCustomTracker, navigation]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    triggerHaptic('light');
    setSelectedEmoji(emoji);
    previewScale.value = withSpring(1.15, { damping: 10 }, () => {
      previewScale.value = withSpring(1, { damping: 12 });
    });
  }, [triggerHaptic, previewScale]);

  const handleColorSelect = useCallback((color: string) => {
    triggerHaptic('light');
    setSelectedColor(color);
  }, [triggerHaptic]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <LinearGradient
          colors={isDark
            ? [fullThemeColors.background, fullThemeColors.surface]
            : ['#f8fafc', '#e2e8f0', '#dbeafe']
          }
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 140,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.backBtn, { borderRadius: borderRadiusValue }]}
              >
                <BlurView
                  intensity={isDark ? 40 : 80}
                  style={[styles.backBlur, { borderRadius: borderRadiusValue }]}
                  tint={isDark ? 'dark' : 'light'}
                >
                  <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
                </BlurView>
              </TouchableOpacity>
              
              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { color: fullThemeColors.text }]}>
                  Create Tracker
                </Text>
                <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary }]}>
                  Personalize your tracking
                </Text>
              </View>
              
              <View style={{ width: 48 }} />
            </View>
          </Animated.View>

          {/* Live Preview Card */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.previewSection}>
            <View style={[
              styles.previewCard,
              {
                borderRadius: borderRadiusValue * 1.5,
                backgroundColor: `${selectedColor}12`,
                borderColor: `${selectedColor}30`,
              },
            ]}>
              <LinearGradient
                colors={[`${selectedColor}20`, `${selectedColor}05`]}
                style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue * 1.5 }]}
              />
              
              <Animated.View style={[styles.previewEmojiWrap, previewAnimStyle]}>
                <View style={[
                  styles.previewEmojiCircle,
                  { backgroundColor: `${selectedColor}25` },
                ]}>
                  <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
                </View>
              </Animated.View>
              
              <Text style={[styles.previewName, { color: fullThemeColors.text }]}>
                {name.trim() || 'My Tracker'}
              </Text>
              
              <Text style={[styles.previewMeta, { color: fullThemeColors.textSecondary }]}>
                {description.trim() || 'Tap fields below to customize'}
              </Text>
              
              <View style={styles.previewBadges}>
                <View style={[styles.previewBadge, { backgroundColor: `${selectedColor}20` }]}>
                  <Ionicons name="color-palette" size={12} color={selectedColor} />
                  <Text style={[styles.previewBadgeText, { color: selectedColor }]}>
                    Custom
                  </Text>
                </View>
                {finalUnit && (
                  <View style={[styles.previewBadge, { backgroundColor: `${selectedColor}20` }]}>
                    <Ionicons name="scale" size={12} color={selectedColor} />
                    <Text style={[styles.previewBadgeText, { color: selectedColor }]}>
                      {finalUnit}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Name Input */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
            <SectionHeader
              title="Tracker Name"
              subtitle="Give it a memorable name"
              delay={0}
              colors={fullThemeColors}
            />
            <BlurView
              intensity={isDark ? 40 : 80}
              style={[styles.inputBlur, { borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }]}
              tint={isDark ? 'dark' : 'light'}
            >
              <TextInput
                style={[
                  styles.input,
                  { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
                ]}
                placeholder="e.g., Reading Time, Tummy Time..."
                placeholderTextColor={fullThemeColors.textSecondary}
                value={name}
                onChangeText={setName}
                maxLength={30}
                autoFocus
              />
              <Text style={[styles.charCount, { color: fullThemeColors.textSecondary }]}>
                {name.length}/30
              </Text>
            </BlurView>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(250)} style={styles.section}>
            <SectionHeader
              title="Description"
              subtitle="What are you tracking?"
              delay={0}
              colors={fullThemeColors}
            />
            <BlurView
              intensity={isDark ? 40 : 80}
              style={[styles.inputBlur, { borderRadius: borderRadiusValue, borderColor: fullThemeColors.border }]}
              tint={isDark ? 'dark' : 'light'}
            >
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
                multiline
                numberOfLines={2}
                placeholder="Brief description of what this tracker monitors..."
                placeholderTextColor={fullThemeColors.textSecondary}
                value={description}
                onChangeText={setDescription}
                maxLength={100}
                textAlignVertical="top"
              />
            </BlurView>
          </Animated.View>

          {/* Emoji Selector */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
            <SectionHeader
              title="Choose Icon"
              subtitle="Pick an emoji that fits"
              delay={0}
              colors={fullThemeColors}
            />
            
            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiCategoryScroll}
            >
              {EMOJI_CATEGORIES.map((cat, index) => (
                <TouchableOpacity
                  key={cat.title}
                  style={[
                    styles.categoryTab,
                    {
                      backgroundColor: activeEmojiCategory === index
                        ? `${selectedColor}20`
                        : fullThemeColors.surface,
                      borderColor: activeEmojiCategory === index
                        ? selectedColor
                        : fullThemeColors.border,
                      borderRadius: borderRadiusValue,
                    },
                  ]}
                  onPress={() => setActiveEmojiCategory(index)}
                >
                  <Text style={styles.categoryTabEmoji}>{cat.emojis[0]}</Text>
                  <Text style={[
                    styles.categoryTabText,
                    {
                      color: activeEmojiCategory === index
                        ? selectedColor
                        : fullThemeColors.textSecondary,
                    },
                  ]}>
                    {cat.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.emojiGrid}>
              {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleEmojiSelect(emoji)}
                  style={[
                    styles.emojiButton,
                    {
                      borderRadius: borderRadiusValue,
                      backgroundColor: selectedEmoji === emoji
                        ? `${selectedColor}25`
                        : fullThemeColors.glassBg,
                      borderColor: selectedEmoji === emoji
                        ? selectedColor
                        : fullThemeColors.border,
                      borderWidth: selectedEmoji === emoji ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[
                    styles.emojiText,
                    selectedEmoji === emoji && { transform: [{ scale: 1.2 }] },
                  ]}>
                    {emoji}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Color Selector */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
            <SectionHeader
              title="Choose Color"
              subtitle="This sets the theme for your tracker"
              delay={0}
              colors={fullThemeColors}
            />
            <View style={styles.colorGrid}>
              {COLORS.map((color) => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={selectedColor === color}
                  isDark={isDark}
                  onPress={() => handleColorSelect(color)}
                />
              ))}
            </View>
          </Animated.View>

          {/* Unit Selector */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
            <SectionHeader
              title="Measurement Unit"
              subtitle="Optional — helps with quick logging"
              delay={0}
              colors={fullThemeColors}
            />
            <View style={styles.unitsGrid}>
              {PRESET_UNITS.map((presetUnit) => (
                <UnitChip
                  key={presetUnit}
                  unit={presetUnit}
                  isSelected={unit === presetUnit}
                  color={selectedColor}
                  surfaceColor={fullThemeColors.surface}
                  borderColor={fullThemeColors.border}
                  onPress={() => {
                    triggerHaptic('light');
                    setUnit(presetUnit);
                    setCustomUnit('');
                  }}
                />
              ))}
              <UnitChip
                unit="Custom"
                isSelected={unit === 'custom'}
                color={selectedColor}
                surfaceColor={fullThemeColors.surface}
                borderColor={fullThemeColors.border}
                onPress={() => {
                  triggerHaptic('light');
                  setUnit('custom');
                }}
              />
            </View>
            
            {unit === 'custom' && (
              <Animated.View entering={FadeInUp.delay(100)}>
                <BlurView
                  intensity={isDark ? 40 : 80}
                  style={[
                    styles.inputBlur,
                    {
                      borderRadius: borderRadiusValue,
                      borderColor: fullThemeColors.border,
                      marginTop: 12,
                    },
                  ]}
                  tint={isDark ? 'dark' : 'light'}
                >
                  <TextInput
                    style={[
                      styles.input,
                      { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                    ]}
                    placeholder="Enter custom unit..."
                    placeholderTextColor={fullThemeColors.textSecondary}
                    value={customUnit}
                    onChangeText={setCustomUnit}
                    maxLength={15}
                    autoFocus
                  />
                </BlurView>
              </Animated.View>
            )}
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.tipsSection}>
            <View style={[
              styles.tipsCard,
              {
                borderRadius: borderRadiusValue,
                backgroundColor: `${themeColors.primary}08`,
                borderColor: `${themeColors.primary}15`,
              },
            ]}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={20} color={themeColors.primary} />
                <Text style={[styles.tipsTitle, { color: themeColors.primary }]}>
                  Pro Tips
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={14} color={themeColors.primary} style={styles.tipIcon} />
                <Text style={[styles.tipText, { color: fullThemeColors.textSecondary }]}>
                  Keep names short for easy quick-logging
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={14} color={themeColors.primary} style={styles.tipIcon} />
                <Text style={[styles.tipText, { color: fullThemeColors.textSecondary }]}>
                  Units help when viewing charts and summaries
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={14} color={themeColors.primary} style={styles.tipIcon} />
                <Text style={[styles.tipText, { color: fullThemeColors.textSecondary }]}>
                  You can edit this tracker later in Settings
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Spacer for button */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Floating Create Button */}
        <Animated.View
          entering={FadeInUp.delay(700)}
          style={[
            styles.floatingButtonWrap,
            { bottom: insets.bottom + 20 },
          ]}
        >
          <TouchableOpacity
            onPress={handleCreate}
            activeOpacity={0.85}
            disabled={!isValid || isSubmitting}
            style={[
              styles.createButton,
              {
                borderRadius: borderRadiusValue,
                opacity: isValid ? 1 : 0.5,
              },
            ]}
          >
            <LinearGradient
              colors={isValid
                ? [selectedColor, selectedColor + 'dd']
                : [fullThemeColors.border, fullThemeColors.border]
              }
              style={[StyleSheet.absoluteFill, { borderRadius: borderRadiusValue }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {isSubmitting ? (
              <Text style={styles.createButtonText}>Creating...</Text>
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.createButtonText}>Create {name.trim() || 'Tracker'}</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { marginBottom: 20 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 48, height: 48 },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },

  section: { marginBottom: 28 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  previewSection: { marginBottom: 28 },
  previewCard: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  previewEmojiWrap: { marginBottom: 12 },
  previewEmojiCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: { fontSize: 40 },
  previewName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  previewMeta: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  previewBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  inputBlur: {
    overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 70,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 16,
  },

  emojiCategoryScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryTabEmoji: { fontSize: 16 },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '700',
  },

  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiButton: {
    width: (width - 60) / 5,
    height: (width - 60) / 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 28 },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  colorCheck: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 20,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  tipsSection: { marginBottom: 20 },
  tipsCard: {
    padding: 16,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipIcon: { marginTop: 2, marginRight: 8 },
  tipText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  floatingButtonWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  createButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
