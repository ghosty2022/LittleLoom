#!/usr/bin/env python3
"""
LittleLoom BabyProfileCreateScreen Redesign Script
Transforms BabyProfileCreateScreen into a clean, growth-dashboard-inspired design
with 6 new intelligent features and a much better UX.

Usage:
    python fix_baby_profile_create.py <path_to_BabyProfileCreateScreen.tsx>

This script:
1. Fixes the step-based flow into a single-scroll intelligent form
2. Adds 6 new intelligent features
3. Improves spacing, card alignment, and visual hierarchy
4. Adds AI-powered suggestions and smart defaults
5. Creates a glassmorphism preview card system
"""

import sys
import re
import os

def transform_baby_profile_screen(file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # ─── 1. ADD NEW IMPORTS ─────────────────────────────────────────────
    new_imports = """import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useSweetAlert } from '../../hooks/useSweetAlert';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
"""

    # Replace old imports block
    old_imports_pattern = r'import React.*?from \'react\';.*?import \{ SafeBabyAvatar \} from \'../../components/SafeAvatar\';'
    content = re.sub(old_imports_pattern, new_imports.strip(), content, flags=re.DOTALL)

    # ─── 2. ADD DESIGN TOKENS ───────────────────────────────────────────
    design_tokens = """/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Matching Growth Dashboard
   ═══════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const { width: SCREEN_W } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
"""

    # Insert design tokens before constants
    content = content.replace('const BABY_IMAGES_DIR', design_tokens.strip() + '\n\nconst BABY_IMAGES_DIR')

    # ─── 3. ADD NEW INTELLIGENT COMPONENTS ────────────────────────────
    new_components = """
/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI Smart Suggestions
   ═══════════════════════════════════════════════════════════════════ */

const AISmartSuggestions = memo(({ name, birthDate, gender, isDark }: {
  name: string;
  birthDate: Date;
  gender: string;
  isDark: boolean;
}) => {
  const suggestions = useMemo(() => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseName = name.trim() || 'your baby';

    const items = [];

    if (diffDays < 0) {
      items.push({
        icon: '👶',
        title: 'Future Arrival',
        desc: `${baseName} is expected soon! Prepare essentials.`,
        color: '#f59e0b',
        type: 'info',
      });
    } else if (diffDays <= 7) {
      items.push({
        icon: '🍼',
        title: 'Newborn Essentials',
        desc: `Track feeding every 2-3 hours for ${baseName}.`,
        color: '#ec4899',
        type: 'tip',
      });
    } else if (diffDays <= 30) {
      items.push({
        icon: '😴',
        title: 'Sleep Patterns',
        desc: `${baseName} should sleep 14-17 hours daily.`,
        color: '#8b5cf6',
        type: 'tip',
      });
    } else if (diffDays <= 90) {
      items.push({
        icon: '👀',
        title: 'Vision Development',
        desc: `${baseName} can now see 8-12 inches away!`,
        color: '#06b6d4',
        type: 'milestone',
      });
    } else if (diffDays <= 180) {
      items.push({
        icon: '🦷',
        title: 'Teething Alert',
        desc: `Watch for teething signs in ${baseName} soon.`,
        color: '#10b981',
        type: 'alert',
      });
    }

    if (gender === 'boy') {
      items.push({
        icon: '💙',
        title: 'Boy-Specific Tips',
        desc: 'Circumcision care if applicable. Keep area clean.',
        color: '#3b82f6',
        type: 'tip',
      });
    } else if (gender === 'girl') {
      items.push({
        icon: '💗',
        title: 'Girl-Specific Tips',
        desc: 'Wipe front to back to prevent infections.',
        color: '#ec4899',
        type: 'tip',
      });
    }

    return items.slice(0, 3);
  }, [name, birthDate, gender]);

  if (suggestions.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
          AI Smart Suggestions
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Personalized for your baby
        </Text>
      </View>

      {suggestions.map((s, i) => (
        <Animated.View 
          key={i} 
          entering={FadeInUp.delay(350 + i * 60).springify()}
          style={[styles.suggestionCard, { 
            backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
            borderLeftWidth: 3,
            borderLeftColor: s.color,
          }]}
        >
          <View style={styles.suggestionRow}>
            <View style={[styles.suggestionIconBg, { backgroundColor: s.color + '15' }]}>
              <Text style={styles.suggestionIcon}>{s.icon}</Text>
            </View>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Text style={[styles.suggestionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                  {s.title}
                </Text>
                <View style={[styles.suggestionTypeBadge, { backgroundColor: s.color + '15' }]}>
                  <Text style={[styles.suggestionTypeText, { color: s.color }]}>{s.type}</Text>
                </View>
              </View>
              <Text style={[styles.suggestionDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {s.desc}
              </Text>
            </View>
          </View>
        </Animated.View>
      ))}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Smart Form Progress
   ═══════════════════════════════════════════════════════════════════ */

const SmartFormProgress = memo(({ 
  completedFields, 
  totalFields, 
  isDark 
}: { 
  completedFields: number; 
  totalFields: number; 
  isDark: boolean;
}) => {
  const percentage = Math.round((completedFields / totalFields) * 100);
  const color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#667eea';

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <View style={[styles.progressCard, { 
        backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' 
      }]}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              Profile Completeness
            </Text>
            <Text style={[styles.progressSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {completedFields} of {totalFields} fields completed
            </Text>
          </View>
          <View style={[styles.progressScoreRing, { borderColor: color + '30' }]}>
            <Text style={[styles.progressScore, { color }]}>{percentage}%</Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <Animated.View 
            style={[styles.progressBarFill, { 
              width: `${percentage}%`, 
              backgroundColor: color 
            }]} 
          />
        </View>

        {percentage < 100 && (
          <Text style={[styles.progressTip, { color: isDark ? '#64748b' : '#94a3b8' }]}>
            {percentage < 50 
              ? '💡 Add weight and height for better tracking'
              : percentage < 80
              ? '💡 Add blood type and allergies for health insights'
              : '💡 Almost there! Review and create profile'
            }
          </Text>
        )}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Quick Health Input Chips
   ═══════════════════════════════════════════════════════════════════ */

const QuickHealthChips = memo(({ 
  weight, 
  height, 
  bloodType, 
  onWeightSelect, 
  onHeightSelect,
  onBloodTypeSelect,
  isDark 
}: {
  weight: string;
  height: string;
  bloodType: string;
  onWeightSelect: (w: string) => void;
  onHeightSelect: (h: string) => void;
  onBloodTypeSelect: (b: string) => void;
  isDark: boolean;
}) => {
  const weightOptions = ['2.5', '3.0', '3.5', '4.0'];
  const heightOptions = ['48', '50', '52', '54'];
  const bloodOptions = ['A+', 'O+', 'B+', 'AB+'];

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
          Quick Health Inputs
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Tap to auto-fill common values
        </Text>
      </View>

      {!weight && (
        <View style={styles.chipGroup}>
          <Text style={[styles.chipLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Common Weights (kg)</Text>
          <View style={styles.chipRow}>
            {weightOptions.map(w => (
              <TouchableOpacity 
                key={w} 
                onPress={() => onWeightSelect(w)}
                style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Text style={[styles.chipText, { color: '#667eea' }]}>{w} kg</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!height && (
        <View style={styles.chipGroup}>
          <Text style={[styles.chipLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Common Heights (cm)</Text>
          <View style={styles.chipRow}>
            {heightOptions.map(h => (
              <TouchableOpacity 
                key={h} 
                onPress={() => onHeightSelect(h)}
                style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Text style={[styles.chipText, { color: '#10b981' }]}>{h} cm</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!bloodType && (
        <View style={styles.chipGroup}>
          <Text style={[styles.chipLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Common Blood Types</Text>
          <View style={styles.chipRow}>
            {bloodOptions.map(b => (
              <TouchableOpacity 
                key={b} 
                onPress={() => onBloodTypeSelect(b)}
                style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Text style={[styles.chipText, { color: '#ef4444' }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Avatar Preview Ring
   ═══════════════════════════════════════════════════════════════════ */

const AvatarPreviewRing = memo(({ 
  avatar, 
  gender, 
  name, 
  ageDisplay, 
  isDark 
}: {
  avatar: string;
  gender: string;
  name: string;
  ageDisplay: string;
  isDark: boolean;
}) => {
  return (
    <Animated.View entering={FadeInUp.springify()}>
      <View style={[styles.heroCard, { 
        backgroundColor: isDark ? 'rgba(45,45,60,0.85)' : 'rgba(255,255,255,0.92)' 
      }]}>
        <LinearGradient
          colors={isDark 
            ? ['rgba(102,126,234,0.15)', 'rgba(118,75,162,0.05)'] 
            : ['rgba(102,126,234,0.08)', 'rgba(118,75,162,0.02)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.avatarRingWrapper}>
          <View style={styles.avatarOuterRing}>
            <SafeBabyAvatar avatar={avatar} gender={gender} size={100} />
          </View>
          <TouchableOpacity 
            style={[styles.avatarEditBadge, { backgroundColor: '#667eea' }]}
            onPress={() => {}}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroInfo}>
          <Text style={[styles.heroName, { color: isDark ? '#fff' : '#1e293b' }]}>
            {name.trim() || 'Your Baby'}
          </Text>
          <Text style={[styles.heroDetails, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {ageDisplay !== 'Invalid date' ? ageDisplay : 'Enter birth date'}
          </Text>
          <View style={styles.heroTags}>
            <View style={[styles.heroTag, { backgroundColor: gender === 'boy' ? '#3b82f620' : gender === 'girl' ? '#ec489920' : '#667eea20' }]}>
              <Text style={[styles.heroTagText, { color: gender === 'boy' ? '#3b82f6' : gender === 'girl' ? '#ec4899' : '#667eea' }]}>
                {gender === 'boy' ? '👦 Boy' : gender === 'girl' ? '👧 Girl' : '👶 Other'}
              </Text>
            </View>
            {name.trim() && (
              <View style={[styles.heroTag, { backgroundColor: '#10b98120' }]}>
                <Text style={[styles.heroTagText, { color: '#10b981' }]}>✓ Named</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Milestone Predictor
   ═══════════════════════════════════════════════════════════════════ */

const MilestonePredictor = memo(({ birthDate, isDark }: { birthDate: Date; isDark: boolean }) => {
  const milestones = useMemo(() => {
    const now = new Date();
    const ageMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    const allMilestones = [
      { age: 0, title: 'First Smile', emoji: '😊', category: 'Social' },
      { age: 2, title: 'Track Objects', emoji: '👀', category: 'Vision' },
      { age: 4, title: 'Roll Over', emoji: '🔄', category: 'Motor' },
      { age: 6, title: 'Sit Up', emoji: '🪑', category: 'Motor' },
      { age: 9, title: 'Crawl', emoji: '🐛', category: 'Motor' },
      { age: 12, title: 'First Steps', emoji: '👣', category: 'Motor' },
      { age: 15, title: 'First Words', emoji: '🗣️', category: 'Language' },
      { age: 18, title: 'Walk Alone', emoji: '🚶', category: 'Motor' },
      { age: 24, title: 'Two-Word Phrases', emoji: '💬', category: 'Language' },
    ];

    return allMilestones
      .filter(m => m.age >= ageMonths)
      .slice(0, 4)
      .map(m => ({
        ...m,
        monthsAway: m.age - ageMonths,
        status: m.age - ageMonths <= 1 ? 'soon' : m.age - ageMonths <= 3 ? 'approaching' : 'future',
      }));
  }, [birthDate]);

  if (milestones.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(500).springify()}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
          Upcoming Milestones
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Based on birth date
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.milestoneScroll}>
        {milestones.map((m, i) => (
          <View key={i} style={[styles.milestoneCard, { 
            backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' 
          }]}>
            <View style={[styles.milestoneIconBg, { 
              backgroundColor: m.status === 'soon' ? '#ef444415' : m.status === 'approaching' ? '#f59e0b15' : '#667eea15' 
            }]}>
              <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
            </View>
            <Text style={[styles.milestoneTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
              {m.title}
            </Text>
            <Text style={[styles.milestoneTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {m.monthsAway === 0 ? 'This month!' : `${m.monthsAway} month${m.monthsAway !== 1 ? 's' : ''} away`}
            </Text>
            <View style={[styles.milestoneBadge, { 
              backgroundColor: m.status === 'soon' ? '#ef444415' : m.status === 'approaching' ? '#f59e0b15' : '#667eea15' 
            }]}>
              <Text style={[styles.milestoneBadgeText, { 
                color: m.status === 'soon' ? '#ef4444' : m.status === 'approaching' ? '#f59e0b' : '#667eea' 
              }]}>
                {m.status === 'soon' ? '🔥 Soon' : m.status === 'approaching' ? '⏳ Coming' : '🔮 Future'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   NEW FEATURE 6: One-Tap Create with Smart Validation
   ═══════════════════════════════════════════════════════════════════ */

const SmartCreateButton = memo(({ 
  isReady, 
  isLoading, 
  onPress, 
  isDark 
}: { 
  isReady: boolean; 
  isLoading: boolean; 
  onPress: () => void; 
  isDark: boolean;
}) => {
  return (
    <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.createButtonContainer}>
      <TouchableOpacity
        style={[styles.smartCreateButton, !isReady && styles.smartCreateButtonDisabled]}
        onPress={onPress}
        disabled={!isReady || isLoading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isReady ? ['#667eea', '#764ba2'] : ['#94a3b8', '#64748b']}
          style={styles.smartCreateGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name={isReady ? "sparkles" : "alert-circle"} size={22} color="#fff" />
              <Text style={styles.smartCreateText}>
                {isReady ? 'Create Profile ✨' : 'Fill required fields'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {isReady && (
        <Text style={[styles.createHint, { color: isDark ? '#64748b' : '#94a3b8' }]}>
          All set! Tap to create {name.trim()}'s profile
        </Text>
      )}
    </Animated.View>
  );
});
"""

    # Insert new components before the main component
    content = content.replace('export default function BabyProfileCreateScreen', new_components + '\n\nexport default function BabyProfileCreateScreen')

    # ─── 4. REPLACE MAIN COMPONENT BODY ───────────────────────────────
    # Find and replace the main render body
    old_render_pattern = r'return \(\s*<View style=\[styles\.container.*?<\/View>\s*\);'

    new_render = """return (
    <View style={[styles.container, { flex: 1 }]}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

        <KeyboardAvoidingView behavior={kbBehavior} enabled={kbEnabled} style={{ flex: 1 }}>
          <AutoHideAnimatedScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 140 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 80 : 100}
                  tint={isDark ? 'dark' : 'light'}
                  style={styles.backBlur}
                >
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, isDark && styles.textDark]}>Create Profile</Text>
                <Text style={[styles.headerSubtitle, isDark && { color: '#94a3b8' }]}>
                  Welcome to LittleLoom
                </Text>
              </View>

              <View style={styles.placeholder} />
            </Animated.View>

            {/* Hero Avatar Card */}
            <AvatarPreviewRing 
              avatar={avatar} 
              gender={gender} 
              name={name} 
              ageDisplay={ageDisplay}
              isDark={isDark}
            />

            {/* Smart Progress */}
            <SmartFormProgress 
              completedFields={
                (name.trim() ? 1 : 0) + 
                (birthDate ? 1 : 0) + 
                (gender ? 1 : 0) + 
                (weight.trim() ? 1 : 0) + 
                (height.trim() ? 1 : 0) + 
                (bloodType.trim() ? 1 : 0) + 
                (allergies.trim() ? 1 : 0)
              }
              totalFields={7}
              isDark={isDark}
            />

            {/* Main Form */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150)} style={styles.formContainer}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>
                  Baby's Name <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
                  <Ionicons name="person-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                  <TextInput
                    ref={nameInputRef}
                    style={[styles.input, isDark && styles.textDark]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter baby's name"
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                    autoFocus
                    maxLength={50}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Birth Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>
                  Birth Date <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.dateButton, isDark && styles.dateButtonDark]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={20} color={themeColors.primary} />
                  <Text style={[styles.dateText, isDark && styles.textDark]}>
                    {birthDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={[styles.agePreview, { color: themeColors.primary }]}>{ageDisplay}</Text>
                </TouchableOpacity>
                {renderDatePicker()}
              </View>

              {/* Gender */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Gender</Text>
                <View style={styles.genderContainer}>
                  {(['boy', 'girl', 'other'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderButton,
                        gender === g && {
                          borderColor: themeColors.primary,
                          backgroundColor: themeColors.primary + '1A',
                        },
                        isDark && styles.genderButtonDark,
                      ]}
                      onPress={() => {
                        setGender(g);
                        triggerHaptic('light');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.genderEmoji}>{g === 'boy' ? '👦' : g === 'girl' ? '👧' : '👶'}</Text>
                      <Text style={[styles.genderText, gender === g && { color: themeColors.primary, fontWeight: '700' }, isDark && styles.textDark]}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Skin Tone */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Skin Tone</Text>
                <View style={styles.skinToneContainer}>
                  {SKIN_TONES.map((tone) => (
                    <TouchableOpacity
                      key={tone.id}
                      style={[
                        styles.skinToneButton,
                        skinTone === tone.id && {
                          borderColor: themeColors.primary,
                          backgroundColor: themeColors.primary + '1A',
                        },
                        isDark && styles.skinToneButtonDark,
                      ]}
                      onPress={() => {
                        setSkinTone(tone.id);
                        setAvatar(tone.emoji);
                        triggerHaptic('light');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.skinToneEmoji}>{tone.emoji}</Text>
                      {skinTone === tone.id && (
                        <View style={styles.checkmark}>
                          <Ionicons name="checkmark-circle" size={16} color={themeColors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Avatar Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Avatar</Text>
                <TouchableOpacity
                  style={[styles.avatarSelector, isDark && styles.avatarSelectorDark]}
                  onPress={() => setShowAvatarPicker((v) => !v)}
                  activeOpacity={0.8}
                >
                  <SafeBabyAvatar avatar={avatar} gender={gender} size={80} />
                  <Text style={[styles.changeAvatarText, { color: themeColors.primary }]}>
                    {showAvatarPicker ? 'Tap to close' : 'Tap to change'}
                  </Text>
                </TouchableOpacity>

                {showAvatarPicker && (
                  <Animated.View entering={shouldReduceMotion ? undefined : FadeIn} style={styles.avatarGrid}>
                    {AVATAR_OPTIONS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.avatarOption,
                          avatar === emoji && {
                            borderColor: themeColors.primary,
                            backgroundColor: themeColors.primary + '1A',
                          },
                        ]}
                        onPress={() => {
                          setAvatar(emoji);
                          setShowAvatarPicker(false);
                          triggerHaptic('light');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.avatarOption} onPress={takePhoto} activeOpacity={0.7}>
                      <Ionicons name="camera-outline" size={24} color={themeColors.primary} />
                      <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.avatarOption} onPress={pickImage} activeOpacity={0.7}>
                      <Ionicons name="images-outline" size={24} color={themeColors.primary} />
                      <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Gallery</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>

              {/* Health Section */}
              <View style={styles.sectionDivider}>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
                <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Health Information (Optional)
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
              </View>

              {/* Weight */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Birth Weight (kg)</Text>
                <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
                  <Ionicons name="scale-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    value={weight}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                      setWeight(formatted);
                    }}
                    placeholder="e.g., 3.5"
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* Height */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Birth Height (cm)</Text>
                <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
                  <Ionicons name="resize-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    value={height}
                    onChangeText={(text) => setHeight(text.replace(/[^0-9]/g, '').slice(0, 3))}
                    placeholder="e.g., 50"
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>

              {/* Blood Type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Blood Type</Text>
                <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
                  <Ionicons name="water-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    value={bloodType}
                    onChangeText={(text) => setBloodType(text.toUpperCase().replace(/[^ABO+-]/g, '').slice(0, 3))}
                    placeholder="e.g., A+"
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                    autoCapitalize="characters"
                    maxLength={3}
                  />
                </View>
              </View>

              {/* Allergies */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Allergies (comma separated)</Text>
                <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
                  <Ionicons name="warning-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    value={allergies}
                    onChangeText={setAllergies}
                    placeholder="e.g., peanuts, dairy, eggs"
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                  />
                </View>
              </View>

              {/* Medical Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.textDark]}>Medical Notes</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper, isDark && styles.inputWrapperDark]}>
                  <TextInput
                    style={[styles.input, styles.textArea, isDark && styles.textDark]}
                    value={medicalNotes}
                    onChangeText={setMedicalNotes}
                    placeholder="Any important medical information..."
                    placeholderTextColor={isDark ? '#64748b' : '#999'}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                </View>
                <Text style={styles.charCount}>{medicalNotes.length}/500</Text>
              </View>
            </Animated.View>

            {/* Quick Health Chips */}
            <QuickHealthChips
              weight={weight}
              height={height}
              bloodType={bloodType}
              onWeightSelect={setWeight}
              onHeightSelect={setHeight}
              onBloodTypeSelect={setBloodType}
              isDark={isDark}
            />

            {/* AI Smart Suggestions */}
            <AISmartSuggestions
              name={name}
              birthDate={birthDate}
              gender={gender}
              isDark={isDark}
            />

            {/* Milestone Predictor */}
            <MilestonePredictor birthDate={birthDate} isDark={isDark} />

            {/* Smart Create Button */}
            <SmartCreateButton
              isReady={!!name.trim() && !!birthDate}
              isLoading={isLoading}
              onPress={handleCreateProfile}
              isDark={isDark}
            />

            <View style={{ height: 40 }} />
          </AutoHideAnimatedScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );"""

    content = re.sub(old_render_pattern, new_render.strip(), content, flags=re.DOTALL)

    # ─── 5. REPLACE STYLES ────────────────────────────────────────────
    old_styles = r'const styles = StyleSheet\.create\(\{[\s\S]*\}\);'

    new_styles = """const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { alignItems: 'center' },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  placeholder: { width: 48 },
  textDark: { color: '#fff' },

  /* Hero Card */
  heroCard: {
    borderRadius: DESIGN.radius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    ...DESIGN.shadow.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarRingWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarOuterRing: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  heroInfo: { alignItems: 'center', gap: 8 },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroDetails: {
    fontSize: 14,
    fontWeight: '500',
  },
  heroTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Progress Card */
  progressCard: {
    borderRadius: DESIGN.radius.lg,
    padding: 18,
    marginBottom: 20,
    ...DESIGN.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progressSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  progressScoreRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressScore: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(100,116,139,0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressTip: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },

  /* Form */
  formContainer: { gap: 16 },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Inputs */
  inputGroup: { marginBottom: 4 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  textAreaWrapper: { height: 120, alignItems: 'flex-start', paddingTop: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 8,
  },

  /* Date */
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  dateButtonDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateText: { flex: 1, fontSize: 16, color: '#1a1a1a', fontWeight: '600' },
  agePreview: { fontSize: 14, fontWeight: '700' },

  /* Gender */
  genderContainer: { flexDirection: 'row', gap: 12 },
  genderButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  genderEmoji: { fontSize: 32, marginBottom: 8 },
  genderText: { fontSize: 14, color: '#666', fontWeight: '600' },

  /* Skin Tone */
  skinToneContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  skinToneButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  skinToneButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  skinToneEmoji: { fontSize: 32 },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 10,
  },

  /* Avatar */
  avatarSelector: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  avatarSelectorDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  changeAvatarText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionEmoji: { fontSize: 32 },
  avatarOptionLabel: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  /* Section Header */
  sectionHeader: {
    marginHorizontal: 4,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Suggestion Cards */
  suggestionCard: {
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    ...DESIGN.shadow.sm,
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestionIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionIcon: { fontSize: 20 },
  suggestionContent: { flex: 1, gap: 3 },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionTitle: { fontSize: 14, fontWeight: '700' },
  suggestionTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestionTypeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  suggestionDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },

  /* Quick Health Chips */
  chipGroup: { marginBottom: 12 },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  /* Milestone Cards */
  milestoneScroll: { paddingHorizontal: 4, gap: 12, paddingBottom: 4 },
  milestoneCard: {
    width: 140,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    ...DESIGN.shadow.sm,
  },
  milestoneIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneEmoji: { fontSize: 24 },
  milestoneTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  milestoneTime: { fontSize: 11, fontWeight: '500' },
  milestoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  milestoneBadgeText: { fontSize: 10, fontWeight: '700' },

  /* Smart Create Button */
  createButtonContainer: {
    marginHorizontal: 4,
    marginTop: 8,
    marginBottom: 20,
  },
  smartCreateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...DESIGN.shadow.lg,
  },
  smartCreateButtonDisabled: {
    opacity: 0.6,
  },
  smartCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  smartCreateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  createHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },

  /* iOS Date Picker */
  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  iosPickerButton: { fontSize: 16, fontWeight: '600' },
  iosPickerTitle: { fontSize: 16, fontWeight: '700' },
});"""

    content = re.sub(old_styles, new_styles.strip(), content, flags=re.DOTALL)

    return content


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_baby_profile_create.py <path_to_BabyProfileCreateScreen.tsx>")
        print("\nThis script will:")
        print("  1. Convert 2-step flow to single intelligent scroll form")
        print("  2. Add 6 new intelligent features:")
        print("     1. AI Smart Suggestions - Age/gender-based tips")
        print("     2. Smart Form Progress - Visual completeness tracker")
        print("     3. Quick Health Input Chips - One-tap common values")
        print("     4. Avatar Preview Ring - Hero card with edit badge")
        print("     5. Milestone Predictor - Timeline of upcoming milestones")
        print("     6. Smart Create Button - Context-aware validation")
        print("  3. Improve spacing, cards, and visual hierarchy")
        print("  4. Match Growth Dashboard glassmorphism style")
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    print(f"Processing: {file_path}")
    print("-" * 50)

    # Create backup
    backup_path = file_path + '.backup'
    with open(file_path, 'r', encoding='utf-8') as f:
        original = f.read()

    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(original)

    print(f"Backup created: {backup_path}")

    # Transform
    transformed = transform_baby_profile_screen(file_path)

    # Write transformed content
    output_path = file_path.replace('.tsx', '_redesigned.tsx')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(transformed)

    print(f"Redesigned screen saved to: {output_path}")
    print("-" * 50)
    print("Transformation complete!")


if __name__ == '__main__':
    main()