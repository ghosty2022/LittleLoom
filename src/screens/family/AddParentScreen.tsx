import React, { useCallback, useEffect, useState } from 'react';
import {  ActivityIndicator, Alert, Button, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Settings, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useFamily } from '../../context/FamilyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { SweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { saveParentImage } from '../../utils/imageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Reusable Components                                               */
/* ------------------------------------------------------------------ */

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
  isDark: boolean;
  primaryColor?: string;
  secondaryColor?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default',
  isDark,
  primaryColor = '#667eea',
  secondaryColor = '#764ba2',
}) => {
  if (!visible) return null;

  const colors = {
    default: [primaryColor, secondaryColor] as const,
    danger: ['#ef4444', '#dc2626'] as const,
    warning: ['#f59e0b', '#d97706'] as const,
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]}>
      <TouchableOpacity activeOpacity={1} onPress={onCancel} style={StyleSheet.absoluteFill}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <Animated.View entering={FadeInUp.duration(300)} style={[styles.confirmModal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={colors} style={styles.confirmIconBg}>
          <Ionicons
            name={type === 'danger' ? 'trash' : type === 'warning' ? 'warning' : 'help-circle'}
            size={32}
            color="#fff"
          />
        </LinearGradient>
        <Text style={[styles.confirmTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>

        <View style={styles.confirmButtons}>
          <TouchableOpacity style={[styles.confirmButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm}>
            <LinearGradient colors={colors} style={styles.confirmButtonGradient}>
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Avatar Selection Component                                        */
/* ------------------------------------------------------------------ */

const AVATAR_OPTIONS = [
  { id: 'parent1', emoji: '👨', label: 'Dad' },
  { id: 'parent2', emoji: '👩', label: 'Mom' },
  { id: 'parent3', emoji: '👱', label: 'Parent' },
  { id: 'parent4', emoji: '🧔', label: 'Beard' },
  { id: 'parent5', emoji: '👳', label: 'Turban' },
  { id: 'parent6', emoji: '👲', label: 'Cap' },
];

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatar: string) => void;
  isDark: boolean;
  primaryColor: string;
  onImagePick?: () => void;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ selected, onSelect, isDark, primaryColor, onImagePick }) => {
  return (
    <View style={styles.avatarSection}>
      <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Choose Avatar</Text>
      
      {/* Show selected avatar preview with image pick option */}
      <View style={styles.avatarPreviewRow}>
        <SafeAvatar
          avatar={selected}
          size={80}
          fallbackIcon="person"
          fallbackColor={primaryColor}
          fallbackBgColor={primaryColor + '20'}
          borderColor={primaryColor + '40'}
          borderWidth={3}
          showEditBadge={!!onImagePick}
          onPress={onImagePick}
        />
        {onImagePick && (
          <TouchableOpacity style={[styles.imagePickBtn, { backgroundColor: primaryColor + '15' }]} onPress={onImagePick}>
            <Ionicons name="camera" size={18} color={primaryColor} />
            <Text style={[styles.imagePickText, { color: primaryColor }]}>Upload Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarScroll}>
        {AVATAR_OPTIONS.map((avatar) => (
          <TouchableOpacity
            key={avatar.id}
            onPress={() => onSelect(avatar.emoji)}
            style={[
              styles.avatarOption,
              selected === avatar.emoji && { borderColor: primaryColor, backgroundColor: primaryColor + '20' },
              isDark && styles.avatarOptionDark,
            ]}
          >
            <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            <Text style={[styles.avatarLabel, isDark && { color: '#94a3b8' }]}>{avatar.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Theme Preview Component                                           */
/* ------------------------------------------------------------------ */

const THEME_PREVIEWS = [
  { id: 'purple', name: 'Dreamy Purple', primary: '#667eea', secondary: '#764ba2', gradient: ['#667eea', '#764ba2'] as const },
  { id: 'blue', name: 'Ocean Blue', primary: '#4facfe', secondary: '#00f2fe', gradient: ['#4facfe', '#00f2fe'] as const },
  { id: 'green', name: 'Mint Green', primary: '#43e97b', secondary: '#38f9d7', gradient: ['#43e97b', '#38f9d7'] as const },
  { id: 'pink', name: 'Rose Pink', primary: '#fa709a', secondary: '#fee140', gradient: ['#fa709a', '#fee140'] as const },
  { id: 'orange', name: 'Sunset', primary: '#f6d365', secondary: '#fda085', gradient: ['#f6d365', '#fda085'] as const },
  { id: 'dark', name: 'Midnight', primary: '#2d3436', secondary: '#636e72', gradient: ['#2d3436', '#636e72'] as const },
];

interface ThemePickerProps {
  selected: string;
  onSelect: (themeId: string) => void;
  isDark: boolean;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ selected, onSelect, isDark }) => {
  return (
    <View style={styles.themeSection}>
      <Text style={[styles.sectionLabel, isDark && styles.textDark]}>App Theme</Text>
      <View style={styles.themeGrid}>
        {THEME_PREVIEWS.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            onPress={() => onSelect(theme.id)}
            style={[
              styles.themeCard,
              selected === theme.id && styles.themeCardSelected,
              isDark && styles.themeCardDark,
            ]}
          >
            <LinearGradient colors={theme.gradient} style={styles.themePreview}>
              {selected === theme.id && (
                <View style={styles.themeCheck}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </LinearGradient>
            <Text style={[styles.themeName, isDark && { color: '#e2e8f0' }]}>{theme.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Screen                                                       */
/* ------------------------------------------------------------------ */

type AddParentScreenProps = NativeStackScreenProps<RootStackParamList, 'AddParent'>;

interface ParentFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  theme: string;
  notifications: boolean;
  shareData: boolean;
}

export default function AddParentScreen({ navigation }: AddParentScreenProps) {
  const [form, setForm] = useState<ParentFormData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    avatar: '👨',
    theme: 'purple',
    notifications: true,
    shareData: true,
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({
    visible: false,
    type: 'success' as 'success' | 'error' | 'info' | 'warning',
    title: '',
    message: '',
  });
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'default' as 'default' | 'danger' | 'warning',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { parent2, updateParent2Profile, inviteMember } = useFamily();
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  /* ---- Validation ---- */
  const validateField = useCallback((name: keyof ParentFormData, value: string | boolean) => {
    switch (name) {
      case 'fullName':
        return typeof value === 'string' && value.trim().length < 2 ? 'Name must be at least 2 characters' : '';
      case 'email':
        if (typeof value !== 'string' || !value.trim()) return 'Email is required';
        return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) ? '' : 'Please enter a valid email';
      case 'phoneNumber':
        if (typeof value !== 'string' || !value.trim()) return '';
        return /^[\\+]?[(]?[0-9]{3}[)]?[-\\s.]?[0-9]{3}[-\\s.]?[0-9]{4,6}$/.test(value.replace(/\\s/g, ''))
          ? ''
          : 'Invalid phone number';
      default:
        return '';
    }
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    (['fullName', 'email', 'phoneNumber'] as const).forEach((field) => {
      const error = validateField(field, form[field]);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, validateField]);

  /* ---- Handlers ---- */
  const updateField = useCallback(<K extends keyof ParentFormData>(field: K, value: ParentFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field: keyof ParentFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, form[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, [form, validateField]);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const handleImagePick = useCallback(async () => {
    triggerHaptic('medium');
    const imageUri = await saveParentImage(form.email || 'temp');
    if (imageUri) {
      updateField('avatar', imageUri);
      triggerHaptic('success');
      showToast('success', 'Photo Saved!', 'Profile picture updated successfully');
    }
  }, [form.email, triggerHaptic, updateField, showToast]);

  const handleAddParent = useCallback(async () => {
    if (!validateForm()) {
      triggerHaptic('error');
      showToast('error', 'Validation Error', 'Please fix the errors in the form');
      return;
    }

    setLoading(true);
    triggerHaptic('medium');

    try {
      const parentPrefsKey = `littleloom_parent_prefs_${form.email.toLowerCase().trim()}`;
      await AsyncStorage.setItem(
        parentPrefsKey,
        JSON.stringify({
          theme: form.theme,
          avatar: form.avatar,
          notifications: form.notifications,
          shareData: form.shareData,
          createdAt: new Date().toISOString(),
        })
      );

      if (parent2) {
        await updateParent2Profile({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phoneNumber: form.phoneNumber.trim() || undefined,
          avatar: form.avatar,
        });
      } else {
        await inviteMember(form.email.trim(), 'parent2' as any, 'Co-Parent');
      }

      showToast('success', 'Success! 🎉', `${form.fullName} has been added as a co-parent`);
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      console.error('Add parent error:', error);
      showToast('error', 'Error', 'Failed to add parent. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, parent2, updateParent2Profile, inviteMember, navigation, showToast, triggerHaptic, validateForm]);

  const handleRemoveParent = useCallback(() => {
    if (!parent2) return;
    triggerHaptic('warning');
    setConfirmModal({
      visible: true,
      title: 'Remove Co-Parent?',
      message: `Are you sure you want to remove ${parent2.fullName}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          showToast('info', 'Removed', 'Co-parent has been removed');
          navigation.goBack();
        } catch (error) {
          showToast('error', 'Error', 'Failed to remove co-parent');
        }
      },
    });
  }, [parent2, navigation, showToast, triggerHaptic]);

  /* ---- Pre-fill if editing ---- */
  useEffect(() => {
    if (parent2) {
      setForm((prev) => ({
        ...prev,
        fullName: parent2.fullName || '',
        email: parent2.email || '',
        phoneNumber: parent2.phoneNumber || '',
        avatar: parent2.avatar || '👨',
      }));
    }
  }, [parent2]);

  /* ---- Render: Parent Already Exists ---- */
  if (parent2) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']}
          style={styles.gradient}
        >
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
            <View style={styles.successContainer}>
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.duration(600)}>
                <SafeAvatar
                  avatar={parent2.avatar}
                  size={100}
                  fallbackIcon="person"
                  fallbackColor={themeColors.primary}
                  fallbackBgColor={themeColors.primary + '20'}
                  borderColor={themeColors.primary + '40'}
                  borderWidth={3}
                />
              </Animated.View>

              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}>
                <Ionicons name="checkmark-circle" size={80} color="#43e97b" />
              </Animated.View>

              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}>
                <Text style={[styles.successTitle, isDark && styles.textDark]}>
                  {parent2.fullName} is your Co-Parent! 🎉
                </Text>
                <Text style={styles.successText}>
                  {parent2.email} • {parent2.phoneNumber || 'No phone'}
                </Text>
              </Animated.View>

              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.parentActions}>
                <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
                  <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.doneGradient}>
                    <Text style={styles.doneText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.removeButton} onPress={handleRemoveParent}>
                  <View style={[styles.removeButtonInner, isDark && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text style={styles.removeButtonText}>Remove Co-Parent</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </LinearGradient>

        <SweetAlert
          visible={alert.visible}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ ...alert, visible: false })}
        />
        <ConfirmModal
          {...confirmModal}
          primaryColor={themeColors.primary}
          secondaryColor={themeColors.secondary}
          onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal({ ...confirmModal, visible: false });
          }}
          isDark={isDark}
        />
      </View>
    );
  }

  /* ---- Render: Add Form ---- */
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <AutoHideAnimatedScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <BlurView intensity={80} style={styles.backBlur}>
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>
              <Text style={[styles.title, isDark && styles.textDark]}>Add Parent 👨‍👩‍👧</Text>
              <View style={styles.placeholder} />
            </Animated.View>

            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}>
              <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
                Invite your partner to co-manage your baby's logs and milestones
              </Text>
            </Animated.View>

            {/* Avatar Picker with Image Upload */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(150)}>
              <AvatarPicker
                selected={form.avatar}
                onSelect={(avatar) => updateField('avatar', avatar)}
                isDark={isDark}
                primaryColor={themeColors.primary}
                onImagePick={handleImagePick}
              />
            </Animated.View>

            {/* Form */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(200)}>
              <BlurView intensity={90} style={styles.formContainer}>
                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>
                    Full Name <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    errors.fullName && styles.inputError,
                    touched.fullName && !errors.fullName && styles.inputSuccess,
                  ]}>
                    <Ionicons name="person-outline" size={24} color={themeColors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="Enter parent's name"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={form.fullName}
                      onChangeText={(text) => updateField('fullName', text)}
                      onBlur={() => handleBlur('fullName')}
                      autoCapitalize="words"
                      editable={!loading}
                    />
                    {touched.fullName && !errors.fullName && form.fullName.length > 1 && (
                      <Ionicons name="checkmark-circle" size={20} color="#43e97b" />
                    )}
                  </View>
                  {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                </View>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>
                    Email Address <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    errors.email && styles.inputError,
                    touched.email && !errors.email && styles.inputSuccess,
                  ]}>
                    <Ionicons name="mail-outline" size={24} color={themeColors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="parent@email.com"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={form.email}
                      onChangeText={(text) => updateField('email', text)}
                      onBlur={() => handleBlur('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                    {touched.email && !errors.email && form.email.includes('@') && (
                      <Ionicons name="checkmark-circle" size={20} color="#43e97b" />
                    )}
                  </View>
                  {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>Phone Number (Optional)</Text>
                  <View style={[
                    styles.inputContainer,
                    isDark && styles.inputContainerDark,
                    errors.phoneNumber && styles.inputError,
                    touched.phoneNumber && !errors.phoneNumber && form.phoneNumber && styles.inputSuccess,
                  ]}>
                    <Ionicons name="call-outline" size={24} color={themeColors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={form.phoneNumber}
                      onChangeText={(text) => updateField('phoneNumber', text)}
                      onBlur={() => handleBlur('phoneNumber')}
                      keyboardType="phone-pad"
                      editable={!loading}
                    />
                    {touched.phoneNumber && !errors.phoneNumber && form.phoneNumber && (
                      <Ionicons name="checkmark-circle" size={20} color="#43e97b" />
                    )}
                  </View>
                  {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                </View>
              </BlurView>
            </Animated.View>

            {/* Theme Picker */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(250)}>
              <ThemePicker
                selected={form.theme}
                onSelect={(theme) => updateField('theme', theme)}
                isDark={isDark}
              />
            </Animated.View>

            {/* Preferences */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(300)}>
              <BlurView intensity={90} style={styles.preferencesCard}>
                <Text style={[styles.sectionLabel, isDark && styles.textDark, { marginBottom: 16 }]}>
                  Preferences
                </Text>

                <View style={styles.preferenceRow}>
                  <View style={styles.preferenceInfo}>
                    <Ionicons name="notifications-outline" size={22} color={themeColors.primary} />
                    <View style={styles.preferenceText}>
                      <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
                      <Text style={styles.preferenceDesc}>Receive updates about baby activities</Text>
                    </View>
                  </View>
                  <Switch
                    value={form.notifications}
                    onValueChange={(val) => updateField('notifications', val)}
                    trackColor={{ false: '#cbd5e1', true: themeColors.primary + '80' }}
                    thumbColor={form.notifications ? themeColors.primary : '#f1f5f9'}
                  />
                </View>

                <View style={[styles.preferenceRow, { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingTop: 16, marginTop: 16 }]}>
                  <View style={styles.preferenceInfo}>
                    <Ionicons name="share-outline" size={22} color={themeColors.primary} />
                    <View style={styles.preferenceText}>
                      <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Share Data</Text>
                      <Text style={styles.preferenceDesc}>Allow access to logs and milestones</Text>
                    </View>
                  </View>
                  <Switch
                    value={form.shareData}
                    onValueChange={(val) => updateField('shareData', val)}
                    trackColor={{ false: '#cbd5e1', true: themeColors.primary + '80' }}
                    thumbColor={form.shareData ? themeColors.primary : '#f1f5f9'}
                  />
                </View>
              </BlurView>
            </Animated.View>

            {/* Info Card */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(350)}>
              <BlurView intensity={80} style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color={themeColors.primary} />
                <Text style={[styles.infoText, isDark && { color: '#94a3b8' }]}>
                  The second parent will have full access to view and edit all baby logs,
                  milestones, and settings. They will not be able to delete the account.
                </Text>
              </BlurView>
            </Animated.View>

            {/* Add Button */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(400)}>
              <TouchableOpacity
                style={[styles.addButton, loading && styles.addButtonDisabled]}
                onPress={handleAddParent}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.addGradient}>
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={24} color="white" />
                      <Text style={styles.addText}>Add Co-Parent</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Security Note */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(450)}>
              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={16} color={isDark ? '#475569' : '#94a3b8'} />
                <Text style={[styles.securityText, isDark && { color: '#475569' }]}>
                  End-to-end encrypted. Only you and your co-parent can access this data.
                </Text>
              </View>
            </Animated.View>
          </AutoHideAnimatedScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <SweetAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
      <ConfirmModal
        {...confirmModal}
        primaryColor={themeColors.primary}
        secondaryColor={themeColors.secondary}
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, visible: false });
        }}
        isDark={isDark}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  /* ---- Alerts ---- */
  confirmModal: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconBg: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  confirmTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  confirmMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: 'rgba(100,116,139,0.1)' },
  cancelButtonText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  confirmButtonGradient: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* ---- Header ---- */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  textDark: { color: '#fff' },
  placeholder: { width: 48 },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },

  /* ---- Avatar Section ---- */
  avatarSection: { marginBottom: 20 },
  avatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  imagePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  imagePickText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarScroll: { paddingRight: 24, gap: 12 },
  avatarOption: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 12,
  },
  avatarOptionDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  avatarEmoji: { fontSize: 32, marginBottom: 4 },
  avatarLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  /* ---- Theme Section ---- */
  themeSection: { marginBottom: 20 },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: (width - 72) / 3,
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCardDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  themeCardSelected: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  themePreview: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },

  /* ---- Form ---- */
  formContainer: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: { color: '#ef4444' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: { borderColor: '#ef4444' },
  inputSuccess: { borderColor: '#43e97b' },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },

  /* ---- Preferences ---- */
  preferencesCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  preferenceText: { flex: 1 },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  preferenceDesc: {
    fontSize: 13,
    color: '#64748b',
  },

  /* ---- Info Card ---- */
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  /* ---- Buttons ---- */
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addButtonDisabled: { opacity: 0.7 },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },

  /* ---- Security Note ---- */
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 20,
  },
  securityText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },

  /* ---- Success State ---- */
  content: { flex: 1 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  parentActions: { width: '100%', gap: 12 },
  doneButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  doneGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  removeButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  removeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
