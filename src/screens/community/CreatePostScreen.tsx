import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  Dimensions,
  Image,
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { FadeInUp } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCommunity, type Topic, type Poll, type PostMood } from '../../context/CommunityContext';
import { useMedia } from '../../context/MediaContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CreatePost'>;

const { width: SCREEN_W } = Dimensions.get('window');

/* ── The Loom palette ─────────────────────────────────────── */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',

  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',

  darkBg: '#0c0a09',
  darkCard: '#292524',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',

  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

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
  { value: 'celebrating', emoji: '🎉', label: 'Celebrating', color: '#f59e0b', bgColor: '#f59e0b20' },
  { value: 'support', emoji: '💙', label: 'Support', color: '#3b82f6', bgColor: '#3b82f620' },
  { value: 'advice', emoji: '💡', label: 'Advice', color: '#8b5cf6', bgColor: '#8b5cf620' },
  { value: 'milestone', emoji: '🏆', label: 'Milestone', color: '#10b981', bgColor: '#10b98120' },
  { value: 'venting', emoji: '💨', label: 'Venting', color: '#ef4444', bgColor: '#ef444420' },
];

const SMART_SUGGESTIONS = [
  "Share a milestone your little one reached 🎉",
  "Ask for sleep training advice 😴",
  "What's your favorite parenting hack? 💡",
  "Celebrate a small win today 🌟",
  "Need support? We're here 💙",
  "Potty training tip that worked for us 🚽",
  "Sleep regression survival guide 😴",
  "Baby-led weaning experience 🍼",
  "Early learning activity we love 📚",
  "Natural remedies that actually work 💊",
  "Toddler tantrum survival tips 😤",
  "First day of school story 📚",
  "How we handle screen time 📱",
  "Meal prep for busy parents 🍱",
  "Date night ideas for parents 💕",
];

const KEYWORD_MAP: Record<string, string[]> = {
  topic_health_fever: ['fever', 'temperature'],
  topic_health_allergy: ['allergy', 'allergies', 'reaction'],
  topic_health_teething: ['teething', 'tooth', 'teeth'],
  topic_health_vaccines: ['vaccine', 'vaccination', 'immunization'],
  topic_health_doctor: ['doctor', 'pediatrician', 'clinic'],
  topic_nutrition_breastfeeding: ['breast', 'nursing', 'latch'],
  topic_nutrition_solid_food: ['solid', 'blw', 'weaning'],
  topic_nutrition_formula: ['formula', 'bottle'],
  topic_sleep_baby: ['sleep', 'nap', 'bedtime', 'night'],
  topic_sleep_toddler: ['toddler', 'sleep', 'regression'],
  topic_sleep_night_waking: ['night', 'waking', 'awake'],
  topic_dev_milestones: ['milestone', 'first', 'walk', 'talk'],
  topic_dev_motor_skills: ['crawl', 'motor', 'skills'],
  topic_dev_speech: ['speech', 'word', 'language'],
  topic_dev_social: ['social', 'play', 'friends'],
  topic_dev_emotional: ['emotion', 'feelings'],
  topic_parenting_potty: ['potty', 'toilet', 'pee', 'poop'],
  topic_parenting_tantrums: ['tantrum', 'meltdown', 'cry'],
  topic_parenting_discipline: ['discipline', 'boundaries'],
  topic_parenting_single: ['single', 'solo', 'alone'],
  topic_parenting_special_needs: ['autism', 'adhd', 'special'],
  topic_lifestyle_screen_time: ['screen', 'tablet', 'tv'],
  topic_lifestyle_outdoor: ['outdoor', 'park', 'nature'],
  topic_lifestyle_work_life: ['work', 'career', 'balance'],
  topic_lifestyle_self_care: ['self-care', 'me-time'],
  topic_community_stories: ['story', 'journey'],
  topic_community_advice: ['advice', 'tip', 'trick'],
  topic_community_support: ['support', 'help'],
};

/* ── Safe media helpers ───────────────────────────────────────
   Camera assets can arrive as `content://`, `ph://`, or
   `assets-library://` URIs. `ImageManipulator.manipulateAsync` and
   `FileSystem.*` can throw natively on those — which crashes the
   app before our try/catch can run. So we (a) detect non-file URIs
   and skip manipulation entirely, (b) wrap every media step in a
   function that never throws, mirroring SmartPhotoField's strategy.
   ─────────────────────────────────────────────────────────── */

const isFileUri = (uri: string): boolean =>
  !!uri && (uri.startsWith('file://') || uri.startsWith('/'));

const isContentUri = (uri: string): boolean =>
  !!uri && (uri.startsWith('content://') || uri.startsWith('ph://') || uri.startsWith('assets-library://'));

/** Normalize a picker/camera URI to something both RN <Image> and
 *  FileSystem/ImageManipulator can safely consume. On Android,
 *  `content://` is fine for <Image> but NOT for FileSystem on all
 *  ROMs — so we transcode it via ImagePicker's built-in copy first. */
const normalizePickerUri = async (uri: string): Promise<string> => {
  if (!uri) return '';
  if (isFileUri(uri)) return uri;
  // content:// or ph:// — try to have the picker hand us a file:// copy.
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: (ImagePicker as any).MediaType?.Images ?? 'Images',
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const picked = result.assets[0].uri;
      if (isFileUri(picked)) return picked;
    }
  } catch {
    /* fall through */
  }
  return uri; // fall back to whatever we got
};

/** Never-throwing compress. On content/ph URIs we skip manipulation
 *  entirely and return the original — a slightly bigger image is
 *  better than a crash. */
const safeCompress = async (
  uri: string,
  compress: (u: string, q?: number) => Promise<string>,
  quality: number,
): Promise<string> => {
  if (!uri) return '';
  if (isContentUri(uri)) {
    // ImageManipulator will crash on these on many Android devices.
    return uri;
  }
  try {
    const out = await compress(uri, quality);
    return out || uri;
  } catch {
    return uri;
  }
};

/** Never-throwing cache step. If the copy fails we just keep the
 *  original URI — the post will still render. */
const safeCache = async (
  uri: string,
  cache: (u: string) => Promise<string>,
): Promise<string> => {
  if (!uri) return '';
  try {
    const out = await cache(uri);
    return out || uri;
  } catch {
    return uri;
  }
};

/* ── Image grid ───────────────────────────────────────────── */
const ImageGrid = ({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (i: number) => void;
}) => {
  if (images.length === 0) return null;
  return (
    <View style={s.imageGridWrapper}>
      {images.length === 1 ? (
        <View style={s.singleImageContainer}>
          <Image
            source={{ uri: images[0] }}
            style={s.singleImage}
            resizeMode="cover"
            onError={() => {
              if (__DEV__) console.warn('[ImageGrid] failed to load image:', images[0]);
            }}
          />
          <TouchableOpacity style={s.imageRemoveBtn} onPress={() => onRemove(0)}>
            <View style={s.imageRemoveInner}>
              <Ionicons name="close" size={16} color={DS.white} />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.multiImageGrid}>
          {images.slice(0, 4).map((uri, index) => (
            <View key={index} style={s.gridImageItem}>
              <Image
                source={{ uri }}
                style={s.gridImage}
                resizeMode="cover"
                onError={() => {
                  if (__DEV__) console.warn('[ImageGrid] failed to load grid image:', uri);
                }}
              />
              <TouchableOpacity style={s.imageRemoveBtn} onPress={() => onRemove(index)}>
                <View style={s.imageRemoveInner}>
                  <Ionicons name="close" size={14} color={DS.white} />
                </View>
              </TouchableOpacity>
              {index === 3 && images.length > 4 && (
                <View style={s.gridMoreOverlay}>
                  <Text style={s.gridMoreText}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/* ── Tool button ──────────────────────────────────────────── */
const ToolButton = ({
  icon,
  label,
  color,
  onPress,
  badge,
  isDark,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  badge?: number;
  isDark: boolean;
}) => (
  <TouchableOpacity style={s.toolButton} onPress={onPress} activeOpacity={0.75}>
    <View
      style={[
        s.toolIcon,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
      ]}
    >
      <Ionicons name={icon as any} size={22} color={color} />
      {badge !== undefined && badge > 0 && (
        <View style={[s.toolBadge, { backgroundColor: color }]}>
          <Text style={s.toolBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
    <Text style={[s.toolText, { color: isDark ? DS.gray400 : DS.gray600 }]}>{label}</Text>
  </TouchableOpacity>
);

/* ════════════════════════════════════════════════════════════
   Main
   ════════════════════════════════════════════════════════════ */
export default function CreatePostScreen({ navigation, route }: Props) {
  const topicId = route?.params?.topicId;
  const initialContent = route?.params?.initialContent;

  const {
    topics,
    createPost,
    currentUser,
    updateUserLocation,
    getSelectedTopics,
    updateSelectedTopics,
  } = useCommunity();

  const {
    pickMultipleImages,
    takePhoto: mediaTakePhoto,
    compressImage,
    cacheImage,
    isValidImageUri,
  } = useMedia();

  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const sweetAlert = useSweetAlert();

  const [content, setContent] = useState(initialContent || '');
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
  const [showSmartCompose, setShowSmartCompose] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('');

  /* Location detect */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const addresses = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (mounted && addresses[0]?.country) {
          setSelectedCountry(addresses[0].country);
          await updateUserLocation(addresses[0].country);
        }
      } catch (err) {
        if (__DEV__) console.warn('[CreatePost] location fail:', err);
      }
    })();
    return () => { mounted = false; };
  }, [updateUserLocation]);

  /* Auto-topic by keywords */
  useEffect(() => {
    if (content.length < 10 || selectedTopic) return;
    const lower = content.toLowerCase();
    let matched: Topic | undefined;
    for (const [id, keywords] of Object.entries(KEYWORD_MAP)) {
      if (keywords.some((k) => lower.includes(k))) {
        matched = topics.find((t) => t.id === id);
        if (matched) break;
      }
    }
    if (matched) {
      setSelectedTopic(matched);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [content, topics, selectedTopic]);

  /* Load selected topics */
  useEffect(() => {
    if (topics.length === 0) return;
    const saved = getSelectedTopics();
    if (!saved || saved.length === 0) {
      const fallback = topics.slice(0, 3).map((t) => t.id);
      setUserSelectedTopics(fallback);
      updateSelectedTopics(fallback);
    } else {
      setUserSelectedTopics(saved);
    }
  }, [topics, getSelectedTopics, updateSelectedTopics]);

  /* Pick target topic */
  useEffect(() => {
    if (topics.length === 0) return;
    let target: Topic | undefined;
    if (topicId) target = topics.find((t) => t.id === topicId);
    if (!target && userSelectedTopics.length > 0) {
      target = topics.find((t) => userSelectedTopics.includes(t.id));
    }
    if (!target) target = topics[0];
    setSelectedTopic(target || null);
    setTopicsLoaded(true);
  }, [topics, topicId, userSelectedTopics]);

  /* Draft save (debounced) */
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(
          'post_draft',
          JSON.stringify({
            content,
            images,
            selectedTopicId: selectedTopic?.id,
            mood: selectedMood,
            pollQuestion,
            pollOptions,
          }),
        );
      } catch {}
    };
    const t = setTimeout(save, 1000);
    return () => clearTimeout(t);
  }, [content, images, selectedTopic, selectedMood, pollQuestion, pollOptions]);

  /* Draft restore (once) */
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('post_draft');
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.content) setContent(draft.content);
        if (Array.isArray(draft.images)) {
          setImages(draft.images.filter((u: string) => isValidImageUri(u)));
        }
        if (draft.mood) setSelectedMood(draft.mood);
        if (draft.pollQuestion) setPollQuestion(draft.pollQuestion);
        if (Array.isArray(draft.pollOptions)) setPollOptions(draft.pollOptions);
      } catch {}
    })();
  }, [isValidImageUri]);

  const applySmartSuggestion = (suggestion: string) => {
    setContent(suggestion);
    setShowSmartCompose(false);
    setSmartPrompt('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const filteredSuggestions = smartPrompt.trim()
    ? SMART_SUGGESTIONS.filter((x) => x.toLowerCase().includes(smartPrompt.toLowerCase()))
    : SMART_SUGGESTIONS.slice(0, 5);

  /* ── Media handlers ──────────────────────────────────────── */
  const pickImage = async () => {
    try {
      setIsProcessingImages(true);
      const picked = await pickMultipleImages(4);
      if (picked && picked.length > 0) {
        const processed: string[] = [];
        for (const rawUri of picked) {
          // Normalize first — content:// and ph:// can't be trusted
          // with FileSystem / ImageManipulator on all devices.
          const uri = await normalizePickerUri(rawUri);
          const compressed = await safeCompress(uri, compressImage, 0.8);
          const cached = await safeCache(compressed, cacheImage);
          if (cached && isValidImageUri(cached)) {
            processed.push(cached);
          } else if (isValidImageUri(uri)) {
            processed.push(uri);
          }
        }
        setImages((prev) => [...prev, ...processed].slice(0, 4));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
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
      if (!photoUri) return;

      // Camera URIs on Android are often `content://…` which the native
      // FileSystem / ImageManipulator modules can crash on. Skip
      // manipulation for those — only compress/cache when it's a real
      // file:// URI (iOS `ph://` is also unsafe).
      const uri = await normalizePickerUri(photoUri);
      const compressed = await safeCompress(uri, compressImage, 0.8);
      const cached = await safeCache(compressed, cacheImage);
      const finalUri =
        cached && isValidImageUri(cached)
          ? cached
          : isValidImageUri(uri)
          ? uri
          : isValidImageUri(photoUri)
          ? photoUri
          : null;

      if (finalUri) {
        setImages((prev) => [...prev, finalUri].slice(0, 4));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        sweetAlert.error('Camera Error', 'Could not read the photo. Please try again.');
      }
    } catch (err) {
      if (__DEV__) console.warn('[CreatePost] takePhoto error:', err);
      sweetAlert.error('Camera Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsProcessingImages(false);
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const simulateProgress = async () => {
    const stages = [
      { progress: 15, status: 'Preparing your post...', delay: 250 },
      { progress: 35, status: 'Uploading images...', delay: 600 },
      { progress: 55, status: 'Processing media...', delay: 500 },
      { progress: 75, status: 'Almost there...', delay: 400 },
      { progress: 90, status: 'Finalizing...', delay: 300 },
      { progress: 100, status: 'Posted!', delay: 250 },
    ];
    for (const st of stages) {
      await new Promise((r) => setTimeout(r, st.delay));
      setPostProgress(st.progress);
      setPostStatus(st.status);
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
      const validOptions = pollOptions.filter((o) => o.trim().length > 0);
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
    } catch (err) {
      console.error('[CreatePost] error:', err);
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
        'Keep Editing',
      );
    } else {
      navigation.goBack();
    }
  };

  const handleCountrySelect = async (country: (typeof COUNTRIES)[0]) => {
    setSelectedCountry(country.name);
    await updateUserLocation(country.name);
    setShowCountryPicker(false);
    sweetAlert.toast('Location Updated', `Set to ${country.flag} ${country.name}`, 'success');
  };

  const handleSaveSelectedTopics = async (next: string[]) => {
    await updateSelectedTopics(next);
    setUserSelectedTopics(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  const removePollOption = (i: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, idx) => idx !== i));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  const updatePollOption = (i: number, text: string) => {
    const next = [...pollOptions];
    next[i] = text;
    setPollOptions(next);
  };

  const characterCount = content.length;
  const maxCharacters = 1000;
  const hasContent = content.trim().length > 0 || images.length > 0 || pollQuestion.trim().length > 0;
  const filteredTopics = userSelectedTopics.length
    ? topics.filter((t) => userSelectedTopics.includes(t.id))
    : topics;
  const avatarSource = isAnonymous ? '🎭' : currentUser?.avatar;

  /* ── Loading gate ────────────────────────────────────────── */
  if (!topicsLoaded || topics.length === 0 || !selectedTopic) {
    return (
      <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)'] : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)']}
          style={StyleSheet.absoluteFill}
        />
        <CommunitySpinner visible={true} text="Loading topics..." size="medium" overlay={false} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Aura background */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)', 'transparent']
            : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

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
      <CommunitySpinner
        visible={isProcessingImages}
        text="Processing images..."
        size="medium"
        overlay={true}
        blur={true}
        variant="nebula"
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.keyboardView}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleCancel} style={[s.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white }]}>
            <Ionicons name="close" size={22} color={isDark ? DS.white : DS.gray900} />
          </TouchableOpacity>
          <Text style={[s.title, { color: isDark ? DS.white : DS.gray900 }]}>New Post</Text>
          <TouchableOpacity
            style={[s.postButton, hasContent && s.postButtonActive]}
            disabled={!hasContent || isPosting}
            onPress={handlePost}
          >
            {hasContent ? (
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.postButtonGrad}
              >
                {isPosting ? (
                  <InlineSpinner size={16} color={DS.white} section="community" variant="liquid" />
                ) : (
                  <Text style={s.postButtonTextActive}>Post</Text>
                )}
              </LinearGradient>
            ) : (
              <Text style={[s.postButtonText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Animated.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Smart Compose */}
          <Animated.View entering={FadeInUp.delay(50).duration(400)}>
            <TouchableOpacity
              style={[s.smartBanner, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : DS.primaryGhost, borderColor: `${DS.primary}25` }]}
              onPress={() => setShowSmartCompose(!showSmartCompose)}
              activeOpacity={0.85}
            >
              <View style={s.smartBannerLeft}>
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.smartIcon}
                >
                  <Ionicons name="sparkles" size={18} color={DS.white} />
                </LinearGradient>
                <View>
                  <Text style={[s.smartTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                    Smart Compose
                  </Text>
                  <Text style={[s.smartSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    AI-powered writing assistant
                  </Text>
                </View>
              </View>
              <Ionicons
                name={showSmartCompose ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDark ? DS.gray400 : DS.gray500}
              />
            </TouchableOpacity>
          </Animated.View>

          {showSmartCompose && (
            <Animated.View
              entering={FadeInUp.delay(100).duration(300)}
              style={[s.smartExpanded, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}
            >
              <View style={[s.smartInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
                <Ionicons name="search" size={16} color={DS.primary} />
                <TextInput
                  style={[s.smartInput, { color: isDark ? DS.white : DS.gray900 }]}
                  placeholder="Describe what you want to post about..."
                  placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                  value={smartPrompt}
                  onChangeText={setSmartPrompt}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (filteredSuggestions[0]) applySmartSuggestion(filteredSuggestions[0]);
                  }}
                />
                {smartPrompt.length > 0 && (
                  <TouchableOpacity onPress={() => setSmartPrompt('')}>
                    <Ionicons name="close-circle" size={16} color={isDark ? DS.gray400 : DS.gray500} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.smartSuggestions}>
                {filteredSuggestions.slice(0, 5).map((sug, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.smartChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : DS.primaryGhost, borderColor: `${DS.primary}20` }]}
                    onPress={() => applySmartSuggestion(sug)}
                  >
                    <Ionicons name="flash" size={12} color={DS.primary} />
                    <Text style={[s.smartChipText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>
                      {sug}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {content.length > 0 && (
                <View style={[s.smartHelp, { backgroundColor: isDark ? 'rgba(99,102,241,0.06)' : `${DS.primary}06` }]}>
                  <Ionicons name="information-circle-outline" size={14} color={DS.primary} />
                  <Text style={[s.smartHelpText, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                    {content.length < 20
                      ? '💡 Try adding more detail to your post'
                      : content.length < 50
                      ? '✨ Looking great! Add a question to engage others'
                      : '🌟 Ready to post! Add images or a poll for more engagement'}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Author card */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)}>
            <View style={[s.authorCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
              <View style={s.authorRow}>
                <SafeAvatar
                  avatar={avatarSource}
                  size={48}
                  fallbackIcon={isAnonymous ? 'mask' : 'person'}
                  fallbackColor={selectedTopic.color}
                  fallbackBgColor={`${selectedTopic.color}20`}
                />
                <View style={s.authorInfo}>
                  <Text style={[s.authorName, { color: isDark ? DS.white : DS.gray900 }]}>
                    {isAnonymous ? 'Anonymous' : currentUser?.displayName || 'You'}
                  </Text>
                  <View style={s.authorMeta}>
                    <TouchableOpacity
                      style={[s.topicChip, { backgroundColor: `${selectedTopic.color}18` }]}
                      onPress={() => setShowTopicSelector(true)}
                    >
                      <Text style={s.topicChipEmoji}>{selectedTopic.emoji}</Text>
                      <Text style={[s.topicChipText, { color: selectedTopic.color }]}>
                        {selectedTopic.name}
                      </Text>
                      <Ionicons name="chevron-down" size={11} color={selectedTopic.color} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.locationChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : `${DS.primary}10` }]}
                      onPress={() => setShowCountryPicker(true)}
                    >
                      <Ionicons name="location-outline" size={11} color={DS.primary} />
                      <Text style={[s.locationChipText, { color: DS.primary }]}>
                        {selectedCountry || 'Add location'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.anonToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}
                  onPress={() => setIsAnonymous(!isAnonymous)}
                >
                  <Ionicons
                    name={isAnonymous ? 'eye-off' : 'eye-outline'}
                    size={18}
                    color={isAnonymous ? DS.primary : isDark ? DS.gray400 : DS.gray500}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Mood */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <View style={s.moodSection}>
              <Text style={[s.sectionLabel, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                How are you feeling?
              </Text>
              <View style={s.moodRow}>
                {MOODS.map((mood) => {
                  const active = selectedMood === mood.value;
                  return (
                    <TouchableOpacity
                      key={mood.value}
                      style={[
                        s.moodPill,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: 'transparent' },
                        active && { backgroundColor: mood.bgColor, borderColor: mood.color },
                      ]}
                      onPress={() => {
                        setSelectedMood(active ? undefined : mood.value);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={s.moodPillEmoji}>{mood.emoji}</Text>
                      <Text
                        style={[
                          s.moodPillLabel,
                          { color: active ? mood.color : isDark ? DS.gray400 : DS.gray600 },
                          active && { fontWeight: '800' },
                        ]}
                      >
                        {mood.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Content */}
          <Animated.View entering={FadeInUp.delay(250).duration(400)}>
            <View style={s.contentArea}>
              <TextInput
                style={[s.textInput, { color: isDark ? DS.gray200 : DS.gray800 }]}
                placeholder="What's on your mind? Share your experience, ask a question, or offer support..."
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                maxLength={maxCharacters}
              />
              <Text style={[s.characterCount, { color: characterCount > maxCharacters * 0.9 ? DS.danger : isDark ? DS.gray500 : DS.gray400 }]}>
                {characterCount}/{maxCharacters}
              </Text>
            </View>
          </Animated.View>

          {/* Images */}
          {images.length > 0 && (
            <Animated.View entering={FadeInUp.duration(300)}>
              <ImageGrid images={images} onRemove={removeImage} />
            </Animated.View>
          )}

          {/* Poll */}
          {showPollCreator && (
            <Animated.View entering={FadeInUp.duration(300)}>
              <View style={[s.pollCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
                <View style={s.pollHeader}>
                  <View style={s.pollHeaderLeft}>
                    <Ionicons name="stats-chart" size={18} color={DS.primary} />
                    <Text style={[s.pollTitle, { color: isDark ? DS.white : DS.gray900 }]}>Poll</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowPollCreator(false);
                      setPollQuestion('');
                      setPollOptions(['', '']);
                    }}
                  >
                    <Ionicons name="close" size={20} color={isDark ? DS.gray400 : DS.gray500} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[s.pollQuestionInput, { color: isDark ? DS.white : DS.gray900, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}
                  placeholder="Ask a question..."
                  placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  maxLength={200}
                />

                <View style={s.pollOptionsList}>
                  {pollOptions.map((option, index) => (
                    <View key={index} style={s.pollOptionRow}>
                      <View style={[s.pollOptionInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
                        <Text style={s.pollBullet}>{String.fromCharCode(65 + index)}</Text>
                        <TextInput
                          style={[s.pollOptionInput, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                          value={option}
                          onChangeText={(t) => updatePollOption(index, t)}
                          maxLength={100}
                        />
                      </View>
                      {pollOptions.length > 2 && (
                        <TouchableOpacity onPress={() => removePollOption(index)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={22} color={DS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                {pollOptions.length < 4 && (
                  <TouchableOpacity
                    style={[s.addOptionBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : DS.primaryGhost }]}
                    onPress={addPollOption}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={DS.primary} />
                    <Text style={[s.addOptionText, { color: DS.primary }]}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}

          {/* Topics strip */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <View style={s.topicsStripHeader}>
              <Text style={[s.sectionLabel, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                Your Topics
              </Text>
              <TouchableOpacity
                style={[s.manageTopicsBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : DS.primaryGhost }]}
                onPress={() => setShowTopicSelector(true)}
              >
                <Ionicons name="options-outline" size={13} color={DS.primary} />
                <Text style={[s.manageTopicsText, { color: DS.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>

            {filteredTopics.length > 0 ? (
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.topicsStrip}>
                {filteredTopics.map((topic) => {
                  const active = selectedTopic.id === topic.id;
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        s.topicPill,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white,
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        },
                        active && { backgroundColor: `${topic.color}20`, borderColor: topic.color },
                      ]}
                      onPress={() => {
                        setSelectedTopic(topic);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={s.topicPillEmoji}>{topic.emoji}</Text>
                      <Text
                        style={[
                          s.topicPillName,
                          { color: active ? topic.color : isDark ? DS.gray400 : DS.gray600 },
                          active && { fontWeight: '800' },
                        ]}
                      >
                        {topic.name}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={14} color={topic.color} />}
                    </TouchableOpacity>
                  );
                })}
              </Animated.ScrollView>
            ) : (
              <TouchableOpacity
                style={s.noTopicsBanner}
                onPress={() => setShowTopicSelector(true)}
              >
                <LinearGradient
                  colors={[`${DS.primary}12`, `${DS.primary}04`]}
                  style={s.noTopicsGradient}
                >
                  <Ionicons name="bookmark-outline" size={22} color={DS.primary} />
                  <Text style={[s.noTopicsTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                    No topics selected yet
                  </Text>
                  <Text style={[s.noTopicsSubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    Tap here to choose topics you're interested in
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Media tools */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={s.toolsSection}>
            <Text style={[s.sectionLabel, { color: isDark ? DS.gray400 : DS.gray600 }]}>
              Add to your post
            </Text>
            <View style={s.toolsRow}>
              <ToolButton
                icon="image-outline"
                label="Gallery"
                color={DS.primary}
                onPress={pickImage}
                badge={images.length > 0 ? images.length : undefined}
                isDark={isDark}
              />
              <ToolButton
                icon="camera-outline"
                label="Camera"
                color={DS.success}
                onPress={takePhoto}
                isDark={isDark}
              />
              <ToolButton
                icon="stats-chart-outline"
                label="Poll"
                color={DS.accent}
                onPress={() => {
                  setShowPollCreator(!showPollCreator);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                badge={showPollCreator ? 1 : undefined}
                isDark={isDark}
              />
            </View>
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={s.tipsContainer}>
            <LinearGradient
              colors={isDark ? [`${DS.primary}12`, `${DS.primary}04`] : [`${DS.primary}08`, `${DS.primary}02`]}
              style={s.tipsGradient}
            >
              <View style={s.tipsHeader}>
                <Ionicons name="bulb-outline" size={18} color={DS.primary} />
                <Text style={[s.tipsTitle, { color: DS.primary }]}>Tips for great posts</Text>
              </View>
              <View style={s.tipsList}>
                {[
                  { text: 'Be kind and supportive', color: DS.primary },
                  { text: 'Share specific details', color: DS.success },
                  { text: 'Use photos to tell your story', color: DS.accent },
                  { text: 'Ask questions to engage others', color: DS.info },
                ].map((tip, i) => (
                  <View key={i} style={s.tipItem}>
                    <View style={[s.tipDot, { backgroundColor: tip.color }]} />
                    <Text style={[s.tipText, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                      {tip.text}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Country picker */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={90} style={[s.modalContent, { backgroundColor: isDark ? DS.darkSurface : DS.white }]} tint={isDark ? 'dark' : 'light'}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                Select Location
              </Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    s.countryItem,
                    selectedCountry === country.name && { backgroundColor: isDark ? 'rgba(99,102,241,0.10)' : `${DS.primary}10` },
                  ]}
                  onPress={() => handleCountrySelect(country)}
                >
                  <Text style={s.countryFlag}>{country.flag}</Text>
                  <Text
                    style={[
                      s.countryName,
                      { color: isDark ? DS.gray200 : DS.gray800 },
                      selectedCountry === country.name && { color: DS.primary, fontWeight: '700' },
                    ]}
                  >
                    {country.name}
                  </Text>
                  {selectedCountry === country.name && (
                    <Ionicons name="checkmark" size={18} color={DS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Topic selector */}
      <Modal
        visible={showTopicSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicSelector(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={90} style={[s.modalContent, { maxHeight: '85%', backgroundColor: isDark ? DS.darkSurface : DS.white }]} tint={isDark ? 'dark' : 'light'}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  Select Your Topics
                </Text>
                <Text style={[s.modalSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Choose up to 5 topics to personalize your feed
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopicSelector(false)}>
                <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
              </TouchableOpacity>
            </View>

            <Text style={[s.topicCounter, { color: DS.primary }]}>
              {userSelectedTopics.length}/5 selected
            </Text>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View style={s.topicGrid}>
                {topics.map((topic) => {
                  const isSelected = userSelectedTopics.includes(topic.id);
                  const isMaxReached = userSelectedTopics.length >= 5 && !isSelected;
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        s.topicGridItem,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.white,
                          borderColor: isSelected
                            ? topic.color
                            : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.06)',
                        },
                        isSelected && { backgroundColor: `${topic.color}15` },
                        isMaxReached && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        if (isMaxReached) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          sweetAlert.warning('Maximum Topics Reached', 'You can select up to 5 topics.');
                          return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const next = isSelected
                          ? userSelectedTopics.filter((id) => id !== topic.id)
                          : [...userSelectedTopics, topic.id];
                        handleSaveSelectedTopics(next);
                      }}
                      disabled={isMaxReached}
                    >
                      <Text style={s.topicGridEmoji}>{topic.emoji}</Text>
                      <Text
                        style={[
                          s.topicGridName,
                          { color: isDark ? DS.gray200 : DS.gray800 },
                          isSelected && { color: topic.color, fontWeight: '800' },
                        ]}
                      >
                        {topic.name}
                      </Text>
                      {isSelected && (
                        <View style={[s.topicGridCheck, { backgroundColor: topic.color }]}>
                          <Ionicons name="checkmark" size={14} color={DS.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[s.topicSelectorFooter, { borderTopColor: isDark ? DS.darkBorder : DS.lightBorder }]}>
              <TouchableOpacity onPress={() => setShowTopicSelector(false)} style={s.doneBtn}>
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.doneBtnGradient}
                >
                  <Text style={s.doneBtnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   Styles
   ════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...DS.shadow.sm,
  },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  postButton: {
    minWidth: 76,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonActive: { ...DS.shadow.md },
  postButtonGrad: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  postButtonText: { fontSize: 14, fontWeight: '700' },
  postButtonTextActive: { fontSize: 14, fontWeight: '800', color: DS.white },

  /* Smart banner */
  smartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
  },
  smartBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smartIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartTitle: { fontSize: 14, fontWeight: '800' },
  smartSubtitle: { fontSize: 11, fontWeight: '500' },

  smartExpanded: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  smartInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  smartInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  smartSuggestions: { gap: 8, marginBottom: 12 },
  smartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
  },
  smartChipText: { flex: 1, fontSize: 13, fontWeight: '500' },
  smartHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: DS.radius.md,
  },
  smartHelpText: { flex: 1, fontSize: 12, fontWeight: '500' },

  /* Author */
  authorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: DS.radius.xl,
    padding: 16,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorInfo: { flex: 1, marginLeft: 12 },
  authorName: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  authorMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topicChipEmoji: { fontSize: 12 },
  topicChipText: { fontSize: 12, fontWeight: '700' },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  locationChipText: { fontSize: 11, fontWeight: '700' },
  anonToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Mood */
  moodSection: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    borderWidth: 1.5,
    gap: 6,
    ...DS.shadow.sm,
  },
  moodPillEmoji: { fontSize: 15 },
  moodPillLabel: { fontSize: 12.5, fontWeight: '700' },

  /* Content */
  contentArea: { marginHorizontal: 16, marginBottom: 16 },
  textInput: { fontSize: 16.5, lineHeight: 25, minHeight: 120, paddingVertical: 8 },
  characterCount: { fontSize: 11.5, textAlign: 'right', marginTop: 4, fontWeight: '600' },

  /* Images */
  imageGridWrapper: { marginHorizontal: 16, marginBottom: 16, borderRadius: DS.radius.xl, overflow: 'hidden' },
  singleImageContainer: { position: 'relative', borderRadius: DS.radius.xl, overflow: 'hidden' },
  singleImage: { width: '100%', height: 240, borderRadius: DS.radius.xl },
  multiImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridImageItem: {
    width: (SCREEN_W - 32 - 4) / 2,
    height: (SCREEN_W - 32 - 4) / 2,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  imageRemoveBtn: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  imageRemoveInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: DS.radius.lg,
  },
  gridMoreText: { color: DS.white, fontSize: 22, fontWeight: '800' },

  /* Poll */
  pollCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: DS.radius.xl,
    padding: 16,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pollHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollTitle: { fontSize: 15, fontWeight: '800' },
  pollQuestionInput: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DS.radius.lg,
    marginBottom: 12,
    borderWidth: 1,
  },
  pollOptionsList: { gap: 10 },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollOptionInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.radius.lg,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  pollBullet: { fontSize: 13, fontWeight: '800', color: DS.primary, width: 24 },
  pollOptionInput: { flex: 1, fontSize: 13.5, paddingVertical: 10 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addOptionText: { fontSize: 12.5, fontWeight: '800' },

  /* Topics strip */
  topicsStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  manageTopicsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  manageTopicsText: { fontSize: 11.5, fontWeight: '800' },
  topicsStrip: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    borderWidth: 1,
    gap: 6,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  topicPillEmoji: { fontSize: 15 },
  topicPillName: { fontSize: 12.5, fontWeight: '700' },
  noTopicsBanner: { marginHorizontal: 16, marginBottom: 16, borderRadius: DS.radius.xl, overflow: 'hidden' },
  noTopicsGradient: { padding: 20, alignItems: 'center', gap: 6 },
  noTopicsTitle: { fontSize: 14, fontWeight: '800' },
  noTopicsSubtext: { fontSize: 12, textAlign: 'center' },

  /* Tools */
  toolsSection: { marginHorizontal: 16, marginBottom: 20 },
  toolsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  toolButton: { alignItems: 'center', gap: 6 },
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
    borderColor: DS.white,
  },
  toolBadgeText: { color: DS.white, fontSize: 10, fontWeight: '800' },
  toolText: { fontSize: 11.5, fontWeight: '700' },

  /* Tips */
  tipsContainer: { marginHorizontal: 16, marginBottom: 24, borderRadius: DS.radius.xl, overflow: 'hidden' },
  tipsGradient: { padding: 20 },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  tipsTitle: { fontSize: 14, fontWeight: '800' },
  tipsList: { gap: 10 },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot: { width: 8, height: 8, borderRadius: 4 },
  tipText: { fontSize: 12.5, fontWeight: '500' },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    maxHeight: '85%',
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
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSubtitle: { fontSize: 12.5, marginTop: 2 },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  countryFlag: { fontSize: 22 },
  countryName: { flex: 1, fontSize: 15 },

  topicCounter: { fontSize: 13, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 20 },
  topicGridItem: {
    width: (SCREEN_W - 72) / 2,
    padding: 16,
    borderRadius: DS.radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 8,
  },
  topicGridEmoji: { fontSize: 28 },
  topicGridName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  topicSelectorFooter: { paddingTop: 16, borderTopWidth: 1 },
  doneBtn: { borderRadius: 16, overflow: 'hidden', ...DS.shadow.md },
  doneBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  doneBtnText: { color: DS.white, fontSize: 15, fontWeight: '800' },
});