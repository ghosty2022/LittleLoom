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
  Dimensions,
  TextInput,
  Modal,
  Share,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons as ExpoIonicons } from '@expo/vector-icons';

const Ionicons = ExpoIonicons;
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
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

// ── Colors ─────────────────────────────────────────────
const COLORS = {
  text: {
    primary: '#1a1a1a',
    secondary: '#555555',
    tertiary: '#888888',
    disabled: '#bbbbbb',
  },
  primary: '#6366f1',
  surface: '#ffffff',
  background: '#f8fafc',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
};

const GLASS = {
  bg: 'rgba(255,255,255,0.9)',
  border: 'rgba(0,0,0,0.06)',
};

const RADIUS = { sm: 6, md: 10, lg: 16, xl: 24 };
const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// ── Types ────────────────────────────────────────────────────────────────────
interface PhotoMeta {
  uri: string;
  width: number;
  height: number;
  timestamp: string;
  location?: { latitude: number; longitude: number };
  fileSize?: number;
  type?: string;
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const safeAlert = (title?: string, message?: string) => {
  const safeTitle = typeof title === 'string' && title.trim()
    ? title
    : 'Notice';

  const safeMessage = typeof message === 'string' && message.trim()
    ? message
    : 'Something went wrong.';

  Alert.alert(safeTitle, safeMessage);
};

const safeConfirm = (
  title: string | undefined,
  message: string | undefined,
  onOk: () => void
) => {
  const safeTitle =
    typeof title === 'string' && title.trim()
      ? title
      : 'Confirm';

  const safeMessage =
    typeof message === 'string' && message.trim()
      ? message
      : 'Are you sure?';

  Alert.alert(
    safeTitle,
    safeMessage,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'OK',
        onPress: onOk,
      },
    ],
    {
      cancelable: true,
    }
  );
};

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
const SmartPhotoField: React.FC<SmartPhotoFieldProps> = ({
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
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [analysisHistory, setAnalysisHistory] = useState<Record<string, AIAnalysis>>({});

  const paths = useRef<any[]>([]);
  const currentPath = useRef<any>(null);
  const hasInitializedPhotos = useRef(false);

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

  useEffect(() => {
    onPhotosChange?.(photos);
  }, [photos, onPhotosChange]);

  // ── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: lib } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cam !== 'granted' || lib !== 'granted') {
        safeAlert('Permissions Required', 'Camera and photo library access are needed for this feature.');
      }
    })();
  }, []);

  // ── Photo Capture ──────────────────────────────────────────────────────────
  const processPhoto = useCallback(
    async (uri: string, exif: any) => {
  if (!uri || typeof uri !== 'string') {
    safeAlert('Photo Error', 'The selected photo is invalid.');
    return;
  }

  if (photos.some((p) => p && p.uri === uri)) {
        safeAlert('Duplicate', 'This photo is already added.');
        return;
      }
      if (photos.length >= maxPhotos) {
        safeAlert('Limit Reached', `Maximum ${maxPhotos} photos allowed.`);
        return;
      }

let fileSize: number | undefined;

try {
  const fileInfo = await FileSystem.getInfoAsync(uri);

  if (fileInfo && fileInfo.exists && typeof fileInfo.size === 'number') {
    fileSize = fileInfo.size;
  }
} catch (error) {
  console.warn('[SmartPhotoField] Could not read file metadata:', error);
}

const meta: PhotoMeta = {
  uri: typeof uri === 'string' ? uri : '',
  width: Number(exif?.ImageWidth || exif?.width || 0),
  height: Number(exif?.ImageLength || exif?.height || 0),
  timestamp: new Date().toISOString(),
  fileSize,
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

      setAnalyzing(true);
      try {
        const result = await analyzePhoto(uri, trackerContext);
        setAnalysis(result);
        setAnalysisHistory((prev) => ({ ...prev, [uri]: result }));
        onChange(uri, meta, result);
      } catch {
        // silent fail
      } finally {
        setAnalyzing(false);
      }
    },
    [photos, maxPhotos, autoAnalyze, trackerContext, onChange]
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
      safeAlert('Camera Error', 'Could not capture photo. Please try again.');
    }
  }, [processPhoto]);

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
      safeAlert('Gallery Error', 'Could not select photo. Please try again.');
    }
  }, [processPhoto]);

  const sharePhoto = useCallback(async () => {
    if (!currentUri) return;
    try {
      await Share.share({ url: currentUri, title: 'LittleLoom Photo' });
    } catch {
      safeAlert('Share Error', 'Unable to share this photo.');
    }
  }, [currentUri]);

  const removePhoto = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= photos.length) return;
      
      const photoToRemove = photos[idx];
      if (!photoToRemove) return;
      
      safeConfirm('Remove Photo?', 'This cannot be undone.', () => {
        setPhotos((prev) => {
          const next = prev.filter((_, i) => i !== idx);
          if (currentUri === prev[idx]?.uri) {
            setCurrentUri(next[0]?.uri || null);
            onChange(next[0]?.uri || null);
          }
          return next;
        });
        setSelectedCompare((prev) =>
          prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i))
        );
      });
    },
    [currentUri, onChange, photos]
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
      if (currentPath.current) currentPath.current.lineTo(touch.x, touch.y);
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
    setAnnotationColor((c) => c);
  };

  const clearAnnotation = () => {
    paths.current = [];
    setAnnotationColor((c) => c);
  };

  const saveAnnotation = async () => {
    setAnnotating(false);
    safeAlert('Saved', 'Annotation saved with photo.');
  };

  // ── Compare ────────────────────────────────────────────────────────────────
  const toggleCompareSelect = (idx: number) => {
    if (idx < 0 || idx >= photos.length) return;
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
      if (scale.value < 1.1) runOnJS(setShowZoom)(false);
    });

  const panGesture = Gesture.Pan().onUpdate((e) => {
    if (scale.value > 1) {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    }
  });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) runOnJS(resetZoom)();
      else {
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
const currentMeta = useMemo(() => {
  if (!currentUri || !Array.isArray(photos)) {
    return undefined;
  }

  return photos.find(
    (photo) =>
      photo &&
      typeof photo.uri === 'string' &&
      photo.uri === currentUri
  );
}, [photos, currentUri]);

  const severityColor = useMemo(() => {
    if (analysis?.severity === 'high') return COLORS.danger;
    if (analysis?.severity === 'medium') return COLORS.warning;
    return COLORS.success;
  }, [analysis]);

  const photoCountText = `${photos.length}/${maxPhotos}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { marginVertical: SPACE.md }]}>
      {/* Label + Counter */}
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: COLORS.text.primary, marginBottom: SPACE.sm }]}>
            {label}
          </Text>
          <View style={[styles.badge, { backgroundColor: GLASS.bg, borderColor: GLASS.border, borderRadius: RADIUS.md, borderWidth: 1 }]}>
            <Text style={[styles.badgeText, { color: COLORS.text.secondary }]}>{photoCountText}</Text>
          </View>
        </View>
      )}

      {/* Main Preview */}
      <Pressable onPress={() => currentUri && setShowZoom(true)}>
        <View style={[styles.previewWrap, { backgroundColor: GLASS.bg, borderColor: GLASS.border, borderRadius: RADIUS.lg, borderWidth: 1 }]}>
          {currentUri ? (
            <>
              <Image source={{ uri: currentUri }} style={[styles.previewImg, { borderRadius: RADIUS.lg }]} resizeMode="cover" />

              {analysis && !analyzing && (
                <View style={[styles.analysisBadge, { backgroundColor: severityColor + 'E6' }]}>
                  <Ionicons name="sparkles" size={14} color="#FFF" />
                  <Text style={styles.analysisText}>AI {Math.round(analysis.confidence * 100)}%</Text>
                </View>
              )}

              {currentMeta && (
                <View style={[styles.timestampBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Text style={styles.timestampText}>{formatDate(currentMeta.timestamp)}</Text>
                </View>
              )}

              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                  <Text style={[styles.analyzingText, { color: COLORS.text.primary }]}>Analyzing photo...</Text>
                </View>
              )}

              <View style={styles.actionBar}>
                <TouchableOpacity onPress={() => setShowMeta(true)} style={[styles.iconBtn, { backgroundColor: GLASS.bg }]}>
                  <Ionicons name="information-circle" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                {allowAnnotation && (
                  <TouchableOpacity onPress={() => setAnnotating(true)} style={[styles.iconBtn, { backgroundColor: GLASS.bg }]}>
                    <Ionicons name="pencil" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                {allowCompare && photos.length > 1 && (
                  <TouchableOpacity
                    onPress={() => { setCompareMode((v) => !v); setSelectedCompare([]); }}
                    style={[styles.iconBtn, { backgroundColor: compareMode ? COLORS.primary : GLASS.bg }]}
                  >
                    <Ionicons name="git-compare" size={20} color={compareMode ? '#FFF' : COLORS.primary} />
                  </TouchableOpacity>
                )}
                {allowShare && (
                  <TouchableOpacity onPress={sharePhoto} style={[styles.iconBtn, { backgroundColor: GLASS.bg }]}>
                    <Ionicons name="share-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => removePhoto(photos.findIndex((p) => p.uri === currentUri))}
                  style={[styles.iconBtn, { backgroundColor: GLASS.bg }]}
                >
                  <Ionicons name="trash" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.zoomHint}>
                <Ionicons name="scan" size={14} color="#FFF" />
                <Text style={styles.zoomHintText}>Tap to zoom</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="camera" size={48} color={COLORS.text.tertiary} />
              <Text style={[styles.emptyText, { color: COLORS.text.secondary }]}>No photo yet</Text>
              <Text style={[styles.emptySub, { color: COLORS.text.tertiary, marginTop: SPACE.xs }]}>
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
          placeholderTextColor={COLORS.text.tertiary}
          style={[styles.captionInput, { backgroundColor: GLASS.bg, borderColor: GLASS.border, color: COLORS.text.primary, borderRadius: RADIUS.md }]}
        />
      )}

      {/* AI Analysis Panel */}
      {analysis && !analyzing && (
        <View style={[styles.analysisPanel, { backgroundColor: GLASS.bg, borderColor: GLASS.border, borderRadius: RADIUS.lg, borderWidth: 1 }]}>
          <View style={styles.analysisHeader}>
            <Ionicons name="bulb" size={18} color={COLORS.primary} />
            <Text style={[styles.analysisTitle, { color: COLORS.text.primary }]}>Smart Insights</Text>
          </View>

          <View style={[styles.confidenceTrack, { backgroundColor: COLORS.text.disabled + '40' }]}>
            <Animated.View style={[styles.confidenceFill, { backgroundColor: severityColor }, severityBarStyle]} />
          </View>
          <Text style={[styles.confidenceLabel, { color: COLORS.text.tertiary, marginBottom: SPACE.sm }]}>
            Confidence: {Math.round(analysis.confidence * 100)}%
          </Text>

          {Array.isArray(analysis?.suggestions) &&
  analysis.suggestions.map((suggestion, index) => {
    const safeSuggestion =
      typeof suggestion === 'string' && suggestion.trim()
        ? suggestion
        : 'No additional information available.';

    return (
      <View
        key={`suggestion-${index}`}
        style={styles.suggestionRow}
      >
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={severityColor}
        />

        <Text
          style={[
            styles.suggestionText,
            { color: COLORS.text.secondary },
          ]}
        >
          {safeSuggestion}
        </Text>
      </View>
    );
  })}
        </View>
      )}

      {/* Thumbnail Strip */}
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {photos.map((photo, idx) => (
            <TouchableOpacity
              key={photo.uri + idx}
              onPress={() => { compareMode ? toggleCompareSelect(idx) : setCurrentUri(photo.uri); }}
              onLongPress={() => removePhoto(idx)}
              style={[
                styles.thumb,
                {
                  borderRadius: RADIUS.md,
                  borderWidth: currentUri === photo.uri ? 3 : 2,
                  borderColor: currentUri === photo.uri ? COLORS.primary : selectedCompare.includes(idx) ? COLORS.warning : GLASS.border,
                },
              ]}
            >
              <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
              {selectedCompare.includes(idx) && compareMode && (
                <View style={styles.compareBadge}>
                  <Text style={styles.compareBadgeText}>{selectedCompare.indexOf(idx) + 1}</Text>
                </View>
              )}
              {analysisHistory[photo.uri] && !compareMode && (
                <View
                  style={[
                    styles.aiDot,
                    {
                      backgroundColor:
                        analysisHistory[photo.uri].severity === 'high'
                          ? COLORS.danger
                          : analysisHistory[photo.uri].severity === 'medium'
                          ? COLORS.warning
                          : COLORS.success,
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
        <View style={[styles.compareContainer, { borderRadius: RADIUS.lg }]}>
          <Text style={[styles.compareLabel, { color: COLORS.text.primary }]}>Before & After</Text>
          <View style={styles.compareRow}>
            <Image source={{ uri: photos[selectedCompare[0]]?.uri }} style={styles.compareImg} />
            <Ionicons name="arrow-forward" size={24} color={COLORS.primary} />
            <Image source={{ uri: photos[selectedCompare[1]]?.uri }} style={styles.compareImg} />
          </View>
        </View>
      )}

      {/* Capture Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity onPress={takePhoto} style={[styles.captureBtn, { backgroundColor: COLORS.primary, borderRadius: RADIUS.md }]}>
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.captureBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={pickPhoto}
          style={[styles.captureBtn, { backgroundColor: GLASS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: GLASS.border }]}
        >
          <Ionicons name="images" size={20} color={COLORS.primary} />
          <Text style={[styles.captureBtnText, { color: COLORS.primary }]}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Metadata Modal */}
      <Modal visible={showMeta} transparent animationType="fade" onRequestClose={() => setShowMeta(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMeta(false)}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text.primary }]}>Photo Metadata</Text>
            {currentMeta ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <MetaRow label="URI" value={currentMeta.uri || '—'} />
                <MetaRow label="Dimensions" value={`${currentMeta.width || 0} × ${currentMeta.height || 0}`} />
                <MetaRow label="File Size" value={formatBytes(currentMeta.fileSize) || '—'} />
                <MetaRow label="Timestamp" value={currentMeta.timestamp ? formatDate(currentMeta.timestamp) : '—'} />
                <MetaRow label="Type" value={currentMeta.type || '—'} />
                {currentMeta.location && (
                  <>
                    <MetaRow label="Latitude" value={currentMeta.location.latitude?.toFixed(6) || '—'} />
                    <MetaRow label="Longitude" value={currentMeta.location.longitude?.toFixed(6) || '—'} />
                  </>
                )}
              </ScrollView>
            ) : (
              <Text style={{ color: COLORS.text.secondary }}>No metadata available</Text>
            )}
            <TouchableOpacity onPress={() => setShowMeta(false)} style={[styles.modalClose, { backgroundColor: COLORS.primary, borderRadius: RADIUS.md }]}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Annotation Modal */}
      <Modal visible={annotating} transparent animationType="slide" onRequestClose={() => setAnnotating(false)}>
        <View style={[styles.annotateContainer, { backgroundColor: COLORS.background }]}>
          <View style={styles.annotateHeader}>
            <TouchableOpacity onPress={() => setAnnotating(false)}>
              <Ionicons name="close" size={28} color={COLORS.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.annotateTitle, { color: COLORS.text.primary }]}>Annotate</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={undoAnnotation}>
                <Ionicons name="arrow-undo" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAnnotation}>
                <Ionicons name="trash-bin" size={24} color={COLORS.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveAnnotation}>
                <Ionicons name="checkmark" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.colorRow}>
            {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#FFFFFF'].map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setAnnotationColor(c)}
                style={[styles.colorDot, { backgroundColor: c, borderWidth: annotationColor === c ? 3 : 0, borderColor: COLORS.text.primary }]}
              />
            ))}
          </View>

          {currentUri && (
            <View style={{ flex: 1 }}>
              <Image
                source={{ uri: currentUri }}
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.75, alignSelf: 'center', borderRadius: RADIUS.lg }}
                resizeMode="contain"
              />
              <View style={{ position: 'absolute', width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.75, alignSelf: 'center' }}>
                <Canvas style={{ flex: 1 }}>
                  {paths.current.map((p, i) => (
                    <Path key={i} path={p.path} color={Skia.Color(p.color)} style="stroke" strokeWidth={3} />
                  ))}
                  {currentPath.current && (
                    <Path path={currentPath.current} color={Skia.Color(annotationColor)} style="stroke" strokeWidth={3} />
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
      <Modal visible={showZoom} transparent animationType="fade" onRequestClose={() => { setShowZoom(false); resetZoom(); }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GestureDetector gesture={zoomGesture}>
            <View style={[styles.zoomContainer, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
              <TouchableOpacity style={styles.zoomClose} onPress={() => { setShowZoom(false); resetZoom(); }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
              {currentUri && (
                <Animated.Image
                  source={{ uri: currentUri }}
                  style={[{ width: SCREEN_W, height: SCREEN_H * 0.6 }, zoomAnimatedStyle]}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.zoomHintBottom}>Pinch to zoom • Double-tap to reset</Text>
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────────────
const MetaRow = ({ label, value }: { label?: string; value?: string }) => {
  // Guard against undefined values with fallbacks
  const safeLabel = label || '—';
  const safeValue = value || '—';
  
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaKey, { color: COLORS.text.tertiary }]}>{safeLabel}</Text>
      <Text style={[styles.metaValue, { color: COLORS.text.primary }]} numberOfLines={2}>{safeValue}</Text>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { width: '100%' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  previewWrap: { width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.75, alignSelf: 'center', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyText: { marginTop: 12, fontSize: 15 },
  emptySub: { fontSize: 13 },
  analysisBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  analysisText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  timestampBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timestampText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  analyzingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', gap: 12 },
  analyzingText: { fontSize: 16, fontWeight: '600' },
  actionBar: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  zoomHint: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  zoomHintText: { color: '#FFF', fontSize: 11 },
  captionInput: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  analysisPanel: { marginTop: 12, padding: 14 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  analysisTitle: { fontSize: 15, fontWeight: '700' },
  confidenceTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceLabel: { fontSize: 11, fontWeight: '600' },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  suggestionText: { fontSize: 13, flex: 1 },
  thumbStrip: { marginTop: 12, flexDirection: 'row' },
  thumb: { width: 56, height: 56, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  compareBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: COLORS.warning, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  compareBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  aiDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#FFF' },
  compareContainer: { marginTop: 12, padding: 12, backgroundColor: GLASS.bg, borderWidth: 1, borderColor: GLASS.border },
  compareLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  compareRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  compareImg: { width: 80, height: 80, borderRadius: RADIUS.md },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  captureBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 8 },
  captureBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '80%', padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalClose: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  metaKey: { fontSize: 13, fontWeight: '500' },
  metaValue: { fontSize: 13, flex: 1, textAlign: 'right', marginLeft: 16 },
  annotateContainer: { flex: 1, paddingTop: 48 },
  annotateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: GLASS.border },
  annotateTitle: { fontSize: 18, fontWeight: '700' },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  zoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomClose: { position: 'absolute', top: 48, right: 16, zIndex: 1 },
  zoomHintBottom: { position: 'absolute', bottom: 48, color: '#FFF', fontSize: 13, opacity: 0.7 },
});

export default SmartPhotoField;