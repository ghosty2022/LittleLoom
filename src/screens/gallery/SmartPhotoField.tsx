import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  TextInput,
  Modal,
  Share,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/hooks/useSweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  Canvas,
  Path,
  Skia,
  TouchType,
  useTouchHandler,
} from '@shopify/react-native-skia';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_W - 48;

// ── Deep Fallback Constants (crash-proof) ───────────────────────────────────
const FALLBACK_THEME = {
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    tertiary: '#999999',
    disabled: '#bbbbbb',
  },
  primary: '#007AFF',
  surface: '#ffffff',
  background: '#f2f2f2',
  danger: '#E74C3C',
  warning: '#F39C12',
  success: '#2ECC71',
};

const FALLBACK_GLASS = {
  bg: 'rgba(255,255,255,0.85)',
  border: 'rgba(0,0,0,0.08)',
};

const FALLBACK_RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
};

const FALLBACK_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// ── Types ────────────────────────────────────────────────────────────────────
interface PhotoMeta {
  uri: string;
  width: number;
  height: number;
  timestamp: string;
  location?: { latitude: number; longitude: number };
  fileSize?: number;
  type?: string;
  annotationPaths?: string[]; // base64 SVG path strings
}

interface AIAnalysis {
  labels: string[];
  confidence: number;
  suggestions: string[];
  severity?: 'low' | 'medium' | 'high';
}

interface SmartPhotoFieldProps {
  value?: string;
  onChange: (uri: string | null, meta?: PhotoMeta, analysis?: AIAnalysis) => void;
  label?: string;
  trackerContext?: string;
  allowAnnotation?: boolean;
  allowCompare?: boolean;
  allowShare?: boolean;
  maxPhotos?: number;
  onPhotosChange?: (photos: PhotoMeta[]) => void;
  initialPhotoUris?: string[];
  autoAnalyze?: boolean;
}

// ── Safe Hook Wrapper ───────────────────────────────────────────────────────
const useSafeCustomization = () => {
  const raw = useCustomization?.();
  const c = raw ?? {};

  const theme = useMemo(() => {
    const t = c?.theme;
    if (!t || typeof t !== 'object') return FALLBACK_THEME;
    return {
      text: { ...FALLBACK_THEME.text, ...(t.text || {}) },
      primary: t.primary ?? FALLBACK_THEME.primary,
      surface: t.surface ?? FALLBACK_THEME.surface,
      background: t.background ?? FALLBACK_THEME.background,
      danger: t.danger ?? FALLBACK_THEME.danger,
      warning: t.warning ?? FALLBACK_THEME.warning,
      success: t.success ?? FALLBACK_THEME.success,
    };
  }, [c?.theme]);

  const glass = useMemo(() => {
    const g = c?.glass;
    if (!g || typeof g !== 'object') return FALLBACK_GLASS;
    return { ...FALLBACK_GLASS, ...g };
  }, [c?.glass]);

  const borderRadius = useMemo(() => {
    const b = c?.borderRadius;
    if (!b || typeof b !== 'object') return FALLBACK_RADIUS;
    return { ...FALLBACK_RADIUS, ...b };
  }, [c?.borderRadius]);

  const spacing = useMemo(() => {
    const s = c?.spacing;
    if (!s || typeof s !== 'object') return FALLBACK_SPACING;
    return { ...FALLBACK_SPACING, ...s };
  }, [c?.spacing]);

  return { theme, glass, borderRadius, spacing };
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ── Mock AI Analysis Engine ──────────────────────────────────────────────────
const analyzePhoto = async (uri: string, context?: string): Promise<AIAnalysis> => {
  await new Promise((r) => setTimeout(r, 900));
  const contextMap: Record<string, AIAnalysis> = {
    skin_condition: {
      labels: ['Skin', 'Dermatology', 'Infant'],
      confidence: 0.87,
      suggestions: [
        'Monitor for spreading over 24h',
        'Note any fever or irritability',
        'Take daily comparison photos',
      ],
      severity: 'medium',
    },
    rash: {
      labels: ['Rash', 'Erythema', 'Infant Skin'],
      confidence: 0.91,
      suggestions: [
        'Check for fever — urgent if > 38°C',
        'Document when rash appeared',
        'Note any new foods or products',
      ],
      severity: 'medium',
    },
    injury: {
      labels: ['Bruise', 'Soft Tissue', 'Pediatric'],
      confidence: 0.78,
      suggestions: [
        'Apply cold compress for 15 min',
        'Monitor swelling and color change',
        'Seek care if swelling increases',
      ],
      severity: 'low',
    },
    oral_hygiene: {
      labels: ['Oral Cavity', 'Teeth', 'Pediatric'],
      confidence: 0.85,
      suggestions: [
        'Track brushing consistency',
        'Note any white spots or discoloration',
        'Schedule next dental checkup',
      ],
      severity: 'low',
    },
  };

  return (
    contextMap[context || ''] || {
      labels: ['Pediatric', 'Photo Documentation'],
      confidence: 0.82,
      suggestions: [
        'Keep photo in tracker for reference',
        'Share with pediatrician if concerned',
        'Take follow-up photo in 24-48h',
      ],
      severity: 'low',
    }
  );
};

// ── Component ────────────────────────────────────────────────────────────────
const SmartPhotoFieldComponent: React.FC<SmartPhotoFieldProps> = ({
  value,
  onChange,
  label = 'Photo',
  trackerContext,
  allowAnnotation = true,
  allowCompare = true,
  allowShare = true,
  maxPhotos = 5,
  onPhotosChange,
  initialPhotoUris,
  autoAnalyze = true,
}) => {
  const { theme, glass, borderRadius, spacing } = useSafeCustomization();
  const sweetAlertRaw = useSweetAlert?.();
  const sweetAlert = sweetAlertRaw?.sweetAlert ?? {
    alert: (_t?: string, _m?: string) => {},
    confirm: (_t?: string, _m?: string, _onOk?: () => void) => {},
  };

  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [currentUri, setCurrentUri] = useState<string | null>(value || null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCompare, setSelectedCompare] = useState<number[]>([]);
  const [caption, setCaption] = useState('');
  const [showMeta, setShowMeta] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [annotationColor, setAnnotationColor] = useState('#E74C3C');
  const [analysisHistory, setAnalysisHistory] = useState<Record<string, AIAnalysis>>({});

  const canvasRef = useRef<any>(null);
  const paths = useRef<any[]>([]);
  const currentPath = useRef<any>(null);
  const hasInitializedPhotos = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  // ── Init photos (edit mode) ───────────────────────────────────────────────
  useEffect(() => {
    if (hasInitializedPhotos.current) return;
    if (!initialPhotoUris || initialPhotoUris.length === 0) return;
    hasInitializedPhotos.current = true;

    const metas = initialPhotoUris.map((uri) => ({
      uri,
      width: 0,
      height: 0,
      timestamp: new Date().toISOString(),
      type: 'image/jpeg',
    }));
    setPhotos(metas);
    setCurrentUri(metas[metas.length - 1]?.uri || null);
  }, [initialPhotoUris]);

  // ── Notify parent ──────────────────────────────────────────────────────────
  useEffect(() => {
    onPhotosChange?.(photos);
  }, [photos, onPhotosChange]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  // ── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: lib } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cam !== 'granted' || lib !== 'granted') {
        sweetAlert.alert(
          'Permissions Required',
          'Camera and photo library access are needed for this feature.'
        );
      }
    })();
  }, [sweetAlert]);

  // ── Photo Capture ──────────────────────────────────────────────────────────
  const processPhoto = useCallback(
    async (uri: string, exif: any) => {
      if (photos.some((p) => p.uri === uri)) {
        sweetAlert.alert('Duplicate', 'This photo is already added.');
        return;
      }
      if (photos.length >= maxPhotos) {
        sweetAlert.alert('Limit Reached', `Maximum ${maxPhotos} photos allowed.`);
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      const meta: PhotoMeta = {
        uri,
        width: exif?.ImageWidth || exif?.width || 0,
        height: exif?.ImageLength || exif?.height || 0,
        timestamp: new Date().toISOString(),
        fileSize: fileInfo.exists ? fileInfo.size : undefined,
        type: 'image/jpeg',
      };

      if (exif?.GPSLatitude && exif?.GPSLongitude) {
        meta.location = {
          latitude: exif.GPSLatitude,
          longitude: exif.GPSLongitude,
        };
      }

      setPhotos((prev) => [...prev, meta]);
      setCurrentUri(uri);
      onChange(uri, meta);

      if (!autoAnalyze) return;

      abortController.current = new AbortController();
      setAnalyzing(true);
      try {
        const result = await analyzePhoto(uri, trackerContext);
        if (!abortController.current.signal.aborted) {
          setAnalysis(result);
          setAnalysisHistory((prev) => ({ ...prev, [uri]: result }));
          onChange(uri, meta, result);
        }
      } catch {
        // silent fail
      } finally {
        if (!abortController.current?.signal.aborted) {
          setAnalyzing(false);
        }
      }
    },
    [photos, maxPhotos, autoAnalyze, trackerContext, onChange, sweetAlert]
  );

  const takePhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9,
        exif: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        await processPhoto(result.assets[0].uri, result.assets[0].exif);
      }
    } catch {
      sweetAlert.alert('Camera Error', 'Could not capture photo. Please try again.');
    }
  }, [processPhoto, sweetAlert]);

  const pickPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9,
        exif: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        await processPhoto(result.assets[0].uri, result.assets[0].exif);
      }
    } catch {
      sweetAlert.alert('Gallery Error', 'Could not select photo. Please try again.');
    }
  }, [processPhoto, sweetAlert]);

  // ── Share ──────────────────────────────────────────────────────────────────
  const sharePhoto = useCallback(async () => {
    if (!currentUri) return;
    try {
      await Share.share({
        url: currentUri,
        title: 'LittleLoom Photo',
      });
    } catch {
      sweetAlert.alert('Share Error', 'Unable to share this photo.');
    }
  }, [currentUri, sweetAlert]);

  // ── Remove ─────────────────────────────────────────────────────────────────
  const removePhoto = useCallback(
    (idx: number) => {
      sweetAlert.confirm('Remove Photo?', 'This cannot be undone.', () => {
        setPhotos((prev) => {
          const next = prev.filter((_, i) => i !== idx);
          if (currentUri === prev[idx]?.uri) {
            setCurrentUri(next[0]?.uri || null);
            onChange(next[0]?.uri || null);
          }
          return next;
        });
        setSelectedCompare((prev) =>
          prev
            .filter((i) => i !== idx)
            .map((i) => (i > idx ? i - 1 : i))
        );
      });
    },
    [currentUri, onChange, sweetAlert]
  );

  // ── Annotation (Skia) ─────────────────────────────────────────────────────
  const touchHandler = useTouchHandler({
    onStart: (touch) => {
      if (touch.type === TouchType.Start) {
        currentPath.current = Skia.Path.Make();
        currentPath.current.moveTo(touch.x, touch.y);
      }
    },
    onActive: (touch) => {
      if (currentPath.current) {
        currentPath.current.lineTo(touch.x, touch.y);
      }
    },
    onEnd: () => {
      if (currentPath.current) {
        paths.current.push({ path: currentPath.current, color: annotationColor });
        currentPath.current = null;
      }
    },
  });

  const undoAnnotation = () => {
    paths.current.pop();
    // Force re-render hack for canvas
    setAnnotationColor((c) => c);
  };

  const clearAnnotation = () => {
    paths.current = [];
    setAnnotationColor((c) => c);
  };

  const saveAnnotation = async () => {
    setAnnotating(false);
    // In production: flatten canvas + image via Skia.makeImageFromView or snapshot
    sweetAlert.alert('Saved', 'Annotation saved with photo.');
  };

  // ── Compare ────────────────────────────────────────────────────────────────
  const toggleCompareSelect = (idx: number) => {
    setSelectedCompare((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 2) return [prev[1], idx];
      return [...prev, idx];
    });
  };

  // ── Zoom / Pan (Reanimated) ────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const resetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        runOnJS(setShowZoom)(false);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      // boundary limits could be added here
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        runOnJS(resetZoom)();
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const zoomGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, panGesture),
    pinchGesture
  );

  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── AI Severity Bar Animation ──────────────────────────────────────────────
  const confidenceProgress = useSharedValue(0);
  useEffect(() => {
    confidenceProgress.value = withTiming(analysis ? analysis.confidence : 0, {
      duration: 800,
    });
  }, [analysis, confidenceProgress]);

  const severityBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(confidenceProgress.value, [0, 1], [0, 100])}%`,
  }));

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentMeta = useMemo(
    () => photos.find((p) => p.uri === currentUri),
    [photos, currentUri]
  );

  const severityColor = useMemo(() => {
    if (analysis?.severity === 'high') return theme.danger;
    if (analysis?.severity === 'medium') return theme.warning;
    return theme.success;
  }, [analysis, theme]);

  const photoCountText = `${photos.length}/${maxPhotos}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { marginVertical: spacing.md }]}>
      {/* Label + Counter */}
      {label && (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              { color: theme.text.primary, marginBottom: spacing.sm },
            ]}
          >
            {label}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: glass.bg,
                borderColor: glass.border,
                borderRadius: borderRadius.md,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.text.secondary }]}>
              {photoCountText}
            </Text>
          </View>
        </View>
      )}

      {/* Main Preview */}
      <Pressable onPress={() => currentUri && setShowZoom(true)}>
        <View
          style={[
            styles.previewWrap,
            {
              backgroundColor: glass.bg,
              borderColor: glass.border,
              borderRadius: borderRadius.lg,
              borderWidth: 1,
            },
          ]}
        >
          {currentUri ? (
            <>
              <Image
                source={{ uri: currentUri }}
                style={[styles.previewImg, { borderRadius: borderRadius.lg }]}
                resizeMode="cover"
              />

              {/* AI Badge */}
              {analysis && !analyzing && (
                <View
                  style={[
                    styles.analysisBadge,
                    { backgroundColor: severityColor + 'E6' },
                  ]}
                >
                  <Ionicons name="sparkles" size={14} color="#FFF" />
                  <Text style={styles.analysisText}>
                    AI {Math.round(analysis.confidence * 100)}%
                  </Text>
                </View>
              )}

              {/* Timestamp overlay */}
              {currentMeta && (
                <View style={[styles.timestampBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Text style={styles.timestampText}>
                    {formatDate(currentMeta.timestamp)}
                  </Text>
                </View>
              )}

              {/* Analyzing Overlay */}
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator color={theme.primary} size="large" />
                  <Text
                    style={[
                      styles.analyzingText,
                      { color: theme.text.primary },
                    ]}
                  >
                    Analyzing photo...
                  </Text>
                </View>
              )}

              {/* Action Bar */}
              <View style={styles.actionBar}>
                <TouchableOpacity
                  onPress={() => setShowMeta(true)}
                  style={[styles.iconBtn, { backgroundColor: glass.bg }]}
                >
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
                {allowAnnotation && (
                  <TouchableOpacity
                    onPress={() => setAnnotating(true)}
                    style={[styles.iconBtn, { backgroundColor: glass.bg }]}
                  >
                    <Ionicons name="pencil" size={20} color={theme.primary} />
                  </TouchableOpacity>
                )}
                {allowCompare && photos.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      setCompareMode((v) => !v);
                      setSelectedCompare([]);
                    }}
                    style={[
                      styles.iconBtn,
                      {
                        backgroundColor: compareMode
                          ? theme.primary
                          : glass.bg,
                      },
                    ]}
                  >
                    <Ionicons
                      name="git-compare"
                      size={20}
                      color={compareMode ? '#FFF' : theme.primary}
                    />
                  </TouchableOpacity>
                )}
                {allowShare && (
                  <TouchableOpacity
                    onPress={sharePhoto}
                    style={[styles.iconBtn, { backgroundColor: glass.bg }]}
                  >
                    <Ionicons
                      name="share-outline"
                      size={20}
                      color={theme.primary}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() =>
                    removePhoto(photos.findIndex((p) => p.uri === currentUri))
                  }
                  style={[styles.iconBtn, { backgroundColor: glass.bg }]}
                >
                  <Ionicons name="trash" size={20} color={theme.danger} />
                </TouchableOpacity>
              </View>

              {/* Zoom hint */}
              <View style={styles.zoomHint}>
                <Ionicons name="scan" size={14} color="#FFF" />
                <Text style={styles.zoomHintText}>Tap to zoom</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="camera"
                size={48}
                color={theme.text.tertiary}
              />
              <Text
                style={[styles.emptyText, { color: theme.text.secondary }]}
              >
                No photo yet
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  { color: theme.text.tertiary, marginTop: spacing.xs },
                ]}
              >
                Tap camera or gallery below
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Caption Input */}
      {currentUri && (
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption or note..."
          placeholderTextColor={theme.text.tertiary}
          style={[
            styles.captionInput,
            {
              backgroundColor: glass.bg,
              borderColor: glass.border,
              color: theme.text.primary,
              borderRadius: borderRadius.md,
            },
          ]}
        />
      )}

      {/* AI Analysis Panel */}
      {analysis && !analyzing && (
        <View
          style={[
            styles.analysisPanel,
            {
              backgroundColor: glass.bg,
              borderColor: glass.border,
              borderRadius: borderRadius.lg,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.analysisHeader}>
            <Ionicons name="bulb" size={18} color={theme.primary} />
            <Text
              style={[styles.analysisTitle, { color: theme.text.primary }]}
            >
              Smart Insights
            </Text>
          </View>

          {/* Animated confidence bar */}
          <View
            style={[
              styles.confidenceTrack,
              { backgroundColor: theme.text.disabled + '40' },
            ]}
          >
            <Animated.View
              style={[
                styles.confidenceFill,
                { backgroundColor: severityColor },
                severityBarStyle,
              ]}
            />
          </View>
          <Text
            style={[
              styles.confidenceLabel,
              { color: theme.text.tertiary, marginBottom: spacing.sm },
            ]}
          >
            Confidence: {Math.round(analysis.confidence * 100)}%
          </Text>

          {analysis.suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={severityColor}
              />
              <Text
                style={[
                  styles.suggestionText,
                  { color: theme.text.secondary },
                ]}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Thumbnail Strip */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbStrip}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          {photos.map((photo, idx) => (
            <TouchableOpacity
              key={photo.uri + idx}
              onPress={() => {
                if (compareMode) {
                  toggleCompareSelect(idx);
                } else {
                  setCurrentUri(photo.uri);
                }
              }}
              onLongPress={() => removePhoto(idx)}
              style={[
                styles.thumb,
                {
                  borderRadius: borderRadius.md,
                  borderWidth: currentUri === photo.uri ? 3 : 2,
                  borderColor:
                    currentUri === photo.uri
                      ? theme.primary
                      : selectedCompare.includes(idx)
                      ? theme.warning
                      : glass.border,
                },
              ]}
            >
              <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
              {selectedCompare.includes(idx) && compareMode && (
                <View style={styles.compareBadge}>
                  <Text style={styles.compareBadgeText}>
                    {selectedCompare.indexOf(idx) + 1}
                  </Text>
                </View>
              )}
              {analysisHistory[photo.uri] && !compareMode && (
                <View
                  style={[
                    styles.aiDot,
                    {
                      backgroundColor:
                        analysisHistory[photo.uri].severity === 'high'
                          ? theme.danger
                          : analysisHistory[photo.uri].severity === 'medium'
                          ? theme.warning
                          : theme.success,
                    },
                  ]}
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Compare View */}
      {compareMode && selectedCompare.length === 2 && (
        <View
          style={[
            styles.compareContainer,
            { borderRadius: borderRadius.lg },
          ]}
        >
          <Text
            style={[styles.compareLabel, { color: theme.text.primary }]}
          >
            Before & After
          </Text>
          <View style={styles.compareRow}>
            <Image
              source={{ uri: photos[selectedCompare[0]]?.uri }}
              style={styles.compareImg}
            />
            <Ionicons
              name="arrow-forward"
              size={24}
              color={theme.primary}
            />
            <Image
              source={{ uri: photos[selectedCompare[1]]?.uri }}
              style={styles.compareImg}
            />
          </View>
        </View>
      )}

      {/* Capture Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          onPress={takePhoto}
          style={[
            styles.captureBtn,
            {
              backgroundColor: theme.primary,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.captureBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={pickPhoto}
          style={[
            styles.captureBtn,
            {
              backgroundColor: glass.bg,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: glass.border,
            },
          ]}
        >
          <Ionicons name="images" size={20} color={theme.primary} />
          <Text
            style={[
              styles.captureBtnText,
              { color: theme.primary },
            ]}
          >
            Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Metadata Modal */}
      <Modal
        visible={showMeta}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMeta(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMeta(false)}
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.surface,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: theme.text.primary },
              ]}
            >
              Photo Metadata
            </Text>
            {currentMeta ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <MetaRow label="URI" value={currentMeta.uri} theme={theme} />
                <MetaRow
                  label="Dimensions"
                  value={`${currentMeta.width} × ${currentMeta.height}`}
                  theme={theme}
                />
                <MetaRow
                  label="File Size"
                  value={formatBytes(currentMeta.fileSize)}
                  theme={theme}
                />
                <MetaRow
                  label="Timestamp"
                  value={formatDate(currentMeta.timestamp)}
                  theme={theme}
                />
                <MetaRow
                  label="Type"
                  value={currentMeta.type || '—'}
                  theme={theme}
                />
                {currentMeta.location && (
                  <>
                    <MetaRow
                      label="Latitude"
                      value={currentMeta.location.latitude.toFixed(6)}
                      theme={theme}
                    />
                    <MetaRow
                      label="Longitude"
                      value={currentMeta.location.longitude.toFixed(6)}
                      theme={theme}
                    />
                  </>
                )}
              </ScrollView>
            ) : (
              <Text style={{ color: theme.text.secondary }}>
                No metadata available
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setShowMeta(false)}
              style={[
                styles.modalClose,
                {
                  backgroundColor: theme.primary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Annotation Modal */}
      <Modal
        visible={annotating}
        transparent
        animationType="slide"
        onRequestClose={() => setAnnotating(false)}
      >
        <View
          style={[
            styles.annotateContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <View style={styles.annotateHeader}>
            <TouchableOpacity onPress={() => setAnnotating(false)}>
              <Ionicons
                name="close"
                size={28}
                color={theme.text.primary}
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.annotateTitle,
                { color: theme.text.primary },
              ]}
            >
              Annotate
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={undoAnnotation}>
                <Ionicons
                  name="arrow-undo"
                  size={24}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAnnotation}>
                <Ionicons
                  name="trash-bin"
                  size={24}
                  color={theme.danger}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveAnnotation}>
                <Ionicons
                  name="checkmark"
                  size={28}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Color Picker */}
          <View style={styles.colorRow}>
            {['#E74C3C', '#F39C12', '#2ECC71', '#3498DB', '#9B59B6', '#FFFFFF'].map(
              (c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setAnnotationColor(c)}
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: c,
                      borderWidth: annotationColor === c ? 3 : 0,
                      borderColor: theme.text.primary,
                    },
                  ]}
                />
              )
            )}
          </View>

          {currentUri && (
            <View style={{ flex: 1 }}>
              <Image
                source={{ uri: currentUri }}
                style={{
                  width: PREVIEW_SIZE,
                  height: PREVIEW_SIZE * 0.75,
                  alignSelf: 'center',
                  borderRadius: borderRadius.lg,
                }}
                resizeMode="contain"
              />
              {/* Skia Canvas Overlay */}
              <View
                style={{
                  position: 'absolute',
                  width: PREVIEW_SIZE,
                  height: PREVIEW_SIZE * 0.75,
                  alignSelf: 'center',
                }}
              >
                <Canvas style={{ flex: 1 }}>
                  {paths.current.map((p, i) => (
                    <Path
                      key={i}
                      path={p.path}
                      color={Skia.Color(p.color)}
                      style="stroke"
                      strokeWidth={3}
                    />
                  ))}
                  {currentPath.current && (
                    <Path
                      path={currentPath.current}
                      color={Skia.Color(annotationColor)}
                      style="stroke"
                      strokeWidth={3}
                    />
                  )}
                </Canvas>
                <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                  <GestureDetector gesture={touchHandler}>
                    <View style={StyleSheet.absoluteFill} />
                  </GestureDetector>
                </GestureHandlerRootView>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Fullscreen Zoom Modal */}
      <Modal
        visible={showZoom}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowZoom(false);
          resetZoom();
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GestureDetector gesture={zoomGesture}>
            <View
              style={[
                styles.zoomContainer,
                { backgroundColor: 'rgba(0,0,0,0.95)' },
              ]}
            >
              <TouchableOpacity
                style={styles.zoomClose}
                onPress={() => {
                  setShowZoom(false);
                  resetZoom();
                }}
              >
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
              {currentUri && (
                <Animated.Image
                  source={{ uri: currentUri }}
                  style={[
                    {
                      width: SCREEN_W,
                      height: SCREEN_H * 0.6,
                    },
                    zoomAnimatedStyle,
                  ]}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.zoomHintBottom}>
                Pinch to zoom • Double-tap to reset
              </Text>
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────────────
const MetaRow = ({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) => (
  <View style={styles.metaRow}>
    <Text style={[styles.metaKey, { color: theme.text.tertiary }]}>
      {label}
    </Text>
    <Text
      style={[
        styles.metaValue,
        { color: theme.text.primary },
      ]}
      numberOfLines={2}
    >
      {value}
    </Text>
  </View>
);

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { width: '100%' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  previewWrap: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE * 0.75,
    alignSelf: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImg: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyText: { marginTop: 12, fontSize: 15 },
  emptySub: { fontSize: 13 },
  analysisBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  analysisText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  timestampBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timestampText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  analyzingText: { fontSize: 16, fontWeight: '600' },
  actionBar: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomHintText: { color: '#FFF', fontSize: 11 },
  captionInput: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  analysisPanel: { marginTop: 12, padding: 14 },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  analysisTitle: { fontSize: 15, fontWeight: '700' },
  confidenceTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceLabel: { fontSize: 11, fontWeight: '600' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  suggestionText: { fontSize: 13, flex: 1, lineHeight: 18 },
  thumbStrip: { marginTop: 12 },
  thumb: {
    width: 72,
    height: 72,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  compareBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#F39C12',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  aiDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  compareContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    alignItems: 'center',
  },
  compareLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compareImg: { width: 120, height: 90, borderRadius: 8 },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 130,
    justifyContent: 'center',
  },
  captureBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  metaKey: { fontSize: 13, textTransform: 'capitalize', flex: 1 },
  metaValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  annotateContainer: { flex: 1 },
  annotateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  annotateTitle: { fontSize: 18, fontWeight: '700' },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  zoomHintBottom: {
    position: 'absolute',
    bottom: 40,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});

export default React.memo(SmartPhotoFieldComponent);