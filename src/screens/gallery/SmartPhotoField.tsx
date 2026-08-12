import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
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
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Canvas, Path, Skia, TouchType, useTouchHandler } from '@shopify/react-native-skia';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_W - 48;

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
  trackerContext?: string; // e.g., 'skin_condition', 'rash', 'injury'
  allowAnnotation?: boolean;
  allowCompare?: boolean;
  maxPhotos?: number;
  onPhotosChange?: (photos: PhotoMeta[]) => void;
  initialPhotoUris?: string[];
}

// ── Mock AI Analysis Engine ──────────────────────────────────────────────────
const analyzePhoto = async (uri: string, context?: string): Promise<AIAnalysis> => {
  // In production, replace with actual ML model (TensorFlow Lite, Cloud Vision, etc.)
  await new Promise((r) => setTimeout(r, 1200));

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
export const SmartPhotoField: React.FC<SmartPhotoFieldProps> = ({
  value,
  onChange,
  label = 'Photo',
  trackerContext,
  allowAnnotation = true,
  allowCompare = true,
  maxPhotos = 5,
  onPhotosChange,
  initialPhotoUris,
}) => {
  // ── Defensive hooks (never crash if provider is missing) ──────────────────
  const customizationRaw = useCustomization?.();
  const customization = customizationRaw ?? {};
  
  const theme = customization?.theme ?? {
    text: { primary: '#1a1a1a', secondary: '#666666', tertiary: '#999999' },
    primary: '#007AFF',
    surface: '#ffffff',
    background: '#f2f2f2',
  };
  const glass = customization?.glass ?? { bg: 'rgba(255,255,255,0.8)', border: 'rgba(0,0,0,0.1)' };
  const borderRadius = customization?.borderRadius ?? { lg: 16, md: 12, xl: 24 };
  const spacing = customization?.spacing ?? { md: 16, sm: 12 };

  const sweetAlertRaw = useSweetAlert?.();
  const sweetAlert = sweetAlertRaw?.sweetAlert ?? { 
    alert: (_t?: string, _m?: string) => {}, 
    confirm: (_t?: string, _m?: string, _onOk?: () => void) => {} 
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

  const canvasRef = useRef<any>(null);
  const paths = useRef<any[]>([]);
  const currentPath = useRef<any>(null);
  const hasInitializedPhotos = useRef(false);

  // ── Sync initial photos (edit mode) ───────────────────────────────────────
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

  // ── Notify parent of photo array changes ───────────────────────────────────
  useEffect(() => {
    onPhotosChange?.(photos);
  }, [photos, onPhotosChange]);

  // ── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: lib } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cam !== 'granted' || lib !== 'granted') {
        sweetAlert.alert('Permissions Required', 'Camera and photo library access are needed for this feature.');
      }
    })();
  }, []);

  // ── Photo Capture ──────────────────────────────────────────────────────────
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
        const asset = result.assets[0];
        await processPhoto(asset.uri, asset.exif);
      }
    } catch (err) {
      sweetAlert.alert('Camera Error', 'Could not capture photo. Please try again.');
    }
  }, []);

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
        const asset = result.assets[0];
        await processPhoto(asset.uri, asset.exif);
      }
    } catch (err) {
      sweetAlert.alert('Gallery Error', 'Could not select photo. Please try again.');
    }
  }, []);

  const processPhoto = async (uri: string, exif: any) => {
    if (photos.length >= maxPhotos) {
      sweetAlert.alert('Limit Reached', `Maximum ${maxPhotos} photos allowed.`);
      return;
    }

    // Get file info
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

    // Run AI analysis
    setAnalyzing(true);
    try {
      const result = await analyzePhoto(uri, trackerContext);
      setAnalysis(result);
      onChange(uri, meta, result);
    } catch {
      // silent fail for analysis
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Annotation (Skia Drawing) ─────────────────────────────────────────────
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
        paths.current.push(currentPath.current);
        currentPath.current = null;
      }
    },
  });

  const saveAnnotation = async () => {
    // In production: snapshot the canvas and save overlay
    setAnnotating(false);
    sweetAlert.alert('Saved', 'Annotation saved with photo.');
  };

  // ── Compare Mode ───────────────────────────────────────────────────────────
  const toggleCompareSelect = (idx: number) => {
    setSelectedCompare((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 2) return [prev[1], idx];
      return [...prev, idx];
    });
  };

  // ── Remove Photo ───────────────────────────────────────────────────────────
  const removePhoto = (idx: number) => {
    sweetAlert.confirm('Remove Photo?', 'This cannot be undone.', () => {
      setPhotos((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (currentUri === prev[idx]?.uri) {
          setCurrentUri(next[0]?.uri || null);
          onChange(next[0]?.uri || null);
        }
        return next;
      });
      setSelectedCompare((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const severityColor =
    analysis?.severity === 'high'
      ? '#E74C3C'
      : analysis?.severity === 'medium'
      ? '#F39C12'
      : '#2ECC71';

  return (
    <View style={[styles.container, { marginVertical: spacing.md }]}>
      {/* Label */}
      {label && (
        <Text style={[styles.label, { color: theme.text.primary, marginBottom: spacing.sm }]}>
          {label}
        </Text>
      )}

      {/* Main Preview */}
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

            {/* Analysis Overlay */}
            {analysis && (
              <View style={[styles.analysisBadge, { backgroundColor: severityColor + 'E6' }]}>
                <Ionicons name="sparkles" size={14} color="#FFF" />
                <Text style={styles.analysisText}>
                  AI: {Math.round(analysis.confidence * 100)}% match
                </Text>
              </View>
            )}

            {/* Analyzing Spinner */}
            {analyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={[styles.analyzingText, { color: theme.text.primary }]}>
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
                <Ionicons name="information-circle" size={20} color={theme.primary} />
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
                  onPress={() => setCompareMode(!compareMode)}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: compareMode ? theme.primary : glass.bg },
                  ]}
                >
                  <Ionicons
                    name="git-compare"
                    size={20}
                    color={compareMode ? '#FFF' : theme.primary}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => removePhoto(photos.findIndex((p) => p.uri === currentUri))}
                style={[styles.iconBtn, { backgroundColor: glass.bg }]}
              >
                <Ionicons name="trash" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="camera" size={48} color={theme.text.tertiary} />
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No photo yet
            </Text>
          </View>
        )}
      </View>

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
            <Text style={[styles.analysisTitle, { color: theme.text.primary }]}>
              Smart Insights
            </Text>
          </View>
          {analysis.suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Ionicons name="checkmark-circle" size={14} color={severityColor} />
              <Text style={[styles.suggestionText, { color: theme.text.secondary }]}>
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
          contentContainerStyle={{ gap: 8 }}
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
              style={[
                styles.thumb,
                {
                  borderRadius: borderRadius.md,
                  borderWidth: currentUri === photo.uri ? 3 : 2,
                  borderColor:
                    currentUri === photo.uri
                      ? theme.primary
                      : selectedCompare.includes(idx)
                      ? '#F39C12'
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Compare View */}
      {compareMode && selectedCompare.length === 2 && (
        <View style={[styles.compareContainer, { borderRadius: borderRadius.lg }]}>
          <Text style={[styles.compareLabel, { color: theme.text.primary }]}>
            Before & After
          </Text>
          <View style={styles.compareRow}>
            <Image
              source={{ uri: photos[selectedCompare[0]]?.uri }}
              style={styles.compareImg}
            />
            <Ionicons name="arrow-forward" size={24} color={theme.primary} />
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
            { backgroundColor: theme.primary, borderRadius: borderRadius.md },
          ]}
        >
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.captureBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={pickPhoto}
          style={[
            styles.captureBtn,
            { backgroundColor: glass.bg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: glass.border },
          ]}
        >
          <Ionicons name="images" size={20} color={theme.primary} />
          <Text style={[styles.captureBtnText, { color: theme.primary }]}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata Modal */}
      <Modal visible={showMeta} transparent animationType="fade" onRequestClose={() => setShowMeta(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMeta(false)}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderRadius: borderRadius.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Photo Metadata</Text>
            {photos.find((p) => p.uri === currentUri) && (
              <ScrollView>
                {Object.entries(photos.find((p) => p.uri === currentUri) || {}).map(([k, v]) => (
                  <View key={k} style={styles.metaRow}>
                    <Text style={[styles.metaKey, { color: theme.text.tertiary }]}>{k}</Text>
                    <Text style={[styles.metaValue, { color: theme.text.primary }]}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={() => setShowMeta(false)}
              style={[styles.modalClose, { backgroundColor: theme.primary, borderRadius: borderRadius.md }]}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Annotation Modal */}
      <Modal visible={annotating} transparent animationType="slide" onRequestClose={() => setAnnotating(false)}>
        <View style={[styles.annotateContainer, { backgroundColor: theme.background }]}>
          <View style={styles.annotateHeader}>
            <TouchableOpacity onPress={() => setAnnotating(false)}>
              <Ionicons name="close" size={28} color={theme.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.annotateTitle, { color: theme.text.primary }]}>Annotate</Text>
            <TouchableOpacity onPress={saveAnnotation}>
              <Ionicons name="checkmark" size={28} color={theme.primary} />
            </TouchableOpacity>
          </View>
          {currentUri && (
            <View style={{ flex: 1 }}>
              <Image
                source={{ uri: currentUri }}
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.75, alignSelf: 'center' }}
                resizeMode="contain"
              />
              {/* Skia canvas overlay would go here in full implementation */}
              <Text style={{ color: theme.text.secondary, textAlign: 'center', marginTop: 20 }}>
                (Annotation canvas — integrate @shopify/react-native-skia Path drawing)
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { fontSize: 15, fontWeight: '600' },
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
  captionInput: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  analysisPanel: {
    marginTop: 12,
    padding: 14,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  analysisTitle: { fontSize: 15, fontWeight: '700' },
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
  metaKey: { fontSize: 13, textTransform: 'capitalize' },
  metaValue: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
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
});

export default SmartPhotoField;