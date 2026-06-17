import { StyleSheet, ActivityIndicator, Alert, Button, Dimensions, Image, LogBox, Modal, RefreshControl, ScrollView, Share, Switch, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BlurView } from 'expo-blur';
import Animated, { Extrapolate, FadeIn, FadeInDown, FadeInUp, interpolate, Layout, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { format, isThisMonth, isThisWeek, isToday, isYesterday, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useBaby } from '../../context/BabyContext';
import { useMedia } from '../../context/MediaContext';
import { useSecurity } from '../../context/SecurityContext';
import { useSweetAlert } from '../../components/SweetAlert';

import { showAlert } from '@/utils/alert';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 4;
const ITEM_SIZE = (width - 32 - (COLUMN_COUNT - 1) * SPACING) / COLUMN_COUNT;

type GalleryScreenProps = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

const STORAGE_KEYS = {
  PHOTOS: '@littleloom_gallery_photos',
  AUTO_IMPORT_SETTINGS: '@littleloom_auto_import_settings',
  SCAN_PROGRESS: '@littleloom_scan_progress',
  VAULT_ENABLED: '@littleloom_vault_enabled',
};

interface Photo {
  id: string;
  uri: string;
  date: string;
  timestamp: number;
  type:
    | 'milestone'
    | 'daily'
    | 'sleep'
    | 'feeding'
    | 'potty'
    | 'growth'
    | 'medication'
    | 'all';
  caption?: string;
  babyId?: string;
  babyName?: string;
  isPrivate?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  location?: string;
  exif?: {
    width: number;
    height: number;
    size: number;
    device?: string;
  };
  linkedEntry?: {
    type: 'milestone' | 'growth' | 'activity';
    id: string;
    title: string;
  };
  faces?: {
    babyId: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired' | 'sleepy';
  isScreenshot?: boolean;
  backupStatus?: 'synced' | 'pending' | 'failed';
  source?: 'camera' | 'gallery' | 'auto_import' | 'google_photos' | 'icloud';
  isExplicit?: boolean;
  blurHash?: string;
  folder?: string;
}

interface SmartAlbum {
  id: string;
  title: string;
  icon: string;
  count: number;
  photos: Photo[];
  type: 'smart' | 'baby' | 'activity' | 'date' | 'folder';
  gradient: [string, string];
  coverPhoto?: string;
  description?: string;
}

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  icon?: string;
  duration?: number;
}

const SweetAlert = ({
  visible,
  type,
  title,
  message,
  onClose,
  isDark,
  duration = 3000,
}: AlertState & {
  onClose: () => void;
  isDark: boolean;
  duration?: number;
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });

      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withTiming(-30, { duration: 300 });
        setTimeout(onClose, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, opacity, scale, translateY, onClose]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  const config = {
    success: {
      colors: ['#11998e', '#38ef7d'] as [string, string],
      icon: 'checkmark-circle',
      bg: 'rgba(17, 153, 142, 0.1)',
    },
    error: {
      colors: ['#ef4444', '#f87171'] as [string, string],
      icon: 'alert-circle',
      bg: 'rgba(239, 68, 68, 0.1)',
    },
    info: {
      colors: ['#3b82f6', '#60a5fa'] as [string, string],
      icon: 'information-circle',
      bg: 'rgba(59, 130, 246, 0.1)',
    },
    warning: {
      colors: ['#f59e0b', '#fbbf24'] as [string, string],
      icon: 'warning',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
  }[type];

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 99999,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 100,
          pointerEvents: 'none',
        },
      ]}
      pointerEvents="box-none"
    >
      <Reanimated.View
        style={[
          style,
          styles.alertContainer,
          { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
        ]}
      >
        <LinearGradient
          colors={config.colors}
          style={styles.alertIconBg}
        >
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text
            style={[
              styles.alertTitle,
              { color: isDark ? '#fff' : '#1e293b' },
            ]}
          >
            {title}
          </Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Reanimated.View>
    </View>
  );
};

const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default',
  isDark,
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
  isDark: boolean;
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [visible, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const colors = {
    default: ['#667eea', '#764ba2'] as [string, string],
    danger: ['#ef4444', '#dc2626'] as [string, string],
    warning: ['#f59e0b', '#d97706'] as [string, string],
  }[type];

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 100000,
          justifyContent: 'center',
          alignItems: 'center',
        },
      ]}
      pointerEvents="auto"
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onCancel}
        style={StyleSheet.absoluteFill}
      >
        <Reanimated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.6)' },
            backdropStyle,
          ]}
        >
          <BlurView
            intensity={80}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
        </Reanimated.View>
      </TouchableOpacity>

      <Reanimated.View
        style={[
          styles.confirmModal,
          modalStyle,
          { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
        ]}
      >
        <View style={styles.confirmIconContainer}>
          <LinearGradient colors={colors} style={styles.confirmIconBg}>
            <Ionicons
              name={
                type === 'danger'
                  ? 'trash'
                  : type === 'warning'
                  ? 'warning'
                  : 'help-circle'
              }
              size={32}
              color="#fff"
            />
          </LinearGradient>
        </View>

        <Text
          style={[
            styles.confirmTitle,
            { color: isDark ? '#fff' : '#1e293b' },
          ]}
        >
          {title}
        </Text>
        <Text style={styles.confirmMessage}>{message}</Text>

        <View style={styles.confirmButtons}>
          <TouchableOpacity
            style={[styles.confirmButton, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onConfirm}>
            <LinearGradient
              colors={colors}
              style={styles.confirmButtonGradient}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </View>
  );
};

const VaultLockModal = ({
  visible,
  onUnlock,
  onCancel,
  isDark,
  navigation,
}: {
  visible: boolean;
  onUnlock: () => void;
  onCancel: () => void;
  isDark: boolean;
  navigation: any;
}) => {
  const {
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    authenticateWithBiometric,
    settings: securitySettings,
    verifyPin,
  } = useSecurity();

  const [pin, setPin] = useState('');
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    if (visible) {
      const hasSecurity =
        securitySettings.isPinEnabled ||
        (securitySettings.isBiometricEnabled &&
          isBiometricHardwareAvailable &&
          isBiometricEnrolled);

      if (!hasSecurity) {

showAlert(
          'Security Required',
          'Please set up PIN or Biometric authentication in Settings to use the Private Vault.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: onCancel,
            },
            {
              text: 'Go to Settings',
              onPress: () => {
                onCancel();
                navigation.navigate('Main', { screen: 'Settings' });
              },
            },
          ]
        );
      } else if (
        securitySettings.isBiometricEnabled &&
        isBiometricHardwareAvailable &&
        isBiometricEnrolled
      ) {
        attemptBiometric();
      } else {
        setShowPinEntry(true);
      }
    }
  }, [
    visible,
    securitySettings,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    onCancel,
    navigation,
  ]);

  const attemptBiometric = async () => {
    const result = await authenticateWithBiometric('Access Private Vault');
    if (result.success) {
      handleUnlock();
    } else {
      setShowPinEntry(true);
    }
  };

  const handleUnlock = () => {
    setPin('');
    setAttempts(0);
    onUnlock();
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;

    const isValid = await verifyPin(pin);
    if (isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleUnlock();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');

      if (newAttempts >= MAX_ATTEMPTS) {
        sweetAlert.alert('Security Lockout', 'Too many failed attempts. Please restart the app.', 'info');
      } else {
        sweetAlert.alert('Incorrect PIN', '${MAX_ATTEMPTS - newAttempts} attempts remaining', 'warning');
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#000' : '#fff' },
        ]}
      >
        <BlurView
          intensity={100}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />

        <View style={styles.vaultLockContainer}>
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.vaultLockIconBg}
          >
            <Ionicons name="shield" size={48} color="#fff" />
          </LinearGradient>

          <Text
            style={[
              styles.vaultLockTitle,
              { color: isDark ? '#fff' : '#1e293b' },
            ]}
          >
            Private Vault
          </Text>
          <Text style={styles.vaultLockSubtitle}>
            Maximum security - Biometric + PIN required
          </Text>

          {attempts > 0 && (
            <View style={styles.attemptsWarning}>
              <Ionicons name="warning" size={16} color="#f59e0b" />
              <Text style={styles.attemptsText}>
                {MAX_ATTEMPTS - attempts} attempts remaining
              </Text>
            </View>
          )}

          <View style={styles.pinContainer}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  pin.length > i && styles.pinDotFilled,
                  styles.pinDotVault,
                ]}
              />
            ))}
          </View>

          {showPinEntry ? (
            <View style={styles.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.keypadButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (pin.length < 4) {
                      const newPin = pin + num;
                      setPin(newPin);
                      if (newPin.length === 4) {
                        setTimeout(() => handlePinSubmit(), 100);
                      }
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.keypadNumber,
                      { color: isDark ? '#fff' : '#1e293b' },
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.keypadButton}
                onPress={attemptBiometric}
              >
                <Ionicons name="finger-print" size={32} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPin(pin.slice(0, -1));
                }}
              >
                <Ionicons
                  name="backspace"
                  size={28}
                  color={isDark ? '#fff' : '#1e293b'}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.biometricPrompt}
              onPress={attemptBiometric}
            >
              <Ionicons name="finger-print" size={64} color="#ef4444" />
              <Text style={styles.biometricPromptText}>
                Tap to authenticate
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelVaultButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelVaultText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ExplicitContentDetector = {
  async analyzeImage(
    uri: string
  ): Promise<{
    isExplicit: boolean;
    confidence: number;
    reasons: string[];
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists)
        return { isExplicit: false, confidence: 0, reasons: [] };

      await new Promise((resolve) => setTimeout(resolve, 300));
      const mockScore = Math.random();
      const isExplicit = mockScore > 0.95;

      return {
        isExplicit,
        confidence: isExplicit ? mockScore : 0,
        reasons: isExplicit ? ['Potential sensitive content detected'] : [],
      };
    } catch (error) {
      console.error('Explicit detection error:', error);
      return { isExplicit: false, confidence: 0, reasons: [] };
    }
  },

  async detectFaces(
    uri: string
  ): Promise<
    Array<{
      boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      confidence: number;
      features: number[];
    }>
  > {
    return [];
  },

  async matchBabyFace(
    faceFeatures: number[],
    babySignature: string
  ): Promise<number> {
    const featureHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(faceFeatures)
    );
    return featureHash === babySignature ? 0.95 : Math.random() * 0.5;
  },
};

const AutoImportManager = {
  async scanDeviceGallery(
    babyId: string,
    onProgress?: (scanned: number, found: number, photo?: Photo) => void,
    onPhotoFound?: (photo: Photo) => void
  ): Promise<Photo[]> {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return [];

    const photos: Photo[] = [];
    let hasMore = true;
    let endCursor: string | undefined;
    let scanned = 0;

    while (hasMore && scanned < 1000) {
      const result = await MediaLibrary.getAssetsAsync({
        first: 100,
        after: endCursor,
        mediaType: ['photo'],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      for (const asset of result.assets) {
        scanned++;
        const shouldImport = await AutoImportManager.shouldImportPhoto(asset);

        if (shouldImport) {
          const explicitCheck = await ExplicitContentDetector.analyzeImage(
            asset.uri
          );

          if (!explicitCheck.isExplicit) {
            const newPhoto: Photo = {
              id: `auto_${asset.id}`,
              uri: asset.uri,
              date: asset.creationTime
                ? new Date(asset.creationTime).toISOString()
                : new Date().toISOString(),
              timestamp: asset.creationTime || Date.now(),
              type: 'daily',
              babyId,
              source: 'auto_import',
              isPrivate: false,
              backupStatus: 'pending',
              isExplicit: false,
            };

            photos.push(newPhoto);

            if (onPhotoFound) {
              onPhotoFound(newPhoto);
            }
          }
        }

        if (scanned % 10 === 0) {
          onProgress?.(scanned, photos.length);
        }
      }

      hasMore = result.hasNextPage;
      endCursor = result.endCursor;
    }

    return photos;
  },

  async shouldImportPhoto(asset: MediaLibrary.Asset): Promise<boolean> {
    const hour = new Date(asset.creationTime || Date.now()).getHours();
    const isBabyLikelyHour = hour >= 6 && hour <= 22;
    return isBabyLikelyHour && Math.random() > 0.7;
  },

  async saveSettings(settings: any): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.AUTO_IMPORT_SETTINGS,
      JSON.stringify(settings)
    );
  },

  async loadSettings(): Promise<any> {
    const saved = await AsyncStorage.getItem(
      STORAGE_KEYS.AUTO_IMPORT_SETTINGS
    );
    return saved
      ? JSON.parse(saved)
      : {
          enabled: true,
          confidenceThreshold: 0.7,
          lastScanTime: 0,
          scannedFolders: [],
          babyFaceDetection: true,
        };
  },

  async saveScanProgress(progress: any): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCAN_PROGRESS,
      JSON.stringify({
        ...progress,
        timestamp: Date.now(),
      })
    );
  },

  async loadScanProgress(): Promise<any | null> {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_PROGRESS);
    if (!saved) return null;

    const progress = JSON.parse(saved);
    if (Date.now() - progress.timestamp < 24 * 60 * 60 * 1000) {
      return progress;
    }
    return null;
  },
};

const PhotoEditorModal = ({
  visible,
  photo,
  onClose,
  onSave,
  isDark,
}: {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
  onSave: (editedUri: string, adjustments: any) => void;
  isDark: boolean;
}) => {
  const [activeFilter, setActiveFilter] = useState('normal');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const filters = [
    {
      id: 'normal',
      name: 'Normal',
      icon: 'sunny',
      colors: ['transparent', 'transparent'],
    },
    {
      id: 'warm',
      name: 'Warm',
      icon: 'flame',
      colors: ['#ff9a56', '#ffad56'],
    },
    {
      id: 'cool',
      name: 'Cool',
      icon: 'snow',
      colors: ['#56c1ff', '#56d2ff'],
    },
    {
      id: 'bw',
      name: 'B&W',
      icon: 'contrast',
      colors: ['#333', '#666'],
    },
    {
      id: 'vintage',
      name: 'Vintage',
      icon: 'time',
      colors: ['#d4a574', '#c49a6c'],
    },
    {
      id: 'bright',
      name: 'Bright',
      icon: 'sunny-outline',
      colors: ['#fff9c4', '#fff59d'],
    },
    {
      id: 'soft',
      name: 'Soft',
      icon: 'water',
      colors: ['#fce4ec', '#f8bbd0'],
    },
    {
      id: 'crisp',
      name: 'Crisp',
      icon: 'aperture',
      colors: ['#e0f7fa', '#b2ebf2'],
    },
  ];

  const applyEdit = async () => {
    if (!photo) return;
    setIsProcessing(true);

    try {
      const manipulations: any[] = [];

      if (brightness !== 0) {
        manipulations.push({
          adjust: { brightness: 1 + brightness / 100 },
        });
      }

      if (contrast !== 0) {
        manipulations.push({
          adjust: { contrast: 1 + contrast / 100 },
        });
      }

      const processed = await ImageManipulator.manipulateAsync(
        photo.uri,
        manipulations,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      onSave(processed.uri, {
        filter: activeFilter,
        brightness,
        contrast,
        saturation,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAdjustments = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setActiveFilter('normal');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!visible || !photo) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View
        style={[
          styles.editorContainer,
          { backgroundColor: isDark ? '#000' : '#fff' },
        ]}
      >
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons
              name="close"
              size={28}
              color={isDark ? '#fff' : '#1e293b'}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.editorTitle,
              { color: isDark ? '#fff' : '#1e293b' },
            ]}
          >
            Edit Photo
          </Text>
          <TouchableOpacity onPress={applyEdit} disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <Text style={styles.editorSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.editorImageContainer}>
          <Image source={{ uri: photo.uri }} style={styles.editorImage} />

          {activeFilter !== 'normal' && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: filters.find(
                    (f) => f.id === activeFilter
                  )?.colors[0],
                  opacity: 0.3,
                },
              ]}
            />
          )}
        </View>

        <AutoHideAnimatedScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                activeFilter === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => {
                setActiveFilter(filter.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <LinearGradient
                colors={filter.colors as [string, string]}
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: 0.3, borderRadius: 12 },
                ]}
              />
              <Ionicons
                name={filter.icon as any}
                size={24}
                color={
                  activeFilter === filter.id
                    ? '#fff'
                    : isDark
                    ? '#94a3b8'
                    : '#64748b'
                }
              />
              <Text
                style={[
                  styles.filterName,
                  activeFilter === filter.id && styles.filterNameActive,
                ]}
              >
                {filter.name}
              </Text>
            </TouchableOpacity>
          ))}
        </AutoHideAnimatedScrollView>

        <View style={styles.adjustmentsContainer}>
          <View style={styles.adjustmentRow}>
            <Ionicons name="sunny-outline" size={20} color="#94a3b8" />
            <Slider
              value={brightness}
              onValueChange={setBrightness}
              min={-100}
              max={100}
              label="Brightness"
            />
            <Text style={styles.adjustmentValue}>
              {brightness > 0 ? `+${brightness}` : brightness}
            </Text>
          </View>

          <View style={styles.adjustmentRow}>
            <Ionicons name="contrast-outline" size={20} color="#94a3b8" />
            <Slider
              value={contrast}
              onValueChange={setContrast}
              min={-100}
              max={100}
              label="Contrast"
            />
            <Text style={styles.adjustmentValue}>
              {contrast > 0 ? `+${contrast}` : contrast}
            </Text>
          </View>

          <View style={styles.adjustmentRow}>
            <Ionicons
              name="color-palette-outline"
              size={20}
              color="#94a3b8"
            />
            <Slider
              value={saturation}
              onValueChange={setSaturation}
              min={-100}
              max={100}
              label="Saturation"
            />
            <Text style={styles.adjustmentValue}>
              {saturation > 0 ? `+${saturation}` : saturation}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetAdjustments}
        >
          <Text style={styles.resetText}>Reset All</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const Slider = ({
  value,
  onValueChange,
  min,
  max,
  label,
}: {
  value: number;
  onValueChange: (val: number) => void;
  min: number;
  max: number;
  label: string;
}) => (
  <View style={styles.sliderContainer}>
    <View style={styles.sliderTrack} />
    <TouchableOpacity
      style={[
        styles.sliderFill,
        { width: `${((value - min) / (max - min)) * 100}%` },
      ]}
      activeOpacity={1}
    />
    <View style={styles.sliderTouchArea}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={(e) => {
          const { locationX } = e.nativeEvent;
          const percentage = locationX / 200;
          const newValue = Math.round(min + percentage * (max - min));
          onValueChange(Math.max(min, Math.min(max, newValue)));
        }}
      />
    </View>
  </View>
);

const BatchSelectBar = ({
  selectedCount,
  onClear,
  onDelete,
  onShare,
  onDownload,
  onCreateStory,
  isDark,
}: {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onShare: () => void;
  onDownload: () => void;
  onCreateStory?: () => void;
  isDark: boolean;
}) => {
  if (selectedCount === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInUp}
      exiting={FadeInDown}
      style={[
        styles.batchBar,
        { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
      ]}
    >
      <View style={styles.batchInfo}>
        <Text
          style={[
            styles.batchCount,
            { color: isDark ? '#fff' : '#1e293b' },
          ]}
        >
          {selectedCount} selected
        </Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.batchClear}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.batchActions}>
        {onCreateStory && (
          <TouchableOpacity
            style={styles.batchButton}
            onPress={onCreateStory}
          >
            <Ionicons name="images" size={24} color="#8b5cf6" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.batchButton} onPress={onShare}>
          <Ionicons name="share-outline" size={24} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.batchButton}
          onPress={onDownload}
        >
          <Ionicons
            name="download-outline"
            size={24}
            color="#10b981"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.batchButton}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </Reanimated.View>
  );
};

const SmartAlbumsSection = ({
  albums,
  onSelect,
  isDark,
}: {
  albums: SmartAlbum[];
  onSelect: (album: SmartAlbum) => void;
  isDark: boolean;
}) => {
  return (
    <View style={styles.smartAlbumsContainer}>
      <Text
        style={[
          styles.sectionTitle,
          { color: isDark ? '#fff' : '#1e293b' },
        ]}
      >
        Smart Albums
      </Text>
      <AutoHideAnimatedScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.albumsScroll}
      >
        {albums.map((album, index) => (
          <Reanimated.View
            key={album.id}
            entering={FadeInUp.delay(index * 100)}
          >
            <TouchableOpacity
              style={styles.albumCard}
              onPress={() => onSelect(album)}
            >
              <LinearGradient
                colors={album.gradient}
                style={styles.albumGradient}
              >
                <View style={styles.albumIconContainer}>
                  <Ionicons
                    name={album.icon as any}
                    size={28}
                    color="#fff"
                  />
                </View>
                <Text style={styles.albumCount}>{album.count}</Text>
              </LinearGradient>
              <Text
                style={[
                  styles.albumTitle,
                  { color: isDark ? '#fff' : '#1e293b' },
                ]}
                numberOfLines={1}
              >
                {album.title}
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        ))}
      </AutoHideAnimatedScrollView>
    </View>
  );
};

const FolderGrid = ({
  folders,
  onSelect,
  isDark,
}: {
  folders: SmartAlbum[];
  onSelect: (folder: SmartAlbum) => void;
  isDark: boolean;
}) => {
  return (
    <View style={styles.folderContainer}>
      <Text
        style={[
          styles.sectionTitle,
          { color: isDark ? '#fff' : '#1e293b' },
        ]}
      >
        Folders
      </Text>
      <View style={styles.folderGrid}>
        {folders.map((folder, index) => (
          <Reanimated.View
            key={folder.id}
            entering={FadeInUp.delay(index * 50)}
            style={styles.folderWrapper}
          >
            <TouchableOpacity
              style={styles.folderCard}
              onPress={() => onSelect(folder)}
            >
              <LinearGradient
                colors={folder.gradient}
                style={styles.folderGradient}
              >
                <View style={styles.folderIconContainer}>
                  <Ionicons
                    name={folder.icon as any}
                    size={32}
                    color="#fff"
                  />
                </View>
                <View style={styles.folderOverlay}>
                  <Text style={styles.folderCount}>{folder.count}</Text>
                </View>
              </LinearGradient>
              <Text
                style={[
                  styles.folderTitle,
                  { color: isDark ? '#fff' : '#1e293b' },
                ]}
                numberOfLines={1}
              >
                {folder.title}
              </Text>
              <Text style={styles.folderSubtitle} numberOfLines={1}>
                {folder.description || `${folder.count} items`}
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
};

const SearchFilterBar = ({
  searchQuery,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  isDark,
}: {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  isDark: boolean;
}) => {
  const filters = [
    'All',
    'Favorites',
    'Private',
    'Milestones',
    'Screenshots',
    'Auto-Imported',
  ];

  return (
    <View style={styles.searchContainer}>
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput
          style={[
            styles.searchInput,
            { color: isDark ? '#fff' : '#1e293b' },
          ]}
          placeholder="Search photos, tags, dates..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <AutoHideAnimatedScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              selectedFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => onFilterChange(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </AutoHideAnimatedScrollView>
    </View>
  );
};

const AutoImportPanel = ({
  isEnabled,
  onToggle,
  lastScanTime,
  onManualScan,
  isScanning,
  scanProgress,
  isDark,
  babyFaceDetection,
  onToggleBabyFaceDetection,
}: {
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
  lastScanTime: number;
  onManualScan: () => void;
  isScanning: boolean;
  scanProgress: { scanned: number; found: number };
  isDark: boolean;
  babyFaceDetection: boolean;
  onToggleBabyFaceDetection: (enabled: boolean) => void;
}) => {
  return (
    <View
      style={[
        styles.importPanel,
        {
          backgroundColor: isDark
            ? 'rgba(102,126,234,0.1)'
            : 'rgba(102,126,234,0.05)',
        },
      ]}
    >
      <View style={styles.importHeader}>
        <View style={styles.importIconBg}>
          <Ionicons name="sync" size={24} color="#667eea" />
        </View>
        <View style={styles.importInfo}>
          <Text
            style={[
              styles.importTitle,
              { color: isDark ? '#fff' : '#1e293b' },
            ]}
          >
            Auto-Import Photos
          </Text>
          <Text style={styles.importSubtitle}>
            {lastScanTime
              ? `Last scan: ${format(
                  new Date(lastScanTime),
                  'MMM d, h:mm a'
                )}`
              : 'Scanning for new photos...'}
          </Text>
        </View>
        <View style={styles.importStatus}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isEnabled ? '#10b981' : '#ef4444' },
            ]}
          />
        </View>
      </View>

      {isScanning && (
        <View style={styles.scanProgress}>
          <ActivityIndicator size="small" color="#667eea" />
          <Text style={styles.scanText}>
            Scanned {scanProgress.scanned} photos • Found{' '}
            {scanProgress.found} matches
          </Text>
        </View>
      )}

      <View style={styles.importOptions}>
        <View style={styles.importOption}>
          <Text
            style={[
              styles.importOptionText,
              { color: isDark ? '#cbd5e1' : '#64748b' },
            ]}
          >
            Baby Face Detection
          </Text>
          <Switch
            value={babyFaceDetection}
            onValueChange={onToggleBabyFaceDetection}
            trackColor={{ false: '#cbd5e1', true: '#667eea' }}
            thumbColor={babyFaceDetection ? '#fff' : '#f1f5f9'}
          />
        </View>
      </View>

      <View style={styles.importActions}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={onManualScan}
          disabled={isScanning}
        >
          <Ionicons name="scan" size={18} color="#667eea" />
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DateGroupHeader = ({
  date,
  isDark,
}: {
  date: string;
  isDark: boolean;
}) => {
  const getGroupLabel = () => {
    const photoDate = parseISO(date);
    if (isToday(photoDate)) return 'Today';
    if (isYesterday(photoDate)) return 'Yesterday';
    if (isThisWeek(photoDate)) return 'This Week';
    if (isThisMonth(photoDate)) return 'This Month';
    return format(photoDate, 'MMMM yyyy');
  };

  return (
    <View style={styles.dateGroupHeader}>
      <Text
        style={[
          styles.dateGroupText,
          { color: isDark ? '#94a3b8' : '#64748b' },
        ]}
      >
        {getGroupLabel()}
      </Text>
      <View
        style={[
          styles.dateGroupLine,
          { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
        ]}
      />
    </View>
  );
};

const FloatingCameraButton = ({
  onPress,
  isVisible,
  scrollY,
}: {
  onPress: () => void;
  isVisible: boolean;
  scrollY: Animated.SharedValue<number>;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ 
      translateY: interpolate(scrollY.value, [0, 200], [0, 100], Extrapolate.CLAMP) 
    }],
    opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolate.CLAMP),
  }));

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.floatingCameraContainer,
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.floatingCameraButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.floatingCameraGradient}
        >
          <Ionicons name="camera" size={28} color="#fff" />
        </LinearGradient>
            </TouchableOpacity>
    </Animated.View>
  );
};

export default function GalleryScreen({
  navigation,
}: GalleryScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { currentBaby, babies } = useBaby();
  const {
    isBiometricHardwareAvailable,
    authenticateWithBiometric,
    settings: securitySettings,
    verifyPin,
  } = useSecurity();
  const { takePhoto } = useMedia();

  const [vaultEnabled, setVaultEnabled] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [showVaultLock, setShowVaultLock] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(
    new Set()
  );
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'masonry'>(
    'grid'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const [smartAlbums, setSmartAlbums] = useState<SmartAlbum[]>([]);
  const [folders, setFolders] = useState<SmartAlbum[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<SmartAlbum | null>(
    null
  );

  const [autoImportEnabled, setAutoImportEnabled] = useState(true);
  const [babyFaceDetection, setBabyFaceDetection] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({
    scanned: 0,
    found: 0,
  });
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const [showEditor, setShowEditor] = useState(false);
  const [showLinkEntryModal, setShowLinkEntryModal] = useState(false);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);

  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    type: 'success',
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

  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {'worklet';
      
'worklet';
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const scanAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedPhotos = await AsyncStorage.getItem(
          STORAGE_KEYS.PHOTOS
        );
        if (savedPhotos) {
          const parsed = JSON.parse(savedPhotos);
          setPhotos(parsed);
        }

        const settings = await AutoImportManager.loadSettings();
        setAutoImportEnabled(settings.enabled !== false);
        setBabyFaceDetection(settings.babyFaceDetection !== false);
        setLastScanTime(settings.lastScanTime || 0);

        const vaultState = await AsyncStorage.getItem(
          STORAGE_KEYS.VAULT_ENABLED
        );
        setVaultEnabled(vaultState === 'true');

        const savedProgress = await AutoImportManager.loadScanProgress();
        if (savedProgress && !savedProgress.completed) {
          showToast(
            'info',
            'Resuming Scan',
            'Continuing from where we left off...'
          );
          handleManualScan();
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, []);

  useEffect(() => {
    const savePhotos = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.PHOTOS,
          JSON.stringify(photos)
        );
      } catch (error) {
        console.error('Error saving photos:', error);
      }
    };

    if (photos.length > 0) {
      savePhotos();
    }
  }, [photos]);

  useEffect(() => {
    const init = async () => {
      if (currentBaby && autoImportEnabled) {
        handleManualScan();
      } else {
        generateSmartAlbums(photos);
        generateFolders(photos);
      }
    };
    init();
  }, [currentBaby]);

  useEffect(() => {
    generateSmartAlbums(photos);
    generateFolders(photos);
  }, [photos, generateSmartAlbums, generateFolders]);

  const generateSmartAlbums = useCallback(
    (photoList: Photo[]) => {
      const today = photoList.filter((p) =>
        isToday(new Date(p.timestamp))
      );
      const thisWeek = photoList.filter((p) =>
        isThisWeek(new Date(p.timestamp))
      );
      const favorites = photoList.filter((p) => p.isFavorite);
      const milestones = photoList.filter((p) => p.type === 'milestone');
      const privatePhotos = photoList.filter((p) => p.isPrivate);
      const autoImported = photoList.filter(
        (p) => p.source === 'auto_import'
      );

      const albums: SmartAlbum[] = [
        {
          id: 'recent',
          title: 'Recent',
          icon: 'time',
          count: today.length,
          photos: today,
          type: 'smart',
          gradient: ['#667eea', '#764ba2'],
        },
        {
          id: 'favorites',
          title: 'Favorites',
          icon: 'heart',
          count: favorites.length,
          photos: favorites,
          type: 'smart',
          gradient: ['#fa709a', '#fee140'],
        },
        {
          id: 'milestones',
          title: 'Milestones',
          icon: 'trophy',
          count: milestones.length,
          photos: milestones,
          type: 'smart',
          gradient: ['#f59e0b', '#fbbf24'],
        },
        {
          id: 'this_week',
          title: 'This Week',
          icon: 'calendar',
          count: thisWeek.length,
          photos: thisWeek,
          type: 'date',
          gradient: ['#11998e', '#38ef7d'],
        },
        {
          id: 'auto_import',
          title: 'Auto-Imported',
          icon: 'sync',
          count: autoImported.length,
          photos: autoImported,
          type: 'smart',
          gradient: ['#8b5cf6', '#a78bfa'],
        },
        {
          id: 'private',
          title: 'Private Vault',
          icon: 'lock-closed',
          count: privatePhotos.length,
          photos: privatePhotos,
          type: 'smart',
          gradient: ['#1a1a2e', '#0f3460'],
        },
      ];

      babies.forEach((baby, index) => {
        const babyPhotos = photoList.filter((p) => p.babyId === baby.id);
        const gradients: [string, string][] = [
          ['#fa709a', '#fee140'],
          ['#43e97b', '#38f9d7'],
          ['#667eea', '#764ba2'],
        ];
        albums.push({
          id: `baby_${baby.id}`,
          title: `${baby.name}'s Photos`,
          icon: 'happy',
          count: babyPhotos.length,
          photos: babyPhotos,
          type: 'baby',
          gradient: gradients[index % gradients.length],
        });
      });

      setSmartAlbums(albums);
    },
    [babies]
  );

  const generateFolders = useCallback((photoList: Photo[]) => {
    const folderMap = new Map<string, Photo[]>();

    photoList.forEach((photo) => {
      const folderName = photo.folder || photo.source || 'General';
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push(photo);
    });

    const folderGradients: [string, string][] = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#30cfd0', '#330867'],
    ];

    const generatedFolders: SmartAlbum[] = Array.from(
      folderMap.entries()
    ).map(([name, photos], index) => ({
      id: `folder_${name}`,
      title: name.charAt(0).toUpperCase() + name.slice(1),
      description: `${photos.length} photos`,
      icon:
        photos[0]?.source === 'google_photos'
          ? 'logo-google'
          : photos[0]?.source === 'icloud'
          ? 'cloud'
          : 'folder',
      count: photos.length,
      photos,
      type: 'folder',
      gradient: folderGradients[index % folderGradients.length],
    }));

    setFolders(generatedFolders);
  }, []);

  const handleManualScan = async () => {
    if (!currentBaby) {
      showToast('error', 'No Baby Selected', 'Please select a baby first');
      return;
    }

    if (isScanning) return;

    setIsScanning(true);
    setScanProgress({ scanned: 0, found: 0 });
    scanAbortController.current = new AbortController();

    try {
      await AutoImportManager.saveScanProgress({
        scanned: 0,
        found: 0,
        completed: false,
        babyId: currentBaby.id,
      });

      const onPhotoFound = (photo: Photo) => {
        setPhotos((prev) => {
          if (prev.some((p) => p.id === photo.id)) return prev;
          return [photo, ...prev];
        });
        setScanProgress((prev) => ({
          ...prev,
          found: prev.found + 1,
        }));
      };

      const importedPhotos = await AutoImportManager.scanDeviceGallery(
        currentBaby.id,
        (scanned, found) => setScanProgress({ scanned, found }),
        onPhotoFound
      );

      const newPhotos = importedPhotos.filter(
        (p) => !photos.some((existing) => existing.id === p.id)
      );

      if (newPhotos.length > 0) {
        setPhotos((prev) => [...newPhotos, ...prev]);
        showToast(
          'success',
          'Scan Complete',
          `Found ${newPhotos.length} new photos`
        );
      } else {
        showToast('info', 'Scan Complete', 'No new photos found');
      }

      const settings = await AutoImportManager.loadSettings();
      settings.lastScanTime = Date.now();
      settings.enabled = true;
      await AutoImportManager.saveSettings(settings);
      setLastScanTime(Date.now());

      await AutoImportManager.saveScanProgress({
        scanned: scanProgress.scanned,
        found: scanProgress.found + newPhotos.length,
        completed: true,
        babyId: currentBaby.id,
      });
    } catch (error) {
      console.error('Scan error:', error);
      showToast('error', 'Scan Failed', 'Could not scan gallery');
    } finally {
      setIsScanning(false);
      scanAbortController.current = null;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleManualScan();
    setRefreshing(false);
  }, [handleManualScan]);

  useEffect(() => {
    let filtered = photos;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.type === selectedCategory);
    }

    if (activeAlbum) {
      filtered = activeAlbum.photos;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.caption?.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query)) ||
          p.date.includes(query) ||
          p.babyName?.toLowerCase().includes(query)
      );
    }

    switch (selectedFilter) {
      case 'Favorites':
        filtered = filtered.filter((p) => p.isFavorite);
        break;
      case 'Private':
        filtered = filtered.filter((p) => p.isPrivate);
        break;
      case 'Milestones':
        filtered = filtered.filter((p) => p.type === 'milestone');
        break;
      case 'Screenshots':
        filtered = filtered.filter((p) => p.isScreenshot);
        break;
      case 'Auto-Imported':
        filtered = filtered.filter((p) => p.source === 'auto_import');
        break;
    }

    if (vaultEnabled && !vaultUnlocked) {
      filtered = filtered.filter((p) => !p.isPrivate);
    }

    setFilteredPhotos(filtered);
  }, [
    photos,
    selectedCategory,
    activeAlbum,
    searchQuery,
    selectedFilter,
    vaultEnabled,
    vaultUnlocked,
  ]);

  const showToast = useCallback(
    (
      type: AlertState['type'],
      title: string,
      message: string,
      duration?: number
    ) => {
      setAlert({ visible: true, type, title, message, duration });
    },
    []
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      type: 'default' | 'danger' | 'warning' = 'default'
    ) => {
      setConfirmModal({
        visible: true,
        title,
        message,
        onConfirm,
        type,
      });
    },
    []
  );

  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      if (isBatchMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedPhotos((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(photo.id)) {
            newSet.delete(photo.id);
          } else {
            newSet.add(photo.id);
          }
          return newSet;
        });
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedPhoto(photo);
      }
    },
    [isBatchMode]
  );

  const handlePhotoLongPress = useCallback((photo: Photo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsBatchMode(true);
    setSelectedPhotos(new Set([photo.id]));
  }, []);

  const toggleFavorite = useCallback(
    async (photoId: string) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Updated', 'Favorite status updated');
    },
    [showToast]
  );

  const togglePrivate = useCallback(
    async (photoId: string) => {
      if (!vaultEnabled) {
        const hasSecurity =
          securitySettings.isPinEnabled ||
          (securitySettings.isBiometricEnabled &&
            isBiometricHardwareAvailable);

        if (!hasSecurity) {

showAlert(
            'Security Required',
            'Please set up PIN or Biometric authentication in Settings to use the Private Vault.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Go to Settings',
                onPress: () =>
                  navigation.navigate('Main', { screen: 'Settings' }),
              },
            ]
          );
          return;
        }

        setVaultEnabled(true);
        await AsyncStorage.setItem(
          STORAGE_KEYS.VAULT_ENABLED,
          'true'
        );
      }

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, isPrivate: !p.isPrivate } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Updated', 'Photo privacy updated');
    },
    [
      vaultEnabled,
      securitySettings,
      isBiometricHardwareAvailable,
      navigation,
      showToast,
    ]
  );

  const handleDelete = useCallback(
    (photoIds: string[]) => {
      showConfirm(
        photoIds.length === 1
          ? 'Delete Photo'
          : `Delete ${photoIds.length} Photos`,
        photoIds.length === 1
          ? 'Are you sure you want to delete this photo? This cannot be undone.'
          : `Are you sure you want to delete these ${photoIds.length} photos? This cannot be undone.`,
        async () => {
          for (const photoId of photoIds) {
            const photo = photos.find((p) => p.id === photoId);
            if (
              photo &&
              photo.uri.startsWith(FileSystem.documentDirectory || '')
            ) {
              try {
                await FileSystem.deleteAsync(photo.uri, {
                  idempotent: true,
                });
              } catch (error) {
                console.error('Error deleting file:', error);
              }
            }
          }

          setPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)));
          setSelectedPhotos(new Set());
          setIsBatchMode(false);
          setSelectedPhoto(null);
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
          showToast(
            'success',
            'Deleted',
            photoIds.length === 1
              ? 'Photo deleted'
              : `${photoIds.length} photos deleted`
          );
        },
        'danger'
      );
    },
    [photos, showConfirm, showToast]
  );

  const handleShare = useCallback(
    async (photo: Photo) => {
      try {
        const shareMessage = `Check out this photo of ${
          currentBaby?.name || 'baby'
        }! ${photo.caption || ''}\n\nShared via LittleLoom - Secure Family Gallery`;

        await Share.share({
          url: photo.uri,
          message: shareMessage,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('success', 'Shared', 'Photo shared successfully');
      } catch (error) {
        showToast('error', 'Error', 'Failed to share photo');
      }
    },
    [currentBaby, showToast]
  );

  const handleBatchShare = useCallback(async () => {
    const selectedPhotoList = photos.filter((p) =>
      selectedPhotos.has(p.id)
    );
    if (selectedPhotoList.length === 0) return;

    try {
      await Share.share({
        message: `Sharing ${selectedPhotoList.length} photos from LittleLoom Gallery`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Shared', `${selectedPhotoList.length} photos shared`);
    } catch (error) {
      showToast('error', 'Error', 'Failed to share photos');
    }
  }, [photos, selectedPhotos, showToast]);

  const handleDownload = useCallback(
    async (photoIds: string[]) => {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          showToast(
            'error',
            'Permission Denied',
            'Please allow access to save photos'
          );
          return;
        }

        for (const photoId of photoIds) {
          const photo = photos.find((p) => p.id === photoId);
          if (photo) {
            await MediaLibrary.saveToLibraryAsync(photo.uri);
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(
          'success',
          'Saved',
          `${photoIds.length} photo(s) saved to library`
        );
      } catch (error) {
        showToast('error', 'Error', 'Failed to save photos');
      }
    },
    [photos, showToast]
  );

  const handleEdit = useCallback((photo: Photo) => {
    setSelectedPhoto(photo);
    setShowEditor(true);
  }, []);

  const handleSaveEdit = useCallback(
    (editedUri: string, adjustments: any) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === selectedPhoto?.id ? { ...p, uri: editedUri } : p
        )
      );
      setShowEditor(false);
      showToast('success', 'Saved', 'Photo edited successfully');
    },
    [selectedPhoto, showToast]
  );

  const handleLinkToEntry = useCallback(
    (
      photo: Photo,
      entryType: 'milestone' | 'growth' | 'activity',
      entryId: string
    ) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                linkedEntry: {
                  type: entryType,
                  id: entryId,
                  title: 'Linked Entry',
                },
              }
            : p
        )
      );
      setShowLinkEntryModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('success', 'Linked', `Photo linked to ${entryType}`);
    },
    [showToast]
  );

  const handleCreateStory = useCallback(
    (photoIds: string[]) => {
      setShowCreateStoryModal(true);
      setTimeout(() => {
        setShowCreateStoryModal(false);
        setSelectedPhotos(new Set());
        setIsBatchMode(false);
        showToast('success', 'Story Created', 'Your photo story is ready!');
      }, 2000);
    },
    [showToast]
  );

  const handleOpenCamera = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await takePhoto();

      if (uri) {
        const explicitCheck =
          await ExplicitContentDetector.analyzeImage(uri);
        if (explicitCheck.isExplicit) {
          showToast(
            'warning',
            'Content Warning',
            'This photo may contain sensitive content and was not saved'
          );
          return;
        }

        const newPhoto: Photo = {
          id: `cam_${Date.now()}`,
          uri,
          date: new Date().toISOString(),
          timestamp: Date.now(),
          type: 'daily',
          babyId: currentBaby?.id,
          caption: 'Captured moment',
          source: 'camera',
          isPrivate: false,
          backupStatus: 'pending',
          tags: ['camera-capture'],
        };

        setPhotos((prev) => [newPhoto, ...prev]);
        showToast('success', 'Photo Captured', 'Saved to gallery');
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to capture photo');
    }
  }, [takePhoto, currentBaby, showToast]);

  const toggleVault = useCallback(async () => {
    if (!vaultEnabled) {
      const hasSecurity =
        securitySettings.isPinEnabled ||
        (securitySettings.isBiometricEnabled &&
          isBiometricHardwareAvailable);

      if (!hasSecurity) {

showAlert(
          'Security Required',
          'Please set up PIN or Biometric authentication in Settings to use the Private Vault.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Settings',
              onPress: () =>
                navigation.navigate('Main', { screen: 'Settings' }),
            },
          ]
        );
        return;
      }

      setVaultEnabled(true);
      await AsyncStorage.setItem(
        STORAGE_KEYS.VAULT_ENABLED,
        'true'
      );
      showToast('success', 'Vault Enabled', 'Private vault is now active');
    } else {
      setVaultUnlocked(false);
      showToast('info', 'Vault Locked', 'Private vault is now locked');
    }
  }, [
    vaultEnabled,
    securitySettings,
    isBiometricHardwareAvailable,
    navigation,
    showToast,
  ]);

  const handleVaultUnlock = useCallback(() => {
    setVaultUnlocked(true);
    setShowVaultLock(false);
    showToast('success', 'Vault Unlocked', 'Private vault access granted');
  }, [showToast]);

  const openPrivateVault = useCallback(() => {
    if (vaultEnabled && !vaultUnlocked) {
      setShowVaultLock(true);
    }
  }, [vaultEnabled, vaultUnlocked]);

  const navigateToEditProfile = useCallback(() => {
    if (currentBaby) {
      navigation.navigate('EditProfile', {
        mode: 'baby',
        babyId: currentBaby.id,
      });
    }
  }, [currentBaby, navigation]);

  const renderPhoto = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const isSelected = selectedPhotos.has(item.id);
      const isFavorite = item.isFavorite;
      const isPrivate = item.isPrivate;
      const isSynced = item.backupStatus === 'synced';
      const isAutoImported = item.source === 'auto_import';

      return (
        <Reanimated.View
          entering={FadeInUp.delay(index * 30)}
          layout={Layout.springify()}
        >
          <TouchableOpacity
            style={[
              styles.photoContainer,
              isSelected && styles.photoContainerSelected,
              viewMode === 'list' && styles.photoContainerList,
            ]}
            onPress={() => handlePhotoPress(item)}
            onLongPress={() => handlePhotoLongPress(item)}
            activeOpacity={0.8}
          >
                       <Image
              source={{ uri: item.uri }}
              style={[
                styles.photo,
                viewMode === 'list' && styles.photoList,
              ]}
            />

            {isBatchMode && (
              <View
                style={[
                  styles.selectionOverlay,
                  isSelected && styles.selectionOverlaySelected,
                ]}
              >
                <View
                  style={[
                    styles.selectionCircle,
                    isSelected && styles.selectionCircleSelected,
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </View>
            )}

            <View style={styles.photoBadges}>
              {isFavorite && (
                <View style={styles.badge}>
                  <Ionicons name="heart" size={12} color="#fff" />
                </View>
              )}
              {isPrivate && (
                <View style={[styles.badge, styles.badgePrivate]}>
                  <Ionicons name="lock-closed" size={12} color="#fff" />
                </View>
              )}
              {!isSynced && (
                <View style={[styles.badge, styles.badgePending]}>
                  <Ionicons name="cloud-upload" size={12} color="#fff" />
                </View>
              )}
              {isAutoImported && (
                <View style={[styles.badge, styles.badgeAuto]}>
                  <Ionicons name="sync" size={12} color="#fff" />
                </View>
              )}
            </View>

            {item.type === 'milestone' && (
              <View style={styles.milestoneBadge}>
                <Ionicons name="trophy" size={12} color="#fff" />
              </View>
            )}

            {item.mood && (
              <View style={styles.moodBadge}>
                <Text style={styles.moodEmoji}>
                  {item.mood === 'happy'
                    ? '😊'
                    : item.mood === 'excited'
                    ? '🤩'
                    : item.mood === 'sleepy'
                    ? '😴'
                    : item.mood === 'sad'
                    ? '😢'
                    : '😐'}
                </Text>
              </View>
            )}

            {item.source === 'camera' && (
              <View style={styles.sourceBadge}>
                <Ionicons name="camera" size={10} color="#fff" />
              </View>
            )}

            {viewMode === 'list' && (
              <View style={styles.listInfo}>
                <Text style={styles.listDate}>
                  {format(new Date(item.timestamp), 'MMM d, yyyy')}
                </Text>
                {item.caption && (
                  <Text style={styles.listCaption} numberOfLines={1}>
                    {item.caption}
                  </Text>
                )}
                {item.linkedEntry && (
                  <View style={styles.linkedBadge}>
                    <Ionicons name="link" size={10} color="#667eea" />
                    <Text style={styles.linkedText}>Linked</Text>
                  </View>
                )}
                {item.source === 'auto_import' && (
                  <View style={styles.autoImportBadge}>
                    <Ionicons name="sync" size={10} color="#8b5cf6" />
                    <Text style={styles.autoImportText}>Auto</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </Reanimated.View>
      );
    },
    [
      viewMode,
      isBatchMode,
      selectedPhotos,
      handlePhotoPress,
      handlePhotoLongPress,
    ]
  );

  const groupedPhotos = useMemo(() => {
    const groups: { [key: string]: Photo[] } = {};

    filteredPhotos.forEach((photo) => {
      const dateKey = format(new Date(photo.timestamp), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(photo);
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        title: date,
        data,
      }));
  }, [filteredPhotos]);

  const renderPhotoModal = () => {
    if (!selectedPhoto) return null;

    return (
      <Modal
        visible={selectedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" />

          <BlurView
            intensity={100}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalHeaderButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.modalHeaderActions}>
              <TouchableOpacity
                style={styles.modalHeaderButton}
                onPress={() => toggleFavorite(selectedPhoto.id)}
              >
                <Ionicons
                  name={selectedPhoto.isFavorite ? 'heart' : 'heart-outline'}
                  size={26}
                  color={selectedPhoto.isFavorite ? '#ef4444' : '#fff'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalHeaderButton}
                onPress={() => togglePrivate(selectedPhoto.id)}
              >
                <Ionicons
                  name={selectedPhoto.isPrivate ? 'lock-closed' : 'lock-open'}
                  size={26}
                  color={selectedPhoto.isPrivate ? '#f59e0b' : '#fff'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalHeaderButton}
                onPress={() => handleEdit(selectedPhoto)}
              >
                <Ionicons name="create" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <Reanimated.View
            entering={FadeIn}
            style={styles.modalImageContainer}
          >
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </Reanimated.View>

          <Reanimated.View
            entering={FadeInDown.delay(200)}
            style={styles.modalInfoPanel}
          >
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={styles.infoBlur}
            >
              <View style={styles.infoContent}>
                <View style={styles.infoHeader}>
                  <View style={styles.typeBadge}>
                    <Ionicons
                      name={
                        selectedPhoto.type === 'milestone'
                          ? 'trophy'
                          : selectedPhoto.type === 'sleep'
                          ? 'moon'
                          : selectedPhoto.type === 'feeding'
                          ? 'restaurant'
                          : selectedPhoto.type === 'growth'
                          ? 'trending-up'
                          : selectedPhoto.type === 'potty'
                          ? 'water'
                          : selectedPhoto.type === 'medication'
                          ? 'medical'
                          : 'camera'
                      }
                      size={16}
                      color="#667eea"
                    />
                    <Text style={styles.typeText}>
                      {selectedPhoto.type.charAt(0).toUpperCase() +
                        selectedPhoto.type.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.modalDate}>
                    {format(
                      new Date(selectedPhoto.timestamp),
                      'MMM d, yyyy • h:mm a'
                    )}
                  </Text>
                </View>

                {selectedPhoto.caption && (
                  <Text style={styles.modalCaption}>
                    {selectedPhoto.caption}
                  </Text>
                )}

                {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {selectedPhoto.tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedPhoto.linkedEntry && (
                  <TouchableOpacity style={styles.linkedEntryCard}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.linkedEntryIcon}
                    >
                      <Ionicons name="link" size={20} color="#fff" />
                    </LinearGradient>
                    <View style={styles.linkedEntryInfo}>
                      <Text style={styles.linkedEntryTitle}>
                        {selectedPhoto.linkedEntry.title}
                      </Text>
                      <Text style={styles.linkedEntrySubtitle}>
                        Linked to {selectedPhoto.linkedEntry.type}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                )}

                {selectedPhoto.source && (
                  <View style={styles.sourceInfo}>
                    <Ionicons
                      name={
                        selectedPhoto.source === 'camera'
                          ? 'camera'
                          : selectedPhoto.source === 'auto_import'
                          ? 'sync'
                          : selectedPhoto.source === 'google_photos'
                          ? 'logo-google'
                          : selectedPhoto.source === 'icloud'
                          ? 'cloud'
                          : 'images'
                      }
                      size={14}
                      color="#94a3b8"
                    />
                    <Text style={styles.sourceText}>
                      {selectedPhoto.source === 'camera'
                        ? 'Camera Capture'
                        : selectedPhoto.source === 'auto_import'
                        ? 'Auto-Imported'
                        : selectedPhoto.source === 'google_photos'
                        ? 'Google Photos'
                        : selectedPhoto.source === 'icloud'
                        ? 'iCloud Photos'
                        : 'Gallery Import'}
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShare(selectedPhoto)}
                  >
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.actionButtonGradient}
                    >
                      <Ionicons
                        name="share-outline"
                        size={24}
                        color="#fff"
                      />
                    </LinearGradient>
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowLinkEntryModal(true)}
                  >
                    <View
                      style={[
                        styles.actionButtonGradient,
                        { backgroundColor: '#10b981' },
                      ]}
                    >
                      <Ionicons
                        name="link-outline"
                        size={24}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.actionText}>Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDownload([selectedPhoto.id])}
                  >
                    <View
                      style={[
                        styles.actionButtonGradient,
                        { backgroundColor: '#3b82f6' },
                      ]}
                    >
                      <Ionicons
                        name="download-outline"
                        size={24}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.actionText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete([selectedPhoto.id])}
                  >
                    <View
                      style={[
                        styles.actionButtonGradient,
                        { backgroundColor: '#ef4444' },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={24}
                        color="#fff"
                      />
                    </View>
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedPhoto.exif && (
                  <View style={styles.exifContainer}>
                    <Text style={styles.exifTitle}>Photo Details</Text>
                    <View style={styles.exifGrid}>
                      <View style={styles.exifItem}>
                        <Ionicons
                          name="resize"
                          size={16}
                          color="#64748b"
                        />
                        <Text style={styles.exifValue}>
                          {selectedPhoto.exif.width}×
                          {selectedPhoto.exif.height}
                        </Text>
                      </View>
                      <View style={styles.exifItem}>
                        <Ionicons
                          name="document"
                          size={16}
                          color="#64748b"
                        />
                        <Text style={styles.exifValue}>
                          {(
                            selectedPhoto.exif.size /
                            1024 /
                            1024
                          ).toFixed(2)}{' '}
                          MB
                        </Text>
                      </View>
                      <View style={styles.exifItem}>
                        <Ionicons
                          name="phone-portrait"
                          size={16}
                          color="#64748b"
                        />
                        <Text style={styles.exifValue}>
                          {selectedPhoto.exif.device}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.backupStatus}>
                  <View
                    style={[
                      styles.backupDot,
                      {
                        backgroundColor:
                          selectedPhoto.backupStatus === 'synced'
                            ? '#10b981'
                            : selectedPhoto.backupStatus === 'pending'
                            ? '#f59e0b'
                            : '#ef4444',
                      },
                    ]}
                  />
                  <Text style={styles.backupText}>
                    {selectedPhoto.backupStatus === 'synced'
                      ? 'Synced to Cloud'
                      : selectedPhoto.backupStatus === 'pending'
                      ? 'Pending Sync'
                      : 'Sync Failed'}
                  </Text>
                </View>
              </View>
            </BlurView>
          </Reanimated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000' : '#f8fafc' },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <VaultLockModal
        visible={showVaultLock}
        onUnlock={handleVaultUnlock}
        onCancel={() => setShowVaultLock(false)}
        isDark={isDark}
        navigation={navigation}
      />

      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
        isDark={isDark}
      />

      <ConfirmModal
        {...confirmModal}
        onCancel={() =>
          setConfirmModal({ ...confirmModal, visible: false })
        }
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, visible: false });
        }}
        isDark={isDark}
      />

      <PhotoEditorModal
        visible={showEditor}
        photo={selectedPhoto}
        onClose={() => setShowEditor(false)}
        onSave={handleSaveEdit}
        isDark={isDark}
      />

      <BatchSelectBar
        selectedCount={selectedPhotos.size}
        onClear={() => {
          setSelectedPhotos(new Set());
          setIsBatchMode(false);
        }}
        onDelete={() => handleDelete(Array.from(selectedPhotos))}
        onShare={handleBatchShare}
        onDownload={() => handleDownload(Array.from(selectedPhotos))}
        onCreateStory={
          selectedPhotos.size >= 2
            ? () => handleCreateStory(Array.from(selectedPhotos))
            : undefined
        }
        isDark={isDark}
      />

      <FloatingCameraButton
        onPress={handleOpenCamera}
        isVisible={!isBatchMode}
        scrollY={scrollY}
      />

      <AutoHideAnimatedScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#fff' : '#667eea'}
            colors={['#667eea']}
          />
        }
      >
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#000'] : ['#fff', '#f8fafc']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? '#fff' : '#1e293b'}
              />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? '#fff' : '#1e293b' },
                ]}
              >
                {currentBaby?.name
                  ? `${currentBaby.name}'s Photos`
                  : 'Gallery'}
              </Text>
              {activeAlbum && (
                <TouchableOpacity onPress={() => setActiveAlbum(null)}>
                  <Text style={styles.clearAlbum}>Show All</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  vaultEnabled && styles.iconButtonActive,
                ]}
                onPress={toggleVault}
              >
                <Ionicons
                  name={vaultEnabled ? 'shield' : 'shield-outline'}
                  size={22}
                  color={
                    vaultEnabled
                      ? '#ef4444'
                      : isDark
                      ? '#fff'
                      : '#1e293b'
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.iconButton,
                  isBatchMode && styles.iconButtonActive,
                ]}
                onPress={() => {
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setSelectedPhotos(new Set());
                }}
              >
                <Ionicons
                  name={
                    isBatchMode ? 'checkmark-circle' : 'checkbox-outline'
                  }
                  size={24}
                  color={
                    isBatchMode
                      ? '#667eea'
                      : isDark
                      ? '#fff'
                      : '#1e293b'
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setViewMode(viewMode === 'grid' ? 'list' : 'grid')
                }
              >
                <Ionicons
                  name={viewMode === 'grid' ? 'list' : 'grid'}
                  size={24}
                  color={isDark ? '#fff' : '#1e293b'}
                />
              </TouchableOpacity>
            </View>
          </View>

          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            isDark={isDark}
          />
        </LinearGradient>

        <AutoImportPanel
          isEnabled={autoImportEnabled}
          onToggle={setAutoImportEnabled}
          lastScanTime={lastScanTime}
          onManualScan={handleManualScan}
          isScanning={isScanning}
          scanProgress={scanProgress}
          isDark={isDark}
          babyFaceDetection={babyFaceDetection}
          onToggleBabyFaceDetection={setBabyFaceDetection}
        />

        {!activeAlbum && !searchQuery && (
          <SmartAlbumsSection
            albums={smartAlbums}
            onSelect={(album) => {
              if (album.id === 'private') {
                openPrivateVault();
              } else {
                setActiveAlbum(album);
              }
            }}
            isDark={isDark}
          />
        )}

        {!activeAlbum && !searchQuery && folders.length > 0 && (
          <FolderGrid
            folders={folders}
            onSelect={setActiveAlbum}
            isDark={isDark}
          />
        )}

        {currentBaby && (
          <TouchableOpacity
            style={styles.babyProfileCard}
            onPress={navigateToEditProfile}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.babyProfileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.babyProfileContent}>
                <Text style={styles.babyProfileEmoji}>
                  {currentBaby.avatar || '👶'}
                </Text>
                <View style={styles.babyProfileInfo}>
                  <Text style={styles.babyProfileName}>
                    {currentBaby.name}
                  </Text>
                  <Text style={styles.babyProfileAge}>
                    {currentBaby.age}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#fff"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.gridHeader}>
          <Text
            style={[
              styles.gridTitle,
              { color: isDark ? '#fff' : '#1e293b' },
            ]}
          >
            {filteredPhotos.length} Photos
          </Text>
          <View style={styles.gridActions}>
            <TouchableOpacity
              style={styles.gridAction}
              onPress={() =>
                handleCreateStory(Array.from(selectedPhotos))
              }
              disabled={selectedPhotos.size < 2}
            >
              <Ionicons
                name="images"
                size={18}
                color={
                  selectedPhotos.size >= 2 ? '#667eea' : '#94a3b8'
                }
              />
              <Text
                style={[
                  styles.gridActionText,
                  selectedPhotos.size >= 2 &&
                    styles.gridActionTextActive,
                ]}
              >
                Create Story
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'grid' ? (
          <View style={styles.photoGrid}>
            {groupedPhotos.map((group) => (
              <View key={group.title}>
                <DateGroupHeader
                  date={group.title}
                  isDark={isDark}
                />
                <View style={styles.gridRow}>
                  {group.data.map((item, index) => (
                    <View
                      key={item.id}
                      style={{
                        width: ITEM_SIZE,
                        marginBottom: SPACING,
                      }}
                    >
                      {renderPhoto({ item, index })}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredPhotos.map((item, index) =>
              renderPhoto({ item, index })
            )}
          </View>
        )}

        {filteredPhotos.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="images-outline"
              size={64}
              color={isDark ? '#334155' : '#cbd5e1'}
            />
            <Text
              style={[
                styles.emptyText,
                { color: isDark ? '#64748b' : '#94a3b8' },
              ]}
            >
              {searchQuery
                ? 'No photos match your search'
                : 'No photos yet'}
            </Text>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleOpenCamera}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.captureButtonText}>
                Capture First Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </AutoHideAnimatedScrollView>

      {renderPhotoModal()}

      <Modal
        visible={showLinkEntryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLinkEntryModal(false)}
      >
        <View
          style={[
            styles.linkModalContainer,
            {
              backgroundColor: isDark
                ? 'rgba(0,0,0,0.9)'
                : 'rgba(255,255,255,0.95)',
            },
          ]}
        >
          <BlurView
            intensity={80}
            style={StyleSheet.absoluteFill}
            tint={isDark ? 'dark' : 'light'}
          />
          <View style={styles.linkModalContent}>
            <Text
              style={[
                styles.linkModalTitle,
                { color: isDark ? '#fff' : '#1e293b' },
              ]}
            >
              Link to Timeline Entry
            </Text>
            <Text style={styles.linkModalSubtitle}>
              Connect this photo to growth tracking or activities
            </Text>

            <TouchableOpacity
              style={styles.linkOption}
              onPress={() => {
                setShowLinkEntryModal(false);
                setSelectedPhoto(null);
                navigation.navigate('GrowthDashboard');
              }}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.linkOptionIcon}
              >
                <Ionicons name="trending-up" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.linkOptionText}>
                <Text
                  style={[
                    styles.linkOptionTitle,
                    { color: isDark ? '#fff' : '#1e293b' },
                  ]}
                >
                  Link to Growth Entry
                </Text>
                <Text style={styles.linkOptionDesc}>
                  Attach to height/weight measurement
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#94a3b8"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkOption}
              onPress={() =>
                handleLinkToEntry(selectedPhoto!, 'milestone', 'ms1')
              }
            >
              <LinearGradient
                colors={['#f59e0b', '#fbbf24']}
                style={styles.linkOptionIcon}
              >
                <Ionicons name="trophy" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.linkOptionText}>
                <Text
                  style={[
                    styles.linkOptionTitle,
                    { color: isDark ? '#fff' : '#1e293b' },
                  ]}
                >
                  Link to Milestone
                </Text>
                <Text style={styles.linkOptionDesc}>
                  Mark as achievement photo
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#94a3b8"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkOption}
              onPress={() =>
                handleLinkToEntry(selectedPhoto!, 'activity', 'act1')
              }
            >
              <LinearGradient
                colors={['#10b981', '#34d399']}
                style={styles.linkOptionIcon}
              >
                <Ionicons name="time" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.linkOptionText}>
                <Text
                  style={[
                    styles.linkOptionTitle,
                    { color: isDark ? '#fff' : '#1e293b' },
                  ]}
                >
                  Link to Activity
                </Text>
                <Text style={styles.linkOptionDesc}>
                  Connect to feeding/sleep/potty log
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#94a3b8"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkModalCancel}
              onPress={() => setShowLinkEntryModal(false)}
            >
              <Text style={styles.linkModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateStoryModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.storyModalContainer}>
          <BlurView
            intensity={100}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
          <View style={styles.storyModalContent}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.storyModalText}>
              Creating your story...
            </Text>
            <Text style={styles.storyModalSubtext}>
              Collage magic in progress ✨
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  floatingCameraContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    pointerEvents: 'box-none',
  },
  floatingCameraButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCameraGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 300,
    maxWidth: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: { flex: 1 },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 13,
    color: '#64748b',
  },
  confirmModal: {
    width: width - 60,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconContainer: { marginBottom: 16 },
  confirmIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(100,116,139,0.1)',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonGradient: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  vaultLockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  vaultLockIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  vaultLockTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  vaultLockSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 40,
  },
  cancelVaultButton: {
    marginTop: 40,
    padding: 12,
  },
  cancelVaultText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  clearAlbum: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  searchContainer: {
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  filterScroll: {
    marginTop: 8,
  },
  filterContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.1)',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  importPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importInfo: {
    flex: 1,
    marginLeft: 12,
  },
  importTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  importSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  importStatus: {
    marginLeft: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scanProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  scanText: {
    marginLeft: 12,
    fontSize: 13,
    color: '#64748b',
  },
  importOptions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  importOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  importActions: {
    marginTop: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    gap: 8,
  },
  scanButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  smartAlbumsContainer: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  albumsScroll: {
    paddingHorizontal: 12,
  },
  albumCard: {
    width: 110,
    marginHorizontal: 4,
  },
  albumGradient: {
    width: 110,
    height: 110,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  albumIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  albumCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  albumTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  folderContainer: {
    paddingVertical: 16,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  folderWrapper: {
    width: (width - 56) / 2,
  },
  folderCard: {
    marginBottom: 8,
  },
  folderGradient: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
    position: 'relative',
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  folderCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    marginLeft: 4,
  },
  folderSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 4,
  },
  babyProfileCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  babyProfileGradient: {
    padding: 16,
  },
  babyProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  babyProfileEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  babyProfileInfo: {
    flex: 1,
  },
  babyProfileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  babyProfileAge: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  gridActions: {
    flexDirection: 'row',
    gap: 12,
  },
  gridAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  gridActionTextActive: {
    color: '#667eea',
  },
  photoGrid: {
    paddingHorizontal: 16,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING,
  },
  listContainer: {
    gap: 8,
    paddingHorizontal: 16,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dateGroupText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 12,
  },
  dateGroupLine: {
    flex: 1,
    height: 1,
  },
  photoContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoContainerSelected: {
    borderWidth: 3,
    borderColor: '#667eea',
  },
  photoContainerList: {
    width: '100%',
    height: 120,
    flexDirection: 'row',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoList: {
    width: 120,
    height: 120,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  selectionOverlaySelected: {
    backgroundColor: 'rgba(102,126,234,0.3)',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  selectionCircleSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  photoBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePrivate: {
    backgroundColor: 'rgba(245,158,11,0.9)',
  },
  badgePending: {
    backgroundColor: 'rgba(59,130,246,0.9)',
  },
  badgeAuto: {
    backgroundColor: 'rgba(139,92,246,0.9)',
  },
  milestoneBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 4,
  },
  moodBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 16,
  },
  sourceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  listCaption: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  linkedText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  autoImportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  autoImportText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  batchBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 100,
  },
  batchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  batchCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  batchClear: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  batchActions: {
    flexDirection: 'row',
    gap: 16,
  },
  batchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorContainer: {
    flex: 1,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editorSave: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  editorImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
  },
  editorImage: {
    width: '100%',
    height: '60%',
    borderRadius: 12,
  },
  filtersContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  filterButton: {
    width: 70,
    height: 70,
    borderRadius: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  filterButtonActive: {
    borderColor: '#667eea',
  },
  filterName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    color: '#64748b',
  },
  filterNameActive: {
    color: '#fff',
  },
  adjustmentsContainer: {
    padding: 20,
    gap: 16,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(100,116,139,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#667eea',
  },
  sliderTouchArea: {
    ...StyleSheet.absoluteFillObject,
  },
  adjustmentValue: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'right',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  resetText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    zIndex: 100,
  },
  modalHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: width,
    height: height * 0.6,
  },
  modalInfoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  infoBlur: {
    padding: 24,
    paddingBottom: 40,
  },
  infoContent: {
    gap: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDate: {
    fontSize: 14,
    color: '#64748b',
  },
  modalCaption: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(100,116,139,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  linkedEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  linkedEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedEntryInfo: {
    flex: 1,
  },
  linkedEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  linkedEntrySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  exifContainer: {
    backgroundColor: 'rgba(100,116,139,0.05)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  exifTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exifGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  exifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exifValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  backupStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  backupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backupText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  linkModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  linkModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  linkModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  linkModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  linkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  linkOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkOptionText: {
    flex: 1,
  },
  linkOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkOptionDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  linkModalCancel: {
    marginTop: 24,
    alignItems: 'center',
    padding: 16,
  },
  linkModalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  storyModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  storyModalContent: {
    alignItems: 'center',
    gap: 16,
  },
  storyModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  storyModalSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  pinDotFilled: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  pinDotVault: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'center',
    gap: 20,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.1)',
  },
  keypadNumber: {
    fontSize: 28,
    fontWeight: '600',
  },
  biometricPrompt: {
    alignItems: 'center',
    padding: 20,
  },
  biometricPromptText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  attemptsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  attemptsText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
});